/* ==========================================================================
   Sales Presentation Generator — Export Manager
   Save/Load (localStorage + JSON file), PDF export, standalone HTML export
   ========================================================================== */
'use strict';

(function () {

  var LS_KEY = 'pres-generator-autosave';
  var SLIDE_W = 960;
  var SLIDE_H = 540;

  /* -----------------------------------------------------------------------
     LocalStorage save / load
     ----------------------------------------------------------------------- */
  function saveToLocalStorage(state) {
    try {
      var json = JSON.stringify({
        slides: state.slides,
        theme: state.theme,
        meta: state.meta
      });
      localStorage.setItem(LS_KEY, json);
    } catch (e) {
      // quota exceeded — silently fail, user can use Save to File
    }
  }

  function loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  /* -----------------------------------------------------------------------
     JSON file save / load
     ----------------------------------------------------------------------- */
  function saveToFile(state) {
    var data = {
      _format: 'pres-generator-v1',
      slides: state.slides,
      theme: state.theme,
      meta: {
        title: state.meta.title || 'Untitled Presentation',
        updatedAt: new Date().toISOString()
      }
    };
    var json = JSON.stringify(data, null, 2);
    downloadBlob(json, sanitizeFilename(data.meta.title) + '.json', 'application/json');
  }

  /* -----------------------------------------------------------------------
     PDF Export  (html2canvas + jsPDF)
     ----------------------------------------------------------------------- */
  function exportToPDF(state, dom) {
    if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
      alert('PDF libraries are still loading. Please wait a moment and try again.');
      return;
    }

    var slides = state.slides;
    var theme = state.theme;
    var total = slides.length;
    var title = state.meta.title || 'Presentation';

    // Show progress modal
    showExportProgress(dom, 'Preparing slides...', 0);

    // Create an offscreen container for rendering
    var offscreen = document.createElement('div');
    offscreen.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
    document.body.appendChild(offscreen);

    // Build the jsPDF instance — landscape, px units, custom slide size
    var pdf = new jspdf.jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [SLIDE_W, SLIDE_H],
      hotfixes: ['px_scaling']
    });

    var slideIndex = 0;

    function renderNext() {
      if (slideIndex >= total) {
        // Done — save and clean up
        document.body.removeChild(offscreen);
        pdf.save(sanitizeFilename(title) + '.pdf');
        hideExportProgress(dom);
        return;
      }

      var slide = slides[slideIndex];
      var template = window.SlideTemplates[slide.templateId];
      if (!template) { slideIndex++; renderNext(); return; }

      showExportProgress(dom, 'Rendering slide ' + (slideIndex + 1) + ' of ' + total + '...', ((slideIndex) / total) * 100);

      // Create slide DOM
      var wrapper = document.createElement('div');
      wrapper.setAttribute('data-theme', theme);
      wrapper.style.cssText = 'width:' + SLIDE_W + 'px;height:' + SLIDE_H + 'px;position:relative;overflow:hidden;';
      wrapper.innerHTML = template.render(slide.data);
      offscreen.appendChild(wrapper);

      // Wait for images to load
      waitForImages(wrapper).then(function () {
        return html2canvas(wrapper, {
          width: SLIDE_W,
          height: SLIDE_H,
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: null
        });
      }).then(function (canvas) {
        var imgData = canvas.toDataURL('image/jpeg', 0.92);

        if (slideIndex > 0) {
          pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, SLIDE_W, SLIDE_H);

        offscreen.removeChild(wrapper);
        slideIndex++;

        showExportProgress(dom, 'Rendering slide ' + Math.min(slideIndex + 1, total) + ' of ' + total + '...', (slideIndex / total) * 100);

        // Use setTimeout to allow the UI to update between renders
        setTimeout(renderNext, 50);
      }).catch(function (err) {
        console.error('Error rendering slide ' + (slideIndex + 1) + ':', err);
        offscreen.removeChild(wrapper);
        slideIndex++;
        setTimeout(renderNext, 50);
      });
    }

    // Ensure fonts are loaded before starting
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        setTimeout(renderNext, 200);
      });
    } else {
      setTimeout(renderNext, 500);
    }
  }

  /* -----------------------------------------------------------------------
     Standalone HTML Export (with embedded state for re-import)
     ----------------------------------------------------------------------- */
  function exportToHTML(state) {
    var slides = state.slides;
    var theme = state.theme;
    var title = state.meta.title || 'Presentation';

    // Build the slide HTML
    var slidesHtml = '';
    slides.forEach(function (slide, i) {
      var template = window.SlideTemplates[slide.templateId];
      if (!template) return;
      var activeClass = i === 0 ? ' pres-slide--animated' : '';
      var rendered = template.render(slide.data);
      // Inject animated class into first slide
      if (i === 0) {
        rendered = rendered.replace('class="pres-slide ', 'class="pres-slide' + activeClass + ' ');
      }
      slidesHtml += '<div class="slideshow-slide' + (i === 0 ? ' slideshow-slide--active' : '') + '" data-index="' + i + '">' + rendered + '</div>';
    });

    // Embed the full state as JSON for re-import
    var stateJson = JSON.stringify({
      _format: 'pres-generator-v1',
      slides: state.slides,
      theme: state.theme,
      meta: { title: title, updatedAt: new Date().toISOString() }
    });

    // Read the current slides.css content inline
    var cssContent = getSlidesCSSContent();

    var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
    html += '<meta charset="UTF-8">\n';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    html += '<title>' + escapeHtml(title) + '</title>\n';
    html += '<link rel="preconnect" href="https://fonts.googleapis.com">\n';
    html += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n';
    html += '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Sora:wght@400;500;600&family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">\n';
    html += '<style>\n';
    html += '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\n';
    html += 'html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: "Inter", sans-serif; }\n';
    html += cssContent + '\n';
    html += getSlideshowCSS() + '\n';
    html += '</style>\n';
    html += '</head>\n<body>\n';

    // Navigation header
    html += '<div class="slideshow-nav">\n';
    html += '  <span class="slideshow-counter" id="counter">1 / ' + slides.length + '</span>\n';
    html += '  <span class="slideshow-title">' + escapeHtml(title) + '</span>\n';
    html += '  <div class="slideshow-controls">\n';
    html += '    <button onclick="prev()" class="slideshow-btn" title="Previous (Left Arrow)">&larr;</button>\n';
    html += '    <button onclick="next()" class="slideshow-btn" title="Next (Right Arrow)">&rarr;</button>\n';
    html += '  </div>\n';
    html += '</div>\n';

    // Stage
    html += '<div class="slideshow-stage" data-theme="' + theme + '" id="stage">\n';
    html += slidesHtml;
    html += '</div>\n';

    // Dot nav
    html += '<div class="slideshow-dots" id="dots">\n';
    slides.forEach(function (s, i) {
      html += '  <button class="slideshow-dot' + (i === 0 ? ' slideshow-dot--active' : '') + '" onclick="goTo(' + i + ')"></button>\n';
    });
    html += '</div>\n';

    // Embedded state for re-import
    html += '<script type="application/json" id="presentation-data">\n';
    html += stateJson;
    html += '\n<\/script>\n';

    // Slideshow JS
    html += '<script>\n';
    html += getSlideshowJS(slides.length);
    html += '\n<\/script>\n';

    html += '</body>\n</html>';

    downloadBlob(html, sanitizeFilename(title) + '.html', 'text/html');
  }

  /* -----------------------------------------------------------------------
     Build inline CSS for the exported HTML slideshow
     ----------------------------------------------------------------------- */
  var _cachedSlidesCSS = '';

  function preloadSlidesCSS() {
    // Fetch slides.css content via XHR for reliable export
    // Try styleSheets API first, fall back to fetch
    try {
      var sheets = document.styleSheets;
      for (var i = 0; i < sheets.length; i++) {
        var href = sheets[i].href || '';
        if (href.indexOf('slides.css') !== -1) {
          var rules = sheets[i].cssRules || sheets[i].rules;
          if (rules && rules.length > 0) {
            var css = '';
            for (var j = 0; j < rules.length; j++) {
              css += rules[j].cssText + '\n';
            }
            _cachedSlidesCSS = css;
            return;
          }
        }
      }
    } catch (e) {
      // CORS — fall through to fetch
    }

    // Fallback: fetch the file directly
    var link = document.querySelector('link[href*="slides.css"]');
    if (link) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', link.href, false); // synchronous
      try {
        xhr.send();
        if (xhr.status === 200) {
          _cachedSlidesCSS = xhr.responseText;
        }
      } catch (e) {
        // final fallback — empty
      }
    }
  }

  function getSlidesCSSContent() {
    if (!_cachedSlidesCSS) {
      preloadSlidesCSS();
    }
    return _cachedSlidesCSS;
  }

  function getSlideshowCSS() {
    return [
      '.slideshow-nav { position: fixed; top: 0; left: 0; right: 0; height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent); z-index: 100; }',
      '.slideshow-counter { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7); font-family: "Montserrat", sans-serif; min-width: 60px; }',
      '.slideshow-title { font-size: 13px; color: rgba(255,255,255,0.5); font-family: "Inter", sans-serif; }',
      '.slideshow-controls { display: flex; gap: 8px; }',
      '.slideshow-btn { padding: 6px 14px; background: rgba(255,255,255,0.1); border: none; color: #fff; border-radius: 4px; cursor: pointer; font-size: 16px; transition: background 0.2s; }',
      '.slideshow-btn:hover { background: rgba(255,255,255,0.2); }',
      '.slideshow-stage { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }',
      '.slideshow-slide { position: absolute; width: 960px; height: 540px; transition: transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s ease; overflow: hidden; }',
      '.slideshow-slide--active { opacity: 1; }',
      '.slideshow-slide--prev { opacity: 0; pointer-events: none; }',
      '.slideshow-slide--next { opacity: 0; pointer-events: none; }',
      '.slideshow-dots { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; z-index: 100; }',
      '.slideshow-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.3); border: none; padding: 0; cursor: pointer; transition: all 0.2s; }',
      '.slideshow-dot--active { background: #E31837; transform: scale(1.3); }'
    ].join('\n');
  }

  function getSlideshowJS(total) {
    return [
      'var current = 0, total = ' + total + ';',
      'function goTo(i) {',
      '  if (i < 0 || i >= total) return;',
      '  var elems = document.querySelectorAll(".slideshow-slide");',
      '  var dots = document.querySelectorAll(".slideshow-dot");',
      '  elems.forEach(function(s, idx) {',
      '    s.classList.remove("slideshow-slide--active","slideshow-slide--prev","slideshow-slide--next");',
      '    var ps = s.querySelector(".pres-slide");',
      '    if (ps) ps.classList.remove("pres-slide--animated");',
      '    if (idx === i) { s.classList.add("slideshow-slide--active"); if(ps) ps.classList.add("pres-slide--animated"); }',
      '    else if (idx < i) s.classList.add("slideshow-slide--prev");',
      '    else s.classList.add("slideshow-slide--next");',
      '  });',
      '  dots.forEach(function(d, idx) { d.classList.toggle("slideshow-dot--active", idx === i); });',
      '  document.getElementById("counter").textContent = (i+1) + " / " + total;',
      '  current = i;',
      '  scaleSlides();',
      '}',
      'function next() { goTo(current + 1); }',
      'function prev() { goTo(current - 1); }',
      'function scaleSlides() {',
      '  var vw = window.innerWidth - 40, vh = window.innerHeight - 80;',
      '  var sw = 960, sh = 540;',
      '  var scale = Math.min(vw/sw, vh/sh, 2);',
      '  document.querySelectorAll(".slideshow-slide").forEach(function(el) {',
      '    el.style.transform = el.classList.contains("slideshow-slide--prev") ? "translateX(-120%) scale(" + scale + ")" :',
      '      el.classList.contains("slideshow-slide--next") ? "translateX(120%) scale(" + scale + ")" :',
      '      "scale(" + scale + ")";',
      '  });',
      '}',
      'document.addEventListener("keydown", function(e) {',
      '  if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }',
      '  else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }',
      '});',
      'window.addEventListener("resize", scaleSlides);',
      'scaleSlides();',
      '// Initialize non-active slides',
      'document.querySelectorAll(".slideshow-slide:not(.slideshow-slide--active)").forEach(function(s) { s.classList.add("slideshow-slide--next"); });'
    ].join('\n');
  }

  /* -----------------------------------------------------------------------
     Progress modal helpers
     ----------------------------------------------------------------------- */
  function showExportProgress(dom, text, percent) {
    dom.exportProgressText.textContent = text;
    dom.exportProgressFill.style.width = Math.round(percent) + '%';
    dom.modalExport.classList.add('modal--visible');
    dom.modalExport.setAttribute('aria-hidden', 'false');
  }

  function hideExportProgress(dom) {
    dom.modalExport.classList.remove('modal--visible');
    dom.modalExport.setAttribute('aria-hidden', 'true');
    dom.exportProgressFill.style.width = '0%';
  }

  /* -----------------------------------------------------------------------
     Utility helpers
     ----------------------------------------------------------------------- */
  function downloadBlob(content, filename, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function sanitizeFilename(name) {
    return (name || 'presentation').replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_').substring(0, 60) || 'presentation';
  }

  function waitForImages(container) {
    var imgs = container.querySelectorAll('img');
    var promises = [];
    imgs.forEach(function (img) {
      if (!img.complete) {
        promises.push(new Promise(function (resolve) {
          img.onload = resolve;
          img.onerror = resolve;
        }));
      }
    });
    return promises.length > 0 ? Promise.all(promises) : Promise.resolve();
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* -----------------------------------------------------------------------
     Expose
     ----------------------------------------------------------------------- */
  window.ExportManager = {
    saveToLocalStorage: saveToLocalStorage,
    loadFromLocalStorage: loadFromLocalStorage,
    saveToFile: saveToFile,
    exportToPDF: exportToPDF,
    exportToHTML: exportToHTML
  };

  // Preload slides CSS on DOMContentLoaded for reliable export
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(preloadSlidesCSS, 500);
  });

})();
