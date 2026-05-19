(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    var api = factory();
    root.FantasyBox = api;
    root.Lightbox = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  var DEFAULTS = {
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

  var IMAGE_EXT_RE = /\.(avif|bmp|gif|ico|jpe?g|png|svg|webp)(\?.*)?$/i;
  var VIDEO_EXT_RE = /\.(mp4|m4v|mov|ogv|ogg|webm)(\?.*)?$/i;
  var EMBED_HOST_RE = /youtube\.com|youtu\.be|vimeo\.com/i;
  var instanceCounter = 0;

  function isObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function mergeOptions(base, extra) {
    var output = {};
    var key;

    for (key in base) {
      if (Object.prototype.hasOwnProperty.call(base, key)) {
        if (isObject(base[key])) {
          output[key] = mergeOptions(base[key], {});
        } else if (Array.isArray(base[key])) {
          output[key] = base[key].slice();
        } else {
          output[key] = base[key];
        }
      }
    }

    for (key in extra || {}) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) {
        if (isObject(extra[key]) && isObject(output[key])) {
          output[key] = mergeOptions(output[key], extra[key]);
        } else {
          output[key] = extra[key];
        }
      }
    }

    return output;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getDistance(pointA, pointB) {
    var deltaX = pointA.x - pointB.x;
    var deltaY = pointA.y - pointB.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  function getMidpoint(pointA, pointB) {
    return {
      x: (pointA.x + pointB.x) / 2,
      y: (pointA.y + pointB.y) / 2,
    };
  }

  function sanitizeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function parseYouTube(url) {
    var match =
      url.match(/[?&]v=([^&#]+)/i) ||
      url.match(/youtu\.be\/([^?&#/]+)/i) ||
      url.match(/youtube\.com\/shorts\/([^?&#/]+)/i) ||
      url.match(/youtube\.com\/embed\/([^?&#/]+)/i);

    if (!match || !match[1]) {
      return null;
    }

    return "https://www.youtube.com/embed/" + match[1] + "?rel=0";
  }

  function parseVimeo(url) {
    var match =
      url.match(/vimeo\.com\/(?:video\/)?(\d+)/i) ||
      url.match(/player\.vimeo\.com\/video\/(\d+)/i);

    if (!match || !match[1]) {
      return null;
    }

    return "https://player.vimeo.com/video/" + match[1];
  }

  function detectType(item) {
    var explicit = item.type;
    var src = item.src || "";

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

    return "iframe";
  }

  function toEmbedUrl(src) {
    return parseYouTube(src) || parseVimeo(src) || src;
  }

  function normalizeItem(input, index) {
    var item = typeof input === "string" ? { src: input } : mergeOptions({}, input || {});
    item.index = index;
    item.type = detectType(item);
    item.caption = item.caption || "";
    item.thumb = item.thumb || "";
    item.alt = item.alt || item.caption || "Media " + (index + 1);
    item.poster = item.poster || "";
    item.width = item.width || "";
    item.height = item.height || "";
    item.downloadSrc = item.downloadSrc || item.src || "";

    if (item.type === "embed") {
      item.embedSrc = toEmbedUrl(item.src);
      item.provider = /youtu/i.test(item.src) ? "youtube" : /vimeo/i.test(item.src) ? "vimeo" : "embed";
    }

    return item;
  }

  function extractItemFromNode(node) {
    var href = node.getAttribute("href") || "";
    var source =
      node.getAttribute("data-src") ||
      href ||
      node.getAttribute("src") ||
      "";
    var image = node.querySelector("img");
    var caption =
      node.getAttribute("data-caption") ||
      node.getAttribute("title") ||
      node.getAttribute("aria-label") ||
      (image && (image.getAttribute("alt") || image.getAttribute("title"))) ||
      "";

    return {
      src: source,
      type: node.getAttribute("data-type") || "",
      caption: caption,
      thumb:
        node.getAttribute("data-thumb") ||
        (image && (image.currentSrc || image.getAttribute("src"))) ||
        "",
      alt: node.getAttribute("data-alt") || (image && image.getAttribute("alt")) || caption,
      poster: node.getAttribute("data-poster") || "",
      html: node.getAttribute("data-html") || "",
      downloadSrc: node.getAttribute("data-download-src") || "",
      width: node.getAttribute("data-width") || "",
      height: node.getAttribute("data-height") || "",
    };
  }

  function createElement(tagName, className, attrs) {
    var element = document.createElement(tagName);
    var key;

    if (className) {
      element.className = className;
    }

    for (key in attrs || {}) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) {
        if (attrs[key] != null) {
          element.setAttribute(key, attrs[key]);
        }
      }
    }

    return element;
  }

  function getFocusable(root) {
    return Array.prototype.slice.call(
      root.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function FantasyBoxCore(items, options) {
    this.id = "fantasybox-" + ++instanceCounter;
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
    this.pointerCache = {};
    this.pointerStartSnapshot = null;
    this.pinchDistanceStart = 0;
    this.pinchZoomStart = 1;
    this.midpointStart = null;
    this.lastTapAt = 0;
    this.lastTapPoint = null;
    this.slideshowTimer = 0;
    this.isSlideshowRunning = false;
    this.eventListeners = {};
    this.hashState = {
      enabled: !!this.options.hash,
      previous: "",
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

  FantasyBoxCore.prototype.initOptionEvents = function () {
    var self = this;
    var optionEvents = this.options.on || {};

    Object.keys(optionEvents).forEach(function (eventName) {
      if (typeof optionEvents[eventName] === "function") {
        self.on(eventName, optionEvents[eventName]);
      }
    });
  };

  FantasyBoxCore.prototype.on = function (eventName, handler) {
    if (!eventName || typeof handler !== "function") {
      return this;
    }

    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }

    this.eventListeners[eventName].push(handler);
    return this;
  };

  FantasyBoxCore.prototype.off = function (eventName, handler) {
    if (!eventName || !this.eventListeners[eventName]) {
      return this;
    }

    if (!handler) {
      this.eventListeners[eventName] = [];
      return this;
    }

    this.eventListeners[eventName] = this.eventListeners[eventName].filter(function (cb) {
      return cb !== handler;
    });
    return this;
  };

  FantasyBoxCore.prototype.emit = function (eventName, payload) {
    var handlers = this.eventListeners[eventName] || [];
    handlers.slice().forEach(function (handler) {
      try {
        handler(payload);
      } catch (error) {
        setTimeout(function () {
          throw error;
        }, 0);
      }
    });
    return this;
  };

  FantasyBoxCore.prototype.getHashToken = function () {
    return "fbx=" + encodeURIComponent(this.id + ":" + this.index);
  };

  FantasyBoxCore.prototype.updateHash = function (push) {
    if (!this.hashState.enabled || FantasyBox.getTopInstance() !== this) {
      return;
    }

    FantasyBox.writeHash(this.getHashToken(), !!push);
  };

  FantasyBoxCore.prototype.restoreHash = function () {
    if (!this.hashState.enabled) {
      return;
    }

    if (this.hashState.previous) {
      FantasyBox.writeHash(this.hashState.previous, false);
    } else {
      FantasyBox.writeHash("", false);
    }
  };

  FantasyBoxCore.prototype.build = function () {
    if (this.dom.root) {
      return;
    }

    var labels = this.options.labels;
    var root = createElement("div", "fantasybox", {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": labels.dialog,
    });
    var scrim = createElement("div", "fantasybox__scrim", { "data-fb-action": "backdrop" });
    var panel = createElement("div", "fantasybox__panel", { tabindex: "-1" });
    var toolbar = createElement("div", "fantasybox__toolbar");
    var zoomGroup = createElement("div", "fantasybox__toolgroup fantasybox__toolgroup--zoom");
    var actionGroup = createElement("div", "fantasybox__toolgroup fantasybox__toolgroup--actions");
    var meta = createElement("div", "fantasybox__meta");
    var caption = createElement("div", "fantasybox__caption");
    var counter = createElement("div", "fantasybox__counter");
    var stage = createElement("div", "fantasybox__stage");
    var prev = createElement("button", "fantasybox__nav fantasybox__nav--prev", {
      type: "button",
      "data-fb-action": "prev",
      "aria-label": labels.previous,
    });
    var next = createElement("button", "fantasybox__nav fantasybox__nav--next", {
      type: "button",
      "data-fb-action": "next",
      "aria-label": labels.next,
    });
    var viewport = createElement("div", "fantasybox__viewport");
    var frame = createElement("div", "fantasybox__frame");
    var loading = createElement("div", "fantasybox__loading", { "aria-live": "polite" });
    var thumbs = createElement("div", "fantasybox__thumbs");
    var closeButton = createElement("button", "fantasybox__button", {
      type: "button",
      "data-fb-action": "close",
      "aria-label": labels.close,
    });
    var zoomInButton = createElement("button", "fantasybox__button", {
      type: "button",
      "data-fb-action": "zoom-in",
      "aria-label": labels.zoomIn,
    });
    var zoomOutButton = createElement("button", "fantasybox__button", {
      type: "button",
      "data-fb-action": "zoom-out",
      "aria-label": labels.zoomOut,
    });
    var slideshowButton = createElement("button", "fantasybox__button", {
      type: "button",
      "data-fb-action": "slideshow",
      "aria-label": labels.startSlideshow,
    });
    var fullscreenButton = createElement("button", "fantasybox__button", {
      type: "button",
      "data-fb-action": "fullscreen",
      "aria-label": labels.fullscreen,
    });
    var downloadButton = createElement("button", "fantasybox__button", {
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

    meta.appendChild(caption);
    meta.appendChild(counter);
    zoomGroup.appendChild(zoomOutButton);
    zoomGroup.appendChild(zoomInButton);
    actionGroup.appendChild(slideshowButton);
    actionGroup.appendChild(fullscreenButton);
    actionGroup.appendChild(downloadButton);
    toolbar.appendChild(meta);
    toolbar.appendChild(zoomGroup);
    toolbar.appendChild(actionGroup);
    toolbar.appendChild(closeButton);
    viewport.appendChild(frame);
    viewport.appendChild(loading);
    stage.appendChild(prev);
    stage.appendChild(viewport);
    stage.appendChild(next);
    panel.appendChild(toolbar);
    panel.appendChild(stage);
    panel.appendChild(thumbs);
    root.appendChild(scrim);
    root.appendChild(panel);

    this.dom.root = root;
    this.dom.scrim = scrim;
    this.dom.panel = panel;
    this.dom.toolbar = toolbar;
    this.dom.caption = caption;
    this.dom.counter = counter;
    this.dom.stage = stage;
    this.dom.viewport = viewport;
    this.dom.frame = frame;
    this.dom.loading = loading;
    this.dom.prev = prev;
    this.dom.next = next;
    this.dom.thumbs = thumbs;
    this.dom.closeButton = closeButton;
    this.dom.zoomInButton = zoomInButton;
    this.dom.zoomOutButton = zoomOutButton;
    this.dom.slideshowButton = slideshowButton;
    this.dom.fullscreenButton = fullscreenButton;
    this.dom.downloadButton = downloadButton;

    this.renderThumbs();
  };

  FantasyBoxCore.prototype.bindEvents = function () {
    if (this.eventsBound) {
      return;
    }

    var self = this;

    this.boundHandlers.onClick = function (event) {
      var button = event.target.closest("[data-fb-action]");
      if (!button) {
        return;
      }

      var action = button.getAttribute("data-fb-action");
      if (action === "backdrop") {
        if (self.options.closeOnBackdrop) {
          self.close();
        }
        return;
      }

      event.preventDefault();

      if (action === "close") {
        self.close();
      } else if (action === "prev") {
        self.prev();
      } else if (action === "next") {
        self.next();
      } else if (action === "zoom-in") {
        self.adjustZoom(self.zoom + self.options.zoomStep);
      } else if (action === "zoom-out") {
        self.adjustZoom(self.zoom - self.options.zoomStep);
      } else if (action === "slideshow") {
        self.toggleSlideshow();
      } else if (action === "fullscreen") {
        self.toggleFullscreen();
      } else if (action === "download") {
        self.downloadCurrent();
      }
    };

    this.boundHandlers.onKeyDown = function (event) {
      if (!self.isOpen || !self.options.keyboard || FantasyBox.getTopInstance() !== self) {
        return;
      }

      if (event.key === "Escape" && self.options.closeOnEscape) {
        event.preventDefault();
        self.close();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        self.prev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        self.next();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        self.adjustZoom(self.zoom + self.options.zoomStep);
      } else if (event.key === "-") {
        event.preventDefault();
        self.adjustZoom(self.zoom - self.options.zoomStep);
      } else if (event.key === "f") {
        event.preventDefault();
        self.toggleFullscreen();
      } else if (event.key === " ") {
        event.preventDefault();
        self.toggleSlideshow();
      } else if (event.key === "Tab") {
        self.maintainFocus(event);
      }
    };

    this.boundHandlers.onWheel = function (event) {
      var item = self.getCurrentItem();
      if (!self.isOpen || !self.options.wheelZoom || !item || item.type !== "image") {
        return;
      }

      event.preventDefault();
      self.adjustZoom(self.zoom + (event.deltaY < 0 ? self.options.zoomStep : -self.options.zoomStep));
    };

    this.boundHandlers.onPointerDown = function (event) {
      var item = self.getCurrentItem();
      if (!item) {
        return;
      }

      self.pointerCache[event.pointerId] = {
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType || "",
      };

      if (item.type === "image" && self.options.touchZoom && Object.keys(self.pointerCache).length === 2) {
        var pointerIds = Object.keys(self.pointerCache);
        var firstPointer = self.pointerCache[pointerIds[0]];
        var secondPointer = self.pointerCache[pointerIds[1]];

        self.dragMode = "pinch";
        self.pinchDistanceStart = getDistance(firstPointer, secondPointer);
        self.pinchZoomStart = self.zoom;
        self.midpointStart = getMidpoint(firstPointer, secondPointer);
        self.pointerStartSnapshot = {
          panX: self.panX,
          panY: self.panY,
          midpointX: self.midpointStart.x,
          midpointY: self.midpointStart.y,
        };
        self.dom.viewport.classList.add("is-dragging");
        return;
      }

      if (item.type === "image" && self.zoom > 1 && self.options.dragToPan) {
        self.dragMode = "pan";
      } else {
        self.dragMode = "swipe";
      }

      self.pointerStartX = event.clientX;
      self.pointerStartY = event.clientY;
      self.startPanX = self.panX;
      self.startPanY = self.panY;
      self.swipeDeltaX = 0;
      self.dom.viewport.setPointerCapture(event.pointerId);
      self.dom.viewport.classList.add("is-dragging");
    };

    this.boundHandlers.onPointerMove = function (event) {
      if (self.pointerCache[event.pointerId]) {
        self.pointerCache[event.pointerId].x = event.clientX;
        self.pointerCache[event.pointerId].y = event.clientY;
      }

      if (!self.dragMode) {
        return;
      }

      var deltaX = event.clientX - self.pointerStartX;
      var deltaY = event.clientY - self.pointerStartY;

      if (self.dragMode === "pinch") {
        var pinchIds = Object.keys(self.pointerCache);
        if (pinchIds.length < 2 || !self.dom.image) {
          return;
        }

        var pinchA = self.pointerCache[pinchIds[0]];
        var pinchB = self.pointerCache[pinchIds[1]];
        var midpoint = getMidpoint(pinchA, pinchB);
        var distance = getDistance(pinchA, pinchB);
        var ratio = self.pinchDistanceStart ? distance / self.pinchDistanceStart : 1;

        self.zoom = clamp(self.pinchZoomStart * ratio, self.options.minZoom, self.options.maxZoom);
        self.panX = self.pointerStartSnapshot.panX + (midpoint.x - self.pointerStartSnapshot.midpointX);
        self.panY = self.pointerStartSnapshot.panY + (midpoint.y - self.pointerStartSnapshot.midpointY);
        self.limitPan();
        self.applyImageTransform();
      } else if (self.dragMode === "pan") {
        self.panX = self.startPanX + deltaX;
        self.panY = self.startPanY + deltaY;
        self.limitPan();
        self.applyImageTransform();
      } else if (self.dragMode === "swipe") {
        self.swipeDeltaX = deltaX;
        self.dom.frame.style.transform = "translateX(" + deltaX + "px)";
      }
    };

    this.boundHandlers.onPointerUp = function (event) {
      if (self.dom.viewport.hasPointerCapture && self.dom.viewport.hasPointerCapture(event.pointerId)) {
        self.dom.viewport.releasePointerCapture(event.pointerId);
      }

      var pointerData = self.pointerCache[event.pointerId];
      var pointerCountBeforeDelete = Object.keys(self.pointerCache).length;
      delete self.pointerCache[event.pointerId];

      if (!self.dragMode) {
        return;
      }

      if (self.dragMode === "swipe") {
        self.dom.frame.style.transform = "";
        if (Math.abs(self.swipeDeltaX) > 60) {
          if (self.swipeDeltaX > 0) {
            self.prev();
          } else {
            self.next();
          }
        }
      } else if (
        self.dragMode !== "pinch" &&
        pointerData &&
        pointerData.pointerType === "touch" &&
        self.options.doubleTapZoom &&
        self.getCurrentItem() &&
        self.getCurrentItem().type === "image"
      ) {
        var now = Date.now();
        var tapPoint = { x: event.clientX, y: event.clientY };
        var isDoubleTap =
          self.lastTapAt &&
          now - self.lastTapAt < 280 &&
          self.lastTapPoint &&
          getDistance(self.lastTapPoint, tapPoint) < 24;

        if (isDoubleTap) {
          self.adjustZoom(self.zoom > 1 ? 1 : Math.min(2, self.options.maxZoom));
          self.lastTapAt = 0;
          self.lastTapPoint = null;
        } else {
          self.lastTapAt = now;
          self.lastTapPoint = tapPoint;
        }
      }

      if (self.dragMode === "pinch" && pointerCountBeforeDelete > 1 && Object.keys(self.pointerCache).length === 1) {
        var remainingId = Object.keys(self.pointerCache)[0];
        var remainingPointer = self.pointerCache[remainingId];
        self.dragMode = self.zoom > 1 ? "pan" : "";
        self.pointerStartX = remainingPointer.x;
        self.pointerStartY = remainingPointer.y;
        self.startPanX = self.panX;
        self.startPanY = self.panY;
        if (self.dragMode) {
          return;
        }
      }

      self.dragMode = "";
      self.swipeDeltaX = 0;
      self.dom.viewport.classList.remove("is-dragging");
    };

    this.boundHandlers.onDoubleClick = function () {
      var item = self.getCurrentItem();
      if (!item || item.type !== "image") {
        return;
      }

      self.adjustZoom(self.zoom > 1 ? 1 : Math.min(2, self.options.maxZoom));
    };

    this.boundHandlers.onResize = function () {
      self.limitPan();
      self.applyImageTransform();
    };

    this.boundHandlers.onFullscreenChange = function () {
      self.updateToolbarState();
    };

    this.dom.root.addEventListener("click", this.boundHandlers.onClick);
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
  };

  FantasyBoxCore.prototype.unbindEvents = function () {
    if (!this.dom.root || !this.eventsBound) {
      return;
    }

    this.dom.root.removeEventListener("click", this.boundHandlers.onClick);
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
  };

  FantasyBoxCore.prototype.renderThumbs = function () {
    var self = this;

    if (!this.options.showThumbnails || this.items.length < 2) {
      this.dom.thumbs.innerHTML = "";
      this.dom.thumbs.hidden = true;
      return;
    }

    this.dom.thumbs.hidden = false;
    this.dom.thumbs.innerHTML = "";

    this.items.forEach(function (item, itemIndex) {
      var button = createElement("button", "fantasybox__thumb", {
        type: "button",
        "data-fb-index": String(itemIndex),
        "aria-label": "Go to item " + (itemIndex + 1),
      });
      var thumbImage = item.thumb || (item.type === "image" ? item.src : item.poster);

      if (thumbImage) {
        button.innerHTML =
          '<img src="' +
          sanitizeHtml(thumbImage) +
          '" alt="' +
          sanitizeHtml(item.alt) +
          '" loading="lazy" />';
      } else {
        button.textContent = String(itemIndex + 1);
      }

      button.addEventListener("click", function () {
        self.goTo(itemIndex);
      });
      self.dom.thumbs.appendChild(button);
    });
  };

  FantasyBoxCore.prototype.open = function () {
    this.emit("init", { instance: this, items: this.items, index: this.index });
    this.build();
    this.bindEvents();
    this.isOpen = true;
    this.hashState.previous = FantasyBox.readHash();

    document.body.appendChild(this.dom.root);
    FantasyBox.instances.push(this);
    FantasyBox.syncStack();
    this.dom.root.offsetHeight;
    this.dom.root.classList.add("is-open");
    this.updateHash(true);
    this.renderCurrent();
    this.dom.panel.focus();
    this.emit("open", { instance: this, item: this.getCurrentItem(), index: this.index });
  };

  FantasyBoxCore.prototype.close = function (silent, context) {
    if (!this.isOpen) {
      return;
    }

    this.emit("close", { instance: this, item: this.getCurrentItem(), index: this.index });
    this.isOpen = false;
    this.stopSlideshow();
    this.unloadMedia();
    this.unbindEvents();
    this.dom.root.classList.remove("is-open");

    if (document.fullscreenElement === this.dom.root || document.fullscreenElement === this.dom.panel) {
      try {
        document.exitFullscreen();
      } catch (error) {}
    }

    if (this.dom.root.parentNode) {
      this.dom.root.parentNode.removeChild(this.dom.root);
    }

    FantasyBox.instances = FantasyBox.instances.filter(function (instance) {
      return instance !== this;
    }, this);
    FantasyBox.syncStack();
    if (!(context && context.skipHashRestore)) {
      this.restoreHash();
    }

    if (!silent && this.lastFocused && typeof this.lastFocused.focus === "function") {
      this.lastFocused.focus();
    }
  };

  FantasyBoxCore.prototype.destroy = function () {
    this.emit("destroy", { instance: this });
    this.close(true);
    this.unbindEvents();
    this.dom = {};
  };

  FantasyBoxCore.prototype.getCurrentItem = function () {
    return this.items[this.index] || null;
  };

  FantasyBoxCore.prototype.goTo = function (nextIndex) {
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
      return;
    }

    var previousIndex = this.index;
    this.index = nextIndex;
    this.updateHash(false);
    this.renderCurrent();
    this.scheduleSlideshow();
    this.emit("change", {
      instance: this,
      item: this.getCurrentItem(),
      index: this.index,
      previousIndex: previousIndex,
    });
  };

  FantasyBoxCore.prototype.prev = function () {
    this.goTo(this.index - 1);
  };

  FantasyBoxCore.prototype.next = function () {
    this.goTo(this.index + 1);
  };

  FantasyBoxCore.prototype.unloadMedia = function () {
    var activeFrame = this.dom.frame;
    if (!activeFrame) {
      return;
    }

    Array.prototype.slice.call(activeFrame.querySelectorAll("video")).forEach(function (video) {
      try {
        video.pause();
      } catch (error) {
        return error;
      }
    });

    Array.prototype.slice.call(activeFrame.querySelectorAll("iframe")).forEach(function (frame) {
      frame.setAttribute("src", "about:blank");
    });
  };

  FantasyBoxCore.prototype.renderCurrent = function () {
    var self = this;
    var item = this.getCurrentItem();
    var content;

    if (!item) {
      return;
    }

    this.unloadMedia();
    this.dom.loading.hidden = false;
    this.dom.frame.innerHTML = "";
    this.emit("loading", { instance: this, item: item, index: this.index });
    this.resetZoom();
    this.updateMeta(item);
    this.updateNavigation();
    this.updateThumbState();
    this.updateZoomControls(item);
    this.updateToolbarState();

    if (item.type === "image") {
      content = createElement("img", "fantasybox__media fantasybox__media--image", {
        alt: item.alt,
        draggable: "false",
      });
      content.addEventListener("load", function () {
        self.dom.loading.hidden = true;
        self.limitPan();
        self.preloadAround();
        self.emit("loaded", { instance: self, item: item, index: self.index });
      });
      content.addEventListener("error", function () {
        self.renderError("Unable to load image.");
      });
      content.src = item.src;
      this.dom.frame.appendChild(content);
      this.dom.image = content;
    } else if (item.type === "video") {
      content = createElement("video", "fantasybox__media fantasybox__media--video", {
        controls: "true",
        playsinline: "true",
        preload: "metadata",
      });
      if (item.poster) {
        content.setAttribute("poster", item.poster);
      }
      content.addEventListener("loadeddata", function () {
        self.dom.loading.hidden = true;
        self.emit("loaded", { instance: self, item: item, index: self.index });
      });
      content.addEventListener("error", function () {
        self.renderError("Unable to load video.");
      });
      content.src = item.src;
      this.dom.frame.appendChild(content);
      this.dom.image = null;
    } else if (item.type === "embed" || item.type === "iframe") {
      content = createElement("iframe", "fantasybox__media fantasybox__media--frame", {
        allow: "autoplay; fullscreen; picture-in-picture",
        allowfullscreen: "true",
        loading: "eager",
        referrerpolicy: "strict-origin-when-cross-origin",
      });
      content.addEventListener("load", function () {
        self.dom.loading.hidden = true;
        self.emit("loaded", { instance: self, item: item, index: self.index });
      });
      content.src = item.type === "embed" ? item.embedSrc : item.src;
      this.dom.frame.appendChild(content);
      this.dom.image = null;
    } else if (item.type === "ajax") {
      content = createElement("div", "fantasybox__media fantasybox__media--html");
      fetch(item.src, { credentials: "same-origin" })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Bad response");
          }
          return response.text();
        })
        .then(function (html) {
          if (!self.isOpen || self.getCurrentItem() !== item) {
            return;
          }
          content.innerHTML = html;
          self.dom.loading.hidden = true;
          self.emit("loaded", { instance: self, item: item, index: self.index });
        })
        .catch(function () {
          self.renderError("Unable to load Ajax content.");
        });
      this.dom.frame.appendChild(content);
      this.dom.image = null;
    } else if (item.type === "inline") {
      var source = document.querySelector(item.src);
      content = createElement("div", "fantasybox__media fantasybox__media--html");
      if (source) {
        content.innerHTML = source.innerHTML;
        this.dom.loading.hidden = true;
        this.emit("loaded", { instance: this, item: item, index: this.index });
      } else {
        this.renderError("Inline content not found.");
        return;
      }
      this.dom.frame.appendChild(content);
      this.dom.image = null;
    } else if (item.type === "html") {
      content = createElement("div", "fantasybox__media fantasybox__media--html");
      content.innerHTML = item.html;
      this.dom.loading.hidden = true;
      this.emit("loaded", { instance: this, item: item, index: this.index });
      this.dom.frame.appendChild(content);
      this.dom.image = null;
    } else {
      this.renderError("Unsupported media type.");
      return;
    }

    this.dom.frame.classList.remove("is-error");
  };

  FantasyBoxCore.prototype.renderError = function (message) {
    this.dom.loading.hidden = true;
    this.dom.frame.classList.add("is-error");
    this.dom.frame.innerHTML =
      '<div class="fantasybox__error">' + sanitizeHtml(message || "Unable to open content.") + "</div>";
    this.dom.image = null;
    this.emit("error", {
      instance: this,
      item: this.getCurrentItem(),
      index: this.index,
      message: message || "Unable to open content.",
    });
  };

  FantasyBoxCore.prototype.updateMeta = function (item) {
    this.dom.caption.innerHTML = this.options.showCaption ? sanitizeHtml(item.caption || "") : "";
    this.dom.caption.hidden = !this.options.showCaption || !item.caption;
    this.dom.counter.textContent = this.options.showCounter
      ? this.index + 1 + " / " + this.items.length
      : "";
    this.dom.counter.hidden = !this.options.showCounter;
  };

  FantasyBoxCore.prototype.updateNavigation = function () {
    var disablePrev = !this.options.loop && this.index <= 0;
    var disableNext = !this.options.loop && this.index >= this.items.length - 1;
    var multiple = this.items.length > 1;

    this.dom.prev.hidden = !multiple;
    this.dom.next.hidden = !multiple;
    this.dom.prev.disabled = disablePrev;
    this.dom.next.disabled = disableNext;
  };

  FantasyBoxCore.prototype.updateThumbState = function () {
    var buttons = this.dom.thumbs.querySelectorAll("[data-fb-index]");
    var self = this;

    Array.prototype.forEach.call(buttons, function (button) {
      var isActive = Number(button.getAttribute("data-fb-index")) === self.index;
      button.classList.toggle("is-active", isActive);
      if (isActive) {
        button.setAttribute("aria-current", "true");
        button.scrollIntoView({ block: "nearest", inline: "center" });
      } else {
        button.removeAttribute("aria-current");
      }
    });
  };

  FantasyBoxCore.prototype.resetZoom = function () {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyImageTransform();
  };

  FantasyBoxCore.prototype.updateZoomControls = function (item) {
    var canZoom = item && item.type === "image";
    this.dom.zoomInButton.disabled = !canZoom || this.zoom >= this.options.maxZoom;
    this.dom.zoomOutButton.disabled = !canZoom || this.zoom <= this.options.minZoom;
  };

  FantasyBoxCore.prototype.updateToolbarState = function () {
    var item = this.getCurrentItem();
    var labels = this.options.labels;
    var hasDownload = !!(item && item.downloadSrc);
    var canSlideshow = this.items.length > 1;
    var isFullscreen = document.fullscreenElement === this.dom.root || document.fullscreenElement === this.dom.panel;

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
  };

  FantasyBoxCore.prototype.adjustZoom = function (nextZoom) {
    var item = this.getCurrentItem();

    if (!item || item.type !== "image") {
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
  };

  FantasyBoxCore.prototype.limitPan = function () {
    if (!this.dom.image || this.zoom <= 1) {
      this.panX = 0;
      this.panY = 0;
      return;
    }

    var imageRect = this.dom.image.getBoundingClientRect();
    var viewportRect = this.dom.viewport.getBoundingClientRect();
    var maxX = Math.max(0, ((imageRect.width * this.zoom) - viewportRect.width) / 2);
    var maxY = Math.max(0, ((imageRect.height * this.zoom) - viewportRect.height) / 2);

    this.panX = clamp(this.panX, -maxX, maxX);
    this.panY = clamp(this.panY, -maxY, maxY);
  };

  FantasyBoxCore.prototype.applyImageTransform = function () {
    if (!this.dom.image) {
      this.updateZoomControls(this.getCurrentItem());
      return;
    }

    this.dom.image.style.transform =
      "translate(" + this.panX + "px, " + this.panY + "px) scale(" + this.zoom + ")";
    this.dom.viewport.classList.toggle("is-zoomed", this.zoom > 1);
    this.updateZoomControls(this.getCurrentItem());
  };

  FantasyBoxCore.prototype.downloadCurrent = function () {
    var item = this.getCurrentItem();
    var link;

    if (!item || !item.downloadSrc) {
      return;
    }

    link = document.createElement("a");
    link.href = item.downloadSrc;
    link.download = "";
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  FantasyBoxCore.prototype.toggleFullscreen = function () {
    if (!document.fullscreenEnabled) {
      return;
    }

    if (document.fullscreenElement === this.dom.root || document.fullscreenElement === this.dom.panel) {
      document.exitFullscreen();
      this.emit("fullscreenChange", { instance: this, active: false });
    } else {
      this.dom.root.requestFullscreen();
      this.emit("fullscreenChange", { instance: this, active: true });
    }
  };

  FantasyBoxCore.prototype.scheduleSlideshow = function () {
    var self = this;

    if (!this.isSlideshowRunning) {
      return;
    }

    window.clearTimeout(this.slideshowTimer);
    this.slideshowTimer = window.setTimeout(function () {
      self.next();
    }, this.options.slideshowDelay);
  };

  FantasyBoxCore.prototype.startSlideshow = function () {
    if (this.items.length < 2) {
      return;
    }

    this.isSlideshowRunning = true;
    this.updateToolbarState();
    this.scheduleSlideshow();
    this.emit("slideshowStart", { instance: this, index: this.index });
  };

  FantasyBoxCore.prototype.stopSlideshow = function () {
    this.isSlideshowRunning = false;
    window.clearTimeout(this.slideshowTimer);
    this.slideshowTimer = 0;
    if (this.dom.slideshowButton) {
      this.updateToolbarState();
    }
    this.emit("slideshowStop", { instance: this, index: this.index });
  };

  FantasyBoxCore.prototype.toggleSlideshow = function () {
    if (this.isSlideshowRunning) {
      this.stopSlideshow();
    } else {
      this.startSlideshow();
    }
  };

  FantasyBoxCore.prototype.preloadAround = function () {
    var self = this;
    var distance = Number(this.options.preload) || 0;

    if (!distance) {
      return;
    }

    for (var step = 1; step <= distance; step += 1) {
      [this.index - step, this.index + step].forEach(function (targetIndex) {
        var item = self.items[(targetIndex + self.items.length) % self.items.length];
        if (!item || item.type !== "image") {
          return;
        }

        var image = new Image();
        image.src = item.src;
        self.imageCache.push(image);
      });
    }
  };

  FantasyBoxCore.prototype.maintainFocus = function (event) {
    var focusable = getFocusable(this.dom.root);
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

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
  };

  function FantasyBox() {}

  FantasyBox.instances = [];
  FantasyBox._bindings = [];
  FantasyBox._hashListenerBound = false;

  FantasyBox.getTopInstance = function () {
    return FantasyBox.instances[FantasyBox.instances.length - 1] || null;
  };

  FantasyBox.readHash = function () {
    return window.location.hash ? window.location.hash.slice(1) : "";
  };

  FantasyBox.writeHash = function (value, push) {
    var newHash = value ? "#" + value : window.location.pathname + window.location.search;

    if (push) {
      window.history.pushState(null, "", newHash);
    } else {
      window.history.replaceState(null, "", newHash);
    }
  };

  FantasyBox.bindHashListener = function () {
    if (FantasyBox._hashListenerBound) {
      return;
    }

    window.addEventListener("hashchange", function () {
      var topInstance = FantasyBox.getTopInstance();
      var hash = FantasyBox.readHash();

      if (!topInstance || !topInstance.hashState.enabled) {
        return;
      }

      if (!hash) {
        topInstance.close(true, { skipHashRestore: true });
        return;
      }

      if (hash.indexOf("fbx=") !== 0) {
        return;
      }

      var token = decodeURIComponent(hash.slice(4));
      var parts = token.split(":");
      var instanceId = parts[0];
      var nextIndex = Number(parts[1]);

      if (instanceId !== topInstance.id || !Number.isFinite(nextIndex)) {
        return;
      }

      topInstance.goTo(clamp(nextIndex, 0, topInstance.items.length - 1));
    });

    FantasyBox._hashListenerBound = true;
  };

  FantasyBox.syncStack = function () {
    var baseZIndex = 9999;

    FantasyBox.instances.forEach(function (instance, index) {
      instance.dom.root.style.zIndex = String(baseZIndex + index * 2);
    });

    document.documentElement.classList.toggle("fantasybox-lock", FantasyBox.instances.length > 0);
  };

  FantasyBox.open = function (items, options) {
    var instance = new FantasyBoxCore(items, options);
    FantasyBox.bindHashListener();
    instance.open();
    return instance;
  };

  FantasyBox.close = function () {
    var topInstance = FantasyBox.getTopInstance();
    if (topInstance) {
      topInstance.close();
    }
  };

  FantasyBox.bind = function (selector, options) {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(selector));

    nodes.forEach(function (node) {
      if (node.__fantasyboxBound) {
        return;
      }

      node.__fantasyboxBound = true;
      node.addEventListener("click", function (event) {
        var groupName =
          node.getAttribute("data-fantasybox") ||
          node.getAttribute("data-lightbox") ||
          node.getAttribute("data-gallery") ||
          "";
        var groupNodes = groupName
          ? Array.prototype.slice.call(
              document.querySelectorAll(
                '[data-fantasybox="' +
                  groupName +
                  '"], [data-lightbox="' +
                  groupName +
                  '"], [data-gallery="' +
                  groupName +
                  '"]'
              )
            )
          : [node];
        var items = groupNodes.map(extractItemFromNode);
        var startIndex = Math.max(groupNodes.indexOf(node), 0);

        event.preventDefault();
        FantasyBox.open(items, mergeOptions(options || {}, { startIndex: startIndex }));
      });
    });

    FantasyBox._bindings.push({ selector: selector, options: options || {} });
  };

  FantasyBox.scan = function (options) {
    FantasyBox.bind("[data-fantasybox], [data-lightbox], [data-gallery]", options);
  };

  FantasyBox.on = function (instance, eventName, handler) {
    if (instance && typeof instance.on === "function") {
      instance.on(eventName, handler);
    }
    return instance;
  };

  FantasyBox.off = function (instance, eventName, handler) {
    if (instance && typeof instance.off === "function") {
      instance.off(eventName, handler);
    }
    return instance;
  };

  return FantasyBox;
});
