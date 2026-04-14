# Sales Presentation Generator

A web-based tool for creating professional sales presentations for **Tektro** and **TRP** cycling components. Built for product managers and sales teams who need to quickly assemble on-brand slide decks without design tools.

> **Live tool:** [nikbrowntrp.github.io/sales-presentation-generator](https://nikbrowntrp.github.io/sales-presentation-generator/)
>
> **Zero dependencies.** Just open `index.html` in a browser and start building.

---

## Builder Interface

The builder uses a three-panel layout: a slide list sidebar, a live preview, and a content editor.

- **Left sidebar** -- slide list with thumbnails, drag-and-drop reordering, duplicate, hide/show, and delete controls
- **Top area** -- live 16:9 preview that updates in real-time as you type
- **Bottom area** -- dynamic form editor that adapts to the selected slide template
- **Editable title** -- click the presentation name in the header to rename

---

## Brand Themes (Per-Slide)

Each slide can use its own brand theme. Choose the theme when adding a slide or switch it anytime in the editor.

| Theme | Brand | Typography | Accent | Style |
|-------|-------|-----------|--------|-------|
| **TRP Racing** | TRP | Oswald 700 uppercase | Blue-grey `#54748a` + Red `#de2a2a` | Dark, sharp corners, carbon fiber texture |
| **Tektro** | Tektro | Manrope 700 sentence case | Monochrome (black/white) | Light, editorial, generous whitespace |

Themes are derived from the actual **tektro.eu Shopify theme** and aligned with corporate design systems created in **Stitch MCP**.

### Brand Defaults

When creating a new slide, the following are automatically prefilled (editable):
- **Logo** -- TRP white logo (dark theme) or Tektro logo (light theme), shown in bottom-right of every slide
- **Brand Line** (title slides):
  - TRP: *Product Quality -- Performance Driven -- Innovation Forward*
  - Tektro: *Product Quality -- Value Driven -- Purpose Built*

---

## Slide Templates

Six templates cover common sales presentation needs.

| Template | Purpose | Key Fields |
|----------|---------|------------|
| **Title Page** | Opening brand statement | Title, subtitle, brand line, logo, background image |
| **Product Presentation** | Hero product showcase | Product name, tagline, selling points, product image, badge |
| **Product Gallery** | Multi-image showcase | Heading, up to 3 images with captions, layout options |
| **Product Spec** | Technical details | Product name, specs table, features list, image |
| **Header + List** | Flexible content slide | Heading, bullet list, optional image, layout choice |
| **Data & Graph** | Charts and data visuals | Bar chart, XY line plot, or image + detail notes |

The **Add Slide** modal shows live themed previews of each template. Select TRP Racing or Tektro at the top to preview both brand styles before adding.

---

## Features

### Slide Management
- **Add slides** -- inserts after the currently selected slide
- **Duplicate** -- copies a slide with all content and theme
- **Hide/Show** -- toggle slide visibility (hidden slides stay in the deck but are excluded from presentation and export)
- **Reorder** -- drag-and-drop or up/down arrows
- **Delete** -- with styled confirmation dialog
- **Per-slide theme** -- TRP Racing or Tektro, switchable anytime

### Content Editing
- Text inputs for titles, subtitles, taglines
- **Dynamic list builder** -- add/remove bullet points
- **Spec table editor** -- add/remove key-value rows
- **Image upload** with drag-and-drop (PNG transparency preserved, images compressed client-side)
- **Brand logo** on every slide type (auto-prefilled, removable, replaceable)
- Layout selector for flexible templates

### Save & Load
- **Auto-saves** to `localStorage` every 2 seconds
- **New Presentation** button with save warning
- **Save as JSON** -- download the full project as a `.json` file (file picker dialog)
- **Load** -- choose between JSON project file or HTML presentation to re-import

### Export
- **Export HTML** -- self-contained slideshow file with:
  - Keyboard navigation (arrow keys, spacebar)
  - Fullscreen button + F key shortcut
  - Per-slide themes preserved
  - Embedded presentation state for re-import back into the builder
  - File picker for save location
- **Export PDF** -- high-quality landscape PDF via html2canvas + jsPDF at 2x resolution
- Hidden slides are automatically excluded from all exports

### Presentation Mode
- **Fullscreen slideshow** with animated transitions
- Navigate with arrow keys, spacebar, dot indicators, or on-screen buttons
- **F key** or fullscreen button to enter/exit fullscreen
- Press **Escape** to close

### Custom Dialogs
All popups (delete, new, load, errors) use styled modal dialogs matching the dark builder UI -- no browser default alerts.

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Ctrl+S` / `Cmd+S` | Save presentation as JSON |
| `Escape` | Close any modal or slideshow |
| `Arrow Left/Right` | Navigate slides in slideshow |
| `Spacebar` | Next slide in slideshow |
| `F` | Toggle fullscreen in exported HTML |

---

## Getting Started

### 1. Open the tool

Visit [nikbrowntrp.github.io/sales-presentation-generator](https://nikbrowntrp.github.io/sales-presentation-generator/) or open `index.html` locally.

### 2. Add your first slide

Click **+ Add Slide**, select a brand theme (TRP Racing or Tektro), and choose a template.

### 3. Fill in content

Type content in the editor. The live preview updates as you type. Upload images by clicking or dragging.

### 4. Preview

Click **Preview** to see the full slideshow with animations.

### 5. Export

- **Export HTML** -- interactive slideshow (can be re-imported for editing)
- **Export PDF** -- shareable PDF document
- **Save** -- raw JSON project file

---

## Re-editing an Exported Presentation

1. Click **Load** in the header
2. Choose **HTML Presentation**
3. Select the `.html` file you previously exported
4. The builder restores all slides, content, images, and theme settings
5. Make edits and export again

---

## Technical Details

### Architecture
- **Pure vanilla HTML/CSS/JavaScript** -- no frameworks, no build tools, no npm
- CSS custom properties for theming, CSS Grid for layouts
- Slide CSS embedded as hardcoded JS string for reliable `file://` export

### File Structure

```
sales-presentation-generator/
  index.html              # Builder application (with embedded CSS for export)
  build-css.sh            # Re-embeds slides.css into index.html after CSS edits
  README.md
  css/
    builder.css           # Builder UI styles, dialogs, modals
    slides.css            # Slide themes, template styles, animations
  js/
    templates.js          # 6 slide template definitions (fields + render)
    app.js                # Main controller (state, CRUD, forms, events)
    preview.js            # Live preview + fullscreen slideshow
    exporter.js           # Save/load + PDF/HTML export
  assets/
    Logo TRP_w.png        # TRP logo (white, for dark slides)
    Logo Tektro.png       # Tektro logo (for light slides)
    Logo TRP.png          # TRP logo (dark version)
    placeholder.svg       # Default image placeholder
```

### Build Step

After editing `css/slides.css`, run the build script to re-embed the CSS into `index.html`:

```bash
bash build-css.sh
```

This ensures the HTML export includes the latest slide styles (required because browsers block reading stylesheets on `file://` URLs).

### External Dependencies (CDN)
- **Google Fonts** -- Oswald (TRP headings), Manrope (Tektro headings), Inter (body)
- **html2canvas** v1.4.1 -- renders slides to canvas for PDF
- **jsPDF** v2.5.1 -- assembles PDF from canvas images

### Browser Support
Chrome, Firefox, Safari, Edge (latest). Uses CSS custom properties, CSS Grid, Promises, Fetch API, FileReader API, and optionally the File System Access API for save dialogs.

### Slide Dimensions
All slides render at **960 x 540px** (16:9), scaled to fit the viewport. PDF export uses 2x resolution.

---

## Brand Identity

Design tokens are sourced from the **tektro.eu Shopify theme** and corporate design systems:

**TRP Racing (Dark)**
- Font: Oswald 700 (matches Zurich Extended from Shopify theme)
- Primary: `#54748a` (blue-grey) | Secondary: `#de2a2a` (red)
- Background: `#000000` | Border radius: 0px | Carbon fiber texture

**Tektro (Light)**
- Font: Manrope 700
- Primary: `#000000` (monochrome) | Secondary: `#5E5E5E`
- Background: `#FFFFFF` | Clean editorial feel

---

## License

Internal tool for Tektro / TRP Cycling sales teams.
