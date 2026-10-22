// Nightvale — terrain materials and the per-pixel terrain baker.
// The whole ground of a map is painted once into a canvas at 1x pixels, with noise-distorted,
// organic borders between materials (no visible tile grid), cliffs with grass lips, water depth, etc.
(function () {
  'use strict';
  const G = window.G, U = G.U;

  const PAL = (G.PAL = {
    outline: '#120c1c',
    shadowV: ['#1b1429', '#231b38', '#362a52', '#4a3b6d', '#604e88'],
    magic: ['#4a2f7a', '#6a47a8', '#8f6cd1', '#b99aee', '#e4d2ff'],
    leaf: ['#10302a', '#1a4434', '#245a40', '#337450', '#4c9061', '#74b46e'],
    pine: ['#0b221f', '#11322b', '#18443a', '#22594a', '#33735c'],
    grass: ['#163a30', '#1f4e3c', '#296246', '#377a53', '#589c64'],
    meadow: ['#1d4a3a', '#275e45', '#33724f', '#468a5c', '#6aa86c'],
    forest: ['#0f2a25', '#153730', '#1d4638', '#285a43', '#3b744f'],
    emerald: ['#2fbf7f', '#5dffb0', '#b4ffd9'],
    moon: ['#9fb0d8', '#c8d4f0', '#e8eeff', '#ffffff'],
    amber: '#ffbc62', gold: '#f2c45a', candle: '#fff1c8', orange: '#e8843c', ember: '#c44a3a',
    rose: ['#8c3a62', '#c4648e', '#e89ab8'],
    water: ['#17224c', '#213479', '#2e4f9f', '#69a1db', '#c4e6ff'],
    stone: ['#2d2c3e', '#45445a', '#605f78', '#7e7d97', '#a09fb6', '#c4c3d6'],
    rock: ['#1e1a2c', '#2d2840', '#3d3654', '#4f4769', '#635a80', '#7a7099'],
    wood: ['#281d21', '#3e2d2b', '#574039', '#7a5a48', '#9c7a5e'],
    path: ['#3a3450', '#534a6d', '#6e648f', '#8c81ac'],
    soil: ['#22182c', '#31233d', '#43324d', '#56425f'],
    dirt: ['#2f2534', '#3f3346', '#524459', '#66566c', '#7d6c82'],
    sand: ['#5a566e', '#736f88', '#8d89a1', '#a7a3ba', '#c2bfd2'],
    bog: ['#14231f', '#1b302a', '#243d33', '#2f4d3d'],
    gravel: ['#3a3748', '#4b475b', '#5e5970', '#746e86', '#8c86a0'],
  });

  // Material ids
  const M = (G.MAT = {
    VOID: 0, GRASS: 1, MEADOW: 2, DIRT: 3, COBBLE: 4, FLOOR: 5, WATER: 6, DEEP: 7, SAND: 8, CLIFF: 9,
    BRIDGE: 10, EARTH: 11, BOG: 12, GRAVEL: 13, STAIRS: 14, MOSSFLOOR: 15, CAVEFLOOR: 16, CAVEWALL: 17, FOREST: 18, POOL: 19, RUNEFLOOR: 20,
  });
  // solid: blocks walking; organic: border distorts with noise; wet: water-like
  const INFO = (G.MATINFO = []);
  const def = (id, name, o) => (INFO[id] = Object.assign({ id, name, solid: false, organic: true, wet: false, tillable: false }, o));
  def(M.VOID, 'void', { solid: true, organic: false });
  def(M.GRASS, 'grass', { tillable: true });
  def(M.MEADOW, 'meadow', { tillable: true });
  def(M.DIRT, 'dirt', { tillable: true });
  def(M.COBBLE, 'cobble');
  def(M.FLOOR, 'floor', { organic: false });
  def(M.WATER, 'water', { solid: true, wet: true });
  def(M.DEEP, 'deep', { solid: true, wet: true });
  def(M.SAND, 'sand', { tillable: false });
  def(M.CLIFF, 'cliff', { solid: true, organic: false });
  def(M.BRIDGE, 'bridge', { organic: false });
  def(M.EARTH, 'earth', { tillable: true });
  def(M.BOG, 'bog');
  def(M.GRAVEL, 'gravel');
  def(M.STAIRS, 'stairs', { organic: false });
  def(M.MOSSFLOOR, 'mossfloor', { organic: false });
  def(M.CAVEFLOOR, 'cavefloor');
  def(M.CAVEWALL, 'cavewall', { solid: true, organic: false });
  def(M.FOREST, 'forest', { tillable: true });
  def(M.POOL, 'pool', { solid: true, organic: false, wet: true });
  def(M.RUNEFLOOR, 'runefloor', { organic: false });

  // ---------------------------------------------------------------------------------------
  const packCache = new Map();
  function P(c) {
    if (typeof c === 'string') { let v = packCache.get(c); if (v === undefined) { v = U.pack(c); packCache.set(c, v); } return v; }
    return U.pack(c);
  }
  const rgb = (c) => U.hex(c);
  // Precomputed RGB ramps for speed
  const R = {};
  for (const k of Object.keys(PAL)) if (Array.isArray(PAL[k])) R[k] = PAL[k].map(rgb);
  const SH = rgb('#1b1429');

  function packRGB(r, g, b) { return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; }
  function shadeRGB(c, t) { // darken toward violet shadow by t (0..1)
    return [c[0] + (SH[0] - c[0]) * t, c[1] + (SH[1] - c[1]) * t, c[2] + (SH[2] - c[2]) * t];
  }
  function lit(c, t) { return [c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t]; }

  const noise = U.noise, hash = U.hash;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

  // ---------------------------------------------------------------------------------------
  // Bake a map's terrain into a canvas. map: {w,h,terrain:Uint8Array, seed, theme?}
  G.bakeTerrain = function (map) {
    const TW = map.w, TH = map.h, W = TW * 16, H = TH * 16, seed = map.seed | 0;
    const ter = map.terrain;
    const tAt = (tx, ty) => ter[U.clamp(ty, 0, TH - 1) * TW + U.clamp(tx, 0, TW - 1)];

    // Pass 1: pixel material map with organic distortion.
    const mm = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const ty0 = y >> 4;
      for (let x = 0; x < W; x++) {
        const t0 = ter[ty0 * TW + (x >> 4)];
        if (!INFO[t0].organic) { mm[y * W + x] = t0; continue; }
        const dx = (noise(x / 9, y / 9, seed + 3) - 0.5) * 8 + (noise(x / 3, y / 3, seed + 4) - 0.5) * 2.2;
        const dy = (noise(x / 9, y / 9, seed + 5) - 0.5) * 8 + (noise(x / 3, y / 3, seed + 6) - 0.5) * 2.2;
        const t1 = tAt(Math.floor((x + dx) / 16), Math.floor((y + dy) / 16));
        mm[y * W + x] = INFO[t1].organic ? t1 : t0;
      }
    }
    const mAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? mm[U.clamp(y, 0, H - 1) * W + U.clamp(x, 0, W - 1)] : mm[y * W + x]);
    const isWet = (m) => m === M.WATER || m === M.DEEP || m === M.POOL;

    // Water depth per tile (distance to land), bilinear per pixel
    const depth = new Float32Array(TW * TH);
    {
      const q = [];
      for (let i = 0; i < TW * TH; i++) { if (INFO[ter[i]].wet) depth[i] = 99; else { depth[i] = 0; q.push(i); } }
      let head = 0;
      while (head < q.length) {
        const i = q[head++], x = i % TW, y = (i / TW) | 0, d = depth[i] + 1;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [ox, oy] of nb) {
          const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= TW || ny >= TH) continue;
          const j = ny * TW + nx; if (depth[j] > d) { depth[j] = d; q.push(j); }
        }
      }
      for (let i = 0; i < depth.length; i++) if (depth[i] === 99) depth[i] = 8;
    }
    const depthAt = (x, y) => {
      const fx = x / 16 - 0.5, fy = y / 16 - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
      const g = (tx, ty) => depth[U.clamp(ty, 0, TH - 1) * TW + U.clamp(tx, 0, TW - 1)];
      return (g(x0, y0) * (1 - u) + g(x0 + 1, y0) * u) * (1 - v) + (g(x0, y0 + 1) * (1 - u) + g(x0 + 1, y0 + 1) * u) * v;
    };

    // Cliff runs: for each cliff pixel, distance to the top and bottom of its vertical run.
    const cTop = new Uint8Array(W * H), cBot = new Uint8Array(W * H);
    for (let x = 0; x < W; x++) {
      let y = 0;
      while (y < H) {
        if (mm[y * W + x] !== M.CLIFF && mm[y * W + x] !== M.CAVEWALL) { y++; continue; }
        const kind = mm[y * W + x];
        let y1 = y; while (y1 < H && mm[y1 * W + x] === kind) y1++;
        for (let k = y; k < y1; k++) { cTop[k * W + x] = Math.min(255, k - y); cBot[k * W + x] = Math.min(255, y1 - 1 - k); }
        y = y1;
      }
    }

    const theme = map.theme || null;
    const out = new Uint32Array(W * H);
    const shimmer = [];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, m = mm[i];
        let c; // [r,g,b]
        const up = mAt(x, y - 1), dn = mAt(x, y + 1), lf = mAt(x - 1, y), rt = mAt(x + 1, y);
        switch (m) {
          case M.GRASS: case M.MEADOW: case M.FOREST: case M.EARTH: {
            const ramp = m === M.MEADOW ? R.meadow : m === M.FOREST ? R.forest : R.grass;
            if (m === M.EARTH) {
              const n = noise(x / 5, y / 5, seed + 21) * 0.6 + hash(x, y, seed + 22) * 0.4;
              c = n < 0.3 ? R.soil[1] : n < 0.62 ? R.soil[2] : n < 0.9 ? R.soil[3] : R.grass[1];
              if (noise(x / 7, y / 7, seed + 23) > 0.72 && hash(x, y, 24) < 0.5) c = R.grass[1];
              break;
            }
            const n = noise(x / 15, y / 15, seed + 11) * 0.58 + noise(x / 4.5, y / 4.5, seed + 12) * 0.42;
            let k = n < 0.37 ? 1 : n < 0.61 ? 2 : 3;
            const h = hash(x, y, seed + 13);
            if (h < 0.012) k--; else if (h > 0.988) k++;
            // grass blade highlights with a shadow pixel beneath
            if (hash(x, y, seed + 14) < 0.03) k = Math.min(4, k + 1);
            else if (hash(x, y - 1, seed + 14) < 0.03) k = Math.max(0, k - 1);
            c = ramp[U.clamp(k, 0, 4)];
            if (m === M.FOREST && hash(x, y, seed + 15) < 0.025) c = hash(x, y, 16) < 0.5 ? R.wood[2] : R.rose[0];
            break;
          }
          case M.DIRT: {
            const n = noise(x / 6, y / 6, seed + 31) * 0.55 + hash(x, y, seed + 32) * 0.45;
            let k = n < 0.32 ? 1 : n < 0.7 ? 2 : 3;
            if (hash(x, y, seed + 33) < 0.018) k = 4; else if (hash(x, y - 1, seed + 33) < 0.018) k = 0;
            c = R.dirt[k];
            break;
          }
          case M.GRAVEL: {
            const n = noise(x / 4, y / 4, seed + 41) * 0.5 + hash(x, y, seed + 42) * 0.5;
            let k = n < 0.3 ? 1 : n < 0.62 ? 2 : n < 0.9 ? 3 : 4;
            if (hash(x, y - 1, seed + 43) < 0.04) k = 0;
            c = R.gravel[k];
            break;
          }
          case M.SAND: {
            const n = noise(x / 8, y / 5, seed + 51) * 0.6 + hash(x, y, seed + 52) * 0.4;
            let k = n < 0.35 ? 2 : n < 0.75 ? 3 : 4;
            if (hash(x, y, seed + 53) < 0.006) c = R.moon[1]; else c = R.sand[k];
            const dw = depthAt(x, y);
            if (dw < 0.9) c = shadeRGB(c, 0.25);
            break;
          }
          case M.COBBLE: {
            const cs = 6, rs = 5;
            const cx = Math.floor(x / cs), cy = Math.floor(y / rs);
            let d1 = 99, d2 = 99, best = 0, oy0 = 0;
            for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
              const gx = cx + k, gy = cy + j;
              const ox = gx * cs + hash(gx, gy, 5) * cs, oy = gy * rs + hash(gx, gy, 6) * rs;
              const d = Math.hypot((x - ox) * 0.85, y - oy);
              if (d < d1) { d2 = d1; d1 = d; best = hash(gx, gy, 7); oy0 = oy; } else if (d < d2) d2 = d;
            }
            if (d2 - d1 < 0.95) {
              c = noise(x / 6, y / 6, seed + 61) > 0.68 ? R.grass[1] : R.path[0];
            } else {
              let k = best < 0.35 ? 1 : best < 0.85 ? 2 : 3;
              if (y - oy0 < -1) k = Math.min(3, k + 1);
              if (y - oy0 > 1.4) k = Math.max(1, k - 1);
              c = R.path[k];
            }
            break;
          }
          case M.FLOOR: case M.MOSSFLOOR: case M.RUNEFLOOR: {
            const lx = x & 15, ly = y & 15, sx = lx & 7, sy = ly & 7;
            const tile = hash(x >> 3, y >> 3, seed + 71);
            if (sx === 0 || sy === 0) c = R.stone[1];
            else {
              let k = tile < 0.3 ? 2 : tile < 0.8 ? 3 : 4;
              if (sx === 1 || sy === 1) k = Math.min(5, k + 1);
              if (sx === 7 || sy === 7) k = Math.max(1, k - 1);
              c = R.stone[k];
              if (hash(x, y, seed + 72) < 0.06) c = shadeRGB(c, 0.15);
              if (tile > 0.93 && ((sx + sy) === 7 || (sx - sy) === 2)) c = R.stone[1]; // cracks
            }
            const mossy = m === M.MOSSFLOOR ? 0.42 : 0.7;
            if (noise(x / 7, y / 7, seed + 73) > mossy && (sx <= 1 || sy <= 1 || hash(x, y, 74) < 0.45)) c = hash(x, y, 75) < 0.6 ? R.grass[2] : R.grass[3];
            if (m === M.RUNEFLOOR) {
              // concentric rune ring around the tile centre of each 2x2 tile block
              const bx = ((x % 32) + 32) % 32 - 16, by = ((y % 32) + 32) % 32 - 16, rr = Math.hypot(bx, by);
              if (Math.abs(rr - 11) < 0.7 || (Math.abs(rr - 7) < 0.6 && hash(Math.floor(Math.atan2(by, bx) * 3), 0, 9) < 0.7)) c = R.magic[1];
            }
            break;
          }
          case M.WATER: case M.DEEP: case M.POOL: {
            const landN = !isWet(up) || !isWet(dn) || !isWet(lf) || !isWet(rt);
            if (m === M.POOL) { // ornamental pool: carved pale rim, a shadowed lip, still clear water
              if (!isWet(up) || !isWet(lf)) { c = R.stone[5]; break; }
              if (!isWet(dn) || !isWet(rt)) { c = R.stone[3]; break; }
              if (!isWet(mAt(x, y - 2)) || !isWet(mAt(x - 2, y))) { c = R.stone[1]; break; }
              if (!isWet(mAt(x, y + 2)) || !isWet(mAt(x + 2, y))) { c = R.stone[2]; break; }
              const shade = !isWet(mAt(x, y - 4)) || !isWet(mAt(x, y - 3));
              const d = depthAt(x, y) + (noise(x / 14, y / 14, seed + 82) - 0.5) * 0.8;
              const lvl = U.clamp((d - 0.8) / 1.2, 0, 2), base = Math.floor(lvl), bay = BAYER[(y & 3) * 4 + (x & 3)];
              const k = Math.min(2, base + (bay < lvl - base ? 1 : 0));
              c = shade ? R.water[0] : [R.water[3], R.water[2], R.water[1]][k];
              if (noise(x / 10, y / 3, seed + 85) > 0.78) c = lit(c, 0.14);
              if (hash(x, y, seed + 86) < 0.006) shimmer.push(x, y);
              break;
            }
            if (landN && m !== M.POOL) { c = hash(x, y, seed + 81) < 0.82 ? R.water[3] : R.water[2]; break; }
            if (landN) { c = R.water[2]; break; }
            let near = false;
            for (let k = 2; k <= 3 && !near; k++) near = !isWet(mAt(x, y - k)) || !isWet(mAt(x - k, y)) || !isWet(mAt(x + k, y)) || !isWet(mAt(x, y + k));
            // smooth depth with an ordered (Bayer) dither between the three water tones
            const d = depthAt(x, y) + (noise(x / 18, y / 18, seed + 82) - 0.5) * 0.9 + (m === M.DEEP ? 1.6 : 0);
            const lvl = U.clamp((d - 1.1) / 1.5, 0, 2);
            const base = Math.floor(lvl), frac = lvl - base;
            const bay = BAYER[(y & 3) * 4 + (x & 3)];
            const k = Math.min(2, base + (bay < frac ? 1 : 0));
            c = near ? R.water[2] : R.water[2 - k];
            if (noise(x / 16, y / 3.5, seed + 85) > 0.8) c = lit(c, 0.1);
            if (!near && hash(x, y, seed + 86) < 0.0035) shimmer.push(x, y);
            break;
          }
          case M.BOG: {
            const n = noise(x / 6, y / 6, seed + 91);
            if (n < 0.42) { c = noise(x / 3, y / 9, seed + 92) > 0.6 ? R.bog[3] : R.bog[1]; }
            else if (n < 0.5) c = R.bog[0];
            else c = hash(x, y, seed + 93) < 0.5 ? R.soil[1] : R.forest[1];
            if (hash(x, y, seed + 94) < 0.02) c = R.forest[3];
            break;
          }
          case M.CLIFF: case M.CAVEWALL: {
            const t = cTop[i], b = cBot[i];
            const rk = theme && theme.wall ? theme.wall : R.rock;
            const lipLen = 2 + Math.floor(noise(x / 3, 0.5, seed + 101) * 3);
            const aboveM = mAt(x, y - t - 1);
            const grassy = aboveM === M.GRASS || aboveM === M.MEADOW || aboveM === M.FOREST || aboveM === M.EARTH;
            if (m === M.CAVEWALL && b >= 16) {
              // ceiling (top of the wall mass): dark with faint texture and a rim where it meets open floor
              const tt = theme && theme.ceil ? theme.ceil : [R.rock[0], R.rock[1]];
              c = noise(x / 5, y / 5, seed + 102) > 0.6 ? tt[1] : tt[0];
              if (mAt(x - 1, y) !== M.CAVEWALL || mAt(x + 1, y) !== M.CAVEWALL || mAt(x, y - 1) !== M.CAVEWALL) c = rk[2];
              break;
            }
            if (m === M.CAVEWALL && b === 15) { c = rk[4] || rk[3]; break; }
            if (t < lipLen && grassy && m === M.CLIFF) { c = t === 0 ? R.grass[3] : t === 1 ? R.grass[2] : R.grass[1]; break; }
            if (t === lipLen && grassy && m === M.CLIFF) { c = R.rock[0]; break; }
            const band = Math.floor((t + noise(x / 7, y / 25, seed + 103) * 4) / 5);
            let k = 2 + (band % 2) + (noise(x / 3, y / 8, seed + 104) > 0.7 ? 1 : 0) - (noise(x / 2.2, y / 2.2, seed + 105) < 0.2 ? 1 : 0);
            if (noise(x / 1.6, y / 9, seed + 106) > 0.82) k = 1;
            const lfS = mAt(x - 1, y) !== m, rtS = mAt(x + 1, y) !== m;
            if (lfS) k = 4; else if (rtS) k = 1;
            if (b <= 1) k = Math.max(0, Math.min(k, 1) - (b === 0 ? 1 : 0));
            c = rk[U.clamp(k, 0, rk.length - 1)];
            if (theme && theme.vein && hash(x, y, seed + 107) < theme.vein[1] && k >= 2) c = U.hex(theme.vein[0]);
            break;
          }
          case M.BRIDGE: {
            const tx = x >> 4, ty = y >> 4;
            const horizW = (INFO[tAt(tx - 1, ty)].wet ? 1 : 0) + (INFO[tAt(tx + 1, ty)].wet ? 1 : 0);
            const vertW = (INFO[tAt(tx, ty - 1)].wet ? 1 : 0) + (INFO[tAt(tx, ty + 1)].wet ? 1 : 0);
            const runsNS = horizW >= vertW; // water on the sides => bridge runs north-south => planks horizontal
            const a = runsNS ? y : x, bcoord = runsNS ? x : y;
            const plank = Math.floor(a / 4);
            if (a % 4 === 3) c = R.wood[0];
            else {
              const hv = hash(plank, Math.floor(bcoord / 24), seed + 111);
              c = R.wood[hv < 0.3 ? 2 : hv < 0.8 ? 3 : 4];
              if (a % 4 === 0) c = lit(c, 0.08);
              if (hash(x, y, seed + 112) < 0.05) c = R.wood[2];
            }
            // edges against water get a dark rail line
            const sideA = runsNS ? mAt(x - 1, y) : mAt(x, y - 1), sideB = runsNS ? mAt(x + 1, y) : mAt(x, y + 1);
            if (isWet(sideA) || isWet(sideB)) c = R.wood[1];
            break;
          }
          case M.STAIRS: {
            const ly = y & 15, lx = x & 15;
            const step = ly % 5;
            c = step < 2 ? R.stone[4] : step < 4 ? R.stone[3] : R.stone[1];
            if (lx === 0 || lx === 15) c = R.stone[1];
            if (hash(x, y, seed + 121) < 0.05) c = R.grass[2];
            break;
          }
          case M.CAVEFLOOR: {
            const fl = theme && theme.floor ? theme.floor : R.dirt;
            const n = noise(x / 7, y / 7, seed + 131) * 0.55 + hash(x, y, seed + 132) * 0.45;
            let k = n < 0.3 ? 1 : n < 0.68 ? 2 : 3;
            if (hash(x, y, seed + 133) < 0.02) k = 4; else if (hash(x, y - 1, seed + 133) < 0.02) k = 0;
            c = fl[U.clamp(k, 0, fl.length - 1)];
            if (theme && theme.moss && noise(x / 9, y / 9, seed + 134) > 0.68) c = theme.moss[hash(x, y, 135) < 0.5 ? 0 : 1];
            break;
          }
          default:
            c = R.shadowV[0];
        }

        // Shadows & edges applied on top of ground materials
        if (m !== M.CLIFF && m !== M.CAVEWALL && !isWet(m)) {
          // cast shadow below cliffs (3px)
          let sh = 0;
          for (let k = 1; k <= 4; k++) { const a = mAt(x, y - k); if (a === M.CLIFF || a === M.CAVEWALL) { sh = (5 - k) * 0.12; break; } }
          if (sh) c = shadeRGB(c, sh);
          // dark wet bank next to water
          if (isWet(up) || isWet(dn) || isWet(lf) || isWet(rt)) c = shadeRGB(c, 0.38);
          // grass lip over paths: darker grass edge, shadowed path top row
          const grassLike = (q) => q === M.GRASS || q === M.MEADOW || q === M.FOREST;
          if (grassLike(m) && !grassLike(dn) && dn !== M.EARTH && !isWet(dn) && dn !== M.CLIFF) c = shadeRGB(c, 0.3);
          if (!grassLike(m) && m !== M.EARTH && grassLike(up)) c = shadeRGB(c, 0.22);
        }
        out[i] = packRGB(c[0] | 0, c[1] | 0, c[2] | 0);
      }
    }

    const cv = U.canvas(W, H), cx = cv.getContext('2d');
    const img = cx.createImageData(W, H);
    new Uint32Array(img.data.buffer).set(out);
    cx.putImageData(img, 0, 0);
    return { canvas: cv, shimmer, mm, W, H };
  };

  // Small ground decorations painted onto a baked terrain canvas (non-colliding).
  // Returns light sources for glowing decor.
  G.decorateTerrain = function (map, baked) {
    const ctx = baked.canvas.getContext('2d');
    const rng = U.rng(map.seed * 7 + 13);
    const W = baked.W, H = baked.H, mm = baked.mm;
    const lights = [];
    const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
    const blocked = map.decorBlock || (() => false);
    const count = Math.floor((map.w * map.h) * (map.decorDensity || 0.5));
    const flowerCols = [PAL.magic[3], PAL.magic[4], PAL.rose[2], PAL.moon[2], PAL.amber, PAL.rose[1]];
    for (let n = 0; n < count; n++) {
      const x = 2 + Math.floor(rng() * (W - 4)), y = 3 + Math.floor(rng() * (H - 5));
      const m = mm[y * W + x];
      if (blocked(x >> 4, y >> 4)) continue;
      const r = rng();
      if (m === M.GRASS || m === M.MEADOW || m === M.FOREST) {
        const g = m === M.MEADOW ? PAL.meadow : m === M.FOREST ? PAL.forest : PAL.grass;
        if (r < 0.5) { // tuft
          px(x, y, g[4]); px(x - 1, y + 1, g[4]); px(x + 1, y + 1, g[3]); px(x, y + 1, g[3]); px(x - 1, y + 2, g[1]); px(x + 1, y + 2, g[1]); px(x, y + 2, g[0]);
        } else if (r < (m === M.MEADOW ? 0.9 : 0.72)) { // flower
          const col = flowerCols[Math.floor(rng() * flowerCols.length)];
          px(x, y + 1, g[3]); px(x, y + 2, g[2]);
          px(x, y, col); if (rng() < 0.6) { px(x - 1, y, col); px(x + 1, y, col); px(x, y - 1, col); px(x, y, PAL.candle); }
        } else if (r < 0.8 && m === M.FOREST) { // glowing mushroom
          px(x, y + 1, PAL.stone[4]); px(x - 1, y, PAL.emerald[0]); px(x, y, PAL.emerald[1]); px(x + 1, y, PAL.emerald[0]); px(x, y - 1, PAL.emerald[2]);
          lights.push({ x: x + 0.5, y: y, r: 10, color: [93, 255, 176], i: 0.55, night: true });
        } else { // pebble
          px(x, y, PAL.stone[4]); px(x + 1, y, PAL.stone[3]); px(x, y + 1, PAL.stone[1]); px(x + 1, y + 1, PAL.stone[1]);
        }
      } else if (m === M.DIRT || m === M.GRAVEL || m === M.SAND) {
        if (r < 0.25) { px(x, y, PAL.stone[3]); px(x + 1, y, PAL.stone[2]); px(x, y + 1, PAL.stone[0]); }
      } else if (m === M.BOG) {
        if (r < 0.5) { // reeds
          const hgt = 3 + Math.floor(rng() * 3);
          for (let k = 0; k < hgt; k++) px(x, y - k, k === hgt - 1 ? PAL.wood[3] : PAL.leaf[3]);
          px(x + 1, y, PAL.leaf[2]);
        }
      }
    }
    return lights;
  };
})();
