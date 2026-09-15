# Testing Checklist

Legend: `[x]` verified by me in this sandbox (syntax, build, boot, curl-level,
or standalone logic tests - no live MongoDB/SMTP available here). `[ ]` needs
your real dev environment to confirm end-to-end.

## Auth
- [x] Signup validates required fields, returns clear errors
- [ ] Signup works end-to-end (creates a real user in your DB)
- [ ] Login works end-to-end
- [x] JWT is issued on login, required on protected routes (401 without it)
- [x] Passwords are bcrypt-hashed (code path verified, not a live compare)
- [ ] Forgot password sends a real email
- [ ] Reset password with a real token works, and the old token is invalidated after

## Trial / approval
- [x] New user starts with `trialMessageCount: 0`, `approvalStatus: "pending"` (schema default verified)
- [x] Counter logic verified with standalone tests (increments only for pending, never for approved/admin)
- [ ] Counter decreases correctly against real sends (personal, group, media all draw from the same quota)
- [x] 11th message is blocked by `canSendMessage` logic (unit-tested)
- [ ] Backend blocks it even if you manipulate the frontend (should - enforcement is server-side and independent of any client value, but confirm against a real request)
- [x] Restricted user can still message admin (unit-tested exception path)
- [x] Restricted user cannot message arbitrary users (unit-tested)
- [x] Restricted/pending user cannot join or create groups (enforced in `canJoinOrCreateGroup`, verified via code path + 400 response on ineligible member)
- [x] AI stops after quota exhaustion (unit-tested `canUseAi`)
- [ ] Admin approval unlocks features live, without requiring the user to refresh (socket event exists and is wired up - confirm the UI actually updates in a live browser)

## Admin
- [x] Admin role is only ever assigned by matching `ADMIN_EMAIL` at signup - never from client input
- [x] Normal users get 403 from every `/api/admin/*` route (middleware re-checks role from DB)
- [ ] Approve/suspend/reject/revoke work end-to-end and the affected user's UI updates live

## Chat
- [ ] Personal chat works end-to-end
- [x] Room IDs are deterministic regardless of who starts the chat (unit-tested against the exact algorithm both frontend and backend use)
- [ ] Real-time messages work between two real logged-in sessions
- [ ] Messages persist after refresh
- [x] Initial load fetches 50 messages (verified in code path)
- [ ] Older messages load in batches of 50 on scroll-up, against real accumulated history
- [ ] Scroll position remains stable when older messages are prepended
- [x] No duplicate messages - dedup logic verified in both the socket ack path and the broadcast path

## Presence
- [ ] Online status shows correctly between two real sessions
- [ ] Offline / last-seen shows correctly after disconnect
- [ ] Privacy setting (`nobody`) actually hides both online status and last seen from another user

## Receipts
- [ ] Sent tick shows immediately
- [ ] Delivered tick shows once the recipient's client is connected (even if they haven't opened that chat)
- [ ] Read tick shows once the recipient opens the chat

## Groups
- [x] Create works, requires approved/admin status (unit-tested + 403 verified)
- [x] Admin permissions enforced (403 without admin/creator status, verified via curl-level auth gating)
- [x] Member restrictions - ineligible (pending/restricted) users rejected with a clear message (unit-tested)
- [ ] Pending users cannot join a real group end-to-end
- [ ] Promote/demote/remove/leave all work against a real group with multiple real members

## Media
- [ ] Upload works against real S3 credentials
- [ ] Images display, videos play, other files download
- [x] Restrictions apply - same `canSendMessage` check as text messages, unit-tested

## AI
- [ ] Predictive typing returns real suggestions from Gemini
- [ ] Smart replies return real suggestions from Gemini
- [x] AI kill switch verified (`AI_SUGGESTIONS_ENABLED=false` short-circuits before any Gemini call, inherited unchanged from the original app)
- [x] No AI calls for restricted users (unit-tested)
- [ ] 429/503 handling confirmed against real rate-limited responses (retry/backoff logic inherited unchanged from the original app, not modified in any phase)

## Deployment
- [x] Builds cleanly (`next build`) with zero errors
- [x] Boots correctly in both dev (`npm run dev`) and production (`npm run build && npm run start`) modes, on one port, serving both pages and API routes
- [ ] Works after actual deployment to Render
- [ ] Environment variables work as expected in the Render dashboard
- [ ] Socket.IO works in production over Render's infrastructure
- [ ] MongoDB Atlas connection works from Render
- [ ] S3 works from Render
