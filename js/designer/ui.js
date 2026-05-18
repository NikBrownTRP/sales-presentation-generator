/*
 * ui.js (designer)
 * Builds the editor form. Pure DOM, no framework.
 *
 * Field groups per theme:
 *   - Colors    (color picker + hex fallback)
 *   - Typography (font, weight, transform, tracking)
 *   - Layout    (numeric tokens with unit suffix)
 *   - Logo      (file input → bytes, kept in model.logoUpload)
 */
(function () {
  'use strict';

  var COLOR_TOKENS = [
    '--pres-bg', '--pres-bg-alt', '--pres-bg-surface',
    '--pres-text', '--pres-text-secondary', '--pres-text-muted',
    '--pres-accent', '--pres-accent-light',
    '--pres-accent-secondary', '--pres-accent-tertiary'
  ];

  var FONT_TOKENS = [
    '--pres-font-heading', '--pres-font-body',
    '--pres-heading-weight', '--pres-heading-transform', '--pres-heading-tracking'
  ];

  var LAYOUT_TOKENS = [
    '--pres-corner-size', '--pres-radius',
    '--pres-accent-bar-height', '--pres-underline-height'
  ];

  var FONT_FAMILIES = [
    "'Oswald', sans-serif",
    "'Manrope', sans-serif",
    "'Inter', sans-serif",
    "'Roboto', sans-serif",
    "'Roboto Mono', monospace",
    "'Source Sans 3', sans-serif",
    "'Playfair Display', serif",
    "'IBM Plex Sans', sans-serif",
    "'IBM Plex Mono', monospace",
    "'JetBrains Mono', monospace"
  ];

  var TRANSFORMS = ['none', 'uppercase', 'lowercase', 'capitalize'];

  var LOGO_FILENAMES = {
    'trp-dark': 'assets/Logo TRP_w.png',
    'tektro-light': 'assets/Logo Tektro.png',
    'trp-tektro-corporate': 'assets/Logo TRP Tektro Small.png'
  };

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === 'class') node.className = props[k];
        else if (k === 'text') node.textContent = props[k];
        else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), props[k]);
        else node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  // Normalize CSS color value (e.g. "#54748a", "rgba(...)") to a hex code
  // suitable for <input type="color">. Falls back to #000000 if unparseable.
  function toColorPicker(value) {
    var v = (value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      return ('#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase();
    }
    var probe = document.createElement('div');
    probe.style.color = v;
    document.body.appendChild(probe);
    var rgb = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    var m = rgb.match(/\d+/g);
    if (!m) return '#000000';
    function h(n) { return ('0' + parseInt(n, 10).toString(16)).slice(-2); }
    return '#' + h(m[0]) + h(m[1]) + h(m[2]);
  }

  function colorField(token, value, onChange) {
    var hex = toColorPicker(value);
    var picker = el('input', { type: 'color', value: hex, class: 'designer-color-picker' });
    var text = el('input', { type: 'text', value: value, class: 'designer-text-input' });
    picker.addEventListener('input', function () {
      text.value = picker.value;
      onChange(picker.value);
    });
    text.addEventListener('change', function () {
      try { picker.value = toColorPicker(text.value); } catch (e) { /* ignore */ }
      onChange(text.value);
    });
    return el('div', { class: 'designer-field' }, [
      el('label', { class: 'designer-field__label', text: token }),
      el('div', { class: 'designer-field__row' }, [picker, text])
    ]);
  }

  function selectField(token, value, options, onChange) {
    var sel = el('select', { class: 'designer-select' });
    var seen = false;
    options.forEach(function (opt) {
      var o = el('option', { value: opt, text: opt });
      if (opt === value) { o.setAttribute('selected', 'selected'); seen = true; }
      sel.appendChild(o);
    });
    if (!seen) {
      var o = el('option', { value: value, text: value + ' (current)' });
      o.setAttribute('selected', 'selected');
      sel.insertBefore(o, sel.firstChild);
    }
    sel.addEventListener('change', function () { onChange(sel.value); });
    return el('div', { class: 'designer-field' }, [
      el('label', { class: 'designer-field__label', text: token }),
      sel
    ]);
  }

  function textField(token, value, onChange) {
    var input = el('input', { type: 'text', value: value, class: 'designer-text-input' });
    input.addEventListener('change', function () { onChange(input.value); });
    return el('div', { class: 'designer-field' }, [
      el('label', { class: 'designer-field__label', text: token }),
      input
    ]);
  }

  function logoField(theme, onPick) {
    var file = el('input', { type: 'file', accept: 'image/png' });
    var status = el('span', { class: 'designer-logo__status', text: 'No new file selected' });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var bytes = new Uint8Array(reader.result);
        onPick({ filename: LOGO_FILENAMES[theme], bytes: bytes, size: f.size, name: f.name });
        status.textContent = 'Will overwrite ' + LOGO_FILENAMES[theme] + ' (' + Math.round(f.size / 1024) + ' kB)';
      };
      reader.readAsArrayBuffer(f);
    });
    return el('div', { class: 'designer-field' }, [
      el('label', { class: 'designer-field__label', text: 'Logo (overwrites ' + LOGO_FILENAMES[theme] + ')' }),
      file,
      status
    ]);
  }

  function sectionHeader(title) {
    return el('h3', { class: 'designer-section__title', text: title });
  }

  function buildThemePanel(theme, parsed, model, onChange, onLogo) {
    var vars = parsed.vars;
    var panel = el('div', { class: 'designer-theme-panel', 'data-theme-panel': theme });

    panel.appendChild(sectionHeader('Colors'));
    COLOR_TOKENS.forEach(function (t) {
      if (!vars[t]) return;
      panel.appendChild(colorField(t, model[t] != null ? model[t] : vars[t].value, function (v) {
        onChange(theme, t, v);
      }));
    });

    panel.appendChild(sectionHeader('Typography'));
    FONT_TOKENS.forEach(function (t) {
      if (!vars[t]) return;
      var cur = model[t] != null ? model[t] : vars[t].value;
      if (t === '--pres-font-heading' || t === '--pres-font-body') {
        panel.appendChild(selectField(t, cur, FONT_FAMILIES, function (v) { onChange(theme, t, v); }));
      } else if (t === '--pres-heading-transform') {
        panel.appendChild(selectField(t, cur, TRANSFORMS, function (v) { onChange(theme, t, v); }));
      } else {
        panel.appendChild(textField(t, cur, function (v) { onChange(theme, t, v); }));
      }
    });

    panel.appendChild(sectionHeader('Layout tokens'));
    LAYOUT_TOKENS.forEach(function (t) {
      if (!vars[t]) return;
      panel.appendChild(textField(t, model[t] != null ? model[t] : vars[t].value, function (v) {
        onChange(theme, t, v);
      }));
    });

    panel.appendChild(sectionHeader('Logo'));
    panel.appendChild(logoField(theme, function (info) { onLogo(theme, info); }));

    return panel;
  }

  window.DesignerUI = {
    THEMES: ['trp-dark', 'tektro-light', 'trp-tektro-corporate'],
    LOGO_FILENAMES: LOGO_FILENAMES,
    buildThemePanel: buildThemePanel,
    el: el
  };
})();
