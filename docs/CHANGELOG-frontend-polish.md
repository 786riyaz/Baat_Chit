# Frontend Polish: Unread Badges, Group Description, Upload Progress

Picking up items your original spec called out as desirable but were still
missing from the frontend after Phase 9-11.

## Unread message badges

Previously absent entirely. Now:

- `GET /api/personal-chats/recent` and `GET /api/groups` each now include
  an `unreadCount` per room - a single aggregation query per endpoint
  (`Message` grouped by `roomId`, counting messages not sent by you and not
  yet in your `readBy` array), not one query per room.
- Sidebar shows a small badge with the count next to any chat/group that
  has unread messages.
- Opening a chat zeroes its badge immediately (optimistic update on the
  client, mirroring the `markRoomRead` call the server already runs as part
  of `join_room`).
- Scoped to the active `Message` collection only, not `ArchivedChat` - a
  message old enough to be archived (24h+ by default) sitting unread is an
  edge case not worth the extra aggregation cost.

## Group description at creation

`CreateGroupModal` only collected a name before, even though the backend
has supported a `description` field since Phase 9. Added the field and
threaded it through `onCreate` → `services/groups.createGroup` → the
existing `POST /api/groups` endpoint (no backend change needed - it already
accepted this).

## Media upload progress

Your spec explicitly asked for "loading progress if practical" on media
uploads - previously the attach flow just sat there with no feedback until
it finished. `fetch()` has no upload-progress event, so switched the upload
call to `XMLHttpRequest` (wrapped in a Promise via `uploadWithProgress` in
`services/api.js`) and added a small progress bar that replaces the file
chip's remove button while a send is in flight.

## What I verified

- Clean `next build`, all routes 200 in production mode
- Confirmed the new `.unread-badge` and `.upload-progress` CSS rules
  compiled correctly into the production bundle
- The unread-count aggregation logic itself (correct `$match`/`$group`
  shape, ObjectId casting) was reviewed carefully but not run against a
  live database in this sandbox - please confirm badges appear/clear
  correctly with two real accounts messaging each other
- Upload progress needs a real file upload against real S3 credentials to
  see the bar move - untestable here
