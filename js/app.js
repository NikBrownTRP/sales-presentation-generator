/* ==========================================================================
   Sales Presentation Generator — Main Application Controller
   State management, slide CRUD, form rendering, event binding
   ========================================================================== */
'use strict';

(function () {

  /* -----------------------------------------------------------------------
     Utility helpers
     ----------------------------------------------------------------------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function resizeImage(dataUrl, maxW, maxH, quality) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        if (ratio >= 1) { resolve(dataUrl); return; } // No resize needed
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        // Preserve PNG transparency; use JPEG only for non-transparent images
        var isPng = dataUrl.indexOf('data:image/png') === 0;
        resolve(isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', quality || 0.85));
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  /* -----------------------------------------------------------------------
     Application state
     ----------------------------------------------------------------------- */
  var state = {
    slides: [],
    activeSlideId: null,
    theme: 'trp-dark',
    meta: { title: 'Untitled Presentation', updatedAt: null }
  };

  /* -----------------------------------------------------------------------
     DOM references
     ----------------------------------------------------------------------- */
  var dom = {};

  function cacheDom() {
    dom.slideList = document.getElementById('slide-list');
    dom.editorForm = document.getElementById('editor-form');
    dom.editorEmpty = document.getElementById('editor-empty');
    dom.editorTemplateName = document.getElementById('editor-template-name');
    dom.previewSlide = document.getElementById('preview-slide');
    dom.previewScaler = document.getElementById('preview-scaler');
    dom.previewSlideInfo = document.getElementById('preview-slide-info');
    dom.previewPanel = document.getElementById('preview-panel');
    dom.themeSelect = document.getElementById('theme-select'); // may be null (per-slide themes)
    dom.modalAddSlide = document.getElementById('modal-add-slide');
    dom.templateGrid = document.getElementById('template-grid');
    dom.slideshowModal = document.getElementById('slideshow-modal');
    dom.slideshowStage = document.getElementById('slideshow-stage');
    dom.slideshowCounter = document.getElementById('slideshow-counter');
    dom.slideshowDots = document.getElementById('slideshow-dots');
    dom.modalExport = document.getElementById('modal-export');
    dom.exportProgressText = document.getElementById('export-progress-text');
    dom.exportProgressFill = document.getElementById('export-progress-fill');
    dom.fileInputLoad = document.getElementById('file-input-load');
    dom.fileInputImage = document.getElementById('file-input-image');
    dom.presTitle = document.getElementById('pres-title');
  }

  /* -----------------------------------------------------------------------
     Theme defaults
     ----------------------------------------------------------------------- */
  var DEFAULT_LOGOS = {
    'trp-dark':             'assets/Logo TRP_w.png',
    'tektro-light':         'assets/Logo Tektro.png',
    'trp-tektro-corporate': 'assets/Logo TRP Tektro Small.png'
  };
  var DEFAULT_BRANDLINES = {
    'trp-dark':             'Product Quality \u2014 Performance Driven \u2014 Innovation Forward',
    'tektro-light':         'Product Quality \u2014 Value Driven \u2014 Purpose Built',
    'trp-tektro-corporate': 'Performance \u2014 Quality \u2014 Integrity'
  };
  function defaultLogoForTheme(theme)      { return DEFAULT_LOGOS[theme]      || DEFAULT_LOGOS['trp-dark']; }
  function defaultBrandLineForTheme(theme) { return DEFAULT_BRANDLINES[theme] || DEFAULT_BRANDLINES['trp-dark']; }

  /* -----------------------------------------------------------------------
     Slide CRUD
     ----------------------------------------------------------------------- */
  function addSlide(templateId, theme) {
    var slide = {
      id: uid(),
      templateId: templateId,
      theme: theme || state.lastTheme || 'trp-dark',
      data: window.SlideTemplates.getDefaults(templateId)
    };
    // Prefill brand logo for templates that have a logo field
    if (slide.data.hasOwnProperty('logo') && !slide.data.logo) {
      slide.data.logo = defaultLogoForTheme(slide.theme);
    }
    // Prefill brand line for title slides
    if (slide.data.hasOwnProperty('brandLine') && !slide.data.brandLine) {
      slide.data.brandLine = defaultBrandLineForTheme(slide.theme);
    }
    state.lastTheme = slide.theme;
    // Insert after the currently active slide, or at the end
    var activeIdx = state.activeSlideId ? slideIndex(state.activeSlideId) : -1;
    if (activeIdx !== -1) {
      state.slides.splice(activeIdx + 1, 0, slide);
    } else {
      state.slides.push(slide);
    }
    selectSlide(slide.id);
    renderSidebar();
    autoSave();
  }

  function deleteSlide(slideId) {
    var idx = slideIndex(slideId);
    if (idx === -1) return;
    state.slides.splice(idx, 1);

    if (state.slides.length === 0) {
      state.activeSlideId = null;
    } else if (state.activeSlideId === slideId) {
      var newIdx = Math.min(idx, state.slides.length - 1);
      state.activeSlideId = state.slides[newIdx].id;
    }

    renderSidebar();
    renderEditor();
    updatePreview();
    autoSave();
  }

  function moveSlide(slideId, direction) {
    var idx = slideIndex(slideId);
    var target = idx + direction;
    if (target < 0 || target >= state.slides.length) return;
    var tmp = state.slides[idx];
    state.slides[idx] = state.slides[target];
    state.slides[target] = tmp;
    renderSidebar();
    autoSave();
  }

  function reorderSlide(slideId, newIndex) {
    var idx = slideIndex(slideId);
    if (idx === -1 || newIndex === idx) return;
    var slide = state.slides.splice(idx, 1)[0];
    state.slides.splice(newIndex, 0, slide);
    renderSidebar();
    autoSave();
  }

  function duplicateSlide(slideId) {
    var idx = slideIndex(slideId);
    if (idx === -1) return;
    var original = state.slides[idx];
    var copy = {
      id: uid(),
      templateId: original.templateId,
      theme: original.theme,
      hidden: false,
      data: JSON.parse(JSON.stringify(original.data))
    };
    state.slides.splice(idx + 1, 0, copy);
    selectSlide(copy.id);
    renderSidebar();
    autoSave();
  }

  function toggleHideSlide(slideId) {
    var slide = state.slides.find(function (s) { return s.id === slideId; });
    if (!slide) return;
    slide.hidden = !slide.hidden;
    renderSidebar();
    autoSave();
  }

  function selectSlide(slideId) {
    state.activeSlideId = slideId;
    renderSidebar();
    renderEditor();
    updatePreview();
  }

  function getActiveSlide() {
    if (!state.activeSlideId) return null;
    return state.slides.find(function (s) { return s.id === state.activeSlideId; }) || null;
  }

  function slideIndex(slideId) {
    for (var i = 0; i < state.slides.length; i++) {
      if (state.slides[i].id === slideId) return i;
    }
    return -1;
  }

  function updateSlideData(slideId, key, value) {
    var slide = state.slides.find(function (s) { return s.id === slideId; });
    if (!slide) return;
    slide.data[key] = value;
    if (slideId === state.activeSlideId) {
      debouncedPreviewUpdate();
    }
    debouncedAutoSave();
  }

  var debouncedPreviewUpdate = debounce(function () { updatePreview(); }, 120);
  var debouncedAutoSave = debounce(function () { autoSave(); }, 2000);
  var debouncedThumbnailUpdate = debounce(function () { updateActiveThumbnail(); }, 300);

  /* -----------------------------------------------------------------------
     Auto-save
     ----------------------------------------------------------------------- */
  function autoSave() {
    if (window.ExportManager) {
      window.ExportManager.saveToLocalStorage(state);
    }
  }

  /* -----------------------------------------------------------------------
     Render: Sidebar slide list
     ----------------------------------------------------------------------- */
  function renderSidebar() {
    var html = '';
    state.slides.forEach(function (slide, i) {
      var template = window.SlideTemplates[slide.templateId];
      var isActive = slide.id === state.activeSlideId;
      var title = template ? template.getTitle(slide.data) : 'Slide';

      var isHidden = slide.hidden === true;
      html += '<li class="slide-item' + (isActive ? ' slide-item--active' : '') + (isHidden ? ' slide-item--hidden' : '') + '" data-slide-id="' + slide.id + '" draggable="true">';

      // Drag handle
      html += '<span class="slide-item__drag-handle" title="Drag to reorder">';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>';
      html += '</span>';

      // Thumbnail
      html += '<div class="slide-item__thumbnail" id="thumb-' + slide.id + '">';
      html += '<div class="slide-item__thumbnail-inner" data-theme="' + (slide.theme || state.theme) + '">';
      if (template) {
        html += template.render(slide.data);
      }
      html += '</div></div>';

      // Info
      html += '<div class="slide-item__info">';
      html += '<div class="slide-item__number">Slide ' + (i + 1) + '</div>';
      html += '<div class="slide-item__name">' + window.escapeHtml(title) + '</div>';
      html += '</div>';

      // Actions
      html += '<div class="slide-item__actions">';
      html += '<button class="slide-item__action" data-action="move-up" data-slide-id="' + slide.id + '" title="Move up"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18,15 12,9 6,15"/></svg></button>';
      html += '<button class="slide-item__action" data-action="move-down" data-slide-id="' + slide.id + '" title="Move down"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg></button>';
      html += '<button class="slide-item__action" data-action="duplicate" data-slide-id="' + slide.id + '" title="Duplicate slide"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg></button>';
      html += '<button class="slide-item__action' + (isHidden ? ' slide-item__action--active' : '') + '" data-action="toggle-hide" data-slide-id="' + slide.id + '" title="' + (isHidden ? 'Show slide' : 'Hide slide') + '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + (isHidden ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/>' : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>') + '</svg></button>';
      html += '<button class="slide-item__action slide-item__action--delete" data-action="delete" data-slide-id="' + slide.id + '" title="Delete slide"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/></svg></button>';
      html += '</div>';

      html += '</li>';
    });

    dom.slideList.innerHTML = html;
    setupSidebarEvents();
  }

  function updateActiveThumbnail() {
    var slide = getActiveSlide();
    if (!slide) return;
    var thumbInner = document.querySelector('#thumb-' + slide.id + ' .slide-item__thumbnail-inner');
    if (!thumbInner) return;
    var template = window.SlideTemplates[slide.templateId];
    if (template) {
      thumbInner.innerHTML = template.render(slide.data);
    }
  }

  function setupSidebarEvents() {
    // Click to select
    var items = dom.slideList.querySelectorAll('.slide-item');
    items.forEach(function (item) {
      item.addEventListener('click', function (e) {
        if (e.target.closest('[data-action]')) return;
        selectSlide(item.dataset.slideId);
      });
    });

    // Action buttons
    var actions = dom.slideList.querySelectorAll('[data-action]');
    actions.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var slideId = btn.dataset.slideId;
        var action = btn.dataset.action;
        if (action === 'move-up') moveSlide(slideId, -1);
        else if (action === 'move-down') moveSlide(slideId, 1);
        else if (action === 'duplicate') duplicateSlide(slideId);
        else if (action === 'toggle-hide') toggleHideSlide(slideId);
        else if (action === 'delete') {
          Dialog.confirm('Delete Slide', 'Are you sure you want to delete this slide? This cannot be undone.', { confirmLabel: 'Delete', confirmStyle: 'danger', icon: 'warning' }).then(function(ok) { if (ok) deleteSlide(slideId); });
        }
      });
    });

    // Drag and drop
    setupDragDrop();
  }

  /* -----------------------------------------------------------------------
     Drag and Drop reordering
     ----------------------------------------------------------------------- */
  function setupDragDrop() {
    var items = dom.slideList.querySelectorAll('.slide-item');
    var draggedId = null;

    items.forEach(function (item) {
      item.addEventListener('dragstart', function (e) {
        draggedId = item.dataset.slideId;
        item.classList.add('slide-item--dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedId);
      });

      item.addEventListener('dragend', function () {
        item.classList.remove('slide-item--dragging');
        clearDragOverClasses();
        draggedId = null;
      });

      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        clearDragOverClasses();
        item.classList.add('slide-item--drag-over');
      });

      item.addEventListener('dragleave', function () {
        item.classList.remove('slide-item--drag-over');
      });

      item.addEventListener('drop', function (e) {
        e.preventDefault();
        clearDragOverClasses();
        if (!draggedId || draggedId === item.dataset.slideId) return;
        var targetIdx = slideIndex(item.dataset.slideId);
        reorderSlide(draggedId, targetIdx);
        draggedId = null;
      });
    });

    function clearDragOverClasses() {
      dom.slideList.querySelectorAll('.slide-item--drag-over').forEach(function (el) {
        el.classList.remove('slide-item--drag-over');
      });
    }
  }

  /* -----------------------------------------------------------------------
     Render: Editor form
     ----------------------------------------------------------------------- */
  function renderEditor() {
    var slide = getActiveSlide();

    if (!slide) {
      dom.editorForm.innerHTML = '';
      dom.editorForm.appendChild(dom.editorEmpty);
      dom.editorEmpty.style.display = '';
      dom.editorTemplateName.textContent = '';
      dom.previewSlideInfo.textContent = '';
      return;
    }

    dom.editorEmpty.style.display = 'none';

    var template = window.SlideTemplates[slide.templateId];
    if (!template) return;

    var idx = slideIndex(slide.id);
    dom.editorTemplateName.textContent = template.name;
    dom.previewSlideInfo.textContent = 'Slide ' + (idx + 1) + ' of ' + state.slides.length;

    var slideTheme = slide.theme || 'trp-dark';
    var html = '<div class="form-group form-group--theme">';
    html += '<label class="form-label">Slide Theme</label>';
    html += '<div class="form-theme-toggle">';
    html += '<button class="form-theme-btn' + (slideTheme === 'trp-dark' ? ' form-theme-btn--active' : '') + '" data-set-theme="trp-dark">TRP Racing</button>';
    html += '<button class="form-theme-btn' + (slideTheme === 'tektro-light' ? ' form-theme-btn--active' : '') + '" data-set-theme="tektro-light">Tektro</button>';
    html += '</div></div>';

    template.fields.forEach(function (field) {
      html += renderField(field, slide);
    });

    dom.editorForm.innerHTML = html;

    // Theme toggle events
    dom.editorForm.querySelectorAll('[data-set-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var oldTheme = slide.theme;
        slide.theme = btn.dataset.setTheme;
        // Swap brand logo if it's still the default
        if (slide.data.hasOwnProperty('logo')) {
          var oldLogo = oldTheme === 'tektro-light' ? 'assets/Logo Tektro.png' : 'assets/Logo TRP_w.png';
          if (!slide.data.logo || slide.data.logo === oldLogo) {
            slide.data.logo = slide.theme === 'tektro-light' ? 'assets/Logo Tektro.png' : 'assets/Logo TRP_w.png';
          }
        }
        // Swap brand line if it's still the default
        if (slide.data.hasOwnProperty('brandLine')) {
          var oldBrand = oldTheme === 'tektro-light' ? 'Product Quality \u2014 Value Driven \u2014 Purpose Built' : 'Product Quality \u2014 Performance Driven \u2014 Innovation Forward';
          if (!slide.data.brandLine || slide.data.brandLine === oldBrand) {
            slide.data.brandLine = slide.theme === 'tektro-light' ? 'Product Quality \u2014 Value Driven \u2014 Purpose Built' : 'Product Quality \u2014 Performance Driven \u2014 Innovation Forward';
          }
        }
        renderEditor();
        renderSidebar();
        updatePreview();
        autoSave();
      });
    });

    setupEditorEvents(slide);
  }

  function renderField(field, slide) {
    var value = slide.data[field.key];
    var html = '<div class="form-group" data-field-key="' + field.key + '">';

    // Label
    var labelClass = 'form-label' + (field.required ? ' form-label--required' : '');
    html += '<label class="' + labelClass + '">' + field.label + '</label>';

    switch (field.type) {
      case 'text':
        html += '<input type="text" class="form-input" data-key="' + field.key + '" value="' + escAttr(value || '') + '" placeholder="' + escAttr(field.placeholder || '') + '">';
        break;

      case 'textarea':
        html += '<textarea class="form-textarea" data-key="' + field.key + '" placeholder="' + escAttr(field.placeholder || '') + '" rows="3">' + window.escapeHtml(value || '') + '</textarea>';
        break;

      case 'select':
        html += '<select class="form-select" data-key="' + field.key + '">';
        (field.options || []).forEach(function (opt) {
          var sel = (value || field.defaultValue) === opt.value ? ' selected' : '';
          html += '<option value="' + opt.value + '"' + sel + '>' + opt.label + '</option>';
        });
        html += '</select>';
        break;

      case 'image':
        html += renderImageField(field, value);
        break;

      case 'list':
        html += renderListField(field, value, slide);
        break;

      case 'keyvalue':
        html += renderKeyValueField(field, value, slide);
        break;

      case 'chartdata':
        html += '<textarea class="form-textarea form-textarea--mono" data-key="' + field.key + '" placeholder="' + escAttr(field.placeholder || '') + '" rows="6">' + window.escapeHtml(value || '') + '</textarea>';
        html += '<div class="form-hint">Enter one data point per line as <strong>label,value</strong> (e.g., Q1,120). For XY plots, labels are X-values.</div>';
        break;
    }

    html += '</div>';
    return html;
  }

  function renderImageField(field, value) {
    var html = '<div class="form-image-upload" data-key="' + field.key + '">';
    if (value) {
      html += '<div class="form-image-upload__preview">';
      html += '<img src="' + value + '" alt="">';
      html += '<div class="form-image-upload__edit-overlay">';
      html += '<button type="button" class="form-image-upload__edit-btn" data-edit-key="' + field.key + '">Edit</button>';
      html += '<button type="button" class="form-image-upload__edit-btn" data-replace-key="' + field.key + '">Replace</button>';
      html += '</div>';
      html += '<button type="button" class="form-image-upload__remove" data-key="' + field.key + '" title="Remove image">&times;</button>';
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

  function renderListField(field, items, slide) {
    items = items || [''];
    var html = '<div class="form-list" data-key="' + field.key + '">';

    items.forEach(function (item, i) {
      html += '<div class="form-list__item">';
      html += '<input type="text" class="form-input" data-list-key="' + field.key + '" data-list-index="' + i + '" value="' + escAttr(item || '') + '" placeholder="' + escAttr(field.placeholder || '') + '">';
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

  function renderKeyValueField(field, items, slide) {
    items = items || [{ key: '', value: '' }];
    var html = '<div class="form-spectable" data-key="' + field.key + '">';

    items.forEach(function (item, i) {
      html += '<div class="form-spectable__row">';
      html += '<input type="text" class="form-input" data-kv-key="' + field.key + '" data-kv-index="' + i + '" data-kv-part="key" value="' + escAttr(item.key || '') + '" placeholder="' + escAttr(field.keyPlaceholder || 'Name') + '">';
      html += '<input type="text" class="form-input" data-kv-key="' + field.key + '" data-kv-index="' + i + '" data-kv-part="value" value="' + escAttr(item.value || '') + '" placeholder="' + escAttr(field.valuePlaceholder || 'Value') + '">';
      html += '<button type="button" class="form-list__remove" data-kv-remove="' + field.key + '" data-kv-index="' + i + '" title="Remove">';
      html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      html += '</button>';
      html += '</div>';
    });

    html += '<button type="button" class="form-list__add" data-kv-add="' + field.key + '">';
    html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add row';
    html += '</button>';

    html += '</div>';
    return html;
  }

  function escAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* -----------------------------------------------------------------------
     Editor event bindings
     ----------------------------------------------------------------------- */
  function setupEditorEvents(slide) {
    // Text inputs and selects
    dom.editorForm.querySelectorAll('.form-input[data-key], .form-textarea[data-key], .form-select[data-key]').forEach(function (el) {
      el.addEventListener('input', function () {
        updateSlideData(slide.id, el.dataset.key, el.value);
        debouncedThumbnailUpdate();
      });
    });

    // Image uploads
    dom.editorForm.querySelectorAll('.form-image-upload').forEach(function (zone) {
      var fieldKey = zone.dataset.key;

      zone.addEventListener('click', function (e) {
        if (e.target.closest('.form-image-upload__remove')) return;
        if (e.target.closest('[data-edit-key]')) return; // handled separately
        if (e.target.closest('[data-replace-key]')) return; // handled separately
        if (e.target.closest('.form-image-upload__edit-overlay')) return;
        if (e.target.closest('.form-image-upload__preview')) return; // don't open file picker on preview click
        triggerImageUpload(slide.id, fieldKey);
      });

      // Drag and drop
      zone.addEventListener('dragover', function (e) {
        e.preventDefault();
        zone.classList.add('form-image-upload--drag-over');
      });
      zone.addEventListener('dragleave', function () {
        zone.classList.remove('form-image-upload--drag-over');
      });
      zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('form-image-upload--drag-over');
        if (e.dataTransfer.files.length) {
          handleImageFile(e.dataTransfer.files[0], slide.id, fieldKey);
        }
      });
    });

    // Image remove buttons
    dom.editorForm.querySelectorAll('.form-image-upload__remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        updateSlideData(slide.id, btn.dataset.key, '');
        renderEditor();
        debouncedThumbnailUpdate();
      });
    });

    // Image edit buttons (open crop/rotate editor)
    dom.editorForm.querySelectorAll('[data-edit-key]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openImageEditor(slide.id, btn.dataset.editKey);
      });
    });

    // Image replace buttons (open file picker for new image)
    dom.editorForm.querySelectorAll('[data-replace-key]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        triggerImageUpload(slide.id, btn.dataset.replaceKey);
      });
    });

    // List inputs
    dom.editorForm.querySelectorAll('[data-list-key]').forEach(function (el) {
      el.addEventListener('input', function () {
        var items = slide.data[el.dataset.listKey] || [];
        items[parseInt(el.dataset.listIndex, 10)] = el.value;
        updateSlideData(slide.id, el.dataset.listKey, items);
        debouncedThumbnailUpdate();
      });
    });

    // List add
    dom.editorForm.querySelectorAll('[data-list-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.listAdd;
        var items = slide.data[key] || [];
        items.push('');
        updateSlideData(slide.id, key, items);
        renderEditor();
      });
    });

    // List remove
    dom.editorForm.querySelectorAll('[data-list-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.listRemove;
        var idx = parseInt(btn.dataset.listIndex, 10);
        var items = slide.data[key] || [];
        items.splice(idx, 1);
        if (items.length === 0) items.push('');
        updateSlideData(slide.id, key, items);
        renderEditor();
      });
    });

    // Key-value inputs
    dom.editorForm.querySelectorAll('[data-kv-key]').forEach(function (el) {
      el.addEventListener('input', function () {
        var fieldKey = el.dataset.kvKey;
        var idx = parseInt(el.dataset.kvIndex, 10);
        var part = el.dataset.kvPart;
        var items = slide.data[fieldKey] || [];
        if (!items[idx]) items[idx] = { key: '', value: '' };
        items[idx][part] = el.value;
        updateSlideData(slide.id, fieldKey, items);
        debouncedThumbnailUpdate();
      });
    });

    // Key-value add
    dom.editorForm.querySelectorAll('[data-kv-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.kvAdd;
        var items = slide.data[key] || [];
        items.push({ key: '', value: '' });
        updateSlideData(slide.id, key, items);
        renderEditor();
      });
    });

    // Key-value remove
    dom.editorForm.querySelectorAll('[data-kv-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.kvRemove;
        var idx = parseInt(btn.dataset.kvIndex, 10);
        var items = slide.data[key] || [];
        items.splice(idx, 1);
        if (items.length === 0) items.push({ key: '', value: '' });
        updateSlideData(slide.id, key, items);
        renderEditor();
      });
    });
  }

  /* -----------------------------------------------------------------------
     Image upload handling
     ----------------------------------------------------------------------- */
  var pendingImageSlideId = null;
  var pendingImageFieldKey = null;

  function triggerImageUpload(slideId, fieldKey) {
    pendingImageSlideId = slideId;
    pendingImageFieldKey = fieldKey;
    dom.fileInputImage.value = '';
    dom.fileInputImage.click();
  }

  function handleImageFile(file, slideId, fieldKey) {
    if (!file || !file.type.startsWith('image/')) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      // Determine max dimensions based on field usage
      var maxW = 1920, maxH = 1080;
      if (fieldKey === 'logo') { maxW = 400; maxH = 200; }
      else if (fieldKey === 'productImage' || fieldKey === 'image') { maxW = 1200; maxH = 900; }

      resizeImage(e.target.result, maxW, maxH, 0.85).then(function (resized) {
        updateSlideData(slideId, fieldKey, resized);
        renderEditor();
        debouncedThumbnailUpdate();
      });
    };
    reader.readAsDataURL(file);
  }

  /* -----------------------------------------------------------------------
     Image Editor (Crop & Rotate)
     ----------------------------------------------------------------------- */
  var imgEditor = {
    slideId: null,
    fieldKey: null,
    originalSrc: '',
    img: null,
    rotation: 0,        // 0, 90, 180, 270
    ratio: 'free',      // free, 16:9, 4:3, 1:1
    crop: null,          // { x, y, w, h } in image-space coordinates
    dragging: false,
    dragStart: null,
    canvas: null,
    ctx: null,
    scale: 1,            // display scale (image pixels → canvas pixels)
    offsetX: 0,
    offsetY: 0,
    displayW: 0,
    displayH: 0
  };

  function openImageEditor(slideId, fieldKey) {
    var slide = state.slides.find(function (s) { return s.id === slideId; });
    if (!slide || !slide.data[fieldKey]) return;

    imgEditor.slideId = slideId;
    imgEditor.fieldKey = fieldKey;
    imgEditor.originalSrc = slide.data[fieldKey];
    imgEditor.rotation = 0;
    imgEditor.ratio = 'free';
    imgEditor.crop = null;
    imgEditor.dragging = false;

    var modal = document.getElementById('modal-image-edit');
    imgEditor.canvas = document.getElementById('image-editor-canvas');
    imgEditor.ctx = imgEditor.canvas.getContext('2d');

    // Load the image
    imgEditor.img = new Image();
    imgEditor.img.onload = function () {
      setupEditorCanvas();
      drawEditorCanvas();
      openModal(modal);
      bindImageEditorEvents();
    };
    imgEditor.img.src = imgEditor.originalSrc;

    // Set active ratio button
    document.querySelectorAll('.image-editor__ratio-btn').forEach(function (b) {
      b.classList.toggle('image-editor__ratio-btn--active', b.dataset.ratio === 'free');
    });
  }

  function getRotatedDimensions() {
    var w = imgEditor.img.naturalWidth;
    var h = imgEditor.img.naturalHeight;
    if (imgEditor.rotation === 90 || imgEditor.rotation === 270) {
      return { w: h, h: w };
    }
    return { w: w, h: h };
  }

  function setupEditorCanvas() {
    var area = imgEditor.canvas.parentElement;
    var areaW = area.clientWidth - 20;
    var areaH = area.clientHeight - 20;

    var dims = getRotatedDimensions();
    var scale = Math.min(areaW / dims.w, areaH / dims.h, 1);
    imgEditor.scale = scale;
    imgEditor.displayW = Math.round(dims.w * scale);
    imgEditor.displayH = Math.round(dims.h * scale);

    imgEditor.canvas.width = imgEditor.displayW;
    imgEditor.canvas.height = imgEditor.displayH;

    imgEditor.offsetX = 0;
    imgEditor.offsetY = 0;

    // Reset crop to full image
    imgEditor.crop = { x: 0, y: 0, w: dims.w, h: dims.h };
  }

  function drawEditorCanvas() {
    var ctx = imgEditor.ctx;
    var canvas = imgEditor.canvas;
    var img = imgEditor.img;
    var dims = getRotatedDimensions();
    var s = imgEditor.scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw rotated image
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(imgEditor.rotation * Math.PI / 180);

    var drawW, drawH;
    if (imgEditor.rotation === 90 || imgEditor.rotation === 270) {
      drawW = imgEditor.displayH;
      drawH = imgEditor.displayW;
    } else {
      drawW = imgEditor.displayW;
      drawH = imgEditor.displayH;
    }
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Draw crop overlay (darken outside crop area)
    if (imgEditor.crop) {
      var cx = imgEditor.crop.x * s;
      var cy = imgEditor.crop.y * s;
      var cw = imgEditor.crop.w * s;
      var ch = imgEditor.crop.h * s;

      // Only draw overlay if crop differs from full image
      if (Math.round(cw) < canvas.width - 2 || Math.round(ch) < canvas.height - 2) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        // Top
        ctx.fillRect(0, 0, canvas.width, cy);
        // Bottom
        ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch);
        // Left
        ctx.fillRect(0, cy, cx, ch);
        // Right
        ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch);

        // Crop border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx, cy, cw, ch);

        // Rule of thirds lines
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 0.5;
        for (var i = 1; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + (cw * i / 3), cy);
          ctx.lineTo(cx + (cw * i / 3), cy + ch);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx, cy + (ch * i / 3));
          ctx.lineTo(cx + cw, cy + (ch * i / 3));
          ctx.stroke();
        }

        // Corner handles
        var hs = 8;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        // Top-left
        ctx.beginPath(); ctx.moveTo(cx, cy + hs); ctx.lineTo(cx, cy); ctx.lineTo(cx + hs, cy); ctx.stroke();
        // Top-right
        ctx.beginPath(); ctx.moveTo(cx + cw - hs, cy); ctx.lineTo(cx + cw, cy); ctx.lineTo(cx + cw, cy + hs); ctx.stroke();
        // Bottom-left
        ctx.beginPath(); ctx.moveTo(cx, cy + ch - hs); ctx.lineTo(cx, cy + ch); ctx.lineTo(cx + hs, cy + ch); ctx.stroke();
        // Bottom-right
        ctx.beginPath(); ctx.moveTo(cx + cw - hs, cy + ch); ctx.lineTo(cx + cw, cy + ch); ctx.lineTo(cx + cw, cy + ch - hs); ctx.stroke();
      }
    }
  }

  function constrainCropToRatio(startX, startY, endX, endY) {
    var x = Math.min(startX, endX);
    var y = Math.min(startY, endY);
    var w = Math.abs(endX - startX);
    var h = Math.abs(endY - startY);

    if (imgEditor.ratio !== 'free') {
      var parts = imgEditor.ratio.split(':');
      var ratioW = parseInt(parts[0]);
      var ratioH = parseInt(parts[1]);
      var targetRatio = ratioW / ratioH;

      if (w / h > targetRatio) {
        w = h * targetRatio;
      } else {
        h = w / targetRatio;
      }
    }

    // Clamp to image bounds
    var dims = getRotatedDimensions();
    x = Math.max(0, Math.min(x, dims.w - w));
    y = Math.max(0, Math.min(y, dims.h - h));
    w = Math.min(w, dims.w - x);
    h = Math.min(h, dims.h - y);

    return { x: x, y: y, w: w, h: h };
  }

  function canvasToImageCoords(canvasX, canvasY) {
    return {
      x: canvasX / imgEditor.scale,
      y: canvasY / imgEditor.scale
    };
  }

  function bindImageEditorEvents() {
    var canvas = imgEditor.canvas;

    // Remove old listeners by replacing canvas
    var newCanvas = canvas.cloneNode(false);
    canvas.parentNode.replaceChild(newCanvas, canvas);
    imgEditor.canvas = newCanvas;
    imgEditor.ctx = newCanvas.getContext('2d');
    drawEditorCanvas();

    newCanvas.addEventListener('mousedown', function (e) {
      var rect = newCanvas.getBoundingClientRect();
      var coords = canvasToImageCoords(e.clientX - rect.left, e.clientY - rect.top);
      imgEditor.dragging = true;
      imgEditor.dragStart = coords;
    });

    newCanvas.addEventListener('mousemove', function (e) {
      if (!imgEditor.dragging) return;
      var rect = newCanvas.getBoundingClientRect();
      var coords = canvasToImageCoords(e.clientX - rect.left, e.clientY - rect.top);
      imgEditor.crop = constrainCropToRatio(imgEditor.dragStart.x, imgEditor.dragStart.y, coords.x, coords.y);
      drawEditorCanvas();
    });

    newCanvas.addEventListener('mouseup', function () {
      imgEditor.dragging = false;
      // If crop is too small, reset to full
      if (imgEditor.crop && (imgEditor.crop.w < 10 || imgEditor.crop.h < 10)) {
        var dims = getRotatedDimensions();
        imgEditor.crop = { x: 0, y: 0, w: dims.w, h: dims.h };
        drawEditorCanvas();
      }
    });

    newCanvas.addEventListener('mouseleave', function () {
      if (imgEditor.dragging) {
        imgEditor.dragging = false;
      }
    });

    // Rotate buttons
    document.getElementById('img-rotate-left').onclick = function () {
      imgEditor.rotation = (imgEditor.rotation + 270) % 360;
      setupEditorCanvas();
      drawEditorCanvas();
    };
    document.getElementById('img-rotate-right').onclick = function () {
      imgEditor.rotation = (imgEditor.rotation + 90) % 360;
      setupEditorCanvas();
      drawEditorCanvas();
    };

    // Ratio buttons
    document.querySelectorAll('.image-editor__ratio-btn').forEach(function (btn) {
      btn.onclick = function () {
        imgEditor.ratio = btn.dataset.ratio;
        document.querySelectorAll('.image-editor__ratio-btn').forEach(function (b) {
          b.classList.toggle('image-editor__ratio-btn--active', b.dataset.ratio === imgEditor.ratio);
        });
        // Reset crop
        var dims = getRotatedDimensions();
        imgEditor.crop = { x: 0, y: 0, w: dims.w, h: dims.h };
        drawEditorCanvas();
      };
    });

    // Reset
    document.getElementById('img-reset').onclick = function () {
      imgEditor.rotation = 0;
      imgEditor.ratio = 'free';
      document.querySelectorAll('.image-editor__ratio-btn').forEach(function (b) {
        b.classList.toggle('image-editor__ratio-btn--active', b.dataset.ratio === 'free');
      });
      setupEditorCanvas();
      drawEditorCanvas();
    };

    // Cancel
    document.getElementById('img-cancel').onclick = function () {
      closeModal(document.getElementById('modal-image-edit'));
    };

    // Apply
    document.getElementById('img-apply').onclick = function () {
      applyImageEdit();
    };
  }

  function applyImageEdit() {
    var img = imgEditor.img;
    var crop = imgEditor.crop;
    var rotation = imgEditor.rotation;
    var dims = getRotatedDimensions();

    // If no changes, just close
    if (rotation === 0 && crop.x === 0 && crop.y === 0 && Math.abs(crop.w - dims.w) < 2 && Math.abs(crop.h - dims.h) < 2) {
      closeModal(document.getElementById('modal-image-edit'));
      return;
    }

    // Create output canvas at crop dimensions
    var outW = Math.round(crop.w);
    var outH = Math.round(crop.h);
    var out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    var outCtx = out.getContext('2d');

    // Draw rotated image, offset by crop position
    outCtx.save();
    outCtx.translate(outW / 2, outH / 2);

    // We need to figure out where the crop maps to in the original (unrotated) image
    // The crop coordinates are in rotated-image space
    // We need to reverse-transform them to original image space
    var origW = img.naturalWidth;
    var origH = img.naturalHeight;

    outCtx.rotate(rotation * Math.PI / 180);

    var sx, sy;
    if (rotation === 0) {
      sx = -crop.x - crop.w / 2;
      sy = -crop.y - crop.h / 2;
      outCtx.drawImage(img, sx, sy);
    } else if (rotation === 90) {
      sx = crop.y - origH / 2 + crop.h / 2;
      sy = -crop.x - crop.w / 2;
      outCtx.drawImage(img, sx, sy);
    } else if (rotation === 180) {
      sx = crop.x - origW / 2 + crop.w / 2;
      sy = crop.y - origH / 2 + crop.h / 2;
      outCtx.drawImage(img, -sx - origW, -sy - origH);
    } else if (rotation === 270) {
      sx = -crop.y - crop.h / 2;
      sy = crop.x - origW / 2 + crop.w / 2;
      outCtx.drawImage(img, sx, sy);
    }

    outCtx.restore();

    // Export as PNG if original was PNG, else JPEG
    var isPng = imgEditor.originalSrc.indexOf('data:image/png') === 0;
    var dataUrl = isPng ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', 0.92);

    // Save to slide data
    updateSlideData(imgEditor.slideId, imgEditor.fieldKey, dataUrl);
    renderEditor();
    debouncedThumbnailUpdate();
    closeModal(document.getElementById('modal-image-edit'));
  }

  /* -----------------------------------------------------------------------
     Preview
     ----------------------------------------------------------------------- */
  function updatePreview() {
    var slide = getActiveSlide();
    if (!slide) {
      dom.previewSlide.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#444;font-size:14px;">No slide selected</div>';
      return;
    }

    if (window.PreviewRenderer) {
      window.PreviewRenderer.renderLivePreview(slide, slide.theme || state.theme, dom.previewSlide, dom.previewScaler, dom.previewPanel);
    }
  }

  function scalePreview() {
    if (window.PreviewRenderer) {
      window.PreviewRenderer.calculateScale(dom.previewScaler, dom.previewPanel);
    }
  }

  /* -----------------------------------------------------------------------
     Modal: Template picker
     ----------------------------------------------------------------------- */
  var modalTheme = 'trp-dark';

  function openTemplateModal() {
    modalTheme = state.lastTheme || 'trp-dark';
    renderTemplateGrid();
    openModal(dom.modalAddSlide);
  }

  function renderTemplateGrid() {
    var templates = window.SlideTemplates.getOrderedList();

    // Theme picker
    var html = '<div class="template-theme-picker">';
    html += '<button class="template-theme-btn' + (modalTheme === 'trp-dark' ? ' template-theme-btn--active' : '') + '" data-pick-theme="trp-dark">TRP Racing</button>';
    html += '<button class="template-theme-btn' + (modalTheme === 'tektro-light' ? ' template-theme-btn--active' : '') + '" data-pick-theme="tektro-light">Tektro</button>';
    html += '</div>';

    // Template cards with live previews
    html += '<div class="template-grid__cards">';
    templates.forEach(function (t) {
      var previewData = window.SlideTemplates.getDefaults(t.id);
      var previewHtml = t.render(previewData);
      html += '<div class="template-card" data-template-id="' + t.id + '">';
      html += '<div class="template-card__preview" data-theme="' + modalTheme + '">';
      html += '<div class="template-card__preview-inner">' + previewHtml + '</div>';
      html += '</div>';
      html += '<div class="template-card__name">' + t.name + '</div>';
      html += '<div class="template-card__desc">' + t.description + '</div>';
      html += '</div>';
    });
    html += '</div>';

    dom.templateGrid.innerHTML = html;

    // Scale previews to fit cards after layout settles
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        dom.templateGrid.querySelectorAll('.template-card__preview').forEach(function (preview) {
          var inner = preview.querySelector('.template-card__preview-inner');
          if (inner) {
            var scale = preview.offsetWidth / 960;
            inner.style.transform = 'scale(' + scale + ')';
          }
        });
      });
    });

    // Theme picker clicks
    dom.templateGrid.querySelectorAll('[data-pick-theme]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modalTheme = btn.dataset.pickTheme;
        renderTemplateGrid();
      });
    });

    // Template card clicks
    dom.templateGrid.querySelectorAll('.template-card').forEach(function (card) {
      card.addEventListener('click', function () {
        addSlide(card.dataset.templateId, modalTheme);
        closeModal(dom.modalAddSlide);
      });
    });
  }

  /* -----------------------------------------------------------------------
     Modal helpers
     ----------------------------------------------------------------------- */
  function openModal(modal) {
    modal.classList.add('modal--visible', 'slideshow-modal--visible');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(modal) {
    modal.classList.remove('modal--visible', 'slideshow-modal--visible');
    modal.setAttribute('aria-hidden', 'true');
  }

  /* -----------------------------------------------------------------------
     Slideshow
     ----------------------------------------------------------------------- */
  var slideshowIndex = 0;

  function openSlideshow() {
    var visibleSlides = state.slides.filter(function (s) { return !s.hidden; });
    if (visibleSlides.length === 0) return;
    slideshowIndex = 0;

    if (window.PreviewRenderer) {
      window.PreviewRenderer.openSlideshow(visibleSlides, state.theme);
    }
  }

  /* -----------------------------------------------------------------------
     Load state
     ----------------------------------------------------------------------- */
  function loadState(newState) {
    state.slides = newState.slides || [];
    state.theme = newState.theme || 'trp-dark';
    state.meta = newState.meta || { title: 'Untitled Presentation', updatedAt: null };
    state.activeSlideId = state.slides.length > 0 ? state.slides[0].id : null;

    // Backward compatibility: add per-slide theme if missing
    state.slides.forEach(function (slide) {
      if (!slide.theme) slide.theme = state.theme || 'trp-dark';
    });

    if (dom.themeSelect) dom.themeSelect.value = state.theme;
    if (dom.presTitle) {
      dom.presTitle.value = state.meta.title || 'Untitled Presentation';
    }
    renderSidebar();
    renderEditor();
    updatePreview();
  }

  /* -----------------------------------------------------------------------
     Init + event binding
     ----------------------------------------------------------------------- */
  function init() {
    cacheDom();

    // Try loading from localStorage
    var saved = null;
    if (window.ExportManager) {
      saved = window.ExportManager.loadFromLocalStorage();
    }

    if (saved && saved.slides && saved.slides.length > 0) {
      loadState(saved);
    } else {
      // Start with one title slide
      addSlide('title');
    }

    // --- Presentation title ---
    dom.presTitle.value = state.meta.title || 'Untitled Presentation';
    dom.presTitle.addEventListener('input', function () {
      state.meta.title = dom.presTitle.value || 'Untitled Presentation';
      debouncedAutoSave();
    });
    dom.presTitle.addEventListener('blur', function () {
      if (!dom.presTitle.value.trim()) {
        dom.presTitle.value = 'Untitled Presentation';
        state.meta.title = 'Untitled Presentation';
      }
    });

    // --- New presentation ---
    document.getElementById('btn-new').addEventListener('click', function () {
      if (state.slides.length > 0) {
        Dialog.confirm('New Presentation', 'Your current presentation will be cleared completely.\n\nTo edit it later, save it first as a .json file using the Save button, then load it back in with the Load button.', { confirmLabel: 'Start New', confirmStyle: 'danger', icon: 'warning' }).then(function(ok) {
          if (!ok) return;
          state.slides = [];
          state.activeSlideId = null;
          state.theme = 'trp-dark';
          state.meta = { title: 'Untitled Presentation', updatedAt: null };
          if (dom.themeSelect) dom.themeSelect.value = state.theme;
          dom.presTitle.value = '';
          dom.presTitle.focus();
          dom.presTitle.select();
          renderSidebar();
          renderEditor();
          updatePreview();
          autoSave();
        });
        return;
      }
      state.slides = [];
      state.activeSlideId = null;
      state.theme = 'trp-dark';
      state.meta = { title: 'Untitled Presentation', updatedAt: null };
      if (dom.themeSelect) dom.themeSelect.value = state.theme;
      dom.presTitle.value = '';
      dom.presTitle.focus();
      dom.presTitle.select();
      renderSidebar();
      renderEditor();
      updatePreview();
      autoSave();
    });

    // --- Header buttons ---
    document.getElementById('btn-add-slide').addEventListener('click', openTemplateModal);

    document.getElementById('btn-save').addEventListener('click', function () {
      if (window.ExportManager) window.ExportManager.saveToFile(state);
    });

    document.getElementById('btn-load').addEventListener('click', function () {
      Dialog.choose('Load Presentation', 'Choose the file format to load:', [
        { label: 'JSON Project File', style: 'primary', value: 'json' },
        { label: 'HTML Presentation', style: 'secondary', value: 'html' },
        { label: 'Cancel', style: 'ghost', value: null }
      ]).then(function (choice) {
        if (choice === 'json') {
          dom.fileInputLoad.accept = '.json';
          dom.fileInputLoad.click();
        } else if (choice === 'html') {
          dom.fileInputLoad.accept = '.html,.htm';
          dom.fileInputLoad.click();
        }
      });
    });

    dom.fileInputLoad.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (ev) {
        var content = ev.target.result;
        var parsed = null;

        if (file.name.endsWith('.json')) {
          // JSON format
          try {
            parsed = JSON.parse(content);
          } catch (err) {
            Dialog.alert('Invalid File', 'This file is not a valid JSON file.', 'error');
            return;
          }
        } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
          // HTML format — extract embedded JSON
          parsed = extractStateFromHtml(content);
          if (!parsed) {
            Dialog.alert('Cannot Import', 'This HTML file does not contain embedded presentation data.\n\nOnly HTML files exported from this tool can be re-imported.', 'error');
            return;
          }
        }

        if (parsed && parsed.slides) {
          loadState(parsed);
          autoSave();
        } else {
          Dialog.alert('Invalid File', 'This file does not contain valid presentation data.', 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    dom.fileInputImage.addEventListener('change', function (e) {
      if (e.target.files[0] && pendingImageSlideId && pendingImageFieldKey) {
        handleImageFile(e.target.files[0], pendingImageSlideId, pendingImageFieldKey);
      }
      e.target.value = '';
    });

    document.getElementById('btn-preview-all').addEventListener('click', openSlideshow);
    document.getElementById('btn-preview-all-sidebar').addEventListener('click', openSlideshow);

    document.getElementById('btn-export-pdf').addEventListener('click', function () {
      if (state.slides.length === 0) {
        Dialog.alert('No Slides', 'Add at least one slide before exporting.', 'warning');
        return;
      }
      if (window.ExportManager) {
        window.ExportManager.exportToPDF(state, dom);
      }
    });

    document.getElementById('btn-export-html').addEventListener('click', function () {
      if (state.slides.length === 0) {
        Dialog.alert('No Slides', 'Add at least one slide before exporting.', 'warning');
        return;
      }
      if (window.ExportManager) {
        window.ExportManager.exportToHTML(state);
      }
    });

    // Theme select (per-slide, handled in editor — global selector removed)

    // Close modals
    document.querySelectorAll('[data-close-modal]').forEach(function (el) {
      el.addEventListener('click', function () {
        closeModal(el.closest('.modal'));
      });
    });

    // Escape key closes modals
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (dom.slideshowModal.classList.contains('slideshow-modal--visible')) {
          closeModal(dom.slideshowModal);
        }
        if (dom.modalAddSlide.classList.contains('modal--visible')) {
          closeModal(dom.modalAddSlide);
        }
      }
    });

    // Ctrl+S to save
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (window.ExportManager) window.ExportManager.saveToFile(state);
      }
    });

    // Window resize — rescale preview
    window.addEventListener('resize', debounce(scalePreview, 150));

    // Initial scale
    setTimeout(scalePreview, 100);
  }

  /* -----------------------------------------------------------------------
     Extract state from exported HTML
     ----------------------------------------------------------------------- */
  function extractStateFromHtml(htmlString) {
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(htmlString, 'text/html');
      var dataEl = doc.getElementById('presentation-data');
      if (dataEl) {
        return JSON.parse(dataEl.textContent);
      }
    } catch (e) {
      // fall through
    }
    return null;
  }

  /* -----------------------------------------------------------------------
     Expose public API
     ----------------------------------------------------------------------- */
  window.PresentationApp = {
    state: state,
    loadState: loadState,
    openModal: openModal,
    closeModal: closeModal,
    getActiveSlide: getActiveSlide
  };

  /* -----------------------------------------------------------------------
     Boot
     ----------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', init);

})();
