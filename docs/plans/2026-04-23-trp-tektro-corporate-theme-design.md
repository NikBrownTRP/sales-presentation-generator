# TRP / Tektro Corporate — Third Presentation Theme

**Date:** 2026-04-23
**Status:** Design approved. Ready for implementation plan.
**Mockup:** `docs/plans/corporate-theme-mockup.html`

## Purpose

Add a third presentation theme for company-wide business decks that represent both brands (TRP and Tektro) under the parent company. The existing two themes cover brand-specific decks:

- `trp-dark` — performance/racing, black background, red accents
- `tektro-light` — editorial/monochrome, white background

The new `trp-tektro-corporate` theme targets executive and partner business presentations where the combined company — not either brand alone — is the subject. It inherits Tektro Light's calm editorial structure and formalizes it further: warmer neutrals, a single charcoal accent doing all structural work, and a three-color brand micro-signature in the footer.

No new slide types are introduced. All existing templates (`title`, `product`, `gallery`, `spec`, `generic`, `graph`, `spotlight`) render under the new theme via CSS variables and a small number of theme-scoped overrides.

## Design Tokens

```
--pres-bg:              #FAF8F4   /* warm off-white */
--pres-bg-alt:          #F4F1EB
--pres-bg-surface:      #EDE9E1
--pres-text:            #1A1A1A   /* charcoal, never pure black */
--pres-text-secondary:  #5E5E5E
--pres-text-muted:      #999999
--pres-accent:          #2A2A2A   /* deep charcoal — all chrome */
--pres-accent-light:    #4A4A4A
--pres-accent-secondary:#5E5E5E
--pres-accent-tertiary: #FFDF00   /* reserved for micro-mark only */
--pres-chart-color:     #2A2A2A
--pres-border:          #D8D4CC   /* warm hairline */
--pres-font-heading:    'Manrope', sans-serif
--pres-font-body:       'Inter', sans-serif
--pres-heading-weight:  700
--pres-heading-transform: none
--pres-heading-tracking: -0.02em
--pres-corner-size:     0px       /* no L-corner decorations */
--pres-corner-weight:   1px
--pres-accent-bar-height: 2px
--pres-underline-height:  2px
--pres-radius:          6px
```

Rationale:

- Warm off-white (`#FAF8F4`) differentiates the theme from Tektro Light's pure white and reads distinctly more formal — annual-report / investor-deck register.
- Single charcoal accent keeps every slide calm; color is reserved for the brand-signature micro-marks only.
- No L-shaped corner decorations (unlike TRP Dark) and no carbon-fiber texture — the theme avoids all decorative chrome.
- 6px radius matches Tektro Light; consistent with "editorial" lineage.

## The Brand Signature Micro-Marks

Three 7×7px solid squares, 3px apart, placed in the slide footer immediately right of the combined logo. Order (left → right):

1. `#FFDF00` — Tektro yellow
2. `#DE2A2A` — TRP racing red
3. `#1E2D7D` — TRP brand blue (exact value from trpcycling.com announcement bar)

This is the only color on every slide. The three marks together signal "parent company, both brands" without dominating composition. They appear on every slide via the footer.

## Default Assets

When a slide is created with the corporate theme:

- `logo` field defaults to `assets/Logo TRP Tektro Small.png`
- `brandLine` field defaults to a corporate phrasing (e.g. `"Performance — Quality — Integrity"` — final string TBD during implementation; placeholder can be refined).

Existing logo-swap logic in `js/app.js` (the block around app.js:94 and app.js:402) must extend to recognize the new theme so that switching in/out of it rewrites default logos and brandlines correctly.

## Scope of CSS Changes

A new `[data-theme="trp-tektro-corporate"]` block at the top of `css/slides.css`, parallel to the existing `trp-dark` and `tektro-light` blocks. It defines the token values above.

Additional theme-scoped rules are expected in three places:

1. **Footer micro-marks** — new markup in the footer for every template, or a generated-by-JS footer element (decision in implementation plan). Must render identically across all 7 templates.
2. **Animations** — new `[data-theme="trp-tektro-corporate"] .pres-slide--animated ...` block mirroring the tektro-light animations (starts from the Tektro Light set, which is already well-tuned for this calm register).
3. **Corner hiding** — the existing `.pres-corner` hide rule for `tektro-light` must extend to the corporate theme.

## Scope of JS / HTML Changes

1. **Theme toggle buttons** — two places in `js/app.js` gain a third button:
   - Per-slide theme toggle (app.js:386-387 area)
   - Template-picker modal theme selector (app.js:1106-1107 area)
   Label: `"Corporate"`. Value: `"trp-tektro-corporate"`.
2. **Default data filler** (app.js:94-99 area) — recognize the new theme and select the correct default logo / brandLine.
3. **Theme-swap on toggle** (app.js:400-413 area) — when switching *from* or *to* the corporate theme, swap logo and brandline if they match the prior theme's defaults.
4. **Theme-color meta** and any `<meta name="theme-color">` or similar references in `index.html` remain TRP-dark biased; no change needed, but worth verifying.
5. **Footer micro-mark markup** — added once in the base template rendering (likely in `js/templates.js` where the slide shell is generated). Visible for all themes; position fixed in the footer. Each theme can choose whether to show it — for `trp-tektro-corporate` it is visible; for `trp-dark` and `tektro-light` it is hidden via CSS to avoid visual change to existing themes.

   Alternative: render only under the corporate theme via `[data-theme="trp-tektro-corporate"] .pres-micro-marks { display: flex; }`, hidden by default.

## Out of Scope

- New slide types or templates
- Changes to `trp-dark` or `tektro-light` visuals
- Changes to exporter output beyond the CSS the new theme injects
- PPTX import mappings for the new theme (existing mappings are template-based, not theme-based, so they continue to work)
- Stitch design-system registration (the earlier Stitch MCP calls failed; not blocking — `css/slides.css` is the source of truth)

## Testing Notes

- Verify all 7 slide templates render correctly under the new theme in the live preview.
- Verify theme switching (all 3 pairwise directions) preserves user content and swaps default logo/brandline correctly.
- Run `./build-css.sh` after CSS edits so the embedded styles in `index.html` used by HTML export stay in sync.
- Open an exported HTML presentation and confirm the three micro-marks render in the footer of every slide under the corporate theme.
- Confirm the micro-marks are invisible under the two existing themes.

## Accepted Direction Summary

Option **B + C2** with three-color micro-mark variation: warm-neutral editorial base, single charcoal accent, and a three-square brand signature (yellow / red / blue) in the footer. Confirmed by the mockup at `docs/plans/corporate-theme-mockup.html`.
