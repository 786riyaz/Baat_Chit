# Fix: Remaining Theme Mismatch, Tab-Level Unread Badges

## Theme mismatch on two text boxes

Same root pattern as the earlier `<select>` fix: two inputs were never
wrapped in the app's themed `.field` class, so they fell back to the
browser's native white-background styling regardless of the app's theme.

- The "Add member by email" input in `GroupSettingsModal` had no styling
  at all - not even the base theme.
- The "Search name, email, or phone" input on the admin dashboard had an
  ad-hoc inline style that set padding/border but never background or
  text color.

Both fixed by wrapping them in `<div className="field">`, the same
approach every other themed input in the app already uses, rather than
patching in one-off inline styles. Also swept the rest of the codebase for
the same pattern (any `<input>` with its own inline `style`) and confirmed
nothing else has it.

## Tab-level unread indicators

Unread badges previously only showed on individual chat/group rows - if
you were on the Chats tab, there was no way to tell a group had an unread
message without switching tabs. Added a count badge directly on the
"Chats" and "Groups" tab buttons themselves, summing the unread counts of
everything in that tab. Same visual style as the per-row badges, just
positioned inline next to the tab label.

## What I verified

- Clean `next build`, all routes return 200 in production mode
- Confirmed in the compiled CSS: the tab-badge positioning rule, and that
  both fixed inputs now resolve to the same themed `.field input` rule as
  everything else
- Grepped the whole codebase for any other inline-styled `<input>` -
  nothing else found
- Could not visually confirm the search box and add-member box now render
  correctly, or that the tab badge counts and positioning look right -
  please take a look
