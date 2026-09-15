# Phase 12: Visual Design Pass

## Design plan

**Concept**: chat is about continuous conversation. Instead of a literal
WhatsApp clone, the design leans on that idea directly - a message that
continues the same sender's turn visually softens into the previous one
(corner-radius continuation) rather than floating as an identical separate
card each time.

**Color** (deliberately avoiding the common cream+terracotta and
near-black+neon AI-design defaults):
- `--ink` `#14232b` - deep teal-slate for chrome/sidebar (not pure black)
- `--canvas` `#eef2f1` - cool pale seafoam-grey for the chat surface (not warm cream)
- `--panel` `#ffffff` - cards, bubbles, inputs
- `--accent` `#c98a2c` - warm ochre/amber, yellow-leaning (distinct from terracotta's red-orange)
- `--accent-deep` `#a66b1e` - hover/pressed state
- `--line` `#dce3e0` - hairline borders (used instead of drop shadows on most surfaces)

**Type**: two clearly distinct families. Fraunces (a characterful serif)
appears only in personality moments - auth screen headlines, empty states,
modal titles. Inter (clean sans) handles all dense UI: chat text, forms,
buttons, labels. Personality lives in a few specific places, not everywhere.

**Layout**: auth pages moved from a generic centered floating card (a SaaS
template default) to a two-pane split - an ink-colored brand panel with a
serif headline and a few decorative "ghost" message bubbles as texture, and
the actual form on the canvas side. Stacks vertically on mobile.

## Self-critique against common AI-design tells

1. Cream + terracotta - avoided (seafoam canvas, ochre accent, not cream/red-orange)
2. Near-black + neon - avoided (ink is deep teal-slate, accent is warm and muted)
3. Broadsheet serif - avoided (serif used sparingly, sans dominates)
4. Uniform SaaS-card kit (same radius/shadow everywhere) - avoided by using a
   deliberate two-value radius scale (8px inputs/buttons, 14px cards) plus a
   genuinely different asymmetric radius for message bubbles specifically,
   and hairline borders instead of drop shadows on most surfaces
5. Template chrome (ALL-CAPS eyebrows, middot meta strings, arrow-suffixed
   buttons) - avoided; all button copy is a plain verb ("Log in", "Send
   reset link", "Save profile")

## What changed

- `app/globals.css` - full token/rule rewrite (new palette, two-value radius
  scale, asymmetric message bubbles, two-pane auth layout, corner-continuation
  cue for grouped messages)
- `app/layout.js` - loads Inter + Fraunces via a standard `<link>` tag
  (not `next/font/google`) so the build has no build-time network dependency
  and works in any hosting/CI environment without extra configuration
- `components/common/AuthLayout.js` (new) - the two-pane brand/form split,
  used by all four auth pages
- `components/chat/ChatWindow.js` - computes message grouping (same sender,
  within 5 minutes of the previous message) and passes it down
- `components/chat/MessageBubble.js` - applies the corner-continuation cue
  for grouped messages and suppresses the repeated sender-name label in groups

## What I verified

- Clean `next build`, all 9 routes return 200 in production mode
- Confirmed the new color tokens (`--accent:#c98a2c`, etc.) actually made it
  into the compiled CSS output
- Confirmed the Google Fonts `<link>` tag renders in the page HTML
- I don't have a browser in this sandbox to take a screenshot and visually
  self-critique the result directly - please look it over yourself and tell
  me if anything reads wrong (spacing, contrast, the bubble corner treatment)
  and I'll adjust
