# Fix: Dark Theme Text/Background Contrast

## Root cause

`--ink-soft` (`#1f373f`, a dark navy) was designed to stay **constant**
across both themes, alongside `--ink` and `--accent` - the brand-chrome
group, meant for things that always sit on the permanently-dark sidebar and
auth brand-pane. That was fine when it was defined.

But it had leaked into six places that do **not** sit on constant-dark
surfaces - form labels, the "back to chat" link, AI suggestion chips, the
chat empty-state headline, and two icon buttons - all of which live on
`var(--panel)`/`var(--canvas)`, surfaces that flip between light and dark
with the theme toggle. In dark mode, that's dark navy text on a dark
background: exactly the near-invisible text in your screenshots (the
"← Back to chat" link, the AI suggestion chips, and - the most disruptive
one - every form label on the profile page).

## Fix

All six replaced with `var(--text-muted)`, which is the token that's
actually theme-aware (dark mode: light grey-green `#93a29c`; light mode:
dark grey `#647169`) and is the semantically correct choice for
secondary/muted text in every one of these spots anyway.

## Second bug: the "Last seen visibility" dropdown

That white box in your screenshot wasn't a color mismatch so much as **no
styling at all** - the global `input, textarea, select` rule only set
`font-family`/`font-size`, and the themed `.field input, .field textarea`
rule never included `select`. So the dropdown fell back to the browser's
native OS-styled rendering (white background, black text) regardless of
the app's theme. Added `select` to the themed field rule and removed the
ad-hoc inline style in `ProfileDetailsForm.js` that was fighting it.

## What I verified

- Clean `next build`
- Confirmed in the compiled production CSS: `.ai-chip`, `.back-link`,
  `.field label`, `.chat-empty-state .headline`, `.attach-btn`, and
  `.back-to-list` all now resolve to `var(--text-muted)` instead of
  `var(--ink-soft)`
- Confirmed `.field select` now carries the same themed background/border/
  color as `.field input`
- Re-audited every remaining hardcoded hex color in the stylesheet -
  everything left is intentionally on the constant-dark sidebar/brand-pane
  or on the accent-colored buttons, where a fixed light color is correct
  regardless of theme
- Could not screenshot the result myself to confirm visually - please
  check both the profile page and an active chat with AI suggestions
  showing
