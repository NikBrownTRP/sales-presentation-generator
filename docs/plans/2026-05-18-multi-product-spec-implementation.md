# Multi-Product Spec Slide — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the Product Spec slide template so a single slide can showcase 1–5 products, with an adaptive per-N layout and an accordion editor UX, while preserving the existing single-product slide pixel-identically.

**Architecture:** Internal data shape becomes a `products[]` array plus a `productCount` (1–5) and optional `slideHeading`. A migration helper rewrites legacy flat data into `products[0]` on first access. Rendering branches at N=1 (current layout, untouched) vs N≥2 (new `.pres-spec-card` grid with per-N modifier). The editor gains one spec-specific field type `product-group` that renders numbered collapsible sections wired to `slide.data.products[i]`.

**Tech Stack:** Vanilla JS (no build for JS), CSS embedded via `build-css.sh` into `index.html`. Files: `js/templates.js`, `js/app.js`, `css/slides.css`, `build-css.sh`.

**Design doc:** `docs/plans/2026-05-18-multi-product-spec-design.md`

**Note on testing:** This project has no automated test runner. "Verification" steps use manual browser checks via the dev server preview workflow described in the system prompt. Each task ends with a manual smoke check and a commit.

---

## Task 1: Add the data migration helper

**Files:**
- Modify: `js/templates.js` (top of file, near other helpers — e.g. just above `var checkSvg`)

**Why first:** Every later task depends on a stable `products[]` shape. Doing migration first means render and editor code can always assume the new shape.

**Step 1: Locate the helpers section**

Open `js/templates.js`. Find the first declaration that looks like a helper (e.g. `var checkSvg = ...` or `function escapeHtml`). Insert the new helper just above it.

**Step 2: Add `migrateSpecData` helper**

Insert (top of the IIFE / module, before the `templates` definition):

```js
/**
 * Migrate legacy single-product spec slide data into the multi-product shape.
 * Idempotent: if data.products is already an array, returns data unchanged.
 * Mutates and returns the same data object so callers can chain.
 *
 *   { productName, productImage, specs, features, featuresTitle, footnote, logo }
 *     ->
 *   {
 *     productCount: 1,
 *     slideHeading: '',
 *     products: [{ name, image, specs, features, featuresTitle }],
 *     footnote, logo
 *   }
 */
function migrateSpecData(data) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data.products)) return data;

  var p0 = {
    name: data.productName || '',
    image: data.productImage || '',
    specs: Array.isArray(data.specs) ? data.specs : [],
    features: Array.isArray(data.features) ? data.features : [],
    featuresTitle: data.featuresTitle || 'Key Features'
  };
  data.products = [p0];
  if (typeof data.productCount !== 'number') data.productCount = 1;
  if (typeof data.slideHeading !== 'string') data.slideHeading = '';
  return data;
}
```

**Step 3: Manual verification**

Open the app in the browser. Existing Product Spec slides must still load (we haven't changed render yet — the helper is unused so far). Confirm no JS errors in the console.

**Step 4: Commit**

```bash
git add js/templates.js
git commit -m "feat(spec): add migrateSpecData helper for multi-product shape"
```

---

## Task 2: Update `spec.fields` for multi-product editing

**Files:**
- Modify: `js/templates.js` around lines 517–531 (current `spec.fields` array)

**Step 1: Replace the `spec.fields` array**

Replace the existing `fields: [ ... ]` block inside `spec` with:

```js
fields: [
  {
    key: 'productCount', type: 'select', label: 'Number of products', defaultValue: 1,
    options: [
      { value: 1, label: '1 product' },
      { value: 2, label: '2 products' },
      { value: 3, label: '3 products' },
      { value: 4, label: '4 products' },
      { value: 5, label: '5 products' }
    ]
  },
  {
    key: 'slideHeading', type: 'text', label: 'Slide Heading',
    placeholder: 'e.g., Product Lineup',
    showWhen: function (data) { return Number(data.productCount || 1) >= 2; }
  },
  {
    key: 'products', type: 'product-group', label: 'Products'
  },
  { key: 'footnote', role: 'footnote', type: 'text', label: 'Footnote', placeholder: 'e.g., *Weight without rotors' },
  { key: 'logo', role: 'logo', type: 'image', label: 'Logo' }
],
```

Notes:
- `productCount` is stored as a number; the select option `value`s above are numbers, but HTML `<option value>` will coerce to string. The new event handler in Task 5 will `Number()` the value back.
- `showWhen` is a new optional field property used by the renderer (Task 3 wires it in).
- The legacy individual `productName`/`productImage`/`specs`/`features` field definitions are removed because they're now nested inside each product (handled by the `product-group` field type).

**Step 2: Update `getTitle`**

Replace the existing `getTitle` with:

```js
getTitle: function (data) {
  migrateSpecData(data);
  var n = Number(data.productCount || 1);
  if (n === 1) {
    var p = data.products[0] || {};
    return (p.name || 'Spec') + ' — Specs';
  }
  return (data.slideHeading || 'Product Lineup') + ' — ' + n + ' products';
},
```

**Step 3: Manual verification**

Open the app. The editor will likely render incompletely (the new `product-group` field type isn't implemented yet — `renderField` has no `case` for it, so nothing renders for it, which is fine). The `productCount` dropdown should appear. The `slideHeading` field should appear/disappear based on count (will fully work after Task 3).

This is an intentionally broken intermediate state — that's OK because the very next task wires the editor up.

**Step 4: Commit**

```bash
git add js/templates.js
git commit -m "feat(spec): switch spec.fields to multi-product schema"
```

---

## Task 3: Wire up `showWhen` conditional visibility in `renderField`

**Files:**
- Modify: `js/app.js` around lines 390–392 (where fields are iterated) and 425–471 (`renderField`)

**Step 1: Skip hidden fields during iteration**

Find this block (around line 390):

```js
template.fields.forEach(function (field) {
  html += renderField(field, slide);
});
```

Replace with:

```js
template.fields.forEach(function (field) {
  if (typeof field.showWhen === 'function' && !field.showWhen(slide.data)) return;
  html += renderField(field, slide);
});
```

**Step 2: Manual verification**

Reload the app. On a Product Spec slide:
- With `productCount = 1`, the "Slide Heading" field is hidden.
- Change `productCount` to 2 — Slide Heading appears after the form re-renders. (Re-render happens because the `productCount` select fires `input`, which writes to `slide.data` via `updateSlideData`; you may need to also trigger a re-render. If it doesn't re-render automatically, that's addressed in Task 5.)

**Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat(editor): support showWhen conditional field visibility"
```

---

## Task 4: Implement the `product-group` field type renderer

**Files:**
- Modify: `js/app.js` — extend `renderField` (around line 433 switch) and add a new helper `renderProductGroupField`

**Step 1: Add the new switch case**

In the `switch (field.type)` block in `renderField` (around lines 433–467), add before the closing brace:

```js
case 'product-group':
  html += renderProductGroupField(field, slide);
  break;
```

**Step 2: Add `renderProductGroupField` helper**

Insert directly after `renderKeyValueField` (around line 538):

```js
function renderProductGroupField(field, slide) {
  // Lean on the migration helper exposed by templates.js
  if (typeof window.migrateSpecData === 'function') window.migrateSpecData(slide.data);

  var n = Number(slide.data.productCount || 1);
  if (n < 1) n = 1; if (n > 5) n = 5;

  var products = slide.data.products || [];
  // Ensure at least n product slots exist (without destroying any extras)
  while (products.length < n) {
    products.push({ name: '', image: '', specs: [], features: [], featuresTitle: 'Key Features' });
  }
  slide.data.products = products;

  // Per-N caps (matches the design doc's "balanced" budget)
  var maxSpecs = (n === 1) ? 6 : 4;
  var maxFeatures = (n === 1) ? 6 : 3;

  // Which section is expanded? Persisted on slide.data so re-render keeps state.
  if (typeof slide.data._openProduct !== 'number' || slide.data._openProduct >= n) {
    slide.data._openProduct = 0;
  }
  var openIdx = slide.data._openProduct;

  var html = '<div class="form-product-group" data-key="' + field.key + '">';
  for (var i = 0; i < n; i++) {
    var p = products[i] || {};
    var isOpen = (i === openIdx);
    html += '<div class="form-product-section' + (isOpen ? ' form-product-section--open' : '') + '" data-product-index="' + i + '">';

    // Header (clickable)
    html += '<button type="button" class="form-product-section__header" data-product-toggle="' + i + '">';
    html += '<span class="form-product-section__num">Product ' + (i + 1) + '</span>';
    html += '<span class="form-product-section__name">' + escAttr(p.name || '') + '</span>';
    html += '<svg class="form-product-section__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    html += '</button>';

    // Body (only rendered when open — keeps DOM small)
    if (isOpen) {
      html += '<div class="form-product-section__body">';

      // Name
      html += '<div class="form-group"><label class="form-label form-label--required">Product Name</label>';
      html += '<input type="text" class="form-input" data-product-key="name" data-product-index="' + i + '" value="' + escAttr(p.name || '') + '" placeholder="e.g., TRP DH-R EVO"></div>';

      // Image
      html += '<div class="form-group"><label class="form-label">Product Image</label>';
      html += renderProductImageField(i, p.image);
      html += '</div>';

      // Specs (key-value, capped)
      html += '<div class="form-group"><label class="form-label">Specifications</label>';
      html += renderProductKvField(i, p.specs || [], maxSpecs);
      html += '</div>';

      // Features (list, capped)
      html += '<div class="form-group"><label class="form-label">Key Features</label>';
      html += renderProductListField(i, p.features || [], maxFeatures);
      html += '</div>';

      html += '</div>'; // body
    }

    html += '</div>'; // section
  }
  html += '</div>'; // form-product-group
  return html;
}

function renderProductImageField(productIndex, value) {
  var html = '<div class="form-image-upload" data-product-image-index="' + productIndex + '">';
  if (value) {
    html += '<div class="form-image-upload__preview">';
    html += '<img src="' + value + '" alt="">';
    html += '<div class="form-image-upload__edit-overlay">';
    html += '<button type="button" class="form-image-upload__edit-btn" data-product-image-replace="' + productIndex + '">Replace</button>';
    html += '</div>';
    html += '<button type="button" class="form-image-upload__remove" data-product-image-remove="' + productIndex + '" title="Remove image">&times;</button>';
    html += '</div>';
  } else {
    html += '<div class="form-image-upload__placeholder">';
    html += '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    html += '<span>Click or drag image here</span>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function renderProductKvField(productIndex, items, maxItems) {
  if (!items || !items.length) items = [{ key: '', value: '' }];
  var html = '<div class="form-spectable" data-product-kv-index="' + productIndex + '">';
  items.forEach(function (item, i) {
    html += '<div class="form-spectable__row">';
    html += '<input type="text" class="form-input" data-product-kv-input="' + productIndex + '" data-kv-row="' + i + '" data-kv-part="key" value="' + escAttr(item.key || '') + '" placeholder="Spec name">';
    html += '<input type="text" class="form-input" data-product-kv-input="' + productIndex + '" data-kv-row="' + i + '" data-kv-part="value" value="' + escAttr(item.value || '') + '" placeholder="Value">';
    html += '<button type="button" class="form-list__remove" data-product-kv-remove="' + productIndex + '" data-kv-row="' + i + '" title="Remove">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    html += '</button></div>';
  });
  if (items.length < maxItems) {
    html += '<button type="button" class="form-list__add" data-product-kv-add="' + productIndex + '">';
    html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add row';
    html += '</button>';
  }
  html += '</div>';
  return html;
}

function renderProductListField(productIndex, items, maxItems) {
  if (!items || !items.length) items = [''];
  var html = '<div class="form-list" data-product-list-index="' + productIndex + '">';
  items.forEach(function (raw, i) {
    var text = (raw && typeof raw === 'object') ? raw.text : raw;
    html += '<div class="form-list__item">';
    html += '<input type="text" class="form-input" data-product-list-input="' + productIndex + '" data-list-row="' + i + '" value="' + escAttr(text || '') + '" placeholder="Add a feature...">';
    html += '<button type="button" class="form-list__remove" data-product-list-remove="' + productIndex + '" data-list-row="' + i + '" title="Remove">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    html += '</button></div>';
  });
  if (items.length < maxItems) {
    html += '<button type="button" class="form-list__add" data-product-list-add="' + productIndex + '">';
    html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add feature';
    html += '</button>';
  }
  html += '</div>';
  return html;
}
```

**Step 3: Expose `migrateSpecData` on `window`**

In `js/templates.js`, near where other helpers are exposed (search for `window.escapeHtml` to find the pattern), add:

```js
window.migrateSpecData = migrateSpecData;
```

**Step 4: Manual verification (render only, no events yet)**

Reload the app. Open a Product Spec slide:
- Accordion sections render.
- Product 1 is expanded by default with all four sub-fields.
- Increase `productCount` (will not auto-re-render until Task 5, so manually click between slides to force a re-render).
- Verify no console errors.

**Step 5: Commit**

```bash
git add js/app.js js/templates.js
git commit -m "feat(editor): add product-group field renderer for spec slide"
```

---

## Task 5: Wire up event handlers for the product-group field

**Files:**
- Modify: `js/app.js` — extend `setupEditorEvents` (currently ends around line 683) and the `productCount` flow

**Step 1: Add event bindings at the bottom of `setupEditorEvents`**

Inside `setupEditorEvents`, just before its closing brace (line 683), add:

```js
// --- product-group: section toggle ---
dom.editorForm.querySelectorAll('[data-product-toggle]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var i = parseInt(btn.dataset.productToggle, 10);
    slide.data._openProduct = (slide.data._openProduct === i) ? -1 : i;
    renderEditor();
  });
});

// --- product-group: name input ---
dom.editorForm.querySelectorAll('[data-product-key="name"]').forEach(function (el) {
  el.addEventListener('input', function () {
    var i = parseInt(el.dataset.productIndex, 10);
    ensureProduct(slide, i).name = el.value;
    updateSlideData(slide.id, 'products', slide.data.products);
    debouncedThumbnailUpdate();
  });
});

// --- product-group: image upload (click / drag-drop / remove / replace) ---
dom.editorForm.querySelectorAll('[data-product-image-index]').forEach(function (zone) {
  var i = parseInt(zone.dataset.productImageIndex, 10);

  zone.addEventListener('click', function (e) {
    if (e.target.closest('[data-product-image-remove]')) return;
    if (e.target.closest('[data-product-image-replace]')) return;
    if (e.target.closest('.form-image-upload__preview')) return;
    triggerProductImageUpload(slide.id, i);
  });

  zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('form-image-upload--drag-over'); });
  zone.addEventListener('dragleave', function () { zone.classList.remove('form-image-upload--drag-over'); });
  zone.addEventListener('drop', function (e) {
    e.preventDefault();
    zone.classList.remove('form-image-upload--drag-over');
    if (e.dataTransfer.files.length) handleProductImageFile(e.dataTransfer.files[0], slide.id, i);
  });
});

dom.editorForm.querySelectorAll('[data-product-image-replace]').forEach(function (btn) {
  btn.addEventListener('click', function (e) { e.stopPropagation(); triggerProductImageUpload(slide.id, parseInt(btn.dataset.productImageReplace, 10)); });
});
dom.editorForm.querySelectorAll('[data-product-image-remove]').forEach(function (btn) {
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var i = parseInt(btn.dataset.productImageRemove, 10);
    ensureProduct(slide, i).image = '';
    updateSlideData(slide.id, 'products', slide.data.products);
    renderEditor();
    debouncedThumbnailUpdate();
  });
});

// --- product-group: specs (key-value) ---
dom.editorForm.querySelectorAll('[data-product-kv-input]').forEach(function (el) {
  el.addEventListener('input', function () {
    var i = parseInt(el.dataset.productKvInput, 10);
    var row = parseInt(el.dataset.kvRow, 10);
    var part = el.dataset.kvPart;
    var p = ensureProduct(slide, i);
    if (!Array.isArray(p.specs)) p.specs = [];
    if (!p.specs[row]) p.specs[row] = { key: '', value: '' };
    p.specs[row][part] = el.value;
    updateSlideData(slide.id, 'products', slide.data.products);
    debouncedThumbnailUpdate();
  });
});
dom.editorForm.querySelectorAll('[data-product-kv-add]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var i = parseInt(btn.dataset.productKvAdd, 10);
    var p = ensureProduct(slide, i);
    if (!Array.isArray(p.specs)) p.specs = [];
    p.specs.push({ key: '', value: '' });
    updateSlideData(slide.id, 'products', slide.data.products);
    renderEditor();
  });
});
dom.editorForm.querySelectorAll('[data-product-kv-remove]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var i = parseInt(btn.dataset.productKvRemove, 10);
    var row = parseInt(btn.dataset.kvRow, 10);
    var p = ensureProduct(slide, i);
    if (Array.isArray(p.specs)) p.specs.splice(row, 1);
    updateSlideData(slide.id, 'products', slide.data.products);
    renderEditor();
  });
});

// --- product-group: features (list) ---
dom.editorForm.querySelectorAll('[data-product-list-input]').forEach(function (el) {
  el.addEventListener('input', function () {
    var i = parseInt(el.dataset.productListInput, 10);
    var row = parseInt(el.dataset.listRow, 10);
    var p = ensureProduct(slide, i);
    if (!Array.isArray(p.features)) p.features = [];
    // Store as objects to match the legacy feature shape used by render
    p.features[row] = { text: el.value, indent: 0 };
    updateSlideData(slide.id, 'products', slide.data.products);
    debouncedThumbnailUpdate();
  });
});
dom.editorForm.querySelectorAll('[data-product-list-add]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var i = parseInt(btn.dataset.productListAdd, 10);
    var p = ensureProduct(slide, i);
    if (!Array.isArray(p.features)) p.features = [];
    p.features.push({ text: '', indent: 0 });
    updateSlideData(slide.id, 'products', slide.data.products);
    renderEditor();
  });
});
dom.editorForm.querySelectorAll('[data-product-list-remove]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var i = parseInt(btn.dataset.productListRemove, 10);
    var row = parseInt(btn.dataset.listRow, 10);
    var p = ensureProduct(slide, i);
    if (Array.isArray(p.features)) p.features.splice(row, 1);
    updateSlideData(slide.id, 'products', slide.data.products);
    renderEditor();
  });
});
```

**Step 2: Add `ensureProduct` helper, image helpers, and `productCount` re-render hook**

After `setupEditorEvents`, add:

```js
function ensureProduct(slide, i) {
  if (!Array.isArray(slide.data.products)) slide.data.products = [];
  while (slide.data.products.length <= i) {
    slide.data.products.push({ name: '', image: '', specs: [], features: [], featuresTitle: 'Key Features' });
  }
  return slide.data.products[i];
}

function triggerProductImageUpload(slideId, productIndex) {
  pendingImageSlideId = slideId;
  pendingImageFieldKey = '__product:' + productIndex;
  dom.fileInputImage.value = '';
  dom.fileInputImage.click();
}

function handleProductImageFile(file, slideId, productIndex) {
  if (!file || !file.type.startsWith('image/')) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    resizeImage(e.target.result, 1200, 900, 0.85).then(function (resized) {
      var slide = state.slides.find(function (s) { return s.id === slideId; });
      if (!slide) return;
      ensureProduct(slide, productIndex).image = resized;
      updateSlideData(slideId, 'products', slide.data.products);
      renderEditor();
      debouncedThumbnailUpdate();
    });
  };
  reader.readAsDataURL(file);
}
```

**Step 3: Route the file-input change for product images**

Find the existing file input handler (search for `pendingImageFieldKey` usage — likely the `change` listener bound to `dom.fileInputImage`). At the top of that handler, branch on the `__product:` prefix:

```js
// Before calling handleImageFile(...) for normal fields
if (typeof pendingImageFieldKey === 'string' && pendingImageFieldKey.indexOf('__product:') === 0) {
  var pi = parseInt(pendingImageFieldKey.slice('__product:'.length), 10);
  handleProductImageFile(file, pendingImageSlideId, pi);
  pendingImageSlideId = null;
  pendingImageFieldKey = null;
  return;
}
```

**Step 4: Make `productCount` re-render the editor**

The existing generic `data-key` input handler (~line 549) writes via `updateSlideData` but does not call `renderEditor`. For `productCount` we need a re-render so accordion sections appear/disappear. Modify the existing handler:

```js
dom.editorForm.querySelectorAll('.form-input[data-key], .form-textarea[data-key], .form-select[data-key]').forEach(function (el) {
  el.addEventListener('input', function () {
    var key = el.dataset.key;
    var val = el.value;
    if (key === 'productCount') {
      val = Math.max(1, Math.min(5, parseInt(val, 10) || 1));
    }
    updateSlideData(slide.id, key, val);
    if (key === 'productCount') {
      renderEditor();
      updatePreview();
    } else {
      debouncedThumbnailUpdate();
    }
  });
});
```

**Step 5: Manual verification**

Reload the app. On a Product Spec slide:
- `productCount` 1 → only one section, plus Slide Heading hidden.
- `productCount` 3 → three sections; clicking each header expands one and collapses others.
- Typing into a Product 2 name field saves to `products[1].name`.
- Uploading an image into Product 2 saves to `products[1].image`.
- Specs/features add/remove rows update the right product.
- Switching to another slide and back preserves all data.

**Step 6: Commit**

```bash
git add js/app.js
git commit -m "feat(editor): wire product-group events, image routing, productCount re-render"
```

---

## Task 6: Update `spec.render` for both N=1 and N≥2

**Files:**
- Modify: `js/templates.js` lines ~536–605 (`spec.render`)

**Step 1: Replace `spec.render`**

Replace the entire `render: function (data) { ... }` body inside `spec` with:

```js
render: function (data) {
  migrateSpecData(data);
  var n = Number(data.productCount || 1);
  if (n < 1) n = 1; if (n > 5) n = 5;
  var products = data.products || [];

  if (n === 1) {
    return renderSingleProductSpec(data, products[0] || {});
  }
  return renderMultiProductSpec(data, products.slice(0, n), n);
}
```

**Step 2: Add `renderSingleProductSpec` helper**

Just above the `spec` template (or near other helpers — keep it private inside the IIFE):

```js
function renderSingleProductSpec(data, p) {
  // Equivalent to the previous spec render, but reads from p (product object) instead of flat data.
  var html = '<div class="pres-slide pres-slide--spec pres-slide--spec-n1">';
  html += '<div class="pres-accent-bar"></div>';
  html += '<div class="pres-slide__content">';

  html += '<div class="pres-spec-header">';
  html += '<h2 class="pres-spec-product-name">' + escapeHtml(p.name || 'Product Specifications') + '</h2>';
  html += '<div class="pres-spec-underline"></div>';
  html += '</div>';

  html += '<div class="pres-spec-body">';

  // Left: specs + features
  html += '<div class="pres-spec-left">';
  if (Array.isArray(p.specs) && p.specs.length > 0) {
    html += '<table class="pres-spec-table">';
    p.specs.forEach(function (spec) {
      if (spec.key && spec.key.trim()) {
        html += '<tr><td>' + escapeHtml(spec.key) + '</td><td>' + escapeHtml(spec.value || '—') + '</td></tr>';
      }
    });
    html += '</table>';
  }
  var hasFeatures = Array.isArray(p.features) && p.features.some(function (raw) {
    var t = (raw && typeof raw === 'object') ? raw.text : raw;
    return t && t.trim();
  });
  if (hasFeatures) {
    html += '<div class="pres-spec-features">';
    html += '<div class="pres-spec-features__title">' + escapeHtml(p.featuresTitle || 'Key Features') + '</div>';
    p.features.forEach(function (raw) {
      var item = (raw && typeof raw === 'object') ? raw : { text: raw || '', indent: 0 };
      if (item.text && item.text.trim()) {
        html += '<div class="pres-spec-feature' + (item.indent ? ' pres-spec-feature--indent' : '') + '">';
        html += '<span class="pres-spec-feature__icon">' + checkSvg + '</span>';
        html += '<span>' + escapeHtml(item.text) + '</span>';
        html += '</div>';
      }
    });
    html += '</div>';
  }
  html += '</div>'; // spec-left

  // Right: product image
  html += '<div class="pres-spec-right">';
  if (p.image) {
    html += '<img class="pres-spec-product-img" src="' + p.image + '" alt="' + escapeHtml(p.name || '') + '">';
  } else {
    html += '<div class="pres-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Product Image</span></div>';
  }
  html += '</div>'; // spec-right

  html += '</div>'; // spec-body

  if (data.footnote) html += '<div class="pres-footnote">' + escapeHtml(data.footnote) + '</div>';
  html += '</div>'; // content
  html += renderSlideLogo(data);
  html += '</div>'; // slide
  return html;
}
```

**Step 3: Add `renderMultiProductSpec` and `renderProductCard` helpers**

Just below `renderSingleProductSpec`:

```js
function renderMultiProductSpec(data, products, n) {
  var html = '<div class="pres-slide pres-slide--spec pres-slide--spec--multi pres-slide--spec-n' + n + '">';
  html += '<div class="pres-accent-bar"></div>';
  html += '<div class="pres-slide__content">';

  if (data.slideHeading && data.slideHeading.trim()) {
    html += '<div class="pres-spec-header">';
    html += '<h2 class="pres-spec-slide-heading">' + escapeHtml(data.slideHeading) + '</h2>';
    html += '<div class="pres-spec-underline"></div>';
    html += '</div>';
  }

  html += '<div class="pres-spec-cards">';
  for (var i = 0; i < n; i++) {
    html += renderProductCard(products[i] || {});
  }
  html += '</div>';

  if (data.footnote) html += '<div class="pres-footnote">' + escapeHtml(data.footnote) + '</div>';
  html += '</div>'; // content
  html += renderSlideLogo(data);
  html += '</div>'; // slide
  return html;
}

function renderProductCard(p) {
  var html = '<div class="pres-spec-card">';
  html += '<div class="pres-spec-card__image">';
  if (p.image) {
    html += '<img src="' + p.image + '" alt="' + escapeHtml(p.name || '') + '">';
  } else {
    html += '<div class="pres-placeholder pres-placeholder--card"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div>';
  }
  html += '</div>';

  html += '<h3 class="pres-spec-card__name">' + escapeHtml(p.name || 'Product') + '</h3>';
  html += '<div class="pres-spec-card__underline"></div>';

  if (Array.isArray(p.specs) && p.specs.length > 0) {
    html += '<table class="pres-spec-card__table">';
    p.specs.slice(0, 4).forEach(function (spec) {
      if (spec.key && spec.key.trim()) {
        html += '<tr><td>' + escapeHtml(spec.key) + '</td><td>' + escapeHtml(spec.value || '—') + '</td></tr>';
      }
    });
    html += '</table>';
  }

  var feats = (p.features || []).slice(0, 3).filter(function (raw) {
    var t = (raw && typeof raw === 'object') ? raw.text : raw;
    return t && t.trim();
  });
  if (feats.length) {
    html += '<div class="pres-spec-card__features">';
    feats.forEach(function (raw) {
      var item = (raw && typeof raw === 'object') ? raw : { text: raw, indent: 0 };
      html += '<div class="pres-spec-card__feature"><span class="pres-spec-card__feature-icon">' + checkSvg + '</span><span>' + escapeHtml(item.text) + '</span></div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}
```

**Step 4: Manual verification (render only — CSS comes in Task 7)**

Reload the app. With `productCount = 1`, slide must look pixel-identical to before. With 2–5, the cards render but unstyled (raw flow). Confirm no JS errors.

**Step 5: Commit**

```bash
git add js/templates.js
git commit -m "feat(spec): branch render for N=1 vs multi-product cards"
```

---

## Task 7: Add CSS for `.pres-spec-card` and per-N grid layouts

**Files:**
- Modify: `css/slides.css` — append a new section at the end (before any closing markers) titled "Product Spec — Multi"

**Step 1: Add new CSS block**

Append to `css/slides.css`:

```css
/* --------------------------------------------------------------------------
   Product Spec — Multi (N >= 2)
   -------------------------------------------------------------------------- */

.pres-slide--spec--multi .pres-spec-slide-heading {
  font-family: var(--pres-font-heading);
  font-weight: var(--pres-heading-weight);
  text-transform: var(--pres-heading-transform);
  letter-spacing: var(--pres-heading-tracking);
  font-size: 2.4rem;
  margin: 0 0 0.4rem 0;
}

.pres-spec-cards {
  display: grid;
  gap: 1.5rem;
  width: 100%;
}

.pres-slide--spec-n2 .pres-spec-cards { grid-template-columns: 1fr 1fr; }
.pres-slide--spec-n3 .pres-spec-cards { grid-template-columns: repeat(3, 1fr); }
.pres-slide--spec-n4 .pres-spec-cards { grid-template-columns: repeat(4, 1fr); gap: 1rem; }

/* N=5: top row of 3, bottom row of 2 centered.
   Implemented with a 6-column grid: each top card spans 2 cols; bottom cards span 3.
   The leading offset on row 2 (empty cell does not exist) is handled via grid-column. */
.pres-slide--spec-n5 .pres-spec-cards {
  grid-template-columns: repeat(6, 1fr);
  gap: 1.25rem;
}
.pres-slide--spec-n5 .pres-spec-card:nth-child(1) { grid-column: 1 / span 2; }
.pres-slide--spec-n5 .pres-spec-card:nth-child(2) { grid-column: 3 / span 2; }
.pres-slide--spec-n5 .pres-spec-card:nth-child(3) { grid-column: 5 / span 2; }
.pres-slide--spec-n5 .pres-spec-card:nth-child(4) { grid-column: 2 / span 2; }
.pres-slide--spec-n5 .pres-spec-card:nth-child(5) { grid-column: 4 / span 2; }

.pres-spec-card {
  display: flex;
  flex-direction: column;
  background: var(--pres-bg-surface);
  border: 1px solid var(--pres-border);
  border-radius: var(--pres-radius);
  padding: 1rem;
  gap: 0.6rem;
  min-width: 0; /* allow shrinking inside grid */
}

.pres-spec-card__image {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--pres-bg-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--pres-radius);
}
.pres-spec-card__image img { width: 100%; height: 100%; object-fit: contain; }
.pres-placeholder--card { color: var(--pres-text-muted); }

.pres-spec-card__name {
  font-family: var(--pres-font-heading);
  font-weight: var(--pres-heading-weight);
  text-transform: var(--pres-heading-transform);
  letter-spacing: var(--pres-heading-tracking);
  font-size: 1.2rem;
  margin: 0.2rem 0 0 0;
  color: var(--pres-text);
}

.pres-spec-card__underline {
  width: 32px;
  height: var(--pres-underline-height);
  background: var(--pres-accent);
}

.pres-spec-card__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}
.pres-spec-card__table td {
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--pres-border);
  color: var(--pres-text-secondary);
}
.pres-spec-card__table td:first-child { color: var(--pres-text-muted); }
.pres-spec-card__table td:last-child { color: var(--pres-text); text-align: right; }

/* Safety net: never show more than 4 spec rows per card */
.pres-spec-card__table tr:nth-child(n+5) { display: none; }

.pres-spec-card__features {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.2rem;
}
.pres-spec-card__feature {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--pres-text);
}
.pres-spec-card__feature-icon { color: var(--pres-accent); display: inline-flex; flex-shrink: 0; }
.pres-spec-card__feature-icon svg { width: 12px; height: 12px; }

/* Tighter type for N=4 (narrow cards) */
.pres-slide--spec-n4 .pres-spec-card { padding: 0.8rem; gap: 0.45rem; }
.pres-slide--spec-n4 .pres-spec-card__name { font-size: 1rem; }
.pres-slide--spec-n4 .pres-spec-card__table { font-size: 0.78rem; }
.pres-slide--spec-n4 .pres-spec-card__feature { font-size: 0.78rem; }
```

**Step 2: Add CSS for the product-group editor accordion**

Append to `css/slides.css` (or — if you'd rather keep slide CSS pure — to `css/builder.css` instead; the builder UI styling lives there):

Decision: put it in `css/builder.css`. Open `css/builder.css` and append:

```css
/* --------------------------------------------------------------------------
   Editor: product-group accordion (Product Spec multi-product)
   -------------------------------------------------------------------------- */
.form-product-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.form-product-section {
  border: 1px solid var(--builder-border, #2A2A2A);
  border-radius: 4px;
  overflow: hidden;
  background: var(--builder-surface, #161616);
}
.form-product-section__header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.8rem;
  background: transparent;
  border: 0;
  color: var(--builder-text, #fff);
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.form-product-section__header:hover { background: rgba(255,255,255,0.03); }
.form-product-section__num { font-weight: 600; min-width: 80px; }
.form-product-section__name { flex: 1; color: var(--builder-text-secondary, #B0B0B0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.form-product-section__chevron { transition: transform 0.15s ease; }
.form-product-section--open .form-product-section__chevron { transform: rotate(180deg); }
.form-product-section__body {
  padding: 0.75rem 0.8rem 1rem;
  border-top: 1px solid var(--builder-border, #2A2A2A);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
```

If your builder.css uses different variable names for surface/border/text colors, swap the fallbacks in the rule values for whatever the file already uses (grep the file for existing `--builder-` tokens).

**Step 3: Re-embed CSS into index.html**

Per the user's memory note (`Run build-css.sh after CSS edits`):

```bash
bash build-css.sh
```

Expected: `index.html` updated with the new CSS embedded (look for `window.__SLIDES_CSS__` near the top — it should now contain `pres-spec-card`).

Sanity check:

```bash
grep -c "pres-spec-card" index.html
```

Expected: > 0 (the CSS rules are now inside `window.__SLIDES_CSS__`).

**Step 4: Manual verification**

Reload the app. Create or open a Product Spec slide and step `productCount` 1 → 5:
- N=1: visually identical to before this whole effort.
- N=2: two big cards side-by-side.
- N=3: row of 3, breathable.
- N=4: row of 4, condensed but legible.
- N=5: row of 3 + row of 2 centered.

Test all three themes (TRP Dark / Tektro Light / TRP-Tektro Corporate). Card surface, accent, and dividers should follow theme tokens.

**Step 5: Commit**

```bash
git add css/slides.css css/builder.css index.html
git commit -m "feat(spec): add multi-product card layouts and accordion editor CSS"
```

---

## Task 8: End-to-end manual verification + regressions

**No file edits. Manual smoke test only.**

**Step 1: Legacy migration**

- Load a saved presentation that uses the existing single-product Product Spec slide (or one autosaved before this change in `localStorage`). Confirm it renders identically and the editor shows the data inside "Product 1" with `productCount = 1`.

**Step 2: New multi-product**

- New presentation → add Product Spec slide → set `productCount = 3`. Fill all three products with name, image, 4 specs, 3 features each. Verify preview, slide thumbnail, and the slide-list entry all reflect changes.

**Step 3: Count round-trip**

- With 3 products filled, change to 2 → Product 3 hidden but data retained. Change back to 3 → Product 3 data is still there.

**Step 4: Themes**

- Switch the slide theme (TRP Dark / Tektro Light) and confirm card border, surface, accent bar all swap correctly.

**Step 5: Export**

- Use the existing "Export HTML" feature. Open the exported file in a browser. Verify the multi-product spec slide renders correctly there (CSS embedded). Repeat for PPTX export if you intend that to work — note: PPTX export of the new card layout may need separate work, which is **out of scope for this plan** (see "Out of scope" in the design doc). If PPTX is required, file a follow-up.

**Step 6: Console check**

- No JS errors anywhere during all of the above.

**Step 7: Final commit (only if you made any tweaks during verification)**

```bash
git status
# if anything changed:
git add -A
git commit -m "chore(spec): polish from manual verification"
```

---

## Out of scope (deferred)

- PPTX export of the multi-product card layout (`js/exporter.js`). The current PPTX exporter is built for the legacy flat shape and will likely render only Product 1. If PPTX parity matters, plan a follow-up.
- `pptx-import.js` mapping of multi-product slides.
- Drag-to-reorder products.
- Per-product footnotes or logos.

---

## Reference: design doc

`docs/plans/2026-05-18-multi-product-spec-design.md` — read this for the rationale behind layout choices, data shape, and editor UX.
