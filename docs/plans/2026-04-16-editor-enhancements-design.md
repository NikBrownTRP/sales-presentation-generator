# Editor Enhancements Design
**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

Four incremental enhancements to the presentation builder editor:

1. List item indentation (2 hierarchy levels)
2. Editable section titles for list blocks
3. Bar chart highlight column
4. Wide layout view switcher

All changes use **Approach A** — extend existing data structures in-place. New fields degrade gracefully when absent (fall back to defaults), so existing slides load without migration.

---

## 1. List Item Hierarchy

### Data Model
List items change from `string[]` to `{text: string, indent: 0|1}[]`.  
Missing `indent` defaults to `0` — backwards-compatible with all existing slides.

### Editor UI
Each list item row gains two small arrow buttons between the drag handle and the text input:
- `←` Unindent — disabled when `indent === 0`
- `→` Indent — disabled when `indent === 1`

Clicking either updates the item's `indent` and re-renders the form.

### Drag-and-Drop Behaviour
On drop, the dropped item's `indent` is reset to `0`.

### Slide Preview
Indented items render with `padding-left: 1.5em` relative to standard items.  
Applies to both:
- `.pres-spec-features` list (Product Spec template)
- `.pres-graph-notes` list (Data & Graph template)

---

## 2. Editable Section Titles

### Data Model
Two new optional string fields on slide data:
- `featuresTitle` — used by Product Spec template; defaults to `"Key Features"`
- `notesTitle` — used by Data & Graph template; defaults to `"Key Insights"`

### Editor UI
A plain text input labeled **"Section title"** appears above the list field in both affected templates. Pre-filled with the current stored value or the default string. Updates via the existing `updateSlideField` mechanism.

### Slide Preview
Hard-coded title strings in `templates.js` replaced with:
- `slide.data.featuresTitle || "Key Features"` (line ~371)
- `slide.data.notesTitle || "Key Insights"` (line ~680)

---

## 3. Bar Chart Highlight

### Data Model
No schema change. The existing plain-text chart data format gains an optional 3rd column:

```
Q1,120
Q2,185,highlight
Q3,140
```

The `parseCSV()` function reads the 3rd token per row; any truthy value marks that bar as highlighted.

### Editor UI
The chart data textarea is unchanged. A small helper hint is added beneath it:

> *Add `,highlight` to a row to accent that bar.*

### Slide Preview
`ChartRenderer.barChart()` checks the `highlight` flag per parsed data point.  
- Highlighted bars: `fill: var(--pres-accent-secondary)`  
- Default bars: `fill: var(--pres-chart-color)` (unchanged)

All other bar properties (animation, value label, width) are unaffected.

---

## 4. Layout View Switcher

### Data Model
`localStorage` key `builderLayout` stores `"stacked"` (default) or `"wide"`.  
Persists across sessions; no slide data involved.

### Editor UI
Two icon toggle buttons added to `.builder-header`, grouped near the existing export buttons.  
- **Stacked icon** — preview above editor (current behaviour)
- **Wide icon** — sidebar | editor | preview side by side

Active mode button gets an active/selected visual state.

### Wide Mode Layout
`.builder-main` switches from `flex-direction: column` to `flex-direction: row`.  
Both the editor form and the preview panel get `flex: 1` with `overflow-y: auto` and a `min-width` to prevent collapse.  
The preview scaler recalculates its CSS `scale` transform to fit the narrower container width (reuses existing scaling logic, triggered on layout change).

### Responsive Fallback
If viewport width < 1200px, wide mode is ignored and stacked layout is used.

---

## Files Affected

| File | Change |
|------|--------|
| `js/controller.js` | List item render (indent buttons), drag-drop reset, title input field |
| `js/templates.js` | `parseCSV` highlight column, `barChart` highlight fill, title fallback strings |
| `css/slides.css` | Indented list item style (`.pres-list-item--indent`) |
| `css/builder.css` | Wide layout styles, layout toggle button styles |
| `index.html` | Layout toggle buttons in header; embedded `slides.css` re-sync via `build-css.sh` |
