const Message = require("../../models/Message");

// Called right after a message is created and broadcast. Anyone already
// connected AND joined to this room (see presence.js auto-join) receives it
// immediately, so we can mark delivery the instant we know who that is -
// this matches the spec's definition of "delivered" exactly: reached the
// recipient's connected client, independent of whether they're viewing it.
async function markDelivered(io, message) {
  try {
    const roomSockets = io.sockets.adapter.rooms.get(message.roomId);
    if (!roomSockets || roomSockets.size === 0) return;

    const senderId = String(message.sender._id || message.sender);
    const recipientIds = new Set();
    roomSockets.forEach((socketId) => {
      const targetSocket = io.sockets.sockets.get(socketId);
      const userId = targetSocket?.data?.user?.userId;
      if (userId && String(userId) !== senderId) recipientIds.add(String(userId));
    });
    if (recipientIds.size === 0) return;

    const alreadyDelivered = new Set((message.deliveredTo || []).map(String));
    const toAdd = [...recipientIds].filter((id) => !alreadyDelivered.has(id));
    if (toAdd.length === 0) return;

    message.deliveredTo = [...(message.deliveredTo || []), ...toAdd];
    await message.save();

    io.to(message.roomId).emit("message_status_update", {
      messageId: message._id,
      roomId: message.roomId,
      status: message.status,
      deliveredTo: message.deliveredTo
    });
  } catch (error) {
    console.error("markDelivered error:", error.message);
  }
}

// Marks every not-yet-read message in a room (sent by someone else) as read
// by this user. Called both explicitly (mark_read event) and automatically
// whenever a user successfully joins/opens a room.
async function markRoomRead(io, roomId, userId) {
  const unread = await Message.find({
    roomId,
    sender: { $ne: userId },
    readBy: { $ne: userId }
  }).select("_id");
  if (unread.length === 0) return { updated: 0 };

  const ids = unread.map((message) => message._id);
  await Message.updateMany(
    { _id: { $in: ids } },
    { $addToSet: { readBy: userId, deliveredTo: userId } }
  );
  io.to(roomId).emit("messages_read", { roomId, readerId: userId, messageIds: ids });
  return { updated: ids.length };
}

function registerReceiptHandlers(io, socket) {
  socket.on("mark_read", async (payload = {}, callback) => {
    try {
      const { roomId } = payload;
      if (!roomId) return callback?.({ success: false, message: "roomId is required" });
      const result = await markRoomRead(io, roomId, socket.data.user.userId);
      callback?.({ success: true, updated: result.updated });
    } catch (error) {
      console.error("mark_read error:", error.message);
      callback?.({ success: false, message: "Unable to mark messages as read" });
    }
  });
}

module.exports = { registerReceiptHandlers, markDelivered, markRoomRead };
