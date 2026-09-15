# Phase 1–4: Approval / Free-Trial System

## What changed

**New files**
- `services/approvalService.js` — single source of truth for all approval/trial rules
- `middleware/adminMiddleware.js` — `role === "admin"` guard, re-checked from DB every request
- `scripts/migrateExistingUsers.js` — one-time backfill for users created before this change

**Modified files**
- `models/User.js` — added `role`, `approvalStatus`, `trialMessageCount`, `trialMessageLimit`
- `server.js` — signup now assigns role/approval automatically; added `GET /api/users/me`
  and the admin endpoints below; group creation and media upload are now gated
- `socket/handlers/chat.js` — `send_message` is now gated (text messages)
- `routes/aiRoutes.js` — `/predict` and `/smart-replies` are now gated
- `.env.example`, `package.json` — added `ADMIN_EMAIL`, `FREE_MESSAGE_LIMIT`, `migrate:approval` script

**Untouched**: personal chat room logic, group model, message storage, S3 upload logic,
archiving cron, Gemini retry/prompt logic, the entire `public/` frontend. It all still works
exactly as before — the new checks only add an extra allow/deny gate in front of sending.

## New API endpoints

```
GET  /api/users/me                        -> your own profile + trial status
GET  /api/admin/stats                     -> admin only
GET  /api/admin/users?search=             -> admin only
GET  /api/admin/users/pending             -> admin only
PUT  /api/admin/users/:userId/approve     -> admin only
PUT  /api/admin/users/:userId/suspend     -> admin only
PUT  /api/admin/users/:userId/reject      -> admin only
PUT  /api/admin/users/:userId/revoke-approval -> admin only (back to pending)
```

New Socket.IO events: `trial_update` (pushed to the sender after every message/media send),
`approval_updated` (pushed when an admin changes a user's status).

## The business rule, implemented exactly as coded

- Signup with email == `ADMIN_EMAIL` → `role: "admin"`, `approvalStatus: "approved"`, unlimited everything.
- Every other signup → `role: "user"`, `approvalStatus: "pending"`, `trialMessageCount: 0`.
- A pending user can send `FREE_MESSAGE_LIMIT` (default 10) messages total — personal text,
  group text, and media uploads all draw from the **same** counter.
- Once exhausted, a pending user can still: view existing chats/messages, receive incoming
  messages, use forgot/login, update their profile — and can still message the admin
  1:1 with no limit. Everything else (arbitrary personal chat, group messages, AI) is blocked
  with a clear message. `suspended`/`rejected` users get the same admin-only exception.
- `approved` users and `admin` are always unlimited everywhere.
- All of this is enforced **server-side** in the socket handler, the media-upload route, the
  AI routes, and group creation — never trusted from the client.

## One assumption I made (flagging it, since the spec was ambiguous here)

Section 9 of the spec lists "join groups" as a restriction that only kicks in *after* the
10-message quota is exhausted. Section 15 separately says pending/restricted users generally
"must NOT be able to join a group" and should see "Admin approval will be required to join
this group" — without conditioning that on quota.

I implemented the **stricter** reading: pending users cannot create/join groups at all,
regardless of remaining quota (only `approved`/`admin` can). If you intended the looser
reading (pending users *with* quota remaining can join groups, only exhausted ones can't),
it's a one-line change: swap `canJoinOrCreateGroup` in `services/approvalService.js` to check
quota instead of `approvalStatus === "approved"`. Let me know which you want and I'll adjust.

## Migration note (important before you deploy this)

The new schema defaults `approvalStatus` to `"pending"`. If you already have real users in
your database from before this change, run this once against that database:

```
npm run migrate:approval
```

It grandfathers every existing user in as `approved` (full access, no retroactive trial limit),
and promotes the `ADMIN_EMAIL` user to `role: "admin"` if they already existed. Fresh
databases don't need this — new signups get the correct status automatically.

## What I verified

- `node --check` passes on every new/modified file.
- The server boots cleanly end-to-end (`node server.js`) without a live MongoDB connection
  (connection failure is logged, not fatal — matches the existing app's behavior).
- All approval/trial business-logic branches were exercised with a standalone test script
  (admin signup, pending-under-quota, pending-exhausted, admin-chat exception, group block,
  AI block, suspended-user admin exception, approved/admin unlimited) — all passed.
- I could not spin up a live MongoDB instance in this sandbox to run a full request/socket
  integration test, so please run through the TESTING REQUIREMENTS checklist in section 36
  of your spec (signup → send 10 messages → 11th blocked → admin approves → unlocks) against
  your real dev environment before treating this as production-verified.

## Not in this phase (coming in later phases per your own ordering)

Admin dashboard **UI**, profile management, forgot/reset password, presence/last-seen,
delivery/read receipts, cursor pagination, Next.js migration, and the WhatsApp-style UI are
all still pending — this phase is backend-only, matching your Phase 1–4 ordering.
