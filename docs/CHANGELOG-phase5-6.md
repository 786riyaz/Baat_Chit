# Phase 5–6: Profile Management + Forgot/Reset Password

## What changed

**New files**
- `models/PasswordReset.js` — reset tokens; only a SHA-256 hash is ever stored, and a
  MongoDB TTL index auto-deletes expired records
- `config/mail.js` — Nodemailer transporter (Gmail SMTP by default)
- `services/mailService.js` — builds and sends the reset email
- `middleware/uploadAvatar.js` — dedicated multer config for profile photos (images only, 5MB)
- `utils/rateLimiter.js` — minimal in-memory limiter, used on forgot-password

**Modified files**
- `models/User.js` — added `profilePhoto`, `bio`, `lastSeenPrivacy`
- `services/s3.js` — `uploadMedia(file, folder)` now takes an optional folder prefix
  (avatars go to `avatars/...`, chat media still defaults to `chat-media/...`, fully
  backward compatible)
- `services/approvalService.js` — `sanitizePublicUser` now includes the new profile fields
- `server.js` — new routes below; the shared upload-error handler was generalized to also
  handle avatar-upload errors

## New API endpoints

```
POST /api/auth/forgot-password   -> public, rate-limited (5 per 15 min per IP+email)
POST /api/auth/reset-password    -> public
PUT  /api/users/me                -> update name/phone/bio/lastSeenPrivacy/password
PUT  /api/users/me/profile-photo  -> multipart "photo" field, uploads to S3
```

## Key design decisions

- **Forgot-password never reveals whether an email is registered.** It always returns the
  same generic success message, whether the account exists or not — standard anti-enumeration
  practice, and consistent with your security section (27).
- **Reset tokens**: a random 256-bit token is emailed to the user; only its SHA-256 hash is
  stored in Mongo. Requesting a new reset invalidates any previous outstanding token for that
  user, and a successful reset invalidates all tokens for that user (matches your spec exactly).
  Expiry defaults to 15 minutes via `RESET_TOKEN_EXPIRY_MINUTES`.
- **Password change on `/api/users/me`** requires `currentPassword` + `newPassword` together —
  you can't silently change a password without proving you know the current one.
- **Phone uniqueness** is re-validated on update, same as at signup.
- **Rate limiting** is in-memory and per-process — fine for a single Render instance; if you
  ever scale to multiple instances, swap it for a Redis-backed limiter (noted in the file).

## What I verified (no live SMTP or MongoDB available in this sandbox)

- `node --check` passes on every new/modified file; full project boots cleanly.
- Ran the actual server against curl with no live DB:
  - `forgot-password` correctly falls back to the generic success response when the DB is
    unreachable (never leaks an error to the client)
  - missing-email and short-password validation return the correct 400s *before* touching the DB
  - the rate limiter fired exactly on the 6th request in a 15-minute window (limit is 5) —
    got `200 200 200 200 200 429`
  - `PUT /api/users/me`, `PUT /api/users/me/profile-photo`, `GET /api/users/me` all correctly
    return 401 without a token
- Unit-tested the token hashing (deterministic, collision-free) and expiry math standalone.
- **Not verified**: an actual email arriving in an inbox, and the full update-profile /
  upload-photo happy path against a real user record — both need a live MongoDB + real SMTP
  credentials, neither of which exist in this sandbox. Please run these before calling it
  production-verified:
  1. `npm run migrate:approval` isn't needed again (only for the Phase 1-4 schema change)
  2. Sign up a test user, call `POST /api/auth/forgot-password`, confirm the email arrives
     and the link works within 15 minutes and is rejected after
  3. `PUT /api/users/me` with a valid token — update name/bio, then change password and
     confirm you can log in with the new one
  4. `PUT /api/users/me/profile-photo` with a real image file — confirm `profilePhoto` URL
     is saved and loads from S3

## Reminder: Gmail SMTP setup

`SMTP_PASS` must be a Google **App Password** (Google Account → Security → 2-Step
Verification → App Passwords), not your normal Gmail password — Google rejects plain
password SMTP auth. Once you have it, just drop it into `.env`.

## Not in this phase

Admin dashboard UI, presence/last-seen, delivery/read receipts, cursor pagination, Next.js
migration, WhatsApp-style UI — still coming per your phase ordering.
