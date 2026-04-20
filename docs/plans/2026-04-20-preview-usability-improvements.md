# Preview Usability Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Three usability improvements: jump editor to the slide shown when closing preview; import individual slides from another presentation via a picker; hide slideshow controls during keyboard navigation and show them only on mouse movement.

**Architecture:** All changes are in vanilla JS (IIFE modules) and CSS. No new dependencies. Feature 1 wires a callback between `preview.js` and `controller.js`. Feature 2 adds a new modal + file input in `index.html`, CSS in `builder.css`, and logic in `controller.js`. Feature 3 adds a CSS visibility class toggled by JS in `preview.js`. After any CSS edit to `builder.css`, run `./build-css.sh` only if `slides.css` was also changed (it re-embeds slides.css into index.html — builder.css edits do NOT need it; however the memory note says to run it after CSS edits, so run it to be safe).

**Tech Stack:** Vanilla JS (ES5 style, IIFEs, `window.*` globals), plain CSS, no build tools beyond `build-css.sh`.

**Security note on innerHTML:** This codebase renders slide HTML via `innerHTML` throughout (all template rendering). The import picker follows the same pattern. Content comes from the user's own saved JSON/HTML files — not from remote untrusted sources. This is consistent with the existing risk model of the app.

---

## Context: Key patterns used throughout the codebase

- **UIDs:** `uid()` function (in `controller.js` scope) — `Date.now().toString(36) + Math.random().toString(36).substr(2, 6)`
- **Modals:** add/remove `.modal--visible` via `openModal(el)` / `closeModal(el)`. `aria-hidden` toggled too.
- **Thumbnail scaling (template picker pattern):** render slide HTML into a `.card__preview` div, then inside two nested `requestAnimationFrame` calls set `inner.style.transform = 'scale(' + (preview.offsetWidth / 960) + ')'`
- **File reading:** `dom.fileInputLoad` is a hidden `<input type="file">` — click it programmatically, read result in its `change` handler
- **CSS embed:** `./build-css.sh` re-embeds `css/slides.css` into `index.html`. Run after CSS edits.
- **Dialog:** `Dialog.choose(title, body, buttons[])` returns a Promise resolving to the chosen `value`. `Dialog.alert(title, body, type)` for errors.

---

## Task 1: Feature 1 — Jump to slide on preview close (preview.js)

**Files:**
- Modify: `js/preview.js`

### Step 1: Add `onClose` storage to `slideshowState`

In `preview.js`, find the `slideshowState` object (around line 59):

```js
var slideshowState = {
  slides: [],
  theme: '',
  currentIndex: 0,
  renderedSlides: []
};
```

Add `onClose: null`:

```js
var slideshowState = {
  slides: [],
  theme: '',
  currentIndex: 0,
  renderedSlides: [],
  onClose: null
};
```

### Step 2: Accept callback in `openSlideshow`

Find the `openSlideshow` function signature (line ~66):

```js
function openSlideshow(slides, theme, startIndex) {
```

Change to:

```js
function openSlideshow(slides, theme, startIndex, onClose) {
```

Add one line directly after the `slideshowState.currentIndex = startAt;` assignment:

```js
slideshowState.onClose = (typeof onClose === 'function') ? onClose : null;
```

### Step 3: Call callback in `closeSlideshow`

Find `closeSlideshow` (line ~185). After `unbindSlideshowEvents();`, add:

```js
if (slideshowState.onClose) {
  var closedSlide = slideshowState.slides[slideshowState.currentIndex];
  if (closedSlide) {
    slideshowState.onClose(closedSlide.id);
  }
  slideshowState.onClose = null;
}
```

### Step 4: Verify manually

Open the app in the browser. Select slide 3. Open Preview. Navigate to slide 7. Press Escape. The editor should now show slide 7 selected in the sidebar and its form in the editor panel.

### Step 5: Commit

```bash
git add js/preview.js
git commit -m "feat: jump editor to current slide when closing slideshow preview"
```

---

## Task 2: Feature 1 — Wire callback in controller.js

**Files:**
- Modify: `js/controller.js`

### Step 1: Pass callback to `PreviewRenderer.openSlideshow`

Find the call to `window.PreviewRenderer.openSlideshow` in the `openSlideshow` function in `controller.js` (around line 1622):

```js
window.PreviewRenderer.openSlideshow(visibleSlides, state.theme, startIndex);
```

Change to:

```js
window.PreviewRenderer.openSlideshow(visibleSlides, state.theme, startIndex, function (slideId) {
  if (slideId) selectSlide(slideId);
});
```

### Step 2: Verify manually

Same test as Task 1 Step 4 — confirm the editor jumps to the slide shown when preview closes (Escape key and clicking the X button both work).

### Step 3: Commit

```bash
git add js/controller.js
git commit -m "feat: wire onClose callback so editor selects slide shown at preview close"
```

---

## Task 3: Feature 3 — Mouse-only controls CSS (builder.css)

This task is CSS-only. No JS yet.

**Files:**
- Modify: `css/builder.css`

### Step 1: Make controls hidden by default

Find the `.slideshow-modal__header` rule (around line 1263 in `builder.css`). Add three properties inside the existing rule block:

```
opacity: 0;
pointer-events: none;
transition: opacity 0.3s ease;
```

Find `.slideshow-modal__nav` (around line 1332). The rule already has `transition: all var(--builder-transition)`. Change transition and add opacity/pointer-events:

```
transition: all var(--builder-transition), opacity 0.3s ease;
opacity: 0;
pointer-events: none;
```

Find `.slideshow-modal__dots` (around line 1358). Add:

```
opacity: 0;
pointer-events: none;
transition: opacity 0.3s ease;
```

### Step 2: Add visible state class rules

After the `.slideshow-modal__dots` rule block, add a new block:

```css
/* UI controls shown only when mouse is active */
.slideshow-modal--ui-visible .slideshow-modal__header,
.slideshow-modal--ui-visible .slideshow-modal__nav,
.slideshow-modal--ui-visible .slideshow-modal__dots {
  opacity: 1;
  pointer-events: auto;
}
```

### Step 3: Run build-css.sh

```bash
cd "/Users/niklasbrown/Desktop/Claude Tools/Presentation builder" && ./build-css.sh
```

Expected output: `CSS embedded: NNNNN chars`

### Step 4: Verify visually

Open the app. Open the preview. The nav arrows, counter, close button, and dots should now be invisible. (The JS to show them on mouse movement comes in the next task.)

### Step 5: Commit

```bash
git add css/builder.css index.html
git commit -m "feat: slideshow controls hidden by default, revealed by --ui-visible class"
```

---

## Task 4: Feature 3 — Mouse/keyboard control JS (preview.js)

**Files:**
- Modify: `js/preview.js`

### Step 1: Add module-level variables

Near the existing `var slideshowKeyHandler = null;` and `var slideshowResizeHandler = null;` declarations (around line 192), add:

```js
var slideshowMouseMoveHandler = null;
var slideshowUiTimer = null;
```

### Step 2: Add helper functions

After the `slideshowResizeHandler = null;` line, add:

```js
function showSlideshowUi() {
  var modal = document.getElementById('slideshow-modal');
  if (!modal) return;
  modal.classList.add('slideshow-modal--ui-visible');
  clearTimeout(slideshowUiTimer);
  slideshowUiTimer = setTimeout(hideSlideshowUi, 2500);
}

function hideSlideshowUi() {
  var modal = document.getElementById('slideshow-modal');
  if (!modal) return;
  modal.classList.remove('slideshow-modal--ui-visible');
  clearTimeout(slideshowUiTimer);
  slideshowUiTimer = null;
}
```

### Step 3: Show controls on open, bind mousemove

In `openSlideshow`, just before the call to `bindSlideshowEvents()` (around line 121), add:

```js
showSlideshowUi();
```

In `bindSlideshowEvents`, after the `dots.onclick` assignment, add:

```js
var modal = document.getElementById('slideshow-modal');
slideshowMouseMoveHandler = function () { showSlideshowUi(); };
modal.addEventListener('mousemove', slideshowMouseMoveHandler);
```

### Step 4: Hide controls on keyboard navigation

In the existing `slideshowKeyHandler` inside `bindSlideshowEvents`, add `hideSlideshowUi()` before each `goToSlide` call:

Find:
```js
if (e.key === 'ArrowRight' || e.key === ' ') {
  e.preventDefault();
  goToSlide(slideshowState.currentIndex + 1);
} else if (e.key === 'ArrowLeft') {
  e.preventDefault();
  goToSlide(slideshowState.currentIndex - 1);
```

Change to:
```js
if (e.key === 'ArrowRight' || e.key === ' ') {
  e.preventDefault();
  hideSlideshowUi();
  goToSlide(slideshowState.currentIndex + 1);
} else if (e.key === 'ArrowLeft') {
  e.preventDefault();
  hideSlideshowUi();
  goToSlide(slideshowState.currentIndex - 1);
```

### Step 5: Clean up on close

In `unbindSlideshowEvents`, after the existing `if (slideshowResizeHandler)` block, add:

```js
if (slideshowMouseMoveHandler) {
  var modal = document.getElementById('slideshow-modal');
  if (modal) modal.removeEventListener('mousemove', slideshowMouseMoveHandler);
  slideshowMouseMoveHandler = null;
}
clearTimeout(slideshowUiTimer);
slideshowUiTimer = null;
hideSlideshowUi();
```

### Step 6: Verify manually

Open the preview. Controls should appear for ~2.5s then fade. Move the mouse — controls reappear. Press arrow keys — controls disappear immediately. Click nav buttons (mouse click also triggers mousemove) — controls stay visible. Press Escape — modal closes cleanly.

### Step 7: Commit

```bash
git add js/preview.js
git commit -m "feat: slideshow controls visible on mouse movement, hidden on keyboard navigation"
```

---

## Task 5: Feature 2 — Import picker modal HTML (index.html)

**Files:**
- Modify: `index.html`

### Step 1: Add hidden file input for import

Find the existing hidden file input `file-input-load` near the bottom of `index.html`. Add a sibling input immediately after it:

```html
<input type="file" id="file-input-import" style="display:none" accept=".json,.html,.htm">
```

### Step 2: Add import picker modal

After the slideshow modal's closing `</div>` (around line 180), add:

```html
<!-- ===== MODAL: Import Slides Picker ===== -->
<div class="modal modal--import-picker" id="modal-import-picker" aria-hidden="true">
  <div class="modal__overlay" id="import-picker-overlay"></div>
  <div class="modal__content modal__content--wide">
    <div class="modal__header">
      <h3 class="modal__title" id="import-picker-title">Import Slides</h3>
      <button class="modal__close" id="import-picker-close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="import-picker__toolbar">
      <span class="import-picker__count" id="import-picker-count">0 selected</span>
      <button class="builder-btn builder-btn--ghost builder-btn--sm" id="import-picker-select-all">Select all</button>
    </div>
    <div class="import-picker__grid" id="import-picker-grid">
      <!-- Dynamically rendered slide thumbnails -->
    </div>
    <div class="import-picker__footer">
      <button class="builder-btn builder-btn--ghost" id="import-picker-cancel">Cancel</button>
      <button class="builder-btn builder-btn--primary" id="import-picker-confirm" disabled>Import Selected</button>
    </div>
  </div>
</div>
```

### Step 3: Verify structure renders

Open the app, open browser DevTools, run:
```js
document.getElementById('modal-import-picker').classList.add('modal--visible')
```
The modal overlay and content panel should appear. Close it with:
```js
document.getElementById('modal-import-picker').classList.remove('modal--visible')
```

### Step 4: Commit

```bash
git add index.html
git commit -m "feat: add import slides picker modal HTML scaffold"
```

---

## Task 6: Feature 2 — Import picker CSS (builder.css)

**Files:**
- Modify: `css/builder.css`

### Step 1: Add CSS at the end of builder.css

Append this block at the very end of `css/builder.css`:

```css
/* ==========================================================================
   Import Slides Picker Modal
   ========================================================================== */

.modal--import-picker .modal__content {
  max-width: 1100px;
  display: flex;
  flex-direction: column;
  max-height: 88vh;
}

.import-picker__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--builder-border);
}

.import-picker__count {
  font-size: 13px;
  color: var(--builder-text-muted);
}

.import-picker__grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  padding: 4px 2px;
}

.import-picker__card {
  position: relative;
  border: 2px solid var(--builder-border);
  border-radius: var(--builder-radius);
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--builder-transition);
  background: var(--builder-bg);
}

.import-picker__card:hover {
  border-color: var(--builder-accent);
}

.import-picker__card--selected {
  border-color: var(--builder-accent);
}

.import-picker__card__thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  position: relative;
}

.import-picker__card__thumb-inner {
  width: 960px;
  height: 540px;
  transform-origin: top left;
}

.import-picker__card__label {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--builder-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-top: 1px solid var(--builder-border);
}

.import-picker__card__checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid rgba(255,255,255,0.7);
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--builder-transition);
  pointer-events: none;
  z-index: 2;
}

.import-picker__card--selected .import-picker__card__checkbox {
  background: var(--builder-accent);
  border-color: var(--builder-accent);
}

.import-picker__card__checkbox-tick {
  display: none;
  width: 12px;
  height: 12px;
  stroke: #fff;
}

.import-picker__card--selected .import-picker__card__checkbox-tick {
  display: block;
}

.import-picker__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--builder-border);
}
```

### Step 2: Run build-css.sh

```bash
cd "/Users/niklasbrown/Desktop/Claude Tools/Presentation builder" && ./build-css.sh
```

### Step 3: Verify styling

Trigger the modal via DevTools as in Task 5 Step 3 and confirm the layout looks right — wide modal, correct footer button placement.

### Step 4: Commit

```bash
git add css/builder.css index.html
git commit -m "feat: import picker modal CSS — grid thumbnails with checkbox overlay"
```

---

## Task 7: Feature 2 — Import picker logic (controller.js)

**Files:**
- Modify: `js/controller.js`

### Step 1: Add module-level variables for picker state

Near the top of the controller IIFE (after the `state` declaration), add:

```js
var importPickerSlides = [];
var importPickerSelected = {};
```

### Step 2: Add `openImportPicker` function

Find the `/* --- Slideshow --- */` section (around line 1600). Insert before it:

```js
/* -----------------------------------------------------------------------
   Import Slides Picker
   ----------------------------------------------------------------------- */
function openImportPicker(parsedState, filename) {
  importPickerSlides = parsedState.slides || [];
  importPickerSelected = {};

  var modal = document.getElementById('modal-import-picker');
  var grid = document.getElementById('import-picker-grid');
  var title = document.getElementById('import-picker-title');
  var confirmBtn = document.getElementById('import-picker-confirm');
  var countEl = document.getElementById('import-picker-count');
  var selectAllBtn = document.getElementById('import-picker-select-all');

  if (!modal || !grid) return;

  title.textContent = 'Import Slides' + (filename ? ' \u2014 ' + filename : '');
  selectAllBtn.textContent = 'Select all';

  // Build thumbnail grid HTML (same pattern as template picker)
  var html = '';
  importPickerSlides.forEach(function (slide, i) {
    var template = window.SlideTemplates[slide.templateId];
    var thumbHtml = template ? template.render(slide.data) : '';
    var labelText = template ? template.getTitle(slide.data) : ('Slide ' + (i + 1));
    html += '<div class="import-picker__card" data-import-idx="' + i + '">';
    html += '<div class="import-picker__card__thumb">';
    html += '<div class="import-picker__card__thumb-inner" data-theme="' + (slide.theme || state.theme) + '">' + thumbHtml + '</div>';
    html += '</div>';
    html += '<div class="import-picker__card__checkbox">';
    html += '<svg class="import-picker__card__checkbox-tick" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1.5,6 4.5,9.5 10.5,2.5"/></svg>';
    html += '</div>';
    html += '<div class="import-picker__card__label">Slide ' + (i + 1) + ' \u2014 ' + labelText + '</div>';
    html += '</div>';
  });
  grid.innerHTML = html;

  // Scale thumbnails after layout settles (same pattern as template picker)
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      grid.querySelectorAll('.import-picker__card__thumb').forEach(function (thumb) {
        var inner = thumb.querySelector('.import-picker__card__thumb-inner');
        if (inner) {
          inner.style.transform = 'scale(' + (thumb.offsetWidth / 960) + ')';
          inner.style.transformOrigin = 'top left';
        }
      });
    });
  });

  function updateConfirmState() {
    var selectedCount = Object.keys(importPickerSelected).filter(function (k) {
      return importPickerSelected[k];
    }).length;
    countEl.textContent = selectedCount + ' selected';
    confirmBtn.disabled = selectedCount === 0;
  }
  updateConfirmState();

  // Card click: toggle selection
  grid.onclick = function (e) {
    var card = e.target.closest('[data-import-idx]');
    if (!card) return;
    var idx = parseInt(card.dataset.importIdx, 10);
    importPickerSelected[idx] = !importPickerSelected[idx];
    card.classList.toggle('import-picker__card--selected', !!importPickerSelected[idx]);
    updateConfirmState();
  };

  // Select all / deselect all
  selectAllBtn.onclick = function () {
    var allSelected = importPickerSlides.every(function (_, i) { return importPickerSelected[i]; });
    importPickerSlides.forEach(function (_, i) { importPickerSelected[i] = !allSelected; });
    grid.querySelectorAll('[data-import-idx]').forEach(function (card) {
      card.classList.toggle('import-picker__card--selected', !!importPickerSelected[parseInt(card.dataset.importIdx, 10)]);
    });
    selectAllBtn.textContent = allSelected ? 'Select all' : 'Deselect all';
    updateConfirmState();
  };

  confirmBtn.onclick = function () {
    var toImport = importPickerSlides.filter(function (_, i) { return importPickerSelected[i]; });
    confirmImport(toImport);
  };

  document.getElementById('import-picker-cancel').onclick = function () { closeModal(modal); };
  document.getElementById('import-picker-close').onclick = function () { closeModal(modal); };
  document.getElementById('import-picker-overlay').onclick = function () { closeModal(modal); };

  openModal(modal);
}

function confirmImport(slides) {
  var firstNewId = null;
  slides.forEach(function (original) {
    var copy = {
      id: uid(),
      templateId: original.templateId,
      theme: original.theme || state.theme,
      hidden: false,
      data: JSON.parse(JSON.stringify(original.data))
    };
    if (!firstNewId) firstNewId = copy.id;
    state.slides.push(copy);
  });

  closeModal(document.getElementById('modal-import-picker'));
  renderSidebar();
  autoSave();

  if (firstNewId) selectSlide(firstNewId);
}
```

### Step 3: Cache import file input in `cacheDom`

Find `cacheDom()` (around line 59). Add:

```js
dom.fileInputImport = document.getElementById('file-input-import');
```

### Step 4: Add "Import Slides" to the Load dialog

Find the `Dialog.choose('Load Presentation', ...)` options array (around line 1738):

```js
{ label: 'PowerPoint', style: 'secondary', value: 'pptx' },
{ label: 'Cancel', style: 'ghost', value: null }
```

Change to:

```js
{ label: 'PowerPoint', style: 'secondary', value: 'pptx' },
{ label: 'Import Slides', style: 'secondary', value: 'import' },
{ label: 'Cancel', style: 'ghost', value: null }
```

In the `.then(function (choice) {` handler, add a new branch. Find where `choice === 'html'` leads to `dom.fileInputLoad.click()` and add after:

```js
} else if (choice === 'import') {
  dom.fileInputImport.click();
}
```

### Step 5: Bind import file input change handler

Find `dom.fileInputLoad.addEventListener('change', ...)`. After the entire handler block closes (`});`), add:

```js
dom.fileInputImport.addEventListener('change', function (e) {
  var file = e.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function (ev) {
    var content = ev.target.result;
    var parsed = null;

    if (file.name.endsWith('.json')) {
      try { parsed = JSON.parse(content); }
      catch (err) {
        Dialog.alert('Invalid File', 'This file is not a valid JSON file.', 'error');
        return;
      }
    } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      parsed = extractStateFromHtml(content);
      if (!parsed) {
        Dialog.alert('Cannot Import', 'This HTML file does not contain embedded presentation data.\n\nOnly HTML files exported from this tool can be re-imported.', 'error');
        return;
      }
    }

    if (parsed && parsed.slides && parsed.slides.length > 0) {
      openImportPicker(parsed, file.name);
    } else {
      Dialog.alert('No Slides Found', 'This file does not contain any slides to import.', 'warning');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});
```

### Step 6: Verify manually

1. Save current presentation as JSON.
2. Click Load → "Import Slides". Select that JSON.
3. Picker opens with thumbnails. Check some slides, click "Import Selected".
4. Those slides appear appended. First imported slide is selected in editor.
5. Test "Select all" → "Deselect all" toggle.
6. Test Cancel — no slides imported.
7. Test with an HTML export too.

### Step 7: Commit

```bash
git add js/controller.js
git commit -m "feat: import slides picker — select individual slides from JSON/HTML presentations"
```

---

## Task 8: Final verification pass

### Step 1: Test all three features together

1. **Feature 1:** Open preview from slide 2, navigate to slide 5, press Escape. Editor jumps to slide 5.
2. **Feature 2:** Load → Import Slides → pick a JSON → select 3 slides → Import. Slides appended, first selected.
3. **Feature 3:** Open preview. Controls visible 2.5s then fade. Mouse move — reappear. Arrow key — hide immediately. Click close — modal closes, editor on correct slide (Feature 1 combo).

### Step 2: Check CSS is embedded

```bash
cd "/Users/niklasbrown/Desktop/Claude Tools/Presentation builder" && ./build-css.sh
```

### Step 3: Final commit if any loose changes remain

```bash
git status
# stage and commit anything outstanding
```
