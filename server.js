require("dotenv").config();
const http = require("http");
const crypto = require("crypto");
const multer = require("multer");
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const next = require("next");
const { Server } = require("socket.io");
const User = require("./server/models/User");
const Group = require("./server/models/Group");
const PasswordReset = require("./server/models/PasswordReset");
const authenticateToken = require("./server/middleware/auth");
const requireAdmin = require("./server/middleware/adminMiddleware");
const { upload, MAX_FILE_SIZE } = require("./server/middleware/upload");
const { uploadAvatar } = require("./server/middleware/uploadAvatar");
const { uploadMedia } = require("./server/services/s3");
const { sendPasswordResetEmail } = require("./server/services/mailService");
const { isMailConfigured } = require("./server/config/mail");
const { createRateLimiter } = require("./server/utils/rateLimiter");
const Message = require("./server/models/Message");
const ArchivedChat = require("./server/models/ArchivedChat");
const { startArchiveJob } = require("./server/jobs/archiveChats");
const registerChatHandlers = require("./server/socket/handlers/chat");
const registerPresenceHandlers = require("./server/socket/handlers/presence");
const { registerReceiptHandlers } = require("./server/socket/handlers/receipts");
const { normalizeEmail, createPersonalRoomId } = require("./server/utils/room");
const { canAccessRoom } = require("./server/services/roomAccessService");
const { loadRoomPage } = require("./server/services/messageHistoryService");
const { presenceSummary } = require("./server/services/presenceService");
const aiRoutes = require("./server/routes/aiRoutes");
const {
resolveSignupStatus,
canSendMessage,
canJoinOrCreateGroup,
consumeTrialMessageIfNeeded,
ensureAdminRoleSynced,
getAdminEmail,
trialSummary,
sanitizePublicUser
} = require("./server/services/approvalService");
const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handleNextRequest = nextApp.getRequestHandler();

const app = express();
// Behind a reverse proxy (Render, etc.) req.ip would otherwise be the
// proxy's own IP for every request, making all users share one rate-limit
// bucket. This makes Express read the real client IP from X-Forwarded-For.
app.set("trust proxy", 1);
const httpServer = http.createServer(app);
// Everything - the Next.js frontend AND this API/Socket.IO backend - runs as
// ONE process on ONE port now, so there's no cross-origin request at all and
// no CORS configuration is needed (unlike the earlier two-server setup).
const io = new Server(httpServer);
const PORT = process.env.PORT || 3000;
const RESET_TOKEN_EXPIRY_MINUTES = Number(process.env.RESET_TOKEN_EXPIRY_MINUTES) || 15;
const forgotPasswordRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
// Broad abuse protection across every API route, plus a stricter limiter
// specifically on signup/login to slow down credential-stuffing / spam
// signups. Forgot-password keeps its own separate, tighter limiter above -
// this doesn't replace that, it's an additional general-purpose layer.
const generalApiRateLimit = createRateLimiter({ windowMs: 60 * 1000, max: 120 });
const authRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
function rateLimitMiddleware(limiter, { keyPrefix, message }) {
return (req, res, next) => {
const key = `${keyPrefix}:${req.ip}`;
const { limited, retryAfterMs } = limiter(key);
if (limited) {
return res.status(429).json({
success: false,
message: message || `Too many requests. Please try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).`
});
}
next();
};
}
app.use(express.json());
app.use(
"/api",
rateLimitMiddleware(generalApiRateLimit, {
keyPrefix: "api",
message: "Too many requests. Please slow down and try again shortly."
})
);
app.use("/api/ai", aiRoutes);
// Mongo connection + server startup happen at the bottom of this file, once
// Next.js has finished preparing (see nextApp.prepare().then(...) below).
// ---------------- AUTH ----------------
const authRateLimitMiddleware = rateLimitMiddleware(authRateLimit, {
keyPrefix: "auth",
message: "Too many attempts. Please wait a few minutes and try again."
});
app.post("/api/signup", authRateLimitMiddleware, async (req, res) => {
try {
const { name, email, phone, password } = req.body;
if (!name || !email || !phone || !password) {
return res.status(400).json({
success: false,
message: "All fields are required"
});
}
const normalizedEmail = normalizeEmail(email);
const existingUser = await User.findOne({
$or: [
{ email: normalizedEmail },
{ phone: String(phone).trim() }
]
});
if (existingUser) {
return res.status(400).json({
success: false,
message: "User already exists with this email or phone number"
});
}
const hashedPassword = await bcrypt.hash(password, 10);
const { role, approvalStatus } = resolveSignupStatus(normalizedEmail);
const user = await User.create({
name: String(name).trim(),
email: normalizedEmail,
phone: String(phone).trim(),
password: hashedPassword,
role,
approvalStatus
});
return res.status(201).json({
success: true,
message: role === "admin"
? "Admin account registered successfully"
: "User registered successfully. Your account is pending admin approval; you can start chatting right away with a free trial.",
user: sanitizePublicUser(user)
});
} catch (error) {
console.error("Signup error:", error);
return res.status(500).json({
success: false,
message: "Internal server error"
});
}
});
app.post("/api/login", authRateLimitMiddleware, async (req, res) => {
try {
const { login, password } = req.body;
if (!login || !password) {
return res.status(400).json({
success: false,
message: "Login and password are required"
});
}
const loginValue = String(login).trim();
const user = await User.findOne({
$or: [
{ email: loginValue.toLowerCase() },
{ phone: loginValue }
]
});
if (!user) {
return res.status(401).json({
success: false,
message: "Invalid email/phone or password"
});
}
const validPassword = await bcrypt.compare(password, user.password);
if (!validPassword) {
return res.status(401).json({
success: false,
message: "Invalid email/phone or password"
});
}
await ensureAdminRoleSynced(user);
const token = jwt.sign(
{
userId: user._id.toString(),
email: user.email
},
process.env.JWT_SECRET,
{ expiresIn: "7d" }
);
return res.json({
success: true,
message: "Login successful",
token,
user: sanitizePublicUser(user)
});
} catch (error) {
console.error("Login error:", error);
return res.status(500).json({
success: false,
message: "Internal server error"
});
}
});
// ---------------- FORGOT / RESET PASSWORD ----------------
app.post("/api/auth/forgot-password", async (req, res) => {
// Generic response either way - never reveal whether an email is registered.
const genericResponse = {
success: true,
message: "If that email is registered, a password reset link has been sent."
};
try {
const email = normalizeEmail(req.body.email);
if (!email) {
return res.status(400).json({ success: false, message: "Email is required" });
}
const rateKey = `forgot-password:${req.ip}:${email}`;
const { limited, retryAfterMs } = forgotPasswordRateLimit(rateKey);
if (limited) {
return res.status(429).json({
success: false,
message: `Too many reset requests. Please try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).`
});
}
if (!isMailConfigured()) {
console.error("Forgot-password requested but SMTP is not configured.");
return res.json(genericResponse);
}
const user = await User.findOne({ email });
if (!user) {
return res.json(genericResponse);
}
// Invalidate any previous outstanding tokens for this user before issuing a new one.
await PasswordReset.updateMany({ user: user._id, used: false }, { used: true });
const rawToken = crypto.randomBytes(32).toString("hex");
const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
await PasswordReset.create({
user: user._id,
tokenHash,
expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000)
});
const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${PORT}`;
const resetUrl = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
try {
await sendPasswordResetEmail({
to: user.email,
name: user.name,
resetUrl,
expiryMinutes: RESET_TOKEN_EXPIRY_MINUTES
});
} catch (mailError) {
console.error("Failed to send password reset email:", mailError.message);
}
return res.json(genericResponse);
} catch (error) {
console.error("Forgot password error:", error);
return res.json(genericResponse);
}
});
app.post("/api/auth/reset-password", async (req, res) => {
try {
const token = String(req.body.token || "").trim();
const password = String(req.body.password || "");
if (!token || !password) {
return res.status(400).json({ success: false, message: "Token and new password are required" });
}
if (password.length < 8) {
return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
}
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
const resetRecord = await PasswordReset.findOne({
tokenHash,
used: false,
expiresAt: { $gt: new Date() }
});
if (!resetRecord) {
return res.status(400).json({ success: false, message: "This reset link is invalid or has expired" });
}
const user = await User.findById(resetRecord.user);
if (!user) {
return res.status(400).json({ success: false, message: "This reset link is invalid or has expired" });
}
user.password = await bcrypt.hash(password, 10);
await user.save();
// Invalidate this token and any other outstanding tokens for this user.
await PasswordReset.updateMany({ user: user._id, used: false }, { used: true });
return res.json({ success: true, message: "Password has been reset successfully. You can now log in." });
} catch (error) {
console.error("Reset password error:", error);
return res.status(500).json({ success: false, message: "Internal server error" });
}
});
app.get("/api/users/me", authenticateToken, async (req, res) => {
try {
const user = await User.findById(req.user.userId);
if (!user) {
return res.status(404).json({ success: false, message: "User not found" });
}
return res.json({ success: true, user: sanitizePublicUser(user) });
} catch (error) {
console.error("Get current user error:", error);
return res.status(500).json({ success: false, message: "Internal server error" });
}
});
// Lets any authenticated user discover the admin's contact info without
// needing to know their email - used to pin the admin's chat at the top of
// everyone's chat list, so a brand-new user can reach the admin for
// approval without first knowing who to search for.
app.get("/api/admin-contact", authenticateToken, async (req, res) => {
try {
const adminEmail = getAdminEmail();
if (!adminEmail) {
return res.json({ success: true, admin: null });
}
const admin = await User.findOne({ email: adminEmail }).select(
"_id name email role isOnline lastSeen lastSeenPrivacy"
);
if (!admin || admin.role !== "admin") {
return res.json({ success: true, admin: null });
}
return res.json({
success: true,
admin: {
id: admin._id,
name: admin.name,
email: admin.email,
...presenceSummary(admin)
}
});
} catch (error) {
console.error("Admin contact lookup error:", error);
return res.status(500).json({ success: false, message: "Unable to load admin contact" });
}
});
// ---------------- PROFILE MANAGEMENT ----------------
app.put("/api/users/me", authenticateToken, async (req, res) => {
try {
const user = await User.findById(req.user.userId);
if (!user) {
return res.status(404).json({ success: false, message: "User not found" });
}
const { name, phone, bio, lastSeenPrivacy, currentPassword, newPassword } = req.body;

if (name !== undefined) {
const trimmedName = String(name).trim();
if (!trimmedName) {
return res.status(400).json({ success: false, message: "Name cannot be empty" });
}
user.name = trimmedName;
}

if (phone !== undefined) {
const trimmedPhone = String(phone).trim();
if (!trimmedPhone) {
return res.status(400).json({ success: false, message: "Phone cannot be empty" });
}
if (trimmedPhone !== user.phone) {
const existingPhone = await User.findOne({ phone: trimmedPhone, _id: { $ne: user._id } }).select("_id");
if (existingPhone) {
return res.status(400).json({ success: false, message: "This phone number is already in use" });
}
user.phone = trimmedPhone;
}
}

if (bio !== undefined) {
const trimmedBio = String(bio).trim();
if (trimmedBio.length > 200) {
return res.status(400).json({ success: false, message: "Bio must be 200 characters or fewer" });
}
user.bio = trimmedBio;
}

if (lastSeenPrivacy !== undefined) {
if (!["everyone", "nobody"].includes(lastSeenPrivacy)) {
return res.status(400).json({ success: false, message: "lastSeenPrivacy must be 'everyone' or 'nobody'" });
}
user.lastSeenPrivacy = lastSeenPrivacy;
}

if (newPassword !== undefined) {
if (!currentPassword) {
return res.status(400).json({ success: false, message: "Current password is required to set a new password" });
}
const validPassword = await bcrypt.compare(currentPassword, user.password);
if (!validPassword) {
return res.status(401).json({ success: false, message: "Current password is incorrect" });
}
if (String(newPassword).length < 8) {
return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
}
user.password = await bcrypt.hash(newPassword, 10);
}

await user.save();
return res.json({ success: true, user: sanitizePublicUser(user) });
} catch (error) {
console.error("Update profile error:", error);
return res.status(500).json({ success: false, message: "Internal server error" });
}
});
app.put(
"/api/users/me/profile-photo",
authenticateToken,
uploadAvatar.single("photo"),
async (req, res) => {
try {
if (!req.file) {
return res.status(400).json({ success: false, message: "Profile photo file is required" });
}
const user = await User.findById(req.user.userId);
if (!user) {
return res.status(404).json({ success: false, message: "User not found" });
}
const media = await uploadMedia(req.file, "avatars");
user.profilePhoto = media.url;
await user.save();
return res.json({ success: true, user: sanitizePublicUser(user) });
} catch (error) {
console.error("Profile photo upload error:", error);
return res.status(500).json({
success: false,
message: error.message || "Unable to upload profile photo"
});
}
}
);
app.get("/api/users/exists", authenticateToken, async (req, res) => {
try {
const email = normalizeEmail(req.query.email);
if (!email) {
return res.status(400).json({
success: false,
message: "Email is required"
});
}
const user = await User.findOne({ email }).select("_id name email isOnline lastSeen lastSeenPrivacy");
if (!user) {
return res.status(404).json({
success: false,
message: "User not found"
});
}
return res.json({
success: true,
user: {
id: user._id,
name: user.name,
email: user.email,
...presenceSummary(user)
}
});
} catch (error) {
console.error("User validation error:", error);
return res.status(500).json({
success: false,
message: "Internal server error"
});
}
});
// ---------------- PERSONAL CHAT HISTORY ----------------
app.get("/api/personal-chats/recent", authenticateToken, async (req, res) => {
try {
const email = req.user.email;
const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const roomPattern = new RegExp(`(^${escaped}::|::${escaped}$)`);
const [activeRooms, archivedRooms] = await Promise.all([
Message.aggregate([
{ $match: { chatType: "personal", roomId: roomPattern } },
{ $group: { _id: "$roomId", lastMessageAt: { $max: "$createdAt" } } }
]),
ArchivedChat.aggregate([
{ $match: { chatType: "personal", roomId: roomPattern } },
{ $group: { _id: "$roomId", lastMessageAt: { $max: "$originalCreatedAt" } } }
])
]);
const latestByRoom = new Map();
[...activeRooms, ...archivedRooms].forEach((row) => {
const existing = latestByRoom.get(row._id);
if (!existing || new Date(row.lastMessageAt) > new Date(existing)) {
latestByRoom.set(row._id, row.lastMessageAt);
}
});
const entries = [...latestByRoom.entries()]
.map(([roomId, lastMessageAt]) => {
const otherEmail = roomId.split("::").find((part) => part !== email);
return otherEmail ? { roomId, otherEmail, lastMessageAt } : null;
})
.filter(Boolean)
.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
.slice(0, 20);
const roomIds = entries.map((entry) => entry.roomId);
const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
// Unread counts only scan the active Message collection, not ArchivedChat -
// a message old enough to have been archived (default 24h+) sitting unread
// is an edge case not worth the extra aggregation cost here.
const unreadAgg = roomIds.length
? await Message.aggregate([
{
$match: {
chatType: "personal",
roomId: { $in: roomIds },
sender: { $ne: userObjectId },
readBy: { $ne: userObjectId }
}
},
{ $group: { _id: "$roomId", count: { $sum: 1 } } }
])
: [];
const unreadByRoom = new Map(unreadAgg.map((row) => [row._id, row.count]));
const users = await User.find({
email: { $in: entries.map((entry) => entry.otherEmail) }
}).select("name email isOnline lastSeen lastSeenPrivacy");
const userByEmail = new Map(users.map((user) => [user.email, user]));
const recentChats = entries
.map((entry) => {
const user = userByEmail.get(entry.otherEmail);
if (!user) return null;
return {
roomId: entry.roomId,
lastMessageAt: entry.lastMessageAt,
unreadCount: unreadByRoom.get(entry.roomId) || 0,
user: { id: user._id, name: user.name, email: user.email, ...presenceSummary(user) }
};
})
.filter(Boolean);
return res.json({ success: true, recentChats });
} catch (error) {
console.error("Recent chats error:", error);
return res.status(500).json({
success: false,
message: "Unable to load recent chats"
});
}
});
// ---------------- MESSAGE HISTORY PAGINATION ----------------
// Initial 50 messages are already returned by the join_room socket event -
// this is for scrolling further up. Cursor-based, never offset-based, so it
// stays correct and fast no matter how much history a room accumulates.
app.get("/api/messages/:roomId", authenticateToken, async (req, res) => {
try {
const { roomId } = req.params;
if (!(await canAccessRoom(req.user, roomId))) {
return res.status(403).json({ success: false, message: "You are not allowed to view this room" });
}
const { messages, nextCursor, hasMore } = await loadRoomPage(roomId, {
limit: req.query.limit,
cursor: req.query.cursor
});
return res.json({ success: true, messages, nextCursor, hasMore });
} catch (error) {
console.error("Message pagination error:", error);
return res.status(500).json({ success: false, message: "Unable to load messages" });
}
});
// ---------------- GROUPS ----------------
function isGroupAdmin(group, userId) {
const id = String(userId);
return String(group.createdBy) === id || (group.admins || []).some((adminId) => String(adminId) === id);
}
// Group responses populate members with presence fields (isOnline/lastSeen/
// lastSeenPrivacy) so the group UI can show each member's status the same
// way personal chats do - this strips lastSeenPrivacy back out and applies
// it before the data ever leaves the server, same privacy rule as everywhere else.
function serializeGroupForResponse(group) {
const plain = typeof group.toJSON === "function" ? group.toJSON() : group;
return {
...plain,
members: (plain.members || []).map((member) => {
if (!member || typeof member !== "object" || !member.name) return member;
return {
_id: member._id,
name: member.name,
email: member.email,
...presenceSummary(member)
};
})
};
}
async function joinMembersToRoom(io, roomId, memberIds) {
await Promise.all(
memberIds.map((memberId) => io.in(`user:${memberId}`).socketsJoin(roomId))
);
}
async function leaveMemberFromRoom(io, roomId, memberId) {
await io.in(`user:${memberId}`).socketsLeave(roomId);
}
app.post("/api/groups", authenticateToken, async (req, res) => {
try {
const requester = await User.findById(req.user.userId);
if (!canJoinOrCreateGroup(requester)) {
return res.status(403).json({
success: false,
message: "Admin approval is required before you can create or join groups."
});
}
const { name, description = "", memberEmails = [] } = req.body;
if (!name || !String(name).trim()) {
return res.status(400).json({
success: false,
message: "Group name is required"
});
}
const normalizedEmails = [
req.user.email,
...memberEmails.map(normalizeEmail)
].filter(Boolean);
const uniqueEmails = [...new Set(normalizedEmails)];
const users = await User.find({
email: { $in: uniqueEmails }
}).select("_id email approvalStatus role trialMessageCount trialMessageLimit");
if (users.length !== uniqueEmails.length) {
const foundEmails = new Set(users.map((user) => user.email));
const missingEmails = uniqueEmails.filter((email) => !foundEmails.has(email));
return res.status(400).json({
success: false,
message: `These users do not exist: ${missingEmails.join(", ")}`
});
}
const ineligible = users.filter((user) => user.email !== req.user.email && !canJoinOrCreateGroup(user));
if (ineligible.length > 0) {
return res.status(400).json({
success: false,
message: `These users need admin approval before they can join a group: ${ineligible.map((u) => u.email).join(", ")}`
});
}
const memberIds = users.map((user) => user._id);
const group = new Group({
name: String(name).trim(),
description: String(description).trim().slice(0, 300),
roomId: `group:${new mongoose.Types.ObjectId().toString()}`,
createdBy: req.user.userId,
admins: [req.user.userId],
members: memberIds
});
await group.save();
await group.populate("members", "name email isOnline lastSeen lastSeenPrivacy");
await group.populate("admins", "name email");
await joinMembersToRoom(io, group.roomId, memberIds.map(String));
return res.status(201).json({
success: true,
group: serializeGroupForResponse(group)
});
} catch (error) {
console.error("Create group error:", error);
return res.status(500).json({
success: false,
message: "Unable to create group"
});
}
});
app.get("/api/groups", authenticateToken, async (req, res) => {
try {
const groups = await Group.find({
members: req.user.userId
})
.populate("members", "name email isOnline lastSeen lastSeenPrivacy")
.populate("admins", "name email")
.sort({ updatedAt: -1, createdAt: -1 });
const roomIds = groups.map((group) => group.roomId);
const userObjectId = new mongoose.Types.ObjectId(req.user.userId);
const unreadAgg = roomIds.length
? await Message.aggregate([
{
$match: {
chatType: "group",
roomId: { $in: roomIds },
sender: { $ne: userObjectId },
readBy: { $ne: userObjectId }
}
},
{ $group: { _id: "$roomId", count: { $sum: 1 } } }
])
: [];
const unreadByRoom = new Map(unreadAgg.map((row) => [row._id, row.count]));
const groupsWithUnread = groups.map((group) => ({
...serializeGroupForResponse(group),
unreadCount: unreadByRoom.get(group.roomId) || 0
}));
return res.json({
success: true,
groups: groupsWithUnread
});
} catch (error) {
console.error("Get groups error:", error);
return res.status(500).json({
success: false,
message: "Unable to load groups"
});
}
});
app.get("/api/groups/:groupId", authenticateToken, async (req, res) => {
try {
const group = await Group.findOne({ _id: req.params.groupId, members: req.user.userId })
.populate("members", "name email isOnline lastSeen lastSeenPrivacy")
.populate("admins", "name email");
if (!group) {
return res.status(404).json({ success: false, message: "Group not found" });
}
return res.json({ success: true, group: serializeGroupForResponse(group) });
} catch (error) {
console.error("Get group error:", error);
return res.status(500).json({ success: false, message: "Unable to load group" });
}
});
app.put("/api/groups/:groupId", authenticateToken, async (req, res) => {
try {
const group = await Group.findOne({ _id: req.params.groupId, members: req.user.userId });
if (!group) return res.status(404).json({ success: false, message: "Group not found" });
if (!isGroupAdmin(group, req.user.userId)) {
return res.status(403).json({ success: false, message: "Only group admins can change group settings" });
}
const { name, description } = req.body;
if (name !== undefined) {
if (!String(name).trim()) return res.status(400).json({ success: false, message: "Group name cannot be empty" });
group.name = String(name).trim();
}
if (description !== undefined) {
group.description = String(description).trim().slice(0, 300);
}
await group.save();
await group.populate("members", "name email isOnline lastSeen lastSeenPrivacy");
await group.populate("admins", "name email");
io.to(group.roomId).emit("group_updated", { groupId: group._id, group: serializeGroupForResponse(group) });
return res.json({ success: true, group: serializeGroupForResponse(group) });
} catch (error) {
console.error("Update group error:", error);
return res.status(500).json({ success: false, message: "Unable to update group" });
}
});
app.put(
"/api/groups/:groupId/image",
authenticateToken,
uploadAvatar.single("image"),
async (req, res) => {
try {
if (!req.file) return res.status(400).json({ success: false, message: "Group image file is required" });
const group = await Group.findOne({ _id: req.params.groupId, members: req.user.userId });
if (!group) return res.status(404).json({ success: false, message: "Group not found" });
if (!isGroupAdmin(group, req.user.userId)) {
return res.status(403).json({ success: false, message: "Only group admins can change the group image" });
}
const media = await uploadMedia(req.file, "group-images");
group.image = media.url;
await group.save();
await group.populate("members", "name email isOnline lastSeen lastSeenPrivacy");
await group.populate("admins", "name email");
io.to(group.roomId).emit("group_updated", { groupId: group._id, group: serializeGroupForResponse(group) });
return res.json({ success: true, group: serializeGroupForResponse(group) });
} catch (error) {
console.error("Group image upload error:", error);
return res.status(500).json({ success: false, message: error.message || "Unable to upload group image" });
}
}
);
app.post("/api/groups/:groupId/members", authenticateToken, async (req, res) => {
try {
const group = await Group.findOne({ _id: req.params.groupId, members: req.user.userId });
if (!group) return res.status(404).json({ success: false, message: "Group not found" });
if (!isGroupAdmin(group, req.user.userId)) {
return res.status(403).json({ success: false, message: "Only group admins can add members" });
}
const memberEmails = Array.isArray(req.body.memberEmails) ? req.body.memberEmails.map(normalizeEmail).filter(Boolean) : [];
if (memberEmails.length === 0) {
return res.status(400).json({ success: false, message: "memberEmails is required" });
}
const users = await User.find({ email: { $in: memberEmails } })
.select("_id email approvalStatus role trialMessageCount trialMessageLimit");
if (users.length !== memberEmails.length) {
const found = new Set(users.map((u) => u.email));
const missing = memberEmails.filter((email) => !found.has(email));
return res.status(400).json({ success: false, message: `These users do not exist: ${missing.join(", ")}` });
}
const ineligible = users.filter((user) => !canJoinOrCreateGroup(user));
if (ineligible.length > 0) {
return res.status(400).json({
success: false,
message: `These users need admin approval before they can join a group: ${ineligible.map((u) => u.email).join(", ")}`
});
}
const existingIds = new Set(group.members.map(String));
const newIds = users.map((u) => u._id).filter((id) => !existingIds.has(String(id)));
if (newIds.length === 0) {
return res.status(400).json({ success: false, message: "These users are already members of this group" });
}
group.members.push(...newIds);
await group.save();
await group.populate("members", "name email isOnline lastSeen lastSeenPrivacy");
await group.populate("admins", "name email");
await joinMembersToRoom(io, group.roomId, newIds.map(String));
io.to(group.roomId).emit("group_updated", { groupId: group._id, group: serializeGroupForResponse(group) });
return res.json({ success: true, group: serializeGroupForResponse(group) });
} catch (error) {
console.error("Add group members error:", error);
return res.status(500).json({ success: false, message: "Unable to add members" });
}
});
app.delete("/api/groups/:groupId/members/:userId", authenticateToken, async (req, res) => {
try {
const group = await Group.findOne({ _id: req.params.groupId, members: req.user.userId });
if (!group) return res.status(404).json({ success: false, message: "Group not found" });
if (!isGroupAdmin(group, req.user.userId)) {
return res.status(403).json({ success: false, message: "Only group admins can remove members" });
}
const targetId = req.params.userId;
if (String(group.createdBy) === String(targetId)) {
return res.status(400).json({ success: false, message: "The group creator cannot be removed" });
}
if (!group.members.some((id) => String(id) === String(targetId))) {
return res.status(400).json({ success: false, message: "This user is not a member of this group" });
}
group.members = group.members.filter((id) => String(id) !== String(targetId));
group.admins = group.admins.filter((id) => String(id) !== String(targetId));
await group.save();
await group.populate("members", "name email isOnline lastSeen lastSeenPrivacy");
await group.populate("admins", "name email");
await leaveMemberFromRoom(io, group.roomId, targetId);
io.to(group.roomId).emit("group_updated", { groupId: group._id, group: serializeGroupForResponse(group) });
return res.json({ success: true, group: serializeGroupForResponse(group) });
} catch (error) {
console.error("Remove group member error:", error);
return res.status(500).json({ success: false, message: "Unable to remove member" });
}
});
app.post("/api/groups/:groupId/leave", authenticateToken, async (req, res) => {
try {
const group = await Group.findOne({ _id: req.params.groupId, members: req.user.userId });
if (!group) return res.status(404).json({ success: false, message: "Group not found" });
const userId = req.user.userId;
const remainingMembers = group.members.filter((id) => String(id) !== String(userId));
const remainingAdmins = group.admins.filter((id) => String(id) !== String(userId));
const wasAdmin = isGroupAdmin(group, userId);
if (wasAdmin && remainingAdmins.length === 0 && remainingMembers.length > 0) {
return res.status(400).json({
success: false,
message: "Promote another member to admin before leaving this group"
});
}
group.members = remainingMembers;
group.admins = remainingAdmins;
await group.save();
await leaveMemberFromRoom(io, group.roomId, userId);
if (group.members.length > 0) {
await group.populate("members", "name email isOnline lastSeen lastSeenPrivacy");
await group.populate("admins", "name email");
io.to(group.roomId).emit("group_updated", { groupId: group._id, group: serializeGroupForResponse(group) });
}
return res.json({ success: true, message: "You have left the group" });
} catch (error) {
console.error("Leave group error:", error);
return res.status(500).json({ success: false, message: "Unable to leave group" });
}
});
async function setGroupAdminStatus(req, res, makeAdmin) {
try {
const group = await Group.findOne({ _id: req.params.groupId, members: req.user.userId });
if (!group) return res.status(404).json({ success: false, message: "Group not found" });
if (!isGroupAdmin(group, req.user.userId)) {
return res.status(403).json({ success: false, message: "Only group admins can manage other admins" });
}
const targetId = req.params.userId;
if (!group.members.some((id) => String(id) === String(targetId))) {
return res.status(400).json({ success: false, message: "This user is not a member of this group" });
}
if (String(group.createdBy) === String(targetId) && !makeAdmin) {
return res.status(400).json({ success: false, message: "The group creator cannot be demoted" });
}
const currentAdminIds = new Set(group.admins.map(String));
if (makeAdmin) {
currentAdminIds.add(String(targetId));
} else {
currentAdminIds.delete(String(targetId));
}
group.admins = [...currentAdminIds];
await group.save();
await group.populate("members", "name email isOnline lastSeen lastSeenPrivacy");
await group.populate("admins", "name email");
io.to(group.roomId).emit("group_updated", { groupId: group._id, group: serializeGroupForResponse(group) });
return res.json({ success: true, group: serializeGroupForResponse(group) });
} catch (error) {
console.error("Update group admin error:", error);
return res.status(500).json({ success: false, message: "Unable to update group admins" });
}
}
app.put("/api/groups/:groupId/admins/:userId/promote", authenticateToken, (req, res) => setGroupAdminStatus(req, res, true));
app.put("/api/groups/:groupId/admins/:userId/demote", authenticateToken, (req, res) => setGroupAdminStatus(req, res, false));

// ---------------- ADMIN ----------------
app.get("/api/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
try {
const [totalUsers, pendingUsers, approvedUsers, totalGroups, totalMessages, archivedMessages] = await Promise.all([
User.countDocuments({}),
User.countDocuments({ approvalStatus: "pending" }),
User.countDocuments({ approvalStatus: "approved" }),
Group.countDocuments({}),
Message.countDocuments({}),
ArchivedChat.countDocuments({})
]);
const trialExhaustedUsers = await User.countDocuments({
approvalStatus: "pending",
$expr: { $gte: ["$trialMessageCount", "$trialMessageLimit"] }
});
return res.json({
success: true,
stats: {
totalUsers,
pendingUsers,
approvedUsers,
trialExhaustedUsers,
totalGroups,
totalMessages,
archivedMessages
}
});
} catch (error) {
console.error("Admin stats error:", error);
return res.status(500).json({ success: false, message: "Unable to load stats" });
}
});
app.get("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
try {
const search = String(req.query.search || "").trim();
const filter = search
? {
$or: [
{ name: new RegExp(search, "i") },
{ email: new RegExp(search, "i") },
{ phone: new RegExp(search, "i") }
]
}
: {};
const users = await User.find(filter).select("-password").sort({ createdAt: -1 }).limit(200);
return res.json({ success: true, users });
} catch (error) {
console.error("Admin list users error:", error);
return res.status(500).json({ success: false, message: "Unable to load users" });
}
});
app.get("/api/admin/users/pending", authenticateToken, requireAdmin, async (req, res) => {
try {
const users = await User.find({ approvalStatus: "pending" })
.select("-password")
.sort({ createdAt: -1 });
return res.json({ success: true, users });
} catch (error) {
console.error("Admin pending users error:", error);
return res.status(500).json({ success: false, message: "Unable to load pending users" });
}
});
async function setApprovalStatus(req, res, newStatus, successMessage) {
try {
const user = await User.findById(req.params.userId);
if (!user) {
return res.status(404).json({ success: false, message: "User not found" });
}
if (user.role === "admin") {
return res.status(400).json({ success: false, message: "Cannot change the approval status of an admin account" });
}
user.approvalStatus = newStatus;
await user.save();
io.to(`user:${user._id}`).emit("approval_updated", {
approvalStatus: user.approvalStatus,
trial: trialSummary(user),
message: successMessage
});
return res.json({ success: true, user: sanitizePublicUser(user) });
} catch (error) {
console.error("Admin approval update error:", error);
return res.status(500).json({ success: false, message: "Unable to update user" });
}
}
app.put("/api/admin/users/:userId/approve", authenticateToken, requireAdmin, (req, res) =>
setApprovalStatus(req, res, "approved", "Your account has been approved. You can now message and use all features without limits.")
);
app.put("/api/admin/users/:userId/suspend", authenticateToken, requireAdmin, (req, res) =>
setApprovalStatus(req, res, "suspended", "Your account has been suspended. Please contact the administrator.")
);
app.put("/api/admin/users/:userId/reject", authenticateToken, requireAdmin, (req, res) =>
setApprovalStatus(req, res, "rejected", "Your account request has been rejected. Please contact the administrator.")
);
app.put("/api/admin/users/:userId/revoke-approval", authenticateToken, requireAdmin, (req, res) =>
setApprovalStatus(req, res, "pending", "Your approval has been revoked and your account is back on the free trial.")
);
// ---------------- MEDIA UPLOAD (AWS S3 + SOCKET.IO) ----------------
// The client uses this endpoint only for a user-facing upload limit. The
// server-side multer limit remains the source of truth.
app.get("/api/media/config", authenticateToken, (req, res) => {
res.json({
success: true,
maxFileSize: MAX_FILE_SIZE,
maxFiles: 10
});
});
app.post("/api/media/upload", authenticateToken, upload.single("media"), async (req, res) => {
try {
const roomId = String(req.body.roomId || "").trim();
const chatType = String(req.body.chatType || "").trim();
const groupId = String(req.body.groupId || "").trim() || null;
const caption = String(req.body.caption || "").trim();
if (!req.file) {
return res.status(400).json({ success: false, message: "Media file is required" });
}
if (!roomId || !chatType) {
return res.status(400).json({ success: false, message: "roomId and chatType are required" });
}
if (caption.length > 2000) {
return res.status(400).json({ success: false, message: "Caption is too long" });
}
let otherEmail = null;
if (chatType === "personal") {
const parts = roomId.split("::").map(normalizeEmail).filter(Boolean);
if (parts.length !== 2 || !parts.includes(req.user.email)) {
return res.status(403).json({ success: false, message: "You are not allowed to upload to this personal room" });
}
const [firstUser, secondUser] = parts;
if (createPersonalRoomId(firstUser, secondUser) !== roomId) {
return res.status(400).json({ success: false, message: "Invalid personal room ID" });
}
const users = await User.countDocuments({ email: { $in: parts } });
if (users !== 2) {
return res.status(400).json({ success: false, message: "Both users must exist before media can be shared" });
}
otherEmail = parts.find((part) => part !== req.user.email) || null;
} else if (chatType === "group") {
if (!groupId) {
return res.status(400).json({ success: false, message: "groupId is required for a group upload" });
}
const group = await Group.findOne({
_id: groupId,
roomId,
members: req.user.userId
}).select("_id");
if (!group) {
return res.status(403).json({ success: false, message: "You are not allowed to upload to this group" });
}
} else {
return res.status(400).json({ success: false, message: "Invalid chat type" });
}
// Approval/trial enforcement - media counts as a trial message just like text.
const sender = await User.findById(req.user.userId);
const permission = canSendMessage(sender, { chatType, otherEmail });
if (!permission.allowed) {
return res.status(403).json({
success: false,
restricted: true,
message: permission.reason,
trial: trialSummary(sender)
});
}
const media = await uploadMedia(req.file);
const message = await Message.create({
chatType,
roomId,
groupId: groupId || null,
sender: req.user.userId,
text: caption,
media
});
await message.populate("sender", "name email");
// The HTTP upload finishes first. Then Socket.IO delivers the media message
// only to the relevant personal/group room.
io.to(roomId).emit("new_message", message);
await consumeTrialMessageIfNeeded(sender);
const trial = trialSummary(sender);
io.to(`user:${sender._id}`).emit("trial_update", trial);
return res.status(201).json({ success: true, message, trial });
} catch (error) {
console.error("Media upload error:", error);
return res.status(500).json({
success: false,
message: error.message || "Unable to upload media"
});
}
});
// Convert upload middleware errors into predictable JSON for the frontend.
app.use((error, req, res, next) => {
if (!error) return next();
if (error instanceof multer.MulterError) {
if (error.code === "LIMIT_FILE_SIZE") {
return res.status(413).json({
success: false,
message: "The uploaded file exceeds the maximum allowed size"
});
}
if (error.code === "LIMIT_FILE_COUNT") {
return res.status(400).json({ success: false, message: "Too many files selected" });
}
return res.status(400).json({ success: false, message: error.message });
}
if (error.message === "This file type is not supported" || error.message === "Profile photo must be an image") {
return res.status(415).json({ success: false, message: error.message });
}
console.error("Unhandled request error:", error);
return res.status(500).json({ success: false, message: "Internal server error" });
});
// ---------------- NEXT.JS PAGE RENDERING ----------------
// Anything that isn't one of the API routes above (every page route, static
// assets, client-side navigation, etc.) is handed off to Next.js.
app.all("*", (req, res) => handleNextRequest(req, res));
// ---------------- SOCKET AUTH ----------------
io.use((socket, next) => {
try {
const token = socket.handshake.auth?.token;
if (!token) {
return next(new Error("Authentication token is required"));
}
const decoded = jwt.verify(token, process.env.JWT_SECRET);
socket.data.user = {
userId: decoded.userId,
email: decoded.email
};
next();
} catch (error) {
next(new Error("Invalid or expired token"));
}
});
io.on("connection", async (socket) => {
console.log(`Authenticated socket connected: ${socket.id} | ${socket.data.user.email}`);
// A private per-user room lets the backend push approval/trial updates to
// every tab/device this user has open, without needing to know socket IDs.
socket.join(`user:${socket.data.user.userId}`);
let trial = null;
try {
const user = await User.findById(socket.data.user.userId);
if (user) trial = trialSummary(user);
} catch (error) {
console.error("Unable to load trial status on connect:", error.message);
}
socket.emit("socket_authenticated", {
success: true,
user: socket.data.user,
trial
});
await registerPresenceHandlers(io, socket);
registerChatHandlers(io, socket);
registerReceiptHandlers(io, socket);
});
nextApp.prepare().then(() => {
mongoose
.connect(process.env.MONGODB_URI)
.then(() => {
console.log("MongoDB connected successfully");
startArchiveJob();
})
.catch((error) => console.error("MongoDB connection error:", error.message));

httpServer.listen(PORT, "0.0.0.0", () => {
console.log(`Server running on port ${PORT} (Next.js + API + Socket.IO, single process)`);
});
}).catch((error) => {
console.error("Failed to prepare Next.js app:", error);
process.exit(1);
});

