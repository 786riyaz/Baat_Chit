# Chat App

A WhatsApp-inspired, real-time chat application. Personal and group
messaging, media sharing, AI-assisted replies, an approval/free-trial system
for new users, and an admin dashboard - all as one Next.js project with a
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
suggestions again. Admins manage approvals from a built-in dashboard.

Beyond that: real-time personal and group chat, image/video/file sharing via
S3, delivery/read receipts, online/last-seen presence, cursor-based message
pagination with infinite scroll, Gemini-powered predictive typing and smart
replies, and scheduled message archiving.

## 2. Features

- Signup/login (email or phone) with JWT auth and bcrypt password hashing
- Forgot/reset password via Nodemailer, with hashed/expiring tokens
- Profile management: name, phone, bio, avatar (S3), last-seen privacy
- Free-trial + admin-approval system, enforced server-side everywhere
- Personal chat with deterministic room IDs (sorted-email based)
- Group chat: create, settings, add/remove members, promote/demote admins, leave
- Image, video, and general file sharing via AWS S3
- Delivery and read receipts (sent / delivered / read)
- Online presence and last-seen, respecting a per-user privacy setting
- Cursor-based message pagination (never offset-based) with infinite scroll
- Gemini AI predictive typing and smart replies, with retry/backoff and a
  hard environment kill switch
- Scheduled message archiving (cron) into a separate collection
- Admin dashboard: stats, pending-approval queue, user search, approve/
  suspend/reject/revoke actions

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
Socket.IO to the same underlying `http.Server`. See
`docs/CHANGELOG-phase11-unify.md`-equivalent detail in this README's
folder-structure section below for exactly how that's wired.

There is no CORS configuration because there is no cross-origin request to
make - the frontend and API are the same origin.

## 5. Folder structure

```
chat-app/
├── server.js              custom server: Next.js + Express + Socket.IO, one process
├── package.json
├── .env.example
├── render.yaml
├── next.config.js
│
├── app/                   Next.js App Router pages (thin route wrappers)
│   ├── login/, signup/, forgot-password/, reset-password/
│   ├── chat/, profile/, admin/
│   └── layout.js, globals.css
├── components/
│   ├── auth/               LoginForm, SignupForm, ForgotPasswordForm, ResetPasswordForm
│   ├── chat/                Sidebar, ChatWindow, MessageBubble, TrialBanner
│   ├── groups/               CreateGroupModal, GroupSettingsModal
│   ├── profile/               AvatarUploader, ProfileDetailsForm, PasswordForm, TrialStatusBadge
│   ├── admin/                  StatsGrid, UsersTable
│   └── common/                  Avatar, ProtectedRoute, AuthLayout
├── hooks/                  useAuth (session + live socket sync), useToast
├── services/                api, auth, socket, groups, admin (frontend API/socket clients)
├── utils/                    room.js (mirrors the backend's room-ID algorithm)
│
└── server/                    the Express/Socket.IO backend
    ├── models/                 User, Message, Group, ArchivedChat, PasswordReset
    ├── middleware/             auth, adminMiddleware, upload, uploadAvatar
    ├── services/               approvalService, s3, mailService, geminiService,
    │                            roomAccessService, messageHistoryService, presenceService
    ├── socket/handlers/        chat.js, presence.js, receipts.js
    ├── routes/                 aiRoutes.js
    ├── jobs/                   archiveChats.js (cron)
    ├── scripts/                migrateExistingUsers.js
    ├── config/                 mail.js
    ├── prompts/                geminiPrompts.js
    └── utils/                  room.js, rateLimiter.js
```

## 6. Local installation

```
git clone <your repo>
cd chat-app
cp .env.example .env
npm install
npm run dev
```

Requires Node 18.18+, a MongoDB instance (local or Atlas), and - for the
features that need them - AWS S3 credentials and SMTP credentials. The app
runs and the chat/auth core works without AI or S3/SMTP configured; those
features degrade gracefully (see sections 9-11).

## 7. Environment variables

All variables live in one `.env` file at the project root (see
`.env.example` for the full list with comments). Highlights:

| Variable | Purpose |
|---|---|
| `PORT` | Port for the single unified server (default 3000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs auth tokens - use a long random value |
| `ADMIN_EMAIL` | Signing up with this email auto-grants admin/approved |
| `FREE_MESSAGE_LIMIT` | Trial message quota for new users (default 10) |
| `AWS_*`, `S3_BUCKET_NAME` | Media uploads |
| `SMTP_*`, `EMAIL_FROM` | Password-reset emails |
| `FRONTEND_URL` | This app's own public URL - used to build reset-password links |
| `RESET_TOKEN_EXPIRY_MINUTES` | Password-reset link lifetime (default 15) |
| `AI_SUGGESTIONS_ENABLED` | Hard kill switch for all Gemini calls |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | AI predictive typing/smart replies |
| `ARCHIVE_*` | Message-archiving cron schedule/batch size |

## 8. MongoDB setup

Any MongoDB 5+ instance works - local `mongod` for development, MongoDB
Atlas for production (a free-tier cluster is enough to start). Put the
connection string in `MONGODB_URI`. Indexes are declared in the Mongoose
schemas and created automatically on first connection.

If you have existing users from before the approval/trial system existed,
run `npm run migrate:approval` once against that database - it grandfathers
existing users in as fully approved instead of dropping them into the new
trial flow. Fresh databases don't need this.

## 9. AWS S3 setup

Create a bucket, an IAM user with `PutObject`/`GetObject` permissions scoped
to that bucket, and set `AWS_REGION`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`. Without these set, media upload
requests will fail with a clear error - everything else in the app still works.

## 10. Nodemailer setup

Default config targets Gmail SMTP (`smtp.gmail.com:587`). Gmail requires a
**Google App Password** (Google Account → Security → 2-Step Verification →
App Passwords, with 2FA enabled) in `SMTP_PASS` - a normal Gmail password is
rejected. Without SMTP configured, forgot-password requests still return a
generic success response (never leaking whether an email exists) but no
email is actually sent - logged server-side, not surfaced to the user.

## 11. Gemini setup

Set `GEMINI_API_KEY` and `AI_SUGGESTIONS_ENABLED=true`. `GEMINI_MODEL`
defaults to `gemini-3.5-flash-lite`. With the kill switch off (the default),
zero Gemini requests are made regardless of anything else. Retries with
backoff handle 429/503 automatically; AI failures never break chat itself.

## 12. Admin configuration

Set `ADMIN_EMAIL` before anyone signs up with that address - that signup
automatically becomes `role: "admin"`, fully approved, unlimited everything.
Admin status can never be granted from the frontend; it's decided purely by
matching this env var at signup time, server-side. The admin dashboard lives
at `/admin` and redirects non-admin users away.

## 13. Free-trial / approval flow

A new signup starts `role: "user"`, `approvalStatus: "pending"`,
`trialMessageCount: 0`. Every personal message, group message, and media
upload increments that counter against `FREE_MESSAGE_LIMIT` (default 10) -
one shared quota, not per-conversation. Once exhausted, the user can still:
view existing chats, receive incoming messages, update their profile, and
message the admin directly with no limit. Everything else (new personal
chats, group messages, joining/creating groups, AI) requires admin approval.
All of this is enforced server-side - the frontend UI reflects it, but never
decides it.

## 14. Personal chat

Room IDs are deterministic: both participants' emails are lowercased,
sorted, and joined with `::`, so it's identical regardless of who starts the
conversation. The frontend computes the same ID client-side to request a
join; the server independently re-derives and validates it before allowing
access.

## 15. Group chat

Any approved/admin user can create a group and add other approved/admin
users as members (a pending user needing approval can't be added, and can't
create or join a group themselves). Group admins - the creator plus anyone
promoted - manage members, settings, and the group photo; the creator can
never be removed or demoted by someone else.

## 16. Online/last seen

Presence updates broadcast only to actual contacts (people you've messaged
or share a group with), not globally. A user with `lastSeenPrivacy: "nobody"`
shows neither online status nor last-seen time to anyone else.

## 17. Delivery/read receipts

Every socket auto-joins all of its rooms on connect (not just whichever one
the UI has open), so delivery can be marked the instant a message reaches a
connected client - independent of whether that chat is actively open.
Read receipts fire when a room is opened or a message arrives while it's
already open. Group receipts use the same delivered/read arrays as personal
chats (an aggregate state), not a detailed per-member read list.

## 18. Cursor pagination

Message history loads 50 at a time, newest page first, using a timestamp
cursor - never offset-based, so it stays fast and correct no matter how much
history a room accumulates. Scrolling to the top of a chat loads the next
older page and preserves scroll position.

## 19. Archiving

A cron job (`ARCHIVE_CRON_SCHEDULE`, default nightly) moves messages older
than `ARCHIVE_AFTER_HOURS` into a separate `ArchivedChat` collection, keeping
the active `Message` collection lightweight. Message history views
transparently merge both collections, so archived history is never lost
from the user's perspective.

## 20. Deployment on Render

`render.yaml` defines one web service - build command
`npm install && npm run build`, start command `npm run start`. Set every
`sync: false` variable in the Render dashboard (Mongo URI, AWS/SMTP
credentials, admin email, etc.) before or after the first deploy. `PORT` is
provided by Render automatically. `FRONTEND_URL` should be set to this
service's own Render URL once you know it - it's used for password-reset
email links.

Because this is one unified service, there is no second frontend deployment
and no CORS configuration to manage - a real simplification versus a
split frontend/backend deployment.

## 21. Security notes

- All approval/trial/role checks are enforced server-side and re-read from
  the database on every request - the frontend's UI state is never trusted.
- Passwords are bcrypt-hashed; reset tokens are stored only as a SHA-256
  hash with a TTL index for automatic expiry.
- Forgot-password never reveals whether an email is registered, and is
  rate-limited (5 requests per 15 minutes per IP+email).
- Admin status can only be granted by matching `ADMIN_EMAIL` at signup - never
  from client input.
- File uploads are validated by type and size before reaching S3.

## 22. Future improvements

- Detailed per-member group read receipts (currently an aggregate state)
- Push notifications for messages received while the app isn't open
- Rich text / message editing and deletion
- A Redis-backed rate limiter if this ever runs across multiple instances

---

See `docs/CHANGELOG-phase*.md` for the detailed history and assumptions
behind each phase, and `docs/TESTING.md` for a testing checklist.
