# Phase 7–10: Presence, Receipts, Full Group Management, Pagination

## An architecture fix this phase depends on

Previously, a socket only received live events for whichever single room it
had explicitly `join_room`'d — the room the UI currently has open. That's
fine for the message list itself, but it meant delivery receipts, presence,
and "did I get a new message in a different chat" could never work correctly
in the background.

Fixed via `services/presenceService.js` + `socket/handlers/presence.js`:
**every socket now auto-joins all of its personal + group rooms on connect**,
not just the active one. `send_message` also proactively joins the
recipient's live sockets to a brand-new personal room the instant the first
message is sent (so a first-ever message still delivers live even though the
room didn't exist a moment ago). This is what makes delivery receipts and
"message arrived while you were elsewhere" actually correct.

## New files

- `services/presenceService.js` — room auto-join set, contact discovery for
  scoping presence broadcasts, privacy-aware presence shaping
- `socket/handlers/presence.js` — sets `isOnline`/`lastSeen` on connect/
  disconnect, broadcasts `user_presence` only to actual contacts (people
  you've messaged or share a group with) — not a global broadcast
- `socket/handlers/receipts.js` — `markDelivered` (called right after every
  send) and `markRoomRead` (called on `join_room` and the explicit
  `mark_read` event)
- `services/messageHistoryService.js` — `loadRoomPage(roomId, {limit,
  cursor})`, shared by `join_room` (initial 50) and the new pagination
  endpoint (scrolling up)
- `services/roomAccessService.js` — `canAccessRoom` extracted out of
  `routes/aiRoutes.js` so the new pagination endpoint uses the exact same
  check instead of a second copy

## Model changes

- `User`: `isOnline`, `lastSeen`
- `Message`: `deliveredTo`/`readBy` (arrays of user IDs) + a `status` virtual
  (`sent`/`delivered`/`read`, derived from those arrays — no separately
  maintained status field to get out of sync)
- `Group`: `description`, `image`, `admins` (creator is always implicitly an
  admin even if removed from this array)

## New/changed API surface

```
GET    /api/messages/:roomId?limit=50&cursor=<ISO timestamp>   -> older page
GET    /api/groups/:groupId
PUT    /api/groups/:groupId                    -> admin only, name/description
PUT    /api/groups/:groupId/image              -> admin only
POST   /api/groups/:groupId/members            -> admin only, add by email
DELETE /api/groups/:groupId/members/:userId    -> admin only
POST   /api/groups/:groupId/leave              -> any member
PUT    /api/groups/:groupId/admins/:userId/promote  -> admin only
PUT    /api/groups/:groupId/admins/:userId/demote   -> admin only
```

New socket events: `user_presence` (contacts only), `message_status_update`
(delivered/read on a specific message), `messages_read` (bulk, on room open
or explicit `mark_read`), `group_updated` (settings/membership changes).
`join_room`'s response now also includes `nextCursor`/`hasMore` for the
scroll-up pagination.

## Key decisions / assumptions

- **Last-seen privacy applies to `isOnline` too**, not just `lastSeen` — the
  spec only mentioned last seen, but showing "online" while hiding "last
  seen" leaks the same information in practice. If you want them split,
  it's a one-line change in `presenceService.presenceSummary`.
- **Group receipts use the same delivered/read arrays as personal chats**
  (not a per-user detailed list UI) — matches your spec's explicit
  instruction to keep group receipts as a "reasonable aggregate" rather than
  building a full per-member read-receipt UI.
- **Group admin safeguards**: the creator can never be removed or demoted by
  someone else (only leaves voluntarily), and the last remaining admin can't
  leave while other members are still in the group — they have to promote
  someone else first.
- **Joining a group still requires `approved`/`admin` status** — same
  assumption flagged in the Phase 1–4 changelog, now also enforced when an
  admin manually adds someone via the new add-members endpoint.

## What I verified (still no live MongoDB in this sandbox)

- `node --check` passes on every new/modified file; full server boots cleanly.
- Every new endpoint correctly returns 401 without a token (curl-tested).
- Careful manual review of the room-join/delivery/read-receipt flow logic,
  the cursor math (`$lt` on the correct timestamp field per collection,
  clamped limit, correct hasMore calculation via limit+1 peek), and the
  group-admin safeguard branches.
- **Not verified against a live database**: the actual presence broadcast
  reaching the right contacts, delivery ticks flipping in real time, group
  admin promote/demote end-to-end, or pagination against real accumulated
  history. Please exercise these against your dev environment - especially
  worth checking: two browser tabs as two different users, confirm presence
  dots and read receipts update live between them.

## Not yet done

Frontend wiring for all of this (presence dots, read-tick icons, group
settings UI, infinite scroll) — the Next.js app from Phase 11 doesn't
consume any of it yet. Also still pending: Phase 12 (WhatsApp-style visual
polish), Phase 13 (AI already integrated, just needs a final pass), Phase 14
(Render deployment config for the two-service setup), Phase 15 (README/testing).
