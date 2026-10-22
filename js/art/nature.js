// Nightvale — pixel painter + nature props (trees, bushes, rocks, logs, flowers...).
(function () {
  'use strict';
  const G = window.G, U = G.U, PAL = G.PAL;

  // ------------------------------------------------------------------ pixel painter
  const packCache = new Map();
  function pk(c, a) {
    if (typeof c === 'number') return c;
    const key = (Array.isArray(c) ? c.join(',') : c) + '|' + (a === undefined ? 255 : a);
    let v = packCache.get(key);
    if (v === undefined) { v = U.pack(Array.isArray(c) ? c.map((q) => Math.round(q)) : c, a === undefined ? 255 : Math.round(a)); packCache.set(key, v); }
    return v;
  }
  class Pix {
    constructor(w, h) { this.w = w | 0; this.h = h | 0; this.d = new Uint32Array(this.w * this.h); }
    set(x, y, c, a) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h || c == null) return; this.d[y * this.w + x] = pk(c, a); }
    blend(x, y, c, a) { // alpha-blend a colour over existing pixel (a: 0..1)
      x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      const i = y * this.w + x, old = this.d[i], c3 = U.hex(c);
      const oa = (old >>> 24) / 255;
      if (oa === 0) { this.d[i] = pk(c3, a * 255); return; }
      const or = old & 255, og = (old >>> 8) & 255, ob = (old >>> 16) & 255;
      this.d[i] = pk([or + (c3[0] - or) * a, og + (c3[1] - og) * a, ob + (c3[2] - ob) * a], Math.max(oa, a) * 255);
    }
    has(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false; return (this.d[y * this.w + x] >>> 24) > 0; }
    get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[y * this.w + x]; }
    rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
    hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
    vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    }
    disc(cx, cy, rx, ry, c) {
      for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++) for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++)
        if ((x * x) / (rx * rx + 0.01) + (y * y) / (ry * ry + 0.01) <= 1.0) this.set(cx + x, cy + y, c);
    }
    shadow(cx, cy, rx, ry, a) { // soft ground shadow, only under empty pixels
      for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++) for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d <= 1 && !this.has(cx + x, cy + y)) this.set(cx + x, cy + y, '#0e0818', (a === undefined ? 0.32 : a) * 255 * (d < 0.55 ? 1 : 0.6));
      }
    }
    outline(c, mode) { // mode 'all' | 'bottom' (only below/sides)
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.has(x, y) && (this.d[y * this.w + x] >>> 24) > 200) continue;
        if (this.has(x, y)) continue;
        const n = (xx, yy) => this.has(xx, yy) && (this.get(xx, yy) >>> 24) > 200;
        if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) add.push(x, y);
      }
      for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c || PAL.outline);
    }
    clone() { const p = new Pix(this.w, this.h); p.d.set(this.d); return p; }
    canvas() {
      const c = U.canvas(this.w, this.h), x = c.getContext('2d');
      const img = x.createImageData(this.w, this.h);
      new Uint32Array(img.data.buffer).set(this.d);
      x.putImageData(img, 0, 0);
      return c;
    }
  }
  G.Pix = Pix;
  G.pk = pk;

  const noise = U.noise, hash = U.hash;

  // ------------------------------------------------------------------ canopy helper
  // Paint a blob canopy of overlapping circles with directional light, clump noise and outline.
  function canopy(S, cx, cy, rad, ramp, seed, opts) {
    opts = opts || {};
    const r = U.rng(seed);
    const blobs = [[0, 0, rad * 0.78]];
    const n = opts.blobs || 7;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.6;
      blobs.push([Math.cos(a) * rad * (opts.spreadX || 0.55), Math.sin(a) * rad * (opts.spreadY || 0.42), rad * (0.42 + r() * 0.18)]);
    }
    const ins = (x, y) => { for (const b of blobs) if ((x - b[0]) ** 2 + (y - b[1]) ** 2 < b[2] * b[2]) return true; return false; };
    const pts = [];
    const top = Math.floor(-rad * 1.35), bot = Math.ceil(rad * 1.15), lx0 = Math.floor(-rad * 1.5), lx1 = Math.ceil(rad * 1.5);
    for (let y = top; y <= bot; y++) for (let x = lx0; x <= lx1; x++) {
      if (!ins(x, y)) continue;
      const edge = !ins(x + 1, y) || !ins(x - 1, y) || !ins(x, y + 1) || !ins(x, y - 1);
      const lx = x + rad * 0.38, ly = y + rad * 0.48;
      let s = 1 - Math.hypot(lx, ly) / (rad * 1.6);
      s += (noise((cx + x) / 2.4, (cy + y) / 2.4, seed) - 0.5) * 0.55;
      // clump highlights: little arcs
      if (noise((cx + x) / 4, (cy + y) / 3, seed + 9) > 0.66) s += 0.12;
      const L = ramp.length;
      let k = Math.floor(U.clamp(s, 0, 0.999) * (L - 0.6) + 0.45);
      if (edge) k = y > 0 ? 0 : Math.min(k, 1);
      if (!edge && ins(x, y + 1) && !ins(x, y + 2) && y > rad * 0.3) k = Math.min(k, 1);
      S.set(cx + x, cy + y, ramp[U.clamp(k, 0, L - 1)]);
      if (!edge) pts.push([cx + x, cy + y]);
    }
    return pts;
  }

  function trunk(S, cx, by, th, w, ramp, flare) {
    for (let y = 0; y < th; y++) {
      const yy = by - y;
      const ww = y < 2 && flare ? w + 2 : w;
      const x0 = cx - Math.floor(ww / 2);
      for (let x = 0; x < ww; x++) {
        let k = x === 0 ? 0 : x === ww - 1 ? 1 : x === 1 ? 3 : 2;
        if (hash(x0 + x, yy, 77) < 0.12) k = Math.max(0, k - 1);
        S.set(x0 + x, yy, ramp[k]);
      }
    }
  }

  // ------------------------------------------------------------------ trees
  const TREE_KINDS = ['oak', 'pine', 'wisteria', 'willow', 'dead', 'glow', 'silver'];
  function makeTree(kind, variant) {
    const seed = 1000 + TREE_KINDS.indexOf(kind) * 97 + variant * 13;
    const r = U.rng(seed);
    const W = 40, H = 58, ax = 20, ay = 56;
    const S = new Pix(W, H);
    const lights = [];
    const barkRamp = [PAL.wood[0], PAL.wood[1], PAL.wood[2], PAL.wood[3]];
    if (kind === 'pine') {
      S.shadow(ax + 1, ay - 1, 9, 3);
      trunk(S, ax, ay - 1, 6, 4, barkRamp, true);
      const layers = 5, baseW = 11 + variant, top = 8;
      for (let L = 0; L < layers; L++) {
        const ly = ay - 6 - L * 8, half = baseW - L * 2;
        for (let y = 0; y < 13; y++) {
          const wRow = Math.floor((half * (y + 1)) / 13);
          const yy = ly - 12 + y;
          for (let x = -wRow; x <= wRow; x++) {
            const ragged = y === 12 && hash(x, L, seed) < 0.35;
            if (ragged) continue;
            let k = x < -wRow / 3 ? 3 : x < wRow / 3 ? 2 : 1;
            if (y < 3) k++;
            if (x === wRow || x === -wRow || y === 12) k = 0;
            if (hash(ax + x, yy, seed + 1) < 0.08) k = Math.max(0, k - 1);
            S.set(ax + x, yy, PAL.pine[U.clamp(k, 0, 4)]);
          }
        }
      }
      S.set(ax, ay - 6 - layers * 8 - 4 + top - 8, PAL.pine[3]);
      S.outline(PAL.outline);
      return { c: S.canvas(), ax, ay, lights, kind };
    }
    if (kind === 'dead') {
      S.shadow(ax + 1, ay - 1, 8, 3);
      const gray = ['#1d1724', '#2c2533', '#3d3446', '#524859'];
      trunk(S, ax, ay - 1, 18, 4, gray, true);
      const branch = (x, y, ang, len, depth) => {
        for (let i = 0; i < len; i++) { x += Math.cos(ang); y += Math.sin(ang); S.set(x, y, gray[depth > 1 ? 2 : 1]); if (depth > 1) S.set(x + 1, y, gray[1]); ang += (r() - 0.5) * 0.35; }
        if (depth > 0) { branch(x, y, ang - 0.6, len * 0.65, depth - 1); branch(x, y, ang + 0.5, len * 0.6, depth - 1); }
      };
      branch(ax, ay - 18, -Math.PI / 2 - 0.4, 10, 2);
      branch(ax, ay - 14, -Math.PI / 2 + 0.7, 9, 2);
      S.outline(PAL.outline);
      return { c: S.canvas(), ax, ay, lights, kind };
    }
    let ramp = PAL.leaf.slice(0, 6), rad = 13 + (variant % 3), th = 12;
    if (kind === 'wisteria') { ramp = ['#2b1d4a', '#3f2b6a', '#58408e', '#7559b4', '#9b80d6', '#c4adf0']; rad = 13 + (variant % 2); }
    if (kind === 'willow') { ramp = ['#123329', '#1c4a3a', '#2a634a', '#3d7d5a', '#5a9a6c', '#82b98a']; rad = 13; th = 14; }
    if (kind === 'glow') { ramp = PAL.leaf.slice(0, 6); rad = 12; }
    if (kind === 'silver') { ramp = ['#132f33', '#1d4448', '#2a5a5c', '#3b7472', '#55918a', '#7bb0a3']; rad = 11; th = 15; }
    const bark = kind === 'silver' ? ['#4f4b60', '#8d89a1', '#b8b4c8', '#d6d3e2'] : barkRamp;
    S.shadow(ax + 2, ay - 1, rad * 0.85, 3.5);
    trunk(S, ax, ay - 1, th + 4, kind === 'silver' ? 3 : 5, bark, true);
    if (kind === 'silver') for (let k = 0; k < 5; k++) S.set(ax - 1 + (k % 2), ay - 4 - k * 3, '#2d2c3e');
    const cy = ay - th - rad * 0.7;
    const pts = canopy(S, ax, Math.round(cy), rad, ramp, seed, kind === 'willow' ? { spreadX: 0.6, spreadY: 0.3 } : null);
    if (kind === 'willow') {
      for (let k = 0; k < 14; k++) {
        const sx = ax - rad + 2 + Math.floor(r() * rad * 2 - 2), sy = Math.round(cy + rad * 0.2 + r() * 4), len = 6 + Math.floor(r() * 9);
        for (let j = 0; j < len; j++) S.set(sx + (j > len / 2 ? 1 : 0), sy + j, ramp[j < 3 ? 3 : j < len - 2 ? 2 : 1]);
      }
    }
    if (kind === 'wisteria') {
      // hanging blossom racemes below the canopy edge
      for (let k = 0; k < 9; k++) {
        const sx = Math.round(ax - rad + 3 + (k / 8) * (rad * 2 - 6)), sy = Math.round(cy + rad * 0.45 + (k % 3)), len = 4 + ((k * 7) % 5);
        for (let j = 0; j < len; j++) {
          const w = j < len - 2 ? 1 : 0;
          S.set(sx, sy + j, j === len - 1 ? '#e4d2ff' : ramp[4 - (j % 2)]);
          if (w && j % 2 === 0) S.set(sx + 1, sy + j, ramp[3]);
        }
        if (k % 3 === 0) lights.push({ x: sx, y: sy + len, r: 9, color: [190, 148, 255], i: 0.35, night: true });
      }
      for (const p of pts) if (hash(p[0], p[1], seed + 5) < 0.03) S.set(p[0], p[1], '#f2e8ff');
      lights.push({ x: ax, y: Math.round(cy), r: 26, color: [170, 130, 255], i: 0.3, night: true });
    }
    if (kind === 'glow') {
      for (let k = 0; k < 7; k++) {
        const p = pts[Math.floor(r() * pts.length)];
        if (!p) continue;
        S.set(p[0], p[1], PAL.emerald[1]); S.set(p[0] + 1, p[1], PAL.emerald[0]); S.set(p[0], p[1] + 1, PAL.emerald[0]); S.set(p[0], p[1] - 1, PAL.emerald[2]);
        lights.push({ x: p[0], y: p[1], r: 10, color: [93, 255, 176], i: 0.5, night: true });
      }
    }
    if (kind === 'oak' && variant % 3 === 2) {
      // a few violet blossoms
      for (const p of pts) if (hash(p[0], p[1], seed + 3) < 0.03) S.set(p[0], p[1], PAL.magic[3]);
    }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights, kind, top: Math.round(cy - rad * 1.3) };
  }

  // ------------------------------------------------------------------ bushes
  function makeBush(kind, variant) {
    const seed = 3000 + variant * 31 + (kind.length * 7);
    const W = 22, H = 20, ax = 11, ay = 18;
    const S = new Pix(W, H);
    S.shadow(ax + 1, ay - 1, 8, 2.5);
    let ramp = PAL.leaf.slice(0, 5);
    if (kind === 'dark') ramp = PAL.forest;
    if (kind === 'violet') ramp = ['#2b1d4a', '#3f2b6a', '#58408e', '#7559b4', '#9b80d6'];
    const pts = canopy(S, ax, ay - 7, 7 + (variant % 2), ramp, seed, { blobs: 5, spreadX: 0.7, spreadY: 0.35 });
    const lights = [];
    if (kind === 'berry') for (let k = 0; k < 6; k++) { const p = pts[(k * 37 + variant * 11) % pts.length]; if (p) { S.set(p[0], p[1], '#6a2e8e'); S.set(p[0] + 1, p[1], '#4a1f6a'); S.set(p[0], p[1] - 1, '#b07ae0'); } }
    if (kind === 'flower') for (let k = 0; k < 7; k++) { const p = pts[(k * 53 + variant * 7) % pts.length]; if (p) { const col = k % 2 ? PAL.rose[2] : PAL.magic[4]; S.set(p[0], p[1], col); S.set(p[0] - 1, p[1], PAL.magic[3]); } }
    if (kind === 'glow') for (let k = 0; k < 4; k++) { const p = pts[(k * 41 + 5) % pts.length]; if (p) { S.set(p[0], p[1], PAL.emerald[2]); S.set(p[0] + 1, p[1], PAL.emerald[1]); lights.push({ x: p[0], y: p[1], r: 8, color: [93, 255, 176], i: 0.45, night: true }); } }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights };
  }

  // ------------------------------------------------------------------ rocks
  function makeBoulder(variant, big) {
    const W = big ? 34 : 18, H = big ? 28 : 16, ax = W >> 1, ay = H - 2;
    const S = new Pix(W, H);
    const rx = big ? 14 : 7, ry = big ? 11 : 6, cy = ay - ry;
    S.shadow(ax + 1, ay, rx, 2.5);
    const seed = 4000 + variant * 17 + (big ? 5 : 0);
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const wob = (noise((x + 20) / 3, (y + 20) / 3, seed) - 0.5) * 2.2;
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1 + wob * 0.12) continue;
      let s = 0.55 - (x + y * 1.2) / (rx * 2.6) + (noise(x / 2.5, y / 2.5, seed + 1) - 0.5) * 0.45;
      let k = s > 0.82 ? 5 : s > 0.62 ? 4 : s > 0.42 ? 3 : s > 0.22 ? 2 : 1;
      if (hash(x, y, seed + 2) < 0.06) k = Math.max(1, k - 1);
      S.set(ax + x, cy + y, PAL.rock[k]);
      if (y < -ry * 0.45 && noise(x / 3, y / 2, seed + 3) > 0.6) S.set(ax + x, cy + y, y < -ry * 0.7 ? PAL.grass[3] : PAL.grass[2]);
    }
    // crack
    let cx = ax + Math.floor((hash(variant, 1, seed) - 0.5) * rx), cyy = cy - 1;
    for (let k = 0; k < (big ? 7 : 3); k++) { S.set(cx, cyy, PAL.rock[0]); cx += hash(k, 2, seed) < 0.5 ? 1 : 0; cyy++; }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }

  // ------------------------------------------------------------------ small nature props
  function makeStump(variant) {
    const S = new Pix(18, 16), ax = 9, ay = 14;
    S.shadow(ax + 1, ay, 7, 2);
    for (let y = 0; y < 8; y++) for (let x = -5; x <= 5; x++) S.set(ax + x, ay - y, PAL.wood[x < -3 ? 3 : x > 3 ? 1 : 2]);
    S.set(ax - 6, ay, PAL.wood[2]); S.set(ax + 6, ay, PAL.wood[1]);
    S.disc(ax, ay - 8, 5, 2, PAL.wood[4]);
    S.disc(ax, ay - 8, 3, 1, PAL.wood[3]);
    S.set(ax, ay - 8, PAL.wood[2]);
    if (variant) { S.set(ax - 3, ay - 3, PAL.emerald[1]); S.set(ax - 4, ay - 3, PAL.emerald[0]); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: variant ? [{ x: ax - 3, y: ay - 3, r: 8, color: [93, 255, 176], i: 0.4, night: true }] : [] };
  }
  function makeLog(variant) {
    const S = new Pix(34, 16), ax = 17, ay = 14;
    S.shadow(ax, ay, 15, 2.5);
    for (let x = 2; x < 30; x++) for (let y = 0; y < 7; y++) {
      let k = y === 0 ? 3 : y < 3 ? 2 : y < 6 ? 1 : 0;
      if (hash(x, y, 9 + variant) < 0.1) k = Math.max(0, k - 1);
      S.set(x, ay - 7 + y, PAL.wood[k + (y === 0 ? 1 : 0)]);
    }
    S.disc(30, ay - 4, 2, 3, PAL.wood[4]); S.set(30, ay - 4, PAL.wood[2]);
    for (let x = 6; x < 24; x += 5) { S.set(x, ay - 8, PAL.grass[3]); S.set(x + 1, ay - 8, PAL.grass[2]); }
    S.set(12, ay - 9, PAL.magic[3]);
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeMushrooms(variant) {
    const S = new Pix(16, 14), ax = 8, ay = 12;
    const caps = variant % 2 ? [PAL.magic[2], PAL.magic[3], PAL.magic[4]] : ['#2a9c8a', '#5dffd0', '#c4fff0'];
    const spots = [[4, 0, 2], [9, -1, 3], [12, 1, 2]];
    const lights = [];
    for (const [x, dy, s] of spots) {
      const top = ay - 3 - s - dy;
      for (let y = top + s; y <= ay; y++) S.set(x, y, PAL.moon[1]);
      for (let k = -s; k <= s; k++) S.set(x + k, top, caps[1]);
      for (let k = -s + 1; k <= s - 1; k++) S.set(x + k, top - 1, caps[2]);
      S.set(x - s, top, caps[0]); S.set(x + s, top, caps[0]);
      lights.push({ x, y: top, r: 9, color: variant % 2 ? [190, 148, 255] : [93, 255, 208], i: 0.5, night: true });
    }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights };
  }
  function makeReeds(variant) {
    const S = new Pix(14, 20), ax = 7, ay = 18;
    for (let k = 0; k < 6; k++) {
      const x = 2 + ((k * 5 + variant * 3) % 10), h = 9 + ((k * 7) % 7);
      for (let y = 0; y < h; y++) S.set(x + (y > h * 0.7 ? 1 : 0), ay - y, y > h - 3 && k % 2 ? PAL.wood[3] : PAL.leaf[y < 3 ? 2 : 3]);
    }
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeLilypad(variant) {
    const S = new Pix(14, 10), ax = 7, ay = 7;
    S.disc(7, 5, 5, 3, PAL.leaf[3]);
    S.disc(6, 4, 3, 2, PAL.leaf[4]);
    S.set(7, 5, PAL.water[2]); S.set(8, 5, PAL.water[2]); S.set(9, 6, PAL.water[2]);
    const lights = [];
    if (variant === 1) { S.set(5, 3, PAL.moon[2]); S.set(6, 2, PAL.moon[3]); S.set(4, 2, PAL.moon[2]); S.set(5, 2, PAL.magic[4]); lights.push({ x: 5, y: 2, r: 9, color: [200, 210, 255], i: 0.45, night: true }); }
    if (variant === 2) { S.set(5, 3, PAL.rose[2]); S.set(6, 2, PAL.rose[1]); S.set(4, 2, PAL.rose[2]); }
    S.outline(PAL.leaf[0]);
    return { c: S.canvas(), ax, ay, lights };
  }
  function makeCrystal(variant) { // glowing crystal cluster (ridge / caves)
    const S = new Pix(16, 20), ax = 8, ay = 18;
    const ramps = [['#3a2a6a', '#6a47a8', '#9b7ae0', '#d8c4ff'], ['#1c4a52', '#2a8e99', '#5ad8d0', '#c8fff4'], ['#5a4a1a', '#a8862a', '#f2c45a', '#fff1c8']];
    const rp = ramps[variant % 3];
    const shards = [[8, 11, 2], [4, 7, 2], [12, 8, 2], [6, 5, 1]];
    for (const [x, h, w] of shards) for (let y = 0; y < h; y++) for (let k = -w; k <= w; k++) {
      if (Math.abs(k) > w * (1 - y / h) + 0.5) continue;
      S.set(x + k, ay - y, rp[k < 0 ? 2 : k > 0 ? 1 : 3]);
    }
    S.outline(PAL.outline);
    const col = [[185, 150, 255], [90, 216, 208], [242, 196, 90]][variant % 3];
    return { c: S.canvas(), ax, ay, lights: [{ x: 8, y: 10, r: 22, color: col, i: 0.6 }] };
  }

  G.Nature = { makeTree, makeBush, makeBoulder, makeStump, makeLog, makeMushrooms, makeReeds, makeLilypad, makeCrystal, canopy, TREE_KINDS };
})();
