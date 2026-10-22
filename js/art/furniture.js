/*
 * NIGHTVALE — FurnitureArt  (js/art/furniture.js)
 * ---------------------------------------------------------------------------
 * Procedural 1x pixel art for every placeable piece of furniture / interior decor
 * (furn_*): the player's cottage, and reusable in the tavern, the boutique and the
 * cathedral. 3/4 top-down view facing the viewer, light from the top-left, 1px
 * selective outlines (#120c1c on the shadow side, a dark tint of the material on
 * the lit side). Everything is drawn pixel by pixel into small RGBA buffers
 * (no canvas paths, no anti-aliasing), deterministic (seeded hash only) and cached.
 *
 * Classic script / IIFE — defines exactly one global: window.FurnitureArt.
 * In node (no `document`) the same API hands back raw {w, h, data} buffers and
 * FurnitureArt._raw.sprite / _raw.icon always return raw buffers.
 *
 *   FurnitureArt.list    [{ id, name, w, h, wall, flat, light, price, seller }]
 *       w, h   footprint in 16px tiles
 *       wall   hangs on the back wall (paintings, clocks, tapestry)
 *       flat   drawn under everything else (rugs)
 *       light  null, or { x, y, r, color:[r,g,b] } — x, y in PIXELS FROM THE TOP-LEFT OF
 *              THE SPRITE CANVAS (the glowing core), r = suggested radius in world pixels.
 *              World position = sprite draw position + (x, y).
 *       price  glimmer; seller one of 'brann','isolde','mirabel','fennick','orvyn','depths',
 *              or 'reward' (crafted, or given by a quest or milestone; never sold)
 *   FurnitureArt.sprite(id)  canvas, width = w*16, height = h*16 + headroom (tall pieces).
 *       Bottom-anchored: the bottom-left of the footprint is the bottom-left of the canvas,
 *       i.e. draw at (tileX*16, (tileY + h)*16 - canvas.height).
 *       Standing pieces carry a soft translucent contact shadow inside their footprint;
 *       glowing parts are drawn as bright cores (the engine adds the halo from `light`).
 *       Wall pieces: draw on the back-wall tile row the same way (bottom-anchored).
 *   FurnitureArt.icon(id)    16x16 inventory icon (a miniature).
 *   FurnitureArt.ids         every id, in list order.
 *   FurnitureArt.has(id), FurnitureArt.info(id) (the list entry or null).
 * Unknown ids give a small placeholder crate (sprite 16x16, icon 16x16); nothing throws.
 *
 * Cat bed + Inkwell: draw the cat's 16x16 sleep frame at the cat-bed sprite's draw
 * position + (0, -3) (its bottom row lands on sprite row 12) so the plush front of the
 * bed shows beneath the curled-up cat.
 */
(function () {
  'use strict';

  var ROOT = (typeof window !== 'undefined') ? window
    : (typeof globalThis !== 'undefined') ? globalThis : {};

  // ===========================================================================
  // Palette — "Twilight Hollow" (DESIGN.md §2) + furniture ramps (dark -> light)
  // ===========================================================================
  var OUT = '#120c1c';
  var WHITE = '#ffffff';
  var CANDLE = '#fff1c8';
  var DW = ['#170e17', '#25151f', '#37202b', '#4c2d35', '#653e42', '#82564e'];   // dark plum-walnut
  var OAK = ['#2b1a1c', '#4e2e25', '#774a30', '#9d683a', '#c28b4c', '#e0b06a'];  // honey oak
  var WD = ['#281d21', '#3e2d2b', '#574039', '#7a5a48', '#9c7a5e', '#b8977a'];   // palette wood
  var PLV = ['#1d0c20', '#37152f', '#531f47', '#722c5f', '#934279', '#b66597'];  // plum velvet
  var VIO = ['#1a1134', '#2b1c50', '#422c76', '#5d419d', '#7e61c3', '#a688e2'];  // deep violet cloth
  var QLT = ['#0f0d2a', '#1a1844', '#252660', '#31357c', '#424a98', '#5a66b4'];  // midnight indigo
  var NAV = ['#0b0f27', '#131a42', '#1b275f', '#25367c', '#324d9a', '#4d6cbd'];  // navy
  var GLD = ['#3c2420', '#7a4e2c', '#b47a34', '#e0aa48', '#f6d27a', '#fff1c8'];  // gold
  var BRS = ['#2f2019', '#5e3f24', '#906a32', '#c09846', '#e6c66c', '#fff0b4'];  // brass
  var IRN = ['#120c1c', '#1c1628', '#2a2238', '#3c324e', '#564a6a', '#776a8e'];  // wrought iron
  var SLV = ['#3a406c', '#5c689c', '#8a9aca', '#bac9ea', '#e2eaff', '#ffffff'];  // moon silver
  var CRM = ['#7a6876', '#a6929a', '#d0c0be', '#eadcd4', '#faf2e8', '#ffffff'];  // cream (wax)
  var LIN = ['#55507a', '#8680a8', '#b4aed2', '#d8d4ec', '#f2f0fb', '#ffffff'];  // cool linen
  var STR = ['#3e2a1c', '#6a4a26', '#9a7434', '#c49c48', '#e2c470', '#f4e2a0'];  // straw
  var LEAF = ['#0e2a26', '#173f32', '#225640', '#2f704e', '#468c5c', '#6cae6a', '#9fd184'];
  var TC = ['#2c1418', '#55232a', '#843838', '#ad5540', '#cd7a52', '#e8a272'];   // terracotta
  var WCR = ['#38344e', '#666486', '#9a98b6', '#c4c2da', '#e4e2f0', '#faf9ff'];  // white ceramic
  var BN = ['#3a3242', '#6a6072', '#a0969c', '#cac0b8', '#e8e0d4', '#fffaf0'];   // bone
  var STN = ['#2d2c3e', '#45445a', '#605f78', '#7e7d97', '#a09fb6', '#c4c3d6'];  // stone (cool)
  var EMG = ['#0d3a2e', '#18684a', '#2fbf7f', '#5dffb0', '#b4ffd9', '#ffffff'];  // emerald glow
  var VLG = ['#24134a', '#4a2f7a', '#8f6cd1', '#b99aee', '#e4d2ff', '#ffffff'];  // violet glow
  var RSE = ['#3e1532', '#8c3a62', '#c4648e', '#e89ab8', '#fbd6e6', '#ffffff'];  // rose
  var FIR = ['#4a1626', '#8a2a32', '#c44a3a', '#e8843c', '#ffbc62', '#fff1c8'];  // fire
  var TEAL = ['#14343a', '#22625e', '#3c9688', '#6cc8b0', '#aeeedc', '#e6fff6'];
  var PAP = ['#4e3e48', '#7e6a6a', '#ae9682', '#d4bf9e', '#ecdcbc', '#fbf3e0'];  // parchment
  var SKY = ['#0b0c22', '#121638', '#1b2152', '#28306c', '#3a4588', '#5462a6'];
  var OWL = ['#1e1218', '#3a2226', '#5c3a34', '#82563f', '#a87a54', '#d0a676'];  // owl plumage
  var VOID = ['#0c0814', '#1c1030', '#34185a', '#5e2a8a', '#9a4ac8', '#e0a8ff'];
  var AMB = ['#5a2a1a', '#a8582a', '#e8843c', '#ffbc62', '#ffe0a0', '#fff6dc'];  // amber glass

  // light colours handed to the engine
  var L_WARM = [255, 186, 104], L_CANDLE = [255, 206, 140], L_VIOLET = [172, 118, 255],
    L_EMERALD = [84, 240, 164], L_MOON = [190, 206, 255], L_ROSE = [236, 140, 200];

  // ===========================================================================
  // Colour helpers
  // ===========================================================================
  var _cc = Object.create(null);
  function rgba(c) {
    if (c == null) return null;
    if (typeof c !== 'string') return c;
    var v = _cc[c];
    if (v) return v;
    var h = c.charAt(0) === '#' ? c.slice(1) : c;
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
      h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255];
    _cc[c] = v;
    return v;
  }
  function h2(n) { n = Math.max(0, Math.min(255, Math.round(n))); return (n < 16 ? '0' : '') + n.toString(16); }
  function hex(r, g, b, a) { return '#' + h2(r) + h2(g) + h2(b) + (a != null && a < 255 ? h2(a) : ''); }
  function mix(a, b, t) {
    var P = rgba(a), Q = rgba(b);
    return hex(P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t, P[2] + (Q[2] - P[2]) * t);
  }
  function alpha(c, a) { var P = rgba(c); return hex(P[0], P[1], P[2], Math.round(a * 255)); }
  function dk(c, t) { return mix(c, OUT, t); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // deterministic hash noise in [0,1)
  function hash(x, y, s) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 7, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ===========================================================================
  // Raster toolkit (integer pixel coordinates)
  // ===========================================================================
  function img(w, h) { return { w: w, h: h, data: new Uint8ClampedArray(w * h * 4) }; }
  function A(im, x, y) { return (x >= 0 && y >= 0 && x < im.w && y < im.h) ? im.data[(y * im.w + x) * 4 + 3] : 0; }
  function solid(im, x, y) { return A(im, x, y) >= 128; }
  function get(im, x, y) {
    if (x < 0 || y < 0 || x >= im.w || y >= im.h) return null;
    var i = (y * im.w + x) * 4, d = im.data;
    if (!d[i + 3]) return null;
    return hex(d[i], d[i + 1], d[i + 2]);
  }
  function px(im, x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= im.w || y >= im.h) return;
    var i = (y * im.w + x) * 4, d = im.data;
    if (c === null) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; return; }
    if (c === undefined) return;
    var v = rgba(c), a = v[3];
    if (a >= 255 || d[i + 3] === 0) { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = a; return; }
    if (a <= 0) return;
    var sa = a / 255, da = d[i + 3] / 255, oa = sa + da * (1 - sa);
    d[i] = (v[0] * sa + d[i] * da * (1 - sa)) / oa;
    d[i + 1] = (v[1] * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = (v[2] * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }
  function pxOn(im, x, y, c) { if (A(im, x, y)) px(im, x, y, c); }           // only over paint
  function under(im, x, y, c) { if (!A(im, x, y)) px(im, x, y, c); }         // only on empty
  function tint(im, x, y, c, t) { var o = get(im, x, y); if (o) px(im, x, y, mix(o, c, t)); }
  function rect(im, x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) px(im, x + i, y + j, typeof c === 'function' ? c(x + i, y + j, i, j) : c); }
  function hline(im, x0, x1, y, c) { for (var x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) px(im, x, y, c); }
  function vline(im, x, y0, y1, c) { for (var y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) px(im, x, y, c); }
  function line(im, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      px(im, x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // filled ellipse; c may be fn(x, y, nx, ny) with nx, ny in -1..1
  function ellipse(im, cx, cy, rx, ry, c) {
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        var dx = (x - cx) / (rx + 0.45), dy = (y - cy) / (ry + 0.45);
        if (dx * dx + dy * dy <= 1) px(im, x, y, typeof c === 'function' ? c(x, y, dx, dy) : c);
      }
  }
  // rounded rect; c may be fn(x, y, i, j)
  function rrect(im, x, y, w, h, r, c) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var cx = i < r ? r - i : i > w - 1 - r ? i - (w - 1 - r) : 0;
      var cy = j < r ? r - j : j > h - 1 - r ? j - (h - 1 - r) : 0;
      if (cx && cy && (cx - 0.5) * (cx - 0.5) + (cy - 0.5) * (cy - 0.5) > r * r) continue;
      px(im, x + i, y + j, typeof c === 'function' ? c(x + i, y + j, i, j) : c);
    }
  }
  function inPoly(pts, x, y) {
    var ins = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  function poly(im, pts, c) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    for (var y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (var x = Math.floor(x0); x <= Math.ceil(x1); x++)
        if (inPoly(pts, x + 0.5, y + 0.5)) px(im, x, y, typeof c === 'function' ? c(x, y) : c);
  }
  // string-grid stamp; legend maps chars to colours ('.' and ' ' transparent)
  function stamp(im, ox, oy, rows, leg, flip) {
    for (var y = 0; y < rows.length; y++) {
      var r = rows[y], n = r.length;
      for (var x = 0; x < n; x++) {
        var ch = r.charAt(x);
        if (ch === '.' || ch === ' ') continue;
        var c = leg[ch];
        if (c === undefined) continue;
        px(im, flip ? ox + n - 1 - x : ox + x, oy + y, c);
      }
    }
    return im;
  }
  // legend helper: ramp -> {'0': r[0], '1': r[1], ...} or with custom chars
  function rampLeg(chars, ramp, o) {
    o = o || {};
    for (var i = 0; i < chars.length && i < ramp.length; i++) o[chars.charAt(i)] = ramp[i];
    return o;
  }
  function legend() {
    var o = {};
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (Array.isArray(a)) rampLeg(a[0], a[1], o);
      else for (var k in a) o[k] = a[k];
    }
    return o;
  }

  // Selective 1px outline OUTSIDE the silhouette. Shadow side (object above / left of the
  // empty pixel -> bottom / right edges) gets #120c1c; the lit side gets a dark tint of the
  // touching material. mode 'solid' = #120c1c everywhere.
  function outline(im, mode) {
    var w = im.w, h = im.h, marks = [];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (A(im, x, y) >= 128) continue;
      var l = solid(im, x - 1, y), r = solid(im, x + 1, y), u = solid(im, x, y - 1), d = solid(im, x, y + 1);
      if (!(l || r || u || d)) continue;
      var c;
      if (mode === 'solid' || l || u) c = OUT;
      else {
        var n = r ? get(im, x + 1, y) : get(im, x, y + 1);
        c = mix(n, OUT, 0.72);
      }
      marks.push(x, y, c);
    }
    for (var i = 0; i < marks.length; i += 3) { px(im, marks[i], marks[i + 1], null); px(im, marks[i], marks[i + 1], marks[i + 2]); }
    return im;
  }
  // soft contact shadow on the floor (only where nothing is drawn yet): a rounded slab
  function floorShadow(im, x0, x1, y0, y1, a) {
    a = a == null ? 0.32 : a;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var edge = (x === x0 || x === x1 || y === y0 || y === y1);
      var corner = (x === x0 || x === x1) && (y === y0 || y === y1);
      if (corner) continue;
      under(im, x, y, alpha(OUT, edge ? a * 0.55 : a));
    }
  }
  function ellShadow(im, cx, cy, rx, ry, a) {
    a = a == null ? 0.32 : a;
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        var dx = (x - cx) / (rx + 0.45), dy = (y - cy) / (ry + 0.45), d = dx * dx + dy * dy;
        if (d > 1) continue;
        under(im, x, y, alpha(OUT, d > 0.6 ? a * 0.55 : a));
      }
  }
  // 4-point sparkle (centre opaque, arms translucent)
  function sparkle(im, x, y, c, big) {
    px(im, x, y, c || WHITE);
    var s = alpha(c || WHITE, big ? 0.8 : 0.5);
    px(im, x - 1, y, s); px(im, x + 1, y, s); px(im, x, y - 1, s); px(im, x, y + 1, s);
    if (big) { var t = alpha(c || WHITE, 0.3); px(im, x - 2, y, t); px(im, x + 2, y, t); px(im, x, y - 2, t); px(im, x, y + 2, t); }
  }
  // tint opaque pixels near (cx, cy) toward a glow colour (light spill on nearby surfaces)
  function spill(im, cx, cy, r, c, k) {
    for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / r;
        if (d >= 1 || !A(im, x, y)) continue;
        tint(im, x, y, c, k * (1 - d));
      }
  }
  // translucent halo on EMPTY pixels around a glowing core
  function halo(im, cx, cy, r, c, a) {
    for (var y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (var x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r + 0.3);
        if (d >= 1) continue;
        under(im, x, y, alpha(c, a * (1 - d)));
      }
  }

  // ===========================================================================
  // Material painters
  // ===========================================================================
  // horizontal wood grain inside a rect (base R[3]); sparse long streaks, rare flecks
  function woodH(im, x, y, w, h, R, seed, base) {
    var b = base == null ? 3 : base;
    for (var j = 0; j < h; j++) {
      var run = 0;
      for (var i = 0; i < w; i++) {
        var c = R[b];
        if (run > 0) { c = R[b - 1]; run--; }
        else if (hash(i + x, j + y, seed) < 0.07) { run = 2 + Math.floor(hash(i, j + y, seed + 1) * 5); c = R[b - 1]; }
        else if (hash(i + x, j + y, seed + 2) < 0.035) c = R[b + 1];
        px(im, x + i, y + j, c);
      }
    }
  }
  function woodV(im, x, y, w, h, R, seed, base) {
    var b = base == null ? 3 : base;
    for (var i = 0; i < w; i++) {
      var run = 0;
      for (var j = 0; j < h; j++) {
        var c = R[b];
        if (run > 0) { c = R[b - 1]; run--; }
        else if (hash(i + x, j + y, seed) < 0.08) { run = 2 + Math.floor(hash(i + x, j, seed + 1) * 5); c = R[b - 1]; }
        else if (hash(i + x, j + y, seed + 2) < 0.03) c = R[b + 1];
        px(im, x + i, y + j, c);
      }
    }
  }
  // recessed panel: inner face base, shadowed top/left lip, lit bottom/right lip
  function inset(im, x, y, w, h, R, b) {
    b = b == null ? 2 : b;
    rect(im, x, y, w, h, R[b]);
    hline(im, x, x + w - 1, y, R[b - 1]); vline(im, x, y, y + h - 1, R[b - 1]);
    hline(im, x + 1, x + w - 1, y + h - 1, R[b + 1]); vline(im, x + w - 1, y + 1, y + h - 1, R[b + 1]);
  }
  // a small candle flame with its wick; (x, y) = bottom of the flame (just above the wick)
  function flame(im, x, y, big) {
    px(im, x, y + 1, OUT);
    if (big) {
      px(im, x, y - 4, alpha(FIR[4], 0.85));
      px(im, x, y - 3, FIR[4]);
      px(im, x - 1, y - 2, FIR[4]); px(im, x, y - 2, CANDLE); px(im, x + 1, y - 2, FIR[3]);
      px(im, x - 1, y - 1, FIR[4]); px(im, x, y - 1, WHITE); px(im, x + 1, y - 1, FIR[3]);
      px(im, x, y, FIR[3]);
    } else {
      px(im, x, y - 3, alpha(FIR[4], 0.8));
      px(im, x, y - 2, FIR[4]);
      px(im, x - 1, y - 1, alpha(FIR[4], 0.75)); px(im, x, y - 1, CANDLE); px(im, x + 1, y - 1, alpha(FIR[3], 0.75));
      px(im, x, y, FIR[3]);
    }
  }
  // 2px wide candle from yTop (wax top) to yBot, flame above; drip on the right
  function candle(im, x, yTop, yBot, big, drip) {
    for (var y = yTop; y <= yBot; y++) { px(im, x, y, CRM[4]); px(im, x + 1, y, CRM[3]); }
    px(im, x, yTop, CRM[5]); px(im, x + 1, yTop, CRM[4]);
    if (drip) { px(im, x + 1, yTop + 1, CRM[5]); px(im, x + 1, yTop + 2, CRM[4]); px(im, x + 1, yTop + 3, CRM[5]); }
    px(im, x + 1, yBot, CRM[2]);
    flame(im, x + (big ? 0 : 0), yTop - 2, big);
  }

  // book spine palettes [dark, base, light]
  var BOOKS = [
    ['#3a1838', '#5e2652', '#84407a'], ['#2c1f58', '#47348a', '#6a52b4'], ['#141c46', '#22306e', '#36509a'],
    ['#0f3a2c', '#1f5e44', '#33845a'], ['#3e1222', '#6a1e32', '#94304a'], ['#5a3a18', '#94642a', '#c49040'],
    ['#123a40', '#1e5e60', '#2e8884'], ['#5a2240', '#8c3a62', '#b85a86'], ['#3a2218', '#5e3a26', '#845436'],
    ['#6a5a52', '#a8947c', '#d4c2a2']
  ];
  // fill a shelf compartment with standing books: x0..x1 inclusive, base row yb, max height hmax
  function bookRow(im, x0, x1, yb, hmax, seed, o) {
    o = o || {};
    var x = x0, k = 0;
    while (x <= x1) {
      var r = hash(x, yb, seed + k * 13);
      var w = r < 0.25 ? 1 : r < 0.85 ? 2 : 3;
      if (x + w - 1 > x1) w = x1 - x + 1;
      var gap = hash(k, yb, seed + 5) < (o.gaps || 0.08);
      if (gap && x > x0 + 2 && x < x1 - 2) { x += 1; k++; continue; }
      var hh = hmax - Math.floor(hash(x, k, seed + 2) * Math.min(4, hmax - 2));
      var P = BOOKS[Math.floor(hash(k, x, seed + 3) * BOOKS.length)];
      for (var i = 0; i < w; i++) {
        var col = w === 1 ? P[1] : i === 0 ? P[2] : i === w - 1 ? P[0] : P[1];
        vline(im, x + i, yb - hh + 1, yb, col);
      }
      // top edge (pages seen from above are hidden; darken top for depth)
      if (w > 1) px(im, x + w - 1, yb - hh + 1, P[0]);
      // gold bands
      var band = hash(x, yb, seed + 7);
      if (band < 0.55 && hh >= 4) { hline(im, x, x + w - 1, yb - hh + 2, GLD[3]); if (w > 1) px(im, x + w - 1, yb - hh + 2, GLD[2]); }
      if (band < 0.3 && hh >= 5) { hline(im, x, x + w - 1, yb - 1, GLD[2]); }
      if (band > 0.8 && w >= 2 && hh >= 5) px(im, x, yb - hh + 3 + (hh > 6 ? 1 : 0), CRM[3]);
      x += w; k++;
    }
  }


  // ---- shaded volumes ---------------------------------------------------------
  // light vector (top-left, toward the viewer)
  var LX = -0.52, LY = -0.62, LZ = 0.59;
  // shaded ellipsoid; ramp dark -> light; o: {bias, clip: fn(x,y)->bool}
  function sphere(im, cx, cy, rx, ry, ramp, o) {
    o = o || {};
    var n = ramp.length, bias = o.bias || 0;
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        var nx = (x - cx) / (rx + 0.45), ny = (y - cy) / (ry + 0.45), d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        if (o.clip && !o.clip(x, y)) continue;
        var nz = Math.sqrt(1 - d2);
        var l = nx * LX + ny * LY + nz * LZ;
        var v = clamp((l + 0.25 + bias) / 1.2, 0, 0.999);
        px(im, x, y, ramp[Math.floor(v * n)]);
      }
  }
  // shaded thick stroke through [x, y, radius] control points
  function tube(im, pts, ramp, o) {
    o = o || {};
    var S = [], i, k;
    for (i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], dd = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      var n = Math.max(1, Math.ceil(dd * 4));
      for (k = 0; k < n; k++) { var t = k / n; S.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
    }
    S.push(pts[pts.length - 1]);
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    S.forEach(function (s) { x0 = Math.min(x0, s[0] - s[2]); y0 = Math.min(y0, s[1] - s[2]); x1 = Math.max(x1, s[0] + s[2]); y1 = Math.max(y1, s[1] + s[2]); });
    var nr = ramp.length, bias = o.bias || 0;
    for (var y = Math.floor(y0) - 1; y <= Math.ceil(y1) + 1; y++)
      for (var x = Math.floor(x0) - 1; x <= Math.ceil(x1) + 1; x++) {
        var best = 9, bx = 0, by = 0;
        for (i = 0; i < S.length; i++) {
          var rr = S[i][2] + 0.4, ddx = (x - S[i][0]) / rr, ddy = (y - S[i][1]) / rr, d = ddx * ddx + ddy * ddy;
          if (d < best) { best = d; bx = ddx; by = ddy; }
        }
        if (best > 1) continue;
        var nz = Math.sqrt(Math.max(0, 1 - best));
        var l = bx * LX + by * LY + nz * LZ;
        var v = clamp((l + 0.25 + bias) / 1.2, 0, 0.999);
        px(im, x, y, ramp[Math.floor(v * nr)]);
      }
  }
  // quadratic bezier samples
  function bez(p0, p1, p2, n) {
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    return out;
  }
  function path(im, pts, c) { for (var i = 0; i < pts.length - 1; i++) line(im, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], c); }

  // ---- glass & potions -----------------------------------------------------------
  // liquid ramps [deep, mid, bright, core]
  var LQ = {
    emerald: ['#18684a', '#2fbf7f', '#5dffb0', '#d8fff0'],
    violet: ['#4a2f7a', '#8f6cd1', '#b99aee', '#f0e6ff'],
    rose: ['#8c3a62', '#c4648e', '#e89ab8', '#fff0f6'],
    amber: ['#a8582a', '#e8843c', '#ffbc62', '#fff1c8'],
    cyan: ['#22625e', '#3c9fc0', '#86dce6', '#e6fcff'],
    moon: ['#5c689c', '#9fb0d8', '#d8e2ff', '#ffffff'],
    red: ['#7a1a30', '#b8303a', '#e0503e', '#ffd0b8']
  };
  var GLASS = { e: '#2a2440', h: '#dfe8ff', n: '#4a4868', d: '#191428' };
  // bottle shapes; (x, yb) = left, bottom row. chars: c cork, n neck glass, e edge, h highlight,
  // 1..4 liquid (deep..core), d dark empty glass, b brass
  var BOTTLES = {
    round: ['..c..', '..n..', '.e3e.', 'h332e', 'h342e', 'e221e', '.eee.'],
    roundBig: ['...c...', '...n...', '..ene..', '.e333e.', 'h33433e', 'h34432e', 'e32221e', 'e22111e', '.eeeee.'],
    tall: ['.c.', '.n.', 'ede', 'h3e', 'h3e', 'h2e', 'h2e', 'e1e'],
    flask: ['.c.', '.n.', '.n.', 'ede', 'h33e', 'h342e', 'e2211e'],
    square: ['.cc.', '.nn.', 'eeee', 'h33e', 'h42e', 'h22e', 'e11e'],
    vial: ['c', 'n', '3', '4', '2', '1'],
    vial2: ['cc', 'hd', 'h3', 'h4', 'h2', 'e1'],
    jar: ['.bb.', 'bbbb', 'h33e', 'h42e', 'h21e', 'e11e']
  };
  function bottle(im, x, yb, kind, L, o) {
    o = o || {};
    var g = BOTTLES[kind], H = g.length;
    var leg = {
      c: o.cork || WD[4], n: GLASS.n, e: GLASS.e, h: GLASS.h, d: GLASS.d, b: BRS[3],
      1: L[0], 2: L[1], 3: L[2], 4: L[3]
    };
    var oy = yb - H + 1;
    stamp(im, x, oy, g, leg);
    if (o.wax) px(im, x + Math.floor(g[0].length / 2), oy, o.wax);
  }
  // translucent glass pane: tints what is under it (or, over empty pixels, a pale wash)
  function glassPx(im, x, y, a) { px(im, x, y, alpha('#c8d8f0', a == null ? 0.22 : a)); }

  // ---- small motifs -------------------------------------------------------------
  // crescent moon from a template (6 tall); c = [dark, mid, light]
  function crescent6(im, x, y, c, flip) {
    stamp(im, x, y, ['..33', '.32.', '32..', '21..', '.21.', '..11'], { 1: c[0], 2: c[1], 3: c[2] }, flip);
  }
  function crescent8(im, x, y, c, flip) {
    stamp(im, x, y, ['...33', '.332.', '.32..', '32...', '21...', '.21..', '.221.', '...11'], { 1: c[0], 2: c[1], 3: c[2] }, flip);
  }
  // 4-point star (opaque, 3 tones)
  function star4(im, x, y, c) {
    px(im, x, y, c[2]); px(im, x - 1, y, c[1]); px(im, x + 1, y, c[1]); px(im, x, y - 1, c[1]); px(im, x, y + 1, c[0]);
  }
  // music note (2x4)
  function note(im, x, y, c) { vline(im, x + 1, y, y + 2, c); px(im, x, y + 3, c); px(im, x + 1, y + 3, c); px(im, x + 2, y, alpha(c, 0.8)); }

  // auto-miniature: crop the opaque bbox; if it fits, centre it; else pick a 2:1 sample
  function autoIcon(spr) {
    var x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, x, y;
    for (y = 0; y < spr.h; y++) for (x = 0; x < spr.w; x++) if (A(spr, x, y) >= 128) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    var im = img(16, 16);
    if (x1 < 0) return im;
    var w = x1 - x0 + 1, h = y1 - y0 + 1;
    var s = Math.max(1, Math.ceil(Math.max(w / 16, h / 16)));
    var ow = Math.ceil(w / s), oh = Math.ceil(h / s);
    var ox = Math.floor((16 - ow) / 2), oy = Math.floor((16 - oh) / 2);
    for (y = 0; y < oh; y++) for (x = 0; x < ow; x++) {
      var best = null, ba = 0;
      for (var j = 0; j < s; j++) for (var i = 0; i < s; i++) {
        var sx = x0 + x * s + i, sy = y0 + y * s + j, a = A(spr, sx, sy);
        if (a > ba) { ba = a; best = get(spr, sx, sy); }
      }
      if (best && ba >= 128) px(im, ox + x, oy + y, best);
    }
    return im;
  }

  // ===========================================================================
  // Furniture definitions
  // ===========================================================================
  var DEFS = [], BY = Object.create(null);
  // m: {id, name, w, h, hr (headroom px above the footprint), wall, flat, light, price, seller}
  // m.trim: the drawing code works on a canvas `trim` rows taller; those empty top rows
  // are cropped away afterwards (keeps headroom tight without re-plotting coordinates)
  function def(m, sprite, icon) {
    m.hr = m.hr || 0;
    var draw = sprite;
    if (m.trim) draw = function (im) {
      var big = img(im.w, im.h + m.trim);
      sprite(big);
      im.data.set(big.data.subarray(m.trim * im.w * 4));
      return im;
    };
    DEFS.push(m);
    BY[m.id] = { m: m, sprite: draw, icon: icon || null };
  }
  function canvasFor(m) { return img(m.w * 16, m.h * 16 + m.hr); }

  // ---------------------------------------------------------------------------
  // Oak Table (2x1) 32x26
  // ---------------------------------------------------------------------------
  function turnedLeg(im, x, y0, y1, R) {
    for (var y = y0; y <= y1; y++) { px(im, x, y, R[4]); px(im, x + 1, y, R[3]); px(im, x + 2, y, R[2]); }
    var b = y0 + Math.round((y1 - y0) * 0.35);
    px(im, x - 1, b, R[3]); px(im, x + 3, b, R[1]); hline(im, x, x + 2, b, R[4]); px(im, x + 2, b, R[3]);
    hline(im, x, x + 2, b + 1, R[2]); px(im, x, b + 1, R[3]);
    px(im, x - 1, y1, R[2]); px(im, x + 3, y1, R[1]); hline(im, x, x + 2, y1, R[2]); px(im, x, y1, R[3]);
  }
  function drawOakTable(im) {
    var R = OAK;
    // back legs + apron (under the top)
    rect(im, 6, 14, 2, 6, R[1]); rect(im, 24, 14, 2, 6, R[1]);
    rect(im, 4, 14, 24, 2, R[2]); hline(im, 4, 27, 15, R[1]);
    px(im, 9, 16, R[1]); px(im, 22, 16, R[1]);
    turnedLeg(im, 2, 14, 24, R); turnedLeg(im, 27, 14, 24, R);
    // top
    woodH(im, 1, 2, 30, 10, R, 11);
    [5, 8].forEach(function (sy, k) { for (var x = 2; x <= 29; x++) px(im, x, sy, hash(x, sy, 3 + k) > 0.15 ? R[2] : R[3]); });
    hline(im, 1, 30, 2, R[4]); vline(im, 1, 2, 11, R[4]); hline(im, 1, 8, 2, R[5]);
    vline(im, 30, 3, 11, R[2]);
    // front edge
    hline(im, 1, 30, 12, R[3]); hline(im, 1, 30, 13, R[2]); px(im, 1, 12, R[4]); hline(im, 2, 6, 12, R[4]);
    // violet runner hanging over the front edge
    for (var y = 2; y <= 13; y++) {
      px(im, 12, y, VIO[4]); hline(im, 13, 18, y, VIO[3]); px(im, 19, y, VIO[2]);
    }
    hline(im, 12, 19, 12, VIO[2]); hline(im, 12, 19, 13, VIO[2]); px(im, 12, 12, VIO[3]);
    hline(im, 12, 19, 14, VIO[2]); hline(im, 13, 18, 15, VIO[1]); hline(im, 14, 17, 16, VIO[1]);
    hline(im, 12, 19, 4, GLD[3]); px(im, 12, 4, GLD[4]); px(im, 19, 4, GLD[2]);
    hline(im, 12, 19, 11, GLD[2]); px(im, 12, 11, GLD[3]);
    star4(im, 15, 7, [GLD[2], GLD[3], GLD[4]]); px(im, 16, 7, GLD[3]); px(im, 16, 8, GLD[2]); px(im, 16, 6, GLD[3]);
    px(im, 15, 17, GLD[3]); px(im, 16, 17, GLD[2]); px(im, 15, 18, GLD[2]);
    outline(im, 'sel');
    floorShadow(im, 3, 28, 17, 25, 0.3);
    return im;
  }
  function iconOakTable() {
    var im = img(16, 16), R = OAK;
    rect(im, 4, 10, 1, 3, R[1]); rect(im, 11, 10, 1, 3, R[1]);
    woodH(im, 1, 4, 14, 5, R, 12);
    hline(im, 1, 14, 4, R[4]); hline(im, 1, 5, 4, R[5]); vline(im, 14, 5, 8, R[2]);
    hline(im, 1, 14, 9, R[3]); hline(im, 1, 14, 10, R[2]);
    vline(im, 1, 11, 14, R[4]); vline(im, 2, 11, 14, R[2]);
    vline(im, 13, 11, 14, R[3]); vline(im, 14, 11, 14, R[1]);
    rect(im, 6, 4, 4, 7, VIO[3]); vline(im, 6, 4, 10, VIO[4]); vline(im, 9, 4, 10, VIO[2]); hline(im, 6, 9, 9, VIO[2]); hline(im, 6, 9, 10, VIO[2]);
    hline(im, 7, 8, 11, VIO[1]); px(im, 7, 12, GLD[3]);
    px(im, 7, 6, GLD[4]); px(im, 8, 6, GLD[3]);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_table_oak', name: 'Oak Table', w: 2, h: 1, hr: 10, price: 900, seller: 'brann' }, drawOakTable, iconOakTable);

  // ---------------------------------------------------------------------------
  // Round Table with a candle (1x1) 16x29
  // ---------------------------------------------------------------------------
  function drawRoundTable(im) {
    var R = DW;
    // tripod feet
    stamp(im, 1, 24, [
      '....dd....dd...',
      '..ddd......ddd.',
      '.dd...dd.....dd',
      '......dd.......'
    ], { d: R[3] });
    px(im, 2, 25, R[4]); px(im, 3, 25, R[4]); px(im, 1, 26, R[4]); px(im, 13, 26, R[2]); px(im, 14, 26, R[2]);
    px(im, 7, 26, R[4]); px(im, 8, 27, R[2]);
    // pedestal (vase)
    for (var y = 17; y <= 24; y++) {
      var w = (y >= 19 && y <= 22) ? 2 : 1;
      if (w === 2) { px(im, 5, y, R[4]); px(im, 6, y, R[4]); px(im, 7, y, R[3]); px(im, 8, y, R[3]); px(im, 9, y, R[2]); px(im, 10, y, R[1]); }
      else { px(im, 6, y, R[4]); px(im, 7, y, R[3]); px(im, 8, y, R[2]); px(im, 9, y, R[1]); }
    }
    hline(im, 5, 10, 19, R[4]); px(im, 10, 19, R[2]); hline(im, 6, 9, 22, R[2]); px(im, 5, 22, R[3]);
    // top: ellipse + rim
    ellipse(im, 7.5, 15.5, 6.6, 2.6, R[1]);
    ellipse(im, 7.5, 14.5, 6.6, 2.6, function (x, y, nx, ny) {
      if (ny < -0.55) return R[5];
      if (nx < -0.75 || (ny < -0.15 && nx < 0.2)) return R[4];
      return nx > 0.6 ? R[3] : R[4];
    });
    ellipse(im, 7.5, 14.5, 5.2, 1.6, function (x, y, nx, ny) { return (nx + ny) > 0.5 ? R[3] : R[4]; });
    for (var x = 1; x <= 14; x++) { if (get(im, x, 16)) px(im, x, 16, R[2]); if (get(im, x, 17)) px(im, x, 17, R[1]); }
    // lace doily
    ellipse(im, 7.5, 14.5, 4, 1.4, CRM[3]);
    ellipse(im, 7.5, 14.5, 2.8, 0.8, CRM[4]);
    [3, 5, 10, 12].forEach(function (x) { px(im, x, 14, CRM[4]); });
    px(im, 4, 13, CRM[4]); px(im, 11, 13, CRM[2]); px(im, 4, 15, CRM[2]); px(im, 11, 15, CRM[2]);
    // brass holder + candle
    hline(im, 6, 9, 13, BRS[3]); hline(im, 5, 10, 14, BRS[2]); px(im, 5, 14, BRS[3]); px(im, 6, 13, BRS[4]);
    candle(im, 7, 6, 12, true, true);
    outline(im, 'sel');
    ellShadow(im, 7.5, 26.5, 6.5, 1.8, 0.3);
    halo(im, 7, 2, 2.6, CANDLE, 0.22);
    return im;
  }
  function iconRoundTable() {
    var im = img(16, 16), R = DW;
    stamp(im, 3, 13, ['..d....d..', '.dd.dd.dd.', 'd...dd...d'], { d: R[3] });
    vline(im, 7, 10, 13, R[4]); vline(im, 8, 10, 13, R[2]);
    ellipse(im, 7.5, 9.5, 6.5, 2.2, R[1]);
    ellipse(im, 7.5, 8.5, 6.5, 2.2, function (x, y, nx, ny) { return ny < -0.4 ? R[5] : nx > 0.5 ? R[3] : R[4]; });
    ellipse(im, 7.5, 8.5, 3.2, 1, CRM[3]);
    hline(im, 6, 9, 8, BRS[3]);
    candle(im, 7, 3, 7, false, true);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_table_round', name: 'Round Table', w: 1, h: 1, hr: 13, price: 450, seller: 'brann',
    light: { x: 7, y: 2, r: 30, color: L_CANDLE } }, drawRoundTable, iconRoundTable);

  // ---------------------------------------------------------------------------
  // Alchemist's Desk (2x1) 32x30
  // ---------------------------------------------------------------------------
  function drawDesk(im) {
    var R = DW;
    // pedestals with drawers
    function pedestal(x0) {
      woodV(im, x0, 20, 9, 8, R, 40 + x0, 3);
      vline(im, x0, 20, 27, R[4]); vline(im, x0 + 8, 20, 27, R[2]);
      inset(im, x0 + 1, 20, 7, 4, R, 3); inset(im, x0 + 1, 24, 7, 4, R, 3);
      px(im, x0 + 4, 21, BRS[4]); px(im, x0 + 4, 22, BRS[2]); px(im, x0 + 4, 25, BRS[4]); px(im, x0 + 4, 26, BRS[2]);
      hline(im, x0, x0 + 8, 28, R[2]); px(im, x0, 28, R[3]);
    }
    pedestal(2); pedestal(21);
    rect(im, 11, 20, 10, 8, R[0]); rect(im, 11, 20, 10, 4, R[1]); hline(im, 11, 20, 20, R[0]);
    // top
    woodH(im, 1, 11, 30, 7, R, 23, 3);
    hline(im, 1, 30, 11, R[4]); vline(im, 1, 11, 17, R[4]); hline(im, 1, 7, 11, R[5]); vline(im, 30, 12, 17, R[2]);
    hline(im, 1, 30, 18, R[3]); hline(im, 1, 30, 19, R[2]); px(im, 1, 18, R[4]);
    // open book
    stamp(im, 3, 9, [
      '.aaaa.aaaa.',
      'aPPPPaPPPPa',
      'PtttPpPPrPP',
      'PPPPPpPrRrP',
      'PtttPpPPrPP',
      'PttPPpPtttP',
      'bbbbbbbbbbb'
    ], { a: PAP[5], P: PAP[4], p: PAP[2], t: PAP[3], r: RSE[1], R: RSE[3], b: PLV[3] });
    px(im, 3, 15, PLV[4]); px(im, 13, 15, PLV[2]);
    px(im, 9, 16, RSE[2]); px(im, 9, 17, RSE[2]); px(im, 9, 18, RSE[1]); px(im, 9, 19, RSE[1]); px(im, 9, 20, RSE[0]);
    // inkwell + quill
    stamp(im, 14, 11, ['.ee.', 'ehde', 'eddd', '.dd.'], { e: GLASS.e, h: GLASS.h, d: '#231b38' });
    line(im, 16, 11, 20, 3, OUT);
    stamp(im, 16, 2, [
      '....hh',
      '...hhs',
      '..hhs.',
      '.hhs..',
      '.hs...',
      'hs....'
    ], { h: LIN[4], s: VIO[4] });
    px(im, 20, 2, LIN[5]); px(im, 21, 2, LIN[5]);
    // vials on a little brass rack
    hline(im, 22, 29, 15, BRS[3]); hline(im, 22, 29, 16, BRS[1]); px(im, 22, 15, BRS[4]);
    bottle(im, 22, 14, 'flask', LQ.emerald);
    bottle(im, 26, 14, 'vial2', LQ.violet);
    bottle(im, 28, 14, 'vial', LQ.rose);
    px(im, 23, 12, '#d8fff0');
    outline(im, 'sel');
    floorShadow(im, 2, 29, 26, 29, 0.3);
    halo(im, 24, 11, 2.5, EMG[3], 0.25);
    return im;
  }
  def({ id: 'furn_desk', name: "Alchemist's Desk", w: 2, h: 1, hr: 14, price: 1800, seller: 'orvyn',
    light: { x: 24, y: 11, r: 26, color: L_EMERALD } }, drawDesk, null);

  // ---------------------------------------------------------------------------
  // Oak Chair (1x1) 16x26
  // ---------------------------------------------------------------------------
  function drawOakChair(im) {
    var R = OAK;
    vline(im, 3, 3, 12, R[4]); vline(im, 4, 3, 12, R[3]);
    vline(im, 11, 3, 12, R[3]); vline(im, 12, 3, 12, R[2]);
    // vase splat
    rect(im, 6, 5, 4, 7, R[3]); vline(im, 6, 5, 11, R[4]); vline(im, 9, 5, 11, R[2]);
    px(im, 6, 8, null); px(im, 9, 8, null); px(im, 7, 8, R[4]); px(im, 8, 8, R[2]);
    // crest rail
    hline(im, 4, 11, 1, R[4]); hline(im, 5, 10, 1, R[5]);
    hline(im, 3, 12, 2, R[3]); hline(im, 3, 12, 3, R[3]); hline(im, 3, 12, 4, R[2]);
    px(im, 3, 2, R[4]); px(im, 3, 3, R[4]); px(im, 12, 2, R[2]); px(im, 12, 3, R[2]);
    hline(im, 6, 9, 3, R[2]); px(im, 7, 2, R[2]); px(im, 8, 2, R[2]);
    // seat
    woodH(im, 2, 12, 12, 4, R, 21);
    hline(im, 2, 13, 12, R[4]); px(im, 2, 12, R[5]); hline(im, 3, 6, 12, R[5]); vline(im, 2, 13, 15, R[4]); vline(im, 13, 13, 15, R[2]);
    hline(im, 2, 13, 16, R[3]); hline(im, 2, 13, 17, R[2]); px(im, 2, 16, R[4]);
    // tie-on plum cushion with gold corner tassels
    rrect(im, 3, 12, 10, 4, 1, function (x, y, i, j) { return j === 0 ? PLV[5] : j === 3 ? PLV[2] : (i === 0 ? PLV[4] : i === 9 ? PLV[3] : PLV[4]); });
    px(im, 7, 13, PLV[3]); px(im, 8, 14, PLV[3]); hline(im, 4, 7, 13, PLV[5]);
    px(im, 3, 16, GLD[3]); px(im, 12, 16, GLD[2]);
    // legs + stretcher
    vline(im, 4, 18, 21, R[1]); vline(im, 11, 18, 21, R[1]);
    hline(im, 4, 11, 21, R[2]); hline(im, 5, 10, 22, R[1]);
    vline(im, 2, 18, 24, R[4]); vline(im, 3, 18, 24, R[2]);
    vline(im, 12, 18, 24, R[3]); vline(im, 13, 18, 24, R[1]);
    outline(im, 'sel');
    floorShadow(im, 3, 12, 20, 25, 0.3);
    return im;
  }
  function iconOakChair() {
    var im = img(16, 16), R = OAK;
    vline(im, 4, 1, 8, R[4]); vline(im, 5, 1, 8, R[3]); vline(im, 10, 1, 8, R[3]); vline(im, 11, 1, 8, R[2]);
    hline(im, 5, 10, 0, R[5]); hline(im, 4, 11, 1, R[3]); hline(im, 4, 11, 2, R[2]);
    rect(im, 7, 3, 2, 5, R[3]); vline(im, 7, 3, 7, R[4]);
    woodH(im, 3, 8, 10, 3, R, 22); hline(im, 3, 12, 8, R[4]); vline(im, 12, 9, 10, R[2]);
    hline(im, 3, 12, 11, R[2]); hline(im, 3, 12, 12, R[1]);
    rrect(im, 4, 8, 8, 3, 1, function (x, y, i, j) { return j === 0 ? PLV[5] : j === 2 ? PLV[2] : PLV[4]; });
    px(im, 4, 11, GLD[3]); px(im, 11, 11, GLD[2]);
    vline(im, 3, 13, 15, R[3]); vline(im, 4, 13, 15, R[2]); vline(im, 11, 13, 15, R[3]); vline(im, 12, 13, 15, R[1]);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_chair_oak', name: 'Oak Chair', w: 1, h: 1, hr: 10, price: 300, seller: 'brann' }, drawOakChair, iconOakChair);

  // ---------------------------------------------------------------------------
  // Wingback Armchair (1x1, plum velvet) 16x26
  // ---------------------------------------------------------------------------
  var ARMCHAIR = [
    '................',
    '......hHHh......',
    '.....hHhhhB.....',
    '..hh.hhBBBBb.bk.',
    '.hHhbhBBBBBbBbk.',
    '.hHhbhoBBoBbBbk.',
    '.hHhbhbBBbBbBbk.',
    '.hHhbhBBBBBbBbk.',
    '.hHhbhBBBBBbBbk.',
    '.hHhbhoBBoBbBbk.',
    '.hHhbbbBBbbbBbk.',
    '.HHhbhhhhhhbhBk.',
    '.hhBbhHHhhhbBbk.',
    '.hgBbhhhhhBbBnk.',
    '.BBbkbbbbbbkbbk.',
    '.BbbkbbbbbbkbkK.',
    '.ggggggggggnnnn.',
    '.bBBBBBBBBBBBbk.',
    '.bBBBBBBBBBBBbk.',
    '.bbbbbbbbbbbbbk.',
    '.gngngngngngngn.',
    '..Ww........wx..',
    '..Ww........wx..',
    '..gg........nn..'
  ];
  function drawArmchair(im) {
    var P = PLV;
    stamp(im, 0, 1, ARMCHAIR, {
      H: P[5], h: P[4], B: P[3], b: P[2], k: P[1], K: P[0],
      o: GLD[4], g: GLD[3], n: GLD[2], w: DW[3], W: DW[4], x: DW[2]
    });
    outline(im, 'sel');
    floorShadow(im, 2, 13, 22, 25, 0.32);
    return im;
  }
  def({ id: 'furn_armchair', name: 'Wingback Armchair', w: 1, h: 1, hr: 10, price: 600, seller: 'isolde' }, drawArmchair, null);

  // ---------------------------------------------------------------------------
  // Canopy Bed (2x2) 32x58 — dark wood four-poster, plum curtains, starry quilt
  // ---------------------------------------------------------------------------
  var PIL = ['#5a5078', '#8a80aa', '#b2a8d0', '#d2cae6', '#eae6f6', '#ffffff'];
  function pillow(im, x, y, flip) {
    stamp(im, x, y, [
      'h.hhhhhhh.h',
      '.hHHhhhhhm.',
      'hHHhhhhhmmm',
      'hHhhhhhmmmm',
      'hhhhhhmmmms',
      '.mmmmmmmms.',
      's.sssssss.s'
    ], { H: PIL[5], h: PIL[4], m: PIL[3], s: PIL[2] }, flip);
  }
  function curtain(im, side) {
    // left curtain geometry; mirrored for the right one (darker, away from the light)
    var P = PLV, dark = side > 0;
    for (var y = 10; y <= 34; y++) {
      var le, re;
      if (y <= 20) { le = 1; re = Math.round(9 - (y - 10) * 5 / 10); }
      else if (y <= 22) { le = 1; re = 4; }
      else { le = 1; re = 4 + Math.round((y - 23) * 2 / 11); }
      var n = y <= 20 ? 3 : 2;
      for (var x = le; x <= re; x++) {
        var u = (x - le + 0.5) / (re - le + 1), f = (u * n) % 1;
        var b = f < 0.3 ? 4 : f > 0.78 ? 2 : 3;
        if (dark) b -= 1;
        if (x === re && y > 10) b = Math.min(b, dark ? 1 : 2);
        px(im, side > 0 ? 31 - x : x, y, P[b]);
      }
    }
    // tie-back + tassel
    for (var tx = 1; tx <= 4; tx++) { px(im, side > 0 ? 31 - tx : tx, 21, GLD[dark ? 3 : 4]); px(im, side > 0 ? 31 - tx : tx, 22, GLD[2]); }
    var sx = side > 0 ? 31 - 5 : 5;
    px(im, sx, 22, GLD[3]); px(im, sx, 23, GLD[3]); px(im, sx, 24, GLD[2]);
  }
  function drawCanopyBed(im) {
    var R = DW, Q = QLT;
    // --- back posts, pleated back drape, headboard
    vline(im, 1, 3, 34, R[4]); vline(im, 2, 3, 34, R[3]); vline(im, 29, 3, 34, R[2]); vline(im, 30, 3, 34, R[1]);
    for (var bx = 3; bx <= 28; bx++) for (var by = 4; by <= 30; by++) {
      var q = bx % 3;
      px(im, bx, by, q === 0 ? PLV[0] : q === 1 ? PLV[2] : PLV[1]);
    }
    for (var x = 3; x <= 28; x++) {
      var d = (x - 15.5) / 12.5, top = 12 + Math.round(3 * d * d);
      for (var y = top; y <= 33; y++) {
        var c = R[3];
        if (y === top) c = x < 16 ? R[5] : R[4];
        else if (y === top + 1) c = R[4];
        else if (hash(x, y >> 2, 61) < 0.12) c = R[2];
        px(im, x, y, c);
      }
      // recessed arch panel
      var it = top + 3;
      if (x >= 6 && x <= 25) for (var y2 = it; y2 <= 31; y2++) {
        var cc = R[2];
        if (y2 === it || x === 6) cc = R[1];
        else if (x === 25) cc = R[3];
        px(im, x, y2, cc);
      }
    }
    // silver full-moon inlay with a ring of gold studs
    ellipse(im, 15.5, 21, 3.2, 3.2, function (x, y, nx, ny) { return (nx + ny) < -0.5 ? WHITE : (nx + ny) < 0.4 ? SLV[4] : SLV[3]; });
    px(im, 16, 22, SLV[3]); px(im, 14, 20, SLV[4]);
    for (var a = 0; a < 10; a++) { var an = a * Math.PI / 5 - Math.PI / 2; px(im, Math.round(15.5 + Math.cos(an) * 5.4 - 0.5), Math.round(21 + Math.sin(an) * 5.4 - 0.5), a % 2 ? GLD[2] : GLD[3]); }
    star4(im, 9, 19, [GLD[1], GLD[2], GLD[4]]); star4(im, 22, 19, [GLD[1], GLD[2], GLD[3]]);
    // --- curtains (over the posts), valance, cornice
    curtain(im, -1); curtain(im, 1);
    for (var vx = 1; vx <= 30; vx++) {
      var p = vx % 4, bot = 8 + [0, 1, 2, 2, 1, 0][vx % 6];
      for (var vy = 4; vy <= bot; vy++) {
        var vc = p === 1 ? PLV[4] : p === 0 ? PLV[2] : PLV[3];
        if (vy === 5) vc = dk(vc, 0.25);
        px(im, vx, vy, vc);
      }
      px(im, vx, bot, vx % 2 ? GLD[3] : GLD[2]);
      px(im, vx, 4, vx % 2 ? GLD[4] : GLD[3]);
    }
    [3, 9, 15, 21, 27].forEach(function (tx) { px(im, tx, 11, GLD[3]); px(im, tx, 12, GLD[2]); });
    hline(im, 1, 30, 0, R[4]); hline(im, 1, 30, 1, R[3]); hline(im, 1, 30, 2, R[3]); hline(im, 1, 30, 3, R[1]);
    hline(im, 1, 10, 0, R[5]);
    [4, 10, 16, 22, 28].forEach(function (gx) { px(im, gx, 2, GLD[3]); px(im, gx - 1, 2, GLD[2]); });
    // --- pillows, sheet, quilt
    pillow(im, 4, 25, false); pillow(im, 17, 25, false);
    px(im, 9, 27, PIL[3]); px(im, 22, 27, PIL[3]);
    for (var sx = 2; sx <= 29; sx++) { px(im, sx, 32, LIN[5]); px(im, sx, 33, sx % 2 ? LIN[4] : VIO[4]); px(im, sx, 34, LIN[2]); }
    px(im, 2, 32, LIN[4]);
    for (var qy = 35; qy <= 48; qy++) for (var qx = 2; qx <= 29; qx++) {
      var t = (qx - 2) / 27 * 0.55 + (qy - 35) / 13 * 0.45;
      var b = t < 0.22 ? 4 : t < 0.75 ? 3 : 2;
      if (qx === 2) b = 3; if (qx >= 28) b = 2; if (qx === 29) b = 1;
      var lat = ((qx + qy) % 7 === 0 || (qx - qy + 70) % 7 === 0) && qx % 2 === 0;
      px(im, qx, qy, lat ? Q[Math.max(1, b - 1)] : Q[b]);
    }
    vline(im, 4, 35, 48, GLD[2]); vline(im, 27, 35, 48, GLD[1]);
    star4(im, 9, 38, [GLD[2], GLD[3], GLD[5]]); star4(im, 23, 44, [GLD[2], GLD[3], GLD[4]]); star4(im, 24, 37, [SLV[1], SLV[3], SLV[5]]);
    [[7, 44], [14, 36], [19, 40], [12, 47], [25, 47], [17, 46], [6, 37]].forEach(function (s, k) { px(im, s[0], s[1], k % 3 === 2 ? SLV[4] : GLD[4]); });
    crescent8(im, 14, 39, [GLD[3], GLD[4], CRM[5]]);
    // front drape
    for (var dx = 2; dx <= 29; dx++) {
      px(im, dx, 49, Q[3]);
      px(im, dx, 50, dx % 5 === 0 ? Q[1] : Q[2]);
      px(im, dx, 51, dx % 5 === 0 ? Q[1] : Q[2]);
      px(im, dx, 52, dx % 2 ? GLD[3] : GLD[2]);
    }
    hline(im, 2, 6, 49, Q[4]);
    px(im, 9, 50, GLD[4]); px(im, 21, 51, SLV[4]);
    // frame rail + front posts
    hline(im, 2, 29, 53, R[3]); hline(im, 2, 29, 54, R[2]); hline(im, 2, 8, 53, R[4]);
    function post(x, lit) {
      var c = lit ? [R[4], R[3], R[2]] : [R[3], R[2], R[1]];
      for (var y = 40; y <= 56; y++) { px(im, x, y, c[0]); px(im, x + 1, y, c[1]); px(im, x + 2, y, c[2]); }
      [44, 51].forEach(function (by) { hline(im, x, x + 2, by, lit ? R[5] : R[4]); px(im, x + 2, by, c[1]); hline(im, x, x + 2, by + 1, c[2]); });
      stamp(im, x, 37, ['.g.', 'gGs', '.s.'], { g: GLD[4], G: GLD[5], s: GLD[2] });
      hline(im, x, x + 2, 40, GLD[2]); px(im, x, 40, GLD[3]);
    }
    post(1, true); post(28, false);
    outline(im, 'sel');
    floorShadow(im, 3, 28, 55, 57, 0.34);
    return im;
  }
  def({ id: 'furn_bed_canopy', name: 'Canopy Bed', w: 2, h: 2, hr: 26, price: 2400, seller: 'isolde' }, drawCanopyBed, null);

  // ---------------------------------------------------------------------------
  // Simple Cot (1x2) 16x36 — straw pallet on a plank frame, patchwork blanket
  // ---------------------------------------------------------------------------
  var PATCH = [['#3e2f6e', '#5d419d', '#7e61c3'], ['#3a1838', '#5e2652', '#84407a'], ['#2e4a34', '#46684a', '#62885e'],
    ['#6a4a1e', '#94682e', '#b88a40'], ['#18244e', '#25367c', '#3a52a0'], ['#5a2240', '#8c3a62', '#b05a80']];
  function patchwork(im, x0, y0, x1, y1, seed, cell) {
    cell = cell || 4;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var cx = Math.floor((x - x0) / cell), cy = Math.floor((y - y0) / cell);
      var P = PATCH[Math.floor(hash(cx, cy, seed) * PATCH.length)];
      var lx = (x - x0) % cell, ly = (y - y0) % cell;
      var c = P[1];
      if (lx === 0 || ly === 0) c = P[2];
      if (lx === cell - 1 || ly === cell - 1) c = P[0];
      if (x === x0) c = P[2]; if (x === x1) c = P[0];
      px(im, x, y, c);
    }
  }
  function drawCot(im) {
    var R = WD, S = STR;
    // head plank with pegs
    rrect(im, 1, 2, 14, 5, 1, function (x, y, i, j) { return j === 0 ? R[5] : j === 4 ? R[2] : i === 0 ? R[4] : R[3]; });
    hline(im, 2, 13, 4, R[2]); px(im, 3, 3, R[5]); px(im, 12, 3, R[4]); px(im, 3, 5, R[4]); px(im, 12, 5, R[3]);
    // side rails
    vline(im, 1, 7, 31, R[4]); vline(im, 14, 7, 31, R[2]);
    [12, 22].forEach(function (y) { px(im, 1, y, R[5]); px(im, 14, y, R[3]); });
    // straw pallet: strands running along the cot
    for (var x = 2; x <= 13; x++) {
      var run = 0, col = S[3];
      for (var y = 6; y <= 31; y++) {
        if (run <= 0) { var r = hash(x, y, 91); col = r < 0.3 ? S[4] : r < 0.55 ? S[2] : r > 0.95 ? S[5] : S[3]; run = 1 + Math.floor(hash(y, x, 92) * 3); }
        px(im, x, y, x === 13 ? S[2] : x === 2 ? (col === S[2] ? S[3] : S[4]) : col);
        run--;
      }
    }
    [[1, 9], [14, 14], [1, 16], [0, 15], [15, 13]].forEach(function (p, k) { px(im, p[0], p[1], k % 2 ? S[4] : S[3]); });
    // linen pillow, tied at the ends
    rrect(im, 4, 7, 8, 4, 1, function (x, y, i, j) { return j === 0 ? CRM[5] : i === 0 ? CRM[4] : j === 3 || i === 7 ? CRM[2] : CRM[3]; });
    px(im, 3, 8, CRM[3]); px(im, 3, 9, CRM[2]); px(im, 12, 8, CRM[2]); px(im, 12, 9, CRM[1]);
    px(im, 7, 9, CRM[2]); px(im, 8, 9, CRM[2]);
    // patchwork blanket, turned down to show its cream lining
    patchwork(im, 1, 19, 14, 31, 7, 4);
    hline(im, 1, 14, 17, CRM[4]); hline(im, 1, 14, 18, CRM[2]); px(im, 1, 17, CRM[5]); px(im, 14, 17, CRM[3]);
    hline(im, 1, 14, 32, '#2a2048');
    // foot rail + legs
    hline(im, 1, 14, 33, R[3]); px(im, 1, 33, R[4]);
    vline(im, 1, 34, 34, R[3]); vline(im, 2, 34, 34, R[2]); vline(im, 13, 34, 34, R[2]); vline(im, 14, 34, 34, R[1]);
    outline(im, 'sel');
    floorShadow(im, 2, 13, 34, 35, 0.3);
    return im;
  }
  def({ id: 'furn_cot', name: 'Simple Cot', w: 1, h: 2, hr: 4, price: 800, seller: 'mirabel' }, drawCot, null);

  // ---------------------------------------------------------------------------
  // Cat Bed (1x1) 16x18 — plush plum bolster, cream cushion (Inkwell may sleep in it)
  // ---------------------------------------------------------------------------
  function drawCatBed(im) {
    var P = PLV, cx = 7.5, cy = 11, ox = 7, oy = 5, ix = 4.4, iy = 2.5, icy = 10.4;
    for (var y = 5; y <= 17; y++) for (var x = 0; x <= 15; x++) {
      var dx = (x + 0.5 - cx - 0.5) / (ox + 0.45), dy = (y + 0.5 - cy - 0.5) / (oy + 0.45);
      if (dx * dx + dy * dy > 1) continue;
      var ex = (x - cx) / (ix + 0.45), ey = (y - icy) / (iy + 0.45);
      if (ex * ex + ey * ey <= 1) continue;
      // plush torus shading: lit toward the upper-left, dark toward the front-right
      var ang = Math.atan2(y - cy, x - cx), r = Math.sqrt(dx * dx + dy * dy);
      var l = -Math.cos(ang) * 0.45 - Math.sin(ang) * 0.75;
      var u = clamp((r - 0.55) / 0.45, 0, 1);
      var v = l * (u - 0.35) + (u > 0.25 && u < 0.75 ? 0.35 : 0);
      px(im, x, y, v > 0.55 ? P[5] : v > 0.2 ? P[4] : v > -0.2 ? P[3] : P[2]);
    }
    // sunken cushion
    ellipse(im, cx, icy, ix, iy, function (x, y, nx, ny) {
      var l = nx * 0.45 + ny * 0.8;
      return l < -0.45 ? CRM[1] : l < 0.1 ? CRM[2] : l < 0.6 ? CRM[3] : CRM[4];
    });
    // front face of the bolster with embroidered stars
    for (var fx = 1; fx <= 14; fx++) {
      for (var fy = 14; fy <= 16; fy++) {
        if (!get(im, fx, fy)) continue;
        var e = (fx - 7.5) / 7;
        if (fy >= 15 || (fy === 14 && Math.abs(e) > 0.6)) px(im, fx, fy, fy === 16 ? P[1] : (fx < 4 ? P[3] : P[2]));
      }
    }
    star4(im, 7, 15, [GLD[2], GLD[3], GLD[4]]);
    px(im, 3, 15, GLD[3]); px(im, 12, 15, GLD[2]);
    outline(im, 'sel');
    ellShadow(im, 7.5, 16.5, 7.5, 1.4, 0.3);
    return im;
  }
  def({ id: 'furn_cat_bed', name: 'Cat Bed', w: 1, h: 1, hr: 0, trim: 2, price: 150, seller: 'mirabel' }, drawCatBed, null);

  // ---------------------------------------------------------------------------
  // Moon Rug (3x2, flat) 48x32 — round-cornered navy rug with a crescent
  // ---------------------------------------------------------------------------
  function drawMoonRug(im) {
    var N = NAV;
    for (var y = 3; y <= 28; y += 2) { px(im, 1, y, CRM[3]); px(im, 2, y, CRM[2]); px(im, 45, y, CRM[2]); px(im, 46, y, CRM[1]); }
    rrect(im, 3, 1, 42, 30, 4, function (x, y, i, j) {
      var e = Math.min(i, j, 41 - i, 29 - j);
      if (e === 0) return N[0];
      if (e === 1) return N[1];
      if (e === 2) return (i + j) % 2 ? N[2] : N[1];
      if (e === 3) return SLV[2];
      var t = (i / 41) * 0.5 + (j / 29) * 0.5, r = hash(x, y, 77);
      var b = 3;
      if (t < 0.4 && r < 0.18) b = 4;
      if (t > 0.6 && r < 0.2) b = 2;
      if (r > 0.97) b = 4;
      return N[b];
    });
    // little silver crescents in the corners of the field
    [[7, 6], [39, 6], [7, 24], [39, 24]].forEach(function (p) { px(im, p[0], p[1], SLV[3]); px(im, p[0] + 1, p[1] - 1, SLV[2]); px(im, p[0] + 1, p[1] + 1, SLV[2]); });
    // the crescent
    var cx = 22, cy = 15.5;
    ellipse(im, cx, cy, 8, 8, function (x, y, nx, ny) {
      var dx = x - (cx + 3.6), dy = y - (cy - 2.2);
      if (dx * dx + dy * dy < 7.6 * 7.6) return undefined;
      return ny < -0.35 || nx < -0.55 ? CRM[5] : (nx + ny > 0.6 ? SLV[3] : CRM[4]);
    });
    star4(im, 30, 9, [GLD[2], GLD[3], GLD[5]]); star4(im, 33, 21, [GLD[2], GLD[3], GLD[4]]);
    [[13, 22, GLD[4]], [36, 13, GLD[4]], [11, 8, SLV[4]], [27, 15, SLV[4]], [39, 9, SLV[3]], [9, 15, GLD[3]], [38, 24, SLV[3]], [26, 25, GLD[3]]]
      .forEach(function (s) { px(im, s[0], s[1], s[2]); });
    return im;
  }
  function iconMoonRug() {
    var im = img(16, 16), N = NAV;
    for (var y = 4; y <= 11; y += 2) { px(im, 0, y, CRM[3]); px(im, 15, y, CRM[2]); }
    rrect(im, 1, 3, 14, 10, 2, function (x, y, i, j) {
      var e = Math.min(i, j, 13 - i, 9 - j);
      return e === 0 ? N[1] : e === 1 ? SLV[2] : N[(i + j) > 12 ? 3 : 4];
    });
    stamp(im, 5, 5, ['..cc', '.cc.', 'cc..', 'cc..', '.cc.', '..cc'].slice(0, 6), { c: CRM[5] });
    px(im, 10, 6, GLD[4]); px(im, 11, 10, GLD[4]); px(im, 3, 9, SLV[4]);
    return im;
  }
  def({ id: 'furn_rug_moon', name: 'Moon Rug', w: 3, h: 2, flat: true, price: 1200, seller: 'isolde' }, drawMoonRug, iconMoonRug);

  // ---------------------------------------------------------------------------
  // Star Rug (2x2, flat) 32x32 — violet with a gold star pattern
  // ---------------------------------------------------------------------------
  function star8(im, cx, cy, ro, rd, ri, C, rim) {
    function pts(grow) {
      var p = [];
      for (var k = 0; k < 16; k++) {
        var a = -Math.PI / 2 + k * Math.PI / 8, r = (k % 4 === 0 ? ro : k % 4 === 2 ? rd : ri) + grow;
        p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      return p;
    }
    if (rim) poly(im, pts(1.1), rim);
    poly(im, pts(0), function (x, y) {
      var dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      var ang = Math.atan2(dy, dx), seg = ((ang + Math.PI * 2.5) % (Math.PI / 4)) / (Math.PI / 4);
      // each point has a lit and a shaded facet; facets facing the top-left are lighter
      var face = Math.atan2(dy, dx) + (seg < 0.5 ? -0.3 : 0.3);
      var l = -Math.cos(face) * 0.6 - Math.sin(face) * 0.8;
      return l > 0.35 ? C[4] : l > -0.25 ? C[3] : C[2];
    });
    px(im, Math.floor(cx - 0.5), Math.floor(cy - 0.5), C[5]);
  }
  function drawStarRug(im) {
    var V = VIO;
    rrect(im, 1, 1, 30, 30, 3, function (x, y, i, j) {
      var e = Math.min(i, j, 29 - i, 29 - j);
      if (e === 0) return V[0];
      if (e === 1 || e === 2) {
        var along = (i === e || i === 29 - e) ? j : i;
        if (e === 1 && along % 4 === 1) return GLD[2];
        if (e === 2 && along % 4 === 3) return GLD[2];
        return V[1];
      }
      if (e === 3) return GLD[3];
      if (e === 4) return V[2];
      var r = hash(x, y, 55);
      return r < 0.05 ? V[4] : r > 0.95 ? V[2] : V[3];
    });
    star8(im, 16, 16, 11, 7, 3.6, GLD, V[1]);
    [[7, 7], [24, 7], [7, 24], [24, 24]].forEach(function (p) { star4(im, p[0], p[1], [GLD[2], GLD[3], GLD[4]]); });
    [[16, 4], [4, 16], [27, 16], [16, 27]].forEach(function (p) { px(im, p[0], p[1], GLD[2]); });
    return im;
  }
  function iconStarRug() {
    var im = img(16, 16), V = VIO;
    rrect(im, 1, 1, 14, 14, 2, function (x, y, i, j) {
      var e = Math.min(i, j, 13 - i, 13 - j);
      return e === 0 ? V[0] : e === 1 ? ((i + j) % 3 === 0 ? GLD[2] : V[1]) : e === 2 ? GLD[3] : V[3];
    });
    var st = ['....4....', '....4....', '...443...', '..44543..', '444555333', '..34532..', '...332...', '....3....', '....2....'];
    stamp(im, 3, 3, st, { 2: GLD[2], 3: GLD[3], 4: GLD[4], 5: GLD[5] });
    return im;
  }
  def({ id: 'furn_rug_star', name: 'Star Rug', w: 2, h: 2, flat: true, price: 950, seller: 'isolde' }, drawStarRug, iconStarRug);

  // ---------------------------------------------------------------------------
  // Round Braided Rug (2x2, flat) 32x32
  // ---------------------------------------------------------------------------
  var BRAID = [
    ['#4a2440', '#6e3a5e'], ['#8a6a34', '#b08a48'], ['#433a72', '#615496'], ['#a89a84', '#cdbfa4'],
    ['#3e5a46', '#58785c'], ['#6e3a5e', '#94527c'], ['#8a6a34', '#b08a48'], ['#a89a84', '#cdbfa4']
  ];
  function braidDisc(im, cx, cy, R, ringW) {
    for (var y = Math.floor(cy - R - 1); y <= Math.ceil(cy + R + 1); y++)
      for (var x = Math.floor(cx - R - 1); x <= Math.ceil(cx + R + 1); x++) {
        var dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > R) continue;
        var depth = R - d, ring = Math.min(BRAID.length - 1, Math.floor(depth / ringW));
        var row = Math.floor(depth - ring * ringW);
        var P = BRAID[ring], ang = Math.atan2(dy, dx);
        var arc = (ang + Math.PI) * Math.max(1.5, d);
        var s = Math.floor((arc + row * 1.2) / 1.6);
        var c = (s % 2) ? P[1] : P[0];
        if (depth < 0.8) c = dk(P[0], 0.3);
        px(im, x, y, c);
      }
  }
  function drawRoundRug(im) {
    braidDisc(im, 16, 16, 15.3, 2);
    // a few stitched joins where the braid was sewn
    px(im, 16, 1, '#2a1428'); px(im, 30, 16, '#2a1428');
    return im;
  }
  function iconRoundRug() {
    var im = img(16, 16);
    braidDisc(im, 8, 8, 7.4, 1.5);
    return im;
  }
  def({ id: 'furn_rug_round', name: 'Round Braided Rug', w: 2, h: 2, flat: true, price: 800, seller: 'mirabel' }, drawRoundRug, iconRoundRug);

  // ---------------------------------------------------------------------------
  // Tall Bookshelf (2x1, tall) 32x44
  // ---------------------------------------------------------------------------
  function cornice(im, x0, x1, y, R) {
    hline(im, x0, x1, y, R[4]); hline(im, x0, x0 + 7, y, R[5]);
    hline(im, x0, x1, y + 1, R[3]);
    for (var x = x0; x <= x1; x++) px(im, x, y + 2, x % 2 ? R[4] : R[2]);
    hline(im, x0, x1, y + 3, R[1]);
  }
  function pediment(im, cx, y, R) {
    // shallow Gothic gable with a gold moon disc, apex at (cx, y)
    stamp(im, cx - 5, y, [
      '....45....',
      '...4433...',
      '..443332..',
      '.44333322.',
      '4433333322'
    ], rampLeg('012345', R));
    px(im, cx - 1, y + 2, GLD[4]); px(im, cx, y + 2, GLD[3]); px(im, cx - 1, y + 3, GLD[3]); px(im, cx, y + 3, GLD[2]);
  }
  function drawBookshelf(im) {
    var R = DW, oy = 2;
    // sides + back panel
    woodV(im, 2, oy + 6, 2, 31, R, 31, 3); vline(im, 2, oy + 6, oy + 36, R[4]);
    woodV(im, 28, oy + 6, 2, 31, R, 32, 2); vline(im, 29, oy + 6, oy + 36, R[1]);
    rect(im, 4, oy + 6, 24, 30, R[1]);
    for (var bx = 9; bx < 28; bx += 6) vline(im, bx, oy + 6, oy + 35, R[0]);
    hline(im, 4, 27, oy + 6, R[0]);
    // books
    bookRow(im, 4, 27, oy + 13, 7, 101, { gaps: 0.1 });
    bookRow(im, 4, 17, oy + 22, 7, 202);
    bookRow(im, 4, 27, oy + 31, 7, 303, { gaps: 0.06 });
    // a stack of books lying flat + a little skull
    var sy = oy + 17;
    [[PLV[3], PLV[4], 20, 26], [NAV[3], NAV[4], 19, 25], ['#94642a', '#c49040', 20, 26]].forEach(function (b, k) {
      hline(im, b[2], b[3], sy + k * 2, b[1]); hline(im, b[2], b[3], sy + k * 2 + 1, b[0]);
      px(im, b[3], sy + k * 2, PAP[4]); px(im, b[3], sy + k * 2 + 1, PAP[3]);
      px(im, b[2] + 2, sy + k * 2 + 1, GLD[3]);
    });
    stamp(im, 21, sy - 4, ['.bbb.', 'bbbbb', 'bkbkb', '.bdb.'], { b: BN[4], k: OUT, d: BN[2] });
    px(im, 22, sy - 4, BN[5]); px(im, 25, sy - 3, BN[3]);
    // shelf boards
    [oy + 14, oy + 23, oy + 32].forEach(function (y) {
      hline(im, 3, 28, y, R[4]); hline(im, 3, 28, y + 1, R[2]); px(im, 3, y, R[5]);
    });
    hline(im, 4, 27, oy + 16, R[0]); hline(im, 4, 27, oy + 25, R[0]);
    // crown
    pediment(im, 16, 0, R);
    cornice(im, 1, 30, oy + 3, R);
    // plinth + feet
    rect(im, 1, oy + 34, 30, 5, R[2]); hline(im, 1, 30, oy + 34, R[4]); hline(im, 1, 30, oy + 35, R[3]);
    hline(im, 1, 30, oy + 38, R[1]); vline(im, 1, oy + 34, oy + 38, R[3]);
    inset(im, 5, oy + 36, 22, 2, R, 2);
    rect(im, 2, oy + 39, 3, 1, R[2]); px(im, 2, oy + 39, R[3]); rect(im, 27, oy + 39, 3, 1, R[1]);
    outline(im, 'sel');
    floorShadow(im, 2, 29, oy + 38, oy + 41, 0.34);
    return im;
  }
  function iconBookshelf() {
    var im = img(16, 16), R = DW;
    rect(im, 1, 0, 14, 16, R[1]);
    hline(im, 1, 14, 0, R[4]); hline(im, 1, 14, 1, R[2]);
    vline(im, 1, 0, 15, R[4]); vline(im, 2, 1, 15, R[3]); vline(im, 13, 1, 15, R[2]); vline(im, 14, 1, 15, R[1]);
    bookRow(im, 3, 12, 5, 4, 11, { gaps: 0 }); bookRow(im, 3, 12, 10, 4, 12, { gaps: 0 });
    hline(im, 2, 13, 6, R[4]); hline(im, 2, 13, 11, R[4]);
    rect(im, 2, 12, 12, 4, R[2]); hline(im, 2, 13, 12, R[4]); hline(im, 2, 13, 15, R[1]); inset(im, 4, 13, 8, 2, R, 2);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_bookshelf', name: 'Tall Bookshelf', w: 2, h: 1, hr: 28, price: 1500, seller: 'isolde' }, drawBookshelf, iconBookshelf);

  // ---------------------------------------------------------------------------
  // Potion Shelf (2x1, tall, glowing) 32x40
  // ---------------------------------------------------------------------------
  function archTop(x, apex, side) { // pointed arch: y of the top edge at column x (span 1..30)
    var d = Math.max(0, Math.abs(x - 15.5) - 0.5) / 14.5;
    return apex + Math.round((side - apex) * Math.pow(d, 0.72));
  }
  function drawPotionShelf(im) {
    var R = DW;
    // carcass under a pointed arch
    for (var x = 1; x <= 30; x++) {
      var t = archTop(x, 2, 8);
      for (var y = t; y <= 37; y++) px(im, x, y, R[1]);
      px(im, x, t, x <= 15 ? R[5] : R[3]);
      px(im, x, t + 1, x <= 15 ? R[4] : R[3]);
      px(im, x, t + 2, R[2]);
      px(im, x, t + 3, R[0]);
    }
    woodV(im, 1, 9, 2, 29, R, 41, 3); vline(im, 1, 8, 37, R[4]);
    woodV(im, 29, 9, 2, 29, R, 42, 2); vline(im, 30, 8, 37, R[1]);
    for (var bx = 8; bx < 29; bx += 7) for (var by = 6; by <= 30; by++) if (get(im, bx, by) === R[1] && get(im, bx, by - 1) !== R[2]) px(im, bx, by, R[0]);
    // gold finial at the apex
    px(im, 15, 0, GLD[4]); px(im, 16, 0, GLD[3]); px(im, 15, 1, GLD[3]); px(im, 16, 1, GLD[2]);
    // shelves
    function board(y) { hline(im, 3, 28, y, R[4]); hline(im, 3, 28, y + 1, R[2]); px(im, 3, y, R[5]); hline(im, 3, 28, y + 2, R[0]); }
    // bottles — shelf 1 (under the arch)
    bottle(im, 12, 14, 'roundBig', LQ.emerald);
    bottle(im, 8, 14, 'tall', LQ.violet);
    bottle(im, 20, 14, 'jar', ['#3a5a2a', '#5e8a3a', '#86b44e', '#c4e47a']);
    bottle(im, 25, 14, 'vial', LQ.rose); bottle(im, 5, 14, 'vial', LQ.cyan);
    board(15);
    // shelf 2
    bottle(im, 3, 23, 'round', LQ.violet);
    bottle(im, 9, 23, 'tall', LQ.rose);
    bottle(im, 13, 23, 'square', LQ.amber);
    bottle(im, 18, 23, 'vial2', LQ.cyan);
    bottle(im, 21, 23, 'round', LQ.emerald);
    bottle(im, 27, 23, 'vial', LQ.violet);
    board(24);
    // shelf 3
    bottle(im, 3, 31, 'jar', ['#5a2a1a', '#8a4a2a', '#b46a3a', '#e0a060']);
    bottle(im, 8, 31, 'flask', LQ.rose);
    bottle(im, 14, 31, 'tall', LQ.emerald);
    stamp(im, 18, 27, ['.bbb.', 'bkbkb', '.bbb.', '.b.b.'], { b: BN[4], k: '#5dffb0' });
    px(im, 18, 26, BN[3]);
    bottle(im, 24, 31, 'round', LQ.amber);
    board(32);
    // light spill from the bottles on the back panel
    spill(im, 15, 10, 9, '#5dffb0', 0.22);
    spill(im, 8, 19, 7, '#b99aee', 0.2);
    spill(im, 22, 20, 7, '#5dffb0', 0.18);
    spill(im, 10, 28, 6, '#e89ab8', 0.18);
    // lower cabinet + plinth
    rect(im, 2, 33, 28, 4, R[3]);
    inset(im, 3, 33, 13, 4, R, 3); inset(im, 16, 33, 13, 4, R, 3);
    px(im, 14, 35, BRS[4]); px(im, 17, 35, BRS[4]);
    hline(im, 1, 30, 37, R[2]); hline(im, 1, 30, 38, R[1]); px(im, 1, 37, R[3]);
    outline(im, 'sel');
    floorShadow(im, 2, 29, 37, 39, 0.34);
    halo(im, 15, 9, 1.5, EMG[3], 0.2);
    return im;
  }
  def({ id: 'furn_potion_shelf', name: 'Potion Shelf', w: 2, h: 1, hr: 24, price: 1700, seller: 'mirabel',
    light: { x: 15, y: 11, r: 44, color: [140, 226, 200] } }, drawPotionShelf, null);

  // ---------------------------------------------------------------------------
  // Wardrobe (2x1, tall) 32x44
  // ---------------------------------------------------------------------------
  // raised panel with a pointed (lancet) arch top; x0..x0+w-1, y0..y0+h-1
  function lancetPanel(im, x0, y0, w, h, R) {
    var half = Math.floor(w / 2);
    for (var i = 0; i < w; i++) {
      var k = i < half ? half - 1 - i : i - half;          // 0 at the two apex columns
      var top = y0 + Math.min(k, half - 1) + (k > 0 ? Math.floor(k / 2) : 0);
      for (var y = top; y < y0 + h; y++) px(im, x0 + i, y, R[3]);
      px(im, x0 + i, top, i < half ? R[5] : R[3]);
      if (i < half && top + 1 < y0 + h) px(im, x0 + i, top + 1, R[4]);
    }
    var sideTop = y0 + (half - 1) + Math.floor((half - 1) / 2);
    vline(im, x0, sideTop, y0 + h - 2, R[4]);
    vline(im, x0 + w - 1, sideTop + 1, y0 + h - 1, R[2]);
    hline(im, x0 + 1, x0 + w - 1, y0 + h - 1, R[2]);
  }
  function drawWardrobe(im) {
    var R = DW;
    // body
    woodV(im, 2, 9, 28, 28, R, 51, 3);
    vline(im, 2, 9, 36, R[4]); vline(im, 3, 9, 36, R[3]); vline(im, 28, 9, 36, R[2]); vline(im, 29, 9, 36, R[1]);
    // doors
    function door(x0, lit) {
      rect(im, x0, 10, 12, 26, R[3]);
      hline(im, x0, x0 + 11, 10, R[4]); vline(im, x0, 10, 35, lit ? R[4] : R[3]);
      hline(im, x0 + 1, x0 + 11, 35, R[1]); vline(im, x0 + 11, 11, 35, R[2]);
      // recessed field around a raised lancet panel, a gold star in its arch
      rect(im, x0 + 2, 12, 8, 22, R[2]); hline(im, x0 + 2, x0 + 9, 12, R[1]); vline(im, x0 + 2, 12, 33, R[1]);
      lancetPanel(im, x0 + 2, 13, 8, 20, R);
      star4(im, x0 + 5, 20, [GLD[1], GLD[2], GLD[4]]); px(im, x0 + 6, 20, GLD[2]); px(im, x0 + 6, 21, GLD[1]); px(im, x0 + 6, 19, GLD[3]);
    }
    door(4, true); door(16, false);
    vline(im, 15, 10, 35, R[0]);
    // handles + keyhole
    stamp(im, 13, 21, ['b.', 'B.', 'b.'], { b: BRS[2], B: BRS[4] });
    stamp(im, 18, 21, ['b', 'B', 'b'], { b: BRS[2], B: BRS[4] });
    px(im, 17, 25, OUT); px(im, 17, 24, BRS[3]); px(im, 17, 26, BRS[2]);
    // crown
    pediment(im, 16, 0, R);
    cornice(im, 1, 30, 5, R);
    hline(im, 2, 29, 9, R[0]);
    // plinth + bun feet
    rect(im, 1, 36, 30, 4, R[2]); hline(im, 1, 30, 36, R[4]); hline(im, 1, 30, 37, R[3]); hline(im, 1, 30, 39, R[1]); vline(im, 1, 36, 39, R[3]);
    stamp(im, 2, 40, ['.33.', '2332', '.22.'], rampLeg('0123', [R[0], R[1], R[3], R[4]]));
    stamp(im, 26, 40, ['.22.', '1221', '.11.'], rampLeg('0123', [R[0], R[1], R[2], R[3]]));
    outline(im, 'sel');
    floorShadow(im, 2, 29, 39, 43, 0.34);
    return im;
  }
  def({ id: 'furn_wardrobe', name: 'Wardrobe', w: 2, h: 1, hr: 28, price: 1400, seller: 'isolde' }, drawWardrobe, null);

  // ---------------------------------------------------------------------------
  // Standing Mirror (1x1, tall) 16x36 — cheval glass
  // ---------------------------------------------------------------------------
  function drawMirror(im) {
    var R = DW;
    // posts + feet
    for (var y = 6; y <= 31; y++) { px(im, 1, y, R[4]); px(im, 2, y, R[3]); px(im, 13, y, R[3]); px(im, 14, y, R[1]); }
    stamp(im, 1, 4, ['gG', 'Gg'], { g: GLD[3], G: GLD[4] }); stamp(im, 13, 4, ['gs', 'gs'], { g: GLD[3], s: GLD[2] });
    stamp(im, 0, 31, ['.33', '3332', '..22'].map(function (r) { return (r + '....').slice(0, 4); }), rampLeg('0123', [R[0], R[1], R[3], R[4]]));
    stamp(im, 12, 31, ['22.', '1222', '11..'].map(function (r) { return (r + '....').slice(0, 4); }), rampLeg('0123', [R[0], R[1], R[2], R[3]]));
    // oval frame
    ellipse(im, 7.5, 17, 5, 12.4, function (x, y, nx, ny) { return (nx + ny * 0.6) < -0.2 ? GLD[4] : (nx + ny * 0.6) < 0.4 ? GLD[3] : GLD[2]; });
    ellipse(im, 7.5, 17, 4, 11.4, GLD[1]);
    // glass
    ellipse(im, 7.5, 17, 3.4, 10.8, function (x, y, nx, ny) {
      var t = (nx * 0.4 + ny * 0.9 + 1) / 2;
      var c = t < 0.3 ? SLV[4] : t < 0.55 ? SLV[3] : t < 0.8 ? '#9a8ccc' : '#6e5ea8';
      return c;
    });
    // shine streaks
    line(im, 5, 12, 8, 7, alpha(WHITE, 0.85)); line(im, 5, 15, 9, 9, alpha(WHITE, 0.5)); line(im, 7, 24, 9, 21, alpha(WHITE, 0.35));
    // pivots
    px(im, 2, 17, GLD[4]); px(im, 13, 17, GLD[3]); px(im, 3, 17, GLD[2]); px(im, 12, 17, GLD[2]);
    px(im, 7, 4, GLD[4]); px(im, 8, 4, GLD[3]); px(im, 7, 3, GLD[3]);
    outline(im, 'sel');
    ellShadow(im, 7.5, 33.5, 7, 1.6, 0.3);
    return im;
  }
  def({ id: 'furn_mirror', name: 'Standing Mirror', w: 1, h: 1, hr: 18, trim: 2, price: 600, seller: 'isolde' }, drawMirror, null);

  // ---------------------------------------------------------------------------
  // Candelabra (1x1, warm light) 16x36
  // ---------------------------------------------------------------------------
  function drawCandelabra(im) {
    var I = IRN, B = BRS, o = 3;
    // tripod feet + base
    stamp(im, 1, 31 + o, [
      '...i.......i..',
      '..ii.......ii.',
      '.bb.........bb'
    ], { i: I[3], b: B[3] });
    stamp(im, 5, 30 + o, ['.iiii.', 'iIIIIi', '.bbbb.'], { i: I[3], I: I[4], b: B[2] });
    px(im, 7, 33 + o, B[3]); px(im, 8, 33 + o, B[2]);
    // stem with brass knops
    for (var y = 11 + o; y <= 30 + o; y++) { px(im, 7, y, I[4]); px(im, 8, y, I[2]); }
    stamp(im, 6, 19 + o, ['bbbb', 'BBBb'], { b: B[3], B: B[4] }); px(im, 9, 20 + o, B[1]);
    stamp(im, 6, 26 + o, ['.bb.', 'bBBb', '.bb.'], { b: B[2], B: B[4] });
    // scrolled arms
    stamp(im, 2, 9 + o, [
      '.c........c.',
      'cCc......cCc',
      '.i........i.',
      '.i........i.',
      '..i......i..',
      '...ii..ii...',
      '.....ii.....'
    ], { i: I[4], c: B[3], C: B[4] });
    px(im, 3, 11 + o, I[5]);
    hline(im, 6, 9, 10 + o, B[3]); px(im, 6, 10 + o, B[4]); px(im, 9, 10 + o, B[2]);
    // candles
    candle(im, 7, 3 + o, 9 + o, true, true);
    candle(im, 2, 6 + o, 8 + o, false, false);
    candle(im, 11, 6 + o, 8 + o, false, true);
    outline(im, 'sel');
    ellShadow(im, 7.5, 33.5 + o, 6.5, 1.8, 0.32);
    halo(im, 7, 2, 2.5, CANDLE, 0.22);
    return im;
  }
  function iconCandelabra() {
    var im = img(16, 16), I = IRN, B = BRS;
    for (var y = 11; y <= 14; y++) { px(im, 7, y, I[4]); px(im, 8, y, I[2]); }
    hline(im, 6, 9, 12, B[3]); px(im, 6, 12, B[4]);
    hline(im, 4, 11, 15, B[3]); px(im, 4, 15, B[4]); px(im, 11, 15, B[2]); hline(im, 5, 10, 14, I[3]);
    stamp(im, 2, 8, [
      'cCc......cCc',
      '.i........i.',
      '..ii....ii..',
      '....iiii....'
    ], { i: I[4], c: B[3], C: B[4] });
    hline(im, 6, 9, 9, B[3]);
    candle(im, 7, 4, 8, true, true);
    candle(im, 2, 6, 7, false, false);
    candle(im, 11, 6, 7, false, true);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_candelabra', name: 'Candelabra', w: 1, h: 1, hr: 23, price: 550, seller: 'brann',
    light: { x: 7, y: 2, r: 52, color: L_WARM } }, drawCandelabra, iconCandelabra);

  // ---------------------------------------------------------------------------
  // Crystal Lamp (1x1, violet light) 16x30 — amethyst cluster on a Gothic column
  // ---------------------------------------------------------------------------
  function prism(im, x0, w, yTip, yBase, lean, C) {
    // crystal: pointed prism; C = [deep, dark, mid, light, core, white]
    for (var y = yTip; y <= yBase; y++) {
      var k = y - yTip, half = Math.min(w / 2, (k + 1) * 0.75);
      var off = lean * (yBase - y) / (yBase - yTip + 1);
      var cx = x0 + (w - 1) / 2 + off;
      for (var x = Math.floor(cx - half + 0.5); x <= Math.ceil(cx + half - 0.5); x++) {
        var u = (x - (cx - half + 0.5)) / Math.max(1, 2 * half - 1);
        var c = u < 0.3 ? C[3] : u < 0.55 ? C[2] : u < 0.8 ? C[1] : C[0];
        if (k < 2) c = u < 0.5 ? C[4] : C[2];
        px(im, x, y, c);
      }
      if (k > 1 && k < yBase - yTip - 1) px(im, Math.round(cx - half * 0.2), y, C[4]);
    }
    px(im, Math.round(x0 + (w - 1) / 2 + lean), yTip, C[5]);
  }
  function drawCrystalLamp(im) {
    var S = STN, C = ['#2a1650', '#4a2f7a', '#8f6cd1', '#b99aee', '#e4d2ff', '#ffffff'];
    // plinth
    rect(im, 2, 25, 12, 4, S[2]); hline(im, 2, 13, 25, S[4]); hline(im, 2, 13, 26, S[3]); hline(im, 3, 13, 28, S[1]); vline(im, 2, 25, 28, S[3]); vline(im, 13, 26, 28, S[1]);
    hline(im, 3, 12, 24, S[3]); px(im, 3, 24, S[4]);
    // fluted shaft
    for (var y = 16; y <= 23; y++) {
      var cols = [S[4], S[3], S[2], S[4], S[3], S[2], S[3], S[1]];
      for (var i = 0; i < 8; i++) px(im, 4 + i, y, cols[i]);
    }
    // capital
    hline(im, 3, 12, 13, S[5]); hline(im, 3, 12, 14, S[4]); hline(im, 4, 11, 15, S[2]); px(im, 12, 14, S[2]); px(im, 3, 14, S[5]);
    // brass collar
    hline(im, 5, 10, 12, BRS[3]); px(im, 5, 12, BRS[4]); px(im, 10, 12, BRS[2]); hline(im, 5, 10, 11, BRS[2]);
    // crystals
    prism(im, 3, 3, 5, 11, -0.8, C);
    prism(im, 10, 3, 6, 11, 0.8, C);
    prism(im, 6, 4, 1, 11, 0, C);
    // sparkles & spill on the capital
    sparkle(im, 2, 3, '#e4d2ff', false); px(im, 13, 2, alpha('#e4d2ff', 0.8));
    spill(im, 7.5, 13, 4, '#b99aee', 0.35);
    outline(im, 'sel');
    ellShadow(im, 7.5, 28.5, 6.5, 1.4, 0.3);
    halo(im, 7.5, 6, 4, '#b99aee', 0.18);
    return im;
  }
  def({ id: 'furn_crystal_lamp', name: 'Crystal Lamp', w: 1, h: 1, hr: 14, price: 600, seller: 'orvyn',
    light: { x: 7, y: 6, r: 42, color: L_VIOLET } }, drawCrystalLamp, null);

  // ---------------------------------------------------------------------------
  // Lantern Stand (1x1, emerald light) 16x36 — shepherd's hook with a witch-light
  // ---------------------------------------------------------------------------
  function drawLanternStand(im) {
    var I = IRN, B = BRS, G = EMG;
    // feet
    stamp(im, 0, 31, [
      '...ii....',
      '..i..i...',
      '.i....i..',
      'bb.....bb'
    ], { i: I[3], b: B[2] });
    px(im, 1, 34, B[3]);
    // post with a brass ring
    for (var y = 3; y <= 31; y++) { px(im, 3, y, I[4]); px(im, 4, y, I[2]); }
    hline(im, 2, 5, 20, B[3]); px(im, 2, 20, B[4]); px(im, 5, 20, B[1]);
    // hook + brace + curl
    hline(im, 4, 10, 2, I[4]); hline(im, 4, 10, 3, I[2]); px(im, 3, 2, I[4]); px(im, 11, 3, I[3]); px(im, 11, 4, I[3]);
    px(im, 2, 3, I[3]); px(im, 2, 2, I[4]); px(im, 3, 1, I[4]);
    line(im, 5, 8, 9, 4, I[3]);
    px(im, 11, 5, B[3]);
    // lantern
    stamp(im, 8, 6, [
      '...b...',
      '..bBb..',
      '.bBBbb.',
      'iIIIIii',
      'i.....i',
      'i.....i',
      'i.....i',
      'i.....i',
      'i.....i',
      'i.....i',
      'iIIIIii',
      '.bbbbb.',
      '..b.b..'
    ], { i: I[3], I: I[4], b: B[2], B: B[4] });
    // glass + flame
    for (var gy = 10; gy <= 15; gy++) for (var gx = 9; gx <= 13; gx++) px(im, gx, gy, gy < 12 ? G[1] : G[2]);
    stamp(im, 9, 10, [
      '.....',
      '..3..',
      '.343.',
      '.454.',
      '34543',
      '.444.'
    ], { 3: G[3], 4: G[4], 5: G[5] });
    vline(im, 9, 10, 15, alpha(WHITE, 0.25));
    outline(im, 'sel');
    ellShadow(im, 4.5, 34, 5, 1.4, 0.3);
    halo(im, 11, 13, 4, G[3], 0.2);
    return im;
  }
  def({ id: 'furn_lantern_stand', name: 'Lantern Stand', w: 1, h: 1, hr: 20, price: 500, seller: 'brann',
    light: { x: 11, y: 13, r: 46, color: L_EMERALD } }, drawLanternStand, null);

  // ---------------------------------------------------------------------------
  // Plants
  // ---------------------------------------------------------------------------
  // a fern frond along a quadratic curve; leaflets on both sides
  function frond(im, p0, p1, p2, maxL, front) {
    var P = bez(p0, p1, p2, 18), n = P.length - 1;
    for (var k = 1; k <= n; k++) {
      var t = k / n, a = P[k], b = P[k - 1];
      var tx = a[0] - b[0], ty = a[1] - b[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
      tx /= tl; ty /= tl;
      var nx = -ty, ny = tx;
      var L = t < 0.12 ? 0 : (t > 0.3 && t < 0.7 ? maxL : 1);
      var s = (k % 2) ? 1 : -1;
      for (var l = 1; l <= L; l++) {
        var x = a[0] + nx * s * l + tx * 0.7 * l, y = a[1] + ny * s * l + ty * 0.7 * l;
        var up = ny * s < 0;
        px(im, Math.round(x), Math.round(y), up ? LEAF[front ? (l === L ? 6 : 5) : 4] : LEAF[front ? 4 : 3]);
      }
      px(im, Math.round(a[0]), Math.round(a[1]), front ? LEAF[3] : LEAF[2]);
    }
    px(im, Math.round(p2[0]), Math.round(p2[1]), front ? LEAF[6] : LEAF[4]);
  }
  function clayPot(im, R, yRim, band) {
    // rim (top lip seen slightly from above) + tapered body; R dark->light (6)
    hline(im, 3, 12, yRim, R[5]); hline(im, 3, 12, yRim + 1, R[4]); px(im, 12, yRim, R[3]); px(im, 12, yRim + 1, R[2]);
    hline(im, 4, 11, yRim - 1, R[2]);
    for (var y = yRim + 2; y <= yRim + 7; y++) {
      var k = y - yRim - 2, x0 = 4 + (k >= 4 ? 1 : 0), x1 = 11 - (k >= 4 ? 1 : 0);
      for (var x = x0; x <= x1; x++) {
        var u = (x - x0) / (x1 - x0);
        px(im, x, y, u < 0.2 ? R[4] : u < 0.6 ? R[3] : u < 0.85 ? R[2] : R[1]);
      }
    }
    hline(im, 4, 11, yRim + 2, R[1]);
    if (band) for (var bx = 4; bx <= 11; bx++) px(im, bx, yRim + 4, bx % 2 ? band[0] : band[1]);
  }
  // ---- Potted Fern (1x1) 16x24
  // an arching fern frond: launched at angle th (deg), length len, bending down by g
  function archFrond(im, x0, y0, th, len, g, tone) {
    var c = Math.cos(th * Math.PI / 180), sn = Math.sin(th * Math.PI / 180), px0 = null;
    var pts = [];
    for (var t = 0; t <= len; t += 0.5) {
      var x = x0 + c * t, y = y0 - sn * t + g * t * t;
      var X = Math.round(x), Y = Math.round(y);
      if (!pts.length || pts[pts.length - 1][0] !== X || pts[pts.length - 1][1] !== Y) pts.push([X, Y, x, y]);
    }
    var n = pts.length;
    for (var k = 1; k < n; k++) {
      var p = pts[k], q = pts[k - 1], tx = p[2] - q[2], ty = p[3] - q[3], tl = Math.sqrt(tx * tx + ty * ty) || 1;
      tx /= tl; ty /= tl;
      var nx = -ty, ny = tx, f = k / n, side = k % 2 ? 1 : -1;
      var L = f < 0.15 ? 0 : (f > 0.3 && f < 0.75 && tone > 0) ? 2 : 1;
      for (var l = 1; l <= L; l++) {
        var lx = Math.round(p[2] + nx * side * l + tx * 0.5 * l), ly = Math.round(p[3] + ny * side * l + ty * 0.5 * l);
        var up = ny * side < 0;
        px(im, lx, ly, tone > 0 ? (up ? LEAF[l === L ? 6 : 5] : LEAF[4]) : (up ? LEAF[4] : LEAF[3]));
      }
      px(im, p[0], p[1], tone > 0 ? LEAF[3] : LEAF[2]);
    }
    var e = pts[n - 1]; px(im, e[0], e[1], tone > 0 ? LEAF[6] : LEAF[4]);
  }
  function drawFern(im) {
    archFrond(im, 7.5, 14, 128, 11, 0.05, 0);
    archFrond(im, 7.5, 14, 52, 11, 0.05, 0);
    archFrond(im, 7.5, 14, 145, 11, 0.07, 0);
    archFrond(im, 7.5, 14, 35, 11, 0.07, 0);
    archFrond(im, 7.5, 14, 96, 11, 0.02, 0);
    clayPot(im, TC, 16, [TC[4], TC[2]]);
    hline(im, 4, 11, 16, '#31233d'); px(im, 4, 16, '#43324d');
    archFrond(im, 7, 15, 158, 10, 0.1, 1);
    archFrond(im, 8, 15, 22, 10, 0.1, 1);
    archFrond(im, 7, 15, 118, 11, 0.06, 1);
    archFrond(im, 8, 15, 62, 11, 0.06, 1);
    archFrond(im, 7.5, 15, 88, 9, 0.03, 1);
    outline(im, 'sel');
    ellShadow(im, 7.5, 23, 4.5, 1, 0.3);
    return im;
  }
  def({ id: 'furn_fern', name: 'Potted Fern', w: 1, h: 1, hr: 4, trim: 4, price: 200, seller: 'mirabel' }, drawFern, null);

  // ---- Moonflower Pot (1x1, soft glow) 16x24
  function moonflower(im, x, y, big) {
    if (big) stamp(im, x, y, [
      '..www..',
      '.wWWWw.',
      'wWWsWWw',
      'wWsCsWw',
      'wWWsWWw',
      '.wWWWw.',
      '..www..'
    ], { w: SLV[3], W: SLV[4], s: '#c8eede', C: WHITE });
    else stamp(im, x, y, ['.ww.', 'wWWw', 'wWCw', '.ww.'], { w: SLV[3], W: SLV[4], C: WHITE });
  }
  function heartLeaf(im, x, y, flip) {
    stamp(im, x, y, ['54.', '443', '.32'], rampLeg('012345', LEAF), flip);
  }
  function drawMoonflowerPot(im) {
    // vines
    path(im, bez([7, 15], [4, 10], [6, 6], 8), LEAF[2]);
    path(im, bez([8, 15], [12, 13], [11, 10], 8), LEAF[2]);
    path(im, bez([7, 15], [2, 14], [3, 11], 8), LEAF[2]);
    heartLeaf(im, 2, 6, false); heartLeaf(im, 9, 4, true); heartLeaf(im, 12, 12, true); heartLeaf(im, 1, 12, false); heartLeaf(im, 8, 11, false);
    heartLeaf(im, 4, 12, true);
    // pot: indigo glazed urn with silver stars
    var N = NAV;
    for (var y = 16; y <= 22; y++) {
      var w = y === 16 ? 4 : y <= 20 ? 5 : y === 21 ? 4 : 3;
      for (var x = 8 - w; x <= 7 + w; x++) {
        var u = (x - (8 - w)) / (2 * w - 1);
        px(im, x, y, u < 0.18 ? N[5] : u < 0.5 ? N[4] : u < 0.8 ? N[3] : N[2]);
      }
    }
    hline(im, 4, 11, 15, N[5]); hline(im, 4, 11, 16, N[3]); px(im, 11, 15, N[3]);
    hline(im, 5, 10, 14, N[1]);
    px(im, 6, 18, SLV[4]); px(im, 9, 19, SLV[3]); px(im, 5, 20, SLV[3]); px(im, 10, 17, SLV[2]);
    hline(im, 5, 10, 22, N[1]);
    // flowers (glowing)
    moonflower(im, 3, 1, true);
    moonflower(im, 10, 6, false);
    px(im, 1, 9, SLV[3]); px(im, 1, 10, SLV[2]); px(im, 2, 9, LIN[4]); px(im, 2, 11, LEAF[3]);
    outline(im, 'sel');
    ellShadow(im, 7.5, 22.5, 5, 1.2, 0.3);
    halo(im, 6, 4, 4.5, '#c8d4f0', 0.18);
    return im;
  }
  def({ id: 'furn_moonflower_pot', name: 'Moonflower Pot', w: 1, h: 1, hr: 8, price: 350, seller: 'mirabel',
    light: { x: 6, y: 4, r: 28, color: L_MOON } }, drawMoonflowerPot, null);

  // ---- Potted Tree (1x1, tall) 16x40 — a little cloud-pruned tree in a white urn
  function leafCloud(im, cx, cy, rx, ry, seed) {
    var Lr = [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5]];
    var tmp = img(im.w, im.h);
    sphere(tmp, cx, cy, rx, ry, Lr, { bias: 0.08 });
    for (var y = 0; y < im.h; y++) for (var x = 0; x < im.w; x++) {
      var c = get(tmp, x, y);
      if (!c) continue;
      var edge = !get(tmp, x - 1, y) || !get(tmp, x + 1, y) || !get(tmp, x, y - 1) || !get(tmp, x, y + 1);
      var r = hash(x, y, seed);
      if (edge && r < 0.35) continue;
      var i = Lr.indexOf(c);
      if (r > 0.8 && i < 4) c = Lr[i + 1];
      px(im, x, y, c);
    }
  }
  function drawPottedTree(im) {
    var W = WCR;
    // trunk + branches
    for (var y = 12; y <= 27; y++) { px(im, 7, y, WD[4]); px(im, 8, y, WD[2]); }
    line(im, 7, 15, 4, 11, WD[3]); line(im, 8, 14, 11, 10, WD[2]); line(im, 7, 12, 7, 7, WD[3]);
    px(im, 8, 21, WD[3]); px(im, 7, 24, WD[3]);
    // leaf clouds
    leafCloud(im, 4, 10.5, 3.6, 2.8, 71);
    leafCloud(im, 11.5, 9.5, 3.6, 2.8, 72);
    leafCloud(im, 7.5, 4.5, 4.4, 3.6, 73);
    leafCloud(im, 7.5, 13, 2.6, 1.8, 74);
    [[5, 2], [6, 3], [3, 9], [10, 7], [4, 2]].forEach(function (p) { pxOn(im, p[0], p[1], LEAF[6]); });
    [[9, 3], [12, 9], [3, 11], [6, 6], [8, 13]].forEach(function (p) { pxOn(im, p[0], p[1], CRM[5]); });
    // white planter: rolled lip, deep bowl with a gold band and moon studs, short foot
    hline(im, 2, 13, 27, W[5]); hline(im, 2, 13, 28, W[3]); px(im, 13, 27, W[3]); px(im, 13, 28, W[2]); px(im, 2, 28, W[4]);
    hline(im, 4, 11, 27, '#31233d'); hline(im, 3, 12, 26, W[2]); px(im, 3, 26, W[3]);
    var rows = [[3, 12], [3, 12], [3, 12], [3, 12], [4, 11], [4, 11], [5, 10], [6, 9], [5, 10]];
    rows.forEach(function (r, k) {
      var y = 29 + k;
      for (var x = r[0]; x <= r[1]; x++) {
        var u = (x - r[0]) / Math.max(1, r[1] - r[0]);
        px(im, x, y, u < 0.2 ? W[5] : u < 0.55 ? W[4] : u < 0.85 ? W[3] : W[2]);
      }
    });
    hline(im, 3, 12, 29, W[2]);
    for (var gx = 3; gx <= 12; gx++) px(im, gx, 31, gx < 6 ? GLD[4] : gx < 10 ? GLD[3] : GLD[2]);
    px(im, 5, 33, SLV[2]); px(im, 8, 33, SLV[2]); px(im, 10, 33, SLV[1]);
    hline(im, 5, 10, 37, W[2]); px(im, 5, 37, W[4]); hline(im, 4, 11, 38, W[3]); px(im, 4, 38, W[5]); px(im, 11, 38, W[2]);
    outline(im, 'sel');
    ellShadow(im, 7.5, 38.5, 5, 1.1, 0.3);
    return im;
  }
  def({ id: 'furn_potted_tree', name: 'Potted Tree', w: 1, h: 1, hr: 24, price: 500, seller: 'mirabel' }, drawPottedTree, null);

  // ---------------------------------------------------------------------------
  // Wall pieces
  // ---------------------------------------------------------------------------
  // gilt frame ring: rect x0..x1, y0..y1, 3px deep
  function giltFrame(im, x0, y0, x1, y1) {
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var e = Math.min(x - x0, y - y0, x1 - x, y1 - y);
      if (e > 2) continue;
      var lit = (x - x0) + (y - y0) < (x1 - x) + (y1 - y);
      var c = e === 0 ? (lit ? GLD[3] : GLD[2]) : e === 1 ? (lit ? GLD[4] : GLD[3]) : GLD[1];
      if (e === 1 && (x + y) % 3 === 0) c = lit ? GLD[5] : GLD[4];
      px(im, x, y, c);
    }
    [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].forEach(function (p) { px(im, p[0], p[1], GLD[4]); });
  }
  // ---- Moon Painting (2x1 wall) 32x20
  function drawMoonPainting(im) {
    giltFrame(im, 1, 1, 30, 18);
    // sky
    for (var y = 4; y <= 15; y++) for (var x = 4; x <= 27; x++) {
      var t = (y - 4) / 9, b = t < 0.25 ? 1 : t < 0.55 ? 2 : t < 0.85 ? 3 : 4;
      if ((x + y) % 2 === 0 && (t > 0.2 && t < 0.3 || t > 0.5 && t < 0.6 || t > 0.8 && t < 0.9)) b = Math.max(1, b - 1);
      px(im, x, y, SKY[b]);
    }
    // moon + halo
    for (var a = 0; a < 20; a++) { var ang = a * Math.PI / 10; px(im, Math.round(10 + Math.cos(ang) * 4.6), Math.round(7.5 + Math.sin(ang) * 4.6), a % 2 ? SKY[4] : SKY[5]); }
    ellipse(im, 10, 7.5, 2.6, 2.6, function (x, y, nx, ny) { return (nx + ny) < -0.3 ? WHITE : (nx + ny) < 0.5 ? CRM[4] : SLV[3]; });
    px(im, 11, 8, SLV[3]); px(im, 9, 9, CRM[3]);
    [[6, 5], [16, 5], [21, 6], [26, 5], [18, 9], [24, 9], [14, 11]].forEach(function (s, k) { px(im, s[0], s[1], k % 3 ? SLV[4] : WHITE); });
    // hills
    for (var hx = 4; hx <= 27; hx++) {
      var h1 = 11 + Math.round(1.3 * Math.sin(hx * 0.42 + 1.2));
      for (var hy = h1; hy <= 13; hy++) px(im, hx, hy, hy === h1 ? VIO[3] : VIO[2]);
      var h2 = 12 + Math.round(1.1 * Math.sin(hx * 0.3 - 0.4));
      for (var hy2 = h2; hy2 <= 13; hy2++) px(im, hx, hy2, hy2 === h2 ? VIO[2] : VIO[1]);
    }
    // little observatory tower with a lit window
    stamp(im, 20, 6, ['..k.', '.kkk', '.kkk', '.kak', '.kkk', 'kkkk'], { k: '#141030', a: AMB[3] });
    // lake with the moon's reflection
    for (var lx = 4; lx <= 27; lx++) { px(im, lx, 14, NAV[2]); px(im, lx, 15, NAV[1]); }
    hline(im, 9, 11, 14, CRM[4]); px(im, 10, 15, SLV[3]); px(im, 8, 15, SLV[2]); px(im, 18, 14, NAV[3]); px(im, 23, 15, NAV[3]);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_painting_moon', name: 'Moon Painting', w: 2, h: 1, hr: 4, wall: true, price: 900, seller: 'fennick' }, drawMoonPainting, null);

  // ---- Portrait of Morwenna (1x1 wall) 16x22
  function drawPortrait(im) {
    // arched gilt frame
    for (var y = 1; y <= 20; y++) for (var x = 1; x <= 14; x++) {
      var top = y === 1 ? (x >= 4 && x <= 11) : y === 2 ? (x >= 2 && x <= 13) : true;
      if (!top) continue;
      px(im, x, y, GLD[3]);
    }
    for (var y2 = 1; y2 <= 20; y2++) for (var x2 = 1; x2 <= 14; x2++) {
      if (!get(im, x2, y2)) continue;
      var lit = x2 + y2 < 17;
      var edge = !get(im, x2 - 1, y2) || !get(im, x2, y2 - 1) || !get(im, x2 + 1, y2) || !get(im, x2, y2 + 1);
      if (edge) px(im, x2, y2, lit ? GLD[4] : GLD[2]);
    }
    // inner lip
    stamp(im, 2, 2, [
      '...nnnnnn...',
      '.nn......nn.',
      'n..........n'
    ], { n: GLD[1] });
    for (var iy = 5; iy <= 19; iy++) { px(im, 2, iy, GLD[1]); px(im, 13, iy, GLD[1]); }
    hline(im, 2, 13, 19, GLD[2]);
    // the painting (x 3..12, y 3..18): Morwenna, stern, with a twinkle in her eye
    stamp(im, 3, 3, [
      'qqqqqqqhhq',
      'qqqqqqhHqq',
      'qqqqqhHHqq',
      'qqqqhjHHhq',
      'qqqhppgphq',
      'qhjHHHHHHh',
      'qSfFFffeSq',
      'qSbbFfbbSq',
      'qSfkFekwSq',
      'qsffFEffsq',
      'qsfffEEesq',
      'qqsfmmmeqq',
      'qqcfffecqq',
      'qrRcGXcRrq',
      'rRRRcRRRRr',
      'rRRRRRRRRr'
    ], {
      q: '#1e1530', h: VIO[1], H: VIO[2], j: VIO[4], p: PLV[3], g: GLD[4],
      s: '#8a84aa', S: '#c4c0d4', f: '#e0c4cc', F: '#f4e2e6', e: '#b8939f', E: '#9a7280',
      k: OUT, w: WHITE, b: '#4a4060', m: '#6e3048',
      c: '#10302a', r: '#1a4434', R: '#245a40', G: GLD[4], X: EMG[3]
    });
    // soft backdrop glow behind her head
    [[4, 4], [5, 5], [11, 4], [12, 6], [4, 7]].forEach(function (p) { px(im, p[0], p[1], '#2a1f40'); });
    // the twinkle
    px(im, 11, 9, alpha(WHITE, 0.55));
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_portrait_morwenna', name: 'Portrait of Morwenna', w: 1, h: 1, hr: 6, wall: true, price: 450, seller: 'mirabel' }, drawPortrait, null);

  // ---- Star Map (2x1 wall) 32x20 — a parchment sky chart on dowels
  function drawStarMap(im) {
    var INK = '#3a3466', INK2 = '#5a5290';
    // parchment
    for (var y = 3; y <= 16; y++) for (var x = 3; x <= 28; x++) {
      var r = hash(x, y, 13), c = PAP[4];
      if (x === 3 || y === 16) c = PAP[3];
      if (x === 28) c = PAP[2];
      if (r < 0.08) c = PAP[3]; else if (r > 0.94) c = PAP[5];
      px(im, x, y, c);
    }
    px(im, 3, 16, PAP[2]); px(im, 28, 3, PAP[3]);
    // the great circle + ticks
    for (var a = 0; a < 40; a++) {
      var ang = a * Math.PI / 20;
      px(im, Math.round(15.5 + Math.cos(ang) * 5.6 - 0.5), Math.round(9.5 + Math.sin(ang) * 5.6 - 0.5), INK);
      if (a % 5 === 0) px(im, Math.round(15.5 + Math.cos(ang) * 4.4 - 0.5), Math.round(9.5 + Math.sin(ang) * 4.4 - 0.5), INK2);
    }
    line(im, 11, 9, 20, 9, alpha(INK2, 0.6)); line(im, 15, 5, 15, 14, alpha(INK2, 0.6));
    star4(im, 15, 9, [GLD[2], GLD[3], GLD[5]]);
    // constellations
    path(im, [[5, 5], [7, 6], [9, 5], [10, 8], [7, 10]], INK2);
    path(im, [[22, 5], [24, 7], [26, 5]], INK2); path(im, [[24, 7], [24, 11], [22, 13], [26, 13]], INK2);
    [[5, 5], [7, 6], [9, 5], [10, 8], [7, 10], [22, 5], [24, 7], [26, 5], [24, 11], [22, 13], [26, 13]].forEach(function (p, k) { px(im, p[0], p[1], k % 3 ? GLD[3] : GLD[4]); });
    // a little crescent + comet
    stamp(im, 5, 12, ['.kk', 'k..', '.kk'], { k: INK });
    line(im, 17, 15, 21, 13, alpha(INK2, 0.5)); px(im, 21, 13, GLD[4]);
    // red wax seal
    stamp(im, 25, 14, ['.rr', 'rRr', '.r.'], { r: '#7a1a30', R: '#b8303a' });
    // dowels with brass caps
    [1, 17].forEach(function (dy) {
      hline(im, 2, 29, dy, WD[4]); hline(im, 2, 29, dy + 1, WD[2]); hline(im, 2, 8, dy, WD[5]);
      px(im, 1, dy, BRS[4]); px(im, 1, dy + 1, BRS[2]); px(im, 30, dy, BRS[3]); px(im, 30, dy + 1, BRS[1]);
    });
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_star_map', name: 'Star Map', w: 2, h: 1, hr: 4, wall: true, price: 850, seller: 'orvyn' }, drawStarMap, null);

  // ---- Lunar Tapestry (1x1 wall, tall) 16x32
  function drawTapestry(im) {
    var V = VIO, prof = [3, 4, 3, 2, 3, 4, 3, 2, 2, 3, 2, 1];
    for (var x = 2; x <= 13; x++) {
      var k = x - 2, bot = 25 + Math.min(x - 2, 13 - x);
      if (bot > 30) bot = 30;
      for (var y = 4; y <= bot; y++) px(im, x, y, V[prof[k]]);
    }
    // gold border following the swallow-point hem
    for (var by = 5; by <= 25; by++) { px(im, 3, by, GLD[3]); px(im, 12, by, GLD[2]); }
    for (var hx = 3; hx <= 12; hx++) { var hy = 25 + Math.min(hx - 2, 13 - hx) - 1; px(im, hx, hy, hx < 8 ? GLD[3] : GLD[2]); }
    hline(im, 3, 12, 5, GLD[3]);
    // moon phases
    stamp(im, 7, 7, ['.cc', 'cc.', '.cc'], { c: CRM[4] }); px(im, 7, 8, SLV[4]);
    ellipse(im, 7.5, 14.5, 2.8, 2.8, function (x, y, nx, ny) { return (nx + ny) < -0.4 ? WHITE : (nx + ny) < 0.5 ? CRM[4] : SLV[3]; });
    px(im, 8, 15, SLV[3]); px(im, 6, 14, CRM[3]);
    for (var a = 0; a < 12; a++) { var ang = a * Math.PI / 6; px(im, Math.round(7.5 + Math.cos(ang) * 4.6), Math.round(14.5 + Math.sin(ang) * 4.6), GLD[2]); }
    stamp(im, 6, 21, ['cc.', '.cc', 'cc.'], { c: CRM[4] });
    px(im, 5, 10, GLD[4]); px(im, 10, 11, SLV[4]); px(im, 10, 19, GLD[4]); px(im, 5, 18, SLV[4]);
    // tabs + rod + finials
    [3, 6, 9, 12].forEach(function (tx) { px(im, tx, 3, V[3]); px(im, tx + 1, 3, V[2]); });
    hline(im, 2, 13, 1, DW[4]); hline(im, 2, 13, 2, DW[2]);
    stamp(im, 1, 0, ['g', 'G', 'g'], { g: BRS[3], G: BRS[4] }); stamp(im, 14, 0, ['g', 'G', 'g'], { g: BRS[2], G: BRS[3] });
    // tassel
    px(im, 7, 30, GLD[4]); px(im, 8, 30, GLD[3]); px(im, 7, 31, GLD[3]); px(im, 8, 31, GLD[2]);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_tapestry', name: 'Lunar Tapestry', w: 1, h: 1, hr: 16, wall: true, price: 480, seller: 'isolde' }, drawTapestry, null);

  // ---- Wall Clock (1x1 wall) 16x24 — Gothic pendulum clock with a moon dial
  function drawWallClock(im) {
    var R = DW;
    // gable top + finial
    stamp(im, 4, 0, [
      '...gg...',
      '...54...',
      '..5543..',
      '.554332.',
      '55443322'
    ], legend(['012345', R], { g: GLD[4] }));
    // dial housing
    ellipse(im, 7.5, 9.5, 5.6, 5.4, function (x, y, nx, ny) { return (nx + ny) < -0.3 ? R[4] : (nx + ny) < 0.6 ? R[3] : R[2]; });
    ellipse(im, 7.5, 9.5, 4.4, 4.2, function (x, y, nx, ny) { return (nx + ny) < 0 ? GLD[4] : GLD[2]; });
    ellipse(im, 7.5, 9.5, 3.5, 3.3, function (x, y, nx, ny) { return (nx + ny) < -0.5 ? CRM[5] : (nx + ny) < 0.6 ? CRM[4] : CRM[3]; });
    px(im, 7, 6, OUT); px(im, 8, 6, OUT); px(im, 4, 9, OUT); px(im, 11, 9, OUT); px(im, 4, 10, alpha(OUT, 0.5)); px(im, 11, 10, alpha(OUT, 0.5));
    px(im, 7, 12, SLV[2]); px(im, 8, 12, SLV[3]);
    line(im, 7, 9, 5, 7, OUT); line(im, 8, 9, 10, 6, '#3a3242'); px(im, 7, 9, GLD[3]); px(im, 8, 9, GLD[2]);
    // pendulum case
    for (var y = 15; y <= 21; y++) { px(im, 5, y, R[4]); px(im, 10, y, R[2]); for (var x = 6; x <= 9; x++) px(im, x, y, R[1]); }
    hline(im, 5, 10, 15, R[3]);
    vline(im, 7, 16, 19, BRS[3]); stamp(im, 6, 19, ['.bB.', 'bBBb'].map(function (r) { return r; }), { b: BRS[2], B: BRS[4] });
    px(im, 6, 16, alpha(WHITE, 0.35)); px(im, 6, 17, alpha(WHITE, 0.2));
    hline(im, 5, 10, 22, R[2]); hline(im, 6, 9, 23, R[1]); px(im, 7, 23, GLD[3]); px(im, 8, 23, GLD[2]);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_wall_clock', name: 'Wall Clock', w: 1, h: 1, hr: 8, wall: true, price: 400, seller: 'brann' }, drawWallClock, null);

  // ---------------------------------------------------------------------------
  // Curios
  // ---------------------------------------------------------------------------
  // ---- Crystal Ball (1x1, light) 16x24 — on a velvet-draped guéridon
  function drawCrystalBall(im) {
    var R = DW, P = PLV;
    // legs
    line(im, 4, 17, 2, 22, R[3]); line(im, 5, 17, 3, 22, R[2]);
    line(im, 11, 17, 13, 22, R[2]); line(im, 10, 17, 12, 22, R[3]);
    vline(im, 7, 17, 23, R[4]); vline(im, 8, 17, 23, R[2]);
    hline(im, 4, 11, 20, R[2]); px(im, 4, 20, R[3]);
    // draped velvet cloth with points + tassels
    ellipse(im, 7.5, 13.5, 6.2, 2.2, function (x, y, nx, ny) { return ny < -0.3 ? P[5] : nx < -0.4 ? P[4] : nx > 0.5 ? P[3] : P[4]; });
    for (var x = 1; x <= 14; x++) {
      var depth = 16 + ((x % 4 === 1) ? 1 : 0) + ((x === 3 || x === 12) ? 1 : 0);
      for (var y = 15; y <= depth; y++) px(im, x, y, x < 5 ? P[3] : x > 10 ? P[2] : (x % 3 === 0 ? P[2] : P[3]));
    }
    [1, 5, 9, 13].forEach(function (tx) { px(im, tx, 18, GLD[3]); });
    hline(im, 1, 14, 15, GLD[2]); px(im, 2, 15, GLD[3]); px(im, 1, 15, GLD[3]);
    // brass cradle
    stamp(im, 4, 11, ['b......b', '.bBBBBb.'], { b: BRS[3], B: BRS[4] }); hline(im, 5, 10, 13, BRS[2]);
    // the ball
    ellipse(im, 7.5, 6.5, 4.6, 4.6, function (x, y, nx, ny) {
      var d = nx * nx + ny * ny, l = -nx * 0.55 - ny * 0.65;
      if (d > 0.72) return l > 0.2 ? VLG[3] : VLG[1];
      var sw = Math.sin((nx * 3 + ny * 2) * 2.2 + d * 4);
      if (sw > 0.6) return VLG[4];
      return d < 0.25 ? VLG[3] : VLG[2];
    });
    px(im, 6, 5, VLG[5]); px(im, 7, 6, VLG[5]); px(im, 8, 7, VLG[4]);
    px(im, 5, 3, WHITE); px(im, 4, 4, WHITE); px(im, 5, 4, alpha(WHITE, 0.7));
    outline(im, 'sel');
    ellShadow(im, 7.5, 22.5, 6.5, 1.4, 0.3);
    halo(im, 7.5, 6.5, 6.2, '#b99aee', 0.14);
    return im;
  }
  def({ id: 'furn_crystal_ball', name: 'Crystal Ball', w: 1, h: 1, hr: 8, price: 600, seller: 'fennick',
    light: { x: 7, y: 6, r: 32, color: [196, 160, 255] } }, drawCrystalBall, null);

  // ---- Celestial Globe (1x1) 16x28
  function drawGlobe(im) {
    var R = DW;
    // tripod legs
    line(im, 6, 21, 2, 26, R[3]); line(im, 6, 22, 3, 26, R[2]);
    line(im, 9, 21, 13, 26, R[2]); line(im, 9, 22, 12, 26, R[1]);
    vline(im, 7, 22, 26, R[4]); vline(im, 8, 22, 26, R[2]);
    rect(im, 6, 20, 4, 2, R[3]); hline(im, 6, 9, 20, R[4]);
    // stem
    vline(im, 7, 16, 19, BRS[4]); vline(im, 8, 16, 19, BRS[2]);
    // horizon ring (back half)
    ellipse(im, 7.5, 14, 6.6, 1.8, function (x, y, nx, ny) { return ny < 0 ? WD[2] : undefined; });
    // globe
    ellipse(im, 7.5, 9.5, 5, 5, function (x, y, nx, ny) {
      var l = -nx * 0.55 - ny * 0.65 + Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * 0.6;
      return l > 0.75 ? NAV[5] : l > 0.45 ? NAV[4] : l > 0.1 ? NAV[3] : NAV[2];
    });
    // ecliptic band + constellations
    for (var x = 3; x <= 12; x++) { var y = Math.round(10.5 - (x - 7.5) * 0.45); pxOn(im, x, y, alpha(GLD[3], 0.75)); }
    [[5, 7], [7, 6], [9, 8], [10, 11], [6, 12], [8, 13]].forEach(function (p, k) { pxOn(im, p[0], p[1], k % 2 ? GLD[4] : SLV[4]); });
    pxOn(im, 6, 7, alpha(GLD[3], 0.5)); pxOn(im, 8, 7, alpha(GLD[3], 0.5));
    px(im, 5, 6, WHITE);
    // meridian ring (brass)
    for (var a = 0; a < 48; a++) {
      var ang = a * Math.PI / 24, mx = Math.round(7.5 + Math.cos(ang) * 6.2 - 0.0), my = Math.round(9.5 + Math.sin(ang) * 6.2);
      if (my > 14) continue;
      px(im, mx, my, (Math.cos(ang) + Math.sin(ang)) < 0 ? BRS[4] : BRS[2]);
    }
    px(im, 7, 3, BRS[4]); px(im, 8, 3, BRS[3]); px(im, 7, 2, GLD[4]);
    // horizon ring (front half)
    ellipse(im, 7.5, 14, 6.6, 1.8, function (x, y, nx, ny) {
      if (ny < 0.15) return undefined;
      var dIn = (x - 7.5) * (x - 7.5) / 25 + (y - 14) * (y - 14) / 0.8;
      if (dIn < 1) return undefined;
      return nx < -0.3 ? OAK[4] : nx > 0.4 ? OAK[2] : OAK[3];
    });
    hline(im, 3, 12, 15, OAK[3]); hline(im, 4, 11, 16, OAK[2]); px(im, 2, 14, OAK[4]); px(im, 13, 14, OAK[2]);
    outline(im, 'sel');
    ellShadow(im, 7.5, 26.5, 6, 1.4, 0.3);
    return im;
  }
  def({ id: 'furn_globe', name: 'Celestial Globe', w: 1, h: 1, hr: 12, price: 580, seller: 'orvyn' }, drawGlobe, null);

  // ---- Brass Telescope (1x1) 16x28
  function drawTelescope(im) {
    var R = OAK;
    // tripod
    line(im, 7, 16, 2, 26, R[4]); line(im, 8, 16, 3, 26, R[2]);
    line(im, 8, 16, 13, 26, R[3]); line(im, 9, 16, 14, 26, R[1]);
    line(im, 8, 16, 8, 27, R[3]); px(im, 7, 27, R[4]);
    line(im, 4, 23, 12, 23, alpha(R[2], 0.9));
    // mount
    stamp(im, 6, 13, ['bBb', 'bBb', '.b.'], { b: BRS[2], B: BRS[4] });
    // tube
    tube(im, [[2.5, 16, 1.0], [5, 14, 1.3], [10, 9, 1.6], [13, 6, 2.1]], [BRS[1], BRS[2], BRS[3], BRS[4], BRS[5]]);
    // bands + lens
    line(im, 5, 12, 7, 14, BRS[1]); line(im, 9, 8, 11, 10, BRS[1]);
    ellipse(im, 13.5, 5.5, 1.5, 1.5, NAV[2]); px(im, 13, 5, NAV[4]); px(im, 14, 4, SLV[4]);
    px(im, 2, 16, OUT); px(im, 1, 17, BRS[2]);
    outline(im, 'sel');
    ellShadow(im, 8, 26.5, 6.5, 1.4, 0.3);
    return im;
  }
  def({ id: 'furn_telescope', name: 'Brass Telescope', w: 1, h: 1, hr: 9, trim: 3, price: 600, seller: 'orvyn' }, drawTelescope, null);

  // ---- Decorative Cauldron (1x1, bubbling glow) 16x22
  function drawCauldron(im) {
    var I = IRN, G = EMG;
    // feet
    stamp(im, 2, 19, ['ii......ii', '.i......i.'], { i: I[3] }); px(im, 7, 20, I[3]); px(im, 8, 20, I[2]);
    // belly
    sphere(im, 7.5, 14, 6.6, 5.4, [I[0], I[1], I[2], I[3], I[4]], { bias: 0.05 });
    for (var x = 0; x < 16; x++) for (var y = 0; y < 9; y++) px(im, x, y, null);
    // violet rim light on the right + etched runes
    for (var ry = 10; ry <= 17; ry++) for (var rx = 11; rx <= 14; rx++) if (get(im, rx, ry) && !get(im, rx + 1, ry)) px(im, rx, ry, '#4a3b6d');
    [[5, 15], [7, 16], [9, 15]].forEach(function (p) { px(im, p[0], p[1], '#4a3b6d'); });
    px(im, 6, 14, '#604e88');
    // handles
    px(im, 1, 11, I[4]); px(im, 0, 12, I[3]); px(im, 1, 13, I[2]);
    px(im, 14, 11, I[3]); px(im, 15, 12, I[2]); px(im, 14, 13, I[1]);
    // rim + brew
    ellipse(im, 7.5, 10, 6.6, 2, function (x, y, nx, ny) { return ny < 0 ? (nx < 0.3 ? I[5] : I[4]) : I[3]; });
    ellipse(im, 7.5, 10, 5, 1.1, function (x, y, nx, ny) { return ny < -0.2 ? G[3] : G[2]; });
    px(im, 4, 10, G[4]); px(im, 5, 10, G[5]); px(im, 9, 9, G[4]); px(im, 10, 10, G[3]); px(im, 7, 10, G[4]);
    // bubbles + vapour
    [[6, 7], [9, 5], [7, 2], [10, 1]].forEach(function (b, k) {
      px(im, b[0], b[1], alpha(G[4], 0.95 - k * 0.15)); if (k < 2) px(im, b[0] + 1, b[1], alpha(G[3], 0.7));
      if (k < 2) px(im, b[0], b[1] + 1, alpha(G[3], 0.6));
    });
    px(im, 4, 6, alpha(G[4], 0.4)); px(im, 3, 4, alpha(G[4], 0.25)); px(im, 11, 3, alpha(G[4], 0.3));
    // wooden ladle
    line(im, 11, 9, 13, 4, WD[4]); line(im, 12, 9, 14, 4, WD[2]); px(im, 13, 3, WD[4]);
    outline(im, 'sel');
    ellShadow(im, 7.5, 20.5, 6.5, 1.4, 0.32);
    halo(im, 7.5, 9, 4, G[3], 0.16);
    return im;
  }
  def({ id: 'furn_cauldron_decor', name: 'Decorative Cauldron', w: 1, h: 1, hr: 6, price: 380, seller: 'brann',
    light: { x: 7, y: 9, r: 34, color: L_EMERALD } }, drawCauldron, null);

  // ---- Music Box (1x1) 16x24 — open lacquered box with a little gold moon, on a pedestal
  function drawMusicBox(im) {
    var R = DW, P = PLV;
    // pedestal: slab, fluted column, base
    rect(im, 3, 15, 10, 2, R[3]); hline(im, 3, 12, 15, R[4]); px(im, 3, 15, R[5]); hline(im, 3, 12, 16, R[2]);
    for (var y = 17; y <= 20; y++) { px(im, 5, y, R[4]); px(im, 6, y, R[3]); px(im, 7, y, R[4]); px(im, 8, y, R[3]); px(im, 9, y, R[2]); px(im, 10, y, R[1]); }
    hline(im, 4, 11, 21, R[3]); px(im, 4, 21, R[4]); hline(im, 4, 11, 22, R[1]);
    // box: front face + rim
    rect(im, 3, 11, 10, 4, P[3]);
    hline(im, 3, 12, 11, P[4]); vline(im, 3, 11, 14, P[4]); vline(im, 12, 12, 14, P[2]); hline(im, 4, 12, 14, P[2]);
    px(im, 3, 11, GLD[4]); px(im, 12, 11, GLD[3]); px(im, 3, 14, GLD[3]); px(im, 12, 14, GLD[2]);
    px(im, 7, 12, GLD[4]); px(im, 8, 12, GLD[3]); px(im, 7, 13, OUT); px(im, 8, 13, GLD[2]);
    // open top: velvet + brass comb
    rect(im, 4, 9, 8, 2, VIO[1]); hline(im, 3, 12, 8, P[4]); px(im, 3, 9, P[4]); px(im, 3, 10, P[4]); px(im, 12, 9, P[2]); px(im, 12, 10, P[2]);
    for (var cx = 5; cx <= 10; cx++) px(im, cx, 10, cx % 2 ? GLD[3] : GLD[4]);
    // lid: tipped open behind (foreshortened), velvet lining with a round mirror
    poly(im, [[3, 8], [4, 4], [12, 4], [13, 8]], P[3]);
    hline(im, 4, 11, 4, P[4]); px(im, 3, 7, P[4]); px(im, 4, 5, P[4]); px(im, 3, 6, P[4]);
    rect(im, 5, 5, 6, 3, VIO[1]); hline(im, 5, 10, 7, VIO[0]);
    ellipse(im, 9.5, 5.6, 0.9, 0.9, function (x, y, nx, ny) { return (nx + ny) < 0 ? SLV[4] : SLV[2]; });
    // little gold crescent on its pin
    vline(im, 7, 7, 9, GLD[2]);
    stamp(im, 6, 1, ['.gg', 'g..', 'g..', 'g..', '.gg'], { g: GLD[4] }); px(im, 7, 2, GLD[2]); px(im, 7, 4, GLD[2]); px(im, 7, 3, GLD[3]);
    // wind-up key
    px(im, 13, 12, GLD[3]); px(im, 14, 11, GLD[4]); px(im, 14, 13, GLD[2]); px(im, 15, 12, GLD[3]);
    // floating notes
    note(im, 0, 0, alpha(GLD[4], 0.9)); note(im, 13, 4, alpha('#e4d2ff', 0.85));
    outline(im, 'sel');
    ellShadow(im, 7.5, 22.5, 5, 1.2, 0.3);
    return im;
  }
  def({ id: 'furn_music_box', name: 'Music Box', w: 1, h: 1, hr: 8, price: 520, seller: 'fennick' }, drawMusicBox, null);

  // ---- Harp (1x1, tall) 16x32
  function drawHarp(im) {
    // soundbox (diagonal), base, column, neck, strings
    var neckY = function (x) { return Math.round(4.5 + 2 * Math.sin((x - 3) / 10 * Math.PI)); };
    for (var x = 5; x <= 12; x++) {
      var ny = neckY(x), sb = Math.round(28 - (x - 5) * 20 / 8);
      vline(im, x, ny + 2, sb - 1, x % 3 === 0 ? alpha(RSE[3], 0.95) : alpha(SLV[4], 0.9));
    }
    // soundbox: thick diagonal
    for (var t = 0; t <= 1.0001; t += 0.02) {
      var cx = 5 + t * 8.5, cy = 28.5 - t * 21.5, half = 2.0 - t * 0.9;
      for (var o = -half; o <= half; o += 0.5) {
        var X = Math.round(cx + o * 0.8), Y = Math.round(cy + o * 0.4);
        px(im, X, Y, o < -half * 0.3 ? WD[4] : o > half * 0.4 ? WD[2] : WD[3]);
      }
    }
    for (var t2 = 0; t2 <= 1.0001; t2 += 0.04) { px(im, Math.round(5 + t2 * 8.5 - (2.0 - t2 * 0.9) * 0.8), Math.round(28.5 - t2 * 21.5), GLD[3]); }
    // neck (gold S-curve)
    for (var nx = 3; nx <= 13; nx++) { var y0 = neckY(nx); px(im, nx, y0, GLD[4]); px(im, nx, y0 + 1, GLD[2]); }
    // column
    for (var cyy = 4; cyy <= 28; cyy++) { px(im, 2, cyy, GLD[4]); px(im, 3, cyy, GLD[2]); }
    hline(im, 1, 4, 10, GLD[3]); hline(im, 1, 4, 22, GLD[3]); px(im, 1, 10, GLD[4]); px(im, 1, 22, GLD[4]);
    // crescent crown on the column
    stamp(im, 1, 0, ['.cc', 'c..', 'c..', '.cc'], { c: GLD[4] }); px(im, 2, 1, GLD[2]); px(im, 2, 2, GLD[2]);
    // base
    rect(im, 1, 28, 11, 2, WD[3]); hline(im, 1, 11, 28, GLD[3]); px(im, 1, 28, GLD[4]); hline(im, 1, 11, 29, WD[2]);
    px(im, 1, 30, WD[3]); px(im, 2, 30, WD[2]); px(im, 10, 30, WD[2]); px(im, 11, 30, WD[1]);
    outline(im, 'sel');
    ellShadow(im, 6.5, 30.5, 6, 1.2, 0.3);
    return im;
  }
  def({ id: 'furn_harp', name: 'Harp', w: 1, h: 1, hr: 16, price: 600, seller: 'fennick' }, drawHarp, null);

  // a round little owl with big moon-gold eyes; (x, y) = top-left of its 10x13 box
  var OWL_ROWS = [
    '.t......t.',
    '.tt....tt.',
    '.hhhhhhhh.',
    'hFFFhhFFFh',
    'FWEEFFWEEF',
    'FEPEFFEPEF',
    'FEEEbbEEEF',
    'wFFFbbFFFw',
    'wwffffffww',
    'wwvfvfvfww',
    'wwfvfvfvww',
    '.wwffffww.',
    '..k....k..'
  ];
  function drawOwl(im, x, y) {
    var O = OWL;
    stamp(im, x, y, OWL_ROWS, { t: O[3], h: O[3], F: O[5], E: GLD[4], P: OUT, W: WHITE, b: GLD[2], w: O[2], f: O[4], v: O[2], k: GLD[3] });
    for (var j = 7; j <= 11; j++) { pxOn(im, x, y + j, O[3]); pxOn(im, x + 9, y + j, O[1]); }
    px(im, x + 1, y + 2, O[4]); px(im, x + 2, y + 2, O[4]);
    pxOn(im, x + 8, y + 8, O[1]); pxOn(im, x + 8, y + 9, O[1]);
  }
  // ---- Owl Perch (1x1) 16x32 — a gnarled perch with a round little owl
  function drawOwlPerch(im) {
    var R = WD, o = 1;
    // base + post
    stamp(im, 2, 29 + o, ['...3443...', '.33333322.', '21.....122'], rampLeg('012345', R));
    for (var y = 13 + o; y <= 28 + o; y++) { px(im, 7, y, R[4]); px(im, 8, y, R[2]); }
    px(im, 7, 19 + o, R[3]); px(im, 8, 21 + o, R[1]); px(im, 6, 24 + o, R[3]);
    // little brass dish
    hline(im, 9, 12, 21 + o, BRS[3]); hline(im, 10, 11, 22 + o, BRS[2]); px(im, 9, 21 + o, BRS[4]);
    // perch branch with a tuft of moss
    hline(im, 2, 13, 13 + o, R[4]); hline(im, 2, 13, 14 + o, R[2]); px(im, 1, 13 + o, R[3]); px(im, 14, 14 + o, R[2]); px(im, 13, 12 + o, R[3]);
    px(im, 2, 12 + o, LEAF[4]); px(im, 1, 12 + o, LEAF[5]); px(im, 12, 15 + o, LEAF[3]);
    // the owl
    drawOwl(im, 3, o);
    outline(im, 'sel');
    ellShadow(im, 7.5, 31 + o, 5.5, 1, 0.3);
    return im;
  }
  def({ id: 'furn_owl_perch', name: 'Owl Perch', w: 1, h: 1, hr: 17, price: 260, seller: 'mirabel' }, drawOwlPerch, null);

  // ---------------------------------------------------------------------------
  // Depths trophies (on a dark plinth with a brass plaque)
  // ---------------------------------------------------------------------------
  function plinth(im, y) {
    var R = DW;
    rect(im, 2, y, 12, 4, R[3]);
    hline(im, 2, 13, y, R[5]); hline(im, 2, 13, y + 1, R[4]); vline(im, 2, y, y + 3, R[4]);
    hline(im, 3, 13, y + 3, R[1]); vline(im, 13, y + 1, y + 3, R[2]);
    rect(im, 5, y + 2, 6, 1, BRS[3]); px(im, 5, y + 2, BRS[4]); px(im, 10, y + 2, BRS[2]);
    px(im, 6, y + 2, BRS[2]); px(im, 8, y + 2, BRS[2]);
    hline(im, 1, 14, y + 4, R[2]); px(im, 1, y + 4, R[3]); hline(im, 2, 13, y + 5, R[1]);
  }
  // ---- Slime-in-a-Jar (green glow) 16x22
  function drawTrophySlime(im) {
    var S = ['#0f3a34', '#1e6a56', '#2fbf7f', '#5dffb0', '#b4ffd9', '#ffffff'];
    plinth(im, 15);
    // jar back wall (translucent) + slime
    for (var y = 5; y <= 14; y++) for (var x = 4; x <= 11; x++) glassPx(im, x, y, 0.2);
    ellipse(im, 7.5, 11.5, 3.8, 3.2, function (x, y, nx, ny) {
      var l = -nx * 0.5 - ny * 0.7;
      return l > 0.55 ? S[4] : l > 0.1 ? S[3] : l > -0.4 ? S[2] : S[1];
    });
    hline(im, 4, 11, 14, S[2]); px(im, 4, 14, S[3]);
    px(im, 6, 11, OUT); px(im, 9, 11, OUT); px(im, 6, 10, WHITE); px(im, 9, 10, WHITE);
    px(im, 7, 13, S[1]); px(im, 8, 13, S[1]);
    px(im, 5, 6, alpha(S[4], 0.9)); px(im, 9, 7, alpha(S[3], 0.8)); px(im, 7, 5, alpha(S[4], 0.7));
    // glass walls + highlights
    vline(im, 3, 5, 14, alpha('#dfe8ff', 0.75)); vline(im, 12, 5, 14, alpha('#6a7aa8', 0.8));
    vline(im, 4, 6, 9, alpha(WHITE, 0.6));
    hline(im, 4, 11, 5, alpha('#dfe8ff', 0.35));
    // brass lid + knob
    hline(im, 3, 12, 4, BRS[3]); hline(im, 3, 12, 3, BRS[4]); px(im, 12, 4, BRS[1]); px(im, 12, 3, BRS[2]);
    px(im, 7, 2, BRS[4]); px(im, 8, 2, BRS[2]);
    outline(im, 'sel');
    ellShadow(im, 7.5, 21, 7, 1, 0.3);
    halo(im, 7.5, 11.5, 2, S[3], 0.1);
    return im;
  }
  def({ id: 'furn_trophy_slime', name: 'Slime-in-a-Jar Trophy', w: 1, h: 1, hr: 6, price: 0, seller: 'depths',
    light: { x: 7, y: 11, r: 24, color: [93, 255, 176] } }, drawTrophySlime, null);

  // ---- Broodmother Skull Trophy 16x22 — bleached carapace, eight eye sockets, silver fangs
  function drawTrophySpider(im) {
    var B = ['#2a2238', '#4a4458', '#7a7088', '#a89ea8', '#cdc2c0', '#e8e0d6', '#fffaf0'];
    var F = ['#4a3b6d', '#9fb0d8', '#e8eeff'];
    plinth(im, 16);
    // pedipalps (little hooked arms at the sides)
    stamp(im, 0, 10, ['.cc', 'cb.', 'b..'], { c: B[4], b: B[2] });
    stamp(im, 13, 10, ['cc.', '.bc', '..b'], { c: B[3], b: B[1] });
    // broad carapace
    var rows = { 4: [5, 10], 5: [4, 11], 6: [3, 12], 7: [3, 12], 8: [3, 12], 9: [3, 12], 10: [3, 12], 11: [4, 11], 12: [5, 10] };
    for (var y = 4; y <= 12; y++) for (var x = rows[y][0]; x <= rows[y][1]; x++) {
      var nx = (x + 0.5 - 8) / 5.5, ny = (y - 8) / 5;
      var l = -nx * 0.6 - ny * 0.7 + 0.25;
      px(im, x, y, B[l > 0.8 ? 6 : l > 0.5 ? 5 : l > 0.15 ? 4 : l > -0.25 ? 3 : 2]);
    }
    vline(im, 7, 4, 6, B[6]); vline(im, 8, 5, 6, B[3]);
    // eight eyes: the great front pair, a row of four above, one more at each side
    var E = '#1d1530', G = '#b99aee', M = '#4a2f7a';
    rect(im, 4, 7, 3, 3, E); rect(im, 9, 7, 3, 3, E);
    px(im, 4, 7, G); px(im, 9, 7, G); px(im, 5, 8, M); px(im, 10, 8, M);
    [[4, 5], [6, 5], [9, 5], [11, 5], [3, 10], [12, 10]].forEach(function (p) { px(im, p[0], p[1], E); });
    // chelicerae + hooked silver fangs
    stamp(im, 4, 11, ['.ccc.ccc', '.cbb.bbc', '..b...b.'].map(function (r) { return r; }), { c: B[4], b: B[2] });
    stamp(im, 4, 13, ['.m.....m', '..ml.lm.', '...l.l..'], { m: F[1], l: F[2] });
    px(im, 7, 15, F[0]); px(im, 9, 15, F[0]);
    // a crack
    px(im, 11, 4, B[2]); px(im, 12, 5, B[2]); px(im, 12, 6, B[1]);
    outline(im, 'sel');
    ellShadow(im, 7.5, 21.5, 7, 0.8, 0.3);
    return im;
  }
  def({ id: 'furn_trophy_spider', name: 'Broodmother Skull Trophy', w: 1, h: 1, hr: 3, trim: 3, price: 0, seller: 'depths' }, drawTrophySpider, null);

  // ---- Archon's Crown Replica (violet glow) 16x22 — Vesper's crown on a velvet cushion
  var CROWN = [
    '......W......',
    '......G......',
    '.W....k....W.',
    '.G...kmk...G.',
    '.k...kmk...k.',
    '.kk..kmk..kk.',
    '.km.kkmkk.km.',
    'kkmkkmGmkkmkk',
    'hmmmmmCmmmmmk',
    '.kkkkkkkkkkk.'
  ];
  function drawTrophyCrown(im) {
    plinth(im, 16);
    // velvet cushion with gold tassels
    rrect(im, 2, 12, 12, 4, 1, function (x, y, i, j) { return j === 0 ? PLV[5] : j === 1 ? PLV[4] : j === 2 ? PLV[3] : PLV[2]; });
    px(im, 2, 16, GLD[3]); px(im, 13, 16, GLD[2]); px(im, 2, 15, GLD[4]); px(im, 13, 15, GLD[3]);
    // the crown (same design as the Archon's)
    stamp(im, 1, 3, CROWN, { k: '#2a2142', m: '#43365f', h: '#6b5a92', G: '#b99aee', W: '#e4d2ff', C: '#e8eeff' });
    // lit left edges of the spikes
    [[6, 6], [6, 7], [6, 8], [2, 8], [2, 9]].forEach(function (p) { px(im, p[0], p[1], '#6b5a92'); });
    px(im, 7, 11, '#6b5a92'); px(im, 7, 10, '#b99aee');
    outline(im, 'sel');
    ellShadow(im, 7.5, 21.5, 7, 0.8, 0.3);
    halo(im, 7, 3, 2.5, '#b99aee', 0.22); halo(im, 2, 5, 1.6, '#b99aee', 0.18); halo(im, 12, 5, 1.6, '#b99aee', 0.18);
    return im;
  }
  def({ id: 'furn_trophy_crown', name: "Archon's Crown Replica", w: 1, h: 1, hr: 6, price: 0, seller: 'depths',
    light: { x: 7, y: 6, r: 26, color: L_VIOLET } }, drawTrophyCrown, null);

  // ---------------------------------------------------------------------------
  // Rewards: the Guild's Bounty Trophy Case (crafted) and Ronan's Mineral Cabinet
  // ---------------------------------------------------------------------------
  var GRIMF = ['#100e14', '#1e1a24', '#302a38', '#463e4e', '#605868', '#847c8c'];  // Old Grimjaw's charcoal fur
  var MOSS = ['#1a4434', '#245a40', '#337450', '#4c9061', '#74b46e', '#a8d878'];   // ...and the moss on his back
  var CRY = ['#2a1650', '#4a2f7a', '#8f6cd1', '#b99aee', '#e4d2ff', '#ffffff'];    // Vorrakh's violet crystal
  var RUBY = ['#5a1420', '#a02a30', '#e0503e', '#ff9a86'];
  var MAH = ['#1f1015', '#371a1d', '#522623', '#6e3529', '#8c4a33', '#ad6541'];    // mahogany

  // ---- the four bounty trophies, each standing on its base row yb ----------------
  // Gloopgarr's dented crown on a plum cushion (11 wide), a drop of slime still clinging to it
  function tcCrown(im, x, yb) {
    rrect(im, x, yb - 2, 11, 3, 1, function (X, Y, i, j) { return j === 0 ? PLV[5] : j === 1 ? PLV[4] : PLV[2]; });
    px(im, x, yb, GLD[3]); px(im, x + 10, yb, GLD[2]);
    stamp(im, x + 1, yb - 7, [
      '5...5....',
      '541545133',
      '554444332',
      '4r44e43r2',
      '433333322'
    ], legend(['012345', GLD], { r: RUBY[2], e: '#5dffb0' }));
    px(im, x + 7, yb - 5, GLD[2]); px(im, x + 6, yb - 4, GLD[2]);      // the dent
    px(im, x + 3, yb - 2, '#5dffb0'); px(im, x + 3, yb - 1, alpha('#2fbf7f', 0.85));
  }
  // a violet crystal shard of Vorrakh's in a brass mount (9 wide)
  function tcShard(im, x, yb) {
    prism(im, x + 2, 4, yb - 7, yb - 1, 0.6, CRY);
    prism(im, x, 3, yb - 4, yb - 1, -0.9, CRY);
    prism(im, x + 6, 2, yb - 3, yb - 1, 0.8, CRY);
    hline(im, x, x + 8, yb, BRS[3]); px(im, x, yb, BRS[4]); px(im, x + 8, yb, BRS[2]);
    px(im, x + 1, yb - 1, BRS[4]); px(im, x + 7, yb - 1, BRS[2]);
  }
  // the Lantern Thief's stolen lantern, a wisp still burning inside (7 wide)
  function tcLantern(im, x, yb) {
    stamp(im, x, yb - 7, [
      '..bBb..',
      '.b...b.',
      '.BBBBb.',
      'BBBBBbd',
      'B2343bd',
      'B3454bd',
      'B2343bd',
      'BBBBbdd'
    ], { b: BRS[3], B: BRS[4], d: BRS[1], 2: TEAL[3], 3: TEAL[4], 4: TEAL[5], 5: WHITE });
  }
  // Old Grimjaw's great fang, set in a tuft of his mossy pelt (a pink toadstool still growing in it) (11 wide)
  function tcFang(im, x, yb) {
    tube(im, [[x + 4.5, yb - 2.5, 1.9], [x + 5.2, yb - 5.2, 1.35], [x + 6.5, yb - 7.2, 0.7], [x + 8.2, yb - 8.4, 0.1]], [BN[1], BN[2], BN[3], BN[4], BN[5]], { bias: 0.1 });
    px(im, x + 5, yb - 5, BN[2]); px(im, x + 6, yb - 6, BN[2]);                    // an old crack
    stamp(im, x, yb - 3, [
      '..mMMm.mm..',
      '.mMmffmmMm.',
      'fFfFffFffFd',
      '.dfdfddfdd.'
    ], { m: MOSS[3], M: MOSS[4], f: GRIMF[4], F: GRIMF[5], d: GRIMF[2] });
    px(im, x + 1, yb - 4, RSE[3]); px(im, x + 2, yb - 4, RSE[2]); px(im, x + 1, yb - 3, CRM[4]);
    px(im, x + 9, yb - 3, '#f6d27a');
  }

  // ---- Bounty Trophy Case (2x1, tall, soft inner glow) 32x44 — a glass-fronted vitrine of the four bounties
  function drawTrophyCase(im) {
    var R = DW, V = QLT, x, y;
    // crest: a shallow gable carrying the medal of the Silver Crescent (the Guild)
    stamp(im, 9, 2, [
      '....554433....',
      '..4443333322..',
      '44333333333322'
    ], rampLeg('012345', R));
    stamp(im, 13, 0, [
      '.4443.',
      '4vsvv2',
      '4svvw2',
      '3svww2',
      '3vsww1',
      '.2211.'
    ], legend(['012345', GLD], { v: VIO[3], w: VIO[2], s: SLV[4] }));
    px(im, 14, 1, VIO[4]);
    cornice(im, 1, 30, 5, R);
    // stiles + top rail
    woodV(im, 2, 9, 2, 24, R, 61, 3); vline(im, 2, 9, 32, R[4]);
    woodV(im, 28, 9, 2, 24, R, 62, 2); vline(im, 29, 9, 32, R[1]);
    rect(im, 4, 9, 24, 2, R[3]); hline(im, 4, 27, 9, R[4]); hline(im, 4, 27, 10, R[2]);
    // interior: midnight velvet, a shelf, the floor of the case
    var PLEAT = mix(V[1], V[2], 0.55);
    for (y = 11; y <= 31; y++) for (x = 4; x <= 27; x++) px(im, x, y, y < 12 ? V[0] : (x % 4 === 1 ? PLEAT : V[1]));
    hline(im, 4, 27, 19, R[4]); hline(im, 4, 27, 20, R[2]); hline(im, 4, 27, 21, V[0]);
    hline(im, 4, 27, 30, R[4]); hline(im, 4, 27, 31, R[2]);
    spill(im, 22, 14, 8, CRY[3], 0.34);
    spill(im, 9, 26, 7, TEAL[4], 0.3);
    // the trophies
    tcCrown(im, 4, 18);
    tcShard(im, 18, 18);
    tcLantern(im, 6, 29);
    tcFang(im, 17, 30);
    sparkle(im, 25, 12, CRY[4], false);
    // centre stiles + lock plate
    vline(im, 15, 11, 31, R[3]); vline(im, 16, 11, 31, R[2]);
    px(im, 15, 21, BRS[4]); px(im, 16, 21, BRS[3]); px(im, 15, 22, BRS[2]); px(im, 16, 22, BRS[1]);
    // glass: a cool sheen and highlight streaks
    [[4, 14], [17, 27]].forEach(function (p) {
      for (var yy = 11; yy <= 31; yy++) for (var xx = p[0]; xx <= p[1]; xx++) px(im, xx, yy, alpha('#c8d8f0', 0.06));
      line(im, p[0], 18, p[0] + 7, 11, alpha(WHITE, 0.42));
      line(im, p[0], 19, p[0] + 8, 11, alpha(WHITE, 0.2));
      line(im, p[0] + 2, 31, p[0] + 10, 23, alpha(WHITE, 0.16));
      px(im, p[0], 11, alpha(WHITE, 0.75));
    });
    // base with the brass plaque
    rect(im, 1, 32, 30, 8, R[3]);
    hline(im, 1, 30, 32, R[4]); hline(im, 1, 8, 32, R[5]); hline(im, 1, 30, 33, R[2]);
    vline(im, 1, 32, 39, R[4]); vline(im, 30, 33, 39, R[1]);
    inset(im, 4, 35, 6, 3, R, 2); inset(im, 22, 35, 6, 3, R, 2);
    stamp(im, 11, 34, [
      'hHHHHHHHHg',
      'Hbkbkbbkbg',
      'gggggggggd'
    ], { h: BRS[5], H: BRS[4], b: BRS[2], g: BRS[3], d: BRS[1], k: BRS[0] });
    hline(im, 1, 30, 38, R[2]); hline(im, 1, 30, 39, R[1]);
    stamp(im, 2, 40, ['.33.', '2332', '.22.'], rampLeg('0123', [R[0], R[1], R[3], R[4]]));
    stamp(im, 26, 40, ['.22.', '1221', '.11.'], rampLeg('0123', [R[0], R[1], R[2], R[3]]));
    outline(im, 'sel');
    floorShadow(im, 2, 29, 39, 43, 0.34);
    return im;
  }
  function iconTrophyCase() {
    var im = img(16, 16), R = DW, V = QLT;
    hline(im, 1, 14, 1, R[4]); hline(im, 1, 6, 1, R[5]); hline(im, 1, 14, 2, R[2]);
    px(im, 7, 0, GLD[4]); px(im, 8, 0, GLD[3]);
    rect(im, 2, 3, 12, 13, R[3]); vline(im, 2, 3, 15, R[4]); vline(im, 13, 3, 15, R[1]);
    rect(im, 3, 4, 10, 8, V[1]);
    hline(im, 3, 12, 8, R[4]); hline(im, 3, 12, 11, R[4]);
    stamp(im, 3, 5, ['5.5.', '4434', '3r32'], legend(['012345', GLD], { r: RUBY[2] }));
    px(im, 10, 5, CRY[4]); px(im, 10, 6, CRY[3]); px(im, 11, 6, CRY[2]); px(im, 10, 7, CRY[3]); px(im, 11, 7, CRY[1]);
    stamp(im, 4, 9, ['B3d', 'BBd'], { B: BRS[4], d: BRS[2], 3: TEAL[5] });
    stamp(im, 9, 9, ['mMm.', 'f55f'], { m: MOSS[3], M: MOSS[4], f: GRIMF[3], 5: BN[5] });
    vline(im, 7, 4, 11, R[3]); vline(im, 8, 4, 11, R[2]);
    line(im, 3, 7, 6, 4, alpha(WHITE, 0.45)); line(im, 9, 7, 12, 4, alpha(WHITE, 0.45));
    hline(im, 6, 9, 13, BRS[4]); px(im, 9, 13, BRS[2]);
    hline(im, 2, 13, 15, R[1]);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_trophy_case', name: 'Bounty Trophy Case', w: 2, h: 1, hr: 28, price: 0, seller: 'reward',
    light: { x: 21, y: 13, r: 26, color: L_VIOLET } }, drawTrophyCase, iconTrophyCase);

  // ---- Mineral Cabinet (2x1, moonlit specimen) 32x37 — Ronan's thanks for fourteen minerals (drawn 40 tall, trimmed)
  // a little cluster of lunarite: pale moon crystals with a crescent caught inside (9 wide)
  var LUN = [SLV[0], SLV[1], SLV[2], SLV[3], SLV[4], WHITE];
  function lunarite(im, x, yb) {
    prism(im, x + 1, 2, yb - 6, yb, -0.9, LUN);
    prism(im, x + 6, 3, yb - 8, yb, 0.9, LUN);
    prism(im, x + 2, 4, yb - 12, yb, 0.1, LUN);
    stamp(im, x + 3, yb - 7, ['.m', 'm.', '.m'], { m: '#7aa0e8' });
  }
  var SPECIMENS = [   // [light, mid, dark] tiny minerals for the specimen tray
    ['#ff9a86', '#e0503e', '#a02a30'], ['#ffbc62', '#e8843c', '#8a2a32'], ['#fff1c8', '#f2c45a', '#c88a3a'],
    ['#cfeeea', '#5dffb0', '#3c9688'], ['#8ac8ec', '#2e72b0', '#1e4e86'],
    ['#d4ccf6', '#7a6ac0', '#4a3a8a'], ['#ffc8ff', '#e07af0', '#9a4ac8'], ['#eaf8ff', '#7ab4e8', '#3a6aa8'],
    ['#d8cce6', '#a898b8', '#4a3a5a'], ['#c8c8ff', '#3a3a9a', '#1e1a5a']
  ];
  // one tiny specimen in a 3x2 cell: a crystal point, a pebble or a flat slice
  function specimen(im, x, y, S, k) {
    if (k % 3 === 0) { px(im, x + 1, y, S[0]); px(im, x, y + 1, S[1]); px(im, x + 1, y + 1, S[1]); px(im, x + 2, y + 1, S[2]); }
    else if (k % 3 === 1) { px(im, x, y, S[0]); px(im, x + 1, y, S[1]); px(im, x, y + 1, S[1]); px(im, x + 1, y + 1, S[2]); }
    else { px(im, x, y + 1, S[1]); px(im, x + 1, y + 1, S[1]); px(im, x + 2, y + 1, S[2]); px(im, x + 1, y, S[0]); px(im, x, y, alpha(S[1], 0.7)); }
  }
  function drawMineralCabinet(im) {
    var R = MAH, V = QLT, x;
    // carcass top (seen from above) + its front edge
    woodH(im, 1, 14, 30, 7, R, 81, 3);
    hline(im, 1, 30, 14, R[4]); hline(im, 1, 8, 14, R[5]); vline(im, 1, 14, 20, R[4]); vline(im, 30, 15, 20, R[2]);
    hline(im, 1, 30, 21, R[3]); hline(im, 1, 30, 22, R[2]); px(im, 1, 21, R[4]); hline(im, 2, 7, 21, R[4]);
    // glass-lidded specimen tray: ten minerals in velvet cells
    rect(im, 2, 13, 21, 7, R[3]);
    hline(im, 2, 22, 13, R[4]); vline(im, 2, 13, 19, R[4]); vline(im, 22, 14, 19, R[2]); hline(im, 3, 22, 19, R[1]);
    rect(im, 3, 14, 19, 5, V[1]);
    hline(im, 3, 21, 16, R[2]);
    for (var k = 0; k < 10; k++) {
      var cx = 3 + (k % 5) * 4, cy = 14 + Math.floor(k / 5) * 3;
      if (k % 5) { px(im, cx - 1, cy, R[2]); px(im, cx - 1, cy + 1, R[2]); }
      specimen(im, cx, cy, SPECIMENS[k], k);
    }
    line(im, 3, 18, 8, 13, alpha(WHITE, 0.4)); line(im, 4, 18, 9, 13, alpha(WHITE, 0.16));
    line(im, 13, 18, 17, 14, alpha(WHITE, 0.22));
    px(im, 2, 13, BRS[4]); px(im, 22, 13, BRS[3]); px(im, 2, 19, BRS[3]); px(im, 22, 19, BRS[2]);
    // the moonlit lunarite on a rough little rock
    ellipse(im, 26, 18, 3.4, 1.2, function (X, Y, nx, ny) { return ny < -0.2 ? STN[4] : nx > 0.4 ? STN[2] : STN[3]; });
    lunarite(im, 22, 17);
    spill(im, 25, 13, 7, SLV[4], 0.3);
    // drawer bank: two columns of three, brass label holders and cup pulls
    woodV(im, 2, 23, 28, 12, R, 82, 3);
    vline(im, 2, 23, 34, R[4]); vline(im, 29, 23, 34, R[1]);
    function drawerFront(x0, x1, y0) {     // y0 = the lit top edge; label below it, pull below that
      var mx = Math.floor((x0 + x1) / 2);
      rect(im, x0, y0, x1 - x0 + 1, 3, R[3]);
      hline(im, x0, x1, y0, R[4]); vline(im, x0, y0, y0 + 2, R[4]); vline(im, x1, y0 + 1, y0 + 2, R[2]);
      px(im, mx - 1, y0 + 1, BRS[3]); px(im, mx, y0 + 1, PAP[5]); px(im, mx + 1, y0 + 1, PAP[4]); px(im, mx + 2, y0 + 1, BRS[2]);
      px(im, mx, y0 + 2, BRS[4]); px(im, mx + 1, y0 + 2, BRS[2]);
    }
    [[4, 14], [17, 27]].forEach(function (c) {
      for (var r = 0; r < 3; r++) { hline(im, c[0], c[1], 23 + r * 4, R[1]); drawerFront(c[0], c[1], 24 + r * 4); }
    });
    vline(im, 15, 23, 34, R[2]); vline(im, 16, 23, 34, R[1]);
    // plinth + bracket feet
    rect(im, 1, 35, 30, 2, R[2]); hline(im, 1, 30, 35, R[4]); hline(im, 1, 30, 36, R[1]); px(im, 1, 35, R[5]);
    stamp(im, 2, 37, ['443', '43.'], rampLeg('012345', R)); stamp(im, 27, 37, ['221', '.21'], rampLeg('012345', R));
    // ...and the bottom-left drawer stands a little open: more minerals on velvet inside
    rect(im, 5, 31, 9, 2, V[1]); hline(im, 5, 13, 31, V[0]);
    vline(im, 4, 31, 32, R[4]); vline(im, 14, 31, 32, R[2]);
    [[6, 4], [8, 2], [10, 6], [12, 3]].forEach(function (s) { var S = SPECIMENS[s[1]]; px(im, s[0], 32, S[1]); px(im, s[0] + 1, 32, S[2]); px(im, s[0], 31, S[0]); });
    drawerFront(4, 14, 33); hline(im, 4, 14, 36, R[1]);
    for (x = 4; x <= 14; x++) tint(im, x, 37, OUT, 0.5);
    outline(im, 'sel');
    floorShadow(im, 2, 29, 36, 39, 0.32);
    halo(im, 26, 8, 5.5, SLV[4], 0.2);
    sparkle(im, 21, 7, SLV[4], false); px(im, 31, 9, alpha(SLV[4], 0.7));
    return im;
  }
  function iconMineralCabinet() {
    var im = img(16, 16), R = MAH;
    prism(im, 10, 3, 0, 6, 0, LUN); prism(im, 8, 2, 3, 6, -0.6, LUN); prism(im, 13, 2, 3, 6, 0.6, LUN);
    rect(im, 1, 6, 14, 3, R[3]); hline(im, 1, 14, 6, R[4]); hline(im, 1, 14, 8, R[2]);
    rect(im, 2, 6, 6, 2, QLT[1]); px(im, 3, 6, '#e0503e'); px(im, 5, 6, '#5dffb0'); px(im, 3, 7, '#7a6ac0'); px(im, 5, 7, '#f2c45a'); px(im, 7, 7, '#2e72b0');
    rect(im, 2, 9, 12, 6, R[3]); vline(im, 2, 9, 14, R[4]); vline(im, 13, 9, 14, R[1]);
    [10, 12].forEach(function (y) { hline(im, 3, 12, y - 1, R[1]); px(im, 5, y, BRS[4]); px(im, 10, y, BRS[4]); px(im, 6, y, CRM[4]); px(im, 11, y, CRM[4]); });
    hline(im, 1, 14, 15, R[2]);
    outline(im, 'sel');
    return im;
  }
  def({ id: 'furn_mineral_cabinet', name: 'Mineral Cabinet', w: 2, h: 1, hr: 21, trim: 3, price: 0, seller: 'reward',
    light: { x: 26, y: 7, r: 32, color: L_MOON } }, drawMineralCabinet, iconMineralCabinet);

  // ===========================================================================
  // Inventory icons (16x16 miniatures)
  // ===========================================================================
  function setIcon(id, fn) { if (BY[id]) BY[id].icon = fn; }
  function I16() { return img(16, 16); }

  // ---- Canopy Bed
  setIcon('furn_bed_canopy', function () {
    var im = I16(), R = DW, P = PLV, Q = QLT;
    for (var x = 2; x <= 13; x++) for (var y = 3; y <= 7; y++) px(im, x, y, x % 3 === 0 ? P[0] : P[1]);
    // headboard with the moon
    rect(im, 3, 5, 10, 3, R[3]); hline(im, 4, 11, 4, R[4]); hline(im, 3, 12, 5, R[3]);
    px(im, 7, 5, SLV[4]); px(im, 8, 5, SLV[3]); px(im, 7, 6, SLV[3]); px(im, 8, 6, SLV[2]);
    // curtains + valance + cornice
    for (var cy = 2; cy <= 9; cy++) { px(im, 1, cy, P[4]); px(im, 2, cy, cy < 6 ? P[3] : P[2]); px(im, 13, cy, cy < 6 ? P[2] : P[1]); px(im, 14, cy, P[2]); }
    px(im, 1, 6, GLD[4]); px(im, 2, 6, GLD[3]); px(im, 13, 6, GLD[3]); px(im, 14, 6, GLD[2]);
    for (var vx = 1; vx <= 14; vx++) { px(im, vx, 2, vx % 2 ? P[4] : P[3]); px(im, vx, 3, vx % 3 === 1 ? GLD[3] : P[2]); }
    hline(im, 1, 14, 0, R[4]); hline(im, 1, 14, 1, R[2]); hline(im, 1, 6, 0, R[5]);
    // pillows, sheet, quilt
    rect(im, 3, 7, 4, 2, LIN[4]); px(im, 3, 7, LIN[5]); hline(im, 3, 6, 8, LIN[3]);
    rect(im, 9, 7, 4, 2, LIN[4]); px(im, 9, 7, LIN[5]); hline(im, 9, 12, 8, LIN[3]);
    hline(im, 2, 13, 9, LIN[5]);
    for (var qy = 10; qy <= 13; qy++) for (var qx = 2; qx <= 13; qx++) px(im, qx, qy, qx > 11 ? Q[2] : (qx + qy < 16 ? Q[4] : Q[3]));
    crescent6(im, 6, 9, [GLD[3], GLD[4], CRM[5]]);
    px(im, 11, 11, GLD[4]); px(im, 4, 12, SLV[4]);
    hline(im, 2, 13, 14, GLD[2]); px(im, 3, 14, GLD[3]);
    // front posts with finials
    vline(im, 1, 10, 15, R[4]); vline(im, 14, 10, 15, R[2]);
    px(im, 1, 9, GLD[4]); px(im, 14, 9, GLD[3]);
    outline(im, 'sel');
    return im;
  });

  // ---- Simple Cot (side view)
  setIcon('furn_cot', function () {
    var im = I16(), R = WD, S = STR;
    // head plank
    rect(im, 1, 4, 2, 9, R[3]); vline(im, 1, 4, 12, R[4]); px(im, 1, 4, R[5]); px(im, 2, 4, R[4]);
    // mattress (straw)
    for (var x = 3; x <= 14; x++) for (var y = 8; y <= 10; y++) px(im, x, y, hash(x, y, 3) < 0.3 ? S[4] : hash(x, y, 4) < 0.3 ? S[2] : S[3]);
    px(im, 15, 9, S[4]); px(im, 3, 11, S[3]);
    // pillow
    rrect(im, 3, 5, 4, 3, 1, function (x, y, i, j) { return j === 0 ? CRM[5] : j === 2 ? CRM[2] : CRM[3]; });
    // patchwork blanket draped over
    for (var bx = 7; bx <= 14; bx++) for (var by = 6; by <= 11; by++) {
      if (by === 6 && bx < 8) continue;
      var P = PATCH[Math.floor(hash(Math.floor((bx - 7) / 3), Math.floor((by - 6) / 3), 9) * PATCH.length)];
      px(im, bx, by, by === 6 ? P[2] : (bx - 7) % 3 === 2 || (by - 6) % 3 === 2 ? P[0] : P[1]);
    }
    vline(im, 7, 7, 10, CRM[3]); px(im, 7, 6, CRM[4]);
    // frame + legs
    hline(im, 2, 14, 12, R[3]); hline(im, 2, 14, 13, R[2]); px(im, 2, 12, R[4]);
    vline(im, 2, 14, 14, R[3]); vline(im, 13, 14, 14, R[2]); vline(im, 14, 13, 14, R[1]);
    outline(im, 'sel');
    return im;
  });

  // ---- Alchemist's Desk
  setIcon('furn_desk', function () {
    var im = I16(), R = DW;
    woodH(im, 0, 7, 16, 3, R, 5, 3); hline(im, 0, 15, 7, R[4]); hline(im, 0, 4, 7, R[5]);
    hline(im, 0, 15, 10, R[2]);
    function ped(x0) {
      rect(im, x0, 11, 5, 4, R[3]); vline(im, x0, 11, 14, R[4]); vline(im, x0 + 4, 11, 14, R[2]);
      hline(im, x0 + 1, x0 + 3, 12, R[2]); px(im, x0 + 2, 13, BRS[4]);
    }
    ped(1); ped(10);
    rect(im, 6, 11, 4, 4, R[0]);
    // open book, quill, glowing vial
    stamp(im, 1, 4, ['.aa.aa.', 'PPPpPPP', 'PttpttP', 'bbbbbbb'], { a: PAP[5], P: PAP[4], p: PAP[2], t: PAP[2], b: PLV[3] });
    px(im, 9, 7, GLASS.e); px(im, 10, 7, '#231b38');
    line(im, 9, 6, 12, 1, LIN[4]); px(im, 13, 0, LIN[5]); px(im, 12, 2, VIO[4]); px(im, 11, 3, VIO[4]);
    stamp(im, 12, 3, ['.c.', 'h3e', 'h4e', 'e2e'], { c: WD[4], h: GLASS.h, e: GLASS.e, 2: LQ.emerald[1], 3: LQ.emerald[2], 4: LQ.emerald[3] });
    outline(im, 'sel');
    return im;
  });

  // ---- Wingback Armchair
  setIcon('furn_armchair', function () {
    var im = I16(), P = PLV;
    stamp(im, 0, 0, [
      '................',
      '......hHHh......',
      '..hh.hHhhhB.bk..',
      '.hHhbhoBBoBbBbk.',
      '.hHhbhBBBBBbBbk.',
      '.hHhbhoBBoBbBbk.',
      '.HHhbbbbbbbbhBk.',
      '.hgBbhhhhhhbBnk.',
      '.BBbkbbbbbbkbbk.',
      '.ggggggggggnnnn.',
      '.bBBBBBBBBBBBbk.',
      '.bbbbbbbbbbbbbk.',
      '.gngngngngngngn.',
      '..Ww........wx..',
      '..gg........nn..'
    ], { H: P[5], h: P[4], B: P[3], b: P[2], k: P[1], K: P[0], o: GLD[4], g: GLD[3], n: GLD[2], w: DW[3], W: DW[4], x: DW[2] });
    outline(im, 'sel');
    return im;
  });

  // ---- Potion Shelf
  setIcon('furn_potion_shelf', function () {
    var im = I16(), R = DW;
    for (var x = 1; x <= 14; x++) {
      var t = archTop(x * 2.07, 0, 3);
      for (var y = t; y <= 15; y++) px(im, x, y, R[1]);
      px(im, x, t, x <= 7 ? R[5] : R[3]); px(im, x, t + 1, R[2]);
    }
    vline(im, 1, 3, 15, R[4]); vline(im, 14, 3, 15, R[1]);
    px(im, 7, 0, GLD[4]); px(im, 8, 0, GLD[3]);
    function board(y) { hline(im, 2, 13, y, R[4]); hline(im, 2, 13, y + 1, R[2]); }
    stamp(im, 6, 2, ['.n.', 'e3e', 'h43', 'e2e'], { n: GLASS.n, e: GLASS.e, h: GLASS.h, 2: LQ.emerald[1], 3: LQ.emerald[2], 4: LQ.emerald[3] });
    px(im, 3, 5, LQ.violet[2]); px(im, 3, 4, LQ.violet[1]); px(im, 11, 5, LQ.rose[2]); px(im, 11, 4, LQ.rose[3]); px(im, 12, 5, LQ.rose[1]);
    board(6);
    [[3, LQ.violet], [5, LQ.rose], [7, LQ.amber], [9, LQ.cyan], [11, LQ.emerald]].forEach(function (b) {
      px(im, b[0], 8, GLASS.n); px(im, b[0], 9, b[1][2]); px(im, b[0] + 1, 9, b[1][1]); px(im, b[0], 10, b[1][1]); px(im, b[0] + 1, 10, b[1][0]);
    });
    board(11);
    [[3, LQ.amber], [6, LQ.emerald], [9, LQ.violet], [12, LQ.rose]].forEach(function (b) { px(im, b[0], 13, b[1][2]); px(im, b[0], 14, b[1][1]); px(im, b[0] + 1, 14, b[1][0]); px(im, b[0] + 1, 13, b[1][1]); });
    hline(im, 1, 14, 15, R[2]);
    outline(im, 'sel');
    return im;
  });

  // ---- Crystal Lamp
  setIcon('furn_crystal_lamp', function () {
    var im = I16(), S = STN, C = ['#2a1650', '#4a2f7a', '#8f6cd1', '#b99aee', '#e4d2ff', '#ffffff'];
    rect(im, 3, 13, 10, 2, S[2]); hline(im, 3, 12, 13, S[4]); hline(im, 3, 12, 14, S[2]);
    for (var y = 10; y <= 12; y++) { var cols = [S[4], S[3], S[2], S[4], S[3], S[1]]; for (var i = 0; i < 6; i++) px(im, 5 + i, y, cols[i]); }
    hline(im, 4, 11, 8, S[5]); hline(im, 4, 11, 9, S[3]);
    hline(im, 5, 10, 7, BRS[3]);
    prism(im, 3, 3, 3, 7, -0.6, C); prism(im, 10, 3, 4, 7, 0.6, C); prism(im, 6, 4, 0, 7, 0, C);
    outline(im, 'sel');
    return im;
  });

  // ---- Lantern Stand
  setIcon('furn_lantern_stand', function () {
    var im = I16(), I = IRN, B = BRS, G = EMG;
    for (var y = 2; y <= 14; y++) { px(im, 2, y, I[4]); px(im, 3, y, I[2]); }
    hline(im, 3, 9, 1, I[4]); px(im, 10, 2, I[3]); px(im, 1, 2, I[4]); px(im, 2, 1, I[4]);
    hline(im, 0, 5, 15, I[3]); px(im, 0, 15, B[3]); px(im, 5, 15, B[2]);
    stamp(im, 6, 3, [
      '...b...',
      '..bBb..',
      '.bBBbb.',
      'iIIIIii',
      'i.....i',
      'i.....i',
      'i.....i',
      'i.....i',
      'iIIIIii',
      '.bbbbb.'
    ], { i: I[3], I: I[4], b: B[2], B: B[4] });
    for (var gy = 7; gy <= 10; gy++) for (var gx = 7; gx <= 11; gx++) px(im, gx, gy, G[2]);
    stamp(im, 7, 7, ['..3..', '.343.', '34543', '.444.'], { 3: G[3], 4: G[4], 5: G[5] });
    outline(im, 'sel');
    return im;
  });

  // ---- Potted Fern
  setIcon('furn_fern', function () {
    var im = I16();
    archFrond(im, 7.5, 10, 125, 8, 0.05, 0); archFrond(im, 7.5, 10, 55, 8, 0.05, 0);
    // pot
    hline(im, 4, 11, 10, TC[5]); hline(im, 4, 11, 11, TC[3]); px(im, 11, 10, TC[3]);
    for (var y = 12; y <= 15; y++) for (var x = 5 + (y > 13 ? 1 : 0); x <= 10 - (y > 13 ? 1 : 0); x++) px(im, x, y, x < 6 + (y > 13 ? 1 : 0) ? TC[4] : x > 8 ? TC[2] : TC[3]);
    archFrond(im, 7, 10, 160, 7, 0.12, 1); archFrond(im, 8, 10, 20, 7, 0.12, 1);
    archFrond(im, 7, 10, 115, 8, 0.05, 1); archFrond(im, 8, 10, 65, 8, 0.05, 1); archFrond(im, 7.5, 10, 90, 7, 0.02, 1);
    outline(im, 'sel');
    return im;
  });

  // ---- Moonflower Pot
  setIcon('furn_moonflower_pot', function () {
    var im = I16(), N = NAV;
    path(im, bez([7, 11], [4, 7], [5, 4], 6), LEAF[2]); path(im, bez([8, 11], [12, 9], [11, 6], 6), LEAF[2]);
    heartLeaf(im, 1, 6, false); heartLeaf(im, 11, 8, true); heartLeaf(im, 8, 5, true); heartLeaf(im, 3, 8, false);
    for (var y = 11; y <= 15; y++) {
      var w = y === 11 ? 4 : y <= 13 ? 5 : 4;
      for (var x = 8 - w; x <= 7 + w; x++) { var u = (x - (8 - w)) / (2 * w - 1); px(im, x, y, u < 0.2 ? N[5] : u < 0.55 ? N[4] : u < 0.8 ? N[3] : N[2]); }
    }
    hline(im, 4, 11, 10, N[5]); px(im, 6, 13, SLV[4]); px(im, 9, 14, SLV[3]);
    moonflower(im, 2, 0, true); moonflower(im, 10, 3, false);
    outline(im, 'sel');
    return im;
  });

  // ---- Potted Tree
  setIcon('furn_potted_tree', function () {
    var im = I16(), W = WCR;
    vline(im, 7, 6, 10, WD[4]); vline(im, 8, 6, 10, WD[2]);
    leafCloud(im, 4, 5.5, 2.8, 2.2, 81); leafCloud(im, 11, 5, 2.8, 2.2, 82); leafCloud(im, 7.5, 2.5, 3.6, 2.4, 83);
    pxOn(im, 6, 1, LEAF[6]); pxOn(im, 3, 4, LEAF[6]); pxOn(im, 9, 2, CRM[5]); pxOn(im, 12, 5, CRM[5]); pxOn(im, 4, 6, CRM[5]);
    hline(im, 3, 12, 10, W[5]); hline(im, 4, 11, 9, W[2]);
    [[3, 12], [4, 11], [5, 10], [6, 9], [5, 10]].forEach(function (r, k) {
      for (var x = r[0]; x <= r[1]; x++) { var u = (x - r[0]) / Math.max(1, r[1] - r[0]); px(im, x, 11 + k, u < 0.25 ? W[5] : u < 0.6 ? W[4] : W[2]); }
    });
    hline(im, 4, 11, 12, GLD[3]); px(im, 4, 12, GLD[4]);
    outline(im, 'sel');
    return im;
  });

  // ---- Moon Painting
  setIcon('furn_painting_moon', function () {
    var im = I16();
    giltFrame(im, 0, 2, 15, 13);
    for (var y = 5; y <= 10; y++) for (var x = 3; x <= 12; x++) px(im, x, y, SKY[y < 7 ? 1 : y < 9 ? 2 : 3]);
    px(im, 5, 6, CRM[5]); px(im, 6, 6, CRM[4]); px(im, 5, 7, CRM[4]); px(im, 6, 7, SLV[3]);
    px(im, 9, 5, WHITE); px(im, 11, 7, SLV[4]);
    for (var hx = 3; hx <= 12; hx++) { var h = 9 + (hx > 6 && hx < 11 ? 0 : 1); for (var hy = h; hy <= 10; hy++) px(im, hx, hy, hy === h ? VIO[3] : VIO[2]); }
    px(im, 10, 7, '#141030'); px(im, 10, 8, AMB[3]);
    outline(im, 'sel');
    return im;
  });

  // ---- Portrait of Morwenna
  setIcon('furn_portrait_morwenna', function () {
    var im = I16();
    for (var y = 0; y <= 15; y++) for (var x = 2; x <= 13; x++) {
      if (y === 0 && (x < 5 || x > 10)) continue;
      if (y === 1 && (x < 3 || x > 12)) continue;
      px(im, x, y, (x + y < 12) ? GLD[4] : GLD[2]);
    }
    stamp(im, 4, 2, [
      'qqqqqhhq',
      'qqqqhHqq',
      'qqqhHHhq',
      'qqhpgphq',
      'qhHHHHHh',
      'qSfFFfSq',
      'qSkFfkwq',
      'qsfFEfsq',
      'qqfmmfqq',
      'qrcGXcrq',
      'rRRRRRRr',
      'rRRRRRRr',
      'rRRRRRRr'
    ], {
      q: '#1e1530', h: VIO[1], H: VIO[2], p: PLV[3], g: GLD[4], s: '#8a84aa', S: '#c4c0d4',
      f: '#e0c4cc', F: '#f4e2e6', E: '#9a7280', k: OUT, w: WHITE, m: '#6e3048',
      c: '#10302a', r: '#1a4434', R: '#245a40', G: GLD[4], X: EMG[3]
    });
    outline(im, 'sel');
    return im;
  });

  // ---- Star Map
  setIcon('furn_star_map', function () {
    var im = I16(), INK = '#3a3466', INK2 = '#5a5290';
    for (var y = 3; y <= 12; y++) for (var x = 2; x <= 13; x++) px(im, x, y, x === 13 ? PAP[2] : y === 12 ? PAP[3] : hash(x, y, 5) < 0.1 ? PAP[3] : PAP[4]);
    for (var a = 0; a < 20; a++) { var an = a * Math.PI / 10; px(im, Math.round(7.5 + Math.cos(an) * 3.6 - 0.5), Math.round(7.5 + Math.sin(an) * 3.2 - 0.5), INK); }
    px(im, 7, 7, GLD[4]); px(im, 3, 4, GLD[3]); px(im, 4, 5, INK2); px(im, 12, 10, GLD[3]); px(im, 11, 4, GLD[4]);
    px(im, 11, 11, '#b8303a');
    [2, 13].forEach(function (y) { hline(im, 1, 14, y, y === 2 ? WD[4] : WD[3]); px(im, 0, y, BRS[4]); px(im, 15, y, BRS[2]); });
    hline(im, 1, 14, 14, WD[1]);
    outline(im, 'sel');
    return im;
  });

  // ---- Lunar Tapestry
  setIcon('furn_tapestry', function () {
    var im = I16(), V = VIO, prof = [3, 4, 3, 2, 3, 3, 2, 1];
    for (var x = 4; x <= 11; x++) { var bot = 11 + Math.min(x - 4, 11 - x); for (var y = 2; y <= bot; y++) px(im, x, y, V[prof[x - 4]]); }
    vline(im, 5, 3, 11, GLD[3]); vline(im, 10, 3, 11, GLD[2]);
    ellipse(im, 7.5, 7, 1.7, 1.7, function (x, y, nx, ny) { return (nx + ny) < 0 ? WHITE : CRM[4]; });
    px(im, 7, 3, CRM[4]); px(im, 8, 4, CRM[3]); px(im, 7, 11, SLV[4]);
    hline(im, 3, 12, 1, DW[4]); px(im, 2, 1, BRS[4]); px(im, 13, 1, BRS[2]);
    px(im, 7, 14, GLD[4]); px(im, 8, 14, GLD[3]); px(im, 7, 15, GLD[2]);
    outline(im, 'sel');
    return im;
  });

  // ---- Wall Clock
  setIcon('furn_wall_clock', function () {
    var im = I16(), R = DW;
    stamp(im, 5, 0, ['..gg..', '.5543.', '554332'], legend(['012345', R], { g: GLD[4] }));
    ellipse(im, 7.5, 7, 5, 4.6, function (x, y, nx, ny) { return (nx + ny) < -0.3 ? R[4] : (nx + ny) < 0.6 ? R[3] : R[2]; });
    ellipse(im, 7.5, 7, 3.8, 3.5, function (x, y, nx, ny) { return (nx + ny) < 0 ? GLD[4] : GLD[2]; });
    ellipse(im, 7.5, 7, 3, 2.7, function (x, y, nx, ny) { return (nx + ny) < -0.5 ? CRM[5] : CRM[4]; });
    px(im, 7, 4, OUT); px(im, 8, 4, OUT); line(im, 7, 7, 6, 5, OUT); line(im, 8, 7, 10, 5, '#3a3242');
    rect(im, 6, 12, 4, 3, R[1]); vline(im, 5, 12, 14, R[4]); vline(im, 10, 12, 14, R[2]); px(im, 7, 13, BRS[4]); px(im, 8, 13, BRS[2]);
    px(im, 7, 15, GLD[3]); px(im, 8, 15, GLD[2]);
    outline(im, 'sel');
    return im;
  });

  // ---- Crystal Ball
  setIcon('furn_crystal_ball', function () {
    var im = I16(), R = DW, P = PLV;
    line(im, 4, 12, 3, 15, R[3]); line(im, 11, 12, 12, 15, R[2]); vline(im, 7, 12, 15, R[4]); vline(im, 8, 12, 15, R[2]);
    ellipse(im, 7.5, 10.5, 6, 1.6, function (x, y, nx, ny) { return ny < 0 ? P[5] : P[4]; });
    for (var x = 2; x <= 13; x++) { px(im, x, 12, x < 5 ? P[3] : P[2]); if (x % 3 === 1) px(im, x, 13, GLD[3]); }
    hline(im, 5, 10, 9, BRS[3]);
    ellipse(im, 7.5, 5, 4.4, 4.4, function (x, y, nx, ny) {
      var d = nx * nx + ny * ny, l = -nx * 0.55 - ny * 0.65;
      if (d > 0.7) return l > 0.2 ? VLG[3] : VLG[1];
      return Math.sin((nx * 3 + ny * 2) * 2.2 + d * 4) > 0.6 ? VLG[4] : d < 0.25 ? VLG[3] : VLG[2];
    });
    px(im, 5, 2, WHITE); px(im, 4, 3, WHITE); px(im, 7, 5, VLG[5]);
    outline(im, 'sel');
    return im;
  });

  // ---- Celestial Globe
  setIcon('furn_globe', function () {
    var im = I16(), R = DW;
    line(im, 6, 12, 3, 15, R[3]); line(im, 9, 12, 12, 15, R[2]); vline(im, 7, 12, 15, R[4]); vline(im, 8, 12, 15, R[2]);
    vline(im, 7, 10, 11, BRS[4]); vline(im, 8, 10, 11, BRS[2]);
    ellipse(im, 7.5, 6, 4.5, 4.5, function (x, y, nx, ny) {
      var l = -nx * 0.55 - ny * 0.65 + Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * 0.6;
      return l > 0.75 ? NAV[5] : l > 0.45 ? NAV[4] : l > 0.1 ? NAV[3] : NAV[2];
    });
    for (var x = 4; x <= 11; x++) pxOn(im, x, Math.round(7 - (x - 7.5) * 0.45), GLD[3]);
    px(im, 6, 4, SLV[4]); px(im, 9, 5, GLD[4]); px(im, 5, 3, WHITE);
    for (var a = 0; a < 40; a++) { var an = a * Math.PI / 20, mx = Math.round(7.5 + Math.cos(an) * 5.6 - 0.5), my = Math.round(6 + Math.sin(an) * 5.6 - 0.5); if (my <= 10) px(im, mx, my, (Math.cos(an) + Math.sin(an)) < 0 ? BRS[4] : BRS[2]); }
    hline(im, 2, 13, 10, OAK[3]); px(im, 2, 10, OAK[4]); px(im, 13, 10, OAK[2]);
    outline(im, 'sel');
    return im;
  });

  // ---- Brass Telescope
  setIcon('furn_telescope', function () {
    var im = I16(), R = OAK;
    line(im, 7, 9, 3, 15, R[4]); line(im, 8, 9, 13, 15, R[2]); line(im, 8, 9, 8, 15, R[3]);
    px(im, 7, 8, BRS[4]); px(im, 8, 8, BRS[2]);
    tube(im, [[2, 10, 0.9], [7, 7, 1.3], [12.5, 3, 1.8]], [BRS[1], BRS[2], BRS[3], BRS[4], BRS[5]]);
    line(im, 5, 7, 6, 9, BRS[1]);
    ellipse(im, 13, 2.5, 1.2, 1.2, NAV[2]); px(im, 13, 2, SLV[4]);
    outline(im, 'sel');
    return im;
  });

  // ---- Decorative Cauldron
  setIcon('furn_cauldron_decor', function () {
    var im = I16(), I = IRN, G = EMG;
    px(im, 3, 15, I[3]); px(im, 12, 15, I[2]); px(im, 7, 15, I[3]);
    sphere(im, 7.5, 10.5, 6.4, 4.6, [I[0], I[1], I[2], I[3], I[4]], { bias: 0.05 });
    for (var x = 0; x < 16; x++) for (var y = 0; y < 6; y++) px(im, x, y, null);
    ellipse(im, 7.5, 6.5, 6.4, 1.8, function (x, y, nx, ny) { return ny < 0 ? I[5] : I[3]; });
    ellipse(im, 7.5, 6.5, 4.8, 1, function (x, y, nx, ny) { return ny < -0.2 ? G[3] : G[2]; });
    px(im, 5, 6, G[5]); px(im, 9, 6, G[4]);
    px(im, 6, 4, alpha(G[4], 0.9)); px(im, 9, 2, alpha(G[4], 0.8)); px(im, 7, 1, alpha(G[3], 0.6));
    [[5, 11], [7, 12], [9, 11]].forEach(function (p) { px(im, p[0], p[1], '#4a3b6d'); });
    outline(im, 'sel');
    return im;
  });

  // ---- Music Box
  setIcon('furn_music_box', function () {
    var im = I16(), P = PLV;
    rect(im, 2, 10, 12, 4, P[3]); hline(im, 2, 13, 10, P[4]); vline(im, 2, 10, 13, P[4]); vline(im, 13, 11, 13, P[2]); hline(im, 3, 13, 13, P[2]);
    px(im, 7, 11, GLD[4]); px(im, 8, 11, GLD[3]); px(im, 7, 12, OUT);
    px(im, 2, 10, GLD[4]); px(im, 13, 10, GLD[3]); px(im, 2, 13, GLD[3]); px(im, 13, 13, GLD[2]);
    rect(im, 3, 8, 10, 2, VIO[1]); hline(im, 2, 13, 7, P[4]); for (var cx = 4; cx <= 11; cx++) px(im, cx, 9, cx % 2 ? GLD[3] : GLD[4]);
    poly(im, [[2, 7], [3, 3], [13, 3], [14, 7]], P[3]); hline(im, 3, 12, 3, P[4]); rect(im, 4, 4, 8, 3, VIO[1]);
    px(im, 10, 5, SLV[4]); px(im, 11, 5, SLV[2]);
    vline(im, 7, 7, 8, GLD[2]); stamp(im, 6, 2, ['.gg', 'g..', 'g..', '.gg'], { g: GLD[4] });
    px(im, 14, 11, GLD[4]); px(im, 15, 11, GLD[3]);
    note(im, 0, 0, GLD[4]); note(im, 12, 0, '#e4d2ff');
    outline(im, 'sel');
    return im;
  });

  // ---- Harp
  setIcon('furn_harp', function () {
    var im = I16();
    var neckY = function (x) { return Math.round(2 + 1.5 * Math.sin((x - 3) / 8 * Math.PI)); };
    for (var x = 5; x <= 11; x++) { var sb = Math.round(13 - (x - 5) * 9 / 6); vline(im, x, neckY(x) + 2, sb - 1, x % 3 === 0 ? RSE[3] : SLV[4]); }
    for (var t = 0; t <= 1.0001; t += 0.05) {
      var cx = 4.5 + t * 7.5, cy = 13.5 - t * 10.5;
      px(im, Math.round(cx), Math.round(cy), WD[3]); px(im, Math.round(cx) + 1, Math.round(cy), WD[2]);
    }
    for (var nx = 3; nx <= 12; nx++) { var y0 = neckY(nx); px(im, nx, y0, GLD[4]); px(im, nx, y0 + 1, GLD[2]); }
    for (var y = 1; y <= 13; y++) { px(im, 2, y, GLD[4]); px(im, 3, y, GLD[2]); }
    px(im, 2, 0, GLD[4]); px(im, 1, 1, GLD[3]);
    hline(im, 1, 10, 14, GLD[3]); hline(im, 1, 10, 15, WD[2]); px(im, 1, 14, GLD[4]);
    outline(im, 'sel');
    return im;
  });

  // ---- Owl Perch
  setIcon('furn_owl_perch', function () {
    var im = I16(), R = WD, O = OWL;
    hline(im, 1, 14, 13, R[4]); hline(im, 1, 14, 14, R[2]); px(im, 2, 12, LEAF[5]);
    vline(im, 7, 15, 15, R[4]); vline(im, 8, 15, 15, R[2]); hline(im, 5, 10, 15, R[3]);
    drawOwl(im, 3, 0);
    outline(im, 'sel');
    return im;
  });

  // ---- Cat Bed (fits as is)
  setIcon('furn_cat_bed', function () { return autoIcon(rawSprite('furn_cat_bed')); });

  // ---- Wardrobe
  setIcon('furn_wardrobe', function () {
    var im = I16(), R = DW;
    rect(im, 2, 3, 12, 11, R[3]); vline(im, 2, 3, 13, R[4]); vline(im, 13, 3, 13, R[1]);
    function door(x0) {
      rect(im, x0, 5, 5, 8, R[2]);
      for (var i = 0; i < 3; i++) { var top = 6 + (i === 1 ? 0 : 1); vline(im, x0 + 1 + i, top, 11, i === 0 ? R[4] : R[3]); }
      px(im, x0 + 2, 9, GLD[3]);
    }
    door(3); door(8); vline(im, 7, 4, 13, R[0]);
    px(im, 6, 9, BRS[4]); px(im, 9, 9, BRS[4]);
    hline(im, 1, 14, 2, R[4]); hline(im, 1, 14, 3, R[1]); hline(im, 6, 9, 1, R[4]); px(im, 7, 0, GLD[4]); px(im, 8, 0, GLD[3]);
    hline(im, 1, 14, 13, R[4]); hline(im, 1, 14, 14, R[2]); px(im, 2, 15, R[3]); px(im, 3, 15, R[3]); px(im, 12, 15, R[2]); px(im, 13, 15, R[1]);
    outline(im, 'sel');
    return im;
  });

  // ---- Standing Mirror
  setIcon('furn_mirror', function () {
    var im = I16(), R = DW;
    for (var y = 3; y <= 14; y++) { px(im, 3, y, R[4]); px(im, 12, y, R[1]); }
    px(im, 3, 2, GLD[4]); px(im, 12, 2, GLD[3]);
    hline(im, 1, 4, 15, R[3]); hline(im, 11, 14, 15, R[2]);
    ellipse(im, 7.5, 7.5, 3.6, 6.8, function (x, y, nx, ny) { return (nx + ny * 0.6) < 0 ? GLD[4] : GLD[2]; });
    ellipse(im, 7.5, 7.5, 2.4, 5.6, function (x, y, nx, ny) { var t = (nx * 0.4 + ny * 0.9 + 1) / 2; return t < 0.35 ? SLV[4] : t < 0.6 ? SLV[3] : t < 0.85 ? '#9a8ccc' : '#6e5ea8'; });
    line(im, 6, 6, 8, 3, alpha(WHITE, 0.85)); px(im, 6, 9, alpha(WHITE, 0.5));
    outline(im, 'sel');
    return im;
  });

  // ---- Trophies (no plinth, a slim brass-capped base)
  function slimBase(im) {
    rect(im, 3, 14, 10, 2, DW[3]); hline(im, 3, 12, 14, DW[5]); hline(im, 4, 12, 15, DW[1]); px(im, 3, 15, DW[3]);
    hline(im, 6, 9, 15, BRS[3]);
  }
  setIcon('furn_trophy_slime', function () {
    var im = I16(), S = ['#0f3a34', '#1e6a56', '#2fbf7f', '#5dffb0', '#b4ffd9', '#ffffff'];
    slimBase(im);
    for (var y = 3; y <= 13; y++) for (var x = 4; x <= 11; x++) glassPx(im, x, y, 0.25);
    ellipse(im, 7.5, 10, 3.8, 3, function (x, y, nx, ny) { var l = -nx * 0.5 - ny * 0.7; return l > 0.55 ? S[4] : l > 0.1 ? S[3] : l > -0.4 ? S[2] : S[1]; });
    hline(im, 4, 11, 13, S[2]);
    px(im, 6, 10, OUT); px(im, 9, 10, OUT); px(im, 6, 9, WHITE); px(im, 9, 9, WHITE);
    vline(im, 3, 3, 13, alpha('#dfe8ff', 0.8)); vline(im, 12, 3, 13, alpha('#6a7aa8', 0.85)); vline(im, 4, 4, 7, alpha(WHITE, 0.6));
    hline(im, 3, 12, 2, BRS[3]); hline(im, 3, 12, 1, BRS[4]); px(im, 7, 0, BRS[4]); px(im, 8, 0, BRS[2]);
    outline(im, 'sel');
    return im;
  });
  setIcon('furn_trophy_spider', function () {
    var src = rawSprite('furn_trophy_spider'), im = I16();
    // the skull from the sprite (rows 0..12, above its plinth), on a slim base
    for (var y = 0; y <= 12; y++) for (var x = 0; x < 16; x++) {
      var c = get(src, x, y);
      if (c && A(src, x, y) >= 128) px(im, x, y + 1, c);
    }
    slimBase(im);
    outline(im, 'sel');
    return im;
  });
  setIcon('furn_trophy_crown', function () {
    var im = I16();
    rrect(im, 2, 10, 12, 4, 1, function (x, y, i, j) { return j === 0 ? PLV[5] : j === 1 ? PLV[4] : j === 2 ? PLV[3] : PLV[2]; });
    px(im, 2, 14, GLD[3]); px(im, 13, 14, GLD[2]);
    stamp(im, 1, 1, CROWN, { k: '#2a2142', m: '#43365f', h: '#6b5a92', G: '#b99aee', W: '#e4d2ff', C: '#e8eeff' });
    [[6, 4], [6, 5], [6, 6], [2, 6], [2, 7]].forEach(function (p) { px(im, p[0], p[1], '#6b5a92'); });
    outline(im, 'sel');
    return im;
  });
  // ===========================================================================
  // Placeholder crate (unknown ids)
  // ===========================================================================
  function crateRaw(small) {
    var im = img(16, 16), R = WD;
    var y0 = small ? 4 : 2;
    rect(im, 2, y0, 12, 3, R[4]); hline(im, 2, 13, y0, R[5]);
    woodH(im, 2, y0 + 3, 12, 15 - y0 - 4, R, 5);
    hline(im, 2, 13, y0 + 3, R[2]);
    vline(im, 2, y0 + 3, 13, R[4]); vline(im, 13, y0 + 3, 13, R[2]);
    line(im, 3, y0 + 4, 12, 12, R[2]); line(im, 3, 12, 12, y0 + 4, R[2]);
    hline(im, 2, 13, 13, R[1]);
    px(im, 3, y0 + 4, GLD[3]); px(im, 12, y0 + 4, GLD[3]);
    outline(im, 'sel');
    return im;
  }

  // ===========================================================================
  // Public API (+ caches). Browser -> canvas; node -> raw {w, h, data}
  // ===========================================================================
  var rawCache = Object.create(null), cvCache = Object.create(null);
  function cached(key, fn) {
    var r = rawCache[key];
    if (r === undefined) {
      try { r = fn(); } catch (e) { r = null; if (typeof console !== 'undefined' && console.warn) console.warn('FurnitureArt: failed to draw ' + key, e); }
      rawCache[key] = r;
    }
    return r;
  }
  function crateSprite() { return cached('s:?', function () { return crateRaw(false); }); }
  function crateIcon() { return cached('i:?', function () { return crateRaw(true); }); }
  function rawSprite(id) {
    var d = typeof id === 'string' ? BY[id] : null;
    if (!d) return crateSprite();
    return cached('s:' + id, function () { return d.sprite(canvasFor(d.m)); }) || crateSprite();
  }
  function rawIcon(id) {
    var d = typeof id === 'string' ? BY[id] : null;
    if (!d) return crateIcon();
    return cached('i:' + id, function () { return d.icon ? d.icon() : autoIcon(rawSprite(id)); }) || crateIcon();
  }

  var HAS_DOM = typeof document !== 'undefined' && !!document && typeof document.createElement === 'function';
  function toCanvas(r) {
    var cv = document.createElement('canvas');
    cv.width = r.w; cv.height = r.h;
    var ctx = cv.getContext('2d');
    var id = ctx.createImageData(r.w, r.h);
    id.data.set(r.data);
    ctx.putImageData(id, 0, 0);
    return cv;
  }
  function canvasOf(key, r) {
    if (!HAS_DOM) return r;
    var c = cvCache[key];
    if (!c) { c = toCanvas(r); cvCache[key] = c; }
    return c;
  }

  // catalogue order
  var ORDER = ('furn_bed_canopy furn_cot furn_rug_moon furn_rug_star furn_rug_round furn_table_oak furn_table_round furn_desk ' +
    'furn_chair_oak furn_armchair furn_bookshelf furn_potion_shelf furn_candelabra furn_crystal_lamp furn_lantern_stand furn_fern ' +
    'furn_moonflower_pot furn_potted_tree furn_painting_moon furn_portrait_morwenna furn_star_map furn_tapestry furn_wall_clock ' +
    'furn_crystal_ball furn_globe furn_telescope furn_cauldron_decor furn_music_box furn_harp furn_owl_perch furn_cat_bed ' +
    'furn_wardrobe furn_mirror furn_trophy_slime furn_trophy_spider furn_trophy_crown furn_trophy_case furn_mineral_cabinet').split(' ');
  DEFS.sort(function (a, b) {
    var i = ORDER.indexOf(a.id), j = ORDER.indexOf(b.id);
    return (i < 0 ? 999 : i) - (j < 0 ? 999 : j);
  });
  var LIST = DEFS.map(function (m) {
    return {
      id: m.id, name: m.name, w: m.w, h: m.h, wall: !!m.wall, flat: !!m.flat,
      light: m.light ? { x: m.light.x, y: m.light.y, r: m.light.r, color: m.light.color.slice() } : null,
      price: m.price | 0, seller: m.seller
    };
  });
  var INFO = Object.create(null);
  LIST.forEach(function (e) { INFO[e.id] = e; });

  var FurnitureArt = {
    list: LIST,
    ids: LIST.map(function (e) { return e.id; }),
    sprite: function (id) {
      var ok = typeof id === 'string' && !!BY[id];
      return canvasOf(ok ? 's:' + id : 's:?', rawSprite(id));
    },
    icon: function (id) {
      var ok = typeof id === 'string' && !!BY[id];
      return canvasOf(ok ? 'i:' + id : 'i:?', rawIcon(id));
    },
    has: function (id) { return typeof id === 'string' && !!BY[id]; },
    info: function (id) { return (typeof id === 'string' && INFO[id]) || null; },
    _raw: { sprite: rawSprite, icon: rawIcon }
  };
  ROOT.FurnitureArt = FurnitureArt;
})();
