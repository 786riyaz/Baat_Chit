const User = require("../../models/User");
const { getAllRoomIdsForUser, getContactUserIds, presenceSummary } = require("../../services/presenceService");

async function registerPresenceHandlers(io, socket) {
  const { userId, email } = socket.data.user;

  // Join every room this user already belongs to (not just whichever one
  // the UI currently has open) so messages/receipts for background
  // conversations still reach this connection in real time.
  try {
    const roomIds = await getAllRoomIdsForUser(userId, email);
    roomIds.forEach((roomId) => socket.join(roomId));
  } catch (error) {
    console.error("Unable to join existing rooms on connect:", error.message);
  }

  try {
    const user = await User.findByIdAndUpdate(userId, { isOnline: true }, { new: true });
    if (user) {
      const contactIds = await getContactUserIds(userId, email);
      const payload = { userId, email, ...presenceSummary(user) };
      contactIds.forEach((contactId) => io.to(`user:${contactId}`).emit("user_presence", payload));
    }
  } catch (error) {
    console.error("Unable to set online presence:", error.message);
  }

  socket.on("disconnect", async () => {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { isOnline: false, lastSeen: new Date() },
        { new: true }
      );
      if (!user) return;
      const contactIds = await getContactUserIds(userId, email);
      const payload = { userId, email, ...presenceSummary(user) };
      contactIds.forEach((contactId) => io.to(`user:${contactId}`).emit("user_presence", payload));
    } catch (error) {
      console.error("Unable to update presence on disconnect:", error.message);
    }
  });
}

module.exports = registerPresenceHandlers;
