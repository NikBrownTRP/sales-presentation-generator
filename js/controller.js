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
      slide.data.logo = slide.theme === 'tektro-light' ? 'assets/Logo Tektro.png' : 'assets/Logo TRP_w.png';
    }
    // Prefill brand line for title slides
    if (slide.data.hasOwnProperty('brandLine') && !slide.data.brandLine) {
      slide.data.brandLine = slide.theme === 'tektro-light' ? 'Product Quality \u2014 Value Driven \u2014 Purpose Built' : 'Product Quality \u2014 Performance Driven \u2014 Innovation Forward';
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

  function changeSlideTemplate(slideId, newTemplateId) {
    var slide = state.slides.find(function (s) { return s.id === slideId; });
    if (!slide) return;
    if (slide.templateId === newTemplateId) return; // no-op

    var oldTemplateId = slide.templateId;
    var newData = window.SlideTemplates.remapSlideData(oldTemplateId, newTemplateId, slide.data || {});

    // Prefill brand logo if the target template has a logo field and it
    // didn't carry one over (keeps parity with addSlide's behaviour).
    var hasLogoField = (window.SlideTemplates[newTemplateId].fields || []).some(function (f) { return f.key === 'logo'; });
    if (hasLogoField && !newData.logo) {
      newData.logo = slide.theme === 'tektro-light' ? 'assets/Logo Tektro.png' : 'assets/Logo TRP_w.png';
    }
    // Same for brandLine on title slides.
    var hasBrandLineField = (window.SlideTemplates[newTemplateId].fields || []).some(function (f) { return f.key === 'brandLine'; });
    if (hasBrandLineField && !newData.brandLine) {
      newData.brandLine = slide.theme === 'tektro-light' ? 'Product Quality \u2014 Value Driven \u2014 Purpose Built' : 'Product Quality \u2014 Performance Driven \u2014 Innovation Forward';
    }

    slide.templateId = newTemplateId;
    slide.data = newData;

    renderSidebar();
    renderEditor();
    updatePreview();
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

      // Top row: drag handle + thumbnail + info + side actions (move up/down)
      html += '<div class="slide-item__top">';

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

      // Side actions (move up/down stay stacked on the right of the top row)
      html += '<div class="slide-item__actions slide-item__actions--side">';
      html += '<button class="slide-item__action" data-action="move-up" data-slide-id="' + slide.id + '" title="Move up"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18,15 12,9 6,15"/></svg></button>';
      html += '<button class="slide-item__action" data-action="move-down" data-slide-id="' + slide.id + '" title="Move down"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg></button>';
      html += '</div>';

      html += '</div>'; // /slide-item__top

      // Bottom row: change-template, duplicate, hide, delete — horizontal, right-aligned
      html += '<div class="slide-item__actions slide-item__actions--bottom">';
      html += '<button class="slide-item__action" data-action="change-template" data-slide-id="' + slide.id + '" title="Change template"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17,1 21,5 17,9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7,23 3,19 7,15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg></button>';
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
        else if (action === 'change-template') openTemplateChangeModal(slideId);
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

  // Drag-and-drop reordering for list-type form fields (Selling Points,
  // Items, Features, Notes, etc.). Each item has data-list-row-key and
  // data-list-row-index attributes. We move within the same list only.
  function setupListDragDrop(slide) {
    var rows = dom.editorForm.querySelectorAll('[data-list-row-key]');
    var dragState = null; // { key, fromIdx }

    rows.forEach(function (row) {
      row.addEventListener('dragstart', function (e) {
        // Only initiate drag from the handle (or if user pressed before clicking input)
        // Browsers fire dragstart on the draggable element regardless of where they grabbed.
        // We allow it broadly but skip if the target is the input being interacted with.
        if (e.target.tagName === 'INPUT') {
          // Don't start dragging when the user is selecting text inside the input
          e.preventDefault();
          return;
        }
        dragState = {
          key: row.dataset.listRowKey,
          fromIdx: parseInt(row.dataset.listRowIndex, 10)
        };
        row.classList.add('form-list__item--dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', dragState.key + ':' + dragState.fromIdx); } catch (err) {}
      });

      row.addEventListener('dragend', function () {
        row.classList.remove('form-list__item--dragging');
        clearListDragOver();
        dragState = null;
      });

      row.addEventListener('dragover', function (e) {
        if (!dragState || dragState.key !== row.dataset.listRowKey) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        clearListDragOver();
        row.classList.add('form-list__item--drag-over');
      });

      row.addEventListener('dragleave', function () {
        row.classList.remove('form-list__item--drag-over');
      });

      row.addEventListener('drop', function (e) {
        if (!dragState || dragState.key !== row.dataset.listRowKey) return;
        e.preventDefault();
        clearListDragOver();
        var toIdx = parseInt(row.dataset.listRowIndex, 10);
        if (dragState.fromIdx === toIdx) { dragState = null; return; }

        var key = dragState.key;
        var items = (slide.data[key] || []).slice();
        var moved = items.splice(dragState.fromIdx, 1)[0];
        items.splice(toIdx, 0, moved);
        updateSlideData(slide.id, key, items);
        dragState = null;
        renderEditor();
      });
    });

    function clearListDragOver() {
      dom.editorForm.querySelectorAll('.form-list__item--drag-over').forEach(function (el) {
        el.classList.remove('form-list__item--drag-over');
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
      html += '<div class="form-list__item" draggable="true" data-list-row-key="' + field.key + '" data-list-row-index="' + i + '">';
      // Drag handle (also serves as drag affordance — input itself isn't draggable to allow text selection)
      html += '<span class="form-list__drag-handle" title="Drag to reorder">';
      html += '<svg width="10" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>';
      html += '</span>';
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

    // Image remove buttons — also drop the companion "Original" source
    // and any saved edit state so the next upload starts clean.
    dom.editorForm.querySelectorAll('.form-image-upload__remove').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var key = btn.dataset.key;
        updateSlideData(slide.id, key, '');
        updateSlideData(slide.id, key + 'Original', '');
        updateSlideData(slide.id, key + 'Edit', '');
        updateSlideData(slide.id, key + 'Bg', '');
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

    // List drag-and-drop reordering
    setupListDragDrop(slide);

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

      // Keep a higher-resolution copy of the ORIGINAL upload so re-editing
      // (crop, rotate, pan, zoom) stays lossless — each edit applies to
      // the pristine source, not to the already-cropped display version.
      // Without this, cropping in → out discards pixels permanently and
      // forces the user to re-upload to recover them.
      var origMaxW = Math.max(maxW * 2, 2400);
      var origMaxH = Math.max(maxH * 2, 1800);

      Promise.all([
        resizeImage(e.target.result, maxW, maxH, 0.85),
        resizeImage(e.target.result, origMaxW, origMaxH, 0.92)
      ]).then(function (pair) {
        var display = pair[0];
        var original = pair[1];
        updateSlideData(slideId, fieldKey, display);
        updateSlideData(slideId, fieldKey + 'Original', original);
        // Fresh upload — clear any stored edit state from a previous image.
        updateSlideData(slideId, fieldKey + 'Edit', '');
        renderEditor();
        debouncedThumbnailUpdate();
      });
    };
    reader.readAsDataURL(file);
  }

  /* -----------------------------------------------------------------------
     Image Editor (Crop & Rotate)
     ----------------------------------------------------------------------- */
  // New model: the output rectangle is a fixed-ratio viewport. The source image
  // is positioned (pan) and scaled (zoom) inside that viewport. Areas outside
  // the image within the viewport become the background of the final image.
  var imgEditor = {
    slideId: null,
    fieldKey: null,
    originalSrc: '',
    img: null,
    rotation: 0,          // 0, 90, 180, 270
    ratio: 1,              // output aspect ratio (width/height) — from slide container
    outputW: 0,            // output canvas width in pixels (high-res)
    outputH: 0,            // output canvas height in pixels
    zoom: 1,               // current zoom (1.0 = image drawn at natural pixel size)
    fitZoom: 1,            // zoom at which the whole image fits inside the output (contain)
    minZoom: 0.1,          // smallest allowed zoom (image can shrink below fit for padding)
    maxZoom: 4,            // how far user can zoom in
    pan: { x: 0, y: 0 },    // offset from centered, in OUTPUT coordinates
    bgColor: null,          // null = use slide theme default; else hex "#RRGGBB"
    pickingColor: false,    // true while user is in eyedropper mode
    dragging: false,
    dragStart: null,       // {mouseX, mouseY, panX, panY} at mousedown
    canvas: null,
    ctx: null,
    displayScale: 1        // editor-display scale: OUTPUT coords → canvas pixels
  };

  // Selectors for the container that constrains each image field on the slide.
  // Used to determine the WYSIWYG crop aspect ratio. The crop ratio always
  // matches the on-slide container so the cropped image fills exactly.
  var FIELD_CONTAINER_SELECTOR = {
    logo: '.pres-logo, .pres-slide-logo',
    productImage: '.pres-product-image-area, .pres-spec-right',
    image: '.pres-generic-image-area',
    chartImage: '.pres-graph-image-wrap',
    image1: '.pres-gallery-item:nth-child(1) .pres-gallery-image-wrap',
    image2: '.pres-gallery-item:nth-child(2) .pres-gallery-image-wrap',
    image3: '.pres-gallery-item:nth-child(3) .pres-gallery-image-wrap',
    backgroundImage: '.pres-slide'
  };

  // Fallback ratios if the element isn't found in the preview DOM.
  // Derived from slide template CSS (960x540 slide).
  var FIELD_FALLBACK_RATIO = {
    logo: 3.33,              // 200w × 60h on title, or 80w × 20h on other slides
    productImage: 0.89,      // ~half slide (480×540)
    image: 1.04,             // Header+List right column
    chartImage: 2.5,         // wide chart area
    image1: 0.73,            // gallery 3-col default
    image2: 0.73,
    image3: 0.73,
    backgroundImage: 16 / 9
  };

  function getFieldDisplayRatio(fieldKey) {
    var sel = FIELD_CONTAINER_SELECTOR[fieldKey];
    var fallback = FIELD_FALLBACK_RATIO[fieldKey] || 1;
    if (!sel) return fallback;

    // For logos, always use the fallback — measuring the img element picks up
    // the logo's natural aspect, not the on-slide bounding box (max-width/max-height).
    if (fieldKey === 'logo') return fallback;

    var previewEl = document.getElementById('preview-slide');
    if (!previewEl) return fallback;

    var el = previewEl.querySelector(sel);
    if (!el) return fallback;

    var rect = el.getBoundingClientRect();
    if (rect.width < 5 || rect.height < 5) return fallback;

    return rect.width / rect.height;
  }

  function formatRatio(r) {
    // Present a human-friendly label like "16:9" or "1.33:1"
    var common = [
      { r: 16 / 9, label: '16:9' },
      { r: 4 / 3, label: '4:3' },
      { r: 3 / 2, label: '3:2' },
      { r: 1, label: '1:1' },
      { r: 2 / 3, label: '2:3' },
      { r: 3 / 4, label: '3:4' },
      { r: 9 / 16, label: '9:16' }
    ];
    for (var i = 0; i < common.length; i++) {
      if (Math.abs(r - common[i].r) < 0.03) return common[i].label;
    }
    // Otherwise show decimal format
    return r.toFixed(2) + ':1';
  }

  // Compute high-quality output dimensions given source image size + target ratio.
  // Output is at least 1920px on its longest dimension, or larger if source is bigger.
  function computeOutputDims(imgW, imgH, ratio) {
    var base = Math.max(1920, imgW, imgH);
    var outW, outH;
    if (ratio >= 1) {
      outW = base;
      outH = Math.round(base / ratio);
    } else {
      outH = base;
      outW = Math.round(base * ratio);
    }
    return { w: outW, h: outH };
  }

  // Background color to paint behind the image (matches slide theme).
  // This only affects JPEG output; PNG exports use transparent.
  function getEditorBackgroundColor(slideId) {
    var slide = state.slides.find(function (s) { return s.id === slideId; });
    if (!slide) return '#000000';
    return slide.theme === 'tektro-light' ? '#FFFFFF' : '#000000';
  }

  function openImageEditor(slideId, fieldKey) {
    var slide = state.slides.find(function (s) { return s.id === slideId; });
    if (!slide || !slide.data[fieldKey]) return;

    imgEditor.slideId = slideId;
    imgEditor.fieldKey = fieldKey;
    // Prefer the stored pristine upload (set by handleImageFile) so
    // repeated crop/rotate sessions stay lossless. Fall back to the
    // display image when there is no stored original (legacy slides,
    // imports, default brand assets).
    imgEditor.originalSrc = slide.data[fieldKey + 'Original'] || slide.data[fieldKey];
    imgEditor.ratio = getFieldDisplayRatio(fieldKey);
    imgEditor.dragging = false;
    imgEditor.pickingColor = false;
    // Load previously-saved bg color (if any) so the user sees their previous choice
    imgEditor.bgColor = slide.data[fieldKey + 'Bg'] || null;
    // Restore previous edit state (rotation / pan / zoom) if saved — so
    // re-opening the editor shows the same framing the user had, but
    // applied on top of the original.
    var savedEdit = slide.data[fieldKey + 'Edit'];
    if (savedEdit && typeof savedEdit === 'object') {
      imgEditor.rotation = (typeof savedEdit.rotation === 'number') ? savedEdit.rotation : 0;
      imgEditor._restorePan = savedEdit.pan && typeof savedEdit.pan.x === 'number' ? savedEdit.pan : null;
      imgEditor._restoreZoom = (typeof savedEdit.zoom === 'number') ? savedEdit.zoom : null;
    } else {
      imgEditor.rotation = 0;
      imgEditor._restorePan = null;
      imgEditor._restoreZoom = null;
    }

    // Update ratio label
    var infoEl = document.getElementById('img-ratio-info');
    if (infoEl) infoEl.textContent = formatRatio(imgEditor.ratio);

    // Sync the color input + status label
    var colorInput = document.getElementById('img-bg-color');
    var bgStatus = document.getElementById('img-bg-status');
    var themeBg = getEditorBackgroundColor(slideId);
    if (colorInput) colorInput.value = imgEditor.bgColor || themeBg;
    if (bgStatus) bgStatus.textContent = imgEditor.bgColor ? imgEditor.bgColor : 'default';
    // Make sure eyedropper button is not stuck in active state
    var pickBtn = document.getElementById('img-bg-pick');
    if (pickBtn) pickBtn.classList.remove('image-editor__btn--picking');

    var modal = document.getElementById('modal-image-edit');
    imgEditor.canvas = document.getElementById('image-editor-canvas');
    imgEditor.ctx = imgEditor.canvas.getContext('2d');

    imgEditor.img = new Image();
    imgEditor.img.onload = function () {
      setupEditorCanvas();
      drawEditorCanvas();
      openModal(modal);
      bindImageEditorEvents();
    };
    imgEditor.img.src = imgEditor.originalSrc;
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

    // Compute output canvas size (high-res, pixel space)
    var imgDims = getRotatedDimensions();
    var outDims = computeOutputDims(imgDims.w, imgDims.h, imgEditor.ratio);
    imgEditor.outputW = outDims.w;
    imgEditor.outputH = outDims.h;

    // Compute "fit" zoom: the largest zoom where the whole image fits inside output
    // (image covers the output if zoom >= this, but we want image visible entirely
    // at start, so use min which is "contain")
    imgEditor.fitZoom = Math.min(outDims.w / imgDims.w, outDims.h / imgDims.h);
    // Allow user to zoom below fit down to 25% of fit (adds padding around image).
    imgEditor.minZoom = imgEditor.fitZoom * 0.25;
    imgEditor.maxZoom = imgEditor.fitZoom * 4;
    // Initial zoom = fit (image fits entirely, with any letterbox from ratio mismatch).
    imgEditor.zoom = imgEditor.fitZoom;
    imgEditor.pan = { x: 0, y: 0 };

    // Restore previous edit state (saved from a prior apply), if any.
    // Zoom values stored from a previous session are in the SAME units
    // as `imgEditor.zoom` (multiplier of natural pixel size), so they
    // translate directly across re-opens even if the output canvas size
    // was different — we just clamp into the current min/max range.
    if (imgEditor._restoreZoom != null) {
      imgEditor.zoom = Math.max(imgEditor.minZoom, Math.min(imgEditor.maxZoom, imgEditor._restoreZoom));
    }
    if (imgEditor._restorePan) {
      imgEditor.pan = { x: imgEditor._restorePan.x, y: imgEditor._restorePan.y };
      if (typeof clampPan === 'function') clampPan();
    }

    // Editor display scale: output coords → canvas pixels
    imgEditor.displayScale = Math.min(areaW / outDims.w, areaH / outDims.h, 1);
    imgEditor.canvas.width = Math.round(outDims.w * imgEditor.displayScale);
    imgEditor.canvas.height = Math.round(outDims.h * imgEditor.displayScale);

    // Update zoom slider position
    syncZoomSlider();
  }

  // Log-scale mapping between zoom and slider [0..100] so "fit" sits near the
  // middle (equal visual distance to zoom-out-to-min and zoom-in-to-max).
  function zoomToSliderValue(zoom) {
    var logMin = Math.log(imgEditor.minZoom);
    var logMax = Math.log(imgEditor.maxZoom);
    var logZ = Math.log(Math.max(imgEditor.minZoom, Math.min(imgEditor.maxZoom, zoom)));
    return Math.round(((logZ - logMin) / (logMax - logMin)) * 100);
  }

  function sliderValueToZoom(val) {
    var logMin = Math.log(imgEditor.minZoom);
    var logMax = Math.log(imgEditor.maxZoom);
    return Math.exp(logMin + (val / 100) * (logMax - logMin));
  }

  function formatZoomLabel() {
    var fit = imgEditor.fitZoom;
    if (Math.abs(imgEditor.zoom - fit) / fit < 0.02) return 'fit';
    // Show as percentage of fit so "200%" = 2× fit, "50%" = half of fit.
    return Math.round(imgEditor.zoom / fit * 100) + '%';
  }

  function syncZoomSlider() {
    var slider = document.getElementById('img-zoom-slider');
    var valEl = document.getElementById('img-zoom-value');
    if (slider) slider.value = zoomToSliderValue(imgEditor.zoom);
    if (valEl) valEl.textContent = formatZoomLabel();
  }

  function clampPan() {
    // Prevent panning the image entirely out of the output rect.
    // Allow image edges to reach the output rect edges, but no further.
    var imgDims = getRotatedDimensions();
    var drawW = imgDims.w * imgEditor.zoom;
    var drawH = imgDims.h * imgEditor.zoom;

    // Pan range: image center can move within |(drawDim - outDim)| / 2
    // When image is smaller than output, keep image anywhere inside output
    //   (pan can range so image edge just touches output edge)
    var maxPanX, maxPanY;
    if (drawW >= imgEditor.outputW) {
      maxPanX = (drawW - imgEditor.outputW) / 2;
    } else {
      maxPanX = (imgEditor.outputW - drawW) / 2;
    }
    if (drawH >= imgEditor.outputH) {
      maxPanY = (drawH - imgEditor.outputH) / 2;
    } else {
      maxPanY = (imgEditor.outputH - drawH) / 2;
    }
    imgEditor.pan.x = Math.max(-maxPanX, Math.min(maxPanX, imgEditor.pan.x));
    imgEditor.pan.y = Math.max(-maxPanY, Math.min(maxPanY, imgEditor.pan.y));
  }

  function drawEditorCanvas() {
    var ctx = imgEditor.ctx;
    var canvas = imgEditor.canvas;
    var img = imgEditor.img;
    var ds = imgEditor.displayScale;

    // Background fill: user-picked color if set, else slide theme default.
    // This represents the "letterbox"/padding area on the slide container.
    ctx.fillStyle = imgEditor.bgColor || getEditorBackgroundColor(imgEditor.slideId);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the image at zoom + pan (centered + offset)
    var imgDims = getRotatedDimensions();
    var drawW = imgDims.w * imgEditor.zoom * ds;
    var drawH = imgDims.h * imgEditor.zoom * ds;
    var cx = canvas.width / 2 + imgEditor.pan.x * ds;
    var cy = canvas.height / 2 + imgEditor.pan.y * ds;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(imgEditor.rotation * Math.PI / 180);
    // After rotation, swap draw dims for 90/270 so the image's natural
    // pixel order is drawn correctly before the canvas transform applies.
    var rw, rh;
    if (imgEditor.rotation === 90 || imgEditor.rotation === 270) {
      rw = drawH; rh = drawW;
    } else {
      rw = drawW; rh = drawH;
    }
    ctx.drawImage(img, -rw / 2, -rh / 2, rw, rh);
    ctx.restore();

    // Output-rect border (thin line so the user sees where the slide frame is)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  }

  function bindImageEditorEvents() {
    var canvas = imgEditor.canvas;
    var newCanvas = canvas.cloneNode(false);
    canvas.parentNode.replaceChild(newCanvas, canvas);
    imgEditor.canvas = newCanvas;
    imgEditor.ctx = newCanvas.getContext('2d');
    drawEditorCanvas();

    // Drag = pan the image within the output rect
    newCanvas.style.cursor = 'grab';

    newCanvas.addEventListener('mousedown', function (e) {
      // Eyedropper mode: sample the pixel under the cursor and use it as bg
      if (imgEditor.pickingColor) {
        var rect = newCanvas.getBoundingClientRect();
        var x = Math.round(e.clientX - rect.left);
        var y = Math.round(e.clientY - rect.top);
        try {
          var data = imgEditor.ctx.getImageData(x, y, 1, 1).data;
          var hex = '#' + [data[0], data[1], data[2]].map(function (c) {
            var s = c.toString(16); return s.length < 2 ? '0' + s : s;
          }).join('');
          setBgColor(hex);
        } catch (err) {
          console.error('Color sample failed:', err);
        }
        // Exit picking mode after one sample
        imgEditor.pickingColor = false;
        if (bgPickBtn) bgPickBtn.classList.remove('image-editor__btn--picking');
        newCanvas.style.cursor = 'grab';
        return;
      }

      imgEditor.dragging = true;
      imgEditor.dragStart = {
        mouseX: e.clientX, mouseY: e.clientY,
        panX: imgEditor.pan.x, panY: imgEditor.pan.y
      };
      newCanvas.style.cursor = 'grabbing';
    });

    newCanvas.addEventListener('mousemove', function (e) {
      if (!imgEditor.dragging) return;
      var ds = imgEditor.displayScale;
      var dx = (e.clientX - imgEditor.dragStart.mouseX) / ds;
      var dy = (e.clientY - imgEditor.dragStart.mouseY) / ds;
      imgEditor.pan.x = imgEditor.dragStart.panX + dx;
      imgEditor.pan.y = imgEditor.dragStart.panY + dy;
      clampPan();
      drawEditorCanvas();
    });

    newCanvas.addEventListener('mouseup', function () {
      imgEditor.dragging = false;
      newCanvas.style.cursor = 'grab';
    });

    newCanvas.addEventListener('mouseleave', function () {
      imgEditor.dragging = false;
      newCanvas.style.cursor = 'grab';
    });

    // Mousewheel zoom, centered on cursor position
    newCanvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var delta = -e.deltaY;
      var factor = delta > 0 ? 1.08 : 1 / 1.08;
      setZoom(imgEditor.zoom * factor);
    }, { passive: false });

    // Zoom buttons
    document.getElementById('img-zoom-in').onclick = function () {
      setZoom(imgEditor.zoom * 1.2);
    };
    document.getElementById('img-zoom-out').onclick = function () {
      setZoom(imgEditor.zoom / 1.2);
    };

    // Zoom slider (log-scale)
    document.getElementById('img-zoom-slider').oninput = function (e) {
      var newZoom = sliderValueToZoom(parseInt(e.target.value, 10));
      setZoom(newZoom, true); // skip slider sync to avoid feedback loop
    };

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

    // Background color controls
    var bgColorInput = document.getElementById('img-bg-color');
    var bgStatusEl = document.getElementById('img-bg-status');
    var bgPickBtn = document.getElementById('img-bg-pick');
    var bgResetBtn = document.getElementById('img-bg-reset');

    function setBgColor(color) {
      imgEditor.bgColor = color;
      if (bgColorInput) bgColorInput.value = color || getEditorBackgroundColor(imgEditor.slideId);
      if (bgStatusEl) bgStatusEl.textContent = color ? color.toUpperCase() : 'default';
      drawEditorCanvas();
    }

    if (bgColorInput) {
      bgColorInput.oninput = function (e) { setBgColor(e.target.value); };
    }
    if (bgResetBtn) {
      bgResetBtn.onclick = function () { setBgColor(null); };
    }
    if (bgPickBtn) {
      bgPickBtn.onclick = function () {
        imgEditor.pickingColor = !imgEditor.pickingColor;
        bgPickBtn.classList.toggle('image-editor__btn--picking', imgEditor.pickingColor);
        newCanvas.style.cursor = imgEditor.pickingColor ? 'crosshair' : 'grab';
      };
    }

    // Reset (rotation + pan + zoom; keeps bg color)
    document.getElementById('img-reset').onclick = function () {
      imgEditor.rotation = 0;
      setupEditorCanvas();
      drawEditorCanvas();
    };

    // Cancel / Apply
    document.getElementById('img-cancel').onclick = function () {
      closeModal(document.getElementById('modal-image-edit'));
    };
    document.getElementById('img-apply').onclick = function () {
      applyImageEdit();
    };
  }

  function setZoom(newZoom, skipSliderSync) {
    imgEditor.zoom = Math.max(imgEditor.minZoom, Math.min(imgEditor.maxZoom, newZoom));
    clampPan();
    drawEditorCanvas();
    if (!skipSliderSync) {
      syncZoomSlider();
    } else {
      // Slider value is driving this change — just update the text label
      var valEl = document.getElementById('img-zoom-value');
      if (valEl) valEl.textContent = formatZoomLabel();
    }
  }

  function applyImageEdit() {
    var img = imgEditor.img;
    var imgDims = getRotatedDimensions();

    // Output canvas at high-res
    var out = document.createElement('canvas');
    out.width = imgEditor.outputW;
    out.height = imgEditor.outputH;
    var outCtx = out.getContext('2d');

    // Fill background:
    //   - If user picked a specific bg color, bake it in (even for PNG, since the
    //     user explicitly wanted this color). This guarantees the on-slide look
    //     matches the preview regardless of container CSS.
    //   - Else for JPEG, fill with the slide theme bg (JPEG can't do transparent).
    //   - Else PNG stays transparent.
    // isPng must also cover relative-path sources (e.g. "assets/Logo TRP_w.png"
    // used for default brand logos). If we treated those as JPEG, editing a
    // transparent-background logo would bake the theme bg into it.
    var src = imgEditor.originalSrc || '';
    var isPng = src.indexOf('data:image/png') === 0 ||
                (src.indexOf('data:') !== 0 && /\.png($|\?)/i.test(src));
    if (imgEditor.bgColor) {
      outCtx.fillStyle = imgEditor.bgColor;
      outCtx.fillRect(0, 0, out.width, out.height);
    } else if (!isPng) {
      outCtx.fillStyle = getEditorBackgroundColor(imgEditor.slideId);
      outCtx.fillRect(0, 0, out.width, out.height);
    }

    // Draw the rotated image at zoom + pan, centered
    var drawW = imgDims.w * imgEditor.zoom;
    var drawH = imgDims.h * imgEditor.zoom;
    var cx = out.width / 2 + imgEditor.pan.x;
    var cy = out.height / 2 + imgEditor.pan.y;

    outCtx.save();
    outCtx.translate(cx, cy);
    outCtx.rotate(imgEditor.rotation * Math.PI / 180);
    var rw, rh;
    if (imgEditor.rotation === 90 || imgEditor.rotation === 270) {
      rw = drawH; rh = drawW;
    } else {
      rw = drawW; rh = drawH;
    }
    outCtx.drawImage(img, -rw / 2, -rh / 2, rw, rh);
    outCtx.restore();

    var dataUrl = isPng ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', 0.92);
    updateSlideData(imgEditor.slideId, imgEditor.fieldKey, dataUrl);
    // Persist the chosen bg color so (a) re-opening the editor shows the previous
    // choice and (b) the slide template can paint the container background too.
    updateSlideData(imgEditor.slideId, imgEditor.fieldKey + 'Bg', imgEditor.bgColor || '');
    // Persist the edit framing (rotation / pan / zoom) so re-opening the
    // editor starts from where the user left off, while still applying
    // to the pristine original — no accumulated quality loss across edits.
    updateSlideData(imgEditor.slideId, imgEditor.fieldKey + 'Edit', {
      rotation: imgEditor.rotation,
      pan: { x: imgEditor.pan.x, y: imgEditor.pan.y },
      zoom: imgEditor.zoom
    });
    // If the slide never stored an Original (legacy / imported / default
    // brand asset), preserve the pre-edit source AS the original so the
    // NEXT edit is also lossless. `src` is what we actually drew from.
    var slide = state.slides.find(function (s) { return s.id === imgEditor.slideId; });
    if (slide && !slide.data[imgEditor.fieldKey + 'Original']) {
      updateSlideData(imgEditor.slideId, imgEditor.fieldKey + 'Original', src);
    }
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
  // Mode: 'add' (default) creates a new slide; 'change' swaps the template
  // on an existing slide identified by modalSlideId.
  var modalMode = 'add';
  var modalSlideId = null;

  function openTemplateModal() {
    modalMode = 'add';
    modalSlideId = null;
    modalTheme = state.lastTheme || 'trp-dark';
    renderTemplateGrid();
    openModal(dom.modalAddSlide);
  }

  function openTemplateChangeModal(slideId) {
    var slide = state.slides.find(function (s) { return s.id === slideId; });
    if (!slide) return;
    modalMode = 'change';
    modalSlideId = slideId;
    // Lock the theme to the slide's existing theme — swapping templates
    // shouldn't also silently change the theme.
    modalTheme = slide.theme || state.lastTheme || 'trp-dark';
    renderTemplateGrid();
    openModal(dom.modalAddSlide);
  }

  function renderTemplateGrid() {
    var templates = window.SlideTemplates.getOrderedList();
    var currentTemplateId = null;
    if (modalMode === 'change' && modalSlideId) {
      var curSlide = state.slides.find(function (s) { return s.id === modalSlideId; });
      if (curSlide) currentTemplateId = curSlide.templateId;
    }

    var html = '';

    if (modalMode === 'change') {
      html += '<div class="template-grid__mode-banner">Pick a new template for this slide. Content is mapped to matching fields where possible; anything that can\u2019t be mapped is kept in the background and restored if you switch back.</div>';
    }

    // Theme picker — hidden in change mode (theme is locked to the slide)
    if (modalMode === 'add') {
      html += '<div class="template-theme-picker">';
      html += '<button class="template-theme-btn' + (modalTheme === 'trp-dark' ? ' template-theme-btn--active' : '') + '" data-pick-theme="trp-dark">TRP Racing</button>';
      html += '<button class="template-theme-btn' + (modalTheme === 'tektro-light' ? ' template-theme-btn--active' : '') + '" data-pick-theme="tektro-light">Tektro</button>';
      html += '</div>';
    }

    // Template cards with live previews
    html += '<div class="template-grid__cards">';
    templates.forEach(function (t) {
      var isCurrent = t.id === currentTemplateId;
      var previewData = window.SlideTemplates.getDefaults(t.id);
      var previewHtml = t.render(previewData);
      html += '<div class="template-card' + (isCurrent ? ' template-card--current' : '') + '" data-template-id="' + t.id + '">';
      if (isCurrent) {
        html += '<div class="template-card__badge">Current</div>';
      }
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
        var pickedId = card.dataset.templateId;
        if (modalMode === 'change') {
          if (pickedId === currentTemplateId) {
            // Clicking the current template is a no-op; just close.
            closeModal(dom.modalAddSlide);
            return;
          }
          changeSlideTemplate(modalSlideId, pickedId);
        } else {
          addSlide(pickedId, modalTheme);
        }
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

  // fromCurrent === true → start at the currently selected slide (skipping hidden);
  // otherwise starts from the first visible slide.
  function openSlideshow(fromCurrent) {
    var visibleSlides = state.slides.filter(function (s) { return !s.hidden; });
    if (visibleSlides.length === 0) return;

    var startIndex = 0;
    if (fromCurrent && state.activeSlideId) {
      var idx = -1;
      for (var i = 0; i < visibleSlides.length; i++) {
        if (visibleSlides[i].id === state.activeSlideId) { idx = i; break; }
      }
      if (idx !== -1) startIndex = idx;
      // Active slide may be hidden — fall through to startIndex 0 in that case
    }
    slideshowIndex = startIndex;

    if (window.PreviewRenderer) {
      window.PreviewRenderer.openSlideshow(visibleSlides, state.theme, startIndex);
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
    // Load saved state — IndexedDB (async) with localStorage fallback
    function finalizeInitialState(saved) {
      if (saved && saved.slides && saved.slides.length > 0) {
        loadState(saved);
      } else {
        addSlide('title');
      }
      // Keep the title input in sync after load
      if (dom.presTitle) {
        dom.presTitle.value = state.meta.title || 'Untitled Presentation';
      }
    }

    if (window.ExportManager && window.ExportManager.loadFromLocalStorageAsync) {
      window.ExportManager.loadFromLocalStorageAsync().then(finalizeInitialState).catch(function() {
        finalizeInitialState(null);
      });
    } else {
      var saved = window.ExportManager ? window.ExportManager.loadFromLocalStorage() : null;
      finalizeInitialState(saved);
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

    // Theme the next PPTX import should be converted to. Set by the
    // brand picker dialog (below) before the file input fires.
    var pendingPptxTheme = 'trp-dark';

    document.getElementById('btn-load').addEventListener('click', function () {
      Dialog.choose('Load Presentation', 'Choose the file format to load:', [
        { label: 'JSON', style: 'primary', value: 'json' },
        { label: 'HTML', style: 'secondary', value: 'html' },
        { label: 'PowerPoint', style: 'secondary', value: 'pptx' },
        { label: 'Cancel', style: 'ghost', value: null }
      ]).then(function (choice) {
        if (choice === 'json') {
          dom.fileInputLoad.accept = '.json';
          dom.fileInputLoad.click();
        } else if (choice === 'html') {
          dom.fileInputLoad.accept = '.html,.htm';
          dom.fileInputLoad.click();
        } else if (choice === 'pptx') {
          // PPTX has no brand embedded, so ask which template to convert to
          // before opening the file picker.
          // Both brand buttons use the same (secondary) style so neither
          // reads as the preferred default — the user should make a
          // deliberate pick.
          Dialog.choose('Import as…', 'Which template should the imported slides use?', [
            { label: 'TRP Racing', style: 'secondary', value: 'trp-dark' },
            { label: 'Tektro', style: 'secondary', value: 'tektro-light' },
            { label: 'Cancel', style: 'ghost', value: null }
          ]).then(function (themeChoice) {
            if (!themeChoice) return;
            pendingPptxTheme = themeChoice;
            dom.fileInputLoad.accept = '.pptx';
            dom.fileInputLoad.click();
          });
        }
      });
    });

    // Expose the chosen theme on the dom object so the file handler below
    // can read it without closing over this scope.
    dom._getPendingPptxTheme = function () { return pendingPptxTheme; };

    dom.fileInputLoad.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;

      // PPTX is binary — needs ArrayBuffer + the async importer module.
      if (file.name.toLowerCase().endsWith('.pptx')) {
        if (!window.PptxImporter) {
          Dialog.alert('Importer Unavailable', 'PPTX importer did not load. Please reload the app.', 'error');
          e.target.value = '';
          return;
        }
        var pptxReader = new FileReader();
        var chosenTheme = dom._getPendingPptxTheme ? dom._getPendingPptxTheme() : 'trp-dark';
        pptxReader.onload = function (ev) {
          window.PptxImporter.parse(ev.target.result, { theme: chosenTheme }).then(function (parsed) {
            if (parsed && parsed.slides && parsed.slides.length) {
              loadState(parsed);
              autoSave();
            } else {
              Dialog.alert('Nothing to Import', 'No slides were found in this PowerPoint file.', 'warning');
            }
          }).catch(function (err) {
            Dialog.alert('Invalid File', 'Could not read this PowerPoint file: ' + (err && err.message ? err.message : err), 'error');
          });
        };
        pptxReader.readAsArrayBuffer(file);
        e.target.value = '';
        return;
      }

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

    // Header "Preview" button → always start from first slide
    document.getElementById('btn-preview-all').addEventListener('click', function () {
      openSlideshow(false);
    });
    // Sidebar "Preview from here" button → start from currently selected slide
    document.getElementById('btn-preview-all-sidebar').addEventListener('click', function () {
      openSlideshow(true);
    });

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
