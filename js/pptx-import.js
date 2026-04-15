/* ==========================================================================
   PPTX Importer
   Extracts text + images from a .pptx file and maps each slide to one of the
   app's templates (title / gallery / generic) via simple heuristics.
   Produces a state-shaped object consumable by controller.js loadState().

   Public API:
     window.PptxImporter.parse(arrayBuffer) -> Promise<state>
   ========================================================================== */
'use strict';

(function () {

  /* -----------------------------------------------------------------------
     Image constraints — mirrored from controller.js resizeImage() callers
     so imported images stay within the same size budget as uploads.
     ----------------------------------------------------------------------- */
  var IMAGE_BUDGET = {
    hero: { w: 1200, h: 900 },    // productImage, image, backgroundImage, imageN
    logo: { w: 400, h: 200 },
    other: { w: 1920, h: 1080 }
  };

  var EXT_TO_MIME = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp'
  };

  /* -----------------------------------------------------------------------
     uid — duplicated from controller.js (IIFE-scoped there). A separate
     module needs its own id generator; 10 chars is plenty for slide ids.
     ----------------------------------------------------------------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  /* -----------------------------------------------------------------------
     resizeImage — duplicated from controller.js. controller.js wraps its
     copy in an IIFE, so we carry a private copy rather than poke a hole in
     that encapsulation. 17 lines; not worth refactoring the controller.
     ----------------------------------------------------------------------- */
  function resizeImage(dataUrl, maxW, maxH, quality) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        if (ratio >= 1) { resolve(dataUrl); return; }
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var isPng = dataUrl.indexOf('data:image/png') === 0;
        resolve(isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', quality || 0.85));
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  /* -----------------------------------------------------------------------
     XML helpers — ignore namespace prefixes (a:, p:, r:) via '*' namespace.
     ----------------------------------------------------------------------- */
  function parseXml(str) {
    var doc = new DOMParser().parseFromString(str, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('Malformed XML inside .pptx');
    }
    return doc;
  }

  function findAll(node, localName) {
    return node.getElementsByTagNameNS('*', localName);
  }

  function findFirst(node, localName) {
    var list = findAll(node, localName);
    return list.length ? list[0] : null;
  }

  /* -----------------------------------------------------------------------
     zip accessors — thin wrappers that tolerate missing files.
     ----------------------------------------------------------------------- */
  function readText(zip, path) {
    var f = zip.file(path);
    return f ? f.async('string') : Promise.resolve(null);
  }

  function readBase64(zip, path) {
    var f = zip.file(path);
    return f ? f.async('base64') : Promise.resolve(null);
  }

  /* -----------------------------------------------------------------------
     Parse a _rels file into { rId: Target } map. Targets in slide rels
     are relative to the slide file (e.g. "../media/image1.png"); we
     resolve them to canonical zip paths here.
     ----------------------------------------------------------------------- */
  function parseRels(relsXml, basePath) {
    var map = {};
    if (!relsXml) return map;
    var doc = parseXml(relsXml);
    var rels = findAll(doc, 'Relationship');
    for (var i = 0; i < rels.length; i++) {
      var id = rels[i].getAttribute('Id');
      var target = rels[i].getAttribute('Target');
      if (id && target) {
        map[id] = resolvePath(basePath, target);
      }
    }
    return map;
  }

  // Resolve "../media/image1.png" against "ppt/slides/slide1.xml" -> "ppt/media/image1.png".
  function resolvePath(basePath, relative) {
    if (relative.charAt(0) === '/') return relative.substr(1);
    var baseParts = basePath.split('/');
    baseParts.pop();                  // drop filename
    var relParts = relative.split('/');
    for (var i = 0; i < relParts.length; i++) {
      var seg = relParts[i];
      if (seg === '..') baseParts.pop();
      else if (seg !== '.' && seg !== '') baseParts.push(seg);
    }
    return baseParts.join('/');
  }

  /* -----------------------------------------------------------------------
     Slide extraction — produce a neutral { title, paragraphs, imagePaths }
     representation. Template mapping happens later.
     ----------------------------------------------------------------------- */
  function extractSlide(slideXml, slideRels) {
    var out = { title: '', paragraphs: [], imagePaths: [] };
    var doc = parseXml(slideXml);

    // Walk every shape. Text shapes are <p:sp>, pictures are <p:pic>.
    // We iterate the whole sp/pic list in document order so paragraph
    // ordering matches what the user sees in PowerPoint.
    var shapes = findAll(doc, 'sp');
    for (var i = 0; i < shapes.length; i++) {
      var shape = shapes[i];
      // Placeholder type lives in <p:nvSpPr><p:nvPr><p:ph type="..."/>
      var ph = findFirst(shape, 'ph');
      var isTitle = false;
      if (ph) {
        var phType = ph.getAttribute('type') || '';
        if (phType === 'title' || phType === 'ctrTitle') isTitle = true;
      }

      var txBody = findFirst(shape, 'txBody');
      if (!txBody) continue;

      var paragraphs = findAll(txBody, 'p');
      for (var p = 0; p < paragraphs.length; p++) {
        // Concatenate every <a:t> text run inside this paragraph.
        var runs = findAll(paragraphs[p], 't');
        var text = '';
        for (var r = 0; r < runs.length; r++) {
          text += (runs[r].textContent || '');
        }
        text = text.trim();
        if (!text) continue;
        if (isTitle && !out.title) {
          out.title = text;
        } else {
          out.paragraphs.push(text);
        }
      }
    }

    // Pictures — find every <p:pic> and resolve its image via slide rels.
    var pics = findAll(doc, 'pic');
    for (var k = 0; k < pics.length; k++) {
      var blip = findFirst(pics[k], 'blip');
      if (!blip) continue;
      // r:embed or r:link attribute. Prefer embed.
      var relId = blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
      if (!relId) {
        // Fallback: scan all attributes for one ending in "embed".
        var attrs = blip.attributes;
        for (var a = 0; a < attrs.length; a++) {
          if (/embed$/i.test(attrs[a].name)) { relId = attrs[a].value; break; }
        }
      }
      if (relId && slideRels[relId]) {
        out.imagePaths.push(slideRels[relId]);
      }
    }

    return out;
  }

  /* -----------------------------------------------------------------------
     Template heuristic — deterministic, in priority order.
     ----------------------------------------------------------------------- */
  function chooseTemplate(idx, extract) {
    var hasTitle = !!extract.title;
    var bodyCount = extract.paragraphs.length;
    var imgCount = extract.imagePaths.length;

    // First slide with a title and ≤1 body paragraph → title slide.
    if (idx === 0 && hasTitle && bodyCount <= 1) return 'title';

    // 3+ images on one slide → gallery.
    if (imgCount >= 3) return 'gallery';

    // Default: generic content slide.
    return 'generic';
  }

  /* -----------------------------------------------------------------------
     Build the final slide object for a given templateId.
     Always starts from SlideTemplates.getDefaults so new template fields
     added later don't break old imports.
     ----------------------------------------------------------------------- */
  function buildSlide(templateId, extract, resizedImages) {
    var data = window.SlideTemplates.getDefaults(templateId);

    if (templateId === 'title') {
      data.title = extract.title || extract.paragraphs[0] || 'Untitled';
      if (extract.paragraphs.length) data.subtitle = extract.paragraphs[0];
      if (resizedImages.length) data.backgroundImage = resizedImages[0].dataUrl;
    } else if (templateId === 'gallery') {
      data.heading = extract.title || 'Gallery';
      if (extract.paragraphs.length) data.subheading = extract.paragraphs[0];
      // First 3 images → image1/2/3. Caption fields stay empty; we don't
      // have a reliable signal for which paragraph captions which image.
      if (resizedImages[0]) data.image1 = resizedImages[0].dataUrl;
      if (resizedImages[1]) data.image2 = resizedImages[1].dataUrl;
      if (resizedImages[2]) data.image3 = resizedImages[2].dataUrl;
    } else {
      // generic
      data.heading = extract.title || (extract.paragraphs[0] || 'Slide');
      // If title is missing, the first paragraph became heading —
      // don't duplicate it in the list.
      var bodyParas = extract.title ? extract.paragraphs : extract.paragraphs.slice(1);
      // One long single-paragraph body → subheading; otherwise bullets.
      if (bodyParas.length === 1 && bodyParas[0].length >= 60) {
        data.subheading = bodyParas[0];
        data.items = [''];
      } else if (bodyParas.length) {
        data.items = bodyParas.slice(0, 8); // template caps at 8
      }
      if (resizedImages.length) data.image = resizedImages[0].dataUrl;
    }

    // Logo prefill — mirrors controller.js addSlide() behavior.
    if (data.hasOwnProperty('logo') && !data.logo) {
      data.logo = 'assets/Logo TRP_w.png';
    }
    // brandLine prefill for title slides.
    if (data.hasOwnProperty('brandLine') && !data.brandLine) {
      data.brandLine = 'Product Quality — Performance Driven — Innovation Forward';
    }

    return {
      id: uid(),
      templateId: templateId,
      theme: 'trp-dark',
      data: data
    };
  }

  /* -----------------------------------------------------------------------
     Given an image path and a role hint ("hero" / "logo" / "other"),
     pull bytes from the zip, build a data URL, run it through the resizer,
     and cache by path so the same image isn't re-encoded twice.
     ----------------------------------------------------------------------- */
  function loadImage(zip, path, role, cache) {
    if (cache[path]) return cache[path];
    var ext = (path.split('.').pop() || '').toLowerCase();
    var mime = EXT_TO_MIME[ext] || 'image/png';
    var budget = IMAGE_BUDGET[role] || IMAGE_BUDGET.hero;
    var promise = readBase64(zip, path).then(function (b64) {
      if (!b64) return null;
      var rawDataUrl = 'data:' + mime + ';base64,' + b64;
      return resizeImage(rawDataUrl, budget.w, budget.h).then(function (resized) {
        return { dataUrl: resized };
      });
    });
    cache[path] = promise;
    return promise;
  }

  /* -----------------------------------------------------------------------
     Main entry point.
     ----------------------------------------------------------------------- */
  function parse(arrayBuffer) {
    if (typeof window.JSZip === 'undefined') {
      return Promise.reject(new Error('JSZip library not loaded.'));
    }
    return window.JSZip.loadAsync(arrayBuffer).then(function (zip) {
      // 1. Deck title (nice-to-have for meta.title; falls back later).
      return readText(zip, 'docProps/core.xml').then(function (coreXml) {
        var deckTitle = 'Imported Presentation';
        if (coreXml) {
          try {
            var coreDoc = parseXml(coreXml);
            var titleNode = findFirst(coreDoc, 'title');
            if (titleNode && titleNode.textContent.trim()) {
              deckTitle = titleNode.textContent.trim();
            }
          } catch (e) { /* fall through to default */ }
        }

        // 2. Authoritative slide order from presentation.xml sldIdLst +
        //    presentation.xml.rels rId->Target mapping.
        return Promise.all([
          readText(zip, 'ppt/presentation.xml'),
          readText(zip, 'ppt/_rels/presentation.xml.rels')
        ]).then(function (results) {
          var presXml = results[0];
          var presRelsXml = results[1];
          if (!presXml || !presRelsXml) {
            throw new Error('Not a valid .pptx file (missing presentation.xml).');
          }
          var presRels = parseRels(presRelsXml, 'ppt/presentation.xml');
          var presDoc = parseXml(presXml);
          var sldIds = findAll(presDoc, 'sldId');
          var slidePaths = [];
          for (var i = 0; i < sldIds.length; i++) {
            // r:id attribute — again, may or may not have namespace prefix.
            var rId = sldIds[i].getAttribute('r:id') ||
                      sldIds[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
            if (!rId) {
              var attrs = sldIds[i].attributes;
              for (var a = 0; a < attrs.length; a++) {
                if (/(^|:)id$/i.test(attrs[a].name)) { rId = attrs[a].value; break; }
              }
            }
            if (rId && presRels[rId]) slidePaths.push(presRels[rId]);
          }
          if (!slidePaths.length) {
            throw new Error('No slides found in this presentation.');
          }

          // 3. Per-slide: load slide xml + its rels in parallel, extract
          //    the neutral representation.
          var perSlide = slidePaths.map(function (path) {
            var relsPath = path.replace(/([^\/]+)$/, '_rels/$1.rels');
            return Promise.all([
              readText(zip, path),
              readText(zip, relsPath)
            ]).then(function (pair) {
              var slideXml = pair[0];
              var slideRelsXml = pair[1];
              if (!slideXml) return null;
              var slideRels = parseRels(slideRelsXml, path);
              return extractSlide(slideXml, slideRels);
            });
          });

          return Promise.all(perSlide).then(function (extracts) {
            // Drop any that failed to read (returned null).
            extracts = extracts.filter(function (e) { return !!e; });

            // 4. Resolve all unique images through the resizer in parallel.
            var imageCache = {};
            var imageLoadPromises = [];
            extracts.forEach(function (ex, idx) {
              var tplId = chooseTemplate(idx, ex);
              ex._templateId = tplId; // stash for step 5
              // Role hint for resize budget: gallery/title/generic all use hero.
              ex.imagePaths.forEach(function (p) {
                imageLoadPromises.push(loadImage(zip, p, 'hero', imageCache));
              });
            });

            return Promise.all(imageLoadPromises).then(function () {
              // 5. Build final slides — each image path is now in imageCache.
              var slides = [];
              for (var i = 0; i < extracts.length; i++) {
                var ex = extracts[i];
                var resized = [];
                for (var j = 0; j < ex.imagePaths.length; j++) {
                  // imageCache entry is a promise that has already resolved;
                  // we need its resolved value — so await via .then chain.
                  // Simpler: track resolved values in a sync map.
                  resized.push(null); // placeholder; filled in next loop
                }
                slides.push({ _ex: ex, _resized: resized });
              }

              // Second pass: read resolved values from the cache.
              var pending = [];
              for (var s = 0; s < slides.length; s++) {
                (function (slideBox) {
                  slideBox._ex.imagePaths.forEach(function (path, pi) {
                    pending.push(imageCache[path].then(function (val) {
                      slideBox._resized[pi] = val; // may be null
                    }));
                  });
                })(slides[s]);
              }

              return Promise.all(pending).then(function () {
                var finalSlides = slides.map(function (box) {
                  var resized = box._resized.filter(function (v) { return v && v.dataUrl; });
                  return buildSlide(box._ex._templateId, box._ex, resized);
                });

                return {
                  slides: finalSlides,
                  theme: 'trp-dark',
                  meta: { title: deckTitle, updatedAt: null }
                };
              });
            });
          });
        });
      });
    });
  }

  window.PptxImporter = { parse: parse };
})();
