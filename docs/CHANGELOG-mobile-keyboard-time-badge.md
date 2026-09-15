# Fix: Keyboard Focus on Send, 12-Hour Time, Badge Reconnect Resync

## Keyboard closing / focus lost when tapping send

Tapping any `<button>` naturally moves focus to that button - that's what
was closing the keyboard, since focus left the textarea the instant you
tapped send. Fixed with the standard pattern for this: `onPointerDown={(e)
=> e.preventDefault()}` on the send button. Preventing the default on
pointerdown (which fires before the focus shift) keeps focus on the
textarea throughout the tap, so the keyboard never closes in the first
place. Also added a fallback `textareaRef.current?.focus()` after sending
completes, as a second safety net.

## 12-hour time format

`toLocaleTimeString` without an explicit `hour12` option falls back to
whatever the device/browser locale defaults to - which is why your
screenshots showed 24-hour times ("18:38") rather than 12-hour. Made it
explicit everywhere so it's consistent regardless of device settings.

While fixing this, noticed the same formatting logic was duplicated between
`Sidebar.js` and `ChatWindow.js` - pulled both into a shared
`utils/time.js` (`formatTime`, `formatLastSeen`) instead of fixing the same
bug in two places.

## Unread badge not updating on mobile

There's no mobile-specific code path anywhere in the badge logic - same
JS, same CSS, same socket events on every device. That points away from a
rendering bug and toward *why the count works on desktop but not mobile
specifically*: mobile browsers aggressively suspend background tabs to
save battery, which can silently drop the WebSocket connection without the
client ever seeing a clean "disconnect" event. Desktop tabs mostly stay
foregrounded, so this doesn't show up there - which matches exactly what
you described (instant on desktop, not on mobile).

Added two resync points in `app/chat/page.js`:
- On every socket `connect` event (fires on reconnect, not just the first
  connect) - refetches the sidebar data, and also re-issues `join_room` for
  whatever chat is currently open. That second part matters on its own: a
  fresh socket connection means the server no longer remembers which room
  you were in, so without this, sending a message after a silent
  reconnect would fail until you reopened the chat.
- On the page's `visibilitychange` event becoming `visible` - an extra
  safety net for the case where the tab goes quiet without Socket.IO's own
  reconnect logic ever noticing.

I'm fairly confident in this diagnosis given there's no other explanation
for a desktop/mobile split with identical code, but I want to be upfront:
if the badge issue persists after this, it would point toward something
device-specific I can't reproduce here (I have no real mobile device or
background-tab suspension testing available in this sandbox) - let me know
and I'll dig further with more specifics (which browser, does it recover
if you switch away from the chat tab and back, etc).

## What I verified

- Clean `next build`
- Ran the actual 12-hour formatting logic standalone, including the
  midnight/noon edge cases (`00:15` → `12:15 AM`, `12:00` → `12:00 PM`) -
  all correct
- Confirmed all routes still boot and return 200 in production mode
- Could not test the pointerdown/keyboard fix or the reconnect behavior on
  a real mobile device - please confirm both
