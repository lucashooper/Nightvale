// Nightvale — WildArt: set pieces for the forest biome (the Deepwood and its Hollows, Hushwillow Glade),
// the For-the-King-style random encounters and the Night Market. Self-contained procedural pixel art: its own little
// painter, no dependencies, classic script. Defines window.WildArt only.
//
//   WildArt.piece(id, variant) -> { c, n?, nframes?, frames?, fps?, ax, ay, foot: [fw, fh], solid,
//                                     lights: [...], flat?, fade?, w, h, id, v }
//   WildArt.ids            every id
//   WildArt.variants[id]   variant count
//
// Conventions match the game's props: 1 tile = 16 px, light from the upper left, 1 px #120c1c outline.
// (ax, ay) lands on world (tx*16 + fw*8, (ty+fh)*16 - 1). Lights are in sprite pixels; night:true lights
// only show after dark. `n` is the night canvas (runes and glass lit); pieces that animate AND have a
// night look also carry `nframes`.
(function () {
  'use strict';

  // ------------------------------------------------------------------ maths & colour
  function hash(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function noise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function rng(seed) {
    let a = (seed | 0) ^ 0x9e3779b9;
    return function () { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const hexCache = new Map();
  function rgb(c) { if (Array.isArray(c)) return c; let v = hexCache.get(c); if (!v) { const n = parseInt(c.slice(1), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; hexCache.set(c, v); } return v; }
  function pack(c, a) { c = rgb(c); const A = a === undefined ? 255 : clamp(Math.round(a), 0, 255); return ((A << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; }
  function mixc(a, b, t) { a = rgb(a); b = rgb(b); return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  function lum(c) { c = rgb(c); return (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255; }
  // light from the upper left (and a little toward the viewer)
  const LX = -0.55, LY = -0.62, LZ = 0.56;
  function lam(nx, ny) { const q = nx * nx + ny * ny, nz = q < 1 ? Math.sqrt(1 - q) : 0; return nx * LX + ny * LY + nz * LZ; }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((q) => (q + 0.5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  // ------------------------------------------------------------------ pixel painter
  // Uint32 RGBA buffer plus a parallel "night colour" buffer: glow pixels carry the colour they switch to after dark.
  class Pix {
    constructor(w, h) { this.w = w | 0; this.h = h | 0; this.d = new Uint32Array(this.w * this.h); this.nc = new Uint32Array(this.w * this.h); }
    ok(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    set(x, y, c, a) { x = Math.round(x); y = Math.round(y); if (c == null || !this.ok(x, y)) return; const i = y * this.w + x; this.d[i] = pack(c, a); this.nc[i] = 0; }
    glow(x, y, day, night, a) { x = Math.round(x); y = Math.round(y); if (!this.ok(x, y)) return; const i = y * this.w + x; this.d[i] = pack(day, a); this.nc[i] = pack(night, a); }
    nite(x, y, night) { x = Math.round(x); y = Math.round(y); if (!this.ok(x, y)) return; const i = y * this.w + x; if (!(this.d[i] >>> 24)) return; this.nc[i] = pack(night, this.d[i] >>> 24); }
    get(x, y) { x = Math.round(x); y = Math.round(y); if (!this.ok(x, y)) return null; const v = this.d[y * this.w + x]; return v >>> 24 ? [v & 255, (v >>> 8) & 255, (v >>> 16) & 255] : null; }
    alpha(x, y) { x = Math.round(x); y = Math.round(y); return this.ok(x, y) ? this.d[y * this.w + x] >>> 24 : 0; }
    has(x, y) { return this.alpha(x, y) > 0; }
    op(x, y) { return this.alpha(x, y) > 200; }
    clear(x, y) { x = Math.round(x); y = Math.round(y); if (!this.ok(x, y)) return; this.d[y * this.w + x] = 0; this.nc[y * this.w + x] = 0; }
    rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
    hline(x0, x1, y, c, a) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c, a); }
    vline(x, y0, y1, c, a) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c, a); }
    line(x0, y0, x1, y1, c, a) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
      for (;;) { this.set(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    }
    disc(cx, cy, rx, ry, c, a) { for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++) for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) if ((x * x) / (rx * rx + 0.01) + (y * y) / (ry * ry + 0.01) <= 1) this.set(cx + x, cy + y, c, a); }
    // alpha-composite colour c at opacity a (0..1) over whatever is there (webs, mist, ghosts)
    over(x, y, c, a) {
      x = Math.round(x); y = Math.round(y); if (!this.ok(x, y) || a <= 0) return;
      const i = y * this.w + x; c = rgb(c);
      const comp = (v) => {
        const da = (v >>> 24) / 255; if (da === 0) return pack(c, a * 255);
        const oa = a + da * (1 - a), f = (k, sh) => (c[k] * a + ((v >>> sh) & 255) * da * (1 - a)) / oa;
        return pack([Math.round(f(0, 0)), Math.round(f(1, 8)), Math.round(f(2, 16))], oa * 255);
      };
      const n = this.nc[i]; this.d[i] = comp(this.d[i]); if (n) this.nc[i] = comp(n);
    }
    tint(x, y, c, t) { x = Math.round(x); y = Math.round(y); if (!this.ok(x, y)) return; const i = y * this.w + x, v = this.d[i]; if (!(v >>> 24)) return; this.d[i] = pack(mixc([v & 255, (v >>> 8) & 255, (v >>> 16) & 255], c, t), v >>> 24); }
    // soft ground shadow under empty pixels (as nature.js)
    shadow(cx, cy, rx, ry, a) {
      for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++) for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d <= 1 && !this.has(cx + x, cy + y)) this.set(cx + x, cy + y, '#0e0818', (a === undefined ? 0.32 : a) * 255 * (d < 0.55 ? 1 : 0.6));
      }
    }
    // 1 px outline around opaque pixels, never over translucent ones (as nature.js)
    outline(c) {
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.has(x, y)) continue;
        if (this.op(x - 1, y) || this.op(x + 1, y) || this.op(x, y - 1) || this.op(x, y + 1)) add.push(x, y);
      }
      for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c || OUT);
    }
    clone() { const p = new Pix(this.w, this.h); p.d.set(this.d); p.nc.set(this.nc); return p; }
    night() { const p = this.clone(); for (let i = 0; i < p.d.length; i++) if (p.nc[i]) p.d[i] = p.nc[i]; return p; }
    canvas() {
      const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
      const x = c.getContext('2d'), img = x.createImageData(this.w, this.h);
      new Uint32Array(img.data.buffer).set(this.d); x.putImageData(img, 0, 0); return c;
    }
  }

  // ------------------------------------------------------------------ palette (the game's G.PAL, copied so this file stands alone)
  const OUT = '#120c1c';
  const PAL = {
    magic: ['#4a2f7a', '#6a47a8', '#8f6cd1', '#b99aee', '#e4d2ff'],
    leaf: ['#10302a', '#1a4434', '#245a40', '#337450', '#4c9061', '#74b46e'],
    grass: ['#163a30', '#1f4e3c', '#296246', '#377a53', '#589c64'],
    forest: ['#0f2a25', '#153730', '#1d4638', '#285a43', '#3b744f'],
    emerald: ['#2fbf7f', '#5dffb0', '#b4ffd9'],
    moon: ['#9fb0d8', '#c8d4f0', '#e8eeff', '#ffffff'],
    amber: '#ffbc62', gold: '#f2c45a', candle: '#fff1c8', orange: '#e8843c', ember: '#c44a3a',
    rose: ['#8c3a62', '#c4648e', '#e89ab8'],
    water: ['#17224c', '#213479', '#2e4f9f', '#69a1db', '#c4e6ff'],
    stone: ['#2d2c3e', '#45445a', '#605f78', '#7e7d97', '#a09fb6', '#c4c3d6'],
    rock: ['#1e1a2c', '#2d2840', '#3d3654', '#4f4769', '#635a80', '#7a7099'],
    wood: ['#281d21', '#3e2d2b', '#574039', '#7a5a48', '#9c7a5e'],
    soil: ['#22182c', '#31233d', '#43324d', '#56425f'],
    dirt: ['#2f2534', '#3f3346', '#524459', '#66566c', '#7d6c82'],
  };
  // derived ramps (shadows lean violet, highlights lean warm / yellow-green)
  const MOSS = ['#163a30', '#1f4e3c', '#296246', '#377a53', '#4c9061', '#74b46e'];
  const HANGMOSS = ['#22342c', '#34493d', '#4a6352', '#647f68', '#86a184'];
  const LICHEN = ['#7d9068', '#a3b483', '#c9d2a4'];
  const FUNGI = ['#3a2826', '#6a4a3a', '#9a7454', '#c8a276', '#ead2a6'];
  const STONE_OLD = ['#201e2b', '#2f2d3d', '#434154', '#59576d', '#717087', '#8d8ca3', '#aaa9bd'];
  const MOONSTONE = ['#3e3f58', '#5b5d79', '#7e81a0', '#a2a5c2', '#c5c8df', '#e3e6f5', '#f6f7fd'];
  const BARK_OLD = ['#18131a', '#251d24', '#362a2f', '#4a3a3c', '#61504d', '#7b6660'];
  const BARK_DARK = ['#110d15', '#1b151e', '#282029', '#372d35', '#483c44', '#5c4e55'];
  const BARK_ELDER = ['#131119', '#1f1b25', '#2d2834', '#3f3846', '#534a58', '#6a606c', '#857a83'];
  const BARK_DEAD = ['#16111c', '#211a28', '#2e2635', '#3f3547', '#524859', '#6a5f72'];
  const BARK_WILLOW = ['#1a161b', '#29222a', '#3a3138', '#4f4349', '#67585a', '#837169'];
  const CANOPY_GIANT = ['#0b241f', '#10302a', '#1a4434', '#245a40', '#337450', '#4c9061', '#74b46e'];
  const CANOPY_DARK = ['#08191a', '#0c2421', '#123029', '#1a4034', '#22513f', '#2f654b', '#447b5a'];
  const CANOPY_ELDER = ['#08201e', '#0d2c29', '#133a35', '#1b4c43', '#256052', '#337761', '#4b9474', '#72b58e'];
  const WILLOW = ['#10302a', '#16402f', '#1f553c', '#2c6c4c', '#41855c', '#5f9f70', '#86bc8c', '#b2d8a8'];
  const CANVAS = ['#3a3034', '#5a4d4c', '#7d6f66', '#a19280', '#c3b39b', '#ddcfb7'];
  const BONE = ['#4e4540', '#7e7264', '#ab9f8a', '#d0c6ae', '#eee7d4'];
  const LEATHER = ['#26191a', '#3f2a24', '#5c3e2e', '#7d573c', '#9e734e'];
  const IRON = ['#14121a', '#222029', '#34313d', '#4a4754', '#66637a'];
  const FIRE = ['#a8352c', '#e0602f', '#f59b3c', '#ffd27a', '#fff3cf', '#ffffff'];
  const WITCH = ['#174f3a', '#2a9a64', '#3fd88a', '#8affc0', '#e0ffe8'];
  const GHOST = ['#2c6468', '#46908f', '#6fbdb4', '#9fe2d6', '#d2fbf2', '#f4fffc'];
  const GOLDS = ['#6e4416', '#a8701e', '#d9a23a', '#f2c45a', '#ffe7a0', '#fff8e0'];
  const SKIN = ['#a86e4f', '#cf9670', '#e8b892'];
  const Lt = (x, y, r, color, i, o) => Object.assign({ x, y, r, color, i }, o || {});

  // ------------------------------------------------------------------ shape helpers
  // Tapered tube along a polyline (trunks, roots, limbs, posts). fn(x, y, nx, ny, along, across, t, q):
  // (nx, ny) is a cylinder normal in screen space, along = arc length, across = signed offset, t = 0..1, q = d/r.
  // o.capA squashes the start cap into a flat ellipse (a trunk standing on the ground); o.rough wobbles the edge.
  function tube(P, pts, rads, fn, o) {
    o = o || {};
    const segs = []; let tot = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], len = Math.hypot(x1 - x0, y1 - y0) || 0.001;
      segs.push({ x0, y0, dx: x1 - x0, dy: y1 - y0, len, s0: tot, r0: rads[k], r1: rads[k + 1], first: k === 0 }); tot += len;
    }
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    pts.forEach((p, k) => { const r = rads[k] + 2; bx0 = Math.min(bx0, p[0] - r); by0 = Math.min(by0, p[1] - r); bx1 = Math.max(bx1, p[0] + r); by1 = Math.max(by1, p[1] + r); });
    for (let y = Math.floor(by0); y <= Math.ceil(by1); y++) for (let x = Math.floor(bx0); x <= Math.ceil(bx1); x++) {
      if (!P.ok(x, y) || (o.clipY != null && y > o.clipY)) continue;
      let best = null;
      for (const s of segs) {
        let t = ((x - s.x0) * s.dx + (y - s.y0) * s.dy) / (s.len * s.len);
        let ox, oy; const r = Math.max(0.5, lerp(s.r0, s.r1, clamp(t, 0, 1)));
        if (t < 0 && s.first && o.capA) { ox = x - s.x0; oy = (y - s.y0) / o.capA; t = 0; }
        else { t = clamp(t, 0, 1); ox = x - (s.x0 + s.dx * t); oy = y - (s.y0 + s.dy * t); }
        const q = Math.hypot(ox, oy) / r;
        if (!best || q < best.q) best = { q, r, ox, oy, along: s.s0 + s.len * t, s };
      }
      let lim = 1;
      if (o.rough) lim += (noise(x / 2.6, y / 2.6, o.seed || 0) - 0.5) * o.rough;
      if (best.q > lim) continue;
      const s = best.s, across = (best.ox * -s.dy + best.oy * s.dx) / s.len;
      fn(x, y, clamp(best.ox / best.r, -1, 1), clamp(best.oy / best.r, -1, 1), best.along, across, best.along / tot, best.q);
    }
  }
  // bark shading for tubes: cylinder light + furrows running along the tube (twist > 0 spirals them)
  function barkFn(P, ramp, seed, o) {
    o = o || {};
    const fx = o.fx || 0.5, fy = o.fy || 6, tw = o.twist || 0, bias = o.bias == null ? 0.42 : o.bias, flat = o.flat == null ? 0.45 : o.flat;
    return function (x, y, nx, ny, along, across) {
      let s = lam(nx, ny * flat);
      const f = noise((across + along * tw) * fx + noise(along / 11, across / 7, seed + 2) * 1.7, along / fy, seed + 3);
      if (f > 0.66) s -= 0.36; else if (f > 0.58) s -= 0.15; else if (f < 0.2) s += 0.1;
      s += (hash(x, y, seed + 4) - 0.5) * 0.1;
      P.set(x, y, ramp[Math.floor(clamp((s + bias) / 1.4, 0, 0.999) * ramp.length)]);
    };
  }
  // roots: bark, with moss on their sunlit upper side
  function rootFn(P, ramp, seed, mossy) {
    const bf = barkFn(P, ramp, seed, { fx: 0.7, fy: 5, flat: 1 });
    return function (x, y, nx, ny, along, across, t, q) {
      bf(x, y, nx, ny, along, across, t, q);
      const up = -(nx * 0.45 + ny);
      if (mossy && up > 0.2 && noise(x / 3.2, y / 2.4, seed + 8) * 0.8 + hash(x, y, seed + 9) * 0.2 > 0.62 - mossy * 0.3) P.set(x, y, MOSS[up > 0.62 ? 4 : up > 0.4 ? 3 : 2]);
    };
  }
  // Big canopies: overlapping leaf clumps painted back to front, each lit from the upper left, a crease where a
  // clump in front overlaps the one behind, a dark rim on the silhouette (as nature.js) and leaf noise.
  function canopy(P, clumps, ramp, seed, o) {
    o = o || {};
    const W = P.w, H = P.h, own = new Int16Array(W * H), sv = new Float32Array(W * H);
    clumps.forEach((c, idx) => {
      const cx = c[0], cy = c[1], r = c[2], ry = r * (c[3] || o.squash || 0.86);
      for (let y = Math.floor(cy - ry * 1.3); y <= Math.ceil(cy + ry * 1.3); y++) for (let x = Math.floor(cx - r * 1.3); x <= Math.ceil(cx + r * 1.3); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const dx = (x - cx) / r, dy = (y - cy) / ry;
        const lim = 1 + (noise(x / 2.4, y / 2.4, seed + idx * 3) - 0.5) * (o.rough || 0.32);
        if (dx * dx + dy * dy > lim * lim) continue;
        let s = lam(dx * 0.92, dy * 0.92);
        s += (noise(x / 2.2, y / 2.2, seed + 11) - 0.5) * (o.tex || 0.5);
        if (noise(x / 3.6, y / 2.7, seed + 17) > 0.67) s += 0.16;
        own[y * W + x] = idx + 1; sv[y * W + x] = s;
      }
    });
    const mask = new Uint8Array(W * H), pts = [];
    const ow = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : own[y * W + x]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const id = own[y * W + x]; if (!id) continue;
      const c = clumps[id - 1];
      let k = Math.floor(clamp((sv[y * W + x] + (o.bias || 0.4)) / 1.4, 0, 0.999) * ramp.length);
      const edge = !ow(x - 1, y) || !ow(x + 1, y) || !ow(x, y - 1) || !ow(x, y + 1);
      if (edge) k = y > c[1] ? 0 : Math.min(k, 1);
      else if (ow(x, y + 1) > id || ow(x - 1, y) > id) k = Math.max(0, k - 2);
      else if (!ow(x, y + 2) && y > c[1]) k = Math.min(k, 1);
      P.set(x, y, ramp[k]); mask[y * W + x] = 1; if (!edge) pts.push([x, y]);
    }
    return { mask, pts };
  }
  function rows2clumps(cx, rows, R) { // [[y, n, halfSpread, r], ...] -> jittered clump list sorted back to front
    const out = [];
    for (const [cy, n, sp, r] of rows) for (let k = 0; k < n; k++) {
      const fx = n === 1 ? 0 : -1 + (2 * k) / (n - 1);
      out.push([cx + fx * sp + (R() - 0.5) * 6, cy + (R() - 0.5) * 5 + Math.abs(fx) * 3, r * (1 - Math.abs(fx) * 0.22) + (R() - 0.5) * 3]);
    }
    return out.sort((a, b) => a[1] - b[1]);
  }
  // the lowest painted pixel of a mask in each column
  function maskBottoms(mask, W, H) { const b = new Int16Array(W).fill(-1); for (let x = 0; x < W; x++) for (let y = H - 1; y >= 0; y--) if (mask[y * W + x]) { b[x] = y; break; } return b; }
  // scanline polygon fill
  function poly(P, pts, fn) {
    let y0 = Infinity, y1 = -Infinity; for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5)) xs.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) fn(x, y);
    }
  }
  // a boulder in the manner of nature.js (noisy outline, light upper left)
  function boulder(P, cx, cy, rx, ry, ramp, seed, cut) {
    for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
      const wob = (noise((x + 20) / 3, (y + 20) / 3, seed) - 0.5) * 2.2;
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1 + wob * 0.12) continue;
      if (cut != null && y > cut) continue;
      const s = 0.55 - (x + y * 1.2) / (rx * 2.6) + (noise(x / 2.5, y / 2.5, seed + 1) - 0.5) * 0.45;
      let k = s > 0.82 ? 5 : s > 0.62 ? 4 : s > 0.42 ? 3 : s > 0.22 ? 2 : 1;
      if (hash(x, y, seed + 2) < 0.06) k = Math.max(1, k - 1);
      P.set(cx + x, cy + y, ramp[Math.min(k, ramp.length - 1)]);
    }
  }
  function pebble(P, x, y, w, h, ramp) {
    ramp = ramp || PAL.stone;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (w > 2 && h > 2 && (i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
      const t = (i / Math.max(1, w - 1)) * 0.5 + (j / Math.max(1, h - 1)) * 0.65;
      P.set(x + i, y + j, ramp[t < 0.3 ? 4 : t < 0.62 ? 3 : t < 0.95 ? 2 : 1]);
    }
  }
  function tuft(P, x, y, g) { // a grass tuft whose root is at (x, y) (as terrain.js decor)
    g = g || PAL.grass;
    P.set(x, y - 2, g[4]); P.set(x - 1, y - 1, g[4]); P.set(x + 1, y - 1, g[3]); P.set(x, y - 1, g[3]); P.set(x - 1, y, g[1]); P.set(x + 1, y, g[1]); P.set(x, y, g[0]);
  }
  // moss patches over existing opaque pixels for which test(x, y) holds; tone follows the surface beneath
  function mossify(P, test, seed, thr, o) {
    o = o || {};
    const W = P.w, H = P.h, m = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!P.op(x, y) || !test(x, y)) continue;
      const n = noise(x / (o.sx || 3), y / (o.sy || 2.6), seed) * 0.8 + hash(x, y, seed + 1) * 0.2 + (o.bonus ? o.bonus(x, y) : 0);
      if (n > thr) m[y * W + x] = 1;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue;
      const l = lum(P.get(x, y)), top = y === 0 || !m[(y - 1) * W + x], bot = y === H - 1 || !m[(y + 1) * W + x];
      let k = l < (o.t1 || 0.13) ? 1 : l < (o.t2 || 0.22) ? 2 : l < (o.t3 || 0.33) ? 3 : 4;
      if (top) k++; else if (bot) k--;
      P.set(x, y, MOSS[clamp(k, 1, 5)]);
    }
  }
  function hangMoss(P, x, y, len, seed, ramp) {
    ramp = ramp || HANGMOSS;
    let xx = x;
    for (let j = 0; j < len; j++) {
      const t = j / Math.max(1, len - 1);
      P.set(xx, y + j, t < 0.12 ? ramp[1] : t > 0.82 ? ramp[2] : (j + x) % 3 === 0 ? ramp[4] : ramp[3]);
      if (j > 1 && j < len - 2 && hash(x, j, seed) < 0.24) P.set(xx + (hash(j, x, seed) < 0.5 ? -1 : 1), y + j, ramp[2]);
      if (j > 2 && hash(x, j, seed + 1) < 0.1) xx += hash(x, j, seed + 2) < 0.5 ? -1 : 1;
    }
  }
  // a shelf fungus bracket against bark at (x, y), growing toward dir (+1 right, -1 left)
  function bracket(P, x, y, w, dir) {
    const rx = w, ry = Math.max(1.4, w * 0.42);
    for (let j = -Math.ceil(ry); j <= 1; j++) for (let i = 0; i <= w; i++) {
      const xx = x + i * dir;
      if (j <= 0) { if ((i * i) / (rx * rx) + (j * j) / (ry * ry) > 1.05) continue; const ring = Math.floor(Math.hypot(i / rx, j / ry) * 3.2); P.set(xx, y + j, j === 0 ? FUNGI[2] : FUNGI[ring % 2 ? 3 : 4]); }
      else if (i < w) P.set(xx, y + j, FUNGI[1]);
    }
  }
  // small glowing toadstools (as nature.js mushrooms): returns their light positions
  function glowCaps(P, spots, caps) {
    caps = caps || ['#2a9c8a', '#5dffd0', '#c4fff0'];
    const out = [];
    for (const [x, y, s] of spots) {
      const top = y - 2 - s;
      for (let yy = top + 1; yy <= y; yy++) P.set(x, yy, '#c8d4f0');
      for (let k = -s; k <= s; k++) P.glow(x + k, top, caps[1], caps[2]);
      for (let k = -s + 1; k <= s - 1; k++) P.glow(x + k, top - 1, caps[2], '#ffffff');
      P.set(x - s, top, caps[0]); P.set(x + s, top, caps[0]);
      out.push([x, top]);
    }
    return out;
  }
  // carve a list of screen pixels into stone: a dark groove, a lit lower-right lip; night colour optional
  function carve(P, pts, night, o) {
    o = o || {};
    const key = new Set(pts.map((p) => Math.round(p[0]) + ',' + Math.round(p[1])));
    for (const [x0, y0] of pts) { const x = Math.round(x0) + 1, y = Math.round(y0) + 1; if (!key.has(x + ',' + y) && P.op(x, y)) P.tint(x, y, '#ffffff', o.lip == null ? 0.16 : o.lip); }
    for (const [x0, y0] of pts) {
      const x = Math.round(x0), y = Math.round(y0); if (!P.op(x, y)) continue;
      const c = o.day || mixc(P.get(x, y), OUT, o.depth == null ? 0.45 : o.depth);
      if (night) P.glow(x, y, c, typeof night === 'function' ? night(x, y) : night); else P.set(x, y, c);
    }
    if (night && o.aura) for (const [x0, y0] of pts) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = Math.round(x0) + ox, y = Math.round(y0) + oy;
      if (!key.has(x + ',' + y) && P.op(x, y) && !P.nc[y * P.w + x]) P.nite(x, y, mixc(P.get(x, y), o.aura, 0.42));
    }
  }
  function spiralPts(r, turns, dir) {
    const out = [], seen = new Set(), n = Math.ceil(turns * 90);
    for (let k = 0; k <= n; k++) {
      const t = k / n, th = t * turns * Math.PI * 2 * (dir || 1), rr = 0.2 + (r - 0.2) * t;
      const x = Math.round(Math.cos(th) * rr), y = Math.round(Math.sin(th) * rr), key = x + ',' + y;
      if (!seen.has(key)) { seen.add(key); out.push([x, y]); }
    }
    return out;
  }
  function bitmap(rows) { const out = []; rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.') out.push([i, j, r[i]]); }); return out; }
  // fire: tongues of flame with a heat field, hottest wins; drawn after the outline
  function fire(P, cx, by, f, scale, tongues) {
    tongues = tongues || [[-2.3, 0.6, 1.7], [2.2, 0.56, 3.1], [0, 1, 0]];
    const heat = new Map();
    for (const [ox, hs, ph] of tongues) {
      const h = (9 + Math.sin(f * 1.9 + ph) * 1.7) * hs * scale, w = 3.1 * (hs < 1 ? 0.72 : 1) * scale;
      for (let j = 0; j <= h; j++) {
        const t = j / h, hw = w * Math.pow(1 - t, 0.8) * (0.86 + 0.14 * Math.sin(j * 1.1 + f * 2.3 + ph));
        const mid = cx + ox + Math.sin(t * 2.6 + f * 1.7 + ph) * t * 1.3;
        for (let x = Math.round(mid - hw); x <= Math.round(mid + hw); x++) {
          const d = Math.abs(x - mid) / Math.max(0.6, hw), v = (1 - t) * 1.15 - d * 0.75 + (hash(x, by - j, f * 7 + 3) - 0.5) * 0.2;
          const k = x + ',' + (by - j); if (!heat.has(k) || heat.get(k) < v) heat.set(k, v);
        }
      }
    }
    for (const [k, v] of heat) { const [x, y] = k.split(',').map(Number); P.set(x, y, v > 0.78 ? FIRE[5] : v > 0.6 ? FIRE[4] : v > 0.4 ? FIRE[3] : v > 0.2 ? FIRE[2] : v > 0.02 ? FIRE[1] : FIRE[0]); }
  }
  // webs: sagging silk strands and sheets, composited translucently (drawn after the outline)
  const SILK = '#e9e5f3';
  function strand(P, x0, y0, x1, y1, sag, a, col) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.6) + 1; let lx = null, ly = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
      if (x === lx && y === ly) continue; lx = x; ly = y; P.over(x, y, col || SILK, a);
    }
  }
  function radialWeb(P, cx, cy, anchors, a, rings) {
    const spokes = anchors.map(([x, y]) => [x, y]);
    for (const [x, y] of spokes) strand(P, cx, cy, x, y, 0.4, a);
    const sorted = spokes.map(([x, y]) => [Math.atan2(y - cy, x - cx), x, y]).sort((p, q) => p[0] - q[0]);
    for (let r = 2; r <= (rings || 8); r += 2) for (let k = 0; k < sorted.length; k++) {
      const p = sorted[k], q = sorted[(k + 1) % sorted.length];
      if (Math.abs(q[0] - p[0]) > 2.2 && k === sorted.length - 1) continue;
      const lp = Math.hypot(p[1] - cx, p[2] - cy), lq = Math.hypot(q[1] - cx, q[2] - cy); if (r > lp || r > lq) continue;
      strand(P, cx + ((p[1] - cx) * r) / lp, cy + ((p[2] - cy) * r) / lp, cx + ((q[1] - cx) * r) / lq, cy + ((q[2] - cy) * r) / lq, 0.3, a * 0.8);
    }
    P.over(cx, cy, SILK, a);
  }
  function sheet(P, pts, a, seed) { // a translucent sheet of silk with denser threads
    poly(P, pts, (x, y) => { const n = noise(x / 2.2, y / 2.2, seed); P.over(x, y, SILK, a * (0.55 + n * 0.6)); });
    for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; strand(P, p[0], p[1], q[0], q[1], 0.6, a * 1.8); }
  }
  // finish: turn a Pix (or frames of Pix) into the piece record
  function finish(spec, days, nights) {
    const out = Object.assign({ lights: [], solid: true }, spec);
    if (Array.isArray(days)) {
      out.frames = days.map((p) => p.canvas()); out.c = out.frames[0]; out.fps = spec.fps || 4;
      if (nights) { out.nframes = nights.map((p) => p.canvas()); out.n = out.nframes[0]; }
    } else { out.c = days.canvas(); if (nights) out.n = nights.canvas(); }
    out.w = out.c.width; out.h = out.c.height;
    return out;
  }
  // an iron lantern hanging from its top ring at (x, y) — glass colours g (dark -> light)
  function lanternBox(P, x, y, g, lit) {
    const m = IRON;
    P.set(x, y, m[3]); P.hline(x - 1, x + 1, y + 1, m[2]); P.hline(x - 2, x + 2, y + 2, m[3]); P.set(x - 2, y + 2, m[4]);
    for (let j = 3; j <= 8; j++) { P.set(x - 2, y + j, m[3]); P.set(x + 2, y + j, m[1]); for (let i = -1; i <= 1; i++) P.set(x + i, y + j, g[j < 5 ? 2 : j < 7 ? 1 : 0]); }
    P.vline(x, y + 3, y + 8, m[2]);
    P.hline(x - 2, x + 2, y + 9, m[2]); P.hline(x - 1, x + 1, y + 10, m[1]);
    if (lit) { P.set(x - 1, y + 5, g[3]); P.set(x + 1, y + 5, g[2]); }
  }

  // ================================================================== THE DEEPWOOD
  // ------------------------------------------------------------------ standing stones (0-2 upright, 3 leaning)
  function makeStandingStone(v) {
    const lean = v === 3, W = lean ? 32 : 20, H = lean ? 40 : 44, ax = lean ? 13 : 10, ay = H - 3;
    const P = new Pix(W, H), seed = 211 + v * 53, ST = STONE_OLD;
    const pr = [{ h: 35, b: 6.0, t: 4.4, top: 'peak', px: -1.4 }, { h: 30, b: 7.0, t: 6.3, top: 'notch' }, { h: 37, b: 5.3, t: 4.3, top: 'slant' }, { h: 28, b: 6.4, t: 5.5, top: 'round' }][v];
    const A = lean ? 0.42 : 0, ca = Math.cos(A), sa = Math.sin(A);
    const bx = ax, by = lean ? ay + 1 : ay - 2;
    const scr = (u, w) => [bx + u * ca + w * sa, by + u * sa - w * ca];
    const loc = (x, y) => { const dx = x - bx, dy = y - by; return [dx * ca + dy * sa, dx * sa - dy * ca]; };
    const prof = (w, side) => lerp(pr.b, pr.t, clamp(w / pr.h, 0, 1)) + Math.sin(clamp(w / pr.h, 0, 1) * Math.PI) * 0.45 + (noise(w / 4, side, seed) - 0.5) * 1.4;
    const topAt = (u) => pr.top === 'peak' ? pr.h - 0.1 * (u - pr.px) * (u - pr.px) - 0.3 * Math.abs(u - pr.px)
      : pr.top === 'notch' ? pr.h - 0.05 * u * u - (u > 2.2 ? (u - 2.2) * 1.4 : 0)
        : pr.top === 'slant' ? pr.h - (u + 4.5) * 0.6 - 0.05 * u * u
          : pr.h - 0.11 * u * u;
    const inside = (u, w) => w >= (lean ? -8 : 0) && w <= topAt(u) && u >= -prof(w, 1) && u <= prof(w, 7);
    P.shadow(ax + 3 + (lean ? 7 : 0), ay - 1, lean ? 12 : 8, 2.4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (lean && y > ay - 1) continue;
      const [u, w] = loc(x, y);
      if (!inside(u, w)) continue;
      const L = prof(w, 1), R = prof(w, 7), t = (u + L) / (L + R), tp = topAt(u);
      let s = 0.95 - Math.abs(t - 0.26) * 1.5;
      if (w > tp - 2.2) s += 0.36; else if (w > tp - 3.5) s += 0.12;
      if (w < 3) s -= (3 - w) * 0.07;
      s += (noise(u / 2.1 + 9, w / 3.2, seed) - 0.5) * 0.42 + (hash(x, y, seed) - 0.5) * 0.1;
      if (noise(w / 1.5, u / 9 + 3, seed + 2) > 0.76) s -= 0.16;
      let k = Math.floor(clamp((s + 0.1) / 1.12, 0, 0.999) * ST.length);
      if (!inside(u + 1.1, w)) k = Math.min(k, 1);
      P.set(x, y, ST[k]);
    }
    // a crack
    { const cu = [1.6, -2.2, 2.4, 1.2][v]; let [cx, cy] = scr(cu, pr.h * 0.62); for (let k = 0; k < 7; k++) { if (P.op(cx, cy)) { P.tint(cx, cy, OUT, 0.5); P.tint(cx + 1, cy, '#ffffff', 0.12); } cy += 1; if (hash(k, v, seed) < 0.35) cx += hash(v, k, seed) < 0.5 ? -1 : 1; } }
    // moss creeping up from the foot, on the cap and in the shade; lichen rosettes
    mossify(P, (x, y) => true, seed + 5, 0.66, {
      bonus: (x, y) => { const [u, w] = loc(x, y); return (w > topAt(u) - 3 ? 0.17 : 0) + (w < 6 ? (6 - w) * 0.05 : 0) + (u < -2 ? 0.04 : 0); },
      t1: 0.16, t2: 0.25, t3: 0.36,
    });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!P.op(x, y) || hash(x, y, seed + 7) > 0.03) continue;
      const c = P.get(x, y); if (c[1] > c[0] + 12) continue; // not on moss
      P.set(x, y, LICHEN[1]); if (P.op(x + 1, y)) P.set(x + 1, y, LICHEN[0]); if (P.op(x, y - 1) && hash(x, y, seed + 8) < 0.6) P.set(x, y - 1, LICHEN[2]);
    }
    // runes: spirals, ogham notches and moon signs, carved; they glow teal-violet after dark
    const TEAL = '#93f4e6', VIO = '#bca4f6';
    const glyph = (pts, gu, gw, col) => { const s = []; const seen = new Set(); for (const [px, py] of pts) { const [x, y] = scr(gu + px, gw - py), k = Math.round(x) + ',' + Math.round(y); if (!seen.has(k)) { seen.add(k); s.push([x, y]); } } carve(P, s, col, { aura: col === TEAL ? '#3ec8b8' : '#7a5ad0', depth: 0.5 }); return scr(gu, gw); };
    const ogham = (gu, w0, n) => { const pts = []; for (let k = 0; k <= n * 2; k++) pts.push([0, -k]); for (let k = 0; k < n; k++) { const len = 1 + ((k * 7 + v) % 3); for (let i = 1; i <= len; i++) pts.push([i, -k * 2 - 1]); } return glyph(pts, gu, w0, VIO); };
    let main;
    if (v === 0) { main = glyph(spiralPts(3.2, 1.55, 1), -0.6, 22.5, TEAL); ogham(-2.4, 8, 4); }
    else if (v === 1) { main = glyph(spiralPts(2.6, 1.35, 1), -2.6, 17.5, TEAL); glyph(spiralPts(2.6, 1.35, -1), 3.0, 15.5, TEAL); for (let k = 0; k < 4; k++) glyph([[0, 0]], -3.2 + k * 2.1, 24 - (k % 2), VIO); }
    else if (v === 2) {
      const cres = []; for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const o = x * x + y * y <= 10, i = (x - 1.6) * (x - 1.6) + (y + 0.6) * (y + 0.6) <= 6.5; if (o && !i) cres.push([x, y]); }
      main = glyph(cres, -0.5, 27, VIO);
      const ring = []; for (let a = 0; a < 24; a++) ring.push([Math.round(Math.cos((a / 24) * Math.PI * 2) * 2.2), Math.round(Math.sin((a / 24) * Math.PI * 2) * 2.2)]);
      glyph(ring, -0.6, 19, VIO); glyph(spiralPts(2.4, 1.3, 1), -1, 10.5, TEAL);
    } else { main = glyph(spiralPts(3, 1.45, 1).filter((p, i) => i % 7 !== 3), -0.5, 16.5, TEAL); ogham(2.2, 9, 2); }
    // the foot: grass tufts and pebbles (a heaved mound of earth for the leaning stone, and a fallen chip)
    if (lean) {
      for (let y = -3; y <= 1; y++) for (let x = -8; x <= 6; x++) { const e = (x * x) / 56 + ((y + 1) * (y + 1)) / 5.5; if (e > 1 || !P.ok(bx - 4 + x, ay - 1 + y)) continue; if (P.op(bx - 4 + x, ay - 1 + y) && y < -1) continue; P.set(bx - 4 + x, ay - 1 + y, y <= -2 ? PAL.grass[3] : hash(x, y, seed) < 0.5 ? PAL.soil[3] : PAL.soil[2]); }
      tuft(P, bx - 9, ay - 2); tuft(P, bx - 2, ay - 3); tuft(P, bx + 4, ay - 1, PAL.forest);
      pebble(P, bx + 12, ay - 3, 5, 3, ST.slice(1)); P.set(bx + 13, ay - 4, LICHEN[1]); tuft(P, bx + 17, ay - 1);
    } else {
      tuft(P, bx - 6, ay - 1); tuft(P, bx + 5, ay - 1); P.set(bx + 7, ay - 2, PAL.grass[3]); pebble(P, bx - 9, ay - 2, 2, 2);
    }
    P.outline(OUT);
    const [lx, ly] = main;
    return finish({ ax, ay, foot: [1, 1], solid: true, lights: [Lt(Math.round(lx), Math.round(ly), 18, [140, 200, 250], 0.45, { night: true })] }, P, P.night());
  }

  // ------------------------------------------------------------------ the altar slab of the stone circle
  function makeAltarSlab() {
    const W = 38, H = 26, ax = 19, ay = 23, P = new Pix(W, H), seed = 321, ST = STONE_OLD;
    P.shadow(ax + 2, ay - 2, 18, 3.4);
    const x0 = 3, x1 = 34, ty0 = 7, ty1 = 16, fy1 = 21;
    for (let y = ty0; y <= fy1; y++) for (let x = x0; x <= x1; x++) {
      const cut = (y === ty0 && (x < x0 + 2 || x > x1 - 2)) || (y === ty0 + 1 && (x === x0 || x === x1)) || (y === fy1 && (x === x0 || x === x1));
      if (cut || ((x === x0 || x === x1) && hash(x, y, seed) < 0.22)) continue;
      let s;
      if (y <= ty1) {
        s = 0.66 + (noise(x / 3, y / 2, seed) - 0.5) * 0.34 - ((x - x0) / (x1 - x0)) * 0.2 + (hash(x, y, seed + 1) - 0.5) * 0.08;
        if (y === ty0 || x === x0 + (y === ty0 + 1 ? 1 : 0)) s += 0.22;
        if (y === ty1) s -= 0.12;
      } else {
        const fy = y - ty1 - 1;
        s = fy === 0 ? 0.48 : 0.3 - fy * 0.05 + (noise(x / 2, y / 3, seed + 1) - 0.5) * 0.3 - ((x - x0) / (x1 - x0)) * 0.12;
      }
      if (x === x1) s -= 0.2;
      P.set(x, y, ST[Math.floor(clamp(s, 0, 0.999) * ST.length)]);
    }
    // a crack across the top
    { let x = 27, y = ty0 + 1; while (y < ty1) { P.tint(x, y, OUT, 0.5); P.tint(x + 1, y, '#ffffff', 0.14); y++; if (hash(x, y, seed) < 0.45) x++; } }
    // the crescent moon carved on top (foreshortened), glowing moon-white at night
    const cres = [];
    for (let y = -4; y <= 4; y++) for (let x = -5; x <= 5; x++) { const o = (x * x) / 18 + (y * y) / 9 <= 1, i = ((x - 1.9) * (x - 1.9)) / 13 + ((y + 0.6) * (y + 0.6)) / 6.6 <= 1; if (o && !i) cres.push([19 + x, 11.5 + y]); }
    carve(P, cres, '#e8eeff', { aura: '#a8b8f0', depth: 0.5 });
    P.nite(16, 11, '#ffffff'); P.nite(16, 12, '#ffffff');
    // the moon's phases along the front edge
    const PH = [['.#.', '#.#', '.#.'], ['##.', '#..', '##.'], ['##.', '##.', '##.'], ['.##', '###', '.##'], ['.#.', '###', '.#.']];
    PH.forEach((g, k) => { const pts = bitmap(g).map(([i, j]) => [8 + k * 5.4 + i, ty1 + 2 + j]); carve(P, pts, '#b9a0f4', { depth: 0.4, lip: 0.1 }); });
    mossify(P, (x, y) => true, seed + 4, 0.62, { bonus: (x, y) => (Math.min(x - x0, x1 - x) < 4 ? 0.12 : 0) + (y > fy1 - 2 ? 0.08 : 0) - (Math.abs(x - 19) < 7 && y < ty1 ? 0.3 : 0), t1: 0.16, t2: 0.25, t3: 0.36 });
    for (const [x, y] of [[7, 9], [30, 13], [24, 19], [11, 15]]) { P.set(x, y, LICHEN[1]); P.set(x + 1, y, LICHEN[0]); P.set(x, y - 1, LICHEN[2]); }
    tuft(P, x0 - 1, fy1 + 1); tuft(P, x1 + 1, fy1); tuft(P, 14, fy1 + 1, PAL.forest);
    P.outline(OUT);
    return finish({ ax, ay, foot: [2, 1], solid: true, lights: [Lt(18, 11, 24, [200, 215, 255], 0.5, { night: true })] }, P, P.night());
  }

  // ------------------------------------------------------------------ mossy giant (0) / darker, hollowed giant (1)
  function makeGiantTree(v) {
    const W = 88, H = 126, ax = 44, ay = 122, P = new Pix(W, H), seed = 601 + v * 97, R = rng(seed);
    const bark = v ? BARK_DARK : BARK_OLD, leaves = v ? CANOPY_DARK : CANOPY_GIANT;
    P.shadow(ax + 5, ay - 6, 40, 8.5, 0.34);
    const bf = barkFn(P, bark, seed, { fx: 0.45, fy: 7 }), rf = rootFn(P, bark, seed, v ? 0.5 : 0.8);
    tube(P, [[ax - 8, ay - 22], [ax - 22, ay - 19], [ax - 34, ay - 13]], [6, 3.5, 1.2], rf);
    tube(P, [[ax + 8, ay - 22], [ax + 23, ay - 18], [ax + 36, ay - 12]], [6, 3.5, 1.2], rf);
    tube(P, [[ax - 3, 74], [ax - 15, 60], [ax - 25, 47]], [6, 4.5, 3], bf);
    tube(P, [[ax + 3, 72], [ax + 16, 58], [ax + 26, 45]], [6, 4.5, 3], bf);
    tube(P, [[ax, ay - 14], [ax - 1, ay - 30], [ax + 1, 80], [ax + 1, 58]], [15, 12.5, 11, 9.5], bf, { capA: 0.42, rough: 0.12, seed });
    tube(P, [[ax - 9, ay - 18], [ax - 21, ay - 10], [ax - 31, ay - 5]], [7.5, 4.2, 1.3], rf);
    tube(P, [[ax + 9, ay - 17], [ax + 21, ay - 9], [ax + 32, ay - 4]], [7.5, 4.2, 1.3], rf);
    tube(P, [[ax - 4, ay - 14], [ax - 9, ay - 6], [ax - 13, ay - 1]], [6, 3.6, 1.4], rf);
    tube(P, [[ax + 5, ay - 13], [ax + 9, ay - 6], [ax + 12, ay - 1]], [5.5, 3.3, 1.3], rf);
    // moss climbing the lit side of the trunk
    mossify(P, (x, y) => y > 70 && y < ay - 8 && x < ax + 2, seed + 21, v ? 0.7 : 0.6, { bonus: (x, y) => (ax - x) * 0.012 + (y > ay - 30 ? 0.08 : 0) });
    // shelf fungi
    bracket(P, ax + 9, 96, 4, 1); bracket(P, ax + 10, 101, 3, 1); bracket(P, ax - 10, 86, 3, -1);
    const lights = [];
    if (v) {
      // hollows: one at the foot between the roots, a knot-hole higher up; glowing toadstools in the dark
      const hole = (cx, cy, rx, ry) => {
        for (let y = -ry - 2; y <= ry + 2; y++) for (let x = -rx - 2; x <= rx + 2; x++) {
          const e = (x * x) / (rx * rx) + (y * y) / (ry * ry);
          if (e <= 1) P.set(cx + x, cy + y, e < 0.45 ? '#06040a' : '#0e0a12');
          else if (e <= 1.5 && P.op(cx + x, cy + y)) P.set(cx + x, cy + y, x + y > 0 ? bark[3] : bark[0]);
        }
      };
      hole(ax - 2, ay - 24, 5, 8); hole(ax + 5, 84, 2.5, 3.5);
      for (const [x, y] of glowCaps(P, [[ax - 6, ay - 16, 1], [ax + 3, ay - 15, 1], [ax - 9, ay - 13, 1]])) lights.push(Lt(x, y, 12, [93, 255, 208], 0.45, { night: true }));
    }
    // the canopy
    const clumps = rows2clumps(ax, [[17, 3, 20, 13.5], [30, 4, 28, 14.5], [45, 5, 31, 14], [59, 4, 25, 13]], R);
    const cm = canopy(P, clumps, leaves, seed, { bias: v ? 0.36 : 0.42 });
    // hanging moss from the canopy's lower edge
    const bot = maskBottoms(cm.mask, W, H);
    for (let x = 4; x < W - 4; x++) {
      if (bot[x] < 0 || hash(x, 3, seed) > (v ? 0.42 : 0.3)) continue;
      const nearTrunk = Math.abs(x - ax) < 12, len = Math.round((nearTrunk ? 3 : 5) + hash(x, 4, seed) * (v ? 16 : 11));
      hangMoss(P, x, bot[x] + 1, len, seed + x);
    }
    P.outline(OUT);
    return finish({ ax, ay, foot: [3, 2], solid: true, fade: true, lights }, P, v ? P.night() : null);
  }

  // ------------------------------------------------------------------ the Elder Tree
  const RUNES = [
    ['#..', '##.', '#.#', '#..', '#..'], ['#.#', '#.#', '.#.', '.#.', '.#.'], ['#..', '.#.', '..#', '.#.', '#..'],
    ['.#.', '.#.', '###', '.#.', '.#.'], ['##.', '#.#', '##.', '#..', '#..'], ['#.#', '.#.', '#.#', '.#.', '#.#'], ['.#.', '#.#', '.#.', '#.#', '.#.'],
  ];
  function makeElderTree() {
    const W = 156, H = 188, ax = 78, ay = 184, P = new Pix(W, H), seed = 909, R = rng(seed), B = BARK_ELDER;
    P.shadow(ax + 6, ay - 9, 72, 13, 0.36);
    const bf = barkFn(P, B, seed, { fx: 0.42, fy: 8, twist: 0.3 }), rf = rootFn(P, B, seed, 0.9);
    // roots behind the trunk
    tube(P, [[ax - 18, ay - 36], [ax - 42, ay - 31], [ax - 60, ay - 22], [ax - 71, ay - 15]], [12, 8, 4.5, 1.6], rf);
    tube(P, [[ax + 18, ay - 36], [ax + 43, ay - 30], [ax + 61, ay - 21], [ax + 73, ay - 13]], [12, 8, 4.5, 1.6], rf);
    // the three great limbs
    tube(P, [[ax - 6, 112], [ax - 27, 90], [ax - 45, 70], [ax - 58, 54]], [13, 10, 7, 4.5], bf);
    tube(P, [[ax + 7, 110], [ax + 29, 88], [ax + 47, 68], [ax + 58, 52]], [12, 9.5, 6.5, 4.5], bf);
    tube(P, [[ax + 1, 108], [ax - 3, 84], [ax + 3, 60], [ax, 42]], [14, 10, 7, 5], bf);
    // the gnarled trunk
    tube(P, [[ax, ay - 24], [ax - 3, ay - 50], [ax + 3, ay - 74], [ax, 104]], [33, 28, 25, 22], bf, { capA: 0.4, rough: 0.1, seed });
    // gnarls: burls bulging from the bark
    for (const [x, y, r] of [[ax - 22, ay - 58, 5], [ax + 20, ay - 70, 4], [ax - 12, ay - 84, 3.5]]) tube(P, [[x, y], [x + 0.5, y + 0.5]], [r, r], bf);
    // front roots, one arching up out of the ground
    tube(P, [[ax - 22, ay - 26], [ax - 42, ay - 16], [ax - 56, ay - 8], [ax - 64, ay - 3]], [13, 8, 4, 1.5], rf);
    tube(P, [[ax + 22, ay - 26], [ax + 43, ay - 15], [ax + 57, ay - 7], [ax + 66, ay - 2]], [13, 8, 4, 1.5], rf);
    tube(P, [[ax - 16, ay - 20], [ax - 26, ay - 20], [ax - 34, ay - 17], [ax - 38, ay - 10], [ax - 40, ay - 3]], [9, 7, 5.5, 4, 2.2], rf);
    tube(P, [[ax + 16, ay - 20], [ax + 26, ay - 12], [ax + 33, ay - 2]], [10, 6, 2.2], rf);
    tube(P, [[ax - 10, ay - 14], [ax - 13, ay - 3]], [6, 2.5], rf);
    tube(P, [[ax + 10, ay - 14], [ax + 15, ay - 3]], [6, 2.5], rf);
    mossify(P, (x, y) => y > 100 && y < ay - 30 && x < ax - 6 && !(Math.abs(x - ax) < 14 && y > ay - 52), seed + 21, 0.58, { bonus: (x, y) => (ax - x) * 0.006 });
    // the glowing hollow at its foot
    const htop = ay - 50, hbot = ay - 9, hw = 12, hcx = ax;
    const inHollow = (x, y) => { if (y < htop || y > hbot) return false; const yy = y - (htop + 15); if (yy < 0) return ((x - hcx) * (x - hcx)) / (hw * hw) + (yy * yy) / 225 <= 1; return Math.abs(x - hcx) <= hw - (y > hbot - 4 ? (y - (hbot - 4)) * 0.9 : 0); };
    const HG = ['#081614', '#0d2a25', '#164a3e', '#257a62', '#3fbf92', '#8ff0c8', '#e2fff2'];
    for (let y = htop - 4; y <= hbot + 2; y++) for (let x = hcx - hw - 4; x <= hcx + hw + 4; x++) {
      if (inHollow(x, y)) {
        const d = Math.hypot((x - hcx) / hw, (y - (hbot - 11)) / 18) + (y < htop + 10 ? 0.25 : 0) + (bayer(x, y) - 0.5) * 0.14;
        const k = d > 0.98 ? 0 : d > 0.8 ? 1 : d > 0.62 ? 2 : d > 0.46 ? 3 : d > 0.32 ? 4 : d > 0.18 ? 5 : 6;
        P.glow(x, y, HG[k], HG[Math.min(6, k + (k >= 2 ? 1 : 0))]);
      } else if (P.op(x, y)) {
        let dmin = 9; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (inHollow(x + i, y + j)) dmin = Math.min(dmin, Math.hypot(i, j));
        if (dmin <= 1.01) P.set(x, y, B[0]); else if (dmin <= 2.1) P.set(x, y, x > hcx && y > htop + 12 ? B[4] : B[1]);
        if (dmin < 4.5) { P.tint(x, y, '#5dffd0', 0.14 * (1 - dmin / 4.5)); P.nite(x, y, mixc(P.get(x, y), '#5dffd0', 0.32 * (1 - dmin / 4.5))); }
      }
    }
    const lights = [Lt(hcx, hbot - 11, 74, [110, 255, 200], 0.9), Lt(hcx, hbot - 6, 30, [210, 255, 235], 0.55)];
    for (const [x, y] of glowCaps(P, [[hcx - 14, hbot - 1, 1], [hcx - 11, hbot + 2, 1], [hcx + 12, hbot, 2], [hcx + 16, hbot - 3, 1], [ax - 40, ay - 12, 1]])) lights.push(Lt(x, y, 12, [93, 255, 208], 0.4, { night: true }));
    // teal runes winding up the bark (they glow by day, brighter by night)
    const runeAt = (x, y, g) => {
      const pts = bitmap(RUNES[g % RUNES.length]);
      for (const [i, j] of pts) { if (!pts.some((p) => p[0] === i + 1 && p[1] === j + 1)) P.set(x + i + 1, y + j + 1, B[0]); }
      for (const [i, j] of pts) P.glow(x + i, y + j, (i + j) % 2 ? '#3fd4b4' : '#62f2d2', (i + j) % 2 ? '#c8fff2' : '#ffffff');
      for (const [i, j] of pts) for (const [ox, oy] of [[1, 0], [-1, 0], [0, -1]]) { const xx = x + i + ox, yy = y + j + oy; if (!pts.some((p) => p[0] === i + ox && p[1] === j + oy) && P.op(xx, yy) && !P.nc[yy * W + xx]) P.nite(xx, yy, mixc(P.get(xx, yy), '#5dffd0', 0.45)); }
    };
    const runes = [[ax - 7, ay - 58], [ax - 1, ay - 67], [ax + 6, ay - 76], [ax + 3, ay - 86], [ax - 4, 92], [ax - 30, 84], [ax + 31, 82], [ax - 45, ay - 15], [ax + 44, ay - 14]];
    runes.forEach(([x, y], k) => runeAt(x, y, k));
    lights.push(Lt(ax, ay - 70, 36, [90, 240, 210], 0.5, { night: true }), Lt(ax - 30, 86, 24, [90, 240, 210], 0.38, { night: true }), Lt(ax + 32, 84, 24, [90, 240, 210], 0.38, { night: true }));
    // the canopy
    const clumps = rows2clumps(ax, [[22, 4, 44, 20], [40, 5, 58, 21], [60, 6, 64, 19], [80, 6, 62, 17], [97, 4, 46, 14]], R);
    const cm = canopy(P, clumps, CANOPY_ELDER, seed, { bias: 0.42 });
    for (const [x, y] of cm.pts) if (hash(x, y, seed + 31) < 0.012 && lum(P.get(x, y)) > 0.3) { P.set(x, y, '#a8e8c8'); }
    // moss curtains from the canopy and the limbs
    const bot = maskBottoms(cm.mask, W, H);
    for (let x = 4; x < W - 4; x++) {
      if (bot[x] < 0) continue;
      const dc = Math.abs(x - ax);
      if (dc < 20 ? hash(x, 5, seed) > 0.18 : hash(x, 5, seed) > 0.62) continue;
      const len = Math.round(dc < 20 ? 4 + hash(x, 6, seed) * 6 : 8 + noise(x / 6, 2, seed) * 26 + hash(x, 6, seed) * 8);
      hangMoss(P, x, bot[x] + 1, len, seed + x);
    }
    P.outline(OUT);
    // fireflies: three frames of a gentle pulse, drawn over the outline
    const flies = []; for (let k = 0; k < 15; k++) flies.push([12 + R() * 132, 74 + R() * 100, Math.floor(R() * 3)]);
    const frames = [], nframes = [];
    for (let f = 0; f < 3; f++) {
      const D = P.clone();
      for (const [fx0, fy0, ph] of flies) {
        const lvl = (ph + f) % 3, x = Math.round(fx0 + [0, 1, 1][f] * (ph % 2 ? 1 : -1)), y = Math.round(fy0 - [0, 1, 0][f]);
        if (lvl === 0) { D.over(x, y, '#c8e86a', 0.45); continue; }
        D.glow(x, y, lvl === 2 ? '#f4ffc0' : '#d8f27a', '#ffffff');
        if (lvl === 2) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) D.over(x + ox, y + oy, '#c8f070', 0.5);
      }
      frames.push(D); nframes.push(D.night());
    }
    for (let k = 0; k < 5; k++) { const [x, y] = flies[k * 3]; lights.push(Lt(Math.round(x), Math.round(y), 14, [220, 255, 150], 0.38, { night: true })); }
    return finish({ ax, ay, foot: [5, 3], solid: true, fade: true, fps: 2.5, lights }, frames, nframes);
  }

  // ------------------------------------------------------------------ dead trees draped in webs (1: with a cocoon)
  function makeWebbedTree(v) {
    const W = 40, H = 60, ax = 20, ay = 57, P = new Pix(W, H), seed = 801 + v * 41, R = rng(seed), Gr = BARK_DEAD;
    P.shadow(ax + 2, ay - 1, 9, 2.8);
    const bf = barkFn(P, Gr, seed, { fx: 1.1, fy: 4, bias: 0.38 });
    const limb = (pts, r0, r1) => tube(P, pts, pts.map((p, k) => lerp(r0, r1, k / (pts.length - 1))), bf);
    const twigs = [];
    const twig = (x, y, ang, len, depth) => {
      for (let i = 0; i < len; i++) { x += Math.cos(ang); y += Math.sin(ang); P.set(x, y, Gr[depth > 0 ? 3 : 2]); ang += (R() - 0.5) * 0.4; }
      twigs.push([Math.round(x), Math.round(y)]);
      if (depth > 0) { twig(x, y, ang - 0.55, len * 0.6, depth - 1); twig(x, y, ang + 0.5, len * 0.55, depth - 1); }
    };
    limb([[ax - 1, ay - 4], [ax - 6, ay - 1]], 2.2, 0.9); limb([[ax + 1, ay - 4], [ax + 6, ay - 1]], 2.2, 0.9); limb([[ax, ay - 3], [ax + 2, ay]], 2, 1);
    const top = v === 2 ? ay - 30 : ay - 27;
    tube(P, [[ax, ay - 1], [ax - 1, ay - 12], [ax + 1, top]], [3.4, 2.8, 2.3], bf, { capA: 0.5 });
    let tips;
    if (v === 0) {
      limb([[ax, ay - 24], [ax - 6, ay - 31], [ax - 11, ay - 38], [ax - 13, ay - 46]], 2, 0.8);
      limb([[ax + 1, ay - 22], [ax + 7, ay - 28], [ax + 12, ay - 34], [ax + 16, ay - 38]], 2, 0.8);
      limb([[ax, ay - 26], [ax + 2, ay - 36], [ax, ay - 46], [ax + 2, ay - 53]], 1.9, 0.7);
      twig(ax - 13, ay - 46, -2.1, 4, 1); twig(ax - 11, ay - 39, -2.8, 4, 1); twig(ax + 16, ay - 38, -0.7, 4, 1); twig(ax + 2, ay - 53, -1.3, 3, 1); twig(ax + 1, ay - 44, -0.4, 4, 1);
      tips = { L: [ax - 11, ay - 38], LL: [ax - 13, ay - 45], T: [ax + 1, ay - 44], F: [ax, ay - 27], Rt: [ax + 15, ay - 37], Rm: [ax + 7, ay - 28] };
    } else if (v === 1) {
      limb([[ax, ay - 23], [ax - 7, ay - 29], [ax - 13, ay - 33], [ax - 16, ay - 40]], 2, 0.8);
      limb([[ax + 1, ay - 25], [ax + 7, ay - 31], [ax + 13, ay - 33], [ax + 16, ay - 31]], 2, 0.8);
      limb([[ax, ay - 26], [ax - 2, ay - 37], [ax + 1, ay - 47], [ax - 1, ay - 52]], 1.9, 0.7);
      twig(ax - 16, ay - 40, -1.9, 4, 1); twig(ax - 13, ay - 33, 3.4, 3, 0); twig(ax + 16, ay - 31, -0.4, 4, 1); twig(ax - 1, ay - 52, -1.7, 3, 1); twig(ax + 1, ay - 45, -0.5, 5, 1);
      tips = { L: [ax - 13, ay - 33], LL: [ax - 16, ay - 40], T: [ax, ay - 46], F: [ax, ay - 26], Rt: [ax + 16, ay - 31], Rm: [ax + 9, ay - 32] };
    } else {
      // snapped: a jagged broken top, stubby limbs, one dangling
      for (let k = -2; k <= 2; k++) { const h = 1 + Math.round(hash(k, 1, seed) * 4); for (let j = 1; j <= h; j++) P.set(ax + k, top - j, Gr[k < 0 ? 4 : 2]); }
      P.set(ax - 1, top + 1, Gr[5]); P.set(ax, top, '#8a7f8e');
      limb([[ax, ay - 18], [ax - 7, ay - 24], [ax - 12, ay - 31]], 1.9, 0.8);
      limb([[ax + 1, ay - 23], [ax + 8, ay - 28], [ax + 11, ay - 27]], 1.7, 0.8);
      limb([[ax - 1, ay - 13], [ax - 6, ay - 12], [ax - 9, ay - 7]], 1.3, 0.7);
      twig(ax - 12, ay - 31, -1.6, 4, 1); twig(ax + 11, ay - 27, -0.3, 3, 0); twig(ax - 9, ay - 7, 1.9, 2, 0);
      tips = { L: [ax - 11, ay - 30], T: [ax, top - 2], F: [ax + 1, ay - 22], Rt: [ax + 10, ay - 27], Low: [ax - 8, ay - 8] };
    }
    // a silk-wrapped cocoon hanging from the right limb
    let cocoon = null;
    if (v === 1) {
      const cx = ax + 12, cy = ay - 23;
      for (let y = -5; y <= 5; y++) for (let x = -3; x <= 3; x++) {
        if ((x * x) / 7.3 + (y * y) / 30 > 1) continue;
        const s = lam(x / 3, y / 6) + ((x + y * 2 + 40) % 3 === 0 ? -0.25 : 0) + (hash(x, y, 9) - 0.5) * 0.1;
        P.set(cx + x, cy + y, ['#625c72', '#857f96', '#aaa4ba', '#cdc8da', '#e9e5f3'][Math.floor(clamp((s + 0.35) / 1.3, 0, 0.999) * 5)]);
      }
      P.set(cx, cy + 6, '#857f96'); cocoon = [cx, cy];
    }
    P.outline(OUT);
    // webs over everything, translucent
    const A = 0.62;
    if (v === 0) {
      radialWeb(P, ax - 5, ay - 37, [tips.L, tips.LL, [ax - 8, ay - 47], tips.T, [ax + 1, ay - 37], tips.F, [ax - 6, ay - 31]], A, 8);
      sheet(P, [tips.Rm, tips.Rt, [ax + 13, ay - 26], [ax + 3, ay - 16]], 0.2, seed);
      strand(P, tips.Rt[0], tips.Rt[1], tips.Rt[0] + 2, ay - 4, 0.2, 0.5);
      strand(P, ax - 13, ay - 45, ax - 15, ay - 30, 0.5, 0.45);
    } else if (v === 1) {
      strand(P, cocoon[0], ay - 33, cocoon[0], cocoon[1] - 5, 0, 0.75);
      sheet(P, [tips.F, tips.L, [ax - 12, ay - 26], [ax - 3, ay - 15]], 0.22, seed);
      radialWeb(P, ax + 6, ay - 40, [tips.T, [ax + 1, ay - 47], tips.Rm, [ax + 16, ay - 33], [ax + 2, ay - 31], [ax + 13, ay - 44]], A, 6);
      sheet(P, [[ax - 4, ay - 2], [ax + 4, ay - 3], [ax + 9, ay], [ax - 7, ay]], 0.3, seed + 2);
    } else {
      sheet(P, [tips.L, tips.T, [ax + 1, ay - 19], [ax - 9, ay - 22]], 0.26, seed);
      sheet(P, [tips.Rt, [ax + 15, ay - 12], [ax + 17, ay - 1], [ax + 3, ay - 2], [ax + 2, ay - 18]], 0.24, seed + 1);
      strand(P, tips.Low[0], tips.Low[1], ax - 15, ay - 1, 0.5, 0.55);
      radialWeb(P, ax - 7, ay - 26, [tips.L, [ax - 1, ay - 29], [ax - 1, ay - 20], [ax - 10, ay - 18], [ax - 13, ay - 24]], 0.55, 5);
    }
    return finish({ ax, ay, foot: [1, 1], solid: true, lights: [] }, P);
  }

  // ------------------------------------------------------------------ bones: 0 skull + candle, 1 beast ribcage, 2 scattered
  const SKULL = ['..hhhbb..', '.hhbbbbbm', 'hhbbbbbbm', 'hbooboobm', 'hbooboomd', '.bbbnbbmd', '..bmbmbd.', '..m.m.m..'];
  function drawSkull(P, x, y) {
    const map = { h: BONE[4], b: BONE[3], m: BONE[2], d: BONE[1], o: '#1b1429', n: '#2a2033' };
    for (const [i, j, ch] of bitmap(SKULL)) P.set(x + i, y + j, map[ch]);
  }
  function makeBones(v) {
    if (v === 1) return makeRibcage();
    if (v === 2) {
      const W = 20, H = 16, ax = 10, ay = 13, P = new Pix(W, H);
      const bone = (x0, y0, x1, y1) => { P.line(x0, y0, x1, y1, BONE[3]); P.line(x0, y0 + 1, x1, y1 + 1, BONE[1]); for (const [x, y] of [[x0, y0], [x1, y1]]) { P.set(x - 1, y, BONE[4]); P.set(x + 1, y, BONE[3]); P.set(x, y - 1, BONE[4]); P.set(x, y + 1, BONE[2]); } };
      bone(4, 10, 12, 5); bone(13, 12, 17, 11);
      P.line(2, 4, 5, 3, BONE[3]); P.set(2, 5, BONE[2]);
      for (let k = 0; k < 4; k++) P.set(14 + k, 4 + (k === 0 || k === 3 ? 1 : 0), BONE[k % 2 ? 2 : 3]); // a rib arc
      P.set(7, 13, BONE[3]); P.set(8, 14, BONE[2]); P.set(9, 13, BONE[3]); P.set(10, 14, BONE[2]); P.set(11, 13, BONE[3]); // jawbone
      P.rect(15, 7, 3, 2, BONE[3]); P.set(15, 7, BONE[4]); P.set(16, 8, '#1b1429'); P.set(18, 8, BONE[2]); // a small skull
      P.set(3, 12, BONE[2]); P.set(17, 14, BONE[3]); tuft(P, 9, 8, PAL.forest);
      P.outline(OUT);
      return finish({ ax, ay, foot: [1, 1], solid: false, flat: true, lights: [] }, P);
    }
    const W = 18, H = 20, ax = 9, ay = 17;
    const frames = [0, 1, 2].map((f) => {
      const P = new Pix(W, H);
      drawSkull(P, 4, 9);
      // a candle stub melted onto the crown
      P.rect(7, 5, 3, 4, '#d8ccb4'); P.vline(7, 5, 8, '#efe6d2'); P.vline(9, 5, 8, '#b4a68c'); P.hline(7, 9, 5, '#f6efe0');
      P.set(6, 8, '#efe6d2'); P.set(6, 9, '#efe6d2'); P.set(10, 9, '#d8ccb4'); P.set(5, 10, '#efe6d2');
      P.set(8, 4, '#2a2033');
      P.set(2, 15, BONE[3]); P.set(3, 16, BONE[2]); P.set(14, 15, BONE[3]); P.set(15, 15, BONE[2]); P.set(13, 16, '#efe6d2');
      P.outline(OUT);
      const fx = 8 + (f === 2 ? 1 : 0);
      P.set(fx, 3, '#fff3cf'); P.set(8, 4, '#ffffff'); P.set(fx, 2 - (f === 1 ? 1 : 0), '#ffd27a'); if (f !== 2) P.set(fx, 1 - (f === 1 ? 1 : 0), '#f59b3c');
      return P;
    });
    return finish({ ax, ay, foot: [1, 1], solid: false, flat: true, fps: 6, lights: [Lt(8, 3, 26, [255, 190, 110], 0.6, { flicker: 1 })] }, frames);
  }
  function makeRibcage() {
    const W = 40, H = 26, ax = 20, ay = 23, P = new Pix(W, H);
    P.shadow(ax + 1, ay - 3, 17, 3.4);
    // far ribs (behind the spine)
    for (let k = 0; k < 7; k++) { const x = 12 + k * 3, l = 5 - Math.floor(k / 3); for (let j = 0; j < l; j++) P.set(x - Math.round(j * 0.6), 9 - j, BONE[j > l - 2 ? 1 : 2]); }
    // the spine
    for (let x = 9; x <= 33; x++) { P.set(x, 10, BONE[3]); P.set(x, 11, BONE[1]); if (x % 3 === 0) { P.set(x, 9, BONE[4]); P.set(x, 11, BONE[2]); } }
    // near ribs arching down to the ground
    for (let k = 0; k < 7; k++) {
      const x0 = 12 + k * 3, len = 11 - Math.floor(k * 0.9);
      for (let j = 0; j <= len; j++) { const t = j / len, x = x0 - Math.sin(t * Math.PI * 0.85) * 3.2 - t * 1.2, y = 12 + j; P.set(x, y, t < 0.2 ? BONE[4] : t < 0.75 ? BONE[3] : BONE[2]); P.set(x + 1, y, BONE[1]); }
    }
    // tail vertebrae trailing off, the pelvis
    for (let k = 0; k < 4; k++) P.set(34 + k, 11 + (k > 1 ? 1 : 0), BONE[k % 2 ? 2 : 3]);
    P.disc(32, 13, 2, 1.4, BONE[3]); P.set(32, 13, BONE[1]); P.set(31, 12, BONE[4]);
    // the long beast skull with a curling horn
    for (let y = -2; y <= 2; y++) for (let x = -3; x <= 3; x++) if ((x * x) / 10 + (y * y) / 5 <= 1) P.set(7 + x, 15 + y, x + y < -1 ? BONE[4] : x + y < 2 ? BONE[3] : BONE[2]);
    for (let k = 0; k < 6; k++) { P.set(4 - k * 0.7, 17 + k * 0.55, BONE[k < 3 ? 3 : 2]); P.set(5 - k * 0.7, 18 + k * 0.55, BONE[1]); }
    P.set(7, 14, '#1b1429'); P.set(8, 14, '#2a2033');
    for (let k = 0; k < 7; k++) { const a = -1.2 - k * 0.42, r = 3 + k * 0.5; P.set(9 + Math.cos(a) * r * 0.9 + 1, 13 + Math.sin(a) * r * 0.7, k < 4 ? BONE[3] : BONE[4]); }
    // grass and a mushroom growing through
    tuft(P, 16, 22, PAL.forest); tuft(P, 25, 21); tuft(P, 30, 22, PAL.forest); P.set(22, 19, PAL.magic[3]); P.set(22, 20, '#c8d4f0');
    P.outline(OUT);
    return finish({ ax, ay, foot: [2, 1], solid: true, flat: false, lights: [] }, P);
  }

  // ------------------------------------------------------------------ the abandoned campsite: tent, fire, bedroll, pack
  function makeTent() {
    const W = 58, H = 48, ax = 29, ay = 45, P = new Pix(W, H), seed = 1201, C = CANVAS;
    P.shadow(ax + 4, ay - 3, 27, 4.6);
    const A = [29, 13], B = [29, 4], FL = [7, 41], FR = [51, 41], BL = [9, 31], BR = [49, 31];
    // the back poles crossing above the ridge
    P.line(26, 1, 32, 7, PAL.wood[2]); P.line(32, 1, 26, 7, PAL.wood[1]);
    // slope coordinates: t = 0 at the ridge .. 1 at the hem, s = 0 front .. 1 back
    const slope = (x, y, left) => { const t = clamp(Math.abs(x - 29) / 22, 0, 1), s = clamp((13 + 28 * t - y) / 9, 0, 1); return [t, s]; };
    const panel = (left) => (x, y) => {
      const [t, s] = slope(x, y, left);
      let k = left ? 4 : 2;
      const fold = (s * 3.2 + noise(t * 3, 1, seed) * 0.6) % 1;
      if (fold < 0.16) k--;
      if (t < 0.07) k++;
      if (t > 0.86) k--;
      if (Math.abs(t - 0.5) < 0.18 && (left ? s > 0.2 : true)) k -= hash(x, y, seed) < 0.1 ? 1 : 0;
      if (t > 0.7 && noise(x / 3, y / 2, seed + 3) > 0.62) k--;
      P.set(x, y, C[clamp(k, 0, 5)]);
    };
    poly(P, [B, A, FL, BL], panel(true));
    poly(P, [B, BR, FR, A], panel(false));
    // patches on the slopes (stitched) and a tear
    const patch = (cx, cy, w, h, col, left) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const x = cx + i, y = cy + j + Math.round(i * (left ? -0.6 : 0.6)); if (!P.op(x, y)) continue; const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1; P.set(x, y, edge ? ((i + j) % 2 ? col[0] : '#cfc2aa') : (i + j) % 5 === 0 ? col[0] : col[1]); } };
    patch(14, 30, 6, 5, ['#4a2a46', '#6a3e62'], true); patch(40, 18, 5, 4, ['#2a4a3a', '#3e6450'], false);
    for (let k = 0; k < 7; k++) { const x = 41 + Math.round(k * 0.7), y = 27 + k; P.set(x, y, '#120c1c'); P.set(x + 1, y, k % 2 ? '#1b1429' : C[0]); if (k % 2) P.set(x - 1, y, C[4]); }
    // the front face with its door
    poly(P, [A, FR, FL], (x, y) => {
      const t = (y - 13) / 28, rel = (x - 29) / (22 * t + 0.01);
      let k = 3; if (Math.abs((rel * 3.5) % 1) < 0.13) k = 2; if (rel < -0.8) k = 4; if (rel > 0.85) k = 2; if (t > 0.9) k--;
      if (noise(x / 4, y / 3, seed + 5) > 0.68 && t > 0.6) k--;
      P.set(x, y, C[clamp(k, 0, 5)]);
    });
    poly(P, [[29, 18], [37, 41], [21, 41]], (x, y) => P.set(x, y, y < 24 ? '#120c1c' : (x + y) % 7 === 0 ? '#1b1429' : '#160f20'));
    // the right flap hangs torn across the doorway, the left is rolled and tied back
    poly(P, [[29, 18], [37, 41], [31, 41], [29, 30]], (x, y) => { const rag = y > 36 && hash(x, 3, seed) < 0.5; if (!rag) P.set(x, y, x === 29 || x === 30 ? C[2] : C[3]); });
    for (let y = 22; y <= 36; y++) { const x = Math.round(29 - ((y - 13) / 28) * 8) - 1; P.set(x, y, C[4]); P.set(x + 1, y, C[2]); P.set(x - 1, y, C[3]); }
    P.hline(19, 23, 29, '#9a8c78'); P.set(18, 30, '#9a8c78');
    patch(11, 34, 4, 4, ['#1e3a4e', '#2e5470'], false);
    // ridge highlight, front seams, the front poles crossing at the apex
    P.line(29, 4, 29, 13, C[5]); P.line(29, 13, 7, 41, C[1]); P.line(29, 13, 51, 41, C[1]);
    P.line(26, 9, 33, 16, PAL.wood[3]); P.line(32, 9, 25, 16, PAL.wood[2]);
    // grime along the hem, grass growing against it
    for (let x = 7; x <= 51; x++) if (P.op(x, 41) && noise(x / 3, 9, seed) > 0.45) P.tint(x, 41, '#2a2030', 0.45);
    for (const x of [9, 16, 24, 38, 46, 50]) tuft(P, x, 42 + (x % 2), x % 3 ? PAL.grass : PAL.forest);
    // guy ropes and stakes
    P.line(13, 28, 2, 37, '#9a8c78'); P.vline(2, 36, 39, PAL.wood[2]); P.set(2, 35, PAL.wood[4]);
    P.line(45, 28, 56, 37, '#8a7c68'); P.vline(56, 36, 39, PAL.wood[1]); P.set(56, 35, PAL.wood[3]);
    P.outline(OUT);
    return finish({ ax, ay, foot: [3, 2], solid: true, lights: [] }, P);
  }
  function makeCampfire(v) {
    const lit = v === 1, W = 24, H = 26, ax = 12, ay = 23, seed = 1301;
    const frames = [];
    for (let f = 0; f < (lit ? 4 : 1); f++) {
      const P = new Pix(W, H);
      P.shadow(ax + 1, ay - 2, 10, 3);
      const cx = 12, cy = 19, st = [];
      for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + 0.25; st.push([Math.round(cx + Math.cos(a) * 8.5) - 2, Math.round(cy + Math.sin(a) * 4.2) - 1, Math.sin(a)]); }
      const stone = ([x, y, s]) => { pebble(P, x, y, s > 0.3 ? 5 : 4, s > 0.3 ? 4 : 3, PAL.stone); if (lit && s < 0.2) { P.tint(x + 1, y, '#ff9a4a', 0.35); P.tint(x + 2, y, '#ff9a4a', 0.3); } };
      st.filter((s) => s[2] <= 0).forEach(stone);
      P.disc(cx, cy, 6.2, 2.8, lit ? '#2a1c1e' : '#38343f');
      for (let y = -2; y <= 2; y++) for (let x = -6; x <= 6; x++) if (P.op(cx + x, cy + y) && hash(x, y, seed) < 0.4) P.set(cx + x, cy + y, lit ? (hash(x, y, seed + f) < 0.3 ? '#c44a3a' : '#4a2a26') : ['#4e4a5a', '#625e70', '#7a768a'][Math.floor(hash(x, y, 5) * 3)]);
      // crossed logs, charred at the ends
      const log = (x0, y0, x1, y1) => { P.line(x0, y0, x1, y1, lit ? PAL.wood[3] : '#3a2e30'); P.line(x0, y0 + 1, x1, y1 + 1, lit ? PAL.wood[1] : '#221a1e'); P.set(x0, y0, '#1a1418'); P.set(x1, y1, lit ? '#e0602f' : '#5e5a6a'); };
      log(6, 20, 16, 17); log(7, 16, 17, 20);
      if (!lit) { P.set(10, 18, '#8a8698'); P.set(13, 19, '#77738a'); }
      st.filter((s) => s[2] > 0).forEach(stone);
      P.outline(OUT);
      if (lit) {
        fire(P, 12, 18, f, 1);
        const sp = [[10, 4], [14, 2], [12, 0], [9, 3]][f]; P.over(sp[0], sp[1], '#ffd27a', 0.85); P.over(sp[0] + 3, sp[1] + 3, '#f59b3c', 0.6);
      }
      frames.push(P);
    }
    if (!lit) return finish({ ax, ay, foot: [1, 1], solid: true, lights: [] }, frames[0]);
    return finish({ ax, ay, foot: [1, 1], solid: true, fps: 8, lights: [Lt(12, 12, 66, [255, 150, 70], 1, { flicker: 1 })] }, frames);
  }
  function makeBedroll() {
    const W = 36, H = 18, ax = 18, ay = 15, P = new Pix(W, H);
    P.shadow(ax + 1, ay - 2, 16, 2.6, 0.26);
    const Q = [['#3e2840', '#5a3a58', '#74506e'], ['#22384a', '#33526a', '#46708a'], ['#5a4428', '#7a5e38', '#9a7a4a'], ['#253f33', '#34573f', '#4a7356']];
    for (let y = 5; y <= 14; y++) for (let x = 9; x <= 32; x++) {
      if ((x === 32 && (y === 5 || y === 14))) continue;
      if (y >= 13) { P.set(x, y, y === 13 ? '#3a2434' : '#2a1a28'); continue; }
      const qi = (Math.floor((x - 9) / 6) + Math.floor((y - 5) / 4)) % 4, q = Q[qi];
      const lx = (x - 9) % 6, ly = (y - 5) % 4;
      let c = q[1]; if (lx === 0 || ly === 0) c = q[0]; else if (lx === 1 && ly === 1) c = q[2];
      if (noise(x / 4, y / 3, 7) > 0.7) c = mixc(c, '#120c1c', 0.25);
      P.set(x, y, c);
    }
    for (let y = 5; y <= 13; y++) { P.set(9, y, '#cdbfa4'); P.set(10, y, '#e2d6bc'); P.set(11, y, '#b0a288'); }
    // a rolled cloak for a pillow
    for (let y = 4; y <= 13; y++) for (let x = 2; x <= 8; x++) { const t = (y - 4) / 9; if ((x === 2 || x === 8) && (y === 4 || y === 13)) continue; P.set(x, y, t < 0.25 ? '#6a7090' : t < 0.6 ? '#4e5474' : '#363a56'); }
    for (let y = 5; y <= 12; y += 3) P.hline(3, 7, y, '#2a2c44');
    P.set(4, 5, '#8a90ac'); P.set(5, 5, '#8a90ac');
    P.outline(OUT);
    return finish({ ax, ay, foot: [2, 1], solid: false, flat: true, lights: [] }, P);
  }
  function makePack() {
    const W = 22, H = 24, ax = 11, ay = 21, P = new Pix(W, H), Lr = LEATHER;
    P.shadow(ax + 1, ay - 1, 9, 2.2);
    // the pack
    for (let y = 9; y <= 20; y++) for (let x = 2; x <= 12; x++) {
      if ((x === 2 || x === 12) && (y === 9 || y === 20)) continue;
      const t = (x - 2) / 10; let k = t < 0.25 ? 3 : t < 0.7 ? 2 : 1; if (y > 18) k--; if (hash(x, y, 4) < 0.06) k--;
      P.set(x, y, Lr[clamp(k, 0, 4)]);
    }
    for (let y = 9; y <= 14; y++) for (let x = 3; x <= 11; x++) P.set(x, y, y === 14 ? Lr[0] : x < 5 ? Lr[4] : Lr[3]);
    P.set(7, 13, GOLDS[3]); P.set(7, 14, GOLDS[1]); P.vline(7, 15, 18, Lr[1]);
    P.vline(4, 15, 19, Lr[0]); P.vline(10, 15, 19, Lr[0]);
    // the blanket roll on top, tied
    for (let y = 5; y <= 8; y++) for (let x = 1; x <= 13; x++) { if ((x === 1 || x === 13) && (y === 5 || y === 8)) continue; P.set(x, y, y === 5 ? '#8e6a8a' : y < 8 ? '#6a4a68' : '#4a3048'); }
    P.vline(4, 5, 8, '#c8b896'); P.vline(10, 5, 8, '#c8b896');
    P.set(1, 6, '#4a3048'); P.set(13, 7, '#3a2638');
    // a tin cup hanging from the side
    P.rect(0, 15, 2, 3, IRON[3]); P.set(0, 15, IRON[4]);
    // the lantern beside it
    lanternBox(P, 17, 9, ['#a85a24', '#ffbc62', '#ffd690', '#fff1c8'], true);
    P.set(17, 8, IRON[2]);
    P.outline(OUT);
    return finish({ ax, ay, foot: [1, 1], solid: true, lights: [Lt(17, 15, 34, [255, 190, 110], 0.7, { flicker: 1, night: true })] }, P);
  }

  // ------------------------------------------------------------------ eyes in the dark (0 red, 1 green)
  function makeEyes(v) {
    const W = 24, H = 20, ax = 12, ay = 17, seed = 1501 + v * 7;
    const base = new Pix(W, H);
    base.shadow(ax + 1, ay - 1, 9, 2.2, 0.4);
    canopy(base, [[12, 7, 6], [7, 10, 5.5], [17, 10, 5.5], [12, 11, 6.5], [4, 13, 4], [20, 13, 4]], ['#050c0b', '#081412', '#0c1d1a', '#112824', '#173530', '#1f4238'], seed, { bias: 0.25, rough: 0.5 });
    for (const [x, y, d] of [[3, 8, -1], [21, 8, 1], [8, 2, -1], [16, 2, 1], [1, 12, -1], [23, 12, 1]]) { base.set(x, y, '#0c1d1a'); base.set(x - d, y - 1, '#112824'); }
    base.outline(OUT);
    const E = v === 0 ? ['#5a0a14', '#b8262a', '#ff5446', '#ffd8c8'] : ['#0a3a18', '#25a046', '#78ff74', '#eaffd8'];
    const eye = (P, x, y, state, dir) => {
      if (state === 'closed') { P.set(x, y + 1, '#030706'); P.set(x + 1, y + 1, '#030706'); P.set(x + 2, y + 1, '#030706'); return; }
      if (state === 'half') { P.set(x, y + 1, E[1]); P.set(x + 1, y + 1, E[2]); P.set(x + 2, y + 1, E[1]); return; }
      P.set(x, y, dir < 0 ? E[0] : E[2]); P.set(x + 1, y, E[3]); P.set(x + 2, y, dir < 0 ? E[2] : E[0]);
      P.set(x, y + 1, E[1]); P.set(x + 1, y + 1, E[2]); P.set(x + 2, y + 1, E[1]);
      P.set(x + (dir < 0 ? 2 : 0), y - 1, E[0]);
    };
    const seq = ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'half', 'closed', 'half', 'open', 'open'];
    const frames = seq.map((s) => { const P = base.clone(); eye(P, 7, 9, s, -1); eye(P, 14, 9, s, 1); return P; });
    const col = v === 0 ? [255, 70, 60] : [110, 255, 110];
    return finish({ ax, ay, foot: [1, 1], solid: false, fps: 5, lights: [Lt(8, 10, 10, col, 0.5), Lt(15, 10, 10, col, 0.5)] }, frames);
  }

  // ------------------------------------------------------------------ a ward lantern on a crooked post (witch-green flame)
  function makeWardLantern() {
    const W = 22, H = 42, ax = 11, ay = 39, seed = 1601;
    const P = new Pix(W, H);
    P.shadow(ax + 2, ay - 1, 7, 2.2);
    const bf = barkFn(P, PAL.wood.concat(['#b8946e']), seed, { fx: 1.4, fy: 3, flat: 0.2 });
    tube(P, [[10, 38], [9, 27], [11, 15], [10, 8]], [1.8, 1.6, 1.4, 1.2], bf);
    // the iron crook and a little cap
    P.line(10, 7, 12, 5, IRON[3]); P.line(12, 5, 15, 5, IRON[3]); P.set(16, 6, IRON[2]); P.set(16, 7, IRON[2]); P.set(13, 4, IRON[4]);
    // charms: a violet ribbon and a carved rune token
    P.set(8, 22, PAL.magic[1]); P.set(9, 22, PAL.magic[2]); P.set(10, 22, PAL.magic[3]); P.set(11, 22, PAL.magic[1]); P.set(12, 23, PAL.magic[2]); P.set(12, 24, PAL.magic[1]); P.set(13, 25, PAL.magic[2]);
    P.set(7, 14, IRON[2]); P.rect(6, 15, 3, 3, PAL.wood[3]); P.set(6, 15, PAL.wood[4]); P.set(7, 16, '#3fd88a');
    // a cairn bracing the foot
    pebble(P, 6, 34, 5, 4); pebble(P, 11, 35, 5, 4); pebble(P, 8, 31, 4, 3); P.set(9, 31, MOSS[4]); P.set(12, 35, MOSS[3]);
    tuft(P, 4, 38); tuft(P, 17, 38, PAL.forest);
    mossify(P, (x, y) => y > 24 && y < 33, seed + 3, 0.6);
    lanternBox(P, 16, 8, ['#0f3a2a', '#1f6a4a', '#3fd88a', '#8affc0'], false);
    P.outline(OUT);
    const frames = [0, 1, 2, 3].map((f) => {
      const D = P.clone();
      const fl = [[[16, 14], [16, 13]], [[16, 14], [16, 12]], [[15, 14], [16, 13]], [[16, 14], [17, 13]]][f];
      D.set(fl[0][0], fl[0][1], '#e0ffe8'); D.set(fl[1][0], fl[1][1], f === 1 ? '#8affc0' : '#b4ffd9');
      D.set(16, 15, '#8affc0'); if (f % 2) { D.set(15, 13, '#3fd88a'); D.set(17, 15, '#5dffb0'); }
      return D;
    });
    return finish({ ax, ay, foot: [1, 1], solid: true, fps: 6, lights: [Lt(16, 14, 54, [93, 255, 160], 0.85, { flicker: 1 })] }, frames);
  }

  // ------------------------------------------------------------------ a crooked signpost with two arrows
  function makeSignpost() {
    const W = 30, H = 38, ax = 15, ay = 35, seed = 1701, Wd = PAL.wood;
    const P = new Pix(W, H);
    P.shadow(ax + 2, ay - 1, 6, 2);
    tube(P, [[15, 34], [14, 21], [15, 5]], [1.9, 1.7, 1.5], barkFn(P, Wd.concat(['#b8946e']), seed, { fx: 1.4, fy: 3, flat: 0.2 }));
    P.set(15, 4, Wd[3]); P.set(14, 4, Wd[4]);
    const board = (pts, seedB) => {
      poly(P, pts, (x, y) => { let k = 3; if (noise(x / 3, y / 1.2, seedB) > 0.66) k = 2; if (hash(x, y, seedB) < 0.06) k = 4; P.set(x, y, Wd[k]); });
      for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; P.line(p[0], p[1], q[0], q[1], q[1] < p[1] || (q[1] === p[1] && q[0] > p[0] && p[1] < 14) || k === 0 ? Wd[4] : Wd[1]); }
    };
    board([[3, 10], [7, 6], [23, 8], [23, 13], [7, 12]], seed + 1);
    board([[7, 16], [24, 15], [28, 18], [24, 22], [7, 21]], seed + 2);
    // a bite out of the lower board, scratched letters, nails, moss on the top edges
    P.clear(9, 21); P.clear(10, 21); P.set(10, 20, Wd[1]);
    for (const [x0, y0, n] of [[9, 9, 3], [14, 10, 2], [18, 10, 2], [11, 18, 2], [15, 18, 3], [20, 18, 1]]) for (let k = 0; k < n; k++) { P.set(x0 + k * 2 - (y0 < 12 ? 0 : 0), y0, Wd[1]); P.set(x0 + k * 2, y0 + 1, Wd[1]); P.set(x0 + k * 2 + 1, y0 + (k % 2), Wd[1]); }
    P.set(15, 10, IRON[4]); P.set(15, 18, IRON[4]);
    for (let x = 8; x <= 21; x++) if (noise(x / 3, 1, seed) > 0.55) P.set(x, 7 + Math.round(((x - 7) / 16) * 1.2), MOSS[3 + (x % 2)]);
    pebble(P, 11, 32, 4, 3); pebble(P, 16, 33, 5, 3); tuft(P, 9, 35); tuft(P, 21, 35, PAL.forest);
    P.outline(OUT);
    return finish({ ax, ay, foot: [1, 1], solid: true, lights: [] }, P);
  }

  // ------------------------------------------------------------------ a big hollow stump with mushrooms
  function makeHollowStump() {
    const W = 38, H = 32, ax = 19, ay = 28, seed = 1801, Bk = BARK_OLD;
    const P = new Pix(W, H);
    P.shadow(ax + 2, ay - 2, 17, 3.6);
    const rf = rootFn(P, Bk, seed, 0.8);
    tube(P, [[12, 23], [6, 26], [2, 27]], [4, 2.5, 1], rf); tube(P, [[26, 23], [32, 25], [36, 27]], [4, 2.5, 1], rf);
    // the barrel of the stump
    const bf = barkFn(P, Bk, seed, { fx: 0.8, fy: 5 });
    for (let y = 12; y <= 26; y++) for (let x = 7; x <= 31; x++) { const nx = (x - 19) / 12.5; if (Math.abs(nx) > 1) continue; if (y > 23 && Math.abs(nx) > 0.94) continue; bf(x, y, nx, 0, y, (x - 19), 0, Math.abs(nx)); }
    tube(P, [[15, 24], [13, 28]], [3.5, 1.5], rf); tube(P, [[23, 24], [25, 28]], [3.5, 1.5], rf);
    // broken rim with splinters, the cut top ring and the hollow
    const rimY = 12;
    for (let y = -6; y <= 5; y++) for (let x = -13; x <= 13; x++) {
      const e = (x * x) / 156 + (y * y) / 25;
      if (e > 1) continue;
      let c = e > 0.8 ? (x < 0 ? '#9c7a5e' : '#7a5a48') : e > 0.6 ? '#574039' : null;
      if (e <= 0.6) c = y < -1 ? '#1e1418' : e > 0.42 ? '#120c14' : '#08060c';
      P.set(19 + x, rimY + y, c);
    }
    for (const [x, h] of [[8, 4], [10, 6], [13, 3], [24, 5], [27, 7], [29, 4]]) for (let j = 1; j <= h; j++) { const w = j < h - 1 ? 1 : 0; P.set(x, rimY - 2 - j + (x > 19 ? 0 : 1), x < 19 ? Bk[4] : Bk[2]); if (w) P.set(x + 1, rimY - 2 - j + (x > 19 ? 0 : 1), '#9c7a5e'); }
    mossify(P, (x, y) => y < 16 || x < 14, seed + 5, 0.6);
    // fairycaps up the side, glowing toadstools at the foot
    for (const [x, y] of [[8, 18], [10, 15], [7, 21]]) { P.set(x - 1, y, PAL.magic[1]); P.set(x, y, PAL.magic[2]); P.set(x + 1, y, PAL.magic[1]); P.set(x, y - 1, PAL.magic[3]); P.set(x - 1, y - 1, PAL.magic[2]); P.set(x + 1, y - 1, PAL.magic[2]); P.set(x, y - 1, '#e4d2ff'); P.set(x, y + 1, '#c8d4f0'); }
    bracket(P, 31, 18, 3, 1);
    const lights = [];
    for (const [x, y] of glowCaps(P, [[27, 27, 1], [30, 26, 1], [24, 28, 1]])) lights.push(Lt(x, y, 12, [93, 255, 208], 0.45, { night: true }));
    P.outline(OUT);
    return finish({ ax, ay, foot: [2, 1], solid: true, lights }, P, P.night());
  }

  // ------------------------------------------------------------------ the living tunnel arch into Hushwillow Glade
  function makeTunnelArch() {
    const W = 56, H = 60, ax = 28, ay = 57, seed = 1901, R = rng(seed);
    const P = new Pix(W, H);
    P.shadow(ax + 2, ay - 1, 26, 3.4);
    // the tunnel's depths, glowing faintly green
    const oT = 18, inside = (x, y) => { if (y > ay || y < oT) return false; const yy = y - (oT + 10); if (yy < 0) return ((x - 27.5) * (x - 27.5)) / 64 + (yy * yy) / 100 <= 1; return Math.abs(x - 27.5) <= 8; };
    const TG = ['#06080a', '#0a1412', '#0f241e', '#17392d', '#225238', '#3b7a52', '#68aa76'];
    for (let y = oT; y <= ay; y++) for (let x = 18; x <= 37; x++) {
      if (!inside(x, y)) continue;
      const d = Math.hypot((x - 27.5) / 7.5, (y - (ay - 13)) / 13) + (bayer(x, y) - 0.5) * 0.16;
      P.set(x, y, TG[d > 1.05 ? 0 : d > 0.86 ? 1 : d > 0.68 ? 2 : d > 0.5 ? 3 : d > 0.34 ? 4 : d > 0.2 ? 5 : 6]);
    }
    // woven roots and branches: two pillars that lean together into an arch
    const bf = barkFn(P, BARK_OLD, seed, { fx: 0.9, fy: 4, flat: 0.8 }), rf = rootFn(P, BARK_OLD, seed, 0.9);
    tube(P, [[7, 57], [8, 42], [12, 27], [20, 15], [30, 11], [37, 12]], [5.5, 5, 4.4, 3.8, 3, 2.4], bf);
    tube(P, [[49, 57], [48, 42], [44, 27], [36, 15], [26, 11], [19, 13]], [5.5, 5, 4.4, 3.8, 3, 2.4], bf);
    tube(P, [[15, 57], [16, 44], [18, 31], [24, 21], [33, 18], [41, 22]], [3.4, 3, 2.6, 2.2, 1.8, 1.4], bf);
    tube(P, [[41, 57], [40, 45], [39, 33], [33, 22]], [3.4, 3, 2.6, 2], bf);
    tube(P, [[2, 57], [3, 50], [6, 43]], [3, 2.4, 1.6], rf); tube(P, [[54, 57], [53, 49], [50, 42]], [3, 2.4, 1.6], rf);
    tube(P, [[11, 57], [7, 55], [2, 57]], [2.2, 1.8, 1.2], rf); tube(P, [[45, 57], [50, 55], [55, 57]], [2.2, 1.8, 1.2], rf);
    mossify(P, (x, y) => !inside(x, y), seed + 3, 0.6, { bonus: (x, y) => (y < 30 ? 0.06 : 0) });
    // leaves along the crown of the arch and down the sides
    const clumps = [[14, 18, 7], [24, 9, 7.5], [34, 8, 7.5], [43, 17, 7], [8, 30, 5], [48, 30, 5], [29, 4, 5.5], [19, 6, 5], [39, 5, 5]].map(([x, y, r]) => [x + (R() - 0.5) * 2, y + (R() - 0.5) * 2, r]).sort((a, b) => a[1] - b[1]);
    canopy(P, clumps, PAL.leaf, seed, { bias: 0.42 });
    // tendrils hanging into the mouth, a few flowers
    for (const [x, y0, len] of [[21, 19, 7], [24, 17, 11], [30, 16, 6], [33, 18, 9], [36, 21, 5]]) for (let j = 0; j < len; j++) P.set(x + (j > len / 2 && x < 28 ? 1 : 0), y0 + j, j === len - 1 ? MOSS[4] : j % 3 ? MOSS[2] : HANGMOSS[3]);
    for (const [x, y, c] of [[12, 15, '#e8eeff'], [27, 4, '#b99aee'], [41, 13, '#e8eeff'], [19, 9, '#e89ab8'], [36, 3, '#e8eeff'], [9, 28, '#b99aee'], [47, 26, '#e8eeff']]) { P.set(x, y, c); P.set(x + 1, y + 1, '#fff1c8'); }
    tuft(P, 18, 57); tuft(P, 38, 57, PAL.forest);
    P.outline(OUT);
    return finish({ ax, ay, foot: [3, 1], solid: [1, 0, 1], lights: [Lt(28, ay - 12, 34, [120, 255, 170], 0.45), Lt(28, ay - 4, 18, [160, 255, 200], 0.3)] }, P);
  }

  // ================================================================== HUSHWILLOW GLADE
  function makeWillowBig() {
    const W = 72, H = 96, ax = 36, ay = 92, seed = 2001, R = rng(seed);
    const P = new Pix(W, H);
    P.shadow(ax + 4, ay - 3, 30, 6, 0.3);
    const bf = barkFn(P, BARK_WILLOW, seed, { fx: 0.7, fy: 5 });
    tube(P, [[ax - 1, ay - 6], [ax - 4, ay - 22], [ax + 1, ay - 38], [ax - 1, ay - 52]], [8, 6.5, 6, 5], bf, { capA: 0.45, rough: 0.1, seed });
    tube(P, [[ax - 3, ay - 46], [ax - 14, ay - 58], [ax - 22, ay - 62]], [4, 3, 2], bf);
    tube(P, [[ax + 1, ay - 47], [ax + 13, ay - 60], [ax + 22, ay - 64]], [4, 3, 2], bf);
    const rf = rootFn(P, BARK_WILLOW, seed, 0.7);
    tube(P, [[ax - 6, ay - 8], [ax - 13, ay - 3]], [4, 1.5], rf); tube(P, [[ax + 4, ay - 8], [ax + 12, ay - 2]], [4, 1.5], rf);
    // the crown
    const clumps = rows2clumps(ax, [[16, 3, 17, 12], [25, 5, 25, 12], [34, 5, 28, 10.5]], R);
    const cm = canopy(P, clumps, WILLOW.slice(0, 7), seed, { bias: 0.42, squash: 0.78 });
    // trailing fronds: long curtains at the sides, shorter in front of the trunk
    const bot = maskBottoms(cm.mask, W, H), glowPts = [];
    for (let x = 2; x < W - 2; x++) {
      if (bot[x] < 0) continue;
      const dc = Math.abs(x - ax) / 30;
      if (hash(x, 1, seed) < (dc < 0.3 ? 0.35 : 0.12)) continue;
      const len = Math.round((dc < 0.3 ? 16 : 30) + dc * 18 + noise(x / 3, 1, seed) * 14 - (hash(x, 2, seed) < 0.3 ? 8 : 0));
      const y0 = bot[x] - 2, ph = hash(x, 3, seed) * 6;
      for (let j = 0; j < len; j++) {
        const y = y0 + j; if (y > ay - 4) break;
        const xx = x + Math.round(Math.sin(j / 9 + ph) * 0.7 + (j / len) * (x < ax ? -1.2 : 1.2));
        const t = j / len;
        let k = t < 0.15 ? 2 : t < 0.5 ? 3 : t < 0.85 ? 4 : 5;
        if ((j + x) % 4 === 0) k--;
        if (hash(x, j, seed + 4) < 0.07) k = 6;
        P.set(xx, y, WILLOW[clamp(k, 1, 7)]);
        if (j % 3 === 1 && hash(x, j, seed + 5) < 0.6) P.set(xx + (x % 2 ? 1 : -1), y, WILLOW[clamp(k - 1, 1, 6)]);
        if (k >= 5 && hash(x, j, seed + 6) < 0.35) glowPts.push([xx, y]);
      }
    }
    P.outline(OUT);
    // after dark the frond tips and leaf highlights shimmer silver-green
    for (const [x, y] of glowPts) P.nite(x, y, hash(x, y, 9) < 0.4 ? '#e2fff0' : '#b4f0cc');
    for (const [x, y] of cm.pts) if (lum(P.get(x, y)) > 0.4 && hash(x, y, seed + 7) < 0.18) P.nite(x, y, '#b4f0cc');
    const lights = [Lt(14, 62, 30, [180, 255, 215], 0.35, { night: true }), Lt(58, 64, 30, [180, 255, 215], 0.35, { night: true }), Lt(ax, 34, 34, [190, 255, 220], 0.3, { night: true }), Lt(ax - 8, 78, 22, [180, 255, 215], 0.25, { night: true })];
    return finish({ ax, ay, foot: [2, 2], solid: true, fade: true, lights }, P, P.night());
  }
  function makeFlowers(v) {
    const W = 18, H = 16, ax = 9, ay = 14, seed = 2101 + v * 13, R = rng(seed);
    const P = new Pix(W, H);
    const F = [['#5a3a9a', '#8f6cd1', '#b99aee', '#f4e8ff'], ['#9aa4c8', '#dfe6fa', '#ffffff', '#f2c45a'], ['#b07a2a', '#e8b84a', '#ffe9a0', '#e8843c']][v];
    const leafs = [], heads = [];
    for (let k = 0; k < 7; k++) leafs.push([2 + Math.floor(R() * 14), 4 + Math.floor(R() * 10)]);
    for (const [x, y] of leafs) { P.set(x, y, PAL.leaf[2]); P.set(x - 1, y, PAL.leaf[3]); P.set(x + 1, y - 1, PAL.leaf[4]); P.set(x, y + 1, PAL.leaf[1]); }
    for (let k = 0; k < 8; k++) heads.push([2 + Math.floor(R() * 14), 2 + Math.floor(R() * 11), R() < 0.35]);
    heads.sort((a, b) => a[1] - b[1]);
    const lights = [];
    for (const [x, y, bell] of heads) {
      P.set(x, y + 2, PAL.leaf[3]); P.set(x, y + 3, PAL.leaf[2]);
      if (bell && v === 0) { P.set(x, y, F[2]); P.set(x, y + 1, F[1]); P.set(x - 1, y + 1, F[1]); P.set(x + 1, y + 1, F[0]); P.set(x - 1, y, F[3]); continue; }
      P.set(x - 1, y, F[2]); P.set(x + 1, y, F[1]); P.set(x, y - 1, F[2]); P.set(x, y + 1, F[1]); P.set(x, y, F[3]);
      if (v === 1) P.nite(x, y, '#fff6c8');
    }
    P.outline('#10302a');
    for (const [x, y] of heads) if (v === 1) { P.nite(x - 1, y, '#ffffff'); P.nite(x, y - 1, '#ffffff'); }
    if (v === 1) lights.push(Lt(9, 8, 14, [220, 230, 255], 0.3, { night: true }));
    return finish({ ax, ay, foot: [1, 1], solid: false, flat: true, lights }, P, v === 1 ? P.night() : null);
  }
  // the Bonding Stone: owl, fox and moth glyphs that pulse in turn
  const OWL = ['#.......#', '##.....##', '#.#####.#', '#.......#', '#.##.##.#', '#.##.##.#', '#...#...#', '.#.....#.', '..#####..'];
  const FOX = ['#.......#', '##.....##', '#.#...#.#', '#..###..#', '#.......#', '.#.#.#.#.', '..#...#..', '...#.#...', '....#....'];
  const MOTH = ['.#.....#.', '..#...#..', '##..#..##', '#.#.#.#.#', '#..#.#..#', '.#..#..#.', '.#.#.#.#.', '#..#.#..#', '.##...##.'];
  function makeBondingStone() {
    const W = 36, H = 50, ax = 18, ay = 47, seed = 2201, ST = MOONSTONE;
    const base = new Pix(W, H);
    base.shadow(ax + 2, ay - 2, 16, 3.6);
    // a soft mossy mound with tiny white flowers
    for (let y = -4; y <= 3; y++) for (let x = -16; x <= 16; x++) { const e = (x * x) / 256 + (y * y) / 16; if (e > 1) continue; const c = y < -2 ? MOSS[4] : y < 0 ? MOSS[3] : y < 2 ? MOSS[2] : MOSS[1]; base.set(ax + x, ay - 3 + y, hash(x, y, seed) < 0.12 ? MOSS[clamp((y < 0 ? 4 : 2) + 1, 0, 5)] : c); }
    // the stone: smooth, pale, egg-topped, softly dithered
    const sx0 = ax - 12, sx1 = ax + 12, sTop = 9, sBot = ay - 4;
    const insideS = (x, y) => { if (y > sBot || y < sTop) return false; const cy = sTop + 12; if (y < cy) return ((x - ax) * (x - ax)) / 144 + ((y - cy) * (y - cy)) / 144 <= 1; return x >= sx0 + (y > sBot - 2 ? 1 : 0) && x <= sx1 - (y > sBot - 2 ? 1 : 0); };
    for (let y = sTop; y <= sBot; y++) for (let x = sx0; x <= sx1; x++) {
      if (!insideS(x, y)) continue;
      const nx = (x - ax) / 12.5, ny = y < sTop + 12 ? (y - sTop - 12) / 12.5 : 0;
      let s = lam(nx, ny * 0.8) + (y > sBot - 6 ? -(y - sBot + 6) * 0.04 : 0);
      const t = clamp((s + 0.42) / 1.42, 0, 1) * (ST.length - 1), i = Math.floor(t);
      let k = Math.min(ST.length - 1, i + (bayer(x, y) < t - i ? 1 : 0));
      if (!insideS(x + 1, y)) k = Math.min(k, 2);
      base.set(x, y, ST[k]);
    }
    // an inset border carved around the face
    for (let y = sTop + 3; y <= sBot - 2; y++) for (let x = sx0 + 2; x <= sx1 - 2; x++) {
      const inner = insideS(x, y) && insideS(x - 3, y) && insideS(x + 3, y) && insideS(x, y - 3) && y < sBot - 2;
      const ring = inner && !(insideS(x - 4, y) && insideS(x + 4, y) && insideS(x, y - 4) && y < sBot - 3);
      if (ring) base.tint(x, y, '#3a2e58', 0.28);
    }
    for (let y = sBot - 3; y <= sBot; y++) for (let x = sx0; x <= sx1; x++) if (base.op(x, y) && noise(x / 2.5, y, seed) > 0.5) base.set(x, y, y === sBot - 3 ? MOSS[4] : MOSS[3]);
    for (const [x, y] of [[ax - 13, ay - 3], [ax - 9, ay - 1], [ax + 11, ay - 2], [ax + 14, ay - 4], [ax - 4, ay], [ax + 5, ay - 1]]) { base.set(x, y, '#ffffff'); base.set(x - 1, y, '#e8eeff'); base.set(x + 1, y, '#e8eeff'); base.set(x, y - 1, '#e8eeff'); base.set(x, y + 1, PAL.gold); }
    base.outline(OUT);
    // glyphs: carved, glowing violet-white; each pulses brighter in turn
    const glyphs = [[OWL, ax - 4, 14], [FOX, ax - 10, 29], [MOTH, ax + 2, 29]];
    const G0 = ['#7a5ac8', '#b99aee', '#e4d2ff', '#ffffff'];
    const frames = [0, 1, 2].map((f) => {
      const P = base.clone();
      glyphs.forEach(([bm, gx, gy], gi) => {
        const lvl = gi === f ? 2 : 1, pts = bitmap(bm);
        for (const [i, j] of pts) { const x = gx + i + 1, y = gy + j + 1; if (!pts.some((p) => p[0] === i + 1 && p[1] === j + 1) && P.op(x, y)) P.tint(x, y, '#2a1e48', 0.35); }
        for (const [i, j] of pts) P.set(gx + i, gy + j, (i + j) % 3 === 0 ? G0[lvl + 1] : G0[lvl]);
        if (lvl === 2) for (const [i, j] of pts) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!pts.some((p) => p[0] === i + ox && p[1] === j + oy)) P.tint(gx + i + ox, gy + j + oy, '#e4d2ff', 0.3);
      });
      // motes drifting round the stone
      for (const [mx, my] of [[[5, 18], [30, 12], [8, 34]], [[6, 15], [31, 20], [27, 36]], [[4, 24], [29, 15], [7, 40]]][f]) P.over(mx, my, '#e4d2ff', 0.8);
      return P;
    });
    return finish({ ax, ay, foot: [2, 1], solid: true, fps: 1.6, lights: [Lt(ax, 26, 48, [215, 195, 255], 0.6), Lt(ax, 18, 14, [235, 220, 255], 0.35), Lt(ax - 6, 33, 14, [235, 220, 255], 0.35), Lt(ax + 6, 33, 14, [235, 220, 255], 0.35)] }, frames);
  }
  function makeLilypads(v) {
    const W = 22, H = 16, ax = 11, ay = 14, seed = 2301 + v * 5;
    const P = new Pix(W, H);
    const pads = v === 0 ? [[7, 8, 5, 3.2, 0.6], [15, 6, 3.6, 2.4, 2.4], [14, 12, 3, 2, 4.2]] : [[6, 6, 4, 2.6, 5.5], [14, 9, 5, 3.2, 1.2], [5, 12, 3, 2, 3.4], [18, 4, 2.6, 1.8, 0.2]];
    // ripples first (translucent, on the water)
    for (const [cx, cy, rx, ry] of pads) for (let a = 0; a < 18; a++) { const t = (a / 18) * Math.PI * 2; if (Math.sin(t) < 0.2) continue; P.over(cx + Math.cos(t) * (rx + 1.6), cy + Math.sin(t) * (ry + 1.2), '#69a1db', 0.35); }
    for (const [cx, cy, rx, ry, notch] of pads) {
      for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
        const e = (x * x) / (rx * rx) + (y * y) / (ry * ry); if (e > 1) continue;
        const ang = Math.atan2(y / ry, x / rx); let da = Math.abs(ang - (notch - Math.PI)); if (da > Math.PI) da = Math.PI * 2 - da;
        if (da < 0.32 && e > 0.08) continue;
        let k = e > 0.72 ? 2 : (x + y) < -1 ? 4 : 3; if (k === 3 && hash(x, y, seed) < 0.12) k = 2; if (Math.abs(Math.sin(ang * 3)) < 0.12 && e > 0.2 && e < 0.8) k = 2;
        P.set(cx + x, cy + y, PAL.leaf[k]);
      }
      P.set(cx - Math.round(rx * 0.4), cy - Math.round(ry * 0.5), PAL.leaf[5]);
    }
    P.outline('#10302a');
    // the pale lily (and a bud)
    const lily = (x, y, cols) => { P.set(x, y - 1, cols[2]); P.set(x - 1, y, cols[1]); P.set(x + 1, y, cols[1]); P.set(x - 2, y + 1, cols[0]); P.set(x + 2, y + 1, cols[0]); P.set(x - 1, y + 1, cols[2]); P.set(x + 1, y + 1, cols[1]); P.set(x, y, PAL.gold); P.set(x, y + 1, cols[2]); for (const [ox, oy] of [[0, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, 1]]) P.nite(x + ox, y + oy, '#ffffff'); P.nite(x, y, '#fff1c8'); };
    if (v === 0) lily(8, 7, ['#b8c4e8', '#e8eeff', '#ffffff']);
    else { lily(14, 8, ['#d0a0bc', '#f4d4e4', '#fff4fa']); P.set(6, 5, '#f4d4e4'); P.set(6, 4, '#e89ab8'); P.set(5, 5, PAL.leaf[4]); }
    return finish({ ax, ay, foot: [1, 1], solid: false, flat: true, lights: [Lt(v === 0 ? 8 : 14, 8, 12, [210, 220, 255], 0.4, { night: true })] }, P, P.night());
  }

  // ================================================================== ENCOUNTERS
  // a little roadside shrine of chance: two-faced idol (one smiling, one frowning), coin slot, two candles
  const IDOL = ['..ggss..', '.gggsss.', 'ggggssss', 'gkgkskss', 'ggggssss', 'gkggsssk', 'ggkkksss', '.gggsss.', '..ggss..'];
  function makeShrineChance() {
    const W = 24, H = 38, ax = 12, ay = 35, seed = 2401, ST = PAL.stone;
    const base = new Pix(W, H);
    base.shadow(ax + 2, ay - 1, 10, 2.4);
    // the coin box
    for (let y = 24; y <= 34; y++) for (let x = 3; x <= 20; x++) { let k = y < 26 ? 4 : x < 5 ? 4 : x > 18 ? 2 : 3; if (y === 34) k = 1; if (y > 26 && noise(x / 2, y / 2, seed) > 0.72) k--; base.set(x, y, ST[k]); }
    base.hline(3, 20, 24, ST[5]); base.hline(9, 14, 25, '#120c1c'); base.set(12, 24, GOLDS[3]); base.set(11, 24, GOLDS[4]);
    for (const [x, y] of [[6, 29], [16, 29]]) { base.set(x, y, ST[1]); base.set(x + 1, y + 1, ST[1]); base.set(x - 1, y + 1, ST[1]); base.set(x, y + 2, ST[1]); }
    // the backing niche and its little shingled roof
    for (let y = 9; y <= 23; y++) for (let x = 6; x <= 17; x++) base.set(x, y, x < 8 ? ST[2] : x > 15 ? ST[0] : ST[1]);
    for (let y = 3; y <= 9; y++) { const half = 3 + (y - 3) * 1.6; for (let x = Math.round(ax - half); x <= Math.round(ax + half) - 1; x++) { const row = (y - 3) % 2; base.set(x, y, y === 9 ? '#2a1228' : (x + row) % 3 === 0 ? '#40203c' : x < ax ? '#73406a' : '#582e52'); } }
    base.set(ax - 1, 2, '#8e5a84'); base.set(ax, 2, '#73406a'); base.set(ax, 1, GOLDS[3]);
    for (let x = 2; x < 22; x++) if (noise(x / 2.5, 1, seed) > 0.55) base.set(x, 9 - (x % 2), MOSS[3]);
    // the idol: smiling gilded half, frowning silver half
    const map = { g: GOLDS[2], s: '#8a88a8', k: '#2a1a28' };
    for (const [i, j, ch] of bitmap(IDOL)) base.set(8 + i, 12 + j, ch === 'g' && i + j < 5 ? GOLDS[3] : ch === 's' && i > 5 ? '#6a6888' : map[ch]);
    base.rect(10, 21, 4, 3, ST[3]); base.hline(10, 13, 21, ST[4]);
    // candle stubs and two coins left as offerings
    for (const x of [4, 18]) { base.rect(x, 21, 2, 3, '#e8dcc8'); base.set(x + 1, 21, '#c8b8a0'); base.set(x + 1, 22, '#c8b8a0'); base.set(x, 20, '#2a1a28'); }
    base.set(7, 23, GOLDS[3]); base.set(16, 23, GOLDS[4]); base.set(15, 23, GOLDS[2]);
    tuft(P0(base), 2, 35); tuft(base, 21, 35, PAL.forest);
    base.outline(OUT);
    const frames = [0, 1, 2].map((f) => {
      const P = base.clone();
      for (const [x, ph] of [[4, 0], [18, 1]]) { const g = (f + ph) % 3; P.set(x, 19, '#fff3cf'); P.set(x + (g === 2 ? 1 : 0), 18, g === 1 ? '#ffffff' : '#ffd27a'); if (g !== 2) P.set(x, 17 - (g === 1 ? 1 : 0), '#f59b3c'); }
      return P;
    });
    return finish({ ax, ay, foot: [1, 1], solid: true, fps: 6, lights: [Lt(5, 18, 28, [255, 190, 110], 0.6, { flicker: 1 }), Lt(19, 18, 28, [255, 190, 110], 0.6, { flicker: 1 }), Lt(12, 16, 22, [230, 190, 255], 0.35)] }, frames);
  }
  function P0(p) { return p; }
  // the riddle stone: a mossy boulder with a sleeping face; frames 1-2 open glowing eyes
  function makeRiddleStone() {
    const W = 38, H = 32, ax = 19, ay = 29, seed = 2501, ST = STONE_OLD;
    const base = new Pix(W, H);
    base.shadow(ax + 2, ay - 1, 17, 3.4);
    boulder(base, 19, 17, 15, 12, ST.slice(1), seed, 10);
    // the face: brows, a long nose, a mouth (carved)
    const brow = []; for (let x = -7; x <= -2; x++) brow.push([19 + x, 12 - Math.round(Math.sin(((x + 7) / 5) * Math.PI) * 1.4)]); for (let x = 2; x <= 7; x++) brow.push([19 + x, 12 - Math.round(Math.sin(((x - 2) / 5) * Math.PI) * 1.4)]);
    carve(base, brow, null, { depth: 0.55 });
    for (let y = 14; y <= 20; y++) { base.tint(18, y, '#ffffff', 0.22); base.tint(20, y, OUT, 0.35); }
    base.tint(17, 21, OUT, 0.5); base.tint(21, 21, OUT, 0.5); base.tint(19, 21, OUT, 0.2);
    const mouth = []; for (let x = -5; x <= 5; x++) mouth.push([19 + x, 24 - (Math.abs(x) > 3 ? 1 : 0)]);
    carve(base, mouth, null, { depth: 0.5 });
    mossify(base, (x, y) => y < 11 || (y > 25 && Math.abs(x - 19) < 6), seed + 3, 0.5, { bonus: (x, y) => (y < 9 ? 0.2 : 0) + (y > 25 ? 0.05 : 0), t1: 0.16, t2: 0.25, t3: 0.36 });
    for (const x of [6, 9, 12, 26, 29, 32]) hangMoss(base, x, 9 + (x % 3), 2 + (x % 4), seed + x);
    for (const [x, y] of [[8, 18], [29, 14], [12, 22], [27, 22]]) { base.set(x, y, LICHEN[1]); base.set(x + 1, y, LICHEN[0]); base.set(x, y - 1, LICHEN[2]); }
    tuft(base, 4, 28); tuft(base, 33, 28, PAL.forest); tuft(base, 24, 29);
    base.outline(OUT);
    const E = ['#7a4a14', '#d9a23a', '#ffd27a', '#fff8e0'];
    const frames = [0, 1, 2].map((f) => {
      const P = base.clone();
      for (const ex of [12, 23]) {
        if (f === 0) { P.tint(ex, 15, OUT, 0.5); P.tint(ex + 1, 16, OUT, 0.5); P.tint(ex + 2, 16, OUT, 0.5); P.tint(ex + 3, 15, OUT, 0.5); }
        else if (f === 1) { P.set(ex, 15, E[0]); P.set(ex + 1, 15, E[2]); P.set(ex + 2, 15, E[2]); P.set(ex + 3, 15, E[0]); }
        else { P.set(ex, 15, E[1]); P.set(ex + 1, 14, E[2]); P.set(ex + 2, 14, E[2]); P.set(ex + 1, 15, E[3]); P.set(ex + 2, 15, E[3]); P.set(ex + 3, 15, E[1]); P.set(ex + 1, 16, E[1]); P.set(ex + 2, 16, E[1]); }
      }
      return P;
    });
    return finish({ ax, ay, foot: [2, 1], solid: true, fps: 1, lights: [Lt(19, 15, 26, [255, 214, 140], 0.5)] }, frames);
  }
  // an old mossy wishing well with a tiny roof, a bucket, coins glinting in the water
  function makeWishingWell() {
    const W = 40, H = 46, ax = 20, ay = 43, seed = 2601, ST = PAL.stone;
    const base = new Pix(W, H);
    base.shadow(ax + 2, ay - 2, 17, 3.6);
    const cx = 20, cy = 30, rx = 14, ry = 6;
    // back of the rim
    for (let y = -ry - 1; y <= 0; y++) for (let x = -rx; x <= rx; x++) { const e = (x * x) / (rx * rx) + (y * y) / (ry * ry), e2 = (x * x) / ((rx - 3) * (rx - 3)) + (y * y) / ((ry - 2) * (ry - 2)); if (e <= 1 && e2 > 1) base.set(cx + x, cy + y, (Math.floor((x + 20) / 3) % 2) ? ST[4] : ST[3]); }
    // posts, axle, rope and bucket
    for (const px of [5, 34]) { for (let y = 9; y <= 33; y++) { base.set(px, y, PAL.wood[px < 20 ? 3 : 2]); base.set(px + 1, y, PAL.wood[1]); } }
    for (let x = 6; x <= 33; x++) { base.set(x, 14, PAL.wood[3]); base.set(x, 15, PAL.wood[1]); }
    base.set(35, 13, IRON[3]); base.set(36, 13, IRON[3]); base.set(36, 14, IRON[2]); base.set(36, 15, IRON[3]);
    for (let y = 16; y <= 19; y++) base.set(20, y, '#9a8c78');
    // inside the shaft: dark to the water
    for (let y = -ry + 2; y <= ry - 2; y++) for (let x = -rx + 3; x <= rx - 3; x++) { const e2 = (x * x) / ((rx - 3) * (rx - 3)) + (y * y) / ((ry - 2) * (ry - 2)); if (e2 > 1) continue; base.set(cx + x, cy + y, y < -1 ? '#0a0a16' : e2 > 0.5 ? '#121838' : (hash(x, y, seed) < 0.2 ? '#2e4f9f' : '#213479')); }
    for (let y = 20; y <= 25; y++) for (let x = 17; x <= 23; x++) { if ((x === 17 || x === 23) && y === 25) continue; base.set(x, y, y === 20 ? PAL.wood[4] : x < 19 ? PAL.wood[3] : PAL.wood[2]); }
    base.hline(17, 23, 22, IRON[2]); base.hline(17, 23, 24, IRON[2]); base.set(18, 21, '#2a3a6a');
    // the front of the rim and the stone wall
    for (let y = 0; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const e = (x * x) / (rx * rx) + (y * y) / (ry * ry), e2 = (x * x) / ((rx - 3) * (rx - 3)) + (y * y) / ((ry - 2) * (ry - 2)); if (e <= 1 && e2 > 1) base.set(cx + x, cy + y, y < 2 ? ST[5] : ST[4]); }
    for (let x = -rx; x <= rx; x++) { const yy = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx)))); for (let k = 1; k <= 9; k++) { const y = cy + yy + k, course = Math.floor(k / 3), off = course % 2 ? 2 : 0; let c = k % 3 === 0 || (x + 20 + off) % 5 === 0 ? ST[1] : x < -8 ? ST[4] : x < 6 ? ST[3] : ST[2]; if (k === 9) c = ST[0]; base.set(cx + x, y, c); } }
    mossify(base, (x, y) => y > 24, seed + 3, 0.58, { bonus: (x, y) => (y > 38 ? 0.08 : 0) });
    for (let k = 0; k < 4; k++) { let x = 9 + k * 7; for (let y = 39; y > 31 + (k % 2) * 2; y--) { base.set(x, y, y % 2 ? PAL.leaf[3] : PAL.leaf[4]); if (y % 3 === 0) x += k % 2 ? 1 : -1; } }
    // the tiny shingled roof
    for (let y = 2; y <= 11; y++) { const half = 3 + (y - 2) * 1.75; for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) { const row = Math.floor((y - 2) / 2), k = (y - 2) % 2 === 1 ? 1 : (x + row * 2) % 4 === 0 ? 2 : x < cx ? 4 : 3; base.set(x, y, y === 11 ? '#231226' : ['#231226', '#341b38', '#47264c', '#5d3262', '#73406a'][k]); } }
    for (let x = 4; x < 37; x++) if (noise(x / 2.5, 2, seed) > 0.52) base.set(x, 9 + (x % 2), MOSS[3 + (x % 2)]);
    base.set(cx, 1, '#73406a'); base.set(cx, 0, PAL.wood[3]);
    tuft(base, 4, 42); tuft(base, 35, 41, PAL.forest);
    base.outline(OUT);
    const frames = [0, 1].map((f) => {
      const P = base.clone();
      const gl = f ? [[14, 31], [24, 30], [19, 33]] : [[16, 30], [22, 32], [27, 31]];
      for (const [x, y] of gl) { P.set(x, y, GOLDS[f ? 4 : 3]); P.set(x + 1, y, GOLDS[2]); }
      P.set(gl[0][0], gl[0][1] - 1, '#fff8e0');
      return P;
    });
    return finish({ ax, ay, foot: [2, 1], solid: true, fps: 2, lights: [Lt(20, 31, 26, [140, 200, 255], 0.35), Lt(20, 31, 10, [255, 220, 140], 0.3)] }, frames);
  }
  // a small scorched crater cradling a glowing chunk of fallen star
  function makeFallenStar() {
    const W = 26, H = 22, ax = 13, ay = 19, seed = 2701;
    const base = new Pix(W, H);
    // scorch marks streaking out over the grass (translucent), the rim of thrown-up earth, the charred bowl
    for (let a = 0; a < 14; a++) { const t = (a / 14) * Math.PI * 2 + 0.2, len = 3 + hash(a, 1, seed) * 4; for (let k = 0; k < len; k++) base.over(13 + Math.cos(t) * (10 + k), 15 + Math.sin(t) * (4.6 + k * 0.45), '#1a1218', 0.4 * (1 - k / len)); }
    for (let y = -6; y <= 5; y++) for (let x = -12; x <= 12; x++) {
      const e = (x * x) / 132 + (y * y) / 26; if (e > 1) continue;
      let c;
      if (e > 0.72) c = y < 0 ? (hash(x, y, seed) < 0.5 ? PAL.soil[3] : PAL.dirt[3]) : PAL.soil[2];
      else c = e > 0.45 ? '#2a2026' : e > 0.2 ? '#1e171c' : '#140e14';
      if (e > 0.72 && y < -2 && hash(x, y, seed + 1) < 0.25) c = PAL.grass[3];
      base.set(13 + x, 15 + y, c);
    }
    for (const [x0, y0, x1, y1] of [[6, 16, 10, 15], [16, 17, 20, 16], [12, 18, 14, 19], [8, 13, 11, 14]]) base.line(x0, y0, x1, y1, '#c44a3a');
    base.set(9, 15, '#ffbc62'); base.set(18, 16, '#ffbc62'); base.set(13, 19, '#e8843c');
    // the star chunk: a faceted glowing shard
    const SH = [[13, 6], [17, 9], [17, 13], [14, 16], [10, 14], [9, 10]];
    poly(base, SH, (x, y) => { const f = x - 13 + (y - 11) * 0.7; base.set(x, y, f < -2 ? GOLDS[4] : f < 1 ? GOLDS[5] : f < 3 ? GOLDS[3] : GOLDS[2]); });
    base.line(13, 6, 13, 15, GOLDS[4]); base.line(10, 11, 17, 11, GOLDS[4]);
    base.outline(OUT);
    const frames = [0, 1, 2].map((f) => {
      const P = base.clone();
      const core = [[13, 10], [12, 11], [13, 11], [14, 11], [13, 12]];
      for (const [x, y] of core) P.set(x, y, f === 0 ? GOLDS[5] : '#ffffff');
      const L = [1, 3, 5][f];
      for (let k = 1; k <= L; k++) { const a = 1 - k / (L + 1); P.over(13, 5 - k, '#fff8e0', a); P.over(13, 16 + k, '#fff8e0', a * 0.6); P.over(8 - k, 11, '#fff8e0', a * 0.8); P.over(18 + k, 11, '#fff8e0', a * 0.8); }
      if (f === 2) { P.over(9, 6, '#ffe7a0', 0.7); P.over(18, 15, '#ffe7a0', 0.5); }
      return P;
    });
    return finish({ ax, ay, foot: [1, 1], solid: true, fps: 4, lights: [Lt(13, 11, 64, [255, 236, 170], 1), Lt(13, 11, 20, [255, 250, 230], 0.6)] }, frames);
  }
  // a lost spirit: a translucent pale-teal child with a lantern, gently bobbing
  function makeSpirit() {
    const W = 20, H = 32, ax = 10, ay = 29;
    const frames = [0, 1, 2, 3].map((f) => {
      const bob = [0, -1, -2, -1][f], ph = (f * Math.PI) / 2;
      const P = new Pix(W, H);
      P.shadow(10, 29, 4.5 + bob * 0.4, 1.3, 0.2);
      const body = new Pix(W, H);
      // gown fading into a wisp
      for (let y = 13; y <= 28; y++) {
        const t = (y - 13) / 15, hw = y < 24 ? 2.6 + (y - 13) * 0.25 : 5.3 - (y - 23) * 1.0, mid = 10 + (y > 21 ? Math.sin(ph + (y - 21) * 0.7) * (y - 21) * 0.32 : 0);
        if (hw < 0.4) continue;
        for (let x = Math.round(mid - hw); x <= Math.round(mid + hw); x++) {
          const rel = (x - (mid - hw)) / (2 * hw + 0.01); let k = rel < 0.3 ? 3 : rel < 0.75 ? 2 : 1; if (y > 16 && (x - Math.round(mid)) % 3 === 0) k--;
          body.set(x, y + bob, GHOST[clamp(k, 0, 5)], (y < 24 ? 0.8 : 0.8 - (y - 23) * 0.13) * 255);
        }
      }
      // long hair and the head
      for (let y = 4; y <= 16; y++) for (let x = 5; x <= 15; x++) { const dx = x - 10, dy = y - 9; if (dx * dx / 22 + dy * dy / 26 > 1 || (y > 12 && Math.abs(dx) < 3)) continue; body.set(x, y + bob, dx < 0 ? GHOST[2] : GHOST[1], 215); }
      for (let y = 6; y <= 12; y++) for (let x = 7; x <= 13; x++) { const dx = x - 10, dy = y - 9; if (dx * dx / 10 + dy * dy / 11 > 1) continue; body.set(x, y + bob, dx + dy < -2 ? GHOST[5] : dx + dy < 2 ? GHOST[4] : GHOST[3], 225); }
      for (let x = 7; x <= 13; x++) body.set(x, 6 + bob, GHOST[2], 225); body.set(8, 7 + bob, GHOST[2], 225); body.set(12, 7 + bob, GHOST[2], 225);
      body.set(8, 10 + bob, '#1f4a52'); body.set(12, 10 + bob, '#1f4a52'); body.set(8, 9 + bob, GHOST[2]); body.set(12, 9 + bob, GHOST[2]); body.set(10, 12 + bob, GHOST[1]);
      // arms: one holding the lantern out, one hugging the gown
      body.set(7, 14 + bob, GHOST[3], 210); body.set(6, 15 + bob, GHOST[3], 210); body.set(5, 16 + bob, GHOST[4], 220);
      body.set(13, 15 + bob, GHOST[2], 210); body.set(12, 16 + bob, GHOST[2], 210);
      // translucent outline
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (body.alpha(x, y) > 0) continue;
        let m = 0; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m = Math.max(m, body.alpha(x + ox, y + oy));
        if (m > 90) P.over(x, y, '#0d2226', (m / 255) * 0.75);
      }
      for (let i = 0; i < body.d.length; i++) if (body.d[i]) { const x = i % W, y = (i / W) | 0, a = body.alpha(x, y) / 255; P.over(x, y, body.get(x, y), a); }
      // the lantern
      const lx = 4, ly = 17 + bob + (f % 2);
      P.set(lx, ly, IRON[3]); P.hline(lx - 1, lx + 1, ly + 1, IRON[2]); P.set(lx - 1, ly + 2, IRON[2]); P.set(lx + 1, ly + 2, IRON[1]); P.set(lx - 1, ly + 3, IRON[2]); P.set(lx + 1, ly + 3, IRON[1]);
      P.set(lx, ly + 2, '#f4fffc'); P.set(lx, ly + 3, '#9fe2d6'); P.hline(lx - 1, lx + 1, ly + 4, IRON[2]);
      return P;
    });
    return finish({ ax, ay, foot: [1, 1], solid: false, fps: 5, lights: [Lt(4, 19, 34, [160, 245, 235], 0.6), Lt(10, 12, 18, [190, 255, 245], 0.3)] }, frames);
  }
  // a wounded traveller resting against a mossy rock
  function makeTraveller() {
    const W = 32, H = 30, ax = 16, ay = 27, seed = 2801;
    const P = new Pix(W, H);
    P.shadow(ax + 3, ay - 1, 14, 2.8);
    boulder(P, 19, 15, 11, 9, PAL.rock, seed, 7);
    mossify(P, (x, y) => y < 12, seed + 1, 0.5, { bonus: (x, y) => (y < 9 ? 0.15 : 0) });
    // the staff leaning on the rock
    P.line(26, 25, 23, 4, PAL.wood[3]); P.line(27, 25, 24, 4, PAL.wood[1]); P.set(23, 3, PAL.magic[3]); P.set(24, 3, PAL.magic[2]);
    const CL = ['#241828', '#36263c', '#4c3a52', '#66526a', '#806c84'];
    // the cloak, seated
    for (let y = 11; y <= 25; y++) for (let x = 6; x <= 19; x++) {
      const cx = 12.5, hw = y < 14 ? 3 + (y - 11) * 1.2 : 6.2 - (y > 22 ? (y - 22) * 0.6 : 0);
      if (Math.abs(x - cx) > hw) continue;
      const rel = (x - (cx - hw)) / (2 * hw); let k = rel < 0.28 ? 3 : rel < 0.7 ? 2 : 1; if ((x + y) % 5 === 0 && y > 15) k--;
      P.set(x, y, CL[clamp(k, 0, 4)]);
    }
    // the hood and face in shadow
    for (let y = 5; y <= 13; y++) for (let x = 8; x <= 17; x++) { const dx = x - 12.5, dy = y - 9.5; if ((dx * dx) / 21 + (dy * dy) / 20 > 1) continue; P.set(x, y, dx + dy < -2 ? CL[4] : dx + dy < 2 ? CL[3] : CL[2]); }
    for (let y = 9; y <= 12; y++) for (let x = 10; x <= 14; x++) P.set(x, y, y === 9 ? '#2a1a26' : x < 12 ? SKIN[1] : SKIN[0]);
    P.hline(10, 11, 10, '#5a3a30'); P.hline(13, 14, 10, '#5a3a30'); P.set(12, 12, '#8a5a48');
    // legs: one drawn up, one stretched out with a bandaged shin; a hand resting on it
    for (let k = 0; k <= 8; k++) { const x = 15 + k, y = 22 + Math.round(k * 0.3); P.set(x, y, '#3a2e3a'); P.set(x, y + 1, '#2a2030'); }
    P.rect(19, 22, 3, 3, '#e8e2d6'); P.set(19, 22, '#f6f2ea'); P.set(21, 24, '#c8c0b2'); P.set(20, 23, '#d8b8bc');
    P.rect(24, 24, 2, 2, LEATHER[1]); P.set(25, 23, LEATHER[2]);
    for (const [x, y] of [[9, 20], [10, 21], [8, 22]]) P.set(x, y, '#3a2e3a');
    P.rect(7, 23, 3, 2, LEATHER[1]);
    P.set(17, 21, SKIN[1]); P.set(18, 21, SKIN[2]); P.set(18, 22, SKIN[1]);
    // a small pack and a candle-lantern on the ground
    for (let y = 19; y <= 25; y++) for (let x = 1; x <= 6; x++) { if ((x === 1 || x === 6) && (y === 19 || y === 25)) continue; P.set(x, y, y < 21 ? LEATHER[4] : x < 3 ? LEATHER[3] : LEATHER[2]); }
    P.hline(1, 6, 21, LEATHER[1]); P.set(3, 22, GOLDS[3]); P.hline(0, 7, 18, '#6a4a68'); P.hline(0, 7, 17, '#8e6a8a');
    P.rect(28, 21, 3, 4, IRON[2]); P.set(29, 22, PAL.amber); P.set(29, 23, PAL.candle); P.set(29, 20, IRON[3]);
    tuft(P, 9, 27); tuft(P, 30, 27, PAL.forest);
    P.outline(OUT);
    return finish({ ax, ay, foot: [1, 1], solid: true, lights: [Lt(29, 22, 26, [255, 190, 110], 0.55, { flicker: 1, night: true }), Lt(16, 16, 22, [255, 220, 170], 0.18)] }, P);
  }
  // Fennick's hand cart: striped teal-and-gold canopy, heaped bundles, dangling trinkets, two lanterns
  function makeMerchantCart() {
    const W = 56, H = 50, ax = 28, ay = 47, seed = 2901, Wd = PAL.wood;
    const P = new Pix(W, H);
    P.shadow(ax + 2, ay - 3, 25, 4);
    // back poles
    for (const x of [9, 46]) for (let y = 12; y <= 30; y++) P.set(x, y, Wd[1]);
    // goods heaped on the bed
    const sack = (cx, cy, rx, ry, cols) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { if ((x * x) / (rx * rx) + (y * y) / (ry * ry) > 1) continue; P.set(cx + x, cy + y, cols[x + y < -1 ? 3 : x + y < 2 ? 2 : 1]); } P.set(cx, cy - ry, cols[0]); P.set(cx, cy - ry - 1, cols[2]); };
    sack(15, 23, 6, 5, ['#4e4232', '#6e5e4a', '#8e7c62', '#b09c7e']); sack(40, 24, 5, 4, ['#4e4232', '#6e5e4a', '#8e7c62', '#b09c7e']);
    for (let y = 18; y <= 27; y++) for (let x = 22; x <= 32; x++) P.set(x, y, y === 18 ? Wd[4] : x === 22 ? Wd[3] : (x - 22) % 4 === 0 ? Wd[1] : Wd[2]);
    for (let x = 22; x <= 32; x++) P.set(x, 22, Wd[1]);
    // a rolled rug, a stack of books, bottles, a crystal ball
    for (let y = 16; y <= 19; y++) for (let x = 25; x <= 44; x++) P.set(x, y, y === 16 ? '#b0505a' : (x % 5 === 0 ? GOLDS[3] : y < 19 ? '#8a3a44' : '#5e2630'));
    P.set(44, 17, '#5e2630'); P.set(45, 17, '#3e1a22');
    for (const [k, c] of [[0, '#36586f'], [1, '#73406a'], [2, '#3b6a4e']]) P.rect(34, 21 - k * 2, 7, 2, c), P.hline(34, 40, 21 - k * 2, mixc(c, '#ffffff', 0.25));
    for (const [x, c] of [[10, '#8f6cd1'], [12, '#3fd88a'], [43, '#c44a3a']]) { P.rect(x, 17, 2, 3, c); P.set(x, 16, '#c8d4f0'); P.set(x, 17, '#ffffff'); }
    P.disc(20, 13, 2.2, 2.2, PAL.magic[2]); P.set(19, 12, '#e4d2ff'); P.set(20, 12, PAL.magic[3]); P.set(21, 14, PAL.magic[1]); P.hline(18, 22, 16, GOLDS[2]);
    // the cart bed
    for (let y = 28; y <= 37; y++) for (let x = 5; x <= 50; x++) { let c = y === 28 ? Wd[4] : (y - 28) % 3 === 0 ? Wd[1] : x < 9 ? Wd[3] : Wd[2]; if (x === 5 || x === 50) c = Wd[0]; P.set(x, y, c); }
    for (const x of [6, 49]) for (const y of [29, 36]) P.set(x, y, IRON[3]);
    // the big wheel, the handles and the prop leg
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) { const d = Math.hypot(x, y); if (d > 9.2) continue; if (d > 7.6) P.set(26 + x, 39 + y, d > 8.5 ? Wd[1] : Wd[3]); else if (d < 1.6) P.set(26 + x, 39 + y, IRON[3]); else { const a = Math.atan2(y, x); if (Math.abs(Math.sin(a * 3)) < 0.18) P.set(26 + x, 39 + y, Wd[2]); } }
    P.line(50, 33, 55, 44, Wd[3]); P.line(50, 34, 55, 45, Wd[1]); P.line(8, 37, 7, 45, Wd[2]); P.set(8, 45, Wd[1]);
    // canopy poles at the front
    for (const x of [4, 51]) for (let y = 12; y <= 37; y++) { P.set(x, y, Wd[x < 20 ? 3 : 2]); P.set(x + 1, y, Wd[1]); }
    // the striped canopy, gently domed, with a scalloped valance
    for (let y = 3; y <= 13; y++) for (let x = 2; x <= 53; x++) {
      const dome = Math.round(Math.pow(Math.abs(x - 27.5) / 25.5, 2) * 3); if (y < 3 + dome) continue;
      const stripe = Math.floor((x - 2) / 5) % 2, tone = y < 6 + dome ? 1 : y > 11 ? -1 : 0;
      const cols = stripe ? ['#1e4e56', '#2a6a72', '#3e8a90', '#5aa8a8'] : ['#9a6a1e', '#c8962a', '#f2c45a', '#ffe08a'];
      P.set(x, y, cols[clamp(1 + tone + (x < 20 ? 1 : 0), 0, 3)]);
    }
    for (let x = 2; x <= 53; x++) { const s = (x - 2) % 6, stripe = Math.floor((x - 2) / 6) % 2; const d = s === 0 || s === 5 ? 0 : s === 1 || s === 4 ? 1 : 2; for (let k = 0; k <= d; k++) P.set(x, 14 + k, stripe ? (k === d ? '#1e4e56' : '#2a6a72') : (k === d ? '#9a6a1e' : '#c8962a')); }
    // trinkets on strings
    const tr = [[11, 4, 'moon'], [17, 6, 'bell'], [24, 3, 'star'], [31, 5, 'feather'], [37, 4, 'key'], [43, 6, 'bell']];
    for (const [x, len, kind] of tr) {
      P.vline(x, 16, 15 + len, '#9a8c78');
      const y = 16 + len;
      if (kind === 'moon') { P.set(x, y, '#e8eeff'); P.set(x - 1, y + 1, '#c8d4f0'); P.set(x, y + 2, '#e8eeff'); }
      else if (kind === 'bell') { P.set(x, y, GOLDS[4]); P.hline(x - 1, x + 1, y + 1, GOLDS[3]); P.set(x, y + 2, GOLDS[1]); }
      else if (kind === 'star') { P.set(x, y, GOLDS[4]); P.set(x - 1, y + 1, GOLDS[3]); P.set(x + 1, y + 1, GOLDS[3]); P.set(x, y + 1, '#ffffff'); P.set(x, y + 2, GOLDS[2]); }
      else if (kind === 'feather') { P.set(x, y, '#e8eeff'); P.set(x, y + 1, '#5aa8a8'); P.set(x + 1, y + 2, '#3e8a90'); }
      else { P.set(x, y, IRON[4]); P.set(x, y + 1, IRON[3]); P.set(x, y + 2, IRON[3]); P.set(x + 1, y + 2, IRON[3]); }
    }
    // two lanterns hanging at the front corners
    lanternBox(P, 4, 15, ['#a85a24', '#ffbc62', '#ffd690', '#fff1c8'], true); lanternBox(P, 51, 15, ['#a85a24', '#ffbc62', '#ffd690', '#fff1c8'], true);
    tuft(P, 14, 47); tuft(P, 40, 47, PAL.forest);
    P.outline(OUT);
    return finish({ ax, ay, foot: [3, 1], solid: true, lights: [Lt(4, 21, 42, [255, 188, 98], 0.85, { flicker: 1, night: true }), Lt(51, 21, 42, [255, 188, 98], 0.85, { flicker: 1, night: true }), Lt(20, 13, 16, [190, 150, 255], 0.35), Lt(28, 24, 30, [255, 220, 170], 0.18)] }, P);
  }

  // ================================================================== THE NIGHT MARKET
  const NM_BOTTLES = [['#4a2f7a', '#b99aee', '#e4d2ff'], ['#1f6a5a', '#5dffd0', '#c4fff0'], ['#7a3a1a', '#ffbc62', '#fff1c8'], ['#6a2040', '#e89ab8', '#ffe0ee'], ['#1f5a2a', '#7dff7a', '#e0ffe0']];
  const NM_WARM = ['#a85a24', '#ffbc62', '#ffd690', '#fff1c8'], NM_VIOLET = ['#3a2466', '#8f6cd1', '#b99aee', '#e4d2ff'];
  // a glass bottle standing on y = base: 'tall' (2 wide) or 'flask' (3 wide, round); b = [dark, lit, core]
  function nmBottle(P, x, base, kind, b, night) {
    const g = (xx, yy, c, n) => (night ? P.glow(xx, yy, c, n) : P.set(xx, yy, c));
    if (kind === 'tall') {
      for (let j = 0; j < 4; j++) { g(x, base - j, b[1], b[2]); g(x + 1, base - j, b[0], b[1]); }
      P.set(x, base - 4, '#c8d4f0'); P.set(x, base - 5, PAL.wood[3]); P.set(x, base - 2, '#ffffff');
    } else {
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) g(x + i, base - j, i === 0 || j === 2 ? b[1] : b[0], i === 0 ? b[2] : b[1]);
      P.set(x + 1, base - 3, '#c8d4f0'); P.set(x + 1, base - 4, PAL.wood[3]); P.set(x, base - 2, '#ffffff');
    }
  }
  // a little hanging iron lantern whose glass brightens after dark (top ring at x, y)
  function nmLantern(P, x, y, g) {
    lanternBox(P, x, y, g, true);
    for (let j = 3; j <= 8; j++) for (let i = -1; i <= 1; i++) if (i !== 0) P.nite(x + i, y + j, j < 6 ? g[3] : g[2]);
    P.nite(x - 1, y + 5, '#ffffff'); P.nite(x + 1, y + 5, g[3]);
  }
  function nmCandle(P, x, y) { P.rect(x, y, 2, 4, '#e8dcc8'); P.vline(x + 1, y, y + 3, '#c8b8a0'); P.set(x, y, '#f6efe0'); P.set(x, y - 1, '#2a1a28'); } // wax stub, top at (x, y)
  function nmFlame(P, x, y, f) { // the flame over a stub whose top is at (x, y); drawn after the outline
    const g = f % 3; P.set(x, y - 2, '#fff3cf'); P.set(x + (g === 2 ? 1 : 0), y - 3, g === 1 ? '#ffffff' : '#ffd27a'); if (g !== 2) P.set(x, y - 4 - (g === 1 ? 1 : 0), '#f59b3c');
  }
  // the Night Merchant's travelling carriage: dark wood on spoked wheels, a bow-top violet roof painted with silver
  // stars and a crescent, a side panel let down into a velvet-draped counter, curtains, warm and violet lanterns
  function makeNightCarriage() {
    const W = 76, H = 60, ax = 38, ay = 57, seed = 3101, R = rng(seed);
    const DW = ['#130d14', '#1e151e', '#2b1f29', '#3a2a35', '#4c3844', '#624a54'];
    const RV = ['#1a0f2e', '#24163c', '#30204f', '#3f2b65', '#52397e', '#694c98', '#8566b4'];
    const VEL = ['#2a0c1e', '#46122e', '#661c3e', '#8a2c50', '#ac4466'];
    const CUR = ['#0c2228', '#133640', '#1d4c56', '#2a666c', '#3e8486'];
    const base = new Pix(W, H);
    base.shadow(ax + 3, ay - 2, 36, 5, 0.34);
    // shafts resting on the ground at the front
    base.line(13, 44, 1, 54, DW[1]); base.line(13, 45, 1, 55, DW[0]);
    base.line(15, 46, 3, 56, DW[3]); base.line(15, 47, 3, 57, DW[1]);
    // the undercarriage beam
    for (let x = 12; x <= 64; x++) { base.set(x, 45, DW[2]); base.set(x, 46, DW[1]); base.set(x, 47, DW[0]); }
    // the body: dark planks, corner posts, a carved gold rail along the foot
    const bx0 = 11, bx1 = 65, by0 = 22, by1 = 44;
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const ly = y - by0, plank = Math.floor(ly / 3);
      let k = ly % 3 === 2 ? 1 : hash(plank, Math.floor((x + plank * 5) / 11), seed) < 0.35 ? 2 : 3;
      if (x <= bx0 + 1) k = x === bx0 ? 3 : 4; else if (x >= bx1 - 1) k = x === bx1 ? 0 : 1;
      if (y <= by0 + 2) k = Math.min(k, 1);
      if (y >= by1 - 1) k = Math.min(k, 2);
      if (hash(x, y, seed + 1) < 0.04) k = Math.max(0, k - 1);
      base.set(x, y, DW[k]);
    }
    for (let x = bx0 + 3; x <= bx1 - 3; x++) { if (x % 4 === 0) base.set(x, 42, GOLDS[2]); else if (x % 4 === 2) base.set(x, 42, GOLDS[1]); }
    // round brass-rimmed windows, warm-lit at night
    const port = (cx, cy) => {
      for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
        const d = Math.hypot(x, y); if (d > 4.2) continue;
        if (d > 3) base.set(cx + x, cy + y, x + y < 0 ? GOLDS[2] : GOLDS[0]);
        else { const k = x + y < -2 ? 3 : x + y < 1 ? 2 : 1; base.glow(cx + x, cy + y, ['#141a36', '#1f2a54', '#34477e', '#6a84c0'][k], ['#5a2a1c', '#8a4a24', '#c8782e', '#ffc670'][k]); }
      }
      for (let y = -2; y <= 2; y++) base.glow(cx - 2, cy + y, CUR[2], '#5a2c22');
    };
    port(18, 32); port(58, 32);
    // the counter window: a warm dim interior with shelves of little bottles
    const ox0 = 25, ox1 = 51, oy0 = 26, oy1 = 36;
    for (let y = oy0; y <= oy1; y++) for (let x = ox0; x <= ox1; x++) base.glow(x, y, y < oy0 + 3 ? '#0c0710' : '#150b17', y < oy0 + 3 ? '#2e1820' : '#4a2628');
    for (const sy of [30, 34]) { base.hline(ox0 + 4, ox1 - 4, sy, DW[3]); base.hline(ox0 + 4, ox1 - 4, sy + 1, DW[1]); }
    for (let k = 0; k < 6; k++) { const x = ox0 + 6 + k * 3, b = NM_BOTTLES[(k * 3 + 1) % 5]; base.set(x, 28, b[0]); base.glow(x, 29, b[0], b[1]); }
    for (let k = 0; k < 5; k++) { const x = ox0 + 7 + k * 3, b = NM_BOTTLES[(k * 2) % 5]; base.set(x, 32, b[0]); base.glow(x, 33, b[0], b[2]); }
    // curtains tied back with gold cord, a scalloped valance, bunches of drying herbs
    const curtain = (x0, dir) => {
      for (let y = oy0; y <= oy1; y++) {
        const w = y < 31 ? 4 : y <= 32 ? 2 : 3;
        for (let i = 0; i < w; i++) base.set(x0 + i * dir, y, i === w - 1 ? CUR[1] : CUR[(i + (y > 32 ? 1 : 0)) % 2 ? 2 : (dir > 0 ? 4 : 3)]);
      }
      base.set(x0, 31, GOLDS[3]); base.set(x0 + dir, 32, GOLDS[2]);
    };
    curtain(ox0, 1); curtain(ox1, -1);
    for (let x = ox0; x <= ox1; x++) { base.set(x, oy0, CUR[3]); base.set(x, oy0 + 1, (x - ox0) % 4 === 0 ? CUR[1] : CUR[2]); if ((x - ox0) % 4 === 2) { base.set(x, oy0 + 2, CUR[1]); base.set(x, oy0 + 3, GOLDS[2]); } }
    for (const hx of [31, 45]) { base.set(hx, oy0 + 2, '#5a4a30'); base.set(hx - 1, oy0 + 3, '#4a6a3a'); base.set(hx, oy0 + 3, '#6a8a4a'); base.set(hx + 1, oy0 + 3, '#4a6a3a'); base.set(hx, oy0 + 4, '#3a5a30'); }
    // the side panel let down into a counter, draped in velvet with a gold fringe; chains hold it level
    for (let x = ox0 - 2; x <= ox1 + 2; x++) { base.set(x, 37, VEL[4]); base.set(x, 38, VEL[3]); }
    for (let y = 39; y <= 44; y++) for (let x = ox0 - 2; x <= ox1 + 2; x++) {
      const fold = (x - ox0 + 2) % 6; if (y > 44 - (fold === 3 ? 1 : 0)) continue;
      let k = fold === 0 ? 1 : fold === 1 ? 3 : fold === 2 ? 4 : 2; if (y === 39) k = Math.max(k, 3); if (x === ox1 + 2) k = 1;
      base.set(x, y, VEL[k]);
    }
    for (let x = ox0 - 2; x <= ox1 + 2; x++) { const fold = (x - ox0 + 2) % 6, hy = 45 - (fold === 3 ? 1 : 0); base.set(x, hy, x % 2 ? GOLDS[3] : GOLDS[1]); if (fold === 0) base.set(x, hy + 1, GOLDS[2]); }
    base.line(ox0 - 1, oy0 + 1, ox0 - 2, 36, IRON[3]); base.line(ox1 + 1, oy0 + 1, ox1 + 2, 36, IRON[2]);
    // wares on the counter: bottles, a crystal ball on a gold stand, a few coins
    nmBottle(base, 28, 36, 'tall', NM_BOTTLES[0], true); nmBottle(base, 31, 36, 'flask', NM_BOTTLES[1], true);
    nmBottle(base, 44, 36, 'tall', NM_BOTTLES[3], true); nmBottle(base, 47, 36, 'flask', NM_BOTTLES[4], true);
    base.disc(38, 32, 2.2, 2.2, '#6a47a8'); base.glow(37, 31, '#e4d2ff', '#ffffff'); base.glow(38, 32, '#b99aee', '#f4e8ff'); base.set(39, 33, '#4a2f7a'); base.set(36, 32, '#8f6cd1');
    base.hline(37, 39, 35, GOLDS[3]); base.hline(36, 40, 36, GOLDS[2]);
    base.set(41, 36, GOLDS[3]); base.set(42, 36, GOLDS[4]); base.set(41, 35, GOLDS[3]);
    // the bow-top roof: violet canvas over hoops, painted with silver stars and a crescent, tasselled hem
    const rx0 = 8, rx1 = 68, ry0 = 5, ry1 = 23, cr = 12;
    const roofTop = (x) => { const dx = x < rx0 + cr ? rx0 + cr - x : x > rx1 - cr ? x - (rx1 - cr) : 0; return ry0 + cr - Math.sqrt(Math.max(0, 1 - (dx * dx) / (cr * cr))) * cr; };
    for (let x = rx0; x <= rx1; x++) {
      const t0 = roofTop(x);
      for (let y = Math.ceil(t0); y <= ry1; y++) {
        const v = (y - t0) / Math.max(1, ry1 - t0);
        let s = 0.97 - v * 0.95 + (x < rx0 + 14 ? 0.1 : x > rx1 - 14 ? -0.12 : 0) + (noise(x / 3, y / 2, seed) - 0.5) * 0.16;
        if ((x - rx0) % 10 === 5) s -= 0.17;
        if (y >= ry1 - 1) s = y === ry1 ? 0.02 : 0.16;
        base.set(x, y, RV[Math.floor(clamp(s, 0, 0.999) * RV.length)]);
      }
    }
    const stars = [];
    for (let k = 0; k < 40 && stars.length < 17; k++) {
      const x = rx0 + 4 + Math.floor(R() * (rx1 - rx0 - 8)), top = Math.ceil(roofTop(x)) + 2, y = top + Math.floor(R() * Math.max(1, ry1 - 4 - top));
      if (y > ry1 - 4 || Math.hypot(x - 29, y - 12) < 7 || stars.some((s) => Math.abs(s[0] - x) + Math.abs(s[1] - y) < 5)) continue;
      stars.push([x, y, R() < 0.3 ? 1 : 0]);
    }
    for (const [x, y, big] of stars) { base.glow(x, y, '#c8d4f0', '#ffffff'); if (big) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) base.glow(x + ox, y + oy, '#7e80aa', '#c8c4f0'); }
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const o = x * x + y * y <= 20, i = (x - 2) * (x - 2) + (y + 1) * (y + 1) <= 15; if (o && !i) base.glow(29 + x, 12 + y, x + y < -2 ? '#e8eeff' : '#b8c0e0', '#ffffff'); }
    for (let x = rx0 + 2; x <= rx1 - 2; x += 5) { base.set(x, ry1 + 1, GOLDS[3]); base.set(x, ry1 + 2, GOLDS[1]); }
    // the big spoked wheels
    const wheel = (cx, cy, r) => {
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
        const d = Math.hypot(x, y); if (d > r + 0.3) continue;
        if (d > r - 0.9) base.set(cx + x, cy + y, IRON[x + y < 0 ? 3 : 1]);
        else if (d > r - 2.6) base.set(cx + x, cy + y, DW[x + y < -2 ? 5 : x + y < 3 ? 4 : 2]);
        else if (d < 1.8) base.set(cx + x, cy + y, d < 0.9 ? GOLDS[3] : IRON[2]);
        else { const a = Math.atan2(y, x); if (Math.abs(Math.sin(a * 4)) < 0.22) base.set(cx + x, cy + y, DW[a < 0 ? 4 : 3]); }
      }
    };
    wheel(20, 47, 8.5); wheel(57, 47, 8.5);
    // a little wooden step down from the back door
    base.line(65, 45, 71, 56, DW[1]); base.line(66, 45, 72, 56, DW[2]);
    for (let x = 66; x <= 70; x++) { base.set(x, 47, DW[5]); base.set(x, 48, DW[2]); }
    for (let x = 68; x <= 73; x++) { base.set(x, 52, DW[5]); base.set(x, 53, DW[2]); }
    tuft(base, 10, 57); tuft(base, 40, 57, PAL.forest); tuft(base, 64, 57);
    // lanterns sway a little under the eaves, warm at the front and violet at the back; the painted stars twinkle
    const frames = [], nframes = [];
    for (let f = 0; f < 3; f++) {
      const P = base.clone(), sw = [0, 1, 0][f];
      P.set(9, 24, IRON[3]); P.set(9, 25, IRON[2]); nmLantern(P, 9 + sw, 26, NM_WARM);
      P.set(67, 24, IRON[3]); P.set(67, 25, IRON[2]); nmLantern(P, 67 - sw, 26, NM_VIOLET);
      P.outline(OUT);
      stars.forEach(([x, y], k) => { if ((k + f) % 3 === 0) P.glow(x, y, '#ffffff', '#ffffff'); else if ((k + f) % 3 === 1) P.glow(x, y, '#aab2d8', '#e8eeff'); });
      frames.push(P);
      const N = P.night();
      stars.forEach(([x, y], k) => { if ((k + f) % 3 === 0) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) N.tint(x + ox, y + oy, '#d8ccff', 0.45); });
      nframes.push(N);
    }
    return finish({
      ax, ay, foot: [4, 2], solid: true, fps: 2,
      lights: [Lt(9, 31, 46, [255, 188, 98], 0.85, { flicker: 1, night: true }), Lt(67, 31, 42, [185, 135, 255], 0.8, { flicker: 1, night: true }),
        Lt(38, 31, 30, [255, 190, 130], 0.5, { night: true }), Lt(18, 32, 18, [255, 188, 98], 0.4, { night: true }), Lt(58, 32, 18, [255, 188, 98], 0.4, { night: true }),
        Lt(38, 32, 14, [190, 150, 255], 0.35), Lt(29, 12, 22, [200, 200, 255], 0.25, { night: true })],
    }, frames, nframes);
  }
  // a small velvet-covered table of curios: 0 glowing bottles and a crystal ball, 1 folded cloaks and a few relics
  function makeMarketStallNight(v) {
    const W = 36, H = 32, ax = 18, ay = 29, seed = 3201 + v * 17;
    const VC = v === 0 ? ['#140a24', '#20103a', '#2e1952', '#40246c', '#56328a', '#7046a8'] : ['#200818', '#380e26', '#541838', '#74264c', '#943862', '#ae4e78'];
    const base = new Pix(W, H);
    base.shadow(ax + 2, ay - 1, 16, 3);
    const tx0 = 4, tx1 = 31, ty0 = 14, ty1 = 17, by = 26;
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) { let k = y === ty0 ? 4 : 3; if (x < tx0 + 3) k++; if (x > tx1 - 3) k--; if (hash(x, y, seed) < 0.08) k--; base.set(x, y, VC[clamp(k, 0, 5)]); }
    for (let y = ty1 + 1; y <= by; y++) for (let x = tx0; x <= tx1; x++) {
      const fold = (x - tx0) % 5; if (y > by - (fold === 2 ? 1 : 0)) continue;
      let k = fold === 0 ? 1 : fold === 1 ? 3 : 2; if (x === tx0) k = Math.max(k, 3); if (x === tx1) k = 1; if (y > by - 2) k = Math.max(0, k - 1);
      base.set(x, y, VC[k]);
    }
    for (let x = tx0; x <= tx1; x++) { base.set(x, ty1 + 1, x % 2 ? GOLDS[3] : GOLDS[1]); const fold = (x - tx0) % 5, hy = by + 1 - (fold === 2 ? 1 : 0); base.set(x, hy, x % 2 ? GOLDS[3] : GOLDS[1]); if (fold === 0) base.set(x, hy + 1, GOLDS[2]); }
    const lights = [Lt(29, 8, 30, [255, 190, 110], 0.7, { flicker: 1 })];
    if (v === 0) {
      nmBottle(base, 7, 15, 'tall', NM_BOTTLES[0], false); nmBottle(base, 10, 15, 'flask', NM_BOTTLES[1], false);
      nmBottle(base, 23, 15, 'tall', NM_BOTTLES[3], false); nmBottle(base, 26, 15, 'flask', NM_BOTTLES[4], false);
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = Math.hypot(x, y); if (d > 3.2) continue; const s = lam(x / 3.2, y / 3.2) + (noise(x + 9, y + 9, seed) - 0.5) * 0.3; base.set(17 + x, 9 + y, ['#3a2466', '#4a2f7a', '#6a47a8', '#8f6cd1', '#b99aee', '#e4d2ff'][Math.floor(clamp((s + 0.4) / 1.4, 0, 0.999) * 6)]); }
      base.set(16, 7, '#ffffff'); base.set(18, 10, '#e4d2ff');
      base.hline(15, 19, 13, GOLDS[3]); base.hline(14, 20, 14, GOLDS[2]); base.set(14, 15, GOLDS[1]); base.set(20, 15, GOLDS[1]);
      lights.push(Lt(17, 9, 22, [190, 150, 255], 0.45), Lt(11, 12, 12, [93, 255, 208], 0.3));
    } else {
      // three folded cloaks: a lit top, a rounded folded edge, a shadowed underside
      const fold = (x0, y0, w, c) => { for (let i = 0; i < w; i++) { base.set(x0 + i, y0, c[3]); base.set(x0 + i, y0 + 1, c[2]); base.set(x0 + i, y0 + 2, i === w - 1 ? c[0] : c[1]); } base.set(x0, y0 + 1, c[3]); base.set(x0 + w - 1, y0, c[2]); base.set(x0 + w - 1, y0 + 1, c[1]); };
      fold(5, 12, 10, ['#121a36', '#1f2a54', '#2e3e74', '#4a5c98']); fold(6, 9, 9, ['#3a2238', '#5a3a58', '#74506e', '#906a88']); fold(5, 6, 9, ['#11343c', '#1d4c56', '#2a666c', '#3e8486']);
      for (const x of [7, 10, 13]) base.set(x, 13, '#c8d4f0');
      for (const x of [8, 10, 12]) base.set(x, 11, GOLDS[2]);
      base.set(13, 9, '#c8d4f0'); base.set(13, 6, '#e8eeff');
      base.set(17, 14, GOLDS[3]); base.set(18, 14, GOLDS[4]); base.set(17, 13, GOLDS[2]);
      base.vline(21, 10, 14, GOLDS[2]); base.set(21, 9, GOLDS[3]); base.set(20, 11, GOLDS[3]); base.set(22, 11, GOLDS[1]); base.set(19, 12, GOLDS[2]); base.set(23, 12, GOLDS[1]);
      base.set(25, 13, '#c8d4f0'); base.set(25, 14, '#9fb0d8'); base.set(26, 14, '#e8eeff'); base.set(24, 12, '#9fb0d8'); base.set(26, 12, '#9fb0d8');
      base.line(27, 14, 28, 9, '#e8eeff'); base.set(28, 10, '#9fe2d6'); base.set(29, 10, '#6fbdb4');
      lights.push(Lt(21, 12, 12, [255, 214, 140], 0.25));
    }
    nmCandle(base, 29, 11);
    tuft(base, 3, 28); tuft(base, 33, 28, PAL.forest);
    base.outline(OUT);
    const frames = [0, 1, 2].map((f) => { const P = base.clone(); nmFlame(P, 29, 11, f); return P; });
    return finish({ ax, ay, foot: [2, 1], solid: true, fps: 6, lights }, frames);
  }
  // a deep violet rug with a gold moon pattern, for the ground before the carriage
  function makeMarketRug() {
    const W = 50, H = 34, ax = 25, ay = 32, seed = 3301;
    const RG = ['#12081e', '#1c0e2e', '#271541', '#341e56', '#43286c', '#553684'];
    const GD = ['#7a4a14', '#b07a22', '#d9a23a', '#f2c45a', '#ffe08a'];
    const P = new Pix(W, H);
    const x0 = 4, x1 = 45, y0 = 5, y1 = 29, cx = 24.5, cy = 17;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const bx = Math.min(x - x0, x1 - x), byy = Math.min(y - y0, y1 - y), b = Math.min(bx, byy), along = bx <= byy ? y : x;
      let c;
      if (b === 0) c = RG[1];
      else if (b === 1) c = RG[3];
      else if (b === 2) c = GD[1];
      else if (b <= 5) { c = RG[2]; const m = (along + (bx <= byy ? 0 : 1)) % 6; if (b === 4 && m === 0) c = GD[3]; else if ((b === 3 || b === 5) && m === 0) c = GD[1]; else if (b === 4 && m === 3) c = RG[4]; }
      else if (b === 6) c = GD[0];
      else { c = (x + y) % 6 === 0 || (x - y + 60) % 6 === 0 ? RG[3] : RG[2]; }
      P.set(x, y, c);
    }
    // the crescent medallion and its ring of stars
    for (let y = -6; y <= 6; y++) for (let x = -8; x <= 8; x++) {
      const o = (x * x) / 40 + (y * y) / 24 <= 1, i = ((x - 2.6) * (x - 2.6)) / 30 + ((y + 1) * (y + 1)) / 17 <= 1;
      if ((x * x) / 52 + (y * y) / 31 <= 1) P.set(cx + x, cy + y, RG[1]);
      if (o && !i) P.set(cx + x, cy + y, x + y < -3 ? GD[4] : x + y < 2 ? GD[3] : GD[2]);
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8, x = Math.round(cx + Math.cos(a) * 12.5), y = Math.round(cy + Math.sin(a) * 7.5);
      P.set(x, y, GD[4]); if (k % 2) { P.set(x - 1, y, GD[1]); P.set(x + 1, y, GD[1]); P.set(x, y - 1, GD[2]); P.set(x, y + 1, GD[1]); }
    }
    // little moons in the corners of the field
    for (const [mx, my, flip] of [[9, 10, 1], [40, 10, -1], [9, 24, 1], [40, 24, -1]]) { P.set(mx, my - 1, GD[2]); P.set(mx - flip, my, GD[3]); P.set(mx, my + 1, GD[1]); P.set(mx + flip, my - 1, GD[0]); P.set(mx + flip, my + 1, GD[0]); }
    // a soft wrinkle where it was unrolled, and a little wear toward the front
    for (let k = 0; k <= 24; k++) { const x = 15 + Math.round(k * 0.45), y = y0 + 1 + k; if (y > y1 - 1) break; P.tint(x, y, OUT, 0.28); P.tint(x + 1, y, '#ffffff', 0.07); }
    for (let x = x0; x <= x1; x++) if (noise(x / 3, 4, seed) > 0.6) P.tint(x, y1 - 1, OUT, 0.2);
    P.outline(OUT);
    // fringe on the short ends (after the outline, thread by thread)
    for (let y = y0 + 1; y <= y1 - 1; y += 2) { P.set(x0 - 2, y, '#d8c8a8'); P.set(x0 - 3, y, '#b8a888'); P.set(x1 + 2, y, '#c8b898'); P.set(x1 + 3, y, '#a89878'); }
    return finish({ ax, ay, foot: [3, 2], solid: false, flat: true, lights: [] }, P);
  }
  // a slim wrought-iron post with a violet glass lantern
  function makeLanternPostViolet() {
    const W = 16, H = 40, ax = 8, ay = 37;
    const P = new Pix(W, H);
    P.shadow(ax + 1, ay - 1, 4.5, 1.4);
    P.rect(5, 34, 6, 3, IRON[2]); P.hline(5, 10, 34, IRON[4]); P.hline(6, 9, 33, IRON[3]); P.hline(5, 10, 36, IRON[1]); P.set(5, 35, IRON[3]);
    for (let y = 13; y <= 32; y++) { P.set(7, y, IRON[3]); P.set(8, y, IRON[1]); }
    for (const y of [22, 29]) { P.hline(6, 9, y, IRON[4]); P.hline(6, 9, y + 1, IRON[2]); }
    P.set(5, 14, IRON[4]); P.set(5, 15, IRON[3]); P.set(6, 16, IRON[2]); P.set(10, 14, IRON[2]); P.set(10, 15, IRON[1]); P.set(9, 16, IRON[1]);
    // the lantern: finial, pointed cap, violet glass with a bright heart, base
    P.set(7, 0, IRON[4]); P.set(8, 0, IRON[2]); P.hline(6, 9, 1, IRON[3]); P.set(6, 1, IRON[4]); P.hline(5, 10, 2, IRON[2]); P.set(5, 2, IRON[4]); P.hline(4, 11, 3, IRON[1]); P.set(4, 3, IRON[3]);
    for (let y = 4; y <= 10; y++) { P.set(4, y, IRON[3]); P.set(11, y, IRON[1]); }
    const GV = ['#3a2466', '#6a47a8', '#8f6cd1', '#b99aee', '#e4d2ff', '#ffffff'];
    for (let y = 4; y <= 10; y++) for (let x = 5; x <= 10; x++) {
      const d = Math.hypot((x - 7.5) / 2.6, (y - 7) / 3.2), k = d < 0.35 ? 5 : d < 0.6 ? 4 : d < 0.85 ? 3 : d < 1.1 ? 2 : 1;
      P.glow(x, y, GV[y === 10 ? Math.min(k, 1) : k], GV[Math.min(5, k + 1)]);
    }
    P.vline(7, 4, 5, IRON[2]); P.hline(4, 11, 11, IRON[2]); P.hline(5, 10, 12, IRON[1]); P.set(4, 11, IRON[3]);
    P.outline(OUT);
    return finish({ ax, ay, foot: [1, 1], solid: true, lights: [Lt(8, 7, 56, [180, 130, 255], 0.9, { flicker: 1, night: true }), Lt(8, 7, 14, [228, 210, 255], 0.35)] }, P, P.night());
  }

  // ================================================================== registry
  const DEFS = {
    standing_stone: [4, makeStandingStone],
    altar_slab: [1, makeAltarSlab],
    giant_tree: [2, makeGiantTree],
    elder_tree: [1, makeElderTree],
    webbed_tree: [3, makeWebbedTree],
    bones: [3, makeBones],
    tent: [1, makeTent],
    campfire: [2, makeCampfire],
    bedroll: [1, makeBedroll],
    pack: [1, makePack],
    eyes: [2, makeEyes],
    ward_lantern: [1, makeWardLantern],
    signpost: [1, makeSignpost],
    hollow_stump: [1, makeHollowStump],
    tunnel_arch: [1, makeTunnelArch],
    willow_big: [1, makeWillowBig],
    flowers: [3, makeFlowers],
    bonding_stone: [1, makeBondingStone],
    lilypads: [2, makeLilypads],
    shrine_chance: [1, makeShrineChance],
    riddle_stone: [1, makeRiddleStone],
    wishing_well: [1, makeWishingWell],
    fallen_star: [1, makeFallenStar],
    spirit: [1, makeSpirit],
    traveller: [1, makeTraveller],
    merchant_cart: [1, makeMerchantCart],
    night_carriage: [1, makeNightCarriage],
    market_stall_night: [2, makeMarketStallNight],
    market_rug: [1, makeMarketRug],
    lantern_post_violet: [1, makeLanternPostViolet],
  };
  const cache = new Map();
  function piece(id, variant) {
    const def = DEFS[id]; if (!def) return null;
    const n = def[0], v = ((Math.floor(variant) || 0) % n + n) % n, key = id + ':' + v;
    let r = cache.get(key);
    if (!r) { r = def[1](v); r.id = id; r.v = v; cache.set(key, r); }
    return r;
  }
  const variants = {}; for (const k of Object.keys(DEFS)) variants[k] = DEFS[k][0];
  window.WildArt = { piece, ids: Object.keys(DEFS), variants };
})();
