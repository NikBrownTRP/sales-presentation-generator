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
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality || 0.85));
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
    theme: 'tektro-dark',
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
    dom.themeSelect = document.getElementById('theme-select');
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
  }

  /* -----------------------------------------------------------------------
     Slide CRUD
     ----------------------------------------------------------------------- */
  function addSlide(templateId) {
    var slide = {
      id: uid(),
      templateId: templateId,
      data: window.SlideTemplates.getDefaults(templateId)
    };
    state.slides.push(slide);
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

      html += '<li class="slide-item' + (isActive ? ' slide-item--active' : '') + '" data-slide-id="' + slide.id + '" draggable="true">';

      // Drag handle
      html += '<span class="slide-item__drag-handle" title="Drag to reorder">';
      html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>';
      html += '</span>';

      // Thumbnail
      html += '<div class="slide-item__thumbnail" id="thumb-' + slide.id + '">';
      html += '<div class="slide-item__thumbnail-inner" data-theme="' + state.theme + '">';
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
        else if (action === 'delete') {
          if (confirm('Delete this slide?')) deleteSlide(slideId);
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

    var html = '';
    template.fields.forEach(function (field) {
      html += renderField(field, slide);
    });

    dom.editorForm.innerHTML = html;
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
        if (e.target.closest('.form-image-upload__preview') && !e.target.closest('.form-image-upload__remove')) {
          // Clicking on existing preview also opens file picker
        }
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
     Preview
     ----------------------------------------------------------------------- */
  function updatePreview() {
    var slide = getActiveSlide();
    if (!slide) {
      dom.previewSlide.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#444;font-size:14px;">No slide selected</div>';
      return;
    }

    if (window.PreviewRenderer) {
      window.PreviewRenderer.renderLivePreview(slide, state.theme, dom.previewSlide, dom.previewScaler, dom.previewPanel);
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
  function openTemplateModal() {
    var templates = window.SlideTemplates.getOrderedList();
    var html = '';

    templates.forEach(function (t) {
      html += '<div class="template-card" data-template-id="' + t.id + '">';
      html += '<div class="template-card__icon">' + t.icon + '</div>';
      html += '<div class="template-card__name">' + t.name + '</div>';
      html += '<div class="template-card__desc">' + t.description + '</div>';
      html += '</div>';
    });

    dom.templateGrid.innerHTML = html;
    openModal(dom.modalAddSlide);

    // Bind clicks
    dom.templateGrid.querySelectorAll('.template-card').forEach(function (card) {
      card.addEventListener('click', function () {
        addSlide(card.dataset.templateId);
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
    if (state.slides.length === 0) return;
    slideshowIndex = 0;

    if (window.PreviewRenderer) {
      window.PreviewRenderer.openSlideshow(state.slides, state.theme);
    }
  }

  /* -----------------------------------------------------------------------
     Load state
     ----------------------------------------------------------------------- */
  function loadState(newState) {
    state.slides = newState.slides || [];
    state.theme = newState.theme || 'tektro-dark';
    state.meta = newState.meta || { title: 'Untitled Presentation', updatedAt: null };
    state.activeSlideId = state.slides.length > 0 ? state.slides[0].id : null;

    dom.themeSelect.value = state.theme;
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

    // --- Header buttons ---
    document.getElementById('btn-add-slide').addEventListener('click', openTemplateModal);

    document.getElementById('btn-save').addEventListener('click', function () {
      if (window.ExportManager) window.ExportManager.saveToFile(state);
    });

    document.getElementById('btn-load').addEventListener('click', function () {
      // Show a choice: load JSON or HTML
      var choice = prompt('Load from:\n1 = JSON file\n2 = HTML presentation file\n\nEnter 1 or 2:', '1');
      if (choice === '1') {
        dom.fileInputLoad.accept = '.json';
        dom.fileInputLoad.click();
      } else if (choice === '2') {
        dom.fileInputLoad.accept = '.html,.htm';
        dom.fileInputLoad.click();
      }
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
            alert('Error: Invalid JSON file.');
            return;
          }
        } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
          // HTML format — extract embedded JSON
          parsed = extractStateFromHtml(content);
          if (!parsed) {
            alert('Error: This HTML file does not contain embedded presentation data.\nOnly HTML files exported from this tool can be re-imported.');
            return;
          }
        }

        if (parsed && parsed.slides) {
          loadState(parsed);
          autoSave();
        } else {
          alert('Error: File does not contain valid presentation data.');
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
        alert('Add at least one slide before exporting.');
        return;
      }
      if (window.ExportManager) {
        window.ExportManager.exportToPDF(state, dom);
      }
    });

    document.getElementById('btn-export-html').addEventListener('click', function () {
      if (state.slides.length === 0) {
        alert('Add at least one slide before exporting.');
        return;
      }
      if (window.ExportManager) {
        window.ExportManager.exportToHTML(state);
      }
    });

    // Theme select
    dom.themeSelect.addEventListener('change', function () {
      state.theme = dom.themeSelect.value;
      renderSidebar();
      updatePreview();
      autoSave();
    });

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
