// Nightvale — the world map: the valley drawn as a rustic, hand-inked treasure map on violet-tinted
// vellum. The art is painted at 400x260 "map pixels" into a plain RGB buffer (pure JS, no canvas, so
// it also runs in node), upscaled with nearest-neighbour, then lettered at full resolution on top.
// Defines G.WorldMap = { draw(canvas, info), hit(canvas, x, y) }.
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const W = 400, H = 260;

  // ================================================================== noise, rng, colour
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, o) {
    let t = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < (o || 3); i++) { t += noise(x * f, y * f, s + i * 31) * amp; n += amp; amp *= 0.5; f *= 2; }
    return t / n;
  }
  function rng(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hex = (s) => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  const C = {
    // vellum
    pHi: hex('#f3e6cf'), p: hex('#e8d5bb'), pMid: hex('#d9c3ab'), pLilac: hex('#cfb8c4'), pDark: hex('#b79ea3'),
    stain: hex('#d8bea6'), coffee: hex('#b88c6c'), burn: hex('#7a5058'), char: hex('#24151e'), desk: hex('#161021'),
    // inks
    ink: hex('#3a2436'), red: hex('#9c2c34'),
    // watercolour pigments (multiplied over the paper)
    forest: hex('#8db08a'), deep: hex('#7c948f'), deepV: hex('#8e82a8'), meadow: hex('#cad49e'), glade: hex('#a6d08e'),
    mtn: hex('#b1a1cc'), water: hex('#8cbfcc'), waterD: hex('#6c9cc0'), bog: hex('#b0ac84'), warm: hex('#e8c89e'),
    stone: hex('#bab5cc'), moonst: hex('#cfd8f2'), wood: hex('#c29b7c'), plaster: hex('#f0e0c6'),
    roofI: hex('#7e86c2'), roofP: hex('#b07ca6'), roofT: hex('#7cb0ac'), roofS: hex('#9694b6'), roofM: hex('#a2ba80'), verd: hex('#79bcae'),
    // body colours and lights
    amber: hex('#ffbc62'), candle: hex('#fff1c8'), emerald: hex('#5dffb0'), rose: hex('#e0508e'), gold: hex('#f2c45a'),
    blue: hex('#5aa8f0'), purple: hex('#9a72e0'), violet: hex('#b99aee'), moon: hex('#eef2ff'), sky: hex('#9fd4ff'),
    fox: hex('#d97a42'), foxD: hex('#a24f30'), cream: hex('#f7eddc'), cave: hex('#24162e'), caveV: hex('#4a2f7a'),
  };

  // ================================================================== the painter
  let buf = null, bg = null, GLOWS = [];
  const ST = { ink: 1, sketch: 0, tint: 1 };
  let CLIP = [0, 0, W - 1, H - 1];
  const inClip = (x, y) => x >= CLIP[0] && y >= CLIP[1] && x <= CLIP[2] && y <= CLIP[3];

  function put(x, y, c, a) {
    x = Math.round(x); y = Math.round(y);
    if (!(a > 0) || !inClip(x, y)) return;
    const i = (y * W + x) * 3;
    if (a >= 1) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; return; }
    buf[i] += (c[0] - buf[i]) * a; buf[i + 1] += (c[1] - buf[i + 1]) * a; buf[i + 2] += (c[2] - buf[i + 2]) * a;
  }
  function mulInto(arr, x, y, c, a) {
    const i = (y * W + x) * 3;
    arr[i] *= 1 - a + (a * c[0]) / 255; arr[i + 1] *= 1 - a + (a * c[1]) / 255; arr[i + 2] *= 1 - a + (a * c[2]) / 255;
  }
  // ink line work; unexplored places are drawn faint and broken, like a sketch from hearsay
  function ink(x, y, a, col) {
    x = Math.round(x); y = Math.round(y);
    if (ST.sketch > 0 && hash(x, y, 77) < ST.sketch) return;
    put(x, y, col || C.ink, (a == null ? 1 : a) * ST.ink);
  }
  function red(x, y, a) { put(x, y, C.red, a == null ? 1 : a); }
  // restore the bare (washed) paper: lets drawings occlude whatever is behind them
  function paper(x, y) {
    x = Math.round(x); y = Math.round(y);
    if (!inClip(x, y)) return;
    const i = (y * W + x) * 3; buf[i] = bg[i]; buf[i + 1] = bg[i + 1]; buf[i + 2] = bg[i + 2];
  }
  function lighten(x, y, a) { put(x, y, C.pHi, a); }
  function tint(x, y, c, a) { x = Math.round(x); y = Math.round(y); if (inClip(x, y)) mulInto(buf, x, y, c, clamp(a * ST.tint, 0, 1)); }
  function body(x, y, c, a) { put(x, y, c, (a == null ? 1 : a) * (ST.tint < 1 ? 0.22 : 1)); }
  function glow(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (ST.tint < 1) { ink(x, y, 0.35); return; }
    if (!inClip(x, y)) return;
    put(x, y, c, 1); GLOWS.push([x, y, c]);
  }

  // ---------------------------------------------------------------- shapes (pixel masks)
  function Shape(x0, y0, x1, y1, inside) {
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
    const w = Math.max(1, x1 - x0 + 1), h = Math.max(1, y1 - y0 + 1), m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x0 + x, y0 + y)) m[y * w + x] = 1;
    this.x0 = x0; this.y0 = y0; this.w = w; this.h = h; this.m = m;
  }
  Shape.prototype.at = function (x, y) { x -= this.x0; y -= this.y0; return x >= 0 && y >= 0 && x < this.w && y < this.h && this.m[y * this.w + x] === 1; };
  Shape.prototype.each = function (fn) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.m[y * this.w + x]) fn(this.x0 + x, this.y0 + y); return this; };
  Shape.prototype.edge = function (x, y, open) {
    return this.at(x, y) && (!this.at(x - 1, y) || !this.at(x + 1, y) || !this.at(x, y - 1) || (open !== 'b' && !this.at(x, y + 1)));
  };
  Shape.prototype.paper = function () { return this.each(paper); };
  Shape.prototype.tint = function (c, a) { return this.each((x, y) => tint(x, y, c, a)); };
    Shape.prototype.hatch = function (test, a) { return this.each((x, y) => { if (!this.edge(x, y) && test(x, y)) ink(x, y, a); }); };
  Shape.prototype.line = function (a, open) { return this.each((x, y) => { if (this.edge(x, y, open)) ink(x, y, a); }); };
  // distance (in px) from each inside pixel to the outside: 1 on the rim
  Shape.prototype.dist = function () {
    const w = this.w, h = this.h, m = this.m, d = new Float32Array(w * h), R2 = Math.SQRT2;
    for (let i = 0; i < w * h; i++) d[i] = m[i] ? 1e6 : 0;
    const g = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (m[i]) d[i] = Math.min(d[i], g(x - 1, y) + 1, g(x, y - 1) + 1, g(x - 1, y - 1) + R2, g(x + 1, y - 1) + R2); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (m[i]) d[i] = Math.min(d[i], g(x + 1, y) + 1, g(x, y + 1) + 1, g(x + 1, y + 1) + R2, g(x - 1, y + 1) + R2); }
    const x0 = this.x0, y0 = this.y0;
    return (x, y) => g(x - x0, y - y0);
  };
  function polyIn(pts) {
    return (x, y) => {
      const px = x + 0.5, py = y + 0.5; let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
  }
  function bbox(pts, pad) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { const r = (p[2] || 0) + (pad || 0); x0 = Math.min(x0, p[0] - r); y0 = Math.min(y0, p[1] - r); x1 = Math.max(x1, p[0] + r); y1 = Math.max(y1, p[1] + r); }
    return [x0, y0, x1, y1];
  }
  function shPoly(pts, also) { const b = bbox(pts, 1), f = polyIn(pts); return new Shape(b[0], b[1], b[2], b[3], also ? (x, y) => f(x, y) && also(x, y) : f); }
  function shEll(cx, cy, rx, ry, jag, seed, also) {
    return new Shape(cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 2, (x, y) => {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      return dx * dx + dy * dy <= 1 + (jag ? (noise(x / 2.5, y / 2.5, seed || 1) - 0.5) * jag : 0) && (!also || also(x, y));
    });
  }
  function shRect(x, y, w, h) { return new Shape(x, y, x + w - 1, y + h - 1, () => true); }
  // a thick stroke: discs [x, y, r] stamped into one mask
  function shStamps(samples, also) {
    const b = bbox(samples, 1), x0 = Math.floor(b[0]), y0 = Math.floor(b[1]), w = Math.ceil(b[2]) - x0 + 1, h = Math.ceil(b[3]) - y0 + 1;
    const m = new Uint8Array(w * h);
    for (const [x, y, r] of samples) {
      for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
        const dx = xx + 0.5 - x, dy = yy + 0.5 - y;
        if (dx * dx + dy * dy <= r * r && xx >= x0 && yy >= y0 && xx < x0 + w && yy < y0 + h) m[(yy - y0) * w + (xx - x0)] = 1;
      }
    }
    return new Shape(x0, y0, x0 + w - 1, y0 + h - 1, (x, y) => m[(y - y0) * w + (x - x0)] === 1 && (!also || also(x, y)));
  }

  // ---------------------------------------------------------------- lines and curves
  function plot(x0, y0, x1, y1, fn) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy, k = 0;
    for (;;) {
      fn(x0, y0, k++);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  const line = (x0, y0, x1, y1, a, col) => plot(x0, y0, x1, y1, (x, y) => ink(x, y, a, col));
  function spline(pts, step) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / (step || 0.3)));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t, q = [];
        for (let c = 0; c < 2; c++) q.push(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3));
        out.push(q);
      }
    }
    out.push(pts[pts.length - 1].slice(0, 2));
    return out;
  }
  // a smooth path as a thin 8-connected run of pixels
  function pixPath(pts) {
    const raw = [];
    for (const [fx, fy] of spline(pts, 0.2)) { const x = Math.round(fx), y = Math.round(fy), L = raw[raw.length - 1]; if (!L || L[0] !== x || L[1] !== y) raw.push([x, y]); }
    const out = [raw[0]];
    for (let i = 1; i < raw.length - 1; i++) { const p = out[out.length - 1], n = raw[i + 1]; if (Math.abs(p[0] - n[0]) <= 1 && Math.abs(p[1] - n[1]) <= 1) continue; out.push(raw[i]); }
    if (raw.length > 1) out.push(raw[raw.length - 1]);
    return out;
  }
  function ellipsePix(cx, cy, rx, ry, fn) {
    const seen = new Set(), n = Math.ceil((rx + ry) * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.round(cx + Math.cos(a) * rx), y = Math.round(cy + Math.sin(a) * ry), k = x * 1000 + y;
      if (!seen.has(k)) { seen.add(k); fn(x, y, a); }
    }
  }

  // ---------------------------------------------------------------- tiny sprites
  // '#' ink, '+' half ink, 'o' paper, 'O' bright paper, '.' clear; other letters come from `map`
  function sprite(rows, x, y, map) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i], px = x + i, py = y + j;
        if (ch === '.' || ch === ' ') continue;
        if (map && map[ch]) { map[ch](px, py); continue; }
        if (ch === '#') ink(px, py, 1); else if (ch === '+') ink(px, py, 0.5); else if (ch === 'o') paper(px, py); else if (ch === 'O') { paper(px, py); lighten(px, py, 0.6); }
      }
    }
  }
  const SPR = {
    skull: ['..#####..', '.#OOOOO#.', '#OOOOOOO#', '#O##O##O#', '#O##O##O#', '.#OO#OO#.', '..#O#O#..', '...###...'],
    fleur: ['.....#.....', '....#r#....', '....#r#....', '.##.#r#.##.', '#rr#rrr#rr#', '#r#.#r#.#r#', '.#..#r#..#.', '..#######..', '....#r#....', '...#r#r#...', '...##.##...'],
    fox: ['........#.#..', '.....###f#f#.', '...##ffffff#.', '..#ffffff#ff#', '.#fffFFffffc#', '.#ffFFccccc#.', '..#FFcccc##..', '...######....'],
    owl: ['#.#', '#O#', '+#+'],
    cat: ['#.#.', '###.', '.###', '.#.#'],
  };

  // ================================================================== region styles
  let VIS = {};
  const RUMOUR = { deepwood: 1, glade: 1 };
  function region(id, fn) {
    const v = !!VIS[id], r = !v && RUMOUR[id], prev = [ST.ink, ST.sketch, ST.tint];
    ST.ink = v ? 1 : r ? 0.42 : 0.55; ST.sketch = v ? 0 : r ? 0.4 : 0.26; ST.tint = v ? 1 : r ? 0.12 : 0.3;
    try { fn(v); } finally { ST.ink = prev[0]; ST.sketch = prev[1]; ST.tint = prev[2]; }
  }

  // ================================================================== parchment and washes
  function makeParchment() {
    bg = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n1 = fbm(x / 70, y / 70, 3, 3), n2 = fbm(x / 20, y / 20, 4, 3), n3 = noise(x / 5, y / 5, 5);
      const fib = noise(x / 30, y / 1.8, 6), fib2 = noise(x / 1.8, y / 34, 7);
      let c = mixc(C.pHi, C.p, sstep(0.25, 0.75, n1));
      c = mixc(c, C.pLilac, clamp((0.52 - n2) * 1.5, 0, 0.55));
      c = mixc(c, C.pDark, clamp((n1 - 0.62) * 1.6, 0, 0.3));
      c = mixc(c, C.pMid, clamp((n3 - 0.45) * 0.35, 0, 0.18));
      if (fib > 0.78) c = mixc(c, C.pHi, (fib - 0.78) * 2); else if (fib < 0.14) c = mixc(c, C.pMid, (0.14 - fib) * 2.5);
      if (fib2 < 0.1) c = mixc(c, C.pMid, (0.1 - fib2) * 2);
      const g = (hash(x, y, 8) - 0.5) * 7, i = (y * W + x) * 3;
      bg[i] = c[0] + g; bg[i + 1] = c[1] + g; bg[i + 2] = c[2] + g * 0.9;
    }
    for (const [cx, cy, r, s] of [[302, 214, 24, 11], [112, 66, 16, 12], [36, 196, 13, 13], [226, 24, 11, 14], [376, 112, 15, 15], [150, 236, 12, 16]]) stain(cx, cy, r, s);
  }
  function stain(cx, cy, r, s) {
    for (let y = cy - r - 4; y <= cy + r + 4; y++) for (let x = cx - r - 4; x <= cx + r + 4; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = Math.hypot(x - cx, (y - cy) * 1.15) / r + (fbm(x / 7, y / 7, s, 2) - 0.5) * 0.5;
      if (d >= 1) continue;
      mulInto(bg, x, y, C.stain, d > 0.86 ? 0.34 : 0.1 + 0.08 * d);
    }
  }
  function blobD(blobs, x, y) {
    let d = 1e9;
    for (const [cx, cy, rx, ry] of blobs) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; d = Math.min(d, dx * dx + dy * dy); }
    return d;
  }
  function inBlobs(blobs, x, y, seed, rough) { return blobD(blobs, x, y) + (fbm(x / 15, y / 15, seed, 3) - 0.5) * (rough == null ? 0.9 : rough) < 1; }
  // watercolour: transparent pigment with granulation and a darker pooled rim
  function wash(blobs, col, str, seed, rough) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [cx, cy, rx, ry] of blobs) { x0 = Math.min(x0, cx - rx * 1.3); y0 = Math.min(y0, cy - ry * 1.3); x1 = Math.max(x1, cx + rx * 1.3); y1 = Math.max(y1, cy + ry * 1.3); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, x1); x++) {
      const d = blobD(blobs, x, y) + (fbm(x / 15, y / 15, seed, 3) - 0.5) * (rough == null ? 0.9 : rough);
      if (d >= 1) continue;
      const gran = 0.8 + 0.4 * noise(x / 3.5, y / 3.5, seed + 9);
      mulInto(bg, x, y, col, Math.min(0.95, str * gran * (d > 0.84 ? 1.45 : 0.86 + 0.14 * d)));
    }
  }

  // ================================================================== terrain
  function tuft(x, y, a) { ink(x - 1, y, a); ink(x, y - 1, a); ink(x, y, a); ink(x + 1, y, a * 0.8); }
  function marsh(x, y, a) { for (let i = 0; i < 5; i++) ink(x + i, y, a); ink(x + 1, y - 1, a); ink(x + 2, y - 2, a); ink(x + 2, y - 1, a); ink(x + 3, y - 1, a); }
  function wave(x, y, a) { ink(x, y + 1, a); ink(x + 1, y, a); ink(x + 2, y, a); ink(x + 3, y + 1, a); ink(x + 4, y + 1, a); ink(x + 5, y, a); }

  // a peak as a noisy heightfield: shoulders, crags, a ridge line, hachures down the shadow side
  function mountain(px, py, h, wl, wr, seed, o) {
    o = o || {};
    const by = py + h + 2, x0 = Math.floor(px - wl), x1 = Math.ceil(px + wr), tops = {}, side = seed % 2 ? 1 : -1;
    for (let x = x0; x <= x1; x++) {
      const t = x <= px ? (px - x) / wl : (x - px) / wr, s = x <= px ? -1 : 1;
      let y = py + h * Math.pow(t, 0.95);
      if (s === side) y -= h * 0.17 * Math.exp(-Math.pow((t - 0.52) / 0.15, 2));
      y += (noise(x / 2.1, seed, 7) - 0.5) * 2.8 * Math.min(1, t * 2.2) + (noise(x / 5, seed, 8) - 0.5) * 1.6 * t;
      tops[x] = y;
    }
    const sh = new Shape(x0, py - 2, x1, by, (x, y) => tops[x] != null && y + 0.5 >= tops[x]);
    const ridge = (y) => px + 0.5 + ((y - py) / h) * wr * 0.34 + Math.sin(y * 0.5 + seed) * 0.5;
    const ha = o.ha == null ? 0.75 : o.ha;
    sh.paper(); sh.tint(o.col || C.mtn, o.ta == null ? 0.3 : o.ta);
    sh.each((x, y) => { if (x > ridge(y)) tint(x, y, o.col || C.mtn, 0.3); });
    if (o.snow) sh.each((x, y) => { if (y < py + h * 0.27 + (noise(x / 1.6, 3, seed) - 0.5) * 3 && x <= ridge(y) + 0.5) lighten(x, y, 0.75); });
    sh.each((x, y) => {
      if (sh.edge(x, y, 'b')) return;
      const d = y - tops[x];
      if (x > ridge(y) + 0.5) {
        if (x % 2 === 0 && d < 2.5 + hash(x, seed, 3) * 6) ink(x, y, ha);
        else if ((x + y) % 4 === 0 && d > 2) ink(x, y, ha * 0.55);
      } else if (d > 1.5 && d < 4 && hash(x, y, seed) < 0.16) ink(x, y, 0.45);
      else if (y > by - h * 0.3 && hash(x, y, seed + 1) < 0.05) ink(x, y, 0.4);
    });
    for (let y = Math.ceil(py + 1.5); y < by - h * 0.32; y++) ink(Math.round(ridge(y)), y, 0.85);
    sh.line(1, 'b');
  }
  // the escarpment under the Ridge: lit and shaded rock slabs split by fissures, scree at the foot
  function cliff(x0, x1, top0) {
    const cuts = [];
    for (let x = x0, k = 0; x <= x1 + 10; k++) { cuts.push(x); x += 4 + Math.floor(hash(k, 7, 63) * 6); }
    let slab = 0;
    for (let x = x0; x <= x1; x++) {
      while (slab + 1 < cuts.length && cuts[slab + 1] <= x) slab++;
      const fa = cuts[slab], fb = cuts[slab + 1] || fa + 6, lit = x < fa + (fb - fa) * 0.45;
      const fade = sstep(x0, x0 + 20, x) * (1 - sstep(x1 - 20, x1, x));
      const t = top0 + Math.round((noise(x / 6, 1, 51) - 0.5) * 4) + (hash(slab, 2, 64) < 0.3 ? 1 : 0), hgt = Math.round((10 + (noise(x / 9, 3, 56) - 0.5) * 5) * fade);
      if (hgt <= 0) continue;
      const b = t + hgt, strata = hash(slab, 3, 65) < 0.55 ? t + 3 + Math.floor(hash(slab, 4, 66) * Math.max(1, hgt - 5)) : -1;
      for (let y = t; y <= b; y++) {
        const depth = (y - t) / hgt;
        paper(x, y); tint(x, y, C.mtn, (lit ? 0.18 : 0.42) + depth * 0.3);
        if (x === fb - 1 && hash(slab, Math.floor(y / 3), 58) < 0.9) ink(x, y, 0.8);
        else if (!lit && (x + y) % 2 === 0) ink(x, y, 0.32 + depth * 0.2);
        else if (y === strata && hash(x, y, 67) < 0.85) ink(x, y, 0.5);
        else if (lit && hash(x, y, 60) < 0.04) ink(x, y, 0.5);
      }
      ink(x, t, 1);
      if (hgt > 2 && lit) lighten(x, t + 1, 0.5);
      ink(x, b, 0.8);
      if (hash(x, 1, 61) < 0.2) ink(x, b + 1, 0.5);
      if (hash(x, 2, 62) < 0.06) { ink(x, b + 2, 0.75); ink(x + 1, b + 2, 0.75); ink(x, b + 1, 0.75); lighten(x + 1, b + 1, 0.3); }
    }
  }

  // trees are shaded like a hand-tinted engraving: a darker wash and a rim of hatching on the shadow side
  function pine(x, y, h, o) {
    o = o || {};
    const hw = Math.max(2, h * 0.44), tiers = h >= 11 ? 3 : h >= 7 ? 2 : 1, R = [], L = [];
    for (let k = 1; k <= tiers; k++) {
      const ty = y - h + (h - 0.6) * (k / tiers), w = hw * (0.45 + (0.55 * k) / tiers);
      R.push([x + 1 + w, ty]); L.push([x - w, ty]);
      if (k < tiers) { R.push([x + 0.5 + w * 0.42, ty]); L.push([x + 0.5 - w * 0.42, ty]); }
    }
    const sh = shPoly([[x + 0.5, y - h - 0.4]].concat(R, L.reverse())), col = o.col || C.forest, ha = o.ha == null ? 0.6 : o.ha;
    sh.paper(); sh.tint(col, o.ta == null ? 0.5 : o.ta);
    sh.each((px, py) => { if (px > x) { tint(px, py, col, 0.45); if (!sh.edge(px, py) && (px - x) % 2 === 0 && (py + px) % 3 !== 0) ink(px, py, ha); } else if (px < x && sh.edge(px + 1, py) === false && hash(px, py, 5) < 0.12) lighten(px, py, 0.4); });
    sh.line(1);
    ink(x, y, 1); if (h > 9) ink(x, y + 1, 1);
  }
  function tree(x, y, r, o) {
    o = o || {};
    const cy = y - r - 1.2, ph = o.seed == null ? (x * 7 + y * 3) % 6 : o.seed, col = o.col || C.forest, ha = o.ha == null ? 0.6 : o.ha;
    const sh = new Shape(x - r - 2, cy - r - 2, x + r + 2, cy + r + 2, (px, py) => {
      const dx = px + 0.5 - (x + 0.5), dy = py + 0.5 - cy, a = Math.atan2(dy, dx), rr = r * (0.88 + 0.16 * Math.abs(Math.sin(a * 2.5 + ph)));
      return dx * dx + dy * dy * 1.08 <= rr * rr;
    });
    const d = sh.dist();
    sh.paper(); sh.tint(col, o.ta == null ? 0.5 : o.ta);
    sh.each((px, py) => {
      const s = ((px + 0.5 - (x + 0.5)) * 0.75 + (py + 0.5 - cy)) / r;
      if (s > 0.15) tint(px, py, col, 0.4);
      if (s > 0.35 && d(px, py) < 2.6 && (px + py) % 2 === 0 && !sh.edge(px, py)) ink(px, py, ha);
      else if (s < -0.45 && d(px, py) < 2 && !sh.edge(px, py)) lighten(px, py, 0.45);
    });
    sh.line(1);
    for (let ty = Math.round(cy + r * 0.92); ty <= y; ty++) ink(x, ty, 1);
  }
  function deadTree(x, y, h, seed, a) {
    const r = rng(seed);
    a = a == null ? 1 : a;
    const br = (x0, y0, ang, len, depth) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
      line(x0, y0, x1, y1, a);
      if (depth > 0) { br(x1, y1, ang - 0.45 - r() * 0.35, len * 0.62, depth - 1); br(x1, y1, ang + 0.4 + r() * 0.35, len * 0.58, depth - 1); }
    };
    line(x, y, x, y - h * 0.55, a); line(x + 1, y, x + 1, y - h * 0.3, a);
    ink(x - 1, y, a); ink(x + 2, y, a);
    br(x, y - h * 0.55, -Math.PI / 2 - 0.35 - r() * 0.2, h * 0.32, 2);
    br(x + 1, y - h * 0.5, -Math.PI / 2 + 0.4 + r() * 0.2, h * 0.36, 2);
  }
  // a weeping willow: a low dome and a long curtain of strands reaching for the grass
  function willow(x, y, r, o) {
    o = o || {};
    const seed = x * 3 + y, top = y - Math.round(r * 2.4) - 2, cy = top + Math.round(r * 0.75), col = o.col || C.glade;
    const endY = {};
    for (let px = x - r; px <= x + r + 1; px++) {
      const e = Math.abs(px + 0.5 - (x + 1)) / (r + 0.5);
      endY[px] = Math.round(y - 1 - hash(px, 2, seed) * 2.6 - e * e * 2.5 - (Math.abs(px + 0.5 - (x + 1)) < 1.6 ? 3 : 0));
    }
    const sh = new Shape(x - r - 1, top - 1, x + r + 2, y, (px, py) => {
      const dx = (px + 0.5 - (x + 1)) / (r + 0.6), dy = (py + 0.5 - cy) / (cy - top + 0.5);
      if (py + 0.5 <= cy) return dx * dx + dy * dy <= 1;
      return endY[px] != null && py <= endY[px] && Math.abs(dx) <= 1 - ((py - cy) / (y - cy)) * 0.12;
    });
    for (let ty = cy; ty <= y; ty++) { ink(x, ty, 1); ink(x + 1, ty, 1); }
    sh.paper(); sh.tint(col, o.ta == null ? 0.55 : o.ta);
    sh.each((px, py) => {
      if (sh.edge(px, py)) return;
      if (py > cy && (px - x + 40) % 2 === 1) ink(px, py, 0.42);
      if (px > x + 1) tint(px, py, col, 0.35);
      if (py <= cy && px > x + 2 && (px + py) % 2 === 0) ink(px, py, 0.45);
      else if (py <= cy && px < x - 1 && py < cy - 1 && hash(px, py, 6) < 0.3) lighten(px, py, 0.4);
    });
    sh.line(1);
  }
  function bushes(x, y, a) { const s = new Shape(x - 3, y - 3, x + 3, y, (px, py) => Math.hypot(px - x, (py - y) * 1.4) < 2.6 + hash(px, py, 4) * 0.6); s.paper(); s.tint(C.forest, 0.45 * a); s.line(a); }

  // scatter trees on a jittered grid inside noisy blobs, drawn back to front
  function forest(blobs, o) {
    const pts = [], sx = o.sx || 7, sy = o.sy || 5;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [cx, cy, rx, ry] of blobs) { x0 = Math.min(x0, cx - rx); y0 = Math.min(y0, cy - ry); x1 = Math.max(x1, cx + rx); y1 = Math.max(y1, cy + ry); }
    let row = 0;
    for (let gy = y0; gy <= y1 + sy; gy += sy, row++) for (let gx = x0 + (row % 2) * sx * 0.5; gx <= x1; gx += sx) {
      const x = Math.round(gx + (hash(gx, gy, o.seed) - 0.5) * sx * 0.8), y = Math.round(gy + (hash(gx, gy, o.seed + 1) - 0.5) * sy * 0.7);
      if (!inBlobs(blobs, x, y, o.seed, 0.7)) continue;
      if (o.avoid && o.avoid(x, y)) continue;
      pts.push([x, y, hash(x, y, o.seed + 2)]);
    }
    pts.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    for (const [x, y, k] of pts) o.draw(x, y, k);
  }

  // ---------------------------------------------------------------- water
  function waterBody(sh, o) {
    o = o || {};
    const dist = sh.dist();
    sh.paper(); sh.tint(C.water, o.ta == null ? 0.62 : o.ta);
    sh.each((x, y) => {
      const d = dist(x, y);
      if (d > 7) tint(x, y, C.waterD, Math.min(0.45, (d - 7) * 0.05));
      if (o.lines !== false) {
        if (d >= 2.6 && d < 3.6 && noise(x / 3, y / 3, 42) > 0.32) ink(x, y, 0.42);
        if (d >= 5.6 && d < 6.6 && noise(x / 3, y / 3, 43) > 0.55) ink(x, y, 0.26);
      }
    });
    sh.line(1);
    return dist;
  }
  function ripples(cx, cy, radii, a) {
    for (const r of radii) ellipsePix(cx, cy, r, r * 0.5, (x, y) => { if (noise(x / 2.2, y / 2.2, r * 7) > 0.34) ink(x, y, a); });
  }
  function river(pts, w0, w1, seed) {
    const s = spline(pts, 0.35), n = s.length;
    const sh = shStamps(s.map(([x, y], i) => [x, y, (w0 + (w1 - w0) * (i / (n - 1))) * (0.5 + 0.08 * Math.sin(i * 0.11 + seed))]));
    sh.paper(); sh.tint(C.water, 0.7); sh.line(1);
    for (let i = 8; i < n - 6; i += 17) {
      const [x, y] = s[i];
      if (hash(i, seed, 3) < 0.6) { ink(x - 1, y, 0.45); ink(x, y - 0.6, 0.45); ink(x + 1, y, 0.45); }
    }
    return s;
  }
  function lilyPad(x, y) { body(x, y, C.glade, 0.9); body(x + 1, y, C.glade, 0.9); ink(x - 1, y, 0.7); ink(x + 2, y, 0.7); ink(x, y + 1, 0.6); ink(x + 1, y + 1, 0.6); }

  // ---------------------------------------------------------------- red-ink trail
  function trail(pts, dim) {
    const p = pixPath(pts);
    let k = 0;
    for (const [x, y] of p) {
      const on = k++ % 5 < 3;
      if (!on) continue;
      if (dim) { if (k % 2) red(x, y, 0.55); continue; }
      red(x, y, 0.95);
    }
  }
  function footpath(pts, a) { let k = 0; for (const [x, y] of pixPath(pts)) if (k++ % 3 === 0) ink(x, y, a); }

  // ================================================================== landmarks
  // ---------------------------------------------------------------- houses
  function house(x, by, w, wh, rh, roofCol, o) {
    o = o || {};
    const lean = o.lean || 0, wt = by - wh;
    const walls = shPoly([[x, by], [x + w, by], [x + w + lean, wt], [x + lean, wt]]);
    walls.paper(); walls.tint(o.wall || C.plaster, 0.55);
    if (o.timber !== false) {
      if (wh >= 7) { const yb = Math.round(wt + wh * 0.45); walls.each((px, py) => { if (py === yb) ink(px, py, 0.75); }); }
      walls.each((px, py) => { const lx = px - x - (lean * (by - py)) / wh; if (Math.abs(lx - w / 2) < 0.5 && py > wt + 1) ink(px, py, 0.45); });
    }
    walls.hatch((px, py) => px - x - (lean * (by - py)) / wh >= w - 1.5, 0.45);
    walls.line(1);
    const ax = x + w / 2 + lean, ay = wt - rh;
    const roof = shPoly([[x - 1.2 + lean, wt + 1], [x + w + 1.2 + lean, wt + 1], [ax + 0.5, ay]]);
    roof.paper(); roof.tint(roofCol, 0.7);
    roof.hatch((px, py) => px > ax + 0.5 && (px + py) % 2 === 0, 0.55);
    roof.hatch((px, py) => px <= ax && py % 2 === 0 && (px + (py >> 1)) % 3 === 0, 0.32);
    roof.line(1);
    if (o.chimney != null) {
      const cx = Math.round(x + lean + o.chimney), ct = Math.round(wt - rh * 0.55) - 2;
      const ch = shRect(cx, ct, 2, 3 + Math.round(rh * 0.3)); ch.paper(); ch.tint(C.stone, 0.5); ch.line(1);
      if (o.smoke !== false) smoke(cx + 1, ct - 2, o.smokeN || 4, 1);
    }
    for (const [wx, wy] of o.windows || []) { const px = Math.round(x + wx + (lean * wy) / wh), py = by - wy; glow(px, py, C.amber); }
    if (o.door != null) { const dx = Math.round(x + o.door); ink(dx, by - 1, 1); ink(dx, by - 2, 1); if (o.doorW) { ink(dx + 1, by - 1, 1); ink(dx + 1, by - 2, 1); } }
  }
  function smoke(x, y, n, dir, col) {
    for (let i = 0; i < n; i++) {
      const cx = x + Math.sin(i * 1.3) * 1.2 + i * dir * 0.9, cy = y - i * 2.6, r = 0.9 + i * 0.32;
      const s = shEll(cx, cy, r + 0.4, r * 0.85 + 0.3);
      if (col) s.each((px, py) => put(px, py, col, 0.25)); else s.paper();
      s.line(0.42 - i * 0.05);
    }
  }
  function lancet(x, y, w, h, cols) {
    const sh = new Shape(x - 1, y - 2, x + w, y + h, (px, py) => px >= x && px < x + w && py >= y + (w > 1 && (px === x || px === x + w - 1) ? 1 : 0) && py < y + h);
    sh.each((px, py) => glow(px, py, cols[(px + py * 2) % cols.length]));
    ink(x - 1, y + h - 1, 0.9);
  }
  function roseWindow(cx, cy, r) {
    const cols = [C.rose, C.blue, C.gold, C.purple];
    const sh = new Shape(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r);
    sh.each((x, y) => {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
      if (sh.edge(x, y)) ink(x, y, 1);
      else if (d < 1.1) glow(x, y, C.candle);
      else glow(x, y, cols[(Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) + 8) % 4]);
    });
  }

  // ---------------------------------------------------------------- the Verdant Sanctum
  function temple(cx, by) {
    // stepped platform
    const s1 = shRect(cx - 23, by - 3, 47, 4); s1.paper(); s1.tint(C.stone, 0.5); s1.hatch((x, y) => y === by && x % 2 === 0, 0.5); s1.line(1);
    const s2 = shRect(cx - 20, by - 5, 41, 3); s2.paper(); s2.tint(C.stone, 0.4); s2.line(1);
    // pillars: some whole, some broken
    const top = by - 22;
    for (const [dx, broken] of [[-18, 6], [-12, 0], [-6, 0], [6, 0], [12, 3], [18, 10]]) {
      const x = cx + dx, t = top + broken;
      const p = new Shape(x - 1, t, x + 1, by - 5, (px, py) => py > t + (broken ? hash(px, 9, dx) * 2.5 : 0));
      p.paper(); p.tint(C.stone, 0.45); p.hatch((px) => px === x + 1, 0.5); p.line(1);
      if (!broken) { line(x - 2, t, x + 2, t, 1); line(x - 2, t + 1, x + 2, t + 1, 0.6); }
      line(x - 2, by - 6, x + 2, by - 6, 0.9);
      for (let k = 0; k < 4; k++) if (hash(x, k, 5) < 0.6) tint(x + (k % 3) - 1, t + 4 + k * 3, C.forest, 0.9);
    }
    // the ruined architrave over the left pair and the arch in the middle
    const beam = shPoly([[cx - 20, top - 2], [cx - 9, top - 2], [cx - 10, top + 1], [cx - 20, top + 1]]); beam.paper(); beam.tint(C.stone, 0.4); beam.line(1);
    const arch = new Shape(cx - 8, top - 12, cx + 8, top + 2, (x, y) => {
      const ox = x + 0.5 - cx, oy = y + 0.5 - (top + 1);
      const outer = Math.abs(ox) < 7.5 && (oy > 0 || Math.hypot(Math.abs(ox) + 5, oy * 0.8) < 12.5);
      const inner = Math.abs(ox) < 4.5 && (oy > 0 || Math.hypot(Math.abs(ox) + 5, oy * 0.8) < 9.5);
      return outer && !inner;
    });
    arch.paper(); arch.tint(C.stone, 0.5); arch.hatch((x) => x > cx + 4, 0.5); arch.line(1);
    // the moon altar glowing inside the arch
    for (let y = top - 4; y < by - 6; y++) for (let x = cx - 4; x <= cx + 4; x++) if (Math.abs(x + 0.5 - cx) < 4 && (y > top || Math.hypot(Math.abs(x + 0.5 - cx) + 5, (y + 0.5 - top - 1) * 0.8) < 9.2)) tint(x, y, C.deepV, 0.35);
    const md = shEll(cx, top + 3, 2.2, 2.2); md.each((x, y) => glow(x, y, C.violet)); glow(cx, top + 3, C.moon);
    const alt = shRect(cx - 2, by - 9, 5, 3); alt.paper(); alt.tint(C.stone, 0.5); alt.line(1);
    // crescent keystone
    ink(cx - 1, top - 13, 1); ink(cx, top - 14, 1); ink(cx + 1, top - 14, 1); ink(cx + 2, top - 13, 1); glow(cx, top - 13, C.moon);
    // rubble and ivy
    for (const [x, y] of [[cx - 27, by], [cx - 25, by - 1], [cx + 26, by], [cx + 24, by + 1], [cx - 14, by + 2]]) { ink(x, y, 0.9); ink(x + 1, y, 0.6); }
    bushes(cx - 25, by - 1, 1); bushes(cx + 25, by - 2, 1);
  }
  function walledGarden(x0, y0, w, h) {
    const g = shRect(x0, y0, w, h); g.paper(); g.tint(C.warm, 0.35);
    // furrows of crops on either side of the central path
    for (let y = y0 + 2; y < y0 + h - 1; y += 2) {
      if (Math.abs(y - (y0 + h / 2)) < 2) continue;
      for (let x = x0 + 2; x < x0 + w - 2; x++) {
        if (Math.abs(x - (x0 + w / 2)) < 1.5) continue;
        if ((x + y) % 3 !== 0) { tint(x, y, C.forest, 0.8); if (hash(x, y, 33) < 0.35) ink(x, y, 0.55); }
      }
    }
    // low ruined walls with gates east and west
    const gate = (x, y) => (Math.abs(y - (y0 + h / 2)) < 2 && (x === x0 || x === x0 + w - 1)) || (Math.abs(x - (x0 + w / 2)) < 1.5 && y === y0);
    g.each((x, y) => { if (g.edge(x, y) && !gate(x, y)) { ink(x, y, 1); if ((x + y) % 4 === 0 && (y === y0)) ink(x, y - 1, 0.8); } });
    for (let x = x0; x < x0 + w; x += 4) if (!gate(x, y0)) ink(x, y0 - 1, 0.9);
  }
  function pond(cx, cy, rx, ry, lily) {
    const sh = shEll(cx, cy, rx, ry, 0.25, cx);
    waterBody(sh, { lines: false });
    ellipsePix(cx, cy, rx - 2, ry - 1.5, (x, y) => { if (noise(x / 2, y / 2, 5) > 0.5) ink(x, y, 0.35); });
    if (lily) lilyPad(Math.round(cx + rx * 0.3), Math.round(cy));
    tuft(Math.round(cx - rx - 1), Math.round(cy - 1), 0.7); tuft(Math.round(cx + rx + 1), Math.round(cy + 1), 0.7);
  }

  // ---------------------------------------------------------------- Hollowmere
  function fountain(cx, cy) {
    const b = shEll(cx, cy, 4, 2.4); b.paper(); b.tint(C.water, 0.8); b.line(1);
    line(cx, cy - 4, cx, cy, 1); glow(cx, cy - 5, C.moon); ink(cx - 1, cy - 5, 0.8); ink(cx + 1, cy - 6, 0.8);
    ink(cx - 2, cy - 2, 0.4); ink(cx + 2, cy - 2, 0.4);
  }
  function plaza(cx, cy, rx, ry) {
    const p = shEll(cx, cy, rx, ry, 0.15, 21);
    p.paper(); p.each((x, y) => { lighten(x, y, 0.35); if ((x + (y % 2) * 2) % 4 === 0 && y % 2 === 0) ink(x, y, 0.18); });
    p.each((x, y) => { if (p.edge(x, y) && (x + y) % 2 === 0) ink(x, y, 0.55); });
  }
  function village() {
    plaza(186, 131, 15, 8);
    tree(134, 120, 3); tree(229, 117, 2.8); tree(150, 124, 2.6, { col: C.roofP, ta: 0.35 });
    // the north row: a cottage, Thornwick's Seeds & Sundries, the Gilded Owl
    house(138, 117, 10, 7, 9, C.roofI, { lean: 1, chimney: 7, windows: [[3, 4]], door: 7 });
    house(159, 120, 13, 8, 10, C.roofP, { lean: 1, chimney: 2, windows: [[3, 5], [10, 5]], door: 6 });
    for (let x = 159; x <= 173; x++) { paper(x, 115); tint(x, 115, x % 2 ? C.forest : C.plaster, 0.95); ink(x, 116, 0.6); }
    ink(156, 113, 1); line(156, 112, 158, 112, 1); glow(156, 114, C.gold);
    house(193, 121, 18, 12, 10, C.roofS, { chimney: 14, windows: [[3, 8], [7, 8], [11, 8], [15, 8], [3, 3], [14, 3]], door: 8, doorW: true });
    line(212, 112, 214, 112, 1); ink(214, 113, 1); glow(214, 114, C.gold); glow(214, 115, C.gold); ink(213, 114, 0.7); ink(215, 115, 0.7);
    sprite(SPR.owl, 201, 98);
    // Quillon's Threads & Tomes, east of the plaza: tall, narrow and leaning, with a round window
    house(214, 130, 9, 14, 10, C.roofP, { lean: 2, windows: [[2, 3], [6, 3], [2, 7]], door: 6 });
    for (const [x, y] of [[221, 122], [220, 121], [220, 123], [219, 122]]) ink(x, y, 0.85); glow(220, 122, C.amber);
    // the rest of the village, west and south
    house(137, 140, 10, 7, 8, C.roofT, { lean: 1, chimney: 1, windows: [[3, 3]], door: 7 });
    house(151, 137, 8, 6, 8, C.roofI, { lean: -1, windows: [[5, 3]], door: 2 });
    house(156, 155, 10, 7, 8, C.roofP, { lean: -1, chimney: 7, windows: [[3, 3]], door: 6 });
    house(169, 160, 8, 6, 7, C.roofS, { lean: 1, windows: [[5, 3]], door: 2 });
    house(199, 156, 11, 7, 9, C.roofI, { lean: 1, chimney: 7, windows: [[3, 3], [8, 3]], door: 5 });
    house(215, 149, 9, 6, 8, C.roofT, { lean: -1, windows: [[2, 3]], door: 6 });
    fountain(186, 131);
    if (FULL) for (const [a, b, sag] of [[[171, 124], [201, 124], 3], [[171, 124], [201, 135], 2.5], [[201, 124], [171, 135], 2.5]]) {
      for (let i = 0; i <= 30; i++) { const t = i / 30, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * sag; if (i % 3 === 0) glow(x, y, [C.amber, C.rose, C.violet][(i / 3) % 3]); else ink(x, y, 0.35); }
    }
    // lamps and market stalls round the plaza
    for (const [x, y] of [[171, 126], [201, 126], [171, 137], [201, 137]]) { ink(x, y, 1); ink(x, y - 1, 1); glow(x, y - 2, C.amber); }
    for (const [x, y] of [[178, 139], [194, 139]]) { line(x - 2, y - 3, x + 2, y - 3, 1); for (let k = -2; k <= 2; k++) tint(x + k, y - 2, k % 2 ? C.rose : C.plaster, 0.9); ink(x - 2, y - 1, 1); ink(x + 2, y - 1, 1); ink(x - 2, y, 1); ink(x + 2, y, 1); }
    tree(228, 158, 3); tree(146, 152, 2.6);
  }
  function cathedral(cx, by) {
    const stone = (sh, a) => { sh.paper(); sh.tint(C.stone, a == null ? 0.6 : a); return sh; };
    // the spire tower (behind the facade)
    const tower = stone(shRect(cx - 3, by - 37, 7, 18)); tower.hatch((x, y) => x >= cx + 2 && (x + y) % 2 === 0, 0.55); tower.line(1);
    lancet(cx - 1, by - 34, 3, 6, [C.rose, C.blue, C.gold]);
    const spire = stone(shPoly([[cx + 0.5, by - 57], [cx + 4.2, by - 37], [cx - 3.2, by - 37]])); spire.hatch((x, y) => x > cx && (x + y) % 2 === 0, 0.6); spire.line(1);
    for (let y = by - 52; y < by - 38; y += 4) { ink(cx - 1 - Math.floor((y - by + 57) / 6), y, 0.7); }
    line(cx, by - 61, cx, by - 57, 1); line(cx - 1, by - 60, cx + 1, by - 60, 1);
    // side towers with pinnacles and flying buttresses
    for (const s of [-1, 1]) {
      const px = s < 0 ? cx - 14 : cx + 11;
      const p = stone(shRect(px, by - 22, 4, 22)); p.hatch((x, y) => x >= px + 2 && (x + y) % 2 === 0, 0.55); p.line(1);
      const sp = stone(shPoly([[px + 2, by - 31], [px + 4.6, by - 22], [px - 0.6, by - 22]])); sp.hatch((x) => x > px + 2, 0.5); sp.line(1);
      ink(px + 2, by - 32, 1);
      lancet(px + 1, by - 17, 2, 5, [C.blue, C.purple]);
      const bx0 = s < 0 ? px + 4 : px - 1, bx1 = s < 0 ? cx - 8 : cx + 8;
      line(bx0, by - 19, bx1, by - 25, 1); line(bx0, by - 18, bx1, by - 24, 0.6);
    }
    // the nave facade and gable
    const nave = stone(shRect(cx - 9, by - 21, 19, 21), 0.55); nave.hatch((x, y) => x >= cx + 7 && (x + y) % 2 === 0, 0.5); nave.line(1);
    const gable = stone(shPoly([[cx - 10, by - 20], [cx + 0.5, by - 32], [cx + 11, by - 20]])); gable.hatch((x, y) => x > cx + 3 && (x + y) % 2 === 0, 0.5); gable.line(1);
    ink(cx, by - 33, 1);
    roseWindow(cx + 0.5, by - 23.5, 3.6);
    lancet(cx - 6, by - 15, 2, 8, [C.rose, C.gold, C.blue]); lancet(cx + 5, by - 15, 2, 8, [C.blue, C.purple, C.rose]);
    const door = new Shape(cx - 2, by - 8, cx + 3, by - 1, (x, y) => Math.abs(x + 0.5 - (cx + 0.5)) < 2.6 - (y < by - 6 ? (by - 6 - y) * 0.9 : 0));
    door.each((x, y) => body(x, y, C.cave, 1)); door.line(1);
    // reflecting pools
    for (const [x0, w] of [[cx - 15, 11], [cx + 5, 11]]) {
      const pl = shRect(x0, by + 2, w, 3); pl.paper(); pl.tint(C.water, 0.85); pl.line(1);
      glow(x0 + 3, by + 3, C.rose); glow(x0 + 6, by + 3, C.blue); glow(x0 + 8, by + 3, C.gold);
    }
  }

  // ---------------------------------------------------------------- Starfall Ridge
  function observatory(cx, by) {
    const kn = shPoly([[cx - 14, by + 6], [cx - 8, by + 1], [cx - 3, by - 1], [cx + 4, by - 1], [cx + 9, by + 1], [cx + 15, by + 6]]);
    kn.paper(); kn.tint(C.stone, 0.4); kn.hatch((x, y) => x > cx + 3 && (x - y) % 3 === 0, 0.6); kn.line(1, 'b');
    const bodyS = shPoly([[cx - 4, by + 0.5], [cx + 5, by + 0.5], [cx + 4, by - 22], [cx - 3, by - 22]]);
    bodyS.paper(); bodyS.tint(C.moonst, 0.75);
    bodyS.hatch((x, y) => x >= cx + 2 && (x + y) % 2 === 0, 0.5); bodyS.hatch((x, y) => (by - y) % 4 === 0, 0.25); bodyS.line(1);
    glow(cx, by - 5, C.sky); glow(cx, by - 6, C.sky); glow(cx - 1, by - 12, C.sky); glow(cx + 1, by - 12, C.sky);
    ink(cx, by - 1, 1); ink(cx + 1, by - 1, 1); ink(cx, by - 2, 1); ink(cx + 1, by - 2, 1);
    const bal = shRect(cx - 6, by - 17, 14, 2); bal.paper(); bal.tint(C.moonst, 0.6); bal.line(1);
    for (let x = cx - 6; x <= cx + 7; x += 2) ink(x, by - 18, 0.8);
    line(cx - 6, by - 19, cx + 7, by - 19, 0.8);
    const dome = new Shape(cx - 6, by - 31, cx + 7, by - 22, (x, y) => { const dx = (x + 0.5 - (cx + 0.5)) / 5.6, dy = (y + 0.5 - (by - 21.5)) / 8.5; return dy <= 0 && dx * dx + dy * dy <= 1; });
    dome.paper(); dome.tint(C.verd, 0.75); dome.hatch((x, y) => x > cx + 1 && (x + y) % 2 === 0, 0.55); dome.line(1);
    line(cx, by - 29, cx, by - 23, 0.9);
    // the telescope poking out at the stars
    line(cx + 1, by - 27, cx + 7, by - 33, 1); line(cx + 2, by - 27, cx + 8, by - 33, 1); body(cx + 4, by - 30, C.gold, 1); body(cx + 5, by - 31, C.gold, 1);
    // crescent finial
    ink(cx - 1, by - 33, 1); ink(cx, by - 34, 1); ink(cx + 1, by - 34, 1); ink(cx + 1, by - 32, 1); ink(cx, by - 32, 0.5); glow(cx, by - 33, C.moon);
    for (const [x, y] of [[cx - 10, by - 33], [cx + 13, by - 27], [cx - 13, by - 22], [cx + 11, by - 38]]) sparkle(x, y);
  }
  function sparkle(x, y) { ink(x, y - 1, 0.7); ink(x, y + 1, 0.7); ink(x - 1, y, 0.7); ink(x + 1, y, 0.7); glow(x, y, C.candle); }
  function cemetery(x0, y0, w, h) {
    const g = shPoly([[x0 + 4, y0], [x0 + w + 4, y0], [x0 + w, y0 + h], [x0, y0 + h]]);
    g.paper(); g.tint(C.deep, 0.3);
    g.each((x, y) => { if (g.edge(x, y)) ink(x, y, 0.8); });
    deadTree(x0 + w - 1, y0 + 5, 12, 7, 1);
    // rows of headstones and crosses, back to front
    for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
      const x = x0 + 5 + k * 4 + (2 - r) * 1.3, y = Math.round(y0 + 4 + r * 4);
      if (x > x0 + w - 4 || hash(k, r, 8) < 0.15) continue;
      if ((k + r) % 3 === 0) sprite(['.#.', '#o#', '.#.', '.#.'], Math.round(x) - 1, y - 3);
      else sprite(['.##.', '#OO#', '#oo#'], Math.round(x) - 1, y - 2);
    }
    // the picket fence along the front, with a gate
    for (let x = x0; x <= x0 + w; x++) { if (Math.abs(x - (x0 + w / 2)) < 2) continue; ink(x, y0 + h, 1); if (x % 2 === 0) { ink(x, y0 + h - 1, 1); ink(x, y0 + h - 2, 0.8); } }
    ink(x0 + 3, y0 - 1, 0.9); ink(x0 + 3, y0 - 2, 0.9);
    sprite(['#.#', '###'], x0 + w - 3, y0 - 5);
  }
  function chapel(cx, by) {
    house(cx - 7, by, 11, 7, 8, C.roofS, { timber: false, wall: C.stone });
    const tw = shRect(cx + 3, by - 16, 5, 16); tw.paper(); tw.tint(C.stone, 0.6); tw.hatch((x, y) => x >= cx + 6 && (x + y) % 2 === 0, 0.55); tw.line(1);
    body(cx + 5, by - 13, C.cave, 1); body(cx + 5, by - 12, C.cave, 1);
    const sp = shPoly([[cx + 5.5, by - 25], [cx + 8.8, by - 16], [cx + 2.2, by - 16]]); sp.paper(); sp.tint(C.roofS, 0.65); sp.hatch((x, y) => x > cx + 5 && (x + y) % 2 === 0, 0.55); sp.line(1);
    line(cx + 5, by - 28, cx + 5, by - 25, 1); line(cx + 4, by - 27, cx + 6, by - 27, 1);
    lancet(cx - 3, by - 5, 2, 4, [C.rose, C.gold, C.blue]);
    ink(cx + 5, by - 1, 1); ink(cx + 5, by - 2, 1); ink(cx + 5, by - 3, 0.6);
  }
  function forge(cx, by) {
    house(cx - 7, by, 13, 7, 6, C.roofS, { wall: C.stone, timber: false, windows: [[10, 3]] });
    const ch = shRect(cx + 3, by - 18, 3, 6); ch.paper(); ch.tint(C.stone, 0.5); ch.line(1);
    smoke(cx + 4, by - 21, 5, -1);
    for (let y = by - 4; y < by; y++) for (let x = cx - 5; x <= cx - 3; x++) glow(x, y, y === by - 4 && x !== cx - 4 ? C.amber : C.gold);
    ink(cx - 6, by - 4, 1); ink(cx - 2, by - 4, 1);
    // an anvil out front
    line(cx + 7, by + 1, cx + 11, by + 1, 1); line(cx + 8, by + 2, cx + 10, by + 2, 1); ink(cx + 9, by + 3, 1); line(cx + 8, by + 4, cx + 10, by + 4, 1);
  }
  function lodge(cx, by) {
    house(cx - 6, by, 12, 6, 6, C.roofM, { wall: C.wood, timber: false, chimney: 2, smokeN: 3, door: 6, windows: [[2, 3], [10, 3]] });
    for (let y = by - 5; y < by; y += 2) for (let x = cx - 5; x < cx + 6; x++) if (x !== cx) ink(x, y, 0.35);
    glow(cx + 1, by - 2, C.amber);
    // the crossed-picks sign
    ink(cx - 9, by - 4, 1); ink(cx - 8, by - 3, 1); ink(cx - 7, by - 4, 1); ink(cx - 8, by - 5, 1); line(cx - 8, by - 2, cx - 8, by, 1);
  }
  // a craggy outcrop with a black arch breathing cold air, a skull and crossbones over the door
  function caveMouth(cx, by, visited) {
    const x0 = cx - 19, x1 = cx + 19, tops = {};
    for (let x = x0; x <= x1; x++) {
      const t = Math.abs(x + 0.5 - cx) / 19;
      tops[x] = by - 18 + 18 * Math.pow(t, 1.7) + (noise(x / 1.8, 3, 71) - 0.5) * 3.5 * (0.35 + t) + (x > cx ? 1.5 : 0);
    }
    const rock = new Shape(x0, by - 24, x1, by + 1, (x, y) => tops[x] != null && y + 0.5 >= tops[x]);
    rock.paper(); rock.tint(C.stone, 0.62);
    const facet = (x, y) => Math.floor((x - cx + 40 + (y - by) * 0.6) / 5);
    rock.each((x, y) => {
      if (rock.edge(x, y, 'b')) return;
      const f = facet(x, y), shade = hash(f, 1, 73) < 0.45 || x > cx + 6;
      if (facet(x + 1, y) !== f && hash(f, Math.floor(y / 3), 74) < 0.7) ink(x, y, 0.75);
      else if (shade && (x - y + 300) % 3 === 0) ink(x, y, 0.62);
      else if (hash(x, y, 75) < 0.05) ink(x, y, 0.5);
    });
    rock.line(1, 'b');
    const op = new Shape(cx - 7, by - 13, cx + 7, by, (x, y) => { const dx = (x + 0.5 - (cx + 0.5)) / 6.2, dy = (y + 0.5 - by) / 11.5; return dy <= 0 && dx * dx + dy * dy <= 1; });
    const od = op.dist();
    op.each((x, y) => body(x, y, od(x, y) > 3.2 ? C.cave : mixc(C.caveV, C.cave, 0.25), 1));
    op.line(1, 'b');
    for (const [dx, len] of [[-3, 2], [-1, 3], [2, 2], [4, 1]]) for (let k = 0; k < len; k++) { const y = by - 10 + Math.abs(dx) * 0.4 + k; paper(cx + dx, y); tint(cx + dx, y, C.stone, 0.6); if (k === len - 1) ink(cx + dx, y + 1, 0.9); }
    if (visited) { glow(cx - 1, by - 4, C.violet); glow(cx + 2, by - 4, C.violet); }
    for (let x = cx - 9; x <= cx + 9; x++) if (hash(x, 5, 76) < 0.5) ink(x, by + 1, 0.5);
    // skull and crossbones carved over the arch
    const bones = shStamps([[cx - 5, by - 25, 1], [cx + 6, by - 15, 1], [cx + 6, by - 25, 1], [cx - 5, by - 15, 1]].concat(spline([[cx - 5, by - 25], [cx + 6, by - 15]], 0.5).map(([x, y]) => [x, y, 0.6]), spline([[cx + 6, by - 25], [cx - 5, by - 15]], 0.5).map(([x, y]) => [x, y, 0.6])));
    bones.paper(); bones.each((x, y) => lighten(x, y, 0.6)); bones.line(1);
    sprite(SPR.skull, cx - 4, by - 25);
  }

  // ---------------------------------------------------------------- Glimmermere
  function lake(cx, cy, rx, ry) {
    const sh = new Shape(cx - rx - 6, cy - ry - 6, cx + rx + 6, cy + ry + 6, (x, y) => {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, a = Math.atan2(dy, dx);
      const wob = 0.08 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 5 + 2) + (noise(x / 7, y / 7, 41) - 0.5) * 0.18;
      return dx * dx + dy * dy <= 1 + wob;
    });
    // shore: sandy rim and reeds
    const shore = new Shape(cx - rx - 9, cy - ry - 9, cx + rx + 9, cy + ry + 9, (x, y) => !sh.at(x, y) && (sh.at(x - 2, y) || sh.at(x + 2, y) || sh.at(x, y - 2) || sh.at(x, y + 2)));
    shore.each((x, y) => { if (hash(x, y, 61) < 0.18) ink(x, y, 0.4); });
    const dist = waterBody(sh);
    sh.each((x, y) => { if (dist(x, y) > 9 && hash(x, y, 62) < 0.02 && x % 3 === 0) wave(x, y, 0.5); });
    return sh;
  }
  function boat(x, wy) {
    const hull = shPoly([[x - 3.5, wy - 2], [x + 4.5, wy - 2], [x + 3, wy], [x - 2, wy]]); hull.paper(); hull.tint(C.wood, 0.8); hull.line(1);
  }
  function sailboat(x, wy) {
    const hull = shPoly([[x - 5, wy - 2.5], [x + 6, wy - 2.5], [x + 4, wy + 0.5], [x - 3, wy + 0.5]]); hull.paper(); hull.tint(C.wood, 0.8); hull.line(1);
    line(x, wy - 3, x, wy - 13, 1);
    const sail = shPoly([[x + 1, wy - 12], [x + 1, wy - 3.5], [x + 6.5, wy - 3.5]]); sail.paper(); sail.each((px, py) => lighten(px, py, 0.35)); sail.hatch((px, py) => px > x + 3 && (px + py) % 2 === 0, 0.35); sail.line(1);
    const jib = shPoly([[x - 1, wy - 11], [x - 1, wy - 3.5], [x - 4.5, wy - 3.5]]); jib.paper(); jib.line(1);
    red(x + 1, wy - 13); red(x + 2, wy - 13); red(x + 1, wy - 12);
    for (let i = -6; i <= 7; i++) if (hash(i, 3, 9) < 0.5) ink(x + i, wy + 2, 0.4);
  }
  // the lake serpent: three coils breaking the water, a finned head, a curling tail
  function serpent(x0, wy) {
    const above = (x, y) => y < wy;
    const scales = (sh) => { sh.paper(); sh.tint(C.verd, 0.85); sh.hatch((x, y) => (x + y) % 2 === 0 && y > wy - 3, 0.55); sh.hatch((x, y) => (x * 3 + y * 2) % 7 === 0, 0.35); sh.line(1); };
    for (const [hx, r] of [[x0 + 8, 4], [x0 + 18, 5], [x0 + 28, 4.2]]) {
      const s = [];
      for (let a = Math.PI; a >= -0.01; a -= 0.06) s.push([hx + Math.cos(a) * r, wy - Math.sin(a) * r * 1.15 + 0.6, 1.8]);
      scales(shStamps(s, above));
      for (let a = 0.7; a < 2.5; a += 0.6) { const x = Math.round(hx + Math.cos(a) * (r + 2.4)), y = Math.round(wy - Math.sin(a) * (r * 1.15 + 2.6)); red(x, y, 0.9); red(x, y + 1, 0.9); }
      for (const dx of [-r - 3, r + 3]) { ink(Math.round(hx + dx), wy, 0.6); ink(Math.round(hx + dx + (dx < 0 ? -1 : 1)), wy, 0.6); }
    }
    // the head, rising and roaring
    const neck = spline([[x0 + 35, wy + 0.8], [x0 + 36.5, wy - 5], [x0 + 38.5, wy - 10], [x0 + 41.5, wy - 13]], 0.3).map(([x, y], i, a) => [x, y, 1.9 - (i / a.length) * 0.5]);
    scales(shStamps(neck, above));
    const head = shPoly([[x0 + 39, wy - 16], [x0 + 43, wy - 17], [x0 + 49, wy - 15], [x0 + 46, wy - 13.4], [x0 + 49, wy - 11], [x0 + 44, wy - 11.5], [x0 + 40, wy - 11]]);
    head.paper(); head.tint(C.verd, 0.85); head.hatch((x, y) => y > wy - 13 && (x + y) % 2 === 0, 0.45); head.line(1);
    put(x0 + 43, wy - 15, C.gold, 1); ink(x0 + 44, wy - 15, 1);
    red(x0 + 47, wy - 13); red(x0 + 48, wy - 13); red(x0 + 50, wy - 14); red(x0 + 50, wy - 12);
    for (const [x, y] of [[x0 + 39, wy - 17], [x0 + 38, wy - 18], [x0 + 41, wy - 18], [x0 + 37, wy - 14], [x0 + 36, wy - 15], [x0 + 36, wy - 10], [x0 + 35, wy - 11]]) red(x, y, 0.9);
    // the tail, curling out of the water
    const tail = spline([[x0 + 1, wy + 0.8], [x0 - 1, wy - 4], [x0 + 0.5, wy - 8], [x0 + 4, wy - 8.5], [x0 + 4.5, wy - 5.5]], 0.3).map(([x, y], i, a) => [x, y, 1.6 - (i / a.length) * 1.05]);
    scales(shStamps(tail, above));
    for (let k = 0; k < 3; k++) wave(x0 - 8 + k * 26, wy + 3 + (k % 2), 0.45);
  }
  function moonStatue(cx, wy) {
    const sh = new Shape(cx - 6, wy - 12, cx + 6, wy, (x, y) => { const dx = x + 0.5 - (cx + 0.5); return (y >= wy - 3 && Math.abs(dx) < 5.6 - (y - (wy - 3)) * -0.3) || Math.hypot(dx, y + 0.5 - (wy - 6.5)) < 3.2; });
    sh.paper(); sh.tint(C.moonst, 0.6); sh.hatch((x, y) => x > cx + 1 && (x + y) % 2 === 0, 0.55); sh.line(1);
    ink(cx - 1, wy - 7, 0.8); ink(cx + 1, wy - 7, 0.8);
    // the crescent crown
    for (const [x, y] of [[cx - 3, wy - 10], [cx - 3, wy - 11], [cx - 2, wy - 12], [cx + 3, wy - 10], [cx + 3, wy - 11], [cx + 2, wy - 12]]) ink(x, y, 1);
    glow(cx, wy - 10, C.moon);
    ripples(cx + 0.5, wy + 0.5, [7, 10], 0.5);
  }
  function islandShrine(cx, cy) {
    const isl = shEll(cx, cy, 7, 3, 0.4, 8); isl.paper(); isl.tint(C.glade, 0.6); isl.line(1);
    const post = shRect(cx - 1, cy - 7, 3, 6); post.paper(); post.tint(C.stone, 0.6); post.line(1);
    line(cx - 3, cy - 8, cx + 3, cy - 8, 1); line(cx - 2, cy - 9, cx + 2, cy - 9, 1);
    glow(cx, cy - 5, C.amber);
    tree(cx + 5, cy, 2.2, { col: C.glade });
    ripples(cx + 0.5, cy + 1.5, [10, 13], 0.4);
  }
  function boathouse(x, by) {
    house(x, by, 10, 5, 6, C.roofT, { wall: C.wood, timber: false, windows: [[7, 3]], door: 2, doorW: true });
    for (const px of [x, x + 4, x + 9]) { ink(px, by + 1, 1); ink(px, by + 2, 1); }
  }

  // ---------------------------------------------------------------- Whisperwood and the bog
  function treehouse(cx, by) {
    // the great trunk with roots
    for (let y = by - 12; y <= by; y++) { ink(cx - 2, y, 1); ink(cx + 2, y, 1); paper(cx - 1, y); paper(cx, y); paper(cx + 1, y); tint(cx - 1, y, C.wood, 0.7); tint(cx, y, C.wood, 0.7); ink(cx + 1, y, 0.5); }
    ink(cx - 3, by, 1); ink(cx - 4, by, 1); ink(cx + 3, by, 1); ink(cx + 4, by + 1, 1);
    // crown
    for (const [dx, dy, r] of [[-6, -17, 5], [6, -17, 5], [0, -21, 6.5], [-3, -14, 4], [4, -14, 4]]) {
      const c = new Shape(cx + dx - r - 1, by + dy - r - 1, cx + dx + r + 1, by + dy + r + 1, (x, y) => { const ddx = x + 0.5 - (cx + dx + 0.5), ddy = y + 0.5 - (by + dy), a = Math.atan2(ddy, ddx); return Math.hypot(ddx, ddy) < r * (0.9 + 0.13 * Math.abs(Math.sin(a * 3 + dx))); });
      c.paper(); c.tint(C.forest, 0.55); c.hatch((x, y) => (x - cx - dx) + (y - by - dy) > r * 0.3 && (x + y) % 2 === 0, 0.55); c.line(1);
    }
    // the house in the branches
    const pl = shRect(cx - 6, by - 13, 13, 2); pl.paper(); pl.tint(C.wood, 0.8); pl.line(1);
    house(cx - 4, by - 13, 8, 4, 5, C.roofM, { wall: C.wood, timber: false, windows: [[2, 2]], door: 5 });
    glow(cx - 7, by - 11, C.amber); glow(cx + 8, by - 10, C.amber);
    // ladder
    for (let y = by - 11; y <= by; y++) { ink(cx - 5, y, 0.9); ink(cx - 3, y, 0.9); if (y % 2 === 0) ink(cx - 4, y, 0.9); }
  }
  function fairyRing(cx, cy, lit) {
    const cl = shEll(cx, cy, 11, 6, 0.3, 4); cl.paper(); cl.tint(C.meadow, 0.55);
    if (lit) cl.each((x, y) => { if (hash(x, y, 71) < 0.07) glow(x, y, C.emerald); });
    const caps = [];
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + 0.2; caps.push([Math.round(cx + Math.cos(a) * 8), Math.round(cy + Math.sin(a) * 4)]); }
    caps.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of caps) {
      sprite(['.###.', '#rcr#', '.#o#.'], x - 2, y - 2, { r: (px, py) => (lit ? glow(px, py, C.emerald) : body(px, py, C.rose, 0.8)), c: (px, py) => (lit ? glow(px, py, C.candle) : body(px, py, C.cream, 1)) });
    }
  }
  function shrine(cx, by) {
    const cl = shEll(cx, by - 1, 6, 3, 0.3, 6); cl.paper(); cl.tint(C.meadow, 0.4);
    const st = shRect(cx - 1, by - 5, 3, 5); st.paper(); st.tint(C.stone, 0.6); st.line(1);
    line(cx - 2, by - 5, cx + 2, by - 5, 1);
    ink(cx - 1, by - 7, 1); ink(cx, by - 8, 1); ink(cx + 1, by - 8, 1); ink(cx + 1, by - 6, 0.6); glow(cx, by - 7, C.moon);
    tuft(cx - 4, by, 0.8); tuft(cx + 4, by, 0.8);
  }
  function witchHut(cx, by) {
    // stilts over the bog water
    for (const dx of [-6, -1, 5]) { line(cx + dx, by - 4, cx + dx, by, 1); }
    line(cx - 8, by - 4, cx + 7, by - 4, 1);
    const walls = shPoly([[cx - 6, by - 4], [cx + 5, by - 4], [cx + 6, by - 13], [cx - 5, by - 14]]);
    walls.paper(); walls.tint(C.wood, 0.85); walls.hatch((x) => (x - cx) % 2 === 0, 0.35); walls.hatch((x, y) => x >= cx + 4, 0.5); walls.line(1);
    const roof = shPoly([[cx - 9, by - 12], [cx + 8, by - 14], [cx + 3, by - 20], [cx + 2, by - 25], [cx + 5, by - 29], [cx + 7, by - 28], [cx + 4, by - 26], [cx + 4, by - 21], [cx + 8, by - 16]]);
    roof.paper(); roof.tint(C.roofP, 0.85); roof.hatch((x, y) => (x + y) % 2 === 0 && x > cx + 1, 0.6); roof.hatch((x, y) => y % 3 === 0 && (x + y) % 5 === 0, 0.4); roof.line(1);
    // round green window and crooked door
    for (const [x, y] of [[cx - 3, by - 10], [cx - 2, by - 10], [cx - 3, by - 9], [cx - 2, by - 9]]) glow(x, y, C.emerald);
    ink(cx - 4, by - 10, 1); ink(cx - 1, by - 10, 1); ink(cx - 3, by - 11, 1); ink(cx - 2, by - 8, 1);
    for (let y = by - 8; y < by - 4; y++) { ink(cx + 2, y, 1); ink(cx + 3, y, 1); }
    // crooked chimney with witch-green smoke
    const ch = shPoly([[cx - 6, by - 14], [cx - 4, by - 14], [cx - 5, by - 19], [cx - 7, by - 19]]); ch.paper(); ch.tint(C.stone, 0.5); ch.line(1);
    smoke(cx - 6, by - 22, 4, -1, C.emerald);
    // the cauldron out front, bubbling
    const pot = shEll(cx + 11, by - 1, 2.6, 1.8); pot.each((x, y) => ink(x, y, 1)); ink(cx + 8, by + 1, 1); ink(cx + 14, by + 1, 1);
    glow(cx + 10, by - 3, C.emerald); glow(cx + 12, by - 4, C.emerald); glow(cx + 11, by - 6, C.emerald);
    // a lantern on a crooked pole
    line(cx - 11, by, cx - 12, by - 8, 1); ink(cx - 11, by - 8, 1); glow(cx - 10, by - 7, C.emerald);
  }

  // ---------------------------------------------------------------- the Deepwood
  function standingStones(cx, cy) {
    const cl = shEll(cx, cy, 15, 7, 0.3, 12); cl.paper(); cl.tint(C.meadow, 0.45);
    ellipsePix(cx, cy + 1, 11, 4.6, (x, y) => { if ((x + y) % 3 === 0) ink(x, y, 0.3); });
    const st = [];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; st.push([Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 4.6)]); }
    st.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of st) {
      const hgt = 6 + ((hash(x, y, 2) * 3) | 0) - (y < cy ? 1 : 0);
      const s = shPoly([[x - 1.5, y + 0.5], [x + 2.5, y + 0.5], [x + 2.2, y - hgt + 1], [x + 1, y - hgt], [x - 1.2, y - hgt + 0.5]]);
      s.paper(); s.tint(C.stone, 0.62); s.hatch((px) => px >= x + 1, 0.6); s.line(1);
    }
  }
  function watchtower(cx, by) {
    const t = shPoly([[cx - 5, by], [cx + 5, by], [cx + 4.5, by - 15], [cx + 3, by - 18], [cx + 1, by - 16], [cx - 1, by - 21], [cx - 3, by - 19], [cx - 4.5, by - 20]]);
    t.paper(); t.tint(C.stone, 0.55); t.hatch((x, y) => x >= cx + 2 && (x + y) % 2 === 0, 0.55); t.hatch((x, y) => (by - y) % 3 === 0 && (x + Math.floor((by - y) / 3) * 2) % 4 !== 0, 0.3); t.line(1);
    for (let y = by - 13; y < by - 9; y++) body(cx - 1, y, C.cave, 1);
    sprite(SPR.owl, cx - 2, by - 13);
    const door = shRect(cx - 1, by - 4, 3, 4); door.each((x, y) => body(x, y, C.cave, 1));
    for (let k = 0; k < 14; k++) tint(cx - 4 + (hash(k, 1, 3) * 9 | 0), by - 2 - (hash(k, 2, 3) * 15 | 0), C.forest, 1);
    for (const [x, y] of [[cx - 8, by], [cx + 7, by], [cx + 9, by - 1]]) { ink(x, y, 0.9); ink(x + 1, y, 0.7); }
  }
  function elderTree(cx, by) {
    // roots and a massive gnarled trunk
    const trunk = shPoly([[cx - 9, by + 1], [cx - 5, by - 2], [cx - 3, by - 12], [cx - 5, by - 18], [cx + 5, by - 18], [cx + 3, by - 12], [cx + 5, by - 2], [cx + 10, by + 1]]);
    trunk.paper(); trunk.tint(C.wood, 0.75); trunk.hatch((x, y) => x > cx + 1 && (x + y) % 2 === 0, 0.6); trunk.hatch((x, y) => (x - cx + 20) % 3 === 0 && hash(x, y, 4) < 0.5, 0.35); trunk.line(1, 'b');
    line(cx - 12, by + 2, cx - 7, by, 1); line(cx + 8, by, cx + 13, by + 2, 1);
    body(cx, by - 8, C.cave, 1); body(cx, by - 7, C.cave, 1); body(cx + 1, by - 7, C.cave, 1);
    // a vast crown of lobes
    const lobes = [[-13, -24, 7], [13, -24, 7], [-7, -31, 8], [7, -31, 8], [0, -36, 8], [-16, -18, 5], [16, -18, 5], [0, -24, 8]];
    for (const [dx, dy, r] of lobes) {
      const c = new Shape(cx + dx - r - 1, by + dy - r - 1, cx + dx + r + 1, by + dy + r + 1, (x, y) => { const ddx = x + 0.5 - (cx + dx + 0.5), ddy = y + 0.5 - (by + dy), a = Math.atan2(ddy, ddx); return Math.hypot(ddx, ddy * 1.05) < r * (0.88 + 0.14 * Math.abs(Math.sin(a * 3.5 + dx))); });
      c.paper(); c.tint(C.deep, 0.7); c.tint(C.forest, 0.35); c.hatch((x, y) => (x - cx - dx) + (y - by - dy) * 1.2 > r * 0.1 && (x + y) % 2 === 0, 0.6); c.hatch((x, y) => (x - cx - dx) + (y - by - dy) * 1.2 > r * 0.75, 0.3); c.line(1);
    }
    for (const [x, y] of [[cx - 18, by - 30], [cx + 19, by - 28], [cx - 6, by - 42], [cx + 10, by - 40], [cx - 21, by - 14], [cx + 22, by - 13], [cx + 3, by - 15]]) glow(x, y, C.gold);
  }
  function web(cx, cy, r, a) {
    for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; line(cx, cy, cx + Math.cos(t) * r, cy + Math.sin(t) * r, a); }
    for (let rr = 2; rr < r; rr += 2.2) { let prev = null; for (let k = 0; k <= 8; k++) { const t = (k / 8) * Math.PI * 2, p = [cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]; if (prev) line(prev[0], prev[1], p[0], p[1], a * 0.8); prev = p; } }
  }
  function spider(cx, cy, eyes) {
    line(cx, cy - 16, cx, cy - 3, 0.6);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const bx = cx + 0.5 + s * 1.2, by = cy - 1.2 + k * 1.1, kx = cx + 0.5 + s * (3.6 + k * 0.6), ky = cy - 3.8 + k * 1.7, fx = cx + 0.5 + s * (5.2 + k * 0.3), fy = cy + 0.6 + k * 2.1;
      line(bx, by, kx, ky, 0.95); line(kx, ky, fx, fy, 0.95);
    }
    shEll(cx + 0.5, cy + 2.6, 2.7, 3.1).each((x, y) => ink(x, y, 0.95));
    shEll(cx + 0.5, cy - 1.4, 1.7, 1.5).each((x, y) => ink(x, y, 0.95));
    lighten(cx, cy + 2, 0.55); lighten(cx + 1, cy + 3, 0.55); lighten(cx, cy + 4, 0.4);
    if (eyes) { glow(cx, cy - 2, C.rose); glow(cx + 1, cy - 2, C.rose); }
  }
  function hollows(cx, cy, visited) {
    const cl = shEll(cx, cy, 23, 12, 0.6, 31); cl.paper(); cl.tint(C.deepV, 0.55); cl.tint(C.deep, 0.4);
    for (const [fx, fy, fw] of [[cx - 16, cy + 6, 14], [cx + 4, cy - 8, 12], [cx - 4, cy + 11, 18]]) for (let x = fx; x < fx + fw; x++) { lighten(x, fy, 0.45); if (hash(x, fy, 3) < 0.5) lighten(x, fy + 1, 0.25); }
    for (const [x, y, h, s] of [[cx - 19, cy + 9, 22, 3], [cx + 19, cy + 9, 22, 8], [cx - 9, cy - 3, 13, 5], [cx + 11, cy - 4, 12, 11]]) deadTree(x, y, h, s, 1);
    // a giant web strung between the dead trees, pale as moonlit silk
    const wx = cx + 1, wy = cy + 1, R = 10;
    for (let k = 0; k < 10; k++) { const t = (k / 10) * Math.PI * 2 + 0.15; plot(wx, wy, wx + Math.cos(t) * R, wy + Math.sin(t) * R * 0.85, (x, y) => lighten(x, y, 0.75)); }
    for (let rr = 2.5; rr < R; rr += 2.3) { let prev = null; for (let k = 0; k <= 10; k++) { const t = (k / 10) * Math.PI * 2 + 0.15, p = [wx + Math.cos(t) * rr, wy + Math.sin(t) * rr * 0.85]; if (prev) plot(prev[0], prev[1], p[0], p[1], (x, y) => lighten(x, y, 0.6)); prev = p; } }
    spider(wx, wy - 1, visited);
    web(cx - 15, cy - 6, 5, 0.55);
    if (visited) for (const [x, y] of [[cx - 21, cy - 2], [cx + 21, cy + 3], [cx - 11, cy + 8]]) { glow(x, y, C.violet); glow(x + 2, y, C.violet); }
    sprite(['.###.', '#O#O#', '.###.', '.#.#.'], cx - 17, cy + 10);
    line(cx + 12, cy + 12, cx + 16, cy + 11, 0.8); ink(cx + 12, cy + 11, 0.8); ink(cx + 16, cy + 12, 0.8);
  }

  // ---------------------------------------------------------------- Hushwillow Glade
  function bondingStone(cx, by) {
    const ring = shEll(cx, by, 8, 3.5, 0.3, 5); ring.paper(); ring.tint(C.meadow, 0.5);
    ellipsePix(cx, by, 7, 3, (x, y) => { if ((x + y) % 2 === 0) ink(x, y, 0.55); });
    const s = shPoly([[cx - 2.5, by + 0.5], [cx + 3.5, by + 0.5], [cx + 3, by - 8], [cx + 1, by - 11], [cx - 2, by - 9]]);
    s.paper(); s.tint(C.stone, 0.55); s.hatch((x) => x >= cx + 2, 0.5); s.line(1);
    for (const [x, y] of [[cx, by - 7], [cx + 1, by - 6], [cx, by - 5], [cx + 1, by - 4], [cx, by - 3]]) glow(x, y, C.emerald);
  }
  function glade(v) {
    const pondS = shEll(339, 224, 11, 5, 0.3, 9);
    waterBody(pondS, { lines: false });
    ellipsePix(339, 224, 8, 3, (x, y) => { if (noise(x / 2, y / 2, 4) > 0.45) ink(x, y, 0.35); });
    for (const [x, y] of [[333, 223], [343, 225], [338, 221], [346, 222]]) lilyPad(x, y);
    // willows, back to front
    for (const [x, y, r] of [[318, 194, 6], [362, 196, 6], [298, 206, 5], [378, 222, 5], [300, 238, 5], [366, 241, 5]].sort((a, b) => a[1] - b[1])) willow(x, y, r);
    bondingStone(348, 207);
    // the sleeping fox, curled in the grass
    sprite(SPR.fox, 311, 222, { f: (x, y) => body(x, y, C.fox, 1), F: (x, y) => body(x, y, C.foxD, 1), c: (x, y) => body(x, y, C.cream, 1) });
    if (v) { ink(325, 219, 0.6); ink(326, 219, 0.6); ink(325, 220, 0.6); ink(326, 221, 0.6); ink(327, 217, 0.5); ink(328, 216, 0.5); ink(327, 216, 0.5); ink(328, 217, 0.5); }
    // flowers and fireflies
    for (let k = 0; k < 26; k++) {
      const x = 290 + Math.floor(hash(k, 5, 6) * 88), y = 200 + Math.floor(hash(k, 6, 6) * 42);
      if (!inBlobs([[334, 216, 46, 26]], x, y, 13, 0.5) || pondS.at(x, y)) continue;
      body(x, y, [C.rose, C.violet, C.cream, C.gold][k % 4], 1);
    }
    for (const [x, y] of [[326, 206], [352, 216], [309, 214], [372, 230], [330, 236]]) glow(x, y, C.gold);
  }
  function tunnel(cx, cy) {
    const mound = shEll(cx, cy, 8, 6, 0.4, 3, (x, y) => y <= cy + 1); mound.paper(); mound.tint(C.roofM, 0.75); mound.hatch((x, y) => (x + y) % 2 === 0 && x > cx, 0.5); mound.line(1, 'b');
    const op = shEll(cx, cy + 1, 3.2, 4.2, 0, 0, (x, y) => y <= cy + 1); op.each((x, y) => body(x, y, C.cave, 1));
    for (let x = cx - 8; x <= cx + 8; x += 3) ink(x, cy - 5 + Math.round(Math.abs(x - cx) * 0.5), 0.6);
  }

  // ================================================================== flourishes
  // a compass rose: degree ring, sixteen kite points (dark and lit halves), a fleur-de-lis for north
  function compass(cx, cy, R) {
    const ox = cx + 0.5, oy = cy + 0.5;
    const disc = shEll(ox, oy, R + 5, R + 5); disc.paper(); disc.each((x, y) => lighten(x, y, 0.3));
    ellipsePix(ox, oy, R + 4.5, R + 4.5, (x, y) => ink(x, y, 1));
    ellipsePix(ox, oy, R + 2, R + 2, (x, y) => ink(x, y, 0.9));
    ellipsePix(ox, oy, R + 3.25, R + 3.25, (x, y, a) => { if (Math.floor(((a + 7 * Math.PI) % (2 * Math.PI)) / (Math.PI / 16)) % 2 === 0) ink(x, y, 0.85); });
    ellipsePix(ox, oy, R * 0.52, R * 0.52, (x, y) => ink(x, y, 0.35));
    const pt = (k, len, hw) => {
      const ang = (k / 16) * Math.PI * 2, ux = Math.sin(ang), uy = -Math.cos(ang), vx = -uy, vy = ux, f = hw * 0.55;
      const tip = [ox + ux * len, oy + uy * len], l = [ox - vx * hw + ux * f, oy - vy * hw + uy * f], r = [ox + vx * hw + ux * f, oy + vy * hw + uy * f];
      const B = shPoly([[ox, oy], r, tip]); B.paper(); B.each((x, y) => lighten(x, y, 0.75)); B.line(0.85);
      shPoly([[ox, oy], tip, l]).each((x, y) => (k === 0 ? red(x, y, 1) : ink(x, y, 0.92)));
    };
    for (let k = 1; k < 16; k += 2) pt(k, R * 0.52, 1.7);
    for (let k = 2; k < 16; k += 4) pt(k, R * 0.74, 2.7);
    for (let k = 0; k < 16; k += 4) pt(k, R, 3.7);
    const hub = shEll(ox, oy, 1.7, 1.7); hub.each((x, y) => put(x, y, C.gold, 1)); hub.line(1);
    sprite(SPR.fleur, cx - 5, cy - R - 16, { r: (x, y) => red(x, y, 0.95) });
  }
  // a ribbon banner: the band bows upward, the swallow-tailed ends fold back behind it
  function ribbon(x0, y0, w) {
    const bh = 15, ty = y0 + 6, arc = (x) => -2.6 * Math.sin(Math.PI * clamp((x - x0) / w, 0, 1));
    for (const dir of [-1, 1]) {
      const ex = dir < 0 ? x0 : x0 + w, out = ex + dir * 19;
      const tail = shPoly([[ex, ty], [out, ty], [out - dir * 5, ty + bh / 2], [out, ty + bh], [ex, ty + bh]]);
      tail.paper(); tail.each((x, y) => lighten(x, y, 0.25)); tail.tint(C.mtn, 0.4); tail.hatch((x, y) => (x + y) % 2 === 0, 0.28); tail.line(1);
      line(ex + dir * 2, ty + 3, out - dir * 3, ty + 3, 0.45); line(ex + dir * 2, ty + bh - 3, out - dir * 3, ty + bh - 3, 0.45);
      const fold = shPoly([[ex, y0 + bh - 1], [ex - dir * 6, ty + bh], [ex, ty + bh]]);
      fold.each((x, y) => ink(x, y, 0.82)); fold.line(1);
    }
    const band = new Shape(x0, y0 - 4, x0 + w, y0 + bh + 2, (x, y) => { const o = arc(x + 0.5); return y + 0.5 >= y0 + o && y + 0.5 < y0 + o + bh; });
    band.paper(); band.each((x, y) => lighten(x, y, 0.55)); band.tint(C.mtn, 0.12);
    band.each((x, y) => { const o = Math.round(arc(x + 0.5)); if (y === y0 + o + 2 || y === y0 + o + bh - 3) ink(x, y, 0.42); else if (y >= y0 + o + bh - 2) ink(x, y, 0.18); });
    band.line(1);
  }
  // a dragon in silhouette, bat wings spread, breathing a little red fire along the margin
  function dragon(x, y, s) {
    const T = ([px, py]) => [x + px * s, y + py];
    const P = (pts) => shPoly(pts.map(T));
    const far = P([[0, -1], [4, -9], [-1, -14], [-3, -10], [-8, -11], [-7, -6], [-11, -5], [-6, -1]]);
    far.each((px, py) => ink(px, py, 0.42)); far.line(0.7);
    const spine = spline([[-21, 6], [-17, 8], [-12, 7], [-8, 4], [-3, 1.5], [2, 0.5], [6, -2], [9, -5], [11, -8], [13, -9.5]].map(T), 0.25);
    const rad = (i) => { const t = i / (spine.length - 1); return t < 0.38 ? 0.45 + t * 4.6 : t < 0.66 ? 2.3 : t < 0.86 ? 1.3 : 1.5; };
    shStamps(spine.map(([px, py], i) => [px, py, rad(i)])).each((px, py) => ink(px, py, 0.95));
    P([[12, -11.5], [16, -11.5], [20.5, -9.5], [16.5, -8], [20, -7], [15, -6.5], [12, -7]]).each((px, py) => ink(px, py, 0.95));
    const near = P([[1, -1], [6, -11], [0, -19], [-1, -14], [-7, -16], [-6, -10], [-13, -10], [-8, -5], [-4, 0.5]]);
    near.each((px, py) => ink(px, py, 0.66)); near.line(1);
    for (const tip of [[0, -19], [-7, -16], [-13, -10]]) { const p = T([6, -11]), q = T(tip); line(p[0], p[1], q[0], q[1], 1); }
    { const p = T([1, -1]), q = T([6, -11]); line(p[0], p[1], q[0], q[1], 1); line(p[0] + s, p[1], q[0] + s, q[1], 1); }
    P([[-21, 6], [-25, 3.5], [-24, 7], [-26.5, 10], [-21, 8]]).each((px, py) => ink(px, py, 0.95));
    for (const [a, b] of [[[13, -11], [11, -14]], [[15, -11], [15, -14]], [[-6, 5], [-7, 8]], [[-7, 8], [-9, 8]], [[3, 2], [4, 5]], [[4, 5], [2, 5]], [[-1, 1], [-3, 4]]]) { const p = T(a), q = T(b); line(p[0], p[1], q[0], q[1], 0.95); }
    for (let k = -14; k <= 2; k += 3) { const p = T([k, k < -8 ? 5.5 : k < -2 ? 1.5 : -0.8]); ink(p[0], p[1] - 2, 0.9); }
    const e = T([16, -10]); red(e[0], e[1], 1);
    for (const [px, py, a] of [[21, -8, 0.95], [22, -9, 0.9], [22, -7, 0.85], [23, -8, 0.9], [24, -9, 0.7], [24, -6, 0.6], [25, -8, 0.7], [26, -10, 0.45], [27, -7, 0.45], [28, -9, 0.3]]) { const p = T([px, py]); red(p[0], p[1], a); }
  }
  function cloud(cx, cy, w) {
    const bumps = [];
    for (let i = 0; i <= w; i += 4) bumps.push([cx - w / 2 + i, cy - Math.sin((i / w) * Math.PI) * 3 - 1.5, 3 + Math.sin((i / w) * Math.PI) * 1.8]);
    const sh = shStamps(bumps.concat([[cx, cy + 0.5, 2.5], [cx - w / 3, cy + 0.5, 2.5], [cx + w / 3, cy + 0.5, 2.5]]), (x, y) => y <= cy + 2);
    sh.paper(); sh.each((x, y) => lighten(x, y, 0.35)); sh.line(0.85);
    for (let i = 2; i < w - 2; i += 6) { const x = Math.round(cx - w / 2 + i), y = Math.round(cy - 1); ink(x, y, 0.4); ink(x + 1, y - 1, 0.4); ink(x + 2, y - 1, 0.4); }
  }
  function border() {
    const o = 9, i = 13, X1 = W - 1 - o, Y1 = H - 1 - o, IX = W - 1 - i, IY = H - 1 - i;
    for (let y = o; y <= Y1; y++) for (let x = o; x <= X1; x++) {
      if (x > i && x < IX && y > i && y < IY) continue;
      const outer = x === o || y === o || x === X1 || y === Y1;
      const inner = ((x === i || x === IX) && y >= i && y <= IY) || ((y === i || y === IY) && x >= i && x <= IX);
      if (outer || inner) { ink(x, y, 1); continue; }
      paper(x, y); lighten(x, y, 0.35);
      const horiz = y < i || y > IY, lane = horiz ? y === o + 2 || y === Y1 - 2 : x === o + 2 || x === X1 - 2;
      if (lane && Math.floor(((horiz ? x : y) - o) / 10) % 2 === 0) ink(x, y, 0.85);
    }
    const CORNER = ['###########', '#ooooooooo#', '#oooo#oooo#', '#ooo#r#ooo#', '#oo#rrr#oo#', '#o#rrOrr#o#', '#oo#rrr#oo#', '#ooo#r#ooo#', '#oooo#oooo#', '#ooooooooo#', '###########'];
    for (const [x, y] of [[6, 6], [W - 17, 6], [6, H - 17], [W - 17, H - 17]]) sprite(CORNER, x, y, { r: (px, py) => red(px, py, 0.9) });
    for (const [x, y] of [[W / 2 - 3, o - 1], [W / 2 - 3, Y1 - 3], [o - 1, H / 2 - 3], [X1 - 3, H / 2 - 3]]) sprite(['...#...', '..#r#..', '.#rOr#.', '..#r#..', '...#...'], x, y, { r: (px, py) => red(px, py, 0.85) });
  }
  function coffeeRing(cx, cy, r) {
    for (let y = cy - r - 3; y <= cy + r + 3; y++) for (let x = cx - r - 3; x <= cx + r + 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const a = Math.atan2(y - cy, x - cx), rr = r + (noise(a * 2.2 + 5, 1, 9) - 0.5) * 2.4, d = Math.hypot(x - cx, y - cy);
      const t = Math.abs(d - rr);
      let al = 0;
      if (t < 1.5) al = 0.5 * (1 - t / 1.5) * (0.45 + 0.55 * Math.max(0, Math.cos(a - 0.9)));
      if (d < rr - 1) al += 0.05 + 0.04 * noise(x / 4, y / 4, 3);
      if (al > 0) mulInto(buf, x, y, C.coffee, al);
    }
  }
  function fullMoonDoodle(cx, cy) {
    const m = shEll(cx + 0.5, cy + 0.5, 4.6, 4.6); m.paper(); m.each((x, y) => lighten(x, y, 0.75)); m.tint(C.moonst, 0.45); m.line(1);
    ink(cx - 2, cy - 1, 0.45); ink(cx + 1, cy + 2, 0.45); ink(cx + 2, cy - 2, 0.35); ink(cx - 1, cy + 2, 0.3);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; line(cx + 0.5 + Math.cos(a) * 6.5, cy + 0.5 + Math.sin(a) * 6.5, cx + 0.5 + Math.cos(a) * (k % 2 ? 7.5 : 8.5), cy + 0.5 + Math.sin(a) * (k % 2 ? 7.5 : 8.5), 0.7); }
  }

  // ================================================================== post: creases, burns, night
  function edgeDist(x, y) {
    const d = Math.min(x, y, W - 1 - x, H - 1 - y);
    let e = d - 2.2 + (fbm(x / 6, y / 6, 91, 3) - 0.5) * 6.5 + (noise(x / 1.4, y / 1.4, 92) - 0.5) * 1.6;
    const cx = Math.min(x, W - 1 - x), cy = Math.min(y, H - 1 - y);
    if (cx < 16 && cy < 16) e -= Math.max(0, 7 - Math.hypot(cx, cy) * 0.35) * 0.9;
    for (const [nx, ny, len] of [[236, 0, 9], [0, 168, 8], [W - 1, 74, 7], [96, H - 1, 8], [318, H - 1, 6]]) {
      const along = ny === 0 || ny === H - 1 ? Math.abs(x - nx) : Math.abs(y - ny);
      if (along < 4) e -= Math.max(0, len * (1 - along / 4));
    }
    return e;
  }
  function post(night) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      let c = [buf[i], buf[i + 1], buf[i + 2]];
      // fold creases: a bright ridge, a soft shadow, worn at the crossings
      for (const fx of [133, 266]) {
        const dx = x - fx, wv = 0.6 + 0.4 * noise(y / 9, fx, 93);
        if (dx === 0) c = mixc(c, C.pHi, 0.3 * wv); else if (dx === 1) c = mixc(c, C.pDark, 0.32 * wv); else if (dx > 1 && dx < 7) c = mixc(c, C.pDark, 0.05 * (1 - dx / 7));
      }
      { const dy = y - 130, wv = 0.6 + 0.4 * noise(x / 9, 7, 94);
        if (dy === 0) c = mixc(c, C.pHi, 0.3 * wv); else if (dy === 1) c = mixc(c, C.pDark, 0.32 * wv); else if (dy > 1 && dy < 7) c = mixc(c, C.pDark, 0.05 * (1 - dy / 7)); }
      // vignette toward a lilac-brown
      const vx = (x - W / 2) / (W / 2), vy = (y - H / 2) / (H / 2), v = sstep(0.45, 1.75, vx * vx * 0.85 + vy * vy);
      c = mixc(c, mixc(c, C.burn, 0.55), v * 0.5);
      // burnt, torn edges
      const e = edgeDist(x, y);
      if (e < 0) { const sh = e > -2.5 ? 0.55 : 0; c = mixc(mixc(C.desk, [30, 22, 44], noise(x / 3, y / 3, 95) * 0.6), [8, 5, 12], sh); }
      else if (e < 1.3) c = mixc(C.char, c, 0.12);
      else if (e < 6.5) { const t = (e - 1.3) / 5.2; c = mixc(c, t < 0.4 ? mixc(C.char, C.burn, t / 0.4) : C.burn, Math.pow(1 - t, 1.6) * 0.92); }
      if (night) c = [c[0] * 0.8, c[1] * 0.84, Math.min(255, c[2] * 1.02 + 6)];
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
    for (const [x, y, c] of GLOWS) {
      if (edgeDist(x, y) < 1.3) continue;
      const i = (y * W + x) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
      if (night) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = (yy * W + xx) * 3; buf[j] += (c[0] - buf[j]) * 0.25; buf[j + 1] += (c[1] - buf[j + 1]) * 0.25; buf[j + 2] += (c[2] - buf[j + 2]) * 0.25; }
    }
  }

  // ================================================================== the whole map
  const COMPASS = [354, 47, 19];
  const WOODS = [[196, 194, 56, 26], [226, 182, 26, 14], [168, 206, 26, 16], [216, 212, 30, 12]];
  const DEEP = [[76, 206, 60, 38], [40, 228, 30, 20], [112, 196, 26, 22]];
  const GLADE = [[334, 214, 50, 32]];
  const RIDGE_P = [[196, 72, 100, 16], [150, 70, 40, 12], [296, 70, 40, 12]];

  const ROUTES = {
    westRoad: [[94, 141], [112, 137], [128, 132], [148, 129], [171, 129]],
    eastRoad: [[201, 129], [222, 130], [238, 129], [250, 129], [264, 132], [280, 137], [288, 140]],
    stairs: [[186, 121], [186, 108], [186, 99], [186, 88], [190, 80], [197, 75]],
    southRoad: [[186, 138], [186, 152], [186, 166], [183, 178], [178, 190], [182, 203], [192, 214], [197, 226]],
    deepPath: [[178, 193], [160, 205], [146, 206], [132, 203], [118, 208], [102, 214]],
    gladePath: [[192, 214], [212, 210], [235, 207], [256, 207], [261, 208]],
    gladePath2: [[271, 208], [286, 210], [302, 214], [318, 216]],
  };
  const ROUTE_PTS = {};
  for (const k in ROUTES) ROUTE_PTS[k] = spline(ROUTES[k], 1.5);
  function near(pts, x, y, d) { for (const p of pts) if (Math.abs(p[0] - x) < d && Math.abs(p[1] - y) < d && Math.hypot(p[0] - x, p[1] - y) < d) return true; return false; }

  let FULL = false;
  function paintArt(opt) {
    VIS = opt.vis; GLOWS = []; FULL = !!opt.fullMoon;
    makeParchment();
    const vw = (id, s) => (VIS[id] ? s : s * 0.35);
    // watercolour washes under the ink
    wash([[204, 56, 126, 22], [318, 58, 22, 14]], C.mtn, vw('ridge', 0.3), 101);
    wash(RIDGE_P, C.forest, vw('ridge', 0.22), 102);
    wash([[70, 132, 52, 32], [60, 88, 44, 14]], C.meadow, vw('sanctum', 0.4), 103);
    wash([[186, 130, 46, 26]], C.warm, vw('village', 0.36), 104);
    wash([[150, 104, 30, 8], [226, 102, 22, 8]], C.meadow, vw('village', 0.22), 108);
    wash(WOODS, C.forest, vw('woods', 0.5), 105);
    wash([[204, 236, 52, 11]], C.bog, vw('woods', 0.5), 106);
    wash(DEEP, C.deep, vw('deepwood', 0.5), 107);
    wash([[40, 230, 26, 15]], C.deepV, vw('deepwood', 0.5), 109);
    wash(GLADE, C.glade, vw('glade', 0.45), 110);
    wash([[334, 141, 54, 34]], C.meadow, vw('lake', 0.28), 111);
    buf = new Float32Array(bg);
    CLIP = [14, 14, W - 15, H - 15];

    // rhumb lines from the compass rose, faint, under everything
    const [CX, CY, CR] = COMPASS;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, x1 = CX + Math.sin(a) * 600, y1 = CY - Math.cos(a) * 600;
      plot(CX + Math.sin(a) * 27, CY - Math.cos(a) * 27, x1, y1, (x, y) => { if (inClip(x, y)) put(x, y, k % 2 ? C.red : C.ink, k % 4 === 0 ? 0.13 : 0.09); });
    }

    // ---------------- the north: mountains, the plateau, the cliff
    region('ridge', () => {
      // back to front: a faint high range, then darker, nearer peaks
      const peaks = [
        [168, 20, 34, 30, 26, 1, 1, 0.22, 0.55], [222, 15, 40, 32, 30, 2, 1, 0.22, 0.55], [288, 19, 36, 30, 28, 3, 1, 0.22, 0.55],
        [138, 33, 26, 22, 20, 4, 0, 0.3, 0.7], [196, 29, 30, 26, 22, 5, 1, 0.3, 0.7], [254, 31, 28, 22, 24, 6, 0, 0.3, 0.7], [312, 36, 22, 20, 12, 7, 0, 0.3, 0.7],
        [120, 47, 15, 13, 12, 8, 0, 0.36, 0.8], [160, 45, 17, 15, 14, 9, 0, 0.36, 0.8], [226, 47, 15, 14, 12, 10, 0, 0.36, 0.8], [290, 45, 17, 15, 15, 11, 0, 0.36, 0.8],
      ];
      for (const [x, y, h, wl, wr, s, snow, ta, ha] of peaks) mountain(x, y, h, wl, wr, s, { snow, ta, ha });
      observatory(262, 52);
      // the stream tumbling down from the peaks
      river([[322, 18], [317, 30], [308, 44], [294, 57], [278, 69], [264, 79], [253, 86], [250, 90]], 1.8, 2.8, 4);
      for (const [x, y] of [[316, 31], [300, 51]]) { for (let k = 0; k < 3; k++) { lighten(x + k - 1, y, 0.9); lighten(x + k - 1, y + 1, 0.7); } ink(x - 2, y + 2, 0.5); ink(x + 2, y + 2, 0.5); }
      // pines on the plateau, avoiding the buildings
      const busy = (x, y) => (x > 117 && x < 140 && y > 60 && y < 82) || (x > 145 && x < 168 && y > 64 && y < 84) || (x > 180 && x < 220 && y > 52 && y < 84) || (x > 222 && x < 262 && y > 54 && y < 84) || (x > 244 && x < 280 && y > 34 && y < 60) || Math.abs(x - 186) < 5 || (y > 62 && Math.abs(x - (322 - (y - 18) * 0.95)) < 6);
      forest(RIDGE_P, { seed: 21, sx: 8, sy: 6, avoid: busy, draw: (x, y, k) => pine(x, y, 6 + Math.round(k * 4), { col: C.forest }) });
      forge(128, 78); lodge(157, 81);
      cemetery(226, 68, 26, 12); chapel(229, 68);
      footpath([[187, 86], [192, 78], [197, 72]], 0.6); footpath([[190, 80], [172, 81], [163, 82]], 0.55); footpath([[150, 82], [138, 80]], 0.55); footpath([[196, 80], [216, 80], [226, 80]], 0.55); footpath([[250, 70], [258, 62], [262, 56]], 0.55);
    });
    region('depths', (v) => caveMouth(201, 72, v));
    region('village', () => {
      // the cliff below the ridge, with the stairs and the waterfall
      cliff(98, 336, 86);
      for (let y = 85; y <= 99; y++) { for (let x = 183; x <= 189; x++) { paper(x, y); tint(x, y, C.stone, 0.4); } ink(182, y, 1); ink(190, y, 1); if (y % 2 === 0) line(183, y, 189, y, 0.85); else { ink(183 + ((y >> 1) % 2) * 5, y, 0.5); } }
      for (let y = 86; y <= 100; y++) for (let x = 248; x <= 252; x++) { paper(x, y); lighten(x, y, 0.55); if ((x * 2 + y * 3) % 5 === 0) ink(x, y, 0.32); else tint(x, y, C.water, 0.4); }
      for (const [x, y] of [[246, 101], [254, 101], [245, 100], [255, 100], [250, 102], [247, 102], [253, 102]]) ink(x, y, 0.5);
      // the river along the east side of the village
      river([[251, 98], [248, 108], [245, 119], [244, 131], [242, 145], [240, 160]], 3.6, 4.2, 9);
      // the bridge on the east road
      const br = shRect(239, 127, 10, 4); br.paper(); br.tint(C.wood, 0.7); br.line(1); for (let x = 240; x < 248; x += 2) ink(x, 129, 0.5);
      line(238, 126, 249, 126, 0.8); line(238, 131, 249, 131, 0.8);
      village();
    });

    // ---------------- the west: the Verdant Sanctum
    region('sanctum', () => {
      forest([[60, 84, 48, 13], [22, 120, 9, 26]], { seed: 31, sx: 7, sy: 5, avoid: (x, y) => y > 92 && x > 34, draw: (x, y, k) => (k < 0.5 ? pine(x, y, 6 + Math.round(k * 6)) : tree(x, y, 2.5 + k)) });
      for (const [x, y] of [[100, 106], [116, 118], [44, 118], [30, 132], [118, 150], [96, 158], [52, 156], [108, 128], [24, 154]]) tuft(x, y, 0.6);
      pond(106, 106, 6, 3, true); pond(26, 153, 6, 3, true);
      temple(72, 124);
      walledGarden(53, 131, 39, 18);
      house(27, 147, 10, 6, 6, C.roofM, { lean: 1, chimney: 7, windows: [[2, 3]], door: 6 });
      sprite(SPR.cat, 38, 144);
      tree(19, 140, 3); tree(44, 136, 3, { col: C.roofP, ta: 0.4 }); tree(101, 140, 3); tree(118, 152, 3.5); tree(40, 153, 2.6);
      bushes(98, 126, 1); bushes(46, 150, 1);
    });

    // ---------------- the east: Glimmermere
    region('lake', () => {
      const lk = lake(334, 141, 45, 27);
      boathouse(289, 125);
      const dock = shRect(287, 139, 14, 2); dock.paper(); dock.tint(C.wood, 0.8); dock.line(1);
      const t = shRect(300, 135, 3, 10); t.paper(); t.tint(C.wood, 0.8); t.line(1);
      boat(306, 146);
      moonStatue(354, 128);
      islandShrine(362, 157);
      sailboat(330, 126);
      serpent(312, 156);
      ripples(305, 147, [5], 0.4);
      for (const [x, y] of [[292, 117], [298, 162], [372, 124], [376, 150], [320, 168], [348, 113]]) if (!lk.at(x, y)) { tuft(x, y, 0.7); }
      for (const [x, y] of [[316, 140], [346, 146], [340, 162], [358, 140]]) lilyPad(x, y);
    });

    // ---------------- the cathedral, north-east of the village across the river
    region('village', () => cathedral(270, 121));

    // ---------------- the south: Whisperwood and the bog
    region('woods', () => {
      const riv = river([[240, 158], [240, 172], [236, 188], [227, 204], [215, 218], [208, 228]], 3.2, 2.6, 13);
      const bridge = shRect(232, 206, 7, 3); bridge.paper(); bridge.tint(C.wood, 0.8); bridge.line(1);
      const clear = (x, y) => Math.hypot((x - 160) / 12, (y - 197) / 7) < 1 || Math.hypot((x - 220) / 13, (y - 178) / 14) < 1 || Math.hypot((x - 198) / 9, (y - 211) / 6) < 1 || Math.abs(x - 186) < 4 && y < 172 || y > 222 || near(riv, x, y - 3, 6.5) || near(ROUTE_PTS.southRoad, x, y - 3, 4.5) || near(ROUTE_PTS.deepPath, x, y - 3, 4.5) || near(ROUTE_PTS.gladePath, x, y - 3, 4.5);
      forest(WOODS, { seed: 41, sx: 8, sy: 6, avoid: clear, draw: (x, y, k) => (k < 0.28 ? pine(x, y, 7 + Math.round(k * 12)) : tree(x, y, 2.7 + (k - 0.28) * 2.2, { seed: Math.floor(k * 12) })) });
      treehouse(220, 190);
      fairyRing(160, 198, !!opt.fullMoon);
      shrine(198, 213);
      // the bog
      const bogS = (x, y) => inBlobs([[204, 236, 50, 10]], x, y, 106, 0.8);
      for (let k = 0; k < 40; k++) { const x = 156 + Math.floor(hash(k, 1, 81) * 96), y = 226 + Math.floor(hash(k, 2, 81) * 18); if (bogS(x, y) && Math.abs(x - 200) > 14) marsh(x, y, 0.55); }
      for (const [x, y, rx] of [[172, 238, 6], [228, 240, 7], [214, 231, 4]]) { const pl = shEll(x, y, rx, 2, 0.3, x); waterBody(pl, { lines: false, ta: 0.55 }); }
      for (const [x, y, h, s] of [[166, 232, 10, 1], [240, 232, 9, 2], [186, 243, 8, 3]]) deadTree(x, y, h, s, 1);
      witchHut(200, 240);
    });

    // ---------------- the south-west: the Deepwood
    region('deepwood', (v) => {
      const clear = (x, y) => Math.hypot((x - 110) / 13, (y - 186) / 7) < 1 || Math.hypot((x - 44) / 9, (y - 197) / 12) < 1 || Math.hypot((x - 84) / 20, (y - 212) / 20) < 1 || Math.hypot((x - 38) / 25, (y - 232) / 13) < 1 || Math.hypot((x - 110) / 17, (y - 186) / 9) < 1 || near(ROUTE_PTS.deepPath, x, y - 3, 4.5);
      forest(DEEP, { seed: 51, sx: 7, sy: 5, avoid: clear, draw: (x, y, k) => (k < 0.58 ? pine(x, y, 8 + Math.round(k * 9), { col: C.deep, ta: 0.62, ha: 0.62 }) : k < 0.86 ? tree(x, y, 2.8 + k, { col: C.deep, ta: 0.62, ha: 0.62 }) : deadTree(x, y, 9 + k * 4, Math.floor(k * 100), 0.9)) });
      standingStones(110, 186);
      watchtower(44, 204);
      elderTree(84, 232);
      hollows(38, 232, v);
    });

    // ---------------- the south-east: Hushwillow Glade
    region('glade', (v) => {
      for (const [x, y] of [[290, 186], [306, 182], [338, 180], [356, 184], [376, 186], [383, 200]]) bushes(x, y, 1);
      glade(v);
    });
    region('woods', () => tunnel(266, 208));

    // ---------------- red-ink routes between the places
    const T = (a, b) => VIS[a] && VIS[b];
    trail(ROUTES.westRoad, !T('sanctum', 'village'));
    trail(ROUTES.eastRoad, !T('village', 'lake'));
    trail(ROUTES.stairs, !T('village', 'ridge'));
    trail(ROUTES.southRoad, !T('village', 'woods'));
    trail(ROUTES.deepPath, !T('woods', 'deepwood'));
    trail(ROUTES.gladePath, !T('woods', 'glade'));
    trail(ROUTES.gladePath2, !T('woods', 'glade'));

    // ---------------- unexplored places hide under clouds of rumour
    if (!VIS.deepwood) { cloud(60, 186, 34); cloud(96, 238, 30); cloud(30, 214, 22); }
    if (!VIS.glade) { cloud(330, 200, 34); cloud(360, 232, 28); }

    // ---------------- flourishes
    CLIP = [0, 0, W - 1, H - 1];
    compass(CX, CY, CR);
    ribbon(34, 18, 86);
    dragon(68, 58, 1);
    if (opt.fullMoon) fullMoonDoodle(150, 24);
    border();
    coffeeRing(372, 96, 15);
    post(!!opt.night);
    // RGBA out
    const out = new Uint8ClampedArray(W * H * 4);
    for (let i = 0, j = 0; i < W * H * 3; i += 3, j += 4) { out[j] = buf[i]; out[j + 1] = buf[i + 1]; out[j + 2] = buf[i + 2]; out[j + 3] = 255; }
    buf = null; bg = null;
    return out;
  }

  // ================================================================== places, labels and hit areas
  const ALIAS = { tavern: 'village', boutique: 'village', cathedral: 'village', cottage: 'sanctum' };
  const IDS = ['sanctum', 'village', 'lake', 'ridge', 'depths', 'woods', 'deepwood', 'glade'];
  const PLACES = {
    sanctum: { name: 'The Verdant Sanctum', e: [70, 134, 52, 32], blurb: 'Your ruined moon temple and its walled garden. The Moonroot still hums beneath the soil.', rumour: 'Your inheritance: a ruined moon temple west of the village.' },
    village: { name: 'Hollowmere', e: [186, 130, 50, 26], blurb: 'Crooked rooftops, lamplit windows, and a moonwell that grants wishes for a coin or two.', rumour: 'The village east of the Sanctum. Someone there always has the kettle on.' },
    lake: { name: 'Glimmermere', e: [334, 141, 50, 32], blurb: 'A lake like a dropped mirror. Lune swears something large lives in the deep middle.', rumour: 'A lake beyond the east road. Fishers talk of a moon-crowned lady under the water.' },
    ridge: { name: 'Starfall Ridge', e: [218, 54, 118, 40], blurb: 'Forge smoke, an observatory among the peaks, and a cemetery that keeps its secrets.', rumour: 'Up the cliff stairs north of the village: a forge, an observatory and old graves.' },
    depths: { name: 'The Umbral Depths', e: [201, 64, 16, 12], blurb: 'Fifty floors of dark beneath the mountain. Carved above the arch: "Go gently."', rumour: 'A cave mouth on the Ridge breathing cold air. Nobody who goes down comes back the same.' },
    woods: { name: 'Whisperwood', e: [200, 200, 64, 34], blurb: 'Walk softly: the trees are listening. Elowen keeps the grove; Grizelda keeps the bog.', rumour: 'The forest south of the village. They say the trees are listening.' },
    deepwood: { name: 'The Deepwood', e: [76, 208, 62, 40], blurb: 'Old stones, an older tree, and deep in the Hollows, webs the size of sails. Not at night.', rumour: 'Beyond Whisperwood’s western edge the trees grow old and the paths go quiet. Elowen asks you not to go at night.' },
    glade: { name: 'Hushwillow Glade', e: [334, 214, 50, 32], blurb: 'A hidden hollow of willows where the animals sleep and nothing hunts. Shh.', rumour: 'Somewhere past a mossy tunnel east of Whisperwood, a hidden glade, if the stories are true.' },
  };
  const SPOTS = [
    ['village', 'cathedral', 'Cathedral of the Silver Veil', [270, 100, 17, 26], 'Stained glass that remembers the Order’s prayers. Pray once a day for a little luck.'],
    ['village', 'tavern', 'The Gilded Owl', [201, 110, 9, 8], 'Sable’s tavern: violet firelight, Elvis at the bar, and a song most evenings.'],
    ['village', 'shop', 'Thornwick’s Seeds & Sundries', [172, 111, 7, 7], 'Mirabel’s shop. If it grows, she has it. If it doesn’t, she has tea.'],
    ['village', 'boutique', 'Quillon’s Threads & Tomes', [218, 119, 5, 9], 'Isolde’s bookshop of fine clothes. She will have opinions about your outfit.'],
    ['village', 'moonwell', 'The Moonwell', [186, 128, 5, 4], 'Toss in a coin for luck. Pip has wished for more explosions.'],
    ['sanctum', 'cottage', 'The Keeper’s Cottage', [32, 143, 8, 7], 'Morwenna’s cottage, now yours. Inkwell the cat considers it his.'],
    ['sanctum', 'temple', 'The Moon Temple', [72, 112, 24, 14], 'The Moon Altar sleeps under the broken arch, waiting for offerings.'],
    ['ridge', 'observatory', 'The Observatory', [263, 36, 9, 20], 'Orvyn’s moonstone tower, where the telescope never stops looking up.'],
    ['ridge', 'forge', 'Starfall Forge', [128, 72, 9, 8], 'Brann’s forge. Bring ore and glimmer, leave with better tools.'],
    ['ridge', 'lodge', 'Delvers’ Lodge', [157, 77, 8, 6], 'Corvin buys monster loot and sells what you’ll need below.'],
    ['ridge', 'cemetery', 'The Old Cemetery', [240, 72, 15, 9], 'Moss-soft graves. One stone reads: Not buried. Not found. Not forgotten.'],
    ['woods', 'treehouse', 'Elowen’s Tree House', [220, 176, 11, 15], 'Lanterns in the branches and a ladder for friends. The druid of Whisperwood lives here.'],
    ['woods', 'fairyring', 'The Fairy Ring', [160, 197, 10, 6], 'Quiet by day. On full-moon nights it glows, and something laughs, kindly.'],
    ['woods', 'hut', 'Grizelda’s Hut', [202, 230, 13, 12], 'SOUTHERN MIRE. TURN BACK. SERIOUSLY. (Unless you’ve brought biscuits.)'],
    ['lake', 'statue', 'The Sunken Moon Lady', [354, 124, 7, 7], 'A half-sunk statue watching the Ridge. Lilies gather at her shoulders.'],
    ['lake', 'isle', 'The Shrine Isle', [362, 154, 9, 6], 'A tiny island shrine where shells are left like little prayers.'],
    ['lake', 'dock', 'Lune’s Boathouse & Dock', [294, 132, 10, 10], 'Bait, rods and tall tales. No questions about the Captain’s eye.'],
    ['deepwood', 'elder', 'The Elder Tree', [84, 210, 22, 24], 'Wider than a cottage and older than the Order. Its heartbeat is the forest’s own.'],
    ['deepwood', 'stones', 'The Standing Stones', [110, 183, 14, 8], 'Moss-furred stones carved with every phase of the moon. Even the birds go quiet.'],
    ['deepwood', 'tower', 'The Ruined Watchtower', [44, 193, 7, 12], '“We watch so the valley may sleep.” An owl still does.'],
    ['deepwood', 'hollows', 'The Hollows', [38, 230, 20, 11], 'Dead trees, drifting fog and webs strung like sails. Here be spiders.'],
    ['glade', 'stone', 'The Bonding Stone', [348, 202, 7, 9], 'Where a familiar chooses you, and you choose it back.'],
    ['glade', 'tunnel', 'The Mossy Tunnel', [266, 206, 8, 6], 'A green-dark passage from Whisperwood into the hidden glade.'],
  ].map(([id, key, name, e, blurb]) => ({ id, key, name, e, blurb }));
  // where the red X goes
  const MARK = { sanctum: [101, 124, 'r'], village: [186, 134, 'r'], lake: [284, 151, 'b'], ridge: [186, 84, 'r'], depths: [201, 77, 'r'], woods: [196, 201, 'r'], deepwood: [108, 211, 'r'], glade: [322, 208, 'a'], tavern: [201, 122, 'r'], boutique: [219, 132, 'r'], cathedral: [270, 126, 'r'], cottage: [33, 151, 'r'] };

  // labels: region names in blackletter, small notes hand-lettered; unexplored places get a "?"
  function labelsFor(o) {
    const L = [], v = (id) => !!o.vis[id];
    const place = (id, text, x, y, size, extra) => L.push(Object.assign({ text: v(id) ? text : text + '?', x, y, size, font: 'display', faded: !v(id), id }, extra || {}));
    const note = (id, text, x, y, extra) => { if (v(id)) L.push(Object.assign({ text, x, y, size: 5.8, font: 'hand', id }, extra || {})); };
    const rumour = (text, x, y, extra) => L.push(Object.assign({ text, x, y, size: 5.8, font: 'hand', faded: true }, extra || {}));
    place('ridge', 'Starfall Ridge', 152, 54, 12, { rot: -0.04 });
    place('depths', 'The Umbral Depths', 201, 35, 8.5);
    place('village', 'Hollowmere', 186, 168, 11.5);
    place('sanctum', 'The Verdant Sanctum', 68, 161, 10);
    place('lake', 'Glimmermere', 334, 108, 12, { rot: 0.02 });
    place('woods', 'Whisperwood', 162, 183, 10.5, { rot: -0.03 });
    place('deepwood', 'The Deepwood', 80, 182, 11, { rot: -0.03 });
    place('glade', 'Hushwillow Glade', 330, 178, 9.5, { rot: 0.02 });
    if (v('village')) { L.push({ text: 'Cathedral of', x: 267, y: 140, size: 6.6, font: 'display', id: 'village' }, { text: 'the Silver Veil', x: 267, y: 147, size: 6.6, font: 'display', id: 'village' }); }
    if (v('depths')) L.push({ text: 'here be monsters', x: 201, y: 44, size: 6.2, font: 'display', color: 'red', rot: -0.02, id: 'depths' });
    note('ridge', 'Observatory', 290, 35);
    note('ridge', 'Forge', 106, 76);
    note('ridge', "Delvers' Lodge", 160, 66);
    note('woods', 'Fairy Ring', 160, 213);
    note('woods', "Grizelda's hut", 231, 246);
    note('deepwood', 'Elder Tree', 112, 238);
    note('deepwood', 'Standing Stones', 112, 199);
    note('glade', 'Bonding Stone', 351, 218);
    if (v('deepwood')) L.push({ text: 'Here be spiders', x: 38, y: 219, size: 7, font: 'display', color: 'red', rot: -0.05, id: 'deepwood' });
    else { rumour('unexplored', 70, 200, { id: 'deepwood' }); L.push({ text: 'here be spiders?', x: 46, y: 242, size: 6.4, font: 'display', color: 'red', faded: true, rot: -0.05, id: 'deepwood' }); }
    if (!v('glade')) rumour('unexplored', 336, 222, { id: 'glade' });
    if (!v('ridge')) rumour('unexplored', 252, 80, { id: 'ridge' });
    if (!v('lake')) rumour('unexplored', 334, 136, { id: 'lake' });
    if (!v('woods')) rumour('unexplored', 200, 200, { id: 'woods' });
    if (!v('depths') && v('ridge')) rumour('who knows how deep?', 201, 44, { id: 'depths' });
    if (o.fullMoon && v('village')) L.push({ text: 'Lantern Moon', x: 116, y: 112, size: 6.4, font: 'display', color: 'red', rot: -0.04 }, { text: 'tonight!', x: 118, y: 119, size: 6.4, font: 'display', color: 'red', rot: -0.04 });
    return L;
  }

  // ================================================================== browser side: canvases, lettering, markers
  const artCache = new Map(), states = new WeakMap();
  let fontsReady = false, fontWait = null;
  const FONT_D = '"Pixelify Sans", "Trebuchet MS", sans-serif', FONT_H = '"Pixelify Sans", "Trebuchet MS", sans-serif';

  function normInfo(info) {
    info = info || {};
    const vis = {}, src = info.visited;
    if (!src) for (const id of IDS) vis[id] = true;
    else for (const k in src) if (src[k]) vis[ALIAS[k] || k] = true;
    const cur = info.current || null;
    if (cur) vis[ALIAS[cur] || cur] = true;
    const m = info.mins == null ? 600 : info.mins;
    return { vis, cur, night: m >= 1140 || m < 330, fullMoon: !!info.fullMoon, day: info.day };
  }
  function artKey(o) { return IDS.filter((id) => o.vis[id]).join(',') + '|' + (o.night ? 'n' : 'd') + (o.fullMoon ? 'f' : ''); }
  function artCanvas(o) {
    const key = artKey(o);
    let c = artCache.get(key);
    if (c) return c;
    const px = paintArt({ vis: o.vis, night: o.night, fullMoon: o.fullMoon });
    c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), img = x.createImageData(W, H);
    img.data.set(px); x.putImageData(img, 0, 0);
    if (artCache.size > 5) artCache.delete(artCache.keys().next().value);
    artCache.set(key, c);
    return c;
  }
  function wantSize(canvas) {
    const cw = canvas.clientWidth || 0, dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const w = cw > 0 ? clamp(Math.round(cw * dpr), 400, 2800) : 1200;
    return [w, Math.round((w * H) / W)];
  }
  function inkCss(o, a) { return o.night ? `rgba(40,30,62,${a})` : `rgba(58,36,54,${a})`; }
  function haloCss(o, a) { return o.night ? `rgba(190,188,214,${a})` : `rgba(240,229,212,${a})`; }

  function letter(ctx, k, o, L) {
    const size = L.size * k, font = L.font === 'display' ? FONT_D : FONT_H;
    ctx.save();
    ctx.translate(L.x * k, L.y * k);
    if (L.rot) ctx.rotate(L.rot);
    ctx.font = (L.font === 'display' ? '700 ' : '600 ') + Math.round(size * (L.font === 'display' ? 0.8 : 1)) + 'px ' + font;
    ctx.textBaseline = 'alphabetic';
    const chars = Array.from(L.text), widths = chars.map((ch) => ctx.measureText(ch).width), sp = (L.font === 'display' ? 0.04 : 0.06) * size;
    const total = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    const seed = L.text.length * 13 + Math.round(L.x);
    const fadeA = L.faded ? 0.55 : 1;
    const col = L.color === 'red' ? `rgba(150,40,48,${0.95 * fadeA})` : inkCss(o, 0.94 * fadeA);
    ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      let x = -total / 2;
      chars.forEach((ch, i) => {
        const jy = (hash(i, seed, 1) - 0.5) * size * 0.07, jr = (hash(i, seed, 2) - 0.5) * 0.07;
        ctx.save(); ctx.translate(x + widths[i] / 2, jy); ctx.rotate(jr);
        if (pass === 0) { ctx.strokeStyle = haloCss(o, L.faded ? 0.5 : 0.82); ctx.lineWidth = Math.max(2, size * (L.font === 'display' ? 0.22 : 0.3)); ctx.strokeText(ch, -widths[i] / 2, 0); }
        else { ctx.fillStyle = col; ctx.fillText(ch, -widths[i] / 2, 0); }
        ctx.restore();
        x += widths[i] + sp;
      });
    }
    ctx.restore();
  }
  function composite(st) {
    const o = st.o, [w, h] = st.size, k = w / W;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const art = artCanvas(o);
    // sharp-bilinear: integer nearest-neighbour upscale, then a smooth final resize when needed
    const n = Math.max(1, Math.ceil(k - 0.001));
    if (Math.abs(k - Math.round(k)) < 0.001) { ctx.imageSmoothingEnabled = false; ctx.drawImage(art, 0, 0, w, h); }
    else {
      const mid = document.createElement('canvas'); mid.width = W * n; mid.height = H * n;
      const mx = mid.getContext('2d'); mx.imageSmoothingEnabled = false; mx.drawImage(art, 0, 0, mid.width, mid.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(mid, 0, 0, w, h);
    }
    // the title in its ribbon
    ctx.save();
    ctx.font = '700 ' + Math.round(13.5 * k) + 'px ' + FONT_D; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = inkCss(o, 0.95); ctx.fillText('Nightvale', 76 * k, 33.4 * k);
    // compass letters
    ctx.font = '700 ' + Math.round(6.4 * k) + 'px ' + FONT_H; ctx.fillStyle = inkCss(o, 0.9);
    const [CX, CY, CR] = COMPASS;
    ctx.fillText('E', (CX + CR + 9) * k, (CY + 2.5) * k); ctx.fillText('W', (CX - CR - 9) * k, (CY + 2.5) * k); ctx.fillText('S', CX * k, (CY + CR + 12) * k);
    ctx.restore();
    for (const L of labelsFor(o)) letter(ctx, k, o, L);
    if (o.day) {
      ctx.save(); ctx.font = '600 ' + Math.round(4.4 * k) + 'px ' + FONT_H; ctx.fillStyle = inkCss(o, 0.6); ctx.textAlign = 'right';
      ctx.fillText('charted on day ' + o.day, 380 * k, 241 * k); ctx.restore();
    }
    return c;
  }
  // the red X, drawn as chunky map pixels, with a slow pulse ring
  const XSPR = ['##...##', '###.###', '.#####.', '..###..', '.#####.', '###.###', '##...##'];
  function markers(ctx, st, t) {
    const o = st.o, k = st.size[0] / W, pos = MARK[o.cur] || MARK[ALIAS[o.cur]];
    if (!pos) return;
    const [mx, my, side] = pos, px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x * k), Math.round(y * k), Math.ceil(k), Math.ceil(k)); };
    const phase = st.still ? 0.35 : ((t / 1800) % 1);
    const r = 4 + phase * 9, a = st.still ? 0.5 : 0.7 * (1 - phase);
    const seen = new Set();
    for (let i = 0; i < 64; i++) {
      const ang = (i / 64) * Math.PI * 2, x = Math.round(mx + Math.cos(ang) * r), y = Math.round(my + Math.sin(ang) * r * 0.7);
      if (seen.has(x * 999 + y)) continue; seen.add(x * 999 + y);
      px(x, y, `rgba(156,44,52,${a})`);
    }
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (XSPR[j][i] === '#') px(mx - 3 + i + 0.0, my - 3 + j + 1, 'rgba(40,20,30,0.35)');
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (XSPR[j][i] === '#') px(mx - 3 + i, my - 3 + j, (i + j) % 5 === 0 ? '#c0463f' : '#9c2c34');
    ctx.save();
    ctx.font = '700 ' + Math.round(5.2 * k) + 'px ' + FONT_D; ctx.lineJoin = 'round';
    const tx = side === 'l' ? mx - 6 : side === 'r' ? mx + 6 : mx + 0.5, ty = side === 'a' ? my - 7 : side === 'b' ? my + 12 : my + 6;
    ctx.textAlign = side === 'l' ? 'right' : side === 'r' ? 'left' : 'center';
    ctx.strokeStyle = haloCss(o, 0.85); ctx.lineWidth = Math.max(2, 1.4 * k);
    ctx.strokeText('you are here', tx * k, ty * k);
    ctx.fillStyle = 'rgba(150,40,48,0.95)'; ctx.fillText('you are here', tx * k, ty * k);
    ctx.restore();
  }
  function render(canvas, st, t, measure) {
    if (measure || !st.size) {
      const sz = wantSize(canvas);
      if (canvas.width !== sz[0] || canvas.height !== sz[1]) { canvas.width = sz[0]; canvas.height = sz[1]; }
      st.size = sz;
    }
    const ck = st.key + '@' + st.size[0] + (fontsReady ? 'F' : '');
    if (st.compKey !== ck) { st.comp = composite(st); st.compKey = ck; }
    const ctx = canvas.getContext('2d');
    ctx.drawImage(st.comp, 0, 0);
    markers(ctx, st, t);
  }
  // the pulse runs at ~30 fps while the canvas is on screen and stops once it is removed; every
  // half second it also re-measures, so a canvas drawn before it was attached gets crisp backing pixels
  function animate(canvas, st) {
    if (st.raf || typeof requestAnimationFrame !== 'function') return;
    let seen = false, waited = 0, n = 0, last = -1e9;
    const tick = (t) => {
      st.raf = 0;
      if (states.get(canvas) !== st) return;
      if (canvas.isConnected) seen = true;
      else if (seen || ++waited > 300) return;
      const measure = n++ % 30 === 0;
      if (measure || (!st.still && t - last >= 32)) {
        try { render(canvas, st, t, measure); } catch (e) { return; }
        last = t;
      }
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }
  function checkFonts(canvas, st) {
    if (fontsReady || typeof document === 'undefined' || !document.fonts) { fontsReady = true; return; }
    try {
      if (document.fonts.check('700 12px "Pixelify Sans"') && document.fonts.check('600 12px "Pixelify Sans"')) { fontsReady = true; return; }
      if (!fontWait) fontWait = Promise.all([document.fonts.load('700 24px "Pixelify Sans"'), document.fonts.load('600 24px "Pixelify Sans"')]).then(() => { fontsReady = true; }, () => { fontsReady = true; });
      fontWait.then(() => { if (states.get(canvas) === st) render(canvas, st, typeof performance !== 'undefined' ? performance.now() : 0, true); });
    } catch (e) { fontsReady = true; }
  }

  function draw(canvas, info) {
    if (!canvas) return;
    const o = normInfo(info);
    let st = states.get(canvas);
    if (!st) { st = {}; states.set(canvas, st); }
    st.o = o; st.key = artKey(o) + '|' + (o.day || '');
    st.still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    checkFonts(canvas, st);
    render(canvas, st, typeof performance !== 'undefined' ? performance.now() : 0, true);
    animate(canvas, st);
  }
  function hit(canvas, x, y) {
    if (!canvas) return null;
    const cw = canvas.clientWidth || canvas.width || 1, ch = canvas.clientHeight || canvas.height || 1;
    const mx = (x * W) / cw, my = (y * H) / ch;
    const st = states.get(canvas), vis = st ? st.o.vis : null;
    const inE = (e, pad) => { const dx = (mx - e[0]) / (e[2] + (pad || 0)), dy = (my - e[1]) / (e[3] + (pad || 0)); return dx * dx + dy * dy <= 1; };
    const known = (id) => !vis || !!vis[id];
    const res = (id, name, blurb, spot) => ({ id, name: known(id) ? name : PLACES[id].name + ' (unexplored)', blurb: known(id) ? blurb : PLACES[id].rumour, spot: known(id) ? spot || null : null, visited: known(id) });
    for (const s of SPOTS) if (inE(s.e, 1)) return res(s.id, s.name, s.blurb, s.key);
    if (inE(PLACES.depths.e, 2)) return res('depths', PLACES.depths.name, PLACES.depths.blurb);
    let best = null, bd = 1e9;
    for (const id of IDS) {
      if (id === 'depths') continue;
      const e = PLACES[id].e, dx = (mx - e[0]) / e[2], dy = (my - e[1]) / e[3], d = dx * dx + dy * dy;
      if (d <= 1 && d < bd) { bd = d; best = id; }
    }
    return best ? res(best, PLACES[best].name, PLACES[best].blurb) : null;
  }

  G.WorldMap = {
    draw, hit,
    // for tests and tools: the raw pixel art as RGBA (W x H), no canvas needed
    paint(info) { const o = normInfo(info); return { w: W, h: H, data: paintArt({ vis: o.vis, night: o.night, fullMoon: o.fullMoon }) }; },
    W, H,
  };
})();
