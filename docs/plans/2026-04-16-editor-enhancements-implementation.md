# Editor Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add list item indentation, editable section titles, bar chart highlight column, and a wide-layout view switcher to the presentation builder.

**Architecture:** All changes use Approach A — extend existing data structures in-place. List items migrate from `string[]` to `{text,indent}[]`; titles and chart highlights are new optional fields; layout preference lives in `localStorage`. No migration layer needed; absent fields degrade to defaults.

**Tech Stack:** Vanilla JS, CSS custom properties. No build step beyond `build-css.sh` to re-embed `slides.css` into `index.html`.

---

## Task 1: List item data model — backwards-compatible read helpers

**Files:**
- Modify: `js/controller.js` (renderListField, setupEditorEvents list handlers)

Everywhere the code reads a list item as a plain string, it must now accept either a plain string (legacy) or a `{text, indent}` object (new).

**Step 1: Understand current list item reading sites**

These are the four sites in `controller.js` that touch list item values:

1. `renderListField()` line 606 – iterates items to render inputs
2. List input handler line 732 – writes `items[i] = el.value`
3. List add handler line 744 – pushes `''`
4. List remove handler line 755 – splices + maybe pushes `''`

**Step 2: Add a helper function near the top of the IIFE in controller.js (after `function escAttr`)**

Add this function after `escAttr` (around line 654):

```javascript
  // Normalise a list item: accepts plain string (legacy) or {text,indent} object
  function listItem(raw) {
    if (raw && typeof raw === 'object') return raw;
    return { text: raw || '', indent: 0 };
  }
```

**Step 3: Update `renderListField` (controller.js ~line 602) to use the helper**

Replace the existing function body to handle both formats:

```javascript
  function renderListField(field, items, slide) {
    items = items || [''];
    var html = '<div class="form-list" data-key="' + field.key + '">';

    items.forEach(function (raw, i) {
      var item = listItem(raw);
      html += '<div class="form-list__item" draggable="true" data-list-row-key="' + field.key + '" data-list-row-index="' + i + '">';
      html += '<span class="form-list__drag-handle" title="Drag to reorder">';
      html += '<svg width="10" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>';
      html += '</span>';
      // Indent/unindent buttons
      html += '<button type="button" class="form-list__indent-btn" data-list-unindent="' + field.key + '" data-list-index="' + i + '" title="Unindent"' + (item.indent === 0 ? ' disabled' : '') + '>';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15,18 9,12 15,6"/></svg>';
      html += '</button>';
      html += '<button type="button" class="form-list__indent-btn" data-list-indent="' + field.key + '" data-list-index="' + i + '" title="Indent"' + (item.indent >= 1 ? ' disabled' : '') + '>';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9,18 15,12 9,6"/></svg>';
      html += '</button>';
      html += '<input type="text" class="form-input form-list__text-input" data-list-key="' + field.key + '" data-list-index="' + i + '" value="' + escAttr(item.text) + '" placeholder="' + escAttr(field.placeholder || '') + '">';
      html += '<button type="button" class="form-list__remove" data-list-remove="' + field.key + '" data-list-index="' + i + '" title="Remove">';
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      html += '</button>';
      html += '</div>';
    });

    var maxItems = field.maxItems || 10;
    if (items.length < maxItems) {
      html += '<button type="button" class="form-list__add" data-list-add="' + field.key + '">';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add item';
      html += '</button>';
    }

    html += '</div>';
    return html;
  }
```

**Step 4: Update the list input handler in `setupEditorEvents` (~line 730)**

Replace:
```javascript
    dom.editorForm.querySelectorAll('[data-list-key]').forEach(function (el) {
      el.addEventListener('input', function () {
        var items = slide.data[el.dataset.listKey] || [];
        items[parseInt(el.dataset.listIndex, 10)] = el.value;
        updateSlideData(slide.id, el.dataset.listKey, items);
        debouncedThumbnailUpdate();
      });
    });
```
With:
```javascript
    dom.editorForm.querySelectorAll('[data-list-key]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.dataset.listKey;
        var idx = parseInt(el.dataset.listIndex, 10);
        var items = (slide.data[key] || []).slice();
        var cur = listItem(items[idx]);
        items[idx] = { text: el.value, indent: cur.indent };
        updateSlideData(slide.id, key, items);
        debouncedThumbnailUpdate();
      });
    });
```

**Step 5: Update the list add handler (~line 740)**

Replace:
```javascript
        var items = slide.data[key] || [];
        items.push('');
```
With:
```javascript
        var items = (slide.data[key] || []).slice();
        items.push({ text: '', indent: 0 });
```

**Step 6: Update the list remove handler (~line 750)**

Replace:
```javascript
        var items = slide.data[key] || [];
        items.splice(idx, 1);
        if (items.length === 0) items.push('');
```
With:
```javascript
        var items = (slide.data[key] || []).slice();
        items.splice(idx, 1);
        if (items.length === 0) items.push({ text: '', indent: 0 });
```

**Step 7: Add indent/unindent click handlers in `setupEditorEvents`, after the list remove handler block (~line 762)**

```javascript
    // List indent
    dom.editorForm.querySelectorAll('[data-list-indent]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.listIndent;
        var idx = parseInt(btn.dataset.listIndex, 10);
        var items = (slide.data[key] || []).slice();
        var cur = listItem(items[idx]);
        if (cur.indent < 1) {
          items[idx] = { text: cur.text, indent: 1 };
          updateSlideData(slide.id, key, items);
          renderEditor();
        }
      });
    });

    // List unindent
    dom.editorForm.querySelectorAll('[data-list-unindent]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.listUnindent;
        var idx = parseInt(btn.dataset.listIndex, 10);
        var items = (slide.data[key] || []).slice();
        var cur = listItem(items[idx]);
        if (cur.indent > 0) {
          items[idx] = { text: cur.text, indent: 0 };
          updateSlideData(slide.id, key, items);
          renderEditor();
        }
      });
    });
```

**Step 8: Update the drag-drop drop handler to reset indent on drop (~line 442-456)**

In `setupListDragDrop`, inside the `drop` event handler, find:
```javascript
        var moved = items.splice(dragState.fromIdx, 1)[0];
        items.splice(toIdx, 0, moved);
```
Replace with:
```javascript
        var moved = items.splice(dragState.fromIdx, 1)[0];
        var movedNorm = listItem(moved);
        movedNorm = { text: movedNorm.text, indent: 0 }; // reset on drop
        items.splice(toIdx, 0, movedNorm);
```

**Step 9: Verify manually**
Open the app, add a list field, check that items can be indented/unindented and that drag-and-drop resets indent.

**Step 10: Commit**
```bash
git add js/controller.js
git commit -m "feat: list item indent/unindent buttons with {text,indent} data model"
```

---

## Task 2: List item indentation — slide preview styling

**Files:**
- Modify: `css/slides.css` (add indent CSS)
- Modify: `js/templates.js` (render indented items in Product Spec and Data & Graph)

**Step 1: Add CSS for indented list items to `css/slides.css`**

After the `.pres-spec-feature` block (~line where `.pres-spec-feature__icon` ends), add:

```css
/* Indented list item (hierarchy level 1) */
.pres-spec-feature--indent {
  padding-left: 1.5em;
}

.pres-bullet-item--indent {
  padding-left: 1.5em;
}
```

**Step 2: Update Product Spec feature rendering in `templates.js` (~line 372)**

Replace:
```javascript
          data.features.forEach(function (feature) {
            if (feature && feature.trim()) {
              html += '<div class="pres-spec-feature">';
              html += '<span class="pres-spec-feature__icon">' + checkSvg + '</span>';
              html += '<span>' + escapeHtml(feature) + '</span>';
              html += '</div>';
            }
          });
```
With:
```javascript
          data.features.forEach(function (raw) {
            var item = (raw && typeof raw === 'object') ? raw : { text: raw || '', indent: 0 };
            if (item.text && item.text.trim()) {
              html += '<div class="pres-spec-feature' + (item.indent ? ' pres-spec-feature--indent' : '') + '">';
              html += '<span class="pres-spec-feature__icon">' + checkSvg + '</span>';
              html += '<span>' + escapeHtml(item.text) + '</span>';
              html += '</div>';
            }
          });
```

**Step 3: Update Data & Graph notes rendering in `templates.js` (~line 682)**

Replace:
```javascript
          data.notes.forEach(function (note) {
            if (note && note.trim()) {
              html += '<li class="pres-bullet-item"><span class="pres-bullet-item__marker"></span>' + escapeHtml(note) + '</li>';
            }
          });
```
With:
```javascript
          data.notes.forEach(function (raw) {
            var item = (raw && typeof raw === 'object') ? raw : { text: raw || '', indent: 0 };
            if (item.text && item.text.trim()) {
              html += '<li class="pres-bullet-item' + (item.indent ? ' pres-bullet-item--indent' : '') + '"><span class="pres-bullet-item__marker"></span>' + escapeHtml(item.text) + '</li>';
            }
          });
```

Also update the guard condition on line 678 to handle objects:
```javascript
        if (data.notes && data.notes.some(function (n) {
          var t = (n && typeof n === 'object') ? n.text : n;
          return t && t.trim();
        })) {
```

**Step 4: Run build-css.sh to re-embed slides.css**
```bash
cd "/Users/niklasbrown/Desktop/Claude Tools/Presentation builder" && bash build-css.sh
```

**Step 5: Verify manually**
Open the app, add indented items, confirm indentation shows in the live preview.

**Step 6: Commit**
```bash
git add css/slides.css js/templates.js index.html
git commit -m "feat: render indented list items in slide preview"
```

---

## Task 3: Editable section titles

**Files:**
- Modify: `js/controller.js` (render title input above list fields)
- Modify: `js/templates.js` (use stored title or default)

**Step 1: Add a title input renderer in `renderField` in `controller.js`**

Find the `renderField` function that dispatches on `field.type`. Locate where the list field is rendered (look for `renderListField` call). The pattern in `renderField` wraps each field in a `.form-group`. Before the existing `renderListField` call, we need to optionally prepend a title input.

Find the block in `renderField` that handles list fields. It looks like:
```javascript
    } else if (field.type === 'list') {
      fieldHtml = renderListField(field, slide.data[field.key], slide);
```

Replace it with:
```javascript
    } else if (field.type === 'list') {
      // Optional section-title input (only for fields that have a titleKey)
      if (field.titleKey) {
        var defaultTitle = field.titleDefault || '';
        var currentTitle = slide.data[field.titleKey] || defaultTitle;
        fieldHtml += '<div class="form-group form-group--title-input">';
        fieldHtml += '<label class="form-label">Section title</label>';
        fieldHtml += '<input type="text" class="form-input" data-key="' + field.titleKey + '" value="' + escAttr(currentTitle) + '" placeholder="' + escAttr(defaultTitle) + '">';
        fieldHtml += '</div>';
      }
      fieldHtml += renderListField(field, slide.data[field.key], slide);
```

(Note: `fieldHtml` starts as `''` at the top of each case, so `+=` on a fresh `fieldHtml` is fine. Check the actual variable name used in `renderField` — it may be `html` or `fieldHtml`; adjust accordingly.)

**Step 2: Add `titleKey` and `titleDefault` to the Product Spec template fields in `templates.js`**

Find the `features` field definition in the Product Spec template (~line 332):
```javascript
          { key: 'features', type: 'list', label: 'Key Features', ... }
```
Add `titleKey` and `titleDefault`:
```javascript
          { key: 'features', type: 'list', label: 'Key Features', titleKey: 'featuresTitle', titleDefault: 'Key Features', placeholder: 'Feature...', maxItems: 8 }
```
(Match whatever existing properties are on that field object.)

**Step 3: Add `titleKey` and `titleDefault` to the Data & Graph template fields in `templates.js`**

Find the `notes` field definition (~line 606):
```javascript
          { key: 'notes', type: 'list', label: 'Detail Notes', ... }
```
Add:
```javascript
          { key: 'notes', type: 'list', label: 'Detail Notes', titleKey: 'notesTitle', titleDefault: 'Key Insights', placeholder: 'Insight...', maxItems: 6 }
```

**Step 4: Update hard-coded title in Product Spec render in `templates.js` (~line 371)**

Replace:
```javascript
          html += '<div class="pres-spec-features__title">Key Features</div>';
```
With:
```javascript
          html += '<div class="pres-spec-features__title">' + escapeHtml(data.featuresTitle || 'Key Features') + '</div>';
```

**Step 5: Update hard-coded title in Data & Graph render in `templates.js` (~line 680)**

Replace:
```javascript
          html += '<div class="pres-graph-notes-title">Key Insights</div>';
```
With:
```javascript
          html += '<div class="pres-graph-notes-title">' + escapeHtml(data.notesTitle || 'Key Insights') + '</div>';
```

**Step 6: Verify manually**
Open Product Spec slide — confirm "Section title" input appears above Key Features list. Change it, confirm the preview updates. Same for Data & Graph notes.

**Step 7: Run build-css.sh (templates.js changed but not CSS — skip unless CSS changed)**

**Step 8: Commit**
```bash
git add js/controller.js js/templates.js
git commit -m "feat: editable section titles for Key Features and Key Insights lists"
```

---

## Task 4: Bar chart highlight column

**Files:**
- Modify: `js/templates.js` (parseCSV + barChart)
- Modify: `css/slides.css` (no change needed — uses existing CSS variable)

**Step 1: Update `parseCSV` to read optional 3rd column (~line 36)**

Replace:
```javascript
    parseCSV: function (raw) {
      // Accepts "label,value" lines or just "value" lines
      var rows = [];
      if (!raw) return rows;
      raw.split('\n').forEach(function (line) {
        line = line.trim();
        if (!line) return;
        var parts = line.split(',');
        if (parts.length >= 2) {
          rows.push({ label: parts[0].trim(), value: parseFloat(parts[1]) || 0 });
        } else {
          var v = parseFloat(parts[0]);
          if (!isNaN(v)) rows.push({ label: '', value: v });
        }
      });
      return rows;
    },
```
With:
```javascript
    parseCSV: function (raw) {
      // Accepts "label,value[,highlight]" lines or just "value" lines
      var rows = [];
      if (!raw) return rows;
      raw.split('\n').forEach(function (line) {
        line = line.trim();
        if (!line) return;
        var parts = line.split(',');
        if (parts.length >= 2) {
          rows.push({
            label: parts[0].trim(),
            value: parseFloat(parts[1]) || 0,
            highlight: parts.length >= 3 && parts[2].trim().toLowerCase() === 'highlight'
          });
        } else {
          var v = parseFloat(parts[0]);
          if (!isNaN(v)) rows.push({ label: '', value: v, highlight: false });
        }
      });
      return rows;
    },
```

**Step 2: Update `barChart` to use secondary color for highlighted bars (~line 78)**

Replace:
```javascript
        svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" style="fill:var(--pres-chart-color, ' + accentColor + ')" rx="2" opacity="0.85">';
```
With:
```javascript
        var fillStyle = d.highlight
          ? 'fill:var(--pres-accent-secondary, ' + accentColor + ')'
          : 'fill:var(--pres-chart-color, ' + accentColor + ')';
        svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" style="' + fillStyle + '" rx="2" opacity="0.85">';
```

**Step 3: Add helper hint below the chart data textarea**

In `controller.js`, find where the `chartdata` field type is rendered in `renderField`. After the textarea is added, append a hint span:

```javascript
    } else if (field.type === 'chartdata') {
      // ... existing textarea code ...
      fieldHtml += '<span class="form-field-hint">Add <code>,highlight</code> to a row to accent that bar (e.g. <code>Q2,185,highlight</code>)</span>';
```

**Step 4: Add `.form-field-hint` CSS to `builder.css`**

After the `.form-textarea` block, add:
```css
.form-field-hint {
  display: block;
  font-size: 11px;
  color: var(--builder-text-muted);
  margin-top: 5px;
  line-height: 1.4;
}

.form-field-hint code {
  background: var(--builder-surface-alt);
  border-radius: 3px;
  padding: 1px 4px;
  font-family: monospace;
  font-size: 10px;
  color: var(--builder-text-secondary);
}
```

**Step 5: Verify manually**
Open Data & Graph slide. Enter chart data with `,highlight` on one row. Confirm that bar renders in the secondary color (red for TRP, grey for Tektro).

**Step 6: Run build-css.sh**
```bash
bash build-css.sh
```

**Step 7: Commit**
```bash
git add js/templates.js js/controller.js css/builder.css index.html
git commit -m "feat: bar chart highlight column using ,highlight in chart data"
```

---

## Task 5: Wide layout view switcher

**Files:**
- Modify: `index.html` (add layout toggle buttons to header)
- Modify: `css/builder.css` (wide layout styles + toggle button styles)
- Modify: `js/controller.js` or `js/app.js` (layout preference JS)

**Step 1: Add layout toggle buttons to the header in `index.html`**

Inside `.builder-header__actions > .builder-header__btn-group` (line ~40), add a layout toggle group before the export buttons:

```html
      <div class="builder-layout-toggle" id="layout-toggle" title="Switch editor layout">
        <button class="builder-layout-btn" id="btn-layout-stacked" title="Stacked layout (editor above preview)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="8" rx="1"/>
            <rect x="3" y="13" width="18" height="8" rx="1"/>
          </svg>
        </button>
        <button class="builder-layout-btn" id="btn-layout-wide" title="Wide layout (editor beside preview)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="8" height="18" rx="1"/>
            <rect x="13" y="3" width="8" height="18" rx="1"/>
          </svg>
        </button>
      </div>
```

**Step 2: Add CSS for the layout toggle widget to `builder.css`**

After the `.builder-btn` block, add:

```css
/* --------------------------------------------------------------------------
   Layout Toggle
   -------------------------------------------------------------------------- */
.builder-layout-toggle {
  display: flex;
  align-items: center;
  background: var(--builder-surface-alt);
  border: 1px solid var(--builder-border);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
  margin-right: 8px;
}

.builder-layout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--builder-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.builder-layout-btn:hover {
  background: var(--builder-surface-hover);
  color: var(--builder-text);
}

.builder-layout-btn--active {
  background: var(--builder-surface-hover);
  color: var(--builder-text);
}
```

**Step 3: Add wide layout CSS to `builder.css`**

After the `.builder-main` block (find by searching for `.builder-main`), add:

```css
/* Wide layout: sidebar | editor | preview side by side */
.builder-layout--wide .builder-main {
  flex-direction: row;
  overflow: hidden;
}

.builder-layout--wide .builder-editor {
  flex: 1;
  min-width: 280px;
  max-width: 420px;
  border-right: 1px solid var(--builder-border);
  border-bottom: none;
  overflow-y: auto;
}

.builder-layout--wide .builder-preview {
  flex: 1;
  min-width: 360px;
  max-height: none;
  border-bottom: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@media (max-width: 1199px) {
  .builder-layout--wide .builder-main {
    flex-direction: column;
  }
  .builder-layout--wide .builder-editor {
    max-width: none;
    border-right: none;
    border-bottom: 1px solid var(--builder-border);
  }
  .builder-layout--wide .builder-preview {
    max-height: 50vh;
  }
}
```

**Step 4: Add layout preference JS**

Find where `controller.js` initialises the app (look for the `init()` function or `DOMContentLoaded` handler). Add this block:

```javascript
  /* -----------------------------------------------------------------------
     Layout preference (stacked / wide)
     ----------------------------------------------------------------------- */
  function initLayoutToggle() {
    var layout = localStorage.getItem('builderLayout') || 'stacked';
    applyLayout(layout);

    document.getElementById('btn-layout-stacked').addEventListener('click', function () {
      applyLayout('stacked');
      localStorage.setItem('builderLayout', 'stacked');
    });
    document.getElementById('btn-layout-wide').addEventListener('click', function () {
      applyLayout('wide');
      localStorage.setItem('builderLayout', 'wide');
    });
  }

  function applyLayout(layout) {
    var layoutEl = document.querySelector('.builder-layout');
    var stackedBtn = document.getElementById('btn-layout-stacked');
    var wideBtn = document.getElementById('btn-layout-wide');
    if (layout === 'wide') {
      layoutEl.classList.add('builder-layout--wide');
      stackedBtn.classList.remove('builder-layout-btn--active');
      wideBtn.classList.add('builder-layout-btn--active');
    } else {
      layoutEl.classList.remove('builder-layout--wide');
      stackedBtn.classList.add('builder-layout-btn--active');
      wideBtn.classList.remove('builder-layout-btn--active');
    }
    // Recalculate preview scaler after layout change
    if (typeof updatePreviewScale === 'function') updatePreviewScale();
    else if (typeof renderPreview === 'function') renderPreview();
  }
```

Call `initLayoutToggle()` at the end of the `init()` function (or wherever other UI initialisation calls are made).

**Step 5: Find the preview scaler function name**

Search `controller.js` for the function that sets `transform: scale(...)` on the preview scaler element. It may be called `updatePreviewScale`, `scalePreview`, or similar. Note the exact name and update the `applyLayout` call above to match.

**Step 6: Verify manually**
Reload the app. Toggle between stacked and wide layouts. Confirm the preview scaler still fits correctly in wide mode. Resize the window below 1200px and confirm the layout falls back to stacked.

**Step 7: Run build-css.sh**
```bash
bash build-css.sh
```

**Step 8: Commit**
```bash
git add index.html css/builder.css js/controller.js
git commit -m "feat: wide layout view switcher with localStorage persistence"
```

---

## Task 6: Final sync and smoke test

**Step 1: Run build-css.sh one final time**
```bash
bash build-css.sh
```

**Step 2: Open the app and smoke-test all four features**
- List indent: add items, indent/unindent, drag to confirm reset
- Editable titles: change "Key Features" and "Key Insights", confirm preview updates
- Chart highlight: enter `Q2,120,highlight`, confirm bar colour
- Layout switcher: toggle stacked/wide, reload and confirm preference persists

**Step 3: Commit if index.html changed**
```bash
git add index.html
git commit -m "chore: re-embed slides.css after final changes"
```
