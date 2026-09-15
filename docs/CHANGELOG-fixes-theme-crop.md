# Fixes: Admin Self-Heal, Theme Toggle, Message-Box Crop

## Admin access self-heals now

`role`/`approvalStatus` were only ever set at signup time based on
`ADMIN_EMAIL`. If that env var is set (or changed) *after* an account
already exists - exactly what happened here - the stored record never
catches up on its own, so the admin dashboard rejects a user who should
have access.

Added `ensureAdminRoleSynced(user)` in `server/services/approvalService.js`:
whenever it's called on a user whose email matches `ADMIN_EMAIL` but whose
stored role/approval isn't already `admin`/`approved`, it fixes the record
in place. Wired into:
- `POST /api/login` - so logging in always reflects the current `ADMIN_EMAIL`
- `requireAdmin` middleware - so `/api/admin/*` (and the `/admin` page) self-heals
  immediately even without a fresh login

This confirmed the diagnosis: the message-to-admin path itself was already
working (it compares the recipient's email directly against `ADMIN_EMAIL`,
not the stored role), which is why messages to the admin were actually
sending despite the confusing banner - only the *dashboard* access was
blocked by the stale role.

## Theme toggle (dark default, persisted)

- `app/globals.css` - tokens restructured: brand chrome (`--ink`, `--accent`)
  stays constant across themes; canvas/panel/text/line/danger/success and a
  new warning pair now live in `:root` (dark, default) with a
  `[data-theme="light"]` override block. Fixed two spots that had hardcoded
  light-only colors (`trial-banner.info`, `trial-pill.pending`) so they now
  follow the theme correctly.
- `hooks/useTheme.js` (new) - `ThemeProvider`/`useTheme`, persists to
  `localStorage` under `chatapp_theme`, defaults to dark.
- `app/layout.js` - a small inline script sets `data-theme` on `<html>`
  before React hydrates, so there's no flash of the wrong theme on load.
- `components/common/ThemeToggle.js` (new) - the toggle button; placed in
  the sidebar (main app) and in the auth brand pane / profile / admin pages
  (surfaces without a sidebar).

## Message input box cropped at the bottom

Real bug, not cosmetic: the flex column wrapping the chat window
(`TrialBanner` + `ChatWindow`, and the underlying `.chat-main`/`.sidebar`
CSS) never set `min-height: 0`. Flex items default to `min-height: auto`,
which means they refuse to shrink below their content's natural height -
so once there was enough message history to exceed the viewport, the whole
column grew taller than `100vh` instead of scrolling internally, pushing
the input row off the bottom of the screen. Fixed by adding `min-height: 0`
to `app/chat/page.js`'s flex wrapper and to `.chat-main`/`.sidebar` in CSS,
so `.messages-scroll` correctly becomes the thing that scrolls, and
everything else stays put.

## What I verified

- Clean `next build`, all 9 routes return 200 in production mode
- Confirmed in the compiled CSS output: the light-theme override block is
  present, and `.chat-main` now includes `min-height:0`
- Confirmed `data-theme="dark"` is present in the raw server-rendered HTML
  (before any JS runs), so dark is genuinely the default with no flash
- Could not click through the actual toggle behavior or resend the crop
  scenario in a live browser - please confirm both now that it's live
