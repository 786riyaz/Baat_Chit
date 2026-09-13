const User = require("../../models/User");
const Group = require("../../models/Group");
const Message = require("../../models/Message");
const { normalizeEmail, createPersonalRoomId } = require("../../utils/room");
const { loadRoomPage } = require("../../services/messageHistoryService");
const { markDelivered, markRoomRead } = require("./receipts");
const {
  canSendMessage,
  consumeTrialMessageIfNeeded,
  trialSummary
} = require("../../services/approvalService");

function respond(callback, payload) {
  if (typeof callback === "function") {
    callback(payload);
  }
}

// For a personal room "a@x.com::b@x.com", return the participant that is not `email`.
function getOtherEmailFromRoom(roomId, email) {
  if (!roomId || roomId.startsWith("group:")) return null;
  const parts = roomId.split("::");
  return parts.find((part) => part !== email) || null;
}

function registerChatHandlers(io, socket) {
  socket.on("join_room", async (payload = {}, callback) => {
    try {
      const { roomId, chatType, groupId } = payload;
      const userEmail = socket.data.user.email;
      if (!roomId || !chatType) {
        return respond(callback, {
          success: false,
          message: "roomId and chatType are required"
        });
      }
      let validatedRoomId = roomId;
      let otherUserId = null;
      if (chatType === "personal") {
        const otherEmail = normalizeEmail(payload.otherEmail);
        if (!otherEmail) {
          return respond(callback, {
            success: false,
            message: "Other user's email is required"
          });
        }
        const otherUser = await User.findOne({ email: otherEmail }).select("_id name email");
        if (!otherUser) {
          return respond(callback, {
            success: false,
            message: "This email does not belong to an existing user"
          });
        }
        validatedRoomId = createPersonalRoomId(userEmail, otherUser.email);
        if (validatedRoomId !== roomId) {
          return respond(callback, {
            success: false,
            message: "Invalid personal room ID"
          });
        }
        otherUserId = otherUser._id.toString();
      }
      if (chatType === "group") {
        if (!groupId) {
          return respond(callback, {
            success: false,
            message: "groupId is required for a group chat"
          });
        }
        // Viewing a group you're already a member of is always allowed, even
        // for a restricted/trial-exhausted user - only SENDING is gated.
        const group = await Group.findOne({
          _id: groupId,
          roomId,
          members: socket.data.user.userId
        }).select("_id name roomId");
        if (!group) {
          return respond(callback, {
            success: false,
            message: "You are not allowed to join this group"
          });
        }
        validatedRoomId = group.roomId;
      }
      const previousRoom = socket.data.currentRoom;
      if (previousRoom && previousRoom !== validatedRoomId) {
        socket.leave(previousRoom);
      }
      socket.join(validatedRoomId);
      socket.data.currentRoom = validatedRoomId;
      socket.data.currentChatType = chatType;
      socket.data.currentGroupId = groupId || null;
      socket.data.currentOtherUserId = otherUserId;

      // Initial page: latest 50 messages. Scrolling up loads older pages via
      // GET /api/messages/:roomId?cursor=... (same helper, same ordering rules).
      const { messages, nextCursor, hasMore } = await loadRoomPage(validatedRoomId, { limit: 50 });

      // Opening a room means the user has now seen everything in it.
      markRoomRead(io, validatedRoomId, socket.data.user.userId).catch((error) => {
        console.error("markRoomRead on join error:", error.message);
      });

      respond(callback, {
        success: true,
        roomId: validatedRoomId,
        previousRoom: previousRoom || null,
        messages,
        nextCursor,
        hasMore
      });
    } catch (error) {
      console.error("join_room error:", error);
      respond(callback, {
        success: false,
        message: error.message || "Unable to join room"
      });
    }
  });

  socket.on("leave_room", (payload = {}, callback) => {
    const roomId = payload.roomId;
    if (!roomId) {
      return respond(callback, {
        success: false,
        message: "roomId is required"
      });
    }
    socket.leave(roomId);
    if (socket.data.currentRoom === roomId) {
      socket.data.currentRoom = null;
      socket.data.currentChatType = null;
      socket.data.currentGroupId = null;
      socket.data.currentOtherUserId = null;
    }
    respond(callback, {
      success: true,
      roomId
    });
  });

  socket.on("send_message", async (payload = {}, callback) => {
    try {
      const text = String(payload.text || "").trim();
      const roomId = socket.data.currentRoom;
      const chatType = socket.data.currentChatType;
      const groupId = socket.data.currentGroupId;
      const otherUserId = socket.data.currentOtherUserId;
      if (!roomId || !chatType) {
        return respond(callback, {
          success: false,
          message: "Join a chat room before sending a message"
        });
      }
      if (!text) {
        return respond(callback, {
          success: false,
          message: "Message cannot be empty"
        });
      }
      if (text.length > 2000) {
        return respond(callback, {
          success: false,
          message: "Message is too long"
        });
      }

      // Approval/trial enforcement - always re-checked server-side against
      // the live DB record, never trusted from the socket's cached JWT data.
      const sender = await User.findById(socket.data.user.userId);
      if (!sender) {
        return respond(callback, { success: false, message: "Account not found" });
      }
      const otherEmail = chatType === "personal"
        ? getOtherEmailFromRoom(roomId, socket.data.user.email)
        : null;
      const permission = canSendMessage(sender, { chatType, otherEmail });
      if (!permission.allowed) {
        return respond(callback, {
          success: false,
          restricted: true,
          message: permission.reason,
          trial: trialSummary(sender)
        });
      }

      const message = await Message.create({
        chatType,
        roomId,
        groupId: groupId || null,
        sender: socket.data.user.userId,
        text
      });
      await message.populate("sender", "name email");

      // For a personal chat this may be the very first message ever between
      // these two users - the recipient's socket won't be joined to this
      // brand-new room yet unless we join it now, so make sure it is before
      // broadcasting, otherwise their client never sees it live.
      if (chatType === "personal" && otherUserId) {
        await io.in(`user:${otherUserId}`).socketsJoin(roomId);
      }

      io.to(roomId).emit("new_message", message);
      await markDelivered(io, message);

      await consumeTrialMessageIfNeeded(sender);
      const trial = trialSummary(sender);
      // Let every open tab/device of this user know their quota changed.
      io.to(`user:${sender._id}`).emit("trial_update", trial);

      respond(callback, {
        success: true,
        message,
        trial
      });
    } catch (error) {
      console.error("send_message error:", error);
      respond(callback, {
        success: false,
        message: "Unable to send message"
      });
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} | ${reason}`);
  });
}

module.exports = registerChatHandlers;
