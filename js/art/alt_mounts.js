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
  ['horse_midnight', 'horse_silver', 'horse_chestnut'].forEach(function (id) {
    K.defMount(id + '__b', { w: SH_W, h: SH_H, ax: SH_AX, ay: 40, seat: { x: SH_AX, y: 15 }, anims: { idle: 2, walk: 4 }, fps: { idle: 2, walk: 8 },
      seatDy: { idle: [0, 0], walk: [0, -1, 0, -1] }, base: 'idle', draw: function (anim, dir, f) { return drawShire(SH[id], anim, dir, f); } });
  });
})();
