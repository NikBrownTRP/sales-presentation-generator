/* ==========================================================================
   Sales Presentation Generator — Slide Template Definitions
   Defines field schemas and render functions for all 6 templates
   ========================================================================== */
'use strict';

(function () {
  var PLACEHOLDER_SVG = '<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" fill="none"><rect width="120" height="80" rx="4" fill="%231A1A1A"/><path d="M44 50l12-16 12 16H44z" fill="%23333"/><path d="M56 50l16-22 16 22H56z" fill="%23444"/><circle cx="42" cy="32" r="6" fill="%23555"/></svg>';

  var checkSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>';

  function renderSlideLogo(data) {
    if (!data.logo) return '';
    return '<img class="pres-slide-logo" src="' + data.logo + '" alt=""' + bgStyle(data, 'logo') + '>';
  }

  // Returns a style string for an element's background color if the user
  // picked one in the editor. The editor saves this as "{fieldKey}Bg".
  // NOTE: Only use on tightly-sized elements (e.g. logo <img> tags).
  // Do NOT apply to large container divs — the bg color is already baked
  // into the image output itself (letterbox fill in applyImageEdit), so
  // applying it to the container would flood the entire container area.
  function bgStyle(data, fieldKey) {
    var c = data && data[fieldKey + 'Bg'];
    if (!c) return '';
    // Sanitize: only allow hex colors to avoid CSS injection via user input
    if (!/^#[0-9a-fA-F]{3,8}$/.test(c)) return '';
    return ' style="background-color:' + c + '"';
  }

  /* -----------------------------------------------------------------------
     SVG Chart Renderer — builds inline SVG from data
     ----------------------------------------------------------------------- */
  var ChartRenderer = {

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

    barChart: function (data, w, h, accentColor) {
      if (!data || data.length === 0) return '';
      var padL = 60, padR = 20, padT = 16, padB = 40;
      var chartW = w - padL - padR;
      var chartH = h - padT - padB;
      var maxVal = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
      var barW = Math.min(40, (chartW / data.length) * 0.6);
      var gap = chartW / data.length;

      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="font-family:Inter,sans-serif;">';

      // Grid lines
      for (var g = 0; g <= 4; g++) {
        var gy = padT + chartH - (chartH * g / 4);
        var gVal = (maxVal * g / 4);
        svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="currentColor" stroke-opacity="0.1" stroke-width="1"/>';
        svg += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10" fill="currentColor" opacity="0.5">' + (Math.round(gVal * 10) / 10) + '</text>';
      }

      // Bars
      data.forEach(function (d, i) {
        var barH = (d.value / maxVal) * chartH;
        var x = padL + gap * i + (gap - barW) / 2;
        var y = padT + chartH - barH;
        var fillStyle = d.highlight
          ? 'fill:var(--pres-accent-secondary, ' + accentColor + ')'
          : 'fill:var(--pres-chart-color, ' + accentColor + ')';
        svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" style="' + fillStyle + '" rx="2" opacity="0.85">';
        svg += '<animate attributeName="height" from="0" to="' + barH + '" dur="0.5s" fill="freeze"/>';
        svg += '<animate attributeName="y" from="' + (padT + chartH) + '" to="' + y + '" dur="0.5s" fill="freeze"/>';
        svg += '</rect>';
        // Value label on top
        svg += '<text x="' + (x + barW / 2) + '" y="' + (y - 6) + '" text-anchor="middle" font-size="10" font-weight="600" fill="currentColor" opacity="0.8">' + d.value + '</text>';
        // X-axis label
        if (d.label) {
          svg += '<text x="' + (x + barW / 2) + '" y="' + (padT + chartH + 16) + '" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">' + escapeHtml(d.label) + '</text>';
        }
      });

      // Axes
      svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + chartH) + '" stroke="currentColor" stroke-opacity="0.2" stroke-width="1"/>';
      svg += '<line x1="' + padL + '" y1="' + (padT + chartH) + '" x2="' + (w - padR) + '" y2="' + (padT + chartH) + '" stroke="currentColor" stroke-opacity="0.2" stroke-width="1"/>';

      svg += '</svg>';
      return svg;
    },

    xyPlot: function (data, w, h, accentColor) {
      if (!data || data.length === 0) return '';
      var padL = 60, padR = 20, padT = 16, padB = 40;
      var chartW = w - padL - padR;
      var chartH = h - padT - padB;

      var xVals = data.map(function (d, i) { return d.label ? parseFloat(d.label) : i; });
      var yVals = data.map(function (d) { return d.value; });
      var minX = Math.min.apply(null, xVals), maxX = Math.max.apply(null, xVals);
      var minY = Math.min.apply(null, yVals.concat([0])), maxY = Math.max.apply(null, yVals) || 1;
      if (maxX === minX) maxX = minX + 1;
      var rangeX = maxX - minX;
      var rangeY = maxY - minY || 1;

      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" style="font-family:Inter,sans-serif;">';

      // Grid lines
      for (var g = 0; g <= 4; g++) {
        var gy = padT + chartH - (chartH * g / 4);
        var gVal = minY + (rangeY * g / 4);
        svg += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (w - padR) + '" y2="' + gy + '" stroke="currentColor" stroke-opacity="0.1" stroke-width="1"/>';
        svg += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" text-anchor="end" font-size="10" fill="currentColor" opacity="0.5">' + (Math.round(gVal * 10) / 10) + '</text>';
      }

      // Build path + points
      var points = data.map(function (d, i) {
        var px = padL + ((xVals[i] - minX) / rangeX) * chartW;
        var py = padT + chartH - ((d.value - minY) / rangeY) * chartH;
        return { x: px, y: py, value: d.value, label: d.label };
      });

      // Line
      var pathD = points.map(function (p, i) { return (i === 0 ? 'M' : 'L') + p.x + ',' + p.y; }).join(' ');
      svg += '<path d="' + pathD + '" fill="none" style="stroke:var(--pres-chart-color, ' + accentColor + ')" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>';

      // Area fill
      var areaD = pathD + ' L' + points[points.length - 1].x + ',' + (padT + chartH) + ' L' + points[0].x + ',' + (padT + chartH) + ' Z';
      svg += '<path d="' + areaD + '" style="fill:var(--pres-chart-color, ' + accentColor + ')" opacity="0.08"/>';

      // Dots
      points.forEach(function (p) {
        svg += '<circle cx="' + p.x + '" cy="' + p.y + '" r="4" style="fill:var(--pres-chart-color, ' + accentColor + ')" stroke="currentColor" stroke-opacity="0.3" stroke-width="1"/>';
        svg += '<text x="' + p.x + '" y="' + (p.y - 10) + '" text-anchor="middle" font-size="9" font-weight="600" fill="currentColor" opacity="0.7">' + p.value + '</text>';
      });

      // X-axis labels
      var step = Math.max(1, Math.floor(points.length / 8));
      points.forEach(function (p, i) {
        if (i % step === 0 || i === points.length - 1) {
          svg += '<text x="' + p.x + '" y="' + (padT + chartH + 16) + '" text-anchor="middle" font-size="9" fill="currentColor" opacity="0.5">' + (p.label || '') + '</text>';
        }
      });

      // Axes
      svg += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT + chartH) + '" stroke="currentColor" stroke-opacity="0.2" stroke-width="1"/>';
      svg += '<line x1="' + padL + '" y1="' + (padT + chartH) + '" x2="' + (w - padR) + '" y2="' + (padT + chartH) + '" stroke="currentColor" stroke-opacity="0.2" stroke-width="1"/>';

      svg += '</svg>';
      return svg;
    }
  };

  window.ChartRenderer = ChartRenderer;

  /**
   * Template definitions
   */
  window.SlideTemplates = {

    /* ====================================================================
       TITLE PAGE
       ==================================================================== */
    title: {
      id: 'title',
      name: 'Title Page',
      description: 'Big brand statement with title, subtitle, and optional background image.',
      icon: '<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="50" rx="3" fill="#111"/><rect x="20" y="16" width="40" height="4" rx="1" fill="#E31837"/><rect x="26" y="24" width="28" height="2" rx="1" fill="#666"/><rect x="32" y="30" width="16" height="1.5" rx=".75" fill="#444"/></svg>',

      fields: [
        { key: 'title', role: 'title', type: 'text', label: 'Title', placeholder: 'e.g., TRP Product Range 2026', required: true },
        { key: 'subtitle', role: 'subtitle', type: 'text', label: 'Subtitle', placeholder: 'e.g., Performance Braking & Drivetrain Systems' },
        { key: 'brandLine', role: 'tagline', type: 'text', label: 'Brand Line', placeholder: 'e.g., Engineered for Speed' },
        { key: 'logo', role: 'logo', type: 'image', label: 'Logo Image' },
        { key: 'backgroundImage', role: 'hero-image', type: 'image', label: 'Background Image' },
        {
          key: 'overlayOpacity', type: 'select', label: 'Background Overlay', defaultValue: '0.7',
          options: [
            { value: '0.3', label: 'Light (30%)' },
            { value: '0.5', label: 'Medium (50%)' },
            { value: '0.7', label: 'Default (70%)' },
            { value: '0.85', label: 'Heavy (85%)' }
          ]
        }
      ],

      getTitle: function (data) {
        return data.title || 'Title Page';
      },

      render: function (data) {
        var bgImgStyle = '';
        if (data.backgroundImage) {
          bgImgStyle = 'background-image: url(' + data.backgroundImage + ')';
        }
        var overlayOpacity = data.overlayOpacity || '0.7';

        var html = '<div class="pres-slide pres-slide--title">';

        // Background
        if (data.backgroundImage) {
          html += '<div class="pres-slide__bg" style="' + bgImgStyle + '"></div>';
          html += '<div class="pres-slide__overlay" style="opacity: ' + overlayOpacity + '"></div>';
        }

        // Corner accents
        html += '<div class="pres-corner pres-corner--tl"></div>';
        html += '<div class="pres-corner pres-corner--br"></div>';

        // Content
        html += '<div class="pres-slide__content">';

        if (data.logo) {
          html += '<img class="pres-logo" src="' + data.logo + '" alt=""' + bgStyle(data, 'logo') + '>';
        }

        html += '<h1 class="pres-title">' + escapeHtml(data.title || 'Presentation Title') + '</h1>';
        html += '<div class="pres-accent-line"></div>';

        if (data.subtitle) {
          html += '<p class="pres-subtitle">' + escapeHtml(data.subtitle) + '</p>';
        }

        if (data.brandLine) {
          html += '<p class="pres-brandline">' + escapeHtml(data.brandLine) + '</p>';
        }

        html += '</div>'; // content
        html += '</div>'; // slide

        return html;
      }
    },

    /* ====================================================================
       PRODUCT PRESENTATION
       ==================================================================== */
    product: {
      id: 'product',
      name: 'Product Presentation',
      description: 'Hero product image with name, tagline, and key selling points.',
      icon: '<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="50" rx="3" fill="#111"/><rect x="6" y="10" width="24" height="3" rx="1" fill="#E31837"/><rect x="6" y="16" width="30" height="2" rx="1" fill="#666"/><rect x="6" y="22" width="26" height="1.5" rx=".75" fill="#444"/><rect x="6" y="27" width="26" height="1.5" rx=".75" fill="#444"/><circle cx="56" cy="25" r="14" fill="#1A1A1A"/><rect x="50" y="18" width="12" height="14" rx="2" fill="#333"/></svg>',

      fields: [
        { key: 'productName', role: 'title', type: 'text', label: 'Product Name', placeholder: 'e.g., TRP DH-R EVO', required: true },
        { key: 'tagline', role: 'subtitle', type: 'text', label: 'Tagline', placeholder: 'e.g., Race-Proven Stopping Power' },
        { key: 'category', role: 'kicker', type: 'text', label: 'Category', placeholder: 'e.g., Disc Brakes / MTB' },
        { key: 'productImage', role: 'hero-image', type: 'image', label: 'Product Image' },
        { key: 'sellingPoints', role: 'list', type: 'list', label: 'Key Selling Points', placeholder: 'Add a selling point...', maxItems: 5 },
        { key: 'badgeText', role: 'badge', type: 'text', label: 'Badge Text', placeholder: 'e.g., NEW 2026' },
        { key: 'logo', role: 'logo', type: 'image', label: 'Logo' }
      ],

      getTitle: function (data) {
        return data.productName || 'Product Slide';
      },

      render: function (data) {
        var html = '<div class="pres-slide pres-slide--product">';
        html += '<div class="pres-accent-bar"></div>';
        html += '<div class="pres-slide__content">';

        // Left: product info
        html += '<div class="pres-product-info">';

        if (data.category) {
          html += '<span class="pres-category">' + escapeHtml(data.category) + '</span>';
        }

        html += '<h2 class="pres-product-name">' + escapeHtml(data.productName || 'Product Name') + '</h2>';

        if (data.tagline) {
          html += '<p class="pres-tagline">' + escapeHtml(data.tagline) + '</p>';
        }

        if (data.sellingPoints && data.sellingPoints.length > 0) {
          html += '<ul class="pres-selling-points">';
          data.sellingPoints.forEach(function (point) {
            if (point && point.trim()) {
              html += '<li class="pres-selling-point">' + escapeHtml(point) + '</li>';
            }
          });
          html += '</ul>';
        }

        html += '</div>'; // product-info

        // Divider
        html += '<div class="pres-divider"></div>';

        // Right: product image
        html += '<div class="pres-product-image-area">';

        if (data.badgeText) {
          html += '<span class="pres-badge">' + escapeHtml(data.badgeText) + '</span>';
        }

        if (data.productImage) {
          html += '<img class="pres-product-img" src="' + data.productImage + '" alt="' + escapeHtml(data.productName || '') + '">';
        } else {
          html += '<div class="pres-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Product Image</span></div>';
        }

        html += '</div>'; // image area
        html += '</div>'; // content
        html += renderSlideLogo(data);
        html += '</div>'; // slide

        return html;
      }
    },

    /* ====================================================================
       PRODUCT SPEC
       ==================================================================== */
    spec: {
      id: 'spec',
      name: 'Product Spec',
      description: 'Detailed specs table, features list, and product image.',
      icon: '<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="50" rx="3" fill="#111"/><rect x="6" y="6" width="32" height="3" rx="1" fill="#E31837"/><rect x="6" y="13" width="30" height="1.5" rx=".75" fill="#444"/><rect x="6" y="17" width="30" height="1.5" rx=".75" fill="#333"/><rect x="6" y="21" width="30" height="1.5" rx=".75" fill="#444"/><rect x="6" y="25" width="30" height="1.5" rx=".75" fill="#333"/><rect x="6" y="29" width="30" height="1.5" rx=".75" fill="#444"/><rect x="46" y="14" width="26" height="22" rx="2" fill="#1A1A1A"/></svg>',

      fields: [
        { key: 'productName', role: 'title', type: 'text', label: 'Product Name', placeholder: 'e.g., TRP DH-R EVO', required: true },
        { key: 'productImage', role: 'hero-image', type: 'image', label: 'Product Image' },
        { key: 'specs', type: 'keyvalue', label: 'Specifications', keyPlaceholder: 'Spec name', valuePlaceholder: 'Value' },
        { key: 'features', role: 'list', type: 'list', label: 'Key Features', titleKey: 'featuresTitle', titleDefault: 'Key Features', placeholder: 'Add a feature...', maxItems: 6 },
        { key: 'footnote', role: 'footnote', type: 'text', label: 'Footnote', placeholder: 'e.g., *Weight without rotors' },
        { key: 'logo', role: 'logo', type: 'image', label: 'Logo' }
      ],

      getTitle: function (data) {
        return (data.productName || 'Spec') + ' — Specs';
      },

      render: function (data) {
        var html = '<div class="pres-slide pres-slide--spec">';
        html += '<div class="pres-accent-bar"></div>';
        html += '<div class="pres-slide__content">';

        // Header
        html += '<div class="pres-spec-header">';
        html += '<h2 class="pres-spec-product-name">' + escapeHtml(data.productName || 'Product Specifications') + '</h2>';
        html += '<div class="pres-spec-underline"></div>';
        html += '</div>';

        // Body
        html += '<div class="pres-spec-body">';

        // Left: Specs table
        html += '<div class="pres-spec-left">';

        if (data.specs && data.specs.length > 0) {
          html += '<table class="pres-spec-table">';
          data.specs.forEach(function (spec) {
            if (spec.key && spec.key.trim()) {
              html += '<tr><td>' + escapeHtml(spec.key) + '</td><td>' + escapeHtml(spec.value || '—') + '</td></tr>';
            }
          });
          html += '</table>';
        }

        // Features below specs
        if (data.features && data.features.some(function (raw) {
          var t = (raw && typeof raw === 'object') ? raw.text : raw;
          return t && t.trim();
        })) {
          html += '<div class="pres-spec-features">';
          html += '<div class="pres-spec-features__title">' + escapeHtml(data.featuresTitle || 'Key Features') + '</div>';
          data.features.forEach(function (raw) {
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

        // Right: Product image
        html += '<div class="pres-spec-right">';
        if (data.productImage) {
          html += '<img class="pres-spec-product-img" src="' + data.productImage + '" alt="' + escapeHtml(data.productName || '') + '">';
        } else {
          html += '<div class="pres-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Product Image</span></div>';
        }
        html += '</div>'; // spec-right

        html += '</div>'; // spec-body

        // Footnote
        if (data.footnote) {
          html += '<div class="pres-footnote">' + escapeHtml(data.footnote) + '</div>';
        }

        html += '</div>'; // content
        html += renderSlideLogo(data);
        html += '</div>'; // slide

        return html;
      }
    },

    /* ====================================================================
       GENERIC HEADER + LIST
       ==================================================================== */
    generic: {
      id: 'generic',
      name: 'Header + List',
      description: 'Flexible layout with heading, bullet list, and optional image.',
      icon: '<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="50" rx="3" fill="#111"/><rect x="6" y="6" width="28" height="3" rx="1" fill="#E31837"/><rect x="6" y="14" width="30" height="1.5" rx=".75" fill="#666"/><rect x="6" y="19" width="30" height="1.5" rx=".75" fill="#444"/><rect x="6" y="24" width="30" height="1.5" rx=".75" fill="#444"/><rect x="6" y="29" width="30" height="1.5" rx=".75" fill="#444"/><rect x="6" y="34" width="30" height="1.5" rx=".75" fill="#444"/><rect x="44" y="10" width="30" height="30" rx="2" fill="#1A1A1A"/></svg>',

      fields: [
        { key: 'heading', role: 'title', type: 'text', label: 'Heading', placeholder: 'e.g., Why Choose TRP?', required: true },
        { key: 'subheading', role: 'subtitle', type: 'text', label: 'Subheading', placeholder: 'e.g., Industry-leading performance and reliability' },
        { key: 'items', role: 'list', type: 'list', label: 'List Items', placeholder: 'Add an item...', maxItems: 8 },
        { key: 'image', role: 'hero-image', type: 'image', label: 'Image (optional)' },
        {
          key: 'layout', type: 'select', label: 'Layout', defaultValue: 'text-left',
          options: [
            { value: 'text-left', label: 'Text Left, Image Right' },
            { value: 'text-right', label: 'Text Right, Image Left' },
            { value: 'text-full', label: 'Full Width (no image)' },
            { value: 'text-center', label: 'Centered' }
          ]
        },
        { key: 'logo', role: 'logo', type: 'image', label: 'Logo' }
      ],

      getTitle: function (data) {
        return data.heading || 'Content Slide';
      },

      render: function (data) {
        var layout = data.layout || 'text-left';

        var html = '<div class="pres-slide pres-slide--generic">';
        html += '<div class="pres-accent-bar"></div>';
        html += '<div class="pres-slide__content">';

        // Header
        html += '<div class="pres-generic-header">';
        html += '<h2 class="pres-generic-heading">' + escapeHtml(data.heading || 'Heading') + '</h2>';
        if (data.subheading) {
          html += '<p class="pres-generic-subheading">' + escapeHtml(data.subheading) + '</p>';
        }
        html += '<div class="pres-generic-underline"></div>';
        html += '</div>';

        // Body
        html += '<div class="pres-generic-body pres-generic-body--' + layout + '">';

        if (layout === 'text-full' || layout === 'text-center') {
          if (data.items && data.items.length > 0) {
            html += '<ul class="pres-bullet-list">';
            data.items.forEach(function (item) {
              if (item && item.trim()) {
                html += '<li class="pres-bullet-item"><span class="pres-bullet-item__marker"></span>' + escapeHtml(item) + '</li>';
              }
            });
            html += '</ul>';
          }
        } else {
          html += '<div class="pres-generic-text">';
          if (data.items && data.items.length > 0) {
            html += '<ul class="pres-bullet-list">';
            data.items.forEach(function (item) {
              if (item && item.trim()) {
                html += '<li class="pres-bullet-item"><span class="pres-bullet-item__marker"></span>' + escapeHtml(item) + '</li>';
              }
            });
            html += '</ul>';
          }
          html += '</div>';

          html += '<div class="pres-generic-image-area">';
          if (data.image) {
            html += '<img class="pres-generic-img" src="' + data.image + '" alt="">';
          } else {
            html += '<div class="pres-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Optional Image</span></div>';
          }
          html += '</div>';
        }

        html += '</div>'; // body
        html += '</div>'; // content
        html += renderSlideLogo(data);
        html += '</div>'; // slide

        return html;
      }
    },

    /* ====================================================================
       PRODUCT GALLERY (up to 3 images)
       ==================================================================== */
    gallery: {
      id: 'gallery',
      name: 'Product Gallery',
      description: 'Showcase up to 3 product images with title and captions.',
      icon: '<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="50" rx="3" fill="#111"/><rect x="6" y="6" width="28" height="3" rx="1" fill="#E31837"/><rect x="4" y="14" width="22" height="28" rx="2" fill="#1A1A1A" stroke="#333" stroke-width=".5"/><rect x="29" y="14" width="22" height="28" rx="2" fill="#1A1A1A" stroke="#333" stroke-width=".5"/><rect x="54" y="14" width="22" height="28" rx="2" fill="#1A1A1A" stroke="#333" stroke-width=".5"/></svg>',

      fields: [
        { key: 'heading', role: 'title', type: 'text', label: 'Heading', placeholder: 'e.g., TRP DH-R EVO — Product Views', required: true },
        { key: 'subheading', role: 'subtitle', type: 'text', label: 'Subheading', placeholder: 'e.g., Designed for ultimate performance' },
        { key: 'image1', role: 'hero-image', type: 'image', label: 'Image 1 (left)' },
        { key: 'caption1', type: 'text', label: 'Caption 1', placeholder: 'e.g., Front view' },
        { key: 'image2', type: 'image', label: 'Image 2 (center)' },
        { key: 'caption2', type: 'text', label: 'Caption 2', placeholder: 'e.g., Side profile' },
        { key: 'image3', type: 'image', label: 'Image 3 (right)' },
        { key: 'caption3', type: 'text', label: 'Caption 3', placeholder: 'e.g., Detail shot' },
        {
          key: 'galleryLayout', type: 'select', label: 'Layout', defaultValue: '3col',
          options: [
            { value: '3col', label: '3 Equal Columns' },
            { value: '1-2', label: '1 Large + 2 Small' },
            { value: '2col', label: '2 Columns (no 3rd)' }
          ]
        },
        { key: 'logo', role: 'logo', type: 'image', label: 'Logo' }
      ],

      getTitle: function (data) {
        return data.heading || 'Product Gallery';
      },

      render: function (data) {
        var layout = data.galleryLayout || '3col';
        var html = '<div class="pres-slide pres-slide--gallery">';
        html += '<div class="pres-accent-bar"></div>';
        html += '<div class="pres-slide__content">';

        // Header
        html += '<div class="pres-gallery-header">';
        html += '<h2 class="pres-gallery-heading">' + escapeHtml(data.heading || 'Product Gallery') + '</h2>';
        if (data.subheading) {
          html += '<p class="pres-gallery-subheading">' + escapeHtml(data.subheading) + '</p>';
        }
        html += '<div class="pres-gallery-underline"></div>';
        html += '</div>';

        // Gallery grid
        html += '<div class="pres-gallery-grid pres-gallery-grid--' + layout + '">';

        var images = [
          { src: data.image1, cap: data.caption1 },
          { src: data.image2, cap: data.caption2 },
          { src: data.image3, cap: data.caption3 }
        ];
        var count = layout === '2col' ? 2 : 3;

        for (var i = 0; i < count; i++) {
          var img = images[i];
          html += '<div class="pres-gallery-item">';
          html += '<div class="pres-gallery-image-wrap">';
          if (img.src) {
            html += '<img class="pres-gallery-img" src="' + img.src + '" alt="">';
          } else {
            html += '<div class="pres-placeholder"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Image ' + (i + 1) + '</span></div>';
          }
          html += '</div>';
          if (img.cap) {
            html += '<p class="pres-gallery-caption">' + escapeHtml(img.cap) + '</p>';
          }
          html += '</div>';
        }

        html += '</div>'; // grid
        html += '</div>'; // content
        html += renderSlideLogo(data);
        html += '</div>'; // slide

        return html;
      }
    },

    /* ====================================================================
       DATA / GRAPH SLIDE
       ==================================================================== */
    graph: {
      id: 'graph',
      name: 'Data & Graph',
      description: 'Bar chart or XY plot from data, or a centered image with details.',
      icon: '<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="50" rx="3" fill="#111"/><rect x="6" y="6" width="28" height="3" rx="1" fill="#E31837"/><rect x="12" y="36" width="8" height="7" fill="#E31837" opacity=".7"/><rect x="24" y="26" width="8" height="17" fill="#E31837" opacity=".8"/><rect x="36" y="18" width="8" height="25" fill="#E31837" opacity=".9"/><rect x="48" y="30" width="8" height="13" fill="#E31837" opacity=".75"/><rect x="60" y="22" width="8" height="21" fill="#E31837" opacity=".85"/></svg>',

      fields: [
        { key: 'heading', role: 'title', type: 'text', label: 'Heading', placeholder: 'e.g., Sales Performance Q1-Q4', required: true },
        { key: 'subheading', role: 'subtitle', type: 'text', label: 'Subheading', placeholder: 'e.g., Year-over-year growth analysis' },
        {
          key: 'displayMode', type: 'select', label: 'Display Mode', defaultValue: 'bar',
          options: [
            { value: 'bar', label: 'Bar Chart' },
            { value: 'line', label: 'XY Line Plot' },
            { value: 'image', label: 'Centered Image (e.g., screenshot)' }
          ]
        },
        { key: 'chartData', type: 'chartdata', label: 'Chart Data (label,value per line)', placeholder: 'Q1,120\nQ2,185\nQ3,210\nQ4,165' },
        { key: 'xAxisLabel', type: 'text', label: 'X-Axis Label', placeholder: 'e.g., Quarter' },
        { key: 'yAxisLabel', type: 'text', label: 'Y-Axis Label', placeholder: 'e.g., Units Sold' },
        { key: 'chartImage', role: 'hero-image', type: 'image', label: 'Image (for image mode)' },
        { key: 'notes', role: 'list', type: 'list', label: 'Detail Notes', titleKey: 'notesTitle', titleDefault: 'Key Insights', placeholder: 'Add a note...', maxItems: 8 },
        { key: 'footnote', role: 'footnote', type: 'text', label: 'Footnote / Source', placeholder: 'e.g., Source: Internal sales data' },
        { key: 'logo', role: 'logo', type: 'image', label: 'Logo' }
      ],

      getTitle: function (data) {
        return data.heading || 'Data Slide';
      },

      render: function (data) {
        var mode = data.displayMode || 'bar';
        var html = '<div class="pres-slide pres-slide--graph">';
        html += '<div class="pres-accent-bar"></div>';
        html += '<div class="pres-slide__content">';

        // Header
        html += '<div class="pres-graph-header">';
        html += '<h2 class="pres-graph-heading">' + escapeHtml(data.heading || 'Data & Insights') + '</h2>';
        if (data.subheading) {
          html += '<p class="pres-graph-subheading">' + escapeHtml(data.subheading) + '</p>';
        }
        html += '<div class="pres-graph-underline"></div>';
        html += '</div>';

        // Body
        html += '<div class="pres-graph-body">';

        // Main content area (chart or image)
        html += '<div class="pres-graph-main">';

        if (mode === 'image') {
          // Centered image mode
          if (data.chartImage) {
            html += '<div class="pres-graph-image-wrap">';
            html += '<img class="pres-graph-img" src="' + data.chartImage + '" alt="">';
            html += '</div>';
          } else {
            html += '<div class="pres-placeholder" style="width:100%;height:100%;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Drop an image here<br>(e.g., Excel screenshot)</span></div>';
          }
        } else {
          // Chart mode
          var chartRows = ChartRenderer.parseCSV(data.chartData);
          // Charts use var(--pres-chart-color) via inline style on SVG elements.
          // The fallback below is only used if CSS variables aren't supported.
          // TRP: #6a8da6 (accent-light blue-grey) | Tektro: #3B3B3B (charcoal)
          var concreteAccent = '#6a8da6';

          html += '<div class="pres-graph-chart-wrap">';
          if (chartRows.length > 0) {
            if (mode === 'bar') {
              html += ChartRenderer.barChart(chartRows, 580, 300, concreteAccent);
            } else {
              html += ChartRenderer.xyPlot(chartRows, 580, 300, concreteAccent);
            }
          } else {
            html += '<div class="pres-placeholder" style="width:100%;height:100%;"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 17l4-6 4 4 5-8"/></svg><span>Enter chart data to see preview</span></div>';
          }

          // Axis labels
          if (data.xAxisLabel) {
            html += '<div class="pres-graph-xlabel">' + escapeHtml(data.xAxisLabel) + '</div>';
          }
          if (data.yAxisLabel) {
            html += '<div class="pres-graph-ylabel">' + escapeHtml(data.yAxisLabel) + '</div>';
          }

          html += '</div>'; // chart-wrap
        }

        html += '</div>'; // graph-main

        // Sidebar notes
        if (data.notes && data.notes.some(function (n) {
          var t = (n && typeof n === 'object') ? n.text : n;
          return t && t.trim();
        })) {
          html += '<div class="pres-graph-notes">';
          html += '<div class="pres-graph-notes-title">' + escapeHtml(data.notesTitle || 'Key Insights') + '</div>';
          html += '<ul class="pres-bullet-list">';
          data.notes.forEach(function (raw) {
            var item = (raw && typeof raw === 'object') ? raw : { text: raw || '', indent: 0 };
            if (item.text && item.text.trim()) {
              html += '<li class="pres-bullet-item' + (item.indent ? ' pres-bullet-item--indent' : '') + '"><span class="pres-bullet-item__marker"></span>' + escapeHtml(item.text) + '</li>';
            }
          });
          html += '</ul>';
          html += '</div>';
        }

        html += '</div>'; // body

        // Footnote
        if (data.footnote) {
          html += '<div class="pres-graph-footnote">' + escapeHtml(data.footnote) + '</div>';
        }

        html += '</div>'; // content
        html += renderSlideLogo(data);
        html += '</div>'; // slide

        return html;
      }
    },

    /* ====================================================================
       SPOTLIGHT — Apple-keynote-style emotional product highlight
       ==================================================================== */
    spotlight: {
      id: 'spotlight',
      name: 'Spotlight',
      description: 'Emotional, product-focused highlight slide with hero image and stat callouts.',
      icon: '<svg viewBox="0 0 80 50" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="50" rx="3" fill="#000"/><rect x="28" y="6" width="14" height="2" rx="1" fill="#E31837"/><rect x="20" y="11" width="30" height="3.5" rx="1" fill="#fff"/><circle cx="22" cy="32" r="11" fill="#1A1A1A"/><rect x="16" y="26" width="12" height="12" rx="2" fill="#333"/><rect x="58" y="22" width="14" height="2" rx="1" fill="#666"/><rect x="58" y="26" width="10" height="3" rx="1" fill="#E31837"/><rect x="58" y="31" width="14" height="1.5" rx="1" fill="#444"/></svg>',

      fields: [
        { key: 'kicker', role: 'kicker', type: 'text', label: 'Kicker (small label)', placeholder: 'e.g., Cameras' },
        { key: 'headline', role: 'title', type: 'text', label: 'Headline', placeholder: 'e.g., A big zoom forward.', required: true },
        { key: 'productImage', role: 'hero-image', type: 'image', label: 'Hero Image' },
        {
          key: 'imageMode', type: 'select', label: 'Image Mode', defaultValue: 'contained',
          options: [
            { value: 'contained', label: 'Contained (fits inside)' },
            { value: 'bleed', label: 'Bleed (oversized, edge-cropped)' }
          ]
        },
        {
          key: 'layoutMode', type: 'select', label: 'Layout', defaultValue: 'image-left',
          options: [
            { value: 'image-left', label: 'Image left, stats right' },
            { value: 'image-right', label: 'Image right, stats left' }
          ]
        },
        { key: 'stat1Label', type: 'text', label: 'Stat 1 — small label', placeholder: 'e.g., Up to' },
        { key: 'stat1Value', type: 'text', label: 'Stat 1 — big value', placeholder: 'e.g., 8x' },
        { key: 'stat1Caption', type: 'text', label: 'Stat 1 — caption', placeholder: 'e.g., optical-quality zoom' },
        { key: 'stat2Label', type: 'text', label: 'Stat 2 — small label', placeholder: 'e.g., All' },
        { key: 'stat2Value', type: 'text', label: 'Stat 2 — big value', placeholder: 'e.g., 48MP' },
        { key: 'stat2Caption', type: 'text', label: 'Stat 2 — caption', placeholder: 'e.g., rear cameras' },
        { key: 'stat3Label', type: 'text', label: 'Stat 3 — small label', placeholder: '' },
        { key: 'stat3Value', type: 'text', label: 'Stat 3 — big value', placeholder: '' },
        { key: 'stat3Caption', type: 'text', label: 'Stat 3 — caption', placeholder: '' },
        { key: 'logo', role: 'logo', type: 'image', label: 'Logo' }
      ],

      getTitle: function (data) {
        return data.headline || 'Spotlight';
      },

      render: function (data) {
        var imageMode = data.imageMode || 'contained';
        var layoutMode = data.layoutMode || 'image-left';

        // Collect filled stats (need at least a value to render)
        var stats = [];
        for (var i = 1; i <= 3; i++) {
          if (data['stat' + i + 'Value']) {
            stats.push({
              label: data['stat' + i + 'Label'] || '',
              value: data['stat' + i + 'Value'],
              caption: data['stat' + i + 'Caption'] || ''
            });
          }
        }

        var html = '<div class="pres-slide pres-slide--spotlight pres-slide--spotlight--' + layoutMode + '">';
        html += '<div class="pres-spotlight__head">';
        if (data.kicker) {
          html += '<div class="pres-spotlight__kicker">' + escapeHtml(data.kicker) + '</div>';
        }
        html += '<h2 class="pres-spotlight__headline">' + escapeHtml(data.headline || 'Headline') + '</h2>';
        html += '</div>';

        html += '<div class="pres-spotlight__body">';

        // Image area
        html += '<div class="pres-spotlight__image pres-spotlight__image--' + imageMode + '">';
        if (data.productImage) {
          html += '<img src="' + data.productImage + '" alt="' + escapeHtml(data.headline || '') + '">';
        } else {
          html += '<div class="pres-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Hero Image</span></div>';
        }
        html += '</div>';

        // Stats column
        if (stats.length > 0) {
          html += '<div class="pres-spotlight__stats">';
          stats.forEach(function (s) {
            html += '<div class="pres-spotlight__stat">';
            if (s.label) html += '<div class="pres-spotlight__stat-label">' + escapeHtml(s.label) + '</div>';
            html += '<div class="pres-spotlight__stat-value">' + escapeHtml(s.value) + '</div>';
            if (s.caption) html += '<div class="pres-spotlight__stat-caption">' + escapeHtml(s.caption) + '</div>';
            html += '</div>';
          });
          html += '</div>';
        }

        html += '</div>'; // body
        html += renderSlideLogo(data);
        html += '</div>'; // slide
        return html;
      }
    }
  };

  /**
   * Get ordered template list for UI display
   */
  window.SlideTemplates._order = ['title', 'product', 'gallery', 'spec', 'generic', 'graph', 'spotlight'];

  window.SlideTemplates.getOrderedList = function () {
    return window.SlideTemplates._order.map(function (id) {
      return window.SlideTemplates[id];
    });
  };

  /**
   * Remap slide data from one template to another, preserving as much
   * content as possible.
   *
   * Strategy:
   *   1. Same-name match wins: if oldData has a value under a key that
   *      also exists in newTpl, it's carried over verbatim (e.g. 'logo',
   *      'productImage', '{fieldKey}Bg' background-colour companions).
   *   2. Role match: for each still-empty new field, find an old field
   *      with the same `role` and copy its value.
   *   3. Default: if nothing maps, use the template's defaultValue or
   *      an empty appropriate-type value.
   *
   * Unused old values (couldn't be placed anywhere in the new template)
   * are stashed under newData._orphans[oldTemplateId]. If the user later
   * swaps BACK to that template, the orphans are automatically restored
   * for any empty fields — so chart data, specs tables, etc. survive
   * round-trips.
   */
  window.SlideTemplates.remapSlideData = function (oldTemplateId, newTemplateId, oldData) {
    var oldTpl = window.SlideTemplates[oldTemplateId];
    var newTpl = window.SlideTemplates[newTemplateId];
    if (!newTpl) return oldData || {};

    var newFields = newTpl.fields || [];
    var oldFields = (oldTpl && oldTpl.fields) || [];
    var newData = window.SlideTemplates.getDefaults(newTemplateId);

    // Build a quick lookup: role -> array of old field keys (ordered).
    var oldRoleMap = {};
    oldFields.forEach(function (f) {
      if (!f.role) return;
      (oldRoleMap[f.role] = oldRoleMap[f.role] || []).push(f.key);
    });
    // Set of old keys we've already consumed, so we don't carry a value
    // to more than one destination.
    var consumed = {};

    // Set of old keys that are the EXACT same key in the new template.
    var newKeySet = {};
    newFields.forEach(function (f) { newKeySet[f.key] = true; });

    function hasValue(v) {
      if (v === undefined || v === null || v === '') return false;
      if (Array.isArray(v)) {
        // list/keyvalue: non-empty if at least one entry has a value
        return v.some(function (x) {
          if (typeof x === 'string') return x.trim() !== '';
          if (x && typeof x === 'object') return (x.key && x.key !== '') || (x.value && x.value !== '');
          return false;
        });
      }
      return true;
    }

    // Pass 1: same-name carry-overs. This covers logo, *Bg companions,
    // matching image fields, etc.
    Object.keys(oldData || {}).forEach(function (k) {
      if (k === '_orphans') return;
      if (!newKeySet[k]) return;
      if (!hasValue(oldData[k])) return;
      newData[k] = oldData[k];
      consumed[k] = true;
    });
    // Also carry-over any *Bg companion for a key we just moved.
    Object.keys(oldData || {}).forEach(function (k) {
      if (!/Bg$/.test(k)) return;
      var base = k.slice(0, -2);
      if (newKeySet[base] && hasValue(oldData[k])) {
        newData[k] = oldData[k];
        consumed[k] = true;
      }
    });

    // Pass 2: role-based match for new fields that didn't get same-name values.
    newFields.forEach(function (nf) {
      if (!nf.role) return;
      if (hasValue(newData[nf.key])) return; // already filled by pass 1
      var candidates = oldRoleMap[nf.role] || [];
      for (var i = 0; i < candidates.length; i++) {
        var oldKey = candidates[i];
        if (consumed[oldKey]) continue;
        if (!hasValue(oldData[oldKey])) continue;
        newData[nf.key] = oldData[oldKey];
        consumed[oldKey] = true;
        // If the old key had a *Bg companion and the new key doesn't
        // already have one, carry it under the new name.
        var companion = oldData[oldKey + 'Bg'];
        if (companion && !newData[nf.key + 'Bg']) {
          newData[nf.key + 'Bg'] = companion;
          consumed[oldKey + 'Bg'] = true;
        }
        break;
      }
    });

    // Pass 3: build the new orphan payload.
    var orphans = {};
    // Existing orphans from prior template swaps carry forward.
    var existingOrphans = (oldData && oldData._orphans) || {};
    Object.keys(existingOrphans).forEach(function (tplId) {
      orphans[tplId] = {};
      Object.keys(existingOrphans[tplId]).forEach(function (k) {
        orphans[tplId][k] = existingOrphans[tplId][k];
      });
    });
    // New orphans: anything in oldData not consumed and not already an orphan key.
    if (oldTemplateId && oldTemplateId !== newTemplateId) {
      orphans[oldTemplateId] = orphans[oldTemplateId] || {};
      Object.keys(oldData || {}).forEach(function (k) {
        if (k === '_orphans') return;
        if (consumed[k]) return;
        if (!hasValue(oldData[k])) return;
        orphans[oldTemplateId][k] = oldData[k];
      });
    }

    // Pass 4: restore orphans from a previous visit to newTemplateId.
    if (orphans[newTemplateId]) {
      var restorable = orphans[newTemplateId];
      Object.keys(restorable).forEach(function (k) {
        if (!hasValue(newData[k])) {
          newData[k] = restorable[k];
        }
      });
      // After restoring, clear this template's orphans — they're now live
      // values again, not in stasis.
      delete orphans[newTemplateId];
    }

    // Attach orphans (if any survive).
    var hasAnyOrphans = Object.keys(orphans).some(function (tplId) {
      return Object.keys(orphans[tplId] || {}).length > 0;
    });
    if (hasAnyOrphans) {
      newData._orphans = orphans;
    }

    return newData;
  };

  /**
   * Get default data for a template
   */
  window.SlideTemplates.getDefaults = function (templateId) {
    var template = window.SlideTemplates[templateId];
    if (!template) return {};

    var defaults = {};
    template.fields.forEach(function (field) {
      if (field.type === 'list') {
        defaults[field.key] = [''];
      } else if (field.type === 'keyvalue') {
        defaults[field.key] = [{ key: '', value: '' }];
      } else if (field.type === 'chartdata') {
        defaults[field.key] = '';
      } else if (field.defaultValue !== undefined) {
        defaults[field.key] = field.defaultValue;
      } else {
        defaults[field.key] = '';
      }
    });
    return defaults;
  };

  /**
   * HTML escape helper
   */
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // Expose for use by other modules
  window.escapeHtml = escapeHtml;
})();
