# Admin Chat Always Pinned to Top

## Backend

New endpoint: `GET /api/admin-contact` - authenticated, callable by any
user (not admin-only access, just admin-related data). Looks up the user
matching `ADMIN_EMAIL`, confirms their role is actually `admin`, and
returns their basic public info + presence. Returns `admin: null` if
`ADMIN_EMAIL` isn't configured or that account hasn't signed up yet, so the
frontend degrades gracefully rather than erroring.

## Frontend

`app/chat/page.js` fetches the admin contact once on load (skipped
entirely if the logged-in user *is* the admin - they can't message
themselves) and merges it into the personal-chats list via a memoized
`displayPersonalChats`:

- If there's no real conversation with the admin yet, a synthesized pinned
  entry is placed at the top with 0 unread - this is what makes it work
  for a brand-new user who has never sent a message and doesn't know the
  admin's email.
- If a real conversation already exists, that entry is promoted to the top
  and marked pinned instead of creating a duplicate - its real unread count
  and last-message time are preserved, not reset.
- The admin's presence (online/last seen) is kept live via the existing
  presence socket handler, whether the entry is synthesized or real.

Visually: the pinned row gets a small "Admin" tag next to the name and a
pin icon, so it's clear why this contact is always there rather than
looking like an unexplained duplicate.

## What I verified

- Clean `next build`, all routes 200 in production mode
- Confirmed `/api/admin-contact` is properly auth-gated (401 without a
  token) and the new CSS compiled correctly
- Unit-tested the merge logic standalone across all four scenarios: brand
  new user with zero history, user with other chats but no admin history,
  user with an existing admin conversation (unread count correctly
  preserved, not duplicated or reset), and confirmed the admin's own
  account never sees a pinned entry for themselves
- Could not click through the actual pinned tile, confirm it opens a
  working chat with zero prior history, or watch the presence dot update
  live - please confirm with a fresh test account
