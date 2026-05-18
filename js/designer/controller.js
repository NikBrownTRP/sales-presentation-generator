/*
 * controller.js (designer)
 * Wires parse → ui → preview → serialize → publish.
 *
 * In-memory model:
 *   {
 *     baseCss: '<full slides.css as fetched>',
 *     baseSha: 'github file sha',
 *     parsed:  { theme → ParsedTheme },           // see parse-theme.js
 *     edits:   { theme → { token → newValue } }, // pending changes
 *     logoUploads: { theme → { filename, bytes, name, size } }
 *   }
 */
(function () {
  'use strict';

  var THEMES = ['trp-dark', 'tektro-light', 'trp-tektro-corporate'];
  var TEMPLATES = ['title', 'spec'];

  var state = {
    baseCss: '',
    baseSha: null,
    parsed: {},
    edits: { 'trp-dark': {}, 'tektro-light': {}, 'trp-tektro-corporate': {} },
    logoUploads: {},
    activeTheme: 'trp-dark',
    activeTemplate: 'spec'
  };

  var els = {};

  function $(id) { return document.getElementById(id); }
  function el(tag, props, kids) { return window.DesignerUI.el(tag, props, kids); }

  function loadBaseCssLocal() {
    // Use the bundled string for first-paint; will be refreshed against
    // GitHub at publish-time.
    state.baseCss = window.__SLIDES_CSS__ || '';
    state.parsed = window.DesignerParseTheme.parseAllThemes(state.baseCss, THEMES);
  }

  function buildTopBar() {
    var bar = el('div', { class: 'designer-topbar' });

    // Theme tabs
    var tabs = el('div', { class: 'designer-tabs' });
    THEMES.forEach(function (t) {
      var btn = el('button', { class: 'designer-tab' + (t === state.activeTheme ? ' is-active' : ''), text: t });
      btn.addEventListener('click', function () { setActiveTheme(t); });
      tabs.appendChild(btn);
    });
    bar.appendChild(tabs);

    // Template selector for preview
    var prevSel = el('select', { class: 'designer-select designer-template-select' });
    TEMPLATES.forEach(function (id) {
      var o = el('option', { value: id, text: 'Preview: ' + id });
      if (id === state.activeTemplate) o.setAttribute('selected', 'selected');
      prevSel.appendChild(o);
    });
    prevSel.addEventListener('change', function () {
      state.activeTemplate = prevSel.value;
      rerenderPreview();
    });
    bar.appendChild(prevSel);

    // Actions
    var actions = el('div', { class: 'designer-actions' });

    var settingsBtn = el('button', { class: 'designer-btn', text: 'Settings' });
    settingsBtn.addEventListener('click', openSettings);
    actions.appendChild(settingsBtn);

    var dryBtn = el('button', { class: 'designer-btn', text: 'Dry run (diff)' });
    dryBtn.addEventListener('click', dryRun);
    actions.appendChild(dryBtn);

    var pubBtn = el('button', { class: 'designer-btn designer-btn--primary', text: 'Publish' });
    pubBtn.addEventListener('click', publish);
    actions.appendChild(pubBtn);

    bar.appendChild(actions);
    return bar;
  }

  function buildFormPane() {
    var pane = el('div', { class: 'designer-form-pane' });
    THEMES.forEach(function (t) {
      var parsed = state.parsed[t];
      if (!parsed) {
        pane.appendChild(el('div', { class: 'designer-error', text: 'Theme "' + t + '" not found in slides.css' }));
        return;
      }
      var panel = window.DesignerUI.buildThemePanel(t, parsed, state.edits[t] || {}, onChange, onLogo);
      panel.style.display = (t === state.activeTheme) ? '' : 'none';
      pane.appendChild(panel);
    });
    return pane;
  }

  function setActiveTheme(theme) {
    state.activeTheme = theme;
    // Toggle tab active state
    var tabs = els.root.querySelectorAll('.designer-tab');
    tabs.forEach(function (b) {
      b.classList.toggle('is-active', b.textContent === theme);
    });
    // Toggle panel visibility
    var panels = els.root.querySelectorAll('[data-theme-panel]');
    panels.forEach(function (p) {
      p.style.display = (p.getAttribute('data-theme-panel') === theme) ? '' : 'none';
    });
    rerenderPreview();
  }

  function onChange(theme, token, value) {
    if (!state.edits[theme]) state.edits[theme] = {};
    var orig = state.parsed[theme] && state.parsed[theme].vars[token];
    if (orig && value === orig.value) {
      delete state.edits[theme][token];
    } else {
      state.edits[theme][token] = value;
    }
    updatePreviewOverrides();
  }

  function onLogo(theme, info) {
    state.logoUploads[theme] = info;
  }

  function currentOverridesForPreview() {
    // Combine base values + edits for ALL themes (preview iframe may need any).
    var combined = {};
    THEMES.forEach(function (t) {
      combined[t] = {};
      var parsed = state.parsed[t];
      if (parsed) {
        Object.keys(parsed.vars).forEach(function (k) {
          combined[t][k] = parsed.vars[k].value;
        });
      }
      var ed = state.edits[t] || {};
      Object.keys(ed).forEach(function (k) { combined[t][k] = ed[k]; });
    });
    return combined;
  }

  function rerenderPreview() {
    window.DesignerPreview.renderInto(els.iframe, {
      theme: state.activeTheme,
      templateId: state.activeTemplate,
      overrides: currentOverridesForPreview()
    });
  }

  function updatePreviewOverrides() {
    window.DesignerPreview.updateOverrides(els.iframe, currentOverridesForPreview());
  }

  function dryRun() {
    var next = window.DesignerSerializeTheme.serialize(state.baseCss, state.edits);
    var equal = next === state.baseCss;
    var changeCount = 0;
    Object.keys(state.edits).forEach(function (t) { changeCount += Object.keys(state.edits[t]).length; });
    var lines = [];
    Object.keys(state.edits).forEach(function (t) {
      Object.keys(state.edits[t]).forEach(function (k) {
        var was = state.parsed[t].vars[k] ? state.parsed[t].vars[k].value : '(new)';
        lines.push('[' + t + '] ' + k + ': ' + was + ' → ' + state.edits[t][k]);
      });
    });
    console.group('Designer — dry run');
    console.log(changeCount + ' edit(s); CSS ' + (equal ? 'unchanged' : 'changed (' + (next.length - state.baseCss.length) + ' byte delta)'));
    lines.forEach(function (l) { console.log(l); });
    if (state.logoUploads) {
      Object.keys(state.logoUploads).forEach(function (t) {
        console.log('[' + t + '] logo upload → ' + state.logoUploads[t].filename + ' (' + state.logoUploads[t].size + ' bytes)');
      });
    }
    console.groupEnd();
    setStatus(equal && !Object.keys(state.logoUploads).length ? 'Dry run: no changes' : 'Dry run: ' + changeCount + ' var edit(s), see console');
  }

  function setStatus(msg, kind) {
    els.status.textContent = msg;
    els.status.className = 'designer-status' + (kind ? ' designer-status--' + kind : '');
  }

  function publish() {
    var changeCount = 0;
    Object.keys(state.edits).forEach(function (t) { changeCount += Object.keys(state.edits[t]).length; });
    var logoCount = Object.keys(state.logoUploads).length;
    if (!changeCount && !logoCount) {
      setStatus('Nothing to publish.');
      return;
    }
    if (!confirm('Publish ' + changeCount + ' variable change(s) and ' + logoCount + ' logo upload(s) to GitHub?')) return;

    setStatus('Publishing…');
    var api = window.DesignerGitHubAPI;
    var logoThemes = Object.keys(state.logoUploads);

    // Upload logos sequentially, each as its own commit, then update slides.css, then index.html.
    var p = Promise.resolve();
    logoThemes.forEach(function (t) {
      p = p.then(function () {
        var info = state.logoUploads[t];
        return api.getFile(info.filename).then(function (cur) {
          return api.putBinary(info.filename, info.bytes, cur.sha, 'chore(theme): replace logo for ' + t);
        }, function () {
          // Not found is fine; create it.
          return api.putBinary(info.filename, info.bytes, null, 'chore(theme): add logo for ' + t);
        });
      });
    });

    p.then(function () {
      if (!changeCount) return null;
      return api.getFile('css/slides.css').then(function (cur) {
        var next = window.DesignerSerializeTheme.serialize(cur.content, state.edits);
        if (next === cur.content) return null;
        return api.putFile('css/slides.css', next, cur.sha, 'chore(theme): update theme variables via designer').then(function () {
          return cur; // for index.html step we just need to know we changed CSS
        });
      });
    }).then(function (changed) {
      if (!changed) return null;
      // Re-embed into index.html using build-css.sh's marker contract.
      return api.getFile('css/slides.css').then(function (latestCss) {
        return api.getFile('index.html').then(function (idxCur) {
          var marker = 'window.__SLIDES_CSS__ = ';
          var idx = idxCur.content.indexOf(marker);
          if (idx === -1) throw new Error('Marker not found in index.html');
          var valStart = idx + marker.length;
          // Find end of JSON string + ';' — mirror of build-css.sh logic.
          var inString = false, escape = false, end = -1;
          for (var i = valStart; i < idxCur.content.length; i++) {
            var c = idxCur.content[i];
            if (escape) { escape = false; continue; }
            if (c === '\\') { escape = true; continue; }
            if (c === '"') { inString = !inString; continue; }
            if (!inString && c === ';') { end = i + 1; break; }
          }
          if (end === -1) throw new Error('Could not locate end of __SLIDES_CSS__ literal');
          var newAssignment = marker + JSON.stringify(latestCss.content) + ';';
          var newHtml = idxCur.content.slice(0, idx) + newAssignment + idxCur.content.slice(end);
          if (newHtml === idxCur.content) return null;
          return api.putFile('index.html', newHtml, idxCur.sha, 'chore(theme): re-embed slides.css into index.html');
        });
      });
    }).then(function () {
      state.edits = { 'trp-dark': {}, 'tektro-light': {}, 'trp-tektro-corporate': {} };
      state.logoUploads = {};
      setStatus('Published. GitHub Pages will redeploy in ~1 minute.', 'ok');
    }).catch(function (err) {
      console.error(err);
      setStatus('Publish failed: ' + (err && err.message || err), 'err');
    });
  }

  function openSettings() {
    var cfg = window.DesignerGitHubAPI.getConfig();
    var modal = el('div', { class: 'designer-modal-backdrop' });
    var card = el('div', { class: 'designer-modal' });
    card.appendChild(el('h2', { text: 'GitHub settings' }));
    card.appendChild(el('p', { class: 'designer-modal__hint', text: 'Token is stored only in this browser (localStorage). It is sent only to api.github.com.' }));

    var repoIn = el('input', { type: 'text', class: 'designer-text-input', placeholder: 'owner/name', value: cfg.repo });
    var branchIn = el('input', { type: 'text', class: 'designer-text-input', placeholder: 'main', value: cfg.branch });
    var tokenIn = el('input', { type: 'password', class: 'designer-text-input', placeholder: 'github_pat_…', value: cfg.token });

    card.appendChild(el('label', { class: 'designer-field__label', text: 'Repo (owner/name)' }));
    card.appendChild(repoIn);
    card.appendChild(el('label', { class: 'designer-field__label', text: 'Branch' }));
    card.appendChild(branchIn);
    card.appendChild(el('label', { class: 'designer-field__label', text: 'Personal Access Token (scope: repo or public_repo)' }));
    card.appendChild(tokenIn);
    card.appendChild(el('p', { class: 'designer-modal__hint', text: 'Create one at github.com/settings/tokens.' }));

    var row = el('div', { class: 'designer-modal__row' });
    var save = el('button', { class: 'designer-btn designer-btn--primary', text: 'Save' });
    var forget = el('button', { class: 'designer-btn', text: 'Forget token' });
    var cancel = el('button', { class: 'designer-btn', text: 'Close' });
    save.addEventListener('click', function () {
      window.DesignerGitHubAPI.setConfig({ repo: repoIn.value.trim(), branch: branchIn.value.trim() || 'main', token: tokenIn.value.trim() });
      document.body.removeChild(modal);
      setStatus('Settings saved.');
    });
    forget.addEventListener('click', function () {
      window.DesignerGitHubAPI.clearToken();
      tokenIn.value = '';
      setStatus('Token cleared.');
    });
    cancel.addEventListener('click', function () { document.body.removeChild(modal); });
    row.appendChild(save); row.appendChild(forget); row.appendChild(cancel);
    card.appendChild(row);

    modal.appendChild(card);
    document.body.appendChild(modal);
  }

  function mount(root) {
    els.root = root;
    loadBaseCssLocal();

    var topbar = buildTopBar();
    els.status = el('div', { class: 'designer-status', text: 'Ready.' });
    var body = el('div', { class: 'designer-body' });
    els.form = buildFormPane();
    els.previewWrap = el('div', { class: 'designer-preview' });
    els.iframe = el('iframe', { class: 'designer-iframe' });
    els.previewWrap.appendChild(els.iframe);
    body.appendChild(els.form);
    body.appendChild(els.previewWrap);

    root.appendChild(topbar);
    root.appendChild(els.status);
    root.appendChild(body);

    // Initial render after iframe is in the DOM.
    setTimeout(rerenderPreview, 0);
  }

  window.DesignerController = { mount: mount };
})();
