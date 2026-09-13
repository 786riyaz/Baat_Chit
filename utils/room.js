export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Must stay byte-for-byte identical to backend/utils/room.js - the server
// re-derives and validates this same room ID on every join_room call.
export function createPersonalRoomId(emailA, emailB) {
  return [normalizeEmail(emailA), normalizeEmail(emailB)].sort().join("::");
}
