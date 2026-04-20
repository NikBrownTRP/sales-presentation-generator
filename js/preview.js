/* ==========================================================================
   Sales Presentation Generator — Preview Renderer
   Live preview scaling + fullscreen slideshow with navigation
   ========================================================================== */
'use strict';

(function () {

  var SLIDE_W = 960;
  var SLIDE_H = 540;

  /* -----------------------------------------------------------------------
     Live Preview
     ----------------------------------------------------------------------- */

  function renderLivePreview(slide, theme, containerEl, scalerEl, panelEl) {
    var template = window.SlideTemplates[slide.templateId];
    if (!template) return;

    var html = '<div data-theme="' + theme + '" style="width:' + SLIDE_W + 'px;height:' + SLIDE_H + 'px;">';
    html += template.render(slide.data);
    html += '</div>';

    containerEl.innerHTML = html;
    calculateScale(scalerEl, panelEl);
  }

  function calculateScale(scalerEl, panelEl) {
    if (!scalerEl || !panelEl) return;

    var container = panelEl.querySelector('.builder-preview__container');
    if (!container) return;

    var availW = container.clientWidth - 40;  // padding
    var availH = container.clientHeight - 40;
    if (availW <= 0 || availH <= 0) return;

    var scaleX = availW / SLIDE_W;
    var scaleY = availH / SLIDE_H;
    var scale = Math.min(scaleX, scaleY, 1);

    scalerEl.style.transform = 'scale(' + scale + ')';
    scalerEl.style.transformOrigin = 'top left';
    scalerEl.style.width = SLIDE_W + 'px';
    scalerEl.style.height = SLIDE_H + 'px';

    // Center the scaler in the container
    var scaledW = SLIDE_W * scale;
    var scaledH = SLIDE_H * scale;
    var offsetX = Math.max(0, (availW + 40 - scaledW) / 2);
    var offsetY = Math.max(0, (availH + 40 - scaledH) / 2);
    scalerEl.style.marginLeft = offsetX + 'px';
    scalerEl.style.marginTop = offsetY + 'px';
  }

  /* -----------------------------------------------------------------------
     Fullscreen Slideshow
     ----------------------------------------------------------------------- */
  var slideshowState = {
    slides: [],
    theme: '',
    currentIndex: 0,
    renderedSlides: [],
    onClose: null
  };

  function openSlideshow(slides, theme, startIndex, onClose) {
    if (!slides || slides.length === 0) return;

    var startAt = (typeof startIndex === 'number' && startIndex >= 0 && startIndex < slides.length) ? startIndex : 0;

    slideshowState.slides = slides;
    slideshowState.theme = theme;
    slideshowState.currentIndex = startAt;
    slideshowState.onClose = (typeof onClose === 'function') ? onClose : null;

    var modal = document.getElementById('slideshow-modal');
    var stage = document.getElementById('slideshow-stage');
    var counter = document.getElementById('slideshow-counter');
    var dots = document.getElementById('slideshow-dots');

    // Render all slides
    var html = '';
    slides.forEach(function (slide, i) {
      var template = window.SlideTemplates[slide.templateId];
      if (!template) return;

      var posClass;
      if (i === startAt) posClass = 'slideshow-modal__slide--active';
      else if (i < startAt) posClass = 'slideshow-modal__slide--prev';
      else posClass = 'slideshow-modal__slide--next';
      html += '<div class="slideshow-modal__slide ' + posClass + '" data-slide-index="' + i + '">';
      html += '<div data-theme="' + (slide.theme || theme) + '" style="width:' + SLIDE_W + 'px;height:' + SLIDE_H + 'px;">';
      var rendered = template.render(slide.data);
      // Add animation class only to the starting active slide
      if (i === startAt) {
        rendered = rendered.replace('class="pres-slide ', 'class="pres-slide pres-slide--animated ');
      }
      html += rendered;
      html += '</div>';
      html += '</div>';
    });
    stage.innerHTML = html;

    // Render dots
    var dotsHtml = '';
    slides.forEach(function (s, i) {
      dotsHtml += '<button class="slideshow-modal__dot' + (i === startAt ? ' slideshow-modal__dot--active' : '') + '" data-dot-index="' + i + '"></button>';
    });
    dots.innerHTML = dotsHtml;

    // Update counter
    counter.textContent = (startAt + 1) + ' / ' + slides.length;

    // Scale slides to fit viewport
    scaleSlideshowSlides(stage);

    // Show modal
    modal.classList.add('slideshow-modal--visible');
    modal.setAttribute('aria-hidden', 'false');

    // Bind events
    showSlideshowUi();
    bindSlideshowEvents();
  }

  function scaleSlideshowSlides(stage) {
    var vpW = window.innerWidth - 120; // margin for nav buttons
    var vpH = window.innerHeight - 100; // margin for header/dots

    var scaleX = vpW / SLIDE_W;
    var scaleY = vpH / SLIDE_H;
    // No upper cap: on large monitors the slide now fills the available
    // viewport instead of being capped at 1.5x and leaving a huge black border.
    var scale = Math.min(scaleX, scaleY);

    var slideEls = stage.querySelectorAll('.slideshow-modal__slide');
    slideEls.forEach(function (el) {
      el.style.transform = '';
      var inner = el.firstElementChild;
      if (inner) {
        inner.style.transform = 'scale(' + scale + ')';
        inner.style.transformOrigin = 'center center';
      }
    });
  }

  function goToSlide(index) {
    var slides = document.querySelectorAll('.slideshow-modal__slide');
    var dots = document.querySelectorAll('.slideshow-modal__dot');
    var counter = document.getElementById('slideshow-counter');
    var total = slides.length;

    if (index < 0 || index >= total) return;

    var prevIndex = slideshowState.currentIndex;
    slideshowState.currentIndex = index;

    slides.forEach(function (el, i) {
      el.classList.remove('slideshow-modal__slide--active', 'slideshow-modal__slide--prev', 'slideshow-modal__slide--next');

      // Remove animation class from all slides
      var presSlide = el.querySelector('.pres-slide');
      if (presSlide) {
        presSlide.classList.remove('pres-slide--animated');
      }

      if (i === index) {
        el.classList.add('slideshow-modal__slide--active');
        // Add animation class to the newly active slide
        if (presSlide) {
          presSlide.classList.add('pres-slide--animated');
        }
      } else if (i < index) {
        el.classList.add('slideshow-modal__slide--prev');
      } else {
        el.classList.add('slideshow-modal__slide--next');
      }
    });

    dots.forEach(function (dot, i) {
      dot.classList.toggle('slideshow-modal__dot--active', i === index);
    });

    counter.textContent = (index + 1) + ' / ' + total;
  }

  function closeSlideshow() {
    var modal = document.getElementById('slideshow-modal');
    modal.classList.remove('slideshow-modal--visible');
    modal.setAttribute('aria-hidden', 'true');
    unbindSlideshowEvents();
    if (slideshowState.onClose) {
      var cb = slideshowState.onClose;
      slideshowState.onClose = null;
      var closedSlide = slideshowState.slides[slideshowState.currentIndex];
      if (closedSlide) {
        cb(closedSlide.id);
      }
    }
  }

  var slideshowKeyHandler = null;
  var slideshowResizeHandler = null;
  var slideshowMouseMoveHandler = null;
  var slideshowUiTimer = null;

  function showSlideshowUi() {
    var modal = document.getElementById('slideshow-modal');
    if (!modal) return;
    modal.classList.add('slideshow-modal--ui-visible');
    clearTimeout(slideshowUiTimer);
    slideshowUiTimer = setTimeout(hideSlideshowUi, 2500);
  }

  function hideSlideshowUi() {
    var modal = document.getElementById('slideshow-modal');
    if (!modal) return;
    modal.classList.remove('slideshow-modal--ui-visible');
    clearTimeout(slideshowUiTimer);
    slideshowUiTimer = null;
  }

  function bindSlideshowEvents() {
    // Tear down any existing listeners before rebinding (prevents double-registration)
    if (slideshowMouseMoveHandler) {
      var existingModal = document.getElementById('slideshow-modal');
      if (existingModal) existingModal.removeEventListener('mousemove', slideshowMouseMoveHandler);
      slideshowMouseMoveHandler = null;
    }
    if (slideshowKeyHandler) {
      document.removeEventListener('keydown', slideshowKeyHandler);
      slideshowKeyHandler = null;
    }
    if (slideshowResizeHandler) {
      window.removeEventListener('resize', slideshowResizeHandler);
      slideshowResizeHandler = null;
    }
    var prevBtn = document.getElementById('slideshow-prev');
    var nextBtn = document.getElementById('slideshow-next');
    var closeBtn = document.getElementById('slideshow-close');
    var dots = document.getElementById('slideshow-dots');

    prevBtn.onclick = function () { goToSlide(slideshowState.currentIndex - 1); };
    nextBtn.onclick = function () { goToSlide(slideshowState.currentIndex + 1); };
    closeBtn.onclick = closeSlideshow;

    dots.onclick = function (e) {
      var dot = e.target.closest('[data-dot-index]');
      if (dot) goToSlide(parseInt(dot.dataset.dotIndex, 10));
    };

    var modal = document.getElementById('slideshow-modal');
    slideshowMouseMoveHandler = showSlideshowUi;
    modal.addEventListener('mousemove', slideshowMouseMoveHandler);

    slideshowKeyHandler = function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        hideSlideshowUi();
        goToSlide(slideshowState.currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        hideSlideshowUi();
        goToSlide(slideshowState.currentIndex - 1);
      } else if (e.key === 'Escape') {
        closeSlideshow();
      }
    };
    document.addEventListener('keydown', slideshowKeyHandler);

    slideshowResizeHandler = function () {
      var stage = document.getElementById('slideshow-stage');
      scaleSlideshowSlides(stage);
    };
    window.addEventListener('resize', slideshowResizeHandler);
  }

  function unbindSlideshowEvents() {
    if (slideshowKeyHandler) {
      document.removeEventListener('keydown', slideshowKeyHandler);
      slideshowKeyHandler = null;
    }
    if (slideshowResizeHandler) {
      window.removeEventListener('resize', slideshowResizeHandler);
      slideshowResizeHandler = null;
    }
    if (slideshowMouseMoveHandler) {
      var modal = document.getElementById('slideshow-modal');
      if (modal) modal.removeEventListener('mousemove', slideshowMouseMoveHandler);
      slideshowMouseMoveHandler = null;
    }
    hideSlideshowUi();
  }

  /* -----------------------------------------------------------------------
     Expose
     ----------------------------------------------------------------------- */
  window.PreviewRenderer = {
    renderLivePreview: renderLivePreview,
    calculateScale: calculateScale,
    openSlideshow: openSlideshow,
    closeSlideshow: closeSlideshow,
    SLIDE_W: SLIDE_W,
    SLIDE_H: SLIDE_H
  };

})();
