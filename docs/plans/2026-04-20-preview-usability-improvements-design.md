# Design: Preview Usability Improvements

**Date:** 2026-04-20  
**Status:** Approved

---

## Overview

Three independent usability improvements to the slideshow preview and load workflow:

1. **Jump to slide on close** — when closing the preview, the editor selects the slide you were viewing
2. **Import slides picker** — load individual slides from another JSON or HTML presentation into the current one
3. **Mouse-only controls** — slideshow UI controls (nav arrows, counter, close, dots) are hidden during keyboard navigation, visible on mouse movement

---

## Feature 1: Jump to editor slide on preview close

### Problem

After browsing slides in the preview, closing it returns the editor to whichever slide was selected before opening — not the one you were just looking at.

### Design

**`preview.js`**
- `openSlideshow(slides, theme, startIndex, onCloseCallback)` — adds optional 4th parameter, stored as `slideshowState.onClose`
- `closeSlideshow()` — after hiding the modal, calls `slideshowState.onClose(slideId)` if set, where `slideId` is `slideshowState.slides[slideshowState.currentIndex].id`

**`controller.js`**
- `openSlideshow(fromCurrent)` passes a callback to `PreviewRenderer.openSlideshow`:
  ```js
  function(slideId) { selectSlide(slideId); }
  ```

No new DOM, no new files. Pure callback wiring.

---

## Feature 2: Import slides picker

### Problem

Loading a presentation replaces the entire current presentation. There is no way to pull individual slides from a second presentation into the current one.

### Design

**Load dialog** — add a 4th option:
```js
{ label: 'Import Slides', style: 'secondary', value: 'import' }
```
Accepts `.json` and `.html`. File parsing reuses existing `JSON.parse` / `extractStateFromHtml` paths.

**New picker modal** — added to `index.html`:
- Full-screen overlay (dark, `z-index` above editor)
- Title bar: "Import Slides — [filename]"
- "Select all / Deselect all" toggle link
- Scrollable grid of slide thumbnail cards (same rendering approach as template picker: `SlideTemplates[id].render(data)` scaled to card width)
- Each card has a checkbox overlay in the top-left corner
- Footer: **Import Selected** (primary, disabled when none selected) + **Cancel** (ghost)

**New CSS** in `builder.css` — `.import-picker-modal` block, matching existing modal visual language.

**New functions in `controller.js`**:
- `openImportPicker(parsedState, filename)` — builds and shows the modal
- `confirmImport(selectedSlides)` — assigns fresh `uid()` IDs, appends to `state.slides`, calls `renderSidebar()`, `autoSave()`, closes modal

### Data flow

```
btn-load click
  → Dialog.choose → 'import'
  → fileInputLoad.click (accept: .json, .html)
  → FileReader.onload
  → JSON.parse / extractStateFromHtml
  → openImportPicker(parsedState)
  → user selects slides → Import Selected
  → confirmImport(selectedSlides)
  → state.slides.push(...) → renderSidebar() → autoSave()
```

---

## Feature 3: Mouse-only controls in slideshow

### Problem

Nav arrows, counter, close button, and dot indicators appear on every slide change when using keyboard navigation, which is distracting during a presentation.

### Design

**CSS** — controls hidden by default, visible when class is present:
```css
.slideshow-modal__header,
.slideshow-modal__nav,
.slideshow-modal__dots {
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.slideshow-modal--ui-visible .slideshow-modal__header,
.slideshow-modal--ui-visible .slideshow-modal__nav,
.slideshow-modal--ui-visible .slideshow-modal__dots {
  opacity: 1;
  pointer-events: auto;
}
```

**JS in `preview.js`** (inside `bindSlideshowEvents` / `unbindSlideshowEvents`):
- `mousemove` on modal → add `slideshow-modal--ui-visible`, reset 2500ms debounce timer
- debounce timer fires → remove `slideshow-modal--ui-visible`
- `keydown` handler (existing) → clear timer + remove `slideshow-modal--ui-visible` before navigating
- `closeSlideshow` → clear timer + remove class

No new DOM. CSS transition handles the fade.

---

## Files changed

| File | Changes |
|------|---------|
| `js/preview.js` | Feature 1 callback; Feature 3 mouse/keyboard tracking |
| `js/controller.js` | Feature 1 callback wiring; Feature 2 import picker logic |
| `index.html` | Feature 2 picker modal HTML |
| `css/builder.css` | Feature 2 picker modal styles; Feature 3 control visibility styles |
| `build-css.sh` / re-embed | Re-embed CSS into index.html after CSS edits |
