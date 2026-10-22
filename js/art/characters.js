/* NIGHTVALE — js/art/characters.js
 * Procedural character pixel art: 64x64 portraits (9 NPCs + player), 20x32 overworld
 * walk sprites, and the cat familiar Inkwell. Everything is set pixel-by-pixel into
 * small RGBA buffers (true 1x pixel art), converted to cached <canvas> in the browser.
 * Defines exactly one global: window.CharArt  (node: CharArt._raw returns {w,h,data}).
 */
(function () {
  'use strict';
  var ROOT = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var HAS_DOM = typeof document !== 'undefined' && !!document && typeof document.createElement === 'function';

  /* ================================================================== colour */
  function H(s) { return parseInt(s.charAt(0) === '#' ? s.slice(1) : s, 16); }
  function HS(a) { return a.map(H); }
  function mix(a, b, t) {
    var ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    var br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
  }
  function lum(c) { return (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255; }
  var OUT = H('#120c1c');
  var WHITE = 0xffffff;
  var RIM1 = H('#8f6cd1'), RIM2 = H('#b99aee');

  var TAG = { NONE: 0, SKIN: 1, HAIR: 2, CLOTH: 3, HAT: 4, METAL: 5, EYE: 6, MOUTH: 7, BEARD: 8, ACC: 9, LINE: 10, GLASS: 11, NORIM: 12, BROW: 13 };

  /* ================================================================== raster toolkit */
  // Close-up portrait styles draw each character's own design through a zoom transform XF (null for
  // every other render, which leaves those paths untouched). While XF is set, shapes (ellipses, polygons,
  // mask predicates, beziers, thick strokes) are re-rasterised at frame resolution, an integer design
  // pixel covers its whole footprint, and the fractional coordinates handed out by Mask.each/fn/keep and
  // bez address exactly one frame pixel.
  var XF = null;
  function isI(v) { return v === Math.floor(v); }
  function fxX(x) { return XF.PX + XF.s * (x - XF.px); }
  function fxY(y) { return XF.fy ? XF.fy(y) : XF.PY + XF.s * (y - XF.py); }
  function dzX(X) { var v = XF.px + (X + 0.5 - XF.PX) / XF.s - 0.5; return isI(v) ? v + 1e-7 : v; }
  function dzY(Y) { var v = XF.iy ? XF.iy[Y] : XF.py + (Y + 0.5 - XF.PY) / XF.s - 0.5; if (v === undefined) v = XF.py + (Y + 0.5 - XF.PY) / XF.s - 0.5; return isI(v) ? v + 1e-7 : v; }
  function ptX(x) { return Math.floor(fxX(x + 0.5)); }
  function ptY(y) { return Math.floor(fxY(y + 0.5)); }
  function spX(x) {
    if (XF.sym) { var a = fxX(x), b = fxX(x + 1); return b <= XF.PX ? [Math.floor(a - 0.5) + 1, Math.floor(b - 0.5)] : [Math.ceil(a - 0.5), Math.ceil(b - 0.5) - 1]; } // ties round towards the centre line: mirrored details stay mirrored
    return [Math.ceil(fxX(x) - 0.5), Math.ceil(fxX(x + 1) - 0.5) - 1];
  }
  // texture coordinates: the design's integer grid, or frame pixels in the human_hd zoom (keeps knit, curls and stubble crisp)
  function ti(x) { return XF && XF.sym ? ptX(x) : x; }
  function tj(y) { return XF && XF.sym ? ptY(y) : y; }
  function spY(y) { return [Math.ceil(fxY(y) - 0.5), Math.ceil(fxY(y + 1) - 0.5) - 1]; }

  function Buf(w, h) { this.w = w; this.h = h; this.c = new Int32Array(w * h); this.c.fill(-1); this.t = new Uint8Array(w * h); this.xf = false; }
  var BP = Buf.prototype;
  BP.setF = function (x, y, c, t) {
    if (c === undefined || c === null || c < 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    var i = y * this.w + x; this.c[i] = c; if (t !== undefined) this.t[i] = t;
  };
  BP.getF = function (x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1; return this.c[y * this.w + x]; };
  BP.tgF = function (x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.t[y * this.w + x]; };
  BP.set = function (x, y, c, t) {
    if (c === undefined || c === null || c < 0) return;
    if (this.xf && XF) {
      if (isI(x) && isI(y)) { var a = spX(x), b = spY(y); for (var Y = b[0]; Y <= b[1]; Y++) for (var X = a[0]; X <= a[1]; X++) this.setF(X, Y, c, t); }
      else this.setF(ptX(x), ptY(y), c, t);
      return;
    }
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    var i = y * this.w + x; this.c[i] = c; if (t !== undefined) this.t[i] = t;
  };
  BP.get = function (x, y) { if (this.xf && XF) return this.getF(ptX(x), ptY(y)); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1; return this.c[y * this.w + x]; };
  BP.tg = function (x, y) { if (this.xf && XF) return this.tgF(ptX(x), ptY(y)); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.t[y * this.w + x]; };
  BP.op = function (x, y) { return this.get(x, y) >= 0; };
  BP.delF = function (x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; var i = y * this.w + x; this.c[i] = -1; this.t[i] = 0; };
  BP.del = function (x, y) {
    if (this.xf && XF) {
      if (isI(x) && isI(y)) { var a = spX(x), b = spY(y); for (var Y = b[0]; Y <= b[1]; Y++) for (var X = a[0]; X <= a[1]; X++) this.delF(X, Y); }
      else this.delF(ptX(x), ptY(y));
      return;
    }
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; var i = y * this.w + x; this.c[i] = -1; this.t[i] = 0;
  };
  BP.rect = function (x, y, w, h, c, t) { for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) this.set(i, j, c, t); };
  BP.hline = function (x0, x1, y, c, t) {
    if (x0 > x1) { var s = x0; x0 = x1; x1 = s; }
    if (this.xf && XF && !(isI(x0) && isI(x1) && isI(y))) { for (var X = Math.floor(fxX(x0)); X <= Math.ceil(fxX(x1 + 1)) - 1; X++) this.setF(X, ptY(y), c, t); return; }
    for (var x = x0; x <= x1; x++) this.set(x, y, c, t);
  };
  BP.vline = function (x, y0, y1, c, t) {
    if (y0 > y1) { var s = y0; y0 = y1; y1 = s; }
    if (this.xf && XF && !(isI(y0) && isI(y1) && isI(x))) { for (var Y = Math.floor(fxY(y0)); Y <= Math.ceil(fxY(y1 + 1)) - 1; Y++) this.setF(ptX(x), Y, c, t); return; }
    for (var y = y0; y <= y1; y++) this.set(x, y, c, t);
  };
  BP.line = function (x0, y0, x1, y1, c, t) {
    var fr = this.xf && XF;
    if (fr) { x0 = ptX(x0); y0 = ptY(y0); x1 = ptX(x1); y1 = ptY(y1); }
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) { if (fr) this.setF(x0, y0, c, t); else this.set(x0, y0, c, t); if (x0 === x1 && y0 === y1) break; var e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  };
  BP.pts = function (pts, c, t) { for (var i = 0; i < pts.length; i++) this.set(pts[i][0], pts[i][1], c, t); };
  BP.fill = function (M, c, t) { var self = this; M.each(function (x, y) { self.set(x, y, typeof c === 'function' ? c(x, y) : c, t); }); };
  BP.clone = function () { var o = new Buf(this.w, this.h); o.c.set(this.c); o.t.set(this.t); o.xf = this.xf; return o; };
  BP.flipX = function () {
    var o = new Buf(this.w, this.h), w = this.w; o.xf = this.xf;
    for (var y = 0; y < this.h; y++) for (var x = 0; x < w; x++) { o.c[y * w + (w - 1 - x)] = this.c[y * w + x]; o.t[y * w + (w - 1 - x)] = this.t[y * w + x]; }
    return o;
  };
  BP.blit = function (src, dx, dy) {
    for (var y = 0; y < src.h; y++) for (var x = 0; x < src.w; x++) { var c = src.c[y * src.w + x]; if (c >= 0) this.set(x + dx, y + dy, c, src.t[y * src.w + x]); }
  };
  BP.rgba = function () {
    var d = new Uint8ClampedArray(this.w * this.h * 4);
    for (var i = 0; i < this.c.length; i++) { var c = this.c[i]; if (c < 0) continue; d[i * 4] = (c >> 16) & 255; d[i * 4 + 1] = (c >> 8) & 255; d[i * 4 + 2] = c & 255; d[i * 4 + 3] = 255; }
    return d;
  };

  function Mask(w, h) { this.w = w || 64; this.h = h || 64; this.m = new Uint8Array(this.w * this.h); this.xf = !!XF; }
  var MP = Mask.prototype;
  MP.hasF = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h && this.m[y * this.w + x] === 1; };
  MP.has = function (x, y) { if (this.xf && XF) return this.hasF(ptX(x), ptY(y)); return x >= 0 && y >= 0 && x < this.w && y < this.h && this.m[y * this.w + x] === 1; };
  MP.putF = function (x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.m[y * this.w + x] = (v === undefined ? 1 : v); return this; };
  MP.put = function (x, y, v) {
    if (this.xf && XF) {
      if (isI(x) && isI(y)) { var a = spX(x), b = spY(y); for (var Y = b[0]; Y <= b[1]; Y++) for (var X = a[0]; X <= a[1]; X++) this.putF(X, Y, v); }
      else this.putF(ptX(x), ptY(y), v);
      return this;
    }
    x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.m[y * this.w + x] = (v === undefined ? 1 : v); return this;
  };
  MP.ellipse = function (cx, cy, rx, ry, v) {
    var fr = this.xf && XF;
    if (fr && XF.fy) { // non-linear vertical map: test the design ellipse at each frame pixel
      var ya = Math.max(0, Math.floor(fxY(cy - ry)) - 1), yb = Math.min(this.h - 1, Math.ceil(fxY(cy + ry)) + 1), xa = Math.max(0, Math.floor(fxX(cx - rx)) - 1), xb = Math.min(this.w - 1, Math.ceil(fxX(cx + rx)) + 1);
      for (var Y = ya; Y <= yb; Y++) { var ey = (dzY(Y) + 0.5 - cy) / ry; for (var X = xa; X <= xb; X++) { var ex = (dzX(X) + 0.5 - cx) / rx; if (ex * ex + ey * ey <= 1.0001) this.putF(X, Y, v); } }
      return this;
    }
    if (fr) { cx = fxX(cx); cy = fxY(cy); rx *= XF.s; ry *= XF.s; }
    var y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1), x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1.0001) { if (fr) this.putF(x, y, v); else this.put(x, y, v); }
    }
    return this;
  };
  MP.ellipseF = function (cx, cy, rx, ry, v) { // frame-pixel ellipse (close-up helpers)
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1.0001) this.putF(x, y, v);
    }
    return this;
  };
  MP.poly = function (pts, v) {
    var fr = this.xf && XF;
    if (fr && XF.fy) { // non-linear vertical map: even-odd test in design space per frame pixel
      var y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9, n = pts.length;
      pts.forEach(function (p) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); });
      var ya = Math.max(0, Math.floor(fxY(y0)) - 1), yb = Math.min(this.h - 1, Math.ceil(fxY(y1)) + 1), xa = Math.max(0, Math.floor(fxX(x0)) - 1), xb = Math.min(this.w - 1, Math.ceil(fxX(x1)) + 1);
      for (var Y = ya; Y <= yb; Y++) {
        var yc = dzY(Y) + 0.5, xs = [];
        for (var q = 0; q < n; q++) { var a = pts[q], b = pts[(q + 1) % n]; if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
        if (xs.length < 2) continue;
        xs.sort(function (p, q2) { return p - q2; });
        for (var X = xa; X <= xb; X++) { var xc = dzX(X) + 0.5, inside = false; for (var j = 0; j + 1 < xs.length; j += 2) if (xc >= xs[j] && xc < xs[j + 1]) { inside = true; break; } if (inside) this.putF(X, Y, v); }
      }
      return this;
    }
    if (fr) pts = pts.map(function (p) { return [fxX(p[0]), fxY(p[1])]; });
    var minY = 1e9, maxY = -1e9, i;
    for (i = 0; i < pts.length; i++) { minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]); }
    for (var y = Math.floor(minY) - 1; y <= Math.ceil(maxY) + 1; y++) {
      var yc = y + 0.5, xs = [];
      for (i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort(function (p, q) { return p - q; });
      for (var k = 0; k + 1 < xs.length; k += 2) for (var x = Math.ceil(xs[k] - 0.5); x + 0.5 < xs[k + 1]; x++) { if (fr) this.putF(x, y, v); else this.put(x, y, v); }
    }
    return this;
  };
  MP.rect = function (x, y, w, h, v) { for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) this.put(i, j, v); return this; };
  MP.hline = function (x0, x1, y, v) { for (var x = x0; x <= x1; x++) this.put(x, y, v); return this; };
  MP.fn = function (f, v) {
    var y, x;
    if (this.xf && XF) { for (y = 0; y < this.h; y++) for (x = 0; x < this.w; x++) if (f(dzX(x), dzY(y))) this.putF(x, y, v); return this; }
    for (y = 0; y < this.h; y++) for (x = 0; x < this.w; x++) if (f(x, y)) this.put(x, y, v); return this;
  };
  MP.keep = function (f) {
    var fr = this.xf && XF;
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) if (this.m[y * this.w + x] && !(fr ? f(dzX(x), dzY(y)) : f(x, y))) this.m[y * this.w + x] = 0; return this;
  };
  MP.each = function (f) {
    var fr = this.xf && XF;
    for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) if (this.m[y * this.w + x]) { if (fr) f(dzX(x), dzY(y)); else f(x, y); }
  };
  MP.eachF = function (f) { for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) if (this.m[y * this.w + x]) f(x, y); };
  MP.or = function (o) { for (var i = 0; i < this.m.length; i++) if (o.m[i]) this.m[i] = 1; return this; };
  MP.and = function (o) { for (var i = 0; i < this.m.length; i++) if (!o.m[i]) this.m[i] = 0; return this; };
  MP.sub = function (o) { for (var i = 0; i < this.m.length; i++) if (o.m[i]) this.m[i] = 0; return this; };
  MP.clone = function () { var o = new Mask(this.w, this.h); o.m.set(this.m); o.xf = this.xf; return o; };
  MP.flipX = function () { var o = new Mask(this.w, this.h); o.xf = this.xf; for (var y = 0; y < this.h; y++) for (var x = 0; x < this.w; x++) o.m[y * this.w + this.w - 1 - x] = this.m[y * this.w + x]; return o; };
  MP.sym = function () { return this.or(this.flipX()); };
  MP.thick = function (pts, r) {
    var self = this;
    if (this.xf && XF) {
      var R = r * XF.s, lim = R * R + R * 0.6;
      pts.forEach(function (p) {
        var cx = fxX(p[0] + 0.5), cy = fxY(p[1] + 0.5);
        self.putF(Math.floor(cx), Math.floor(cy));
        for (var Y = Math.floor(cy - R - 1); Y <= Math.ceil(cy + R + 1); Y++) for (var X = Math.floor(cx - R - 1); X <= Math.ceil(cx + R + 1); X++) { var dx = X + 0.5 - cx, dy = Y + 0.5 - cy; if (dx * dx + dy * dy <= lim) self.putF(X, Y); }
      });
      return this;
    }
    pts.forEach(function (p) { for (var j = -r; j <= r; j++) for (var i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * 0.6) self.put(p[0] + i, p[1] + j); }); return this;
  };
  function M64() { return XF ? new Mask(XF.W || 64, XF.H || 64) : new Mask(64, 64); }

  // pixel-perfect bezier (control points in pixel coords); under XF the curve is traced in frame pixels
  function bez(cp) {
    if (XF) return bezCore(cp.map(function (p) { return [fxX(p[0] + 0.5) - 0.5, fxY(p[1] + 0.5) - 0.5]; })).map(function (p) { return [dzX(p[0]), dzY(p[1])]; });
    return bezCore(cp);
  }
  function bezCore(cp) {
    var len = 0, i;
    for (i = 0; i + 1 < cp.length; i++) len += Math.abs(cp[i + 1][0] - cp[i][0]) + Math.abs(cp[i + 1][1] - cp[i][1]);
    var n = Math.max(4, Math.ceil(len * 4)), raw = [];
    for (var s = 0; s <= n; s++) {
      var t = s / n, q = cp.map(function (p) { return [p[0], p[1]]; });
      for (var k = q.length - 1; k > 0; k--) for (var j = 0; j < k; j++) { q[j][0] += (q[j + 1][0] - q[j][0]) * t; q[j][1] += (q[j + 1][1] - q[j][1]) * t; }
      var px = Math.round(q[0][0]), py = Math.round(q[0][1]), last = raw[raw.length - 1];
      if (!last || last[0] !== px || last[1] !== py) raw.push([px, py]);
    }
    var res = [];
    for (i = 0; i < raw.length; i++) {
      if (res.length && i < raw.length - 1) { var a = res[res.length - 1], c = raw[i + 1]; if (Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1) continue; }
      res.push(raw[i]);
    }
    return res;
  }
  // stamp: rows of chars, legend char -> colour (int) or [colour, tag]; '.'/' ' are transparent
  function stamp(B, rows, x, y, legend, tag, flip) {
    var w = stampW(rows), r, i, one = !!(B.xf && XF && Math.max(w, rows.length) <= 6), X0 = 0, Y0 = 0;
    if (one) { X0 = Math.round(fxX(x + w / 2) - w / 2); Y0 = Math.round(fxY(y + rows.length / 2) - rows.length / 2); } // small details stay crisp 1:1 in a close-up
    for (r = 0; r < rows.length; r++) for (i = 0; i < rows[r].length; i++) {
      var ch = rows[r].charAt(i); if (ch === '.' || ch === ' ') continue;
      var v = legend[ch]; if (v === undefined || v === null) continue;
      var col = v, tg = tag;
      if (typeof v === 'object') { col = v[0]; tg = v[1]; }
      if (one) B.setF(X0 + (flip ? w - 1 - i : i), Y0 + r, col, tg);
      else B.set(flip ? x + (w - 1 - i) : x + i, y + r, col, tg);
    }
  }
  function stampF(B, rows, x, y, legend, tag, flip) { // frame pixels, no transform
    var w = stampW(rows);
    for (var r = 0; r < rows.length; r++) for (var i = 0; i < rows[r].length; i++) {
      var ch = rows[r].charAt(i); if (ch === '.' || ch === ' ') continue;
      var v = legend[ch]; if (v === undefined || v === null) continue;
      B.setF(flip ? x + (w - 1 - i) : x + i, y + r, typeof v === 'object' ? v[0] : v, typeof v === 'object' ? v[1] : tag);
    }
  }
  function stampW(rows) { var w = 0; for (var r = 0; r < rows.length; r++) w = Math.max(w, rows[r].length); return w; }
  function sym(B, list, col, tag) { list.forEach(function (p) { B.set(p[0], p[1], col, tag); B.set(63 - p[0], p[1], col, tag); }); }

  /* ---------------------------------------------------------------- shading */
  var LX = -0.55, LY = -0.62, LZ = 0.56; // towards the light: top-left, in front
  function sph(x, y, cx, cy, rx, ry) {
    var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny;
    if (d > 1) { var s = 1 / Math.sqrt(d); nx *= s; ny *= s; d = 1; }
    return nx * LX + ny * LY + Math.sqrt(Math.max(0, 1 - d)) * LZ;
  }
  function steps(M, x, y, dx, dy, max) { for (var s = 1; s <= max; s++) if (!M.has(x + dx * s, y + dy * s)) return s; return max + 1; }
  // fill a mask with sphere lighting quantised onto a ramp (dark -> light)
  function shadeFill(B, M, ramp, tag, o) {
    var th = o.th || (ramp.length === 2 ? [0.2] : ramp.length === 3 ? [0.02, 0.5] : ramp.length === 4 ? [-0.3, 0.12, 0.6] : [-0.45, -0.1, 0.3, 0.72]);
    var rx = o.rx || 20, ry = o.ry || rx;
    M.each(function (x, y) {
      var v = sph(x, y, o.cx, o.cy, rx, ry);
      if (o.edge) { var e = steps(M, x, y, 1, 1, 2); if (e === 1) v -= o.edge; else if (e === 2) v -= o.edge * 0.45; }
      if (o.edgeB) { var eb = steps(M, x, y, 0, 1, 2); if (eb === 1) v -= o.edgeB; else if (eb === 2) v -= o.edgeB * 0.4; }
      if (o.lift) { var e2 = steps(M, x, y, -1, -1, 1); if (e2 === 1) v += o.lift; }
      if (o.bias) v += typeof o.bias === 'function' ? o.bias(x, y) : o.bias;
      var k = 0; while (k < th.length && v > th[k]) k++;
      B.set(x, y, ramp[k], tag);
    });
    if (o.clean !== false) cleanOrphans(B, M);
  }
  function cleanOrphans(B, M) {
    var w = B.w, src = B.c.slice(), D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    M.eachF(function (x, y) {
      var c = src[y * w + x], same = 0, n = [];
      for (var k = 0; k < 4; k++) { var xx = x + D[k][0], yy = y + D[k][1]; if (!M.hasF(xx, yy)) continue; var cc = src[yy * w + xx]; n.push(cc); if (cc === c) same++; }
      if (same === 0 && n.length >= 3) {
        var best = n[0], bc = 0;
        for (var a = 0; a < n.length; a++) { var cnt = 0; for (var b = 0; b < n.length; b++) if (n[b] === n[a]) cnt++; if (cnt > bc) { bc = cnt; best = n[a]; } }
        B.c[y * w + x] = best;
      }
    });
  }
  // recolour mask pixels that touch something outside the mask for which test() is true
  function innerLine(B, M, col, test, dirs) {
    var hits = [], D = dirs || [[0, 1], [1, 0], [-1, 0], [0, -1]];
    M.eachF(function (x, y) {
      for (var k = 0; k < D.length; k++) { var xx = x + D[k][0], yy = y + D[k][1]; if (M.hasF(xx, yy)) continue; if (test(B.tgF(xx, yy), B.getF(xx, yy), D[k])) { hits.push([x, y]); break; } }
    });
    for (var i = 0; i < hits.length; i++) { var j = hits[i][1] * B.w + hits[i][0]; B.c[j] = CUR_STYLE && CUR_STYLE.lineless ? mix(B.c[j], col, 0.5) : col; }
  }
  // mask boundary (pixels with a neighbour outside the mask in one of dirs)
  function edgePx(M, dirs) {
    var out = [], D = dirs || [[0, 1], [1, 0], [-1, 0], [0, -1]], cv = M.xf && XF;
    M.eachF(function (x, y) { for (var k = 0; k < D.length; k++) if (!M.hasF(x + D[k][0], y + D[k][1])) { out.push(cv ? [dzX(x), dzY(y)] : [x, y]); break; } });
    return out;
  }
  // 1px outline around opaque pixels (4-neighbourhood). colFor(tag, colour) picks the outline colour.
  function outlinePass(B, colFor) {
    var w = B.w, h = B.h, add = [], D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (B.c[y * w + x] >= 0) continue;
      var best = -1, bestL = 2;
      for (var k = 0; k < 4; k++) {
        var xx = x + D[k][0], yy = y + D[k][1];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        var c = B.c[yy * w + xx]; if (c < 0) continue;
        var oc = colFor ? colFor(B.t[yy * w + xx], c) : OUT, l = lum(oc);
        if (l < bestL) { bestL = l; best = oc; }
      }
      if (best >= 0) add.push(y * w + x, best);
    }
    for (var i = 0; i < add.length; i += 2) { B.c[add[i]] = add[i + 1]; B.t[add[i]] = TAG.LINE; }
  }
  // violet rim light on the right-facing silhouette edge
  function rimPass(B, yMax, strength) {
    var w = B.w, src = B.c.slice(), s = strength || 1;
    for (var y = 0; y < Math.min(yMax, B.h); y++) for (var x = 0; x < w; x++) {
      var i = y * w + x, c = src[i]; if (c < 0) continue;
      var t = B.t[i]; if (t === TAG.EYE || t === TAG.NORIM || t === TAG.GLASS || t === TAG.MOUTH) continue;
      if (x + 1 < w && src[i + 1] >= 0) continue;
      var L = lum(c);
      B.c[i] = L < 0.3 ? mix(c, RIM1, 0.55 * s) : L < 0.6 ? mix(c, RIM2, 0.45 * s) : mix(c, RIM2, 0.3 * s);
    }
  }

  /* ================================================================== palettes */
  function skinR(s, b, l, o) {
    s = H(s); b = H(b); l = H(l); o = o || {};
    return { s: s, b: b, l: l, d: o.d ? H(o.d) : mix(s, 0x3a1838, 0.3), line: o.line ? H(o.line) : mix(s, 0x120c1c, 0.62),
      blush: o.blush ? H(o.blush) : mix(b, 0xe0607a, 0.3), lip: o.lip ? H(o.lip) : mix(s, 0xa03050, 0.22) };
  }
  var SKIN = {
    pale: skinR('#c9a9b8', '#ecd3d9', '#fbeef0'),
    fair: skinR('#c98e74', '#ebb79a', '#f8d6c0'),
    tan: skinR('#a86e4f', '#cf9670', '#e8b892'),
    brown: skinR('#7a4a32', '#9e6646', '#c08560', { blush: '#b0604c' }),
    deep: skinR('#4e2e20', '#6e4630', '#8e6044', { d: '#3c2020', line: '#22101a', blush: '#86463c', lip: '#5a2a30' }),
    witch: skinR('#566e45', '#7a9562', '#a2bd86', { d: '#3e4e38', line: '#1f2a1e', blush: '#8aa064', lip: '#4a5a3a' }),
    moon: skinR('#b9bcd8', '#d9dcef', '#f2f3fb', { blush: '#e2c4dc' }),
    olive: skinR('#9c7650', '#c49c70', '#dcba8c', { blush: '#d0907a' }),
    cool: skinR('#bba6bd', '#e2d5e0', '#f6eff6', { blush: '#e6c8d6' })
  };
  // hair ramps: [line, dark, base, light, shine]
  function hairR(o, d, b, l, s) { return HS([o, d, b, l, s]); }
  var HAIR = {
    silver: hairR('#5e5878', '#8e89a8', '#b8b4cc', '#d8d4e8', '#f4f2fb'),
    black: hairR('#0b0711', '#120c1c', '#2a2238', '#46395c', '#6c5a90'),
    ginger: hairR('#5a1e14', '#a8441e', '#e07a3a', '#f6a868', '#ffd7a8'),
    auburn: hairR('#3e1414', '#6e2a22', '#a8442e', '#cc6a4a', '#eb9a78'),
    brown: hairR('#24160f', '#3e2a20', '#6a4630', '#8e6448', '#b48a68'),
    moss: hairR('#173020', '#2f5a36', '#4f8a52', '#7ab878', '#a8dc9c'),
    white: hairR('#7a7690', '#c4c0d4', '#dedcea', '#eceaf4', '#ffffff'),
    plum: hairR('#22102a', '#3e1c42', '#6a2e6a', '#9a4e94', '#c47ab8')
  };
  var EYEC = { // [dark, base, light, pupil]
    hazel: HS(['#3e2616', '#6e4a2a', '#a07a4a', '#22140c']),
    green: HS(['#1a4434', '#3a8a58', '#8fd07a', '#0f2420']),
    blue: HS(['#1c2a66', '#3a68b8', '#8cc4f0', '#101838']),
    amber: HS(['#7a3a0c', '#d08a28', '#ffc870', '#3a1806']),
    violet: HS(['#2a1848', '#5e3f9e', '#a68ae0', '#160c28']),
    brown: HS(['#2a1a12', '#5a3a26', '#8e6444', '#160c08']),
    yellow: HS(['#8a6a10', '#e8c030', '#fff4a8', '#120a04']),
    grey: HS(['#2a2c40', '#566080', '#8e9ab8', '#141624']),
    ice: HS(['#1e3a6a', '#4a8ac8', '#b0dcff', '#0e1a30']),
    leaf: HS(['#1c4a2c', '#4c9a4a', '#a8e07a', '#0e2416']),
    dusk: HS(['#1e1030', '#4a2f7a', '#8f6cd1', '#0e0818'])
  };
  var GOLD = HS(['#7a4a1c', '#c08a2a', '#f2c45a', '#fff1c8']);
  var SILVER = HS(['#45445a', '#7e7d97', '#c4c3d6', '#ffffff']);

  /* ================================================================== portrait features */
  var SCLERA = H('#eef0fb'), SCLERA_S = H('#b4bad6'), TEETH = H('#f4f2fb'), TEETH_S = H('#c4c0d6'), MOUTH_IN = H('#4a1a2e'), TONGUE = H('#c4648e');

  // eye templates (left eye: outer corner at the LEFT). K lash, k soft lid, w shaded sclera, W sclera,
  // s skin shadow, d skin deep, l skin light, v under-eye violet. The iris is painted over w/W.
  var EYES = {
    std: {
      open: ['.KKKKK.', 'KKwwwwK', '.WWWWW.', '.WWWWW.', '..kkk..'],
      wide: ['.KKKKK.', 'KwwwwwK', 'KWWWWWk', '.WWWWW.', '.WWWWW.', '..kkk..'], wideDY: -1,
      happy: ['.......', '..KKK..', '.K...K.', 'K.....K', '.......'],
      closed: ['.......', '.......', '.......', 'KKKKKK.', '.kkkk..'],
      iris: 3
    },
    kind: { // older, softly hooded
      open: ['..kkkk.', '.KKKKK.', 'KKwwwwK', '.WWWWW.', '.WWWWW.', '..kkk..'],
      wide: ['..kkkk.', '.KKKKK.', 'KwwwwwK', 'KWWWWWk', '.WWWWW.', '.WWWWW.', '..kkk..'], wideDY: -1,
      happy: ['.......', '.......', '..KKK..', '.K...K.', 'K.....K', '.k...k.'],
      closed: ['.......', '..kkkk.', '.......', '.......', 'KKKKKK.', '.kkkk..'],
      iris: 3
    },
    kid: { // big round
      open: ['..KKKK..', '.KwwwwwK', 'KKWWWWWK', '.WWWWWW.', '.WWWWWW.', '..kkkk..'],
      wide: ['..KKKK..', '.KwwwwK.', 'KwWWWWwK', 'KWWWWWWK', '.WWWWWW.', '.WWWWWW.', '..kkkk..'], wideDY: -1,
      happy: ['........', '........', '..KKKK..', '.K....K.', 'K......K', '........'],
      closed: ['........', '........', '........', '........', 'KKKKKKK.', '.kkkkk..'],
      iris: 4, wideIris: 3, hl2: true
    },
    almond: { // winged liner
      open: ['K.......', 'KKKKKKK.', '.KwwwwwK', '..WWWWW.', '..WWWWk.', '...kk...'],
      wide: ['K.......', 'KKKKKKK.', '.KwwwwwK', '.KWWWWWk', '..WWWWW.', '..WWWWk.', '...kk...'], wideDY: -1,
      happy: ['........', 'K.......', '.KKKKK..', 'K.....K.', '........', '........'],
      closed: ['........', '........', 'K.......', '.K......', '..KKKKK.', '...kkk..'],
      iris: 3
    },
    small: { // deep-set
      open: ['.KKKK.', 'KwwwwK', '.WWWW.', '..kk..'],
      wide: ['.KKKK.', 'KwwwwK', '.WWWW.', '.WWWW.', '..kk..'], wideDY: -1,
      happy: ['......', '.KKKK.', 'K....K', '......'],
      closed: ['......', '......', 'KKKKK.', '.kkk..'],
      iris: 2
    },
    twinkle: { // serene, gently smiling
      open: ['.......', '.KKKKK.', 'KwwwwwK', '.kWWWk.', '..k.k..'],
      wide: ['.KKKKK.', 'KwwwwwK', '.WWWWW.', '.WWWWW.', '..kkk..'],
      happy: ['.......', '.......', '.KKKKK.', 'K.....K', '.k...k.'],
      sad: ['.......', '.......', 'KKKKKKK', '.kWWWk.', '..kkk..'],
      closed: ['.......', '.......', 'KKKKKK.', '.kkkk..'],
      iris: 3
    },
    doe: { // big soft eyes with lashes
      open: ['..KKKK..', '.KKKKKKK', 'KKwwwwwK', '.WWWWWW.', '.WWWWWW.', '..kkkk..'],
      wide: ['..KKKK..', '.KKKKKKK', 'KKwwwwwK', '.WWWWWWk', '.WWWWWW.', '.WWWWWW.', '..kkkk..'], wideDY: -1,
      happy: ['........', '........', '..KKKK..', '.K....K.', 'K......K', '........'],
      closed: ['........', '........', '........', '........', 'KKKKKKK.', '.kkkkk..'],
      iris: 3, hl2: true
    },
    beady: { // round, baggy sockets
      open: ['.dKKKd.', 'dKwwwKd', 'dKWWWKd', '.KWWWK.', '.dKKKd.', '..ddd..'],
      wide: ['.dKKKd.', 'dKwwwKd', 'KWWWWWK', 'KWWWWWK', '.KWWWK.', '.dKKKd.'], wideDY: -1,
      happy: ['.......', '.......', '.KKKKK.', 'K.....K', '.ddddd.', '.......'],
      closed: ['.......', '.......', '.......', 'dKKKKKd', '.ddddd.', '.......'],
      iris: 3
    },
    tired: { // heavy lids, bags
      open: ['..kkkk.', '.KKKKKK', 'KKKwwwK', '.KWWWWK', '.vvvvv.', '..vvv..'],
      wide: ['..kkkk.', '.KKKKKK', 'KKwwwwK', '.WWWWWK', '.WWWWW.', '.vvvvv.', '..vvv..'], wideDY: -1,
      happy: ['.......', '..kkkk.', '.......', '.KKKKK.', 'K.vvv.K', '.......'],
      closed: ['.......', '..kkkk.', '.......', 'KKKKKK.', '.vvvvv.', '..vvv..'],
      iris: 3
    },
    sharp: { // confident, slightly narrowed
      open: ['.KKKKKK', 'KKwwwwK', '.WWWWW.', '.WWWWW.', '..kkk..'],
      wide: ['.KKKKKK', 'KwwwwwK', 'KWWWWWk', '.WWWWW.', '.WWWWW.', '..kkk..'], wideDY: -1,
      happy: ['.......', '..KKK..', '.K...K.', 'K.....K', '.......'],
      closed: ['.......', '.......', '.......', 'KKKKKK.', '.kkkk..'],
      iris: 3
    }
  };

  function eyeCells(rows) {
    var cells = [];
    for (var r = 0; r < rows.length; r++) for (var i = 0; i < rows[r].length; i++) { var ch = rows[r].charAt(i); if (ch === 'W' || ch === 'w') cells.push([i, r, ch]); }
    return cells;
  }
  function liftLid(rows, side, n) { // angry (side 'in') / sad (side 'out'): lower the lid on one side
    var out = rows.slice(), top = -1;
    for (var r = 0; r < out.length; r++) if (/[wW]/.test(out[r])) { top = r; break; }
    if (top < 0) return out;
    for (var k = 0; k < n; k++) {
      var rr = top + k; if (rr >= out.length) break;
      var row = out[rr].split(''), cols = [];
      for (var i = 0; i < row.length; i++) if (row[i] === 'w' || row[i] === 'W') cols.push(i);
      if (!cols.length) continue;
      var cut = Math.ceil(cols.length * (k === 0 ? 0.6 : 0.3));
      for (var j = 0; j < cut; j++) row[side === 'in' ? cols[cols.length - 1 - j] : cols[j]] = 'K';
      out[rr] = row.join('');
    }
    return out;
  }
  function drawEye(P, rows, x, y, flip, iris, ic, gaze) {
    var B = P.B, S = P.skin, lash = P.lash != null ? P.lash : OUT;
    var leg = { K: [lash, TAG.EYE], k: [S.d, TAG.EYE], W: [SCLERA, TAG.EYE], w: [SCLERA_S, TAG.EYE], s: [S.s, TAG.SKIN], d: [S.d, TAG.SKIN], l: [S.l, TAG.SKIN], q: [S.line, TAG.EYE],
      v: [mix(S.s, H('#6a47a8'), 0.28), TAG.SKIN] };
    stamp(B, rows, x, y, leg, TAG.EYE, flip);
    var cells = eyeCells(rows), w = stampW(rows);
    if (!cells.length) return;
    var minX = 99, maxX = -1, minY = 99, maxY = -1;
    cells.forEach(function (c) { var cx = flip ? w - 1 - c[0] : c[0]; minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); });
    var iw = iris.w, ih = maxY - minY + 1;
    var ix0 = Math.round((minX + maxX + 1) / 2 - iw / 2) + (gaze || 0);
    ix0 = Math.max(minX - 1, Math.min(maxX - iw + 2, ix0));
    var pr = ih >= 4 ? Math.floor(ih / 2) : 1;
    cells.forEach(function (c) {
      var cx = flip ? w - 1 - c[0] : c[0], cy = c[1];
      if (cx < ix0 || cx >= ix0 + iw) return;
      var r = cy - minY;
      var col = r <= 0 ? ic[0] : (r >= ih - 1 && ih > 2 ? ic[2] : ic[1]);
      if (iris.pupil && ih >= 3 && r === pr && cx >= ix0 + Math.floor((iw - 1) / 2) && cx <= ix0 + Math.floor(iw / 2)) col = ic[3];
      B.set(x + cx, y + cy, col, TAG.EYE);
    });
    if (iris.hl !== false) { // highlight top-left of the iris (same side on both eyes: one light source)
      var hy = minY + (ih >= 4 ? 1 : 0), hx = ix0;
      if (B.get(x + hx, y + hy) !== SCLERA && B.get(x + hx, y + hy) !== SCLERA_S && B.tg(x + hx, y + hy) === TAG.EYE) B.set(x + hx, y + hy, WHITE, TAG.EYE);
      else if (B.tg(x + hx + 1, y + hy) === TAG.EYE) B.set(x + hx + 1, y + hy, WHITE, TAG.EYE);
      if (iris.hl2 && ih >= 3) { var h2x = ix0 + iw - 1, h2y = maxY; if (B.get(x + h2x, y + h2y) === ic[2]) B.set(x + h2x, y + h2y, mix(ic[2], WHITE, 0.55), TAG.EYE); }
    }
  }
  function exprEyeRows(P, E) {
    var e = P.e;
    if (P.blink) return E.closed;
    if (e === 'happy') return E.happy;
    if (e === 'surprised') return E.wide || E.open;
    if (e === 'angry') return E.angry || liftLid(E.open, 'in', E.angryCut || 2);
    if (e === 'sad') return E.sad || liftLid(E.open, 'out', E.sadCut || 1);
    return E.open;
  }
  function drawEyes(P) {
    if (P.style) return drawEyesS(P);
    var d = P.d, E = EYES[d.eyeStyle] || EYES.std, f = P.f;
    var rowsL = (d.eyeRows && d.eyeRows(P, 'L', E)) || exprEyeRows(P, E);
    var rowsR = (d.eyeRows && d.eyeRows(P, 'R', E)) || exprEyeRows(P, E);
    var wR = stampW(rowsR);
    var iris = { w: (P.e === 'surprised' && !P.blink) ? (E.wideIris || E.iris) : E.iris, pupil: E.pupil !== false, hl: E.hl, hl2: E.hl2 };
    var gaze = d.gaze ? d.gaze(P) : 0;
    var ex = f.eyeX, ey = f.eyeY;
    var dyL = (rowsL === E.wide && E.wideDY) ? E.wideDY : 0, dyR = (rowsR === E.wide && E.wideDY) ? E.wideDY : 0;
    if (!d.hideEyeL) drawEye(P, rowsL, ex, ey + dyL, false, iris, P.eyeC, gaze);
    if (!d.hideEyeR) drawEye(P, rowsR, 63 - ex - (wR - 1), ey + dyR, true, iris, P.eyeC, gaze);
  }

  // brows: polyline from outer to inner, relative to the left eye origin; mirrored for the right brow
  function browPts(P, spec) {
    var e = P.e, pts = spec.pts.map(function (p) { return [p[0], p[1]]; }), n = pts.length;
    for (var i = 0; i < n; i++) {
      var u = n === 1 ? 1 : i / (n - 1), dy = 0;
      if (e === 'happy') dy = -1;
      else if (e === 'surprised') dy = -2 - (u > 0.2 && u < 0.9 ? 1 : 0);
      else if (e === 'sad') dy = Math.round(1 - 3 * u);
      else if (e === 'angry') dy = Math.round(-1 + 3.2 * u);
      if (spec.mod && spec.mod[e]) dy = spec.mod[e](u, dy);
      pts[i][1] += dy;
    }
    return pts;
  }
  function drawBrows(P) {
    if (P.style) return drawBrowsS(P);
    var spec = P.d.brows; if (!spec) return;
    var B = P.B, f = P.f, pts = browPts(P, spec), col = spec.col, col2 = spec.col2 != null ? spec.col2 : col;
    var path = [];
    for (var i = 0; i + 1 < pts.length; i++) { var seg = bez([pts[i], pts[i + 1]]); if (path.length) seg = seg.slice(1); path = path.concat(seg); }
    var th = spec.thick || 1, x0 = f.eyeX, y0 = f.eyeY, minx = 1e9, maxx = -1e9;
    var aL = (spec.asymL && spec.asymL[P.e]) || 0, aR = (spec.asymR && spec.asymR[P.e]) || 0;
    path.forEach(function (p) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); });
    function put(px, py, c, u) {
      if (!spec.noL) B.set(x0 + px, y0 + py + aL, c, TAG.BROW);
      if (!spec.noR) B.set(63 - (x0 + px), y0 + py + aR, c, TAG.BROW);
    }
    path.forEach(function (p) {
      var u = (p[0] - minx) / Math.max(1, maxx - minx); // 0 outer .. 1 inner
      put(p[0], p[1], col);
      for (var k = 1; k < th; k++) if (u > (spec.taper != null ? spec.taper : 0.25)) put(p[0], p[1] + k, k === th - 1 ? col2 : col);
    });
  }

  // mouths: stamps centred on x=32. D line, d deep, s shadow, l light, m inside, t teeth, T teeth shade,
  // u tongue, g gold, G gold dark, p lip, P lip dark
  var MOUTHS = {
    smile: ['D......D', '.DDDDDD.', '..ssss..'],
    smileTalk: ['DDDDDDDD', '.DmmmmD.', '..DuuD..', '...ss...'],
    grin: ['DDDDDDDD', 'DttttttD', '.DmmmmD.', '..DuuD..', '...ss...'],
    grinTalk: ['DDDDDDDD', 'DttttttD', 'DmmmmmmD', '.DmuumD.', '..DDDD..'],
    flat: ['.DDDDDD.', '..ssss..'],
    flatTalk: ['.DDDDDD.', '.DmmmmD.', '..DDDD..'],
    frown: ['..DDDD..', '.D....D.', 'D......D'],
    frownTalk: ['..DDDD..', '.DmmmmD.', 'D.DDDD.D'],
    o: ['..DD..', '.DmmD.', '.DmmD.', '..DD..'],
    oTalk: ['..DD..', '.DmmD.', 'DmmmmD', '.DuuD.', '..DD..'],
    grit: ['DDDDDDDD', 'DtTttTtD', 'DDDDDDDD'],
    gritTalk: ['DDDDDDDD', 'DttttttD', 'DmmmmmmD', '.DDDDDD.'],
    small: ['D....D', '.DDDD.'],
    smallTalk: ['.DDDD.', '.DmmD.', '..DD..'],
    pursed: ['.DDDDDD.', '...ss...'],
    pursedTalk: ['..DDDD..', '.DmmmmD.', '..DDDD..']
  };
  var TALK_FALLBACK = { neutral: 'smileTalk', happy: 'grinTalk', sad: 'frownTalk', surprised: 'oTalk', angry: 'gritTalk' };
  function mouthRows(P) {
    var d = P.d, e = P.e, set = d.mouths || {}, lib = d.mouthLib || {};
    var key = set[e] || set.neutral || 'smile';
    if (P.talk) {
      var tk = set[e + 'Talk'] || key + 'Talk';
      key = (lib[tk] || MOUTHS[tk]) ? tk : TALK_FALLBACK[e];
    }
    return lib[key] || MOUTHS[key];
  }
  function drawMouth(P, dy) {
    if (P.style) return drawMouthS(P, dy);
    var rows = mouthRows(P); if (!rows) return;
    var d = P.d, S = P.skin, w = stampW(rows), x = 32 - Math.ceil(w / 2) + (d.mouthDX || 0), y = P.f.mouthY + (dy || 0);
    stamp(P.B, rows, x, y, {
      D: [S.line, TAG.MOUTH], d: [S.d, TAG.MOUTH], s: [S.s, TAG.SKIN], l: [S.l, TAG.SKIN], m: [MOUTH_IN, TAG.MOUTH], t: [TEETH, TAG.MOUTH],
      T: [TEETH_S, TAG.MOUTH], u: [TONGUE, TAG.MOUTH], g: [GOLD[2], TAG.MOUTH], G: [GOLD[1], TAG.MOUTH], p: [S.lip, TAG.MOUTH], P: [mix(S.lip, OUT, 0.35), TAG.MOUTH],
      b: [d.mouthLine || S.line, TAG.MOUTH], L: [mix(S.lip, S.l, 0.55), TAG.MOUTH]
    }, TAG.MOUTH, d.mouthFlip);
  }
  var NOSES = {
    button: ['l.', 'l.', '.s', 'ds'],
    small: ['l.', '.s', 'd.']
  };
  function drawNose(P) {
    if (P.style) return drawNoseS(P);
    var d = P.d; if (d.nose === false) return;
    var rows = typeof d.nose === 'object' ? d.nose : NOSES[d.nose || 'button'], S = P.skin;
    stamp(P.B, rows, (d.noseX != null ? d.noseX : 31), P.f.noseY, { l: [S.l, TAG.SKIN], s: [S.s, TAG.SKIN], d: [S.d, TAG.SKIN], D: [S.line, TAG.SKIN], b: [S.b, TAG.SKIN] }, TAG.SKIN);
  }

  /* ---------------------------------------------------------------- face, neck, ears, torso */
  function rowsOf(spec) { var a = []; spec.forEach(function (s) { var n = s[1] || 1; for (var i = 0; i < n; i++) a.push(s[0]); }); return a; }
  var FACES = {
    round: { top: 12, hw: rowsOf([[8], [10], [11], [12, 2], [13, 22], [12, 2], [11], [10], [9], [7], [4]]), jaw: 37, eyeX: 22, eyeY: 29, noseY: 35, mouthY: 40, earY: 29 },
    kid: { top: 14, hw: rowsOf([[8], [10], [11], [12, 21], [11, 2], [10], [9], [8], [6], [3]]), jaw: 36, eyeX: 21, eyeY: 30, noseY: 36, mouthY: 39, earY: 30 },
    oval: { top: 12, hw: rowsOf([[8], [10], [11], [12, 22], [11, 2], [10], [9], [8], [7], [5], [3]]), jaw: 35, eyeX: 21, eyeY: 29, noseY: 35, mouthY: 40, earY: 29 },
    broad: { top: 9, hw: rowsOf([[6], [9], [11], [12], [13, 2], [14, 26], [13, 2], [12], [11], [10], [8]]), jaw: 38, eyeX: 22, eyeY: 30, noseY: 32, mouthY: 41, earY: 28 },
    long: { top: 14, hw: rowsOf([[10], [11], [12, 26], [11], [10], [9], [8], [6], [4]]), jaw: 39, eyeX: 22, eyeY: 29, noseY: 31, mouthY: 41, earY: 28 },
    angular: { top: 13, hw: rowsOf([[8], [10], [11], [12, 21], [11, 2], [10], [9], [8], [7], [6], [5], [4], [3], [2]]), jaw: 34, eyeX: 22, eyeY: 28, noseY: 30, mouthY: 41, earY: 28 },
    narrow: { top: 13, hw: rowsOf([[8], [10], [11, 2], [12, 21], [11, 2], [10], [9], [8], [6], [4]]), jaw: 37, eyeX: 22, eyeY: 30, noseY: 35, mouthY: 40, earY: 29 },
    square: { top: 13, hw: rowsOf([[9], [11], [12, 2], [13, 23], [12, 2], [11], [10], [8], [5]]), jaw: 38, eyeX: 22, eyeY: 30, noseY: 35, mouthY: 40, earY: 29 },
    player: { top: 12, hw: rowsOf([[8], [10], [11], [12, 2], [13, 20], [12, 2], [11], [10], [9], [8], [6], [3]]), jaw: 36, eyeX: 22, eyeY: 30, noseY: 35, mouthY: 40, earY: 29 }
  };
  function faceMask(f) {
    if (XF) return M64().fn(function (x, y) { var hw = f.hw[y - f.top]; return hw != null && Math.abs(x + 0.5 - 32) < hw; }); // smooth oval in a close-up
    var M = M64();
    for (var i = 0; i < f.hw.length; i++) { var hw = f.hw[i]; for (var x = 32 - hw; x < 32 + hw; x++) M.put(x, f.top + i); }
    return M;
  }
  function paintFace(P) {
    if (P.style) return paintFaceS(P);
    var f = P.f, S = P.skin, B = P.B, M = faceMask(f), bottom = f.top + f.hw.length - 1;
    P.faceM = M;
    M.each(function (x, y) {
      var hw = f.hw[y - f.top], xr = 31 + hw, xl = 32 - hw;
      var c = S.b, fromR = xr - x;
      var band = 2 + (y > f.jaw ? Math.floor((y - f.jaw + 1) / 2) : 0);
      if (fromR < band) c = S.s;
      if (y >= bottom - 1 && x >= 31) c = S.s;
      if (y === bottom) c = x < 31 ? S.b : S.s;
      var v = sph(x, y, 29, 27, 15, 17);
      if (v > (P.d.faceLight || 0.74) && fromR >= band + 2) c = S.l;
      if (x === xl && y < f.jaw + 2) c = S.b;
      B.set(x, y, c, TAG.SKIN);
    });
  }
  function drawNeck(P) {
    if (P.style) return drawNeckS(P);
    var f = P.f, S = P.skin, B = P.B, hw = P.d.neckW || 5, y0 = f.top + f.hw.length - 6, y1 = 58;
    for (var y = y0; y <= y1; y++) for (var x = 32 - hw; x < 32 + hw; x++) {
      var c = S.s, r = y - y0;
      if (r < 8) c = (r > 5 && x < 30) ? S.s : S.d;
      else c = x >= 31 + hw - 2 ? S.d : (x < 33 - hw + 1 ? S.b : S.s);
      B.set(x, y, c, TAG.SKIN);
    }
  }
  function drawEars(P) {
    if (P.style) return drawEarsS(P);
    var f = P.f, S = P.skin, B = P.B, y = f.earY, hw = f.hw[y - f.top];
    stamp(B, ['.bb', 'bld', 'bsd', 'bsd', 'sdd', '.ss', '..s'], 32 - hw - 3, y, { b: S.b, l: S.l, s: S.s, d: S.d }, TAG.SKIN);
    stamp(B, ['ss.', 'dds', 'dss', 'dss', 'dds', 'ss.', 's..'], 32 + hw, y, { b: S.b, l: S.l, s: S.s, d: S.d }, TAG.SKIN);
  }
  // torso: neck base at y0 with half-width n, eases out to shoulder half-width s over `rows`, then b at y=63
  function torso(y0, n, s, rows, b) {
    if (XF) return M64().fn(function (x, y) {
      var d = y - y0; if (d < -0.5) return false; d = Math.max(0, d);
      var w = d <= rows ? n + (s - n) * (1 - (1 - d / rows) * (1 - d / rows)) : s + (b - s) * ((d - rows) / Math.max(1, 63 - y0 - rows));
      return Math.abs(x + 0.5 - 32) < w;
    });
    var M = M64();
    for (var y = y0; y < 64; y++) {
      var d = y - y0, w;
      if (d <= rows) { var t = d / rows; w = n + (s - n) * (1 - (1 - t) * (1 - t)); }
      else w = s + (b - s) * ((d - rows) / Math.max(1, 63 - y0 - rows));
      var iw = Math.round(w);
      for (var x = 32 - iw; x < 32 + iw; x++) M.put(x, y);
    }
    return M;
  }
  // skin under hair/hat -> shadow (cast shade on the forehead/cheeks)
  function castShadow(P, rows) {
    if (P.style) return castShadowS(P, rows);
    var B = P.B, S = P.skin, hits = [];
    rows = rows || 2;
    for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) {
      if (B.tg(x, y) !== TAG.SKIN) continue;
      var c = B.get(x, y); if (c !== S.b && c !== S.l) continue;
      for (var k = 1; k <= rows; k++) { var t = B.tg(x - (k > 1 ? 1 : 0), y - k); if (t === TAG.HAIR || t === TAG.HAT) { hits.push(x, y); break; } }
    }
    for (var i = 0; i < hits.length; i += 2) B.set(hits[i], hits[i + 1], S.s, TAG.SKIN);
  }
  function faceTop(P, hairline) { // part of the skull above a hairline (so hair always covers the scalp)
    return P.faceM ? P.faceM.clone().keep(function (x, y) { return y < hairline(x); }) : M64();
  }

  /* ---------------------------------------------------------------- hair helpers */
  function strands(B, M, list, col, tag) {
    list.forEach(function (cp) { bez(cp).forEach(function (p) { if (!M || M.has(p[0], p[1])) B.set(p[0], p[1], col, tag || TAG.HAIR); }); });
  }
  // stylised hair: clumps fanning out from a pivot, lit by a sphere, with a shine band
  function hairClumps(B, M, R, o) {
    var tag = o.tag || TAG.HAIR, th = o.th || [-0.12, 0.38], gap = o.gap != null ? o.gap : 0.13, edge = o.edge != null ? o.edge : 0.45;
    M.each(function (x, y) {
      var dx = x + 0.5 - o.px, dy = y + 0.5 - o.py, r = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
      var u = a / o.aw + (o.ph || 0) + (o.wave ? Math.sin(r * o.wave[0] + (o.wave[2] || 0)) * o.wave[1] : 0), f = u - Math.floor(u);
      var v = sph(x, y, o.cx, o.cy, o.rx, o.ry);
      v += (o.k != null ? o.k : 0.4) * (f - 0.5) * (o.flipK ? -1 : 1);
      var crease = f < gap && r > (o.r0 || 0);
      if (crease) v -= 0.55;
      var e = steps(M, x, y, 1, 1, 2); if (e === 1) v -= edge; else if (e === 2) v -= edge * 0.35;
      if (o.bias) v += o.bias(x, y);
      var k = 0; while (k < th.length && v > th[k]) k++;
      var col = [R[1], R[2], R[3]][k];
      if (o.shine) {
        var sx = x + 0.5 - o.shine[0], sy = y + 0.5 - o.shine[1], sr = Math.sqrt(sx * sx + sy * sy);
        if (sr >= o.shine[2] - (CUR_STYLE ? 0.6 : 0) && sr <= o.shine[3] + (CUR_STYLE ? 0.6 : 0) && k === 2 && !crease && (!o.shineTest || o.shineTest(x, y))) col = R[4];
      }
      if (CUR_STYLE) {
        if (crease && v > 0.15) col = R[2];
        else if (k === 2 && f > 0.52 && f < 0.64) col = R[4];
        else if (k === 1 && f > 0.56 && f < 0.64 && v > 0.05) col = R[3];
      }
      if (o.deep && crease && v < -0.6) col = R[0];
      B.set(x, y, col, tag);
    });
    cleanOrphans(B, M);
  }
  // braid: centre line through control points, width w, with plaited chevrons
  function braid(B, cp, R, w, o) {
    if (XF && B.xf) return braidC(B, cp, R, w, o);
    o = o || {};
    var path = bez(cp), tag = o.tag || TAG.HAIR, half = (w - 1) / 2;
    var M = M64();
    path.forEach(function (p) { for (var k = 0; k < w; k++) M.put(Math.round(p[0] - half + k), p[1]); });
    var yStart = path[0][1];
    M.each(function (x, y) {
      var row = path.filter(function (p) { return p[1] === y; })[0] || path[path.length - 1];
      var rel = x - (row[0] - half), u = rel / Math.max(1, w - 1); // 0..1 across
      var ph = ((y - yStart) % 4 + 4) % 4;
      var side = u < 0.5 ? 0 : 1;
      var lit = side === 0 ? (ph === 0 || ph === 1) : (ph === 2 || ph === 3);
      var col = lit ? R[3] : R[2];
      if ((side === 0 && ph === 2) || (side === 1 && ph === 0)) col = R[1];
      if (Math.abs(u - 0.5) < 0.2 && (ph === 1 || ph === 3)) col = R[1];
      if (u > 0.85) col = col === R[3] ? R[2] : R[1];
      B.set(x, y, col, tag);
    });
    if (o.line != null) edgePx(M, [[1, 0], [-1, 0]]).forEach(function (p) { B.set(p[0], p[1], o.line, tag); });
    if (o.cuffs) o.cuffs.forEach(function (t) {
      var p = path[Math.min(path.length - 1, Math.round(t * (path.length - 1)))];
      for (var k = 0; k < w; k++) { B.set(p[0] - half + k, p[1], k < w / 2 ? o.cuffC[2] : o.cuffC[1], TAG.METAL); B.set(p[0] - half + k, p[1] + 1, o.cuffC[0], TAG.METAL); }
      if (o.cuffC[3] != null) B.set(p[0] - half, p[1], o.cuffC[3], TAG.METAL);
    });
    return M;
  }
  function braidC(B, cp, R, w, o) { // braid() traced in frame pixels for close-ups
    o = o || {};
    var s = XF.s, tag = o.tag || TAG.HAIR, path = bezCore(cp.map(function (p) { return [fxX(p[0] + 0.5) - 0.5, fxY(p[1] + 0.5) - 0.5]; }));
    var W = Math.max(2, Math.round(w * s)), half = (W - 1) / 2, M = M64(), rowAt = {};
    path.forEach(function (p) { if (rowAt[p[1]] == null) rowAt[p[1]] = p[0]; for (var k = 0; k < W; k++) M.putF(Math.round(p[0] - half + k), p[1]); });
    var yStart = path[0][1], per = 4 * s, last = path[path.length - 1];
    M.eachF(function (x, y) {
      var cx = rowAt[y] != null ? rowAt[y] : last[0], u = (x - (cx - half)) / Math.max(1, W - 1);
      var ph = Math.floor((((y - yStart) % per) + per) % per / s) % 4, side = u < 0.5 ? 0 : 1;
      var lit = side === 0 ? (ph === 0 || ph === 1) : (ph === 2 || ph === 3), col = lit ? R[3] : R[2];
      if ((side === 0 && ph === 2) || (side === 1 && ph === 0)) col = R[1];
      if (Math.abs(u - 0.5) < 0.2 && (ph === 1 || ph === 3)) col = R[1];
      if (u > 0.85) col = col === R[3] ? R[2] : R[1];
      B.setF(x, y, col, tag);
    });
    if (o.line != null) M.eachF(function (x, y) { if (!M.hasF(x - 1, y) || !M.hasF(x + 1, y)) B.setF(x, y, o.line, tag); });
    if (o.cuffs) o.cuffs.forEach(function (t) {
      var p = path[Math.min(path.length - 1, Math.round(t * (path.length - 1)))];
      for (var k = 0; k < W; k++) { B.setF(Math.round(p[0] - half + k), p[1], k < W / 2 ? o.cuffC[2] : o.cuffC[1], TAG.METAL); B.setF(Math.round(p[0] - half + k), p[1] + 1, o.cuffC[1], TAG.METAL); B.setF(Math.round(p[0] - half + k), p[1] + 2, o.cuffC[0], TAG.METAL); }
      if (o.cuffC[3] != null) B.setF(Math.round(p[0] - half), p[1], o.cuffC[3], TAG.METAL);
    });
    return M;
  }
  function flower(B, x, y, P1, P2, C) { // tiny 3x3 blossom
    B.set(x, y - 1, P2, TAG.ACC); B.set(x - 1, y, P2, TAG.ACC); B.set(x + 1, y, P1, TAG.ACC); B.set(x, y + 1, P1, TAG.ACC); B.set(x, y, C, TAG.ACC);
  }
  function ring(B, cx, cy, rx, ry, ramp, tag) { // 1px metal ring lit from top-left
    if (XF && B.xf) { // still 1px at close-up scale
      var X = fxX(cx), Y = fxY(cy), RX = rx * XF.s, RY = ry * XF.s, mm = M64().ellipseF(X, Y, RX, RY).sub(M64().ellipseF(X, Y, RX - 1, RY - 1));
      mm.eachF(function (x, y) { var v = sph(x, y, X, Y, RX, RY); B.setF(x, y, v > 0.25 ? ramp[2] : v > -0.55 ? ramp[1] : ramp[0], tag || TAG.METAL); });
      return mm;
    }
    var m = M64().ellipse(cx, cy, rx, ry).sub(M64().ellipse(cx, cy, rx - 1, ry - 1));
    m.each(function (x, y) { var v = sph(x, y, cx, cy, rx, ry); B.set(x, y, v > 0.25 ? ramp[2] : v > -0.55 ? ramp[1] : ramp[0], tag || TAG.METAL); });
    return m;
  }

  /* ================================================================== NPC portrait defs */
  var NPC = {};

  // ---- 1. Mirabel Thornwick: silver bun + lavender, round gold specs, lavender knit shawl, moss dress
  NPC.mirabel = (function () {
    var R = HAIR.silver, S = SKIN.fair;
    var SHAWL = HS(['#5a3c94', '#7e5cc4', '#a585e0', '#c9b0f2']), DRESS = HS(['#1a4434', '#245a40', '#337450', '#4c9061']);
    return {
      skin: S, face: FACES.round, eyeStyle: 'kind', eyeC: EYEC.hazel,
      brows: { pts: [[0, -3], [3, -4], [6, -3]], col: R[1], thick: 1 },
      mouths: { neutral: 'smile', happy: 'grin', sad: 'frown', surprised: 'o', angry: 'pursed' },
      back: function (P) {
        var B = P.B, bun = M64().ellipse(32, 9.5, 9.5, 7.2);
        shadeFill(B, bun, [R[1], R[2], R[3]], TAG.HAIR, { cx: 28, cy: 5, rx: 12, ry: 9, edge: 0.4, th: [-0.05, 0.45] });
        strands(B, bun, [[[24, 12], [32, 15], [40, 11]], [[27, 8], [33, 10], [38, 7]], [[29, 5], [34, 4], [37, 6]]], R[1]);
        strands(B, bun, [[[26, 6], [28, 4], [31, 3]]], R[4]);
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 9, 29);
        shadeFill(B, M, DRESS, TAG.CLOTH, { cx: 20, cy: 40, rx: 40, ry: 30 });
        var SH = M.clone().sub(M64().poly([[22, 46], [42, 46], [36, 58], [32, 64], [28, 58]]));
        shadeFill(B, SH, SHAWL, TAG.CLOTH, { cx: 16, cy: 46, rx: 30, ry: 22, edge: 0.35, th: [-0.55, -0.05, 0.42] });
        SH.each(function (x, y) { // garter-knit ridges following the drape
          var dx = Math.abs(x + 0.5 - 32), ridge = Math.round(y - dx * 0.35);
          if (ridge % 3 === 0) { var c = B.get(x, y); B.set(x, y, c === SHAWL[3] ? SHAWL[2] : c === SHAWL[2] ? SHAWL[1] : c === SHAWL[1] ? mix(SHAWL[1], SHAWL[0], 0.6) : c); }
        });
        innerLine(B, SH, SHAWL[0], function (t, c) { return DRESS.indexOf(c) >= 0; });
        stamp(B, ['.cccccccccc.', 'cCcCcCcCcCcc', '.C.C.C.C.C.C'], 26, 47, { c: H('#f4ead8'), C: H('#cbbfae') }, TAG.CLOTH);
        stamp(B, ['.gg.', 'gGWg', 'gWWg', '.gg.'], 30, 52, { g: GOLD[1], G: GOLD[2], W: H('#e89ab8') }, TAG.METAL);
      },
      front: function (P) {
        var B = P.B, S2 = P.skin;
        var hl = function (x) { var dx = x + 0.5 - 32; return 18.5 + 0.034 * dx * dx; };
        var M = M64().ellipse(32, 25.5, 16, 14.6).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        hairClumps(B, M, R, { px: 32, py: 11, aw: 0.26, ph: 0.5, cx: 25, cy: 14, rx: 18, ry: 16, k: 0.3, shine: [32, 25, 9.5, 11.5], shineTest: function (x) { return x < 30; } });
        innerLine(B, M, R[0], function (t) { return t === TAG.SKIN; });
        innerLine(B, M, R[1], function (t, c) { return t === TAG.HAIR; }, [[0, -1]]);
        // lavender sprig tucked in the bun
        bez([[36, 11], [41, 7], [46, 2]]).forEach(function (p) { B.set(p[0], p[1], H('#337450'), TAG.ACC); });
        B.set(43, 7, H('#4c9061'), TAG.ACC); B.set(44, 8, H('#4c9061'), TAG.ACC);
        [[45, 3], [47, 1], [43, 5], [46, 5], [48, 2]].forEach(function (p) { B.set(p[0], p[1], H('#8f6cd1'), TAG.ACC); B.set(p[0] + 1, p[1], H('#b99aee'), TAG.ACC); B.set(p[0], p[1] - 1, H('#e4d2ff'), TAG.ACC); });
        // round gold spectacles
        var ex = P.f.eyeX, ey = P.f.eyeY;
        [[ex + 3.5, ey + 3], [63 - ex - 3 + 0.5, ey + 3]].forEach(function (c) {
          ring(B, c[0], c[1], 5, 4.6, GOLD);
          B.set(Math.round(c[0] - 3), Math.round(c[1] - 2), H('#fff1c8'), TAG.GLASS);
        });
        B.hline(30, 33, ey + 2, GOLD[1], TAG.METAL);
        // rosy cheeks, smile lines
        sym(B, [[23, 38], [24, 38], [25, 38], [24, 39]], S2.blush, TAG.SKIN);
        sym(B, [[27, 39], [27, 40]], S2.s, TAG.SKIN);
      }
    };
  })();

  // ---- 2. Pip Fizzlewick: wild ginger hair, brass goggles, freckles, soot, gap-toothed grin, patched purple coat
  NPC.pip = (function () {
    var R = HAIR.ginger, S = SKIN.fair;
    var COAT = HS(['#2e1c52', '#4a2f7a', '#6a47a8', '#8f6cd1']);
    var BRASS = HS(['#5a3a14', '#a87a2e', '#e0b050', '#fff1c8']);
    var LENS = HS(['#173a4a', '#2f7a8a', '#7ad0d8', '#e0fbff']);
    var STRAP = HS(['#281d21', '#574039', '#7a5a48']);
    var SHIRT = HS(['#a89a88', '#d8ccb8', '#f4ead8']);
    return {
      skin: S, face: FACES.kid, eyeStyle: 'kid', eyeC: EYEC.blue, neckW: 4,
      brows: { pts: [[0, -3], [3, -4], [7, -3]], col: R[1], thick: 2, mod: { neutral: function () { return -1; } } },
      mouths: { neutral: 'pipGrin', happy: 'pipHappy', sad: 'pipSad', surprised: 'pipO', angry: 'pipPout' },
      mouthLib: {
        pipGrin: ['D.........D', '.DDDDDDDDD.', '.DtttmtttD.', '..DmmmmmD..', '...DuuuD...', '....sss....'],
        pipGrinTalk: ['D.........D', '.DDDDDDDDD.', '.DtttmtttD.', '.DmmmmmmmD.', '..DmuuumD..', '...DDDDD...'],
        pipHappy: ['DD.........DD', '.DDDDDDDDDDD.', '.DttttmttttD.', '.DmmmmmmmmmD.', '..DmmuuummD..', '...DDuuuDD...', '.....DDD.....'],
        pipHappyTalk: ['DD.........DD', '.DDDDDDDDDDD.', '.DttttmttttD.', '.DmmmmmmmmmD.', '.DmmmuuummmD.', '..DmmuuummD..', '...DDDDDDD...'],
        pipSad: ['...DDD...', '..D...D..', '.D.....D.', '.........'],
        pipSadTalk: ['...DDD...', '..DmmmD..', '.DmuuumD.', '..DDDDD..'],
        pipO: ['..DDD..', '.DmmmD.', 'DmmmmmD', 'DmmuumD', '.DmmmD.', '..DDD..'],
        pipOTalk: ['..DDD..', '.DmmmD.', 'DmmmmmD', 'DmuuumD', 'DmuuumD', '.DDDDD.'],
        pipPout: ['.DD.DD.', 'D..D..D', '.......'],
        pipPoutTalk: ['.DDDDD.', 'DttTttD', '.DDDDD.']
      },
      back: function (P) { },
      body: function (P) {
        var B = P.B, M = torso(48, 7, 22, 8, 27);
        shadeFill(B, M, COAT, TAG.CLOTH, { cx: 16, cy: 44, rx: 30, ry: 24, edge: 0.3 });
        var V = M64().poly([[26, 47], [38, 47], [32, 58]]).and(M);
        shadeFill(B, V, SHIRT, TAG.CLOTH, { cx: 28, cy: 46, rx: 8, ry: 10 });
        // big floppy lapels
        var lap = M64().poly([[25, 47], [32, 59], [29, 63], [19, 53], [20, 48]]).sym().and(M);
        shadeFill(B, lap, COAT, TAG.CLOTH, { cx: 20, cy: 44, rx: 22, ry: 18, bias: 0.3, edge: 0.4 });
        edgePx(lap, [[0, 1], [1, 0], [-1, 0]]).forEach(function (p) { if (!V.has(p[0], p[1]) && M.has(p[0], p[1] + 1)) B.set(p[0], p[1], COAT[0], TAG.CLOTH); });
        // patches with stitches
        stamp(B, ['GGGGGG', 'GgGgGg', 'gGgGgG', 'GgGgGg', 'GGGGGG'], 11, 55, { G: H('#4c9061'), g: H('#337450') }, TAG.CLOTH);
        stamp(B, ['w.w.w.', '.....w', 'w.....', '.....w', '.w.w.w'], 11, 55, { w: H('#c8e6b0') }, TAG.CLOTH);
        stamp(B, ['OOOOO', 'OoOoO', 'OOOOO', 'OoOoO'], 46, 57, { O: H('#d0903a'), o: H('#a8641e') }, TAG.CLOTH);
        stamp(B, ['w.w.w', '....w', 'w....', 'w.w.w'], 46, 57, { w: H('#f6d8a0') }, TAG.CLOTH);
        // brass buttons
        [[36, 58], [35, 62]].forEach(function (p) { B.set(p[0], p[1], BRASS[2], TAG.METAL); B.set(p[0] + 1, p[1], BRASS[1], TAG.METAL); B.set(p[0], p[1] + 1, BRASS[1], TAG.METAL); B.set(p[0] + 1, p[1] + 1, BRASS[0], TAG.METAL); });
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin, fr = mix(S2.b, S2.s, 0.85);
        // freckles: a neat sprinkle over the nose bridge and upper cheeks
        sym(B, [[23, 36], [25, 36], [24, 37], [26, 37], [22, 37], [29, 35], [28, 36]], fr, TAG.SKIN);
        // soot smudge on the right cheek
        [[38, 37, 1], [39, 37, 1], [40, 37, 0], [37, 38, 0], [38, 38, 1], [39, 38, 1], [40, 38, 1], [41, 38, 0], [39, 39, 0], [40, 39, 0]].forEach(function (p) { B.set(p[0], p[1], p[2] ? H('#7a6a76') : H('#a08a8c'), TAG.SKIN); });
      },
      front: function (P) {
        var B = P.B, cx = 32, cy = 23, rx = 16.5, ry = 12.5;
        var hair = M64().ellipse(cx, cy, rx, ry);
        [[-168, 6], [-150, 8], [-128, 9], [-106, 8], [-84, 9], [-62, 9], [-40, 8], [-20, 7], [-2, 5], [178, 5], [14, 4], [166, 4]].forEach(function (s, i) {
          var a = s[0] * Math.PI / 180, bw = 0.2, bend = (i % 2 ? 0.12 : -0.1);
          hair.poly([[cx + Math.cos(a - bw) * (rx - 1), cy + Math.sin(a - bw) * (ry - 1)], [cx + Math.cos(a + bend) * (rx + s[1]), cy + Math.sin(a + bend) * (ry + s[1])], [cx + Math.cos(a + bw) * (rx - 1), cy + Math.sin(a + bw) * (ry - 1)]]);
        });
        hair.sub(M64().poly([[14, 31], [19, 27], [21, 22], [23, 25], [25, 21], [27, 24], [29, 20], [31, 24], [33, 20], [35, 24], [37, 21], [39, 25], [41, 21], [43, 25], [45, 27], [50, 31], [50, 64], [14, 64]]));
        hair.or(faceTop(P, function () { return 20; }));
        hairClumps(B, hair, R, { px: 32, py: 15, aw: 0.42, ph: 0.3, cx: 24, cy: 12, rx: 22, ry: 18, k: 0.45, gap: 0.16, r0: 3, shine: [31, 22, 10, 12], shineTest: function (x, y) { return x < 32 && y < 20; } });
        innerLine(B, hair, R[0], function (t) { return t === TAG.SKIN; });
        // goggles: strap around the head + two brass-rimmed lenses
        for (var x = 14; x <= 49; x++) { var dx = (x + 0.5 - 32) / 18, y = Math.round(16 + dx * dx * 6); if (hair.has(x, y)) { B.set(x, y, STRAP[2], TAG.ACC); B.set(x, y + 1, STRAP[1], TAG.ACC); B.set(x, y + 2, STRAP[0], TAG.ACC); } }
        [[25.5, 16.5], [38.5, 16.5]].forEach(function (c) {
          var outer = M64().ellipse(c[0], c[1], 5, 4.6), inner = M64().ellipse(c[0], c[1], 3.2, 2.9);
          outer.clone().sub(inner).each(function (x, y) { var v = sph(x, y, c[0], c[1], 5, 5); B.set(x, y, v > 0.3 ? BRASS[2] : v > -0.35 ? BRASS[1] : BRASS[0], TAG.METAL); });
          inner.each(function (x, y) { var v = sph(x, y, c[0] - 1, c[1] - 1, 3.6, 3.6); B.set(x, y, v > 0.6 ? LENS[2] : v > 0.05 ? LENS[1] : LENS[0], TAG.GLASS); });
          B.set(Math.floor(c[0]) - 1, Math.floor(c[1]) - 1, LENS[3], TAG.GLASS); B.set(Math.floor(c[0]), Math.floor(c[1]) - 1, LENS[2], TAG.GLASS);
        });
        B.hline(30, 33, 16, BRASS[1], TAG.METAL); B.hline(30, 33, 17, BRASS[0], TAG.METAL);
        var S2 = P.skin;
        if (P.e === 'happy' || P.e === 'neutral') sym(B, [[22, 38], [23, 38]], S2.blush, TAG.SKIN);
        if (P.e === 'angry') sym(B, [[21, 38], [22, 38], [21, 39], [22, 39], [23, 39]], S2.blush, TAG.SKIN);
        if (P.e === 'sad' && !P.blink) { var T = H('#8cc4f0'), T2 = H('#c4e6ff'); [[22, 36], [22, 37], [21, 38], [21, 39], [21, 40]].forEach(function (p, i) { B.set(p[0], p[1], i % 2 ? T : T2, TAG.EYE); B.set(63 - p[0], p[1], i % 2 ? T : T2, TAG.EYE); }); }
        if (P.e === 'surprised') { B.set(44, 22, H('#8cc4f0'), TAG.ACC); B.set(44, 23, H('#c4e6ff'), TAG.ACC); B.set(43, 23, H('#8cc4f0'), TAG.ACC); }
      }
    };
  })();

  // ---- 3. Sable Nightingale: long black braids with gold cuffs + violet flowers, gold hoops, burgundy bodice
  NPC.sable = (function () {
    var R = HAIR.black, S = skinR('#573424', '#76492f', '#976644', { d: '#3e2220', line: '#22101a', blush: '#8e4a3e', lip: '#7a3238' });
    var BOD = HS(['#3a0c1e', '#5e1630', '#86223f', '#a83a58']);
    var CHEM = HS(['#9a8a86', '#cfc0b4', '#efe4d8']);
    var FL1 = H('#8f6cd1'), FL2 = H('#c4a8f4'), FLC = H('#fff1c8');
    return {
      skin: S, face: FACES.oval, eyeStyle: 'almond', eyeC: EYEC.amber, lash: H('#0b0711'), faceLight: 0.56, castRows: 1,
      brows: { pts: [[0, -3], [2, -4], [5, -4], [7, -3]], col: R[1], thick: 1, asymR: { neutral: -1, angry: 1 } },
      mouths: { neutral: 'sSmirk', happy: 'sHappy', sad: 'sSad', surprised: 'o', angry: 'sTight' },
      mouthLib: {
        sSmirk: ['.......D', '.DDDDDD.', '..ppLp..'],
        sSmirkTalk: ['.......D', '.DDDDDD.', '.DmmmmD.', '..ppLp..'],
        sHappy: ['DDDDDDDD', 'DttttttD', '.DmmmmD.', '..ppLp..'],
        sHappyTalk: ['DDDDDDDD', 'DttttttD', 'DmmuummD', '.DpLpD..'],
        sSad: ['..DDDD..', '.D....D.', '..ppLp..'],
        sTight: ['DDDDDDDD', '.ppppLp.'],
        sTightTalk: ['DDDDDDDD', 'DtTttTtD', '.ppppLp.']
      },
      back: function (P) { // braids falling behind the shoulders
        var B = P.B, M = M64().poly([[17, 22], [47, 22], [52, 48], [50, 60], [14, 60], [12, 48]]);
        shadeFill(B, M, [R[1], R[2], R[3]], TAG.HAIR, { cx: 26, cy: 22, rx: 30, ry: 40, th: [0.1, 0.62] });
        for (var x = 13; x <= 51; x += 3) strands(B, M, [[[x, 22], [x + (x < 32 ? -1 : 1), 40], [x + (x < 32 ? -2 : 2), 60]]], R[1]);
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 8, 28);
        shadeFill(B, M, BOD, TAG.CLOTH, { cx: 18, cy: 46, rx: 34, ry: 26, edge: 0.3 });
        var S2 = P.skin;
        // bare neckline + collarbones
        var neck = M64().ellipse(32, 47, 11, 7).and(M);
        neck.each(function (x, y) { B.set(x, y, y > 50 ? S2.s : (x > 36 ? S2.s : S2.b), TAG.SKIN); });
        sym(B, [[25, 50], [26, 50], [27, 51], [28, 51]], S2.d, TAG.SKIN);
        // chemise ruffle: off-shoulder band
        var chem = M.clone().keep(function (x, y) { var dx = Math.abs(x + 0.5 - 32); return y >= 51 - (dx > 12 ? 2 : 0) && y <= 55 - (dx > 16 ? 1 : 0) + (dx < 9 ? 1 : 0); }).sub(neck);
        shadeFill(B, chem, CHEM, TAG.CLOTH, { cx: 18, cy: 48, rx: 30, ry: 12, edge: 0.3 });
        chem.each(function (x, y) { if ((ti(x) % 3) === 0) B.set(x, y, mix(B.get(x, y), CHEM[0], 0.5)); });
        // gold trim along the bodice top (sweetheart dip)
        for (var x = 8; x <= 55; x++) { var dx = Math.abs(x + 0.5 - 32), y = 56 + (dx < 3 ? 1 : 0) - (dx > 16 ? 1 : 0); if (M.has(x, y)) { B.set(x, y, GOLD[2], TAG.METAL); B.set(x, y + 1, GOLD[1], TAG.METAL); } }
        // laced front
        for (var y = 58; y < 64; y += 2) { B.set(31, y, GOLD[2], TAG.METAL); B.set(32, y + 1, GOLD[2], TAG.METAL); B.set(30, y + 1, GOLD[1], TAG.METAL); B.set(33, y, GOLD[1], TAG.METAL); }
      },
      front: function (P) {
        var B = P.B;
        var hl = function (x) { var dx = x + 0.5 - 32; return 17.5 + 0.03 * dx * dx; };
        var cap = M64().ellipse(32, 24, 15.5, 13.5).keep(function (x, y) { return y + 0.5 < hl(x) || Math.abs(x + 0.5 - 32) > 12.5 && y < 31; }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        hairClumps(B, cap, R, { px: 32, py: 10, aw: 0.2, ph: 0.5, cx: 25, cy: 13, rx: 18, ry: 16, k: 0.5, gap: 0.2, shine: [32, 24, 10, 12], shineTest: function (x) { return x < 31; } });
        innerLine(B, cap, R[0], function (t) { return t === TAG.SKIN; });
        // centre part
        for (var y = 10; y < 18; y++) B.set(31, y, mix(P.skin.s, R[1], 0.5), TAG.HAIR);
        // front braids over the shoulders
        var cuff = { cuffs: [0.3, 0.62, 0.9], cuffC: GOLD };
        braid(B, [[18, 29], [15, 44], [11, 63]], R, 3, cuff);
        braid(B, [[21, 33], [19, 48], [17, 63]], R, 3, { cuffs: [0.45, 0.8], cuffC: GOLD });
        braid(B, [[45, 29], [48, 44], [52, 63]], R, 3, cuff);
        braid(B, [[42, 33], [44, 48], [46, 63]], R, 3, { cuffs: [0.45, 0.8], cuffC: GOLD });
        // gold hoop earrings
        ring(B, 18.5, 40.5, 2.5, 3, GOLD); ring(B, 45.5, 40.5, 2.5, 3, GOLD);
        // tiny violet flowers in the braids and hair
        [[15, 40], [20, 53], [49, 38], [45, 55], [21, 17], [24, 14]].forEach(function (p) { flower(B, p[0], p[1], FL1, FL2, FLC); });
      }
    };
  })();

  // ---- 4. Brann Ironroot: bald + burn scar, heavy brows, huge braided ginger-red beard, apron, broad shoulders
  NPC.brann = (function () {
    var S = SKIN.tan, BR = HS(['#3e1210', '#7a2418', '#b8402a', '#e0663a', '#f6a060']);
    var SHIRT = HS(['#1b1a26', '#2d2c3e', '#45445a', '#605f78']);
    var APR = HS(['#281d21', '#3e2d2b', '#574039', '#7a5a48']);
    var IRON = HS(['#2d2c3e', '#605f78', '#a09fb6', '#e8eeff']);
    return {
      skin: S, face: FACES.broad, eyeStyle: 'small', eyeC: EYEC.grey, neckW: 7,
      brows: { pts: [[-2, -3], [1, -3], [5, -2], [7, -1]], col: BR[2], col2: BR[1], thick: 3, taper: 0.1,
        mod: { neutral: function (u) { return u > 0.7 ? 1 : 0; }, happy: function () { return -2; }, sad: function (u) { return Math.round(1 - 3.5 * u); }, angry: function (u) { return Math.round(-1 + 3.5 * u); } } },
      mouths: { neutral: 'bNeutral', happy: 'bHappy', sad: 'bSad', surprised: 'bO', angry: 'grit' },
      mouthLib: {
        bNeutral: ['bbbbbb'], bNeutralTalk: ['bbbbbb', 'bmmmmb', '.bbbb.'],
        bHappy: ['DttttttD', '.DmmmmD.', '..DDDD..'], bHappyTalk: ['DttttttD', 'DmmuummD', '.DDDDDD.'],
        bSad: ['..bbbb..', '.b....b.'], bSadTalk: ['..bbbb..', '.bmmmmb.', '.bbbbbb.'],
        bO: ['.bbbb.', 'bmmmmb', 'bmmmmb', '.bbbb.'], bOTalk: ['.bbbb.', 'bmmmmb', 'bmuumb', 'bmmmmb', '.bbbb.']
      },
      mouthLine: BR[0], nose: false, castRows: 1,
      body: function (P) {
        var B = P.B, M = torso(45, 11, 31, 7, 33), S2 = P.skin;
        shadeFill(B, M, SHIRT, TAG.CLOTH, { cx: 20, cy: 44, rx: 34, ry: 26, edge: 0.3 });
        // bare shoulders/arms outside the sleeveless shirt
        var arms = M.clone().keep(function (x, y) { var dx = Math.abs(x + 0.5 - 32); return dx > 20 + (y - 45) * 0.15; });
        shadeFill(B, arms, [S2.d, S2.s, S2.b, S2.l], TAG.SKIN, { cx: 14, cy: 48, rx: 40, ry: 22, edge: 0.4, th: [-0.45, -0.05, 0.5] });
        innerLine(B, arms, S2.d, function (t, c) { return SHIRT.indexOf(c) >= 0; });
        // leather apron + straps
        var apr = M64().poly([[17, 54], [47, 54], [49, 64], [15, 64]]).and(M);
        shadeFill(B, apr, APR, TAG.CLOTH, { cx: 20, cy: 50, rx: 30, ry: 20, edge: 0.3 });
        [[19, 46], [44, 46]].forEach(function (p, k) { for (var y = p[1]; y < 55; y++) { var x = p[0] + (k ? 1 : -1) * Math.round((y - p[1]) * 0.25); B.set(x, y, APR[2], TAG.CLOTH); B.set(x + 1, y, APR[1], TAG.CLOTH); B.set(x + 2, y, APR[0], TAG.CLOTH); } });
        [[18, 55], [45, 55]].forEach(function (p) { B.set(p[0], p[1], IRON[2], TAG.METAL); B.set(p[0] + 1, p[1], IRON[1], TAG.METAL); });
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin;
        // dome shine
        [[24, 12], [25, 12], [26, 12], [23, 13], [24, 13], [22, 14]].forEach(function (p) { B.set(p[0], p[1], S2.l, TAG.SKIN); });
        B.set(25, 13, mix(S2.l, WHITE, 0.55), TAG.SKIN); B.set(24, 14, mix(S2.l, WHITE, 0.3), TAG.SKIN);
        // burn scar on the scalp
        var sc = [[37, 12, 1], [38, 12, 2], [39, 12, 1], [36, 13, 1], [37, 13, 2], [38, 13, 3], [39, 13, 2], [40, 13, 1], [36, 14, 2], [37, 14, 3], [38, 14, 2], [39, 14, 3], [40, 14, 2], [41, 14, 1],
          [37, 15, 1], [38, 15, 2], [39, 15, 2], [40, 15, 3], [41, 15, 1], [38, 16, 1], [39, 16, 2], [40, 16, 1], [41, 16, 1], [39, 17, 1], [40, 17, 1], [35, 15, 1], [42, 17, 1]];
        var SC = HS(['#9a4a4a', '#d0807a', '#f0b0a0']);
        sc.forEach(function (p) { B.set(p[0], p[1], SC[p[2] - 1], TAG.SKIN); });
        if (P.e === "neutral" || P.e === "angry") { B.vline(30, 26, 28, S2.s, TAG.SKIN); B.vline(33, 26, 28, S2.s, TAG.SKIN); }
        // forehead creases (scowl) + soot
        B.hline(28, 35, 21, S2.s, TAG.SKIN); B.hline(29, 34, 23, S2.s, TAG.SKIN);
        [[22, 19], [23, 19], [22, 20], [24, 18], [40, 37], [41, 37], [41, 38]].forEach(function (p) { B.set(p[0], p[1], mix(S2.s, H('#45445a'), 0.55), TAG.SKIN); });
        if (P.e === 'angry') stamp(B, ['v.v', '.v.', 'v.v'], 40, 17, { v: H('#c44a3a') }, TAG.SKIN);
        // big broad nose
        stamp(B, ['..lb..', '..lbs.', '..lbs.', '.llbss', 'lbbbss', 'dbbbsd', '.DdsD.'], 29, 32, { l: S2.l, b: S2.b, s: S2.s, d: S2.d, D: S2.line }, TAG.SKIN);
        if (P.e === 'happy') sym(B, [[22, 36], [23, 36], [24, 36]], S2.blush, TAG.SKIN);
      },
      front: function (P) {
        var B = P.B;
        // beard mass
        var top = function (x) { var dx = Math.abs(x + 0.5 - 32); return Math.max(28, 39 - Math.max(0, dx - 6) * 1.6); };
        var beard = M64().poly([[17, 27], [18, 37], [14, 46], [12, 55], [16, 64], [48, 64], [52, 55], [50, 46], [46, 37], [47, 27]]).keep(function (x, y) { return y >= top(x); });
        hairClumps(B, beard, BR, { px: 32, py: 24, aw: 0.16, ph: 0.5, cx: 24, cy: 34, rx: 26, ry: 26, k: 0.5, gap: 0.18, tag: TAG.BEARD, shine: [30, 30, 13, 15], shineTest: function (x) { return x < 30; } });
        innerLine(B, beard, BR[0], function (t) { return t === TAG.SKIN; }, [[0, -1], [1, 0], [-1, 0]]);
        // mouth inside the beard, then the moustache over it
        drawMouth(P, 0);
        var mo = M64().poly([[32, 37], [26, 37], [21, 40], [19, 45], [22, 44], [26, 41], [30, 41], [32, 40]]).sym();
        hairClumps(B, mo, [BR[0], BR[2], BR[3], BR[4], BR[4]], { px: 32, py: 30, aw: 0.22, ph: 0.2, cx: 26, cy: 36, rx: 14, ry: 10, k: 0.3, gap: 0.15, tag: TAG.BEARD, th: [-0.3, 0.25] });
        innerLine(B, mo, BR[0], function (t, c) { return t !== TAG.SKIN; }, [[0, 1], [1, 0], [-1, 0]]);
        // braids with iron rings: centre + two side braids
        braid(B, [[32, 49], [32, 57], [32, 64]], BR, 5, { tag: TAG.BEARD, cuffs: [0.2, 0.75], cuffC: IRON, line: BR[0] });
        braid(B, [[21, 48], [19, 56], [18, 64]], BR, 3, { tag: TAG.BEARD, cuffs: [0.45], cuffC: IRON, line: BR[0] });
        braid(B, [[43, 48], [45, 56], [46, 64]], BR, 3, { tag: TAG.BEARD, cuffs: [0.45], cuffC: IRON, line: BR[0] });
      }
    };
  })();

  // ---- 5. Orvyn Starcloak: tall indigo starry hat, half-moon specs, bushy white brows, very long beard, blue robe
  NPC.orvyn = (function () {
    var S = SKIN.pale, W = HS(['#6e6a88', '#aaa6c0', '#d6d4e6', '#eeedf6', '#ffffff']);
    var HAT = HS(['#141236', '#22225a', '#33367f', '#4a50a8']);
    var ROBE = HS(['#101a40', '#17224c', '#213479', '#2e4f9f']);
    var STAR = HS(['#9fb0d8', '#e8eeff', '#ffffff']);
    function star(B, x, y, big) {
      B.set(x, y, STAR[2], TAG.HAT);
      if (big) { B.set(x - 1, y, STAR[1], TAG.HAT); B.set(x + 1, y, STAR[1], TAG.HAT); B.set(x, y - 1, STAR[1], TAG.HAT); B.set(x, y + 1, STAR[0], TAG.HAT); }
    }
    return {
      skin: S, face: FACES.long, eyeStyle: 'twinkle', eyeC: EYEC.ice,
      brows: { pts: [[-4, -1], [-1, -3], [3, -4], [7, -3]], col: W[3], col2: W[0], thick: 3, taper: 0.05, mod: { sad: function (u) { return Math.round(2 - 4 * u); } } },
      mouths: { neutral: 'oNeutral', happy: 'oHappy', sad: 'oSad', surprised: 'oO', angry: 'oFlat' },
      mouthLib: {
        oNeutral: ['b....b', '.bbbb.'], oNeutralTalk: ['.bbbb.', 'bmmmmb', '.bbbb.'],
        oHappy: ['bbbbbb', 'bmmmmb', '.bmmb.', '..bb..'], oHappyTalk: ['bbbbbb', 'bmmmmb', 'bmuumb', '.bbbb.'],
        oSad: ['.bbbb.', 'b....b'], oSadTalk: ['.bbbb.', 'bmmmmb', 'b.bb.b'],
        oO: ['.bb.', 'bmmb', 'bmmb', '.bb.'], oOTalk: ['.bb.', 'bmmb', 'bmub', 'bmmb', '.bb.'],
        oFlat: ['bbbbbb'], oFlatTalk: ['bbbbbb', 'bmmmmb', '.bbbb.']
      },
      mouthLine: W[0], nose: false,
      back: function (P) { // long white hair behind the ears
        var B = P.B, M = M64().poly([[17, 18], [13, 30], [11, 46], [14, 56], [22, 56], [21, 30]]).sym();
        hairClumps(B, M, W, { px: 32, py: 6, aw: 0.07, ph: 0.3, cx: 20, cy: 20, rx: 30, ry: 40, k: 0.4, gap: 0.2 });
      },
      body: function (P) {
        var B = P.B, M = torso(46, 9, 27, 8, 30);
        shadeFill(B, M, ROBE, TAG.CLOTH, { cx: 18, cy: 44, rx: 34, ry: 26, edge: 0.3 });
        // silver-trimmed collar edges
        for (var y = 46; y < 64; y++) { var x = Math.round(24 - (y - 46) * 0.5); B.set(x, y, SILVER[2], TAG.CLOTH); B.set(x - 1, y, SILVER[1], TAG.CLOTH); B.set(63 - x, y, SILVER[1], TAG.CLOTH); B.set(64 - x, y, SILVER[0], TAG.CLOTH); }
        [[9, 57], [52, 59], [13, 62]].forEach(function (p) { B.set(p[0], p[1], STAR[1], TAG.CLOTH); });
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin;
        // long nose
        stamp(B, ['.l..', '.l..', '.ls.', '.ls.', 'lls.', 'lbss', 'dDDd'], 30, 31, { l: S2.l, b: S2.b, s: S2.s, d: S2.d, D: S2.line }, TAG.SKIN);
        // wrinkles: crow's feet, under-eye, cheeks
        sym(B, [[20, 30], [20, 32], [21, 33], [23, 34], [24, 34], [25, 35]], S2.s, TAG.SKIN);
        sym(B, [[25, 37], [26, 38]], S2.s, TAG.SKIN);
      },
      front: function (P) {
        var B = P.B;
        // beard + moustache
        var top = function (x) { var dx = Math.abs(x + 0.5 - 32); return Math.max(31, 41 - Math.max(0, dx - 5) * 1.4); };
        var beard = M64().poly([[19, 30], [17, 40], [15, 50], [17, 58], [21, 64], [43, 64], [47, 58], [49, 50], [47, 40], [45, 30]]).keep(function (x, y) { return y >= top(x); });
        hairClumps(B, beard, W, { px: 32, py: 22, aw: 0.13, ph: 0.5, cx: 24, cy: 34, rx: 26, ry: 30, k: 0.5, gap: 0.16, tag: TAG.BEARD, wave: [0.5, 0.25], shine: [30, 36, 9, 11], shineTest: function (x) { return x < 30; } });
        innerLine(B, beard, W[0], function (t) { return t === TAG.SKIN; }, [[0, -1], [1, 0], [-1, 0]]);
        drawMouth(P, 0);
        var mo = M64().poly([[32, 38], [27, 38], [22, 41], [19, 47], [23, 45], [27, 42], [31, 42], [32, 41]]).sym();
        hairClumps(B, mo, W, { px: 32, py: 30, aw: 0.22, ph: 0.2, cx: 26, cy: 37, rx: 14, ry: 10, k: 0.3, gap: 0.15, tag: TAG.BEARD, th: [-0.25, 0.25] });
        innerLine(B, mo, W[0], function (t) { return t !== TAG.SKIN; }, [[0, 1]]);
        // half-moon spectacles low on the nose
        var specs = ['GGGGGGG', 'GwwwwwG', '.GwwwG.', '..GGG..'], tint = mix(P.skin.b, H('#c8d4f0'), 0.45);
        stamp(B, specs, 22, 34, { G: GOLD[1], w: tint }, TAG.METAL); stamp(B, specs, 35, 34, { G: GOLD[1], w: tint }, TAG.METAL);
        B.hline(29, 34, 34, GOLD[1], TAG.METAL); B.set(23, 35, WHITE, TAG.GLASS); B.set(36, 35, WHITE, TAG.GLASS);
        B.hline(22, 26, 34, GOLD[2], TAG.METAL); B.hline(35, 38, 34, GOLD[2], TAG.METAL);
        // hat: brim + tall bent cone with silver stars
        var brim = M64().ellipse(32, 18, 24.5, 4.2);
        shadeFill(B, brim, HAT, TAG.HAT, { cx: 20, cy: 14, rx: 30, ry: 8, edge: 0.5, th: [-0.35, 0.1, 0.5] });
        var cone = M64().poly([[19, 17], [22, 11], [25, 6], [29, 2], [34, 0], [40, -1], [46, 1], [50, 5], [51, 9], [48, 8], [45, 5], [41, 4], [38, 6], [41, 12], [45, 17]]);
        shadeFill(B, cone, HAT, TAG.HAT, { cx: 26, cy: 6, rx: 16, ry: 16, edge: 0.45, th: [-0.35, 0.1, 0.55] });
        innerLine(B, cone, HAT[0], function (t) { return t === TAG.HAT; }, [[0, 1]]);
        // silver band + crescent
        for (var x = 19; x <= 45; x++) { var y = 16 - Math.round(Math.abs(x + 0.5 - 32) < 9 ? 0 : 0); if (cone.has(x, y)) { B.set(x, y, SILVER[2], TAG.HAT); B.set(x, y - 1, SILVER[1], TAG.HAT); } }
        stamp(B, ['.ccc', 'cc..', 'c...', 'cc..', '.ccc'], 29, 7, { c: H('#f2c45a') }, TAG.HAT);
        star(B, 24, 12, true); star(B, 36, 9, true); star(B, 41, 2, true); star(B, 33, 3); star(B, 27, 8); star(B, 40, 13); star(B, 12, 19); star(B, 52, 18); star(B, 47, 6);
        innerLine(B, brim, HAT[0], function (t) { return t === TAG.SKIN || t === TAG.HAIR || t === TAG.BROW; }, [[0, 1]]);
      }
    };
  })();

  // ---- 6. Elowen Mossbright: elf ears, long moss hair, leaf-and-twig crown, freckles, green hooded cloak
  NPC.elowen = (function () {
    var R = HAIR.moss, S = SKIN.olive;
    var CLOAK = HS(['#0f2e2c', '#18443e', '#235c50', '#347a62']), LIN = HS(['#3e2d2b', '#574039', '#7a5a48']);
    var WOOD = HS(['#3e2d2b', '#7a5a48', '#9c7a5e', '#c09a74']), LEAF = HS(['#245a40', '#4c9061', '#74b46e', '#a8dc8c']);
    var TUN = HS(['#8a7a5a', '#b8a882', '#ddd0a8']);
    return {
      skin: S, face: FACES.oval, eyeStyle: 'doe', eyeC: EYEC.leaf,
      brows: { pts: [[0, -3], [3, -4], [7, -4]], col: R[1], thick: 1, mod: { neutral: function (u) { return u > 0.6 ? -1 : 0; } } },
      gaze: function (P) { return P.e === 'neutral' ? -1 : P.e === 'sad' ? 1 : 0; },
      mouths: { neutral: 'eShy', happy: 'eHappy', sad: 'eSad', surprised: 'o', angry: 'eFierce' },
      mouthLib: {
        eShy: ['D...D', '.DDD.'], eShyTalk: ['.DDD.', 'DmmmD', '.DDD.'],
        eHappy: ['D......D', '.DttttD.', '..DmmD..'], eHappyTalk: ['DDDDDDDD', '.DttttD.', '.DmuumD.', '..DDDD..'],
        eSad: ['..DDD..', '.D...D.'], eSadTalk: ['..DDD..', '.DmmmD.', '.DDDDD.'],
        eFierce: ['DDDDDDDD', 'DtTtTtTD', 'D......D'], eFierceTalk: ['DDDDDDDD', 'DttttttD', 'DmmmmmmD', '.DDDDDD.']
      },
      drawEars: function (P) {
        var B = P.B, S2 = P.skin;
        var ear = M64().poly([[21, 29], [8, 21], [10, 24], [14, 29], [18, 35], [21, 37]]);
        ear.each(function (x, y) { B.set(x, y, S2.b, TAG.SKIN); });
        edgePx(ear, [[0, 1]]).forEach(function (p) { B.set(p[0], p[1], S2.s, TAG.SKIN); });
        bez([[11, 24], [15, 27], [19, 33]]).forEach(function (p) { B.set(p[0], p[1], S2.s, TAG.SKIN); B.set(p[0], p[1] + 1, S2.d, TAG.SKIN); });
        B.set(10, 22, S2.l, TAG.SKIN); B.set(11, 23, S2.l, TAG.SKIN); B.set(13, 25, S2.l, TAG.SKIN);
        var earR = ear.flipX();
        earR.each(function (x, y) { B.set(x, y, S2.s, TAG.SKIN); });
        bez([[52, 24], [48, 27], [44, 33]]).forEach(function (p) { B.set(p[0], p[1], S2.d, TAG.SKIN); });
      },
      back: function (P) {
        var B = P.B;
        // hood bunched behind the neck
        var hood = M64().ellipse(32, 47, 19, 8);
        shadeFill(B, hood, CLOAK, TAG.CLOTH, { cx: 24, cy: 41, rx: 22, ry: 10, edge: 0.4 });
        // long hair behind
        var M = M64().poly([[17, 20], [13, 34], [12, 50], [16, 60], [24, 60], [22, 32]]).sym();
        hairClumps(B, M, R, { px: 32, py: 8, aw: 0.08, ph: 0.2, cx: 20, cy: 22, rx: 30, ry: 40, k: 0.4, gap: 0.22 });
      },
      body: function (P) {
        var B = P.B, M = torso(48, 9, 25, 8, 28);
        shadeFill(B, M, CLOAK, TAG.CLOTH, { cx: 16, cy: 46, rx: 30, ry: 24, edge: 0.35 });
        var V = M64().poly([[27, 47], [37, 47], [32, 56]]).and(M);
        shadeFill(B, V, TUN, TAG.CLOTH, { cx: 28, cy: 46, rx: 8, ry: 10 });
        // cloak front edges with brown lining peeking
        for (var y = 50; y < 64; y++) { var o = Math.round((y - 50) * 0.3); B.set(28 - o, y, LIN[1], TAG.CLOTH); B.set(35 + o, y, LIN[0], TAG.CLOTH); }
        // wooden clasp with a carved leaf
        stamp(B, ['.ooo.', 'oWWWo', 'oWlWo', 'oWWWo', '.ooo.'], 29, 52, { o: WOOD[0], W: WOOD[2], l: LEAF[1] }, TAG.ACC);
        B.set(30, 53, WOOD[3], TAG.ACC); B.hline(26, 28, 54, WOOD[1], TAG.ACC); B.hline(34, 37, 54, WOOD[1], TAG.ACC);
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin, fr = mix(S2.b, S2.s, 0.8);
        sym(B, [[24, 36], [26, 37], [23, 37], [29, 35], [28, 36]], fr, TAG.SKIN);
        var bl = P.e === 'angry' ? 0 : 1;
        if (bl) sym(B, [[22, 38], [23, 37], [24, 38]].concat(P.e === 'happy' || P.e === 'surprised' ? [[25, 38], [23, 39]] : []), S2.blush, TAG.SKIN);
        if (P.e === 'sad' && !P.blink) { B.set(23, 36, H('#a8dcff'), TAG.EYE); B.set(23, 37, H('#69a1db'), TAG.EYE); B.set(22, 38, H('#a8dcff'), TAG.EYE); }
      },
      front: function (P) {
        var B = P.B;
        var hl = function (x) { var dx = x + 0.5 - 32; return 19 + 0.03 * dx * dx; };
        var cap = M64().ellipse(32, 24, 16, 13.8).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        // side-swept bangs from a part on the right
        cap.poly([[38, 14], [44, 18], [42, 21], [36, 23], [30, 25], [24, 26], [20, 30], [18, 28], [20, 21], [28, 16]]);
        // long side locks in front of the ears' roots
        cap.poly([[19, 24], [22, 30], [21, 40], [18, 50], [15, 54], [16, 40], [17, 28]]);
        cap.poly([[45, 24], [42, 30], [43, 40], [46, 50], [49, 54], [48, 40], [47, 28]]);
        hairClumps(B, cap, R, { px: 40, py: 10, aw: 0.17, ph: 0.4, cx: 24, cy: 14, rx: 20, ry: 18, k: 0.65, gap: 0.18, shine: [32, 24, 10, 12], shineTest: function (x) { return x < 32; } });
        innerLine(B, cap, R[0], function (t) { return t === TAG.SKIN; });
        // twig crown with leaves
        for (var x = 16; x <= 47; x++) { var dx = (x + 0.5 - 32) / 16, y = Math.round(15 + dx * dx * 5); B.set(x, y, WOOD[1], TAG.ACC); B.set(x, y + 1, WOOD[0], TAG.ACC); if (x % 4 === 0) B.set(x, y - 1, WOOD[2], TAG.ACC); }
        [[17, 18, -1], [21, 14, -1], [26, 12, -1], [31, 11, 0], [36, 12, 1], [41, 14, 1], [46, 18, 1]].forEach(function (p) {
          var x = p[0], y = p[1], s = p[2];
          B.set(x, y, LEAF[1], TAG.ACC); B.set(x + s, y - 1, LEAF[2], TAG.ACC); B.set(x, y - 1, LEAF[2], TAG.ACC); B.set(x + s, y - 2, LEAF[3], TAG.ACC); B.set(x - s, y, LEAF[0], TAG.ACC);
          if (s === 0) { B.set(x - 1, y - 1, LEAF[2], TAG.ACC); B.set(x + 1, y - 1, LEAF[1], TAG.ACC); B.set(x, y - 2, LEAF[3], TAG.ACC); B.set(x, y - 3, LEAF[2], TAG.ACC); }
        });
        [[23, 13], [39, 13]].forEach(function (p) { flower(B, p[0], p[1], H('#e8eeff'), WHITE, H('#ffbc62')); });
      }
    };
  })();

  // ---- 7. Grizelda Hexley: huge crooked hat + raven feather, wild grey-black hair, hooked nose + wart, gold tooth
  NPC.grizelda = (function () {
    var S = SKIN.witch, R = HS(['#120c1c', '#2a2238', '#46395c', '#6e6a84', '#a8a4bc']);
    var HAT = HS(['#1b1429', '#2e1f45', '#45306a', '#604e88']);
    var SHAWL = HS(['#22182c', '#31233d', '#43324d', '#56425f']), BAND = HS(['#1f3a2c', '#2f5a3e', '#4c7a52']);
    var FEA = HS(['#0b0711', '#1b1429', '#2e2442', '#46395c', '#8a6ad0']);
    function feather(B, ax, ay, bx, by, wmax) {
      var L = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)), dx = (bx - ax) / L, dy = (by - ay) / L, nx = -dy, ny = dx;
      var left = [], right = [];
      for (var i = 0; i <= 12; i++) { var t = i / 12, w = Math.sin(Math.PI * Math.pow(t, 0.7)) * wmax; left.push([ax + dx * L * t + nx * w, ay + dy * L * t + ny * w]); right.push([ax + dx * L * t - nx * w, ay + dy * L * t - ny * w]); }
      var M = M64().poly(left.concat(right.reverse()));
      M.each(function (x, y) { var side = (x + 0.5 - ax) * nx + (y + 0.5 - ay) * ny; B.set(x, y, side > 0.6 ? FEA[3] : side < -0.6 ? FEA[1] : FEA[2], TAG.ACC); });
      [0.3, 0.5, 0.68].forEach(function (t, k) { var px = ax + dx * L * t, py = ay + dy * L * t, s = k % 2 ? 1 : -1; for (var j = 1; j <= wmax + 1; j++) { var qx = Math.round(px + nx * j * s - dx * j * 0.9), qy = Math.round(py + ny * j * s - dy * j * 0.9); if (M.has(qx, qy)) B.set(qx, qy, FEA[0], TAG.ACC); } });
      bez([[ax, ay], [bx, by]]).forEach(function (p, i, a) { if (i < a.length - 2) B.set(p[0], p[1], i < a.length * 0.55 ? FEA[4] : FEA[3], TAG.ACC); });
      return M;
    }
    return {
      skin: S, face: FACES.angular, eyeStyle: 'beady', eyeC: EYEC.yellow,
      brows: { pts: [[0, -2], [3, -3], [6, -2]], col: R[3], col2: R[2], thick: 2, asymL: { neutral: -1 }, mod: { neutral: function (u) { return u > 0.6 ? 1 : 0; } } },
      mouths: { neutral: 'gGrin', happy: 'gCackle', sad: 'gSad', surprised: 'gO', angry: 'gSnarl' },
      mouthLib: {
        gGrin: ['D..........D', 'DDDDDDDDDDDD', '.DtTtgtTtTD.', '..DDDDDDDD..'],
        gGrinTalk: ['D..........D', 'DDDDDDDDDDDD', '.DtTtgtTtTD.', '.DmmmmmmmmD.', '..DDDDDDDD..'],
        gCackle: ['DDDDDDDDDDDD', 'DtTtgtTtTttD', 'DmmmmmmmmmmD', '.DmmmuummmD.', '..DDDDDDDD..'],
        gSad: ['...DDDDD...', '..D.....D..', '.D.......D.'],
        gSadTalk: ['...DDDDD...', '..DmmmmmD..', '.D.DDDDD.D.'],
        gO: ['..DDDD..', '.DtgtTD.', 'DmmmmmmD', '.DmmmmD.', '..DDDD..'],
        gSnarl: ['DDDDDDDDDD', 'DtTtgtTtTD', 'DmmmmmmmmD', 'DDDDDDDDDD']
      },
      nose: false, castRows: 2,
      back: function (P) { // wild frizzy hair spilling out under the brim
        var B = P.B, M = M64();
        M.poly([[19, 18], [9, 23], [5, 33], [6, 43], [11, 52], [18, 50], [21, 36], [22, 22]]);
        M.poly([[45, 18], [55, 23], [59, 33], [58, 43], [53, 52], [46, 50], [43, 36], [42, 22]]);
        for (var i = 0; i < 26; i++) { // frizz tufts
          var side = i % 2 ? 1 : -1, t = (i >> 1) / 13, y = 22 + t * 29, x = 32 + side * (17 + Math.sin(t * 3.1) * 11);
          M.poly([[x, y - 2], [x + side * (3 + (i % 3)), y + ((i >> 1) % 3) - 1], [x, y + 2]]);
        }
        hairClumps(B, M, R, { px: 32, py: 12, aw: 0.12, ph: 0.3, cx: 16, cy: 24, rx: 36, ry: 32, k: 0.7, gap: 0.2, wave: [0.55, 0.28] });
        strands(B, M, [[[14, 26], [10, 35], [11, 45]], [[51, 27], [54, 36], [53, 44]]], R[3]);
      },
      body: function (P) {
        var B = P.B, M = torso(47, 8, 24, 8, 27);
        shadeFill(B, M, SHAWL, TAG.CLOTH, { cx: 16, cy: 46, rx: 30, ry: 22, edge: 0.35 });
        // ragged hem lines + a necklace of little bones and an amber charm
        [[12, 55], [16, 58], [46, 56], [50, 59]].forEach(function (p) { B.line(p[0], p[1], p[0] + 3, p[1] + 4, SHAWL[0], TAG.CLOTH); });
        for (var x = 22; x <= 41; x++) { var dx = (x + 0.5 - 32) / 10, y = Math.round(50 + (1 - dx * dx) * 4); B.set(x, y, H('#574039'), TAG.ACC); if (x % 3 === 0) { B.set(x, y + 1, H('#e8e0d0'), TAG.ACC); B.set(x, y + 2, H('#a8a090'), TAG.ACC); } }
        stamp(B, ['.aa.', 'aAAa', 'aAWa', '.aa.'], 30, 54, { a: H('#c87a20'), A: H('#ffbc62'), W: H('#fff1c8') }, TAG.ACC);
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin;
        // wrinkles
        sym(B, [[21, 34], [22, 35], [24, 35], [25, 41], [25, 42], [24, 43]], S2.s, TAG.SKIN);
        B.hline(30, 33, 46, S2.s, TAG.SKIN);
        if (P.e === 'happy') sym(B, [[21, 37], [22, 37], [22, 38]], S2.blush, TAG.SKIN);
      },
      front: function (P) {
        var B = P.B, S2 = P.skin;
        // big hooked nose (drawn over the mouth corner area) with a wart
        stamp(B, ['...lb...', '...lbs..', '...lbs..', '..llbs..', '..lbbssD', '..lbbssD', '.llbbssD', '.lbbbssD', '.lbbbsdD', '.dbbbsdD', '..dbbdD.', '...DDD..'],
          28, 29, { l: S2.l, b: S2.b, s: S2.s, d: S2.d, D: S2.line }, TAG.SKIN);
        stamp(B, ['.ww.', 'wWWw', 'wWWw', '.ww.'], 26, 35, { w: H('#4e6a3c'), W: H('#6a8a4a') }, TAG.SKIN);
        B.set(27, 36, H('#a2bd86'), TAG.SKIN); B.set(26, 34, H('#2a3424'), TAG.SKIN);
        // crooked brim (tilted ellipse)
        var brim = M64().fn(function (x, y) { var X = x + 0.5 - 32, Y = y + 0.5 - 18.5, a = -0.12, rx = X * Math.cos(a) - Y * Math.sin(a), ry = X * Math.sin(a) + Y * Math.cos(a); return (rx * rx) / (31.5 * 31.5) + (ry * ry) / (5 * 5) <= 1; });
        shadeFill(B, brim, HAT, TAG.HAT, { cx: 16, cy: 12, rx: 36, ry: 9, edge: 0.55, th: [-0.25, 0.15, 0.55] });
        // tall cone: leans left, kinks, then droops to the right
        var cone = M64().poly([[18, 18], [20, 12], [21, 8], [20, 4], [21, 1], [24, -1], [29, 0], [33, 2], [39, 2], [45, 4], [50, 8], [54, 13], [52, 14], [48, 11], [43, 8], [38, 8], [37, 11], [40, 15], [46, 18]]);
        shadeFill(B, cone, HAT, TAG.HAT, { cx: 22, cy: 3, rx: 22, ry: 18, edge: 0.45, th: [-0.3, 0.1, 0.55] });
        innerLine(B, cone, HAT[0], function (t) { return t === TAG.HAT; }, [[0, 1]]);
        strands(B, cone, [[[22, 7], [25, 5], [29, 4]], [[33, 3], [35, 5], [37, 8]], [[44, 6], [47, 8], [50, 11]]], HAT[0], TAG.HAT);
        // band + stitched patch
        for (var x = 18; x <= 46; x++) { var y = Math.round(14 + (x - 18) * 0.09); if (cone.has(x, y)) { B.set(x, y, BAND[2], TAG.HAT); B.set(x, y + 1, BAND[1], TAG.HAT); B.set(x, y + 2, BAND[0], TAG.HAT); } }
        stamp(B, ['ppppp', 'pPpPp', 'ppppp', 'pPpPp'], 29, 7, { p: H('#6a47a8'), P: H('#8f6cd1') }, TAG.HAT);
        [[28, 7], [28, 9], [34, 8], [34, 10], [30, 11], [32, 11]].forEach(function (p) { B.set(p[0], p[1], H('#c4b4e4'), TAG.HAT); });
        // raven feather tucked into the band (left side)
        feather(B, 22, 15, 9, 1, 2.6);
        innerLine(B, brim, HAT[0], function (t) { return t === TAG.SKIN || t === TAG.HAIR || t === TAG.BROW || t === TAG.EYE; }, [[0, 1]]);
      }
    };
  })();

  // ---- 8. Corvin Ashgrave: black hair over one eye, tired violet eyes, silver earring, high-collared coat, raven pin
  NPC.corvin = (function () {
    var S = SKIN.cool, R = HAIR.black;
    var COAT = HS(['#120c1c', '#201a32', '#2e2646', '#41385e']), LIN = HS(['#2a1030', '#4a2250', '#6a3466']);
    var CRAV = HS(['#3a1428', '#5a2238', '#7a3048']);
    return {
      skin: S, face: FACES.narrow, eyeStyle: 'tired', eyeC: EYEC.dusk, hideEyeL: true,
      brows: { pts: [[0, -2], [3, -3], [6, -3]], col: R[2], thick: 1, noL: true, mod: { neutral: function () { return 0; }, happy: function () { return 0; } } },
      mouths: { neutral: 'cFlat', happy: 'cSmirk', sad: 'cSad', surprised: 'cO', angry: 'cAngry' },
      mouthLib: {
        cFlat: ['DDDDD', '.sss.'], cFlatTalk: ['.DDD.', 'DmmmD', '.DDD.'],
        cSmirk: ['.....D', 'DDDDD.', '.sss..'], cSmirkTalk: ['.....D', 'DDDDD.', '.DmmD.', '..DD..'],
        cSad: ['.DDDD.', 'D....D'], cSadTalk: ['.DDDD.', 'DmmmmD', '.DDDD.'],
        cO: ['.DD.', 'DmmD', '.DD.'], cOTalk: ['.DD.', 'DmmD', 'DmmD', '.DD.'],
        cAngry: ['DDDDDD', 'D....D'], cAngryTalk: ['DDDDDD', 'DtTtTD', 'DDDDDD']
      },
      back: function (P) {
        var B = P.B, M = M64().poly([[17, 22], [14, 34], [16, 44], [22, 44], [21, 30]]).sym();
        hairClumps(B, M, R, { px: 32, py: 10, aw: 0.1, ph: 0.3, cx: 20, cy: 22, rx: 30, ry: 30, k: 0.4, gap: 0.2 });
      },
      body: function (P) {
        var B = P.B, M = torso(48, 8, 24, 8, 27);
        shadeFill(B, M, COAT, TAG.CLOTH, { cx: 16, cy: 46, rx: 30, ry: 24, edge: 0.35 });
        // cravat
        var cr = M64().poly([[27, 46], [37, 46], [35, 52], [32, 56], [29, 52]]);
        shadeFill(B, cr, CRAV, TAG.CLOTH, { cx: 29, cy: 46, rx: 8, ry: 8 });
        B.hline(28, 36, 46, H('#d8d0e0'), TAG.CLOTH); B.set(31, 49, CRAV[0], TAG.CLOTH); B.set(32, 50, CRAV[0], TAG.CLOTH);
        // high turned-up collar
        var col = M64().poly([[27, 53], [17, 52], [12, 46], [13, 36], [17, 37], [22, 43], [27, 47]]).sym();
        shadeFill(B, col, COAT, TAG.CLOTH, { cx: 14, cy: 36, rx: 22, ry: 20, edge: 0.5, bias: 0.25 });
        var inner = M64().poly([[14, 37], [17, 38], [22, 44], [26, 50], [20, 49], [15, 44]]).sym();
        shadeFill(B, inner, LIN, TAG.CLOTH, { cx: 16, cy: 38, rx: 14, ry: 14 });
        edgePx(col, [[0, -1], [-1, 0]]).forEach(function (p) { if (!inner.has(p[0], p[1])) B.set(p[0], p[1], p[0] < 32 ? COAT[3] : COAT[2], TAG.CLOTH); });
        // raven pin (silver bird, beak to the left)
        stamp(B, ['.ss.....', 'sSSs....', 'kSoSs...', '..SSSs..', '..sSSSs.', '...sSSSs', '....s..s'], 15, 53, { s: SILVER[1], S: SILVER[2], o: COAT[0], k: GOLD[1] }, TAG.METAL);
        B.set(17, 54, WHITE, TAG.METAL);
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin;
        B.set(36, 35, S2.s, TAG.SKIN); B.set(37, 36, S2.s, TAG.SKIN);
        if (P.e === 'happy') { B.set(40, 37, S2.blush, TAG.SKIN); B.set(41, 37, S2.blush, TAG.SKIN); }
        // silver earring on the visible ear
        ring(B, 45.5, 38.5, 1.6, 1.9, SILVER); B.set(44, 36, SILVER[3], TAG.METAL);
      },
      front: function (P) {
        var B = P.B;
        var hl = function (x) { var dx = x + 0.5 - 32; return 18 + 0.03 * dx * dx; };
        var cap = M64().ellipse(32, 24, 15.5, 13.2).keep(function (x, y) { return y + 0.5 < hl(x) || (x > 42 && y < 34); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        // the long fringe sweeping over the left eye
        cap.poly([[42, 14], [44, 20], [38, 22], [33, 24], [31, 28], [30, 34], [29, 38], [26, 41], [24, 37], [21, 40], [19, 36], [17, 33], [18, 22], [26, 14]]);
        hairClumps(B, cap, R, { px: 44, py: 6, aw: 0.11, ph: 0.4, cx: 24, cy: 16, rx: 22, ry: 22, k: 0.5, gap: 0.16, shine: [32, 24, 10, 12.5], shineTest: function (x, y) { return x < 33 && y < 22; } });
        innerLine(B, cap, R[0], function (t) { return t === TAG.SKIN || t === TAG.EYE; });
      }
    };
  })();

  // ---- 9. Captain Lune Marrow: navy captain's hat with crescent badge, eyepatch, cheek scar, silver-blue hair, teal coat
  NPC.lune = (function () {
    var S = SKIN.brown, R = HS(['#3a4468', '#6a7aa8', '#9fb0d8', '#c8d4f0', '#eef2ff']);
    var HAT = HS(['#0e1430', '#18224c', '#24346c', '#34488c']), VIS = HS(['#0b0711', '#1b1429', '#3a3a58', '#8a8aa8']);
    var COAT = HS(['#0c3036', '#12484e', '#1c6668', '#2c8884']), SCARF = HS(['#7a2420', '#b43a30', '#d85a40']);
    var PATCH = HS(['#0b0711', '#1b1429', '#362a52']);
    return {
      skin: S, face: FACES.square, eyeStyle: 'sharp', eyeC: EYEC.ice, hideEyeR: true,
      brows: { pts: [[0, -3], [3, -4], [6, -3]], col: R[1], col2: R[0], thick: 2, noR: true, asymL: { neutral: -1 } },
      mouths: { neutral: 'lGrin', happy: 'lLaugh', sad: 'frown', surprised: 'o', angry: 'grit' },
      mouthLib: {
        lGrin: ['.........D', 'DDDDDDDDD.', '.DtttttD..', '..DDDDD...'],
        lGrinTalk: ['.........D', 'DDDDDDDDD.', '.DtttttD..', '.DmmmmmD..', '..DDDDD...'],
        lLaugh: ['DDDDDDDDDD', 'DttttttttD', 'DmmmmmmmmD', '.DmmuummD.', '..DDDDDD..'],
        lLaughTalk: ['DDDDDDDDDD', 'DttttttttD', 'DmmmmmmmmD', 'DmmmuummmD', '.DmmuummD.', '..DDDDDD..']
      },
      mouthDX: 1,
      back: function (P) {
        var B = P.B, M = M64().poly([[18, 20], [16, 30], [18, 38], [22, 34], [22, 24]]).sym();
        hairClumps(B, M, R, { px: 32, py: 14, aw: 0.16, ph: 0.3, cx: 20, cy: 22, rx: 30, ry: 30, k: 0.4, gap: 0.2 });
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 26, 8, 29);
        shadeFill(B, M, COAT, TAG.CLOTH, { cx: 16, cy: 46, rx: 32, ry: 24, edge: 0.35 });
        // lapels
        var lap = M64().poly([[26, 47], [31, 58], [28, 63], [20, 54], [21, 48]]).sym().and(M);
        shadeFill(B, lap, COAT, TAG.CLOTH, { cx: 20, cy: 44, rx: 22, ry: 18, bias: 0.3, edge: 0.4 });
        edgePx(lap, [[0, 1], [1, 0], [-1, 0]]).forEach(function (p) { if (M.has(p[0], p[1] + 1)) B.set(p[0], p[1], COAT[0], TAG.CLOTH); });
        // red neckerchief
        var sc = M64().poly([[27, 46], [37, 46], [36, 50], [33, 52], [34, 56], [31, 57], [30, 52], [27, 50]]);
        shadeFill(B, sc, SCARF, TAG.CLOTH, { cx: 29, cy: 46, rx: 8, ry: 8 });
        B.set(31, 50, SCARF[0], TAG.CLOTH); B.set(32, 51, SCARF[0], TAG.CLOTH);
        // gold epaulettes + brass buttons
        [[6, 53], [47, 53]].forEach(function (p) { stamp(B, ['.GGGGGGGGG.', 'GgggggggggG', 'f.f.f.f.f.f', 'f.f.f.f.f.f'], p[0], p[1], { G: GOLD[2], g: GOLD[1], f: GOLD[0] }, TAG.METAL); });
        [[24, 58], [39, 58], [24, 62], [39, 62]].forEach(function (p) { B.set(p[0], p[1], GOLD[2], TAG.METAL); B.set(p[0] + 1, p[1], GOLD[1], TAG.METAL); });
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin;
        // scar across the left cheek
        bez([[21, 33], [24, 37], [28, 41]]).forEach(function (p) { B.set(p[0], p[1], mix(S2.l, H('#e8b0a0'), 0.4), TAG.SKIN); B.set(p[0], p[1] + 1, S2.d, TAG.SKIN); });
        [[22, 36], [26, 38]].forEach(function (p) { B.set(p[0], p[1], mix(S2.l, H('#e8b0a0'), 0.4), TAG.SKIN); });
        // laugh lines
        sym(B, [[25, 39], [25, 40]], S2.s, TAG.SKIN);
        // eyepatch with strap
        var pm = M64().poly([[34, 29], [43, 29], [43, 34], [40, 37], [36, 36], [34, 33]]);
        shadeFill(B, pm, PATCH, TAG.ACC, { cx: 36, cy: 29, rx: 8, ry: 8 });
        bez([[35, 29], [30, 25], [24, 19]]).forEach(function (p) { B.set(p[0], p[1], PATCH[1], TAG.ACC); });
        bez([[43, 31], [46, 30]]).forEach(function (p) { B.set(p[0], p[1], PATCH[1], TAG.ACC); });
        B.set(36, 30, PATCH[2], TAG.ACC); B.set(37, 30, PATCH[2], TAG.ACC);
      },
      front: function (P) {
        var B = P.B;
        // short hair at the temples
        var side = M64().poly([[17, 19], [22, 19], [23, 23], [21, 25], [21, 28], [19, 26], [19, 31], [17, 27], [16, 24]]).sym();
        hairClumps(B, side, R, { px: 32, py: 6, aw: 0.07, ph: 0.3, cx: 20, cy: 20, rx: 30, ry: 30, k: 0.6, gap: 0.25 });
        innerLine(B, side, R[0], function (t) { return t === TAG.SKIN; });
        // cap crown, band, visor, badge
        var crown = M64().ellipse(32, 11, 18, 7.5).or(M64().rect(16, 11, 32, 6));
        shadeFill(B, crown, HAT, TAG.HAT, { cx: 22, cy: 5, rx: 22, ry: 12, edge: 0.4, th: [-0.3, 0.12, 0.6] });
        var band = M64().rect(16, 15, 32, 4);
        shadeFill(B, band, [HAT[0], HAT[1], HAT[2]], TAG.HAT, { cx: 20, cy: 12, rx: 30, ry: 8, th: [-0.1, 0.5] });
        B.hline(16, 47, 15, GOLD[1], TAG.HAT); for (var x = 16; x <= 47; x += 2) B.set(x, 15, GOLD[2], TAG.HAT);
        var vis = M64().poly([[15, 19], [49, 19], [46, 22], [40, 23.5], [32, 24], [24, 23.5], [18, 22]]);
        shadeFill(B, vis, VIS, TAG.HAT, { cx: 26, cy: 18, rx: 18, ry: 5, th: [-0.2, 0.35, 0.8] });
        B.hline(20, 30, 20, VIS[3], TAG.HAT);
        innerLine(B, crown, HAT[0], function (t) { return t === TAG.HAT && false; });
        stamp(B, ['..ggg.', '.gg...', 'gg....', 'gg....', '.gg...', '..ggg.'], 29, 7, { g: GOLD[2] }, TAG.HAT);
        stamp(B, ['..GGG.', '.G....', 'G.....', 'G.....', '.G....', '..GGG.'], 30, 8, { G: GOLD[0] }, TAG.HAT);
        B.set(30, 9, GOLD[3], TAG.HAT);
      }
    };
  })();

  // ================================================================ expansion villagers (DESIGN2 §2)
  FACES.showman = { top: 13, hw: rowsOf([[9], [11], [12, 2], [13, 21], [12, 2], [11], [10], [9], [7], [5]]), jaw: 37, eyeX: 22, eyeY: 30, noseY: 35, mouthY: 40, earY: 29 };
  EYES.star = { // bright, open, confident (Elvis)
    open: ['.KKKKKK', 'KKwwwwK', 'KWWWWWk', '.WWWWW.', '..kkk..'],
    wide: ['.KKKKKK', 'KwwwwwK', 'KWWWWWk', '.WWWWW.', '.WWWWW.', '..kkk..'], wideDY: -1,
    happy: ['.......', '..KKK..', '.K...K.', 'K.....K', '.k...k.'],
    closed: ['.......', '.......', '.......', 'KKKKKK.', '.kkkk..'],
    iris: 3, hl2: true
  };
  EYES.lidded = { // heavy-lidded critic (Isolde)
    open: ['..kkkk.', '.KKKKKK', 'KKKwwwK', '.KWWWWK', '..kkkk.'],
    wide: ['..kkkk.', '.KKKKKK', 'KKwwwwK', 'KWWWWWK', '.WWWWW.', '..kkk..'], wideDY: -1,
    happy: ['.......', '..kkkk.', '.......', '.KKKKK.', 'K.....K'],
    closed: ['.......', '..kkkk.', '.......', 'KKKKKK.', '.kkkk..'],
    iris: 3
  };
  EYES.soft = { // calm, slightly lowered lids, long lashes (Seraphine)
    open: ['..KKKK.', '.KKKKKK', 'KKwwwwK', '.WWWWW.', '..kkk..'],
    wide: ['..KKKK.', '.KwwwwK', 'KWWWWWK', '.WWWWW.', '.WWWWW.', '..kkk..'], wideDY: -1,
    happy: ['.......', '.......', '..KKK..', '.K...K.', 'K.....K'],
    closed: ['.......', '.......', '.......', 'KKKKKK.', '.kkkk..'],
    iris: 3, hl2: true
  };

  // ---- 10. Elvis Marrowgold: crimson quiff with a white streak + silver temples, ice-blue eyes, red stubble, waistcoat, bow tie, star earring
  NPC.elvis = (function () {
    var S = SKIN.fair, R = HS(['#3a0a16', '#6e1228', '#a8203c', '#d6485a', '#f4848c']);
    var WH = HS(['#6e6a86', '#bab6cc', '#dedcea', '#f2f0f8', '#ffffff']), SIL = HS(['#4e4a68', '#8e8aa8', '#b8b4cc', '#dad6ea', '#f4f2fb']);
    var VEST = HS(['#120c1c', '#1e1a2c', '#2e2842', '#443a5e']), SHIRT = HS(['#8a86a0', '#c4c0d4', '#eceaf4', '#ffffff']);
    var ICE = HS(['#163e86', '#2ea4f6', '#aeeeff', '#081430']);
    function tone(c, from, to) { var i = from.indexOf(c); return i >= 0 ? to[i] : c; }
    return {
      skin: S, face: FACES.showman, eyeStyle: 'star', eyeC: ICE,
      brows: { pts: [[0, -3], [3, -4], [6, -4]], col: R[2], col2: R[1], thick: 2, asymR: { neutral: -1, happy: -1, angry: 1 } },
      mouths: { neutral: 'vShow', happy: 'vLaugh', sad: 'frown', surprised: 'o', angry: 'vSneer' },
      mouthLib: {
        vShow: ['D........D', '.DttttttD.', '..DDDDDD..'],
        vShowTalk: ['D........D', '.DttttttD.', '.DmmuummD.', '..DDDDDD..'],
        vLaugh: ['DDDDDDDDDD', 'DttttttttD', 'DmmmmmmmmD', '.DmmuummD.', '..DDDDDD..'],
        vLaughTalk: ['DDDDDDDDDD', 'DttttttttD', 'DmmmmmmmmD', 'DmmmuummmD', '.DmmuummD.', '..DDDDDD..'],
        vSneer: ['.DDDDDDDD', 'DtTttTtD.', '.DDDDDDD.'],
        vSneerTalk: ['.DDDDDDDD', 'DtTttTtD.', 'DmmmmmmD.', '.DDDDDD..']
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin, f = P.f, top = f.top;
        // neat short red stubble: jaw, chin and upper lip
        P.faceM.each(function (x, y) {
          var dx = Math.abs(x + 0.5 - 32), hw = f.hw[y - top], edge = hw - dx;
          var jaw = (y >= 41 && edge <= 5) || (y >= 43) || (y === 39 && dx >= 2 && dx <= 5) || (dx > 9.5 && y >= 36 && edge <= 2.5);
          if (!jaw || (ti(x) + tj(y)) % 2) return;
          var c = B.get(x, y);
          if (c === S2.b || c === S2.l) B.set(x, y, mix(S2.b, R[1], 0.22), TAG.SKIN); else if (c === S2.s) B.set(x, y, mix(S2.s, R[0], 0.22), TAG.SKIN);
        });
        // laugh lines + a showman's dimple
        sym(B, [[26, 38], [26, 39]], S2.s, TAG.SKIN);
        // tiny silver star earring (left ear)
        [[17, 37, 2], [16, 38, 2], [17, 38, 3], [18, 38, 2], [17, 39, 1]].forEach(function (p) { B.set(p[0], p[1], SILVER[p[2]], TAG.METAL); });
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 8, 28);
        shadeFill(B, M, SHIRT, TAG.CLOTH, { cx: 16, cy: 44, rx: 32, ry: 24, edge: 0.3, th: [-0.5, -0.05, 0.55] });
        // rolled-sleeve folds on the white shirt
        [[9, 57], [10, 58], [53, 57], [54, 58], [12, 60], [51, 60]].forEach(function (p) { B.set(p[0], p[1], SHIRT[0], TAG.CLOTH); });
        // dark waistcoat with a V opening
        var vest = M.clone().keep(function (x, y) { var dx = Math.abs(x + 0.5 - 32); return y >= 48 && dx <= 14 + (y - 48) * 0.35; }).sub(M64().poly([[25.5, 46], [38.5, 46], [32, 60]]));
        shadeFill(B, vest, VEST, TAG.CLOTH, { cx: 18, cy: 44, rx: 26, ry: 22, edge: 0.4 });
        edgePx(vest, [[0, -1]]).forEach(function (p) { B.set(p[0], p[1], VEST[3], TAG.CLOTH); });
        bez([[26, 48], [32, 60]]).forEach(function (p) { B.set(p[0], p[1], VEST[3], TAG.CLOTH); });
        bez([[38, 48], [32, 60]]).forEach(function (p) { B.set(p[0], p[1], VEST[2], TAG.CLOTH); });
        B.hline(18, 22, 57, VEST[0], TAG.CLOTH); B.hline(42, 46, 57, VEST[0], TAG.CLOTH); // pocket welts
        // brass buttons
        [[31, 61], [31, 63]].forEach(function (p) { B.set(p[0], p[1], GOLD[2], TAG.METAL); B.set(p[0] + 1, p[1], GOLD[1], TAG.METAL); });
        // shirt collar points + black bow tie
        stamp(B, ['WW.......WW', '.WW.....WW.', '..W.....W..'], 27, 45, { W: SHIRT[2] }, TAG.CLOTH);
        stamp(B, ['BBB...BBB', 'BhBBKBBhB', 'BBBBKBBBB', 'BB.....BB'], 28, 47, { B: H('#1b1429'), h: H('#46395c'), K: OUT }, TAG.ACC);
      },
      front: function (P) {
        var B = P.B;
        var hl = function (x) { var dx = x + 0.5 - 32; return 19.5 + 0.035 * dx * dx; };
        var cap = M64().ellipse(32, 24.5, 15.5, 13).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        // the quiff: a tall swept-back wave with a forward curl on the left
        var q = M64().ellipse(29.5, 11.5, 13.5, 8.2).or(M64().ellipse(38, 13, 8.5, 6.5)).or(M64().ellipse(19, 13.5, 3.6, 4.6)).keep(function (x, y) { return y < 21; });
        cap.or(q);
        hairClumps(B, cap, R, { px: 47, py: 36, aw: 0.24, ph: 0.15, cx: 24, cy: 5, rx: 22, ry: 15, k: 0.45, gap: 0.13, bias: function (x, y) { return y > 15 && y < 22 && Math.abs(x + 0.5 - 30) < 12 ? -0.3 : 0; }, shine: [29, 15, 7.5, 9.5], shineTest: function (x, y) { return x < 33 && y < 12; } });
        innerLine(B, cap, R[0], function (t) { return t === TAG.SKIN; });
        strands(B, cap, [[[17, 17], [20, 13], [26, 11]], [[23, 7], [30, 5], [37, 7]]], R[1]); // the curl and the crest of the wave
        // the bold white streak sweeping up through the quiff
        var st = M64().thick(bez([[36, 21], [34, 15], [30, 8], [25, 5]]), 1.2);
        st.and(cap).each(function (x, y) { B.set(x, y, tone(B.get(x, y), R, WH), TAG.HAIR); });
        // silvering temples
        cap.each(function (x, y) { var dx = Math.abs(x + 0.5 - 32); if ((y >= 21 && dx >= 12) || (y >= 24 && dx >= 10.5) || (y >= 19 && dx >= 13.5 && (ti(x) + tj(y)) % 2 === 0)) B.set(x, y, tone(B.get(x, y), R, SIL), TAG.HAIR); });
        // short silver sideburns
        [[20, 28], [20, 29], [20, 30], [43, 28], [43, 29], [43, 30]].forEach(function (p) { B.set(p[0], p[1], SIL[1], TAG.HAIR); });
        // a loose rockabilly curl falling onto the forehead
        [[27, 20, 2], [28, 20, 1], [27, 21, 1], [26, 22, 2], [26, 23, 1], [27, 24, 1], [28, 23, 0], [25, 22, 0], [27, 22, 0]].forEach(function (p) { B.set(p[0], p[1], R[p[2] + 1], TAG.HAIR); });
      }
    };
  })();

  // ---- 11. Isolde Quillon: silver-lavender bob, cat-eye glasses on a beaded chain, plum lips, high aubergine collar, moth brooch, tape measure
  NPC.isolde = (function () {
    var S = skinR('#c9a9b8', '#ecd3d9', '#fbeef0', { lip: '#86285e' }), R = HS(['#4a3e6a', '#8e82b8', '#b8acd8', '#dcd2f0', '#f6f2ff']);
    var COAT = HS(['#22091f', '#3e1438', '#5c2254', '#7c3672']), LIN = HS(['#1b1429', '#2e1f45', '#45306a']);
    var FR = HS(['#1b1022', '#3a2448', '#6a4a7a']), TAPE = HS(['#9a7a1e', '#e8c84a', '#fff0a0']);
    return {
      skin: S, face: FACES.narrow, eyeStyle: 'lidded', eyeC: EYEC.green,
      brows: { pts: [[0, -4], [3, -5], [6, -4]], col: R[0], thick: 1, asymR: { neutral: -2, happy: -1, angry: 1 } },
      mouths: { neutral: 'iArch', happy: 'iSmile', sad: 'iSad', surprised: 'iO', angry: 'iTight' },
      mouthLib: {
        iArch: ['..PP.PP.D', '.PPPPPPD.', '..ppLpp..'],
        iArchTalk: ['..PP.PP.D', '.PPPPPPD.', '.DmmmmD..', '..ppLpp..'],
        iSmile: ['.PPPPPP.', 'DttttttD', '.DmmmmD.', '..pLpp..'],
        iSmileTalk: ['.PPPPPP.', 'DttttttD', 'DmmuummD', '.DpLppD.'],
        iSad: ['..PPPP..', '.D....D.', 'D.pLpp.D'],
        iSadTalk: ['..PPPP..', '.DmmmmD.', '..pLpp..'],
        iO: ['..PP..', '.DmmD.', '.DmmD.', '..pp..'], iOTalk: ['..PP..', '.DmmD.', 'PDmmDP', '.DmmD.', '..pp..'],
        iTight: ['.PPPPPP.', 'DDDDDDDD', '.pppLpp.'], iTightTalk: ['.PPPPPP.', 'DtTttTtD', '.pppLpp.']
      },
      skinDetail: function (P) { // smile lines and a hint of rouge
        var B = P.B, S2 = P.skin;
        sym(B, [[25, 38], [25, 39], [21, 31], [24, 36]], S2.s, TAG.SKIN);
        sym(B, [[23, 37], [24, 37]], S2.blush, TAG.SKIN);
      },
      back: function (P) {
        var B = P.B, M = M64().poly([[17, 26], [15, 40], [17, 43], [22, 46], [23, 30]]).sym();
        hairClumps(B, M, R, { px: 32, py: 6, aw: 0.07, ph: 0.3, cx: 20, cy: 22, rx: 30, ry: 30, k: 0.4, gap: 0.2 });
      },
      body: function (P) {
        var B = P.B, M = torso(48, 8, 24, 8, 27);
        shadeFill(B, M, COAT, TAG.CLOTH, { cx: 16, cy: 46, rx: 30, ry: 24, edge: 0.35 });
        // aubergine blouse at the throat
        shadeFill(B, M64().poly([[27, 46], [37, 46], [34, 52], [30, 52]]), LIN, TAG.CLOTH, { cx: 29, cy: 46, rx: 8, ry: 8 });
        // tall stand collar
        var col = M64().poly([[27, 53], [18, 51], [14, 45], [15, 37], [19, 38], [23, 44], [27, 47]]).sym();
        shadeFill(B, col, COAT, TAG.CLOTH, { cx: 14, cy: 36, rx: 22, ry: 20, edge: 0.5, bias: 0.3 });
        var inner = M64().poly([[16, 38], [19, 39], [23, 45], [26, 50], [21, 49], [17, 45]]).sym();
        shadeFill(B, inner, LIN, TAG.CLOTH, { cx: 16, cy: 38, rx: 14, ry: 14 });
        edgePx(col, [[0, -1], [-1, 0]]).forEach(function (p) { if (!inner.has(p[0], p[1])) B.set(p[0], p[1], p[0] < 32 ? COAT[3] : COAT[2], TAG.CLOTH); });
        // tape measure hanging around the neck
        [[[28, 47], [27, 55], [26, 63]], [[36, 47], [37, 53], [38, 60]]].forEach(function (cp, k) {
          bez(cp).forEach(function (p, i) { B.set(p[0], p[1], TAPE[1], TAG.ACC); B.set(p[0] + 1, p[1], i % 2 ? TAPE[0] : TAPE[2], TAG.ACC); });
        });
        stamp(B, ['ss', 'SS'], 38, 61, { s: SILVER[2], S: SILVER[1] }, TAG.METAL);
        // moth brooch on the collar
        stamp(B, ['WW...WW', 'WoWbWoW', '.WWbWW.', '.wWbWw.', '..w.w..'], 15, 51, { W: H('#e8d8a0'), w: H('#b89a64'), o: H('#5a3a2a'), b: H('#3e2d2b') }, TAG.METAL);
      },
      front: function (P) {
        var B = P.B;
        // the sharp bob: rounded crown, blunt fringe, A-line sides longer towards the face
        var bob = M64().ellipse(32, 25, 16.5, 14.5).or(M64().poly([[15.5, 25], [22.5, 25], [22.5, 45.5], [16, 41.5]]).sym());
        bob.sub(M64().poly([[22.5, 25.5 + 0.0], [41.5, 25.5], [41.5, 64], [22.5, 64]]).keep(function (x, y) { var dx = x + 0.5 - 32; return y + 0.5 > 25 + 0.012 * dx * dx; }));
        bob.or(faceTop(P, function () { return 25; }));
        hairClumps(B, bob, R, { px: 32, py: 6, aw: 0.075, ph: 0.4, cx: 24, cy: 14, rx: 20, ry: 20, k: 0.45, gap: 0.12, shine: [32, 25, 10.5, 12.5], shineTest: function (x, y) { return x < 31 && y < 24; } });
        innerLine(B, bob, R[0], function (t) { return t === TAG.SKIN || t === TAG.EYE || t === TAG.BROW; });
        // cat-eye spectacles (wing tips flare up and out) + beaded chain
        var ex = P.f.eyeX, ey = P.f.eyeY;
        [false, true].forEach(function (flip) {
          var X = function (x) { return flip ? 63 - x : x; };
          var path = [[18, 25], [21, 28], [25, 29], [29, 29], [30, 31], [29, 34], [25, 35], [22, 34], [21, 31], [21, 29]];
          for (var i = 0; i + 1 < path.length; i++) bez([path[i], path[i + 1]]).forEach(function (p) { B.set(X(p[0]), p[1], p[1] <= 29 ? FR[0] : FR[1], TAG.METAL); });
          bez([[19, 25], [22, 27], [28, 28]]).forEach(function (p) { B.set(X(p[0]), p[1], FR[0], TAG.METAL); });
          B.set(X(20), 26, FR[2], TAG.METAL); B.set(X(18), 25, GOLD[2], TAG.METAL); B.set(X(17), 24, GOLD[3], TAG.METAL);
          B.set(X(27), 30, H('#f4f2fb'), TAG.GLASS);
        });
        B.hline(30, 33, 30, FR[1], TAG.METAL);
        bez([[19, 27], [16, 35], [18, 43], [23, 48]]).forEach(function (p, i) { B.set(p[0], p[1], i % 2 ? H('#f2ecf6') : H('#7a3a6a'), TAG.ACC); });
        bez([[44, 27], [47, 35], [45, 43], [41, 48]]).forEach(function (p, i) { B.set(p[0], p[1], i % 2 ? H('#e2dcea') : H('#6a2e5e'), TAG.ACC); });
      }
    };
  })();

  // ---- 12. Seraphine Vell: short silver-violet hair, rainbow glass-glitter freckles, soft grey eyes, loupe on a chain, leather apron over a white robe
  NPC.seraphine = (function () {
    var S = SKIN.tan, R = HS(['#2e2650', '#6a5aa0', '#9886cc', '#c4b6ec', '#eee8ff']);
    var ROBE = HS(['#8a86a2', '#c4c0d6', '#e8e6f2', '#ffffff']), APR = HS(['#3e2d2b', '#574039', '#7a5a48', '#9c7a5e']);
    var GREY = HS(['#3e4258', '#7e86a2', '#c6ccdc', '#1c1e2c']);
    var GLIT = HS(['#ff7aa8', '#ffc870', '#fff3a0', '#8affc4', '#7ad8ff', '#c4a0ff']);
    return {
      skin: S, face: FACES.oval, eyeStyle: 'soft', eyeC: GREY,
      brows: { pts: [[0, -3], [3, -4], [7, -3]], col: R[1], thick: 1, mod: { neutral: function () { return 0; } } },
      mouths: { neutral: 'small', happy: 'sJoy', sad: 'frown', surprised: 'o', angry: 'flat' },
      mouthLib: { sJoy: ['D......D', '.DttttD.', '..DDDD..'], sJoyTalk: ['D......D', '.DttttD.', '.DmuumD.', '..DDDD..'] },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin, fr = mix(S2.b, S2.s, 0.75);
        sym(B, [[23, 36], [25, 36], [24, 37], [26, 38], [22, 38], [29, 35], [28, 36]], fr, TAG.SKIN);
        // rainbow glass glitter catching the light
        [[24, 35, 0], [27, 37, 1], [22, 36, 4], [29, 34, 3], [39, 36, 5], [36, 37, 2], [41, 38, 0], [34, 35, 4]].forEach(function (p) { B.set(p[0], p[1], GLIT[p[2]], TAG.GLASS); });
        [[25, 38], [40, 35]].forEach(function (c) { B.set(c[0], c[1], WHITE, TAG.GLASS); B.set(c[0] - 1, c[1], H('#e4f6ff'), TAG.GLASS); B.set(c[0] + 1, c[1], H('#e4f6ff'), TAG.GLASS); B.set(c[0], c[1] - 1, H('#e4f6ff'), TAG.GLASS); B.set(c[0], c[1] + 1, H('#e4f6ff'), TAG.GLASS); });
        if (P.e === 'happy') sym(B, [[22, 39], [23, 39]], S2.blush, TAG.SKIN);
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 8, 28);
        shadeFill(B, M, ROBE, TAG.CLOTH, { cx: 16, cy: 44, rx: 32, ry: 24, edge: 0.3, th: [-0.5, -0.05, 0.55] });
        [[14, 55], [15, 58], [49, 56], [48, 59]].forEach(function (p) { B.line(p[0], p[1], p[0] + (p[0] < 32 ? -2 : 2), p[1] + 5, ROBE[0], TAG.CLOTH); });
        // soft round collar of the robe
        stamp(B, ['.cccccccccc.', 'cCcccccccccC'], 26, 46, { c: ROBE[2], C: ROBE[1] }, TAG.CLOTH);
        // leather apron bib + neck straps
        var apr = M64().poly([[23, 53], [41, 53], [42, 64], [22, 64]]);
        shadeFill(B, apr, APR, TAG.CLOTH, { cx: 26, cy: 50, rx: 20, ry: 16, edge: 0.4 });
        B.hline(24, 40, 54, APR[3], TAG.CLOTH);
        bez([[24, 53], [26, 49], [27, 46]]).forEach(function (p) { B.set(p[0], p[1], APR[1], TAG.CLOTH); B.set(p[0] + 1, p[1], APR[2], TAG.CLOTH); });
        bez([[40, 53], [38, 49], [37, 46]]).forEach(function (p) { B.set(p[0], p[1], APR[1], TAG.CLOTH); B.set(p[0] - 1, p[1], APR[0], TAG.CLOTH); });
        // pocket with shards of stained glass
        B.hline(34, 40, 59, APR[0], TAG.CLOTH);
        [[35, 58, '#c4304a'], [36, 57, '#2e6ad0'], [37, 58, '#3ab070'], [38, 57, '#f2c45a'], [39, 58, '#9a5ad0']].forEach(function (p) { B.set(p[0], p[1], H(p[2]), TAG.GLASS); });
        // jeweller's loupe on a fine chain
        bez([[28, 47], [29, 52], [31, 56]]).forEach(function (p, i) { if (i % 2 === 0) B.set(p[0], p[1], GOLD[2], TAG.METAL); });
        bez([[36, 47], [34, 52], [32, 56]]).forEach(function (p, i) { if (i % 2 === 0) B.set(p[0], p[1], GOLD[1], TAG.METAL); });
        ring(B, 31.5, 59, 3, 3, GOLD);
        stamp(B, ['gL', 'LL'], 30, 58, { g: WHITE, L: H('#a8d8f0') }, TAG.GLASS);
      },
      front: function (P) {
        var B = P.B;
        var hl = function (x) { var dx = x + 0.5 - 32; return 19 + 0.04 * dx * dx; };
        var cap = M64().ellipse(32, 24, 15.5, 13).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        cap.poly([[41, 13], [44, 18], [40, 19], [35, 21], [29, 23], [24, 25], [21, 28], [21, 22], [26, 17], [33, 14]]);
        [[[18, 24], [17, 30], [20, 26]], [[46, 24], [47, 30], [44, 26]], [[20, 23], [19, 29], [22, 25]]].forEach(function (t) { cap.poly(t); });
        hairClumps(B, cap, R, { px: 41, py: 10, aw: 0.19, ph: 0.4, cx: 24, cy: 13, rx: 20, ry: 18, k: 0.6, gap: 0.17, shine: [32, 24, 10, 12], shineTest: function (x) { return x < 32; } });
        innerLine(B, cap, R[0], function (t) { return t === TAG.SKIN; });
      }
    };
  })();

  // ---- 13. Tobias Fennick: patched feathered hat full of pins, monocle, bushy brown beard, long striped scarf, pack straps
  NPC.fennick = (function () {
    var S = skinR('#c98e74', '#ebb79a', '#f8d6c0', { blush: '#e8887a' }), BR = HAIR.brown;
    var HAT = HS(['#2a2418', '#4a4030', '#6a5a40', '#8a7a58']), COAT = HS(['#2a1a12', '#3e2a20', '#5a4030', '#7a5a40']);
    var SC1 = HS(['#9a7218', '#e0b040', '#f6d478']), SC2 = HS(['#0c3036', '#1c6668', '#2c8884']), STRAP = HS(['#1b1429', '#281d21', '#3e2d2b']);
    var FEA = HS(['#3e2a20', '#a8501e', '#d87a30', '#f2c890']);
    return {
      skin: S, face: FACES.round, eyeStyle: 'std', eyeC: EYEC.hazel, castRows: 2,
      brows: { pts: [[-1, -3], [3, -5], [7, -4]], col: BR[2], col2: BR[1], thick: 2, taper: 0.1, mod: { neutral: function () { return -1; } } },
      mouths: { neutral: 'fGrin', happy: 'fLaugh', sad: 'fSad', surprised: 'fO', angry: 'fGrit' },
      mouthLib: {
        fGrin: ['bbbbbbbb', 'bttttttb', '.bmmmmb.', '..bbbb..'], fGrinTalk: ['bbbbbbbb', 'bttttttb', 'bmmuummb', '.bbbbbb.'],
        fLaugh: ['bbbbbbbbbb', 'bttttttttb', 'bmmmmmmmmb', '.bmmuummb.', '..bbbbbb..'],
        fSad: ['..bbbb..', '.b....b.'], fSadTalk: ['..bbbb..', '.bmmmmb.', '.bbbbbb.'],
        fO: ['.bbbb.', 'bmmmmb', 'bmmmmb', '.bbbb.'], fOTalk: ['.bbbb.', 'bmmmmb', 'bmuumb', 'bmmmmb', '.bbbb.'],
        fGrit: ['bbbbbbbb', 'btTttTtb', 'bbbbbbbb']
      },
      mouthLine: BR[0], nose: false,
      body: function (P) {
        var B = P.B, M = torso(47, 9, 26, 8, 29);
        shadeFill(B, M, COAT, TAG.CLOTH, { cx: 16, cy: 46, rx: 32, ry: 24, edge: 0.35 });
        // backpack straps with brass buckles
        [[15, 49], [45, 49]].forEach(function (s) { for (var y = s[1]; y < 64; y++) { var x = s[0] + Math.round((y - s[1]) * (s[0] < 32 ? -0.15 : 0.15)); B.set(x, y, STRAP[2], TAG.ACC); B.set(x + 1, y, STRAP[1], TAG.ACC); B.set(x + 2, y, STRAP[0], TAG.ACC); } });
        stamp(B, ['ggg', 'g.g', 'ggg'], 13, 56, { g: GOLD[1] }, TAG.METAL); stamp(B, ['ggg', 'g.g', 'ggg'], 47, 56, { g: GOLD[1] }, TAG.METAL);
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin;
        // ruddy bulbous nose + rosy cheeks
        stamp(B, ['.lbb.', 'lbbbs', 'bbbss', 'dbssd', '.ddd.'], 30, 33, { l: S2.l, b: mix(S2.b, H('#e08070'), 0.25), s: mix(S2.s, H('#c05050'), 0.2), d: S2.d }, TAG.SKIN);
        sym(B, [[22, 37], [23, 37], [24, 37], [23, 38]], S2.blush, TAG.SKIN);
      },
      front: function (P) {
        var B = P.B;
        // bushy beard + moustache with the grin inside
        var top = function (x) { var dx = Math.abs(x + 0.5 - 32); return Math.max(30, 40 - Math.max(0, dx - 6) * 1.5); };
        var beard = M64().poly([[17, 29], [15, 38], [14, 47], [17, 55], [24, 60], [40, 60], [47, 55], [50, 47], [49, 38], [47, 29]]).keep(function (x, y) { return y >= top(x); });
        for (var i = 0; i < 12; i++) { var a = Math.PI * (0.15 + i * 0.065), x0 = 32 + Math.cos(a) * 17, y0 = 46 + Math.sin(a) * 13; beard.poly([[x0 - 2, y0 - 1], [x0 + Math.cos(a) * 3, y0 + Math.sin(a) * 3], [x0 + 2, y0 - 1]]); }
        hairClumps(B, beard, BR, { px: 32, py: 26, aw: 0.2, ph: 0.4, cx: 24, cy: 34, rx: 26, ry: 26, k: 0.6, gap: 0.18, tag: TAG.BEARD, wave: [0.7, 0.25], shine: [30, 32, 12, 14], shineTest: function (x) { return x < 30; } });
        innerLine(B, beard, BR[0], function (t) { return t === TAG.SKIN; }, [[0, -1], [1, 0], [-1, 0]]);
        drawMouth(P, 0);
        var mo = M64().poly([[32, 38], [26, 38], [21, 41], [19, 44], [23, 43], [27, 41], [31, 41], [32, 40]]).sym();
        hairClumps(B, mo, [BR[0], BR[2], BR[3], BR[4], BR[4]], { px: 32, py: 30, aw: 0.22, ph: 0.2, cx: 26, cy: 36, rx: 14, ry: 10, k: 0.3, gap: 0.15, tag: TAG.BEARD, th: [-0.3, 0.25] });
        innerLine(B, mo, BR[0], function (t) { return t !== TAG.SKIN; }, [[0, 1], [1, 0], [-1, 0]]);
        // long striped scarf: a wrap around the neck and one long end down the front
        var wrap = M64().ellipse(32, 49, 15, 4.2), end = M64().poly([[34, 49], [41, 49], [42, 64], [35, 64]]);
        [wrap, end].forEach(function (Mk, k) { Mk.each(function (x, y) { var band = (k ? Math.floor(y / 2) : Math.floor(x / 3)) % 2, rmp = band ? SC1 : SC2, v = sph(x, y, 26, 44, 18, 12); B.set(x, y, v > 0.35 ? rmp[2] : v > -0.3 ? rmp[1] : rmp[0], TAG.CLOTH); }); });
        innerLine(B, end, SC2[0], function (t, c) { return true; }, [[-1, 0]]);
        // monocle on the left eye, chain to the coat
        var ex = P.f.eyeX, ey = P.f.eyeY;
        ring(B, ex + 3.5, ey + 3, 4.8, 4.6, GOLD); B.set(ex + 1, ey + 1, H('#fff1c8'), TAG.GLASS);
        bez([[ex - 1, ey + 6], [ex - 5, ey + 14], [ex - 4, ey + 22]]).forEach(function (p, i) { if (i % 2 === 0) B.set(p[0], p[1], GOLD[2], TAG.METAL); });
        // the floppy hat: sagging brim, dented crown, patches, pins and a feather
        var brim = M64().fn(function (x, y) { var dx = x + 0.5 - 32, yc = 18.5 + 0.007 * dx * dx, w = 2.6 - Math.max(0, Math.abs(dx) - 19) * 0.45; return Math.abs(dx) <= 25 && Math.abs(y + 0.5 - yc) <= w; });
        shadeFill(B, brim, HAT, TAG.HAT, { cx: 18, cy: 13, rx: 34, ry: 9, edge: 0.55, th: [-0.25, 0.15, 0.55] });
        var crown = M64().ellipse(32, 11.5, 12.5, 8.5).keep(function (x, y) { return y < 18; });
        shadeFill(B, crown, HAT, TAG.HAT, { cx: 24, cy: 6, rx: 16, ry: 12, edge: 0.45, th: [-0.3, 0.12, 0.55] });
        bez([[27, 4], [31, 7], [36, 4]]).forEach(function (p) { B.set(p[0], p[1], HAT[0], TAG.HAT); });
        for (var x = 20; x <= 44; x++) if (crown.has(x, 15)) { B.set(x, 15, H('#574039'), TAG.HAT); B.set(x, 16, H('#3e2d2b'), TAG.HAT); }
        stamp(B, ['RRRR', 'RrRR', 'RRrR'], 23, 8, { R: H('#a8442e'), r: H('#7a2a1a') }, TAG.HAT);
        stamp(B, ['TTT', 'TtT', 'TTT'], 37, 10, { T: H('#2c8884'), t: H('#1c6668') }, TAG.HAT);
        stamp(B, ['MMMM', 'MmMM'], 46, 19, { M: H('#c8922e'), m: H('#8a5a1e') }, TAG.HAT);
        [[22, 7], [27, 7], [23, 11], [36, 9], [40, 12], [37, 13], [45, 18], [50, 19]].forEach(function (p) { B.set(p[0], p[1], H('#f4ead8'), TAG.HAT); });
        // pins and badges
        [[29, 12, '#c44a3a'], [33, 9, '#3a68b8'], [41, 15, '#4c9061'], [18, 19, '#c44a3a'], [26, 19, '#e4d2ff']].forEach(function (p) { B.set(p[0], p[1], H(p[2]), TAG.ACC); B.set(p[0] + 1, p[1], mix(H(p[2]), OUT, 0.4), TAG.ACC); B.set(p[0], p[1] - 1, mix(H(p[2]), WHITE, 0.5), TAG.ACC); });
        [[31, 4], [30, 5], [31, 5], [32, 5], [31, 6]].forEach(function (p) { B.set(p[0], p[1], GOLD[2], TAG.ACC); });
        B.set(31, 5, GOLD[3], TAG.ACC);
        // pheasant feather swept up from the band
        var sh = bez([[42, 15], [49, 8], [55, 0]]);
        sh.forEach(function (p, i) { var t = i / sh.length, w = Math.round(Math.sin(Math.PI * Math.pow(t, 0.8)) * 2.2); for (var k = -w; k <= w; k++) B.set(p[0] + k, p[1] + k * 0.4, (i + k) % 3 === 0 ? FEA[0] : (k < 0 ? FEA[2] : FEA[1]), TAG.ACC); });
        B.set(54, 1, FEA[3], TAG.ACC); B.set(55, 0, FEA[3], TAG.ACC);
        innerLine(B, brim, HAT[0], function (t) { return t === TAG.SKIN || t === TAG.HAIR || t === TAG.BROW || t === TAG.EYE; }, [[0, 1]]);
      }
    };
  })();

  // ================================================================ round 3 villagers (DESIGN3 §1)
  FACES.cute = { top: 12, hw: rowsOf([[8], [10], [11], [12, 21], [11, 2], [10, 2], [9], [8], [7], [5], [3]]), jaw: 35, eyeX: 21, eyeY: 31, noseY: 37, mouthY: 41, earY: 30 };
  EYES.cute = { // big sparkly eyes
    open: ['..KKKKK.', '.KKwwwwK', 'KWWWWWWK', '.WWWWWW.', '.WWWWWW.', '..kkkk..'],
    wide: ['..KKKKK.', '.KwwwwwK', 'KWWWWWWK', 'KWWWWWWK', '.WWWWWW.', '.WWWWWW.', '..kkkk..'], wideDY: -1,
    happy: ['........', '........', '..KKKK..', '.K....K.', 'K......K', '........'],
    closed: ['........', '........', '........', '........', 'KKKKKKK.', '.kkkkk..'],
    iris: 4, wideIris: 3, hl2: true
  };
  EYES.cutewing = { // the same with a flicked liner wing
    open: ['K.KKKKK.', 'KKKwwwwK', '.KWWWWWK', '.WWWWWW.', '.WWWWWW.', '..kkkk..'],
    wide: ['K.KKKKK.', 'KKwwwwwK', '.KWWWWWK', 'KWWWWWWK', '.WWWWWW.', '.WWWWWW.', '..kkkk..'], wideDY: -1,
    happy: ['........', 'K.......', 'KKKKKK..', '.K....K.', 'K......K', '........'],
    closed: ['........', '........', '........', 'K.......', 'KKKKKKK.', '.kkkkk..'],
    iris: 4, wideIris: 3, hl2: true
  };
  EYES.cutelid = { // unimpressed half-lid
    open: ['........', '.KKKKKK.', 'KKKKwwwK', '.WWWWWW.', '.WWWWWW.', '..kkkk..'],
    wide: ['..KKKKK.', '.KwwwwwK', 'KWWWWWWK', 'KWWWWWWK', '.WWWWWW.', '.WWWWWW.', '..kkkk..'], wideDY: -1,
    happy: ['........', '........', '..KKKK..', '.K....K.', 'K......K', '........'],
    closed: ['........', '........', '........', '........', 'KKKKKKK.', '.kkkkk..'],
    iris: 4, wideIris: 3, hl2: true
  };
  var CUTE_M = {
    cSmile: ['D....D', '.DDDD.'], cSmileTalk: ['.DDDD.', 'DmmmmD', '.DuuD.'],
    cShy: ['D...D', '.DDD.'], cShyTalk: ['.DDD.', 'DmmmD', '.DDD.'],
    cHappy: ['DDDDDD', 'DmmmmD', '.DuuD.'], cHappyTalk: ['DDDDDD', 'DmmmmD', 'DmuumD', '.DDDD.'],
    cBig: ['DDDDDDDD', 'DttttttD', '.DmuumD.', '..DDDD..'], cBigTalk: ['DDDDDDDD', 'DttttttD', 'DmmuummD', '.DmuumD.', '..DDDD..'],
    cSad: ['..DD..', '.D..D.', 'D....D'], cSadTalk: ['..DD..', '.DmmD.', 'D.DD.D'],
    cO: ['.DD.', 'DmmD', '.DD.'], cOTalk: ['.DD.', 'DmmD', 'DmmD', '.DD.'],
    cPout: ['.DDDD.', 'D....D'], cPoutTalk: ['.DDDD.', 'DmmmmD', '.DDDD.']
  };
  function cuteMouths(extra) { var o = {}, k; for (k in CUTE_M) o[k] = CUTE_M[k]; if (extra) for (k in extra) o[k] = extra[k]; return o; }
  function cuteCheeks(P, big) { // soft rosy blush; deeper when happy or flustered
    if (XF || (P.style && P.style.human)) { P.blushBig = big || P.e === 'happy' || P.e === 'surprised'; return; } // close-ups and human: the style's blush paints it under the redrawn eyes
    var S2 = P.skin, B = P.B, e = P.e, pts = [[22, 38], [23, 38], [24, 38], [23, 39]];
    if (big || e === 'happy' || e === 'surprised') pts = pts.concat([[21, 38], [25, 38], [22, 39], [24, 39]]);
    sym(B, pts, S2.blush, TAG.SKIN);
  }
  function tearDrops(P) {
    if (P.e !== 'sad' || P.blink) return;
    if (XF || (P.style && P.style.human)) { P.tears = true; return; } // close-ups and human: drawn with the redrawn eyes
    var B = P.B; [[22, 37], [22, 38], [21, 39]].forEach(function (p, i) { B.set(p[0], p[1], i % 2 ? H('#8cc4f0') : H('#c4e6ff'), TAG.EYE); B.set(63 - p[0], p[1], i % 2 ? H('#8cc4f0') : H('#c4e6ff'), TAG.EYE); }); }
  function recolorRamp(B, M, from, to, test) { M.each(function (x, y) { if (test && !test(x, y)) return; var i = from.indexOf(B.get(x, y)); if (i >= 0) B.set(x, y, to[i], TAG.HAIR); }); }
  function bowAt(B, x, y, R) { stamp(B, ['bB.Bb', 'bBkBb', 'b...b'], x, y, { b: R[0], B: R[1], k: R[2] }, TAG.ACC); }
  var NOSE_CUTE = ['l.', '.s'];

  // ---- 14. Laura Vex — A: black/violet split-dye wolf cut, winged liner, plum lips, septum ring, spiked choker, leather jacket
  NPC.laura_a = (function () {
    var S = SKIN.cool, BK = HAIR.black, VI = HS(['#1a0a2c', '#36185a', '#56288a', '#7a44b4', '#a676dc']);
    var JK = HS(['#0b0711', '#17121f', '#262033', '#3c3450']), TEE = HS(['#1b1a26', '#2d2c3e', '#45445a']);
    return {
      skin: skinR('#bba6bd', '#e2d5e0', '#f6eff6', { lip: '#6a1e4a', blush: '#e6b8cc' }), face: FACES.cute, eyeStyle: 'cutewing', eyeC: EYEC.violet,
      brows: { pts: [[0, -4], [3, -5], [7, -4]], col: BK[1], thick: 1, asymR: { neutral: -1, angry: 1 } },
      nose: NOSE_CUTE,
      mouths: { neutral: 'lSmirk', happy: 'lHappy', sad: 'lSad', surprised: 'lO', angry: 'lSnarl' },
      mouthLib: cuteMouths({
        lSmirk: ['.....D', '.PPPPD', '..ppp.'], lSmirkTalk: ['.....D', '.PPPPD', '.DmmD.', '..ppp.'],
        lHappy: ['PPPPPP', 'DmmmmD', '.pLpp.'], lHappyTalk: ['PPPPPP', 'DmmmmD', 'DmuumD', '.pLpp.'],
        lSad: ['..PP..', '.D..D.', '.pLpp.'], lSadTalk: ['..PP..', '.DmmD.', '.pLpp.'],
        lO: ['.PP.', 'DmmD', '.pp.'], lOTalk: ['.PP.', 'DmmD', 'DmmD', '.pp.'],
        lSnarl: ['PPPPPP', 'DttttD', '.t...D', '.pLpp.'], lSnarlTalk: ['PPPPPP', 'DttttD', 'DtmmmD', '.pLpp.']
      }),
      skinDetail: function (P) {
        var B = P.B; cuteCheeks(P, P.e === 'happy'); tearDrops(P);
        B.set(31, 39, SILVER[3], TAG.METAL); B.set(32, 39, SILVER[2], TAG.METAL); // septum ring
      },
      back: function (P) {
        var B = P.B, M = M64().poly([[16, 26], [13, 38], [15, 49], [21, 51], [23, 40]]).sym();
        hairClumps(B, M, BK, { px: 32, py: 12, aw: 0.1, ph: 0.3, cx: 20, cy: 24, rx: 30, ry: 30, k: 0.5, gap: 0.2 });
        recolorRamp(B, M, BK, VI, function (x) { return x >= 32; });
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 8, 28);
        shadeFill(B, M, TEE.concat([TEE[2]]), TAG.CLOTH, { cx: 20, cy: 46, rx: 30, ry: 24, edge: 0.3 });
        // moon-skull band logo on the tee
        stamp(B, ['..m..', '.mm..', '.WWW.', 'WkWkW', 'WWWWW', '.W.W.'], 30, 54, { m: H('#c8d4f0'), W: H('#eceaf4'), k: OUT }, TAG.ACC);
        // cropped leather jacket, open over the tee
        var jk = M.clone().keep(function (x, y) { return Math.abs(x + 0.5 - 32) >= 7 + Math.max(0, y - 50) * 0.15; });
        shadeFill(B, jk, JK, TAG.CLOTH, { cx: 14, cy: 44, rx: 30, ry: 22, edge: 0.4 });
        var lap = M64().poly([[25, 47], [27, 47], [25.5, 58], [21, 52], [22, 47]]).sym().and(jk);
        shadeFill(B, lap, JK, TAG.CLOTH, { cx: 20, cy: 44, rx: 22, ry: 18, bias: 0.35, edge: 0.4 });
        [[14, 52], [15, 53], [49, 53], [12, 58], [51, 57]].forEach(function (p) { B.set(p[0], p[1], H('#6c6488'), TAG.CLOTH); });
        [[24, 56], [24, 58], [24, 60], [39, 56], [39, 58], [39, 60]].forEach(function (p) { B.set(p[0], p[1], SILVER[2], TAG.METAL); });
        // spiked choker
        B.hline(27, 36, 44, OUT, TAG.ACC); B.hline(27, 36, 45, JK[2], TAG.ACC);
        for (var x = 27; x <= 36; x += 2) B.set(x, 46, SILVER[2], TAG.METAL);
        B.set(31, 46, SILVER[3], TAG.METAL); B.set(31, 47, SILVER[2], TAG.METAL);
      },
      drawEars: function (P) { drawEars(P); var B = P.B; [[17, 30], [17, 32], [46, 31], [46, 33]].forEach(function (p) { B.set(p[0], p[1], SILVER[2], TAG.METAL); }); },
      front: function (P) {
        var B = P.B;
        var cap = M64().ellipse(32, 24, 16.5, 14).keep(function (x, y) { return y < 27; }).or(faceTop(P, function () { return 27; }));
        // choppy bangs down to the brows, shaggy wolf-cut layers at the sides
        cap.poly([[19, 22], [20, 28], [22, 26], [24, 29], [26, 26], [28, 28], [30, 26], [32, 28], [34, 26], [36, 28], [38, 26], [40, 29], [42, 26], [44, 28], [45, 22]]);
        cap.poly([[17, 22], [22, 26], [22, 34], [21, 40], [19, 44], [18, 40], [16, 44], [15, 36], [16, 28]]);
        cap.poly([[47, 22], [42, 26], [42, 34], [43, 40], [45, 44], [46, 40], [48, 44], [49, 36], [48, 28]]);
        [[25, 11, 23, 8], [31, 10, 31, 7], [38, 11, 41, 8]].forEach(function (t) { cap.poly([[t[0] - 2, t[1] + 2], [t[2], t[3]], [t[0] + 2, t[1] + 2]]); });
        hairClumps(B, cap, BK, { px: 32, py: 13, aw: 0.26, ph: 0.4, cx: 24, cy: 13, rx: 20, ry: 18, k: 0.6, gap: 0.16, shine: [32, 24, 10, 12], shineTest: function (x, y) { return x < 30 && y < 22; } });
        recolorRamp(B, cap, BK, VI, function (x) { return x >= 32; });
        innerLine(B, cap, OUT, function (t) { return t === TAG.SKIN; });
      }
    };
  })();

  // ---- Laura B: platinum-and-black skunk-stripe bob, grey eyes, dark lips, bat-wing clips, oversized hoodie with violet sleeves
  NPC.laura_b = (function () {
    var S = skinR('#c9a9b8', '#ecd3d9', '#fbeef0', { lip: '#4a1424', blush: '#ecbccc' }), BK = HAIR.black, PL = HS(['#7a7690', '#c4c0d4', '#e2e0ec', '#f4f2fb', '#ffffff']);
    var HOOD = HS(['#0e0a16', '#1a1624', '#262036', '#3a3250']), SLV = HS(['#2e1c52', '#4a2f7a', '#6a47a8', '#8f6cd1']);
    return {
      skin: S, face: FACES.cute, eyeStyle: 'cutelid', eyeC: HS(['#3a3e52', '#7c84a0', '#c8cedc', '#14161e']),
      brows: { pts: [[0, -4], [3, -4], [7, -4]], col: BK[1], thick: 1, mod: { neutral: function () { return 0; } } },
      nose: NOSE_CUTE,
      mouths: { neutral: 'bFlat', happy: 'bSmile', sad: 'bSad', surprised: 'lO', angry: 'bFrown' },
      mouthLib: cuteMouths({
        bFlat: ['.....P', '.PPPP.', '.pLp..'], bFlatTalk: ['.PPPP.', 'DmmmmD', '.pLp..'],
        bSmile: ['P....P', '.PPPP.', '.pLpp.'], bSmileTalk: ['PPPPPP', 'DmmmmD', '.pLpp.'],
        bSad: ['..PP..', '.D..D.', '.pLpp.'], bSadTalk: ['..PP..', '.DmmD.', '.pLpp.'],
        lO: ['.PP.', 'DmmD', '.pp.'], lOTalk: ['.PP.', 'DmmD', 'DmmD', '.pp.'],
        bFrown: ['.PPPP.', 'D....D', '.pLpp.'], bFrownTalk: ['.PPPP.', 'DmmmmD', '.pLpp.']
      }),
      skinDetail: function (P) { cuteCheeks(P, false); tearDrops(P); },
      back: function (P) {
        var B = P.B, M = M64().poly([[17, 28], [16, 42], [22, 45], [23, 32]]).sym();
        hairClumps(B, M, BK, { px: 32, py: 8, aw: 0.07, ph: 0.3, cx: 20, cy: 24, rx: 30, ry: 30, k: 0.4, gap: 0.2 });
      },
      body: function (P) {
        var B = P.B, M = torso(47, 10, 27, 8, 30);
        shadeFill(B, M, HOOD, TAG.CLOTH, { cx: 18, cy: 46, rx: 32, ry: 24, edge: 0.3 });
        var sl = M.clone().keep(function (x, y) { return Math.abs(x + 0.5 - 32) >= 18.5 - Math.max(0, y - 52) * 0.1; });
        shadeFill(B, sl, SLV, TAG.CLOTH, { cx: 12, cy: 48, rx: 30, ry: 22, edge: 0.4 });
        edgePx(sl, [[1, 0], [-1, 0]]).forEach(function (p) { if (Math.abs(p[0] + 0.5 - 32) < 20) B.set(p[0], p[1], SLV[0], TAG.CLOTH); });
        // the hood bunched behind the neck + drawstrings with metal tips
        var hd = M64().ellipse(32, 48.5, 13.5, 4.2).sub(M64().poly([[27, 44], [37, 44], [32, 53]]));
        shadeFill(B, hd, HOOD, TAG.CLOTH, { cx: 26, cy: 45, rx: 14, ry: 6, bias: 0.35, edge: 0.6 });
        [[29, 50, 58], [35, 50, 56]].forEach(function (d) { for (var y = d[1]; y <= d[2]; y++) B.set(d[0], y, y === d[2] ? SILVER[2] : H('#c8c4d8'), TAG.ACC); });
        stamp(B, ['.vvv.', 'v.v.v', '.v.v.'], 41, 57, { v: SLV[3] }, TAG.ACC); // little violet bat print
      },
      front: function (P) {
        var B = P.B, cut = function (x) { var dx = x + 0.5 - 32; return 20 + 0.03 * dx * dx; };
        // sharp chin-length bob, centre part, platinum locks framing the face
        var bob = M64().ellipse(32, 25, 16.5, 14.5).or(M64().poly([[15.5, 25], [22.5, 25], [22.5, 44], [17, 42]]).sym());
        bob.sub(M64().poly([[22.5, 20], [41.5, 20], [41.5, 64], [22.5, 64]]).keep(function (x, y) { return y + 0.5 > cut(x); }));
        bob.or(faceTop(P, function (x) { return cut(x) - 0.5; }));
        hairClumps(B, bob, BK, { px: 32, py: 9, aw: 0.09, ph: 0.4, cx: 24, cy: 14, rx: 20, ry: 20, k: 0.45, gap: 0.12, shine: [32, 25, 10.5, 12.5], shineTest: function (x, y) { return x < 31 && y < 22; } });
        recolorRamp(B, bob, BK, PL, function (x, y) { var dx = Math.abs(x + 0.5 - 32); return (dx >= 7 && dx <= 11.5) || (y > 25 && dx < 12.5 && dx > 8.5); });
        for (var y = 11; y < 20; y++) B.set(31, y, BK[0], TAG.HAIR);
        innerLine(B, bob, OUT, function (t) { return t === TAG.SKIN; });
        // bat-wing hair clips
        [[16, 16], [17, 21]].forEach(function (c) { stamp(B, ['b.k.b', 'bbkbb', '.b.b.'], c[0], c[1], { b: H('#2a1840'), k: SLV[3] }, TAG.ACC); });
      }
    };
  })();

  // ---- 15. Jasmine Honeywell — A: strawberry-blonde waves in two low pigtails with pink ribbons, freckles, pink dress, cream cardigan, bee apron
  NPC.jasmine_a = (function () {
    var S = skinR('#c98e74', '#ebb79a', '#f8d6c0', { blush: '#f08a98' }), R = HS(['#7a3a24', '#c46a48', '#e8946a', '#f6b88e', '#ffdcbc']);
    var CARD = HS(['#b8a088', '#dcc8a8', '#f0e4c8', '#fbf6ea']), DRESS = HS(['#a85a74', '#d07896', '#eca0b8', '#f8c8d6']), RIB = HS(['#a03a5a', '#e06a8e', '#ffb0c8']);
    return {
      skin: S, face: FACES.cute, eyeStyle: 'cute', eyeC: HS(['#4a3018', '#8a6030', '#c89a58', '#2a180a']),
      brows: { pts: [[0, -3], [3, -4], [7, -4]], col: R[1], thick: 1, mod: { neutral: function (u) { return u > 0.6 ? -1 : 0; } } },
      gaze: function (P) { return P.e === 'neutral' ? -1 : 0; },
      nose: NOSE_CUTE,
      mouths: { neutral: 'cShy', happy: 'cHappy', sad: 'cSad', surprised: 'cO', angry: 'cPout' },
      mouthLib: cuteMouths(),
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin; cuteCheeks(P, true); tearDrops(P);
        sym(B, [[24, 36], [26, 37], [23, 37], [29, 35], [28, 36]], mix(S2.b, S2.s, 0.8), TAG.SKIN);
        if (P.e === 'angry') sym(B, [[20, 39], [21, 40]], S2.blush, TAG.SKIN);
      },
      back: function (P) {
        var B = P.B;
        // two low wavy pigtails resting on the shoulders
        [[[19, 40], [15, 48], [17, 56], [14, 63]], [[45, 40], [49, 48], [47, 56], [50, 63]]].forEach(function (cp) {
          var M = M64().thick(bez(cp), 3);
          hairClumps(B, M, R, { px: cp[0][0], py: 30, aw: 0.16, ph: 0.2, cx: 14, cy: 40, rx: 24, ry: 30, k: 0.6, gap: 0.2, wave: [0.8, 0.3] });
        });
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 8, 28);
        shadeFill(B, M, DRESS, TAG.CLOTH, { cx: 18, cy: 46, rx: 32, ry: 24, edge: 0.3 });
        var card = M.clone().keep(function (x, y) { return Math.abs(x + 0.5 - 32) >= 8 + Math.max(0, y - 50) * 0.3; });
        shadeFill(B, card, CARD, TAG.CLOTH, { cx: 14, cy: 44, rx: 30, ry: 22, edge: 0.4, th: [-0.55, -0.05, 0.45] });
        card.each(function (x, y) { if ((ti(x) + (tj(y) >> 1)) % 4 === 0 && B.get(x, y) !== CARD[0]) B.set(x, y, mix(B.get(x, y), CARD[0], 0.4), TAG.CLOTH); });
        card.each(function (x, y) { if (!card.has(x < 32 ? x + 1 : x - 1, y)) B.set(x, y, CARD[0], TAG.CLOTH); });
        [[22, 56], [22, 60], [41, 56], [41, 60]].forEach(function (p) { B.set(p[0], p[1], RIB[2], TAG.CLOTH); });
        // scalloped dress neckline + apron with a little bee
        stamp(B, ['.wwwwwwwww.', 'w.w.w.w.w.w'], 27, 47, { w: H('#fbf4e2') }, TAG.CLOTH);
        shadeFill(B, M64().poly([[27, 57], [37, 57], [38, 64], [26, 64]]), HS(['#cfc8c0', '#f4f0ea', '#ffffff']), TAG.CLOTH, { cx: 28, cy: 54, rx: 14, ry: 12 });
        stamp(B, ['.ww.', 'yKyK', '.yKy'], 30, 59, { w: H('#c4e6ff'), y: H('#f2c45a'), K: OUT }, TAG.ACC);
      },
      front: function (P) {
        var B = P.B, hl = function (x) { var dx = x + 0.5 - 32; return 21 + 0.03 * dx * dx; };
        var cap = M64().ellipse(32, 24.5, 16.5, 14).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        cap.poly([[31, 13], [31, 22], [27, 25], [23, 27], [21, 31], [19, 26], [22, 18]]); cap.poly([[33, 13], [33, 22], [37, 25], [41, 27], [43, 31], [45, 26], [42, 18]]);
        cap.poly([[18, 24], [21, 30], [20, 38], [19, 42], [17, 36], [17, 28]]); cap.poly([[46, 24], [43, 30], [44, 38], [45, 42], [47, 36], [47, 28]]);
        hairClumps(B, cap, R, { px: 32, py: 9, aw: 0.2, ph: 0.5, cx: 24, cy: 14, rx: 20, ry: 18, k: 0.5, gap: 0.15, wave: [0.6, 0.2], shine: [32, 24, 10, 12], shineTest: function (x) { return x < 31; } });
        for (var y = 11; y < 21; y++) B.set(32, y, R[0], TAG.HAIR);
        innerLine(B, cap, R[0], function (t) { return t === TAG.SKIN; });
        // pink ribbons tying the pigtails + a bee hair clip
        bowAt(B, 15, 40, RIB); bowAt(B, 44, 40, RIB);
        stamp(B, ['.ww.', 'yKyK', '.yKy'], 39, 17, { w: H('#e4f6ff'), y: H('#f2c45a'), K: OUT }, TAG.ACC);
      }
    };
  })();

  // ---- Jasmine B: honey-brown curls in a loose bun with a flower, knitted bear-ear beret, lilac puff sleeves, sage pinafore, gold bee earrings
  NPC.jasmine_b = (function () {
    var S = skinR('#c08060', '#e4aa88', '#f6ccac', { blush: '#f0907e' }), R = HS(['#4a2a14', '#7a4a24', '#a8703a', '#d09a5a', '#f0c088']);
    var KNIT = HS(['#a8987a', '#d0c4a6', '#ece2c8', '#fbf6e8']), LIL = HS(['#7a64aa', '#9a84c8', '#bca8e2', '#dcd0f6']), SAGE = HS(['#3e5a42', '#5a7a5c', '#7a9a7a', '#9cba9a']);
    return {
      skin: S, face: FACES.cute, eyeStyle: 'cute', eyeC: HS(['#3a2214', '#6e4630', '#a4744e', '#1e120a']),
      brows: { pts: [[0, -3], [3, -4], [7, -4]], col: R[1], thick: 1, mod: { neutral: function (u) { return u > 0.6 ? -1 : 0; } } },
      gaze: function (P) { return P.e === 'neutral' ? 1 : 0; },
      nose: NOSE_CUTE,
      mouths: { neutral: 'cShy', happy: 'cHappy', sad: 'cSad', surprised: 'cO', angry: 'cPout' },
      mouthLib: cuteMouths(),
      skinDetail: function (P) {
        var B = P.B; cuteCheeks(P, true); tearDrops(P);
        [[18, 37], [45, 37]].forEach(function (p) { B.set(p[0], p[1], GOLD[2], TAG.METAL); B.set(p[0], p[1] + 1, OUT, TAG.METAL); B.set(p[0], p[1] + 2, GOLD[2], TAG.METAL); });
      },
      back: function (P) { // the loose curly bun at the nape, with a flower
        var B = P.B, bun = M64().ellipse(20, 41, 6.5, 5.5);
        for (var i = 0; i < 6; i++) bun.ellipse(20 + Math.cos(i) * 5.5, 41 + Math.sin(i) * 4.5, 2.6, 2.6);
        curlFill(B, bun, R);
        flower(B, 16, 37, H('#f6c4d4'), WHITE, H('#ffd27a')); B.set(15, 36, WHITE, TAG.ACC); B.set(17, 38, H('#f6c4d4'), TAG.ACC);
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 8, 28);
        shadeFill(B, M, LIL, TAG.CLOTH, { cx: 18, cy: 46, rx: 32, ry: 24, edge: 0.3 });
        // puffed sleeves
        [[12, 53], [52, 53]].forEach(function (c) { var pf = M64().ellipse(c[0], c[1], 7.5, 6).and(M); shadeFill(B, pf, LIL, TAG.CLOTH, { cx: c[0] - 4, cy: c[1] - 4, rx: 9, ry: 8, edge: 0.5 }); bez([[c[0] - 3, c[1] - 3], [c[0], c[1] + 1], [c[0] + 3, c[1] - 3]]).forEach(function (p) { B.set(p[0], p[1], LIL[0], TAG.CLOTH); }); });
        stamp(B, ['.wwwwwwwww.', 'wWWWW.WWWWw'], 27, 46, { w: H('#cfc8c0'), W: H('#fbf8f2') }, TAG.CLOTH);
        // sage pinafore bib with straps and buttons
        var pin = M64().poly([[24, 53], [40, 53], [42, 64], [22, 64]]);
        shadeFill(B, pin, SAGE, TAG.CLOTH, { cx: 26, cy: 50, rx: 20, ry: 16, edge: 0.4 });
        [[[25, 53], [24, 47]], [[39, 53], [40, 47]]].forEach(function (cp) { bez(cp).forEach(function (p) { B.set(p[0], p[1], SAGE[2], TAG.CLOTH); B.set(p[0] + 1, p[1], SAGE[1], TAG.CLOTH); }); });
        [[26, 55], [38, 55]].forEach(function (p) { B.set(p[0], p[1], KNIT[3], TAG.ACC); B.set(p[0] + 1, p[1], KNIT[1], TAG.ACC); });
        stamp(B, ['.ff.', 'fyyf', '.ff.'], 30, 58, { f: WHITE, y: H('#ffd27a') }, TAG.ACC);
      },
      front: function (P) {
        var B = P.B, hl = function (x) { var dx = x + 0.5 - 32; return 20 + 0.03 * dx * dx; };
        var M = M64().ellipse(32, 24.5, 16, 13.5).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        // curls framing the face
        [[19, 24], [18, 29], [19, 34], [20, 39], [45, 24], [46, 29], [45, 34], [44, 39], [23, 21], [41, 21], [27, 20], [37, 20]].forEach(function (c) { M.ellipse(c[0], c[1], 3, 3); });
        curlFill(B, M, R);
        innerLine(B, M, R[0], function (t) { return t === TAG.SKIN; });
        // knitted bear-ear beret
        var ber = M64().ellipse(32, 13, 15, 6.5), ears = M64().ellipse(21, 7.5, 3.6, 3.4).or(M64().ellipse(43, 7.5, 3.6, 3.4));
        shadeFill(B, ears, KNIT, TAG.HAT, { cx: 18, cy: 4, rx: 16, ry: 10, edge: 0.5 });
        [[21, 8], [43, 8]].forEach(function (c) { B.set(c[0], c[1], H('#c49a86'), TAG.HAT); B.set(c[0] - 1, c[1], H('#d8ae9a'), TAG.HAT); B.set(c[0], c[1] - 1, H('#d8ae9a'), TAG.HAT); });
        shadeFill(B, ber, KNIT, TAG.HAT, { cx: 24, cy: 8, rx: 20, ry: 10, edge: 0.5 });
        ber.each(function (x, y) { if ((ti(x) + tj(y)) % 3 === 0 && y > 9) B.set(x, y, mix(B.get(x, y), KNIT[0], 0.35), TAG.HAT); });
        edgePx(ber, [[0, 1]]).forEach(function (p) { B.set(p[0], p[1], KNIT[0], TAG.HAT); B.set(p[0], p[1] - 1, (p[0] % 2) ? KNIT[1] : KNIT[2], TAG.HAT); });
        B.set(32, 6, KNIT[2], TAG.HAT); B.set(32, 5, KNIT[3], TAG.HAT);
      }
    };
  })();

  // ---- 16. Amara Starling — A: big curly puff bun with a pencil, round gold glasses, mustard cardigan, white collar, satchel strap, star earrings
  NPC.amara_a = (function () {
    var S = skinR('#7a4a32', '#9e6646', '#c08560', { blush: '#c06a5a', lip: '#6a3030' }), R = HS(['#120c1c', '#24160f', '#3e2a20', '#5a3e2c', '#7a5640']);
    var MUS = HS(['#7a5410', '#b07e1e', '#d8a838', '#f0cc6a']), STRAP = HS(['#3e2d2b', '#574039', '#7a5a48']);
    return {
      skin: S, face: FACES.cute, eyeStyle: 'cute', eyeC: HS(['#2a1408', '#6a3a16', '#a8662a', '#160a04']),
      brows: { pts: [[0, -4], [3, -6], [7, -5]], col: R[1], thick: 1, mod: { neutral: function () { return -1; } } },
      nose: NOSE_CUTE,
      mouths: { neutral: 'cBig', happy: 'cHappy', sad: 'cSad', surprised: 'cO', angry: 'cPout' },
      mouthLib: cuteMouths(),
      skinDetail: function (P) {
        var B = P.B; cuteCheeks(P, P.e !== 'angry'); tearDrops(P);
        [[17, 37], [46, 37]].forEach(function (c) { B.set(c[0], c[1], GOLD[3], TAG.METAL); B.set(c[0] - 1, c[1] + 1, GOLD[2], TAG.METAL); B.set(c[0] + 1, c[1] + 1, GOLD[2], TAG.METAL); B.set(c[0], c[1] + 1, GOLD[2], TAG.METAL); B.set(c[0], c[1] + 2, GOLD[1], TAG.METAL); });
      },
      back: function (P) { // the big puff bun with a pencil through it
        var B = P.B, puff = M64().ellipse(32, 9, 14, 9.5);
        for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; if (Math.sin(a) < 0.5) puff.ellipse(32 + Math.cos(a) * 13, 9 + Math.sin(a) * 8.5, 3, 3); }
        curlFill(B, puff, R);
        bez([[16, 3], [33, 9], [47, 13]]).forEach(function (p, i, a) { var t = i / a.length; B.set(p[0], p[1], t < 0.08 ? H('#e89ab8') : t < 0.13 ? SILVER[2] : t > 0.92 ? H('#2a2238') : t > 0.85 ? H('#e8c8a0') : H('#f2c45a'), TAG.ACC); B.set(p[0], p[1] + 1, t < 0.08 ? H('#c4648e') : t > 0.85 ? H('#a87a50') : H('#c08a2a'), TAG.ACC); });
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 8, 28);
        shadeFill(B, M, MUS, TAG.CLOTH, { cx: 18, cy: 46, rx: 32, ry: 24, edge: 0.3 });
        M.each(function (x, y) { if (ti(x) % 3 === 0 && tj(y) % 2 === 0 && B.get(x, y) !== MUS[0]) B.set(x, y, mix(B.get(x, y), MUS[0], 0.3), TAG.CLOTH); });
        shadeFill(B, M64().poly([[27, 47], [37, 47], [33, 64], [31, 64]]).and(M), HS(['#cfc8c0', '#f4f0ea', '#ffffff']), TAG.CLOTH, { cx: 28, cy: 46, rx: 8, ry: 12 });
        stamp(B, ['.wwww..wwww.', 'wWWWWw.wWWWW', '.wwww..wwww.'], 26, 46, { w: H('#cfc8c0'), W: WHITE }, TAG.CLOTH);
        [[30, 54], [30, 58], [30, 62]].forEach(function (p) { B.set(p[0], p[1], H('#7a5410'), TAG.CLOTH); });
        // satchel strap across the chest
        M64().thick(bez([[17, 48], [32, 56], [47, 64]]), 1).and(M).each(function (x, y) { B.set(x, y, (ti(x) + tj(y)) % 6 === 0 ? STRAP[2] : STRAP[1], TAG.ACC); });
        stamp(B, ['ggg', 'g.g', 'ggg'], 23, 51, { g: GOLD[1] }, TAG.METAL);
      },
      front: function (P) {
        var B = P.B, hl = function (x) { var dx = x + 0.5 - 32; return 19 + 0.035 * dx * dx; };
        var M = M64().ellipse(32, 24.5, 16, 13.5).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        [[18, 27], [46, 27], [20, 22], [44, 22]].forEach(function (c) { M.ellipse(c[0], c[1], 2.4, 2.4); });
        curlFill(B, M, R);
        innerLine(B, M, R[0], function (t) { return t === TAG.SKIN; });
        var ex = P.f.eyeX, ey = P.f.eyeY;
        [[ex + 4, ey + 3], [63 - ex - 4 + 1, ey + 3]].forEach(function (c) { ring(B, c[0], c[1], 5.3, 5, GOLD); B.set(Math.round(c[0] - 3), Math.round(c[1] - 3), H('#fff1c8'), TAG.GLASS); });
        B.hline(30, 33, ey + 2, GOLD[1], TAG.METAL);
      }
    };
  })();

  // ---- Amara B: box braids gathered in a top knot, gold cuffs, thick violet glasses, teal sweater vest, constellation pin, astrolabe
  NPC.amara_b = (function () {
    var S = skinR('#573424', '#76492f', '#976644', { d: '#3e2220', line: '#22101a', blush: '#9a4e44', lip: '#6a2c34' }), R = HS(['#0b0711', '#1b1214', '#2e2022', '#4a3434', '#6a4c48']);
    var VEST = HS(['#0c3036', '#12484e', '#1c6668', '#2c8884']), FR = HS(['#2a1848', '#4a2f7a', '#7a5ab8']);
    return {
      skin: S, face: FACES.cute, eyeStyle: 'cute', eyeC: HS(['#2a1408', '#6a3a16', '#b0702a', '#160a04']), faceLight: 0.56, castRows: 1, lash: H('#0b0711'),
      brows: { pts: [[0, -4], [3, -6], [7, -5]], col: R[0], thick: 1, mod: { neutral: function () { return -1; } } },
      nose: NOSE_CUTE,
      mouths: { neutral: 'cBig', happy: 'cHappy', sad: 'cSad', surprised: 'cO', angry: 'cPout' },
      mouthLib: cuteMouths(),
      skinDetail: function (P) { cuteCheeks(P, P.e !== 'angry'); tearDrops(P); },
      back: function (P) {
        var B = P.B;
        // top knot of braids on the crown
        var knot = M64().ellipse(32, 8.5, 7.5, 5.5);
        hairClumps(B, knot, R, { px: 32, py: 8.5, aw: 0.7, ph: 0.2, cx: 29, cy: 5, rx: 10, ry: 8, k: 0.5, gap: 0.2 });
        B.hline(28, 36, 13, GOLD[2], TAG.METAL); B.hline(28, 36, 14, GOLD[1], TAG.METAL);
        // long braids behind the shoulders
        var M = M64().poly([[17, 26], [13, 48], [14, 60], [24, 60], [23, 32]]).sym();
        shadeFill(B, M, [R[1], R[2], R[3]], TAG.HAIR, { cx: 26, cy: 22, rx: 30, ry: 40, th: [0.1, 0.62] });
        for (var x = 14; x <= 50; x += 3) strands(B, M, [[[x, 26], [x + (x < 32 ? -1 : 1), 44], [x + (x < 32 ? -2 : 2), 60]]], R[1]);
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 8, 28);
        shadeFill(B, M, HS(['#9a96b0', '#cfcbe0', '#f2f0f8', '#ffffff']), TAG.CLOTH, { cx: 16, cy: 44, rx: 32, ry: 24, edge: 0.3, th: [-0.5, -0.05, 0.55] });
        var vest = M.clone().keep(function (x, y) { var dx = Math.abs(x + 0.5 - 32); return y >= 49 && dx <= 13 + (y - 49) * 0.35; }).sub(M64().poly([[26, 47], [38, 47], [32, 57]]));
        shadeFill(B, vest, VEST, TAG.CLOTH, { cx: 18, cy: 44, rx: 26, ry: 22, edge: 0.4 });
        vest.each(function (x, y) { if ((ti(x) + tj(y)) % 2 === 0 && tj(y) % 2 === 0) B.set(x, y, mix(B.get(x, y), VEST[0], 0.35), TAG.CLOTH); });
        stamp(B, ['WW.......WW', '.WW.....WW.'], 27, 46, { W: WHITE }, TAG.CLOTH);
        // constellation pin
        [[20, 53], [22, 51], [24, 54], [21, 56]].forEach(function (p) { B.set(p[0], p[1], GOLD[3], TAG.METAL); });
        [[21, 52], [23, 52], [22, 55]].forEach(function (p) { B.set(p[0], p[1], GOLD[1], TAG.METAL); });
        // astrolabe on a cord
        bez([[28, 47], [30, 53], [32, 56]]).forEach(function (p) { B.set(p[0], p[1], H('#574039'), TAG.ACC); });
        bez([[36, 47], [34, 53], [32, 56]]).forEach(function (p) { B.set(p[0], p[1], H('#3e2d2b'), TAG.ACC); });
        ring(B, 32, 59.5, 3.5, 3.5, GOLD); B.set(31, 59, GOLD[2], TAG.METAL); B.set(32, 60, GOLD[1], TAG.METAL); B.set(31, 58, GOLD[3], TAG.METAL);
      },
      front: function (P) {
        var B = P.B, hl = function (x) { var dx = x + 0.5 - 32; return 19 + 0.035 * dx * dx; };
        var cap = M64().ellipse(32, 24.5, 15.5, 13).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        hairClumps(B, cap, R, { px: 32, py: 9, aw: 0.2, ph: 0.5, cx: 25, cy: 13, rx: 18, ry: 16, k: 0.5, gap: 0.2, shine: [32, 24, 10, 12], shineTest: function (x) { return x < 31; } });
        innerLine(B, cap, R[0], function (t) { return t === TAG.SKIN; });
        // long braids falling in front of the shoulders, a few with gold cuffs, one copper accent
        var cu = { cuffs: [0.35, 0.7], cuffC: GOLD };
        braid(B, [[18, 30], [15, 46], [12, 63]], R, 3, cu); braid(B, [[21, 34], [20, 50], [18, 63]], HS(['#2a120a', '#5a2a16', '#8a4a2a', '#b06a40', '#c88a5a']), 3, { cuffs: [0.55], cuffC: GOLD });
        braid(B, [[46, 30], [49, 46], [52, 63]], R, 3, cu); braid(B, [[43, 34], [44, 50], [46, 63]], R, 3, { cuffs: [0.55], cuffC: GOLD });
        // thick violet glasses
        var ex = P.f.eyeX, ey = P.f.eyeY;
        [false, true].forEach(function (fl) {
          var X = function (x) { return fl ? 63 - x : x; };
          for (var x = 20; x <= 30; x++) { B.set(X(x), ey - 1, FR[1], TAG.METAL); B.set(X(x), ey + 6, FR[1], TAG.METAL); }
          for (var y = ey - 1; y <= ey + 6; y++) { B.set(X(20), y, FR[1], TAG.METAL); B.set(X(30), y, FR[0], TAG.METAL); }
          B.hline(X(fl ? 30 : 20), X(fl ? 20 : 30), ey - 1, FR[2], TAG.METAL);
          B.set(X(22), ey + 1, H('#f4f2fb'), TAG.GLASS);
        });
        B.hline(31, 32, ey + 1, FR[1], TAG.METAL);
      }
    };
  })();

  // ---- 17. Ronan Ashvale: broad, tanned, dark-auburn hair in a short ponytail, short beard, glowing teal rune tattoos, apron, soot, amber eyes
  NPC.ronan = (function () {
    var S = SKIN.tan, R = HS(['#2a0e0a', '#5a1e14', '#7e2e1e', '#a4462e', '#c8684a']);
    var SHIRT = HS(['#14131c', '#1f1e2a', '#2d2c3e', '#45445a']), APR = HS(['#281d21', '#3e2d2b', '#574039', '#7a5a48']), RUNE = HS(['#1a8a84', '#3ae8d8', '#b4fff4']);
    return {
      skin: S, face: FACES.square, eyeStyle: 'sharp', eyeC: EYEC.amber, neckW: 6,
      brows: { pts: [[-1, -3], [2, -3], [6, -3]], col: R[1], col2: R[0], thick: 2, taper: 0.1, mod: { neutral: function (u) { return u > 0.7 ? 1 : 0; } } },
      mouths: { neutral: 'rFlat', happy: 'rSmile', sad: 'frown', surprised: 'o', angry: 'grit' },
      mouthLib: { rFlat: ['.DDDDD.', '..sss..'], rFlatTalk: ['.DDDDD.', '.DmmmD.', '..DDD..'], rSmile: ['D.....D', '.DDDDD.', '..sss..'], rSmileTalk: ['D.....D', '.DtttD.', '..DDD..'] },
      body: function (P) {
        var B = P.B, M = torso(45, 11, 31, 7, 33), S2 = P.skin;
        shadeFill(B, M, SHIRT, TAG.CLOTH, { cx: 20, cy: 44, rx: 34, ry: 26, edge: 0.3 });
        var arms = M.clone().keep(function (x, y) { var dx = Math.abs(x + 0.5 - 32); return dx > 19 + (y - 45) * 0.15; });
        shadeFill(B, arms, [S2.d, S2.s, S2.b, S2.l], TAG.SKIN, { cx: 14, cy: 48, rx: 40, ry: 22, edge: 0.4, th: [-0.45, -0.05, 0.5] });
        innerLine(B, arms, S2.d, function (t, c) { return SHIRT.indexOf(c) >= 0; });
        // glowing teal runes inked along the arms
        [[6, 54, 'r1'], [10, 58, 'r2'], [53, 55, 'r2'], [56, 59, 'r1']].forEach(function (g) {
          stamp(B, g[2] === 'r1' ? ['G.G', '.g.', 'G.G', '.g.'] : ['GGG', 'g..', 'GgG', '..g'], g[0], g[1], { G: RUNE[1], g: RUNE[2] }, TAG.GLASS);
        });
        var apr = M64().poly([[18, 53], [46, 53], [48, 64], [16, 64]]).and(M);
        shadeFill(B, apr, APR, TAG.CLOTH, { cx: 20, cy: 50, rx: 30, ry: 20, edge: 0.3 });
        [[20, 46], [43, 46]].forEach(function (p, k) { for (var y = p[1]; y < 54; y++) { var x = p[0] + (k ? 1 : -1) * Math.round((y - p[1]) * 0.25); B.set(x, y, APR[2], TAG.CLOTH); B.set(x + 1, y, APR[1], TAG.CLOTH); } });
        [[19, 54], [44, 54]].forEach(function (p) { B.set(p[0], p[1], SILVER[2], TAG.METAL); });
        // the cabinet key on a cord + soot
        bez([[27, 46], [29, 51], [31, 53]]).forEach(function (p) { B.set(p[0], p[1], H('#3e2d2b'), TAG.ACC); });
        stamp(B, ['.ss.', 'sGgs', 'sgGs', '.ss.'], 30, 53, { s: H('#605f78'), G: H('#3ae8d8'), g: H('#b4fff4') }, TAG.GLASS);
        [[7, 50], [8, 51], [55, 51]].forEach(function (p) { B.set(p[0], p[1], mix(S2.s, H('#45445a'), 0.5), TAG.SKIN); });
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin;
        [[22, 26], [23, 26], [41, 37]].forEach(function (p) { B.set(p[0], p[1], mix(S2.s, H('#45445a'), 0.5), TAG.SKIN); });
        if (P.e === 'happy') sym(B, [[22, 37], [23, 37]], S2.blush, TAG.SKIN);
      },
      front: function (P) {
        var B = P.B, hl = function (x) { var dx = x + 0.5 - 32; return 18 + 0.03 * dx * dx; };
        // hair swept back into a short ponytail, two loose strands at the temple
        var cap = M64().ellipse(32, 24, 16, 13.5).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        cap.poly([[17, 20], [19, 30], [20, 27], [21, 22]]); cap.poly([[47, 20], [45, 30], [44, 27], [43, 22]]);
        hairClumps(B, cap, R, { px: 32, py: 30, aw: 0.22, ph: 0.3, cx: 24, cy: 12, rx: 20, ry: 16, k: 0.5, gap: 0.15, shine: [32, 24, 10, 12], shineTest: function (x, y) { return x < 30 && y < 18; } });
        innerLine(B, cap, R[0], function (t) { return t === TAG.SKIN; });
        strands(B, null, [[[24, 17], [22, 23], [23, 29]]], R[2]);
        // short trimmed beard and moustache
        var bd = P.faceM.clone().keep(function (x, y) { var dx = Math.abs(x + 0.5 - 32), hw = P.f.hw[y - P.f.top]; return (y >= 37 && hw - dx <= 3) || y >= 42 || (y >= 38 && y <= 39 && dx >= 2 && dx <= 6); });
        bd.each(function (x, y) { if (B.tg(x, y) === TAG.MOUTH) return; var v = sph(x, y, 26, 34, 18, 16); B.set(x, y, v > 0.35 ? R[3] : v > -0.25 ? R[2] : R[1], TAG.BEARD); });
        strands(B, bd, [[[22, 38], [24, 43]], [[41, 38], [39, 43]], [[29, 44], [30, 46]], [[34, 44], [33, 46]]], R[1], TAG.BEARD);
        innerLine(B, bd, R[1], function (t) { return t === TAG.SKIN; }, [[0, -1]]);
      }
    };
  })();

  // ---- 18. Caspian Drake: wind-swept chestnut hair, scarred brow, aviator cap + goggles, green flight jacket with a fur collar, baby dragon
  NPC.caspian = (function () {
    var S = skinR('#c08060', '#e4aa86', '#f6cca8'), R = HS(['#2a140c', '#5a2e18', '#84482a', '#a8683e', '#cc8c5c']);
    var CAP = HS(['#2e1c10', '#4a2e1a', '#6a4428', '#8a5c38']), FUR = HS(['#a8885a', '#c8a878', '#e8d0a8', '#f6e8cc']), JKT = HS(['#22301a', '#3a4a26', '#526a34', '#6e8a46']);
    var DR = HS(['#3e2466', '#6a47a8', '#8f6cd1', '#b99aee']);
    return {
      skin: S, face: FACES.showman, eyeStyle: 'star', eyeC: EYEC.green,
      brows: { pts: [[0, -3], [3, -4], [6, -3]], col: R[1], thick: 2, asymL: { neutral: -1, happy: -1 } },
      mouths: { neutral: 'kGrin', happy: 'kLaugh', sad: 'frown', surprised: 'o', angry: 'grit' },
      mouthLib: {
        kGrin: ['.........D', 'DDDDDDDDD.', '.DttttD...', '..DDDD....'], kGrinTalk: ['.........D', 'DDDDDDDDD.', '.DttttD...', '.DmmmmD...', '..DDDD....'],
        kLaugh: ['DDDDDDDDDD', 'DttttttttD', 'DmmmmmmmmD', '.DmmuummD.', '..DDDDDD..'], kLaughTalk: ['DDDDDDDDDD', 'DttttttttD', 'DmmmuummmD', '.DDDDDDDD.']
      },
      mouthDX: 1,
      skinDetail: function (P) { // the scar through the right eyebrow
        var B = P.B, S2 = P.skin, sc = mix(S2.l, H('#e8a8a0'), 0.45);
        [[38, 25], [38, 26], [39, 27], [39, 28], [39, 29]].forEach(function (p) { B.set(p[0], p[1], sc, TAG.SKIN); });
        sym(B, [[26, 38], [26, 39]], S2.s, TAG.SKIN);
      },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 26, 8, 29);
        shadeFill(B, M, JKT, TAG.CLOTH, { cx: 16, cy: 46, rx: 32, ry: 24, edge: 0.35 });
        shadeFill(B, M64().poly([[27, 48], [37, 48], [32, 60]]).and(M), HS(['#8a7a5a', '#b8a882', '#ddd0a8']), TAG.CLOTH, { cx: 28, cy: 46, rx: 8, ry: 10 });
        // big shearling collar
        var col = M64().ellipse(32, 49, 17, 5.5).or(M64().poly([[22, 50], [29, 60], [26, 61], [18, 53]]).sym()).sub(M64().poly([[28, 44], [36, 44], [32, 58]]));
        shadeFill(B, col, FUR, TAG.CLOTH, { cx: 24, cy: 45, rx: 18, ry: 8, edge: 0.5 });
        edgePx(col, [[0, 1], [0, -1]]).forEach(function (p, i) { if (i % 2) B.set(p[0], p[1], FUR[0], TAG.CLOTH); });
        [[20, 56], [44, 56], [21, 60], [43, 60]].forEach(function (p) { B.set(p[0], p[1], SILVER[2], TAG.METAL); });
        // the baby dragon perched on his shoulder
        var dr = M64().ellipse(50, 50, 5.5, 4.5).or(M64().ellipse(47.5, 44, 4, 3.6));
        shadeFill(B, dr, DR, TAG.ACC, { cx: 46, cy: 42, rx: 9, ry: 9, edge: 0.4 });
        stamp(B, ['.ww....', 'wWWw...', '.wWWw..', '..ww...'], 52, 41, { w: DR[1], W: DR[3] }, TAG.ACC);
        stamp(B, ['bbb', '.bb'], 48, 51, { b: H('#f6e0c0') }, TAG.ACC);
        B.set(46, 43, OUT, TAG.EYE); B.set(46, 42, WHITE, TAG.EYE); B.set(45, 43, H('#2fbf7f'), TAG.EYE);
        B.set(47, 40, H('#f6e0c0'), TAG.ACC); B.set(49, 40, H('#f6e0c0'), TAG.ACC); B.set(44, 45, DR[0], TAG.ACC);
        bez([[54, 52], [57, 55], [55, 58]]).forEach(function (p) { B.set(p[0], p[1], DR[1], TAG.ACC); B.set(p[0], p[1] + 1, DR[0], TAG.ACC); });
      },
      front: function (P) {
        var B = P.B;
        // wind-swept chestnut tufts escaping the cap
        var hr = M64().poly([[18, 19], [20, 25], [22, 22], [25, 27], [27, 22], [30, 26], [33, 21], [37, 25], [40, 20], [45, 24], [50, 21], [54, 17], [49, 16], [44, 15], [24, 16]]);
        hairClumps(B, hr, R, { px: 22, py: 12, aw: 0.24, ph: 0.4, cx: 24, cy: 14, rx: 20, ry: 18, k: 0.55, gap: 0.16 });
        innerLine(B, hr, R[0], function (t) { return t === TAG.SKIN; });
        // leather aviator cap with fleece trim and ear flaps
        var cap = M64().ellipse(32, 20, 16.5, 12).keep(function (x, y) { return y < 19; });
        var flaps = M64().poly([[15, 18], [20, 18], [20, 38], [17, 40], [15, 34]]).sym();
        shadeFill(B, cap.clone().or(flaps), CAP, TAG.HAT, { cx: 24, cy: 8, rx: 22, ry: 18, edge: 0.45, th: [-0.3, 0.1, 0.55] });
        for (var x = 15; x <= 48; x++) if (cap.has(x, 18) || flaps.has(x, 18)) { B.set(x, 18, FUR[2], TAG.HAT); B.set(x, 19, FUR[1], TAG.HAT); }
        bez([[32, 9], [32, 18]]).forEach(function (p) { B.set(p[0], p[1], CAP[0], TAG.HAT); });
        [[16, 40], [47, 40]].forEach(function (p) { B.set(p[0], p[1], CAP[1], TAG.HAT); B.set(p[0], p[1] + 1, SILVER[2], TAG.METAL); });
        // goggles pushed up onto the cap
        [[25.5, 13], [38.5, 13]].forEach(function (c) {
          var outer = M64().ellipse(c[0], c[1], 4.6, 4.2), inner = M64().ellipse(c[0], c[1], 3, 2.7);
          outer.clone().sub(inner).each(function (x, y) { var v = sph(x, y, c[0], c[1], 5, 5); B.set(x, y, v > 0.3 ? GOLD[2] : v > -0.35 ? GOLD[1] : GOLD[0], TAG.METAL); });
          inner.each(function (x, y) { var v = sph(x, y, c[0] - 1, c[1] - 1, 3.4, 3.4); B.set(x, y, v > 0.55 ? H('#ffd88a') : v > 0 ? H('#e8a040') : H('#9a5a1e'), TAG.GLASS); });
          B.set(Math.floor(c[0]) - 1, Math.floor(c[1]) - 1, WHITE, TAG.GLASS);
        });
        B.hline(30, 33, 13, CAP[0], TAG.HAT); B.hline(30, 33, 12, GOLD[1], TAG.METAL);
      }
    };
  })();

  // ---- 19. Gideon Grimm: grizzled, eyepatch, scars, white braided beard, pipe, heavy fur-trimmed coat with the guild emblem
  NPC.gideon = (function () {
    var S = skinR('#a87258', '#cc9476', '#e4b494'), R = HS(['#4a4858', '#7a7890', '#a8a6b8', '#cfcde0', '#eceaf4']), W = HS(['#6e6a88', '#aaa6c0', '#d6d4e6', '#eeedf6', '#ffffff']);
    var COAT = HS(['#14101a', '#1e1a24', '#2e2834', '#433a4a']), FUR = HS(['#3e3428', '#5a4a3a', '#7a6650', '#9a8468']), PIPE = HS(['#281d21', '#3e2a20', '#6a4630']);
    return {
      skin: S, face: FACES.square, eyeStyle: 'small', eyeC: EYEC.grey, hideEyeL: true,
      brows: { pts: [[-1, -2], [2, -3], [6, -2]], col: W[2], col2: W[0], thick: 2, taper: 0.1, noL: true, mod: { neutral: function (u) { return u > 0.6 ? 1 : 0; } } },
      mouths: { neutral: 'gdN', happy: 'gdH', sad: 'gdS', surprised: 'gdO', angry: 'gdA' },
      mouthLib: { gdN: ['bbbbbb'], gdNTalk: ['bbbbbb', 'bmmmmb', '.bbbb.'], gdH: ['b....b', '.bbbb.'], gdHTalk: ['bbbbbb', 'bttttb', '.bbbb.'], gdS: ['.bbbb.', 'b....b'], gdSTalk: ['.bbbb.', 'bmmmmb', '.bbbb.'], gdO: ['.bb.', 'bmmb', '.bb.'], gdOTalk: ['.bb.', 'bmmb', 'bmmb', '.bb.'], gdA: ['bbbbbb', 'btTtTb', 'bbbbbb'] },
      mouthLine: W[0], castRows: 1,
      body: function (P) {
        var B = P.B, M = torso(46, 10, 29, 7, 32);
        shadeFill(B, M, COAT, TAG.CLOTH, { cx: 16, cy: 44, rx: 34, ry: 26, edge: 0.35 });
        // heavy fur mantle around the shoulders
        var fur = M64().ellipse(32, 50, 24, 6.5).and(M.clone().or(M64().ellipse(32, 50, 24, 6.5)));
        fur.each(function (x, y) { var v = sph(x, y, 22, 44, 20, 10) + ((ti(x) * 3 + tj(y)) % 4 === 0 ? -0.35 : 0); B.set(x, y, v > 0.4 ? FUR[3] : v > -0.05 ? FUR[2] : v > -0.45 ? FUR[1] : FUR[0], TAG.CLOTH); });
        edgePx(fur, [[0, 1]]).forEach(function (p, i) { if (i % 2) B.set(p[0], p[1] + 1, FUR[1], TAG.CLOTH); });
        // guild emblem: crossed blades over a crescent
        stamp(B, ['s.....s', '.s...s.', '..s.s..', '...S...', '.Ms.sM.', 'M.....M', '.MMMMM.'], 16, 56, { s: SILVER[2], S: SILVER[3], M: H('#e8eeff') }, TAG.METAL);
        [[45, 58], [45, 61]].forEach(function (p) { B.set(p[0], p[1], SILVER[1], TAG.METAL); B.set(p[0] + 1, p[1], SILVER[2], TAG.METAL); });
      },
      skinDetail: function (P) {
        var B = P.B, S2 = P.skin, sc = mix(S2.l, H('#e0a0a0'), 0.4);
        // scars, crow's feet, eyepatch
        bez([[27, 33], [31, 37], [34, 41]]).forEach(function (p) { B.set(p[0], p[1], sc, TAG.SKIN); B.set(p[0] + 1, p[1], S2.d, TAG.SKIN); });
        [[38, 22], [39, 23], [40, 24]].forEach(function (p) { B.set(p[0], p[1], sc, TAG.SKIN); });
        sym(B, [[20, 30], [20, 32], [21, 34], [24, 37], [25, 38]], S2.s, TAG.SKIN);
        var pm = M64().poly([[21, 29], [29, 29], [29, 34], [26, 36], [22, 35], [21, 32]]);
        shadeFill(B, pm, HS(['#0b0711', '#1b1429', '#362a52']), TAG.ACC, { cx: 22, cy: 29, rx: 8, ry: 8 });
        bez([[28, 29], [33, 24], [39, 19]]).forEach(function (p) { B.set(p[0], p[1], OUT, TAG.ACC); });
        bez([[21, 31], [18, 30]]).forEach(function (p) { B.set(p[0], p[1], OUT, TAG.ACC); });
        stamp(B, ['..ll..', '..lbs.', '.llbss', 'lbbbss', 'dDbbDd'], 29, 33, { l: S2.l, b: S2.b, s: S2.s, d: S2.d, D: S2.line }, TAG.SKIN);
      },
      nose: false,
      front: function (P) {
        var B = P.B;
        // grizzled short hair, receding on top
        var hl = function (x) { var dx = x + 0.5 - 32; return 16 + 0.05 * dx * dx; };
        var hair = M64().ellipse(32, 24, 15, 13).keep(function (x, y) { var dx = Math.abs(x + 0.5 - 32); return y + 0.5 < hl(x) && (dx > 7 || y < 14); });
        hairClumps(B, hair, R, { px: 32, py: 26, aw: 0.3, ph: 0.3, cx: 24, cy: 14, rx: 20, ry: 16, k: 0.4, gap: 0.2 });
        hair.each(function (x, y) { if ((ti(x) + tj(y)) % 3 === 0) B.set(x, y, R[1], TAG.HAIR); });
        // white beard with one thick braid and a silver ring
        var top = function (x) { var dx = Math.abs(x + 0.5 - 32); return Math.max(30, 40 - Math.max(0, dx - 6) * 1.6); };
        var beard = M64().poly([[18, 29], [17, 38], [16, 46], [20, 52], [44, 52], [48, 46], [47, 38], [46, 29]]).keep(function (x, y) { return y >= top(x); });
        hairClumps(B, beard, W, { px: 32, py: 24, aw: 0.16, ph: 0.5, cx: 24, cy: 34, rx: 26, ry: 26, k: 0.5, gap: 0.16, tag: TAG.BEARD });
        innerLine(B, beard, W[0], function (t) { return t === TAG.SKIN; }, [[0, -1], [1, 0], [-1, 0]]);
        drawMouth(P, 0);
        var mo = M64().poly([[32, 38], [26, 38], [21, 41], [20, 45], [23, 44], [27, 41], [31, 41], [32, 40]]).sym();
        hairClumps(B, mo, [W[0], W[2], W[3], W[4], W[4]], { px: 32, py: 30, aw: 0.22, ph: 0.2, cx: 26, cy: 36, rx: 14, ry: 10, k: 0.3, gap: 0.15, tag: TAG.BEARD, th: [-0.3, 0.25] });
        innerLine(B, mo, W[0], function (t) { return t !== TAG.SKIN; }, [[0, 1], [1, 0], [-1, 0]]);
        braid(B, [[32, 50], [32, 57], [32, 64]], W, 5, { tag: TAG.BEARD, cuffs: [0.35], cuffC: SILVER, line: W[0] });
        // the pipe, with a wisp of smoke
        stamp(B, ['.....BBB', '....BbbB', 'pppPBbbB', '.....BB.'], 36, 40, { p: PIPE[2], P: PIPE[1], B: PIPE[0], b: H('#c44a3a') }, TAG.ACC);
        [[41, 38], [42, 36], [41, 34], [42, 32], [43, 30]].forEach(function (p, i) { B.set(p[0], p[1], i % 2 ? H('#a8a4bc') : H('#cfcbe0'), TAG.NORIM); });
      }
    };
  })();

  // ---- 20. The Night Merchant: peaked purple hood, face in shadow, softly glowing violet eyes, starlit cloak trim, silver crescent clasp
  NPC.nightmerchant = (function () {
    var S = skinR('#140e1e', '#1e162c', '#2a2040', { d: '#0e0a16', line: '#07040c', blush: '#2a2040', lip: '#3a2e48' });
    var HOOD = HS(['#140a22', '#22123a', '#341e58', '#4a2c7a']), CLK = HS(['#0b0711', '#140e1e', '#1f1830', '#2e2446']);
    var GL = { g: H('#6a48b0'), G: H('#b48cf0'), W: H('#f4ecff') }, SHIM = [H('#8f6cd1'), H('#e4d2ff'), H('#b99aee'), H('#c8d4f0')];
    var EYE = { neutral: ['.ggg.', 'gGWGg', '.ggg.'], happy: ['.GGG.', 'G...G', '.....'], sad: ['...gg', '.gGWG', 'gGg..'], surprised: ['.ggg.', 'gGWGg', 'gGWGg', '.ggg.'], angry: ['Gg...', '.GWGg', '...gG'], closed: ['.....', 'ggggg', '.....'] };
    function shimmer(B, pts, ph) { pts.forEach(function (p, i) { if ((i + ph) % 2 === 0) B.set(p[0], p[1], SHIM[(i >> 1) % 4], TAG.GLASS); }); }
    return {
      skin: S, face: FACES.narrow, eyeStyle: 'std', eyeC: EYEC.violet, hideEyeL: true, hideEyeR: true, ears: false, nose: false, brows: null,
      mouths: { neutral: 'nmN', happy: 'nmH', sad: 'nmS', surprised: 'nmO', angry: 'nmA' },
      mouthLib: { nmN: ['.DDDD.'], nmNTalk: ['.DDDD.', '.DmmD.'], nmH: ['D....D', '.DDDD.'], nmHTalk: ['D....D', '.DmmD.', '..DD..'], nmS: ['.DDDD.', 'D....D'], nmSTalk: ['.DDDD.', 'DmmmmD'], nmO: ['.DD.', 'DmmD', '.DD.'], nmOTalk: ['.DD.', 'DmmD', 'DmmD', '.DD.'], nmA: ['DDDDDD'], nmATalk: ['DDDDDD', 'DmmmmD', '.DDDD.'] },
      skinDetail: function (P) { // a moonlit hint of the lower face
        var B = P.B; P.faceM.each(function (x, y) { if (y < 37) return; var c = B.get(x, y); B.set(x, y, mix(c, x > 33 ? H('#4a3e5e') : H('#6a5a82'), Math.min(0.62, (y - 36) * 0.11)), TAG.SKIN); });
      },
      body: function (P) {
        var B = P.B, M = torso(47, 8, 23, 8, 26);
        shadeFill(B, M, CLK, TAG.CLOTH, { cx: 16, cy: 46, rx: 30, ry: 24, edge: 0.35 });
        shadeFill(B, M64().poly([[29, 49], [35, 49], [37, 64], [27, 64]]), HS(['#07040c', '#0e0a16', '#17101f']), TAG.CLOTH, { cx: 28, cy: 50, rx: 10, ry: 12 });
        shimmer(B, bez([[29, 49], [27, 64]]), 0); shimmer(B, bez([[35, 49], [37, 64]]), 1);
        shimmer(B, bez([[6, 63], [26, 63]]), 0); shimmer(B, bez([[38, 63], [58, 63]]), 1);
        [[14, 57], [47, 59], [20, 61], [43, 55]].forEach(function (p) { B.set(p[0], p[1], SHIM[2], TAG.GLASS); });
      },
      front: function (P) {
        var B = P.B;
        var outer = M64().ellipse(32, 30, 19.5, 21.5).or(M64().poly([[25, 11], [32, 1], [39, 11]])).or(torso(42, 13, 24, 6, 28).keep(function (x, y) { return y < 54; }));
        var open = M64().ellipse(32, 35, 11.5, 13.5), hood = outer.clone().sub(open);
        shadeFill(B, hood, HOOD, TAG.HAT, { cx: 22, cy: 12, rx: 28, ry: 32, edge: 0.4, th: [-0.3, 0.1, 0.55] });
        hood.each(function (x, y) { var dx = (x + 0.5 - 32) / 11.5, dy = (y + 0.5 - 35) / 13.5, d = dx * dx + dy * dy; if (d < 1.32 && y < 44) B.set(x, y, d < 1.14 ? H('#07040c') : HOOD[0], TAG.HAT); });
        strands(B, hood, [[[18, 44], [15, 49], [14, 53]], [[46, 44], [49, 49], [50, 53]], [[30, 6], [27, 14], [24, 20]]], HOOD[0], TAG.HAT);
        // starlight trim along the hood's edge
        var rim = []; for (var a = 0.15; a < Math.PI - 0.15; a += 0.07) rim.push([Math.round(32 - Math.cos(a) * 13.2), Math.round(35 - Math.sin(a) * 15.2)]);
        shimmer(B, rim.filter(function (p) { return hood.has(p[0], p[1]); }), 0);
        // silver crescent clasp
        stamp(B, ['.MM.', 'M.Mm', 'M...', '.MM.'], 30, 47, { M: H('#e8eeff'), m: H('#9fb0d8') }, TAG.METAL);
        // two softly glowing eyes, shaped by the mood
        var pat = P.blink ? EYE.closed : EYE[P.e] || EYE.neutral, ey = P.e === 'surprised' && !P.blink ? 31 : 32;
        stamp(B, pat, 23, ey, GL, TAG.GLASS); stamp(B, pat, 36, ey, GL, TAG.GLASS, true);
      }
    };
  })();

  // ---- generic villager (fallback for unknown ids)
  NPC._villager = (function () {
    var R = HAIR.brown, TUN = HS(['#3e2d2b', '#574039', '#7a5a48', '#9c7a5e']);
    return {
      skin: SKIN.fair, face: FACES.round, eyeStyle: 'std', eyeC: EYEC.brown,
      brows: { pts: [[0, -3], [3, -4], [6, -3]], col: R[1], thick: 1 },
      mouths: { neutral: 'smile', happy: 'grin', sad: 'frown', surprised: 'o', angry: 'frown' },
      body: function (P) { shadeFill(P.B, torso(47, 9, 25, 9, 28), TUN, TAG.CLOTH, { cx: 20, cy: 40, rx: 40, ry: 30 }); },
      front: function (P) {
        var hl = function (x) { var dx = x + 0.5 - 32; return 20 + 0.03 * dx * dx; };
        var M = M64().ellipse(32, 25, 15.5, 14).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        hairClumps(P.B, M, R, { px: 32, py: 10, aw: 0.25, ph: 0.4, cx: 25, cy: 14, rx: 18, ry: 16, shine: [32, 25, 10, 12], shineTest: function (x) { return x < 30; } });
        innerLine(P.B, M, R[0], function (t) { return t === TAG.SKIN; });
      }
    };
  })();

  /* ================================================================== portrait renderer */
  var EXPRS = ['neutral', 'happy', 'sad', 'surprised', 'angry'];
  function normExpr(e) { return EXPRS.indexOf(e) >= 0 ? e : 'neutral'; }
  function renderPortrait(def, expr, opt, style) {
    opt = opt || {};
    var ST = style ? PSTYLES[style] : null;
    if (ST && ST.human) return renderHuman(def, expr, opt, ST);
    var f0 = ST && ST.round ? roundFace(def.face, ST.round) : def.face;
    var P = { B: new Buf(64, 64), d: def, e: normExpr(expr), blink: !!opt.blink, talk: !!opt.talk, skin: ST ? softSkin(def.skin, ST) : def.skin, f: ST && ST.close ? closeFace(f0) : f0, eyeC: def.eyeC, lash: def.lash, style: ST };
    CUR_STYLE = ST;
    if (ST && ST.close) { XF = closeXF(f0, ST); P.B.xf = true; }
    try {
    if (def.back) def.back(P);
    drawNeck(P);
    if (def.body) def.body(P);
    if (def.ears !== false) (def.drawEars || drawEars)(P);
    paintFace(P);
    if (def.skinDetail) def.skinDetail(P);
    drawEyes(P);
    drawBrows(P);
    drawNose(P);
    if (!def.mouthLine) drawMouth(P, 0);
    if (def.front) def.front(P);
    castShadow(P, def.castRows);
    if (ST) blushS(P);
    if (def.post) def.post(P);
    rimPass(P.B, XF ? P.B.h : 60, ST ? ST.rim : undefined);
    var S = P.skin;
    if (ST) outlinePassS(P); else outlinePass(P.B, function (t) { return t === TAG.SKIN ? S.line : OUT; });
    } finally { CUR_STYLE = null; XF = null; }
    return P.B;
  }

  /* ================================================================== styled portraits (prototype) */
  // A softer base rendering layered under every character's own design. With P.style set, the shared
  // face/eye/brow/nose/mouth/shadow/outline steps dispatch here; hair gains strand highlights.
  //   valley - Stardew-faithful: soft 5-tone skin, glossy eyes with warm-brown lashes, tinted lips
  //   sweet  - valley on a rounder face, a little larger eyes, more blush
  //   soft   - lineless inside the face: colour and shading only, outline on the silhouette
  var PSTYLES = {
    valley: { name: 'valley', grow: 0, round: 0, blush: 0.3, blushRows: 1, lineless: false, rim: 0.8 },
    sweet: { name: 'sweet', grow: 1, round: 0.35, blush: 0.42, blushRows: 2, lineless: false, rim: 0.8 },
    soft: { name: 'soft', grow: 1, round: 0.2, blush: 0.36, blushRows: 2, lineless: true, rim: 0.7 },
    close: { name: 'close', close: true, zoom: 1.32, chinY: 52, ew: 7, eh: 3, iwMax: 4, spread: 0.88, eyeDY: -1, grow: 0, round: 0, blush: 0.4, blushRows: 1, lineless: false, rim: 0.8 },
    close_sweet: { name: 'close_sweet', close: true, zoom: 1.32, chinY: 52, ew: 8, eh: 4, iwMax: 5, spread: 0.88, eyeDY: -1, grow: 1, round: 0.3, blush: 0.5, blushRows: 2, lineless: false, rim: 0.8 },
    human: { name: 'human', human: true, W: 64, blushRows: 1, rim: 0.7 },
    human_hd: { name: 'human_hd', human: true, hd: true, W: 96, zoom: 1.5, blushRows: 2, rim: 0.7 }
  };
  var CUR_STYLE = null;
  // per-character hints for the styled renderer only (the default renderer ignores them)
  [['ronan', 0.35], ['brann', 0.3], ['gideon', 0.25], ['orvyn', 0.4], ['corvin', 0.3], ['lune', 0.4], ['elvis', 0.45], ['caspian', 0.45], ['fennick', 0.6], ['grizelda', 0.3], ['nightmerchant', 0]].forEach(function (h) { if (NPC[h[0]]) NPC[h[0]].blushK = h[1]; });
  NPC.ronan.browKeep = true;
  // the human styles read these: masc (finer lashes, a smaller iris), old (soft lids)
  [['pip', { masc: 1, kid: 1 }], ['brann', { masc: 1 }], ['orvyn', { masc: 1, old: 1 }], ['corvin', { masc: 1 }], ['lune', { masc: 1 }], ['elvis', { masc: 1 }], ['fennick', { masc: 1 }], ['ronan', { masc: 1 }], ['caspian', { masc: 1 }], ['gideon', { masc: 1, old: 1 }], ['mirabel', { old: 1 }], ['grizelda', { old: 1 }], ['isolde', { old: 1 }]].forEach(function (h) { if (NPC[h[0]]) NPC[h[0]].hum = h[1]; });
  function softSkin(S, ST) {
    var o = {}, k;
    for (k in S) if (S.hasOwnProperty(k)) o[k] = S[k];
    o.m = mix(S.b, S.s, 0.5);
    o.d = mix(S.s, S.d, 0.5);
    o.outline = mix(S.s, H('#3a1420'), 0.62);
    o.line = ST.lineless ? mix(S.s, o.outline, 0.35) : mix(S.s, o.outline, 0.7);
    o.blush = mix(S.b, H('#ff6f86'), ST.blush);
    o.lip = mix(mix(S.b, S.s, 0.3), H('#e0607a'), 0.42);
    o.lipD = mix(o.lip, o.outline, 0.4);
    return o;
  }
  function roundFace(f, k) { // fuller cheeks and a softer chin below the jaw line
    var hw = f.hw.slice(), n = hw.length, mx = Math.max.apply(null, hw), j0 = Math.max(0, f.jaw - f.top - 2);
    for (var i = j0; i < n; i++) { var t = (i - j0) / Math.max(1, n - 1 - j0); hw[i] = Math.min(mx, Math.round(hw[i] + (mx - hw[i]) * k * (1 - t * 0.35) + (i === n - 1 ? 1 : 0))); }
    return { top: f.top, hw: hw, jaw: f.jaw + 1, eyeX: f.eyeX, eyeY: f.eyeY, noseY: f.noseY, mouthY: f.mouthY, earY: f.earY };
  }
  function paintFaceS(P) { // smooth light from the upper left; no hard shadow blocks
    var f = P.f, S = P.skin, B = P.B, M = faceMask(f);
    P.faceM = M;
    M.each(function (x, y) {
      var hw = f.hw[y - f.top], fromR = 31 + hw - x, v = 0.86 - 0.03 * (x - 24) - 0.018 * (y - 22);
      if (fromR < 3) v -= (3 - fromR) * 0.07;
      var e = steps(M, x, y, 0, 1, 3); if (e <= 2) v -= (3 - e) * 0.09;
      B.set(x, y, v > 0.78 ? S.l : v > 0.34 ? S.b : v > 0.12 ? S.m : v > -0.15 ? S.s : S.d, TAG.SKIN);
    });
  }
  function drawNeckS(P) {
    var f = P.f, S = P.skin, B = P.B, hw = P.d.neckW || 5, y0 = f.top + f.hw.length - 6;
    for (var y = y0; y <= 58; y++) for (var x = 32 - hw; x < 32 + hw; x++) {
      var r = y - y0, c = r >= 6 && r < 8 ? S.s : S.m;
      if (x >= 31 + hw - 1) c = S.s; else if (x <= 32 - hw && r > 8) c = S.b;
      B.set(x, y, c, TAG.SKIN);
    }
  }
  function drawEarsS(P) {
    if (P.style.human) return drawEarsH(P);
    var f = P.f, S = P.skin, B = P.B, y = f.earY, hw = f.hw[y - f.top], lg = { b: S.b, l: S.l, m: S.m, s: S.s };
    stamp(B, ['.bb', 'blm', 'bms', 'bms', 'mss', '.mm', '..m'], 32 - hw - 3, y, lg, TAG.SKIN);
    stamp(B, ['mm.', 'ssm', 'sms', 'sms', 'ssm', 'mm.', 'm..'], 32 + hw, y, lg, TAG.SKIN);
  }
  function castShadowS(P, rows) { // hair and hats shade the brow softly
    if (P.style.close) return castShadowC(P, rows);
    var B = P.B, S = P.skin, hits = [];
    rows = rows || 2;
    for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) {
      if (B.tg(x, y) !== TAG.SKIN) continue;
      var c = B.get(x, y); if (c !== S.b && c !== S.l && c !== S.m) continue;
      for (var k = 1; k <= rows; k++) { var t = B.tg(x - (k > 1 ? 1 : 0), y - k); if (t === TAG.HAIR || t === TAG.HAT) { hits.push(x, y, k); break; } }
    }
    for (var i = 0; i < hits.length; i += 3) { var c2 = B.get(hits[i], hits[i + 1]); B.set(hits[i], hits[i + 1], hits[i + 2] === 1 ? (c2 === S.m ? S.s : S.m) : (c2 === S.l ? S.b : S.m), TAG.SKIN); }
  }
  function growRows(rows) { var last = -1; for (var r = 0; r < rows.length; r++) if (rows[r].indexOf('W') >= 0) last = r; if (last < 0) return rows; var o = rows.slice(); o.splice(last + 1, 0, rows[last]); return o; }
  function drawEyeS(P, rows, x, y, flip, iw, ic, gaze) { // glossy eye: warm lashes, gradient iris, 2px highlight + glint
    var B = P.B, S = P.skin, ST = P.style;
    var lash = ST.lineless ? mix(mix(H('#4a2430'), ic[0], 0.2), S.s, 0.35) : mix(H('#3c1c22'), ic[0], 0.25);
    var leg = { K: [lash, TAG.EYE], k: [ST.lineless ? S.m : mix(S.s, S.b, 0.3), TAG.EYE], W: [H('#f7f6fc'), TAG.EYE], w: [H('#d4d6e8'), TAG.EYE], s: [S.s, TAG.SKIN], d: [S.s, TAG.SKIN], l: [S.l, TAG.SKIN], q: [S.s, TAG.EYE], v: [mix(S.m, H('#8a6ab0'), 0.18), TAG.SKIN] };
    stamp(B, rows, x, y, leg, TAG.EYE, flip);
    var cells = eyeCells(rows), w = stampW(rows);
    if (!cells.length) return;
    var minX = 99, maxX = -1, minY = 99, maxY = -1;
    cells.forEach(function (c) { var cx = flip ? w - 1 - c[0] : c[0]; minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); });
    var ih = maxY - minY + 1, ix0 = Math.round((minX + maxX + 1) / 2 - iw / 2) + (gaze || 0);
    ix0 = Math.max(minX - 1, Math.min(maxX - iw + 2, ix0));
    var midC = mix(ic[0], ic[1], 0.5), pr = ih >= 4 ? Math.floor(ih / 2) : 1;
    cells.forEach(function (c) {
      var cx = flip ? w - 1 - c[0] : c[0], cy = c[1];
      if (cx < ix0 || cx >= ix0 + iw) return;
      var r = cy - minY, col = r <= 0 ? ic[0] : r === ih - 1 && ih > 2 ? ic[2] : r === 1 && ih > 3 ? midC : ic[1];
      if (ih >= 3 && (r === pr || (ih >= 5 && r === pr - 1)) && cx >= ix0 + Math.floor((iw - 1) / 2) && cx <= ix0 + Math.floor(iw / 2)) col = ic[3];
      B.set(x + cx, y + cy, col, TAG.EYE);
    });
    var hy = minY + (ih >= 4 ? 1 : 0), isIris = function (px, py) { var c = B.get(x + px, y + py); return B.tg(x + px, y + py) === TAG.EYE && c !== H('#f7f6fc') && c !== H('#d4d6e8') && c !== lash; };
    var scl = B.get(x + ix0 - 1, y + hy), hx = iw >= 3 && (scl === H('#f7f6fc') || scl === H('#d4d6e8')) ? ix0 + 1 : ix0;
    if (isIris(hx, hy)) B.set(x + hx, y + hy, WHITE, TAG.EYE);
    if (hx === ix0 + 1) { if (iw >= 4 && isIris(hx + 1, hy)) B.set(x + hx + 1, y + hy, mix(WHITE, ic[2], 0.25), TAG.EYE); }
    else if (iw >= 3 && isIris(ix0 + 1, hy)) B.set(x + ix0 + 1, y + hy, mix(WHITE, ic[2], 0.25), TAG.EYE);
    else if (ih >= 4 && isIris(ix0, hy + 1)) B.set(x + ix0, y + hy + 1, mix(WHITE, ic[2], 0.25), TAG.EYE);
    if (ih >= 3 && B.get(x + ix0 + iw - 1, y + maxY) === ic[2]) B.set(x + ix0 + iw - 1, y + maxY, mix(ic[2], WHITE, 0.55), TAG.EYE);
  }
  function drawEyesS(P) {
    if (P.style.close) return drawEyesC(P);
    var d = P.d, E = EYES[d.eyeStyle] || EYES.std, f = P.f, ST = P.style;
    var rowsL = (d.eyeRows && d.eyeRows(P, 'L', E)) || exprEyeRows(P, E), rowsR = (d.eyeRows && d.eyeRows(P, 'R', E)) || exprEyeRows(P, E);
    var wide = rowsL === E.wide;
    if (ST.grow) { rowsL = growRows(rowsL); rowsR = growRows(rowsR); }
    var iw = Math.min(5, ((P.e === 'surprised' && !P.blink) ? (E.wideIris || E.iris) : E.iris) + (ST.grow && E.iris < 4 ? 1 : 0));
    var gaze = d.gaze ? d.gaze(P) : 0, ex = f.eyeX, ey = f.eyeY, dy = (wide && E.wideDY) ? E.wideDY : 0, wR = stampW(rowsR);
    if (!d.hideEyeL) drawEyeS(P, rowsL, ex, ey + dy, false, iw, P.eyeC, gaze);
    if (!d.hideEyeR) drawEyeS(P, rowsR, 63 - ex - (wR - 1), ey + dy, true, iw, P.eyeC, gaze);
  }
  function drawBrowsS(P) { // thin, soft, a shade darker than the hair
    if (P.style.close) return drawBrowsC(P);
    var spec = P.d.brows; if (!spec) return;
    var S = P.skin, soft = function (c) { return lum(c) < 0.3 ? mix(c, S.m, P.style.lineless ? 0.4 : 0.25) : c; };
    var th = spec.thick === 3 || (spec.thick === 2 && P.d.browKeep) ? 2 : 1, sp2 = {}, k;
    for (k in spec) sp2[k] = spec[k];
    sp2.thick = th; sp2.col = soft(spec.col); sp2.col2 = soft(spec.col2 != null ? spec.col2 : spec.col);
    var d0 = P.d, tmp = {}; for (k in d0) tmp[k] = d0[k]; tmp.brows = sp2;
    var Q = {}; for (k in P) Q[k] = P[k]; Q.d = tmp; Q.style = null;
    drawBrows(Q);
  }
  function drawNoseS(P) { // a pixel or two of soft shadow
    if (P.style.close) return drawNoseC(P);
    var d = P.d; if (d.nose === false) return;
    var rows = typeof d.nose === 'object' ? d.nose : NOSES[d.nose || 'button'], S = P.skin, x = d.noseX != null ? d.noseX : 31, ty = P.f.noseY + rows.length - 1;
    if (P.style.lineless) { P.B.set(x + 1, ty, S.m, TAG.SKIN); return; }
    P.B.set(x + 1, ty, S.s, TAG.SKIN); P.B.set(x, ty - 1, S.l, TAG.SKIN);
  }
  function drawMouthS(P, dy) { // same shapes, tinted lips instead of dark lines
    if (P.style.close) return drawMouthC(P, dy);
    if (P.style.human) return drawMouthH(P, dy);
    var rows = mouthRows(P); if (!rows) return;
    var d = P.d, S = P.skin, ST = P.style, w = stampW(rows), x = 32 - Math.ceil(w / 2) + (d.mouthDX || 0), y = P.f.mouthY + (dy || 0);
    var line = ST.lineless ? mix(S.lip, S.b, 0.15) : mix(S.lipD, S.line, 0.25);
    stamp(P.B, rows, x, y, {
      D: [line, TAG.MOUTH], d: [S.s, TAG.MOUTH], s: [mix(S.lip, S.b, 0.45), TAG.SKIN], l: [S.l, TAG.SKIN], m: [ST.lineless ? H('#8a3a4a') : H('#6a2a3a'), TAG.MOUTH], t: [H('#fbf8fc'), TAG.MOUTH],
      T: [H('#dcd6e6'), TAG.MOUTH], u: [H('#e07a96'), TAG.MOUTH], g: [GOLD[2], TAG.MOUTH], G: [GOLD[1], TAG.MOUTH], p: [S.lip, TAG.MOUTH], P: [S.lipD, TAG.MOUTH],
      b: [d.mouthLine ? mix(d.mouthLine, S.b, 0.15) : line, TAG.MOUTH], L: [mix(S.lip, WHITE, 0.4), TAG.MOUTH]
    }, TAG.MOUTH, d.mouthFlip);
  }
  function blushS(P) { // a soft rosy cheek below each eye (skin pixels only)
    if (P.style.close) return blushC(P);
    var B = P.B, S = P.skin, ST = P.style, f = P.f, k = P.d.blushK != null ? P.d.blushK : 1;
    if (k <= 0) return;
    var ex = f.eyeX, ey = f.eyeY + 6 + (ST.grow ? 1 : 0), c1 = mix(S.b, S.blush, Math.min(1, k)), c2 = mix(S.b, S.blush, Math.min(1, k) * 0.5);
    var pts = [[1, 0, c1], [2, 0, c1], [3, 0, c1], [0, 0, c2], [4, 0, c2]];
    if (ST.blushRows > 1) pts = pts.concat([[1, 1, c2], [2, 1, c1], [3, 1, c2]]);
    pts.forEach(function (p) {
      [ex + p[0], 63 - (ex + p[0])].forEach(function (xx) { var yy = ey + p[1], c = B.get(xx, yy); if (B.tg(xx, yy) === TAG.SKIN && (c === S.b || c === S.l || c === S.m)) B.set(xx, yy, p[2], TAG.SKIN); });
    });
  }
  function outlinePassS(P) { // hue-shifted per region, never black
    var S = P.skin;
    outlinePass(P.B, function (t, c) { return t === TAG.SKIN ? S.outline : mix(c, H('#1e0e1a'), 0.72); });
  }
  function rawPortraitStyled(style, id, v, expr, opts) { return toRaw(renderPortrait(resolveDef(NPC, id, v), expr, opts, PSTYLES.hasOwnProperty(style) ? style : 'valley')); }
  function rawPlayerPortraitStyled(style, look, expr, opts) { var d = playerDef(normLook(look)); d.blushK = 0.6; return toRaw(renderPortrait(d, expr, opts, PSTYLES.hasOwnProperty(style) ? style : 'valley')); }

  /* ================================================================== close-up portraits (prototype) */
  // 'close' / 'close_sweet': the valley rendering framed like a Stardew close-up. XF zooms each
  // character's own back/body/front code so the head fills the frame (face ~31px wide, chin near y52,
  // just the neck and shoulder tops below); eyes, brows, nose, mouth and blush are redrawn at frame
  // scale with Haley-sized templates anchored to the zoomed face.
  function closeXF(f, ST) { return { s: ST.zoom, px: 32, PX: 32, py: f.top + f.hw.length, PY: ST.chinY }; }
  function closeFace(f) { // half-widths readable at fractional rows: smooth cheeks, soft tapered chin
    var hw = f.hw.slice(), n = hw.length;
    function at(i) {
      if (i < -0.5 || i > n - 0.5) return undefined;
      if (i <= 0) return hw[0];
      if (i >= n - 1) return hw[n - 1] * (1 - (i - (n - 1)) * 0.9);
      var a = Math.floor(i), t = i - a; return hw[a] + (hw[a + 1] - hw[a]) * t;
    }
    var o = {}, k; for (k in f) o[k] = f[k];
    o.hw = new Proxy(hw, { get: function (t, key) { if (typeof key === 'string' && key !== '' && !isNaN(+key)) return at(+key); return t[key]; } });
    return o;
  }
  var CEYE = { // design eye style -> close-up eye tweaks (opening w/h deltas, flick, lids, crease, bags...)
    std: {}, kind: { hood: 1, smile: 1, soft: 1 }, kid: { h: 1 }, almond: { flick: 2, thick: 1 }, small: { w: -1 }, twinkle: { smile: 1 },
    doe: { h: 1, lashes: 1 }, beady: { w: -1, sock: 1 }, tired: { lid: 1, bags: 1 }, sharp: { thick: 1, lidIn: 1 }, star: { glint: 1 },
    lidded: { lid: 1, flick: 2 }, soft: { lid: 1, flick: 2, lower: 1 }, cute: { h: 1 }, cutewing: { h: 1, flick: 2 }, cutelid: { h: 1, lid: 1 }
  };
  function closeEyeSpec(style, ST) {
    var c = CEYE[style] || {}, o = { w: ST.ew + (c.w || 0), h: ST.eh + (c.h || 0) }, k;
    for (k in c) if (k !== 'w' && k !== 'h') o[k] = c[k];
    o.flick = o.flick || 1;
    o.iw = Math.min(ST.iwMax || 4, Math.max(3, o.w - 3));
    return o;
  }
  // left eye, outer corner at the LEFT. K lash, w/W sclera (shaded/lit), k lower lid, L lid skin,
  // c lid crease, q lower lash, v under-eye shade, d socket shadow. Opening cells come back for the iris.
  function closeEyeTpl(st, mode) {
    var w = st.w, h = st.h + (mode === 'wide' ? 1 : 0), left = 2, top = 4, TW = left + w + 1, TH = top + h + 3, g = [], r, c;
    for (r = 0; r < TH; r++) { g.push([]); for (c = 0; c < TW; c++) g[r].push('.'); }
    function put(cc, rr, ch) { cc += left; rr += top; if (rr >= 0 && rr < TH && cc >= 0 && cc < TW) g[rr][cc] = ch; }
    function get(cc, rr) { cc += left; rr += top; return rr >= 0 && rr < TH && cc >= 0 && cc < TW ? g[rr][cc] : '.'; }
    var open = [];
    if (mode === 'happy') { // closed, smiling arc
      var a0 = Math.max(0, h - 3);
      for (c = 2; c <= w - 3; c++) put(c, a0, 'K');
      put(1, a0 + 1, 'K'); put(w - 2, a0 + 1, 'K'); put(0, a0 + 2, 'K'); put(w - 1, a0 + 2, 'K'); put(-1, a0 + 1, 'K');
    } else if (mode === 'closed') {
      put(0, h - 2, 'K'); put(-1, h - 2, 'K'); for (c = 1; c <= w - 2; c++) put(c, h - 1, 'K'); put(w - 1, h - 2, 'K');
      for (c = 2; c <= w - 3; c++) put(c, h, 'k');
    } else {
      var lid = st.lid || 0, lr = -1 + lid;
      for (r = 0; r < h; r++) for (c = 1; c <= (r === h - 1 ? w - 2 : w - 1); c++) put(c, r, 'W');
      for (r = 0; r < lid; r++) for (c = 0; c <= w - 1; c++) put(c, r, 'L');
      for (c = 0; c <= w - 1; c++) put(c, lr, 'K');
      put(0, lr + 1, 'K'); if (st.thick) put(1, lr + 1, 'K');
      if (!st.hood) for (c = 0; c <= Math.floor(w / 3); c++) put(c, lr - 1, 'K'); // the line thickens towards the outer corner
      for (c = 1; c <= w - 1; c++) if (get(c, lr + 1) === 'W') put(c, lr + 1, 'w');
      if (st.flick >= 2) { put(-1, lr - 1, 'K'); put(-2, lr - 2, 'K'); put(-1, lr, 'K'); } else put(-1, lr - (st.hood ? 1 : 2), 'K');
      if (st.lashes) put(Math.floor(w / 2), lr - 1, 'K');
      if (mode === 'sad') for (c = 1; c < Math.floor(w / 2); c++) if (get(c, lr + 1) === 'w') put(c, lr + 1, 'K');
      if (mode === 'angry') for (c = Math.ceil(w / 2); c <= w - 1; c++) { if (get(c, lr + 1) === 'w') put(c, lr + 1, 'K'); }
      else if (st.lidIn) for (c = w - 2; c <= w - 1; c++) if (get(c, lr + 1) === 'w') put(c, lr + 1, 'K');
      if (st.smile) for (c = 1; c <= w - 2; c++) if (get(c, h - 1) === 'W') put(c, h - 1, 'k');
      for (c = 2; c <= w - 2; c++) put(c, h, 'k');
      if (st.lower) { put(0, h - 1, 'q'); put(1, h, 'q'); }
      if (st.sock) { put(w, lr + 1, 'd'); put(w, lr + 2, 'd'); put(0, h, 'd'); put(1, h, 'd'); put(w - 1, h, 'd'); }
      if (st.bags) for (c = 1; c <= w - 2; c++) put(c, h + 1, 'v');
      if (st.hood) for (c = 2; c <= w - 2; c++) put(c, lr - 2, 'c');
      for (r = lr + 1; r < h; r++) for (c = 0; c < w; c++) { var ch = get(c, r); if (ch === 'W' || ch === 'w') open.push([c, r]); }
    }
    return { rows: g.map(function (row) { return row.join(''); }), left: left, top: top, w: w, h: h, open: open };
  }
  function closeEyeGeom(P) {
    var d = P.d, E = EYES[d.eyeStyle] || EYES.std, f = P.f, cells = eyeCells(E.open), minX = 99, maxX = -1, minY = 99, maxY = -1, kr = 0, r;
    cells.forEach(function (c) { minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]); minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]); });
    for (r = 0; r < E.open.length; r++) if (E.open[r].indexOf('K') >= 0) { kr = r; break; }
    var st = closeEyeSpec(d.eyeStyle, P.style), Xc = 32 + (fxX(f.eyeX + (minX + maxX + 1) / 2) - 32) * (P.style.spread || 1), Yc = fxY(f.eyeY + (minY + maxY + 1) / 2) + (P.style.eyeDY || 0);
    var X0 = Math.round(Xc - st.w / 2), Y0 = Math.round(Yc - st.h / 2);
    return { st: st, X0: X0, Y0: Y0, Xc: X0 + st.w / 2, ocx: (minX + maxX + 1) / 2, kr: kr, E: E };
  }
  function closeEyeLegend(P, ic, st) {
    var S = P.skin, lash = mix(H('#3c1c22'), ic[0], 0.25);
    if (st && st.soft) lash = mix(lash, S.s, 0.3); // gentler lashes for older, kindly eyes
    return { lash: lash, leg: { K: [lash, TAG.EYE], W: [H('#f6f4fb'), TAG.EYE], w: [H('#d6d4e6'), TAG.EYE], k: [mix(S.s, lash, 0.3), TAG.EYE], L: [S.m, TAG.SKIN], c: [mix(S.m, S.s, 0.5), TAG.SKIN],
      q: [mix(lash, S.s, 0.4), TAG.EYE], v: [mix(S.m, H('#8a6ab0'), 0.2), TAG.SKIN], d: [mix(S.s, S.d, 0.5), TAG.SKIN] } };
  }
  function paintIrisC(B, T, ox, oy, flip, st, ic, gaze, wide) {
    if (!T.open.length) return;
    var TW = T.rows[0].length, set = {}, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    T.open.forEach(function (p) {
      var tc = p[0] + T.left, X = flip ? ox + (TW - 1 - tc) : ox + tc, Y = oy + p[1] + T.top;
      set[X + ',' + Y] = 1; minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
    });
    var iw = Math.min(st.iw, maxX - minX + 1), ix0 = Math.round((minX + maxX + 1) / 2 - iw / 2) + (gaze || 0);
    ix0 = Math.max(minX, Math.min(maxX - iw + 1, ix0));
    var iy0 = minY + (wide ? 1 : 0), ih = maxY - iy0 + 1, mid = mix(ic[0], ic[1], 0.5), x, y;
    var pc0 = ix0 + Math.floor((iw - 1) / 2), pc1 = ix0 + Math.floor(iw / 2), pr0 = iy0 + (ih >= 3 ? 1 : ih - 1), pr1 = ih >= 4 && !wide ? pr0 + 1 : pr0;
    for (y = iy0; y <= maxY; y++) for (x = ix0; x < ix0 + iw; x++) {
      if (!set[x + ',' + y]) continue;
      var r = y - iy0, col = r === 0 ? mix(ic[0], ic[1], 0.35) : (r === ih - 1 && ih >= 3) ? ic[2] : (r === 1 && ih >= 4) ? mid : ic[1];
      if (x >= pc0 && x <= pc1 && y >= pr0 && y <= pr1) col = ic[3];
      B.setF(x, y, col, TAG.EYE);
    }
    var hy = iy0 + (ih >= 3 ? 1 : 0);
    if (set[ix0 + ',' + hy]) B.setF(ix0, hy, WHITE, TAG.EYE);
    if (iw >= 4 && set[(ix0 + 1) + ',' + iy0]) B.setF(ix0 + 1, iy0, mix(WHITE, ic[2], 0.2), TAG.EYE);
    if (st.glint && set[(ix0 + 1) + ',' + (hy + 1)]) B.setF(ix0 + 1, hy + 1, mix(WHITE, ic[2], 0.4), TAG.EYE);
    var gx = ix0 + iw - 1, gy = iy0 + ih - 1;
    if (ih >= 3 && set[gx + ',' + gy]) B.setF(gx, gy, mix(ic[2], WHITE, 0.6), TAG.EYE);
  }
  function drawEyesC(P) {
    var d = P.d, g = closeEyeGeom(P), st = g.st, e = P.e, wide = e === 'surprised' && !P.blink;
    P.ceye = g;
    var mode = P.blink ? 'closed' : e === 'happy' ? 'happy' : wide ? 'wide' : e === 'sad' ? 'sad' : e === 'angry' ? 'angry' : 'open';
    var T = closeEyeTpl(st, mode), TW = T.rows[0].length, ox = g.X0 - T.left, oy = g.Y0 - T.top - (wide ? 1 : 0), L = closeEyeLegend(P, P.eyeC, st);
    var gaze = d.gaze ? d.gaze(P) : 0, oxR = 63 - (ox + TW - 1);
    if (!d.hideEyeL) { stampF(P.B, T.rows, ox, oy, L.leg, TAG.EYE, false); paintIrisC(P.B, T, ox, oy, false, st, P.eyeC, gaze, wide); }
    if (!d.hideEyeR) { stampF(P.B, T.rows, oxR, oy, L.leg, TAG.EYE, true); paintIrisC(P.B, T, oxR, oy, true, st, P.eyeC, gaze, wide); }
    if (P.tears) [[1, 0], [1, 1], [0, 2]].forEach(function (q, i) {
      var y = g.Y0 + st.h + q[1], c = i % 2 ? H('#8cc4f0') : H('#c4e6ff');
      if (!d.hideEyeL) P.B.setF(g.X0 + q[0], y, c, TAG.EYE);
      if (!d.hideEyeR) P.B.setF(63 - (g.X0 + q[0]), y, c, TAG.EYE);
    });
  }
  function drawBrowsC(P) { // thin, 4-6px, a shade darker than the hair, a little above the lash line
    var spec = P.d.brows; if (!spec) return;
    var g = P.ceye || closeEyeGeom(P), S = P.skin, B = P.B, pts = browPts(P, spec), lashY = g.Y0 - 1;
    var col = lum(spec.col) < 0.3 ? mix(spec.col, S.m, 0.22) : spec.col, col2 = spec.col2 != null ? (lum(spec.col2) < 0.3 ? mix(spec.col2, S.m, 0.22) : spec.col2) : col;
    var th = spec.thick === 3 || (spec.thick === 2 && P.d.browKeep) ? 2 : 1, kx = P.style.browK || 0.78;
    var fp = pts.map(function (p) { return [Math.round(g.Xc - 0.5 + (p[0] - g.ocx + 0.5) * kx), lashY - (g.kr - p[1]) - (P.style.browUp || 0)]; });
    var path = bezCore(fp);
    var minx = 1e9, maxx = -1e9; path.forEach(function (p) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); });
    var aL = (spec.asymL && spec.asymL[P.e]) || 0, aR = (spec.asymR && spec.asymR[P.e]) || 0, taper = spec.taper != null ? spec.taper : 0.25;
    path.forEach(function (p) {
      var u = (p[0] - minx) / Math.max(1, maxx - minx);
      for (var k = 0; k < th; k++) {
        if (k > 0 && u <= taper) continue;
        var c = k === th - 1 && k > 0 ? col2 : col;
        if (!spec.noL) B.setF(p[0], p[1] + k + aL, c, TAG.BROW);
        if (!spec.noR) B.setF(63 - p[0], p[1] + k + aR, c, TAG.BROW);
      }
    });
  }
  function drawNoseC(P) { // a 1-2px shadow on the shaded side plus the tip
    var d = P.d; if (d.nose === false) return;
    var rows = typeof d.nose === 'object' ? d.nose : NOSES[d.nose || 'button'], S = P.skin, B = P.B, x = d.noseX != null ? d.noseX : 31;
    var tx = ptX(x + 1), ty = ptY(P.f.noseY + rows.length - 1) + (P.style.noseDY || 0);
    B.setF(tx, ty - 2, S.m, TAG.SKIN); B.setF(tx, ty - 1, S.s, TAG.SKIN);
    B.setF(tx, ty, mix(S.s, S.d, 0.35), TAG.SKIN); B.setF(tx - 1, ty, S.m, TAG.SKIN);
    B.setF(tx - 1, ty - 3, S.l, TAG.SKIN);
  }
  function drawMouthC(P, dy) { // the character's own mouth shapes at frame scale, lip-tinted, 1px highlight
    var rows = mouthRows(P); if (!rows) return;
    var d = P.d, S = P.skin, w = stampW(rows), B = P.B, X0 = 32 - Math.ceil(w / 2) + Math.round((d.mouthDX || 0) * XF.s), Y0 = ptY(P.f.mouthY + (dy || 0)) + (P.style.mouthDY || 0);
    var line = mix(S.lipD, S.line, 0.25), lipS = mix(S.lip, S.b, 0.35);
    stampF(B, rows, X0, Y0, {
      D: [line, TAG.MOUTH], d: [S.s, TAG.MOUTH], s: [lipS, TAG.SKIN], l: [S.l, TAG.SKIN], m: [H('#6a2a3a'), TAG.MOUTH], t: [H('#fbf8fc'), TAG.MOUTH],
      T: [H('#dcd6e6'), TAG.MOUTH], u: [H('#e07a96'), TAG.MOUTH], g: [GOLD[2], TAG.MOUTH], G: [GOLD[1], TAG.MOUTH], p: [S.lip, TAG.MOUTH], P: [S.lipD, TAG.MOUTH],
      b: [d.mouthLine ? mix(d.mouthLine, S.b, 0.15) : line, TAG.MOUTH], L: [mix(S.lip, WHITE, 0.4), TAG.MOUTH]
    }, TAG.MOUTH, d.mouthFlip);
    for (var r = rows.length - 1; r >= 0; r--) { // 1px highlight on the lower lip
      var cols = []; for (var i = 0; i < rows[r].length; i++) if (rows[r].charAt(i) === 's' || rows[r].charAt(i) === 'p') cols.push(i);
      if (cols.length >= 2) { var ci = cols[Math.floor((cols.length - 1) / 2)]; B.setF(d.mouthFlip ? X0 + (w - 1 - ci) : X0 + ci, Y0 + r, mix(S.lip, WHITE, 0.38), TAG.MOUTH); break; }
    }
  }
  function blushC(P) { // 2-3px of rose on each cheek, under the outer half of each eye
    var k = P.d.blushK != null ? P.d.blushK : 1; if (k <= 0) return;
    var g = P.ceye || closeEyeGeom(P), B = P.B, S = P.skin, ST = P.style, big = P.blushBig || P.e === 'happy';
    var c1 = mix(S.b, S.blush, Math.min(1, k)), c2 = mix(S.b, S.blush, Math.min(1, k) * 0.5), y = g.Y0 + g.st.h + 2 + (ST.blushDY || 0), x = Math.round(g.Xc) - 2;
    var pts = [[0, 0, c2], [1, 0, c1], [2, 0, c1], [3, 0, c2]];
    if (ST.blushRows > 1 || big) pts = pts.concat([[1, 1, c2], [2, 1, c2]]);
    pts.forEach(function (p) {
      [x + p[0], 63 - (x + p[0])].forEach(function (xx) { var yy = y + p[1], c = B.getF(xx, yy); if (B.tgF(xx, yy) === TAG.SKIN && (c === S.b || c === S.l || c === S.m)) B.setF(xx, yy, p[2], TAG.SKIN); });
    });
  }
  function castShadowC(P, rows) { // hair and hats shade the brow, in frame pixels
    var B = P.B, S = P.skin, hits = [], n = Math.max(2, Math.round((rows || 2) * XF.s)), x, y, k;
    for (y = 0; y < 64; y++) for (x = 0; x < 64; x++) {
      if (B.tgF(x, y) !== TAG.SKIN) continue;
      var c = B.getF(x, y); if (c !== S.b && c !== S.l && c !== S.m) continue;
      for (k = 1; k <= n; k++) { var t = B.tgF(x - (k > 1 ? 1 : 0), y - k); if (t === TAG.HAIR || t === TAG.HAT) { hits.push(x, y, k); break; } }
    }
    for (var i = 0; i < hits.length; i += 3) { var c2 = B.getF(hits[i], hits[i + 1]); B.setF(hits[i], hits[i + 1], hits[i + 2] === 1 ? (c2 === S.m ? S.s : S.m) : (c2 === S.l ? S.b : S.m), TAG.SKIN); }
  }

  /* ================================================================== human portraits (prototype) */
  // 'human' (64x64) and 'human_hd' (96x96) keep every character's own back/body/front design and rebuild the
  // base face so it reads as a real person: an oval head with full cheeks and a gentle chin, ears and a shaded
  // neck, almond eyes with lashes and catchlit irises, a small nose, tinted lips, soft skin light and a subtle
  // blush. human_hd zooms the design 1.5x through XF (XF.sym rounds footprints towards the centre line, so
  // mirrored details stay mirrored) and paints the face features natively at 96px.
  function FX(x) { return XF ? fxX(x) : x; } // design -> frame, continuous
  function FY(y) { return XF ? fxY(y) : y; }
  function DX(X) { return XF ? dzX(X) + 0.5 : X + 0.5; } // frame pixel centre -> design, continuous
  function DY(Y) { return XF ? dzY(Y) + 0.5 : Y + 0.5; }
  function sq(v) { return v * v; }
  function stepsF(M, x, y, dx, dy, max) { for (var s = 1; s <= max; s++) if (!M.hasF(x + dx * s, y + dy * s)) return s; return max + 1; }
  // lower-face contour per design face: below the cheekbones (jaw rows under the eye centre) the cheeks follow a
  // superellipse down to the chin: m 2 gives an oval with a gentle chin, higher m a squarer jaw, lower m a pointed chin;
  // ext adds chin rows
  var HFACE = {
    round: { m: 2, jaw: 2, ext: 1 }, kid: { m: 2.2, jaw: 2.5, ext: 0 }, oval: { m: 1.85, jaw: 2, ext: 1 }, broad: { m: 2.6, jaw: 3, ext: 0 },
    long: { m: 2.2, jaw: 3, ext: 0 }, angular: { m: 1.6, jaw: 1, ext: 0 }, narrow: { m: 1.9, jaw: 2, ext: 1 }, square: { m: 2.6, jaw: 2, ext: 0 },
    showman: { m: 2.1, jaw: 2, ext: 1 }, cute: { m: 2, jaw: 2, ext: 1 }, player: { m: 2, jaw: 2, ext: 1 }
  };
  function faceName(f) { for (var k in FACES) if (FACES.hasOwnProperty(k) && FACES[k] === f) return k; return 'round'; }
  function humanFace(def) {
    var f = def.face, hp = HFACE[faceName(f)] || HFACE.round, E = EYES[def.eyeStyle] || EYES.std, b = { x0: 99, x1: -1, y0: 99, y1: -1 }, kr = 0, r;
    eyeCells(E.open).forEach(function (c) { b.x0 = Math.min(b.x0, c[0]); b.x1 = Math.max(b.x1, c[0]); b.y0 = Math.min(b.y0, c[1]); b.y1 = Math.max(b.y1, c[1]); });
    for (r = 0; r < E.open.length; r++) if (E.open[r].indexOf('K') >= 0) { kr = r; break; }
    var top = f.top, n0 = f.hw.length, bot = top + n0 + (hp.ext || 0), ecx = f.eyeX + (b.x0 + b.x1 + 1) / 2, ecy = f.eyeY + (b.y0 + b.y1 + 1) / 2;
    var yA = Math.max(ecy + hp.jaw, f.earY + 4.5);
    function orig(yc) { var i = yc - top - 0.5; if (i <= 0) return f.hw[0]; if (i >= n0 - 1) return f.hw[n0 - 1]; var a = Math.floor(i), t = i - a; return f.hw[a] + (f.hw[a + 1] - f.hw[a]) * t; }
    function at(yc) { // half-width at the continuous design row yc
      if (yc < top || yc > bot) return undefined;
      if (yc <= yA) return orig(yc);
      return orig(yA) * Math.pow(Math.max(0, 1 - Math.pow((yc - yA) / (bot - yA), hp.m)), 1 / hp.m);
    }
    var hw = [], i, k, o = {};
    for (i = 0; i < bot - top; i++) hw.push(at(top + i + 0.5));
    for (k in f) if (f.hasOwnProperty(k)) o[k] = f[k];
    o.hw = XF ? new Proxy(hw, { get: function (t, key) { if (typeof key === 'string' && key !== '' && !isNaN(+key)) return at(top + (+key) + 0.5); return t[key]; } }) : hw;
    o.hwAt = at; o.bot = bot; o.ecx = ecx; o.ecy = ecy; o.kr = kr;
    return o;
  }
  function humanSkin(S0) {
    var o = {}, k;
    for (k in S0) if (S0.hasOwnProperty(k)) o[k] = S0[k];
    o.m = mix(S0.b, S0.s, 0.5);
    o.d = mix(S0.s, S0.d, 0.55);
    o.bl = mix(S0.b, S0.l, 0.5); o.bm = mix(S0.b, o.m, 0.5); // in-between tones for the hd face light
    o.outline = mix(S0.s, H('#3a1420'), 0.62);
    o.line = mix(S0.s, o.outline, 0.7);
    o.blush = mix(S0.b, mix(S0.blush, H('#ff6f86'), 0.2), 0.62); // designs paint this directly: keep it gentle
    o.lip = S0.lip !== mix(S0.s, 0xa03050, 0.22) ? S0.lip : mix(mix(S0.b, S0.s, 0.45), H('#d0586e'), 0.32); // a design's own lip colour wins
    o.lipD = mix(o.lip, o.outline, 0.4);
    return o;
  }
  function renderHuman(def, expr, opt, ST) {
    var N = ST.W || 64, P;
    try {
      CUR_STYLE = ST;
      if (ST.hd) XF = { s: ST.zoom, px: 32, PX: N / 2, py: 32, PY: N / 2, W: N, H: N, sym: true };
      P = { B: new Buf(N, N), d: def, e: normExpr(expr), blink: !!opt.blink, talk: !!opt.talk, skin: humanSkin(def.skin), f: humanFace(def), eyeC: def.eyeC, lash: def.lash, style: ST };
      P.B.xf = !!XF;
      if (def.back) def.back(P);
      drawNeckH(P);
      if (def.body) def.body(P);
      if (def.ears !== false) (def.drawEars || drawEars)(P);
      paintFaceH(P);
      if (def.skinDetail) def.skinDetail(P);
      drawEyesH(P);
      drawBrowsH(P);
      drawNoseH(P);
      if (!def.mouthLine) drawMouthH(P, 0);
      if (def.front) def.front(P);
      castShadowH(P, def.castRows);
      blushH(P);
      if (def.post) def.post(P);
      rimPass(P.B, N, ST.rim);
      outlinePassS(P);
    } finally { CUR_STYLE = null; XF = null; }
    return P.B;
  }
  function drawNeckH(P) {
    var f = P.f, S = P.skin, B = P.B, nw = (P.d.neckW || 5) - 0.2, y0 = f.bot - 6, y1 = 59;
    for (var Y = 0; Y < B.h; Y++) {
      var yc = DY(Y), hw = nw + Math.max(0, yc - f.bot - 1) * 0.3; if (yc <= y0 || yc >= y1) continue;
      for (var X = 0; X < B.w; X++) { var dx = DX(X) - 32, u = dx / nw; if (Math.abs(dx) < hw) B.setF(X, Y, u < -0.5 ? S.b : u < 0.25 ? S.m : u < 0.72 ? S.s : S.d, TAG.SKIN); }
    }
  }
  function drawEarsH(P) {
    var f = P.f, S = P.skin, B = P.B, N = B.w, y0 = f.earY, hwE = f.hwAt(y0 + 3.5);
    if (!XF) {
      var k = Math.ceil(hwE - 0.5);
      stampF(B, ['.bb', 'lbm', 'lms', 'lms', 'bbm', '.bm', '..m'], 32 - k - 3, y0, { b: S.b, l: S.l, m: S.m, s: S.s }, TAG.SKIN);
      stampF(B, ['mm.', 'msm', 'sds', 'sds', 'ssm', 'sm.', 'm..'], 32 + k, y0, { m: S.m, s: S.s, d: S.d }, TAG.SKIN);
      return;
    }
    var s = XF.s, Xc = fxX(32 - hwE - 1.25), Yc = fxY(y0 + 3.4), RX = 1.75 * s, RY = 3.6 * s;
    M64().ellipseF(Xc, Yc, RX, RY).eachF(function (X, Y) {
      var u = (X + 0.5 - Xc) / RX, v = (Y + 0.5 - Yc) / RY, d = u * u + v * v, cl = S.b, cr = S.s;
      if (u > 0.5) { cl = S.m; cr = S.d; } // root, in the head's shadow
      else if (d > 0.55 && v < 0.5) { cl = S.l; cr = S.m; } // helix rim
      else if (d < 0.5 && v > -0.55 && v < 0.45) { cl = S.m; cr = S.d; } // bowl of the ear
      B.setF(X, Y, cl, TAG.SKIN); B.setF(N - 1 - X, Y, cr, TAG.SKIN);
    });
  }
  function paintFaceH(P) { // soft light from the upper left: a shadow band follows the right contour and widens towards the
    // jaw, the jaw turns under and shades the neck, light gathers on the lit cheek, the brow and the chin
    var f = P.f, S = P.skin, B = P.B, k = XF ? XF.s : 1, cx = f.ecx, cy = f.ecy, span = Math.max(4, f.bot - cy);
    var M = M64(), rowW = [], X0, Y0; // the face mask, row by row (frame pixels)
    for (Y0 = 0; Y0 < M.h; Y0++) { var w0 = f.hwAt(DY(Y0)); rowW.push(w0); if (w0 != null) for (X0 = 0; X0 < M.w; X0++) if (Math.abs(DX(X0) - 32) < w0) M.putF(X0, Y0); }
    P.faceM = M;
    function blob(x, y, bx, by, rx, ry) { var d = sq((x - bx) / rx) + sq((y - by) / ry); return d < 1 ? 1 - d : 0; }
    M.eachF(function (X, Y) {
      var x = DX(X), y = DY(Y), hw = rowW[Y], dxr = hw - (x - 32), dyb = (stepsF(M, X, Y, 0, 1, Math.ceil(4 * k)) - 0.5) / k;
      var j = Math.max(0, Math.min(1, (y - cy + 2) / (span + 2))), wr = 1.6 + 2.6 * j, v = 1;
      v -= 0.62 * Math.pow(Math.max(0, Math.min(1, (wr - dxr) / wr)), 0.85);
      v -= 0.55 * Math.max(0, Math.min(1, (2.1 - dyb) / 2.1)) * (x > 32 ? 1 : 0.6);
      v += 0.42 * blob(x, y, cx - 1.2, cy + 3.6, 3.2, 2.3) + 0.24 * blob(x, y, 28, cy - 6, 3.6, 2) + 0.3 * blob(x, y, 30.8, f.bot - 2.4, 2.2, 1.4) + 0.12 * blob(x, y, 64 - cx, cy + 3.6, 2.6, 2);
      B.setF(X, Y, v > 1.22 ? S.l : XF && v > 1.06 ? S.bl : v > 0.78 ? S.b : XF && v > 0.66 ? S.bm : v > 0.5 ? S.m : v > 0.28 ? S.s : S.d, TAG.SKIN);
    });
    var n = Math.max(1, Math.round(2 * k)), x, y, j;
    for (y = 0; y < B.h; y++) for (x = 0; x < B.w; x++) {
      if (M.hasF(x, y) || B.tgF(x, y) !== TAG.SKIN) continue;
      for (j = 1; j <= n + 1; j++) if (M.hasF(x, y - j)) { B.setF(x, y, j <= n ? S.d : S.s, TAG.SKIN); break; }
    }
  }
  // design eye style -> human eye: w/h size steps, lid (heavy lid rows), hood (low crease), smile (raised lower lid),
  // wing (liner flick), thick (bolder lash line), soft (gentler lashes), bags, lower (lower lashes), lidIn (narrowed inner lid)
  var HEYE = {
    std: {}, kind: { hood: 1, smile: 1, soft: 1 }, kid: { w: 1, h: 1 }, almond: { wing: 2, thick: 1 }, small: { w: -1 },
    twinkle: { smile: 1, soft: 1 }, doe: { w: 1, h: 1, lower: 1 }, beady: { w: -1, bags: 1, soft: 1, sock: 1, iwK: -1 }, tired: { lid: 1, bags: 1 },
    sharp: { thick: 1, lidIn: 1 }, star: { thick: 1 }, lidded: { lid: 1, wing: 1 }, soft: { lid: 1, wing: 1, lower: 1 },
    cute: { w: 1, h: 1 }, cutewing: { w: 1, h: 1, wing: 2, thick: 1 }, cutelid: { w: 1, h: 1, lid: 1 }
  };
  function humanEyeSpec(P) {
    var c = HEYE[P.d.eyeStyle] || {}, hint = P.d.hum || {}, hd = !!XF, o = { hd: hd }, k;
    for (k in c) if (c.hasOwnProperty(k)) o[k] = c[k];
    for (k in hint) if (hint.hasOwnProperty(k)) o[k] = hint[k];
    o.w = (hd ? 9 : 6) + (c.w || 0);
    o.h = (hd ? 5 : 3) + (c.h || 0) - (hd && hint.masc && !hint.kid ? 1 : 0);
    o.iw = (hd ? (o.w >= 9 && (!hint.masc || hint.kid) ? 5 : 4) : (o.w >= 7 ? 4 : 3)) + (c.iwK || 0);
    if (hint.masc) { o.thick = 0; o.wing = Math.min(o.wing || 0, 1); }
    return o;
  }
  // left eye, outer corner at the LEFT. K lash, k soft lash, W/w sclera (lit / under the lid), L lid skin, c crease,
  // l lower lid, q lower lash, v under-eye shade. The open cells come back for the iris.
  function humanEyeTpl(st, mode) {
    var w = st.w, h = st.h, hd = st.hd, L = 4, T = 6, TW = L + w + 2, TH = T + h + 4, g = [], r, c, tops = [], bots = [], open = [];
    for (r = 0; r < TH; r++) { g.push([]); for (c = 0; c < TW; c++) g[r].push('.'); }
    function put(cc, rr, ch) { cc += L; rr += T; if (rr >= 0 && rr < TH && cc >= 0 && cc < TW) g[rr][cc] = ch; }
    function get(cc, rr) { cc += L; rr += T; return rr >= 0 && rr < TH && cc >= 0 && cc < TW ? g[rr][cc] : '.'; }
    function out() { return { rows: g.map(function (row) { return row.join(''); }), L: L, T: T, w: w, h: h, open: open }; }
    var thickN = hd ? Math.round(w * (st.thick ? 0.5 : st.masc ? 0.22 : 0.4)) : (st.thick ? 2 : st.masc ? 0 : 1);
    if (mode === 'happy') { // smiling closed eye: the lash line arches, bolder in the middle, with a little tail at the outer corner
      for (c = 0; c < w; c++) {
        var u = (c + 0.5) / w, ar = Math.round((hd ? 2.4 : 1.6) * (1 - Math.sin(Math.PI * u)) + (hd ? 0.9 : 0.3));
        put(c, ar, 'K');
        if (hd && c > 0 && c < w - 1 && !st.masc) put(c, ar + 1, 'K');
        if (c === 0) { put(-1, ar + 1, 'K'); if (hd) put(-1, ar + 2, 'k'); }
      }
      if (hd) for (c = 2; c < w - 2; c++) put(c, Math.round(2.4 * (1 - Math.sin(Math.PI * (c + 0.5) / w)) + 0.9) + 3, 'l');
      return out();
    }
    if (mode === 'closed') { // blink: the lid rests on the lower lash line
      for (c = 0; c < w; c++) {
        var u2 = (c + 0.5) / w, cr = Math.round(h - 1.1 - (hd ? 1.2 : 0.7) * (1 - Math.sin(Math.PI * u2)));
        put(c, cr, 'K');
        if (hd && c < thickN + 1) put(c, cr - 1, 'K');
        if (hd && c > 0 && c < w - 1) put(c, cr + 1, 'k');
        if (c === 0) put(-1, cr - (hd ? 1 : 0), 'K');
      }
      return out();
    }
    // almond opening, per column [top, bot): the outer corner sits a little higher and comes to a point
    for (c = 0; c < w; c++) {
      var t = (c === 0 || c === w - 1) ? 1 : 0, b = h;
      if (hd) b = c === 0 ? 2 : c === 1 ? Math.min(h, 3) : c === 2 || c >= w - 2 ? h - 1 : h;
      else if (c === 0) b = h - 1; else if (c === w - 1) b = h === 3 ? 3 : h - 1;
      tops.push(t); bots.push(b);
    }
    var nat = tops.slice();
    if (mode === 'wide') for (c = 1; c < w - 1; c++) { tops[c] -= 1; nat[c] -= 1; }
    if (st.lid && mode !== 'wide') for (c = 0; c < w; c++) tops[c] = Math.min(bots[c] - 1, tops[c] + st.lid);
    if (st.lidIn && mode !== 'wide') for (c = w - 2; c < w; c++) tops[c] = Math.min(bots[c] - 1, tops[c] + 1);
    if (st.smile && hd && mode === 'open') for (c = 1; c < w - 1; c++) bots[c] = Math.max(tops[c] + 2, bots[c] - 1);
    function lower(c, n) { tops[c] = Math.min(bots[c] - (c === 0 || c === w - 1 ? 0 : 1), tops[c] + n); } // a corner may close completely
    if (mode === 'sad') for (c = 0; c < w; c++) lower(c, hd ? (c < w * 0.34 ? 2 : c < w * 0.67 ? 1 : 0) : (c < w * 0.5 ? 1 : 0));
    if (mode === 'angry') for (c = 0; c < w; c++) lower(c, hd ? (c >= w * 0.67 ? 2 : c >= w * 0.34 ? 1 : 0) : (c >= w * 0.5 ? 1 : 0));
    for (c = 0; c < w; c++) {
      for (r = nat[c]; r < tops[c]; r++) put(c, r, 'L');
      for (r = tops[c]; r < bots[c]; r++) { put(c, r, r === tops[c] ? 'w' : 'W'); open.push([c, r]); }
    }
    // lash line: bolder towards the outer corner, ending in a short tail past it
    if (mode === 'sad' && !hd) thickN = 0;
    for (c = 0; c < w; c++) { put(c, tops[c] - 1, 'K'); if (c < thickN) put(c, tops[c] - 2, 'K'); }
    put(-1, tops[0] - 1, 'K');
    if (hd && !st.masc) put(-1, tops[0] - 2, 'K');
    if (st.wing) { put(-2, tops[0] - 2, 'K'); if (st.wing > 1) { put(-3, tops[0] - 3, 'K'); if (hd) put(-2, tops[0] - 3, 'K'); } }
    if (hd) put(w, tops[w - 1], 'k');
    // lower lid, lower lashes, crease, bags
    for (c = 1; c < w - 1; c++) if (get(c, bots[c]) === '.') put(c, bots[c], 'l');
    if (hd || st.lower) { put(0, bots[0], 'q'); if (hd && !st.masc) put(-1, bots[0] - 1, 'q'); }
    if (hd || st.hood) for (c = 1; c < w - 1; c++) {
      var cr2 = Math.min(tops[c], nat[c]) - (c < thickN ? 3 : 2) - (hd && !st.hood ? 1 : 0);
      if (get(c, cr2) === '.' && get(c, cr2 + 1) === '.') put(c, cr2, 'c');
    }
    if (st.bags || (hd && st.old)) for (c = 1; c < w - 1; c++) if (get(c, bots[c] + 1) === '.') put(c, bots[c] + 1, 'v');
    if (st.sock) { for (c = -1; c <= w; c++) for (r = -3; r < h + 2; r++) if (get(c, r) === '.' && (get(c + 1, r) !== '.' || get(c - 1, r) !== '.' || get(c, r + 1) !== '.' || get(c, r - 1) !== '.') && get(c, r - 1) !== 'c') put(c, r, 'd'); }
    return out();
  }
  function humanEyeGeom(P) {
    var f = P.f, st = humanEyeSpec(P), X0 = Math.round(FX(f.ecx) - st.w / 2), Y0 = Math.round(FY(f.ecy) - st.h / 2);
    return { st: st, X0: X0, Y0: Y0, Xc: X0 + st.w / 2, lashY: Y0 - 1 };
  }
  function humanEyeLegend(P, st) {
    var S = P.skin, ic = P.eyeC, lash = P.lash != null ? mix(P.lash, H('#2a1420'), 0.25) : mix(H('#3a1a24'), ic[0], 0.22);
    lash = mix(lash, H('#140a12'), Math.max(0, Math.min(0.6, (0.5 - lum(S.b)) * 2.2))); // deeper skin: darker lashes stay readable
    if (st.soft) lash = mix(lash, S.s, 0.28);
    return { K: [lash, TAG.EYE], k: [mix(lash, S.s, 0.45), TAG.EYE], W: [mix(H('#f4f2fa'), S.b, 0.06), TAG.EYE], w: [mix(H('#d4d1e2'), S.s, 0.12), TAG.EYE], L: [S.m, TAG.SKIN],
      c: [mix(S.m, S.s, 0.55), TAG.SKIN], l: [mix(S.s, S.m, 0.35), TAG.SKIN], q: [mix(lash, S.s, 0.35), TAG.EYE], v: [mix(S.m, H('#8a6ab0'), 0.2), TAG.SKIN], d: [mix(S.s, S.d, 0.4), TAG.SKIN] };
  }
  function paintIrisH(B, T, ox, oy, flip, st, ic, gaze, mode) {
    if (!T.open.length) return;
    var TW = T.rows[0].length, set = {}, minX = 1e9, maxX = -1e9, x, y;
    T.open.forEach(function (p) { var tc = p[0] + T.L, X = flip ? ox + (TW - 1 - tc) : ox + tc; set[X + ',' + (oy + p[1] + T.T)] = 1; minX = Math.min(minX, X); maxX = Math.max(maxX, X); });
    var wide = mode === 'wide', iw = Math.max(2, Math.min(st.iw - (wide ? 1 : 0), maxX - minX + 1)), off = Math.ceil((maxX - minX + 1 - iw) / 2);
    var ix0 = flip ? maxX - off - iw + 1 : minX + off; // a little more white on the outer side
    ix0 = Math.max(minX, Math.min(maxX - iw + 1, ix0 + (gaze || 0)));
    var minY = 1e9, maxY = -1e9;
    for (x = ix0; x < ix0 + iw; x++) for (y = oy; y < oy + T.rows.length; y++) if (set[x + ',' + y]) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    if (minY > maxY) return;
    if (wide && maxY - minY >= 2) minY += 1; // white above the iris
    var ih = maxY - minY + 1, hd = st.hd, mid = mix(ic[0], ic[1], 0.5);
    for (y = minY; y <= maxY; y++) for (x = ix0; x < ix0 + iw; x++) {
      if (!set[x + ',' + y]) continue;
      var r = y - minY;
      if (hd && ih >= 4 && r === ih - 1 && (x === ix0 || x === ix0 + iw - 1)) continue; // round bottom
      B.setF(x, y, r === 0 ? ic[0] : r === ih - 1 ? ic[2] : hd && r === 1 ? mid : ic[1], TAG.EYE);
    }
    var pc0 = ix0 + Math.floor((iw - 1) / 2), pc1 = ix0 + Math.floor(iw / 2), pr0 = minY + (ih >= 3 ? 1 : 0), pr1 = hd && ih >= 4 ? pr0 + 1 : pr0;
    for (y = pr0; y <= pr1; y++) for (x = pc0; x <= pc1; x++) if (set[x + ',' + y]) B.setF(x, y, ic[3], TAG.EYE);
    // catchlight on the upper left of the iris (one light for both eyes), glint lower right
    var hx = ix0 + (iw >= 4 ? 1 : 0), hy = minY + (hd ? 1 : 0);
    if (set[hx + ',' + hy]) B.setF(hx, hy, WHITE, TAG.EYE);
    if (hd) { if (set[(hx + 1) + ',' + hy]) B.setF(hx + 1, hy, WHITE, TAG.EYE); if (set[hx + ',' + (hy + 1)]) B.setF(hx, hy + 1, mix(WHITE, ic[2], 0.3), TAG.EYE); }
    var gx = ix0 + iw - 1 - (hd ? 1 : 0), gy = maxY - (hd ? 1 : 0);
    if (ih >= 3 && set[gx + ',' + gy]) B.setF(gx, gy, mix(ic[2], WHITE, 0.55), TAG.EYE);
  }
  function drawEyesH(P) {
    var d = P.d, g = humanEyeGeom(P), st = g.st, e = P.e, B = P.B, N = B.w, wide = e === 'surprised' && !P.blink;
    P.heye = g;
    var mode = P.blink ? 'closed' : e === 'happy' ? 'happy' : wide ? 'wide' : e === 'sad' ? 'sad' : e === 'angry' ? 'angry' : 'open';
    var T = humanEyeTpl(st, mode), TW = T.rows[0].length, ox = g.X0 - T.L, oy = g.Y0 - T.T, oxR = N - 1 - (ox + TW - 1), L = humanEyeLegend(P, st);
    var g0 = d.gaze ? d.gaze(P) : 0, gaze = g0 ? (g0 > 0 ? 1 : -1) * Math.round(Math.abs(g0) * (XF ? XF.s : 1) - 0.01) : 0; // same size glance either way
    if (!d.hideEyeL) { stampF(B, T.rows, ox, oy, L, TAG.EYE, false); paintIrisH(B, T, ox, oy, false, st, P.eyeC, gaze, mode); }
    if (!d.hideEyeR) { stampF(B, T.rows, oxR, oy, L, TAG.EYE, true); paintIrisH(B, T, oxR, oy, true, st, P.eyeC, gaze, mode); }
    if (P.tears) [[1, 1], [1, 2], [0, 3]].forEach(function (q, i) {
      var y = g.Y0 + st.h + q[1] - 1, c = i % 2 ? H('#8cc4f0') : H('#c4e6ff');
      if (!d.hideEyeL) B.setF(g.X0 + q[0], y, c, TAG.EYE);
      if (!d.hideEyeR) B.setF(N - 1 - (g.X0 + q[0]), y, c, TAG.EYE);
    });
  }
  function drawBrowsH(P) { // thin and soft, a shade darker than the hair, kept at the design's distance above the lash line
    var spec = P.d.brows; if (!spec) return;
    var g = P.heye || humanEyeGeom(P), S = P.skin, B = P.B, N = B.w, f = P.f, s = XF ? XF.s : 1, pts = browPts(P, spec);
    var soft = function (c) { return lum(c) < 0.3 ? mix(c, S.m, 0.24) : c; }, col = soft(spec.col), col2 = soft(spec.col2 != null ? spec.col2 : spec.col);
    var th = s > 1 ? (spec.thick >= 3 ? 3 : 2) : (spec.thick === 3 || (spec.thick === 2 && P.d.browKeep) ? 2 : 1);
    var fp = pts.map(function (p) { return [Math.round(FX(f.eyeX + p[0] + 0.5) - 0.5), Math.round(g.lashY + (p[1] - f.kr) * s)]; });
    var path = [], i;
    for (i = 0; i + 1 < fp.length; i++) { var seg = bezCore([fp[i], fp[i + 1]]); if (path.length) seg = seg.slice(1); path = path.concat(seg); }
    var minx = 1e9, maxx = -1e9; path.forEach(function (p) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); });
    var aL = Math.round(((spec.asymL && spec.asymL[P.e]) || 0) * s), aR = Math.round(((spec.asymR && spec.asymR[P.e]) || 0) * s), taper = spec.taper != null ? spec.taper : 0.25;
    path.forEach(function (p) {
      var u = (p[0] - minx) / Math.max(1, maxx - minx);
      for (var k = 0; k < th; k++) {
        if (k > 0 && u <= taper) continue;
        var c = k === th - 1 && k > 0 ? col2 : col;
        if (!spec.noL) B.setF(p[0], p[1] + k + aL, c, TAG.BROW);
        if (!spec.noR) B.setF(N - 1 - p[0], p[1] + k + aR, c, TAG.BROW);
      }
    });
  }
  function drawNoseH(P) { // a small nose: the bridge catches the light, the far side and the underside shade softly
    var d = P.d; if (d.nose === false) return;
    var rows = typeof d.nose === 'object' ? d.nose : NOSES[d.nose || 'button'], S = P.skin, B = P.B, f = P.f;
    var nx = d.noseX != null ? d.noseX : 31, tip = f.noseY + rows.length - 1;
    if (!XF) {
      B.setF(nx, tip - 2, S.l, TAG.SKIN); B.setF(nx + 1, tip - 1, S.m, TAG.SKIN);
      B.setF(nx, tip, S.m, TAG.SKIN); B.setF(nx + 1, tip, S.s, TAG.SKIN);
      return;
    }
    var X = Math.round(fxX(nx + 1)), Y = ptY(tip);
    var hb = mix(S.b, S.l, 0.4), ht = mix(S.b, S.l, 0.75), sm = mix(S.m, S.s, 0.4), pts = rows.length < 3 ? [[-1, -1, hb], [0, -1, S.bm], [-1, 0, S.m], [0, 0, sm]] : [[-1, -1, ht], [0, -1, S.m], [-1, 0, S.m], [0, 0, sm], [1, 0, S.s]];
    if (rows.length >= 3) pts = pts.concat([[0, -2, S.m], [1, -1, S.m], [-2, 0, S.m]]); // a fuller nose for the designs that draw one
    if (rows.length >= 4) pts = pts.concat([[-1, -3, hb], [0, -3, S.m]]);
    pts.forEach(function (q) { B.setF(X + q[0], Y + q[1], q[2], TAG.SKIN); });
  }
  function widenRows(rows, add) { // stretch a mouth stamp by repeating its centre columns (corners stay crisp)
    var w = stampW(rows), a = Math.floor(w / 2) - (w % 2 ? 0 : 1), b = Math.floor(w / 2);
    return rows.map(function (r) { while (r.length < w) r += '.'; var mid = '', i; for (i = 0; i < add; i++) mid += r.charAt(i < add / 2 ? a : b); return r.slice(0, a + 1) + mid + r.slice(a + 1); });
  }
  function drawMouthH(P, dy) { // the character's own mouth shapes with lip colour; widened 1:1 frame pixels in human_hd
    var rows = mouthRows(P); if (!rows) return;
    if (XF) rows = widenRows(rows, 2 * Math.round(stampW(rows) * 0.14));
    var d = P.d, S = P.skin, B = P.B, N = B.w, w = stampW(rows), X0 = N / 2 - Math.ceil(w / 2) + Math.round((d.mouthDX || 0) * (XF ? XF.s : 1)), Y0 = XF ? ptY(P.f.mouthY + (dy || 0)) : P.f.mouthY + (dy || 0);
    var line = mix(S.lipD, S.line, 0.3), lipS = mix(S.lip, S.b, 0.45);
    stampF(B, rows, X0, Y0, {
      D: [line, TAG.MOUTH], d: [S.s, TAG.MOUTH], s: [lipS, TAG.SKIN], l: [S.l, TAG.SKIN], m: [H('#5e2434'), TAG.MOUTH], t: [H('#fbf8fc'), TAG.MOUTH],
      T: [H('#dcd6e6'), TAG.MOUTH], u: [H('#d86a86'), TAG.MOUTH], g: [GOLD[2], TAG.MOUTH], G: [GOLD[1], TAG.MOUTH], p: [S.lip, TAG.MOUTH], P: [S.lipD, TAG.MOUTH],
      b: [d.mouthLine ? mix(d.mouthLine, S.b, 0.15) : line, TAG.MOUTH], L: [mix(S.lip, WHITE, 0.26), TAG.MOUTH]
    }, TAG.MOUTH, d.mouthFlip);
    if (rows.join('').indexOf('L') < 0) for (var r = rows.length - 1; r >= 0; r--) { // 1px highlight on the lower lip, unless the design has one
      var cols = []; for (var i = 0; i < rows[r].length; i++) if (rows[r].charAt(i) === 's' || rows[r].charAt(i) === 'p') cols.push(i);
      if (cols.length >= 2) { var ci = cols[Math.floor((cols.length - 1) / 2)]; B.setF(d.mouthFlip ? X0 + (w - 1 - ci) : X0 + ci, Y0 + r, mix(S.lip, WHITE, 0.3), TAG.MOUTH); break; }
    }
  }
  function blushH(P) { // a soft rosy cheek under the outer half of each eye (skin pixels only)
    var k = P.d.blushK != null ? P.d.blushK : 1; if (k <= 0) return;
    var g = P.heye || humanEyeGeom(P), B = P.B, S = P.skin, N = B.w, hd = !!XF, big = P.blushBig || P.e === 'happy';
    var c1 = mix(S.b, S.blush, Math.min(1, k)), c2 = mix(S.b, S.blush, Math.min(1, k) * 0.5);
    var cx = g.Xc - 0.5, cy = g.Y0 + g.st.h + (hd ? 2.5 : 1.5), rx = (hd ? 3.6 : 2.3) + (big ? (hd ? 0.8 : 0.4) : 0), ry = (hd ? 1.5 : 0.8) + (big ? (hd ? 0.6 : 0.5) : 0);
    for (var Y = Math.floor(cy - ry - 1); Y <= Math.ceil(cy + ry + 1); Y++) for (var X = Math.floor(cx - rx - 1); X <= Math.ceil(cx + rx + 1); X++) {
      var dd = sq((X + 0.5 - cx) / rx) + sq((Y + 0.5 - cy) / ry); if (dd > 1) continue;
      var c = dd < 0.45 ? c1 : c2;
      [X, N - 1 - X].forEach(function (xx) { var cc = B.getF(xx, Y); if (B.tgF(xx, Y) === TAG.SKIN && (cc === S.b || cc === S.l || cc === S.m || cc === S.bl || cc === S.bm)) B.setF(xx, Y, c, TAG.SKIN); });
    }
  }
  function castShadowH(P, rows) { // hair and hats shade the brow, in frame pixels
    var B = P.B, S = P.skin, hits = [], n = Math.max(2, Math.round((rows || 2) * (XF ? XF.s : 1))), x, y, k;
    for (y = 0; y < B.h; y++) for (x = 0; x < B.w; x++) {
      if (B.tgF(x, y) !== TAG.SKIN) continue;
      var c = B.getF(x, y); if (c !== S.b && c !== S.l && c !== S.m && c !== S.bl && c !== S.bm) continue;
      for (k = 1; k <= n; k++) { var t = B.tgF(x - (k > 1 ? 1 : 0), y - k); if (t === TAG.HAIR || t === TAG.HAT) { hits.push(x, y, k); break; } }
    }
    for (var i = 0; i < hits.length; i += 3) { var c2 = B.getF(hits[i], hits[i + 1]); B.setF(hits[i], hits[i + 1], hits[i + 2] === 1 ? (c2 === S.m || c2 === S.bm ? S.s : S.m) : (c2 === S.l || c2 === S.bl ? S.b : S.m), TAG.SKIN); }
  }

  /* ================================================================== player look tables */
  var LOOKS = {
    skins: ['pale', 'fair', 'tan', 'brown', 'deep', 'moon-pale'],
    hairStyles: ['messy short', 'long', 'braid', 'bun', 'curls', 'crop'],
    hairColors: ['silver', 'black', 'ginger', 'auburn', 'brown', 'moss', 'white', 'plum'],
    robes: ['indigo', 'plum', 'forest', 'teal', 'wine', 'slate', 'ochre', 'midnight'],
    eyes: ['green', 'violet', 'amber', 'blue', 'brown']
  };
  var P_SKIN = [SKIN.pale, SKIN.fair, SKIN.tan, SKIN.brown, SKIN.deep, SKIN.moon];
  var P_HAIR = [HAIR.silver, HAIR.black, HAIR.ginger, HAIR.auburn, HAIR.brown, HAIR.moss, HAIR.white, HAIR.plum];
  var P_ROBE = [
    HS(['#1c1a44', '#2a2c6a', '#3c4096', '#5458b8']), HS(['#2e1232', '#4a1f4e', '#6a2e6a', '#8e4a8a']),
    HS(['#10302a', '#1a4434', '#245a40', '#337450']), HS(['#0c3036', '#12484e', '#1c6668', '#2c8884']),
    HS(['#3a0c1e', '#5e1630', '#86223f', '#a83a58']), HS(['#2d2c3e', '#45445a', '#605f78', '#7e7d97']),
    HS(['#5a3a14', '#8a5a1e', '#b8822e', '#dca84a']), HS(['#0b0a1c', '#141530', '#1e2248', '#2c3464'])
  ];
  var P_EYES = [EYEC.green, EYEC.violet, EYEC.amber, EYEC.blue, EYEC.brown];
  function clampI(v, n) { v = Math.floor(+v); return (v >= 0 && v < n) ? v : 0; }
  function normLook(look) {
    look = look || {};
    return { skin: clampI(look.skin, 6), hair: clampI(look.hair, 6), hairColor: clampI(look.hairColor, 8), robe: clampI(look.robe, 8), eyes: clampI(look.eyes, 5),
      hat: clothId(look.hat, 'hat'), cloak: clothId(look.cloak, 'cloak'), outfit: clothId(look.outfit, 'outfit') };
  }
  var UNDERSHIRT = HS(['#a89a88', '#d8ccb8', '#f4ead8']);

  // portrait hair for the 6 styles: back (behind head/shoulders) and front (cap/fringe) layers
  var P_HAIRSTYLE = [
    { // 0 messy short
      front: function (P, R) {
        var B = P.B, M = M64().ellipse(32, 23, 16, 12.5);
        [[-160, 4], [-135, 5], [-110, 6], [-80, 5], [-55, 6], [-30, 5], [-10, 4], [175, 3]].forEach(function (s, i) {
          var a = s[0] * Math.PI / 180, bw = 0.22, bend = i % 2 ? 0.15 : -0.12;
          M.poly([[32 + Math.cos(a - bw) * 15, 23 + Math.sin(a - bw) * 11.5], [32 + Math.cos(a + bend) * (16 + s[1]), 23 + Math.sin(a + bend) * (12.5 + s[1])], [32 + Math.cos(a + bw) * 15, 23 + Math.sin(a + bw) * 11.5]]);
        });
        M.sub(M64().poly([[14, 30], [19, 27], [21, 22], [24, 26], [27, 21], [30, 25], [33, 20], [36, 25], [39, 21], [41, 25], [43, 22], [45, 27], [50, 30], [50, 64], [14, 64]]));
        M.or(faceTop(P, function () { return 20; }));
        hairClumps(B, M, R, { px: 33, py: 14, aw: 0.36, ph: 0.3, cx: 24, cy: 12, rx: 22, ry: 18, k: 0.5, gap: 0.16, r0: 3, shine: [31, 22, 10, 12], shineTest: function (x, y) { return x < 32 && y < 20; } });
        innerLine(B, M, R[0], function (t) { return t === TAG.SKIN; });
      }
    },
    { // 1 long
      back: function (P, R) {
        var M = M64().poly([[17, 20], [13, 34], [12, 52], [15, 64], [26, 64], [23, 34]]).sym();
        hairClumps(P.B, M, R, { px: 32, py: 6, aw: 0.075, ph: 0.2, cx: 20, cy: 22, rx: 30, ry: 40, k: 0.45, gap: 0.2 });
      },
      front: function (P, R) {
        var B = P.B, hl = function (x) { var dx = x + 0.5 - 32; return 19 + 0.03 * dx * dx; };
        var M = M64().ellipse(32, 24, 16, 13.8).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        M.poly([[37, 13], [43, 18], [41, 21], [35, 22], [29, 24], [23, 25], [19, 30], [18, 26], [21, 19], [29, 14]]);
        M.poly([[19, 24], [22, 30], [21, 42], [18, 56], [16, 64], [13, 64], [16, 40], [17, 28]]);
        M.poly([[45, 24], [42, 30], [43, 42], [46, 56], [48, 64], [51, 64], [48, 40], [47, 28]]);
        hairClumps(B, M, R, { px: 38, py: 8, aw: 0.16, ph: 0.4, cx: 24, cy: 14, rx: 20, ry: 18, k: 0.55, gap: 0.17, shine: [32, 24, 10, 12], shineTest: function (x) { return x < 32; } });
        innerLine(B, M, R[0], function (t) { return t === TAG.SKIN; });
      }
    },
    { // 2 braid (over the right shoulder)
      front: function (P, R) {
        var B = P.B, hl = function (x) { var dx = x + 0.5 - 32; return 18.5 + 0.034 * dx * dx; };
        var M = M64().ellipse(32, 24.5, 16, 14).keep(function (x, y) { return y + 0.5 < hl(x) || (Math.abs(x + 0.5 - 32) > 13 && y < 29); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        // soft bangs
        M.poly([[22, 17], [30, 15], [28, 20], [25, 22], [21, 25]]); M.poly([[42, 17], [34, 15], [36, 20], [39, 22], [43, 25]]);
        hairClumps(B, M, R, { px: 32, py: 10, aw: 0.22, ph: 0.5, cx: 25, cy: 14, rx: 18, ry: 16, k: 0.5, gap: 0.15, shine: [32, 24, 10, 12], shineTest: function (x) { return x < 31; } });
        innerLine(B, M, R[0], function (t) { return t === TAG.SKIN; });
        for (var y = 11; y < 18; y++) B.set(32, y, R[0], TAG.HAIR);
        braid(B, [[45, 30], [49, 44], [46, 62]], R, 5, { line: R[0] });
        var tie = P.robeR; B.hline(44, 48, 57, tie[3], TAG.HAIR); B.hline(44, 48, 58, tie[1], TAG.HAIR);
        stamp(B, ['.ttt.', 'ttTtt', '.t.t.'], 44, 59, { t: R[2], T: R[3] }, TAG.HAIR);
      }
    },
    { // 3 bun (top knot with face-framing locks)
      back: function (P, R) {
        var bun = M64().ellipse(32, 9, 8, 6.5);
        shadeFill(P.B, bun, [R[1], R[2], R[3]], TAG.HAIR, { cx: 28, cy: 5, rx: 11, ry: 9, edge: 0.4, th: [-0.05, 0.45] });
        strands(P.B, bun, [[[25, 11], [32, 14], [39, 10]], [[27, 7], [33, 9], [37, 6]]], R[1]);
        strands(P.B, bun, [[[26, 6], [28, 4], [31, 3]]], R[4]);
        P.B.hline(29, 35, 14, P.robeR[3], TAG.HAIR); P.B.hline(29, 35, 15, P.robeR[1], TAG.HAIR);
      },
      front: function (P, R) {
        var B = P.B, hl = function (x) { var dx = x + 0.5 - 32; return 18.5 + 0.034 * dx * dx; };
        var M = M64().ellipse(32, 25, 16, 14.2).keep(function (x, y) { return y + 0.5 < hl(x); }).or(faceTop(P, function (x) { return hl(x) - 0.5; }));
        M.poly([[19, 22], [22, 25], [21, 33], [20, 38], [18, 34], [18, 26]]); M.poly([[45, 22], [42, 25], [43, 33], [44, 38], [46, 34], [46, 26]]);
        hairClumps(B, M, R, { px: 32, py: 11, aw: 0.24, ph: 0.5, cx: 25, cy: 14, rx: 18, ry: 16, k: 0.4, shine: [32, 25, 9.5, 11.5], shineTest: function (x) { return x < 30; } });
        innerLine(B, M, R[0], function (t) { return t === TAG.SKIN; });
      }
    },
    { // 4 curls
      back: function (P, R) {
        var M = M64().ellipse(32, 26, 20.5, 18).or(M64().ellipse(32, 18, 17, 12));
        for (var i = 0; i < 18; i++) { var a = (i / 18) * Math.PI * 2, cx = 32 + Math.cos(a) * 19.5, cy = 25 + Math.sin(a) * 17; if (cy < 44) M.ellipse(cx, cy, 3.4, 3.4); }
        M.keep(function (x, y) { return y < 46; });
        curlFill(P.B, M, R);
      },
      front: function (P, R) {
        var B = P.B, M = M64();
        [[20, 20], [25, 17], [30, 16], [35, 16], [40, 17], [44, 20], [18, 25], [46, 25], [23, 21], [41, 21]].forEach(function (c) { M.ellipse(c[0], c[1], 3.6, 3.4); });
        M.or(faceTop(P, function () { return 20; }));
        curlFill(B, M, R);
        innerLine(B, M, R[0], function (t) { return t === TAG.SKIN; });
      }
    },
    { // 5 crop
      front: function (P, R) {
        var B = P.B, hl = function (x) { var dx = x + 0.5 - 32; return 18 + 0.045 * dx * dx; };
        var M = faceTop(P, function (x) { return hl(x); }).or(M64().ellipse(32, 24.5, 14.5, 13.2).keep(function (x, y) { return y + 0.5 < hl(x) + 0.5; }));
        M.poly([[22, 16], [42, 16], [42, 20], [36, 20], [30, 21], [24, 21], [21, 22]]);
        hairClumps(B, M, R, { px: 32, py: 24, aw: 0.3, ph: 0.2, cx: 25, cy: 13, rx: 17, ry: 14, k: 0.25, gap: 0.08, th: [-0.2, 0.3] });
        M.each(function (x, y) { if ((ti(x) + tj(y)) % 3 === 0 && B.get(x, y) === R[3]) B.set(x, y, R[2], TAG.HAIR); });
        innerLine(B, M, R[1], function (t) { return t === TAG.SKIN; });
      }
    }
  ];
  function curlFill(B, M, R) { // tight curls: ring texture
    shadeFill(B, M, [R[1], R[2], R[3]], TAG.HAIR, { cx: 24, cy: 16, rx: 22, ry: 20, edge: 0.45, th: [-0.05, 0.45] });
    M.each(function (x, y) {
      var X = ti(x), Y = tj(y), u = ((X * 5 + (Y >> 1) * 3) % 6 + 6) % 6, v = ((Y + (X >> 2)) % 3 + 3) % 3;
      var c = B.get(x, y);
      if (u === 0 && v !== 1) B.set(x, y, c === R[3] ? R[2] : R[1], TAG.HAIR);
      else if (u === 2 && v === 0 && c === R[3]) B.set(x, y, R[4], TAG.HAIR);
    });
  }

  function playerDef(lk) {
    var R = P_HAIR[lk.hairColor], robe = P_ROBE[lk.robe], st = P_HAIRSTYLE[lk.hair];
    var light = lk.hairColor === 0 || lk.hairColor === 6;
    return dressPortrait({
      skin: P_SKIN[lk.skin], face: FACES.player, eyeStyle: 'std', eyeC: P_EYES[lk.eyes],
      brows: { pts: [[0, -3], [3, -4], [6, -3]], col: light ? R[0] : R[1], thick: lk.hairColor === 1 ? 1 : 2, taper: 0.5 },
      mouths: { neutral: 'smile', happy: 'grin', sad: 'frown', surprised: 'o', angry: 'grit' },
      faceLight: lk.skin === 4 ? 0.6 : 0.74,
      back: function (P) { P.robeR = robe; if (st.back) st.back(P, R); },
      body: function (P) {
        var B = P.B, M = torso(47, 9, 25, 8, 28);
        shadeFill(B, M, robe, TAG.CLOTH, { cx: 16, cy: 46, rx: 32, ry: 24, edge: 0.35 });
        // cowl hood bunched behind the neck and over the shoulders
        var hood = M64().ellipse(32, 49, 15, 4.5).sub(M64().poly([[26, 44], [38, 44], [32, 56]]));
        shadeFill(B, hood, robe, TAG.CLOTH, { cx: 26, cy: 45, rx: 16, ry: 6, bias: 0.35, edge: 0.6 });
        edgePx(hood, [[0, 1]]).forEach(function (p) { B.set(p[0], p[1], robe[0], TAG.CLOTH); });
        // undershirt V with trim
        var V = M64().poly([[27, 48], [37, 48], [32, 58]]).and(M);
        shadeFill(B, V, UNDERSHIRT, TAG.CLOTH, { cx: 28, cy: 46, rx: 8, ry: 10 });
        for (var y = 48; y < 64; y++) { var o = Math.round((y - 48) * 0.5); if (y < 58) { B.set(27 + o - 1, y, GOLD[1], TAG.CLOTH); B.set(37 - o, y, GOLD[0], TAG.CLOTH); } }
        // moon pendant on a cord
        bez([[28, 49], [30, 54], [32, 55]]).forEach(function (p) { B.set(p[0], p[1], H('#574039'), TAG.ACC); });
        bez([[36, 49], [34, 54], [32, 55]]).forEach(function (p) { B.set(p[0], p[1], H('#3e2d2b'), TAG.ACC); });
        stamp(B, ['.mm.', 'mM..', 'mM..', '.mm.'], 31, 56, { m: H('#c8d4f0'), M: WHITE }, TAG.METAL);
      },
      front: function (P) { st.front(P, R); }
    }, lk);
  }
  function rawPlayerPortrait(look, expr, opts) { return toRaw(renderPortrait(playerDef(normLook(look)), expr, opts)); }

  /* ================================================================== overworld sprites (20x32) */
  // Parts are drawn as *materials* in logical right-facing coordinates; a shading pass then lights
  // every material from the top-left in screen space, so mirrored (left) views stay consistently lit.
  var SW = 20, SH = 32, DIRS = ['down', 'up', 'left', 'right'];
  function Spr(dir, w, h) {
    this.w = w || SW; this.h = h || SH;
    this.dir = dir; this.flip = dir === 'left'; this.side = dir === 'left' || dir === 'right';
    this.m = new Int16Array(this.w * this.h); this.m.fill(-1);
    this.fx = new Int32Array(this.w * this.h); this.fx.fill(-1);
    this.mats = []; this.idx = {};
  }
  var SPP = Spr.prototype;
  SPP.mat = function (key, ramp, o) { if (this.idx[key] == null) { this.idx[key] = this.mats.length; this.mats.push({ r: ramp, o: o || {} }); } return this.idx[key]; };
  SPP.X = function (x) { return this.flip ? this.w - 1 - x : x; };
  SPP.inb = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; };
  SPP.put = function (x, y, id) { x = this.X(Math.round(x)); y = Math.round(y); if (!this.inb(x, y)) return; var i = y * this.w + x; this.m[i] = id; this.fx[i] = -1; };
  SPP.dot = function (x, y, col) { if (col == null || col < 0) return; x = this.X(Math.round(x)); y = Math.round(y); if (!this.inb(x, y)) return; var i = y * this.w + x; this.m[i] = -2; this.fx[i] = col; };
  SPP.clr = function (x, y) { x = this.X(x); if (!this.inb(x, y)) return; var i = y * this.w + x; this.m[i] = -1; this.fx[i] = -1; };
  SPP.rect = function (x, y, w, h, id) { for (var j = y; j < y + h; j++) for (var i = x; i < x + w; i++) this.put(i, j, id); };
  SPP.has = function (x, y) { x = this.X(x); return this.inb(x, y) && this.m[y * this.w + x] !== -1; };
  SPP.idAt = function (x, y) { x = this.X(x); return this.inb(x, y) ? this.m[y * this.w + x] : -1; };
  // template rows (logical coordinates); legend: char -> material id (number) | {c: colour} | 'clear'
  SPP.tpl = function (rows, y0, leg, x0) {
    for (var r = 0; r < rows.length; r++) for (var i = 0; i < rows[r].length; i++) {
      var ch = rows[r].charAt(i); if (ch === '.' || ch === ' ') continue;
      var v = leg[ch]; if (v === undefined) continue;
      var x = (x0 || 0) + i, y = y0 + r;
      if (v === 'clear') this.clr(x, y); else if (typeof v === 'object') this.dot(x, y, v.c); else this.put(x, y, v);
    }
  };
  SPP.render = function () {
    var W = this.w, Hh = this.h, B = new Buf(W, Hh), m = this.m, self = this;
    function same(x, y, id) { if (x < 0 || y < 0 || x >= W || y >= Hh) return false; var j = m[y * W + x]; if (j === id) return true; var g = self.mats[id].o.group; return g != null && j >= 0 && self.mats[j].o.group === g; }
    for (var y = 0; y < Hh; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x, id = m[i];
      if (id === -2) { B.set(x, y, this.fx[i], TAG.ACC); continue; }
      if (id < 0) continue;
      var M = this.mats[id], r = M.r, o = M.o, c = r[1];
      if (!o.flat) {
        var L = same(x - 1, y, id), R = same(x + 1, y, id), U = same(x, y - 1, id), D = same(x, y + 1, id);
        if (!R && !o.noR) c = r[0];
        else if (!L && !o.noL) c = r[2];
        else if (!U && !o.noTop) c = o.topDark ? r[0] : r[2];
        if (o.botDark && !D) c = r[0];
      }
      B.set(x, y, c, TAG.CLOTH);
    }
    outlinePass(B, null);
    return B;
  };

  // ---------------------------------------------------------------- generic chibi body
  // returns layout info for the head/extras
  function sprLayout(sp, f) {
    var by = (f === 1 || f === 3) ? 1 : 0, sh = sp.short || 0;
    var headY = 9 + by + sh, tt = 19 + by + sh, th = sp.torsoH || (sh ? 6 : 7);
    return { by: by, sh: sh, headY: headY, dy: by + sh, tt: tt, tb: tt + th - 1, wd: sp.wide || 0 };
  }
  function legRow(S, x0, x1, y, w, id) { for (var k = 0; k < w; k++) S.put(x0 + k, y, id); }
  // leg templates: 5 rows, bottom row = ground (y 30); rows above the hip line are clipped.
  // L/R left/right leg, l/r shoes (front/back views); N/F near/far leg, n/f shoes (side, facing right)
  var LEGS = {
    front: [
      ['.......LL..RR.......', '.......LL..RR.......', '.......LL..RR.......', '......lll..rrr......', '......lll..rrr......'],
      ['.......LL..RR.......', '.......LL..RR.......', '.......LL..RR.......', '......lll..rrr......', '......lll...........'],
      ['.......LL..RR.......', '.......LL..RR.......', '.......LL..RR.......', '......lll..rrr......', '......lll..rrr......'],
      ['.......LL..RR.......', '.......LL..RR.......', '.......LL..RR.......', '......lll..rrr......', '...........rrr......']
    ],
    frontWide: [
      ['......LLL..RRR......', '......LLL..RRR......', '......LLL..RRR......', '.....llll..rrrr.....', '.....llll..rrrr.....'],
      ['......LLL..RRR......', '......LLL..RRR......', '......LLL..RRR......', '.....llll..rrrr.....', '.....llll..........'],
      ['......LLL..RRR......', '......LLL..RRR......', '......LLL..RRR......', '.....llll..rrrr.....', '.....llll..rrrr.....'],
      ['......LLL..RRR......', '......LLL..RRR......', '......LLL..RRR......', '.....llll..rrrr.....', '...........rrrr.....']
    ],
    side: [
      ['........FFNN........', '........FFNN........', '........FFNN........', '........ffnn........', '........ffnnn.......'],
      ['........FFNN........', '.......FF..NN.......', '.......FF...NN......', '......ff....nn......', '......ff....nnn.....'],
      ['........FFNN........', '........FFNN........', '.........FNN........', '.........fnn........', '..........nnn.......'],
      ['........NNFF........', '.......NN..FF.......', '......NN....FF......', '......nn....ff......', '.....nnn....fff.....']
    ],
    sideWide: [
      ['.......FFFNNN.......', '.......FFFNNN.......', '.......FFFNNN.......', '.......fffnnn.......', '.......fffnnnn......'],
      ['.......FFFNNN.......', '......FFF..NNN......', '......FFF...NNN.....', '.....fff....nnn.....', '.....fff....nnnn....'],
      ['.......FFFNNN.......', '.......FFFNNN.......', '........FFNNN.......', '........ffnnn.......', '..........nnnn......'],
      ['.......NNNFFF.......', '......NNN..FFF......', '.....NNN....FFF.....', '.....nnn....fff.....', '....nnnn....ffff....']
    ]
  };
  function drawLegs(S, sp, f, L, mats) {
    var side = S.side, wide = !!L.wd, set = LEGS[(side ? 'side' : 'front') + (wide ? 'Wide' : '')][f], top = L.tb + 1;
    var leg = { L: mats.leg, R: mats.leg2, l: mats.shoe, r: mats.shoe2, N: mats.leg, F: mats.legFar, n: mats.shoe, f: mats.shoeFar };
    for (var r = 0; r < 5; r++) {
      var y = 26 + r; if (y < top) continue;
      var row = set[r];
      for (var i = 0; i < row.length; i++) { var id = leg[row.charAt(i)]; if (id !== undefined) S.put(i, y, id); }
    }
  }
  // long skirt / robe hem over the legs (feet peek out)
  function drawGown(S, sp, f, L, id, shoeId) {
    var d = S.dir, waist = L.tb - 1, hem = 29;
    if (d === 'down' || d === 'up') {
      var sway = f === 1 ? 1 : f === 3 ? -1 : 0;
      if (!sp.noFeet) { // feet peeking under the hem
        if (f !== 3) { S.put(6, 30, shoeId); S.put(7, 30, shoeId); S.put(8, 30, shoeId); }
        if (f !== 1) { S.put(11, 30, shoeId); S.put(12, 30, shoeId); S.put(13, 30, shoeId); }
      }
      for (var y = waist; y <= hem; y++) {
        var t = (y - waist) / (hem - waist), hw = 3.5 + L.wd + t * 2.6 + (sp.flare || 0) * t, s = Math.round(sway * t);
        for (var x = Math.round(9.5 - hw + 0.5) + s; x <= Math.round(9.5 + hw - 0.5) + s; x++) S.put(x, y, id);
      }
    } else {
      var fw = f === 1 ? 1 : f === 3 ? 1 : 0, bk = f === 1 ? 1 : f === 3 ? 1 : 0;
      if (!sp.noFeet) {
        S.put(11 + fw, 30, shoeId); S.put(12 + fw, 30, shoeId); S.put(13 + fw, 30, shoeId);
        if (f === 1 || f === 3) { S.put(6, 30, shoeId); S.put(7, 30, shoeId); }
      }
      for (var y2 = waist; y2 <= hem; y2++) {
        var t2 = (y2 - waist) / (hem - waist), x0 = Math.round(7 - t2 * (1.6 + bk) - L.wd), x1 = Math.round(12 + t2 * (1.8 + fw) + L.wd);
        for (var x2 = x0; x2 <= x1; x2++) S.put(x2, y2, id);
      }
    }
  }
  // coat tails below the waist (legs still show below)
  function drawTails(S, sp, f, L, id, len) {
    var d = S.dir, y0 = L.tb - 1, y1 = L.tb + (len || 3);
    for (var y = y0; y <= y1; y++) {
      var t = (y - y0) / Math.max(1, y1 - y0);
      if (d === 'down' || d === 'up') {
        var hw = 3.5 + L.wd + t * 1.2;
        for (var x = Math.round(9.5 - hw + 0.5); x <= Math.round(9.5 + hw - 0.5); x++) {
          if (d === 'down' && sp.openCoat && (x === 9 || x === 10) && y > L.tb) continue;
          S.put(x, y, id);
        }
      } else {
        var sw = (f === 1 || f === 3) ? 1 : 0;
        for (var x2 = Math.round(7 - t * (1 + sw)); x2 <= Math.round(12 + t * 0.5); x2++) S.put(x2, y, id);
      }
    }
  }
  // torso + arms. arm swing: f1 left arm forward, f3 right arm forward (down/up views)
  function drawTorso(S, sp, f, L, mats, pose) {
    var d = S.dir, tt = L.tt, tb = L.tb, wd = L.wd;
    if (d === 'down' || d === 'up') {
      S.rect(7 - wd, tt, 6 + 2 * wd, tb - tt + 1, mats.top);
      if (pose) return;
      var sw = f === 1 ? 1 : f === 3 ? -1 : 0, s2 = f === 2 ? 1 : 0, fa = sp.forearm || 0, fm = mats.fore >= 0 ? mats.fore : mats.hand;
      [[5 - wd, d === 'down' ? sw : -sw], [13 + wd, d === 'down' ? -sw : sw]].forEach(function (a) {
        var len = 5 + a[1] + s2 * 0;
        for (var y = tt; y < tt + len; y++) { var am = y >= tt + len - fa ? fm : mats.arm; S.put(a[0], y, am); S.put(a[0] + 1, y, am); }
        S.put(a[0], tt + len, mats.hand); S.put(a[0] + 1, tt + len, mats.hand);
      });
    } else {
      // far arm swings opposite the near arm: draw it first (behind the torso)
      var near = [0, -1, 0, 1][f]; // -1 back, +1 forward
      if (pose) { S.rect(7, tt, 6, tb - tt + 1, mats.top); return; }
      var fa2 = sp.forearm || 0, fm2 = mats.fore >= 0 ? mats.fore : mats.hand;
      if (near !== 0) { var fx = near > 0 ? 7 : 12; S.put(fx, tt + 4, mats.handFar); S.put(fx, tt + 3, fa2 ? mats.handFar : mats.armFar); }
      S.rect(7, tt, 6, tb - tt + 1, mats.top);
      var ax = near > 0 ? 10 : near < 0 ? 8 : 9;
      for (var y2 = tt; y2 < tt + 4; y2++) { var o = Math.round((y2 - tt) / 4 * near), am2 = y2 >= tt + 4 - fa2 ? fm2 : mats.arm; S.put(ax + o, y2, am2); S.put(ax + 1 + o, y2, am2); }
      var hx = ax + Math.round(near * 1.2);
      S.put(hx, tt + 4, mats.hand); S.put(hx + 1, tt + 4, mats.hand);
      if (near === 0) { S.put(hx, tt + 5, mats.hand); }
    }
  }
  // player tool poses: raise (wind-up) and strike. Grip points must match HANDS below.
  function armPath(S, pts, id, hid, hand) {
    for (var i = 0; i + 1 < pts.length; i++) bez([pts[i], pts[i + 1]]).forEach(function (p) { S.put(p[0], p[1], id); S.put(p[0] + 1, p[1], id); });
    S.rect(hand[0], hand[1], hand[2], hand[3], hid);
  }
  function drawPoseArms(S, sp, L, mats, pose) {
    var d = S.dir, tt = L.tt;
    if (d === 'down' || d === 'up') {
      if (pose === 'raise') {
        armPath(S, [[5, tt], [3, tt - 5], [4, tt - 10], [7, tt - 12]], mats.arm, mats.hand, [8, tt - 13, 4, 2]);
        armPath(S, [[13, tt], [15, tt - 5], [14, tt - 10], [11, tt - 12]], mats.arm, mats.hand, [8, tt - 13, 4, 2]);
      } else if (d === 'down') {
        armPath(S, [[5, tt], [5, tt + 3], [7, tt + 5]], mats.arm, mats.hand, [8, tt + 5, 4, 2]);
        armPath(S, [[13, tt], [13, tt + 3], [11, tt + 5]], mats.arm, mats.hand, [8, tt + 5, 4, 2]);
      } else { S.rect(5, tt, 2, 3, mats.arm); S.rect(13, tt, 2, 3, mats.arm); }
    } else {
      if (pose === 'raise') armPath(S, [[9, tt + 1], [8, tt - 3], [6, tt - 6]], mats.arm, mats.hand, [5, tt - 8, 3, 2]);
      else armPath(S, [[9, tt + 1], [12, tt + 3], [14, tt + 4]], mats.arm, mats.hand, [15, tt + 3, 2, 2]);
    }
  }
  // head skull + face (eyes) in logical coordinates
  function drawHead(S, sp, L, mats) {
    var y0 = L.headY, d = S.dir, sk = sp.skin;
    var rows = [[6, 13], [5, 14], [5, 14], [5, 14], [5, 14], [5, 14], [5, 14], [5, 14], [5, 14], [6, 13]];
    rows.forEach(function (r, k) { for (var x = r[0]; x <= r[1]; x++) S.put(x, y0 + k, mats.skin); });
    // soft eyes to match the portraits: a deep shade of the eye colour over the eye colour (never near-black), a little
    // eye white in profile and a hint of blush. Designs with their own eye colours (glowing, witchy) keep them.
    var e2 = sp.eyeCol2 != null ? sp.eyeCol2 : H('#2a2238'), soft = sp.eyeCol == null || sp.eyeCol === OUT;
    var deep = Math.max(0, Math.min(0.6, (0.5 - lum(sk.b)) * 2.2)), E = soft ? mix(mix(e2, H('#1a0e18'), 0.55), H('#140a12'), deep * 0.5) : sp.eyeCol;
    var k = (sp.blushK != null ? sp.blushK : 1) * (sp.blush ? 0.8 : 0.5), bl = soft && k > 0.05 ? mix(sk.b, sk.blush, Math.min(1, k)) : -1;
    if (d === 'down') {
      S.dot(7, y0 + 5, E); S.dot(7, y0 + 6, e2); S.dot(12, y0 + 5, E); S.dot(12, y0 + 6, e2);
      if (bl >= 0) { S.dot(6, y0 + 7, bl); S.dot(13, y0 + 7, bl); }
    } else if (d !== 'up') {
      S.dot(12, y0 + 5, E); S.dot(12, y0 + 6, e2);
      if (soft) S.dot(13, y0 + 5, mix(WHITE, sk.l, 0.35)); // the eye white in front of the iris
      S.put(15, y0 + 6, mats.skin); // nose
      if (bl >= 0) S.dot(13, y0 + 7, bl);
    }
  }
  function sprMats(S, sp) {
    var sk = sp.skin, skR = [sk.s, sk.b, sk.l], skF = [mix(sk.s, sk.b, 0.4), sk.b, sk.l]; // the face takes a gentler shadow edge than the hands
    var top = sp.top, arm = sp.arm || sp.top, leg = sp.leg || HS(['#2a2238', '#3a3050', '#4e4468']), shoe = sp.shoe || HS(['#281d21', '#3e2d2b', '#574039']);
    return {
      skin: S.mat('skin', skF, { topDark: true }), hand: S.mat('hand', sp.handRamp || skR, { noTop: true }), handFar: S.mat('handF', sp.handRamp ? [sp.handRamp[0], sp.handRamp[0], sp.handRamp[1]] : [sk.d, sk.s, sk.s], { flat: true }),
      top: S.mat('top', top, { botDark: !sp.gown }), arm: S.mat('arm', arm, { noTop: true }), armFar: S.mat('armF', [arm[0], arm[0], arm[0]], { flat: true }),
      leg: S.mat('leg', leg), leg2: S.mat('leg2', leg), legFar: S.mat('legF', [leg[0], leg[0], leg[1]]), shoe: S.mat('shoe', shoe, { noTop: true }), shoe2: S.mat('shoe2', shoe, { noTop: true }), shoeFar: S.mat('shoeF', [shoe[0], shoe[0], shoe[1]], { noTop: true }),
      gown: sp.gown ? S.mat('gown', sp.gown, { noTop: true }) : -1, tails: sp.tails ? S.mat('tails', sp.tails, { noTop: true }) : -1,
      hair: S.mat('hair', [sp.hair[1], sp.hair[2], sp.hair[3]], { botDark: true }),
      fore: sp.foreRamp ? S.mat('fore', sp.foreRamp, { noTop: true }) : -1
    };
  }
  // default legend for head/hair templates
  function sprLegend(S, sp, mats, extra) {
    var R = sp.hair, lg = { H: mats.hair, h: { c: R[1] }, j: { c: R[4] }, x: { c: R[0] }, S: mats.skin, s: { c: sp.skin.s }, E: { c: OUT }, K: 'clear', b: { c: sp.skin.blush } };
    if (extra) for (var k in extra) lg[k] = extra[k];
    return lg;
  }
  function pickTpl(sp, key, dir) { // key e.g. 'hair' -> sp.hairD / hairR / hairU
    var t = sp[key + (dir === 'down' ? 'D' : dir === 'up' ? 'U' : 'R')];
    return t || null;
  }
  function renderSpr(sp, dir, f, pose) {
    var S = new Spr(dir), L = sprLayout(sp, f), mats = sprMats(S, sp);
    var leg = sprLegend(S, sp, mats, sp.legend ? sp.legend(S, mats) : null);
    S.L = L; S.f = f; S.mats2 = mats; S.leg = leg; S.sp = sp;
    function T(key, layer) { var t = pickTpl(sp, key, dir); if (t) S.tpl(t[1], t[0] + L.dy + (t[2] === 'abs' ? -L.dy : 0), leg); }
    if (sp.pre) sp.pre(S, dir, f, L);
    T('back');
    if (sp.cloak && dir !== 'up') sp.cloak.behind(S, dir, f, L);
    drawLegs(S, sp, f, L, mats);
    if (sp.gown) drawGown(S, sp, f, L, mats.gown, mats.shoe);
    if (dir === 'up') T('backU2');
    drawTorso(S, sp, f, L, mats, pose);
    if (sp.tails) drawTails(S, sp, f, L, mats.tails, sp.tailLen);
    if (sp.body) sp.body(S, dir, f, L, pose);
    if (sp.cloak) sp.cloak.front(S, dir, f, L);
    if (pose && dir === 'up') drawPoseArms(S, sp, L, mats, pose);
    drawHead(S, sp, L, mats);
    var snapM = sp.hat ? S.m.slice() : null, snapF = sp.hat ? S.fx.slice() : null;
    T('hair');
    T('extra');
    if (sp.head) sp.head(S, dir, f, L);
    if (sp.hat) { var hairIdx = []; for (var hi = 0; hi < S.m.length; hi++) if (S.m[hi] !== snapM[hi] || S.fx[hi] !== snapF[hi]) hairIdx.push(hi); sp.hat(S, dir, f, L, hairIdx, snapM, snapF); }
    if (pose && dir !== 'up') drawPoseArms(S, sp, L, mats, pose);
    if (dir === 'up') T('over');
    return S.render();
  }

  // ---------------------------------------------------------------- NPC sprite specs
  // Templates are [y0, rows] in logical right-facing coordinates for a standard-height body
  // (head rows 9..18, eyes at y 14..15); they move with the walk bob and the `short` offset.
  var SPRITES = {};
  var BOOTS = HS(['#1b1429', '#281d21', '#3e2d2b']);
  SPRITES.mirabel = {
    skin: SKIN.fair, hair: HAIR.silver, top: HS(['#245a40', '#337450', '#4c9061']), arm: HS(['#7e5cc4', '#a585e0', '#c9b0f2']), gown: HS(['#1a4434', '#245a40', '#337450']), shoe: BOOTS, blush: true,
    eyeCol2: H('#6e4a2a'),
    legend: function (S) { return { G: { c: GOLD[1] }, g: { c: H('#fff1c8') }, L: { c: H('#b99aee') }, l: { c: H('#337450') } }; },
    hairD: [3, ['.............L......', '........HHHHl.......', '.......HHHHHH.......', '.......HhHHHH.......', '........HHHH........', '......HHHHHHHH......', '.....HHHHHHHHHH.....', '....HHHHHHHHHHHH....', '....HHHhHHHHhHHH....', '....HHH......HHH....', '....HH........HH....', '.....H...GG...H.....', '......G.G..G.G......']],
    hairR: [3, ['.....L..............', '......lHHHH.........', '.....HHHHHHH........', '.....HHhHHHH........', '......HHHHH.........', '......HHHHHHHH......', '.....HHHHHHHHHH.....', '....HHHHHHHHHHHH....', '....HHHhHHHHHHH.....', '....HHHHHH..........', '....HHHHH...........', '.....HHSsGG.........', '.....HHSs....G......']],
    hairU: [3, ['........HHHH........', '.......HHHHHH.......', '.......HhHHjH.......', '........HHHH........', '......HHHHHHHH......', '.....HHHHHHHHHH.....', '....HHHHHHHHHHHH....', '....HHhHHHHHhHHH....', '....HHHhHHHhHHHH....', '....HHHHhHhHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '......HHHHHHHH......']],
    body: function (S, dir, f, L) { // lavender shawl over the green dress
      var sh = S.mat('shawl', HS(['#7e5cc4', '#a585e0', '#c9b0f2'])), t = L.tt;
      if (dir === 'down') {
        [[7, 0], [8, 0], [11, 0], [12, 0], [7, 1], [8, 1], [11, 1], [12, 1], [7, 2], [12, 2], [7, 3], [12, 3]].forEach(function (p) { S.put(p[0], t + p[1], sh); });
        S.dot(9, t, H('#f4ead8')); S.dot(10, t, H('#f4ead8')); S.dot(9, t + 2, H('#e89ab8'));
      } else if (dir === 'up') {
        for (var r = 0; r < 5; r++) for (var x = 7 + Math.floor(r / 2); x <= 12 - Math.floor(r / 2); x++) S.put(x, t + r, sh);
      } else {
        for (var r2 = 0; r2 < 3; r2++) for (var x2 = 7; x2 <= 10 - r2; x2++) S.put(x2, t + r2, sh);
      }
    }
  };
  SPRITES.pip = {
    skin: SKIN.fair, hair: HAIR.ginger, top: HS(['#4a2f7a', '#6a47a8', '#8f6cd1']), tails: HS(['#4a2f7a', '#6a47a8', '#8f6cd1']), tailLen: 3, short: 2,
    leg: HS(['#3e2d2b', '#574039', '#7a5a48']), shoe: BOOTS, blush: true, eyeCol2: H('#3a68b8'), openCoat: true,
    legend: function () { return { B: { c: H('#c8942e') }, L: { c: H('#3a8a9a') }, l: { c: H('#bff4f4') }, Q: { c: H('#574039') } }; },
    hairD: [4, ['......H...H.........', '...H..HH.HH..H......', '...HHHHHHHHHHH.H....', '..HHHHHHHHHHHHHH....', '...HBlLBBBBBBlLBH...', '...HBLLBBBBBBLLBH...', '..HHHHhHHHhHHHHHH...', '...HH.H.HH.H.HHH....', '....H........H......']],
    hairR: [4, ['..H...HH..H.........', '..HH.HHHHHH.H.......', '.HHHHHHHHHHHHH......', 'HHHHHHHHHHHHHHH.....', '.HHHHHHHBlLBBH......', 'HHHHHHHQBLLBB.......', '.HHHHHHHH.H.H.......', '..HHHHHS............', '...HHHH.............', '....HH..............']],
    hairU: [4, ['......H...H.........', '...H..HH.HH..H......', '...HHHHHHHHHHH.H....', '..HHHHHHHHHHHHHH....', '...HHHHHHHHHHHHH....', '...HQQQQQQQQQQQQH...', '..HHHHhHHHhHHHHHH...', '...HHHHHHHHHHHHH....', '....HHHHhHHHHHH.....', '....HHHHHHHHHHH.....', '.....HHHHHHHHH......']],
    head: function (S, dir, f, L) {
      var y = L.headY;
      if (dir === 'down') { S.dot(13, y + 7, H('#7a6a76')); S.dot(8, y + 8, H('#4a1a2e')); S.dot(9, y + 8, H('#f4f2fb')); S.dot(10, y + 8, H('#4a1a2e')); S.dot(11, y + 8, H('#f4f2fb')); }
      else if (dir !== 'up') S.dot(14, y + 8, H('#4a1a2e'));
    },
    body: function (S, dir, f, L) { if (dir === 'down') { S.dot(9, L.tt, H('#f4ead8')); S.dot(10, L.tt, H('#f4ead8')); S.dot(5, L.tt + 2, H('#4c9061')); } if (dir === 'up') S.dot(11, L.tt + 2, H('#c8922e')); }
  };
  SPRITES.sable = {
    skin: skinR('#5c3828', '#80543a', '#a0704c', { d: '#42241e', line: '#22101a', blush: '#9a5040' }), hair: HAIR.black, top: HS(['#5e1630', '#86223f', '#a83a58']), arm: HS(['#9a8a86', '#cfc0b4', '#efe4d8']), gown: HS(['#2a0e1c', '#3e1428', '#5e1630']), shoe: BOOTS,
    eyeCol: OUT, eyeCol2: H('#e09a30'),
    legend: function () { return { G: { c: GOLD[2] }, g: { c: GOLD[1] }, V: { c: H('#b99aee') } }; },
    hairD: [8, ['.....HHHHHHHHHH.....', '....HHHHHhHHHHHH....', '....HHHHHhHHHHHH....', '....HH........HH....', '....H..........H....', '....H..........H....', '...HHG........GHH...', '...HH..........HH...', '...HH..........HH...', '...GH..........HG...', '...HH..........HH...', '...HV..........HH...', '...HH..........VH...', '...GG..........GG...', '...HH..........HH...']],
    hairR: [8, ['.....HHHHHHHHHH.....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHH.....', '...HHHHHHH..........', '...HHHHHH...........', '...HHHHHSs..........', '...HHHHHG...........', '...HHHH.............', '...HHHH.............', '...GGHH.............', '...HHHH.............', '...HVHH.............', '...HHHG.............', '....GG..............', '....HH..............']],
    hairU: [8, ['.....HHHHHHHHHH.....', '....HHhHHHHhHHHH....', '....HHhHHHHhHHHH....', '....HHhHHHHhHHHH....', '....HHhHHHHhHHHH....', '....HHHHHHHHHHHH....', '....HGHHGHHGHHGH....', '....HHHHHHHHHHHH....', '....HHVHHHHHHVHH....', '....HHHHHHHHHHHH....', '....HHGHHGHHGHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....GHHGHHGHHG.....', '.....HHHHHHHHHH.....']],
    head: function (S, dir, f, L) { if (dir === 'down') { S.dot(9, L.headY + 8, H('#4a2228')); S.dot(10, L.headY + 8, H('#4a2228')); S.dot(11, L.headY + 7, H('#4a2228')); } },
    body: function (S, dir, f, L) { if (dir === 'down') { for (var x = 7; x <= 12; x++) S.dot(x, L.tt + 2, GOLD[2]); S.dot(9, L.tt + 4, GOLD[1]); S.dot(10, L.tt + 5, GOLD[1]); } }
  };
  SPRITES.brann = {
    skin: SKIN.tan, hair: HS(['#3e1210', '#7a2418', '#b8402a', '#e0663a', '#f6a060']), top: HS(['#2d2c3e', '#45445a', '#605f78']), arm: [SKIN.tan.s, SKIN.tan.b, SKIN.tan.l], wide: 1,
    leg: HS(['#281d21', '#3e2d2b', '#574039']), shoe: BOOTS,
    legend: function (S) { return { A: S.mat('apron', HS(['#3e2d2b', '#574039', '#7a5a48'])), R: S.mat('beard', HS(['#7a2418', '#b8402a', '#e0663a']), { botDark: true }), r: { c: H('#7a2418') }, I: { c: H('#a09fb6') }, c: { c: H('#d0807a') }, l: { c: H('#f8d6b8') } }; },
    hairD: [9, ['.......ll...........', '......l.....cc......', '.............c......', '....................', '.....rrr....rrr.....', '....R..........R....', '....RR........RR....', '....RRRRrrrrRRRR....', '....RRRRRRRRRRRR....', '.....RRRRRRRRRR.....', '.....RRRRRRRRRR.....', '......RRRRRRRR......', '......RRRIIRRR......', '.......RRRRRR.......', '........RIIR........', '........RRRR........']],
    hairR: [9, ['.......ll...........', '......l...cc........', '...........c........', '....................', '...........rrr......', '.........R..........', '.........RR.........', '.........RRRRrrr....', '.........RRRRRRRR...', '..........RRRRRRR...', '..........RRRRRR....', '...........RRRRR....', '...........RIIR.....', '...........RRR......', '............RR......']],
    hairU: [9, ['....................', '............cc......', '.............c......', '....................', '....S..........S....', '....R..........R....', '....R..........R....', '....RR........RR....']],
    body: function (S, dir, f, L) { // leather apron over the shirt
      var A = S.leg.A, t = L.tt;
      if (dir === 'down') { S.rect(7, t + 2, 6, L.tb - t - 1, A); S.put(7, t, A); S.put(12, t, A); S.put(7, t + 1, A); S.put(12, t + 1, A); S.dot(7, t + 2, H('#a09fb6')); S.dot(12, t + 2, H('#a09fb6')); }
      else if (dir === 'up') { S.dot(7, t, H('#574039')); S.dot(8, t + 1, H('#574039')); S.dot(9, t + 2, H('#574039')); S.dot(10, t + 2, H('#574039')); S.dot(11, t + 1, H('#574039')); S.dot(12, t, H('#574039')); S.dot(9, L.tb - 1, H('#574039')); S.dot(10, L.tb - 1, H('#574039')); }
      else { S.rect(11, t + 2, 2, L.tb - t - 1, A); S.put(12, t + 3, A); S.put(13, t + 4, A); S.put(13, t + 5, A); }
    }
  };
  SPRITES.orvyn = {
    skin: SKIN.pale, hair: HS(['#6e6a88', '#aaa6c0', '#d6d4e6', '#eeedf6', '#ffffff']), top: HS(['#17224c', '#213479', '#2e4f9f']), gown: HS(['#101a40', '#17224c', '#213479']), shoe: HS(['#120c1c', '#1b1429', '#2a2238']),
    eyeCol2: H('#4a8ac8'),
    legend: function (S) { return { T: S.mat('hat', HS(['#22225a', '#33367f', '#4a50a8'])), t: { c: H('#141236') }, W: S.mat('beard', HS(['#aaa6c0', '#d6d4e6', '#ffffff']), { botDark: true }), w: { c: H('#aaa6c0') }, '*': { c: WHITE }, '+': { c: H('#c8d4f0') }, M: { c: GOLD[2] }, G: { c: GOLD[1] } }; },
    hairD: [0, ['..........TT........', '.........TTTT.......', '........TT*TT.......', '.......TTTTTTT......', '.......TTTTTTT......', '......TTTT+TTTT.....', '......TTTTTTTTT.....', '.....TTTTTTMTTTT....', '..TTTTTTTTTTTTTTTT..', '...tttttttttttttt...', '....WW........WW....', '....WW........WW....', '....WW........WW....', '....WWWWW..WWWWW....', '....WW........WW....', '....WWGGG..GGGWW....', '....WWWWWWWWWWWW....', '.....WWWWwwWWWWW....', '.....WWWWWWWWWW.....', '......WWWWWWWW......', '......WWWWWWWW......', '.......WWWWWW.......', '........WWWW........']],
    hairR: [0, ['.....TT.............', '.....TTTT...........', '......TTTT..........', '.......TTTT.........', '.......TTTT*........', '......TTTTTTT.......', '......TTTT+TT.......', '.....TTTTTTTTT......', '..TTTTTTTTTTTTTTTT..', '...tttttttttttttt...', '....WWWWWW..........', '....WWWWWW..........', '....WWWWWW..........', '....WWWWW.WWWW......', '....WWWWWS..........', '....WWWWW...GGG.....', '....WWWW..WWWWWW....', '....WWW...WWWWWW....', '....WW....WWWWWW....', '.....W....WWWWW.....', '..........WWWWW.....', '..........WWWW......', '...........WWW......', '...........WW.......']],
    hairU: [0, ['..........TT........', '.........TTTT.......', '........TTTTT.......', '.......TTTTTTT......', '.......TTT*TTT......', '......TTTTTTTTT.....', '......TTTTTT+TT.....', '.....TTTTTTTTTTT....', '..TTTTTTTTTTTTTTTT..', '...TTTTTTTTTTTTTT...', '....WWWWWWWWWWWW....', '....WWWwWWWWwWWW....', '....WWWWwWWwWWWW....', '....WWWWWWWWWWWW....', '....WWwWWWWWWwWW....', '.....WWWWwwWWWW.....', '.....WWWWWWWWWW.....', '......WWWWWWWW......', '.......WWWWWW.......']]
  };
  SPRITES.elowen = {
    skin: SKIN.olive, hair: HAIR.moss, top: HS(['#18443e', '#235c50', '#347a62']), gown: HS(['#0f2e2c', '#18443e', '#235c50']), shoe: HS(['#281d21', '#3e2d2b', '#574039']), blush: true,
    eyeCol2: H('#4c9a4a'),
    legend: function (S) { return { L: { c: H('#74b46e') }, l: { c: H('#a8dc8c') }, w: { c: H('#7a5a48') }, C: S.mat('cloak', HS(['#0f2e2c', '#18443e', '#235c50'])) }; },
    hairD: [6, ['.......L.lL.........', '.....LwwwwwwwL......', '....LHHHHHHHHHHl....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHH...HH....', '.S..HH.......HHH..S.', '..SSHH........HHSS..', '....HH........HH....', '....HH........HH....', '....HH........HH....', '....HH........HH....', '....HH........HH....', '....H..........H....']],
    hairR: [6, ['......L.lL..........', '.....wwwwwwwL.......', '....HHHHHHHHHHl.....', '....HHHHHHHHHHHH....', '..S.HHHHHHHHHHHH....', '...SSHHHHHHHH.......', '....HSSHHHH.........', '....HHHSSHH.........', '....HHHHHH..........', '....HHHHH...........', '....HHHHH...........', '....HHHH............', '....HHHH............', '....HHH.............']],
    hairU: [6, ['.......L.lL.........', '.....LwwwwwwwL......', '....LHHHHHHHHHHl....', '....HHHHHHHHHHHH....', '....HHHhHHHHhHHH....', '....HHHHHHHHHHHH....', '.S..HHhHHHHHHhHH..S.', '..SSHHHHHHHHHHHHSS..', '....HHHhHHHhHHHH....', '....HHHHHHHHHHHH....', '....HhHHHhHHHHhH....', '.....HHHHHHHHHH.....', '.....HHhHHHhHHH.....', '......HHHHHHHH......']],
    body: function (S, dir, f, L) { if (dir === 'down') { S.dot(9, L.tt + 1, H('#9c7a5e')); S.dot(10, L.tt + 1, H('#7a5a48')); } if (dir === 'up') { S.rect(6, L.tt, 8, 2, S.leg.C); } }
  };
  SPRITES.grizelda = {
    skin: SKIN.witch, hair: HS(['#120c1c', '#2e2442', '#4a4060', '#6e6a84', '#a09cb4']), top: HS(['#31233d', '#43324d', '#56425f']), gown: HS(['#22182c', '#31233d', '#43324d']), shoe: BOOTS,
    eyeCol: H('#f2d040'), eyeCol2: H('#8a6a10'),
    legend: function (S) { return { T: S.mat('hat', HS(['#2e1f45', '#45306a', '#604e88'])), t: { c: H('#1b1429') }, Q: { c: H('#2f5a3e') }, F: { c: H('#46395c') }, f: { c: H('#8a6ad0') }, N: S.mat('nose', [SKIN.witch.s, SKIN.witch.b, SKIN.witch.l]) }; },
    hairD: [0, ['............TT......', '..........TTTT......', '.........TTTT.......', '..f.....TTTT........', '...F...TTTTTT.......', '....F.TTTTTTTT......', '......TTTTTTTT......', '.....QQQQQQQQQQ.....', '.TTTTTTTTTTTTTTTTTT.', '..ttttttttttttttt...', '..HHHH........HHHH..', '.HHHHH........HHHHH.', '..HHH..........HHH..', '.HHHH...........HHH.', '..HH............HH..', '...H............H...']],
    hairR: [0, ['..TT................', '..TTTT..............', '...TTTT.............', '....TTTT.........f..', '....TTTTTT......F...', '.....TTTTTTT...F....', '.....TTTTTTTT.F.....', '.....QQQQQQQQQQ.....', '.TTTTTTTTTTTTTTTTTT.', '..ttttttttttttttt...', '..HHHHHHHH..........', '.HHHHHHHH...........', '..HHHHHH............', '.HHHHHH.............', '..HHHH..............', '...HH...............']],
    hairU: [0, ['............TT......', '..........TTTT......', '.........TTTT.......', '........TTTT...f....', '.......TTTTTT.F.....', '......TTTTTTTF......', '......TTTTTTTT......', '.....QQQQQQQQQQ.....', '.TTTTTTTTTTTTTTTTTT.', '..TTTTTTTTTTTTTTTT..', '..HHHHHHHHHHHHHHHH..', '.HHHhHHHHjHHHhHHHHH.', 'HHHHHhHHHHHHhHHHHHH.', '.HHHHHhHHHHhHHHHHHHH', '..HHhHHHHjHHHHhHHH..', '.HHHHhHHHHHHhHHHH...', '...HHHHHhHHHHHHH....', '....HH.HHH.HH.HH....']],
    head: function (S, dir, f, L) {
      var y = L.headY;
      if (dir === 'down') { S.put(9, y + 6, S.leg.N); S.put(10, y + 6, S.leg.N); S.put(10, y + 7, S.leg.N); S.dot(8, y + 8, H('#1f2a1e')); S.dot(9, y + 8, H('#f4f2fb')); S.dot(10, y + 8, GOLD[2]); S.dot(11, y + 8, H('#1f2a1e')); }
      else if (dir !== 'up') { S.put(15, y + 6, S.leg.N); S.put(16, y + 7, S.leg.N); S.put(15, y + 7, S.leg.N); S.dot(13, y + 8, H('#1f2a1e')); S.dot(14, y + 8, GOLD[2]); }
    },
    body: function (S, dir, f, L) { if (dir === 'down') { S.dot(9, L.tt + 2, H('#ffbc62')); S.dot(8, L.tt + 1, H('#e8e0d0')); S.dot(11, L.tt + 1, H('#e8e0d0')); } }
  };
  SPRITES.corvin = {
    skin: SKIN.cool, hair: HAIR.black, top: HS(['#201a32', '#2e2646', '#41385e']), tails: HS(['#201a32', '#2e2646', '#41385e']), tailLen: 4, leg: HS(['#120c1c', '#1b1429', '#2a2238']), shoe: BOOTS,
    eyeCol2: H('#5e3f9e'),
    legend: function (S) { return { C: S.mat('collar', HS(['#201a32', '#2e2646', '#41385e'])), I: { c: H('#c4c3d6') } }; },
    hairD: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HjHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHH..HH....', '....HHHHHHH....HH...', '....HHHHHH......H...', '....HHHHH...........', '....HHHH............', '.....HH.......I.....', '...CC..........CC...', '...CC..........CC...']],
    hairR: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HjHHHHHHHHHHH...', '....HHHHHHHHHHHHHH..', '....HHHHHHHHHHHHH...', '....HHHHHHH..HHH....', '....HHHHHHH...HH....', '....HHHHHS.....H....', '....HHHHHI..........', '.....HHH............', '....CCC.............', '....CCC.............']],
    hairU: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HjHHHHjHHHHH....', '....HHhHHHHHHhHH....', '....HHHHjHHHHHHH....', '....HHHhHHHHhHHH....', '....HHHHHHHHHHHH....', '....HhHHHhHHHHhH....', '....HHHHHHHHHHHH....', '.....HHhHHHHhHH.....', '...CCCCCCCCCCCCCC...', '...CCCCCCCCCCCCCC...']],
    head: function (S, dir, f, L) { // in the right view his swept fringe covers the (right) eye
      if (dir === 'right') { S.put(11, L.headY + 4, S.mats2.hair); S.put(12, L.headY + 5, S.mats2.hair); S.put(12, L.headY + 4, S.mats2.hair); S.put(13, L.headY + 5, S.mats2.hair); S.put(12, L.headY + 6, S.mats2.hair); }
    },
    body: function (S, dir, f, L) { if (dir === 'down') { S.dot(9, L.tt, H('#5a2238')); S.dot(10, L.tt, H('#5a2238')); S.dot(9, L.tt + 1, H('#3a1428')); S.dot(8, L.tt + 2, H('#c4c3d6')); } }
  };
  SPRITES.lune = {
    skin: SKIN.brown, hair: HS(['#3a4468', '#6a7aa8', '#9fb0d8', '#c8d4f0', '#eef2ff']), top: HS(['#12484e', '#1c6668', '#2c8884']), tails: HS(['#12484e', '#1c6668', '#2c8884']), tailLen: 3,
    leg: HS(['#1b1a26', '#2d2c3e', '#45445a']), shoe: BOOTS, eyeCol2: H('#4a8ac8'), openCoat: true,
    legend: function (S) { return { T: S.mat('hat', HS(['#18224c', '#24346c', '#34488c'])), V: { c: H('#1b1429') }, G: { c: GOLD[2] }, g: { c: GOLD[1] }, P: { c: OUT }, p: { c: H('#2e2442') } }; },
    hairD: [5, ['......TTTTTTTT......', '.....TTTTTTTTTT.....', '....TTTTTGTTTTTT....', '....TTTTTTTTTTTT....', '....gggggggggggg....', '....VVVVVVVVVVVV....', '....HH........HH....', '....HH...p....HH....', '....H.......PP.H....', '.............PP.....']],
    hairR: [5, ['.....TTTTTTTT.......', '....TTTTTTTTTT......', '....TTTTTTTTGTT.....', '....TTTTTTTTTTT.....', '....ggggggggggg.....', '....HVVVVVVVVVVVV...', '....HHHHH...........', '....HHHHH...........', '....HHHH............', '.....HH.............']],
    hairU: [5, ['......TTTTTTTT......', '.....TTTTTTTTTT.....', '....TTTTTTTTTTTT....', '....TTTTTTTTTTTT....', '....gggggggggggg....', '....TTTTTTTTTTTT....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '......HHHHHHHH......']],
    head: function (S, dir, f, L) {
      var y = L.headY;
      if (dir === 'left') { S.dot(12, y + 5, OUT); S.dot(12, y + 6, OUT); S.dot(11, y + 5, OUT); S.dot(13, y + 5, H('#2e2442')); S.dot(10, y + 4, H('#2e2442')); }
      if (dir === 'right') { S.dot(10, y + 3, H('#2e2442')); S.dot(11, y + 3, H('#2e2442')); S.dot(13, y + 7, H('#d8a080')); }
      if (dir === 'down') S.dot(8, y + 7, H('#d8a080'));
    },
    body: function (S, dir, f, L) { if (dir === 'down') { S.dot(9, L.tt, H('#b43a30')); S.dot(10, L.tt, H('#d85a40')); S.dot(9, L.tt + 1, H('#b43a30')); S.dot(7, L.tt + 3, GOLD[2]); S.dot(12, L.tt + 3, GOLD[2]); S.dot(5, L.tt, GOLD[2]); S.dot(6, L.tt, GOLD[1]); S.dot(13, L.tt, GOLD[1]); S.dot(14, L.tt, GOLD[2]); } }
  };
  // ---- expansion villagers (DESIGN2 §2)
  SPRITES.elvis = {
    skin: SKIN.fair, hair: HS(['#3a0a16', '#6e1228', '#a8203c', '#d6485a', '#f4848c']), top: HS(['#1e1a2c', '#2e2842', '#443a5e']), arm: HS(['#a8a4bc', '#dcdae8', '#ffffff']), forearm: 2,
    leg: HS(['#120c1c', '#1e1a2c', '#2e2842']), shoe: HS(['#0b0711', '#1b1429', '#2a2238']), eyeCol2: H('#2ea4f6'),
    legend: function (S) { return { W: { c: H('#f2f0f8') }, Q: S.mat('temple', HS(['#8e8aa8', '#b8b4cc', '#dad6ea']), { botDark: true }) }; },
    hairD: [4, ['......HHHH..........', '....HHhHHWWH........', '...HHHHhHHWWHH......', '...HhHHHhHHWWHH.....', '...HHhHHHhHHWHHH....', '....HHhHHHHHWHHH....', '....HHHHhHHHWhHH....', '....QHHHHHHHHHHQ....', '....QQ.H......QQ....', '....QQ........QQ....', '.....Q........Q.....']],
    hairR: [4, ['.........HHH........', '.......HHHWWHH......', '.....HHHhHHWWHHH....', '....HHhHHHhHHWHHH...', '....HHHhHHHhHHWHH...', '....HHHHhHHHHhHHH...', '....HHHHHHHHHHHH....', '....QQHHHHHHHH......', '....QQQQQ...........', '....QQQQS...........', '.....QQ.............']],
    hairU: [4, ['......HHHH..........', '....HHhHHWWH........', '...HHHHhHHWWHH......', '...HhHHHhHHWWHH.....', '...HHhHHHhHHWWHH....', '...HHHhHHHhHHWHH....', '....HHHhHHHhHHHH....', '....HhHHHhHHHhHH....', '....QHHHHHHHHHHQ....', '....QQHHHHHHHHQQ....', '.....QQQQQQQQQQ.....']],
    head: function (S, dir, f, L) {
      var y = L.headY, stub = mix(SKIN.fair.s, H('#6e1228'), 0.35);
      if (dir === 'down') { S.dot(8, y + 8, H('#583d3d')); S.dot(9, y + 8, WHITE); S.dot(10, y + 8, WHITE); S.dot(11, y + 8, H('#583d3d')); S.dot(6, y + 8, stub); S.dot(13, y + 8, stub); S.dot(9, y + 9, stub); S.dot(5, y + 7, H('#e8eeff')); }
      else if (dir !== 'up') { S.dot(13, y + 8, WHITE); S.dot(14, y + 8, H('#583d3d')); S.dot(11, y + 8, stub); S.dot(9, y + 7, H('#e8eeff')); }
    },
    body: function (S, dir, f, L) { // bow tie, shirt front, brass buttons
      var t = L.tt;
      if (dir === 'down') { S.dot(8, t, H('#f2f0f8')); S.dot(11, t, H('#f2f0f8')); S.dot(9, t, OUT); S.dot(10, t, OUT); S.dot(9, t + 1, H('#eceaf4')); S.dot(10, t + 1, H('#c4c0d4')); S.dot(9, t + 3, GOLD[2]); S.dot(9, t + 5, GOLD[2]); }
      else if (dir === 'up') { S.dot(8, t + 4, H('#7e7d97')); S.dot(9, t + 4, H('#c4c3d6')); S.dot(10, t + 4, H('#c4c3d6')); S.dot(11, t + 4, H('#7e7d97')); }
      else { S.dot(12, t, OUT); S.dot(12, t + 1, H('#eceaf4')); S.dot(12, t + 3, GOLD[2]); }
    }
  };
  SPRITES.isolde = {
    skin: SKIN.pale, hair: HS(['#4a3e6a', '#8e82b8', '#b8acd8', '#dcd2f0', '#f6f2ff']), top: HS(['#3e1438', '#5c2254', '#7c3672']), gown: HS(['#22091f', '#3e1438', '#5c2254']), shoe: BOOTS,
    eyeCol2: H('#3a8a58'),
    legend: function (S) { return { C: S.mat('collar', HS(['#3e1438', '#5c2254', '#7c3672'])), G: { c: H('#1b1022') }, p: { c: H('#f2ecf6') } }; },
    hairD: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHG......GHH....', '....HpGGG..GGGpH....', '....HH........HH....', '....HHp......pHH....', '.....HH......HH.....', '...CC..........CC...', '...CC..........CC...']],
    hairR: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHH.....', '....HHHHHHHHHHH.....', '....HHHHHHHH.G......', '....HHHHHHHpGGG.....', '....HHHHHHH.........', '....HHHHHHHp........', '.....HHHHHHHH.......', '....CCC.............', '....CCC.............']],
    hairU: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHjjjjjjHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '...CCCCCCCCCCCCCC...', '...CCCCCCCCCCCCCC...']],
    head: function (S, dir, f, L) { if (dir === 'down') { S.dot(9, L.headY + 8, H('#86285e')); S.dot(10, L.headY + 8, H('#86285e')); } else if (dir !== 'up') S.dot(14, L.headY + 8, H('#86285e')); },
    body: function (S, dir, f, L) { // tape measure + moth brooch
      var t = L.tt, Y = H('#e8c84a'), y2 = H('#9a7a1e');
      if (dir === 'down') { for (var k = 0; k < 4; k++) { S.dot(8, t + k, k % 2 ? y2 : Y); if (k < 3) S.dot(11, t + k, k % 2 ? Y : y2); } S.dot(7, t + 1, H('#e8d8a0')); }
      else if (dir === 'up') { S.dot(9, t, Y); S.dot(10, t, Y); }
      else { S.dot(11, t, Y); S.dot(11, t + 1, y2); S.dot(11, t + 2, Y); }
    }
  };
  SPRITES.seraphine = {
    skin: SKIN.tan, hair: HS(['#2e2650', '#6a5aa0', '#9886cc', '#c4b6ec', '#eee8ff']), top: HS(['#a8a4bc', '#dcdae8', '#ffffff']), gown: HS(['#8a86a2', '#c4c0d6', '#e8e6f2']), shoe: HS(['#3e2d2b', '#574039', '#7a5a48']),
    eyeCol2: H('#7e86a2'),
    legend: function (S) { return { A: S.mat('apron', HS(['#3e2d2b', '#574039', '#7a5a48'])) }; },
    hairD: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHH.HH....', '....HHHHH.....HH....', '....HH........H.....']],
    hairR: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHHH...', '....HHHHHHHHHHH.....', '....HHHHHH..........', '....HHHHS...........', '.....HH.............']],
    hairU: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHhHHHHhHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '......HHHHHHHH......']],
    head: function (S, dir, f, L) { // glints of rainbow glass glitter on the cheeks
      var y = L.headY;
      if (dir === 'down') { S.dot(6, y + 7, H('#ff7aa8')); S.dot(13, y + 7, H('#7ad8ff')); S.dot(8, y + 7, H('#fff3a0')); }
      else if (dir !== 'up') { S.dot(13, y + 7, H('#c4a0ff')); S.dot(11, y + 7, H('#8affc4')); }
    },
    body: function (S, dir, f, L) { // leather apron over the white robe, loupe on a chain
      var A = S.leg.A, t = L.tt;
      if (dir === 'down') { S.rect(8, t + 1, 4, 28 - t, A); S.put(8, t, A); S.put(11, t, A); S.dot(9, t + 2, GOLD[2]); S.dot(10, t + 2, H('#a8d8f0')); }
      else if (dir === 'up') { S.dot(8, t + 3, H('#574039')); S.dot(9, t + 4, H('#574039')); S.dot(10, t + 4, H('#574039')); S.dot(11, t + 3, H('#574039')); }
      else { for (var y = t + 1; y <= 28; y++) S.put(12 + (y > L.tb ? 1 : 0), y, A); S.dot(12, t + 2, GOLD[2]); }
    }
  };
  SPRITES.fennick = {
    skin: skinR('#c98e74', '#ebb79a', '#f8d6c0', { blush: '#e8887a' }), hair: HAIR.brown, top: HS(['#3e2a20', '#5a4030', '#7a5a40']), tails: HS(['#2a1a12', '#3e2a20', '#5a4030']), tailLen: 3,
    leg: HS(['#2a2418', '#3e3424', '#574a34']), shoe: BOOTS, eyeCol2: H('#6e4a2a'), blush: true,
    legend: function (S) {
      return { T: S.mat('hat', HS(['#4a4030', '#6a5a40', '#8a7a58'])), t: { c: H('#2a2418') }, R: S.mat('beard', HS(['#3e2a20', '#6a4630', '#8e6448']), { botDark: true }), w: { c: TEETH },
        F: { c: H('#d87a30') }, f: { c: H('#3e2a20') }, p: { c: H('#c44a3a') }, q: { c: H('#3a68b8') }, g: { c: GOLD[2] },
        P: S.mat('pack', HS(['#3e2d2b', '#574039', '#7a5a48'])), O: S.mat('roll', HS(['#12484e', '#1c6668', '#2c8884'])), k: { c: H('#281d21') }, l: { c: H('#ffbc62') }, m: { c: H('#7e7d97') } };
    },
    hairD: [3, ['.............F......', '............FF......', '.......TTTTFF.......', '......TTpTTTT.......', '......TTTTqTT.......', '...TTTTTTTTTTTTTT...', '..TTTTTTTTTTTTTTTT..', '.TT..............TT.', '....................', '....................', '......g.............', '....................', '....R..........R....', '....RR........RR....', '....RRRRRwwRRRRR....', '....RRRRRRRRRRRR....', '.....RRRRRRRRRR.....', '......RRRRRRRR......', '.......RRRRRR.......']],
    hairR: [3, ['..F.................', '..FF................', '...FFTTTT...........', '.....TTTTTpT........', '.....TTTTTTTT.......', '..TTTTTTTTTTTTTTT...', '.TTTTTTTTTTTTTTTTT..', 'TT.................T', '....................', '....................', '....................', '....................', '.........R..........', '.........RR.........', '.........RRRRRw.....', '.........RRRRRRRR...', '..........RRRRRRR...', '...........RRRRR....', '............RRR.....']],
    hairU: [3, ['......F.............', '......FF............', '.......FTTTT........', '......TTTTTTT.......', '......TTTTTTT.......', '...TTTTTTTTTTTTTT...', '..TTTTTTTTTTTTTTTT..', '.TT..............TT.', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....RHHHHHHHHHHR....', '....RR........RR....']],
    backD: [12, ['..OOOOOOOOOOOOOOOO..', '..OOOOOOOOOOOOOOOO..', '...PPPPPPPPPPPPPP...', '...PPPPPPPPPPPPPP...', '...PPPPPPPPPPPPPP...', '...PPPPPPPPPPPPPP...', '...PPPPPPPPPPPPPP...', '...PPPPPPPPPPPPPPl..', '...PPPPPPPPPPPPPPl..', '...PPPPPPPPPPPPPP...', '...PPPPPPPPPPPPPP...', '....PPPPPPPPPPPP....']],
    backR: [12, ['.OOOOOO.............', '.OOOOOO.............', '.PPPPPP.............', '.PPPPPP.............', 'PPPPPPP.............', 'PPgPPPP.............', 'PPPPPPP.............', 'PPPPPPP.............', 'PPPPPPP.............', 'PkPPPPP.............', 'PPPPPPP.............', 'PPPPPP..............', '.PPPP...............', '..mm................']],
    overU: [12, ['..OOOOOOOOOOOOOOOO..', '..OOOOOOOOOOOOOOOO..', '...PPPPPPPPPPPPPP...', '...PPPPPPPPPPPPPP...', '...PPgPPPPPPPPgPP...', '...PPPPPPPPPPPPPP...', '...PPPPkkkkkPPPPP...', '...PPPPkPPPkPPPPP...', '...PPPPkkkkkPPPPPl..', '...PPPPPPPPPPPPPPl..', '...PPPPPPPPPPPPPP...', '...PPPPPPPPPPPPPP...', '....PPPPPPPPPPPP....', '.....m........m.....']],
    head: function (S, dir, f, L) { // monocle
      var y = L.headY;
      if (dir === 'down') { S.dot(6, y + 5, GOLD[2]); S.dot(8, y + 5, GOLD[1]); S.dot(7, y + 4, GOLD[2]); S.dot(6, y + 7, GOLD[1]); }
    },
    body: function (S, dir, f, L) { // long striped scarf + pack straps
      var t = L.tt, Y = H('#e0b040'), Z = H('#1c6668'), k = H('#281d21');
      if (dir === 'down') { for (var x = 7; x <= 12; x++) S.dot(x, t, x % 2 ? Y : Z); for (var y = t + 1; y < t + 6; y++) { S.dot(11, y, (y - t) % 2 ? Y : Z); S.dot(12, y, (y - t) % 2 ? Z : Y); } S.dot(7, t + 1, k); S.dot(7, t + 2, k); S.dot(12, t + 1, k); }
      else if (dir === 'up') { S.dot(8, t, Y); S.dot(9, t, Z); S.dot(10, t, Y); S.dot(11, t, Z); }
      else { S.dot(10, t, Y); S.dot(11, t, Z); S.dot(12, t, Y); for (var y2 = t; y2 < t + 4; y2++) S.dot(7, y2, (y2 - t) % 2 ? Z : Y); S.dot(9, t + 1, k); S.dot(9, t + 2, k); }
    }
  };

  // ---- round 3 villagers (DESIGN3 §1); laura/jasmine/amara come in variants _a and _b
  function curlDots(S, L, R) { for (var y = L.headY - 6; y < L.headY + 12; y++) for (var x = 0; x < SW; x++) { if (S.idAt(x, y) !== S.mats2.hair) continue; if ((x * 2 + y * 3) % 5 === 0) S.dot(x, y, R[1]); else if ((x * 2 + y * 3) % 5 === 2 && (x + y) % 3 === 0) S.dot(x, y, R[3]); } }
  function legDots(S, test) { for (var y = 24; y < SH; y++) for (var x = 0; x < SW; x++) { var id = S.idAt(x, y); if ((id === S.mats2.leg || id === S.mats2.leg2) && test(x, y)) S.dot(x, y, test(x, y)); } }
  SPRITES.laura_a = {
    skin: SKIN.cool, hair: HAIR.black, top: HS(['#17121f', '#262033', '#3c3450']), tails: HS(['#4a1426', '#7a2238', '#a43a50']), tailLen: 2,
    leg: HS(['#a090a8', '#c8b8cc', '#e2d5e0']), shoe: HS(['#0b0711', '#1b1429', '#2a2238']), eyeCol2: H('#5e3f9e'), blush: true,
    legend: function (S, mats) { var vi = S.mat('violet', HS(['#36185a', '#56288a', '#7a44b4']), { botDark: true }); return S.dir === 'left' ? { H: vi, V: mats.hair } : { V: vi }; },
    hairD: [6, ['......H..H.V........', '....HHHHHHVVVV......', '....HHHHHHVVVVVV....', '...HHHHHHHVVVVVVV...', '....HHHHHHVVVVVV....', '....HHHHHHVVVVVV....', '....HH.H.H.V.V.VV...', '...HH..........VV...', '...HH..........VV...', '...H.H........V.V...', '..H..H........V..V..']],
    hairR: [6, ['.....H..H.H.........', '....HHHHHHHHH.......', '...HHHHHHHHHHHH.....', '..HHHHHHHHHHHHHH....', '...HHHHHHHHHHHHH....', '...HHHHHHHHHH.HH....', '..HHHHHHHH..H.......', '..HHHHHHHS..........', '..HHHHHHH...........', '.H.HHHHH............', '..H.H.H.............']],
    hairU: [6, ['......V..H.H........', '....VVVVVVHHHH......', '....VVVVVVHHHHHH....', '...VVVVVVVHHHHHHH...', '...VVVVVVVHHHHHHH...', '...VVVVVVVHHHHHHH...', '...VVVVVVVHHHHHHH...', '...VVVVVVVHHHHHHH...', '...VVVVVVVHHHHHHH...', '..V.VVVVVVHHHHHH.H..', '..V..V.V.H.H.H..H...']],
    head: function (S, dir, f, L) { var y = L.headY; if (dir === 'down') { S.dot(6, y + 4, OUT); S.dot(13, y + 4, OUT); S.dot(9, y + 8, H('#6a1e4a')); S.dot(10, y + 8, H('#6a1e4a')); } else if (dir !== 'up') { S.dot(13, y + 4, OUT); S.dot(14, y + 8, H('#6a1e4a')); } },
    body: function (S, dir, f, L) { // tee + skull print, spiked choker, plaid lines, fishnets
      var t = L.tt;
      if (dir === 'down') { for (var y = t + 1; y < L.tb; y++) { S.dot(9, y, H('#2d2c3e')); S.dot(10, y, H('#2d2c3e')); } S.dot(9, t + 2, H('#eceaf4')); S.dot(10, t + 2, H('#eceaf4')); }
      for (var x = 7; x <= 12; x++) S.dot(x, t, x === 9 ? SILVER[2] : OUT);
      for (var y2 = L.tb - 1; y2 <= L.tb + 2; y2++) for (var x2 = 0; x2 < SW; x2++) if (S.idAt(x2, y2) === S.mats2.tails && (x2 % 3 === 0 || y2 === L.tb + 1)) S.dot(x2, y2, x2 % 3 === 0 ? H('#2a0a14') : H('#c8607a'));
      legDots(S, function (x, y) { return (x + y) % 2 === 0 ? H('#2a2238') : 0; });
    }
  };
  SPRITES.laura_b = {
    skin: SKIN.pale, hair: HAIR.black, top: HS(['#1a1624', '#262036', '#3a3250']), arm: HS(['#4a2f7a', '#6a47a8', '#8f6cd1']), tails: HS(['#0e0a16', '#1a1624', '#262036']), tailLen: 1,
    leg: HS(['#1b1429', '#2a2238', '#3a3050']), shoe: HS(['#0b0711', '#1b1429', '#2a2238']), eyeCol2: H('#7c84a0'), blush: true,
    legend: function (S) { return { P: S.mat('plat', HS(['#c4c0d4', '#e2e0ec', '#ffffff'])), b: { c: H('#7a5ab8') } }; },
    hairD: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHbHHhHHHHHH....', '....PPHHHHHHHHPP....', '....PP........PP....', '....PP........PP....', '....PP........PP....', '....PP........PP....', '....PPH......HPP....', '.....PH......HP.....']],
    hairR: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHbHHHHHHH....', '....HHHHHHHHHPP.....', '....HHHHHHHHPP......', '....HHHHHHHPP.......', '....HHHHHHHP........', '....HHHHHHHP........', '....HHHHHHHP........', '.....HHHHHHHP.......']],
    hairU: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHbHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....']],
    head: function (S, dir, f, L) { if (dir === 'down') { S.dot(9, L.headY + 8, H('#4a1424')); S.dot(10, L.headY + 8, H('#4a1424')); } else if (dir !== 'up') S.dot(14, L.headY + 8, H('#4a1424')); },
    body: function (S, dir, f, L) { // drawstrings, chained belt, a rip in the tights
      var t = L.tt;
      if (dir === 'down') { S.dot(8, t + 1, H('#c8c4d8')); S.dot(11, t + 1, H('#c8c4d8')); S.dot(8, t + 2, SILVER[2]); S.dot(11, t + 2, SILVER[2]); for (var x = 6; x <= 13; x += 2) S.dot(x, L.tb + 2, SILVER[2]); }
      else if (dir === 'up') { for (var x2 = 6; x2 <= 13; x2++) S.dot(x2, t, H('#262036')); for (var x3 = 7; x3 <= 12; x3 += 2) S.dot(x3, L.tb + 2, SILVER[2]); }
      else { S.dot(12, t + 1, H('#c8c4d8')); S.dot(8, L.tb + 2, SILVER[2]); S.dot(10, L.tb + 2, SILVER[2]); }
      legDots(S, function (x, y) { return (x === 8 && y === 28) || (x === 12 && y === 27) ? H('#ecd3d9') : 0; });
    }
  };
  SPRITES.jasmine_a = {
    skin: skinR('#c98e74', '#ebb79a', '#f8d6c0', { blush: '#f08a98' }), hair: HS(['#7a3a24', '#c46a48', '#e8946a', '#f6b88e', '#ffdcbc']), top: HS(['#cfc0a0', '#ece0c4', '#fbf4e2']),
    gown: HS(['#a85a74', '#d07896', '#eca0b8']), shoe: HS(['#7a3a3a', '#a85a5a', '#c87a72']), eyeCol2: H('#8a6030'), blush: true,
    legend: function () { return { r: { c: H('#e06a8e') }, y: { c: H('#f2c45a') } }; },
    hairD: [8, ['......HHHHHHHH......', '....HHHHHhHHyHHH....', '....HHHHHHHHHHHH....', '....HHH......HHH....', '....HH........HH....', '....HH........HH....', '....HH........HH....', '...HHH........HHH...', '..rrH..........Hrr..', '..HHH..........HHH..', '..HH............HH..', '..HH............HH..', '...H............H...']],
    hairR: [8, ['......HHHHHHHH......', '....HHHHHHHHyHHH....', '....HHHHHHHHHHHHH...', '....HHHHHHHHHHH.....', '....HHHHHH..........', '....HHHHHS..........', '....HHHH............', '....HHH.............', '...rrH..............', '...HHH..............', '...HH...............', '...HH...............', '....H...............']],
    hairU: [8, ['......HHHHHHHH......', '....HHHHHhHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '...HHHHHHHHHHHHHH...', '..rrHHHHHHHHHHHHrr..', '..HHH..........HHH..', '..HH............HH..', '..HH............HH..', '...H............H...']],
    body: function (S, dir, f, L) { // pink dress under the cardigan, apron with a bee
      var t = L.tt;
      if (dir === 'down') { for (var y = t + 1; y <= L.tb; y++) { S.dot(9, y, H('#eca0b8')); S.dot(10, y, H('#d07896')); } S.dot(8, t + 2, H('#ffb0c8')); S.dot(11, t + 2, H('#ffb0c8')); for (var y2 = L.tb; y2 <= 28; y2++) for (var x = 8; x <= 11; x++) S.dot(x, y2, x === 11 ? H('#d8d0c8') : WHITE); S.dot(9, 27, H('#f2c45a')); S.dot(10, 27, OUT); }
      else if (dir === 'up') { S.dot(9, L.tb, H('#ffffff')); S.dot(10, L.tb, H('#ffffff')); }
      else { for (var y3 = L.tb; y3 <= 28; y3++) S.dot(12 + (y3 > L.tb + 1 ? 1 : 0), y3, WHITE); }
    }
  };
  SPRITES.jasmine_b = {
    skin: skinR('#c08060', '#e4aa88', '#f6ccac', { blush: '#f0907e' }), hair: HS(['#4a2a14', '#7a4a24', '#a8703a', '#d09a5a', '#f0c088']), top: HS(['#9a84c8', '#bca8e2', '#dcd0f6']),
    gown: HS(['#3e5a42', '#5a7a5c', '#7a9a7a']), shoe: HS(['#3e2d2b', '#574039', '#7a5a48']), eyeCol2: H('#6e4630'), blush: true,
    legend: function (S) { return { k: S.mat('knit', HS(['#b8ac90', '#d8ccb0', '#f0e8d4'])), K: { c: H('#a8987a') }, f: { c: WHITE } }; },
    hairD: [6, ['.....kk......kk.....', '....kkkkkkkkkkkk....', '...kkkkkkkkkkkkkk...', '...KKKKKKKKKKKKKK...', '...HHHHHHHHHHHHHH...', '...HHHH.HHHH.HHHH...', '..HHH..........HHH..', '..HH............HH..', '..HHH..........HHH..', '...HH..........HH...', '...H............H...']],
    hairR: [6, ['......kk...kk.......', '.....kkkkkkkkk......', '...kkkkkkkkkkkkk....', '...KKKKKKKKKKKKK....', '..HHHHHHHHHHHHH.....', '..HHHHHHHHHHH.......', '..HHHHHHHH..........', '..HHHHHHS...........', '..HHHHHH............', '..HHHHH.............', '...HHH..............']],
    hairU: [6, ['.....kk......kk.....', '....kkkkkkkkkkkk....', '...kkkkkkkkkkkkkk...', '...KKKKKKKKKKKKKK...', '...HHHHHHHHHHHHHH...', '...HHHHHHHHHHHHHH...', '...HHHHHHHHHHHHHH...', '...HHHHHHHHHHHHHH...', '...HHHHHHHHHHHHHH...', '....HHHHHHHHHHHH....', '.....HHHfHHHHH......', '......HHHHHH........']],
    head: function (S, dir, f, L) { curlDots(S, L, S.sp.hair); },
    body: function (S, dir, f, L) { // sage pinafore bib and straps over the lilac blouse
      var t = L.tt, P = S.mat('pina', HS(['#3e5a42', '#5a7a5c', '#7a9a7a']));
      if (dir === 'down') { S.rect(8, t + 1, 4, L.tb - t, P); S.put(8, t, P); S.put(11, t, P); S.dot(9, t, WHITE); S.dot(10, t, WHITE); S.dot(9, t + 2, H('#f0e8d4')); }
      else if (dir === 'up') { S.put(8, t, P); S.put(11, t, P); S.put(9, t + 1, P); S.put(10, t + 1, P); }
      else { for (var y = t + 1; y <= L.tb; y++) S.put(12, y, P); S.put(11, t, P); }
    }
  };
  SPRITES.amara_a = {
    skin: skinR('#7a4a32', '#9e6646', '#c08560', { blush: '#c06a5a' }), hair: HS(['#120c1c', '#24160f', '#3e2a20', '#5a3e2c', '#7a5640']), top: HS(['#b07e1e', '#d8a838', '#f0cc6a']),
    tails: HS(['#0c3036', '#12484e', '#1c6668']), tailLen: 3, leg: HS(['#3e2a20', '#5a3e2c', '#7a5640']), shoe: HS(['#3e2d2b', '#574039', '#7a5a48']), eyeCol2: H('#a8662a'), blush: true,
    legend: function () { return { G: { c: GOLD[2] } }; },
    hairD: [2, ['.......HHHHHH.......', '.....HHHHHHHHHH.....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HH........HH....', '....H..........H....', '....................', '.........GG.........', '......G.G..G.G......']],
    hairR: [2, ['.....HHHHHH.........', '...HHHHHHHHHH.......', '...HHHHHHHHHHH......', '...HHHHHHHHHHH......', '....HHHHHHHHH.......', '.....HHHHHHH........', '....HHHHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHH.........', '....HHHHH...........', '....HHHHS...........', '.....HH...GG.G......']],
    hairU: [2, ['.......HHHHHH.......', '.....HHHHHHHHHH.....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '......HHHHHHHH......']],
    head: function (S, dir, f, L) { // curls + the pencil through the puff
      curlDots(S, L, S.sp.hair);
      var dy = L.dy, pts = dir === 'up' ? [[16, 6], [3, 3]] : [[3, 7], [16, 3]];
      bez([[pts[0][0], pts[0][1] + dy], [pts[1][0], pts[1][1] + dy]]).forEach(function (p, i, a) { var t = i / (a.length - 1); S.dot(p[0], p[1], t < 0.1 ? H('#e89ab8') : t > 0.9 ? H('#2a2238') : t > 0.8 ? H('#e8c8a0') : H('#f2c45a')); });
    },
    body: function (S, dir, f, L) { // white collar, star-print skirt, satchel strap + bag
      var t = L.tt, br = H('#574039');
      if (dir === 'down') { S.dot(8, t, WHITE); S.dot(9, t, H('#e8e4dc')); S.dot(10, t, WHITE); S.dot(11, t, H('#e8e4dc')); for (var k = 0; k < 6; k++) S.dot(7 + k, t + k, br); var bag = S.mat('bag', HS(['#3e2d2b', '#574039', '#7a5a48'])); S.put(12, L.tb, bag); S.put(13, L.tb, bag); S.dot(12, L.tb + 1, br); S.dot(13, L.tb + 1, H('#3e2d2b')); }
      else if (dir === 'up') { for (var k2 = 0; k2 < 6; k2++) S.dot(12 - k2, t + k2, br); }
      else { S.dot(12, t, WHITE); for (var y = t; y < L.tb; y++) S.dot(8 + ((y - t) >> 1), y, br); S.dot(6, L.tb, br); S.dot(6, L.tb + 1, H('#3e2d2b')); S.dot(7, L.tb + 1, br); }
      for (var y2 = L.tb - 1; y2 <= L.tb + 3; y2++) for (var x = 0; x < SW; x++) if (S.idAt(x, y2) === S.mats2.tails && (x * 3 + y2 * 5) % 7 === 0) S.dot(x, y2, H('#f2c45a'));
    }
  };
  SPRITES.amara_b = {
    skin: skinR('#573424', '#76492f', '#976644', { d: '#3e2220', line: '#22101a', blush: '#9a4e44' }), hair: HS(['#0b0711', '#1b1214', '#2e2022', '#4a3434', '#6a4c48']), top: HS(['#12484e', '#1c6668', '#2c8884']),
    arm: HS(['#c4c0d6', '#e8e6f2', '#ffffff']), tails: HS(['#14302a', '#1e4a3c', '#2a6650']), tailLen: 3, leg: HS(['#1b1a26', '#2d2c3e', '#45445a']), shoe: BOOTS, eyeCol2: H('#b0702a'), blush: true,
    legend: function () { return { g: { c: GOLD[2] } }; },
    hairD: [4, ['.......HHHHHH.......', '.......HHHHHH.......', '........gggg........', '......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HhHHhHHhHHhH....', '....HHHHHHHHHHHH....', '...HHH........HHH...', '...HH..........HH...', '...HH..........HH...', '...gH..........Hg...', '...HH..........HH...', '...HH..........HH...', '...HH..........HH...', '...Hg..........gH...', '...HH..........HH...', '...HH..........HH...']],
    hairR: [4, ['.....HHHHHH.........', '.....HHHHHH.........', '......gggg..........', '.....HHHHHHHH.......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHHH...', '...HHHHHHHHHHH......', '...HHHHHHHH.........', '...HHHHHH...........', '...HHHHHS...........', '...gHHHH............', '...HHHH.............', '...HHHH.............', '...HHHg.............', '...HHHH.............', '...HHH..............', '....HH..............']],
    hairU: [4, ['.......HHHHHH.......', '.......HHHHHH.......', '........gggg........', '......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HhHHhHHhHHhH....', '....HHHHHHHHHHHH....', '....HhHHhHHhHHhH....', '....HHHHHHHHHHHH....', '....HhHHhHHhHHhH....', '....HHgHHHHHHgHH....', '....HhHHhHHhHHhH....', '....HHHHHHHHHHHH....', '....HhHHhHHhHHhH....', '....HHHHgHHgHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....']],
    head: function (S, dir, f, L) { // thick violet glasses
      var y = L.headY, v = H('#6a47a8'), v2 = H('#4a2f7a');
      if (dir === 'down') { [[6, 4], [7, 4], [8, 4], [11, 4], [12, 4], [13, 4], [6, 5], [8, 5], [9, 5], [10, 5], [11, 5], [13, 5], [6, 6], [8, 6], [11, 6], [13, 6]].forEach(function (p) { S.dot(p[0], y + p[1], p[1] === 4 ? v : v2); }); }
      else if (dir !== 'up') { [[11, 4], [12, 4], [13, 4], [11, 5], [13, 5], [13, 6], [9, 5], [10, 5]].forEach(function (p) { S.dot(p[0], y + p[1], p[1] === 4 ? v : v2); }); }
    },
    body: function (S, dir, f, L) { // white collar, astrolabe, tartan lines
      var t = L.tt;
      if (dir === 'down') { S.dot(9, t, WHITE); S.dot(10, t, WHITE); S.dot(9, t + 3, GOLD[2]); S.dot(10, t + 3, GOLD[1]); S.dot(9, t + 1, H('#574039')); S.dot(10, t + 2, H('#574039')); }
      else if (dir !== 'up') { S.dot(12, t, WHITE); S.dot(12, t + 3, GOLD[2]); }
      for (var y = L.tb - 1; y <= L.tb + 3; y++) for (var x = 0; x < SW; x++) if (S.idAt(x, y) === S.mats2.tails && (x % 3 === 1 || y === L.tb + 1)) S.dot(x, y, x % 3 === 1 ? H('#b43a30') : H('#1c2a58'));
    }
  };
  SPRITES.ronan = {
    skin: SKIN.tan, hair: HS(['#2a0e0a', '#5a1e14', '#7e2e1e', '#a4462e', '#c8684a']), top: HS(['#1f1e2a', '#2d2c3e', '#45445a']), arm: [SKIN.tan.s, SKIN.tan.b, SKIN.tan.l], wide: 1,
    leg: HS(['#281d21', '#3e2d2b', '#574039']), shoe: BOOTS, eyeCol2: H('#d08a28'),
    legend: function (S) { return { A: S.mat('apron', HS(['#3e2d2b', '#574039', '#7a5a48'])), t: { c: H('#3e2d2b') } }; },
    hairD: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHH......HHH....', '....HH........HH....', '....H..........H....']],
    hairR: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '...HHHHHHHHHHHH.....', '..HHHHHHHHHH........', '.HHHHHHHH...........', '.HH.HHHHS...........', '.H..HHH.............']],
    hairU: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHtHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '........HHH.........', '........HHH.........', '.........H..........']],
    head: function (S, dir, f, L) { // short beard
      var y = L.headY, R = S.sp.hair, bd = function (x, yy, k) { S.dot(x, yy, k ? R[2] : R[1]); };
      if (dir === 'down') { bd(5, y + 7, 1); bd(14, y + 7, 0); [5, 6, 7, 8, 11, 12, 13, 14].forEach(function (x) { bd(x, y + 8, x < 9); }); S.dot(9, y + 8, H('#4e2a2c')); S.dot(10, y + 8, H('#4e2a2c')); for (var x = 6; x <= 13; x++) bd(x, y + 9, x < 10); }
      else if (dir !== 'up') { bd(9, y + 7, 1); for (var x2 = 10; x2 <= 14; x2++) bd(x2, y + 8, 1); for (var x3 = 11; x3 <= 14; x3++) bd(x3, y + 9, 0); }
    },
    body: function (S, dir, f, L) { // apron + glowing runes on the bare arms
      var A = S.leg.A, t = L.tt, G = H('#3ae8d8'), g = H('#b4fff4');
      if (dir === 'down') { S.rect(7, t + 2, 6, L.tb - t - 1, A); S.put(7, t, A); S.put(12, t, A); S.put(7, t + 1, A); S.put(12, t + 1, A); S.dot(4, t + 2, G); S.dot(5, t + 3, g); S.dot(15, t + 2, G); S.dot(14, t + 3, g); }
      else if (dir === 'up') { S.dot(7, t, H('#574039')); S.dot(8, t + 1, H('#574039')); S.dot(11, t + 1, H('#574039')); S.dot(12, t, H('#574039')); S.dot(4, t + 2, G); S.dot(15, t + 2, G); }
      else { S.rect(11, t + 2, 2, L.tb - t - 1, A); S.put(12, t + 3, A); S.put(13, t + 4, A); S.dot(9, t + 1, G); S.dot(10, t + 2, g); }
    }
  };
  SPRITES.caspian = {
    skin: skinR('#c08060', '#e4aa86', '#f6cca8'), hair: HS(['#2a140c', '#5a2e18', '#84482a', '#a8683e', '#cc8c5c']), top: HS(['#3a4a26', '#526a34', '#6e8a46']),
    leg: HS(['#2a2418', '#3e3424', '#574a34']), shoe: HS(['#3e2414', '#5a3a24', '#7a5034']), eyeCol2: H('#3a8a58'),
    legend: function (S) { return { C: S.mat('cap', HS(['#4a2e1a', '#6a4428', '#8a5c38']), { botDark: true }), G: { c: GOLD[2] }, a: { c: H('#e8a040') }, f: { c: H('#e8d0a8') } }; },
    hairD: [7, ['......CCCCCCCC......', '....CCGaGCCGaGCC....', '....CCGGGCCGGGCC....', '....CCCCCCCCCCCC....', '....fffHHHHHHfff....', '....CCH.HH.H..CC....', '....CC........CC....', '....CC........CC....', '.....C........C.....']],
    hairR: [7, ['.....CCCCCCCC.......', '...CCCCCCCCGaG......', '...CCCCCCCCGGG......', '...CCCCCCCCCCCC.....', '...fffffffHHHH......', '....CCCCCH.HH.......', '....CCCCC...........', '.....CCCC...........', '......C.............']],
    hairU: [7, ['......CCCCCCCC......', '....CCCCCCCCCCCC....', '....CCCCCCCCCCCC....', '....CCCCCCCCCCCC....', '....CCCCCCCCCCCC....', '....CCCCCCCCCCCC....', '....CC.HHHHHH.CC....', '....CC.HHHHHH.CC....', '.....C........C.....']],
    body: function (S, dir, f, L) { // shearling collar
      var t = L.tt, a = H('#e8d0a8'), b = H('#c8a878');
      if (dir === 'side' || (dir !== 'down' && dir !== 'up')) { S.dot(7, t, a); S.dot(8, t, b); S.dot(9, t, a); S.dot(12, t, b); return; }
      for (var x = 5; x <= 14; x++) S.dot(x, t, x % 2 ? a : b);
      if (dir === 'down') { S.dot(8, t + 1, a); S.dot(11, t + 1, b); }
    }
  };
  SPRITES.gideon = {
    skin: skinR('#a87258', '#cc9476', '#e4b494'), hair: HS(['#4a4858', '#7a7890', '#a8a6b8', '#cfcde0', '#eceaf4']), top: HS(['#1e1a24', '#2e2834', '#433a4a']), tails: HS(['#14101a', '#1e1a24', '#2e2834']), tailLen: 4, wide: 1,
    leg: HS(['#1b1a26', '#2d2c3e', '#45445a']), shoe: BOOTS, eyeCol2: H('#566080'),
    hairD: [8, ['.......HHHHHH.......', '....HHH......HHH....', '....HH........HH....', '....HH........HH....', '....H..........H....']],
    hairR: [8, ['.......HHHHHH.......', '....HHHHH...........', '....HHHHH...........', '....HHHHH...........', '....HHHHS...........', '.....HH.............']],
    hairU: [8, ['.......HHHHHH.......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....']],
    head: function (S, dir, f, L) { // eyepatch, white beard + braid, pipe with smoke
      var y = L.headY, W = H('#eceaf4'), w = H('#aaa6c0'), pipe = H('#6a4630');
      if (dir === 'down') {
        S.dot(6, y + 5, OUT); S.dot(7, y + 5, OUT); S.dot(8, y + 5, OUT); S.dot(7, y + 6, OUT); S.dot(5, y + 4, OUT); S.dot(9, y + 3, OUT);
        for (var x = 5; x <= 14; x++) S.dot(x, y + 8, x === 9 || x === 10 ? w : W); for (var x2 = 6; x2 <= 13; x2++) S.dot(x2, y + 9, x2 % 2 ? W : w);
        S.dot(5, y + 7, W); S.dot(14, y + 7, w); S.dot(12, y + 8, pipe); S.dot(13, y + 8, H('#3e2a20')); S.dot(13, y + 6, H('#cfcbe0')); S.dot(14, y + 5, H('#a8a4bc'));
        for (var by = y + 10; by <= y + 13; by++) { S.dot(9, by, by === y + 12 ? SILVER[2] : W); S.dot(10, by, by === y + 12 ? SILVER[1] : w); }
      } else if (dir !== 'up') {
        if (dir === 'right') { S.dot(12, y + 5, OUT); S.dot(12, y + 6, OUT); S.dot(11, y + 5, OUT); S.dot(13, y + 5, OUT); S.dot(10, y + 4, OUT); S.dot(9, y + 3, OUT); }
        for (var x3 = 10; x3 <= 14; x3++) S.dot(x3, y + 8, W); for (var x4 = 11; x4 <= 14; x4++) S.dot(x4, y + 9, w);
        S.dot(15, y + 8, pipe); S.dot(16, y + 8, H('#3e2a20')); S.dot(16, y + 6, H('#cfcbe0'));
        for (var by2 = y + 10; by2 <= y + 12; by2++) S.dot(12, by2, by2 === y + 11 ? SILVER[2] : W);
      }
    },
    body: function (S, dir, f, L) { // fur mantle + guild emblem
      var t = L.tt, a = H('#7a6650'), b = H('#9a8468'), c = H('#5a4a3a');
      for (var x = 4; x <= 15; x++) { S.dot(x, t, (x + t) % 2 ? a : b); if (x > 4 && x < 15 && (dir !== 'down' || x < 8 || x > 11)) S.dot(x, t + 1, (x % 3) ? c : a); }
      if (dir === 'down') { S.dot(7, t + 3, SILVER[3]); S.dot(8, t + 3, SILVER[2]); }
    }
  };
  SPRITES.nightmerchant = {
    skin: skinR('#140e1e', '#1e162c', '#2a2040', { d: '#0e0a16', line: '#07040c' }), hair: HAIR.black, top: HS(['#140e1e', '#1f1830', '#2e2446']), gown: HS(['#0b0711', '#140e1e', '#1f1830']),
    handRamp: HS(['#1b1429', '#2a2238', '#3a3050']), shoe: HS(['#0b0711', '#140e1e', '#1f1830']), eyeCol: H('#f4ecff'), eyeCol2: H('#a07ae0'),
    legend: function (S) { return { T: S.mat('hood', HS(['#22123a', '#341e58', '#4a2c7a']), { botDark: true }), t: { c: H('#07040c') }, s: { c: H('#e4d2ff') } }; },
    hairD: [4, ['.........TT.........', '........TTTT........', '.......TTTTTT.......', '......TTTTTTTT......', '.....TTTTTTTTTT.....', '....TTTTTTTTTTTT....', '...TTTTttttttTTTT...', '...TTTt......tTTT...', '...TTt........tTT...', '...TT..........TT...', '...TT..........TT...', '...TT..........TT...', '...TTs........sTT...', '...TTTT......TTTT...', '..TTTTTT....TTTTTT..', '..TTTTTTTTTTTTTTTT..']],
    hairR: [4, ['.......TT...........', '......TTTT..........', '.....TTTTTT.........', '....TTTTTTTT........', '...TTTTTTTTTT.......', '..TTTTTTTTTTTT......', '..TTTTTTTTTTttt.....', '..TTTTTTTTTt........', '..TTTTTTTTt.........', '..TTTTTTTT..........', '..TTTTTTTT..........', '..TTTTTTTT..........', '..TTTTTTTs..........', '...TTTTTTTT.........', '...TTTTTTTTT........', '..TTTTTTTTTTTT......']],
    hairU: [4, ['.........TT.........', '........TTTT........', '.......TTTTTT.......', '......TTTTTTTT......', '.....TTTTTTTTTT.....', '....TTTTTTTTTTTT....', '...TTTTTTTTTTTTTT...', '...TTTTTTTTTTTTTT...', '...TTTTTTtTTTTTTT...', '...TTTTTTtTTTTTTT...', '...TTTTTTtTTTTTTT...', '...TTTTTTTTTTTTTT...', '...TTTTTTTTTTTTTT...', '...TTTTTTTTTTTTTT...', '...TTTTTTTTTTTTTT...', '..TTTTTTTTTTTTTTTT..', '.....TTTTTTTTTT.....']],
    body: function (S, dir, f, L) { // crescent clasp, belt lantern, starlit hem that shimmers between walk frames
      var t = L.tt, shim = [H('#8f6cd1'), H('#e4d2ff')];
      if (dir === 'down') { S.dot(9, t, H('#e8eeff')); S.dot(10, t, H('#9fb0d8')); S.dot(12, L.tb, GOLD[1]); S.dot(13, L.tb, GOLD[1]); S.dot(12, L.tb + 1, H('#ffbc62')); S.dot(13, L.tb + 1, H('#fff1c8')); S.dot(12, L.tb + 2, GOLD[0]); }
      else if (dir !== 'up') { S.dot(11, t, H('#e8eeff')); S.dot(11, L.tb, GOLD[1]); S.dot(11, L.tb + 1, H('#fff1c8')); S.dot(12, L.tb + 1, H('#ffbc62')); S.dot(11, L.tb + 2, GOLD[0]); }
      for (var x = 0; x < SW; x++) if (S.idAt(x, 29) === S.mats2.gown) S.dot(x, 29, shim[(x + f) % 2]);
    }
  };

  for (var sid in SPRITES) if (SPRITES.hasOwnProperty(sid) && NPC[sid] && NPC[sid].blushK != null) SPRITES[sid].blushK = NPC[sid].blushK; // the portraits' blush strength

  SPRITES._villager = {
    skin: SKIN.fair, hair: HAIR.brown, top: HS(['#3e2d2b', '#574039', '#7a5a48']), leg: HS(['#2d2c3e', '#45445a', '#605f78']), shoe: BOOTS,
    hairD: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHH......HHH....', '....HH........HH....', '.....H........H.....']],
    hairR: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHH.........', '....HHHHH...........', '.....HHH............']],
    hairU: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '......HHHHHHHH......']]
  };

  function spriteSet(sp, withUse) {
    var set = { w: SW, h: SH, ax: 10, ay: 31, walk: {} };
    DIRS.forEach(function (d) { set.walk[d] = [0, 1, 2, 3].map(function (f) { return renderSpr(sp, d, f); }); });
    if (withUse) {
      set.use = {}; set.hand = {};
      DIRS.forEach(function (d) {
        set.use[d] = [renderSpr(sp, d, 0, 'raise'), renderSpr(sp, d, 0, 'strike')];
        set.hand[d] = HANDS[d].map(function (p) { return [p[0], p[1] + (sp.short || 0)]; });
      });
    }
    return set;
  }
  var HANDS = { down: [[9, 6], [9, 24]], up: [[9, 6], [9, 17]], right: [[6, 11], [15, 22]], left: [[13, 11], [4, 22]] };
  function mapSet(set, fn) {
    var o = { w: set.w, h: set.h, ax: set.ax, ay: set.ay, walk: {} };
    DIRS.forEach(function (d) { o.walk[d] = set.walk[d].map(fn); });
    if (set.use) { o.use = {}; o.hand = set.hand; DIRS.forEach(function (d) { o.use[d] = set.use[d].map(fn); }); }
    return o;
  }
  function rawNpcSprites(id, v) { return mapSet(spriteSet(resolveDef(SPRITES, id, v), false), toRaw); }

  // ---------------------------------------------------------------- player sprite (look-driven)
  var P_SPR_HAIR = [
    { // messy short
      D: [6, ['......H..H.H........', '....H.HHHHHHH.H.....', '....HHHHHHHHHHHH....', '...HHHHHHHHHHHHHH...', '....HHHHHHHHHHHH....', '....HHHH.HH.HHHH....', '....HH.H....H.HH....', '....H..........H....']],
      R: [6, ['.....H..H.H.........', '...H.HHHHHHHH.......', '...HHHHHHHHHHHH.....', '..HHHHHHHHHHHHHH....', '...HHHHHHHHHHHHH....', '...HHHHHHHH.H.HH....', '....HHHHHS..........', '....HHHH............', '.....HH.............']],
      U: [6, ['......H..H.H........', '....H.HHHHHHH.H.....', '....HHHHHHHHHHHH....', '...HHHHHHHHHHHHHH...', '....HHHHhHHhHHHH....', '....HHHHHHHHHHHH....', '....HHHhHHHHhHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '.....H.HH..HH.H.....']]
    },
    { // long
      D: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHH...HHH....', '....HHH.......HH....', '....HH........HH....', '....HH........HH....', '...HHH........HHH...', '...HH..........HH...', '...HH..........HH...', '...HH..........HH...', '...HH..........HH...', '...HH..........HH...', '...H............H...']],
      R: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHHH...', '....HHHHHHHHHHH.....', '...HHHHHHH..........', '...HHHHHS...........', '...HHHHH............', '...HHHHH............', '...HHHH.............', '...HHHH.............', '...HHHH.............', '...HHH..............', '...HHH..............', '....H...............']],
      U: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHhHHHHhHHH....', '.....HHHHHHHHHH.....', '.....HHHHHHHHHH.....', '......HHHHHHHH......']]
    },
    { // braid
      D: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHhHHHHHH....', '....HHHH....HHHH....', '....HHH......HHH....', '....HH........HH....', '....H.........HHH...', '..............HhH...', '..............HHH...', '..............hHh...', '..............HHH...', '...............HhH..', '...............HHH..', '...............tt...', '...............HH...']],
      R: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHHH...', '....HHHHHHHHHHH.....', '....HHHHHHH.........', '...HHHHHHS..........', '...HhHHHH...........', '...HHH..............', '...hHh..............', '...HHH..............', '...HhH..............', '....HH..............', '....tt..............', '....HH..............']],
      U: [8, ['......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '.......HHhHH........', '........HHH.........', '........hHh.........', '........HHH.........', '........HhH.........', '........HHH.........', '........ttt.........', '.........H..........']]
    },
    { // bun
      D: [4, ['........HHHH........', '.......HHHHHH.......', '.......HHhHHH.......', '........tttt........', '......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHH......HHH....', '....HH........HH....', '....H..........H....', '....H..........H....', '....H..........H....']],
      R: [4, ['......HHHH..........', '.....HHHHHH.........', '.....HHhHHH.........', '......tttt..........', '......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHH......', '....HHHHHH.H........', '....HHHHS...........', '.....HH.............']],
      U: [4, ['........HHHH........', '.......HHHHHH.......', '.......HHHHjH.......', '........tttt........', '......HHHHHHHH......', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHhHHhHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....']]
    },
    { // curls
      D: [6, ['.....H.HH.HH.H......', '....HHHHHHHHHHHH....', '...HHHHHHHHHHHHHH...', '..HHHHHHHHHHHHHHHH..', '..HHHHHHHHHHHHHHHH..', '..HHHHH.HHHH.HHHHH..', '..HHHH........HHHH..', '..HHH..........HHH..', '..HHH..........HHH..', '...HH..........HH...', '...H............H...']],
      R: [6, ['....H.HH.HH.H.......', '...HHHHHHHHHHHH.....', '..HHHHHHHHHHHHHH....', '.HHHHHHHHHHHHHHHH...', '.HHHHHHHHHHHHHHHH...', '.HHHHHHHHHHHHH......', '.HHHHHHHHH..........', '.HHHHHHHS...........', '..HHHHHH............', '..HHHHH.............', '...HHH..............']],
      U: [6, ['.....H.HH.HH.H......', '....HHHHHHHHHHHH....', '...HHHHHHHHHHHHHH...', '..HHHHHHHHHHHHHHHH..', '..HHHHHHHHHHHHHHHH..', '..HHHHHHHHHHHHHHHH..', '..HHHHHHHHHHHHHHHH..', '..HHHHHHHHHHHHHHHH..', '..HHHHHHHHHHHHHHHH..', '...HHHHHHHHHHHHHH...', '....HHHHHHHHHHHH....', '.....H.HH..HH.H.....']]
    },
    { // crop
      D: [9, ['......HHHHHHHH......', '.....HHHHHHHHHH.....', '....HHHHHHHHHHHH....', '....HH........HH....', '....H..........H....']],
      R: [9, ['......HHHHHHHH......', '.....HHHHHHHHHH.....', '....HHHHHHHHHHH.....', '....HHHHH...........', '....HHHS............', '.....HH.............']],
      U: [9, ['......HHHHHHHH......', '.....HHHHHHHHHH.....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '....HHHHHHHHHHHH....', '.....HHHHHHHHHH.....', '......HHHHHHHH......']]
    }
  ];
  function playerSpriteSpec(lk) {
    var robe = P_ROBE[lk.robe], R = P_HAIR[lk.hairColor], st = P_SPR_HAIR[lk.hair], top = [robe[1], robe[2], robe[3]];
    return dressSprite({
      skin: P_SKIN[lk.skin], hair: R, top: top, arm: top, tails: [robe[0], robe[1], robe[2]], tailLen: 3,
      leg: HS(['#1b1a26', '#2d2c3e', '#45445a']), shoe: BOOTS, eyeCol2: P_EYES[lk.eyes][1], openCoat: false, blushK: 0.6,
      hairD: st.D, hairR: st.R, hairU: st.U,
      legend: function () { return { t: { c: robe[3] } }; },
      head: function (S, dir, f, L) {
        if (lk.hair !== 4) return; // curl texture
        for (var y = L.headY - 3; y < L.headY + 11; y++) for (var x = 0; x < SW; x++) {
          if (S.idAt(x, y) !== S.mats2.hair) continue;
          if ((x * 2 + y * 3) % 5 === 0) S.dot(x, y, R[1]); else if ((x * 2 + y * 3) % 5 === 2 && (x + y) % 3 === 0) S.dot(x, y, R[3]);
        }
      },
      body: function (S, dir, f, L, pose) { // belt + pouch + collar
        var by = L.tb - 1, belt = H('#3e2d2b'), buck = GOLD[2], pouch = S.mat('pouch', HS(['#3e2d2b', '#574039', '#7a5a48']));
        if (dir === 'down' || dir === 'up') {
          for (var x = 7; x <= 12; x++) S.dot(x, by, belt);
          if (dir === 'down') { S.dot(9, by, buck); S.dot(9, L.tt, H('#f4ead8')); S.dot(10, L.tt, H('#f4ead8')); S.dot(10, L.tt + 1, H('#c8d4f0')); }
          var px = dir === 'down' ? 11 : 7; S.put(px, by + 1, pouch); S.put(px + 1, by + 1, pouch); S.put(px, by + 2, pouch); S.put(px + 1, by + 2, pouch);
        } else {
          for (var x2 = 7; x2 <= 12; x2++) S.dot(x2, by, belt);
          S.put(10, by + 1, pouch); S.put(11, by + 1, pouch); S.put(10, by + 2, pouch); S.put(11, by + 2, pouch);
          S.dot(12, L.tt, H('#f4ead8'));
        }
      }
    }, lk);
  }
  function rawPlayerSprites(look) { return mapSet(spriteSet(playerSpriteSpec(normLook(look)), true), toRaw); }

  /* ================================================================== player clothing (DESIGN2 §3) */
  // look.hat / look.cloak / look.outfit hold item ids (or null). Hats sit on the hair and hide whatever
  // hair they would cover; cloaks hang behind the body (collar + clasp in front); outfits replace the robe.
  var CLOTHES = [
    { id: 'cl_hat_wizard', slot: 'hat', name: 'Starry Wizard Hat' }, { id: 'cl_hat_witch', slot: 'hat', name: 'Wide-Brim Witch Hat' },
    { id: 'cl_hat_tricorn', slot: 'hat', name: 'Raven Tricorn' }, { id: 'cl_hat_beret', slot: 'hat', name: 'Velvet Beret' },
    { id: 'cl_hat_hood', slot: 'hat', name: 'Mossweave Hood' }, { id: 'cl_hat_crown', slot: 'hat', name: 'Flower Crown' },
    { id: 'cl_hat_tophat', slot: 'hat', name: 'Moonlit Top Hat' }, { id: 'cl_hat_circlet', slot: 'hat', name: 'Crescent Circlet' },
    { id: 'cl_cloak_midnight', slot: 'cloak', name: 'Midnight Cloak' }, { id: 'cl_cloak_ember', slot: 'cloak', name: 'Ember Cape' },
    { id: 'cl_cloak_moss', slot: 'cloak', name: 'Moss Mantle' }, { id: 'cl_cloak_raven', slot: 'cloak', name: 'Raven Feather Cloak' },
    { id: 'cl_cloak_silver', slot: 'cloak', name: 'Silver Veil Mantle' },
    { id: 'cl_outfit_scholar', slot: 'outfit', name: "Scholar's Robes" }, { id: 'cl_outfit_alchemist', slot: 'outfit', name: "Alchemist's Coat" },
    { id: 'cl_outfit_bard', slot: 'outfit', name: "Bard's Doublet" }, { id: 'cl_outfit_duelist', slot: 'outfit', name: "Duelist's Waistcoat" },
    { id: 'cl_outfit_moonweave', slot: 'outfit', name: 'Moonweave Robes' }, { id: 'cl_outfit_ranger', slot: 'outfit', name: "Ranger's Garb" }
  ];
  function clothId(v, slot) { if (typeof v !== 'string') return null; for (var i = 0; i < CLOTHES.length; i++) if (CLOTHES[i].id === v && CLOTHES[i].slot === slot) return v; return null; }
  var FEATHER_RAVEN = HS(['#0b0711', '#1b1429', '#2e2442', '#46395c', '#8a6ad0']);

  // ---------------------------------------------------------------- portrait pieces
  function pStar(B, x, y, big, core, arm, tag) { B.set(x, y, core, tag); if (big) { B.set(x - 1, y, arm, tag); B.set(x + 1, y, arm, tag); B.set(x, y - 1, arm, tag); B.set(x, y + 1, arm, tag); } }
  function pFeather(B, ax, ay, bx, by, wmax, F) {
    var L = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)), dx = (bx - ax) / L, dy = (by - ay) / L, nx = -dy, ny = dx, left = [], right = [];
    for (var i = 0; i <= 12; i++) { var t = i / 12, w = Math.sin(Math.PI * Math.pow(t, 0.7)) * wmax; left.push([ax + dx * L * t + nx * w, ay + dy * L * t + ny * w]); right.push([ax + dx * L * t - nx * w, ay + dy * L * t - ny * w]); }
    var M = M64().poly(left.concat(right.reverse()));
    M.each(function (x, y) { var side = (x + 0.5 - ax) * nx + (y + 0.5 - ay) * ny; B.set(x, y, side > 0.6 ? F[3] : side < -0.6 ? F[1] : F[2], TAG.HAT); });
    [0.3, 0.5, 0.68].forEach(function (t, k) { var px = ax + dx * L * t, py = ay + dy * L * t, s = k % 2 ? 1 : -1; for (var j = 1; j <= wmax + 1; j++) { var qx = Math.round(px + nx * j * s - dx * j * 0.9), qy = Math.round(py + ny * j * s - dy * j * 0.9); if (M.has(qx, qy)) B.set(qx, qy, F[0], TAG.HAT); } });
    bez([[ax, ay], [bx, by]]).forEach(function (p, i, a) { if (i < a.length - 2) B.set(p[0], p[1], i < a.length * 0.55 ? F[4] : F[3], TAG.HAT); });
  }
  // run a drawing step and remember what it painted over: [index, previous colour, previous tag]...
  function trackLayer(P, fn) {
    var B = P.B, c0 = B.c.slice(), t0 = B.t.slice(), ch = [];
    fn();
    for (var i = 0; i < B.c.length; i++) if (B.c[i] !== c0[i] || B.t[i] !== t0[i]) ch.push(i, c0[i], t0[i]);
    return ch;
  }
  // hide hair a hat would cover: restore what lay under it; uncovered scalp takes the hat's shadow tone
  function clearHairP(P, layers, keep, fill) {
    var B = P.B;
    layers.forEach(function (ch) {
      if (!ch) return;
      for (var k = 0; k < ch.length; k += 3) {
        var i = ch[k], x = i % B.w, y = (i / B.w) | 0;
        if (B.t[i] !== TAG.HAIR || (XF ? keep(dzX(x), dzY(y)) : keep(x, y))) continue;
        if (ch[k + 2] === TAG.SKIN && fill != null) { B.c[i] = fill; B.t[i] = TAG.HAT; } else { B.c[i] = ch[k + 1]; B.t[i] = ch[k + 2]; }
      }
    });
  }
  var HAT_P = {
    cl_hat_wizard: { cut: 16, fill: H('#141236'), draw: function (P) {
      var B = P.B, R = HS(['#141236', '#22225a', '#33367f', '#4a50a8']);
      var brim = M64().ellipse(32, 17.5, 24.5, 4.3);
      shadeFill(B, brim, R, TAG.HAT, { cx: 20, cy: 14, rx: 30, ry: 8, edge: 0.5, th: [-0.35, 0.1, 0.5] });
      var cone = M64().poly([[19, 17], [22, 11], [25, 6], [29, 2], [34, 0], [39, 0], [44, 2], [47, 6], [45, 7], [42, 4], [38, 4], [37, 8], [41, 13], [45, 17]]);
      shadeFill(B, cone, R, TAG.HAT, { cx: 26, cy: 6, rx: 16, ry: 16, edge: 0.45, th: [-0.35, 0.1, 0.55] });
      innerLine(B, cone, R[0], function (t) { return t === TAG.HAT; }, [[0, 1]]);
      for (var x = 19; x <= 45; x++) if (cone.has(x, 15)) { B.set(x, 14, GOLD[2], TAG.HAT); B.set(x, 15, GOLD[1], TAG.HAT); }
      [[26, 10, 1], [34, 5, 1], [38, 11, 1], [30, 3, 0], [43, 3, 0], [23, 12, 0], [12, 18, 0], [52, 18, 0], [32, 12, 0]].forEach(function (s) { pStar(B, s[0], s[1], s[2], GOLD[3], GOLD[2], TAG.HAT); });
      innerLine(B, brim, R[0], function (t) { return t === TAG.SKIN || t === TAG.HAIR || t === TAG.BROW; }, [[0, 1]]);
    } },
    cl_hat_witch: { cut: 17, fill: H('#1b1022'), draw: function (P) {
      var B = P.B, R = HS(['#1b1022', '#2e1838', '#45264f', '#5e3a6a']);
      var brim = M64().fn(function (x, y) { var X = x + 0.5 - 32, Y = y + 0.5 - 18.5, a = -0.1, rx = X * Math.cos(a) - Y * Math.sin(a), ry = X * Math.sin(a) + Y * Math.cos(a); return (rx * rx) / (29 * 29) + (ry * ry) / (4.8 * 4.8) <= 1; });
      shadeFill(B, brim, R, TAG.HAT, { cx: 16, cy: 13, rx: 34, ry: 9, edge: 0.55, th: [-0.25, 0.15, 0.55] });
      var cone = M64().poly([[20, 18], [22, 11], [24, 6], [23, 2], [27, -1], [31, 1], [34, 3], [39, 3], [44, 6], [47, 10], [45, 11], [41, 8], [37, 8], [40, 13], [44, 18]]);
      shadeFill(B, cone, R, TAG.HAT, { cx: 22, cy: 3, rx: 20, ry: 18, edge: 0.45, th: [-0.3, 0.1, 0.55] });
      innerLine(B, cone, R[0], function (t) { return t === TAG.HAT; }, [[0, 1]]);
      strands(B, cone, [[[24, 7], [28, 5], [31, 4]], [[35, 4], [38, 6], [42, 8]]], R[0], TAG.HAT);
      for (var x = 20; x <= 44; x++) { var y = Math.round(14 + (x - 20) * 0.05); if (cone.has(x, y)) { B.set(x, y, H('#8f6cd1'), TAG.HAT); B.set(x, y + 1, H('#6a47a8'), TAG.HAT); B.set(x, y + 2, H('#4a2f7a'), TAG.HAT); } }
      stamp(B, ['sSSSs', 'S.d.S', 'sSSSs'], 29, 14, { s: SILVER[1], S: SILVER[2], d: H('#2e1838') }, TAG.HAT);
      innerLine(B, brim, R[0], function (t) { return t === TAG.SKIN || t === TAG.HAIR || t === TAG.BROW; }, [[0, 1]]);
    } },
    cl_hat_tricorn: { cut: 14, fill: H('#0e0a16'), draw: function (P) {
      var B = P.B, R = HS(['#0e0a16', '#1b1429', '#2a2238', '#3e3354']);
      var M = M64().poly([[11, 15], [16, 9], [22, 8], [27, 6], [32, 5], [37, 6], [42, 8], [48, 9], [53, 15], [46, 18], [38, 19], [32, 23], [26, 19], [18, 18]]);
      shadeFill(B, M, R, TAG.HAT, { cx: 22, cy: 6, rx: 26, ry: 16, edge: 0.45, th: [-0.3, 0.1, 0.55] });
      strands(B, M, [[[17, 11], [25, 15], [31, 21]], [[47, 11], [39, 15], [33, 21]]], R[0], TAG.HAT);
      var edge = [[11, 15], [18, 18], [26, 19], [32, 23], [38, 19], [46, 18], [53, 15]];
      for (var i = 0; i + 1 < edge.length; i++) bez([edge[i], edge[i + 1]]).forEach(function (p) { if (M.has(p[0], p[1] - 1)) B.set(p[0], p[1] - 1, i < 3 ? GOLD[2] : GOLD[1], TAG.HAT); });
      bez([[12, 14], [16, 10]]).forEach(function (p) { B.set(p[0], p[1], GOLD[2], TAG.HAT); });
      bez([[52, 14], [48, 10]]).forEach(function (p) { B.set(p[0], p[1], GOLD[1], TAG.HAT); });
      pFeather(B, 17, 10, 7, 0, 2.4, FEATHER_RAVEN);
      innerLine(B, M, R[0], function (t) { return t === TAG.SKIN || t === TAG.HAIR || t === TAG.BROW; }, [[0, 1]]);
    } },
    cl_hat_beret: { cut: 9, fill: H('#2e1232'), draw: function (P) {
      var B = P.B, R = HS(['#2e1232', '#4a1f4e', '#6a2e6a', '#8e4a8a']);
      var M = M64().fn(function (x, y) { var X = x + 0.5 - 34, Y = y + 0.5 - 14, a = 0.14, rx = X * Math.cos(a) + Y * Math.sin(a), ry = -X * Math.sin(a) + Y * Math.cos(a); return (rx * rx) / (17.5 * 17.5) + (ry * ry) / (6.4 * 6.4) <= 1; });
      shadeFill(B, M, R, TAG.HAT, { cx: 26, cy: 8, rx: 22, ry: 10, edge: 0.5, th: [-0.3, 0.12, 0.6] });
      edgePx(M, [[0, 1]]).forEach(function (p) { B.set(p[0], p[1], R[0], TAG.HAT); });
      bez([[22, 11], [28, 9], [34, 9]]).forEach(function (p) { if (M.has(p[0], p[1])) B.set(p[0], p[1], H('#b07ab0'), TAG.HAT); });
      B.set(33, 7, R[2], TAG.HAT); B.set(33, 6, R[3], TAG.HAT); B.set(34, 6, R[1], TAG.HAT);
      stamp(B, ['.g.', 'gAg', '.G.'], 21, 12, { g: GOLD[2], G: GOLD[1], A: H('#b99aee') }, TAG.HAT);
    } },
    cl_hat_hood: { hood: true, draw: function (P) {
      var B = P.B, R = HS(['#0a2016', '#143424', '#1f4c34', '#2e6646']), LIN = H('#071610');
      var outer = M64().ellipse(32, 27.5, 20.5, 19.5).or(torso(40, 15, 25, 6, 29).keep(function (x, y) { return y < 52; }));
      var hood = outer.clone().sub(M64().ellipse(32, 33, 12.6, 14.5));
      shadeFill(B, hood, R, TAG.HAT, { cx: 22, cy: 14, rx: 28, ry: 30, edge: 0.4, th: [-0.3, 0.1, 0.55] });
      hood.each(function (x, y) { var dx = (x + 0.5 - 32) / 12.6, dy = (y + 0.5 - 33) / 14.5, d = dx * dx + dy * dy; if (d < 1.3 && y < 41) B.set(x, y, d < 1.13 ? LIN : R[0], TAG.HAT); });
      strands(B, hood, [[[16, 42], [14, 47], [13, 51]], [[48, 42], [50, 47], [51, 51]], [[24, 47], [22, 51]], [[40, 47], [42, 51]], [[26, 10], [32, 9], [38, 10]]], R[0], TAG.HAT);
      stamp(B, ['.L.', 'LlL', '.L.'], 31, 47, { L: H('#4c9061'), l: H('#a8dc8c') }, TAG.ACC);
    } },
    cl_hat_crown: { draw: function (P) {
      var B = P.B, V = HS(['#6a47a8', '#8f6cd1', '#b99aee']), W = HS(['#c4c0d4', '#eceaf4', '#ffffff']), C = H('#ffd27a'), L1 = H('#337450'), L2 = H('#74b46e');
      for (var i = 0; i <= 10; i++) {
        var a = Math.PI * (0.06 + i * 0.088), x = Math.round(32 - Math.cos(a) * 16.5), y = Math.round(22 - Math.sin(a) * 10.5), F = i % 2 ? V : W;
        B.set(x - 2, y + 1, L1, TAG.ACC); B.set(x + 2, y, L2, TAG.ACC);
        B.set(x, y - 1, F[2], TAG.ACC); B.set(x - 1, y, F[1], TAG.ACC); B.set(x + 1, y, F[1], TAG.ACC); B.set(x, y + 1, F[0], TAG.ACC); B.set(x, y, C, TAG.ACC);
      }
    } },
    cl_hat_tophat: { cut: 17, fill: H('#0b0711'), draw: function (P) {
      var B = P.B, R = HS(['#0b0711', '#1b1429', '#2a2238', '#3e3354']);
      var brim = M64().ellipse(32, 17, 19.5, 3.6);
      shadeFill(B, brim, R, TAG.HAT, { cx: 22, cy: 13, rx: 26, ry: 7, edge: 0.5, th: [-0.3, 0.1, 0.55] });
      M64().poly([[21, 16.5], [20.5, 0], [43.5, 0], [43, 16.5]]).each(function (x, y) { var u = (x + 0.5 - 20.5) / 23; B.set(x, y, u < 0.1 ? R[3] : u < 0.17 ? H('#5a4e78') : u < 0.45 ? R[2] : u < 0.85 ? R[1] : R[0], TAG.HAT); });
      for (var x = 21; x <= 43; x++) { B.set(x, 12, SILVER[3], TAG.HAT); B.set(x, 13, SILVER[2], TAG.HAT); B.set(x, 14, SILVER[1], TAG.HAT); }
      stamp(B, ['.MM', 'Mm.', 'Mm.', 'Mm.', '.MM'], 30, 10, { M: H('#e8eeff'), m: H('#9fb0d8') }, TAG.HAT);
      innerLine(B, brim, R[0], function (t) { return t === TAG.SKIN || t === TAG.HAIR || t === TAG.BROW; }, [[0, 1]]);
    } },
    cl_hat_circlet: { draw: function (P) {
      var B = P.B;
      for (var x = 18; x <= 45; x++) { var u = (x + 0.5 - 32) / 14, y = Math.round(21.5 - 2.2 * (1 - u * u)); B.set(x, y, SILVER[2], TAG.METAL); B.set(x, y + 1, SILVER[1], TAG.METAL); }
      stamp(B, ['.sss.', 'sMMms', 'sMgMs', '.sss.'], 30, 17, { s: SILVER[2], M: H('#c4e6ff'), m: H('#9ac8f0'), g: WHITE }, TAG.METAL);
    } }
  };
  var CLOAK_P = {
    cl_cloak_midnight: { R: HS(['#0a0f26', '#141c42', '#1f2c62', '#2e4084']), lin: H('#3e2a62'), clasp: SILVER, deco: function (x, y) { var k = (x * 7 + y * 13) % 29; return k === 0 ? WHITE : k === 11 ? H('#c8d4f0') : -1; } },
    cl_cloak_ember: { R: HS(['#4a0c14', '#7a1a20', '#a8302a', '#d0503a']), R2: HS(['#8a3a10', '#c45a1e', '#e8843c', '#ffbc62']), lin: H('#5a1a10'), clasp: GOLD, deco: function (x, y) { return y > 57 && (x * 5 + y * 3) % 17 === 0 ? H('#ffe08a') : -1; } },
    cl_cloak_moss: { R: HS(['#12301e', '#1e4a2c', '#2e6a3c', '#4a8a50']), lin: H('#574039'), clasp: HS(['#3e2d2b', '#7a5a48', '#9c7a5e', '#c09a74']), leafy: true, deco: function (x, y) { return (x * 11 + y * 7) % 31 === 0 ? H('#74b46e') : -1; } },
    cl_cloak_raven: { R: HS(['#0b0711', '#17101f', '#251c33', '#3a2e4e']), lin: H('#2a2238'), clasp: SILVER, feathers: true },
    cl_cloak_silver: { R: HS(['#6e6a88', '#9c98b8', '#c8c4de', '#ece8f8']), lin: H('#b99aee'), clasp: HS(['#4a6ab8', '#9ac8f0', '#c4e6ff', '#ffffff']), deco: function (x, y) { var k = (x * 13 + y * 5) % 23; return k === 0 ? WHITE : k === 7 ? H('#c4f0ff') : k === 15 ? H('#f6d0ec') : -1; } }
  };
  function paintCloakP(B, M, C) {
    var R = C.R;
    shadeFill(B, M, R, TAG.CLOTH, { cx: 14, cy: 44, rx: 34, ry: 26, edge: 0.4 });
    if (C.R2) M.each(function (x, y) { if (y >= 56 || (y >= 53 && (ti(x) + tj(y)) % 2 === 0)) { var i = R.indexOf(B.get(x, y)); if (i >= 0) B.set(x, y, C.R2[i], TAG.CLOTH); } });
    if (C.feathers) M.each(function (x, y) { // overlapping rows of feather tips with a violet sheen
      var X = ti(x), Y = tj(y), row = Math.floor(Y / 3), ph = (X + row * 2) % 4;
      if (Y % 3 === 2 && ph !== 0) B.set(x, y, R[0], TAG.CLOTH);
      else if (Y % 3 === 0 && ph === 1 && (X + row) % 3 === 0) B.set(x, y, H('#6a47a8'), TAG.CLOTH);
    });
    if (C.deco) M.each(function (x, y) { var c = C.deco(ti(x), tj(y)); if (c >= 0) B.set(x, y, c, TAG.CLOTH); });
  }
  function cloakBackP(P, C) {
    var B = P.B, M = torso(42, 13, 29, 9, 32);
    if (C.feathers) M.poly([[19, 47], [16, 38], [21, 41], [24, 35], [28, 41], [32, 36], [36, 41], [40, 35], [43, 41], [48, 38], [45, 47]]);
    if (C.leafy) for (var i = 0; i < 6; i++) { var x = 14 + i * 7; M.poly([[x - 2, 45], [x + 1, 39 + (i % 2) * 2], [x + 3, 45]]); }
    paintCloakP(B, M, C);
  }
  function cloakFrontP(P, C) {
    var B = P.B, M = torso(47, 9, 25, 8, 28).keep(function (x, y) { var dx = Math.abs(x + 0.5 - 32); return dx >= 10 + Math.max(0, y - 49) * 0.28; });
    paintCloakP(B, M, C);
    M.each(function (x, y) { if (!M.has(x < 32 ? x + 1 : x - 1, y)) B.set(x, y, C.lin, TAG.CLOTH); });
    if (C.leafy) M.each(function (x, y) { if (!M.has(x < 32 ? x + 1 : x - 1, y) && tj(y) % 3 === 0) { B.set(x + (x < 32 ? 1 : -1), y, H('#4c9061'), TAG.CLOTH); B.set(x + (x < 32 ? 1 : -1), y + 1, H('#337450'), TAG.CLOTH); } });
    // clasp and chain at the throat
    var K = C.clasp;
    bez([[22, 50], [32, 52], [42, 50]]).forEach(function (p, i) { if (i % 2 === 0) B.set(p[0], p[1], K[1], TAG.METAL); });
    stamp(B, ['.ab.', 'abca', 'abba', '.aa.'], 30, 47, { a: K[1], b: K[2], c: K[3] }, TAG.METAL);
  }
  // outfits: full replacements for the robe body
  var OUTFIT_P = {
    cl_outfit_scholar: function (P) {
      var B = P.B, M = torso(47, 9, 25, 8, 28), BLK = HS(['#0e0a16', '#1b1429', '#2a2238', '#3e3454']), VIO = HS(['#3e2466', '#5e3c96', '#8a66c8']);
      shadeFill(B, M, BLK, TAG.CLOTH, { cx: 16, cy: 46, rx: 32, ry: 24, edge: 0.35 });
      stamp(B, ['.wwwwwwwwww.', 'wWWWWWWWWWWw'], 26, 46, { w: H('#c8c4d8'), W: H('#f4f2fb') }, TAG.CLOTH);
      [[[26, 48], [25, 56], [24, 64]], [[38, 48], [39, 56], [40, 64]]].forEach(function (cp, k) {
        bez(cp).forEach(function (p) { for (var j = -2; j <= 1; j++) { var y = p[1], c = (y % 6 === 3) ? SILVER[2] : (j === -2 || j === 1) ? VIO[0] : (k ? VIO[1] : VIO[2]); B.set(p[0] + j, y, c, TAG.CLOTH); } B.set(p[0] + (k ? 2 : -3), p[1], SILVER[1], TAG.CLOTH); });
      });
      for (var y = 50; y < 64; y++) B.set(32, y, y % 4 === 0 ? SILVER[2] : BLK[0], TAG.CLOTH);
    },
    cl_outfit_alchemist: function (P) {
      var B = P.B, M = torso(47, 9, 25, 8, 28), LEA = HS(['#3e2414', '#5a3a24', '#7a5034', '#9a6a44']), APR = HS(['#1e1612', '#2e221c', '#43322a', '#5a4436']);
      shadeFill(B, M, LEA, TAG.CLOTH, { cx: 16, cy: 46, rx: 32, ry: 24, edge: 0.35 });
      shadeFill(B, M64().poly([[27, 47], [37, 47], [32, 54]]).and(M), UNDERSHIRT, TAG.CLOTH, { cx: 28, cy: 46, rx: 8, ry: 10 });
      var lap = M64().poly([[26, 47], [31, 55], [28, 58], [21, 52], [22, 47]]).sym().and(M);
      shadeFill(B, lap, LEA, TAG.CLOTH, { cx: 20, cy: 44, rx: 22, ry: 18, bias: 0.3, edge: 0.4 });
      edgePx(lap, [[0, 1], [1, 0], [-1, 0]]).forEach(function (p) { if (M.has(p[0], p[1] + 1)) B.set(p[0], p[1], LEA[0], TAG.CLOTH); });
      var apr = M64().poly([[25, 56], [39, 56], [40, 64], [24, 64]]);
      shadeFill(B, apr, APR, TAG.CLOTH, { cx: 26, cy: 52, rx: 18, ry: 14, edge: 0.4 });
      B.hline(25, 39, 57, APR[3], TAG.CLOTH);
      [[[26, 56], [28, 50], [28, 47]], [[38, 56], [36, 50], [36, 47]]].forEach(function (cp) { bez(cp).forEach(function (p) { B.set(p[0], p[1], APR[2], TAG.CLOTH); }); });
      stamp(B, ['gg', 'gG'], 25, 55, { g: GOLD[2], G: GOLD[1] }, TAG.METAL); stamp(B, ['gg', 'Gg'], 38, 55, { g: GOLD[2], G: GOLD[1] }, TAG.METAL);
      [[19, 57], [19, 61], [44, 57], [44, 61]].forEach(function (p) { B.set(p[0], p[1], GOLD[2], TAG.METAL); B.set(p[0] + 1, p[1], GOLD[1], TAG.METAL); B.set(p[0], p[1] + 1, GOLD[1], TAG.METAL); B.set(p[0] + 1, p[1] + 1, GOLD[0], TAG.METAL); });
      stamp(B, ['.c.', 'gGg', 'vVv', 'vVv', '.v.'], 15, 52, { c: H('#a8805a'), g: H('#c8d4f0'), G: WHITE, v: H('#2fbf7f'), V: H('#5dffb0') }, TAG.GLASS);
    },
    cl_outfit_bard: function (P) {
      var B = P.B, M = torso(47, 9, 25, 8, 28), WINE = HS(['#3a0c1e', '#5e1630', '#86223f', '#a83a58']);
      shadeFill(B, M, WINE, TAG.CLOTH, { cx: 16, cy: 46, rx: 32, ry: 24, edge: 0.35 });
      M.each(function (x, y) { var dx = Math.abs(x + 0.5 - 32); if (dx > 15.5 && y < 60 && ti(x) % 3 === 0) B.set(x, y, tj(y) % 2 ? GOLD[1] : GOLD[2], TAG.CLOTH); });
      bez([[17, 53], [32, 57], [47, 53]]).forEach(function (p) { B.set(p[0], p[1], GOLD[2], TAG.CLOTH); B.set(p[0], p[1] + 1, GOLD[0], TAG.CLOTH); });
      for (var y = 50; y < 64; y++) { B.set(31, y, GOLD[2], TAG.CLOTH); B.set(32, y, GOLD[1], TAG.CLOTH); }
      [[30, 59], [30, 62]].forEach(function (p) { B.set(p[0], p[1], GOLD[3], TAG.METAL); B.set(p[0] + 3, p[1], GOLD[3], TAG.METAL); });
      var ruff = M64().ellipse(32, 48, 10.5, 3.6).sub(M64().ellipse(32, 46.5, 6, 2.4));
      ruff.each(function (x, y) { B.set(x, y, (x + y) % 2 ? H('#f4f2fb') : H('#c8c4d8'), TAG.CLOTH); });
      edgePx(ruff, [[0, 1]]).forEach(function (p) { if (p[0] % 2) B.set(p[0], p[1] + 1, H('#c8c4d8'), TAG.CLOTH); });
    },
    cl_outfit_duelist: function (P) {
      var B = P.B, M = torso(47, 9, 25, 8, 28), SHIRT = HS(['#8a86a0', '#c4c0d4', '#eceaf4', '#ffffff']), CH = HS(['#14131c', '#1f1e2a', '#2d2c3e', '#45445a']), RED = HS(['#5a1418', '#9a2420', '#c83a30', '#e86048']);
      shadeFill(B, M, SHIRT, TAG.CLOTH, { cx: 16, cy: 44, rx: 32, ry: 24, edge: 0.3, th: [-0.5, -0.05, 0.55] });
      var vest = M.clone().keep(function (x, y) { var dx = Math.abs(x + 0.5 - 32); return y >= 49 && dx <= 13 + (y - 49) * 0.35; }).sub(M64().poly([[26, 47], [38, 47], [32, 58]]));
      shadeFill(B, vest, CH, TAG.CLOTH, { cx: 18, cy: 44, rx: 26, ry: 22, edge: 0.4 });
      bez([[26, 49], [32, 58]]).forEach(function (p) { B.set(p[0], p[1], CH[3], TAG.CLOTH); });
      [[31, 59], [31, 62]].forEach(function (p) { B.set(p[0], p[1], SILVER[3], TAG.METAL); B.set(p[0] + 1, p[1], SILVER[1], TAG.METAL); });
      stamp(B, ['.wWWWw.', 'wWWwWWw', '.wWWWw.', '..wWw..', '...w...'], 29, 46, { w: SHIRT[1], W: SHIRT[3] }, TAG.CLOTH);
      var sash = M64().thick(bez([[15, 50], [32, 57], [49, 64]]), 2).and(M);
      shadeFill(B, sash, RED, TAG.CLOTH, { cx: 20, cy: 48, rx: 30, ry: 16, edge: 0.4 });
      bez([[16, 50], [33, 57], [48, 63]]).forEach(function (p, i) { if (i % 3 === 0) B.set(p[0], p[1] + 1, RED[0], TAG.CLOTH); });
    },
    cl_outfit_moonweave: function (P) {
      var B = P.B, M = torso(47, 9, 25, 8, 28), LAV = HS(['#8a7cb4', '#b4a8d8', '#d8cff0', '#f2eeff']);
      shadeFill(B, M, LAV, TAG.CLOTH, { cx: 16, cy: 44, rx: 32, ry: 24, edge: 0.3, th: [-0.5, -0.05, 0.55] });
      [[14, 54], [20, 57], [44, 55], [49, 58]].forEach(function (p) { B.line(p[0], p[1], p[0] + (p[0] < 32 ? -1 : 1), p[1] + 6, LAV[0], TAG.CLOTH); });
      var V = M64().poly([[26, 47], [38, 47], [32, 57]]).and(M);
      shadeFill(B, V, HS(['#2a1848', '#4a2f7a', '#6a47a8']), TAG.CLOTH, { cx: 28, cy: 46, rx: 8, ry: 10 });
      bez([[26, 47], [32, 57]]).forEach(function (p) { B.set(p[0], p[1], SILVER[3], TAG.CLOTH); }); bez([[38, 47], [32, 57]]).forEach(function (p) { B.set(p[0], p[1], SILVER[2], TAG.CLOTH); });
      stamp(B, ['.MM', 'M..', 'M..', '.MM'], 31, 59, { M: H('#e8eeff') }, TAG.METAL);
      M.each(function (x, y) { var k = (ti(x) * 13 + tj(y) * 7) % 37; if (k === 0) B.set(x, y, WHITE, TAG.GLASS); else if (k === 19) B.set(x, y, H('#c4f0ff'), TAG.GLASS); });
      [[18, 52], [45, 60]].forEach(function (c) { B.set(c[0], c[1], WHITE, TAG.GLASS); B.set(c[0] - 1, c[1], LAV[3], TAG.GLASS); B.set(c[0] + 1, c[1], LAV[3], TAG.GLASS); B.set(c[0], c[1] - 1, LAV[3], TAG.GLASS); B.set(c[0], c[1] + 1, LAV[3], TAG.GLASS); });
    },
    cl_outfit_ranger: function (P) {
      var B = P.B, S2 = P.skin, M = torso(47, 9, 25, 8, 28), GRN = HS(['#10302a', '#1a4434', '#245a40', '#337450']), LEA = HS(['#281d21', '#3e2d2b', '#574039', '#7a5a48']);
      shadeFill(B, M, GRN, TAG.CLOTH, { cx: 16, cy: 46, rx: 32, ry: 24, edge: 0.35 });
      var V = M64().poly([[28, 47], [36, 47], [32, 55]]).and(M);
      V.each(function (x, y) { B.set(x, y, x > 32 ? S2.s : S2.b, TAG.SKIN); });
      [[29, 49], [34, 49], [30, 51], [33, 51]].forEach(function (p, i) { B.set(p[0], p[1], LEA[3], TAG.CLOTH); });
      B.set(31, 50, LEA[2], TAG.CLOTH); B.set(32, 50, LEA[2], TAG.CLOTH); B.set(31, 52, LEA[2], TAG.CLOTH); B.set(32, 52, LEA[2], TAG.CLOTH);
      var pa = M64().ellipse(13, 54, 9, 6).and(M);
      shadeFill(B, pa, LEA, TAG.CLOTH, { cx: 8, cy: 50, rx: 12, ry: 8, edge: 0.45 });
      bez([[6, 53], [13, 51], [20, 54]]).forEach(function (p) { B.set(p[0], p[1], LEA[0], TAG.CLOTH); });
      [[9, 55], [13, 54], [17, 55]].forEach(function (p) { B.set(p[0], p[1], SILVER[2], TAG.METAL); });
      var strap = M64().thick(bez([[21, 48], [33, 56], [46, 64]]), 1).and(M);
      strap.each(function (x, y) { B.set(x, y, (ti(x) + tj(y)) % 5 === 0 ? LEA[3] : LEA[2], TAG.CLOTH); });
      stamp(B, ['ggg', 'g.g', 'ggg'], 31, 55, { g: GOLD[1] }, TAG.METAL);
    }
  };
  function dressPortrait(def, lk) {
    if (!lk.hat && !lk.cloak && !lk.outfit) return def;
    var back0 = def.back, body0 = def.body, front0 = def.front;
    var HT = lk.hat ? HAT_P[lk.hat] : null, CL = lk.cloak ? CLOAK_P[lk.cloak] : null, OF = lk.outfit ? OUTFIT_P[lk.outfit] : null;
    def.back = function (P) { if (CL) cloakBackP(P, CL); if (HT && HT.hood) P.robeR = P_ROBE[lk.robe]; else P.hairBack = HT ? trackLayer(P, function () { back0(P); }) : (back0(P), null); };
    def.body = function (P) { if (OF) OF(P); else body0(P); if (CL) cloakFrontP(P, CL); };
    def.front = function (P) {
      if (!HT) { front0(P); return; }
      var hairFront = trackLayer(P, function () { front0(P); });
      HT.draw(P);
      if (HT.hood) clearHairP(P, [P.hairBack, hairFront], function (x, y) { var dx = (x + 0.5 - 32) / 12.6, dy = (y + 0.5 - 33) / 14.5; return dx * dx + dy * dy <= 1 && y > 18; }, null);
      else if (HT.cut) clearHairP(P, [P.hairBack, hairFront], function (x, y) { return y >= HT.cut; }, HT.fill);
    };
    return def;
  }

  // ---------------------------------------------------------------- sprite pieces (logical right-facing; standard head rows 9..18)
  var HAT_S = {
    cl_hat_wizard: { hide: 'top', ramp: HS(['#22225a', '#33367f', '#4a50a8']), dark: H('#141236'),
      D: [0, ['...........TT.......', '..........TTTT......', '.........TT*T.......', '........TTTTT.......', '.......TTTTTT.......', '.......TT*TTTT......', '......TTTTTTTT......', '......gggggggg......', '..TTTTTTTTTTTTTTTT..', '...tttttttttttttt...']],
      R: [0, ['.....TT.............', '.....TTT............', '......TTT...........', '.......TTT*.........', '.......TTTTT........', '......TT*TTT........', '......TTTTTTT.......', '.....ggggggggg......', '..TTTTTTTTTTTTTTTT..', '...tttttttttttttt...']],
      U: [0, ['........TT..........', '.......TTTT.........', '.......TTTTT........', '........TT*TT.......', '.......TTTTTT.......', '......TTTTT*TT......', '......TTTTTTTT......', '......gggggggg......', '..TTTTTTTTTTTTTTTT..', '...TTTTTTTTTTTTTT...']] },
    cl_hat_witch: { hide: 'top', ramp: HS(['#2e1838', '#45264f', '#5e3a6a']), dark: H('#1b1022'),
      D: [0, ['.............TT.....', '...........TTT......', '..........TTT.......', '.........TTTT.......', '........TTTTTT......', '.......TTTTTTT......', '.......PPPBBPPP.....', '......TTTTTTTTT.....', '.TTTTTTTTTTTTTTTTTT.', '..tttttttttttttttt..']],
      R: [0, ['..TT................', '...TTT..............', '....TTT.............', '.....TTTT...........', '......TTTTT.........', '......TTTTTT........', '......PPPPBBP.......', '.....TTTTTTTTT......', '.TTTTTTTTTTTTTTTTTT.', '..tttttttttttttttt..']],
      U: [0, ['.............TT.....', '...........TTT......', '..........TTT.......', '.........TTTT.......', '........TTTTTT......', '.......TTTTTTT......', '.......PPPPPPPP.....', '......TTTTTTTTT.....', '.TTTTTTTTTTTTTTTTTT.', '..TTTTTTTTTTTTTTTT..']] },
    cl_hat_tricorn: { hide: 'top', ramp: HS(['#1b1429', '#2a2238', '#3e3354']), dark: H('#0e0a16'),
      D: [4, ['.f..................', '..F..............T..', '..FT............TT..', '...TTT.TTTTTT.TTT...', '...TTTTTTTTTTTTTT...', '...gTTTTTTTTTTTTg...', '....ggTTTTTTTTgg....', '......gggTTggg......']],
      R: [4, ['.f..................', '..F.................', '..FF....TTT.........', '...F.TTTTTTTT.......', '...TTTTTTTTTTTTT....', '..TTTTTTTTTTTTTTTT..', '.ggggggggggggggggg..']],
      U: [4, ['..f.................', '...F.............T..', '...TT...........TT..', '...TTTTTTTTTTTTTTT..', '...TTTTTTTTTTTTTTT..', '...gTTTTTTTTTTTTTg..', '....ggggggggggggg...']] },
    cl_hat_beret: { hide: 'top', ramp: HS(['#4a1f4e', '#6a2e6a', '#8e4a8a']), dark: H('#2e1232'),
      D: [5, ['.........T..........', '.....TTTTTTTTT......', '...TTTTTTTTTTTTTT...', '..TTgTTTTTTTTTTTTT..', '...ttttttttttttTTT..', '...............TT...']],
      R: [5, ['.......T............', '....TTTTTTTT........', '..TTTTTTTTTTTT......', '.TTTTTTTTTTTTTg.....', '.TTtttttttttttt.....', '.TT.................']],
      U: [5, ['..........T.........', '......TTTTTTTTT.....', '...TTTTTTTTTTTTTT...', '..TTTTTTTTTTTTTTTT..', '..TTTtttttttttttt...', '..TT................']] },
    cl_hat_hood: { hide: 'hood', ramp: HS(['#143424', '#1f4c34', '#2e6646']), dark: H('#0a2016'),
      D: [7, ['......TTTTTTTT......', '....TTTTTTTTTTTT....', '...TTTTTTTTTTTTTT...', '...TTTttttttttTTT...', '...TTt........tTT...', '...TT..........TT...', '...TT..........TT...', '...TT..........TT...', '...TT..........TT...', '...TTT........TTT...', '...TTTT......TTTT...', '..TTTTTT....TTTTTT..', '..TTTTTTTTLTTTTTTT..']],
      R: [7, ['.....TTTTTTT........', '...TTTTTTTTTTT......', '..TTTTTTTTTTTTT.....', '..TTTTTTTTTTttt.....', '..TTTTTTTTTt........', '..TTTTTTTTt.........', '..TTTTTTTT..........', '..TTTTTTTT..........', '..TTTTTTTT..........', '..TTTTTTTTT.........', '...TTTTTTTTT........', '...TTTTTTTTTT.......', '..TTTTTTTTTTT.......', '.TTTT...............']],
      U: [7, ['......TTTTTTTT......', '....TTTTTTTTTTTT....', '...TTTTTTTTTTTTTT...', '...TTTTTTTTTTTTTT...', '...TTTTTtTTTTTTTT...', '...TTTTTTtTTTTTTT...', '...TTTTTTTtTTTTTT...', '...TTTTTTTTTTTTTT...', '...TTTTTTTTTTTTTT...', '...TTTTTTTTTTTTTT...', '...TTTTTTTTTTTTTT...', '..TTTTTTTTTTTTTTTT..', '..TTTTTTTTTTTTTTTT..', '......TTTTTTTT......', '.......TTTTTT.......', '........TTTT........']] },
    cl_hat_crown: { hide: null, ramp: HS(['#245a40', '#337450', '#4c9061']),
      D: [8, ['.....v...w...v......', '....LwLvLwLvLwLvL...', '.....L...L...L......']],
      R: [8, ['.....w...v..........', '....LvLwLvLwLvL.....', '.....L...L...L......']],
      U: [8, ['.....v...w...v......', '....LwLvLwLvLwLvL...', '......L...L...L.....']] },
    cl_hat_tophat: { hide: 'top', ramp: HS(['#1b1429', '#2a2238', '#3e3354']), dark: H('#0b0711'),
      D: [0, ['.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....sssssMssss.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '...TTTTTTTTTTTTTT...', '....tttttttttttt....']],
      R: [0, ['.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....sssssssssM.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '..TTTTTTTTTTTTTTTT..', '...tttttttttttttt...']],
      U: [0, ['.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '.....ssssssssss.....', '.....TTTTTTTTTT.....', '.....TTTTTTTTTT.....', '...TTTTTTTTTTTTTT...', '....TTTTTTTTTTTT....']] },
    cl_hat_circlet: { hide: null, ramp: SILVER.slice(0, 3),
      D: [11, ['....ssssssMMssss....']],
      R: [11, ['....ssssssssssM.....']],
      U: [11, ['....ssssssssssss....']] }
  };
  function hatSprite(HT) {
    return function (S, dir, f, L, hairIdx, prevM, prevF) {
      var t = HT[dir === 'down' ? 'D' : dir === 'up' ? 'U' : 'R'];
      var leg = { T: S.mat('hatT', HT.ramp), t: { c: HT.dark != null ? HT.dark : HT.ramp[0] }, g: { c: GOLD[2] }, '*': { c: GOLD[3] }, s: { c: SILVER[2] }, M: { c: H('#e8eeff') },
        P: { c: H('#6a47a8') }, B: { c: SILVER[2] }, F: { c: FEATHER_RAVEN[2] }, f: { c: FEATHER_RAVEN[4] }, v: { c: H('#b99aee') }, w: { c: WHITE }, L: { c: H('#4c9061') } };
      if (HT.hide === 'hood') leg.L = { c: H('#74b46e') };
      var before = S.m.slice(), beforeFx = S.fx.slice();
      S.tpl(t[1], t[0] + L.dy, leg);
      if (!HT.hide) return;
      hairIdx.forEach(function (i) {
        if (S.m[i] !== before[i] || S.fx[i] !== beforeFx[i]) return; // the hat covers it
        var xs = i % S.w, y = (i / S.w) | 0, x = S.flip ? S.w - 1 - xs : xs, keep;
        if (HT.hide === 'top') keep = y >= L.headY;
        else if (dir === 'down') keep = x >= 5 && x <= 14 && y >= L.headY + 2 && y <= L.headY + 9;
        else if (dir === 'up') keep = false;
        else keep = x >= 10 && y >= L.headY + 3 && y <= L.headY + 9;
        if (!keep) { S.m[i] = prevM[i]; S.fx[i] = prevF[i]; }
      });
    };
  }
  var CLOAK_S = {
    cl_cloak_midnight: { R: HS(['#141c42', '#1f2c62', '#2e4084']), clasp: [SILVER[2], SILVER[3]], dots: function (x, y) { var k = (x * 7 + y * 5) % 13; return k === 0 ? WHITE : k === 6 ? H('#c8d4f0') : -1; } },
    cl_cloak_ember: { R: HS(['#7a1a20', '#a8302a', '#d0503a']), R2: HS(['#c45a1e', '#e8843c', '#ffbc62']), clasp: [GOLD[2], GOLD[3]], dots: function (x, y) { return y >= 27 && (x * 3 + y) % 7 === 0 ? H('#ffe08a') : -1; } },
    cl_cloak_moss: { R: HS(['#1e4a2c', '#2e6a3c', '#4a8a50']), clasp: [H('#9c7a5e'), H('#c09a74')], hem: true, hemDot: H('#74b46e'), dots: function (x, y) { return (x * 5 + y * 3) % 11 === 0 ? H('#4c9061') : -1; } },
    cl_cloak_raven: { R: HS(['#17101f', '#251c33', '#3a2e4e']), clasp: [SILVER[2], SILVER[3]], hem: true, hemDot: H('#6a47a8'), dots: function (x, y) { return y % 2 === 0 && (x + (y >> 1)) % 3 === 0 ? H('#0b0711') : ((x * 3 + y * 5) % 17 === 0 ? H('#6a47a8') : -1); } },
    cl_cloak_silver: { R: HS(['#9c98b8', '#c8c4de', '#ece8f8']), clasp: [H('#9ac8f0'), WHITE], dots: function (x, y) { var k = (x * 7 + y * 3) % 17; return k === 0 ? WHITE : k === 9 ? H('#c4f0ff') : -1; } }
  };
  function cloakSprite(C) {
    function put(S, x, y) {
      S.put(x, y, C.R2 && y >= S.L.tt + 6 ? S.mat('cloak2', C.R2) : S.mat('cloak', C.R));
      var c = C.dots ? C.dots(x, y - S.L.dy) : -1; if (c >= 0) S.dot(x, y, c);
    }
    return {
      behind: function (S, dir, f, L) {
        var t0 = L.tt, hem = 28;
        if (dir === 'down') {
          var sway = [0, 1, 0, -1][f];
          for (var y = t0; y <= hem; y++) {
            var t = (y - t0) / (hem - t0), hw = 5.3 + t * 3, s = Math.round(sway * t);
            for (var x = Math.round(9.5 - hw + 0.5) + s; x <= Math.round(9.5 + hw - 0.5) + s; x++) { if (y === hem && C.hem && x % 2) { S.dot(x, y - 1, C.hemDot); continue; } put(S, x, y); }
          }
        } else {
          var trail = (f === 1 || f === 3) ? 1 : 0;
          for (var y2 = t0; y2 <= hem; y2++) {
            var t2 = (y2 - t0) / (hem - t0), xb = Math.round(6 - t2 * (3.6 + trail) - (y2 > t0 + 2 ? 0.4 : 0)), xf = Math.round(9 + t2 * 0.5);
            for (var x2 = xb; x2 <= xf; x2++) { if (y2 === hem && C.hem && x2 % 2) continue; put(S, x2, y2); }
          }
        }
      },
      front: function (S, dir, f, L) {
        var c = L.tt;
        if (dir === 'up') {
          var sway = [0, 1, 0, -1][f], hem = 28;
          for (var y = c - 1; y <= hem; y++) {
            var t = Math.max(0, (y - c) / (hem - c)), hw = y < c ? 3.5 : 5 + t * 3.3, s = Math.round(sway * t);
            for (var x = Math.round(9.5 - hw + 0.5) + s; x <= Math.round(9.5 + hw - 0.5) + s; x++) { if (y === hem && C.hem && x % 2) continue; put(S, x, y); }
          }
        } else if (dir === 'down') {
          [[5, 0], [6, 0], [7, 0], [12, 0], [13, 0], [14, 0], [5, 1], [14, 1]].forEach(function (p) { put(S, p[0], c + p[1]); });
          S.dot(9, c, C.clasp[0]); S.dot(10, c, C.clasp[1]);
        } else {
          put(S, 8, c - 1); put(S, 9, c - 1); put(S, 7, c); put(S, 8, c);
          S.dot(11, c, C.clasp[0]);
        }
      }
    };
  }
  var LEA3 = HS(['#5a3a24', '#7a5034', '#9a6a44']);
  var OUTFIT_S = {
    cl_outfit_scholar: { top: HS(['#1b1429', '#2a2238', '#3e3454']), arm: HS(['#1b1429', '#2a2238', '#3e3454']), gown: HS(['#120c1c', '#1b1429', '#2a2238']), tails: null, shoe: HS(['#0b0711', '#1b1429', '#2a2238']),
      body: function (S, dir, f, L) {
        var t = L.tt, V = H('#8a66c8'), v = H('#5e3c96'), s = SILVER[2];
        if (dir === 'down') { S.dot(9, t, H('#f4f2fb')); S.dot(10, t, H('#f4f2fb')); for (var y = t; y < t + 6; y++) { S.dot(8, y, (y - t) % 3 === 2 ? s : V); S.dot(11, y, (y - t) % 3 === 2 ? s : v); } }
        else if (dir === 'up') { for (var x = 7; x <= 12; x++) S.dot(x, t, x % 2 ? V : v); }
        else { S.dot(11, t, V); for (var y2 = t + 1; y2 < t + 5; y2++) S.dot(11, y2, (y2 - t) % 3 === 2 ? s : V); }
      } },
    cl_outfit_alchemist: { top: LEA3, arm: LEA3, tails: HS(['#3e2414', '#5a3a24', '#7a5034']), tailLen: 3, gown: null,
      body: function (S, dir, f, L) {
        var t = L.tt, A = S.mat('apron', HS(['#1e1612', '#2e221c', '#43322a']));
        if (dir === 'down') { S.rect(8, t + 2, 4, L.tb - t + 2, A); S.dot(9, t, H('#f4ead8')); S.dot(10, t, H('#d8ccb8')); S.dot(7, t + 1, GOLD[2]); S.dot(7, t + 3, GOLD[2]); S.dot(12, t + 1, GOLD[1]); S.dot(12, t + 3, GOLD[1]); }
        else if (dir === 'up') { S.dot(8, t + 3, H('#43322a')); S.dot(9, t + 4, H('#43322a')); S.dot(10, t + 4, H('#43322a')); S.dot(11, t + 3, H('#43322a')); }
        else { for (var y = t + 2; y <= L.tb + 2; y++) S.put(12, y, A); S.dot(11, t + 1, GOLD[2]); S.dot(12, t, H('#f4ead8')); }
      } },
    cl_outfit_bard: { top: HS(['#5e1630', '#86223f', '#a83a58']), arm: HS(['#5e1630', '#86223f', '#a83a58']), tails: HS(['#3a0c1e', '#5e1630', '#86223f']), tailLen: 1, gown: null, leg: HS(['#2a1428', '#3e1c3a', '#5a2a52']),
      body: function (S, dir, f, L) {
        var t = L.tt;
        if (dir === 'down') { for (var x = 7; x <= 12; x++) S.dot(x, t, x % 2 ? WHITE : H('#c8c4d8')); for (var y = t + 1; y <= L.tb; y++) S.dot(9, y, GOLD[2]); S.dot(5, t + 1, GOLD[2]); S.dot(14, t + 1, GOLD[1]); S.dot(10, t + 2, GOLD[3]); }
        else if (dir === 'up') { for (var x2 = 7; x2 <= 12; x2++) S.dot(x2, t, H('#f4f2fb')); S.dot(7, L.tb, GOLD[2]); S.dot(12, L.tb, GOLD[1]); }
        else { S.dot(11, t, WHITE); S.dot(12, t, H('#c8c4d8')); for (var y2 = t + 1; y2 <= L.tb; y2++) S.dot(12, y2, GOLD[2]); }
      } },
    cl_outfit_duelist: { top: HS(['#1f1e2a', '#2d2c3e', '#45445a']), arm: HS(['#a8a4bc', '#dcdae8', '#ffffff']), tails: null, gown: null, leg: HS(['#0e0a16', '#1b1429', '#2a2238']), shoe: HS(['#0b0711', '#1b1429', '#2a2238']),
      body: function (S, dir, f, L) {
        var t = L.tt, red = H('#c83a30'), red2 = H('#9a2420');
        if (dir === 'down') { S.dot(9, t, WHITE); S.dot(10, t, H('#dcdae8')); S.dot(9, t + 1, H('#dcdae8')); S.dot(9, t + 3, SILVER[3]); for (var x = 7; x <= 12; x++) S.dot(x, L.tb - 1, x % 2 ? red : red2); S.dot(12, L.tb, red); S.dot(12, L.tb + 1, red2); }
        else if (dir === 'up') { for (var x2 = 7; x2 <= 12; x2++) S.dot(x2, L.tb - 1, x2 % 2 ? red : red2); }
        else { S.dot(12, t, WHITE); S.dot(12, t + 2, SILVER[3]); for (var x3 = 7; x3 <= 12; x3++) S.dot(x3, L.tb - 1, x3 % 2 ? red : red2); S.dot(6, L.tb, red); S.dot(6, L.tb + 1, red2); }
      } },
    cl_outfit_moonweave: { top: HS(['#8a7cb4', '#b4a8d8', '#d8cff0']), arm: HS(['#8a7cb4', '#b4a8d8', '#d8cff0']), gown: HS(['#8a7cb4', '#b4a8d8', '#d8cff0']), tails: null,
      body: function (S, dir, f, L) {
        var t = L.tt, sp = [[8, t + 2], [11, t + 4], [7, 25], [12, 27], [9, 28], [6, 29]];
        if (dir === 'down') { S.dot(9, t, H('#4a2f7a')); S.dot(10, t, H('#4a2f7a')); S.dot(9, t + 1, H('#e8eeff')); }
        sp.forEach(function (p, i) { if (S.has(p[0], p[1] + (i > 1 ? L.dy : 0))) S.dot(p[0], p[1] + (i > 1 ? L.dy : 0), i % 2 ? H('#c4f0ff') : WHITE); });
      } },
    cl_outfit_ranger: { top: HS(['#1a4434', '#245a40', '#337450']), arm: HS(['#1a4434', '#245a40', '#337450']), tails: HS(['#10302a', '#1a4434', '#245a40']), tailLen: 2, gown: null,
      forearm: 2, foreRamp: HS(['#3e2d2b', '#574039', '#7a5a48']), leg: HS(['#2a2418', '#3e3424', '#574a34']), shoe: HS(['#281d21', '#3e2d2b', '#574039']),
      body: function (S, dir, f, L) {
        var t = L.tt, b = L.tb - 1, belt = H('#3e2d2b'), strap = H('#7a5a48');
        if (dir === 'down') { for (var x = 7; x <= 12; x++) S.dot(x, b, belt); S.dot(9, b, GOLD[2]); for (var k = 0; k < 5; k++) S.dot(12 - k, t + k, strap); S.dot(9, t, H('#c49a70')); }
        else if (dir === 'up') { for (var x2 = 7; x2 <= 12; x2++) S.dot(x2, b, belt); for (var k2 = 0; k2 < 5; k2++) S.dot(7 + k2, t + k2, strap); S.dot(12, t - 1, H('#7a5a48')); S.dot(12, t - 2, H('#c09a74')); }
        else { for (var x3 = 7; x3 <= 12; x3++) S.dot(x3, b, belt); S.dot(8, t, strap); S.dot(7, t + 1, strap); }
      } }
  };
  function dressSprite(spec, lk) {
    if (lk.outfit && OUTFIT_S[lk.outfit]) { var O = OUTFIT_S[lk.outfit]; for (var k in O) if (O.hasOwnProperty(k)) spec[k] = O[k]; }
    if (lk.cloak && CLOAK_S[lk.cloak]) spec.cloak = cloakSprite(CLOAK_S[lk.cloak]);
    if (lk.hat && HAT_S[lk.hat]) spec.hat = hatSprite(HAT_S[lk.hat]);
    return spec;
  }

  // ---------------------------------------------------------------- riding pose: the player seated astride a mount
  // Same 20x32 frame and layering as the walk sprites; the seat point (crotch / saddle contact) is (10, 26).
  var RIDE_INFO = { w: SW, h: SH, ax: 10, ay: 26 };
  var RIDE_LEGS = {
    front: ['.....LLL....RRR.....', '....LLL......RRR....', '....LL........RR....', '....ll........rr....', '...lll........rrr...'],
    side: ['........NNNN........', '.........NNNN.......', '...........NN.......', '...........nn.......', '...........nnn......']
  };
  function drawRideLegs(S, mats) { // thighs around the saddle, shins down the flanks (the far leg is hidden by the mount)
    var rows = RIDE_LEGS[S.side ? 'side' : 'front'], leg = { L: mats.leg, R: mats.leg2, l: mats.shoe, r: mats.shoe2, N: mats.leg, n: mats.shoe };
    for (var r = 0; r < rows.length; r++) for (var i = 0; i < SW; i++) { var id = leg[rows[r].charAt(i)]; if (id !== undefined) S.put(i, 26 + r, id); }
  }
  function drawRideGown(S, L, id) { // long robes drape over the saddle
    if (S.side) [[7, 12], [7, 12], [7, 13], [7, 13], [8, 13], [9, 13]].forEach(function (r, k) { for (var x = r[0]; x <= r[1]; x++) S.put(x, L.tb - 1 + k, id); });
    else for (var y = L.tb - 1; y <= 29; y++) { var t = (y - L.tb + 1) / (30 - L.tb), hw = 3.5 + t * 4.5; for (var x2 = Math.round(9.5 - hw + 0.5); x2 <= Math.round(9.5 + hw - 0.5); x2++) S.put(x2, y, id); }
  }
  function drawRideArms(S, L, mats) { // hands forward on the reins
    var d = S.dir, tt = L.tt;
    if (d === 'down') { armPath(S, [[5, tt], [5, tt + 3], [6, tt + 5]], mats.arm, mats.hand, [7, tt + 5, 2, 2]); armPath(S, [[13, tt], [13, tt + 3], [12, tt + 5]], mats.arm, mats.hand, [11, tt + 5, 2, 2]); }
    else if (d === 'up') { S.rect(5, tt, 2, 4, mats.arm); S.rect(13, tt, 2, 4, mats.arm); S.put(6, tt + 4, mats.arm); S.put(13, tt + 4, mats.arm); }
    else { S.put(15, tt + 4, mats.handFar); armPath(S, [[9, tt + 1], [10, tt + 3], [12, tt + 4]], mats.arm, mats.hand, [13, tt + 4, 2, 2]); }
  }
  function renderRide(sp, dir, f) {
    var S = new Spr(dir), b = sprLayout(sp, 0), u = f ? 1 : 0;
    var L = { by: 0, sh: 0, headY: b.headY + u, dy: u, tt: b.tt + u, tb: b.tb + u, wd: b.wd }; // frame 1: the upper body settles 1px
    var mats = sprMats(S, sp), leg = sprLegend(S, sp, mats, sp.legend ? sp.legend(S, mats) : null);
    S.L = L; S.f = 0; S.mats2 = mats; S.leg = leg; S.sp = sp;
    function T(key) { var t = pickTpl(sp, key, dir); if (t) S.tpl(t[1], t[0] + L.dy, leg); }
    T('back');
    if (sp.cloak && dir !== 'up') sp.cloak.behind(S, dir, 0, L);
    drawRideLegs(S, mats);
    if (sp.gown) drawRideGown(S, L, mats.gown);
    drawTorso(S, sp, 0, L, mats, 'ride');
    if (sp.tails) drawTails(S, sp, 0, L, mats.tails, sp.tailLen);
    if (sp.body) sp.body(S, dir, 0, L, 'ride');
    if (sp.cloak) sp.cloak.front(S, dir, 0, L);
    if (dir === 'up') drawRideArms(S, L, mats);
    drawHead(S, sp, L, mats);
    var snapM = sp.hat ? S.m.slice() : null, snapF = sp.hat ? S.fx.slice() : null;
    T('hair'); T('extra');
    if (sp.head) sp.head(S, dir, 0, L);
    if (sp.hat) { var hairIdx = []; for (var i = 0; i < S.m.length; i++) if (S.m[i] !== snapM[i] || S.fx[i] !== snapF[i]) hairIdx.push(i); sp.hat(S, dir, 0, L, hairIdx, snapM, snapF); }
    if (dir !== 'up') drawRideArms(S, L, mats);
    if (dir === 'up') T('over');
    return S.render();
  }
  function rawPlayerRide(look, dir, frame) { dir = DIRS.indexOf(dir) >= 0 ? dir : 'down'; return toRaw(renderRide(playerSpriteSpec(normLook(look)), dir, frame ? 1 : 0)); }

  /* ================================================================== the cat, Inkwell (16x16) */
  // violet-black fur lit from the top-left (material shading), glowing emerald eyes, violet collar charm
  var CATC = { dark: H('#1b1429'), base: H('#231b38'), light: H('#362a52'), rim: H('#4a3b6d'), glow: H('#5dffb0'), deep: H('#2fbf7f'), core: H('#b4ffd9'), nose: H('#8c3a62'), ear: H('#5a3456'), col: H('#6a47a8'), charm: H('#e4d2ff'), lid: H('#4a3b6d') };
  function catSpr(dir) {
    var S = new Spr(dir, 16, 16), R = [CATC.dark, CATC.base, CATC.light];
    S.k = { H: S.mat('head', R), B: S.mat('body', R), T: S.mat('tail', [CATC.dark, CATC.base, CATC.rim]), N: S.mat('legN', R, { noTop: true }), F: S.mat('legF', [OUT, CATC.dark, CATC.dark], { noTop: true }),
      g: { c: CATC.core }, e: { c: CATC.glow }, E: { c: CATC.deep }, n: { c: CATC.nose }, i: { c: CATC.ear }, C: { c: CATC.col }, c: { c: CATC.charm }, z: { c: CATC.lid } };
    return S;
  }
  function catPath(S, cp, id, thick) { bez(cp).forEach(function (p, i, a) { S.put(p[0], p[1], id); if (thick && i < a.length * thick) S.put(p[0] + 1, p[1], id); }); }
  var CAT_HEAD_FRONT = ['................', '...H........H...', '...HH......HH...', '...HiH....HiH...', '...HHHHHHHHHH...', '..HHHHHHHHHHHH..', '..HHgeHHHHgeHH..', '..HHEeHHHHEeHH..', '...HHHHnnHHHH...', '....HHHHHHHH....', '....CCCcCCCC....'];
  function catIdle(k) {
    var S = catSpr('down');
    catPath(S, k ? [[4, 12], [1, 10], [1, 6], [3, 3]] : [[11, 12], [14, 10], [14, 6], [12, 3]], S.k.T, 0.6);
    S.tpl(['....BBBBBBBB....', '...BBBBBBBBBB...', '...BNNBBBBNNB...', '....NN....NN....'], 11, S.k);
    S.tpl(CAT_HEAD_FRONT, 0, S.k);
    S.dot(7, 11, CATC.charm);
    return S.render();
  }
  function catWalk(f) { // facing right
    var S = catSpr('right'), b = (f === 1 || f === 3) ? 1 : 0;
    var legs = [[[3, 2], [11, 10], [10, 11], [4, 5]], [[3, 3], [11, 11], [10, 10], [4, 4]], [[3, 4], [11, 12], [10, 9], [4, 3]], [[3, 3], [11, 11], [10, 10], [4, 4]]][f];
    // far legs first (dark), then tail, body, head, near legs
    [legs[2], legs[3]].forEach(function (l) { for (var y = 12; y <= 14; y++) S.put(Math.round(l[0] + (l[1] - l[0]) * (y - 12) / 2) + 1, y, S.k.F); });
    var sw = [0, 1, 0, -1][f];
    catPath(S, [[2, 9 + b], [0, 7 + b], [1, 4 + b], [3 + sw, 2 + b]], S.k.T, 0.5);
    S.tpl(['...BBBBBBBB.....', '..BBBBBBBBBBB...', '..BBBBBBBBBBB...', '...BBBBBBBBB....'], 8 + b, S.k);
    S.tpl(['..........H.H...', '..........HiHH..', '.........HHHHHH.', '.........HHgeHHn', '..........HHHHH.', '...........Cc...'], 3 + b, S.k);
    [legs[0], legs[1]].forEach(function (l) { for (var y = 12 + b; y <= 14; y++) S.put(Math.round(l[0] + (l[1] - l[0]) * (y - 12 - b) / Math.max(1, 2 - b)), y, S.k.N); });
    return S.render();
  }
  function catSit() {
    var S = catSpr('down');
    S.tpl(['...BBBBBBBBBB...', '..BBBBBBBBBBBB..', '..BBBBNBBNBBBB..', '..BBBBNNBNNBBB..'], 11, S.k);
    catPath(S, [[13, 11], [14, 13], [12, 14], [9, 14]], S.k.T, 0);
    S.tpl(CAT_HEAD_FRONT, 0, S.k);
    S.dot(7, 11, CATC.charm);
    return S.render();
  }
  function catSleep(k) {
    var S = catSpr('down'), u = k ? 1 : 0;
    S.tpl(['....BBBBBB......', '..BBBBBBBBB.....', '.BBBBBBBBBB.....', '.BBBBBBBBBBB....', '.BBBBBBBBBBBBB..', '..BBBBBBBBBBB...'], 9 - u, S.k);
    if (k) S.tpl(['..BBBBBBBBBB....'], 14, S.k);
    S.tpl(['...H.H..', '...HiHH.', '..HHHHHH', '..HzzHHH', '...HHHH.'], 8, S.k, 8);
    catPath(S, [[1, 12], [3, 14], [8, 14], [11, 13]], S.k.T, 0);
    return S.render();
  }
  function catRim(B) { // brighten the top-left silhouette edge of the lit fur (palette #4a3b6d)
    var src = B.c.slice();
    for (var y = 0; y < B.h; y++) for (var x = 0; x < B.w; x++) {
      if (src[y * B.w + x] !== CATC.light) continue;
      var up = y > 0 ? src[(y - 1) * B.w + x] : -1, lf = x > 0 ? src[y * B.w + x - 1] : -1;
      if (up === OUT || up < 0 || lf === OUT || lf < 0) B.c[y * B.w + x] = CATC.rim;
    }
    return B;
  }
  function rawCat() {
    var right = [0, 1, 2, 3].map(catWalk).map(catRim);
    var left = [0, 1, 2, 3].map(function (f) { return catRim(catWalk(f).flipX()); });
    return { w: 16, h: 16, ax: 8, ay: 15, idle: [catRim(catIdle(0)), catRim(catIdle(1))], walk: { right: right, left: left }, sit: [catRim(catSit())], sleep: [catRim(catSleep(0)), catRim(catSleep(1))] };
  }
  function catRaw() { var c = rawCat(); return { w: 16, h: 16, ax: 8, ay: 15, idle: c.idle.map(toRaw), walk: { left: c.walk.left.map(toRaw), right: c.walk.right.map(toRaw) }, sit: c.sit.map(toRaw), sleep: c.sleep.map(toRaw) }; }

  /* ================================================================== API */
  var NPC_IDS = ['mirabel', 'pip', 'sable', 'brann', 'orvyn', 'elowen', 'grizelda', 'corvin', 'lune', 'elvis', 'isolde', 'seraphine', 'fennick',
    'laura', 'jasmine', 'amara', 'ronan', 'caspian', 'gideon', 'nightmerchant'];
  // look variants: laura/jasmine/amara each have 'a' and 'b' designs (defs stored as id_a / id_b)
  var VARIANTS = { laura: ['a', 'b'], jasmine: ['a', 'b'], amara: ['a', 'b'] }, curVariant = {};
  function pickVariant(id, v) { var vs = VARIANTS.hasOwnProperty(id) ? VARIANTS[id] : null; if (!vs) return ''; if (v == null) v = curVariant[id]; return vs.indexOf(v) >= 0 ? v : vs[0]; }
  function resolveDef(table, id, v) {
    if (typeof id !== 'string') return table._villager;
    if (VARIANTS.hasOwnProperty(id)) return table[id + '_' + pickVariant(id, v)];
    return table.hasOwnProperty(id) && id.charAt(0) !== '_' ? table[id] : table._villager;
  }
  function toRaw(B) { return { w: B.w, h: B.h, data: B.rgba() }; }
  function rawPortrait(id, expr, opts, v) { return toRaw(renderPortrait(resolveDef(NPC, id, v), expr, opts)); }

  var cache = {};
  function toCanvas(raw) {
    var cv = document.createElement('canvas'); cv.width = raw.w; cv.height = raw.h;
    var g = cv.getContext('2d'), img = g.createImageData(raw.w, raw.h); img.data.set(raw.data); g.putImageData(img, 0, 0);
    return cv;
  }
  function lookKey(lk) { return [lk.skin, lk.hair, lk.hairColor, lk.robe, lk.eyes, lk.hat || "", lk.cloak || "", lk.outfit || ""].join(","); }
  function cached(key, make) { if (!cache[key]) cache[key] = make(); return cache[key]; }

  var API = {
    npcIds: NPC_IDS.slice(),
    portrait: function (id, expr, opts) { return API.portraitVariant(id, null, expr, opts); },
    portraitVariant: function (id, v, expr, opts) {
      opts = opts || {}; expr = normExpr(expr); var vv = pickVariant(id, v);
      var key = 'p|' + id + '|' + vv + '|' + expr + '|' + (opts.blink ? 1 : 0) + (opts.talk ? 1 : 0);
      return cached(key, function () { var r = rawPortrait(id, expr, opts, vv || undefined); return HAS_DOM ? toCanvas(r) : r; });
    },
    playerPortrait: function (look, expr, opts) {
      opts = opts || {}; expr = normExpr(expr); var lk = normLook(look);
      var key = "pp|" + lookKey(lk) + "|" + expr + "|" + (opts.blink ? 1 : 0) + (opts.talk ? 1 : 0);
      return cached(key, function () { var r = rawPlayerPortrait(lk, expr, opts); return HAS_DOM ? toCanvas(r) : r; });
    },
    npcSprites: function (id) { return API.npcSpritesVariant(id, null); },
    npcSpritesVariant: function (id, v) {
      var vv = pickVariant(id, v), key = "ns|" + id + "|" + vv;
      return cached(key, function () { var r = rawNpcSprites(id, vv || undefined); return HAS_DOM ? mapSet(r, toCanvas) : r; });
    },
    variants: { laura: ['a', 'b'], jasmine: ['a', 'b'], amara: ['a', 'b'] },
    setVariant: function (id, v) { if (VARIANTS.hasOwnProperty(id) && VARIANTS[id].indexOf(v) >= 0) curVariant[id] = v; return VARIANTS.hasOwnProperty(id) ? pickVariant(id) : null; },
    getVariant: function (id) { return VARIANTS.hasOwnProperty(id) ? pickVariant(id) : null; },
    playerRide: function (look, dir, frame) {
      var lk = normLook(look); dir = DIRS.indexOf(dir) >= 0 ? dir : 'down'; frame = frame ? 1 : 0;
      var key = "pr|" + lookKey(lk) + "|" + dir + "|" + frame;
      return cached(key, function () { var r = rawPlayerRide(lk, dir, frame); return HAS_DOM ? toCanvas(r) : r; });
    },
    rideInfo: { w: RIDE_INFO.w, h: RIDE_INFO.h, ax: RIDE_INFO.ax, ay: RIDE_INFO.ay },
    playerSprites: function (look) {
      var lk = normLook(look), key = "ps|" + lookKey(lk);
      return cached(key, function () { var r = rawPlayerSprites(lk); return HAS_DOM ? mapSet(r, toCanvas) : r; });
    },
    catSprites: function () {
      return cached("cat", function () {
        var r = catRaw(); if (!HAS_DOM) return r;
        return { w: r.w, h: r.h, ax: r.ax, ay: r.ay, idle: r.idle.map(toCanvas), walk: { left: r.walk.left.map(toCanvas), right: r.walk.right.map(toCanvas) }, sit: r.sit.map(toCanvas), sleep: r.sleep.map(toCanvas) };
      });
    },
    portraitStyled: function (style, id, v, expr, opts) {
      style = PSTYLES.hasOwnProperty(style) ? style : 'valley'; opts = opts || {}; expr = normExpr(expr); var vv = pickVariant(id, v);
      var key = "pst|" + style + "|" + id + "|" + vv + "|" + expr + "|" + (opts.blink ? 1 : 0) + (opts.talk ? 1 : 0);
      return cached(key, function () { var r = rawPortraitStyled(style, id, vv || undefined, expr, opts); return HAS_DOM ? toCanvas(r) : r; });
    },
    playerPortraitStyled: function (style, look, expr, opts) {
      style = PSTYLES.hasOwnProperty(style) ? style : 'valley'; opts = opts || {}; expr = normExpr(expr); var lk = normLook(look);
      var key = "ppst|" + style + "|" + lookKey(lk) + "|" + expr + "|" + (opts.blink ? 1 : 0) + (opts.talk ? 1 : 0);
      return cached(key, function () { var r = rawPlayerPortraitStyled(style, lk, expr, opts); return HAS_DOM ? toCanvas(r) : r; });
    },
    portraitStyles: ['valley', 'sweet', 'soft', 'close', 'close_sweet', 'human', 'human_hd'],
    looks: LOOKS,
    clothes: CLOTHES.map(function (c) { return { id: c.id, slot: c.slot, name: c.name }; }),
    _raw: { portrait: rawPortrait, playerPortrait: rawPlayerPortrait, npcSprites: rawNpcSprites, playerSprites: rawPlayerSprites, playerRide: rawPlayerRide, portraitStyled: rawPortraitStyled, playerPortraitStyled: rawPlayerPortraitStyled, catSprites: catRaw }
  };
  ROOT.CharArt = API;
})();
