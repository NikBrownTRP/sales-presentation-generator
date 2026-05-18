# Multi-Product Spec Slide — Design

Date: 2026-05-18
Status: Approved (brainstorming phase)

## Goal

Extend the existing Product Spec slide template so a single slide can showcase
1–5 products. Layout must adapt cleanly to the chosen count so the slide always
looks professional and uncluttered, and the editor UX must scale to multiple
products without becoming heavy.

## Summary of decisions

- **One adaptive template** (not a separate "lineup" template). The existing
  `spec` template grows a `productCount` selector (1–5) and a `products` array.
- **Balanced per-product budget** when N ≥ 2: image + name + up to 4 specs +
  up to 3 features. N = 1 keeps today's larger caps (6 specs / 6 features).
- **Layout per N:**
  - N = 1: unchanged (current single-product layout).
  - N = 2: 2-column grid, image on top of each card.
  - N = 3: 3-column row, same card structure as N = 2.
  - N = 4: single row of 4 cards (no wrap). Comparison-friendly.
  - N = 5: row of 3 on top, row of 2 centered below.
- **Editor:** dropdown for `productCount` plus numbered accordion sections
  (Product 1, Product 2, …). Only one section expanded at a time. Lowering the
  count hides extra sections without deleting their data.
- **Data migration:** auto-migrate legacy flat shape
  (`productName`, `productImage`, `specs`, `features`) into `products[0]` with
  `productCount = 1` on load. Idempotent.

## Data model

```
{
  productCount: 1..5,             // new
  slideHeading: string,           // new; rendered only when productCount >= 2
  products: [                     // new; length matches productCount in UI,
    {                             //   but extra entries are kept for undo-friendliness
      name: string,
      image: string,              // data URL or path, as today
      specs: [{key, value}, ...], // capped at 4 when N>=2, 6 when N=1
      features: [{text, indent}]  // capped at 3 when N>=2, 6 when N=1
    },
    ...
  ],
  footnote: string,               // slide-level, unchanged
  logo: string                    // slide-level, unchanged
}
```

Legacy shape (`productName`, `productImage`, `specs`, `features`) is migrated
on load by a helper inside the `spec` template's `render` and the editor's
hydration path.

## Layout (CSS)

Root class drives layout: `.pres-slide--spec.pres-slide--spec-n{1..5}`.
The N = 1 path keeps the existing markup and class hooks, so existing slides
render pixel-identically.

For N ≥ 2 the body is a grid of `.pres-spec-card` elements:

- N = 2: `grid-template-columns: 1fr 1fr;`
- N = 3: `grid-template-columns: repeat(3, 1fr);`
- N = 4: `grid-template-columns: repeat(4, 1fr);` (single row, condensed type)
- N = 5: top row `repeat(3, 1fr)`, bottom row `repeat(2, 1fr)` centered
  (implemented with two grid rows or a nested grid).

Each card:

- Optional thin accent bar at top (theme `--pres-accent`).
- Product image at the top, fixed aspect ratio so all card images align.
- Product name in heading font + thin underline.
- Compact spec table (4 rows max), light row dividers.
- Features list (3 items max) using the existing check icon.

Slide chrome (top `.pres-accent-bar`, footnote, logo) stays slide-level.
Optional slide heading is rendered above the card grid when N ≥ 2.

Visual caps are enforced both in the editor (max-item caps) and as a CSS
safety net (`tr:nth-child(n+5) { display: none; }` on `.pres-spec-card`).

## Editor UX

In `js/templates.js`, the `spec` template `fields` becomes:

1. `productCount` — `select`, options 1–5, default 1.
2. `slideHeading` — `text`, shown only when `productCount >= 2`.
3. `products` — new `group-list` field. Renders one collapsible section per
   product, numbered "Product 1"…"Product N". Each section contains:
   - `name` (text, required)
   - `image` (image)
   - `specs` (keyvalue, max 4 / 6 depending on N)
   - `features` (list, max 3 / 6 depending on N)
4. `footnote` — text, unchanged.
5. `logo` — image, unchanged.

Behavior:

- Only one product section expanded at a time.
- Changing `productCount` re-renders the form: hidden sections are not
  destroyed, so going 3 → 2 → 3 preserves Product 3's content.
- The slide thumbnail and template icon are unchanged.

This requires extending `js/editor.js` (or wherever fields are rendered) with:

- A new `group-list` field type — an array of objects, each rendered as a
  collapsible group of nested fields.
- Conditional field visibility based on another field's value (used for
  `slideHeading`).

## Rendering

`spec.render(data)` pseudocode:

```
migrate(data)                          // legacy flat -> products[0]
n = clamp(data.productCount || data.products?.length || 1, 1, 5)

if (n === 1):
  render current single-product layout from data.products[0]
else:
  open .pres-slide--spec.pres-slide--spec--multi.pres-slide--spec-n{n}
  render optional slideHeading + underline
  for i in 0..n-1:
    renderProductCard(data.products[i])
  render footnote
  render logo
```

## Files touched

- `js/templates.js` — migration helper, updated `spec.fields`, updated
  `spec.render`, new `renderProductCard` helper.
- `js/editor.js` (or equivalent renderer) — `group-list` field type, plus
  conditional visibility hook for `slideHeading`.
- `css/slides.css` — new selectors:
  - `.pres-slide--spec--multi`
  - `.pres-slide--spec-n2`…`.pres-slide--spec-n5`
  - `.pres-spec-card` and its sub-selectors
  N = 1 styles untouched.
- `build-css.sh` — re-run after CSS edits to re-embed `slides.css` into
  `index.html` for HTML export.

## Testing

Manual via the in-browser preview:

- Create a new Product Spec slide. Cycle `productCount` through 1..5 and
  verify the layout for each.
- Verify in each theme: TRP Dark, Tektro Light, TRP/Tektro Corporate.
- Open a legacy presentation with single-product spec slides and verify
  migration: slide still renders identically; editor shows the data inside
  Product 1 with `productCount = 1`.
- Reduce count from 3 to 2 and back; verify Product 3 data is retained.
- Export to HTML and confirm `slides.css` is embedded (build-css.sh).

## Out of scope

- Per-product footnotes or per-product logos.
- A separate "comparison highlight" feature (e.g. diffing specs across
  products). Could be a follow-up if useful.
- Drag-to-reorder products. Not required for v1.
