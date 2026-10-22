// Nightvale — interior art: room surfaces (floors, back walls, reflecting pools, the aisle runner) and the
// furniture and fixtures of three walk-in interiors: The Gilded Owl tavern, Quillon's Threads & Tomes (a rusty
// old bookshop that sells clothes) and the Cathedral of the Silver Veil.
// Self-contained (own pixel painter), deterministic and cached. Defines exactly one global: window.InteriorArt.
//
//   InteriorArt.piece(id, variant)  -> { c, n?, frames?, fps?, ax, ay, foot:[fw,fh], solid, lights:[...],
//                                        flat?, overhead?, wall?, nLights? }   (null for an unknown id)
//       (ax, ay) lands on the bottom-centre pixel of the footprint: world (tx*16 + fw*8, (ty+fh)*16 - 1).
//       Optional extras: nLights = lights to use with the night canvas `n` (windows); poses = the distinct
//       frames when `frames` repeats them for timing (crow); fade = tall piece worth fading when the player is
//       behind it; stageLift = px a performer stands above the stage footprint; againstWall = bookshelf hint;
//       niches (collection_cabinet) = the 24 display slots, row-major 6x4, as [{x, y, w, h}] in sprite pixels.
//       Variants out of range wrap around.
//   InteriorArt.floor(kind, wPx, hPx, seed)        kind: tavern | boutique | cathedral | cottage | stone | alt | pastel |
//                                                   study | smithy | menagerie | guild, and the rare Depths floors
//                                                   library | witch | observatory | crystal
//   InteriorArt.wall(kind, wPx, hPx, seed, opts?)  kind: tavern | boutique | cathedral | cottage | alt | pastel | study |
//                                                   smithy | menagerie | guild
//       opts.posts (tavern, cottage, guild) / opts.columns (cathedral): x centres in px of the timber posts or engaged
//       columns; default every 4 tiles (64 px) from x = 64 (56 px for the cottage). [] for none.
//   InteriorArt.pool(wPx, hPx, hue, seed)          -> { c, shimmer:[x0,y0,x1,y1,...], lights }
//       hue: rose | azure | gold | violet | emerald; lights (canvas px) are an optional glow for the water.
//   InteriorArt.runner(wPx, hPx, seed)              vertical when hPx >= wPx, otherwise horizontal
//   InteriorArt.ids, InteriorArt.variants[id], InteriorArt.WALL_H (back-wall height in px per room kind)
// Sprites are drawn at 1x, lit from the upper left, outlined in #120c1c (selectively: a deep tint of the
// material on the lit top/left edges). Light entries are in sprite pixels and never carry `night`.
(function () {
  'use strict';

  // ================================================================== painter
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y, s) => noise(x, y, s) * 0.6 + noise(x * 2.3, y * 2.3, s + 31) * 0.28 + noise(x * 5.1, y * 5.1, s + 57) * 0.12;
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
  const bay = (x, y) => BAY[(y & 3) * 4 + (x & 3)];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const OUT = '#120c1c';

  const rgbCache = new Map();
  function rgb(c) {
    if (Array.isArray(c)) return c;
    let v = rgbCache.get(c);
    if (!v) { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbCache.set(c, v); }
    return v;
  }
  function pack(c, a) {
    c = rgb(c); a = a == null ? 255 : clamp(Math.round(a), 0, 255);
    return ((a << 24) | (clamp(Math.round(c[2]), 0, 255) << 16) | (clamp(Math.round(c[1]), 0, 255) << 8) | clamp(Math.round(c[0]), 0, 255)) >>> 0;
  }
  const pkCache = new Map();
  function pk(c) { let v = pkCache.get(c); if (v === undefined) { v = pack(c); pkCache.set(c, v); } return v; }
  function mix(a, b, t) { a = rgb(a); b = rgb(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  // pick from a ramp (dark -> light) at t in 0..1 with an ordered dither between neighbouring steps
  function rampAt(R, t, x, y) { const f = clamp(t, 0, 0.9999) * (R.length - 1), i = Math.floor(f); return R[Math.min(R.length - 1, i + (bay(x, y) < f - i ? 1 : 0))]; }

  class Pix {
    constructor(w, h) { this.w = w | 0; this.h = h | 0; this.d = new Uint32Array(this.w * this.h); }
    set(x, y, c, a) {
      x = Math.round(x); y = Math.round(y);
      if (c == null || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.d[y * this.w + x] = typeof c === 'number' ? c : a == null && typeof c === 'string' ? pk(c) : pack(c, a);
    }
    get(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
    A(x, y) { return this.get(x, y) >>> 24; }
    has(x, y) { return this.A(x, y) > 0; }
    solid(x, y) { return this.A(x, y) >= 200; }
    rgbOf(x, y) { const v = this.get(x, y); return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255]; }
    tint(x, y, c, t) { x = Math.round(x); y = Math.round(y); if (!this.has(x, y)) return; const v = this.get(x, y); this.d[y * this.w + x] = pack(mix(this.rgbOf(x, y), c, t), v >>> 24); }
    dark(x, y, t) { this.tint(x, y, OUT, t); }
    rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
    hline(x0, x1, y, c) { if (x0 > x1) { const t = x0; x0 = x1; x1 = t; } for (let x = x0; x <= x1; x++) this.set(x, y, c); }
    vline(x, y0, y1, c) { if (y0 > y1) { const t = y0; y0 = y1; y1 = t; } for (let y = y0; y <= y1; y++) this.set(x, y, c); }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
      for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    }
    // visit the pixels of a filled ellipse (centre may be fractional): fn(x, y, nx, ny), nx/ny in -1..1
    ell(cx, cy, rx, ry, fn) {
      for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x - cx) / (rx + 0.001), ny = (y - cy) / (ry + 0.001);
        if (nx * nx + ny * ny <= 1.0) fn(x, y, nx, ny);
      }
    }
    disc(cx, cy, rx, ry, c) { this.ell(cx, cy, rx, ry, (x, y) => this.set(x, y, c)); }
    // 1px outline into empty pixels around opaque ones. Selective: on the lit top/left edges the line is a
    // deep tint of the material it borders; on the shadow side it is the outline colour itself.
    outline(c) {
      const add = [], col = c || OUT, v = pk(col);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.has(x, y)) continue;
        const l = this.solid(x - 1, y), r = this.solid(x + 1, y), u = this.solid(x, y - 1), d = this.solid(x, y + 1);
        if (!(l || r || u || d)) continue;
        let px = v;
        if (!l && !u && (r || d)) { const nx = r ? x + 1 : x, ny = r ? y : y + 1; px = pack(mix(this.rgbOf(nx, ny), col, 0.62)); }
        add.push(x, y, px);
      }
      for (let i = 0; i < add.length; i += 3) this.d[add[i + 1] * this.w + add[i]] = add[i + 2];
    }
    shadow(cx, cy, rx, ry, a) { // soft floor shadow, only where nothing is drawn yet
      a = a == null ? 0.34 : a;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);
        if (d <= 1 && !this.has(x, y)) this.set(x, y, '#0e0818', a * 255 * (d < 0.5 ? 1 : 0.62));
      }
    }
    clone() { const p = new Pix(this.w, this.h); p.d.set(this.d); return p; }
    blit(src, dx, dy) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const v = src.d[y * src.w + x]; if (v >>> 24) this.set(x + dx, y + dy, v); } }
    flipX() { const p = new Pix(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) p.d[y * this.w + (this.w - 1 - x)] = this.d[y * this.w + x]; return p; }
    canvas() {
      const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
      const g = c.getContext('2d'), img = g.createImageData(this.w, this.h);
      new Uint32Array(img.data.buffer).set(this.d); g.putImageData(img, 0, 0); return c;
    }
  }

  // ================================================================== palette (DESIGN.md "Twilight Hollow" + derived ramps, dark -> light)
  const AMBER = '#ffbc62', GOLDC = '#f2c45a', CANDLE = '#fff1c8', ORANGE = '#e8843c', EMBERC = '#c44a3a';
  const OAK = ['#1a1015', '#281a1d', '#382424', '#4a302c', '#5e3e34', '#74503f', '#8e664e']; // the Gilded Owl's dark polished oak
  const HONEY = ['#2a1a16', '#43291e', '#5c3a26', '#774c30', '#92623c', '#ad7c4c', '#c99a62']; // Quillon's honey wood
  const WALNUT = ['#140e14', '#21161c', '#302026', '#412b2f', '#553a3b', '#6c4c49', '#86625b']; // cathedral dark wood
  const WOOD = ['#281d21', '#3e2d2b', '#574039', '#7a5a48', '#9c7a5e', '#b8977a'];
  const GOLD = ['#3e2618', '#6e4426', '#a8702e', '#d6a040', '#f2c45a', '#ffe08a', '#fff4c8'];
  const BRASS = ['#2e2018', '#56391e', '#86622a', '#b48c3c', '#dcba5e', '#f6e2a0'];
  const COPPER = ['#3a1e26', '#6e3a2e', '#a85a36', '#d6824a', '#f0aa70', '#fcd6a8'];
  const IRON = ['#100c16', '#1c1724', '#2a2334', '#3a3146', '#4c425a', '#625872'];
  const SILVER = ['#34344c', '#56567a', '#7e7ea0', '#a6a6c4', '#cacae0', '#ececfa', '#ffffff'];
  const MARBLE = ['#4c4a62', '#6a6884', '#8c8aa6', '#adabc4', '#cbc9de', '#e4e2f0', '#f8f6ff'];
  const PSTONE = ['#2e2c3c', '#403e50', '#545266', '#69677e', '#807e96', '#9896ae', '#b0aec4', '#c8c6da']; // pale cathedral ashlar
  const HSTONE = ['#221c26', '#332a36', '#463b48', '#5a4d5a', '#6f616c', '#877880', '#a29298']; // warm hearth stone
  const STONE = ['#2d2c3e', '#45445a', '#605f78', '#7e7d97', '#a09fb6', '#c4c3d6'];
  const WAX = ['#7a6a6a', '#a8988e', '#d2c4b2', '#ece2ce', '#fbf6ea'];
  const PAPER = ['#6e5e6e', '#a8949a', '#d8c6b4', '#f2e6d0', '#fffaf0'];
  const PLUM = ['#1e0c1c', '#34142e', '#4c1e44', '#66285a', '#823a72', '#a0568c'];
  const WINE = ['#220a12', '#3c101e', '#58182a', '#76223a', '#94344a', '#b04e5e'];
  const VIOLET = ['#160c2a', '#24143e', '#341e56', '#46296e', '#5a3888', '#7350a6', '#9070c4'];
  const MIDNIGHT = ['#0c0e24', '#151a3a', '#1f2754', '#2b3670', '#3c4a8e', '#5464ae'];
  const FOREST = ['#0e2018', '#173226', '#214636', '#2e5c46', '#40765a', '#5a9070'];
  const TEALC = ['#0c2228', '#14363c', '#1e4e52', '#2a686a', '#3c8484', '#58a09c'];
  const OCHRE = ['#2e1c0c', '#4c3014', '#6e4a1e', '#94682a', '#b8883a', '#d4a858'];
  const CHAR = ['#0e0a14', '#18121e', '#241c2c', '#32283c', '#42364e', '#564a64'];
  const LAV = ['#4a4060', '#6a5e88', '#8e82ae', '#b0a6cc', '#d0c8e6', '#ece8f8'];
  const CRIMSON = ['#2a0810', '#4a0e1a', '#6e1626', '#962234', '#ba3644', '#d85a5a'];
  const LEAF = ['#10302a', '#1a4434', '#245a40', '#337450', '#4c9061', '#74b46e'];
  const MAGIC = ['#4a2f7a', '#6a47a8', '#8f6cd1', '#b99aee', '#e4d2ff'];
  const EMER = ['#0e4a34', '#1f8a5a', '#2fbf7f', '#5dffb0', '#b4ffd9', '#ecfff6'];
  const MOON = ['#9fb0d8', '#c8d4f0', '#e8eeff', '#ffffff'];
  const TERRA = ['#3a1c1c', '#5e2c24', '#82402e', '#a4583a', '#c4764c'];
  const LIQ = { // potion liquids: dark, mid, light, glow core
    rose: ['#5a1838', '#a83a72', '#e874a8', '#ffd0e4'], violet: ['#341a62', '#6a44b4', '#a884ec', '#efe2ff'],
    emerald: ['#0c4630', '#1c9460', '#5dffb0', '#dcfff0'], amber: ['#6e3410', '#c8722a', '#ffbc62', '#fff1c8'],
    azure: ['#142c66', '#2c62bc', '#6aa6e6', '#dcf0ff'], red: ['#4a0e1c', '#9a2232', '#e0503e', '#ffc8b0'],
    teal: ['#0c3838', '#1c7670', '#4ccfc0', '#d4fff6'], gold: ['#5a3a10', '#ae7a20', '#f2c45a', '#fff6c8'],
    moss: ['#1e2a14', '#3c5222', '#6a8a3a', '#c4dc8a'], wine: ['#2a0a1a', '#5a1430', '#942a4a', '#e88aa8'],
  };
  const LIQ_RGB = { rose: [240, 120, 180], violet: [176, 136, 255], emerald: [93, 255, 176], amber: [255, 188, 98], azure: [110, 170, 255], red: [255, 110, 80], teal: [90, 230, 210], gold: [255, 210, 110], moss: [170, 220, 120], wine: [230, 110, 150] };
  const GLASS = ['#2e3048', '#4a5070', '#7882a6', '#b4c0dc'];
  const FLAMES = { // tip, outer, inner, core
    warm: ['#e8843c', '#ffbc62', '#ffe0a0', '#fff8e4'], witch: ['#1f8a5a', '#3fd88a', '#9affc8', '#effff6'],
    violet: ['#6a47a8', '#9a78e0', '#cdb4ff', '#f6f0ff'], ember: ['#c44a3a', '#e8843c', '#ffbc62', '#fff1c8'],
  };
  const L_CANDLE = [255, 194, 120], L_WITCH = [93, 255, 160], L_LAMP = [255, 150, 70];

  // ================================================================== shared bits
  // a small flame above (x, y): y is the first row of the flame; f = frame, size 0 (tiny) | 1 (candle) | 2 (big)
  function flame(P, x, y, f, kind, size) {
    const F = FLAMES[kind || 'warm'];
    const sway = [0, 0, 1, -1][f & 3], tall = (f & 3) === 1 ? 1 : 0;
    if (!size) { P.set(x, y, F[3]); P.set(x, y - 1, F[2]); P.set(x + ((f & 3) === 2 ? 1 : 0), y - 2 - tall, F[0]); if (tall) P.set(x, y - 2, F[1]); return; }
    if (size === 1) {
      P.set(x, y, F[3]); P.set(x, y - 1, F[2]); P.set(x, y - 2, F[1]); P.set(x + (sway > 0 ? 1 : 0), y - 3, F[0]);
      if (tall) P.set(x, y - 3, F[1]), P.set(x + sway, y - 4, F[0]);
      if ((f & 3) === 3) P.set(x - 1, y - 1, F[1]);
      return;
    }
    // size 2: 3 px wide at the base
    P.set(x - 1, y, F[1]); P.set(x, y, F[3]); P.set(x + 1, y, F[1]);
    P.set(x - 1, y - 1, F[1]); P.set(x, y - 1, F[3]); P.set(x + 1, y - 1, F[2]);
    P.set(x, y - 2, F[2]); P.set(x + (sway > 0 ? 1 : 0), y - 3, F[1]); P.set(x + sway, y - 4 - tall, F[0]);
    if (tall) P.set(x, y - 4, F[1]);
  }
  // candle: body of height h standing on row `by` (its lowest pixel), x = left column; w = 1 or 2 px
  function candle(P, x, by, h, w, f, kind, size, wax) {
    const WX = wax || WAX;
    for (let j = 0; j < h; j++) {
      const y = by - j;
      if (w === 1) P.set(x, y, WX[j === h - 1 ? 4 : 3]);
      else { P.set(x, y, WX[j === h - 1 ? 4 : 3]); P.set(x + 1, y, WX[j === h - 1 ? 3 : 1]); }
    }
    if (h > 3) P.set(x + (w === 2 ? 1 : 0), by - h + 2, WX[4]); // a drip
    if (w === 2) P.set(x + 1, by - h + 1, WX[2]);
    flame(P, x, by - h, f, kind, size == null ? 1 : size);
    return { x: x + (w === 2 ? 0.5 : 0), y: by - h - 1 };
  }
  // little potion bottle; x = left, by = bottom row; shape 0 round flask, 1 tall, 2 square, 3 vial, 4 cone, 5 jug
  const BOTTLES = [
    ['..c..', '..n..', '.bbb.', 'bbbbb', 'bbbbb', '.bbb.'],
    ['.c.', '.n.', '.n.', 'bbb', 'bbb', 'bbb', 'bbb', 'bbb'],
    ['.cc.', '.nn.', 'bbbb', 'bbbb', 'bbbb', 'bbbb'],
    ['c.', 'bb', 'bb', 'bb'],
    ['..c..', '..n..', '..b..', '.bbb.', 'bbbbb'],
    ['.cc..', '.nn..', 'bbbbh', 'bbb.h', 'bbbbh', '.bbb.'],
  ];
  function bottle(P, x, by, shape, liq, glow, fill) {
    const rows = BOTTLES[shape % BOTTLES.length], H = rows.length, L = LIQ[liq] || LIQ.violet;
    let bodyTop = rows.findIndex((r) => r.indexOf('b') >= 0);
    const level = fill == null ? 0.7 : fill, bodyH = H - bodyTop, liqTop = H - Math.max(1, Math.round(bodyH * level));
    let core = null;
    for (let j = 0; j < H; j++) for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i], px = x + i, py = by - H + 1 + j;
      if (ch === 'c') P.set(px, py, j === 0 ? '#8a5a3a' : '#6a4028');
      else if (ch === 'n') P.set(px, py, GLASS[2]);
      else if (ch === 'h') P.set(px, py, GLASS[1]);
      else if (ch === 'b') {
        const left = i === 0 || rows[j][i - 1] !== 'b', right = i === rows[j].length - 1 || rows[j][i + 1] !== 'b';
        let c;
        if (j < liqTop) c = left ? GLASS[3] : right ? GLASS[1] : GLASS[2];
        else c = right ? L[0] : left ? L[2] : L[1];
        if (glow && j >= liqTop && !left && !right) { c = L[2]; if (!core) core = [px, py]; }
        P.set(px, py, c);
      }
    }
    // specular glint on the shoulder
    const gl = rows[bodyTop].indexOf('b');
    if (gl >= 0 && rows[bodyTop].length > 2) P.set(x + gl + (rows[bodyTop].length > 3 ? 1 : 0), by - H + 1 + bodyTop + (bodyH > 3 ? 1 : 0), '#e8eeff');
    if (glow && core) P.set(core[0], core[1] + (bodyH > 4 ? 1 : 0), L[3]);
    return { w: rows[0].length, h: H, core };
  }
  // a book standing on a shelf: x, by = bottom row, w, h, ramp
  function spine(P, x, by, w, h, R, band) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.set(x + i, by - j, i === 0 && w > 1 ? R[3] : i === w - 1 ? R[1] : R[2]);
    if (band) { const c = band === true ? GOLD[3] : band; for (let i = 0; i < w; i++) { P.set(x + i, by - h + 2, c); if (h > 5) P.set(x + i, by - 2, c); } }
    if (h > 1) for (let i = 0; i < w; i++) P.set(x + i, by - h + 1, i === w - 1 ? R[2] : R[4] || R[3]);
  }
  const BOOK_R = [CRIMSON, FOREST, MIDNIGHT, PLUM, OCHRE, WINE, TEALC, CHAR, VIOLET, HONEY.slice(1)];
  function sprite(meta) { return Object.assign({ lights: [], foot: [1, 1], solid: true }, meta); }
  // build animated/night sprites from a draw(frame, night) -> Pix function
  function build(meta, draw, nFrames, fps, night, seq) {
    const s = sprite(meta);
    if (nFrames > 1) {
      const fr = []; for (let f = 0; f < nFrames; f++) fr.push(draw(f, false).canvas());
      s.frames = seq ? seq.map((k) => fr[k]) : fr; s.poses = fr; s.c = s.frames[0]; s.fps = fps;
    } else s.c = draw(0, false).canvas();
    if (night) s.n = draw(0, true).canvas();
    return s;
  }
  const L = (x, y, r, color, i, flicker) => (flicker ? { x, y, r, color, i, flicker: 1 } : { x, y, r, color, i });

  // ================================================================== floors
  function finishWear(P, seed, o) {
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
      const wv = fbm(x / 34, y / 26, seed + 41);
      if (wv > o.wear) P.tint(x, y, o.wearCol, 0.08 + (bay(x, y) < (wv - o.wear) * 4 ? 0.05 : 0));
      if (o.stain && noise(x / 6, y / 4, seed + 43) > o.stain && noise(x / 23, y / 17, seed + 44) > 0.55) P.dark(x, y, 0.16);
    }
  }
  function plankFloor(w, h, seed, o) {
    const P = new Pix(w, h), R = o.ramp, pitch = o.pitch;
    const rows = Math.ceil(h / pitch) + 1;
    for (let r = 0; r < rows; r++) {
      const joints = []; let x = -Math.floor(hash(r, 1, seed) * o.maxLen), k = 0;
      while (x < w) { joints.push(x); x += o.minLen + Math.floor(hash(r, k + 7, seed) * (o.maxLen - o.minLen)); k++; }
      joints.push(x);
      for (let s = 0; s < joints.length - 1; s++) {
        const x0 = joints[s], x1 = joints[s + 1];
        const tone = hash(r, s * 13 + 3, seed), base = tone < 0.2 ? 2 : tone < 0.82 ? 3 : 4;
        const knot = hash(r, s * 13 + 5, seed) < o.knots ? x0 + 5 + Math.floor(hash(r, s * 13 + 6, seed) * Math.max(1, x1 - x0 - 10)) : -99;
        const ky = 1 + Math.floor(hash(r, s, seed + 9) * (pitch - 3));
        for (let ly = 0; ly < pitch; ly++) {
          const y = r * pitch + ly; if (y >= h) break;
          for (let xx = Math.max(0, x0); xx < Math.min(w, x1); xx++) {
            let c;
            if (ly === pitch - 1) c = R[0];
            else if (xx === x0) c = R[1];
            else {
              let k2 = base;
              if (ly === 0) k2++; else if (ly === pitch - 2) k2--;
              const g = noise(xx / 9 + s * 3.7, y * 0.55, seed + 11);
              if (g > 0.74) k2++; else if (g < 0.22) k2--;
              if (ly > 0 && ly < pitch - 2 && noise(xx / 4.5 + s * 9.1, ly * 1.9 + r * 7, seed + 19) > 0.8) k2--;
              const kd = Math.abs(xx - knot);
              if (kd < 5 && Math.abs(ly - ky) <= 1) { if (kd <= 1 && ly === ky) k2 = 1; else if (kd <= 2) k2 = base + (ly === ky ? 1 : -1); else if (ly !== ky) k2 = base - 1; }
              c = R[clamp(k2, 1, R.length - 1)];
            }
            P.set(xx, y, c);
          }
        }
        // nails at the butt joint and over the joists
        const nail = (nx, ny) => { if (nx > 0 && nx < w && ny < h) { P.set(nx, ny, o.nail[0]); P.set(nx, ny - 1, o.nail[1]); } };
        if (x0 >= 0 && hash(r, s, seed + 23) < 0.85) { nail(x0 + 2, r * pitch + Math.max(1, pitch - 3)); }
        if (x1 < w && hash(r, s, seed + 24) < 0.6) nail(x1 - 2, r * pitch + Math.max(1, pitch - 3));
        for (let jx = Math.ceil(x0 / o.joist) * o.joist + (r % 2); jx < x1 - 3; jx += o.joist) if (jx > x0 + 3 && hash(jx, r, seed + 25) < o.joistNails) nail(jx, r * pitch + pitch - 3);
      }
    }
    finishWear(P, seed, o);
    return P;
  }
  function floorHerringbone(w, h, seed) {
    const P = new Pix(w, h), W = 3, r = 3, R = ['#2a1a16', '#3f281e', '#553624', '#6c462c', '#835834', '#996a40', '#ad7e50'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / W), cy = Math.floor(y / W), lx = x - cx * W, ly = y - cy * W;
      const d = cy - cx, b = Math.floor((d + r - 1) / (2 * r)), dd = d - b * 2 * r, cyp = cy - b * 2 * r;
      let horiz, k, along, across;
      if (dd <= 0) { horiz = true; k = cyp; along = -dd * W + lx; across = ly; } else { horiz = false; k = cx; along = (dd - 1) * W + ly; across = lx; }
      const id = horiz ? k * 2 : k * 2 + 1;
      const tone = hash(id, b, seed), Lb = r * W;
      let ki = tone < 0.18 ? 2 : tone < 0.55 ? 3 : tone < 0.92 ? 4 : 5;
      if (hash(id, b, seed + 3) < 0.05) ki = 2; // a replaced, darker block
      if (across === W - 1 || along === Lb - 1) ki = 1;
      else {
        if (across === 0) ki++;
        const g = noise((horiz ? x : y) / 3.2 + id * 1.3, (horiz ? y : x) * 0.9, seed + 7);
        if (g > 0.76) ki++; else if (g < 0.2) ki--;
      }
      P.set(x, y, R[clamp(ki, 0, R.length - 1)]);
    }
    // scuffs: dull pale patches and short scratches, darker grime in a few spots
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sv = fbm(x / 28, y / 20, seed + 11);
      if (sv > 0.6) P.tint(x, y, '#c8b4a0', sv > 0.68 && bay(x, y) < 0.5 ? 0.16 : 0.09);
      if (noise(x / 13, y / 9, seed + 13) > 0.8) P.dark(x, y, 0.2);
    }
    for (let k = 0; k < (w * h) / 260; k++) {
      const sx = Math.floor(hash(k, 1, seed + 17) * w), sy = Math.floor(hash(k, 2, seed + 17) * h), len = 2 + Math.floor(hash(k, 3, seed + 17) * 3), dir = hash(k, 4, seed + 17) < 0.5 ? 1 : -1;
      for (let i = 0; i < len; i++) P.tint(sx + i, sy + (i >> 1) * dir, '#d8c0a0', 0.22);
    }
    return P;
  }
  function floorMarble(w, h, seed) {
    const P = new Pix(w, h), S = 20;
    const DK = ['#231f2e', '#2b2639', '#342e44', '#3d364f'], LT = ['#6a6286', '#776f93', '#847ca0', '#9189ac'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x + y + 10, v = x - y + 1000 * S + 10, iu = Math.floor(u / S), iv = Math.floor(v / S), lu = u - iu * S, lv = v - iv * S;
      const pale = ((iu + iv) & 1) === 0, R = pale ? LT : DK;
      const cloud = fbm(x / 14 + iu * 3.1, y / 14 + iv * 1.7, seed + (pale ? 3 : 5));
      let c = rampAt(R, 0.15 + cloud * 0.85, x, y);
      const vein = Math.abs(noise(x / 9 + iu * 5, y / 5.5 + iv * 3, seed + 7) - 0.5);
      if (vein < 0.028) c = pale ? '#5e5679' : '#4a4260';
      else if (vein < 0.05 && bay(x, y) < 0.35) c = pale ? '#6c6488' : '#423a56';
      if (lu === 0 || lv === 0) c = pale ? '#4e4768' : '#1b1724';
      else if (lu === 1 || lv === S - 1) c = pale ? '#a29bbc' : DK[3]; // lit upper edges of each slab
      if (hash(x, y, seed + 9) < 0.003) c = pale ? '#c8c2dc' : '#5a5276';
      P.set(x, y, c);
    }
    // inlaid silver star mosaics where four slabs meet (every other vertex)
    for (let a = -2; a <= Math.ceil((w + h) / S) + 2; a++) for (let b = -Math.ceil(h / S) - 2; b <= Math.ceil(w / S) + 2; b++) {
      if (((a + b) & 1) !== 0) continue;
      const vx = ((a + b) * S) / 2 - 10, vy = ((a - b) * S) / 2;
      if (((a + b) / 2 + a) % 2 !== 0) continue;
      if (vx < -4 || vy < -4 || vx > w + 4 || vy > h + 4) continue;
      starInlay(P, vx, vy, (hash(a, b, seed) * 3) | 0);
    }
    return P;
  }
  function starInlay(P, cx, cy, kind) {
    const arm = [[0, -3], [0, -2], [0, -1], [0, 1], [0, 2], [0, 3], [-3, 0], [-2, 0], [-1, 0], [1, 0], [2, 0], [3, 0]];
    const dia = [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, -2], [2, -2], [-2, 2], [2, 2]];
    for (const [dx, dy] of dia.slice(0, kind === 2 ? 8 : 4)) P.set(cx + dx, cy + dy, SILVER[3]);
    for (const [dx, dy] of arm) P.set(cx + dx, cy + dy, Math.abs(dx) + Math.abs(dy) === 3 ? SILVER[3] : SILVER[4]);
    for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0]]) P.set(cx + dx, cy + dy, '#4a4462');
    P.set(cx, cy, SILVER[6]); P.set(cx - 1, cy, SILVER[5]); P.set(cx, cy - 1, SILVER[5]);
  }
  function floorFlag(w, h, seed) {
    // irregular rectangular flagstones: wobbly courses of random height, slabs of random length
    const P = new Pix(w, h), R = ['#262432', '#353345', '#454356', '#555368', '#67657b', '#7a788f'];
    const rowsY = [-8]; while (rowsY[rowsY.length - 1] < h + 24) rowsY.push(rowsY[rowsY.length - 1] + 11 + Math.floor(hash(rowsY.length, 1, seed) * 6));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = x + (noise(x / 8, y / 8, seed + 1) - 0.5) * 4.2, Y = y + (noise(x / 8 + 40, y / 8, seed + 2) - 0.5) * 3.6;
      let r = 0; while (r < rowsY.length - 2 && Y >= rowsY[r + 1]) r++;
      const y0 = rowsY[r], y1 = rowsY[r + 1];
      let s = 0, sx = -Math.floor(hash(r, 3, seed) * 26), nx = sx + 13 + Math.floor(hash(r, 10, seed) * 15);
      while (X >= nx) { s++; sx = nx; nx = sx + 13 + Math.floor(hash(r, s + 10, seed) * 15); }
      const ex = Math.min(X - sx, nx - X), ey = Math.min(Y - y0, y1 - Y);
      let c;
      if (ex < 0.9 || ey < 0.9) c = noise(x / 6, y / 6, seed + 8) > 0.74 ? '#24382e' : R[0];
      else {
        const t = hash(r, s, seed + 7);
        let k = t < 0.25 ? 2 : t < 0.8 ? 3 : 4;
        if (Y - y0 < 2.2 || X - sx < 2.2) k++; else if (y1 - Y < 2.2 || nx - X < 2.2) k--;
        if (noise(x / 4, y / 3, seed + 9 + s) > 0.8) k--;
        if (hash(x, y, seed + 10) < 0.015) k = 1;
        c = R[clamp(k, 1, 5)];
      }
      P.set(x, y, c);
    }
    finishWear(P, seed, { wear: 0.68, wearCol: '#a8a0bc' });
    return P;
  }
  const FLOORS = {
    tavern: (w, h, s) => plankFloor(w, h, s, { ramp: ['#1e1418', '#2c1e20', '#3a2925', '#48332c', '#563e34', '#664a3d', '#78594a'], pitch: 5, minLen: 26, maxLen: 70, knots: 0.35, joist: 22, joistNails: 0.35, nail: ['#141016', '#7a6a70'], wear: 0.64, wearCol: '#a08878', stain: 0.8 }),
    cottage: (w, h, s) => plankFloor(w, h, s, { ramp: ['#2a1a18', '#43291f', '#5a3826', '#704830', '#86593a', '#9c6c46', '#b48256'], pitch: 7, minLen: 40, maxLen: 96, knots: 0.45, joist: 26, joistNails: 0.4, nail: ['#1a1216', '#8e7a70'], wear: 0.62, wearCol: '#d0b090' }),
    boutique: floorHerringbone,
    cathedral: floorMarble,
    stone: floorFlag,
  };

  // ================================================================== walls
  function crown(P, w, y, R, dentil) { // crown moulding rows y..y+3 and its shadow below
    for (let x = 0; x < w; x++) {
      P.set(x, y, R[5]); P.set(x, y + 1, R[3]); P.set(x, y + 2, dentil && x % 3 === 0 ? R[1] : R[2]); P.set(x, y + 3, R[0]);
      P.dark(x, y + 4, 0.38); P.dark(x, y + 5, 0.16);
    }
  }
  function wallTavern(w, h, seed, o) {
    const P = new Pix(w, h), PL = ['#2a1628', '#361d33', '#43253f', '#50304b', '#5e3b57'];
    const wain = Math.round(h * 0.3), railY = h - wain - 2;
    for (let y = 0; y < railY; y++) for (let x = 0; x < w; x++) {
      const n = fbm(x / 7, y / 6, seed + 1);
      let c = rampAt(PL, 0.2 + n * 0.62 + (y / railY) * 0.12, x, y);
      if (noise(x / 1.5, y / 12, seed + 2) > 0.82) c = PL[1]; // grime streaks
      P.set(x, y, c);
    }
    // timber posts and braces
    const posts = o.posts || defaultBays(w, 64);
    for (let k = 0; k < posts.length; k++) {
      const px = posts[k];
      for (let y = 4; y < railY; y++) for (let i = -2; i <= 1; i++) P.set(px + i, y, OAK[i === -2 ? 4 : i === 1 ? 1 : (hash(px, y >> 2, seed) < 0.15 ? 2 : 3)]);
      const nx = posts[k + 1];
      if (nx != null && hash(k, 3, seed) < 0.55) { // a curved Tudor brace into the bay
        const dir = hash(k, 4, seed) < 0.5;
        for (let t = 0; t <= 10; t++) { const bx = dir ? px + 2 + t : nx - 3 - t, by = railY - 1 - Math.round(Math.sqrt(t / 10) * 10); P.set(bx, by, OAK[3]); P.set(bx, by + 1, OAK[1]); }
      }
    }
    for (let x = 0; x < w; x++) { P.set(x, 10, OAK[2]); P.set(x, 11, OAK[3]); P.set(x, 12, OAK[1]); P.dark(x, 13, 0.25); } // a cross beam
    for (const px of posts) for (let i = -2; i <= 1; i++) { P.set(px + i, 10, OAK[2]); P.set(px + i, 11, OAK[4]); P.set(px + i, 12, OAK[1]); }
    crown(P, w, 0, OAK, true);
    // chair rail + raised-panel wainscot + skirting
    for (let x = 0; x < w; x++) { P.set(x, railY, OAK[5]); P.set(x, railY + 1, OAK[2]); }
    const pw = 20, py0 = railY + 2, py1 = h - 4;
    for (let y = py0; y <= py1; y++) for (let x = 0; x < w; x++) {
      const lx = ((x + 6) % pw), ly = y - py0, ph = py1 - py0;
      let c = OAK[2];
      if (lx < 2 || ly === 0 || ly === ph) c = OAK[2];
      else if (lx === 2 || ly === 1) c = OAK[4];
      else if (lx === pw - 1 || ly === ph - 1) c = OAK[1];
      else c = hash(x >> 1, y, seed + 5) < 0.1 ? OAK[4] : OAK[3];
      if (lx === 0) c = OAK[1];
      P.set(x, y, c);
    }
    for (let x = 0; x < w; x++) { P.set(x, h - 3, OAK[4]); P.set(x, h - 2, OAK[2]); P.set(x, h - 1, OAK[1]); }
    return P;
  }
  function defaultBays(w, step) { const a = []; for (let x = step; x < w - 8; x += step) a.push(x); return a; }
  const DAMASK = ['....a....', '...aba...', '..a.b.a..', '.a..b..a.', 'a..bbb..a', '.a.b.b.a.', '..bbabb..', '.a.b.b.a.', 'a..bbb..a', '.a..b..a.', '..a.b.a..', '...aba...', '....a....'];
  function wallBoutique(w, h, seed, o) {
    const P = new Pix(w, h), WP = ['#2c1a2c', '#382238', '#452a43', '#52344e'], AMB = ['#6e4e46', '#866050', '#9c7458'];
    const wain = Math.round(h * 0.3), railY = h - wain - 2;
    for (let y = 0; y < railY; y++) for (let x = 0; x < w; x++) {
      const fade = fbm(x / 22, y / 14, seed + 3);
      let c = rampAt(WP, 0.35 + fade * 0.4 + (bay(x, y) < 0.06 ? 0.2 : 0), x, y);
      // half-drop damask
      const tx = Math.floor(x / 13), mx = x - tx * 13 - 2, my = ((y + (tx % 2) * 8) % 16) - 1;
      if (mx >= 0 && mx < 9 && my >= 0 && my < 13) {
        const ch = DAMASK[my][mx];
        if (ch === 'a') c = fade > 0.62 ? AMB[0] : AMB[1];
        else if (ch === 'b') c = WP[3];
      }
      if ((x % 13) === 0 && y % 2 === 0) c = WP[0];
      P.set(x, y, c);
    }
    // sun-faded top and soot near the cornice
    for (let y = 4; y < railY; y++) for (let x = 0; x < w; x++) { const t = (railY - y) / railY; if (bay(x, y) < t * 0.18) P.tint(x, y, '#8a7280', 0.18); }
    // peeling patches: a torn hole showing plaster and lath, the paper flap curling down from its upper edge
    const n = Math.max(1, Math.round(w / 110));
    for (let k = 0; k < n; k++) {
      const x0 = 8 + Math.floor(((k + hash(k, 1, seed + 9)) / n) * Math.max(1, w - 26)), y0 = 6 + Math.floor(hash(k, 2, seed + 9) * Math.max(1, railY - 20));
      const pw = 9 + Math.floor(hash(k, 3, seed + 9) * 4), ph = 7 + Math.floor(hash(k, 4, seed + 9) * 4);
      const inside = (x, y) => { const lx = x - x0, ly = y - y0; if (lx < 0 || ly < 0 || lx >= pw || ly >= ph) return false; const jag = Math.floor(hash(x, k, seed + 13) * 2.4); return ly >= jag && lx >= Math.floor(hash(y, k, seed + 14) * 2) && lx < pw - Math.floor(hash(y, k, seed + 15) * 2) && ly < ph - (lx > pw / 2 ? Math.floor(hash(x, k, seed + 16) * 2.5) : 0); };
      for (let y = y0 - 1; y <= y0 + ph + 1; y++) for (let x = x0 - 1; x <= x0 + pw; x++) {
        if (y < 4 || y >= railY) continue;
        if (inside(x, y)) P.set(x, y, (y - y0) % 3 === 2 ? '#3a2c34' : (x + y) % 5 === 0 ? '#6a5a60' : '#5a4a52');
        else if (inside(x, y + 1) || inside(x - 1, y) || inside(x + 1, y)) P.set(x, y, '#2e1e2c'); // torn edge in shadow
      }
      // the curled flap: paper back, lit on its upper fold, casting a shadow onto the hole
      const fw = Math.max(3, Math.floor(pw * 0.55));
      for (let j = 0; j < 4; j++) for (let i = 0; i < fw - j; i++) { const x = x0 + i, y = y0 + j; P.set(x, y, j === 0 ? '#d8c8a8' : i === fw - j - 1 ? '#8a7660' : '#b8a488'); }
      for (let i = 0; i < fw - 3; i++) P.set(x0 + i, y0 + 4, '#241820');
      P.set(x0 + fw - 4, y0 + 4, '#241820');
    }
    crown(P, w, 0, HONEY, false);
    for (let x = 0; x < w; x++) { P.set(x, railY, HONEY[5]); P.set(x, railY + 1, HONEY[2]); }
    for (let y = railY + 2; y < h - 3; y++) for (let x = 0; x < w; x++) { // beadboard wainscot
      const lx = x % 5; let c = lx === 0 ? HONEY[1] : lx === 1 ? HONEY[4] : hash(Math.floor(x / 5), 0, seed) < 0.3 ? HONEY[2] : HONEY[3];
      if (lx > 1 && noise(x / 2, y / 6, seed + 4) > 0.78) c = HONEY[2];
      if (y === railY + 2) c = HONEY[1];
      P.set(x, y, c);
    }
    for (let x = 0; x < w; x++) { P.set(x, h - 3, HONEY[5]); P.set(x, h - 2, HONEY[3]); P.set(x, h - 1, HONEY[1]); }
    return P;
  }
  function wallCathedral(w, h, seed, o) {
    const P = new Pix(w, h), R = PSTONE, top = 7, arcTop = Math.max(top + 10, h - 36), plinth = h - 6;
    for (let y = top; y < plinth; y++) { // ashlar courses
      const course = Math.floor((y - top) / 8), ly = (y - top) % 8, off = Math.floor(hash(course, 0, seed) * 20);
      for (let x = 0; x < w; x++) {
        const bl = Math.floor((x + off) / 22), lx = (x + off) % 22;
        let c;
        if (ly === 7 || lx === 0) c = R[2];
        else {
          const hv = hash(bl, course, seed + 1); let k = hv < 0.3 ? 4 : hv < 0.85 ? 5 : 6;
          if (ly === 0 || lx === 1) k++; else if (ly === 6 || lx === 21) k--;
          if (noise(x / 5, y / 4, seed + 2) > 0.84) k--;
          c = R[clamp(k, 2, 7)];
          if (hash(x, y, seed + 3) < 0.006) c = R[3];
        }
        P.set(x, y, c);
      }
    }
    // pointed blind arcade
    const ah = plinth - arcTop, aw = 16;
    for (let y = arcTop; y < plinth; y++) for (let x = 0; x < w; x++) {
      const lx = ((x % aw) + aw) % aw, ly = y - arcTop;
      if (lx <= 1) { P.set(x, y, lx === 0 ? R[6] : R[4]); continue; } // colonnettes
      const cx = 7.5, hw = 5.5, inner = Math.abs(lx - cx), headH = 10;
      const archEdge = ly < headH ? Math.max(0, Math.sqrt(4 * hw * hw - Math.pow((headH - ly) * (Math.sqrt(3) * hw / headH), 2)) - hw) : hw;
      const yy = ly - 1;
      if (yy >= 0 && inner <= archEdge + 0.2 && ly > 0) {
        let c = R[3];
        if (inner > archEdge - 1) c = lx < cx ? R[2] : R[4];
        if (yy === 1 && inner < 1) c = R[2];
        if (ly > ah - 3) c = R[2];
        if (ly >= headH && ly < headH + 2 && Math.abs(lx - cx) < 1) c = R[4];
        P.set(x, y, c);
      } else if (yy >= 0 && inner <= archEdge + 1.4 && ly > 0) P.set(x, y, lx < cx ? R[6] : R[3]);
    }
    for (let x = 0; x < w; x++) { P.set(x, arcTop - 1, R[6]); P.set(x, arcTop - 2, R[4]); P.dark(x, arcTop, 0.1); } // string course
    // corbel table + cornice
    for (let x = 0; x < w; x++) {
      P.set(x, 0, R[7]); P.set(x, 1, R[6]); P.set(x, 2, R[4]); P.set(x, 3, R[2]);
      const lx = x % 8;
      for (let y = 4; y < top; y++) { const ly = y - 4; P.set(x, y, lx < 2 ? R[lx === 0 ? 6 : 4] : ly === 0 ? R[1] : (Math.abs(lx - 4.5) < 2.5 - ly * 0.8 ? R[1] : R[4])); }
      P.dark(x, top, 0.3); P.dark(x, top + 1, 0.12);
    }
    // engaged columns
    const cols = o.columns || defaultBays(w, 64);
    for (const cx of cols) {
      for (let y = top - 2; y < plinth; y++) for (let i = -4; i <= 3; i++) {
        const k = [6, 7, 6, 5, 5, 4, 3, 2][i + 4];
        P.set(cx + i, y, R[k]);
      }
      for (let i = -5; i <= 4; i++) { // capital and base
        for (let y = top - 2; y < top + 4; y++) P.set(cx + i, y, y === top - 2 ? R[7] : y === top + 3 ? R[2] : (i + y) % 3 === 0 ? R[3] : R[5]);
        for (let y = plinth - 5; y < plinth; y++) P.set(cx + i, y, y === plinth - 5 ? R[6] : y === plinth - 1 ? R[2] : i < -2 ? R[6] : R[4]);
      }
      for (let y = top + 4; y < plinth - 5; y += 18) for (let i = -4; i <= 3; i++) P.set(cx + i, y, R[3]); // drum joints
    }
    for (let x = 0; x < w; x++) { // bench plinth
      P.set(x, plinth, R[7]); P.set(x, plinth + 1, R[5]);
      for (let y = plinth + 2; y < h - 1; y++) P.set(x, y, (x % 22 === 0) ? R[2] : R[4 - (y - plinth - 2 > 1 ? 1 : 0)]);
      P.set(x, h - 1, R[2]);
    }
    return P;
  }
  function wallCottage(w, h, seed, o) {
    const P = new Pix(w, h), R = ['#2a2632', '#3e3844', '#544b56', '#6a5f68', '#80747a', '#9a8c8e'];
    for (let y = 6; y < h - 3; y++) for (let x = 0; x < w; x++) {
      const gx0 = Math.floor(x / 9), gy0 = Math.floor(y / 7);
      let d1 = 1e9, d2 = 1e9, best = 0, by = 0, sy = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = gx0 + i, gy = gy0 + j, ox = gx * 9 + 1 + hash(gx, gy, seed) * 7, oy = gy * 7 + 1 + hash(gx, gy, seed + 1) * 5;
        const d = Math.hypot((x - ox) * 0.8, y - oy);
        if (d < d1) { d2 = d1; sy = by; d1 = d; best = hash(gx, gy, seed + 2); by = oy; } else if (d < d2) { d2 = d; sy = oy; }
      }
      let c;
      if (d2 - d1 < 1.2) c = '#4a4048';
      else { let k = best < 0.35 ? 2 : best < 0.8 ? 3 : 4; if (d2 - d1 < 2.4) k += sy < by ? 1 : -1; if (hash(x, y, seed + 3) < 0.05) k--; c = R[clamp(k, 1, 5)]; }
      P.set(x, y, c);
    }
    const posts = o.posts || defaultBays(w, 56);
    for (const px of posts) for (let y = 6; y < h - 3; y++) for (let i = -2; i <= 2; i++) P.set(px + i, y, WOOD[i === -2 ? 4 : i === 2 ? 0 : hash(px, y >> 1, seed) < 0.2 ? 1 : 2]);
    for (let x = 0; x < w; x++) { // heavy beam with adze marks
      for (let y = 0; y < 6; y++) P.set(x, y, y === 0 ? WOOD[4] : y === 5 ? WOOD[0] : (noise(x / 3, y, seed + 5) > 0.7 ? WOOD[1] : WOOD[y < 3 ? 3 : 2]));
      P.dark(x, 6, 0.4); P.dark(x, 7, 0.15);
      P.set(x, h - 3, WOOD[4]); P.set(x, h - 2, WOOD[2]); P.set(x, h - 1, WOOD[1]);
    }
    return P;
  }
  const WALLS = { tavern: wallTavern, boutique: wallBoutique, cathedral: wallCathedral, cottage: wallCottage };

  // ================================================================== round 2: homes, shops, the Guild and rare Depths floors
  const STRAW = ['#6a4a20', '#8a6428', '#a88038', '#c8a050', '#e0bc6a', '#f2d890'];
  const SOOT = ['#141012', '#1e191b', '#292224', '#352d2e', '#423838', '#504444'];
  const CREAM = ['#7a6a66', '#a08e88', '#c4b2aa', '#dccec6', '#ece2da', '#f8f2ec'];
  const PINK = ['#6a2a44', '#a04a68', '#d06a8a', '#e890a8', '#f4b8c8', '#fcdce4'];
  const RUNES = [
    ['..#..', '.#.#.', '#...#', '.#.#.', '..#..'], ['#.#.#', '.###.', '..#..', '..#..', '..#..'], ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
    ['..#..', '.#.#.', '..#..', '.#.#.', '#...#'], ['#...#', '##.##', '#.#.#', '##.##', '#...#'], ['...#.', '..#..', '.###.', '..#..', '.#...'],
  ];
  function stampRune(P, x, y, k, c, c2) { const g = RUNES[((k % RUNES.length) + RUNES.length) % RUNES.length]; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (g[j][i] === '#') P.set(x + i, y + j, c2 && (i + j) % 3 === 0 ? c2 : c); }
  // irregular rectangular slabs in wobbly courses (generalised flagstones)
  function slabFloor(w, h, seed, o) {
    const P = new Pix(w, h), R = o.ramp;
    const rowsY = [-8]; while (rowsY[rowsY.length - 1] < h + 24) rowsY.push(rowsY[rowsY.length - 1] + o.rowH[0] + Math.floor(hash(rowsY.length, 1, seed) * o.rowH[1]));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = x + (noise(x / 8, y / 8, seed + 1) - 0.5) * o.wob, Y = y + (noise(x / 8 + 40, y / 8, seed + 2) - 0.5) * o.wob * 0.85;
      let r = 0; while (r < rowsY.length - 2 && Y >= rowsY[r + 1]) r++;
      const y0 = rowsY[r], y1 = rowsY[r + 1];
      let s = 0, sx = -Math.floor(hash(r, 3, seed) * (o.slabW[0] + o.slabW[1])), nx = sx + o.slabW[0] + Math.floor(hash(r, 10, seed) * o.slabW[1]);
      while (X >= nx) { s++; sx = nx; nx = sx + o.slabW[0] + Math.floor(hash(r, s + 10, seed) * o.slabW[1]); }
      const ex = Math.min(X - sx, nx - X), ey = Math.min(Y - y0, y1 - Y);
      let c;
      if (ex < 0.9 || ey < 0.9) c = o.mortar(x, y);
      else {
        const t = hash(r, s, seed + 7);
        let k = t < 0.25 ? 2 : t < 0.8 ? 3 : 4;
        if (Y - y0 < 2.2 || X - sx < 2.2) k++; else if (y1 - Y < 2.2 || nx - X < 2.2) k--;
        if (noise(x / 4, y / 3, seed + 9 + s) > 0.8) k--;
        if (hash(x, y, seed + 10) < 0.015) k = 1;
        c = R[clamp(k, 1, R.length - 1)];
      }
      P.set(x, y, c);
    }
    return P;
  }
  function strawOverlay(P, seed, density) {
    const n = Math.round((P.w * P.h) / 30 * density);
    for (let k = 0; k < n; k++) {
      const x = Math.floor(hash(k, 1, seed + 51) * P.w), y = Math.floor(hash(k, 2, seed + 51) * P.h);
      if (noise(x / 14, y / 10, seed + 52) < 0.5) continue;
      const len = 3 + Math.floor(hash(k, 3, seed + 51) * 4), dir = [[1, 0], [1, 1], [1, -1], [2, 1]][Math.floor(hash(k, 4, seed + 51) * 4)];
      for (let i = 0; i < len; i++) P.set(x + Math.round(i * dir[0] / (dir[0] > 1 ? 2 : 1)), y + Math.round(i * dir[1] / (dir[0] > 1 ? 2 : 1)), i === len - 1 ? STRAW[1] : STRAW[3 + ((k + i) % 3 === 0 ? 1 : 0)]);
    }
  }
  function floorCarpet(w, h, seed, o) {
    const P = new Pix(w, h), R = o.ramp, C = o.cell;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = rampAt(R, 0.25 + fbm(x / 10, y / 10, seed) * 0.45, x, y);
      if (hash(x, y, seed + 1) < 0.07) c = R[1];
      const u = (((x + y) % C) + C) % C, v = (((x - y) % C) + C) % C;
      if (u === 0 || v === 0) c = o.line;
      P.set(x, y, c);
    }
    for (let y = 0; y < h + C; y += C) for (let x = 0; x < w + C; x += C) for (const [sx, sy] of [[x, y]]) {
      P.set(sx, sy, o.star[1]); P.set(sx - 1, sy, o.star[0]); P.set(sx + 1, sy, o.star[0]); P.set(sx, sy - 1, o.star[0]); P.set(sx, sy + 1, o.star[0]);
    }
    finishWear(P, seed, { wear: 0.66, wearCol: o.wearCol });
    return P;
  }
  function floorBasket(w, h, seed) { // old basketweave parquet, dusty
    const P = new Pix(w, h), R = ['#1e1410', '#2c1e16', '#3a281c', '#483222', '#563c28', '#644830', '#74543a'], B = 9;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const bx = Math.floor(x / B), by = Math.floor(y / B), lx = x - bx * B, ly = y - by * B, horiz = ((bx + by) & 1) === 0;
      const along = horiz ? lx : ly, across = horiz ? ly : lx, slat = Math.floor(across / 3), sa = across % 3;
      const t = hash(bx * 3 + slat, by * 7 + (horiz ? 1 : 2), seed);
      let k = t < 0.25 ? 2 : t < 0.8 ? 3 : 4;
      if (sa === 2 || along === B - 1) k = 1; else if (sa === 0) k++;
      if (noise((horiz ? x : y) / 3 + slat * 2, (horiz ? y : x) * 0.8, seed + 3) > 0.78) k--;
      P.set(x, y, R[clamp(k, 0, 6)]);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = fbm(x / 26, y / 20, seed + 5); if (d > 0.56) P.tint(x, y, '#8e8478', 0.1 + (bay(x, y) < (d - 0.56) * 5 ? 0.08 : 0)); }
    for (let k = 0; k < (w * h) / 3200; k++) { const x = Math.floor(hash(k, 1, seed + 7) * w), y = Math.floor(hash(k, 2, seed + 7) * h); P.set(x, y, '#9a8a78'); P.set(x + 1, y, '#8a7a6a'); P.set(x, y + 1, '#6e6058'); }
    return P;
  }
  function floorObservatory(w, h, seed) { // indigo marble with gold seams and inlaid constellations
    const P = new Pix(w, h), R = ['#0e1028', '#131634', '#191c40', '#1f234c', '#262a58'], T = 32;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = rampAt(R, 0.15 + fbm(x / 16, y / 16, seed) * 0.7, x, y);
      if (Math.abs(noise(x / 8, y / 6, seed + 2) - 0.5) < 0.025) c = '#353a72';
      if (x % T === 0 || y % T === 0) c = (x % T === 0 && y % T === 0) ? GOLD[4] : '#6a5428';
      else if (x % T === 1 || y % T === 1) c = mix(c, '#000000', 0.25);
      if (hash(x, y, seed + 3) < 0.004) c = hash(x, y, seed + 4) < 0.5 ? '#c8d4f0' : '#8a9ac8';
      P.set(x, y, c);
    }
    for (let ty = 0; ty * T < h; ty++) for (let tx = 0; tx * T < w; tx++) {
      const pts = []; const n = 3 + Math.floor(hash(tx, ty, seed + 5) * 3);
      for (let k = 0; k < n; k++) pts.push([tx * T + 5 + Math.floor(hash(tx * 9 + k, ty, seed + 6) * (T - 10)), ty * T + 5 + Math.floor(hash(tx, ty * 9 + k, seed + 7) * (T - 10))]);
      for (let k = 0; k + 1 < pts.length; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]; const L2 = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 1; i < L2; i++) if (i % 2) P.set(Math.round(x0 + (x1 - x0) * i / L2), Math.round(y0 + (y1 - y0) * i / L2), '#46508e'); }
      for (const [x, y] of pts) { P.set(x, y, '#ffffff'); P.set(x - 1, y, '#a8b8e8'); P.set(x + 1, y, '#a8b8e8'); P.set(x, y - 1, '#a8b8e8'); P.set(x, y + 1, '#a8b8e8'); }
      const sx = tx * T, sy = ty * T; P.set(sx, sy, GOLD[6]); for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, 0], [1, 0], [0, -1], [0, 1]]) P.set(sx + dx, sy + dy, Math.abs(dx + dy) === 2 ? GOLD[3] : GOLD[5]);
    }
    return P;
  }
  function floorCrystal(w, h, seed) { // dark cave stone glittering with crystal
    const P = new Pix(w, h), R = ['#140f24', '#1c1530', '#251c3e', '#2e244c', '#382c5a', '#43366a'], GLT = ['#e89ab8', '#8ac0ff', '#e4d2ff', '#ffffff', '#7ae8d8'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let c = rampAt(R, 0.12 + fbm(x / 9, y / 9, seed) * 0.8, x, y);
      if (Math.abs(noise(x / 7, y / 7, seed + 2) - 0.5) < 0.022) c = R[0];
      const g = hash(x, y, seed + 3); if (g < 0.009) c = GLT[Math.floor(hash(x, y, seed + 4) * GLT.length)];
      P.set(x, y, c);
    }
    for (let k = 0; k < (w * h) / 700; k++) {
      const x = 3 + Math.floor(hash(k, 1, seed + 5) * (w - 6)), y = 6 + Math.floor(hash(k, 2, seed + 5) * (h - 7)), hue = [GL.rose, GL.azure, GL.violet, GL.teal][Math.floor(hash(k, 3, seed + 5) * 4)];
      for (const [dx, hh] of [[-1, 2], [0, 4], [1, 3]]) for (let j = 0; j < hh; j++) P.set(x + dx, y - j, j === hh - 1 ? hue[5] : dx < 0 ? hue[4] : dx > 0 ? hue[2] : hue[3]);
      P.set(x - 1, y + 1, R[0]); P.set(x, y + 1, R[0]); P.set(x + 1, y + 1, R[0]);
    }
    return P;
  }
  Object.assign(FLOORS, {
    alt: (w, h, s) => plankFloor(w, h, s, { ramp: ['#140c16', '#1e1220', '#2a1a2c', '#352238', '#402a44', '#4c3352', '#5a3c60'], pitch: 6, minLen: 30, maxLen: 84, knots: 0.15, joist: 26, joistNails: 0.25, nail: ['#0e0a12', '#6a5a7a'], wear: 0.7, wearCol: '#9a7ab8' }),
    pastel: (w, h, s) => plankFloor(w, h, s, { ramp: ['#7a6068', '#987c86', '#b496a0', '#c8aab2', '#d8bcc2', '#e6ccce', '#f2dcda'], pitch: 6, minLen: 34, maxLen: 90, knots: 0.12, joist: 26, joistNails: 0.3, nail: ['#8a6e78', '#fff4f0'], wear: 0.68, wearCol: '#fff6f2' }),
    study: (w, h, s) => floorCarpet(w, h, s, { ramp: ['#0a1c20', '#0e262a', '#133034', '#183a3e', '#1e4448'], cell: 12, line: '#28585a', star: ['#9a7a34', '#f2d070'], wearCol: '#5aa0a0' }),
    smithy: (w, h, s) => {
      const P = slabFloor(w, h, s, { ramp: SOOT, rowH: [11, 6], slabW: [13, 15], wob: 4.2, mortar: (x, y) => (hash(x, y, s + 3) < 0.012 ? (hash(x, y, s + 4) < 0.5 ? ORANGE : EMBERC) : '#0c090a') });
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (noise(x / 9, y / 7, s + 6) > 0.64) P.dark(x, y, 0.25);
      return P;
    },
    menagerie: (w, h, s) => { const P = plankFloor(w, h, s, { ramp: ['#2a1a14', '#3e2618', '#54341e', '#6a4426', '#80562e', '#966838', '#ae7c44'], pitch: 6, minLen: 28, maxLen: 72, knots: 0.4, joist: 24, joistNails: 0.4, nail: ['#1a1210', '#8a7a68'], wear: 0.62, wearCol: '#c8a070' }); strawOverlay(P, s, 0.35); return P; },
    guild: (w, h, s) => slabFloor(w, h, s, { ramp: ['#24232e', '#33323f', '#434151', '#535163', '#646276', '#76748a'], rowH: [15, 5], slabW: [18, 14], wob: 2.4, mortar: () => '#18161f' }),
    library: floorBasket,
    witch: (w, h, s) => {
      const P = slabFloor(w, h, s, { ramp: ['#1c1e22', '#282b2e', '#34383a', '#424646', '#505452', '#5e6460'], rowH: [11, 6], slabW: [12, 14], wob: 4.6, mortar: (x, y) => (noise(x / 5, y / 5, s + 8) > 0.42 ? (hash(x, y, s) < 0.5 ? '#1f4a30' : '#2a5e3a') : '#121612') });
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (noise(x / 7, y / 6, s + 9) > 0.66) P.tint(x, y, hash(x, y, s + 10) < 0.5 ? '#3a6a40' : '#4c8048', 0.45);
      for (let k = 0; k < Math.max(1, (w * h) / 1300); k++) stampRune(P, 2 + Math.floor(hash(k, 1, s + 11) * (w - 8)), 2 + Math.floor(hash(k, 2, s + 11) * (h - 8)), Math.floor(hash(k, 3, s + 11) * 6), k % 2 ? '#2fbf7f' : '#8f6cd1', k % 2 ? '#5dffb0' : '#b99aee');
      return P;
    },
    observatory: floorObservatory,
    crystal: floorCrystal,
  });

  function wallAlt(w, h, seed) {
    const P = new Pix(w, h), V = ['#1a0e2a', '#221236', '#2a1742', '#331c4e', '#3c225a', '#462866'];
    const wain = Math.round(h * 0.28), railY = h - wain - 2;
    for (let y = 0; y < railY; y++) for (let x = 0; x < w; x++) { let c = rampAt(V, 0.32 + fbm(x / 11, y / 9, seed) * 0.36, x, y); if (noise(x / 1.4, y / 9, seed + 2) > 0.84) c = V[1]; P.set(x, y, c); }
    for (let k = 0; k < Math.max(1, w / 70); k++) { const sx = 6 + Math.floor(hash(k, 1, seed + 3) * (w - 12)), sy = 8 + Math.floor(hash(k, 2, seed + 3) * Math.max(1, railY - 14)); P.set(sx, sy, '#9a86c0'); P.set(sx - 1, sy, '#5c4688'); P.set(sx + 1, sy, '#5c4688'); P.set(sx, sy - 1, '#5c4688'); P.set(sx, sy + 1, '#5c4688'); } // painted silver stars
    crown(P, w, 0, CHAR, false);
    for (let x = 0; x < w; x++) { P.set(x, railY, VIOLET[5]); P.set(x, railY + 1, CHAR[1]); }
    const py0 = railY + 2, py1 = h - 4;
    for (let y = py0; y <= py1; y++) for (let x = 0; x < w; x++) { const lx = (x + 4) % 18, ly = y - py0, ph = py1 - py0; P.set(x, y, lx === 0 ? CHAR[0] : lx === 1 || ly === 0 ? CHAR[4] : lx === 17 || ly === ph ? CHAR[1] : CHAR[3]); }
    for (let x = 0; x < w; x++) { P.set(x, h - 3, CHAR[4]); P.set(x, h - 2, CHAR[2]); P.set(x, h - 1, CHAR[1]); }
    return P;
  }
  function wallPastel(w, h, seed) {
    const P = new Pix(w, h), C6 = ['#8a7472', '#a8908e', '#c8b0aa', '#e2cec6', '#f0e2da', '#faf2ec'];
    const wain = Math.round(h * 0.3), railY = h - wain - 2;
    for (let y = 0; y < railY; y++) for (let x = 0; x < w; x++) {
      const gx = Math.floor(x / 3) & 1, gy = Math.floor(y / 3) & 1;
      let c = gx && gy ? '#d892a8' : gx || gy ? '#ecbcc8' : '#f8eae4';
      if (noise(x / 16, y / 12, seed) > 0.62) c = mix(c, '#fff8f4', 0.25);
      P.set(x, y, c);
    }
    crown(P, w, 0, C6, false);
    for (let x = 0; x < w; x++) { P.set(x, railY, PINK[3]); P.set(x, railY + 1, PINK[1]); }
    for (let y = railY + 2; y < h - 3; y++) for (let x = 0; x < w; x++) { const lx = x % 4; P.set(x, y, lx === 0 ? C6[2] : lx === 1 ? C6[5] : (noise(x / 2, y / 6, seed + 4) > 0.8 ? C6[3] : C6[4])); }
    for (let x = 0; x < w; x++) { P.set(x, h - 3, PINK[4]); P.set(x, h - 2, PINK[3]); P.set(x, h - 1, PINK[1]); }
    return P;
  }
  function wallStudy(w, h, seed) {
    const P = new Pix(w, h), T = ['#0c2026', '#11292e', '#163236', '#1c3c40', '#22464a'], shelfTop = h - 20;
    for (let y = 0; y < shelfTop; y++) for (let x = 0; x < w; x++) { let c = (x % 10 < 3) ? T[3] : T[2]; if (noise(x / 12, y / 9, seed) > 0.66) c = T[1]; P.set(x, y, c); }
    for (let gy = 8, r = 0; gy < shelfTop - 3; gy += 12, r++) for (let gx = (r % 2) * 8 + 3; gx < w - 2; gx += 16) { P.set(gx, gy, GOLD[5]); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) P.set(gx + dx, gy + dy, '#9a7a34'); }
    crown(P, w, 0, WALNUT, true);
    for (let x = 0; x < w; x++) P.set(x, 4, GOLD[2]);
    // book-lined: a long built-in shelf along the bottom of the wall
    for (let x = 0; x < w; x++) { P.set(x, shelfTop, WALNUT[6]); P.set(x, shelfTop + 1, WALNUT[3]); for (let y = shelfTop + 2; y < h - 3; y++) P.set(x, y, WALNUT[1]); }
    let x = 1, k = 0;
    while (x < w - 1) {
      if ((x % 32) < 2) { for (let y = shelfTop + 2; y < h - 3; y++) P.set(x, y, WALNUT[x % 32 === 0 ? 4 : 2]); x++; continue; }
      const wd = 1 + Math.floor(hash(k, 1, seed + 6) * 3), ht = 8 + Math.floor(hash(k, 2, seed + 6) * 6);
      if (x + wd > w - 1 || ((x + wd) % 32) < wd) { x++; continue; }
      spine(P, x, h - 4, wd, ht, BOOK_R[Math.floor(hash(k, 3, seed + 6) * BOOK_R.length)], hash(k, 4, seed + 6) < 0.4);
      x += wd; k++;
    }
    for (let x2 = 0; x2 < w; x2++) { P.set(x2, h - 3, WALNUT[5]); P.set(x2, h - 2, WALNUT[3]); P.set(x2, h - 1, WALNUT[1]); }
    return P;
  }
  function wallSmithy(w, h, seed) {
    const P = new Pix(w, h), R = SOOT;
    for (let y = 5; y < h - 3; y++) {
      const course = Math.floor((y - 5) / 6), ly = (y - 5) % 6, off = Math.floor(hash(course, 0, seed) * 14);
      for (let x = 0; x < w; x++) {
        const bl = Math.floor((x + off) / 15), lx = (x + off) % 15;
        let k = hash(bl, course, seed + 1) < 0.35 ? 3 : hash(bl, course, seed + 1) < 0.85 ? 4 : 5;
        if (ly === 5 || lx === 0) k = 0; else if (ly === 0 || lx === 1) k++;
        P.set(x, y, R[clamp(k, 0, 5)]);
        P.dark(x, y, 0.42 * (1 - y / h) + (noise(x / 6, y / 4, seed + 2) > 0.7 ? 0.15 : 0)); // soot climbing the wall
      }
    }
    for (let x = 0; x < w; x++) { for (let y = 0; y < 5; y++) P.set(x, y, y === 0 ? WOOD[3] : y === 4 ? WOOD[0] : noise(x / 3, y, seed + 3) > 0.7 ? WOOD[0] : WOOD[1]); P.dark(x, 5, 0.4); P.set(x, h - 3, R[5]); P.set(x, h - 2, R[3]); P.set(x, h - 1, R[1]); }
    for (let x = 8; x < w; x += 24) P.set(x, 2, IRON[5]);
    return P;
  }
  function wallMenagerie(w, h, seed) {
    const P = new Pix(w, h), R = ['#2a1a14', '#3e2618', '#54341e', '#6a4426', '#80562e', '#966838'], railY = Math.round(h * 0.52);
    for (let y = 5; y < h; y++) for (let x = 0; x < w; x++) {
      const b = Math.floor(x / 6), lx = x % 6, t = hash(b, 0, seed);
      let k = t < 0.3 ? 2 : t < 0.8 ? 3 : 4;
      if (lx === 5) k = 0; else if (lx === 0) k++;
      if (noise(x / 1.5, y / 9 + b * 3, seed + 1) > 0.8) k--;
      P.set(x, y, R[clamp(k, 0, 5)]);
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < 5; y++) P.set(x, y, y === 0 ? R[5] : y === 4 ? R[0] : noise(x / 3, y, seed + 3) > 0.7 ? R[2] : R[3]);
      P.dark(x, 5, 0.4); P.set(x, railY, R[5]); P.set(x, railY + 1, R[4]); P.set(x, railY + 2, R[1]);
      if (x % 6 === 2) { P.set(x, railY + 1, IRON[4]); }
    }
    for (let x = 14; x < w - 6; x += 80) { const sy = 9; for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [1, 3], [2, 3], [3, 3], [4, 2], [4, 1], [4, 0]]) P.set(x + dx, sy + dy, dy === 3 ? IRON[3] : IRON[4]); }
    for (let k = 0; k < w * 0.6; k++) { const x = Math.floor(hash(k, 1, seed + 5) * w), len = 2 + Math.floor(hash(k, 2, seed + 5) * 4); for (let i = 0; i < len; i++) P.set(x + (hash(k, 3, seed + 5) < 0.5 ? i >> 1 : -(i >> 1)), h - 1 - i, STRAW[2 + ((k + i) % 3)]); }
    return P;
  }
  function wallGuild(w, h, seed, o) {
    const P = new Pix(w, h), S = ['#24232e', '#302f3c', '#3d3c4b', '#4b4a5a', '#5a596a', '#6a697c'];
    const wain = Math.round(h * 0.32), railY = h - wain - 2;
    for (let y = 6; y < railY; y++) {
      const course = Math.floor((y - 6) / 7), ly = (y - 6) % 7, off = Math.floor(hash(course, 0, seed) * 16);
      for (let x = 0; x < w; x++) { const bl = Math.floor((x + off) / 17), lx = (x + off) % 17, t = hash(bl, course, seed + 1); let k = t < 0.3 ? 2 : t < 0.85 ? 3 : 4; if (ly === 6 || lx === 0) k = 0; else if (ly === 0 || lx === 1) k++; if (noise(x / 4, y / 4, seed + 2) > 0.82) k--; P.set(x, y, S[clamp(k, 0, 5)]); }
    }
    const posts = o.posts || defaultBays(w, 64);
    for (const px of posts) for (let y = 6; y < railY; y++) for (let i = -2; i <= 1; i++) P.set(px + i, y, OAK[i === -2 ? 4 : i === 1 ? 1 : 3]);
    for (let x = 0; x < w; x++) { for (let y = 0; y < 6; y++) P.set(x, y, y === 0 ? OAK[5] : y === 5 ? OAK[0] : y === 2 && x % 8 === 4 ? IRON[5] : OAK[y < 3 ? 3 : 2]); P.dark(x, 6, 0.4); P.dark(x, 7, 0.15); P.set(x, railY, OAK[5]); P.set(x, railY + 1, OAK[2]); }
    const py0 = railY + 2, py1 = h - 4;
    for (let y = py0; y <= py1; y++) for (let x = 0; x < w; x++) { const lx = (x + 9) % 22, ly = y - py0, ph = py1 - py0; let c = lx < 2 || ly === 0 || ly === ph ? OAK[2] : lx === 2 || ly === 1 ? OAK[4] : lx === 21 || ly === ph - 1 ? OAK[1] : OAK[3]; if (lx === 0) c = OAK[1]; P.set(x, y, c); }
    for (let x = 0; x < w; x++) { P.set(x, h - 3, OAK[4]); P.set(x, h - 2, OAK[2]); P.set(x, h - 1, OAK[1]); }
    return P;
  }
  Object.assign(WALLS, { alt: wallAlt, pastel: wallPastel, study: wallStudy, smithy: wallSmithy, menagerie: wallMenagerie, guild: wallGuild });

  // ================================================================== reflecting pool & runner
  const POOL_HUE = {
    rose: ['#24091e', '#3e1232', '#62204e', '#8c3470', '#b85090', '#e080b4', '#ffc4e0'],
    azure: ['#0a1232', '#112054', '#1a3680', '#2856ac', '#4282d2', '#7cb4ee', '#cce6ff'],
    gold: ['#241508', '#3e2610', '#68421a', '#986624', '#c89236', '#ecc260', '#fff0b8'],
    violet: ['#130c2a', '#20144a', '#352270', '#52389c', '#7658c6', '#a688e8', '#dccaff'],
    emerald: ['#08201c', '#0e3830', '#145842', '#1e7e5a', '#2eaa78', '#62d8a2', '#beffe0'],
  };
  const POOL_RGB = { rose: [240, 120, 190], azure: [110, 170, 255], gold: [255, 205, 110], violet: [176, 140, 255], emerald: [93, 240, 170] };
  function makePool(w, h, hue, seed) {
    const P = new Pix(w, h), R = POOL_HUE[hue] || POOL_HUE.azure, S = PSTONE, rim = 4, lip = 3;
    const shimmer = [];
    const ix0 = rim, iy0 = rim + lip, ix1 = w - rim - 1, iy1 = h - rim - 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const inRim = x < rim || y < rim || x >= w - rim || y >= h - rim;
      if (inRim) {
        const e = Math.min(x, y, w - 1 - x, h - 1 - y); // 0 = outer edge
        let c = e === 0 ? S[4] : e === 1 ? S[7] : e === rim - 1 ? S[4] : S[6];
        const along = (y < rim || y >= h - rim) ? x : y;
        if (e === 2 && along % 8 === 4) c = S[4];
        if (e === 2 && (along % 8 === 3 || along % 8 === 5)) c = S[5];
        if (hash(x, y, seed) < 0.03) c = S[5];
        const corner = (x < rim + 2 || x >= w - rim - 2) && (y < rim + 2 || y >= h - rim - 2);
        if (corner && e >= 1) c = (x + y) % 2 ? S[7] : S[6];
        P.set(x, y, c);
        continue;
      }
      if (y < iy0) { // sunken inner wall, seen on the far side only
        const ly = y - rim; P.set(x, y, ly === 0 ? S[1] : ly === lip - 1 ? mix(S[2], R[3], 0.35) : S[2]);
        continue;
      }
      // still water: dark at the edges, glowing toward the middle, soft caustic patches from the glass above
      const dx = Math.min(x - ix0, ix1 - x) / Math.max(4, (ix1 - ix0) * 0.5), dy = Math.min(y - iy0, iy1 - y) / Math.max(4, (iy1 - iy0) * 0.5);
      const edge = Math.min(1, Math.min(dx * 1.4, dy * 1.4));
      const caus = noise(x / 15, y / 10, seed + 5);
      const t = 0.1 + Math.pow(edge, 0.85) * 0.66 + (caus - 0.5) * 0.22 * edge;
      P.set(x, y, rampAt(R, t, x, y));
      if (edge > 0.35 && hash(x, y, seed + 9) < 0.016) shimmer.push(x, y);
    }
    // long, still reflections of the glass above, and a few crisp glints
    for (let k = 0; k < Math.max(3, (w * h) / 260); k++) {
      const gx = ix0 + 3 + Math.floor(hash(k, 1, seed + 11) * Math.max(1, ix1 - ix0 - 10)), gy = iy0 + 3 + Math.floor(hash(k, 2, seed + 11) * Math.max(1, iy1 - iy0 - 5)), gl = 3 + Math.floor(hash(k, 3, seed + 11) * 7);
      for (let i = 0; i < gl && gx + i < ix1 - 1; i++) P.tint(gx + i, gy, R[6], i === 0 || i === gl - 1 ? 0.25 : 0.45);
      if (k % 3 === 0) P.set(gx + (gl >> 1), gy, R[6]);
    }
    // water line against the rim and the reflected glow of the far wall
    for (let x = ix0; x <= ix1; x++) P.set(x, iy0, R[4]);
    for (let y = iy0; y <= iy1; y++) { P.tint(ix0, y, R[0], 0.5); P.tint(ix1, y, R[0], 0.5); }
    for (let x = ix0; x <= ix1; x++) P.tint(x, iy1, R[0], 0.4);
    const cx = w / 2, cy = (iy0 + iy1) / 2, lr = Math.round(clamp(Math.max(w, h) * 0.55, 24, 80));
    const lights = [L(cx, cy, lr, POOL_RGB[hue] || POOL_RGB.azure, 0.38)];
    if (w > h * 2.2) lights.push(L(w * 0.18, cy, Math.round(lr * 0.7), POOL_RGB[hue] || POOL_RGB.azure, 0.25), L(w * 0.82, cy, Math.round(lr * 0.7), POOL_RGB[hue] || POOL_RGB.azure, 0.25));
    if (h > w * 2.2) lights.push(L(cx, h * 0.18, Math.round(lr * 0.7), POOL_RGB[hue] || POOL_RGB.azure, 0.25), L(cx, h * 0.82, Math.round(lr * 0.7), POOL_RGB[hue] || POOL_RGB.azure, 0.25));
    return { P, shimmer, lights };
  }
  const CRESCENT = ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'];
  const STAR5 = ['..#..', '..#..', '#####', '.###.', '.#.#.'];
  function makeRunner(w, h, seed) {
    const vert = h >= w, W = vert ? w : h, H = vert ? h : w, P = new Pix(w, h);
    const put = (u, v, c) => (vert ? P.set(u, v, c) : P.set(v, u, c));
    const V = VIOLET, G = GOLD;
    for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) {
      const e = Math.min(u, W - 1 - u);
      let c;
      if (v < 2 || v >= H - 2) { c = (u % 2 === 0) ? (v === 0 || v === H - 1 ? '#c8b89a' : '#e8dcc0') : null; if (c) put(u, v, c); continue; } // fringe
      if (e === 0) c = V[0];
      else if (e === 1 || e === 3) c = G[2];
      else if (e === 2) c = ((v >> 1) % 2) ? G[4] : G[3];
      else if (e === 4) c = V[1];
      else {
        const lat = ((u + v) % 6 === 0 || (u - v + 600) % 6 === 0);
        c = lat ? V[4] : V[3];
        if (noise(u / 5, v / 9, seed) > 0.72) c = lat ? V[5] : V[4];
        if (hash(u, v, seed + 1) < 0.02) c = V[2];
      }
      if (v === 2 || v === H - 3) c = G[2];
      put(u, v, c);
    }
    // repeating moons and stars down the middle
    const mid = Math.floor(W / 2), step = 26;
    for (let k = 0, v0 = 10; v0 < H - 12; k++, v0 += step / 2) {
      if (k % 2 === 0) {
        for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (CRESCENT[j][i] === '#') put(mid - 3 + i, v0 + j, i < 2 ? G[5] : G[4]);
        put(mid - 1, v0 + 2, G[6]);
      } else {
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (STAR5[j][i] === '#') put(mid - 2 + i, v0 + 1 + j, SILVER[4]);
        put(mid, v0 + 3, SILVER[6]);
      }
    }
    return P;
  }

  // ================================================================== pieces (registry filled below)
  const DEFS = {};
  function def(id, n, make) { DEFS[id] = { n, make }; }

  // ------------------------------------------------------------------ helpers for furniture
  // an elliptical wooden top with a rim (round tables, stools): cy = centre row of the top surface
  function ellTop(P, cx, cy, rx, ry, R, thick) {
    for (let t = thick; t >= 1; t--) P.ell(cx, cy + t, rx, ry, (x, y) => P.set(x, y, t === thick ? R[1] : R[2]));
    P.ell(cx, cy, rx, ry, (x, y, nx, ny) => {
      const d = nx * nx + ny * ny, s = -nx * 0.55 - ny * 0.75;
      let k = s > 0.45 ? 5 : s > -0.1 ? 4 : 3;
      if (d > 0.62) k = ny < 0 ? (nx < 0.2 ? 5 : 4) : 3;
      if (ny < -0.2 && nx < -0.1 && d > 0.25 && d < 0.5) k = 6;
      P.set(x, y, R[clamp(k, 0, R.length - 1)]);
    });
  }
  function tankard(P, x, by) { // 4x6 wooden mug with brass hoops and foam, handle on the right
    for (let j = 0; j < 5; j++) for (let i = 0; i < 4; i++) P.set(x + i, by - j, (j === 1 || j === 3) ? BRASS[i === 0 ? 4 : i === 3 ? 2 : 3] : WOOD[i === 0 ? 4 : i === 3 ? 2 : 3]);
    P.set(x + 4, by - 3, WOOD[2]); P.set(x + 5, by - 2, WOOD[2]); P.set(x + 4, by - 1, WOOD[2]);
    P.hline(x, x + 3, by - 5, '#f2e6d0'); P.set(x + 3, by - 5, '#d8c6b4'); P.set(x + 1, by - 6, '#fffaf0'); P.set(x, by - 4, '#f2e6d0');
  }
  function brassStick(P, x, by, h, f, kind) { // brass candlestick with a 2px candle; returns the flame point
    P.hline(x - 1, x + 2, by, BRASS[3]); P.set(x - 1, by, BRASS[4]); P.set(x + 2, by, BRASS[2]);
    P.set(x, by - 1, BRASS[4]); P.set(x + 1, by - 1, BRASS[2]);
    P.hline(x - 1, x + 2, by - 2, BRASS[3]); P.set(x - 1, by - 2, BRASS[5]);
    return candle(P, x, by - 3, h, 2, f, kind);
  }

  // ------------------------------------------------------------------ The Gilded Owl (tavern)
  function barSeg(side, item) {
    const W = 16, H = 32, b = H - 1, R = OAK;
    const draw = (f) => {
      const P = new Pix(W, H);
      const x0 = side === 'l' ? 1 : 0, x1 = side === 'r' ? 14 : 15, yTop = b - 24, yLip = b - 16;
      for (let x = x0; x <= x1; x++) {
        for (let y = yTop; y < yLip; y++) {
          const ly = y - yTop; let c = ly === 0 ? R[3] : R[4];
          if (ly === 2 || ly === 5) c = R[5];
          if (ly === 3 && ((x + 5) & 15) < 6) c = R[5];
          if (ly === 6 && ((x + 11) & 15) < 3) c = R[6];
          if (ly === 1 && (x & 7) === 3) c = R[3];
          P.set(x, y, c);
        }
        P.set(x, yLip, R[6]); P.set(x, yLip + 1, R[2]); P.set(x, yLip + 2, R[0]);
        P.set(x, yLip + 3, R[4]); P.set(x, yLip + 4, (x & 1) ? R[2] : R[3]);
        const lx = x & 15;
        for (let y = yLip + 5; y <= b - 4; y++) {
          const ly = y - (yLip + 5), ph = b - 4 - (yLip + 5);
          let c = R[3];
          if (lx >= 2 && lx <= 13) {
            if (ly === 0) c = R[5]; else if (ly === ph) c = R[1];
            else if (lx === 2) c = R[4]; else if (lx === 13) c = R[2];
            else c = R[3];
          } else c = lx === 0 || lx === 15 ? R[2] : R[3];
          P.set(x, y, c);
        }
        // carved crescent on each panel
        if (lx === 7 || lx === 8) { P.set(x, yLip + 8, lx === 7 ? R[5] : R[4]); P.set(x, yLip + 11, R[4]); }
        if (lx === 6) { P.set(x, yLip + 9, R[5]); P.set(x, yLip + 10, R[5]); }
        if (lx === 7) { P.set(x, yLip + 9, R[2]); P.set(x, yLip + 10, R[2]); }
        // brass foot rail and plinth
        P.set(x, b - 3, (lx === 5 || lx === 11) ? BRASS[5] : BRASS[4]); P.set(x, b - 2, BRASS[2]); P.set(x, b - 1, R[1]);
        if (lx === 3 || lx === 12) { P.set(x, b - 4, BRASS[3]); }
      }
      if (side === 'l') { // finished end post
        for (let y = yTop; y <= b - 1; y++) P.set(1, y, y < yLip ? R[5] : y === b - 3 ? BRASS[4] : R[4]);
        P.d[yTop * W + 1] = 0; P.set(2, yTop, R[4]); // rounded corner
        for (let y = yLip + 3; y <= b - 4; y++) P.set(2, y, R[3]);
      }
      if (side === 'r') {
        for (let y = yTop; y <= b - 1; y++) P.set(14, y, y < yLip ? R[3] : y === b - 3 ? BRASS[2] : R[1]);
        P.d[yTop * W + 14] = 0; P.set(13, yTop, R[3]);
        for (let y = yLip + 3; y <= b - 4; y++) P.set(13, y, R[2]);
      }
      if (item === 1) { // a glass of wine and a foaming tankard
        P.set(3, yTop + 2, GLASS[3]); P.set(4, yTop + 2, WINE[4]); P.set(5, yTop + 2, GLASS[2]);
        P.set(3, yTop + 3, WINE[4]); P.set(4, yTop + 3, WINE[3]); P.set(5, yTop + 3, WINE[2]);
        P.set(4, yTop + 4, WINE[2]); P.set(4, yTop + 5, GLASS[2]); P.set(4, yTop + 6, GLASS[2]);
        P.hline(3, 5, yTop + 7, GLASS[3]); P.set(5, yTop + 7, GLASS[2]);
        P.set(4, yTop + 8, WINE[2]);
        tankard(P, 9, yTop + 6); P.hline(9, 12, yTop + 7, R[3]);
      }
      if (item === 2) {
        const fl = brassStick(P, 7, yTop + 5, 5, f);
        P.set(7, yTop + 6, GOLD[3]); P.set(8, yTop + 6, GOLD[2]); P.set(7, yTop + 7, GOLD[2]); // flame reflected in the polish
        return { P, fl };
      }
      if (item === 3) { // tiny golden owl on a jet plinth
        P.hline(5, 10, yTop + 6, R[1]); P.hline(5, 10, yTop + 5, R[3]); P.set(5, yTop + 5, R[4]);
        const G = GOLD, oy = yTop - 2;
        const owl = ['.t..t.', 'tGGGGt', 'GeGGeG', 'GGbbGG', 'GgGGgG', '.GGGG.', '.f..f.'];
        for (let j = 0; j < owl.length; j++) for (let i = 0; i < 6; i++) {
          const ch = owl[j][i], x = 5 + i, y = oy + j;
          if (ch === 't' || ch === 'G' || ch === 'g') P.set(x, y, ch === 'g' ? G[3] : i <= 1 ? G[5] : i <= 3 ? G[4] : G[3]);
          else if (ch === 'e') P.set(x, y, '#2a160c');
          else if (ch === 'b') P.set(x, y, G[2]);
          else if (ch === 'f') P.set(x, y, G[2]);
        }
        P.set(6, oy + 1, G[6]); P.set(7, yTop + 6, G[3]);
      }
      return { P };
    };
    const meta = { ax: 8, ay: b, foot: [1, 1], solid: true };
    if (item === 2) {
      const r0 = draw(0);
      meta.lights = [L(r0.fl.x, r0.fl.y - 1, 34, L_CANDLE, 0.7, 1)];
      return build(meta, (f) => { const r = draw(f); r.P.outline(OUT); return r.P; }, 4, 6);
    }
    const r = draw(0); r.P.outline(OUT);
    if (item === 3) meta.lights = [L(8, 4, 12, [255, 212, 130], 0.25)];
    return sprite(Object.assign(meta, { c: r.P.canvas() }));
  }
  def('bar_l', 1, () => barSeg('l', 0));
  def('bar_m', 4, (v) => barSeg('m', v));
  def('bar_r', 1, () => barSeg('r', 0));

  def('bottle_shelf', 2, (v) => {
    const W = 32, H = 48, R = OAK, seed = 101 + v * 37;
    const liqs = Object.keys(LIQ);
    // plan the bottles once so every frame matches
    const shelves = [17, 28, 39], plan = [];
    for (let s = 0; s < 3; s++) {
      let x = 4;
      for (let k = 0; x < 27; k++) {
        const h = hash(s, k, seed);
        let kind = 'bottle';
        if (v === 1 && s === 1 && k === 2) kind = 'skull';
        if (v === 1 && s === 0 && k === 3) kind = 'orb';
        if (v === 0 && s === 2 && k === 1) kind = 'jar';
        const shape = Math.floor(hash(s, k, seed + 1) * BOTTLES.length), liq = liqs[Math.floor(hash(s, k, seed + 2) * liqs.length)];
        const wdt = kind === 'skull' ? 5 : kind === 'orb' ? 5 : kind === 'jar' ? 5 : BOTTLES[shape][0].length;
        if (x + wdt > 28) break;
        plan.push({ s, x, kind, shape, liq, glow: kind === 'orb' || (kind === 'bottle' && h < 0.2) });
        x += wdt + (hash(s, k, seed + 3) < 0.35 ? 1 : 0);
      }
    }
    let glowN = 0; for (const p of plan) { if (p.glow && p.kind === 'bottle') { glowN++; if (glowN > 3) p.glow = false; } }
    if (!plan.some((p) => p.glow)) plan[Math.floor(plan.length / 2)].glow = true;
    const lights = [];
    const draw = (f) => {
      const P = new Pix(W, H);
      // crest with a crescent finial
      for (let x = 2; x <= 29; x++) { const peak = Math.max(0, 4 - Math.floor(Math.abs(x - 15.5) / 3)); for (let y = 5 - peak; y <= 5; y++) P.set(x, y, y === 5 - peak ? R[5] : R[3]); }
      P.set(15, 0, GOLD[5]); P.set(16, 0, GOLD[4]); P.set(14, 1, GOLD[4]); P.set(17, 1, GOLD[3]); P.set(15, 2, GOLD[3]); P.set(16, 2, GOLD[2]);
      P.hline(1, 30, 6, R[5]); P.hline(1, 30, 7, R[2]);
      // back panel
      for (let y = 8; y <= 39; y++) for (let x = 3; x <= 28; x++) P.set(x, y, (x % 5 === 0) ? R[0] : (hash(x, y >> 2, 3) < 0.2 ? R[2] : R[1]));
      // sides
      for (let y = 6; y <= 41; y++) { P.set(1, y, R[5]); P.set(2, y, R[3]); P.set(29, y, R[2]); P.set(30, y, R[1]); }
      // corbels
      for (const cx of [3, 27]) for (let j = 0; j < 4; j++) for (let i = 0; i < 4 - j; i++) P.set(cx + i + (cx > 15 ? j : 0), 42 + j, i === 0 ? R[4] : R[2]);
      for (const sy of shelves) { P.hline(3, 28, sy, R[5]); P.hline(3, 28, sy + 1, R[3]); P.hline(1, 30, sy + 1, R[3]); for (let x = 3; x <= 28; x++) P.dark(x, sy + 2, 0.45); }
      P.hline(1, 30, 41, R[2]);
      for (const p of plan) {
        const by = shelves[p.s] - 1;
        if (p.kind === 'bottle') {
          const r = bottle(P, p.x, by, p.shape, p.liq, p.glow, 0.45 + hash(p.x, p.s, seed) * 0.5);
          if (p.glow && r.core && f === 0) lights.push(L(r.core[0], r.core[1], 20, LIQ_RGB[p.liq], 0.5));
          if (p.glow && r.core && (f & 1)) P.set(r.core[0], r.core[1] + 1, LIQ[p.liq][3]);
        } else if (p.kind === 'skull') {
          const sk = ['.###.', '#####', '#o#o#', '##.##', '.#=#.'];
          for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const ch = sk[j][i]; if (ch === '#') P.set(p.x + i, by - 4 + j, i < 2 ? PAPER[3] : PAPER[2]); else if (ch === 'o') P.set(p.x + i, by - 4 + j, '#1a1016'); else if (ch === '=') P.set(p.x + i, by - 4 + j, PAPER[1]); }
        } else if (p.kind === 'orb') {
          P.hline(p.x + 1, p.x + 3, by, BRASS[3]);
          P.ell(p.x + 2, by - 3, 2.2, 2.2, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.6 ? MAGIC[4] : nx + ny < 0.4 ? MAGIC[3] : MAGIC[2]));
          P.set(p.x + 2, by - 3, f & 1 ? '#ffffff' : MAGIC[4]);
          if (f === 0) lights.push(L(p.x + 2, by - 3, 22, [180, 140, 255], 0.5));
        } else if (p.kind === 'jar') { // a pickled something
          for (let j = 0; j < 6; j++) for (let i = 0; i < 5; i++) P.set(p.x + i, by - j, j === 5 ? '#6a4028' : i === 0 ? GLASS[3] : i === 4 ? GLASS[1] : '#4a6a3a');
          P.set(p.x + 2, by - 3, '#c8b890'); P.set(p.x + 3, by - 2, '#c8b890'); P.set(p.x + 2, by - 2, '#a89870');
        }
      }
      // twinkle: one glint per frame on a different bottle
      const tw = plan.filter((p) => p.kind === 'bottle');
      const t = tw[(f * 5 + 2) % tw.length];
      if (t) { const by = shelves[t.s] - 1, rows = BOTTLES[t.shape], gx = t.x + Math.floor(rows[0].length / 2), gy = by - rows.length + 2; P.set(gx, gy, '#ffffff'); P.set(gx - 1, gy, '#c8d4f0'); P.set(gx + 1, gy, '#c8d4f0'); }
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true }, draw, 4, 3);
    s.lights = lights;
    return s;
  });

  def('keg_rack', 1, () => {
    const W = 32, H = 37, b = H - 1, P = new Pix(W, H), WD = WOOD;
    const marks = [['.##', '#..', '.##'], ['#.#', '.#.', '#.#'], ['.#.', '###', '.#.']];
    const barrelBody = (cx, top, w) => { // the barrel's curved back, seen from above, behind its head
      for (let y = top; y < top + 6; y++) { const ins = y === top ? 2 : y === top + 1 ? 1 : 0; for (let x = Math.round(cx - w + ins); x <= Math.round(cx + w - ins); x++) { const rel = (x - (cx - w)) / (2 * w); let c = (Math.round(x - cx) % 3 === 0) ? WD[2] : WD[rel < 0.3 ? 4 : rel < 0.72 ? 3 : 2]; if (y === top + 3) c = IRON[rel < 0.3 ? 4 : rel < 0.7 ? 3 : 2]; if (y === top) c = WD[rel < 0.4 ? 5 : 4]; P.set(x, y, c); } }
    };
    const head = (cx, cy, mark) => {
      P.ell(cx, cy, 7, 7, (x, y, nx, ny) => {
        const d = Math.sqrt(nx * nx + ny * ny), lit = -nx - ny;
        let c;
        if (d > 0.9) c = WD[1];
        else if (d > 0.74) c = IRON[lit > 0.3 ? 5 : lit > -0.4 ? 3 : 2];
        else { const plank = Math.floor((x - cx + 7) / 3); c = (x - cx + 7) % 3 === 0 ? WD[2] : WD[(plank + (lit > 0.2 ? 1 : 0)) % 2 ? 4 : 3]; if (lit < -0.6) c = WD[2]; }
        P.set(x, y, c);
      });
      const m = marks[mark];
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (m[j][i] === '#') P.set(cx - 1 + i, cy - 4 + j, '#d8d0c4');
      // brass tap
      P.set(cx - 1, cy + 2, BRASS[4]); P.set(cx, cy + 2, BRASS[3]); P.set(cx + 1, cy + 2, BRASS[2]);
      P.set(cx, cy + 1, BRASS[5]); P.set(cx, cy + 3, BRASS[3]); P.set(cx, cy + 4, BRASS[2]);
    };
    barrelBody(8, 13, 6); barrelBody(23, 13, 6);
    head(8, 24, 0); head(23, 24, 1);
    barrelBody(15.5, 2, 6);
    head(15.5, 13, 2);
    // cradle rack
    for (let x = 1; x <= 30; x++) { P.set(x, b - 3, WD[3]); P.set(x, b - 2, WD[2]); P.set(x, b - 1, WD[1]); }
    for (const lx of [1, 2, 29, 30]) for (let y = b - 9; y <= b - 1; y++) P.set(lx, y, lx === 1 || lx === 29 ? WD[3] : WD[1]);
    P.set(15, b - 4, WD[3]); P.set(16, b - 4, WD[2]);
    P.outline(OUT);
    P.shadow(17, b, 15, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('hearth', 1, () => {
    const W = 48, H = 52, ay = 47, S = HSTONE;
    const inOpen = (x, y) => { if (x < 12 || x > 35 || y < 30 || y > 46) return false; const hw = y >= 33 ? 12 : y === 32 ? 11 : y === 31 ? 9 : 6; return Math.abs(x - 23.5) <= hw; };
    const base = new Pix(W, H);
    const B = base;
    // chimney breast (ashlar) up through the ceiling
    for (let y = 0; y <= 24; y++) for (let x = 5; x <= 42; x++) {
      const course = Math.floor(y / 6), off = (course % 2) * 5, lx = (x - 5 + off) % 11, ly = y % 6;
      let k = hash(Math.floor((x - 5 + off) / 11), course, 7) < 0.4 ? 4 : 3;
      if (ly === 5 || lx === 0) k = 1; else if (ly === 0 || lx === 1) k++;
      if (x === 5) k = 5; if (x === 42) k = 1; if (x === 41) k = Math.min(k, 2);
      B.set(x, y, S[k]);
    }
    // carved moon roundel
    B.ell(23.5, 11, 6, 6, (x, y, nx, ny) => { const d = nx * nx + ny * ny; B.set(x, y, d > 0.7 ? (nx + ny < 0 ? S[6] : S[2]) : S[4]); });
    B.ell(22.5, 11, 3.6, 3.6, (x, y, nx, ny) => B.set(x, y, nx < -0.3 ? S[6] : S[5]));
    B.ell(24.2, 10.3, 3, 3, (x, y) => B.set(x, y, S[3]));
    B.set(21, 9, S[6]);
    // mantel shelf and corbels
    for (let x = 1; x <= 46; x++) { B.set(x, 25, S[5]); B.set(x, 26, S[6]); B.set(x, 27, S[4]); B.set(x, 28, x % 3 === 0 ? S[2] : S[3]); B.set(x, 29, S[1]); }
    B.set(1, 25, S[6]); B.set(46, 25, S[3]);
    for (const cx of [3, 41]) for (let j = 0; j < 5; j++) for (let i = 0; i < 5 - Math.floor(j / 2); i++) { const x = cx + i + (cx > 20 ? Math.floor(j / 2) : 0); B.set(x, 30 + j, i === 0 ? S[5] : j === 4 - 0 && i > 1 ? S[1] : S[3]); }
    // jambs
    for (let y = 30; y <= 46; y++) for (let x = 5; x <= 42; x++) {
      if (inOpen(x, y)) continue;
      let k = 3;
      if (x === 5 || x === 36) k = 5; else if (x === 11 || x === 42) k = 1; else if (x === 8 || x === 39) k = 4;
      if (x > 11 && x < 36) k = y < 31 ? 4 : 3; // spandrels
      if ((y - 30) % 6 === 5 && (x <= 11 || x >= 36)) k = 2;
      B.set(x, y, S[k]);
    }
    // firebox: soot, fireback with a moon, ash bed
    for (let y = 30; y <= 46; y++) for (let x = 12; x <= 35; x++) if (inOpen(x, y)) B.set(x, y, (y + x) % 7 === 0 ? '#1a1420' : '#100c16');
    for (let y = 34; y <= 40; y++) for (let x = 18; x <= 29; x++) B.set(x, y, (y === 34 || x === 18) ? IRON[3] : IRON[2]);
    B.set(23, 36, IRON[5]); B.set(22, 37, IRON[5]); B.set(22, 38, IRON[5]); B.set(23, 39, IRON[5]);
    for (let x = 12; x <= 35; x++) { B.set(x, 45, '#2a2028'); B.set(x, 46, '#1e1820'); }
    // hearthstone slab protruding onto the floor
    for (let y = 47; y <= 50; y++) for (let x = 2; x <= 45; x++) B.set(x, y, y === 50 ? S[2] : y === 47 ? S[3] : (x % 12 === 0 ? S[2] : y === 48 ? S[5] : S[4]));
    // mantel dressing: skull, crystal, bottle
    const sk = ['.###.', '#####', '#o#o#', '##.##', '.#=#.'];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) { const ch = sk[j][i], x = 15 + i, y = 20 + j; if (ch === '#') B.set(x, y, i < 2 ? PAPER[3] : PAPER[2]); else if (ch === 'o') B.set(x, y, '#1a1016'); else if (ch === '=') B.set(x, y, PAPER[1]); }
    const cr = [[29, 24, 4], [30, 24, 6], [31, 24, 5], [32, 24, 3], [28, 24, 2]];
    for (const [x, y, h] of cr) for (let j = 0; j < h; j++) B.set(x, y - j, j === h - 1 ? MAGIC[4] : x <= 29 ? MAGIC[3] : MAGIC[2]);
    B.set(30, 20, '#ffffff');
    bottle(B, 34, 24, 3, 'emerald', true, 0.8);
    const lights = [];
    const draw = (f) => {
      const P = base.clone();
      // logs on firedogs
      for (let x = 15; x <= 32; x++) { P.set(x, 43, WOOD[2]); P.set(x, 44, WOOD[1]); if (x > 17 && x < 30) { P.set(x, 42, WOOD[1]); P.set(x, 41, x % 4 === f % 4 ? EMER[3] : WOOD[2]); } }
      P.set(15, 43, '#3a2a28'); P.set(32, 43, '#3a2a28');
      for (const fx of [14, 33]) { P.vline(fx, 40, 46, IRON[3]); P.set(fx, 39, IRON[5]); P.set(fx - 1, 46, IRON[2]); P.set(fx + 1, 46, IRON[2]); }
      // violet-green magic flames: overlapping swaying tongues, white-green core, violet tips
      const tg = [[14.5, 7, 2.2], [17.5, 10, 2.6], [20.5, 13, 2.8], [23.5, 15, 3.2], [26.5, 13, 2.8], [29.5, 10, 2.6], [32.5, 7, 2.2]];
      for (let y = 29; y <= 42; y++) for (let x = 12; x <= 35; x++) {
        if (!inOpen(x, y)) continue;
        let inten = 0;
        tg.forEach(([tx, th, tw], k) => {
          const hgt = th * (0.68 + 0.5 * hash(k, f, 31)), sway = (hash(k, f + 7, 33) - 0.5) * 3, t = (42.5 - y) / hgt;
          if (t < 0 || t >= 1) return;
          const xc = tx + sway * t * t, wdt = tw * Math.pow(1 - t, 0.75) + 0.35, dx = Math.abs(x + 0.5 - xc);
          if (dx <= wdt) inten = Math.max(inten, (1 - t) * (1 - (dx / wdt) * 0.55));
        });
        if (inten <= 0.04) continue;
        let c = inten > 0.74 ? EMER[5] : inten > 0.56 ? EMER[4] : inten > 0.4 ? EMER[3] : inten > 0.26 ? EMER[2] : inten > 0.15 ? MAGIC[3] : MAGIC[2];
        if (inten > 0.15 && inten <= 0.26 && (x + y + f) % 2 === 0) c = MAGIC[3];
        P.set(x, y, c);
      }
      for (let k = 0; k < 4; k++) { const sx = 15 + Math.floor(hash(k, f, 41) * 18), sy = 30 + Math.floor(hash(k, f, 42) * 5); if (inOpen(sx, sy) && inOpen(sx, sy - 1)) { P.set(sx, sy, k % 2 ? MAGIC[3] : EMER[3]); P.set(sx, sy - 1, MAGIC[2]); } }
      for (let x = 13; x <= 34; x++) if ((x + f) % 3 === 0) P.set(x, 45, (x + f) % 2 ? MAGIC[2] : EMER[2]);
      // mantel candles
      const c1 = candle(P, 8, 24, 6, 2, f), c2 = candle(P, 11, 24, 4, 1, (f + 2) % 4), c3 = candle(P, 38, 24, 5, 2, (f + 1) % 4);
      if (f === 0) lights.push(L(23.5, 37, 78, [110, 255, 180], 1, 1), L(23.5, 32, 46, [176, 128, 255], 0.6, 1), L(c1.x, c1.y, 22, L_CANDLE, 0.45, 1), L(c2.x, c2.y, 16, L_CANDLE, 0.3, 1), L(c3.x, c3.y, 22, L_CANDLE, 0.45, 1), L(30, 20, 16, [176, 136, 255], 0.35));
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 24, ay, foot: [3, 1], solid: true, wall: true }, draw, 4, 8);
    s.lights = lights;
    return s;
  });

  def('table_round', 3, (v) => {
    const W = 16, H = 30, b = H - 1, R = OAK;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let y = b - 7; y <= b - 2; y++) { P.set(6, y, R[4]); P.set(7, y, R[3]); P.set(8, y, R[3]); P.set(9, y, R[1]); }
      P.hline(4, 11, b - 2, R[3]); P.set(3, b - 1, R[3]); P.set(4, b - 1, R[2]); P.set(11, b - 1, R[2]); P.set(12, b - 1, R[1]); P.set(7, b - 1, R[3]); P.set(8, b - 1, R[2]);
      P.set(5, b - 2, R[4]);
      const cy = b - 12;
      ellTop(P, 7.5, cy, 7, 3.6, R, 2);
      let fl = null;
      if (v === 0) { // candle stuck in an old bottle, wax running down
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) P.set(6 + i, cy + 1 - j, i === 0 ? '#3a6a4a' : i === 3 ? '#14301e' : '#24502f');
        P.set(7, cy - 3, '#24502f'); P.set(8, cy - 3, '#14301e'); P.set(7, cy - 4, '#3a6a4a'); P.set(8, cy - 4, '#24502f');
        P.set(6, cy - 1, WAX[3]); P.set(6, cy, WAX[2]); P.set(9, cy - 2, WAX[2]); P.set(8, cy + 1, WAX[3]);
        fl = candle(P, 7, cy - 5, 4, 2, f);
        P.set(10, cy + 2, GOLD[3]); P.set(11, cy + 2, GOLD[2]);
      } else if (v === 1) {
        tankard(P, 2, cy + 1); tankard(P, 9, cy + 2);
        P.set(7, cy - 1, '#c8a060'); P.set(8, cy, '#a87a48');
      } else { // wizard chess
        for (let j = 0; j < 4; j++) for (let i = 0; i < 10; i++) P.set(3 + i, cy - 2 + j, j === 3 ? R[1] : ((Math.floor(i / 2) + j) % 2 ? '#2a2238' : '#d8ccb8'));
        const pcs = [[4, 0, 'w'], [6, -1, 'k'], [9, 1, 'd'], [11, -1, 'D'], [8, 0, 'w']];
        for (const [x, dy, t] of pcs) {
          const y = cy - 2 + dy; const light = t === 'w' || t === 'k';
          P.set(x, y, light ? '#f2ece6' : '#4a3b6d'); P.set(x, y - 1, light ? '#ffffff' : '#604e88');
          if (t === 'k') P.set(x, y - 2, GOLD[4]);
          if (t === 'D') P.set(x, y - 2, MAGIC[2]);
        }
        P.set(11, cy - 6 - (f & 1), MAGIC[4]); P.set(10, cy - 5 + (f & 1), MAGIC[3]);
      }
      P.outline(OUT);
      P.shadow(9, b, 7, 1.8);
      return { P, fl };
    };
    const meta = { ax: 8, ay: b, foot: [1, 1], solid: true };
    if (v === 0) { const r0 = draw(0); meta.lights = [L(r0.fl.x, r0.fl.y - 1, 34, L_CANDLE, 0.7, 1)]; return build(meta, (f) => draw(f).P, 4, 6); }
    if (v === 2) { meta.lights = [L(11, 12, 12, [180, 140, 255], 0.3)]; return build(meta, (f) => draw(f).P, 2, 2); }
    return sprite(Object.assign(meta, { c: draw(0).P.canvas() }));
  });

  // Gothic tavern chair; facing 0 down, 1 up, 2 left, 3 right
  function chairPix(dir, R, cush) {
    const W = 16, H = 25, b = H - 1, P = new Pix(W, H);
    if (dir === 0) {
      P.vline(4, b - 9, b - 3, R[2]); P.vline(11, b - 9, b - 3, R[1]);                  // back legs
      for (let y = b - 20; y <= b - 9; y++) { P.set(3, y, R[5]); P.set(4, y, R[3]); P.set(11, y, R[3]); P.set(12, y, R[1]); }
      P.set(3, b - 21, R[6]); P.set(4, b - 21, R[4]); P.set(11, b - 21, R[4]); P.set(12, b - 21, R[2]); P.set(3, b - 22, GOLD[4]); P.set(12, b - 22, GOLD[2]);
      for (let x = 5; x <= 10; x++) { const pk = Math.round(2.4 - Math.abs(x - 7.5)); for (let y = b - 18 - pk; y <= b - 16; y++) P.set(x, y, y === b - 18 - pk ? R[5] : y === b - 16 ? R[2] : R[4]); }
      for (let y = b - 15; y <= b - 10; y++) for (let x = 6; x <= 9; x++) P.set(x, y, x === 6 ? R[4] : x === 9 ? R[2] : R[3]);
      P.set(7, b - 14, R[0]); P.set(8, b - 13, R[0]); P.set(7, b - 12, R[0]); P.set(8, b - 14, R[1]); // pierced crescent
      for (let x = 5; x <= 10; x++) P.set(x, b - 10, R[2]);
      for (let y = b - 9; y <= b - 7; y++) for (let x = 2; x <= 13; x++) P.set(x, y, x === 2 || y === b - 9 ? cush[4] : x === 13 ? cush[2] : cush[3]);
      P.set(5, b - 8, cush[5] || cush[4]); P.set(2, b - 9, cush[3]); P.set(13, b - 9, cush[2]);
      P.hline(2, 13, b - 6, R[4]); P.set(13, b - 6, R[2]); P.hline(3, 12, b - 5, R[1]);
      P.vline(2, b - 5, b - 1, R[4]); P.vline(13, b - 5, b - 1, R[2]); P.set(3, b - 5, R[3]);
    } else if (dir === 1) {
      P.vline(4, b - 8, b - 4, R[2]); P.vline(11, b - 8, b - 4, R[1]);                  // far front legs
      for (let y = b - 20; y <= b - 1; y++) { P.set(3, y, R[4]); P.set(4, y, y > b - 8 ? R[2] : R[3]); P.set(11, y, y > b - 8 ? R[1] : R[2]); P.set(12, y, R[1]); }
      P.set(3, b - 21, R[5]); P.set(4, b - 21, R[3]); P.set(11, b - 21, R[3]); P.set(12, b - 21, R[1]); P.set(3, b - 22, GOLD[3]); P.set(12, b - 22, GOLD[2]);
      for (let x = 5; x <= 10; x++) { const pk = Math.round(2.4 - Math.abs(x - 7.5)); for (let y = b - 18 - pk; y <= b - 8; y++) P.set(x, y, y === b - 18 - pk ? R[4] : y === b - 8 ? R[1] : (x === 5 ? R[3] : R[2])); }
      P.hline(5, 10, b - 15, R[1]); P.hline(5, 10, b - 11, R[1]); P.set(7, b - 13, R[3]); P.set(8, b - 13, R[3]);
      P.hline(2, 13, b - 8, cush[2]); P.set(2, b - 8, cush[3]); P.hline(2, 13, b - 7, R[1]);
    } else {
      // facing left: seat to the left, backrest on the right
      for (let y = b - 21; y <= b - 1; y++) { P.set(11, y, R[4]); P.set(12, y, R[2]); }
      P.set(11, b - 22, R[5]); P.set(12, b - 22, R[3]); P.set(11, b - 23, GOLD[4]);
      for (let y = b - 19; y <= b - 11; y++) P.set(10, y, y === b - 19 ? R[5] : R[3]);
      P.set(10, b - 20, R[4]);
      P.vline(13, b - 9, b - 3, R[1]); P.vline(4, b - 7, b - 3, R[1]);                  // far legs
      for (let y = b - 10; y <= b - 8; y++) for (let x = 2; x <= 11; x++) P.set(x, y, y === b - 10 ? cush[4] : x === 2 ? cush[4] : cush[3]);
      P.set(4, b - 10, cush[5] || cush[4]); P.hline(2, 11, b - 7, R[4]); P.hline(2, 11, b - 6, R[2]);
      P.vline(2, b - 6, b - 1, R[4]); P.vline(3, b - 6, b - 1, R[2]); P.vline(11, b - 6, b - 1, R[3]);
    }
    P.outline(OUT);
    P.shadow(9, b, 6.5, 1.6);
    return dir === 3 ? P.flipX() : P;
  }
  def('chair', 4, (v) => {
    const P = v === 3 ? chairPix(2, OAK, WINE).flipX() : chairPix(v, OAK, WINE);
    return sprite({ c: P.canvas(), ax: 8, ay: P.h - 1, foot: [1, 1], solid: true });
  });

  def('stool', 1, () => {
    const W = 14, H = 18, b = H - 1, P = new Pix(W, H), R = OAK;
    // three splayed legs with a brass foot ring
    P.line(4, b - 9, 2, b - 1, R[5]); P.line(5, b - 9, 3, b - 1, R[3]);
    P.line(9, b - 9, 11, b - 1, R[2]); P.line(8, b - 9, 10, b - 1, R[3]);
    P.line(7, b - 8, 7, b - 3, R[2]);
    P.hline(3, 10, b - 5, BRASS[3]); P.set(3, b - 5, BRASS[5]); P.set(4, b - 5, BRASS[4]); P.set(10, b - 5, BRASS[1]);
    // round seat: wooden rim and a buttoned velvet cushion
    P.ell(6.5, b - 10, 5.4, 2.2, (x, y, nx, ny) => P.set(x, y, ny > 0.2 ? R[2] : nx < -0.3 ? R[5] : R[4]));
    P.hline(2, 11, b - 9, R[2]); P.hline(3, 10, b - 8, R[1]);
    P.ell(6.5, b - 11, 4.3, 1.7, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.5 ? WINE[5] : nx + ny < 0.4 ? WINE[4] : WINE[3]));
    P.set(6, b - 11, WINE[2]);
    P.outline(OUT); P.shadow(8, b, 5, 1.4);
    return sprite({ c: P.canvas(), ax: 7, ay: b, foot: [1, 1], solid: true });
  });

  def('chandelier', 1, () => {
    const W = 42, H = 30, b = H - 1;
    const cs = [[5, 20, 6, 2], [10, 14, 7, 2], [15, 24, 5, 2], [20, 11, 8, 2], [26, 22, 6, 2], [30, 15, 7, 2], [35, 21, 5, 2], [13, 9, 4, 1], [27, 8, 5, 1], [22, 27, 4, 1]];
    const draw = (f) => {
      const P = new Pix(W, H);
      cs.forEach(([x, by, h, w], k) => candle(P, x, by, h, w, (f + k * 3) % 4));
      const motes = [[3, 12], [17, 18], [33, 9], [24, 17], [38, 27], [8, 27]];
      motes.forEach(([mx, my], k) => { const ph = (f + k) % 4; if (ph < 3) P.set(mx + (k % 2 ? ph - 1 : 0), my - ph, ph === 1 ? '#ffffff' : MAGIC[4]); });
      P.outline(OUT);
      for (const [x, by] of cs) P.set(x, by + 1, OUT);
      return P;
    };
    return build({ ax: 21, ay: b, foot: [1, 1], solid: false, overhead: true, lights: [L(21, 14, 72, L_CANDLE, 0.8, 1), L(7, 15, 34, L_CANDLE, 0.4, 1), L(33, 15, 34, L_CANDLE, 0.4, 1)] }, draw, 4, 6);
  });

  // sky helpers for windows (day: soft lilac, night: indigo with stars)
  function sky(x, y, y0, y1, night, seed) {
    const t = clamp((y - y0) / Math.max(1, y1 - y0), 0, 1);
    if (!night) {
      let c = rampAt(['#7c6cb0', '#9284c4', '#aa98d2', '#c4aedc', '#dcc2e2', '#ecd2e2'], t * 0.9 + 0.05, x, y);
      if (noise(x / 7, y / 3, seed) > 0.68) c = mix(c, '#f6ecf6', 0.55);
      return c;
    }
    let c = rampAt(['#0c0c26', '#121236', '#1a1a48', '#24245a', '#2e2e6a'], t * 0.85, x, y);
    const h = hash(x, y, seed + 5);
    if (h < 0.018) c = h < 0.006 ? '#ffffff' : '#c8d4f0';
    return c;
  }
  def('moon_window', 1, () => {
    const W = 48, H = 48, cx = 23.5, cy = 21, R = OAK;
    const draw = (f, night) => {
      const P = new Pix(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 20.5) continue;
        if (d > 17.2) { const lit = (x - cx) + (y - cy) < 0; P.set(x, y, d > 19.8 ? R[1] : d > 18.4 ? (lit ? R[5] : R[3]) : R[2]); continue; }
        let c = sky(x, y, 4, 38, night, 17);
        if (night) {
          const md = Math.hypot(x - 30, y - 14);
          if (md < 10.5) { c = md > 9.6 ? '#c8d4f0' : noise(x / 3, y / 3, 9) > 0.62 ? '#c8d4f0' : (x - 30) + (y - 14) > 6 ? '#d6def4' : '#eef2ff'; if (Math.hypot(x - 27, y - 12) < 2.2 || Math.hypot(x - 33, y - 17) < 1.6) c = '#a8b8dc'; }
          else if (md < 12.5) c = mix(c, '#4a4a8a', 0.5);
        }
        const lead = Math.round(x - cx) === 0 || Math.round(y - cy) === 0 || (((x + y) % 8 + 8) % 8 === 0) || (((x - y) % 8 + 8) % 8 === 0) || Math.abs(d - 8.5) < 0.5;
        if (lead) c = '#241a2c';
        P.set(x, y, c);
      }
      for (const a of [0, 1, 2, 3, 4, 5, 6, 7]) { const ang = a * Math.PI / 4; P.set(cx + Math.cos(ang) * 18.8, cy + Math.sin(ang) * 18.8, GOLD[4]); }
      P.set(cx, 0, GOLD[5]); P.set(cx - 1, 1, GOLD[4]); P.set(cx + 1, 1, GOLD[3]);
      for (let x = 11; x <= 36; x++) { P.set(x, 42, R[6]); P.set(x, 43, R[4]); P.set(x, 44, R[2]); }
      bottle(P, 14, 41, 0, 'violet', false, 0.6); bottle(P, 31, 41, 3, 'rose', false, 0.7);
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 24, ay: H - 1, foot: [3, 1], solid: true, wall: true, lights: [L(24, 22, 66, [214, 196, 245], 0.55)] }, draw, 1, 0, true);
    s.nLights = [L(24, 22, 72, [150, 172, 255], 0.65)];
    return s;
  });

  def('stage', 1, () => {
    const W = 64, H = 80, b = H - 1, R = OAK, top0 = b - 38, front = b - 8;
    const base = new Pix(W, H), P0 = base;
    // stage boards
    for (let y = top0; y <= front; y++) for (let x = 1; x <= 62; x++) {
      const ly = y - top0, pl = ly % 4;
      let c = pl === 3 ? R[2] : R[(hash(Math.floor((x + Math.floor(ly / 4) * 13) / 20), ly >> 2, 5) < 0.4) ? 3 : 4];
      if (pl === 0) c = R[4]; if (y === front) c = R[6];
      if (x === 1) c = R[5]; if (x === 62) c = R[2];
      P0.set(x, y, c);
    }
    for (let y = front + 1; y <= b - 1; y++) for (let x = 1; x <= 62; x++) {
      let c = y === front + 1 ? GOLD[2] : (x % 10 === 1) ? R[1] : y === b - 1 ? R[1] : R[3];
      if (y === front + 2 && x % 10 !== 1) c = R[4];
      P0.set(x, y, c);
    }
    // backdrop and curtains
    const cTop = 4, cBot = top0 - 1, V = WINE;
    for (let y = cTop; y <= cBot; y++) for (let x = 2; x <= 61; x++) {
      let c = (x % 4 === 0) ? VIOLET[1] : VIOLET[2];
      if (hash(x, y, 9) < 0.012) c = GOLD[4];
      P0.set(x, y, c);
    }
    const curtain = (xa, xb, tieY, left) => {
      for (let y = cTop; y <= cBot; y++) {
        const pinch = y < tieY ? (y - cTop) / (tieY - cTop) : 1 - (y - tieY) / (cBot - tieY + 6);
        const wdt = Math.round((xb - xa) * (1 - 0.45 * Math.max(0, pinch) * (y < tieY ? 1 : 0.9)));
        for (let i = 0; i <= wdt; i++) {
          const x = left ? xa + i : xb - i, fold = (i + Math.floor(y / 11)) % 4;
          P0.set(x, y, fold === 0 ? V[2] : fold === 1 ? V[4] : V[3]);
        }
        const edge = left ? xa + wdt : xb - wdt; P0.set(edge, y, V[1]);
      }
      for (let i = -1; i <= 1; i++) { P0.set((left ? xa + 5 : xb - 5) + i, tieY, GOLD[4]); }
      P0.set(left ? xa + 5 : xb - 5, tieY + 1, GOLD[3]); P0.set(left ? xa + 5 : xb - 5, tieY + 2, GOLD[2]);
    };
    curtain(2, 13, 26, true); curtain(50, 61, 26, false);
    // swagged valance with gold fringe
    for (let x = 2; x <= 61; x++) {
      const seg = (x - 2) / 20, ph = seg - Math.floor(seg), drop = Math.round(Math.sin(ph * Math.PI) * 5);
      for (let y = cTop; y <= cTop + 3 + drop; y++) P0.set(x, y, y === cTop ? V[5] : (y + x) % 5 === 0 ? V[2] : V[3 + (y < cTop + 2 ? 1 : 0)]);
      P0.set(x, cTop + 4 + drop, (x % 2) ? GOLD[4] : GOLD[3]);
    }
    for (const tx of [2, 22, 42, 61]) { P0.vline(tx, cTop + 2, cTop + 7, GOLD[3]); P0.set(tx, cTop + 8, GOLD[4]); P0.set(tx, cTop + 9, GOLD[2]); }
    P0.hline(0, 63, 3, GOLD[3]); P0.hline(0, 63, 2, GOLD[5]); P0.set(0, 2, GOLD[6]); P0.set(63, 3, GOLD[2]);
    // music stand
    P0.vline(14, top0 + 6, top0 + 18, IRON[3]); P0.line(12, top0 + 20, 14, top0 + 18, IRON[3]); P0.line(16, top0 + 20, 14, top0 + 18, IRON[2]);
    P0.rect(11, top0 + 2, 7, 5, PAPER[3]); P0.hline(11, 17, top0 + 6, IRON[3]); P0.hline(12, 16, top0 + 3, PAPER[1]); P0.hline(12, 15, top0 + 5, PAPER[1]); P0.set(17, top0 + 2, PAPER[2]);
    // lute on its stand
    const lx = 51, ly = top0 + 15;
    P0.line(lx - 4, ly + 9, lx - 1, ly - 1, IRON[3]); P0.line(lx + 3, ly + 9, lx, ly - 1, IRON[2]); P0.hline(lx - 3, lx + 2, ly + 6, IRON[2]);
    // neck and bent-back pegbox, leaning left
    for (let k = 0; k < 10; k++) { const x = lx - 1 - Math.floor(k / 4), y = ly - 5 - k; P0.set(x, y, WOOD[1]); P0.set(x + 1, y, k % 3 === 0 ? PAPER[3] : WOOD[2]); }
    P0.set(lx - 4, ly - 15, WOOD[2]); P0.set(lx - 5, ly - 14, WOOD[1]); P0.set(lx - 6, ly - 13, WOOD[2]); P0.set(lx - 5, ly - 15, GOLD[4]); P0.set(lx - 6, ly - 14, GOLD[3]);
    // round-backed body with a carved rose
    P0.ell(lx, ly + 1, 4.2, 5.2, (x, y, nx, ny) => { const s2 = -nx * 0.6 - ny * 0.8; P0.set(x, y, s2 > 0.55 ? HONEY[6] : s2 > 0.1 ? HONEY[5] : s2 > -0.45 ? HONEY[4] : HONEY[3]); });
    P0.ell(lx, ly + 0.5, 1.4, 1.4, (x, y) => P0.set(x, y, HONEY[0])); P0.set(lx - 1, ly - 1, HONEY[2]);
    P0.hline(lx - 1, lx + 1, ly + 4, WOOD[1]);
    for (let y = ly - 4; y <= ly + 4; y++) P0.set(lx, y, y === ly || y === ly + 1 ? HONEY[0] : PAPER[3]);
    const lights = [];
    const draw = (f) => {
      const P = base.clone();
      for (const [k, x] of [[0, 9], [1, 31], [2, 54]]) {
        P.hline(x - 1, x + 2, front - 1, BRASS[3]); P.set(x - 1, front - 1, BRASS[4]);
        const c = candle(P, x, front - 2, 3, 2, (f + k) % 4);
        if (f === 0) lights.push(L(c.x, c.y, 26, L_CANDLE, 0.45, 1));
      }
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 32, ay: b, foot: [4, 2], solid: true }, draw, 4, 6);
    s.lights = lights; s.stageLift = 7;
    return s;
  });

  const OWL = [
    '.......t....t.......',
    '.......hh..hg.......',
    '.......hhhhhgg......',
    'w......hEEhEEg.....v',
    'ww.....hEPhPEg....vv',
    '.www...hhBBhgg...vvv',
    '.wwwW..ghhBhgd..Vvvv',
    '..wwwWWhhhhhgdVVvvv.',
    '..wwWwWhhkhkgdVvVvv.',
    '...wwWWhhhhhgdVVvv..',
    '...wWwWhkhkhgdVvVv..',
    '....wWw.hhhgd.vVv...',
    '....w.w.hkhkd.v.v...',
    '.........hhgd.......',
    '........ff..ff......',
  ];
  def('owl_statue', 1, () => {
    const W = 20, H = 48, P = new Pix(W, H), G = GOLD, oy = 15;
    for (let j = 0; j < OWL.length; j++) for (let i = 0; i < W; i++) {
      const ch = OWL[j][i], x = i, y = oy + j; let c = null;
      if (ch === 't') c = i < 10 ? G[5] : G[3];
      else if (ch === 'h') c = (i + j) % 5 === 0 ? G[5] : G[4];
      else if (ch === 'g') c = G[3];
      else if (ch === 'd') c = G[2];
      else if (ch === 'k') c = G[3];
      else if (ch === 'E') c = G[6];
      else if (ch === 'P') c = '#2a160c';
      else if (ch === 'B') c = G[1];
      else if (ch === 'f') c = G[2];
      else if (ch === 'w') c = (i + j) % 3 === 0 ? G[4] : G[5];   // lit wing: leading feathers
      else if (ch === 'W') c = G[3];                              // feather separations
      else if (ch === 'v') c = (i + j) % 3 === 0 ? G[2] : G[3];   // shaded wing
      else if (ch === 'V') c = G[1];
      if (c) P.set(x, y, c);
    }
    P.set(8, oy + 3, G[6]); P.set(1, oy + 4, G[6]);
    // gilded bracket
    for (let j = 0; j < 7; j++) { const hw = Math.max(1, 6 - j); for (let x = Math.round(9.5 - hw); x <= Math.round(9.5 + hw) - 1; x++) P.set(x, oy + 15 + j, j === 0 ? HSTONE[6] : j === 1 ? HSTONE[5] : x < 9.5 ? HSTONE[4] : HSTONE[2]); }
    P.set(9, oy + 22, HSTONE[3]);
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 10, ay: H - 1, foot: [1, 1], solid: true, wall: true, lights: [L(10, oy + 4, 16, [255, 214, 130], 0.35)] });
  });

  def('rug_round', 1, () => {
    const W = 48, H = 32, P = new Pix(W, H), cx = 23.5, cy = 15.5, V = VIOLET, G = GOLD;
    P.ell(cx, cy, 21.6, 14.6, (x, y, nx, ny) => {
      const d = Math.sqrt(nx * nx + ny * ny), ang = Math.atan2(ny, nx);
      let c;
      if (d > 0.95) c = V[1];
      else if (d > 0.84) { const seg = Math.floor((ang + Math.PI) / (Math.PI * 2) * 36); c = d > 0.89 && d < 0.92 ? (seg % 2 ? G[4] : G[2]) : G[3]; }
      else if (d > 0.79) c = V[0];
      else if (d > 0.42) {
        c = (Math.floor(d * 30) % 3 === 0) ? V[3] : V[2];
        const seg = (ang + Math.PI) / (Math.PI * 2) * 8, sp = seg - Math.floor(seg);
        if (Math.abs(d - 0.62) < 0.07 && Math.abs(sp - 0.5) < 0.09) c = G[4];
        if (Math.abs(d - 0.62) < 0.035 && Math.abs(sp - 0.5) < 0.2) c = G[3];
      } else if (d > 0.36) c = G[3];
      else { c = V[4]; const sx = Math.abs(x - cx), sy = Math.abs(y - cy); if ((sx < 0.8 && sy < 4) || (sy < 0.8 && sx < 6) || (Math.abs(sx * 0.68 - sy) < 0.5 && sy < 3)) c = G[4]; if (sx < 1 && sy < 1) c = G[6]; }
      if (d < 0.6 && noise(x / 6, y / 4, 3) > 0.7) c = mix(c, '#b4a0c8', 0.12);
      P.set(x, y, c);
    });
    for (let y = 9; y <= 22; y++) { if (y % 2) { P.set(0, y, '#d8ccb4'); P.set(1, y, '#b8ac94'); P.set(47, y, '#b8ac94'); P.set(46, y, '#d8ccb4'); } }
    return sprite({ c: P.canvas(), ax: 24, ay: H - 1, foot: [3, 2], solid: false, flat: true });
  });

  def('window_arch', 2, (v) => {
    const W = v ? 32 : 16, H = 48, R = OAK;
    const draw = (f, night) => {
      const P = new Pix(W, H);
      const glassAt = (x, y, x0, x1, top) => { // round-headed light: x0..x1, straight below row top+r
        const r = (x1 - x0 + 1) / 2, ccx = x0 + r - 0.5, ccy = top + r;
        if (x < x0 || x > x1 || y < top) return false;
        return y >= ccy || Math.hypot(x - ccx, y - ccy) <= r;
      };
      const lightsDef = v ? [[6, 14, 12], [17, 25, 12]] : [[4, 11, 8]];
      const bottom = 31;
      // frame: rectangle with pointed (v1) or round (v0) head
      for (let y = 2; y <= bottom + 1; y++) for (let x = 1; x < W - 1; x++) {
        let inside = false;
        if (v === 0) inside = glassAt(x, y, 2, 13, 4);
        else { const hw = 13.5, ccx = 15.5, dx = Math.abs(x - ccx); const archH = 12; inside = x >= 2 && x <= 29 && y >= 3 && (y >= 3 + archH || dx <= Math.max(0, Math.sqrt(4 * hw * hw - Math.pow((3 + archH - y) * (Math.sqrt(3) * hw / archH), 2)) - hw)); }
        if (inside) P.set(x, y, (x < W / 2) ? R[3] : R[2]);
      }
      for (const [x0, x1, top] of lightsDef) for (let y = top; y <= bottom; y++) for (let x = x0; x <= x1; x++) {
        if (!glassAt(x, y, x0, x1, top)) continue;
        let c = sky(x, y, top, bottom, night, 23 + x0);
        if (((x + y) % 4 === 0) || ((x - y + 400) % 4 === 0)) c = night ? '#1a1630' : '#3e3456';
        P.set(x, y, c);
      }
      if (v === 1) { P.ell(15.5, 7.5, 2.6, 2.6, (x, y, nx, ny) => P.set(x, y, night ? (nx + ny < 0 ? '#3a3a7a' : '#24245a') : (nx + ny < 0 ? '#e8d4ec' : '#b8a4d8'))); P.set(15.5, 7.5, R[1]); }
      for (let x = 0; x < W; x++) { P.set(x, bottom + 2, R[6]); P.set(x, bottom + 3, R[4]); P.set(x, bottom + 4, R[2]); }
      P.outline(OUT);
      return P;
    };
    const cx = W / 2;
    const s = build({ ax: W / 2, ay: H - 1, foot: [v ? 2 : 1, 1], solid: true, wall: true, lights: [L(cx, 20, v ? 46 : 36, [214, 200, 240], v ? 0.5 : 0.4)] }, draw, 1, 0, true);
    s.nLights = [L(cx, 20, v ? 40 : 30, [140, 160, 255], 0.35)];
    return s;
  });

  def('sconce', 2, (v) => {
    const W = 12, H = 48, M = v ? IRON : BRASS;
    const lightsOut = [];
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let y = 16; y <= 29; y++) { const hw = y < 18 ? y - 16 : y > 27 ? 29 - y : 2; for (let x = 6 - hw; x <= 5 + hw; x++) P.set(x, y, x < 5 ? M[4] : x > 6 ? M[2] : M[3]); }
      P.set(5, 22, v ? EMER[2] : GOLD[5]); P.set(6, 22, v ? EMER[1] : GOLD[3]);
      P.set(5, 26, M[1]); P.set(6, 27, M[2]); P.set(5, 28, M[3]);
      if (!v) {
        P.hline(2, 9, 24, M[3]); P.set(2, 24, M[4]); P.set(9, 24, M[1]); P.hline(3, 8, 25, M[2]);
        const c = candle(P, 5, 23, 6, 2, f);
        if (f === 0) lightsOut.push(L(c.x, c.y - 1, 46, L_CANDLE, 0.75, 1));
      } else {
        for (let j = 0; j < 4; j++) { const hw = 3 - Math.floor(j / 2); P.hline(6 - hw, 5 + hw, 21 + j, j === 0 ? M[4] : M[2]); P.set(6 - hw, 21 + j, M[4]); }
        P.vline(2, 13, 21, M[3]); P.vline(9, 13, 21, M[2]); P.hline(2, 9, 12, M[3]);
        flame(P, 5, 20, f, 'witch', 2); flame(P, 6, 20, (f + 2) % 4, 'witch', 1);
        P.set(4, 20, FLAMES.witch[1]); P.set(7, 20, FLAMES.witch[1]);
        if (f === 0) lightsOut.push(L(5.5, 16, 46, L_WITCH, 0.75, 1));
      }
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 6, ay: H - 1, foot: [1, 1], solid: true, wall: true }, draw, 4, 7);
    s.lights = lightsOut;
    return s;
  });

  def('plant_pot', 2, (v) => {
    const W = 16, H = 27, b = H - 1, P = new Pix(W, H);
    const pot = v ? TEALC : TERRA;
    for (let j = 0; j < 7; j++) { const y = b - 1 - j, hw = 3.5 + j * 0.25; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw); x++) { const rel = (x - (7.5 - hw)) / (2 * hw); P.set(x, y, pot[rel < 0.25 ? 4 : rel < 0.7 ? 3 : 2]); } }
    for (let x = 2; x <= 13; x++) { P.set(x, b - 8, x < 5 ? pot[4] : pot[3]); P.set(x, b - 9, x < 5 ? pot[4] : pot[3]); }
    P.hline(3, 12, b - 7, pot[1]);
    const lights = [];
    if (!v) { // fern
      const fr = [[-7, -6], [-5, -10], [-2, -13], [1, -14], [4, -11], [6, -8], [7, -4]];
      fr.forEach(([dx, dy], k) => {
        const x0 = 7.5, y0 = b - 9;
        for (let t = 0; t <= 1.0001; t += 0.07) {
          const x = x0 + dx * t, y = y0 + dy * t + (dy < -9 ? 0 : 1) * t * t * 4 * (Math.abs(dx) / 7);
          P.set(x, y, LEAF[k % 2 ? 3 : 4]);
          if (t > 0.2 && Math.round(t * 14) % 2 === 0) { P.set(x - 1, y - (dx > 0 ? 0 : 1), LEAF[k % 2 ? 4 : 5]); P.set(x + 1, y - (dx > 0 ? 1 : 0), LEAF[2]); }
        }
      });
      P.set(7, b - 10, LEAF[1]); P.set(8, b - 10, LEAF[2]);
    } else { // glowing violet bloom
      const lv = [[-6, -3], [-4, -6], [5, -5], [6, -2], [-1, -8], [2, -7]];
      lv.forEach(([dx, dy], k) => { for (let t = 0; t <= 1.0001; t += 0.1) { const x = 7.5 + dx * t, y = b - 9 + dy * t + t * t * 2; P.set(x, y, k % 2 ? '#3e3466' : '#2a2448'); P.set(x, y - 1, t > 0.4 ? '#56488a' : '#3e3466'); } });
      for (const [sx, sy, h] of [[5, 0, 10], [9, 0, 13], [11, 0, 8]]) {
        P.vline(sx, b - 9 - h, b - 10, '#3a5a4a');
        P.ell(sx, b - 10 - h, 1.5, 1.5, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.5 ? MAGIC[4] : MAGIC[3]));
        P.set(sx, b - 10 - h, '#ffffff');
      }
      lights.push(L(9, b - 21, 32, [176, 136, 255], 0.55));
    }
    P.outline(OUT); P.shadow(9, b, 6, 1.6);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights });
  });

  def('mulled_pot', 1, () => {
    const W = 16, H = 30, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H);
      P.line(4, b - 7, 2, b - 1, IRON[3]); P.line(11, b - 7, 13, b - 1, IRON[2]); P.line(7, b - 6, 7, b - 2, IRON[2]);
      P.hline(5, 10, b - 4, IRON[3]); P.set(6, b - 5, IRON[4]); P.set(9, b - 5, IRON[2]);
      flame(P, 7, b - 6, f, 'warm', 0); flame(P, 8, b - 6, (f + 2) % 4, 'warm', 0);
      P.ell(7.5, b - 12, 6, 4.6, (x, y, nx, ny) => { const s = -nx * 0.7 - ny * 0.5; P.set(x, y, COPPER[s > 0.55 ? 5 : s > 0.15 ? 4 : s > -0.3 ? 3 : s > -0.7 ? 2 : 1]); });
      P.ell(7.5, b - 16, 6, 1.8, (x, y) => P.set(x, y, COPPER[2]));
      P.hline(2, 13, b - 16, COPPER[4]);
      P.ell(7.5, b - 16.4, 4.8, 1.2, (x, y) => P.set(x, y, WINE[2]));
      const bub = [[5, 0], [9, 1], [7, 2], [10, 3]];
      bub.forEach(([bx], k) => { if ((k + f) % 2 === 0) P.set(bx, b - 17 + ((k + f) % 3 === 0 ? 0 : 1), WINE[5]); });
      P.set(6, b - 16, ORANGE); P.set(7, b - 17, AMBER); P.set(9, b - 16, WOOD[2]); P.set(10, b - 16, WOOD[3]);
      P.line(11, b - 17, 14, b - 21, BRASS[3]); P.set(14, b - 22, BRASS[4]);
      P.set(1, b - 13, COPPER[3]); P.set(14, b - 13, COPPER[2]); P.set(1, b - 12, COPPER[1]); P.set(14, b - 12, COPPER[1]);
      P.outline(OUT);
      // steam wisps (translucent, drift upward)
      for (let k = 0; k < 3; k++) for (let j = 0; j < 6; j++) {
        const y = b - 19 - j - ((f + k * 2) % 4), x = 4 + k * 3 + Math.round(Math.sin((j + f + k * 2) * 0.9) * 1.2);
        if (y > 0 && !P.has(x, y)) P.set(x, y, '#ece4f4', (0.5 - j * 0.07) * 255);
      }
      P.shadow(8, b, 6, 1.5);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, b - 5, 26, [255, 150, 80], 0.5, 1), L(7.5, b - 17, 14, [200, 80, 110], 0.3)] }, draw, 4, 4);
  });

  def('piano', 1, () => {
    const W = 32, H = 43, b = H - 1, R = OAK;
    const base = new Pix(W, H), P0 = base;
    for (const lx of [3, 27]) for (let y = b - 11; y <= b - 1; y++) { P0.set(lx, y, (y % 3 === 0) ? R[5] : R[4]); P0.set(lx + 1, y, R[2]); }
    P0.set(2, b - 1, R[3]); P0.set(5, b - 1, R[2]); P0.set(26, b - 1, R[3]); P0.set(29, b - 1, R[2]);
    // keyboard
    for (let x = 2; x <= 29; x++) {
      P0.set(x, b - 13, [1, 2, 4, 5, 6].includes(x % 7) ? '#1a1418' : '#ece4d4');
      P0.set(x, b - 12, x % 2 ? '#d8d0c0' : '#ece4d4');
      P0.set(x, b - 11, R[2]); P0.set(x, b - 10, R[1]);
    }
    P0.set(1, b - 13, R[4]); P0.set(1, b - 12, R[4]); P0.set(30, b - 13, R[2]); P0.set(30, b - 12, R[2]);
    // case and fretwork panel
    for (let y = b - 30; y <= b - 14; y++) for (let x = 1; x <= 30; x++) {
      let c = R[3];
      if (x <= 2) c = R[5]; else if (x >= 29) c = R[1];
      else if (y === b - 30) c = R[5]; else if (y === b - 29) c = R[4];
      P0.set(x, y, c);
    }
    for (let y = b - 26; y <= b - 16; y++) for (let x = 6; x <= 25; x++) {
      const lx = (x - 6) % 7, ly = y - (b - 26);
      const archHW = ly < 4 ? Math.max(0, Math.sqrt(4 * 9 - Math.pow((4 - ly) * (Math.sqrt(3) * 3 / 4), 2)) - 3) : 3;
      const inArch = Math.abs(lx - 3) <= archHW && lx !== 6;
      P0.set(x, y, inArch ? (ly < 5 ? PLUM[4] : PLUM[3]) : R[2]);
    }
    P0.hline(6, 25, b - 15, R[4]);
    // sheet music
    P0.rect(11, b - 23, 4, 6, PAPER[3]); P0.rect(16, b - 23, 4, 6, PAPER[2]);
    for (const y of [b - 22, b - 20, b - 18]) { P0.hline(11, 14, y, PAPER[1]); P0.hline(16, 19, y, PAPER[1]); }
    P0.set(12, b - 21, OUT); P0.set(18, b - 19, OUT);
    P0.hline(10, 21, b - 16, R[5]);
    const lights = [];
    const draw = (f) => {
      const P = base.clone();
      const c1 = brassStick(P, 4, b - 31, 4, f), c2 = brassStick(P, 26, b - 31, 4, (f + 2) % 4);
      if (f === 0) lights.push(L(c1.x, c1.y - 1, 28, L_CANDLE, 0.5, 1), L(c2.x, c2.y - 1, 28, L_CANDLE, 0.5, 1));
      P.outline(OUT); P.shadow(17, b, 14, 1.8);
      return P;
    };
    const s = build({ ax: 16, ay: b, foot: [2, 1], solid: true }, draw, 4, 6);
    s.lights = lights;
    return s;
  });

  def('herbs', 1, () => {
    const W = 16, H = 48, P = new Pix(W, H), R = OAK;
    for (let x = 0; x <= 15; x++) { P.set(x, 7, R[5]); P.set(x, 8, R[3]); P.set(x, 9, R[1]); }
    for (const px of [3, 8, 13]) { P.set(px, 10, R[5]); P.set(px, 11, R[3]); }
    // sage / rosemary bundle
    P.vline(3, 12, 13, '#c8a070');
    for (let j = 0; j < 11; j++) { const hw = Math.min(2.6, 0.6 + j * 0.3); for (let x = Math.round(3 - hw); x <= Math.round(3 + hw); x++) P.set(x, 14 + j, j > 8 && hash(x, j, 3) < 0.5 ? OCHRE[3] : (x + j) % 3 === 0 ? LEAF[4] : x < 3 ? LEAF[3] : LEAF[2]); }
    P.set(3, 14, '#c8a070'); P.set(2, 14, '#a88050');
    // lavender
    for (const sx of [7, 8, 9]) P.vline(sx, 12, 20 + (sx % 2), LEAF[3]);
    P.hline(7, 9, 13, '#c8a070');
    for (let j = 0; j < 5; j++) for (const sx of [7, 8, 9]) if ((j + sx) % 2 === 0 || j > 1) P.set(sx + (j > 2 ? (sx - 8) : 0), 19 + j, j % 2 ? MAGIC[2] : MAGIC[3]);
    // garlic braid
    P.vline(13, 12, 26, OCHRE[2]);
    for (const [gy, side] of [[14, -1], [18, 1], [22, -1], [26, 1]]) {
      const gx = 13 + side;
      P.ell(gx, gy, 1.6, 1.6, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.4 ? '#f2ece6' : nx + ny < 0.6 ? '#ded2d0' : '#b8a0b8'));
      P.set(gx, gy + 2, '#8a7068');
    }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: H - 1, foot: [1, 1], solid: true, wall: true });
  });

  // ------------------------------------------------------------------ Quillon's Threads & Tomes (boutique)
  const BW = ['#1e1214', '#2e1c1a', '#40281f', '#553626', '#6c4630', '#86593c', '#a0704a']; // old shop wood
  const RUST = ['#5a2a1c', '#8a4a2e', '#b06a3e'];
  // shade a garment column: left lit, right in shadow, with a fold every few px
  function cloth(R, rel, fold) { return R[rel < 0.2 ? 4 : rel > 0.8 ? 1 : fold ? 2 : 3]; }

  def('bookshelf', 3, (v) => {
    const W = 32, H = 57, b = H - 1, seed = 300 + v * 17, R = BW;
    const P = new Pix(W, H), lights = [];
    // cornice and top
    for (let x = 1; x <= 30; x++) { P.set(x, 1, R[6]); P.set(x, 2, R[5]); P.set(x, 3, x % 3 === 0 ? R[2] : R[4]); P.set(x, 4, R[1]); }
    for (let x = 6; x <= 25; x++) P.set(x, 0, x % 2 ? R[5] : R[4]);
    for (let y = 5; y <= b - 2; y++) { P.set(1, y, R[5]); P.set(2, y, R[4]); P.set(29, y, R[2]); P.set(30, y, R[1]); }
    for (let y = 5; y <= b - 6; y++) for (let x = 3; x <= 28; x++) P.set(x, y, x % 6 === 0 ? R[0] : R[1]);
    const shelfTops = [13, 22, 31, 40, 49];
    for (const st of shelfTops) { for (let x = 3; x <= 28; x++) { P.set(x, st, R[5]); P.set(x, st + 1, R[3]); } }
    for (let y = b - 5; y <= b - 1; y++) for (let x = 1; x <= 30; x++) P.set(x, y, y === b - 5 ? R[5] : y === b - 1 ? R[1] : x % 7 === 3 ? R[2] : R[3]);
    // books
    const glowSlots = v === 1 ? [[0, 3], [2, 5], [3, 1]] : [];
    const glowRamps = [['#2a1a5a', '#6a47a8', '#b99aee', '#ffffff'], ['#0e4a34', '#1f8a5a', '#5dffb0', '#ecfff6'], ['#5a3a10', '#b07a20', '#ffe08a', '#fff6c8']];
    const glowRGB = [[176, 136, 255], [93, 255, 176], [255, 210, 110]];
    for (let s = 0; s < 5; s++) {
      const by = shelfTops[s] - 1, maxH = s === 0 ? 8 : 7;
      let x = 3, k = 0;
      while (x <= 27) {
        const h = hash(s, k, seed), r2 = hash(s, k, seed + 1);
        if (r2 < 0.07 && x < 24) { // a stack lying flat
          const n = 2 + Math.floor(hash(s, k, seed + 2) * 2);
          for (let j = 0; j < n; j++) { const Rb = BOOK_R[Math.floor(hash(s, k + j, seed + 3) * BOOK_R.length)], wd = 5 - (j % 2); for (let i = 0; i < wd; i++) { P.set(x + i, by - j * 2, Rb[2]); P.set(x + i, by - j * 2 - 1, i === 0 ? Rb[4] : Rb[3]); } P.set(x + wd - 1, by - j * 2, PAPER[2]); }
          x += 6; k += n; continue;
        }
        if (r2 > 0.95) { x += 2; k++; continue; } // a gap
        const wd = h < 0.25 ? 1 : h < 0.8 ? 2 : 3, ht = Math.min(maxH, 4 + Math.floor(hash(s, k, seed + 4) * 4));
        let Rb = BOOK_R[Math.floor(hash(s, k, seed + 5) * BOOK_R.length)];
        const gi = glowSlots.findIndex(([gs, gk]) => gs === s && gk === k);
        if (gi >= 0) Rb = [glowRamps[gi][0], glowRamps[gi][1], glowRamps[gi][1], glowRamps[gi][2], glowRamps[gi][2]];
        if (x + wd > 28) break;
        spine(P, x, by, wd, ht, Rb, hash(s, k, seed + 6) < 0.45 ? (gi >= 0 ? glowRamps[gi][3] : GOLD[3]) : null);
        if (gi >= 0) { P.set(x, by - Math.floor(ht / 2), glowRamps[gi][3]); lights.push(L(x + 0.5, by - ht / 2, 18, glowRGB[gi], 0.5)); }
        if (hash(s, k, seed + 7) < 0.1 && x + wd + 2 <= 27 && ht > 4) { // a leaning book
          const Rl = BOOK_R[Math.floor(hash(s, k, seed + 8) * BOOK_R.length)];
          for (let j = 0; j < ht - 1; j++) { P.set(x + wd + 1 + Math.floor(j / 3), by - j, Rl[3]); P.set(x + wd + 2 + Math.floor(j / 3), by - j, Rl[2]); }
          x += 4; k++;
        }
        x += wd; k++;
      }
    }
    if (v === 2) { // rolling iron library ladder hooked over the cornice
      for (let y = 2; y <= b; y++) {
        const lean = Math.floor((y - 2) / 26);
        for (const rx of [8, 16]) { const x = rx + lean; P.set(x, y, '#7a6e8a'); P.set(x + 1, y, IRON[3]); if (hash(x, y, 9) < 0.14) P.set(x + (hash(x, y, 8) < 0.5 ? 0 : 1), y, RUST[1 + (y % 2)]); }
        if ((y - 4) % 5 === 0 && y < b - 2) { for (let x = 10 + lean; x <= 15 + lean; x++) P.set(x, y, hash(x, y, 4) < 0.18 ? RUST[2] : '#6a5e7a'); for (let x = 10 + lean; x <= 15 + lean; x++) P.set(x, y + 1, IRON[1]); }
      }
      P.set(8, 1, IRON[4]); P.set(9, 1, IRON[3]); P.set(16, 1, IRON[4]); P.set(17, 1, IRON[3]); P.set(9, 0, IRON[3]); P.set(17, 0, IRON[3]);
      for (const wx of [9, 17]) { P.set(wx, b, IRON[1]); P.set(wx + 1, b, IRON[2]); P.set(wx + 1, b - 1, IRON[4]); }
    }
    P.outline(OUT);
    P.shadow(18, b, 15, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true, lights, againstWall: true });
  });

  const GARMENTS = [
    // [ramp, kind, trim]
    [[MIDNIGHT, 'cloak', SILVER[5]], [PLUM, 'robe', GOLD[4]], [FOREST, 'cloak', LEAF[5]], [CHAR, 'robe', MAGIC[2]], [CRIMSON, 'cape', GOLD[4]], [MIDNIGHT, 'robe', GOLD[3]]],
    [[WINE, 'doublet', GOLD[4]], [OCHRE, 'coat', BRASS[4]], [TEALC, 'coat', GOLD[3]], [CHAR, 'waist', CRIMSON[4]], [LAV, 'robe', '#ffffff'], [PLUM, 'coat', GOLD[4]]],
  ];
  def('rack', 2, (v) => {
    const W = 32, H = 36, b = H - 1, P = new Pix(W, H);
    // stand
    for (const px of [3, 28]) { P.vline(px, 4, b - 2, IRON[3]); P.set(px, 3, BRASS[5]); P.set(px, 2, BRASS[3]); }
    for (let x = 1; x <= 6; x++) P.set(x, b - 1, x < 3 ? IRON[4] : IRON[2]);
    for (let x = 25; x <= 30; x++) P.set(x, b - 1, x < 27 ? IRON[4] : IRON[2]);
    P.set(1, b, IRON[1]); P.set(6, b, IRON[1]); P.set(25, b, IRON[1]); P.set(30, b, IRON[1]);
    P.hline(3, 28, 4, BRASS[4]); P.hline(3, 28, 5, BRASS[2]); P.set(10, 4, BRASS[5]); P.set(20, 4, BRASS[5]);
    const set = GARMENTS[v];
    set.forEach(([R, kind, trim], k) => {
      const x0 = 4 + k * 4, wd = 6, len = kind === 'doublet' || kind === 'waist' ? 12 : kind === 'coat' ? 17 : kind === 'cape' ? 15 : 21;
      P.set(x0 + 3, 5, IRON[4]); P.set(x0 + 3, 6, IRON[3]); P.hline(x0 + 1, x0 + 5, 7, IRON[2]);
      for (let j = 0; j < len; j++) {
        const y = 8 + j, flare = kind === 'cloak' || kind === 'cape' ? Math.floor(j / 8) : 0;
        const xa = x0 + (j === 0 ? 1 : 0) - flare, xb = x0 + wd - 1 - (j === 0 ? 1 : 0) + (kind === 'cloak' ? flare : 0);
        for (let x = xa; x <= xb; x++) {
          const rel = (x - xa) / Math.max(1, xb - xa);
          let c = cloth(R, rel, (x - x0 + Math.floor(j / 5)) % 4 === 0);
          if (j === len - 1 && kind !== 'waist') c = trim;
          if ((kind === 'robe' || kind === 'coat') && x === x0 + 3 && j > 1) c = trim;
          if (kind === 'coat' && x === x0 + 4 && j % 4 === 2) c = BRASS[4];
          if (kind === 'doublet' && (x === x0 + 1 || x === x0 + 4) && j % 3 === 1) c = GOLD[4];
          if (kind === 'waist' && j === 6) c = trim;
          if (R === MIDNIGHT && kind === 'cloak' && hash(x, y, 5) < 0.12) c = '#ffffff';
          if (R === LAV && hash(x, y, 6) < 0.1) c = '#ffffff';
          P.set(x, y, c);
        }
        if (kind === 'cloak' && j < 3) P.set(x0 + 2, y, R[1]);
      }
      if (kind === 'cloak' || kind === 'cape') { P.set(x0 + 2, 8, trim); P.set(x0 + 3, 8, trim); }
      if (kind === 'waist') { for (let j = 0; j < 4; j++) P.set(x0 + 2, 8 + j, '#e8e0d8'); }
      if (R === FOREST && kind === 'cloak') for (let x = x0 - 2; x <= x0 + wd + 1; x += 2) P.set(x, 8 + len, LEAF[4]);
    });
    P.outline(OUT); P.shadow(17, b, 14, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('dress_form', 4, (v) => {
    const W = 16, H = 34, b = H - 1, P = new Pix(W, H), LIN = ['#6a5a50', '#8e7c6c', '#b4a08c', '#d2bea6'];
    // tripod and pole
    P.line(7, b - 4, 3, b - 1, WALNUT[4]); P.line(8, b - 4, 12, b - 1, WALNUT[2]); P.vline(7, b - 3, b - 1, WALNUT[3]);
    P.vline(7, 18, b - 4, WALNUT[4]); P.vline(8, 18, b - 4, WALNUT[2]);
    // linen torso form
    P.set(7, 2, BRASS[5]); P.set(8, 2, BRASS[3]); P.set(7, 3, BRASS[3]); P.set(8, 3, BRASS[2]);
    P.set(7, 4, LIN[3]); P.set(8, 4, LIN[1]); P.set(7, 5, LIN[3]); P.set(8, 5, LIN[1]);
    const torso = (y) => (y === 6 ? 4 : y < 12 ? 5 - (y > 9 ? 1 : 0) : y < 15 ? 3.5 : 4.5);
    for (let y = 6; y <= 18; y++) { const hw = torso(y); for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) { const rel = (x - (7.5 - hw)) / (2 * hw); P.set(x, y, LIN[rel < 0.25 ? 3 : rel < 0.75 ? 2 : 1]); } }
    if (v === 0) { // plum gown
      for (let y = 6; y <= 13; y++) { const hw = torso(y); for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) P.set(x, y, cloth(PLUM, (x - (7.5 - hw)) / (2 * hw), false)); }
      P.hline(3, 11, 6, GOLD[4]); P.hline(4, 11, 13, GOLD[3]); P.set(7, 7, GOLD[5]); P.set(8, 8, GOLD[3]);
      for (let y = 14; y <= b - 3; y++) { const hw = 4 + (y - 14) * 0.28; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) { const rel = (x - (7.5 - hw)) / (2 * hw); P.set(x, y, y === b - 3 ? GOLD[3] : cloth(PLUM, rel, (x + 1) % 3 === 0 && y > 16)); } }
    } else if (v === 1) { // midnight star cloak
      for (let y = 4; y <= b - 3; y++) { const hw = y < 6 ? 3 : y < 8 ? 5.5 : 5.5 + (y - 8) * 0.12; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) { const rel = (x - (7.5 - hw)) / (2 * hw); let c = cloth(MIDNIGHT, rel, (x + Math.floor(y / 6)) % 4 === 0 && y > 9); if (hash(x, y, 77) < 0.09 && y > 7) c = '#ffffff'; if (y === b - 3) c = SILVER[4]; P.set(x, y, c); } }
      P.hline(5, 10, 5, MIDNIGHT[1]); P.set(7, 7, SILVER[6]); P.set(8, 7, SILVER[4]); P.set(7, 8, SILVER[3]);
      for (let y = 8; y <= b - 4; y++) P.set(7, y, MIDNIGHT[1]);
    } else if (v === 2) { // scholar's robes with a striped scarf
      for (let y = 6; y <= b - 3; y++) { const hw = y < 8 ? 5 : 5 + (y - 8) * 0.06; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) { const rel = (x - (7.5 - hw)) / (2 * hw); let c = cloth(CHAR, rel, (x + 2) % 4 === 0 && y > 12); if (x === 7) c = MAGIC[1]; if (x === 8) c = SILVER[3]; if (y === b - 3) c = MAGIC[1]; P.set(x, y, c); } }
      for (let y = 5; y <= 20; y++) { P.set(9, y, Math.floor(y / 2) % 2 ? MAGIC[2] : SILVER[4]); P.set(10, y, Math.floor(y / 2) % 2 ? MAGIC[1] : SILVER[3]); }
      P.hline(5, 10, 5, MAGIC[2]); P.set(9, 21, SILVER[5]); P.set(10, 21, MAGIC[2]);
    } else { // wine-red bard doublet with slashed sleeves
      for (let y = 6; y <= 17; y++) { const hw = torso(y); for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) { const rel = (x - (7.5 - hw)) / (2 * hw); let c = cloth(WINE, rel, false); if (x === 7) c = GOLD[4]; if (x === 8 && y % 2 === 0) c = GOLD[3]; if (y === 17) c = GOLD[3]; P.set(x, y, c); } }
      for (const sx of [2, 12]) for (let y = 6; y <= 9; y++) { P.set(sx, y, y % 2 ? GOLD[4] : WINE[4]); P.set(sx + 1, y, y % 2 ? WINE[3] : GOLD[3]); }
      P.hline(4, 11, 6, '#e8e0d8');
    }
    P.outline(OUT); P.shadow(9, b, 5.5, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('hat_stand', 1, () => {
    const W = 18, H = 44, b = H - 1, P = new Pix(W, H), R = WALNUT;
    P.ell(8.5, b - 2, 4.5, 1.6, (x, y, nx) => P.set(x, y, nx < -0.3 ? R[5] : R[3]));
    P.hline(5, 12, b - 1, R[1]);
    for (let y = 12; y <= b - 3; y++) { P.set(8, y, (y % 7 === 0) ? R[6] : R[4]); P.set(9, y, (y % 7 === 0) ? R[4] : R[2]); }
    // brass hooks
    P.set(7, 15, BRASS[4]); P.set(6, 14, BRASS[4]); P.set(5, 13, BRASS[3]); P.set(10, 15, BRASS[3]); P.set(11, 14, BRASS[3]); P.set(12, 13, BRASS[2]);
    // witch hat on the top
    const HAT = ['#1b1022', '#2e1838', '#45264f', '#5e3a6a'];
    for (let x = 1; x <= 16; x++) { const yy = 11 + (x < 4 || x > 13 ? 1 : 0); P.set(x, yy, x < 6 ? HAT[3] : HAT[2]); P.set(x, yy - 1 + (x < 4 || x > 13 ? 1 : 0), x < 6 ? HAT[2] : HAT[1]); }
    for (let j = 0; j < 9; j++) { const y = 9 - j, hw = Math.max(0, 3 - Math.floor(j / 3)), sh = j > 5 ? j - 5 : 0; for (let x = 8 - hw + sh; x <= 9 + hw + sh; x++) P.set(x, y, x <= 8 + sh - hw + 1 ? HAT[3] : HAT[1]); }
    P.set(13, 0, HAT[2]); P.set(14, 1, HAT[1]);
    P.hline(5, 12, 9, MAGIC[1]); P.set(5, 9, MAGIC[2]); P.set(8, 9, SILVER[5]); P.set(9, 9, SILVER[3]);
    // top hat on the left hook
    for (let y = 15; y <= 19; y++) for (let x = 2; x <= 5; x++) P.set(x, y, x === 2 ? CHAR[4] : x === 5 ? CHAR[1] : CHAR[2]);
    P.hline(1, 6, 20, CHAR[3]); P.set(1, 20, CHAR[4]); P.hline(2, 5, 18, SILVER[4]); P.set(3, 18, SILVER[6]); P.hline(2, 5, 15, CHAR[4]);
    // velvet beret on the right hook
    P.ell(13.5, 15.5, 3.4, 1.6, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.4 ? PLUM[5] : nx + ny < 0.5 ? PLUM[4] : PLUM[3]));
    P.set(13, 13, PLUM[4]); P.set(15, 15, GOLD[5]); P.set(12, 17, PLUM[2]); P.set(13, 17, PLUM[2]);
    P.outline(OUT); P.shadow(10, b, 5, 1.4);
    return sprite({ c: P.canvas(), ax: 9, ay: b, foot: [1, 1], solid: true });
  });

  def('mirror', 1, () => {
    const W = 16, H = 35, b = H - 1, P = new Pix(W, H), G = GOLD;
    for (const [px, lit] of [[1, true], [14, false]]) { for (let y = 8; y <= b - 2; y++) P.set(px, y, lit ? (y % 6 === 0 ? G[5] : G[4]) : (y % 6 === 0 ? G[3] : G[2])); P.set(px, 7, G[5]); P.set(px, 6, lit ? G[6] : G[4]); }
    P.hline(0, 3, b - 1, G[3]); P.set(0, b - 1, G[4]); P.hline(12, 15, b - 1, G[2]);
    // frame with an arched head
    const inF = (x, y) => x >= 3 && x <= 12 && y >= 4 && y <= 28 && (y >= 8 || Math.hypot(x - 7.5, y - 8.5) <= 4.9);
    const inG = (x, y) => x >= 4 && x <= 11 && y >= 6 && y <= 27 && (y >= 9 || Math.hypot(x - 7.5, y - 9) <= 3.6);
    for (let y = 2; y <= 29; y++) for (let x = 2; x <= 13; x++) {
      if (inG(x, y)) {
        const t = (y - 6) / 21; let c = rampAt(['#525a7e', '#64709a', '#7884ae', '#8e9cc0'], 0.9 - t * 0.75, x, y);
        const d = (x - 4) - (y - 6) * 0.5; if (Math.abs(d - 1) < 0.6 || Math.abs(d + 3) < 0.5) c = '#d8e2f6';
        if (y > 23) c = mix(c, '#3a3450', 0.45);
        P.set(x, y, c);
      } else if (inF(x, y)) P.set(x, y, (x < 7 || y < 8) ? G[4] : G[3]);
    }
    P.set(9, 25, AMBER); P.set(10, 25, ORANGE);
    // crest: scrollwork and a crescent
    P.set(6, 2, G[4]); P.set(9, 2, G[3]); P.set(7, 1, G[5]); P.set(8, 1, G[4]); P.set(7, 0, G[6]); P.set(5, 3, G[3]); P.set(10, 3, G[2]);
    P.set(2, 17, G[6]); P.set(13, 17, G[4]);
    P.outline(OUT); P.shadow(9, b, 6, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('till', 1, () => {
    const W = 32, H = 36, b = H - 1, P = new Pix(W, H), R = HONEY;
    const yTop = b - 22, yLip = b - 15;
    for (let x = 1; x <= 30; x++) {
      for (let y = yTop; y < yLip; y++) P.set(x, y, y === yTop ? R[3] : (y - yTop) % 3 === 1 ? R[5] : R[4]);
      P.set(x, yLip, R[6]); P.set(x, yLip + 1, R[2]); P.set(x, yLip + 2, R[0]);
      for (let y = yLip + 3; y <= b - 1; y++) {
        const lx = (x - 1) % 15, ly = y - (yLip + 3), ph = b - 4 - (yLip + 3);
        let c = R[3];
        if (lx >= 2 && lx <= 12 && ly >= 1 && ly <= ph) c = ly === 1 ? R[1] : lx === 2 ? R[2] : lx === 12 ? R[4] : ly === ph ? R[4] : R[3];
        if (y >= b - 2) c = y === b - 2 ? R[4] : R[1];
        P.set(x, y, c);
      }
    }
    P.d[yTop * W + 1] = 0; P.d[yTop * W + 30] = 0; // rounded corners
    // brass cash register: curved marquee with number tabs, panelled body, slanted keys, drawer, crank
    const RB = BRASS, rx0 = 3, rx1 = 14;
    for (let y = yTop - 7; y <= yTop + 2; y++) for (let x = rx0; x <= rx1; x++) {
      let c = x === rx0 ? RB[4] : x === rx1 ? RB[1] : RB[3];
      if (y === yTop - 7) c = RB[5];
      if (y >= yTop - 5 && y <= yTop - 3 && x > rx0 + 1 && x < rx1 - 1) c = (x + y) % 2 ? RB[2] : RB[3];
      if (y === yTop - 2) c = RB[1];
      if (y >= yTop - 1 && y <= yTop) c = x % 2 ? PAPER[3] : '#2a1e16';
      if (y === yTop + 1) c = RB[2]; if (y === yTop + 2) c = RB[1];
      P.set(x, y, c);
    }
    for (let x = rx0 + 2; x <= rx1 - 2; x++) { const pk = Math.round(2.6 - Math.abs(x - 8.5) * 0.45); for (let y = yTop - 8 - pk; y <= yTop - 8; y++) P.set(x, y, y === yTop - 8 - pk ? RB[5] : RB[3]); }
    P.set(8, yTop - 12, GOLD[5]); P.set(9, yTop - 12, GOLD[4]);
    for (const tx2 of [6, 8, 10]) { P.set(tx2, yTop - 9, PAPER[4]); P.set(tx2 + 1, yTop - 9, PAPER[2]); }
    P.set(8, yTop + 1, RB[5]); P.set(9, yTop + 1, RB[4]);
    P.vline(15, yTop - 5, yTop - 2, RB[2]); P.set(16, yTop - 6, RB[4]); P.set(16, yTop - 7, PAPER[3]);
    // tape measure
    P.ell(19.5, yTop + 4, 2.2, 1.6, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.3 ? '#f2d070' : '#c89a38'));
    P.set(19, yTop + 4, '#6a4a20');
    for (let i = 0; i < 6; i++) { const x = 22 + Math.floor(i / 2), y = yTop + 4 + i; P.set(x, y, '#e8c860'); if (i % 2) P.set(x, y, '#c8a040'); }
    // tomato pincushion with pins
    P.ell(26, yTop + 3, 2.6, 2, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.4 ? CRIMSON[5] : nx + ny < 0.5 ? CRIMSON[4] : CRIMSON[3]));
    P.set(26, yTop + 1, LEAF[4]); P.set(25, yTop + 1, LEAF[3]); P.set(27, yTop + 1, LEAF[3]);
    P.set(24, yTop, SILVER[5]); P.set(28, yTop + 1, GOLD[5]); P.set(27, yTop, SILVER[4]); P.set(25, yTop + 2, OUT);
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  function flatBook(P, x, y, wd, th, Rb, pages) { // a book lying flat; y = its bottom row
    for (let i = 0; i < wd; i++) { P.set(x + i, y - th + 1, i === 0 ? Rb[4] : Rb[3]); for (let j = 1; j < th; j++) P.set(x + i, y - th + 1 + j, pages && i > 0 && i < wd - 1 ? (j % 2 ? PAPER[3] : PAPER[2]) : Rb[2]); }
    P.set(x + wd - 1, y, Rb[1]);
  }
  def('book_pile', 3, (v) => {
    const W = 16, H = 25, b = H - 1, P = new Pix(W, H), seed = 410 + v * 9;
    const stack = (x0, n, maxW, s2) => {
      let y = b - 1;
      for (let k = 0; k < n; k++) {
        const wd = maxW - Math.floor(hash(k, 1, s2) * 3), th = 2 + (hash(k, 2, s2) < 0.5 ? 1 : 0), dx = Math.floor(hash(k, 3, s2) * 3) - 1;
        flatBook(P, x0 + dx + Math.floor((maxW - wd) / 2), y, wd, th, BOOK_R[Math.floor(hash(k, 4, s2) * BOOK_R.length)], hash(k, 5, s2) < 0.5);
        y -= th;
      }
      return y;
    };
    if (v === 0) stack(2, 7, 12, seed);
    else if (v === 1) {
      stack(1, 5, 9, seed); stack(8, 3, 8, seed + 1);
      const Rl = BOOK_R[2]; for (let j = 0; j < 9; j++) { P.set(14 - Math.floor(j / 3), b - 1 - j, Rl[3]); P.set(15 - Math.floor(j / 3), b - 1 - j, Rl[1]); }
    } else {
      const top = stack(2, 3, 12, seed);
      // an open book, pages fanned, with an inkpot and a crow quill
      for (let i = 0; i < 12; i++) { const x = 2 + i, mid = i === 5 || i === 6; P.set(x, top, mid ? PAPER[1] : PAPER[4]); P.set(x, top + 1, mid ? PAPER[1] : PAPER[3]); P.set(x, top - 1, i === 0 || i === 11 ? null : (mid ? PAPER[2] : PAPER[4])); }
      for (const tx of [3, 8]) { P.hline(tx, tx + 2, top, PAPER[1]); }
      P.hline(2, 13, top + 2, WINE[2]);
      P.rect(12, top - 3, 3, 3, '#1a1622'); P.set(12, top - 3, '#3a3448'); P.set(13, top - 4, '#2a2436');
      P.line(13, top - 5, 15, top - 11, '#2e2442'); P.set(14, top - 9, '#46395c'); P.set(15, top - 12, '#8a6ad0');
    }
    P.outline(OUT); P.shadow(9, b, 7, 1.6);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  function armchairPix(dir) {
    const W = 16, H = 25, b = H - 1, P = new Pix(W, H), V = PLUM, R = WALNUT;
    const worn = (x, y) => hash(x, y, 81) < 0.18;
    if (dir === 0) {
      for (let y = b - 22; y <= b - 9; y++) for (let x = 3; x <= 12; x++) { if (y === b - 22 && (x < 5 || x > 10)) continue; if (y === b - 21 && (x < 4 || x > 11)) continue; P.set(x, y, x === 3 || y <= b - 21 ? V[4] : x === 12 ? V[2] : ((x + y) % 5 === 0 ? V[2] : V[3])); }
      for (let y = b - 19; y <= b - 11; y += 4) for (let x = 5; x <= 10; x += 2) P.set(x + (y % 2), y, V[1]); // tufting
      for (const [x0, lit] of [[1, true], [12, false]]) for (let y = b - 19; y <= b - 4; y++) for (let x = x0; x <= x0 + 2; x++) { let c = lit ? (x === x0 ? V[5] : V[4]) : (x === x0 + 2 ? V[1] : V[2]); if (y < b - 12) c = lit ? V[4] : V[2]; P.set(x, y, c); }
      for (const x0 of [1, 12]) { P.set(x0 + 1, b - 12, x0 === 1 ? V[5] : V[3]); for (let y = b - 10; y <= b - 5; y += 2) P.set(x0 + 1, y, GOLD[3]); }
      for (let y = b - 10; y <= b - 8; y++) for (let x = 4; x <= 11; x++) P.set(x, y, y === b - 10 ? V[5] : worn(x, y) ? V[5] : V[4]);
      for (let y = b - 7; y <= b - 3; y++) for (let x = 4; x <= 11; x++) P.set(x, y, y === b - 7 ? V[4] : y === b - 3 ? V[1] : V[2 + ((x + 1) % 3 === 0 ? 1 : 0)]);
      P.set(7, b - 9, '#e8dcc8');
      for (const lx of [2, 13]) { P.set(lx, b - 2, R[4]); P.set(lx, b - 1, R[2]); }
    } else {
      // facing left: wing-back rising on the right, rolled arm along the side, short legs
      const back = (k) => k > 21 ? [11, 13] : k > 19 ? [8, 13] : k > 15 ? [7, 13] : k > 13 ? [9, 13] : [10, 13];
      for (let k = 22; k >= 4; k--) { const [xa, xb] = back(k), y = b - k; for (let x = xa; x <= xb; x++) P.set(x, y, x === xa ? V[5] : x === xb ? V[1] : (x + k) % 5 === 0 ? V[2] : V[3]); }
      for (let x = 1; x <= 10; x++) { P.set(x, b - 13, x < 4 ? V[5] : V[4]); P.set(x, b - 12, V[3]); }
      P.ell(1.5, b - 12, 1.5, 1.5, (x, y, nx, ny) => P.set(x, y, nx + ny < 0 ? V[5] : V[2])); P.set(1, b - 12, V[1]);
      for (let y = b - 11; y <= b - 4; y++) for (let x = 2; x <= 10; x++) P.set(x, y, y === b - 4 ? V[1] : x === 2 ? V[4] : (x + y) % 6 === 0 ? V[2] : worn(x, y) ? V[4] : V[3]);
      for (let x = 3; x <= 9; x += 2) P.set(x, b - 5, GOLD[3]);
      P.set(2, b - 3, R[4]); P.set(2, b - 2, R[3]); P.set(2, b - 1, R[2]); P.set(12, b - 3, R[3]); P.set(12, b - 2, R[2]); P.set(12, b - 1, R[1]);
    }
    P.outline(OUT); P.shadow(9, b, 6.5, 1.6);
    return P;
  }
  def('armchair', 3, (v) => {
    const P = v === 0 ? armchairPix(0) : v === 1 ? armchairPix(1) : armchairPix(1).flipX();
    return sprite({ c: P.canvas(), ax: 8, ay: P.h - 1, foot: [1, 1], solid: true });
  });

  def('lamp_table', 1, () => {
    const W = 16, H = 31, b = H - 1, P = new Pix(W, H), R = WALNUT;
    for (const [x0, x1, c] of [[3, 2, R[4]], [12, 13, R[2]], [8, 8, R[3]]]) P.line(x0, b - 11, x1, b - 1, c);
    P.ell(7.5, b - 5, 4.5, 1.3, (x, y) => P.set(x, y, R[3]));
    ellTop(P, 7.5, b - 12, 6.6, 2.6, R, 1);
    // little teacup
    P.set(12, b - 13, PAPER[4]); P.set(13, b - 13, PAPER[3]); P.set(12, b - 12, PAPER[3]); P.set(13, b - 12, PAPER[2]); P.set(14, b - 13, PAPER[2]);
    // brass base and stem
    P.hline(5, 9, b - 13, BRASS[3]); P.set(5, b - 13, BRASS[5]); P.hline(6, 8, b - 14, BRASS[4]); P.set(7, b - 15, BRASS[4]); P.set(7, b - 16, BRASS[3]); P.set(8, b - 15, BRASS[2]);
    // orange stained-glass shade, lit from inside
    const SH = ['#5a2410', '#a4441c', '#d8702c', '#f4a048', '#ffd08a'];
    for (let j = 0; j < 7; j++) {
      const y = b - 23 + j, hw = 1.5 + j * 0.85;
      for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) {
        const rel = (x - (7.5 - hw)) / (2 * hw), seg = Math.floor(rel * 5);
        let c = SH[clamp(1 + (seg % 2) + (j > 3 ? 1 : 0) + (rel < 0.3 ? 1 : 0), 0, 4)];
        if (Math.abs(rel * 5 - Math.round(rel * 5)) < 0.12 && j > 0) c = '#2a140c';
        if (j === 3) c = '#2a140c';
        P.set(x, y, c);
      }
    }
    P.hline(1, 14, b - 17, BRASS[3]); P.set(1, b - 17, BRASS[4]); P.set(14, b - 17, BRASS[2]);
    P.set(7, b - 16, CANDLE); P.set(8, b - 16, '#ffe0a0'); P.set(6, b - 16, '#ffbc62');
    P.set(7, b - 24, BRASS[4]); P.set(8, b - 24, BRASS[2]); P.set(7, b - 25, BRASS[5]);
    P.outline(OUT); P.shadow(9, b, 6, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, b - 19, 72, L_LAMP, 0.95, 1), L(7.5, b - 16, 22, [255, 220, 160], 0.4)] });
  });

  def('display_table', 1, () => {
    const W = 32, H = 28, b = H - 1, P = new Pix(W, H), R = WALNUT;
    for (const [x, y0] of [[2, b - 7], [29, b - 7], [4, b - 7], [27, b - 7]]) P.vline(x, y0, x === 4 || x === 27 ? b - 3 : b - 1, x < 16 ? R[4] : R[2]);
    for (let x = 1; x <= 30; x++) { for (let y = b - 13; y <= b - 11; y++) P.set(x, y, y === b - 13 ? R[4] : R[5]); P.set(x, b - 10, R[6]); P.set(x, b - 9, R[3]); P.set(x, b - 8, R[2]); }
    P.set(10, b - 9, BRASS[4]); P.set(21, b - 9, BRASS[4]);
    // draped cloth runner with gold fringe
    for (let x = 11; x <= 20; x++) { const drop = 3 - Math.round(Math.abs(x - 15.5) / 2.2); for (let y = b - 13; y <= b - 10 + drop; y++) P.set(x, y, y === b - 13 ? PLUM[5] : (x + y) % 4 === 0 ? PLUM[2] : PLUM[3]); P.set(x, b - 9 + drop, x % 2 ? GOLD[4] : GOLD[3]); }
    // folded scarves
    const sc = [[OCHRE, PLUM], [FOREST, GOLD], [MIDNIGHT, SILVER]];
    sc.forEach(([A, B2], k) => { const y = b - 12 - k * 2; for (let x = 3; x <= 10; x++) { P.set(x, y - 1, x === 3 ? A[4] : A[3]); P.set(x, y, (x % 3 === 0) ? B2[3] : A[2]); } });
    // gloves
    for (const [gx, gy] of [[12, b - 15], [15, b - 14]]) { P.hline(gx, gx + 2, gy, VIOLET[5]); P.hline(gx, gx + 2, gy + 1, VIOLET[4]); P.set(gx + 3, gy, VIOLET[4]); P.set(gx + 3, gy - 1, VIOLET[5]); P.set(gx + 4, gy, VIOLET[3]); P.set(gx - 1, gy + 1, VIOLET[3]); }
    // tall boots
    for (const bx of [22, 26]) { // a pair of tall buckled boots
      for (let y = b - 22; y <= b - 14; y++) { P.set(bx, y, y < b - 20 ? CHAR[5] : CHAR[4]); P.set(bx + 1, y, CHAR[3]); P.set(bx + 2, y, CHAR[1]); }
      P.hline(bx - 2, bx + 2, b - 13, CHAR[2]); P.set(bx - 2, b - 14, CHAR[3]); P.set(bx - 1, b - 14, CHAR[4]); P.set(bx - 2, b - 13, CHAR[3]);
      P.set(bx + 2, b - 13, '#0a0810'); P.hline(bx, bx + 2, b - 22, '#6a5e7a'); P.set(bx + 1, b - 18, BRASS[4]); P.set(bx + 2, b - 18, BRASS[2]);
    }
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('trunk', 1, () => {
    const W = 32, H = 30, b = H - 1, P = new Pix(W, H), LE = TEALC, R = HONEY;
    // open lid, its striped lining facing us
    for (let y = b - 28; y <= b - 15; y++) for (let x = 3; x <= 28; x++) {
      let c = (x === 3 || x === 28 || y === b - 28) ? R[2] : ((x >> 1) % 2 ? PLUM[3] : '#c8b4b0');
      if (y === b - 15) c = R[1];
      if (x >= 10 && x <= 21 && y >= b - 22 && y <= b - 17) c = (y === b - 22 || x === 10 || x === 21) ? PLUM[1] : PLUM[2];
      P.set(x, y, c);
    }
    for (const [cx, cy] of [[3, b - 28], [28, b - 28]]) { P.set(cx, cy, BRASS[4]); P.set(cx + (cx < 10 ? 1 : -1), cy, BRASS[3]); P.set(cx, cy + 1, BRASS[3]); }
    // body
    for (let y = b - 13; y <= b - 1; y++) for (let x = 2; x <= 29; x++) {
      let c = x === 2 ? LE[4] : x === 29 ? LE[1] : (x + y) % 7 === 0 ? LE[2] : LE[3];
      if (y === b - 13 || y === b - 7 || y === b - 1) c = y === b - 1 ? R[1] : R[x === 2 ? 5 : 4];
      if (x === 8 || x === 9 || x === 22 || x === 23) c = x % 2 ? '#3a2418' : '#5a3a24';
      P.set(x, y, c);
    }
    for (const [cx, cy] of [[2, b - 13], [29, b - 13], [2, b - 1], [29, b - 1]]) { P.set(cx, cy, BRASS[4]); P.set(cx + (cx < 10 ? 1 : -1), cy, BRASS[3]); P.set(cx, cy + (cy < b - 5 ? 1 : -1), BRASS[3]); }
    P.rect(14, b - 11, 4, 4, BRASS[3]); P.set(14, b - 11, BRASS[5]); P.set(15, b - 9, OUT); P.set(16, b - 9, OUT);
    P.set(8, b - 10, BRASS[4]); P.set(22, b - 10, BRASS[4]);
    P.rect(4, b - 6, 3, 2, '#e8dcc0'); P.set(4, b - 6, CRIMSON[4]); P.rect(25, b - 5, 3, 2, '#c8b890'); P.set(26, b - 5, TEALC[4]);
    // fabric spilling over the rim
    for (let x = 3; x <= 28; x++) { const t = Math.sin(x * 0.7) > 0; P.set(x, b - 14, t ? ROSE_C[2] : GOLD[4]); P.set(x, b - 15, t ? ROSE_C[1] : GOLD[3]); }
    const spill = [[5, 6, ROSE_C], [12, 4, GOLD], [19, 7, FOREST], [24, 3, LAV]];
    for (const [sx, len, C] of spill) for (let j = 0; j < len; j++) { const x = sx + Math.round(Math.sin(j * 0.9) * 0.8); P.set(x, b - 13 + j, C === GOLD ? GOLD[4] : C[C.length - 2]); P.set(x + 1, b - 13 + j, C === GOLD ? GOLD[3] : C[C.length - 3]); P.set(x + 2, b - 13 + j, C === GOLD ? GOLD[2] : C[C.length - 4]); }
    for (let x = 24; x <= 27; x++) if (x % 2 === 0) P.set(x, b - 10, '#ffffff');
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });
  const ROSE_C = ['#5a1838', '#8c3a62', '#c4648e', '#e89ab8', '#f6c8dc'];

  const CROW = ['#0b0711', '#1b1429', '#2e2442', '#46395c', '#8a6ad0'];
  function crowPose(P, pose) {
    const C = CROW;
    // tail
    for (let j = 0; j < 4; j++) { P.set(12 + Math.floor(j / 2), 8 + j, C[1]); P.set(13 + Math.floor(j / 2), 8 + j, C[0]); }
    // body
    P.ell(9, 7.5, 3.6, 2.8, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.7 ? C[3] : ny < -0.3 ? C[2] : C[1]));
    P.set(8, 6, C[4]); P.set(10, 6, C[3]);
    if (pose === 2) { P.set(10, 5, C[3]); P.set(11, 5, C[4]); P.set(12, 6, C[2]); } // wing lifted for preening
    // head
    const hx = pose === 2 ? 10 : 6, hy = pose === 1 ? 3 : pose === 2 ? 4 : 4;
    P.ell(hx, hy, 2, 1.8, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.6 ? C[3] : C[2]));
    if (pose === 0) { P.set(4, 4, '#5a5068'); P.set(3, 4, '#4a4458'); P.set(3, 5, '#3a3448'); P.set(6, 3, '#e8e4f4'); }
    if (pose === 1) { P.set(4, 2, '#5a5068'); P.set(3, 1, '#4a4458'); P.set(6, 3, '#e8e4f4'); P.set(7, 2, C[3]); }
    if (pose === 2) { P.set(12, 5, '#5a5068'); P.set(12, 6, '#4a4458'); P.set(9, 3, '#e8e4f4'); }
    // legs
    P.set(8, 10, '#3a3448'); P.set(10, 10, '#3a3448'); P.set(8, 11, '#4a4458'); P.set(10, 11, '#4a4458');
  }
  def('crow_perch', 1, () => {
    const W = 16, H = 34, b = H - 1;
    const draw = (pose) => {
      const P = new Pix(W, H), R = WALNUT;
      P.ell(7.5, b - 2, 4.5, 1.5, (x, y, nx) => P.set(x, y, nx < -0.3 ? R[5] : R[3])); P.hline(4, 11, b - 1, R[1]);
      for (let y = 13; y <= b - 3; y++) { P.set(7, y, R[4]); P.set(8, y, R[2]); }
      P.hline(2, 13, 12, R[5]); P.hline(2, 13, 13, R[3]); P.set(2, 12, R[6]);
      P.set(2, 14, BRASS[4]); P.set(3, 14, BRASS[3]); P.set(2, 15, BRASS[3]); P.set(3, 15, BRASS[2]); P.set(2, 14, '#c8a060');
      crowPose(P, pose);
      P.outline(OUT); P.shadow(9, b, 5, 1.4);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true }, draw, 3, 2, false, [0, 0, 0, 0, 1, 1, 0, 0, 0, 2, 2, 0]);
  });

  def('bay_window', 1, () => {
    const W = 48, H = 48, R = HONEY;
    const scene = (x, y, night) => { // what you see through the glass: sky over the rooftops across the street
      const roof = 27 - Math.round(Math.abs(((x * 0.55) % 8) - 4) * 0.9) - (x > 18 && x < 30 ? 3 : 0);
      if (y >= roof) {
        let c = night ? '#120c1e' : '#4a3a5e';
        if (y === roof) c = night ? '#2a2142' : '#6a5a7e';
        if (x === 23 && y < roof + 3) c = night ? '#1b1429' : '#3a2e4e';
        if (night && hash(x >> 1, y >> 1, 5) < 0.12 && y > roof + 1) c = (x + y) % 2 ? AMBER : '#e8843c';
        return c;
      }
      if (night) { let c = rampAt(['#0c0c26', '#141438', '#1e1e4c', '#2a2a5e'], (y - 3) / 26, x, y); if (hash(x, y, 7) < 0.02) c = '#ffffff'; return c; }
      return rampAt(['#6a74b8', '#8a8cc8', '#b0a0cc', '#d8b8c0', '#f0cca8', '#f6dcb0'], (y - 3) / 26, x, y);
    };
    const draw = (f, night) => {
      const P = new Pix(W, H);
      for (let y = 4; y <= 36; y++) for (let x = 3; x <= 44; x++) {
        const side = x < 10 || x > 37, lx = side ? (x < 10 ? x - 3 : 44 - x) : x - 10;
        const mun = side ? (lx % 4 === 0 || (y - 4) % 6 === 0) : (lx % 5 === 0 || (y - 4) % 6 === 0);
        let c;
        if (x === 3 || x === 44 || y === 4 || y === 36 || x === 9 || x === 10 || x === 37 || x === 38) c = (x === 9 || x === 37) ? R[2] : x === 3 ? R[4] : R[3];
        else if (mun) c = side ? R[2] : R[3];
        else { c = scene(x, y, night); if (side) c = mix(c, night ? '#0c0a16' : '#5a4a6a', 0.45); }
        P.set(x, y, c);
      }
      // velvet pelmet with gold fringe
      for (let x = 2; x <= 45; x++) { const drop = Math.round(Math.sin(((x - 2) / 43) * Math.PI * 3) * 1.5 + 1.5); for (let y = 1; y <= 3 + drop; y++) P.set(x, y, y === 1 ? PLUM[5] : (x + y) % 4 === 0 ? PLUM[2] : PLUM[3]); P.set(x, 4 + drop, x % 2 ? GOLD[4] : GOLD[3]); }
      // sill with plants, panelled base
      for (let x = 1; x <= 46; x++) { P.set(x, 37, R[6]); P.set(x, 38, R[5]); P.set(x, 39, R[3]); P.set(x, 40, R[1]); }
      for (let y = 41; y <= 46; y++) for (let x = 3; x <= 44; x++) { const lx = (x - 3) % 14; P.set(x, y, lx === 0 ? R[1] : lx === 1 || y === 41 ? R[4] : lx === 13 || y === 46 ? R[2] : R[3]); }
      const pot = (x, C) => { P.hline(x, x + 4, 33, C[3]); for (let y = 34; y <= 36; y++) P.hline(x + 1, x + 3, y, C[2]); P.set(x + 1, 34, C[4]); };
      pot(8, TERRA); for (const [dx, dy] of [[0, 0], [-1, 1], [1, 1], [-2, 2], [2, 2], [0, -1]]) P.set(10 + dx, 31 + dy, dy < 1 ? LEAF[5] : LEAF[4]);
      pot(21, TEALC); for (let j = 0; j < 8; j++) { P.set(21 - (j > 3 ? 1 : 0), 34 + j, j % 2 ? LEAF[3] : LEAF[4]); P.set(26 + (j > 4 ? 1 : 0), 35 + j, LEAF[3]); } P.set(23, 31, LEAF[4]); P.set(22, 32, LEAF[3]); P.set(24, 32, LEAF[5]);
      pot(34, PLUM); for (const [dx, dy, c] of [[0, -2, AMBER], [-2, -1, ROSE_C[3]], [2, -1, AMBER], [1, -3, ROSE_C[3]], [-1, -3, LEAF[4]], [0, 0, LEAF[3]]]) P.set(36 + dx, 32 + dy, c);
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 24, ay: H - 1, foot: [3, 1], solid: true, wall: true, lights: [L(24, 20, 70, [255, 200, 130], 0.6)] }, draw, 1, 0, true);
    s.nLights = [L(24, 26, 48, [255, 176, 100], 0.32)];
    return s;
  });

  def('hanging_lamp', 1, () => {
    const W = 16, H = 27, b = H - 1, P = new Pix(W, H);
    for (let y = 0; y <= 10; y++) { if (y % 3 === 0) { P.set(7, y, IRON[4]); P.set(8, y, IRON[2]); } else P.set(y % 3 === 1 ? 7 : 8, y, IRON[3]); }
    P.hline(6, 9, 11, BRASS[4]); P.set(9, 11, BRASS[2]); P.hline(5, 10, 12, BRASS[3]);
    const SH = ['#5a2410', '#a4441c', '#d8702c', '#f4a048', '#ffd08a'];
    for (let j = 0; j < 9; j++) {
      const y = 13 + j, hw = 2 + j * 0.62;
      for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) {
        const rel = (x - (7.5 - hw)) / (2 * hw), seg = Math.floor(rel * 4);
        let c = SH[clamp((seg % 2 ? 2 : 3) + (rel < 0.3 ? 1 : 0) - (rel > 0.8 ? 1 : 0) + (j > 5 ? 1 : 0) - 1, 0, 4)];
        if (j === 4 || (j > 0 && Math.abs(rel * 4 - Math.round(rel * 4)) < 0.1)) c = '#2a140c';
        P.set(x, y, c);
      }
    }
    P.hline(1, 14, 22, BRASS[3]); P.set(1, 22, BRASS[4]); P.set(14, 22, BRASS[2]);
    for (let x = 2; x <= 13; x += 2) P.set(x, 23, x % 4 ? AMBER : ORANGE);
    P.set(7, 23, CANDLE); P.set(8, 23, '#ffe0a0'); P.set(7, 24, '#ffd690');
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: false, overhead: true, lights: [L(7.5, 22, 76, [255, 165, 80], 0.9), L(7.5, 18, 20, [255, 200, 120], 0.35)] });
  });

  def('sewing_table', 1, () => {
    const W = 32, H = 34, b = H - 1, P = new Pix(W, H), R = HONEY, I = IRON;
    // cast-iron treadle frame with scrollwork
    for (const x0 of [2, 24]) {
      for (let y = b - 12; y <= b - 1; y++) { P.set(x0, y, I[4]); P.set(x0 + 5, y, I[2]); }
      for (let k = 0; k < 5; k++) { P.set(x0 + 1 + k, b - 12 + k * 2, I[3]); P.set(x0 + 4 - k, b - 11 + k * 2, I[3]); }
      P.hline(x0 - 1, x0 + 6, b - 1, I[3]);
    }
    for (let x = 8; x <= 23; x++) { P.set(x, b - 3, (x % 2) ? I[4] : I[2]); P.set(x, b - 2, I[1]); }
    P.ell(26.5, b - 7, 3.6, 3.6, (x, y, nx, ny) => { const d = nx * nx + ny * ny; if (d > 0.55) P.set(x, y, nx + ny < 0 ? I[5] : I[3]); else if (Math.abs(nx) < 0.2 || Math.abs(ny) < 0.2) P.set(x, y, I[3]); });
    // table top and drawer
    for (let x = 1; x <= 30; x++) { P.set(x, b - 15, R[5]); P.set(x, b - 14, R[6]); P.set(x, b - 13, R[3]); }
    for (let x = 11; x <= 20; x++) { P.set(x, b - 12, R[3]); P.set(x, b - 11, R[2]); } P.set(15, b - 12, BRASS[4]);
    // the machine head: black japanned, gold decals
    const J = ['#120e18', '#221c2a', '#352c40', '#4c4058'];
    P.hline(5, 21, b - 16, J[2]); P.hline(5, 21, b - 17, J[3]);
    for (let y = b - 26; y <= b - 18; y++) for (let x = 17; x <= 20; x++) P.set(x, y, x === 17 ? J[3] : J[1]);
    for (let y = b - 26; y <= b - 24; y++) for (let x = 7; x <= 20; x++) P.set(x, y, y === b - 26 ? J[3] : J[2]);
    for (let y = b - 26; y <= b - 20; y++) for (let x = 7; x <= 9; x++) P.set(x, y, x === 7 ? J[3] : J[1]);
    P.vline(8, b - 19, b - 18, SILVER[4]);
    for (let x = 10; x <= 16; x += 2) P.set(x, b - 25, GOLD[4]); P.set(18, b - 22, GOLD[4]); P.set(19, b - 20, GOLD[3]);
    P.ell(21.5, b - 22, 1.6, 2.6, (x, y, nx) => P.set(x, y, nx < 0 ? SILVER[4] : SILVER[2]));
    P.set(12, b - 27, CRIMSON[4]); P.set(13, b - 27, CRIMSON[3]); P.set(12, b - 28, WOOD[4]); P.set(13, b - 28, WOOD[3]);
    // spools and a bolt of cloth
    for (const [sx, C] of [[23, TEALC], [26, OCHRE], [28, PLUM]]) { P.set(sx, b - 18, WOOD[4]); P.set(sx + 1, b - 18, WOOD[3]); P.set(sx, b - 17, C[4]); P.set(sx + 1, b - 17, C[2]); P.set(sx, b - 16, WOOD[3]); P.set(sx + 1, b - 16, WOOD[2]); }
    for (let y = b - 20; y <= b - 16; y++) for (let x = 1; x <= 4; x++) P.set(x, y, x === 1 ? ROSE_C[3] : ROSE_C[x === 4 ? 1 : 2]);
    P.set(1, b - 18, ROSE_C[1]); P.set(2, b - 18, ROSE_C[4]);
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('fabric_bolts', 1, () => {
    const W = 16, H = 28, b = H - 1, P = new Pix(W, H);
    const bolts = [[3, 17, MIDNIGHT], [6, 20, ROSE_C], [9, 15, TEALC], [11, 18, OCHRE], [5, 12, PLUM]];
    for (const [bx, h, C] of bolts) {
      for (let y = b - 7 - h; y <= b - 6; y++) { P.set(bx, y, C[4]); P.set(bx + 1, y, C[3]); P.set(bx + 2, y, C[1]); if (C === MIDNIGHT && hash(bx, y, 4) < 0.18) P.set(bx + 1, y, '#ffffff'); }
      P.set(bx, b - 8 - h, C[3]); P.set(bx + 1, b - 8 - h, C[4]); P.set(bx + 2, b - 8 - h, C[2]); P.set(bx + 1, b - 7 - h, C[0]);
    }
    // a loose end draped over the basket
    for (let j = 0; j < 5; j++) { P.set(7 + (j > 2 ? 1 : 0), b - 7 + j, ROSE_C[3]); P.set(8 + (j > 2 ? 1 : 0), b - 7 + j, ROSE_C[2]); }
    // wicker basket
    for (let y = b - 7; y <= b - 1; y++) for (let x = 1; x <= 14; x++) {
      if (y === b - 1 && (x === 1 || x === 14)) continue;
      let c = ((Math.floor(x / 2) + y) % 2) ? HONEY[4] : HONEY[2];
      if (y === b - 7) c = x % 2 ? HONEY[5] : HONEY[3];
      if (x === 1) c = HONEY[5]; if (x === 14) c = HONEY[1];
      if (!(x >= 7 && x <= 9 && y < b - 2)) P.set(x, y, c);
    }
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  // ------------------------------------------------------------------ Cathedral of the Silver Veil
  // pointed-arch half width at row y for an arch springing at row `spring` with apex at `spring - h`
  function archHW(hw, h, spring, y) { const d = spring - y; if (d <= 0) return hw; if (d > h) return -1; return Math.max(0, Math.sqrt(4 * hw * hw - Math.pow(d * (Math.sqrt(3) * hw / h), 2)) - hw); }
  const GL = { // stained-glass ramps (dark -> bright)
    rose: ['#3a0c26', '#6e1a46', '#a8306e', '#dc5c98', '#ff9cc8', '#ffe0ee'], gold: ['#4a2a08', '#8a5a14', '#c88a24', '#f2c45a', '#ffe48e', '#fff8dc'],
    azure: ['#0c1c4c', '#163482', '#2858c0', '#4a8ae8', '#8ac0ff', '#e0f0ff'], violet: ['#1e0e4a', '#3a2084', '#5e3cc0', '#8a68e6', '#bca0ff', '#f0e8ff'],
    emerald: ['#06301e', '#0e5434', '#1a8452', '#34bc78', '#7ae8aa', '#dcfff0'], teal: ['#062a30', '#0e4c56', '#1a7c84', '#34b2b0', '#7ae4d8', '#dcfffa'],
  };
  const GL_RGB = { rose: [255, 120, 180], gold: [255, 205, 100], azure: [100, 160, 255], violet: [170, 130, 255], emerald: [80, 230, 150], teal: [80, 220, 210] };
  const SCHEMES = [['rose', 'gold', 'violet'], ['azure', 'violet', 'gold'], ['emerald', 'teal', 'gold'], ['rose', 'azure', 'gold', 'emerald', 'violet']];
  // colour one pane of glass: role picks the hue, cell = mosaic piece id, night darkens toward moonlight
  function paneCol(scheme, role, cell, x, y, night) {
    const hue = scheme.length > 3 && role === 0 ? scheme[[0, 1, 3, 4][Math.floor(hash(cell, 3, 5) * 4)]] : scheme[Math.min(role, scheme.length - 1)];
    const R = GL[hue], hv = hash(cell, 1, 9);
    let k = hv < 0.3 ? 2 : hv < 0.8 ? 3 : 4;
    if (night) { k = Math.max(0, k - 2); return mix(R[k], '#20244e', 0.3); }
    return R[k];
  }
  // Voronoi mosaic: returns [cellId, isLead]
  function mosaic(x, y, size, seed) {
    const gx0 = Math.floor(x / size), gy0 = Math.floor(y / size);
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = gx0 + i, gy = gy0 + j, ox = (gx + 0.15 + hash(gx, gy, seed) * 0.7) * size, oy = (gy + 0.15 + hash(gx, gy, seed + 1) * 0.7) * size;
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
      if (d < d1) { d2 = d1; d1 = d; id = gx * 7919 + gy * 104729; } else if (d < d2) d2 = d;
    }
    return [id, d2 - d1 < 0.62];
  }

  def('pillar', 1, () => {
    const W = 20, H = 96, b = H - 1, P = new Pix(W, H), R = PSTONE;
    const shaft = [0, 0, 0, 6, 5, 4, 2, 5, 6, 5, 4, 3, 2, 4, 3, 3, 1];
    for (let y = 14; y <= b - 11; y++) for (let x = 3; x <= 16; x++) {
      let k = shaft[x];
      if ((y - 14) % 21 === 20) k = Math.max(1, k - 2);
      if (noise(x / 2, y / 9, 7) > 0.78) k = Math.max(1, k - 1);
      P.set(x, y, R[k]);
    }
    for (let x = 2; x <= 17; x++) { P.set(x, 52, R[x < 6 ? 7 : x < 12 ? 6 : 4]); P.set(x, 53, R[x < 10 ? 4 : 2]); } // shaft ring
    // foliate capital
    for (let y = 5; y <= 13; y++) { const hw = 7 + Math.round((13 - y) * 0.35); for (let x = Math.round(9.5 - hw); x <= Math.round(9.5 + hw) - 1; x++) { let k = x < 7 ? 5 : x < 13 ? 4 : 3; const lx = (x + 40) % 5, ly = y - 5; if (ly < 4 && (lx === 1 || lx === 2) && ly !== 3) k = 6; if (ly >= 4 && lx === 0) k = 2; if (ly === 3 && lx === 3) k = 2; if (y === 13) k = 2; P.set(x, y, R[k]); } }
    for (const lx of [1, 6, 11, 16]) { P.set(lx, 5, R[7]); P.set(lx + 1, 4 + 2, R[6]); }
    for (let x = 0; x <= 19; x++) { P.set(x, 2, R[7]); P.set(x, 3, R[5]); P.set(x, 4, R[2]); }
    for (let x = 0; x <= 3; x++) { P.set(x, 1, R[6]); P.set(19 - x, 1, R[4]); } P.set(0, 0, R[6]); P.set(1, 0, R[5]); P.set(19, 0, R[3]); P.set(18, 0, R[4]);
    // moulded base on an octagonal plinth
    const tor = [6, 5, 3, 1];
    for (let j = 0; j < 4; j++) for (let x = 2; x <= 17; x++) P.set(x, b - 10 + j, R[x < 5 ? Math.min(7, tor[j] + 1) : x > 15 ? Math.max(1, tor[j] - 1) : tor[j]]);
    for (let y = b - 6; y <= b - 1; y++) for (let x = 1; x <= 18; x++) P.set(x, y, y === b - 6 ? R[7] : y === b - 1 ? R[1] : x <= 3 ? R[6] : x >= 16 ? R[2] : R[4]);
    P.outline(OUT); P.shadow(12, b, 9, 2.2);
    return sprite({ c: P.canvas(), ax: 10, ay: b, foot: [1, 1], solid: true, fade: true });
  });

  def('glass_tall', 4, (v) => {
    const W = 32, H = 80, R = PSTONE, sc = SCHEMES[v], seed = 600 + v * 31;
    const cx = 15.5, hw = 12.5, spring = 23, top = 4, bottom = 72;
    const inOpen = (x, y) => y >= top && y <= bottom && Math.abs(x + 0.5 - cx - 0.5) <= archHW(hw, spring - top, spring, y) + 0.3;
    const lightX = [[3, 14], [17, 28]], subSpring = 35, subTop = 27;
    const inSub = (x, y, k) => { const [a, b2] = lightX[k], c2 = (a + b2) / 2, h2 = (b2 - a + 1) / 2; return x >= a && x <= b2 && y <= bottom && Math.abs(x - c2) <= archHW(h2, subSpring - subTop, subSpring, y) + 0.3; };
    const ocx = 16, ocy = 16, ocr = 5.6;
    // classify: 0 outside, 1 tracery stone, 2 glass
    const cls = new Uint8Array(W * H);
    for (let y = 0; y <= bottom; y++) for (let x = 0; x < W; x++) {
      if (!inOpen(x, y)) continue;
      const d = Math.hypot(x + 0.5 - ocx, y + 0.5 - ocy), inL = inSub(x, y, 0) || inSub(x, y, 1);
      let stone = (y >= 22 && (x === 15 || x === 16)) || Math.abs(d - ocr) < 0.62;
      if (!inL && y >= subTop - 1 && y < subSpring + 1 && !(d < ocr) && (inSub(x - 1, y, 0) || inSub(x + 1, y, 0) || inSub(x - 1, y, 1) || inSub(x + 1, y, 1) || inSub(x, y + 1, 0) || inSub(x, y + 1, 1))) stone = true;
      cls[y * W + x] = stone ? 1 : 2;
    }
    const C = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : cls[y * W + x]);
    const draw = (f, night) => {
      const P = new Pix(W, H);
      for (let y = 0; y <= bottom + 3; y++) for (let x = 0; x < W; x++) { // splayed jambs
        if (inOpen(x, y)) continue;
        let near = 0; for (let k = 1; k <= 3 && !near; k++) if (inOpen(x - k, y) || inOpen(x + k, y) || inOpen(x, y + k) || inOpen(x - k, y + k) || inOpen(x + k, y + k)) near = k;
        if (!near) continue;
        const left = x < cx;
        P.set(x, y, near === 1 ? (left ? R[3] : R[5]) : near === 2 ? (left ? R[6] : R[4]) : R[2]);
      }
      for (let y = 0; y <= bottom; y++) for (let x = 0; x < W; x++) {
        const k0 = C(x, y); if (!k0) continue;
        if (k0 === 1) { P.set(x, y, x < cx ? R[6] : R[4]); continue; }
        const edge = C(x - 1, y) !== 2 || C(x + 1, y) !== 2 || C(x, y - 1) !== 2 || C(x, y + 1) !== 2;
        if (edge) { P.set(x, y, night ? ((x + y) % 2 ? '#3a3a66' : '#24244a') : ((x + y) % 2 ? '#f6f0ff' : GL[sc[1]][3])); continue; } // pearl border
        const d = Math.hypot(x + 0.5 - ocx, y + 0.5 - ocy), inL = inSub(x, y, 0) || inSub(x, y, 1);
        const lc = x < cx ? 8.5 : 22.5;
        let role = 0, size = 4.4, md = 99;
        for (const my of [45, 61]) md = Math.min(md, Math.hypot(x + 0.5 - lc - 0.5, y + 0.5 - my));
        if (d < ocr) { const a = Math.atan2(y - ocy, x - ocx); role = d < 2 ? 2 : (Math.abs(Math.sin(2 * a)) > 0.45 ? 1 : 0); size = 2.6; }
        else if (!inL) { role = 1; size = 3; }
        else if (md < 4.8) { role = md > 3.8 ? 2 : 1; size = 2.6; if (Math.abs(md - 4.3) < 0.5) { P.set(x, y, night ? '#0e0c18' : '#2a2234'); continue; } }
        const [cell, lead] = mosaic(x, y, size, seed + role * 7);
        if (lead) { P.set(x, y, night ? '#0e0c18' : '#2a2234'); continue; }
        let c = paneCol(sc, role, cell + role * 31, x, y, night);
        if (!night && hash(cell, 7, seed) < 0.18 && hash(x, y, seed + 4) < 0.35) c = mix(c, '#ffffff', 0.4);
        if ((y === 40 || y === 53 || y === 67) && inL) c = night ? '#0a0810' : IRON[1]; // saddle bars
        P.set(x, y, c);
      }
      for (let x = 1; x <= 30; x++) { P.set(x, bottom + 1, R[7]); P.set(x, bottom + 2, R[5]); P.set(x, bottom + 3, R[2]); }
      P.outline(OUT);
      return P;
    };
    const rg = (k) => GL_RGB[sc[Math.min(k, sc.length - 1)]];
    const s = build({ ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true, lights: [L(15.5, 16, 40, rg(2), 0.45), L(15.5, 36, 50, rg(0), 0.5), L(15.5, 54, 56, rg(1), 0.5), L(15.5, 72, 68, sc.length > 3 ? GL_RGB.emerald : rg(0), 0.5)] }, draw, 1, 0, true);
    s.nLights = [L(15.5, 30, 40, [120, 130, 220], 0.25), L(15.5, 60, 50, [120, 130, 220], 0.25)];
    return s;
  });

  def('rose_window', 1, () => {
    const W = 48, H = 80, R = PSTONE, cx = 23.5, cy = 26, RO = 21.6, seed = 777;
    const draw = (f, night) => {
      const P = new Pix(W, H);
      for (let y = 2; y <= 50; y++) for (let x = 1; x <= 46; x++) { // square surround with carved spandrels
        let k = (x === 1 || y === 2) ? 7 : (x === 46 || y === 50) ? 2 : 5;
        const cd = Math.hypot(x - cx, y - cy);
        if (cd > RO + 1 && k === 5) { const sx = x < cx ? x - 1 : 46 - x, sy = y < cy ? y - 2 : 50 - y; if (Math.abs(sx + sy - 9) < 0.7 || (Math.abs(sx - 4) < 0.6 && sy < 6) || (Math.abs(sy - 4) < 0.6 && sx < 6)) k = 3; else if (sx + sy < 9) k = 4; }
        P.set(x, y, R[k]);
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x + 0.5 - cx - 0.5, y + 0.5 - cy - 0.5); if (d > RO) continue;
        const a = Math.atan2(y - cy, x - cx), seg = (a + Math.PI) / (Math.PI * 2) * 12, sp = seg - Math.floor(seg), petal = Math.floor(seg);
        let c;
        if (d > RO - 2) c = (Math.floor(seg * 4) % 2) ? R[d > RO - 1 ? 4 : 6] : R[d > RO - 1 ? 3 : 5];   // cusped outer ring
        else if (d > 8.4 && (sp < 0.09 || sp > 0.91)) c = R[sp < 0.5 ? 6 : 4];                            // spokes
        else if (d > 7 && d <= 8.4) c = R[6];
        else if (d > 8.4 && d < RO - 2 && d > RO - 3.2 && Math.abs(sp - 0.5) > 0.3) c = R[5];              // pointed petal tips
        else {
          const [cell, lead] = mosaic(x, y, 3.4, seed);
          if (lead) c = night ? '#0e0c18' : '#2a2234';
          else {
            let hue;
            if (d <= 7) { const star = Math.abs(Math.cos(3 * a)) > 0.55 - (7 - d) * 0.06; hue = d < 2.2 ? 'gold' : star ? 'gold' : 'violet'; }
            else if (Math.hypot(d - 14.6, (sp - 0.5) * 9) < 2.6) hue = 'gold';
            else hue = petal % 2 ? 'azure' : 'rose';
            const Rg = GL[hue], hv = hash(cell, 2, seed); let k = hv < 0.3 ? 2 : hv < 0.8 ? 3 : 4;
            if (d < 2.2) k = 5;
            c = night ? mix(Rg[Math.max(0, k - 2)], '#20244e', 0.3) : Rg[k];
            if (!night && hash(x, y, seed + 3) < 0.05) c = mix(c, '#ffffff', 0.4);
          }
        }
        P.set(x, y, c);
      }
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 24, ay: H - 1, foot: [3, 1], solid: true, wall: true, lights: [L(23.5, 26, 68, [240, 160, 220], 0.6), L(9, 26, 38, GL_RGB.azure, 0.35), L(38, 26, 38, GL_RGB.rose, 0.35), L(23.5, 44, 44, GL_RGB.gold, 0.35)] }, draw, 1, 0, true);
    s.nLights = [L(23.5, 26, 56, [130, 140, 230], 0.3)];
    return s;
  });

  def('pew', 1, () => {
    const W = 48, H = 28, b = H - 1, P = new Pix(W, H), R = WALNUT;
    // backrest seen from behind, with blind Gothic arcading
    for (let y = b - 17; y <= b - 2; y++) for (let x = 3; x <= 44; x++) {
      let c = R[3];
      if (y === b - 17) c = R[6]; else if (y === b - 16) c = R[5]; else if (y === b - 15) c = R[2];
      else if (y >= b - 4) c = y === b - 4 ? R[5] : y === b - 3 ? R[4] : R[2];
      else {
        const lx = (x - 3) % 7, ly = y - (b - 14), aw = archHW(2.5, 3, b - 10, y);
        if (lx === 0) c = R[2];
        else if (aw >= 0 && Math.abs(lx - 3.5) <= aw + 0.2 && y <= b - 6) c = Math.abs(lx - 3.5) > aw - 0.8 ? (lx < 3.5 ? R[1] : R[4]) : R[2];
        else c = lx === 1 ? R[4] : R[3];
        if (ly < 0) c = R[3];
      }
      P.set(x, y, c);
    }
    // hymn-book ledge with books
    for (let x = 4; x <= 43; x++) { P.set(x, b - 7, R[6]); P.set(x, b - 6, R[3]); }
    const bk = [[6, CRIMSON], [8, FOREST], [21, CRIMSON], [33, MIDNIGHT], [35, CRIMSON], [40, FOREST]];
    for (const [bx, C] of bk) { P.set(bx, b - 9, C[4]); P.set(bx + 1, b - 9, C[2]); P.set(bx, b - 8, C[3]); P.set(bx + 1, b - 8, C[1]); P.set(bx, b - 10, GOLD[3]); }
    // carved bench ends with poppyhead finials
    for (const [x0, lit] of [[0, true], [45, false]]) {
      for (let y = b - 20; y <= b - 1; y++) for (let x = x0; x <= x0 + 2; x++) P.set(x, y, lit ? (x === x0 ? R[6] : R[5]) : (x === x0 + 2 ? R[1] : R[3]));
      const fx = x0 + 1;
      P.set(fx, b - 24, lit ? R[6] : R[4]); P.set(fx - 1, b - 23, lit ? R[6] : R[4]); P.set(fx + 1, b - 23, lit ? R[5] : R[2]); P.set(fx, b - 23, lit ? R[5] : R[3]);
      P.set(fx - 1, b - 22, lit ? R[5] : R[3]); P.set(fx + 1, b - 22, lit ? R[4] : R[2]); P.set(fx, b - 22, R[2]); P.set(fx, b - 21, lit ? R[5] : R[3]);
      P.set(x0, b - 1, R[1]); P.set(x0 + 2, b - 1, R[1]);
    }
    P.outline(OUT); P.shadow(26, b, 23, 1.8);
    return sprite({ c: P.canvas(), ax: 24, ay: b, foot: [3, 1], solid: true });
  });

  // a veiled lady: veil over the bowed head flowing to the hem; arms 'clasp' (hands at the breast) or 'open'
  function fillPoly(pts, fn) {
    let y0 = 1e9, y1 = -1e9; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax)); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) fn(x, y);
    }
  }
  function veiledFigure(P, cx, top, hgt, R, arms) {
    const hwAt = (j) => j < 7 ? [1.6, 2.5, 3, 3.1, 3.1, 2.9, 2.7][j] : j < 10 ? [3.9, 4.8, 5.2][j - 7] : 5.2 + (j - 10) * (1.9 / Math.max(1, hgt - 10)) + (arms === 'clasp' && j < 15 ? 0.5 : 0);
    for (let j = 0; j < hgt; j++) {
      const hw = hwAt(j), y = top + j;
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw) - 1; x++) {
        const rel = (x + 0.5 - (cx - hw)) / (2 * hw);
        let k = rel < 0.18 ? 6 : rel < 0.42 ? 5 : rel < 0.72 ? 4 : rel < 0.9 ? 3 : 2;
        const fold = j > 9 && (Math.abs(x + 0.5 - cx + 1.5 + Math.sin(j * 0.3) * 0.4) < 0.5 || Math.abs(x + 0.5 - cx - 2.6) < 0.5 || Math.abs(x + 0.5 - cx + 4.2) < 0.5);
        if (fold) k = Math.max(2, k - 2);
        P.set(x, y, R[k]);
      }
    }
    // the face, shadowed under the veil
    P.ell(cx - 0.3, top + 3.8, 1.5, 1.9, (x, y) => P.set(x, y, R[3]));
    P.set(cx - 0.8, top + 3, R[5]); P.set(cx - 0.8, top + 4, R[4]); P.set(cx + 0.5, top + 5, R[2]);
    P.set(cx - 2.5, top + 6, R[2]); P.set(cx + 2, top + 6, R[1]); // neck shadow under the veil
    // veil hem falling across the breast
    for (let x = Math.round(cx - 5); x <= Math.round(cx + 4); x++) { const yy = top + 13 + Math.round(Math.abs(x + 0.5 - cx) * 0.45); P.set(x, yy, x < cx ? R[6] : R[4]); P.set(x, yy + 1, R[2]); }
    if (arms === 'clasp') {
      P.line(cx - 4, top + 10, cx - 1, top + 11, R[6]); P.line(cx + 3, top + 10, cx, top + 11, R[3]);
      P.set(cx - 1, top + 10, R[6]); P.set(cx, top + 10, R[5]); P.set(cx - 1, top + 11, R[5]); P.set(cx, top + 11, R[4]);
    } else {
      for (const sd of [-1, 1]) for (let t = 0; t <= 8; t++) {
        const x = cx - 0.5 + sd * (4 + t), y = top + 9 - Math.round(t * 0.45);
        P.set(x, y, sd < 0 ? R[6] : R[4]); P.set(x, y + 1, sd < 0 ? R[5] : R[3]);
        if (t < 7) P.set(x, y + 2 + Math.floor(t / 3), sd < 0 ? R[4] : R[2]); // sleeve hanging under the arm
      }
      for (const sd of [-1, 1]) { P.set(cx - 0.5 + sd * 13, top + 5, R[6]); P.set(cx - 0.5 + sd * 13, top + 4, R[5]); }
    }
  }
  // feathered wing spread from a shoulder at (sx, sy); s = -1 left, +1 right
  function wing(P, sx, sy, s, R, scale) {
    const k = scale || 1;
    const pts = [[0, 1], [3, -4], [7, -9], [12, -12], [16, -13], [19, -12], [18, -9], [17, -5], [15, -1], [12, 3], [8, 6], [4, 7], [1, 5]].map(([dx, dy]) => [sx + s * dx * k, sy + dy * k]);
    fillPoly(pts, (x, y) => {
      const dx = (x + 0.5 - sx) * s / k, dy = (y + 0.5 - sy) / k, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      let c;
      const lit = s < 0;
      if (r < 6) c = ((Math.floor(dx) + Math.floor(dy * 1.5)) % 3 === 0) ? (lit ? R[4] : R[2]) : (lit ? R[5] : R[3]);
      else {
        const band = (th + 2) * 5.2, sep = band - Math.floor(band);
        c = sep < 0.2 ? (lit ? R[3] : R[1]) : (lit ? (r > 13 ? R[6] : R[5]) : (r > 13 ? R[4] : R[3]));
      }
      if (dy < -dx * 0.75 - 1.2 && r > 2) c = lit ? R[6] : R[4]; // leading edge catches the light
      P.set(x, y, c);
    });
  }

  def('altar', 1, () => {
    const W = 48, H = 72, b = H - 1, M = MARBLE, S = SILVER;
    const lights = [];
    const draw = (f) => {
      const P = new Pix(W, H);
      const fy = b - 58; // top of the figure
      wing(P, 20.5, fy + 12, -1, S, 1.05); wing(P, 26.5, fy + 12, 1, S, 1.05);
      veiledFigure(P, 23.5, fy, 30, S, 'open');
      if (f === 1) P.ell(23.5, fy + 3, 5.4, 5, (x, y, nx, ny) => { if (nx * nx + ny * ny > 0.7 && !P.has(x, y)) P.set(x, y, '#e8eeff', 150); });
      const step = (x0, x1, topY, frontY, botY) => {
        for (let y = topY; y <= botY; y++) for (let x = x0; x <= x1; x++) {
          let c;
          if (y < frontY) c = y === topY ? M[5] : (x + y * 3) % 11 === 0 ? M[3] : M[4];
          else c = y === frontY ? M[6] : y === botY ? M[1] : x === x0 ? M[4] : x === x1 ? M[1] : (x % 12 === 0 ? M[1] : M[2]);
          if (y < frontY && x === x0) c = M[5]; if (y < frontY && x === x1) c = M[2];
          P.set(x, y, c);
        }
      };
      step(1, 46, b - 8, b - 3, b - 1);
      step(5, 42, b - 14, b - 10, b - 8);
      for (let x = 7; x <= 40; x += 5) P.set(x, b - 2, S[3]);
      // the altar: marble block under a white cloth with silver bands and an embroidered crescent
      for (let y = b - 30; y <= b - 15; y++) for (let x = 11; x <= 36; x++) {
        let c;
        if (y <= b - 27) c = y === b - 30 ? '#f8f6ff' : x < 14 ? '#f0eef8' : '#e2e0ee';
        else { c = x < 14 ? '#dcdaea' : x > 33 ? '#a8a6c0' : '#c6c4da'; if ((x - 11) % 5 === 0 && y > b - 25) c = '#b0aec6'; }
        if (y === b - 26) c = S[4]; if (y === b - 18) c = x % 2 ? S[5] : S[3];
        if (y === b - 15) c = M[1];
        P.set(x, y, c);
      }
      for (const [x, dy] of [[23, -24], [22, -23], [22, -22], [23, -21], [24, -25], [24, -20], [25, -22]]) P.set(x, b + dy, x < 23 ? S[2] : S[3]);
      P.set(24, b - 23, GOLD[4]);
      // silver candlesticks
      const ks = [];
      for (const [cxk, ph] of [[13, 0], [33, 1]]) {
        P.hline(cxk - 1, cxk + 2, b - 31, S[4]); P.set(cxk - 1, b - 31, S[6]);
        for (let y = b - 35; y <= b - 32; y++) { P.set(cxk, y, S[5]); P.set(cxk + 1, y, S[2]); }
        P.hline(cxk - 1, cxk + 2, b - 36, S[4]);
        ks.push(candle(P, cxk, b - 37, 6, 2, (f * 2 + ph) % 4));
      }
      for (const vx of [7, 39]) { P.set(vx, b - 15, '#8a2a3a'); P.set(vx + 1, b - 15, '#5a1428'); P.set(vx, b - 16, '#d04050'); P.set(vx, b - 17, f ? CANDLE : AMBER); }
      if (f === 0) lights.push(L(23.5, fy + 10, 78, [222, 230, 255], 0.75), L(ks[0].x, ks[0].y, 26, L_CANDLE, 0.55, 1), L(ks[1].x, ks[1].y, 26, L_CANDLE, 0.55, 1), L(23.5, b - 16, 30, [255, 170, 110], 0.35, 1));
      P.outline(OUT);
      if (f === 1) for (const [x, y] of [[23, fy + 1], [9, fy + 2], [38, fy + 3], [20, fy + 16]]) P.set(x, y, '#ffffff');
      P.shadow(26, b, 23, 1.8);
      return P;
    };
    const s = build({ ax: 24, ay: b, foot: [3, 2], solid: true }, draw, 2, 1.5);
    s.lights = lights;
    return s;
  });

  def('candelabra', 1, () => {
    const W = 16, H = 44, b = H - 1, I = IRON;
    const arms = [[7.5, 9, 7], [3, 13, 5], [12, 13, 5], [1, 16, 4], [14, 16, 4]];
    const draw = (f) => {
      const P = new Pix(W, H);
      P.line(7, b - 4, 3, b - 1, I[4]); P.line(8, b - 4, 12, b - 1, I[2]); P.vline(7, b - 3, b - 1, I[3]);
      for (let y = 15; y <= b - 4; y++) { P.set(7, y, (y % 5 === 0) ? I[5] : I[4]); P.set(8, y, I[2]); }
      P.hline(5, 10, 22, I[4]); P.set(10, 22, I[2]); P.hline(6, 9, b - 5, I[4]);
      // curled arms
      P.line(7, 20, 3, 16, I[4]); P.line(8, 20, 12, 16, I[3]); P.line(6, 22, 1, 19, I[4]); P.line(9, 22, 14, 19, I[3]);
      for (const [x, by] of arms) { P.hline(Math.floor(x) - 1, Math.floor(x) + 1, by + 1, I[4]); P.set(Math.floor(x) + 1, by + 1, I[2]); }
      arms.forEach(([x, by, h], k) => candle(P, Math.floor(x) - (k === 0 ? 0 : 0), by, h, k === 0 ? 2 : 1, (f + k) % 4));
      P.outline(OUT); P.shadow(9, b, 5, 1.4);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, 6, 58, L_CANDLE, 0.85, 1)] }, draw, 4, 7);
  });

  def('votive_rack', 1, () => {
    const W = 32, H = 26, b = H - 1, Bz = BRASS;
    const tiers = [[b - 5, 3, 28], [b - 10, 5, 26], [b - 15, 7, 24]];
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let t = 2; t >= 0; t--) {
        const [y, x0, x1] = tiers[t];
        for (let x = x0; x <= x1; x++) { P.set(x, y, Bz[4]); P.set(x, y + 1, Bz[2]); }
        P.set(x0, y, Bz[5]);
        for (let x = x0 + 1, k = 0; x < x1 - 1; x += 3, k++) {
          const lit = hash(k, t, 41) < 0.8, glass = (k + t) % 3 === 0 ? ['#3a0e1e', '#8a1e34', '#d04050'] : ['#4a2a0e', '#a4581e', '#e89a3a'];
          P.set(x, y - 1, glass[1]); P.set(x + 1, y - 1, glass[0]); P.set(x, y - 2, glass[2]); P.set(x + 1, y - 2, glass[1]);
          if (lit) { const ph = (f + k + t) % 4; P.set(x, y - 3, ph === 1 ? '#fff1c8' : AMBER); if (ph !== 2) P.set(x + (ph === 3 ? 1 : 0), y - 4, ph === 1 ? AMBER : ORANGE); }
        }
      }
      for (const lx of [2, 29]) for (let y = b - 16; y <= b - 1; y++) P.set(lx, y, lx === 2 ? Bz[4] : Bz[2]);
      P.hline(1, 30, b - 1, Bz[3]);
      // offering box
      P.rect(13, b - 4, 6, 3, WALNUT[3]); P.hline(13, 18, b - 4, WALNUT[5]); P.hline(15, 16, b - 3, OUT);
      P.outline(OUT); P.shadow(17, b, 15, 1.6);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(16, b - 12, 54, [255, 170, 100], 0.8, 1), L(16, b - 6, 26, [255, 120, 110], 0.35, 1)] }, draw, 4, 6);
  });

  def('tree_planter', 1, () => {
    const W = 34, H = 62, b = H - 1, P = new Pix(W, H), R = PSTONE;
    for (let y = b - 13; y <= b - 1; y++) for (let x = 2; x <= 31; x++) {
      const lx = (x - 2) % 10;
      let k = x <= 3 ? 6 : x >= 30 ? 2 : 4;
      if (lx === 0 && x > 3) k = 3;
      const aw = archHW(3, 4, b - 7, y);
      if (lx > 0 && aw >= 0 && Math.abs(lx - 5) <= aw && y <= b - 3 && y >= b - 11) k = Math.abs(lx - 5) > aw - 1 ? (lx < 5 ? 2 : 5) : 3;
      if (y === b - 1) k = 1; if (y === b - 2) k = Math.min(k, 3);
      P.set(x, y, R[k]);
    }
    for (let y = b - 18; y <= b - 14; y++) for (let x = 1; x <= 32; x++) P.set(x, y, y === b - 18 ? R[7] : y === b - 14 ? R[3] : (x <= 2 ? R[7] : x >= 31 ? R[3] : y === b - 17 ? R[6] : R[5]));
    for (let y = b - 17; y <= b - 15; y++) for (let x = 3; x <= 30; x++) P.set(x, y, (x + y) % 5 === 0 ? '#2a3a30' : '#2a2026');
    for (let x = 4; x <= 29; x += 3) P.set(x, b - 17, LEAF[3]);
    // pale silver trunk with a little flare and bark marks
    for (let y = b - 36; y <= b - 16; y++) { const sw = Math.round(Math.sin(y * 0.22) * 0.7), wd = y > b - 21 ? 4 : 3; for (let i = 0; i < wd; i++) P.set(15 + sw + i - (wd > 3 ? 1 : 0), y, i === 0 ? SILVER[5] : i === wd - 1 ? SILVER[2] : SILVER[4]); if (y % 4 === 0) P.set(16 + sw, y, SILVER[2]); }
    // canopy: many small leaf clumps, each lit from the upper left, painted back to front
    const LV = ['#22243a', '#343a54', '#4c566e', '#6a7a90', '#8ea0b4', '#b6c6d4', '#e0eaf2'];
    const clumps = [];
    for (let k = 0; k < 40; k++) {
      const a = hash(k, 1, 71) * Math.PI * 2, rr = Math.sqrt(hash(k, 2, 71)), x = 16.5 + Math.cos(a) * rr * 12.5, y = 17 + Math.sin(a) * rr * 12;
      clumps.push([x, y, 3 + hash(k, 3, 71) * 1.8]);
    }
    clumps.sort((p, q) => p[1] - q[1]);
    for (const [ccx, ccy, r] of clumps) P.ell(ccx, ccy, r, r * 0.9, (x, y, nx, ny) => {
      const lit = -nx * 0.6 - ny * 0.8, glob = (x - 8) / 40 + (y - 6) / 34;
      let k = lit > 0.55 ? 6 : lit > 0.2 ? 5 : lit > -0.2 ? 4 : lit > -0.6 ? 3 : 2;
      k -= glob > 0.55 ? 2 : glob > 0.3 ? 1 : 0;
      P.set(x, y, LV[clamp(k, 1, 6)]);
    });
    for (const [x0, y0, x1, y1] of [[16, b - 36, 9, 27], [17, b - 37, 24, 26], [16, b - 38, 15, 22]]) P.line(x0, y0, x1, y1, SILVER[2]);
    for (let k = 0; k < 7; k++) { const x = 6 + k * 4, y0 = 27 + (k % 3); if (P.has(x, y0 - 1)) for (let j = 0; j < 2 + (k % 2); j++) P.set(x, y0 + j, j ? LV[2] : LV[3]); }
    for (let k = 0; k < 14; k++) { const x = 4 + Math.floor(hash(k, 1, 63) * 26), y = 3 + Math.floor(hash(k, 2, 63) * 24); if (P.has(x, y) && P.has(x - 1, y) && P.has(x, y + 1)) P.set(x, y, k % 4 ? '#ffffff' : MAGIC[4]); }
    P.outline(OUT); P.shadow(18, b, 15, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 2], solid: true, fade: true });
  });

  def('organ', 1, () => {
    const W = 48, H = 72, b = H - 1, R = WALNUT, S = SILVER;
    const lights = [];
    const base = new Pix(W, H), P0 = base;
    // case back and frame
    for (let y = 8; y <= b - 1; y++) for (let x = 2; x <= 45; x++) P0.set(x, y, R[1]);
    // pipes: central tower and two flats, mouths a quarter up
    const pipe = (x, yTop, yBot, w) => {
      for (let y = yTop; y <= yBot; y++) for (let i = 0; i < w; i++) { const c = i === 0 ? S[6] : i === w - 1 ? S[1] : i === 1 ? S[4] : S[3]; P0.set(x + i, y, c); }
      P0.set(x, yTop, S[5]); if (w > 2) P0.set(x + w - 1, yTop, S[2]);
      const my = yBot - Math.round((yBot - yTop) * 0.22);
      for (let i = 0; i < w; i++) { P0.set(x + i, my, OUT); P0.set(x + i, my + 1, i === 0 ? S[5] : S[2]); }
      for (let i = 1; i < w - 1; i++) P0.set(x + i, my - 1, S[2]);
      P0.set(x + Math.floor(w / 2), yBot + 1, S[2]); P0.set(x + Math.floor(w / 2), yBot + 2, S[1]);
    };
    for (let k = 0; k < 5; k++) { const x = 17 + k * 3, top = 6 + Math.abs(k - 2) * 3; pipe(x, top, 40, 3); }
    for (let k = 0; k < 5; k++) { pipe(4 + k * 2, 14 + k * 2, 40, 2); pipe(42 - k * 2, 14 + k * 2, 40, 2); }
    // case posts with crocketed pinnacles
    for (const px of [2, 15, 31, 44]) {
      for (let y = 10; y <= b - 22; y++) { P0.set(px, y, R[5]); P0.set(px + 1, y, R[3]); }
      for (let j = 0; j < 6; j++) { P0.set(px, 9 - j, j % 2 ? R[6] : R[5]); P0.set(px + 1, 9 - j, R[3]); if (j % 2 === 0) { P0.set(px - 1, 9 - j, R[4]); P0.set(px + 2, 9 - j, R[2]); } }
      P0.set(px, 2, GOLD[4]);
    }
    // pointed tracery over each flat
    for (const [x0, x1, yb] of [[4, 14, 13], [17, 30, 5], [33, 43, 13]]) {
      const hw2 = (x1 - x0) / 2, c2 = (x0 + x1) / 2;
      for (let x = x0; x <= x1; x++) P0.set(x, yb - Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((x - c2) / (hw2 + 0.5), 2))) * 3), R[5]);
    }
    // impost band, console with two manuals, stops and music desk
    for (let x = 1; x <= 46; x++) { P0.set(x, 41, R[6]); P0.set(x, 42, R[4]); P0.set(x, 43, R[2]); }
    for (let y = 44; y <= b - 1; y++) for (let x = 3; x <= 44; x++) P0.set(x, y, x === 3 ? R[5] : x === 44 ? R[1] : y >= b - 6 ? R[2] : R[3]);
    for (let y = 46; y <= 50; y++) for (let x = 18; x <= 29; x++) P0.set(x, y, y === 46 ? R[5] : PAPER[(x + y) % 3 ? 3 : 2]);
    P0.hline(19, 28, 48, PAPER[1]); P0.set(21, 47, OUT); P0.set(25, 49, OUT);
    for (const ky of [53, 56]) for (let x = 9; x <= 38; x++) { P0.set(x, ky, [1, 2, 4, 5, 6].includes(x % 7) ? '#1a1418' : '#ece4d4'); P0.set(x, ky + 1, x % 2 ? '#d8d0c0' : '#ece4d4'); P0.set(x, ky + 2, R[2]); }
    for (const sx of [5, 7, 40, 42]) for (let y = 47; y <= 55; y += 2) { P0.set(sx, y, PAPER[3]); P0.set(sx, y + 1, R[1]); }
    for (let x = 6; x <= 41; x++) { P0.set(x, b - 4, x % 3 === 0 ? R[1] : R[4]); P0.set(x, b - 3, x % 3 === 0 ? R[0] : R[3]); }
    const draw = (f) => {
      const P = base.clone();
      for (const [k, x] of [[0, 9], [1, 37]]) { P.hline(x - 1, x + 2, 50, BRASS[3]); P.set(x - 1, 50, BRASS[5]); const c = candle(P, x, 49, 4, 2, (f + k * 2) % 4); if (f === 0) lights.push(L(c.x, c.y, 28, L_CANDLE, 0.55, 1)); }
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 24, ay: b, foot: [3, 1], solid: true, wall: true }, draw, 4, 6);
    s.lights = lights;
    return s;
  });

  def('statue', 1, () => {
    const W = 20, H = 54, b = H - 1, P = new Pix(W, H), M = MARBLE, R = PSTONE;
    for (let y = b - 12; y <= b - 1; y++) for (let x = 2; x <= 17; x++) P.set(x, y, y === b - 12 ? R[7] : y === b - 11 ? R[5] : y === b - 1 ? R[1] : y === b - 2 ? R[6] : x <= 3 ? R[6] : x >= 16 ? R[2] : R[4]);
    for (const [x, y] of [[9, -8], [8, -7], [8, -6], [9, -5], [10, -9], [10, -4]]) P.set(x, b + y, R[2]);
    veiledFigure(P, 10, 3, 38, M, 'clasp');
    P.outline(OUT); P.shadow(12, b, 8, 2);
    return sprite({ c: P.canvas(), ax: 10, ay: b, foot: [1, 1], solid: true, fade: true });
  });

  def('lectern', 1, () => {
    const W = 16, H = 32, b = H - 1, P = new Pix(W, H), Bz = BRASS;
    for (let y = b - 3; y <= b - 1; y++) for (let x = 3; x <= 12; x++) P.set(x, y, y === b - 3 ? Bz[5] : x < 5 ? Bz[4] : x > 10 ? Bz[2] : Bz[3]);
    for (let y = 15; y <= b - 4; y++) { P.set(7, y, y % 4 === 0 ? Bz[5] : Bz[4]); P.set(8, y, Bz[2]); }
    P.ell(7.5, 14, 2, 1.8, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.4 ? Bz[5] : Bz[3]));
    // brass eagle on the orb, wings raised to bear the book, head and hooked beak looking out to the left
    P.ell(7.5, 11.5, 2.4, 2.2, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.5 ? Bz[5] : nx + ny < 0.4 ? Bz[4] : Bz[2]));
    for (const side of [-1, 1]) for (let t = 0; t < 6; t++) { const x = 7.5 + side * (2 + t), y = 10 - t * 0.5; P.set(x, y, side < 0 ? Bz[5] : Bz[3]); P.set(x, y + 1, side < 0 ? Bz[4] : Bz[2]); if (t > 2) P.set(x, y + 2, side < 0 ? Bz[3] : Bz[1]); }
    P.set(6, 9, Bz[5]); P.set(5, 9, Bz[4]); P.set(4, 9, Bz[3]); P.set(3, 10, GOLD[2]); P.set(5, 8, OUT);
    // the open book, ribbon hanging
    for (let x = 2; x <= 13; x++) { const mid = x === 7 || x === 8; for (let y = 4; y <= 8; y++) P.set(x, y, y === 8 ? WINE[2] : mid ? PAPER[1] : y === 4 ? PAPER[4] : PAPER[3]); P.set(x, 3, x === 2 || x === 13 || mid ? null : PAPER[4]); }
    for (const [x0, x1] of [[3, 6], [9, 12]]) for (const y of [5, 7]) P.hline(x0, x1 - (y === 7 ? 1 : 0), y, PAPER[1]);
    P.vline(10, 9, 12, CRIMSON[4]); P.set(10, 13, CRIMSON[3]);
    P.outline(OUT); P.shadow(9, b, 5.5, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('font', 1, () => {
    const W = 16, H = 26, b = H - 1, R = PSTONE;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let y = b - 3; y <= b - 1; y++) for (let x = 3; x <= 12; x++) P.set(x, y, y === b - 3 ? R[7] : x < 5 ? R[6] : x > 10 ? R[2] : R[4]);
      for (let y = b - 9; y <= b - 4; y++) for (let x = 6; x <= 9; x++) P.set(x, y, x === 6 ? R[6] : x === 9 ? R[2] : R[4]);
      // octagonal basin, three facets with carved quatrefoils
      for (let y = b - 16; y <= b - 10; y++) { const ins = y > b - 12 ? b - 12 - y + 2 : 0; for (let x = 1 + ins; x <= 14 - ins; x++) { const fac = x < 5 ? 0 : x < 11 ? 1 : 2; P.set(x, y, R[[6, 4, 2][fac] + (y === b - 16 ? 1 : 0)]); } }
      for (const qx of [7.5]) { P.set(qx - 0.5, b - 14, R[2]); P.set(qx + 0.5, b - 14, R[2]); P.set(qx, b - 15, R[2]); P.set(qx, b - 13, R[2]); }
      P.ell(7.5, b - 17, 6.6, 2.2, (x, y) => P.set(x, y, R[7]));
      const WT = ['#4a6aa8', '#7aa6e0', '#b4d8ff', '#e8f6ff'];
      P.ell(7.5, b - 17.2, 5.2, 1.4, (x, y, nx, ny) => P.set(x, y, ny < -0.2 ? WT[1] : nx * nx + ny * ny < 0.3 ? WT[3] : WT[2]));
      const sp = [[5, -17], [9, -18], [7, -16], [10, -17]];
      sp.forEach(([x, dy], k) => { if ((f + k) % 3 === 0) P.set(x, b + dy, '#ffffff'); });
      P.outline(OUT); P.shadow(9, b, 6, 1.5);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, b - 18, 40, [160, 210, 255], 0.65)] }, draw, 3, 3);
  });

  def('banner', 3, (v) => {
    const W = 16, H = 80, P = new Pix(W, H), C = [VIOLET.slice(1), MIDNIGHT, CRIMSON][v], G = GOLD;
    P.set(7, 4, IRON[4]); P.set(8, 4, IRON[2]); P.line(3, 9, 7, 5, G[2]); P.line(12, 9, 8, 5, G[2]);
    for (let x = 1; x <= 14; x++) { P.set(x, 9, x < 3 || x > 12 ? G[5] : G[4]); P.set(x, 10, G[2]); }
    P.set(0, 9, G[3]); P.set(15, 9, G[2]);
    for (let y = 11; y <= 58; y++) {
      const tipD = y > 50 ? y - 50 : 0;
      for (let x = 3; x <= 12; x++) {
        if (tipD && Math.abs(x - 7.5) > 5 - tipD * 0.62) continue;
        let k = x === 3 ? 4 : x === 12 ? 1 : (x === 6 || x === 9) ? 2 : 3;
        let c = C[k];
        if (x === 3 || x === 12 || (tipD && Math.abs(Math.abs(x - 7.5) - (5 - tipD * 0.62)) < 0.7)) c = G[3];
        P.set(x, y, c);
      }
    }
    P.set(7, 59, G[4]); P.set(8, 59, G[3]); P.set(7, 60, G[3]); P.set(8, 61, G[2]);
    const CR = ['..###.', '.##...', '##....', '##....', '##....', '.##...', '..###.'];
    for (let j = 0; j < 7; j++) for (let i = 0; i < 6; i++) if (CR[j][i] === '#') P.set(5 + i, 22 + j, i < 2 ? SILVER[6] : SILVER[4]);
    P.set(9, 21, G[5]); P.set(10, 20, G[4]); P.set(9, 30, G[4]);
    for (let y = 36; y <= 46; y += 5) { P.set(7, y, G[3]); P.set(8, y, G[2]); }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: H - 1, foot: [1, 1], solid: true, wall: true });
  });

  def('chandelier_iron', 1, () => {
    const W = 42, H = 38, b = H - 1, I = IRON, cx = 20.5, cy = 28, rx = 17, ry = 4.5;
    const pts = []; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, Math.sin(a)]); }
    const draw = (f) => {
      const P = new Pix(W, H);
      P.ell(cx, 1.5, 1.6, 1.4, (x, y) => P.set(x, y, I[4]));
      for (const [ex, ey] of [[cx - rx + 2, cy - 2], [cx + rx - 2, cy - 2], [cx - 6, cy - 4], [cx + 6, cy - 4]]) { const n = 26; for (let t = 0; t <= n; t++) { const x = cx + (ex - cx) * t / n, y = 3 + (ey - 3) * t / n; P.set(x, y, t % 2 ? I[4] : I[2]); } }
      // back half of the ring first, candles in between, then the front half
      const ring = (front) => P.ell(cx, cy, rx, ry, (x, y, nx, ny) => { const d = nx * nx + ny * ny; if (d < 0.72) return; if ((ny > 0) !== front) return; P.set(x, y, ny < 0 ? I[3] : nx < -0.3 ? I[5] : I[4]); });
      ring(false);
      pts.filter((p) => p[2] < 0).forEach(([x, y], k) => { P.hline(Math.round(x) - 1, Math.round(x) + 1, Math.round(y) - 1, I[4]); candle(P, Math.round(x), Math.round(y) - 2, 4, 1, (f + k) % 4); });
      ring(true);
      pts.filter((p) => p[2] >= 0).forEach(([x, y], k) => { P.hline(Math.round(x) - 1, Math.round(x) + 1, Math.round(y) - 1, I[5]); candle(P, Math.round(x), Math.round(y) - 2, 5, 2, (f + k + 2) % 4); });
      P.set(cx, cy + 5, I[4]); P.set(cx, cy + 6, I[3]); P.set(cx, cy + 7, GOLD[3]);
      P.outline(OUT);
      return P;
    };
    return build({ ax: 21, ay: b, foot: [1, 1], solid: false, overhead: true, lights: [L(20.5, 22, 74, L_CANDLE, 0.85, 1), L(6, 24, 30, L_CANDLE, 0.35, 1), L(35, 24, 30, L_CANDLE, 0.35, 1)] }, draw, 4, 7);
  });

  def('glass_bench', 1, () => {
    const W = 32, H = 34, b = H - 1, R = WALNUT;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (const lx of [2, 28]) for (let y = b - 12; y <= b - 1; y++) { P.set(lx, y, R[5]); P.set(lx + 1, y, R[3]); }
      for (let x = 2; x <= 29; x++) { P.set(x, b - 5, R[4]); P.set(x, b - 4, R[2]); }
      for (const [gx, C] of [[6, GL.azure], [9, GL.rose], [12, GL.gold], [15, GL.emerald]]) { P.set(gx, b - 6, C[3]); P.set(gx + 1, b - 6, C[2]); P.set(gx + 2, b - 6, C[4]); }
      for (let x = 1; x <= 30; x++) { P.set(x, b - 16, R[5]); P.set(x, b - 15, R[4]); P.set(x, b - 14, R[6]); P.set(x, b - 13, R[3]); }
      // stack of coloured panes leaning on the wall behind
      const panes = [[3, 11, GL.rose], [6, 13, GL.azure], [9, 10, GL.gold], [12, 12, GL.emerald]];
      for (const [px, h, C] of panes) for (let y = b - 16 - h; y <= b - 17; y++) for (let i = 0; i < 3; i++) P.set(px + i, y, i === 0 ? C[4] : i === 1 ? C[3] : C[2]);
      // a leaded panel in progress
      for (let y = b - 20; y <= b - 17; y++) for (let x = 15; x <= 23; x++) { const lead = (x - 15) % 3 === 0 || y === b - 20; P.set(x, y, lead ? '#3a3448' : [GL.rose[3], GL.gold[3], GL.azure[3], GL.violet[3]][((x - 15) / 3 | 0) + (y % 2)]); }
      P.line(18, b - 18, 21, b - 21, SILVER[3]); P.set(22, b - 22, WOOD[3]);
      // crucible on a little brazier
      P.rect(25, b - 19, 5, 3, IRON[3]); P.hline(25, 29, b - 19, IRON[4]);
      P.ell(27, b - 22, 2.4, 2.2, (x, y, nx) => P.set(x, y, nx < 0 ? TERRA[3] : TERRA[1]));
      const glowC = [['#fff1c8', '#ffbc62'], ['#ffe0a0', '#e8843c'], ['#fff8e4', '#ffbc62']][f % 3];
      P.hline(26, 28, b - 24, glowC[1]); P.set(27, b - 24, glowC[0]); P.set(26 + (f % 3), b - 25, f === 1 ? ORANGE : AMBER);
      P.set(26, b - 18, ORANGE); P.set(28, b - 18, EMBERC);
      P.outline(OUT); P.shadow(17, b, 15, 1.6);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(27, b - 23, 46, [255, 140, 60], 0.8, 1)] }, draw, 3, 4);
  });

  // ================================================================== round 2 pieces
  const BONE = ['#4a4458', '#7e7688', '#b0a8b0', '#d8d0cc', '#f2ece6'];
  const TEDDY = ['#4a2a1a', '#6e4428', '#946038', '#b8804e', '#d8a46e', '#f0c896'];
  const TEDDY_PINK = ['#6a2e46', '#94485e', '#c06a84', '#e092aa', '#f4bccc', '#fcdce6'];
  const TEDDY_CREAM = ['#6e5e54', '#948070', '#b8a08a', '#d4bea4', '#eadac2', '#faf0e0'];
  const MINT = ['#2e5a50', '#467a6c', '#62988a', '#84b6a8', '#a8d2c4', '#d0ece2'];
  const HONEYG = ['#5a2e08', '#8a4e10', '#c07818', '#e8a030', '#ffc860', '#fff0b0'];
  const TANL = ['#3e2a2a', '#5e3a2c', '#86553a', '#ae7650', '#cc9a6c', '#e8c098'];
  const BLACKW = ['#120c18', '#1e1626', '#2e2438', '#3e3250', '#54466c'];
  const VIOW = ['#2e1a52', '#4a2f7a', '#6a47a8', '#8f6cd1', '#b99aee'];
  const RUNE_C = '#3fe0d0', RUNE_RGB = [80, 230, 220];
  function stamp(P, x, y, rows, pal) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const c = pal[rows[j][i]]; if (c) P.set(x + i, y + j, typeof c === 'function' ? c(i, j) : c); } }
  function skull5(P, x, y) { stamp(P, x, y, ['.###.', '#####', '#o#o#', '##.##', '.#=#.'], { '#': (i) => (i < 2 ? PAPER[3] : PAPER[2]), o: '#1a1016', '=': PAPER[1] }); }
  const TEDDY_MAP = ['.e...e.', '.hhhhh.', '.hdhdh.', '.hmnmh.', 'abbrbba', '.bbbbb.', '.bbbbb.', 'ff...ff'];
  function teddy(P, x, y, R, ribbon) { // 7x8 seated plush bear, (x, y) = top-left
    for (let j = 0; j < 8; j++) for (let i = 0; i < 7; i++) {
      const ch = TEDDY_MAP[j][i]; if (ch === '.') continue;
      let c = i <= 3 ? R[3] : R[2];
      if (j === 1 && i <= 3) c = R[4];
      if (ch === 'e') c = R[2];
      if (ch === 'd' || ch === 'n') c = '#2a1810';
      if (ch === 'm' || ch === 'f') c = R[4];
      if (ch === 'a') c = i === 0 ? R[3] : R[1];
      if (ch === 'r') c = ribbon || PINK[3];
      P.set(x + i, y + j, c);
    }
  }
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const NOTE = [[1, 0], [2, 0], [1, 1], [1, 2], [0, 2], [0, 3], [1, 3]];
  // the Silver Crescent crest: crossed blades over a crescent, centred at (cx, cy) (about 11x11)
  function crest(P, cx, cy, blade, moon, hilt) {
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (Math.hypot(x, y - 1.4) <= 4.8 && Math.hypot(x, y + 0.6) > 4.0) P.set(cx + x, cy + y, x < 0 ? moon[1] : moon[0]);
    for (const sd of [1, -1]) { // blade from its tip (top) down to a cross-guard, grip and pommel
      for (let t = 0; t <= 7; t++) P.set(cx - sd * 4 + sd * t, cy - 5 + t, t < 2 ? blade[1] : sd > 0 ? blade[0] : blade[2]);
      P.set(cx + sd * 4, cy + 1, hilt[0]); P.set(cx + sd * 2, cy + 3, hilt[0]); P.set(cx + sd * 3, cy + 2, hilt[1]);
      P.set(cx + sd * 4, cy + 3, '#5a3a2a'); P.set(cx + sd * 5, cy + 4, hilt[1]);
    }
  }
  // a 2x2 bed seen from its foot: pillows, folded sheet, quilt (fn), quilt hanging over the foot, legs
  function bedBody(P, b, pillowR, quiltFn, legC) {
    for (const [x0, x1] of [[4, 14], [17, 27]]) {
      for (let y = b - 36; y <= b - 30; y++) for (let x = x0; x <= x1; x++) {
        if ((y === b - 36 || y === b - 30) && (x === x0 || x === x1)) continue;
        const edge = y === b - 36 || y === b - 30 || x === x0 || x === x1;
        P.set(x, y, edge ? pillowR[1] : (x - x0 < 4 && y < b - 32) ? pillowR[4] : pillowR[3]);
      }
      P.set(x0 + 2, b - 34, pillowR[5]);
    }
    for (let x = 2; x <= 29; x++) { P.set(x, b - 30, '#e2dae2'); P.set(x, b - 29, '#b4aabc'); }
    for (let y = b - 28; y <= b - 2; y++) for (let x = 2; x <= 29; x++) {
      let c = quiltFn(x, y, (x - 2) / 27);
      if (y >= b - 7) c = mix(c, '#120c1c', y === b - 7 ? 0.08 : 0.3);
      if (y === b - 2 && x % 3 === 0) continue; // scalloped hem
      P.set(x, y, c);
    }
    for (const lx of [2, 3, 28, 29]) P.set(lx, b - 1, legC);
  }
  function quiltPatch(b, patch) {
    return (x, y, rx) => {
      const qx = Math.floor((x - 2) / 7), qy = Math.floor((y - (b - 28)) / 6), lx = (x - 2) % 7, ly = ((y - (b - 28)) % 6 + 6) % 6;
      let c = patch(qx, qy, lx, ly);
      if ((lx === 0 || ly === 0) && (x + y) % 2 === 0) c = mix(c, '#ffffff', 0.32); // stitching
      if (rx < 0.07) c = mix(c, '#ffffff', 0.1); else if (rx > 0.93) c = mix(c, '#120c1c', 0.25);
      return c;
    };
  }

  // ------------------------------------------------------------------ Laura's room (alt)
  def('alt_bed', 1, () => {
    const W = 32, H = 48, b = H - 1, P = new Pix(W, H);
    const railY = (x) => 9 - Math.round(4 * (1 - Math.pow((x - 15.5) / 13.5, 2)));
    for (let x = 3; x <= 28; x++) { const ry = railY(x); P.set(x, ry, IRON[5]); P.set(x, ry + 1, IRON[2]); if ((x - 3) % 3 === 0) for (let y = ry + 2; y <= b - 31; y++) P.set(x, y, x < 16 ? IRON[4] : IRON[3]); }
    for (let x = 3; x <= 28; x++) P.set(x, b - 31, IRON[3]);
    for (const [px, lit] of [[1, true], [29, false]]) { for (let y = 3; y <= b - 28; y++) { P.set(px, y, lit ? IRON[5] : IRON[3]); P.set(px + 1, y, lit ? IRON[3] : IRON[1]); } P.set(px, 2, IRON[4]); P.set(px + 1, 2, IRON[2]); P.set(px + (lit ? 0 : 1), 1, MAGIC[2]); P.set(px + (lit ? 0 : 1), 0, MAGIC[3]); }
    stamp(P, 11, 1, ['...e.e...', 'w..bbb..w', 'ww.kbk.ww', 'wwwbbbwww', '.w..b..w.'], { e: IRON[4], b: IRON[4], w: (i) => (i < 4 ? IRON[5] : IRON[3]), k: MAGIC[3] });
    bedBody(P, b, ['#120c18', '#2a2236', '#3a3048', '#4a3e5c', '#5e5274', '#8a7aa6'],
      quiltPatch(b, (qx, qy, lx, ly) => { const t = hash(qx, qy, 31); let c = t < 0.33 ? '#2a1638' : t < 0.66 ? '#22122e' : '#361e4c'; if (t > 0.78 && lx === 3 && ly === 3) c = '#b99aee'; if (t > 0.78 && lx === 4 && ly === 2) c = '#8f6cd1'; return c; }), IRON[2]);
    // bat plush flopped on the quilt
    stamp(P, 19, b - 27, ['...e.e...', 'w..bbb..w', 'ww.kbk.ww', 'wwwbbbwww', '.w..b..w.'], { e: '#8a78aa', b: (i) => (i < 4 ? '#b0a0d0' : '#9888b8'), w: (i) => (i < 4 ? '#9a88bc' : '#7a689c'), k: '#f0a0c8' });
    P.outline(OUT); P.shadow(17, b, 15, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 2], solid: true });
  });

  def('record_player', 1, () => {
    const W = 16, H = 26, b = H - 1, R = WALNUT;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let y = b - 9; y <= b - 2; y++) for (let x = 1; x <= 14; x++) { let c = x === 1 ? R[5] : x === 14 ? R[2] : R[3]; if (x >= 3 && x <= 12 && y >= b - 8 && y <= b - 4) c = (x % 2) ? '#3a2a50' : '#2a1e3a'; P.set(x, y, c); }
      P.set(2, b - 1, R[3]); P.set(13, b - 1, R[1]);
      for (let y = b - 13; y <= b - 10; y++) for (let x = 1; x <= 14; x++) P.set(x, y, y === b - 13 || x === 1 ? R[6] : R[5]);
      for (let y = b - 20; y <= b - 14; y++) for (let x = 2; x <= 13; x++) { const d = (x - 2) - (b - 14 - y); P.set(x, y, d === 3 || d === 4 ? '#8a80a6' : '#3a3450'); }
      P.ell(6.5, b - 11.6, 4.6, 1.5, (x, y, nx, ny) => P.set(x, y, Math.round((nx * nx + ny * ny) * 6) % 2 ? '#241a2e' : '#120c16'));
      P.set(6, b - 12, MAGIC[3]); P.set(7, b - 12, MAGIC[2]);
      const hl = [[3, b - 12], [9, b - 11], [10, b - 12], [4, b - 11]][f];
      P.set(hl[0], hl[1], '#7a6a98');
      P.set(12, b - 13, SILVER[5]); P.line(12, b - 12, 9, b - 11, SILVER[4]); P.set(13, b - 11, SILVER[3]);
      P.outline(OUT);
      const ny = b - 22 - f;
      for (const [dx, dy] of NOTE) if (!P.has(13 + dx, ny + dy)) P.set(13 + dx, ny + dy, f === 3 ? MAGIC[3] : MAGIC[4]);
      P.shadow(9, b, 6, 1.5);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true }, draw, 4, 4);
  });

  def('vinyl_crate', 1, () => {
    const W = 16, H = 20, b = H - 1, P = new Pix(W, H), R = HONEY;
    const SL = [MAGIC[2], '#e89ab8', '#3a3048', ORANGE, '#5dcf9a', '#c44a3a', '#f2c45a', '#4a64a0', '#d8d4e8', '#8c3a62'];
    P.ell(7.5, b - 14, 3, 3, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny < 0.2 ? MAGIC[3] : (Math.round((nx * nx + ny * ny) * 5) % 2 ? '#241a2e' : '#120c16'))); // a record pulled halfway out
    for (let i = 0; i < 11; i++) { const x = 2 + i, top = b - 13 + Math.floor(hash(i, 1, 61) * 3), c = SL[Math.floor(hash(i, 2, 61) * SL.length)]; for (let y = top; y <= b - 8; y++) P.set(x, y, y === top ? mix(c, '#ffffff', 0.3) : i % 2 ? c : mix(c, '#120c1c', 0.22)); }
    for (let y = b - 8; y <= b - 1; y++) for (let x = 1; x <= 14; x++) { let c = y === b - 5 ? R[1] : x === 1 ? R[5] : x === 14 ? R[2] : R[4]; if (y === b - 8) c = R[6]; P.set(x, y, c); }
    P.rect(4, b - 4, 5, 2, PAPER[3]); P.set(5, b - 4, MAGIC[2]); P.set(6, b - 3, MAGIC[1]); P.set(7, b - 4, MAGIC[2]);
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('band_poster', 2, (v) => {
    const W = 16, H = 48, P = new Pix(W, H), x0 = 1, y0 = 8, x1 = 14, y1 = 28;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let c;
      if (v === 0) c = (x === x0 + 1 || x === x1 - 1 || y === y0 + 1 || y === y1 - 1) ? '#6a47a8' : '#16101c';
      else c = rampAt(['#241238', '#3a1a4e', '#5a2462', '#8c3a72'], (y - y0) / (y1 - y0), x, y);
      P.set(x, y, c);
    }
    if (v === 0) {
      for (let a = 0; a < 30; a++) { const t = Math.PI * (0.85 + a / 30 * 0.95); const ax = 7.5 + Math.cos(t) * 5.6, ay = 17 + Math.sin(t) * 5.6; P.set(ax, ay, '#d8d0f0'); P.set(ax + 0.7, ay + 0.7, '#8f6cd1'); }
      stamp(P, 4, 13, ['..####..', '.######.', '########', '#oo##oo#', '#oo##oo#', '.###o##.', '..####..', '..#.#.#.'], { '#': (i) => (i < 4 ? BONE[4] : BONE[3]), o: '#16101c' });
      for (let x = 3; x <= 12; x++) if (x % 3 !== 2) { P.set(x, 23, MAGIC[3]); if (x < 11) P.set(x, 25, MAGIC[1]); }
    } else {
      P.ell(9, 14, 4.2, 4.2, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.4 ? '#fcd6e4' : '#e89ab8'));
      stamp(P, 3, 13, ['....#...', '...##...', '...###..', '..####..', '.#####..', '#######.', '########'], { '#': '#120c18' });
      for (let x = x0; x <= x1; x++) { P.set(x, 21, '#120c18'); P.set(x, 20, x > 9 ? '#120c18' : P.get(x, 20)); }
      for (let x = 3; x <= 12; x++) if (x % 4 !== 3) { P.set(x, 24, '#f6dc8a'); if (x > 4 && x < 11) P.set(x, 26, '#e8b8c8'); }
    }
    P.set(x1, y1, '#d8c8b8'); P.set(x1 - 1, y1, '#b8a898'); P.set(x1, y1 - 1, '#b8a898'); // curled corner
    P.outline(OUT);
    for (const [tx, ty] of [[x0, y0], [x1 - 1, y0]]) { P.set(tx, ty - 1, '#e8dcb0'); P.set(tx + 1, ty - 1, '#e8dcb0'); P.set(tx, ty, '#d8c890'); }
    return sprite({ c: P.canvas(), ax: 8, ay: H - 1, foot: [1, 1], solid: true, wall: true });
  });

  def('fairy_lights', 1, () => {
    const W = 32, H = 48, cols = ['#fff1c8', '#ffb0d0', '#c8a0ff', '#ffd27a'];
    const wireY = (x) => 6 + Math.round(6 * Math.sin(((x % 16) / 16) * Math.PI));
    const bulbs = []; for (let x = 2; x < W - 1; x += 3) bulbs.push([x, wireY(x) + 1]);
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let x = 0; x < W; x++) P.set(x, wireY(x), '#2e2640');
      for (const hx of [0, 16, 31]) { P.set(hx, 5, IRON[5]); P.set(hx, 4, IRON[3]); }
      bulbs.forEach(([x, y], k) => { const c = cols[k % 4], on = (k + f) % 4 !== 0; P.set(x, y - 1, '#4a3e5c'); P.set(x, y, on ? c : mix(c, '#2e2640', 0.55)); P.set(x, y + 1, on ? mix(c, '#ffffff', 0.55) : mix(c, '#2e2640', 0.7)); });
      return P;
    };
    return build({ ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true, lights: [L(6, 12, 30, [255, 190, 220], 0.4, 1), L(16, 8, 28, [210, 170, 255], 0.38, 1), L(26, 12, 30, [255, 214, 160], 0.4, 1)] }, draw, 4, 3);
  });

  def('lace_window', 1, () => {
    const W = 32, H = 48;
    const draw = (f, night) => {
      const P = new Pix(W, H);
      for (let y = 7; y <= 30; y++) for (let x = 6; x <= 25; x++) {
        const fr = x === 6 || x === 25 || y === 7 || y === 30 || x === 15 || x === 16 || y === 18;
        P.set(x, y, fr ? (x === 6 || y === 7 ? CHAR[5] : CHAR[3]) : sky(x, y, 8, 29, night, 41));
      }
      if (night) { P.ell(21, 11.5, 2.2, 2.2, (x, y, nx, ny) => P.set(x, y, nx + ny > 0.6 ? '#c8d4f0' : '#eef2ff')); P.set(22, 12, '#b8c4e0'); }
      for (let x = 4; x <= 27; x++) { P.set(x, 31, CHAR[5]); P.set(x, 32, CHAR[3]); }
      for (let x = 1; x <= 30; x++) P.set(x, 4, CHAR[4]);
      P.set(0, 4, MAGIC[2]); P.set(31, 4, MAGIC[2]); P.set(0, 3, MAGIC[3]); P.set(31, 3, MAGIC[1]);
      P.outline(OUT);
      // black lace curtains, gathered with violet ribbons (drawn after the outline so the lace stays open)
      const curtain = (xa, xb, left) => {
        for (let y = 5; y <= 34; y++) {
          const tie = 22, dist = Math.abs(y - tie), wd = y < tie ? Math.round((xb - xa) * (1 - 0.45 * Math.max(0, 1 - (tie - y) / 14))) : Math.round((xb - xa) * (0.55 + Math.min(1, dist / 10) * 0.45));
          for (let i = 0; i <= wd; i++) {
            const x = left ? xa + i : xb - i, hole = ((x + y) % 4 === 0 && y % 2 === 0) || ((x * 3 + y * 2) % 9 === 0);
            if (y === 34 && (x % 2)) continue;
            if (!hole || i === wd) P.set(x, y, i === wd ? CHAR[4] : (i + y) % 3 === 0 ? CHAR[3] : CHAR[1]);
          }
        }
        const tx = left ? xa + 4 : xb - 4; P.set(tx, 22, MAGIC[3]); P.set(tx - 1, 22, MAGIC[2]); P.set(tx + 1, 22, MAGIC[2]); P.set(tx, 23, MAGIC[1]);
      };
      curtain(1, 10, true); curtain(21, 30, false);
      return P;
    };
    const s = build({ ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true, lights: [L(16, 18, 42, [214, 200, 240], 0.45)] }, draw, 1, 0, true);
    s.nLights = [L(16, 18, 34, [140, 160, 255], 0.35)];
    return s;
  });

  def('skull_planter', 1, () => {
    const W = 16, H = 25, b = H - 1, P = new Pix(W, H);
    const leaves = [[-6, -6], [-4, -10], [-1, -13], [2, -12], [5, -9], [6, -5], [0, -8]];
    leaves.forEach(([dx, dy], k) => { for (let t = 0; t <= 1.0001; t += 0.09) { const x = 7.5 + dx * t, y = b - 10 + dy * t; P.set(x, y, t > 0.82 ? MAGIC[k % 2 ? 2 : 3] : k % 2 ? LEAF[4] : LEAF[3]); if (t < 0.55) P.set(x + (dx > 0 ? -1 : 1), y, LEAF[2]); } });
    P.hline(4, 11, b - 10, '#2a2020');
    stamp(P, 3, b - 9, ['##########', '##########', '#oo####oo#', '#ooo##ooo#', '.###oo###.', '..######..', '..#.##.#..', '..######..', '...####...'], { '#': (i) => (i < 3 ? BONE[4] : i < 7 ? BONE[3] : BONE[2]), o: '#2a1e2e' });
    P.set(5, b - 7, '#5a4a6a'); P.set(11, b - 7, '#5a4a6a');
    P.outline(OUT); P.shadow(9, b, 6, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('guitar_stand', 1, () => {
    const W = 16, H = 33, b = H - 1, P = new Pix(W, H);
    P.line(4, b - 1, 7, b - 9, IRON[4]); P.line(11, b - 1, 8, b - 9, IRON[2]); P.hline(5, 10, b - 9, IRON[3]);
    for (let y = 4; y <= b - 19; y++) { P.set(7, y, (y % 4 === 0) ? '#d8d0cc' : '#3a2a2a'); P.set(8, y, '#2a1e1e'); }
    for (let y = 5; y <= b - 19; y++) P.set(8, y, y % 2 ? '#8a8098' : '#2a1e1e');
    stamp(P, 6, 0, ['.##.', 's##s', 's##s', '.##.'], { '#': '#1a1420', s: SILVER[4] });
    stamp(P, 3, b - 18, ['#........#', '##......##', '###....###', '##########', '##########', '.########.', '.########.', '##########', '##########', '.########.', '..######..'],
      { '#': (i, j) => (i <= 1 || (j < 3 && i < 3) ? '#4a3e5e' : i >= 8 ? '#120c18' : '#1e1626') });
    for (let j = 3; j <= 8; j++) for (let i = 6; i <= 9; i++) if (i + j > 10) P.set(3 + i, b - 18 + j, '#6a47a8');
    P.hline(8, 9, b - 15, SILVER[5]); P.hline(8, 9, b - 12, SILVER[5]); P.hline(8, 10, b - 10, SILVER[3]);
    P.set(10, b - 9, SILVER[4]); P.set(11, b - 10, SILVER[4]);
    P.outline(OUT); P.shadow(9, b, 5, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('vanity_dark', 1, () => {
    const W = 32, H = 42, b = H - 1, P = new Pix(W, H), R = WALNUT;
    // sunburst-spiked mirror
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; for (let t = 8.6; t < 11; t += 0.5) P.set(16 + Math.cos(a) * t * 0.85, b - 26 + Math.sin(a) * t, k % 2 ? IRON[3] : IRON[5]); }
    P.ell(16, b - 26, 7.2, 8.6, (x, y, nx, ny) => { const d = nx * nx + ny * ny; if (d > 0.74) P.set(x, y, nx + ny < 0 ? IRON[5] : IRON[2]); else { const sheen = Math.abs((nx - ny) * 4 - 1) < 0.35; P.set(x, y, sheen ? '#8a7aae' : rampAt(['#1e1630', '#2a2042', '#3a2e58'], 0.9 - (ny + 1) / 2, x, y)); } });
    P.set(16, b - 36, MAGIC[3]); P.set(16, b - 37, MAGIC[2]);
    // table top, drawers with spiked knobs, curved legs
    for (let x = 1; x <= 30; x++) { P.set(x, b - 17, R[4]); P.set(x, b - 16, R[5]); P.set(x, b - 15, R[5]); P.set(x, b - 14, R[6]); }
    for (let y = b - 13; y <= b - 9; y++) for (let x = 2; x <= 29; x++) { const lx = x === 2 || x === 11 || x === 20 || x === 29; P.set(x, y, lx ? R[1] : y === b - 13 ? R[2] : R[3]); }
    for (const kx of [6, 15, 24]) { P.set(kx, b - 11, SILVER[5]); P.set(kx + 1, b - 11, SILVER[3]); P.set(kx, b - 12, SILVER[4]); }
    for (const [lx, d] of [[2, -1], [29, 1]]) for (let y = b - 8; y <= b - 1; y++) P.set(lx + (y > b - 3 ? d : 0), y, R[d < 0 ? 4 : 2]);
    // perfume, a spiked choker on its stand, a tiny skull, lipstick
    bottle(P, 3, b - 18, 0, 'violet', false, 0.8); bottle(P, 8, b - 18, 3, 'wine', false, 0.7);
    P.vline(25, b - 23, b - 18, IRON[4]); P.hline(23, 27, b - 18, IRON[3]);
    for (let x = 22; x <= 28; x++) { const y = b - 23 + Math.round(Math.pow((x - 25) / 3, 2) * 2); P.set(x, y, '#1a1420'); if (x % 2 === 0) P.set(x, y - 1, SILVER[5]); }
    skull5(P, 15, b - 22);
    P.set(12, b - 19, PLUM[3]); P.set(12, b - 18, SILVER[3]);
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('candle_cluster', 1, () => {
    const W = 16, H = 24, b = H - 1;
    const cs = [[3, 8, 2, BLACKW], [6, 5, 1, WAX], [8, 11, 2, VIOW], [11, 4, 2, WAX], [13, 7, 1, BLACKW]];
    const draw = (f) => {
      const P = new Pix(W, H);
      P.ell(8, b - 2, 7, 1.6, (x, y, nx, ny) => P.set(x, y, ny < 0 ? IRON[4] : IRON[2]));
      for (const [x, y, c] of [[2, b - 2, WAX[3]], [5, b - 3, BLACKW[3]], [10, b - 2, VIOW[3]], [12, b - 3, WAX[2]]]) P.set(x, y, c);
      cs.forEach(([x, h, w, R], k) => candle(P, x, b - 3, h, w, (f + k) % 4, 'warm', 1, R));
      P.outline(OUT); P.shadow(9, b, 6, 1.4);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(8, b - 13, 46, L_CANDLE, 0.75, 1)] }, draw, 4, 7);
  });

  // ------------------------------------------------------------------ Jasmine's cottage (pastel)
  def('bear_bed', 1, () => {
    const W = 32, H = 48, b = H - 1, P = new Pix(W, H), WD = CREAM;
    for (let y = 2; y <= b - 30; y++) for (let x = 2; x <= 29; x++) { // painted headboard with a scalloped top
      const top = 5 - Math.round(3 * Math.abs(Math.sin(((x - 2) / 27) * Math.PI * 1.5)));
      if (y < top) continue;
      P.set(x, y, y === top ? WD[5] : x <= 3 ? WD[5] : x >= 28 ? WD[2] : WD[4]);
    }
    for (const [px, lit] of [[1, true], [30, false]]) { for (let y = 3; y <= b - 27; y++) P.set(px, y, lit ? WD[5] : WD[2]); P.ell(px, 2, 1.4, 1.4, (x, y) => P.set(x, y, lit ? WD[5] : WD[3])); }
    stamp(P, 12, 7, HEART, { '#': (i, j) => (i < 3 && j < 2 ? PINK[4] : PINK[3]) });
    bedBody(P, b, ['#c8b0b8', '#e0ccd2', '#f0e2e6', '#f8eef0', '#ffffff', '#ffffff'],
      quiltPatch(b, (qx, qy, lx, ly) => {
        if ((qx + qy) % 2 === 0) { const gx = (lx >> 1) & 1, gy = (ly >> 1) & 1; return gx && gy ? PINK[2] : gx || gy ? PINK[3] : CREAM[5]; }
        if ((ly === 2 && (lx === 2 || lx === 4)) || (ly === 3 && lx >= 2 && lx <= 4) || (ly === 4 && lx === 3)) return PINK[3];
        return CREAM[4];
      }), WD[2]);
    teddy(P, 5, b - 35, TEDDY, PINK[3]); teddy(P, 19, b - 34, TEDDY_PINK, MINT[4]); teddy(P, 12, b - 23, TEDDY_CREAM, PINK[3]);
    P.outline(OUT); P.shadow(17, b, 15, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 2], solid: true });
  });

  def('giant_bear', 1, () => {
    const W = 22, H = 30, b = H - 1, P = new Pix(W, H), R = TEDDY;
    const fur = (x, y, nx, ny) => { const s = -nx * 0.6 - ny * 0.75; P.set(x, y, R[s > 0.55 ? 5 : s > 0.12 ? 4 : s > -0.35 ? 3 : 2]); };
    P.ell(3.5, b - 12, 2.6, 4.2, fur); P.ell(18.5, b - 12, 2.6, 4.2, fur);
    P.ell(11, b - 9, 8, 7.5, fur);
    P.ell(11, b - 8, 4.4, 4.2, (x, y, nx, ny) => P.set(x, y, R[nx + ny < -0.3 ? 5 : 4]));
    stamp(P, 9, b - 10, ['##.##', '#####', '.###.', '..#..'], { '#': PINK[3] });
    P.ell(5, b - 3, 3.8, 2.8, fur); P.ell(17, b - 3, 3.8, 2.8, fur);
    P.ell(5, b - 2.6, 2, 1.5, (x, y) => P.set(x, y, PINK[4])); P.ell(17, b - 2.6, 2, 1.5, (x, y) => P.set(x, y, PINK[3]));
    P.ell(5.5, b - 25, 2.6, 2.6, fur); P.ell(16.5, b - 25, 2.6, 2.6, fur);
    P.ell(11, b - 19, 6.6, 5.6, fur);
    P.set(5.5, b - 25, PINK[3]); P.set(16.5, b - 25, PINK[2]); P.set(5, b - 24, PINK[3]); P.set(16, b - 24, PINK[2]);
    P.ell(11, b - 16.6, 2.8, 2, (x, y) => P.set(x, y, R[5]));
    P.set(10, b - 17, '#2a1810'); P.set(11, b - 17, '#2a1810'); P.set(10, b - 18, '#5a3a2a');
    P.set(9, b - 15, '#5a3a2a'); P.set(12, b - 15, '#5a3a2a'); P.set(10, b - 14, '#5a3a2a'); P.set(11, b - 14, '#5a3a2a');
    for (const ex of [8, 14]) { P.set(ex, b - 20, '#1a1010'); P.set(ex, b - 19, '#1a1010'); P.set(ex, b - 21, '#ffffff'); }
    P.set(6, b - 17, PINK[3]); P.set(16, b - 17, PINK[3]);
    P.ell(7.5, b - 12.5, 2.2, 1.6, (x, y, nx) => P.set(x, y, nx < 0 ? PINK[4] : PINK[3])); P.ell(14.5, b - 12.5, 2.2, 1.6, (x, y, nx) => P.set(x, y, nx < 0 ? PINK[3] : PINK[2]));
    P.set(11, b - 12, PINK[2]); P.set(11, b - 13, PINK[3]); P.set(10, b - 11, PINK[3]); P.set(12, b - 10, PINK[2]);
    P.outline(OUT); P.shadow(12, b, 9, 2);
    return sprite({ c: P.canvas(), ax: 11, ay: b, foot: [1, 1], solid: true });
  });

  function honeyJar(P, x, by, w, h, cloth) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.set(x + i, by - j, i === 0 ? HONEYG[4] : i === w - 1 ? HONEYG[1] : j > h - 3 ? HONEYG[2] : HONEYG[3]);
    P.set(x + 1, by - h + 2, HONEYG[5]);
    if (w >= 4) { P.set(x + 1, by - 2, CREAM[5]); P.set(x + 2, by - 2, CREAM[4]); }
    if (cloth) { for (let i = -1; i <= w; i++) P.set(x + i, by - h, (i + x) % 2 ? cloth[0] : cloth[1]); for (let i = 0; i < w; i++) P.set(x + i, by - h - 1, (i + x) % 2 ? cloth[1] : cloth[0]); P.hline(x, x + w - 1, by - h + 1, '#c8a070'); }
  }
  def('honey_shelf', 1, () => {
    const W = 32, H = 48, P = new Pix(W, H), R = HONEY;
    for (const sy of [18, 31]) { for (let x = 1; x <= 30; x++) { P.set(x, sy, R[6]); P.set(x, sy + 1, R[4]); P.set(x, sy + 2, R[2]); } for (const bx of [3, 26]) for (let j = 0; j < 4; j++) for (let i = 0; i < 3 - Math.floor(j / 2); i++) P.set(bx + i + (bx > 15 ? Math.floor(j / 2) : 0), sy + 3 + j, i === 0 ? R[5] : R[3]); }
    honeyJar(P, 3, 17, 4, 6, [PINK[3], CREAM[5]]); honeyJar(P, 9, 17, 5, 8, [PINK[2], '#fff6f8']); honeyJar(P, 23, 17, 4, 5, [MINT[3], CREAM[5]]);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) P.set(16 + i, 14 + j, ((i + (j % 2) * 1) % 3 === 0) ? HONEYG[1] : (i + j) % 2 ? HONEYG[3] : HONEYG[4]); // honeycomb
    P.set(18, 18, HONEYG[3]); P.set(18, 19, HONEYG[4]);
    stamp(P, 27, 14, ['.ww.', 'kyky', '.yk.'], { w: '#e8f0f8', k: '#2a2018', y: '#f2c45a' }); // a little bee
    honeyJar(P, 4, 30, 6, 7, [MINT[4], CREAM[5]]);
    honeyJar(P, 12, 30, 4, 5, null); P.vline(14, 21, 25, HONEY[3]); P.set(14, 20, HONEY[5]); P.set(13, 21, HONEY[4]); P.set(15, 21, HONEY[4]); P.set(13, 22, HONEY[3]); P.set(15, 22, HONEY[3]);
    P.hline(19, 23, 27, TERRA[3]); for (let y = 28; y <= 30; y++) P.hline(20, 22, y, TERRA[2]); P.set(21, 26, LEAF[4]); P.set(20, 25, PINK[4]); P.set(22, 25, PINK[3]); P.set(21, 24, PINK[4]); P.set(21, 25, '#f6dc8a');
    honeyJar(P, 25, 30, 4, 4, [PINK[4], CREAM[5]]); honeyJar(P, 25, 25, 3, 3, null);
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true });
  });

  function cupcake(P, x, y, frost) { stamp(P, x, y, ['.c..', 'ffff', 'ffff', 'wWwW', '.wW.'], { c: CRIMSON[4], f: (i, j) => (i === 0 || j === 1 ? frost[1] : frost[0]), w: PINK[2], W: PINK[3] }); }
  def('baking_counter', 1, () => {
    const W = 32, H = 37, b = H - 1, P = new Pix(W, H), R = HONEY;
    for (let y = b - 13; y <= b - 1; y++) for (let x = 1; x <= 30; x++) P.set(x, y, x <= 2 ? CREAM[5] : x >= 29 ? CREAM[2] : y >= b - 2 ? CREAM[2] : CREAM[4]);
    P.hline(3, 28, b - 12, BRASS[3]);
    for (let y = b - 11; y <= b - 3; y++) for (let x = 3; x <= 28; x++) { const gx = (x >> 1) & 1, gy = (y >> 1) & 1; let c = gx && gy ? PINK[2] : gx || gy ? PINK[3] : CREAM[5]; if (x === 15 || x === 16) c = mix(c, '#120c1c', 0.25); if (y === b - 3 && x % 2) continue; P.set(x, y, c); }
    for (let y = b - 17; y <= b - 14; y++) for (let x = 1; x <= 30; x++) P.set(x, y, y === b - 17 ? R[4] : y === b - 14 ? R[3] : (x % 6 === 0 ? R[4] : R[5]));
    // two-tier cake stand of cupcakes
    P.hline(2, 12, b - 18, '#fbf6ee'); P.hline(3, 11, b - 17, '#d8d0cc'); P.vline(7, b - 25, b - 19, '#e8e0dc'); P.hline(4, 10, b - 24, '#fbf6ee');
    cupcake(P, 2, b - 23, [PINK[4], PINK[5]]); cupcake(P, 6, b - 23, [CREAM[5], '#ffffff']); cupcake(P, 9, b - 23, [MINT[4], MINT[5]]);
    cupcake(P, 5, b - 29, [PINK[3], PINK[4]]); P.set(9, b - 27, '#7ab8e8'); P.set(4, b - 21, '#f6dc8a');
    // mixing bowl with a whisk, a rolling pin
    P.ell(17.5, b - 19.5, 3.4, 2.2, (x, y, nx, ny) => P.set(x, y, ny < -0.35 ? '#f2e6c0' : nx < -0.3 ? CREAM[5] : CREAM[4]));
    P.hline(15, 20, b - 19, PINK[3]);
    P.line(19, b - 21, 21, b - 26, SILVER[4]); P.set(21, b - 27, SILVER[5]); P.set(22, b - 26, SILVER[3]); P.set(20, b - 27, SILVER[3]);
    P.hline(23, 29, b - 19, R[5]); P.hline(23, 29, b - 18, R[3]); P.set(22, b - 18, R[2]); P.set(30, b - 18, R[2]);
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('flower_vase', 2, (v) => {
    const W = 16, H = 28, b = H - 1, P = new Pix(W, H), V = v ? MINT : CREAM;
    const stems = [[-5, -14], [-2, -17], [1, -18], [4, -15], [6, -11], [-6, -9], [0, -12]];
    stems.forEach(([dx, dy]) => P.line(7.5, b - 12, 7.5 + dx * 0.9, b - 12 + dy, LEAF[3]));
    for (const [dx, dy] of [[-4, -8], [5, -7], [-1, -10]]) { P.set(7.5 + dx, b - 12 + dy, LEAF[4]); P.set(8.5 + dx, b - 12 + dy, LEAF[5]); }
    stems.forEach(([dx, dy], k) => {
      const fx = Math.round(7.5 + dx * 0.9), fy = b - 12 + dy;
      if (!v) { if (k % 3 === 2) { P.set(fx, fy, '#ffffff'); P.set(fx + 1, fy + 1, '#f0f0f8'); } else stamp(P, fx - 1, fy - 1, ['ab', 'bc'], { a: PINK[5], b: PINK[3], c: PINK[1] }); }
      else if (k % 2) stamp(P, fx - 1, fy - 1, ['.w.', 'wyw', '.w.'], { w: '#ffffff', y: '#f2c45a' });
      else for (let j = 0; j < 4; j++) P.set(fx + (j % 2), fy - j, j % 2 ? MAGIC[3] : MAGIC[2]);
    });
    for (let j = 0; j < 12; j++) {
      const y = b - 1 - j, hw = j < 1 ? 2.5 : j < 8 ? 3.4 + Math.sin((j / 8) * Math.PI) * 0.9 : j < 10 ? 2 : 2.6;
      for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) { const rel = (x - (7.5 - hw)) / (2 * hw); P.set(x, y, j === 4 || j === 5 ? (rel < 0.3 ? PINK[4] : PINK[3]) : V[rel < 0.25 ? 5 : rel < 0.7 ? 4 : 2]); }
    }
    if (v) { P.set(11, b - 8, V[3]); P.set(12, b - 7, V[3]); P.set(12, b - 6, V[3]); P.set(11, b - 5, V[3]); }
    P.outline(OUT); P.shadow(9, b, 5, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('bunting', 1, () => {
    const W = 48, H = 48, P = new Pix(W, H), FL = [PINK[4], MINT[4], CREAM[5], '#c8b0e8', '#f6dc8a'], FD = [PINK[3], MINT[3], CREAM[3], '#a890d0', '#e0be60'];
    const sY = (x) => 5 + Math.round(4 * Math.sin(((x % 24) / 24) * Math.PI));
    for (let k = 0, x = 1; x < W - 3; x += 5, k++) { const y = sY(x + 2) + 1; for (let j = 0; j < 5; j++) { const hw = 2.5 - j * 0.55; for (let i = Math.round(2 - hw); i <= Math.round(2 + hw) - 1; i++) P.set(x + i, y + j, i >= 2 + hw - 1.2 ? FD[k % 5] : FL[k % 5]); } }
    P.outline(OUT);
    for (let x = 0; x < W; x++) P.set(x, sY(x), '#b89a7e');
    P.set(0, 4, IRON[4]); P.set(47, 4, IRON[4]); P.set(24, 4, IRON[4]);
    return sprite({ c: P.canvas(), ax: 24, ay: H - 1, foot: [3, 1], solid: true, wall: true });
  });

  def('bee_rug', 1, () => {
    const W = 32, H = 32, P = new Pix(W, H);
    P.ell(13.5, 9, 5.6, 4.6, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.7 ? '#a8bccc' : nx + ny < -0.5 ? '#ffffff' : '#dceaf4'));
    P.ell(21.5, 9.5, 5.6, 4.6, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.7 ? '#98acbe' : nx + ny < -0.5 ? '#eef6fc' : '#c8dceb'));
    P.ell(18.5, 18.5, 11.5, 8.5, (x, y, nx, ny) => { const band = Math.floor((x - 7) / 4) % 2; let c = band ? '#3a2a1e' : (nx + ny < -0.6 ? '#ffd87a' : '#f2c45a'); if (nx * nx + ny * ny > 0.78) c = band ? '#24180e' : '#c8902e'; P.set(x, y, c); });
    P.set(30, 18, '#3a2a1e'); P.set(31, 18, '#24180e'); P.set(30, 19, '#24180e');
    P.line(5, 13, 3, 7, '#3a2a1e'); P.line(9, 13, 11, 7, '#3a2a1e'); P.set(3, 6, '#3a2a1e'); P.set(11, 6, '#3a2a1e');
    P.ell(7, 18.5, 5.4, 5.2, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.75 ? '#24180e' : nx + ny < -0.5 ? '#5a4634' : '#46362a'));
    for (const ex of [5, 9]) { P.set(ex, 17, '#ffffff'); P.set(ex, 18, '#120c1c'); }
    P.set(4, 20, PINK[3]); P.set(10, 20, PINK[3]); P.set(6, 21, '#ffffff'); P.set(7, 22, '#ffffff'); P.set(8, 21, '#ffffff');
    return sprite({ c: P.canvas(), ax: 16, ay: H - 1, foot: [2, 2], solid: false, flat: true });
  });

  def('tea_table', 1, () => {
    const W = 16, H = 26, b = H - 1, P = new Pix(W, H);
    for (const [x0, x1] of [[4, 3], [11, 12], [8, 8]]) P.line(x0, b - 8, x1, b - 1, x0 < 8 ? CREAM[4] : CREAM[2]);
    P.ell(7.5, b - 10.5, 7.2, 3.2, (x, y, nx, ny) => P.set(x, y, (x + y) % 3 === 0 ? '#e4dcd8' : nx + ny < -0.4 ? '#ffffff' : '#f4eee8'));
    for (let x = 1; x <= 14; x++) { const drop = x % 3 === 1 ? 3 : 2; for (let j = 0; j < drop; j++) P.set(x, b - 9 + j + (Math.abs(x - 7.5) > 5 ? -1 : 0), j === drop - 1 ? '#d8d0cc' : '#ece6e0'); }
    P.ell(8.5, b - 13.5, 2.7, 2.1, (x, y, nx, ny) => P.set(x, y, (x * 2 + y) % 5 === 0 ? PINK[3] : nx + ny < -0.4 ? '#ffffff' : '#ece4e0'));
    P.set(8, b - 16, '#ece4e0'); P.set(9, b - 16, '#d8d0cc'); P.set(8, b - 17, PINK[3]);
    P.set(5, b - 14, '#ece4e0'); P.set(4, b - 15, '#ece4e0'); P.set(11, b - 14, '#d8d0cc'); P.set(12, b - 13, '#d8d0cc'); P.set(11, b - 12, '#d8d0cc');
    for (const [cx, cy] of [[3, b - 11], [12, b - 10]]) { P.hline(cx - 1, cx + 2, cy + 1, '#ece4e0'); P.set(cx, cy, '#ffffff'); P.set(cx + 1, cy, '#e4dcd8'); P.set(cx, cy - 1, PINK[3]); P.set(cx + 1, cy - 1, PINK[3]); }
    P.outline(OUT); P.shadow(9, b, 6, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('plush_pile', 1, () => {
    const W = 16, H = 22, b = H - 1, P = new Pix(W, H);
    stamp(P, 4, b - 16, ['.p...p.', '.e...e.', '.e...e.', '.hhhhh.', 'hhdhdhh', 'hhhnhhh', '.bbbbb.', 'abbbbba'], { p: PINK[4], e: TEDDY_CREAM[4], h: (i) => (i < 4 ? TEDDY_CREAM[5] : TEDDY_CREAM[4]), d: '#2a1810', n: PINK[3], b: (i) => (i < 4 ? TEDDY_CREAM[4] : TEDDY_CREAM[3]), a: TEDDY_CREAM[3] });
    teddy(P, 1, b - 8, TEDDY, PINK[3]); teddy(P, 8, b - 8, TEDDY_PINK, MINT[4]);
    stamp(P, 6, b - 3, ['.w.w.', 'Ykyky', 'yykyy', '.yky.'], { w: '#e8f0f8', Y: '#ffd87a', y: '#f2c45a', k: '#2a2018' });
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('pastel_dresser', 1, () => {
    const W = 32, H = 36, b = H - 1, P = new Pix(W, H), M = MINT;
    for (let y = b - 18; y <= b - 2; y++) for (let x = 1; x <= 30; x++) P.set(x, y, x <= 2 ? M[4] : x >= 29 ? M[1] : M[2]);
    for (let x = 1; x <= 30; x++) { P.set(x, b - 21, CREAM[4]); P.set(x, b - 20, CREAM[5]); P.set(x, b - 19, CREAM[3]); }
    for (const dy of [b - 17, b - 12, b - 7]) for (const [x0, x1] of [[3, 14], [17, 28]]) {
      for (let y = dy; y <= dy + 3; y++) for (let x = x0; x <= x1; x++) P.set(x, y, y === dy || x === x0 ? M[4] : y === dy + 3 || x === x1 ? M[1] : M[3]);
      const kx = Math.round((x0 + x1) / 2); P.set(kx - 1, dy + 1, PINK[4]); P.set(kx, dy + 1, PINK[3]); P.set(kx - 1, dy + 2, PINK[3]); P.set(kx, dy + 2, PINK[2]);
    }
    for (const fx of [2, 3, 28, 29]) P.set(fx, b - 1, CREAM[3]);
    P.ell(7.5, b - 27, 3.8, 4.2, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.6 ? (nx + ny < 0 ? PINK[4] : PINK[2]) : (nx - ny > 0.5 ? '#e8eef8' : '#a8b4cc')));
    P.vline(7, b - 22, b - 22, PINK[2]); P.hline(6, 9, b - 22, PINK[3]);
    P.set(14, b - 22, MINT[5]); P.set(15, b - 22, MINT[3]); P.set(14, b - 23, MINT[4]); P.set(15, b - 23, MINT[3]); P.vline(14, b - 27, b - 24, LEAF[4]); P.set(14, b - 28, PINK[4]); P.set(13, b - 28, PINK[3]); P.set(15, b - 28, PINK[3]); P.set(14, b - 29, PINK[4]);
    for (let y = b - 24; y <= b - 22; y++) for (let x = 18; x <= 23; x++) P.set(x, y, y === b - 24 ? PINK[4] : x === 18 ? PINK[3] : PINK[2]);
    P.set(20, b - 23, GOLD[4]); P.set(21, b - 23, GOLD[3]);
    for (let y = b - 26; y <= b - 22; y++) for (let x = 25; x <= 28; x++) P.set(x, y, x === 25 || x === 28 || y === b - 26 || y === b - 22 ? GOLD[3] : (y < b - 24 ? '#9fb0d8' : '#6a8a5a'));
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  // ------------------------------------------------------------------ Amara's study
  def('book_tower', 3, (v) => {
    const W = 16, H = v === 0 ? 46 : 38, b = H - 1, seed = 900 + v * 13;
    const stack = (P, x0, n, maxW, s2, lean) => {
      let y = b - 1;
      for (let k = 0; k < n; k++) {
        const wd = maxW - Math.floor(hash(k, 1, s2) * 3), th = 2 + (hash(k, 2, s2) < 0.45 ? 1 : 0), dx = Math.floor(hash(k, 3, s2) * 3) - 1 + Math.round(k * lean);
        flatBook(P, x0 + dx + Math.floor((maxW - wd) / 2), y, wd, th, BOOK_R[Math.floor(hash(k, 4, s2) * BOOK_R.length)], hash(k, 5, s2) < 0.5);
        y -= th;
      }
      return y;
    };
    let fl = null;
    const draw = (f) => {
      const P = new Pix(W, H);
      if (v === 0) stack(P, 2, 17, 12, seed, 0.08);
      else if (v === 1) { stack(P, 0, 13, 8, seed, -0.04); const t = stack(P, 8, 8, 8, seed + 1, 0.05); P.hline(10, 13, t, BRASS[3]); fl = candle(P, 11, t - 1, 4, 2, f); }
      else { const t = stack(P, 2, 11, 12, seed, 0.2); for (let x = 5; x <= 11; x++) { P.set(x, t, x === 5 ? PAPER[4] : PAPER[3]); P.set(x, t - 1, x === 5 ? PAPER[3] : PAPER[4]); } P.set(4, t, PAPER[2]); P.set(4, t - 1, PAPER[1]); P.line(9, t - 2, 13, t - 7, '#2e2442'); P.set(13, t - 8, '#8a6ad0'); }
      P.outline(OUT); P.shadow(9, b, 7, 1.6);
      return P;
    };
    if (v === 1) { draw(0); return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(fl.x, fl.y - 1, 30, L_CANDLE, 0.6, 1)] }, draw, 4, 6); }
    return sprite({ c: draw(0).canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, fade: v === 0 });
  });

  def('chalkboard', 1, () => {
    const W = 32, H = 48, P = new Pix(W, H), R = HONEY, CH = '#d8e0d8', CY = '#e8e0a0', CP = '#e8b8c8';
    for (let y = 6; y <= 29; y++) for (let x = 1; x <= 30; x++) { const fr = x <= 2 || x >= 29 || y <= 7 || y >= 28; P.set(x, y, fr ? (x <= 2 || y <= 7 ? R[5] : R[2]) : noise(x / 5, y / 4, 3) > 0.62 ? '#2e403a' : '#22342e'); }
    const word = (x, y, n, c) => { for (let i = 0; i < n; i++) if ((i * 7 + y) % 5 !== 0) P.set(x + i, y, c); };
    word(4, 10, 6, CH); P.set(11, 10, CY); word(13, 10, 3, CH); word(4, 12, 4, CH); word(9, 12, 5, CH);
    for (let a = 0; a < 40; a++) if (a % 2 === 0) { const t = a / 40 * Math.PI * 2; P.set(Math.round(22 + Math.cos(t) * 5), Math.round(15 + Math.sin(t) * 2.5), CH); }
    P.set(22, 15, CY); P.set(23, 15, CY); P.set(27, 15, CP); P.set(18, 13, CP);
    stampRune(P, 4, 17, 3, CY); stampRune(P, 11, 18, 0, CH); stampRune(P, 19, 20, 5, CP);
    P.line(10, 25, 17, 25, CH); P.set(16, 24, CH); P.set(16, 26, CH); word(4, 24, 4, CH);
    for (let x = 2; x <= 29; x++) { P.set(x, 30, R[6]); P.set(x, 31, R[3]); }
    P.hline(6, 7, 29, '#ffffff'); P.hline(10, 11, 29, CP); P.hline(22, 25, 29, '#8a6a50'); P.hline(22, 25, 28, '#5a5060');
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true });
  });

  def('orrery', 1, () => {
    const W = 16, H = 26, b = H - 1, cx = 7.5, cy = b - 15;
    const draw = (f) => {
      const P = new Pix(W, H);
      P.hline(3, 12, b - 1, BRASS[2]); P.hline(4, 11, b - 2, BRASS[4]); P.set(4, b - 2, BRASS[5]); P.hline(5, 10, b - 3, BRASS[3]);
      for (let y = b - 11; y <= b - 4; y++) { P.set(7, y, BRASS[4]); P.set(8, y, BRASS[2]); }
      const ring = (rx, ry, front, c) => { for (let a = 0; a < 72; a++) { const t = a / 72 * Math.PI * 2; if ((Math.sin(t) > 0) !== front) continue; P.set(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), c); } };
      const pl = [[4, 1.6, f * Math.PI / 2 + 0.4, GL.azure, false], [6.5, 2.6, f * Math.PI / 4 + 2.2, GL.rose, true]];
      const planet = (front) => pl.forEach(([rx, ry, t, C, big]) => { if ((Math.sin(t) > 0) !== front) return; const px = Math.round(cx + Math.cos(t) * rx), py = Math.round(cy + Math.sin(t) * ry); P.set(px, py, C[4]); if (big) { P.set(px + 1, py, C[3]); P.set(px, py - 1, C[4]); P.set(px + 1, py - 1, C[3]); } });
      ring(6.5, 2.6, false, BRASS[2]); ring(4, 1.6, false, BRASS[2]); planet(false);
      P.ell(cx, cy, 2, 2, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.4 ? '#fff4c8' : nx + ny < 0.5 ? GOLD[5] : GOLD[3]));
      ring(6.5, 2.6, true, BRASS[4]); ring(4, 1.6, true, BRASS[5]); planet(true);
      P.outline(OUT); P.shadow(9, b, 5, 1.3);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, cy, 22, [255, 210, 120], 0.4)] }, draw, 4, 3);
  });

  def('brass_telescope', 1, () => {
    const W = 16, H = 30, b = H - 1, P = new Pix(W, H);
    P.line(8, b - 11, 3, b - 1, WOOD[4]); P.line(8, b - 11, 13, b - 1, WOOD[2]); P.line(8, b - 11, 8, b - 1, WOOD[3]);
    for (const fx of [3, 8, 13]) P.set(fx, b - 1, BRASS[3]);
    for (let t = 0; t <= 11; t++) { const x = 2 + t, y = b - 10 - Math.round(t * 1.1); P.set(x, y - 1, BRASS[5]); P.set(x, y, BRASS[4]); P.set(x, y + 1, BRASS[2]); if (t % 4 === 2) { P.set(x, y - 1, GOLD[6]); P.set(x, y + 1, BRASS[3]); } }
    P.set(13, b - 23, '#4a64a0'); P.set(14, b - 23, '#2a3a6a'); P.set(13, b - 24, '#c4e6ff'); P.set(14, b - 22, BRASS[2]); P.set(12, b - 24, BRASS[5]);
    P.set(1, b - 9, BRASS[1]); P.set(1, b - 8, BRASS[2]); P.set(0, b - 8, IRON[3]);
    P.ell(8, b - 12, 1.5, 1.5, (x, y, nx) => P.set(x, y, nx < 0 ? BRASS[5] : BRASS[3]));
    P.line(5, b - 15, 10, b - 20, BRASS[2]);
    P.outline(OUT); P.shadow(9, b, 6, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('star_chart', 2, (v) => {
    const W = 16, H = 48, P = new Pix(W, H), x0 = 1, y0 = 7, x1 = 14, y1 = 27;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let c;
      if (v === 0) { c = noise(x / 3, y / 3, 7) > 0.66 ? '#1c2858' : '#16204a'; if (Math.abs(Math.hypot(x - 7.5, y - 16) - 5.6) < 0.5) c = GOLD[3]; if (hash(x, y, 8) < 0.06) c = hash(x, y, 9) < 0.5 ? '#ffffff' : '#c8d4f0'; }
      else { c = (x === x0 || y === y0 || x === x1 || y === y1) ? PAPER[1] : hash(x, y, 4) < 0.1 ? PAPER[2] : PAPER[3]; }
      P.set(x, y, c);
    }
    if (v === 0) {
      const pts = [[5, 12], [8, 14], [10, 13], [11, 17], [8, 19], [5, 20]];
      for (let k = 0; k + 1 < pts.length; k++) P.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], '#5a6aa8');
      for (const [x, y] of pts) { P.set(x, y, '#ffffff'); }
      P.set(11, 24, GOLD[5]); P.set(12, 23, GOLD[4]); P.set(12, 25, GOLD[4]);
    } else {
      for (let k = 0; k < 5; k++) { const cx = 3 + k * 2.5, ph = k / 4; P.ell(cx, 11, 1.1, 1.1, (x, y, nx) => P.set(x, y, nx < ph * 2 - 1 ? '#3a3448' : '#f8f0e0')); }
      for (const y of [15, 17, 19, 21, 23]) for (let x = 3; x <= (y === 23 ? 8 : 12); x++) if ((x + y) % 5) P.set(x, y, PAPER[1]);
      P.line(9, 24, 12, 21, '#6a8ac8'); P.set(13, 20, '#c4e6ff');
    }
    P.outline(OUT);
    P.set(x0 + 1, y0, CRIMSON[4]); P.set(x1 - 1, y0, CRIMSON[4]); P.set(x0 + 1, y0 - 1, CRIMSON[5]); P.set(x1 - 1, y0 - 1, CRIMSON[5]);
    return sprite({ c: P.canvas(), ax: 8, ay: H - 1, foot: [1, 1], solid: true, wall: true });
  });

  def('beanbag', 1, () => {
    const W = 16, H = 19, b = H - 1, P = new Pix(W, H), R = OCHRE;
    const sh = (x, y, nx, ny) => { const s2 = -nx * 0.55 - ny * 0.65; P.set(x, y, R[s2 > 0.55 ? 5 : s2 > 0.1 ? 4 : s2 > -0.4 ? 3 : 2]); };
    P.ell(9, b - 9.5, 5.2, 5.4, sh);
    P.ell(8, b - 4, 7.2, 3.8, sh);
    P.ell(8, b - 5.8, 4.2, 2, (x, y, nx, ny) => P.set(x, y, ny < -0.1 ? R[2] : R[3]));
    for (let t = 0; t <= 1.0001; t += 0.12) P.set(Math.round(9.5 + Math.sin(t * 2) * 1.5), Math.round(b - 14.5 + t * 6), R[3]);
    P.set(6, b - 13, R[5]); P.set(7, b - 14, R[5]); P.set(3, b - 6, R[5]);
    flatBook(P, 1, b - 1, 5, 2, TEALC, true);
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('alchemy_desk', 1, () => {
    const W = 32, H = 38, b = H - 1, R = WALNUT;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (const lx of [2, 28]) for (let y = b - 11; y <= b - 1; y++) { P.set(lx, y, R[5]); P.set(lx + 1, y, R[2]); }
      for (let x = 1; x <= 30; x++) { P.set(x, b - 15, R[4]); P.set(x, b - 14, R[5]); P.set(x, b - 13, R[6]); P.set(x, b - 12, R[3]); }
      for (let y = b - 11; y <= b - 9; y++) for (let x = 12; x <= 19; x++) P.set(x, y, y === b - 11 ? R[4] : R[3]); P.set(15, b - 10, BRASS[4]);
      // burner and tripod under a round flask of green brew
      P.hline(5, 8, b - 16, IRON[3]); P.set(6, b - 17, '#4a8ae8'); P.set(7, b - 17, f % 2 ? '#c4e6ff' : '#8ac0ff'); P.set(6 + (f % 2), b - 18, '#4a8ae8');
      P.set(3, b - 16, IRON[4]); P.set(4, b - 17, IRON[4]); P.set(10, b - 16, IRON[3]); P.set(9, b - 17, IRON[3]);
      P.ell(6.5, b - 21, 3, 3, (x, y, nx, ny) => P.set(x, y, ny < -0.3 ? GLASS[2] : nx < -0.4 ? LIQ.emerald[2] : nx > 0.5 ? LIQ.emerald[0] : LIQ.emerald[1]));
      P.vline(6, b - 27, b - 24, GLASS[3]); P.vline(7, b - 27, b - 24, GLASS[1]);
      P.line(7, b - 27, 13, b - 24, GLASS[3]);
      P.ell(14.5, b - 19.5, 2.4, 2.4, (x, y, nx, ny) => P.set(x, y, ny < -0.3 ? GLASS[2] : nx < -0.3 ? LIQ.violet[2] : LIQ.violet[1]));
      P.vline(14, b - 23, b - 22, GLASS[3]);
      for (const [tx, c] of [[19, 'rose'], [21, 'amber'], [23, 'azure']]) { P.vline(tx, b - 21, b - 17, GLASS[3]); P.vline(tx, b - 19, b - 17, LIQ[c][2]); }
      P.hline(18, 24, b - 18, R[3]); P.hline(18, 24, b - 16, R[2]);
      for (let y = b - 18; y <= b - 16; y++) for (let x = 25; x <= 30; x++) P.set(x, y, x === 27 ? PAPER[1] : y === b - 18 ? PAPER[4] : PAPER[3]);
      P.set(26, b - 17, PAPER[1]); P.set(29, b - 17, PAPER[1]);
      const bub = [[[5, b - 21], [7, b - 22]], [[6, b - 22], [8, b - 20]], [[5, b - 20], [7, b - 23]], [[6, b - 21], [5, b - 22]]][f];
      for (const [x, y] of bub) P.set(x, y, LIQ.emerald[3]);
      P.set(14, b - 20 - (f % 2), LIQ.violet[3]);
      P.outline(OUT);
      for (let j = 0; j < 5; j++) { const x = 6 + Math.round(Math.sin((j + f) * 0.9)), y = b - 29 - j - (f % 2); if (!P.has(x, y)) P.set(x, y, '#9affc8', (0.5 - j * 0.08) * 255); }
      P.shadow(17, b, 15, 1.6);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(6.5, b - 21, 38, [93, 255, 160], 0.6, 1), L(14.5, b - 19, 24, [176, 136, 255], 0.4), L(6.5, b - 17, 14, [110, 170, 255], 0.35, 1)] }, draw, 4, 6);
  });

  def('fern_pot', 1, () => {
    const W = 16, H = 27, b = H - 1, P = new Pix(W, H), pot = TEALC;
    const fr = [[-7, -5], [-6, -9], [-3, -12], [0, -14], [3, -12], [6, -9], [7, -5], [-1, -9], [2, -7]];
    fr.forEach(([dx, dy], k) => {
      for (let t = 0; t <= 1.0001; t += 0.07) {
        const x = 7.5 + dx * t, y = b - 9 + dy * t + (Math.abs(dy) < 9 ? t * t * 3 : 0);
        P.set(x, y, LEAF[k % 2 ? 3 : 4]);
        if (t > 0.2 && Math.round(t * 14) % 2 === 0) { P.set(x - 1, y - (dx > 0 ? 0 : 1), LEAF[k % 2 ? 4 : 5]); P.set(x + 1, y - (dx > 0 ? 1 : 0), LEAF[2]); }
      }
    });
    for (let j = 0; j < 7; j++) { const y = b - 1 - j, hw = 3.5 + j * 0.25; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw); x++) { const rel = (x - (7.5 - hw)) / (2 * hw); P.set(x, y, j === 3 ? (rel < 0.3 ? GOLD[5] : GOLD[3]) : pot[rel < 0.25 ? 4 : rel < 0.7 ? 3 : 2]); } }
    for (let x = 2; x <= 13; x++) { P.set(x, b - 8, x < 5 ? pot[5] : pot[4]); P.set(x, b - 9, x < 5 ? pot[5] : pot[3]); }
    P.hline(3, 12, b - 7, pot[1]);
    P.outline(OUT); P.shadow(9, b, 6, 1.6);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  // ------------------------------------------------------------------ the Ashvale Runesmithy
  const STEEL = ['#1e1c26', '#2e2c3a', '#45435a', '#605e78', '#8a88a2', '#b4b2c8'];
  def('rune_forge', 1, () => {
    const W = 32, H = 50, b = H - 1, S = HSTONE, FIRE = ['#8a2a1a', EMBERC, ORANGE, AMBER, '#ffe0a0', '#fff8e4'];
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let y = 0; y <= 20; y++) { // riveted hood flaring over the fire
        const hw = y < 9 ? 5 : 5 + (y - 9) * 0.95, x0 = Math.round(15.5 - hw), x1 = Math.round(15.5 + hw);
        for (let x = x0; x <= x1; x++) { const rel = (x - x0) / Math.max(1, x1 - x0); let c = IRON[rel < 0.2 ? 4 : rel < 0.75 ? 3 : 2]; if (y >= 17) c = mix(IRON[3], ORANGE, (y - 16) * (0.14 + (f % 2) * 0.03)); if (y > 9 && y < 17 && (x === x0 + 1 || x === x1 - 1) && y % 3 === 0) c = IRON[5]; P.set(x, y, c); }
      }
      P.hline(10, 21, 9, IRON[5]); P.hline(10, 21, 0, IRON[4]);
      for (const px of [4, 27]) for (let y = 21; y <= b - 17; y++) P.set(px, y, px < 16 ? IRON[4] : IRON[2]);
      for (let y = b - 13; y <= b - 1; y++) for (let x = 1; x <= 30; x++) { const ly = y - (b - 13), off = (Math.floor(ly / 4) % 2) * 5, lx = (x + off) % 10; P.set(x, y, lx === 0 || ly % 4 === 3 ? S[1] : x <= 2 ? S[5] : x >= 29 ? S[2] : S[3]); }
      const rc = f % 2 ? '#8afff0' : RUNE_C;
      stampRune(P, 4, b - 10, 1, rc, '#ffffff'); stampRune(P, 13, b - 10, 4, rc, '#ffffff'); stampRune(P, 22, b - 10, 3, rc, '#ffffff');
      for (let y = b - 17; y <= b - 14; y++) for (let x = 2; x <= 29; x++) { const h2 = hash(x, y, 70 + f); P.set(x, y, y === b - 14 ? S[6] : h2 < 0.3 ? '#ffe0a0' : h2 < 0.6 ? ORANGE : h2 < 0.85 ? EMBERC : '#3a1e18'); }
      const tg = [[7, 7], [11, 10], [15.5, 13], [20, 10], [24, 7]];
      for (let y = b - 31; y <= b - 18; y++) for (let x = 4; x <= 27; x++) {
        let inten = 0;
        tg.forEach(([tx, th], k) => { const hgt = th * (0.7 + 0.45 * hash(k, f, 71)), sway = (hash(k, f + 3, 72) - 0.5) * 2.6, t = (b - 17.5 - y) / hgt; if (t < 0 || t >= 1) return; const xc = tx + sway * t * t, wdt = 2.6 * Math.pow(1 - t, 0.7) + 0.4, dx = Math.abs(x + 0.5 - xc); if (dx <= wdt) inten = Math.max(inten, (1 - t) * (1 - (dx / wdt) * 0.5)); });
        if (inten > 0.05) P.set(x, y, FIRE[inten > 0.78 ? 5 : inten > 0.6 ? 4 : inten > 0.42 ? 3 : inten > 0.26 ? 2 : inten > 0.14 ? 1 : 0]);
      }
      P.outline(OUT);
      for (let k = 0; k < 3; k++) { const sx = 7 + Math.floor(hash(k, f, 73) * 18), sy = 21 + Math.floor(hash(k, f, 74) * 8); if (!P.has(sx, sy) || sy > 22) P.set(sx, sy, k % 2 ? AMBER : '#ffe0a0'); }
      P.shadow(17, b, 15, 2);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(16, b - 22, 86, [255, 140, 60], 1, 1), L(16, b - 7, 32, RUNE_RGB, 0.45, 1)] }, draw, 4, 8);
  });

  def('anvil_rune', 1, () => {
    const W = 16, H = 20, b = H - 1, P = new Pix(W, H);
    for (let y = b - 6; y <= b - 1; y++) for (let x = 3; x <= 12; x++) P.set(x, y, x === 3 ? WOOD[4] : x === 12 ? WOOD[1] : (x + y) % 4 === 0 ? WOOD[2] : WOOD[3]);
    P.ell(7.5, b - 7, 4.8, 1.2, (x, y, nx) => P.set(x, y, Math.round(Math.abs(nx) * 3) % 2 ? WOOD[4] : WOOD[5]));
    for (let x = 4; x <= 13; x++) { P.set(x, b - 13, STEEL[5]); P.set(x, b - 12, STEEL[4]); P.set(x, b - 11, STEEL[2]); P.set(x, b - 10, STEEL[2]); }
    for (let i = 0; i < 4; i++) { P.set(3 - i, b - 12, i === 3 ? STEEL[3] : STEEL[4]); if (i < 2) P.set(3 - i, b - 11, STEEL[2]); }
    for (let x = 6; x <= 11; x++) { P.set(x, b - 9, STEEL[1]); P.set(x, b - 8, STEEL[2]); } P.hline(5, 12, b - 8, STEEL[3]);
    P.set(13, b - 13, STEEL[4]); P.set(13, b - 11, STEEL[1]);
    for (const [x, y] of [[6, b - 11], [8, b - 10], [9, b - 11], [11, b - 10]]) P.set(x, y, RUNE_C);
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(8, b - 10, 20, RUNE_RGB, 0.35)] });
  });

  def('quench_trough', 1, () => {
    const W = 32, H = 26, b = H - 1, P = new Pix(W, H), S = HSTONE;
    for (let y = b - 12; y <= b - 10; y++) for (let x = 1; x <= 30; x++) {
      if (y === b - 12 || x <= 2 || x >= 29) P.set(x, y, y === b - 12 ? S[6] : x <= 2 ? S[5] : S[3]);
      else P.set(x, y, y === b - 11 ? '#2a5a72' : '#1e4058');
    }
    P.hline(6, 11, b - 11, '#6aa6c8'); P.set(20, b - 11, '#8ac0e0'); P.set(21, b - 11, '#6aa6c8');
    for (let y = b - 9; y <= b - 1; y++) for (let x = 1; x <= 30; x++) P.set(x, y, x <= 2 ? S[5] : x >= 29 ? S[2] : y === b - 1 ? S[1] : (x % 10 === 0 ? S[2] : S[4]));
    for (const rx of [5, 13, 21]) stampRune(P, rx, b - 7, rx, '#2aa89a', RUNE_C);
    P.line(26, b - 17, 29, b - 10, IRON[4]); P.line(27, b - 17, 30, b - 11, IRON[2]); P.set(26, b - 18, IRON[5]);
    P.outline(OUT);
    for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) { const x = 8 + k * 7 + (j % 2), y = b - 14 - j; if (!P.has(x, y)) P.set(x, y, '#e8eef8', (0.45 - j * 0.09) * 255); }
    P.shadow(17, b, 15, 1.6);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(16, b - 5, 26, RUNE_RGB, 0.3)] });
  });

  def('weapon_rack', 1, () => {
    const W = 32, H = 48, P = new Pix(W, H);
    for (let y = 6; y <= 27; y++) { P.set(5, y, SILVER[5]); P.set(6, y, SILVER[3]); } P.set(5, 5, SILVER[6]);
    P.hline(3, 8, 28, GOLD[3]); P.set(3, 28, GOLD[4]); P.vline(5, 29, 32, '#5a3a2a'); P.vline(6, 29, 32, '#3a2418'); P.set(5, 33, GOLD[4]); P.set(6, 33, GOLD[2]);
    for (let y = 8; y <= 34; y++) { P.set(13, y, WOOD[4]); P.set(14, y, WOOD[2]); }
    stamp(P, 15, 7, ['##...', '####.', '#####', '#####', '####.', '##...'], { '#': (i, j) => (j < 2 ? STEEL[5] : i > 3 ? STEEL[3] : STEEL[4]) });
    P.set(12, 9, STEEL[3]); P.set(11, 10, STEEL[2]);
    for (let y = 3; y <= 35; y++) P.set(21, y, y % 5 === 0 ? WOOD[2] : WOOD[3]);
    stamp(P, 20, 0, ['.#.', '###', '###', '.#.'], { '#': (i) => (i === 0 ? SILVER[6] : SILVER[4]) }); P.set(21, 4, CRIMSON[4]); P.set(20, 5, CRIMSON[3]); P.set(22, 5, CRIMSON[3]);
    for (let y = 10; y <= 27; y++) { P.set(26, y, SILVER[4]); P.set(27, y, SILVER[2]); } P.set(26, 9, SILVER[5]);
    P.hline(24, 29, 28, BRASS[3]); P.vline(26, 29, 31, '#3a2418'); P.set(26, 32, BRASS[4]);
    for (const ry of [12, 30]) { for (let x = 1; x <= 30; x++) { P.set(x, ry, OAK[5]); P.set(x, ry + 1, OAK[3]); P.set(x, ry + 2, OAK[1]); } for (const bx of [1, 30]) { P.set(bx, ry + 3, IRON[4]); P.set(bx, ry - 1, IRON[4]); } }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true });
  });

  const ORES = [
    { rock: ['#2d2840', '#3d3654', '#4f4769', '#635a80'], gem: MAGIC, glow: [176, 136, 255] },
    { rock: ['#16141e', '#221f2c', '#2e2a3a', '#3c3848'], gem: ['#2a3a6a', '#3e5a9a', '#6a8acc', '#a8c4f0', '#e0ecff'], glow: null },
    { rock: ['#4a4a5e', '#605f78', '#7e7d97', '#a09fb6'], gem: ['#8a8aa6', '#b4b4cc', '#dcdcec', '#f4f4ff', '#ffffff'], glow: [220, 230, 255] },
  ];
  def('ore_crate', 3, (v) => {
    const W = 16, H = 19, b = H - 1, P = new Pix(W, H), O = ORES[v], seed = 80 + v;
    for (let k = 0; k < 9; k++) { const x = 3 + (k * 5) % 10 + Math.floor(hash(k, 1, seed) * 2), y = b - 10 - Math.floor(hash(k, 2, seed) * 3) - (k > 4 ? 1 : 0); P.ell(x, y, 2.1, 1.6, (xx, yy, nx, ny) => P.set(xx, yy, O.rock[nx + ny < -0.4 ? 3 : nx + ny < 0.4 ? 2 : 1])); }
    for (let k = 0; k < 6; k++) { const x = 3 + Math.floor(hash(k, 3, seed) * 10), y = b - 13 + Math.floor(hash(k, 4, seed) * 4); P.set(x, y, O.gem[3]); P.set(x, y - 1, O.gem[4]); P.set(x + 1, y, O.gem[2]); }
    for (let y = b - 8; y <= b - 1; y++) for (let x = 1; x <= 14; x++) P.set(x, y, y === b - 8 ? WOOD[4] : y === b - 4 ? WOOD[1] : x === 1 ? WOOD[4] : x === 14 ? WOOD[1] : WOOD[2]);
    P.line(2, b - 7, 13, b - 2, WOOD[1]); stampRune(P, 9, b - 7, v + 2, '#b8a88a');
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: O.glow ? [L(8, b - 11, 18, O.glow, 0.3)] : [] });
  });

  def('grindstone', 1, () => {
    const W = 16, H = 22, b = H - 1, P = new Pix(W, H);
    P.hline(1, 14, b - 1, WOOD[2]); P.hline(1, 14, b - 2, WOOD[4]);
    for (const ux of [1, 12]) for (let y = b - 12; y <= b - 3; y++) { P.set(ux, y, WOOD[4]); P.set(ux + 1, y, WOOD[2]); }
    P.rect(4, b - 5, 8, 3, WOOD[3]); P.hline(5, 10, b - 5, '#2a5a72'); P.set(6, b - 5, '#6aa6c8');
    P.ell(7.5, b - 11, 5.2, 5.2, (x, y, nx, ny) => { const d = nx * nx + ny * ny; P.set(x, y, d > 0.72 ? STONE[1] : d < 0.06 ? IRON[4] : nx + ny < -0.3 ? STONE[4] : STONE[3]); });
    P.hline(3, 12, b - 11, IRON[3]); P.set(7, b - 11, IRON[5]);
    P.set(14, b - 11, IRON[4]); P.line(14, b - 11, 14, b - 15, IRON[4]); P.set(13, b - 16, WOOD[4]); P.set(14, b - 16, WOOD[3]);
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('collection_cabinet', 1, () => {
    const W = 64, H = 48, P = new Pix(W, H), R = WALNUT, niches = [];
    for (let x = 1; x <= 62; x++) { const pk = Math.max(0, 4 - Math.floor(Math.abs(x - 31.5) / 5)); for (let y = 5 - pk; y <= 7; y++) P.set(x, y, y === 5 - pk ? R[6] : y === 7 ? R[2] : R[4]); }
    for (let x = 29; x <= 34; x++) P.set(x, 0, GOLD[x < 31 ? 5 : 4]);
    stamp(P, 29, 0, ['.####.', '#.....', '#.....', '.####.'], { '#': GOLD[4] });
    for (const rx of [12, 46]) stampRune(P, rx, 2, rx, RUNE_C);
    for (let y = 8; y <= 46; y++) for (let x = 1; x <= 62; x++) P.set(x, y, x <= 2 ? R[6] : x >= 61 ? R[1] : y === 8 ? R[5] : R[3]);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const nx = 5 + c * 9, ny = 9 + r * 9;
      niches.push({ x: nx, y: ny, w: 8, h: 8 });
      for (let y = ny; y < ny + 8; y++) for (let x = nx; x < nx + 8; x++) { let col = VIOLET[1]; if (y === ny || x === nx) col = VIOLET[0]; else if (y === ny + 1 || x === nx + 1) col = mix(VIOLET[1], VIOLET[0], 0.5); else if (hash(x, y, 5) < 0.06) col = VIOLET[2]; P.set(x, y, col); }
      P.hline(nx, nx + 7, ny + 8, BRASS[3]); P.set(nx, ny + 8, BRASS[4]); P.set(nx + 7, ny + 8, BRASS[2]);
      P.set(nx + 8, ny + 8, R[2]);
    }
    for (let x = 1; x <= 62; x++) { P.set(x, 45, R[5]); P.set(x, 46, R[2]); }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 32, ay: H - 1, foot: [4, 1], solid: true, wall: true, niches, lights: [L(32, 3, 22, RUNE_RGB, 0.3)] });
  });

  // ------------------------------------------------------------------ Drake's Menagerie
  def('pet_bed_round', 2, (v) => {
    const W = 16, H = 13, b = H - 1, P = new Pix(W, H), R = v ? FOREST : PLUM;
    P.ell(7.5, b - 4, 7, 3.6, (x, y, nx, ny) => { const s = -nx * 0.5 - ny * 0.8; P.set(x, y, R[s > 0.5 ? 5 : s > 0 ? 4 : s > -0.5 ? 3 : 2]); });
    P.ell(7.5, b - 5, 4.6, 1.9, (x, y, nx, ny) => { let c; if (v) { const gx = (x >> 1) & 1, gy = y & 1; c = gx && gy ? '#7a2a2a' : gx || gy ? '#b04a3a' : '#e8d8b8'; } else c = ny < 0 ? CREAM[4] : CREAM[5]; P.set(x, y, c); });
    if (v) { P.set(10, b - 6, BONE[4]); P.set(11, b - 6, BONE[3]); P.set(12, b - 6, BONE[4]); P.set(10, b - 7, BONE[4]); P.set(12, b - 7, BONE[3]); }
    else for (const [x, y] of [[6, b - 1], [8, b - 1], [7, b - 2]]) P.set(x, y, R[2]);
    P.outline(OUT); P.shadow(9, b, 7, 1.3);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('perch_stand', 1, () => {
    const W = 16, H = 32, b = H - 1, P = new Pix(W, H), R = WALNUT;
    P.ell(7.5, b - 2, 6, 1.6, (x, y, nx) => P.set(x, y, nx < -0.3 ? R[5] : R[3])); P.hline(3, 12, b - 1, R[1]);
    for (let x = 4; x <= 11; x += 2) P.set(x, b - 3, STRAW[4]);
    for (let y = 9; y <= b - 3; y++) { P.set(7, y, R[4]); P.set(8, y, R[2]); }
    for (let x = 1; x <= 14; x++) { P.set(x, 8, x % 2 ? '#d0b080' : '#a88858'); P.set(x, 9, x % 2 ? '#8a6a48' : '#6a4a30'); }
    P.ell(7.5, 5, 2, 2, (x, y, nx, ny) => { if (nx * nx + ny * ny > 0.4) P.set(x, y, nx + ny < 0 ? BRASS[5] : BRASS[3]); });
    P.vline(13, 10, 13, '#c8a878'); P.set(13, 14, CRIMSON[4]); P.set(13, 15, '#f2c45a'); P.set(13, 16, BRASS[4]); P.set(12, 16, BRASS[3]); P.set(14, 16, BRASS[2]);
    P.rect(2, 10, 3, 2, BRASS[3]); P.hline(2, 4, 10, BRASS[4]); P.set(3, 10, STRAW[4]);
    P.outline(OUT); P.shadow(9, b, 6, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('hay_bale', 1, () => {
    const W = 16, H = 16, b = H - 1, P = new Pix(W, H);
    for (let y = b - 12; y <= b - 9; y++) for (let x = 1; x <= 14; x++) P.set(x, y, STRAW[(x + y * 3) % 4 === 0 ? 3 : y === b - 12 ? 5 : 4]);
    for (let y = b - 8; y <= b - 1; y++) for (let x = 1; x <= 14; x++) { let c = STRAW[hash(x, y, 91) < 0.3 ? 2 : (x + Math.floor(y / 2)) % 3 === 0 ? 3 : 4]; if (x === 1) c = STRAW[5]; if (x === 14) c = STRAW[2]; P.set(x, y, c); }
    for (const tx of [4, 11]) for (let y = b - 12; y <= b - 1; y++) P.set(tx, y, y < b - 8 ? '#8a6a3a' : '#6a4a28');
    for (const [x, y, c] of [[0, b - 6, STRAW[4]], [15, b - 4, STRAW[3]], [6, b - 13, STRAW[4]], [9, b - 14, STRAW[5]], [12, b - 13, STRAW[3]], [2, b - 13, STRAW[4]]]) P.set(x, y, c);
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('saddle_rack', 1, () => {
    const W = 20, H = 48, P = new Pix(W, H), T = TANL;
    for (let y = 13; y <= 17; y++) for (let x = 8; x <= 11; x++) P.set(x, y, OAK[x === 8 ? 5 : 3]);
    for (let x = 1; x <= 18; x++) for (let y = 27; y <= 29; y++) P.set(x, y, y === 29 ? CRIMSON[2] : ((x >> 1) % 2) ? CRIMSON[4] : CREAM[4]); // saddle blanket edge
    for (const [x0, x1] of [[2, 8], [11, 17]]) for (let y = 18; y <= 27; y++) for (let x = x0; x <= x1; x++) { if (y === 27 && (x === x0 || x === x1)) continue; P.set(x, y, x === x0 ? T[4] : x === x1 ? T[1] : T[2]); }
    for (let k = 0; k < 6; k++) { P.set(3 + k, 24 - Math.round(Math.sin(k / 5 * Math.PI) * 2), T[4]); P.set(16 - k, 24 - Math.round(Math.sin(k / 5 * Math.PI) * 2), T[3]); }
    for (let x = 3; x <= 16; x++) { const top = 15 + Math.round(2.2 * Math.sin(Math.PI * (x - 3) / 13)); for (let y = top; y <= 19; y++) P.set(x, y, y === top ? T[5] : y === 19 ? T[1] : x < 9 ? T[4] : T[3]); }
    for (let y = 11; y <= 15; y++) { P.set(3, y, y === 11 ? BRASS[5] : T[5]); P.set(4, y, y === 11 ? BRASS[3] : T[4]); }
    for (let y = 12; y <= 15; y++) { P.set(15, y, T[3]); P.set(16, y, T[1]); }
    for (const sx of [5, 14]) { P.vline(sx, 26, 31, T[1]); P.hline(sx - 1, sx + 1, 33, IRON[4]); P.set(sx - 1, 32, IRON[4]); P.set(sx + 1, 32, IRON[3]); P.set(sx, 32, IRON[1]); }
    for (const [x, y] of [[4, 20], [7, 21], [12, 21], [15, 20], [9, 18]]) P.set(x, y, BRASS[4]);
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 10, ay: H - 1, foot: [1, 1], solid: true, wall: true });
  });

  def('egg_incubator', 1, () => {
    const W = 16, H = 26, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H);
      P.line(4, b - 6, 2, b - 1, BRASS[3]); P.line(11, b - 6, 13, b - 1, BRASS[2]); P.line(7, b - 6, 7, b - 1, BRASS[2]);
      P.ell(7.5, b - 7, 6.2, 2.4, (x, y, nx, ny) => P.set(x, y, ny > 0.2 ? BRASS[2] : nx < -0.4 ? BRASS[5] : BRASS[4]));
      P.ell(7.5, b - 8, 5, 1.4, (x, y) => P.set(x, y, hash(x, y, 40 + f) < 0.35 ? (f % 2 ? AMBER : ORANGE) : hash(x, y, 41) < 0.5 ? STRAW[3] : STRAW[2]));
      const wob = f === 2 ? 0.6 : 0;
      P.ell(7.5 + wob, b - 13, 3.6, 5, (x, y, nx, ny) => { const s = -nx * 0.6 - ny * 0.6; let c = MAGIC[s > 0.5 ? 4 : s > 0.1 ? 3 : s > -0.4 ? 2 : 1]; if ((x + (y >> 1)) % 3 === 0 && y % 2 === 0) c = mix(c, '#2a1840', 0.35); P.set(x, y, c); });
      const glow = f % 2 ? '#ffd0f0' : '#f0a0e0';
      P.set(7, b - 12, glow); P.set(8, b - 13, glow); P.set(8, b - 11, '#e080d0'); P.set(7, b - 14, f % 2 ? '#ffffff' : glow);
      P.outline(OUT);
      if (f % 2) P.set(11, b - 19, '#ffd0f0');
      P.shadow(9, b, 6, 1.4);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, b - 13, 42, [230, 120, 255], 0.6, 1), L(7.5, b - 8, 22, [255, 150, 70], 0.4, 1)] }, draw, 4, 3);
  });

  def('aquarium', 1, () => {
    const W = 32, H = 36, b = H - 1, R = WALNUT, tx0 = 2, tx1 = 29, ty0 = b - 27, ty1 = b - 11;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let y = b - 10; y <= b - 1; y++) for (let x = 2; x <= 29; x++) P.set(x, y, x <= 3 ? R[5] : x >= 28 ? R[2] : y === b - 10 ? R[6] : x === 15 || x === 16 ? R[1] : R[3]);
      P.set(13, b - 5, BRASS[4]); P.set(18, b - 5, BRASS[4]);
      for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
        let c;
        if (x === tx0 || x === tx1 || y === ty1) c = '#3a4a5a';
        else if (y === ty0) c = '#2a3440';
        else if (y === ty0 + 1) c = '#8ad0e8';
        else if (y >= ty1 - 2) c = ['#c8a070', '#8a6a5a', '#e0d0b0', '#6a8a7a'][Math.floor(hash(x, y, 7) * 4)];
        else c = rampAt(['#1a4a6a', '#226282', '#2c7a9a', '#3a90b0'], 1 - (y - ty0) / (ty1 - ty0), x, y);
        P.set(x, y, c);
      }
      P.line(tx0 + 2, ty0 + 3, tx0 + 4, ty0 + 5, '#bfe8f6'); P.set(tx1 - 2, ty0 + 3, '#bfe8f6');
      for (const [px, h2, c] of [[5, 9, LEAF[4]], [7, 6, LEAF[3]], [24, 10, LEAF[4]], [26, 7, '#8a3a62']]) for (let j = 0; j < h2; j++) P.set(px + (j > 2 && ((j + f) % 4) < 2 ? 1 : 0), ty1 - 3 - j, c);
      stamp(P, 14, ty1 - 7, ['#.#.#', '#####', '##.##', '##.##'], { '#': (i) => (i < 2 ? '#a8a4b8' : '#7e7a92') });
      [[ORANGE, AMBER, 8], [MAGIC[3], MAGIC[4], 13], ['#f2c45a', '#fff0a0', 5]].forEach(([c1, c2, fy], k) => { const fx = [6, 17, 21][k] + [0, 1, 2, 1][(f + k) % 4]; const y = ty0 + fy; P.set(fx - 1, y - 1, c1); P.set(fx - 1, y + 1, c1); P.set(fx, y, c1); P.set(fx + 1, y, c1); P.set(fx + 2, y, c2); });
      for (let k = 0; k < 3; k++) P.set(16, ty1 - 9 - ((f + k * 3) % 8), '#c4e6ff');
      P.outline(OUT); P.shadow(17, b, 15, 1.6);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(16, b - 19, 46, [90, 200, 230], 0.55)] }, draw, 4, 4);
  });

  def('feed_counter', 1, () => {
    const W = 32, H = 36, b = H - 1, P = new Pix(W, H), R = HONEY, yTop = b - 22, yLip = b - 15;
    for (let x = 1; x <= 30; x++) {
      for (let y = yTop; y < yLip; y++) P.set(x, y, y === yTop ? R[3] : (y - yTop) % 3 === 1 ? R[5] : R[4]);
      P.set(x, yLip, R[6]); P.set(x, yLip + 1, R[2]); P.set(x, yLip + 2, R[0]);
      for (let y = yLip + 3; y <= b - 1; y++) { const lx = (x - 1) % 15; P.set(x, y, y >= b - 2 ? (y === b - 2 ? R[4] : R[1]) : lx === 0 ? R[1] : lx === 1 ? R[4] : R[3]); }
    }
    P.d[yTop * W + 1] = 0; P.d[yTop * W + 30] = 0;
    P.vline(7, yTop - 6, yTop + 2, BRASS[4]); P.hline(3, 11, yTop - 6, BRASS[4]); P.set(7, yTop - 7, BRASS[5]);
    for (const [px, d] of [[3, 0], [11, 1]]) { P.hline(px - 2, px + 2, yTop - 3 + d, BRASS[3]); P.hline(px - 1, px + 1, yTop - 2 + d, BRASS[2]); P.set(px - 2, yTop - 4 + d, BRASS[5]); P.set(px + 2, yTop - 4 + d, BRASS[5]); }
    P.hline(5, 9, yTop + 3, BRASS[2]);
    for (let y = yTop - 4; y <= yTop + 3; y++) for (let x = 14; x <= 18; x++) P.set(x, y, x === 14 ? GLASS[3] : x === 18 ? GLASS[1] : hash(x, y, 5) < 0.5 ? '#c8945a' : '#a8743e');
    P.hline(14, 18, yTop - 5, CRIMSON[3]);
    P.set(22, yTop + 1, BRASS[5]); P.set(21, yTop + 2, BRASS[4]); P.set(22, yTop + 2, BRASS[4]); P.set(23, yTop + 2, BRASS[2]); P.set(22, yTop, BRASS[3]);
    for (const [sx, sh] of [[20, 0], [25, 1]]) { for (let y = b - 9 + sh; y <= b - 1; y++) for (let x = sx; x <= sx + 5; x++) P.set(x, y, x === sx ? '#c8aa78' : x === sx + 5 ? '#7a5e3a' : (x + y) % 3 === 0 ? '#9a7c50' : '#b0905e'); P.hline(sx + 1, sx + 4, b - 10 + sh, '#8a6a40'); P.set(sx + 2, b - 11 + sh, '#c8aa78'); P.set(sx + 2, b - 5 + sh, '#5a3a20'); P.set(sx + 3, b - 5 + sh, '#5a3a20'); P.set(sx + 2, b - 6 + sh, '#5a3a20'); }
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('pet_cage', 1, () => {
    const W = 16, H = 27, b = H - 1, P = new Pix(W, H), B = BRASS;
    P.hline(5, 8, b - 4, CREAM[4]); P.set(6, b - 5, STRAW[4]); P.set(7, b - 5, STRAW[3]);
    for (let y = b - 14; y <= b - 8; y++) P.set(11, y, y < b - 11 ? '#c4e6ff' : '#69a1db'); P.set(11, b - 7, SILVER[3]);
    for (let x = 2; x <= 13; x += 2) for (let y = b - 17; y <= b - 4; y++) P.set(x, y, x < 8 ? B[4] : B[3]);
    for (let x = 2; x <= 13; x++) { const top = b - 17 - Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((x - 7.5) / 6, 2))) * 6); P.set(x, top, x < 8 ? B[5] : B[3]); if (x % 2 === 0) for (let y = top + 1; y < b - 17; y++) P.set(x, y, B[4]); }
    for (const ry of [b - 17, b - 10]) P.hline(2, 13, ry, B[5]);
    P.ell(7.5, b - 25, 1.4, 1.2, (x, y, nx, ny) => { if (nx * nx + ny * ny > 0.3) P.set(x, y, B[4]); });
    for (let y = b - 3; y <= b - 1; y++) for (let x = 1; x <= 14; x++) P.set(x, y, y === b - 3 ? WALNUT[5] : x === 1 ? WALNUT[4] : WALNUT[2]);
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('dragon_perch', 1, () => {
    const W = 34, H = 54, b = H - 1, P = new Pix(W, H), R = WOOD;
    for (const px of [6, 26]) for (let y = 8; y <= b - 16; y++) { P.set(px, y, R[3]); P.set(px + 1, y, R[1]); }
    P.line(8, 12, 25, 20, R[2]); P.line(25, 12, 8, 20, R[1]);
    for (let y = b - 24; y <= b - 17; y++) for (let x = 2; x <= 31; x++) P.set(x, y, y === b - 17 ? R[1] : y === b - 24 ? R[5] : x % 5 === 0 ? R[2] : R[4]);
    for (let x = 2; x <= 31; x++) { P.set(x, b - 16, R[3]); P.set(x, b - 15, R[1]); }
    for (const px of [2, 29]) for (let y = 8; y <= b - 1; y++) { P.set(px, y, R[4]); P.set(px + 1, y, R[2]); P.set(px + 2, y, y > b - 24 ? R[1] : R[2]); }
    P.line(5, b - 14, 10, b - 4, R[3]); P.line(28, b - 14, 23, b - 4, R[2]);
    for (let x = 0; x <= 33; x++) { P.set(x, 5, R[5]); P.set(x, 6, R[4]); P.set(x, 7, R[3]); P.set(x, 8, R[1]); if (x % 7 === 3) { P.set(x, 6, R[2]); P.set(x + 1, 7, R[2]); } }
    P.set(0, 6, R[4]); P.set(33, 6, R[2]);
    P.ell(16.5, b - 22, 10.5, 3.6, (x, y, nx, ny) => { const d = nx * nx + ny * ny; P.set(x, y, d > 0.55 ? (hash(x, y, 9) < 0.5 ? STRAW[2] : '#5a3a20') : d > 0.25 ? STRAW[4] : STRAW[3]); });
    P.ell(16.5, b - 22.6, 6, 1.6, (x, y) => P.set(x, y, hash(x, y, 10) < 0.5 ? STRAW[2] : '#6a4a20'));
    for (const [x0, y0, x1, y1] of [[6, b - 23, 3, b - 26], [26, b - 22, 30, b - 25], [12, b - 25, 10, b - 28], [22, b - 25, 24, b - 28]]) P.line(x0, y0, x1, y1, '#5a3a20');
    P.set(19, b - 23, GL.violet[4]); P.set(20, b - 23, GL.violet[3]);
    P.vline(31, 9, 14, '#c8a878'); P.ell(31, 16, 1.4, 1.4, (x, y, nx, ny) => { if (nx * nx + ny * ny > 0.3) P.set(x, y, IRON[4]); });
    for (const [sx, sy] of [[1, b - 1], [6, b], [27, b], [31, b - 1]]) P.ell(sx, sy - 1, 1.6, 1, (x, y) => P.set(x, y, STONE[3]));
    P.outline(OUT); P.shadow(18, b, 16, 2.4);
    return sprite({ c: P.canvas(), ax: 17, ay: b, foot: [2, 2], solid: true, fade: true });
  });

  // ------------------------------------------------------------------ the Silver Crescent Guild hall
  const CREST_BLADE = [SILVER[4], SILVER[6], SILVER[2]], CREST_MOON = [SILVER[4], SILVER[5]], CREST_HILT = [GOLD[3], GOLD[5]];
  const QUARRY = { slime: ['.###.', '#.#.#', '#####', '#####'], wolf: ['#...#', '##.##', '.###.', '..#..'], wyrm: ['..##.', '.#...', '..##.', '...#.', '.##..'], bat: ['#.#.#', '#####', '.###.', '..#..'], web: ['#.#.#', '.###.', '##.##', '.###.', '#.#.#'], wisp: ['..#..', '.###.', '.###.', '..#..'] };
  def('contract_board', 1, () => {
    const W = 48, H = 48, P = new Pix(W, H), R = OAK;
    for (let x = 1; x <= 46; x++) { const pk = Math.round(4 - Math.abs(x - 23.5) / 6); for (let y = 10 - pk; y <= 11; y++) P.set(x, y, y === 10 - pk ? R[6] : (x + y) % 3 === 0 ? R[2] : R[4]); }
    for (let y = 12; y <= 39; y++) for (let x = 2; x <= 45; x++) { const fr = x <= 3 || x >= 44 || y <= 13 || y >= 38; P.set(x, y, fr ? (x <= 3 || y <= 13 ? R[5] : R[2]) : hash(x, y, 3) < 0.15 ? '#5a3e2e' : '#6e4e38'); }
    for (let y = 1; y <= 9; y++) { const hw = y < 7 ? 6 : 6 - (y - 6) * 2; for (let x = Math.round(23.5 - hw); x <= Math.round(23.5 + hw) - 1; x++) P.set(x, y, x < 22 ? R[5] : R[3]); }
    crest(P, 23, 5, CREST_BLADE, CREST_MOON, CREST_HILT);
    const notes = [[5, 15, 11, 12, 'slime', 2], [18, 16, 10, 11, 'wolf', 3], [31, 15, 12, 13, 'wyrm', 5], [6, 28, 10, 9, 'bat', 1], [19, 28, 9, 9, 'web', 2], [31, 29, 11, 8, 'wisp', 2]];
    for (const [nx, ny, nw, nh, kind, sk] of notes) {
      for (let y = ny; y < ny + nh; y++) for (let x = nx; x < nx + nw; x++) P.set(x, y, x === nx + nw - 1 || y === ny + nh - 1 ? PAPER[1] : hash(x, y, nx) < 0.1 ? PAPER[2] : PAPER[3]);
      stamp(P, nx + 2, ny + 2, QUARRY[kind], { '#': '#3a2a2a' });
      P.hline(nx + 8 > nx + nw - 2 ? nx + 2 : nx + 8, nx + nw - 3, ny + 3, PAPER[1]);
      for (let k = 0; k < sk; k++) P.set(nx + 1 + k * 2, ny + nh - 3, k < 3 ? '#3a2a2a' : CRIMSON[3]);
      P.set(nx + (nw >> 1), ny, CRIMSON[4]); P.set(nx + (nw >> 1), ny - 1, CRIMSON[5]);
    }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 24, ay: H - 1, foot: [3, 1], solid: true, wall: true });
  });

  def('trophy_wolf', 1, () => {
    const W = 20, H = 48, P = new Pix(W, H), F = ['#2a2a30', '#3e3e48', '#56566a', '#727284', '#9090a0', '#b4b4c2'];
    for (let y = 14; y <= 31; y++) { const hw = y < 26 ? 7.5 : 7.5 - (y - 25) * 1.3; for (let x = Math.round(9.5 - hw); x <= Math.round(9.5 + hw) - 1; x++) P.set(x, y, x < 7 ? OAK[5] : x > 12 ? OAK[2] : OAK[4]); }
    P.hline(7, 12, 28, BRASS[4]); P.hline(7, 12, 29, BRASS[2]);
    const fur = (x, y, nx, ny) => { const s = -nx * 0.6 - ny * 0.7; P.set(x, y, F[s > 0.5 ? 5 : s > 0.1 ? 4 : s > -0.3 ? 3 : 2]); };
    stamp(P, 4, 8, ['#....', '##...', '###..', '###..'], { '#': (i) => (i < 1 ? F[4] : F[3]) }); stamp(P, 12, 8, ['....#', '...##', '..###', '..###'], { '#': (i) => (i > 3 ? F[1] : F[2]) });
    P.set(5, 10, PINK[1]); P.set(14, 10, PINK[1]);
    for (let y = 18; y <= 24; y++) for (let x = 3; x <= 16; x++) if (Math.abs(x - 9.5) < 6.5 - (y - 18) * 0.5 + (hash(x, y, 4) < 0.5 ? 1 : 0)) P.set(x, y, x < 9 ? F[3] : F[2]); // ruff
    P.ell(9.5, 15, 5, 4.2, fur);
    P.ell(9.5, 20, 2.8, 3, (x, y, nx, ny) => P.set(x, y, ny < -0.3 ? F[4] : nx < 0 ? F[3] : F[2]));
    P.set(9, 22, '#120c1c'); P.set(10, 22, '#120c1c'); P.set(9, 21, F[1]);
    P.hline(8, 11, 24, '#5a1e2a'); P.set(8, 23, '#f2ece6'); P.set(11, 23, '#f2ece6'); P.set(8, 25, '#f2ece6'); P.set(11, 25, '#d8d0cc');
    for (const ex of [7, 12]) { P.set(ex, 15, AMBER); P.set(ex + (ex < 9 ? 1 : -1), 15, '#120c1c'); }
    for (const [x, y] of [[8, 11], [9, 11], [11, 12], [5, 19], [14, 20], [6, 22]]) P.set(x, y, hash(x, y, 2) < 0.5 ? LEAF[4] : LEAF[3]);
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 10, ay: H - 1, foot: [1, 1], solid: true, wall: true });
  });

  def('trophy_stag', 1, () => {
    const W = 28, H = 48, P = new Pix(W, H);
    for (let y = 17; y <= 33; y++) { const hw = y < 28 ? 6 : 6 - (y - 27) * 1.2; for (let x = Math.round(13.5 - hw); x <= Math.round(13.5 + hw) - 1; x++) P.set(x, y, x < 11 ? WALNUT[5] : x > 16 ? WALNUT[2] : WALNUT[4]); }
    for (const sd of [-1, 1]) {
      const bx = 13.5 + sd * 2.5, by = 15;
      for (let t = 0; t <= 1.0001; t += 0.05) { const x = bx + sd * (t * 8 + t * t * 3), y = by - t * 13; P.set(x, y, sd < 0 ? BONE[4] : BONE[3]); if (t < 0.4) P.set(x + sd, y, sd < 0 ? BONE[3] : BONE[2]); }
      for (const tt of [0.3, 0.55, 0.8]) { const x0 = bx + sd * (tt * 8 + tt * tt * 3), y0 = by - tt * 13; for (let k = 1; k <= 3; k++) P.set(x0 - sd * (k > 2 ? 1 : 0), y0 - k, sd < 0 ? BONE[4] : BONE[3]); }
    }
    for (let y = 14; y <= 30; y++) { const hw = y < 19 ? 3.6 : 3.6 - (y - 19) * 0.22; for (let x = Math.round(13.5 - hw); x <= Math.round(13.5 + hw) - 1; x++) P.set(x, y, x < 12 ? BONE[4] : x > 14 ? BONE[2] : BONE[3]); }
    for (const [x, y] of [[11, 18], [12, 18], [11, 19], [15, 18], [16, 18], [16, 19]]) P.set(x, y, '#2a1e2e');
    P.set(13, 28, '#4a3e4e'); P.set(14, 28, '#4a3e4e'); P.set(13, 23, BONE[2]); P.set(14, 25, BONE[2]);
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 14, ay: H - 1, foot: [1, 1], solid: true, wall: true });
  });

  def('slime_jar', 1, () => {
    const W = 16, H = 27, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H);
      P.hline(2, 13, b - 1, OAK[2]); P.hline(2, 13, b - 2, OAK[4]); P.set(2, b - 2, OAK[5]);
      for (let y = b - 18; y <= b - 3; y++) for (let x = 3; x <= 12; x++) { const edge = x === 3 || x === 12 || y === b - 3; P.set(x, y, edge ? (x === 3 ? '#a8c8c0' : '#4a6a64') : y < b - 15 ? '#2a3a3a' : '#1e4a38'); }
      const sq = [0, 1, 0, -1][f];
      P.ell(7.5, b - 8, 3.6 + sq * 0.5, 3.2 - sq * 0.4, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.5 ? '#b4ffd9' : nx + ny < 0.3 ? '#5dffb0' : '#2fbf7f'));
      P.set(6, b - 9, '#120c1c'); P.set(9, b - 9, '#120c1c'); P.set(6, b - 10, '#ffffff'); P.set(9, b - 10, '#ffffff'); P.set(7, b - 7, '#1f6a4a'); P.set(8, b - 7, '#1f6a4a');
      P.set(5 + f, b - 14 + (f % 2), '#b4ffd9'); P.set(10 - (f % 2), b - 16, '#5dffb0');
      P.vline(4, b - 16, b - 12, '#d8f0e8');
      P.hline(3, 12, b - 19, BRASS[3]); P.hline(4, 11, b - 20, BRASS[4]); P.set(7, b - 21, BRASS[5]); P.set(8, b - 21, BRASS[3]);
      P.outline(OUT);
      P.set(12, b - 18, PAPER[3]); P.set(13, b - 17, PAPER[3]); P.set(13, b - 16, PAPER[2]);
      P.shadow(9, b, 6, 1.4);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, b - 9, 36, [93, 255, 150], 0.6)] }, draw, 4, 3);
  });

  def('guild_banner', 3, (v) => {
    const W = 16, H = 48, P = new Pix(W, H), C = [MIDNIGHT, CRIMSON, FOREST][v], M = v === 1 ? GOLD : SILVER, T = v === 1 ? GOLD[4] : SILVER[4];
    for (let x = 1; x <= 14; x++) P.set(x, 4, x < 3 || x > 12 ? IRON[5] : IRON[4]); P.set(0, 4, GOLD[4]); P.set(15, 4, GOLD[3]);
    P.line(3, 4, 7, 1, IRON[3]); P.line(12, 4, 8, 1, IRON[3]); P.set(7, 0, IRON[4]); P.set(8, 0, IRON[4]);
    for (let y = 5; y <= 37; y++) for (let x = 3; x <= 12; x++) {
      if (y >= 31 && Math.abs(x - 7.5) < (y - 31) * 0.85) continue;
      let c = C[x === 3 ? 4 : x === 12 ? 1 : x === 6 || x === 9 ? 2 : 3];
      if (x === 3 || x === 12 || y === 5) c = T;
      if (y >= 31 && Math.abs(Math.abs(x - 7.5) - (y - 31) * 0.85) < 0.9) c = T;
      P.set(x, y, c);
    }
    crest(P, 7, 16, v === 1 ? [GOLD[4], GOLD[6], GOLD[2]] : CREST_BLADE, v === 1 ? [GOLD[4], GOLD[5]] : CREST_MOON, [GOLD[3], GOLD[5]]);
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: H - 1, foot: [1, 1], solid: true, wall: true });
  });

  def('long_table', 1, () => {
    const W = 48, H = 34, b = H - 1, R = OAK;
    let fl = null;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (const lx of [5, 40]) { for (let y = b - 12; y <= b - 5; y++) { P.set(lx, y, R[4]); P.set(lx + 1, y, R[2]); } P.hline(lx - 2, lx + 3, b - 6, R[3]); }
      P.hline(7, 39, b - 9, R[2]);
      for (let y = b - 19; y <= b - 13; y++) for (let x = 1; x <= 46; x++) P.set(x, y, y === b - 13 ? R[3] : y === b - 14 ? R[6] : (y - (b - 19)) % 3 === 2 ? R[3] : x === 1 ? R[6] : R[5]);
      for (let x = 3; x <= 44; x++) { P.set(x, b - 5, R[6]); P.set(x, b - 4, R[4]); P.set(x, b - 3, R[2]); }
      for (const lx of [5, 42]) { P.set(lx, b - 2, R[3]); P.set(lx, b - 1, R[2]); P.set(lx + 1, b - 2, R[1]); P.set(lx + 1, b - 1, R[1]); }
      P.ell(7, b - 18, 3, 1.6, (x, y, nx, ny) => P.set(x, y, ny < -0.2 ? '#e0a860' : '#b87838')); P.set(6, b - 19, '#f0c890'); P.set(8, b - 18, '#8a5a30');
      P.ell(16, b - 16, 4.6, 1.6, (x, y) => P.set(x, y, SILVER[4])); P.ell(16, b - 17, 3, 1.6, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.3 ? '#c8783c' : '#8a4a24')); P.set(19, b - 19, BONE[4]); P.set(20, b - 20, BONE[3]);
      tankard(P, 23, b - 15); tankard(P, 36, b - 14);
      for (const [x, y] of [[42, b - 17], [43, b - 18], [44, b - 17], [43, b - 16], [42, b - 16]]) P.set(x, y, x === 42 ? MAGIC[2] : MAGIC[1]);
      fl = brassStick(P, 30, b - 16, 5, f);
      P.outline(OUT); P.shadow(25, b, 23, 1.8);
      return P;
    };
    draw(0);
    return build({ ax: 24, ay: b, foot: [3, 1], solid: true, lights: [L(fl.x, fl.y - 1, 40, L_CANDLE, 0.65, 1)] }, draw, 4, 6);
  });

  def('map_table', 1, () => {
    const W = 32, H = 42, b = H - 1, R = OAK;
    let fl = null;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (const lx of [2, 28]) for (let y = b - 6; y <= b - 1; y++) { P.set(lx, y, R[4]); P.set(lx + 1, y, R[2]); }
      for (let x = 1; x <= 30; x++) { P.set(x, b - 8, R[4]); P.set(x, b - 7, R[2]); }
      for (let y = b - 33; y <= b - 9; y++) for (let x = 1; x <= 30; x++) P.set(x, y, x === 1 || y === b - 33 ? R[6] : x === 30 ? R[3] : y === b - 9 ? R[5] : R[4]);
      for (let y = b - 31; y <= b - 11; y++) for (let x = 3; x <= 28; x++) { const e = Math.min(x - 3, 28 - x, y - (b - 31), b - 11 - y); P.set(x, y, e === 0 ? (hash(x, y, 2) < 0.5 ? '#8a6a4a' : PAPER[1]) : e === 1 ? PAPER[2] : hash(x, y, 3) < 0.08 ? PAPER[2] : PAPER[3]); }
      for (let t = 0; t <= 1.0001; t += 0.02) P.set(5 + t * 21 + Math.sin(t * 9) * 1.6, b - 30 + t * 18, '#4a7aa8');
      for (const [x, y] of [[7, b - 18], [9, b - 20], [8, b - 15], [21, b - 28], [23, b - 26]]) { P.set(x, y, LEAF[3]); P.set(x + 1, y, LEAF[2]); P.set(x, y - 1, LEAF[4]); }
      for (const [x, y] of [[13, b - 27], [17, b - 25]]) stamp(P, x, y, ['..#..', '.#w#.', '#####'], { '#': '#6a6070', w: '#ffffff' });
      P.ell(23, b - 16, 2.4, 1.3, (x, y) => P.set(x, y, '#5a8ac0'));
      for (const [x, y] of [[20, b - 21], [22, b - 19], [21, b - 20]]) P.set(x, y, CRIMSON[4]); P.set(22, b - 21, CRIMSON[4]); P.set(20, b - 19, CRIMSON[4]);
      for (let k = 0; k < 6; k++) P.set(10 + k * 2, b - 13 - (k % 2), '#8a5a3a');
      for (const [x, y, C] of [[8, b - 24, GL.azure], [12, b - 16, CRIMSON], [19, b - 27, SILVER], [25, b - 13, GOLD]]) { P.set(x, y, C[3]); P.set(x, y - 1, C[4] || C[3]); P.set(x, y + 1, C[1]); }
      P.vline(16, b - 23, b - 21, SILVER[5]); P.hline(15, 17, b - 24, GOLD[3]); P.vline(16, b - 27, b - 25, '#2a1e1e'); P.set(16, b - 28, GOLD[4]);
      P.ell(6, b - 13, 2, 1.4, (x, y, nx, ny) => { if (nx * nx + ny * ny > 0.4) P.set(x, y, BRASS[4]); }); P.set(6, b - 13, CRIMSON[4]); P.set(7, b - 14, CRIMSON[3]);
      P.hline(26, 29, b - 32, BRASS[3]); fl = candle(P, 27, b - 33, 4, 2, f);
      P.outline(OUT); P.shadow(17, b, 15, 2);
      return P;
    };
    draw(0);
    return build({ ax: 16, ay: b, foot: [2, 2], solid: true, lights: [L(fl.x, fl.y - 1, 40, L_CANDLE, 0.6, 1)] }, draw, 4, 6);
  });

  def('guild_desk', 1, () => {
    const W = 32, H = 36, b = H - 1, R = OAK;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let y = b - 13; y <= b - 1; y++) for (let x = 1; x <= 30; x++) P.set(x, y, x <= 2 ? R[5] : x >= 29 ? R[1] : y >= b - 2 ? R[2] : R[3]);
      for (const [x0, x1] of [[4, 12], [19, 27]]) for (let y = b - 11; y <= b - 4; y++) for (let x = x0; x <= x1; x++) P.set(x, y, y === b - 11 || x === x0 ? R[5] : y === b - 4 || x === x1 ? R[1] : R[3]);
      stamp(P, 14, b - 10, ['#..#', '.##.', '#..#', '.##.'], { '#': SILVER[4] });
      for (let x = 1; x <= 30; x++) { P.set(x, b - 17, R[4]); P.set(x, b - 16, R[5]); P.set(x, b - 15, R[5]); P.set(x, b - 14, R[6]); }
      for (let k = 0; k < 3; k++) for (let x = 3 + k; x <= 9 + k; x++) P.set(x, b - 17 - k, k % 2 ? PAPER[3] : PAPER[4]);
      P.set(5, b - 19, CRIMSON[4]);
      P.rect(11, b - 18, 2, 2, '#1a1622'); P.line(12, b - 19, 14, b - 24, '#e8e0f0'); P.set(14, b - 25, '#c8c0d8');
      P.set(16, b - 17, '#6a3a24'); P.set(17, b - 17, '#4a2818'); P.set(16, b - 18, '#8a5a34'); P.hline(18, 20, b - 17, '#3a2418');
      skull5(P, 20, b - 21);
      P.hline(25, 29, b - 17, BRASS[3]); P.hline(26, 28, b - 18, BRASS[4]); P.set(26, b - 23, '#b8c8d8'); P.set(28, b - 23, '#8a9ab0'); for (let y = b - 22; y <= b - 19; y++) { P.set(26, y, '#b8c8d8'); P.set(28, y, '#8a9ab0'); }
      flame(P, 27, b - 19, f, 'warm', 1);
      P.outline(OUT);
      for (let j = 0; j < 4; j++) { const x = 16 + Math.round(Math.sin((j + f) * 0.9)), y = b - 20 - j - (f % 2); if (!P.has(x, y)) P.set(x, y, '#d8d0e0', (0.45 - j * 0.09) * 255); }
      P.shadow(17, b, 15, 1.8);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(27, b - 21, 46, [255, 180, 100], 0.7, 1)] }, draw, 4, 5);
  });

  def('guild_hearth', 1, () => {
    const W = 48, H = 52, ay = 47, S = ['#1c1b24', '#2a2934', '#3a3946', '#4b4a59', '#5e5c6c', '#737184', '#8c8a9c'];
    const FIRE = ['#8a2a1a', EMBERC, ORANGE, AMBER, '#ffe0a0', '#fff8e4'];
    const inOpen = (x, y) => { if (x < 12 || x > 35 || y < 30 || y > 46) return false; const hw = y >= 33 ? 12 : y === 32 ? 11 : y === 31 ? 9 : 6; return Math.abs(x - 23.5) <= hw; };
    const base = new Pix(W, H), B = base;
    for (let y = 0; y <= 24; y++) for (let x = 5; x <= 42; x++) {
      const course = Math.floor(y / 6), off = (course % 2) * 5, lx = (x - 5 + off) % 11, ly = y % 6;
      let k = hash(Math.floor((x - 5 + off) / 11), course, 17) < 0.4 ? 4 : 3;
      if (ly === 5 || lx === 0) k = 1; else if (ly === 0 || lx === 1) k++;
      if (x === 5) k = 5; if (x === 42) k = 1;
      B.set(x, y, S[k]);
    }
    for (let y = 3; y <= 19; y++) { const hw = y < 15 ? 8 : 8 - (y - 14) * 1.6; for (let x = Math.round(23.5 - hw); x <= Math.round(23.5 + hw) - 1; x++) B.set(x, y, x < 21 ? S[6] : x > 26 ? S[3] : S[5]); }
    crest(B, 23, 10, CREST_BLADE, CREST_MOON, CREST_HILT);
    for (let x = 1; x <= 46; x++) { B.set(x, 25, S[5]); B.set(x, 26, S[6]); B.set(x, 27, S[4]); B.set(x, 28, x % 3 === 0 ? S[2] : S[3]); B.set(x, 29, S[1]); }
    for (const cx of [3, 41]) for (let j = 0; j < 5; j++) for (let i = 0; i < 5 - Math.floor(j / 2); i++) B.set(cx + i + (cx > 20 ? Math.floor(j / 2) : 0), 30 + j, i === 0 ? S[5] : S[3]);
    for (let y = 30; y <= 46; y++) for (let x = 5; x <= 42; x++) { if (inOpen(x, y)) continue; let k = 3; if (x === 5 || x === 36) k = 5; else if (x === 11 || x === 42) k = 1; else if (x === 8 || x === 39) k = 4; if (x > 11 && x < 36) k = y < 31 ? 4 : 3; if ((y - 30) % 6 === 5 && (x <= 11 || x >= 36)) k = 2; B.set(x, y, S[k]); }
    for (let y = 30; y <= 46; y++) for (let x = 12; x <= 35; x++) if (inOpen(x, y)) B.set(x, y, (y + x) % 7 === 0 ? '#1a1420' : '#100c16');
    for (let x = 12; x <= 35; x++) { B.set(x, 45, '#2a2028'); B.set(x, 46, '#1e1820'); }
    for (let y = 47; y <= 50; y++) for (let x = 2; x <= 45; x++) B.set(x, y, y === 50 ? S[2] : y === 47 ? S[3] : x % 12 === 0 ? S[2] : y === 48 ? S[5] : S[4]);
    // mantel: a drinking horn, a battered helm, candles
    for (let k = 0; k < 6; k++) { B.set(14 + k, 24 - Math.round(Math.sin(k / 5 * Math.PI) * 2), k < 4 ? BONE[4] : BONE[3]); B.set(14 + k, 25 - Math.round(Math.sin(k / 5 * Math.PI) * 2), BONE[2]); }
    B.set(14, 23, BRASS[4]); B.set(19, 24, BRASS[3]);
    stamp(B, 28, 19, ['.###.', '#####', '#S#S#', '##.##', '#...#'], { '#': (i) => (i < 2 ? STEEL[4] : STEEL[3]), S: '#120c1c' });
    const lights = [];
    const draw = (f) => {
      const P = base.clone();
      for (let x = 15; x <= 32; x++) { P.set(x, 43, WOOD[2]); P.set(x, 44, WOOD[1]); if (x > 17 && x < 30) { P.set(x, 42, WOOD[1]); P.set(x, 41, x % 4 === f % 4 ? AMBER : WOOD[2]); } }
      for (const fx of [14, 33]) { P.vline(fx, 40, 46, IRON[3]); P.set(fx, 39, IRON[5]); }
      const tg = [[14.5, 8, 2.2], [17.5, 11, 2.6], [20.5, 13, 2.8], [23.5, 15, 3.2], [26.5, 13, 2.8], [29.5, 11, 2.6], [32.5, 8, 2.2]];
      for (let y = 29; y <= 42; y++) for (let x = 12; x <= 35; x++) {
        if (!inOpen(x, y)) continue;
        let inten = 0;
        tg.forEach(([tx, th, tw], k) => { const hgt = th * (0.7 + 0.5 * hash(k, f, 131)), sway = (hash(k, f + 7, 133) - 0.5) * 3, t = (42.5 - y) / hgt; if (t < 0 || t >= 1) return; const xc = tx + sway * t * t, wdt = tw * Math.pow(1 - t, 0.75) + 0.35, dx = Math.abs(x + 0.5 - xc); if (dx <= wdt) inten = Math.max(inten, (1 - t) * (1 - (dx / wdt) * 0.55)); });
        if (inten > 0.05) P.set(x, y, FIRE[inten > 0.76 ? 5 : inten > 0.58 ? 4 : inten > 0.42 ? 3 : inten > 0.27 ? 2 : inten > 0.15 ? 1 : 0]);
      }
      for (let k = 0; k < 3; k++) { const sx = 15 + Math.floor(hash(k, f, 141) * 18), sy = 30 + Math.floor(hash(k, f, 142) * 5); if (inOpen(sx, sy)) P.set(sx, sy, AMBER); }
      const c1 = candle(P, 8, 24, 6, 2, f), c2 = candle(P, 38, 24, 5, 2, (f + 2) % 4);
      if (f === 0) lights.push(L(23.5, 37, 82, [255, 150, 70], 1, 1), L(23.5, 31, 46, [255, 200, 120], 0.5, 1), L(c1.x, c1.y, 22, L_CANDLE, 0.45, 1), L(c2.x, c2.y, 22, L_CANDLE, 0.45, 1));
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 24, ay, foot: [3, 1], solid: true, wall: true }, draw, 4, 8);
    s.lights = lights;
    return s;
  });

  // ------------------------------------------------------------------ rare Depths floors
  function fillBooks(P, x0, x1, by, maxH, seed, dusty) {
    let x = x0, k = 0;
    while (x <= x1) {
      const h = hash(k, 1, seed);
      if (hash(k, 2, seed) > 0.93) { x += 2; k++; continue; }
      const wd = h < 0.25 ? 1 : h < 0.8 ? 2 : 3, ht = Math.min(maxH, 4 + Math.floor(hash(k, 3, seed) * (maxH - 3)));
      if (x + wd - 1 > x1) break;
      let Rb = BOOK_R[Math.floor(hash(k, 4, seed) * BOOK_R.length)];
      if (dusty) Rb = Rb.map((c) => mix(c, '#6e665e', 0.38));
      spine(P, x, by, wd, ht, Rb, hash(k, 5, seed) < 0.4 ? (dusty ? '#a8946a' : true) : null);
      if (dusty) for (let i = 0; i < wd; i++) P.set(x + i, by - ht + 1, '#8a8278');
      x += wd; k++;
    }
  }
  def('lib_shelf', 1, () => {
    const W = 32, H = 66, b = H - 1, P = new Pix(W, H), R = BW;
    for (let x = 1; x <= 30; x++) { P.set(x, 1, R[6]); P.set(x, 2, R[5]); P.set(x, 3, x % 3 === 0 ? R[2] : R[4]); P.set(x, 4, R[1]); }
    for (let y = 5; y <= b - 2; y++) { P.set(1, y, R[5]); P.set(2, y, R[4]); P.set(29, y, R[2]); P.set(30, y, R[1]); }
    for (let y = 5; y <= b - 6; y++) for (let x = 3; x <= 28; x++) P.set(x, y, x % 6 === 0 ? R[0] : R[1]);
    const tops = [14, 24, 34, 44, 54];
    tops.forEach((st, k) => { fillBooks(P, 3, 28, st - 1, 8, 1300 + k * 7, true); for (let x = 3; x <= 28; x++) { P.set(x, st, hash(x, st, 3) < 0.4 ? '#8a8278' : R[5]); P.set(x, st + 1, R[3]); } });
    for (let x = 3; x <= 28; x++) if (hash(x, 1, 7) < 0.35) P.set(x, 13, P.has(x, 13) ? '#8a8278' : R[1]);
    for (let y = b - 5; y <= b - 1; y++) for (let x = 1; x <= 30; x++) P.set(x, y, y === b - 5 ? R[5] : y === b - 1 ? R[1] : R[3]);
    for (let i = 0; i < 6; i++) { P.set(19 + i, b - 12, CRIMSON[2]); P.set(19 + i, b - 11, mix(CRIMSON[1], '#6e665e', 0.3)); }
    P.outline(OUT);
    const web = (cx, cy, dx) => { for (let k = 0; k < 6; k++) { P.set(cx + dx * k, cy, '#c8c0d0', 150); P.set(cx, cy + k, '#c8c0d0', 150); P.set(cx + dx * k, cy + k, '#b8b0c4', 120); } for (const r of [2, 4]) for (let a = 0; a <= r; a++) P.set(cx + dx * a, cy + r - a, '#d8d0e0', 130); };
    web(3, 5, 1); web(28, 5, -1);
    P.shadow(18, b, 15, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true, againstWall: true, fade: true });
  });

  def('floating_books', 1, () => {
    const W = 44, H = 34, b = H - 1;
    const books = [[8, 14, CRIMSON], [22, 7, MIDNIGHT], [35, 16, FOREST]];
    const draw = (f) => {
      const P = new Pix(W, H);
      books.forEach(([bx, by, C], k) => {
        const yy = by + [0, -1, -1, 0][(f + k) % 4], flap = (f + k) % 2;
        for (let i = -7; i <= 7; i++) {
          const ai = Math.abs(i), lift = ai < 3 ? 0 : ai < 6 ? 1 : 2;
          P.set(bx + i, yy + 4 - lift, ai === 7 ? C[1] : C[2]);
          if (ai > 0 && ai < 7) for (let j = 0; j < 4; j++) P.set(bx + i, yy + j - lift, j === 0 ? (i < 0 ? PAPER[4] : PAPER[3]) : (j % 2 === 1 && ai > 1 && ai < 6 && (i + j + k) % 3) ? PAPER[1] : i < 0 ? PAPER[3] : PAPER[2]);
        }
        for (let j = 0; j < 4; j++) P.set(bx, yy + j, PAPER[1]); P.set(bx, yy + 4, C[1]);
        if (flap) { P.set(bx + 3, yy - 2, PAPER[4]); P.set(bx + 4, yy - 2, PAPER[3]); P.set(bx + 4, yy - 3, PAPER[4]); P.set(bx + 2, yy - 1, PAPER[3]); }
      });
      P.outline(OUT);
      for (let k = 0; k < 8; k++) { const mx = 2 + Math.floor(hash(k, f, 13) * 40), my = 1 + Math.floor(hash(k, f, 14) * 30); if (!P.has(mx, my)) P.set(mx, my, k % 3 ? '#e4d2ff' : '#ffe08a'); }
      return P;
    };
    return build({ ax: 22, ay: b, foot: [1, 1], solid: false, overhead: true, lights: [L(22, 14, 48, [200, 170, 255], 0.35)] }, draw, 4, 4);
  });

  def('reading_desk', 1, () => {
    const W = 32, H = 36, b = H - 1, R = BW;
    let fl = null;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (const lx of [2, 28]) for (let y = b - 11; y <= b - 1; y++) { P.set(lx, y, R[5]); P.set(lx + 1, y, R[2]); }
      for (let x = 1; x <= 30; x++) { P.set(x, b - 15, R[4]); P.set(x, b - 14, R[5]); P.set(x, b - 13, R[6]); P.set(x, b - 12, R[3]); }
      for (let y = b - 11; y <= b - 9; y++) for (let x = 11; x <= 20; x++) P.set(x, y, y === b - 11 ? R[4] : R[3]); P.set(15, b - 10, BRASS[4]);
      for (let y = b - 19; y <= b - 15; y++) for (let x = 6; x <= 19; x++) { const mid = x === 12 || x === 13; P.set(x, y, y === b - 15 ? WINE[2] : mid ? PAPER[1] : y === b - 19 ? PAPER[4] : PAPER[3]); }
      for (const [x0, x1] of [[7, 11], [14, 18]]) for (const y of [b - 18, b - 17, b - 16]) for (let x = x0; x <= x1; x++) if ((x + y) % 4) P.set(x, y, PAPER[1]);
      P.vline(16, b - 14, b - 11, CRIMSON[4]); P.set(16, b - 10, CRIMSON[3]);
      for (let x = 21; x <= 25; x++) { P.set(x, b - 17, x === 21 ? PAPER[4] : PAPER[3]); P.set(x, b - 16, PAPER[2]); }
      P.rect(3, b - 17, 2, 2, '#1a1622'); P.line(4, b - 18, 6, b - 23, '#e8e0f0');
      P.hline(26, 29, b - 16, BRASS[3]); fl = candle(P, 27, b - 17, 4, 2, f);
      P.outline(OUT);
      P.shadow(17, b, 15, 1.6);
      return P;
    };
    draw(0);
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(fl.x, fl.y - 1, 42, L_CANDLE, 0.7, 1)] }, draw, 4, 6);
  });

  def('blueprint_pedestal', 2, (v) => {
    const W = 16, H = 30, b = H - 1, S = PSTONE;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let y = b - 3; y <= b - 1; y++) for (let x = 2; x <= 13; x++) P.set(x, y, y === b - 3 ? S[7] : x <= 3 ? S[6] : x >= 12 ? S[2] : S[4]);
      for (let y = b - 14; y <= b - 4; y++) for (let x = 4; x <= 11; x++) P.set(x, y, [6, 5, 4, 5, 4, 3, 4, 2][x - 4] === undefined ? S[3] : S[[6, 5, 4, 5, 4, 3, 4, 2][x - 4]]);
      for (let y = b - 17; y <= b - 15; y++) for (let x = 2; x <= 13; x++) P.set(x, y, y === b - 17 ? S[7] : y === b - 15 ? S[3] : x <= 3 ? S[7] : S[6]);
      if (v === 0) {
        for (let x = 4; x <= 11; x++) { P.set(x, b - 20, '#8ac8ff'); P.set(x, b - 19, x % 3 === 0 ? '#ffffff' : '#4a8ae8'); P.set(x, b - 18, '#2858c0'); }
        P.set(3, b - 19, '#c4e6ff'); P.set(3, b - 20, '#e0f0ff'); P.set(3, b - 18, '#8ac0ff'); P.set(12, b - 19, '#2a4a9a');
        P.vline(8, b - 20, b - 18, GOLD[4]); P.set(7, b - 21, GOLD[3]); P.set(9, b - 21, GOLD[5]);
      } else for (let x = 4; x <= 11; x++) if (x % 2) P.set(x, b - 16, '#a8a6bc');
      P.outline(OUT);
      if (v === 0) { const a = f ? 170 : 110; for (const [x, y] of [[2, b - 20], [13, b - 19], [6, b - 22], [10, b - 22], [8, b - 23]]) if (!P.has(x, y)) P.set(x, y, '#8ad0ff', a); }
      P.shadow(9, b, 6, 1.5);
      return P;
    };
    if (v === 0) return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(8, b - 19, 36, [120, 200, 255], 0.65)] }, draw, 2, 2);
    return sprite({ c: draw(0).canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('lib_ladder', 1, () => {
    const W = 16, H = 38, b = H - 1, P = new Pix(W, H), R = BW;
    for (let y = 3; y <= b - 1; y++) { const t = (y - 3) / (b - 4), lx = Math.round(5 - t * 3), rx = Math.round(10 + t * 3); P.set(lx, y, R[5]); P.set(lx + 1, y, R[3]); P.set(rx, y, R[3]); P.set(rx + 1, y, R[1]); }
    for (let y = 8; y < b - 2; y += 6) { const t = (y - 3) / (b - 4), lx = Math.round(5 - t * 3) + 2, rx = Math.round(10 + t * 3) - 1; for (let x = lx; x <= rx; x++) { P.set(x, y, R[6]); P.set(x, y + 1, R[3]); } }
    for (let x = 5; x <= 11; x++) { P.set(x, 2, R[6]); P.set(x, 3, R[4]); }
    P.vline(5, 0, 2, IRON[4]); P.vline(11, 0, 2, IRON[3]); P.hline(5, 11, 0, IRON[4]);
    for (const wx of [2, 13]) { P.set(wx, b, IRON[2]); P.set(wx, b - 1, IRON[4]); }
    flatBook(P, 6, 19, 5, 2, FOREST, true);
    P.outline(OUT); P.shadow(9, b, 6, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, fade: true });
  });

  def('witch_cauldron', 1, () => {
    const W = 34, H = 46, b = H - 1, cx = 17, FIRE = ['#8a2a1a', EMBERC, ORANGE, AMBER, '#ffe0a0'];
    const draw = (f) => {
      const P = new Pix(W, H);
      for (const [sx, sy] of [[5, b - 1], [11, b], [23, b], [29, b - 1], [17, b]]) P.ell(sx, sy - 1, 2.2, 1.2, (x, y, nx, ny) => P.set(x, y, ny < 0 ? STONE[3] : STONE[2]));
      P.line(9, b - 2, 25, b - 4, WOOD[2]); P.line(10, b - 4, 24, b - 2, WOOD[1]);
      for (let k = 0; k < 6; k++) { const fx = 10 + k * 3, h = 3 + Math.floor(hash(k, f, 151) * 3); for (let j = 0; j < h; j++) P.set(fx + (j === h - 1 ? (f + k) % 2 : 0), b - 4 - j, FIRE[Math.min(4, 4 - Math.floor(j * 4 / h))]); }
      for (const lx of [8, 26]) { P.set(lx, b - 5, IRON[2]); P.set(lx, b - 4, IRON[1]); }
      P.ell(cx, b - 14, 14, 10, (x, y, nx, ny) => { const s = -nx * 0.6 - ny * 0.5; P.set(x, y, IRON[s > 0.55 ? 5 : s > 0.15 ? 4 : s > -0.3 ? 3 : s > -0.65 ? 2 : 1]); });
      [[11, 0], [17, 2], [23, 4]].forEach(([rx, g]) => stampRune(P, rx - 2, b - 15, g, f % 2 ? '#5dffb0' : '#2fbf7f'));
      P.ell(cx, b - 23, 13.5, 3.8, (x, y, nx, ny) => P.set(x, y, ny < 0 ? IRON[5] : IRON[4]));
      P.ell(cx, b - 23, 11.5, 2.6, (x, y, nx, ny) => P.set(x, y, hash(x, y, 70 + f) < 0.12 ? '#b4ffd9' : nx * nx + ny * ny < 0.3 ? '#5dffb0' : '#2fbf7f'));
      for (let k = 0; k < 4; k++) { const bx = cx - 8 + ((k * 5 + f * 3) % 16), by2 = b - 23 + ((k + f) % 2); P.set(bx, by2 - 1, '#b4ffd9'); P.set(bx + 1, by2 - 1, '#5dffb0'); if ((k + f) % 3 === 0) P.set(bx, by2 - 2, '#ecfff6'); }
      P.line(cx + 6, b - 24, cx + 11, b - 37, WOOD[3]); P.line(cx + 7, b - 24, cx + 12, b - 37, WOOD[2]);
      P.outline(OUT);
      for (let k = 0; k < 5; k++) for (let j = 0; j < 7; j++) { const x = cx - 8 + k * 4 + Math.round(Math.sin((j + f + k) * 0.8) * 1.3), y = b - 27 - j - ((f + k) % 4); if (y > 0 && !P.has(x, y)) P.set(x, y, '#9affc8', (0.55 - j * 0.07) * 255); }
      P.shadow(cx + 1, b, 15, 2);
      return P;
    };
    return build({ ax: 17, ay: b, foot: [2, 2], solid: true, lights: [L(17, b - 25, 74, [93, 255, 140], 0.85, 1), L(17, b - 4, 30, [255, 150, 70], 0.5, 1)] }, draw, 4, 5);
  });

  def('jar_shelf', 1, () => {
    const W = 32, H = 42, b = H - 1, P = new Pix(W, H), R = WOOD;
    for (let y = 2; y <= b - 1; y++) { P.set(2 + (y < 10 ? 1 : 0), y, R[4]); P.set(3 + (y < 10 ? 1 : 0), y, R[2]); P.set(28, y, R[3]); P.set(29, y, R[1]); }
    const shelves = [b - 30, b - 19, b - 8];
    for (const sy of shelves) for (let x = 2; x <= 29; x++) { const yy = sy + (x > 16 ? 1 : 0); P.set(x, yy, R[5]); P.set(x, yy + 1, R[2]); }
    const jar = (x, by, w, h, liq, thing) => {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.set(x + i, by - j, i === 0 ? GLASS[3] : i === w - 1 ? GLASS[1] : j < h - 2 ? liq : GLASS[2]);
      P.hline(x, x + w - 1, by - h, '#8a5a3a'); P.hline(x + 1, x + w - 2, by - h - 1, '#6a4028');
      const cx = x + Math.floor(w / 2), cy = by - Math.floor(h / 2) + 1;
      if (thing === 'eye') { P.set(cx, cy, '#f2ece6'); P.set(cx - 1, cy, '#f2ece6'); P.set(cx, cy - 1, '#f2ece6'); P.set(cx - 1, cy - 1, '#3fd88a'); }
      if (thing === 'toad') { P.set(cx - 1, cy, '#4c9061'); P.set(cx, cy, '#337450'); P.set(cx - 1, cy - 1, '#74b46e'); P.set(cx, cy - 1, '#f2c45a'); }
      if (thing === 'shroom') { P.set(cx - 1, cy - 1, '#c44a3a'); P.set(cx, cy - 1, '#e8843c'); P.set(cx - 1, cy, '#e8dcc8'); }
    };
    jar(5, shelves[0] - 1, 4, 6, '#3e5224', 'eye'); jar(11, shelves[0] - 1, 5, 7, '#2a3a2e', 'toad'); bottle(P, 18, shelves[0], 1, 'moss', false, 0.6); jar(22, shelves[0], 4, 5, '#4a2a3a', 'shroom');
    jar(4, shelves[1] - 1, 5, 6, '#1e4a38', null); P.set(6, shelves[1] - 3, '#b4ffd9'); P.set(7, shelves[1] - 4, '#5dffb0');
    bottle(P, 11, shelves[1] - 1, 0, 'violet', false, 0.5); bottle(P, 17, shelves[1], 3, 'red', false, 0.7); jar(21, shelves[1], 5, 5, '#3a2a1e', 'eye');
    skull5(P, 6, shelves[2] - 5); jar(14, shelves[2], 4, 5, '#2a3a2e', 'shroom'); bottle(P, 20, shelves[2], 5, 'moss', false, 0.4); bottle(P, 25, shelves[2], 2, 'teal', false, 0.6);
    P.outline(OUT);
    for (let k = 0; k < 5; k++) { P.set(25 + k, 3, '#c8c0d0', 140); P.set(29, 3 + k, '#c8c0d0', 140); P.set(29 - k, 3 + k, '#b8b0c4', 120); }
    P.shadow(17, b, 15, 1.6);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(6.5, b - 22, 20, [93, 255, 160], 0.4)] });
  });

  def('broom', 1, () => {
    const W = 16, H = 34, b = H - 1, P = new Pix(W, H);
    for (let y = 1; y <= b - 9; y++) { const x = Math.round(10 - (y - 1) * 0.11); P.set(x, y, (y % 5 === 0) ? '#6a4c38' : '#4a3428'); P.set(x + 1, y, '#2a1e18'); }
    for (let j = 0; j < 9; j++) { const y = b - 9 + j, hw = 1 + j * 0.55; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw); x++) P.set(x, y, j === 8 && (x % 2) ? STRAW[2] : (x + j) % 3 === 0 ? STRAW[2] : x < 7 ? STRAW[4] : STRAW[3]); }
    P.hline(6, 9, b - 9, MAGIC[2]); P.hline(6, 9, b - 8, MAGIC[1]); P.set(10, b - 8, MAGIC[2]); P.set(11, b - 7, MAGIC[1]);
    stamp(P, 11, 7, ['.##', '#..', '.##'], { '#': SILVER[5] }); P.set(11, 6, SILVER[3]);
    P.outline(OUT); P.shadow(9, b, 5, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('herb_rack', 1, () => {
    const W = 16, H = 30, b = H - 1, P = new Pix(W, H), R = WOOD;
    for (const ux of [1, 13]) for (let y = 4; y <= b - 1; y++) { P.set(ux, y, R[4]); P.set(ux + 1, y, R[2]); }
    P.hline(0, 3, b - 1, R[3]); P.hline(12, 15, b - 1, R[2]);
    for (let x = 1; x <= 14; x++) { P.set(x, 4, R[5]); P.set(x, 5, R[2]); P.set(x, 16, R[5]); P.set(x, 17, R[2]); }
    const bundle = (x, y, hgt, C) => { P.set(x, y, '#c8a070'); P.set(x, y + 1, '#c8a070'); for (let j = 0; j < hgt; j++) { const hw = Math.min(1.6, 0.4 + j * 0.3); for (let i = Math.round(x - hw); i <= Math.round(x + hw); i++) P.set(i, y + 2 + j, (i + j) % 3 === 0 ? C[0] : i < x ? C[2] : C[1]); } };
    bundle(4, 6, 7, [LEAF[2], LEAF[3], LEAF[4]]); bundle(8, 6, 8, [MAGIC[1], MAGIC[2], MAGIC[3]]); bundle(11, 6, 6, [CRIMSON[2], CRIMSON[3], CRIMSON[4]]);
    for (const [gx, gy] of [[5, 19], [5, 22]]) P.ell(gx, gy, 1.3, 1.3, (x, y, nx, ny) => P.set(x, y, nx + ny < 0 ? '#f2ece6' : '#c8b8c0'));
    P.vline(5, 18, 18, '#c8a070');
    for (let k = 0; k < 3; k++) { P.set(10, 19 + k * 2, '#e8dcc8'); P.set(11, 19 + k * 2, '#c44a3a'); P.set(10, 20 + k * 2, '#c8a070'); }
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('witch_chair', 1, () => {
    const W = 16, H = 30, b = H - 1, P = new Pix(W, H), R = ['#120e14', '#1e1820', '#2c242e', '#3c323e', '#4e4250', '#625464'];
    for (let y = 3; y <= b - 1; y++) { const tw = Math.round(Math.sin(y * 0.6) * 0.6); P.set(3 + tw, y, R[4]); P.set(4 + tw, y, R[2]); P.set(11 - tw, y, R[3]); P.set(12 - tw, y, R[1]); }
    P.set(2, 2, R[5]); P.set(2, 1, R[4]); P.set(3, 0, R[4]); P.set(13, 2, R[3]); P.set(13, 1, R[2]); P.set(12, 0, R[2]);
    for (let y = 4; y <= b - 12; y++) for (let x = 5; x <= 10; x++) P.set(x, y, x === 5 ? R[4] : R[3]);
    stamp(P, 6, 7, ['.##.', '#...', '#...', '.##.'], { '#': R[0] });
    for (let y = b - 11; y <= b - 9; y++) for (let x = 2; x <= 13; x++) P.set(x, y, y === b - 11 ? PLUM[4] : x < 5 ? PLUM[4] : PLUM[3]);
    P.rect(8, b - 10, 3, 2, '#4c9061'); P.set(8, b - 10, '#74b46e'); P.set(7, b - 9, '#c8a070'); P.set(11, b - 10, '#c8a070');
    P.hline(2, 13, b - 8, R[2]);
    P.line(2, b - 7, 2, b - 1, R[4]); P.line(13, b - 7, 13, b - 1, R[2]); P.set(5, b - 3, R[2]); P.set(10, b - 2, R[1]);
    P.outline(OUT); P.shadow(9, b, 6.5, 1.6);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('orrery_big', 1, () => {
    const W = 34, H = 48, b = H - 1, cx = 17, cy = b - 27;
    const draw = (f) => {
      const P = new Pix(W, H);
      P.ell(cx, b - 4, 15, 3.6, (x, y, nx, ny) => P.set(x, y, ny > 0.3 ? BRASS[2] : nx < -0.4 ? BRASS[5] : BRASS[4]));
      for (let x = 3; x <= 31; x++) { P.set(x, b - 1, x % 2 ? BRASS[1] : BRASS[2]); }
      P.ell(cx, b - 5, 5, 1.4, (x, y) => P.set(x, y, BRASS[3]));
      for (let y = cy + 4; y <= b - 6; y++) { P.set(cx - 1, y, BRASS[5]); P.set(cx, y, BRASS[3]); P.set(cx + 1, y, BRASS[2]); }
      const rings = [[14, 4.2, 0], [10, 3, 1.4], [6, 2, -1]];
      const ring = (rx, ry, tl, front) => { for (let a = 0; a < 140; a++) { const t = a / 140 * Math.PI * 2; if ((Math.sin(t) > 0) !== front) continue; P.set(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry + Math.cos(t) * tl), front ? BRASS[4] : BRASS[2]); } };
      const pl = [[14, 4.2, 0, f * Math.PI / 2 + 0.3, GL.azure, 1.6], [10, 3, 1.4, -f * Math.PI / 2 + 2, GL.rose, 1.3], [6, 2, -1, f * Math.PI / 2 + 4, GL.emerald, 1.1]];
      const planets = (front) => pl.forEach(([rx, ry, tl, t, C, r]) => { if ((Math.sin(t) > 0) !== front) return; const px = cx + Math.cos(t) * rx, py = cy + Math.sin(t) * ry + Math.cos(t) * tl; P.line(cx, cy, px, py, BRASS[3]); P.ell(px, py, r, r, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.3 ? C[5] : nx + ny < 0.4 ? C[4] : C[3])); });
      rings.forEach(([rx, ry, tl]) => ring(rx, ry, tl, false)); planets(false);
      P.ell(cx, cy, 3.6, 3.6, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.6 ? '#fff8e0' : nx + ny < 0.2 ? GOLD[5] : nx + ny < 0.8 ? GOLD[4] : GOLD[3]));
      rings.forEach(([rx, ry, tl]) => ring(rx, ry, tl, true)); planets(true);
      P.outline(OUT); P.shadow(cx + 1, b, 15, 2);
      return P;
    };
    return build({ ax: 17, ay: b, foot: [2, 2], solid: true, lights: [L(17, b - 27, 58, [255, 210, 120], 0.6)] }, draw, 4, 3);
  });

  def('great_telescope', 1, () => {
    const W = 34, H = 58, b = H - 1, P = new Pix(W, H), S = PSTONE;
    P.ell(17, b - 3, 15, 3.4, (x, y, nx, ny) => P.set(x, y, ny > 0.3 ? S[2] : nx < -0.4 ? S[6] : S[4]));
    P.ell(17, b - 6, 10, 2.4, (x, y, nx, ny) => P.set(x, y, ny > 0.3 ? S[3] : nx < -0.4 ? S[7] : S[5]));
    for (let y = b - 20; y <= b - 8; y++) for (let x = 14; x <= 20; x++) P.set(x, y, x === 14 ? BRASS[5] : x === 20 ? BRASS[1] : x < 17 ? BRASS[4] : BRASS[3]);
    for (const yx of [12, 21]) for (let y = b - 26; y <= b - 19; y++) { P.set(yx, y, BRASS[4]); P.set(yx + 1, y, BRASS[2]); }
    P.ell(25, b - 15, 4, 4, (x, y, nx, ny) => { const d = nx * nx + ny * ny; if (d > 0.5 || (Math.round(Math.atan2(ny, nx) * 3) % 2 === 0 && d > 0.2)) P.set(x, y, nx + ny < 0 ? BRASS[5] : BRASS[3]); });
    const A = [27, b - 19], Bp = [7, 6], len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]), dx = (Bp[0] - A[0]) / len, dy = (Bp[1] - A[1]) / len, nx = -dy, ny = dx;
    for (let s = 0; s <= len; s += 0.4) {
      const hw = 2.2 + (s / len) * 1.3 + (s > len - 4 ? 0.8 : 0);
      for (let o = -hw; o <= hw; o += 0.4) {
        const x = Math.round(A[0] + dx * s + nx * o), y = Math.round(A[1] + dy * s + ny * o), rel = o / hw;
        let c = rel < -0.5 ? BRASS[5] : rel < 0 ? BRASS[4] : rel < 0.55 ? BRASS[3] : BRASS[2];
        if (Math.round(s) % 9 === 4) c = rel < 0 ? GOLD[5] : GOLD[3];
        P.set(x, y, c);
      }
    }
    P.ell(Bp[0] - 1, Bp[1] - 1, 2.2, 2.2, (x, y, nx2, ny2) => P.set(x, y, nx2 + ny2 < -0.2 ? '#c4e6ff' : '#2a3a6a'));
    P.set(28, b - 18, BRASS[1]); P.set(29, b - 17, BRASS[2]); P.set(30, b - 16, IRON[4]);
    P.outline(OUT); P.shadow(18, b, 16, 2.4);
    return sprite({ c: P.canvas(), ax: 17, ay: b, foot: [2, 2], solid: true, fade: true });
  });

  def('star_chart_floor', 1, () => {
    const W = 48, H = 48, P = new Pix(W, H), cx = 23.5, cy = 23.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy); if (d > 23.6) continue;
      const a = Math.atan2(y - cy, x - cx), seg = (a + Math.PI) / (Math.PI * 2) * 24;
      let c;
      if (d > 22.5) c = GOLD[2]; else if (d > 21.6) c = GOLD[4];
      else if (d > 18.8) { c = '#1c2048'; if (Math.abs(seg - Math.round(seg)) < 0.08) c = GOLD[3]; else if (Math.abs(d - 20.2) < 0.5 && Math.round(seg * 2) % 4 === 1) c = SILVER[4]; }
      else if (d > 18) c = SILVER[3];
      else { c = rampAt(['#0e1230', '#121638', '#171c42'], 0.2 + fbm(x / 9, y / 9, 3) * 0.6, x, y); if (hash(x, y, 5) < 0.02) c = '#8a9ac8'; }
      P.set(x, y, c);
    }
    const cons = [[[10, 14], [14, 11], [18, 13], [17, 17]], [[30, 10], [34, 13], [36, 17], [32, 20], [29, 17]], [[14, 30], [18, 33], [22, 31], [26, 35], [30, 33]]];
    for (const g of cons) { for (let k = 0; k + 1 < g.length; k++) { const [x0, y0] = g[k], [x1, y1] = g[k + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 1; i < n; i++) if (i % 2) P.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), '#5a6aa8'); } for (const [x, y] of g) { P.set(x, y, '#ffffff'); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) P.set(x + ox, y + oy, '#a8b8e8'); } }
    P.ell(23.5, 23.5, 3, 3, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.3 ? GOLD[6] : GOLD[4]));
    for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; P.set(Math.round(23.5 + Math.cos(t) * 5), Math.round(23.5 + Math.sin(t) * 5), GOLD[3]); }
    stamp(P, 26, 19, ['.##', '#..', '.##'], { '#': SILVER[5] });
    return sprite({ c: P.canvas(), ax: 24, ay: H - 1, foot: [3, 3], solid: false, flat: true });
  });

  def('astrolabe', 1, () => {
    const W = 16, H = 30, b = H - 1, P = new Pix(W, H), cy = b - 19;
    for (let y = b - 3; y <= b - 1; y++) for (let x = 3; x <= 12; x++) P.set(x, y, y === b - 3 ? PSTONE[7] : x <= 4 ? PSTONE[6] : x >= 11 ? PSTONE[2] : PSTONE[4]);
    for (let y = b - 12; y <= b - 4; y++) { P.set(7, y, BRASS[4]); P.set(8, y, BRASS[2]); } P.hline(5, 10, b - 4, BRASS[3]);
    P.ell(7.5, cy, 6.2, 6.2, (x, y, nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny), a = Math.atan2(ny, nx); let c = d > 0.86 ? (Math.round(a * 12 / Math.PI) % 2 ? BRASS[5] : BRASS[4]) : d > 0.78 ? BRASS[1] : BRASS[3]; if (d < 0.78 && Math.abs(Math.hypot(nx - 0.15, ny + 0.2) - 0.45) < 0.08) c = GOLD[5]; if (d < 0.78 && Math.abs(nx * 0.7 + ny * 0.7) < 0.06) c = BRASS[5]; P.set(x, y, c); });
    P.set(7, cy, GOLD[6]); P.set(8, cy, GOLD[4]);
    P.ell(7.5, cy - 7.4, 1.4, 1.2, (x, y, nx, ny) => { if (nx * nx + ny * ny > 0.3) P.set(x, y, BRASS[4]); });
    P.outline(OUT); P.shadow(9, b, 5, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('crystal_flower', 3, (v) => {
    const W = 16, H = 26, b = H - 1, P = new Pix(W, H), hue = ['rose', 'azure', 'violet'][v], C = GL[hue], T = GL.teal, fy = b - 16;
    for (const [sx, sy] of [[4, b], [11, b], [8, b]]) P.ell(sx, sy - 1, 2.2, 1.1, (x, y, nx) => P.set(x, y, nx < 0 ? '#3a3254' : '#241c3e'));
    for (let y = fy + 2; y <= b - 2; y++) { const x = Math.round(8 + Math.sin((y - fy) * 0.3) * 0.7); P.set(x, y, T[3]); P.set(x + 1, y, T[1]); }
    stamp(P, 4, b - 7, ['..#', '.##', '###'], { '#': (i) => (i < 1 ? T[4] : T[2]) }); stamp(P, 10, b - 10, ['#..', '##.', '###'], { '#': (i) => (i > 1 ? T[1] : T[3]) });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 - Math.PI / 2; for (let t = 1; t <= 4; t++) { const x = 8 + Math.cos(a) * t, y = fy + Math.sin(a) * t * 0.9; P.set(x, y, t === 4 ? C[5] : Math.cos(a) < 0 ? C[4] : C[3]); P.set(x + Math.cos(a + 1.57) * 0.8, y + Math.sin(a + 1.57) * 0.8, C[2]); } }
    P.ell(8, fy, 1.3, 1.3, (x, y) => P.set(x, y, C[5])); P.set(8, fy, '#ffffff');
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 - Math.PI / 4; P.set(4 + Math.cos(a) * 1.6, b - 9 + Math.sin(a) * 1.6, C[3]); } P.set(4, b - 9, C[5]);
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(8, fy, 30, GL_RGB[hue], 0.6)] });
  });

  def('fairy_fountain', 1, () => {
    const W = 32, H = 46, b = H - 1, cx = 15.5, WT = ['#3a3a8a', '#5a5ac0', '#8a7ae0', '#c0a8f8', '#f0e0ff'], S = PSTONE;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (let x = 1; x <= 30; x++) { const dx = (x - cx) / 14.5; if (dx * dx > 1) continue; const bot = b - 1 - Math.round((1 - Math.sqrt(1 - dx * dx)) * 4); for (let y = b - 11; y <= bot; y++) P.set(x, y, y === bot ? S[2] : x < 8 ? S[6] : x > 23 ? S[3] : S[5]); }
      P.ell(cx, b - 11, 14.5, 4.8, (x, y, nx, ny) => P.set(x, y, ny < 0 ? S[7] : S[6]));
      P.ell(cx, b - 11.4, 12.5, 3.4, (x, y, nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny); let c = rampAt(WT, 0.35 + (1 - d) * 0.6, x, y); if (Math.abs(d * 4 - (f % 4) - 0.5) < 0.3) c = WT[4]; P.set(x, y, c); });
      for (let y = 8; y <= b - 12; y++) { const hw = 1.6 + (y - 8) / (b - 20) * 1.4; for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) P.set(x, y, x < cx - 0.5 ? GL.azure[4] : x > cx + 0.5 ? GL.violet[2] : GL.violet[4]); }
      for (const [sx, top, d] of [[12, 18, -1], [19, 21, 1]]) for (let y = top; y <= b - 12; y++) P.set(sx + Math.round(d * (y - top) * 0.08), y, y === top ? GL.rose[5] : d < 0 ? GL.rose[4] : GL.rose[2]);
      P.set(cx, 7, '#ffffff'); P.set(cx - 1, 8, GL.azure[5]);
      for (let k = 0; k < 3; k++) { const y = 10 + ((f * 4 + k * 9) % 22); P.set(cx + 2, y, '#e0f0ff'); }
      P.outline(OUT);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + f * 0.5, r = 7 + (k % 2) * 3; const x = Math.round(cx + Math.cos(a) * r), y = Math.round(16 + Math.sin(a) * r * 0.6); if (!P.has(x, y)) P.set(x, y, k % 2 ? '#ffd0f0' : '#ffffff'); }
      P.shadow(cx + 1, b, 15, 2);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 2], solid: true, lights: [L(15.5, b - 12, 64, [200, 160, 255], 0.7), L(15.5, 16, 32, [255, 170, 230], 0.45, 1)] }, draw, 4, 4);
  });

  def('lumi_fungus', 2, (v) => {
    const W = 16, H = 16, b = H - 1, P = new Pix(W, H), C = v ? [MAGIC[0], MAGIC[2], MAGIC[3], MAGIC[4], '#ffffff'] : ['#0e5a5a', '#1f9a8a', '#4fd8c8', '#b4fff0', '#ffffff'];
    const caps = [[3, b - 3, 1.8, 1.1, 2], [10, b - 8, 3.4, 1.8, 7], [5, b - 6, 2.8, 1.5, 5], [13, b - 3, 2, 1.2, 2]];
    for (const [x, y, rx, ry, sh] of caps) {
      for (let j = 1; j <= sh; j++) { P.set(x, y + j, '#e0d8e8'); P.set(x + 1, y + j, '#a8a0b8'); }
      P.ell(x + 0.5, y, rx, ry, (xx, yy, nx, ny) => P.set(xx, yy, ny > 0.4 ? C[0] : nx + ny < -0.5 ? C[3] : nx + ny < 0.3 ? C[2] : C[1]));
      P.set(Math.round(x - rx * 0.4), y - 1 + (ry > 1.4 ? 0 : 1), C[4]);
    }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: false, lights: [L(8, b - 7, 28, v ? [176, 136, 255] : [80, 230, 210], 0.55)] });
  });

  //@@PIECES@@

  // ================================================================== public API
  const cache = new Map();
  function cached(key, fn) { let v = cache.get(key); if (v === undefined) { v = fn(); cache.set(key, v); } return v; }
  const ids = Object.keys(DEFS), variants = {};
  for (const id of ids) variants[id] = DEFS[id].n;
  window.InteriorArt = {
    ids, variants,
    WALL_H: { tavern: 48, boutique: 48, cottage: 48, cathedral: 80, alt: 48, pastel: 48, study: 48, smithy: 48, menagerie: 48, guild: 48 },
    piece(id, variant) {
      const d = DEFS[id]; if (!d) return null;
      const v = ((variant | 0) % d.n + d.n) % d.n;
      return cached('p|' + id + '|' + v, () => d.make(v));
    },
    floor(kind, w, h, seed) {
      w = Math.max(1, w | 0); h = Math.max(1, h | 0); seed = seed | 0;
      const f = FLOORS[kind] || FLOORS.tavern;
      return cached('f|' + kind + '|' + w + '|' + h + '|' + seed, () => f(w, h, seed).canvas());
    },
    wall(kind, w, h, seed, opts) {
      w = Math.max(1, w | 0); h = Math.max(1, h | 0); seed = seed | 0; opts = opts || {};
      const f = WALLS[kind] || WALLS.tavern;
      return cached('w|' + kind + '|' + w + '|' + h + '|' + seed + '|' + JSON.stringify(opts), () => f(w, h, seed, opts).canvas());
    },
    pool(w, h, hue, seed) {
      w = Math.max(12, w | 0); h = Math.max(12, h | 0); seed = seed | 0;
      return cached('o|' + w + '|' + h + '|' + hue + '|' + seed, () => { const r = makePool(w, h, hue, seed); return { c: r.P.canvas(), shimmer: r.shimmer, lights: r.lights }; });
    },
    runner(w, h, seed) {
      w = Math.max(8, w | 0); h = Math.max(8, h | 0); seed = seed | 0;
      return cached('r|' + w + '|' + h + '|' + seed, () => makeRunner(w, h, seed).canvas());
    },
  };
})();
