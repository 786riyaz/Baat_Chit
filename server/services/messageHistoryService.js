const Message = require("../models/Message");
const ArchivedChat = require("../models/ArchivedChat");

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function normalizeArchived(message) {
  return {
    _id: message.originalMessageId,
    chatType: message.chatType,
    roomId: message.roomId,
    groupId: message.groupId,
    sender: message.sender,
    text: message.text,
    media: message.media,
    createdAt: message.originalCreatedAt,
    updatedAt: message.originalUpdatedAt,
    // Archived messages predate receipt tracking - treat them as fully read
    // rather than showing a misleading "sent" tick on old history.
    status: "read",
    archived: true
  };
}

/**
 * Load one page of a room's message history, newest-first internally, then
 * returned oldest-first (ready to render top-to-bottom / prepend on scroll).
 *
 * @param {string} roomId
 * @param {{ limit?: number, cursor?: string|Date|null }} options
 *   cursor: an ISO timestamp (or Date) - returns messages strictly older
 *   than this. Omit for the most recent page.
 */
async function loadRoomPage(roomId, { limit = DEFAULT_LIMIT, cursor = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursorDate = cursor ? new Date(cursor) : null;
  const cursorValid = cursorDate && !Number.isNaN(cursorDate.getTime());

  const activeFilter = { roomId, ...(cursorValid ? { createdAt: { $lt: cursorDate } } : {}) };
  const archivedFilter = { roomId, ...(cursorValid ? { originalCreatedAt: { $lt: cursorDate } } : {}) };

  const [activeMessages, archivedMessages] = await Promise.all([
    Message.find(activeFilter)
      .populate("sender", "name email")
      .sort({ createdAt: -1 })
      .limit(safeLimit + 1),
    ArchivedChat.find(archivedFilter)
      .populate("sender", "name email")
      .sort({ originalCreatedAt: -1 })
      .limit(safeLimit + 1)
  ]);

  const merged = [
    ...activeMessages.map((message) => {
      const plain = message.toJSON();
      return plain;
    }),
    ...archivedMessages.map(normalizeArchived)
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const page = merged.slice(0, safeLimit);
  const hasMore = merged.length > safeLimit;
  const nextCursor = page.length ? page[page.length - 1].createdAt : null;

  return {
    messages: page.reverse(),
    nextCursor,
    hasMore
  };
}

module.exports = { loadRoomPage, DEFAULT_LIMIT, MAX_LIMIT };
