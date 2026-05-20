# FantasyBox

FantasyBox is a dependency-free lightbox viewer for images, videos, iframes, inline content, Ajax content, and custom HTML.

It is designed for:

- grouped gallery browsing
- keyboard navigation
- thumbnails
- wheel / double-click / touch zoom
- drag-to-pan and swipe transitions
- hash navigation
- fullscreen, download, and slideshow controls

## Features

- No external dependency
- Works with plain HTML and vanilla JavaScript
- Supports images, videos, YouTube, Vimeo, iframes, inline content, Ajax content, and custom HTML
- Built-in toolbar with close, zoom, fullscreen, download, and slideshow actions
- Thumbnail strip for grouped items
- Keyboard support with focus trapping
- Swipe transition preview and image pan / zoom
- Hash-based deep linking for grouped galleries
- Multiple instances can be opened and stacked

## Files

- `fantasybox.js`: main script
- `fantasybox.css`: default styles
- `demo.html`: feature demo page
- `demo-ajax.html`: Ajax content demo
- `SAFARI_10_15_COMPAT.md`: compatibility notes for Safari on macOS 10.15

## Quick Start

Include the CSS and JS files:

```html
<link rel="stylesheet" href="./fantasybox.css" />
<script src="./fantasybox.js"></script>
```

Create gallery items:

```html
<a href="large-1.jpg" data-fantasybox="gallery" data-caption="Image 1">
  <img src="thumb-1.jpg" alt="Image 1" />
</a>

<a href="large-2.jpg" data-fantasybox="gallery" data-caption="Image 2">
  <img src="thumb-2.jpg" alt="Image 2" />
</a>
```

Bind them:

```html
<script>
  FantasyBox.bind("[data-fantasybox]", {
    loop: true,
    showCaption: true,
    showCounter: true,
    showThumbnails: true,
  });
</script>
```

## Binding Modes

### 1. Declarative binding

Use `FantasyBox.bind()` to attach a selector:

```js
FantasyBox.bind("[data-fantasybox]", {
  hash: true,
  wheelZoom: true,
  dragToPan: true,
});
```

You can also scan common gallery attributes:

```js
FantasyBox.scan();
```

`FantasyBox.scan()` will bind:

```text
[data-fantasybox], [data-lightbox], [data-gallery]
```

### 2. Programmatic open

You can open items directly with JavaScript:

```js
FantasyBox.open(
  [
    {
      src: "large-1.jpg",
      thumb: "thumb-1.jpg",
      caption: "Image 1",
      alt: "Image 1",
    },
    {
      src: "large-2.jpg",
      thumb: "thumb-2.jpg",
      caption: "Image 2",
      alt: "Image 2",
    },
  ],
  {
    startIndex: 0,
    showThumbnails: true,
  }
);
```

Close the top instance:

```js
FantasyBox.close();
```

## Supported Content Types

FantasyBox can detect or receive these types:

- `image`
- `video`
- `embed`
- `iframe`
- `ajax`
- `inline`
- `html`

### Auto-detected content

- image file extensions: jpg, jpeg, png, gif, webp, svg, avif, bmp, ico
- video file extensions: mp4, m4v, mov, ogv, ogg, webm
- YouTube and Vimeo links are treated as `embed`
- links starting with `#` are treated as `inline`

### Inline content example

```html
<button
  type="button"
  data-fantasybox
  data-src="#dialog-content"
  data-type="inline"
  data-caption="Inline demo"
>
  Open inline content
</button>

<div id="dialog-content" style="display:none;">
  <h2>Inline content</h2>
  <p>This content is rendered inside FantasyBox.</p>
</div>
```

### Ajax content example

```html
<a
  href="./demo-ajax.html"
  data-fantasybox
  data-type="ajax"
  data-caption="Ajax demo"
>
  Open Ajax content
</a>
```

### Custom HTML example

```js
FantasyBox.open([
  {
    type: "html",
    html: "<div style='padding:24px'>Custom HTML content</div>",
    caption: "Custom HTML",
  },
]);
```

## Supported Data Attributes

When using DOM binding, these attributes are supported:

- `data-fantasybox`
- `data-lightbox`
- `data-gallery`
- `data-src`
- `data-type`
- `data-caption`
- `data-thumb`
- `data-alt`
- `data-poster`
- `data-html`
- `data-download-src`
- `data-width`
- `data-height`

## Common Options

These are the main options exposed by `FantasyBox.open()` and `FantasyBox.bind()`:

```js
{
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
}
```

## Events

Pass listeners using the `on` option or bind them later with `FantasyBox.on(instance, eventName, handler)`.

Common events:

- `init`
- `open`
- `change`
- `loading`
- `loaded`
- `idleStart`
- `idleEnd`
- `slideshowStart`
- `slideshowStop`
- `fullscreenChange`
- `close`
- `error`
- `destroy`

Example:

```js
FantasyBox.bind("[data-fantasybox]", {
  on: {
    open(payload) {
      console.log("opened", payload.index, payload.item);
    },
    change(payload) {
      console.log("changed", payload.previousIndex, payload.index);
    },
    error(payload) {
      console.error(payload.message);
    },
  },
});
```

Or later:

```js
const instance = FantasyBox.open([{ src: "large.jpg" }]);

FantasyBox.on(instance, "open", payload => {
  console.log(payload.instance.id);
});
```

## Public API

- `FantasyBox.open(items, options)`
- `FantasyBox.close()`
- `FantasyBox.bind(selector, options)`
- `FantasyBox.scan(options)`
- `FantasyBox.on(instance, eventName, handler)`
- `FantasyBox.off(instance, eventName, handler)`

## Hash Navigation

If `hash: true` is enabled, FantasyBox writes state into the URL hash.

This allows:

- direct linking to a gallery item
- restoring state when navigating with browser history
- opening bound galleries from hash state

If you want hash support for a specific bound group, use a stable group name:

```html
<a href="large-1.jpg" data-fantasybox="billing-gallery">...</a>
<a href="large-2.jpg" data-fantasybox="billing-gallery">...</a>
```

## Custom Styling

FantasyBox uses a dedicated class namespace:

```text
.fantasybox
.fantasybox__panel
.fantasybox__toolbar
.fantasybox__nav
.fantasybox__thumbs
.fantasybox__media
```

This makes it easy to scope custom styles. Example: hide navigation arrows on mobile for a specific instance:

```css
@media (max-width: 900px) {
  .fantasybox.is-mobile-navless .fantasybox__nav {
    display: none;
  }
}
```

Then add the custom class when the instance opens:

```js
FantasyBox.open(items, {
  on: {
    open(payload) {
      payload.instance.dom.root.classList.add("is-mobile-navless");
    },
  },
});
```

See [demo.html](file:///d:/flash/fantasybox/demo.html) for a working example.

## Browser Compatibility

This project is currently written against a conservative Safari baseline:

- target runtime: Safari on Intel macOS 10.15 system default
- do not assume users upgraded Safari manually

For details, see [SAFARI_10_15_COMPAT.md](file:///d:/flash/fantasybox/SAFARI_10_15_COMPAT.md).

## Demo

Open [demo.html](file:///d:/flash/fantasybox/demo.html) in a browser to try:

- grouped image galleries
- inline content
- Ajax content
- YouTube embeds
- iframe content
- event logging
- custom mobile styling demo
