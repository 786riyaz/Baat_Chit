const Message = require("../models/Message");
const Group = require("../models/Group");
const User = require("../models/User");
const { normalizeEmail } = require("../utils/room");

function personalRoomPattern(email) {
  const normalized = normalizeEmail(email);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^${escaped}::|::${escaped}$)`);
}

async function getPersonalRoomIds(email) {
  return Message.distinct("roomId", { chatType: "personal", roomId: personalRoomPattern(email) });
}

async function getGroupsForUser(userId) {
  return Group.find({ members: userId }).select("roomId members");
}

// Every room ID (personal + group) this user already has history/membership
// in. Used to auto-join their socket to all of them on connect, so incoming
// messages/receipts for ANY conversation reach them live - not just whichever
// single room the UI currently has open.
async function getAllRoomIdsForUser(userId, email) {
  const [personalRoomIds, groups] = await Promise.all([
    getPersonalRoomIds(email),
    getGroupsForUser(userId)
  ]);
  const groupRoomIds = groups.map((group) => group.roomId);
  return [...new Set([...personalRoomIds, ...groupRoomIds])];
}

// Everyone this user has personal chat history with, plus everyone who
// shares a group with them. Used to scope presence broadcasts so status
// changes only reach people this user actually talks to.
async function getContactUserIds(userId, email) {
  const normalizedEmail = normalizeEmail(email);
  const [personalRoomIds, groups] = await Promise.all([
    getPersonalRoomIds(email),
    getGroupsForUser(userId)
  ]);

  const partnerEmails = personalRoomIds
    .map((roomId) => roomId.split("::").find((part) => part !== normalizedEmail))
    .filter(Boolean);

  const partnerUsers = partnerEmails.length
    ? await User.find({ email: { $in: partnerEmails } }).select("_id")
    : [];

  const groupMemberIds = groups.flatMap((group) => group.members.map((id) => id.toString()));

  const ids = new Set([
    ...partnerUsers.map((user) => user._id.toString()),
    ...groupMemberIds
  ]);
  ids.delete(String(userId));
  return [...ids];
}

// What's safe to reveal about this user's presence, respecting lastSeenPrivacy.
function presenceSummary(user) {
  if (!user) return { isOnline: undefined, lastSeen: undefined };
  if (user.lastSeenPrivacy === "nobody") {
    return { isOnline: undefined, lastSeen: undefined };
  }
  return { isOnline: user.isOnline, lastSeen: user.lastSeen };
}

module.exports = { getAllRoomIdsForUser, getContactUserIds, presenceSummary };
