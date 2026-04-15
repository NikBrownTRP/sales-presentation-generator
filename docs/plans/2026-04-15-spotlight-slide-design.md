# Spotlight Slide Template — Design

## Context
The existing slide templates (Title, Product, Spec, Generic, Gallery, Graph, Chart) are intentionally conservative — they're built for sales decks that need a steady, structured look. Sometimes the deck needs a single slide that hits hard: an emotional, product-focused highlight in the style of an Apple keynote. This template fills that gap without disturbing the rest of the system.

Reference: Apple's "A big zoom forward" Cameras slide — black canvas, centered kicker + headline, dominant hero product image, side-column stat callouts.

## Template Identity

- **ID:** `spotlight`
- **Name:** "Spotlight"
- **Description:** "Emotional, product-focused highlight slide with hero image and stat callouts."

## Form Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `kicker` | text | no | Small accent label at the very top (e.g. "Cameras") |
| `headline` | text | **yes** | Large bold title (e.g. "A big zoom forward.") |
| `productImage` | image | no | Hero image; reuses existing image editor + bg-color picker |
| `imageMode` | select | no | `contained` (default) / `bleed` |
| `layoutMode` | select | no | `image-left` (default) / `image-right` |
| `stat1Label` / `stat1Value` / `stat1Caption` | text × 3 | no | Slot 1 — only renders if `stat1Value` filled |
| `stat2Label` / `stat2Value` / `stat2Caption` | text × 3 | no | Slot 2 |
| `stat3Label` / `stat3Value` / `stat3Caption` | text × 3 | no | Slot 3 |
| `logo` | image | no | Footer logo, uses existing `renderSlideLogo` helper |

## Layout

Slide canvas: 960 × 540.

```
┌──────────────────────────────────────────────────────────────┐
│                        Cameras  ← kicker (accent, sm)        │
│                A big zoom forward. ← headline (huge, white)  │
│                                                              │
│   ┌─────────────────────┐               ┌────────────────┐   │
│   │   HERO IMAGE        │               │ Up to          │   │
│   │   contained / bleed │               │ 8x  ← accent   │   │
│   │                     │               │ optical-zoom   │   │
│   │                     │               │                │   │
│   │                     │               │ All            │   │
│   └─────────────────────┘               │ 48MP ← accent  │   │
│                                         │ rear cameras   │   │
│                                         └────────────────┘   │
│                                                          [▣] │
└──────────────────────────────────────────────────────────────┘
```

`layoutMode: image-right` swaps image and stats horizontally.
`imageMode: bleed` makes the image larger than its container with negative bottom-margin so it visibly crops against the slide edge (Apple-style).

## Theme Behavior

`.pres-slide--spotlight` always uses `background: #000`. Accent color (kicker text + stat numbers) inherits from the theme via the existing `--brand-accent` CSS variable:
- TRP theme → red (`#E31837`)
- Tektro theme → yellow

No theme-specific CSS is needed for the slide itself.

## Typography

| Element | Font | Weight | Size | Color |
|---|---|---|---|---|
| Kicker | Manrope | 600 | 14px (letter-spacing +1px) | accent |
| Headline | Montserrat | 800 | 56–64px (letter-spacing −1px) | white |
| Stat label | Inter | 500 | 14px | white 60% |
| Stat value | Montserrat | 800 | 48px | accent |
| Stat caption | Inter | 400 | 13px | white 60% |

All fonts already loaded by `index.html`.

## Files Touched

1. `js/templates.js` — add `spotlight` template object (fields + render + icon SVG)
2. `css/slides.css` — add `.pres-slide--spotlight` block (~80 lines)
3. `build-css.sh` — must re-run to embed updated slides.css into index.html (per `feedback_build_css.md`)
4. `index.html` — cache-bust bump v17 → v18 (and the embedded CSS string is updated by build-css.sh)

No controller.js changes (uses existing `text` and `select` field types).

## Verification

1. Reload preview → "Add slide" → "Spotlight" appears in template picker.
2. Add a Spotlight slide on a TRP-themed deck → kicker + stat numbers render red.
3. Switch the slide to Tektro theme → same renders in yellow.
4. Toggle `imageMode: bleed` → image visibly extends past bottom-left edge.
5. Toggle `layoutMode: image-right` → image and stats swap sides.
6. Fill 1 / 2 / 3 stats → only filled stats render, vertically stacked.
7. Export to HTML → spotlight slide renders identically (CSS embedded via build-css.sh).
