// Nightvale — Gothic building generator: steep fish-scale roofs, cross gables, turrets, domes and spires,
// lancet, rose and diamond-paned windows, shop fronts with awnings, buttresses, gargoyles, statue niches,
// timber jetties, leaning facades and ruins. Self-contained (own pixel painter) so it also runs in previews.
// Defines window.GothicArt.
(function () {
  'use strict';

  // ------------------------------------------------------------------ painter
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const hexCache = new Map();
  function rgb(c) { if (Array.isArray(c)) return c; let v = hexCache.get(c); if (!v) { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; hexCache.set(c, v); } return v; }
  function pack(c, a) { c = rgb(c); return (((a === undefined ? 255 : a) << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }
  function mixc(a, b, t) { a = rgb(a); b = rgb(b); return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }

  class Pix {
    constructor(w, h) { this.w = w | 0; this.h = h | 0; this.d = new Uint32Array(this.w * this.h); this.tag = new Uint8Array(this.w * this.h); this.nc = new Uint32Array(this.w * this.h); }
    set(x, y, c, a, tag) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h || c == null) return; const i = y * this.w + x; this.d[i] = pack(c, a); this.tag[i] = tag || 0; this.nc[i] = 0; }
    // a glass pixel with its own lit-at-night colour
    glass(x, y, day, night) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = y * this.w + x; this.d[i] = pack(day); this.tag[i] = 1; this.nc[i] = pack(night); }
    get(x, y) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null; const v = this.d[y * this.w + x]; return v >>> 24 ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255] : null; }
    has(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && (this.d[y * this.w + x] >>> 24) > 0; }
    clear(x, y) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[y * this.w + x] = 0; this.tag[y * this.w + x] = 0; this.nc[y * this.w + x] = 0; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
    hline(x0, x1, y, c) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c); }
    vline(x, y0, y1, c) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c); }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
      for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    }
    disc(cx, cy, rx, ry, c) { for (let y = -Math.ceil(ry); y <= ry; y++) for (let x = -Math.ceil(rx); x <= rx; x++) if ((x * x) / (rx * rx + 0.01) + (y * y) / (ry * ry + 0.01) <= 1) this.set(cx + x, cy + y, c); }
    shade(x, y, t) { // darken an existing pixel toward the outline colour (negative t lightens)
      if (!this.has(x, y)) return; const i = y * this.w + x, v = this.d[i];
      const c = [v & 255, (v >>> 8) & 255, (v >>> 16) & 255], m = t >= 0 ? mixc(c, '#120c1c', t) : mixc(c, '#ffffff', -t); this.d[i] = pack(m, v >>> 24);
    }
    outline(c) {
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.has(x, y)) continue;
        if (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1)) add.push(x, y);
      }
      for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
    }
    clone() { const p = new Pix(this.w, this.h); p.d.set(this.d); p.tag.set(this.tag); p.nc.set(this.nc); return p; }
    shearDx(y, lean) { return lean ? Math.round(lean * Math.pow(1 - y / (this.h - 1), 1.35)) : 0; }
    shear(lean) { // lean the top of the image to the right by `lean` px (crooked buildings)
      if (!lean) return;
      const n = new Uint32Array(this.d.length), t = new Uint8Array(this.d.length), nc = new Uint32Array(this.d.length);
      for (let y = 0; y < this.h; y++) {
        const dx = this.shearDx(y, lean);
        for (let x = 0; x < this.w; x++) { const sx = x - dx; if (sx < 0 || sx >= this.w) continue; n[y * this.w + x] = this.d[y * this.w + sx]; t[y * this.w + x] = this.tag[y * this.w + sx]; nc[y * this.w + x] = this.nc[y * this.w + sx]; }
      }
      this.d = n; this.tag = t; this.nc = nc;
    }
    canvas() {
      const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
      const x = c.getContext('2d'), img = x.createImageData(this.w, this.h);
      new Uint32Array(img.data.buffer).set(this.d); x.putImageData(img, 0, 0); return c;
    }
  }

  // ------------------------------------------------------------------ styles
  const OUT = '#120c1c';
  const STYLES = {
    crooked: {
      name: 'Hogsmeade Crooked', blurb: 'Leaning timber-and-plaster houses with jettied upper floors, crooked chimneys and indigo fish-scale roofs. Warm, cosy, a little wonky.',
      wall: 'timber', plaster: ['#4b3f4c', '#6c5d6c', '#8f7f8b', '#b2a2a8', '#d2c4c2'], timber: ['#1e1518', '#2e2124', '#45322f'],
      stone: ['#2d2b3a', '#45435a', '#605e78', '#7e7c97', '#9e9cb6', '#c0bed2'], roof: ['#100e20', '#1a1733', '#26224a', '#343062', '#46417e'], scales: true,
      trim: ['#1e1518', '#3e2d2b', '#574039'], metal: ['#2a2733', '#6a6680'], glass: 'warm', lean: 4, jetty: true, crooked: true, gargoyles: false, crest: false,
      shutter: ['#2a1a2e', '#4a2c4c', '#6a4068'], boards: ['#241a20', '#36282c', '#4c3a3a', '#644e4a'],
    },
    cathedral: {
      name: 'Cathedral Gothic', blurb: 'Dark weathered stone, buttresses, gargoyles, iron cresting and blazing stained glass. Grand and sacred, like an old cathedral town.',
      wall: 'stone', stone: ['#17151f', '#24212f', '#332f42', '#454057', '#5b5571', '#77708f'], roof: ['#0e0e16', '#161624', '#212134', '#2d2d46', '#3c3c5c'], scales: false,
      trim: ['#17151f', '#332f42', '#5b5571'], metal: ['#14121c', '#4a4660'], glass: 'stained', lean: 0, jetty: false, gargoyles: true, crest: true, buttress: true,
    },
    moonstone: {
      name: 'Moonstone Gothic', blurb: 'Pale moonstone walls, verdigris-teal slate, silver trims and crescent finials, with cool blue and violet glass. Elegant and ethereal.',
      wall: 'stone', stone: ['#4a4c64', '#6b6e88', '#9194ae', '#b4b7cf', '#d3d6e8', '#eef0fa'], roof: ['#10282f', '#183a44', '#22505c', '#2f6a77', '#448795'], scales: true,
      trim: ['#3a3d55', '#8a8fa8', '#c8cce0'], metal: ['#8a8fa8', '#e8eeff'], glass: 'cool', lean: 0, jetty: false, gargoyles: false, crest: true, moonFinial: true,
    },
    witchwood: {
      name: 'Witchwood Gothic', blurb: 'Black timber, plum roofs gone mossy, twisted spires and windows glowing witch-green. Spooky-cosy, lanterns everywhere.',
      wall: 'timber', plaster: ['#2a2230', '#3a2f40', '#4b3e52', '#5e4f66', '#73637b'], timber: ['#0c090e', '#18121a', '#261c28'],
      stone: ['#1c1a24', '#2b2836', '#3b374a', '#4e495f', '#645e78', '#7c7592'], roof: ['#150b18', '#231226', '#341b38', '#47264c', '#5d3262'], scales: true, mossy: true,
      trim: ['#0c090e', '#261c28', '#3b2b3e'], metal: ['#1a1620', '#3fd88a'], glass: 'witch', lean: 3, jetty: true, crooked: true, twisted: true, gargoyles: false, crest: false,
      shutter: ['#0f1a14', '#1f3328', '#2f4a3a'], boards: ['#140f16', '#1f1722', '#2d2230', '#3b2e3e'],
    },
    victorian: {
      name: 'Victorian Gothic Revival', blurb: 'Dark red brick, cream stone dressings, verdigris copper roofs, iron cresting and tall chimneys. A wizarding-London feel.',
      wall: 'brick', brick: ['#2e1418', '#45202a', '#5e2c34', '#7a3a3e', '#95504c'], stone: ['#4a4440', '#6e675f', '#958c80', '#b9ae9c', '#d8ceb8', '#efe6d2'],
      roof: ['#0f2a26', '#163c36', '#1f5048', '#2b675c', '#3e8274'], scales: true,
      trim: ['#3a3430', '#958c80', '#d8ceb8'], metal: ['#15141a', '#4a4858'], glass: 'stained', lean: 0, jetty: false, gargoyles: true, crest: true,
    },
  };
  const GLASS = {
    warm: { day: ['#1b2246', '#2a3a6a', '#4a64a0', '#8aa8d8'], night: ['#b06a2a', '#ffbc62', '#ffd690', '#fff1c8'], light: [255, 188, 98] },
    witch: { day: ['#13241f', '#1f3a33', '#2f5a4c', '#5a8a78'], night: ['#1f6a4a', '#3fd88a', '#8affc0', '#e0ffe8'], light: [93, 255, 160] },
    cool: { day: ['#16243e', '#22385e', '#36568a', '#7a9cc8'], night: ['#3a6ad0', '#5cc8ff', '#a8e6ff', '#f0faff'], mosaic: ['#5cc8ff', '#8f6cff', '#5dffd0', '#b9a0ff', '#e4d2ff'], light: [140, 200, 255] },
    stained: { day: ['#1a1830', '#2a2448', '#3e3466', '#6a5a98'], night: ['#802070', '#ff4fa8', '#ffd24f', '#ffffff'], mosaic: ['#ff4fa8', '#4fb4ff', '#ffd24f', '#8f6cff', '#4fffc8', '#ff7a4f', '#ff6fd0'], light: [255, 170, 120] },
    amber: { day: ['#2a1c30', '#3e2a3c', '#5e4050', '#9a7a7a'], night: ['#a84a1c', '#ff9a3c', '#ffc66a', '#fff0c0'], light: [255, 150, 70] },
  };
  const FLOWERS = ['#e89ab8', '#b99aee', '#fff1c8', '#f2c45a', '#c4648e', '#8fd0ff'];

  // ------------------------------------------------------------------ materials
  function wallFill(P, x0, y0, w, h, st, seed, mat, opts) {
    opts = opts || {};
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const lx = x - x0, ly = y - y0;
      let c;
      if (mat === 'stone') {
        const course = Math.floor(ly / 5), off = (course % 2) * 4, bx = Math.floor((lx + off) / 8);
        const s = st.stone;
        if (ly % 5 === 4 || (lx + off) % 8 === 0) c = s[1];
        else { const hv = hash(bx, course, seed); c = s[hv < 0.25 ? 2 : hv < 0.8 ? 3 : 4]; if (ly % 5 === 0) c = s[Math.min(s.length - 1, (hv < 0.25 ? 2 : 3) + 1)]; }
        if (hash(x, y, seed + 3) < 0.04) c = s[1];
        if (noise(x / 6, y / 4, seed + 11) > 0.72) c = mixc(c, '#1f3a2c', 0.35); // damp moss streaks
      } else if (mat === 'brick') {
        const course = Math.floor(ly / 3), off = (course % 2) * 3;
        const b = st.brick;
        if (ly % 3 === 2 || (lx + off) % 6 === 0) c = st.stone[1];
        else { const hv = hash(Math.floor((lx + off) / 6), course, seed); c = b[hv < 0.3 ? 2 : hv < 0.85 ? 3 : 4]; }
      } else if (mat === 'boards') {
        const b = Math.floor(lx / 4), bd = st.boards || st.timber;
        c = bd[lx % 4 === 0 ? 0 : hash(b, Math.floor(ly / 11), seed) < 0.5 ? 1 : 2];
        if (lx % 4 === 1 && hash(b, ly, seed + 2) < 0.08) c = bd[0]; // knots
        if (ly % 11 === 0 && lx % 4 !== 0) c = bd[0]; // butt joints
      } else { // plaster with timber framing
        const p = st.plaster;
        c = p[noise(x / 5, y / 5, seed) > 0.62 ? 2 : 3];
        if (hash(x, y, seed + 1) < 0.06) c = p[2];
        if (noise(x / 9, y / 7, seed + 21) > 0.7) c = mixc(c, p[1], 0.5); // weathering stains
        if (noise(x / 3, y / 14, seed + 5) > 0.83 && ly > 2) c = p[1]; // hairline cracks
      }
      P.set(x, y, c);
    }
    if (mat === 'timber' || mat === 'plaster') {
      const t = st.timber;
      const posts = opts.posts || [];
      P.hline(x0, x0 + w - 1, y0, t[1]); P.hline(x0, x0 + w - 1, y0 + 1, t[0]); P.hline(x0, x0 + w - 1, y0 + h - 1, t[1]);
      P.vline(x0, y0, y0 + h - 1, t[2]); P.vline(x0 + 1, y0, y0 + h - 1, t[1]); P.vline(x0 + w - 1, y0, y0 + h - 1, t[0]); P.vline(x0 + w - 2, y0, y0 + h - 1, t[1]);
      for (const px of posts) { const wob = st.crooked ? Math.round((hash(px, 1, seed) - 0.5) * 2) : 0; P.line(x0 + px, y0, x0 + px + wob, y0 + h - 1, t[1]); P.line(x0 + px + 1, y0, x0 + px + 1 + wob, y0 + h - 1, t[0]); }
      if (opts.braces) for (const [bx0, bx1] of opts.braces) { P.line(x0 + bx0, y0 + h - 2, x0 + bx1, y0 + 2, t[1]); P.line(x0 + bx0 + 1, y0 + h - 2, x0 + bx1 + 1, y0 + 2, t[0]); }
      if (opts.rail != null) { P.hline(x0, x0 + w - 1, y0 + opts.rail, t[1]); P.hline(x0, x0 + w - 1, y0 + opts.rail + 1, t[0]); }
    }
    if (opts.quoins && (mat === 'stone' || mat === 'brick' || mat === 'boards')) {
      const s = st.stone;
      for (let y = y0 + 1; y < y0 + h - 1; y += 4) { const l = ((y - y0) / 4) % 2 ? 3 : 5; P.rect(x0, y, l, 3, s[4]); P.hline(x0, x0 + l - 1, y + 3, s[1]); P.rect(x0 + w - l, y, l, 3, s[3]); P.hline(x0 + w - l, x0 + w - 1, y + 3, s[1]); }
    }
  }
  function scalesRoof(P, x0, y, w, st, seed, k) {
    // one row of a roof at height y spanning x0..x0+w-1; k = row index from the ridge
    const r = st.roof;
    for (let x = x0; x < x0 + w; x++) {
      let c;
      if (st.scales) {
        const row = Math.floor(k / 3), off = (row % 2) * 2, cell = (x - x0 + off) % 4, sub = k % 3;
        c = r[sub === 2 ? (cell === 1 || cell === 2 ? 2 : 0) : sub === 0 && cell === 1 ? 3 : 2];
        if (sub !== 2 && hash(Math.floor((x - x0 + off) / 4), row, seed + 9) < 0.07) c = r[sub === 0 && cell === 1 ? 4 : 3]; // a few lighter, newer scales
      } else {
        const row = Math.floor(k / 3), off = (row % 2) * 3;
        c = r[k % 3 === 2 ? 1 : (x - x0 + off) % 6 === 0 ? 1 : hash(x, row, seed) < 0.18 ? 3 : 2];
      }
      const mn = noise(x / 3, y / 2.2, seed + 9) * 0.7 + noise(x / 9, y / 6, seed + 19) * 0.3;
      if (st.mossy && mn > 0.6 && hash(x, y, seed + 2) < (mn - 0.6) * 4) c = hash(x, y, seed) < 0.55 ? '#2f5a36' : (k % 3 === 0 ? '#4c8a50' : '#3b6e42');
      else if (mn > 0.74 && hash(x, y, seed + 3) < 0.5) c = mixc(c, '#2f5a36', 0.35); // a little moss everywhere
      P.set(x, y, c);
    }
  }

  // ------------------------------------------------------------------ openings
  // every window returns its glass rect so the building can place one light per window
  function lancet(P, x, y, w, h, st, seed, opts) {
    opts = opts || {};
    const hw = (w - 1) / 2, archH = Math.max(2, Math.round(hw + 2));
    const inside = (i, j) => { if (j < 0 || j >= h || i < 0 || i >= w) return false; if (j >= archH) return true; const half = hw * Math.sqrt(j / archH); return Math.abs(i - hw) <= half + 0.35; };
    const tr = st.trim;
    for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) {
      if (inside(i, j)) continue;
      if (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1) || (j === h && i >= 0 && i < w)) P.set(x + i, y + j, j === h ? tr[2] : tr[i < hw ? 1 : 0]);
    }
    const g = GLASS[opts.glass || st.glass];
    const M = g.mosaic, pick = (k) => M[Math.floor(hash(k, 3, seed) * M.length)];
    const border = M && pick(1), back = M && pick(2), med = M && pick(3), medC = M && pick(4);
    const panel = w >= 9 ? 12 : 9;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!inside(i, j)) continue;
      if (M && w >= 7) { // figurative stained glass: a border, a deep background, round medallions down the light
        const edge = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1);
        const pj = (j - archH + 400) % panel, pc = (panel - 1) / 2, d = Math.hypot(i - hw, (pj - pc) * 0.9);
        const lead = j > archH && pj === panel - 1;
        let n;
        if (lead) { P.set(x + i, y + j, tr[0]); continue; }
        if (edge) n = border; else if (j > archH && d < Math.min(hw - 0.5, 3.6)) n = d < 1.6 ? '#fff1c8' : (d < 2.6 ? medC : med); else if (j <= archH && Math.hypot(i - hw, j - archH * 0.7) < hw * 0.6) n = medC; else n = (i + j) % 7 === 0 ? mixc(back, '#ffffff', 0.3) : back;
        if (opts.dark) { P.set(x + i, y + j, mixc(n, g.day[0], 0.75)); continue; }
        P.glass(x + i, y + j, mixc(n, g.day[0], 0.55), hash(x + i, y + j, seed) < 0.12 ? mixc(n, '#ffffff', 0.35) : n);
        continue;
      }
      const lead = (w >= 5 && i === Math.round(hw)) || (j > archH && (j - archH) % 5 === 4);
      if (lead) { P.set(x + i, y + j, tr[0]); continue; }
      let c = g.day[(i + j < 3) ? 3 : (i - j) % 4 === 1 ? 2 : 1];
      if (M) c = mixc(M[Math.floor(hash(Math.floor(i / 2), Math.floor(j / 2), seed) * M.length)], g.day[0], 0.55);
      P.set(x + i, y + j, c, 255, opts.dark ? 0 : 1);
    }
    if (opts.sill !== false) P.hline(x - 1, x + w, y + h + 1, st.stone ? st.stone[st.stone.length - 2] : tr[2]);
    return { x, y, w, h, glass: opts.glass || st.glass, dark: !!opts.dark };
  }
  // rectangular casement with diamond leading (Hogsmeade cottages)
  function casement(P, x, y, w, h, st, seed, opts) {
    opts = opts || {};
    const tr = st.trim, t = st.timber || tr, g = GLASS[opts.glass || st.glass];
    // lintel + frame
    P.hline(x - 2, x + w + 1, y - 2, t[1]); P.hline(x - 1, x + w, y - 1, t[0]);
    for (let j = 0; j < h; j++) { P.set(x - 1, y + j, t[2]); P.set(x + w, y + j, t[0]); }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const mull = w >= 7 && i === Math.floor(w / 2);
      const transom = h >= 10 && j === Math.floor(h * 0.3);
      if (mull || transom) { P.set(x + i, y + j, t[1]); continue; }
      const lead = (i + j) % 3 === 0 || (i - j + 300) % 3 === 0;
      let c = g.day[(i + j < 3) ? 3 : (i * 7 + j * 3) % 5 === 0 ? 2 : 1];
      if (lead) c = mixc(tr[0], g.day[1], 0.25);
      P.set(x + i, y + j, c, 255, lead || opts.dark ? 0 : 1);
    }
    // sill
    P.hline(x - 2, x + w + 1, y + h, t[2]); P.hline(x - 1, x + w, y + h + 1, t[0]);
    if (opts.shutters && st.shutter) {
      const sh = st.shutter;
      for (const sx of [x - 2 - 3, x + w + 2]) {
        for (let j = 0; j < h; j++) for (let i = 0; i < 3; i++) P.set(sx + i, y + j, j % 3 === 2 ? sh[0] : sh[i === 0 ? 2 : 1]);
        P.set(sx + 1, y + Math.floor(h / 2), '#8a7a5a');
      }
    }
    if (opts.box) flowerbox(P, x - 1, y + h + 2, w + 2, st, seed);
    return { x, y, w, h, glass: opts.glass || st.glass, dark: !!opts.dark };
  }
  // shop front: tall many-paned display window with a dark frame and goods behind the glass
  function shopWindow(P, x, y, w, h, st, seed, opts) {
    opts = opts || {};
    const t = st.timber || st.trim, g = GLASS[opts.glass || st.glass];
    P.rect(x - 2, y - 2, w + 4, h + 4, t[0]);
    P.hline(x - 3, x + w + 2, y - 3, t[2]); P.hline(x - 3, x + w + 2, y + h + 2, t[2]); P.hline(x - 2, x + w + 1, y + h + 3, t[0]);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const bar = i % 6 === 5 || j % 7 === 6;
      if (bar) { P.set(x + i, y + j, t[1]); continue; }
      let c = g.day[(i % 6 + j % 7 < 3) ? 3 : j > h * 0.65 ? 1 : 2];
      P.set(x + i, y + j, c, 255, 1);
    }
    // goods in the window (silhouettes that stay visible day and night)
    const goods = opts.goods || 'jars';
    for (let k = 0; k < Math.floor(w / 6); k++) {
      const gx = x + k * 6 + 1, gy = y + h - 1;
      if (goods === 'jars') { const c = FLOWERS[k % FLOWERS.length]; P.rect(gx + 1, gy - 3, 3, 3, c); P.set(gx + 2, gy - 4, '#2f5a36'); P.set(gx + 1, gy - 5, '#3b6e42'); P.set(gx + 3, gy - 5, '#3b6e42'); }
      else if (goods === 'clothes') { const c = ['#5a2e52', '#2a3a6a', '#7a2a2a', '#2f5a36'][k % 4]; P.vline(gx + 2, gy - 10, gy - 9, '#8a7a5a'); P.rect(gx + 1, gy - 8, 3, 7, c); P.set(gx, gy - 7, c); P.set(gx + 4, gy - 7, c); P.hline(gx + 1, gx + 3, gy - 1, mixc(c, '#000000', 0.4)); }
      else if (goods === 'books') { for (let b = 0; b < 4; b++) P.vline(gx + b, gy - 3 - (b % 2), gy, ['#7a2a2a', '#2a3a6a', '#2f5a36', '#6a4a20'][(b + k) % 4]); }
    }
    return { x, y, w, h, glass: opts.glass || st.glass, big: true };
  }
  function rose(P, cx, cy, r, st, seed) {
    const gk = st.glass === 'warm' || st.glass === 'amber' ? 'stained' : st.glass, g = GLASS[gk], s = st.stone || st.trim;
    const mos = g.mosaic || g.night, tr = st.trim[0];
    const big = r >= 9, n2 = big ? 16 : 8, n1 = 8, r0 = r * (big ? 0.24 : 0.3), r1 = r * (big ? 0.58 : 0.55);
    const outerA = gk === 'cool' ? mos[0] : '#4fb4ff', outerB = gk === 'cool' ? mos[1] : '#ff4fa8', innerA = gk === 'cool' ? mos[3] : '#ffd24f', innerB = gk === 'cool' ? mos[2] : '#8f6cff';
    for (let y = -r - 2; y <= r + 2; y++) for (let x = -r - 2; x <= r + 2; x++) {
      const d = Math.hypot(x, y);
      if (d > r + 1.6) continue;
      if (d > r - 0.6) { P.set(cx + x, cy + y, s[d > r + 0.6 ? 1 : d > r ? 3 : 4]); continue; }
      const a = Math.atan2(y, x) + Math.PI;
      let n, lead = false;
      if (d < r0) { // centre boss: a golden star
        lead = Math.abs(d - r0 + 0.5) < 0.6;
        n = d < r0 * 0.45 ? '#fff1c8' : (Math.floor((a / (Math.PI * 2)) * 10) % 2 ? '#ffd24f' : '#ff9a3c');
      } else if (d < r1) { // inner ring of petals
        const sa = (a / (Math.PI * 2)) * n1, seg = Math.floor(sa), f = sa - seg;
        lead = Math.abs(d - r1 + 0.5) < 0.6 || Math.min(f, 1 - f) * (d * 2 * Math.PI / n1) < 0.6;
        const petal = Math.hypot((f - 0.5) * (d * 2 * Math.PI / n1), d - (r0 + r1) / 2) < (r1 - r0) * 0.38;
        n = petal ? (seg % 2 ? innerA : innerB) : mixc(seg % 2 ? innerB : innerA, '#ffffff', 0.15);
      } else { // outer cells, each with a small foiled roundel
        const sa = (a / (Math.PI * 2)) * n2, seg = Math.floor(sa), f = sa - seg, arc = d * 2 * Math.PI / n2;
        lead = Math.min(f, 1 - f) * arc < 0.6;
        const fc = Math.hypot((f - 0.5) * arc, d - (r1 + r) / 2), fr = Math.min(arc, r - r1) * 0.32;
        if (big && Math.abs(fc - fr) < 0.55) lead = true;
        n = big && fc < fr ? (seg % 2 ? innerA : '#4fffc8') : seg % 2 ? outerA : outerB;
        if (!lead && (x * 3 + y * 5 + 40) % 9 === 0) n = mixc(n, '#ffffff', 0.25);
      }
      if (lead) { P.set(cx + x, cy + y, tr); continue; }
      P.glass(cx + x, cy + y, mixc(n, g.day[0], 0.5), n);
    }
    return { x: cx - r, y: cy - r, w: 2 * r + 1, h: 2 * r + 1, glass: gk, rose: true };
  }
  function roundWin(P, cx, cy, r, st, seed) {
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x, y); if (d > r + 1) continue;
      if (d > r - 0.3) P.set(cx + x, cy + y, st.trim[1]);
      else if (x === 0 || y === 0) P.set(cx + x, cy + y, st.trim[0]);
      else P.set(cx + x, cy + y, GLASS[st.glass].day[x + y < 0 ? 2 : 1], 255, 1);
    }
    return { x: cx - r, y: cy - r, w: 2 * r + 1, h: 2 * r + 1, glass: st.glass };
  }
  function flowerbox(P, x, y, w, st, seed) {
    const t = st.timber || st.trim;
    P.rect(x, y, w, 3, t[1]); P.hline(x, x + w - 1, y, t[2]); P.hline(x, x + w - 1, y + 2, t[0]);
    for (let i = 0; i < w; i++) {
      const hh = 1 + Math.floor(hash(i, 3, seed) * 3);
      for (let j = 1; j <= hh; j++) P.set(x + i, y - j, j === hh && hash(i, j, seed + 1) < 0.55 ? FLOWERS[Math.floor(hash(i, 7, seed) * FLOWERS.length)] : hash(i, j, seed + 2) < 0.5 ? '#2f5a36' : '#3b6e42');
    }
    for (let i = 1; i < w; i += 3) if (hash(i, 9, seed) < 0.6) { P.set(x + i, y + 3, '#2f5a36'); P.set(x + i, y + 4, '#3b6e42'); } // trailing ivy
  }
  function awning(P, x, y, w, colors, st) {
    const [a, b] = colors || ['#5a2e52', '#d2c4c2'];
    for (let j = 0; j < 6; j++) for (let i = -j * 0.3; i < w + j * 0.3; i++) {
      const xi = Math.round(x + i), stripe = Math.floor((i + 40) / 3) % 2;
      let c = stripe ? a : b;
      if (j === 0) c = mixc(c, '#ffffff', 0.15); else if (j >= 4) c = mixc(c, '#120c1c', 0.25);
      P.set(xi, y + j, c);
    }
    for (let i = 0; i < w + 2; i += 3) { P.set(x + i - 1, y + 6, mixc(a, '#120c1c', 0.2)); P.set(x + i, y + 6, mixc(a, '#120c1c', 0.2)); } // scalloped hem
    const m = (st && st.metal) || ['#2a2733', '#6a6680'];
    P.line(x - 1, y + 1, x - 3, y - 3, m[0]); P.line(x + w, y + 1, x + w + 2, y - 3, m[0]);
  }
  // doors. (x,y) = top-left of the opening; style: arch (pointed), round, double, portal (deep carved archivolts)
  function door(P, x, y, w, h, st, seed, style) {
    style = style || 'arch';
    const round = style === 'round';
    const hw = (w - 1) / 2, archH = round ? Math.round(hw) : Math.round(hw + 2);
    const inside = (i, j) => { if (j < 0 || j >= h || i < 0 || i >= w) return false; if (j >= archH) return true; const k = j / archH; return Math.abs(i - hw) <= hw * (round ? Math.sqrt(1 - (1 - k) * (1 - k)) : Math.sqrt(k)) + 0.35; };
    const s = st.stone || st.trim;
    const depth = style === 'portal' ? 5 : 2;
    for (let j = -depth; j < h; j++) for (let i = -depth; i <= w + depth - 1; i++) {
      if (inside(i, j)) continue;
      let near = 0;
      for (let k = 1; k <= depth && !near; k++) if (inside(i - k, j) || inside(i + k, j) || inside(i, j + k)) near = k;
      if (!near) continue;
      if (style === 'portal') P.set(x + i, y + j, near % 2 ? s[s.length - 2] : s[2]);
      else if (st.wall === 'timber' && round) P.set(x + i, y + j, (st.timber || st.trim)[near === 1 ? 2 : 0]);
      else P.set(x + i, y + j, (Math.floor((i + j + 20) / 2) % 2) ? s[s.length - 2] : s[s.length - 3]);
    }
    const wd = ['#2a1810', '#4a2c1c', '#6a4028', '#8a5a3a'];
    const split = style === 'double' || style === 'portal';
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!inside(i, j)) continue;
      let c = wd[i % 3 === 0 ? 0 : i < hw ? 2 : 1];
      if (j === Math.round(h * 0.35) || j === Math.round(h * 0.75)) c = '#1a1416';
      if (split && Math.abs(i - hw) < 0.6) c = '#1a1416';
      P.set(x + i, y + j, c);
    }
    if (style === 'portal') { // tympanum glowing with a small rose of glass
      const ty = y + Math.round(archH * 0.55);
      for (let i = 1; i < w - 1; i++) if (inside(i, Math.round(archH * 0.55))) P.set(x + i, ty, s[4]);
      rose(P, x + Math.round(hw), y + Math.round(archH * 0.32), Math.max(2, Math.round(hw * 0.35)), st, seed);
    }
    if (round && w >= 8) { // little peek window
      const wx = x + Math.round(hw) - 1, wy = y + Math.round(h * 0.2);
      P.rect(wx - 1, wy - 1, 4, 4, wd[0]); P.set(wx, wy, '#2a3a6a', 255, 1); P.set(wx + 1, wy, '#2a3a6a', 255, 1); P.set(wx, wy + 1, '#2a3a6a', 255, 1); P.set(wx + 1, wy + 1, '#2a3a6a', 255, 1);
    }
    if (split) { P.set(x + Math.round(hw) - 2, y + Math.round(h * 0.55), '#f2c45a'); P.set(x + Math.round(hw) + 2, y + Math.round(h * 0.55), '#f2c45a'); }
    else P.set(x + w - 3, y + Math.round(h * 0.55), '#f2c45a');
    for (const j of [Math.round(h * 0.35), Math.round(h * 0.75)]) for (let i = 1; i < w - 1; i += 3) P.set(x + i, y + j, '#6a6680');
    // threshold + steps
    P.hline(x - 2, x + w + 1, y + h, s[s.length - 2]); P.hline(x - 3, x + w + 2, y + h + 1, s[2]);
  }
  function niche(P, x, y, st, seed) { // a pointed niche holding a pale statue
    const s = st.stone || st.trim;
    for (let j = 0; j < 14; j++) for (let i = 0; i < 7; i++) {
      const top = j < 4 && Math.abs(i - 3) > j * 0.9;
      if (top) continue;
      P.set(x + i, y + j, i === 0 || i === 6 || j === 13 ? s[4] : s[1]);
    }
    const c = s[5] || s[4];
    P.rect(x + 2, y + 4, 3, 2, c); P.set(x + 3, y + 3, c); P.rect(x + 2, y + 6, 3, 6, mixc(c, '#000000', 0.12)); P.set(x + 1, y + 7, c); P.set(x + 5, y + 7, c);
    P.hline(x - 1, x + 7, y + 14, s[3]);
  }

  // ------------------------------------------------------------------ roof pieces
  function mainRoof(P, x0, x1, top, eave, st, seed, steep) {
    const rows = eave - top, inset = Math.round(rows * (steep || 0.3));
    for (let y = top; y <= eave; y++) {
      const k = y - top, ins = Math.round(inset * (1 - k / rows));
      scalesRoof(P, x0 + ins, y, x1 - x0 - 2 * ins + 1, st, seed, k);
      P.set(x0 + ins, y, st.roof[3]); P.set(x0 + ins + 1, y, st.roof[3]); P.set(x1 - ins, y, st.roof[0]); P.set(x1 - ins - 1, y, st.roof[1]);
    }
    // ridge capping
    P.hline(x0 + inset, x1 - inset, top, st.roof[4]); P.hline(x0 + inset, x1 - inset, top + 1, st.roof[3]);
    for (let x = x0 + inset; x <= x1 - inset; x += 4) P.set(x, top, st.roof[2]);
    P.hline(x0 - 1, x1 + 1, eave, st.trim[1]); P.hline(x0 - 1, x1 + 1, eave + 1, st.trim[0]);
    if (st.crest) for (let x = x0 + inset + 2; x < x1 - inset - 1; x += 3) { P.set(x, top - 1, st.metal[0]); if ((x / 3) % 2 < 1) { P.set(x, top - 2, st.metal[1]); P.set(x, top - 3, st.metal[0]); } }
  }
  // front-facing cross gable: triangle wall + bargeboards, apex at (cx, apex), base at baseY
  function crossGable(P, cx, apexY, baseY, halfW, st, seed, mat, win, glassOut) {
    const H = baseY - apexY;
    for (let y = apexY; y <= baseY; y++) {
      const half = Math.round((halfW * (y - apexY)) / H);
      for (let x = cx - half; x <= cx + half; x++) {
        if (mat === 'stone') { const s = st.stone, course = Math.floor(y / 5), off = (course % 2) * 4; P.set(x, y, y % 5 === 4 || (x + off) % 8 === 0 ? s[1] : s[hash(Math.floor((x + off) / 8), course, seed) < 0.3 ? 2 : 3]); }
        else if (mat === 'brick') { const b = st.brick, course = Math.floor(y / 3), off = (course % 2) * 3; P.set(x, y, y % 3 === 2 || (x + off) % 6 === 0 ? st.stone[1] : b[hash(Math.floor((x + off) / 6), course, seed) < 0.3 ? 2 : 3]); }
        else if (mat === 'boards') { const bd = st.boards || st.timber; P.set(x, y, bd[(x - cx + 40) % 4 === 0 ? 0 : hash(Math.floor((x - cx + 40) / 4), 1, seed) < 0.5 ? 1 : 2]); }
        else { const p = st.plaster; P.set(x, y, p[noise(x / 5, y / 5, seed) > 0.6 ? 2 : 3]); }
      }
      if (mat === 'timber') { P.set(cx, y, st.timber[1]); if ((y - apexY) % 7 === 0) P.hline(cx - half, cx + half, y, st.timber[1]); if ((y - apexY) % 7 === 1 && y > apexY + 4) { P.set(cx - Math.round(half * 0.5), y, st.timber[0]); P.set(cx + Math.round(half * 0.5), y, st.timber[0]); } }
    }
    if (mat === 'timber' && H > 14) { P.line(cx - Math.round(halfW * 0.7), baseY - 1, cx - 2, apexY + Math.round(H * 0.4), st.timber[1]); P.line(cx + Math.round(halfW * 0.7), baseY - 1, cx + 2, apexY + Math.round(H * 0.4), st.timber[0]); }
    // bargeboards (roof edge) 4px thick, extending past the base, with a carved drip edge
    for (let k = -1; k <= H + 3; k++) {
      const y = apexY + k, half = Math.round((halfW * k) / H);
      for (let t = 0; t < 4; t++) {
        const c = t === 0 ? st.trim[2] : t === 3 ? st.roof[0] : st.roof[t === 1 ? 3 : 2];
        P.set(cx - half - 1 - t, y, c); P.set(cx + half + 1 + t, y, t === 0 ? st.trim[1] : c);
      }
      if (k > 2 && k % 4 === 0) { P.set(cx - half - 1, y + 1, st.trim[1]); P.set(cx + half + 1, y + 1, st.trim[0]); }
    }
    // finial
    if (st.moonFinial) { P.set(cx, apexY - 3, '#f2c45a'); P.set(cx - 1, apexY - 4, '#f2c45a'); P.set(cx - 1, apexY - 5, '#f2c45a'); P.set(cx, apexY - 6, '#f2c45a'); P.vline(cx, apexY - 2, apexY - 1, st.metal[0]); }
    else { P.vline(cx, apexY - 4, apexY - 1, st.metal[0]); P.set(cx, apexY - 5, st.metal[1]); P.set(cx - 1, apexY - 3, st.metal[0]); P.set(cx + 1, apexY - 3, st.metal[0]); }
    let g = null;
    if (win === 'lancet') g = lancet(P, cx - 3, apexY + Math.round(H * 0.35), 7, Math.max(7, Math.round(H * 0.5)), st, seed + cx, { sill: false });
    else if (win === 'casement') g = casement(P, cx - 3, apexY + Math.round(H * 0.42), 7, Math.max(6, Math.round(H * 0.38)), st, seed + cx, {});
    else if (win === 'round') g = roundWin(P, cx, apexY + Math.round(H * 0.58), 3, st, seed);
    else if (win === 'rose') g = rose(P, cx, apexY + Math.round(H * 0.6), Math.max(4, Math.round(halfW * 0.42)), st, seed);
    if (g && glassOut) glassOut.push(g);
  }
  function dormer(P, cx, baseY, st, seed, glassOut) {
    P.rect(cx - 4, baseY - 9, 9, 9, st.wall === 'stone' ? st.stone[3] : st.wall === 'brick' ? st.brick[3] : st.plaster[3]);
    const g = st.wall === 'timber' ? casement(P, cx - 2, baseY - 7, 5, 6, st, seed + cx, {}) : lancet(P, cx - 2, baseY - 8, 5, 7, st, seed + cx, { sill: false });
    for (let k = 0; k <= 6; k++) { P.hline(cx - k - 1, cx - k + 0, baseY - 15 + k, st.roof[3]); P.hline(cx + k, cx + k + 1, baseY - 15 + k, st.roof[1]); }
    P.set(cx, baseY - 16, st.metal[0]);
    if (glassOut) glassOut.push(g);
  }
  function chimney(P, x, top, bottom, st, seed, crooked) {
    const s = st.wall === 'brick' ? st.brick : st.stone;
    for (let y = top; y <= bottom; y++) {
      const off = crooked ? Math.round(Math.sin((y - top) / 6) * 1.2) : 0;
      for (let i = 0; i < 6; i++) P.set(x + i + off, y, (y % 3 === 2 || (i + Math.floor(y / 3)) % 3 === 0) ? s[1] : s[i < 2 ? 4 : 3]);
    }
    P.hline(x - 1, x + 6, top - 1, s[4]); P.hline(x - 1, x + 6, top, s[2]);
    // chimney pots
    P.rect(x, top - 3, 2, 2, '#8a4a3a'); P.set(x, top - 3, '#a8604a'); P.rect(x + 3, top - 4, 2, 3, '#7a3a2e'); P.set(x + 3, top - 4, '#a8604a');
    return { x: x + 4, y: top - 5 };
  }
  // round turret with a conical roof or an observatory dome
  function turret(P, x0, w, top, bottom, coneH, st, seed, opts, glassOut) {
    opts = opts || {};
    const s = st.wall === 'brick' ? st.brick : st.stone;
    for (let y = top; y <= bottom; y++) for (let x = x0; x < x0 + w; x++) {
      const t = (x - x0) / (w - 1), light = Math.cos((t - 0.3) * Math.PI);
      const course = Math.floor((y - top) / 4), off = course % 2 ? 3 : 0;
      let k = light > 0.8 ? 4 : light > 0.45 ? 3 : light > 0.05 ? 2 : 1;
      if ((y - top) % 4 === 3 || (x + off) % 6 === 0) k = Math.max(0, k - 1);
      P.set(x, y, s[Math.min(s.length - 1, k)]);
    }
    if (opts.band) for (const by of [top + 3, bottom - Math.round((bottom - top) * 0.45)]) { P.hline(x0 - 1, x0 + w, by, s[4]); P.hline(x0 - 1, x0 + w, by + 1, s[1]); }
    const nw = opts.windows != null ? opts.windows : 2;
    for (let i = 0; i < nw; i++) {
      const wy = top + 8 + i * Math.max(14, Math.floor((bottom - top - 16) / Math.max(1, nw)));
      if (wy + 10 > bottom - 2) break;
      const g = st.wall === 'timber' ? casement(P, x0 + Math.round(w / 2) - 2, wy, 5, 8, st, seed + i, {}) : lancet(P, x0 + Math.round(w / 2) - 2, wy, 5, 9, st, seed + i, { sill: false });
      if (glassOut) glassOut.push(g);
    }
    const cx = x0 + (w - 1) / 2;
    if (opts.cap === 'dome') {
      const r = w / 2 + 1, cy = top;
      for (let y = -Math.ceil(r * 0.95); y <= 0; y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
        if ((x * x) / (r * r) + (y * y) / (r * r * 0.9) > 1) continue;
        const rel = (x + r) / (2 * r);
        let c = st.roof[rel < 0.25 ? 4 : rel < 0.55 ? 3 : rel < 0.85 ? 2 : 1];
        if ((x + 400) % 5 === 0) c = st.roof[1]; // ribs
        P.set(Math.round(cx + x), cy + y, c);
      }
      // the observing slit + telescope
      for (let y = -Math.round(r * 0.9); y <= -1; y++) { P.set(Math.round(cx) + 1, cy + y, '#0b0a14'); P.set(Math.round(cx) + 2, cy + y, '#16142a'); }
      P.line(Math.round(cx) + 1, cy - Math.round(r * 0.5), Math.round(cx) + 9, cy - Math.round(r * 0.5) - 8, '#c8a050'); P.line(Math.round(cx) + 2, cy - Math.round(r * 0.5), Math.round(cx) + 10, cy - Math.round(r * 0.5) - 8, '#8a6a30');
      P.rect(Math.round(cx) + 9, cy - Math.round(r * 0.5) - 10, 3, 3, '#e8c870');
      P.hline(Math.round(cx - r) - 1, Math.round(cx + r) + 1, cy + 1, st.trim[2]); P.hline(Math.round(cx - r), Math.round(cx + r), cy + 2, st.trim[0]);
      const ay = cy - Math.round(r * 0.95);
      if (st.moonFinial) { P.set(Math.round(cx), ay - 2, '#f2c45a'); P.set(Math.round(cx) - 1, ay - 3, '#f2c45a'); P.set(Math.round(cx) - 1, ay - 4, '#f2c45a'); P.set(Math.round(cx), ay - 5, '#f2c45a'); }
      return;
    }
    const eaveW = w / 2 + 2, twist = st.twisted ? 3 : 0;
    for (let y = 0; y <= coneH; y++) {
      const k = y / coneH, half = eaveW * Math.pow(k, 0.92), yy = top - coneH + y, cxx = cx + twist * Math.pow(1 - k, 2);
      for (let x = Math.round(cxx - half); x <= Math.round(cxx + half); x++) {
        const rel = (x - (cxx - half)) / (2 * half + 0.01);
        let c = st.roof[rel < 0.3 ? 3 : rel < 0.7 ? 2 : 1];
        if (st.scales && y % 3 === 2 && x % 2 === 0) c = st.roof[0];
        if (st.mossy && noise(x / 3, yy / 3, seed) > 0.7) c = '#2f5a36';
        P.set(x, yy, c);
      }
    }
    P.hline(Math.round(cx - eaveW) - 1, Math.round(cx + eaveW) + 1, top + 1, st.trim[1]);
    const ax = Math.round(cx + twist), ay = top - coneH;
    if (opts.vane) weathervane(P, ax, ay, opts.vane, st);
    else if (st.moonFinial) { P.set(ax, ay - 2, '#f2c45a'); P.set(ax - 1, ay - 3, '#f2c45a'); P.set(ax - 1, ay - 4, '#f2c45a'); P.set(ax, ay - 5, '#f2c45a'); }
    else { P.vline(ax, ay - 4, ay - 1, st.metal[0]); P.set(ax, ay - 5, st.metal[1]); }
  }
  function weathervane(P, x, y, kind, st) {
    const m = st.metal[0];
    P.vline(x, y - 9, y - 1, m); P.hline(x - 3, x + 3, y - 4, m); P.set(x - 4, y - 4, '#f2c45a'); P.set(x + 4, y - 4, '#f2c45a');
    if (kind === 'owl') { P.rect(x - 1, y - 13, 3, 4, '#f2c45a'); P.set(x - 1, y - 14, '#f2c45a'); P.set(x + 1, y - 14, '#f2c45a'); P.set(x, y - 12, OUT); }
    else if (kind === 'dragon') { const g = '#f2c45a'; P.hline(x - 3, x + 3, y - 11, g); P.set(x + 4, y - 12, g); P.set(x + 5, y - 13, g); P.set(x - 4, y - 12, g); P.set(x - 1, y - 12, g); P.set(x - 2, y - 13, g); P.set(x, y - 13, g); P.set(x + 1, y - 14, g); P.set(x + 4, y - 11, OUT); }
    else if (kind === 'flag') { P.vline(x, y - 16, y - 1, st.metal[0]); for (let j = 0; j < 6; j++) for (let i = 1; i <= 9 - j; i++) P.set(x + i, y - 16 + j, j < 3 ? '#7a2a3a' : '#5a1e2c'); P.set(x + 3, y - 14, '#f2c45a'); P.set(x + 4, y - 13, '#f2c45a'); }
    else if (kind === 'moon') { P.set(x, y - 10, '#f2c45a'); P.set(x - 1, y - 11, '#f2c45a'); P.set(x - 1, y - 12, '#f2c45a'); P.set(x, y - 13, '#f2c45a'); P.set(x + 1, y - 13, '#f2c45a'); }
    else { P.hline(x - 1, x + 3, y - 10, '#f2c45a'); P.set(x - 2, y - 11, '#f2c45a'); P.set(x + 4, y - 11, '#f2c45a'); P.set(x + 2, y - 11, '#f2c45a'); }
  }
  // square tower with a tall spire and pinnacles; full = drawn down to the ground in front of the facade
  function tower(P, x0, w, top, bottom, spireH, st, seed, opts, glassOut) {
    opts = opts || {};
    const s = st.wall === 'brick' ? st.brick : st.stone;
    for (let y = top; y <= bottom; y++) for (let x = x0; x < x0 + w; x++) {
      const course = Math.floor((y - top) / 5), off = (course % 2) * 4;
      let c = (y - top) % 5 === 4 || (x + off) % 8 === 0 ? s[1] : s[x < x0 + 3 ? 4 : x > x0 + w - 4 ? 2 : 3];
      if (st.wall === 'brick' && (y - top) % 12 === 0) c = st.stone[4];
      P.set(x, y, c);
    }
    // corner buttresses on full towers
    if (opts.full) for (const bx of [x0 - 2, x0 + w - 2]) for (let y = top + 20; y <= bottom; y++) { P.set(bx, y, s[bx < x0 ? 4 : 2]); P.set(bx + 1, y, s[bx < x0 ? 3 : 1]); P.set(bx + 2, y, s[bx < x0 ? 3 : 1]); P.set(bx + 3, y, s[1]); }
    // belfry: tall dark louvred opening
    const bx = x0 + Math.round(w / 2) - 3;
    glassOut && glassOut.push(lancet(P, bx, top + 6, 7, 14, st, seed, { sill: true, glass: 'warm' }));
    for (let j = 0; j < 14; j += 3) for (let i = 1; i < 6; i++) P.set(bx + i, top + 10 + j, st.trim[0]);
    // clock / rose
    if (opts.clock) {
      const cx = x0 + Math.round(w / 2), cy = top + 30, r = Math.min(6, Math.floor(w / 2) - 3);
      P.disc(cx, cy, r + 1, r + 1, s[1]); P.disc(cx, cy, r, r, '#e8e0c8'); P.disc(cx, cy, r - 2, r - 2, '#f4eedc');
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; P.set(Math.round(cx + Math.cos(a) * (r - 1)), Math.round(cy + Math.sin(a) * (r - 1)), OUT); }
      P.line(cx, cy, cx, cy - r + 2, OUT); P.line(cx, cy, cx + r - 3, cy + 1, OUT);
    } else glassOut && glassOut.push(rose(P, x0 + Math.round(w / 2), top + 30, Math.min(5, Math.floor(w / 2) - 3), st, seed + 7));
    if (opts.full) for (let k = 0; k < (opts.lancets || 2); k++) { const ly = top + 44 + k * 24; if (ly + 18 < bottom - 6) glassOut && glassOut.push(lancet(P, x0 + Math.round(w / 2) - 3, ly, 7, 16, st, seed + 40 + k)); }
    // cornice + pinnacles
    P.hline(x0 - 1, x0 + w, top, st.stone ? st.stone[4] : st.trim[2]); P.hline(x0 - 1, x0 + w, top + 1, st.trim[0]);
    for (const px of [x0 - 1, x0 + w - 2]) { P.rect(px, top - 8, 3, 8, s[3]); P.set(px + 1, top - 9, st.metal[1]); P.set(px + 1, top - 10, st.metal[1]); P.set(px + 2, top - 8, s[1]); }
    if (st.gargoyles) { gargoyle(P, x0 - 2, top + 2, st, true); gargoyle(P, x0 + w + 1, top + 2, st, false); }
    if (opts.broken) { // ruined top: jagged, no spire
      for (let x = x0 - 2; x < x0 + w + 2; x++) { const cut = top - 10 + Math.round(noise(x / 3, 1, seed) * 22); for (let y = top - 12; y < cut; y++) P.clear(x, y); }
      return;
    }
    // spire
    const cx = x0 + (w - 1) / 2;
    for (let y = 0; y <= spireH; y++) {
      const k = y / spireH, half = (w / 2 - 2) * k, yy = top - spireH + y;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const rel = (x - (cx - half)) / (2 * half + 0.01);
        P.set(x, yy, st.roof[rel < 0.45 ? 3 : 1]);
      }
      if (y % 6 === 5) P.hline(Math.round(cx - half), Math.round(cx + half), yy, st.roof[0]);
      if (y % 12 === 8 && half > 3) { P.set(Math.round(cx - half) - 1, yy, st.metal[1]); P.set(Math.round(cx + half) + 1, yy, st.metal[0]); } // crockets
    }
    // spire lucarne (small gabled window on the spire)
    if (spireH > 30) { const ly = top - Math.round(spireH * 0.35); P.rect(Math.round(cx) - 2, ly, 5, 6, st.roof[1]); glassOut && glassOut.push(lancet(P, Math.round(cx) - 1, ly + 1, 3, 5, st, seed + 77, { sill: false })); }
    if (st.moonFinial) { const ax = Math.round(cx), ay = top - spireH; P.set(ax, ay - 2, '#f2c45a'); P.set(ax - 1, ay - 3, '#f2c45a'); P.set(ax - 1, ay - 4, '#f2c45a'); P.set(ax, ay - 5, '#f2c45a'); }
    else { const ax = Math.round(cx), ay = top - spireH; P.vline(ax, ay - 6, ay - 1, st.metal[0]); P.hline(ax - 2, ax + 2, ay - 4, st.metal[0]); P.set(ax, ay - 7, '#f2c45a'); }
  }
  function buttress(P, x, wallTop, baseY, st) {
    const s = st.stone || st.trim, h = baseY - wallTop, cap = baseY - Math.round(h * 0.78);
    for (let y = cap; y <= baseY; y++) for (let i = 0; i < 4; i++) P.set(x + i, y, s[i === 0 ? 4 : i === 3 ? 1 : (y % 5 === 4 ? 1 : 3)]);
    for (let k = 0; k < 4; k++) P.hline(x + k, x + 3, cap - 3 + k, s[k === 0 ? 4 : 3]);
    // pinnacle above the wall line
    P.rect(x + 1, wallTop - 6, 2, 6, s[3]); P.set(x + 1, wallTop - 7, s[4]); P.set(x + 2, wallTop - 7, s[2]); P.set(x + 1, wallTop - 8, st.metal[1]);
  }
  function gargoyle(P, x, y, st, flip) {
    const c = st.stone ? st.stone[1] : st.trim[0];
    const d = flip ? -1 : 1;
    P.set(x, y, c); P.set(x + d, y, c); P.set(x + 2 * d, y - 1, c); P.set(x + d, y - 1, c); P.set(x - d, y - 1, c); P.set(x + 2 * d, y, '#ff5a5a');
    P.set(x - d, y - 2, c); P.set(x, y + 1, c); P.set(x - 2 * d, y - 3, c);
  }
  function ivy(P, x, baseY, h, seed) {
    for (let y = 0; y < h; y++) { const yy = baseY - y; if (!P.has(x, yy)) continue; P.set(x, yy, y % 3 ? '#245a40' : '#337450'); if (y % 3 === 1) P.set(x + (y % 2 ? 1 : -1), yy, '#4c9061'); if (y % 5 === 2 && hash(x, y, seed + 4) < 0.4) P.set(x + (y % 2 ? -1 : 1), yy, '#74b46e'); if (hash(y, x, seed) < 0.2) x += hash(x, y, seed) < 0.5 ? 1 : -1; }
  }
  function lantern(P, x, y, st, color) {
    const m = st.metal[0];
    P.hline(x - 3, x, y - 4, m); P.set(x - 3, y - 3, m); // wall bracket
    P.set(x, y - 3, m); P.hline(x - 1, x + 1, y - 2, m); P.hline(x - 2, x + 2, y - 1, m);
    P.rect(x - 2, y, 5, 5, m); P.rect(x - 1, y, 3, 4, st.trim[0]);
    P.set(x, y + 1, color || '#ffbc62', 255, 4); P.set(x, y + 2, '#fff1c8', 255, 4); P.set(x - 1, y + 2, color || '#ffbc62', 255, 4); P.set(x + 1, y + 1, color || '#ffbc62', 255, 4);
    P.hline(x - 1, x + 1, y + 5, m); P.set(x, y + 6, m);
  }
  // a row of small blind arches holding statues (the cathedral's gallery of saints)
  function arcade(P, x0, x1, y, st, seed) {
    const s = st.stone;
    P.hline(x0 - 1, x1 + 1, y + 13, s[4]); P.hline(x0 - 1, x1 + 1, y + 14, s[1]); P.hline(x0 - 1, x1 + 1, y - 1, s[4]);
    for (let x = x0; x + 7 <= x1; x += 9) {
      for (let j = 0; j < 12; j++) for (let i = 0; i < 7; i++) { if (j < 3 && Math.abs(i - 3) > j + 0.5) continue; P.set(x + i, y + j, i === 0 ? s[4] : i === 6 ? s[1] : s[1]); }
      P.vline(x + 8, y, y + 12, s[3]);
      const c = s[5] || s[4];
      P.set(x + 3, y + 4, c); P.rect(x + 2, y + 5, 3, 6, mixc(c, '#000000', 0.15)); P.set(x + 3, y + 5, c); P.set(x + 1, y + 6, mixc(c, '#000000', 0.25)); P.set(x + 5, y + 6, mixc(c, '#000000', 0.25));
      if (hash(x, y, seed) < 0.3) P.set(x + 3, y + 3, '#f2c45a'); // a gilded halo here and there
    }
  }
  // a hanging cloth banner with a small emblem
  function banner(P, x, y, h, color, emblem) {
    const c = color || '#5a2e72', d = mixc(c, '#120c1c', 0.35), l = mixc(c, '#ffffff', 0.2);
    P.hline(x - 1, x + 7, y - 1, '#2a2733');
    for (let j = 0; j < h; j++) for (let i = 0; i < 7; i++) { if (j > h - 4 && Math.abs(i - 3) < (j - (h - 4))) continue; P.set(x + i, y + j, i === 0 ? l : i === 6 ? d : c); }
    const g = GLYPHS[emblem || 'crest'];
    if (g) for (let j = 0; j < 6; j++) for (let i = 1; i < 7; i++) if (g[j][i] === '#') P.set(x + i, y + 3 + j, '#f2c45a');
  }
  // an open forge arch with molten light inside (it glows day and night)
  function forgeArch(P, x, y, w, h, st) {
    const s = st.stone, cx = (w - 1) / 2, r = w / 2;
    const inside = (i, j) => i >= 0 && i < w && j >= 0 && j < h && !(j < r && Math.hypot(i - cx, (r - j) * 1.1) > r);
    for (let j = -3; j < h; j++) for (let i = -3; i < w + 3; i++) {
      if (inside(i, j)) continue;
      let near = false; for (let k = 1; k <= 3 && !near; k++) near = inside(i - k, j) || inside(i + k, j) || inside(i, j + k);
      if (near) P.set(x + i, y + j, (Math.floor((i + 9) / 3) + Math.floor((j + 9) / 3)) % 2 ? s[3] : s[2]);
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!inside(i, j)) continue;
      const heat = j / h;
      const c = heat > 0.75 ? (hash(i, j, 3) < 0.5 ? '#ffd27a' : '#ff9a3c') : heat > 0.45 ? '#c4521e' : '#3a1410';
      if (heat > 0.45) P.glass(x + i, y + j, c, c); else P.set(x + i, y + j, c);
    }
    for (let i = 1; i < w - 1; i += 2) P.glass(x + i, y + h - 1 - (i % 3), '#fff1c8', '#fff1c8');
    return { x, y: y + Math.floor(h / 2), w, h: Math.ceil(h / 2), glass: 'amber', big: true, always: true };
  }
  function balcony(P, x, y, w, st) {
    const m = st.metal[0];
    P.hline(x, x + w - 1, y, st.trim[2]); P.hline(x, x + w - 1, y + 1, st.trim[0]);
    P.hline(x, x + w - 1, y - 6, m);
    for (let i = 0; i < w; i += 2) P.vline(x + i, y - 5, y - 1, m);
    for (let i = 1; i < w - 1; i += 4) P.set(x + i, y - 3, st.metal[1]);
    for (let i = 2; i < w - 1; i += 5) { P.set(x + i, y + 2, st.trim[0]); P.set(x + i, y + 3, st.trim[0]); }
  }
  const GLYPHS = {
    owl: ['.#....#.', '.######.', '#o#..#o#', '.######.', '..####..', '..#..#..'],
    potion: ['...##...', '...##...', '..####..', '.######.', '.######.', '..####..'],
    hat: ['...##...', '..####..', '..####..', '.######.', '########', '........'],
    book: ['........', '.##..##.', '#..##..#', '#..##..#', '#..##..#', '.##..##.'],
    star: ['...#....', '...#....', '#######.', '..###...', '.#...#..', '........'],
    sprout: ['...##...', '..#..#..', '...##...', '....#...', '..###...', '.#####..'],
    anvil: ['........', '#######.', '.#####..', '..###...', '.#####..', '#######.'],
    fish: ['........', '..###..#', '.#####.#', '##o####.', '.#####.#', '..###..#'],
    pick: ['.####...', '#....#..', '....#...', '...#....', '..#.....', '.#......'],
    needle: ['#.....#.', '.#...#..', '..#.#...', '...#....', '..#.#...', '.##.##..'],
    moon: ['..###...', '.#......', '#.......', '#.......', '.#......', '..###...'],
    skull: ['.#####..', '#######.', '#.##.##.', '#######.', '.##.##..', '.#.#.#..'],
    lantern: ['...#....', '..###...', '.#####..', '.##o##..', '.#####..', '..###...'],
    crest: ['#......#', '.#....#.', '..#..#..', '...##...', '.#.##.#.', '##....##'],
    paw: ['.#..#...', '.#..#...', '#.##.#..', '.####...', '.####...', '..##....'],
    dragon: ['##....##', '.##..##.', '..####..', '.##o###.', '..####..', '.#..#...'],
    horse: ['..###...', '.####...', '##o###..', '..####..', '..#.#...', '..#.#...'],
  };
  const GLYPH_COL = { owl: '#f2c45a', star: '#f2c45a', potion: '#b99aee', sprout: '#74b46e', fish: '#69a1db', skull: '#e8eeff', needle: '#e8dcc8', moon: '#e8eeff', lantern: '#ffbc62', crest: '#e8eeff', paw: '#f2c45a', dragon: '#5dffb0', horse: '#e8dcc8', anvil: '#9fd6ff' };
  function signBoard(P, x, y, icon, st, hang) {
    const m = st.metal[0];
    if (hang) { P.hline(x - 4, x + 11, y, m); P.set(x - 4, y + 1, m); P.set(x - 3, y + 2, m); P.set(x + 1, y + 1, m); P.set(x + 7, y + 1, m); } // wrought bracket
    else { P.hline(x - 2, x + 9, y, m); P.set(x, y + 1, m); P.set(x + 7, y + 1, m); }
    P.rect(x - 1, y + 2, 10, 9, st.trim[0]); P.rect(x, y + 3, 8, 7, '#7a5a48'); P.hline(x, x + 7, y + 3, '#9c7a5e');
    const glyph = GLYPHS[icon];
    if (glyph) for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) { const ch = glyph[j][i]; if (ch === '#') P.set(x + i, y + 3 + j + (j > 0 ? 0 : 0), GLYPH_COL[icon] || '#e8dcc8'); else if (ch === 'o') P.set(x + i, y + 3 + j, OUT); }
  }

  // ------------------------------------------------------------------ building assembly
  // spec: { w, wallH, roofH, floors, mat?, steep, over:{style overrides}, groundStone,
  //   gables:[{cx,hw,h,win}], dormers:[cx], chimneys:[x], turret:{side,w,h,coneH,windows,cap,vane},
  //   tower | towers:[{x,w,h,spireH,full,clock,broken}], buttresses:[x], pinnacles:[x],
  //   door:{x,w,h,style}, windows:[{x,y,w,h,type,r,shutters,box,goods,dark}], awnings:[{x,y,w,colors}],
  //   balconies:[{x,y,w}], niches:[{x,y}], sign:{x,y,icon,hang}, lanterns:[{x,y}], ivy:n, gargoyles, seed }
  function makeBuilding(spec, styleKey) {
    const st = Object.assign({}, STYLES[styleKey] || STYLES.cathedral, spec.over || {}), seed = spec.seed || 7;
    const mat = spec.mat || st.wall;
    const towers = spec.towers || (spec.tower ? [spec.tower] : []);
    const extraTop = Math.max(
      spec.turret ? spec.turret.h + (spec.turret.cap === 'dome' ? spec.turret.w * 0.6 + 18 : spec.turret.coneH + 18) - spec.wallH : 0,
      ...towers.map((t) => t.h + (t.broken ? 4 : t.spireH + 12) - spec.wallH),
      spec.roofH + 12 + (spec.chimneys && spec.chimneys.length ? 18 : 0),
      ...(spec.gables || []).map((g) => g.h + 12));
    const tOut = spec.turret ? Math.max(0, spec.turret.w - 6) : 0;
    const padL = 6 + (spec.turret && spec.turret.side === 'left' ? tOut : 0) + (towers.some((t) => t.x < 0) ? -Math.min(...towers.map((t) => t.x)) : 0);
    const padR = 6 + (st.lean || 0) + (spec.turret && spec.turret.side === 'right' ? tOut : 0) + Math.max(0, ...towers.map((t) => t.x + t.w - spec.w));
    const W = Math.ceil(spec.w + padL + padR), H = Math.ceil(spec.wallH + extraTop + 2);
    const P = new Pix(W, H);
    const bx = padL, baseY = H - 1, wallTop = baseY - spec.wallH;
    const glass = [], smoke = [], lanternPts = [];
    const jetty = st.jetty && spec.floors >= 2 && mat !== 'stone';
    const floorY = wallTop + Math.round(spec.wallH * (spec.floorAt || 0.48));
    // towers behind the main block
    for (const t of towers) if (!t.full) tower(P, bx + t.x, t.w, baseY - t.h, baseY - spec.wallH + 4, t.spireH, st, seed + t.x, t, glass);
    // main roof
    const roofTop = wallTop - spec.roofH;
    mainRoof(P, bx - 2, bx + spec.w + 1, roofTop, wallTop + 1, st, seed, spec.steep || 0.22);
    // chimneys (behind gables)
    for (const cxp of spec.chimneys || []) { const s = chimney(P, bx + cxp, roofTop - 8 - ((hash(cxp, 1, seed) * 6) | 0), wallTop - 2, st, seed + cxp, st.crooked); if (spec.smokeColor) s.color = spec.smokeColor; smoke.push(s); }
    // walls
    const groundMat = spec.groundStone ? 'stone' : mat === 'timber' ? 'timber' : mat;
    if (jetty) {
      wallFill(P, bx + 2, floorY, spec.w - 4, baseY - floorY - 2, st, seed, groundMat, { posts: groundMat === 'timber' ? [Math.round(spec.w * 0.33), Math.round(spec.w * 0.66)] : [], braces: [], quoins: spec.groundStone });
      wallFill(P, bx, wallTop, spec.w, floorY - wallTop, st, seed + 1, mat, { posts: [Math.round(spec.w * 0.25), Math.round(spec.w * 0.5), Math.round(spec.w * 0.75)], braces: [[3, 10], [spec.w - 4, spec.w - 11]] });
      P.hline(bx, bx + spec.w - 1, floorY, st.trim[1]); P.hline(bx, bx + spec.w - 1, floorY + 1, st.trim[2]); P.hline(bx + 2, bx + spec.w - 3, floorY + 2, OUT);
      // carved corbels under the jetty
      for (let x = bx + 3; x < bx + spec.w - 3; x += Math.max(8, Math.round(spec.w / 6))) { P.set(x, floorY + 2, st.trim[2]); P.set(x, floorY + 3, st.trim[1]); P.set(x + 1, floorY + 2, st.trim[1]); }
    } else wallFill(P, bx, wallTop, spec.w, spec.wallH - 2, st, seed, mat, { posts: mat === 'timber' ? [Math.round(spec.w * 0.33), Math.round(spec.w * 0.66)] : [], rail: spec.floors >= 2 ? floorY - wallTop : null, quoins: spec.quoins });
    // plinth
    const s = st.stone;
    P.hline(bx, bx + spec.w - 1, baseY - 2, s[4]); P.hline(bx, bx + spec.w - 1, baseY - 1, s[2]); P.hline(bx, bx + spec.w - 1, baseY, s[1]);
    // eave shadow
    for (let x = bx; x < bx + spec.w; x++) { P.shade(x, wallTop + 2, 0.4); P.shade(x, wallTop + 3, 0.2); }
    // string course + pinnacles on stone fronts
    if (mat === 'stone' && spec.floors >= 2) { P.hline(bx, bx + spec.w - 1, floorY, s[4]); P.hline(bx, bx + spec.w - 1, floorY + 1, s[1]); }
    for (const x of spec.pinnacles || []) { P.rect(bx + x, wallTop - 7, 3, 7, s[3]); P.set(bx + x + 1, wallTop - 8, s[4]); P.set(bx + x + 1, wallTop - 9, st.metal[1]); }
    // cross gables (in front of the roof)
    for (const g of spec.gables || []) crossGable(P, bx + g.cx, wallTop - g.h, wallTop + 1, g.hw, st, seed + g.cx, g.mat || (mat === 'boards' ? 'boards' : mat), g.win || (mat === 'timber' || mat === 'boards' ? 'casement' : 'lancet'), glass);
    for (const dx of spec.dormers || []) dormer(P, bx + dx, wallTop - 1, st, seed + dx, glass);
    // buttresses
    for (const x of spec.buttresses || []) buttress(P, bx + x, wallTop, baseY, st);
    // windows
    const defType = mat === 'timber' || mat === 'boards' ? 'casement' : 'lancet';
    for (const w of spec.windows || []) {
      const y = wallTop + w.y, type = w.type || defType;
      if (type === 'rose') glass.push(rose(P, bx + w.x, y, w.r || 6, st, seed + w.x));
      else if (type === 'round') glass.push(roundWin(P, bx + w.x, y, w.r || 3, st, seed));
      else if (type === 'casement') glass.push(casement(P, bx + w.x, y, w.w || 7, w.h || 9, st, seed + w.x * 3 + w.y, w));
      else if (type === 'shop') glass.push(shopWindow(P, bx + w.x, y, w.w || 18, w.h || 13, st, seed + w.x, w));
      else glass.push(lancet(P, bx + w.x, y, w.w || 7, w.h || 11, st, seed + w.x * 3 + w.y, w));
    }
    for (const n of spec.niches || []) niche(P, bx + n.x, wallTop + n.y, st, seed);
    if (spec.arcade) arcade(P, bx + spec.arcade.x0, bx + spec.arcade.x1, wallTop + spec.arcade.y, st, seed);
    for (const a of spec.awnings || []) awning(P, bx + a.x, wallTop + a.y, a.w, a.colors, st);
    for (const b of spec.balconies || []) balcony(P, bx + b.x, wallTop + b.y, b.w, st);
    for (const b of spec.banners || []) banner(P, bx + b.x, wallTop + b.y, b.h || 16, b.color, b.emblem);
    if (spec.forge) glass.push(forgeArch(P, bx + spec.forge.x, baseY - 2 - spec.forge.h, spec.forge.w, spec.forge.h, st));
    if (spec.door) door(P, bx + spec.door.x, baseY - 2 - spec.door.h, spec.door.w, spec.door.h, st, seed, spec.door.style || (mat === 'timber' || mat === 'boards' ? 'round' : 'arch'));
    // full-height towers in front of the facade
    for (const t of towers) if (t.full) { tower(P, bx + t.x, t.w, baseY - t.h, baseY - 1, t.spireH, st, seed + t.x, t, glass); P.hline(bx + t.x - 2, bx + t.x + t.w + 1, baseY - 1, s[2]); P.hline(bx + t.x - 2, bx + t.x + t.w + 1, baseY, s[1]); }
    // turret (in front, at a corner)
    if (spec.turret) {
      const t = spec.turret, tx = t.side === 'left' ? bx - t.w + 6 : bx + spec.w - 6;
      turret(P, tx, t.w, baseY - t.h, baseY - 1, t.coneH, st, seed + 31, t, glass);
      P.hline(tx, tx + t.w - 1, baseY - 1, s[2]); P.hline(tx, tx + t.w - 1, baseY, s[1]);
    }
    if (st.gargoyles || spec.gargoyles) { gargoyle(P, bx + 1, wallTop + 1, st, true); gargoyle(P, bx + spec.w - 2, wallTop + 1, st, false); }
    for (let k = 0; k < (spec.ivy != null ? spec.ivy : st.mossy ? 6 : 3); k++) ivy(P, bx + 3 + Math.floor(hash(k, 1, seed) * (spec.w - 6)), baseY - 3, 8 + Math.floor(hash(k, 2, seed) * spec.wallH * 0.7), seed + k);
    for (const L of spec.lanterns || []) { lantern(P, bx + L.x, wallTop + L.y, st, st.glass === 'witch' ? '#5dffb0' : undefined); lanternPts.push([bx + L.x, wallTop + L.y]); }
    if (spec.sign) signBoard(P, bx + spec.sign.x, wallTop + spec.sign.y, spec.sign.icon, st, spec.sign.hang);
    if (spec.extra) spec.extra(P, { bx, baseY, wallTop, roofTop, st, glass, lanternPts, hash, mixc });
    P.outline(OUT);
    // night version: light the glass
    const N = P.clone();
    for (let i = 0; i < N.d.length; i++) {
      const tg = N.tag[i];
      if (!tg) continue;
      const x = i % W, y = (i / W) | 0;
      const gk = glassAt(glass, x, y) || st.glass, g = GLASS[gk] || GLASS.warm;
      let c;
      if (N.nc[i]) { N.d[i] = N.nc[i]; continue; }
      if (tg === 4) c = '#fff1c8';
      else if (g.mosaic) { c = g.mosaic[Math.floor(hash(x >> 1, y >> 1, seed) * g.mosaic.length)]; if (hash(x, y, seed + 5) < 0.2) c = mixc(c, '#ffffff', 0.45); }
      else c = g.night[hash(x, y, seed) < 0.25 ? 3 : hash(x, y, seed + 1) < 0.5 ? 2 : 1];
      N.d[i] = pack(c);
    }
    const lean = st.lean || 0;
    P.shear(lean); N.shear(lean);
    // one light per window (stained glass throws light the colour of its panes), sheared like the art
    const lights = [];
    for (const g of glass) {
      if (!g || g.dark) continue;
      const gx = g.x + g.w / 2, gy = g.y + g.h / 2, dx = P.shearDx(gy, lean);
      const gl = GLASS[g.glass] || GLASS.warm;
      const area = Math.sqrt(g.w * g.h);
      if (gl.mosaic && area > 9) {
        const n = Math.max(1, Math.round(g.h / 14));
        for (let k = 0; k < n; k++) { const yy = g.y + (g.h * (k + 0.5)) / n; lights.push({ x: gx + P.shearDx(yy, lean), y: yy, r: 14 + area * 1.1, color: rgb(gl.mosaic[(k + Math.floor(g.x / 7)) % gl.mosaic.length]), i: 0.55, night: true, flicker: 1 }); }
      } else lights.push({ x: gx + dx, y: gy, r: Math.min(70, 16 + area * (g.big ? 2.6 : 1.9)), color: gl.light, i: g.big ? 0.85 : 0.6, night: !g.always, flicker: 1 });
    }
    for (const [lx, ly] of lanternPts) lights.push({ x: lx + P.shearDx(ly, lean), y: ly + 1, r: 46, color: st.glass === 'witch' ? [93, 255, 160] : [255, 188, 98], i: 0.9, night: true, flicker: 1 });
    for (const sm of smoke) sm.x += P.shearDx(sm.y, lean);
    return { day: P.canvas(), night: N.canvas(), dayPix: P, nightPix: N, W, H, ax: bx + spec.w / 2, ay: baseY, lights, smoke, door: spec.door ? { x: bx + spec.door.x + spec.door.w / 2, y: baseY } : null, padL, padR };
  }
  function glassAt(glass, x, y) { for (const g of glass) if (g && x >= g.x - 1 && x <= g.x + g.w && y >= g.y - 1 && y <= g.y + g.h) return g.glass; return null; }

  // ------------------------------------------------------------------ ruins (the Deepwood)
  // kind: 'watchtower' | 'chapel' | 'arch'
  function makeRuin(kind, styleKey, seed) {
    const st = Object.assign({}, STYLES[styleKey] || STYLES.witchwood);
    seed = seed || 5;
    const s = st.stone;
    let P, W, H, bx, baseY, ax;
    const glass = [];
    const rubble = (x0, x1) => { for (let x = x0; x <= x1; x++) { const h = Math.floor(noise(x / 2.5, 3, seed) * 4); for (let j = 0; j < h; j++) P.set(x, baseY - j, s[hash(x, j, seed) < 0.5 ? 2 : 3]); if (hash(x, 9, seed) < 0.2) P.set(x, baseY - h, '#3b6e42'); } };
    if (kind === 'watchtower') {
      W = 64; H = 128; P = new Pix(W, H); bx = 14; baseY = H - 1; ax = 32;
      const tw = 36, top = 26;
      // tapering round tower
      for (let y = top; y <= baseY; y++) {
        const k = (y - top) / (baseY - top), half = tw / 2 + k * 3, x0 = Math.round(ax - half), x1 = Math.round(ax + half);
        for (let x = x0; x <= x1; x++) {
          const t = (x - x0) / (x1 - x0 + 0.01), light = Math.cos((t - 0.3) * Math.PI);
          const course = Math.floor((y - top) / 5), off = course % 2 ? 4 : 0;
          let c = s[light > 0.8 ? 4 : light > 0.45 ? 3 : light > 0.05 ? 2 : 1];
          if ((y - top) % 5 === 4 || (x + off) % 7 === 0) c = s[Math.max(0, (light > 0.45 ? 2 : 1))];
          if (noise(x / 4, y / 5, seed + 3) > 0.7) c = mixc(c, '#2f5a36', 0.5);
          P.set(x, y, c);
        }
      }
      // jagged broken top + a collapsed bite out of one side
      for (let x = 0; x < W; x++) { const cut = top + Math.round(noise(x / 3.2, 1, seed) * 14) - 4 + (x > ax + 4 ? Math.round((x - ax - 4) * 0.9) : 0); for (let y = 0; y < cut; y++) P.clear(x, y); }
      // arrow slits, a gaping hole, the arched doorway
      for (const [x, y] of [[ax - 8, top + 24], [ax + 6, top + 44], [ax - 4, top + 62]]) { P.rect(x, y, 2, 7, '#0b0a12'); P.set(x, y - 1, s[1]); }
      P.disc(ax + 7, top + 22, 5, 6, '#0d0b14'); P.disc(ax + 6, top + 22, 4, 5, '#15121e');
      door(P, ax - 6, baseY - 22, 12, 20, st, seed, 'arch');
      for (let j = 0; j < 20; j++) for (let i = 0; i < 12; i++) if (P.has(ax - 6 + i, baseY - 22 + j)) { const c = P.get(ax - 6 + i, baseY - 22 + j); if (c && c[0] < 140 && c[2] < 120) P.set(ax - 6 + i, baseY - 22 + j, j > 14 ? '#0d0b14' : '#120f1a'); } // the door is long gone: a dark opening
      for (let k = 0; k < 9; k++) ivy(P, ax - 18 + Math.floor(hash(k, 1, seed) * 36), baseY - 2, 20 + Math.floor(hash(k, 2, seed) * 60), seed + k);
      rubble(2, W - 3);
      // a little witch-green lantern someone still keeps lit
      lantern(P, ax + 10, baseY - 26, st, '#5dffb0');
      glass.push({ x: ax + 9, y: baseY - 27, w: 3, h: 4, glass: 'witch' });
    } else if (kind === 'chapel') {
      W = 112; H = 92; P = new Pix(W, H); bx = 8; baseY = H - 1; ax = 56;
      const w = 96, wallH = 44, wallTop = baseY - wallH;
      wallFill(P, bx, wallTop, w, wallH - 2, st, seed, 'stone', {});
      // the gable end, broken
      crossGable(P, ax, wallTop - 34, wallTop + 1, 30, st, seed, 'stone', null, null);
      for (let x = 0; x < W; x++) { const cut = wallTop - 40 + Math.round(noise(x / 4, 2, seed) * 30) + (Math.abs(x - ax) > 30 ? 34 : 0); for (let y = 0; y < cut; y++) P.clear(x, y); }
      // empty lancet frames (no glass left) and a sky-through rose
      for (const x of [bx + 8, bx + 22, bx + 66, bx + 80]) { lancet(P, x, wallTop + 8, 8, 20, st, seed + x, { dark: true }); for (let j = 0; j < 20; j++) for (let i = 0; i < 8; i++) { const c = P.get(x + i, wallTop + 8 + j); if (c && (c[2] > c[0] + 8)) P.set(x + i, wallTop + 8 + j, '#0d0b14'); } }
      P.disc(ax, wallTop - 12, 7, 7, s[1]); P.disc(ax, wallTop - 12, 5, 5, '#0d0b14');
      door(P, ax - 7, baseY - 26, 14, 24, st, seed, 'arch');
      for (let j = 0; j < 24; j++) for (let i = 0; i < 14; i++) { const c = P.get(ax - 7 + i, baseY - 26 + j); if (c && c[0] < 160 && c[0] > 30 && c[1] < 100) P.set(ax - 7 + i, baseY - 26 + j, '#100d18'); }
      for (const x of [bx - 2, bx + 34, bx + 58, bx + w - 2]) buttress(P, x, wallTop, baseY, st);
      for (let k = 0; k < 12; k++) ivy(P, bx + 2 + Math.floor(hash(k, 1, seed) * (w - 4)), baseY - 2, 14 + Math.floor(hash(k, 2, seed) * 40), seed + k);
      rubble(0, W - 1);
      lantern(P, ax + 10, baseY - 30, st, '#5dffb0'); glass.push({ x: ax + 9, y: baseY - 31, w: 3, h: 4, glass: 'witch' });
    } else { // arch: a lone ruined Gothic arch
      W = 56; H = 70; P = new Pix(W, H); baseY = H - 1; ax = 28;
      for (const px of [10, 40]) for (let y = 14; y <= baseY; y++) for (let i = 0; i < 6; i++) P.set(px + i, y, s[i === 0 ? 4 : i === 5 ? 1 : ((y >> 2) + i) % 4 === 0 ? 2 : 3]);
      for (let a = 0; a <= 40; a++) { const t = a / 40; const x = Math.round(13 + t * 30), y = Math.round(14 - Math.sin(t * Math.PI) * 12); P.rect(x - 2, y - 2, 5, 5, s[3]); P.set(x, y - 2, s[4]); }
      for (let x = 30; x < 46; x++) for (let y = 0; y < 14 - Math.round(noise(x / 2, 4, seed) * 8); y++) P.clear(x, y); // a chunk fallen out
      for (let k = 0; k < 4; k++) ivy(P, 11 + k * 9, baseY - 1, 20 + k * 6, seed + k);
      rubble(2, W - 3);
    }
    P.outline(OUT);
    const N = P.clone();
    for (let i = 0; i < N.d.length; i++) if (N.tag[i] === 4) N.d[i] = pack('#e0ffe8');
    const lights = glass.map((g) => ({ x: g.x + 1, y: g.y + 2, r: 44, color: [93, 255, 160], i: 0.85, night: true, flicker: 1 }));
    return { day: P.canvas(), night: N.canvas(), dayPix: P, nightPix: N, W, H, ax, ay: baseY, lights, smoke: [], door: { x: ax, y: baseY }, padL: 0, padR: 0 };
  }

  window.GothicArt = { STYLES, GLASS, makeBuilding, makeRuin, Pix, hash, noise, mixc };
})();
