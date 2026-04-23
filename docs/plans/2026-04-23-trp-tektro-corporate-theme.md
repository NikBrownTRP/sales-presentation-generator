# TRP / Tektro Corporate Theme Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a third presentation theme (`trp-tektro-corporate`) to the Sales Presentation Builder for company-wide business decks representing both brands.

**Architecture:** Pure CSS theme extension — adds a new `[data-theme="trp-tektro-corporate"]` token block to `css/slides.css`, parallel to existing `trp-dark` and `tektro-light` blocks. The three-color brand micro-mark is rendered via a theme-scoped `::after` pseudo-element on `.pres-slide` using inline-SVG data-URI — no changes to template rendering in `js/templates.js`. JS changes are confined to three editable regions in `js/app.js` that already handle theme-toggle logic for the existing two themes. After CSS edits, `./build-css.sh` re-embeds the stylesheet into `index.html` for the HTML export.

**Tech Stack:** Vanilla HTML/CSS/JS. No build step beyond `build-css.sh`. No unit-test framework — verification is manual, via the Claude Preview panel opening `index.html`.

**Design reference:** See [2026-04-23-trp-tektro-corporate-theme-design.md](./2026-04-23-trp-tektro-corporate-theme-design.md) and [corporate-theme-mockup.html](./corporate-theme-mockup.html).

---

## Design tokens (freeze these values before starting)

```
--pres-bg:              #FAF8F4
--pres-bg-alt:          #F4F1EB
--pres-bg-surface:      #EDE9E1
--pres-text:            #1A1A1A
--pres-text-secondary:  #5E5E5E
--pres-text-muted:      #999999
--pres-accent:          #2A2A2A
--pres-accent-light:    #4A4A4A
--pres-accent-secondary:#5E5E5E
--pres-accent-tertiary: #FFDF00
--pres-accent-glow:     rgba(26, 26, 26, 0.06)
--pres-chart-color:     #2A2A2A
--pres-border:          #D8D4CC
--pres-font-heading:    'Manrope', sans-serif
--pres-font-body:       'Inter', sans-serif
--pres-heading-weight:  700
--pres-heading-transform: none
--pres-heading-tracking: -0.02em
--pres-corner-size:     0px
--pres-corner-weight:   1px
--pres-accent-bar-height: 2px
--pres-underline-height:  2px
--pres-radius:          6px
```

Brand signature colors (micro-mark, yellow → red → blue):
`#FFDF00`, `#DE2A2A`, `#1E2D7D`.

Default logo for slides created under this theme: `assets/Logo TRP Tektro Small.png`.
Default brandline: `"Performance — Quality — Integrity"`.

---

## Task 1: Add the theme token block to `css/slides.css`

**Files:**
- Modify: `css/slides.css` (insert new block after line 84, after the `tektro-light` block closes)

**Step 1: Insert token block.**

Add immediately after the `[data-theme="tektro-light"] { ... }` block (which ends around line 84):

```css
/* --------------------------------------------------------------------------
   Theme: TRP / Tektro Corporate
   Company-wide business deck — warm-neutral editorial, single charcoal accent.
   Three-color brand micro-mark in footer (yellow / red / blue).
   Fonts: Manrope (heading) + Inter (body)
   -------------------------------------------------------------------------- */
[data-theme="trp-tektro-corporate"] {
  --pres-bg: #FAF8F4;
  --pres-bg-alt: #F4F1EB;
  --pres-bg-surface: #EDE9E1;
  --pres-text: #1A1A1A;
  --pres-text-secondary: #5E5E5E;
  --pres-text-muted: #999999;
  --pres-accent: #2A2A2A;
  --pres-accent-light: #4A4A4A;
  --pres-accent-secondary: #5E5E5E;
  --pres-accent-tertiary: #FFDF00;
  --pres-accent-glow: rgba(26, 26, 26, 0.06);
  --pres-chart-color: #2A2A2A;
  --pres-border: #D8D4CC;
  --pres-font-heading: 'Manrope', sans-serif;
  --pres-font-body: 'Inter', sans-serif;
  --pres-heading-weight: 700;
  --pres-heading-transform: none;
  --pres-heading-tracking: -0.02em;
  --pres-corner-size: 0px;
  --pres-corner-weight: 1px;
  --pres-accent-bar-height: 2px;
  --pres-underline-height: 2px;
  --pres-radius: 6px;
}
```

**Step 2: Extend the corner-hiding rule to include the new theme.**

Find the rule at `css/slides.css:241`:

```css
[data-theme="tektro-light"] .pres-corner {
  display: none;
}
```

Change the selector to cover both light themes:

```css
[data-theme="tektro-light"] .pres-corner,
[data-theme="trp-tektro-corporate"] .pres-corner {
  display: none;
}
```

**Step 3: Run the CSS rebuild.**

```bash
./build-css.sh
```

Expected output: `CSS embedded: <N> chars`.

**Step 4: Commit.**

```bash
git add css/slides.css index.html
git commit -m "feat(theme): add trp-tektro-corporate token block"
```

---

## Task 2: Add the brand-signature micro-mark

**Files:**
- Modify: `css/slides.css` (append to end)

**Step 1: Append the micro-mark pseudo-element rule.**

Place after the token block from Task 1 (or at the end of the file, before the animations section). Uses a data-URI SVG so no new asset files are needed.

```css
/* --------------------------------------------------------------------------
   TRP/Tektro Corporate — brand signature micro-mark
   Three 7×7px squares (yellow / red / blue), bottom-right of every slide.
   Pure CSS — appears on all templates without touching JS rendering.
   -------------------------------------------------------------------------- */
[data-theme="trp-tektro-corporate"] .pres-slide::after {
  content: '';
  position: absolute;
  bottom: 18px;
  right: 24px;
  width: 27px;   /* 7 + 3 + 7 + 3 + 7 */
  height: 7px;
  z-index: 3;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='27' height='7' viewBox='0 0 27 7'><rect x='0' y='0' width='7' height='7' fill='%23FFDF00'/><rect x='10' y='0' width='7' height='7' fill='%23DE2A2A'/><rect x='20' y='0' width='7' height='7' fill='%231E2D7D'/></svg>");
  background-repeat: no-repeat;
  pointer-events: none;
}
```

**Step 2: Run the CSS rebuild.**

```bash
./build-css.sh
```

**Step 3: Verify visually.**

Open `index.html` in the Claude Preview panel. No corporate slides exist yet, so nothing visible will change. Sanity-check that no existing slide now shows a stray micro-mark: add a `trp-dark` or `tektro-light` slide and confirm the bottom-right corner of the slide is unchanged.

**Step 4: Commit.**

```bash
git add css/slides.css index.html
git commit -m "feat(theme): add corporate micro-mark pseudo-element"
```

---

## Task 3: Register the theme in `addSlide` defaults

**Files:**
- Modify: `js/app.js:86-101` (the `addSlide` function)

**Step 1: Replace the two inline ternaries with theme-aware lookup tables.**

Replace lines 94–100:

```javascript
    // Prefill brand logo for templates that have a logo field
    if (slide.data.hasOwnProperty('logo') && !slide.data.logo) {
      slide.data.logo = slide.theme === 'tektro-light' ? 'assets/Logo Tektro.png' : 'assets/Logo TRP_w.png';
    }
    // Prefill brand line for title slides
    if (slide.data.hasOwnProperty('brandLine') && !slide.data.brandLine) {
      slide.data.brandLine = slide.theme === 'tektro-light' ? 'Product Quality \u2014 Value Driven \u2014 Purpose Built' : 'Product Quality \u2014 Performance Driven \u2014 Innovation Forward';
    }
```

with:

```javascript
    // Prefill brand logo for templates that have a logo field
    if (slide.data.hasOwnProperty('logo') && !slide.data.logo) {
      slide.data.logo = defaultLogoForTheme(slide.theme);
    }
    // Prefill brand line for title slides
    if (slide.data.hasOwnProperty('brandLine') && !slide.data.brandLine) {
      slide.data.brandLine = defaultBrandLineForTheme(slide.theme);
    }
```

**Step 2: Add the two helper functions just above `addSlide`** (before line 86):

```javascript
  /* -----------------------------------------------------------------------
     Theme defaults
     ----------------------------------------------------------------------- */
  var DEFAULT_LOGOS = {
    'trp-dark':             'assets/Logo TRP_w.png',
    'tektro-light':         'assets/Logo Tektro.png',
    'trp-tektro-corporate': 'assets/Logo TRP Tektro Small.png'
  };
  var DEFAULT_BRANDLINES = {
    'trp-dark':             'Product Quality \u2014 Performance Driven \u2014 Innovation Forward',
    'tektro-light':         'Product Quality \u2014 Value Driven \u2014 Purpose Built',
    'trp-tektro-corporate': 'Performance \u2014 Quality \u2014 Integrity'
  };
  function defaultLogoForTheme(theme)      { return DEFAULT_LOGOS[theme]      || DEFAULT_LOGOS['trp-dark']; }
  function defaultBrandLineForTheme(theme) { return DEFAULT_BRANDLINES[theme] || DEFAULT_BRANDLINES['trp-dark']; }
```

**Step 3: Verify in the preview.**

Open `index.html` in the preview. Add a new slide. Existing behavior must be unchanged (TRP/Tektro buttons still work, logos still prefill correctly). No corporate button exists yet.

**Step 4: Commit.**

```bash
git add js/app.js
git commit -m "refactor(theme): extract theme default tables and register corporate logo/brandline"
```

---

## Task 4: Update the per-slide theme toggle (editor panel)

**Files:**
- Modify: `js/app.js:382-420` (inside `renderEditor`)

**Step 1: Add the third theme button.**

Replace lines 385–388:

```javascript
    html += '<div class="form-theme-toggle">';
    html += '<button class="form-theme-btn' + (slideTheme === 'trp-dark' ? ' form-theme-btn--active' : '') + '" data-set-theme="trp-dark">TRP Racing</button>';
    html += '<button class="form-theme-btn' + (slideTheme === 'tektro-light' ? ' form-theme-btn--active' : '') + '" data-set-theme="tektro-light">Tektro</button>';
    html += '</div></div>';
```

with:

```javascript
    html += '<div class="form-theme-toggle">';
    html += '<button class="form-theme-btn' + (slideTheme === 'trp-dark' ? ' form-theme-btn--active' : '') + '" data-set-theme="trp-dark">TRP Racing</button>';
    html += '<button class="form-theme-btn' + (slideTheme === 'tektro-light' ? ' form-theme-btn--active' : '') + '" data-set-theme="tektro-light">Tektro</button>';
    html += '<button class="form-theme-btn' + (slideTheme === 'trp-tektro-corporate' ? ' form-theme-btn--active' : '') + '" data-set-theme="trp-tektro-corporate">Corporate</button>';
    html += '</div></div>';
```

**Step 2: Replace the theme-swap logic (lines 397–420) with table-based lookups.**

```javascript
    dom.editorForm.querySelectorAll('[data-set-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var oldTheme = slide.theme;
        slide.theme = btn.dataset.setTheme;
        // Swap brand logo if it's still the prior theme's default
        if (slide.data.hasOwnProperty('logo')) {
          var oldLogo = defaultLogoForTheme(oldTheme);
          if (!slide.data.logo || slide.data.logo === oldLogo) {
            slide.data.logo = defaultLogoForTheme(slide.theme);
          }
        }
        // Swap brand line if it's still the prior theme's default
        if (slide.data.hasOwnProperty('brandLine')) {
          var oldBrand = defaultBrandLineForTheme(oldTheme);
          if (!slide.data.brandLine || slide.data.brandLine === oldBrand) {
            slide.data.brandLine = defaultBrandLineForTheme(slide.theme);
          }
        }
        renderEditor();
        renderSidebar();
        updatePreview();
        autoSave();
      });
    });
```

**Step 3: Verify in the preview.**

Open `index.html`. Add a title slide. The theme toggle should now show three buttons: `TRP Racing`, `Tektro`, `Corporate`. Click `Corporate` — the slide should:

- Adopt the warm off-white background
- Show the combined logo (`Logo TRP Tektro Small.png`)
- Show the three-square micro-mark bottom-right
- Show "Performance — Quality — Integrity" as the brand line

Toggle back to TRP Racing — logo and brandline revert. Verify pairwise swaps work: Corporate → Tektro, Tektro → Corporate, Corporate → TRP, TRP → Corporate.

**Step 4: Screenshot proof.**

Take a preview screenshot of a Corporate-theme title slide and a Corporate-theme graph slide for the commit message.

**Step 5: Commit.**

```bash
git add js/app.js
git commit -m "feat(theme): add Corporate button to per-slide theme toggle"
```

---

## Task 5: Update the template-picker modal theme toggle

**Files:**
- Modify: `js/app.js:1101-1146` (inside `renderTemplateGrid`)

**Step 1: Add the third theme button in the modal.**

Replace lines 1105–1108:

```javascript
    // Theme picker
    var html = '<div class="template-theme-picker">';
    html += '<button class="template-theme-btn' + (modalTheme === 'trp-dark' ? ' template-theme-btn--active' : '') + '" data-pick-theme="trp-dark">TRP Racing</button>';
    html += '<button class="template-theme-btn' + (modalTheme === 'tektro-light' ? ' template-theme-btn--active' : '') + '" data-pick-theme="tektro-light">Tektro</button>';
    html += '</div>';
```

with:

```javascript
    // Theme picker
    var html = '<div class="template-theme-picker">';
    html += '<button class="template-theme-btn' + (modalTheme === 'trp-dark' ? ' template-theme-btn--active' : '') + '" data-pick-theme="trp-dark">TRP Racing</button>';
    html += '<button class="template-theme-btn' + (modalTheme === 'tektro-light' ? ' template-theme-btn--active' : '') + '" data-pick-theme="tektro-light">Tektro</button>';
    html += '<button class="template-theme-btn' + (modalTheme === 'trp-tektro-corporate' ? ' template-theme-btn--active' : '') + '" data-pick-theme="trp-tektro-corporate">Corporate</button>';
    html += '</div>';
```

**Step 2: Verify in the preview.**

Open `index.html`. Click the "+" / add-slide button to open the template picker modal. The picker should now show three theme chips. Click `Corporate` — the previews on all seven template cards should re-render with the warm off-white background and the three-square micro-mark.

**Step 3: Commit.**

```bash
git add js/app.js
git commit -m "feat(theme): add Corporate option to template picker modal"
```

---

## Task 6: Add corporate-theme animations

**Files:**
- Modify: `css/slides.css` (append after the `tektro-light` animation block, roughly line 1240+)

**Step 1: Mirror the Tektro Light animation set for the corporate theme.**

Find the existing `tektro-light` animation block (starts around line 1179, `[data-theme="tektro-light"] .pres-slide--animated .pres-logo` etc.). Select the full block — every rule prefixed with `[data-theme="tektro-light"] .pres-slide--animated` — and duplicate it immediately below, substituting `tektro-light` → `trp-tektro-corporate` throughout.

Corporate animations should feel identical to Tektro Light (same calm register), so no keyframe or timing changes — only selector swaps.

**Step 2: Rebuild CSS.**

```bash
./build-css.sh
```

**Step 3: Verify animations in the slideshow.**

Add a Corporate-theme title slide and at least one other template (e.g. generic bullets). Open slideshow mode. Confirm the slide-in animations match Tektro Light's gentle rise / fade behaviour.

**Step 4: Commit.**

```bash
git add css/slides.css index.html
git commit -m "feat(theme): add corporate theme animations (mirrors tektro-light)"
```

---

## Task 7: Verify HTML export renders the new theme

**Files:**
- None edited. Verification only.

**Step 1: Build a small test deck.**

In the app, create: 1 Corporate title, 1 Corporate generic, 1 Corporate graph, 1 Tektro title, 1 TRP product. Mix ensures no cross-theme regression.

**Step 2: Export to HTML.**

Use the app's HTML export button. Save the output somewhere temporary.

**Step 3: Open the exported HTML.**

Open the exported file in a browser via the preview panel. Verify:

- All three Corporate slides render with the warm off-white background.
- The three-square micro-mark is present on all three Corporate slides.
- The TRP dark and Tektro light slides render unchanged — no micro-mark, original backgrounds.
- Slideshow navigation works; animations fire on slide entry.

**Step 4: Commit (documentation only, if any fixes were needed).**

If nothing was changed, skip this commit. If issues surfaced, fix them with a narrowly-scoped commit such as:

```bash
git commit -m "fix(theme): <specific issue found during export verification>"
```

---

## Task 8: Update the comment header of `css/slides.css`

**Files:**
- Modify: `css/slides.css:1-5`

**Step 1: Update the file header.**

Replace:

```css
/* ==========================================================================
   Sales Presentation Generator — Slide Styles & Themes
   Two brand design systems: TRP Dark + Tektro Light
   Aligned with Stitch MCP-generated corporate design systems
   ========================================================================== */
```

with:

```css
/* ==========================================================================
   Sales Presentation Generator — Slide Styles & Themes
   Three brand design systems:
     - TRP Dark (racing)
     - Tektro Light (editorial)
     - TRP/Tektro Corporate (company-wide business)
   ========================================================================== */
```

**Step 2: Rebuild CSS and commit.**

```bash
./build-css.sh
git add css/slides.css index.html
git commit -m "docs(theme): update slides.css header to note three themes"
```

---

## Final verification checklist

Before declaring done, confirm each:

- [ ] Per-slide editor toggle shows three buttons in the correct order
- [ ] Template picker modal shows three theme chips
- [ ] All 7 templates render correctly under the Corporate theme in the live preview
- [ ] Three-color micro-mark visible bottom-right on every Corporate slide
- [ ] Micro-mark NOT visible under TRP Dark or Tektro Light
- [ ] Logo auto-swap works in all 6 pairwise theme transitions
- [ ] Brandline auto-swap works (for title slides only) in all 6 pairwise transitions
- [ ] Exported HTML preserves the Corporate theme and micro-mark on every Corporate slide
- [ ] Animations fire on Corporate slides in slideshow mode
- [ ] Existing decks loaded from localStorage still render correctly (no schema change was made)

---

## Notes / deferred items

- **Stitch MCP registration:** earlier attempts to create a Stitch design system for the new theme failed with invalid-argument errors. `css/slides.css` is the source of truth; if Stitch integration is desired later, that's a separate task.
- **PPTX import:** existing import logic is template-based, not theme-based, so it continues to work — no new mappings required.
- **Brandline placeholder phrasing:** `"Performance — Quality — Integrity"` is a reasonable default but can be refined without a code change — the user can edit it per-slide.
