# Chat App

A WhatsApp-inspired, real-time chat application. Personal and group
messaging, media sharing, AI-assisted replies, an approval/free-trial system
for new users, and an admin dashboard — all as one Next.js project with a
custom server that also runs the Express API and Socket.IO.

```
npm install
cp .env.example .env   # fill in real values
npm run dev
```

Open http://localhost:3000. One command, one process, one port.

---

## 1. Project overview

New users sign up and get a 10-message free trial across every kind of
messaging (personal, group, and media combined). Once that runs out, they
can still view their existing chats and message the app's admin directly,
but need admin approval to message anyone else, join groups, or use AI
suggestions again. The admin's chat is pinned to the top of every new
user's chat list from the moment they sign up, so they always have a way
to reach the admin for approval without knowing their email. Admins manage
approvals from a built-in dashboard.

Beyond that: real-time personal and group chat, image/video/file sharing via
S3, delivery/read receipts (including a per-member breakdown for groups),
online/last-seen presence, cursor-based message pagination with infinite
scroll, Gemini-powered predictive typing and smart replies, scheduled
message archiving, and a dark/light theme toggle.

## 2. Features

- Signup/login (email or phone) with JWT auth and bcrypt password hashing
- Forgot/reset password via Nodemailer, with hashed/expiring tokens
- Profile management: name, phone, bio, avatar (S3), last-seen privacy
- Free-trial + admin-approval system, enforced server-side everywhere
- Personal chat with deterministic room IDs (sorted-email based)
- Admin chat automatically pinned to the top of every user's chat list
- Group chat: create, settings, add/remove members, promote/demote admins, leave
- Group member list shows each member's online/last-seen status
- Image, video, and general file sharing via AWS S3, with upload progress
- Delivery and read receipts (sent / delivered / read), with a tap-to-view
  per-member breakdown for group messages ("read by 3 of 5", who's seen it)
- Online presence and last-seen, respecting a per-user privacy setting
- Unread-message badges per conversation and aggregated on the Chats/Groups tabs
- Cursor-based message pagination (never offset-based) with infinite scroll
- Gemini AI predictive typing and smart replies, with retry/backoff and a
  hard environment kill switch
- Scheduled message archiving (cron) into a separate collection
- Admin dashboard: stats, pending-approval queue, user search, approve/
  suspend/reject/revoke actions
- Dark/light theme toggle (dark by default), persisted per browser
- Rate limiting on both authentication and general API traffic
- Loading skeletons throughout instead of blank/jumping layouts

## 3. Technology stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router), plain JavaScript, Socket.IO client |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB + Mongoose |
| Auth | JWT, bcrypt |
| Media | AWS S3 |
| Email | Nodemailer (Gmail SMTP by default) |
| AI | Google Gemini API |
| Deployment | Render, MongoDB Atlas, AWS S3 |

## 4. Architecture

One Node process runs everything. `server.js` creates a Next.js app
instance, mounts every Express API route under `/api/*`, adds a catch-all
route that hands anything else to Next.js's page renderer, and attaches
Socket.IO to the same underlying `http.Server`. Route order matters here —
the catch-all is registered last, after every API route, so it never
swallows them.

There is no CORS configuration because there is no cross-origin request to
make — the frontend and API are the same origin. The app also trusts the
first proxy hop (`app.set("trust proxy", 1)`), which matters on Render:
without it, every request looks like it comes from the proxy's IP instead
of the real visitor's, which would break IP-based rate limiting.

## 5. Folder structure

```
chat-app/
├── server.js              custom server: Next.js + Express + Socket.IO, one process
├── package.json
├── .env.example
├── render.yaml
├── next.config.js
│
├── app/                    Next.js App Router pages (thin route wrappers)
│   ├── login/, signup/, forgot-password/, reset-password/
│   ├── chat/, profile/, admin/
│   └── layout.js, globals.css
├── components/
│   ├── auth/                LoginForm, SignupForm, ForgotPasswordForm, ResetPasswordForm
│   ├── chat/                 Sidebar, ChatWindow, MessageBubble, TrialBanner,
│   │                         MessageReceiptModal, SidebarSkeleton, MessagesSkeleton
│   ├── groups/                CreateGroupModal, GroupSettingsModal
│   ├── profile/                AvatarUploader, ProfileDetailsForm, PasswordForm, TrialStatusBadge
│   ├── admin/                   StatsGrid, UsersTable, StatsGridSkeleton, UsersTableSkeleton
│   └── common/                   Avatar, ProtectedRoute, AuthLayout, ThemeToggle
├── hooks/                   useAuth (session + live socket sync), useToast, useTheme
├── services/                 api, auth, socket, groups, admin (frontend API/socket clients)
├── utils/                     room.js (mirrors the backend's room-ID algorithm), time.js
│
└── server/                     the Express/Socket.IO backend
    ├── models/                  User, Message, Group, ArchivedChat, PasswordReset
    ├── middleware/              auth, adminMiddleware, upload, uploadAvatar
    ├── services/                approvalService, s3, mailService, geminiService,
    │                            roomAccessService, messageHistoryService, presenceService
    ├── socket/handlers/         chat.js, presence.js, receipts.js
    ├── routes/                  aiRoutes.js
    ├── jobs/                    archiveChats.js (cron)
    ├── scripts/                 migrateExistingUsers.js
    ├── config/                  mail.js
    ├── prompts/                 geminiPrompts.js
    └── utils/                   room.js, rateLimiter.js
```

## 6. Local installation

```
git clone <your repo>
cd chat-app
cp .env.example .env
npm install
npm run dev
```

Requires Node 18.18+, a MongoDB instance (local or Atlas), and — for the
features that need them — AWS S3 credentials and SMTP credentials. The app
runs and the chat/auth core works without AI or S3/SMTP configured; those
features degrade gracefully (see sections 10–12).

## 7. Environment variables

All variables live in one `.env` file at the project root (see
`.env.example` for the full list with comments). Highlights:

| Variable | Purpose |
|---|---|
| `PORT` | Port for the single unified server (default 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs auth tokens — use a long random value |
| `ADMIN_EMAIL` | Signing up with this email auto-grants admin/approved |
| `FREE_MESSAGE_LIMIT` | Trial message quota for new users (default 10) |
| `AWS_*`, `S3_BUCKET_NAME` | Media uploads |
| `SMTP_*`, `EMAIL_FROM` | Password-reset emails |
| `FRONTEND_URL` | This app's own public URL — used to build reset-password links |
| `RESET_TOKEN_EXPIRY_MINUTES` | Password-reset link lifetime (default 15) |
| `AI_SUGGESTIONS_ENABLED` | Hard kill switch for all Gemini calls |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI predictive typing/smart replies |
| `ARCHIVE_*` | Message-archiving cron schedule/batch size |

General API and auth rate limits (see section 22) are fixed in code rather
than environment-configurable.

## 8. Running in production

```
npm run build
npm run start
```

`npm run dev` uses `nodemon` to restart on backend file changes
(`server.js` and `server/`); Next.js's own Fast Refresh handles frontend
file changes without a restart, so you don't need to restart the whole
process while iterating on UI.

## 9. MongoDB setup

Any MongoDB 5+ instance works — local `mongod` for development, MongoDB
Atlas for production (a free-tier cluster is enough to start). Put the
connection string in `MONGODB_URI`. Indexes are declared in the Mongoose
schemas and created automatically on first connection.

If you have existing users from before the approval/trial system existed,
run `npm run migrate:approval` once against that database — it grandfathers
existing users in as fully approved instead of dropping them into the new
trial flow. Fresh databases don't need this.

## 10. AWS S3 setup

Create a bucket, an IAM user with `PutObject`/`GetObject` permissions scoped
to that bucket, and set `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`. Without these set, media upload
requests will fail with a clear error — everything else in the app still works.

## 11. Nodemailer setup

Default config targets Gmail SMTP (`smtp.gmail.com:587`). Gmail requires a
**Google App Password** (Google Account → Security → 2-Step Verification →
App Passwords, with 2FA enabled) in `SMTP_PASS` — a normal Gmail password is
rejected. Without SMTP configured, forgot-password requests still return a
generic success response (never leaking whether an email exists) but no
email is actually sent — logged server-side, not surfaced to the user.

## 12. Gemini setup

Set `GEMINI_API_KEY` and `AI_SUGGESTIONS_ENABLED=true`. `GEMINI_MODEL`
defaults to `gemini-3.5-flash-lite`. With the kill switch off (the default),
zero Gemini requests are made regardless of anything else. Retries with
backoff handle 429/503 automatically; AI failures never break chat itself.

## 13. Admin configuration

Set `ADMIN_EMAIL` before anyone signs up with that address — that signup
automatically becomes `role: "admin"`, fully approved, unlimited everything.
Admin status can never be granted from the frontend; it's decided purely by
matching this env var, server-side. The admin dashboard lives at `/admin`
and redirects non-admin users away.

If `ADMIN_EMAIL` is set (or changed) *after* that account already exists,
it self-heals rather than requiring a manual fix — the account is
automatically promoted to `role: "admin"` / `approvalStatus: "approved"`
the next time it logs in or hits an admin-only route.

## 14. User approval statuses

Every non-admin user has an `approvalStatus`, independent of `role`. Here's
exactly what each one means and what it changes:

| Status | Set by | Messaging | Groups | AI | Trial quota |
|---|---|---|---|---|---|
| **pending** | Default on signup | Anyone, until the trial runs out — then only the admin, unlimited | Can't create or join | Works until the trial runs out | 10 messages by default (`FREE_MESSAGE_LIMIT`), one shared counter across personal + group + media |
| **approved** | Admin action | Anyone, unlimited | Full access | Full access | N/A — unlimited |
| **rejected** | Admin action | Only the admin, unlimited | Can't create or join | Blocked | N/A — no quota, immediately restricted |
| **suspended** | Admin action | Only the admin, unlimited | Can't create or join | Blocked | N/A — no quota, immediately restricted |

Notes:

- **pending** is the only status with an actual counter
  (`trialMessageCount` vs `trialMessageLimit`). Every other status is a
  flat unlimited-or-restricted — there's no partial quota for
  rejected/suspended users.
- **rejected** and **suspended** are functionally identical in the code —
  both restrict to admin-only messaging immediately, no trial. The
  distinction is purely semantic for the admin's own record-keeping:
  reject reads as "this signup wasn't approved," suspend reads as "this
  was working, now paused."
- Whenever a user is restricted (pending-exhausted, rejected, or
  suspended), they can still: view existing chats, receive incoming
  messages, update their profile, and message the admin without limit.
  What's blocked is starting new personal chats with anyone else, group
  messaging, joining/creating groups, and AI.
- The admin's chat is pinned to the top of every restricted (and
  unrestricted) user's chat list specifically so this admin-messaging
  exception is actually reachable — see section 17.
- **Revoke approval** is a separate admin action, not a fifth status — it
  sets an `approved` user back to `pending`, putting them back on the
  trial system rather than hard-blocking them.
- `role: "admin"` sits outside this whole system entirely — always
  unlimited, never subject to any of these checks, regardless of
  `approvalStatus`.
- All of this is enforced server-side and re-read from the database on
  every request — the frontend UI reflects it, but never decides it.

## 15. Personal chat

Room IDs are deterministic: both participants' emails are lowercased,
sorted, and joined with `::`, so it's identical regardless of who starts the
conversation. The frontend computes the same ID client-side to request a
join; the server independently re-derives and validates it before allowing
access.

## 16. Group chat

Any approved/admin user can create a group and add other approved/admin
users as members (a pending user needing approval can't be added, and can't
create or join a group themselves). Group admins — the creator plus anyone
promoted — manage members, settings, and the group photo; the creator can
never be removed or demoted by someone else. The member list shows each
member's online/last-seen status, respecting the same privacy setting as
personal chats.

## 17. Admin chat pinning

Every non-admin user sees the admin's chat pinned at the top of their
Chats tab, whether or not a real conversation exists yet — this is what
lets a brand-new user reach the admin for approval without knowing their
email or searching for it. If a real conversation already exists, that
entry is promoted to the top rather than duplicated, and its real unread
count is preserved.

## 18. Online/last seen

Presence updates broadcast only to actual contacts (people you've messaged
or share a group with), not globally. A user with `lastSeenPrivacy: "nobody"`
shows neither online status nor last-seen time to anyone else — in personal
chats, group member lists, or anywhere else.

## 19. Delivery/read receipts

Every socket auto-joins all of its rooms on connect (not just whichever one
the UI has open), so delivery can be marked the instant a message reaches a
connected client — independent of whether that chat is actively open.
Read receipts fire when a room is opened or a message arrives while it's
already open.

For personal chats, receipts show as the familiar tick marks (sent /
delivered / read). For group chats, tapping the tick marks on your own
message opens a breakdown of exactly which members have read or received
it, with a "read by X of Y" summary — the underlying data (`deliveredTo`/
`readBy` membership per message) always existed; this just surfaces it.
That breakdown shows status, not a per-person timestamp — the schema
tracks whether each member has read a message, not when.

## 20. Cursor pagination

Message history loads 50 at a time, newest page first, using a timestamp
cursor — never offset-based, so it stays fast and correct no matter how much
history a room accumulates. Scrolling to the top of a chat loads the next
older page and preserves scroll position.

## 21. Archiving

A cron job (`ARCHIVE_CRON_SCHEDULE`, default nightly) moves messages older
than `ARCHIVE_AFTER_HOURS` into a separate `ArchivedChat` collection, keeping
the active `Message` collection lightweight. Message history views
transparently merge both collections, so archived history is never lost
from the user's perspective. Unread-badge counts only scan active messages,
not archived ones — a message old enough to be archived sitting unread is
an edge case not worth the extra query cost.

## 22. Rate limiting

Three layers, all in-memory (fine for a single instance; see section 27 for
scaling beyond that):

- **General API**: 120 requests/minute per IP, applied to every `/api/*` route.
- **Auth**: 20 attempts per 15 minutes per IP, shared between signup and
  login — slows down credential-stuffing and spam signups.
- **Forgot-password**: 5 requests per 15 minutes per IP+email combination —
  its own tighter limiter, since password-reset abuse is a narrower,
  higher-value target than general API traffic.

## 23. Theming

Dark theme is the default; a toggle (sidebar, and on pages without a
sidebar) switches to light and persists the choice in `localStorage`. An
inline script sets the theme attribute before React hydrates, so there's no
flash of the wrong theme on load. Brand chrome (the dark sidebar, the
accent color) stays constant across both themes — only the canvas/panel/
text surfaces switch.

## 24. Mobile behavior

A few mobile-specific fixes worth knowing about if you're extending this
further:

- Layout uses `100dvh` (with a `100vh` fallback), not `100vh` alone, and the
  viewport is configured with `interactive-widget=resizes-content` — without
  both of these, the on-screen keyboard covers the message input instead of
  the layout shrinking to make room for it.
- The send button uses `onPointerDown` with `preventDefault()` so tapping it
  doesn't steal focus from the message input (which would otherwise close
  the keyboard on every send).
- The socket resyncs (refetches sidebar data, rejoins the active room) on
  every reconnect and on the page's `visibilitychange` event — mobile
  browsers aggressively suspend background tabs, which can silently drop
  the WebSocket without the usual disconnect event ever firing.

## 25. Deployment on Render

`render.yaml` defines one web service — build command
`npm install && npm run build`, start command `npm run start`. Set every
`sync: false` variable in the Render dashboard (Mongo URI, AWS/SMTP
credentials, admin email, etc.) before or after the first deploy. `PORT` is
provided by Render automatically. `FRONTEND_URL` should be set to this
service's own Render URL once you know it — it's used for password-reset
email links.

Because this is one unified service, there is no second frontend deployment
and no CORS configuration to manage — a real simplification versus a split
frontend/backend deployment. Confirmed working in production on Render,
including S3, Gemini, and Nodemailer.

## 26. Security notes

- All approval/trial/role checks are enforced server-side and re-read from
  the database on every request — the frontend's UI state is never trusted.
- Passwords are bcrypt-hashed; reset tokens are stored only as a SHA-256
  hash with a TTL index for automatic expiry.
- Forgot-password never reveals whether an email is registered.
- Admin status can only be granted by matching `ADMIN_EMAIL` — never from
  client input — and self-heals if that env var changes after an account
  already exists (section 13).
- File uploads are validated by type and size before reaching S3.
- The app trusts the first proxy hop (`trust proxy`) so rate limiting keys
  on the real client IP rather than the load balancer's — important on any
  platform (Render included) that sits behind a reverse proxy.

## 27. Future improvements

- Push notifications for messages received while the app isn't open
- App-wide (not just in-chat-page) live notifications — currently, new
  message/presence socket listeners are scoped to the chat page, so you
  won't see a live update while sitting on `/profile` or `/admin`
- Per-member read *timestamps* for groups (currently status only, not when)
- Rich text / message editing and deletion
- A Redis-backed rate limiter and pub/sub if this ever runs across multiple instances
- Automated test suite (everything so far has been manually/scripted verified)
- JWT refresh/revocation (tokens are currently long-lived with no revocation path)

---

See `docs/CHANGELOG-*.md` for the detailed history and assumptions behind
each phase and fix, and `docs/TESTING.md` for a testing checklist.
