// Nightvale — design alternatives for the mounts Caspian sells (MobArt ids `<id>__b` / `<id>__c`).
// Design A lives in js/art/mobs.js ("MOUNTS — horses & dragons"); G.altArt (js/core.js) swaps these in
// when Settings > Designs picks B or C. Same contract as A: draw(anim, dir, i) -> { back, front },
// the rider sits between the layers at seat (+ seatDy); 'left' is the mirrored 'right'.
// True 1x pixel art, lit from the upper left, outline #120c1c, deterministic (no Math.random).
(function () {
  'use strict';
  var ROOT = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  var MA = ROOT.MobArt;
  if (!MA || !MA._kit) return;
  var K = MA._kit;
  var OL = K.OL, mk = K.mk, px = K.px, rect = K.rect, line = K.line, spr = K.spr, over = K.over, outline = K.outline;
  var hash = K.hash, mix = K.mix, A = K.A, inE = K.inE, bez3 = K.bez3, clr = K.clr;

  // ======================================================================= volume masks + directional shading
  // Parts are built as boolean masks (unions of ellipses, polygons and tapered tubes), then shaded as one
  // volume: each pixel's tone comes from how far it sits from the lit edge (toward the upper left) versus
  // the shadow edge, so joined shapes read as one smooth form instead of a stack of shaded blobs.
  function M(w, h) { return { w: w, h: h, d: new Uint8Array(w * h) }; }
  function mSet(m, x, y) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.d[y * m.w + x] = 1; }
  function mClr(m, x, y) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < m.w && y < m.h) m.d[y * m.w + x] = 0; }
  function mGet(m, x, y) { return x >= 0 && y >= 0 && x < m.w && y < m.h ? m.d[y * m.w + x] : 0; }
  function mEll(m, cx, cy, rx, ry) {
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) if (inE(x, y, cx, cy, rx, ry)) mSet(m, x, y);
    return m;
  }
  function mPoly(m, pts) {
    var minY = 1e9, maxY = -1e9, i, n = pts.length / 2;
    for (i = 0; i < n; i++) { minY = Math.min(minY, pts[i * 2 + 1]); maxY = Math.max(maxY, pts[i * 2 + 1]); }
    for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      var yc = y + 0.5, xs = [];
      for (i = 0; i < n; i++) {
        var x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], y1 = pts[((i + 1) % n) * 2 + 1];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + (yc - y0) / (y1 - y0) * (x1 - x0));
      }
      xs.sort(function (a, c) { return a - c; });
      for (var k = 0; k + 1 < xs.length; k += 2) for (var x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) mSet(m, x, y);
    }
    return m;
  }
  // tapered tube through a polyline [[x, y], ...] with radius r0 -> r1 (stamped discs, pixel-centre tests)
  function mTube(m, pts, r0, r1) {
    var L = [0], i, tot = 0;
    for (i = 1; i < pts.length; i++) { tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); L.push(tot); }
    var steps = Math.max(2, Math.ceil(tot * 2));
    for (var s = 0; s <= steps; s++) {
      var d = tot * s / steps, j = 1;
      while (j < pts.length - 1 && L[j] < d) j++;
      var seg = (L[j] - L[j - 1]) || 1, u = Math.max(0, Math.min(1, (d - L[j - 1]) / seg));
      var x = pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * u, y = pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * u;
      var r = r0 + (r1 - r0) * (tot ? d / tot : 0);
      mEll(m, x, y, r, r);
    }
    return m;
  }
  function bezPts(P, n) { var o = []; for (var i = 0; i <= n; i++) o.push(bez3(P, i / n)); return o; }
  function mBez(m, P, r0, r1) { return mTube(m, bezPts(P, 16), r0, r1); }
  function mOr(a, b) { for (var i = 0; i < a.d.length; i++) a.d[i] |= b.d[i]; return a; }
  function mSub(a, b) { for (var i = 0; i < a.d.length; i++) if (b.d[i]) a.d[i] = 0; return a; }
  // ASCII mask: rows of '#' (or any non-'.' char) placed with its top-left at (ox, oy)
  function mRows(m, rows, ox, oy) {
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) { var c = rows[y].charAt(x); if (c !== '.' && c !== ' ') mSet(m, ox + x, oy + y); }
    return m;
  }
  function mCount(m) { var n = 0; for (var i = 0; i < m.d.length; i++) n += m.d[i]; return n; }
  // tone of every mask pixel: 0 (core shadow) .. 4 (highlight); o.off shifts the whole ramp (far parts -1)
  var LX = -0.6, LY = -0.8;
  function toneAt(m, x, y, o) {
    var dl = 0, ds = 0, n;
    for (n = 1; n <= 24; n++) { if (!mGet(m, Math.floor(x + 0.5 + LX * n), Math.floor(y + 0.5 + LY * n))) break; dl++; }
    for (n = 1; n <= 24; n++) { if (!mGet(m, Math.floor(x + 0.5 - LX * n), Math.floor(y + 0.5 - LY * n))) break; ds++; }
    var t = (dl + 0.5) / (dl + ds + 1);
    if (o && o.tb) t = t * (1 - o.tb) + o.tb * Math.max(0, Math.min(1, (y - o.y0) / (o.y1 - o.y0))); // extra top-down falloff
    var k = t < 0.2 ? 4 : t < 0.45 ? 3 : t < 0.72 ? 2 : t < 0.9 ? 1 : 0;
    if (k === 4 && mGet(m, x, y - 1) && dl > 1) k = 3; // the brightest tone only along the upper rim
    if (!mGet(m, x, y - 1) && t < 0.55 && k < 3) k = 3;
    if (o && o.off) k += o.off;
    if (o && o.max != null) k = Math.min(k, o.max);
    return Math.max(0, Math.min(4, k));
  }
  function shade(b, m, R, o) {
    for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) {
      if (!m.d[y * m.w + x]) continue;
      var k = toneAt(m, x, y, o);
      px(b, x, y, R[Math.min(R.length - 1, k)]);
    }
    return b;
  }
  // height-field shading: distance to the silhouette edge -> a rounded bevel of radius o.r -> normals -> lit from the upper left.
  // o: { r: bevel radius, off: ramp shift, tb: top->bottom darkening [0..1] over y0..y1, lz: light height, rim: upper-rim highlight }
  var DT_OFF = (function () { var a = []; for (var dy = -12; dy <= 12; dy++) for (var dx = -12; dx <= 12; dx++) a.push([dx, dy, Math.sqrt(dx * dx + dy * dy)]); a.sort(function (p, q) { return p[2] - q[2]; }); return a; })();
  function distIn(m, R) {
    var w = m.w, h = m.h, D = new Float32Array(w * h), lim = R + 1.5;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x; if (!m.d[i]) continue;
      var dmin = lim;
      for (var k = 0; k < DT_OFF.length; k++) { var o = DT_OFF[k]; if (o[2] >= dmin) break; if (!mGet(m, x + o[0], y + o[1])) { dmin = o[2]; break; } }
      D[i] = dmin;
    }
    return D;
  }
  function toneMap(m, o) {
    o = o || {};
    var w = m.w, h = m.h, R = o.r || 4, D = distIn(m, R), H = new Float32Array(w * h), T = new Int8Array(w * h).fill(-1), x, y, i;
    for (i = 0; i < w * h; i++) if (m.d[i]) { var d = Math.min(D[i] - 0.5, R) / R; H[i] = Math.sqrt(Math.max(0, 1 - (1 - d) * (1 - d))) * R; }
    var lx = o.lx == null ? -0.55 : o.lx, ly = o.ly == null ? -0.72 : o.ly, lz = o.lz == null ? 0.72 : o.lz, ln = Math.hypot(lx, ly, lz);
    lx /= ln; ly /= ln; lz /= ln;
    var th = o.th || [0.9, 0.72, 0.42, 0.16];
    function hv(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? H[y * w + x] : 0; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      i = y * w + x; if (!m.d[i]) continue;
      var gx = (hv(x + 1, y) - hv(x - 1, y)) / 2, gy = (hv(x, y + 1) - hv(x, y - 1)) / 2;
      var nx = -gx, ny = -gy, nz = 1, nn = Math.hypot(nx, ny, nz);
      var I = (nx * lx + ny * ly + nz * lz) / nn;
      if (o.tb) I -= o.tb * clamp((y - o.y0) / (o.y1 - o.y0), 0, 1);
      var k = I > th[0] ? 4 : I > th[1] ? 3 : I > th[2] ? 2 : I > th[3] ? 1 : 0;
      if (o.rim !== false && !mGet(m, x, y - 1) && I > 0.62) k = Math.max(k, 3);
      if (o.off) k += o.off;
      if (o.max != null) k = Math.min(k, o.max);
      if (o.min != null) k = Math.max(k, o.min);
      T[i] = clamp(k, 0, 4);
    }
    // clean-up: a lone pixel whose 4 neighbours all agree on another tone takes that tone
    var T2 = T.slice();
    for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
      i = y * w + x; if (T[i] < 0) continue;
      var a = T[i - 1], b = T[i + 1], c = T[i - w], e = T[i + w];
      if (a >= 0 && a === b && b === c && c === e && a !== T[i]) T2[i] = a;
      else if (a >= 0 && a === b && c >= 0 && c === e && a === c && a !== T[i]) T2[i] = a;
    }
    return T2;
  }
  function shade2(b, m, R, o) {
    var T = toneMap(m, o);
    for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) { var k = T[y * m.w + x]; if (k >= 0) px(b, x, y, R[Math.min(R.length - 1, k)]); }
    return T;
  }
  function fill(b, m, c) { for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) if (m.d[y * m.w + x]) px(b, x, y, typeof c === 'function' ? c(x, y) : c); return b; }
  function layer(w, h) { return mk(w, h); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(x, y, s) { return hash(Math.floor(x), Math.floor(y), s); }

  // ======================================================================= shared tack palettes
  var TK = {
    L: ['#24140c', '#3e2414', '#5e3820', '#84522e', '#a87244'],            // saddle leather
    gold: ['#7a5220', '#b8862e', '#f2c45a', '#fff0b8'], silver: ['#4a4c66', '#8a8ea8', '#c8cce0', '#ffffff'],
    plum: ['#1e1236', '#33215c', '#4e3688', '#6e54b4', '#9a84d8'],          // quilted saddle pad
    lamp: ['#7a3a12', '#e8843c', '#ffbc62', '#fff1c8']
  };

  // ======================================================================= HORSES · B "Shire Giant"
  // A big-boned draught horse: arched crest, broad chest, feathered hooves, a long wavy mane and a
  // traveller's kit (quilted pad, brass-studded breast collar, saddlebags with a little lantern).
  var SH = {
    horse_midnight: { C: ['#100e1e', '#1e1a34', '#2e2a4c', '#43406a', '#5f5c8e'], M: ['#4a4a66', '#7a7c9a', '#b4b6cc', '#e6e8f4'], feather: ['#7a7c9a', '#b4b6cc', '#e6e8f4'],
      hoof: ['#14101e', '#2a2436'], blaze: '#e8eeff', eye: '#ffbc62', nose: '#2a2442' },
    horse_silver: { C: ['#55576e', '#7c8098', '#a2a6be', '#c8cbdc', '#eceef6'], M: ['#a8acc2', '#cfd2e2', '#eef0f8', '#ffffff'], feather: ['#c4c8da', '#e6e8f2', '#ffffff'],
      hoof: ['#3a3848', '#5a586a'], blaze: null, dapple: ['#8e92aa', '#b2b6ca'], eye: '#2a2238', nose: '#6a6c84' },
    horse_chestnut: { C: ['#3a1a0c', '#622e16', '#8c4420', '#b45e2e', '#d68646'], M: ['#2a120a', '#4a2010', '#6e3218', '#944824'], feather: ['#d8ccb8', '#f0e8da', '#ffffff'],
      hoof: ['#2a1810', '#4a3020'], blaze: '#f6efe2', eye: '#2a1810', nose: '#5a2a16' }
  };
  var SHG = { // trot: hoof [dx, lift] for [nearFore, farFore, nearHind, farHind]; body bob; mane/tail swing
    idle: [{ bob: 0, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], sw: 0, nod: 0 }, { bob: 0, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], sw: 1, nod: 1 }],
    walk: [{ bob: 0, legs: [[3, 0], [-2, 0], [-3, 0], [2, 0]], sw: 2, nod: 0 },
           { bob: -1, legs: [[1, 3], [0, 0], [0, 0], [-1, 3]], sw: 3, nod: -1 },
           { bob: 0, legs: [[-2, 0], [3, 0], [2, 0], [-3, 0]], sw: 2, nod: 0 },
           { bob: -1, legs: [[0, 0], [1, 3], [-1, 3], [0, 0]], sw: 3, nod: -1 }]
  };
  var SH_W = 60, SH_H = 42, SH_GY = 39, SH_AX = 30; // frame, ground row, centre (the seat)
  function off(pts, dx, dy) { var o = []; for (var i = 0; i < pts.length; i += 2) o.push(pts[i] + dx, pts[i + 1] + dy); return o; }
  // tapered limb through joints [[x, y], ...] with widths [w, ...]: quads between joints + round joints
  function mLimb(m, pts, ws) {
    for (var i = 0; i + 1 < pts.length; i++) {
      var a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      var ha = ws[i] / 2, hb = ws[i + 1] / 2;
      mPoly(m, [a[0] + nx * ha, a[1] + ny * ha, b[0] + nx * hb, b[1] + ny * hb, b[0] - nx * hb, b[1] - ny * hb, a[0] - nx * ha, a[1] - ny * ha]);
      if (i > 0) mEll(m, a[0], a[1], ha, ha);
    }
    return m;
  }
  // a draught leg seen from the side. fore: elbow -> knee -> fetlock; hind: stifle -> hock (juts back) -> fetlock.
  // hx = hoof x, lift = hoof height off the ground. Returns the fetlock point for the feathering.
  function shLeg(m, top, hx, lift, fore) {
    var gy = SH_GY - lift;
    if (fore) {
      var knee = [lerp(top[0], hx, 0.5) + (lift ? 1.6 : 0), top[1] + 5.2 - lift * 0.5];
      var fet = [hx - (lift ? 1.4 : 0), gy - 3.2];
      mLimb(m, [[top[0], top[1] - 2], [top[0] - 0.2, top[1] + 1], knee, fet], [5, 4.4, 3.2, 2.8]);
      return { fet: fet, gy: gy };
    }
    var hock = [lerp(top[0], hx, 0.45) - 1.8 - (lift ? 1.2 : 0), top[1] + 5.4 - lift * 0.6];
    var fet2 = [hx + (lift ? 0.8 : 0), gy - 3.2];
    mLimb(m, [[top[0] + 0.6, top[1] - 3], [top[0], top[1] + 1], hock, fet2], [6, 5, 3.2, 2.8]);
    return { fet: fet2, gy: gy };
  }
  // feathered hoof: a bell of silky hair over a broad hoof (dark rim at the ground)
  function shHoof(b, P, fet, gy, near) {
    var x = Math.round(fet[0]), F = P.feather, y = gy - 3;
    var rows = near ? ['.bc..', 'abbc.', 'abbcc', 'hhhhh'] : ['.bc.', 'bbcc', 'bbcc.', 'hhhhh'];
    spr(b, rows, { a: F[2], b: near ? F[1] : F[0], c: near ? F[0] : mix(F[0], '#120c1c', 0.25), h: near ? P.hoof[1] : P.hoof[0] }, x - 2, y);
  }
  function pline(b, pts, c) { for (var i = 0; i + 3 < pts.length; i += 2) line(b, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c); }
  // hand-pixelled parts: '1'-'5' coat ramp, 'a'-'d' mane ramp, 'k' eye, 'w' glint, 'n' nostril, 'x' blaze (or coat)
  function coatMap(P) {
    var C = P.C, Mn = P.M;
    return { 1: C[0], 2: C[1], 3: C[2], 4: C[3], 5: C[4], a: Mn[0], b: Mn[1], c: Mn[2], d: Mn[3], k: '#1a1426', w: '#ffffff', e: P.eye, n: P.nose, x: P.blaze || C[3] };
  }
  function part(b, S, map, dx, dy) { spr(b, S.rows, map, S.x + dx, S.y + dy); return b; }
  var SHS_BODY = { x: 12, y: 2, rows: [
    '.............................dc3.....',
    '............................dcb4.....',
    '............................dcb44....',
    '...........................dcbc44....',
    '...........................dcb443....',
    '..........................dcbc443....',
    '..........................dcb4433....',
    '.........................dcbc4433....',
    '.........................dcb443332...',
    '........................dcbc443332...',
    '........................dcb4433332...',
    '.......................dcbb44333322..',
    '.....455554............dcb443333322..',
    '...4555555544.........dcbb4433333322.',
    '..455444444444555544cbb443333333322..',
    '.4544433333334444444b44433333333322..',
    '45443333333333333333444333333333322..',
    '454333333333333333333344333333333322.',
    '4433333333333333333333334333333333322',
    '4433333333333333333333333433333333322',
    '343333333333333333333333334333333322.',
    '3433333222333333333333333334333322...',
    '.333332222233333333333333333333322...',
    '.2333322222222222222222222223333322..',
    '..233322.22222222222222222223333332..',
    '...33322..1111111111111111112333332..'
  ] };
  var SHS_HEAD = { x: 40, y: 0, rows: [
    '...4..5......',
    '..43.455.....',
    '..4344555....',
    '.34444x555...',
    '3344kw4x55...',
    '2334kk44x54..',
    '23333444x544.',
    '2233334444x4.',
    '.2223334444x4',
    '..222333344x4',
    '....2233344x4',
    '.....2233334n',
    '......1223333',
    '.......12233.',
    '........111..'
  ] };
  function shSide(P, g, back, front) {
    var C = P.C, Mn = P.M, oy = g.bob, Lg = g.legs, k, W = SH_W, Hh = SH_H, map = coatMap(P);
    var hy = oy + g.nod;
    // ---- far legs (one tone darker), behind the body
    var far = M(W, Hh), farL = layer(W, Hh);
    var fF = shLeg(far, [41.4, 27 + oy], 41.6 + Lg[1][0], Lg[1][1], true);
    var fH = shLeg(far, [19.6, 27 + oy], 19 + Lg[3][0], Lg[3][1], false);
    shade2(farL, far, C, { r: 1.5, off: -1 });
    shHoof(farL, P, fF.fet, fF.gy, false); shHoof(farL, P, fH.fet, fH.gy, false);
    over(back, farL, OL);
    // ---- tail: thick and wavy, falling almost to the hocks
    var sw = [0, 0.6, -0.8, -1.6][g.sw];
    var tm = M(W, Hh), tl = layer(W, Hh);
    mBez(tm, [[14.4, 16.4 + oy], [10.4 + sw * 0.4, 17.2 + oy], [9.2 + sw, 24 + oy], [10.6 + sw * 1.4, 31.6 + oy]], 2.5, 1.6);
    shade2(tl, tm, [Mn[0], Mn[0], Mn[1], Mn[2], Mn[3]], { r: 2 });
    for (k = 0; k < 5; k++) px(tl, lerp(10.8, 10.8 + sw * 1.2, k / 4) + (k % 2 ? 0.8 : 0), 20 + k * 2.4 + oy, k % 2 ? Mn[1] : Mn[0]);
    over(back, tl, OL);
    // ---- the near legs' upper parts, then the hand-pixelled body + neck over them
    var nl = M(W, Hh), nlL = layer(W, Hh);
    var nF = shLeg(nl, [43.6, 27 + oy], 43.8 + Lg[0][0], Lg[0][1], true);
    var nH = shLeg(nl, [17, 27 + oy], 16.4 + Lg[2][0], Lg[2][1], false);
    shade2(nlL, nl, C, { r: 1.6 });
    var bl = layer(W, Hh);
    part(bl, SHS_BODY, map, 0, oy);
    if (P.dapple) { var bm = M(W, Hh); mRows(bm, SHS_BODY.rows, SHS_BODY.x, SHS_BODY.y + oy); dapples(bl, bm, P, 13, 15 + oy, 47, 27 + oy); }
    over(back, bl, OL);
    over(back, nlL, C[0]);
    // ---- head (nods on its own), contoured against the neck
    var hd = layer(W, Hh); part(hd, SHS_HEAD, map, 0, hy);
    over(back, hd, OL);
    // ---- tack: bridle (cheekpiece, noseband, brass rosette), breast collar, quilted pad, saddle, saddlebag + lantern
    var tk = layer(W, Hh);
    line(tk, 43, 2.6 + hy, 47.6, 11.6 + hy, TK.L[1]); line(tk, 45.6, 8.4 + hy, 51.6, 8.4 + hy, TK.L[1]);
    px(tk, 44, 4.6 + hy, TK.gold[2]); px(tk, 48, 12 + hy, TK.silver[2]);
    pline(tk, off([36.6, 17.4, 41, 20.4, 45.8, 22.4], 0, oy), TK.L[2]); px(tk, 39, 19 + oy, TK.gold[3]); px(tk, 42, 21 + oy, TK.gold[2]); px(tk, 45, 22.2 + oy, TK.gold[2]);
    line(tk, 33.6, 18 + oy, 33.6, 27 + oy, TK.L[1]); px(tk, 33.6, 23 + oy, TK.silver[1]); // girth + buckle
    spr(tk, ['dpPPqPPqPPqPd', '.GgGgGgGgGgG.'], { d: TK.plum[1], p: TK.plum[2], P: TK.plum[3], q: TK.plum[2], G: TK.gold[2], g: TK.gold[1] }, 24, 16.6 + oy);
    spr(tk, ['L........lL', 'Ll......lLl', 'lLLLLLLLLLl', '.lllllllll.'], { l: TK.L[2], L: TK.L[3] }, 25, 13.6 + oy);
    spr(tk, ['bbbbb', 'BBBBb', 'BgBBb', 'bbbbb'], { b: TK.L[1], B: TK.L[3], g: TK.gold[2] }, 19, 16.6 + oy);
    var lsw = [0, 0, 1, 0][g.sw];
    px(tk, 21 + lsw * 0.5, 20.6 + oy, TK.gold[1]); spr(tk, ['.g.', 'gLg', 'glg', '.g.'], { g: TK.gold[1], L: TK.lamp[3], l: TK.lamp[2] }, 20 + lsw, 21.2 + oy);
    line(tk, 48, 12 + hy, 34, 11.6 + oy, TK.L[1]); // reins toward the rider's hands
    over(back, tk, OL);
    // feathered hooves on the near legs
    var hf = layer(W, Hh); shHoof(hf, P, nF.fet, nF.gy, true); shHoof(hf, P, nH.fet, nH.gy, true); over(back, hf, OL);
    // ---- front layer: the near saddle flap and stirrup over the rider's leg
    spr(front, ['LLLLLL', 'lLLLLL', 'llLLLl', '.llll.'], { l: TK.L[1], L: TK.L[2] }, 27, 17.6 + oy);
    line(front, 31, 21.6 + oy, 31, 22.6 + oy, TK.L[1]); rect(front, 30, 23.6 + oy, 3, 1, TK.silver[1]);
  }
  var SHD_HEAD = { x: 26, y: 16, rows: [
    '4.......4',
    '54.....45',
    '554ddd455',
    '.45dcd54.',
    'wk4dxc4wk',
    'kk44x44kk',
    '.3344433.',
    '.2344432.',
    '.2344432.',
    '.2344432.',
    '233444332',
    '234xxx432',
    '2n34443n2',
    '.2233322.',
    '..22222..'
  ] };
  var SHD_CHEST = { x: 21, y: 27, rows: [
    '..22333333333322..',
    '.2233333333333322.',
    '233333333333333322',
    '333333333333333322',
    '33333222222223332.',
    '.3332.......2332..'
  ] };
  var SHD_BARREL = { x: 20, y: 12, rows: [
    '......334443333......',
    '....3344444333333....',
    '..33444433333333332..',
    '.3444333333333333332.',
    '.3443333333333333332.',
    '344333333333333333322',
    '343333333333333333322',
    '333333333333333333322',
    '333333333333333333322',
    '.33333333333333333222',
    '.23333333333333333322',
    '..223333333333333222.',
    '....2222222222222....'
  ] };
  // feathered hoof seen from the front/back: a bell of silky hair over the hoof
  function shHoofF(b, P, cx, gy, near) {
    var F = P.feather, x = Math.round(cx) - 3;
    spr(b, near ? ['.abbc.', 'abbbcc', 'abbbcc', 'hhhhhh'] : ['.bbc.', 'bbbcc', 'hhhhh'], { a: F[2], b: near ? F[1] : F[0], c: near ? F[0] : mix(F[0], '#120c1c', 0.3), h: near ? P.hoof[1] : P.hoof[0] }, near ? x : x + 0.5, gy - (near ? 3 : 2));
  }
  // a straight draught leg seen from the front: thick forearm, knee, cannon (lift raises the hoof and shortens the leg)
  function shLegF(m, cx, top, lift) {
    var gy = SH_GY - lift;
    mLimb(m, [[cx, top], [cx, lerp(top, gy, 0.5) - lift * 0.3], [cx, gy - 2]], [5, 4, 3.4]);
    return gy;
  }
  function shDown(P, g, back, front) {
    var C = P.C, oy = g.bob, Lg = g.legs, W = SH_W, Hh = SH_H, map = coatMap(P);
    var hy = oy + g.nod;
    // ---- back layer: the far (hind) legs peeking out, the barrel and the saddle under the rider
    var hm = M(W, Hh), hl = layer(W, Hh);
    var ga = shLegF(hm, 26.6, 24 + oy, Lg[3][1] ? 2 : 0) - 3, gb = shLegF(hm, 33.4, 24 + oy, Lg[2][1] ? 2 : 0) - 3;
    shade2(hl, hm, C, { r: 1.6, off: -1 });
    shHoofF(hl, P, 26.6, ga, false); shHoofF(hl, P, 33.4, gb, false);
    over(back, hl, OL);
    var bl = layer(W, Hh); part(bl, SHD_BARREL, map, 0, oy);
    if (P.dapple) { var bm = M(W, Hh); mRows(bm, SHD_BARREL.rows, SHD_BARREL.x, SHD_BARREL.y + oy); dapples(bl, bm, P, 20, 13 + oy, 41, 25 + oy); }
    over(back, bl, OL);
    var tk = layer(W, Hh);
    spr(tk, ['pPPPPPPPPPPPp', 'GgGgGgGgGgGgG'], { p: TK.plum[1], P: TK.plum[3], G: TK.gold[2], g: TK.gold[1] }, 23.6, 15.4 + oy); // pad edge under the saddle
    spr(tk, ['lLLLLLLLLLl', 'lLLLLLLLLLl', '.lllllllll.'], { l: TK.L[2], L: TK.L[3] }, 24.6, 13 + oy);
    over(back, tk, OL);
    // ---- front layer: chest, the front legs, breast collar, then the long face looking at us
    var lm = M(W, Hh), ll = layer(W, Hh);
    var la = shLegF(lm, 24.6, 31 + oy, Lg[0][1]), lb = shLegF(lm, 35.4, 31 + oy, Lg[1][1]);
    shade2(ll, lm, C, { r: 1.8 });
    var fr = layer(W, Hh);
    over(fr, ll, OL);
    var ch = layer(W, Hh); part(ch, SHD_CHEST, map, 0, oy); over(fr, ch, OL);
    var hf = layer(W, Hh); shHoofF(hf, P, 24.6, la + 1, true); shHoofF(hf, P, 35.4, lb + 1, true); over(fr, hf, OL);
    var col = layer(W, Hh);
    pline(col, off([21.6, 29, 25, 30.6, 35, 30.6, 38.4, 29], 0, oy), TK.L[2]);
    px(col, 23, 29.8 + oy, TK.gold[2]); px(col, 37, 29.8 + oy, TK.gold[2]);
    over(fr, col, null);
    var hd = layer(W, Hh); part(hd, SHD_HEAD, map, 0, hy);
    line(hd, 27, 25.6 + hy, 33, 25.6 + hy, TK.L[1]); px(hd, 26.6, 25.6 + hy, TK.gold[2]); px(hd, 33.4, 25.6 + hy, TK.gold[2]); // noseband + brass rings
    over(fr, hd, OL);
    over(front, fr, null);
  }
  var SHU_RUMP = { x: 19, y: 18, rows: [
    '......34444433333......',
    '...3344555544333333....',
    '..344555554433333332...',
    '.34455555443333333332..',
    '.344555443333333333322.',
    '3445544333333333333322.',
    '3445443333333333333322.',
    '3444433333332333333222.',
    '3344333333322233333222.',
    '.333333333222223333322.',
    '.23333332222.22223332..',
    '..2233322.......22222..'
  ] };
  var SHU_NECK = { x: 26, y: 2, rows: [
    '.4....4.',
    '.54..45.',
    '.544445.',
    'd344444.',
    'dc34443.',
    'dc33332.',
    'dcc3332.',
    '.dc33332',
    '.dc33332',
    '..c333332'
  ] };
  function shUp(P, g, back, front) {
    var C = P.C, Mn = P.M, oy = g.bob, Lg = g.legs, W = SH_W, Hh = SH_H, map = coatMap(P), k;
    var hy = oy + g.nod;
    // ---- back layer: front legs far away, the neck + back of the head going away, barrel, saddle
    var fm = M(W, Hh), fl = layer(W, Hh);
    var ga = shLegF(fm, 26.4, 25 + oy, Lg[0][1] ? 2 : 0) - 3, gb = shLegF(fm, 33.6, 25 + oy, Lg[1][1] ? 2 : 0) - 3;
    shade2(fl, fm, C, { r: 1.6, off: -1 });
    shHoofF(fl, P, 26.4, ga, false); shHoofF(fl, P, 33.6, gb, false);
    over(back, fl, OL);
    var nk = layer(W, Hh); part(nk, SHU_NECK, map, 0, hy); over(back, nk, OL);
    var bl = layer(W, Hh); part(bl, SHD_BARREL, map, 0, oy);
    if (P.dapple) { var bm = M(W, Hh); mRows(bm, SHD_BARREL.rows, SHD_BARREL.x, SHD_BARREL.y + oy); dapples(bl, bm, P, 20, 13 + oy, 41, 25 + oy); }
    over(back, bl, OL);
    var tk = layer(W, Hh);
    spr(tk, ['pPPPPPPPPPPPp', 'GgGgGgGgGgGgG'], { p: TK.plum[1], P: TK.plum[3], G: TK.gold[2], g: TK.gold[1] }, 23.6, 16 + oy);
    spr(tk, ['.lllllllll.', 'lLLLLLLLLLl', 'lLLLLLLLLLl'], { l: TK.L[2], L: TK.L[3] }, 24.6, 13.4 + oy);
    spr(tk, ['bbb', 'BBb', 'Bgb', 'BBb', 'bbb'], { b: TK.L[1], B: TK.L[3], g: TK.gold[2] }, 18, 17.6 + oy);
    spr(tk, ['bbb', 'bBB', 'bgB', 'bBB', 'bbb'], { b: TK.L[1], B: TK.L[2], g: TK.gold[2] }, 39, 17.6 + oy);
    over(back, tk, OL);
    // ---- front layer: the hind legs, the broad round rump, a heavy tail, saddlebags + the lantern
    var lm = M(W, Hh), ll = layer(W, Hh);
    var la = shLegF(lm, 24, 27 + oy, Lg[2][1]), lb = shLegF(lm, 36, 27 + oy, Lg[3][1]);
    shade2(ll, lm, C, { r: 1.8 });
    var fr = layer(W, Hh);
    over(fr, ll, OL);
    var hf = layer(W, Hh); shHoofF(hf, P, 24, la + 1, true); shHoofF(hf, P, 36, lb + 1, true); over(fr, hf, OL);
    var rp = layer(W, Hh); part(rp, SHU_RUMP, map, 0, oy);
    if (P.dapple) { var rm = M(W, Hh); mRows(rm, SHU_RUMP.rows, SHU_RUMP.x, SHU_RUMP.y + oy); dapples(rp, rm, P, 20, 19 + oy, 41, 28 + oy); }
    over(fr, rp, OL);
    var sw = [0, 0.5, -0.5, -1][g.sw];
    var tm = M(W, Hh), tl = layer(W, Hh);
    mBez(tm, [[30, 18.4 + oy], [30, 22 + oy], [30 + sw, 27 + oy], [30 + sw * 2, 33.4 + oy]], 2.4, 1.8);
    shade2(tl, tm, [Mn[0], Mn[0], Mn[1], Mn[2], Mn[3]], { r: 2 });
    for (k = 0; k < 4; k++) { px(tl, 29.4 + sw * (k / 2), 22 + k * 3 + oy, Mn[1]); px(tl, 31 + sw * (k / 2), 23 + k * 3 + oy, Mn[1]); }
    over(fr, tl, OL);
    over(front, fr, null);
  }
  function dapples(b, m, P, x0, y0, x1, y1) { // round dapples: a lighter ring with a darker heart, on a jittered grid
    for (var gy = Math.floor(y0); gy < y1; gy += 3) for (var gx = Math.floor(x0) + ((gy / 3) % 2 ? 1 : 0); gx < x1; gx += 3) {
      var h = rnd(gx, gy, 17); if (h > 0.62) continue;
      var cx = gx + Math.floor(h * 3) % 2, cy = gy + 1;
      if (!mGet(m, cx, cy) || !mGet(m, cx, cy - 2) || !mGet(m, cx + 1, cy)) continue;
      px(b, cx, cy, P.dapple[0]); if (h < 0.3) px(b, cx + 1, cy, P.dapple[1]);
    }
  }
  function drawShire(P, anim, dir, f) {
    var g = SHG[anim][f], back = mk(SH_W, SH_H), front = mk(SH_W, SH_H);
    if (dir === 'down') shDown(P, g, back, front);
    else if (dir === 'up') shUp(P, g, back, front);
    else shSide(P, g, back, front);
    outline(back, OL); outline(front, OL);
    return { back: back, front: front };
  }

  // ======================================================================= HORSES · C "Starlit Courser"
  // A slender fae steed: long fine legs, an arched neck, a dished face with a big soft eye, and a mane and
  // tail of luminous starlit hair that stream and twinkle; dressed in a midnight silk cloth stitched with stars.
  var FC = {
    horse_midnight: { C: ['#0e0c1c', '#1c1834', '#2c2850', '#423e70', '#5e5a94'], H: ['#4a4a8c', '#7a78c0', '#b0acec', '#e8e6ff'], spark: ['#ffffff', '#fff3c4'],
      hoof: ['#2a2840', '#4a4866'], blaze: '#e8eeff', sock: null, eye: '#ffbc62', nose: '#2c2850' },
    horse_silver: { C: ['#5a5c74', '#8286a0', '#aaaec6', '#d0d3e4', '#f0f1f8'], H: ['#7ea2cc', '#a8c8ec', '#d8ecff', '#ffffff'], spark: ['#ffffff', '#d8f4ff'],
      hoof: ['#4a4c62', '#6a6c84'], blaze: null, sock: null, dapple: ['#9498b2', '#bcc0d4'], eye: '#2a2238', nose: '#6a6c84' },
    horse_chestnut: { C: ['#401c0c', '#6c3218', '#9a4a22', '#c46a30', '#e6924e'], H: ['#b0501c', '#e8802e', '#ffb850', '#ffe8a8'], spark: ['#ffffff', '#fff4c8'],
      hoof: ['#3a2418', '#5a3a28'], blaze: '#f6efe2', sock: '#f2e8d8', eye: '#2a1810', nose: '#5a2a16' }
  };
  var SILK = ['#100e2c', '#1c1a4c', '#2c2876', '#433ea4'], STAR = ['#8a90c0', '#cdd2f0', '#ffffff'];
  var FCG = { // canter with a moment of suspension: hoof [dx, lift] for [nearFore, farFore, nearHind, farHind]
    idle: [{ bob: 0, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], ph: 0, nod: 0 }, { bob: 0, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], ph: 1, nod: 1 }],
    walk: [{ bob: 0, legs: [[-3, 0], [-1, 0], [3, 2], [5, 0]], ph: 0, nod: 0 },
           { bob: -1, legs: [[3, 3], [1, 0], [0, 0], [-2, 2]], ph: 1, nod: -1 },
           { bob: -2, legs: [[5, 2], [4, 3], [-4, 2], [-3, 3]], ph: 2, nod: 0 },
           { bob: -1, legs: [[1, 0], [3, 2], [-2, 3], [1, 2]], ph: 3, nod: 1 }]
  };
  var FC_W = 48, FC_H = 42, FC_GY = 38, FC_AX = 24;
    var FCS_BODY = { x: 12, y: 4, rows: [
      '......................445..',
      '.....................44443.',
      '....................4443332',
      '...................4443332.',
      '...................443332..',
      '..................4443322..',
      '..................443332...',
      '..................443332...',
      '.................4443322...',
      '.................4433322...',
      '.................44433322..',
      '...4554.........54433332...',
      '.45555544444455544333332...',
      '455443333334444433333332...',
      '45433333333333333333333....',
      '44333333333333333333332....',
      '34333333333333333333322....',
      '33333332233333333333322....',
      '.33332222233333333333322...',
      '.2333222222222222223332....',
      '..23322...11111111123332...',
      '...332.............2332....',
      '...332..............22.....'
    ] };
    var FCS_HEAD = { x: 34, y: 1, rows: [
    '...4.5....',
    '..43.45...',
    '..434455..',
    '.34445x5..',
    '34kw445x..',
    '33kk444x..',
    '2333444x..',
    '.2333444x.',
    '..223344x4',
    '...2233344',
    '....22334n',
    '.....2233.',
    '......12..'
  ] };
  var FCD_FACE = { x: 21, y: 15, rows: [
    '4.....4',
    '54...45',
    '5545455',
    '.44544.',
    'wk4x4wk',
    'kk4x4kk',
    '.34x43.',
    '.34x43.',
    '.23x32.',
    '.23x32.',
    '.33x33.',
    'n34443n',
    '.23332.',
    '..222..'
  ] };
  var FCD_CHEST = { x: 19, y: 25, rows: [
    '..2333332..',
    '.233333332.',
    '23333333332',
    '3333333332.',
    '333322332..',
    '.332...232.'
  ] };
  var FCD_BARREL = { x: 15, y: 12, rows: [
    '.....3344433.....',
    '...33444433333...',
    '..3444333333332..',
    '.344333333333332.',
    '34433333333333322',
    '34333333333333322',
    '33333333333333322',
    '.3333333333333322',
    '.233333333333332.',
    '..2233333333322..',
    '....222222222....'
  ] };
  var FCU_RUMP = { x: 16, y: 17, rows: [
    '....34444333....',
    '..33445544333...',
    '.3445554433332..',
    '344554433333332.',
    '344543333333322.',
    '3444333323333322',
    '3343333222333322',
    '.3333322.2233322',
    '.23332.....2332.',
    '..222.......22..'
  ] };
  var FCU_NECK = { x: 20, y: 1, rows: [
    '.4...4.',
    '.54.45.',
    '.54445.',
    '.34443.',
    '..3443.',
    '..3332.',
    '..3332.',
    '.33332.'
  ] };
  // fine legs: fore = elbow -> knee -> fetlock; hind = stifle -> hock -> fetlock; neat small hooves
  function fcLeg(m, top, hx, lift, fore) {
    var gy = FC_GY - lift;
    if (fore) {
      var kn = [lerp(top[0], hx, 0.5) + (lift > 1 ? 2.2 : lift ? 1 : 0), lerp(top[1], gy, 0.48) - lift * 0.6];
      var ft = [hx - (lift > 1 ? 1.6 : 0), gy - 1.6];
      mLimb(m, [[top[0], top[1] - 1.5], kn, ft], [3.4, 2.2, 1.8]);
      return { ft: ft, gy: gy };
    }
    var hk = [lerp(top[0], hx, 0.4) - 2 - (lift ? 0.8 : 0), lerp(top[1], gy, 0.45) - lift * 0.4];
    var ft2 = [hx + (lift > 1 ? 1 : 0), gy - 1.6];
    mLimb(m, [[top[0] + 0.5, top[1] - 2.5], [top[0], top[1] + 1.5], hk, ft2], [5, 3.6, 2.2, 1.8]);
    return { ft: ft2, gy: gy };
  }
  function fcHoof(b, P, ft, gy, near, sock) {
    var x = Math.round(ft[0]);
    if (sock) { px(b, x, gy - 2, sock); px(b, x - 1, gy - 1, sock); px(b, x, gy - 1, sock); }
    rect(b, x - 1, gy, 3, 1, P.hoof[near ? 1 : 0]); px(b, x + 1, gy, P.hoof[0]);
  }
  // luminous hair: ribbons [{ p: [[x, y], ...], w0, w1 }, ...] merged into one shape, shaded with the hair ramp,
  // darker strand lines along each ribbon and a few twinkling sparkles
  function hair(b, rib, P, seed, nSpark) {
    var m = M(b.w, b.h), i, k;
    for (i = 0; i < rib.length; i++) mTube(m, rib[i].p, rib[i].w0, rib[i].w1);
    var l = layer(b.w, b.h); shade2(l, m, [P.H[0], P.H[1], P.H[2], P.H[3], P.H[3]], { r: 2, lz: 0.9 });
    for (i = 0; i < rib.length; i++) { var q = rib[i].p; if (rib[i].w0 < 1.2) continue; for (k = 2; k < q.length - 1; k += 1) if (k % 3 === (i % 3)) px(l, q[k][0] + 0.5, q[k][1] + 0.5, P.H[1]); }
    var ns = 0;
    for (k = 0; k < 60 && ns < nSpark; k++) {
      var rr = rib[Math.floor(hash(k, seed, 4) * rib.length)].p, qq = rr[Math.floor(hash(k, seed, 5) * rr.length)];
      var X = Math.floor(qq[0] + 0.5), Y = Math.floor(qq[1] + 0.5);
      if (mGet(m, X, Y) && mGet(m, X - 1, Y) && mGet(m, X + 1, Y)) { px(l, X, Y, P.spark[k % 2]); ns++; }
    }
    return l;
  }
  function wave(a, b2, t, amp, ph) { var o = []; for (var i = 0; i <= 10; i++) { var u = i / 10; o.push([lerp(a[0], b2[0], u) + Math.sin(u * 3.2 + ph) * amp * u, lerp(a[1], b2[1], u) + Math.cos(u * 2.6 + ph) * amp * 0.5 * u]); } return o; }
  function fcSide(P, g, back, front) {
    var C = P.C, oy = g.bob, Lg = g.legs, k, W = FC_W, Hh = FC_H, map = coatMap({ C: C, M: [P.H[0], P.H[1], P.H[2], P.H[3]], eye: P.eye, nose: P.nose, blaze: P.blaze });
    var hy = oy + g.nod * 0.6, run = g.ph !== undefined && Lg[0][1] + Lg[1][1] + Lg[2][1] + Lg[3][1] > 0, ph = g.ph;
    // ---- far legs + far hair strands
    var far = M(W, Hh), farL = layer(W, Hh);
    var fF = fcLeg(far, [31.6, 24 + oy], 31.6 + Lg[1][0], Lg[1][1], true), fH = fcLeg(far, [17.6, 24 + oy], 17.2 + Lg[3][0], Lg[3][1], false);
    shade2(farL, far, C, { r: 1.2, off: -1 });
    fcHoof(farL, P, fF.ft, fF.gy, false, null); fcHoof(farL, P, fH.ft, fH.gy, false, null);
    over(back, farL, OL);
    // ---- tail: a high plume arching up from the croup and streaming back
    var ts = run ? [0.6, 1.4, 2, 1.2][ph] : [0, 0.8][ph];
    var tpts = bezPts([[13.4, 16.6 + oy], [8.6, 12.4 + oy - ts], [3.4 + ts * 0.4, 15 + oy - ts * 0.6], [2.4 - ts * 0.3, 25 + oy - ts * 2.2]], 12);
    over(back, hair(back, [{ p: tpts, w0: 2.4, w1: 1.2 }], P, 3 + ph, 3), OL);
    // ---- legs (upper parts) + body + neck
    var nl = M(W, Hh), nlL = layer(W, Hh);
    var nF = fcLeg(nl, [33.4, 24 + oy], 33.6 + Lg[0][0], Lg[0][1], true), nH = fcLeg(nl, [15.6, 24 + oy], 15.2 + Lg[2][0], Lg[2][1], false);
    shade2(nlL, nl, C, { r: 1.3 });
    var bl = layer(W, Hh); part(bl, FCS_BODY, map, 0, oy);
    if (P.dapple) { var bm = M(W, Hh); mRows(bm, FCS_BODY.rows, FCS_BODY.x, FCS_BODY.y + oy); dapples(bl, bm, P, 13, 16 + oy, 36, 23 + oy); }
    over(back, bl, OL);
    over(back, nlL, C[0]);
    var hf = layer(W, Hh); fcHoof(hf, P, nF.ft, nF.gy, true, P.sock); fcHoof(hf, P, nH.ft, nH.gy, true, P.sock); over(back, hf, OL);
    // ---- mane: luminous locks from the crest falling over the near side of the arched neck (streaming back as it runs)
    var ms = run ? [1, 1.8, 2.6, 1.8][ph] : [0, 0.5][ph];
    var rib = [{ p: [[35.6, 3.6 + hy], [34.6, 5 + hy], [33.4, 7 + oy], [32.4, 9.4 + oy], [31.6, 11.8 + oy], [30.4, 14.2 + oy]], w0: 1.3, w1: 1.1 }]; // the crest
    var locks = [[33.6, 7.4], [32.6, 9.6], [31.8, 12]];
    for (k = 0; k < locks.length; k++) {
      var L0 = [locks[k][0], locks[k][1] + oy], len = [4, 4, 3][k];
      rib.push({ p: wave(L0, [L0[0] + 0.8 - ms * (0.6 + k * 0.3), L0[1] + len - ms * 0.4], 0, 0.6, k * 1.7 + ph), w0: 1.2, w1: 0.6 });
    }
    over(back, hair(back, rib, P, 20 + ph, 2), OL);
    // ---- head over the mane, with a silver bridle and a crescent charm on the brow
    var hd = layer(W, Hh); part(hd, FCS_HEAD, map, 0, hy + 1);
    line(hd, 40, 9.2 + hy, 42.6, 9.2 + hy, SILK[1]); px(hd, 40, 9.2 + hy, STAR[1]);
    spr(hd, ['.c', 'cC'], { c: STAR[1], C: STAR[2] }, 37.6, 4 + hy);
    over(back, hd, OL);
    over(back, hair(back, [{ p: wave([37, 3.6 + hy], [37.8, 6.2 + hy], 0, 0.4, ph), w0: 0.9, w1: 0.5 }], P, 77 + ph, 1), OL); // forelock
    // ---- silk saddle cloth with a scalloped, star-stitched hem; a small saddle; silver breastplate with a crescent
    var tk = layer(W, Hh);
    spr(tk, ['ssssssssssss', 'sSSSSSSSSSSs', 'sSSaSSSSaSSs', 'sSSSSSSSSSSs', 'sSaSSSSSSaSs', 'sSSSSSSSSSSs', '.t.t.t.t.t.t'],
      { s: SILK[1], S: SILK[2], a: STAR[1], t: STAR[0] }, 18, 16 + oy);
    spr(tk, ['l.......lL', 'Ll.....lLl', 'lLLLLLLLLl', '.llllllll.'], { l: TK.L[1], L: TK.L[2] }, 20, 13.6 + oy);
    pline(tk, off([30, 17, 33.6, 19.6, 36.4, 19.6], 0, oy), STAR[0]); spr(tk, ['.c', 'cC', '.c'], { c: STAR[1], C: STAR[2] }, 34.4, 18.6 + oy);
    line(tk, 40, 10.4 + hy, 28.4, 11.6 + oy, SILK[1]); // reins
    over(back, tk, OL);
    // ---- front layer: the near flap of the silk over the rider's leg, a silver stirrup
    spr(front, ['SSSSS', 'sSSSS', 'saSSs', '.ssS.'], { s: SILK[1], S: SILK[2], a: STAR[1] }, 21, 18 + oy);
    line(front, 25, 22 + oy, 25, 23 + oy, STAR[0]); rect(front, 24, 24 + oy, 3, 1, STAR[1]);
  }
  // a fine leg seen from the front/back (lift raises the hoof)
  function fcLegF(m, cx, top, lift) { var gy = FC_GY - lift; mLimb(m, [[cx, top], [cx, lerp(top, gy, 0.5) - lift * 0.3], [cx, gy - 1]], [3, 2.2, 2]); return gy; }
  function fcHoofF(b, P, cx, gy, near, sock) { var x = Math.round(cx) - 1; if (sock) rect(b, x, gy - 2, 2, 2, sock); rect(b, x, gy, 2, 1, P.hoof[near ? 1 : 0]); }
  function fcMapOf(P) { return coatMap({ C: P.C, M: [P.H[0], P.H[1], P.H[2], P.H[3]], eye: P.eye, nose: P.nose, blaze: P.blaze }); }
  // the silk cloth hanging down one side, seen from the front/back (scalloped, star-stitched hem); s = -1 left, 1 right
  function silkSide(b, x, y, s, n) {
    var rows = ['ss', 'sS', 'sS', 'aS', 'sS', 'sS', 'sa', 'sS', 't.'];
    spr(b, rows, { s: SILK[1], S: SILK[s < 0 ? 3 : 2], a: STAR[1], t: STAR[0] }, x, y, s > 0);
  }
  function fcDown(P, g, back, front) {
    var C = P.C, oy = g.bob, Lg = g.legs, W = FC_W, Hh = FC_H, map = fcMapOf(P), ph = g.ph, k;
    var hy = oy + g.nod * 0.6, run = Lg[0][1] + Lg[1][1] + Lg[2][1] + Lg[3][1] > 0;
    var hm = M(W, Hh), hl = layer(W, Hh);
    var ga = fcLegF(hm, 21.6, 23 + oy, Lg[3][1] ? 2 : 0) - 3, gb = fcLegF(hm, 26.4, 23 + oy, Lg[2][1] ? 2 : 0) - 3;
    shade2(hl, hm, C, { r: 1.2, off: -1 }); fcHoofF(hl, P, 21.6, ga, false, null); fcHoofF(hl, P, 26.4, gb, false, null);
    over(back, hl, OL);
    var bl = layer(W, Hh); part(bl, FCD_BARREL, map, 0, oy);
    if (P.dapple) { var bm = M(W, Hh); mRows(bm, FCD_BARREL.rows, FCD_BARREL.x, FCD_BARREL.y + oy); dapples(bl, bm, P, 16.0, 13 + oy, 32.0, 22 + oy); }
    over(back, bl, OL);
    var tk = layer(W, Hh);
    silkSide(tk, 15, 17 + oy, -1); silkSide(tk, 31, 17 + oy, 1);
    spr(tk, ['lLLLLLLLl', 'lLLLLLLLl', '.lllllll.'], { l: TK.L[1], L: TK.L[2] }, 19.6, 13 + oy);
    over(back, tk, OL);
    // ---- front layer: fine front legs, slim chest + silver breastplate, luminous mane locks, the refined face
    var lm = M(W, Hh), ll = layer(W, Hh);
    var la = fcLegF(lm, 20.6, 27 + oy, Lg[0][1]), lb = fcLegF(lm, 27.4, 27 + oy, Lg[1][1]);
    shade2(ll, lm, C, { r: 1.3 });
    var fr = layer(W, Hh); over(fr, ll, OL);
    var hf = layer(W, Hh); fcHoofF(hf, P, 20.6, la, true, P.sock); fcHoofF(hf, P, 27.4, lb, true, P.sock); over(fr, hf, OL);
    var ch = layer(W, Hh); part(ch, FCD_CHEST, map, 0, oy); over(fr, ch, OL);
    var bp = layer(W, Hh); pline(bp, off([19.6, 26.6, 22, 28.4, 26, 28.4, 28.4, 26.6], 0, oy), STAR[0]); spr(bp, ['c.c', '.C.'], { c: STAR[1], C: STAR[2] }, 23.0, 28.6 + oy); over(fr, bp, null);
    var ms = run ? [0.6, 1.2, 1.6, 1.2][ph] : [0, 0.5][ph];
    var rib = [{ p: wave([22.4, 16 + hy], [19.4 - ms, 23 + oy], 0, 0.6, ph), w0: 1.5, w1: 0.8 }, { p: wave([25.6, 16 + hy], [28.4 + ms * 0.6, 22 + oy], 0, 0.6, ph + 1), w0: 1.4, w1: 0.8 },
      { p: wave([22.8, 18 + hy], [20.4 - ms, 25 + oy], 0, 0.5, ph + 2), w0: 1.2, w1: 0.7 }];
    over(fr, hair(fr, rib, P, 40 + ph, 2), OL);
    var hd = layer(W, Hh); part(hd, FCD_FACE, map, 0, hy);
    line(hd, 22.0, 24.6 + hy, 26.0, 24.6 + hy, SILK[1]); px(hd, 21.4, 24.6 + hy, STAR[1]); px(hd, 26.6, 24.6 + hy, STAR[1]);
    over(fr, hd, OL);
    over(fr, hair(fr, [{ p: wave([24.0, 16 + hy], [24.4, 20 + hy], 0, 0.4, ph), w0: 1.1, w1: 0.6 }], P, 50 + ph, 1), OL); // forelock
    spr(fr, ['.c.', 'cCc'], { c: STAR[1], C: STAR[2] }, 23.0, 14.6 + hy); // crescent charm
    over(front, fr, null);
  }
  function fcUp(P, g, back, front) {
    var C = P.C, oy = g.bob, Lg = g.legs, W = FC_W, Hh = FC_H, map = fcMapOf(P), ph = g.ph, k;
    var hy = oy + g.nod * 0.6, run = Lg[0][1] + Lg[1][1] + Lg[2][1] + Lg[3][1] > 0;
    var fm = M(W, Hh), fl = layer(W, Hh);
    var ga = fcLegF(fm, 21.6, 23 + oy, Lg[0][1] ? 2 : 0) - 3, gb = fcLegF(fm, 26.4, 23 + oy, Lg[1][1] ? 2 : 0) - 3;
    shade2(fl, fm, C, { r: 1.2, off: -1 }); fcHoofF(fl, P, 21.6, ga, false, null); fcHoofF(fl, P, 26.4, gb, false, null);
    over(back, fl, OL);
    var nk = layer(W, Hh); part(nk, FCU_NECK, map, 0, hy); over(back, nk, OL);
    var ms = run ? [0.6, 1.2, 1.6, 1.2][ph] : [0, 0.5][ph];
    over(back, hair(back, [{ p: wave([22.0, 3 + hy], [19.6 - ms, 11 + oy], 0, 0.6, ph), w0: 1.5, w1: 0.9 }, { p: wave([22.6, 6 + hy], [20.0 - ms, 13 + oy], 0, 0.5, ph + 1), w0: 1.3, w1: 0.8 }], P, 60 + ph, 2), OL);
    var bl = layer(W, Hh); part(bl, FCD_BARREL, map, 0, oy);
    if (P.dapple) { var bm = M(W, Hh); mRows(bm, FCD_BARREL.rows, FCD_BARREL.x, FCD_BARREL.y + oy); dapples(bl, bm, P, 16.0, 13 + oy, 32.0, 22 + oy); }
    over(back, bl, OL);
    var tk = layer(W, Hh);
    silkSide(tk, 15, 17 + oy, -1); silkSide(tk, 31, 17 + oy, 1);
    spr(tk, ['.lllllll.', 'lLLLLLLLl', 'lLLLLLLLl'], { l: TK.L[1], L: TK.L[2] }, 19.6, 13 + oy);
    over(back, tk, OL);
    // ---- front layer: long hind legs, the slim rump and the plume of starlit tail cascading over it
    var lm = M(W, Hh), ll = layer(W, Hh);
    var la = fcLegF(lm, 20.0, 25 + oy, Lg[2][1]), lb = fcLegF(lm, 28.0, 25 + oy, Lg[3][1]);
    shade2(ll, lm, C, { r: 1.3 });
    var fr = layer(W, Hh); over(fr, ll, OL);
    var hf = layer(W, Hh); fcHoofF(hf, P, 20.0, la, true, P.sock); fcHoofF(hf, P, 28.0, lb, true, P.sock); over(fr, hf, OL);
    var rp = layer(W, Hh); part(rp, FCU_RUMP, map, 0, oy);
    if (P.dapple) { var rm = M(W, Hh); mRows(rm, FCU_RUMP.rows, FCU_RUMP.x, FCU_RUMP.y + oy); dapples(rp, rm, P, 17.0, 18 + oy, 31.0, 25 + oy); }
    over(fr, rp, OL);
    var ts = run ? [0.6, 1.2, 1.8, 1.2][ph] : [0, 0.6][ph];
    var tp = bezPts([[24, 18 + oy], [24.4, 12.6 + oy - ts], [27.6 + ts * 0.4, 14 + oy], [27.0 + ts, 29 + oy - ts]], 12);
    over(fr, hair(fr, [{ p: tp, w0: 2.2, w1: 1.1 }], P, 70 + ph, 3), OL);
    over(front, fr, null);
  }
  function drawCourser(P, anim, dir, f) {
    var g = FCG[anim][f], back = mk(FC_W, FC_H), front = mk(FC_W, FC_H);
    if (dir === 'down') fcDown(P, g, back, front);
    else if (dir === 'up') fcUp(P, g, back, front);
    else fcSide(P, g, back, front);
    outline(back, OL); outline(front, OL);
    return { back: back, front: front };
  }
  ['horse_midnight', 'horse_silver', 'horse_chestnut'].forEach(function (id) {
    K.defMount(id + '__c', { w: FC_W, h: FC_H, ax: FC_AX, ay: 39, seat: { x: FC_AX, y: 15 }, anims: { idle: 2, walk: 4 }, fps: { idle: 2, walk: 9 },
      seatDy: { idle: [0, 0], walk: [0, -1, -2, -1] }, base: 'idle', draw: function (anim, dir, f) { return drawCourser(FC[id], anim, dir, f); } });
  });

  ['horse_midnight', 'horse_silver', 'horse_chestnut'].forEach(function (id) {
    K.defMount(id + '__b', { w: SH_W, h: SH_H, ax: SH_AX, ay: 40, seat: { x: SH_AX, y: 15 }, anims: { idle: 2, walk: 4 }, fps: { idle: 2, walk: 8 },
      seatDy: { idle: [0, 0], walk: [0, -1, 0, -1] }, base: 'idle', draw: function (anim, dir, f) { return drawShire(SH[id], anim, dir, f); } });
  });

  // ======================================================================= DRAGONS · B "Elder Drake"
  // The majestic one: a big western dragon three rider-heights long, a long S-curved neck, a horned head
  // carried high, a war saddle at the base of the neck, vast bat wings and a spade-tipped tail.
  var ED = {
    dragon_amethyst: { S: ['#1a1030', '#2e2052', '#4a3682', '#6c56b0', '#9680dc'], belly: ['#8a74b8', '#b49ad8', '#e2d4fa'], spine: ['#bba4ea', '#f0e6ff'], horn: ['#6e6250', '#b8aa88', '#ece2c4'],
      W: ['#221a4e', '#38307c', '#5450aa', '#7c78d0'], eye: ['#ffbc62', '#fff1c8'], tack: TK.plum },
    dragon_emerald: { S: ['#081a14', '#123228', '#1c4e3a', '#2a7052', '#45986c'], belly: ['#6ea47a', '#9cc890', '#d4f0c4'], spine: ['#6ee0a8', '#d8fff0'], horn: ['#6e6250', '#b8aa88', '#ece2c4'],
      W: ['#0c2a2a', '#164644', '#226660', '#3a8c80'], eye: ['#ffd27a', '#fff6d8'], tack: ['#3a1018', '#5a1a24', '#7e2a32', '#a8403e', '#c86a5a'] },
    dragon_ember: { S: ['#240a08', '#4a1410', '#7a2416', '#b04220', '#e07434'], belly: ['#c47a34', '#e8a050', '#ffdc9a'], spine: ['#ffbc62', '#fff1c8'], horn: ['#2e2422', '#5a4a44', '#8e7a6e'],
      W: ['#3a0e14', '#64182a', '#922a36', '#c4504a'], eye: ['#fff1c8', '#ffffff'], tack: ['#141026', '#22203e', '#34305a', '#4c4880', '#6a66a8'] }
  };
  var EDS_HEAD = [ // majestic head in profile: brow over a glowing eye, swept horn, overhanging upper jaw, fangs
    'jH....................',
    '.jHH..................',
    '..jHHh................',
    '...jHhhh..............',
    '....jHhhh45...........',
    '...ssj3445554.........',
    '..ss34455555554.......',
    '.ss33334kE3344444.....',
    'ss333333333444444444..',
    '.s23333333333444444n4.',
    '..s2333333333333333332',
    '...22o222222222t2t22..',
    '....2222222222222.....',
    '....22bbbbbbbbb2......',
    '......11111111........'
  ];
  var EDD_FACE = [ // the drake looking at us: brows over glowing eyes, horns sweeping up and out, cheek frills, fangs
    'h..................h',
    'hH................Hh',
    '.hH..............Hh.',
    '.jHh............hHj.',
    '..jHh5444..4445hHj..',
    '...jH55554455555Hj..',
    '..ss4kkE4444kkE4ss..',
    '.ss3344444444444433s',
    '..s3344455555444332.',
    '...334445555544433..',
    '...23344444444433...',
    '....2334n4444n432...',
    '....t23333333332t...',
    '.....22222222222....',
    '......2bbbbbbb2.....',
    '.......1111111......'
  ];
  var ED_W = 88, ED_H = 72, ED_GY = 69, ED_AX = 44;
  function edMap(P) { var S = P.S; return { 1: S[0], 2: S[1], 3: S[2], 4: S[3], 5: S[4], h: P.horn[2], H: P.horn[1], j: P.horn[0], k: '#140c1c', e: P.eye[0], E: P.eye[1], t: '#fff6e8', b: P.belly[1], B: P.belly[2], s: P.spine[0], S: P.spine[1], o: OL, n: S[0] }; }
  // a small dorsal plate at (x, y) pointing along (nx, ny)
  function plate(b, x, y, nx, ny, P) { px(b, x, y, P.spine[0]); px(b, x + nx, y + ny, P.spine[0]); px(b, x + nx * 2, y + ny * 2, P.spine[1]); px(b, x - ny * 0.8, y + nx * 0.8, P.spine[0]); }
  // wing poses (relative to the shoulder): wrist, finger tips [3], for idle-folded and the 4 flight frames
  var EDW = [
    { wr: [-6, -20], tips: [[-24, -27], [-33, -17], [-27, -5]] },  // up
    { wr: [-11, -9], tips: [[-34, -13], [-38, -3], [-27, 4]] },    // mid, sweeping down
    { wr: [-7, 5], tips: [[-20, 21], [-29, 15], [-30, 6]] },       // down
    { wr: [-11, -11], tips: [[-33, -16], [-37, -6], [-28, 1]] }    // mid, rising
  ];
  // membrane between the arm and the fingers, bones on top, a thumb claw at the wrist
  function edWing(b, P, sx, sy, pose, far, hip) {
    var Wc = P.W, d = far ? 1 : 0, wr = [sx + pose.wr[0] + d * 2, sy + pose.wr[1] - d * 2];
    var tips = pose.tips.map(function (t) { return [sx + t[0] + d * 4, sy + t[1] - d * 2]; });
    var mm = M(b.w, b.h), i;
    var pts = [sx, sy, wr[0], wr[1], tips[0][0], tips[0][1]];
    for (i = 0; i < 2; i++) { // scalloped trailing edge between the finger tips
      var a = tips[i], c = tips[i + 1], mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, vx = wr[0] - mx, vy = wr[1] - my, vl = Math.hypot(vx, vy) || 1;
      pts.push(mx + vx / vl * 3.4, my + vy / vl * 3.4, c[0], c[1]);
    }
    var lm = [(tips[2][0] + hip[0]) / 2, (tips[2][1] + hip[1]) / 2], hv = [wr[0] - lm[0], wr[1] - lm[1]], hl = Math.hypot(hv[0], hv[1]) || 1;
    pts.push(lm[0] + hv[0] / hl * 3, lm[1] + hv[1] / hl * 3, hip[0], hip[1]);
    mPoly(mm, pts);
    var l = layer(b.w, b.h);
    shade2(l, mm, far ? [Wc[0], Wc[0], Wc[0], Wc[1], Wc[1]] : [Wc[0], Wc[1], Wc[2], Wc[3], Wc[3]], { r: 3, lz: 0.85 });
    // bones: arm (thick), fingers; the leading edge lit
    var bc = far ? P.S[1] : P.S[3], bc2 = far ? P.S[0] : P.S[2];
    line(l, sx, sy, wr[0], wr[1], bc); line(l, sx, sy + 1, wr[0], wr[1] + 1, bc2); line(l, sx + 1, sy, wr[0] + 1, wr[1], bc2);
    for (i = 0; i < 3; i++) line(l, wr[0], wr[1], tips[i][0], tips[i][1], far ? P.S[1] : P.S[2]);
    px(l, wr[0], wr[1] - 1, P.horn[2]); px(l, wr[0] + 1, wr[1] - 1, P.horn[1]); // thumb claw
    return l;
  }
  function edSide(P, fly, f, back, front) {
    var S = P.S, Bl = P.belly, k, W = ED_W, Hh = ED_H;
    var rz = fly ? 4 + [0, 1, 2, 1][f] : 0, br = fly ? 0 : f; // lift in the frame; idle breath
    var Y = function (y) { return y - rz; };
    var hx = fly ? 2 : 0, hyy = fly ? 4 : -br * 0.5; // the head stretches forward and a little lower in flight
    // ---- far wing (behind everything)
    var sh = [37, Y(37)];
    if (fly) over(back, edWing(back, P, sh[0] + 2, sh[1] - 1, EDW[f], true, [24, Y(44)]), OL);
    else { var fw = M(W, Hh); mPoly(fw, [40, Y(38.6), 33.6, Y(30.4), 19, Y(39), 25, Y(42.6)]); var fwl = layer(W, Hh); shade2(fwl, fw, [P.W[0], P.W[0], P.W[0], P.W[1], P.W[1]], { r: 2 }); over(back, fwl, OL); }
    // ---- far legs
    var fl = M(W, Hh), fll = layer(W, Hh);
    if (!fly) {
      mLimb(fl, [[50, Y(52)], [48.6, Y(58)], [50.6, 64], [50, 67.6]], [6, 4.4, 3.4, 3]);
      mLimb(fl, [[29, Y(52)], [30.6, Y(58)], [33.4, 63.6], [31, 67.6]], [7, 4.6, 3.4, 3]);
    } else {
      mLimb(fl, [[50, Y(52)], [53, Y(57)], [50, Y(60)]], [5, 3.6, 3]);
      mLimb(fl, [[29, Y(52)], [24, Y(56)], [18, Y(57)]], [6, 3.6, 3]);
    }
    shade2(fll, fl, S, { r: 1.6, off: -1 });
    if (!fly) { spr(fll, ['c.c.c'], { c: P.horn[0] }, 47.6, 68.4); spr(fll, ['c.c.c'], { c: P.horn[0] }, 28.6, 68.4); }
    over(back, fll, OL);
    // ---- tail: long and tapering, curling up at the end into a spade
    var ts = fly ? Math.sin(f * Math.PI / 2) * 2.5 : br * 0.8;
    var tP = fly ? [[28, Y(45)], [16, Y(46) + ts * 0.3], [8, Y(44) - ts], [1.6, Y(38) + ts * 0.6]] : [[28, 45], [17, 47.6], [8, 57 - ts * 0.3], [3, 51.6 - ts]];
    var tm = M(W, Hh); mBez(tm, tP, 6, 1.6);
    var tl = layer(W, Hh); var TT = shade2(tl, tm, S, { r: 3 });
    var tq = bezPts(tP, 16);
    for (k = 2; k < 15; k += 2) { var a0 = tq[k], a1 = tq[k + 1], nx0 = a1[1] - a0[1], ny0 = -(a1[0] - a0[0]), nl0 = Math.hypot(nx0, ny0) || 1, rr = lerp(5.4, 1.4, k / 16);
      // belly plates on the underside, spines on top
      px(tl, a0[0] - nx0 / nl0 * (rr - 1), a0[1] - ny0 / nl0 * (rr - 1), Bl[1]);
      if (k % 4 === 2) { px(tl, a0[0] + nx0 / nl0 * (rr + 0.6), a0[1] + ny0 / nl0 * (rr + 0.6), P.spine[0]); px(tl, a0[0] + nx0 / nl0 * (rr + 1.6), a0[1] + ny0 / nl0 * (rr + 1.6), P.spine[1]); }
    }
    var tip = tq[16], tdir = [tq[16][0] - tq[14][0], tq[16][1] - tq[14][1]], tdl = Math.hypot(tdir[0], tdir[1]) || 1; tdir = [tdir[0] / tdl, tdir[1] / tdl];
    var tn = [-tdir[1], tdir[0]], spd = M(W, Hh);
    mPoly(spd, [tip[0] - tdir[0] * 1.5, tip[1] - tdir[1] * 1.5, tip[0] + tn[0] * 4 + tdir[0], tip[1] + tn[1] * 4 + tdir[1], tip[0] + tdir[0] * 6, tip[1] + tdir[1] * 6, tip[0] - tn[0] * 4 + tdir[0], tip[1] - tn[1] * 4 + tdir[1]]);
    var spl = layer(W, Hh); shade2(spl, spd, [P.W[0], P.W[1], P.W[2], P.W[3], P.spine[1]], { r: 1.5 }); line(spl, tip[0], tip[1], tip[0] + tdir[0] * 4, tip[1] + tdir[1] * 4, P.spine[0]);
    over(tl, spl, OL);
    over(back, tl, OL);
    // ---- body: haunch, belly, deep chest; the long neck
    var bd = M(W, Hh);
    mEll(bd, 31, Y(47), 8, 8.4); mEll(bd, 42, Y(49.6), 11.6, 7.4); mEll(bd, 52.6, Y(47.6), 8.4, 8.6);
    var nP = [[52, Y(43)], [58 + hx * 0.5, Y(36) + hyy * 0.3], [56.6 + hx, Y(26) + hyy * 0.6], [62 + hx, Y(21) + hyy]];
    mBez(bd, nP, 6.4, 3.6);
    var bl = layer(W, Hh); shade2(bl, bd, S, { r: 5, tb: 0.1, y0: Y(38), y1: Y(58) });
    // belly plates (banded) along the underside of the neck, chest and belly
    for (var y = Math.round(Y(51)); y <= Math.round(Y(58)); y++) for (var x = 36; x <= 58; x++) if (mGet(bd, x, y) && !mGet(bd, x, y + 2)) px(bl, x, y, (x + y) % 4 ? Bl[1] : Bl[0]);
    var nq = bezPts(nP, 12);
    for (k = 1; k < 12; k++) { var p0 = nq[k], p1 = nq[k + 1], nnx = p1[1] - p0[1], nny = -(p1[0] - p0[0]), nnl = Math.hypot(nnx, nny) || 1, r2 = lerp(6.4, 3.6, k / 12);
      px(bl, p0[0] - nnx / nnl * (r2 - 1.2), p0[1] - nny / nnl * (r2 - 1.2), k % 2 ? Bl[1] : Bl[2]); px(bl, p0[0] - nnx / nnl * (r2 - 0.4), p0[1] - nny / nnl * (r2 - 0.4), Bl[0]);
      if (k % 3 === 0 && k > 1) plate(bl, p0[0] + nnx / nnl * (r2 - 0.2), p0[1] + nny / nnl * (r2 - 0.2), Math.round(nnx / nnl), Math.round(nny / nnl), P); }
    // back spines behind the saddle
    [[34, 39.6], [29.6, 39.2], [25, 40.2]].forEach(function (q) { plate(bl, q[0], Y(q[1]), 0, -1, P); });
    over(back, bl, OL);
    // ---- head: the far horn behind, then the hand-pixelled head
    var hX = 60 + hx, hY = Y(12) + hyy, hh = layer(W, Hh);
    pline(hh, [hX + 7, hY + 5, hX + 4, hY + 2, hX + 1, hY, hX - 2, hY - 1.4], P.horn[0]); pline(hh, [hX + 7, hY + 6, hX + 4, hY + 3, hX + 1, hY + 1], P.horn[0]);
    over(back, hh, OL);
    var hl2 = layer(W, Hh); spr(hl2, EDS_HEAD, edMap(P), hX, hY);
    over(back, hl2, OL);
    // ---- legs (near)
    var nl = M(W, Hh), nll = layer(W, Hh);
    if (!fly) {
      mEll(nl, 31.6, Y(52), 5.6, 6.4); mLimb(nl, [[32, Y(55)], [35, 62.6], [33, 67.6]], [6, 4, 3.4]);
      mEll(nl, 53.4, Y(52.4), 4.4, 5); mLimb(nl, [[53, Y(54)], [51.6, Y(59)], [54, 64.6], [53, 67.6]], [6, 4.6, 3.6, 3.2]);
    } else {
      mEll(nl, 31.6, Y(52), 5.6, 6.4); mLimb(nl, [[32, Y(55)], [26.6, Y(59)], [20.6, Y(60)]], [6, 4, 3.2]);
      mEll(nl, 53.4, Y(52.4), 4.4, 5); mLimb(nl, [[53, Y(55)], [56.6, Y(59.6)], [53.6, Y(62.4)]], [5.4, 3.8, 3]);
    }
    shade2(nll, nl, S, { r: 2.2 });
    if (!fly) { spr(nll, ['c.c.c'], { c: P.horn[2] }, 30.6, 68.4); spr(nll, ['c.c.c'], { c: P.horn[2] }, 51, 68.4); }
    else { spr(nll, ['cc', 'c.'], { c: P.horn[2] }, 18.4, Y(59.4)); spr(nll, ['c.', 'cc'], { c: P.horn[2] }, 52, Y(62)); }
    over(back, nll, S[0]);
    // ---- the war saddle at the base of the neck, with a chest harness
    var tk = layer(W, Hh), T = P.tack;
    spr(tk, ['l..........L', 'Ll........Ll', 'LLlllllllLLl', 'lLLLLLLLLLLl', 'tttttttttttt', 'tTTTTTTTTTTt', '.gGgGgGgGgG.'],
      { l: TK.L[2], L: TK.L[3], t: T[1], T: T[3], g: TK.gold[1], G: TK.gold[2] }, 38, Y(36.4));
    line(tk, 49, Y(42.6), 49, Y(56.4), TK.L[1]); px(tk, 49, Y(49), TK.gold[2]); // girth
    pline(tk, [50, Y(40), 54, Y(44), 58.6, Y(46)], TK.L[2]); px(tk, 54, Y(44), TK.gold[3]);
    over(back, tk, OL);
    // ---- near wing: folded along the flank when landed, beating in flight (in front, behind the rider's back)
    if (fly) over(front, edWing(front, P, sh[0], sh[1], EDW[f], false, [26, Y(46)]), OL);
    else {
      var nw = M(W, Hh); mPoly(nw, [41.6, Y(40.4), 35.4, Y(31), 20.4, Y(40.2), 22, Y(45), 30, Y(47.6), 38.6, Y(46)]);
      var nwl = layer(W, Hh); shade2(nwl, nw, [P.W[0], P.W[1], P.W[2], P.W[3], P.W[3]], { r: 2.4 });
      line(nwl, 41.6, Y(40.4), 35.4, Y(31), S[3]); line(nwl, 42, Y(41.4), 36, Y(32), S[2]); line(nwl, 35.4, Y(31), 20.4, Y(40.2), S[2]); line(nwl, 35.4, Y(31), 23.6, Y(45.4), S[2]); line(nwl, 35.4, Y(31), 30.4, Y(47), S[2]);
      px(nwl, 35.4, Y(30), P.horn[2]); px(nwl, 36.4, Y(30), P.horn[1]);
      over(front, nwl, OL);
    }
    // the near stirrup + saddle flap over the rider's leg
    spr(front, ['LLLLL', 'lLLLL', 'llLLl', '.lll.'], { l: TK.L[1], L: TK.L[2] }, 42, Y(41.4));
    line(front, 45, Y(45.4), 45, Y(46.4), TK.L[1]); rect(front, 44, Y(47.4), 3, 1, TK.iron || TK.silver[1]);
  }
  // a wing seen from the front/back, spread to one side (sd = -1 left, 1 right); pose 0..3 = up, down-sweep, down, rising
  function edWingF(b, P, sd, sx, sy, f, far) {
    var lift = [-22, -6, 14, -8][f], spread = [38, 41, 34, 40][f], Wc = P.W, up = f === 0;
    var wr = [44 + sd * (up ? 16 : 19), sy + lift * 0.62], t1 = [44 + sd * spread, sy + lift - 5], t2 = [44 + sd * (spread + 3), sy + lift + (up ? 9 : 6)], t3 = [44 + sd * (spread - (up ? 4 : 9)), sy + lift + (up ? 22 : 14)];
    t1[0] = clamp(t1[0], 1, 86); t2[0] = clamp(t2[0], 1, 86); t1[1] = Math.max(1, t1[1]);
    var mm = M(b.w, b.h);
    var mid = function (a, c, k) { var mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, vx = wr[0] - mx, vy = wr[1] - my, vl = Math.hypot(vx, vy) || 1; return [mx + vx / vl * k, my + vy / vl * k]; };
    var m1 = mid(t1, t2, 3), m2 = mid(t2, t3, 3), hip = [sx + sd * 2, sy + 10], m3 = mid(t3, hip, 3);
    mPoly(mm, [sx, sy, wr[0], wr[1], t1[0], t1[1], m1[0], m1[1], t2[0], t2[1], m2[0], m2[1], t3[0], t3[1], m3[0], m3[1], hip[0], hip[1]]);
    var l = layer(b.w, b.h);
    shade2(l, mm, sd < 0 ? [Wc[0], Wc[1], Wc[2], Wc[3], Wc[3]] : [Wc[0], Wc[0], Wc[1], Wc[2], Wc[3]], { r: 3, lz: 0.85 });
    line(l, sx, sy, wr[0], wr[1], P.S[3]); line(l, sx, sy + 1, wr[0], wr[1] + 1, P.S[2]);
    line(l, wr[0], wr[1], t1[0], t1[1], P.S[2]); line(l, wr[0], wr[1], t2[0], t2[1], P.S[2]); line(l, wr[0], wr[1], t3[0], t3[1], P.S[2]);
    px(l, wr[0], wr[1] - 1, P.horn[2]);
    return l;
  }
  function edFolded(b, P, sd, Y) { // a folded wing rising beside the rider's shoulders (front/back views)
    var mm = M(b.w, b.h), x0 = 44 + sd * 8, pk = [44 + sd * 15, Y(23)], lo = [44 + sd * 17, Y(46)], lo2 = [44 + sd * 10, Y(47)];
    mPoly(mm, [x0, Y(36), pk[0], pk[1], pk[0] + sd * 3, Y(30), lo[0], lo[1], lo2[0], lo2[1]]);
    var l = layer(b.w, b.h); shade2(l, mm, sd < 0 ? [P.W[0], P.W[1], P.W[2], P.W[3], P.W[3]] : [P.W[0], P.W[0], P.W[1], P.W[2], P.W[3]], { r: 2.2 });
    line(l, x0, Y(36), pk[0], pk[1], P.S[3]); line(l, pk[0], pk[1], lo[0], lo[1], P.S[2]); line(l, pk[0], pk[1], lo2[0] + sd * 3, lo2[1], P.S[2]);
    px(l, pk[0], pk[1] - 1, P.horn[2]);
    return l;
  }
  function edDown(P, fly, f, back, front) {
    var S = P.S, Bl = P.belly, W = ED_W, Hh = ED_H, k;
    var rz = fly ? 4 + [0, 1, 2, 1][f] : 0, br = fly ? 0 : f;
    var Y = function (y) { return y - rz; };
    // ---- back layer: wings, hind legs, the barrel, saddle
    for (var sd = -1; sd <= 1; sd += 2) {
      if (fly) over(back, edWingF(back, P, sd, 44 + sd * 7, Y(37), f), OL);
      else over(back, edFolded(back, P, sd, Y), OL);
    }
    var hm = M(W, Hh), hl = layer(W, Hh);
    if (!fly) { mLimb(hm, [[33, Y(50)], [32, Y(58)], [32.4, 65.6]], [6, 4.4, 3.6]); mLimb(hm, [[55, Y(50)], [56, Y(58)], [55.6, 65.6]], [6, 4.4, 3.6]); }
    else { mLimb(hm, [[33, Y(50)], [31, Y(56)], [32, Y(60)]], [6, 4.2, 3.2]); mLimb(hm, [[55, Y(50)], [57, Y(56)], [56, Y(60)]], [6, 4.2, 3.2]); }
    shade2(hl, hm, S, { r: 1.8, off: -1 });
    if (!fly) { spr(hl, ['c.c'], { c: P.horn[0] }, 31, 66.4); spr(hl, ['c.c'], { c: P.horn[0] }, 55, 66.4); }
    over(back, hl, OL);
    var bm = M(W, Hh); mEll(bm, 44, Y(44.6), 14.4, 9.4);
    var bl = layer(W, Hh); shade2(bl, bm, S, { r: 5 });
    [[36, 37.4], [52, 37.4]].forEach(function (q) { plate(bl, q[0], Y(q[1]), 0, -1, P); });
    over(back, bl, OL);
    var tk = layer(W, Hh), T = P.tack;
    spr(tk, ['ltttttttttl', 'lTTTTTTTTTl', 'gGgGgGgGgGg'], { l: TK.L[2], t: T[1], T: T[3], g: TK.gold[1], G: TK.gold[2] }, 38.6, Y(37.6));
    spr(tk, ['LLLLLLLLL', 'lllllllll'], { l: TK.L[2], L: TK.L[3] }, 39.6, Y(35.6));
    over(back, tk, OL);
    // ---- front layer: front legs, chest, the neck dipping forward to the head, and the face
    var fr = layer(W, Hh);
    var lm = M(W, Hh), ll = layer(W, Hh);
    if (!fly) { mLimb(lm, [[36, Y(52)], [35.4, Y(60)], [35.6, 67.4]], [7, 5, 4]); mLimb(lm, [[52, Y(52)], [52.6, Y(60)], [52.4, 67.4]], [7, 5, 4]); }
    else { mLimb(lm, [[36, Y(52)], [34, Y(57)], [36, Y(61)]], [6, 4.4, 3.4]); mLimb(lm, [[52, Y(52)], [54, Y(57)], [52, Y(61)]], [6, 4.4, 3.4]); }
    shade2(ll, lm, S, { r: 2 });
    if (!fly) { spr(ll, ['c.c.c'], { c: P.horn[2] }, 33.6, 68.4); spr(ll, ['c.c.c'], { c: P.horn[2] }, 50.4, 68.4); }
    else { spr(ll, ['c.c'], { c: P.horn[2] }, 35, Y(62)); spr(ll, ['c.c'], { c: P.horn[2] }, 51, Y(62)); }
    over(fr, ll, OL);
    var cm = M(W, Hh); mEll(cm, 44, Y(52.6), 11, 7.6);
    var cl = layer(W, Hh); shade2(cl, cm, S, { r: 4 });
    for (var y = Math.round(Y(49)); y <= Math.round(Y(59)); y++) for (var x = 40; x <= 48; x++) if (mGet(cm, x, y) && (x + y) % 3) px(cl, x, y, y % 2 ? Bl[1] : Bl[0]);
    over(fr, cl, OL);
    var nm = M(W, Hh); mBez(nm, [[44, Y(43)], [44, Y(45)], [44, Y(47) - br * 0.4], [44, Y(49) - br * 0.4]], 4.4, 4.4);
    var nl = layer(W, Hh); shade2(nl, nm, S, { r: 3, off: -1, min: 1 });
    for (k = 0; k < 3; k++) { rect(nl, 42, Y(42 + k * 2.2) - br * 0.2, 5, 1, k % 2 ? Bl[1] : Bl[2]); }
    over(fr, nl, OL);
    var hd = layer(W, Hh); spr(hd, EDD_FACE, edMap(P), 34, Y(46) - br * 0.5);
    over(fr, hd, OL);
    over(front, fr, null);
  }
  var EDU_HEAD = [ // the back of the head, horns sweeping back toward us
    '..h..........h..',
    '..hH........Hh..',
    '...hH......Hh...',
    '...jHh5445hHj...',
    '...sj455554js...',
    '..ss34555543ss..',
    '...s33444433s...',
    '....23333332....',
    '.....222222.....'
  ];
  function edUp(P, fly, f, back, front) {
    var S = P.S, Bl = P.belly, W = ED_W, Hh = ED_H, k;
    var rz = fly ? 4 + [0, 1, 2, 1][f] : 0, br = fly ? 0 : f;
    var Y = function (y) { return y - rz; };
    // ---- back layer: the neck rising away to the head (above the rider), wings, front legs, barrel, saddle
    var nm = M(W, Hh); mBez(nm, [[44, Y(36)], [44, Y(28)], [44, Y(22)], [44, Y(16)]], 5.6, 4);
    var nl = layer(W, Hh); shade2(nl, nm, S, { r: 3 });
    for (k = 0; k < 4; k++) plate(nl, 44, Y(31 - k * 4.6), 0, -1, P);
    over(back, nl, OL);
    var hd = layer(W, Hh); spr(hd, EDU_HEAD, edMap(P), 36, Y(8) - br * 0.5); over(back, hd, OL);
    for (var sd = -1; sd <= 1; sd += 2) {
      if (fly) over(back, edWingF(back, P, sd, 44 + sd * 7, Y(38), f), OL);
      else over(back, edFolded(back, P, sd, Y), OL);
    }
    var fm = M(W, Hh), fl = layer(W, Hh);
    if (!fly) { mLimb(fm, [[36, Y(48)], [35.6, Y(56)], [35.6, 65.6]], [6, 4.4, 3.6]); mLimb(fm, [[52, Y(48)], [52.4, Y(56)], [52.4, 65.6]], [6, 4.4, 3.6]); }
    else { mLimb(fm, [[36, Y(48)], [34.4, Y(54)], [36, Y(58)]], [5.4, 4, 3]); mLimb(fm, [[52, Y(48)], [53.6, Y(54)], [52, Y(58)]], [5.4, 4, 3]); }
    shade2(fl, fm, S, { r: 1.8, off: -1 });
    over(back, fl, OL);
    var bm = M(W, Hh); mEll(bm, 44, Y(43.6), 14.4, 9.4);
    var bl = layer(W, Hh); shade2(bl, bm, S, { r: 5 });
    over(back, bl, OL);
    var tk = layer(W, Hh), T = P.tack;
    spr(tk, ['gGgGgGgGgGg', 'ltttttttttl', 'lTTTTTTTTTl'], { l: TK.L[2], t: T[1], T: T[3], g: TK.gold[1], G: TK.gold[2] }, 38.6, Y(37.6));
    spr(tk, ['lllllllll', 'LLLLLLLLL'], { l: TK.L[2], L: TK.L[3] }, 39.6, Y(36));
    over(back, tk, OL);
    // ---- front layer: haunches + hind legs, the spined back, and the tail coming toward us, curling into a spade
    var fr = layer(W, Hh);
    var lm = M(W, Hh), ll = layer(W, Hh);
    mEll(lm, 34.4, Y(51), 6.4, 7); mEll(lm, 53.6, Y(51), 6.4, 7);
    if (!fly) { mLimb(lm, [[33.6, Y(55)], [33, Y(61)], [33.4, 67.6]], [6.4, 4.6, 4]); mLimb(lm, [[54.4, Y(55)], [55, Y(61)], [54.6, 67.6]], [6.4, 4.6, 4]); }
    else { mLimb(lm, [[33.6, Y(55)], [31, Y(60)], [30, Y(64)]], [6, 4.4, 3.4]); mLimb(lm, [[54.4, Y(55)], [57, Y(60)], [58, Y(64)]], [6, 4.4, 3.4]); }
    var LL = shade2(ll, lm, S, { r: 2.6 });
    if (!fly) { spr(ll, ['c.c.c'], { c: P.horn[2] }, 31.4, 68.4); spr(ll, ['c.c.c'], { c: P.horn[2] }, 52.6, 68.4); }
    over(fr, ll, OL);
    var ts = fly ? Math.sin(f * Math.PI / 2) * 2 : br;
    var tP = [[44, Y(46)], [44, Y(56)], [48 + ts, fly ? Y(66) : 66], [58 + ts * 1.5, fly ? Y(64) : 63.6]];
    var tm = M(W, Hh); mBez(tm, tP, 5.4, 1.8);
    var tl = layer(W, Hh); shade2(tl, tm, S, { r: 3 });
    var tq = bezPts(tP, 14);
    for (k = 1; k < 13; k += 3) plate(tl, tq[k][0], tq[k][1] - lerp(4.4, 1.6, k / 14), 0, -1, P);
    var tip = tq[14], td = [tq[14][0] - tq[12][0], tq[14][1] - tq[12][1]], tdl = Math.hypot(td[0], td[1]) || 1; td = [td[0] / tdl, td[1] / tdl];
    var tn = [-td[1], td[0]], spd = M(W, Hh);
    mPoly(spd, [tip[0] - td[0] * 1.5, tip[1] - td[1] * 1.5, tip[0] + tn[0] * 4 + td[0], tip[1] + tn[1] * 4 + td[1], tip[0] + td[0] * 6, tip[1] + td[1] * 6, tip[0] - tn[0] * 4 + td[0], tip[1] - tn[1] * 4 + td[1]]);
    var spl = layer(W, Hh); shade2(spl, spd, [P.W[0], P.W[1], P.W[2], P.W[3], P.spine[1]], { r: 1.5 }); line(spl, tip[0], tip[1], tip[0] + td[0] * 4, tip[1] + td[1] * 4, P.spine[0]);
    over(tl, spl, OL);
    over(fr, tl, OL);
    over(front, fr, null);
  }
  function drawDrake(P, anim, dir, f) {
    var fly = anim === 'fly', back = mk(ED_W, ED_H), front = mk(ED_W, ED_H);
    if (dir === 'down') edDown(P, fly, f, back, front);
    else if (dir === 'up') edUp(P, fly, f, back, front);
    else edSide(P, fly, f, back, front);
    outline(back, OL); outline(front, OL);
    return { back: back, front: front };
  }
  ['dragon_amethyst', 'dragon_emerald', 'dragon_ember'].forEach(function (id) {
    K.defMount(id + '__b', { w: ED_W, h: ED_H, ax: ED_AX, ay: 70, seat: { x: ED_AX, y: 37 }, anims: { idle: 2, fly: 4 }, fps: { idle: 2, fly: 7 },
      seatDy: { idle: [0, 0], fly: [-4, -5, -6, -5] }, base: 'idle', draw: function (anim, dir, f) { return drawDrake(ED[id], anim, dir, f); } });
  });
})();
