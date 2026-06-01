# FantasyBox

`FantasyBox` 是一个无依赖的原创灯箱组件，支持图片、视频、YouTube、Vimeo、iframe、内联内容、Ajax 内容和自定义 HTML。

当前版本重点覆盖这些能力：

- 分组画廊浏览
- 键盘导航与焦点约束
- 缩略图
- 滚轮 / 双击 / 触控缩放
- 拖拽平移与左右滑动切换
- Hash 深链
- 全屏、下载、幻灯片播放

## 文件说明

- `fantasybox.js`：主脚本
- `fantasybox.css`：默认样式
- `demo.html`：演示页面
- `demo-ajax.html`：Ajax 内容演示
- `SAFARI_10_15_COMPAT.md`：Safari 10.15 兼容说明

## 快速开始

先引入样式和脚本：

```html
<link rel="stylesheet" href="./fantasybox.css" />
<script src="./fantasybox.js"></script>
```

然后写一组基础图片：

```html
<a href="large-1.jpg" data-fantasybox="gallery" data-caption="图片 1">
  <img src="thumb-1.jpg" alt="图片 1" />
</a>

<a href="large-2.jpg" data-fantasybox="gallery" data-caption="图片 2">
  <img src="thumb-2.jpg" alt="图片 2" />
</a>
```

最后绑定：

```html
<script>
  FantasyBox.bind("[data-fantasybox]", {
    loop: true,
    showCaption: true,
    showCounter: true,
    showThumbnails: true
  });
</script>
```

## 两种接入方式

### 1. 声明式绑定

适合页面上的缩略图和灯箱数据一一对应的场景：

```js
FantasyBox.bind("[data-fantasybox]", {
  hash: true,
  wheelZoom: true,
  dragToPan: true
});
```

也可以自动扫描常见属性：

```js
FantasyBox.scan();
```

`FantasyBox.scan()` 会绑定：

```text
[data-fantasybox], [data-lightbox], [data-gallery]
```

### 2. 编程式打开

适合数据来源于接口、JS 数组、或缩略图和完整相册不完全一致的场景：

```js
FantasyBox.open(
  [
    {
      src: "large-1.jpg",
      thumb: "thumb-1.jpg",
      caption: "图片 1",
      alt: "图片 1"
    },
    {
      src: "large-2.jpg",
      thumb: "thumb-2.jpg",
      caption: "图片 2",
      alt: "图片 2"
    }
  ],
  {
    startIndex: 0,
    showThumbnails: true
  }
);
```

关闭最上层实例：

```js
FantasyBox.close();
```

## 支持的内容类型

`FantasyBox` 可识别或显式接收以下类型：

- `image`
- `video`
- `embed`
- `iframe`
- `ajax`
- `inline`
- `html`

### 自动识别规则

- 图片扩展名：`jpg`、`jpeg`、`png`、`gif`、`webp`、`svg`、`avif`、`bmp`、`ico`
- 视频扩展名：`mp4`、`m4v`、`mov`、`ogv`、`ogg`、`webm`
- `YouTube / Vimeo` 链接会识别为 `embed`
- 以 `#` 开头的链接会识别为 `inline`

## 用例 1：视频展示

当前版本支持：

- HTML5 视频
- YouTube
- Vimeo
- 普通 iframe 视频页

### HTML5 视频示例

```html
<a
  href="./video/demo.mp4"
  data-fantasybox
  data-type="video"
  data-poster="./video/poster.jpg"
  data-caption="HTML5 视频示例"
>
  打开视频
</a>
```

### 直接用 JS 打开视频

```js
FantasyBox.open([
  {
    src: "./video/demo.mp4",
    type: "video",
    poster: "./video/poster.jpg",
    caption: "本地视频"
  },
  {
    src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    caption: "YouTube 视频"
  },
  {
    src: "https://vimeo.com/76979871",
    caption: "Vimeo 视频"
  }
]);
```

## 用例 2：页面只有 4 张入口图，但灯箱里实际浏览 20 张

这是“少量 HTML 入口 + 大量 JS 数据”的混合模式。

适合：

- 首屏只展示 4 张封面图
- 点击后浏览完整 20 张账单、报表、相册数据
- 完整数据来自接口或 JS 数组，而不是全部写进 HTML

### HTML 只放 4 个入口

```html
<div class="report-gallery">
  <button type="button" data-open-report-gallery data-start-index="0">第 1 组入口</button>
  <button type="button" data-open-report-gallery data-start-index="5">第 6 组入口</button>
  <button type="button" data-open-report-gallery data-start-index="10">第 11 组入口</button>
  <button type="button" data-open-report-gallery data-start-index="15">第 16 组入口</button>
</div>
```

### JS 里维护完整 20 条数据

```js
const allImages = Array.from({ length: 20 }, (_, index) => ({
  src: `./images/${index + 1}.jpg`,
  thumb: `./thumbs/${index + 1}.jpg`,
  caption: `第 ${index + 1} 张`,
  alt: `第 ${index + 1} 张`
}));

document.querySelectorAll("[data-open-report-gallery]").forEach(node => {
  node.addEventListener("click", () => {
    const startIndex = Number(node.dataset.startIndex || 0);

    FantasyBox.open(allImages, {
      startIndex,
      showThumbnails: true,
      hash: "report-gallery"
    });
  });
});
```

这类场景更推荐使用 `FantasyBox.open()`，而不是 `FantasyBox.bind()`。

## Inline / Ajax / 自定义 HTML

### Inline 内容

```html
<button
  type="button"
  data-fantasybox
  data-src="#dialog-content"
  data-type="inline"
  data-caption="内联内容示例"
>
  打开内联内容
</button>

<div id="dialog-content" style="display:none;">
  <h2>内联内容</h2>
  <p>这段内容会被渲染到灯箱内部。</p>
</div>
```

### Ajax 内容

```html
<a
  href="./demo-ajax.html"
  data-fantasybox
  data-type="ajax"
  data-caption="Ajax 示例"
>
  打开 Ajax 内容
</a>
```

### 自定义 HTML

```js
FantasyBox.open([
  {
    type: "html",
    html: "<div style='padding:24px'>自定义 HTML 内容</div>",
    caption: "自定义 HTML"
  }
]);
```

## 支持的数据属性

使用 DOM 绑定时，支持这些属性：

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

## 常用选项

`FantasyBox.open()` 和 `FantasyBox.bind()` 目前暴露的主要选项如下：

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
    loading: "Loading"
  },
  on: {}
}
```

## 事件

可以通过 `on` 选项传入回调，也可以在实例创建后通过 `FantasyBox.on(instance, eventName, handler)` 订阅。

常用事件：

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

示例：

```js
FantasyBox.bind("[data-fantasybox]", {
  on: {
    open(payload) {
      console.log("打开", payload.index, payload.item);
    },
    change(payload) {
      console.log("切换", payload.previousIndex, payload.index);
    },
    error(payload) {
      console.error(payload.message);
    }
  }
});
```

或在实例创建后绑定：

```js
const instance = FantasyBox.open([{ src: "large.jpg" }]);

FantasyBox.on(instance, "open", payload => {
  console.log(payload.instance.id);
});
```

## 公共 API

- `FantasyBox.open(items, options)`
- `FantasyBox.close()`
- `FantasyBox.bind(selector, options)`
- `FantasyBox.scan(options)`
- `FantasyBox.on(instance, eventName, handler)`
- `FantasyBox.off(instance, eventName, handler)`

## Hash 导航

启用 `hash: true` 后，`FantasyBox` 会把当前状态写入 URL hash。

目前支持：

- 直接链接到某个分组和索引
- 浏览器前进 / 后退恢复状态
- 页面刷新后按 hash 自动打开已绑定分组

如果你要稳定使用 hash，请给分组一个稳定名称：

```html
<a href="large-1.jpg" data-fantasybox="billing-gallery">...</a>
<a href="large-2.jpg" data-fantasybox="billing-gallery">...</a>
```

如果你是用 `FantasyBox.open()` 手动打开，也可以直接传稳定的字符串：

```js
FantasyBox.open(items, {
  hash: "billing-gallery"
});
```

## 自定义样式

`FantasyBox` 使用独立类名前缀，便于局部覆写：

```text
.fantasybox
.fantasybox__panel
.fantasybox__toolbar
.fantasybox__nav
.fantasybox__thumbs
.fantasybox__media
```

例如：某个实例在移动端隐藏左右箭头：

```css
@media (max-width: 900px) {
  .fantasybox.is-mobile-navless .fantasybox__nav {
    display: none;
  }
}
```

然后在打开时加类：

```js
FantasyBox.open(items, {
  on: {
    open(payload) {
      payload.instance.dom.root.classList.add("is-mobile-navless");
    }
  }
});
```

可直接参考 [demo.html](file:///d:/src/fantasybox/demo.html)。

## 兼容性

当前项目主要按现代浏览器编写，不考虑：

- IE
- iOS Safari 10.3 以下版本

补充说明见 [SAFARI_10_15_COMPAT.md](file:///d:/src/fantasybox/SAFARI_10_15_COMPAT.md)。

## Demo

直接打开 [demo.html](file:///d:/src/fantasybox/demo.html) 可以验证：

- 两组基础图片画廊
- 4 张 HTML 入口 + 20 条 JS 数据
- HTML5 视频
- YouTube / Vimeo
- inline 内容
- Ajax 内容
- iframe 内容
- 事件日志
- 定制移动端样式示例
