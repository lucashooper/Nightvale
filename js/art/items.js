/*
 * NIGHTVALE — ItemArt  (js/art/items.js)
 * ---------------------------------------------------------------------------
 * Procedural 1x pixel art for every item icon (16x16), crop growth stage (16x32),
 * placeable object (16x32) and world node (16x16). Everything is drawn pixel by
 * pixel into small RGBA buffers (no canvas paths, no anti-aliasing), deterministic
 * (seeded hash noise only) and cached.
 *
 * Classic script / IIFE — defines exactly one global: window.ItemArt.
 * In node (no `document`) use ItemArt._raw.* which returns {w, h, data}.
 *
 *   ItemArt.icon(id)                 -> 16x16 canvas (unknown id -> "?" rune)
 *   ItemArt.ids                      -> every id icon() knows
 *   ItemArt.toolIcon(kind, tier)     -> 16x16, kind hoe|can|pickaxe|axe, tier 0..3
 *   ItemArt.crop(cropId, stage)      -> 16x32, stage 0..4 (base at bottom-centre, y≈27)
 *   ItemArt.cropRegrow(cropId)       -> 16x32 harvested/regrowing look
 *   ItemArt.object(id, state, frame) -> 16x32 placeables (cauldron, dewcrystal, chest)
 *   ItemArt.node(kind, variant)      -> 16x16 world nodes (weeds, rocks, ores, gems...)
 *   ItemArt.cropIds, ItemArt.nodeKinds
 *
 * Light comes from the top-left. Tools / weapons / rod are drawn diagonally with
 * the grip at the bottom-left (~(3,13)) and the head / tip at the top-right.
 */
(function () {
  'use strict';

  var ROOT = (typeof window !== 'undefined') ? window
    : (typeof globalThis !== 'undefined') ? globalThis : {};

  // ===========================================================================
  // Palette — "Twilight Hollow" (DESIGN.md §2) + derived ramps (dark -> light)
  // ===========================================================================
  var OUT = '#120c1c';
  var SV = ['#1b1429', '#231b38', '#362a52', '#4a3b6d', '#604e88'];
  var MV = ['#4a2f7a', '#6a47a8', '#8f6cd1', '#b99aee', '#e4d2ff'];
  var FG = ['#10302a', '#1a4434', '#245a40', '#337450', '#4c9061', '#74b46e'];
  var GR = ['#163a30', '#1f4e3c', '#296246', '#377a53', '#589c64'];
  var EG = ['#2fbf7f', '#5dffb0', '#b4ffd9'];
  var MOON = ['#9fb0d8', '#c8d4f0', '#e8eeff', '#ffffff'];
  var AMBER = '#ffbc62', GOLDC = '#f2c45a', CANDLE = '#fff1c8', ORANGE = '#e8843c', EMBER = '#c44a3a';
  var ROSE = ['#8c3a62', '#c4648e', '#e89ab8'];
  var WATER = ['#17224c', '#213479', '#2e4f9f', '#69a1db', '#c4e6ff'];
  var STONE = ['#2d2c3e', '#45445a', '#605f78', '#7e7d97', '#a09fb6', '#c4c3d6'];
  var WOOD = ['#281d21', '#3e2d2b', '#574039', '#7a5a48', '#9c7a5e'];
  var COBBLE = ['#3a3450', '#534a6d', '#6e648f', '#8c81ac'];
  var SOIL = ['#22182c', '#31233d', '#43324d', '#56425f'];
  var WHITE = '#ffffff';

  // derived ramps (hue-shifted: violet in the shadows, warm in the lights)
  var GOLD = ['#4a2e2c', '#8a5a34', '#c88a3a', '#f2c45a', '#ffe08a', '#fff1c8'];
  var FIRE = ['#4a1626', '#8a2a32', '#c44a3a', '#e8843c', '#ffbc62', '#fff1c8'];
  var COPPER = ['#3a1e26', '#6e3a2e', '#a85a36', '#d6824a', '#f0aa70', '#fcd6a8'];
  var ICE = ['#1f3a6a', '#2f6a94', '#4aa6c4', '#86dce6', '#c8f6fa', '#ffffff'];
  var TEAL = ['#16383e', '#22625e', '#3c9688', '#6cc8b0', '#aeeedc', '#e6fff6'];
  var PLUM = ['#1e1030', '#3a1a52', '#5a2a7a', '#8446a8', '#b47ad6', '#e0c0f4'];
  var BLOOD = ['#3e0f22', '#7a1a30', '#b8303a', '#e0503e', '#ff8a6a', '#ffd0b8'];
  var LEAFRED = ['#24101e', '#4a1828', '#702430', '#963a3a', '#b85a48'];
  var BONE = ['#4a4458', '#7e7688', '#b0a8b0', '#d8d0cc', '#f2ece6'];
  var TAN = ['#3e2a2a', '#6e4636', '#9e6a4a', '#c8946a', '#e8c098'];
  var PAPER = ['#6e5e6e', '#a8949a', '#d8c6b4', '#f2e6d0', '#fffaf0'];
  var SLIME = ['#123a3a', '#1e6a56', '#2fbf7f', '#5dffb0', '#b4ffd9'];
  var VOID = ['#0c0814', '#1c1030', '#34185a', '#5e2a8a', '#9a4ac8', '#e0a8ff'];
  var LIME = ['#2a3a1e', '#4e6a26', '#86a83a', '#bede5a', '#eaffa0'];
  var BROWNL = ['#3a1e1a', '#6e3a1e', '#a8642e', '#d89a4a', '#f6c87a'];
  var CORK = ['#3e2d2b', '#574039', '#7a5a48', '#9c7a5e', '#c09a74'];
  var ROSEX = ['#4a1a3a', '#8c3a62', '#c4648e', '#e89ab8', '#fbd6e6'];
  var MOONX = ['#4a5280', '#6e7cb0', '#9fb0d8', '#c8d4f0', '#e8eeff', '#ffffff'];
  var SILVER = ['#2a3a6a', '#4a64a0', '#7d9ad0', '#b4c8ee', '#e2ecff', '#ffffff'];
  var SHADOWI = ['#1b1429', '#2a2040', '#3e2f5e', '#5a4886', '#8670b8', '#b99aee'];

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
    var A = rgba(a), B = rgba(b);
    return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function alpha(c, a) { var A = rgba(c); return hex(A[0], A[1], A[2], Math.round(a * 255)); }
  function dk(c, t) { return mix(c, SV[0], t); }      // darken, hue-shifted toward violet
  function lt(c, t) { return mix(c, CANDLE, t); }     // lighten, warm
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // deterministic hash noise in [0,1)
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ===========================================================================
  // Raster toolkit (all coordinates are integer pixel indices)
  // ===========================================================================
  function img(w, h) { return { w: w, h: h, data: new Uint8ClampedArray(w * h * 4) }; }
  function inb(im, x, y) { return x >= 0 && y >= 0 && x < im.w && y < im.h; }
  function A(im, x, y) { return (x >= 0 && y >= 0 && x < im.w && y < im.h) ? im.data[(y * im.w + x) * 4 + 3] : 0; }
  function solid(im, x, y) { return A(im, x, y) >= 160; }
  function get(im, x, y) {
    if (!inb(im, x, y)) return null;
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
  // only paint where something is already drawn (keeps silhouettes)
  function pxOn(im, x, y, c) { if (A(im, x, y)) px(im, x, y, c); }
  function rect(im, x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) px(im, x + i, y + j, c); }
  function hline(im, x0, x1, y, c) { for (var x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) px(im, x, y, c); }
  function vline(im, x, y0, y1, c) { for (var y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) px(im, x, y, c); }
  function line(im, x0, y0, x1, y1, c) {
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (;;) {
      px(im, x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // filled ellipse; centre may be fractional (x.5 = between pixels)
  function ellipse(im, cx, cy, rx, ry, c) {
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        var dx = (x - cx) / (rx + 0.4), dy = (y - cy) / (ry + 0.4);
        if (dx * dx + dy * dy <= 1) px(im, x, y, typeof c === 'function' ? c(x, y, dx, dy) : c);
      }
  }
  function disc(im, cx, cy, r, c) { ellipse(im, cx, cy, r, r, c); }
  function blit(dst, src, dx, dy, flip) {
    for (var y = 0; y < src.h; y++) for (var x = 0; x < src.w; x++) {
      var i = (y * src.w + x) * 4;
      if (!src.data[i + 3]) continue;
      var sx = flip ? src.w - 1 - x : x;
      px(dst, dx + sx, dy + y, hex(src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]));
    }
  }
  function shift(im, dx, dy) { var o = img(im.w, im.h); blit(o, im, dx, dy); return o; }
  function eachPx(im, fn) {
    for (var y = 0; y < im.h; y++) for (var x = 0; x < im.w; x++) {
      var c = get(im, x, y);
      if (c) fn(x, y, c);
    }
  }

  // ---- string-grid sprites ------------------------------------------------
  // rows: array of strings; legend: char -> colour ('.' and ' ' are transparent)
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
  function sprite(rows, leg, w, h) {
    var im = img(w || 16, h || 16);
    stamp(im, 0, 0, rows, leg);
    return im;
  }
  // legend helpers: map consecutive chars to a ramp
  function L(chars, ramp, base) {
    var o = base || {};
    for (var i = 0; i < chars.length && i < ramp.length; i++) o[chars.charAt(i)] = ramp[i];
    return o;
  }
  function legend() { // legend(['0123', RAMP], ['abc', RAMP2], {x:'#..'} ...)
    var o = {};
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      if (Array.isArray(a)) L(a[0], a[1], o);
      else for (var k in a) o[k] = a[k];
    }
    return o;
  }

  // ---- outline ---------------------------------------------------------------
  // Draws a 1px outline OUTSIDE the silhouette (4-neighbourhood).
  // mode 'sel' (default): pixels on the lit (top/left) side get a dark tint of the
  // material they touch; the shadow (bottom/right) side gets the global outline colour.
  // mode 'solid': global outline everywhere. mode 'tint': tinted everywhere.
  function outline(im, mode, col) {
    var w = im.w, h = im.h, marks = [];
    col = col || OUT;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (A(im, x, y) >= 160) continue;
      var l = solid(im, x - 1, y), r = solid(im, x + 1, y), u = solid(im, x, y - 1), d = solid(im, x, y + 1);
      if (!(l || r || u || d)) continue;
      var c;
      if (mode === 'solid') c = col;
      else if (mode !== 'tint' && (l || u)) c = col;
      else {
        var n = r ? get(im, x + 1, y) : d ? get(im, x, y + 1) : l ? get(im, x - 1, y) : get(im, x, y - 1);
        c = mix(n, col, 0.74);
      }
      marks.push(x, y, c);
    }
    for (var i = 0; i < marks.length; i += 3) px(im, marks[i], marks[i + 1], null), px(im, marks[i], marks[i + 1], marks[i + 2]);
    return im;
  }
  // ---- shading primitives ---------------------------------------------------
  // light vector (top-left, toward the viewer)
  var LX = -0.52, LY = -0.62, LZ = 0.59;
  // shaded ellipsoid blob; ramp dark->light; o: {spec: colour, bias: number}
  function blob(im, cx, cy, rx, ry, ramp, o) {
    o = o || {};
    var n = ramp.length, bias = o.bias || 0;
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        var nx = (x - cx) / (rx + 0.4), ny = (y - cy) / (ry + 0.4), d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        var nz = Math.sqrt(1 - d2);
        var l = nx * LX + ny * LY + nz * LZ;            // -1..1
        var v = clamp((l + 0.25 + bias) / 1.2, 0, 0.999);
        px(im, x, y, ramp[Math.floor(v * n)]);
      }
    if (o.spec) px(im, Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.5), o.spec);
  }
  // 4-point sparkle (centre + arms); arms are semi-transparent
  function sparkle(im, x, y, c, big) {
    px(im, x, y, c || WHITE);
    var a = alpha(c || WHITE, big ? 0.85 : 0.55);
    px(im, x - 1, y, a); px(im, x + 1, y, a); px(im, x, y - 1, a); px(im, x, y + 1, a);
    if (big) { var b = alpha(c || WHITE, 0.35); px(im, x - 2, y, b); px(im, x + 2, y, b); px(im, x, y - 2, b); px(im, x, y + 2, b); }
  }
  // plain + sparkle (opaque)
  function cross(im, x, y, c, arm) {
    px(im, x, y, c); px(im, x - 1, y, arm); px(im, x + 1, y, arm); px(im, x, y - 1, arm); px(im, x, y + 1, arm);
  }
  // point-in-polygon fill (pixel centres at integer coords); c may be fn(x,y)
  function inPoly(pts, x, y) {
    var ins = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) ins = !ins;
    }
    return ins;
  }
  function poly(im, pts, c) {
    var x0 = 99, y0 = 99, x1 = -99, y1 = -99;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    for (var y = Math.floor(y0); y <= Math.ceil(y1); y++)
      for (var x = Math.floor(x0); x <= Math.ceil(x1); x++)
        if (inPoly(pts, x, y)) px(im, x, y, typeof c === 'function' ? c(x, y) : c);
  }
  // shaded thick stroke through [x, y, radius] control points (organic shapes: roots, peppers, eels)
  function tube(im, pts, ramp, o) {
    o = o || {};
    var S = [], i, k;
    for (i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], dd = Math.sqrt((b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]));
      var n = Math.max(1, Math.ceil(dd * 4));
      for (k = 0; k < n; k++) { var t = k / n; S.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
    }
    S.push(pts[pts.length - 1]);
    var x0 = 99, y0 = 99, x1 = -99, y1 = -99;
    S.forEach(function (s) { x0 = Math.min(x0, s[0] - s[2]); y0 = Math.min(y0, s[1] - s[2]); x1 = Math.max(x1, s[0] + s[2]); y1 = Math.max(y1, s[1] + s[2]); });
    var nr = ramp.length, bias = o.bias || 0;
    for (var y = Math.floor(y0) - 1; y <= Math.ceil(y1) + 1; y++)
      for (var x = Math.floor(x0) - 1; x <= Math.ceil(x1) + 1; x++) {
        var best = 9, bx = 0, by = 0;
        for (i = 0; i < S.length; i++) {
          var rr = S[i][2] + 0.4, dx = (x - S[i][0]) / rr, dy = (y - S[i][1]) / rr, d = dx * dx + dy * dy;
          if (d < best) { best = d; bx = dx; by = dy; }
        }
        if (best > 1) continue;
        var nz = Math.sqrt(Math.max(0, 1 - best));
        var l = bx * LX + by * LY + nz * LZ;
        var v = clamp((l + 0.25 + bias) / 1.2, 0, 0.999);
        px(im, x, y, o.flat ? ramp[o.flat] : ramp[Math.floor(v * nr)]);
      }
  }
  // chessboard distance of every opaque pixel to the silhouette edge (1 = edge)
  function edgeDist(im) {
    var w = im.w, h = im.h, D = new Int16Array(w * h), changed = true, x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) D[y * w + x] = A(im, x, y) ? 99 : 0;
    var lvl = 0;
    while (changed && lvl < 16) {
      changed = false; lvl++;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        if (D[y * w + x] !== 99) continue;
        var mn = 99;
        for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
          var X = x + i, Y = y + j, v = (X < 0 || Y < 0 || X >= w || Y >= h) ? 0 : D[Y * w + X];
          if (v < mn) mn = v;
        }
        if (mn === lvl - 1) { D[y * w + x] = lvl; changed = true; }
      }
    }
    return function (x, y) { return (x < 0 || y < 0 || x >= w || y >= h) ? 0 : D[y * w + x]; };
  }
  // broad leaf from base (bx,by) to tip (tx,ty), max half-width w; R = [edge, shadow, base, lit, vein]
  function broadLeaf(im, bx, by, tx, ty, w, R, o) {
    o = o || {};
    var vx = tx - bx, vy = ty - by, L2 = vx * vx + vy * vy, Ln = Math.sqrt(L2);
    var x0 = Math.floor(Math.min(bx, tx) - w - 1), x1 = Math.ceil(Math.max(bx, tx) + w + 1);
    var y0 = Math.floor(Math.min(by, ty) - w - 1), y1 = Math.ceil(Math.max(by, ty) + w + 1);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var t = ((x - bx) * vx + (y - by) * vy) / L2;
      if (t < 0 || t > 1.02) continue;
      var sd = ((x - bx) * vy - (y - by) * vx) / Ln;
      var hw = w * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t))), o.round || 0.62);
      if (t < 0.18) hw *= 0.45 + t * 3;
      if (Math.abs(sd) > hw + 0.3) continue;
      var nx = sd > 0 ? vy / Ln : -vy / Ln, ny = sd > 0 ? -vx / Ln : vx / Ln;
      var lit = nx * -0.6 + ny * -0.8 > -0.05;
      var c = lit ? R[3] : R[2];
      if (Math.abs(sd) > hw - 0.75) c = lit ? R[3] : R[1];
      if (o.vein !== false && Math.abs(sd) < 0.5 && t > 0.1 && t < 0.86) c = R[4];
      px(im, x, y, c);
    }
  }
  // star polygon points
  function starPts(cx, cy, R, r, n, rot) {
    var p = [], N = n || 5, a0 = rot == null ? -Math.PI / 2 : rot;
    for (var i = 0; i < N * 2; i++) {
      var a = a0 + i * Math.PI / N, rad = (i % 2) ? r : R;
      p.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    return p;
  }

  // ===========================================================================
  // Builder: potion bottle
  // ===========================================================================
  // mask chars: c cork · r glass rim · n neck glass · b body glass · w specular (glass/liquid)
  //             l light glint · v facet line · anything else -> o.leg[char]
  var GLASS = ['#2a2a4a', '#4c5480', '#7a88b8', '#b4c2e6', '#e8eeff'];
  var LIQ = {
    heal: ['#5a1428', '#962234', '#d03a3c', '#f2705a', '#ffc0a8'],
    vigor: ['#0f4a3a', '#1e8a5e', '#2fbf7f', '#5dffb0', '#d4ffe8'],
    swift: ['#3a5220', '#6a8e2a', '#a6c83e', '#d4ee6a', '#f6ffc8'],
    ember: ['#6a1e22', '#b03a2e', '#e8743c', '#ffb050', '#fff1c8'],
    mandrake: ['#4a2418', '#7e4222', '#b46a32', '#e0a050', '#fbd898'],
    frost: ['#24508a', '#3a86b8', '#6cc4e0', '#b0ecf6', '#ffffff'],
    star: ['#7a4a1c', '#c08a2a', '#f2c45a', '#ffe68a', '#fffbe0'],
    shadow: ['#140c22', '#2a1a48', '#46287a', '#7448b4', '#b48aee'],
    fairy: ['#6a2050', '#a83c78', '#d86aa0', '#f4a6cc', '#ffe0f0'],
    tide: ['#14205a', '#22398a', '#2e5cb8', '#5a9ae0', '#c4e6ff'],
    moon: ['#3e3a78', '#6a6aac', '#a4aee0', '#d8e0fa', '#ffffff'],
    mud: ['#1c1a16', '#36321e', '#524c28', '#706a34', '#8e8844']
  };
  function potion(rows, o) {
    var im = img(16, 16), Lq = o.liq, leg = o.leg || {};
    function ch(x, y) { return (y >= 0 && y < rows.length && x >= 0 && x < rows[y].length) ? rows[y].charAt(x) : '.'; }
    function glass(x, y) { var c = ch(x, y); return c === 'b' || c === 'n' || c === 'w' || c === 'l' || c === 'v'; }
    function liq(x, y) {
      var c = ch(x, y);
      if (!(c === 'b' || c === 'w' || c === 'l' || c === 'v' || (c === 'n' && o.neckLiquid))) return false;
      return y >= o.level;
    }
    // liquid centroid -> glow core
    var sx = 0, sy = 0, n = 0, x, y;
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) if (liq(x, y)) { sx += x; sy += y; n++; }
    var gx = n ? Math.round(sx / n - 0.7) : 0, gy = n ? Math.round(sy / n - 0.5) : 0;
    var gw = (o.glow || 1.6) >= 2 ? 1 : 0;   // big glow: 3x3-ish core, else 2x2
    for (y = 0; y < 16; y++) for (x = 0; x < 16; x++) {
      var c = ch(x, y);
      if (c === '.' || c === ' ') continue;
      if (glass(x, y)) {
        var col;
        if (liq(x, y)) {
          var eR = !glass(x + 1, y), eB = !glass(x, y + 1), eL = !glass(x - 1, y);
          var surf = !liq(x, y - 1);
          var deep = glass(x - 2, y) && glass(x + 2, y) && glass(x, y + 2) && liq(x, y - 1) && glass(x + 1, y + 1) && glass(x - 1, y + 1);
          var t = 2;
          if (deep) t = 3;
          if (eR || eB) t = 1;
          if (eR && eB) t = 0;
          if (eL && !eB) t = 2;
          if (surf) t = eR ? 2 : 3;
          var ddx = x - gx, ddy = y - gy;
          var core = ddx >= -1 - gw && ddx <= 0 + gw && ddy >= -1 && ddy <= 0 + gw && !(gw && Math.abs(ddx + 0.5) > 1.2 && Math.abs(ddy - 0) > 0.6);
          if (!eR && !eB && core) t = 4;
          col = Lq[t];
          if (o.murk && hash(x, y, 7) < o.murk && t > 0) col = Lq[t - 1];
        } else {
          var gt = 1;
          if (!glass(x - 1, y) || !glass(x, y - 1)) gt = 2;
          if (!glass(x + 1, y)) gt = 0;
          col = GLASS[gt];
        }
        if (c === 'w') col = liq(x, y) ? mix(Lq[4], WHITE, 0.6) : GLASS[4];
        if (c === 'l') col = liq(x, y) ? Lq[4] : GLASS[3];
        if (c === 'v') col = liq(x, y) ? Lq[3] : GLASS[3];
        px(im, x, y, col);
      } else if (c === 'c') {
        var k = 2;
        if (ch(x, y - 1) !== 'c' || ch(x - 1, y) !== 'c') k = 3;
        if (ch(x + 1, y) !== 'c') k = 1;
        if (ch(x, y + 1) !== 'c' && ch(x - 1, y) === 'c') k = Math.min(k, 1);
        if (ch(x, y - 1) !== 'c' && ch(x - 1, y) !== 'c') k = 4;
        px(im, x, y, CORK[k]);
      } else if (c === 'r') {
        var rk = 3;
        if (ch(x - 1, y) !== 'r') rk = 4;
        if (ch(x + 1, y) !== 'r') rk = 2;
        px(im, x, y, o.rim ? o.rim[rk - 2] : GLASS[rk]);
      } else if (leg[c] !== undefined) {
        px(im, x, y, leg[c]);
      }
    }
    outline(im, 'solid');
    if (o.post) o.post(im);
    return im;
  }

  // ===========================================================================
  // Builder: seed packet & seed pouch
  // ===========================================================================
  // packet colours: ramp of 4 (dark, mid, light, highlight); emblem: 6x6 rows + legend
  // packet: paper body x 2..13 / y 2..14 with a crimped, folded top flap and an 8x8 label window
  function seedPacket(o) {
    var im = img(16, 16), R = o.ramp, x, y, win = o.win || lt(R[3], 0.6);
    for (y = 4; y <= 14; y++) for (x = 2; x <= 13; x++) {
      var c = R[2];
      if (x === 2) c = R[3];
      if (x === 3) c = mix(R[2], R[3], 0.45);
      if (x >= 12) c = R[1];
      if (y === 14) c = R[1];
      if (x === 13 && y >= 5) c = R[0];
      px(im, x, y, c);
    }
    px(im, 2, 14, null); px(im, 13, 14, null);
    for (x = 2; x <= 13; x++) { px(im, x, 3, x >= 12 ? R[1] : R[3]); px(im, x, 4, x >= 12 ? R[0] : R[1]); }
    for (x = 2; x <= 13; x += 2) px(im, x, 2, x >= 12 ? R[1] : R[3]);
    for (y = 5; y <= 12; y++) for (x = 4; x <= 11; x++) {
      if ((x === 4 || x === 11) && (y === 5 || y === 12)) continue;
      px(im, x, y, (x === 11 || y === 12) ? mix(win, R[2], 0.22) : win);
    }
    if (o.emblem) stamp(im, 4, 5, o.emblem, o.leg);
    if (o.pre) o.pre(im);
    if (o.deco) o.deco(im);
    outline(im, 'sel');
    if (o.post) o.post(im);
    return im;
  }
  function seedPouch(o) {
    var im = img(16, 16), R = o.ramp, x, y;
    // sack body
    blob(im, 7.5, 10, 5.6, 4.6, [R[0], R[1], R[2], R[2], R[3]], { bias: 0.1 });
    // neck / cinch
    rect(im, 6, 4, 4, 2, R[1]);
    px(im, 6, 4, R[2]); px(im, 6, 5, R[2]);
    // ruffled top
    hline(im, 5, 10, 3, R[2]); px(im, 5, 2, R[3]); px(im, 7, 2, R[3]); px(im, 8, 2, R[2]); px(im, 10, 2, R[2]);
    px(im, 6, 3, R[3]); px(im, 9, 3, R[1]); px(im, 10, 3, R[1]);
    // string
    hline(im, 5, 10, 5, o.string || TAN[1]); px(im, 6, 5, o.string2 || TAN[3]);
    px(im, 11, 6, o.string || TAN[1]); px(im, 11, 7, o.string2 || TAN[3]);
    if (o.emblem) stamp(im, o.ex || 5, o.ey || 8, o.emblem, o.leg);
    if (o.pre) o.pre(im);
    outline(im, 'sel');
    if (o.post) o.post(im);
    return im;
  }

  // ===========================================================================
  // Icon registry
  // ===========================================================================
  var ICONS = Object.create(null), ICON_ORDER = [];
  function def(id, fn) { if (!ICONS[id]) ICON_ORDER.push(id); ICONS[id] = fn; }

  // ===========================================================================
  // Tools (diagonal: grip bottom-left, head top-right) — tier palette swaps
  // digits 0-5 = head metal ramp · a-e = handle ramp · g/G = tier accent
  // ===========================================================================
  var TIER_METAL = [STONE, GOLD, ['#231b38', '#3a2c58', '#54417e', '#7059a6', '#957ccc', '#c4a8f0'], SILVER];
  var TIER_HANDLE = [
    WOOD,
    ['#2a1a20', '#4a2a2a', '#6e3e34', '#925a44', '#b47a5a'],
    ['#1e1630', '#33264c', '#4a3a6a', '#62508a', '#7e6aa8'],
    ['#161634', '#24285a', '#34407e', '#4c5ea6', '#7488cc']
  ];
  var TIER_ACCENT = [null, [MV[1], MV[3]], ['#c86cff', '#f0c8ff'], ['#3ec8e8', '#c8f8ff']];
  var TOOL_GRIDS = {
    hoe: [
      '................',
      '................',
      '.....5555555554.',
      '.....43333333g21',
      '.....32.....cb..',
      '.....2.....cb...',
      '..........cb....',
      '.........cb.....',
      '........cb......',
      '.......cb.......',
      '......cb........',
      '.....cb.........',
      '....db..........',
      '...cb...........',
      '..ab............',
      '................'
    ],
    pickaxe: [
      '................',
      '................',
      '.....55555544...',
      '....3333333443..',
      '...32......g32..',
      '..........cb32..',
      '.........cb.32..',
      '........cb..32..',
      '.......cb...32..',
      '......cb....32..',
      '.....cb.....32..',
      '....cb.....22...',
      '...db......1....',
      '..cb............',
      '.ab.............',
      '................'
    ],
    axe: [
      '................',
      '.......54.......',
      '......5433......',
      '.....54332..dc..',
      '....54332g1cb...',
      '....543221cb....',
      '.....5321cb.....',
      '......42cb......',
      '.......cb.......',
      '......cb........',
      '.....cb.........',
      '....cb..........',
      '...db...........',
      '..cb............',
      '.ab.............',
      '................'
    ],
    can: [
      '................',
      '................',
      '.............43.',
      '............453.',
      '............342.',
      '.............3..',
      '.....4444....3..',
      '..3.455554...4..',
      '.3.34554443.3...',
      '.3.34544432.4...',
      '.2.345g44323....',
      '..2344443322....',
      '...23333321.....',
      '....111111......',
      '................',
      '................'
    ]
  };
  function toolRaw(kind, tier) {
    tier = clamp(tier | 0, 0, 3);
    var rows = TOOL_GRIDS[kind];
    if (!rows) return null;
    var M = TIER_METAL[tier], H = TIER_HANDLE[tier], ac = TIER_ACCENT[tier];
    var leg = legend(['012345', M], ['abcde', H]);
    leg.g = ac ? ac[0] : M[2];
    leg.G = ac ? ac[1] : M[3];
    var im = sprite(rows, leg);
    outline(im, 'sel');
    if (tier === 3) {
      var sp = { hoe: [7, 2], pickaxe: [7, 2], axe: [5, 3], can: [5, 7] }[kind];
      if (sp) sparkle(im, sp[0], sp[1], WHITE);
    }
    if (tier === 2) {
      var gl = { hoe: [9, 3], pickaxe: [12, 7], axe: [6, 4], can: [5, 9] }[kind];
      if (gl) px(im, gl[0], gl[1], MV[4]);
    }
    return im;
  }
  def('hoe', function () { return toolRaw('hoe', 0); });
  def('can', function () { return toolRaw('can', 0); });
  def('pickaxe', function () { return toolRaw('pickaxe', 0); });
  def('axe', function () { return toolRaw('axe', 0); });

  // ===========================================================================
  // Weapons (diagonal: grip bottom-left, tip top-right)
  // ===========================================================================
  // L/C/D = blade light/centre/dark edge · g/G/q = guard · h/H = grip · p/P = pommel
  var SWORD = [
    '................',
    '.............LC.',
    '............LCD.',
    '...........LCD..',
    '..........LCD...',
    '.........LCD....',
    '.....G..LCD.....',
    '.....qgLCD......',
    '......qgD.......',
    '......hqg.......',
    '.....hH.qg......',
    '....hh..........',
    '..PHh...........',
    '..pp............',
    '................',
    '................'
  ];
  def('sword_rusty', function () {
    var im = sprite([
      '................',
      '.............LC.',
      '............LrD.',
      '...........LCD..',
      '..........LCr...',
      '.........rCD....',
      '....G...LCD.....',
      '....Gq.LCD......',
      '.....qgrD.......',
      '......hqg.......',
      '.....hH.qg......',
      '....hh....q.....',
      '..PHh...........',
      '..pp............',
      '................',
      '................'
    ], {
      L: STONE[4], C: STONE[3], D: STONE[1], r: '#9a5a3a',
      G: GOLD[3], g: GOLD[2], q: GOLD[1],
      h: WOOD[2], H: WOOD[3], P: GOLD[2], p: GOLD[1]
    });
    outline(im, 'sel');
    px(im, 12, 4, '#7a4a3a'); px(im, 10, 6, '#c4703a');
    return im;
  });
  def('sword_silver', function () {
    var im = sprite([
      '................',
      '..............L.',
      '.............LC.',
      '............LCD.',
      '...........LCD..',
      '.........LLCD...',
      '....l..LLCD.....',
      '....lg.LCD......',
      '.....lgCD.......',
      '......hlg.l.....',
      '.....hH..gl.....',
      '....hh..........',
      '..PHh...........',
      '..pp............',
      '................',
      '................'
    ], {
      L: SILVER[5], C: SILVER[3], D: SILVER[1],
      g: FG[3], l: FG[5],
      h: '#3a2a44', H: '#5a4468', P: SILVER[4], p: SILVER[2]
    });
    outline(im, 'sel');
    return im;
  });
  def('sword_star', function () {
    var im = sprite(SWORD, {
      L: '#c8dcff', C: '#7d9ad0', D: '#3a4f8a',
      G: GOLD[4], g: GOLD[3], q: GOLD[1],
      h: '#2a2a5a', H: '#44478a', P: GOLD[3], p: GOLD[1]
    });
    px(im, 6, 8, '#69e0ff');
    outline(im, 'sel');
    sparkle(im, 11, 3, WHITE, false);
    px(im, 9, 6, WHITE);
    return im;
  });
  def('sword_umbral', function () {
    var im = sprite([
      '................',
      '.............eC.',
      '............eCD.',
      '...........eCDD.',
      '..........eCD...',
      '.........eCDD...',
      '.....G..eCD.....',
      '.....qgeCDD.....',
      '......qgD.......',
      '......hqg.......',
      '.....hH.qg......',
      '....hh..........',
      '..PHh...........',
      '..pp............',
      '................',
      '................'
    ], {
      e: '#e0b0ff', C: '#8a4ac0', D: '#4a2470',
      G: VOID[4], g: '#7a3aaa', q: VOID[2],
      h: SV[1], H: SV[3], P: VOID[4], p: VOID[2]
    });
    px(im, 6, 8, '#ff7ae0');
    outline(im, 'sel');
    px(im, 12, 2, WHITE);
    return im;
  });
  // wands & staff: thin shafts with a glowing tip
  def('wand_apprentice', function () {
    var im = sprite([
      '................',
      '................',
      '................',
      '...........vV...',
      '..........vWVu..',
      '..........uVu...',
      '.........cd.....',
      '........cb......',
      '.......cb.......',
      '......cb........',
      '.....cb.........',
      '....cb..........',
      '...Gb...........',
      '..gg............',
      '................',
      '................'
    ], { v: MV[3], V: MV[4], W: WHITE, u: MV[1], c: WOOD[4], d: WOOD[3], b: WOOD[2], g: GOLD[2], G: GOLD[3] });
    outline(im, 'sel');
    return im;
  });
  def('wand_ember', function () {
    var im = sprite([
      '................',
      '................',
      '...........y....',
      '..........yYo...',
      '.........oYWYo..',
      '..........oYr...',
      '.........gGr....',
      '........cb......',
      '.......cb.......',
      '......cb........',
      '.....cb.........',
      '....cb..........',
      '...Gb...........',
      '..gg............',
      '................',
      '................'
    ], { y: FIRE[4], Y: FIRE[5], W: WHITE, o: FIRE[3], r: FIRE[2], c: '#6a2a2a', b: '#3e1a22', g: GOLD[2], G: GOLD[3] });
    outline(im, 'sel');
    sparkle(im, 13, 2, FIRE[4]);
    return im;
  });
  def('wand_astral', function () {
    var im = img(16, 16);
    // staff
    stamp(im, 0, 5, [
      '.........G.',
      '........gG.',
      '.......cb..',
      '......cb...',
      '.....cb....',
      '....cb.....',
      '...cb......',
      '..cb.......',
      '.gb........',
      '.g.........'
    ], { c: '#5a6eb4', b: '#2c3270', g: GOLD[2], G: GOLD[4] });
    // crescent moon head (gold), opening to the top-right, cradling a star
    ellipse(im, 11, 4, 3.1, 3.1, function (x, y, dx, dy) { return (dx + dy) < -0.3 ? GOLD[4] : (dx + dy) < 0.5 ? GOLD[3] : GOLD[2]; });
    ellipse(im, 12.4, 2.7, 2.5, 2.5, null);
    px(im, 9, 6, GOLD[2]); px(im, 10, 7, GOLD[2]);
    outline(im, 'sel');
    cross(im, 13, 3, WHITE, '#c8f8ff');
    px(im, 13, 1, alpha('#c8f8ff', 0.7)); px(im, 14, 5, alpha('#c8f8ff', 0.6));
    return im;
  });
  def('rod', function () {
    var im = sprite([
      '................',
      '..............t.',
      '.............t..',
      '............T...',
      '...........t....',
      '..........T.....',
      '.........t......',
      '........T.......',
      '.......t........',
      '......T.........',
      '.....t.......rR.',
      '....cssS.....wW.',
      '...cCsS.........',
      '..cC............',
      '.ac.............',
      '................'
    ], { t: WOOD[4], T: '#c09a74', r: EMBER, R: '#ff7a6a', w: '#e8eeff', W: WHITE, s: STONE[3], S: STONE[5], c: TAN[3], C: TAN[2], a: TAN[1] });
    outline(im, 'sel');
    for (var y = 2; y <= 9; y++) px(im, 14, y, alpha('#e8eeff', 0.85));
    px(im, 14, 1, '#c8d4f0');
    return im;
  });

  // ===========================================================================
  // Seeds — packets (colour + emblem) and pouches
  // ===========================================================================
  var PK = {
    moonpetal: ['#283468', '#465aa0', '#7186c8', '#a3b8ec'],
    mandrake: ['#33221f', '#5e3c2e', '#8c5e42', '#b8885e'],
    frostmint: ['#173a62', '#246a8e', '#3c9cbc', '#78d2e2'],
    emberroot: ['#4a1626', '#8a2a32', '#c44a3a', '#e8843c'],
    duskberry: ['#1e1030', '#3a1a52', '#5a2a7a', '#8446a8'],
    starbloom: ['#4a2e2c', '#8a5a34', '#c88a3a', '#f2c45a'],
    wispvine: ['#123438', '#1e5a56', '#348a7e', '#62bca6'],
    phialvine: ['#3e0f22', '#6e1a30', '#a42c3a', '#d4504a']
  };
  function packetDef(id, ramp, win, emblem, leg, extra) {
    def(id, function () {
      var o = { ramp: ramp, win: win, emblem: emblem, leg: leg };
      if (extra) for (var k in extra) o[k] = extra[k];
      return seedPacket(o);
    });
  }
  packetDef('seed_moonpetal', PK.moonpetal, '#eef2ff', [
    '...kk...',
    '..kabk..',
    '.kkbbkk.',
    'kabyWbak',
    'kbbWybck',
    '.kkbbkk.',
    '..kbck..',
    '...kk...'
  ], { k: '#283468', a: '#ffffff', b: '#a3b8ec', c: '#7186c8', y: '#fff1c8', W: WHITE });
  packetDef('seed_mandrake', PK.mandrake, '#f8ecdc', [
    '.g.Gg.g.',
    '.gGggGg.',
    '..kggk..',
    '.kRrrrk.',
    '.Rkrrkr.',
    '.krkkrk.',
    '..krrk..',
    '..k..k..'
  ], { k: '#33221f', g: FG[3], G: FG[4], r: TAN[3], R: TAN[4] });
  packetDef('seed_frostmint', PK.frostmint, '#eafcff', [
    '....kkk.',
    '...kaabk',
    '..kaabbk',
    '.kabbbk.',
    '.kabbk..',
    'kbbkk...',
    'kkk.....',
    'k.......'
  ], { k: '#173a62', a: '#ffffff', b: '#86dce6' }, { post: function (im) { px(im, 5, 6, '#86dce6'); px(im, 4, 6, '#c8f6fa'); px(im, 5, 7, '#c8f6fa'); } });
  packetDef('seed_emberroot', PK.emberroot, '#fff2e2', [
    '.....gg.',
    '....gGk.',
    '...kook.',
    '..koyok.',
    '.koyook.',
    '.koook..',
    'kook....',
    'kk......'
  ], { k: '#4a1626', g: '#4e6a26', G: '#86a83a', o: ORANGE, y: AMBER });
  packetDef('seed_duskberry', PK.duskberry, '#f4ecff', [
    '....Gg..',
    '..kkgkk.',
    '.kaWkaWk',
    '.kbbkbbk',
    '..kkakk.',
    '...kaWk.',
    '...kbbk.',
    '....kk..'
  ], { k: '#1e1030', g: FG[3], G: FG[4], a: PLUM[3], W: PLUM[5], b: PLUM[2] });
  packetDef('seed_starbloom', PK.starbloom, '#fffae6', [
    '...kk...',
    '...kyk..',
    'kkkyykkk',
    'kyyWWyyk',
    '.kyWWyk.',
    '.kyykyk.',
    'kyyk.kyk',
    'kkk...kk'
  ], { k: '#6a3a1e', y: GOLDC, W: CANDLE });
  packetDef('seed_wispvine', PK.wispvine, '#e8fff6', [
    '...kk...',
    '...ks...',
    '..kaak..',
    '.kaWbak.',
    '.kabbak.',
    'kaabbbak',
    'kkykkykk',
    '..y..y..'
  ], { k: '#123438', s: TEAL[2], a: '#ffffff', W: WHITE, b: '#aeeedc', y: '#2fbf7f' }, {
    deco: function (im) { px(im, 10, 2, TEAL[3]); px(im, 11, 1, TEAL[3]); px(im, 12, 1, TEAL[4]); px(im, 11, 0, TEAL[4]); px(im, 9, 1, TEAL[4]); }
  });
  packetDef('seed_phialvine', PK.phialvine, '#ffefe8', [
    '...cc...',
    '...cc...',
    '..kggk..',
    '...kg...',
    '..krrk..',
    '.krWrrk.',
    '.krrrrk.',
    '..kkkk..'
  ], { k: '#3e0f22', c: CORK[3], g: '#b4c2e6', r: '#d03a3c', W: '#ffc0a8' });
  def('seed_glowcap', function () {
    return seedPouch({
      ramp: ['#2a1c4a', '#4a2f7a', '#6a47a8', '#8f6cd1'],
      emblem: [
        '.ccc.',
        'cWccc',
        'mmmmm',
        '..s..',
        '..s..'
      ], ex: 5, ey: 8, leg: { c: '#5ce0e6', W: WHITE, m: MV[0], s: '#e8eeff' },
      post: function (im) { px(im, 4, 1, '#7ef0ff'); px(im, 11, 2, '#b8faff'); px(im, 2, 4, '#5ce0e6'); px(im, 13, 5, '#7ef0ff'); }
    });
  });
  def('seed_starflask', function () {
    return seedPouch({
      ramp: TAN.slice(0, 4), string: GOLD[1], string2: GOLD[3],
      pre: function (im) {
        // a glass bulb (potion-vine bulb) peeking out of the burlap pouch
        blob(im, 7.5, 2.4, 2.4, 2.1, ['#1e8a5e', '#2fbf7f', '#5dffb0', '#b4ffd9']);
        px(im, 8, 0, FG[3]); px(im, 9, 0, FG[4]);
        poly(im, starPts(7.5, 10, 2.6, 1.1, 5), GOLD[3]);
        px(im, 7, 10, GOLD[5]);
      },
      post: function (im) { px(im, 6, 1, WHITE); }
    });
  });

  // ===========================================================================
  // Crops / ingredients
  // ===========================================================================
  def('moonpetal', function () {
    var im = sprite([
      '................',
      '........abb.....',
      '........abc.....',
      '.....aabbbcabb..',
      '.....abcwWwbbc..',
      '.....bccWWwbcc..',
      '........wwc.....',
      '......abb.abc...',
      '......bbc.bcc...',
      '......ccdgccd...',
      '........g.......',
      '....hhgg........',
      '....hgg.........',
      '.....g..........',
      '................',
      '................'
    ], { a: '#d4e4ff', b: '#a8c0ec', c: '#7c90cc', d: '#55609e', W: WHITE, w: '#eef4ff', g: FG[3], h: FG[4] });
    outline(im, 'sel');
    return im;
  });
  def('glowcap', function () {
    var im = sprite([
      '................',
      '................',
      '........5555....',
      '.......45w554...',
      '......45555w54..',
      '......34444443..',
      '......mMMmmmmm..',
      '..555...Sst.....',
      '.45554..Sst.....',
      '.mmmmm..Sst.55..',
      '..Ss....Sst4554.',
      '..Ss....Sstmmmm.',
      '..Ss...SSsstSs..',
      '.gGggggGgggGgg..',
      '................',
      '................'
    ], { 5: ICE[4], 4: ICE[3], 3: ICE[2], w: WHITE, m: MV[1], M: MV[2], S: '#e8eeff', s: '#c8d4f0', t: '#9fb0d8', g: FG[2], G: FG[3] });
    outline(im, 'sel');
    return im;
  });
  def('mandrake', function () {
    var im = sprite([
      '................',
      '....G..G...G....',
      '....gG.gG.Gg....',
      '.....gGggGg.....',
      '......gffg......',
      '.....344432.....',
      '....3k4443k1....',
      '....34k33k21....',
      '...334e33e211...',
      '..3.344kk321.1..',
      '.....3k33k1.....',
      '......3321......',
      '.....32..21.....',
      '....32....21....',
      '................',
      '................'
    ], legend(['01234', TAN], { k: '#2a1416', e: '#2a1416', g: FG[2], G: FG[3], f: FG[1] }));
    outline(im, 'sel');
    px(im, 6, 5, TAN[4]);
    return im;
  });
  def('frostmint', function () {
    var im = sprite([
      '................',
      '.......54.......',
      '.....5.43.4.....',
      '....443s443.....',
      '.......s........',
      '...554.s.454....',
      '..54433s34443...',
      '...332.s..32....',
      '.......s........',
      '..554..s..454...',
      '.544433s344443..',
      '..332..s...32...',
      '.......s........',
      '......ss........',
      '................',
      '................'
    ], { 5: ICE[4], 4: ICE[3], 3: ICE[2], 2: ICE[1], s: TEAL[2] });
    outline(im, 'sel');
    sparkle(im, 3, 3, WHITE); sparkle(im, 12, 8, WHITE); px(im, 10, 12, WHITE);
    return im;
  });
  def('emberroot', function () {
    var im = img(16, 16);
    tube(im, [[9.5, 4.5, 2.7], [9.6, 7.5, 2.4], [8.2, 10.5, 1.8], [5.8, 12.6, 1.1], [3.8, 12.6, 0.5]], FIRE.slice(1, 6), { bias: 0.08 });
    stamp(im, 7, 1, [
      '.gG.G',
      'gGgGg',
      '.kgk.'
    ], { g: LEAFRED[2], G: LEAFRED[4], k: LEAFRED[1] });
    outline(im, 'sel');
    px(im, 8, 6, CANDLE); px(im, 8, 7, '#ffe0a0'); px(im, 7, 9, '#ffd080');
    return im;
  });
  def('duskberry', function () {
    var im = img(16, 16);
    stamp(im, 6, 1, [
      '...gG..',
      '..gGGg.',
      '.gGg.s.',
      'gg..s..',
      '...s...'
    ], { g: FG[3], G: FG[4], s: WOOD[3] });
    var B = [[5.5, 7, 2.1], [10, 7.5, 2.1], [7.6, 10.5, 2.2], [3.8, 11.2, 1.9], [11.6, 11.6, 1.9], [8, 13.6, 1.4]];
    B.forEach(function (b) { blob(im, b[0], b[1], b[2], b[2], [PLUM[1], PLUM[2], PLUM[3], PLUM[4]]); });
    outline(im, 'sel');
    B.forEach(function (b) { px(im, Math.round(b[0] - b[2] * 0.5), Math.round(b[1] - b[2] * 0.55), PLUM[5]); });
    return im;
  });
  def('starbloom', function () {
    var im = img(16, 16);
    stamp(im, 5, 10, [
      '..s.',
      'lLs.',
      '.ls.',
      '..s.',
      '..s.'
    ], { s: FG[3], l: FG[4], L: FG[5] });
    var pts = starPts(7.5, 6.6, 6.4, 2.7, 5);
    poly(im, pts, function (x, y) {
      var dx = x - 7.5, dy = y - 6.6, a = Math.atan2(dy, dx), d = Math.sqrt(dx * dx + dy * dy);
      // nearest arm axis
      var k = Math.round((a + Math.PI / 2) / (2 * Math.PI / 5));
      var ax = -Math.PI / 2 + k * 2 * Math.PI / 5;
      var side = Math.sin(a - ax); // which side of the ridge
      var lit = (Math.cos(ax + Math.PI / 2) * -0.6 + Math.sin(ax + Math.PI / 2) * -0.8) * (side < 0 ? 1 : -1);
      if (d < 1.6) return CANDLE;
      if (d < 2.6) return '#ffe08a';
      return lit > 0 ? GOLD[4] : (Math.abs(side) < 0.12 ? GOLD[3] : GOLD[2]);
    });
    outline(im, 'sel');
    px(im, 7, 6, WHITE);
    sparkle(im, 12, 2, WHITE);
    return im;
  });
  def('wispbloom', function () {
    var im = sprite([
      '................',
      '......sss.......',
      '....ss.s.ss.....',
      '...s...s...s....',
      '..aab..s..aab...',
      '.abWbc.s.abWbc..',
      '.abbbc.s.abbbc..',
      '.abbbc.s.abbbc..',
      'dbbbbcds.bbbbcd.',
      'd.y.yd.s.dy.yd..',
      '.......s........',
      '......ls........',
      '.....lLs........',
      '.......s........',
      '................',
      '................'
    ], { s: TEAL[2], a: '#ffffff', W: WHITE, b: '#d4fff0', c: '#8ee6cc', d: TEAL[3], y: '#5dffb0', l: TEAL[3], L: TEAL[4] });
    outline(im, 'sel');
    return im;
  });

  // ===========================================================================
  // Forage
  // ===========================================================================
  def('fairycap', function () {
    var im = sprite([
      '................',
      '................',
      '......4433......',
      '....43vV3332....',
      '...43vvv33322...',
      '..433v333vV32...',
      '..3Vv33333vv21..',
      '..222222222211..',
      '...uuUUUUuuu....',
      '......PSSs......',
      '.....pPSSsr.....',
      '......PSSs......',
      '......PSSs......',
      '.....PPSSss.....',
      '................',
      '................'
    ], { 4: ROSEX[4], 3: ROSEX[3], 2: ROSEX[2], 1: ROSEX[1], v: MV[2], V: MV[4], u: '#7a5a6e', U: '#a8849a', P: PAPER[4], S: PAPER[3], s: PAPER[2], p: PAPER[3], r: PAPER[1] });
    outline(im, 'sel');
    return im;
  });
  def('wolfsbane', function () { // monkshood: a spike of hooded purple flowers over palmate leaves
    var im = img(16, 16);
    vline(im, 8, 2, 13, FG[3]);
    var HOOD = ['.ab', 'abb', 'bbc', '.dd'], L = { a: MV[4], b: MV[2], c: MV[1], d: PLUM[2] };
    stamp(im, 8, 0, ['.a.', 'abc', 'bc.'], L);                 // top bud
    stamp(im, 9, 3, HOOD, L);
    stamp(im, 4, 5, HOOD, L, true);
    stamp(im, 9, 7, HOOD, L);
    stamp(im, 4, 9, HOOD, L, true);
    stamp(im, 1, 10, [
      '..h.......h...',
      '.hlh.....hlh..',
      'hlmlm.g.mlmlh.',
      '.lmmmmgmmmml..',
      '..mm.mgm.mm...'
    ], { h: FG[5], l: FG[4], m: FG[3], g: FG[2] });
    outline(im, 'sel');
    px(im, 10, 4, WHITE);
    return im;
  });
  def('moonlily', function () {
    var im = sprite([
      '................',
      '................',
      '................',
      '.......a........',
      '....a..ab..a....',
      '....ab.ab.ab....',
      '.....abbbbb.....',
      '..a..bayYbb..b..',
      '..abbbbyybbbbc..',
      '...abbbbbbbbc...',
      '.gGGgccbbcccggg.',
      'gGGGggggggggGGgg',
      '.gggggg..ggggg..',
      '................',
      '................',
      '................'
    ], { a: WHITE, b: '#e8eeff', c: '#b4c2e6', y: GOLDC, Y: CANDLE, g: FG[3], G: FG[4] });
    outline(im, 'sel');
    return im;
  });
  def('feather', function () {
    var im = img(16, 16), K = Math.SQRT1_2;
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var X = x - 7.5, Y = y - 7.5, u = (X - Y) * K, v = (X + Y) * K; // u along quill (to top-right)
      var s = (u + 8.6) / 17; // 0 quill end .. 1 tip
      if (s < 0 || s > 1) continue;
      var w = s < 0.18 ? 0 : 3.0 * Math.pow(Math.sin(Math.PI * Math.min(1, (s - 0.12) / 0.92)), 0.65);
      if (v < 0) w *= 1.08;
      var c = null;
      if (Math.abs(v) <= 0.55 && s < 0.97) c = s < 0.2 ? '#d8d0cc' : '#f2ece6';
      else if (Math.abs(v) <= w) {
        var band = Math.floor((u + 20) / 1.75) % 2;
        if (v < 0) c = band ? '#c8946a' : '#8a5a3e';
        else c = band ? '#9e6a4a' : '#5e3a2e';
        if (Math.abs(v) > w - 0.9) c = v < 0 ? (band ? '#e8c098' : '#a8744e') : (band ? '#7a4e36' : '#3e2a2a');
        if (s > 0.86) c = v < 0 ? '#f2ece6' : '#d8d0cc';
      }
      if (c) px(im, x, y, c);
    }
    outline(im, 'sel');
    return im;
  });
  def('starshard', function () {
    var im = sprite([
      '................',
      '.........4......',
      '........453.....',
      '.......4532.....',
      '.......4532.....',
      '......4532......',
      '......4532......',
      '.....4532.......',
      '.....4532.......',
      '....4532..5.....',
      '....4532.453....',
      '...4532..453....',
      '...4532..432....',
      '...2332..222....',
      '................',
      '................'
    ], { 5: WHITE, 4: CANDLE, 3: '#f2d27a', 2: '#a88ad8' });
    outline(im, 'sel');
    sparkle(im, 12, 4, WHITE, true);
    px(im, 6, 7, WHITE); px(im, 3, 6, alpha(CANDLE, 0.8));
    return im;
  });
  def('bog_amber', function () {
    var im = img(16, 16), R = ['#4a1c14', '#8a3a18', '#c8681e', '#f09a32', '#ffcc62', '#fff1c8'];
    poly(im, [[5, 2.6], [8.5, 2], [11.5, 3.4], [13.4, 6.5], [13, 10.5], [10.6, 13.2], [6.5, 13.4], [3.2, 11.6], [2.2, 8], [3, 4.6]], R[2]);
    var D = edgeDist(im);
    eachPx(im, function (x, y) {
      var d = D(x, y), c;
      if (d <= 1) c = (x + y < 14) ? R[2] : R[1];
      else if (d === 2) c = (x + y < 13) ? R[3] : R[2];
      else c = (x + y > 16) ? R[5] : R[4];
      px(im, x, y, c);
    });
    // trapped beetle
    stamp(im, 6, 6, ['k.k', '.K.', 'kKk', '.k.'], { k: '#7a3414', K: '#4a1c10' });
    outline(im, 'sel');
    px(im, 4, 5, WHITE); px(im, 5, 4, WHITE); px(im, 4, 6, R[5]); px(im, 6, 3, R[4]);
    return im;
  });
  def('driftwood', function () {
    var im = sprite([
      '................',
      '................',
      '.............43.',
      '............432.',
      '...........4321.',
      '..........4322..',
      '.....3...43221..',
      '....43..4k221...',
      '....4334322.1...',
      '...44333221.....',
      '..443332k1......',
      '.4433221........',
      '.433221.........',
      '.4k21...........',
      '..21............',
      '................'
    ], { 4: '#d8d0c8', 3: '#b0a49c', 2: '#857876', 1: '#5e5258', k: '#4a3e48' });
    outline(im, 'sel');
    return im;
  });
  def('shell', function () { // mooncockle: ribbed fan shell, pearly pink-lavender
    var im = img(16, 16), C = ['#5e3e5a', '#9a6a8a', '#d4a6c0', '#f2d6e6', '#fff4fa'];
    var hx = 7.5, hy = 13;
    for (var y = 1; y < 15; y++) for (var x = 0; x < 16; x++) {
      var dx = x - hx, dy = y - hy, d = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dx, -dy);
      if (dy > 0.6 || Math.abs(a) > 1.2) continue;
      var rib = (a + 1.2) / 0.3, ri = Math.floor(rib), fr = rib - ri;
      var R = 10 - Math.abs(a) * 1.6 + Math.sin(fr * Math.PI) * 0.7;   // scalloped rim
      if (d > R) continue;
      var lit = a < 0.1;
      var c = (fr < 0.3 || fr > 0.85) ? (lit ? C[1] : '#7a4e6e') : (lit ? (a < -0.5 ? C[4] : C[3]) : C[2]);
      if (d < 2.6) c = C[2];
      px(im, x, y, c);
    }
    // hinge ears
    stamp(im, 4, 12, ['ab....ba', 'bbccccbb'], { a: C[3], b: C[2], c: C[1] });
    outline(im, 'sel');
    px(im, 5, 5, WHITE);
    return im;
  });
  def('pearl', function () {
    var im = img(16, 16);
    blob(im, 7.5, 7.5, 5, 5, ['#6a5a9a', '#9a8ac8', '#c8c4ec', '#e8eeff', '#f6f8ff']);
    outline(im, 'sel');
    px(im, 5, 5, WHITE); px(im, 6, 4, WHITE); px(im, 5, 6, '#ffffff');
    px(im, 10, 10, '#e89ab8'); px(im, 9, 11, '#f4c0d8'); px(im, 11, 9, '#f4c0d8');
    sparkle(im, 12, 3, WHITE);
    return im;
  });
  def('honey', function () {
    var im = img(16, 16), H = ['#7a3a12', '#b8661a', '#e8a030', '#ffcc58', '#fff1c8'];
    blob(im, 7.5, 7.5, 6, 5, H, { bias: 0.1 });
    // hex cells
    var cells = [[4, 5], [7, 4], [10, 5], [5, 8], [8, 7], [11, 8], [3, 10], [6, 10], [9, 10]];
    cells.forEach(function (c) {
      var x = c[0], y = c[1];
      if (!A(im, x, y)) return;
      pxOn(im, x, y, H[4]); pxOn(im, x + 1, y, H[3]); pxOn(im, x, y + 1, H[3]); pxOn(im, x + 1, y + 1, H[2]);
      pxOn(im, x - 1, y, H[1]); pxOn(im, x - 1, y + 1, H[1]); pxOn(im, x, y - 1, H[1]); pxOn(im, x + 2, y + 1, H[1]); pxOn(im, x + 1, y + 2, H[1]);
    });
    // drips
    rect(im, 5, 12, 1, 2, H[3]); px(im, 5, 14, H[2]); rect(im, 10, 12, 1, 1, H[3]); px(im, 10, 13, H[2]);
    outline(im, 'sel');
    px(im, 4, 4, WHITE);
    return im;
  });

  // ===========================================================================
  // Resources
  // ===========================================================================
  def('wood', function () {
    var im = sprite([
      '................',
      '................',
      '................',
      '....bbbbbbbbb...',
      '...rRrbccbcbcb..',
      '...RyYrbbbbbbcb.',
      '...rYyRcbcbbcbb.',
      '...rRRrbbbbbbb..',
      '.bbbbbbbbbbbb...',
      'rRrbccbcbcbcbb..',
      'RyYrbbbcbbbbbcb.',
      'rYyRcbbbbcbbbbb.',
      'rRRrbbbbbbbbbb..',
      '.rrbbbbbbbbbb...',
      '................',
      '................'
    ], { b: WOOD[2], c: WOOD[3], r: TAN[2], R: TAN[3], y: TAN[4], Y: TAN[3] });
    // shade log bottoms
    for (var x = 0; x < 16; x++) { pxOn(im, x, 7, WOOD[1]); pxOn(im, x, 12, WOOD[1]); pxOn(im, x, 13, WOOD[1]); }
    for (var x2 = 0; x2 < 16; x2++) { if (get(im, x2, 3)) px(im, x2, 3, WOOD[3]); if (get(im, x2, 8) && x2 > 3) px(im, x2, 8, WOOD[3]); }
    stamp(im, 0, 9, ['rRr', 'RyY', 'rYy', 'rRR'], { r: TAN[2], R: TAN[3], y: TAN[4], Y: TAN[3] });
    stamp(im, 3, 4, ['rRr', 'RyY', 'rYy', 'rRR'], { r: TAN[2], R: TAN[3], y: TAN[4], Y: TAN[3] });
    outline(im, 'sel');
    return im;
  });
  def('stone', function () {
    var im = sprite([
      '................',
      '................',
      '................',
      '................',
      '......3444......',
      '....34555543....',
      '...3455555443...',
      '..345555554432..',
      '..344444443332..',
      '..23333k333222..',
      '..2333k33332211.',
      '..22333332222 1.',
      '...112222211111.',
      '....11111111....',
      '................',
      '................'
    ].map(function (r) { return r.replace(/ /g, '1'); }), legend(['012345', STONE], { k: STONE[1] }));
    outline(im, 'sel');
    px(im, 6, 5, STONE[5]);
    return im;
  });
  def('fiber', function () {
    var im = sprite([
      '................',
      '..g...g..G...g..',
      '..Gg..Gg.g..gG..',
      '...gG..gGg.Gg...',
      '....gG.Gg.gG....',
      '.....gGgGgG.....',
      '......gGgG......',
      '.....tTttTt.....',
      '.....tttTtt.....',
      '......GgGg......',
      '.....gGg.gG.....',
      '....gG.gG.gG....',
      '...gG..Gg..Gg...',
      '..gG...g....gG..',
      '................',
      '................'
    ], { g: FG[3], G: FG[4], t: TAN[2], T: TAN[4] });
    outline(im, 'sel');
    return im;
  });
  // raw ore: a dark stone chunk studded with metallic nuggets
  var ORE_ROCK = [
    '................',
    '................',
    '................',
    '......34443.....',
    '....3445554432..',
    '...34555544432..',
    '..3455544433321.',
    '..3444443333221.',
    '.23443333322211.',
    '.2233333222211..',
    '..12222221111...',
    '...11111111.....',
    '................',
    '................',
    '................',
    '................'
  ];
  function oreItem(M, glint) {
    var im = sprite(ORE_ROCK, legend(['012345', ['#1e1d2c', '#34334a', '#4c4b62', '#66657e', '#84839c', '#a6a5bc']]));
    var N = [[4, 5, 1], [9, 5, 1], [6, 8, 1], [11, 8, 0], [3, 9, 0]];
    N.forEach(function (n) {
      var x = n[0], y = n[1];
      if (n[2]) stamp(im, x, y, ['.HL', 'HLM', 'LMD'], { H: M[4], L: M[3], M: M[2], D: M[1] });
      else stamp(im, x, y, ['HL', 'MD'], { H: M[4], L: M[3], M: M[2], D: M[1] });
    });
    outline(im, 'sel');
    if (glint) sparkle(im, 5, 5, glint);
    return im;
  }
  def('ore_glimmer', function () { var im = oreItem(['#3a1e26', '#7a3e3a', '#c06a4a', '#ec9a6a', '#ffd49a'], WHITE); px(im, 12, 9, MV[3]); return im; });
  def('ore_shadow', function () { var im = oreItem(['#1b1429', '#4a3a6e', '#7059a6', '#957ccc', '#c4a8f0'], null); px(im, 7, 9, MV[4]); px(im, 10, 6, '#e4d2ff'); return im; });
  def('ore_starsilver', function () { var im = oreItem(['#2a3a6a', '#7d9ad0', '#b4c8ee', '#e2ecff', '#ffffff'], WHITE); sparkle(im, 11, 7, '#c8f8ff'); return im; });

  // ---- gems -----------------------------------------------------------------
  def('amethyst', function () {
    var im = sprite([
      '................',
      '.......45.......',
      '......4552......',
      '......4552......',
      '..4...4552..3...',
      '.452..4552.432..',
      '.4552.4552.4421.',
      '.4552.4552.4421.',
      '.45524455244421.',
      '..4524455244321.',
      '..ssSSsssSSssss.',
      '..sSSSsssssssr..',
      '...rrrrrrrrrr...',
      '................',
      '................',
      '................'
    ], { 5: MV[4], 4: MV[3], 2: MV[1], 1: MV[0], 3: MV[2], s: STONE[3], S: STONE[4], r: STONE[1] });
    outline(im, 'sel');
    px(im, 7, 3, WHITE);
    return im;
  });
  def('emerald', function () {
    var im = img(16, 16), E = ['#0e2e22', '#1a5a3a', '#2a8a52', '#3cbf6e', '#7eeaa0', '#d4ffe4'];
    var oct = [[4, 2], [11, 2], [13, 4], [13, 11], [11, 13], [4, 13], [2, 11], [2, 4]];
    poly(im, oct, function (x, y) {
      if (x >= 5 && x <= 10 && y >= 5 && y <= 10) { // table
        var t = (x - 5) + (y - 5);
        return t < 3 ? E[4] : t < 7 ? E[3] : E[2];
      }
      var top = 5 - y, bot = y - 10, lft = 5 - x, rgt = x - 10;
      var m = Math.max(top, bot, lft, rgt);
      if (m === top) return lft > 0 ? E[4] : rgt > 0 ? E[3] : E[5];
      if (m === lft) return bot > 0 ? E[2] : E[4];
      if (m === rgt) return bot > 0 ? E[0] : E[2];
      return E[1];
    });
    outline(im, 'sel');
    px(im, 6, 6, WHITE); px(im, 7, 6, E[5]); px(im, 6, 7, E[5]);
    sparkle(im, 12, 3, WHITE);
    return im;
  });
  def('moonstone', function () {
    var im = img(16, 16);
    blob(im, 7.5, 7.5, 4.6, 5.6, ['#6e7cb0', '#9fb0d8', '#c8d4f0', '#e8eeff', '#f8faff']);
    // blue adularescent sheen
    [[6, 5], [7, 5], [5, 6], [6, 6], [5, 7], [8, 4], [9, 4]].forEach(function (p) { px(im, p[0], p[1], '#8ec8ff'); });
    px(im, 6, 4, '#c4e6ff'); px(im, 7, 4, '#c4e6ff');
    outline(im, 'sel');
    px(im, 5, 4, WHITE); px(im, 4, 5, WHITE);
    return im;
  });
  def('quartz', function () {
    var im = sprite([
      '................',
      '..........4.....',
      '.........452....',
      '........4552....',
      '........4552....',
      '.......45532....',
      '...4...45532....',
      '..452.455322....',
      '..4552455322....',
      '...45245532.....',
      '...4524553......',
      '....42453.......',
      '....rrrrr.......',
      '...rRrrrrr......',
      '................',
      '................'
    ], { 5: WHITE, 4: '#f4e8ff', 3: '#d8c4f0', 2: '#a88ad0', r: STONE[2], R: STONE[3] });
    outline(im, 'sel');
    px(im, 11, 6, '#f4c8e8'); px(im, 10, 9, '#f4c8e8');
    return im;
  });
  def('voidcrystal', function () {
    var im = sprite([
      '................',
      '...4............',
      '...43......4....',
      '...433....43....',
      '....432..432....',
      '....4332.4332...',
      '.....43324332...',
      '.....433243332..',
      '..4..43324333...',
      '..43.4332433....',
      '...43433243.....',
      '...4333333......',
      '....33332.......',
      '................',
      '................',
      '................'
    ], { 4: VOID[4], 3: VOID[2], 2: VOID[1], 5: VOID[5] });
    outline(im, 'sel');
    [[5, 8], [9, 7], [7, 10], [4, 3]].forEach(function (p) { px(im, p[0], p[1], '#ff7ae0'); });
    px(im, 6, 9, VOID[5]);
    return im;
  });

  // ===========================================================================
  // Monster loot
  // ===========================================================================
  def('slime_gel', function () { // wobbly gumdrop of green gel
    var im = img(16, 16), S = ['#123a3a', '#1e6a56', '#2fbf7f', '#5dffb0', '#b4ffd9'];
    blob(im, 7.5, 9.6, 6.1, 5.0, S, { bias: 0.05 });
    for (var x = 0; x < 16; x++) for (var y = 13; y < 16; y++) px(im, x, y, null);
    hline(im, 2, 13, 12, S[1]); hline(im, 3, 12, 13, S[1]);
    px(im, 4, 14, S[1]); px(im, 11, 14, S[2]);   // drips
    blob(im, 9.6, 9.6, 1.5, 1.5, [S[2], S[3], S[4]]);   // trapped bubble
    outline(im, 'sel');
    px(im, 4, 7, S[4]); px(im, 5, 6, WHITE); px(im, 6, 5, S[4]); px(im, 3, 9, S[3]);
    return im;
  });
  def('bat_wing', function () {
    var im = img(16, 16);
    var W = [5, 4];
    var mem = [[1, 6], [2, 4], [5, 3], [9, 2], [14, 3], [12.2, 6.2], [13, 9], [10.4, 9.8], [9, 13], [6.8, 11], [4, 13], [3.4, 9.6]];
    poly(im, mem, function (x, y) { return y < 6 ? SV[4] : y < 9 ? SV[3] : SV[2]; });
    [[14, 3], [13, 9], [9, 13], [4, 13]].forEach(function (t) { line(im, W[0], W[1], t[0], t[1], '#8a7aa8'); });
    line(im, 1, 6, W[0], W[1], '#a898c4');
    line(im, W[0], W[1], 9, 2, '#a898c4');
    px(im, W[0], W[1], '#d8c8ee'); px(im, W[0] - 1, W[1] - 1, '#a898c4'); px(im, 4, 3, '#c8b8e0');
    outline(im, 'sel');
    return im;
  });
  def('spider_silk', function () {
    var im = sprite([
      '................',
      '................',
      '...ddddddddd....',
      '...cWWWWWWWb....',
      '....aSSsSSa.....',
      '....aSsssSa.....',
      '....aSSsSSa.....',
      '....asSsSsa.....',
      '....aSSsSSa.....',
      '....aSsssSa.....',
      '....aSSsSSa.....',
      '...cWWWWWWWb....',
      '...ddddddddd....',
      '................',
      '................',
      '................'
    ], { d: WOOD[2], c: WOOD[4], W: WOOD[3], b: WOOD[2], a: '#c8d4f0', S: '#f2f4ff', s: '#c8d4f0' });
    outline(im, 'sel');
    // loose strand
    px(im, 11, 7, '#e8eeff'); px(im, 12, 8, '#e8eeff'); px(im, 12, 9, '#e8eeff'); px(im, 13, 10, '#e8eeff'); px(im, 13, 11, '#c8d4f0'); px(im, 12, 12, '#c8d4f0');
    px(im, 6, 5, WHITE);
    return im;
  });
  def('bone_dust', function () {
    var im = img(16, 16), B = BONE;
    // soft heap of pale dust
    ellipse(im, 7.5, 13.2, 6.4, 3.6, function (x, y, dx, dy) { return y > 13 ? null : (dx + dy < -0.5 ? B[3] : dx + dy < 0.4 ? B[2] : B[1]); });
    for (var i = 0; i < 16; i++) { var x = 2 + Math.floor(hash(i, 1, 5) * 12), y = 10 + Math.floor(hash(i, 2, 5) * 4); pxOn(im, x, y, hash(i, 3, 5) < 0.5 ? B[4] : B[0]); }
    outline(im, 'sel');
    // a knobbed bone resting on the heap (own outlined layer so it separates from the dust)
    var bone = img(16, 16);
    stamp(bone, 2, 5, [
      '.aa......aa.',
      'aaaccccccaab',
      'abbbbbbbbbbb',
      '.bb......bb.'
    ], { a: B[4], b: B[2], c: B[3] });
    outline(bone, 'sel');
    blit(im, bone, 0, 0);
    px(im, 3, 5, WHITE);
    return im;
  });
  def('ectoplasm', function () { // pale ghostly wisp with a curling tail
    var im = img(16, 16), E = ['#3c8a86', '#6cc0b4', '#aee8dc', '#e2fff6', '#ffffff'];
    blob(im, 7, 10.2, 4.6, 3.6, E, { bias: 0.2 });
    tube(im, [[7.6, 7, 2.6], [9, 4.6, 1.6], [10.8, 3, 1.0], [12.6, 2.6, 0.55], [13.4, 4, 0.35]], E, { bias: 0.25 });
    // trailing drips
    px(im, 4, 14, E[2]); px(im, 7, 14, E[2]); px(im, 10, 13, E[1]);
    outline(im, 'sel');
    px(im, 5, 9, WHITE); px(im, 4, 10, E[4]);
    px(im, 6, 11, alpha('#2a6a66', 0.8)); px(im, 9, 11, alpha('#2a6a66', 0.8));
    sparkle(im, 2, 4, '#b4ffd9');
    return im;
  });
  def('arcane_dust', function () {
    var im = img(16, 16), M = [MV[0], MV[1], MV[2], MV[3], MV[4]];
    ellipse(im, 7.5, 11.5, 6, 3.2, function (x, y) { return y < 10 ? M[3] : y < 12 ? M[2] : M[1]; });
    ellipse(im, 7.5, 9.5, 3.4, 2.2, function (x, y) { return y < 9 ? M[4] : M[3]; });
    for (var i = 0; i < 10; i++) { var x = 2 + Math.floor(hash(i, 7, 9) * 12), y = 9 + Math.floor(hash(i, 8, 9) * 5); pxOn(im, x, y, hash(i, 9, 9) < 0.5 ? WHITE : M[1]); }
    outline(im, 'sel');
    sparkle(im, 4, 4, '#ffd6ff', true); sparkle(im, 11, 3, WHITE); px(im, 8, 6, '#ffd6ff');
    return im;
  });
  def('golem_core', function () {
    var im = img(16, 16);
    blob(im, 7.5, 7.5, 5.6, 5.6, STONE);
    // glowing crystal heart + rune cracks
    stamp(im, 5, 4, [
      '..c...',
      '.cCc..',
      'cCWCc.',
      '.cCc..',
      '..c...'
    ], { c: '#3ec8e8', C: '#8ef4ff', W: WHITE }, false);
    [[3, 7], [4, 6], [11, 7], [12, 8], [7, 11], [7, 12], [10, 4]].forEach(function (p) { pxOn(im, p[0], p[1], '#3ec8e8'); });
    outline(im, 'sel');
    return im;
  });
  def('void_essence', function () {
    var im = img(16, 16), V = VOID;
    blob(im, 7.5, 7.5, 5.4, 5.4, [V[0], V[1], V[2], V[3]]);
    // swirl
    for (var t = 0; t < 26; t++) {
      var a = t * 0.42, r = 0.6 + t * 0.17;
      var x = Math.round(7.5 + Math.cos(a) * r), y = Math.round(7.5 + Math.sin(a) * r);
      pxOn(im, x, y, t < 8 ? V[5] : t < 17 ? V[4] : V[3]);
    }
    outline(im, 'sel');
    px(im, 7, 7, WHITE); px(im, 5, 4, V[5]);
    sparkle(im, 12, 3, '#ff9af0');
    return im;
  });
  def('spore_sac', function () {
    var im = img(16, 16), S = ['#2e3a1e', '#55682a', '#8aa03a', '#bcd060', '#e6f2a0'];
    blob(im, 7.5, 8.5, 5.2, 4.8, S, { bias: 0.05 });
    rect(im, 6, 13, 3, 2, '#6a5a3a'); px(im, 6, 13, '#8a7a4a');
    [[5, 7], [9, 6], [10, 10], [6, 11], [8, 9]].forEach(function (p) { pxOn(im, p[0], p[1], '#6a4a2a'); pxOn(im, p[0] - 1, p[1] - 1, S[4]); });
    outline(im, 'sel');
    [[4, 2], [7, 1], [11, 2], [9, 3]].forEach(function (p, i) { px(im, p[0], p[1], i % 2 ? '#e6f2a0' : '#bcd060'); });
    return im;
  });

  // ===========================================================================
  // Fish (diagonal: tail bottom-left, head top-right) — hand-painted grids
  // b lit back rim · B back · m flank · l belly · s belly shadow · g gill · e eye · w eye light
  // f/F fins · t/T tail · k marking
  // ===========================================================================
  function fishGrid(rows, leg, post) {
    var im = sprite(rows, leg);
    outline(im, 'sel');
    if (post) post(im);
    return im;
  }
  def('fish_glimmerfin', function () {
    return fishGrid([
      '................',
      '................',
      '........ffbBB...',
      '......fFbBBwem..',
      '.....ffbBBgmml..',
      '.......bBBmgls..',
      '......bBBmmlg...',
      '......bBmmllsf..',
      '.....bBmmllsf...',
      '.....bmmls......',
      '.tt.bmlsf.......',
      '..TtTs..........',
      '...tT...........',
      '....tt..........',
      '....t...........',
      '................'
    ], { b: '#69a1db', B: '#2e4f9f', m: '#c8d4f0', l: '#e8eeff', s: '#9fb0d8', g: '#7c90cc', e: OUT, w: WHITE, f: GOLD[3], F: GOLD[4], t: GOLD[3], T: GOLD[2] },
    function (im) { px(im, 9, 6, '#ffe08a'); px(im, 7, 8, MV[3]); sparkle(im, 3, 6, '#ffe08a'); });
  });
  def('fish_mooncarp', function () {
    return fishGrid([
      '................',
      '................',
      '.......FbBBB....',
      '.....fFbBBBmm...',
      '....ffbBBBmwel..',
      '.....fbBcmgmlsk.',
      '.....bBBcmlglsk.',
      '.....bBmmlllgs..',
      '.....bBmllllsf..',
      '.....bmmlllsfF..',
      '..tTtmmlls......',
      '..TtTmlsf.......',
      '...tTtT.........',
      '....tTt.........',
      '.....t..........',
      '................'
    ], { b: '#c8c8ee', B: '#8a88c0', m: '#c8d4f0', l: '#eef0ff', s: '#9fa4d0', g: '#7a78b0', e: OUT, w: WHITE, f: ROSEX[2], F: ROSEX[3], t: ROSEX[2], T: ROSEX[3], k: ROSEX[3], c: GOLD[4] });
  });
  def('fish_mistperch', function () {
    return fishGrid([
      '................',
      '.........F......',
      '.......FffbBB...',
      '.....FffkBBwem..',
      '....FffbBkgmml..',
      '.....ffkBBmgls..',
      '......bBkmmlg...',
      '......kBmkllsf..',
      '.....bBkmllsf...',
      '.....kmmks......',
      '.tt.bmksf.......',
      '..TtTs..........',
      '...tT...........',
      '....tt..........',
      '....t...........',
      '................'
    ], { b: '#86a084', B: '#5a7a64', m: '#b8c4b0', l: '#dce4d4', s: '#8a9a8a', k: '#2a4a3c', g: '#4a6a54', e: OUT, w: WHITE, f: FIRE[3], F: FIRE[4], t: FIRE[2], T: FIRE[3] });
  });
  def('fish_ghosteel', function () {
    var im = img(16, 16);
    tube(im, [[12.2, 2.8, 1.7], [10.2, 3.6, 1.35], [8.6, 5.2, 1.25], [8.4, 7.4, 1.15], [9, 9.4, 1.0], [7.6, 11.4, 0.85], [5.4, 12.4, 0.7], [3.2, 13.2, 0.45], [1.8, 13.8, 0.2]],
      ['#22625e', '#3c9688', '#6cc8b0', '#aeeedc', '#e6fff6']);
    // dorsal fin ridge (pale, translucent-looking)
    [[9, 2], [7, 4], [6, 6], [6, 7], [7, 9], [6, 10], [5, 11]].forEach(function (p) { if (!A(im, p[0], p[1])) px(im, p[0], p[1], '#8ee6cc'); });
    outline(im, 'sel');
    px(im, 13, 2, '#5dffb0'); px(im, 12, 2, '#eafff4'); px(im, 14, 3, '#22625e');
    return im;
  });
  def('fish_lanternpike', function () {
    return fishGrid([
      '................',
      '.......Yys......',
      '.......Y..sbB...',
      '..........bBwem.',
      '.........bBBgkl.',
      '........bBBmgl..',
      '.......bBBmlls..',
      '.......bBmllsf..',
      '......bBmlls....',
      '.....bBmlls.....',
      '...FfbmlsF......',
      '...fbmlsf.......',
      '.t.mms..........',
      '.tTt............',
      '...tt...........',
      '................'
    ], { b: '#4a6ab8', B: '#17224c', m: '#7a8ab8', l: '#c8d4f0', s: '#4a5a8a', g: '#2e3e7a', k: '#0e1638', e: OUT, w: '#e8eeff', f: '#348a7e', F: '#62bca6', t: '#1e5a56', T: '#348a7e', Y: AMBER, y: CANDLE },
    function (im) {
      px(im, 9, 1, '#62bca6'); px(im, 10, 2, '#62bca6');
      px(im, 8, 1, WHITE); px(im, 6, 1, alpha(AMBER, 0.6)); px(im, 8, 0, alpha(AMBER, 0.6)); px(im, 7, 3, alpha(AMBER, 0.5));
    });
  });
  def('fish_crownjaw', function () {
    return fishGrid([
      '........F.......',
      '......F.fF......',
      '....F.fffbBBB...',
      '....ffffbBBBBmk.',
      '.....fbBBBBmweW.',
      '.....bBBBBmmglk.',
      '....bBBBmmllgsl.',
      '....bBBmmllllgs.',
      '....bBmmlllllsf.',
      '....bBmlllllsfF.',
      '..tTtmmllls.....',
      '..TtTmlls.......',
      '...tTtTf........',
      '....tTt.........',
      '.....t..........',
      '................'
    ], { b: '#8446a8', B: '#5a2a7a', m: '#c88a3a', l: '#f2c45a', s: '#a86a2a', g: '#7a4a1e', k: '#2a1416', e: '#ff4a6a', w: '#ffd0d8', W: WHITE, f: GOLD[3], F: GOLD[4], t: GOLD[3], T: GOLD[2] },
    function (im) { sparkle(im, 2, 6, '#ffe08a'); px(im, 9, 6, '#b47ad6'); });
  });

  // ===========================================================================
  // Potions — every one a different bottle silhouette + liquid colour
  // ===========================================================================
  def('pot_healing', function () { // heart bottle, red
    return potion([
      '................',
      '......cccc......',
      '......cccc......',
      '.....rrrrrr.....',
      '......nnnn......',
      '..bbb.nnnn.bbb..',
      '.bbbbbnnnnbbbbb.',
      '.bwbbbbbbbbbbbb.',
      '.bwbbbbbbbbbbbb.',
      '.bbbbbbbbbbbbbb.',
      '..bbbbbbbbbbbb..',
      '...bbbbbbbbbb...',
      '....bbbbbbbb....',
      '.....bbbbbb.....',
      '......bbbb......',
      '................'
    ], { liq: LIQ.heal, level: 7 });
  });
  def('pot_vigor', function () { // round flask, long thin neck, green glow
    return potion([
      '................',
      '.......cc.......',
      '.......cc.......',
      '......rrrr......',
      '.......nn.......',
      '.......nn.......',
      '.....bbbbbb.....',
      '...bbbbbbbbbb...',
      '..bwbbbbbbbbbb..',
      '..wbbbbbbbbbbb..',
      '..bbbbbbbbbbbb..',
      '..bbbbbbbbbbbb..',
      '..bbbbbbbbbbbb..',
      '...bbbbbbbbbb...',
      '.....bbbbbb.....',
      '................'
    ], { liq: LIQ.vigor, level: 8, post: function (im) { px(im, 9, 10, WHITE); } });
  });
  def('pot_swift', function () { // tall vial with spread little wings, lime
    return potion([
      '................',
      '......cccc......',
      '......cccc......',
      '.....rrrrrr.....',
      '..eee.bbbb.eee..',
      '.eEeEebbbbeEeEe.',
      '.E.E.Ebbbbe.E.E.',
      '......bbbb......',
      '......bwbb......',
      '......bwbb......',
      '......bbbb......',
      '......bbbb......',
      '......bbbb......',
      '......bbbb......',
      '.......bb.......',
      '................'
    ], { liq: LIQ.swift, level: 6, leg: { e: '#ffffff', E: '#a8b6e0' } });
  });
  def('pot_ember', function () { // teardrop with a flame stopper, orange
    return potion([
      '................',
      '........y.......',
      '.......oYo......',
      '......roYor.....',
      '......rrrr......',
      '.......nn.......',
      '......bbbb......',
      '.....bbbbbb.....',
      '....bwbbbbbb....',
      '...bwbbbbbbbb...',
      '...bbbbbbbbbb...',
      '..bbbbbbbbbbbb..',
      '..bbbbbbbbbbbb..',
      '...bbbbbbbbbb...',
      '....bbbbbbbb....',
      '................'
    ], { liq: LIQ.ember, level: 8, glow: 2.2, leg: { y: CANDLE, Y: AMBER, o: ORANGE, r: EMBER } });
  });
  def('pot_mandrake', function () { // corked jug with a loop handle, amber-brown
    return potion([
      '................',
      '.....cccc.......',
      '.....cccc.......',
      '....rrrrrr......',
      '.....nnnn.hhh...',
      '....bbbbbb...h..',
      '...bbbbbbbb..h..',
      '..bbbbbbbbbb.h..',
      '..bwbbbbbbbbhh..',
      '..wbbbbbbbbb....',
      '..bbbbbbbbbb....',
      '..bbbbbbbbbb....',
      '..bbbbbbbbbb....',
      '...bbbbbbbb.....',
      '....bbbbbb......',
      '................'
    ], { liq: LIQ.mandrake, level: 7, leg: { h: GLASS[3] }, post: function (im) {
      // twine + tiny root tag
      px(im, 5, 4, TAN[3]); px(im, 6, 4, TAN[2]); px(im, 7, 4, TAN[3]); px(im, 8, 4, TAN[2]);
      px(im, 4, 5, TAN[3]); px(im, 3, 6, TAN[3]);
    } });
  });
  def('pot_frostward', function () { // faceted crystal bottle, ice blue
    return potion([
      '................',
      '.......ii.......',
      '......iIii......',
      '.....rrrrrr.....',
      '......nnnn......',
      '.....bbbbbb.....',
      '....bwbbbbbb....',
      '...bwbbbvbbbb...',
      '..bwbbbbvbbbbb..',
      '..bbbbbbvbbbbb..',
      '..bbbbbbvbbbbb..',
      '..bbbbbbvbbbbb..',
      '...bbbbbvbbbb...',
      '....bbbbvbbb....',
      '.....bbbbbb.....',
      '................'
    ], { liq: LIQ.frost, level: 8, leg: { i: '#86dce6', I: WHITE }, post: function (im) {
      px(im, 4, 6, WHITE); px(im, 11, 6, '#e6fbff'); px(im, 12, 7, '#c8f6fa');
    } });
  });
  def('pot_starlight', function () { // star-shaped flask, gold
    return potion([
      '................',
      '......gGgg......',
      '......gggj......',
      '.....rrrrrr.....',
      '......nnnn......',
      '......bbbb......',
      '.....bbbbbb.....',
      '.bbbbbbbbbbbbbb.',
      '..bwbbbbbbbbbb..',
      '...wbbbbbbbbb...',
      '....bbbbbbbb....',
      '....bbbbbbbb....',
      '...bbbbbbbbbb...',
      '...bbbb..bbbb...',
      '..bbb......bbb..',
      '................'
    ], { liq: LIQ.star, level: 9, glow: 2.0, leg: { g: GOLD[3], G: GOLD[5], j: GOLD[1] }, post: function (im) {
      px(im, 8, 11, WHITE); px(im, 5, 12, '#fffbe0'); sparkle(im, 13, 4, WHITE);
    } });
  });
  def('pot_shadow', function () { // slender long-necked bottle with wax seal, dark violet
    return potion([
      '................',
      '......ssss......',
      '.....sSsst......',
      '.....s.nn.......',
      '.......nn.......',
      '.......nn.......',
      '......nnnn......',
      '.....bbbbbb.....',
      '....bwbbbbbb....',
      '....wbbbbbbb....',
      '....bbbbbbbb....',
      '....bbbbbbbb....',
      '....bbbbbbbb....',
      '....bbbbbbbb....',
      '.....bbbbbb.....',
      '................'
    ], { liq: LIQ.shadow, level: 8, glow: 1.2, leg: { s: PLUM[2], S: PLUM[4], t: PLUM[1] }, post: function (im) {
      px(im, 8, 11, '#c8a0ff'); px(im, 6, 12, '#9a6ad8'); px(im, 9, 9, '#b48aee');
    } });
  });
  def('pot_fairy', function () { // bulb with a fairycap stopper, pink
    return potion([
      '................',
      '.....mMMmm......',
      '....mMvmmvm.....',
      '....uuuuuuuu....',
      '.......nn.......',
      '......bbbb......',
      '.....bbbbbb.....',
      '....bwbbbbbb....',
      '....wbbbbbbb....',
      '....bbbbbbbb....',
      '....bbbbbbbb....',
      '....bbbbbbbb....',
      '.....bbbbbb.....',
      '......bbbb......',
      '................',
      '................'
    ], { liq: LIQ.fairy, level: 7, leg: { m: ROSEX[2], M: ROSEX[3], v: MV[4], u: PAPER[2] }, post: function (im) {
      px(im, 6, 2, MV[3]); sparkle(im, 12, 6, '#ffe0f0'); px(im, 8, 10, '#ffe0f0');
    } });
  });
  def('pot_tide', function () { // conical flask, deep blue with a wave
    return potion([
      '................',
      '......cccc......',
      '......cccc......',
      '.....rrrrrr.....',
      '......nnnn......',
      '......nnnn......',
      '.....bbbbbb.....',
      '.....bbbbbb.....',
      '....bwbbbbbb....',
      '....wbbbbbbb....',
      '...bbbbbbbbbb...',
      '...bbbbbbbbbb...',
      '..bbbbbbbbbbbb..',
      '..bbbbbbbbbbbb..',
      '.bbbbbbbbbbbbbb.',
      '................'
    ], { liq: LIQ.tide, level: 9, post: function (im) {
      // foam crest wave on the surface
      [[5, 9], [6, 8], [7, 9], [8, 9], [9, 8], [10, 9]].forEach(function (p) { px(im, p[0], p[1], '#c4e6ff'); });
      px(im, 7, 12, '#5a9ae0'); px(im, 10, 11, '#c4e6ff');
    } });
  });
  def('pot_moon', function () { // ornate moon flask with gold handles, silver-lavender glow
    return potion([
      '................',
      '......GggG......',
      '......gggj......',
      '.....rrrrrr.....',
      '......nnnn......',
      '..g.bbbbbbbb.g..',
      '.g.bbbbbbbbbb.g.',
      '.g.bwbbxbbbbb.g.',
      '..gwbbxbbbbbbg..',
      '...bbbxbbbbbb...',
      '...bbbbxbbbbb...',
      '...bbbbbbbbbb...',
      '....bbbbbbbb....',
      '.....bbbbbb.....',
      '......gggg......',
      '................'
    ], { liq: LIQ.moon, level: 6, glow: 2.4, rim: [GOLD[2], GOLD[3], GOLD[4]], leg: { g: GOLD[3], G: GOLD[5], j: GOLD[1], x: GOLD[4] }, post: function (im) {
      sparkle(im, 12, 2, WHITE); px(im, 9, 9, WHITE);
    } });
  });
  def('sludge', function () { // lopsided bottle of murky sludge with a bubble
    return potion([
      '................',
      '..........oo....',
      '.........o..o...',
      '....rrrr.oO.o...',
      '.....nnn..oo....',
      '.....nnnn.......',
      '.....bbbbbb.....',
      '....bbbbbbbb....',
      '...bbbbbbbbbb...',
      '...bbbbbbbbbbb..',
      '..bbbbbbbbbbbbb.',
      '..bbbbbbbbbbbbb.',
      '..bbbbbbbbbbbbb.',
      '...bbbbbbbbbbb..',
      '.....bbbbbbbb...',
      '................'
    ], { liq: LIQ.mud, level: 9, murk: 0.3, glow: 0.5, leg: { o: '#8e8844', O: '#d4d088' }, post: function (im) {
      px(im, 8, 11, '#706a34'); px(im, 10, 10, '#a8a25a'); px(im, 6, 12, '#a8a25a');
      // sludge dribbling down the glass + a crack
      px(im, 6, 5, LIQ.mud[3]); px(im, 5, 6, LIQ.mud[2]); px(im, 4, 7, LIQ.mud[2]); px(im, 4, 8, LIQ.mud[3]);
      px(im, 10, 7, GLASS[0]); px(im, 11, 8, GLASS[0]);
    } });
  });

  // ===========================================================================
  // Food
  // ===========================================================================
  def('food_bread', function () {
    var im = img(16, 16), B = ['#5a2a1e', '#8a4a26', '#c07a3a', '#e8a85a', '#f6d08a'];
    blob(im, 7.5, 9.5, 6.6, 4.2, B, { bias: 0.1 });
    // scoring
    [[5, 7], [6, 8], [8, 6], [9, 7], [11, 7], [12, 8]].forEach(function (p) { pxOn(im, p[0], p[1], B[1]); });
    [[4, 7], [7, 6], [10, 6]].forEach(function (p) { pxOn(im, p[0], p[1], B[4]); });
    // lavender sprig on top
    stamp(im, 6, 2, [
      '.v.v.',
      'vVvV.',
      '.vgv.',
      '..g..',
      '..g..'
    ], { v: MV[2], V: MV[3], g: FG[4] });
    outline(im, 'sel');
    return im;
  });
  def('food_stew', function () {
    var im = sprite([
      '................',
      '................',
      '.....w...w......',
      '......w...w.....',
      '.....w...w......',
      '..yssYssssssy...',
      '.ysmsoSsmmSssy..',
      '.4ssssSsoSsss4..',
      '.344444444444 3.',
      '..3444444444 3..',
      '...33333333 3...',
      '....2222222.....',
      '.....11111......',
      '................',
      '................',
      '................'
    ], { s: '#8a4a26', S: '#b86a34', m: '#e8e0d4', o: '#e8843c', y: '#6a3a22', Y: '#c07a3a', 4: WOOD[4], 3: WOOD[3], 2: WOOD[2], 1: WOOD[1], w: alpha('#e8eeff', 0.7) });
    // fix spaces in rows (bowl right edge)
    [[13, 8], [12, 9], [11, 10]].forEach(function (p) { px(im, p[0], p[1], WOOD[2]); });
    outline(im, 'sel');
    return im;
  });
  def('food_pie', function () {
    var im = sprite([
      '................',
      '................',
      '................',
      '....33333333....',
      '..334p4p4p4433..',
      '.34pp4pp4pp4p43.',
      '.3p44p44p44p4p3.',
      '.34pp4pp4pp4pp3.',
      '.3p44p44p44p443.',
      '..33pp4pp4pp33..',
      '.1223333333322 1',
      '..112222222211..',
      '....11111111....',
      '................',
      '................',
      '................'
    ], { 4: '#f6d08a', 3: '#d89a4a', 2: '#a8642e', 1: '#6e3a1e', p: PLUM[3] });
    [[14, 10]].forEach(function (p) { px(im, p[0], p[1], '#a8642e'); });
    outline(im, 'sel');
    px(im, 6, 6, PLUM[5]); px(im, 9, 6, PLUM[4]);
    return im;
  });
  def('food_mead', function () {
    var im = sprite([
      '................',
      '................',
      '...fFFFFf.......',
      '..fFffFFff......',
      '..3wwwwww2......',
      '..34444432......',
      '..3cgg4432hh....',
      '..34g44432..h...',
      '..3444g432..h...',
      '..34444432..h...',
      '..3wwwwww2.h....',
      '..34444432hh....',
      '..33333322......',
      '...222222.......',
      '................',
      '................'
    ], { f: '#e8e0c8', F: WHITE, 4: WOOD[4], 3: WOOD[3], 2: WOOD[2], w: GOLD[3], c: GOLD[4], g: GOLD[4], h: WOOD[3] });
    outline(im, 'sel');
    px(im, 11, 3, '#f6d08a');
    return im;
  });
  def('food_tea', function () {
    var im = sprite([
      '................',
      '.....w..w.......',
      '......w..w......',
      '.....w..w.......',
      '................',
      '...4444444444...',
      '...4ttTtttt43hh.',
      '...4tttsttt3..h.',
      '....4ttttt43..h.',
      '....4444443.hh..',
      '.....33333......',
      '.ccccccccccccc..',
      '..bbbbbbbbbbb...',
      '................',
      '................',
      '................'
    ], { 4: '#e8eeff', 3: '#9fb0d8', t: '#9a8a3a', T: '#c8b45a', s: GOLDC, h: '#c8d4f0', c: '#c8d4f0', b: '#7c88b8', w: alpha('#e8eeff', 0.7) });
    outline(im, 'sel');
    return im;
  });
  def('food_coffee', function () {
    var im = sprite([
      '................',
      '......w..w......',
      '.....w..w.......',
      '......w..w......',
      '................',
      '...4444444444...',
      '...3kkKkkkkk2...',
      '...3433333332hh.',
      '...3433y33332..h',
      '...343yYy3332..h',
      '...3433y33332..h',
      '...3433333332hh.',
      '...3333333322...',
      '....22222222....',
      '................',
      '................'
    ], { 4: MV[2], 3: MV[1], 2: MV[0], k: '#1a0e14', K: '#3a2228', y: GOLD[3], Y: CANDLE, h: MV[1], w: alpha('#e8eeff', 0.7) });
    px(im, 15, 8, null); px(im, 15, 9, null); px(im, 15, 10, null);
    px(im, 14, 8, MV[1]); px(im, 14, 9, MV[1]); px(im, 14, 10, MV[1]);
    outline(im, 'sel');
    return im;
  });

  // ===========================================================================
  // Placeables (as items)
  // ===========================================================================
  def('cauldron', function () {
    var im = sprite([
      '................',
      '................',
      '................',
      '....g.g.........',
      '...ggGgGg..g....',
      '.4555555555554..',
      '.3444444444443..',
      '..43333333332...',
      '.3444333333321..',
      '.3443333333221..',
      '.3433333332221..',
      '..43333322221...',
      '...222222211....',
      '...1.......1....',
      '..11.......11...',
      '................'
    ], legend(['012345', COPPER], { g: '#5dffb0', G: '#b4ffd9' }));
    // brew surface
    hline(im, 2, 12, 6, '#2fbf7f'); px(im, 4, 6, '#5dffb0'); px(im, 9, 6, '#5dffb0'); px(im, 12, 6, '#1e8a5e');
    outline(im, 'sel');
    return im;
  });
  def('dewcrystal', function () {
    var im = sprite([
      '................',
      '.......4........',
      '......453.......',
      '......4532......',
      '.....45532......',
      '.....45532......',
      '.....4532.......',
      '......432.......',
      '.......2........',
      '....TTTTTT......',
      '...TtttttTs.....',
      '...sSSSSSsr.....',
      '...sSSSssrr.....',
      '..ssSSSSSssr....',
      '..rrrrrrrrrr....',
      '................'
    ], { 5: '#c4e6ff', 4: '#69a1db', 3: '#2e4f9f', 2: '#213479', T: STONE[5], t: STONE[4], S: STONE[3], s: STONE[2], r: STONE[1] });
    // centre it
    im = shift(im, 1, 0);
    outline(im, 'sel');
    px(im, 7, 3, WHITE); sparkle(im, 11, 2, '#c4e6ff'); px(im, 7, 12, '#69a1db');
    return im;
  });
  def('moonmulch', function () {
    var im = img(16, 16), T = ['#3e2a2a', '#6e4636', '#9e6a4a', '#c8946a', '#e8c098'];
    blob(im, 7.5, 10, 5.6, 4.5, T, { bias: 0.15 });
    // rolled-down rim
    hline(im, 3, 12, 5, T[3]); hline(im, 3, 12, 6, T[2]); px(im, 12, 6, T[1]); px(im, 3, 5, T[4]);
    // heaped dark violet soil
    ellipse(im, 7.5, 4, 4.3, 1.9, function (x, y) { return y <= 3 ? SOIL[3] : SOIL[2]; });
    [[6, 3], [9, 2], [8, 4], [5, 4]].forEach(function (q) { px(im, q[0], q[1], SOIL[1]); });
    // crescent moon print
    stamp(im, 6, 8, ['.mm.', 'm...', 'm...', '.mm.'], { m: '#e8eeff' });
    outline(im, 'sel');
    px(im, 7, 2, '#b4ffd9'); sparkle(im, 12, 2, '#e4d2ff');
    return im;
  });

  // ===========================================================================
  // Extras: glimmer coin, letter, chest
  // ===========================================================================
  def('glimmer', function () {
    var im = img(16, 16);
    disc(im, 8.5, 8.5, 5.2, GOLD[1]);
    disc(im, 8, 8, 5.2, function (x, y, dx, dy) {
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.74) return (dx + dy < -0.2) ? GOLD[4] : (dx + dy > 0.5 ? GOLD[2] : GOLD[3]);
      return (dx + dy < -0.3) ? GOLD[4] : GOLD[3];
    });
    stamp(im, 5, 5, [
      '...k...',
      '...a...',
      '..aVa..',
      'kaVWVak',
      '..aVa..',
      '...a...',
      '...k...'
    ], { a: MV[1], V: MV[2], W: MV[4], k: MV[0] });
    outline(im, 'sel');
    px(im, 5, 4, CANDLE); px(im, 4, 5, CANDLE);
    return im;
  });
  def('letter', function () {
    var im = img(16, 16), P = PAPER;
    rect(im, 1, 4, 14, 9, P[3]);
    hline(im, 1, 14, 4, P[4]); vline(im, 14, 4, 12, P[2]); hline(im, 1, 14, 12, P[2]);
    for (var i = 0; i < 6; i++) { px(im, 1 + i, 5 + i * 0.6 | 0, P[1]); px(im, 14 - i, 5 + i * 0.6 | 0, P[1]); }
    line(im, 2, 5, 6, 9, P[1]); line(im, 13, 5, 9, 9, P[1]);
    line(im, 2, 11, 5, 9, P[2]); line(im, 13, 11, 10, 9, P[2]);
    // wax seal with a crescent moon
    disc(im, 7.5, 9, 2.1, PLUM[2]);
    px(im, 6, 8, PLUM[3]); px(im, 7, 7, PLUM[3]);
    stamp(im, 6, 8, ['.m', 'm.', '.m'], { m: '#e4d2ff' });
    px(im, 9, 10, PLUM[1]); px(im, 8, 11, PLUM[1]);
    px(im, 10, 11, PLUM[2]);
    outline(im, 'sel');
    return im;
  });
  def('chest', function () { // storage chest as an inventory item (same art as the placed object)
    var o = OBJECTS.chest.draw('closed'), im = img(16, 16);
    blit(im, o, 0, -15);
    return im;
  });

  // ===========================================================================
  // EXPANSION (DESIGN2.md) — drinks, new potions, relics & curios, forest loot
  // ===========================================================================
  var GL2 = { r: '#e8eeff', q: '#b4c2e6', Q: '#7a88b8', k: '#5a6694' };   // glassware tones

  // ---- tavern drinks -------------------------------------------------------
  def('drink_fizz', function () { // Stardust Fizz: violet-gold fizzing coupe with a star on the rim
    var im = sprite([
      '................',
      '................',
      '................',
      '.rrrrrrrrrrrr...',
      '.qGGgGGGgGGGgQ..',
      '..qVgVbVVgVVvQ..',
      '...qvVvvbVvwQ...',
      '....qwvgvvwQ....',
      '......qwwQ......',
      '.......qQ.......',
      '.......qQ.......',
      '.......qQ.......',
      '......qqQQ......',
      '....rqqqqqQQ....',
      '................',
      '................'
    ], { r: GL2.r, q: GL2.q, Q: GL2.Q, G: '#ffe08a', g: '#fff1c8', V: MV[3], v: MV[2], w: MV[1], b: WHITE });
    // a little gold star perched on the rim
    stamp(im, 11, 1, ['.S.', 'SWS', '.S.'], { S: GOLD[3], W: GOLD[5] });
    px(im, 13, 3, GL2.Q); px(im, 14, 3, null);
    outline(im, 'sel');
    // fizz: bubbles streaming up, stardust glitter
    [[5, 2, WHITE], [6, 0, '#e4d2ff'], [8, 1, WHITE], [4, 0, '#ffe08a'], [9, 2, '#e4d2ff']].forEach(function (p) { px(im, p[0], p[1], p[2]); });
    sparkle(im, 2, 1, '#ffe08a', false); sparkle(im, 14, 6, WHITE, false);
    px(im, 3, 4, WHITE); px(im, 2, 5, alpha(WHITE, 0.7));
    return im;
  });
  def('drink_moonmilk', function () { // Moonmilk Nog: glass mug, cream and a crescent biscuit
    var im = sprite([
      '......m.........',
      '.....mM.........',
      '.....m..........',
      '....cCmcc.......',
      '..rcCCCCCCcQ....',
      '..rLLLLLLLLQhh..',
      '..rLlLLLLLlQ..h.',
      '..rLLLlLLLlQ..h.',
      '..rlLLLLlLlQ..h.',
      '..rLLLLLLLlQhh..',
      '..rlLLLLLLlQ....',
      '..rLLlLLLLlQ....',
      '..rrqqqqqqQQ....',
      '...qqqqqqQQ.....',
      '................',
      '................'
    ], { r: GL2.r, q: GL2.q, Q: GL2.Q, h: GL2.q, L: '#eef2ff', l: '#c8d4f0', C: WHITE, c: '#e8e0d4', m: GOLDC, M: '#ffe08a' });
    outline(im, 'sel');
    px(im, 6, 4, '#c88a3a'); px(im, 8, 3, '#c88a3a'); px(im, 9, 4, '#c88a3a');   // nutmeg dust
    px(im, 3, 6, WHITE); px(im, 3, 7, WHITE);
    sparkle(im, 12, 2, '#e8eeff');
    return im;
  });
  def('drink_dragon', function () { // Dragonbreath Cider: lidded stein, glowing cider, embers
    var im = sprite([
      '................',
      '..pP............',
      '.pPPp...........',
      '.pPPp...........',
      '..ppkmmmmmmmk...',
      '...koOOyOOook...',
      '...gGGGGGGGgghh.',
      '...cCCCCCCCchh.h',
      '...cCddCCCCc...h',
      '...cCdDdCCCc...h',
      '...cCCddCCCchh.h',
      '...cCCCCCCCchhh.',
      '...gGGGGGGGgg...',
      '...kkkkkkkkkk...',
      '................',
      '................'
    ], { p: STONE[3], P: STONE[5], k: STONE[1], m: STONE[2], o: ORANGE, O: AMBER, y: CANDLE,
      g: GOLD[2], G: GOLD[3], c: '#6a2030', C: '#8a2a3a', d: GOLD[2], D: GOLD[4], h: STONE[3] });
    // handle: keep it inside the canvas
    px(im, 15, 7, null); px(im, 15, 8, null); px(im, 15, 9, null); px(im, 15, 10, null);
    px(im, 14, 7, STONE[3]); px(im, 14, 8, STONE[3]); px(im, 14, 9, STONE[3]); px(im, 14, 10, STONE[3]);
    outline(im, 'sel');
    // dragon breath: little flames and embers
    stamp(im, 7, 1, ['..y..', '.yOy.', 'yOoOy'], { y: alpha(CANDLE, 0.9), O: AMBER, o: alpha(ORANGE, 0.95) });
    px(im, 11, 1, AMBER); px(im, 12, 3, alpha(ORANGE, 0.8)); px(im, 6, 2, alpha(AMBER, 0.8));
    px(im, 4, 7, '#c4485a');
    return im;
  });
  def('drink_frostberry', function () { // Frostberry Spritz: tall flute, pink-to-ice, berry garnish
    var im = sprite([
      '................',
      '.....wwwwQ.BB...',
      '.....rpPpQBbb...',
      '.....rpppQ.bb...',
      '.....rpbpQ......',
      '.....rpppQ......',
      '.....rcpcQ......',
      '.....rcCcQ......',
      '.....rcbcQ......',
      '......rcQ.......',
      '.......q........',
      '.......q........',
      '.......q........',
      '.....rqqqQ......',
      '................',
      '................'
    ], { r: GL2.r, q: GL2.q, Q: GL2.Q, w: WHITE, p: '#e89ab8', P: '#fbd6e6', c: '#86dce6', C: '#c8f6fa', b: WHITE, B: '#c4485a' });
    outline(im, 'sel');
    px(im, 12, 1, '#ff8aa8'); px(im, 11, 2, '#8c2a4a');
    px(im, 7, 2, WHITE); sparkle(im, 3, 2, '#c8f6fa');
    return im;
  });
  def('drink_mistwine', function () { // Mistwine: silver goblet, pale violet wine, curling mist
    var im = sprite([
      '................',
      '................',
      '................',
      '..sSSSSSSSSSs...',
      '..sMmMMmMMmMs...',
      '..sSvvvvvvvSs...',
      '...sSvvvvvSs....',
      '....sSSSSSs.....',
      '......sSs.......',
      '......jJj.......',
      '......sSs.......',
      '.......s........',
      '......sSs.......',
      '....sSSSSSs.....',
      '................',
      '................'
    ], { s: '#7e8aa6', S: '#c4c8de', M: '#e4d2ff', m: '#b99aee', v: '#8f6cd1', j: MV[1], J: MV[4] });
    outline(im, 'sel');
    // mist curling over the rim
    var mist = alpha('#e8eeff', 0.75), mist2 = alpha('#e8eeff', 0.45);
    [[3, 2], [4, 1], [5, 1], [6, 2], [9, 2], [10, 1], [11, 1], [12, 2]].forEach(function (p) { px(im, p[0], p[1], mist); });
    [[7, 0], [8, 1], [13, 3], [2, 2], [12, 0]].forEach(function (p) { px(im, p[0], p[1], mist2); });
    px(im, 4, 4, WHITE); px(im, 3, 3, WHITE);
    return im;
  });
  def('drink_hollow', function () { // Hollowroot Stout: pint glass, dark stout, creamy head, root stirrer
    var im = sprite([
      '................',
      '..........tt....',
      '.....ffFFt......',
      '....fFFFtFf.....',
      '...rfFFtFFfQ....',
      '...rdddtdddQ....',
      '...rdDdddddQ....',
      '...rdddddddQ....',
      '...rdDddddDQ....',
      '....rdddddQ.....',
      '....rddDddQ.....',
      '....rdddddQ.....',
      '....rdddddQ.....',
      '....rrqqqQQ.....',
      '................',
      '................'
    ], { r: GL2.r, q: GL2.q, Q: GL2.Q, f: '#c8b48a', F: '#ece0c0', d: '#24140e', D: '#4a2a18', t: TAN[2] });
    outline(im, 'sel');
    px(im, 4, 6, '#8a6a5a'); px(im, 4, 7, '#6a4a3a'); px(im, 11, 1, TAN[3]);
    return im;
  });

  // ---- new potions (unique bottle shapes) ----------------------------------
  def('pot_wisplight', function () { // lantern bottle with a captured wisp
    return potion([
      '................',
      '......kkkk......',
      '......k..k......',
      '.....mmmmmm.....',
      '....mMMMMMMm....',
      '....fbbbbbbf....',
      '....fwbbbbbf....',
      '....fwbbbbbf....',
      '....fbbbbbbf....',
      '....fbbbbbbf....',
      '....fbbbbbbf....',
      '....fbbbbbbf....',
      '....mMMMMMMm....',
      '.....mmmmmm.....',
      '................',
      '................'
    ], { liq: ['#1e6a66', '#2fa49a', '#5ee0d0', '#b4fff2', '#ffffff'], level: 5, glow: 2.4,
      leg: { k: STONE[4], m: STONE[2], M: STONE[4], f: STONE[3] },
      post: function (im) { sparkle(im, 8, 8, WHITE, true); px(im, 12, 3, '#b4fff2'); px(im, 3, 9, alpha('#5ee0d0', 0.7)); }
    });
  });
  def('pot_thornhide', function () { // gourd bottle bound in a thorny bramble
    return potion([
      '................',
      '.......cc.......',
      '......rrrr......',
      '.......nn.......',
      '......bbbb......',
      '.....bwbbbb.....',
      '.....wbbbbb.....',
      '......bbbb......',
      '....bbbbbbbb....',
      '...bwbbbbbbbb...',
      '...wbbbbbbbbb...',
      '...bbbbbbbbbb...',
      '...bbbbbbbbbb...',
      '....bbbbbbbb....',
      '.....bbbbbb.....',
      '................'
    ], { liq: ['#1a2a14', '#2e4a22', '#4e7030', '#7a9a46', '#b8d07a'], level: 5, glow: 1.6,
      post: function (im) {
        // bramble binding the gourd: two crossing vines, red-tipped thorns
        var V = '#4a3a22', V2 = '#7a6a3a';
        function vineLine(x0, y0, x1, y1) { var n = 0; line(im, x0, y0, x1, y1, V); }
        vineLine(3, 9, 12, 13); vineLine(3, 13, 12, 9); vineLine(5, 5, 10, 7);
        [[5, 10], [8, 11], [10, 10], [6, 6]].forEach(function (p) { px(im, p[0], p[1], V2); });
        [[4, 8], [9, 13], [12, 8], [4, 12], [11, 6], [7, 9]].forEach(function (p) { px(im, p[0], p[1], '#c4485a'); });
        px(im, 10, 5, '#7a9a46');
      }
    });
  });

  // ---- relics & curios -------------------------------------------------------
  def('treasure_map', function () { // parchment rolled at both ends, dotted trail to a red X
    var im = sprite([
      '................',
      '................',
      '.RR.........RR..',
      'RrrPpPPpPPpPrrR.',
      'RrrPPPPPPPPPrrR.',
      'RrrPPpPPPPPPrrR.',
      'RrrPPPPPPpPPrrR.',
      'RrrPpPPPPPPPrrR.',
      'RrrPPPPPPPPPrrR.',
      'RrrPPPpPPPPPrrR.',
      'RrrpPPPPPPpPrrR.',
      'RrrPPPPPPPPPrrR.',
      '.RR.........RR..',
      '................',
      '................',
      '................'
    ], { R: '#8a6a4a', r: '#d8b88a', P: '#ecd4a8', p: '#c8a878' });
    // trail, a little mountain, the X
    [[4, 10], [5, 9], [6, 9], [7, 8], [8, 7], [9, 6]].forEach(function (p) { px(im, p[0], p[1], '#7a5a3a'); });
    stamp(im, 4, 4, ['.k.', 'k.k'], { k: '#7a5a3a' });
    stamp(im, 9, 3, ['x.x', '.x.', 'x.x'], { x: '#c4282e' });
    px(im, 2, 5, '#f8ecd0'); px(im, 13, 5, '#f8ecd0');
    outline(im, 'sel');
    return im;
  });
  def('old_key', function () { // rusted skeleton key, diagonal
    var im = sprite([
      '................',
      '................',
      '...........rr...',
      '..........rRrr..',
      '.........rRr.rr.',
      '........rRr..r..',
      '.......rRr......',
      '......rRr.......',
      '..ooo.Rr........',
      '.oOOOoR.........',
      'oO..ROo.........',
      'oO..Oo..........',
      'oOO.Oo..........',
      '.oOOo...........',
      '..oo............',
      '................'
    ], { r: '#7a4a30', R: '#a86a42', o: '#6a3a26', O: '#9a5a32' });
    // rust and old-iron patches
    [[11, 3], [8, 6], [3, 9], [1, 11]].forEach(function (p) { pxOn(im, p[0], p[1], '#5e5a6a'); });
    [[12, 4], [9, 5]].forEach(function (p) { pxOn(im, p[0], p[1], '#c07a46'); });
    outline(im, 'sel');
    px(im, 2, 10, '#d89a68'); px(im, 10, 4, '#d89a68');
    return im;
  });
  def('relic_coin', function () { // ancient lunar coin: tarnished silver, crescent relief, verdigris
    var im = img(16, 16);
    disc(im, 8.4, 8.4, 5.3, '#4a5068');
    disc(im, 8, 8, 5.3, function (x, y, dx, dy) {
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.76) return (dx + dy < -0.2) ? '#d4d8e8' : (dx + dy > 0.5 ? '#7e8aa6' : '#a8aec4');
      return (dx + dy < -0.3) ? '#c4c8da' : '#a8aec4';
    });
    // dotted runic rim
    [[8, 4], [11, 5], [12, 8], [11, 11], [8, 12], [5, 11], [4, 8], [5, 5]].forEach(function (p) { px(im, p[0], p[1], '#7e8aa6'); });
    // crescent moon relief
    stamp(im, 6, 6, ['.mm.', 'm...', 'm...', '.mm.'], { m: '#eef0f8' });
    px(im, 7, 7, '#7e8aa6'); px(im, 7, 8, '#7e8aa6');
    // verdigris patina
    [[10, 10], [11, 9], [5, 10], [9, 4]].forEach(function (p) { px(im, p[0], p[1], '#6a9a8a'); });
    outline(im, 'sel');
    px(im, 5, 4, WHITE);
    return im;
  });
  def('relic_idol', function () { // moth-winged idol: small bronze figure with spread moth wings
    var im = sprite([
      '................',
      '................',
      '.ww.........ww..',
      'wWWw..hh...wWWw.',
      'wWeWw.HHh.wWeWw.',
      'wWWWwwhhwwWWWWw.',
      '.wWWwwbbwwWWWw..',
      '..wWwwbBwwWWw...',
      '...wwwbbww ww...',
      '....w.bb..w.....',
      '......bb........',
      '....ssssss......',
      '...sSSSSSSs.....',
      '...ssssssss.....',
      '................',
      '................'
    ].map(function (r) { return r.replace(/ /g, 'w'); }), { w: '#8a6a3a', W: '#c8a060', e: MV[2], h: GOLD[3], H: GOLD[4], b: GOLD[2], B: GOLD[4], s: STONE[2], S: STONE[4] });
    outline(im, 'sel');
    px(im, 3, 4, MV[4]); px(im, 12, 4, MV[4]); px(im, 7, 4, OUT); px(im, 8, 4, OUT);
    return im;
  });
  def('relic_star', function () { // Star Fragment: a broken, glowing crystal star
    var im = img(16, 16);
    var pts = starPts(7.6, 8.2, 7.0, 3.0, 5, -Math.PI / 2 + 0.18);
    // break off the lower-right arm
    pts[4] = [pts[4][0] - 2.6, pts[4][1] - 2.2];
    poly(im, pts, function (x, y) {
      var dx = x - 7.6, dy = y - 8.2, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1.7) return WHITE;
      if (d < 3.0) return CANDLE;
      return (dx + dy < 0) ? '#ffe08a' : (dx - dy > 2 ? '#f2c45a' : '#f6d27a');
    });
    // jagged break
    [[10, 11], [11, 10], [9, 12]].forEach(function (p) { pxOn(im, p[0], p[1], '#c8a0ff'); });
    outline(im, 'sel');
    sparkle(im, 2, 2, WHITE, true); sparkle(im, 13, 13, '#ffe08a'); px(im, 14, 3, WHITE); px(im, 7, 7, WHITE);
    return im;
  });
  def('relic_locket', function () { // silver locket on a fine chain, violet gem
    var im = img(16, 16);
    ellipse(im, 7.5, 9.5, 3.6, 4.2, function (x, y, dx, dy) { return dx + dy < -0.5 ? '#e4e8f4' : dx + dy < 0.45 ? '#b4bcd4' : '#7e8aa6'; });
    ellipse(im, 7.5, 9.5, 2.0, 2.5, function (x, y, dx, dy) { return dx + dy < 0 ? '#c4c8de' : '#9aa2bc'; });
    blob(im, 7.5, 9.5, 1.1, 1.3, [MV[0], MV[2], MV[4]]);
    px(im, 7, 5, '#c4c8de'); px(im, 8, 5, '#9aa2bc');            // bail
    outline(im, 'sel');
    // chain
    var C = '#c4c8de', c = '#7e8aa6';
    [[6, 4], [5, 3], [4, 2], [3, 1], [9, 4], [10, 3], [11, 2], [12, 1]].forEach(function (p, i) { px(im, p[0], p[1], i % 2 ? c : C); });
    px(im, 6, 7, WHITE); px(im, 7, 9, '#f0c8ff');
    return im;
  });
  def('relic_bell', function () { // Fairy Bell: little gold bell with a violet ribbon bow
    var im = sprite([
      '................',
      '................',
      '....vV...Vv.....',
      '....vVVvVVv.....',
      '.....vvVvv......',
      '.......y........',
      '......yYy.......',
      '.....yYYYy......',
      '.....yYYyy......',
      '....yYYYyyy.....',
      '....yYYyyyz.....',
      '...yYYyyyyzz....',
      '...zzzzzzzzz....',
      '.......c........',
      '................',
      '................'
    ], { v: MV[1], V: MV[3], y: GOLD[3], Y: GOLD[4], z: GOLD[2], c: GOLD[1] });
    outline(im, 'sel');
    px(im, 6, 7, WHITE); sparkle(im, 12, 6, '#ffe8ff'); px(im, 2, 9, '#e4d2ff'); px(im, 11, 12, '#ffe08a');
    return im;
  });
  def('relic_feather', function () { // Phoenix Feather: flame-edged, red to gold, with embers
    var im = img(16, 16), K = Math.SQRT1_2;
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var X = x - 7.5, Y = y - 7.5, u = (X - Y) * K, v = (X + Y) * K;
      var s = (u + 8.6) / 17.4;
      if (s < 0 || s > 1) continue;
      var w = s < 0.16 ? 0 : 3.3 * Math.pow(Math.sin(Math.PI * Math.min(1, (s - 0.1) / 0.92)), 0.6);
      w += 0.5 * Math.sin(u * 2.3);          // flame-licked edge
      var c = null;
      if (Math.abs(v) <= 0.55 && s < 0.98) c = s < 0.2 ? '#c88a3a' : '#ffe08a';
      else if (Math.abs(v) <= w) {
        var t = s + (Math.abs(v) / 4) * 0.25;
        c = t < 0.38 ? (v < 0 ? '#e0503e' : '#a8302e') : t < 0.62 ? (v < 0 ? '#ff8a3a' : '#e8603a') : t < 0.82 ? (v < 0 ? '#ffbc62' : '#f29a3a') : (v < 0 ? '#fff1c8' : '#ffd26a');
        if (Math.abs(v) > w - 0.9) c = v < 0 ? '#ffd26a' : '#8a2a32';
      }
      if (c) px(im, x, y, c);
    }
    // eye spot
    px(im, 9, 6, '#4a1a8a'); px(im, 10, 6, '#e8843c'); px(im, 9, 5, '#e8843c');
    outline(im, 'sel');
    px(im, 13, 3, alpha(CANDLE, 0.9)); px(im, 3, 6, alpha(AMBER, 0.85)); px(im, 11, 10, alpha(ORANGE, 0.85)); sparkle(im, 14, 1, '#fff1c8');
    return im;
  });
  def('golden_acorn', function () {
    var im = img(16, 16);
    blob(im, 8, 9.6, 3.9, 4.3, [GOLD[1], GOLD[2], GOLD[3], GOLD[4], GOLD[5]], { bias: 0.1 });
    px(im, 8, 14, GOLD[1]); px(im, 8, 15, null);
    // textured cap
    ellipse(im, 8, 6, 4.8, 2.3, function (x, y) { return ((x + y) % 2) ? '#8a5a2a' : (y < 6 ? '#c08a3a' : '#a06a2a'); });
    stamp(im, 8, 1, ['k.', 'kk', '.k'], { k: '#6a4a26' });
    outline(im, 'sel');
    px(im, 6, 9, WHITE); px(im, 6, 10, GOLD[5]); sparkle(im, 13, 9, WHITE);
    return im;
  });

  // ---- forest creature loot ---------------------------------------------------
  def('thorn_bramble', function () { // Living Bramble: a knotted thorny vine with a glint of life
    var im = img(16, 16), V = ['#2a2214', '#4a3a22', '#6a5a32', '#8a7a46'];
    tube(im, [[3, 12, 1.1], [5.5, 9.5, 1.2], [8.5, 9.8, 1.25], [10.5, 7.6, 1.15], [9, 4.8, 1.05], [6.4, 5.4, 1.0], [6, 8, 1.05], [8.6, 11.6, 1.1], [12, 12.4, 0.9]], V);
    // leaves
    stamp(im, 11, 3, ['.lh', 'lm.'], { l: FG[3], h: FG[4], m: FG[2] });
    stamp(im, 1, 9, ['hl.', '.ml'], { l: FG[3], h: FG[4], m: FG[2] });
    outline(im, 'sel');
    // red-tipped thorns poking out
    [[4, 8], [7, 3], [11, 6], [13, 11], [9, 13], [2, 13], [10, 9], [5, 11]].forEach(function (p) { px(im, p[0], p[1], '#c4485a'); });
    px(im, 7, 8, '#ff6a4a'); px(im, 8, 8, '#ff6a4a');   // two little eyes in the knot
    return im;
  });
  def('wisp_essence', function () { // Wisp Light: a glowing will-o'-the-wisp
    var im = img(16, 16), W = ['#1e6a66', '#3cbfb0', '#7ef0e0', '#c8fff6', '#ffffff'];
    blob(im, 7.5, 9.2, 3.8, 3.8, W, { bias: 0.3 });
    tube(im, [[7.8, 6.2, 2.0], [9, 3.8, 1.3], [10.6, 2.2, 0.7], [12.2, 2.0, 0.35]], W, { bias: 0.35 });
    outline(im, 'sel');
    disc(im, 7.5, 9.4, 1.3, WHITE);
    [[2, 12], [13, 9], [3, 5], [12, 13]].forEach(function (p, i) { px(im, p[0], p[1], alpha(i % 2 ? '#7ef0e0' : '#c8fff6', 0.8)); });
    sparkle(im, 13, 5, '#c8fff6');
    return im;
  });
  def('wolf_fang', function () { // Moss-Wolf Fang: curved ivory fang, mossy root
    var im = img(16, 16);
    tube(im, [[4, 12.4, 2.3], [6.4, 10.4, 2.0], [8.8, 7.8, 1.6], [10.6, 5.2, 1.1], [11.8, 2.8, 0.5]], ['#7e7688', '#b0a8b0', '#d8d0cc', '#f2ece6', '#ffffff']);
    // root and moss
    ellipse(im, 3.6, 12.8, 2.4, 1.6, function (x, y) { return y < 13 ? FG[4] : FG[3]; });
    px(im, 2, 11, FG[5]); px(im, 5, 14, FG[2]); px(im, 1, 13, FG[3]);
    outline(im, 'sel');
    px(im, 7, 8, WHITE); px(im, 9, 6, WHITE);
    return im;
  });
  def('antler_shard', function () { // Spectral Antler: branching, glowing pale teal
    var im = img(16, 16), S = ['#2a6a6a', '#4ab0a8', '#8ee6dc', '#c8fff6', '#ffffff'];
    tube(im, [[3, 13, 1.4], [5, 10, 1.2], [7, 7, 1.05], [9.5, 4, 0.85], [12.5, 2, 0.5]], S, { bias: 0.25 });
    tube(im, [[5.3, 9.6, 0.8], [2.6, 6.8, 0.6], [1.6, 4.4, 0.35]], S, { bias: 0.25 });
    tube(im, [[7.3, 6.8, 0.7], [6.4, 3.4, 0.5], [6.6, 1.6, 0.3]], S, { bias: 0.25 });
    tube(im, [[9.6, 4.2, 0.6], [12.6, 5.2, 0.4], [14, 6.6, 0.3]], S, { bias: 0.25 });
    outline(im, 'sel');
    [[2, 2], [13, 9], [10, 12]].forEach(function (p, i) { px(im, p[0], p[1], alpha(i ? '#8ee6dc' : WHITE, 0.85)); });
    sparkle(im, 12, 11, '#c8fff6');
    px(im, 6, 8, WHITE);
    return im;
  });

  // ===========================================================================
  // EXPANSION — clothing (Isolde's shop): 8 hats, 5 draped cloaks, 6 outfits on hangers
  // ===========================================================================
  var INDIGO = ['#14142e', '#22265a', '#323c86', '#4a58b0', '#6e7ed6'];
  var WPLUM = ['#140c1c', '#24142e', '#3a1f46', '#54305e', '#74507e'];
  var INK = ['#120c1c', '#1e1828', '#2e2640', '#463c5c', '#62567a'];
  function hatDone(im, post) { outline(im, 'sel'); if (post) post(im); return im; }

  // ---- hats ------------------------------------------------------------------
  def('cl_hat_wizard', function () {
    return hatDone(sprite([
      '................',
      '...........43...',
      '.........4432...',
      '........4432....',
      '.......4332.....',
      '.......43y2.....',
      '......43322.....',
      '......433y2.....',
      '.....4333322....',
      '.....4y33322....',
      '....433333322...',
      '...gGGGGGGGGgg..',
      '..433333333333..',
      '..222222222221..',
      '................',
      '................'
    ], legend(['01234', INDIGO], { y: GOLD[4], g: GOLD[2], G: GOLD[3] })), function (im) {
      px(im, 12, 1, GOLD[4]); sparkle(im, 3, 6, '#ffe08a');
    });
  });
  def('cl_hat_witch', function () {
    return hatDone(sprite([
      '................',
      '..32............',
      '..432...........',
      '...432..........',
      '....4332........',
      '.....43322......',
      '.....433322.....',
      '....4333322.....',
      '....4333332.....',
      '...vvvVbbvvv....',
      '...vvvvbBvvv....',
      '.43333333333332.',
      '..222222222221..',
      '................',
      '................',
      '................'
    ], legend(['01234', WPLUM], { v: MV[1], V: MV[2], b: GOLD[3], B: GOLD[1] })), function (im) { px(im, 7, 9, GOLD[5]); });
  });
  def('cl_hat_tricorn', function () { // black tricorn, gold braid, tucked raven feather
    return hatDone(sprite([
      '................',
      '..F.............',
      '..fF..4333......',
      '...fF433332.....',
      '.p..f433332...p.',
      '.pp..433332..pp.',
      '.pBppppppppppBp.',
      '..pBbBBBBBBBBp..',
      '...pbBBBBBBBp...',
      '....pBBBBBBp....',
      '.....pBBBBp.....',
      '......pBBp......',
      '.......pp.......',
      '................',
      '................',
      '................'
    ], legend(['01234', INK], { B: INK[2], b: INK[3], p: GOLD[3], f: INK[1], F: MV[2] })), function (im) {
      px(im, 2, 1, MV[4]); px(im, 3, 2, MV[3]); px(im, 7, 6, GOLD[5]);
    });
  });
  def('cl_hat_beret', function () {
    return hatDone(sprite([
      '................',
      '................',
      '................',
      '.......k........',
      '......kk........',
      '....44443.......',
      '..445555443.....',
      '.4455554444322..',
      '.4444444443332..',
      '..33333333322...',
      '...bbbbbbbbbb...',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], legend(['012345', PLUM], { k: PLUM[2], b: PLUM[1] })), function (im) {
      stamp(im, 10, 7, ['.g.', 'gGg', '.g.'], { g: GOLD[2], G: GOLD[4] }); px(im, 4, 6, PLUM[5]);
    });
  });
  def('cl_hat_hood', function () {
    return hatDone(sprite([
      '................',
      '........4.......',
      '.......443......',
      '......44433.....',
      '.....4433332....',
      '....443kkk332...',
      '....43kkkkk32...',
      '...443kkkkk332..',
      '...43kkkkkkk32..',
      '...43kkkkkkk32..',
      '..4433kkkkk3322.',
      '.44333333333332.',
      '.43343334333432.',
      '..3322332233221.',
      '................',
      '................'
    ], legend(['012345', FG], { k: '#0a1612' })), function (im) { px(im, 7, 7, alpha('#5dffb0', 0.0)); });
  });
  def('cl_hat_crown', function () {
    var im = img(16, 16);
    // vine ring (ellipse seen from the front-above)
    ellipse(im, 7.5, 9, 6.6, 2.8, FG[3]);
    ellipse(im, 7.5, 8.6, 5.4, 1.7, null);
    // flowers around the ring, bigger at the front
    var F = [[2, 8, 'v'], [4, 6, 'w'], [7, 6, 'v'], [10, 6, 'w'], [13, 8, 'v'], [3, 10, 'w'], [6, 11, 'v'], [9, 11, 'w'], [12, 10, 'v']];
    F.forEach(function (f, i) {
      var c = f[2] === 'v' ? [MV[1], MV[3], MV[4]] : ['#c8c0e0', '#f2eefc', WHITE];
      var big = f[1] >= 10;
      if (big) blob(im, f[0], f[1], 1.2, 1.1, c); else { px(im, f[0], f[1], c[1]); px(im, f[0] + 1, f[1], c[0]); px(im, f[0], f[1] - 1, c[2]); }
    });
    outline(im, 'sel');
    [[6, 11], [9, 11], [3, 10], [12, 10]].forEach(function (p) { px(im, p[0], p[1], GOLDC); });
    px(im, 1, 9, FG[4]); px(im, 14, 9, FG[4]);
    return im;
  });
  def('cl_hat_tophat', function () {
    return hatDone(sprite([
      '................',
      '....44444444....',
      '....43333332....',
      '....43333332....',
      '....43333332....',
      '....43333332....',
      '....43333332....',
      '....sSSmSSSs....',
      '....43333332....',
      '....43333332....',
      '.44333333333322.',
      '..222222222221..',
      '................',
      '................',
      '................',
      '................'
    ], legend(['01234', INK], { s: '#7e8aa6', S: '#c8d4f0', m: WHITE })), function (im) { px(im, 8, 7, '#9fb0d8'); px(im, 5, 2, INK[4]); });
  });
  def('cl_hat_circlet', function () {
    var im = img(16, 16);
    ellipse(im, 7.5, 9, 6.2, 2.6, function (x, y, dx, dy) { return dy < 0 ? '#7e8aa6' : (dx < 0 ? '#e2ecff' : '#b4c8ee'); });
    ellipse(im, 7.5, 8.7, 5.2, 1.7, null);
    // front peak holding the moonstone
    stamp(im, 6, 6, ['.SS.', 'SggS', 'SggS', '.SS.'], { S: '#e2ecff', g: '#9fb0d8' });
    blob(im, 7.5, 7.5, 1.0, 1.0, ['#6e7cb0', '#c8d4f0', '#ffffff']);
    px(im, 4, 9, '#e2ecff'); px(im, 11, 9, '#b4c8ee');
    outline(im, 'sel');
    px(im, 7, 7, WHITE); px(im, 8, 8, '#8ec8ff'); sparkle(im, 12, 4, WHITE);
    return im;
  });

  // ---- cloaks (draped from the shoulders, clasp at the throat) ---------------
  var CLOAK = [
    '................',
    '......hhhh......',
    '.....hHHHHh.....',
    '....cCCkkCCc....',
    '...cCCCllCCCc...',
    '...cCCCllCCCc...',
    '..cCfCCllCCfCc..',
    '..cCfCClLCCfCc..',
    '..cCfCClLCCfCcc.',
    '.cCCfCCl.LCCfCc.',
    '.cCCfCl..LCCfCc.',
    '.cCCfCl...LCfCcc',
    '.cCCfCl...LCfCc.',
    '.ccccc.....cccc.',
    '................',
    '................'
  ];
  function cloakIcon(R, lining, clasp, hem, post) {
    // R: [dark, mid, light, highlight]; per-row ramp may come from a function
    var im = img(16, 16);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var ch = CLOAK[y].charAt(x), r = typeof R === 'function' ? R(y) : R;
      var c = { h: r[1], H: r[2], c: r[1], C: r[2], f: r[1], l: lining[0], L: lining[1], k: clasp[0] }[ch];
      if (!c) continue;
      if (ch === 'C' && x < 6) c = r[3];
      if (ch === 'C' && x > 10) c = r[1];
      if (ch === 'c' && x > 8) c = r[0];
      px(im, x, y, c);
    }
    px(im, 7, 3, clasp[1]);
    if (hem) hem(im);
    outline(im, 'sel');
    if (post) post(im);
    return im;
  }
  def('cl_cloak_midnight', function () {
    return cloakIcon(['#0e1638', '#17224c', '#2e4f9f', '#4a6ab8'], ['#2a1a48', '#3e2a62'], ['#9fb0d8', WHITE], null, function (im) {
      [[4, 5], [10, 7], [3, 11], [12, 10], [6, 12], [5, 8], [11, 4]].forEach(function (p, i) { pxOn(im, p[0], p[1], i % 3 ? '#e8eeff' : WHITE); });
    });
  });
  def('cl_cloak_ember', function () {
    var rows = function (y) { var t = clamp((y - 2) / 11, 0, 1); return [mix('#4a1626', '#8a2a1e', t), mix('#8a2a32', '#c44a2a', t), mix('#c44a3a', '#e8843c', t), mix('#e0603e', '#ffbc62', t)]; };
    return cloakIcon(rows, ['#3e0f22', '#5e1a2a'], [GOLD[2], GOLD[4]], function (im) {
      [[2, 13], [5, 13], [12, 13]].forEach(function (p) { px(im, p[0], p[1], '#ffbc62'); });
    }, function (im) { px(im, 3, 14, alpha(AMBER, 0.8)); px(im, 13, 14, alpha(ORANGE, 0.7)); });
  });
  def('cl_cloak_moss', function () {
    return cloakIcon([FG[1], FG[2], FG[3], FG[4]], ['#3e2d2b', '#574039'], [WOOD[3], WOOD[4]], function (im) {
      // ragged, leafy hem
      for (var x = 0; x < 16; x++) px(im, x, 13, null);
      [[1, 13], [2, 14], [4, 13], [5, 14], [11, 13], [12, 14], [14, 13]].forEach(function (p) { px(im, p[0], p[1], FG[3]); });
      [[3, 13], [13, 12], [1, 12], [6, 12]].forEach(function (p) { px(im, p[0], p[1], FG[5]); });
      px(im, 9, 9, FG[5]); px(im, 4, 7, FG[5]);
    });
  });
  def('cl_cloak_raven', function () { // layered black feathers with a violet sheen
    return cloakIcon(INK.slice(1, 5), ['#2a1a48', '#4a2f7a'], ['#c8d4f0', WHITE], function (im) {
      for (var y = 4; y <= 13; y++) for (var x = 0; x < 16; x++) {
        var c = get(im, x, y);
        if (!c || c === '#2a1a48' || c === '#4a2f7a') continue;
        var band = Math.floor((y - 4) / 3), off = (band % 2) * 2, k = (x + off) % 4, r = (y - 4) % 3;
        if (r === 2 && k === 0) px(im, x, y, INK[0]);              // notch between feather tips
        else if (r === 0 && k === 1) px(im, x, y, x < 8 ? MV[2] : MV[1]); // sheen on each feather
        else if (r === 2) px(im, x, y, INK[1]);                   // feather tip shadow
      }
      for (var hx = 1; hx < 15; hx++) if (A(im, hx, 13) && hx % 2) px(im, hx, 14, INK[1]);
    }, function (im) { px(im, 4, 5, MV[4]); });
  });
  def('cl_cloak_silver', function () {
    return cloakIcon(['#6e6a96', '#9a96c0', '#c4c0e0', '#e4e0f6'], ['#8f6cd1', '#b99aee'], ['#9fb0d8', WHITE], null, function (im) {
      sparkle(im, 4, 6, WHITE); sparkle(im, 11, 10, WHITE); px(im, 6, 11, WHITE); px(im, 13, 5, '#e4e0f6');
      px(im, 8, 3, '#8ec8ff');
    });
  });

  // ---- outfits (hung on a little wooden hanger) -------------------------------
  var HANGER = ['........kk......', '.........k......', '...hHHHHHHHHh...'];
  function outfit(rows, leg, post) {
    var im = img(16, 16);
    stamp(im, 0, 3, rows, leg);
    stamp(im, 0, 0, HANGER, { k: STONE[4], h: WOOD[3], H: WOOD[4] });
    outline(im, 'sel');
    if (post) post(im);
    return im;
  }
  def('cl_outfit_scholar', function () { // black robes, violet-and-silver trim and scarf
    return outfit([
      '..sSSSScCSSSSs..',
      '.sSSSvwBBwvSSSs.',
      '.sSSsvwBBwvsSSs.',
      '.sSSsvwBBwvsSSs.',
      '.sSsBvwBBwvBsSs.',
      '.tttBvwTTwvBttt.',
      '....BBBTTBBB....',
      '....BBBTTBBB....',
      '...BBBBTTBBBB...',
      '...BBBBTTBBBB...',
      '...ttttttttttt..'
    ], { s: INK[2], S: INK[3], B: INK[2], c: '#c8d4f0', C: '#9fb0d8', v: MV[2], w: '#c8d4f0', T: MV[1], t: '#9fb0d8' });
  });
  def('cl_outfit_alchemist', function () { // brown leather coat, brass buttons, apron
    return outfit([
      '..sSSSScCSSSSs..',
      '.sSSSSBbbBSSSSs.',
      '.sSSsBBoBBBsSSs.',
      '.sSSsBBbBBBsSSs.',
      '.sSsBBBoBBBBsSs.',
      '.cccBaaaaaaBccc.',
      '....BaAAAAaB....',
      '....BaAAAAaB....',
      '...BBaAAvAaBB...',
      '...BBaAAAAaBB...',
      '...BBaaaaaaBB...'
    ], { s: '#5e3a26', S: '#7a4e34', B: '#6a422c', b: '#4a2e1e', c: '#c8946a', C: '#9e6a4a', o: GOLD[4], a: '#c8b48a', A: '#ece0c0', v: '#2fbf7f' });
  });
  def('cl_outfit_bard', function () { // wine-red doublet with gold trim, slashed sleeves
    return outfit([
      '..sSSSScCSSSSs..',
      '.sSgSSBGGBSSgSs.',
      '.sSgSsBGGBsSgSs.',
      '.sSgSsBGGBsSgSs.',
      '.sSgSBBGGBBSgSs.',
      '.gggsBBGGBBsggg.',
      '....BBBGGBBB....',
      '....BBBGGBBB....',
      '....GGGGGGGG....',
      '................',
      '................'
    ], { s: '#5e1424', S: '#8a2234', B: '#7a1a2e', c: GOLD[4], C: GOLD[2], g: GOLD[3], G: GOLD[3] }, function (im) { px(im, 7, 5, GOLD[5]); px(im, 8, 8, GOLD[5]); });
  });
  def('cl_outfit_duelist', function () { // charcoal waistcoat over a white shirt, red sash
    return outfit([
      '..sSSSScCSSSSs..',
      '.sSSSWBwwBWSSSs.',
      '.sSSsWBwwBWsSSs.',
      '.sSSsWBwoBWsSSs.',
      '.sSsWBBwwBBWsSs.',
      '.cccWBBwoBBWccc.',
      '....RRRRRRRR....',
      '....rrRRRRrr....',
      '....BBBwwBBB.R..',
      '....BBBwwBBBRr..',
      '................'
    ], { s: '#c8d4f0', S: '#f2f4ff', c: '#9fb0d8', C: '#e8eeff', W: '#3a3a4e', B: '#2a2a3a', w: '#f2f4ff', o: STONE[4], R: '#c4282e', r: '#8a1a22' });
  });
  def('cl_outfit_moonweave', function () { // pale lavender robes that glimmer
    return outfit([
      '..sSSSScCSSSSs..',
      '.sSSSSBTTBSSSSs.',
      '.sSSsBBTTBBsSSs.',
      '.sSSsBBTTBBsSSs.',
      '.sSsBBBTTBBBsSs.',
      '.tttBBBTTBBBttt.',
      '....BBBTTBBB....',
      '....BBBTTBBB....',
      '...BBBBTTBBBB...',
      '...BBBBTTBBBB...',
      '...ttttttttttt..'
    ], { s: '#a89ad8', S: '#cfc4f0', B: '#bcaee8', c: WHITE, C: '#c8d4f0', T: '#e8eeff', t: '#9fb0d8' }, function (im) {
      sparkle(im, 5, 9, WHITE); sparkle(im, 11, 6, WHITE); px(im, 3, 6, WHITE); px(im, 9, 12, '#f4f0ff');
    });
  });
  def('cl_outfit_ranger', function () { // forest-green tunic, leather belt and bracers
    return outfit([
      '..sSSSScCSSSSs..',
      '.sSSSSBccBSSSSs.',
      '.sSSsBBBBBBsSSs.',
      '.sSSsBBBBBBsSSs.',
      '.bbbsBBBBBBsbbb.',
      '.bBbBBBBBBBBbBb.',
      '....LLLGLLLL....',
      '....BBBBBBBB....',
      '....BBBBBBBB....',
      '....BBB..BBB....',
      '................'
    ], { s: FG[2], S: FG[3], B: FG[3], c: '#7a5a3a', C: '#5e4030', b: '#6e4a30', L: '#4a2e1e', G: GOLD[3] }, function (im) { px(im, 5, 5, FG[4]); px(im, 6, 4, FG[4]); });
  });

  // ===========================================================================
  // EXPANSION — snacks & dishes (DESIGN2.md §8)
  // ===========================================================================
  // crescent-moon sweet (4x4 "C"), c = [light, mid, shade]; flip mirrors it into a ")"
  function moonSweet(L, x, y, c, flip) {
    stamp(L, x, y, ['.ab.', 'aa..', 'ab..', '.bc.'], { a: c[0], b: c[1], c: c[2] }, flip);
  }
  var SWEET_GOLD = ['#fff1c8', '#ffd860', '#d89a30'], SWEET_LAV = ['#f6efff', '#cdb4f6', '#9a78d8'],
    SWEET_MINT = ['#e6fff2', '#8cf0c4', '#3cb888'], SWEET_ROSE = ['#fff0f6', '#f4a6c8', '#c86a92'];
  def('snack_sweets', function () { // Bag of Moonsweets: a striped paper bag spilling glowing crescent sweets
    var im = img(16, 16);
    function layer(fn) { var L = img(16, 16); fn(L); outline(L, 'sel'); blit(im, L, 0, 0); }
    // two sweets peeking out of the mouth (behind the bag)
    layer(function (L) { moonSweet(L, 1, 3, SWEET_GOLD); moonSweet(L, 5, 2, SWEET_LAV, true); });
    // the bag: 2px violet / cream stripes, zig-zag mouth, shaded right side and bottom
    layer(function (L) {
      for (var y = 6; y <= 14; y++) for (var x = 1; x <= 8; x++) {
        if (y === 6 && x % 2 === 0) continue;                    // pinked (zig-zag) edge
        var stripe = Math.floor((x - 1) / 2) % 2, c = stripe ? '#fbf2dc' : '#9a78e0';
        if (x === 1) c = stripe ? '#ffffff' : '#b496f0';
        if (x >= 7) c = stripe ? '#ddd0b8' : '#7454c0';
        if (y >= 13) c = stripe ? '#c8b496' : '#5a3aa0';
        if (y === 7) c = mix(c, '#4a2f7a', 0.35);                // shadow just under the mouth
        px(L, x, y, c);
      }
    });
    // two sweets tumbling out to the right
    layer(function (L) { moonSweet(L, 10, 6, SWEET_MINT, true); moonSweet(L, 11, 11, SWEET_ROSE); });
    // a little glow
    sparkle(im, 10, 2, '#fff1c8', true); px(im, 14, 4, '#e4d2ff'); px(im, 9, 12, alpha('#8cf0c4', 0.85)); px(im, 14, 15 - 6, alpha('#ffd860', 0.8));
    px(im, 2, 4, WHITE); px(im, 7, 3, WHITE);
    return im;
  });
  def('snack_toffee', function () { // Cauldron Toffee: a tiny iron cauldron brimming with glossy toffee
    var im = img(16, 16), T = ['#5a2a14', '#8a4a1e', '#c07a2e', '#e8a84a', '#fbd890'];
    // toffee shards heaped above the rim
    stamp(im, 3, 3, [
      '...cc.dd..',
      '..cCcdDdc.',
      '.ccCbcddcc',
      'bcCCbbcdcb'
    ], { b: T[1], c: T[2], C: T[3], d: T[3], D: T[4] });
    // cauldron
    ellipse(im, 7.5, 10.4, 5.6, 3.3, function (x, y, dx, dy) { return y < 8 ? null : (dx + dy < -0.4 ? '#605f78' : dx + dy < 0.5 ? '#45445a' : '#2d2c3e'); });
    hline(im, 2, 13, 7, '#7e7d97'); hline(im, 2, 13, 8, '#45445a'); px(im, 2, 8, '#7e7d97');
    stamp(im, 3, 13, ['k......k', 'k......k'], { k: '#2d2c3e' });
    // drip of toffee over the rim
    px(im, 10, 8, T[3]); px(im, 10, 9, T[2]); px(im, 10, 10, T[1]); px(im, 4, 8, T[2]);
    outline(im, 'sel');
    px(im, 6, 4, T[4]); px(im, 9, 4, WHITE); px(im, 5, 5, WHITE);
    return im;
  });
  def('snack_jellies', function () { // Jumping Jellies: wriggly fizzy gummy creatures
    var im = img(16, 16);
    function jelly(cx, cy, rx, ry, R, eyes) {
      var L = img(16, 16);
      blob(L, cx, cy, rx, ry, R, { bias: 0.15 });
      for (var x = 0; x < 16; x++) if (A(L, x, Math.round(cy + ry))) px(L, x, Math.round(cy + ry), R[1]);
      outline(L, 'sel');
      blit(im, L, 0, 0);
      px(im, eyes[0], eyes[1], OUT); px(im, eyes[0] + 2, eyes[1], OUT);
      px(im, eyes[0] - 1, eyes[1] - 1, WHITE);
    }
    jelly(3.8, 11.6, 2.6, 2.3, ['#8c3a62', '#c4648e', '#e89ab8', '#fbd6e6'], [3, 11]);
    jelly(11.6, 11.8, 2.5, 2.2, ['#1e6a56', '#2fbf7f', '#5dffb0', '#b4ffd9'], [11, 11]);
    jelly(7.6, 4.2, 2.3, 2.6, ['#4a2f7a', '#8f6cd1', '#b99aee', '#e4d2ff'], [7, 4]);
    px(im, 8, 6, '#2a1a48');                                                         // a little "o" mouth: mid-jump yelp
    // boing lines and fizz
    [[6, 8], [7, 9], [9, 8], [8, 9]].forEach(function (p, i) { px(im, p[0], p[1], alpha('#e4d2ff', i < 2 ? 0.9 : 0.6)); });
    [[1, 7], [14, 7], [12, 4], [2, 3]].forEach(function (p) { px(im, p[0], p[1], WHITE); });
    sparkle(im, 12, 1, '#fff1c8');
    return im;
  });
  def('food_honeycake', function () { // Honeymoon Cake: layered cake, honey drip, crescent topper
    var im = sprite([
      '................',
      '.......mm.......',
      '......m.........',
      '......m.........',
      '.......mm.......',
      '...hhhHHHhhhh...',
      '..hHHHHHHHHHhh..',
      '..sHhsssHhssHs..',
      '..ssHsssshsssS..',
      '..cccccccccccC..',
      '..ssssssssssSS..',
      '..ssssssssssSS..',
      '..SSSSSSSSSSSS..',
      '.pPPPPPPPPPPPPp.',
      '..pppppppppppp..',
      '................'
    ], { m: GOLD[4], h: '#e8a030', H: '#ffcc58', s: '#e8c098', S: '#c8946a', c: '#fff6e8', C: '#e8dcc8', P: '#e8eeff', p: '#9fb0d8' });
    outline(im, 'sel');
    px(im, 7, 2, GOLD[5]); sparkle(im, 11, 2, WHITE); px(im, 5, 6, WHITE);
    return im;
  });
  def('food_pasty', function () { // Pumpkin Pasty: crimped half-moon pastry, pumpkin peeking from the slits
    var im = img(16, 16), C = ['#7a4a1e', '#b0702e', '#d89a4a', '#f2c47a', '#fbe0a8'];
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var dx = x - 7.5, dy = y - 12.5, d = Math.sqrt(dx * dx + dy * dy);
      if (dy > 0 || d > 6.6) continue;
      var c = (dx + dy * 1.4 < -4) ? C[4] : (dx + dy < 0 ? C[3] : C[2]);
      if (d > 5.5) c = (Math.round(Math.atan2(dy, dx) * 5) % 2) ? C[1] : C[3];   // crimped rim
      if (y === 12) c = C[1];
      px(im, x, y, c);
    }
    // vent slits with pumpkin filling
    [[6, 8], [7, 7], [9, 9], [10, 8]].forEach(function (p, i) { px(im, p[0], p[1], i % 2 ? ORANGE : '#c4581e'); });
    outline(im, 'sel');
    // tiny pumpkin leaf + stem garnish
    px(im, 11, 4, FG[4]); px(im, 12, 4, FG[5]); px(im, 11, 5, FG[3]);
    px(im, 5, 6, WHITE);
    return im;
  });
  def('food_gazypie', function () { // Starry-Gazy Pie: fish heads poke up through the crust, gazing at the stars
    var im = img(16, 16), C = ['#7a4a1e', '#b0702e', '#d89a4a', '#f2c47a', '#fbe0a8'];
    ellipse(im, 7.5, 10, 6.7, 3.0, function (x, y, dx, dy) { return dx + dy < -0.6 ? C[4] : dx + dy < 0.4 ? C[3] : C[2]; });
    for (var x = 1; x <= 14; x++) if (A(im, x, 12)) px(im, x, 12, x % 2 ? C[1] : C[2]);
    hline(im, 2, 13, 13, '#7e7d97'); hline(im, 3, 12, 14, '#45445a');
    outline(im, 'sel');
    // three silver fish heads, each on its own layer so they stay separate
    [[3, 4], [7, 2], [11, 4]].forEach(function (f, i) {
      var F = img(16, 16);
      stamp(F, f[0] - 1, f[1], ['.a.', 'aab', 'abb', 'abb', 'cbc', 'ccc'], { a: '#eef2ff', b: '#9fb0d8', c: '#6e7cb0' });
      outline(F, 'sel');
      px(F, f[0] - 1, f[1] + 2, OUT); px(F, f[0] - 1, f[1] + 1, WHITE);   // eye gazing upward
      blit(im, F, 0, 0);
    });
    // crust crimps around their necks
    [[2, 10], [5, 9], [9, 9], [12, 10], [7, 11]].forEach(function (p) { px(im, p[0], p[1], C[1]); });
    sparkle(im, 1, 1, '#fff1c8'); px(im, 13, 1, '#ffe08a'); px(im, 10, 0, WHITE); px(im, 4, 0, alpha(WHITE, 0.7));
    return im;
  });
  def('food_chili', function () { // Dragonfire Chili: terracotta bowl of red chili, pepper garnish, flames
    var im = sprite([
      '................',
      '................',
      '................',
      '................',
      '................',
      '..rrRrrbrrRrr...',
      '.rRrrbrrRrrbrr..',
      '.kRrrrRrrrbrrk..',
      '.4kkkkkkkkkkk3..',
      '.4333333333332..',
      '..43333333332...',
      '...433333332....',
      '....1222221.....',
      '................',
      '................',
      '................'
    ], { r: '#b8303a', R: '#e0503e', b: '#5a2018', k: '#7a2a24', 4: '#d07a4a', 3: '#a8542e', 2: '#7a3a22', 1: '#5a2a1e' });
    // a chili pepper laid on top
    stamp(im, 6, 4, ['.gRR.', '...Rr'], { g: '#4e6a26', R: '#ff6a4a', r: '#c4282e' });
    outline(im, 'sel');
    // dragon-fire wisps
    stamp(im, 3, 1, ['.y...y', 'yOy.yO', '.o...o'], { y: alpha(CANDLE, 0.85), O: AMBER, o: alpha(ORANGE, 0.9) });
    px(im, 10, 2, alpha(AMBER, 0.8)); px(im, 11, 3, alpha(ORANGE, 0.7));
    return im;
  });
  def('food_gingerghost', function () { // Ghostly Gingerbread: ghost-shaped biscuit with white icing
    var im = sprite([
      '................',
      '................',
      '......4443......',
      '....44444333....',
      '...4444443332...',
      '...444ww43w32...',
      '..4444ww43ww32..',
      '..44444444333 2.',
      '..444444o44332..',
      '..4444443333322.',
      '..44w4443333w22.',
      '..4444433333322.',
      '..443.4433.3322.',
      '..43...43...32..',
      '................',
      '................'
    ].map(function (r) { return r.replace(/ /g, '3'); }), { 4: '#c8864a', 3: '#a8683a', 2: '#7a4a2a', w: '#3a2216', o: '#3a2216' });
    // icing outline traced around the edge (white), ghostly glow
    var D = edgeDist(im);
    eachPx(im, function (x, y) { if (D(x, y) === 2 && (x + y) % 2 === 0) px(im, x, y, '#fff6f0'); });
    outline(im, 'sel');
    px(im, 1, 4, alpha('#e8eeff', 0.6)); px(im, 14, 6, alpha('#e8eeff', 0.6)); sparkle(im, 13, 2, '#e8eeff');
    return im;
  });
  def('food_glowtoast', function () { // Glowcap Toast: thick toast topped with glowing mushrooms
    var im = sprite([
      '................',
      '................',
      '................',
      '................',
      '...cccc..cccc...',
      '..cBBBBccBBBBc..',
      '..cBbbbbbbbbBc..',
      '..cBbbbbbbbbBc..',
      '...cbbbbbbbbc...',
      '...cbbbbbbbbc...',
      '...cbbbbbbbbc...',
      '...cbbbbbbbbc...',
      '...cbbbbbbbbc...',
      '...cccccccccc...',
      '................',
      '................'
    ], { c: '#a8642e', B: '#d89a4a', b: '#f2d6a0' });
    // butter + two glowing glowcaps
    stamp(im, 9, 9, ['yy', 'yY'], { y: '#ffe68a', Y: '#fff1c8' });
    outline(im, 'sel');
    var M = img(16, 16);
    stamp(M, 3, 3, ['.554.', '5W554', 'vvvvv', '.st..', '.st..'], { 5: ICE[4], 4: ICE[3], W: WHITE, v: MV[1], s: '#e8eeff', t: '#9fb0d8' });
    stamp(M, 8, 5, ['.54.', '5W54', 'vvvv', '.st.'], { 5: ICE[4], 4: ICE[3], W: WHITE, v: MV[1], s: '#e8eeff', t: '#9fb0d8' });
    outline(M, 'sel');
    blit(im, M, 0, 0);
    sparkle(im, 13, 3, '#b4faff'); px(im, 3, 2, alpha('#7ef0ff', 0.8));
    return im;
  });
  def('food_moonpudding', function () { // Moon Pudding: pale glowing dome, violet syrup, crescent on top
    var im = img(16, 16);
    ellipse(im, 7.5, 13, 6.8, 1.6, function (x, y, dx) { return dx < 0 ? '#e8eeff' : '#9fb0d8'; });   // plate
    blob(im, 7.5, 10, 4.6, 4.6, ['#9fb0d8', '#c8d4f0', '#e8eeff', '#ffffff'], { bias: 0.1 });
    for (var x = 0; x < 16; x++) for (var y = 13; y < 16; y++) if (y > 12 && get(im, x, y) && y >= 13 && Math.abs(x - 7.5) < 4.6 && y === 13) px(im, x, y, '#c8d4f0');
    // violet syrup cap with drips
    ellipse(im, 7.5, 6.6, 3.2, 1.4, function (x, y, dx, dy) { return dx + dy < 0 ? MV[3] : MV[2]; });
    [[5, 8], [5, 9], [9, 8], [10, 8], [10, 9], [10, 10], [7, 8]].forEach(function (p) { px(im, p[0], p[1], MV[2]); });
    outline(im, 'sel');
    // crescent on top + glow
    stamp(im, 7, 3, ['.m', 'm.', '.m'], { m: GOLD[4] });
    sparkle(im, 12, 3, WHITE); px(im, 5, 10, WHITE); px(im, 3, 6, alpha('#e8eeff', 0.7));
    return im;
  });
  def('food_spellscroll', function () { // Cinnamon Spellscroll: pastry rolled like a scroll, glowing icing runes
    var im = sprite([
      '................',
      '................',
      '................',
      '..SSs.......Ss..',
      '.SccbS.....ScbS.',
      'ScCbbcSPPPPScCbS',
      'SbbcCbPPPPPPbbcS',
      'SbcCbbPPPPPPbcbS',
      'ScbbcbPPPPPPcbbS',
      '.SbbcSPPPPPPSbS.',
      '..SSs.pppppp.Ss.',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], { S: '#7a4a1e', s: '#5a3414', c: '#5a2a14', C: '#8a4a1e', b: '#d89a4a', P: '#f2c47a', p: '#b0702e' });
    outline(im, 'sel');
    // glowing icing runes along the roll
    [[7, 6, '#b4faff'], [8, 7, '#7ef0ff'], [7, 8, '#b4faff'], [9, 6, '#e4d2ff'], [10, 7, '#c8a0ff'], [10, 8, '#e4d2ff'], [8, 5, '#fff6e0']].forEach(function (p) { px(im, p[0], p[1], p[2]); });
    sparkle(im, 13, 1, '#b4faff'); px(im, 2, 12, alpha('#e4d2ff', 0.8));
    return im;
  });
  def('food_starbun', function () { // Starlight Bun (rare): puffy golden star-shaped bun, glazed and sparkling
    var im = img(16, 16);
    var pts = starPts(7.5, 8.2, 7.0, 3.6, 5);
    poly(im, pts, '#d89a4a');
    var D = edgeDist(im);
    eachPx(im, function (x, y) {
      var d = D(x, y), c;
      if (d <= 1) c = (x + y < 15) ? '#c07a2e' : '#8a4a1e';
      else if (d === 2) c = (x + y < 15) ? '#f2c45a' : '#d89a4a';
      else c = '#ffe08a';
      px(im, x, y, c);
    });
    outline(im, 'sel');
    // glaze shine + sugar crystals
    px(im, 6, 6, WHITE); px(im, 7, 6, '#fff1c8'); px(im, 6, 7, '#fff1c8');
    [[4, 9], [10, 7], [8, 11], [11, 11]].forEach(function (p) { px(im, p[0], p[1], '#fff6e0'); });
    sparkle(im, 13, 2, WHITE, true); sparkle(im, 2, 12, '#ffe08a'); px(im, 14, 11, WHITE);
    return im;
  });

  // ===========================================================================
  // EXPANSION — spellbook, spell cards, mana, festival & familiar items (DESIGN2 §10–12)
  // ===========================================================================
  def('spellbook', function () { // leather tome, gold moon on the cover, strap with a glowing moon clasp
    var im = sprite([
      '................',
      '................',
      '..gLLLLLLLLg....',
      '..sLlllllllLpp..',
      '..sLlllgglllPp..',
      '..sLllgllllLpp..',
      '..sLllglllttttt.',
      '..sLllgllcCCCc..',
      '..sLlllggcMMMc..',
      '..sLllllltttttt.',
      '..sLlllllllLPp..',
      '..sLlllllllLpp..',
      '..gLLLLLLLLgpp..',
      '...sssssssssp...',
      '................',
      '................'
    ], { L: '#6a3040', l: '#4a2230', s: '#2a1420', g: GOLD[3], p: '#e8dcc4', P: '#c8b496', t: '#3e2a2a', c: STONE[3], C: STONE[5], M: '#c8f6ff' });
    outline(im, 'sel');
    px(im, 11, 8, WHITE); px(im, 12, 7, '#7ef0ff'); px(im, 3, 3, '#8a4458');
    sparkle(im, 14, 4, '#c8f6ff');
    return im;
  });
  // spell rune-cards: framed card, coloured border, glowing symbol on a dark field
  function spellCard(B, symbol, leg, post) {
    var im = img(16, 16);
    for (var y = 1; y <= 14; y++) for (var x = 3; x <= 12; x++) {
      if ((x === 3 || x === 12) && (y === 1 || y === 14)) continue;      // rounded corners
      var edge = x === 3 || x === 12 || y === 1 || y === 14;
      var inner = x === 4 || x === 11 || y === 2 || y === 13;
      var c = edge ? (x + y < 15 ? B[2] : B[1]) : inner ? B[0] : (y < 8 ? '#231b38' : '#1b1429');
      px(im, x, y, c);
    }
    px(im, 7, 1, B[3]); px(im, 8, 1, B[3]); px(im, 7, 14, B[1]); px(im, 8, 14, B[1]);   // little gem studs
    stamp(im, 5, 4, symbol, leg);
    outline(im, 'sel');
    if (post) post(im);
    return im;
  }
  def('spell_lumen', function () { // a floating light orb
    return spellCard(['#5a3a14', '#a8743a', '#f2c45a', '#fff1c8'], [
      '..y..y',
      '...yy.',
      '.yWWy.',
      'yWWWWy',
      '.yWWy.',
      '..yy..',
      '.y..y.'
    ].map(function (r) { return (r + '......').slice(0, 6); }), { y: '#ffd860', W: '#fff6dc' }, function (im) { px(im, 7, 7, WHITE); px(im, 8, 6, WHITE); });
  });
  def('spell_verdance', function () { // a sprouting seedling
    return spellCard(['#123a2a', '#2a7a4a', '#5dd88a', '#b4ffd9'], [
      'll..hh',
      'lLl.hHh',
      '.lLlhh.',
      '..ss...',
      '..s....',
      '.gggg..',
      'gggggg.'
    ], { l: '#2fbf7f', L: '#b4ffd9', h: '#2fbf7f', H: '#b4ffd9', s: '#5dd88a', g: '#7a5a48' });
  });
  def('spell_blink', function () { // a short teleport: dashed arc ending in a burst
    return spellCard(['#2a1450', '#6a3aa8', '#c08af0', '#f4dcff'], [
      '....pP',
      '.....P',
      '..p..p',
      '.p....',
      'p.....',
      'pW....',
      'WW....'
    ], { p: '#e080ff', P: '#ffd6ff', W: WHITE }, function (im) { sparkle(im, 10, 4, '#ffd6ff'); });
  });
  def('spell_frostbolt', function () { // a snowflake / ice shard
    return spellCard(['#14305a', '#2e6a9a', '#86dce6', '#e6fbff'], [
      '..i...',
      'i.i.i.',
      '.iIi..',
      'iIWIi.',
      '.iIi..',
      'i.i.i.',
      '..i...'
    ], { i: '#86dce6', I: '#c8f6fa', W: WHITE }, function (im) { px(im, 7, 4, WHITE); });
  });
  def('pot_mana', function () { // Mana Draught: slim spindle bottle, star stopper, swirling starlight
    return potion([
      '................',
      '.......S........',
      '......SsS.......',
      '.......c........',
      '......rrrr......',
      '.......nn.......',
      '......bbbb......',
      '.....bwbbbb.....',
      '.....wbbbbb.....',
      '.....bbbbbb.....',
      '......bbbb......',
      '......bbbb......',
      '.......bb.......',
      '.......bb.......',
      '................',
      '................'
    ], { liq: ['#1e1a5a', '#2e2e8a', '#4a4ac0', '#7a7ae8', '#c8c8ff'], level: 6, glow: 1.6,
      leg: { S: '#c8d4f0', s: WHITE, c: '#9fb0d8' },
      post: function (im) {
        [[8, 7], [9, 8], [8, 9], [7, 9], [6, 8], [8, 11], [7, 12]].forEach(function (p, i) { px(im, p[0], p[1], i % 3 ? '#e4e4ff' : WHITE); });
        sparkle(im, 11, 4, '#c8c8ff'); px(im, 3, 9, alpha('#c8c8ff', 0.7));
      } });
  });
  def('scroll_spell', function () { // rolled parchment tied with a ribbon, glowing rune seal
    var im = img(16, 16), P = ['#8a6a4a', '#b8946a', '#d8b88a', '#ecd4a8', '#f8ecd0'];
    tube(im, [[3, 12, 2.2], [12, 3, 2.2]], P);
    // rolled ends
    ellipse(im, 2.6, 12.4, 1.6, 1.6, function (x, y, dx, dy) { return dx * dx + dy * dy < 0.2 ? P[1] : P[0]; });
    ellipse(im, 12.4, 2.6, 1.7, 1.7, P[3]); px(im, 12, 3, P[1]); px(im, 13, 2, P[2]);
    // ribbon band
    [[6, 6], [7, 7], [8, 8], [9, 9], [6, 7], [7, 8], [8, 9]].forEach(function (p) { pxOn(im, p[0], p[1], MV[1]); });
    outline(im, 'sel');
    // ribbon tails + glowing rune seal
    px(im, 9, 11, MV[2]); px(im, 9, 12, MV[1]); px(im, 11, 10, MV[2]); px(im, 12, 11, MV[1]);
    disc(im, 9.5, 9.5, 1.6, '#4a2f7a');
    px(im, 9, 9, '#7ef0ff'); px(im, 10, 10, '#7ef0ff'); px(im, 10, 9, '#c8fff6'); px(im, 9, 10, '#3ec8e8');
    sparkle(im, 13, 13, '#b4faff'); px(im, 4, 3, alpha('#7ef0ff', 0.7));
    return im;
  });
  def('sky_lantern', function () { // paper sky lantern with a warm inner glow
    var im = sprite([
      '................',
      '....pppppppp....',
      '...pPPPPPPPPp...',
      '...pPyyyyyyPp...',
      '...pyYYYYYYyp...',
      '...pyYWWWWYyp...',
      '...pyYWWWWYyp...',
      '....pyYWWYyp....',
      '....pyYYYYyp....',
      '....pyyyyyyp....',
      '.....pyyyyp.....',
      '.....kkkkkk.....',
      '.......f........',
      '................',
      '................',
      '................'
    ], { p: '#c87a3a', P: '#e8a85a', y: '#ffbc62', Y: '#ffd890', W: '#fff1c8', k: '#7a4a2a', f: AMBER });
    // paper ribs
    [[6, 3], [6, 4], [6, 5], [6, 6], [9, 3], [9, 4], [9, 5], [9, 6], [7, 8], [8, 8]].forEach(function (p) { if (get(im, p[0], p[1]) !== '#fff1c8') pxOn(im, p[0], p[1], '#e8963a'); });
    outline(im, 'sel');
    px(im, 7, 12, CANDLE); px(im, 8, 13, alpha(AMBER, 0.6));
    px(im, 2, 6, alpha('#ffd890', 0.7)); px(im, 13, 5, alpha('#ffd890', 0.7)); sparkle(im, 13, 1, '#fff1c8');
    return im;
  });
  def('festival_token', function () { // gold coin stamped with a lantern
    var im = img(16, 16);
    disc(im, 8.5, 8.5, 5.2, '#8a4a1e');
    disc(im, 8, 8, 5.2, function (x, y, dx, dy) {
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.76) return (dx + dy < -0.2) ? '#ffd890' : (dx + dy > 0.5 ? '#c07a2e' : '#e8a84a');
      return (dx + dy < -0.3) ? '#f2c45a' : '#e8a84a';
    });
    stamp(im, 5, 3, [
      '..kk..',
      '.k..k.',
      'kkkkkk',
      '.kyyk.',
      '.kyYk.',
      '.kyyk.',
      'kkkkkk'
    ], { k: '#8a4a1e', y: '#ffbc62', Y: CANDLE });
    outline(im, 'sel');
    px(im, 5, 4, WHITE); px(im, 4, 5, '#fff1c8');
    return im;
  });
  def('prize_ribbon', function () { // violet rosette, gold centre, notched tails
    var im = img(16, 16);
    // tails
    stamp(im, 4, 9, [
      '.vV..Vv.',
      '.vV..Vv.',
      'vvV..Vvv',
      'vV....Vv',
      'v......v'
    ], { v: MV[1], V: MV[2] });
    // pleated rosette
    for (var y = 0; y < 12; y++) for (var x = 1; x < 15; x++) {
      var dx = x - 7.5, dy = y - 6, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 5.6) continue;
      var a = Math.atan2(dy, dx), pleat = Math.floor((a + Math.PI) / (Math.PI / 8)) % 2;
      var c = pleat ? MV[3] : MV[2];
      if (d > 4.6) c = pleat ? MV[2] : MV[1];
      if (dx + dy < -4) c = MV[4];
      px(im, x, y, c);
    }
    disc(im, 7.5, 6, 2.1, function (x, y, dx, dy) { return dx + dy < -0.3 ? GOLD[4] : dx + dy < 0.5 ? GOLD[3] : GOLD[2]; });
    outline(im, 'sel');
    px(im, 7, 5, WHITE); sparkle(im, 13, 1, '#ffe08a');
    return im;
  });
  def('fam_treat', function () { // familiar treats: little biscuit tin with a paw-and-wing emblem
    var im = img(16, 16);
    // tin body
    for (var y = 6; y <= 13; y++) for (var x = 2; x <= 13; x++) {
      var c = x < 5 ? '#4ab0a8' : x > 10 ? '#1e6a66' : '#2f8a84';
      if (y === 13) c = '#16504c';
      px(im, x, y, c);
    }
    // lid
    ellipse(im, 7.5, 6, 6.2, 2.2, function (x, y, dx, dy) { return dy < -0.2 ? (dx < 0 ? '#7ad4cc' : '#4ab0a8') : GOLD[2]; });
    hline(im, 2, 13, 7, GOLD[3]); px(im, 2, 7, GOLD[4]);
    // emblem on a cream label: a paw print and a little wing
    ellipse(im, 7.5, 10.4, 3.7, 1.9, '#fff6e0');
    stamp(im, 4, 9, [
      '.t.t..w',
      't.t..ww',
      '.pp.www',
      '.pp..w.'
    ], { t: '#5a3a2a', p: '#5a3a2a', w: '#2f7a8a' });
    // a biscuit leaning against the tin
    stamp(im, 11, 10, ['.bb', 'bBb', 'bbb'], { b: '#c8864a', B: '#e8b06a' });
    outline(im, 'sel');
    px(im, 4, 5, WHITE); px(im, 12, 11, '#7a4a2a');
    return im;
  });

  // ===========================================================================
  // ROUND 3 (DESIGN3.md) — geodes (+ cracking animation) and 24 collectible minerals
  // ===========================================================================
  var GEODE = {
    geode_moon: { shell: ['#2e3248', '#4a5070', '#6e7698', '#98a0c0', '#c4cae2'], speck: '#e8eeff', glow: ['#4a6ab8', '#8ec8f4', '#d6f2ff', '#ffffff'], cry: ['#4a5a96', '#7e92cc', '#b4c8ee', '#e8f2ff'] },
    geode_ember: { shell: ['#24100e', '#42201a', '#643222', '#86482e', '#a86842'], speck: '#e8843c', glow: ['#c44a3a', '#e8843c', '#ffbc62', '#fff1c8'], cry: ['#8a2a32', '#c44a3a', '#ff8a4a', '#ffd08a'] },
    geode_void: { shell: ['#0c0814', '#1a1230', '#2a2048', '#3e3266', '#584a86'], speck: '#b46ae0', glow: ['#5e2a8a', '#9a4ac8', '#e07af0', '#ffc8ff'], cry: ['#34185a', '#6a2e9a', '#b05ae0', '#f0b8ff'] },
    geode_star: { shell: ['#10142e', '#1c2248', '#2c3468', '#424c88', '#5e68a8'], speck: '#ffe08a', glow: [GOLD[2], GOLD[3], '#ffe08a', '#fff6dc'], cry: [GOLD[1], GOLD[3], '#ffe08a', '#fffbe8'] }
  };
  // lumpy shaded geode body
  function geodeBody(im, cx, cy, rx, ry, G, seed) {
    blob(im, cx - rx * 0.5, cy - ry * 0.4, rx * 0.55, ry * 0.5, G.shell, { bias: 0.12 });
    blob(im, cx + rx * 0.42, cy + ry * 0.22, rx * 0.6, ry * 0.6, G.shell, { bias: 0.0 });
    blob(im, cx, cy, rx, ry, G.shell, { bias: 0.05 });
    // pitted texture + specks
    eachPx(im, function (x, y, c) {
      var n = hash(x, y, seed);
      if (n < 0.1) px(im, x, y, dk(c, 0.3));
      else if (n > 0.95) px(im, x, y, G.speck);
    });
  }
  function geodeIcon(id) {
    var G = GEODE[id], im = img(16, 16);
    geodeBody(im, 7.6, 8.6, 6.0, 5.4, G, 17);
    // a glowing crack
    [[9, 3], [9, 4], [8, 5], [8, 6], [9, 7], [10, 8], [10, 9], [11, 10]].forEach(function (p, i) { pxOn(im, p[0], p[1], i % 3 ? G.glow[2] : G.glow[1]); });
    pxOn(im, 9, 6, G.glow[3]);
    outline(im, 'sel');
    if (id === 'geode_star') { sparkle(im, 3, 4, '#ffe08a'); px(im, 12, 5, '#fff6dc'); }
    else px(im, 4, 5, G.shell[4]);
    return im;
  }
  ['geode_moon', 'geode_ember', 'geode_void', 'geode_star'].forEach(function (id) { def(id, function () { return geodeIcon(id); }); });

  // ---- cracking animation: 6 frames, 32x32, on Ronan's anvil -------------------
  function anvil(im) {
    stamp(im, 1, 22, [
      '..44444444444444444444444444..',
      '4444555555555555555555555543..',
      '.3333333333333333333333333322..',
      '......2222222222222222222.....',
      '........222222222222222.......',
      '........111111111111111.......',
      '......1111111111111111111.....',
      '.....111111111111111111111....',
      '.....000000000000000000000....'
    ], legend(['012345', STONE]));
  }
  function geodeHalf(im, cx, cy, rx, ry, G, side, seed) {
    // one half seen from its open side: thick rocky shell (thicker on the outer side), a ring of
    // crystal points facing inward, and a small glowing heart
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        var dx = (x - cx) / (rx + 0.4), dy = (y - cy) / (ry + 0.4), d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1) continue;
        var c, ix = (x - cx - side * rx * 0.18) / (rx * 0.74), iy = (y - cy) / (ry * 0.78), di = Math.sqrt(ix * ix + iy * iy);
        if (di > 1) c = (dy < -0.2 && dx * side < 0.4) ? G.shell[3] : (dy > 0.45 ? G.shell[1] : G.shell[2]);
        else if (di > 0.34) {
          var a = Math.atan2(iy, ix), sec = Math.floor((a + Math.PI) / (Math.PI / 6));
          var tip = di < 0.52;
          c = tip ? (sec % 2 ? G.cry[3] : G.cry[2]) : (sec % 2 ? G.cry[2] : G.cry[1]);
          if (di > 0.86) c = G.cry[0];
        } else c = di < 0.16 ? G.glow[3] : G.glow[2];
        px(im, x, y, c);
      }
    eachPx(im, function (x, y, c) { if (c === G.shell[2] && hash(x, y, seed) < 0.14) px(im, x, y, G.shell[1]); });
  }
  function geodeFrame(id, f) {
    var G = GEODE[id] || GEODE.geode_moon, im = img(32, 32), x, y;
    anvil(im);
    if (f <= 3) {
      var body = img(32, 32);
      geodeBody(body, 16, 15, 8.4, 7.4, G, 23);
      if (f >= 1) { // crack down the middle
        var crack = [[16, 7], [16, 8], [15, 9], [15, 10], [16, 11], [17, 12], [17, 13], [16, 14], [15, 15], [15, 16], [16, 17], [16, 18], [15, 19], [15, 20], [16, 21]];
        crack.forEach(function (p, i) {
          if (f === 1 && (i < 2 || i > 12)) return;
          pxOn(body, p[0], p[1], f === 1 ? '#0a0610' : (i % 2 ? G.glow[2] : G.glow[3]));
          if (f === 1) pxOn(body, p[0] - 1, p[1], G.shell[4]);
          if (f >= 2 && i % 3 === 0) pxOn(body, p[0] + 1, p[1], G.glow[1]);
        });
      }
      if (f === 3) { // split: halves nudge apart, light seeps out
        var L = img(32, 32), R = img(32, 32);
        eachPx(body, function (x, y, c) { if (x < 16) px(L, x, y, c); else px(R, x, y, c); });
        body = img(32, 32); blit(body, L, -1, 0); blit(body, R, 1, 0);
        for (y = 8; y <= 21; y++) { px(body, 15, y, G.glow[2]); px(body, 16, y, G.glow[3]); }
      }
      outline(body, 'sel');
      blit(im, body, f === 2 ? 1 : 0, 0);    // frame 2 shakes a pixel
      if (f === 2) { px(im, 19, 6, alpha(G.glow[2], 0.8)); px(im, 13, 9, alpha(G.glow[2], 0.6)); }
      if (f === 3) for (y = 1; y < 8; y++) px(im, 16, y, alpha(G.glow[3], 0.15 + y * 0.06));
      return im;
    }
    // halves apart, crystals inside (frame 4) + a small burst of light (frame 5)
    var halves = img(32, 32);
    geodeHalf(halves, 9.5, 15.5, 6.2, 7.0, G, -1, 29);
    geodeHalf(halves, 22.5, 15.5, 6.2, 7.0, G, 1, 31);
    outline(halves, 'sel');
    blit(im, halves, 0, 0);
    if (f === 5) {
      var cx = 16, cy = 11;
      for (var k = 0; k < 8; k++) {
        var ang = k * Math.PI / 4 + Math.PI / 8;
        for (var r = 2; r < 9; r++) px(im, Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r * 0.9), alpha(k % 2 ? G.glow[2] : G.glow[3], 0.75 - r * 0.07));
      }
      sparkle(im, 16, 11, WHITE, true); sparkle(im, 9, 4, G.glow[3]); sparkle(im, 24, 5, G.glow[3]); px(im, 5, 9, G.glow[2]); px(im, 27, 10, G.glow[2]);
    } else { px(im, 9, 15, WHITE); px(im, 22, 15, WHITE); }
    return im;
  }

  // ---- 24 collectible minerals ---------------------------------------------------
  function mineral(fn) { return function () { var im = img(16, 16); fn(im); return im; }; }
  // pointed crystal (prism) from base (x, yb) up to height h, width 3 or 4; R = [dark, mid, light, shine]
  function crystal(im, x, yb, h, R, w) {
    w = w || 3;
    for (var y = yb - h + 1; y <= yb; y++) for (var i = 0; i < w; i++) {
      var top = yb - h + 1;
      if (y === top && (i === 0 || i === w - 1)) continue;          // pointed tip
      px(im, x + i, y, i === 0 ? R[2] : i === w - 1 ? R[0] : (y < top + 2 ? R[3] : R[1]));
    }
  }
  // ---- moon geode
  def('min_lunarite', mineral(function (im) { // pale moon crystals with a crescent inclusion
    var R = ['#5e6ea6', '#9fb0d8', '#d4e2ff', '#ffffff'];
    crystal(im, 3, 12, 6, R); crystal(im, 6, 12, 10, R, 4); crystal(im, 10, 12, 7, R);
    ellipse(im, 7.5, 13, 5.6, 1.6, function (x, y) { return y > 13 ? STONE[1] : STONE[3]; });
    outline(im, 'sel');
    stamp(im, 7, 5, ['.m', 'm.', '.m'], { m: '#8ec8ff' });
    px(im, 7, 3, WHITE); sparkle(im, 13, 3, '#e8eeff');
  }));
  def('min_moonglass', mineral(function (im) { // smooth violet glass pebble holding a tiny moon
    blob(im, 7.5, 8.5, 5.4, 5.0, ['#4a3a8a', '#7a6ac0', '#a89ae0', '#d4ccf6', '#f4f0ff'], { bias: 0.15 });
    outline(im, 'sel');
    stamp(im, 6, 7, ['.ww', 'w..', 'w..', '.ww'], { w: '#fff6dc' });
    px(im, 4, 5, WHITE); px(im, 5, 4, WHITE); px(im, 11, 11, '#e4d2ff');
  }));
  def('min_silvervein', mineral(function (im) { // dark stone shot through with bright silver veins
    var im2 = sprite([
      '................',
      '................',
      '................',
      '.....3444.......',
      '...334443332....',
      '..34433333322...',
      '.3443333332221..',
      '.3433333322221..',
      '.333333222222 1.',
      '.233332222221 1.',
      '..22222222211...',
      '...111111111....',
      '................',
      '................',
      '................',
      '................'
    ].map(function (r) { return r.replace(/ /g, '1'); }), legend(['012345', ['#1e1d2c', '#2e2d40', '#45445a', '#5e5d76', '#7e7d97', '#a09fb6']]));
    blit(im, im2, 0, 1);
    [[3, 8], [4, 8], [5, 9], [6, 9], [7, 8], [8, 8], [9, 9], [10, 10], [11, 10], [6, 6], [7, 7], [9, 6], [10, 5], [8, 10], [7, 11]].forEach(function (p, i) { pxOn(im, p[0], p[1], i % 4 ? '#e2ecff' : WHITE); });
    outline(im, 'sel');
    sparkle(im, 12, 4, WHITE);
  }));
  def('min_moth_fossil', mineral(function (im) { // a moth pressed into a pale slab
    var S = sprite([
      '................',
      '................',
      '..4444444443....',
      '.444444444333...',
      '.4444444443333..',
      '.4444444443333..',
      '.4444444433332..',
      '.4444444333322..',
      '.4444443333222..',
      '.444443333222...',
      '.33333333222....',
      '..2222222.......',
      '................',
      '................',
      '................',
      '................'
    ], legend(['012345', ['#4a4250', '#6e6672', '#948a92', '#b8aeae', '#d8d0c8', '#f2ece6']]));
    blit(im, S, 0, 1);
    stamp(im, 3, 4, [
      'kk...kk',
      'kak.kak',
      'kaakaak',
      '.kakak.',
      'kaakaak',
      'kak.kak',
      '.k...k.'
    ], { k: '#6e5a52', a: '#a8907e' });
    px(im, 6, 6, '#4a3a36'); px(im, 6, 4, '#6e5a52');
    outline(im, 'sel');
  }));
  def('min_tidestone', mineral(function (im) { // sea-blue pebble with white wave bands
    blob(im, 7.5, 8.5, 6.0, 4.8, ['#14305a', '#1e4e86', '#2e72b0', '#4a9ad0', '#8ac8ec'], { bias: 0.1 });
    eachPx(im, function (x, y) {
      var w = y - 8.5 + Math.sin(x * 0.9) * 0.9;
      if (Math.abs(w + 2) < 0.5 || Math.abs(w - 1.2) < 0.5) px(im, x, y, '#e6f6ff');
      else if (Math.abs(w - 3.8) < 0.45) px(im, x, y, '#86dce6');
    });
    outline(im, 'sel');
    px(im, 4, 5, WHITE);
  }));
  def('min_crescent_agate', mineral(function (im) { // a polished agate slice whose bands form a crescent
    var B = ['#3a2a5a', '#6a4a9a', '#9a7ac8', '#c8b0ea', '#f2e8ff', '#7e92cc'];
    for (var y = 1; y < 15; y++) for (var x = 1; x < 15; x++) {
      var dx = x - 7.5, dy = y - 8, d = Math.sqrt(dx * dx * 0.9 + dy * dy);
      if (d > 6.3) continue;
      var d2 = Math.sqrt((x - 9.2) * (x - 9.2) + (y - 7) * (y - 7));
      var band = Math.floor(d2 * 0.85) % 5;
      var c = [B[4], B[3], B[2], B[5], B[1]][band];
      if (d > 5.4) c = B[0];
      px(im, x, y, c);
    }
    outline(im, 'sel');
    px(im, 4, 4, WHITE);
  }));
  // ---- ember geode
  def('min_emberstone', mineral(function (im) { // a smouldering stone with glowing cracks
    blob(im, 7.5, 8.8, 5.8, 5.0, ['#1e0e0e', '#3a1a16', '#5a2a20', '#7a3a26'], { bias: 0.0 });
    [[4, 7], [5, 8], [6, 8], [7, 9], [8, 10], [9, 10], [10, 9], [11, 8], [7, 6], [7, 5], [8, 11], [5, 11], [6, 12]].forEach(function (p, i) { pxOn(im, p[0], p[1], i % 3 ? ORANGE : AMBER); });
    pxOn(im, 7, 9, CANDLE); pxOn(im, 9, 10, '#ffd890');
    outline(im, 'sel');
    px(im, 12, 3, alpha(AMBER, 0.85)); px(im, 3, 4, alpha(ORANGE, 0.7));
  }));
  def('min_phoenix_tear', mineral(function (im) { // a faceted teardrop with a flame inside
    poly(im, [[7.5, 1.5], [11.2, 7], [11.6, 10], [9.6, 13.4], [5.4, 13.4], [3.4, 10], [3.8, 7]], function (x, y) {
      var c = x < 7 ? '#ff8a4a' : '#c4382e';
      if (x === 7) c = '#e85a3a';
      if (y > 10) c = x < 7 ? '#e8603a' : '#8a1e2a';
      if (y < 6) c = x < 8 ? '#ffbc62' : '#e8843c';
      return c;
    });
    stamp(im, 6, 8, ['.y.', 'yYy', 'yYy', '.y.'], { y: '#ffbc62', Y: CANDLE });
    outline(im, 'sel');
    px(im, 6, 4, WHITE); sparkle(im, 13, 3, '#ffd08a');
  }));
  def('min_lava_opal', mineral(function (im) { // black opal flashing red, orange, green and gold
    blob(im, 7.5, 8.5, 5.6, 4.6, ['#120c1c', '#1e1428', '#2e2038', '#40304c'], { bias: 0.0 });
    var F = ['#ff4a3a', '#ff9a3a', '#ffe08a', '#5dd88a', '#4ab0e8'];
    eachPx(im, function (x, y) { var n = hash(x, y, 41); if (n < 0.34 && Math.abs(x - 7.5) < 4.6 && Math.abs(y - 8.5) < 3.6) px(im, x, y, F[Math.floor(n * 15) % 5]); });
    outline(im, 'sel');
    px(im, 4, 6, WHITE); px(im, 5, 5, '#e8eeff');
  }));
  def('min_salamander_fossil', mineral(function (im) { // a little lizard skeleton in rust-red rock
    var S = sprite([
      '................',
      '................',
      '...44444444.....',
      '..4444444443....',
      '.444444444433...',
      '.4444444443333..',
      '.4444444433333..',
      '.4444444333322..',
      '.444443333322...',
      '.33333333222....',
      '..222222221.....',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], legend(['012345', ['#3a1a16', '#5e2a20', '#84402e', '#a85a3e', '#c87a56', '#e8a07a']]));
    blit(im, S, 0, 2);
    stamp(im, 2, 6, [
      '.........b.',
      'bb.....bbBb',
      '.bbbbbbbb..',
      'b.b.b.b.b..',
      '...b...b...'
    ], { b: '#f2e6d4', B: '#3a1a16' });
    outline(im, 'sel');
  }));
  def('min_cinnabar', mineral(function (im) { // blocky vermilion crystals on a pale matrix
    ellipse(im, 7.5, 11, 6.2, 3.0, function (x, y) { return y < 11 ? '#d8d0cc' : '#a8a0a8'; });
    stamp(im, 3, 4, [
      '..RR.....',
      '.RRrr.RR.',
      '.Rrrr.Rrr',
      'RR.rrRRrr',
      'Rrr.rRrrr',
      '.rr..rrr.'
    ], { R: '#ff5a4a', r: '#c4282e' });
    outline(im, 'sel');
    px(im, 5, 5, WHITE); px(im, 10, 6, '#ffb0a0');
  }));
  def('min_smokequartz', mineral(function (im) { // a long smoky quartz point
    var R = ['#2e2420', '#5a4a40', '#8a7666', '#c8b8a8'];
    poly(im, [[8.5, 0.6], [11.4, 3.8], [10.6, 13.6], [5.4, 14], [4.6, 4.6]], function (x, y) { return x < 7 ? R[2] : x < 9 ? R[1] : R[0]; });
    for (var y = 3; y < 14; y++) pxOn(im, 7, y, R[3]);
    outline(im, 'sel');
    px(im, 8, 2, WHITE); px(im, 6, 6, '#e8dcd0');
  }));
  // ---- void geode
  def('min_void_eye', mineral(function (im) { // an eye agate: magenta iris, black pupil, watching
    disc(im, 7.5, 8, 5.6, '#2a2048');
    disc(im, 7.5, 8, 4.4, '#44346a');
    disc(im, 7.5, 8, 3.2, '#e07af0');
    disc(im, 7.5, 8, 2.3, '#9a4ac8');
    disc(im, 7.5, 8, 1.2, '#0c0814');
    outline(im, 'sel');
    px(im, 6, 6, WHITE); px(im, 7, 7, '#ffc8ff'); px(im, 3, 5, '#584a86');
  }));
  def('min_obsidian', mineral(function (im) { // glossy volcanic glass, sharp conchoidal facets
    poly(im, [[3, 12.6], [5, 3.4], [9, 1.4], [12.6, 6], [11.4, 13.4]], function (x, y) {
      var f = (x * 0.9 + y * 0.4) % 4;
      return f < 1.4 ? '#2a2236' : f < 2.6 ? '#120c1c' : '#1e1828';
    });
    outline(im, 'sel');
    [[6, 4], [7, 4], [5, 6], [9, 3], [10, 5]].forEach(function (p, i) { px(im, p[0], p[1], i < 2 ? WHITE : '#9a8ab8'); });
    px(im, 6, 10, '#584a86'); px(im, 9, 11, '#3e3266');
  }));
  def('min_nightglass', mineral(function (im) { // a faceted chunk of night sky
    poly(im, [[2.6, 7], [6, 2.6], [11, 3.4], [13.4, 8.4], [10, 13.4], [4.4, 12.4]], function (x, y) {
      return (x + y < 12) ? '#3a3a9a' : (x - y > 2) ? '#1e1a5a' : '#2a2878';
    });
    [[5, 6], [8, 5], [10, 8], [7, 9], [5, 10], [11, 11], [9, 11]].forEach(function (p, i) { pxOn(im, p[0], p[1], i % 2 ? '#c8c8ff' : WHITE); });
    outline(im, 'sel');
    sparkle(im, 7, 7, WHITE);
  }));
  def('min_ammonite', mineral(function (im) { // a coiled ammonite: ribbed whorls, iridescent sheen
    var C = ['#4a3a5a', '#7a6a8a', '#a898b8', '#d8cce6'];
    for (var y = 1; y < 15; y++) for (var x = 1; x < 15; x++) {
      var dx = x - 7.5, dy = y - 8, r = Math.sqrt(dx * dx + dy * dy);
      if (r > 6.2) continue;
      var a = Math.atan2(dy, dx), turn = (a + Math.PI) / (2 * Math.PI);
      var groove = 2.2 + turn * 2.0;                               // spiral seam between whorls
      var rib = Math.floor((a + Math.PI) / 0.42) % 2;
      var c = r > groove ? (rib ? C[2] : C[1]) : (r > groove - 2.0 ? (rib ? C[3] : C[2]) : C[1]);
      if (Math.abs(r - groove) < 0.5 || r > 5.7) c = C[0];
      if (r < 1.1) c = C[0];
      px(im, x, y, c);
    }
    [[4, 5], [5, 4], [6, 4], [3, 7]].forEach(function (p, i) { pxOn(im, p[0], p[1], ['#7ad4cc', '#c88ae8', '#e8c86a', '#7ad4cc'][i]); });
    outline(im, 'sel');
  }));
  def('min_wraith_opal', mineral(function (im) { // a pale ghost-opal with a wisp curling inside
    blob(im, 7.5, 8.5, 5.0, 5.8, ['#5a8a8a', '#9ac8c4', '#cfeeea', '#f2fffc'], { bias: 0.2 });
    [[6, 11], [5, 10], [5, 9], [6, 8], [7, 8], [8, 9], [8, 10], [7, 6], [9, 5]].forEach(function (p, i) { pxOn(im, p[0], p[1], i < 7 ? '#5dffb0' : '#b4ffd9'); });
    outline(im, 'sel');
    px(im, 5, 4, WHITE); px(im, 12, 12, alpha('#b4ffd9', 0.7)); sparkle(im, 13, 3, '#e6fff6');
  }));
  def('min_hollow_heart', mineral(function (im) { // a dark heart-shaped stone, hollow and glowing inside
    var H = ['#1a1230', '#2e2048', '#463466', '#5e4a86'];
    disc(im, 5, 6, 3.2, H[2]); disc(im, 10, 6, 3.2, H[2]);
    poly(im, [[1.8, 6.6], [13.2, 6.6], [7.5, 14]], H[2]);
    eachPx(im, function (x, y) { if (x + y > 15) px(im, x, y, H[1]); if (x + y < 9) px(im, x, y, H[3]); });
    disc(im, 7.5, 8, 2.0, '#e07af0');
    disc(im, 7.5, 8, 1.0, '#ffc8ff');
    [[6, 7], [9, 9], [7, 10]].forEach(function (p) { px(im, p[0], p[1], '#b05ae0'); });
    outline(im, 'sel');
    px(im, 3, 4, '#8a74b8');
  }));
  // ---- star geode
  def('min_starheart', mineral(function (im) { // brilliant-cut white-gold gem with a star blazing in its heart
    poly(im, [[4, 2.6], [11, 2.6], [13.6, 6], [7.5, 14], [1.4, 6]], function (x, y) {
      if (y <= 5) return x < 6 ? '#fff6dc' : x < 10 ? '#ffe08a' : '#f2c45a';
      return x < 6 ? '#ffe08a' : x < 9 ? '#f2c45a' : '#c88a3a';
    });
    hline(im, 2, 13, 6, '#fff1c8');
    outline(im, 'sel');
    cross(im, 7, 8, WHITE, '#fff6dc');
    sparkle(im, 13, 1, WHITE, true); px(im, 5, 4, WHITE);
  }));
  def('min_comet_glass', mineral(function (im) { // glass drop with a comet frozen inside, tail streaming
    tube(im, [[10.6, 4.6, 3.1], [7.6, 8.4, 2.2], [4.4, 11.6, 1.2], [2.4, 13.6, 0.4]], ['#1e3a6a', '#3a6aa8', '#7ab0e0', '#c8e8ff'], { bias: 0.15 });
    [[10, 5], [9, 6], [8, 7], [7, 8], [6, 9], [5, 10]].forEach(function (p, i) { pxOn(im, p[0], p[1], i < 2 ? WHITE : '#b4faff'); });
    pxOn(im, 11, 4, '#e6fbff');
    outline(im, 'sel');
    sparkle(im, 12, 3, WHITE); px(im, 13, 8, alpha('#b4faff', 0.7));
  }));
  def('min_meteorite', mineral(function (im) { // pitted iron meteorite with a polished, etched face
    blob(im, 7.5, 8.6, 6.0, 5.2, ['#14121c', '#26232e', '#3a3644', '#524c5c', '#6e687a'], { bias: 0.0 });
    eachPx(im, function (x, y) { if (hash(x, y, 51) < 0.16) px(im, x, y, '#0e0c14'); });
    // the cut face shows a criss-cross metal pattern
    for (var y = 7; y <= 11; y++) for (var x = 6; x <= 11; x++) if (A(im, x, y)) px(im, x, y, ((x + 2 * y) % 4 === 0) ? '#dce4f2' : ((x - y + 20) % 5 === 0 ? '#b4bccc' : '#8a92a8'));
    outline(im, 'sel');
    px(im, 4, 5, '#9a94a8'); sparkle(im, 12, 3, '#ff9a4a');
  }));
  def('min_celestite', mineral(function (im) { // sky-blue tabular crystal blades
    var R = ['#3a6aa8', '#7ab4e8', '#b4dcff', '#eaf8ff'];
    crystal(im, 2, 12, 6, R, 4); crystal(im, 6, 12, 9, R, 4); crystal(im, 10, 12, 7, R, 4);
    ellipse(im, 7.5, 13.2, 6.0, 1.4, function (x, y) { return y > 13 ? '#7e7d97' : '#c4c3d6'; });
    outline(im, 'sel');
    px(im, 7, 5, WHITE); px(im, 3, 8, WHITE);
  }));
  def('min_aurora', mineral(function (im) { // a tall crystal shimmering with aurora bands
    poly(im, [[7.5, 0.6], [11.4, 4.4], [11, 14], [4, 14], [3.6, 4.4]], function (x, y) {
      var b = (y + x * 0.35) % 6;
      var c = b < 1.5 ? '#5dffb0' : b < 3 ? '#4ad0d8' : b < 4.5 ? '#8a7ae8' : '#e07af0';
      return x > 9 ? dk(c, 0.3) : c;
    });
    outline(im, 'sel');
    px(im, 6, 3, WHITE); sparkle(im, 13, 6, '#b4ffd9'); px(im, 2, 10, alpha('#e07af0', 0.7));
  }));
  def('min_wishing_stone', mineral(function (im) { // a smooth holed stone glowing with a wish
    blob(im, 7.5, 8.5, 5.8, 5.0, ['#6a5a4a', '#9a8a72', '#c8b896', '#ece0c0'], { bias: 0.1 });
    disc(im, 8.5, 9, 1.6, null);
    outline(im, 'sel');
    // gold glow through the hole + a tiny star
    px(im, 8, 9, alpha('#ffe08a', 0.9)); px(im, 9, 9, alpha('#ffe08a', 0.7)); px(im, 8, 8, alpha('#fff6dc', 0.85));
    sparkle(im, 12, 3, '#ffe08a', true); px(im, 4, 5, WHITE);
  }));

  // ===========================================================================
  // ROUND 3 — blueprints, crafted items, pets & mounts, romance & guild
  // ===========================================================================
  // ---- blueprints: rolled blueprint paper with a tiny white line drawing -------
  function blueprint(drawing, accent) {
    var im = img(16, 16), x, y;
    for (y = 3; y <= 14; y++) for (x = 2; x <= 13; x++) {
      var c = '#2e4f9f';
      if ((x - 2) % 3 === 0 || (y - 3) % 3 === 0) c = '#3a5eb0';
      if (x === 2 || y === 14) c = '#4a72c4';
      if (x === 13) c = '#24408a';
      px(im, x, y, c);
    }
    // curled bottom-right corner
    px(im, 13, 14, null); px(im, 12, 14, '#8ab8f0'); px(im, 13, 13, '#8ab8f0'); px(im, 12, 13, '#c4e2ff');
    // the roll along the top
    for (x = 1; x <= 14; x++) { px(im, x, 1, '#7aa8e8'); px(im, x, 2, '#4a72c4'); px(im, x, 3, '#24408a'); }
    px(im, 1, 2, '#1e3a7a'); px(im, 14, 2, '#1e3a7a'); px(im, 2, 1, '#c4e2ff');
    stamp(im, 4, 5, drawing, { w: '#eaf6ff', c: accent || '#9ad8ff' });
    outline(im, 'sel');
    return im;
  }
  def('bp_sprinkler', function () { return blueprint(['.c....c.', 'c.c..c.c', '...ww...', '..wwww..', '.w.ww.w.', '..w..w..', '.wwwwww.', '........']); });
  def('bp_warp', function () { return blueprint(['..wwww..', '.w....w.', 'w..cc..w', 'w.c..c.w', 'w..c.c.w', 'w....c.w', '.w....w.', '..wwww..']); });
  def('bp_charm', function () { return blueprint(['..ww.ww.', '.wccwccw', '.wccwccw', '..ww.ww.', '.wccwccw', '.wccwccw', '..ww.ww.', '....w...'], '#8af0b0'); });
  def('bp_lamp', function () { return blueprint(['...ww...', '..wccw..', '..wccw..', '...ww...', '....w...', '....w...', '...www..', '..wwwww.'], '#ffe08a'); });
  def('bp_hammer', function () { return blueprint(['wwwwwww.', 'w.c.c.w.', 'wwwwwww.', '...w....', '...w....', '...w....', '...w....', '..www...']); });
  def('bp_scarecrow', function () { return blueprint(['...ww...', '..wccw..', '...ww...', 'wwwwwwww', '...ww...', '..wwww..', '..w..w..', '...ww...'], '#ffe08a'); });
  def('bp_saddle', function () { return blueprint(['........', 'w......w', 'ww....ww', '.wwwwww.', '..wwww..', '..w..w..', '..w..w..', '.ww..ww.']); });
  def('bp_trophy', function () { return blueprint(['wwwwwww.', 'w.wcw.w.', 'w.wcw.w.', '.wwwww..', '..www...', '...w....', '..www...', '.wwwww..'], '#ffe08a'); });

  // ---- crafted items ------------------------------------------------------------
  var BRASS = ['#4a2e1e', '#8a5a2a', '#c08a3a', '#e8b860', '#fff1c8'];
  def('dew_sprinkler', function () { // brass sprinkler topped with a little dew crystal
    var im = sprite([
      '................',
      '................',
      '.......c........',
      '......cCc.......',
      '......cCd.......',
      '.......d........',
      '.......k........',
      '.....bbkbb......',
      '..n.bBBBBBb.n...',
      '..nnBBBBBBBbnn..',
      '...bBBBBBBBb....',
      '...bbbbbbbbb....',
      '....aaaaaaa.....',
      '................',
      '................',
      '................'
    ], { c: '#69a1db', C: '#c4e6ff', d: '#2e4f9f', k: BRASS[2], b: BRASS[1], B: BRASS[3], n: BRASS[2], a: BRASS[0] });
    outline(im, 'sel');
    px(im, 6, 3, WHITE); [[1, 6], [14, 6], [3, 4], [12, 4]].forEach(function (p) { px(im, p[0], p[1], alpha('#8ec8f4', 0.85)); });
    return im;
  });
  def('warp_rune', function () { // slate tablet carved with a glowing spiral
    var im = sprite([
      '................',
      '................',
      '....3444443.....',
      '...344444443....',
      '...344444432....',
      '...344444332....',
      '...344443332....',
      '...344433332....',
      '...344333322....',
      '...343333322....',
      '...333333222....',
      '...233332222....',
      '....2222221.....',
      '................',
      '................',
      '................'
    ], legend(['012345', STONE]));
    for (var t = 0; t < 36; t++) { var a = t * 0.42, r = 0.3 + t * 0.09; pxOn(im, Math.round(7.4 + Math.cos(a) * r), Math.round(7.4 + Math.sin(a) * r * 1.2), t < 12 ? '#e6fbff' : '#7ef0ff'); }
    outline(im, 'sel');
    sparkle(im, 12, 2, '#b4faff');
    return im;
  });
  def('lucky_charm', function () { // four-leaf clover charm in a gold ring, on a red cord
    var im = img(16, 16);
    disc(im, 7.5, 9, 5.2, GOLD[3]);
    disc(im, 7.5, 9, 4.2, '#fff6e0');
    [[5.9, 7.4], [9.1, 7.4], [5.9, 10.6], [9.1, 10.6]].forEach(function (c) { blob(im, c[0], c[1], 1.6, 1.6, ['#1e8a4a', '#3cbf6e', '#7eeaa0']); });
    px(im, 7, 9, '#1e6a3a'); px(im, 8, 9, '#1e6a3a'); px(im, 8, 12, '#1e6a3a'); px(im, 9, 13, '#1e6a3a');
    outline(im, 'sel');
    // cord loop
    [[5, 3], [6, 2], [7, 1], [8, 1], [9, 2], [10, 3]].forEach(function (p) { px(im, p[0], p[1], '#c4282e'); });
    px(im, 4, 6, GOLD[5]); sparkle(im, 13, 4, '#ffe08a');
    return im;
  });
  def('moonlit_lamp', function () { // a little lamp whose glass globe holds a crescent moon
    var im = img(16, 16);
    disc(im, 7.5, 5.5, 4.2, '#c8d4f0');
    disc(im, 7.5, 5.5, 3.2, '#e8eeff');
    stamp(im, 6, 3, ['.mm', 'm..', 'm..', '.mm'], { m: '#ffe08a' });
    stamp(im, 4, 9, [
      '..bbbb..',
      '...BB...',
      '...BB...',
      '...bB...',
      '.bBBBBb.',
      'bbbbbbbb'
    ], { b: BRASS[1], B: BRASS[3] });
    outline(im, 'sel');
    px(im, 5, 3, WHITE); px(im, 1, 4, alpha('#ffe08a', 0.6)); px(im, 14, 6, alpha('#ffe08a', 0.6));
    return im;
  });
  def('geode_hammer', function () { // diagonal rock hammer with an amethyst-studded head
    var im = sprite([
      '................',
      '.........3......',
      '........344.....',
      '.......3445m....',
      '........45mM4...',
      '.......c.4m443..',
      '......cb..4443..',
      '.....cb....33...',
      '....cb..........',
      '...cb...........',
      '..cb............',
      '.cb.............',
      'ab..............',
      '................',
      '................',
      '................'
    ], legend(['012345', STONE], { m: MV[2], M: MV[4], c: WOOD[4], b: WOOD[2], a: WOOD[1] }));
    outline(im, 'sel');
    px(im, 10, 3, WHITE);
    return im;
  });
  def('moon_scarecrow', function () { // moon-headed scarecrow holding a lantern
    var im = sprite([
      '......mmm.......',
      '.....mMMmm......',
      '.....mMkmk......',
      '.....mMMmm......',
      '......mmm.......',
      '..www.rrr.www...',
      '.ww.wrRRRrw.ww..',
      '....wrRRRrw..l..',
      '.....rRRRr..lLl.',
      '.....rrrrr..lLl.',
      '......wpw....l..',
      '.......p........',
      '.......p........',
      '.......p........',
      '......ppp.......',
      '................'
    ], { m: '#c8d4f0', M: '#f2f6ff', k: '#4a5280', w: '#e8c070', r: '#5a3a5a', R: '#7a5478', p: WOOD[3], l: STONE[3], L: AMBER });
    outline(im, 'sel');
    px(im, 13, 8, CANDLE); px(im, 15, 8, alpha(AMBER, 0.6));
    return im;
  });
  def('trophy_case', function () { // glass-fronted cabinet showing bounty trophies
    var im = sprite([
      '................',
      '..wwwwwwwwwwww..',
      '..wWWWWWWWWWWw..',
      '..wggggggggggw..',
      '..wgyyg.gcCgw...',
      '..wgYyg.gccgw...',
      '..wggggggggggw..',
      '..wWWWWWWWWWWw..',
      '..wgsSg.gvVgw...',
      '..wgSsg.gvvgw...',
      '..wggggggggggw..',
      '..wWWWWWWWWWWw..',
      '..wwwwwwwwwwww..',
      '..dd........dd..',
      '................',
      '................'
    ], { w: WOOD[3], W: WOOD[2], d: WOOD[1], g: '#3a4a6a', y: GOLD[3], Y: GOLD[4], c: '#5dd88a', C: '#b4ffd9', s: '#d8d0cc', S: '#f2ece6', v: MV[2], V: MV[4] });
    // fix the right column of the glass rows
    [4, 5, 8, 9].forEach(function (y) { px(im, 12, y, '#3a4a6a'); px(im, 13, y, WOOD[3]); });
    outline(im, 'sel');
    px(im, 3, 4, '#8aa8d8'); px(im, 3, 8, '#8aa8d8');
    return im;
  });
  def('lucky_rune', function () { // pale rune stone with a glowing golden clover-star
    var im = img(16, 16);
    blob(im, 7.5, 8.5, 5.4, 5.6, ['#5e7a6a', '#8eaa96', '#bcd4c0', '#e4f2e6'], { bias: 0.1 });
    stamp(im, 5, 6, [
      '..y..',
      '.yYy.',
      'yYWYy',
      '.yYy.',
      '..y..'
    ], { y: GOLD[3], Y: '#ffe08a', W: WHITE });
    outline(im, 'sel');
    sparkle(im, 12, 2, '#ffe08a'); px(im, 4, 4, WHITE);
    return im;
  });

  // ---- pet & mount items -----------------------------------------------------------
  def('pet_treat', function () { // heart-shaped biscuit with pink icing
    var im = img(16, 16);
    disc(im, 5.2, 6.4, 3.2, '#d89a4a'); disc(im, 9.8, 6.4, 3.2, '#d89a4a');
    poly(im, [[2, 7], [13, 7], [7.5, 13.4]], '#d89a4a');
    eachPx(im, function (x, y) { if (x + y > 16) px(im, x, y, '#b0702e'); if (x + y < 9) px(im, x, y, '#f2c47a'); });
    disc(im, 5.6, 6.8, 1.4, '#f4a6c8'); disc(im, 9.4, 6.8, 1.4, '#f4a6c8'); poly(im, [[4.4, 7.4], [10.6, 7.4], [7.5, 10.6]], '#f4a6c8');
    [[4, 9], [11, 8], [7, 12], [9, 11]].forEach(function (p) { px(im, p[0], p[1], ['#7ef0ff', '#ffe08a', WHITE, '#b99aee'][p[0] % 4]); });
    outline(im, 'sel');
    px(im, 5, 6, WHITE);
    return im;
  });
  def('pet_toy', function () { // a ball of violet yarn with a little bell
    var im = img(16, 16);
    blob(im, 7, 8, 5.2, 5.2, ['#3a1a52', '#6a3a9a', '#9a6ad0', '#c8a0f0']);
    for (var t = -5; t <= 5; t++) { pxOn(im, 7 + t, 8 + Math.round(t * 0.5), '#e0c0f4'); pxOn(im, 7 + Math.round(t * 0.4), 8 + t, '#5a2a7a'); }
    outline(im, 'sel');
    [[12, 11], [13, 12], [14, 13], [13, 14]].forEach(function (p) { px(im, p[0], p[1], '#b47ad6'); });
    stamp(im, 9, 1, ['.y.', 'yYy', 'yyy'], { y: GOLD[3], Y: GOLD[5] });
    return im;
  });
  function saddle(L, D, trim, emblem) { // side view: high cantle, dipping seat, horn, flap and stirrup
    var im = sprite([
      '................',
      '................',
      '..cc.........h..',
      '..cLc.......hH..',
      '..cLLc.....cLc..',
      '...cLLc...cLLc..',
      '...cLLLcccLLLc..',
      '..tLLLLLLLLLLLt.',
      '..tttttttttttt..',
      '...FFFFFFFFFF...',
      '...FFFFFFFFFF...',
      '....FFFFFFFF....',
      '......s.........',
      '.....sSs........',
      '.....s.s........',
      '................'
    ], { c: D, L: L, h: L, H: lt(L, 0.3), t: trim, F: dk(L, 0.28), s: STONE[4], S: STONE[2] });
    if (emblem) emblem(im);
    outline(im, 'sel');
    return im;
  }
  def('saddle_swift', function () { return saddle('#9a663e', '#5e3a26', GOLD[3], function (im) { stamp(im, 7, 9, ['w.w', 'www', '.w.'], { w: '#e8eeff' }); }); });
  def('saddle_starlit', function () {
    var im = saddle('#3a4488', '#1c2248', '#c8d4f0', function (im) { [[5, 9], [9, 10], [11, 9], [7, 6]].forEach(function (p) { px(im, p[0], p[1], WHITE); }); });
    sparkle(im, 13, 2, WHITE); px(im, 6, 4, '#8a96e0');
    return im;
  });
  def('dragon_harness', function () { // coiled straps, iron rings and an amethyst buckle
    var im = img(16, 16);
    ellipse(im, 7.5, 8, 6.2, 5.0, '#6a3a26'); ellipse(im, 7.5, 8, 4.2, 3.0, null);
    eachPx(im, function (x, y) { if (y < 6 || x < 4) px(im, x, y, '#8a5a3a'); });
    [[2, 8], [13, 8], [7, 3]].forEach(function (p) { disc(im, p[0], p[1], 1.1, STONE[4]); px(im, p[0], p[1], STONE[1]); });
    stamp(im, 6, 11, ['gggg', 'gMmg', 'gggg'], { g: STONE[3], M: MV[4], m: MV[2] });
    [[4, 4], [11, 4], [4, 12], [11, 12]].forEach(function (p) { px(im, p[0], p[1], STONE[5]); });
    outline(im, 'sel');
    return im;
  });
  def('silver_whistle', function () { // silver whistle on a blue cord
    var im = sprite([
      '................',
      '................',
      '................',
      '................',
      '................',
      '......SSSSSSSs..',
      '.....SsssssssS..',
      '..SSSsssssssss..',
      '.SssSsssssssss..',
      '.SsssS.sssssss..',
      '.SsssS..ssssss..',
      '..SSS...........',
      '................',
      '................',
      '................',
      '................'
    ], { S: '#e2ecff', s: '#9fb0d8' });
    px(im, 8, 9, OUT); px(im, 7, 8, '#4a5280');
    outline(im, 'sel');
    [[12, 4], [11, 3], [9, 2], [7, 2], [5, 3], [4, 4], [3, 6]].forEach(function (p) { px(im, p[0], p[1], '#4a6ab8'); });
    px(im, 4, 8, WHITE);
    return im;
  });
  // pet portraits (tiny faces)
  function face(rows, leg, post) { var im = sprite(rows, leg); outline(im, 'sel'); if (post) post(im); return im; }
  def('pet_kitten', function () { // moon kitten: lavender-grey, crescent on the brow
    return face([
      '................',
      '..f.........f...',
      '..ff.......ff...',
      '..fpf.....fpf...',
      '..fFFFFmFFFFf...',
      '..FFFFFmmFFFF...',
      '.FFFFFFFFFFFFF..',
      '.FFeEFFFFFeEFF..',
      '.FFeeFFFFFeeFF..',
      '.wFFFFFnFFFFFw..',
      '..FFFFfnfFFFF...',
      '..wFFFFFFFFFw...',
      '....FFFFFFF.....',
      '................',
      '................',
      '................'
    ], { f: '#8a86a8', F: '#b4b0cc', p: '#f4a6c8', m: '#fff1c8', e: '#5dd88a', E: '#e6fff2', n: '#e89ab8', w: '#e8eeff' });
  });
  def('pet_puppy', function () { // shadow pup: dark coat, long floppy ears, pale muzzle, tongue out
    return face([
      '................',
      '................',
      '....FFFFFFF.....',
      '..dFFFFFFFFFd...',
      '.ddFFFFFFFFFdd..',
      '.dDFFFFFFFFFDd..',
      '.dDFeEFFFeEFDd..',
      '.dDFeeFFFeeFDd..',
      '.dD.FFmmmFF.Dd..',
      '..d.FmmnmmF.d...',
      '....FmmmmmF.....',
      '.....mmttm......',
      '.......t........',
      '................',
      '................',
      '................'
    ], { d: '#1e1828', D: '#2e2640', F: '#4a3e60', m: '#7a6e90', e: '#7ef0ff', E: WHITE, n: '#120c1c', t: '#e8608a' });
  });
  def('pet_bunny', function () { // lop bunny: cream face, drooping ears
    return face([
      '................',
      '................',
      '....FFFFFFFF....',
      '...FFFFFFFFFF...',
      '.ll.FFFFFFFF.ll.',
      '.lLlFFFFFFFFlLl.',
      '.lLlFeFFFFeFlLl.',
      '.lLlFEFFFFEFlLl.',
      '.lLl.FFFFFF.lLl.',
      '..ll.FFnnFF.ll..',
      '.....FFwwFF.....',
      '......FFFF......',
      '................',
      '................',
      '................',
      '................'
    ], { F: '#f2e6d0', l: '#a8784e', L: '#e8b0a0', e: '#3a2216', E: '#120c1c', n: '#e89ab8', w: WHITE });
  });
  def('pet_hatchling', function () { // baby dragon peeking out with an eggshell cap
    return face([
      '................',
      '.....sSSSs......',
      '....sSSsSSs.....',
      '...sSs.s.sSs....',
      '...hGGGGGGh.....',
      '..GGGGGGGGGG....',
      '..GeEGGGGeEG....',
      '..GeeGGGGeeGG...',
      '..GGGGGGGGGGGG..',
      '...GGGnGGnGGGG..',
      '...GGGGGGGGGG...',
      '....bbbbbbbb....',
      '....s.sSs.s.....',
      '...sSSsSSsSs....',
      '................',
      '................'
    ], { s: '#e8e0d0', S: '#fff6e8', h: '#f2c45a', G: '#3cbf8a', e: '#120c1c', E: '#fff1c8', n: '#1e6a56', b: '#b4ffd9' });
  });
  def('pet_crystalfox', function () { // crystal fox: faceted cyan-violet fur, glowing eyes
    return face([
      '................',
      '.a...........a..',
      '.aA.........Aa..',
      '.aAb.......bAa..',
      '.aAbbbbbbbbbAa..',
      '..bBBbbbbbBBb...',
      '..bBeEbbbeEBb...',
      '..bbeebbbeebb...',
      '...bbbbbbbbb....',
      '....wwbbbww.....',
      '.....wwnww......',
      '......www.......',
      '................',
      '................',
      '................',
      '................'
    ], { a: '#8f6cd1', A: '#e4d2ff', b: '#7ad4e8', B: '#c8f6ff', e: '#e07af0', E: WHITE, w: '#eaf8ff', n: '#4a2f7a' }, function (im) { sparkle(im, 13, 9, '#c8f6ff'); px(im, 4, 9, WHITE); });
  });
  // mount medallions: gold rim, night-blue field, head of the animal in its colour
  function medallion(head, leg) {
    var im = img(16, 16);
    disc(im, 7.5, 7.5, 6.6, function (x, y, dx, dy) { return dx + dy < -0.3 ? GOLD[4] : dx + dy < 0.5 ? GOLD[3] : GOLD[2]; });
    disc(im, 7.5, 7.5, 5.4, function (x, y, dx, dy) { return dx + dy < 0 ? '#2a2e5a' : '#1c1e40'; });
    stamp(im, 3, 3, head, leg);
    outline(im, 'sel');
    px(im, 4, 2, GOLD[5]);
    return im;
  }
  var HORSE = [
    '....ee....',
    '...eHHm...',
    '...HHHHm..',
    '..HHEHHHm.',
    '..HHHHHHmm',
    '.HHHHHHHmm',
    '.HHHHHH.mm',
    'HHHHn....m',
    'HHHH......'
  ];
  def('horse_midnight', function () { return medallion(HORSE, { e: '#2e3670', H: '#3a4280', E: '#c8d4f0', m: '#0e1028', n: '#1c2248' }); });
  def('horse_silver', function () { var im = medallion(HORSE, { e: '#c4c8de', H: '#d8dcec', E: '#2e2640', m: '#ffffff', n: '#9aa2bc' }); [[6, 8], [5, 10], [4, 9]].forEach(function (p) { pxOn(im, p[0], p[1], '#9aa2bc'); }); return im; });
  def('horse_chestnut', function () { var im = medallion(HORSE, { e: '#8a4426', H: '#b05a32', E: '#2a1416', m: '#5e2a1a', n: '#7a3a22' }); pxOn(im, 6, 4, WHITE); pxOn(im, 5, 5, WHITE); return im; });
  var DRAGON = [
    'h......h..',
    '.hh...hh..',
    '..DDDDD...',
    '.DDEDDDD..',
    '.DDDDDDDDd',
    '.DDDDDDDdd',
    'sDDDtDDD..',
    'sDDDDtt...',
    '.sDDD.....'
  ];
  def('dragon_amethyst', function () { return medallion(DRAGON, { h: '#e4d2ff', D: MV[2], d: MV[1], E: '#ffe08a', s: MV[0], t: '#4a2f7a' }); });
  def('dragon_emerald', function () { return medallion(DRAGON, { h: '#d4ffe4', D: '#2fbf7f', d: '#1e8a5e', E: '#ffe08a', s: '#0f4a3a', t: '#14603e' }); });
  def('dragon_ember', function () { var im = medallion(DRAGON, { h: '#fff1c8', D: '#e8603a', d: '#c4382e', E: '#fff1c8', s: '#8a1e2a', t: '#8a2a32' }); px(im, 13, 7, alpha(AMBER, 0.9)); return im; });

  // ---- romance -----------------------------------------------------------------------
  def('bouquet', function () { // moonflower bouquet in violet paper with a ribbon
    var im = img(16, 16);
    poly(im, [[3.4, 7], [11.6, 7], [8.4, 14.6], [6.6, 14.6]], function (x) { return x < 7 ? MV[3] : MV[2]; });
    var F = img(16, 16);
    [[4, 4], [7, 2], [10, 4], [6, 6], [9, 6]].forEach(function (c) {
      stamp(F, c[0] - 1, c[1] - 1, ['.w.', 'wcw', '.w.'], { w: '#e8eeff', c: '#c4e6ff' });
      px(F, c[0], c[1], '#fff6dc');
    });
    stamp(F, 2, 6, ['g', 'g'], { g: FG[4] }); stamp(F, 12, 6, ['g', 'g'], { g: FG[4] });
    outline(F, 'sel');
    blit(im, F, 0, 0);
    stamp(im, 5, 9, ['rRRRr', '.r.r.'], { r: ROSE[1], R: ROSE[2] });
    outline(im, 'sel');
    sparkle(im, 13, 1, '#e8eeff'); px(im, 2, 2, alpha('#c4e6ff', 0.8));
    return im;
  });
  def('pendant', function () { // moonstone teardrop in a silver claw setting
    var im = img(16, 16);
    poly(im, [[7.5, 5.4], [11, 10], [9.6, 13.6], [5.4, 13.6], [4, 10]], '#9aa2bc');
    poly(im, [[7.5, 6.6], [10, 10.2], [9, 12.6], [6, 12.6], [5, 10.2]], function (x, y) { return (x + y < 17) ? '#e8eeff' : '#a8c8f0'; });
    px(im, 7, 9, '#8ec8ff'); px(im, 8, 10, '#c4e6ff');
    px(im, 7, 4, '#c4c8de'); px(im, 8, 4, '#9aa2bc');
    outline(im, 'sel');
    [[6, 3], [5, 2], [4, 1], [9, 3], [10, 2], [11, 1]].forEach(function (p, i) { px(im, p[0], p[1], i % 2 ? '#7e8aa6' : '#c4c8de'); });
    px(im, 6, 8, WHITE); sparkle(im, 13, 9, '#c4e6ff');
    return im;
  });
  def('contract', function () { // guild contract: parchment, target sketch, red wax seal
    var im = sprite([
      '................',
      '...pPPPPPPPPp...',
      '...PllllllllP...',
      '...PPPPPPPPPP...',
      '...PllllPPPPP...',
      '...PPPPPPPPPP...',
      '...PPkkkPPPPP...',
      '...PkPkPkPPPP...',
      '...PPkkkPPPPP...',
      '...PPPPPPlllP...',
      '...PllllPPPPP...',
      '...PPPPPPPPPP...',
      '...pPPPPPPPPp...',
      '................',
      '................',
      '................'
    ], { p: '#c8a878', P: '#ecd4a8', l: '#8a6a4a', k: '#5a3a2a' });
    stamp(im, 9, 10, ['.rr.', 'rRrr', 'rrRr', '.rr.', 'q..q'], { r: '#a8202a', R: '#e04a4a', q: '#7a1a22' });
    outline(im, 'sel');
    px(im, 10, 11, '#ffb0a0');
    return im;
  });

  // ---- guild rank badges: crescent medal on a ribbon, 1-4 stars ----------------------
  function guildBadge(M, stars, glow) {
    var im = img(16, 16);
    stamp(im, 4, 0, ['vVVVVvv.', 'vVsVVsv.', '.vVVVv..', '..vvv...'], { v: '#3a2a5a', V: '#5a4a8a', s: '#c8d4f0' });
    disc(im, 7.5, 9.5, 5.2, function (x, y, dx, dy) { return dx + dy < -0.3 ? M[3] : dx + dy < 0.5 ? M[2] : M[1]; });
    disc(im, 7.5, 9.5, 3.9, M[2]);
    stamp(im, 5, 7, ['.mm.', 'm...', 'm...', 'm...', '.mm.'], { m: M[4] });
    stamp(im, 6, 8, ['..', '.k', '.k', '..'], { k: M[0] });
    outline(im, 'sel');
    for (var i = 0; i < stars; i++) px(im, 9 + (i % 2), 8 + Math.floor(i / 2) * 2 + (i % 2), M[4]);
    if (glow) { sparkle(im, 13, 5, WHITE); px(im, 2, 12, alpha('#c4e6ff', 0.8)); }
    return im;
  }
  def('guild_badge_1', function () { return guildBadge(['#3a1e1a', '#7a3e2a', '#b0643a', '#d88a5a', '#f6c49a'], 1); });
  def('guild_badge_2', function () { return guildBadge(['#2e2c3e', '#605f78', '#a09fb6', '#d4d4e4', '#ffffff'], 2); });
  def('guild_badge_3', function () { return guildBadge([GOLD[0], GOLD[1], GOLD[2], GOLD[4], GOLD[5]], 3); });
  def('guild_badge_4', function () { return guildBadge(['#1e2a5a', '#4a6aa8', '#8ec8f4', '#d6f2ff', '#ffffff'], 4, true); });

  // ---- bounty trophies (wall plaques) ---------------------------------------------------
  function plaque(im) {
    stamp(im, 2, 3, [
      '.gggggggggg.',
      'gPPPPPPPPPPg',
      'gPppppppppPg',
      'gPppppppppPg',
      'gPppppppppPg',
      'gPppppppppPg',
      'gPppppppppPg',
      '.gPpppppppg.',
      '..gPpppPgg..',
      '...ggPPgg...',
      '.....gg.....'
    ], { g: GOLD[2], P: WOOD[3], p: WOOD[2] });
  }
  function trophy(fn) { return function () { var im = img(16, 16); plaque(im); fn(im); outline(im, 'sel'); return im; }; }
  def('trophy_gloopgarr', trophy(function (im) { // the dented crown, still slimy
    stamp(im, 3, 4, [
      'y..y..y...',
      'yy.yy.yy..',
      'yYyyYyyy..',
      'yyyyyyyyy.',
      '.ssyyyss..',
      '..s...s...'
    ].map(function (r) { return (r + '..').slice(0, 10); }), { y: GOLD[3], Y: GOLD[5], s: '#5dffb0' });
    px(im, 6, 6, '#c88a3a'); px(im, 9, 8, '#2fbf7f');
  }));
  def('trophy_grimjaw', trophy(function (im) { // the scarred alpha wolf's head
    stamp(im, 3, 3, [
      '.e......e.',
      '.ee....ee.',
      '.eGGGGGGe.',
      'GGGGGGGGGG',
      'GGkGGGGkGG',
      'GGGGrGGGGG',
      '.GGGrGGGG.',
      '..GwnnwG..',
      '...wGGw...'
    ], { e: '#4a6a4a', G: '#6e8a6a', k: '#ffe08a', r: '#c4485a', n: '#1e1828', w: WHITE });
    px(im, 4, 6, '#90a08a');
  }));
  def('trophy_lantern', trophy(function (im) { // the Lantern Thief's wisp lantern
    stamp(im, 5, 3, [
      '..kk..',
      '.k..k.',
      'kkkkkk',
      '.bccb.',
      '.bCcb.',
      '.bccb.',
      'kkkkkk'
    ], { k: BRASS[2], b: BRASS[1], c: '#5ee0d0', C: '#e6fff6' });
    px(im, 3, 7, alpha('#5ee0d0', 0.8)); px(im, 12, 6, alpha('#5ee0d0', 0.8));
  }));
  def('trophy_wyrm', trophy(function (im) { // a crystal fang of Vorrakh the Deep Wyrm
    stamp(im, 5, 3, [
      'bbbbbb',
      '.vVVv.',
      '.vVVv.',
      '..vVv.',
      '..vV..',
      '..vv..',
      '...v..'
    ], { b: '#e8e0d0', v: MV[2], V: '#e4d2ff' });
    px(im, 7, 5, WHITE);
  }));
  def('lore_page', function () { // a torn, inked page with a little moon sketch and a glowing rune
    var im = sprite([
      '................',
      '..pPPpPPPPPp....',
      '..PllllllPPPp...',
      '..PPPPPPPPPPP...',
      '..PlllllPlllP...',
      '..PPPPPPPPPPP...',
      '..PllPkkPllPP...',
      '..PPPkPPkPPPP...',
      '..PllkPPkllPP...',
      '..PPPPkkPPPPP...',
      '..PllllPlllPP...',
      '..PPPPPPPPPPp...',
      '...PpPPpPPp.....',
      '.....p..p.......',
      '................',
      '................'
    ], { p: '#c8a878', P: '#ecd4a8', l: '#8a6a4a', k: '#4a6ab8' });
    outline(im, 'sel');
    px(im, 11, 10, '#7ef0ff'); px(im, 10, 9, '#b4faff');
    return im;
  });

  // ---- the Starforged Blade: the best sword in the valley ---------------------------------
  def('sword_starforged', function () {
    var im = sprite([
      '..............W.',
      '.............WC.',
      '............WCD.',
      '...........WCDD.',
      '..........WCDD..',
      '.........WCDD...',
      '....G...WCDD....',
      '....GGgWCDD.....',
      '.....GgWCD......',
      '......gsgD......',
      '.....hHggG......',
      '....hh..GG......',
      '..PPh....G......',
      '..PP............',
      '................',
      '................'
    ], { W: '#eaf6ff', C: '#7ef0ff', D: '#2e4f9f', G: GOLD[4], g: GOLD[2], s: '#c8f8ff', h: '#24285a', H: '#4c5ea6', P: GOLD[3] });
    outline(im, 'sel');
    // star pommel, starlight along the blade
    cross(im, 2, 13, WHITE, GOLD[4]);
    sparkle(im, 11, 3, WHITE, true); px(im, 13, 0, WHITE); px(im, 9, 6, WHITE); px(im, 7, 8, '#ffe08a');
    [[12, 6], [14, 5], [6, 4]].forEach(function (p) { px(im, p[0], p[1], alpha('#7ef0ff', 0.55)); });
    return im;
  });

  // ===========================================================================
  // Crops — 16x32, stage 0..4, base at bottom-centre (stem enters soil ~y27/28)
  // ===========================================================================
  var CROPS = Object.create(null), REGROW = Object.create(null);
  var PL = { d: FG[2], m: FG[3], l: FG[4], h: FG[5], s: FG[3], S: FG[2] };
  function plantLeg(extra) { var o = {}, k; for (k in PL) o[k] = PL[k]; for (k in extra) o[k] = extra[k]; return o; }
  // draw stamp rows at (0,y0) on a fresh 16x32, ground shadow + outline
  function plant(rows, y0, leg, o) {
    o = o || {};
    var im = img(16, 32);
    if (o.pre) o.pre(im);
    stamp(im, o.x0 || 0, y0, rows, leg);
    if (o.mid) o.mid(im);
    outline(im, 'sel');
    groundShadow(im, o.shadow == null ? 3 : o.shadow);
    if (o.post) o.post(im);
    return im;
  }
  // soft planting shadow / mound under the plant, only behind existing pixels
  function behind(im, x, y, c) { if (!A(im, x, y)) px(im, x, y, c); }
  function groundShadow(im, w) {
    if (!w) return;
    for (var x = 8 - w - 1; x <= 7 + w + 1; x++) behind(im, x, 28, alpha(SOIL[0], 0.85));
    for (var x2 = 8 - w; x2 <= 7 + w; x2++) behind(im, x2, 29, alpha(SOIL[0], 0.55));
  }
  // planting mound for fresh seeds
  var MOUND = ['..pOOp..', '.pOOOOo.', 'oooooooo'];
  var MOUND_LEG = { p: SOIL[3], O: SOIL[2], o: SOIL[0] };
  function mound(im) { stamp(im, 4, 26, MOUND, MOUND_LEG); }

  // ---------------------------------------------------------------- moonpetal
  var PETAL = { a: '#d4e4ff', b: '#a8c0ec', c: '#7c90cc', e: '#55609e', W: WHITE, w: '#eef4ff' };
  CROPS.moonpetal = function (st) {
    var leg = plantLeg(PETAL);
    if (st === 0) return plant([
      '......l..l......',
      '.....lmsml......',
      '.......s........',
      '.......s........'
    ], 23, leg, { pre: mound, shadow: 0 });
    if (st === 1) return plant([
      '........h.......',
      '.......lm.......',
      '.......s........',
      '....hl.s........',
      '.....mms........',
      '.......s.lh.....',
      '.......smm......',
      '.......s........'
    ], 20, leg, { pre: mound, shadow: 0 });
    if (st === 2) return plant([
      '........h.......',
      '.......lm.......',
      '.......s........',
      '...hl..s........',
      '....mmms........',
      '.......s..lh....',
      '.......s.mmd....',
      '...hl..sm.......',
      '....mmms........',
      '.......s.lh.....',
      '.......smm......'
    ], 17, leg);
    if (st === 3) return plant([
      '.......a........',
      '......abb.......',
      '......abc.......',
      '......bcc.......',
      '.......l........',
      '.......s........',
      '...hl..s........',
      '....mmms........',
      '.......s..lh....',
      '.......s.mmd....',
      '...hl..sm.......',
      '....mmms........',
      '.......s..lh....',
      '.......s.mmd....',
      '.......sm.......'
    ], 13, leg);
    return plant([
      '......abb.......',
      '......abc.......',
      '...aabbbcabb....',
      '...abcwWwbbc....',
      '...bccWWwbcc....',
      '......wwc.......',
      '....abb.abc.....',
      '....bbc.bcc.....',
      '....ccdsccd.....',
      '.......s...ab...',
      '.......s..abc...',
      '...hl..s..bc....',
      '....mmms.ls.....',
      '.......sml......',
      '.......s..lh....',
      '.......s.mmd....',
      '...hl..sm.......',
      '....mmms........',
      '.......s........',
      '.......s........'
    ], 8, leg, { post: function (im) { px(im, 7, 11, WHITE); } });
  };

  // ---------------------------------------------------------------- glowcap
  var CAP = { 5: ICE[4], 4: ICE[3], 3: ICE[2], v: MV[1], V: MV[2], x: MV[3], S: '#e8eeff', t: '#c8d4f0', T: '#9fb0d8', W: WHITE };
  CROPS.glowcap = function (st) {
    var leg = plantLeg(CAP);
    if (st === 0) return plant([
      '.....S...S......',
      '.....t..St......'
    ], 25, leg, { pre: mound, shadow: 0 });
    if (st === 1) return plant([
      '....xV....xV....',
      '....vv....vv....',
      '....St...St.....',
      '.....t....t.....'
    ], 23, leg, { pre: mound, shadow: 0 });
    if (st === 2) return plant([
      '.......4x.......',
      '......4xVv......',
      '..xV..vvvv......',
      '..vv...St..4x...',
      '..St...St.4xVv..',
      '...t...St..vvv..',
      '...t...St...St..',
      '.......St...tT..'
    ], 20, leg);
    if (st === 3) return plant([
      '.......54.......',
      '......5443......',
      '......4433......',
      '......VVvv......',
      '..54...St.......',
      '.5443..St..54...',
      '.vvvv..St.5443..',
      '..St...St.vvvv..',
      '..St...St..St...',
      '..St...St..St...',
      '..tT..SStT.tT...'
    ], 17, leg);
    return plant([
      '......5555......',
      '.....45W554.....',
      '....4555W554....',
      '....34444443....',
      '....vVVvvvvv....',
      '.......St.......',
      '.555...St..555..',
      '45W54..St.45W54.',
      '34443..St.34443.',
      'vVvvv..St.vVvvv.',
      '.St....St...St..',
      '.St...SSt...St..',
      '.St..55St...St..',
      '.tT.4554t...tT..',
      '.tT.vvvvt..SttT.',
      '....SSStT.......'
    ], 12, leg);
  };

  // ---------------------------------------------------------------- mandrake
  var MAN = { d: FG[1], m: FG[2], l: FG[3], h: FG[4], r: TAN[2], R: TAN[3], Q: TAN[4], q: TAN[1], k: '#2a1416', f: MV[2], F: MV[3] };
  var MLEAF = [FG[0], FG[1], FG[2], FG[3], FG[4]];
  function mandrakeLeaves(im, k) { // k: size 0..3
    var sc = [0.45, 0.65, 0.85, 1][k];
    function L(bx, by, tx, ty, w) { broadLeaf(im, bx, by, bx + (tx - bx) * sc, by + (ty - by) * sc, w * (0.7 + 0.3 * sc), MLEAF); }
    L(7.5, 26, 7.5, 13, 2.3);          // back centre
    L(7, 26, 1.5, 16, 2.3);           // back left
    L(8, 26, 13.5, 16, 2.3);          // back right
    L(7, 27, -0.5, 22.5, 2.0);        // front left
    L(8, 27, 15.5, 22.5, 2.0);        // front right
  }
  CROPS.mandrake = function (st) {
    var leg = plantLeg(MAN);
    if (st === 0) return plant([
      '.....hl..lh.....',
      '.....lmmmml.....',
      '.......mm.......'
    ], 24, leg, { pre: mound, shadow: 0 });
    var im = img(16, 32);
    if (st === 1) mound(im);
    mandrakeLeaves(im, st - 1);
    if (st === 3) stamp(im, 6, 12, ['.F.', 'FfF', '.f.', '.s.'], { F: MV[3], f: MV[2], s: FG[3] });
    if (st === 4) {
      // the grumpy root peeking out of the soil, leaves sprouting from its head
      stamp(im, 4, 22, [
        '..RQQQQR..',
        '.qRkQQkRr.',
        '.rRRkkRRr.',
        '.rkQrrQkq.',
        '.rRRRRRRq.',
        '..qqqqqq..'
      ], { r: TAN[2], R: TAN[3], Q: TAN[4], q: TAN[1], k: '#2a1416' });
    }
    outline(im, 'sel');
    groundShadow(im, st === 1 ? 0 : 3);
    if (st === 4) { px(im, 6, 25, '#ffd0a0'); px(im, 9, 25, '#ffd0a0'); }
    return im;
  };

  // ---------------------------------------------------------------- frostmint
  var MINT = { 5: ICE[4], 4: ICE[3], 3: ICE[2], 2: ICE[1], s: TEAL[2], S: TEAL[1], W: WHITE };
  function mintSparkles(im, pts) { pts.forEach(function (p) { sparkle(im, p[0], p[1], WHITE); }); }
  CROPS.frostmint = function (st) {
    var leg = plantLeg(MINT);
    if (st === 0) return plant([
      '......4..4......',
      '.....453s54.....',
      '........s.......'
    ], 24, leg, { pre: mound, shadow: 0 });
    if (st === 1) return plant([
      '.......54.......',
      '......43s4......',
      '.........s......',
      '....544.s.......',
      '.....33s.445....',
      '.......s.33.....',
      '.......s........'
    ], 21, leg, { pre: mound, shadow: 0 });
    if (st === 2) return plant([
      '......54........',
      '.....43s4..54...',
      '.......s..4s3...',
      '..544..s..s.....',
      '...33s.s.s.445..',
      '.....s.ss..33...',
      '..544.ss........',
      '...33.s.........',
      '......s.........'
    ], 19, leg, { post: function (im) { mintSparkles(im, [[3, 18]]); } });
    if (st === 3) return plant([
      '.......54.......',
      '..54..43s4..54..',
      '.43s4...s..4s3..',
      '...s..5.s.......',
      '.544s.44s.s445..',
      '..33.s.ss.s.33..',
      '.....ss.sss.....',
      '.5444.s.s..4445.',
      '..333.sss.s.333.',
      '.......ss.......',
      '.......s........'
    ], 17, leg, { post: function (im) { mintSparkles(im, [[2, 16], [12, 20]]); } });
    return plant([
      '.......55.......',
      '..55..554W..55..',
      '.5543..45..5445.',
      '..34s..s4..s43..',
      '.55.s.5s5.s.55..',
      '5443.s.s.s.4445.',
      '.33s.sssss.s33..',
      '..55.s.s.s..55..',
      '.5444.sss.s4455.',
      '..333.sss..333..',
      '.......ss.......',
      '.......s........'
    ], 16, leg, { post: function (im) { mintSparkles(im, [[3, 14], [13, 16], [8, 15]]); px(im, 1, 21, WHITE); px(im, 14, 24, WHITE); px(im, 5, 17, WHITE); } });
  };
  REGROW.frostmint = function () {
    return plant([
      '......4.........',
      '..54..s..5......',
      '...s..s.4s3.....',
      '...s.ss..s......',
      '.54.ss..ss.45...',
      '..3..sss.s.3....',
      '......ss........',
      '.......s........'
    ], 20, plantLeg(MINT));
  };

  // ---------------------------------------------------------------- emberroot
  var EMB = { d: LEAFRED[1], m: LEAFRED[2], l: LEAFRED[3], h: LEAFRED[4], s: LEAFRED[2], S: LEAFRED[1],
    o: ORANGE, O: AMBER, y: CANDLE, r: EMBER, R: FIRE[1], g: FG[3], G: FG[4] };
  var ELEAF = ['#1e0c18', '#43142a', '#6a1e30', '#923238', '#b4503e'];
  function pepper(im, x, y, big) {
    // hanging glowing pepper; (x,y) = attachment point
    px(im, x, y, '#4e6a26'); px(im, x, y + 1, '#4e6a26');
    tube(im, big ? [[x, y + 2.8, 1.45], [x + 0.1, y + 4.4, 1.15], [x - 0.5, y + 6, 0.45]] : [[x, y + 2.5, 1.0], [x - 0.3, y + 3.9, 0.4]], [FIRE[2], FIRE[3], FIRE[4], FIRE[5]], { bias: 0.15 });
  }
  CROPS.emberroot = function (st) {
    var im = img(16, 32);
    if (st <= 1) mound(im);
    var stemTop = [25, 23, 19, 16, 15][st];
    vline(im, 7, stemTop, 27, ELEAF[2]); vline(im, 8, stemTop + 1, 27, ELEAF[1]);
    var sc = [0.4, 0.6, 0.8, 1, 1][st];
    function L(by, tx, ty, w) { var bx = tx < 7.5 ? 7 : 8; broadLeaf(im, bx, by, bx + (tx - bx) * sc, by + (ty - by) * sc, w * (0.65 + 0.35 * sc), ELEAF); }
    if (st >= 2) { L(23, 1.5, 20.5, 1.45); L(22, 14, 19.5, 1.45); }
    if (st >= 3) { L(19, 2.5, 16, 1.4); L(18, 13, 15.5, 1.4); }
    L(26, 2.5, 24.5, 1.3); L(26, 13.5, 24.5, 1.3);
    L(stemTop + 1, 5, stemTop - 4, 1.3); L(stemTop + 1, 10.5, stemTop - 4, 1.3);
    if (st === 3) { px(im, 4, 22, '#4e6a26'); px(im, 4, 23, '#7a8a2a'); px(im, 4, 24, '#9a5a2a'); px(im, 11, 21, '#4e6a26'); px(im, 11, 22, '#8a6a2a'); }
    if (st === 4) { pepper(im, 4, 21, true); pepper(im, 11, 20, true); pepper(im, 9, 24, false); }
    outline(im, 'sel');
    groundShadow(im, st <= 1 ? 0 : 3);
    if (st === 4) {
      px(im, 7, 28, AMBER); px(im, 8, 28, CANDLE); px(im, 6, 28, alpha(ORANGE, 0.9)); px(im, 9, 28, alpha(ORANGE, 0.9));
      px(im, 3, 24, CANDLE); px(im, 10, 23, CANDLE);
    }
    return im;
  };

  // ---------------------------------------------------------------- duskberry
  var DUSK = { b: PLUM[2], B: PLUM[3], x: PLUM[4], X: PLUM[5], k: PLUM[1], w: '#f2e6ff', W: WHITE, t: WOOD[3], T: WOOD[2], u: '#9ac86e' };
  var BUSH = [
    '.....hlhl.......',
    '...hllmmlhl.....',
    '..hlmmmmmmlhl...',
    '.hlmmdmmmmmmlh..',
    '.lmmmmmmdmmmml..',
    'hlmmdmmmmmmmdml.',
    '.lmmmmmmdmmmmml.',
    '.dmmmdmmmmmdmmd.',
    '..ddmmmmdmmmdd..',
    '....ddmtmmdd....',
    '.......tT.......',
    '.......tT.......'
  ];
  CROPS.duskberry = function (st) {
    var leg = plantLeg(DUSK);
    if (st === 0) return plant([
      '......l..l......',
      '.....lmtml......',
      '.......t........'
    ], 24, leg, { pre: mound, shadow: 0 });
    if (st === 1) return plant([
      '.......hl.......',
      '....hl.lm.lh....',
      '.....lmtmml.....',
      '.......t........',
      '.......tT.......'
    ], 22, leg, { pre: mound, shadow: 0 });
    if (st === 2) return plant([
      '......hlh.......',
      '....hlmmlh......',
      '...hlmmmmlh.....',
      '..hlmmdmmmml....',
      '...dmmmmmdmd....',
      '....ddmtmdd.....',
      '.......tT.......',
      '.......tT.......'
    ], 20, leg);
    if (st === 3) return plant(BUSH, 16, leg, { post: function (im) {
      [[4, 18], [10, 17], [7, 20], [12, 21], [3, 23], [9, 23]].forEach(function (p) { px(im, p[0], p[1], DUSK.w); px(im, p[0] + 1, p[1], DUSK.u); });
    } });
    return plant(BUSH, 16, leg, { post: function (im) {
      [[4, 18], [10, 17], [6, 21], [12, 21], [2, 23], [9, 24], [5, 25]].forEach(function (c, i) {
        stamp(im, c[0] - 1, c[1] - 1, ['.kx.', 'kBxk', 'bBBk', '.kk.'], { k: PLUM[1], b: PLUM[2], B: PLUM[3], x: PLUM[4] });
        px(im, c[0], c[1] - 1, PLUM[5]);
      });
    } });
  };
  REGROW.duskberry = function () {
    return plant(BUSH, 16, plantLeg(DUSK), { post: function (im) {
      [[4, 19], [10, 18], [12, 22], [6, 23]].forEach(function (p) { px(im, p[0], p[1], DUSK.u); });
    } });
  };

  // ---------------------------------------------------------------- starbloom
  var STAR = { y: GOLD[3], Y: GOLD[4], z: GOLD[2], Z: GOLD[1], c: CANDLE, W: WHITE };
  function starHead(im, cx, cy, R, r) {
    var pts = starPts(cx, cy, R, r, 5);
    poly(im, pts, function (x, y) {
      var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      if (d < r * 0.62) return CANDLE;
      if (d < r * 1.05) return GOLD[4];
      var a = Math.atan2(dy, dx), k = Math.round((a + Math.PI / 2) / (2 * Math.PI / 5)), ax = -Math.PI / 2 + k * 2 * Math.PI / 5;
      var side = Math.sin(a - ax);
      // light from the top-left: the half of each arm facing it is brighter
      var nx = -Math.sin(ax) * (side < 0 ? -1 : 1), ny = Math.cos(ax) * (side < 0 ? -1 : 1);
      var lit = -(nx * -0.6 + ny * -0.8);
      return lit < 0 ? GOLD[4] : GOLD[3];
    });
  }
  CROPS.starbloom = function (st) {
    var leg = plantLeg(STAR);
    if (st === 0) return plant([
      '......hl.lh.....',
      '.......lml......',
      '........s.......'
    ], 24, leg, { pre: mound, shadow: 0 });
    if (st === 1) return plant([
      '.....hl..lh.....',
      '...hllm..mllh...',
      '....dmmmsmmd....',
      '......ddsd......'
    ], 22, leg, { pre: mound, shadow: 0 });
    if (st === 2) return plant([
      '.......l........',
      '.......lm.......',
      '........s.......',
      '.....hl.s.......',
      '......lms.lh....',
      '..hl....smm.....',
      '..hllm..s..mllh.',
      '...dmmmmsmmmmd..',
      '.....ddmsmdd....'
    ], 19, leg);
    if (st === 3) return plant([
      '.......y........',
      '......yYz.......',
      '......YYz.......',
      '......yzz.......',
      '.......mm.......',
      '........s.......',
      '.....hl.s.......',
      '......lms.......',
      '........s.lh....',
      '........smm.....',
      '.....hl.s.......',
      '......lms.lh....',
      '........smm.....',
      '..hl....s.......',
      '..hllm..s..mllh.',
      '...dmmmmsmmmmd..',
      '.....ddmsmdd....'
    ], 11, leg);
    return plant([
      '........s.......',
      '........s.......',
      '.....hl.s.......',
      '......lms.......',
      '........s.lh....',
      '........smm.....',
      '.....hl.s.......',
      '......lms.lh....',
      '........smm.....',
      '..hl....s.......',
      '..hllm..s..mllh.',
      '...dmmmmsmmmmd..',
      '.....ddmsmdd....'
    ], 15, leg, { mid: function (im) { starHead(im, 8, 7.4, 6.6, 2.9); }, post: function (im) {
      px(im, 8, 7, WHITE); sparkle(im, 2, 3, WHITE); sparkle(im, 13, 12, WHITE); px(im, 12, 2, '#fff1c8');
    } });
  };

  // ---------------------------------------------------------------- trellis crops (garden arch)
  var ARCH = [
    '.....wwwwww.....',
    '...ww......ww...',
    '..w..........w..',
    '..W..........W..',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.WwwwwwwwwwwwwW.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.',
    '.W............W.'
  ];
  function trellis(im) {
    stamp(im, 0, 6, ARCH, { w: WOOD[4], W: WOOD[3] });
    px(im, 1, 28, WOOD[2]); px(im, 14, 28, WOOD[2]);
  }
  // vine: centre stem to the crossbar (y=15), then along the bar, up both posts and over the arch
  var VINE_PATH = {
    stem: [[7, 28], [7, 27], [7, 26], [8, 25], [8, 24], [8, 23], [7, 22], [7, 21], [7, 20], [8, 19], [8, 18], [8, 17], [7, 16]],
    barL: [[6, 14], [5, 14], [4, 14], [3, 14]],
    barR: [[8, 14], [9, 14], [10, 14], [11, 14], [12, 14]],
    postL: [[2, 13], [2, 12], [2, 11], [2, 10], [2, 9], [3, 8], [3, 7]],
    postR: [[13, 13], [13, 12], [13, 11], [13, 10], [13, 9], [12, 8], [12, 7]],
    arch: [[4, 6], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 6]]
  };
  // [x, y, dir, minStage]
  var VINE_LEAVES = [[8, 25, 1, 1], [7, 22, -1, 1], [8, 19, 1, 2], [7, 17, -1, 2], [4, 14, -1, 3], [11, 14, 1, 2], [2, 11, 1, 3], [13, 10, -1, 3],
    [3, 8, 1, 3], [12, 8, -1, 3], [6, 5, -1, 3], [9, 5, 1, 3], [5, 14, 1, 3]];
  function vine(im, st, V) {
    function run(list, n) { for (var i = 0; i < list.length && i < n; i++) px(im, list[i][0], list[i][1], V.s); }
    run(VINE_PATH.stem, [0, 6, 13, 13, 13][st]);
    if (st >= 2) { run(VINE_PATH.barL, st >= 3 ? 9 : 2); run(VINE_PATH.barR, st >= 3 ? 9 : 3); }
    if (st >= 3) { run(VINE_PATH.postL, 9); run(VINE_PATH.postR, 9); run(VINE_PATH.arch, 9); }
    VINE_LEAVES.forEach(function (L) {
      if (st < L[3]) return;
      var x = L[0], y = L[1], d = L[2];
      px(im, x + d, y - 1, V.l); px(im, x + 2 * d, y - 1, V.h); px(im, x + d, y, V.m); px(im, x + 2 * d, y - 2, V.l);
    });
  }
  function trellisCrop(st, V, fruit, o) {
    o = o || {};
    var im = img(16, 32);
    if (st === 0) {
      mound(im);
      stamp(im, 6, 23, ['.h.', 'lm.', '.s.', '.s.', '.s.'], { h: V.h, l: V.l, m: V.m, s: V.s });
      trellis(im);
      outline(im, 'sel');
      return im;
    }
    trellis(im);
    vine(im, st, V);
    if (st >= 3 && o.buds) o.buds(im, st);
    if (st === 4 && fruit) fruit(im);
    outline(im, 'sel');
    groundShadow(im, 2);
    if (o.post) o.post(im, st);
    return im;
  }
  // fruit hang points (attachment pixel on the vine; fruit hangs below)
  var HANG = [[5, 6], [10, 6], [4, 15], [11, 15], [7, 6]];

  // ---------------------------------------------------------------- wispvine
  var WISP = { s: '#2f6a62', m: '#3f857a', l: '#62ad9c', h: '#9adcc8' };
  function bell(im, x, y) {
    stamp(im, x - 2, y, [
      '..s..',
      '..a..',
      '.aWb.',
      '.abc.',
      'abbbc',
      'd.y.d'
    ], { s: WISP.s, a: WHITE, W: WHITE, b: '#c8f6e8', c: '#7cd4bc', d: TEAL[3], y: '#5dffb0' });
  }
  CROPS.wispvine = function (st) {
    var B = [[5, 6], [10, 6], [4, 15], [11, 15], [7.5, 6]];
    return trellisCrop(st, WISP, function (im) { [[5, 6], [10, 6], [4, 15], [11, 15]].forEach(function (p) { bell(im, p[0], p[1]); }); }, {
      buds: function (im) { [[5, 7], [10, 7], [11, 16]].forEach(function (p) { px(im, p[0], p[1], '#e6fff6'); }); },
      post: function (im, st) { if (st === 4) [[5, 6], [10, 6], [4, 15], [11, 15]].forEach(function (p) { px(im, p[0], p[1] + 6, alpha('#5dffb0', 0.8)); }); }
    });
  };
  REGROW.wispvine = function () { return trellisCrop(3, WISP, null, {}); };

  // ---------------------------------------------------------------- phialvine
  var PHV = { s: FG[3], m: FG[3], l: FG[4], h: FG[5] };
  function phial(im, x, y, empty) {
    stamp(im, x - 1, y, [
      '.s.',
      '.c.',
      '.g.',
      empty ? 'ggg' : 'grg',
      empty ? 'gGg' : 'wRr',
      empty ? 'ggg' : 'rRq',
      empty ? '.g.' : '.q.'
    ], { s: FG[2], c: CORK[3], g: GLASS[3], G: GLASS[4], w: WHITE, r: '#d8403e', R: '#ff8a6a', q: '#962234' });
  }
  CROPS.phialvine = function (st) {
    var P = [[5, 6], [10, 6], [4, 15], [11, 15]];
    return trellisCrop(st, PHV, function (im) { P.forEach(function (p) { phial(im, p[0], p[1]); }); }, {
      buds: function (im, st) { if (st === 3) P.forEach(function (p) { px(im, p[0], p[1] + 1, GLASS[3]); px(im, p[0], p[1] + 2, GLASS[2]); }); }
    });
  };
  REGROW.phialvine = function () {
    return trellisCrop(3, PHV, null, { buds: function (im) { [[5, 6], [10, 6], [4, 15], [11, 15]].forEach(function (p) { px(im, p[0], p[1] + 1, GLASS[3]); px(im, p[0], p[1] + 2, GLASS[2]); }); } });
  };

  // ---------------------------------------------------------------- starflask (lily trained on the arch)
  var SFL = { s: FG[3], m: FG[3], l: FG[4], h: FG[5] };
  function flask(im, x, y, empty) {
    var G = empty ? [GLASS[1], GLASS[2], GLASS[3], GLASS[3]] : ['#1e8a5e', '#2fbf7f', '#5dffb0', '#b4ffd9'];
    stamp(im, x - 2, y, [
      '..s..',
      '..n..',
      '.ann.',
      'abccb',
      'bccdb',
      '.bbb.'
    ], { s: FG[2], n: GLASS[3], a: G[2], b: G[1], c: G[2], d: G[3] });
    px(im, x - 1, y + 3, empty ? GLASS[4] : WHITE);
    if (!empty) px(im, x, y + 4, G[3]);
  }
  function lilyBase(im, st) {
    var rows = st <= 1 ? [
      '.....h....h.....',
      '....hl....lh....',
      '....lm.ss.ml....',
      '.....mmssmm.....'
    ] : [
      '..h..........h..',
      '..lh...ss...hl..',
      '...lh..ss..hl...',
      '...lm..ss..ml...',
      '....lm.ss.ml....',
      '.h...mmssmm...h.',
      '.lhm..mssm..mhl.',
      '..lmmmmssmmmml..'
    ];
    stamp(im, 0, 28 - rows.length, rows, PL);
  }
  var SF_HANG = [[5, 6], [10, 6], [4, 15], [11, 15]];
  function starflaskStalk(im, st, regrow) {
    var top = [28, 28, 20, 7, 7][st];
    vline(im, 7, top, 27, FG[3]); vline(im, 8, top, 27, FG[2]);
    if (st >= 3) {
      line(im, 7, 8, 5, 6, FG[3]); line(im, 8, 8, 10, 6, FG[3]);
      line(im, 7, 15, 4, 15, FG[3]); line(im, 8, 15, 11, 15, FG[3]);
      px(im, 6, 4, FG[4]); px(im, 7, 5, FG[4]); px(im, 9, 4, FG[4]); px(im, 8, 6, FG[3]);
    }
  }
  CROPS.starflask = function (st) {
    var im = img(16, 32);
    if (st === 0) {
      mound(im);
      blob(im, 7.5, 25.5, 1.8, 1.6, ['#1e8a5e', '#2fbf7f', '#5dffb0', '#b4ffd9']);
      stamp(im, 7, 22, ['.l', 'l.', 'm.'], PL);
      trellis(im);
      outline(im, 'sel');
      return im;
    }
    trellis(im);
    if (st >= 2) starflaskStalk(im, st);
    lilyBase(im, st);
    if (st === 3) SF_HANG.forEach(function (p) { px(im, p[0], p[1] + 1, GLASS[3]); px(im, p[0], p[1] + 2, '#5dffb0'); });
    if (st === 4) SF_HANG.forEach(function (p) { flask(im, p[0], p[1]); });
    outline(im, 'sel');
    groundShadow(im, 3);
    if (st === 4) { sparkle(im, 13, 3, '#b4ffd9'); px(im, 1, 21, '#b4ffd9'); }
    return im;
  };
  REGROW.starflask = function () {
    var im = img(16, 32);
    trellis(im);
    starflaskStalk(im, 3);
    lilyBase(im, 3);
    SF_HANG.forEach(function (p) { px(im, p[0], p[1] + 1, GLASS[3]); px(im, p[0], p[1] + 2, GLASS[2]); });
    outline(im, 'sel');
    groundShadow(im, 3);
    return im;
  };

  // ===========================================================================
  // Placeable objects — 16x32, anchored bottom-centre (footprint = bottom 16x16)
  // ===========================================================================
  var OBJECTS = Object.create(null);
  // potion id -> liquid ramp for a finished cauldron
  var POT_LIQ = {
    pot_healing: LIQ.heal, pot_vigor: LIQ.vigor, pot_swift: LIQ.swift, pot_ember: LIQ.ember, pot_mandrake: LIQ.mandrake,
    pot_frostward: LIQ.frost, pot_starlight: LIQ.star, pot_shadow: LIQ.shadow, pot_fairy: LIQ.fairy, pot_tide: LIQ.tide,
    pot_moon: LIQ.moon, sludge: LIQ.mud
  };
  var DONE_DEFAULT = ['#4a2f7a', '#8f6cd1', '#b99aee', '#e4d2ff', '#ffffff'];

  // ---- copper cauldron ------------------------------------------------------
  function cauldronBase(liq, surfaceFn) {
    var im = img(16, 32);
    // feet
    stamp(im, 2, 28, ['.12.......21.', '.11.......11.', '...........'], legend(['012345', COPPER]));
    stamp(im, 6, 29, ['1221', '.11.'], legend(['012345', COPPER]));
    // belly
    blob(im, 7.5, 24, 6.9, 5.4, COPPER, { bias: 0.02 });
    for (var x = 0; x < 16; x++) for (var y = 0; y < 20; y++) px(im, x, y, null);
    // belly band + rivets
    for (var bx = 1; bx <= 14; bx++) { pxOn(im, bx, 24, dk(get(im, bx, 24) || COPPER[2], 0.3)); }
    [3, 7, 11].forEach(function (rx) { pxOn(im, rx, 24, COPPER[4]); });
    // rim (ellipse ring) and liquid opening
    ellipse(im, 7.5, 19.6, 7.2, 2.2, function (x, y) { return y <= 19 ? (x < 6 ? COPPER[5] : COPPER[4]) : (x < 4 ? COPPER[3] : COPPER[2]); });
    ellipse(im, 7.5, 19.4, 5.6, 1.3, function (x, y) { return y <= 18 ? liq[1] : liq[2]; });
    if (surfaceFn) surfaceFn(im);
    // inner rim shadow (back wall)
    for (var ix = 3; ix <= 12; ix++) if (get(im, ix, 18) && !get(im, ix, 17)) { /* keep */ }
    outline(im, 'sel');
    return im;
  }
  OBJECTS.cauldron = {
    states: { idle: 1, brewing: 4, done: 2 }, def: 'idle',
    draw: function (st, f, potion) {
      if (st === 'idle') {
        var L0 = ['#120c1c', '#231b38', '#362a52', '#4a3b6d', '#604e88'];
        return cauldronBase(L0, function (im) { px(im, 5, 19, L0[3]); px(im, 6, 19, L0[4]); px(im, 10, 20, L0[3]); });
      }
      if (st === 'brewing') {
        var LB = ['#0f4a3a', '#1e8a5e', '#2fbf7f', '#5dffb0', '#b4ffd9'];
        var im = cauldronBase(LB, function (im) {
          // surface bubbles (cycle)
          var B = [[4, 19], [7, 18], [10, 19], [6, 20], [9, 20], [12, 19]];
          for (var i = 0; i < B.length; i++) {
            var ph = (i + f) % 4;
            if (ph === 0) px(im, B[i][0], B[i][1], LB[4]);
            else if (ph === 1) { px(im, B[i][0], B[i][1], LB[3]); px(im, B[i][0] + 1, B[i][1], LB[4]); }
          }
        });
        // rising bubbles
        var R = [[5, 0], [9, 5], [7, 9], [11, 3]];
        R.forEach(function (b, i) {
          var y = 16 - ((f * 3 + b[1]) % 12);
          var x = b[0] + (((f + i) % 2) ? 1 : 0);
          if (y > 16) return;
          px(im, x, y, alpha(LB[4], 0.95)); px(im, x + 1, y, alpha(LB[3], 0.8)); px(im, x, y + 1, alpha(LB[3], 0.8)); px(im, x + 1, y + 1, alpha(LB[2], 0.7));
          if (i % 2) px(im, x, y, alpha(WHITE, 0.9));
        });
        // steam wisps
        var S = [[4, 9], [10, 7], [7, 3]];
        S.forEach(function (s, i) {
          var off = (f + i) % 4;
          for (var k = 0; k < 5; k++) {
            var yy = s[1] - off - k, xx = s[0] + ((k + off + i) % 3 === 0 ? 1 : (k + off) % 3 === 1 ? 0 : -1);
            if (yy < 0) continue;
            px(im, xx, yy, alpha('#e8eeff', 0.22 + 0.08 * (4 - k) / 4));
          }
        });
        return im;
      }
      // done
      var Ld = POT_LIQ[potion] || DONE_DEFAULT;
      var GL = [Ld[2], Ld[3], Ld[4], WHITE, WHITE];
      var imd = cauldronBase(GL, function (im) {
        hline(im, 4, 11, 19, Ld[4]); px(im, 6, 18, WHITE); px(im, 9, 18, WHITE);
      });
      // sparkles + glow motes
      var SP = f ? [[3, 12], [11, 9], [7, 5], [13, 14]] : [[5, 10], [10, 13], [8, 7], [2, 15]];
      SP.forEach(function (p, i) { if (i < 2) sparkle(imd, p[0], p[1], i ? Ld[4] : WHITE, i === 0); else px(imd, p[0], p[1], alpha(Ld[4], 0.9)); });
      return imd;
    }
  };

  // ---- dew crystal sprinkler ------------------------------------------------
  OBJECTS.dewcrystal = {
    states: { idle: 4 }, def: 'idle',
    draw: function (st, f) {
      var im = img(16, 32);
      // short cylindrical stone plinth
      stamp(im, 3, 21, [
        '..TTTTTT..',
        '.TtttttTs.',
        '.sTTTTTTr.',
        '.sSSSSSsr.',
        '.sSSSsssr.',
        '.sSSSSssr.',
        '.sSSSsssr.',
        'ssSSSSSssr',
        'rrrrrrrrrr'
      ], { T: STONE[5], t: STONE[4], S: STONE[3], s: STONE[2], r: STONE[1] });
      // a rune on the plinth
      var glow = [0.55, 0.8, 1, 0.8][f];
      px(im, 7, 25, mix('#2e4f9f', '#c4e6ff', glow)); px(im, 7, 26, mix('#2e4f9f', '#c4e6ff', glow * 0.8)); px(im, 6, 26, mix('#2e4f9f', '#c4e6ff', glow * 0.6)); px(im, 8, 26, mix('#2e4f9f', '#c4e6ff', glow * 0.6));
      // the crystal (hovering, bobbing 1px)
      var dy = f === 2 ? -1 : 0;
      var C = [['#17224c', '#213479', '#2e4f9f', '#69a1db', '#c4e6ff'], ['#17224c', '#2e4f9f', '#4a7ac8', '#8ec8f4', '#e2f4ff'], ['#213479', '#2e4f9f', '#69a1db', '#b4e0ff', '#ffffff'], ['#17224c', '#2e4f9f', '#4a7ac8', '#8ec8f4', '#e2f4ff']][f];
      stamp(im, 4, 8 + dy, [
        '...44...',
        '..4453..',
        '..44532.',
        '.445532.',
        '.4455321',
        '.4455321',
        '.4455321',
        '..45532.',
        '..4532..',
        '...42...',
        '...1....'
      ], { 5: C[4], 4: C[3], 3: C[2], 2: C[1], 1: C[0] });
      outline(im, 'sel');
      // dew droplets / glints
      px(im, 6, 10 + dy, WHITE);
      if (f === 2) { sparkle(im, 11, 9, WHITE, true); px(im, 3, 15, alpha('#c4e6ff', 0.9)); }
      if (f === 1 || f === 3) px(im, 11, 12, alpha('#c4e6ff', 0.8));
      if (f === 0) px(im, 3, 13, alpha('#c4e6ff', 0.6));
      return im;
    }
  };

  // ---- storage chest ---------------------------------------------------------
  var CH = { w: WOOD[3], W: WOOD[4], d: WOOD[2], D: WOOD[1], i: '#4a3b6d', I: '#7a68a8', j: '#2e2448', m: '#e8eeff', M: '#9fb0d8', k: OUT, g: GOLD[3], G: GOLD[1] };
  OBJECTS.chest = {
    states: { closed: 1, open: 1 }, def: 'closed',
    draw: function (st) {
      var im;
      if (st === 'open') {
        im = sprite([
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '...iIWWWWWWIi...',
          '..iIwWWWWWWwIi..',
          '..iIwdwwwdwwIi..',
          '..iIddddddddIi..',
          '..iIDDDDDDDDIi..',
          '.iIjjjjjjjjjjIi.',
          '.iIkkkgkkkkkkIi.',
          '.iIkkkkkkgkkkIi.',
          '.ijjjjgmggjjjji.',
          '.iIwwwmggGwwwIi.',
          '.iIwwwgmgGwwwIi.',
          '.iIwdwwwwwwdwIi.',
          '.iIwwwwdwwwwwIi.',
          '.iIwwwwwwwwwwIi.',
          '.iIwwdwwwwdwwIi.',
          '.iIddddddddddIi.',
          '.jjDDDDDDDDDDjj.',
          '................',
          '................',
          '................'
        ], CH, 16, 32);
      } else {
        im = sprite([
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '................',
          '...iIWWWWWWIi...',
          '..iIWWWWWWWWIi..',
          '.iIwWWWWWWWWwIi.',
          '.iIwwdwwwwdwwIi.',
          '.ijjjjgmggjjjji.',
          '.iIwwwmggGwwwIi.',
          '.iIwwwgmgGwwwIi.',
          '.iIwdwwwwwwdwIi.',
          '.iIwwwwdwwwwwIi.',
          '.iIwwwwwwwwwwIi.',
          '.iIwwdwwwwdwwIi.',
          '.iIddddddddddIi.',
          '.jjDDDDDDDDDDjj.',
          '................',
          '................'
        ], CH, 16, 32);
      }
      outline(im, 'sel');
      return im;
    }
  };

  // ===========================================================================
  // EXPANSION — world objects (16x32, bottom-anchored like the cauldron)
  // ===========================================================================
  // ---- treasure chest: iron-strapped oak, gold corner caps, gold lock ----------
  var TC = { w: '#8a5230', W: '#b07440', h: '#d09a5e', d: '#5e3420', D: '#3a2018', I: '#45445a', i: '#2d2c3e', J: '#7e7d97',
    g: GOLD[3], G: GOLD[4], q: GOLD[2], k: '#1b1429', y: GOLD[3], Y: GOLD[4], Q: GOLD[5], c: '#c88a3a' };
  var TC_BODY = [
    '.qwwwJwwwwJwwwq.',
    '.kkkkIkGGkIkkkk.',
    '.gWWWIhGkGIWWWg.',
    '.wWhWIWqGqIWhWw.',
    '.wWWWIWWWWIWWWw.',
    '.dddddddddddddd.',
    '.wWWWIWWhWIWWWw.',
    '.wWWWIWWWWIWWWw.',
    '.qdddIddddIdddq.',
    '.ggiiiiiiiiiigg.'
  ];
  OBJECTS.treasure_chest = {
    states: { closed: 1, open: 1 }, def: 'closed',
    draw: function (st) {
      var im = img(16, 32);
      if (st === 'open') {
        // lid flipped back on its hinges (we see its top), body below with a heap of coins
        stamp(im, 0, 11, [
          '....wWWWWWWw....',
          '..gwWJWWWWJWwg..',
          '..wWWIWWWWIWWw..',
          '..wWWIWWWWIWWw..',
          '.gdddIddddIdddg.',
          '.kkkkkkkkkkkkkk.',
          '.kYyQyYyyYQyYyk.',
          '.kyYYyQYyYyyYyk.'
        ], TC);
        stamp(im, 0, 19, TC_BODY.slice(1), TC);
        outline(im, 'sel');
        // light spilling up from the gold
        for (var x = 3; x <= 12; x++) for (var y = 3; y <= 16; y++) {
          var a = (x % 3 === 1 ? 0.32 : 0.16) * (1 - (16 - y) / 14);
          if (a > 0.05 && !A(im, x, y)) px(im, x, y, alpha('#ffe08a', a));
        }
        sparkle(im, 5, 14, WHITE, true); sparkle(im, 11, 12, '#fff1c8'); px(im, 8, 9, alpha(WHITE, 0.8)); px(im, 3, 11, alpha('#ffe08a', 0.8));
        px(im, 6, 17, WHITE); px(im, 10, 18, WHITE);
        return im;
      }
      stamp(im, 0, 16, [
        '....wWWWWWWw....',
        '..gwWJWWWWJWwg..',
        '..wWhIWWWWIWWw..',
        '..wWWIWWWWIWWw..'
      ].concat(TC_BODY), TC);
      outline(im, 'sel');
      px(im, 4, 17, '#e8b878'); px(im, 2, 17, GOLD[5]); px(im, 7, 19, '#e8b878');
      return im;
    }
  };

  // ---- mystery chest: weathered wood, violet runes, a faint glow… and a few too many teeth
  var MC = { w: '#3a3050', W: '#4e4468', h: '#665a84', d: '#261e36', r: '#5a3a2a', R: '#8a5a3a', t: '#e8e0d0', v: '#b48aee', V: '#e4d2ff',
    u: '#9a6ad8', U: '#e0b8ff', o: '#c86cff', O: '#ffd6ff', k: '#120c1c', i: '#2d2c3e' };
  var MC_BODY = [
    '.rwwwwwwwwwwwwr.',
    '.tvtvtvtvtvtvtv.',
    '.rWWWWWoOWWWWWr.',
    '.wWuWWWooWWWuWw.',
    '.wWWUWWWWWWUWWw.',
    '.wWWWuWWWWuWWWw.',
    '.wWhWWUWWuWWWWw.',
    '.wddddddddddddw.',
    '.rddddddddddddr.',
    '.rriiiiiiiiiirr.'
  ];
  OBJECTS.mystery_chest = {
    states: { closed: 1, open: 1 }, def: 'closed',
    draw: function (st) {
      var im = img(16, 32);
      if (st === 'open') {
        stamp(im, 0, 11, [
          '....wWWWWWWw....',
          '..rwWWWWWWWWwr..',
          '..wWuWWWWWuWWw..',
          '..wWWWWUWWWWWw..',
          '.rdddddddddddr..',
          '.tktktktktktktk.',
          '.kvVvoVvvOvVvok.',
          '.kVvvOvVvvVovVk.'
        ], MC);
        stamp(im, 0, 19, MC_BODY.slice(1), MC);
        outline(im, 'sel');
        // eerie violet light curling up out of the chest, with a glint of gold
        for (var y = 4; y <= 16; y++) {
          var xx = Math.round(7.5 + Math.sin(y * 0.8) * 2.5);
          px(im, xx, y, alpha('#c86cff', 0.25 + 0.03 * (y - 4)));
          px(im, 15 - xx, y, alpha('#e4d2ff', 0.18 + 0.02 * (y - 4)));
        }
        px(im, 6, 17, GOLD[4]); px(im, 10, 18, GOLD[4]); sparkle(im, 8, 9, '#ffd6ff', true); px(im, 4, 13, alpha('#c86cff', 0.8));
        return im;
      }
      stamp(im, 0, 16, [
        '....wWWWWWWw....',
        '..rwWWWWWWWWwr..',
        '..wWuWWWWWuWWw..',
        '..wWWWWUWWWWWw..'
      ].concat(MC_BODY), MC);
      outline(im, 'sel');
      // faint glow leaking from the seam and runes
      [[3, 19], [12, 19], [7, 15], [9, 14]].forEach(function (p, i) { px(im, p[0], p[1], alpha(i < 2 ? '#e0b8ff' : '#c86cff', i < 2 ? 0.9 : 0.4)); });
      return im;
    }
  };

  // ---- dig mark: an X scratched into a patch of loose soil, a few pebbles -------
  OBJECTS.dig_mark = {
    states: { idle: 2 }, def: 'idle',
    draw: function (st, f) {
      var im = img(16, 32);
      // a patch of freshly turned, lighter earth
      ellipse(im, 7.5, 25.5, 6.6, 3.8, function (x, y) { var n = hash(x, y, 31); return n < 0.16 ? '#3a2c46' : n > 0.8 ? '#7a6888' : '#5a4868'; });
      outline(im, 'tint');
      // the X: deep gouges (2px) with bright lips of thrown-up dirt on their upper-left
      for (var i = 0; i <= 8; i++) {
        var y = 21 + i, xa = 3 + i, xb = 12 - i;
        [xa, xb].forEach(function (x) {
          px(im, x, y, '#120c1c'); px(im, x + (x === xa ? 1 : -1), y, '#241a30');
          px(im, x, y - 1, A(im, x, y - 1) && get(im, x, y - 1) !== '#120c1c' ? '#9a88aa' : '#9a88aa');
        });
      }
      px(im, 7, 25, '#120c1c'); px(im, 8, 25, '#120c1c');
      // pebbles kicked aside
      stamp(im, 1, 22, ['.ab', 'abb'], { a: STONE[5], b: STONE[3] });
      stamp(im, 12, 28, ['ab.', 'bb.'], { a: STONE[5], b: STONE[3] });
      px(im, 14, 23, STONE[4]); px(im, 2, 28, STONE[4]);
      if (f === 1) { sparkle(im, 10, 21, '#fff1c8'); px(im, 5, 27, alpha('#ffe08a', 0.85)); }
      return im;
    }
  };

  // ===========================================================================
  // ROUND 3 — crafted placeables (16x32, bottom-anchored)
  // ===========================================================================
  function sprinklerBase(im) {
    stamp(im, 3, 20, [
      '....c.....',
      '...cCd....',
      '...cCd....',
      '....d.....',
      '....k.....',
      '..bbkbb...',
      'n.bBBBBb.n',
      'nnBBBBBBbn',
      '.bBBBBBBb.',
      '.bbbbbbbb.',
      '..aaaaaa..'
    ], { c: '#69a1db', C: '#c4e6ff', d: '#2e4f9f', k: BRASS[2], b: BRASS[1], B: BRASS[3], n: BRASS[2], a: BRASS[0] });
  }
  OBJECTS.dew_sprinkler = {
    states: { idle: 1, spray: 4 }, def: 'idle',
    draw: function (st, f) {
      var im = img(16, 32);
      sprinklerBase(im);
      outline(im, 'sel');
      px(im, 6, 21, WHITE);
      if (st !== 'spray') return im;
      // little arcs of water: chains of droplets thrown out both ways, travelling outward each frame
      for (var k = 0; k < 4; k++) {
        var t = ((f + k) % 4) / 4 + 0.12;
        var dx = t * 6.2, dy = -Math.sin(Math.PI * t) * 4.2 + t * 7.0;
        var yy = Math.round(21 + dy), c = t < 0.8 ? '#c4e6ff' : '#69a1db';
        px(im, Math.round(5 - dx), yy, c); px(im, Math.round(10 + dx), yy, c);
        if (k % 2 === 0) { px(im, Math.round(5 - dx), yy + 1, alpha('#69a1db', 0.7)); px(im, Math.round(10 + dx), yy + 1, alpha('#69a1db', 0.7)); }
      }
      // a little plume over the crystal
      px(im, 7, 18 - (f % 2), alpha('#e6f6ff', 0.9)); px(im, 8, 17 - ((f + 1) % 2), alpha('#c4e6ff', 0.8));
      if (f === 3 || f === 0) { px(im, 0, 28, alpha('#c4e6ff', 0.8)); px(im, 15, 28, alpha('#c4e6ff', 0.8)); }
      return im;
    }
  };
  OBJECTS.moon_scarecrow = {
    states: { idle: 2 }, def: 'idle',
    draw: function (st, f) {
      var im = img(16, 32), sway = f ? 1 : 0;
      // post and crossbar
      vline(im, 7, 13, 30, WOOD[3]); vline(im, 8, 13, 30, WOOD[2]);
      hline(im, 2, 13, 17, WOOD[3]); hline(im, 2, 13, 18, WOOD[2]);
      // ragged violet coat with straw at the cuffs and hem
      stamp(im, 4, 16, [
        '.rRRRRRr.',
        'rRRRRRRRr',
        'rRRpRRRRr',
        '.rRRRRRr.',
        '.rRRRpRr.',
        '.rRRRRRr.',
        '.rRrRrRr.',
        '..w.w.w..'
      ], { r: '#4a2e5a', R: '#6a4478', p: '#b07a3a', w: '#e8c070' });
      px(im, 1, 17 + sway, '#e8c070'); px(im, 1, 18, '#e8c070'); px(im, 14, 17, '#e8c070');
      // the moon head: pale, with a stitched smile and a crescent shadow
      ellipse(im, 7.5, 10, 3.6, 3.4, function (x, y, dx, dy) { return dx > 0.35 ? '#9fb0d8' : (dx + dy < -0.5 ? '#ffffff' : '#e8eeff'); });
      px(im, 6, 9, '#4a5280'); px(im, 9, 9, '#4a5280'); px(im, 6, 11, '#7e8aa6'); px(im, 7, 12, '#7e8aa6'); px(im, 8, 12, '#7e8aa6'); px(im, 9, 11, '#7e8aa6');
      // straw hat brim
      hline(im, 3, 12, 6, '#c8944a'); stamp(im, 5, 4, ['.hhh.', 'hhhhh'], { h: '#e8b060' });
      // lantern hanging from the right arm
      stamp(im, 12, 18, ['.k.', 'kkk', 'kLk', 'kkk'], { k: STONE[2], L: f ? AMBER : CANDLE });
      outline(im, 'sel');
      px(im, 13, 20, f ? '#ffd890' : WHITE);
      px(im, 11, 20, alpha(AMBER, f ? 0.5 : 0.8)); px(im, 15, 21, alpha(AMBER, f ? 0.8 : 0.5));
      return im;
    }
  };

  // ===========================================================================
  // World nodes — 16x16, bottom-anchored (they sit on the tile's ground line)
  // ===========================================================================
  var NODES = Object.create(null);
  function node(n, draw) { return { n: n, draw: draw }; }

  // ---- weeds ---------------------------------------------------------------
  var WEED = { d: GR[1], m: GR[3], l: GR[4], h: '#86b874', v: MV[1], V: MV[2], x: MV[3], X: MV[4], y: GOLDC };
  NODES.weed = node(3, function (v) {
    var rows = [[
      '................',
      '................',
      '................',
      '................',
      '................',
      '.......x........',
      '...x...V..X.....',
      '...V..lm..V.....',
      '...m.lm..lm..x..',
      '.l.ml.m.lm..lV..',
      '..lmm.mlm..lm...',
      '.l.mmdmmm.lmd...',
      '..lmdmmdmmlmd...',
      '...dddmdmmmd....',
      '................',
      '................'
    ], [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '......XxX.......',
      '.......V........',
      '...hlm.m.mlh....',
      '..hlmmmmmmmlh...',
      '...dmmlhlmmd....',
      '.hlmmmlmlmmmlh..',
      '..dmmmmmmmmmd...',
      '...dddmmmddd....',
      '................',
      '................'
    ], [
      '................',
      '................',
      '................',
      '................',
      '.........xX.....',
      '....Xx...Vx.....',
      '....xV....m.....',
      '.....m..l.m.....',
      '.....ml.lmm..l..',
      '..l..mm.mm..lm..',
      '..lm.mmlmm.lm...',
      '...mmdmmdmmmd...',
      '..ldmmdmmdmmd...',
      '...dddmmmddd....',
      '................',
      '................'
    ]][v];
    var im = sprite(rows, WEED);
    outline(im, 'sel');
    return im;
  });

  // ---- twigs ---------------------------------------------------------------
  NODES.twig = node(2, function (v) {
    var im = sprite(v === 0 ? [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..........43....',
      '....3.....32....',
      '.....3..432.....',
      '..4334332l......',
      '...22322lL......',
      '.....21.........',
      '................',
      '................'
    ] : [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '.......4........',
      '..43...3...43...',
      '...3433343332...',
      '....222322..21..',
      '..........2.....',
      '................',
      '................'
    ], { 4: WOOD[4], 3: WOOD[3], 2: WOOD[2], 1: WOOD[1], l: FG[4], L: FG[5] });
    outline(im, 'sel');
    return im;
  });

  // ---- pebbles -------------------------------------------------------------
  NODES.pebble = node(2, function (v) {
    var im = sprite(v === 0 ? [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '......4443......',
      '.....455432.....',
      '.....4443321....',
      '......22211.....',
      '................',
      '................',
      '................'
    ] : [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '...443..........',
      '..45532...443...',
      '..44322..45432..',
      '...2211..44321..',
      '..........2211..',
      '................',
      '................'
    ], legend(['012345', STONE]));
    outline(im, 'sel');
    return im;
  });

  // ---- stump ----------------------------------------------------------------
  NODES.stump = node(1, function () {
    var im = sprite([
      '................',
      '................',
      '................',
      '................',
      '...rrRRRRRrr....',
      '..rRYyyyyyYRr...',
      '..rYyYYYYYyYr...',
      '..bRYyyyyyYRb...',
      '..bbrRRRRRrbB...',
      '..bBbbBbbbbBb...',
      '..bBbbBbbbBbb...',
      '.bbBbbbBbbbBbb..',
      '.bbBbbBbbbbBbbb.',
      'bbb.bbbbBbb.bbb.',
      '.bb..bb..bb..b..',
      '................'
    ], { r: TAN[2], R: TAN[3], y: TAN[3], Y: TAN[4], b: WOOD[2], B: WOOD[3] });
    // bark grain on the shadow side
    [[11, 9], [12, 11], [11, 12], [12, 13]].forEach(function (p) { pxOn(im, p[0], p[1], WOOD[1]); });
    [[3, 9], [3, 11], [2, 12]].forEach(function (p) { pxOn(im, p[0], p[1], WOOD[3]); });
    outline(im, 'sel');
    return im;
  });

  // ---- boulder ----------------------------------------------------------------
  NODES.boulder = node(1, function () {
    var im = sprite([
      '................',
      '................',
      '.....34443......',
      '...3455554432...',
      '..345555544332..',
      '..4555554433322.',
      '.34555544k33222.',
      '.3455544k333221.',
      '.344444k3332221.',
      '.3344433k322221.',
      '.33333333k22211.',
      '.2333333322k211.',
      '.22333322222111.',
      '..222222221111..',
      '...1111111111...',
      '................'
    ], legend(['012345', STONE], { k: STONE[1] }));
    outline(im, 'sel');
    px(im, 6, 4, STONE[5]); px(im, 5, 5, STONE[5]);
    return im;
  });

  // ---- mining rocks ------------------------------------------------------------
  // faceted mining rocks: 5/4 lit top face · 3/2 front face · 1 shadow · k crack
  var ROCK_SHAPES = [[
    '................',
    '................',
    '................',
    '................',
    '......3444......',
    '....34555543....',
    '...3455555443...',
    '..345555554432..',
    '..344444444332..',
    '.23333k3333222..',
    '.2333k33332k221.',
    '.22333k33k22211.',
    '..1222222221111.',
    '...111111111....',
    '................',
    '................'
  ], [
    '................',
    '................',
    '................',
    '................',
    '...3443.........',
    '..345543..3443..',
    '..4555543345543.',
    '.34555544455543.',
    '.34444433444432.',
    '.2333333k333322.',
    '.233k333k333221.',
    '.2233k3333k2211.',
    '..12222222221 1.',
    '...1111111111...',
    '................',
    '................'
  ]];
  function rockBase(R, v) {
    var rows = ROCK_SHAPES[v % 2].map(function (r) { return r.replace(/ /g, '1'); });
    return sprite(rows, legend(['012345', R], { k: R[1] }));
  }
  var ROCK_PAL = {
    moss: ['#1f2a2a', '#34443e', '#4e6058', '#6e8070', '#90a08a', '#b4c2a8'],
    amethyst: ['#231b38', '#362a52', '#4e3f6e', '#6a5a8c', '#8c7cae', '#b0a2cc'],
    catacomb: ['#2e2a2a', '#4a4240', '#6a605a', '#8c8278', '#aea496', '#cec6b6'],
    crypt: ['#1e2233', '#2e3448', '#454d66', '#5f6a86', '#7e8aa6', '#a2acc6'],
    abyss: ['#0e0a18', '#1a1430', '#2a2048', '#3c2e64', '#54448a', '#7262b0']
  };
  NODES.rock_moss = node(2, function (v) {
    var im = rockBase(ROCK_PAL.moss, v);
    var moss = v ? [[3, 6], [4, 5], [5, 5], [6, 6], [11, 5], [12, 5], [13, 6], [3, 8]] : [[6, 4], [7, 4], [8, 4], [5, 5], [9, 5], [4, 6], [3, 7], [10, 5]];
    moss.forEach(function (p, i) { px(im, p[0], p[1], i % 3 ? FG[4] : FG[5]); pxOn(im, p[0], p[1] + 1, FG[3]); });
    outline(im, 'sel');
    px(im, v ? 4 : 7, v ? 4 : 3, FG[5]);
    return im;
  });
  NODES.rock_amethyst = node(2, function (v) {
    var im = rockBase(ROCK_PAL.amethyst, v);
    var c = v ? [[5, 8], [11, 8]] : [[6, 7], [10, 9]];
    c.forEach(function (p) { px(im, p[0], p[1], MV[3]); px(im, p[0], p[1] + 1, MV[1]); px(im, p[0] + 1, p[1] + 1, MV[2]); px(im, p[0], p[1] - 1, MV[4]); });
    outline(im, 'sel');
    return im;
  });
  NODES.rock_catacomb = node(2, function (v) {
    var im = rockBase(ROCK_PAL.catacomb, v);
    outline(im, 'sel');
    // a cobweb strung across one corner of the rock
    var W = '#d8d4e4', w = '#a8a4b8';
    var web = v === 0 ? [[2, 9, W], [3, 8, W], [4, 7, W], [5, 6, W], [6, 5, W], [3, 10, w], [4, 9, w], [5, 8, W], [6, 7, w], [4, 11, w], [5, 10, W], [6, 9, w], [7, 8, W], [3, 6, w], [4, 6, w], [2, 7, w]]
      : [[13, 8, W], [12, 7, W], [11, 6, W], [10, 5, W], [12, 9, w], [11, 8, W], [10, 7, w], [11, 10, w], [10, 9, W], [9, 8, w], [12, 5, w], [13, 6, w]];
    web.forEach(function (p) { px(im, p[0], p[1], p[2]); });
    return im;
  });
  NODES.rock_crypt = node(2, function (v) {
    var im = rockBase(ROCK_PAL.crypt, v);
    // carved rune / chisel marks
    var g = '#7ef0d0';
    if (v === 0) { px(im, 7, 7, g); px(im, 7, 8, g); px(im, 6, 9, g); px(im, 8, 9, g); px(im, 7, 10, alpha(g, 0.6)); }
    else { px(im, 5, 8, g); px(im, 6, 9, g); px(im, 5, 10, g); px(im, 11, 9, alpha(g, 0.7)); }
    outline(im, 'sel');
    return im;
  });
  NODES.rock_abyss = node(2, function (v) {
    var im = rockBase(ROCK_PAL.abyss, v);
    var crack = v ? [[4, 7], [5, 8], [5, 9], [6, 10], [11, 7], [12, 8]] : [[6, 6], [7, 7], [7, 8], [8, 9], [9, 9], [10, 10]];
    crack.forEach(function (p, i) { px(im, p[0], p[1], i % 2 ? '#c86cff' : '#ff7ae0'); });
    outline(im, 'sel');
    px(im, crack[0][0], crack[0][1] - 1, alpha('#ff9af0', 0.7));
    return im;
  });

  // ---- ore & gem rocks (neutral stone matrix) ---------------------------------
  var ORE_NODE = {
    ore_glimmer: { c: ['#a85a3a', '#ec9a6a', '#ffcc8a'], s: WHITE },
    ore_shadow: { c: [SHADOWI[2], SHADOWI[4], MV[4]], s: MV[4] },
    ore_starsilver: { c: [SILVER[2], SILVER[4], WHITE], s: WHITE }
  };
  Object.keys(ORE_NODE).forEach(function (k) {
    NODES[k] = node(2, function (v) {
      var O = ORE_NODE[k], im = rockBase(STONE, v);
      var spots = v ? [[4, 7], [7, 9], [11, 7], [12, 10], [5, 11]] : [[5, 6], [8, 8], [10, 6], [4, 10], [11, 10]];
      spots.forEach(function (p) {
        pxOn(im, p[0], p[1], O.c[1]); pxOn(im, p[0] + 1, p[1], O.c[0]); pxOn(im, p[0], p[1] + 1, O.c[0]); pxOn(im, p[0] - 1, p[1], O.c[2]);
      });
      outline(im, 'sel');
      sparkle(im, spots[0][0] - 1, spots[0][1] - 1, O.s);
      return im;
    });
  });
  var GEM_NODE = {
    gem_amethyst: [MV[0], MV[1], MV[2], MV[3], MV[4]],
    gem_emerald: ['#0e2e22', '#1a5a3a', '#2a8a52', '#3cbf6e', '#7eeaa0'],
    gem_moonstone: ['#6e7cb0', '#9fb0d8', '#c8d4f0', '#e8eeff', '#ffffff'],
    gem_quartz: ['#7a6a9a', '#b4a2d0', '#e0d4f4', '#f4ecff', '#ffffff'],
    gem_voidcrystal: [VOID[0], VOID[1], VOID[2], VOID[4], '#ff7ae0']
  };
  Object.keys(GEM_NODE).forEach(function (k) {
    NODES[k] = node(2, function (v) {
      var G = GEM_NODE[k], im = rockBase(STONE, v);
      var crystals = v ? [[4, 5, 3], [11, 6, 2], [8, 8, 2]] : [[6, 4, 3], [10, 6, 2], [4, 8, 2]];
      crystals.forEach(function (c) {
        var x = c[0], y = c[1], h = c[2];
        if (k === 'gem_moonstone') { blob(im, x + 0.5, y + 1.5, 1.4, 1.6, [G[1], G[2], G[3], G[4]]); return; }
        for (var i = 0; i < h + 1; i++) { px(im, x, y + i, G[3]); px(im, x + 1, y + i, G[2]); }
        px(im, x, y - 1, G[4]); px(im, x + 1, y + h + 1, G[1]); px(im, x, y + h + 1, G[2]);
      });
      outline(im, 'sel');
      px(im, crystals[0][0], crystals[0][1], WHITE);
      if (k === 'gem_voidcrystal') sparkle(im, crystals[1][0] + 2, crystals[1][1] - 1, '#ff9af0');
      return im;
    });
  });

  // ---- starshard cluster -------------------------------------------------------
  NODES.starshard = node(1, function () {
    var im = sprite([
      '................',
      '.......5........',
      '......545.......',
      '......4552......',
      '...5..4552......',
      '..452.4552..5...',
      '..4552455424552.',
      '..4552455244542.',
      '...45245524452..',
      '...452455245r...',
      '..rr4245524rRr..',
      '.rRRrrr42rrrrRr.',
      '.rrrrrrrrrrrrr..',
      '..ssssssssssss..',
      '................',
      '................'
    ], { 5: WHITE, 4: CANDLE, 2: '#b99aee', r: STONE[3], R: STONE[4], s: STONE[1] });
    // golden core tint
    [[7, 6], [7, 7], [7, 8], [4, 7], [11, 8]].forEach(function (p) { pxOn(im, p[0], p[1], '#ffe08a'); });
    outline(im, 'sel');
    sparkle(im, 3, 2, WHITE, true); sparkle(im, 13, 3, '#fff1c8'); px(im, 9, 4, WHITE);
    return im;
  });

  // ===========================================================================
  // EXPANSION — forest nodes (16x16, bottom-anchored)
  // ===========================================================================
  // ---- hollow log you can search -------------------------------------------------
  NODES.hollow_log_small = node(2, function (v) {
    var im = sprite([
      '................',
      '................',
      '................',
      '................',
      '....mMmm..mMm...',
      '..rRmmMwwmmmMw..',
      '.rRRrWWWWWWWWWw.',
      '.RkkRWwWWWwWWWd.',
      '.RkkkRwwwwwwwwd.',
      '.RkkkRWWWwWWWwd.',
      '.RkkRwwwwwwwwwd.',
      '.rRRrwdwwwwdwwd.',
      '..rrddddddddddd.',
      '...............',
      '................',
      '................'
    ], { r: TAN[2], R: TAN[3], k: '#0c0814', w: WOOD[2], W: WOOD[3], d: WOOD[1], m: FG[3], M: FG[5] });
    if (v === 1) {
      im = shift(im, 0, 0);
      var f = img(16, 16); blit(f, im, 0, 0, true); im = f;              // hollow end on the right
      stamp(im, 2, 3, ['.oO', 'ooo', '.s.'], { o: '#c4648e', O: '#e89ab8', s: '#e8e0d4' });   // a little toadstool
      stamp(im, 6, 3, ['.p', 'ps'], { p: MV[2], s: '#e8e0d4' });
    } else {
      stamp(im, 12, 3, ['.l', 'lL', 'l.'], { l: FG[4], L: FG[5] });     // fern sprig
    }
    outline(im, 'sel');
    return im;
  });

  // ---- bramble patch (cut it with the sword) --------------------------------------
  NODES.bramble_patch = node(2, function (v) {
    var im = img(16, 16), V = ['#2a2214', '#4a3a22', '#6a5a32', '#86763e'];
    var arcs = v ? [
      [[2, 13.4, 0.9], [3, 9, 0.9], [7, 5, 0.85], [11, 7, 0.8], [13, 12, 0.7]],
      [[8, 13.4, 0.9], [6, 9, 0.85], [3, 6, 0.75]],
      [[12, 13.4, 0.85], [11, 9, 0.8], [8, 8, 0.7]]
    ] : [
      [[1, 13.4, 0.9], [4, 7, 0.9], [9, 4, 0.85], [13, 8, 0.8], [14, 13, 0.7]],
      [[6, 13.4, 0.9], [8, 8, 0.85], [12, 6, 0.75]],
      [[10, 13.4, 0.85], [6, 10, 0.8], [2, 9, 0.7]]
    ];
    arcs.forEach(function (a) { tube(im, a, V); });
    // leaves
    (v ? [[4, 8], [10, 6], [12, 11], [6, 12]] : [[3, 9], [9, 5], [12, 9], [7, 11]]).forEach(function (p) { stamp(im, p[0], p[1], ['lh', 'm.'], { l: FG[3], h: FG[4], m: FG[2] }); });
    outline(im, 'sel');
    // thorns (red-tipped) and, on variant 1, a few dusky berries
    (v ? [[2, 8], [6, 4], [9, 5], [13, 9], [5, 10], [10, 9], [3, 12], [12, 13]] : [[3, 6], [8, 3], [12, 5], [14, 10], [6, 9], [9, 11], [2, 11], [11, 12]]).forEach(function (p) { px(im, p[0], p[1], '#c4485a'); });
    if (v) [[7, 7], [8, 8], [11, 11]].forEach(function (p) { px(im, p[0], p[1], PLUM[2]); px(im, p[0] - 1, p[1] - 1, PLUM[4]); });
    return shift(im, 0, -1);
  });

  // ---- sticky spider webs (Deepwood) -------------------------------------------------
  NODES.web_cluster = node(2, function (v) {
    var im = img(16, 16), S = '#e4e0f0', s = alpha('#c8c4dc', 0.75), d = alpha('#a8a4c0', 0.55);
    if (v === 0) {
      // an orb web strung between two twigs
      stamp(im, 0, 3, ['k.', 'kk', '.k', '.k', '.k', '.k', '.k', '.k', '.k', 'kk', 'k.'], { k: WOOD[2] });
      stamp(im, 14, 1, ['.k', 'kk', 'k.', 'k.', 'k.', 'k.', 'k.', 'k.', 'k.', 'k.', 'k.', 'kk', '.k'], { k: WOOD[2] });
      outline(im, 'sel');
      var cx = 7.5, cy = 7.5;
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4 + 0.2;
        line(im, Math.round(cx), Math.round(cy), Math.round(cx + Math.cos(a) * 6.4), Math.round(cy + Math.sin(a) * 6.0), S);
      }
      [2.4, 4.4].forEach(function (r) {
        for (var t = 0; t < 40; t++) { var b = t * Math.PI / 20; px(im, Math.round(cx + Math.cos(b) * r), Math.round(cy + Math.sin(b) * r * 0.92), r < 3 ? s : d); }
      });
      px(im, 7, 7, WHITE); px(im, 8, 8, WHITE);
      line(im, 2, 13, 5, 12, s); line(im, 13, 13, 10, 12, s);
    } else {
      // a sheet web over the ground holding a wrapped cocoon
      stamp(im, 1, 10, ['g.....', 'gg....', '.g....'], { g: GR[3] });
      stamp(im, 11, 9, ['..g.', '.gg.', 'g.g.', '..g.'], { g: GR[3] });
      blob(im, 8, 9.5, 1.6, 2.4, ['#a8a4c0', '#d8d4e8', '#f4f2fb']);
      outline(im, 'sel');
      [[1, 11, 8, 12], [8, 12, 14, 11], [2, 13, 13, 13], [4, 10, 8, 7], [12, 9, 9, 7], [3, 14, 7, 12], [12, 14, 9, 12]].forEach(function (l, i) { line(im, l[0], l[1], l[2], l[3], i < 3 ? S : s); });
      [[7, 8], [8, 10], [9, 9]].forEach(function (p) { px(im, p[0], p[1], '#c8c4dc'); });
      px(im, 7, 7, WHITE);
    }
    return im;
  });

  // ---- tall glowing mushroom (harvestable) -------------------------------------------
  NODES.glowshroom_big = node(2, function (v) {
    var C = v ? ['#3a1a52', '#6a2e8a', '#a84ad0', '#e07af0', '#ffc8ff'] : ['#123a4a', '#1e6a7a', '#3cb8c8', '#7ef0ff', '#d6fcff'];
    var G = v ? '#ff9af0' : '#b4faff';
    var im = img(16, 16);
    // stem
    tube(im, [[7.6, 13.2, 1.4], [7.8, 9, 1.2], [7.6, 6, 1.1]], ['#9fb0d8', '#c8d4f0', '#e8eeff', '#ffffff']);
    // cap + glowing gills underneath
    ellipse(im, 7.5, 4.4, 6.2, 3.4, function (x, y, dx, dy) { return dy > 0.35 ? null : (dx + dy < -0.55 ? C[4] : dx + dy < -0.1 ? C[3] : dx + dy < 0.45 ? C[2] : C[1]); });
    hline(im, 2, 13, 5, C[1]); hline(im, 3, 12, 6, C[0]);
    // baby mushrooms at the foot
    stamp(im, 2, 11, ['.cc.', 'cCcc', '.s..', '.s..'], { c: C[2], C: C[3], s: '#c8d4f0' });
    stamp(im, 11, 12, ['cC', 's.', 's.'], { c: C[2], C: C[3], s: '#c8d4f0' });
    outline(im, 'sel');
    // luminous spots + glow motes
    [[5, 2], [9, 1], [11, 3], [4, 4], [8, 3]].forEach(function (p, i) { px(im, p[0], p[1], i % 2 ? WHITE : G); });
    [[5, 6], [7, 6], [9, 6], [11, 6]].forEach(function (p) { px(im, p[0], p[1], alpha(G, 0.9)); });
    px(im, 1, 8, alpha(G, 0.8)); px(im, 14, 9, alpha(G, 0.6)); px(im, 13, 1, alpha(G, 0.7));
    return shift(im, 0, -1);
  });

  // ===========================================================================
  // Unknown id -> "?" rune stone
  // ===========================================================================
  function unknownRaw() {
    var im = sprite([
      '................',
      '................',
      '.....234443.....',
      '....23455443....',
      '...2345555443...',
      '...2345555432...',
      '...2345555432...',
      '...2345555432...',
      '...2345555432...',
      '...2345555432...',
      '...2344444432...',
      '...1233333321...',
      '....12222221....',
      '................',
      '................',
      '................'
    ], legend(['012345', COBBLE.concat(['#a89cc6', '#c4b8de'])]));
    stamp(im, 6, 4, [
      '.ggg.',
      'g...g',
      '...g.',
      '..g..',
      '.....',
      '..g..'
    ], { g: '#7ef0ff' });
    stamp(im, 6, 5, [
      '.....',
      '.....',
      '....k',
      '...k.',
      '.....',
      '...k.'
    ], { k: '#2a6a8a' });
    outline(im, 'sel');
    return im;
  }

  // ===========================================================================
  // Public API (+ caches). Browser -> canvas; node -> ItemArt._raw.*
  // ===========================================================================
  var rawCache = Object.create(null), cvCache = Object.create(null);
  function cached(key, fn) {
    var r = rawCache[key];
    if (r === undefined) {
      try { r = fn(); } catch (e) { r = null; if (typeof console !== 'undefined' && console.warn) console.warn('ItemArt: failed to draw ' + key, e); }
      rawCache[key] = r;
    }
    return r;
  }
  function rawIcon(id) {
    id = String(id);
    var f = ICONS[id];
    if (!f) return cached('icon:?', unknownRaw);
    return cached('icon:' + id, f) || cached('icon:?', unknownRaw);
  }
  function rawTool(kind, tier) {
    kind = String(kind); tier = clamp((tier | 0), 0, 3);
    if (!TOOL_GRIDS[kind]) return cached('icon:?', unknownRaw);
    return cached('tool:' + kind + ':' + tier, function () { return toolRaw(kind, tier); });
  }
  function rawCrop(id, stage) {
    stage = clamp(stage | 0, 0, 4);
    if (!CROPS[id]) return cached('crop:?', function () { return img(16, 32); });
    return cached('crop:' + id + ':' + stage, function () { return CROPS[id](stage); });
  }
  function rawRegrow(id) {
    if (!REGROW[id]) return rawCrop(id, 3);
    return cached('regrow:' + id, function () { return REGROW[id](); });
  }
  function rawObject(id, state, frame, potion) {
    var o = OBJECTS[id];
    if (!o) return cached('obj:?', function () { var im = img(16, 32); blit(im, unknownRaw(), 0, 16); return im; });
    var st = o.states[state] ? state : o.def;
    var n = o.states[st];
    frame = ((frame | 0) % n + n) % n;
    var tint = (id === 'cauldron' && st === 'done' && POT_LIQ[potion]) ? potion : '';
    return cached('obj:' + id + ':' + st + ':' + frame + ':' + tint, function () { return o.draw(st, frame, tint); });
  }
  function rawNode(kind, variant) {
    var nd = NODES[kind];
    if (!nd) return cached('icon:?', unknownRaw);
    var n = nd.n;
    variant = ((variant | 0) % n + n) % n;
    return cached('node:' + kind + ':' + variant, function () { return nd.draw(variant); });
  }

  // geode cracking animation: 6 frames, 32x32 (unknown ids fall back to the moon geode)
  function rawGeodeFrames(id) {
    if (!GEODE[id]) id = 'geode_moon';
    return cached('geo:' + id, function () { var a = []; for (var f = 0; f < 6; f++) a.push(geodeFrame(id, f)); return a; });
  }
  var HAS_DOM = typeof document !== 'undefined' && document && typeof document.createElement === 'function';
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
    if (!HAS_DOM) return r;               // node: hand back the raw buffer
    var c = cvCache[key];
    if (!c) { c = toCanvas(r); cvCache[key] = c; }
    return c;
  }

  // ids in DESIGN.md §6 order (extras last)
  var CANON = ('hoe can pickaxe axe sword_rusty sword_silver sword_star sword_umbral wand_apprentice wand_ember wand_astral rod ' +
    'seed_moonpetal seed_glowcap seed_mandrake seed_frostmint seed_emberroot seed_duskberry seed_starbloom seed_wispvine seed_phialvine seed_starflask ' +
    'moonpetal glowcap mandrake frostmint emberroot duskberry starbloom wispbloom ' +
    'fairycap wolfsbane moonlily feather starshard bog_amber driftwood shell pearl honey ' +
    'wood stone fiber ore_glimmer ore_shadow ore_starsilver amethyst emerald moonstone quartz voidcrystal ' +
    'slime_gel bat_wing spider_silk bone_dust ectoplasm arcane_dust golem_core void_essence spore_sac ' +
    'fish_glimmerfin fish_mooncarp fish_mistperch fish_ghosteel fish_lanternpike fish_crownjaw ' +
    'pot_healing pot_vigor pot_swift pot_ember pot_mandrake pot_frostward pot_starlight pot_shadow pot_fairy pot_tide pot_moon sludge ' +
    'food_bread food_stew food_pie food_mead food_tea food_coffee cauldron dewcrystal moonmulch glimmer letter chest ' +
    // expansion (DESIGN2.md)
    'drink_fizz drink_moonmilk drink_dragon drink_frostberry drink_mistwine drink_hollow ' +
    'snack_sweets snack_toffee snack_jellies food_honeycake food_pasty food_gazypie food_chili food_gingerghost food_glowtoast food_moonpudding food_spellscroll food_starbun ' +
    'cl_hat_wizard cl_hat_witch cl_hat_tricorn cl_hat_beret cl_hat_hood cl_hat_crown cl_hat_tophat cl_hat_circlet ' +
    'cl_cloak_midnight cl_cloak_ember cl_cloak_moss cl_cloak_raven cl_cloak_silver ' +
    'cl_outfit_scholar cl_outfit_alchemist cl_outfit_bard cl_outfit_duelist cl_outfit_moonweave cl_outfit_ranger ' +
    'treasure_map old_key relic_coin relic_idol relic_star relic_locket relic_bell relic_feather golden_acorn ' +
    'thorn_bramble wisp_essence wolf_fang antler_shard pot_wisplight pot_thornhide pot_mana ' +
    'spellbook spell_lumen spell_verdance spell_blink spell_frostbolt scroll_spell sky_lantern festival_token prize_ribbon fam_treat ' +
    // round 3 (DESIGN3.md)
    'geode_moon geode_ember geode_void geode_star ' +
    'min_lunarite min_moonglass min_silvervein min_moth_fossil min_tidestone min_crescent_agate ' +
    'min_emberstone min_phoenix_tear min_lava_opal min_salamander_fossil min_cinnabar min_smokequartz ' +
    'min_void_eye min_obsidian min_nightglass min_ammonite min_wraith_opal min_hollow_heart ' +
    'min_starheart min_comet_glass min_meteorite min_celestite min_aurora min_wishing_stone ' +
    'bp_sprinkler bp_warp bp_charm bp_lamp bp_hammer bp_scarecrow bp_saddle bp_trophy ' +
    'dew_sprinkler warp_rune lucky_charm moonlit_lamp geode_hammer moon_scarecrow trophy_case lucky_rune ' +
    'pet_treat pet_toy saddle_swift saddle_starlit dragon_harness silver_whistle ' +
    'pet_kitten pet_puppy pet_bunny pet_hatchling pet_crystalfox horse_midnight horse_silver horse_chestnut dragon_amethyst dragon_emerald dragon_ember ' +
    'bouquet pendant contract guild_badge_1 guild_badge_2 guild_badge_3 guild_badge_4 ' +
    'trophy_gloopgarr trophy_grimjaw trophy_lantern trophy_wyrm lore_page sword_starforged').split(' ');
  var IDS = CANON.filter(function (id) { return !!ICONS[id]; });
  ICON_ORDER.forEach(function (id) { if (IDS.indexOf(id) < 0) IDS.push(id); });
  var CROP_IDS = ['moonpetal', 'glowcap', 'mandrake', 'frostmint', 'emberroot', 'duskberry', 'starbloom', 'wispvine', 'phialvine', 'starflask'];
  var NODE_KINDS = Object.keys(NODES);
  var NODE_VARIANTS = {};
  NODE_KINDS.forEach(function (k) { NODE_VARIANTS[k] = NODES[k].n; });
  var OBJECT_STATES = {};
  Object.keys(OBJECTS).forEach(function (k) { OBJECT_STATES[k] = {}; for (var s in OBJECTS[k].states) OBJECT_STATES[k][s] = OBJECTS[k].states[s]; });

  var ItemArt = {
    icon: function (id) { var r = rawIcon(id); return canvasOf('i:' + (ICONS[id] ? id : '?'), r); },
    toolIcon: function (kind, tier) { tier = clamp(tier | 0, 0, 3); return canvasOf('t:' + kind + ':' + tier, rawTool(kind, tier)); },
    crop: function (id, stage) { stage = clamp(stage | 0, 0, 4); return canvasOf('c:' + id + ':' + stage, rawCrop(id, stage)); },
    cropRegrow: function (id) { return canvasOf('r:' + id, rawRegrow(id)); },
    // optional 4th arg: potion id to tint a finished cauldron ('done') with that potion's colour
    object: function (id, state, frame, potion) {
      var o = OBJECTS[id], st = o && o.states[state] ? state : (o ? o.def : '?');
      var n = o ? o.states[st] : 1, f = ((frame | 0) % n + n) % n;
      var tint = (id === 'cauldron' && st === 'done' && POT_LIQ[potion]) ? potion : '';
      return canvasOf('o:' + id + ':' + st + ':' + f + ':' + tint, rawObject(id, state, frame, potion));
    },
    node: function (kind, variant) {
      var nd = NODES[kind], n = nd ? nd.n : 1, v = ((variant | 0) % n + n) % n;
      return canvasOf('n:' + kind + ':' + v, rawNode(kind, variant));
    },
    // 6 canvases (32x32): intact, hairline crack, glowing crack, split, halves with crystals, burst of light
    geodeFrames: function (id) {
      var key = GEODE[id] ? id : 'geode_moon', raw = rawGeodeFrames(key);
      return raw.map(function (r, f) { return canvasOf('g:' + key + ':' + f, r); });
    },
    geodeIds: ['geode_moon', 'geode_ember', 'geode_void', 'geode_star'],
    ids: IDS.slice(),
    cropIds: CROP_IDS.slice(),
    regrowIds: Object.keys(REGROW),
    nodeKinds: NODE_KINDS.slice(),
    nodeVariants: NODE_VARIANTS,
    objectStates: OBJECT_STATES,
    toolKinds: ['hoe', 'can', 'pickaxe', 'axe'],
    has: function (id) { return !!ICONS[id]; },
    _raw: {
      icon: rawIcon, toolIcon: rawTool, crop: rawCrop, cropRegrow: rawRegrow, object: rawObject, node: rawNode, geodeFrames: rawGeodeFrames
    }
  };
  ROOT.ItemArt = ItemArt;
})();
