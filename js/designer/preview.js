/*
 * preview.js (designer)
 * Renders a representative slide inside an iframe and re-applies the
 * current edited theme variables via an injected <style> tag.
 *
 * Reuses window.SlideTemplates render functions for fidelity with the
 * production preview path.
 */
(function () {
  'use strict';

  // Default sample data per template — kept minimal, just enough to exercise
  // the tokens that the designer can edit.
  function sampleData(templateId, theme) {
    var logo = theme === 'tektro-light' ? 'assets/Logo Tektro.png'
      : theme === 'trp-tektro-corporate' ? 'assets/Logo TRP Tektro Small.png'
      : 'assets/Logo TRP_w.png';
    switch (templateId) {
      case 'title':
        return {
          title: 'TRP Product Range 2026',
          subtitle: 'Performance Braking & Drivetrain Systems',
          brandLine: 'Engineered for Speed',
          logo: logo,
          backgroundImage: '',
          overlayOpacity: '0.7'
        };
      case 'spec':
        return {
          productCount: 1,
          products: [{
            productName: 'Spyre SLC',
            tagline: 'Flat-mount mechanical disc brake',
            heroImage: 'assets/placeholder.svg',
            specs: [
              { label: 'Weight', value: '143 g' },
              { label: 'Rotor', value: '140 / 160 mm' },
              { label: 'Pad', value: 'Organic resin' },
              { label: 'Caliper', value: 'Dual-piston' }
            ]
          }],
          logo: logo
        };
      default:
        return null;
    }
  }

  function buildVarOverrideCss(themesModel) {
    var blocks = [];
    Object.keys(themesModel).forEach(function (theme) {
      var vars = themesModel[theme];
      if (!vars) return;
      var lines = Object.keys(vars).map(function (k) {
        return '  ' + k + ': ' + vars[k] + ';';
      });
      if (!lines.length) return;
      blocks.push('[data-theme="' + theme + '"] {\n' + lines.join('\n') + '\n}');
    });
    return blocks.join('\n\n');
  }

  function renderInto(iframe, opts) {
    var doc = iframe.contentDocument;
    var theme = opts.theme;
    var templateId = opts.templateId || 'spec';
    var tpl = window.SlideTemplates[templateId];
    if (!tpl) return;
    var data = sampleData(templateId, theme);
    var slideHtml = tpl.render(data, { animated: false }) || '';

    var fontsHref = 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap';
    var baseCss = window.__SLIDES_CSS__ || '';
    var overrideCss = buildVarOverrideCss(opts.overrides || {});

    var html = '<!doctype html><html><head>' +
      '<meta charset="utf-8">' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link href="' + fontsHref + '" rel="stylesheet">' +
      '<style id="base-css">' + baseCss + '</style>' +
      '<style id="theme-overrides">' + overrideCss + '</style>' +
      '<style>html,body{margin:0;background:#222;}' +
      '.pres-stage{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}' +
      '.pres-slide{width:1280px;height:720px;position:relative;transform-origin:center;}' +
      '</style>' +
      '</head><body><div class="pres-stage"><div class="pres-slide" data-theme="' + theme + '">' +
      slideHtml + '</div></div>' +
      '<script>(function(){var s=document.querySelector(".pres-slide");function fit(){var w=window.innerWidth-32,h=window.innerHeight-32;var k=Math.min(w/1280,h/720);s.style.transform="scale("+k+")";}fit();window.addEventListener("resize",fit);})();<\/script>' +
      '</body></html>';

    doc.open();
    doc.write(html);
    doc.close();
  }

  // Lighter-weight live update: only rewrite the override <style> tag.
  function updateOverrides(iframe, overrides) {
    var doc = iframe.contentDocument;
    if (!doc) return;
    var el = doc.getElementById('theme-overrides');
    if (!el) return;
    el.textContent = buildVarOverrideCss(overrides || {});
  }

  window.DesignerPreview = {
    renderInto: renderInto,
    updateOverrides: updateOverrides
  };
})();
