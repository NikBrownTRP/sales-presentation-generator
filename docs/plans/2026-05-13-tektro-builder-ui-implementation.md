# Tektro Web Tool UI Restyle — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the Presentation Builder's editor chrome (`css/builder.css` + minimal `index.html` touch-ups) to match the Tektro Web Tool's cream/gold "paper" aesthetic, while leaving slide content, JS behavior, and `css/slides.css` untouched.

**Architecture:** Token-swap-and-restyle. Replace the dark `--builder-*` token block at the top of `builder.css` with a Tektro-aligned token set, then sweep section-by-section converting hard-coded color literals to vars and tuning structural rules (buttons, inputs, cards, modals). Two intentional exceptions stay dark: the **preview stage** (frames the dark slides) and the **slideshow modal** (full-screen presentation view). Existing `.builder-*` class names are preserved so JS keeps working.

**Tech Stack:** Plain CSS, vanilla JS host (untouched), Geist + Geist Mono via Google Fonts, `build-css.sh` to re-embed `slides.css` into `index.html` (per project memory — only needed if `slides.css` changes, but run anyway after CSS work to be safe).

**Reference files:**
- Tektro Web Tool tokens: `/Users/niklasbrown/Desktop/Claude Tools/Tektro Web Tool/app/static/css/tokens.css`
- Tektro Web Tool patterns: `/Users/niklasbrown/Desktop/Claude Tools/Tektro Web Tool/app/static/css/app.css`
- Design doc: `docs/plans/2026-05-13-tektro-builder-ui-design.md`

**Branch:** `ui/tektro-web-look` (already created and checked out)

**Verification model:** Every task ends with a visual check via `preview_*` tools (preview the built `index.html`) and a screenshot. No unit tests — this is a visual refactor.

---

## Task 0: Smoke baseline

**Files:** none modified

**Step 1:** Confirm working directory and branch.

```bash
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch `ui/tektro-web-look`, clean working tree (the design-doc commit is already in).

**Step 2:** Start preview to capture a "before" screenshot for later comparison.

Use `preview_start` on `index.html`. Then `preview_screenshot` and save as the baseline reference.

**Step 3:** Open `index.html` in a browser tab via preview and click through: add slide, open template picker, open slideshow modal, hover header buttons. Take a screenshot of each so we know what we're replacing.

No commit.

---

## Task 1: Replace `:root` tokens at the top of builder.css

**Files:**
- Modify: `css/builder.css:9-32` (the `:root { --builder-* ... }` block)

**Step 1:** Read `css/builder.css` lines 1-40 to confirm current token block.

**Step 2:** Replace the `:root { ... }` block (lines 9-32) with the following. This is the single most important edit — it cascades through hundreds of rules below.

```css
:root {
  /* --- Surfaces --- */
  --builder-bg:              #F7F7F4;
  --builder-surface:         #FFFFFF;
  --builder-surface-alt:     #F2F2EE;
  --builder-surface-hover:   #ECECE7;

  /* --- Preview stage (intentionally dark — frames the slides) --- */
  --builder-stage:           #1A1B1D;
  --builder-stage-alt:       #232427;

  /* --- Borders --- */
  --builder-border:          #E7E7E1;
  --builder-border-focus:    #D4D4CD;

  /* --- Text --- */
  --builder-text:            #0E0E10;
  --builder-text-secondary:  #55555F;
  --builder-text-muted:      #8E8E98;
  --builder-text-on-dark:    #F7F7F4;

  /* --- Primary (slate buttons) --- */
  --builder-primary:         #1F2022;
  --builder-primary-hover:   #2A2B2D;
  --builder-primary-ink:     #FFFFFF;

  /* --- Accent (gold — focus rings, active states, highlights) --- */
  --builder-accent:          #FFCA2B;
  --builder-accent-hover:    #FFD64A;
  --builder-accent-ink:      #8A6A00;
  --builder-accent-tint:     #FFF8E0;
  --builder-accent-glow:     rgba(255, 202, 43, 0.22);

  /* --- Semantic --- */
  --builder-success:         #117A4A;
  --builder-success-bg:      #E6F4EC;
  --builder-danger:          #B73A2A;
  --builder-danger-hover:    #9A2F22;
  --builder-danger-bg:       #FBEBE7;
  --builder-warn:            #B7791F;
  --builder-warn-bg:         #FFF6E0;

  /* --- Typography --- */
  --builder-font-heading:    'Geist', 'Inter', system-ui, -apple-system, sans-serif;
  --builder-font-body:       'Geist', 'Inter', system-ui, -apple-system, sans-serif;
  --builder-font-mono:       'Geist Mono', ui-monospace, monospace;

  /* --- Geometry --- */
  --builder-sidebar-width:   280px;
  --builder-header-height:   56px;
  --builder-radius:          8px;
  --builder-radius-lg:       12px;
  --builder-radius-sm:       6px;
  --builder-transition:      160ms cubic-bezier(0.4,0,0.2,1);

  /* --- Shadows --- */
  --builder-shadow-xs:       0 1px 2px rgba(15,15,20,0.04);
  --builder-shadow-sm:       0 1px 2px rgba(15,15,20,0.05), 0 1px 1px rgba(15,15,20,0.03);
  --builder-shadow:          0 4px 12px rgba(15,15,20,0.06);
  --builder-ring:            0 0 0 3px var(--builder-accent-glow);
}
```

**Notes for the implementer:**
- `--builder-accent` changes from red `#E31837` to gold `#FFCA2B`. Anywhere the codebase already uses `var(--builder-accent)` will automatically pick up gold. Verify this looks right at the next checkpoint.
- New tokens added: `--builder-stage`, `--builder-stage-alt`, `--builder-text-on-dark`, `--builder-primary-*`, `--builder-accent-tint`, `--builder-accent-ink`, `--builder-radius-lg`, `--builder-shadow-*`, `--builder-ring`.
- `--builder-transition` previously was `0.2s ease` — now an easing curve at 160ms. Smoother.
- `--builder-font-heading` collapses to Geist as well (Tektro uses one face for both).

**Step 3:** Add the Geist font import at the top of `css/builder.css` (line 1, before the existing comment header — or as a new line 1 above the file's header comment). Insert:

```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap');
```

**Step 4:** Visual check.

Run `preview_start` if not running, then `preview_eval` with `window.location.reload()`. `preview_screenshot`.

Expected: The page will look mostly broken (light tokens cascading into rules written for dark surfaces — text will be unreadable in places, the sidebar will look weird, buttons will be light-on-light). **This is expected.** The token swap is intentional; subsequent tasks fix per-section rules.

**Step 5:** Commit.

```bash
git add css/builder.css
git commit -m "ui(builder): swap design tokens to Tektro Web Tool palette

Cream surfaces, gold accent, slate primary, Geist font, soft shadows.
Per-section rules will be reworked in follow-up commits."
```

---

## Task 2: Base + Header

**Files:**
- Modify: `css/builder.css:35-126` (Reset & Base + Header sections, currently lines 35-60 reset/body and 62-126 header)

**Step 1:** Read current `css/builder.css:35-126`.

**Step 2:** Rework the body and header rules so they read on a cream background. Key changes:

- `body.builder-body` — background becomes `var(--builder-bg)`, color `var(--builder-text)`, font `var(--builder-font-body)`. Keep `overflow: hidden; height: 100vh`.
- `.builder-header` — background `var(--builder-surface)` with subtle backdrop blur (mirror Tektro's `.navbar`):
  ```css
  background: rgba(255,255,255,0.85);
  backdrop-filter: saturate(180%) blur(12px);
  -webkit-backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--builder-border);
  ```
- `.builder-header__brand` — change `color: var(--builder-accent)` (was red) to `color: var(--builder-text)`. The brand mark should not glow gold.
- `.builder-header__icon` — replace the red SVG behavior by neutralizing its color: keep `currentColor` but the parent is now dark text. Better: in `index.html` (line 35), swap the inline SVG icon for a slate "TRP" square. **See Task 2b below for that edit.**
- `.builder-header__title` — color `var(--builder-text)`, weight 600.
- `.builder-header__title-input` — borderless until hover, gold ring on focus:
  ```css
  border: 1px solid transparent;
  color: var(--builder-text);
  background: transparent;
  ```
  Hover: `border-color: var(--builder-border);`
  Focus: `border-color: var(--builder-accent); background: var(--builder-surface); box-shadow: var(--builder-ring); outline: none;`

**Step 2b (index.html edit):** Read `index.html:33-40`. Replace the red SVG inside `.builder-header__brand` with a slate brand square matching Tektro's `.nav-brand-icon`:

```html
<div class="builder-header__brand-mark" aria-hidden="true">TRP</div>
```

And add to `css/builder.css` (inside Header section):

```css
.builder-header__brand-mark {
  width: 28px; height: 28px;
  background: var(--builder-primary);
  color: #fff;
  font-family: var(--builder-font-heading);
  font-size: 0.72rem; font-weight: 700;
  letter-spacing: 0.02em;
  border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
```

**Step 3:** `preview_eval` reload, `preview_screenshot`. Expected: header now reads correctly — slate "TRP" square, dark "Presentation Builder" title, white translucent bar. Body is cream. Rest of page still broken (sidebar/editor not yet styled). That's fine.

**Step 4:** Use `preview_inspect` on `.builder-header` to confirm computed `background-color` resolves and the backdrop filter is applied.

**Step 5:** Commit.

```bash
git add css/builder.css index.html
git commit -m "ui(builder): restyle header + base — Tektro nav pattern"
```

---

## Task 3: Buttons + Layout toggle + Selects

**Files:**
- Modify: `css/builder.css:128-301` (Layout Toggle 128-185, Buttons 187-276, Select/Dropdown 278-301)

**Step 1:** Read `css/builder.css:128-301`.

**Step 2:** Rework button variants to match Tektro's `.btn` family.

Default `.builder-btn`:
```css
background: var(--builder-surface);
color: var(--builder-text);
border: 1px solid var(--builder-border);
border-radius: var(--builder-radius);
box-shadow: var(--builder-shadow-xs);
font-family: var(--builder-font-body);
font-weight: 500;
letter-spacing: -0.005em;
transition: all var(--builder-transition);
```
Hover: `background: var(--builder-surface-alt); border-color: var(--builder-border-focus);`

`.builder-btn--primary`:
```css
background: var(--builder-primary);
color: var(--builder-primary-ink);
border-color: var(--builder-primary);
```
Hover: `background: var(--builder-primary-hover); border-color: var(--builder-primary-hover); box-shadow: 0 2px 8px rgba(15,15,20,0.12);`
Active: `transform: translateY(1px);`

`.builder-btn--accent` (was the red CTA, e.g. "Add Slide"):
Choose one of two paths and pick the one that visually works at the checkpoint:
- **Option A** (preferred): same as `--primary` (slate). Tektro uses slate for all primary CTAs.
- **Option B:** gold fill — `background: var(--builder-accent); color: var(--builder-accent-ink); border-color: var(--builder-accent);`. Use only if slate-on-slate gets too monotone.

Start with Option A.

`.builder-btn--secondary` — outlined slate:
```css
background: var(--builder-surface);
color: var(--builder-text);
border: 1px solid var(--builder-border-focus);
```
Hover: `background: var(--builder-surface-alt);`

`.builder-btn--ghost` — transparent header buttons:
```css
background: transparent;
border: 1px solid transparent;
color: var(--builder-text-secondary);
box-shadow: none;
```
Hover: `background: var(--builder-surface-alt); color: var(--builder-text);`

`.builder-btn--danger`:
```css
color: var(--builder-danger);
border-color: rgba(183,58,42,0.25);
background: var(--builder-surface);
```
Hover: `background: var(--builder-danger-bg); border-color: var(--builder-danger); color: var(--builder-danger);`

`.builder-btn--sm`: unchanged padding rules, just verify font-size reads.

**Step 3:** Layout toggle (`.builder-layout-toggle`, `.builder-layout-btn`) — convert to a segmented control on light surface:
- Container: `background: var(--builder-surface-alt); border: 1px solid var(--builder-border); border-radius: var(--builder-radius);`
- Inactive button: `color: var(--builder-text-secondary); background: transparent;`
- Active button: `background: var(--builder-surface); color: var(--builder-text); box-shadow: var(--builder-shadow-xs);`

**Step 4:** Select/dropdown — light surface, dark text, gold focus ring. Replace any `background: var(--builder-surface)` that was assuming dark with the new light surface (already correct after token swap; verify). Add `:focus { border-color: var(--builder-accent); box-shadow: var(--builder-ring); }`.

**Step 5:** `preview_eval` reload, `preview_screenshot`. Click each header button (using `preview_click`) to confirm hover/focus look right. Inspect computed styles on one of each variant.

**Step 6:** Commit.

```bash
git add css/builder.css
git commit -m "ui(builder): restyle buttons, layout toggle, selects"
```

---

## Task 4: Sidebar + Slide list

**Files:**
- Modify: `css/builder.css:303-539` (Main Layout 303-310, Sidebar 312-347, Slide List 349-539)

**Step 1:** Read `css/builder.css:303-539`.

**Step 2:** Sidebar shell:
- `.builder-sidebar` — `background: var(--builder-surface-alt); border-right: 1px solid var(--builder-border);`
- `.builder-sidebar__header`, `.builder-sidebar__footer` — borders use `var(--builder-border)`. Title color `var(--builder-text)`.

**Step 3:** Slide list items — white cards on cream:
- `.slide-list-item` — `background: var(--builder-surface); border: 1px solid var(--builder-border); border-radius: var(--builder-radius); box-shadow: var(--builder-shadow-xs);`
- Hover: `border-color: var(--builder-border-focus); background: var(--builder-surface);`
- Active (`.slide-list-item--active` or whatever selector currently marks it): `border-color: var(--builder-accent); background: var(--builder-accent-tint); box-shadow: var(--builder-shadow-xs), inset 2px 0 0 var(--builder-accent);`
- Thumbnail (`.slide-list-item__thumb` or similar): the inner slide preview keeps its own slides.css rendering — but the *frame* around the thumb is now light. If there's an explicit dark background on the thumb wrapper, change to `var(--builder-surface-alt)` so the slide thumb (which is dark internally) reads against a light frame.
- Action buttons inside slide items (duplicate, delete) — adopt `.builder-btn--ghost` styling; danger variant for delete.
- Drag handle — color `var(--builder-text-muted)`; hover `var(--builder-text)`.

**Step 4:** Scan for hard-coded `#XXXXXX` literals in this range (`grep -nE "#[0-9A-Fa-f]{3,6}" css/builder.css | awk -F: '$2 >= 303 && $2 <= 539'` — or read sequentially). Replace each with the appropriate variable.

**Step 5:** `preview_eval` reload, `preview_screenshot`. Click between slides to confirm the gold active-state indicator reads clearly. If it feels too subtle, bump to a thicker `inset 3px 0 0 var(--builder-accent)` or add a left border.

**Step 6:** Commit.

```bash
git add css/builder.css
git commit -m "ui(builder): restyle sidebar + slide list with gold active state"
```

---

## Task 5: Preview panel (stays dark) + Main content area

**Files:**
- Modify: `css/builder.css:541-662` (Main Content 541-605, Preview Panel 607-662)

**Step 1:** Read `css/builder.css:541-662`.

**Step 2:** Main content area — `background: var(--builder-bg);` (cream). Borders to `var(--builder-border)`.

**Step 3:** Preview panel is the **intentional dark exception**.
- `.builder-preview` — `background: var(--builder-stage); border-bottom: 1px solid var(--builder-border);` (or whatever divides it from the editor below).
- `.builder-preview__header` — dark surface, text in `var(--builder-text-on-dark)`:
  ```css
  background: var(--builder-stage-alt);
  color: var(--builder-text-on-dark);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  ```
- `.builder-preview__label` — `color: var(--builder-text-on-dark); opacity: 0.7;`
- `.builder-preview__slide-info` — `color: var(--builder-text-on-dark); opacity: 0.55;`
- `.builder-preview__container` — `background: var(--builder-stage);` so the slide sits in a dark stage.

**Step 4:** `preview_eval` reload. The preview area should now feel like a "darkroom" framing the slide. Capture screenshot.

**Step 5:** Commit.

```bash
git add css/builder.css
git commit -m "ui(builder): restyle preview panel as dark stage (intentional)"
```

---

## Task 6: Editor panel + Form elements

**Files:**
- Modify: `css/builder.css:664-1009` (Editor Panel 664-705, Editor Form 707-1009)

**Step 1:** Read `css/builder.css:664-1009` in chunks.

**Step 2:** Editor panel shell:
- `.builder-editor` — `background: var(--builder-surface); border-top: 1px solid var(--builder-border);`
- `.builder-editor__header` — `background: var(--builder-surface); border-bottom: 1px solid var(--builder-border); color: var(--builder-text);`
- `.builder-editor__label`, `.builder-editor__template-name` — text colors → `var(--builder-text-secondary)` / `var(--builder-text-muted)`.

**Step 3:** Form elements — light inputs with gold focus ring:
- Text inputs, textareas, selects:
  ```css
  background: var(--builder-surface);
  color: var(--builder-text);
  border: 1px solid var(--builder-border);
  border-radius: var(--builder-radius-sm);
  font-family: var(--builder-font-body);
  ```
- Focus: `border-color: var(--builder-accent); box-shadow: var(--builder-ring); outline: none;`
- Labels: `color: var(--builder-text-secondary); font-weight: 500;`
- Helper text / hints: `color: var(--builder-text-muted);`
- Disabled inputs: `background: var(--builder-surface-alt); color: var(--builder-text-muted);`
- File picker / upload zones: outlined cards with dashed `var(--builder-border-focus)` border, hover `background: var(--builder-surface-alt)`.
- Color pickers, range sliders, checkboxes, radios — if styled, retokenize. Native controls can be left for browser defaults.

**Step 4:** Sweep this range for hard-coded hex values and replace with vars. Run:
```bash
grep -nE "#[0-9A-Fa-f]{3,6}" css/builder.css | awk -F: '{ if ($2+0 >= 707 && $2+0 <= 1009) print }'
```

**Step 5:** `preview_eval` reload. Add a slide, click into the editor form. Tab through fields to verify focus ring. Take a screenshot.

**Step 6:** Commit.

```bash
git add css/builder.css
git commit -m "ui(builder): restyle editor panel + form inputs with gold focus rings"
```

---

## Task 7: Modals + Template picker

**Files:**
- Modify: `css/builder.css:1011-1268` (Modals 1011-1086, Template Picker 1088-1268)

**Step 1:** Read `css/builder.css:1011-1268`.

**Step 2:** Modal shell:
- `.modal__overlay` — `background: rgba(15,15,20,0.45);` (lighter than current).
- `.modal__content` — `background: var(--builder-surface); border-radius: var(--builder-radius-lg); box-shadow: 0 24px 64px rgba(15,15,20,0.18), 0 2px 8px rgba(15,15,20,0.08); border: 1px solid var(--builder-border);`
- `.modal__header` — `border-bottom: 1px solid var(--builder-border); color: var(--builder-text);`
- `.modal__title` — `color: var(--builder-text); font-weight: 600; letter-spacing: -0.01em;`
- `.modal__close` — ghost button styling.

**Step 3:** Template picker grid — adopt Tektro's `.landing-card` hover pattern:
- `.template-card` (or whatever the picker uses): `background: var(--builder-surface); border: 1px solid var(--builder-border); border-radius: var(--builder-radius-lg); box-shadow: var(--builder-shadow-xs); transition: transform var(--builder-transition), box-shadow var(--builder-transition), border-color var(--builder-transition);`
- Hover: `transform: translateY(-2px); box-shadow: var(--builder-shadow); border-color: var(--builder-border-focus);`
- Selected/active card (if applicable): `border-color: var(--builder-accent); box-shadow: var(--builder-shadow), 0 0 0 3px var(--builder-accent-glow);`
- Card title / description: text → `var(--builder-text)` / `var(--builder-text-secondary)`.

**Step 4:** Import picker modal (`.modal--import-picker`, lines around 186-end of HTML) — same pattern: white surface, light borders, gold focus on inputs.

**Step 5:** `preview_eval` reload, then `preview_click` on the "Add Slide" button to open the template picker. Screenshot. Verify hover lift on cards by hovering one with `preview_eval` (simulate `:hover` via dev tools or just inspect).

**Step 6:** Commit.

```bash
git add css/builder.css
git commit -m "ui(builder): restyle modals + template picker cards"
```

---

## Task 8: Slideshow modal (stays dark) + Export progress

**Files:**
- Modify: `css/builder.css:1270-1459` (Slideshow Modal 1270-1414, Export Progress 1416-1459)

**Step 1:** Read `css/builder.css:1270-1459`.

**Step 2:** Slideshow modal is the **second intentional dark exception**. Keep it dark, just refresh the chrome:
- `.slideshow-modal` — `background: #0A0A0A;` (or keep current dark value — full-screen presentation view).
- `.slideshow-modal__header`, `.slideshow-modal__counter`, `.slideshow-modal__close` — light text on dark via `var(--builder-text-on-dark)`.
- Nav buttons (`.slideshow-modal__nav--prev/next`) — translucent dark backgrounds (`rgba(255,255,255,0.06)`), hover `rgba(255,255,255,0.12)`, icon color `var(--builder-text-on-dark)`.
- Dots (`.slideshow-modal__dots`) — inactive `rgba(255,255,255,0.3)`, active `var(--builder-accent)` (gold reads on dark).

**Step 3:** Export progress overlay:
- Container: `background: var(--builder-surface); border: 1px solid var(--builder-border); border-radius: var(--builder-radius-lg); box-shadow: var(--builder-shadow);`
- Progress bar fill: `background: var(--builder-accent);` (or slate `var(--builder-primary)` — pick what reads better at checkpoint).
- Text: `var(--builder-text)` / `var(--builder-text-secondary)`.

**Step 4:** `preview_eval` reload. Open slideshow modal via `preview_click` on its trigger. Verify it still feels like a "presentation mode." Close it, then confirm nothing else regressed.

**Step 5:** Commit.

```bash
git add css/builder.css
git commit -m "ui(builder): refresh slideshow modal + export progress chrome"
```

---

## Task 9: Responsive, Utility, Custom Dialog, Image Editor

**Files:**
- Modify: `css/builder.css:1461-end` (Responsive 1461-1518, Utility 1520-1532, Custom Dialog 1534-1660, Image Editor 1662-end)

**Step 1:** Read each sub-section.

**Step 2:** Custom Dialog (replaces native confirm/alert/prompt) — same patterns as modal: white surface, `--radius-lg`, soft shadow, slate primary button, ghost cancel. Verify the dialog title/message use `var(--builder-text)` and `var(--builder-text-secondary)`.

**Step 3:** Image Editor Modal — same modal shell treatment. The image canvas/preview inside can stay on `var(--builder-surface-alt)` (subtle cream) so the image reads cleanly. Tool buttons get `.builder-btn--ghost` treatment.

**Step 4:** Responsive section — verify any media-query overrides that hard-code colors get retokenized. Layout breakpoints stay as-is.

**Step 5:** Utility classes — quick scan; mostly margin/padding helpers. If any have color literals, retokenize.

**Step 6:** Final hex sweep across the entire file:
```bash
grep -nE "#[0-9A-Fa-f]{3,6}" css/builder.css
```

For each result, decide: (a) is this inside one of the two intentional dark zones (preview stage, slideshow modal) where literals are OK; or (b) should it be a var. Replace category (b) values.

**Step 7:** Run `bash build-css.sh` (per memory: re-embed `slides.css` into `index.html` after CSS edits — even though we didn't touch `slides.css`, run it to keep the embedded copy in sync and verify the script doesn't error).

**Step 8:** `preview_eval` reload. Walk through every flow once: add slide, edit fields, reorder, delete, open template picker, open import picker, open slideshow, trigger a custom dialog (e.g., delete slide), open image editor on an image slide. Screenshot each.

**Step 9:** Commit.

```bash
git add css/builder.css index.html
git commit -m "ui(builder): final sweep — dialogs, image editor, responsive, utilities"
```

---

## Task 10: End-to-end verification + export sanity check

**Files:** none modified (verification only)

**Step 1:** `preview_console_logs` — confirm zero JS errors during a full click-through.

**Step 2:** Export the same demo deck as HTML (via the existing Export HTML button) and compare against a pre-restyle export from `main`:
```bash
git stash
git checkout main
# export from main, save as before.html
git checkout ui/tektro-web-look
git stash pop
# export from this branch, save as after.html
diff <(grep -o '<style[^>]*>.*</style>' before.html) <(grep -o '<style[^>]*>.*</style>' after.html)
```

Expected: the embedded `slides.css` block is **identical**. Only the builder chrome differs — but exported HTML shouldn't include builder.css anyway. If exported decks differ visually, that's a regression — investigate.

**Step 3:** Take final "after" screenshots of: header, sidebar with active slide, editor with a form open, template picker modal, slideshow open. Save these for the PR description.

**Step 4:** Stop the preview server: `preview_stop`.

**Step 5:** Final commit if any sweep cleanup happened during verification. Otherwise nothing to commit here.

---

## Done criteria

- [ ] All 9 implementation tasks completed and committed on `ui/tektro-web-look`
- [ ] Zero JS errors in preview console
- [ ] Exported HTML deck is visually identical to `main`'s export (slides untouched)
- [ ] No remaining hard-coded color literals in `builder.css` outside the two intentional dark zones (preview stage, slideshow modal)
- [ ] Header, sidebar, editor, modals, template picker all read in the Tektro cream/gold/slate aesthetic
- [ ] Preview stage and slideshow modal are still dark (frame the slides)
- [ ] No JS files modified. No `slides.css` modified. Slide markup unchanged.

## Notes for the implementer

- **Per project memory:** Run `bash build-css.sh` after CSS edits to re-embed `slides.css` into `index.html`. We're not changing `slides.css`, but the script is the single source of truth — run it at the end of Task 9 to keep the embedded copy in sync.
- **Reversibility:** Each task is its own commit. If a section's restyle looks worse than the previous state at the visual checkpoint, revert that single commit and rethink before moving on.
- **Token-first mindset:** When in doubt, use a `var(--builder-*)`. Hard-coded hex is only OK inside the preview stage and slideshow modal sections.
- **Don't refactor JS or class names.** If a class name in `builder.css` seems oddly named, leave it. Renaming would touch JS and is out of scope.
- **Don't touch `slides.css`.** Slide content stays exactly as it is today.
