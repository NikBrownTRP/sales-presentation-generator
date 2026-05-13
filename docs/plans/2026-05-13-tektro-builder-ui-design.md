# Presentation Builder — UI Restyle to Tektro Web Tool Aesthetic

**Date:** 2026-05-13
**Status:** Approved — ready for implementation planning
**Branch:** `ui/tektro-web-look` (to be created)

## Goal

Restyle the Presentation Builder's editor chrome so it looks and feels like the Tektro Web Tool (`/Users/niklasbrown/Desktop/Claude Tools/Tektro Web Tool`). UI-only — no functional changes, no JS changes, no changes to slide content/output.

## Scope

**Modify:**
- `css/builder.css` — full restyle via token swap + sweep
- `index.html` — minimal class/markup adjustments only where needed (e.g. brand mark)

**Do not touch:**
- `css/slides.css` (slide content stays on its current dark Tektro look)
- `js/**` (no behavior changes)
- Slide templates, export pipeline, build scripts

## Decisions

1. **Scope:** Builder chrome only. Slide content (`slides.css`) is unchanged.
2. **Preview panel exception:** Light builder chrome, but the preview stage that frames slides stays dark, so the dark slides feel "at home" (like Figma/Keynote).
3. **Accent:** Fully adopt Tektro Web Tool tokens — slate (`#1F2022`) primary buttons, gold (`#FFCA2B`) for focus rings / active states / highlights. Red `#E31837` no longer appears in the builder chrome; it remains in slide content.

## Tokens (replace current `--builder-*` set)

| Role | Value |
|---|---|
| App bg | `#F7F7F4` |
| Card / panel | `#FFFFFF` |
| Subtle surface / hover | `#F2F2EE` / `#ECECE7` |
| Border / strong | `#E7E7E1` / `#D4D4CD` |
| Text / muted / faint | `#0E0E10` / `#55555F` / `#8E8E98` |
| Primary button | slate `#1F2022`, white text |
| Accent | gold `#FFCA2B`; ring `rgba(255,202,43,0.22)` |
| Danger | `#B73A2A` (text/border), `#FBEBE7` (bg) |
| Font | `'Geist', 'Inter', system-ui, sans-serif` (body), `'Geist Mono'` (mono) |
| Radius | `8px` / `12px` |
| Shadow xs / sm / md | per Tektro tokens.css |

Preview panel keeps a dark surface (warm slate, slightly softer than current `#0A0A0A`).

## Component changes

- **Header:** Tektro nav pattern — sticky, translucent white, `backdrop-filter: blur`, subtle bottom border. Slate "TRP" brand square replaces the red SVG icon. Title input borderless → hover border → gold focus ring.
- **Sidebar (slide list):** light `--bg-subtle` surface; white thumbnails with `--border`. Active slide: 2px gold left-rail + `--gold-tint` background. No more red.
- **Buttons:** match Tektro `.btn` family — default (white + border + xs shadow), primary (slate fill, white text), ghost (transparent, hover to subtle), danger (red text/border, red-tint hover).
- **Editor form:** white surface, light dividers, inputs with `--border` + gold focus ring.
- **Preview panel:** stays dark to frame slides; header label switches to light text on dark.
- **Modals:** lighter overlay (`rgba(15,15,20,0.45)`), white card with `--radius-lg` + soft shadow. Template grid adopts the landing-card hover pattern (lift + shadow + border darken).
- **Slideshow modal:** stays dark (full-screen presentation view). Only nav/close buttons restyled.
- **Misc:** layout toggle, dropdowns, toasts, scrollbars — retokenized, structurally unchanged.

## Execution approach

Token swap + restyle (not a rewrite). Existing `.builder-*` class names stay so the JS keeps working. Two passes:

1. Replace `:root` tokens at the top of `builder.css`; rework foundational rules (body, header, sidebar shell, buttons, inputs, modal shell). Run `build-css.sh` after CSS edits (per memory). Visual-check.
2. Sweep remaining ~1.5k lines for hard-coded color literals; convert to vars. Verify modals, dropdowns, drag/drop, toasts, empty states.

`index.html` edits only where unavoidable (e.g. swapping the red-icon SVG for a slate brand square). No structural changes.

## Verification

- Use `preview_start` + screenshots at each milestone (header, sidebar, editor, modals, slideshow).
- Click through key flows: add slide, reorder, delete, template picker, slideshow open, export buttons hover state. No actual exports — visual only.
- Confirm `slides.css` and slide output unchanged by exporting a deck before & after and diffing (or visually comparing) — slides should be identical.

## Risks

- Hard-coded color literals deep in `builder.css` that the `:root` swap won't catch — sweep required.
- Contrast on the dark preview panel headers/labels — needs explicit light text rules.
- Active-slide indicator going red → gold may feel less prominent; verify legibility.
- `index.html` has slide.css embedded by `build-css.sh` — must re-run after CSS edits or HTML export will be stale.
