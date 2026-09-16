# Group Member Presence, Per-Member Read Receipts, Admin Skeletons

## Group member online status

Every group-returning endpoint (create, list, get, update, image upload,
add/remove member, promote/demote, leave) now populates presence fields on
members and serializes them through a new shared
`serializeGroupForResponse()` helper in `server.js` - one place applying
the same privacy rule (`lastSeenPrivacy`) that personal chats already use,
instead of duplicating it across 9 endpoints.

`GroupSettingsModal` now shows each member's online dot and last-seen text
(reusing the `utils/time.js` formatter from before). Presence updates now
also flow live into group member lists - previously the `user_presence`
socket handler only updated personal chats; extended it to also patch
`groups`, the currently-open group chat, and an open `GroupSettingsModal`.

## Per-member group read receipts

This was previously deliberately scoped out (your spec allowed an
aggregate status), but the underlying data was already there -
`deliveredTo`/`readBy` on each `Message` were always full arrays of member
IDs, just collapsed down to a single sent/delivered/read status for the
tick marks. No backend changes were needed for the data itself.

Added: tapping the tick marks on your own group messages opens a "Message
info" modal (`MessageReceiptModal.js`) listing every other group member
with their individual status (Read / Delivered / Sent) and a "Read by X of
Y" summary. Deliberately built to read from the live `messages` array by
message ID rather than a snapshot, so if someone reads the message while
you have the modal open, it updates instead of going stale. Personal chats
keep their existing simple tick marks - the per-member breakdown only
makes sense where there's more than one recipient.

One honest data limitation worth knowing: the schema tracks *whether* each
member has read a message, not *when* - so the modal shows status, not a
per-person timestamp. Adding per-user read timestamps would mean changing
`deliveredTo`/`readBy` from plain ID arrays to `{user, at}` pairs, a real
schema change I didn't make since it wasn't asked for.

## Admin page loading skeletons

Replaced the plain "Loading..." text with `StatsGridSkeleton.js` and
`UsersTableSkeleton.js` - pulsing placeholders shaped like the real stats
cards and user rows, consistent with the sidebar/message skeletons from
last round. Shows on initial load and again briefly on tab switches,
searches, and approval actions (since those all re-trigger the same fetch).

## What I verified

- Clean `next build`, all 5 routes return 200 in production mode
- Confirmed the new CSS (skeleton classes, clickable-tick button styling)
  compiled into the production bundle
- Unit-tested the per-member status logic standalone (Read/Delivered/Sent
  branches all correct)
- Could not click through the actual group settings modal, tap a message's
  ticks, or watch presence update live between two sessions - please check
  these directly, especially: does the online dot update within a second
  or two of a group member's status actually changing
