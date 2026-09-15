# Loading Skeletons + Rate Limiting

Good to hear S3, Gemini, Nodemailer, and the Render deployment are all
solid - just these two additions this round.

## Loading skeletons

- `components/chat/SidebarSkeleton.js` (new) - pulsing placeholder rows,
  shown in the sidebar while the initial personal-chats/groups fetch is in
  flight. Only shows on first load, not on background refreshes.
- `components/chat/MessagesSkeleton.js` (new) - a handful of pulsing bubble
  shapes at varied widths/sides, shown while a chat's history is loading
  (from the moment you tap a conversation until `join_room` resolves).
- Both use a shared `.skeleton` CSS class (theme-aware, uses `var(--line)`
  so it looks right in both dark and light mode) with a simple opacity-pulse
  animation - no new dependencies.

## Rate limiting

Previously only `forgot-password` had any rate limiting. Added two more
layers in `server.js`:

- **General API limiter**: 120 requests/minute per IP, applied to every
  `/api/*` route. Generous enough not to bother real usage, tight enough to
  blunt scripted abuse.
- **Auth limiter**: 20 attempts per 15 minutes per IP, applied to both
  `/api/signup` and `/api/login` together (shared bucket) - slows down
  credential-stuffing and spam signups specifically.

**Also fixed a real production correctness issue while adding this**: since
the app runs behind Render's reverse proxy, `req.ip` would return the
*proxy's* IP for every request, not the real client's - which would have
made the new general limiter effectively rate-limit your entire user base
as a single shared bucket instead of per-visitor. Added
`app.set("trust proxy", 1)` so Express reads the real client IP from
`X-Forwarded-For`. This also retroactively makes the existing
forgot-password limiter correctly per-client in production, which it
technically wasn't before either.

## What I verified

- Clean `next build`
- Actually exercised the auth rate limiter end-to-end: 20 requests came
  back as expected (400s, since the test requests had no body - that's the
  login handler's own validation, unrelated to rate limiting), and the
  21st and 22nd were correctly blocked with 429
- Confirmed all the skeleton CSS classes compiled into the production
  bundle
- Could not visually confirm the skeleton animation looks right, or trigger
  the rate limiter from a real distributed set of clients - please take a
  look and let me know if the pulse timing/shape feels off
