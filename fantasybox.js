(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    const api = factory();
    root.FantasyBox = api;
    root.Lightbox = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  "use strict";

  const DEFAULTS = {
    startIndex: 0,
    loop: true,
    keyboard: true,
    closeOnBackdrop: true,
    closeOnEscape: true,
    showCaption: true,
    showCounter: true,
    showThumbnails: true,
    wheelZoom: true,
    dragToPan: true,
    touchZoom: true,
    doubleTapZoom: true,
    showDownloadButton: true,
    showFullscreenButton: true,
    showSlideshowButton: true,
    hash: true,
    idle: true,
    idleDelay: 2500,
    zoomStep: 0.25,
    minZoom: 1,
    maxZoom: 4,
    preload: 1,
    slideshowDelay: 3000,
    labels: {
      dialog: "Media viewer",
      close: "Close",
      previous: "Previous",
      next: "Next",
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      download: "Download",
      fullscreen: "Fullscreen",
      exitFullscreen: "Exit fullscreen",
      startSlideshow: "Start slideshow",
      stopSlideshow: "Stop slideshow",
      loading: "Loading",
    },
    on: {},
  };

  const IMAGE_EXT_RE = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)(\?.*)?$/i;
  const VIDEO_EXT_RE = /\.(mp4|m4v|mov|ogv|ogg|webm)(\?.*)?$/i;
  const EMBED_HOST_RE = /youtube\.com|youtu\.be|vimeo\.com/i;
  const SLIDE_ANIMATION_MS = 240;
  let instanceCounter = 0;

  const isPlainObject = value => Object.prototype.toString.call(value) === "[object Object]";

  const mergeOptions = (base = {}, extra = {}) => {
    const output = Array.isArray(base) ? [...base] : {};

    Object.keys(base).forEach(key => {
      const value = base[key];
      if (isPlainObject(value)) {
        output[key] = mergeOptions(value, {});
      } else if (Array.isArray(value)) {
        output[key] = [...value];
      } else {
        output[key] = value;
      }
    });

    Object.keys(extra || {}).forEach(key => {
      const value = extra[key];
      if (isPlainObject(value) && isPlainObject(output[key])) {
        output[key] = mergeOptions(output[key], value);
      } else if (Array.isArray(value)) {
        output[key] = [...value];
      } else {
        output[key] = value;
      }
    });

    return output;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const getDistance = (pointA, pointB) => {
    const deltaX = pointA.x - pointB.x;
    const deltaY = pointA.y - pointB.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  };

  const getMidpoint = (pointA, pointB) => ({
    x: (pointA.x + pointB.x) / 2,
    y: (pointA.y + pointB.y) / 2,
  });

  const sanitizeHtml = text =>
    String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getMatchValue = match => (match && match[1] ? match[1] : "");

  const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

  const canUseFullscreen = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

  const requestElementFullscreen = element => {
    if (!element) {
      return null;
    }

    const request = element.requestFullscreen || element.webkitRequestFullscreen;
    return typeof request === "function" ? request.call(element) : null;
  };

  const exitDocumentFullscreen = () => {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    return typeof exit === "function" ? exit.call(document) : null;
  };

  const parseYouTube = url => {
    const match =
      url.match(/[?&]v=([^&#]+)/i) ||
      url.match(/youtu\.be\/([^?&#/]+)/i) ||
      url.match(/youtube\.com\/shorts\/([^?&#/]+)/i) ||
      url.match(/youtube\.com\/embed\/([^?&#/]+)/i);

    const videoId = getMatchValue(match);
    return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : null;
  };

  const parseVimeo = url => {
    const match =
      url.match(/vimeo\.com\/(?:video\/)?(\d+)/i) ||
      url.match(/player\.vimeo\.com\/video\/(\d+)/i);

    const videoId = getMatchValue(match);
    return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
  };

  const detectType = item => {
    const explicit = item.type;
    const src = item.src || "";

    if (explicit) {
      return explicit;
    }

    if (typeof item.html === "string" && item.html.trim()) {
      return "html";
    }

    if (IMAGE_EXT_RE.test(src)) {
      return "image";
    }

    if (VIDEO_EXT_RE.test(src)) {
      return "video";
    }

    if (EMBED_HOST_RE.test(src)) {
      return "embed";
    }

    if (/^#/.test(src)) {
      return "inline";
    }

    return "image";
  };

  const toEmbedUrl = src => parseYouTube(src) || parseVimeo(src) || src;

  const normalizeItem = (input, index) => {
    const item = typeof input === "string" ? { src: input } : mergeOptions({}, input || {});

    item.index = index;
    item.type = detectType(item);
    item.caption = item.caption || "";
    item.thumb = item.thumb || "";
    item.alt = item.alt || item.caption || `Media ${index + 1}`;
    item.poster = item.poster || "";
    item.width = item.width || "";
    item.height = item.height || "";
    item.downloadSrc = item.downloadSrc || item.src || "";

    if (item.type === "embed") {
      item.embedSrc = toEmbedUrl(item.src);
      item.provider = /youtu/i.test(item.src) ? "youtube" : /vimeo/i.test(item.src) ? "vimeo" : "embed";
    }

    return item;
  };

  const extractItemFromNode = node => {
    const href = node.getAttribute("href") || "";
    const source = node.getAttribute("data-src") || href || node.getAttribute("src") || "";
    const image = node.querySelector("img");
    const caption =
      node.getAttribute("data-caption") ||
      node.getAttribute("title") ||
      node.getAttribute("aria-label") ||
      (image ? image.getAttribute("alt") : "") ||
      (image ? image.getAttribute("title") : "") ||
      "";

    return {
      src: source,
      type: node.getAttribute("data-type") || "",
      caption,
      thumb: node.getAttribute("data-thumb") || (image ? image.currentSrc : "") || (image ? image.getAttribute("src") : "") || "",
      alt: node.getAttribute("data-alt") || (image ? image.getAttribute("alt") : "") || caption,
      poster: node.getAttribute("data-poster") || "",
      html: node.getAttribute("data-html") || "",
      downloadSrc: node.getAttribute("data-download-src") || "",
      width: node.getAttribute("data-width") || "",
      height: node.getAttribute("data-height") || "",
    };
  };

  const createElement = (tagName, className = "", attrs = {}) => {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    Object.entries(attrs).forEach(([key, value]) => {
      if (value != null) {
        element.setAttribute(key, value);
      }
    });

    return element;
  };

  const getFocusable = root =>
    Array.from(
      root.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );

  const slugifyHashGroup = value =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const parseHashState = rawHash => {
    if (!rawHash || !rawHash.startsWith("fbx=")) {
      return null;
    }

    const token = decodeURIComponent(rawHash.slice(4));
    const separatorIndex = token.lastIndexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    const group = token.slice(0, separatorIndex);
    const index = Number(token.slice(separatorIndex + 1));

    if (!group || !Number.isFinite(index)) {
      return null;
    }

    return { group, index };
  };

  class FantasyBoxCore {
    constructor(items, options) {
      this.id = `fantasybox-${++instanceCounter}`;
      this.options = mergeOptions(DEFAULTS, options || {});
      this.items = (items || []).map(normalizeItem);
      this.index = clamp(this.options.startIndex || 0, 0, Math.max(this.items.length - 1, 0));
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.pointerStartX = 0;
      this.pointerStartY = 0;
      this.startPanX = 0;
      this.startPanY = 0;
      this.swipeDeltaX = 0;
      this.dragMode = "";
      this.isOpen = false;
      this.eventsBound = false;
      this.isIdle = false;
      this.idleTimer = 0;
      this.pointerCache = new Map();
      this.pointerStartSnapshot = null;
      this.pinchDistanceStart = 0;
      this.pinchZoomStart = 1;
      this.lastTapAt = 0;
      this.lastTapPoint = null;
      this.slideshowTimer = 0;
      this.isSlideshowRunning = false;
      this.eventListeners = new Map();
      this.hashState = {
        enabled: !!this.options.hash,
        previous: "",
        group: typeof this.options.hash === "string" ? slugifyHashGroup(this.options.hash) : this.options.hashGroup || "",
      };
      this.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.imageCache = [];
      this.boundHandlers = {};
      this.dom = {};

      if (!this.items.length) {
        throw new Error("FantasyBox requires at least one media item.");
      }

      this.initOptionEvents();
    }

    initOptionEvents() {
      Object.entries(this.options.on || {}).forEach(([eventName, handler]) => {
        if (typeof handler === "function") {
          this.on(eventName, handler);
        }
      });
    }

    on(eventName, handler) {
      if (!eventName || typeof handler !== "function") {
        return this;
      }

      const handlers = this.eventListeners.get(eventName) || [];
      handlers.push(handler);
      this.eventListeners.set(eventName, handlers);
      return this;
    }

    off(eventName, handler) {
      if (!eventName || !this.eventListeners.has(eventName)) {
        return this;
      }

      if (!handler) {
        this.eventListeners.set(eventName, []);
        return this;
      }

      this.eventListeners.set(
        eventName,
        this.eventListeners.get(eventName).filter(cb => cb !== handler)
      );
      return this;
    }

    emit(eventName, payload = {}) {
      const handlers = this.eventListeners.get(eventName) || [];

      handlers.slice().forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          setTimeout(() => {
            throw error;
          }, 0);
        }
      });

      return this;
    }

    createPayload(extra = {}) {
      return {
        instance: this,
        item: this.getCurrentItem(),
        index: this.index,
        ...extra,
      };
    }

    getHashToken() {
      if (!this.hashState.group) {
        return "";
      }

      return `fbx=${encodeURIComponent(`${this.hashState.group}:${this.index}`)}`;
    }

    updateHash(push = false) {
      if (!this.hashState.enabled || FantasyBox.getTopInstance() !== this) {
        return;
      }

      const token = this.getHashToken();
      if (!token) {
        return;
      }

      const currentHash = FantasyBox.readHash();
      FantasyBox.writeHash(token, push && currentHash !== token);
    }

    restoreHash() {
      if (!this.hashState.enabled) {
        return;
      }

      FantasyBox.writeHash(this.hashState.previous, false);
    }

    enterIdle() {
      if (!this.options.idle || this.isIdle || !this.isOpen) {
        return;
      }

      this.isIdle = true;
      if (this.dom.root) {
        this.dom.root.classList.add("is-idle");
      }
      this.emit("idleStart", this.createPayload());
    }

    exitIdle() {
      if (!this.isIdle) {
        return;
      }

      this.isIdle = false;
      if (this.dom.root) {
        this.dom.root.classList.remove("is-idle");
      }
      this.emit("idleEnd", this.createPayload());
    }

    stopIdleTimer() {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = 0;
      this.exitIdle();
    }

    resetIdleTimer() {
      if (!this.options.idle || !this.isOpen || FantasyBox.getTopInstance() !== this) {
        return;
      }

      this.exitIdle();
      window.clearTimeout(this.idleTimer);
      this.idleTimer = window.setTimeout(() => this.enterIdle(), this.options.idleDelay);
    }

    markActive() {
      if (!this.options.idle || !this.isOpen) {
        return;
      }

      this.resetIdleTimer();
    }

    build() {
      if (this.dom.root) {
        return;
      }

      const { labels } = this.options;
      const root = createElement("div", "fantasybox", {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": labels.dialog,
      });
      const scrim = createElement("div", "fantasybox__scrim", { "data-fb-action": "backdrop" });
      const panel = createElement("div", "fantasybox__panel", { tabindex: "-1" });
      const toolbar = createElement("div", "fantasybox__toolbar");
      const zoomGroup = createElement("div", "fantasybox__toolgroup fantasybox__toolgroup--zoom");
      const actionGroup = createElement("div", "fantasybox__toolgroup fantasybox__toolgroup--actions");
      const meta = createElement("div", "fantasybox__meta");
      const caption = createElement("div", "fantasybox__caption");
      const counter = createElement("div", "fantasybox__counter");
      const stage = createElement("div", "fantasybox__stage");
      const prev = createElement("button", "fantasybox__nav fantasybox__nav--prev", {
        type: "button",
        "data-fb-action": "prev",
        "aria-label": labels.previous,
      });
      const next = createElement("button", "fantasybox__nav fantasybox__nav--next", {
        type: "button",
        "data-fb-action": "next",
        "aria-label": labels.next,
      });
      const viewport = createElement("div", "fantasybox__viewport");
      const frame = createElement("div", "fantasybox__frame");
      const loading = createElement("div", "fantasybox__loading", { "aria-live": "polite" });
      const thumbs = createElement("div", "fantasybox__thumbs");
      const closeButton = createElement("button", "fantasybox__button", {
        type: "button",
        "data-fb-action": "close",
        "aria-label": labels.close,
      });
      const zoomInButton = createElement("button", "fantasybox__button", {
        type: "button",
        "data-fb-action": "zoom-in",
        "aria-label": labels.zoomIn,
      });
      const zoomOutButton = createElement("button", "fantasybox__button", {
        type: "button",
        "data-fb-action": "zoom-out",
        "aria-label": labels.zoomOut,
      });
      const slideshowButton = createElement("button", "fantasybox__button", {
        type: "button",
        "data-fb-action": "slideshow",
        "aria-label": labels.startSlideshow,
      });
      const fullscreenButton = createElement("button", "fantasybox__button", {
        type: "button",
        "data-fb-action": "fullscreen",
        "aria-label": labels.fullscreen,
      });
      const downloadButton = createElement("button", "fantasybox__button", {
        type: "button",
        "data-fb-action": "download",
        "aria-label": labels.download,
      });

      closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
      zoomInButton.innerHTML = '<span aria-hidden="true">+</span>';
      zoomOutButton.innerHTML = '<span aria-hidden="true">-</span>';
      slideshowButton.innerHTML = '<span aria-hidden="true">&#9654;</span>';
      fullscreenButton.innerHTML = '<span aria-hidden="true">&#9974;</span>';
      downloadButton.innerHTML = '<span aria-hidden="true">&#8681;</span>';
      prev.innerHTML = '<span aria-hidden="true">&#10094;</span>';
      next.innerHTML = '<span aria-hidden="true">&#10095;</span>';
      loading.textContent = labels.loading;

      meta.append(caption, counter);
      zoomGroup.append(zoomOutButton, zoomInButton);
      actionGroup.append(slideshowButton, fullscreenButton, downloadButton);
      toolbar.append(meta, zoomGroup, actionGroup, closeButton);
      viewport.append(frame, loading);
      stage.append(prev, viewport, next);
      panel.append(toolbar, stage, thumbs);
      root.append(scrim, panel);

      this.dom = {
        root,
        scrim,
        panel,
        toolbar,
        caption,
        counter,
        stage,
        viewport,
        frame,
        loading,
        prev,
        next,
        thumbs,
        closeButton,
        zoomInButton,
        zoomOutButton,
        slideshowButton,
        fullscreenButton,
        downloadButton,
        image: null,
      };

      this.renderThumbs();
    }

    bindEvents() {
      if (this.eventsBound) {
        return;
      }

      this.boundHandlers.onClick = event => {
        this.markActive();
        const button = event.target.closest("[data-fb-action]");
        if (!button) {
          return;
        }

        const action = button.getAttribute("data-fb-action");
        if (action === "backdrop") {
          if (this.options.closeOnBackdrop) {
            this.close();
          }
          return;
        }

        event.preventDefault();

        if (action === "close") {
          this.close();
        } else if (action === "prev") {
          this.prev();
        } else if (action === "next") {
          this.next();
        } else if (action === "zoom-in") {
          this.adjustZoom(this.zoom + this.options.zoomStep);
        } else if (action === "zoom-out") {
          this.adjustZoom(this.zoom - this.options.zoomStep);
        } else if (action === "slideshow") {
          this.toggleSlideshow();
        } else if (action === "fullscreen") {
          this.toggleFullscreen();
        } else if (action === "download") {
          this.downloadCurrent();
        }
      };

      this.boundHandlers.onKeyDown = event => {
        if (!this.isOpen || !this.options.keyboard || FantasyBox.getTopInstance() !== this) {
          return;
        }

        this.markActive();

        if (event.key === "Escape" && this.options.closeOnEscape) {
          event.preventDefault();
          this.close();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          this.prev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          this.next();
        } else if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          this.adjustZoom(this.zoom + this.options.zoomStep);
        } else if (event.key === "-") {
          event.preventDefault();
          this.adjustZoom(this.zoom - this.options.zoomStep);
        } else if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          this.toggleFullscreen();
        } else if (event.key === " ") {
          event.preventDefault();
          this.toggleSlideshow();
        } else if (event.key === "Tab") {
          this.maintainFocus(event);
        }
      };

      this.boundHandlers.onWheel = event => {
        const item = this.getCurrentItem();
        if (!this.isOpen || !this.options.wheelZoom || !item || item.type !== "image") {
          return;
        }

        this.markActive();
        event.preventDefault();
        this.adjustZoom(this.zoom + (event.deltaY < 0 ? this.options.zoomStep : -this.options.zoomStep));
      };

      this.boundHandlers.onPointerDown = event => {
        const item = this.getCurrentItem();
        if (!item) {
          return;
        }

        this.markActive();
        this.pointerCache.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
          pointerType: event.pointerType || "",
        });

        if (item.type === "image" && this.options.touchZoom && this.pointerCache.size === 2) {
          const [firstPointer, secondPointer] = [...this.pointerCache.values()];
          const midpoint = getMidpoint(firstPointer, secondPointer);

          this.dragMode = "pinch";
          this.pinchDistanceStart = getDistance(firstPointer, secondPointer);
          this.pinchZoomStart = this.zoom;
          this.pointerStartSnapshot = {
            panX: this.panX,
            panY: this.panY,
            midpointX: midpoint.x,
            midpointY: midpoint.y,
          };
          this.dom.viewport.classList.add("is-dragging");
          return;
        }

        this.dragMode = item.type === "image" && this.zoom > 1 && this.options.dragToPan ? "pan" : "swipe";
        this.pointerStartX = event.clientX;
        this.pointerStartY = event.clientY;
        this.startPanX = this.panX;
        this.startPanY = this.panY;
        this.swipeDeltaX = 0;
        this.dom.viewport.setPointerCapture(event.pointerId);
        this.dom.viewport.classList.add("is-dragging");
      };

      this.boundHandlers.onPointerMove = event => {
        if (this.pointerCache.has(event.pointerId)) {
          this.pointerCache.set(event.pointerId, {
            ...this.pointerCache.get(event.pointerId),
            x: event.clientX,
            y: event.clientY,
          });
        }

        if (!this.dragMode) {
          if (event.pointerType !== "touch") {
            this.markActive();
          }
          return;
        }

        const deltaX = event.clientX - this.pointerStartX;
        const deltaY = event.clientY - this.pointerStartY;

        if (this.dragMode === "pinch") {
          const pointers = [...this.pointerCache.values()];
          if (pointers.length < 2 || !this.dom.image) {
            return;
          }

          const [pinchA, pinchB] = pointers;
          const midpoint = getMidpoint(pinchA, pinchB);
          const distance = getDistance(pinchA, pinchB);
          const ratio = this.pinchDistanceStart ? distance / this.pinchDistanceStart : 1;

          this.zoom = clamp(this.pinchZoomStart * ratio, this.options.minZoom, this.options.maxZoom);
          this.panX = this.pointerStartSnapshot.panX + (midpoint.x - this.pointerStartSnapshot.midpointX);
          this.panY = this.pointerStartSnapshot.panY + (midpoint.y - this.pointerStartSnapshot.midpointY);
          this.limitPan();
          this.applyImageTransform();
        } else if (this.dragMode === "pan") {
          this.panX = this.startPanX + deltaX;
          this.panY = this.startPanY + deltaY;
          this.limitPan();
          this.applyImageTransform();
        } else if (this.dragMode === "swipe") {
          this.swipeDeltaX = deltaX;
          this.updateSwipePreview(deltaX);
        }
      };

      this.boundHandlers.onPointerUp = event => {
        if (typeof this.dom.viewport.hasPointerCapture === "function" && this.dom.viewport.hasPointerCapture(event.pointerId)) {
          this.dom.viewport.releasePointerCapture(event.pointerId);
        }

        const pointerData = this.pointerCache.get(event.pointerId);
        const pointerCountBeforeDelete = this.pointerCache.size;
        this.pointerCache.delete(event.pointerId);

        if (!this.dragMode) {
          return;
        }

        if (this.dragMode === "swipe") {
          if (Math.abs(this.swipeDeltaX) > 60) {
            if (this.swipeDeltaX > 0) {
              this.prev({
                swipeOffset: this.swipeDeltaX,
                preparedSlide: this.getSwipePreviewSlide("prev"),
              });
            } else {
              this.next({
                swipeOffset: this.swipeDeltaX,
                preparedSlide: this.getSwipePreviewSlide("next"),
              });
            }
          } else {
            this.resetSwipePosition();
          }
        } else if (
          this.dragMode !== "pinch" &&
          pointerData &&
          pointerData.pointerType === "touch" &&
          this.options.doubleTapZoom &&
          this.getCurrentItem() &&
          this.getCurrentItem().type === "image"
        ) {
          const now = Date.now();
          const tapPoint = { x: event.clientX, y: event.clientY };
          const isDoubleTap =
            this.lastTapAt &&
            now - this.lastTapAt < 280 &&
            this.lastTapPoint &&
            getDistance(this.lastTapPoint, tapPoint) < 24;

          if (isDoubleTap) {
            this.adjustZoom(this.zoom > 1 ? 1 : Math.min(2, this.options.maxZoom));
            this.lastTapAt = 0;
            this.lastTapPoint = null;
          } else {
            this.lastTapAt = now;
            this.lastTapPoint = tapPoint;
          }
        }

        if (this.dragMode === "pinch" && pointerCountBeforeDelete > 1 && this.pointerCache.size === 1) {
          const [remainingPointer] = this.pointerCache.values();
          this.dragMode = this.zoom > 1 ? "pan" : "";
          this.pointerStartX = remainingPointer.x;
          this.pointerStartY = remainingPointer.y;
          this.startPanX = this.panX;
          this.startPanY = this.panY;
          if (this.dragMode) {
            return;
          }
        }

        this.dragMode = "";
        this.swipeDeltaX = 0;
        this.dom.viewport.classList.remove("is-dragging");
      };

      this.boundHandlers.onDoubleClick = () => {
        const item = this.getCurrentItem();
        if (!item || item.type !== "image") {
          return;
        }

        this.markActive();
        this.adjustZoom(this.zoom > 1 ? 1 : Math.min(2, this.options.maxZoom));
      };

      this.boundHandlers.onResize = () => {
        this.limitPan();
        this.applyImageTransform();
      };

      this.boundHandlers.onFullscreenChange = () => {
        this.updateToolbarState();
        this.emit("fullscreenChange", this.createPayload({
          active: getFullscreenElement() === this.dom.root || getFullscreenElement() === this.dom.panel,
        }));
      };

      this.boundHandlers.onActivity = () => {
        if (FantasyBox.getTopInstance() === this) {
          this.markActive();
        }
      };

      this.dom.root.addEventListener("click", this.boundHandlers.onClick);
      this.dom.root.addEventListener("mousemove", this.boundHandlers.onActivity);
      this.dom.root.addEventListener("focusin", this.boundHandlers.onActivity);
      this.dom.viewport.addEventListener("wheel", this.boundHandlers.onWheel, { passive: false });
      this.dom.viewport.addEventListener("pointerdown", this.boundHandlers.onPointerDown);
      this.dom.viewport.addEventListener("pointermove", this.boundHandlers.onPointerMove);
      this.dom.viewport.addEventListener("pointerup", this.boundHandlers.onPointerUp);
      this.dom.viewport.addEventListener("pointercancel", this.boundHandlers.onPointerUp);
      this.dom.viewport.addEventListener("dblclick", this.boundHandlers.onDoubleClick);
      window.addEventListener("resize", this.boundHandlers.onResize);
      document.addEventListener("keydown", this.boundHandlers.onKeyDown);
      document.addEventListener("fullscreenchange", this.boundHandlers.onFullscreenChange);
      this.eventsBound = true;
    }

    unbindEvents() {
      if (!this.dom.root || !this.eventsBound) {
        return;
      }

      this.dom.root.removeEventListener("click", this.boundHandlers.onClick);
      this.dom.root.removeEventListener("mousemove", this.boundHandlers.onActivity);
      this.dom.root.removeEventListener("focusin", this.boundHandlers.onActivity);
      this.dom.viewport.removeEventListener("wheel", this.boundHandlers.onWheel);
      this.dom.viewport.removeEventListener("pointerdown", this.boundHandlers.onPointerDown);
      this.dom.viewport.removeEventListener("pointermove", this.boundHandlers.onPointerMove);
      this.dom.viewport.removeEventListener("pointerup", this.boundHandlers.onPointerUp);
      this.dom.viewport.removeEventListener("pointercancel", this.boundHandlers.onPointerUp);
      this.dom.viewport.removeEventListener("dblclick", this.boundHandlers.onDoubleClick);
      window.removeEventListener("resize", this.boundHandlers.onResize);
      document.removeEventListener("keydown", this.boundHandlers.onKeyDown);
      document.removeEventListener("fullscreenchange", this.boundHandlers.onFullscreenChange);
      this.eventsBound = false;
    }

    renderThumbs() {
      if (!this.options.showThumbnails || this.items.length < 2) {
        this.dom.thumbs.innerHTML = "";
        this.dom.thumbs.hidden = true;
        return;
      }

      this.dom.thumbs.hidden = false;
      this.dom.thumbs.innerHTML = "";

      this.items.forEach((item, itemIndex) => {
        const button = createElement("button", "fantasybox__thumb", {
          type: "button",
          "data-fb-index": String(itemIndex),
          "aria-label": `Go to item ${itemIndex + 1}`,
        });
        const thumbImage = item.thumb || (item.type === "image" ? item.src : item.poster);

        if (thumbImage) {
          button.innerHTML = `<img src="${sanitizeHtml(thumbImage)}" alt="${sanitizeHtml(item.alt)}" loading="lazy" />`;
        } else {
          button.textContent = String(itemIndex + 1);
        }

        button.addEventListener("click", () => this.goTo(itemIndex));
        this.dom.thumbs.appendChild(button);
      });
    }

    open() {
      this.emit("init", this.createPayload({ items: this.items }));
      this.build();
      this.bindEvents();
      this.isOpen = true;
      this.hashState.previous = this.getRestoredHash();

      document.body.appendChild(this.dom.root);
      FantasyBox.instances.push(this);
      FantasyBox.syncStack();
      this.dom.root.offsetHeight;
      this.dom.root.classList.add("is-open");
      this.updateHash(true);
      this.renderCurrent();
      this.dom.panel.focus();
      this.resetIdleTimer();
      this.emit("open", this.createPayload());
    }

    close(silent = false, context = {}) {
      if (!this.isOpen) {
        return;
      }

      this.emit("close", this.createPayload());
      this.isOpen = false;
      this.stopSlideshow();
      this.stopIdleTimer();
      this.unloadMedia();
      this.unbindEvents();
      this.dom.root.classList.remove("is-open", "is-idle");

      if (getFullscreenElement() === this.dom.root || getFullscreenElement() === this.dom.panel) {
        const exitResult = exitDocumentFullscreen();
        if (exitResult && typeof exitResult.catch === "function") {
          exitResult.catch(() => {});
        }
      }

      if (this.dom.root.parentNode) {
        this.dom.root.parentNode.removeChild(this.dom.root);
      }

      FantasyBox.instances = FantasyBox.instances.filter(instance => instance !== this);
      FantasyBox.syncStack();

      if (!context.skipHashRestore) {
        this.restoreHash();
      }

      if (!silent && this.lastFocused && typeof this.lastFocused.focus === "function") {
        this.lastFocused.focus();
      }
    }

    getRestoredHash() {
      const currentHash = FantasyBox.readHash();
      const currentState = parseHashState(currentHash);

      if (currentState && currentState.group === this.hashState.group) {
        return "";
      }

      return currentHash;
    }

    destroy() {
      this.emit("destroy", this.createPayload());
      this.close(true);
      this.eventListeners.clear();
      this.dom = {};
    }

    getCurrentItem() {
      return this.items[this.index] || null;
    }

    getActiveSlide() {
      return this.dom.frame ? this.dom.frame.querySelector(".fantasybox__slide.is-current") || null : null;
    }

    setSlideState(slide, { offset = 0, scale = 1, opacity = 1, immediate = false } = {}) {
      if (!slide) {
        return;
      }

      slide.style.transition = immediate ? "none" : "";
      slide.style.transform = `translate3d(${offset}px, 0, 0) scale(${scale})`;
      slide.style.opacity = String(opacity);
    }

    resetSwipePosition() {
      const activeSlide = this.getActiveSlide();
      if (!activeSlide) {
        return;
      }

      this.setSlideState(activeSlide, { offset: 0, scale: 1, opacity: 1, immediate: false });
      this.clearSwipeNeighbors(false);
    }

    createSlide() {
      return createElement("div", "fantasybox__slide");
    }

    canSwipe() {
      return this.items.length > 1;
    }

    getWrappedIndex(index) {
      if (!this.items.length) {
        return -1;
      }

      if (this.options.loop) {
        return (index + this.items.length) % this.items.length;
      }

      return index < 0 || index >= this.items.length ? -1 : index;
    }

    getNeighborIndex(index) {
      if (!this.canSwipe()) {
        return -1;
      }

      const wrappedIndex = this.getWrappedIndex(index);
      return wrappedIndex === this.index ? -1 : wrappedIndex;
    }

    getSwipePreviewSlide(side) {
      return this.dom.frame ? this.dom.frame.querySelector(`.fantasybox__slide--preview[data-side="${side}"]`) || null : null;
    }

    createPreviewSlide(item, side) {
      const slide = createElement("div", "fantasybox__slide fantasybox__slide--preview", { "data-side": side });

      if (item.type === "image") {
        const previewImage = createElement("img", "fantasybox__media fantasybox__media--image fantasybox__media--preview", {
          alt: item.alt || item.caption || "",
          draggable: "false",
          loading: "eager",
        });
        previewImage.src = item.src;
        slide.appendChild(previewImage);
      } else {
        const previewSrc = item.poster || item.thumb || "";

        if (previewSrc) {
          const previewImage = createElement("img", "fantasybox__media fantasybox__media--image fantasybox__media--preview", {
            alt: item.alt || item.caption || "",
            draggable: "false",
            loading: "eager",
          });
          previewImage.src = previewSrc;
          slide.appendChild(previewImage);
        } else {
          const fallback = createElement("div", "fantasybox__media fantasybox__media--html fantasybox__media--preview");
          fallback.innerHTML = `<div class="fantasybox__preview-label">${sanitizeHtml(item.caption || `Item ${item.index + 1}`)}</div>`;
          slide.appendChild(fallback);
        }
      }

      this.dom.frame.appendChild(slide);
      return slide;
    }

    ensureSwipeNeighbors() {
      const previousIndex = this.getNeighborIndex(this.index - 1);
      const nextIndex = this.getNeighborIndex(this.index + 1);

      if (previousIndex !== -1 && !this.getSwipePreviewSlide("prev")) {
        this.createPreviewSlide(this.items[previousIndex], "prev");
      }

      if (nextIndex !== -1 && !this.getSwipePreviewSlide("next")) {
        this.createPreviewSlide(this.items[nextIndex], "next");
      }
    }

    clearSwipeNeighbors(immediate = true) {
      const previousSlide = this.getSwipePreviewSlide("prev");
      const nextSlide = this.getSwipePreviewSlide("next");
      const frameWidth = this.dom.viewport.clientWidth || this.dom.frame.clientWidth || 1;
      const remove = slide => {
        this.unloadMedia(slide);
        slide.remove();
      };

      [previousSlide, nextSlide].forEach((slide, index) => {
        if (!slide) {
          return;
        }

        if (immediate) {
          remove(slide);
          return;
        }

        const direction = index === 0 ? -1 : 1;
        this.setSlideState(slide, {
          offset: direction * (frameWidth - Math.min(96, frameWidth * 0.16)),
          scale: 0.98,
          opacity: 0,
          immediate: false,
        });
        window.setTimeout(() => remove(slide), SLIDE_ANIMATION_MS);
      });
    }

    updateSwipePreview(deltaX) {
      const activeSlide = this.getActiveSlide();
      if (!activeSlide || !this.canSwipe()) {
        return;
      }

      this.ensureSwipeNeighbors();

      const frameWidth = this.dom.viewport.clientWidth || this.dom.frame.clientWidth || 1;
      const peek = Math.min(96, frameWidth * 0.16);
      const previewBaseOffset = frameWidth - peek;
      const progress = clamp(Math.abs(deltaX) / frameWidth, 0, 1);
      const currentScale = 1 - progress * 0.035;
      const currentOpacity = 1 - progress * 0.28;
      const previousSlide = this.getSwipePreviewSlide("prev");
      const nextSlide = this.getSwipePreviewSlide("next");

      this.setSlideState(activeSlide, {
        offset: deltaX,
        scale: currentScale,
        opacity: currentOpacity,
        immediate: true,
      });

      if (previousSlide) {
        const previousProgress = deltaX > 0 ? progress : 0;
        this.setSlideState(previousSlide, {
          offset: deltaX - previewBaseOffset,
          scale: 0.98 + previousProgress * 0.02,
          opacity: 0.18 + previousProgress * 0.82,
          immediate: true,
        });
      }

      if (nextSlide) {
        const nextProgress = deltaX < 0 ? progress : 0;
        this.setSlideState(nextSlide, {
          offset: deltaX + previewBaseOffset,
          scale: 0.98 + nextProgress * 0.02,
          opacity: 0.18 + nextProgress * 0.82,
          immediate: true,
        });
      }
    }

    clearFrame() {
      this.unloadMedia(this.dom.frame);
      this.dom.frame.innerHTML = "";
    }

    animateSlideTransition(nextSlide, { direction, swipeOffset = 0 }) {
      const currentSlide = this.getActiveSlide();

      if (!currentSlide) {
        nextSlide.classList.add("is-current");
        this.dom.frame.appendChild(nextSlide);
        return;
      }

      const frameWidth = this.dom.viewport.clientWidth || this.dom.frame.clientWidth || 1;
      const enteringOffset = frameWidth * direction + swipeOffset;
      const leavingOffset = swipeOffset - frameWidth * direction;
      const previewSide = direction < 0 ? "prev" : "next";
      const reuseSwipePreview =
        nextSlide &&
        nextSlide.parentNode === this.dom.frame &&
        nextSlide.classList.contains("fantasybox__slide--preview") &&
        nextSlide.getAttribute("data-side") === previewSide;

      if (reuseSwipePreview) {
        const oppositePreview = this.getSwipePreviewSlide(previewSide === "prev" ? "next" : "prev");
        if (oppositePreview) {
          this.unloadMedia(oppositePreview);
          oppositePreview.remove();
        }

        nextSlide.classList.remove("fantasybox__slide--preview");
        nextSlide.removeAttribute("data-side");
        const previewMedia = nextSlide.querySelector(".fantasybox__media--preview");
        if (previewMedia) {
          previewMedia.classList.remove("fantasybox__media--preview");
        }
      } else {
        this.clearSwipeNeighbors(true);
      }

      currentSlide.classList.remove("is-current");
      currentSlide.classList.add("is-leaving");
      nextSlide.classList.add("is-current", "is-entering");

      if (nextSlide.parentNode !== this.dom.frame) {
        this.dom.frame.appendChild(nextSlide);
      }

      if (!reuseSwipePreview) {
        this.setSlideState(currentSlide, {
          offset: swipeOffset,
          scale: 0.97,
          opacity: 0.78,
          immediate: true,
        });
        this.setSlideState(nextSlide, {
          offset: enteringOffset,
          scale: 0.97,
          opacity: 0.65,
          immediate: true,
        });
      }

      requestAnimationFrame(() => {
        this.setSlideState(currentSlide, {
          offset: leavingOffset,
          scale: 0.95,
          opacity: 0.18,
          immediate: false,
        });
        this.setSlideState(nextSlide, {
          offset: 0,
          scale: 1,
          opacity: 1,
          immediate: false,
        });
      });

      window.setTimeout(() => {
        this.unloadMedia(currentSlide);
        currentSlide.remove();
        nextSlide.classList.remove("is-entering");
      }, SLIDE_ANIMATION_MS);
    }

    goTo(nextIndex, transitionOptions = {}) {
      if (!this.items.length) {
        return;
      }

      if (this.options.loop) {
        if (nextIndex < 0) {
          nextIndex = this.items.length - 1;
        } else if (nextIndex >= this.items.length) {
          nextIndex = 0;
        }
      } else {
        nextIndex = clamp(nextIndex, 0, this.items.length - 1);
      }

      if (nextIndex === this.index) {
        if (transitionOptions.swipeOffset || transitionOptions.preparedSlide) {
          this.resetSwipePosition();
        }
        return;
      }

      const previousIndex = this.index;
      this.index = nextIndex;
      this.updateHash(false);
      this.renderCurrent({
        animate: true,
        direction: transitionOptions.direction || (nextIndex > previousIndex ? 1 : -1),
        swipeOffset: transitionOptions.swipeOffset || 0,
      });
      this.scheduleSlideshow();
      this.resetIdleTimer();
      this.emit("change", this.createPayload({ previousIndex }));
    }

    prev(transitionOptions = {}) {
      this.goTo(this.index - 1, { direction: -1, ...transitionOptions });
    }

    next(transitionOptions = {}) {
      this.goTo(this.index + 1, { direction: 1, ...transitionOptions });
    }

    unloadMedia(root = this.dom.frame) {
      if (!root) {
        return;
      }

      root.querySelectorAll("video").forEach(video => {
        try {
          video.pause();
        } catch (error) {
          error;
        }
      });

      root.querySelectorAll("iframe").forEach(frame => {
        frame.setAttribute("src", "about:blank");
      });
    }

    finalizeLoaded(item) {
      this.dom.loading.hidden = true;
      this.resetIdleTimer();
      this.emit("loaded", this.createPayload({ item }));
    }

    renderCurrent(transitionOptions = {}) {
      const item = this.getCurrentItem();
      if (!item) {
        return;
      }

      this.dom.loading.hidden = false;
      this.dom.frame.classList.remove("is-error");
      this.emit("loading", this.createPayload({ item }));
      this.resetZoom();
      this.updateMeta(item);
      this.updateNavigation();
      this.updateThumbState();
      this.updateZoomControls(item);
      this.updateToolbarState();

      const slide = transitionOptions.preparedSlide || this.createSlide();

      if (!transitionOptions.animate) {
        this.clearFrame();
        slide.classList.add("is-current");
        this.dom.frame.appendChild(slide);
      } else {
        this.animateSlideTransition(slide, transitionOptions);
      }

      if (item.type === "image") {
        const handleImageLoad = () => {
          this.limitPan();
          this.preloadAround();
          this.finalizeLoaded(item);
        };
        const handleImageError = () => {
          this.renderError("Unable to load image.");
        };
        let content = transitionOptions.preparedSlide
          ? slide.querySelector(".fantasybox__media--image")
          : null;

        if (!content) {
          content = createElement("img", "fantasybox__media fantasybox__media--image", {
            alt: item.alt,
            draggable: "false",
          });
          content.src = item.src;
          slide.appendChild(content);
        } else {
          content.alt = item.alt;
          content.classList.remove("fantasybox__media--preview");
        }

        content.addEventListener("load", handleImageLoad, { once: true });
        content.addEventListener("error", handleImageError, { once: true });

        if (content.complete) {
          if (content.naturalWidth > 0) {
            handleImageLoad();
          } else {
            handleImageError();
          }
        }

        this.dom.image = content;
        return;
      }

      if (item.type === "video") {
        const content = createElement("video", "fantasybox__media fantasybox__media--video", {
          controls: "true",
          playsinline: "true",
          preload: "metadata",
        });
        if (item.poster) {
          content.setAttribute("poster", item.poster);
        }
        content.addEventListener("loadeddata", () => this.finalizeLoaded(item));
        content.addEventListener("error", () => this.renderError("Unable to load video."));
        content.src = item.src;
        slide.appendChild(content);
        this.dom.image = null;
        return;
      }

      if (item.type === "embed" || item.type === "iframe") {
        const content = createElement("iframe", "fantasybox__media fantasybox__media--frame", {
          allow: "autoplay; fullscreen; picture-in-picture",
          allowfullscreen: "true",
          loading: "eager",
          referrerpolicy: "strict-origin-when-cross-origin",
        });
        content.addEventListener("load", () => this.finalizeLoaded(item));
        content.src = item.type === "embed" ? item.embedSrc : item.src;
        slide.appendChild(content);
        this.dom.image = null;
        return;
      }

      if (item.type === "ajax") {
        const content = createElement("div", "fantasybox__media fantasybox__media--html");
        slide.appendChild(content);
        this.dom.image = null;
        fetch(item.src, { credentials: "same-origin" })
          .then(response => {
            if (!response.ok) {
              throw new Error("Bad response");
            }
            return response.text();
          })
          .then(html => {
            if (!this.isOpen || this.getCurrentItem() !== item) {
              return;
            }
            content.innerHTML = html;
            this.finalizeLoaded(item);
          })
          .catch(() => {
            this.renderError("Unable to load Ajax content.");
          });
        return;
      }

      if (item.type === "inline") {
        const content = createElement("div", "fantasybox__media fantasybox__media--html");
        const source = document.querySelector(item.src);

        if (!source) {
          this.renderError("Inline content not found.");
          return;
        }

        content.innerHTML = source.innerHTML;
        slide.appendChild(content);
        this.dom.image = null;
        this.finalizeLoaded(item);
        return;
      }

      if (item.type === "html") {
        const content = createElement("div", "fantasybox__media fantasybox__media--html");
        content.innerHTML = item.html;
        slide.appendChild(content);
        this.dom.image = null;
        this.finalizeLoaded(item);
        return;
      }

      this.renderError("Unsupported media type.");
    }

    renderError(message) {
      this.dom.loading.hidden = true;
      this.clearFrame();
      this.dom.frame.classList.add("is-error");
      this.dom.frame.innerHTML = `<div class="fantasybox__error">${sanitizeHtml(message || "Unable to open content.")}</div>`;
      this.dom.image = null;
      this.emit("error", this.createPayload({ message: message || "Unable to open content." }));
    }

    updateMeta(item) {
      this.dom.caption.innerHTML = this.options.showCaption ? sanitizeHtml(item.caption || "") : "";
      this.dom.caption.hidden = !this.options.showCaption || !item.caption;
      this.dom.counter.textContent = this.options.showCounter ? `${this.index + 1} / ${this.items.length}` : "";
      this.dom.counter.hidden = !this.options.showCounter;
    }

    updateNavigation() {
      const disablePrev = !this.options.loop && this.index <= 0;
      const disableNext = !this.options.loop && this.index >= this.items.length - 1;
      const multiple = this.items.length > 1;

      this.dom.prev.hidden = !multiple;
      this.dom.next.hidden = !multiple;
      this.dom.prev.disabled = disablePrev;
      this.dom.next.disabled = disableNext;
    }

    updateThumbState() {
      this.dom.thumbs.querySelectorAll("[data-fb-index]").forEach(button => {
        const isActive = Number(button.getAttribute("data-fb-index")) === this.index;
        button.classList.toggle("is-active", isActive);
        if (isActive) {
          button.setAttribute("aria-current", "true");
          button.scrollIntoView({ block: "nearest", inline: "center" });
        } else {
          button.removeAttribute("aria-current");
        }
      });
    }

    resetZoom() {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.applyImageTransform();
    }

    updateZoomControls(item) {
      const canZoom = !!item && item.type === "image";
      this.dom.zoomInButton.disabled = !canZoom || this.zoom >= this.options.maxZoom;
      this.dom.zoomOutButton.disabled = !canZoom || this.zoom <= this.options.minZoom;
    }

    updateToolbarState() {
      const item = this.getCurrentItem();
      const { labels } = this.options;
      const hasDownload = !!(item && item.downloadSrc);
      const canSlideshow = this.items.length > 1;
      const fullscreenElement = getFullscreenElement();
      const isFullscreen = fullscreenElement === this.dom.root || fullscreenElement === this.dom.panel;

      this.dom.downloadButton.hidden = !this.options.showDownloadButton;
      this.dom.fullscreenButton.hidden = !this.options.showFullscreenButton;
      this.dom.slideshowButton.hidden = !this.options.showSlideshowButton;
      this.dom.downloadButton.disabled = !hasDownload;
      this.dom.slideshowButton.disabled = !canSlideshow;
      this.dom.slideshowButton.classList.toggle("is-active", this.isSlideshowRunning);
      this.dom.fullscreenButton.classList.toggle("is-active", isFullscreen);
      this.dom.slideshowButton.setAttribute(
        "aria-label",
        this.isSlideshowRunning ? labels.stopSlideshow : labels.startSlideshow
      );
      this.dom.fullscreenButton.setAttribute("aria-label", isFullscreen ? labels.exitFullscreen : labels.fullscreen);
    }

    adjustZoom(nextZoom) {
      const currentItem = this.getCurrentItem();
      if (!currentItem || currentItem.type !== "image") {
        return;
      }

      this.zoom = clamp(nextZoom, this.options.minZoom, this.options.maxZoom);
      if (this.zoom <= 1) {
        this.panX = 0;
        this.panY = 0;
      } else {
        this.limitPan();
      }
      this.applyImageTransform();
    }

    limitPan() {
      if (!this.dom.image || this.zoom <= 1) {
        this.panX = 0;
        this.panY = 0;
        return;
      }

      const imageRect = this.dom.image.getBoundingClientRect();
      const viewportRect = this.dom.viewport.getBoundingClientRect();
      const maxX = Math.max(0, ((imageRect.width * this.zoom) - viewportRect.width) / 2);
      const maxY = Math.max(0, ((imageRect.height * this.zoom) - viewportRect.height) / 2);

      this.panX = clamp(this.panX, -maxX, maxX);
      this.panY = clamp(this.panY, -maxY, maxY);
    }

    applyImageTransform() {
      if (!this.dom.image) {
        this.updateZoomControls(this.getCurrentItem());
        return;
      }

      this.dom.image.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
      this.dom.viewport.classList.toggle("is-zoomed", this.zoom > 1);
      this.updateZoomControls(this.getCurrentItem());
    }

    downloadCurrent() {
      const item = this.getCurrentItem();
      if (!item || !item.downloadSrc) {
        return;
      }

      const link = document.createElement("a");
      link.href = item.downloadSrc;
      link.download = "";
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toggleFullscreen() {
      if (!canUseFullscreen()) {
        return;
      }

      if (getFullscreenElement() === this.dom.root || getFullscreenElement() === this.dom.panel) {
        exitDocumentFullscreen();
      } else {
        requestElementFullscreen(this.dom.root);
      }
    }

    scheduleSlideshow() {
      if (!this.isSlideshowRunning) {
        return;
      }

      window.clearTimeout(this.slideshowTimer);
      this.slideshowTimer = window.setTimeout(() => this.next(), this.options.slideshowDelay);
    }

    startSlideshow() {
      if (this.isSlideshowRunning || this.items.length < 2) {
        return;
      }

      this.isSlideshowRunning = true;
      this.updateToolbarState();
      this.scheduleSlideshow();
      this.emit("slideshowStart", this.createPayload());
    }

    stopSlideshow() {
      if (!this.isSlideshowRunning && !this.slideshowTimer) {
        return;
      }

      const wasRunning = this.isSlideshowRunning;
      this.isSlideshowRunning = false;
      window.clearTimeout(this.slideshowTimer);
      this.slideshowTimer = 0;
      if (this.dom.slideshowButton) {
        this.updateToolbarState();
      }
      if (wasRunning) {
        this.emit("slideshowStop", this.createPayload());
      }
    }

    toggleSlideshow() {
      if (this.isSlideshowRunning) {
        this.stopSlideshow();
      } else {
        this.startSlideshow();
      }
    }

    preloadAround() {
      const distance = Number(this.options.preload) || 0;
      if (!distance) {
        return;
      }

      for (let step = 1; step <= distance; step += 1) {
        [this.index - step, this.index + step].forEach(targetIndex => {
          const item = this.items[(targetIndex + this.items.length) % this.items.length];
          if (!item || item.type !== "image") {
            return;
          }

          const image = new Image();
          image.src = item.src;
          this.imageCache.push(image);
        });
      }
    }

    maintainFocus(event) {
      const focusable = getFocusable(this.dom.root);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!focusable.length) {
        event.preventDefault();
        this.dom.panel.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  class FantasyBox {}

  FantasyBox.instances = [];
  FantasyBox._bindings = [];
  FantasyBox._hashListenerBound = false;

  FantasyBox.getTopInstance = () => FantasyBox.instances[FantasyBox.instances.length - 1] || null;

  FantasyBox.readHash = () => (window.location.hash ? window.location.hash.slice(1) : "");

  FantasyBox.writeHash = (value, push = false) => {
    const url = value
      ? `${window.location.pathname}${window.location.search}#${value}`
      : `${window.location.pathname}${window.location.search}`;

    if (push) {
      window.history.pushState(null, "", url);
    } else {
      window.history.replaceState(null, "", url);
    }
  };

  FantasyBox.bindHashListener = () => {
    if (FantasyBox._hashListenerBound) {
      return;
    }

    window.addEventListener("hashchange", () => {
      FantasyBox.handleHashChange();
    });

    FantasyBox._hashListenerBound = true;
  };

  FantasyBox.findBindingMatchByGroup = group => {
    if (!group) {
      return null;
    }

    for (const { selector, options } of FantasyBox._bindings) {
      const nodes = Array.from(document.querySelectorAll(selector));
      const match = nodes.find(node => {
        const nodeGroup =
          node.getAttribute("data-fantasybox") ||
          node.getAttribute("data-lightbox") ||
          node.getAttribute("data-gallery") ||
          "";

        return slugifyHashGroup(nodeGroup) === group;
      });

      if (match) {
        return { node: match, options };
      }
    }

    return null;
  };

  FantasyBox.openFromHash = hashState => {
    const match = FantasyBox.findBindingMatchByGroup(hashState.group);
    if (!match) {
      return false;
    }

    const nodeGroup =
      match.node.getAttribute("data-fantasybox") ||
      match.node.getAttribute("data-lightbox") ||
      match.node.getAttribute("data-gallery") ||
      "";

    const groupNodes = Array.from(
      document.querySelectorAll(
        `[data-fantasybox="${nodeGroup}"], [data-lightbox="${nodeGroup}"], [data-gallery="${nodeGroup}"]`
      )
    );
    const items = groupNodes.map(extractItemFromNode);
    const startIndex = clamp(hashState.index, 0, Math.max(items.length - 1, 0));

    FantasyBox.open(items, mergeOptions(match.options, { startIndex, hashGroup: hashState.group }));
    return true;
  };

  FantasyBox.handleHashChange = () => {
    const hash = FantasyBox.readHash();
    const hashState = parseHashState(hash);
    const topInstance = FantasyBox.getTopInstance();

    if (!hashState) {
      if (topInstance && topInstance.hashState.enabled) {
        topInstance.close(true, { skipHashRestore: true });
      }
      return;
    }

    if (!topInstance) {
      FantasyBox.openFromHash(hashState);
      return;
    }

    if (!topInstance.hashState.enabled) {
      return;
    }

    if (topInstance.hashState.group !== hashState.group) {
      topInstance.close(true, { skipHashRestore: true });
      FantasyBox.openFromHash(hashState);
      return;
    }

    topInstance.goTo(clamp(hashState.index, 0, topInstance.items.length - 1));
  };

  FantasyBox.syncStack = () => {
    const baseZIndex = 9999;
    const topInstance = FantasyBox.getTopInstance();

    FantasyBox.instances.forEach((instance, index) => {
      instance.dom.root.style.zIndex = String(baseZIndex + index * 2);
      instance.dom.root.classList.toggle("is-stack-top", instance === topInstance);
    });

    const isLocked = FantasyBox.instances.length > 0;
    document.documentElement.classList.toggle("fantasybox-lock", isLocked);
    if (document.body) {
      document.body.classList.toggle("fantasybox-lock", isLocked);
    }
    if (topInstance) {
      topInstance.resetIdleTimer();
    }
  };

  FantasyBox.open = (items, options) => {
    const instance = new FantasyBoxCore(items, options);
    FantasyBox.bindHashListener();
    instance.open();
    return instance;
  };

  FantasyBox.close = () => {
    const instance = FantasyBox.getTopInstance();
    if (instance) {
      instance.close();
    }
  };

  FantasyBox.bind = (selector, options = {}) => {
    const nodes = Array.from(document.querySelectorAll(selector));

    nodes.forEach(node => {
      if (node.__fantasyboxBound) {
        return;
      }

      node.__fantasyboxBound = true;
      node.addEventListener("click", event => {
        const groupName =
          node.getAttribute("data-fantasybox") ||
          node.getAttribute("data-lightbox") ||
          node.getAttribute("data-gallery") ||
          "";

        const groupNodes = groupName
          ? Array.from(
              document.querySelectorAll(
                `[data-fantasybox="${groupName}"], [data-lightbox="${groupName}"], [data-gallery="${groupName}"]`
              )
            )
          : [node];

        const items = groupNodes.map(extractItemFromNode);
        const startIndex = Math.max(groupNodes.indexOf(node), 0);
        const hashGroup =
          typeof options.hash === "string"
            ? slugifyHashGroup(options.hash)
            : slugifyHashGroup(groupName);

        event.preventDefault();
        FantasyBox.open(items, mergeOptions(options, { startIndex, hashGroup }));
      });
    });

    FantasyBox._bindings.push({ selector, options });
    FantasyBox.bindHashListener();
    FantasyBox.handleHashChange();
  };

  FantasyBox.scan = (options = {}) => {
    FantasyBox.bind("[data-fantasybox], [data-lightbox], [data-gallery]", options);
  };

  FantasyBox.on = (instance, eventName, handler) => {
    if (instance && typeof instance.on === "function") {
      instance.on(eventName, handler);
    }
    return instance;
  };

  FantasyBox.off = (instance, eventName, handler) => {
    if (instance && typeof instance.off === "function") {
      instance.off(eventName, handler);
    }
    return instance;
  };

  return FantasyBox;
});
