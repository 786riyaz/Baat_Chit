const User = require("../models/User");
const Group = require("../models/Group");
const { normalizeEmail, createPersonalRoomId } = require("../utils/room");

// Can this authenticated user (req.user shape: {userId, email}) read roomId?
async function canAccessRoom(user, roomId) {
  if (!roomId) return false;
  if (roomId.startsWith("group:")) {
    const group = await Group.exists({ roomId, members: user.userId });
    return Boolean(group);
  }
  const parts = roomId.split("::").map(normalizeEmail).filter(Boolean);
  if (parts.length !== 2 || !parts.includes(normalizeEmail(user.email))) return false;
  if (createPersonalRoomId(parts[0], parts[1]) !== roomId) return false;
  const count = await User.countDocuments({ email: { $in: parts } });
  return count === 2;
}

module.exports = { canAccessRoom };
