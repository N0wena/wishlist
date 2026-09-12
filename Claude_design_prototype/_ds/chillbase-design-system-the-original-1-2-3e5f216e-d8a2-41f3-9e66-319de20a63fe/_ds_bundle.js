/* @ds-bundle: {"format":4,"namespace":"ChillBaseDesignSystemTheOriginal_3e5f21","components":[],"sourceHashes":{"assets/bg-remove.js":"a043eb91ab67","assets/chart-extract.js":"f89c5b13d809","assets/deck-stage.js":"522102a1c71e","assets/i18n.js":"b0bd2e0cda80","assets/thumbs.js":"4a98fa2b33fd","assets/tweaks.js":"55a4822afcb8","deck-stage.js":"522102a1c71e","skills/chillbase-particle-dissolve/icons.js":"5fffcdd0f7c9","ui_kits/hr_presentation/frame.jsx":"bf0162e19fdc","ui_kits/hr_presentation/slides.jsx":"9e53bd29d9f0","ui_kits/presentation/slides.jsx":"3a230c379f7b","ui_kits/presentation_template/frame.jsx":"16d0633d80dc","ui_kits/presentation_template/slides.jsx":"e37aab42a597","ui_kits/presentation_template/slides_extra.jsx":"f4dfdddbb601"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ChillBaseDesignSystemTheOriginal_3e5f21 = window.ChillBaseDesignSystemTheOriginal_3e5f21 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/bg-remove.js
try { (() => {
/* ============================================================
   CHILLBASE • Background removal
   Flood fill от краёв + feathering + анти-алиасинг
   Работает если фон однородный (белый/светлый/один цвет)
   ============================================================ */

(function (global) {
  // Детектор: подходит ли картинка для auto-удаления фона?
  // Смотрим на 4 угла — если все близки по цвету и светлые → да
  async function shouldAutoRemove(imgSrc) {
    try {
      const img = await loadImg(imgSrc);
      const c = document.createElement('canvas');
      const w = Math.min(img.naturalWidth, 200);
      const h = Math.min(img.naturalHeight, 200);
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const corners = [ctx.getImageData(0, 0, 5, 5).data, ctx.getImageData(w - 5, 0, 5, 5).data, ctx.getImageData(0, h - 5, 5, 5).data, ctx.getImageData(w - 5, h - 5, 5, 5).data];
      const avgs = corners.map(avg);
      // все 4 угла светлые (r+g+b > 600)?
      const bright = avgs.every(a => a[0] + a[1] + a[2] > 600);
      // все 4 угла близки между собой?
      const base = avgs[0];
      const close = avgs.every(a => Math.abs(a[0] - base[0]) < 25 && Math.abs(a[1] - base[1]) < 25 && Math.abs(a[2] - base[2]) < 25);
      return bright && close;
    } catch (e) {
      return false;
    }
  }

  // Main: удаление фона качественно
  async function removeBackground(imgSrc, opts = {}) {
    const img = await loadImg(imgSrc);
    const w = img.naturalWidth,
      h = img.naturalHeight;
    // ограничим большие картинки для скорости
    const scale = Math.min(1, 1400 / Math.max(w, h));
    const W = Math.round(w * scale),
      H = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    const imgData = ctx.getImageData(0, 0, W, H);
    const pixels = imgData.data;

    // Берём цвет фона из 4 углов как медиану
    const bgColor = sampleBg(pixels, W, H);
    const tolerance = opts.tolerance ?? 32;

    // flood fill от всех 4 краёв
    const mask = new Uint8Array(W * H); // 0 = keep, 1 = remove
    const queue = [];
    for (let x = 0; x < W; x++) {
      queue.push(x, x + (H - 1) * W);
    }
    for (let y = 0; y < H; y++) {
      queue.push(y * W, W - 1 + y * W);
    }

    // начальная проверка краёв — если пиксель похож на bg, помечаем и в очередь
    const seed = [];
    queue.forEach(idx => {
      if (!mask[idx] && colorClose(pixels, idx * 4, bgColor, tolerance)) {
        mask[idx] = 1;
        seed.push(idx);
      }
    });

    // BFS flood fill
    const toVisit = seed;
    while (toVisit.length) {
      const idx = toVisit.pop();
      const x = idx % W,
        y = idx / W | 0;
      const neighbors = [];
      if (x > 0) neighbors.push(idx - 1);
      if (x < W - 1) neighbors.push(idx + 1);
      if (y > 0) neighbors.push(idx - W);
      if (y < H - 1) neighbors.push(idx + W);
      neighbors.forEach(ni => {
        if (!mask[ni] && colorClose(pixels, ni * 4, bgColor, tolerance)) {
          mask[ni] = 1;
          toVisit.push(ni);
        }
      });
    }

    // Feathering: помечаем как semi-transparent пиксели, которые близки к bg, но не достаточно,
    // и которые граничат с прозрачной областью
    const alphaMask = new Uint8ClampedArray(W * H);
    for (let i = 0; i < mask.length; i++) alphaMask[i] = mask[i] ? 0 : 255;

    // Мягкий край: для каждого keep-пикселя смотрим, насколько близок к bg — редуцируем alpha
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        if (mask[idx]) continue;
        // есть ли сосед-фон?
        const hasBgNeighbor = mask[idx - 1] || mask[idx + 1] || mask[idx - W] || mask[idx + W];
        if (!hasBgNeighbor) continue;
        const p = idx * 4;
        const d = colorDist(pixels, p, bgColor);
        // плавный переход в зоне tolerance..tolerance*2
        if (d < tolerance * 1.5) {
          const a = Math.min(255, Math.max(0, (d - tolerance * 0.5) / tolerance * 255));
          alphaMask[idx] = a;
        }
      }
    }

    // второй проход — чуть «размываем» альфу 3x3 средним, для анти-алиасинга
    const alphaSmoothed = new Uint8ClampedArray(alphaMask);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        let sum = alphaMask[idx] * 4;
        sum += alphaMask[idx - 1] + alphaMask[idx + 1] + alphaMask[idx - W] + alphaMask[idx + W];
        sum += (alphaMask[idx - 1 - W] + alphaMask[idx + 1 - W] + alphaMask[idx - 1 + W] + alphaMask[idx + 1 + W]) * 0.5;
        alphaSmoothed[idx] = sum / 10;
      }
    }

    // применяем альфу
    for (let i = 0; i < W * H; i++) {
      pixels[i * 4 + 3] = alphaSmoothed[i];
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  // ---- helpers ----
  function loadImg(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }
  function avg(data) {
    let r = 0,
      g = 0,
      b = 0,
      n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return [r / n, g / n, b / n];
  }
  function sampleBg(pixels, W, H) {
    const samples = [];
    const add = (x, y) => {
      const i = (y * W + x) * 4;
      samples.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
    };
    // 4 угла, 3x3 каждый
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      add(dx, dy);
      add(W - 1 - dx, dy);
      add(dx, H - 1 - dy);
      add(W - 1 - dx, H - 1 - dy);
    }
    // медиана по каждому каналу
    const med = ch => {
      const arr = samples.map(s => s[ch]).sort((a, b) => a - b);
      return arr[Math.floor(arr.length / 2)];
    };
    return [med(0), med(1), med(2)];
  }
  function colorClose(pixels, p, bg, tol) {
    return colorDist(pixels, p, bg) < tol;
  }
  function colorDist(pixels, p, bg) {
    const dr = pixels[p] - bg[0];
    const dg = pixels[p + 1] - bg[1];
    const db = pixels[p + 2] - bg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }
  global.CBBgRemove = {
    removeBackground,
    shouldAutoRemove
  };
})(window);
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/bg-remove.js", error: String((e && e.message) || e) }); }

// assets/chart-extract.js
try { (() => {
/* =========================================================
   chart-extract.js
   Извлекает настоящие чарты (chart1.xml) из PPTX
   и возвращает их как === chart === маркеры для doc-generator
   ========================================================= */
(function (global) {
  'use strict';

  const parser = new DOMParser();

  // Пройти по элементам чарта и распарсить категории + серии
  function parseChartXml(xmlStr) {
    const doc = parser.parseFromString(xmlStr, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length) return null;

    // Определить тип чарта
    const plotArea = doc.getElementsByTagName('c:plotArea')[0];
    if (!plotArea) return null;
    let chartType = 'bar';
    if (plotArea.getElementsByTagName('c:lineChart').length) chartType = 'line';else if (plotArea.getElementsByTagName('c:pieChart').length || plotArea.getElementsByTagName('c:doughnutChart').length) chartType = 'pie';else if (plotArea.getElementsByTagName('c:barChart').length) {
      // горизонтальный или вертикальный?
      const barChart = plotArea.getElementsByTagName('c:barChart')[0];
      const barDir = barChart.getElementsByTagName('c:barDir')[0];
      if (barDir && barDir.getAttribute('val') === 'col') chartType = 'bar';else chartType = 'bar'; // hbar обрабатывается отдельно в рендере
    } else if (plotArea.getElementsByTagName('c:areaChart').length) chartType = 'area';

    // Заголовок
    let title = '';
    const titleEl = doc.getElementsByTagName('c:title')[0];
    if (titleEl) {
      const runs = titleEl.getElementsByTagName('a:t');
      title = [...runs].map(r => r.textContent).join(' ').trim();
    }

    // Берём ПЕРВУЮ серию (ser) — этого достаточно для простого чарта
    const sers = plotArea.getElementsByTagName('c:ser');
    if (!sers.length) return null;
    const ser = sers[0];

    // Категории (x-axis labels)
    const cat = ser.getElementsByTagName('c:cat')[0];
    let categories = [];
    if (cat) {
      const strCache = cat.getElementsByTagName('c:strCache')[0] || cat.getElementsByTagName('c:numCache')[0];
      if (strCache) {
        const pts = strCache.getElementsByTagName('c:pt');
        categories = [...pts].sort((a, b) => +a.getAttribute('idx') - +b.getAttribute('idx')).map(p => {
          const v = p.getElementsByTagName('c:v')[0];
          return v ? v.textContent : '';
        });
      }
    }

    // Значения
    const val = ser.getElementsByTagName('c:val')[0];
    let values = [];
    if (val) {
      const numCache = val.getElementsByTagName('c:numCache')[0];
      if (numCache) {
        const pts = numCache.getElementsByTagName('c:pt');
        values = [...pts].sort((a, b) => +a.getAttribute('idx') - +b.getAttribute('idx')).map(p => {
          const v = p.getElementsByTagName('c:v')[0];
          const n = v ? parseFloat(v.textContent) : NaN;
          return isNaN(n) ? 0 : n;
        });
      }
    }
    if (!categories.length || !values.length) return null;

    // Имя серии
    let seriesName = '';
    const tx = ser.getElementsByTagName('c:tx')[0];
    if (tx) {
      const strRef = tx.getElementsByTagName('c:strCache')[0];
      if (strRef) {
        const v = strRef.getElementsByTagName('c:v')[0];
        seriesName = v ? v.textContent : '';
      }
    }
    return {
      type: chartType,
      title: title || seriesName || '',
      categories,
      values
    };
  }

  /** Извлечь все чарты со слайда */
  async function extractChartsFromSlide(zip, slidePath, relMap) {
    const charts = [];
    // ищем в relMap ссылки на ../charts/chart*.xml
    for (const relId in relMap) {
      const target = relMap[relId];
      if (!target || !/charts\/chart\d+\.xml$/i.test(target)) continue;
      const chartPath = target.replace('../', '');
      const file = zip.files[chartPath] || zip.files['ppt/' + chartPath] || zip.file(chartPath);
      if (!file) continue;
      try {
        const xml = await file.async('string');
        const parsed = parseChartXml(xml);
        if (parsed) charts.push(parsed);
      } catch (e) {/* skip */}
    }
    return charts;
  }

  /** Перевести в маркерный формат doc-generator */
  function toMarkerString(chart, caption) {
    const lines = ['=== chart ==='];
    lines.push('type: ' + chart.type);
    if (chart.title) lines.push('title: ' + chart.title);
    lines.push('labels: ' + chart.categories.join(', '));
    lines.push('values: ' + chart.values.join(', '));
    if (caption) lines.push('caption: ' + caption);
    return lines.join('\n');
  }
  global.CBChartExtract = {
    parseChartXml,
    extractChartsFromSlide,
    toMarkerString
  };
})(window);
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/chart-extract.js", error: String((e && e.message) || e) }); }

// assets/deck-stage.js
try { (() => {
/**
 * <deck-stage> — reusable web component for HTML decks.
 *
 * Handles:
 *  (a) speaker notes — reads <script type="application/json" id="speaker-notes">
 *      and posts {slideIndexChanged: N} to the parent window on nav.
 *  (b) keyboard navigation — ←/→, PgUp/PgDn, Space, Home/End, number keys.
 *  (c) press R to reset to slide 0 (with a tasteful keyboard hint).
 *  (d) bottom-center overlay showing slide count + hints, fades out on idle.
 *  (e) auto-scaling — inner canvas is a fixed design size (default 1920×1080)
 *      scaled with `transform: scale()` to fit the viewport, letterboxed.
 *      Set the `noscale` attribute to render at authored size (1:1) — the
 *      PPTX exporter sets this so its DOM capture sees unscaled geometry.
 *  (f) print — `@media print` lays every slide out as its own page at the
 *      design size, so the browser's Print → Save as PDF produces a clean
 *      one-page-per-slide PDF with no extra setup.
 *
 * Slides are HIDDEN, not unmounted. Non-active slides stay in the DOM with
 * `visibility: hidden` + `opacity: 0`, so their state (videos, iframes,
 * form inputs, React trees) is preserved across navigation.
 *
 * Lifecycle event — the component dispatches a `slidechange` CustomEvent on
 * itself whenever the active slide changes (including the initial mount).
 * The event bubbles and composes out of shadow DOM, so you can listen on
 * the <deck-stage> element or on document:
 *
 *   document.querySelector('deck-stage').addEventListener('slidechange', (e) => {
 *     e.detail.index         // new 0-based index
 *     e.detail.previousIndex // previous index, or -1 on init
 *     e.detail.total         // total slide count
 *     e.detail.slide         // the new active slide element
 *     e.detail.previousSlide // the prior slide element, or null on init
 *     e.detail.reason        // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
 *   });
 *
 * Persistence: current slide index is saved to localStorage keyed by the
 * document path, so refresh returns you to the same place.
 *
 * Usage:
 *   <deck-stage width="1920" height="1080">
 *     <section data-label="Title">...</section>
 *     <section data-label="Agenda">...</section>
 *   </deck-stage>
 *
 * Slides are the direct element children of <deck-stage>. Each slide is
 * automatically tagged with:
 *   - data-screen-label="NN Label"   (1-indexed, for comment flow)
 *   - data-om-validate="no_overflowing_text,no_overlapping_text,slide_sized_text"
 */

(() => {
  const DESIGN_W_DEFAULT = 1920;
  const DESIGN_H_DEFAULT = 1080;
  const STORAGE_PREFIX = 'deck-stage:slide:';
  const OVERLAY_HIDE_MS = 1800;
  const VALIDATE_ATTR = 'no_overflowing_text,no_overlapping_text,slide_sized_text';
  const pad2 = n => String(n).padStart(2, '0');
  const stylesheet = `
    :host {
      position: fixed;
      inset: 0;
      display: block;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      overflow: hidden;
    }

    .stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .canvas {
      position: relative;
      transform-origin: center center;
      flex-shrink: 0;
      background: #fff;
      will-change: transform;
    }

    /* Slides live in light DOM (via <slot>) so authored CSS still applies.
       We absolutely position each slotted child to stack them. */
    ::slotted(*) {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }
    ::slotted([data-deck-active]) {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
    }

    /* Tap zones for mobile — back/forward thirds like Stories.
       Transparent, no visible UI, don't block the overlay. */
    .tapzones {
      position: fixed;
      inset: 0;
      display: flex;
      z-index: 2147482000;
      pointer-events: none;
    }
    .tapzone {
      flex: 1;
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;
    }
    /* Only activate tap zones on coarse pointers (touch devices). */
    @media (hover: hover) and (pointer: fine) {
      .tapzones { display: none; }
    }

    .overlay {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translate(-50%, 6px) scale(0.92);
      filter: blur(6px);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      background: #000;
      color: #fff;
      border-radius: 999px;
      font-size: 12px;
      font-feature-settings: "tnum" 1;
      letter-spacing: 0.01em;
      opacity: 0;
      pointer-events: none;
      transition: opacity 260ms ease, transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease;
      transform-origin: center bottom;
      z-index: 2147483000;
      user-select: none;
    }
    .overlay[data-visible] {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, 0) scale(1);
      filter: blur(0);
    }

    .btn {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      margin: 0;
      padding: 0;
      color: inherit;
      font: inherit;
      cursor: default;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      min-width: 28px;
      border-radius: 999px;
      color: rgba(255,255,255,0.72);
      transition: background 140ms ease, color 140ms ease;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .btn:active { background: rgba(255,255,255,0.18); }
    .btn:focus { outline: none; }
    .btn:focus-visible { outline: none; }
    .btn::-moz-focus-inner { border: 0; }
    .btn svg { width: 14px; height: 14px; display: block; }
    .btn.reset {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      padding: 0 10px 0 12px;
      gap: 6px;
      color: rgba(255,255,255,0.72);
    }
    .btn.reset .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 10px;
      line-height: 1;
      color: rgba(255,255,255,0.88);
      background: rgba(255,255,255,0.12);
      border-radius: 4px;
    }

    .count {
      font-variant-numeric: tabular-nums;
      color: #fff;
      font-weight: 500;
      padding: 0 8px;
      min-width: 42px;
      text-align: center;
      font-size: 12px;
    }
    .count .sep { color: rgba(255,255,255,0.45); margin: 0 3px; font-weight: 400; }
    .count .total { color: rgba(255,255,255,0.55); }

    .divider {
      width: 1px;
      height: 14px;
      background: rgba(255,255,255,0.18);
      margin: 0 2px;
    }

    /* ── Print: one page per slide, no chrome ────────────────────────────
       The screen layout stacks every slide at inset:0 inside a scaled
       canvas; for print we want them in document flow at the authored
       design size so the browser paginates one slide per sheet. The
       @page size is set from the width/height attributes via the inline
       <style id="deck-stage-print-page"> that connectedCallback injects
       into <head> (the @page at-rule has no effect inside shadow DOM). */
    @media print {
      :host {
        position: static;
        inset: auto;
        background: none;
        overflow: visible;
        color: inherit;
      }
      .stage { position: static; display: block; }
      .canvas {
        transform: none !important;
        width: auto !important;
        height: auto !important;
        background: none;
        will-change: auto;
      }
      ::slotted(*) {
        position: relative !important;
        inset: auto !important;
        width: var(--deck-design-w) !important;
        height: var(--deck-design-h) !important;
        box-sizing: border-box !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto;
        break-after: page;
        page-break-after: always;
        break-inside: avoid;
        overflow: hidden;
      }
      ::slotted(*:last-child) {
        break-after: auto;
        page-break-after: auto;
      }
      .overlay, .tapzones { display: none !important; }
    }
  `;
  class DeckStage extends HTMLElement {
    static get observedAttributes() {
      return ['width', 'height', 'noscale'];
    }
    constructor() {
      super();
      this._root = this.attachShadow({
        mode: 'open'
      });
      this._index = 0;
      this._slides = [];
      this._notes = [];
      this._hideTimer = null;
      this._mouseIdleTimer = null;
      this._storageKey = STORAGE_PREFIX + (location.pathname || '/');
      this._onKey = this._onKey.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onSlotChange = this._onSlotChange.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onTapBack = this._onTapBack.bind(this);
      this._onTapForward = this._onTapForward.bind(this);
    }
    get designWidth() {
      return parseInt(this.getAttribute('width'), 10) || DESIGN_W_DEFAULT;
    }
    get designHeight() {
      return parseInt(this.getAttribute('height'), 10) || DESIGN_H_DEFAULT;
    }
    connectedCallback() {
      this._render();
      this._loadNotes();
      this._syncPrintPageRule();
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('mousemove', this._onMouseMove, {
        passive: true
      });
      // Initial collection + layout happens via slotchange, which fires on mount.
    }
    disconnectedCallback() {
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMouseMove);
      if (this._hideTimer) clearTimeout(this._hideTimer);
      if (this._mouseIdleTimer) clearTimeout(this._mouseIdleTimer);
    }
    attributeChangedCallback() {
      if (this._canvas) {
        this._canvas.style.width = this.designWidth + 'px';
        this._canvas.style.height = this.designHeight + 'px';
        this._canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
        this._canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
        this._fit();
        this._syncPrintPageRule();
      }
    }
    _render() {
      const style = document.createElement('style');
      style.textContent = stylesheet;
      const stage = document.createElement('div');
      stage.className = 'stage';
      const canvas = document.createElement('div');
      canvas.className = 'canvas';
      canvas.style.width = this.designWidth + 'px';
      canvas.style.height = this.designHeight + 'px';
      canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
      canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
      const slot = document.createElement('slot');
      slot.addEventListener('slotchange', this._onSlotChange);
      canvas.appendChild(slot);
      stage.appendChild(canvas);

      // Tap zones (mobile): left third = back, right third = forward.
      const tapzones = document.createElement('div');
      tapzones.className = 'tapzones export-hidden';
      tapzones.setAttribute('aria-hidden', 'true');
      const tzBack = document.createElement('div');
      tzBack.className = 'tapzone tapzone--back';
      const tzMid = document.createElement('div');
      tzMid.className = 'tapzone tapzone--mid';
      tzMid.style.pointerEvents = 'none';
      const tzFwd = document.createElement('div');
      tzFwd.className = 'tapzone tapzone--fwd';
      tzBack.addEventListener('click', this._onTapBack);
      tzFwd.addEventListener('click', this._onTapForward);
      tapzones.append(tzBack, tzMid, tzFwd);

      // Overlay: compact, solid black, with clickable controls.
      const overlay = document.createElement('div');
      overlay.className = 'overlay export-hidden';
      overlay.setAttribute('role', 'toolbar');
      overlay.setAttribute('aria-label', 'Deck controls');
      overlay.innerHTML = `
        <button class="btn prev" type="button" aria-label="Previous slide" title="Previous (←)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>
        </button>
        <span class="count" aria-live="polite"><span class="current">1</span><span class="sep">/</span><span class="total">1</span></span>
        <button class="btn next" type="button" aria-label="Next slide" title="Next (→)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>
        </button>
        <span class="divider"></span>
        <button class="btn reset" type="button" aria-label="Reset to first slide" title="Reset (R)">Reset<span class="kbd">R</span></button>
      `;
      overlay.querySelector('.prev').addEventListener('click', () => this._go(this._index - 1, 'click'));
      overlay.querySelector('.next').addEventListener('click', () => this._go(this._index + 1, 'click'));
      overlay.querySelector('.reset').addEventListener('click', () => this._go(0, 'click'));
      this._root.append(style, stage, tapzones, overlay);
      this._canvas = canvas;
      this._slot = slot;
      this._overlay = overlay;
      this._countEl = overlay.querySelector('.current');
      this._totalEl = overlay.querySelector('.total');
    }

    /** @page must live in the document stylesheet — it's a no-op inside
     *  shadow DOM. Inject/update a single <head> style tag so the print
     *  sheet matches the design size and Save-as-PDF yields one slide per
     *  page with no margins. */
    _syncPrintPageRule() {
      const id = 'deck-stage-print-page';
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
        document.head.appendChild(tag);
      }
      tag.textContent = '@page { size: ' + this.designWidth + 'px ' + this.designHeight + 'px; margin: 0; } ' + '@media print { html, body { margin: 0 !important; padding: 0 !important; background: none !important; overflow: visible !important; height: auto !important; } ' + '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }';
    }
    _onSlotChange() {
      this._collectSlides();
      this._restoreIndex();
      this._applyIndex({
        showOverlay: false,
        broadcast: true,
        reason: 'init'
      });
      this._fit();
    }
    _collectSlides() {
      const assigned = this._slot.assignedElements({
        flatten: true
      });
      this._slides = assigned.filter(el => {
        // Skip template/style/script nodes even if someone slots them.
        const tag = el.tagName;
        return tag !== 'TEMPLATE' && tag !== 'SCRIPT' && tag !== 'STYLE';
      });
      this._slides.forEach((slide, i) => {
        const n = i + 1;
        // Determine a label for comment flow: prefer explicit data-label,
        // then an existing data-screen-label, then first heading, else "Slide".
        let label = slide.getAttribute('data-label');
        if (!label) {
          const existing = slide.getAttribute('data-screen-label');
          if (existing) {
            // Strip any leading number the author may have included.
            label = existing.replace(/^\s*\d+\s*/, '').trim() || existing;
          }
        }
        if (!label) {
          const h = slide.querySelector('h1, h2, h3, [data-title]');
          if (h) label = (h.textContent || '').trim().slice(0, 40);
        }
        if (!label) label = 'Slide';
        slide.setAttribute('data-screen-label', `${pad2(n)} ${label}`);

        // Validation attribute for comment flow / auto-checks.
        if (!slide.hasAttribute('data-om-validate')) {
          slide.setAttribute('data-om-validate', VALIDATE_ATTR);
        }
        slide.setAttribute('data-deck-slide', String(i));
      });
      if (this._totalEl) this._totalEl.textContent = String(this._slides.length || 1);
      if (this._index >= this._slides.length) this._index = Math.max(0, this._slides.length - 1);
    }
    _loadNotes() {
      const tag = document.getElementById('speaker-notes');
      if (!tag) {
        this._notes = [];
        return;
      }
      try {
        const parsed = JSON.parse(tag.textContent || '[]');
        if (Array.isArray(parsed)) this._notes = parsed;
      } catch (e) {
        console.warn('[deck-stage] Failed to parse #speaker-notes JSON:', e);
        this._notes = [];
      }
    }
    _restoreIndex() {
      try {
        const raw = localStorage.getItem(this._storageKey);
        if (raw != null) {
          const n = parseInt(raw, 10);
          if (Number.isFinite(n) && n >= 0 && n < this._slides.length) {
            this._index = n;
          }
        }
      } catch (e) {/* ignore */}
    }
    _persistIndex() {
      try {
        localStorage.setItem(this._storageKey, String(this._index));
      } catch (e) {/* ignore */}
    }
    _applyIndex({
      showOverlay = true,
      broadcast = true,
      reason = 'init'
    } = {}) {
      if (!this._slides.length) return;
      const prev = this._prevIndex == null ? -1 : this._prevIndex;
      const curr = this._index;
      this._slides.forEach((s, i) => {
        if (i === curr) s.setAttribute('data-deck-active', '');else s.removeAttribute('data-deck-active');
      });
      if (this._countEl) this._countEl.textContent = String(curr + 1);
      this._persistIndex();
      if (broadcast) {
        // (1) Legacy: host-window postMessage for speaker-notes renderers.
        try {
          window.postMessage({
            slideIndexChanged: curr
          }, '*');
        } catch (e) {}

        // (2) In-page CustomEvent on the <deck-stage> element itself.
        //     Bubbles and composes out of shadow DOM so slide code can listen:
        //       document.querySelector('deck-stage').addEventListener('slidechange', e => {
        //         e.detail.index, e.detail.previousIndex, e.detail.total, e.detail.slide, e.detail.reason
        //       });
        const detail = {
          index: curr,
          previousIndex: prev,
          total: this._slides.length,
          slide: this._slides[curr] || null,
          previousSlide: prev >= 0 ? this._slides[prev] || null : null,
          reason: reason // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
        };
        this.dispatchEvent(new CustomEvent('slidechange', {
          detail,
          bubbles: true,
          composed: true
        }));
      }
      this._prevIndex = curr;
      if (showOverlay) this._flashOverlay();
    }
    _flashOverlay() {
      if (!this._overlay) return;
      this._overlay.setAttribute('data-visible', '');
      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        this._overlay.removeAttribute('data-visible');
      }, OVERLAY_HIDE_MS);
    }
    _fit() {
      if (!this._canvas) return;
      // PPTX export sets noscale so the DOM capture sees authored-size
      // geometry — the scaled canvas is in shadow DOM, so the exporter's
      // resetTransformSelector can't reach .canvas.style.transform directly.
      if (this.hasAttribute('noscale')) {
        this._canvas.style.transform = 'none';
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s = Math.min(vw / this.designWidth, vh / this.designHeight);
      this._canvas.style.transform = `scale(${s})`;
    }
    _onResize() {
      this._fit();
    }
    _onMouseMove() {
      // Keep overlay visible while mouse moves; hide after idle.
      this._flashOverlay();
    }
    _onTapBack(e) {
      e.preventDefault();
      this._go(this._index - 1, 'tap');
    }
    _onTapForward(e) {
      e.preventDefault();
      this._go(this._index + 1, 'tap');
    }
    _onKey(e) {
      // Ignore when the user is typing.
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      let handled = true;
      if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Spacebar') {
        this._go(this._index + 1, 'keyboard');
      } else if (key === 'ArrowLeft' || key === 'PageUp') {
        this._go(this._index - 1, 'keyboard');
      } else if (key === 'Home') {
        this._go(0, 'keyboard');
      } else if (key === 'End') {
        this._go(this._slides.length - 1, 'keyboard');
      } else if (key === 'r' || key === 'R') {
        this._go(0, 'keyboard');
      } else if (/^[0-9]$/.test(key)) {
        // 1..9 jump to that slide; 0 jumps to 10.
        const n = key === '0' ? 9 : parseInt(key, 10) - 1;
        if (n < this._slides.length) this._go(n, 'keyboard');
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        this._flashOverlay();
      }
    }
    _go(i, reason = 'api') {
      if (!this._slides.length) return;
      const clamped = Math.max(0, Math.min(this._slides.length - 1, i));
      if (clamped === this._index) {
        this._flashOverlay();
        return;
      }
      this._index = clamped;
      this._applyIndex({
        showOverlay: true,
        broadcast: true,
        reason
      });
    }

    // Public API ------------------------------------------------------------

    /** Current slide index (0-based). */
    get index() {
      return this._index;
    }
    /** Total slide count. */
    get length() {
      return this._slides.length;
    }
    /** Programmatically navigate. */
    goTo(i) {
      this._go(i, 'api');
    }
    next() {
      this._go(this._index + 1, 'api');
    }
    prev() {
      this._go(this._index - 1, 'api');
    }
    reset() {
      this._go(0, 'api');
    }
  }
  if (!customElements.get('deck-stage')) {
    customElements.define('deck-stage', DeckStage);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/deck-stage.js", error: String((e && e.message) || e) }); }

// assets/i18n.js
try { (() => {
/* ChillBase — i18n словарь */
window.CB_DICT = {
  ru: {
    "brand": "ChillBase — Identity",
    "nav.philosophy": "Философия",
    "nav.logo": "Логотип",
    "nav.color": "Цвет",
    "nav.type": "Типографика",
    "nav.pattern": "Паттерны",
    "nav.imagery": "Изображения",
    "nav.templates": "Шаблоны",
    "hero.line1": "Айдентика",
    "hero.line2": "бренда",
    "hero.line3": "Chillbase",
    "hero.sub": "Живая система дизайна: редактируемые токены, готовые компоненты для презентаций, правила применения айдентики. Всё под капотом — прозрачные CSS-переменные, которые можно править и расширять.",
    "hero.meta": "Версия 1.0 · Ru/En · 2026",
    "hero.cta1": "Начать тур",
    "hero.cta2": "Шаблоны слайдов →",
    "hero.scroll": "Scroll",
    "frame.philosophy": "Философия",
    "frame.logo": "Логотип",
    "frame.color": "Цвета",
    "frame.type": "Типографика",
    "frame.pattern": "Паттерны",
    "frame.imagery": "Рендеры",
    "frame.templates": "Шаблоны",
    "frame.end": "The End",
    "eyebrow.manifesto": "Манифест",
    "eyebrow.logo": "02 — Logo",
    "eyebrow.color": "05 — Color",
    "eyebrow.type": "03 — Typography",
    "eyebrow.pattern": "04 — Patterns",
    "eyebrow.imagery": "08 — Imagery",
    "eyebrow.templates": "11 — Templates",
    "philo.title": "Смелость, дерзость, подлинность",
    "philo.body1": "Наша студия основана на <em>смелых инновациях</em> и дерзком вызове. Мы не просто следуем за тенденциями — мы бросаем им вызов, перешагивая границы и заново определяя, что такое игра.",
    "philo.body2": "Каждое решение направлено на создание чего-то действительно оригинального. Для нас смелые инновации — <em>правило, а не исключение</em>. Бесстрашие, дерзость и подлинная уникальность — наш путь.",
    "logo.title": "Знак и словесный знак",
    "logo.lede": "Логотип состоит из двух элементов — иконки и словесного знака. Значок можно использовать вместе со словесным знаком или отдельно. Ни в коем случае нельзя изменять, искажать или перерисовывать логотип.",
    "logo.doRules": "Можно",
    "logo.dontRules": "Нельзя",
    "logo.do1.t": "Основной цвет",
    "logo.do1.d": "Использовать логотип в фирменном красно-чёрном сочетании на белом/чёрном фоне.",
    "logo.do2.t": "Охранное поле",
    "logo.do2.d": "Минимальный отступ вокруг логотипа равен высоте буквы «C» в wordmark.",
    "logo.do3.t": "Знак без подписи",
    "logo.do3.d": "Иконку можно использовать отдельно — как favicon, аватар, метку.",
    "logo.dont1.t": "Искажать пропорции",
    "logo.dont1.d": "Не растягивать, не сжимать, не вращать. Логотип — цельная форма.",
    "logo.dont2.t": "Случайные цвета",
    "logo.dont2.d": "Использовать только фирменную палитру. Никаких градиентов, теней, обводок.",
    "logo.dont3.t": "Размещать на шумном фоне",
    "logo.dont3.d": "Избегать сложной фотографии прямо под логотипом — используйте подложку.",
    "color.title": "Палитра",
    "color.lede": "Чёрный, красный и белый дым — три главных цвета бренда. Акцентные оранжевый и лайм используются дозированно, чтобы сохранить визуальную силу и не распылить внимание.",
    "color.black": "Чёрный",
    "color.red": "Красный",
    "color.smoke": "Белый дым",
    "color.orange": "Оранжевый",
    "color.lime": "Зелёный лайм",
    "color.dist": "Пропорции в композиции",
    "color.scale": "Нейтральная шкала",
    "type.title": "Шрифты",
    "type.display.note": "Платный шрифт (Adobe Fonts). Начертания: Bold, Black, Ultra. Основной для заголовков, обложек, акциденции.",
    "type.text.note": "Бесплатный Google Font. Используется для основного текста, подписей, интерфейсов. Поддерживает кириллицу и латиницу.",
    "type.scale": "Шкала размеров",
    "pattern.title": "Сетки и фоны",
    "pattern.lede": "Четыре базовых паттерна — grid, dots, grid+градиент, noise. Применяются к фонам слайдов, обложек, соц-постов. Не стоит размещать их прямо под длинным текстом — они создают шум.",
    "imagery.title": "Изображения",
    "imagery.lede": "Персонажи и рендеры — фирменная визуальная территория. Кадрирование крупное, контраст жёсткий, цветовая температура холодная. Используйте как композиционный якорь.",
    "templates.title": "Шаблоны слайдов",
    "templates.lede": "Готовые шаблоны 16:9 для презентаций. Открой живой набор и копируй любой слайд в свою презентацию — всё построено на тех же токенах, что и эта система.",
    "templates.open": "Открыть набор →",
    "templates.tokens": "Скачать tokens.css",
    "templates.brand": "Скачать brand.css",
    "tpl.cover": "Обложка",
    "tpl.section": "Заголовок секции",
    "tpl.twocol": "Текст + картинка",
    "tpl.list": "Список",
    "tpl.quote": "Цитата",
    "tpl.data": "Цифры",
    "tpl.grid": "Галерея",
    "tpl.end": "The End",
    "tweaks.pattern": "Фоновый паттерн",
    "tweaks.lang": "Язык",
    "tweaks.density": "Плотность"
  },
  en: {
    "brand": "ChillBase — Identity",
    "nav.philosophy": "Philosophy",
    "nav.logo": "Logo",
    "nav.color": "Color",
    "nav.type": "Type",
    "nav.pattern": "Patterns",
    "nav.imagery": "Imagery",
    "nav.templates": "Templates",
    "hero.line1": "The brand",
    "hero.line2": "identity of",
    "hero.line3": "Chillbase",
    "hero.sub": "A living design system: editable tokens, ready-made components for decks, and the rules for applying the identity. Transparent CSS variables — edit and extend freely.",
    "hero.meta": "Version 1.0 · Ru/En · 2026",
    "hero.cta1": "Start tour",
    "hero.cta2": "Slide templates →",
    "hero.scroll": "Scroll",
    "frame.philosophy": "Philosophy",
    "frame.logo": "Logo",
    "frame.color": "Color",
    "frame.type": "Type",
    "frame.pattern": "Patterns",
    "frame.imagery": "Renders",
    "frame.templates": "Templates",
    "frame.end": "The End",
    "eyebrow.manifesto": "Manifesto",
    "eyebrow.logo": "02 — Logo",
    "eyebrow.color": "05 — Color",
    "eyebrow.type": "03 — Typography",
    "eyebrow.pattern": "04 — Patterns",
    "eyebrow.imagery": "08 — Imagery",
    "eyebrow.templates": "11 — Templates",
    "philo.title": "Bold, defiant, authentic",
    "philo.body1": "Our studio is built on <em>bold innovation</em> and daring defiance. We don't just follow trends — we challenge them, pushing boundaries and redefining what a game can be.",
    "philo.body2": "Every decision is aimed at creating something truly original. Bold innovation is <em>the rule, not the exception</em>. Fearlessness, daring and authenticity — that's our path.",
    "logo.title": "Mark & wordmark",
    "logo.lede": "The logo is built from two parts — icon and wordmark. You can use the mark together with the wordmark, or on its own. Never distort, modify or redraw the logo.",
    "logo.doRules": "Do",
    "logo.dontRules": "Don't",
    "logo.do1.t": "Core colors",
    "logo.do1.d": "Use the logo in the brand red-and-black on clean white or black backgrounds.",
    "logo.do2.t": "Clear space",
    "logo.do2.d": "Keep a minimum clear space around the logo equal to the height of the ‘C' in the wordmark.",
    "logo.do3.t": "Mark-only",
    "logo.do3.d": "The icon can stand alone — use it as favicon, avatar, stamp.",
    "logo.dont1.t": "Don't distort",
    "logo.dont1.d": "Don't stretch, squash or rotate. The logo is a single unit.",
    "logo.dont2.t": "No random colors",
    "logo.dont2.d": "Use only brand palette. No gradients, shadows, outlines.",
    "logo.dont3.t": "Avoid noisy backgrounds",
    "logo.dont3.d": "Don't place directly on busy photography — use a pad or mask.",
    "color.title": "Palette",
    "color.lede": "Black, red and white smoke are the three primaries. Orange and lime accents are used sparingly to keep visual punch and not dilute the hierarchy.",
    "color.black": "Black",
    "color.red": "Red",
    "color.smoke": "White smoke",
    "color.orange": "Orange",
    "color.lime": "Lime",
    "color.dist": "Ratios in composition",
    "color.scale": "Neutral scale",
    "type.title": "Fonts",
    "type.display.note": "Paid type (Adobe Fonts). Weights: Bold, Black, Ultra. Primary face for headlines, covers, display.",
    "type.text.note": "Free Google Font. Used for body copy, captions, interfaces. Supports Cyrillic and Latin.",
    "type.scale": "Size scale",
    "pattern.title": "Grids & backgrounds",
    "pattern.lede": "Four base patterns — grid, dots, grid+gradient, noise. Used on slide, cover and social backgrounds. Avoid placing them directly under long copy — they add noise.",
    "imagery.title": "Imagery",
    "imagery.lede": "Characters and renders are the brand's visual territory. Crop tight, push contrast, keep tone cool. Use as a compositional anchor.",
    "templates.title": "Slide templates",
    "templates.lede": "Ready-made 16:9 templates for decks. Open the live set and copy any slide into your deck — it all runs on the same tokens as this system.",
    "templates.open": "Open set →",
    "templates.tokens": "Download tokens.css",
    "templates.brand": "Download brand.css",
    "tpl.cover": "Cover",
    "tpl.section": "Section title",
    "tpl.twocol": "Text + image",
    "tpl.list": "List",
    "tpl.quote": "Quote",
    "tpl.data": "Stats",
    "tpl.grid": "Gallery",
    "tpl.end": "The End",
    "tweaks.pattern": "Background",
    "tweaks.lang": "Language",
    "tweaks.density": "Density"
  }
};
window.CB_applyLang = function (lang) {
  const dict = window.CB_DICT[lang] || window.CB_DICT.ru;
  document.documentElement.setAttribute("data-lang", lang);
  document.documentElement.setAttribute("lang", lang === "en" ? "en" : "ru");
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/i18n.js", error: String((e && e.message) || e) }); }

// assets/thumbs.js
try { (() => {
/* ChillBase — thumbnail sketches for template cards */
(function () {
  function tile(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }
  const grid = `background:
    linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px) #0f0f0f;
    background-size: 14px 14px;`;

  // Each thumb is a mini 16:9 preview of the slide
  tile("thumb-cover", `
    <div style="position:absolute;inset:0;${grid}"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 40%, rgba(255,0,0,.22), transparent 55%);"></div>
    <div style="position:absolute;left:10px;bottom:10px;right:10px;font-family:var(--font-display);font-weight:900;font-size:26px;line-height:.9;text-transform:uppercase;letter-spacing:-.01em;color:#f4f5f0;">CHILL<br>BASE</div>
    <div style="position:absolute;top:8px;left:10px;right:10px;display:flex;justify-content:space-between;font-family:var(--font-display);font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#919191;"><span>№ 01</span><span>COVER</span></div>
  `);
  tile("thumb-section", `
    <div style="position:absolute;inset:0;background:#ff0000"></div>
    <div style="position:absolute;left:10px;top:10px;right:10px;display:flex;justify-content:space-between;font-family:var(--font-display);font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#fff;opacity:.8;"><span>№ 05</span><span>SECTION</span></div>
    <div style="position:absolute;left:10px;bottom:10px;right:10px;font-family:var(--font-display);font-weight:900;font-size:34px;line-height:.9;text-transform:uppercase;color:#f4f5f0;">05<br>COLOR</div>
  `);
  tile("thumb-twocol", `
    <div style="position:absolute;inset:0;${grid}"></div>
    <div style="position:absolute;left:10px;top:30px;width:40%;font-family:var(--font-display);font-weight:900;font-size:16px;line-height:.95;color:#f4f5f0;">HEAD<br>LINE</div>
    <div style="position:absolute;left:10px;bottom:10px;width:40%;font-family:var(--font-text);font-size:6px;line-height:1.4;color:#919191;">Lorem ipsum dolor sit amet consectetur. Body copy. Onest Regular. Tight.</div>
    <div style="position:absolute;right:10px;top:10px;bottom:10px;width:45%;background:repeating-linear-gradient(45deg,#1a1a1a 0 6px,#222 6px 12px);border-radius:4px;"></div>
  `);
  tile("thumb-list", `
    <div style="position:absolute;inset:0;${grid}"></div>
    <div style="position:absolute;left:10px;top:10px;font-family:var(--font-display);font-weight:900;font-size:14px;color:#f4f5f0;text-transform:uppercase;">PRINCIPLES</div>
    <div style="position:absolute;left:10px;top:40px;right:10px;display:grid;gap:4px;font-family:var(--font-display);font-size:9px;color:#f4f5f0;">
      <div style="display:flex;gap:6px;"><span style="color:#ff0000">01</span> Be bold</div>
      <div style="display:flex;gap:6px;"><span style="color:#ff0000">02</span> Break forms</div>
      <div style="display:flex;gap:6px;"><span style="color:#ff0000">03</span> Ship fearless</div>
      <div style="display:flex;gap:6px;"><span style="color:#ff0000">04</span> Stay original</div>
    </div>
  `);
  tile("thumb-quote", `
    <div style="position:absolute;inset:0;background:#0f0f0f"></div>
    <div style="position:absolute;left:10px;top:14px;color:#ff0000;font-family:var(--font-display);font-weight:900;font-size:40px;line-height:.6;">"</div>
    <div style="position:absolute;left:10px;right:10px;bottom:18px;font-family:var(--font-display);font-weight:700;font-size:14px;line-height:1.05;color:#f4f5f0;text-transform:uppercase;">Break the forms we're given.</div>
    <div style="position:absolute;left:10px;bottom:6px;font-family:var(--font-mono);font-size:6px;color:#919191;">— CHILLBASE MANIFESTO</div>
  `);
  tile("thumb-data", `
    <div style="position:absolute;inset:0;${grid}"></div>
    <div style="position:absolute;left:10px;top:10px;font-family:var(--font-display);font-size:8px;color:#919191;text-transform:uppercase;letter-spacing:.1em">NUMBERS 2025</div>
    <div style="position:absolute;left:10px;top:26px;display:flex;gap:14px;">
      <div><div style="font-family:var(--font-display);font-weight:900;font-size:28px;color:#ff0000;line-height:.9">12M</div><div style="font-family:var(--font-mono);font-size:6px;color:#919191;">players</div></div>
      <div><div style="font-family:var(--font-display);font-weight:900;font-size:28px;color:#f4f5f0;line-height:.9">98%</div><div style="font-family:var(--font-mono);font-size:6px;color:#919191;">retention</div></div>
    </div>
  `);
  tile("thumb-grid", `
    <div style="position:absolute;inset:0;background:#0a0a0a"></div>
    <div style="position:absolute;inset:8px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:3px;">
      <div style="background:#ff0000"></div>
      <div style="background:repeating-linear-gradient(45deg,#1a1a1a 0 4px,#242424 4px 8px)"></div>
      <div style="background:#cbec55"></div>
      <div style="background:repeating-linear-gradient(45deg,#1a1a1a 0 4px,#242424 4px 8px)"></div>
      <div style="background:#ff7e00"></div>
      <div style="background:repeating-linear-gradient(45deg,#1a1a1a 0 4px,#242424 4px 8px)"></div>
    </div>
  `);
  tile("thumb-end", `
    <div style="position:absolute;inset:0;background:#0a0a0a"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 60%, rgba(255,0,0,.25), transparent 55%)"></div>
    <div style="position:absolute;inset:0;display:grid;place-items:center;font-family:var(--font-display);font-weight:900;font-size:28px;text-transform:uppercase;letter-spacing:-.02em;color:#f4f5f0;">FIN.</div>
  `);
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/thumbs.js", error: String((e && e.message) || e) }); }

// assets/tweaks.js
try { (() => {
/* ChillBase — tweaks controller */
(function () {
  const STORE = "cb:tweaks";
  const defaults = {
    pattern: "grid",
    lang: "ru",
    density: "spacious"
  };
  function load() {
    try {
      return Object.assign({}, defaults, JSON.parse(localStorage.getItem(STORE) || "{}"));
    } catch (e) {
      return {
        ...defaults
      };
    }
  }
  function save(state) {
    localStorage.setItem(STORE, JSON.stringify(state));
  }
  let state = load();
  function apply() {
    document.body.setAttribute("data-pattern", state.pattern);
    document.documentElement.setAttribute("data-density", state.density);
    if (window.CB_applyLang) window.CB_applyLang(state.lang);
    document.querySelectorAll(".cb-seg").forEach(seg => {
      const target = seg.getAttribute("data-target");
      seg.querySelectorAll("button").forEach(btn => {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-val") === state[target] ? "true" : "false");
      });
    });
  }
  document.addEventListener("DOMContentLoaded", () => {
    apply();

    // Segment buttons
    document.querySelectorAll(".cb-seg").forEach(seg => {
      const target = seg.getAttribute("data-target");
      seg.addEventListener("click", e => {
        const btn = e.target.closest("button[data-val]");
        if (!btn) return;
        state[target] = btn.getAttribute("data-val");
        save(state);
        apply();
      });
    });

    // Local toggle button
    const toggle = document.getElementById("toggleTweaks");
    const panel = document.getElementById("tweaks");
    if (toggle && panel) {
      toggle.addEventListener("click", () => panel.classList.toggle("is-open"));
    }

    // Active nav dot
    const links = document.querySelectorAll(".cb-topbar__nav a[href^='#']");
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(l => l.classList.toggle("is-active", l.getAttribute("href") === "#" + e.target.id));
        }
      });
    }, {
      rootMargin: "-40% 0px -50% 0px"
    });
    document.querySelectorAll("section[id]").forEach(s => io.observe(s));
  });

  // Host Tweaks toolbar integration
  window.addEventListener("message", e => {
    if (!e.data) return;
    if (e.data.type === "__activate_edit_mode") {
      document.getElementById("tweaks").classList.add("is-open");
    }
    if (e.data.type === "__deactivate_edit_mode") {
      document.getElementById("tweaks").classList.remove("is-open");
    }
  });
  try {
    window.parent.postMessage({
      type: "__edit_mode_available"
    }, "*");
  } catch (err) {}
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/tweaks.js", error: String((e && e.message) || e) }); }

// deck-stage.js
try { (() => {
/**
 * <deck-stage> — reusable web component for HTML decks.
 *
 * Handles:
 *  (a) speaker notes — reads <script type="application/json" id="speaker-notes">
 *      and posts {slideIndexChanged: N} to the parent window on nav.
 *  (b) keyboard navigation — ←/→, PgUp/PgDn, Space, Home/End, number keys.
 *  (c) press R to reset to slide 0 (with a tasteful keyboard hint).
 *  (d) bottom-center overlay showing slide count + hints, fades out on idle.
 *  (e) auto-scaling — inner canvas is a fixed design size (default 1920×1080)
 *      scaled with `transform: scale()` to fit the viewport, letterboxed.
 *      Set the `noscale` attribute to render at authored size (1:1) — the
 *      PPTX exporter sets this so its DOM capture sees unscaled geometry.
 *  (f) print — `@media print` lays every slide out as its own page at the
 *      design size, so the browser's Print → Save as PDF produces a clean
 *      one-page-per-slide PDF with no extra setup.
 *
 * Slides are HIDDEN, not unmounted. Non-active slides stay in the DOM with
 * `visibility: hidden` + `opacity: 0`, so their state (videos, iframes,
 * form inputs, React trees) is preserved across navigation.
 *
 * Lifecycle event — the component dispatches a `slidechange` CustomEvent on
 * itself whenever the active slide changes (including the initial mount).
 * The event bubbles and composes out of shadow DOM, so you can listen on
 * the <deck-stage> element or on document:
 *
 *   document.querySelector('deck-stage').addEventListener('slidechange', (e) => {
 *     e.detail.index         // new 0-based index
 *     e.detail.previousIndex // previous index, or -1 on init
 *     e.detail.total         // total slide count
 *     e.detail.slide         // the new active slide element
 *     e.detail.previousSlide // the prior slide element, or null on init
 *     e.detail.reason        // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
 *   });
 *
 * Persistence: current slide index is saved to localStorage keyed by the
 * document path, so refresh returns you to the same place.
 *
 * Usage:
 *   <deck-stage width="1920" height="1080">
 *     <section data-label="Title">...</section>
 *     <section data-label="Agenda">...</section>
 *   </deck-stage>
 *
 * Slides are the direct element children of <deck-stage>. Each slide is
 * automatically tagged with:
 *   - data-screen-label="NN Label"   (1-indexed, for comment flow)
 *   - data-om-validate="no_overflowing_text,no_overlapping_text,slide_sized_text"
 */

(() => {
  const DESIGN_W_DEFAULT = 1920;
  const DESIGN_H_DEFAULT = 1080;
  const STORAGE_PREFIX = 'deck-stage:slide:';
  const OVERLAY_HIDE_MS = 1800;
  const VALIDATE_ATTR = 'no_overflowing_text,no_overlapping_text,slide_sized_text';
  const pad2 = n => String(n).padStart(2, '0');
  const stylesheet = `
    :host {
      position: fixed;
      inset: 0;
      display: block;
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
      overflow: hidden;
    }

    .stage {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .canvas {
      position: relative;
      transform-origin: center center;
      flex-shrink: 0;
      background: #fff;
      will-change: transform;
    }

    /* Slides live in light DOM (via <slot>) so authored CSS still applies.
       We absolutely position each slotted child to stack them. */
    ::slotted(*) {
      position: absolute !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      visibility: hidden;
    }
    ::slotted([data-deck-active]) {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
    }

    /* Tap zones for mobile — back/forward thirds like Stories.
       Transparent, no visible UI, don't block the overlay. */
    .tapzones {
      position: fixed;
      inset: 0;
      display: flex;
      z-index: 2147482000;
      pointer-events: none;
    }
    .tapzone {
      flex: 1;
      pointer-events: auto;
      -webkit-tap-highlight-color: transparent;
    }
    /* Only activate tap zones on coarse pointers (touch devices). */
    @media (hover: hover) and (pointer: fine) {
      .tapzones { display: none; }
    }

    .overlay {
      position: fixed;
      left: 50%;
      bottom: 22px;
      transform: translate(-50%, 6px) scale(0.92);
      filter: blur(6px);
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      background: #000;
      color: #fff;
      border-radius: 999px;
      font-size: 12px;
      font-feature-settings: "tnum" 1;
      letter-spacing: 0.01em;
      opacity: 0;
      pointer-events: none;
      transition: opacity 260ms ease, transform 260ms cubic-bezier(.2,.8,.2,1), filter 260ms ease;
      transform-origin: center bottom;
      z-index: 2147483000;
      user-select: none;
    }
    .overlay[data-visible] {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, 0) scale(1);
      filter: blur(0);
    }

    .btn {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      margin: 0;
      padding: 0;
      color: inherit;
      font: inherit;
      cursor: default;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      min-width: 28px;
      border-radius: 999px;
      color: rgba(255,255,255,0.72);
      transition: background 140ms ease, color 140ms ease;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .btn:active { background: rgba(255,255,255,0.18); }
    .btn:focus { outline: none; }
    .btn:focus-visible { outline: none; }
    .btn::-moz-focus-inner { border: 0; }
    .btn svg { width: 14px; height: 14px; display: block; }
    .btn.reset {
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.02em;
      padding: 0 10px 0 12px;
      gap: 6px;
      color: rgba(255,255,255,0.72);
    }
    .btn.reset .kbd {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: 10px;
      line-height: 1;
      color: rgba(255,255,255,0.88);
      background: rgba(255,255,255,0.12);
      border-radius: 4px;
    }

    .count {
      font-variant-numeric: tabular-nums;
      color: #fff;
      font-weight: 500;
      padding: 0 8px;
      min-width: 42px;
      text-align: center;
      font-size: 12px;
    }
    .count .sep { color: rgba(255,255,255,0.45); margin: 0 3px; font-weight: 400; }
    .count .total { color: rgba(255,255,255,0.55); }

    .divider {
      width: 1px;
      height: 14px;
      background: rgba(255,255,255,0.18);
      margin: 0 2px;
    }

    /* ── Print: one page per slide, no chrome ────────────────────────────
       The screen layout stacks every slide at inset:0 inside a scaled
       canvas; for print we want them in document flow at the authored
       design size so the browser paginates one slide per sheet. The
       @page size is set from the width/height attributes via the inline
       <style id="deck-stage-print-page"> that connectedCallback injects
       into <head> (the @page at-rule has no effect inside shadow DOM). */
    @media print {
      :host {
        position: static;
        inset: auto;
        background: none;
        overflow: visible;
        color: inherit;
      }
      .stage { position: static; display: block; }
      .canvas {
        transform: none !important;
        width: auto !important;
        height: auto !important;
        background: none;
        will-change: auto;
      }
      ::slotted(*) {
        position: relative !important;
        inset: auto !important;
        width: var(--deck-design-w) !important;
        height: var(--deck-design-h) !important;
        box-sizing: border-box !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto;
        break-after: page;
        page-break-after: always;
        break-inside: avoid;
        overflow: hidden;
      }
      ::slotted(*:last-child) {
        break-after: auto;
        page-break-after: auto;
      }
      .overlay, .tapzones { display: none !important; }
    }
  `;
  class DeckStage extends HTMLElement {
    static get observedAttributes() {
      return ['width', 'height', 'noscale'];
    }
    constructor() {
      super();
      this._root = this.attachShadow({
        mode: 'open'
      });
      this._index = 0;
      this._slides = [];
      this._notes = [];
      this._hideTimer = null;
      this._mouseIdleTimer = null;
      this._storageKey = STORAGE_PREFIX + (location.pathname || '/');
      this._onKey = this._onKey.bind(this);
      this._onResize = this._onResize.bind(this);
      this._onSlotChange = this._onSlotChange.bind(this);
      this._onMouseMove = this._onMouseMove.bind(this);
      this._onTapBack = this._onTapBack.bind(this);
      this._onTapForward = this._onTapForward.bind(this);
    }
    get designWidth() {
      return parseInt(this.getAttribute('width'), 10) || DESIGN_W_DEFAULT;
    }
    get designHeight() {
      return parseInt(this.getAttribute('height'), 10) || DESIGN_H_DEFAULT;
    }
    connectedCallback() {
      this._render();
      this._loadNotes();
      this._syncPrintPageRule();
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('resize', this._onResize);
      window.addEventListener('mousemove', this._onMouseMove, {
        passive: true
      });
      // Initial collection + layout happens via slotchange, which fires on mount.
    }
    disconnectedCallback() {
      window.removeEventListener('keydown', this._onKey);
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('mousemove', this._onMouseMove);
      if (this._hideTimer) clearTimeout(this._hideTimer);
      if (this._mouseIdleTimer) clearTimeout(this._mouseIdleTimer);
    }
    attributeChangedCallback() {
      if (this._canvas) {
        this._canvas.style.width = this.designWidth + 'px';
        this._canvas.style.height = this.designHeight + 'px';
        this._canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
        this._canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
        this._fit();
        this._syncPrintPageRule();
      }
    }
    _render() {
      const style = document.createElement('style');
      style.textContent = stylesheet;
      const stage = document.createElement('div');
      stage.className = 'stage';
      const canvas = document.createElement('div');
      canvas.className = 'canvas';
      canvas.style.width = this.designWidth + 'px';
      canvas.style.height = this.designHeight + 'px';
      canvas.style.setProperty('--deck-design-w', this.designWidth + 'px');
      canvas.style.setProperty('--deck-design-h', this.designHeight + 'px');
      const slot = document.createElement('slot');
      slot.addEventListener('slotchange', this._onSlotChange);
      canvas.appendChild(slot);
      stage.appendChild(canvas);

      // Tap zones (mobile): left third = back, right third = forward.
      const tapzones = document.createElement('div');
      tapzones.className = 'tapzones export-hidden';
      tapzones.setAttribute('aria-hidden', 'true');
      const tzBack = document.createElement('div');
      tzBack.className = 'tapzone tapzone--back';
      const tzMid = document.createElement('div');
      tzMid.className = 'tapzone tapzone--mid';
      tzMid.style.pointerEvents = 'none';
      const tzFwd = document.createElement('div');
      tzFwd.className = 'tapzone tapzone--fwd';
      tzBack.addEventListener('click', this._onTapBack);
      tzFwd.addEventListener('click', this._onTapForward);
      tapzones.append(tzBack, tzMid, tzFwd);

      // Overlay: compact, solid black, with clickable controls.
      const overlay = document.createElement('div');
      overlay.className = 'overlay export-hidden';
      overlay.setAttribute('role', 'toolbar');
      overlay.setAttribute('aria-label', 'Deck controls');
      overlay.innerHTML = `
        <button class="btn prev" type="button" aria-label="Previous slide" title="Previous (←)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>
        </button>
        <span class="count" aria-live="polite"><span class="current">1</span><span class="sep">/</span><span class="total">1</span></span>
        <button class="btn next" type="button" aria-label="Next slide" title="Next (→)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>
        </button>
        <span class="divider"></span>
        <button class="btn reset" type="button" aria-label="Reset to first slide" title="Reset (R)">Reset<span class="kbd">R</span></button>
      `;
      overlay.querySelector('.prev').addEventListener('click', () => this._go(this._index - 1, 'click'));
      overlay.querySelector('.next').addEventListener('click', () => this._go(this._index + 1, 'click'));
      overlay.querySelector('.reset').addEventListener('click', () => this._go(0, 'click'));
      this._root.append(style, stage, tapzones, overlay);
      this._canvas = canvas;
      this._slot = slot;
      this._overlay = overlay;
      this._countEl = overlay.querySelector('.current');
      this._totalEl = overlay.querySelector('.total');
    }

    /** @page must live in the document stylesheet — it's a no-op inside
     *  shadow DOM. Inject/update a single <head> style tag so the print
     *  sheet matches the design size and Save-as-PDF yields one slide per
     *  page with no margins. */
    _syncPrintPageRule() {
      const id = 'deck-stage-print-page';
      let tag = document.getElementById(id);
      if (!tag) {
        tag = document.createElement('style');
        tag.id = id;
        document.head.appendChild(tag);
      }
      tag.textContent = '@page { size: ' + this.designWidth + 'px ' + this.designHeight + 'px; margin: 0; } ' + '@media print { html, body { margin: 0 !important; padding: 0 !important; background: none !important; overflow: visible !important; height: auto !important; } ' + '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }';
    }
    _onSlotChange() {
      this._collectSlides();
      this._restoreIndex();
      this._applyIndex({
        showOverlay: false,
        broadcast: true,
        reason: 'init'
      });
      this._fit();
    }
    _collectSlides() {
      const assigned = this._slot.assignedElements({
        flatten: true
      });
      this._slides = assigned.filter(el => {
        // Skip template/style/script nodes even if someone slots them.
        const tag = el.tagName;
        return tag !== 'TEMPLATE' && tag !== 'SCRIPT' && tag !== 'STYLE';
      });
      this._slides.forEach((slide, i) => {
        const n = i + 1;
        // Determine a label for comment flow: prefer explicit data-label,
        // then an existing data-screen-label, then first heading, else "Slide".
        let label = slide.getAttribute('data-label');
        if (!label) {
          const existing = slide.getAttribute('data-screen-label');
          if (existing) {
            // Strip any leading number the author may have included.
            label = existing.replace(/^\s*\d+\s*/, '').trim() || existing;
          }
        }
        if (!label) {
          const h = slide.querySelector('h1, h2, h3, [data-title]');
          if (h) label = (h.textContent || '').trim().slice(0, 40);
        }
        if (!label) label = 'Slide';
        slide.setAttribute('data-screen-label', `${pad2(n)} ${label}`);

        // Validation attribute for comment flow / auto-checks.
        if (!slide.hasAttribute('data-om-validate')) {
          slide.setAttribute('data-om-validate', VALIDATE_ATTR);
        }
        slide.setAttribute('data-deck-slide', String(i));
      });
      if (this._totalEl) this._totalEl.textContent = String(this._slides.length || 1);
      if (this._index >= this._slides.length) this._index = Math.max(0, this._slides.length - 1);
    }
    _loadNotes() {
      const tag = document.getElementById('speaker-notes');
      if (!tag) {
        this._notes = [];
        return;
      }
      try {
        const parsed = JSON.parse(tag.textContent || '[]');
        if (Array.isArray(parsed)) this._notes = parsed;
      } catch (e) {
        console.warn('[deck-stage] Failed to parse #speaker-notes JSON:', e);
        this._notes = [];
      }
    }
    _restoreIndex() {
      try {
        const raw = localStorage.getItem(this._storageKey);
        if (raw != null) {
          const n = parseInt(raw, 10);
          if (Number.isFinite(n) && n >= 0 && n < this._slides.length) {
            this._index = n;
          }
        }
      } catch (e) {/* ignore */}
    }
    _persistIndex() {
      try {
        localStorage.setItem(this._storageKey, String(this._index));
      } catch (e) {/* ignore */}
    }
    _applyIndex({
      showOverlay = true,
      broadcast = true,
      reason = 'init'
    } = {}) {
      if (!this._slides.length) return;
      const prev = this._prevIndex == null ? -1 : this._prevIndex;
      const curr = this._index;
      this._slides.forEach((s, i) => {
        if (i === curr) s.setAttribute('data-deck-active', '');else s.removeAttribute('data-deck-active');
      });
      if (this._countEl) this._countEl.textContent = String(curr + 1);
      this._persistIndex();
      if (broadcast) {
        // (1) Legacy: host-window postMessage for speaker-notes renderers.
        try {
          window.postMessage({
            slideIndexChanged: curr
          }, '*');
        } catch (e) {}

        // (2) In-page CustomEvent on the <deck-stage> element itself.
        //     Bubbles and composes out of shadow DOM so slide code can listen:
        //       document.querySelector('deck-stage').addEventListener('slidechange', e => {
        //         e.detail.index, e.detail.previousIndex, e.detail.total, e.detail.slide, e.detail.reason
        //       });
        const detail = {
          index: curr,
          previousIndex: prev,
          total: this._slides.length,
          slide: this._slides[curr] || null,
          previousSlide: prev >= 0 ? this._slides[prev] || null : null,
          reason: reason // 'init' | 'keyboard' | 'click' | 'tap' | 'api'
        };
        this.dispatchEvent(new CustomEvent('slidechange', {
          detail,
          bubbles: true,
          composed: true
        }));
      }
      this._prevIndex = curr;
      if (showOverlay) this._flashOverlay();
    }
    _flashOverlay() {
      if (!this._overlay) return;
      this._overlay.setAttribute('data-visible', '');
      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        this._overlay.removeAttribute('data-visible');
      }, OVERLAY_HIDE_MS);
    }
    _fit() {
      if (!this._canvas) return;
      // PPTX export sets noscale so the DOM capture sees authored-size
      // geometry — the scaled canvas is in shadow DOM, so the exporter's
      // resetTransformSelector can't reach .canvas.style.transform directly.
      if (this.hasAttribute('noscale')) {
        this._canvas.style.transform = 'none';
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s = Math.min(vw / this.designWidth, vh / this.designHeight);
      this._canvas.style.transform = `scale(${s})`;
    }
    _onResize() {
      this._fit();
    }
    _onMouseMove() {
      // Keep overlay visible while mouse moves; hide after idle.
      this._flashOverlay();
    }
    _onTapBack(e) {
      e.preventDefault();
      this._go(this._index - 1, 'tap');
    }
    _onTapForward(e) {
      e.preventDefault();
      this._go(this._index + 1, 'tap');
    }
    _onKey(e) {
      // Ignore when the user is typing.
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      let handled = true;
      if (key === 'ArrowRight' || key === 'PageDown' || key === ' ' || key === 'Spacebar') {
        this._go(this._index + 1, 'keyboard');
      } else if (key === 'ArrowLeft' || key === 'PageUp') {
        this._go(this._index - 1, 'keyboard');
      } else if (key === 'Home') {
        this._go(0, 'keyboard');
      } else if (key === 'End') {
        this._go(this._slides.length - 1, 'keyboard');
      } else if (key === 'r' || key === 'R') {
        this._go(0, 'keyboard');
      } else if (/^[0-9]$/.test(key)) {
        // 1..9 jump to that slide; 0 jumps to 10.
        const n = key === '0' ? 9 : parseInt(key, 10) - 1;
        if (n < this._slides.length) this._go(n, 'keyboard');
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        this._flashOverlay();
      }
    }
    _go(i, reason = 'api') {
      if (!this._slides.length) return;
      const clamped = Math.max(0, Math.min(this._slides.length - 1, i));
      if (clamped === this._index) {
        this._flashOverlay();
        return;
      }
      this._index = clamped;
      this._applyIndex({
        showOverlay: true,
        broadcast: true,
        reason
      });
    }

    // Public API ------------------------------------------------------------

    /** Current slide index (0-based). */
    get index() {
      return this._index;
    }
    /** Total slide count. */
    get length() {
      return this._slides.length;
    }
    /** Programmatically navigate. */
    goTo(i) {
      this._go(i, 'api');
    }
    next() {
      this._go(this._index + 1, 'api');
    }
    prev() {
      this._go(this._index - 1, 'api');
    }
    reset() {
      this._go(0, 'api');
    }
  }
  if (!customElements.get('deck-stage')) {
    customElements.define('deck-stage', DeckStage);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "deck-stage.js", error: String((e && e.message) || e) }); }

// skills/chillbase-particle-dissolve/icons.js
try { (() => {
/* ============================================================
   БИБЛИОТЕКА ИКОНОК — Particle Dissolve
   Чтобы добавить свою иконку:
   1. Положи SVG-файл в папку icons/
   2. Допиши строку в список ниже:
      {id:'my-icon', name:'Моя иконка', cat:'geo', file:'icons/my-icon.svg'}
   Поля:
   - id      уникальный ключ
   - name    подпись (тултип + статус)
   - cat     категория для фильтра: 'logo' | 'geo' | 'line' | 'hr' | своя
   - file    путь к SVG/PNG (builtin:true — встроенный знак CB)
   - png     true для растровых иконок (чёрные на прозрачном фоне)
   - stroke  (опц.) переопределить stroke-width — для тонких
             контурных иконок, чтобы частицы сэмплились плотнее
   ============================================================ */
window.PD_ICONS = [/* — лого — */
{
  id: 'cb-mark',
  name: 'Знак CB',
  cat: 'logo',
  builtin: true
}, {
  id: 'logo-v',
  name: 'Лого вертикальное',
  cat: 'logo',
  file: 'icons/logo-vertical.svg'
}, {
  id: 'logo-h',
  name: 'Лого горизонтальное',
  cat: 'logo',
  file: 'icons/logo-horizontal.svg'
}, {
  id: 'logotype',
  name: 'Логотайп',
  cat: 'logo',
  file: 'icons/logotype-horizontal.svg'
}, /* — гео-фигуры (заливка) — */
{
  id: 'shape-01',
  name: 'Гео 01',
  cat: 'geo',
  file: 'icons/geo/shape-01.svg'
}, {
  id: 'shape-02',
  name: 'Гео 02',
  cat: 'geo',
  file: 'icons/geo/shape-02.svg'
}, {
  id: 'shape-03',
  name: 'Гео 03',
  cat: 'geo',
  file: 'icons/geo/shape-03.svg'
}, {
  id: 'shape-04',
  name: 'Гео 04',
  cat: 'geo',
  file: 'icons/geo/shape-04.svg'
}, {
  id: 'shape-05',
  name: 'Гео 05',
  cat: 'geo',
  file: 'icons/geo/shape-05.svg'
}, {
  id: 'shape-06',
  name: 'Гео 06',
  cat: 'geo',
  file: 'icons/geo/shape-06.svg'
}, {
  id: 'shape-07',
  name: 'Гео 07',
  cat: 'geo',
  file: 'icons/geo/shape-07.svg'
}, {
  id: 'shape-08',
  name: 'Гео 08',
  cat: 'geo',
  file: 'icons/geo/shape-08.svg'
}, {
  id: 'shape-09',
  name: 'Гео 09',
  cat: 'geo',
  file: 'icons/geo/shape-09.svg'
}, {
  id: 'shape-10',
  name: 'Гео 10',
  cat: 'geo',
  file: 'icons/geo/shape-10.svg'
}, /* — контурные (тонкие линии, утолщаем для сэмплинга) — */
{
  id: 'line-01',
  name: 'Контур 01',
  cat: 'line',
  file: 'icons/geo/line-01.svg',
  stroke: 9
}, {
  id: 'line-02',
  name: 'Контур 02',
  cat: 'line',
  file: 'icons/geo/line-02.svg',
  stroke: 9
}, {
  id: 'line-03',
  name: 'Контур 03',
  cat: 'line',
  file: 'icons/geo/line-03.svg',
  stroke: 9
}, {
  id: 'line-04',
  name: 'Контур 04',
  cat: 'line',
  file: 'icons/geo/line-04.svg',
  stroke: 9
}, {
  id: 'line-05',
  name: 'Контур 05',
  cat: 'line',
  file: 'icons/geo/line-05.svg',
  stroke: 9
}, {
  id: 'line-06',
  name: 'Контур 06',
  cat: 'line',
  file: 'icons/geo/line-06.svg',
  stroke: 9
}, {
  id: 'line-07',
  name: 'Контур 07',
  cat: 'line',
  file: 'icons/geo/line-07.svg',
  stroke: 9
}, {
  id: 'line-08',
  name: 'Контур 08',
  cat: 'line',
  file: 'icons/geo/line-08.svg',
  stroke: 9
}, {
  id: 'line-09',
  name: 'Контур 09',
  cat: 'line',
  file: 'icons/geo/line-09.svg',
  stroke: 9
}, {
  id: 'line-10',
  name: 'Контур 10',
  cat: 'line',
  file: 'icons/geo/line-10.svg',
  stroke: 9
}, /* — HR-пак (PNG, чёрные на прозрачном) — */
{
  id: 'hr-abilities',
  name: 'Навыки',
  cat: 'hr',
  png: true,
  file: 'icons/hr/abilities.png'
}, {
  id: 'hr-best-employee',
  name: 'Лучший сотрудник',
  cat: 'hr',
  png: true,
  file: 'icons/hr/best-employee.png'
}, {
  id: 'hr-biography',
  name: 'Биография',
  cat: 'hr',
  png: true,
  file: 'icons/hr/biography.png'
}, {
  id: 'hr-bus-presentation',
  name: 'Презентация с графиком',
  cat: 'hr',
  png: true,
  file: 'icons/hr/business-presentation.png'
}, {
  id: 'hr-report',
  name: 'Отчёт',
  cat: 'hr',
  png: true,
  file: 'icons/hr/business-report.png'
}, {
  id: 'hr-report-2',
  name: 'Отчёт-сводка',
  cat: 'hr',
  png: true,
  file: 'icons/hr/business-report-2.png'
}, {
  id: 'hr-career-choice',
  name: 'Выбор карьеры',
  cat: 'hr',
  png: true,
  file: 'icons/hr/career-choice.png'
}, {
  id: 'hr-career-path',
  name: 'Карьерный путь',
  cat: 'hr',
  png: true,
  file: 'icons/hr/career-path.png'
}, {
  id: 'hr-career-path-2',
  name: 'Карьерная лестница',
  cat: 'hr',
  png: true,
  file: 'icons/hr/career-path-2.png'
}, {
  id: 'hr-certificate',
  name: 'Сертификат',
  cat: 'hr',
  png: true,
  file: 'icons/hr/certificate.png'
}, {
  id: 'hr-change-mgmt',
  name: 'Управление изменениями',
  cat: 'hr',
  png: true,
  file: 'icons/hr/change-management.png'
}, {
  id: 'hr-chat-room',
  name: 'Чат',
  cat: 'hr',
  png: true,
  file: 'icons/hr/chat-room.png'
}, {
  id: 'hr-checklist',
  name: 'Чек-лист',
  cat: 'hr',
  png: true,
  file: 'icons/hr/checklist.png'
}, {
  id: 'hr-coding-book',
  name: 'Файл с кодом',
  cat: 'hr',
  png: true,
  file: 'icons/hr/coding-book.png'
}, {
  id: 'hr-comments',
  name: 'Комментарии',
  cat: 'hr',
  png: true,
  file: 'icons/hr/comments.png'
}, {
  id: 'hr-contract',
  name: 'Контракт',
  cat: 'hr',
  png: true,
  file: 'icons/hr/contract.png'
}, {
  id: 'hr-customer-service',
  name: 'Поддержка',
  cat: 'hr',
  png: true,
  file: 'icons/hr/customer-service.png'
}, {
  id: 'hr-cv',
  name: 'CV',
  cat: 'hr',
  png: true,
  file: 'icons/hr/cv.png'
}, {
  id: 'hr-delete-account',
  name: 'Удаление аккаунта',
  cat: 'hr',
  png: true,
  file: 'icons/hr/delete-account.png'
}, {
  id: 'hr-desk-lamp',
  name: 'Лампа',
  cat: 'hr',
  png: true,
  file: 'icons/hr/desk-lamp.png'
}, {
  id: 'hr-employee',
  name: 'Ротация сотрудника',
  cat: 'hr',
  png: true,
  file: 'icons/hr/employee.png'
}, {
  id: 'hr-file',
  name: 'Файл',
  cat: 'hr',
  png: true,
  file: 'icons/hr/file.png'
}, {
  id: 'hr-headhunting',
  name: 'Хедхантинг',
  cat: 'hr',
  png: true,
  file: 'icons/hr/headhunting.png'
}, {
  id: 'hr-heart-check',
  name: 'Забота',
  cat: 'hr',
  png: true,
  file: 'icons/hr/heart-check.png'
}, {
  id: 'hr-id-card',
  name: 'Бейдж',
  cat: 'hr',
  png: true,
  file: 'icons/hr/id-card.png'
}, {
  id: 'hr-idea-bulb',
  name: 'Идея',
  cat: 'hr',
  png: true,
  file: 'icons/hr/idea-bulb.png'
}, {
  id: 'hr-leadership',
  name: 'Лидерство',
  cat: 'hr',
  png: true,
  file: 'icons/hr/leadership.png'
}, {
  id: 'hr-letter',
  name: 'Письмо',
  cat: 'hr',
  png: true,
  file: 'icons/hr/letter.png'
}, {
  id: 'hr-mgmt-service',
  name: 'Управление сервисом',
  cat: 'hr',
  png: true,
  file: 'icons/hr/management-service.png'
}, {
  id: 'hr-mission',
  name: 'Миссия',
  cat: 'hr',
  png: true,
  file: 'icons/hr/mission.png'
}, {
  id: 'hr-network-conn',
  name: 'Интеграции',
  cat: 'hr',
  png: true,
  file: 'icons/hr/network-connection.png'
}, {
  id: 'hr-network',
  name: 'Нетворк',
  cat: 'hr',
  png: true,
  file: 'icons/hr/network.png'
}, {
  id: 'hr-online-meeting',
  name: 'Онлайн-встреча',
  cat: 'hr',
  png: true,
  file: 'icons/hr/online-meeting.png'
}, {
  id: 'hr-organization',
  name: 'Оргструктура',
  cat: 'hr',
  png: true,
  file: 'icons/hr/organization.png'
}, {
  id: 'hr-people-nearby',
  name: 'Люди рядом',
  cat: 'hr',
  png: true,
  file: 'icons/hr/people-nearby.png'
}, {
  id: 'hr-positive-review',
  name: 'Позитивный отзыв',
  cat: 'hr',
  png: true,
  file: 'icons/hr/positive-review.png'
}, {
  id: 'hr-precision',
  name: 'Точность',
  cat: 'hr',
  png: true,
  file: 'icons/hr/precision.png'
}, {
  id: 'hr-premium-service',
  name: 'Премиум',
  cat: 'hr',
  png: true,
  file: 'icons/hr/premium-service.png'
}, {
  id: 'hr-presentation',
  name: 'Презентация',
  cat: 'hr',
  png: true,
  file: 'icons/hr/presentation.png'
}, {
  id: 'hr-resume-cv',
  name: 'Резюме',
  cat: 'hr',
  png: true,
  file: 'icons/hr/resume-and-cv.png'
}, {
  id: 'hr-sack',
  name: 'Бюджет',
  cat: 'hr',
  png: true,
  file: 'icons/hr/sack.png'
}, {
  id: 'hr-self-improvement',
  name: 'Саморазвитие',
  cat: 'hr',
  png: true,
  file: 'icons/hr/self-improvement.png'
}, {
  id: 'hr-seminar',
  name: 'Семинар',
  cat: 'hr',
  png: true,
  file: 'icons/hr/seminar.png'
}, {
  id: 'hr-speaker',
  name: 'Спикер',
  cat: 'hr',
  png: true,
  file: 'icons/hr/speaker.png'
}, {
  id: 'hr-stop-watch',
  name: 'Секундомер',
  cat: 'hr',
  png: true,
  file: 'icons/hr/stop-watch.png'
}, {
  id: 'hr-target-idea',
  name: 'Цель и идея',
  cat: 'hr',
  png: true,
  file: 'icons/hr/target-idea.png'
}, {
  id: 'hr-team-management',
  name: 'Управление командой',
  cat: 'hr',
  png: true,
  file: 'icons/hr/team-management.png'
}, {
  id: 'hr-team-work',
  name: 'Командная работа',
  cat: 'hr',
  png: true,
  file: 'icons/hr/team-work.png'
}, {
  id: 'hr-video-lesson',
  name: 'Видеоурок',
  cat: 'hr',
  png: true,
  file: 'icons/hr/video-lesson.png'
}];
})(); } catch (e) { __ds_ns.__errors.push({ path: "skills/chillbase-particle-dissolve/icons.js", error: String((e && e.message) || e) }); }

// ui_kits/hr_presentation/frame.jsx
try { (() => {
// HR Presentation — shared Frame chrome. 1920×1080 dark grid canvas.
// Every slide except Cover uses this Frame.
// Chrome: top bar (FEBRUARY · 2025 style meta + top rule), bottom bar (footer + page number).

const HR_COLORS = {
  bg: "#121212",
  ink: "#f5f5f5",
  muted: "#7a7a7a",
  rule: "#2a2a2a",
  accent: "#ff0000",
  card: "#1a1a1a",
  cardBorder: "#2f2f2f"
};
const HR_FONT_DISPLAY = "'Good Headline Pro','Archivo',sans-serif";
const HR_FONT_META = "'Onest',sans-serif";

// Theme context — for accent color tweak + page-numbers toggle
const HRTheme = React.createContext({
  accent: HR_COLORS.accent,
  showPages: true
});
const HRFrame = ({
  children,
  page,
  total = 15,
  top = {
    left: "FEBRUARY",
    right: "2025"
  },
  footerLeft = "HR · Internal · Внутренняя презентация",
  projectLabel = "ChillBase / HR Deck",
  padded = true
}) => {
  const {
    accent,
    showPages
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      width: 1920,
      height: 1080,
      background: HR_COLORS.bg,
      color: HR_COLORS.ink,
      overflow: "hidden",
      fontFamily: HR_FONT_DISPLAY
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "url(../../assets/backgrounds/bg-grid.png) center / cover no-repeat",
      opacity: 0.85
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(18,18,18,0.35)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      top: 56,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, top.left), /*#__PURE__*/React.createElement("span", null, top.right)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      top: 98,
      width: 560,
      height: 1,
      background: HR_COLORS.rule
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: padded ? 80 : 0,
      right: padded ? 80 : 0,
      top: padded ? 140 : 0,
      bottom: padded ? 140 : 0
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      bottom: 98,
      width: 560,
      height: 1,
      background: HR_COLORS.rule
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      bottom: 56,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      maxWidth: 800
    }
  }, footerLeft), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 32,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null, projectLabel), showPages && page != null && /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent,
      fontWeight: 700
    }
  }, String(page).padStart(2, "0"), " / ", String(total).padStart(2, "0")))));
};

// Small reusable building blocks
const HREyebrow = ({
  children,
  color
}) => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 16,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: color || accent,
      fontWeight: 600
    }
  }, children);
};
const HRTitle = ({
  children,
  size = 88,
  maxWidth
}) => /*#__PURE__*/React.createElement("h2", {
  style: {
    margin: 0,
    fontFamily: HR_FONT_DISPLAY,
    fontWeight: 700,
    fontSize: size,
    lineHeight: 1.0,
    letterSpacing: "-0.015em",
    color: HR_COLORS.ink,
    maxWidth
  }
}, children);
const HRBody = ({
  children,
  size = 22,
  maxWidth = 780
}) => /*#__PURE__*/React.createElement("p", {
  style: {
    margin: 0,
    fontFamily: HR_FONT_META,
    fontSize: size,
    lineHeight: 1.55,
    color: "#bfbfbf",
    maxWidth
  }
}, children);
const HRCard = ({
  children,
  style
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    background: HR_COLORS.card,
    border: `1px solid ${HR_COLORS.cardBorder}`,
    padding: 36,
    ...style
  }
}, children);
Object.assign(window, {
  HR_COLORS,
  HR_FONT_DISPLAY,
  HR_FONT_META,
  HRTheme,
  HRFrame,
  HREyebrow,
  HRTitle,
  HRBody,
  HRCard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/hr_presentation/frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/hr_presentation/slides.jsx
try { (() => {
// HR presentation — 15 slides. Uses HRFrame from frame.jsx.

// ─── 01. COVER ──────────────────────────────────────────────────────
const HR01Cover = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      width: 1920,
      height: 1080,
      background: HR_COLORS.bg,
      overflow: "hidden",
      color: HR_COLORS.ink,
      fontFamily: HR_FONT_DISPLAY
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "url(../../assets/backgrounds/bg-grid.png) center / cover no-repeat",
      opacity: 0.85
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 60,
      top: 40,
      right: 60,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 360,
      lineHeight: 0.82,
      letterSpacing: "-0.02em",
      color: "#1c1c1c",
      whiteSpace: "nowrap"
    }
  }, "CHILLBASE"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      top: 56,
      display: "flex",
      justifyContent: "space-between",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "Human Resources"), /*#__PURE__*/React.createElement("span", null, "2025 \xB7 Q1")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      bottom: 160,
      right: 80
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 16,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600,
      marginBottom: 32
    }
  }, "HR \xB7 Internal presentation"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 160,
      lineHeight: 0.92,
      letterSpacing: "-0.02em",
      color: HR_COLORS.ink,
      maxWidth: 1400
    }
  }, "People First.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent
    }
  }, "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u2014 \u044D\u0442\u043E \u043F\u0440\u043E\u0434\u0443\u043A\u0442."))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      bottom: 56,
      display: "flex",
      justifyContent: "space-between",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "ChillBase / HR Deck"), /*#__PURE__*/React.createElement("span", null, "v1.0 \xB7 February 2025")));
};

// ─── 02. AGENDA ─────────────────────────────────────────────────────
const HR02Agenda = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const items = [["01", "Onboarding", "Как мы встречаем новых людей"], ["02", "Команды и структура", "Организационная карта ChillBase"], ["03", "Performance Review", "Цели, цикл и ожидания"], ["04", "All-hands Q1", "Итоги, метрики, план"], ["05", "Benefits & Culture", "Что мы даём сверх оклада"], ["06", "Q&A / Contacts", "С кем говорить и по каким вопросам"]];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 2
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Agenda \xB7 \u0421\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 96
  }, "\u0427\u0442\u043E \u0431\u0443\u0434\u0435\u0442 \u0434\u0430\u043B\u044C\u0448\u0435."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 72,
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      columnGap: 64,
      rowGap: 40
    }
  }, items.map(([n, t, d]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: "flex",
      gap: 28,
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 72,
      lineHeight: 1,
      color: accent,
      letterSpacing: "-0.02em",
      minWidth: 120
    }
  }, n), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 40,
      lineHeight: 1.1,
      color: HR_COLORS.ink,
      letterSpacing: "-0.01em"
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontFamily: HR_FONT_META,
      fontSize: 18,
      color: HR_COLORS.muted,
      lineHeight: 1.4
    }
  }, d))))));
};

// ─── 03. SECTION DIVIDER ────────────────────────────────────────────
const HR03Section = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 3
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: "100%",
      alignItems: "center",
      gap: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 480,
      lineHeight: 0.85,
      color: accent,
      letterSpacing: "-0.03em"
    }
  }, "01"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(HREyebrow, {
    color: HR_COLORS.muted
  }, "Section \xB7 \u0420\u0430\u0437\u0434\u0435\u043B"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 140
  }, "Onboarding."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement(HRBody, null, "\u041A\u0430\u043A \u043D\u043E\u0432\u0438\u0447\u043E\u043A \u043F\u0440\u043E\u0445\u043E\u0434\u0438\u0442 \u043F\u0435\u0440\u0432\u044B\u0435 30, 60 \u0438 90 \u0434\u043D\u0435\u0439 \u0432 ChillBase \u2014 \u0438 \u0447\u0442\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0434\u0435\u043B\u0430\u0435\u0442, \u0447\u0442\u043E\u0431\u044B \u043E\u043D \u043E\u0441\u0442\u0430\u043B\u0441\u044F.")))));
};

// ─── 04. TEXT + IMAGE ───────────────────────────────────────────────
const HR04TextImage = () => /*#__PURE__*/React.createElement(HRFrame, {
  page: 4
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 96,
    height: "100%",
    alignItems: "start"
  }
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(HREyebrow, null, "01 \xB7 \u0424\u0438\u043B\u043E\u0441\u043E\u0444\u0438\u044F \u043D\u0430\u0439\u043C\u0430"), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 32
  }
}, /*#__PURE__*/React.createElement(HRTitle, {
  size: 80
}, "\u041C\u044B \u043D\u0430\u043D\u0438\u043C\u0430\u0435\u043C \u043B\u044E\u0434\u0435\u0439, \u0430 \u043D\u0435 \u0440\u043E\u043B\u0438.")), /*#__PURE__*/React.createElement("div", {
  style: {
    height: 1,
    background: HR_COLORS.rule,
    margin: "40px 0"
  }
}), /*#__PURE__*/React.createElement(HRBody, null, "ChillBase \u0441\u0442\u0440\u043E\u0438\u0442 \u0431\u043E\u043B\u044C\u0448\u0438\u0435 \u0438\u0433\u0440\u044B. \u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043D\u0443\u0436\u043D\u044B \u043D\u0435 \xAB\u0444\u0443\u043D\u043A\u0446\u0438\u0438\xBB \u0432 \u0448\u0442\u0430\u0442\u043A\u0435, \u0430 \u043B\u0438\u0447\u043D\u043E\u0441\u0442\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0435\u0441\u0443\u0442 \u0441\u0432\u043E\u044E \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u0443 \u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440. \u041C\u044B \u0438\u0449\u0435\u043C \u0441\u043C\u0435\u043B\u043E\u0441\u0442\u044C, \u043B\u044E\u0431\u043E\u043F\u044B\u0442\u0441\u0442\u0432\u043E \u0438 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0441\u043F\u043E\u0440\u0438\u0442\u044C \u0441 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u043C\u0438 \u0440\u0435\u0448\u0435\u043D\u0438\u044F\u043C\u0438."), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 24
  }
}, /*#__PURE__*/React.createElement(HRBody, null, "\u041E\u043D\u0431\u043E\u0440\u0434\u0438\u043D\u0433 \u2014 \u044D\u0442\u043E \u043D\u0435 \u0432\u0432\u043E\u0434\u043D\u0430\u044F \u043B\u0435\u043A\u0446\u0438\u044F, \u0430 \u043F\u0435\u0440\u0432\u044B\u0435 90 \u0434\u043D\u0435\u0439, \u0437\u0430 \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u043E\u0432\u0438\u0447\u043E\u043A \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u0440\u043E\u043C, \u0430 \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u0435\u043C."))), /*#__PURE__*/React.createElement("div", {
  style: {
    alignSelf: "stretch",
    background: HR_COLORS.card,
    border: `1px solid ${HR_COLORS.cardBorder}`,
    padding: 48,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 620
  }
}, /*#__PURE__*/React.createElement(HREyebrow, null, "Core Pillar"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: HR_FONT_DISPLAY,
    fontWeight: 700,
    fontSize: 48,
    lineHeight: 1.1,
    letterSpacing: "-0.005em",
    color: HR_COLORS.ink
  }
}, "\u0411\u0435\u0441\u0441\u0442\u0440\u0430\u0448\u0438\u0435, \u0434\u0435\u0440\u0437\u043E\u0441\u0442\u044C \u0438 \u043F\u043E\u0434\u043B\u0438\u043D\u043D\u0430\u044F \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u2014 \u0432\u043E\u0442 \u043D\u0430\u0448 \u043F\u0443\u0442\u044C."), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "flex-end"
  }
}, /*#__PURE__*/React.createElement("img", {
  src: "../../assets/stickers/star-filled.png",
  alt: "",
  style: {
    height: 140
  }
})))));

// ─── 05. QUOTE ──────────────────────────────────────────────────────
const HR05Quote = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 5
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 280,
      lineHeight: 0.8,
      color: accent,
      letterSpacing: "-0.03em",
      marginBottom: -40
    }
  }, "\u201C"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 92,
      lineHeight: 1.05,
      letterSpacing: "-0.015em",
      color: HR_COLORS.ink,
      maxWidth: 1500
    }
  }, "\u041C\u044B \u0437\u0434\u0435\u0441\u044C \u043D\u0435 \u0434\u043B\u044F \u0442\u043E\u0433\u043E, \u0447\u0442\u043E\u0431\u044B \u0432\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C\u0441\u044F \u0432 \u0444\u043E\u0440\u043C\u044B \u2014 \u043C\u044B \u0437\u0434\u0435\u0441\u044C, \u0447\u0442\u043E\u0431\u044B \u0438\u0445 \u0440\u0430\u0437\u0431\u0438\u0442\u044C."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56,
      fontFamily: HR_FONT_META,
      fontSize: 18,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent
    }
  }, "\u2014 Brand Manifesto \xB7 ChillBase")), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/stickers/B.png",
    alt: "",
    style: {
      position: "absolute",
      right: 0,
      bottom: -20,
      width: 260,
      opacity: 0.9
    }
  }));
};

// ─── 06. KPI METRICS ────────────────────────────────────────────────
const HR06Metrics = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const items = [{
    k: "147",
    v: "сотрудников в студии",
    d: "+23 за квартал"
  }, {
    k: "92%",
    v: "ретеншен после 1 года",
    d: "цель — 90%"
  }, {
    k: "14",
    v: "дней от оффера до офиса",
    d: "−4 дня к Q4'24"
  }, {
    k: "4.6 / 5",
    v: "средний eNPS по опросу",
    d: "179 ответов"
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 6
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Q1 \xB7 People metrics"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u0426\u0438\u0444\u0440\u044B \u043A\u0432\u0430\u0440\u0442\u0430\u043B\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 72,
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 32
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      padding: 36,
      minHeight: 380,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(HREyebrow, {
    color: accent
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 112,
      lineHeight: 0.95,
      letterSpacing: "-0.02em",
      color: HR_COLORS.ink
    }
  }, it.k), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 20,
      color: HR_COLORS.ink,
      lineHeight: 1.35
    }
  }, it.v), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontFamily: HR_FONT_META,
      fontSize: 16,
      color: HR_COLORS.muted
    }
  }, it.d))))));
};

// ─── 07. TIMELINE ───────────────────────────────────────────────────
const HR07Timeline = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const steps = [{
    d: "День 1",
    t: "Welcome-day",
    b: "Встреча, ноутбук, доступы, ментор."
  }, {
    d: "Неделя 1",
    t: "Погружение",
    b: "Команда, продукт, процессы, ритуалы."
  }, {
    d: "30 дней",
    t: "Первый вклад",
    b: "Завершён onboarding-квест, личные цели."
  }, {
    d: "60 дней",
    t: "Автономия",
    b: "Владение задачами, feedback-loop с лидом."
  }, {
    d: "90 дней",
    t: "Финал-ревью",
    b: "Evaluation + план роста на полгода."
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 7
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Onboarding \xB7 Timeline"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041F\u0435\u0440\u0432\u044B\u0435 90 \u0434\u043D\u0435\u0439."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 80,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 40,
      height: 2,
      background: HR_COLORS.rule
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 24
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: "50%",
      background: accent,
      margin: "28px 0 0 0",
      boxShadow: "0 0 0 6px #121212",
      position: "relative",
      zIndex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32,
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600
    }
  }, s.d), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 36,
      lineHeight: 1.05,
      letterSpacing: "-0.01em",
      color: HR_COLORS.ink
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontFamily: HR_FONT_META,
      fontSize: 18,
      color: HR_COLORS.muted,
      lineHeight: 1.45
    }
  }, s.b))))));
};

// ─── 08. PROCESS / STEPS ────────────────────────────────────────────
const HR08Process = () => {
  const steps = [{
    t: "Self-review",
    b: "Сотрудник оценивает свои цели и вклад за период."
  }, {
    t: "Peer feedback",
    b: "3–5 коллег делятся 360° обратной связью."
  }, {
    t: "Manager review",
    b: "Лид сводит оценки и готовит рекомендацию."
  }, {
    t: "Calibration",
    b: "HR + heads выравнивают оценки по компании."
  }, {
    t: "1-on-1 итог",
    b: "Обсуждение результата и плана на следующий цикл."
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 8
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Process \xB7 Performance Review"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041A\u0430\u043A \u0443\u0441\u0442\u0440\u043E\u0435\u043D \u0440\u0435\u0432\u044C\u044E-\u0446\u0438\u043A\u043B."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 72,
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 20
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement(HRCard, {
    key: i,
    style: {
      minHeight: 360,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 72,
      lineHeight: 1,
      color: HR_COLORS.ink,
      letterSpacing: "-0.02em"
    }
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 26,
      lineHeight: 1.15,
      color: HR_COLORS.ink,
      letterSpacing: "-0.005em"
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontFamily: HR_FONT_META,
      fontSize: 16,
      color: HR_COLORS.muted,
      lineHeight: 1.5
    }
  }, s.b))))));
};

// ─── 09. COMPARISON TABLE ───────────────────────────────────────────
const HR09Table = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const rows = [["Цели", "Квартальные OKR, ~3 на человека", "Годовые KPI, 5–7 на человека"], ["Ревью", "Раз в полгода, 360°", "Раз в год, top-down"], ["Обратная связь", "Непрерывная, 1-on-1 еженедельно", "Финальная, на performance review"], ["Рост", "Индивидуальный план развития", "Стандартная лестница грейдов"], ["Оценка", "4 уровня: grow/meet/exceed/stellar", "5-балльная шкала"]];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 9
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Comparison \xB7 Old vs New"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 72
  }, "\u041D\u043E\u0432\u044B\u0439 \u043F\u043E\u0434\u0445\u043E\u0434 \u043A perf-\u0440\u0435\u0432\u044C\u044E."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56,
      border: `1px solid ${HR_COLORS.cardBorder}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1.4fr 1.4fr",
      background: HR_COLORS.card,
      borderBottom: `1px solid ${HR_COLORS.cardBorder}`
    }
  }, ["Параметр", "ChillBase 2025", "Старый подход"].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: "24px 28px",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: i === 1 ? accent : HR_COLORS.muted,
      fontWeight: 600,
      borderLeft: i === 0 ? "none" : `1px solid ${HR_COLORS.cardBorder}`
    }
  }, h))), rows.map((r, ri) => /*#__PURE__*/React.createElement("div", {
    key: ri,
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1.4fr 1.4fr",
      borderBottom: ri === rows.length - 1 ? "none" : `1px solid ${HR_COLORS.cardBorder}`
    }
  }, r.map((cell, ci) => /*#__PURE__*/React.createElement("div", {
    key: ci,
    style: {
      padding: "24px 28px",
      fontFamily: HR_FONT_META,
      fontSize: 20,
      lineHeight: 1.45,
      color: ci === 0 ? HR_COLORS.muted : HR_COLORS.ink,
      fontWeight: ci === 0 ? 500 : 400,
      borderLeft: ci === 0 ? "none" : `1px solid ${HR_COLORS.cardBorder}`,
      background: ci === 1 ? "rgba(255,0,0,0.04)" : "transparent"
    }
  }, cell))))));
};

// ─── 10. DONUT CHART ────────────────────────────────────────────────
const HR10Donut = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const data = [{
    k: "Геймдизайн",
    v: 34,
    c: accent
  }, {
    k: "Разработка",
    v: 28,
    c: "#ffffff"
  }, {
    k: "Арт",
    v: 18,
    c: "#7a7a7a"
  }, {
    k: "Продюсеры",
    v: 12,
    c: "#454545"
  }, {
    k: "Остальные",
    v: 8,
    c: "#2a2a2a"
  }];
  const total = data.reduce((a, b) => a + b.v, 0);
  const R = 180,
    C = 2 * Math.PI * R;
  let offset = 0;
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 10
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Team composition"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u0432 \u0440\u0430\u0437\u0440\u0435\u0437\u0435."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 80,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 500 500",
    width: "500",
    height: "500"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "250",
    cy: "250",
    r: R,
    fill: "none",
    stroke: HR_COLORS.card,
    strokeWidth: "60"
  }), data.map((d, i) => {
    const len = d.v / total * C;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: "250",
      cy: "250",
      r: R,
      fill: "none",
      stroke: d.c,
      strokeWidth: "60",
      strokeDasharray: `${len} ${C - len}`,
      strokeDashoffset: -offset,
      transform: "rotate(-90 250 250)"
    });
    offset += len;
    return el;
  }), /*#__PURE__*/React.createElement("text", {
    x: "250",
    y: "238",
    textAnchor: "middle",
    fontFamily: HR_FONT_DISPLAY,
    fontWeight: "700",
    fontSize: "96",
    fill: HR_COLORS.ink,
    letterSpacing: "-0.02em"
  }, "147"), /*#__PURE__*/React.createElement("text", {
    x: "250",
    y: "282",
    textAnchor: "middle",
    fontFamily: HR_FONT_META,
    fontSize: "18",
    fill: HR_COLORS.muted,
    letterSpacing: "0.18em"
  }, "PEOPLE"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 16,
      background: d.c,
      borderRadius: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: HR_FONT_META,
      fontSize: 22,
      color: HR_COLORS.ink
    }
  }, d.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 32,
      color: HR_COLORS.ink,
      letterSpacing: "-0.01em"
    }
  }, d.v, "%"))))));
};

// ─── 11. PROGRESS BARS ──────────────────────────────────────────────
const HR11Progress = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const goals = [["Снизить time-to-hire до 14 дней", 100], ["Внедрить peer-review во всех отделах", 82], ["eNPS выше 4.5", 92], ["Обучение: 2+ курса на сотрудника", 64], ["Ретеншен 90%+ на конец года", 73]];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 11
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "OKR \xB7 Q1 progress"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u0426\u0435\u043B\u0438 \u0438 \u0438\u0445 \u0441\u0442\u0430\u0442\u0443\u0441."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 72,
      display: "flex",
      flexDirection: "column",
      gap: 36
    }
  }, goals.map(([name, pct], i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 24,
      color: HR_COLORS.ink
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 36,
      color: pct >= 90 ? accent : HR_COLORS.ink,
      letterSpacing: "-0.01em"
    }
  }, pct, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: `${pct}%`,
      background: pct >= 90 ? accent : HR_COLORS.ink
    }
  }))))));
};

// ─── 12. TEAM PROFILES ──────────────────────────────────────────────
const HR12Team = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const people = [{
    n: "Анна К.",
    r: "Head of People",
    l: "HR · Recruitment",
    sticker: "star-filled.png"
  }, {
    n: "Михаил В.",
    r: "People Partner",
    l: "Ops · L&D",
    sticker: "heart.png"
  }, {
    n: "Елена Ш.",
    r: "Talent Acquisition",
    l: "Hiring",
    sticker: "popper.png"
  }, {
    n: "Дмитрий Р.",
    r: "HR Operations",
    l: "Benefits · Payroll",
    sticker: "smile.png"
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 12
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Your HR team"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041A \u043A\u043E\u043C\u0443 \u0438\u0434\u0442\u0438 \u0438 \u0437\u0430\u0447\u0435\u043C."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 64,
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 24
    }
  }, people.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      padding: 32,
      minHeight: 440,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      aspectRatio: "1 / 1",
      background: "#0e0e0e",
      border: `1px solid ${HR_COLORS.cardBorder}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: `../../assets/stickers/${p.sticker}`,
    alt: "",
    style: {
      width: "55%"
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 12,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600,
      marginBottom: 8
    }
  }, p.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 28,
      lineHeight: 1.15,
      color: HR_COLORS.ink,
      letterSpacing: "-0.005em"
    }
  }, p.n), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontFamily: HR_FONT_META,
      fontSize: 16,
      color: HR_COLORS.muted
    }
  }, p.r))))));
};

// ─── 13. CARDS GRID (BENEFITS) ──────────────────────────────────────
const HR13Cards = () => {
  const items = [{
    t: "Гибкий график",
    b: "Работаем по результату, не по часам."
  }, {
    t: "ДМС + стоматология",
    b: "Для сотрудника и членов семьи."
  }, {
    t: "Образование",
    b: "40k ₽ в год на курсы, книги, конференции."
  }, {
    t: "Удалёнка",
    b: "Офис — опция, а не обязанность."
  }, {
    t: "Wellness",
    b: "Компенсация спорта, психотерапии, йоги."
  }, {
    t: "Game perks",
    b: "Любые игры студии + доступ к beta."
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 13
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Benefits \xB7 \u0427\u0442\u043E \u043C\u044B \u0434\u0430\u0451\u043C"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041F\u0430\u043A\u0435\u0442 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 64,
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 24
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement(HRCard, {
    key: i,
    style: {
      minHeight: 220,
      padding: 32,
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 32,
      lineHeight: 1.1,
      color: HR_COLORS.ink,
      letterSpacing: "-0.005em"
    }
  }, it.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 18,
      color: HR_COLORS.muted,
      lineHeight: 1.45
    }
  }, it.b)))));
};

// ─── 14. FAQ ────────────────────────────────────────────────────────
const HR14FAQ = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const qa = [["Когда ближайший performance review?", "Цикл стартует 1 марта. Self-review — до 14 марта."], ["Как попасть в другую команду внутри студии?", "1-on-1 с лидом + встреча с HR. Внутренние переходы приветствуются."], ["Где смотреть зарплатные вилки и грейды?", "В Notion → «People» → «Compensation map». Доступ — у всех."], ["Что делать в первый день?", "Ждать welcome-письма с доступами. Дальше — ментор встречает в 10:00."], ["Как взять отпуск?", "Через Personio. Подтверждение — за 7 дней, длиннее 10 — за 14."]];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 14
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "FAQ \xB7 \u0427\u0430\u0441\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041E \u0447\u0451\u043C \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u044E\u0442 \u0447\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043E."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56,
      display: "flex",
      flexDirection: "column"
    }
  }, qa.map(([q, a], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: "28px 0",
      borderTop: `1px solid ${HR_COLORS.rule}`,
      borderBottom: i === qa.length - 1 ? `1px solid ${HR_COLORS.rule}` : "none",
      display: "grid",
      gridTemplateColumns: "80px 1fr 1.4fr",
      columnGap: 40,
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 32,
      color: accent,
      letterSpacing: "-0.02em"
    }
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 26,
      color: HR_COLORS.ink,
      lineHeight: 1.3,
      letterSpacing: "-0.005em"
    }
  }, q), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 20,
      color: HR_COLORS.muted,
      lineHeight: 1.5
    }
  }, a)))));
};

// ─── 15. CONTACTS / Q&A ─────────────────────────────────────────────
const HR15Contacts = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 15
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Q&A"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 260,
      lineHeight: 0.88,
      letterSpacing: "-0.02em",
      color: HR_COLORS.ink
    }
  }, "\u0421\u043F\u0430\u0441\u0438\u0431\u043E."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 48,
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 24,
      maxWidth: 1400
    }
  }, [["Email", "people@chillbase.games"], ["Slack", "#ask-hr"], ["Офис", "Москва · 5 этаж · ChillBase HQ"]].map(([l, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: "24px 28px",
      border: `1px solid ${HR_COLORS.cardBorder}`,
      background: HR_COLORS.card
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 12,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 28,
      color: HR_COLORS.ink,
      letterSpacing: "-0.005em"
    }
  }, v))))));
};
Object.assign(window, {
  HR01Cover,
  HR02Agenda,
  HR03Section,
  HR04TextImage,
  HR05Quote,
  HR06Metrics,
  HR07Timeline,
  HR08Process,
  HR09Table,
  HR10Donut,
  HR11Progress,
  HR12Team,
  HR13Cards,
  HR14FAQ,
  HR15Contacts
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/hr_presentation/slides.jsx", error: String((e && e.message) || e) }); }

// ui_kits/presentation/slides.jsx
try { (() => {
// Minimal ChillBase slide template. 1920×1080.
// One clean layout system: top bar (logo + meta), content area, bottom bar (footer + page).
// All slides share the <Frame> wrapper. Slides just fill the content area.

const COLORS = {
  ink: "#f5f5f5",
  paper: "#121212",
  muted: "#8a8a8a",
  rule: "#2a2a2a",
  accent: "#ff0000"
};
const FONT_DISPLAY = "'Good Headline Pro','Archivo',sans-serif";
const FONT_META = "'Onest',sans-serif";
const Frame = ({
  children,
  page,
  total,
  meta = "CHILLBASE · АЙДЕНТИКА · 2025"
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    inset: 0,
    width: 1920,
    height: 1080,
    background: COLORS.paper,
    color: COLORS.ink,
    overflow: "hidden",
    fontFamily: FONT_DISPLAY
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    left: 80,
    right: 80,
    top: 56,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontFamily: FONT_META,
    fontSize: 14,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: COLORS.muted
  }
}, /*#__PURE__*/React.createElement("img", {
  src: "../../assets/logos/logotype-horizontal-inverted.svg",
  alt: "",
  style: {
    height: 24
  }
}), /*#__PURE__*/React.createElement("span", null, meta)), /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    left: 80,
    right: 80,
    top: 110,
    height: 1,
    background: COLORS.rule
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    left: 80,
    right: 80,
    top: 150,
    bottom: 150
  }
}, children), /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    left: 80,
    right: 80,
    bottom: 110,
    height: 1,
    background: COLORS.rule
  }
}), /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    left: 80,
    right: 80,
    bottom: 56,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontFamily: FONT_META,
    fontSize: 14,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: COLORS.muted
  }
}, /*#__PURE__*/React.createElement("span", null, "\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E \u043F\u043E \u0431\u0440\u0435\u043D\u0434\u0443"), page && total && /*#__PURE__*/React.createElement("span", null, String(page).padStart(2, "0"), " / ", String(total).padStart(2, "0"))));

// ────────────────────────────────────────────────────────────
// Slide templates
// ────────────────────────────────────────────────────────────

const TitleSlide = () => /*#__PURE__*/React.createElement(Frame, {
  page: 1,
  total: 5
}, /*#__PURE__*/React.createElement("div", {
  style: {
    position: "absolute",
    left: 0,
    bottom: 0
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: FONT_META,
    fontSize: 16,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: COLORS.accent,
    marginBottom: 48
  }
}, "Brand Guidelines \xB7 2025"), /*#__PURE__*/React.createElement("h1", {
  style: {
    margin: 0,
    fontWeight: 700,
    fontSize: 220,
    lineHeight: 0.88,
    letterSpacing: "-0.02em"
  }
}, "ChillBase", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
  style: {
    color: COLORS.accent
  }
}, "Identity.")), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 40,
    fontFamily: FONT_META,
    fontSize: 22,
    color: COLORS.muted,
    maxWidth: 780,
    lineHeight: 1.5
  }
}, "\u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0447\u043D\u043E\u0441\u0442\u0438, \u0442\u0438\u043F\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u0438 \u0442\u043E\u043D\u0430 \u0433\u043E\u043B\u043E\u0441\u0430 \u0434\u043B\u044F \u0432\u0441\u0435\u0445 \u043A\u0430\u043D\u0430\u043B\u043E\u0432.")));
const SectionSlide = () => /*#__PURE__*/React.createElement(Frame, {
  page: 2,
  total: 5
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    height: "100%",
    alignItems: "center",
    gap: 120
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: FONT_DISPLAY,
    fontWeight: 700,
    fontSize: 420,
    lineHeight: 0.85,
    color: COLORS.accent,
    letterSpacing: "-0.03em"
  }
}, "02"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: FONT_META,
    fontSize: 16,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: COLORS.muted,
    marginBottom: 32
  }
}, "Section"), /*#__PURE__*/React.createElement("h2", {
  style: {
    margin: 0,
    fontSize: 128,
    lineHeight: 1.0,
    letterSpacing: "-0.02em",
    fontWeight: 700
  }
}, "\u0422\u0438\u043F\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u0430"), /*#__PURE__*/React.createElement("p", {
  style: {
    marginTop: 32,
    fontFamily: FONT_META,
    fontSize: 22,
    color: COLORS.muted,
    maxWidth: 640,
    lineHeight: 1.5
  }
}, "\u0428\u0440\u0438\u0444\u0442\u043E\u0432\u0430\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u0430, \u0438\u0435\u0440\u0430\u0440\u0445\u0438\u044F \u0438 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F."))));
const ContentSlide = () => /*#__PURE__*/React.createElement(Frame, {
  page: 3,
  total: 5
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 96,
    height: "100%",
    alignItems: "start"
  }
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: FONT_META,
    fontSize: 16,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: COLORS.accent,
    marginBottom: 32
  }
}, "03 \xB7 \u0424\u0438\u043B\u043E\u0441\u043E\u0444\u0438\u044F"), /*#__PURE__*/React.createElement("h2", {
  style: {
    margin: 0,
    fontSize: 88,
    lineHeight: 1.0,
    letterSpacing: "-0.015em",
    fontWeight: 700
  }
}, "\u041D\u0430\u0448 \u043F\u0443\u0442\u044C \u2014 \u0431\u0435\u0441\u0441\u0442\u0440\u0430\u0448\u0438\u0435."), /*#__PURE__*/React.createElement("div", {
  style: {
    height: 1,
    background: COLORS.rule,
    margin: "48px 0"
  }
}), /*#__PURE__*/React.createElement("p", {
  style: {
    fontFamily: FONT_META,
    fontSize: 22,
    lineHeight: 1.55,
    color: "#bfbfbf",
    margin: 0,
    maxWidth: 680
  }
}, "ChillBase \u0441\u0442\u0440\u043E\u0438\u0442 \u0431\u043E\u043B\u044C\u0448\u0438\u0435 \u0438\u0433\u0440\u044B \u0434\u043B\u044F \u0438\u0433\u0440\u043E\u043A\u043E\u0432, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u0431\u043E\u043B\u044C\u0448\u0435, \u0447\u0435\u043C \u043E\u0431\u044B\u0447\u043D\u044B\u0435 \u0438\u0441\u0442\u043E\u0440\u0438\u0438. \u041D\u0430\u0448\u0430 \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u0430 \u2014 \u0432 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430\u0445, \u043F\u043E\u0432\u0435\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u0438 \u0438 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E\u043C \u0434\u0438\u0437\u0430\u0439\u043D\u0435. \u041C\u044B \u043D\u0435 \u0441\u043B\u0435\u0434\u0443\u0435\u043C \u0437\u0430 \u0442\u0435\u043D\u0434\u0435\u043D\u0446\u0438\u044F\u043C\u0438 \u2014 \u043C\u044B \u0431\u0440\u043E\u0441\u0430\u0435\u043C \u0438\u043C \u0432\u044B\u0437\u043E\u0432.")), /*#__PURE__*/React.createElement("div", {
  style: {
    alignSelf: "stretch",
    background: "#1a1a1a",
    border: `1px solid ${COLORS.rule}`,
    padding: 48,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between"
  }
}, /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: FONT_META,
    fontSize: 14,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: COLORS.accent
  }
}, "Core Pillar"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: FONT_DISPLAY,
    fontWeight: 700,
    fontSize: 48,
    lineHeight: 1.1,
    letterSpacing: "-0.005em",
    margin: "24px 0 0 0"
  }
}, "\u0411\u0435\u0441\u0441\u0442\u0440\u0430\u0448\u0438\u0435, \u0434\u0435\u0440\u0437\u043E\u0441\u0442\u044C \u0438 \u043F\u043E\u0434\u043B\u0438\u043D\u043D\u0430\u044F \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u2014 \u0432\u043E\u0442 \u043D\u0430\u0448 \u043F\u0443\u0442\u044C."), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: FONT_META,
    fontSize: 16,
    color: COLORS.muted,
    marginTop: 24
  }
}, "\u2014 Brand Manifesto"))));
const MetricsSlide = () => {
  const items = [{
    k: "12+",
    v: "Игровых проектов в портфолио студии."
  }, {
    k: "8",
    v: "Направлений — от нарратива до геймдизайна."
  }, {
    k: "2014",
    v: "Год основания ChillBase."
  }, {
    k: "100%",
    v: "Вовлечённость в каждый запуск."
  }];
  return /*#__PURE__*/React.createElement(Frame, {
    page: 4,
    total: 5
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT_META,
      fontSize: 16,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: COLORS.accent,
      marginBottom: 24
    }
  }, "04 \xB7 \u0412 \u0446\u0438\u0444\u0440\u0430\u0445"), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "0 0 64px 0",
      fontSize: 80,
      lineHeight: 1.0,
      letterSpacing: "-0.015em",
      fontWeight: 700
    }
  }, "\u0424\u0430\u043A\u0442\u044B \u043E \u0441\u0442\u0443\u0434\u0438\u0438."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 48
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 120,
      lineHeight: 1.0,
      letterSpacing: "-0.02em",
      color: COLORS.ink
    }
  }, it.k), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: COLORS.rule,
      margin: "20px 0 16px 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: FONT_META,
      fontSize: 18,
      lineHeight: 1.5,
      color: COLORS.muted
    }
  }, it.v))))));
};
const ThankYouSlide = () => /*#__PURE__*/React.createElement(Frame, {
  page: 5,
  total: 5
}, /*#__PURE__*/React.createElement("div", {
  style: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center"
  }
}, /*#__PURE__*/React.createElement("h1", {
  style: {
    margin: 0,
    fontWeight: 700,
    fontSize: 300,
    lineHeight: 0.88,
    letterSpacing: "-0.02em",
    color: COLORS.ink
  }
}, "\u0421\u043F\u0430\u0441\u0438\u0431\u043E."), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 56,
    fontFamily: FONT_META,
    fontSize: 22,
    color: COLORS.muted,
    maxWidth: 780,
    lineHeight: 1.5
  }
}, "\u0412\u043E\u043F\u0440\u043E\u0441\u044B \u0438 \u043E\u0431\u0440\u0430\u0442\u043D\u0430\u044F \u0441\u0432\u044F\u0437\u044C \u2014 brand@chillbase.games")));
window.TitleSlide = TitleSlide;
window.SectionSlide = SectionSlide;
window.ContentSlide = ContentSlide;
window.MetricsSlide = MetricsSlide;
window.ThankYouSlide = ThankYouSlide;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/presentation/slides.jsx", error: String((e && e.message) || e) }); }

// ui_kits/presentation_template/frame.jsx
try { (() => {
// HR Presentation — shared Frame chrome. 1920×1080 dark grid canvas.
// Every slide except Cover uses this Frame.
// Chrome: top bar (FEBRUARY · 2025 style meta + top rule), bottom bar (footer + page number).

const HR_COLORS = {
  bg: "#121212",
  ink: "#f5f5f5",
  muted: "#7a7a7a",
  rule: "#2a2a2a",
  accent: "#ff0000",
  card: "#1a1a1a",
  cardBorder: "#2f2f2f"
};
const HR_FONT_DISPLAY = "'Good Headline Pro','Archivo',sans-serif";
const HR_FONT_META = "'Onest',sans-serif";

// Theme context — for accent color tweak + page-numbers toggle
const HRTheme = React.createContext({
  accent: HR_COLORS.accent,
  showPages: true
});
const HRFrame = ({
  children,
  page,
  total = 21,
  top = {
    left: "CHILLBASE",
    right: "2025"
  },
  footerLeft = "Presentation template · Внутренняя презентация",
  projectLabel = "ChillBase / Presentation",
  padded = true
}) => {
  const {
    accent,
    showPages
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      width: 1920,
      height: 1080,
      background: HR_COLORS.bg,
      color: HR_COLORS.ink,
      overflow: "hidden",
      fontFamily: HR_FONT_DISPLAY
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "url(../../assets/backgrounds/bg-grid.png) center / cover no-repeat",
      opacity: 0.85
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(18,18,18,0.35)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      top: 56,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, top.left), /*#__PURE__*/React.createElement("span", null, top.right)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      top: 98,
      width: 560,
      height: 1,
      background: HR_COLORS.rule
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: padded ? 80 : 0,
      right: padded ? 80 : 0,
      top: padded ? 140 : 0,
      bottom: padded ? 140 : 0
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      bottom: 98,
      width: 560,
      height: 1,
      background: HR_COLORS.rule
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      bottom: 56,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      maxWidth: 800
    }
  }, footerLeft), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 32,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null, projectLabel), showPages && page != null && /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent,
      fontWeight: 700
    }
  }, String(page).padStart(2, "0"), " / ", String(total).padStart(2, "0")))));
};

// Small reusable building blocks
const HREyebrow = ({
  children,
  color
}) => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 16,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: color || accent,
      fontWeight: 600
    }
  }, children);
};
const HRTitle = ({
  children,
  size = 88,
  maxWidth
}) => /*#__PURE__*/React.createElement("h2", {
  style: {
    margin: 0,
    fontFamily: HR_FONT_DISPLAY,
    fontWeight: 700,
    fontSize: size,
    lineHeight: 1.0,
    letterSpacing: "-0.015em",
    color: HR_COLORS.ink,
    maxWidth
  }
}, children);
const HRBody = ({
  children,
  size = 22,
  maxWidth = 780
}) => /*#__PURE__*/React.createElement("p", {
  style: {
    margin: 0,
    fontFamily: HR_FONT_META,
    fontSize: size,
    lineHeight: 1.55,
    color: "#bfbfbf",
    maxWidth
  }
}, children);
const HRCard = ({
  children,
  style
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    background: HR_COLORS.card,
    border: `1px solid ${HR_COLORS.cardBorder}`,
    padding: 36,
    ...style
  }
}, children);

// ─── PATTERN LAYER ──────────────────────────────────────────────────
// Reusable animated pattern (from /Patterns.html) — used on cover + final.
// `variant` = 'grid' | 'dot'. Renders the base tiled pattern + a layer of
// slowly pulsing red 3×3 px dots on random pattern nodes.
const PatternLayer = ({
  variant = "grid",
  count,
  seed = 0,
  cell,
  // override cell size in px (default 80 grid / 40 dot)
  outerInset = 16,
  // px between slide edge and the pattern area
  bleed = false // when true, ignore outerInset — pattern goes edge-to-edge
}) => {
  const layerRef = React.useRef(null);
  const inset = bleed ? 0 : outerInset;
  const CW = 1920 - inset * 2;
  const CH = 1080 - inset * 2;
  const _cell = cell != null ? cell : variant === "grid" ? 80 : 40;
  const nDots = count != null ? count : variant === "grid" ? 17 : 35;
  React.useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.innerHTML = "";
    // Deterministic-ish PRNG so slides don't reshuffle every render
    let s = 1337 + seed * 101;
    const rnd = () => {
      s = s * 1103515245 + 12345 & 0x7fffffff;
      return s / 0x7fffffff;
    };
    const cols = Math.floor(CW / _cell);
    const rows = Math.floor(CH / _cell);
    const padC = 2,
      padR = 2;
    const used = new Set();
    const picks = [];
    let tries = 0;
    while (picks.length < nDots && tries < nDots * 25) {
      tries++;
      const c = padC + Math.floor(rnd() * (cols - padC * 2));
      const r = padR + Math.floor(rnd() * (rows - padR * 2));
      const key = c + ":" + r;
      if (used.has(key)) continue;
      used.add(key);
      picks.push([c, r]);
    }
    picks.forEach(([c, r]) => {
      const x = c * _cell / CW * 100;
      const y = r * _cell / CH * 100;
      const el = document.createElement("div");
      el.className = "pt-reddot";
      el.style.cssText = `
        position:absolute; left:${x}%; top:${y}%;
        width:3px; height:3px; margin:-1.5px 0 0 -1.5px;
        background:#ff0000; opacity:0;
        animation: pt-pulse ${4000 + Math.floor(rnd() * 3500)}ms
          cubic-bezier(.2,.8,.2,1) ${Math.floor(rnd() * 9000)}ms infinite;
      `;
      layer.appendChild(el);
    });
  }, [variant, nDots, seed, _cell, inset]);
  const gridBg = `
    linear-gradient(to right, rgba(244,245,240,0.055) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(244,245,240,0.055) 1px, transparent 1px)
  `;
  const dotBg = `radial-gradient(circle at 1px 1px, rgba(244,245,240,0.16) 1.2px, transparent 1.6px)`;
  const cellPx = `${_cell}px ${_cell}px`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: inset,
      background: "#0f0f0f",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: variant === "grid" ? gridBg : dotBg,
      backgroundSize: cellPx
    }
  }), /*#__PURE__*/React.createElement("div", {
    ref: layerRef,
    style: {
      position: "absolute",
      inset: 0,
      pointerEvents: "none"
    }
  }));
};

// Inject pulse keyframes once (outside of any single slide)
if (typeof document !== "undefined" && !document.getElementById("pt-pulse-style")) {
  const st = document.createElement("style");
  st.id = "pt-pulse-style";
  st.textContent = `
    @keyframes pt-pulse {
      0%   { opacity: 0; }
      15%  { opacity: 1; }
      55%  { opacity: 1; }
      80%  { opacity: 0; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(st);
}
Object.assign(window, {
  HR_COLORS,
  HR_FONT_DISPLAY,
  HR_FONT_META,
  HRTheme,
  HRFrame,
  HREyebrow,
  HRTitle,
  HRBody,
  HRCard,
  PatternLayer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/presentation_template/frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/presentation_template/slides.jsx
try { (() => {
// HR presentation — 15 slides. Uses HRFrame from frame.jsx.

// ─── 01. COVER ──────────────────────────────────────────────────────
const HR01Cover = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      width: 1920,
      height: 1080,
      background: HR_COLORS.bg,
      overflow: "hidden",
      color: HR_COLORS.ink,
      fontFamily: HR_FONT_DISPLAY
    }
  }, /*#__PURE__*/React.createElement(PatternLayer, {
    variant: "grid",
    cell: 40,
    bleed: true,
    count: 28,
    seed: 1
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 60,
      top: 40,
      right: 60,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 360,
      lineHeight: 0.82,
      letterSpacing: "-0.02em",
      color: "#1c1c1c",
      whiteSpace: "nowrap",
      pointerEvents: "none"
    }
  }, "CHILLBASE"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      top: 56,
      display: "flex",
      justifyContent: "space-between",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "Human Resources"), /*#__PURE__*/React.createElement("span", null, "2025 \xB7 Q1")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      bottom: 160,
      right: 80
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 16,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600,
      marginBottom: 32
    }
  }, "HR \xB7 Internal presentation"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 160,
      lineHeight: 0.92,
      letterSpacing: "-0.02em",
      color: HR_COLORS.ink,
      maxWidth: 1400
    }
  }, "People First.", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent
    }
  }, "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u2014 \u044D\u0442\u043E \u043F\u0440\u043E\u0434\u0443\u043A\u0442."))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      bottom: 56,
      display: "flex",
      justifyContent: "space-between",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "ChillBase / Presentation"), /*#__PURE__*/React.createElement("span", null, "v1.0 \xB7 Template")));
};

// ─── 02. AGENDA ─────────────────────────────────────────────────────
const HR02Agenda = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const items = [["01", "Onboarding", "Как мы встречаем новых людей"], ["02", "Команды и структура", "Организационная карта ChillBase"], ["03", "Performance Review", "Цели, цикл и ожидания"], ["04", "All-hands Q1", "Итоги, метрики, план"], ["05", "Benefits & Culture", "Что мы даём сверх оклада"], ["06", "Q&A / Contacts", "С кем говорить и по каким вопросам"]];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 2
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Agenda \xB7 \u0421\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 96
  }, "\u0427\u0442\u043E \u0431\u0443\u0434\u0435\u0442 \u0434\u0430\u043B\u044C\u0448\u0435."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 72,
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      columnGap: 64,
      rowGap: 40
    }
  }, items.map(([n, t, d]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: "flex",
      gap: 28,
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 72,
      lineHeight: 1,
      color: accent,
      letterSpacing: "-0.02em",
      minWidth: 120
    }
  }, n), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 40,
      lineHeight: 1.1,
      color: HR_COLORS.ink,
      letterSpacing: "-0.01em"
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      fontFamily: HR_FONT_META,
      fontSize: 18,
      color: HR_COLORS.muted,
      lineHeight: 1.4
    }
  }, d))))));
};

// ─── 03. SECTION DIVIDER ────────────────────────────────────────────
const HR03Section = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 3
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: "100%",
      alignItems: "center",
      gap: 100
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 480,
      lineHeight: 0.85,
      color: accent,
      letterSpacing: "-0.03em"
    }
  }, "01"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(HREyebrow, {
    color: HR_COLORS.muted
  }, "Section \xB7 \u0420\u0430\u0437\u0434\u0435\u043B"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 140
  }, "Onboarding."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement(HRBody, null, "\u041A\u0430\u043A \u043D\u043E\u0432\u0438\u0447\u043E\u043A \u043F\u0440\u043E\u0445\u043E\u0434\u0438\u0442 \u043F\u0435\u0440\u0432\u044B\u0435 30, 60 \u0438 90 \u0434\u043D\u0435\u0439 \u0432 ChillBase \u2014 \u0438 \u0447\u0442\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0430 \u0434\u0435\u043B\u0430\u0435\u0442, \u0447\u0442\u043E\u0431\u044B \u043E\u043D \u043E\u0441\u0442\u0430\u043B\u0441\u044F.")))));
};

// ─── 04. TEXT + IMAGE ───────────────────────────────────────────────
const HR04TextImage = () => /*#__PURE__*/React.createElement(HRFrame, {
  page: 4
}, /*#__PURE__*/React.createElement("div", {
  style: {
    display: "grid",
    gridTemplateColumns: "1.1fr 0.9fr",
    gap: 96,
    height: "100%",
    alignItems: "start"
  }
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(HREyebrow, null, "01 \xB7 \u0424\u0438\u043B\u043E\u0441\u043E\u0444\u0438\u044F \u043D\u0430\u0439\u043C\u0430"), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 32
  }
}, /*#__PURE__*/React.createElement(HRTitle, {
  size: 80
}, "\u041C\u044B \u043D\u0430\u043D\u0438\u043C\u0430\u0435\u043C \u043B\u044E\u0434\u0435\u0439, \u0430 \u043D\u0435 \u0440\u043E\u043B\u0438.")), /*#__PURE__*/React.createElement("div", {
  style: {
    height: 1,
    background: HR_COLORS.rule,
    margin: "40px 0"
  }
}), /*#__PURE__*/React.createElement(HRBody, null, "ChillBase \u0441\u0442\u0440\u043E\u0438\u0442 \u0431\u043E\u043B\u044C\u0448\u0438\u0435 \u0438\u0433\u0440\u044B. \u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u043D\u0443\u0436\u043D\u044B \u043D\u0435 \xAB\u0444\u0443\u043D\u043A\u0446\u0438\u0438\xBB \u0432 \u0448\u0442\u0430\u0442\u043A\u0435, \u0430 \u043B\u0438\u0447\u043D\u043E\u0441\u0442\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0435\u0441\u0443\u0442 \u0441\u0432\u043E\u044E \u044D\u043A\u0441\u043F\u0435\u0440\u0442\u0438\u0437\u0443 \u0438 \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440. \u041C\u044B \u0438\u0449\u0435\u043C \u0441\u043C\u0435\u043B\u043E\u0441\u0442\u044C, \u043B\u044E\u0431\u043E\u043F\u044B\u0442\u0441\u0442\u0432\u043E \u0438 \u0441\u043F\u043E\u0441\u043E\u0431\u043D\u043E\u0441\u0442\u044C \u0441\u043F\u043E\u0440\u0438\u0442\u044C \u0441 \u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u043C\u0438 \u0440\u0435\u0448\u0435\u043D\u0438\u044F\u043C\u0438."), /*#__PURE__*/React.createElement("div", {
  style: {
    marginTop: 24
  }
}, /*#__PURE__*/React.createElement(HRBody, null, "\u041E\u043D\u0431\u043E\u0440\u0434\u0438\u043D\u0433 \u2014 \u044D\u0442\u043E \u043D\u0435 \u0432\u0432\u043E\u0434\u043D\u0430\u044F \u043B\u0435\u043A\u0446\u0438\u044F, \u0430 \u043F\u0435\u0440\u0432\u044B\u0435 90 \u0434\u043D\u0435\u0439, \u0437\u0430 \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u043E\u0432\u0438\u0447\u043E\u043A \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u0440\u043E\u043C, \u0430 \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u0435\u043C."))), /*#__PURE__*/React.createElement("div", {
  style: {
    alignSelf: "stretch",
    background: HR_COLORS.card,
    border: `1px solid ${HR_COLORS.cardBorder}`,
    padding: 48,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 620
  }
}, /*#__PURE__*/React.createElement(HREyebrow, null, "Core Pillar"), /*#__PURE__*/React.createElement("div", {
  style: {
    fontFamily: HR_FONT_DISPLAY,
    fontWeight: 700,
    fontSize: 48,
    lineHeight: 1.1,
    letterSpacing: "-0.005em",
    color: HR_COLORS.ink
  }
}, "\u0411\u0435\u0441\u0441\u0442\u0440\u0430\u0448\u0438\u0435, \u0434\u0435\u0440\u0437\u043E\u0441\u0442\u044C \u0438 \u043F\u043E\u0434\u043B\u0438\u043D\u043D\u0430\u044F \u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u2014 \u0432\u043E\u0442 \u043D\u0430\u0448 \u043F\u0443\u0442\u044C."), /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    justifyContent: "flex-end"
  }
}, /*#__PURE__*/React.createElement("img", {
  src: "../../assets/stickers/star-filled.png",
  alt: "",
  style: {
    height: 140
  }
})))));

// ─── 05. QUOTE ──────────────────────────────────────────────────────
const HR05Quote = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 11
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 280,
      lineHeight: 0.8,
      color: accent,
      letterSpacing: "-0.03em",
      marginBottom: -40
    }
  }, "\u201C"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 92,
      lineHeight: 1.05,
      letterSpacing: "-0.015em",
      color: HR_COLORS.ink,
      maxWidth: 1500
    }
  }, "\u041C\u044B \u0437\u0434\u0435\u0441\u044C \u043D\u0435 \u0434\u043B\u044F \u0442\u043E\u0433\u043E, \u0447\u0442\u043E\u0431\u044B \u0432\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C\u0441\u044F \u0432 \u0444\u043E\u0440\u043C\u044B \u2014 \u043C\u044B \u0437\u0434\u0435\u0441\u044C, \u0447\u0442\u043E\u0431\u044B \u0438\u0445 \u0440\u0430\u0437\u0431\u0438\u0442\u044C."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56,
      fontFamily: HR_FONT_META,
      fontSize: 18,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent
    }
  }, "\u2014 Brand Manifesto \xB7 ChillBase")), /*#__PURE__*/React.createElement("img", {
    src: "../../assets/stickers/B.png",
    alt: "",
    style: {
      position: "absolute",
      right: 0,
      bottom: -20,
      width: 260,
      opacity: 0.9
    }
  }));
};

// ─── 06. KPI METRICS ────────────────────────────────────────────────
const HR06Metrics = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const items = [{
    k: "147",
    v: "сотрудников в студии",
    d: "+23 за квартал"
  }, {
    k: "92%",
    v: "ретеншен после 1 года",
    d: "цель — 90%"
  }, {
    k: "14",
    v: "дней от оффера до офиса",
    d: "−4 дня к Q4'24"
  }, {
    k: "4.6 / 5",
    v: "средний eNPS по опросу",
    d: "179 ответов"
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 12
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Q1 \xB7 People metrics"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u0426\u0438\u0444\u0440\u044B \u043A\u0432\u0430\u0440\u0442\u0430\u043B\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 72,
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 32
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      padding: 36,
      minHeight: 380,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(HREyebrow, {
    color: accent
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 112,
      lineHeight: 0.95,
      letterSpacing: "-0.02em",
      color: HR_COLORS.ink
    }
  }, it.k), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 20,
      color: HR_COLORS.ink,
      lineHeight: 1.35
    }
  }, it.v), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontFamily: HR_FONT_META,
      fontSize: 16,
      color: HR_COLORS.muted
    }
  }, it.d))))));
};

// ─── 07. TIMELINE ───────────────────────────────────────────────────
const HR07Timeline = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const steps = [{
    d: "День 1",
    t: "Welcome-day",
    b: "Встреча, ноутбук, доступы, ментор."
  }, {
    d: "Неделя 1",
    t: "Погружение",
    b: "Команда, продукт, процессы, ритуалы."
  }, {
    d: "30 дней",
    t: "Первый вклад",
    b: "Завершён onboarding-квест, личные цели."
  }, {
    d: "60 дней",
    t: "Автономия",
    b: "Владение задачами, feedback-loop с лидом."
  }, {
    d: "90 дней",
    t: "Финал-ревью",
    b: "Evaluation + план роста на полгода."
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 13
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Onboarding \xB7 Timeline"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041F\u0435\u0440\u0432\u044B\u0435 90 \u0434\u043D\u0435\u0439."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 80,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 40,
      height: 2,
      background: HR_COLORS.rule
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 24
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: "50%",
      background: accent,
      margin: "28px 0 0 0",
      boxShadow: "0 0 0 6px #121212",
      position: "relative",
      zIndex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32,
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600
    }
  }, s.d), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 36,
      lineHeight: 1.05,
      letterSpacing: "-0.01em",
      color: HR_COLORS.ink
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontFamily: HR_FONT_META,
      fontSize: 18,
      color: HR_COLORS.muted,
      lineHeight: 1.45
    }
  }, s.b))))));
};

// ─── 08. PROCESS / STEPS ────────────────────────────────────────────
const HR08Process = () => {
  const steps = [{
    t: "Self-review",
    b: "Сотрудник оценивает свои цели и вклад за период."
  }, {
    t: "Peer feedback",
    b: "3–5 коллег делятся 360° обратной связью."
  }, {
    t: "Manager review",
    b: "Лид сводит оценки и готовит рекомендацию."
  }, {
    t: "Calibration",
    b: "HR + heads выравнивают оценки по компании."
  }, {
    t: "1-on-1 итог",
    b: "Обсуждение результата и плана на следующий цикл."
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 14
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Process \xB7 Performance Review"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041A\u0430\u043A \u0443\u0441\u0442\u0440\u043E\u0435\u043D \u0440\u0435\u0432\u044C\u044E-\u0446\u0438\u043A\u043B."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 72,
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 20
    }
  }, steps.map((s, i) => /*#__PURE__*/React.createElement(HRCard, {
    key: i,
    style: {
      minHeight: 360,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 72,
      lineHeight: 1,
      color: HR_COLORS.ink,
      letterSpacing: "-0.02em"
    }
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 26,
      lineHeight: 1.15,
      color: HR_COLORS.ink,
      letterSpacing: "-0.005em"
    }
  }, s.t), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      fontFamily: HR_FONT_META,
      fontSize: 16,
      color: HR_COLORS.muted,
      lineHeight: 1.5
    }
  }, s.b))))));
};

// ─── 09. COMPARISON TABLE ───────────────────────────────────────────
const HR09Table = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const rows = [["Цели", "Квартальные OKR, ~3 на человека", "Годовые KPI, 5–7 на человека"], ["Ревью", "Раз в полгода, 360°", "Раз в год, top-down"], ["Обратная связь", "Непрерывная, 1-on-1 еженедельно", "Финальная, на performance review"], ["Рост", "Индивидуальный план развития", "Стандартная лестница грейдов"], ["Оценка", "4 уровня: grow/meet/exceed/stellar", "5-балльная шкала"]];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 15
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Comparison \xB7 Old vs New"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 72
  }, "\u041D\u043E\u0432\u044B\u0439 \u043F\u043E\u0434\u0445\u043E\u0434 \u043A perf-\u0440\u0435\u0432\u044C\u044E."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56,
      border: `1px solid ${HR_COLORS.cardBorder}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1.4fr 1.4fr",
      background: HR_COLORS.card,
      borderBottom: `1px solid ${HR_COLORS.cardBorder}`
    }
  }, ["Параметр", "ChillBase 2025", "Старый подход"].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: "24px 28px",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: i === 1 ? accent : HR_COLORS.muted,
      fontWeight: 600,
      borderLeft: i === 0 ? "none" : `1px solid ${HR_COLORS.cardBorder}`
    }
  }, h))), rows.map((r, ri) => /*#__PURE__*/React.createElement("div", {
    key: ri,
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1.4fr 1.4fr",
      borderBottom: ri === rows.length - 1 ? "none" : `1px solid ${HR_COLORS.cardBorder}`
    }
  }, r.map((cell, ci) => /*#__PURE__*/React.createElement("div", {
    key: ci,
    style: {
      padding: "24px 28px",
      fontFamily: HR_FONT_META,
      fontSize: 20,
      lineHeight: 1.45,
      color: ci === 0 ? HR_COLORS.muted : HR_COLORS.ink,
      fontWeight: ci === 0 ? 500 : 400,
      borderLeft: ci === 0 ? "none" : `1px solid ${HR_COLORS.cardBorder}`,
      background: ci === 1 ? "rgba(255,0,0,0.04)" : "transparent"
    }
  }, cell))))));
};

// ─── 10. DONUT CHART ────────────────────────────────────────────────
const HR10Donut = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const data = [{
    k: "Геймдизайн",
    v: 34,
    c: accent
  }, {
    k: "Разработка",
    v: 28,
    c: "#ffffff"
  }, {
    k: "Арт",
    v: 18,
    c: "#7a7a7a"
  }, {
    k: "Продюсеры",
    v: 12,
    c: "#454545"
  }, {
    k: "Остальные",
    v: 8,
    c: "#2a2a2a"
  }];
  const total = data.reduce((a, b) => a + b.v, 0);
  const R = 180,
    C = 2 * Math.PI * R;
  let offset = 0;
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 16
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Team composition"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 \u0432 \u0440\u0430\u0437\u0440\u0435\u0437\u0435."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 80,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 500 500",
    width: "500",
    height: "500"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "250",
    cy: "250",
    r: R,
    fill: "none",
    stroke: HR_COLORS.card,
    strokeWidth: "60"
  }), data.map((d, i) => {
    const len = d.v / total * C;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: "250",
      cy: "250",
      r: R,
      fill: "none",
      stroke: d.c,
      strokeWidth: "60",
      strokeDasharray: `${len} ${C - len}`,
      strokeDashoffset: -offset,
      transform: "rotate(-90 250 250)"
    });
    offset += len;
    return el;
  }), /*#__PURE__*/React.createElement("text", {
    x: "250",
    y: "238",
    textAnchor: "middle",
    fontFamily: HR_FONT_DISPLAY,
    fontWeight: "700",
    fontSize: "96",
    fill: HR_COLORS.ink,
    letterSpacing: "-0.02em"
  }, "147"), /*#__PURE__*/React.createElement("text", {
    x: "250",
    y: "282",
    textAnchor: "middle",
    fontFamily: HR_FONT_META,
    fontSize: "18",
    fill: HR_COLORS.muted,
    letterSpacing: "0.18em"
  }, "PEOPLE"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 24
    }
  }, data.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 16,
      height: 16,
      background: d.c,
      borderRadius: 2
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: HR_FONT_META,
      fontSize: 22,
      color: HR_COLORS.ink
    }
  }, d.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 32,
      color: HR_COLORS.ink,
      letterSpacing: "-0.01em"
    }
  }, d.v, "%"))))));
};

// ─── 11. PROGRESS BARS ──────────────────────────────────────────────
const HR11Progress = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const goals = [["Снизить time-to-hire до 14 дней", 100], ["Внедрить peer-review во всех отделах", 82], ["eNPS выше 4.5", 92], ["Обучение: 2+ курса на сотрудника", 64], ["Ретеншен 90%+ на конец года", 73]];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 17
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "OKR \xB7 Q1 progress"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u0426\u0435\u043B\u0438 \u0438 \u0438\u0445 \u0441\u0442\u0430\u0442\u0443\u0441."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 72,
      display: "flex",
      flexDirection: "column",
      gap: 36
    }
  }, goals.map(([name, pct], i) => /*#__PURE__*/React.createElement("div", {
    key: i
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 24,
      color: HR_COLORS.ink
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 36,
      color: pct >= 90 ? accent : HR_COLORS.ink,
      letterSpacing: "-0.01em"
    }
  }, pct, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: `${pct}%`,
      background: pct >= 90 ? accent : HR_COLORS.ink
    }
  }))))));
};

// ─── 12. TEAM PROFILES ──────────────────────────────────────────────
const HR12Team = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const people = [{
    n: "Анна К.",
    r: "Head of People",
    l: "HR · Recruitment",
    sticker: "star-filled.png"
  }, {
    n: "Михаил В.",
    r: "People Partner",
    l: "Ops · L&D",
    sticker: "heart.png"
  }, {
    n: "Елена Ш.",
    r: "Talent Acquisition",
    l: "Hiring",
    sticker: "popper.png"
  }, {
    n: "Дмитрий Р.",
    r: "HR Operations",
    l: "Benefits · Payroll",
    sticker: "smile.png"
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 18
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Your HR team"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041A \u043A\u043E\u043C\u0443 \u0438\u0434\u0442\u0438 \u0438 \u0437\u0430\u0447\u0435\u043C."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 64,
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 24
    }
  }, people.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      padding: 32,
      minHeight: 440,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      aspectRatio: "1 / 1",
      background: "#0e0e0e",
      border: `1px solid ${HR_COLORS.cardBorder}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: `../../assets/stickers/${p.sticker}`,
    alt: "",
    style: {
      width: "55%"
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 12,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600,
      marginBottom: 8
    }
  }, p.l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 28,
      lineHeight: 1.15,
      color: HR_COLORS.ink,
      letterSpacing: "-0.005em"
    }
  }, p.n), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontFamily: HR_FONT_META,
      fontSize: 16,
      color: HR_COLORS.muted
    }
  }, p.r))))));
};

// ─── 13. CARDS GRID (BENEFITS) ──────────────────────────────────────
const HR13Cards = () => {
  const items = [{
    t: "Гибкий график",
    b: "Работаем по результату, не по часам."
  }, {
    t: "ДМС + стоматология",
    b: "Для сотрудника и членов семьи."
  }, {
    t: "Образование",
    b: "40k ₽ в год на курсы, книги, конференции."
  }, {
    t: "Удалёнка",
    b: "Офис — опция, а не обязанность."
  }, {
    t: "Wellness",
    b: "Компенсация спорта, психотерапии, йоги."
  }, {
    t: "Game perks",
    b: "Любые игры студии + доступ к beta."
  }];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 19
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "Benefits \xB7 \u0427\u0442\u043E \u043C\u044B \u0434\u0430\u0451\u043C"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041F\u0430\u043A\u0435\u0442 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 64,
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 24
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement(HRCard, {
    key: i,
    style: {
      minHeight: 220,
      padding: 32,
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 32,
      lineHeight: 1.1,
      color: HR_COLORS.ink,
      letterSpacing: "-0.005em"
    }
  }, it.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 18,
      color: HR_COLORS.muted,
      lineHeight: 1.45
    }
  }, it.b)))));
};

// ─── 14. FAQ ────────────────────────────────────────────────────────
const HR14FAQ = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const qa = [["Когда ближайший performance review?", "Цикл стартует 1 марта. Self-review — до 14 марта."], ["Как попасть в другую команду внутри студии?", "1-on-1 с лидом + встреча с HR. Внутренние переходы приветствуются."], ["Где смотреть зарплатные вилки и грейды?", "В Notion → «People» → «Compensation map». Доступ — у всех."], ["Что делать в первый день?", "Ждать welcome-письма с доступами. Дальше — ментор встречает в 10:00."], ["Как взять отпуск?", "Через Personio. Подтверждение — за 7 дней, длиннее 10 — за 14."]];
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 20
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "FAQ \xB7 \u0427\u0430\u0441\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 80
  }, "\u041E \u0447\u0451\u043C \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u044E\u0442 \u0447\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043E."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 56,
      display: "flex",
      flexDirection: "column"
    }
  }, qa.map(([q, a], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: "28px 0",
      borderTop: `1px solid ${HR_COLORS.rule}`,
      borderBottom: i === qa.length - 1 ? `1px solid ${HR_COLORS.rule}` : "none",
      display: "grid",
      gridTemplateColumns: "80px 1fr 1.4fr",
      columnGap: 40,
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 32,
      color: accent,
      letterSpacing: "-0.02em"
    }
  }, String(i + 1).padStart(2, "0")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 26,
      color: HR_COLORS.ink,
      lineHeight: 1.3,
      letterSpacing: "-0.005em"
    }
  }, q), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 20,
      color: HR_COLORS.muted,
      lineHeight: 1.5
    }
  }, a)))));
};

// ─── 15. CONTACTS / Q&A (FINAL) ─────────────────────────────────────
const HR15Contacts = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      width: 1920,
      height: 1080,
      background: HR_COLORS.bg,
      overflow: "hidden",
      color: HR_COLORS.ink,
      fontFamily: HR_FONT_DISPLAY
    }
  }, /*#__PURE__*/React.createElement(PatternLayer, {
    variant: "dot",
    count: 45,
    seed: 99
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      top: 56,
      display: "flex",
      justifyContent: "space-between",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "Q&A"), /*#__PURE__*/React.createElement("span", null, "End \xB7 \u041A\u043E\u043D\u0435\u0446")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      top: 160,
      bottom: 140,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 16,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600,
      marginBottom: 24
    }
  }, "Q&A"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 260,
      lineHeight: 0.88,
      letterSpacing: "-0.02em",
      color: HR_COLORS.ink
    }
  }, "\u0421\u043F\u0430\u0441\u0438\u0431\u043E."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 48,
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 24,
      maxWidth: 1400
    }
  }, [["Email", "hello@chillbase.games"], ["Slack", "#studio-wide"], ["Офис", "Москва · ChillBase HQ"]].map(([l, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: "24px 28px",
      border: `1px solid ${HR_COLORS.cardBorder}`,
      background: "rgba(26,26,26,0.85)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 12,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 28,
      color: HR_COLORS.ink,
      letterSpacing: "-0.005em"
    }
  }, v))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 80,
      right: 80,
      bottom: 56,
      display: "flex",
      justifyContent: "space-between",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "ChillBase / Presentation"), /*#__PURE__*/React.createElement("span", null, "Thank you")));
};
Object.assign(window, {
  HR01Cover,
  HR02Agenda,
  HR03Section,
  HR04TextImage,
  HR05Quote,
  HR06Metrics,
  HR07Timeline,
  HR08Process,
  HR09Table,
  HR10Donut,
  HR11Progress,
  HR12Team,
  HR13Cards,
  HR14FAQ,
  HR15Contacts
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/presentation_template/slides.jsx", error: String((e && e.message) || e) }); }

// ui_kits/presentation_template/slides_extra.jsx
try { (() => {
// Presentation Template — 6 extra slides inserted after the cover section:
//  PT05 Image + Text
//  PT06 Report charts (H1, 6 months)
//  PT07 Two charts side-by-side
//  PT08 Text-heavy
//  PT09 Info table
//  PT10 Full-bleed image with grid + title
// Uses HRFrame / HREyebrow / HRTitle / HRBody from frame.jsx and the
// existing HR color/font tokens.

// ─── tiny chart helpers (pure SVG, no libs) ─────────────────────────
const axisColor = "#2a2a2a";
const gridColor = "#1f1f1f";
const labelColor = "#7a7a7a";

// Build an area+line chart spanning `w × h` with a data array.
function buildLineChart({
  w,
  h,
  data,
  pad = {
    l: 56,
    r: 16,
    t: 16,
    b: 32
  },
  stroke,
  fill
}) {
  const ix = i => pad.l + i / (data.length - 1) * (w - pad.l - pad.r);
  const maxV = Math.max(...data) * 1.15;
  const iy = v => pad.t + (1 - v / maxV) * (h - pad.t - pad.b);
  const pts = data.map((v, i) => [ix(i), iy(v)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${h - pad.b}` + ` L ${pts[0][0].toFixed(1)} ${h - pad.b} Z`;
  return {
    line,
    area,
    pts,
    ix,
    iy,
    maxV,
    pad
  };
}

// ─── 05. IMAGE + TEXT ────────────────────────────────────────────────
const PT05ImageText = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 5,
    top: {
      left: "Section · Studio",
      right: "Case · 01"
    },
    footerLeft: "Presentation template \xB7 Image + Text"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.05fr 0.95fr",
      gap: 80,
      height: "100%",
      alignItems: "stretch"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      overflow: "hidden",
      minHeight: 640,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: `
              linear-gradient(to right, rgba(244,245,240,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(244,245,240,0.05) 1px, transparent 1px)`,
      backgroundSize: "60px 60px"
    }
  }), /*#__PURE__*/React.createElement("img", {
    src: "./assets/logo-horizontal-reverse.svg",
    alt: "ChillBase",
    style: {
      position: "relative",
      width: "78%",
      height: "auto",
      maxHeight: "70%",
      objectFit: "contain",
      display: "block"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 24,
      bottom: 24,
      right: 24,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: HR_FONT_META,
      fontSize: 13,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "ChillBase \xB7 Brand mark"), /*#__PURE__*/React.createElement("span", null, "2025"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(HREyebrow, null, "Case study \xB7 01"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement(HRTitle, {
    size: 76
  }, "\u0411\u0440\u0435\u043D\u0434 \u2014 \u044D\u0442\u043E \u043D\u0435\xA0\u043B\u043E\u0433\u043E\u0442\u0438\u043F. \u042D\u0442\u043E\xA0\u0440\u0438\u0442\u043C.")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: HR_COLORS.rule,
      margin: "36px 0"
    }
  }), /*#__PURE__*/React.createElement(HRBody, {
    maxWidth: 720
  }, "\u0417\u0430 \u043F\u043E\u043B\u0433\u043E\u0434\u0430 \u043C\u044B \u043E\u0431\u043D\u043E\u0432\u0438\u043B\u0438 \u0444\u0438\u0440\u043C\u0435\u043D\u043D\u044B\u0439 \u0441\u0442\u0438\u043B\u044C: \u043E\u0442\xA0\u0442\u0438\u043F\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u0438\xA0\u0441\u0435\u0442\u043A\u0438 \u0434\u043E\xA0\u043C\u043E\u0443\u0448\u0435\u043D-\u043F\u0440\u0430\u0432\u0438\u043B. \u041A\u0430\u0436\u0434\u044B\u0439 \u0444\u0440\u0435\u0439\u043C \u0441\u043E\u0431\u0440\u0430\u043D \u043D\u0430\xA0\u043E\u0434\u043D\u043E\u0439 \u0438\xA0\u0442\u043E\u0439 \u0436\u0435 \u043C\u0430\u0442\u0440\u0438\u0446\u0435 200\xD7200, \u043A\u0430\u0436\u0434\u043E\u0435 \u0446\u0432\u0435\u0442\u043E\u0432\u043E\u0435 \u0440\u0435\u0448\u0435\u043D\u0438\u0435\xA0\u2014 \u0438\u0437\xA0\u0442\u0440\u0451\u0445 \u0433\u0435\u0440\u043E\u0435\u0432."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(HRBody, {
    maxWidth: 720
  }, "\u0422\u0430\u043A \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u044F\u0437\u044B\u043A \u0441\u0442\u0430\u043B \u0443\u0437\u043D\u0430\u0432\u0430\u0435\u043C\u044B\u043C \u043D\u0435\xA0\u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\xA0\u043E\u0431\u043B\u043E\u0436\u043A\u0430\u0445, \u043D\u043E\xA0\u0438\xA0\u0432\u043D\u0443\u0442\u0440\u0438 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0430: \u0432\xA0\u043B\u043E\u0430\u0434\u0435\u0440\u0430\u0445, \u043F\u0443\u0441\u0442\u044B\u0445 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F\u0445, \u043F\u0443\u0448-\u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F\u0445."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 16,
      marginTop: 32
    }
  }, [["+42%", "узнаваемость"], ["3", "героя в палитре"], ["200", "базовая сетка"]].map(([k, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      border: `1px solid ${HR_COLORS.cardBorder}`,
      background: HR_COLORS.card,
      padding: "20px 22px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 48,
      letterSpacing: "-0.02em",
      color: i === 0 ? accent : HR_COLORS.ink,
      lineHeight: 1
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, v)))))));
};

// ─── 06. REPORT CHARTS (H1 · 6 months) ──────────────────────────────
const PT06ReportCharts = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const months = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН"];
  const revenue = [8.2, 9.1, 10.4, 11.0, 12.8, 14.3]; // млн ₽
  const users = [11, 14, 17, 22, 26, 34]; // тыс.
  const retain = [58, 61, 63, 68, 72, 75]; // %

  const W = 1680,
    H = 360;
  const rev = buildLineChart({
    w: W,
    h: H,
    data: revenue
  });
  const usr = buildLineChart({
    w: W,
    h: H,
    data: users
  });
  const ret = buildLineChart({
    w: W,
    h: H,
    data: retain
  });
  const MiniChart = ({
    title,
    unit,
    data,
    chart,
    color,
    tint
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      padding: "20px 28px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 13,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 56,
      lineHeight: 1,
      letterSpacing: "-0.02em",
      color: HR_COLORS.ink,
      marginTop: 8
    }
  }, data[data.length - 1], /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 24,
      color: HR_COLORS.muted,
      marginLeft: 8,
      letterSpacing: 0
    }
  }, unit))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: color,
      fontWeight: 600
    }
  }, (() => {
    const d = data[data.length - 1] - data[0];
    const pct = Math.round(d / data[0] * 100);
    return (d >= 0 ? "+" : "−") + Math.abs(pct) + "% / 6 мес";
  })())), /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    width: "100%",
    height: H / 2,
    style: {
      display: "block",
      marginTop: 12
    }
  }, [0, 0.25, 0.5, 0.75, 1].map((t, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: chart.pad.l,
    x2: W - chart.pad.r,
    y1: chart.pad.t + t * (H - chart.pad.t - chart.pad.b),
    y2: chart.pad.t + t * (H - chart.pad.t - chart.pad.b),
    stroke: gridColor,
    strokeWidth: "1"
  })), /*#__PURE__*/React.createElement("path", {
    d: chart.area,
    fill: tint
  }), /*#__PURE__*/React.createElement("path", {
    d: chart.line,
    fill: "none",
    stroke: color,
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }), (() => {
    const p = chart.pts[chart.pts.length - 1];
    return /*#__PURE__*/React.createElement("circle", {
      cx: p[0],
      cy: p[1],
      r: "7",
      fill: color
    });
  })(), months.map((m, i) => /*#__PURE__*/React.createElement("text", {
    key: m,
    x: chart.ix(i),
    y: H - 8,
    fontFamily: "Onest",
    fontSize: "14",
    fill: labelColor,
    textAnchor: "middle",
    letterSpacing: "2"
  }, m))));
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 6,
    top: {
      left: "Report · H1 2025",
      right: "6 months"
    },
    footerLeft: "Presentation template \xB7 Report charts"
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "\u041E\u0442\u0447\u0451\u0442 \xB7 \u041F\u0435\u0440\u0432\u043E\u0435 \u043F\u043E\u043B\u0443\u0433\u043E\u0434\u0438\u0435"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 72
  }, "\u041F\u043E\u043B\u0443\u0433\u043E\u0434\u0438\u0435 \u0432\xA0\u0442\u0440\u0451\u0445 \u0433\u0440\u0430\u0444\u0438\u043A\u0430\u0445."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 44,
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(MiniChart, {
    title: "\u0412\u044B\u0440\u0443\u0447\u043A\u0430 \xB7 \u043C\u043B\u043D \u20BD",
    unit: "",
    data: revenue,
    chart: rev,
    color: accent,
    tint: "rgba(255,0,0,0.10)"
  }), /*#__PURE__*/React.createElement(MiniChart, {
    title: "\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 \u0438\u0433\u0440\u043E\u043A\u0438 \xB7 \u0442\u044B\u0441.",
    unit: "",
    data: users,
    chart: usr,
    color: "#ff7e00",
    tint: "rgba(255,126,0,0.10)"
  }), /*#__PURE__*/React.createElement(MiniChart, {
    title: "\u0420\u0435\u0442\u0435\u043D\u0448\u0435\u043D D30 \xB7 %",
    unit: "%",
    data: retain,
    chart: ret,
    color: "#f4f5f0",
    tint: "rgba(244,245,240,0.07)"
  })));
};

// ─── 07. TWO CHARTS SIDE-BY-SIDE ────────────────────────────────────
const PT07TwoCharts = () => {
  const {
    accent
  } = React.useContext(HRTheme);

  // Left: bar chart, team growth per quarter
  const quarters = ["Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25"];
  const headcount = [82, 96, 108, 124, 147];
  const BW = 820,
    BH = 420;
  const bPad = {
    l: 44,
    r: 16,
    t: 16,
    b: 40
  };
  const bMax = Math.max(...headcount) * 1.15;
  const bBarW = (BW - bPad.l - bPad.r) / quarters.length * 0.58;
  const bStep = (BW - bPad.l - bPad.r) / quarters.length;

  // Right: stacked donut — channel mix
  const donut = [{
    k: "Organic",
    v: 48,
    c: accent
  }, {
    k: "Referral",
    v: 22,
    c: "#ff7e00"
  }, {
    k: "Paid",
    v: 18,
    c: "#f4f5f0"
  }, {
    k: "Direct",
    v: 12,
    c: "#535252"
  }];
  const dTotal = donut.reduce((a, b) => a + b.v, 0);
  const dR = 150,
    dC = 2 * Math.PI * dR;
  let dOff = 0;
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 7,
    top: {
      left: "Growth · Breakdown",
      right: "Q1 2025"
    },
    footerLeft: "Presentation template \xB7 Two charts"
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "\u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \xB7 \u0414\u0432\u0430 \u0433\u0440\u0430\u0444\u0438\u043A\u0430"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 72
  }, "\u0420\u043E\u0441\u0442 \u043A\u043E\u043C\u0430\u043D\u0434\u044B \u0438\xA0\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u043F\u0440\u0438\u0442\u043E\u043A\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 48,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      padding: 28,
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 13,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, "Headcount \xB7 \u043F\u043E \u043A\u0432\u0430\u0440\u0442\u0430\u043B\u0430\u043C"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 64,
      letterSpacing: "-0.02em",
      color: HR_COLORS.ink,
      marginTop: 6,
      lineHeight: 1
    }
  }, "147")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 600
    }
  }, "+79% / \u0433\u043E\u0434")), /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${BW} ${BH}`,
    width: "100%",
    style: {
      display: "block"
    }
  }, [0, 0.25, 0.5, 0.75, 1].map((t, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: bPad.l,
    x2: BW - bPad.r,
    y1: bPad.t + t * (BH - bPad.t - bPad.b),
    y2: bPad.t + t * (BH - bPad.t - bPad.b),
    stroke: gridColor,
    strokeWidth: "1"
  })), headcount.map((v, i) => {
    const bh = v / bMax * (BH - bPad.t - bPad.b);
    const bx = bPad.l + i * bStep + (bStep - bBarW) / 2;
    const by = BH - bPad.b - bh;
    const last = i === headcount.length - 1;
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("rect", {
      x: bx,
      y: by,
      width: bBarW,
      height: bh,
      fill: last ? accent : "#353436"
    }), /*#__PURE__*/React.createElement("text", {
      x: bx + bBarW / 2,
      y: by - 10,
      fontFamily: "Archivo",
      fontWeight: "700",
      fontSize: "22",
      fill: HR_COLORS.ink,
      textAnchor: "middle"
    }, v), /*#__PURE__*/React.createElement("text", {
      x: bx + bBarW / 2,
      y: BH - 14,
      fontFamily: "Onest",
      fontSize: "14",
      fill: labelColor,
      textAnchor: "middle",
      letterSpacing: "2"
    }, quarters[i]));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: HR_COLORS.card,
      border: `1px solid ${HR_COLORS.cardBorder}`,
      padding: 28,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 24,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 13,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u043A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u043E\u0432"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 52,
      letterSpacing: "-0.02em",
      color: HR_COLORS.ink,
      marginTop: 4,
      lineHeight: 1
    }
  }, "312"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4,
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, "applications / Q1"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24,
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, donut.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 14,
      height: 14,
      background: d.c
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: HR_FONT_META,
      fontSize: 18,
      color: HR_COLORS.ink
    }
  }, d.k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 22,
      color: HR_COLORS.ink,
      letterSpacing: "-0.01em"
    }
  }, d.v, "%"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 420 420",
    width: "100%",
    style: {
      maxWidth: 360
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "210",
    cy: "210",
    r: dR,
    fill: "none",
    stroke: HR_COLORS.cardBorder,
    strokeWidth: "48"
  }), donut.map((d, i) => {
    const len = d.v / dTotal * dC;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: i,
      cx: "210",
      cy: "210",
      r: dR,
      fill: "none",
      stroke: d.c,
      strokeWidth: "48",
      strokeDasharray: `${len} ${dC - len}`,
      strokeDashoffset: -dOff,
      transform: "rotate(-90 210 210)"
    });
    dOff += len;
    return el;
  }), /*#__PURE__*/React.createElement("text", {
    x: "210",
    y: "204",
    textAnchor: "middle",
    fontFamily: "Archivo",
    fontWeight: "700",
    fontSize: "72",
    fill: HR_COLORS.ink,
    letterSpacing: "-1.5"
  }, "48%"), /*#__PURE__*/React.createElement("text", {
    x: "210",
    y: "240",
    textAnchor: "middle",
    fontFamily: "Onest",
    fontSize: "14",
    fill: HR_COLORS.muted,
    letterSpacing: "2"
  }, "ORGANIC"))))));
};

// ─── 08. TEXT-HEAVY ──────────────────────────────────────────────────
const PT08TextHeavy = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 8,
    top: {
      left: "Manifesto · Studio",
      right: "Essay"
    },
    footerLeft: "Presentation template \xB7 Text-heavy layout"
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "\u041C\u0430\u043D\u0438\u0444\u0435\u0441\u0442 \xB7 \u041F\u043E\u0437\u0438\u0446\u0438\u044F \u0441\u0442\u0443\u0434\u0438\u0438"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 64
  }, "\u041F\u043E\u0447\u0435\u043C\u0443 \u043C\u044B\xA0\u0434\u0435\u043B\u0430\u0435\u043C \u0438\u0433\u0440\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0441\u043F\u043E\u0440\u044F\u0442 \u0441\xA0\u043F\u0440\u0430\u0432\u0438\u043B\u0430\u043C\u0438."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 48,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      columnGap: 64,
      rowGap: 28
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 28,
      lineHeight: 1.25,
      letterSpacing: "-0.005em",
      color: HR_COLORS.ink
    }
  }, "\u041D\u0430\u0448\u0430 \u0441\u0442\u0443\u0434\u0438\u044F \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0430 \u043D\u0430 \u0441\u043C\u0435\u043B\u044B\u0445 \u0438\u043D\u043D\u043E\u0432\u0430\u0446\u0438\u044F\u0445 \u0438 \u0434\u0435\u0440\u0437\u043A\u043E\u043C \u0432\u044B\u0437\u043E\u0432\u0435. \u041C\u044B \u043D\u0435\xA0\u043F\u0440\u043E\u0441\u0442\u043E \u0441\u043B\u0435\u0434\u0443\u0435\u043C \u0437\u0430 \u0442\u0435\u043D\u0434\u0435\u043D\u0446\u0438\u044F\u043C\u0438 \u2014 \u043C\u044B\xA0\u0431\u0440\u043E\u0441\u0430\u0435\u043C \u0438\u043C \u0432\u044B\u0437\u043E\u0432, \u043F\u0435\u0440\u0435\u0448\u0430\u0433\u0438\u0432\u0430\u044F \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u0438 \u0437\u0430\u043D\u043E\u0432\u043E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u044F\u044F, \u0447\u0442\u043E \u0442\u0430\u043A\u043E\u0435 \u0438\u0433\u0440\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: HR_COLORS.rule,
      margin: "28px 0"
    }
  }), /*#__PURE__*/React.createElement(HRBody, {
    maxWidth: 820
  }, "\u041C\u044B \u0441\u043E\u0437\u0434\u0430\u0451\u043C \u0434\u043B\u044F \u0438\u0433\u0440\u043E\u043A\u043E\u0432, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u0431\u043E\u043B\u044C\u0448\u0435\u0433\u043E, \u0447\u0435\u043C \u043E\u0431\u044B\u0447\u043D\u044B\u0435 \u0438\u0433\u0440\u044B. \u041C\u044B \u0437\u0434\u0435\u0441\u044C \u043D\u0435 \u0434\u043B\u044F \u0442\u043E\u0433\u043E, \u0447\u0442\u043E\u0431\u044B \u0432\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C\u0441\u044F \u0432 \u0444\u043E\u0440\u043C\u044B \u2014 \u043C\u044B \u0437\u0434\u0435\u0441\u044C, \u0447\u0442\u043E\u0431\u044B \u0438\u0445 \u0440\u0430\u0437\u0431\u0438\u0442\u044C. \u042D\u0442\u043E \u0437\u043D\u0430\u0447\u0438\u0442 \u0441\u043E\u043C\u043D\u0435\u0432\u0430\u0442\u044C\u0441\u044F \u0432 \u0440\u0435\u0444\u0435\u0440\u0435\u043D\u0441\u0430\u0445, \u0432\xA0\u0441\u043E\u0431\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0445 \u0440\u0435\u0448\u0435\u043D\u0438\u044F\u0445 \u0438 \u0432\xA0\u043F\u0440\u0438\u0432\u044B\u0447\u043D\u044B\u0445 \u043C\u0435\u0442\u0440\u0438\u043A\u0430\u0445 \u0443\u0441\u043F\u0435\u0445\u0430."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(HRBody, {
    maxWidth: 820
  }, "\u0421\u0432\u043E\u0431\u043E\u0434\u0430 \u0432\u043D\u0443\u0442\u0440\u0438 \u0441\u0442\u0443\u0434\u0438\u0438 \u2014 \u044D\u0442\u043E\xA0\u043D\u0435\xA0\u0441\u043B\u043E\u0433\u0430\u043D, \u0430\xA0\u0440\u0435\u0436\u0438\u043C \u0440\u0430\u0431\u043E\u0442\u044B. \u041C\u044B\xA0\u0434\u0430\u0451\u043C \u043A\u043E\u043C\u0430\u043D\u0434\u0430\u043C \u0431\u0440\u0430\u0442\u044C \u043D\u0430\xA0\u0441\u0435\u0431\u044F \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C \u0437\u0430\xA0\u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u0438: \u043E\u0442\xA0\u043F\u0435\u0440\u0432\u044B\u0445 \u043D\u0430\u0431\u0440\u043E\u0441\u043A\u043E\u0432 \u0434\u043E\xA0\u0440\u0435\u043B\u0438\u0437\u043D\u043E\u0433\u043E \u043F\u0430\u0442\u0447\u0430.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(HRBody, {
    maxWidth: 820
  }, "\u041A\u0430\u0436\u0434\u043E\u0435 \u043F\u043E\u043A\u043E\u043B\u0435\u043D\u0438\u0435 \u0438\u0433\u0440\u043E\u043A\u043E\u0432 \u0436\u0434\u0451\u0442 \u043E\u0442\xA0\u0438\u043D\u0434\u0443\u0441\u0442\u0440\u0438\u0438 \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0442\u043E\u043D\u0430. \u041D\u0430\u0448\xA0\u2014 \u043F\u0440\u044F\u043C\u043E\u0439, \u0433\u0440\u043E\u043C\u043A\u0438\u0439, \u0447\u0443\u0442\u044C\xA0\u043D\u0430\u0445\u0430\u043B\u044C\u043D\u044B\u0439. \u0418\xA0\u044D\u0442\u043E \u0432\u044B\u0431\u043E\u0440, \u0430\xA0\u043D\u0435\xA0\u0441\u043B\u0443\u0447\u0430\u0439\u043D\u043E\u0441\u0442\u044C."))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(HRBody, {
    maxWidth: 820
  }, "\u041C\u044B \u043D\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u043C \u0432\xA0\u0440\u0435\u0436\u0438\u043C\u0435 \xAB\u0431\u044B\u0441\u0442\u0440\u043E-\u0431\u044B\u0441\u0442\u0440\u043E\xBB. \u0412\xA0\u0438\u0433\u0440\u0430\u0445, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0436\u0438\u0432\u0443\u0442 \u0433\u043E\u0434\u0430\u043C\u0438, \u0441\u0440\u0435\u0437\u0430\u0442\u044C \u0443\u0433\u043B\u044B \u043D\u0435\u043B\u044C\u0437\u044F: \u044D\u0442\u043E\xA0\u0441\u043B\u044B\u0448\u043D\u043E \u0432\xA0\u0437\u0432\u0443\u043A\u0435, \u044D\u0442\u043E \u0432\u0438\u0434\u043D\u043E \u0432\xA0\u043A\u0430\u0436\u0434\u043E\u043C \u043A\u0430\u0434\u0440\u0435 \u0438\xA0\u044D\u0442\u043E \u0447\u0443\u0432\u0441\u0442\u0432\u0443\u0435\u0442\u0441\u044F \u0432\xA0\u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0438. \u041F\u043E\u044D\u0442\u043E\u043C\u0443 \u043C\u044B\xA0\u0442\u0440\u0430\u0442\u0438\u043C \u0432\u0440\u0435\u043C\u044F \u043D\u0430\xA0\u043F\u0440\u043E\u0442\u043E\u0442\u0438\u043F\u044B \u0438\xA0\u0443\u0431\u0438\u0432\u0430\u0435\u043C \u0438\u0434\u0435\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0435\xA0\u043F\u0440\u043E\u0448\u043B\u0438 playtest."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(HRBody, {
    maxWidth: 820
  }, "\u041F\u0440\u0438 \u044D\u0442\u043E\u043C \u043C\u044B\xA0\u043E\u0441\u0442\u0430\u0451\u043C\u0441\u044F \u0441\u0442\u0443\u0434\u0438\u0435\u0439, \u0430\xA0\u043D\u0435\xA0\u043A\u043E\u043D\u0432\u0435\u0439\u0435\u0440\u043E\u043C. \u041B\u044E\u0434\u0438 \u0443\xA0\u043D\u0430\u0441 \u0437\u043D\u0430\u044E\u0442, \u043A\u0430\u043A\u0430\u044F \u0438\u043C\u0435\u043D\u043D\u043E \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0430 \u0432\xA0\u0438\u0445 \u0440\u0435\u043B\u0438\u0437\u0435 \u0434\u0435\u0440\u0436\u0438\u0442 \u043F\u0435\u0440\u0432\u0443\u044E \u0441\u0435\u0441\u0441\u0438\u044E, \u0438\xA0\u043F\u043E\u0447\u0435\u043C\u0443 \u043A\u043E\u043C\u044C\u044E\u043D\u0438\u0442\u0438 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 \u043F\u043E\u043B\u0433\u043E\u0434\u0430.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      display: "flex",
      flexDirection: "column",
      gap: 14
    }
  }, [["Бесстрашие", "не стесняемся спорить внутри и снаружи."], ["Дерзость", "берёмся за то, о&nbsp;чём другие спорят."], ["Подлинность", "каждый проект — со&nbsp;своим голосом."]].map(([k, v], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "grid",
      gridTemplateColumns: "180px 1fr",
      columnGap: 24,
      padding: "14px 0",
      borderTop: `1px solid ${HR_COLORS.rule}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: "0.02em",
      textTransform: "uppercase",
      color: accent
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: HR_FONT_META,
      fontSize: 18,
      color: HR_COLORS.ink,
      lineHeight: 1.45
    },
    dangerouslySetInnerHTML: {
      __html: v
    }
  })))))));
};

// ─── 09. INFO TABLE ──────────────────────────────────────────────────
const PT09InfoTable = () => {
  const {
    accent
  } = React.useContext(HRTheme);
  const columns = [{
    k: "project",
    label: "Проект",
    align: "left",
    width: "1.2fr"
  }, {
    k: "stage",
    label: "Стадия",
    align: "left",
    width: "1fr"
  }, {
    k: "team",
    label: "Команда",
    align: "left",
    width: "0.7fr"
  }, {
    k: "platform",
    label: "Платформа",
    align: "left",
    width: "1.1fr"
  }, {
    k: "release",
    label: "Релиз",
    align: "left",
    width: "0.8fr"
  }, {
    k: "revenue",
    label: "Выручка / мес",
    align: "right",
    width: "1fr"
  }, {
    k: "status",
    label: "Статус",
    align: "right",
    width: "0.8fr"
  }];
  const rows = [{
    project: "OneState",
    stage: "Live Ops",
    team: "38 чел.",
    platform: "Mobile · PC",
    release: "Live",
    revenue: "12.4 млн ₽",
    status: {
      t: "Active",
      c: accent
    }
  }, {
    project: "Imba",
    stage: "Soft-launch",
    team: "22 чел.",
    platform: "Mobile",
    release: "Q2 2025",
    revenue: "1.8 млн ₽",
    status: {
      t: "Ramp-up",
      c: "#ff7e00"
    }
  }, {
    project: "Холод",
    stage: "Production",
    team: "17 чел.",
    platform: "PC · Console",
    release: "Q4 2025",
    revenue: "—",
    status: {
      t: "Build",
      c: "#f4f5f0"
    }
  }, {
    project: "FF",
    stage: "Vertical slice",
    team: "9 чел.",
    platform: "PC",
    release: "2026",
    revenue: "—",
    status: {
      t: "Pitch",
      c: "#737373"
    }
  }, {
    project: "B · prototype",
    stage: "Prototype",
    team: "5 чел.",
    platform: "TBD",
    release: "TBD",
    revenue: "—",
    status: {
      t: "R&D",
      c: "#737373"
    }
  }, {
    project: "Внутр. tools",
    stage: "Support",
    team: "6 чел.",
    platform: "Web",
    release: "Ongoing",
    revenue: "—",
    status: {
      t: "Ops",
      c: "#737373"
    }
  }];
  const gridTemplate = columns.map(c => c.width).join(" ");
  const cellPad = "22px 24px";
  return /*#__PURE__*/React.createElement(HRFrame, {
    page: 9,
    top: {
      left: "Studio · Portfolio",
      right: "Snapshot"
    },
    footerLeft: "Presentation template \xB7 Info table"
  }, /*#__PURE__*/React.createElement(HREyebrow, null, "\u041F\u043E\u0440\u0442\u0444\u043E\u043B\u0438\u043E \u0441\u0442\u0443\u0434\u0438\u0438"), /*#__PURE__*/React.createElement(HRTitle, {
    size: 72
  }, "\u041F\u0440\u043E\u0435\u043A\u0442\u044B \u0432\xA0\u0440\u0430\u0431\u043E\u0442\u0435."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 48,
      border: `1px solid ${HR_COLORS.cardBorder}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: gridTemplate,
      background: HR_COLORS.card,
      borderBottom: `1px solid ${HR_COLORS.cardBorder}`
    }
  }, columns.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c.k,
    style: {
      padding: cellPad,
      fontFamily: HR_FONT_META,
      fontSize: 13,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: HR_COLORS.muted,
      fontWeight: 600,
      textAlign: c.align,
      borderLeft: i === 0 ? "none" : `1px solid ${HR_COLORS.cardBorder}`
    }
  }, c.label))), rows.map((r, ri) => /*#__PURE__*/React.createElement("div", {
    key: ri,
    style: {
      display: "grid",
      gridTemplateColumns: gridTemplate,
      borderBottom: ri === rows.length - 1 ? "none" : `1px solid ${HR_COLORS.cardBorder}`,
      background: ri % 2 ? "rgba(255,255,255,0.015)" : "transparent"
    }
  }, columns.map((c, ci) => {
    const isFirst = ci === 0;
    const val = r[c.k];
    const content = c.k === "status" ? /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        border: `1px solid ${val.c}`,
        color: val.c,
        fontFamily: HR_FONT_META,
        fontSize: 12,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        fontWeight: 600
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: 999,
        background: val.c
      }
    }), val.t) : val;
    return /*#__PURE__*/React.createElement("div", {
      key: c.k,
      style: {
        padding: cellPad,
        fontFamily: isFirst ? HR_FONT_DISPLAY : HR_FONT_META,
        fontWeight: isFirst ? 700 : 400,
        fontSize: isFirst ? 22 : 18,
        letterSpacing: isFirst ? "-0.005em" : 0,
        color: isFirst ? HR_COLORS.ink : c.align === "right" ? HR_COLORS.ink : "#bfbfbf",
        textAlign: c.align,
        borderLeft: ci === 0 ? "none" : `1px solid ${HR_COLORS.cardBorder}`,
        display: "flex",
        alignItems: "center",
        justifyContent: c.align === "right" ? "flex-end" : "flex-start"
      }
    }, content);
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: "flex",
      justifyContent: "space-between",
      fontFamily: HR_FONT_META,
      fontSize: 13,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: HR_COLORS.muted
    }
  }, /*#__PURE__*/React.createElement("span", null, "Source \xB7 Studio ops, Q1 2025"), /*#__PURE__*/React.createElement("span", null, "6 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \xB7 97 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432")));
};

// ─── 10. FULL-BLEED IMAGE + GRID + TITLE ────────────────────────────
const PT10FullBleed = () => {
  const {
    accent,
    showPages
  } = React.useContext(HRTheme);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      width: 1920,
      height: 1080,
      background: HR_COLORS.bg,
      overflow: "hidden",
      color: HR_COLORS.ink,
      fontFamily: HR_FONT_DISPLAY
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "./assets/hero-cgi.png",
    alt: "",
    style: {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: `
          linear-gradient(to right, rgba(244,245,240,0.12) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(244,245,240,0.12) 1px, transparent 1px)`,
      backgroundSize: "80px 80px",
      mixBlendMode: "screen"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      backgroundImage: `
          linear-gradient(to right, rgba(244,245,240,0.22) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(244,245,240,0.22) 1px, transparent 1px)`,
      backgroundSize: "400px 400px",
      mixBlendMode: "screen"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.80) 100%)"
    }
  }), [{
    top: 80,
    left: 80
  }, {
    top: 80,
    right: 80
  }, {
    bottom: 80,
    left: 80
  }, {
    bottom: 80,
    right: 80
  }].map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: "absolute",
      ...p,
      width: 40,
      height: 40,
      borderTop: p.top != null ? `2px solid ${HR_COLORS.ink}` : "none",
      borderBottom: p.bottom != null ? `2px solid ${HR_COLORS.ink}` : "none",
      borderLeft: p.left != null ? `2px solid ${HR_COLORS.ink}` : "none",
      borderRight: p.right != null ? `2px solid ${HR_COLORS.ink}` : "none",
      opacity: 0.9
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 160,
      top: 96,
      display: "flex",
      justifyContent: "space-between",
      width: "calc(100% - 320px)",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: "#d9d9d9"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Chapter \xB7 02"), /*#__PURE__*/React.createElement("span", null, "Visual")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 160,
      top: 180,
      fontFamily: HR_FONT_META,
      fontSize: 16,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: accent,
      fontWeight: 700
    }
  }, "Chapter \xB7 02 \xB7 Visual system"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 160,
      right: 160,
      bottom: 220
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: HR_FONT_DISPLAY,
      fontWeight: 700,
      fontSize: 220,
      lineHeight: 0.88,
      letterSpacing: "-0.025em",
      color: HR_COLORS.ink,
      textTransform: "uppercase",
      textShadow: "0 6px 40px rgba(0,0,0,0.45)"
    }
  }, "\u0421\u0435\u0442\u043A\u0430", /*#__PURE__*/React.createElement("br", null), "\u0434\u0435\u0440\u0436\u0438\u0442", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent
    }
  }, "\u0432\u0441\u0451."))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 160,
      right: 160,
      bottom: 140,
      height: 1,
      background: "rgba(244,245,240,0.35)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 160,
      right: 160,
      bottom: 96,
      display: "flex",
      justifyContent: "space-between",
      fontFamily: HR_FONT_META,
      fontSize: 14,
      letterSpacing: "0.22em",
      textTransform: "uppercase",
      color: "#d9d9d9"
    }
  }, /*#__PURE__*/React.createElement("span", null, "ChillBase \xB7 2025 \xB7 Presentation template"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 32,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null, "200 \xD7 200 base grid"), showPages && /*#__PURE__*/React.createElement("span", {
    style: {
      color: accent,
      fontWeight: 700
    }
  }, "10 / 15"))));
};
Object.assign(window, {
  PT05ImageText,
  PT06ReportCharts,
  PT07TwoCharts,
  PT08TextHeavy,
  PT09InfoTable,
  PT10FullBleed
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/presentation_template/slides_extra.jsx", error: String((e && e.message) || e) }); }

})();
