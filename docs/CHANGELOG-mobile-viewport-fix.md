# Fix: Mobile Keyboard/Viewport Behavior

Both symptoms you screenshotted - the message box hidden behind the
keyboard, and the contact name disappearing when scrolling - trace back to
the same root cause: `100vh` does not reliably track the *actual* visible
viewport on mobile. It's based on the largest possible viewport (address
bar collapsed), so whenever the address bar is showing or the on-screen
keyboard is open, a `100vh` container is taller than what's actually
visible on screen.

## Two-part fix

**1. `interactive-widget=resizes-content` (`app/layout.js`)**

Chrome on Android defaults to *overlaying* the keyboard on top of the page
without resizing the layout viewport - so nothing sized with `vh` shrinks
when the keyboard opens, and the input box ends up underneath it. This
viewport meta setting forces the classic/expected behavior: the visible
viewport actually shrinks when the keyboard opens, which the next fix can
then correctly respond to.

**2. `100dvh` instead of `100vh` (`app/globals.css`)**

`dvh` (dynamic viewport height) continuously tracks the current visible
viewport rather than the largest possible one - so it correctly shrinks for
both the keyboard and the address bar showing/hiding during scroll.
Applied to every full-viewport-height container: `.chat-shell`,
`.auth-layout`, `.profile-shell`, `.page-loader`. Kept the `vh` line first
in each case as a fallback for the rare browser without `dvh` support - it
just gets overridden by the `dvh` line wherever that's supported.

This is what fixes the disappearing header too: previously, when the actual
visible viewport was smaller than the `100vh` the layout assumed, the whole
`.chat-shell` (including the header) was taller than the screen, so the
outer page itself became scrollable and dragged the header out of view
along with the messages. With `.chat-shell` now correctly sized to the real
viewport at all times, only the intended inner region (`.messages-scroll`)
scrolls.

## Defensive additions (belt-and-suspenders, not the core fix)

- `.chat-header { position: sticky; top: 0; }` - pinned regardless
- `flex-shrink: 0` added to `.chat-header`, `.trial-banner`, and
  `.message-input-row` - so none of them can get squeezed to nothing by the
  surrounding flex column under any circumstance
- `-webkit-overflow-scrolling: touch` on the two scrollable regions
  (messages, sidebar list) for smoother iOS momentum scrolling

## What I verified

- Clean `next build`
- Confirmed in the raw served HTML: the viewport meta tag now reads
  `interactive-widget=resizes-content`
- Confirmed in the compiled CSS: `.chat-shell` carries both the `100vh`
  fallback and the `100dvh` override; `.chat-header` is `position: sticky`
  with the `-webkit-` prefix included automatically
- I have no real mobile device or touchscreen emulation in this sandbox, so
  I could not reproduce your exact scenario (Android Chrome, keyboard open,
  scrolling a long conversation) to confirm visually - please retest both
  scenarios from your screenshots and let me know
