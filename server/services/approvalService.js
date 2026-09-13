/**
 * Central place for approval / trial-quota rules (Exercise 19+).
 *
 * Business rules implemented here (see project spec sections 8-11):
 * - A brand new signup becomes role="admin"/approvalStatus="approved" only if
 *   their email matches ADMIN_EMAIL. Everyone else starts role="user",
 *   approvalStatus="pending", trialMessageCount=0.
 * - A pending user may send FREE_MESSAGE_LIMIT (default 10) total messages
 *   (personal + group + media, combined) before being restricted.
 * - A restricted pending/rejected/suspended user may still open a personal
 *   chat with the configured admin and send messages there with no limit.
 * - Group chats never get the admin exception: once restricted, no group
 *   messages, no new group creation/joining.
 * - Approved users and admins are always unlimited.
 */

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getAdminEmail() {
  return normalizeEmail(process.env.ADMIN_EMAIL);
}

function isAdminEmail(email) {
  const adminEmail = getAdminEmail();
  return Boolean(adminEmail) && normalizeEmail(email) === adminEmail;
}

function getTrialLimit() {
  const limit = Number(process.env.FREE_MESSAGE_LIMIT);
  return Number.isFinite(limit) && limit > 0 ? limit : 10;
}

// Role/approval status to assign at signup time.
function resolveSignupStatus(email) {
  if (isAdminEmail(email)) {
    return { role: "admin", approvalStatus: "approved" };
  }
  return { role: "user", approvalStatus: "pending" };
}

function isUnlimited(user) {
  return Boolean(user) && (user.role === "admin" || user.approvalStatus === "approved");
}

function remainingTrialMessages(user) {
  if (!user) return 0;
  if (isUnlimited(user)) return null;
  return Math.max(0, (user.trialMessageLimit || 0) - (user.trialMessageCount || 0));
}

// Can `user` send a message/media into a room? For personal chats, pass
// otherEmail so the admin-contact exception can be evaluated.
function canSendMessage(user, { chatType, otherEmail } = {}) {
  if (!user) return { allowed: false, reason: "User not found" };
  if (isUnlimited(user)) return { allowed: true };

  const adminException = chatType === "personal" && isAdminEmail(otherEmail);

  if (user.approvalStatus === "rejected" || user.approvalStatus === "suspended") {
    if (adminException) return { allowed: true };
    return {
      allowed: false,
      reason: "Your account access is currently restricted. Please contact the administrator."
    };
  }

  // pending
  if (adminException) return { allowed: true };

  if (user.trialMessageCount >= user.trialMessageLimit) {
    return {
      allowed: false,
      reason: "Your free message limit has been reached. Admin approval is required to continue messaging."
    };
  }

  return { allowed: true };
}

function canUseAi(user) {
  if (!user) return false;
  if (isUnlimited(user)) return true;
  if (user.approvalStatus !== "pending") return false;
  return user.trialMessageCount < user.trialMessageLimit;
}

function canJoinOrCreateGroup(user) {
  return isUnlimited(user);
}

// Increments trial usage for pending users only. Approved/admin sends are
// unlimited and never consume quota; rejected/suspended never had quota to
// begin with (their only permitted path is the admin exception).
async function consumeTrialMessageIfNeeded(user) {
  if (isUnlimited(user)) return user;
  if (user.approvalStatus !== "pending") return user;
  user.trialMessageCount += 1;
  await user.save();
  return user;
}

function trialSummary(user) {
  if (!user) return null;
  return {
    role: user.role,
    approvalStatus: user.approvalStatus,
    trialMessageCount: user.trialMessageCount,
    trialMessageLimit: user.trialMessageLimit,
    remaining: remainingTrialMessages(user)
  };
}

// If ADMIN_EMAIL was set (or changed) after this account already existed,
// role/approvalStatus can drift out of sync with it - this re-derives both
// from the current env var and fixes the stored record whenever it's out of
// sync, so admin access self-heals without a manual migration step.
async function ensureAdminRoleSynced(user) {
  if (!user) return user;
  if (isAdminEmail(user.email) && (user.role !== "admin" || user.approvalStatus !== "approved")) {
    user.role = "admin";
    user.approvalStatus = "approved";
    await user.save();
  }
  return user;
}

function sanitizePublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profilePhoto: user.profilePhoto,
    bio: user.bio,
    lastSeenPrivacy: user.lastSeenPrivacy,
    role: user.role,
    approvalStatus: user.approvalStatus,
    trialMessageCount: user.trialMessageCount,
    trialMessageLimit: user.trialMessageLimit,
    createdAt: user.createdAt
  };
}

module.exports = {
  normalizeEmail,
  isAdminEmail,
  getAdminEmail,
  getTrialLimit,
  resolveSignupStatus,
  isUnlimited,
  remainingTrialMessages,
  canSendMessage,
  canUseAi,
  canJoinOrCreateGroup,
  consumeTrialMessageIfNeeded,
  ensureAdminRoleSynced,
  trialSummary,
  sanitizePublicUser
};
