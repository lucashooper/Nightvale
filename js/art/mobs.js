// Nightvale — MobArt: procedural monster, projectile and combat-effect pixel art.
// Everything is drawn pixel-by-pixel into tiny RGBA buffers (true 1x pixel art, no AA),
// converted to cached <canvas> in the browser. Deterministic (seeded hash, never Math.random).
// Monsters face RIGHT in their base frames; flipped versions are mirrored + cached on request.
// API: types / info(type) / frame(type, variant, anim, i, flip)          — monsters (idle, move, attack, hurt, die; deep_wyrm adds burrow, emerge)
//      fxList / fxInfo(name) / fx(name, i)                              — projectiles & combat/spell effects
//      critters / critterInfo(type) / critter(type, anim, i, flip)      — glade animals (sleep, idle, move?)
//      familiars / familiarInfo(type) / familiar(type, anim, i, flip)   — pets that follow the player
//      pets / petInfo(type) / pet(type, anim, i, flip)                  — collectible pets (idle, walk, sleep; hatchling adds flutter)
//      mounts / mountInfo(type) / mount(type, anim, dir, i)             — rideable mounts, dir down/up/left/right -> { back, front|null }:
//                                                                         draw back, then the rider at seat (+ seatDy[anim][i]), then front
//      _raw.{frame, fx, critter, familiar, pet, mount}                  — same, returning {w, h, data} (node testing)
// Draw at (worldX - ax, worldY - ay). Bad args never throw: they fall back to the first variant / a base anim / frame 0.
(function () {
  'use strict';
  var ROOT = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);

  // ======================================================================= colour
  var OL = '#120c1c';
  var HC = {};
  function rgba(c) {
    if (typeof c !== 'string') return c;
    var v = HC[c];
    if (v) return v;
    var n = parseInt(c.slice(1, 7), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255, c.length > 7 ? parseInt(c.slice(7, 9), 16) : 255];
    HC[c] = v;
    return v;
  }
  function hx2(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
  function mix(a, b, t) {
    a = rgba(a); b = rgba(b);
    return '#' + hx2(a[0] + (b[0] - a[0]) * t) + hx2(a[1] + (b[1] - a[1]) * t) + hx2(a[2] + (b[2] - a[2]) * t);
  }

  // ======================================================================= raster toolkit
  function mk(w, h) { return { w: w, h: h, data: new Uint8ClampedArray(w * h * 4) }; }
  function clone(b) { var n = mk(b.w, b.h); n.data.set(b.data); return n; }
  function A(b, x, y) { return (x < 0 || y < 0 || x >= b.w || y >= b.h) ? 0 : b.data[(y * b.w + x) * 4 + 3]; }
  function px(b, x, y, c, al) {
    x = Math.floor(x); y = Math.floor(y);
    if (c == null || x < 0 || y < 0 || x >= b.w || y >= b.h) return;
    var k = rgba(c), d = b.data, i = (y * b.w + x) * 4;
    var a = (k[3] / 255) * (al == null ? 1 : al);
    if (a >= 0.999) { d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255; return; }
    if (a <= 0.004) return;
    var da = d[i + 3] / 255, oa = a + da * (1 - a);
    d[i] = (k[0] * a + d[i] * da * (1 - a)) / oa;
    d[i + 1] = (k[1] * a + d[i + 1] * da * (1 - a)) / oa;
    d[i + 2] = (k[2] * a + d[i + 2] * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }
  // px that keeps a margin from the frame border (so the 1px outline always fits)
  function pxIn(b, x, y, c, m) {
    m = m == null ? 1 : m; x = Math.floor(x); y = Math.floor(y);
    if (x < m || y < m || x > b.w - 1 - m || y > b.h - 1 - m) return;
    px(b, x, y, c);
  }
  function clr(b, x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= b.w || y >= b.h) return;
    var i = (y * b.w + x) * 4; b.data[i] = b.data[i + 1] = b.data[i + 2] = b.data[i + 3] = 0;
  }
  function rect(b, x, y, w, h, c, al) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) px(b, x + i, y + j, c, al); }
  function line(b, x0, y0, x1, y1, c, al) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy;
    for (var n = 0; n < 256; n++) {
      px(b, x0, y0, c, al);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  // polyline through [x,y,x,y,...]
  function pline(b, pts, c, al) { for (var i = 0; i + 3 < pts.length; i += 2) line(b, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c, al); }
  function inE(x, y, cx, cy, rx, ry) { var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1; }
  function ell(b, cx, cy, rx, ry, c, al) {
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++)
        if (inE(x, y, cx, cy, rx, ry)) px(b, x, y, c, al);
  }
  function ringE(b, cx, cy, rx, ry, c, al) {
    for (var y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (var x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++)
        if (inE(x, y, cx, cy, rx, ry) && (!inE(x - 1, y, cx, cy, rx, ry) || !inE(x + 1, y, cx, cy, rx, ry) ||
            !inE(x, y - 1, cx, cy, rx, ry) || !inE(x, y + 1, cx, cy, rx, ry))) px(b, x, y, c, al);
  }
  // ASCII sprite: rows of chars, pal maps char -> colour ('.'/' ' transparent, null = erase)
  function spr(b, rows, pal, ox, oy, flip, al) {
    var W = 0, y, x;
    for (y = 0; y < rows.length; y++) if (rows[y].length > W) W = rows[y].length;
    for (y = 0; y < rows.length; y++) {
      var r = rows[y];
      for (x = 0; x < r.length; x++) {
        var ch = r.charAt(x);
        if (ch === '.' || ch === ' ') continue;
        var c = pal[ch];
        if (c === undefined) continue;
        var X = flip ? ox + W - 1 - x : ox + x;
        if (c === null) clr(b, X, oy + y); else px(b, X, oy + y, c, al);
      }
    }
  }
  function blit(dst, src, ox, oy, flip, al) {
    var s = src.data;
    for (var y = 0; y < src.h; y++) for (var x = 0; x < src.w; x++) {
      var i = (y * src.w + x) * 4;
      if (!s[i + 3]) continue;
      px(dst, flip ? ox + src.w - 1 - x : ox + x, oy + y, [s[i], s[i + 1], s[i + 2], s[i + 3]], al);
    }
  }
  function flipX(b) {
    var n = mk(b.w, b.h), s = b.data, d = n.data;
    for (var y = 0; y < b.h; y++) for (var x = 0; x < b.w; x++) {
      var i = (y * b.w + x) * 4, j = (y * b.w + (b.w - 1 - x)) * 4;
      d[j] = s[i]; d[j + 1] = s[i + 1]; d[j + 2] = s[i + 2]; d[j + 3] = s[i + 3];
    }
    return n;
  }
  // 1px outline on fully transparent pixels touching solid (alpha >= thr) pixels.
  function outline(b, c, diag, thr) {
    thr = thr == null ? 128 : thr;
    var w = b.w, h = b.h, d = b.data, solid = new Uint8Array(w * h), x, y;
    for (var i = 0; i < w * h; i++) solid[i] = d[i * 4 + 3] >= thr ? 1 : 0;
    function S(x, y) { return x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x]; }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3]) continue;
      if (S(x - 1, y) || S(x + 1, y) || S(x, y - 1) || S(x, y + 1) ||
          (diag && (S(x - 1, y - 1) || S(x + 1, y - 1) || S(x - 1, y + 1) || S(x + 1, y + 1)))) px(b, x, y, c);
    }
    return b;
  }
  // composite a same-size layer; its contour is drawn in `oc` where it overlaps existing pixels
  function over(dst, src, oc) {
    if (oc) {
      var w = src.w, h = src.h, s = src.data, d = dst.data;
      var sol = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && s[(y * w + x) * 4 + 3] >= 128; };
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        if (s[i + 3] || !d[i + 3]) continue;
        if (sol(x - 1, y) || sol(x + 1, y) || sol(x, y - 1) || sol(x, y + 1)) px(dst, x, y, oc);
      }
    }
    blit(dst, src, 0, 0);
    return dst;
  }
  function eachPx(b, fn) {
    var d = b.data;
    for (var y = 0; y < b.h; y++) for (var x = 0; x < b.w; x++) {
      var i = (y * b.w + x) * 4;
      if (d[i + 3]) fn(x, y, d[i], d[i + 1], d[i + 2], d[i + 3], i);
    }
  }
  // hurt flash: pale/white version that keeps outline + darkest details readable
  var PALE = ['#9fb0d8', '#c8d4f0', '#e8eeff', '#ffffff'];
  function flash(b) {
    var n = clone(b), d = n.data, o = rgba(OL);
    eachPx(n, function (x, y, r, g, bl, a, i) {
      if (r === o[0] && g === o[1] && bl === o[2]) return;
      var l = 0.299 * r + 0.587 * g + 0.114 * bl;
      var k = rgba(PALE[l < 45 ? 0 : l < 95 ? 1 : l < 150 ? 2 : 3]);
      d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2];
    });
    return n;
  }
  function fade(b, f) { var d = b.data; for (var i = 3; i < d.length; i += 4) d[i] = d[i] * f; return b; }
  function shift(b, dx, dy) { var n = mk(b.w, b.h); blit(n, b, dx, dy); return n; }

  // deterministic hash -> [0,1)
  function hash(x, y, s) {
    var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ======================================================================= shared palette
  var WOOD = ['#281d21', '#3e2d2b', '#574039', '#7a5a48', '#9c7a5e'];
  var AMBER = '#ffbc62', CANDLE = '#fff1c8', ORANGE = '#e8843c';
  var SMOKE = ['#24183c', '#433068', '#614a94', '#8a70c0', '#bba4ea'];

  // cauliflower smoke cloud: blobs [[x, y, r], ...]; lower blobs overlap upper ones; lit from top-left
  function cloud(b, blobs, pal, al, oc) {
    pal = pal || SMOKE;
    var lay = mk(b.w, b.h);
    var order = blobs.slice().sort(function (p, q) { return p[1] - q[1]; });
    for (var i = 0; i < order.length; i++) {
      var B = order[i], r = B[2];
      if (r < 0.5) continue;
      var L = mk(b.w, b.h);
      for (var y = Math.floor(B[1] - r - 1); y <= B[1] + r + 1; y++)
        for (var x = Math.floor(B[0] - r - 1); x <= B[0] + r + 1; x++) {
          if (!inE(x, y, B[0], B[1], r, r)) continue;
          var nx = (x + 0.5 - B[0]) / r, ny = (y + 0.5 - B[1]) / r;
          if (B[3] && nx * nx + ny * ny < B[3]) continue;
          var l = -0.5 * nx - 0.85 * ny;
          px(L, x, y, pal[l > 0.62 ? 4 : l > 0.08 ? 3 : l > -0.45 ? 2 : 1]);
        }
      over(lay, L, pal[1]);
    }
    if (oc !== false) outline(lay, oc || pal[0]);
    blit(b, lay, 0, 0, false, al == null ? 1 : al);
  }
  // soft ground shadow that only fills empty pixels
  function shadowE(b, cx, cy, rx, ry, al) {
    for (var y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++)
        if (inE(x, y, cx, cy, rx, ry) && !A(b, x, y)) px(b, x, y, OL, al);
  }
  // violet death puff, 16x16, 5 frames (also reused inside die animations)
  var PUFF_BLOBS = [
    [[8, 9.6, 2.7], [5.6, 11.2, 2.1], [10.5, 11.3, 2.2]],
    [[8, 7.2, 2.9], [4.9, 9.4, 2.5], [11.3, 9.6, 2.6], [6.8, 11.9, 2.4], [10, 12, 2.3]],
    [[7.6, 5, 2.6], [3.9, 7.9, 2.5], [12.1, 7.6, 2.5], [8.7, 8.6, 2.3], [5.5, 11.4, 2.3], [10.7, 11.3, 2.2]],
    [[7.4, 3.6, 1.9], [3.1, 6.6, 1.8], [12.8, 6.2, 1.8], [5, 10.4, 1.5], [11, 10.2, 1.5]],
    [[7.4, 2.3, 1.1], [2.6, 5, 1], [13.3, 4.7, 1], [4.6, 9, 0.8], [11.4, 8.8, 0.8]]
  ];
  var PUFF_ALPHA = [1, 1, 0.95, 0.8, 0.55];
  function deathPuff(i, pal, spk) {
    var b = mk(16, 16);
    spk = spk || ['#ffffff', '#e4d2ff', '#b99aee', '#8f6cd1'];
    cloud(b, PUFF_BLOBS[i], pal || SMOKE, PUFF_ALPHA[i]);
    if (i === 0) { px(b, 8, 5, spk[0]); px(b, 3, 8, spk[1]); px(b, 13, 8, spk[1]); px(b, 8, 4, spk[2]); }
    if (i === 1) { px(b, 1, 6, spk[1]); px(b, 14, 4, spk[2]); px(b, 8, 2, spk[0]); }
    if (i === 2) { px(b, 1, 4, spk[2]); px(b, 14, 3, spk[3]); }
    return b;
  }
  // sage-green smoke with drifting leaves, for natural forest creatures
  var LEAFY = ['#1a2420', '#3a4840', '#5e6e64', '#8a9a8e', '#bccabe'];
  function leafPuff(i) {
    var b = deathPuff(i, LEAFY, ['#eaf6c8', '#c8e0a0', '#9ac070', '#74b46e']);
    var lv = [[[3, 6], [12, 5]], [[2, 9], [13, 7], [7, 2]], [[1, 12], [14, 10], [8, 4]], [[2, 14], [13, 13]], [[3, 14]]][i];
    for (var k = 0; k < lv.length; k++) { px(b, lv[k][0], lv[k][1], k % 2 ? '#d8883e' : '#74b46e'); px(b, lv[k][0] + 1, lv[k][1], k % 2 ? '#a85a2e' : '#337450'); }
    return b;
  }

  // ======================================================================= registry
  var TYPES = Object.create(null), TYPE_IDS = [];
  function defType(id, def) { TYPES[id] = def; TYPE_IDS.push(id); }
  var FX = Object.create(null), FX_IDS = [];
  function defFx(id, def) { FX[id] = def; FX_IDS.push(id); }

  // ======================================================================= SLIME (16x16)
  var SLIME = {
    moss: { r: ['#0f3330', '#1b5a4b', '#28876a', '#47b587', '#8fe3b5'], spec: '#eafff4',
      face: { D: OL, W: '#ffffff', M: OL, F: '#ffffff' },
      leaf: ['#1a4434', '#337450', '#74b46e', '#a8d878'], bits: ['#74b46e', '#a8d878', '#2b6b48'] },
    amethyst: { r: ['#2a1a4c', '#4a2f7a', '#6a47a8', '#8f6cd1', '#b99aee'], spec: '#f4ecff',
      face: { D: OL, W: '#ffffff', M: OL, F: '#ffffff' },
      cry: ['#5a3a92', '#b99aee', '#e4d2ff', '#ffffff'] },
    void: { r: ['#07040d', '#0e0919', '#160f26', '#211736', '#2e2149'], spec: '#b99aee',
      face: { D: '#cfb6ff', W: '#ffffff', M: '#6a47a8', F: '#e4d2ff' },
      rim: ['#3a2766', '#6a47a8', '#8f6cd1'] },
    ember: { r: ['#521522', '#8f2c2a', '#c44a3a', '#e8843c', '#ffbc62'], spec: '#fff1c8',
      face: { D: '#2a0a12', W: '#fff1c8', M: '#2a0a12', F: '#fff1c8' },
      core: ['#ffbc62', '#fff1c8'] }
  };
  var SFACE = {
    n: { o: 0, r: ['WD.WD', 'DD.DD', '.....', '.MMM.', '...F.'] },
    s: { o: 0, r: ['DD.DD', '.....', '.MMM.'] },
    a: { o: 1, r: ['.D.D.', 'WD.DW', 'DD.DD', '.....', '.MMM.', '.F.F.'] },
    b: { o: 1, r: ['.D.D.', 'WD.DW', 'DD.DD', '.....', 'MFMFM', '.MMM.'] },
    h: { o: 0, r: ['D...D', '.D.D.', 'D...D', '.....', '..M..'] },
    d: { o: 0, r: ['D.D.D.D', '.D...D.', 'D.D.D.D'], dx: -1 },
    x: { o: 0, r: ['DD.DD'] }
  };
  var SLIME_POSE = {
    idle: [{ w: 12, h: 9 }, { w: 13, h: 8 }],
    move: [{ w: 14, h: 7, face: 's' }, { w: 10, h: 10, lift: 1, lean: 1 }, { w: 12, h: 8, lift: 2 }, { w: 11, h: 9, lift: 1, lean: -0.5 }],
    attack: [{ w: 12, h: 9, dx: -0.5, lean: -1.5, face: 'a' }, { w: 13, h: 8, dx: 0, lean: 1.5, face: 'b' }],
    hurt: [{ w: 13, h: 8, dx: -0.5, face: 'h' }],
    die: [{ w: 14, h: 6, face: 'd' }, { w: 14, h: 3, face: 'x' }, { w: 12, h: 2, face: '-' }, null]
  };
  function slimeBody(v, P, st, seed) {
    var b = mk(16, 16);
    var w = st.w, h = st.h, lift = st.lift || 0, lean = st.lean || 0, cx0 = 8 + (st.dx || 0);
    var bottom = 14 - lift, top = bottom - h + 1;
    var ecy = top + h * 0.6, rx = w / 2, ryT = h * 0.6, ryB = h * 0.4 + 1.4;
    function ccx(y) { return cx0 + lean * (bottom - y) / Math.max(1, h); }
    function nrm(x, y) {
      var dx = (x + 0.5 - ccx(y)) / rx, yy = y + 0.5 - ecy;
      return [dx, yy / (yy < 0 ? ryT : ryB)];
    }
    function inside(x, y) { if (y < top || y > bottom) return false; var n = nrm(x, y); return n[0] * n[0] + n[1] * n[1] <= 1; }
    var x, y, R = P.r;
    for (y = top; y <= bottom; y++) for (x = 0; x < 16; x++) {
      if (!inside(x, y)) continue;
      var n = nrm(x, y), l = -0.62 * n[0] - 0.78 * n[1];
      var k = l > 0.42 ? 3 : l > -0.28 ? 2 : l > -0.72 ? 1 : 0;
      var eR = !inside(x + 1, y), eB = !inside(x, y + 1), eL = !inside(x - 1, y), eT = !inside(x, y - 1);
      if (eB || (eR && n[1] > -0.2)) k = Math.min(k, 1);
      if (y === bottom && (eR || n[0] > 0.3)) k = 0;
      if ((eT || eL) && l > 0.05) k = Math.max(k, 3);
      if (y === bottom - 1 && n[0] < 0.25 && n[0] > -0.75 && k < 2) k = 2; // bounce light: translucent jelly
      var col = R[k];
      if (v === 'ember') {
        var gx = (x + 0.5 - ccx(y) + 0.5) / (rx * 0.62), gy = (y + 0.5 - (top + h * 0.64)) / (h * 0.4);
        var g = gx * gx + gy * gy + (hash(x, y, seed) - 0.5) * 0.3;
        if (g < 0.3) col = P.core[1]; else if (g < 0.75 && k < 4) col = R[Math.max(k, 3)];
      }
      if (v === 'void') {
        var edge = eR || eB || eL || eT;
        if (edge && l > 0.35) col = P.rim[l > 0.85 ? 2 : 1];
        else if (edge && l > -0.25) col = P.rim[0];
      }
      px(b, x, y, col);
    }
    // specular highlight (top-left)
    if (h >= 4) {
      var sx = Math.round(ccx(top + 2) - rx * 0.5), sy = top + (h > 7 ? 2 : 1);
      if (inside(sx, sy)) px(b, sx, sy, P.spec);
      if (inside(sx + 1, sy - 1) && h > 6) px(b, sx + 1, sy - 1, v === 'void' ? P.rim[2] : R[4]);
      if (inside(sx, sy + 1) && h > 8 && v !== 'void') px(b, sx, sy + 1, R[4]);
    }
    return { b: b, top: top, bottom: bottom, inside: inside, ccx: ccx, rx: rx, h: h, w: w, lift: lift };
  }
  function slimeFace(b, P, S, kind) {
    if (!SFACE[kind] || S.h < 2) return;
    var F = SFACE[kind], rows = F.r.slice();
    var fy = S.top + Math.max(1, Math.round(S.h * 0.3)) + (S.h <= 3 ? -1 : 0);
    var fx = Math.floor(S.ccx(fy) - 1) + (F.dx || 0);
    var y0 = fy - F.o;
    while (rows.length > F.o + 1 && y0 + rows.length - 1 > S.bottom - 1) rows.pop();
    spr(b, rows, P.face, fx, y0);
  }
  function drawSlime(v, anim, i) {
    var P = SLIME[v];
    var st = SLIME_POSE[anim][i];
    if (!st) return deathPuff(3);
    var S = slimeBody(v, P, st, i + (anim === 'move' ? 5 : 0));
    var b = S.b, k, qx, qy;
    var tall = S.h >= 6;
    // inner details
    if (v === 'moss' && tall) {
      var bits = [[-4, 0.66], [-1, 0.88]];
      for (k = 0; k < bits.length; k++) {
        qx = Math.round(S.ccx(S.top) + bits[k][0]); qy = Math.round(S.top + S.h * bits[k][1]);
        if (!S.inside(qx, qy + 1) || !S.inside(qx + 1, qy - 1)) continue;
        if (k === 0) { px(b, qx, qy, P.bits[0]); px(b, qx + 1, qy - 1, P.bits[2]); } else px(b, qx, qy, P.bits[1]);
      }
    }
    if (v === 'amethyst' && tall) {
      var cs = [[-4, 0.82], [0, 0.95], [-2, 0.5]];
      for (k = 0; k < cs.length; k++) {
        qx = Math.round(S.ccx(S.top) + cs[k][0]); qy = Math.round(S.top + S.h * cs[k][1]) - 1;
        if (!S.inside(qx, qy + 1) || !S.inside(qx + 1, qy)) continue;
        if (k === 2) { px(b, qx, qy, P.cry[2]); px(b, qx + 1, qy, P.cry[1]); continue; }
        px(b, qx, qy - 2, P.cry[2]); px(b, qx, qy - 1, P.cry[3]); px(b, qx + 1, qy - 1, P.cry[1]);
        px(b, qx, qy, P.cry[1]); px(b, qx + 1, qy, P.cry[0]);
      }
    }
    if (v === 'void' && S.h >= 3) {
      var inner = function (x, y) { return S.inside(x - 1, y) && S.inside(x + 1, y) && S.inside(x, y - 1) && S.inside(x, y + 1); };
      var fyy = S.top + Math.max(1, Math.round(S.h * 0.3)), fxx = Math.floor(S.ccx(fyy) - 1);
      var cand = [[-4, 0.68], [-1, 0.9], [-5, 0.42], [2, 0.95], [-2, 0.25], [3, 0.8]], placed = 0;
      for (k = 0; k < cand.length && placed < 3; k++) {
        qx = Math.round(S.ccx(S.top) + cand[k][0]); qy = Math.round(S.top + (S.h - 1) * cand[k][1]);
        if (!inner(qx, qy) || (qx >= fxx - 1 && qx <= fxx + 5 && qy >= fyy - 1 && qy <= fyy + 4)) continue;
        var tw = (k + i + (anim === 'move' ? 1 : 0)) % 3;
        px(b, qx, qy, tw === 0 ? '#ffffff' : tw === 1 ? '#c8d4f0' : '#8f6cd1');
        placed++;
      }
      // extra watching eyes
      if (tall && st.face !== 'd' && st.face !== 'h') {
        var ex = Math.round(S.ccx(S.top + 3) - S.rx * 0.6), ey = S.top + 2;
        if (inner(ex, ey) && inner(ex, ey + 1)) { px(b, ex, ey, '#ffffff'); px(b, ex, ey + 1, '#b99aee'); }
        var e2x = Math.round(S.ccx(S.top + 1) - 1.5), e2y = S.top + 1;
        if (S.inside(e2x, e2y) && S.inside(e2x - 1, e2y) && S.inside(e2x + 1, e2y)) px(b, e2x, e2y, '#e4d2ff');
        var e3x = Math.round(S.ccx(S.bottom - 2) - S.rx * 0.4), e3y = S.bottom - 2;
        if (S.h >= 8 && inner(e3x, e3y) && inner(e3x + 1, e3y)) { px(b, e3x, e3y, '#e4d2ff'); px(b, e3x + 1, e3y, '#8f6cd1'); }
      }
    }
    slimeFace(b, P, S, st.face || 'n');
    // decorations on top
    var tx = Math.round(S.ccx(S.top) - 1), ty = S.top;
    var sway = anim === 'move' ? (i === 1 ? -1 : i === 3 ? 1 : 0) : anim === 'attack' ? (i === 0 ? 1 : -1) : (i === 1 ? 1 : 0);
    if (v === 'moss' && S.h >= 3) {
      if (S.h >= 6) { // little Y-shaped sprout with two leaves
        px(b, tx, ty - 1, P.leaf[1]); px(b, tx + sway, ty - 2, P.leaf[1]);
        px(b, tx - 1 + sway, ty - 2, P.leaf[2]); px(b, tx - 2 + sway, ty - 3, P.leaf[2]); px(b, tx - 1 + sway, ty - 3, P.leaf[1]);
        px(b, tx + 1 + sway, ty - 2, P.leaf[2]); px(b, tx + 2 + sway, ty - 3, P.leaf[3]); px(b, tx + 1 + sway, ty - 3, P.leaf[2]);
      } else {
        px(b, tx, ty - 1, P.leaf[1]); px(b, tx - 1, ty - 1, P.leaf[2]); px(b, tx + 1, ty - 2, P.leaf[2]);
      }
    }
    if (v === 'amethyst' && S.h >= 3) {
      var cl = S.h >= 6 ? ['.W..', '.LW.', 'DLLD'] : ['.W.', 'DLD'];
      if (S.top - cl.length < 1) cl = cl.slice(1);
      spr(b, cl, { W: P.cry[2], L: P.cry[1], D: P.cry[0] }, tx - 2 - (sway > 0 ? 0 : 0), ty - cl.length + 1);
    }
    if (v === 'ember' && S.h >= 3) {
      var fl = (i + (anim === 'move' ? 1 : 0)) % 2;
      var fm = S.h >= 6 ? (fl ? ['.C..', '.AC.', 'AOA.'] : ['..C.', '.CA.', '.AOA']) : ['.C.', 'AOA'];
      spr(b, fm, { C: CANDLE, A: AMBER, O: ORANGE }, tx - 1, ty - fm.length + 1);
    }
    if (anim === 'die' && i === 2) { // jelly droplets splash out of the puddle
      var dr = [[3, 10], [5, 8], [11, 9], [13, 11], [8, 7]];
      for (var dd = 0; dd < dr.length; dd++) { px(b, dr[dd][0], dr[dd][1], P.r[dd % 2 ? 3 : 2]); if (dd < 2) px(b, dr[dd][0], dr[dd][1] + 1, P.r[1]); }
    }
    outline(b, OL);
    if (anim === 'die' && i === 2) blit(b, deathPuff(0), 0, -1, false, 0.9);
    if (S.lift) shadowE(b, S.ccx(S.bottom) - 0.5, 15, Math.max(2.5, S.w * 0.36 - S.lift * 0.4), 0.9, 0.5);
    if (v === 'ember' && S.h >= 4) { // drifting sparks
      var sp = (i * 3 + (anim === 'move' ? 2 : 0)) % 5;
      if (S.top - 4 >= 0) px(b, tx - 3 + sp, S.top - 4, AMBER);
      if (S.top - 6 + (sp % 2) >= 0) px(b, tx + 4 - sp % 3, S.top - 6 + (sp % 2), '#ffde9a');
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('slime', {
    w: 16, h: 16, ax: 8, ay: 15,
    anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 },
    variants: ['moss', 'amethyst', 'void', 'ember'],
    fps: { idle: 3, move: 8, attack: 7, die: 8 },
    draw: drawSlime
  });

  // ======================================================================= BAT (16x16, flying; engine draws the `shadow` fx)
  var BAT = {
    gloom: { k: '#2f2448', n: '#c4648e', m: '#54457a', l: '#7464a0', h: '#9686c4', d: '#2f2448', w: '#3a2766', W: '#56399a', b: '#9a7ad8',
      E: '#7dffc4', f: '#ffffff', o: '#120c1c', x: '#1b1429', i: '#9a7ad8' },
    frost: { k: '#3f6aae', n: '#e8f4ff', m: '#7fb0e2', l: '#b4d6f4', h: '#eef7ff', d: '#46689e', w: '#213479', W: '#33569c', b: '#d6efff',
      E: '#17224c', f: '#ffffff', o: '#120c1c', x: '#17224c', i: '#e8f8ff' }
  };
  var BAT_BODY = [
    '.k...k.',
    '.kn.nk.',
    '.mmmmm.',
    'mhllmmm',
    'mlmEmEm',
    'mmmmmmm',
    '.dmfmfd',
    '..dmmd.',
    '..d..d.'
  ];
  var BAT_WING = {
    up: { y: 0, r: ['b....', 'bW...', 'wbW..', 'wwbW.', '.wwbb', '..www', '...ww'] },
    mid: { y: 4, r: ['.bb..', 'bWWbb', 'wwwWw', 'wwwww', 'w.w.w'] },
    down: { y: 6, r: ['....b', '...bW', '..bWw', '.bWww', 'bWwww', 'b.w.w', 'b....'] },
    mid2: { y: 5, r: ['..bb.', '.bWWb', 'bwwWw', 'wwwww', '.w.ww'] },
    flat: { y: 12, r: ['bbW..', 'wwwWb'] }
  };
  // icicle tips hanging from the wing scallops (frost): [col, rowFromBottom]
  function drawBat(v, anim, i) {
    var P = BAT[v], b = mk(16, 16);
    var wing = 'mid', by = 3, bx = 5, face = 'n';
    if (anim === 'idle') { wing = ['mid', 'down'][i]; by = [3, 2][i]; }
    else if (anim === 'move') { wing = ['up', 'mid', 'down', 'mid2'][i]; by = [4, 3, 2, 3][i]; }
    else if (anim === 'attack') { wing = ['up', 'down'][i]; by = [4, 5][i]; bx = [4, 5][i]; face = ['n', 'bite'][i]; }
    else if (anim === 'hurt') { wing = 'up'; by = 4; bx = 4; face = 'shut'; }
    else if (anim === 'die') {
      if (i === 3) return shift(deathPuff(3), 0, 1);
      wing = ['down', 'up', 'flat'][i]; by = [4, 6, 7][i]; face = 'dead';
    }
    var W = BAT_WING[wing], wy = wing === 'flat' ? W.y : W.y + (by - 3);
    // wings (behind body): left as-is, right mirrored
    spr(b, W.r, P, bx - 3, wy, false);
    spr(b, W.r, P, bx + 5, wy, true);
    if (v === 'frost' && wing !== 'flat') { // icicles hang from the lowest membrane pixels
      var last = W.r[W.r.length - 1];
      for (var c = 0; c < last.length; c++) if (last.charAt(c) === 'w' && (c === 0 || c === 4)) {
        px(b, bx - 3 + c, wy + W.r.length, P.i); px(b, bx + 5 + (4 - c), wy + W.r.length, P.i);
      }
    }
    // body
    var rows = BAT_BODY;
    if (anim === 'die' && i === 2) rows = ['.k...k.', '.mmmmm.', 'mhlmmmm', 'mlmxmxm', '.dmmmd.'];
    spr(b, rows, P, bx, by + (anim === 'die' && i === 2 ? 3 : 0));
    var ey = by + 4;
    if (face === 'bite') { // open maw with long fangs
      px(b, bx + 4, ey + 2, P.o); px(b, bx + 4, ey + 3, P.o); px(b, bx + 3, ey + 2, P.f); px(b, bx + 5, ey + 2, P.f);
      px(b, bx + 5, ey + 3, P.f); px(b, bx + 3, ey + 3, P.d);
    }
    if (face === 'shut' || face === 'dead') {
      px(b, bx + 3, ey, P.x); px(b, bx + 5, ey, P.x);
      if (face === 'dead') { px(b, bx + 4, ey + 2, P.o); px(b, bx + 3, ey + 2, P.d); px(b, bx + 5, ey + 2, P.d); }
    }
    outline(b, OL);
    if (anim === 'die' && i === 2) blit(b, deathPuff(0), 0, 2);
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('bat', {
    w: 16, h: 16, ax: 8, ay: 15,
    anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 },
    variants: ['gloom', 'frost'],
    fps: { idle: 6, move: 12, attack: 8, die: 8 },
    draw: drawBat
  });

  // ======================================================================= SHROOMLING (16x18)
  var SHROOM = {
    glowcap: { cap: ['#2b1b4e', '#46307a', '#6448a6', '#8a6ccc', '#b49ae8'], spot: ['#64c8ec', '#bff6ff', '#ffffff'],
      gill: ['#1e1632', '#33284e'], stem: ['#5e5b8c', '#9ca6d2', '#c8d4f0', '#eef2ff'], eye: OL, blush: '#c4648e', brow: false,
      spore: ['#3c4c98', '#5f84cf', '#8fbdec', '#c2ebfb', '#f2fdff'] },
    toxic: { cap: ['#22301f', '#3d5a25', '#678a2c', '#98ba3a', '#cde46a'], spot: ['#4a1f50', '#7a3a7e', '#a45aa4'],
      gill: ['#1c1a24', '#2f2c38'], stem: ['#4e5a3c', '#8a9862', '#b9c48c', '#e2e9bc'], eye: OL, blush: '#8c3a62', brow: true,
      spore: ['#34602a', '#55913a', '#86c04c', '#b6e06c', '#e6f9a2'] }
  };
  // spots relative to cap centre/base: [dx, dy, size]
  var SHROOM_SPOTS = [[-4, -4, 2], [0, -6, 1], [2, -4, 2], [-1, -2, 1], [5, -2, 1], [-6, -2, 1]];
  function shroomCap(b, P, v, cx, base, rx, ry) {
    var x, y, top = Math.floor(base - ry);
    function ins(x, y) { if (y > base) return false; var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - base - 0.5) / ry; return dx * dx + dy * dy <= 1; }
    for (y = top; y <= base; y++) for (x = 0; x < b.w; x++) {
      if (!ins(x, y)) continue;
      var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - base - 0.5) / ry, l = -0.6 * nx - 0.8 * ny;
      var k = l > 0.62 ? 4 : l > 0.2 ? 3 : l > -0.3 ? 2 : 1;
      if (y === base) k = Math.min(k, nx < -0.6 ? 2 : 1);
      if (!ins(x, y - 1) && l > 0) k = Math.max(k, 3);
      px(b, x, y, P.cap[k]);
    }
    // drooping lip at both ends + gills underneath
    var lx = Math.round(cx - rx), rxp = Math.round(cx + rx) - 1;
    px(b, lx, base + 1, P.cap[1]); px(b, rxp, base + 1, P.cap[0]);
    for (x = lx + 1; x < rxp; x++) px(b, x, base + 1, P.gill[(x & 1) ? 1 : 0]);
    // spots
    for (var s = 0; s < SHROOM_SPOTS.length; s++) {
      var S = SHROOM_SPOTS[s], sx = Math.round(cx + S[0] * rx / 7), sy = Math.round(base + 0.5 + S[1] * ry / 6.5);
      if (!ins(sx, sy) || !ins(sx + S[2] - 1, sy + S[2] - 1) || sy + S[2] - 1 >= base) continue;
      if (S[2] === 2) { px(b, sx, sy, P.spot[2]); px(b, sx + 1, sy, P.spot[1]); px(b, sx, sy + 1, P.spot[1]); px(b, sx + 1, sy + 1, P.spot[0]); }
      else px(b, sx, sy, P.spot[v === 'toxic' ? 0 : 1]);
    }
  }
  function shroomStem(b, P, cx, top, bot, face, lean) {
    var x, y, x0 = Math.round(cx) - 3;
    for (y = top; y <= bot; y++) {
      var inset = (y === bot) ? 1 : 0, sh = Math.round(lean * (bot - y) / Math.max(1, bot - top));
      for (x = x0 + inset + sh; x <= x0 + 6 - inset + sh; x++) {
        var k = x === x0 + inset + sh ? 3 : x >= x0 + 5 - inset + sh ? 1 : 2;
        if (y === top) k = 0;
        if (y === bot && k > 1) k = 1;
        px(b, x, y, P.stem[k]);
      }
    }
    // face
    var ex = x0 + 3 + Math.round(lean * 0.5), ey = top + 2, E = P.eye;
    if (face === 'n' || face === 'o') {
      px(b, ex, ey, E); px(b, ex, ey + 1, E); px(b, ex + 2, ey, E); px(b, ex + 2, ey + 1, E);
      if (P.brow) { // scowl: brows dip toward the nose, frowning mouth
        px(b, ex + 1, ey - 1, E); px(b, ex - 1, ey - 1, P.stem[1]); px(b, ex + 3, ey - 1, P.stem[1]);
        clr(b, ex, ey); px(b, ex, ey, P.stem[1]); px(b, ex - 1, ey - 1, E); px(b, ex + 3, ey - 1, E);
      } else { px(b, ex - 1, ey + 2, P.blush); px(b, ex + 3, ey + 2, P.blush); }
      if (face === 'o') { px(b, ex + 1, ey + 2, E); px(b, ex + 1, ey + 3, E); }
      else if (P.brow && ey + 3 <= bot - 1) { px(b, ex, ey + 3, E); px(b, ex + 1, ey + 3, E); px(b, ex + 2, ey + 3, E); px(b, ex + 2, ey + 4, '#e2e9bc'); }
      else if (ey + 3 <= bot - 1) px(b, ex + 1, ey + 3, E);
    } else if (face === 'shut') {
      px(b, ex - 1, ey, E); px(b, ex, ey + 1, E); px(b, ex + 3, ey, E); px(b, ex + 2, ey + 1, E); px(b, ex + 1, ey + 3, E);
    } else if (face === 'dead') {
      px(b, ex - 1, ey, E); px(b, ex, ey + 1, E); px(b, ex - 1, ey + 2, E); px(b, ex + 1, ey + 1, E);
      px(b, ex + 2, ey, E); px(b, ex + 3, ey + 1, E); px(b, ex + 2, ey + 2, E); px(b, ex + 4, ey, E);
    }
  }
  function spores(b, P, pts, al) {
    cloud(b, pts, P.spore, al, false);
  }
  var SHROOM_POSE = {
    // cap: [dx, baseY, rx, ry]; stem bottom fixed by legs; legs: [backX, backLift, frontX, frontLift]
    idle: [{ cap: [0, 7, 7, 6.2], st: 14, legs: [-2, 0, 1, 0] }, { cap: [0, 8, 7, 6], st: 14, legs: [-2, 0, 1, 0] }],
    move: [{ cap: [0.5, 7, 6.8, 6.2], st: 14, legs: [-3, 0, 2, 1] },
           { cap: [0.5, 6.6, 6.8, 5.8], st: 13, legs: [-2, 1, 1, 0] },
           { cap: [0.5, 7, 6.8, 6.2], st: 14, legs: [-1, 1, 0, 0] },
           { cap: [0.5, 6.6, 6.8, 5.8], st: 13, legs: [-2, 0, 1, 1] }],
    attack: [{ cap: [-0.3, 9, 6.9, 5.6], st: 14, legs: [-3, 0, 2, 0], face: 'shut' },
             { cap: [0, 7, 6.6, 6], st: 14, legs: [-2, 0, 1, 0], face: 'o', spore: 1 },
             { cap: [0, 7, 7, 6.2], st: 14, legs: [-2, 0, 1, 0], face: 'n', spore: 2 }],
    hurt: [{ cap: [-0.4, 8, 6.7, 6], st: 14, legs: [-2, 0, 1, 0], face: 'shut' }],
    die: [{ cap: [-0.5, 9, 6.6, 5.8], st: 14, legs: [-2, 0, 1, 0], face: 'dead' },
          { cap: [-0.8, 12, 6.2, 5], st: 15, legs: [-3, 0, 2, 0], face: 'dead', low: true },
          { cap: [-1, 15, 6.4, 3.5], st: 0, legs: null, face: null, spore: 3 },
          null]
  };
  function drawShroom(v, anim, i) {
    var P = SHROOM[v], st = SHROOM_POSE[anim][i], b = mk(16, 18);
    if (!st) {
      var pf = mk(16, 18); spores(pf, P, [[4, 9, 1.4], [11.5, 7.5, 1.6], [7.5, 4.5, 1.8], [9, 11, 1.1]], 0.4);
      px(pf, 7, 2, P.spore[4]); px(pf, 2, 7, P.spore[3]); px(pf, 13, 5, P.spore[3]); return pf;
    }
    var cx = 8 + st.cap[0], base = st.cap[1];
    // legs
    if (st.legs) {
      var L = st.legs, ly = 16;
      rect(b, 8 + L[0], ly - L[1] - 1, 2, 2 - (L[1] ? 0 : 0), P.stem[1]);
      px(b, 8 + L[0], ly - L[1] - 1, P.stem[2]);
      rect(b, 8 + L[2], ly - L[3] - 1, 2, 2, P.stem[2]);
      px(b, 9 + L[2], ly - L[3], P.stem[1]);
    }
    if (st.face !== null) shroomStem(b, P, 8, base + 1, st.st, st.face || 'n', st.lean || 0);
    var lay = mk(16, 18);
    shroomCap(lay, P, v, cx, base, st.cap[2], st.cap[3]);
    over(b, lay, P.cap[0]);
    if (anim === 'die' && i === 0) { /* cap knocked askew */ }
    outline(b, OL);
    if (st.spore === 1) { // puff bursts from the crown
      spores(b, P, [[8, 1.6, 2], [5, 2.2, 1.5], [11.2, 2, 1.7], [13.6, 4, 1.2]], 0.72);
      px(b, 8, 0, P.spore[4]); px(b, 12, 1, P.spore[4]); px(b, 4, 1, P.spore[3]); px(b, 14, 3, P.spore[3]);
    } else if (st.spore === 2) { // cloud drifts forward and spreads
      spores(b, P, [[13, 3.5, 2.2], [10.5, 1.8, 1.8], [14.5, 7, 1.4], [3.4, 1.6, 1.5], [6.5, 0.9, 1.2]], 0.6);
      px(b, 12, 1, P.spore[4]); px(b, 15, 5, P.spore[4]); px(b, 2, 2, P.spore[3]); px(b, 9, 0, P.spore[3]); px(b, 14, 9, P.spore[3]);
    } else if (st.spore === 3) {
      spores(b, P, [[5, 11, 2], [10.5, 10, 2.2], [8, 7.5, 2.4]], 0.6);
      px(b, 8, 5, P.spore[4]); px(b, 3, 9, P.spore[3]); px(b, 13, 8, P.spore[4]);
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('shroomling', {
    w: 16, h: 18, ax: 8, ay: 17,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['glowcap', 'toxic'],
    fps: { idle: 3, move: 8, attack: 7, die: 7 },
    draw: drawShroom
  });

  // ======================================================================= SPIDER (20x16) — seen from above at 3/4, facing right
  var SPIDER = {
    cave: { body: ['#1b1728', '#2d2740', '#41395a', '#575076', '#716a92', '#928bb0'], leg: ['#1e1a2c', '#5a5276', '#7a7099', '#aaa2c6'],
      eye: ['#2fbf7f', '#7dffc4', '#e2fff0'], fang: ['#6e648f', '#c8d4f0'], mark: ['#a49cc0', '#d0caea'], cry: null },
    crystal: { body: ['#1a1229', '#2a1d42', '#3d2c5a', '#523d78', '#6b5296', '#8a72b8'], leg: ['#1a1229', '#5a4878', '#7a64a4', '#ac96dc'],
      eye: ['#c4648e', '#ffb0d8', '#ffffff'], fang: ['#6e648f', '#e4d2ff'], mark: null, cry: ['#3e2670', '#6a47a8', '#9f80e0', '#d4c0ff', '#ffffff'] }
  };
  // legs: [attachX, attachY, kneeX, kneeY, tipX, tipY, upper?, gait group]
  var SPIDER_LEGS = [
    [10, 6, 5, 3, 2, 4, 1, 1], [11, 6, 9, 2, 6, 1, 1, 0], [13, 6, 14, 2, 16, 1, 1, 1], [14, 7, 16, 3, 17, 5, 1, 0],
    [10, 10, 5, 12, 2, 12, 0, 0], [11, 10, 9, 13, 7, 14, 0, 1], [13, 10, 14, 13, 16, 14, 0, 0], [14, 9, 16, 11, 17, 11, 0, 1]
  ];
  function shadeEll(b, cx, cy, rx, ry, R, hiK) {
    for (var y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!inE(x, y, cx, cy, rx, ry)) continue;
      var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, l = -0.6 * nx - 0.8 * ny;
      var k = l > 0.62 ? 4 : l > 0.22 ? 3 : l > -0.3 ? 2 : l > -0.75 ? 1 : 0;
      if (!inE(x, y - 1, cx, cy, rx, ry) && l > 0.1) k = Math.max(k, hiK == null ? 3 : hiK);
      px(b, x, y, R[Math.min(R.length - 1, k)]);
    }
  }
  function spiderLeg(b, L, P, ox, oy, kx, ky, tx, ty, curl) {
    var ax = L[0] + ox, ay = L[1] + oy, kX = L[2] + ox + kx, kY = L[3] + oy + ky, tX = L[4] + ox + tx, tY = L[5] + oy + ty;
    if (curl) { // legs fold in toward the body as it dies
      kX = ax + (kX - ax) * (1 - 0.35 * curl); kY = ay + (kY - ay) * (1 - 0.35 * curl);
      tX = kX + (tX - kX) * (1 - 0.75 * curl) + (ax > 12 ? -curl : curl); tY = kY + (ay - kY) * 0.6 * curl + (tY - kY) * (1 - curl) * 0.5;
    }
    var c = L[6] ? P.leg[1] : P.leg[2];
    line(b, ax, ay, kX, kY, c); line(b, kX, kY, tX, tY, c);
    px(b, kX, kY, L[6] ? P.leg[2] : P.leg[3]);
  }
  function drawSpider(v, anim, i) {
    var P = SPIDER[v], b = mk(20, 16);
    var bob = 0, ox = 0, oy = 0, rear = 0, leap = false, curl = false, step = 0, pulse = 0, dead = false;
    if (anim === 'idle') { pulse = i; }
    else if (anim === 'move') { step = [1, 0, -1, 0][i]; bob = [0, 0, 0, 0][i]; }
    else if (anim === 'attack') { if (i === 0) { rear = 1; ox = -1; } else { leap = true; ox = 1; oy = -2; } }
    else if (anim === 'hurt') { ox = -1; }
    else if (anim === 'die') {
      if (i === 3) { var pb = mk(20, 16); blit(pb, deathPuff(3), 2, 0); return pb; }
      curl = i === 0 ? 0.6 : 1; dead = true; oy = i === 0 ? 0 : 1;
    }
    var legs = mk(20, 16), body = mk(20, 16);
    var k, L;
    for (k = 0; k < 8; k++) {
      L = SPIDER_LEGS[k];
      var g = L[7] ? -step : step, kx = g, ky = 0, tx = g * (L[4] <= 2 || L[4] >= 17 ? 1 : 2), ty = 0;
      if (rear) { // front pair raised, threatening
        if (k === 3) { kx = 0; ky = -1; tx = -1; ty = -3; }
        if (k === 7) { kx = 0; ky = -4; tx = -1; ty = -8; }
        if (k === 2 || k === 6) { kx = 1; ky = k === 2 ? 0 : -1; tx = 2; ty = k === 2 ? 1 : -1; }
      }
      if (leap) { // legs flung out
        if (L[6]) { ky = 2; ty = 3; kx = L[0] >= 13 ? 1 : -1; tx = 0; } // upper legs tuck in mid-air
        else { kx = L[0] >= 13 ? 1 : -1; tx = L[0] >= 13 ? (L[4] >= 17 ? 0 : 1) : (L[4] <= 2 ? 0 : -1); ky = -1; ty = 0; }
      }
      spiderLeg(legs, L, P, ox, oy + bob, kx, ky, tx, ty, curl);
    }
    // body: abdomen (big, behind) + cephalothorax
    var aY = 8 + oy + bob + rear * 0.5, hY = 8 + oy + bob - rear * 1;
    var arx = 4.7 + pulse * 0.3, ary = 3.7 + pulse * 0.3;
    shadeEll(body, 6.4 + ox, aY, arx, ary, P.body.slice(1), 3);
    if (P.mark && !dead) { // pale chevron markings along the back
      var mx = Math.round(3 + ox), my = Math.round(aY - 1);
      spr(body, ['M...M.', '.M.M..', '..N...', '......', '.M.M..', '..M...'], { M: P.mark[0], N: P.mark[1] }, mx, my - 1);
    }
    var head = mk(20, 16);
    shadeEll(head, 13.7 + ox, hY, 2.7, 2.5, P.body.slice(1, 6), 3);
    // eye cluster on the front of the head: two big glowing eyes + small side eyes
    var ex = Math.round(14.2 + ox), ey = Math.round(hY - 1);
    if (dead || anim === 'hurt') { px(head, ex, ey, P.body[0]); px(head, ex + 1, ey + 1, P.body[0]); px(head, ex + 1, ey, P.eye[0]); px(head, ex, ey + 1, P.eye[0]); }
    else {
      px(head, ex, ey, P.eye[2]); px(head, ex + 1, ey, P.eye[1]); px(head, ex, ey + 1, P.eye[1]); px(head, ex + 1, ey + 1, P.eye[0]);
      px(head, ex - 1, ey - 1, P.eye[1]); px(head, ex - 1, ey + 2, P.eye[1]); px(head, ex - 2, ey - 1, P.eye[0]); px(head, ex - 2, ey + 2, P.eye[0]);
    }
    over(body, head, P.body[0]);
    var fx = Math.round(16.2 + ox), fy = Math.round(hY - 1);
    var open = rear || leap ? 1 : 0;
    px(body, fx, fy - open, P.fang[0]); px(body, fx + 1, fy - open, P.fang[1]);
    px(body, fx, fy + 2 + open, P.fang[0]); px(body, fx + 1, fy + 2 + open, P.fang[1]);
    if (P.cry && !dead) { // amethyst growing out of the abdomen
      var cx = Math.round(5 + ox), cy = Math.round(aY - 3);
      spr(body, ['..W.', '.WL.', 'WLMD', 'LMMD'], { W: P.cry[3], L: P.cry[2], M: P.cry[1], D: P.cry[0] }, cx, cy - 2);
      spr(body, ['.W', 'LM', 'MD'], { W: P.cry[4], L: P.cry[2], M: P.cry[1], D: P.cry[0] }, cx - 3, cy + 1);
      spr(body, ['W.', 'LD'], { W: P.cry[3], L: P.cry[2], D: P.cry[0] }, cx + 4, cy + 1);
    }
    if (dead && i >= 1) { // belly-up husk sinking
      fade(body, 1);
    }
    over(legs, body, P.body[0]);
    outline(legs, OL);
    if (leap) shadowE(legs, 10 + ox, 14.5, 5.5, 0.9, 0.45);
    blit(b, legs, 0, 0);
    if (anim === 'die' && i === 2) blit(b, deathPuff(1), 2, 0);
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('spider', {
    w: 20, h: 16, ax: 10, ay: 15,
    anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 },
    variants: ['cave', 'crystal'],
    fps: { idle: 3, move: 12, attack: 6, die: 8 },
    draw: drawSpider
  });

  // ======================================================================= BROODMOTHER (40x32) — big spider mini-boss
  var BROOD = {
    body: ['#120c1c', '#1d1530', '#2a1f45', '#3a2b5e', '#4d3a78', '#6650a0', '#8670c0'],
    leg: ['#1d1530', '#3a2b5e', '#54407e', '#7660a4', '#a08ad0'],
    egg: ['#5a4f80', '#9a90bc', '#d0c8e8', '#f6f2ff'], yolk: '#4a3b6d',
    mark: ['#1f8a5c', '#2fbf7f', '#5dffb0', '#b4ffd9'],
    eye: ['#6a47a8', '#b99aee', '#e4d2ff', '#ffffff'], fang: ['#4a3b6d', '#9fb0d8', '#e8eeff']
  };
  // [attachX, attachY, kneeX, kneeY, tipX, tipY, upper?, gait]
  var BROOD_LEGS = [
    [23, 12, 14, 3, 4, 6, 1, 1], [25, 11, 21, 2, 13, 1, 1, 0], [28, 11, 30, 2, 34, 1, 1, 1], [30, 12, 35, 4, 37, 9, 1, 0],
    [23, 20, 14, 27, 4, 26, 0, 0], [25, 21, 21, 27, 13, 28, 0, 1], [28, 21, 31, 27, 35, 28, 0, 0], [30, 20, 35, 26, 37, 22, 0, 1]
  ];
  function tline(b, x0, y0, x1, y1, c, c2) {
    var dx = x1 - x0, dy = y1 - y0;
    if (Math.abs(dx) >= Math.abs(dy)) line(b, x0, y0 + 1, x1, y1 + 1, c2); else line(b, x0 + 1, y0, x1 + 1, y1, c2);
    line(b, x0, y0, x1, y1, c);
  }
  function broodLeg(b, L, ox, oy, kx, ky, tx, ty, curl) {
    var C = BROOD.leg;
    var ax = L[0] + ox, ay = L[1] + oy, kX = L[2] + ox + kx, kY = L[3] + oy + ky, tX = L[4] + ox + tx, tY = L[5] + oy + ty;
    if (curl) {
      kX = ax + (kX - ax) * (1 - 0.4 * curl); kY = ay + (kY - ay) * (1 - 0.4 * curl);
      tX = kX + (tX - kX) * (1 - 0.8 * curl) + (ax > 26 ? -2 : 2) * curl; tY = kY + (ay - kY) * 0.55 * curl + (tY - kY) * (1 - curl) * 0.4;
    }
    var hi = L[6] ? 2 : 3;
    tline(b, ax, ay, kX, kY, C[hi], C[hi - 1]);
    // tibia: thick near the knee, thin at the tip
    var mx = Math.round(kX + (tX - kX) * 0.5), my = Math.round(kY + (tY - kY) * 0.5);
    tline(b, kX, kY, mx, my, C[hi], C[hi - 1]);
    line(b, mx, my, tX, tY, C[hi]);
    px(b, kX, kY, C[hi + 1]); px(b, kX + 1, kY, C[hi]);
    // bristle on the knee
    px(b, kX + (tX > kX ? -1 : 1), kY - 1, C[hi - 1]);
  }
  function drawBrood(v, anim, i) {
    var B = BROOD, b = mk(40, 32);
    var ox = 0, oy = 0, step = 0, pulse = 0, rear = 0, lunge = 0, curl = 0, dim = 0, open = 0;
    if (anim === 'idle') { pulse = i; }
    else if (anim === 'move') { step = [1, 0, -1, 0][i]; oy = [0, 1, 0, 1][i]; }
    else if (anim === 'attack') { rear = i === 0 ? 1 : 0; lunge = i === 1 ? 1 : 0; ox = [-1, 0, 0][i]; open = [1, 2, 0][i]; }
    else if (anim === 'hurt') { ox = -1; }
    else if (anim === 'die') {
      if (i >= 3) {
        var pb = mk(40, 32);
        var t = i - 3;
        blit(pb, deathPuff(t === 0 ? 1 : 3), 6, 8); blit(pb, deathPuff(t === 0 ? 2 : 4), 18, 6); blit(pb, deathPuff(t === 0 ? 1 : 3), 13, 13);
        return pb;
      }
      curl = [0.3, 0.7, 1][i]; dim = i; oy = [0, 1, 2][i];
    }
    var lay = mk(40, 32), body = mk(40, 32), k;
    for (k = 0; k < 8; k++) {
      var L = BROOD_LEGS[k], g = L[7] ? -step : step;
      var kx = g, ky = 0, tx = g * (L[4] >= 37 || L[4] <= 4 ? 1 : 2), ty = 0;
      if (rear && L[4] >= 37) { kx = 0; ky = L[6] ? -1 : -6; tx = -2; ty = L[6] ? -2 : -12; }
      if (lunge && L[4] > 30) { kx = 1; tx = 0; ty = L[6] ? 3 : -3; }
      if (anim === 'die' && i === 0) { kx = (k % 2 ? 1 : -1); ky = -1; }
      broodLeg(lay, L, ox, oy, kx, ky, tx, ty, curl);
    }
    // abdomen
    var aX = 13 + ox, aY = 15.5 + oy, arx = 10.5 + pulse * 0.4 - dim * 0.6, ary = 8.8 + pulse * 0.4 - dim * 0.8;
    shadeEll(body, aX, aY, arx, ary, B.body.slice(1, 7), 4);
    // glowing markings: spine of chevrons + side dots
    var M = B.mark, g2 = dim ? 0 : 1 + pulse;
    if (dim < 2) {
      var mk2 = ['..A.....A..', '...A...A...', '....ABA....', '.....C.....'];
      var mpal = { A: M[g2 > 1 ? 2 : 1], B: M[g2 > 1 ? 3 : 2], C: M[g2 > 1 ? 3 : 2] };
      if (dim) mpal = { A: M[0], B: M[1], C: M[1] };
      spr(body, mk2, mpal, Math.round(aX - 3), Math.round(aY + 1));
      spr(body, mk2, mpal, Math.round(aX - 3), Math.round(aY + 4));
      px(body, Math.round(aX + 6), Math.round(aY + 2), mpal.B); px(body, Math.round(aX - 8), Math.round(aY + 3), mpal.A);
    }
    // egg clusters bulging on the upper back
    var eggs = [[-5.5, -3.5, 2.4], [-1.2, -5.2, 2.3], [3, -4, 2.1], [-3, -0.6, 2.1], [1.2, -0.9, 1.9], [-8.2, -0.2, 1.7]];
    if (dim >= 2) eggs = [eggs[0], eggs[3]];
    var eggL = mk(40, 32);
    for (k = 0; k < eggs.length; k++) {
      var e = eggs[k], exx = aX + e[0], eyy = aY + e[1], r = e[2], EL = mk(40, 32);
      for (var y = Math.floor(eyy - r - 1); y <= eyy + r + 1; y++) for (var x = Math.floor(exx - r - 1); x <= exx + r + 1; x++) {
        if (!inE(x, y, exx, eyy, r, r)) continue;
        var nx = (x + 0.5 - exx) / r, ny = (y + 0.5 - eyy) / r, l = -0.6 * nx - 0.8 * ny;
        px(EL, x, y, B.egg[l > 0.62 ? 3 : l > -0.15 ? 2 : 1]);
      }
      px(EL, Math.round(exx - r * 0.45), Math.round(eyy - r * 0.45), '#ffffff');
      if (dim < 2) { // embryo inside: some glow
        var gl = (k + pulse) % 3 === 0;
        px(EL, Math.round(exx + 0.4), Math.round(eyy + 0.4), gl ? M[2] : B.yolk);
        if (gl) px(EL, Math.round(exx + 0.4) + 1, Math.round(eyy + 0.4), M[0]);
      }
      over(eggL, EL, B.body[2]);
    }
    over(body, eggL, B.body[1]);
    // cephalothorax + head
    var head = mk(40, 32), hX = 28.5 + ox + lunge, hY = 16 + oy - rear * 2;
    shadeEll(head, hX, hY, 5.6, 5, B.body.slice(1, 7), 4);
    // carapace ridge
    px(head, Math.round(hX - 2), Math.round(hY - 2), B.body[5]); px(head, Math.round(hX - 1), Math.round(hY - 1), B.body[4]); px(head, Math.round(hX), Math.round(hY), B.body[3]);
    // eye cluster
    var ex = Math.round(hX + 2), ey = Math.round(hY - 2), E = B.eye;
    if (anim === 'die' || anim === 'hurt') {
      rect(head, ex, ey, 2, 1, E[0]); rect(head, ex, ey + 3, 2, 1, E[0]);
    } else {
      spr(head, ['.c..', 'WE..', 'EEc.', '..cW', '.cEE', 'WE..', 'EE..'].slice(0, 0), {}, ex, ey);
      rect(head, ex, ey, 2, 2, E[2]); px(head, ex, ey, E[3]);
      rect(head, ex, ey + 3, 2, 2, E[2]); px(head, ex, ey + 3, E[3]);
      px(head, ex + 2, ey + 2, E[1]); px(head, ex - 1, ey - 1, E[1]); px(head, ex - 1, ey + 5, E[1]); px(head, ex - 2, ey + 2, E[1]);
      px(head, ex + 2, ey + 1, E[0]); px(head, ex + 2, ey + 3, E[0]);
    }
    over(body, head, B.body[0]);
    // chelicerae / fangs
    var fx = Math.round(hX + 5), fy = Math.round(hY - 2);
    var fpal = { d: B.fang[0], m: B.fang[1], l: B.fang[2], k: B.body[3] };
    var top = ['kkm..', '.kmm.', '...ml', '....l'], bot = ['....l', '...ml', '.kmm.', 'kkm..'];
    if (open === 2) { top = ['kkm..', '.kmml', '....l']; bot = ['....l', '.kmml', 'kkm..']; }
    spr(body, top, fpal, fx - 1, fy - 1 - open);
    spr(body, bot, fpal, fx - 1, fy + 2 + open + (open === 2 ? 1 : 0));
    over(lay, body, B.body[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (anim !== 'die' && anim !== 'attack') { // trailing silk thread from the spinnerets
      var sx = Math.round(aX - arx), sy = Math.round(aY + 2);
      for (var q = 0; q <= sx; q++) px(b, sx - q, sy + Math.round(Math.sin(q / Math.max(1, sx) * Math.PI) * 1.5), '#c8d4f0', 0.55 - q * 0.04);
    }
    if (anim === 'attack' && i > 0) { // venom beading on the fangs
      var vx = Math.round(hX + 7), vy = Math.round(hY + 3 + open);
      px(b, vx, vy, B.mark[2]); px(b, vx, vy + 1, B.mark[1]); if (i === 2) px(b, vx - 1, vy + 3, B.mark[2]);
    }
    if (anim === 'die' && i === 2) { blit(b, deathPuff(0), 6, 8); blit(b, deathPuff(1), 14, 10); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('broodmother', {
    w: 40, h: 32, ax: 20, ay: 31,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 5 },
    variants: ['default'],
    fps: { idle: 3, move: 9, attack: 7, die: 7 },
    draw: drawBrood
  });

  // ======================================================================= SKELETON (16x24) — warrior / mage
  var BONE = { d: '#4a4060', s: '#8f84a6', b: '#d6ccbe', w: '#f6f0e2', k: '#1b1429' };
  var SKEL = {
    warrior: { eye: ['#c44a3a', '#ffbc62', '#fff1c8'], rust: ['#5a2c22', '#8a3e2a', '#b85a36', '#d98a5a'], steel: ['#45445a', '#7e7d97', '#b4b3c8', '#e2e1ee'],
      hilt: ['#3e2d2b', '#7a5a48', '#9c7a5e'], helm: ['#2d2c3e', '#4f4e66', '#77768f', '#a09fb6'] },
    mage: { eye: ['#6a47a8', '#c9b0ff', '#ffffff'], hood: ['#1b1429', '#2c2145', '#40305f', '#58447e', '#735ca0'],
      staff: ['#281d21', '#574039', '#7a5a48', '#9c7a5e'], orb: ['#6a47a8', '#b99aee', '#e4d2ff', '#ffffff'] }
  };
  var SKULL = [
    '..bbbb..',
    '.bwwwwb.',
    'bwwwwwwb',
    'bwwbddbd',
    'sbwbdedd',
    '.sbbbsbs',
    '..sbtbtb'
  ];
  var JAW = ['.sbbbb', '..ssss'];
  var TORSO = [
    '.s....',
    '.sbwwb',
    '.s...w',
    '.sbwww',
    '.s...w',
    '.sbbw.',
    '.s....',
    'sbbbbs',
    'b....b'
  ];
  function bone(b, x0, y0, x1, y1, c, jc) { line(b, x0, y0, x1, y1, c); if (jc) px(b, x1, y1, jc); }
  // leg: [hipX,hipY,kneeX,kneeY,footX,footY]; arm: [shX,shY,elX,elY,hdX,hdY] (absolute, before body offset)
  var SK_BASE = { bx: 0, by: 0, hx: 0, hy: 0, jaw: 0,
    legB: [7, 16, 7, 19, 6, 22], legF: [10, 16, 10, 19, 10, 22],
    armB: [7, 9, 6, 12, 6, 15], armF: [10, 9, 11, 12, 12, 14], wpn: -75, bl: 7, staff: 0 };
  function skPose(v, anim, i) {
    var p = JSON.parse(JSON.stringify(SK_BASE));
    if (v === 'mage') p.armF = [10, 9, 12, 12, 13, 13];
    function L(a, d) { for (var k = 0; k < d.length; k++) a[k] += d[k]; }
    if (anim === 'idle') { if (i === 1) { p.by = 1; p.jaw = 1; L(p.legB, [0, 0, 0, 0, 0, 0]); L(p.armF, [0, 0, 0, 0, 0, 1]); L(p.armB, [0, 0, 0, 0, 0, 1]); p.wpn = -62; } }
    else if (anim === 'move') {
      var W = [
        { legB: [0, 0, -1, 0, -2, 0], legF: [0, 0, 1, 0, 2, 0], armF: [0, 0, -1, 0, -2, 0], armB: [0, 0, 1, 0, 2, -1], by: 1 },
        { legB: [0, 0, 1, -1, 2, -1], legF: [0, 0, 0, 0, 0, 0], armF: [0, 0, 0, 0, 0, 0], armB: [0, 0, 0, 0, 0, 0], by: 0 },
        { legB: [0, 0, 2, 0, 4, 0], legF: [0, 0, -2, 0, -3, 0], armF: [0, 0, 1, 0, 1, -1], armB: [0, 0, -1, 0, -2, 0], by: 1 },
        { legB: [0, 0, 0, 0, 0, 0], legF: [0, 0, -1, -1, -2, -1], armF: [0, 0, 0, 0, 0, 0], armB: [0, 0, 0, 0, 0, 0], by: 0 }
      ][i];
      L(p.legB, W.legB); L(p.legF, W.legF); if (v !== 'mage') L(p.armF, W.armF); L(p.armB, W.armB); p.by = W.by; p.jaw = i % 2;
    } else if (anim === 'attack') {
      if (v === 'warrior') {
        if (i === 0) { p.bx = 0; p.hx = -1; p.armF = [10, 9, 9, 8, 7, 7]; p.wpn = -140; L(p.legF, [0, 0, 1, 0, 2, 0]); L(p.legB, [0, 0, -1, 0, -2, 0]); }
        if (i === 1) { p.bx = 0; p.hx = 1; p.armF = [10, 9, 12, 9, 13, 10]; p.wpn = 48; p.bl = 6; p.jaw = 1; L(p.legF, [0, 0, 1, 0, 2, 0]); L(p.legB, [0, 0, -1, 0, -2, 0]); p.smear = 1; }
        if (i === 2) { p.bx = 1; p.hx = 1; p.by = 1; p.armF = [10, 9, 11, 12, 12, 15]; p.wpn = 70; p.bl = 6; L(p.legF, [0, 0, 1, 0, 2, 0]); L(p.legB, [0, 0, -1, 0, -2, 0]); }
      } else {
        if (i === 0) { p.bx = 0; p.hx = -1; p.armF = [10, 9, 12, 9, 13, 8]; p.staff = 0; p.glow = 1; }
        if (i === 1) { p.bx = 0; p.hx = 1; p.armF = [10, 9, 11, 9, 12, 9]; p.staff = 0; p.tilt = 1; p.glow = 2; p.jaw = 1; L(p.legF, [0, 0, 1, 0, 2, 0]); L(p.legB, [0, 0, -1, 0, -1, 0]); }
        if (i === 2) { p.armF = [10, 9, 11, 11, 12, 12]; p.staff = 0; p.tilt = 1; p.glow = 3; }
      }
    } else if (anim === 'hurt') { p.bx = 0; p.hx = -1; p.jaw = 1; L(p.armF, [0, 0, -1, -1, -1, -3]); L(p.armB, [0, 0, -1, -1, -1, -2]); }
    return p;
  }
  function drawSkull(lay, v, S, hx, hy, jaw, eyeC) {
    if (v === 'mage') spr(lay, ['.cccccc...', 'cHHHHHHc..', 'cHh.......', 'cHh.......', 'cHh.......', 'cHh.......', '.cHh......', '..cH......', '...c......'],
      { c: S.hood[1], H: S.hood[2], h: S.hood[3] }, hx - 2, hy - 1);
    spr(lay, SKULL, { b: BONE.b, w: BONE.w, s: BONE.s, d: BONE.k, e: eyeC, t: BONE.w }, hx, hy);
    spr(lay, JAW, { b: BONE.b, s: BONE.s }, hx + 2, hy + 7 + jaw);
    if (v === 'mage') spr(lay, ['.cccccc...', 'cHhhhhhHc.', 'cHHHHHHHHc', 'cH........'], { c: S.hood[1], H: S.hood[3], h: S.hood[4] }, hx - 2, hy - 1);
    if (v === 'warrior') { // dented iron half-helm with a rusty rivet
      spr(lay, ['..aaaaa..', '.abccddba', 'aabbcbbaa'], { a: S.helm[0], b: S.helm[1], c: S.helm[2], d: S.helm[3] }, hx - 1, hy - 1);
      px(lay, hx + 5, hy, S.rust[2]);
    }
  }
  function drawSkelPile(v, b, t) {
    var S = SKEL[v], lay = mk(16, 24);
    bone(lay, 2, 22, 7, 21, BONE.b); bone(lay, 6, 22, 12, 22, BONE.s); bone(lay, 9, 21, 13, 20, BONE.b); bone(lay, 3, 20, 6, 22, BONE.s);
    spr(lay, ['.sbw.', 's...w', 'sbbww'], BONE, 7, 19);
    if (v === 'mage') { line(lay, 1, 22, 12, 19, S.staff[1]); px(lay, 13, 18, S.orb[0]); px(lay, 14, 18, S.orb[1]); }
    else { line(lay, 8, 21, 14, 19, S.rust[2]); line(lay, 8, 22, 14, 20, S.rust[1]); px(lay, 7, 21, S.hilt[1]); }
    drawSkull(lay, v, S, 4, 12 + t, 1, BONE.k);
    outline(lay, OL);
    blit(b, lay, 0, 0);
  }
  function drawSkeleton(v, anim, i) {
    var S = SKEL[v], b = mk(16, 24);
    if (anim === 'die' && i >= 2) {
      drawSkelPile(v, b, i - 2);
      if (i === 3) { var dp = mk(16, 24); cloud(dp, [[3, 19.5, 1.6], [13, 18.5, 1.7], [8, 17, 1.9]], SMOKE, 0.5, false); blit(b, dp, 0, 0); }
      return b;
    }
    var p = skPose(v, anim, i);
    var col = anim === 'die' ? i + 1 : 0;
    var back = mk(16, 24), mid = mk(16, 24), front = mk(16, 24), head = mk(16, 24), fa = mk(16, 24);
    var ox = p.bx, oy = p.by + col * 2;
    var AB = p.armB, Lg = p.legB, F = p.legF, R = p.armF;
    // back limbs (shaded)
    bone(back, AB[0] + ox, AB[1] + oy, AB[2] + ox, AB[3] + oy, BONE.s); bone(back, AB[2] + ox, AB[3] + oy, AB[4] + ox, AB[5] + oy, BONE.s, BONE.b);
    var kneeDrop = col ? col : 0;
    bone(back, Lg[0] + ox, Lg[1] + oy, Lg[2] + (col ? -col : 0), Lg[3] + kneeDrop, BONE.s); bone(back, Lg[2] + (col ? -col : 0), Lg[3] + kneeDrop, Lg[4], Lg[5], BONE.s);
    px(back, Lg[4] + 1, Lg[5], BONE.s);
    if (v === 'warrior' && !col) { // little wooden buckler on the back arm
      spr(back, ['.hh.', 'hHHh', 'hHHh', '.hh.'], { h: S.hilt[0], H: S.hilt[1] }, AB[4] + ox - 2, AB[5] + oy - 3);
      px(back, AB[4] + ox - 1, AB[5] + oy - 2, S.helm[3]);
    }
    // torso
    spr(mid, TORSO, BONE, 6 + ox, 8 + oy);
    if (v === 'mage') spr(mid, ['.hhhhh.', 'hHHHHHh', 'hHhHHhH', 'h.h.h.h'], { h: S.hood[1], H: S.hood[2] }, 5 + ox, 9 + oy);
    over(back, mid, BONE.d);
    // front leg
    bone(front, F[0] + ox, F[1] + oy, F[2] + (col ? col : 0), F[3] + kneeDrop, BONE.b, BONE.w); bone(front, F[2] + (col ? col : 0), F[3] + kneeDrop, F[4], F[5], BONE.b);
    px(front, F[4] + 1, F[5], BONE.b);
    over(back, front, BONE.d);
    // skull (pops up while collapsing)
    var hx = 4 + ox + p.hx, hy = 2 + oy + p.hy - (col === 1 ? 2 : col === 2 ? 1 : 0);
    var eyeC = (anim === 'hurt' || col) ? BONE.k : S.eye[1];
    drawSkull(head, v, S, hx, hy, p.jaw || (col ? 1 : 0), eyeC);
    over(back, head, BONE.d);
    // front arm + weapon
    bone(fa, R[0] + ox, R[1] + oy, R[2] + ox, R[3] + oy, BONE.b); bone(fa, R[2] + ox, R[3] + oy, R[4] + ox, R[5] + oy, BONE.b, BONE.w);
    var hdx = R[4] + ox, hdy = R[5] + oy;
    if (v === 'warrior' && !col) {
      var ang = p.wpn * Math.PI / 180, cx = Math.cos(ang), cy = Math.sin(ang);
      px(fa, Math.round(hdx - cx), Math.round(hdy - cy), S.hilt[2]); // pommel
      var gx = hdx + cx, gy = hdy + cy;
      px(fa, Math.round(gx - cy), Math.round(gy + cx), S.hilt[1]); px(fa, Math.round(gx + cy), Math.round(gy - cx), S.hilt[1]);
      px(fa, Math.round(gx), Math.round(gy), S.hilt[0]);
      var bl = p.bl || 8;
      for (var t = 2; t <= bl; t++) { // 2px-wide pitted blade: bright edge, grey flat, rust blooms
        var bxp = hdx + cx * t, byp = hdy + cy * t;
        var edge = t === bl ? S.steel[3] : t === 5 ? S.rust[3] : S.steel[2];
        var flat = (t === 3 || t === 6) ? S.rust[2] : t === 4 ? S.rust[1] : S.steel[1];
        var ex1 = Math.round(bxp + cy * 0.6), ey1 = Math.round(byp - cx * 0.6), ex2 = Math.round(bxp - cy * 0.6), ey2 = Math.round(byp + cx * 0.6);
        if (ex1 < 1 || ex1 > 14 || ey1 < 1 || ey1 > 22 || ex2 < 1 || ex2 > 14 || ey2 < 1 || ey2 > 22) break;
        px(fa, ex1, ey1, edge);
        if (t < bl) px(fa, ex2, ey2, flat);
      }
    }
    if (v === 'mage' && !col) {
      var tl = p.tilt || 0, top = 4 + (p.staff || 0) + oy, sx = hdx;
      line(fa, sx + tl, top, sx - tl, 22, S.staff[1]);
      line(fa, sx + tl + 1, top + 2, sx - tl + 1, 21, S.staff[0]);
      // gnarled claw holding the orb
      px(fa, sx + tl - 1, top, S.staff[2]); px(fa, sx + tl + 1, top, S.staff[2]); px(fa, sx + tl - 1, top - 1, S.staff[3]); px(fa, sx + tl + 1, top - 1, S.staff[3]);
      var oxo = sx + tl, oyo = top - 2, gl = p.glow || 0;
      px(fa, oxo, oyo, S.orb[3]); px(fa, oxo - 1, oyo, S.orb[1]); px(fa, oxo + 1, oyo, S.orb[2]); px(fa, oxo, oyo - 1, S.orb[2]); px(fa, oxo, oyo + 1, S.orb[1]);
      if (gl === 1) { px(fa, oxo - 1, oyo - 1, S.orb[1]); px(fa, oxo + 1, oyo - 1, S.orb[1]); }
    }
    over(back, fa, BONE.d);
    outline(back, OL);
    blit(b, back, 0, 0);
    if (p.smear) { // white crescent sword trail sweeping over the head
      var sm = [[4, 3], [5, 2], [6, 2], [7, 1], [8, 1], [9, 1], [10, 2], [11, 2], [12, 3], [13, 4], [14, 5], [14, 6], [14, 7], [14, 8], [14, 9], [14, 10]];
      for (var q = 0; q < sm.length; q++) {
        px(b, sm[q][0], sm[q][1], q < 3 ? '#e8eeff' : '#ffffff', q < 3 ? 0.6 : 0.95);
        if (q > 4 && q < 13 && !A(b, sm[q][0] - 1, sm[q][1] + 1)) px(b, sm[q][0] - 1, sm[q][1] + 1, '#fff1c8', 0.6);
      }
    }
    if (v === 'mage' && p.glow >= 2) { // flare / released bolt
      var fx0 = R[4] + ox + (p.tilt || 0), fy0 = 4 + (p.staff || 0) + oy - 2;
      if (p.glow === 2) {
        px(b, fx0, fy0 - 2, S.orb[2]); px(b, fx0, fy0 + 2, S.orb[2]); px(b, fx0 - 2, fy0, S.orb[2]); px(b, fx0 + 2, fy0, S.orb[3]);
        px(b, fx0 + 1, fy0 - 1, S.orb[3]); px(b, fx0 - 1, fy0 - 1, S.orb[2]); px(b, fx0 + 1, fy0 + 1, S.orb[2]); px(b, fx0 - 1, fy0 + 1, S.orb[1]);
        px(b, fx0 + 3, fy0, S.orb[1], 0.8);
      } else {
        px(b, fx0 + 2, fy0, S.orb[3]); px(b, fx0 + 3, fy0, S.orb[2]); px(b, fx0 + 3, fy0 - 1, S.orb[1]); px(b, fx0 + 1, fy0 - 1, S.orb[1], 0.7);
      }
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('skeleton', {
    w: 16, h: 24, ax: 8, ay: 23,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['warrior', 'mage'],
    fps: { idle: 3, move: 8, attack: 9, die: 7 },
    draw: drawSkeleton
  });

  // ======================================================================= GOLEM (24x28) — crystal / moss
  var GOLEM = {
    crystal: { R: ['#1e1a2c', '#38324e', '#514a6c', '#6c6589', '#8c85a8', '#b0aaca'], glow: ['#8f6cd1', '#d9c4ff', '#ffffff'],
      cry: ['#3e2670', '#6a47a8', '#9f80e0', '#d4c0ff', '#ffffff'] },
    moss: { R: ['#1b1f25', '#33393f', '#4b5357', '#666e70', '#848c8b', '#a7aeab'], glow: ['#2fbf7f', '#8dffcb', '#ffffff'],
      moss: ['#1a4434', '#245a40', '#337450', '#4c9061', '#74b46e', '#a8d878'], flower: ['#c4648e', '#ffd6e8'] }
  };
  // shaded, textured boulder (superellipse); light from top-left
  function rock(b, cx, cy, rx, ry, R, seed, pw) {
    pw = pw || 2.6;
    function ins(x, y) { var dx = Math.abs((x + 0.5 - cx) / rx), dy = Math.abs((y + 0.5 - cy) / ry); return Math.pow(dx, pw) + Math.pow(dy, pw) <= 1; }
    for (var y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!ins(x, y)) continue;
      var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, l = -0.55 * nx - 0.8 * ny;
      var k = l > 0.6 ? 4 : l > 0.15 ? 3 : l > -0.35 ? 2 : 1;
      if (!ins(x, y - 1) && l > -0.2) k = Math.min(5, k + 1);
      if (!ins(x + 1, y) || !ins(x, y + 1)) k = Math.min(k, 1);
      var h = hash(x, y, seed);
      if (h < 0.1 && k > 1) k--; else if (h > 0.93 && k < 4) k++;
      px(b, x, y, R[k]);
    }
    return ins;
  }
  function crack(b, pts, c, c2) {
    for (var i = 0; i + 3 < pts.length; i += 2) line(b, pts[i], pts[i + 1], pts[i + 2], pts[i + 3], c);
    if (c2) for (var j = 0; j + 1 < pts.length; j += 2) px(b, pts[j] + 1, pts[j + 1], c2);
  }
  var GOLEM_POSE = {
    // t: torso offset [x,y]; h: head [x,y]; aB/aF: fist centre; lB/lF: foot lift; core: glow level
    idle: [{ t: [0, 0], h: [0, 0], aB: [4, 19.5], aF: [20, 19.5], lB: 0, lF: 0, core: 1 },
           { t: [0, 1], h: [0, 1], aB: [4, 20.5], aF: [20, 20.5], lB: 0, lF: 0, core: 2 }],
    move: [{ t: [0, 0], h: [0, 0], aB: [5, 19], aF: [19.5, 20], lB: 3, lF: 0, core: 1, lean: 0 },
           { t: [1, 1], h: [1, 1], aB: [5, 20.5], aF: [20, 20.5], lB: 0, lF: 0, core: 2, dust: 'B' },
           { t: [0, 0], h: [0, 0], aB: [4, 20], aF: [20, 19], lB: 0, lF: 3, core: 1 },
           { t: [-1, 1], h: [-1, 1], aB: [4, 20.5], aF: [19.5, 20.5], lB: 0, lF: 0, core: 2, dust: 'F' }],
    attack: [{ t: [-1, 1], h: [-1, 2], aB: [7, 4.4], aF: [18, 4], lB: 0, lF: 0, core: 2, up: 1 },
             { t: [1, 1], h: [1, 2], aB: [14, 11], aF: [19, 10], lB: 0, lF: 0, core: 2, motion: 1 },
             { t: [1, 3], h: [2, 4], aB: [14.5, 23], aF: [19.5, 23], lB: 0, lF: 0, core: 3, slam: 1 }],
    hurt: [{ t: [-1, 0], h: [-2, 0], aB: [3.8, 18], aF: [19, 19], lB: 0, lF: 0, core: 0 }],
    die: [{ t: [0, 0], h: [0, 1], aB: [4, 20], aF: [20, 20], lB: 0, lF: 0, core: 3, cracks: 1 },
          { t: [0, 2], h: [-1, 5], aB: [3.9, 22], aF: [20.1, 22], lB: 0, lF: 0, core: 1, cracks: 2 }]
  };
  function golemRubble(b, G, v, t) {
    var lay = mk(24, 28);
    var rocks = [[5, 24, 3.2, 2.6], [12, 24.5, 4.2, 2.8], [19, 24, 3.4, 2.6], [9, 21.5, 2.8, 2.2], [15.5, 21.5, 2.9, 2.3], [12, 19 + t, 2.4, 2]];
    for (var i = 0; i < rocks.length; i++) { var L = mk(24, 28); rock(L, rocks[i][0], rocks[i][1], rocks[i][2], rocks[i][3], G.R, 30 + i); over(lay, L, G.R[0]); }
    // dead core shard on top
    px(lay, 12, 18 + t, G.glow[0]); px(lay, 12, 17 + t, mix(G.glow[0], G.R[2], 0.5));
    if (v === 'crystal') { spr(lay, ['.W', 'LM', 'MD'], { W: G.cry[3], L: G.cry[2], M: G.cry[1], D: G.cry[0] }, 17, 19); spr(lay, ['W.', 'LD'], { W: G.cry[2], L: G.cry[1], D: G.cry[0] }, 5, 21); }
    else { spr(lay, ['.ab.', 'abcb'], { a: G.moss[1], b: G.moss[2], c: G.moss[3] }, 10, 20 + t - 2); spr(lay, ['ab', 'bc'], { a: G.moss[2], b: G.moss[3], c: G.moss[4] }, 4, 22); }
    outline(lay, OL);
    blit(b, lay, 0, 0);
  }
  function drawGolem(v, anim, i) {
    var G = GOLEM[v], R = G.R, b = mk(24, 28);
    if (anim === 'die' && i >= 2) {
      golemRubble(b, G, v, i - 2);
      if (i === 2) cloud(b, [[6, 18, 2.6], [12, 15, 3], [18, 18, 2.6], [9, 21, 2.2], [15, 21, 2.2]], ['#2a2438', '#4a4560', '#6a6684', '#8e8aa8', '#b8b4cc'], 0.75);
      if (i === 3) cloud(b, [[4, 16, 2], [12, 12, 2.4], [20, 15, 2]], ['#2a2438', '#4a4560', '#6a6684', '#8e8aa8', '#b8b4cc'], 0.5, false);
      return b;
    }
    var P = GOLEM_POSE[anim][i];
    var tx = P.t[0], ty = P.t[1];
    var back = mk(24, 28), body = mk(24, 28), front = mk(24, 28), L;
    // legs (stumps)
    var lB = mk(24, 28); rock(lB, 9 + tx * 0.5, 23.5 - P.lB, 2.6, 3.4, R, 3, 3); over(back, lB, R[0]);
    var lF = mk(24, 28); rock(lF, 15 + tx * 0.5, 23.5 - P.lF, 2.8, 3.4, R, 4, 3);
    // back arm: shoulder + fist (drawn behind the torso)
    var aB = mk(24, 28);
    var RB = [R[0], R[1], R[1], R[2], R[3], R[4]];
    rock(aB, 5.6 + tx, 11 + ty, 3, 3.4, RB, 5);
    rock(aB, (5.6 + tx + P.aB[0]) / 2, (11 + ty + P.aB[1]) / 2, 2.2, P.up ? 2.2 : 3, RB, 6);
    rock(aB, P.aB[0], P.aB[1], 2.9, 3.1, RB, 7);
    over(back, aB, R[0]);
    // torso
    var tor = mk(24, 28);
    rock(tor, 12 + tx, 13.5 + ty, 7.2, 6.6, R, 9, 2.4);
    // core: glowing crystal in the chest
    var cx = 13 + tx, cy = 13 + ty, gl = P.core;
    if (gl > 0) {
      spr(tor, ['.a.', 'abc', 'bcb', '.b.'], { a: G.glow[gl >= 2 ? 1 : 0], b: G.glow[0], c: G.glow[gl >= 2 ? 2 : 1] }, cx - 1, cy - 1);
      if (gl >= 3) { px(tor, cx - 2, cy + 1, G.glow[0]); px(tor, cx + 2, cy + 1, G.glow[0]); px(tor, cx, cy - 2, G.glow[1]); }
    } else spr(tor, ['.a.', 'aba', '.a.'], { a: R[0], b: G.glow[0] }, cx - 1, cy);
    crack(tor, [cx - 3, cy - 4, cx - 2, cy - 2, cx - 3, cy], R[1]);
    crack(tor, [7 + tx, 16 + ty, 9 + tx, 17 + ty], R[1]);
    if (P.cracks) {
      crack(tor, [cx + 1, cy - 2, cx + 3, cy - 5, cx + 5, cy - 6], G.glow[P.cracks > 1 ? 0 : 1]);
      crack(tor, [cx - 1, cy + 2, cx - 4, cy + 4, cx - 6, cy + 4], G.glow[0]);
      if (P.cracks > 1) crack(tor, [cx + 2, cy + 1, cx + 5, cy + 3, cx + 6, cy + 6], G.glow[0]);
    }
    over(back, tor, R[0]);
    // head sunk between the shoulders, glowing eyes facing right
    var hd = mk(24, 28), hx = 13.5 + P.h[0], hy = 6.2 + P.h[1];
    rock(hd, hx, hy, 3.6, 3, R, 11, 2.2);
    var ex = Math.round(hx), ey = Math.round(hy);
    rect(hd, ex - 2, ey - 2, 6, 1, R[4]); // heavy brow catching the light
    if (anim === 'hurt' || (anim === 'die' && i === 1)) { px(hd, ex, ey, R[0]); px(hd, ex + 1, ey, R[0]); px(hd, ex + 3, ey, R[0]); }
    else { rect(hd, ex - 1, ey - 1, 5, 1, R[1]); px(hd, ex, ey, G.glow[2]); px(hd, ex + 1, ey, G.glow[1]); px(hd, ex + 3, ey, G.glow[1]); px(hd, ex - 1, ey, G.glow[0]); }
    if (v === 'crystal') spr(hd, ['..W', '.LM', 'LMD', 'MD.'], { W: G.cry[4], L: G.cry[3], M: G.cry[2], D: G.cry[1] }, ex - 3, ey - 5);
    over(back, hd, R[0]);
    over(back, lF, R[0]);
    // front arm: shoulder, forearm, big fist
    var aF = mk(24, 28);
    rock(aF, 18.8 + tx, 11 + ty, 3.2, 3.5, R, 13);
    if (!P.up) rock(aF, (18.8 + tx + P.aF[0]) / 2 + 0.5, (11 + ty + P.aF[1]) / 2, 2.4, 3, R, 14);
    else rock(aF, (18.8 + tx + P.aF[0]) / 2, (11 + ty + P.aF[1]) / 2, 2.4, 2.4, R, 14);
    rock(aF, P.aF[0], P.aF[1], 3, 3.3, R, 15);
    // knuckles
    var fx = Math.round(P.aF[0]), fy = Math.round(P.aF[1]);
    px(aF, fx + 1, fy - 1, R[1]); px(aF, fx + 1, fy + 1, R[1]);
    over(back, aF, R[0]);
    // variant growths
    if (v === 'crystal') {
      var C = G.cry, cp = { W: C[4], L: C[3], M: C[2], D: C[1], K: C[0] };
      spr(back, ['..W.', '.LMD', 'LMMD', 'MMDK'], cp, Math.round(2 + tx), Math.round(6 + ty));
      spr(back, ['.W..', 'LM.W', 'LMLM', 'MDMD'], cp, Math.round(5 + tx), Math.round(4 + ty));
      spr(back, ['W.', 'MD', 'DK'], cp, Math.round(19 + tx), Math.round(6 + ty));
      spr(back, ['.L', 'MD'], cp, Math.round(5 + tx), Math.round(16 + ty));
      spr(back, ['W', 'D'], cp, Math.round(8 + tx), Math.round(18 + ty));
    } else {
      var Mo = G.moss, mp = { a: Mo[1], b: Mo[2], c: Mo[3], d: Mo[4], e: Mo[5], f: G.flower[0], g: G.flower[1] };
      spr(back, ['....dde...', '..cdddcd..', '.bccbccdc.', 'ab.bab.bb.', 'a...a...a.'], mp, Math.round(9 + P.h[0]), Math.round(1 + P.h[1]));
      spr(back, ['.dd.', 'cdcd', 'b.cb', 'a..a'], mp, Math.round(4 + tx), Math.round(7 + ty));
      spr(back, ['.de', 'cdc', 'b.a'], mp, Math.round(17 + tx), Math.round(7 + ty));
      px(back, Math.round(11 + P.h[0]), Math.round(1 + P.h[1]), G.flower[1]); px(back, Math.round(12 + P.h[0]), Math.round(1 + P.h[1]), G.flower[0]);
      spr(back, ['.c', 'ba', 'a.'], mp, Math.round(6 + tx), Math.round(17 + ty));
    }
    outline(back, OL);
    blit(b, back, 0, 0);
    // dust & impact
    var dustP = ['#3a3450', '#534a6d', '#6e648f', '#8c81ac', '#b0a8c8'];
    if (P.dust === 'B') cloud(b, [[6, 25.5, 1.5], [11.5, 26, 1.3]], dustP, 0.7, false);
    if (P.dust === 'F') cloud(b, [[13, 26, 1.4], [19, 25.5, 1.5]], dustP, 0.7, false);
    if (P.motion) { line(b, 21, 3, 23, 6, '#ffffff', 0.7); line(b, 16, 2, 18, 4, '#ffffff', 0.5); }
    if (P.slam) {
      cloud(b, [[12.5, 25.2, 1.8], [22, 24.8, 1.5], [17.5, 25.6, 1.4]], dustP, 0.75, false);
      px(b, 13, 19, R[3]); px(b, 22, 17, R[4]); px(b, 21, 16, R[3]); px(b, 11, 21, R[4]); // flying debris
      px(b, 16, 18, '#ffffff'); px(b, 17, 17, '#fff1c8', 0.8);
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('golem', {
    w: 24, h: 28, ax: 12, ay: 27,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 5 },
    variants: ['crystal', 'moss'],
    fps: { idle: 2, move: 5, attack: 6, die: 6 },
    draw: drawGolem
  });

  // ======================================================================= HEXMAGE (16x28) — rogue wizard: violet / emerald / crimson
  var HEX = {
    violet: { R: ['#140d22', '#2a1d48', '#3e2b66', '#563f88', '#7259aa'], glow: ['#8f6cd1', '#d9c4ff', '#ffffff'], void: '#07040d' },
    emerald: { R: ['#0b1614', '#15332b', '#20493d', '#2d6150', '#3e7d68'], glow: ['#2fbf7f', '#8dffcb', '#ffffff'], void: '#030a08' },
    crimson: { R: ['#170810', '#38101f', '#541a2e', '#72253e', '#953452'], glow: ['#c44a3a', '#ffa060', '#fff1c8'], void: '#0a0306' }
  };
  var HEX_TRIM = ['#5a4424', '#9c7a3a', '#e0b860'];
  var HEX_SKIN = ['#4a4562', '#8e88a8', '#c9c4dc'];
  var HEX_HOOD = [
    '...........',
    'dd.........',
    '.dmd.......',
    '..dmmdd....',
    '..dmlmmd...',
    '.dmllmmmd..',
    '.dmlllmvvd.',
    'dmlllmvvvvd',
    'dmlllmvvvvd',
    'dmmllmmvvvd',
    '.dmmmmmmdd.'
  ];
  function hexRobe(b, P, top, bot, sway, phase, flare) {
    var R = P.R;
    for (var y = top; y <= bot; y++) {
      var t = (y - top) / (bot - top);
      var xl = 3.6 - t * 2.2 + sway * t * t - flare * t, xr = 12.2 + t * 1.6 + sway * t * t * 0.6;
      var x0 = Math.max(1, Math.round(xl)), x1 = Math.min(14, Math.round(xr));
      for (var x = x0; x <= x1; x++) {
        if (y >= bot - 1) { // tattered hem
          var m = (x + phase) % 3;
          if (y === bot && m !== 1) continue;
          if (y === bot - 1 && m === 0 && x !== x0 && x !== x1) continue;
        }
        var k = x <= x0 + 1 ? 3 : x >= x1 - 1 ? 1 : 2;
        if (x === x0 && y < top + 3) k = 3;
        if (((x - x0) === 4 || (x - x0) === 2 && t > 0.5) && t > 0.25) k = Math.max(1, k - 1); // folds
        px(b, x, y, R[k]);
      }
      // front opening trim (toward the facing side)
      var fx = Math.round(xr - 2.5 - t);
      if (y > top + 1 && y < bot - 1) px(b, fx, y, t > 0.5 ? HEX_TRIM[1] : HEX_TRIM[0]);
    }
  }
  var HEX_POSE = {
    idle: [{ by: 0, sway: 0, ph: 0, feet: [0, 0], arm: 'rest' }, { by: 1, sway: -1, ph: 1, feet: [0, 0], arm: 'rest' }],
    move: [{ by: 1, sway: -1, ph: 0, feet: [-2, 2], arm: 'rest' }, { by: 0, sway: 0, ph: 1, feet: [0, 0], arm: 'rest', lift: 1 },
           { by: 1, sway: 1, ph: 2, feet: [2, -2], arm: 'rest' }, { by: 0, sway: 0, ph: 0, feet: [0, 0], arm: 'rest', lift: 2 }],
    attack: [{ by: 0, sway: 0, ph: 0, feet: [-1, 1], arm: 'charge', glow: 1 }, { by: 0, sway: -1, ph: 1, feet: [-1, 2], arm: 'orb', glow: 2 },
             { by: 0, sway: -2, ph: 2, feet: [-1, 2], arm: 'thrust', glow: 3, flare: 1 }],
    hurt: [{ by: 0, sway: 1, ph: 1, feet: [0, 0], arm: 'flinch', dx: -1 }],
    die: [{ by: 0, sway: 1, ph: 1, feet: [0, 0], arm: 'flinch', dx: -1, dead: 1 }, { by: 5, sway: 0, ph: 2, feet: null, arm: 'limp', dead: 2 }]
  };
  function hexPile(b, v, P, t) {
    var lay = mk(16, 28), R = P.R;
    spr(lay, ['....dmmd....', '..dmmllmmd..', '.dmllmmmmmd.', 'dmmlmmmmmmmd', 'd.dm.mm.dm.d'], { d: R[1], m: R[2], l: R[3] }, 2, 21 + t);
    spr(lay, ['.dd..', 'dmld.', 'dmmvd', '.ddd.'], { d: R[1], m: R[2], l: R[3], v: P.void }, 6, 18 + t);
    line(lay, 1, 25, 13, 22, WOOD[2]); px(lay, 14, 22, P.glow[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
  }
  function drawHex(v, anim, i) {
    var P = HEX[v], R = P.R, b = mk(16, 28);
    if (anim === 'die' && i >= 2) {
      hexPile(b, v, P, 0);
      if (i === 2) { var pf = deathPuff(1, null); blit(b, pf, 0, 8); px(b, 9, 17, P.glow[1]); px(b, 11, 17, P.glow[1]); }
      else { var pf2 = deathPuff(3); blit(b, pf2, 0, 6); fade(b, 1); }
      return b;
    }
    var p = HEX_POSE[anim][i], dx = p.dx || 0, by = p.by, dead = p.dead || 0;
    var lay = mk(16, 28);
    // feet (dark pointed boots under the hem)
    if (p.feet) {
      var fy = 26 - (p.lift === 1 ? 1 : 0);
      spr(lay, ['bb.', 'bbb'], { b: R[1] }, 6 + p.feet[0] + dx, 25);
      spr(lay, ['bb.', 'bbb'], { b: R[2] }, 8 + p.feet[1] + dx, fy - 1 + (p.lift === 2 ? -1 : 0) + (p.lift === 1 ? 1 : 0));
    }
    // back sleeve + staff hand
    var stx = 2;
    // robe
    var robe = mk(16, 28);
    hexRobe(robe, P, 10 + by + (dead === 2 ? 0 : 0), dead === 2 ? 25 : 25, p.sway, p.ph, p.flare || 0);
    // sash with a hanging rune charm
    var sy = 15 + by;
    for (var x = 4; x <= 12; x++) if (A(robe, x, sy)) { px(robe, x, sy, R[0]); }
    px(robe, 10, sy, HEX_TRIM[2]); px(robe, 10, sy + 1, HEX_TRIM[1]); px(robe, 10, sy + 2, P.glow[i % 2 ? 1 : 0]);
    if (dx) robe = shift(robe, dx, 0);
    over(lay, robe, R[0]);
    // hood
    var hood = mk(16, 28);
    spr(hood, HEX_HOOD, { d: R[1], m: R[2], l: R[3], v: P.void }, 3 + dx, 0 + by);
    if (p.flare) { clr(hood, 3 + dx, 1 + by); px(hood, 2 + dx, 2 + by, R[1]); px(hood, 1 + dx, 2 + by, R[1]); } // hood tip whipped back by the cast
    // glowing eyes in the void
    var ex = 10 + dx, ey = 7 + by, G = P.glow;
    if (anim === 'hurt' || dead) { px(hood, ex, ey + 1, G[0]); px(hood, ex + 2, ey + 1, G[0]); }
    else {
      px(hood, ex, ey, G[2]); px(hood, ex + 2, ey, G[1]);
      if (p.glow >= 1) { px(hood, ex - 1, ey, G[0]); px(hood, ex + 3, ey, G[0]); }
      px(hood, ex + 1, ey + 2, P.R[0]);
    }
    over(lay, hood, R[0]);
    // staff (gnarled wood, glowing crystal) in the back hand
    var stf = mk(16, 28), sTop = 3 + by + (p.arm === 'charge' ? -1 : 0);
    if (dead !== 2) {
      line(stf, stx, sTop + 2, stx, 26, WOOD[2]);
      px(stf, stx, sTop + 6, WOOD[3]); px(stf, stx, sTop + 12, WOOD[3]); px(stf, stx, 20, WOOD[1]);
      px(stf, stx - 1, sTop + 1, WOOD[2]); px(stf, stx + 1, sTop + 1, WOOD[2]); px(stf, stx - 1, sTop, WOOD[3]); px(stf, stx + 1, sTop, WOOD[3]);
      px(stf, stx, sTop, G[(p.glow || 0) >= 1 ? 2 : 1]); px(stf, stx, sTop - 1, G[1]); px(stf, stx, sTop + 1, G[0]);
      // back hand gripping it
      spr(stf, ['ss', 'Ss'], { s: HEX_SKIN[1], S: HEX_SKIN[2] }, stx, 14 + by);
      over(lay, stf, R[0]);
    }
    // front arm: sleeve + gaunt hand (pose dependent)
    var arm = mk(16, 28), sh = [11 + dx, 11 + by], hd;
    if (p.arm === 'rest') hd = [12 + dx, 16 + by];
    else if (p.arm === 'charge') hd = [11 + dx, 7 + by];
    else if (p.arm === 'orb') hd = [12 + dx, 12 + by];
    else if (p.arm === 'thrust') hd = [14 + dx, 12 + by];
    else if (p.arm === 'flinch') hd = [12 + dx, 9 + by];
    else hd = [11 + dx, 18 + by];
    if (p.arm === 'rest' || p.arm === 'limp') { // hanging bell sleeve, clawed fingers peeking out
      spr(arm, ['.lm.', '.lmm', '.lmm', 'llmmd', 'lmmmd', 'ddddd', '.sSs.', '.s.s.'], { l: R[4], m: R[3], d: R[1], s: HEX_SKIN[1], S: HEX_SKIN[2] }, 9 + dx, 10 + by + (p.arm === 'limp' ? 2 : 0));
    } else {
      line(arm, sh[0], sh[1], hd[0] - 1, hd[1], R[3]); line(arm, sh[0] + 1, sh[1], hd[0], hd[1] - (hd[1] > sh[1] ? 1 : -1), R[4]);
      line(arm, sh[0] - 1, sh[1] + 1, hd[0] - 1, hd[1] + 1, R[2]);
      px(arm, hd[0] - 1, hd[1], R[1]);
      px(arm, hd[0], hd[1], HEX_SKIN[2]); px(arm, hd[0] + 1, hd[1], HEX_SKIN[1]); px(arm, hd[0], hd[1] + 1, HEX_SKIN[1]);
      px(arm, hd[0] + 1, hd[1] - 1, HEX_SKIN[1]); px(arm, hd[0] + 2, hd[1] - 1, HEX_SKIN[0]); px(arm, hd[0] + 2, hd[1] + 1, HEX_SKIN[0]);
    }
    over(lay, arm, R[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    // spell effects (after outline: pure glow)
    if (p.glow === 1) { // motes converge into the raised hand
      var mx = hd[0], my = hd[1];
      px(b, mx + 3, my - 2, G[1]); px(b, mx - 2, my - 3, G[0]); px(b, mx + 3, my + 3, G[0]); px(b, mx + 1, my - 4, G[1]); px(b, mx + 4, my + 1, G[2]);
      px(b, mx, my - 1, G[2]); px(b, mx + 1, my - 1, G[1]);
    } else if (p.glow === 2) { // orb formed at the hand
      var ox0 = hd[0] + 2, oy0 = hd[1] - 2;
      ell(b, ox0 + 0.5, oy0 + 0.5, 2.2, 2.2, G[0]); ell(b, ox0 + 0.5, oy0 + 0.5, 1.5, 1.5, G[1]); px(b, ox0, oy0, G[2]); px(b, ox0 + 1, oy0, G[2]); px(b, ox0, oy0 - 1, G[2]);
      px(b, ox0 - 3, oy0 - 2, G[1]); px(b, ox0 + 3, oy0 - 3, G[1]); px(b, ox0 + 1, oy0 + 3, G[0]);
    } else if (p.glow === 3) { // release: bright streak leaving the frame
      line(b, hd[0] + 1, hd[1] - 1, 15, hd[1] - 1, G[1]); px(b, 15, hd[1] - 1, G[2]); px(b, 15, hd[1] - 2, G[1]); px(b, 15, hd[1], G[1]);
      px(b, hd[0] + 2, hd[1] - 3, G[0]); px(b, hd[0] + 3, hd[1] + 1, G[0]);
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('hexmage', {
    w: 16, h: 28, ax: 8, ay: 27,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['violet', 'emerald', 'crimson'],
    fps: { idle: 3, move: 7, attack: 7, die: 7 },
    draw: drawHex
  });

  // ======================================================================= WRAITH (18x24, floating; engine draws the `shadow` fx)
  var WR = { C: ['#24224a', '#3e3f78', '#5e68a8', '#8a9ad0', '#b8c8ee', '#e4ecff'], void: '#090818',
    eye: ['#2fbf7f', '#5dffb0', '#e2fff0'], claw: ['#6f78a8', '#c8d4f0', '#ffffff'] };
  var WR_HOOD = [
    '...dddd...',
    '..dmllmd..',
    '.dmllllmd.',
    '.dmlllmmmd',
    'dmlllmvvvd',
    'dmllmvvvvd',
    'dmllmvvvvd',
    'dmlmmvvvd.',
    '.dmmmvvd..',
    '..dmmdd...'
  ];
  function drawWraith(v, anim, i) {
    var b = mk(18, 24), C = WR.C;
    var bob = 0, lean = 0, ph = i * Math.PI / 2, reach = 0, arms = 'reach', fadeA = 1, maw = 0, flare = 0;
    if (anim === 'idle') { bob = [1, 0, 0, 1][i]; }
    else if (anim === 'move') { bob = [1, 0, 1, 2][i]; lean = 1; ph = i * Math.PI / 2 + 1; }
    else if (anim === 'attack') { if (i === 0) { arms = 'up'; lean = -1; bob = 0; flare = 1; } else { arms = 'lunge'; lean = 1; maw = 1; flare = 2; bob = 1; } }
    else if (anim === 'hurt') { arms = 'up'; lean = -1; }
    else if (anim === 'die') { arms = i === 0 ? 'up' : 'limp'; fadeA = [1, 0.75, 0.45, 0.2][i]; bob = [0, -1, -2, -3][i]; maw = i === 0 ? 1 : 0; }
    var solid = mk(18, 24), ghost = mk(18, 24);
    var cx = 8 + lean * 0.5;
    // cloak body: opaque shoulders, then a skirt of tattered strips fading into wisps
    for (var y = 8; y <= 23; y++) {
      var t = (y - 8) / 15;
      var hw = y < 12 ? 3.5 + (y - 8) * 0.45 : 5.3 - Math.max(0, y - 13) * 0.36;
      var off = Math.sin(ph + y * 0.55) * (t * 1.4) - t * t * 3 * (lean >= 0 ? 1 : 0.3);
      var xc = cx + off + lean * (1 - t) * 0.8;
      var x0 = Math.round(xc - hw), x1 = Math.round(xc + hw);
      if (hw < 0.6) continue;
      for (var x = x0; x <= x1; x++) {
        var stripEnd = 17 + ((x * 5 + i * 3 + 1) % 6);
        if (y > stripEnd) continue;
        var k = x <= x0 + 2 ? 3 : x >= x1 ? 1 : 2;
        if ((x - x0) === 3 && y > 10) k = 1; // fold
        if (y >= 14) px(ghost, x, y + bob, C[Math.min(4, k + 1)], Math.max(0, 1 - (y - 14) * 0.1 - (y === stripEnd ? 0.25 : 0)));
        else px(solid, x, y + bob, C[k]);
      }
    }
    // trailing wisps
    for (var w = 0; w < 3; w++) {
      var sx = cx - 2 + w * 2.5, sy = 19 + bob;
      for (var s2 = 0; s2 < 8; s2++) {
        var wx = sx - s2 * (0.9 + lean * 0.25) - w * 0.3, wy = sy + s2 * 0.55 + Math.sin(ph + s2 * 0.9 + w * 2) * 1.1;
        px(ghost, wx, wy, C[s2 < 3 ? 4 : 3], Math.max(0, 0.75 - s2 * 0.09));
        if (s2 < 3) px(ghost, wx, wy - 1, C[3], 0.5 - s2 * 0.12);
      }
    }
    // back arm (behind) + hood + front arm
    var hx = 4 + Math.round(lean * 0.8), hy = 1 + bob;
    var claws = function (L, wx, wy, dir, col) {
      if (dir === 'up') { line(L, wx, wy, wx + 1, wy - 3, col[1]); line(L, wx - 1, wy, wx - 1, wy - 3, col[1]); line(L, wx + 1, wy, wx + 3, wy - 2, col[1]); px(L, wx + 1, wy - 4, col[0]); px(L, wx + 3, wy - 3, col[0]); return; }
      line(L, wx, wy, wx + 3, wy - 1, col[1]); line(L, wx, wy + 1, wx + 3, wy + 1, col[1]); line(L, wx, wy + 1, wx + 2, wy + 3, col[1]);
      px(L, wx + 3, wy - 1, col[2]); px(L, wx + 3, wy + 1, col[2]); px(L, wx + 2, wy + 3, col[0]);
    };
    var armB = mk(18, 24), armF = mk(18, 24);
    var shB = [hx + 3, 10 + bob], shF = [hx + 6, 10 + bob], wB, wF, maxW = 12;
    if (arms === 'reach') { wB = [hx + 8, 13 + bob]; wF = [hx + 8, 11 + bob]; }
    else if (arms === 'up') { wB = [hx + 4, 6 + bob]; wF = [hx + 8, 5 + bob]; }
    else if (arms === 'lunge') { wB = [hx + 8, 12 + bob]; wF = [hx + 9, 10 + bob]; }
    else { wB = [hx + 5, 15 + bob]; wF = [hx + 8, 15 + bob]; }
    wF[0] = Math.min(wF[0], maxW); wB[0] = Math.min(wB[0], maxW);
    line(armB, shB[0], shB[1], wB[0], wB[1], C[1]); line(armB, shB[0], shB[1] + 1, wB[0], wB[1] + 1, C[0]);
    if (arms !== 'limp') claws(armB, wB[0] + 1, wB[1], arms === 'up' ? 'up' : 'fwd', WR.claw);
    over(solid, armB, C[0]);
    var hood = mk(18, 24);
    spr(hood, WR_HOOD, { d: C[1], m: C[2], l: C[3 + (flare ? 1 : 0)], v: WR.void }, hx, hy);
    // eyes (+ screaming maw)
    var ex = hx + 6, ey = hy + 5;
    if (anim === 'hurt') { px(hood, ex, ey, WR.eye[0]); px(hood, ex + 2, ey, WR.eye[0]); }
    else if (anim !== 'die' || i < 3) {
      px(hood, ex, ey, WR.eye[2]); px(hood, ex + 2, ey, WR.eye[1]);
      if (flare) { px(hood, ex - 1, ey, WR.eye[0]); px(hood, ex + 2, ey - 1, WR.eye[0]); }
    }
    if (maw) { px(hood, ex + 1, ey + 2, '#000000'); px(hood, ex + 1, ey + 3, '#000000'); px(hood, ex, ey + 2, WR.void); px(hood, ex + 2, ey + 2, WR.claw[1]); }
    over(solid, hood, C[0]);
    line(armF, shF[0], shF[1], wF[0], wF[1], C[3]); line(armF, shF[0], shF[1] + 1, wF[0], wF[1] + 1, C[2]);
    px(armF, wF[0], wF[1] + 1, C[1]);
    if (arms !== 'limp') claws(armF, wF[0] + 1, wF[1], arms === 'up' ? 'up' : 'fwd', WR.claw);
    over(solid, armF, C[0]);
    // outline the union of torso + dense skirt; the outline fades out with the skirt
    var uni = clone(solid);
    eachPx(ghost, function (x, y, r, g, bl, a) { if (a > 110) px(uni, x, y, '#ffffff'); });
    outline(uni, OL);
    var oc = rgba(OL);
    eachPx(uni, function (x, y, r, g, bl) {
      if (r !== oc[0] || g !== oc[1] || bl !== oc[2] || A(solid, x, y) || A(ghost, x, y)) return;
      var fy = y - (14 + bob);
      px(b, x, y, OL, fy <= 0 ? 1 : Math.max(0, 0.85 - fy * 0.22));
    });
    blit(b, ghost, 0, 0);
    blit(b, solid, 0, 0);
    if (arms === 'lunge') { line(b, 1, 9, 4, 9, C[4], 0.45); line(b, 0, 12, 3, 12, C[4], 0.35); }
    if (fadeA < 1) fade(b, fadeA);
    if (anim === 'die' && i >= 2) { // soul wisps rising away
      px(b, 8, 2 + i, WR.eye[1]); px(b, 10, 1 + i, WR.eye[2], 0.8); px(b, 6, 4 + i, C[4], 0.6); px(b, 12, 5, C[4], 0.5);
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('wraith', {
    w: 18, h: 24, ax: 9, ay: 23,
    anims: { idle: 4, move: 4, attack: 2, hurt: 1, die: 4 },
    variants: ['default'],
    fps: { idle: 5, move: 7, attack: 6, die: 6 },
    draw: drawWraith
  });

  // ======================================================================= VOIDEYE (16x16, floating; engine draws the `shadow` fx)
  var VE = { scl: ['#5e5886', '#9a9cc6', '#ccd2ee', '#eef2ff', '#ffffff'], vein: '#c4648e', lid: ['#24163e', '#3a2766', '#5a3f94', '#7f62bc'],
    iris: ['#3a2270', '#6a47a8', '#a98ae6', '#e4d2ff', '#ffffff'], ten: ['#2a1a4c', '#4a2f7a', '#6a47a8', '#b99aee'] };
  function drawVoideye(v, anim, i) {
    var b = mk(16, 16);
    var bob = 0, ph = i * 1.6, lidT = 0.28, lidB = 0.2, ix = 1.2, iy = 0.3, pupil = 'slit', glow = 0, dy = 0, shut = false, dim = 0;
    if (anim === 'idle') { bob = [0, 1][i]; lidT = [0.28, 0.36][i]; }
    else if (anim === 'move') { bob = [0, 1, 1, 0][i]; ph = i * Math.PI / 2; ix = 1.5; }
    else if (anim === 'attack') { pupil = i === 0 ? 'wide' : 'glow'; glow = i + 1; lidT = 0.12; lidB = 0.1; ix = 1.3; bob = 0; }
    else if (anim === 'hurt') { shut = true; }
    else if (anim === 'die') {
      if (i === 3) return deathPuff(3);
      dim = i + 1; ix = [-0.5, 0, 0][i]; iy = [-1.6, 0, 0][i]; pupil = 'dot'; shut = i >= 1; dy = [0, 1, 4][i];
    }
    var cx = 7.5, cy = 6.5 + bob + dy, r = 5;
    var lay = mk(16, 16);
    // tendrils (behind): hang from the lower back of the eye, sway & trail
    var ten = mk(16, 16);
    var roots = [[-3.5, 3], [-1.5, 4.2], [0.8, 4.4], [2.8, 3.4]];
    for (var k = 0; k < roots.length; k++) {
      var x0 = cx + roots[k][0], y0 = cy + roots[k][1], len = 6 - Math.abs(k - 1.5) + (dim ? -2 : 0);
      len = Math.max(2, Math.min(len, Math.floor((14 - y0) / (dim > 2 ? 0.3 : 0.85))));
      var px0 = x0, py0 = y0;
      for (var s = 1; s <= len; s++) {
        var t = s / len;
        var xx = Math.max(1, x0 - s * (anim === 'move' ? 0.6 : 0.35) + Math.sin(ph + s * 0.8 + k * 1.7) * 1.5 * t);
        var yy = y0 + s * (dim > 2 ? 0.3 : 0.85);
        line(ten, px0, py0, xx, yy, VE.ten[t > 0.75 ? 2 : 1]);
        px0 = xx; py0 = yy;
      }
      px(ten, px0, py0, VE.ten[glow ? 3 : 2]);
    }
    over(lay, ten, VE.ten[0]);
    // eyeball
    var eye = mk(16, 16);
    for (var y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (var x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (!inE(x, y, cx, cy, r, r)) continue;
      var nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r, l = -0.55 * nx - 0.75 * ny + 0.35 * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      var kk = l > 0.7 ? 4 : l > 0.35 ? 3 : l > -0.05 ? 2 : l > -0.5 ? 1 : 0;
      var col = VE.scl[kk];
      if (glow === 2 && kk < 3) col = mix(col, '#8f6cd1', 0.35);
      if (dim) col = mix(col, '#4a3b6d', 0.25 * dim);
      px(eye, x, y, col);
    }
    // veins creeping in from the rim
    var vc = dim ? '#8c3a62' : VE.vein;
    pline(eye, [cx - 4, cy + 2, cx - 3, cy + 1, cx - 2, cy + 1], vc);
    pline(eye, [cx - 1, cy + 4, cx - 1, cy + 3, cx, cy + 2], vc);
    pline(eye, [cx + 1, cy - 4, cx + 1, cy - 3], vc);
    if (!shut) {
      // iris + pupil, looking right
      var icx = cx + ix, icy = cy + iy, ir = glow ? 2.9 : 2.5;
      for (y = Math.floor(icy - ir - 1); y <= icy + ir + 1; y++) for (x = Math.floor(icx - ir - 1); x <= icx + ir + 1; x++) {
        if (!inE(x, y, icx, icy, ir, ir) || !inE(x, y, cx, cy, r - 0.4, r - 0.4)) continue;
        var d = Math.hypot(x + 0.5 - icx, y + 0.5 - icy) / ir;
        var ic = d > 0.8 ? 0 : d > 0.5 ? 1 : 2;
        if (glow === 2) ic = d > 0.8 ? 1 : d > 0.45 ? 3 : 4;
        else if (glow === 1) ic = d > 0.8 ? 1 : 2;
        px(eye, x, y, VE.iris[ic]);
      }
      var pxc = Math.floor(icx), pyc = Math.floor(icy);
      if (pupil === 'slit') { px(eye, pxc, pyc - 1, OL); px(eye, pxc, pyc, OL); px(eye, pxc, pyc + 1, OL); }
      else if (pupil === 'wide') { rect(eye, pxc - 1, pyc - 1, 3, 3, OL); px(eye, pxc - 1, pyc - 1, VE.iris[1]); px(eye, pxc + 1, pyc + 1, VE.iris[1]); }
      else if (pupil === 'glow') { px(eye, pxc, pyc, '#ffffff'); }
      else if (pupil === 'dot') { px(eye, pxc, pyc, OL); }
      if (pupil !== 'glow') px(eye, pxc - 1, pyc - 1 - (pupil === 'wide' ? 1 : 0), '#ffffff'); // glint
    }
    // fleshy lids: a scowling upper lid (droops at the corners) and a small lower lid; shut when hurt / dying
    var tl = glow ? 0.78 : lidT > 0.3 ? 0.36 : 0.5;
    for (y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (!inE(x, y, cx, cy, r + 0.35, r + 0.35)) continue;
      var ddx = (x + 0.5 - cx) / r, yy2 = y + 0.5;
      var topE = shut ? cy + 0.6 : cy - r * tl + 1.5 * ddx * ddx, botE = shut ? cy + 0.6 : cy + r * 0.8 - 1.1 * ddx * ddx;
      var lidTop = yy2 < topE, lidBot = yy2 > botE;
      if (!lidTop && !lidBot) continue;
      var edge = lidTop ? yy2 + 1 >= topE : yy2 - 1 <= botE;
      var nl = -0.55 * (x + 0.5 - cx) / r - 0.75 * (y + 0.5 - cy) / r;
      px(eye, x, y, edge ? VE.lid[3] : VE.lid[nl > 0.35 ? 2 : nl > -0.3 ? 1 : 0]);
    }
    if (shut) for (x = Math.floor(cx - r + 1); x <= cx + r - 1; x++) px(eye, x, Math.floor(cy + 0.6), VE.lid[0]);
    over(lay, eye, VE.lid[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (glow === 2) { // charged: rays of light
      px(b, Math.round(cx + r + 2), Math.round(cy), VE.iris[3]); px(b, Math.round(cx + r + 1), Math.round(cy - 3), VE.iris[2], 0.8); px(b, Math.round(cx + r + 1), Math.round(cy + 3), VE.iris[2], 0.8);
      px(b, Math.round(cx), Math.round(cy - r - 2), VE.iris[2], 0.7);
    }
    if (anim === 'die' && i === 2) blit(b, deathPuff(0), 0, 2);
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('voideye', {
    w: 16, h: 16, ax: 8, ay: 15,
    anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 },
    variants: ['default'],
    fps: { idle: 3, move: 7, attack: 5, die: 7 },
    draw: drawVoideye
  });

  // ======================================================================= ARCHON (48x48) — Vesper, the Umbral Archon (boss, floating)
  var ARC = {
    R: ['#0b0713', '#160e26', '#22173a', '#30214f', '#433069', '#5c468c', '#8068b4'],
    mask: ['#56618f', '#8f9cc8', '#c8d4f0', '#e8eeff', '#ffffff'],
    crown: ['#120c1e', '#2a2142', '#43365f', '#6b5a92'],
    glow: ['#6a47a8', '#b99aee', '#e4d2ff', '#ffffff'],
    hand: ['#3e3858', '#7a7499', '#b4b0cc', '#e4e2f0'],
    void: '#06030c'
  };
  // filled polygon (pixel centres)
  function poly(b, pts, col, al) {
    var minY = 1e9, maxY = -1e9, i, n = pts.length / 2;
    for (i = 0; i < n; i++) { minY = Math.min(minY, pts[i * 2 + 1]); maxY = Math.max(maxY, pts[i * 2 + 1]); }
    for (var y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      var yc = y + 0.5, xs = [];
      for (i = 0; i < n; i++) {
        var x0 = pts[i * 2], y0 = pts[i * 2 + 1], x1 = pts[((i + 1) % n) * 2], y1 = pts[((i + 1) % n) * 2 + 1];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + (yc - y0) / (y1 - y0) * (x1 - x0));
      }
      xs.sort(function (a, c) { return a - c; });
      for (var k = 0; k + 1 < xs.length; k += 2)
        for (var x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) px(b, x, y, typeof col === 'function' ? col(x, y) : col, al);
    }
  }
  var ARC_CROWN = [
    '.......W.......',
    '.......G.......',
    '..W....k....W..',
    '..G...kmk...G..',
    '..k...kmk...k..',
    'W.kk..kmk..kk.W',
    'G.km.kkmkk.km.G',
    'kkkmkkmGmkkmkkk',
    'kmmmmmmCmmmmmmk',
    '.kkkkkkkkkkkkk.'
  ];
  function arcMask(b, mx, my, crackLvl, eyes, shatter) {
    var M = ARC.mask, G = ARC.glow, rx = 5, ry = 6.3, x, y;
    for (y = Math.floor(my - ry - 1); y <= my + ry + 1; y++) for (x = Math.floor(mx - rx - 1); x <= mx + rx + 1; x++) {
      if (!inE(x, y, mx, my, rx, ry)) continue;
      if (shatter && hash(x, y, 77) < 0.4) continue;
      var nx = (x + 0.5 - mx) / rx, ny = (y + 0.5 - my) / ry, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      var l = -0.5 * nx - 0.7 * ny + 0.45 * nz;
      px(b, x, y, M[l > 0.62 ? 4 : l > 0.25 ? 3 : l > -0.18 ? 2 : l > -0.55 ? 1 : 0]);
    }
    // crater dimples
    var cr = [[-2.3, -3.2, 1], [2.2, 3.4, 0.9], [-2.8, 2.4, 0.75]];
    for (var c = 0; c < cr.length; c++) {
      var ccx = mx + cr[c][0], ccy = my + cr[c][1];
      for (y = Math.floor(ccy - 2); y <= ccy + 2; y++) for (x = Math.floor(ccx - 2); x <= ccx + 2; x++)
        if (inE(x, y, ccx, ccy, cr[c][2], cr[c][2]) && A(b, x, y)) px(b, x, y, M[1]);
    }
    // slanted, scowling eye slits (inner ends low) with glowing pupils
    var ex = Math.round(mx), ey = Math.round(my - 0.6), E = ARC.void;
    spr(b, ['EE....', '.EEEE.', '..EEE.'], { E: E }, ex - 4, ey - 1);
    spr(b, ['....EE', '.EEEE.', '.EEE..'], { E: E }, ex + 1, ey - 1);
    if (eyes) {
      px(b, ex - 2, ey, G[eyes > 1 ? 3 : 2]); px(b, ex - 1, ey, G[3]); px(b, ex - 1, ey + 1, G[1]); px(b, ex - 2, ey + 1, G[0]);
      px(b, ex + 3, ey, G[3]); px(b, ex + 4, ey, G[eyes > 1 ? 3 : 2]); px(b, ex + 3, ey + 1, G[1]); px(b, ex + 2, ey + 1, G[0]);
    }
    // the crack: from the brow through the left eye down to the jaw
    var C = [mx - 1, my - ry + 0.6, mx - 2, my - 3.2, mx - 1, my - 2.2, mx - 1.5, my - 1.6];
    var C2 = [mx - 1, my + 1.5, mx, my + 2.6, mx - 0.5, my + 3.6, mx + 0.5, my + ry - 0.4];
    var cc = crackLvl > 1 ? G[2] : crackLvl ? G[0] : ARC.R[2];
    pline(b, C, cc); pline(b, C2, cc);
    if (crackLvl >= 1) { px(b, mx - 2, my - 3.2, G[1]); px(b, mx - 0.5, my + 3.6, G[1]); }
    if (crackLvl >= 2) { line(b, mx - 2, my - 3, mx - 4, my - 2, G[1]); line(b, mx, my + 2.6, mx + 3, my + 3.6, G[1]); px(b, mx + 3, my - 4, G[2]); }
  }
  function arcHand(b, wx, wy, dir, spread, curl) {
    var H = ARC.hand;
    rect(b, wx - 1, wy - 1, 3, 3, H[1]); px(b, wx - 1, wy - 1, H[2]); px(b, wx, wy - 1, H[3]);
    for (var f = 0; f < 4; f++) {
      var a = dir + (f - 1.5) * (0.28 + spread * 0.14), len = f === 0 || f === 3 ? 5 : 6;
      var xm = wx + Math.cos(a) * len * 0.5, ym = wy + Math.sin(a) * len * 0.5;
      var a2 = a + curl * (f < 2 ? -1 : 1) * 0.5;
      var x1 = xm + Math.cos(a2) * len * 0.5, y1 = ym + Math.sin(a2) * len * 0.5;
      line(b, wx, wy, xm, ym, H[2]); line(b, xm, ym, x1, y1, H[1]);
      px(b, xm, ym, H[3]); px(b, x1, y1, ARC.glow[1]);
    }
  }
  function arcParticles(b, f, n, seed, up, spreadDie) {
    for (var k = 0; k < n; k++) {
      var side = k % 2 ? 1 : -1;
      var x0 = 24 + side * (9 + hash(k, 1, seed) * (spreadDie ? 16 : 13));
      var span = 40, y = 4 + ((hash(k, 2, seed) * span - f * (up || 2.5) - k * 0.37) % span + span) % span;
      var x = x0 + Math.sin(f * 0.9 + k) * 1.2 - side * (1 - y / 44) * 2;
      if (k % 3 === 0) { rect(b, Math.round(x), Math.round(y), 2, 2, ARC.void); px(b, Math.round(x), Math.round(y), ARC.glow[0]); }
      else px(b, Math.round(x), Math.round(y), k % 3 === 1 ? ARC.glow[1] : ARC.R[6], 0.9);
    }
  }
  var ARC_POSE = {
    idle: [0, 1, 2, 3].map(function (f) { return { bob: [1, 0, 0, 1][f], ph: f, hands: 'hang', eyes: 1, lean: 0, curl: [0, 0.3, 0.5, 0.2][f] }; }),
    move: [0, 1, 2, 3].map(function (f) { return { bob: [1, 0, 1, 2][f], ph: f, hands: 'trail', eyes: 1, lean: 2, curl: 0.2 }; }),
    attack: [{ bob: 1, ph: 0, hands: 'rise', eyes: 2, lean: -1, curl: 0 }, { bob: 0, ph: 1, hands: 'gather', eyes: 2, lean: -1, orb: 1, curl: 0.4 },
             { bob: 0, ph: 2, hands: 'gather', eyes: 2, lean: 0, orb: 2, crack: 1, curl: 0.6 }, { bob: 2, ph: 3, hands: 'thrust', eyes: 2, lean: 2, orb: 3, curl: 0 }],
    hurt: [{ bob: 1, ph: 1, hands: 'rise', eyes: 1, lean: -2, crack: 1, curl: 0.8 }],
    die: [{ bob: 1, ph: 1, hands: 'rise', eyes: 2, lean: -2, crack: 2, curl: 0.8 }, { bob: 2, ph: 2, hands: 'limp', eyes: 1, lean: -1, crack: 2, dissolve: 0.35, curl: 1 },
          { bob: 3, ph: 3, hands: 'limp', eyes: 0, lean: 0, crack: 3, dissolve: 0.65, shatter: 1, curl: 1 }]
  };
  function arcCrown(b, cx, cy, tilt) {
    var lay = mk(48, 48);
    spr(lay, ARC_CROWN, { k: ARC.crown[1], m: ARC.crown[2], G: ARC.glow[1], W: ARC.glow[2], C: ARC.mask[3] }, cx, cy);
    if (tilt) { var r2 = mk(48, 48); eachPx(lay, function (x, y, r, g, bl, a) { px(r2, x, y + Math.round((x - cx - 7) * tilt * 0.22), [r, g, bl, a]); }); lay = r2; }
    over(b, lay, ARC.crown[0]);
  }
  function drawArchon(v, anim, i) {
    var b = mk(48, 48), R = ARC.R, G = ARC.glow;
    if (anim === 'die' && i >= 3) { // the void disperses; the crown clatters down
      var t = i - 3;
      cloud(b, t === 0 ? [[17, 30, 4], [24, 24, 5], [31, 30, 4], [20, 37, 3.4], [28, 37, 3.4], [24, 33, 4]] : [[14, 24, 2.6], [24, 17, 3], [34, 23, 2.6], [19, 32, 2], [29, 31, 2]],
        ['#0b0713', '#2c1f48', '#4a3577', '#7a62a8', '#b99aee'], t === 0 ? 0.9 : 0.5);
      var cr = mk(48, 48); arcCrown(cr, 16 + t * 2, 33 + t * 2, t ? 2 : 1); outline(cr, OL); blit(b, cr, 0, 0);
      px(b, 12, 45, ARC.mask[3]); px(b, 13, 45, ARC.mask[2]); px(b, 33, 45, ARC.mask[3]); px(b, 36, 46, ARC.mask[2]); px(b, 35, 46, ARC.mask[1]);
      arcParticles(b, i, t ? 10 : 18, 9, 4, true);
      return b;
    }
    var p = ARC_POSE[anim][i], bob = p.bob, lean = p.lean, ph = p.ph * Math.PI / 2, OY = 3;
    var lay = mk(48, 48);
    // broken halo ring behind the head
    var hcx = 24 + lean * 0.6, hcy = 13 + bob + OY;
    for (var y = 0; y < 31; y++) for (var x = 8; x < 40; x++) {
      var d1 = Math.hypot(x + 0.5 - hcx, y + 0.5 - hcy), ang = Math.atan2(y + 0.5 - hcy, x + 0.5 - hcx);
      if (d1 > 12.2 || d1 < 11) continue;
      if (Math.abs(ang + 0.6) < 0.12 || Math.abs(ang - 2.6) < 0.1 || Math.abs(ang + 2.2) < 0.08) continue; // cracks in the ring
      px(b, x, y, d1 > 11.7 ? '#8f6cd1' : '#d8ccff', 0.5);
    }
    // robe: broad shoulders tapering down into void tendrils
    var robe = mk(48, 48), top = 19 + bob + OY, sw = Math.sin(ph) * 0.8;
    var sx0 = 13 + lean * 0.4, sx1 = 35 + lean * 0.6;
    var waistY = 34 + bob, hemY = 40 + bob;
    poly(robe, [sx0, top + 1, sx1, top + 1, sx1 - 1, waistY, 32 + lean * 0.2 + sw, hemY, 16 - lean * 0.6 + sw, hemY, sx0 + 1, waistY], function (x, y) {
      var tt = Math.min(1, (y - top) / (hemY - top)), xl = sx0 + tt * 3 - lean * tt * 0.6, xr = sx1 - tt * 3;
      var u = (x - xl) / Math.max(1, xr - xl);
      var k = u < 0.07 ? 5 : u < 0.2 ? 4 : u > 0.86 ? 1 : 2;
      if (Math.abs(u - 0.34) < 0.025 || Math.abs(u - 0.74) < 0.025) k = 1;
      return R[k];
    });
    // void tendrils hanging from the hem
    for (var s = 0; s < 7; s++) {
      var tx = 17 + s * 2.4 - lean * 0.6 + sw, tl = Math.min(3 + ((s * 5 + p.ph * 2) % 4), 45 - hemY);
      for (var q = 0; q < tl; q++) px(robe, Math.round(tx + Math.sin(ph + s + q * 0.7) * 0.8 - q * 0.25 * lean), hemY + 1 + q, R[q > 1 ? 1 : 2]);
    }
    // the void within: a starry opening down the robe front + glowing rune stitches
    var oX = 25 + lean * 0.5;
    poly(robe, [oX - 0.5, top + 4, oX + 1.5, top + 4, oX + 3.5, hemY, oX - 2.5, hemY], ARC.void);
    var stars = [[0, 8], [1, 12], [-1, 15], [2, 18], [0, 20]];
    for (var st = 0; st < stars.length; st++) {
      var tw = (st + p.ph) % 4;
      px(robe, Math.round(oX + stars[st][0]), top + stars[st][1], tw === 0 ? '#ffffff' : tw === 1 ? G[1] : tw === 2 ? G[0] : '#c8d4f0');
    }
    for (var rr = 6; rr < 20; rr += 4) { px(robe, Math.round(oX - 2 - rr * 0.05), top + rr, G[0]); px(robe, Math.round(oX + 3 + rr * 0.05), top + rr + 2, G[0]); }
    if (p.dissolve) eachPx(robe, function (x, y, r, g, bl, a, idx) { if (y > hemY - (hemY - top) * p.dissolve && hash(x, y, 5 + i) < 0.55) robe.data[idx + 3] = 0; });
    over(lay, robe, R[0]);
    // high spiked collar
    var col = mk(48, 48);
    poly(col, [12 + lean * 0.4, top + 4, 13 + lean * 0.4, top - 5, 18 + lean * 0.4, top - 1, 30 + lean * 0.5, top - 1, 35 + lean * 0.6, top - 6, 36 + lean * 0.6, top + 4], function (x, y) { return y < top ? R[4] : R[3]; });
    px(col, 13 + Math.round(lean * 0.4), top - 5, R[6]); px(col, 35 + Math.round(lean * 0.6), top - 6, R[6]);
    over(lay, col, R[0]);
    // cowl + moon mask + crown
    var mx = 25.5 + lean * 0.7 + (p.hands === 'thrust' ? 1 : 0), my = 13 + bob + OY;
    var hood = mk(48, 48);
    for (y = Math.floor(my - 10); y <= my + 10; y++) for (x = Math.floor(mx - 11); x <= mx + 8; x++) {
      if (!inE(x, y, mx - 1.4, my + 0.2, 7.4, 8.4)) continue;
      var hn = -0.6 * (x + 0.5 - mx + 1.4) / 7.4 - 0.8 * (y + 0.5 - my - 0.2) / 8.4;
      px(hood, x, y, hn > 0.55 ? R[5] : hn > 0.15 ? R[4] : hn > -0.4 ? R[3] : R[2]);
    }
    ell(hood, mx + 0.5, my + 0.8, 5.8, 7, ARC.void);
    over(lay, hood, R[0]);
    var mk2 = mk(48, 48);
    arcMask(mk2, mx + 0.6, my + 0.8, p.crack || 0, p.eyes, p.shatter);
    over(lay, mk2, '#2c2648');
    arcCrown(lay, Math.round(mx - 8.5), Math.round(my - 15), 0);
    // bell sleeves + long clawed hands
    var hands = p.hands, hb, hf, db, df, spread = 0;
    var shB = [16 + lean * 0.4, top + 2], shF = [32 + lean * 0.6, top + 2];
    var hy = bob + OY;
    if (hands === 'hang') { hb = [11, 30 + hy]; hf = [37, 29 + hy]; db = 1.75; df = 1.35; }
    else if (hands === 'trail') { hb = [10, 29 + hy]; hf = [35, 30 + hy]; db = 2.1; df = 1.9; }
    else if (hands === 'rise') { hb = [8, 17 + hy]; hf = [41, 16 + hy]; db = -2.3; df = -0.8; spread = 1; }
    else if (hands === 'gather') { hb = [18, 25 + hy]; hf = [32, 24 + hy]; db = -0.2; df = 3.0; spread = 1; }
    else if (hands === 'thrust') { hb = [36, 24 + hy]; hf = [41, 20 + hy]; db = 0.2; df = -0.1; spread = 1; }
    else { hb = [12, 33 + hy]; hf = [36, 33 + hy]; db = 1.7; df = 1.4; }
    var sleeve = function (L, sh, h, w, cA, cB) {
      var dx = h[0] - sh[0], dy = h[1] - sh[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      var cx2 = h[0] - dx / len * 1.5, cy2 = h[1] - dy / len * 1.5;
      poly(L, [sh[0] + nx * 3, sh[1] + ny * 3, cx2 + nx * w, cy2 + ny * w, cx2 - nx * w, cy2 - ny * w, sh[0] - nx * 3, sh[1] - ny * 3], function (x, y) {
        return ((x + 0.5 - sh[0]) * nx + (y + 0.5 - sh[1]) * ny) > 0.8 ? cA : cB;
      });
      // dark cuff opening
      line(L, cx2 + nx * (w - 0.5), cy2 + ny * (w - 0.5), cx2 - nx * (w - 0.5), cy2 - ny * (w - 0.5), R[0]);
    };
    var sl = mk(48, 48);
    sleeve(sl, shB, hb, 3.8, R[4], R[2]);
    arcHand(sl, Math.round(hb[0]), Math.round(hb[1]), db, spread, p.curl);
    over(lay, sl, R[0]);
    var sf = mk(48, 48);
    sleeve(sf, shF, hf, 3.8, R[5], R[3]);
    arcHand(sf, Math.round(hf[0]), Math.round(hf[1]), df, spread, p.curl);
    over(lay, sf, R[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    // void orb
    if (p.orb) {
      var ocx = p.orb === 3 ? 42 : 25, ocy = p.orb === 3 ? 19 + hy : 23.5 + hy, orr = p.orb === 1 ? 2.4 : p.orb === 2 ? 3.6 : 3;
      ell(b, ocx, ocy, orr + 1.2, orr + 1.2, G[0], 0.55);
      ell(b, ocx, ocy, orr, orr, G[1]);
      ell(b, ocx, ocy, orr - 0.9, orr - 0.9, ARC.void);
      px(b, Math.round(ocx - orr * 0.4), Math.round(ocy - orr * 0.5), G[3]);
      if (p.orb === 2) { line(b, ocx - orr - 1, ocy, ocx - orr - 3, ocy - 2, G[2]); line(b, ocx + orr + 1, ocy - 1, ocx + orr + 3, ocy + 1, G[2]); px(b, ocx, ocy - orr - 2, G[3]); }
      if (p.orb === 3) { line(b, 29, 19 + hy, 37, 19 + hy, G[2], 0.8); line(b, 31, 17 + hy, 37, 17 + hy, G[1], 0.6); line(b, 32, 21 + hy, 37, 21 + hy, G[1], 0.6); }
    }
    if ((p.crack || 0) >= 2) { // light bursting through the cracked mask
      var lx = Math.round(mx), ly = Math.round(my + 1);
      line(b, lx + 2, ly - 3, lx + 8, ly - 8, G[2], 0.8); line(b, lx - 3, ly - 3, lx - 8, ly - 9, G[2], 0.7); line(b, lx + 3, ly + 3, lx + 9, ly + 6, G[1], 0.7);
      if (p.shatter) { px(b, lx + 6, ly - 6, ARC.mask[3]); px(b, lx - 6, ly - 6, ARC.mask[2]); px(b, lx + 8, ly + 2, ARC.mask[3]); px(b, lx - 5, ly + 6, ARC.mask[2]); }
    }
    arcParticles(b, p.ph, anim === 'die' ? 22 : 12, 3, anim === 'move' ? 3.2 : 2.4);
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('archon', {
    w: 48, h: 48, ax: 24, ay: 47,
    anims: { idle: 4, move: 4, attack: 4, hurt: 1, die: 5 },
    variants: ['default'],
    fps: { idle: 5, move: 6, attack: 6, die: 5 },
    draw: drawArchon
  });

  // ======================================================================= THORNLING (16x18) — walking knot of brambles
  var THORN = {
    bramble: { V: ['#140e0b', '#2a1d14', '#45301e', '#69492c', '#937146'], leaf: ['#245a40', '#4c9061', '#8cc46e'], thorn: ['#9c8a68', '#e6dabc'],
      eye: ['#c86a2a', '#ffbc62', '#fff1c8'], berry: null },
    blackthorn: { V: ['#0b0812', '#1a1329', '#2e2246', '#463566', '#62508c'], leaf: ['#22382c', '#3a5a3e', '#5a7a52'], thorn: ['#7e76a8', '#d0d6f2'],
      eye: ['#b8342a', '#ff7a4a', '#ffe0c0'], berry: ['#5a1e3e', '#a8487a'] }
  };
  // fixed tangle: [radius, startAngle, span, thickness]
  var THORN_VINES = [[4.6, 3.6, 2.6, 2], [3.4, 0.2, 2.8, 2], [5.2, 5.4, 2.2, 1], [2.2, 2.0, 3.6, 1], [4.0, 1.4, 2.4, 1], [5.0, 2.6, 1.8, 1], [3.0, 4.6, 2.6, 1]];
  var THORN_SPIKES = [-2.6, -2.1, -1.5, -0.9, -0.3, 0.4, 1.0, 2.2, 2.8, 3.4, -3.0];
  function drawThornling(v, anim, i) {
    var P = THORN[v], V = P.V, b = mk(16, 18);
    var cx = 7.8, cy = 9.6, rx = 5.2, ry = 4.9, lean = 0, bob = 0, legs = [0, 0, 0], eyes = 'open', bristle = 0, lash = 0, dead = 0;
    if (anim === 'idle') { if (i === 1) { ry = 4.6; rx = 5.7; bob = 1; bristle = 1; eyes = 'half'; } }
    else if (anim === 'move') { lean = [-1, 0, 1, 0][i]; bob = [0, -1, 0, -1][i]; legs = [[1, -1, 0], [0, 0, -1], [-1, 1, 0], [0, 0, 1]][i]; }
    else if (anim === 'attack') { lash = i + 1; lean = [-1.2, 1, 0][i]; cx = [6.8, 5.6, 6.6][i]; eyes = 'angry'; bristle = i === 1 ? 1 : 0; }
    else if (anim === 'hurt') { lean = -1; eyes = 'shut'; bristle = 1; }
    else if (anim === 'die') {
      if (i === 3) { var lp = leafPuff(3); var o = mk(16, 18); blit(o, lp, 0, 2); thornPile(o, P, 1); return o; }
      dead = i + 1; eyes = i === 0 ? 'dim' : 'none'; ry = [4.4, 3.2, 2.2][i]; rx = [5.5, 6, 6.3][i]; bob = [1, 3, 5][i];
    }
    if (anim === 'die' && i === 2) { thornPile(b, P, 0); blit(b, leafPuff(1), 0, 1); return b; }
    cy += bob;
    var lay = mk(16, 18), k, s2;
    function sx(x, y) { return x + lean * (cy + ry - y) / (2 * ry); }
    // root legs (behind the tangle)
    if (!dead) {
      var lx = [5, 8, 11];
      for (k = 0; k < 3; k++) {
        var lxx = sx(lx[k], cy + 3) + legs[k], ly0 = cy + 2.5;
        line(lay, lxx, ly0, lxx + legs[k] * 0.5 - 0.5, 15, V[2]); px(lay, lxx + legs[k] * 0.5 - 1.5, 16, V[3]); px(lay, lxx + legs[k] * 0.5 + 0.5, 16, V[2]);
      }
    }
    // dark core of the knot
    for (var y = 0; y < 18; y++) for (var x = 0; x < 16; x++) {
      if (inE(x - lean * (cy + ry - y) / (2 * ry), y, cx, cy, rx, ry)) px(lay, x, y, hash(x, y, 4) < 0.3 ? V[1] : V[0]);
    }
    // looping vines, lit from top-left
    for (k = 0; k < THORN_VINES.length; k++) {
      var Vn = THORN_VINES[k], r = Vn[0] * Math.min(rx / 5.4, 1.1);
      for (var t = 0; t <= Vn[2]; t += 0.12) {
        var a = Vn[1] + t, x0 = cx + Math.cos(a) * r, y0 = cy + Math.sin(a) * r * ry / rx;
        var l = -Math.cos(a) * 0.6 - Math.sin(a) * 0.8;
        var col = V[l > 0.3 ? 4 : l > -0.35 ? 3 : 2];
        px(lay, sx(x0, y0), y0, col);
        if (Vn[3] > 1) px(lay, sx(x0, y0) + 0.6, y0 + 0.6, V[l > 0.3 ? 3 : 2]);
      }
    }
    // leaves sprouting from the crown
    if (dead < 2) {
      var tx = Math.round(sx(cx, cy - ry)), ty = Math.round(cy - ry);
      px(lay, tx - 1, ty, P.leaf[1]); px(lay, tx - 2, ty - 1, P.leaf[2]); px(lay, tx - 1, ty - 1, P.leaf[1]);
      px(lay, tx + 2, ty + 1, P.leaf[0]); px(lay, tx + 3, ty, P.leaf[1]);
      if (P.berry) { px(lay, Math.round(cx - 3), Math.round(cy + 1), P.berry[1]); px(lay, Math.round(cx - 2), Math.round(cy + 2), P.berry[0]); px(lay, Math.round(cx + 3), Math.round(cy - 2), P.berry[1]); }
    }
    // eye hollow + glowing eyes (facing right)
    var ex = Math.round(sx(cx + 1.4, cy)), ey = Math.round(cy - 0.6);
    rect(lay, ex - 2, ey - 1, 6, 3, V[0]); px(lay, ex - 3, ey, V[0]); px(lay, ex + 4, ey, V[0]);
    var E = P.eye;
    if (eyes === 'open' || eyes === 'angry') {
      px(lay, ex - 1, ey, E[2]); px(lay, ex, ey, E[1]); px(lay, ex + 2, ey, E[2]); px(lay, ex + 3, ey, E[1]);
      if (eyes === 'angry') { px(lay, ex - 1, ey - 1, E[0]); px(lay, ex + 3, ey - 1, E[0]); }
    } else if (eyes === 'half') { px(lay, ex - 1, ey + 1, E[1]); px(lay, ex, ey + 1, E[1]); px(lay, ex + 2, ey + 1, E[1]); px(lay, ex + 3, ey + 1, E[1]); }
    else if (eyes === 'shut' || eyes === 'dim') { px(lay, ex - 1, ey, E[0]); px(lay, ex + 3, ey, E[0]); }
    // thorns poking out of the silhouette
    for (k = 0; k < THORN_SPIKES.length; k++) {
      var aa = THORN_SPIKES[k], ox = Math.cos(aa), oy = Math.sin(aa) * ry / rx;
      var bx = cx + ox * (rx - 0.4), by = cy + oy * (rx - 0.4) * 1;
      var len = 1 + ((k + i) % 2) + bristle;
      for (s2 = 1; s2 <= len; s2++) pxIn(lay, sx(bx + ox * s2, by + oy * s2), by + oy * s2, s2 === len ? P.thorn[1] : P.thorn[0]);
    }
    // the thorn lash: a whip vine flung from the right side
    if (lash) {
      var pts = lash === 1 ? [[11, 9], [12, 6], [11, 4], [9, 4], [9, 6]] : lash === 2 ? [[10, 9], [12, 6], [13, 4], [14, 5], [14, 9], [13, 12]] : [[11, 10], [13, 10], [14, 9], [14, 7]];
      for (k = 0; k + 1 < pts.length; k++) { line(lay, pts[k][0], pts[k][1] + bob, pts[k + 1][0], pts[k + 1][1] + bob, k === pts.length - 2 ? V[3] : V[4]); }
      for (k = 1; k < pts.length; k++) pxIn(lay, pts[k][0] + (k % 2 ? 1 : -1) * (pts[k][1] < 8 ? 0 : 1), pts[k][1] + bob - 1, P.thorn[1]);
    }
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (lash === 2) { px(b, 14, 13 + bob, '#ffffff'); px(b, 13, 14 + bob, P.thorn[1], 0.7); } // crack of the whip
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  function thornPile(b, P, wither) {
    var V = P.V, lay = mk(16, 18);
    for (var x = 2; x <= 13; x++) for (var y = 13; y <= 16; y++) if (inE(x, y, 7.8, 15, 6, 2.2)) px(lay, x, y, V[1]);
    pline(lay, [2, 15, 5, 13, 8, 14, 11, 13, 13, 15], V[wither ? 2 : 3]); pline(lay, [3, 16, 7, 15, 10, 16, 12, 15], V[2]);
    px(lay, 5, 12, P.thorn[1]); px(lay, 9, 12, P.thorn[1]); px(lay, 12, 13, P.thorn[0]);
    if (!wither) { px(lay, 7, 12, P.leaf[1]); px(lay, 8, 12, P.leaf[2]); }
    outline(lay, OL);
    blit(b, lay, 0, 0);
  }
  defType('thornling', {
    w: 16, h: 18, ax: 8, ay: 17,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['bramble', 'blackthorn'],
    fps: { idle: 2, move: 6, attack: 8, die: 6 },
    draw: drawThornling
  });

  // ======================================================================= WISP (16x16, floating flame; engine draws glow + `shadow`)
  var WISP = {
    teal: ['#124846', '#278e86', '#5cd6c4', '#b0f6ea', '#ffffff'], violet: ['#33205e', '#6a47a8', '#a888e8', '#e6d8ff', '#ffffff']
  };
  var WISP_EYE = { teal: '#0b2a2c', violet: '#170c2c' };
  function drawWisp(v, anim, i) {
    var C = WISP[v], b = mk(16, 16);
    var cx = 7.6, cy = 9.6, r = 4, tipY = 1.4, tipX = 0, bob = 0, ph = i, eyes = 'n', flare = 0, gutter = 0, sparks = 0, al = 1;
    if (anim === 'idle') { bob = [0, -1, -1, 0][i]; tipX = [0, 1, 0, -1][i]; }
    else if (anim === 'move') { bob = [0, -1, 0, 1][i]; tipX = -2 - (i % 2); sparks = 1; }
    else if (anim === 'attack') { flare = i + 1; if (i === 0) { r = 3.2; tipY = 3.6; eyes = 'squint'; } if (i === 1) { r = 5; tipY = 0.2; eyes = 'wide'; } if (i === 2) { r = 4.2; tipY = 1; } }
    else if (anim === 'hurt') { tipX = -2; eyes = 'shut'; }
    else if (anim === 'die') { gutter = i + 1; r = [3.2, 2.2, 1.3, 0][i]; tipY = [4, 6.5, 8.5, 10][i]; eyes = i === 0 ? 'shut' : 'none'; al = [1, 0.85, 0.7, 0][i]; }
    cy += bob; tipY += bob;
    var lay = mk(16, 16);
    function inside(x, y, rr, tY) {
      var yy = y + 0.5;
      if (yy >= cy) return inE(x, y, cx, cy, rr, rr);
      var t = (yy - tY) / (cy - tY);
      if (t < 0) return false;
      var off = tipX * (1 - t) * (1 - t) + Math.sin(ph * 1.9 + yy * 0.9) * 0.6 * (1 - t);
      var hw = rr * Math.pow(t, 0.62);
      return Math.abs(x + 0.5 - cx - off) <= hw;
    }
    if (r > 0) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        if (!inside(x, y, r, tipY)) continue;
        var core = inside(x, y, r * 0.55, tipY + (cy - tipY) * 0.45), mid = inside(x, y, r * 0.8, tipY + (cy - tipY) * 0.2);
        var edge = !inside(x - 1, y, r, tipY) || !inside(x + 1, y, r, tipY) || !inside(x, y - 1, r, tipY) || !inside(x, y + 1, r, tipY);
        var col = core ? C[4] : mid ? C[3] : edge ? C[1] : C[2];
        if (core && y > cy + r * 0.3) col = C[3];
        px(lay, x, y, col, core ? 1 : mid ? 0.95 : edge ? 0.75 : 0.88);
      }
      // a secondary tongue licking upward
      var t2x = Math.round(cx + 2 - tipX * 0.3 + ((ph % 2) ? 1 : 0)), t2y = Math.round(tipY + 2 + (ph % 3));
      if (!gutter || gutter < 2) { px(lay, t2x, t2y, C[2], 0.85); px(lay, t2x, t2y + 1, C[2], 0.9); px(lay, t2x - 1, t2y + 2, C[3], 0.9); }
      // cute-eerie face in the core, looking right
      var ex = Math.round(cx) - 1, ey = Math.round(cy - 0.8);
      if (eyes === 'n' || eyes === 'wide') { px(lay, ex, ey, WISP_EYE[v]); px(lay, ex + 2, ey, WISP_EYE[v]); if (eyes === 'wide') { px(lay, ex, ey - 1, WISP_EYE[v]); px(lay, ex + 2, ey - 1, WISP_EYE[v]); } }
      else if (eyes === 'squint' || eyes === 'shut') { px(lay, ex - 1, ey, WISP_EYE[v]); px(lay, ex, ey, WISP_EYE[v]); px(lay, ex + 2, ey, WISP_EYE[v]); px(lay, ex + 3, ey, WISP_EYE[v]); }
    }
    blit(b, lay, 0, 0, false, al);
    // drifting sparks
    var sp = sparks ? [[3, 11], [1, 9], [4, 13]] : [[4, 13], [11, 12]];
    for (var k = 0; k < sp.length; k++) { var sy2 = sp[k][1] + bob - ((ph + k) % 3); if (gutter < 3) px(b, sp[k][0] + (sparks ? -((ph + k) % 2) : 0), sy2, C[k % 2 ? 2 : 3], 0.8); }
    if (flare === 2) { // sudden flare: rays of light
      var R = [[8, 0], [1, 9], [15, 9], [3, 3], [13, 3], [2, 14], [14, 14], [8, 15]];
      for (k = 0; k < R.length; k++) px(b, R[k][0], R[k][1] + Math.min(0, bob), k < 3 ? C[4] : C[3]);
      line(b, 0, 9 + bob, 2, 9 + bob, C[3], 0.7); line(b, 14, 9 + bob, 15, 9 + bob, C[3], 0.7);
    }
    if (gutter >= 2) { // smoke curling off the dying flame
      cloud(b, gutter === 2 ? [[8, 6, 1.4], [9, 4, 1]] : gutter === 3 ? [[8, 5, 1.6], [7, 2.5, 1.2]] : [[8, 3, 1.4], [9, 1, 1]], ['#1b2a2e', '#3a4a50', '#5a6a70', '#7a8a90', '#a0b0b4'], [0.6, 0.5, 0.35][gutter - 2], false);
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('wisp', {
    w: 16, h: 16, ax: 8, ay: 15,
    anims: { idle: 4, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['teal', 'violet'],
    fps: { idle: 8, move: 8, attack: 10, die: 8 },
    draw: drawWisp
  });

  // ======================================================================= MOSSWOLF (24x16) — lean wolf with a mossy back
  var WOLF = {
    grey: { F: ['#1c1b28', '#33324a', '#4b4a64', '#66657f', '#8a89a4', '#b2b1c8'], pale: '#d6d4e2' },
    shadow: { F: ['#0e0c16', '#1a1828', '#282640', '#3a3858', '#52507a', '#7472a0'], pale: '#a8a6c8' }
  };
  var WOLF_MOSS = ['#1a4434', '#245a40', '#337450', '#4c9061', '#74b46e', '#a8d878'];
  var WOLF_EYE = ['#2fbf7f', '#5dffb0', '#e2fff0'];
  function wolfLeg(b, F, hip, knee, paw, near) {
    var c = near ? F[3] : F[1], c2 = near ? F[2] : F[0];
    line(b, hip[0], hip[1], knee[0], knee[1], c); line(b, hip[0] + 1, hip[1], knee[0] + 1, knee[1], c2);
    line(b, knee[0], knee[1], paw[0], paw[1], c);
    px(b, paw[0] + 1, paw[1], c2); px(b, paw[0], paw[1], near ? F[4] : F[2]);
  }
  function drawWolf(v, anim, i) {
    var W = WOLF[v], F = W.F, b = mk(24, 16);
    if (anim === 'die' && i === 3) { var o = mk(24, 16); blit(o, leafPuff(3), 4, 0); return o; }
    var bx = 10.5, by = 8, head = 'fwd', mouth = 0, tail = 0, legs, bob = 0, lying = anim === 'die' && i >= 1;
    // legs: [hip, knee, paw] for nearFront, farFront, nearHind, farHind (relative to bx/by except paw y)
    var L0 = { nf: [[4, 2], [4.5, 4], [5, 14]], ff: [[2.8, 2], [3, 4], [3, 14]], nh: [[-4.2, 2], [-3.2, 4], [-4.6, 14]], fh: [[-5.4, 2], [-4.6, 4], [-6, 14]] };
    var Lg = JSON.parse(JSON.stringify(L0));
    function mv(k, dx, dy, pdx) { Lg[k][1][0] += dx; Lg[k][2][0] += pdx; Lg[k][1][1] += dy; }
    if (anim === 'idle' && i === 1) { head = 'howl'; mouth = 1; tail = -1; by = 9; mv('nh', 1, 0, 1); mv('fh', 1, 0, 1); }
    else if (anim === 'move') {
      bob = [0, -1, 0, -1][i]; tail = [1, 2, 1, 0][i];
      var st = [1, 0, -1, 0][i];
      mv('nf', st, 0, st * 2); mv('fh', st, 0, st * 2); mv('ff', -st, 0, -st * 2); mv('nh', -st, 0, -st * 2);
      if (i % 2) { Lg.nf[2][1] = 13; Lg.fh[2][1] = 13; }
    } else if (anim === 'attack') {
      if (i === 0) { by = 9.5; head = 'low'; mouth = 2; tail = 2; mv('nh', 1, 0, 2); mv('fh', 1, 0, 2); mv('nf', -1, 0, -1); mv('ff', -1, 0, -1); }
      if (i === 1) { bx = 11; by = 7; head = 'lunge'; mouth = 3; tail = 3; Lg.nf = [[4, 2], [6.5, 3.5], [8.5, 11]]; Lg.ff = [[3, 2], [5, 4], [7, 12]]; Lg.nh = [[-4.2, 2], [-6.2, 3.5], [-7.8, 12]]; Lg.fh = [[-5.4, 2], [-7, 3.5], [-8.6, 11]]; }
      if (i === 2) { bx = 11; by = 8.5; head = 'bite'; mouth = 1; tail = 1; }
    } else if (anim === 'hurt') { bx = 9.5; head = 'low'; tail = -1; mouth = 1; }
    else if (anim === 'die' && i === 0) { by = 9.5; head = 'low'; tail = -1; mv('nf', 1, 0, 1); mv('nh', -1, 0, -1); }
    by += bob;
    var lay = mk(24, 16), far = mk(24, 16), body = mk(24, 16), near = mk(24, 16);
    if (lying) { // collapsed on its side
      shadeEll(body, 11, 12, 7, 2.4, F.slice(1), 4); shadeEll(body, 16.5, 11.8, 2.4, 2, F.slice(1), 4);
      shadeEll(body, 19.5, 12.6, 2.2, 1.6, F.slice(1), 4); px(body, 21, 13, F[4]); px(body, 22, 13, F[3]);
      line(near, 12, 13, 15, 14, F[3]); line(near, 7, 13, 9, 14, F[3]); line(body, 4, 12, 1, 13, F[3]); line(body, 4, 11, 2, 12, F[4]);
      for (var mx = 6; mx <= 16; mx++) if ((mx * 7) % 5 < 3) px(body, mx, 9 + (mx % 2), WOLF_MOSS[2 + (mx % 3)]);
      px(body, 19, 12, F[0]); px(body, 20, 12, F[0]);
      over(lay, body, F[0]); over(lay, near, F[0]); outline(lay, OL); blit(b, lay, 0, 0);
      if (i === 2) blit(b, leafPuff(1), 4, -1);
      return b;
    }
    // far legs, tail
    wolfLeg(far, F, [bx + Lg.ff[0][0], by + Lg.ff[0][1]], [bx + Lg.ff[1][0], by + Lg.ff[1][1]], [bx + Lg.ff[2][0], Lg.ff[2][1]], false);
    wolfLeg(far, F, [bx + Lg.fh[0][0], by + Lg.fh[0][1]], [bx + Lg.fh[1][0], by + Lg.fh[1][1]], [bx + Lg.fh[2][0], Lg.fh[2][1]], false);
    var tx = bx - 5.6, ty = by - 0.5, tw = [[-1.8, 1.5, -2.6, 3.4, -2.6, 5], [-2, 0, -3.2, 1, -3.6, 2.6], [-2, -1, -3.2, -1.5, -3.8, -0.6], [-2.2, -0.6, -3.4, -0.8, -3.9, -0.6], [-1.4, 2, -2, 3.6, -1.8, 4.8]];
    var T = tw[tail === -1 ? 4 : tail];
    var tl = mk(24, 16);
    line(tl, tx, ty, tx + T[0], ty + T[1], F[3]); line(tl, tx + T[0], ty + T[1], tx + T[2], ty + T[3], F[3]); line(tl, tx + T[2], ty + T[3], tx + T[4], ty + T[5], F[4]);
    line(tl, tx, ty + 1, tx + T[0], ty + T[1] + 1, F[2]); line(tl, tx + T[0], ty + T[1] + 1, tx + T[2], ty + T[3] + 1, F[2]);
    px(tl, tx + T[4], ty + T[5], W.pale);
    over(far, tl, F[0]);
    // body: haunch, torso, chest
    shadeEll(body, bx - 4, by + 0.4, 2.7, 2.6, F.slice(1), 4);
    shadeEll(body, bx, by, 5.6, 2.3, F.slice(1), 4);
    shadeEll(body, bx + 4, by + 0.6, 2.8, 2.8, F.slice(1), 4);
    px(body, bx + 5.8, by + 1, W.pale); px(body, bx + 5.4, by + 2, F[5]); px(body, bx + 5.9, by + 2, W.pale); // pale chest ruff
    // neck + head
    var hx, hy, sdx, sdy;
    if (head === 'howl') { hx = bx + 6.2; hy = by - 5; sdx = 1.6; sdy = -1.6; }
    else if (head === 'low') { hx = bx + 6.8; hy = by + 0.8; sdx = 2.3; sdy = 0.6; }
    else if (head === 'lunge') { hx = bx + 7; hy = by - 1.2; sdx = 2.4; sdy = 0.2; }
    else if (head === 'bite') { hx = bx + 7; hy = by - 0.8; sdx = 2.4; sdy = 0.5; }
    else { hx = bx + 6.5; hy = by - 2.6; sdx = 2.4; sdy = 0.5; }
    var nk = mk(24, 16);
    poly(nk, [bx + 3, by - 2, bx + 5.5, by - 2.4, hx + 0.8, hy - 0.6, hx + 0.8, hy + 1.6, bx + 6.6, by + 1.4], function (x, y) { return y < hy + 0.5 ? F[4] : F[3]; });
    over(body, nk, F[1]);
    var hd = mk(24, 16);
    shadeEll(hd, hx, hy, 2.4, 2, F.slice(1), 4);
    shadeEll(hd, hx + sdx, hy + sdy, 2, 1.1, F.slice(1), 4); // muzzle
    px(hd, Math.round(hx + sdx + 1.6), Math.round(hy + sdy - 0.4), F[0]); // nose
    // ears
    var ea = head === 'howl' ? -1.6 : head === 'low' || head === 'lunge' ? 1 : 0;
    px(hd, Math.round(hx - 1.2 + ea * 0.5), Math.round(hy - 2.2), F[4]); px(hd, Math.round(hx - 1.6 + ea), Math.round(hy - 3), F[3]);
    px(hd, Math.round(hx + 0.2 + ea * 0.3), Math.round(hy - 2.3), F[4]); px(hd, Math.round(hx + 0.2 + ea * 0.6), Math.round(hy - 3.2), F[5]);
    // jaw / mouth
    var mxx = Math.round(hx + sdx - 0.6), myy = Math.round(hy + sdy + 0.8);
    if (mouth === 1) { px(hd, mxx, myy, F[0]); px(hd, mxx + 1, myy, F[0]); }
    if (mouth >= 2) { // snarl / open jaws with fangs
      line(hd, mxx - 1, myy, mxx + 2, myy, '#2a0e18'); px(hd, mxx, myy - 1 + (head === 'howl' ? 0 : 0), '#ffffff'); px(hd, mxx + 2, myy - 1, '#f4eedf');
      if (mouth === 3) { line(hd, mxx - 1, myy + 1, mxx + 2, myy + 2, F[3]); px(hd, mxx + 1, myy + 1, '#ffffff'); px(hd, mxx, myy + 1, '#c4648e'); }
    }
    if (head === 'howl') { px(hd, Math.round(hx + 2.4), Math.round(hy - 1), F[0]); px(hd, Math.round(hx + 3), Math.round(hy - 0.2), F[0]); px(hd, Math.round(hx + 2.4), Math.round(hy), '#2a0e18'); }
    // glowing eye
    var ex = Math.round(hx + 0.6), ey = Math.round(hy - 0.6);
    if (anim === 'hurt' || (anim === 'die')) { px(hd, ex, ey, F[0]); px(hd, ex + 1, ey, F[0]); }
    else if (head === 'howl') { px(hd, ex, ey + 1, F[0]); px(hd, ex + 1, ey, F[0]); }
    else { px(hd, ex, ey, WOLF_EYE[2]); px(hd, ex + 1, ey, WOLF_EYE[1]); }
    over(body, hd, F[0]);
    // moss along the back + a fern sprout and a tiny mushroom
    var M = WOLF_MOSS;
    for (var x = Math.round(bx - 6); x <= Math.round(bx + 4); x++) {
      var topY = -1;
      for (var y = 0; y < 16; y++) if (A(body, x, y)) { topY = y; break; }
      if (topY < 0) continue;
      var h = 1 + ((x * 5 + 3) % 3 === 0 ? 1 : 0);
      for (var k = 0; k < h; k++) px(body, x, topY + k, M[k === 0 ? 3 + ((x * 3) % 2) : 2]);
      if ((x * 7) % 9 === 1) px(body, x, topY - 1, M[4]);
    }
    var fx = Math.round(bx - 1), fy0 = -1;
    for (y = 0; y < 16; y++) if (A(body, fx, y)) { fy0 = y; break; }
    if (fy0 > 0) { px(body, fx, fy0 - 1, M[3]); px(body, fx - 1, fy0 - 2, M[5]); px(body, fx + 1, fy0 - 2, M[4]); }
    var mxm = Math.round(bx - 4.6), mym = -1;
    for (y = 0; y < 16; y++) if (A(body, mxm, y)) { mym = y; break; }
    if (mym > 0) { px(body, mxm, mym - 1, '#c4648e'); px(body, mxm + 1, mym - 1, '#e89ab8'); px(body, mxm, mym, '#f4eedf'); }
    // near legs
    wolfLeg(near, F, [bx + Lg.nf[0][0], by + Lg.nf[0][1]], [bx + Lg.nf[1][0], by + Lg.nf[1][1]], [bx + Lg.nf[2][0], Lg.nf[2][1]], true);
    wolfLeg(near, F, [bx + Lg.nh[0][0], by + Lg.nh[0][1]], [bx + Lg.nh[1][0], by + Lg.nh[1][1]], [bx + Lg.nh[2][0], Lg.nh[2][1]], true);
    over(lay, far, F[0]);
    over(lay, body, F[0]);
    over(lay, near, F[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (head === 'lunge') { line(b, 0, 6, 2, 6, '#e8eeff', 0.5); line(b, 0, 9, 1, 9, '#e8eeff', 0.4); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('mosswolf', {
    w: 24, h: 16, ax: 12, ay: 15,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['grey', 'shadow'],
    fps: { idle: 2, move: 10, attack: 9, die: 7 },
    draw: drawWolf
  });

  // ======================================================================= BOGLING (16x16) — frog-goblin of the bog
  var BOG = {
    bog: { S: ['#132116', '#223c26', '#365c32', '#548440', '#80ae56'], belly: ['#9aa86e', '#c8d49a'], eye: ['#c86a2a', '#f2c45a', '#fff1c8'], wart: '#1e3420' },
    toad: { S: ['#1e160e', '#382a1a', '#58442a', '#7e6a3a', '#a8925a'], belly: ['#b8a47a', '#e0d0a8'], eye: ['#a8341e', '#e8843c', '#ffd8a8'], wart: '#2e2214' }
  };
  var SPIT = ['#2a4a24', '#5f9a36', '#9ccc4e', '#dcf494'];
  function drawBogling(v, anim, i) {
    var P = BOG[v], S = P.S, b = mk(16, 16);
    if (anim === 'die' && i === 3) return leafPuff(3);
    var cx = 7.6, cy = 10.6, rx = 5, ry = 3.7, lift = 0, lean = 0, mouth = 'grin', eyes = 'open', sac = 0, legs = 'tuck', spit = 0, belly = false;
    if (anim === 'idle') { if (i === 1) { sac = 1; eyes = 'half'; } }
    else if (anim === 'move') {
      if (i === 0) { ry = 3.1; rx = 5.5; cy = 11.3; }
      if (i === 1) { ry = 4.2; rx = 4.5; lift = 2; lean = 1; legs = 'kick'; }
      if (i === 2) { lift = 3; legs = 'air'; }
      if (i === 3) { ry = 3.3; rx = 5.3; cy = 11.1; lift = 0; }
    } else if (anim === 'attack') {
      if (i === 0) { lean = -1; sac = 2; mouth = 'shut'; eyes = 'squint'; }
      if (i === 1) { lean = 1; mouth = 'open'; spit = 1; }
      if (i === 2) { mouth = 'grin'; spit = 2; }
    } else if (anim === 'hurt') { lean = -1; eyes = 'shut'; mouth = 'open'; }
    else if (anim === 'die') { belly = true; eyes = 'x'; }
    cy -= lift;
    var lay = mk(16, 16), k;
    if (belly && i >= 1) { // flat, belly-up frog
      ell(lay, 8, 13, 5.5, 1.8, S[2]); ell(lay, 8, 12.6, 4, 1, P.belly[1]);
      line(lay, 3, 12, 1, 10, S[3]); line(lay, 13, 12, 14, 10, S[3]); px(lay, 1, 9, S[3]); px(lay, 14, 9, S[3]);
      outline(lay, OL); blit(b, lay, 0, 0);
      if (i === 2) blit(b, leafPuff(0), 0, 1);
      return b;
    }
    // hind leg (big folded haunch) + webbed foot
    var hx = cx - 2.6 - lean * 0.5, hy = cy + 1.4;
    if (legs === 'kick') { line(lay, hx, hy, hx - 2.5, hy + 2.5, S[2]); line(lay, hx + 1, hy, hx - 1.5, hy + 2.5, S[2]); spr(lay, ['ff.', '.ff'], { f: S[3] }, Math.max(1, Math.round(hx - 4.5)), Math.round(hy + 2.5)); }
    else if (legs === 'air') { shadeEll(lay, hx + 0.5, hy, 2.3, 1.8, S, 3); spr(lay, ['fff'], { f: S[3] }, Math.round(hx - 2), Math.round(hy + 2)); }
    else { shadeEll(lay, hx, hy, 2.6, 2.3, S, 3); spr(lay, ['.fff', 'ff.f'], { f: S[3] }, Math.round(hx - 0.5), 13 - lift); }
    // body
    var bd = mk(16, 16);
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var xx = x - lean * (cy + ry - y) / (2 * ry);
      if (!inE(xx, y, cx, cy, rx, ry)) continue;
      var nx = (xx + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, l = -0.55 * nx - 0.8 * ny;
      px(bd, x, y, S[l > 0.55 ? 4 : l > 0.1 ? 3 : l > -0.45 ? 2 : 1]);
    }
    // pale belly + throat sac
    var bxx = Math.round(cx + 1.6), byy = Math.round(cy + 1.4);
    ell(bd, bxx + 0.5, byy + 0.5, 2.6, 1.6, P.belly[0]); ell(bd, bxx + 1, byy, 1.6, 0.9, P.belly[1]);
    if (sac) ell(bd, cx + 3.4, cy + 1.2 + (sac > 1 ? 0.4 : 0), 1.7 + sac * 0.4, 1.3 + sac * 0.3, P.belly[1]);
    // warts
    var wt = [[-2.5, -1.8], [-0.6, -2.6], [-3.4, 0.2], [0.9, -1.2]];
    for (k = 0; k < wt.length; k++) { var wx = Math.round(cx + wt[k][0]), wy = Math.round(cy + wt[k][1]); if (A(bd, wx, wy)) { px(bd, wx, wy, P.wart); px(bd, wx - 1, wy - 1, S[4]); } }
    // pointed goblin ear swept back from behind the eyes
    var ex0 = Math.round(cx - 2.6 + lean * 0.5), ey0 = Math.round(cy - 1.4);
    line(bd, ex0, ey0, ex0 - 3, ey0 - 1, S[3]); line(bd, ex0, ey0 + 1, ex0 - 2, ey0, S[2]); px(bd, ex0 - 3, ey0 - 1, S[4]); px(bd, ex0 - 1, ey0, P.belly[0]);
    // wide mouth
    var mx = Math.round(cx + 1 + lean * 0.6), my = Math.round(cy + 0.2);
    if (mouth === 'grin') { line(bd, mx - 2, my + 1, mx + 4, my - 1, OL); line(bd, mx - 1, my, mx + 3, my - 2, S[4]); px(bd, mx + 3, my, '#f4eedf'); px(bd, mx, my + 1, '#f4eedf'); }
    else if (mouth === 'shut') { line(bd, mx - 2, my + 1, mx + 4, my, OL); }
    else { rect(bd, mx + 1, my - 1, 3, 2, '#2a0e18'); line(bd, mx, my - 1, mx + 4, my - 2, OL); px(bd, mx + 2, my, '#c4648e'); px(bd, mx + 3, my - 1, '#f4eedf'); }
    over(lay, bd, S[0]);
    // bulging eyes on top: far eye (small) then near eye (big), slit pupils
    var E = P.eye, eyeL = mk(16, 16);
    var e1x = Math.round(cx - 1.6 + lean), e2x = Math.round(cx + 1.8 + lean), eY = Math.round(cy - ry - 0.4);
    ell(eyeL, e1x + 1, eY + 1.4, 1.4, 1.3, S[2]); ell(eyeL, e2x + 1.5, eY + 1.1, 2, 1.8, S[3]);
    var eyeMaps = {
      open: [['yk', 'yy'], ['.h.', 'yky', 'yky']],
      half: [['kk', 'yy'], ['...', 'kkk', 'yky']],
      squint: [['kk', '..'], ['...', 'kkk', '...']],
      shut: [['kk', '..'], ['...', 'kkk', '...']],
      x: [['k.', '.k'], ['k.k', '.k.', 'k.k']]
    };
    var em = eyeMaps[eyes] || eyeMaps.open, ep = { y: E[1], k: OL, h: E[2] };
    spr(eyeL, em[0], ep, e1x, eY + 1); spr(eyeL, em[1], ep, e2x, eY);
    over(lay, eyeL, S[0]);
    // little front arm
    if (legs !== 'air') { line(lay, cx + 2.6, cy + 1.6, cx + 3.2, 14 - lift, S[2]); px(lay, cx + 4, 14 - lift, S[3]); }
    outline(lay, OL);
    if (lift) shadowE(lay, 8, 15, 3.6, 0.7, 0.45);
    blit(b, lay, 0, 0);
    if (spit) { // glob of spit
      var gx = spit === 1 ? 12.8 : 13, gy = spit === 1 ? 9 : 10.5, gr = spit === 1 ? 1.5 : 1;
      var gl = mk(16, 16); ell(gl, gx, gy, gr, gr * 0.85, SPIT[2]); px(gl, Math.round(gx - 0.6), Math.round(gy - 0.8), SPIT[3]); outline(gl, SPIT[0]); blit(b, gl, 0, 0);
      if (spit === 1) { px(b, 11, 10, SPIT[2]); px(b, 10, 10, SPIT[1], 0.7); }
      else { px(b, 12, 12, SPIT[2]); px(b, 13, 13, SPIT[1]); }
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('bogling', {
    w: 16, h: 16, ax: 8, ay: 15,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['bog', 'toad'],
    fps: { idle: 2, move: 8, attack: 8, die: 7 },
    draw: drawBogling
  });

  // ======================================================================= MIMIC (16x16) — an old chest that bites
  var MIMIC = {
    wood: { W: ['#211719', '#3a2a28', '#574039', '#7a5a48', '#9c7a5e'], band: ['#1e1d2a', '#45445a', '#7e7d97', '#b4b3c8'], lock: ['#45445a', '#a09fb6', '#e2e1ee'] },
    gilded: { W: ['#1c1214', '#30201c', '#4a3226', '#6a4a36', '#8a684a'], band: ['#4a2e10', '#a8782e', '#f2c45a', '#fff1c8'], lock: ['#a8782e', '#f2c45a', '#fff1c8'], gem: ['#6a2e6a', '#c4648e', '#ffd0ec'] }
  };
  var MAW = { in: '#1a080e', in2: '#3a1220', tooth: ['#b8ac98', '#f4eedf'], tongue: ['#8c3a62', '#c4648e', '#e89ab8'], eye: ['#e8843c', '#ffbc62', '#fff1c8'] };
  function drawMimic(v, anim, i) {
    var P = MIMIC[v], W = P.W, Bd = P.band, b = mk(16, 16);
    var lift = 0, squash = 0, ang = 0, eyes = 0, tongue = 0, snap = false, broken = 0, glint = 0, dust = false;
    if (anim === 'idle') { glint = i; }
    else if (anim === 'move') { squash = [1, -1, 0, 1][i]; lift = [0, 1, 2, 0][i]; ang = [0, 14, 6, 0][i]; tongue = i === 1 ? 1 : 0; dust = i === 3; }
    else if (anim === 'attack') { ang = [28, 72, 4][i]; eyes = i < 2 ? 1 : 0; tongue = [1, 2, 0][i]; snap = i === 2; }
    else if (anim === 'hurt') { ang = 16; eyes = 2; }
    else if (anim === 'die') { ang = [100, 110, 0, 0][i]; eyes = 3; tongue = i < 2 ? 3 : 0; broken = i; }
    var lay = mk(16, 16);
    var x0 = 3, x1 = 13, top = 9 + squash - lift, bot = 13 - lift;
    if (broken >= 2) { // smashed: planks, lid and loot
      var t3 = broken - 2;
      spr(lay, ['.wwww.', 'wWWWWw'], { w: W[2], W: W[3] }, 1, 13); spr(lay, ['www', 'WWw'], { w: W[2], W: W[3] }, 9, 12 + t3); spr(lay, ['bwwb'], { b: Bd[1], w: W[3] }, 5, 11 - t3);
      line(lay, 12, 14, 14, 13, W[3]); px(lay, 3, 11, Bd[2]);
      outline(lay, OL); blit(b, lay, 0, 0);
      px(b, 6, 12, '#f2c45a'); px(b, 11, 11, '#fff1c8'); px(b, 8, 14, '#f2c45a'); // spilled coins
      blit(b, deathPuff(t3 ? 3 : 1, ['#2a2018', '#4a3a2e', '#6e5c4a', '#94826c', '#c0b098'], ['#fff1c8', '#f2c45a', '#c8b898', '#9c8a72']), 0, -1);
      return b;
    }
    // base box (side panel with planks + iron bands)
    for (var y = top; y <= bot; y++) for (var x = x0; x <= x1; x++) {
      var c = (y - top) % 3 === 0 ? W[2] : W[3];
      if (x === x0) c = W[4]; if (x === x1) c = W[1];
      if (y === bot) c = W[1];
      px(lay, x, y, c);
    }
    for (y = top; y <= bot; y++) { px(lay, x0 + 1, y, Bd[1]); px(lay, x1 - 1, y, Bd[1]); px(lay, x0 + 1, y, y === top ? Bd[2] : Bd[1]); }
    line(lay, x0, top, x1, top, Bd[1]); px(lay, x0 + 1, top, Bd[3]);
    px(lay, x0 + 1, bot + 1, W[1]); px(lay, x1 - 1, bot + 1, W[1]); // stubby feet
    // mouth interior + lower teeth (visible when the lid is open)
    if (ang > 3) {
      var openH = Math.min(6, Math.round(ang / 14) + 1);
      rect(lay, x0 + 2, top - openH + 1, x1 - x0 - 3, openH, MAW.in);
      rect(lay, x0 + 2, top - 1, x1 - x0 - 3, 1, MAW.in2);
      for (var tx = x0 + 3; tx <= x1 - 1; tx += 2) { px(lay, tx, top - 1, MAW.tooth[1]); if (ang > 40) px(lay, tx, top - 2, MAW.tooth[0]); }
      if (eyes && eyes < 3) { var ey = top - Math.max(2, openH - 1); px(lay, x0 + 4, ey, MAW.eye[2]); px(lay, x0 + 5, ey, MAW.eye[1]); px(lay, x0 + 8, ey, MAW.eye[2]); px(lay, x0 + 9, ey, MAW.eye[1]); }
      if (eyes === 3) { var ey3 = top - 2; px(lay, x0 + 4, ey3, MAW.eye[0]); px(lay, x0 + 8, ey3, MAW.eye[0]); }
    }
    // lid: domed profile rotated about the back hinge
    var hingeX = x0 + 0.5, hingeY = top - 0.5, a, ca, sa, k;
    var prof = [[0, 0], [0, -2.6], [1.4, -4], [5, -4.6], [8.6, -4], [10.4, -2.6], [10.4, 0]];
    var pts;
    for (var tries = 0; tries < 30; tries++) { // open as wide as asked, but never past the frame edges
      a = -ang * Math.PI / 180; ca = Math.cos(a); sa = Math.sin(a); pts = [];
      var minX = 99, minY = 99;
      for (k = 0; k < prof.length; k++) { var px0 = prof[k][0], py0 = prof[k][1] + (squash > 0 ? 1 : 0), X = hingeX + px0 * ca - py0 * sa, Y = hingeY + px0 * sa + py0 * ca; pts.push(X, Y); minX = Math.min(minX, X); minY = Math.min(minY, Y); }
      if (minX >= 1.6 && minY >= 1.6) break;
      ang -= 4;
    }
    var lid = mk(16, 16);
    poly(lid, pts, function (x, y) { var rel = (y - (hingeY - 5)) / 5; return rel < 0.35 ? W[4] : rel < 0.7 ? W[3] : W[2]; });
    // iron bands across the lid (follow the rotation)
    var bandX = [1, 9.4];
    for (k = 0; k < 2; k++) for (var t = -0.2; t >= -4.6; t -= 0.5) {
      var bxp = bandX[k], byp = t;
      if (k === 0 && t < -3.2) continue;
      px(lid, hingeX + bxp * ca - byp * sa, hingeY + bxp * sa + byp * ca, Bd[k === 0 ? 2 : 1]);
    }
    // upper teeth along the lid's front lip
    if (ang > 3) for (k = 2; k <= 9; k += 2) { var lx = k, ly = 0.6; px(lid, hingeX + lx * ca - ly * sa, hingeY + lx * sa + ly * ca, MAW.tooth[1]); }
    over(lay, lid, W[0]);
    // lock plate on the front, or the gilded gem
    if (ang < 20) {
      var lkx = x1, lky = top - (ang > 3 ? 1 : 0);
      px(lay, lkx, lky, P.lock[1]); px(lay, lkx, lky + 1, P.lock[0]); px(lay, lkx + 1, lky, P.lock[glint ? 2 : 1]); px(lay, lkx + 1, lky + 1, P.lock[0]);
      if (P.gem) { px(lay, x0 + 6, top + 3, P.gem[1]); px(lay, x0 + 6, top + 2, P.gem[2]); px(lay, x0 + 7, top + 3, P.gem[0]); }
    }
    // tongue lolling over the front lip
    if (tongue) {
      var tl = tongue === 2 ? [[x1 - 1, top - 1], [x1, top], [x1 + 1, top + 1], [x1 + 1, top + 2], [x1 + 2, top + 3]] : tongue === 3 ? [[x1 - 1, top - 1], [x1, top], [x1 + 1, top + 1], [x1 + 1, top + 3]] : [[x1 - 1, top - 1], [x1, top]];
      for (k = 0; k < tl.length; k++) { pxIn(lay, tl[k][0], tl[k][1], MAW.tongue[k === tl.length - 1 ? 2 : 1]); if (k > 0) pxIn(lay, tl[k][0] - 1, tl[k][1], MAW.tongue[0]); }
    }
    outline(lay, OL);
    if (lift) shadowE(lay, 8, 14.6, 4.6, 0.7, 0.45);
    blit(b, lay, 0, 0);
    if (snap) { line(b, 13, 4, 14, 2, '#ffffff', 0.85); line(b, 14, 6, 15, 5, '#ffffff', 0.6); px(b, 12, 3, '#fff1c8'); }
    if (dust) { cloud(b, [[2.5, 14.5, 1.3], [13.5, 14.5, 1.3]], ['#2a2018', '#4a3a2e', '#6e5c4a', '#94826c', '#c0b098'], 0.6, false); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('mimic', {
    w: 16, h: 16, ax: 8, ay: 15,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['wood', 'gilded'],
    fps: { idle: 1, move: 8, attack: 9, die: 7 },
    draw: drawMimic
  });

  // ======================================================================= WEBWEAVER (26x20) — big furry woodland spider (3/4 overhead)
  var WEAVER = {
    brown: { F: ['#100a08', '#20160f', '#33251a', '#4a3828', '#64503a', '#86725a', '#ac9a7e'], skull: ['#a8987c', '#e0d4bc', '#fbf4e4'] },
    ashen: { F: ['#0f0e12', '#1d1b21', '#2d2a32', '#423e47', '#5c5862', '#7c7882', '#a29ea8'], skull: ['#b0a8b0', '#e4e0e8', '#ffffff'] }
  };
  var WEAVER_EYE = ['#6a1010', '#d42a2a', '#ff6a5a', '#ffe0d8'];
  // [hipX, hipY, kneeX, kneeY, tipX, tipY, gait group] — upper (far side) legs then lower (near side)
  var WEAVER_LEGS = [
    [19, 8, 22, 4, 24, 6, 0], [18, 8, 19, 2, 22, 1, 1], [16, 8, 14, 2, 10, 1, 0], [15, 8, 9, 3, 3, 3, 1],
    [19, 12, 22, 16, 24, 14, 1], [18, 12, 19, 18, 22, 18, 0], [16, 12, 14, 18, 10, 18, 1], [15, 12, 9, 17, 3, 17, 0]
  ];
  function weaverLeg(b, F, L, ox, oy, kx, ky, tx, ty, curl) {
    var ax = L[0] + ox, ay = L[1] + oy, kX = L[2] + ox + kx, kY = L[3] + oy + ky, tX = L[4] + ox + tx, tY = L[5] + oy + ty;
    if (curl) { kX = ax + (kX - ax) * (1 - 0.4 * curl); kY = ay + (kY - ay) * (1 - 0.4 * curl); tX = kX + (tX - kX) * (1 - 0.75 * curl) + (ax > 17 ? -curl : curl); tY = kY + (ay - kY) * 0.5 * curl + (tY - kY) * (1 - curl) * 0.5; }
    kX = Math.max(1, Math.min(24, kX)); kY = Math.max(1, Math.min(18, kY)); tX = Math.max(1, Math.min(24, tX)); tY = Math.max(1, Math.min(18, tY));
    var up = L[3] < L[1];
    line(b, ax, ay, kX, kY, F[4]); line(b, ax + (up ? 1 : -1) * 0, ay + (up ? 1 : -1), kX, kY + (up ? 1 : -1), F[3]); // thick hairy femur
    var mX = (kX + tX) / 2, mY = (kY + tY) / 2;
    line(b, kX, kY, mX, mY, F[5]); line(b, mX, mY, tX, tY, F[4]);
    px(b, kX, kY, F[6]); px(b, mX, mY, F[1]); // pale knee, dark band
    px(b, (ax + kX) / 2 + (up ? 0 : 0), (ay + kY) / 2 - (up ? 1 : -1) * 1, F[5]); // bristle
  }
  function drawWeaver(v, anim, i) {
    var P = WEAVER[v], F = P.F, b = mk(26, 20);
    var dust = ['#16120e', '#3a3028', '#5e5246', '#887a6a', '#b4a894'], dspk = ['#e8dcc4', '#c8b8a0', '#a89884', '#887a6a'];
    if (anim === 'die' && i === 3) { var o = mk(26, 20); blit(o, deathPuff(3, dust, dspk), 5, 2); return o; }
    var ox = 0, oy = 0, rear = 0, step = 0, pulse = 0, glare = 0, curl = 0, silk = anim === 'idle';
    if (anim === 'idle') pulse = i;
    else if (anim === 'move') step = [1, 0, -1, 0][i];
    else if (anim === 'attack') { rear = i + 1; ox = [-1, -1, 1][i]; glare = i < 2 ? 1 : 0; }
    else if (anim === 'hurt') { ox = -1; curl = 0.25; }
    else if (anim === 'die') curl = [0.6, 1, 1][i];
    var legs = mk(26, 20), body = mk(26, 20), k;
    for (k = 0; k < 8; k++) {
      var L = WEAVER_LEGS[k], g = L[6] ? -step : step, kx = g, ky = 0, tx = g * 2, ty = 0;
      if (rear && L[0] >= 18) { // front two pairs lift and reach forward
        var upper = L[3] < L[1];
        if (rear === 1) { kx = 1; ky = upper ? -1 : -3; tx = 1; ty = upper ? -1 : -6; }
        if (rear === 2) { kx = 1; ky = upper ? -2 : -6; tx = 0; ty = upper ? -1 : -11; }
        if (rear === 3) { kx = 1; ky = upper ? 1 : -1; tx = 0; ty = upper ? 3 : -2; }
      }
      weaverLeg(legs, F, L, ox, oy + (rear === 2 && L[0] >= 18 ? -1 : 0), kx, ky, tx, ty, curl);
    }
    // furry abdomen with the skull marking
    var aX = 8.6 + ox, aY = 10 + oy + (rear === 2 ? 0.5 : 0), arx = 6 + pulse * 0.3, ary = 4.6 + pulse * 0.3;
    shadeEll(body, aX, aY, arx, ary, F.slice(1, 6), 3);
    for (var a = 0; a < Math.PI * 2; a += 0.28) { // fur tufts
      var fx = aX + Math.cos(a) * (arx + 0.5), fy = aY + Math.sin(a) * (ary + 0.5);
      if (hash(Math.round(fx), Math.round(fy), 31) < 0.5) px(body, fx, fy, F[(a > 3.4 && a < 5.8) ? 4 : 2]);
    }
    for (k = 0; k < 16; k++) { var hx = aX - arx + 1.5 + hash(k, 3, 7) * (arx * 2 - 3), hy = aY - ary + 1 + hash(k, 4, 7) * (ary * 2 - 2); if (A(body, Math.round(hx), Math.round(hy))) px(body, hx, hy, F[hash(k, 5, 7) < 0.5 ? 2 : 5]); }
    var sk = P.skull;
    spr(body, ['.bwb.', 'bbbbb', 'bkbkb', 'bbsbb', '.bsb.', '.s.s.'], { b: sk[1], w: sk[2], k: F[0], s: sk[0] }, Math.round(aX - 2.5), Math.round(aY - 3));
    // head with two rows of red eyes and fangs
    var hd = mk(26, 20), cX = 17.6 + ox + (rear === 3 ? 1 : 0), cY = 10 + oy - (rear === 1 ? 1 : rear === 2 ? 2 : 0), hr = rear === 2 ? 3.4 : 3.1;
    shadeEll(hd, cX, cY, hr, 2.8, F.slice(1, 6), 3);
    var E = WEAVER_EYE, ex = Math.round(cX + 1), ey = Math.round(cY - 2);
    if (anim === 'die' || anim === 'hurt') { px(hd, ex + 1, ey + 1, E[0]); px(hd, ex + 1, ey + 3, E[0]); }
    else spr(hd, ['rr..', '.RW.', '.WR.', 'rr..'], { W: E[3], R: E[2], r: glare ? E[2] : E[1] }, ex, ey);
    var fX = Math.round(cX + hr), fY = Math.round(cY), op = rear ? 1 : 0;
    px(hd, fX, fY - 1 - op, F[3]); px(hd, fX + 1, fY - 1 - op, sk[1]); px(hd, fX, fY + 1 + op, F[3]); px(hd, fX + 1, fY + 1 + op, sk[1]);
    over(body, hd, F[0]);
    over(legs, body, F[0]);
    outline(legs, OL);
    if (silk) line(b, Math.round(aX - 1), 0, Math.round(aX - 1), Math.round(aY - ary - 1), '#e8eeff', 0.4);
    blit(b, legs, 0, 0);
    if (anim === 'die' && i === 2) blit(b, deathPuff(1, dust, dspk), 5, 2);
    if (rear === 3) { px(b, 24, 9, '#ffffff', 0.7); px(b, 24, 11, '#ffffff', 0.7); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('webweaver', {
    w: 26, h: 20, ax: 13, ay: 19,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['brown', 'ashen'],
    fps: { idle: 2, move: 10, attack: 6, die: 6 },
    draw: drawWeaver
  });

  // ======================================================================= BEETLES — gloombeetle (20x14) & hornbeetle (22x16), side view
  var GLOOMB = {
    violet: { S: ['#120a1e', '#221438', '#36225e', '#50368a', '#6e52b2'], G: ['#8f6cd1', '#c8a8ff', '#f4ecff'], D: ['#100a18', '#1e1630', '#30244a'] },
    emerald: { S: ['#08160f', '#10281e', '#1a4232', '#265e48', '#367a62'], G: ['#2fbf7f', '#8dffcb', '#eafff6'], D: ['#08120e', '#14221c', '#22362c'] }
  };
  var HORNB = {
    bronze: { S: ['#24150a', '#4a2e12', '#764e20', '#a6762c', '#d2a048', '#f6d88e'], spec: '#fff4cc', D: ['#1a1008', '#33200e', '#4e3418'] },
    iron: { S: ['#11141c', '#222836', '#363e52', '#525c76', '#7a86a2', '#b2bed8'], spec: '#eef2ff', D: ['#0c0e14', '#1a1e28', '#2c3242'] }
  };
  // dome shaded from the top-left; only the part above baseY is filled (flat belly)
  function dome(b, cx, cy, rx, ry, baseY, R, spec) {
    for (var y = Math.floor(cy - ry - 1); y <= baseY; y++) for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!inE(x, y, cx, cy, rx, ry)) continue;
      var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, l = -0.5 * nx - 0.85 * ny;
      var k = l > 0.78 ? R.length - 1 : l > 0.45 ? R.length - 2 : l > 0.05 ? R.length - 3 : l > -0.4 ? 1 : 0;
      px(b, x, y, R[Math.max(0, k)]);
    }
    if (spec) { px(b, cx - rx * 0.45, cy - ry * 0.7, spec); px(b, cx - rx * 0.3, cy - ry * 0.8, spec); }
  }
  // six legs: near legs in front of the body, far legs behind (darker)
  function beetleLegs(far, near, D, hips, step, lift, curl, footY) {
    for (var k = 0; k < hips.length; k++) {
      var hx = hips[k], ph = (k % 2 ? -step : step);
      var kx = hx + (k === 0 ? -2 : k === 2 ? 2 : 0) + ph, ky = footY - 3 - (curl ? 2 : 0), fx = hx + (k === 0 ? -3 : k === 2 ? 3 : 0) + ph * 2, fy = footY - (ph > 0 ? lift : 0) - (curl ? 4 : 0);
      if (curl) { kx = hx + (kx - hx) * 0.5; fx = hx + (fx - hx) * 0.3; }
      fx = Math.max(1, fx); kx = Math.max(1, kx);
      line(far, hx + 1, footY - 4, kx + 1, ky - 1, D[1]); line(far, kx + 1, ky - 1, fx + 1, fy - 1, D[1]);
      line(near, hx, footY - 4, kx, ky, D[2]); line(near, kx, ky, fx, fy, D[2]); px(near, kx, ky, D[2]); px(near, fx + 1, fy, D[1]);
    }
  }
  function drawGloombeetle(v, anim, i) {
    var P = GLOOMB[v], S = P.S, G = P.G, b = mk(20, 14);
    if (anim === 'die' && i === 3) { var o = mk(20, 14); blit(o, deathPuff(3), 2, -2); return o; }
    var ox = -1, oy = 0, tilt = 0, step = 0, glow = 1, ant = 0, speed = 0, belly = false;
    if (anim === 'idle') { glow = [1, 2][i]; ant = i; }
    else if (anim === 'move') { step = [1, 0, -1, 0][i]; oy = [0, 1, 0, 1][i] * 0; ant = i % 2; }
    else if (anim === 'attack') { tilt = 1; glow = 2; ant = 2; ox = [-1, -0.5, 0][i]; speed = i; }
    else if (anim === 'hurt') { ox = -1; glow = 0; }
    else if (anim === 'die') { belly = true; glow = [1, 0, 0][i]; }
    var far = mk(20, 14), body = mk(20, 14), near = mk(20, 14), k;
    if (belly) { // flipped onto its back, legs kicking
      dome(body, 9 + ox, 8.6, 6.4, 4.4, 13, [S[0], S[1], S[2], S[2], S[3]]);
      for (var x = 0; x < 20; x++) for (var y = 0; y < 9; y++) clr(body, x, y);
      for (k = 0; k < 3; k++) { var lx = 6 + k * 3; line(near, lx, 9, lx - 1 + (k % 2) * 2, 6 - (i % 2), P.D[2]); line(near, lx - 1 + (k % 2) * 2, 6 - (i % 2), lx + (k % 2), 4, P.D[2]); }
      px(body, 12, 11, G[glow]); px(body, 7, 11, G[0]);
      over(far, body, S[0]); over(far, near, S[0]); outline(far, OL); blit(b, far, 0, 0);
      if (i === 2) blit(b, deathPuff(1), 2, -3);
      return b;
    }
    var footY = 12, baseY = 9 + oy;
    beetleLegs(far, near, P.D, [6 + ox, 9 + ox, 12 + ox], step, 1, false, footY);
    // carapace dome (tilts down at the front when charging)
    var sh = mk(20, 14);
    dome(sh, 8.5 + ox, 9.2 + oy - tilt * 0.3, 6.6, 5.2, baseY, S);
    // glowing bioluminescent markings on the shell
    for (var gx = 3; gx <= 13; gx++) { // glowing seam just inside the top of the carapace
      var topY = -1;
      for (var gy = 0; gy < 14; gy++) if (A(sh, gx + ox, gy)) { topY = gy; break; }
      if (topY >= 0 && gx > 3 && gx < 13) px(sh, gx + ox, topY + 1, (gx % 3 === 0) ? G[glow] : G[0]);
    }
    var mk2 = [[6, 7], [9, 7], [12, 8], [4, 8]];
    for (k = 0; k < mk2.length; k++) px(sh, mk2[k][0] + ox, mk2[k][1] + oy, k < 2 ? G[glow] : G[0]);
    line(sh, 3 + ox, baseY, 14 + ox, baseY, S[1]); // shell rim
    px(sh, 4 + ox, baseY - 1, G[0]); px(sh, 13 + ox, baseY - 1, G[0]);
    over(body, sh, S[0]);
    // pronotum + head (head dips when charging)
    var hd = mk(20, 14), hX = 15.6 + ox, hY = 8.6 + oy + tilt;
    dome(hd, hX, hY, 2.4, 2.6, baseY + 1, [S[0], S[1], S[2], S[3], S[3]]);
    shadeEll(hd, hX + 2.2, hY + 1.4, 1.5, 1.4, P.D.concat([S[2]]), 2);
    px(hd, Math.round(hX + 2.6), Math.round(hY + 0.8), G[2]); // eye
    // mandibles
    px(hd, Math.min(17, Math.round(hX + 3.6)), Math.round(hY + 1.6), P.D[2]); px(hd, Math.min(18, Math.round(hX + 4)), Math.round(hY + 2.4), P.D[2]);
    over(body, hd, S[0]);
    // antennae with glowing club tips
    var aBase = [Math.round(hX + 2), Math.round(hY - 0.4)];
    var sw = ant === 2 ? -2 : ant ? 1 : 0; // antennae sweep back when charging
    var a1 = [Math.min(17.5, aBase[0] + 2 + sw * 0.4), aBase[1] - 1.6], a2 = [Math.min(18, aBase[0] + 4.2 + sw), aBase[1] - 2.6 - (ant === 1 ? 1 : 0)];
    pline(body, [aBase[0], aBase[1], a1[0], a1[1], a2[0], a2[1]], P.D[2]);
    pline(body, [aBase[0] - 1, aBase[1], a1[0] - 1.5, a1[1] - 0.5, a2[0] - 2, a2[1] - 1], P.D[1]);
    px(body, a2[0], a2[1], G[1]); px(body, a2[0] - 2, a2[1] - 1, G[0]);
    over(far, body, S[0]);
    over(far, near, S[0]);
    outline(far, OL);
    blit(b, far, 0, 0);
    if (speed >= 1) { line(b, 0, 5, 2, 5, G[1], 0.6); line(b, 0, 8, 1, 8, G[0], 0.6); if (speed === 2) cloud(b, [[1.5, 11.5, 1.3]], ['#1a2420', '#3a4840', '#5e6e64', '#8a9a8e', '#bccabe'], 0.6, false); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('gloombeetle', {
    w: 20, h: 14, ax: 10, ay: 13,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['violet', 'emerald'],
    fps: { idle: 2, move: 10, attack: 9, die: 7 },
    draw: drawGloombeetle
  });
  function drawHornbeetle(v, anim, i) {
    var P = HORNB[v], S = P.S, b = mk(22, 16);
    var dust = ['#2a2018', '#4a3a2e', '#6e5c4a', '#94826c', '#c0b098'], dspk = ['#fff1c8', '#e8d8b8', '#c8b898', '#9c8a72'];
    if (anim === 'die' && i === 3) { var o = mk(22, 16); blit(o, deathPuff(3, dust, dspk), 3, 0); return o; }
    var ox = -1.4, oy = 0, step = 0, horn = 0, crouch = 0, belly = false, debris = false;
    if (anim === 'idle') { oy = i; }
    else if (anim === 'move') { step = [1, 0, -1, 0][i]; }
    else if (anim === 'attack') { if (i === 0) { ox = -1.8; crouch = 1; horn = 1; } if (i === 1) { ox = -0.6; horn = 1; } if (i === 2) { ox = -1; horn = -1; debris = true; } }
    else if (anim === 'hurt') { ox = -1.8; }
    else if (anim === 'die') { belly = i >= 1; }
    var far = mk(22, 16), body = mk(22, 16), near = mk(22, 16), k;
    if (belly) {
      dome(body, 10, 10.5, 7, 4.6, 15, [S[1], S[2], S[3], S[3], S[4], S[5]]);
      for (var x = 0; x < 22; x++) for (var y = 0; y < 11; y++) clr(body, x, y);
      for (k = 0; k < 3; k++) { var lx = 6 + k * 4; line(near, lx, 11, lx - 1 + (k % 2) * 2, 7, P.D[2]); line(near, lx - 1 + (k % 2) * 2, 7, lx + (k % 2), 5, P.D[2]); }
      line(body, 17, 12, 20, 10, S[4]); line(body, 20, 10, 20, 8, S[5]); // horn, toppled
      over(far, body, S[0]); over(far, near, S[0]); outline(far, OL); blit(b, far, 0, 0);
      if (i === 2) blit(b, deathPuff(1, dust, dspk), 3, -1);
      return b;
    }
    var footY = 14, baseY = 11 + oy + crouch;
    beetleLegs(far, near, P.D, [6 + ox, 10 + ox, 14 + ox], step, 1, false, footY);
    var sh = mk(22, 16);
    dome(sh, 9 + ox, 11.4 + oy + crouch, 6.6, 6.2, baseY, S, P.spec);
    line(sh, 9 + ox, 5 + oy + crouch, 9 + ox, baseY - 1, S[2]); // seam between the wing cases
    line(sh, 3 + ox, baseY, 15 + ox, baseY, S[1]);
    over(body, sh, S[0]);
    // pronotum + head + the great horn
    var hd = mk(22, 16), hX = 15.8 + ox, hY = 10.4 + oy + crouch;
    dome(hd, hX, hY, 2.8, 3.2, baseY + 1, [S[0], S[1], S[2], S[3], S[4], S[5]], P.spec);
    shadeEll(hd, hX + 2.4, hY + 1.6, 1.6, 1.4, [S[0], S[1], S[2], S[3]], 2);
    // the great curved head horn (thick base, sweeping up and back) + a forward thoracic horn
    var hb = [hX + 3.4, hY + 1.2], H;
    if (horn === 1) H = [[hb[0] + 2, hb[1] - 1], [hb[0] + 3.6, hb[1] - 2.2], [hb[0] + 4.4, hb[1] - 3.6]];
    else if (horn === -1) H = [[hb[0] + 1.2, hb[1] - 3], [hb[0] + 1, hb[1] - 6], [hb[0] - 0.4, hb[1] - 8]];
    else H = [[hb[0] + 1.6, hb[1] - 2.4], [hb[0] + 2, hb[1] - 5], [hb[0] + 1, hb[1] - 7]];
    for (k = 0; k < 3; k++) { H[k][0] = Math.min(19.5, H[k][0]); H[k][1] = Math.max(1, H[k][1]); }
    line(hd, hb[0], hb[1], H[0][0], H[0][1], S[4]); line(hd, Math.min(20, hb[0] + 1), hb[1], Math.min(20, H[0][0] + 1), H[0][1], S[2]); line(hd, hb[0] - 1, hb[1], H[0][0] - 1, H[0][1], S[3]);
    line(hd, H[0][0], H[0][1], H[1][0], H[1][1], S[4]); line(hd, Math.min(20, H[0][0] + 1), H[0][1], Math.min(20, H[1][0] + 1), H[1][1], S[2]);
    line(hd, H[1][0], H[1][1], H[2][0], H[2][1], S[5]);
    var th = [hX - 0.4, hY - 3.2];
    line(hd, th[0], th[1], th[0] + 2.2, th[1] - 1, S[4]); px(hd, th[0] + 2.2, th[1] - 1, S[5]);
    px(hd, Math.round(hX + 2.2), Math.round(hY + 0.8), P.D[0]); // eye
    over(body, hd, S[0]);
    over(far, body, S[0]);
    over(far, near, S[0]);
    outline(far, OL);
    blit(b, far, 0, 0);
    if (anim === 'attack' && i === 1) { line(b, 0, 7, 2, 7, '#ffffff', 0.5); line(b, 0, 10, 1, 10, '#ffffff', 0.4); }
    if (debris) { px(b, 20, 2, S[5]); px(b, 18, 1, '#ffffff'); px(b, 20, 5, S[3]); cloud(b, [[17, 13.5, 1.4], [20, 14, 1]], dust, 0.6, false); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('hornbeetle', {
    w: 22, h: 16, ax: 11, ay: 15,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['bronze', 'iron'],
    fps: { idle: 2, move: 6, attack: 7, die: 6 },
    draw: drawHornbeetle
  });

  // ======================================================================= HOLLOWSTAG (40x40) — spectral stag of pale teal light (forest mini-boss)
  var STAG = { C: ['#0b3436', '#145a5a', '#2a8e88', '#5cc8bc', '#a8f0e4', '#e8fffa'], hoof: '#0e4446', eye: '#ffffff' };
  function stagLeg(b, hip, knee, hoof, near) {
    var C = STAG.C, c = near ? C[3] : C[2];
    line(b, hip[0], hip[1], knee[0], knee[1], c); line(b, hip[0] + 1, hip[1], knee[0] + 1, knee[1] + 1, near ? C[2] : C[1]);
    line(b, knee[0], knee[1], hoof[0], hoof[1] - 1, c);
    px(b, hoof[0], hoof[1], STAG.hoof);
  }
  // antler: main beam through pts, tines as [fromIndex, dx, dy]
  function stagAntler(b, pts, tines, col, tip) {
    for (var k = 0; k < pts.length; k++) { pts[k][0] = Math.max(1, Math.min(38, pts[k][0])); pts[k][1] = Math.max(1, pts[k][1]); }
    for (k = 0; k + 1 < pts.length; k++) line(b, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], col);
    for (k = 0; k < tines.length; k++) {
      var p0 = pts[tines[k][0]], x1 = Math.max(1, Math.min(38, p0[0] + tines[k][1])), y1 = Math.max(1, p0[1] + tines[k][2]);
      line(b, p0[0], p0[1], x1, y1, col); px(b, x1, y1, tip);
    }
    var last = pts[pts.length - 1]; px(b, last[0], last[1], tip);
  }
  function drawStag(v, anim, i) {
    var C = STAG.C, b = mk(40, 40);
    var ox = 0, oy = 0, ph = i * Math.PI / 2, head = 'up', rear = 0, alpha = 0.72, kneel = 0, lying = false, stomp = false, charge = false, fade = 0;
    var L = { nf: [[25, 25], [25.5, 31], [25, 38]], ff: [[22.5, 25], [22.5, 31], [22, 38]], nh: [[12, 25], [14, 31], [12.5, 38]], fh: [[9.5, 25], [11.5, 31], [10, 38]] };
    function step(k, dx, lift) { L[k][1][0] += dx * 0.5; L[k][2][0] += dx; L[k][2][1] -= lift; L[k][1][1] -= lift * 0.5; }
    if (anim === 'idle') { oy = [0, 0, 1, 1][i] * 0; }
    else if (anim === 'move') { var st = [1, 0, -1, 0][i]; step('nf', st * 2, st > 0 ? 1 : 0); step('fh', st * 2, st > 0 ? 1 : 0); step('ff', -st * 2, st < 0 ? 1 : 0); step('nh', -st * 2, st < 0 ? 1 : 0); oy = i % 2 ? -1 : 0; }
    else if (anim === 'attack') {
      if (i === 0) { rear = 1; L.nf = [[25, 25], [28, 24], [29, 28]]; L.ff = [[22.5, 25], [26, 25], [26.5, 29]]; head = 'up'; }
      if (i === 1) { stomp = true; head = 'up'; step('nf', 1, 0); }
      if (i === 2) { head = 'low'; oy = 1; step('nh', -1, 0); step('fh', -1, 0); }
      if (i === 3) { head = 'low'; ox = 1; charge = true; step('nf', 2, 1); step('ff', 1, 0); step('nh', -2, 0); }
    } else if (anim === 'hurt') { head = 'low'; ox = -1; }
    else if (anim === 'die') {
      if (i === 0) { head = 'low'; oy = 1; }
      if (i === 1) { kneel = 1; head = 'low'; alpha = 0.62; }
      if (i >= 2) { lying = true; alpha = [0.5, 0.25, 0][i - 2]; fade = i - 1; head = 'rest'; }
    }
    var body = mk(40, 40), bx = 17 + ox, by = 21.5 + oy + (kneel ? 2 : 0);
    if (lying) { by = 31; }
    var kdrop = kneel ? 4 : 0;
    // legs (far first) — folded when kneeling/lying
    if (!lying) {
      if (kneel) { L.nf = [[25, 26], [27, 32], [23, 36]]; L.ff = [[22.5, 26], [24.5, 32], [20.5, 36]]; }
      var sh = function (p) { return [p[0] + ox, p[1] + oy]; }, shf = function (p) { return [p[0] + ox, p[1]]; };
      stagLeg(body, sh(L.ff[0]), sh(L.ff[1]), shf(L.ff[2]), false); stagLeg(body, sh(L.fh[0]), sh(L.fh[1]), shf(L.fh[2]), false);
    }
    // torso, haunch, chest
    var tor = mk(40, 40);
    var fy = by + (kneel ? 2 : 0);
    shadeEll(tor, bx - 6.5, by - 0.3, 4, 4.4, C.slice(1), 4);
    shadeEll(tor, bx, by + 0.3, 7.6, lying ? 3.6 : 3.8, C.slice(1), 4);
    shadeEll(tor, bx + 7, fy - 0.4, 4, lying ? 4 : 4.9, C.slice(1), 4);
    // the hollow: a soft dark heart-shaped cavity in the chest holding a small lonely light
    var hx0 = Math.round(bx + 5.5), hy0 = Math.round(fy - 1);
    spr(tor, ['dd.dd', 'ddddd', '.ddd.', '..d..'], { d: C[1] }, hx0 - 2, hy0 - 1);
    px(tor, hx0, hy0, fade ? C[3] : '#ffffff'); px(tor, hx0 - 1, hy0, C[4]); px(tor, hx0 + 1, hy0, C[4]); px(tor, hx0, hy0 + 1, C[3]);
    // short upturned tail
    px(tor, Math.round(bx - 10), Math.round(by - 4), C[4]); px(tor, Math.round(bx - 11), Math.round(by - 5), C[5]);
    over(body, tor, C[0]);
    // neck + head
    var hd = mk(40, 40), hX, hY, mdx, mdy;
    if (head === 'low') { hX = bx + 15; hY = by - 4; mdx = 3; mdy = 1.6; }
    else if (head === 'rest') { hX = bx + 14; hY = by - 1; mdx = 3.2; mdy = 0.8; }
    else { hX = bx + 14; hY = by - 11 + (kneel ? 2 : 0); mdx = 3.1; mdy = 1.3; }
    // gently S-curved neck
    poly(hd, [bx + 5.5, by - 3.4, bx + 9.5, by - 2.6, hX + 0.4, hY + 3.6, hX + 1.4, hY + 1.4, hX - 1.2, hY - 0.8, hX - 2.2, hY + 2.4, bx + 8, by - 6], function (x, y) { return x < hX - 1.5 ? C[3] : C[2]; });
    shadeEll(hd, hX, hY, 2.8, 2.2, C.slice(1), 4);
    shadeEll(hd, hX + mdx, hY + mdy, 2, 1.3, C.slice(1), 4);
    px(hd, Math.round(hX + mdx + 1.8), Math.round(hY + mdy - 0.4), C[0]); // nose
    px(hd, Math.round(hX - 1.6), Math.round(hY - 2.2), C[4]); px(hd, Math.round(hX - 2.4), Math.round(hY - 2.8), C[3]); // ear
    // spectral mane drifting off the neck
    for (var m = 0; m < 4; m++) {
      var mx0 = bx + 9 - m * 1.2 + (head === 'up' ? 2 : 0), my0 = by - 5 - (head === 'up' ? 4 - m : 0) + m * 0.3;
      for (var q = 0; q < 4; q++) px(hd, mx0 - q * 0.9, my0 + q * 0.7 + Math.sin(ph + m + q) * 0.6, C[4], 0.7 - q * 0.15);
    }
    over(body, hd, C[0]);
    // near legs
    if (!lying) {
      var sh2 = function (p) { return [p[0] + ox, p[1] + oy]; }, shf2 = function (p) { return [p[0] + ox, p[1]]; };
      stagLeg(body, sh2(L.nf[0]), sh2(L.nf[1]), shf2(L.nf[2]), true); stagLeg(body, sh2(L.nh[0]), sh2(L.nh[1]), shf2(L.nh[2]), true);
    } else { line(body, bx + 4, by + 3, bx + 10, by + 4, C[3]); line(body, bx - 7, by + 3, bx - 2, by + 4, C[3]); }
    // rearing: lift the front half
    if (rear) {
      var r2 = mk(40, 40);
      eachPx(body, function (x, y, r, g, bl, a) { var dy = x > 14 ? Math.round((x - 14) * 0.26) : 0; px(r2, x, y - dy, [r, g, bl, a]); });
      body = r2; hY -= Math.round((hX - 14) * 0.26);
    }
    // translucent body: soft dark-teal edge, bright rim on the lit side, then the whole thing at partial alpha
    var edged = clone(body);
    outline(edged, C[1]);
    var rim = mk(40, 40);
    eachPx(body, function (x, y) { if (!A(body, x, y - 1) || !A(body, x - 1, y)) px(rim, x, y, C[5]); });
    blit(b, edged, 0, 0, false, alpha * 0.8);
    blit(b, rim, 0, 0, false, Math.min(1, alpha + 0.2));
    // antlers + eye: opaque glowing cores (the engine adds the halo)
    var aBase = [Math.round(hX + 0.4), Math.round(hY - 2)], low = head === 'low', rest = head === 'rest';
    var dirx = low ? 1 : -1;
    var nearA, farA, tN, tF;
    if (low) { // swept forward, ready to charge
      nearA = [[aBase[0], aBase[1]], [aBase[0] + 3, aBase[1] - 2], [aBase[0] + 6, aBase[1] - 2], [Math.min(38, aBase[0] + 9), aBase[1] - 4]];
      farA = [[aBase[0] - 1, aBase[1]], [aBase[0] + 1, aBase[1] - 3], [aBase[0] + 4, aBase[1] - 5], [aBase[0] + 6, aBase[1] - 8]];
      tN = [[1, 0, -3], [2, 1, -3]]; tF = [[1, -1, -3], [2, 0, -3]];
    } else {
      var vs = rear ? 0.45 : 1; // antlers sweep flatter while rearing
      nearA = [[aBase[0], aBase[1]], [aBase[0] - 1.5, aBase[1] - 3 * vs], [aBase[0] - 4, aBase[1] - 4.5 * vs], [aBase[0] - 7.5, aBase[1] - 5 * vs], [aBase[0] - 11, aBase[1] - 4.5 * vs], [aBase[0] - 13.5, aBase[1] - 2.5 * vs]];
      farA = [[aBase[0] - 1, aBase[1]], [aBase[0] - 3, aBase[1] - 2 * vs], [aBase[0] - 6, aBase[1] - 3 * vs], [aBase[0] - 9.5, aBase[1] - 3 * vs], [aBase[0] - 12.5, aBase[1] - 1.5 * vs]];
      tN = [[1, 3, -3 * vs], [2, 1, -3], [3, 0, -3], [4, -1, -3], [5, -1, -2]]; tF = [[1, 1, -2], [2, 0, -3], [3, -1, -3], [4, -1, -2]];
    }
    if (rest) { for (var z = 0; z < farA.length; z++) { farA[z][1] = Math.max(farA[z][1], 20); } }
    var ant = mk(40, 40);
    var aal = lying ? alpha + 0.25 : 1;
    stagAntler(ant, farA, tF, C[4], C[5]);
    stagAntler(ant, nearA, tN, C[5], '#ffffff');
    blit(b, ant, 0, 0, false, Math.min(1, aal));
    if (!lying || fade < 2) { var eX = Math.round(hX + 1), eY = Math.round(hY - 0.6); px(b, eX, eY, STAG.eye, lying ? 0.5 : 1); px(b, eX + 1, eY, C[5], lying ? 0.4 : 0.9); }
    // drifting motes of light
    var nm = lying ? 10 + fade * 4 : 7;
    for (var k = 0; k < nm; k++) {
      var mx = 4 + hash(k, 1, 13) * 32, my = 36 - ((hash(k, 2, 13) * 34 + i * 3 + k) % 34);
      px(b, mx + Math.sin(i + k) * 1.2, my, k % 3 ? C[4] : '#ffffff', lying ? 0.9 : 0.7);
    }
    if (stomp) { ringE(b, bx + 9, 37.4, 7, 1.4, C[5], 0.85); ringE(b, bx + 9, 37.4, 10, 1.9, C[4], 0.45); px(b, bx + 2, 34, '#ffffff'); px(b, bx + 16, 34, '#ffffff'); }
    if (charge) { line(b, 2, 18, 7, 18, C[4], 0.55); line(b, 1, 23, 5, 23, C[4], 0.45); line(b, 3, 28, 7, 28, C[4], 0.35); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('hollowstag', {
    w: 40, h: 40, ax: 20, ay: 39,
    anims: { idle: 4, move: 4, attack: 4, hurt: 1, die: 5 },
    variants: ['default'],
    fps: { idle: 4, move: 6, attack: 6, die: 5 },
    draw: drawStag
  });

  // ======================================================================= CRITTERS (non-hostile, Hushwillow Glade) — softer, rounder style
  var CRITTERS = Object.create(null), CRITTER_IDS = [];
  function defCritter(id, def) { CRITTERS[id] = def; CRITTER_IDS.push(id); }
  // soft round blob: smooth 4-tone shading lit from the top-left (no texture)
  function soft(b, cx, cy, rx, ry, R) {
    for (var y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!inE(x, y, cx, cy, rx, ry)) continue;
      var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, l = -0.5 * nx - 0.8 * ny;
      px(b, x, y, R[l > 0.55 ? 3 : l > -0.05 ? 2 : l > -0.6 ? 1 : 0]);
    }
  }
  // ---- fox (16x12): curled asleep, tail over its nose
  var FOX = { F: ['#8a3c1e', '#bc5c2a', '#dc8040', '#f2a868'], W: ['#d8ccb8', '#fff8ec'], dk: '#3a1e14', ol: '#3a1a10' };
  function drawFox(anim, i) {
    var b = mk(16, 12), F = FOX.F, lay = mk(16, 12), ct = '#5a2414';
    var sleep = anim === 'sleep', br = sleep && (i === 1) ? 0.3 : 0, twitch = sleep && i === 3, swish = !sleep && i === 1;
    var Wt = [FOX.W[0], FOX.W[0], FOX.W[1], FOX.W[1]], ear = { k: FOX.dk, O: F[1], L: F[2] };
    // darker curled back
    soft(lay, 6.2, 7.4 - br * 0.6, 4.4, 3.3 + br, ['#7a3018', '#9a4220', '#b4562a', '#cc6c34']);
    // head resting on the curl: lighter, with bold dark-tipped ears
    var hd = mk(16, 12), hx = sleep ? 10.8 : 11, hy = sleep ? 6 : 5.4;
    soft(hd, hx, hy, 2.7, 2.3, [F[1], F[2], F[3], '#f8c48c']);
    spr(hd, ['.k', 'kO', 'OL'], ear, Math.round(hx - 2.4), Math.round(hy - 4.3));
    if (twitch) spr(hd, ['kO.', '.OL'], ear, Math.round(hx + 0.2), Math.round(hy - 3.1));
    else spr(hd, ['k.', 'Ok', 'LO'], ear, Math.round(hx + 0.1), Math.round(hy - 4.5));
    if (sleep) { px(hd, hx + 0.3, hy - 0.1, FOX.dk); px(hd, hx + 1.3, hy + 0.3, FOX.dk); soft(hd, hx + 0.4, hy + 1.6, 1.5, 0.8, Wt); }
    else {
      soft(hd, hx + 2.3, hy + 1, 1.5, 0.9, [F[2], FOX.W[0], FOX.W[1], FOX.W[1]]);
      px(hd, hx + 3.6, hy + 0.7, FOX.dk);
      px(hd, hx + 0.7, hy - 0.3, FOX.dk); px(hd, hx + 0.7, hy - 1, '#ffffff');
    }
    over(lay, hd, ct);
    // big bushy tail wrapped around the front, white tip over the nose
    var tl = mk(16, 12);
    soft(tl, 7.4, 9.7, 6.2, 1.8, [F[1], F[2], F[3], '#f8c48c']);
    soft(tl, 13.2 - (swish ? 0.6 : 0), sleep ? 8.7 : 9.1 - (swish ? 0.6 : 0), 1.8, 1.5, Wt);
    over(lay, tl, ct);
    outline(lay, FOX.ol);
    blit(b, lay, 0, 0);
    return b;
  }
  defCritter('fox', { w: 16, h: 12, ax: 8, ay: 11, anims: { sleep: 4, idle: 2 }, fps: { sleep: 1.5, idle: 2 }, draw: drawFox });
  // ---- deer (24x16): lying down, head tucked; awake with head up
  var DEER = { F: ['#6a4430', '#946446', '#b88a64', '#dcb48c'], spot: '#f6ead6', belly: ['#d8c0a0', '#f0e2cc'], dk: '#2a1d1a', ear: '#e89ab8', ol: '#2e1c14' };
  function drawDeer(anim, i) {
    var b = mk(24, 16), F = DEER.F, lay = mk(24, 16);
    var sleep = anim === 'sleep', br = sleep && i === 1 ? 0.3 : 0, flick = (sleep && i === 2) || (!sleep && i === 1);
    // folded legs
    soft(lay, 18, 13.6, 2.2, 1.2, F); soft(lay, 7, 13.6, 2.4, 1.2, F);
    px(lay, 20, 14, DEER.dk); px(lay, 5, 14, DEER.dk);
    // body with fawn spots
    var body = mk(24, 16);
    soft(body, 12, 11.2 - br, 8.4, 3.5 + br, F);
    soft(body, 12.6, 13.2, 5, 1.2, [DEER.belly[0], DEER.belly[0], DEER.belly[1], DEER.belly[1]]);
    var sp = [[8, 9], [10, 8.6], [12, 9.2], [14, 8.7], [9.5, 10.6], [13, 10.6], [16, 9.4]];
    for (var k = 0; k < sp.length; k++) px(body, sp[k][0], sp[k][1] - br, DEER.spot);
    px(body, 3.4, 9.4, DEER.belly[1]); px(body, 3.8, 10, DEER.belly[1]); // little white tail
    over(lay, body, F[0]);
    var hd = mk(24, 16);
    if (sleep) { // head turned back, resting on the flank
      soft(hd, 16, 8 - br, 2.6, 1.9, F);
      soft(hd, 13.6, 8.6 - br, 1.6, 1.1, F); px(hd, 12.4, 8.6 - br, DEER.dk);
      px(hd, 15.8, 7.6 - br, DEER.dk); px(hd, 16.8, 7.8 - br, DEER.dk); // closed eye
      var eY = flick ? 5.8 : 6.6;
      line(hd, 17.6, 7 - br, 19.6, eY - br, F[1]); px(hd, 19, eY + 0.2 - br, DEER.ear);
    } else { // awake: neck and head up, ears perked
      poly(hd, [16, 10, 19, 9.6, 20.4, 5.4, 18.4, 5], F[2]);
      soft(hd, 19.6, 4.6, 2.4, 1.9, F);
      soft(hd, 21.8, 5.4, 1.5, 1.1, F); px(hd, 22.9, 5.2, DEER.dk);
      px(hd, 20.2, 4, DEER.dk); px(hd, 20.2, 3.4, '#ffffff');
      px(hd, 18, 2.4 + (flick ? 0.6 : 0), F[2]); px(hd, 17.4, 1.8 + (flick ? 0.6 : 0), F[1]); px(hd, 18.2, 3, DEER.ear);
    }
    over(lay, hd, F[0]);
    outline(lay, DEER.ol);
    blit(b, lay, 0, 0);
    return b;
  }
  defCritter('deer', { w: 24, h: 16, ax: 12, ay: 15, anims: { sleep: 3, idle: 2 }, fps: { sleep: 1.5, idle: 2 }, draw: drawDeer });
  // ---- rabbit (12x12): sleeping loaf; nose-wiggle idle; little hops
  var RAB = { F: ['#7a6a62', '#a8988a', '#d0c4b4', '#f0e8dc'], pink: '#e89ab8', dk: '#2e2826', tail: '#ffffff', ol: '#2e2622' };
  function drawRabbit(anim, i) {
    var b = mk(12, 12), F = RAB.F, lay = mk(12, 12);
    if (anim === 'sleep') {
      var br = i === 1 ? 0.3 : 0;
      soft(lay, 1.8, 8, 1.2, 1.1, [F[3], F[3], RAB.tail, RAB.tail]); // tail puff
      soft(lay, 5.8, 8.4 - br * 0.5, 4.4, 2.6 + br, F);
      soft(lay, 8.6, 7.8, 2.2, 1.9, F);
      var ears = mk(12, 12); soft(ears, 5.2, 5.4 - br, 3.2, 1, F); line(ears, 3.4, 5.4 - br, 6.6, 5.4 - br, RAB.pink); px(ears, 2.2, 5.6 - br, F[1]); over(lay, ears, F[1]);
      px(lay, 8.8, 7.4, RAB.dk); px(lay, 9.6, 7.6, RAB.dk); // closed eye
      px(lay, 10.6, 8.2, RAB.pink);
    } else if (anim === 'idle') {
      soft(lay, 2.2, 8.6, 1.1, 1, [F[3], F[3], RAB.tail, RAB.tail]);
      soft(lay, 5.6, 8.4, 3.6, 2.8, F);
      soft(lay, 7.6, 5.2, 2.2, 2, F);
      var e2 = mk(12, 12); soft(e2, 6.2, 3, 0.9, 2, F); soft(e2, 8, 2.8, 0.9, 2.1, F); px(e2, 8, 2.4, RAB.pink); px(e2, 8, 3.4, RAB.pink); over(lay, e2, F[0]);
      px(lay, 8.2, 4.6, RAB.dk); px(lay, 8.2, 4, '#ffffff');
      px(lay, 9.6, 5.6 + (i === 1 ? -0.8 : i === 2 ? 0.6 : 0), RAB.pink); // nose wiggle
      px(lay, 7.6, 10, F[2]); px(lay, 8.6, 10, F[2]); // front paws
    } else { // hop
      var lift = [0, 1, 1.6, 0][i], st = [0, 1, 0, -1][i];
      soft(lay, 2.2 - st * 0.3, 8 - lift, 1.1, 1, [F[3], F[3], RAB.tail, RAB.tail]);
      soft(lay, 5.6, 8.4 - lift - (st > 0 ? 0.5 : 0), 3.8 + st * 0.5, 2.6 - st * 0.3, F);
      soft(lay, 8.2, 6.2 - lift - st * 0.5, 2, 1.8, F);
      var e3 = mk(12, 12); soft(e3, 6.4 - st * 0.6, 3.9 - lift * 0.6, 0.9, 1.8, F); soft(e3, 7.6 - st * 0.6, 3.7 - lift * 0.6, 0.9, 1.9, F); px(e3, 7.6 - st * 0.6, 3.6 - lift, RAB.pink); over(lay, e3, F[0]);
      px(lay, 8.8, 5.8 - lift - st * 0.5, RAB.dk); px(lay, 10, 6.6 - lift - st * 0.5, RAB.pink);
      if (st > 0) { line(lay, 3, 9.6 - lift, 1.5, 10 - lift, F[1]); } else { px(lay, 4, 10 - lift, F[1]); px(lay, 8, 10 - lift, F[1]); }
      if (lift) shadowE(lay, 6, 11.4, 3, 0.6, 0.3);
    }
    outline(lay, RAB.ol);
    blit(b, lay, 0, 0);
    return b;
  }
  defCritter('rabbit', { w: 12, h: 12, ax: 6, ay: 11, anims: { sleep: 2, idle: 3, move: 4 }, fps: { sleep: 1.5, idle: 4, move: 8 }, draw: drawRabbit });
  // ---- owl (14x16): dozing on a branch; occasionally peeks with one eye
  var OWL = { F: ['#5a4234', '#866448', '#b08e6a', '#d8bc94'], face: ['#d8c4a0', '#ecdcbc'], beak: '#e8a03c', eye: ['#ffbc62', '#fff1c8'], dk: '#2a1d1a', ol: '#2a1d1a' };
  function drawOwl(anim, i) {
    var b = mk(14, 16), F = OWL.F, lay = mk(14, 16);
    var sleep = anim === 'sleep', br = sleep && i === 1 ? 0.3 : 0, peek = sleep && i === 3, tilt = !sleep && i === 1 ? 1 : 0;
    // branch with a couple of leaves
    var br2 = mk(14, 16);
    line(br2, 2, 13, 12, 13, WOOD[3]); line(br2, 1, 14, 11, 14, WOOD[2]); px(br2, 11, 12, WOOD[3]); px(br2, 12, 11, WOOD[3]);
    px(br2, 2, 12, '#4c9061'); px(br2, 3, 12, '#74b46e'); px(br2, 2, 11, '#74b46e');
    // body, belly speckles, folded wings
    soft(lay, 7, 8.8 - br * 0.5, 4.2, 4.2 + br, F);
    soft(lay, 7.4, 9.8, 2.6, 2.6, [OWL.face[0], OWL.face[0], OWL.face[1], OWL.face[1]]);
    px(lay, 6.6, 9.4, F[1]); px(lay, 8.2, 10.4, F[1]); px(lay, 7, 11.2, F[1]);
    line(lay, 3, 8, 3, 11, F[0]); line(lay, 11, 8, 11, 11, F[0]); px(lay, 3, 9, F[2]); px(lay, 11, 10, F[2]);
    // facial disc and ear tufts
    var fx = 7.4 + tilt * 0.5;
    soft(lay, fx, 6.6, 3.2, 2.3, [OWL.face[0], OWL.face[0], OWL.face[1], OWL.face[1]]);
    px(lay, 4.4, 3.6, F[1]); px(lay, 4.8, 4.4, F[2]); px(lay, 10, 3.6 + tilt, F[1]); px(lay, 9.6, 4.4, F[2]);
    // eyes: closed arcs, one peeking, or wide open
    var exL = Math.round(fx - 1.6), exR = Math.round(fx + 1.4), ey = 6;
    if (sleep) {
      px(lay, exL - 1, ey + 1, OWL.dk); px(lay, exL, ey + 1, OWL.dk);
      if (peek) { px(lay, exR, ey, OWL.eye[0]); px(lay, exR + 1, ey, OWL.eye[0]); px(lay, exR, ey + 1, OWL.dk); px(lay, exR + 1, ey + 1, OWL.eye[0]); line(lay, exR - 1, ey - 1, exR + 1, ey - 1, F[0]); }
      else { px(lay, exR, ey + 1, OWL.dk); px(lay, exR + 1, ey + 1, OWL.dk); }
    } else {
      rect(lay, exL - 1, ey, 2, 2, OWL.eye[0]); px(lay, exL, ey + 1, OWL.dk); px(lay, exL - 1, ey, OWL.eye[1]);
      rect(lay, exR, ey, 2, 2, OWL.eye[0]); px(lay, exR + 1, ey + 1, OWL.dk); px(lay, exR, ey, OWL.eye[1]);
    }
    px(lay, Math.round(fx), 7.6, OWL.beak); px(lay, Math.round(fx), 8.4, '#b8742a');
    // talons gripping the branch
    px(lay, 6, 12.4, OWL.beak); px(lay, 8.4, 12.4, OWL.beak);
    over(br2, lay, OWL.ol);
    outline(br2, OWL.ol);
    blit(b, br2, 0, 0);
    return b;
  }
  defCritter('owl', { w: 14, h: 16, ax: 7, ay: 15, anims: { sleep: 4, idle: 2 }, fps: { sleep: 1.5, idle: 1.5 }, draw: drawOwl });
  // ---- hedgehog (12x10): a curled, breathing ball of spines
  var HOG = { S: ['#4e3a2a', '#76604a', '#a08a70', '#d0bea0'], face: ['#c8a888', '#ecd6b8'], dk: '#1e1414', ol: '#2a1d1a' };
  function spines(b, cx, cy, rx, ry, S, top) {
    for (var y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!inE(x, y, cx, cy, rx, ry) || (top && y > cy + 0.5)) continue;
      var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, l = -0.5 * nx - 0.8 * ny;
      var stripe = ((x + 2 * y) % 3 === 0) ? 1 : 0; // diagonal rows of quills with pale tips
      px(b, x, y, S[Math.max(0, Math.min(3, (l > 0.35 ? 2 : l > -0.35 ? 1 : 0) + stripe))]);
    }
    for (var t = -2.9; t < 0.3; t += 0.42) { // quill tips poking out of the silhouette
      pxIn(b, cx + Math.cos(t) * (rx + 0.6), cy + Math.sin(t) * (ry + 0.6), S[3]);
    }
  }
  function drawHedgehog(anim, i) {
    var b = mk(12, 10), lay = mk(12, 10);
    if (anim === 'sleep') {
      var br = i === 1 ? 0.3 : 0;
      spines(lay, 6, 5.6 - br * 0.3, 4 + br * 0.4, 3.4 + br * 0.6, HOG.S);
      soft(lay, 9.2, 7.6, 1.6, 1.2, [HOG.face[0], HOG.face[0], HOG.face[1], HOG.face[1]]); // tucked snout
      px(lay, 10.6, 7.8, HOG.dk); px(lay, 8.6, 7.2, HOG.dk); px(lay, 9.4, 7.2, HOG.dk);
    } else {
      spines(lay, 5.4, 6.2, 4, 3, HOG.S, true);
      soft(lay, 5.4, 7.8, 3.6, 1.2, [HOG.face[0], HOG.face[0], HOG.face[1], HOG.face[1]]); // belly
      soft(lay, 9, 6.6, 1.9, 1.7, [HOG.face[0], HOG.face[0], HOG.face[1], HOG.face[1]]);
      px(lay, 10.8, 7 + (i ? -0.6 : 0), HOG.dk); // sniffing nose
      px(lay, 9.2, 6, HOG.dk); px(lay, 9.2, 5.4, '#ffffff'); px(lay, 8.2, 5, HOG.face[0]);
      px(lay, 4, 8, HOG.S[0]); px(lay, 7.6, 8, HOG.S[0]);
    }
    outline(lay, HOG.ol);
    blit(b, lay, 0, 0);
    return b;
  }
  defCritter('hedgehog', { w: 12, h: 10, ax: 6, ay: 9, anims: { sleep: 2, idle: 2 }, fps: { sleep: 1.5, idle: 3 }, draw: drawHedgehog });

  // ======================================================================= FAMILIARS (follow the player; adorable, loyal)
  var FAMILIARS = Object.create(null), FAMILIAR_IDS = [];
  function defFamiliar(id, def) { FAMILIARS[id] = def; FAMILIAR_IDS.push(id); }
  // ---- fam_owl (16x16): small round violet-grey owl, huge eyes, a tiny crescent-moon charm
  var FOWL = { F: ['#3e3858', '#5e5880', '#8a84ac', '#b8b4d4'], face: ['#cfcae6', '#f0eefa'], eye: ['#f2c45a', '#fff1c8'], dk: '#1a1426', beak: '#e8a03c', charm: ['#c8a040', '#ffe08a'], ol: '#241e36' };
  function drawFamOwl(anim, i) {
    var b = mk(16, 16), F = FOWL.F, lay = mk(16, 16);
    var fly = anim === 'fly', sleep = anim === 'sleep', bob = fly ? [0, 1, 2, 1][i] : 0, br = sleep && i === 1 ? 0.3 : 0;
    var cy = fly ? 7 + bob : 9.6;
    // wings (behind when flying: spread in four flap poses)
    if (fly) {
      var wp = [[[-6, -5], [-7, -2], [-4, 0]], [[-7, -1], [-7, 1], [-4, 1]], [[-6, 3], [-6, 5], [-3, 2]], [[-7, -2], [-6, 2], [-4, 1]]][i];
      var wing = mk(16, 16);
      for (var sd = -1; sd <= 1; sd += 2) {
        var pts = [8 + sd * 2.4, cy - 1, 8 + sd * -wp[0][0], cy + wp[0][1], 8 + sd * -wp[1][0], cy + wp[1][1], 8 + sd * -wp[2][0], cy + wp[2][1] + 1, 8 + sd * 2.4, cy + 2];
        poly(wing, pts, function (x, y) { return y < cy ? F[2] : F[1]; });
      }
      over(lay, wing, FOWL.ol);
    }
    // round body + belly + facial disc
    var bd = mk(16, 16);
    soft(bd, 8, cy, 4.6, 4.4 + br, F);
    soft(bd, 8.2, cy + 1.4, 2.8, 2.4, [FOWL.face[0], FOWL.face[0], FOWL.face[1], FOWL.face[1]]);
    soft(bd, 8.2, cy - 1.2, 3.6, 2.4, [FOWL.face[0], FOWL.face[0], FOWL.face[1], FOWL.face[1]]);
    px(bd, 4.6, cy - 4.4, F[2]); px(bd, 11.4, cy - 4.4, F[2]); // little ear tufts
    // huge eyes (closed arcs when asleep)
    var ey = Math.round(cy - 1.6);
    if (sleep) { line(bd, 5, ey + 1, 6, ey + 1, FOWL.dk); line(bd, 10, ey + 1, 11, ey + 1, FOWL.dk); }
    else {
      var blink = anim === 'perch' && i === 1;
      if (blink) { line(bd, 5, ey + 1, 7, ey + 1, FOWL.dk); line(bd, 9, ey + 1, 11, ey + 1, FOWL.dk); }
      else {
        // big round eyes: golden ring, large pupil, sparkle — adorable
        spr(bd, ['.Gg.', 'gWkg', 'gkkg', '.gg.'], { g: FOWL.eye[0], G: FOWL.eye[1], k: FOWL.dk, W: '#ffffff' }, 4, ey - 2);
        spr(bd, ['.Gg.', 'gWkg', 'gkkg', '.gg.'], { g: FOWL.eye[0], G: FOWL.eye[1], k: FOWL.dk, W: '#ffffff' }, 9, ey - 2);
      }
    }
    px(bd, 8, ey + 2, FOWL.beak); px(bd, 8, ey + 3, '#b8742a'); px(bd, 7.6, ey + 2, FOWL.beak);
    // the tiny crescent-moon charm on a string
    var cyc = Math.round(cy + 2.6);
    px(bd, 7, cyc - 1, FOWL.charm[0]); px(bd, 9, cyc - 1, FOWL.charm[0]);
    px(bd, 7, cyc, FOWL.charm[1]); px(bd, 8, cyc + 1, FOWL.charm[1]); px(bd, 7, cyc + 1, FOWL.charm[0]);
    over(lay, bd, FOWL.ol);
    // feet
    if (!fly) { px(lay, 6, 14, FOWL.beak); px(lay, 9, 14, FOWL.beak); }
    else { px(lay, 7, cy + 4.6, FOWL.beak); px(lay, 9, cy + 4.6, FOWL.beak); }
    outline(lay, FOWL.ol);
    blit(b, lay, 0, 0);
    return b;
  }
  defFamiliar('fam_owl', { w: 16, h: 16, ax: 8, ay: 15, anims: { fly: 4, perch: 2, sleep: 2 }, fps: { fly: 10, perch: 1.5, sleep: 1.5 }, base: 'perch', draw: drawFamOwl });
  // ---- fam_fox (18x14): fluffy russet fox with a white tail tip and a tiny violet scarf
  var FFOX = { F: ['#7a3018', '#a84824', '#d06a34', '#f0965a'], W: ['#e0d4c0', '#fffaf0'], dk: '#2e1610', scarf: ['#4a2f7a', '#7a58c0', '#a888e8'], ol: '#3a1a10' };
  function drawFamFox(anim, i) {
    var b = mk(18, 14), F = FFOX.F, lay = mk(18, 14), Wt = [FFOX.W[0], FFOX.W[0], FFOX.W[1], FFOX.W[1]];
    if (anim === 'sleep') { // curled up, scarf and all
      var br = i === 1 ? 0.3 : 0;
      soft(lay, 8, 9.4 - br * 0.6, 5, 3.3 + br, ['#7a3018', '#9a4220', '#b4562a', '#cc6c34']);
      var hd = mk(18, 14); soft(hd, 12.4, 8, 2.7, 2.3, [F[1], F[2], F[3], '#f8c48c']);
      spr(hd, ['.k', 'kO', 'OL'], { k: FFOX.dk, O: F[1], L: F[2] }, 10, 4); spr(hd, ['k.', 'Ok', 'LO'], { k: FFOX.dk, O: F[1], L: F[2] }, 12, 3.8);
      px(hd, 12.7, 7.9, FFOX.dk); px(hd, 13.7, 8.2, FFOX.dk);
      line(hd, 10.2, 9.8, 12.6, 10.2, FFOX.scarf[1]); px(hd, 11, 9.6, FFOX.scarf[2]);
      over(lay, hd, '#5a2414');
      var tl = mk(18, 14); soft(tl, 9, 11.7, 6.6, 1.8, [F[1], F[2], F[3], '#f8c48c']); soft(tl, 15, 10.8, 1.8, 1.5, Wt); over(lay, tl, '#5a2414');
      outline(lay, FFOX.ol); blit(b, lay, 0, 0);
      return b;
    }
    var run = anim === 'run', bob = run ? [0, 1, 0, 1][i] : 0, sw = run ? 0 : i;
    var by = 8 + bob + (run && bob < 0 ? 0 : 0);
    // legs: dark "stockings"; run cycle gathers and stretches
    var legs = run ? [[[11, 12], [12.5, 11]], [[10, 12], [13, 12]], [[11, 11], [10, 12]], [[10, 12], [11.5, 12]]][i] : [[[11, 12], [10, 12]]][0];
    var hind = run ? [[[5, 12], [3.5, 11]], [[5, 12], [6, 12]], [[4, 11], [7, 12]], [[5, 12], [4.5, 12]]][i] : [[[5, 12], [6, 12]]][0];
    var lg = mk(18, 14);
    line(lg, 10.5, by + 1.5, legs[0][0], legs[0][1], FFOX.dk); line(lg, 9.5, by + 1.5, legs[1][0], legs[1][1], '#4a2418');
    line(lg, 5.5, by + 1.5, hind[0][0], hind[0][1], FFOX.dk); line(lg, 4.5, by + 1.5, hind[1][0], hind[1][1], '#4a2418');
    over(lay, lg, FFOX.ol);
    // big fluffy tail with the white tip (swishes in idle, streams back when running)
    var tl2 = mk(18, 14), tA = run ? [[3.4, by - 1], [2.6, by - 2.4]] : sw ? [[3.4, by - 2.4], [3.4, by - 4.4]] : [[3.2, by - 2], [2.8, by - 3.8]];
    soft(tl2, tA[0][0], tA[0][1], 2.4, 1.8, [F[1], F[2], F[3], F[3]]);
    soft(tl2, tA[1][0], tA[1][1], 1.5, 1.3, Wt);
    over(lay, tl2, '#5a2414');
    // body
    var bd = mk(18, 14);
    soft(bd, 7.6, by, 4.6, 2.6, F);
    soft(bd, 8.6, by + 1.2, 2.6, 1, Wt);
    over(lay, bd, '#5a2414');
    // big cute head, ears, muzzle, eye
    var hd2 = mk(18, 14), hx = 12.4, hy = by - 2.2;
    soft(hd2, hx, hy, 2.8, 2.5, [F[1], F[2], F[3], '#f8c48c']);
    spr(hd2, ['.k', 'kO', 'OL'], { k: FFOX.dk, O: F[1], L: F[2] }, Math.round(hx - 2.4), Math.round(hy - 4.6));
    spr(hd2, ['k.', 'Ok', 'LO'], { k: FFOX.dk, O: F[1], L: F[2] }, Math.round(hx + 0.2), Math.round(hy - 4.8));
    soft(hd2, hx + 2.4, hy + 1, 1.5, 0.9, [F[2], FFOX.W[0], FFOX.W[1], FFOX.W[1]]);
    px(hd2, hx + 3.7, hy + 0.7, FFOX.dk);
    px(hd2, hx + 0.8, hy - 0.4, FFOX.dk); px(hd2, hx + 0.8, hy - 1, FFOX.dk); px(hd2, hx + 0.2, hy - 1, '#ffffff');
    px(hd2, hx - 0.6, hy + 1, '#e89ab8'); // blush
    over(lay, hd2, '#5a2414');
    // tiny violet scarf with a fluttering end
    var sc = mk(18, 14), sy = Math.round(by - 1);
    line(sc, 10, sy, 12, sy + 1, FFOX.scarf[1]); px(sc, 11, sy, FFOX.scarf[2]);
    var fl = run ? (i % 2 ? [[9, sy + 1], [8, sy + 1]] : [[9, sy + 1], [8, sy + 2]]) : [[10, sy + 1], [10, sy + 2]];
    for (var k = 0; k < fl.length; k++) px(sc, fl[k][0], fl[k][1], k ? FFOX.scarf[0] : FFOX.scarf[1]);
    blit(lay, sc, 0, 0);
    outline(lay, FFOX.ol);
    blit(b, lay, 0, 0);
    return b;
  }
  defFamiliar('fam_fox', { w: 18, h: 14, ax: 9, ay: 13, anims: { run: 4, idle: 2, sleep: 2 }, fps: { run: 10, idle: 2, sleep: 1.5 }, base: 'idle', draw: drawFamFox });
  // ---- fam_moth (16x14): luna moth — pale-green wings with eyespots, long tails, softly glowing body
  var FMOTH = { W: ['#4e8a62', '#7cbc88', '#b2e2aa', '#e2f8d6'], spot: ['#f2c45a', '#8c3a62', '#fff1c8'], body: ['#e8eeff', '#ffffff', '#fff8e0'], ant: '#c8a878', ol: '#24402c' };
  function drawFamMoth(anim, i) {
    var b = mk(16, 14), W = FMOTH.W, lay = mk(16, 14);
    // wing spread: 1 = fully open, smaller = raised/closing
    var open = anim === 'flutter' ? [1, 0.6, 0.25, 0.6][i] : [1, 0.8][i];
    var lift = anim === 'flutter' ? [0, 1, 2, 1][i] : 0, cx = 8, cy = 6.8 + lift * 0.3;
    var wings = mk(16, 14);
    for (var sd = -1; sd <= 1; sd += 2) {
      // forewing (big, rounded) and hindwing with a long trailing tail
      var fw = 3.8 * open + 1, fh = 3;
      soft(wings, cx + sd * (1 + fw * 0.55), cy - 1.2, fw * 0.6, fh, W);
      soft(wings, cx + sd * (1 + fw * 0.4), cy + 2.4, fw * 0.45, 2.2, W);
      line(wings, cx + sd * (1 + fw * 0.4), cy + 3.4, cx + sd * (1.4 + fw * 0.5), cy + 5.2 - lift * 0.3, W[1]); // tail
      px(wings, cx + sd * (1.4 + fw * 0.5), cy + 5.4 - lift * 0.3, W[2]);
      if (open > 0.5) { // eyespots
        var ex = Math.round(cx + sd * (1 + fw * 0.6)), ey = Math.round(cy - 1);
        px(wings, ex, ey, FMOTH.spot[1]); px(wings, ex + sd, ey, FMOTH.spot[0]); px(wings, ex, ey - 1, FMOTH.spot[0]); px(wings, ex - sd, ey, FMOTH.spot[2]);
      }
      line(wings, cx + sd * 1.5, cy - 3.6, cx + sd * (1 + fw), cy - 3.2, W[3]); // pale leading edge
    }
    over(lay, wings, W[0]);
    // soft glowing body + feathery antennae
    var bd = mk(16, 14);
    rect(bd, cx - 0.5, cy - 3, 2, 6, FMOTH.body[0]); px(bd, cx - 0.5, cy - 2, FMOTH.body[1]); px(bd, cx + 0.5, cy - 1, FMOTH.body[2]);
    px(bd, cx - 0.5, cy + 3, FMOTH.body[0]);
    line(bd, cx - 0.5, cy - 4, cx - 2.5, cy - 5.6 + (anim === 'rest' && i ? 0.5 : 0), FMOTH.ant); line(bd, cx + 0.5, cy - 4, cx + 2.5, cy - 5.6, FMOTH.ant);
    px(bd, cx - 1.5, cy - 5.6, FMOTH.ant); px(bd, cx + 1.5, cy - 5.6, FMOTH.ant);
    over(lay, bd, W[0]);
    outline(lay, FMOTH.ol);
    blit(b, lay, 0, 0);
    // bright core pixels (the engine adds the glow)
    px(b, cx, cy - 1, '#ffffff'); px(b, cx - 0.5, cy, '#ffffff');
    return b;
  }
  defFamiliar('fam_moth', { w: 16, h: 14, ax: 8, ay: 13, anims: { flutter: 4, rest: 2 }, fps: { flutter: 12, rest: 1.5 }, base: 'rest', draw: drawFamMoth });

  // ======================================================================= GLOOP SLIMES — Gloopgarr the Slime Ogre and the slimes he splits into
  var GLOOP = { G: ['#0e3a1a', '#1a5e28', '#2a8a38', '#48b84c', '#86e070', '#d4fab0'], face: '#0a1a0e', tooth: '#f4f8e8',
    crown: ['#6a4a16', '#b8862a', '#f2c45a', '#fff1c8'], wood: ['#2e2018', '#4e3626', '#73523a', '#9a7454'], nail: '#a09fb6' };
  // seamless jelly: union of ellipsoid blobs shaded through one height field, lit from the top-left
  function jelly(b, blobs, R, groundY) {
    var x0 = b.w, y0 = b.h, x1 = 0, y1 = 0, k;
    for (k = 0; k < blobs.length; k++) { var B = blobs[k]; x0 = Math.min(x0, Math.floor(B[0] - B[2] - 1)); x1 = Math.max(x1, Math.ceil(B[0] + B[2] + 1)); y0 = Math.min(y0, Math.floor(B[1] - B[3] - 1)); y1 = Math.max(y1, Math.ceil(B[1] + B[3] + 1)); }
    function H(x, y) {
      var h = -1;
      for (var q = 0; q < blobs.length; q++) {
        var Bq = blobs[q], dx = (x - Bq[0]) / Bq[2], dy = (y - Bq[1]) / Bq[3], d = dx * dx + dy * dy;
        if (d < 1) h = Math.max(h, Math.sqrt(1 - d) * Math.min(Bq[2], Bq[3]));
      }
      return h;
    }
    for (var y = Math.max(0, y0); y <= Math.min(b.h - 1, y1); y++) for (var x = Math.max(0, x0); x <= Math.min(b.w - 1, x1); x++) {
      if (groundY != null && y > groundY) continue;
      var h0 = H(x + 0.5, y + 0.5);
      if (h0 < 0) continue;
      var gx = (H(x + 1.5, y + 0.5) < 0 ? -2 : H(x + 1.5, y + 0.5)) - (H(x - 0.5, y + 0.5) < 0 ? -2 : H(x - 0.5, y + 0.5));
      var gy = (H(x + 0.5, y + 1.5) < 0 ? -2 : H(x + 0.5, y + 1.5)) - (H(x + 0.5, y - 0.5) < 0 ? -2 : H(x + 0.5, y - 0.5));
      var l = (gx * 0.55 + gy * 0.8) * 0.5 + 0.15; // facing up-left => brighter
      var kk = l > 1.1 ? 4 : l > 0.45 ? 3 : l > -0.25 ? 2 : l > -0.9 ? 1 : 0;
      px(b, x, y, R[kk]);
    }
  }
  function ogrePose(anim, i) {
    var p = { lift: 0, sq: 0, lean: 0, club: 'rest', legL: 0, legR: 0, eyes: 'n', crown: 0, splash: 0 };
    if (anim === 'idle') { p.sq = i; }
    else if (anim === 'move') { p.lean = [-1, 0, 1, 0][i]; p.legL = i === 0 ? 3 : 0; p.legR = i === 2 ? 3 : 0; p.sq = i % 2; }
    else if (anim === 'attack') {
      if (i === 0) { p.lean = -2; p.club = 'up'; p.legR = 5; p.sq = -2; p.eyes = 'a'; }
      if (i === 1) { p.lift = 2; p.club = 'up'; p.legL = 3; p.legR = 3; p.sq = -2; p.eyes = 'a'; }
      if (i === 2) { p.sq = 4; p.club = 'slam'; p.eyes = 'a'; p.splash = 1; }
      if (i === 3) { p.sq = 2; p.club = 'slam'; p.splash = 2; }
    } else if (anim === 'hurt') { p.sq = 2; p.lean = -1; p.eyes = 'x'; }
    else if (anim === 'die') { p.eyes = 'x'; p.crown = 1; p.sq = 3; }
    return p;
  }
  function drawOgre(v, anim, i) {
    var G = GLOOP.G, b = mk(48, 44), k;
    if (anim === 'die' && i >= 1) return ogreSplit(i);
    var p = ogrePose(anim, i), up = p.lift, sq = p.sq;
    var Y = function (y) { return y - up + (y < 38 ? sq * (38 - y) / 30 : 0); };
    var lay = mk(48, 44);
    // crude club (behind the body when resting on the shoulder)
    var club = mk(48, 44), cf = [37 + p.lean, Y(29)];
    var ctip = p.club === 'up' ? [30 + p.lean, Y(7)] : p.club === 'slam' ? [45, 40] : [41 + p.lean, Y(13)];
    var dxC = ctip[0] - cf[0], dyC = ctip[1] - cf[1], lc = Math.hypot(dxC, dyC), nx = -dyC / lc, ny = dxC / lc;
    poly(club, [cf[0] + nx, cf[1] + ny, cf[0] - nx, cf[1] - ny, ctip[0] - nx * 2.6, ctip[1] - ny * 2.6, ctip[0] + nx * 2.6, ctip[1] + ny * 2.6], function (x, y) { return ((x - cf[0]) * nx + (y - cf[1]) * ny) > 0 ? GLOOP.wood[3] : GLOOP.wood[2]; });
    for (k = 0; k < 3; k++) { var t = 0.55 + k * 0.17; px(club, cf[0] + dxC * t + nx * 2.4, cf[1] + dyC * t + ny * 2.4, GLOOP.nail); px(club, cf[0] + dxC * t - nx * 2.6, cf[1] + dyC * t - ny * 2.6, GLOOP.nail); }
    over(lay, club, GLOOP.wood[0]);
    // the ogre-shaped jelly body
    var body = mk(48, 44), L = p.lean;
    var blobs = [
      [22 + L * 0.3, Y(31), 12.4 + sq * 0.5, 10.4 - sq * 0.2],     // belly
      [22 + L * 0.6, Y(21.6), 10.2, 6.2],                            // hunched shoulders
      [24.6 + L, Y(13.4), 5.2, 4.8],                                  // little head
      [11 + L * 0.5, Y(27), 3.4, 6.4],                                // back arm
      [35 + L * 0.6, Y(25.6), 3.4, 5.4],                              // club arm
      [16, Y(39.6) - p.legL, 4.2, 3.2], [28, Y(39.6) - p.legR, 4.2, 3.2]  // stubby legs
    ];
    if (p.club === 'up') blobs[4] = [33 + L, Y(16), 3.4, 6];
    if (p.club === 'slam') blobs[4] = [37, Y(32), 3.6, 5];
    jelly(body, blobs, G, 42);
    // floating junk inside the jelly: a bone, a coin, a fish skeleton, bubbles
    line(body, 17, Y(32), 21, Y(34), '#e8e4d0'); px(body, 16.6, Y(31.6), '#e8e4d0'); px(body, 21.4, Y(34.4), '#e8e4d0');
    px(body, 27, Y(35), GLOOP.crown[2]); px(body, 28, Y(35), GLOOP.crown[1]);
    line(body, 13, Y(25), 16, Y(25), '#d0dcc0'); px(body, 14, Y(24), '#d0dcc0'); px(body, 15, Y(26), '#d0dcc0'); px(body, 12.4, Y(25), '#d0dcc0');
    var bub = [[25, Y(28)], [19, Y(22)], [30, Y(31)], [23, Y(37)]];
    for (k = 0; k < bub.length; k++) { px(body, bub[k][0], bub[k][1], G[5]); if (k < 2) px(body, bub[k][0] + 1, bub[k][1] + 1, G[4]); }
    // gloss highlights
    px(body, 14, Y(24), '#ffffff'); px(body, 15, Y(23), G[5]); px(body, 20, Y(10), '#ffffff'); px(body, 13, Y(29), G[5]);
    // face: beady eyes and a tusked underbite
    var fx = 25 + L, fy = Math.round(Y(12.4));
    if (p.eyes === 'x') { spr(body, ['k.k.k.k', '.k...k.', 'k.k.k.k'], { k: GLOOP.face }, fx - 3, fy - 1); }
    else {
      spr(body, p.eyes === 'a' ? ['kk.kk', '.k.k.'] : ['Wk.Wk', 'kk.kk'], { k: GLOOP.face, W: '#ffffff' }, fx - 2, fy - 1);
      if (p.eyes === 'a') { px(body, fx - 2, fy + 1, GLOOP.face); px(body, fx + 2, fy + 1, GLOOP.face); }
    }
    line(body, fx - 3, fy + 3, fx + 3, fy + 3, GLOOP.face); line(body, fx - 2, fy + 4, fx + 2, fy + 4, G[1]);
    px(body, fx - 2, fy + 2, GLOOP.tooth); px(body, fx + 2, fy + 2, GLOOP.tooth); // tusks
    over(lay, body, G[0]);
    // dented crown, a little askew
    var cr = mk(48, 44), cx0 = Math.round(20 + L), cy0 = Math.round(Y(5.2)) + (p.crown ? 2 : 0);
    spr(cr, ['a..a..a', 'aa.ab.a', 'bcbcbbb', 'cdcdccb', 'bbbbbbb'], { a: GLOOP.crown[2], b: GLOOP.crown[1], c: GLOOP.crown[2], d: '#c44a3a' }, cx0, cy0);
    px(cr, cx0 + 3, cy0 + 1, GLOOP.crown[0]); // the dent
    over(lay, cr, GLOOP.crown[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (p.splash) { // stomp: gloop splashes off the feet
      var sp = p.splash === 1 ? [[6, 38], [9, 34], [40, 37], [37, 33], [22, 30]] : [[3, 40], [6, 36], [44, 40], [41, 36]];
      for (k = 0; k < sp.length; k++) { px(b, sp[k][0], sp[k][1], G[4]); px(b, sp[k][0] + 1, sp[k][1], G[3]); px(b, sp[k][0], sp[k][1] + 1, G[2]); }
      line(b, 2, 42, 10, 42, '#c0b098', 0.6); line(b, 38, 42, 46, 42, '#c0b098', 0.6);
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  // death: Gloopgarr wobbles and splits into three blobs
  function ogreSplit(i) {
    var G = GLOOP.G, b = mk(48, 44), lay = mk(48, 44), t = i - 1;
    var sets = [
      [[22, 31, 12, 10], [16, 23, 7, 6], [29, 23, 7, 6], [22, 15, 6, 5]],
      [[12, 33, 8, 7.4], [24, 30, 8, 8], [36, 33, 8, 7.4]],
      [[9.4, 35, 6.6, 6.2], [24, 33, 7.4, 7], [38.6, 35, 6.6, 6.2]],
      [[8.4, 39.4, 5.6, 2.8], [24, 39.6, 6.4, 2.8], [39.6, 39.4, 5.6, 2.8]]
    ][t];
    jelly(lay, sets, G, 42);
    if (t < 3) { // each new blob gets an angry little face
      for (var k = 0; k < sets.length; k++) { var s = sets[k]; if (s[2] < 6.5 && t === 0) continue; var ex = Math.round(s[0] + 1), ey = Math.round(s[1] - s[3] * 0.3); spr(lay, ['k.k', '...', '.k.'], { k: GLOOP.face }, ex - 1, ey); }
    }
    outline(lay, OL);
    blit(b, lay, 0, 0);
    // the dented crown tumbles off
    var cr = mk(48, 44), cp = [[19, 3], [26, 10], [30, 24], [31, 36]][t];
    spr(cr, ['a..a..a', 'aa.ab.a', 'bcbcbbb', 'cdcdccb', 'bbbbbbb'], { a: GLOOP.crown[2], b: GLOOP.crown[1], c: GLOOP.crown[2], d: '#c44a3a' }, cp[0], cp[1]);
    outline(cr, OL); blit(b, cr, 0, 0);
    var dr = [[[6, 20], [40, 18], [24, 8]], [[3, 26], [44, 24], [20, 16], [30, 14]], [[3, 31], [44, 30], [14, 24], [34, 22]], [[15, 41], [32, 41]]][t];
    for (var q = 0; q < dr.length; q++) { px(b, dr[q][0], dr[q][1], G[4]); px(b, dr[q][0] + 1, dr[q][1] + 1, G[3]); }
    return b;
  }
  defType('slime_ogre', {
    w: 48, h: 44, ax: 24, ay: 43,
    anims: { idle: 2, move: 4, attack: 4, hurt: 1, die: 5 },
    variants: ['default'],
    fps: { idle: 2, move: 5, attack: 6, die: 6 },
    draw: drawOgre
  });
  // the gloop slimes he sheds: fast, bouncy, cross little faces
  function drawGloop(W, Hh, s, anim, i) {
    var G = GLOOP.G, b = mk(W, Hh), lay = mk(W, Hh), gy = Hh - 2;
    var cx = W / 2, rx = 6 * s, ry = 4.6 * s, lift = 0, lean = 0, face = 'n';
    if (anim === 'idle') { if (i) { rx += 0.6 * s; ry -= 0.5 * s; } }
    else if (anim === 'move') { var P = [[1.2, 0.7, 0, 0], [0.8, 1.3, 2.4, 0.6], [0.95, 1.05, 4.2, 0], [0.85, 1.2, 2, -0.4]][i]; rx *= P[0]; ry *= P[1]; lift = P[2] * s; lean = P[3] * s; }
    else if (anim === 'attack') { if (i === 0) { rx *= 1.15; ry *= 0.8; lean = -1 * s; face = 'a'; } else { rx *= 1.1; ry *= 0.95; lean = 1.2 * s; cx += 0.6 * s; face = 'b'; } }
    else if (anim === 'hurt') { rx *= 1.12; ry *= 0.85; face = 'h'; }
    else if (anim === 'die') {
      if (i === 0) { rx *= 1.25; ry *= 0.62; face = 'x'; }
      else if (i === 1 && s > 1) { jelly(lay, [[cx - 3.6 * s, gy - 2.6 * s, 3.2 * s, 2.6 * s], [cx + 3.6 * s, gy - 2.6 * s, 3.2 * s, 2.6 * s]], G, gy); outline(lay, OL); blit(b, lay, 0, 0); return b; }
      else { var dd = i === 3 ? 0.4 : 1; jelly(lay, [[cx, gy - 0.6 * s, rx * 1.1, 1.2 * s * dd + 0.6]], G, gy); outline(lay, OL); blit(b, lay, 0, 0);
        var drp = i === 3 ? [[2, gy - 2], [W - 3, gy - 3]] : [[3, gy - 4 * s], [W - 4, gy - 4 * s], [cx, gy - 6 * s]]; for (var q = 0; q < drp.length; q++) px(b, drp[q][0], drp[q][1], G[4]); return b; }
    }
    var cy = gy - ry * 0.8 - lift;
    jelly(lay, [[cx + lean * 0.4, cy, rx, ry], [cx + lean, cy - ry * 0.35, rx * 0.72, ry * 0.7]], G, gy - lift);
    px(lay, cx - rx * 0.5, cy - ry * 0.45, '#ffffff'); if (s > 1) px(lay, cx - rx * 0.4, cy - ry * 0.6, G[5]);
    if (s > 1) { px(lay, cx - 1, cy + ry * 0.4, G[5]); px(lay, cx + 2, cy + ry * 0.1, G[4]); }
    var fx = Math.round(cx + lean + 0.6 * s), fy = Math.round(cy - ry * 0.15), E = GLOOP.face;
    var faces = s > 1 ? { n: ['.k...k', 'kk..kk', '......', '.kkkk.'], a: ['k....k', 'kk..kk', '......', '.kkkk.'], b: ['k....k', 'kk..kk', '.kkkk.', '.kTTk.'], h: ['k....k', '.k..k.', 'k....k', '..kk..'], x: ['k.k.k.k', '.k...k.', 'k.k.k.k'] }
                      : { n: ['k.k', '...', '.k.'], a: ['k.k', '.k.'], b: ['k.k', 'kkk'], h: ['k.k', '.k.'], x: ['k.k', '.k.'] };
    var fm = faces[face] || faces.n;
    spr(lay, fm, { k: E, T: GLOOP.tooth }, fx - Math.floor(fm[0].length / 2), fy - 1);
    if (s > 1 && (face === 'n' || face === 'a')) { px(lay, fx - 2, fy - 1, '#ffffff'); px(lay, fx + 2, fy - 1, '#ffffff'); }
    outline(lay, OL);
    if (lift) shadowE(lay, cx, gy + 0.6, rx * 0.7, 0.8, 0.4);
    blit(b, lay, 0, 0);
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('slime_med', { w: 20, h: 20, ax: 10, ay: 19, anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 }, variants: ['default'], fps: { idle: 3, move: 11, attack: 9, die: 9 },
    draw: function (v, anim, i) { return drawGloop(20, 20, 1.15, anim, i); } });
  defType('slime_small', { w: 12, h: 12, ax: 6, ay: 11, anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 }, variants: ['default'], fps: { idle: 4, move: 13, attack: 10, die: 10 },
    draw: function (v, anim, i) { return drawGloop(12, 12, 0.66, anim, i); } });

  // ======================================================================= OLD GRIMJAW (48x32) — scarred alpha moss-wolf, twice the size
  var GRIM = { F: ['#100e14', '#1e1a24', '#302a38', '#463e4e', '#605868', '#847c8c'], pale: '#b4aab8', scar: '#d8c4bc', eye: ['#2fbf7f', '#7dffc4', '#ffffff'] };
  function grimLeg(b, hip, knee, paw, near) {
    var F = GRIM.F, c = near ? F[3] : F[1], c2 = near ? F[2] : F[0];
    for (var k = 0; k < 3; k++) line(b, hip[0] + k, hip[1], knee[0] + k * 0.7, knee[1], k ? c2 : c);
    line(b, knee[0], knee[1], paw[0], paw[1] - 1, c); line(b, knee[0] + 1, knee[1], paw[0] + 1, paw[1] - 1, c2);
    rect(b, paw[0] - 0.5, paw[1] - 1, 3, 2, near ? F[4] : F[2]); px(b, paw[0] + 2, paw[1], near ? GRIM.pale : F[1]);
  }
  function drawGrimjaw(v, anim, i) {
    var F = GRIM.F, M = WOLF_MOSS, b = mk(48, 32);
    var dust = ['#1a2420', '#3a4840', '#5e6e64', '#8a9a8e', '#bccabe'];
    if (anim === 'die' && i === 3) { var o = mk(48, 32); blit(o, leafPuff(3), 8, 8); blit(o, leafPuff(3), 22, 10); return o; }
    var bx = 21, by = 15, head = 'fwd', mouth = 0, tail = 0, bob = 0, lying = anim === 'die' && i >= 1;
    var Lg = { nf: [[8, 4], [9, 8.5], [10, 30]], ff: [[5.6, 4], [6, 8.5], [6, 30]], nh: [[-8.4, 4], [-6.4, 8.5], [-9.2, 30]], fh: [[-10.8, 4], [-9.2, 8.5], [-12, 30]] };
    function mv(k, dx, pdx, lift) { Lg[k][1][0] += dx; Lg[k][2][0] += pdx; Lg[k][2][1] -= lift || 0; Lg[k][1][1] -= (lift || 0) * 0.5; }
    var hdy = 0;
    if (anim === 'idle' && i === 1) { hdy = 1; mouth = 1; tail = 1; }
    else if (anim === 'move') {
      bob = [0, -1, 0, -1][i]; tail = [1, 2, 1, 0][i];
      var st = [1, 0, -1, 0][i];
      mv('nf', st * 2, st * 4, st > 0 ? 2 : 0); mv('fh', st * 2, st * 4, st > 0 ? 2 : 0); mv('ff', -st * 2, -st * 4, st < 0 ? 2 : 0); mv('nh', -st * 2, -st * 4, st < 0 ? 2 : 0);
    } else if (anim === 'attack') {
      if (i === 0) { by = 18; head = 'low'; mouth = 2; tail = 2; mv('nh', 2, 4); mv('fh', 2, 4); mv('nf', -2, -2); mv('ff', -2, -2); }
      if (i === 1) { bx = 23; by = 13; head = 'lunge'; mouth = 3; tail = 3; Lg.nf = [[8, 4], [13, 6], [17, 22]]; Lg.ff = [[6, 4], [10, 8], [14, 24]]; Lg.nh = [[-8.4, 4], [-12, 7], [-15, 24]]; Lg.fh = [[-10.8, 4], [-14, 7], [-17, 22]]; }
      if (i === 2) { bx = 23; by = 16; head = 'bite'; mouth = 1; tail = 1; }
    } else if (anim === 'hurt') { bx = 19; head = 'low'; tail = 4; mouth = 2; }
    else if (anim === 'die' && i === 0) { by = 18; head = 'low'; tail = 4; mv('nf', 2, 2); mv('nh', -2, -2); }
    by += bob;
    var lay = mk(48, 32), far = mk(48, 32), body = mk(48, 32), near = mk(48, 32), k, x, y;
    if (lying) {
      shadeEll(body, 21, 24, 13, 4.6, F.slice(1), 4); shadeEll(body, 32, 23.4, 4.4, 4, F.slice(1), 4);
      shadeEll(body, 38.6, 25, 4, 3, F.slice(1), 4); px(body, 42, 26, F[0]); line(body, 36, 27, 40, 27.6, F[0]);
      line(near, 24, 27, 30, 29, F[3]); line(near, 12, 27, 17, 29, F[3]); line(body, 8, 23, 2, 26, F[3]); line(body, 8, 22, 3, 24, F[4]);
      for (x = 10; x <= 32; x++) if ((x * 7) % 5 < 3) { px(body, x, 19 + (x % 3 === 0 ? 0 : 1), M[2 + (x % 3)]); }
      px(body, 38, 24, F[0]); px(body, 39, 24, F[0]);
      over(lay, body, F[0]); over(lay, near, F[0]); outline(lay, OL); blit(b, lay, 0, 0);
      if (i === 2) { blit(b, leafPuff(1), 10, 6); blit(b, leafPuff(0), 24, 8); }
      return b;
    }
    grimLeg(far, [bx + Lg.ff[0][0], by + Lg.ff[0][1]], [bx + Lg.ff[1][0], by + Lg.ff[1][1]], [bx + Lg.ff[2][0], Lg.ff[2][1]], false);
    grimLeg(far, [bx + Lg.fh[0][0], by + Lg.fh[0][1]], [bx + Lg.fh[1][0], by + Lg.fh[1][1]], [bx + Lg.fh[2][0], Lg.fh[2][1]], false);
    // heavy brush tail
    var tw = [[-3.6, 3, -5.2, 6.8, -5.2, 10], [-4, 0, -6.4, 2, -7.2, 5.2], [-4, -2, -6.4, -3, -7.6, -1.2], [-4.4, -1.2, -6.8, -1.6, -7.8, -1.2], [-2.8, 4, -4, 7.2, -3.6, 9.6]][tail];
    var tl = mk(48, 32), tx = bx - 11.2, ty = by - 1;
    for (k = 0; k < 3; k++) { line(tl, tx, ty + k, tx + tw[0], ty + tw[1] + k, k ? F[2] : F[3]); line(tl, tx + tw[0], ty + tw[1] + k, tx + tw[2], ty + tw[3] + k, k ? F[2] : F[3]); line(tl, tx + tw[2], ty + tw[3] + k * 0.6, tx + tw[4], ty + tw[5] + k * 0.6, F[4]); }
    px(tl, tx + tw[4], ty + tw[5] + 1, GRIM.pale);
    over(far, tl, F[0]);
    // body
    shadeEll(body, bx - 8, by + 0.8, 5.4, 5.2, F.slice(1), 4);
    shadeEll(body, bx, by, 11.2, 4.6, F.slice(1), 4);
    shadeEll(body, bx + 8, by + 1.2, 5.6, 5.6, F.slice(1), 4);
    line(body, bx + 11, by + 2, bx + 11, by + 5, GRIM.pale); px(body, bx + 12, by + 3, GRIM.pale); // pale chest ruff
    // battle scars across the flank
    for (k = 0; k < 3; k++) line(body, bx - 4 + k * 2, by - 0.6, bx - 2.6 + k * 2, by + 2.2, k === 1 ? GRIM.scar : '#8a7a8e'); // old claw marks
    // neck + head
    var hx, hy, sdx, sdy;
    if (head === 'howl') { hx = bx + 12.4; hy = by - 9.6; sdx = 3.2; sdy = -3.2; }
    else if (head === 'low') { hx = bx + 13.6; hy = by + 1.6; sdx = 4.6; sdy = 1.2; }
    else if (head === 'lunge') { hx = bx + 14; hy = by - 2.4; sdx = 4.8; sdy = 0.4; }
    else if (head === 'bite') { hx = bx + 14; hy = by - 1.6; sdx = 4.8; sdy = 1; }
    else { hx = bx + 13; hy = by - 5.2 + hdy; sdx = 4.8; sdy = 1; }
    var nk = mk(48, 32);
    poly(nk, [bx + 6, by - 4, bx + 11, by - 4.8, hx + 1.6, hy - 1.2, hx + 1.6, hy + 3.2, bx + 13.2, by + 2.8], function (xx, yy) { return yy < hy + 1 ? F[4] : F[3]; });
    over(body, nk, F[1]);
    var hd = mk(48, 32);
    shadeEll(hd, hx, hy, 4.8, 4, F.slice(1), 4);
    shadeEll(hd, hx + sdx, hy + sdy, 4, 2.2, F.slice(1), 4);
    px(hd, Math.round(hx + sdx + 3.4), Math.round(hy + sdy - 0.8), F[0]); px(hd, Math.round(hx + sdx + 3.4), Math.round(hy + sdy - 0.2), F[0]); // nose
    // ears: the near one torn
    var ea = head === 'howl' ? -3 : head === 'low' || head === 'lunge' ? 2 : 0;
    spr(hd, ['.a', 'ab', 'ab'], { a: F[4], b: F[3] }, Math.round(hx - 3 + ea * 0.5), Math.round(hy - 6.4));
    spr(hd, ['a.a', 'aab', 'abb'], { a: F[5], b: F[4] }, Math.round(hx - 0.4 + ea * 0.3), Math.round(hy - 6.8));
    // jaws
    var mx = Math.round(hx + sdx - 1.2), my = Math.round(hy + sdy + 1.6);
    if (mouth === 1) line(hd, mx - 1, my, mx + 2, my, F[0]);
    if (mouth >= 2) {
      line(hd, mx - 2, my, mx + 4, my, '#2a0e18'); line(hd, mx - 2, my + 1, mx + 3, my + 1, '#2a0e18');
      px(hd, mx, my - 1, '#ffffff'); px(hd, mx + 3, my - 1, '#ffffff'); px(hd, mx + 1, my + 2, '#f4eedf');
      if (mouth === 3) { line(hd, mx - 2, my + 2, mx + 3, my + 4, F[3]); px(hd, mx + 1, my + 2, '#c4648e'); px(hd, mx + 2, my + 2, '#ffffff'); }
    }
    if (head === 'howl') { spr(hd, ['k.', 'kk', '.r'], { k: '#2a0e18', r: '#c4648e' }, Math.round(hx + 4.6), Math.round(hy - 1.4)); }
    // glowing eye with an old scar through it
    var ex = Math.round(hx + 1), ey = Math.round(hy - 1.2);
    if (anim === 'hurt' || anim === 'die') { line(hd, ex, ey, ex + 2, ey, F[0]); }
    else if (head === 'howl') { line(hd, ex, ey + 1, ex + 2, ey, F[0]); }
    else { rect(hd, ex, ey, 2, 2, GRIM.eye[1]); px(hd, ex, ey, GRIM.eye[2]); px(hd, ex + 2, ey, GRIM.eye[0]); }
    line(hd, ex - 1, ey - 3, ex + 2, ey + 3, GRIM.scar);
    over(body, hd, F[0]);
    // the moss mantle: thick moss, ferns and little mushrooms along the back and shoulders
    for (x = Math.round(bx - 12); x <= Math.round(bx + 9); x++) {
      var topY = -1;
      for (y = 0; y < 32; y++) if (A(body, x, y)) { topY = y; break; }
      if (topY < 0) continue;
      var hh = 2 + ((x * 5 + 3) % 3 === 0 ? 1 : 0);
      for (k = 0; k < hh; k++) px(body, x, topY + k, M[k === 0 ? 4 : 2 + (x % 2)]);
      if ((x * 7) % 9 === 1) { px(body, x, topY - 1, M[5]); }
      if ((x * 3) % 7 === 2) px(body, x, topY + hh, M[1]); // hanging strands
    }
    var sprouts = [[bx - 5, '#c4648e', '#e89ab8'], [bx + 3, '#d8b878', '#fff1c8'], [bx - 10, '#c4648e', '#e89ab8']];
    for (k = 0; k < sprouts.length; k++) {
      var sxp = Math.round(sprouts[k][0]), syp = -1;
      for (y = 0; y < 32; y++) if (A(body, sxp, y)) { syp = y; break; }
      if (syp > 1) { px(body, sxp, syp - 1, '#f4eedf'); px(body, sxp, syp - 2, sprouts[k][1]); px(body, sxp + 1, syp - 2, sprouts[k][2]); px(body, sxp - 1, syp - 2, sprouts[k][1]); }
    }
    var fernX = Math.round(bx - 1), fy0 = -1;
    for (y = 0; y < 32; y++) if (A(body, fernX, y)) { fy0 = y; break; }
    if (fy0 > 3) { line(body, fernX, fy0 - 1, fernX - 1, fy0 - 4, M[3]); px(body, fernX - 2, fy0 - 3, M[5]); px(body, fernX, fy0 - 3, M[4]); px(body, fernX - 2, fy0 - 5, M[5]); }
    grimLeg(near, [bx + Lg.nf[0][0], by + Lg.nf[0][1]], [bx + Lg.nf[1][0], by + Lg.nf[1][1]], [bx + Lg.nf[2][0], Lg.nf[2][1]], true);
    grimLeg(near, [bx + Lg.nh[0][0], by + Lg.nh[0][1]], [bx + Lg.nh[1][0], by + Lg.nh[1][1]], [bx + Lg.nh[2][0], Lg.nh[2][1]], true);
    over(lay, far, F[0]);
    over(lay, body, F[0]);
    over(lay, near, F[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (head === 'lunge') { line(b, 1, 10, 5, 10, '#e8eeff', 0.5); line(b, 1, 16, 4, 16, '#e8eeff', 0.4); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('grimjaw', {
    w: 48, h: 32, ax: 24, ay: 31,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['default'],
    fps: { idle: 2, move: 9, attack: 8, die: 6 },
    draw: drawGrimjaw
  });

  // ======================================================================= THE LANTERN THIEF (24x24) — a wisp king with a crown of light and a stolen lantern
  var THIEF = { C: ['#124846', '#278e86', '#5cd6c4', '#b0f6ea', '#ffffff'], crown: ['#b8862a', '#f2c45a', '#fff1c8'], eye: '#0b2a2c' };
  function thiefLantern(b, x, y, lit) {
    var L = mk(b.w, b.h);
    spr(L, ['.h.h.', '.rrr.', 'rbcbr', 'abdca', 'abdca', 'rbcbr', '.rrr.'], { h: '#8a6a4a', r: '#5a3424', a: '#c44a3a', b: '#e8843c', c: '#ffbc62', d: lit ? '#fff1c8' : '#ffd896' }, x, y - 2);
    px(L, x + 2, y - 3, '#8a6a4a'); // bail handle
    outline(L, '#3a1a14');
    blit(b, L, 0, 0);
  }
  function drawThief(v, anim, i) {
    var C = THIEF.C, b = mk(24, 24), k;
    var cx = 9.6, cy = 14.4, r = 5.8, tipY = 5.2, tipX = 0, bob = 0, ph = i, eyes = 'sly', swing = 0, vanish = false, burst = 0, gut = 0;
    if (anim === 'idle') { bob = [0, -1, -1, 0][i]; tipX = [0, 1, 0, -1][i]; swing = [0, 1, 0, -1][i]; }
    else if (anim === 'move') { bob = [0, -1, 0, 1][i]; tipX = -2 - (i % 2); swing = -1; }
    else if (anim === 'attack') { if (i === 0) { r = 3.6; tipY = 9; eyes = 'shut'; burst = 1; } if (i === 1) vanish = true; if (i === 2) { burst = 2; eyes = 'wide'; } }
    else if (anim === 'hurt') { tipX = -2; eyes = 'shut'; }
    else if (anim === 'die') { gut = i + 1; r = [4.6, 3.4, 2, 0][i]; tipY = [7, 10, 13, 16][i]; eyes = i === 0 ? 'x' : 'none'; }
    cy += bob; tipY += bob;
    if (vanish) { // blinked away: an after-image ring, sparkles and the floating crown glint
      ringE(b, cx, cy, 5, 5, C[2], 0.35); ringE(b, cx, cy, 3, 3, C[3], 0.25);
      var sp = [[4, 8], [17, 6], [6, 19], [16, 18], [11, 3], [20, 12]];
      for (k = 0; k < sp.length; k++) px(b, sp[k][0], sp[k][1], k % 2 ? C[3] : C[4]);
      px(b, 10, 4, THIEF.crown[2]); px(b, 11, 4, THIEF.crown[1]);
      thiefLantern(b, 16, 13, true);
      return b;
    }
    var lay = mk(24, 24);
    function inside(x, y, rr, tY) {
      var yy = y + 0.5;
      if (yy >= cy) return inE(x, y, cx, cy, rr, rr);
      var t = (yy - tY) / (cy - tY);
      if (t < 0) return false;
      var off = tipX * (1 - t) * (1 - t) + Math.sin(ph * 1.9 + yy * 0.8) * 0.7 * (1 - t);
      return Math.abs(x + 0.5 - cx - off) <= rr * Math.pow(t, 0.55);
    }
    if (r > 0) for (var y = 0; y < 24; y++) for (var x = 0; x < 24; x++) {
      if (!inside(x, y, r, tipY)) continue;
      var core = inside(x, y, r * 0.55, tipY + (cy - tipY) * 0.4), mid = inside(x, y, r * 0.8, tipY + (cy - tipY) * 0.2);
      var edge = !inside(x - 1, y, r, tipY) || !inside(x + 1, y, r, tipY) || !inside(x, y - 1, r, tipY) || !inside(x, y + 1, r, tipY);
      px(lay, x, y, core ? C[4] : mid ? C[3] : edge ? C[1] : C[2], core ? 1 : mid ? 0.95 : edge ? 0.8 : 0.9);
    }
    // little flame arm reaching out to hold the lantern
    if (!gut) { line(lay, cx + r - 1, cy - 1, cx + r + 2, cy - 2 + swing * 0.3, C[2], 0.9); px(lay, cx + r + 2.4, cy - 2.4 + swing * 0.3, C[3]); }
    // sly face
    var ex = Math.round(cx) - 2, ey = Math.round(cy - 1.4), E = THIEF.eye;
    if (eyes === 'sly') { spr(lay, ['kk..kk', '.k...k'], { k: E }, ex - 1, ey); spr(lay, ['k....k', '.kkkk.'], { k: E }, ex - 1, ey + 3); px(lay, ex + 3, ey + 4, '#ffffff'); }
    else if (eyes === 'wide') { spr(lay, ['k...k', 'k...k'], { k: E }, ex, ey); spr(lay, ['.kkk.'], { k: E }, ex, ey + 3); }
    else if (eyes === 'shut') { spr(lay, ['kk..kk'], { k: E }, ex - 1, ey + 1); }
    else if (eyes === 'x') { spr(lay, ['k.k.k.k', '.k...k.', 'k.k.k.k'], { k: E }, ex - 1, ey); }
    blit(b, lay, 0, 0);
    // crown of light floating on the flame
    if (gut < 3) {
      var crY = Math.round(tipY) - 1, crX = Math.round(cx) - 3, Cr = THIEF.crown;
      spr(b, ['a..a..a', 'ab.ab.a', 'bbbcbbb'], { a: Cr[2], b: Cr[1], c: '#ffffff' }, crX, Math.max(0, crY - 2));
    }
    // the stolen lantern
    if (gut <= 1) thiefLantern(b, Math.round(cx + r + 1.4), Math.round(cy - 1 + swing * 0.4), (i % 2) === 0);
    else thiefLantern(b, 16, 16, false); // dropped
    // sparks
    var sps = anim === 'move' ? [[2, 12], [1, 16], [4, 19]] : [[3, 18], [18, 6]];
    for (k = 0; k < sps.length; k++) if (gut < 3) px(b, Math.max(2, sps[k][0] + 1 - ((ph + k) % 2)), sps[k][1] + bob - ((ph + k) % 3), C[k % 2 ? 2 : 3], 0.8);
    if (burst === 1) ringE(b, cx, cy, 6.5, 6.5, C[3], 0.6);
    if (burst === 2) { ringE(b, cx, cy, 7.5, 7.5, C[4], 0.7); var R = [[10, 1], [1, 14], [21, 14], [4, 5], [18, 4]]; for (k = 0; k < R.length; k++) px(b, R[k][0], R[k][1], C[4]); }
    if (gut >= 2) cloud(b, gut === 2 ? [[10, 12, 1.6], [11, 9, 1.2]] : [[10, 10, 1.8], [9, 6.5, 1.3]], ['#1b2a2e', '#3a4a50', '#5a6a70', '#7a8a90', '#a0b0b4'], gut === 2 ? 0.6 : 0.45, false);
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('lantern_thief', {
    w: 24, h: 24, ax: 12, ay: 23,
    anims: { idle: 4, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['default'],
    fps: { idle: 8, move: 8, attack: 10, die: 7 },
    draw: drawThief
  });

  // ======================================================================= VORRAKH, THE DEEP WYRM (64x48) — crystal-scaled cave wyrm rearing out of its burrow
  // anchor = centre of the burrow hole (rubble spills ~6px below it); extra anims: burrow (dives in) and emerge (bursts out)
  var WYRM = {
    S: ['#0c0a18', '#1a1830', '#2a2848', '#3c3c64', '#545a86', '#727aa8'],
    belly: ['#4e4458', '#7e7088', '#ab9db0'],
    cry: ['#3e2670', '#6a47a8', '#9f80e0', '#d4c0ff', '#ffffff'],
    rock: ['#1e1a2c', '#38324e', '#514a6c', '#6c6589', '#8c85a8', '#b0aaca'],
    eye: ['#e8843c', '#ffbc62', '#fff1c8'],
    maw: ['#1a0610', '#4a1424', '#7a2a3a'], tooth: '#ece6ff',
    dust: ['#2a2434', '#4a4058', '#6e6280', '#9a8ea8', '#c4bcd0'], pit: '#07050e', wall: '#231d30'
  };
  var WY = { x: 32, y: 40, rx: 11, ry: 4.4 };
  function bez3(P, t) {
    var m = 1 - t, a = m * m * m, b2 = 3 * m * m * t, c = 3 * m * t * t, d = t * t * t;
    return [a * P[0][0] + b2 * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b2 * P[1][1] + c * P[2][1] + d * P[3][1]];
  }
  // anything of the wyrm below the near lip of the burrow is underground
  function wyClip(x, y) {
    var dx = x + 0.5 - WY.x;
    if (y + 0.5 > WY.y + WY.ry + 0.5) return true;
    if (Math.abs(dx) > WY.rx + 2) return false;
    var u = Math.max(-1, Math.min(1, dx / WY.rx));
    return y + 0.5 > WY.y + WY.ry * Math.sqrt(1 - u * u);
  }
  // faceted crystal spike from (bx, by) along unit direction (nx, ny); the facet facing the top-left is lit
  function crystal(b, bx, by, nx, ny, len, hw, C, glow) {
    var tx = -ny, ty = nx, tipx = bx + nx * len, tipy = by + ny * len, lit = (tx * -0.55 + ty * -0.8) > 0;
    var L = mk(b.w, b.h);
    poly(L, [bx - tx * hw, by - ty * hw, tipx, tipy, bx + tx * hw, by + ty * hw], function (x, y) {
      return (((x + 0.5 - bx) * tx + (y + 0.5 - by) * ty) > 0) === lit ? C[3] : C[1];
    });
    line(L, bx, by, tipx - nx, tipy - ny, glow ? C[4] : C[2]);
    px(L, tipx - nx * 0.5, tipy - ny * 0.5, glow ? C[4] : C[3]);
    over(b, L, C[0]);
  }
  function wySamples(P, r0, r1) {
    var N = 40, S = [], s = 0;
    for (var k = 0; k <= N; k++) {
      var t = k / N, p = bez3(P, t), q = bez3(P, Math.min(1, t + 0.02)), o = bez3(P, Math.max(0, t - 0.02));
      var tx = q[0] - o[0], ty = q[1] - o[1], L = Math.sqrt(tx * tx + ty * ty) || 1;
      if (k) s += Math.sqrt((p[0] - S[k - 1].x) * (p[0] - S[k - 1].x) + (p[1] - S[k - 1].y) * (p[1] - S[k - 1].y));
      S.push({ x: p[0], y: p[1], r: r0 + (r1 - r0) * t, tx: tx / L, ty: ty / L, s: s });
    }
    return S;
  }
  // segmented tube along the samples: banded scales on the back, pale plates on the belly, crystal flecks
  function wyTube(lay, S) {
    var x0 = lay.w, y0 = lay.h, x1 = 0, y1 = 0, k;
    for (k = 0; k < S.length; k++) { x0 = Math.min(x0, Math.floor(S[k].x - S[k].r)); x1 = Math.max(x1, Math.ceil(S[k].x + S[k].r)); y0 = Math.min(y0, Math.floor(S[k].y - S[k].r)); y1 = Math.max(y1, Math.ceil(S[k].y + S[k].r)); }
    for (var y = Math.max(0, y0); y <= Math.min(lay.h - 1, y1); y++) for (var x = Math.max(0, x0); x <= Math.min(lay.w - 1, x1); x++) {
      var best = -1e9, bi = 0;
      for (k = 0; k < S.length; k++) { var dx = x + 0.5 - S[k].x, dy = y + 0.5 - S[k].y, v = S[k].r - Math.sqrt(dx * dx + dy * dy); if (v > best) { best = v; bi = k; } }
      if (best < 0) continue;
      var M = S[bi], nx = (x + 0.5 - M.x) / M.r, ny = (y + 0.5 - M.y) / M.r;
      var dors = nx * M.ty - ny * M.tx, l = -0.55 * nx - 0.8 * ny, band = M.s % 3.4 < 1.1, c;
      if (dors < -0.45) c = WYRM.belly[band ? 0 : l > -0.15 ? 2 : 1];
      else {
        var kk = l > 0.55 ? 5 : l > 0.2 ? 4 : l > -0.2 ? 3 : l > -0.6 ? 2 : 1;
        if (band && kk > 1) kk--;
        c = WYRM.S[kk];
        if (dors > 0.25 && !band && (Math.round(M.s) * 5 + Math.round(dors * 4)) % 9 === 0) c = WYRM.cry[kk > 3 ? 3 : 2];
      }
      px(lay, x, y, c);
    }
  }
  var WY_SPK = [[0.2, 4.5, 2.4], [0.33, 6.5, 2.9], [0.47, 7, 3.1], [0.61, 6.5, 2.8], [0.75, 5, 2.3], [0.87, 3.5, 1.7]];
  var WY_TAIL_SPK = [[0.45, 2.5, 1.4], [0.7, 2, 1.1]];
  function wySpikes(lay, S, list, glow, broken) {
    for (var k = 0; k < list.length; k++) {
      if (broken && broken.indexOf(k) >= 0) continue;
      var M = S[Math.round(list[k][0] * (S.length - 1))], nx = M.ty, ny = -M.tx;
      var dx = nx - M.tx * 0.45, dy = ny - M.ty * 0.45, L = Math.sqrt(dx * dx + dy * dy);
      crystal(lay, M.x + nx * M.r * 0.5, M.y + ny * M.r * 0.5, dx / L, dy / L, M.r * 0.5 + list[k][1], list[k][2], WYRM.cry, glow);
    }
  }
  // glowing fractures (dying)
  function wyCracks(lay, S, n) {
    var at = [0.62, 0.4, 0.8];
    for (var k = 0; k < n; k++) {
      var M = S[Math.round(at[k] * (S.length - 1))], nx = M.ty, ny = -M.tx, r = M.r;
      var pts = [M.x + nx * r * 0.85, M.y + ny * r * 0.85, M.x + nx * r * 0.3 + M.tx * 1.4, M.y + ny * r * 0.3 + M.ty * 1.4,
        M.x - nx * r * 0.2 - M.tx * 0.8, M.y - ny * r * 0.2 - M.ty * 0.8, M.x - nx * r * 0.75 + M.tx * 0.6, M.y - ny * r * 0.75 + M.ty * 0.6];
      pline(lay, pts, WYRM.cry[3]);
      px(lay, pts[2], pts[3], WYRM.cry[4]); px(lay, pts[4], pts[5], WYRM.cry[4]);
    }
  }
  // the head, in local coords (u forward, v down), scaled to ~16px long; jaw opens about the hinge
  var WY_SKULL = [-3, -4, 2, -5.6, 7, -5.2, 11, -4, 14.6, -2.6, 17, -1.2, 17.4, 0.8, 12, 1.4, 6, 2, 0, 3.2, -3, 2.6];
  var WY_JAW = [0, 1.6, 16, 0.9, 16.4, 2.2, 12, 3.6, 5, 4.6, 0, 4.4, -2, 3];
  function wyrmHead(lay, hx, hy, th, jaw, eye, glow, spray) {
    var HS = 1, c = Math.cos(th) * HS, s = Math.sin(th) * HS, cj = Math.cos(jaw), sj = Math.sin(jaw), k;
    function T(u, v) { return [hx + u * c - v * s, hy + u * s + v * c]; }
    function loc(x, y) { var dx = x + 0.5 - hx, dy = y + 0.5 - hy; return [(dx * c + dy * s) / (HS * HS), (-dx * s + dy * c) / (HS * HS)]; }
    function J(u, v) { var du = u - 2, dv = v - 1.8; return T(2 + du * cj - dv * sj, 1.8 + du * sj + dv * cj); }
    function map(pts, f) { var o = []; for (var q = 0; q < pts.length; q += 2) { var p = f(pts[q], pts[q + 1]); o.push(p[0], p[1]); } return o; }
    function dir(a, b2) { var dx = b2[0] - a[0], dy = b2[1] - a[1], L = Math.sqrt(dx * dx + dy * dy) || 1; return [dx / L, dy / L, L]; }
    var C = WYRM.cry, S = WYRM.S;
    // great crystal horns sweeping back from the brow (behind the skull)
    var hb = T(1.5, -4), ht = T(-7.5, -9.4), d1 = dir(hb, ht);
    crystal(lay, hb[0], hb[1], d1[0], d1[1], d1[2], 2, C, glow);
    var hb2 = T(5, -4.8), ht2 = T(-0.5, -10.2), d2 = dir(hb2, ht2);
    crystal(lay, hb2[0], hb2[1], d2[0], d2[1], d2[2], 1.7, C, glow);
    var H = mk(lay.w, lay.h);
    // open maw
    if (jaw > 0.05) {
      var m1 = T(1, 1.6), m2 = T(16.8, 1), m3 = J(16, 1), m4 = J(3, 2.2);
      poly(H, [m1[0], m1[1], m2[0], m2[1], m3[0], m3[1], m4[0], m4[1]], WYRM.maw[1]);
      var thr = T(4.5, 2.4);
      px(H, thr[0], thr[1], spray ? C[4] : WYRM.maw[0]); px(H, thr[0] + c * 1.1, thr[1] + s * 1.1, spray ? C[3] : WYRM.maw[2]);
    }
    // lower jaw (pale chin), then the skull
    poly(H, map(WY_JAW, J), function (x, y) {
      var l = loc(x, y), du = l[0] - 2, dv = l[1] - 1.8, jv = 1.8 - du * sj + dv * cj;
      return jv > 3.6 ? WYRM.belly[1] : jv > 2.4 ? S[3] : S[2];
    });
    poly(H, map(WY_SKULL, T), function (x, y) {
      var l = loc(x, y), k2 = l[1] < -4.2 ? 5 : l[1] < -2.4 ? 4 : l[1] < -0.4 ? 3 : 2;
      if (l[0] < -1 && k2 > 2) k2--;
      return S[k2];
    });
    // teeth
    for (k = 0; k < 4; k++) { var tu = 6 + k * 3, tp = T(tu, 1.9); px(H, tp[0], tp[1], WYRM.tooth); if (jaw > 0.3) { var tp2 = T(tu, 2.8); px(H, tp2[0], tp2[1], WYRM.tooth); } }
    if (jaw > 0.3) for (k = 0; k < 3; k++) { var lt = J(8 + k * 3, 0.9); px(H, lt[0], lt[1], WYRM.tooth); }
    // heavy brow, nostril, eye
    var b0 = T(6.2, -3.6), b1 = T(12, -3); line(H, b0[0], b0[1], b1[0], b1[1], S[1]);
    var ns = T(15.6, -1.1); px(H, ns[0], ns[1], S[0]);
    var e0 = T(8.6, -2.2), e1 = T(9.7, -2.2), e2 = T(10.8, -2.0);
    if (eye === 'shut') line(H, e0[0], e0[1] + 0.5, e2[0], e2[1] + 0.5, S[0]);
    else { px(H, e0[0], e0[1], WYRM.eye[1]); px(H, e1[0], e1[1], WYRM.eye[2]); px(H, e2[0], e2[1], WYRM.eye[0]); }
    over(lay, H, S[0]);
    // brow crystals and a snout horn on top
    var c1 = T(8, -4.6), c2 = T(3.4, -4.4), c3 = T(14.4, -2.6), up = dir(T(0, 0), T(-0.35, -1));
    crystal(lay, c1[0], c1[1], up[0], up[1], 2.6, 1.1, C, glow);
    crystal(lay, c3[0], c3[1], up[0] * 0.6 + c * 0.5, up[1] * 0.6 + s * 0.5, 2.2, 1, C, glow);
    if (spray) { // a cone of crystal shards bursting from the throat
      var m0 = T(17, 1.6), ang = th + 0.12;
      var sh = spray === 1 ? [[3, -0.3], [6, 0.05], [4.5, 0.35]] : [[6, -0.32], [9.5, 0.02], [7.5, 0.34], [3.5, 0.15]];
      for (k = 0; k < sh.length; k++) {
        var a = ang + sh[k][1], sx = m0[0] + Math.cos(a) * sh[k][0], sy = m0[1] + Math.sin(a) * sh[k][0];
        if (sx < 59) crystal(lay, sx, sy, Math.cos(a), Math.sin(a), 2.6, 0.9, C, true);
        else px(lay, Math.min(61, sx), sy, C[4]);
      }
      pxIn(lay, m0[0] + 1, m0[1] - 2, C[3]); pxIn(lay, m0[0] + 3, m0[1] + 3, C[4]);
    }
  }
  function wyPose(anim, i) {
    var p = { P: [[32, 47], [22, 30], [26, 13], [38, 13]], th: 0.14, jaw: 0.06, eye: 'glow', glow: false, spray: 0, crack: 0, broken: null,
      r0: 6.6, r1: 3.9, body: true, head: true, tail: false, hole: 'open', rocks: 0, dust: -1, churn: 0 };
    function S(P, th, jaw) { p.P = P; p.th = th; if (jaw != null) p.jaw = jaw; }
    if (anim === 'idle') { if (i) S([[32, 47], [22.5, 31], [26.5, 14], [38, 14]], 0.2); }
    else if (anim === 'move') {
      var sw = [-1, 0, 1, 0][i], dip = [0, 0.5, 1, 0.5][i];
      S([[32, 47], [22 + sw, 30 + dip], [26 + sw, 13 + dip], [38 + sw, 13 + dip]], 0.14 + sw * 0.06); p.churn = i + 1;
    } else if (anim === 'attack') {
      if (i === 0) { S([[32, 47], [22, 30], [22, 13], [33, 12]], -0.45, 0.14); p.glow = true; }
      if (i === 1) { S([[32, 47], [25, 32], [31, 15], [40, 15]], 0.18, 0.62); p.spray = 1; p.glow = true; }
      if (i === 2) { S([[32, 47], [25, 32], [31, 15], [40, 15]], 0.12, 0.55); p.spray = 2; }
      if (i === 3) { S([[32, 47], [23, 30], [27, 12.5], [38, 13]], 0.12, 0.2); }
    } else if (anim === 'hurt') { S([[32, 47], [21, 30], [23, 13], [34, 13]], -0.3, 0.35); p.eye = 'shut'; }
    else if (anim === 'die') {
      p.eye = 'shut';
      if (i === 0) { S([[32, 47], [21, 31], [22, 15], [33, 14]], -0.6, 0.7); p.crack = 1; }
      if (i === 1) { S([[32, 47], [24, 26], [37, 16], [44, 25]], 0.9, 0.25); p.crack = 2; p.broken = [1, 4]; }
      if (i === 2) { S([[32, 47], [29, 31], [40, 29], [42, 33]], 0.3, 0.15); p.crack = 3; p.broken = [0, 1, 3, 4]; p.dust = 1; }
      if (i >= 3) { p.body = false; p.hole = 'rubble'; p.dust = i === 3 ? 2 : 3; }
    } else if (anim === 'burrow') {
      if (i === 0) { S([[32, 47], [22, 31], [23, 14], [32, 13]], -0.55, 0.1); }
      if (i === 1) { S([[27, 47], [23, 14], [42, 4], [39, 22]], 1.45, 0.05); p.churn = 2; }
      if (i === 2) { S([[25, 47], [22, 24], [40, 20], [40, 50]], 1.57, 0); p.head = false; p.dust = 0; p.churn = 3; }
      if (i === 3) { S([[27, 47], [25, 35], [33, 33], [36, 38]], 0.8, 0); p.r0 = 4.4; p.r1 = 1.6; p.head = false; p.tail = true; p.dust = 1; }
    } else if (anim === 'emerge') {
      if (i === 0) { p.body = false; p.hole = 'mound'; p.dust = 0; }
      if (i === 1) { S([[32, 47], [32, 40], [32, 35], [32, 31]], -1.5, 0.3); p.rocks = 1; p.dust = 1; }
      if (i === 2) { S([[32, 47], [26, 32], [27, 18], [35, 15]], -0.6, 0.65); p.rocks = 2; }
      if (i === 3) { S([[32, 47], [22, 30], [26, 13], [38, 13]], 0.02, 0.25); p.rocks = 3; }
    }
    return p;
  }
  var WY_RIM = (function () { var o = []; for (var k = 0; k < 12; k++) { var a = (k + 0.35) / 12 * Math.PI * 2; o.push([Math.cos(a), Math.sin(a), 1.5 + hash(k, 3, 41) * 1.3]); } return o; })();
  function wyPit(b) {
    ell(b, WY.x, WY.y, WY.rx, WY.ry, WYRM.pit);
    for (var x = Math.floor(WY.x - WY.rx); x <= WY.x + WY.rx; x++) {
      var u = (x + 0.5 - WY.x) / WY.rx;
      if (Math.abs(u) >= 0.95) continue;
      var top = Math.round(WY.y - WY.ry * Math.sqrt(1 - u * u));
      px(b, x, top, WYRM.rock[1]); px(b, x, top + 1, WYRM.wall);
    }
  }
  function wyRim(back, front, churn) {
    for (var k = 0; k < WY_RIM.length; k++) {
      var R = WY_RIM[k], hop = churn && (k + churn) % 3 === 0 ? 1 : 0;
      var x = WY.x + R[0] * (WY.rx + 0.6), y = WY.y + R[1] * (WY.ry + 0.7) - hop;
      var fr = R[1] > 0.4 ? 0.8 : 1;
      rock(R[1] < 0 ? back : front, x, y - (fr < 1 ? 0.4 : 0), (R[2] + 0.4) * fr, R[2] * 0.8 * fr, WYRM.rock, 50 + k, 2.2);
    }
    crystal(back, WY.x - WY.rx + 1.5, WY.y - 2.5, -0.5, -0.86, 4, 1.3, WYRM.cry);
    crystal(back, WY.x + WY.rx - 2.5, WY.y - 3, 0.35, -0.94, 5, 1.5, WYRM.cry);
    crystal(front, WY.x + WY.rx - 0.5, WY.y + 2.5, 0.6, -0.8, 3.5, 1.2, WYRM.cry);
  }
  // emerge frame 0: the floor heaves and cracks, crystal light leaking out
  function wyMound(back, front) {
    var cr = [[0.3, 16], [1.5, 11], [2.5, 17], [3.6, 12], [4.6, 15], [5.6, 11]], k;
    for (k = 0; k < cr.length; k++) {
      var a = cr[k][0], L = cr[k][1], mx = WY.x + Math.cos(a + 0.2) * L * 0.55, my = WY.y + Math.sin(a + 0.2) * L * 0.55 * 0.42;
      var ex = WY.x + Math.cos(a) * L, ey = WY.y + Math.sin(a) * L * 0.42;
      line(back, WY.x, WY.y, mx, my, WYRM.pit); line(back, mx, my, ex, ey, WYRM.pit);
      px(back, mx, my, WYRM.cry[3]); px(back, (WY.x + mx) / 2, (WY.y + my) / 2, WYRM.cry[4]);
    }
    var M = [[25.5, 39.6, 3.2, 2.5], [32.5, 37.4, 4.2, 3.4], [39.5, 39.8, 3.2, 2.5], [29.5, 42, 3, 2.2], [36, 42.4, 3.2, 2.3], [21, 41.6, 2, 1.6], [43.5, 41.8, 2, 1.6]];
    for (k = 0; k < M.length; k++) rock(front, M[k][0], M[k][1], M[k][2], M[k][3], WYRM.rock, 70 + k, 2.2);
    crystal(front, 32, 35, -0.2, -1, 4.5, 1.6, WYRM.cry, true); crystal(front, 37, 37.5, 0.5, -0.85, 3, 1.2, WYRM.cry, true);
  }
  // die 3-4: a long spill of crystal rubble where the wyrm fell
  function wyRubble(front, settle) {
    var M = [[27, 39.5, 3, 2.3], [33, 37.6, 3.8, 3], [39.5, 37, 3.4, 2.8], [45.5, 37.4, 3, 2.4], [51, 38.4, 2.6, 2], [31, 42, 2.8, 2.1], [38, 41.4, 3, 2.2], [44.5, 41.2, 2.4, 1.9], [55.5, 39.6, 1.8, 1.4]];
    for (var k = 0; k < M.length; k++) rock(front, M[k][0], M[k][1] + settle * 0.5, M[k][2], M[k][3], WYRM.rock, 90 + k, 2.2);
    crystal(front, 34, 35 + settle * 0.5, -0.3, -0.95, 5, 1.6, WYRM.cry, !settle);
    crystal(front, 41, 35 + settle * 0.5, 0.45, -0.9, 4, 1.4, WYRM.cry);
    crystal(front, 47.5, 36 + settle * 0.5, 0.1, -1, 3, 1.1, WYRM.cry);
  }
  var WY_ROCKS = [null,
    [[22, 22, 1.6], [43, 18, 1.4], [27, 10, 1.2], [39, 7, 1.3], [17, 31, 1.2], [47, 29, 1.2]],
    [[15, 25, 1.4], [50, 22, 1.3], [19, 14, 1.1], [46, 9, 1.1], [12, 35, 1.1], [54, 33, 1.1]],
    [[10, 37, 1.2], [55, 37, 1.1], [14, 31, 1], [50, 30, 1]]];
  var WY_DUST = [
    [[22, 40, 2], [42, 40, 2.2], [32, 37, 1.6]],
    [[19, 39, 3], [45, 39, 3], [24, 36, 2.4], [40, 35, 2.6], [32, 42, 2.4]],
    [[22, 38, 3.4], [33, 36, 3.8], [44, 37, 3.6], [52, 38, 2.6], [28, 34, 2.6], [39, 33, 2.8]],
    [[25, 37, 2], [36, 35, 2.2], [47, 36, 2], [54, 37, 1.4]]];
  function drawWyrm(v, anim, i) {
    var p = wyPose(anim, i), b = mk(64, 48), back = mk(64, 48), front = mk(64, 48), x, y, k;
    if (p.hole === 'mound') wyMound(back, front);
    else { wyPit(b); wyRim(back, front, p.churn); }
    if (p.hole === 'rubble') wyRubble(front, i - 3);
    outline(back, OL); blit(b, back, 0, 0);
    if (p.body) {
      var S = wySamples(p.P, p.r0, p.r1), cr = mk(64, 48), bd = mk(64, 48);
      wySpikes(cr, S, p.tail ? WY_TAIL_SPK : WY_SPK, p.glow, p.broken);
      wyTube(bd, S);
      if (p.crack) wyCracks(bd, S, p.crack);
      over(cr, bd, WYRM.S[0]);
      var E = S[S.length - 1];
      if (p.tail) crystal(cr, E.x, E.y, E.tx, E.ty, 3.4, 1.4, WYRM.cry);
      if (p.head) { var hd = mk(64, 48); wyrmHead(hd, E.x + Math.cos(p.th), E.y + Math.sin(p.th), p.th, p.jaw, p.eye, p.glow, p.spray); over(cr, hd, WYRM.S[0]); }
      for (y = 0; y < 48; y++) for (x = 0; x < 64; x++) if (A(cr, x, y) && wyClip(x, y)) clr(cr, x, y);
      outline(cr, OL);
      if (anim === 'hurt') cr = flash(cr);
      blit(b, cr, 0, 0);
    }
    outline(front, OL); blit(b, front, 0, 0);
    if (p.rocks) {
      var RK = WY_ROCKS[p.rocks], st = mk(64, 48);
      for (k = 0; k < RK.length; k++) rock(st, RK[k][0], RK[k][1], RK[k][2] + 0.3, RK[k][2], WYRM.rock, 120 + k, 2);
      outline(st, OL); blit(b, st, 0, 0);
    }
    if (p.dust >= 0) cloud(b, WY_DUST[p.dust], WYRM.dust, [0.85, 0.85, 0.8, 0.5][p.dust]);
    return b;
  }
  defType('deep_wyrm', {
    w: 64, h: 48, ax: 32, ay: 40,
    anims: { idle: 2, move: 4, attack: 4, hurt: 1, die: 5, burrow: 4, emerge: 4 },
    variants: ['default'],
    fps: { idle: 2, move: 6, attack: 7, die: 6, burrow: 7, emerge: 7 },
    draw: drawWyrm
  });

  // ======================================================================= INK BAT (16x14, flying; engine draws the `shadow` fx) — Forgotten Library: spilt ink with parchment-page wings
  var INKB = { k: '#0c0a16', m: '#1c1830', l: '#2e2a4a', h: '#4a4470', E: '#ffd27a', e: '#fff6dc', f: '#f4eedf', d: '#1c1830',
    b: '#16121f', W: '#fbf3dc', w: '#e2d4b0', t: '#8a7a64', s: '#b8a684' };
  // wings are torn book pages: b = inked wing-bone, W/w = parchment, t = lines of text, s = page shadow
  var INKB_WING = {
    up: { y: 0, r: ['bW...', 'bWW..', 'WtWW.', 'WWtWb', '.WWWb', '..tWW', '...Ws'] },
    mid: { y: 4, r: ['bbbb.', 'WWWWb', 'tttWW', 'WWWWW', 'W.W.s'] },
    down: { y: 6, r: ['....b', '...bW', '..bWW', '.bWtW', 'bWWWW', 'WtW.s', 'W....'] },
    mid2: { y: 5, r: ['..bbb', '.bWWW', 'bWttW', 'WWWWs', '.W.Ws'] },
    crumple: { y: 6, r: ['.bb..', 'bWwb.', '.tws.'] }
  };
  var INKB_BODY = ['.k...k.', '.km.mk.', '.mmmmm.', 'mhlmmmm', 'mlmEmEm', 'mmmmmmm', '.dmmmmd', '..dmmd.'];
  function inkPage(b, x, y, tilt, al) {
    var L = mk(b.w, b.h);
    spr(L, tilt ? ['.Ww', 'Wtw', 'tws', 's..'] : ['WWw', 'ttw', 'Wws'], INKB, x, y);
    outline(L, OL); blit(b, L, 0, 0, false, al);
  }
  function drawInkBat(v, anim, i) {
    var b = mk(16, 14), wing = 'mid', by = 3, bx = 5, face = 'n', drip = 1 + (i % 2), k;
    if (anim === 'idle') { wing = ['mid', 'down'][i]; by = [3, 2][i]; }
    else if (anim === 'move') { wing = ['up', 'mid', 'down', 'mid2'][i]; by = [4, 3, 2, 3][i]; drip = [1, 2, 2, 1][i]; }
    else if (anim === 'attack') { wing = ['up', 'down'][i]; by = [4, 3][i]; bx = [4, 5][i]; face = ['n', 'bite'][i]; drip = 0; }
    else if (anim === 'hurt') { wing = 'up'; by = 4; bx = 4; face = 'shut'; drip = 0; }
    else if (anim === 'die') {
      if (i >= 2) { // an ink splat on the floor; two loose pages flutter down
        var al = i === 2 ? 1 : 0.55;
        ell(b, 8, 11.6, i === 2 ? 4.4 : 3.6, 1.3, INKB.m, al); ell(b, 7.4, 11.4, i === 2 ? 2.4 : 1.8, 0.8, INKB.l, al);
        px(b, 2, 11, INKB.m, al); px(b, 13, 12, INKB.m, al); px(b, 14, 10, INKB.k, al);
        if (i === 2) { inkPage(b, 1, 4, true, 1); inkPage(b, 11, 6, false, 1); } else { inkPage(b, 2, 8, false, 0.7); inkPage(b, 11, 9, true, 0.7); }
        return b;
      }
      wing = i ? 'crumple' : 'up'; by = [4, 5][i]; face = 'dead'; drip = 0;
    }
    var W = INKB_WING[wing], wy = wing === 'crumple' ? W.y + by - 4 : W.y + (by - 3);
    var lay = mk(16, 14);
    spr(lay, W.r, INKB, bx - 3, wy, false);
    spr(lay, W.r, INKB, bx + 5, wy, true);
    spr(lay, INKB_BODY, INKB, bx, by);
    var ey = by + 4;
    if (face === 'bite') { px(lay, bx + 4, ey + 2, INKB.k); px(lay, bx + 4, ey + 3, INKB.k); px(lay, bx + 3, ey + 2, INKB.f); px(lay, bx + 5, ey + 2, INKB.f); px(lay, bx + 5, ey + 3, INKB.f); }
    if (face === 'shut' || face === 'dead') { px(lay, bx + 3, ey, INKB.k); px(lay, bx + 5, ey, INKB.k); if (face === 'dead') { px(lay, bx + 4, ey + 2, INKB.k); } }
    else px(lay, bx + 5, ey, INKB.e);
    if (drip) { px(lay, bx + 3, by + 8, INKB.m); if (drip > 1) px(lay, bx + 3, by + 9, INKB.k); }
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (anim === 'attack' && i === 1) { px(b, 13, 9, INKB.m); px(b, 13, 10, INKB.k); px(b, 14, 6, INKB.m); px(b, 12, 12, INKB.m, 0.8); }
    if (anim === 'die' && i === 1) { px(b, 3, 10, INKB.m); px(b, 3, 11, INKB.k); px(b, 12, 3, INKB.m); inkPage(b, 1, 1, true, 1); }
    if (anim === 'die' && i === 0) { px(b, 2, 10, INKB.m); px(b, 14, 3, INKB.m); px(b, 13, 11, INKB.k); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  defType('ink_bat', {
    w: 16, h: 14, ax: 8, ay: 13,
    anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 },
    variants: ['default'],
    fps: { idle: 6, move: 12, attack: 8, die: 8 },
    draw: drawInkBat
  });

  // ======================================================================= MOUNTS — horses & dragons, 4 directions, back/front layers around the rider
  var MOUNTS = Object.create(null), MOUNT_IDS = [];
  function defMount(id, def) { MOUNTS[id] = def; MOUNT_IDS.push(id); }
  // thick two-segment limb (hip -> knee -> foot), lit side + shade side
  function limb(b, p0, p1, p2, w, c, c2) {
    for (var k = 0; k < w; k++) {
      var col = k === 0 ? c : c2;
      line(b, p0[0] + k, p0[1], p1[0] + k, p1[1], col); line(b, p1[0] + k, p1[1], p2[0] + k, p2[1] - 1, col);
    }
  }
  var HORSE = {
    horse_midnight: { C: ['#100e1e', '#1e1a34', '#2e2a4c', '#43406a', '#5f5c8e'], M: ['#08060e', '#16122a', '#2c2650', '#4e4688'], hoof: '#0c0a14', blaze: '#e8eeff', sock: null, eye: '#ffbc62' },
    horse_silver: { C: ['#4a4c62', '#727690', '#9ca0b8', '#c6c9da', '#e8eaf4'], M: ['#8a8ea6', '#c4c8da', '#eef0f8', '#ffffff'], hoof: '#2e2c3e', blaze: null, sock: null, dapple: '#8a8ea8', eye: '#2a2238' },
    horse_chestnut: { C: ['#40200f', '#6a341a', '#944a24', '#ba6834', '#d8904c'], M: ['#2e140a', '#4e2212', '#73341c', '#9a4a28'], hoof: '#2a1810', blaze: '#f6efe2', sock: '#f0e6d4', eye: '#2a1810' }
  };
  var TACK = { L: ['#2e1a10', '#5a3420', '#8a5a36', '#b07a4c'], blanket: ['#2e2052', '#4a3888', '#6e58b4'], gold: ['#a8782e', '#f2c45a'], iron: '#8a8aa0' };
  // gallop: [nearFront, farFront, nearHind, farHind] hoof offsets {dx, lift} + knee bend; body bob
  var HORSE_GAIT = {
    idle: [{ bob: 0, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], tail: 0, nod: 0 }, { bob: 0, legs: [[0, 0], [0, 0], [0, 0], [0, 0]], tail: 1, nod: 1 }],
    walk: [{ bob: 0, legs: [[-3, 3], [-1, 2], [3, 1], [4, 0]], tail: 2, nod: 0 },
           { bob: -1, legs: [[3, 1], [2, 0], [-3, 1], [-4, 2]], tail: 3, nod: -1 },
           { bob: -2, legs: [[-1, 4], [-2, 4], [1, 3], [2, 3]], tail: 3, nod: 0 },
           { bob: -1, legs: [[2, 0], [-1, 2], [3, 3], [1, 1]], tail: 2, nod: 1 }]
  };
  function horseSide(P, g, back, front) {
    var C = P.C, M = P.M, oy = g.bob, k;
    var leg = function (hip, hoofX, hoofLift, near, front2) {
      var c = near ? C[3] : C[1], c2 = near ? C[2] : C[0];
      var hoof = [hoofX, 29 - hoofLift], knee = [(hip[0] + hoofX) / 2 + (front2 ? (hoofLift > 1 ? 2 : 0) : (hoofLift > 1 ? -1.5 : -1)), hip[1] + 4.5 - hoofLift * 0.4];
      limb(back, hip, knee, hoof, 2, c, c2);
      if (P.sock && front2 && near) { line(back, knee[0], knee[1] + 2, hoof[0], hoof[1] - 1, P.sock); }
      rect(back, Math.round(hoof[0]), Math.round(hoof[1]), 2, 1, P.hoof);
    };
    var L = g.legs;
    leg([19.5, 19.5 + oy], 19.5 + L[1][0], L[1][1], false, true);
    leg([8.5, 19.5 + oy], 8.5 + L[3][0], L[3][1], false, false);
    // tail: flows down at rest, streams back when galloping
    var tl = [[[5, 14], [3, 18], [2.5, 23], [3.5, 25]], [[5, 14], [3.5, 18], [3.5, 23], [5, 25]], [[5, 14], [2.5, 16.5], [1.2, 20], [1.5, 23]], [[5, 14], [2.5, 15.5], [1, 17.5], [1, 20]]][g.tail];
    for (k = 0; k < 3; k++) { line(back, tl[k][0], tl[k][1] + oy, tl[k + 1][0], tl[k + 1][1] + oy, M[2]); line(back, tl[k][0] + 1, tl[k][1] + oy, tl[k + 1][0] + 1, tl[k + 1][1] + oy, M[1]); }
    px(back, tl[3][0], tl[3][1] + oy + 1, M[1]);
    // body
    var bd = mk(32, 32);
    shadeEll(bd, 9.2, 16.4 + oy, 4.2, 4.6, C, 4);
    shadeEll(bd, 15, 17 + oy, 7.4, 4.3, C, 4);
    shadeEll(bd, 21.4, 16.8 + oy, 3.4, 4.4, C, 4);
    if (P.dapple) { var dp = [[9, 15], [12, 18], [15, 15], [18, 18], [7, 18], [13, 20]]; for (k = 0; k < dp.length; k++) px(bd, dp[k][0], dp[k][1] + oy, P.dapple); }
    // neck + head
    var hy = Math.max(-1, oy + g.nod * 0.6);
    poly(bd, [18.6, 14 + oy, 22.8, 15.4 + oy, 26.4, 8.4 + hy, 24.2, 5.6 + hy, 22, 7 + hy], function (x, y) { return x < 21 ? C[3] : C[2]; });
    shadeEll(bd, 25.4, 6.4 + hy, 2.5, 2.1, C, 4);
    shadeEll(bd, 27.8, 8.6 + hy, 1.9, 1.5, C, 4);
    px(bd, 29.2, 8.8 + hy, C[0]); line(bd, 27.2, 9.8 + hy, 28.8, 9.8 + hy, C[0]); // nostril, mouth
    px(bd, 25.6, 5.6 + hy, P.eye); px(bd, 25.6, 5.6 + hy, '#1a1426'); px(bd, 26.2, 5.4 + hy, '#ffffff');
    if (P.blaze) { px(bd, 26.4, 6.6 + hy, P.blaze); px(bd, 27.2, 7.4 + hy, P.blaze); px(bd, 27.8, 8.2 + hy, P.blaze); }
    spr(bd, ['.a', 'ab'], { a: C[3], b: C[2] }, 23.6, 3 + hy); spr(bd, ['a.', 'ab'], { a: C[4], b: C[3] }, 25.2, 2.8 + hy); // ears
    // bridle + reins
    line(bd, 24.6, 4.6 + hy, 27.4, 9.4 + hy, TACK.L[1]); px(bd, 27.6, 9.6 + hy, TACK.iron);
    line(bd, 27.4, 9.6 + hy, 19.8, 12.6 + oy, TACK.L[2]);
    // mane along the neck crest
    for (k = 0; k < 6; k++) { var mx = 23.8 - k * 0.95, my = 5.4 + k * 1.3 + (k < 2 ? hy : oy); px(bd, mx, my, M[2]); px(bd, mx - 1, my + 0.6 + (g.legs[0][1] > 2 ? -1 : 0), M[1]); }
    px(bd, 24.8, 4.4 + hy, M[3]); // forelock
    // saddle + violet blanket + girth
    spr(bd, ['..llllll..', '.lLLLLLLl.', 'bBBBBBBBBb', 'gBBBBBBBBg', '.bbbbbbbb.'], { l: TACK.L[2], L: TACK.L[3], b: TACK.blanket[0], B: TACK.blanket[1], g: TACK.gold[1] }, 11, 10.4 + oy);
    px(bd, 19.6, 10.8 + oy, TACK.L[1]); px(bd, 19.6, 11.6 + oy, TACK.L[2]); px(bd, 12, 10.8 + oy, TACK.L[1]); // pommel, cantle
    line(bd, 17, 15 + oy, 17, 21 + oy, TACK.L[1]);
    over(back, bd, C[0]);
    leg([21.6, 19.5 + oy], 21.6 + L[0][0], L[0][1], true, true);
    leg([10.4, 19.5 + oy], 10.4 + L[2][0], L[2][1], true, false);
    // front layer: the near saddle flap + stirrup cover the rider's legs
    spr(front, ['LLLL', 'lLLL', 'llLl', '.ll.'], { l: TACK.L[1], L: TACK.L[2] }, 14, 13 + oy);
    line(front, 16, 17 + oy, 16, 19 + oy, TACK.iron); rect(front, 15, 20 + oy, 3, 1, TACK.iron);
  }
  function horseDown(P, g, back, front) {
    var C = P.C, M = P.M, oy = g.bob, k;
    var stepA = g.legs[0][1], stepB = g.legs[1][1];
    // far hind legs peek out behind
    limb(back, [11.5, 20 + oy], [11.5, 24 + oy], [11.5, 28 - g.legs[2][1] * 0.3], 2, C[1], C[0]); rect(back, 11, 28 - Math.round(g.legs[2][1] * 0.3), 2, 1, P.hoof);
    limb(back, [19.5, 20 + oy], [19.5, 24 + oy], [19.5, 28 - g.legs[3][1] * 0.3], 2, C[1], C[0]); rect(back, 19, 28 - Math.round(g.legs[3][1] * 0.3), 2, 1, P.hoof);
    var bd = mk(32, 32);
    shadeEll(bd, 16, 16.8 + oy, 7.2, 4.6, C, 4); // barrel seen head-on
    spr(bd, ['bbbb..........bbbb', 'gBBB..........BBBg', '.bbb..........bbb.'], { b: TACK.blanket[0], B: TACK.blanket[1], g: TACK.gold[1] }, 7, 13 + oy);
    spr(bd, ['.llllllllll.', 'lLLLLLLLLLLl'], { l: TACK.L[2], L: TACK.L[3] }, 10, 11.4 + oy);
    over(back, bd, C[0]);
    // front layer: chest, front legs, neck and the long face looking at us
    var fr = mk(32, 32);
    limb(fr, [13.5, 21 + oy], [13.5, 25 + oy - stepA * 0.6], [13.5, 29 - stepA], 2, C[3], C[2]); rect(fr, 13, 29 - stepA, 2, 1, P.hoof);
    limb(fr, [17.5, 21 + oy], [17.5, 25 + oy - stepB * 0.6], [17.5, 29 - stepB], 2, C[3], C[2]); rect(fr, 17, 29 - stepB, 2, 1, P.hoof);
    if (P.sock) { line(fr, 13.5, 27 - stepA, 13.5, 28 - stepA, P.sock); line(fr, 17.5, 27 - stepB, 17.5, 28 - stepB, P.sock); }
    shadeEll(fr, 16, 19.6 + oy, 5, 3.8, C, 4); // chest
    var hy = oy + g.nod * 0.6;
    shadeEll(fr, 16, 15.4 + hy, 2.4, 3.6, C, 4); // long face
    shadeEll(fr, 16, 18.4 + hy, 2.1, 1.6, C, 4); // muzzle
    px(fr, 15, 19 + hy, C[0]); px(fr, 17, 19 + hy, C[0]);
    px(fr, 13.8, 14 + hy, '#1a1426'); px(fr, 18.2, 14 + hy, '#1a1426'); px(fr, 13.8, 13.4 + hy, '#ffffff');
    if (P.blaze) { line(fr, 16, 13.4 + hy, 16, 17.2 + hy, P.blaze); }
    spr(fr, ['a.....a', 'ab...ba'], { a: C[3], b: C[2] }, 12.6, 10.6 + hy); // ears
    spr(fr, ['.mmm.', 'mMMMm', '.m.m.'], { m: M[1], M: M[2] }, 13.6, 11.6 + hy); // forelock
    line(fr, 14, 17 + hy, 13, 13.6 + oy, TACK.L[1]); line(fr, 18, 17 + hy, 19, 13.6 + oy, TACK.L[1]); // reins
    over(front, fr, C[0]);
  }
  function horseUp(P, g, back, front) {
    var C = P.C, M = P.M, oy = g.bob, k;
    // far front legs peek out beyond the barrel
    limb(back, [12.5, 19 + oy], [12.5, 23 + oy], [12.5, 27 - g.legs[0][1] * 0.3], 2, C[1], C[0]); rect(back, 12, 27 - Math.round(g.legs[0][1] * 0.3), 2, 1, P.hoof);
    limb(back, [18.5, 19 + oy], [18.5, 23 + oy], [18.5, 27 - g.legs[1][1] * 0.3], 2, C[1], C[0]); rect(back, 18, 27 - Math.round(g.legs[1][1] * 0.3), 2, 1, P.hoof);
    var bd = mk(32, 32), hy = Math.max(-1, oy + g.nod * 0.6);
    // neck and the back of the head, ears pricked, mane falling to one side
    poly(bd, [13.6, 14 + oy, 18.4, 14 + oy, 17.6, 6.4 + hy, 14.4, 6.4 + hy], C[2]);
    shadeEll(bd, 16, 5.6 + hy, 2.4, 2.2, C, 4);
    spr(bd, ['a...a', 'ab.ba'], { a: C[3], b: C[2] }, 13.6, 2.4 + hy);
    for (k = 0; k < 5; k++) { px(bd, 17.2, 6.6 + k * 1.5 + (k < 2 ? hy : oy), M[2]); px(bd, 18.2, 7.2 + k * 1.5 + (k < 2 ? hy : oy), M[1]); }
    shadeEll(bd, 16, 16.6 + oy, 7.2, 4.4, C, 4);
    spr(bd, ['bbbb..........bbbb', 'gBBB..........BBBg', '.bbb..........bbb.'], { b: TACK.blanket[0], B: TACK.blanket[1], g: TACK.gold[1] }, 7, 13 + oy);
    spr(bd, ['lLLLLLLLLLLl', '.llllllllll.'], { l: TACK.L[2], L: TACK.L[3] }, 10, 11.4 + oy);
    over(back, bd, C[0]);
    // front layer: the round rump, tail and hind legs, nearest the camera
    var fr = mk(32, 32);
    var sa = g.legs[2][1], sb = g.legs[3][1];
    limb(fr, [12.8, 22 + oy], [13, 25.5 + oy - sa * 0.5], [13, 29 - sa], 2, C[3], C[2]); rect(fr, 12.5, 29 - sa, 2, 1, P.hoof);
    limb(fr, [18.2, 22 + oy], [18, 25.5 + oy - sb * 0.5], [18, 29 - sb], 2, C[3], C[2]); rect(fr, 17.5, 29 - sb, 2, 1, P.hoof);
    shadeEll(fr, 13.6, 19.8 + oy, 3.6, 3.8, C, 4); shadeEll(fr, 18.4, 19.8 + oy, 3.6, 3.8, C, 4);
    var sw = [0, 1, -1, 0][g.tail];
    line(fr, 16, 17 + oy, 16 + sw, 25 + oy, M[2]); line(fr, 15, 18 + oy, 15 + sw, 24 + oy, M[1]); line(fr, 17, 18 + oy, 17 + sw, 24 + oy, M[1]); px(fr, 16 + sw, 26 + oy, M[1]);
    over(front, fr, C[0]);
  }
  function drawHorseMount(P, anim, dir, f) {
    var g = HORSE_GAIT[anim][f], back = mk(32, 32), front = mk(32, 32);
    if (dir === 'down') horseDown(P, g, back, front);
    else if (dir === 'up') horseUp(P, g, back, front);
    else horseSide(P, g, back, front);
    outline(back, OL); outline(front, OL);
    return { back: back, front: front };
  }
  ['horse_midnight', 'horse_silver', 'horse_chestnut'].forEach(function (id) {
    defMount(id, { w: 32, h: 32, ax: 16, ay: 30, seat: { x: 16, y: 11 }, anims: { idle: 2, walk: 4 }, fps: { idle: 2, walk: 10 },
      seatDy: { idle: [0, 0], walk: [0, -1, -2, -1] }, base: 'idle', draw: function (anim, dir, f) { return drawHorseMount(HORSE[id], anim, dir, f); } });
  });

  var DRAGON = {
    dragon_amethyst: { S: ['#1e1438', '#36245e', '#56408e', '#7a62b8', '#a48ae0'], belly: ['#b49ad8', '#e2d4fa'], spine: ['#d4c0ff', '#f6f0ff'], horn: ['#9a8a6e', '#e8dcb8'], W: ['#3e2a6e', '#6a4ea4', '#9a80d0'], eye: '#ffbc62' },
    dragon_emerald: { S: ['#0a2018', '#143a2c', '#20583e', '#2e7a54', '#4ea070'], belly: ['#9cc890', '#d4f0c4'], spine: ['#8dffcb', '#e8fff4'], horn: ['#9a8a6e', '#ece0c0'], W: ['#163e2e', '#2a6e4c', '#58a476'], eye: '#ffbc62' },
    dragon_ember: { S: ['#2a0c0a', '#561812', '#8a2a1a', '#c04a24', '#e87a3a'], belly: ['#e8a050', '#ffdc9a'], spine: ['#ffbc62', '#fff1c8'], horn: ['#3a2a28', '#7a6458'], W: ['#6a1e16', '#b23e26', '#ec8648'], eye: '#fff1c8' }
  };
  // wing poses for a flight cycle: up, mid, down, mid (relative to the shoulder); idle = folded
  var DWING = [
    { wr: [-4, -10], tips: [[-11, -15], [-15, -11.5], [-13, -6]] },
    { wr: [-6, -5], tips: [[-17, -8], [-19, -3], [-14, 1]] },
    { wr: [-4, 4], tips: [[-13, 10], [-9, 13], [-4, 11]] },
    { wr: [-6, -4], tips: [[-16, -6], [-17, -1], [-12, 2]] }
  ];
  function dragonWingSide(b, P, sx, sy, pose, far) {
    var Wc = P.W, d = far ? 1 : 0, wr = [sx + pose.wr[0] + d * 2, sy + pose.wr[1] - d], tips = pose.tips.map(function (t) { return [sx + t[0] + d * 3, sy + t[1] - d]; });
    var mem = mk(48, 48);
    poly(mem, [sx, sy, wr[0], wr[1], tips[0][0], tips[0][1], (tips[0][0] + tips[1][0]) / 2 + 1, (tips[0][1] + tips[1][1]) / 2 + 1, tips[1][0], tips[1][1], (tips[1][0] + tips[2][0]) / 2 + 1, (tips[1][1] + tips[2][1]) / 2, tips[2][0], tips[2][1], sx - 3, sy + 2],
      function (x, y) { return far ? Wc[0] : (y < wr[1] + 2 ? Wc[2] : Wc[1]); });
    line(mem, sx, sy, wr[0], wr[1], far ? P.S[1] : P.S[3]); line(mem, sx, sy + 1, wr[0], wr[1] + 1, P.S[far ? 0 : 2]);
    for (var k = 0; k < 3; k++) { line(mem, wr[0], wr[1], tips[k][0], tips[k][1], far ? P.S[1] : P.S[2]); }
    px(mem, wr[0], wr[1] - 1, P.horn[1]); // wing claw
    over(b, mem, P.S[0]);
  }
  function dragonSide(P, fly, f, back, front) {
    var S = P.S, rz = fly ? 9 + [0, 1, 2, 1][f] : 0, k;
    var bob = fly ? 0 : (f === 1 ? 1 : 0);
    var Y = function (y) { return y - rz + (y > 30 ? 0 : bob * 0.5); };
    // far wing (behind everything)
    if (fly) dragonWingSide(back, P, 20.5, Y(27), DWING[f], true);
    else poly(back, [21, Y(27), 15.6, Y(20.6), 8, Y(25), 16, Y(28)], P.W[0]);
    // far legs + tail
    if (!fly) { limb(back, [24, Y(36)], [25, Y(40)], [24.5, 45], 2, S[1], S[0]); limb(back, [9.5, Y(36)], [9, Y(40)], [9, 45], 2, S[1], S[0]); }
    var tl = fly ? [[7, Y(32)], [3, Y(31) + Math.sin(f * 1.6) ], [1.5, Y(29) + Math.sin(f * 1.6 + 1)]] : [[7, 33], [3.5, 37], [2.5, 41.5]];
    var tail = mk(48, 48);
    line(tail, 9, Y(31), tl[0][0], tl[0][1], S[2]); line(tail, 9, Y(33), tl[0][0], tl[0][1] + 1, S[2]); line(tail, 9, Y(32), tl[0][0], tl[0][1], S[3]);
    line(tail, tl[0][0], tl[0][1], tl[1][0], tl[1][1], S[2]); line(tail, tl[0][0], tl[0][1] + 1, tl[1][0], tl[1][1] + 1, S[1]);
    line(tail, tl[1][0], tl[1][1], tl[2][0], tl[2][1], S[2]);
    var tip = tl[2];
    spr(tail, fly ? ['.s.', 'sSs', '.s.'] : ['.s.', 'sSs', '.s.'], { s: P.spine[0], S: P.spine[1] }, Math.round(tip[0]) - (fly ? 1 : 0), Math.round(tip[1]) + (fly ? -1 : 0));
    over(back, tail, S[0]);
    // body: haunch, barrel, chest + pale belly plates
    var bd = mk(48, 48);
    shadeEll(bd, 11.4, Y(33), 4.8, 5, S, 4);
    shadeEll(bd, 17.6, Y(33.4), 7.4, 5, S, 4);
    shadeEll(bd, 24.4, Y(32.4), 4.4, 5.4, S, 4);
    for (var x = 9; x <= 27; x++) for (var y = Math.round(Y(35)); y <= Math.round(Y(38.6)); y++) if (A(bd, x, y)) px(bd, x, y, (y + x) % 3 ? P.belly[0] : P.belly[1]);
    // neck + head
    var hb = fly ? -1 : 0;
    poly(bd, [22.4, Y(30), 27.4, Y(32.6), 32.6, Y(24.6) + hb, 30.4, Y(20.6) + hb, 26.6, Y(23) + hb], function (x2, y2) { return x2 > 27.5 && y2 > Y(25.5) ? P.belly[0] : S[3]; });
    var hx = 33.4, hy = Y(20.2) + hb;
    shadeEll(bd, hx, hy, 4.2, 3.6, S, 4);
    shadeEll(bd, hx + 4, hy + 1.4, 3, 2.2, S, 4);
    shadeEll(bd, hx + 3.6, hy + 2.8, 2.4, 0.9, [P.belly[0], P.belly[0], P.belly[1], P.belly[1]], 2);
    px(bd, hx + 6.4, hy + 0.6, S[0]); // nostril
    line(bd, hx + 2.6, hy + 3.2, hx + 5.4, hy + 2.8, S[0]); // smile
    // big friendly eye
    spr(bd, ['eE', 'kE'], { e: P.eye, E: '#ffe8b0', k: '#140c1c' }, Math.round(hx + 0.4), Math.round(hy - 1.2)); px(bd, hx + 0.4, hy - 1.4, '#ffffff');
    line(bd, hx - 0.6, hy - 2.4, hx + 1.6, hy - 2.6, S[1]); // brow
    // swept horns + frill
    line(bd, hx - 1.4, hy - 2.6, hx - 5.4, hy - 6, P.horn[1]); line(bd, hx - 1.4, hy - 1.8, hx - 5.8, hy - 4.8, P.horn[0]); px(bd, hx - 5.8, hy - 6.4, P.horn[1]);
    line(bd, hx - 0.2, hy - 3.2, hx - 2.4, hy - 6.6, P.horn[1]); px(bd, hx - 2.4, hy - 6.6, '#ffffff');
    spr(bd, ['s.', 'ss', 's.'], { s: P.spine[0] }, Math.round(hx - 3.8), Math.round(hy));
    // spines along the neck and back
    var spn = [[29.2, 22.4], [27.2, 24.4], [25.2, 25], [19, 27.4], [15, 27.2], [11, 27.8], [7.6, 29.4]];
    for (k = 0; k < spn.length; k++) { if (k === 2 || k === 3) continue; var sxx = spn[k][0], syy = Y(spn[k][1]) + (k < 2 ? hb : 0); px(bd, sxx, syy, P.spine[1]); px(bd, sxx - 1, syy + 1, P.spine[0]); }
    // saddle with a violet blanket at the base of the neck
    spr(bd, ['..lll..', '.lLLLl.', 'bBBBBBb', 'gBBBBBg', '.bbbbb.'], { l: TACK.L[2], L: TACK.L[3], b: TACK.blanket[0], B: TACK.blanket[1], g: TACK.gold[1] }, 21, Y(24));
    over(back, bd, S[0]);
    // near legs: grounded when landed, tucked when flying
    var lg = mk(48, 48);
    if (!fly) {
      limb(lg, [26.6, Y(36)], [27.6, Y(40)], [27, 45], 3, S[3], S[2]); spr(lg, ['c.c.c'], { c: P.horn[1] }, 26, 45);
      shadeEll(lg, 12.6, Y(37), 3, 3.4, S, 4); limb(lg, [12.4, Y(39)], [12.8, Y(41.5)], [12, 45], 3, S[3], S[2]); spr(lg, ['c.c.c'], { c: P.horn[1] }, 11, 45);
    } else {
      limb(lg, [25.6, Y(36)], [27.6, Y(39)], [25.6, Y(41)], 2, S[3], S[2]); px(lg, 25, Y(41.6), P.horn[1]);
      shadeEll(lg, 12.4, Y(37), 3, 3, S, 4); limb(lg, [12.4, Y(39)], [10.4, Y(41)], [7.4, Y(41)], 2, S[3], S[2]); px(lg, 7, Y(41.6), P.horn[1]);
    }
    over(back, lg, S[0]);
    // near wing in front of the rider (folded along the flank when landed)
    if (fly) dragonWingSide(front, P, 20.5, Y(28), DWING[f], false);
    else {
      var fw = mk(48, 48);
      poly(fw, [22, Y(27.6), 17, Y(21.8), 6.6, Y(27.6), 9.6, Y(31.6), 17.6, Y(31.4)], function (x3, y3) { return y3 < Y(26) ? P.W[2] : P.W[1]; });
      line(fw, 22, Y(27.6), 17, Y(21.8), S[3]); line(fw, 17, Y(21.8), 6.6, Y(27.6), S[2]); line(fw, 17, Y(21.8), 10.6, Y(31), S[2]); line(fw, 17, Y(21.8), 14.6, Y(31.2), S[2]);
      px(fw, 17, Y(20.8), P.horn[1]);
      over(front, fw, S[0]);
    }
  }
  function dragonFront(P, fly, f, back, front, facing) {
    var S = P.S, rz = fly ? 9 + [0, 1, 2, 1][f] : 0, bob = fly ? 0 : (f === 1 ? 1 : 0), k;
    var Y = function (y) { return y - rz + bob * 0.5; };
    // wings: folded at the sides, or spread wide and beating
    var wg = mk(48, 48);
    for (var sd = -1; sd <= 1; sd += 2) {
      var sx = 24 + sd * 5, sy = Y(27);
      if (fly) {
        var lift = [-13, -5, 5, -4][f], spread = [17, 21, 17, 20][f];
        var wr = [24 + sd * 13, sy + lift * 0.7], t1 = [24 + sd * spread, sy + lift - 2], t2 = [24 + sd * (spread + 1), sy + lift + 5], t3 = [24 + sd * (spread - 4), sy + lift + 9];
        for (var q = 0; q < 3; q++) { t1[0] = Math.max(1, Math.min(46, t1[0])); t2[0] = Math.max(1, Math.min(46, t2[0])); t1[1] = Math.max(1, t1[1]); }
        poly(wg, [sx, sy, wr[0], wr[1], t1[0], t1[1], t2[0], t2[1], t3[0], t3[1], sx + sd * 3, sy + 4], function (x, y) { return y < wr[1] + 2 ? P.W[2] : P.W[1]; });
        line(wg, sx, sy, wr[0], wr[1], S[3]); line(wg, wr[0], wr[1], t1[0], t1[1], S[2]); line(wg, wr[0], wr[1], t2[0], t2[1], S[2]); line(wg, wr[0], wr[1], t3[0], t3[1], S[2]);
      } else {
        poly(wg, [sx, sy, 24 + sd * 9, Y(22), 24 + sd * 11, Y(30), 24 + sd * 8, Y(33)], function (x, y) { return y < Y(26) ? P.W[2] : P.W[1]; });
        line(wg, sx, sy, 24 + sd * 9, Y(22), S[3]); line(wg, 24 + sd * 9, Y(22), 24 + sd * 11, Y(30), S[2]);
      }
    }
    over(back, wg, S[0]);
    var bd = mk(48, 48), fr = mk(48, 48);
    if (facing === 'down') {
      // body behind, tail tip peeking out
      shadeEll(bd, 24, Y(30.6), 8, 5.6, S, 4);
      spr(bd, ['.lll.', 'lLLLl', 'bBBBb', 'gBBBg'], { l: TACK.L[2], L: TACK.L[3], b: TACK.blanket[0], B: TACK.blanket[1], g: TACK.gold[1] }, 21.5, Y(24.6));
      line(bd, 31, Y(33), 35, Y(35), S[2]); px(bd, 36, Y(35.6), P.spine[0]);
      if (!fly) { limb(bd, [18.5, Y(33)], [18, Y(39)], [18, 44.6], 3, S[2], S[1]); limb(bd, [28.5, Y(33)], [29, Y(39)], [28.5, 44.6], 3, S[2], S[1]); }
      over(back, bd, S[0]);
      // front layer: chest, front legs, neck and the friendly face
      shadeEll(fr, 24, Y(34.6), 5.4, 4.6, S, 4);
      for (var y = Math.round(Y(32)); y <= Math.round(Y(38)); y++) for (var x = 21; x <= 27; x++) if (A(fr, x, y)) px(fr, x, y, (y % 2) ? P.belly[0] : P.belly[1]);
      if (!fly) { limb(fr, [20.5, Y(37)], [20.5, Y(41)], [20.5, 45], 3, S[3], S[2]); limb(fr, [26.5, Y(37)], [26.5, Y(41)], [26.5, 45], 3, S[3], S[2]); spr(fr, ['c.c', '...'], { c: P.horn[1] }, 20, 45); spr(fr, ['c.c'], { c: P.horn[1] }, 26, 45); }
      else { limb(fr, [21, Y(37)], [20, Y(40)], [21, Y(42)], 2, S[3], S[2]); limb(fr, [27, Y(37)], [28, Y(40)], [27, Y(42)], 2, S[3], S[2]); }
      shadeEll(fr, 24, Y(31.4), 3, 3, S, 4); // neck
      var hy = Y(29.8) - (fly ? 1 : 0);
      shadeEll(fr, 24, hy, 4.4, 3.4, S, 4);
      shadeEll(fr, 24, hy + 2.6, 3, 1.8, [P.belly[0], P.belly[0], P.belly[1], P.belly[1]], 2);
      px(fr, 23, hy + 2.2, S[0]); px(fr, 25, hy + 2.2, S[0]);
      spr(fr, ['eE.....eE', 'kE.....kE'], { e: P.eye, E: '#ffe8b0', k: '#140c1c' }, 20, Math.round(hy - 1.6)); px(fr, 20, hy - 1.8, '#ffffff'); px(fr, 27, hy - 1.8, '#ffffff');
      line(fr, 21, hy - 3, 18, hy - 6.4, P.horn[1]); line(fr, 27, hy - 3, 30, hy - 6.4, P.horn[1]); px(fr, 18, hy - 7, P.horn[0]); px(fr, 30, hy - 7, P.horn[0]);
      px(fr, 24, hy - 3.6, P.spine[1]); px(fr, 23, hy - 3.2, P.spine[0]); px(fr, 25, hy - 3.2, P.spine[0]);
      over(front, fr, S[0]);
    } else {
      // facing away: neck and the back of the head up front, back + saddle, tail curling toward us
      var hy2 = Y(17.6) - (fly ? 1 : 0);
      shadeEll(bd, 24, Y(23), 3, 5, S, 4); // neck
      shadeEll(bd, 24, hy2, 3.8, 3.4, S, 4);
      line(bd, 21.6, hy2 - 1.6, 19.2, hy2 - 4, P.horn[1]); line(bd, 26.4, hy2 - 1.6, 28.8, hy2 - 4, P.horn[1]); px(bd, 19.2, hy2 - 4.4, P.horn[0]); px(bd, 28.8, hy2 - 4.4, P.horn[0]);
      spr(bd, ['s', 'ss', 's'], { s: P.spine[0] }, 19, Math.round(hy2)); spr(bd, ['.s', 'ss', '.s'], { s: P.spine[0] }, 28, Math.round(hy2));
      for (k = 0; k < 4; k++) { px(bd, 24, hy2 - 2 + k * 2.4, P.spine[1]); px(bd, 24, hy2 - 1 + k * 2.4, P.spine[0]); }
      shadeEll(bd, 24, Y(31), 8, 5.6, S, 4);
      spr(bd, ['gBBBg', 'bBBBb', 'lLLLl', '.lll.'], { l: TACK.L[2], L: TACK.L[3], b: TACK.blanket[0], B: TACK.blanket[1], g: TACK.gold[1] }, 21.5, Y(24.6));
      if (!fly) { limb(bd, [18.5, Y(33)], [18.5, Y(38)], [18.5, 43.6], 3, S[2], S[1]); limb(bd, [28.5, Y(33)], [28.5, Y(38)], [28.5, 43.6], 3, S[2], S[1]); }
      over(back, bd, S[0]);
      // front layer: haunches, hind legs and the tail curling toward the camera
      shadeEll(fr, 20.4, Y(35.6), 4.4, 4.6, S, 4); shadeEll(fr, 27.6, Y(35.6), 4.4, 4.6, S, 4);
      if (!fly) { limb(fr, [19.5, Y(38)], [19.5, Y(42)], [19.5, 45], 3, S[3], S[2]); limb(fr, [27.5, Y(38)], [27.5, Y(42)], [27.5, 45], 3, S[3], S[2]); }
      else { limb(fr, [19.5, Y(38)], [18.5, Y(41)], [19, Y(43)], 2, S[3], S[2]); limb(fr, [28.5, Y(38)], [29.5, Y(41)], [29, Y(43)], 2, S[3], S[2]); }
      var sw = fly ? [0, 1, 2, 1][f] : f;
      var tpts = [[24, Y(36)], [24 + sw, Y(40.4)], [26 + sw, fly ? Y(44) : 44], [29 + sw, fly ? Y(45) : 44.4]];
      for (k = 0; k < 3; k++) { line(fr, tpts[k][0], tpts[k][1], tpts[k + 1][0], tpts[k + 1][1], S[3]); line(fr, tpts[k][0] + 1, tpts[k][1], tpts[k + 1][0] + 1, tpts[k + 1][1], S[2]); }
      spr(fr, ['.s.', 'sSs'], { s: P.spine[0], S: P.spine[1] }, Math.round(tpts[3][0]), Math.round(tpts[3][1]) - 1);
      over(front, fr, S[0]);
    }
  }
  function drawDragonMount(P, anim, dir, f) {
    var fly = anim === 'fly', back = mk(48, 48), front = mk(48, 48);
    if (dir === 'down' || dir === 'up') dragonFront(P, fly, f, back, front, dir);
    else dragonSide(P, fly, f, back, front);
    outline(back, OL); outline(front, OL);
    return { back: back, front: front };
  }
  ['dragon_amethyst', 'dragon_emerald', 'dragon_ember'].forEach(function (id) {
    defMount(id, { w: 48, h: 48, ax: 24, ay: 46, seat: { x: 24, y: 25 }, anims: { idle: 2, fly: 4 }, fps: { idle: 2, fly: 8 },
      seatDy: { idle: [0, 0], fly: [-9, -10, -11, -10] }, base: 'idle', draw: function (anim, dir, f) { return drawDragonMount(DRAGON[id], anim, dir, f); } });
  });

  // ======================================================================= PETS (collectible companions) — small, soft, adorable
  var PETS = Object.create(null), PET_IDS = [];
  function defPet(id, def) { PETS[id] = def; PET_IDS.push(id); }
  // hand-pixelled pet: base rows + pixel patches [x, y, char|null]; `bob` lifts everything above the paw row,
  // `legs` (a row drawn just above the paws) and `paws` (the ground row) animate the walk
  function petDraw(w, h, rows, pal, ol, o) {
    var b = mk(w, h), lay = mk(w, h), k, pr = o.pawRow, bob = o.bob || 0, top = h - rows.length; // spare rows above the art
    spr(lay, pr == null ? rows : rows.slice(0, pr), pal, 0, bob + top + (o.dy || 0));
    if (o.patch) for (k = 0; k < o.patch.length; k++) { var q = o.patch[k], qy = q[1] + bob + top + (o.dy || 0); if (q[2] === null) clr(lay, q[0], qy); else px(lay, q[0], qy, pal[q[2]]); }
    if (o.legs) spr(lay, [o.legs], pal, 0, pr - 1 + top);
    if (o.paws) spr(lay, [o.paws], pal, 0, pr + top);
    outline(lay, ol);
    if (o.shadow) shadowE(lay, o.shadow[0], o.shadow[1] + top, o.shadow[2], 0.7, 0.3);
    blit(b, lay, 0, 0);
    return b;
  }
  // ---- moon kitten (14x12): lavender-grey, pink ears, a gold crescent on the forehead
  var KIT = { pal: { 1: '#4e4868', 2: '#7e78a0', 3: '#aea8cc', 4: '#dcd8ee', p: '#e89ab8', n: '#e07a9e', e: '#2a2440', w: '#ffffff', y: '#ffe08a', Y: '#c8a040', b: '#f4f2fb' }, ol: '#2a2240',
    up: ['..............', '......2....2..', '.....2p3..3p2.', '.....34yY4332.', '.2...4443Y332.', '.3...3433w3w2.', '.3...3333e3e2.', '.244323333bnb.', '..433322bbb2..', '..3322222322..', '..1.1...1.1...', '..............'],
    sleep: ['..............', '..............', '..............', '..............', '........2..2..', '...44432p33p2.', '..4443334y332.', '.4433333e3e32.', '.333333333bnb.', '.23333332222..', '...34444332...', '..............'] };
  var PET_WALK = { bob: [0, -1, 0, -1] };
  function drawKitten(anim, i) {
    var K = KIT;
    if (anim === 'sleep') return petDraw(14, 13, K.sleep, K.pal, K.ol, { patch: i ? [[4, 4, '4'], [5, 4, '4'], [6, 4, '3']] : null });
    var tail = (anim === 'idle' ? i : i % 2) ? [[1, 4, null], [2, 3, '2'], [2, 4, '3']] : [];
    if (anim === 'idle') return petDraw(14, 13, K.up, K.pal, K.ol, { pawRow: 10, paws: K.up[10], patch: tail.concat(i ? [[9, 5, '3'], [11, 5, '3']] : []) });
    return petDraw(14, 13, K.up, K.pal, K.ol, { pawRow: 10, bob: PET_WALK.bob[i], patch: tail,
      legs: i % 2 ? ['...2.2...2.2..', '..2.2...2.2...'][i >> 1] : null, paws: ['..1..1..1..1..', '...1.1...1.1..', '...11....11...', '..1.1...1.1...'][i] });
  }
  defPet('pet_kitten', { w: 14, h: 13, ax: 7, ay: 12, anims: { idle: 2, walk: 4, sleep: 2 }, fps: { idle: 2, walk: 8, sleep: 1.5 }, base: 'idle', draw: drawKitten });
  // ---- shadow pup (16x12): inky fur, floppy ears, glowing violet eyes, always panting
  var PUP = { pal: { 1: '#141226', 2: '#221e3a', 3: '#363258', 4: '#4c4878', 5: '#6a66a0', m: '#8a86b8', e: '#f0e4ff', E: '#b99aee', t: '#e89ab8', n: '#0a0812' }, ol: '#0b0a14',
    up: ['................', '........44444...', '.......4555544..', '......245555443.', '.4....2245e4e43.', '.54...2244E4E43.', '..433422344mmmn.', '.4555442233mtm..', '.34444432222....', '.23333333332....', '..1.1....1.1....', '................'],
    sleep: ['................', '................', '................', '................', '................', '..........4444..', '...44444.455554.', '.54555544225544.', '.45555444224144.', '.34444443324mmn.', '..233333333233..', '................'] };
  function drawPuppy(anim, i) {
    var D = PUP;
    if (anim === 'sleep') return petDraw(16, 13, D.sleep, D.pal, D.ol, { patch: i ? [[4, 5, '4'], [5, 5, '4'], [6, 5, '4']] : null });
    var wag = (anim === 'idle' ? i : i % 2) ? [[1, 4, null], [1, 5, null], [2, 4, '5'], [3, 3, '4']] : [];
    if (anim === 'idle') return petDraw(16, 13, D.up, D.pal, D.ol, { pawRow: 10, paws: D.up[10], patch: wag.concat(i ? [[10, 4, '4'], [12, 4, '4']] : []) });
    return petDraw(16, 13, D.up, D.pal, D.ol, { pawRow: 10, bob: PET_WALK.bob[i], patch: wag,
      legs: i % 2 ? ['...3.3....3.3...', '..3.3....3.3....'][i >> 1] : null, paws: ['.1...1...1...1..', '...1.1....1.1...', '...11......11...', '..1.1....1.1....'][i] });
  }
  defPet('pet_puppy', { w: 16, h: 13, ax: 8, ay: 12, anims: { idle: 2, walk: 4, sleep: 2 }, fps: { idle: 3, walk: 9, sleep: 1.5 }, base: 'idle', draw: drawPuppy });
  // ---- lop bunny (12x12): cream with chocolate lop ears and a cotton tail; walks by hopping
  var LOP = { pal: { 1: '#8a7868', 2: '#b4a494', 3: '#dcd2c4', 4: '#f6f0e6', B: '#a0724c', b: '#7a5236', e: '#2e2622', w: '#ffffff', n: '#e89ab8', t: '#ffffff' }, ol: '#3a2e28',
    up: ['............', '............', '......BB44..', '.....BB4443.', '.....Bb4w43.', '...34Bb4e33.', '..3443b333n.', '.t34433b332.', '.t333333332.', '..23333322..', '..1222..12..', '............'] };
  function drawLop(anim, i) {
    var D = LOP;
    if (anim === 'sleep') return petDraw(12, 13, D.up, D.pal, D.ol, { pawRow: 10, dy: 1, patch: [[8, 4, '4'], [8, 5, 'b']].concat(i ? [[3, 4, '3'], [4, 4, '3']] : []) });
    if (anim === 'idle') return petDraw(12, 13, D.up, D.pal, D.ol, { pawRow: 10, paws: D.up[10], patch: i ? [[10, 6, null], [10, 5, 'n'], [8, 4, '4']] : null });
    var hop = [0, -1, -2, -1][i];
    return petDraw(12, 13, D.up, D.pal, D.ol, { pawRow: 10, bob: hop, shadow: hop < -1 ? [6, 10.6, 3] : null,
      legs: ['', '..22....2...', '', '...2.....2..'][i] || null, paws: ['..1222..12..', '.1222....1..', '', '..122...12..'][i] || null });
  }
  defPet('pet_bunny', { w: 12, h: 13, ax: 6, ay: 12, anims: { idle: 2, walk: 4, sleep: 2 }, fps: { idle: 2, walk: 8, sleep: 1.5 }, base: 'idle', draw: drawLop });
  // ---- baby dragon hatchling (16x14), wearing a bit of its eggshell
  var HAT = { S: ['#36245e', '#56408e', '#7a62b8', '#a48ae0'], belly: ['#c8b0ec', '#c8b0ec', '#e8dcff', '#e8dcff'], W: ['#4a3480', '#8a6cc8'], horn: '#f2e8c8', eye: ['#ffbc62', '#140c1c'], shell: ['#d8d0c0', '#fffaf0'], ol: '#1e1438' };
  function drawHatchling(anim, i) {
    var b = mk(16, 14), lay = mk(16, 14), S = HAT.S;
    var flut = anim === 'flutter', walk = anim === 'walk', sleep = anim === 'sleep';
    var lift = flut ? [2, 3, 2, 1][i] : 0, st = walk ? [1, 0, -1, 0][i] : 0, bob = walk && i % 2 ? -0.5 : 0, by = 9 - lift + bob;
    if (sleep) {
      var br = i ? 0.3 : 0;
      soft(lay, 7.4, 9.4 - br * 0.5, 4.4, 2.8 + br, S);
      soft(lay, 7.8, 10.4, 3, 1.4, HAT.belly);
      line(lay, 3, 10.6, 2, 8.4, S[2]); px(lay, 2, 7.8, HAT.horn); // tail tip curled
      soft(lay, 11.4, 9, 2.6, 2.2, S);
      px(lay, 11.8, 8.6, HAT.eye[1]); px(lay, 12.6, 8.8, HAT.eye[1]);
      spr(lay, ['.ss.', 'sSSs'], { s: HAT.shell[0], S: HAT.shell[1] }, 9.6, 5.8); // eggshell cap
      outline(lay, HAT.ol); blit(b, lay, 0, 0); return shift2(b);
    }
    // stubby wings (flap when fluttering)
    var wy = flut ? [-3, 0, 2, 0][i] : (anim === 'idle' && i ? -1 : 0);
    poly(lay, [6.4, by - 2, 4 - (flut ? 1 : 0), by - 5 + wy, 2.6, by - 1.6 + wy * 0.6, 5, by - 0.4], HAT.W[1]);
    line(lay, 6.4, by - 2, 4 - (flut ? 1 : 0), by - 5 + wy, S[1]);
    line(lay, 3.2, by + 1.6, 1.4, by - 0.6, S[2]); px(lay, 1.2, by - 1.2, HAT.horn); // little tail
    if (!flut) { line(lay, 5, by + 2, 5 - st * 0.6, 12, S[0]); line(lay, 9, by + 2, 9 + st * 0.6, 12, S[1]); }
    else { px(lay, 5, by + 3, S[1]); px(lay, 9, by + 3, S[1]); }
    soft(lay, 7, by, 3.4, 2.8, S);
    soft(lay, 7.6, by + 1.2, 2.2, 1.6, HAT.belly);
    var hd = mk(16, 14), hx = 11, hy = by - 3.2;
    soft(hd, hx, hy, 3.2, 2.8, S);
    soft(hd, hx + 2.4, hy + 1.2, 1.6, 1.1, HAT.belly);
    spr(hd, ['eW', 'ek'], { e: HAT.eye[0], W: '#ffffff', k: HAT.eye[1] }, Math.round(hx), Math.round(hy - 1.2));
    px(hd, hx + 3.6, hy + 0.6, S[0]); // nostril
    px(hd, hx - 1.6, hy - 2.6, HAT.horn); px(hd, hx - 0.2, hy - 3, HAT.horn);
    spr(hd, ['.ss.', 'sSSs'], { s: HAT.shell[0], S: HAT.shell[1] }, Math.round(hx - 2), Math.round(hy - 4)); // eggshell cap
    over(lay, hd, S[0]);
    outline(lay, HAT.ol);
    if (flut) shadowE(lay, 7.6, 13.4, 3, 0.6, 0.35);
    blit(b, lay, 0, 0); return shift2(b);
  }
  function shift2(b) { var o = mk(16, 16); blit(o, b, 0, 2); return o; } // two spare rows on top for fluttering
  defPet('pet_hatchling', { w: 16, h: 16, ax: 8, ay: 15, anims: { idle: 2, walk: 4, sleep: 2, flutter: 4 }, fps: { idle: 2, walk: 7, sleep: 1.5, flutter: 10 }, base: 'idle', draw: drawHatchling });
  // ---- crystal fox (18x14): pale fox with an amethyst-crystal tail (bright crystal cores; engine adds the halo)
  var CFOX = { pal: { 1: '#7a74a0', 2: '#aaa4cc', 3: '#d4d0ec', 4: '#f4f2fc', k: '#3a3458', e: '#2a2448', w: '#ffffff', n: '#2a2448', c: '#4a2f7a', C: '#8f6cd1', L: '#c8a8ff', W: '#ffffff' }, ol: '#2a2448',
    up: ['..................', '.........k....k...', '..W.....2k3..3k2..', '.LCL....23333332..', '..LCc...33333332..', '.WCcC...3433w3w3..', '..LccC..3333e3e34.', '...cc22223444444n.', '...233333444442...', '...2333333333.....', '....2444444443....', '....2222222222....', '....k.k...k.k.....', '..................'],
    sleep: ['..................', '..................', '..................', '..................', '..................', '..................', '..........k..k....', '.....44432k33k2...', '....44433344332...', '...4433333e3e32...', '...3333333334n4...', '...23333332222....', '....LCWCCcc2......', '..................'] };
  function drawCrystalFox(anim, i) {
    var D = CFOX;
    if (anim === 'sleep') return petDraw(18, 15, D.sleep, D.pal, D.ol, { patch: i ? [[6, 6, '4'], [7, 6, '4'], [8, 6, '3'], [6, 12, 'W'], [8, 12, 'C']] : null });
    var sway = (anim === 'idle' ? i : i % 2) ? [[2, 2, null], [3, 2, 'W'], [1, 5, null], [1, 4, 'W']] : [];
    if (anim === 'idle') return petDraw(18, 15, D.up, D.pal, D.ol, { pawRow: 12, paws: D.up[12], patch: sway.concat(i ? [[12, 5, '3'], [14, 5, '3']] : []) });
    return petDraw(18, 15, D.up, D.pal, D.ol, { pawRow: 12, bob: PET_WALK.bob[i], patch: sway,
      legs: i % 2 ? ['.....k.k..k.k.....', '....k.k...k.k.....'][i >> 1] : null, paws: ['...k..k..k...k....', '.....k.k..k.k.....', '.....kk....kk.....', '....k.k...k.k.....'][i] });
  }
  defPet('pet_crystalfox', { w: 18, h: 15, ax: 9, ay: 14, anims: { idle: 2, walk: 4, sleep: 2 }, fps: { idle: 2, walk: 9, sleep: 1.5 }, base: 'idle', draw: drawCrystalFox });
  // ======================================================================= EFFECTS
  // glowing orb projectile travelling RIGHT (trail on the left). pal: [outline, edge, mid, light, core]
  function orbBolt(pal, i, flame) {
    var b = mk(8, 8), cx = 5, cy = 4, r = [2.2, 2.6, 2.3][i];
    var lay = mk(8, 8);
    if (flame) { // teardrop flame: tail licks back-left and flickers
      var tails = [[[2, 3], [1, 4], [2, 5], [0, 4]], [[2, 4], [1, 3], [0, 3], [2, 2]], [[2, 4], [1, 5], [0, 5], [2, 5]]][i];
      for (var t = 0; t < tails.length; t++) px(lay, tails[t][0], tails[t][1], t < 2 ? pal[2] : pal[1]);
    }
    ell(lay, cx, cy, r, r, pal[1]);
    ell(lay, cx + 0.2, cy - 0.2, r - 0.7, r - 0.7, pal[2]);
    ell(lay, cx + 0.3, cy - 0.3, Math.max(0.8, r - 1.4), Math.max(0.8, r - 1.4), pal[3]);
    px(lay, cx - 1 + (i === 1 ? 0 : 0), cy - 1, pal[4]); px(lay, cx, cy - 1, pal[4]);
    outline(lay, pal[0]);
    if (!flame) { // sparkling trail
      var tr = [[[2, 4, 3], [1, 4, 2], [0, 4, 1], [1, 3, 1]], [[2, 4, 3], [1, 4, 2], [0, 4, 1], [0, 3, 1], [1, 5, 1]], [[2, 4, 3], [1, 4, 2], [0, 5, 1], [2, 2, 2]]][i];
      for (var k = 0; k < tr.length; k++) px(b, tr[k][0], tr[k][1], pal[tr[k][2]], 0.45 + tr[k][2] * 0.17);
    }
    blit(b, lay, 0, 0);
    return b;
  }
  var BOLT_PAL = {
    bolt_player: ['#0e3a2a', '#2fbf7f', '#5dffb0', '#b4ffd9', '#ffffff'],
    bolt_enemy: ['#2a174e', '#6a47a8', '#b99aee', '#e4d2ff', '#ffffff'],
    bolt_fire: ['#4e1420', '#c44a3a', '#e8843c', '#ffbc62', '#fff1c8']
  };
  function webShot(i) {
    var b = mk(8, 8), lay = mk(8, 8), cx = 3.5, cy = 3.5, off = i ? Math.PI / 8 : 0;
    for (var k = 0; k < 8; k++) { // radiating silk strands
      var a = off + k * Math.PI / 4, len = k % 2 ? 2.8 : 3.6;
      line(lay, cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, '#d6dcf0');
      px(lay, Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len), '#9ea6c8');
    }
    for (var q = 0; q < 8; q += 2) { // cross threads
      var a1 = off + q * Math.PI / 4, a2 = a1 + Math.PI / 4;
      line(lay, cx + Math.cos(a1) * 2.2, cy + Math.sin(a1) * 2.2, cx + Math.cos(a2) * 2.2, cy + Math.sin(a2) * 2.2, '#eef2ff');
    }
    rect(lay, 3, 3, 2, 2, '#ffffff');
    outline(lay, '#3a3450');
    blit(b, lay, 0, 0, false, 0.95);
    return b;
  }
  var SPORE_FX = ['#4f8a3a', '#78b048', '#a8d65a', '#d2ee86', '#f6ffc4'];
  function sporeCloud(i) {
    var b = mk(16, 16);
    var sets = [
      [[8, 9, 3], [5.5, 10.5, 2.2], [10.5, 10.4, 2.3]],
      [[8, 7.8, 3.6], [4.6, 9.6, 2.8], [11.4, 9.4, 2.9], [8, 11.4, 2.6]],
      [[7.6, 6.6, 3.6], [3.8, 8.8, 3], [12.2, 8.6, 3], [6, 11.6, 2.8], [10.4, 11.8, 2.8]],
      [[7.4, 5.4, 3], [3.2, 7.8, 2.4], [12.8, 7.6, 2.4], [5.6, 11, 2.2], [10.8, 11.2, 2.2]]
    ];
    cloud(b, sets[i], SPORE_FX, [0.85, 0.78, 0.62, 0.4][i], false);
    var specks = [[[8, 4], [3, 8], [13, 9]], [[7, 3], [2, 7], [14, 8], [10, 13]], [[6, 1], [1, 6], [15, 7], [9, 14], [12, 3]], [[5, 0], [0, 5], [15, 4], [8, 14]]][i];
    for (var k = 0; k < specks.length; k++) px(b, specks[k][0], specks[k][1], k % 2 ? SPORE_FX[4] : '#ffffff', [0.9, 0.85, 0.7, 0.45][i]);
    return b;
  }
  // radial star burst; rays [angle, inner, outer]
  function starBurst(b, cx, cy, rays, cols, core, al) {
    for (var k = 0; k < rays.length; k++) {
      var a = rays[k][0], r0 = rays[k][1], r1 = rays[k][2];
      for (var r = r0; r <= r1; r += 0.5) px(b, Math.floor(cx + Math.cos(a) * r), Math.floor(cy + Math.sin(a) * r), r > r1 - 1.2 ? cols[1] : cols[0], al);
    }
    if (core) { px(b, Math.floor(cx), Math.floor(cy), core); }
  }
  function hitSpark(i) {
    var b = mk(12, 12), cx = 6, cy = 6, W = '#ffffff', Gd = '#f2c45a', Am = '#ffbc62';
    var D = Math.PI / 4;
    if (i === 0) { spr(b, ['..W..', '.WWW.', 'WWWWW', '.WWW.', '..W..'], { W: W }, 4, 4); px(b, 6, 3, Gd); px(b, 6, 9, Gd); px(b, 3, 6, Gd); px(b, 9, 6, Gd); }
    else if (i === 1) {
      starBurst(b, cx, cy, [[0, 0, 5], [D * 2, 0, 5], [D * 4, 0, 5], [D * 6, 0, 5], [D, 0, 3.5], [D * 3, 0, 3.5], [D * 5, 0, 3.5], [D * 7, 0, 3.5]], [W, Gd]);
      ell(b, 6, 6, 1.5, 1.5, W);
    } else if (i === 2) {
      starBurst(b, cx, cy, [[0, 3, 5.5], [D * 2, 3, 5.5], [D * 4, 3, 5.5], [D * 6, 3, 5.5], [D, 2.5, 4.2], [D * 3, 2.5, 4.2], [D * 5, 2.5, 4.2], [D * 7, 2.5, 4.2]], [Gd, Am]);
      px(b, 6, 6, W, 0.8);
    } else {
      var pts = [[11, 6], [6, 0], [0, 6], [6, 11], [10, 2], [1, 1], [2, 10], [10, 10]];
      for (var k = 0; k < pts.length; k++) px(b, pts[k][0], pts[k][1], k < 4 ? Gd : Am, 0.8);
    }
    return b;
  }
  function critSpark(i) {
    var b = mk(16, 16), cx = 8, cy = 8, W = '#ffffff', Gd = '#f2c45a', Or = '#e8843c', Rd = '#c44a3a', Cd = '#fff1c8';
    var D = Math.PI / 4;
    if (i === 0) {
      ell(b, 8, 8, 4, 4, Cd); ell(b, 8, 8, 2.8, 2.8, W);
      starBurst(b, cx, cy, [[0, 4, 6.5], [D * 2, 4, 6.5], [D * 4, 4, 6.5], [D * 6, 4, 6.5]], [W, Gd]);
    } else if (i === 1) {
      starBurst(b, cx, cy, [[0, 0, 7.5], [D * 2, 0, 7.5], [D * 4, 0, 7.5], [D * 6, 0, 7.5], [D, 0, 5.5], [D * 3, 0, 5.5], [D * 5, 0, 5.5], [D * 7, 0, 5.5]], [W, Gd]);
      ringE(b, 8, 8, 5, 5, Or, 0.9); ell(b, 8, 8, 2, 2, W);
    } else if (i === 2) {
      starBurst(b, cx, cy, [[0, 4.5, 7.5], [D * 2, 4.5, 7.5], [D * 4, 4.5, 7.5], [D * 6, 4.5, 7.5], [D, 4, 6.5], [D * 3, 4, 6.5], [D * 5, 4, 6.5], [D * 7, 4, 6.5]], [Gd, Or]);
      ringE(b, 8, 8, 6.5, 6.5, Rd, 0.75); px(b, 8, 8, W);
    } else {
      var pts = [[15, 8], [8, 0], [0, 8], [8, 15], [13, 3], [2, 2], [3, 13], [13, 13], [11, 1], [1, 11]];
      for (var k = 0; k < pts.length; k++) px(b, pts[k][0], pts[k][1], k < 4 ? Gd : k < 8 ? Or : Rd, 0.85);
    }
    return b;
  }
  function plusSpark(b, x, y, big, al, cols) {
    px(b, x, y, cols[2], al);
    px(b, x - 1, y, cols[1], al); px(b, x + 1, y, cols[1], al); px(b, x, y - 1, cols[1], al); px(b, x, y + 1, cols[1], al);
    if (big) { px(b, x - 2, y, cols[0], al); px(b, x + 2, y, cols[0], al); px(b, x, y - 2, cols[0], al); px(b, x, y + 2, cols[0], al); }
  }
  function healSparkle(i) {
    var b = mk(12, 12), C = ['#2fbf7f', '#5dffb0', '#e8fff4'];
    var S = [[[3, 9, 1], [8, 8, 0], [6, 10, 0]], [[3, 7, 1], [8, 6, 1], [5, 9, 0], [10, 10, 0]], [[3, 4, 0], [8, 3, 1], [5, 6, 1], [10, 8, 0]], [[3, 1, 0], [8, 1, 0], [5, 3, 0], [10, 5, 0]]][i];
    for (var k = 0; k < S.length; k++) plusSpark(b, S[k][0], S[k][1], S[k][2], i === 3 ? 0.55 : 1, C);
    return b;
  }
  function levelSparkle(i) {
    var b = mk(8, 8), W = '#ffffff', Gd = '#f2c45a', Cd = '#fff1c8';
    if (i === 0) { px(b, 4, 4, W); px(b, 3, 4, Gd); px(b, 5, 4, Gd); px(b, 4, 3, Gd); px(b, 4, 5, Gd); }
    else if (i === 1) { line(b, 4, 1, 4, 7, Gd); line(b, 1, 4, 7, 4, Gd); px(b, 4, 4, W); px(b, 4, 3, Cd); px(b, 4, 5, Cd); px(b, 3, 4, Cd); px(b, 5, 4, Cd); }
    else if (i === 2) { line(b, 4, 0, 4, 7, Cd); line(b, 0, 4, 7, 4, Cd); px(b, 4, 4, W); px(b, 3, 3, Gd); px(b, 5, 5, Gd); px(b, 5, 3, Gd); px(b, 3, 5, Gd); px(b, 4, 0, Gd); px(b, 4, 7, Gd); px(b, 0, 4, Gd); px(b, 7, 4, Gd); }
    else { px(b, 4, 4, Cd); px(b, 4, 2, Gd, 0.7); px(b, 4, 6, Gd, 0.7); px(b, 2, 4, Gd, 0.7); px(b, 6, 4, Gd, 0.7); px(b, 1, 1, W, 0.6); px(b, 7, 6, W, 0.5); }
    return b;
  }
  function spawnRune(i) {
    var b = mk(24, 12), C = ['#3a2766', '#6a47a8', '#8f6cd1', '#b99aee', '#e4d2ff'];
    var al = [0.45, 0.7, 0.9, 1][i];
    var cx = 12, cy = 6, rx = 11.2, ry = 5.2;
    // outer ellipse ring, drawn progressively in frame 0
    for (var y = 0; y < 12; y++) for (var x = 0; x < 24; x++) {
      if (!inE(x, y, cx, cy, rx, ry) || (inE(x - 1, y, cx, cy, rx, ry) && inE(x + 1, y, cx, cy, rx, ry) && inE(x, y - 1, cx, cy, rx, ry) && inE(x, y + 1, cx, cy, rx, ry))) continue;
      var ang = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx);
      if (i === 0 && (ang < -2 || ang > 1.2)) continue;
      px(b, x, y, i >= 2 ? C[3] : C[2], al);
    }
    if (i >= 1) ringE(b, cx, cy, 7.4, 3.3, C[i >= 2 ? 2 : 1], al);
    if (i >= 2) { // rune ticks between the rings
      var ticks = [[3, 4], [5, 2], [9, 1], [14, 1], [18, 2], [20, 4], [20, 7], [18, 9], [14, 10], [9, 10], [5, 9], [3, 7]];
      for (var k = 0; k < ticks.length; k++) { px(b, ticks[k][0], ticks[k][1], k % 2 ? C[4] : C[3], al); }
    }
    if (i >= 3) { // central sigil: crescent + star
      px(b, 11, 5, C[4]); px(b, 12, 5, '#ffffff'); px(b, 13, 5, C[4]); px(b, 12, 4, C[3]); px(b, 12, 6, C[3]);
      px(b, 10, 6, C[3]); px(b, 14, 6, C[3]); px(b, 9, 5, C[2]); px(b, 15, 5, C[2]);
    }
    return b;
  }
  function slashArc(i) {
    var b = mk(24, 24), cx = 12, cy = 12;
    // crescent sweeping top -> bottom in front of a right-facing swing
    var a0 = [-1.35, -1.25, -0.2][i], a1 = [-0.1, 1.25, 1.3][i], R = 9.6, th = [2, 3, 1.6][i];
    for (var y = 0; y < 24; y++) for (var x = 0; x < 24; x++) {
      var dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      if (ang < a0 || ang > a1) continue;
      var u = (ang - a0) / (a1 - a0);
      var w = th * Math.sin(Math.PI * Math.min(1, Math.max(0, i === 2 ? 0.5 + u * 0.5 : u))) + 0.4; // thick in the middle, thin at the ends
      var inner = R - w;
      if (d > R + 0.5 || d < inner) continue;
      var edge = d > R - 0.8;
      var col = edge ? '#ffffff' : d > R - 1.8 ? '#e8eeff' : '#fff1c8';
      px(b, x, y, col, i === 2 ? 0.55 : edge ? 1 : 0.85);
    }
    return b;
  }
  function shadowFx() {
    var b = mk(12, 5);
    for (var y = 0; y < 5; y++) for (var x = 0; x < 12; x++) {
      if (!inE(x, y, 6, 2.5, 6, 2.5)) continue;
      var inner = inE(x, y, 6, 2.5, 4.2, 1.6);
      px(b, x, y, OL, inner ? 0.42 : 0.24);
    }
    return b;
  }
  // ---- spell effects (spellbook + festival)
  var ICE = ['#17224c', '#2e4f9f', '#69a1db', '#c4e6ff', '#ffffff'];
  function frostBolt(i) {
    var b = mk(8, 8), lay = mk(8, 8);
    // an elongated ice shard pointing right
    spr(lay, ['...lw..', '..lWWw.', '.mlWWWW', '..mll..'].slice(0, 4), { m: ICE[2], l: ICE[3], W: ICE[4], w: ICE[3] }, 1, 2);
    outline(lay, ICE[1]);
    var tr = [[[0, 3], [1, 5]], [[0, 5], [1, 2]], [[0, 4], [1, 6]]][i];
    for (var k = 0; k < tr.length; k++) px(b, tr[k][0], tr[k][1], k ? ICE[3] : ICE[4], 0.8);
    blit(b, lay, 0, 0);
    if (i === 1) px(b, 7, 3, '#ffffff', 0.8);
    return b;
  }
  function frostHit(i) {
    var b = mk(12, 12), cx = 6, cy = 6, D = Math.PI / 3;
    if (i === 0) { spr(b, ['.w.', 'wWw', '.w.'], { w: ICE[3], W: ICE[4] }, 5, 5); ringE(b, 6.5, 6.5, 3, 3, ICE[2], 0.6); }
    else {
      var r0 = [0, 1.5, 3, 4.2][i], r1 = [0, 4, 5.2, 5.6][i];
      for (var k = 0; k < 6; k++) { // six ice shards flying out
        var a = k * D + 0.3, x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0, x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
        line(b, x0, y0, x1, y1, i === 3 ? ICE[2] : ICE[3], i === 3 ? 0.6 : 1); px(b, x1, y1, ICE[4], i === 3 ? 0.6 : 1);
      }
      if (i === 1) { px(b, 6, 6, ICE[4]); ringE(b, 6.5, 6.5, 2.4, 2.4, ICE[3], 0.7); }
      if (i === 2) ringE(b, 6.5, 6.5, 4.2, 4.2, ICE[2], 0.45);
    }
    return b;
  }
  function blinkFlash(i) {
    var b = mk(16, 16), V = ['#4a2f7a', '#8f6cd1', '#b99aee', '#e4d2ff', '#ffffff'];
    if (i === 0) { ell(b, 8, 8, 3.4, 3.4, V[3]); ell(b, 8, 8, 2.2, 2.2, V[4]); ringE(b, 8, 8, 4.6, 4.6, V[1], 0.8); }
    else if (i === 1) {
      ringE(b, 8, 8, 5.6, 5.6, V[2]); ringE(b, 8, 8, 4.6, 4.6, V[3], 0.6); ell(b, 8, 8, 1.6, 1.6, V[4]);
      line(b, 8, 0, 8, 2, V[3]); line(b, 8, 14, 8, 15, V[3]); line(b, 0, 8, 2, 8, V[3]); line(b, 14, 8, 15, 8, V[3]);
    } else if (i === 2) {
      ringE(b, 8, 8, 7, 7, V[1], 0.7); ringE(b, 8, 8, 6, 6, V[2], 0.4); px(b, 8, 8, V[4]);
      var sp = [[3, 3], [13, 4], [2, 12], [12, 13], [8, 1], [15, 9]];
      for (var k = 0; k < sp.length; k++) px(b, sp[k][0], sp[k][1], k % 2 ? V[3] : V[4]);
    } else {
      var sp2 = [[2, 2], [14, 3], [1, 13], [13, 14], [8, 0], [15, 8], [0, 7]];
      for (var q = 0; q < sp2.length; q++) px(b, sp2[q][0], sp2[q][1], q % 2 ? V[2] : V[3], 0.7);
    }
    return b;
  }
  function growSparkle(i) {
    var b = mk(16, 16), G = ['#2fbf7f', '#5dffb0', '#e8fff4'], Au = ['#c8a040', '#f2c45a', '#fff1c8'];
    // sparkles rise in staggered waves over the crop
    var S = [[3, 13, 0], [8, 14, 1], [12, 12, 0], [6, 10, 1], [10, 9, 0]];
    for (var k = 0; k < S.length; k++) {
      var t = i - k * 0.6, y = S[k][1] - t * 2.6;
      if (t < 0 || t > 3.2 || y < 1) continue;
      var big = t > 0.6 && t < 2.2, C = S[k][2] ? Au : G, al = t > 2.4 ? 0.6 : 1;
      plusSpark(b, S[k][0], y, big, al, C);
    }
    if (i < 3) { px(b, 5, 15 - i, G[1], 0.8); px(b, 11, 15 - i, Au[1], 0.8); } // leaves of light at the soil
    return b;
  }
  function lumenOrb(i) {
    var b = mk(10, 10), r = [2.6, 2.9, 2.7, 2.4][i];
    ell(b, 5, 5, r + 1, r + 1, '#ffbc62', 0.35);
    ell(b, 5, 5, r, r, '#ffe4a8');
    ell(b, 5, 5, r - 0.9, r - 0.9, '#fff6dc');
    px(b, 4, 4, '#ffffff'); px(b, 5, 4, '#ffffff'); px(b, 4, 5, '#ffffff');
    var orb = [[8, 2], [8, 7], [2, 8], [1, 3]][i];
    px(b, orb[0], orb[1], '#fff1c8', 0.9); // a tiny mote circling the orb
    return b;
  }
  function lanternRise(i) {
    var b = mk(8, 12), lay = mk(8, 12);
    // paper sky lantern: dark rim on top, warm glowing paper, open bottom with a flame
    var glow = i ? ['#c44a3a', '#e8843c', '#ffbc62', '#ffe2a8'] : ['#b84438', '#e07a38', '#f6b05a', '#ffd896'];
    spr(lay, ['.rrrr.', 'aabbca', 'abbccb', 'abccdb', 'abccdb', '.bccb.', '.abba.'], { r: '#7a3a2a', a: glow[0], b: glow[1], c: glow[2], d: glow[3] }, 1, 2);
    outline(lay, '#4a1e1a');
    blit(b, lay, 0, 0);
    px(b, 3, 10, '#ffe2a8'); px(b, 4, 10, i ? '#ffffff' : '#fff1c8'); // flame in the opening
    px(b, 4, 11 - i, '#ffbc62', 0.6); // ember drifting down
    return b;
  }
  // ---- boss / mount effects
  var DUST = ['#3a3226', '#6a5e4a', '#9a8c72', '#c8bca0', '#ece4cc'];
  // stomp: an expanding ground ring with a white wave front, kicked dust and pebbles
  function shockwaveRing(i) {
    var b = mk(32, 16), rx = [4, 7.5, 10.5, 13, 14.6][i], ry = rx * 0.42, al = [1, 0.95, 0.8, 0.6, 0.35][i], k;
    if (i < 3) ell(b, 16, 8, rx - 1, ry - 0.6, '#e8eeff', [0.3, 0.2, 0.12][i]);
    ringE(b, 16, 8, rx - 1.3, Math.max(0.8, ry - 1.1), DUST[3], al * 0.75);
    ringE(b, 16, 8, rx, ry, '#ffffff', al);
    for (k = 0; k < 6; k++) { // dust kicked up along the near half of the ring
      var a = (k + 0.5) / 6 * Math.PI, x = 16 + Math.cos(a) * rx, y = 8 + Math.sin(a) * ry;
      if (i > 0) { px(b, x, y - 1, DUST[4], al * 0.8); px(b, x + 1, y - 1, DUST[3], al * 0.6); }
    }
    if (i >= 1 && i <= 3) for (k = 0; k < 4; k++) {
      var a2 = k / 4 * Math.PI * 2 + 0.5, hop = [0, 2, 3, 1][i];
      var x2 = 16 + Math.cos(a2) * (rx + 0.5), y2 = 8 + Math.sin(a2) * ry - hop;
      px(b, x2, y2, '#7a6a58'); px(b, x2 + 1, y2, '#b8a488');
    }
    return b;
  }
  // a gloop slime bursting into droplets that land as little splats
  function slimeSplit(i) {
    var b = mk(24, 24), lay = mk(24, 24), G = GLOOP.G, k;
    var D = [[-1, -0.55], [1, -0.6], [-0.75, -1], [0.8, -1.05], [-1.15, -0.1], [1.2, -0.15]];
    if (i === 0) {
      jelly(lay, [[12, 17, 5.2, 3.4], [7.6, 18.4, 2.4, 2], [16.4, 18.2, 2.6, 2.1], [12, 13.6, 2.4, 2]], G, 20);
      outline(lay, OL); blit(b, lay, 0, 0);
      px(b, 9, 15, G[5]); px(b, 10, 14, G[5]);
      return b;
    }
    var dist = [0, 5.5, 7.4, 7.6][i], drop = [0, 0, 3, 7][i];
    for (k = 0; k < D.length; k++) {
      var x = 12 + D[k][0] * dist, y = 15 + D[k][1] * dist + drop * (1 + (k % 2) * 0.3);
      if (i === 3) { y = Math.min(20.5, y); ell(lay, x, y, 1.8, 0.8, G[2]); px(lay, x - 1, y - 0.6, G[4]); }
      else { var r = i === 1 ? 1.6 : 1.3; jelly(lay, [[x, y, r, r * 1.05]], G); px(lay, x - 0.6, y - 0.8, G[5]); }
    }
    if (i < 3) jelly(lay, [[12, 19.4, 4.4 - i * 0.6, 1.8 - i * 0.2]], G, 21);
    ell(lay, 12, 20.3, 5 - (i - 1) * 0.4, 1.1, G[1]);
    outline(lay, OL);
    blit(b, lay, 0, 0, false, i === 3 ? 0.7 : 1);
    if (i === 1) { px(b, 5, 9, G[4]); px(b, 19, 8, G[4]); px(b, 12, 6, G[5]); }
    return b;
  }
  // warning: the ground cracks in a ring where the wyrm will surface (loops)
  var BD_CRACKS = [[0.25, 11], [1.35, 6.5], [2.3, 12], [3.4, 8], [4.35, 11.5], [5.4, 7]];
  function burrowDust(i) {
    var b = mk(32, 16), k, pulse = [0.6, 0.8, 1, 0.8][i];
    for (k = 0; k < BD_CRACKS.length; k++) {
      var a = BD_CRACKS[k][0], L = BD_CRACKS[k][1];
      var sx = 16 + Math.cos(a) * 2, sy = 8 + Math.sin(a) * 0.9;
      var mx = 16 + Math.cos(a + 0.22) * L * 0.55, my = 8 + Math.sin(a + 0.22) * L * 0.55 * 0.42;
      var ex = 16 + Math.cos(a) * L, ey = 8 + Math.sin(a) * L * 0.42;
      line(b, sx, sy, mx, my, '#140f1e'); line(b, mx, my, ex, ey, '#140f1e', 0.85);
      px(b, mx, my, WYRM.cry[3], pulse); px(b, (sx + mx) / 2, (sy + my) / 2, WYRM.cry[2], pulse * 0.8);
    }
    ell(b, 16, 8, 2.2, 1, '#140f1e');
    px(b, 16, 8, WYRM.cry[4], pulse); px(b, 15, 8, WYRM.cry[3], pulse * 0.7);
    ringE(b, 16, 8, 13.4, 5.8, DUST[2], 0.35 + pulse * 0.25);
    for (k = 0; k < 24; k++) { // bright dashes marching around the ring
      if ((k + i) % 3 === 2) continue;
      var a2 = k / 24 * Math.PI * 2, x = 16 + Math.cos(a2) * 13.4, y = 8 + Math.sin(a2) * 5.8;
      px(b, x, y, Math.sin(a2) > 0 ? DUST[4] : DUST[3], pulse);
    }
    var hops = [[7, 9], [24, 7], [12, 4], [21, 11]];
    for (k = 0; k < hops.length; k++) { var h = [0, 1, 2, 1][(i + k) % 4]; px(b, hops[k][0], hops[k][1] - h, DUST[2]); px(b, hops[k][0] + 1, hops[k][1] - h, DUST[3]); }
    return b;
  }
  // Vorrakh's projectile: a violet crystal shard flying right, sparkling trail
  function crystalShard(i) {
    var b = mk(10, 8), L = mk(10, 8), C = WYRM.cry;
    poly(L, [1.6, 4.2, 3.6, 2.4, 6.6, 2.8, 8.8, 4.2, 6.2, 5.6, 3.2, 5.8], function (x, y) { return y < 4 ? C[3] : y < 5 ? C[2] : C[1]; });
    line(L, 2.6, 4, 7.6, 4, C[3]); px(L, 3.6 + i * 1.4, 3, C[4]); px(L, 8, 4, C[4]);
    outline(L, C[0]);
    blit(b, L, 0, 0);
    var tr = [[[1, 3], [0, 5]], [[0, 3], [1, 6]], [[1, 2], [0, 4]]][i];
    px(b, tr[0][0], tr[0][1], C[3], 0.7); px(b, tr[1][0], tr[1][1], C[4], 0.55);
    return b;
  }
  // hooves: a small puff of road dust
  function gallopDust(i) {
    var b = mk(10, 8);
    var B = [[[4, 5.2, 1.3], [6.2, 5.5, 1.1]], [[3.4, 4.8, 1.7], [6.3, 5, 1.5], [5, 3.9, 1.3]], [[3, 4.2, 1.9], [6.6, 4.4, 1.7], [5, 3.2, 1.4]], [[2.8, 3.6, 1.5], [6.8, 3.7, 1.3]]][i];
    cloud(b, B, DUST, [0.9, 0.85, 0.65, 0.4][i], DUST[1]);
    return b;
  }
  // a dragon's wingbeat: two gusts curling outward along the ground, with blown motes
  function wingGust(i) {
    var b = mk(24, 16), k, r = [3, 5.5, 8, 10][i], al = [0.95, 0.85, 0.65, 0.4][i];
    for (var sd = -1; sd <= 1; sd += 2) {
      for (var t = 0; t <= 1.001; t += 0.07) { // main streak, lifting at its outer end
        var x = 12 + sd * (1.5 + r * t), y = 12.5 - t * t * (1.2 + r * 0.3);
        px(b, x, y, t > 0.6 ? '#ffffff' : '#dfe8f6', al);
      }
      var cx = 12 + sd * (1.5 + r), cy = 12.5 - (1.2 + r * 0.3), cr = 1 + i * 0.35; // the curl
      for (var q = 0; q < 6; q++) { var a = q / 6 * Math.PI * 1.5 + (sd > 0 ? -Math.PI / 2 : Math.PI * 0.5); px(b, cx + sd * (Math.cos(a) * cr - cr * 0.3), cy - cr + Math.sin(a) * cr, '#ffffff', al * 0.85); }
      for (t = 0.2; t <= 1.001; t += 0.1) px(b, 12 + sd * (2.5 + r * 0.75 * t), 14 - t * 0.8, '#c8d4e8', al * 0.6); // lower, softer streak
      var mt = [[3, -2], [5, -4], [7, -1]];
      for (k = 0; k < mt.length; k++) if (k <= i) px(b, 12 + sd * (mt[k][0] + i * 1.5), 12 + mt[k][1] - i * 0.5, k % 2 ? DUST[3] : '#a8d878', al);
    }
    return b;
  }
  defFx('bolt_player', { w: 8, h: 8, frames: 3, fps: 12, ax: 5, ay: 4, draw: function (i) { return orbBolt(BOLT_PAL.bolt_player, i); } });
  defFx('bolt_enemy', { w: 8, h: 8, frames: 3, fps: 12, ax: 5, ay: 4, draw: function (i) { return orbBolt(BOLT_PAL.bolt_enemy, i); } });
  defFx('bolt_fire', { w: 8, h: 8, frames: 3, fps: 14, ax: 5, ay: 4, draw: function (i) { return orbBolt(BOLT_PAL.bolt_fire, i, true); } });
  defFx('web_shot', { w: 8, h: 8, frames: 2, fps: 10, ax: 4, ay: 4, draw: webShot });
  defFx('spore_cloud', { w: 16, h: 16, frames: 4, fps: 6, ax: 8, ay: 9, draw: sporeCloud });
  defFx('hit_spark', { w: 12, h: 12, frames: 4, fps: 18, ax: 6, ay: 6, draw: hitSpark });
  defFx('crit_spark', { w: 16, h: 16, frames: 4, fps: 16, ax: 8, ay: 8, draw: critSpark });
  defFx('death_puff', { w: 16, h: 16, frames: 5, fps: 12, ax: 8, ay: 12, draw: function (i) { return deathPuff(i); } });
  defFx('heal_sparkle', { w: 12, h: 12, frames: 4, fps: 8, ax: 6, ay: 9, draw: healSparkle });
  defFx('level_sparkle', { w: 8, h: 8, frames: 4, fps: 10, ax: 4, ay: 4, draw: levelSparkle });
  defFx('spawn_rune', { w: 24, h: 12, frames: 4, fps: 6, ax: 12, ay: 6, draw: spawnRune });
  defFx('slash_arc', { w: 24, h: 24, frames: 3, fps: 18, ax: 12, ay: 12, draw: slashArc });
  defFx('shadow', { w: 12, h: 5, frames: 1, fps: 1, ax: 6, ay: 2, draw: shadowFx });
  defFx('frost_bolt', { w: 8, h: 8, frames: 3, fps: 12, ax: 5, ay: 4, draw: frostBolt });
  defFx('frost_hit', { w: 12, h: 12, frames: 4, fps: 14, ax: 6, ay: 6, draw: frostHit });
  defFx('blink_flash', { w: 16, h: 16, frames: 4, fps: 16, ax: 8, ay: 8, draw: blinkFlash });
  defFx('grow_sparkle', { w: 16, h: 16, frames: 5, fps: 8, ax: 8, ay: 14, draw: growSparkle });
  defFx('lumen_orb', { w: 10, h: 10, frames: 4, fps: 6, ax: 5, ay: 5, draw: lumenOrb });
  defFx('lantern_rise', { w: 8, h: 12, frames: 2, fps: 4, ax: 4, ay: 11, draw: lanternRise });
  defFx('shockwave_ring', { w: 32, h: 16, frames: 5, fps: 14, ax: 16, ay: 8, draw: shockwaveRing });
  defFx('slime_split', { w: 24, h: 24, frames: 4, fps: 12, ax: 12, ay: 20, draw: slimeSplit });
  defFx('burrow_dust', { w: 32, h: 16, frames: 4, fps: 8, ax: 16, ay: 8, draw: burrowDust });
  defFx('crystal_shard', { w: 10, h: 8, frames: 3, fps: 12, ax: 6, ay: 4, draw: crystalShard });
  defFx('gallop_dust', { w: 10, h: 8, frames: 4, fps: 12, ax: 5, ay: 7, draw: gallopDust });
  defFx('wing_gust', { w: 24, h: 16, frames: 4, fps: 12, ax: 12, ay: 12, draw: wingGust });

  // ======================================================================= public API
  var rawCache = Object.create(null), cvCache = Object.create(null), fxRawCache = Object.create(null), fxCvCache = Object.create(null);
  function normArgs(type, variant, anim, index) {
    var T = typeof type === 'string' ? TYPES[type] : null;
    if (!T) { type = TYPE_IDS[0]; T = TYPES[type]; }
    if (T.variants.indexOf(variant) < 0) variant = T.variants[0];
    if (typeof anim !== 'string' || !Object.prototype.hasOwnProperty.call(T.anims, anim)) anim = 'idle';
    var n = T.anims[anim];
    index = Math.floor(Number(index));
    if (!(index >= 0 && index < n)) index = 0;
    return { T: T, type: type, variant: variant, anim: anim, index: index };
  }
  function rawFrame(type, variant, anim, index, flip) {
    var a = normArgs(type, variant, anim, index);
    var key = a.type + '|' + a.variant + '|' + a.anim + '|' + a.index + '|' + (flip ? 1 : 0);
    var b = rawCache[key];
    if (b) return b;
    if (flip) b = flipX(rawFrame(a.type, a.variant, a.anim, a.index, false));
    else {
      try { b = a.T.draw(a.variant, a.anim, a.index); } catch (e) { if (ROOT.MOBART_DEBUG) throw e; b = null; }
      if (!b || b.w !== a.T.w || b.h !== a.T.h) b = mk(a.T.w, a.T.h);
    }
    rawCache[key] = b;
    return b;
  }
  function normFx(name, index) {
    var F = typeof name === 'string' ? FX[name] : null;
    if (!F) { name = FX_IDS[0]; F = FX[name]; }
    index = Math.floor(Number(index));
    if (!(index >= 0 && index < F.frames)) index = 0;
    return { F: F, name: name, index: index };
  }
  function rawFx(name, index) {
    var a = normFx(name, index), key = a.name + '|' + a.index;
    var b = fxRawCache[key];
    if (b) return b;
    try { b = a.F.draw(a.index); } catch (e) { if (ROOT.MOBART_DEBUG) throw e; b = null; }
    if (!b || b.w !== a.F.w || b.h !== a.F.h) b = mk(a.F.w, a.F.h);
    fxRawCache[key] = b;
    return b;
  }
  // critters / familiars: { id: {w,h,anims:{name:n}, draw(anim, i)} }; bad args fall back to `base` anim / frame 0
  function normSub(REG, IDS, base, id, anim, index) {
    var D = typeof id === 'string' ? REG[id] : null;
    if (!D) { id = IDS[0]; D = REG[id]; }
    var b0 = D.base || base;
    if (typeof anim !== 'string' || !Object.prototype.hasOwnProperty.call(D.anims, anim)) anim = D.anims[b0] ? b0 : Object.keys(D.anims)[0];
    index = Math.floor(Number(index));
    if (!(index >= 0 && index < D.anims[anim])) index = 0;
    return { D: D, id: id, anim: anim, index: index };
  }
  function rawSub(REG, IDS, base, id, anim, index, flip) {
    var a = normSub(REG, IDS, base, id, anim, index), key = 's|' + a.id + '|' + a.anim + '|' + a.index + '|' + (flip ? 1 : 0);
    var b = rawCache[key];
    if (b) return b;
    if (flip) b = flipX(rawSub(REG, IDS, base, a.id, a.anim, a.index, false));
    else {
      try { b = a.D.draw(a.anim, a.index); } catch (e) { if (ROOT.MOBART_DEBUG) throw e; b = null; }
      if (!b || b.w !== a.D.w || b.h !== a.D.h) b = mk(a.D.w, a.D.h);
    }
    rawCache[key] = b;
    return b;
  }
  // mounts: draw(anim, dir, i) -> {back, front}; 'left' is the mirrored 'right'; an empty front layer comes back as null
  var MOUNT_DIRS = ['down', 'up', 'left', 'right'];
  function normMount(type, anim, dir, index) {
    var D = typeof type === 'string' ? MOUNTS[type] : null;
    if (!D) { type = MOUNT_IDS[0]; D = MOUNTS[type]; }
    if (typeof anim !== 'string' || !Object.prototype.hasOwnProperty.call(D.anims, anim)) anim = D.base;
    if (typeof dir !== 'string' || MOUNT_DIRS.indexOf(dir) < 0) dir = 'down';
    index = Math.floor(Number(index));
    if (!(index >= 0 && index < D.anims[anim])) index = 0;
    return { D: D, id: type, anim: anim, dir: dir, index: index };
  }
  function hasPx(b) { for (var i = 3; i < b.data.length; i += 4) if (b.data[i]) return true; return false; }
  function rawMount(type, anim, dir, index) {
    var a = normMount(type, anim, dir, index), key = 'M|' + a.id + '|' + a.anim + '|' + a.dir + '|' + a.index;
    var r = rawCache[key];
    if (r) return r;
    if (a.dir === 'left') { var R = rawMount(a.id, a.anim, 'right', a.index); r = { back: flipX(R.back), front: R.front ? flipX(R.front) : null }; }
    else {
      var o = null;
      try { o = a.D.draw(a.anim, a.dir, a.index); } catch (e) { if (ROOT.MOBART_DEBUG) throw e; o = null; }
      var ok = function (q) { return !!q && q.w === a.D.w && q.h === a.D.h; };
      r = { back: o && ok(o.back) ? o.back : mk(a.D.w, a.D.h), front: o && ok(o.front) && hasPx(o.front) ? o.front : null };
    }
    rawCache[key] = r;
    return r;
  }
  var HAS_DOM = typeof document !== 'undefined' && document && typeof document.createElement === 'function';
  function toCanvas(b) {
    if (!HAS_DOM) return b;
    var cv = document.createElement('canvas');
    cv.width = b.w; cv.height = b.h;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(b.w, b.h);
    img.data.set(b.data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  var MobArt = {
    types: TYPE_IDS.slice(),
    fxList: FX_IDS.slice(),
    info: function (type) {
      var T = (typeof type === 'string' && TYPES[type]) || TYPES[TYPE_IDS[0]];
      var o = {
        w: T.w, h: T.h, ax: T.ax, ay: T.ay,
        anims: { idle: T.anims.idle, move: T.anims.move, attack: T.anims.attack, hurt: T.anims.hurt, die: T.anims.die },
        variants: T.variants.slice(),
        fps: { idle: T.fps.idle, move: T.fps.move, attack: T.fps.attack, die: T.fps.die }
      };
      for (var k in T.anims) if (!Object.prototype.hasOwnProperty.call(o.anims, k)) { o.anims[k] = T.anims[k]; o.fps[k] = T.fps[k]; } // extra anims (deep_wyrm)
      return o;
    },
    frame: function (type, variant, anim, index, flip) {
      var a = normArgs(type, variant, anim, index);
      var key = a.type + '|' + a.variant + '|' + a.anim + '|' + a.index + '|' + (flip ? 1 : 0);
      var c = cvCache[key];
      if (!c) { c = toCanvas(rawFrame(a.type, a.variant, a.anim, a.index, !!flip)); cvCache[key] = c; }
      return c;
    },
    fxInfo: function (name) {
      var F = (typeof name === 'string' && FX[name]) || FX[FX_IDS[0]];
      return { w: F.w, h: F.h, frames: F.frames, fps: F.fps, ax: F.ax, ay: F.ay };
    },
    fx: function (name, index) {
      var a = normFx(name, index), key = a.name + '|' + a.index;
      var c = fxCvCache[key];
      if (!c) { c = toCanvas(rawFx(a.name, a.index)); fxCvCache[key] = c; }
      return c;
    },
    critters: CRITTER_IDS.slice(),
    critterInfo: function (type) {
      var C = (typeof type === 'string' && CRITTERS[type]) || CRITTERS[CRITTER_IDS[0]], an = {}, fp = {};
      for (var k in C.anims) { an[k] = C.anims[k]; fp[k] = C.fps[k]; }
      return { w: C.w, h: C.h, ax: C.ax, ay: C.ay, anims: an, fps: fp };
    },
    critter: function (type, anim, index, flip) {
      var a = normSub(CRITTERS, CRITTER_IDS, 'sleep', type, anim, index), key = 'c|' + a.id + '|' + a.anim + '|' + a.index + '|' + (flip ? 1 : 0);
      var c = cvCache[key];
      if (!c) { c = toCanvas(rawSub(CRITTERS, CRITTER_IDS, 'sleep', type, anim, index, !!flip)); cvCache[key] = c; }
      return c;
    },
    familiars: FAMILIAR_IDS.slice(),
    familiarInfo: function (type) {
      var D = (typeof type === 'string' && FAMILIARS[type]) || FAMILIARS[FAMILIAR_IDS[0]], an = {}, fp = {};
      for (var k in D.anims) { an[k] = D.anims[k]; fp[k] = D.fps[k]; }
      return { w: D.w, h: D.h, ax: D.ax, ay: D.ay, anims: an, fps: fp };
    },
    familiar: function (type, anim, index, flip) {
      var a = normSub(FAMILIARS, FAMILIAR_IDS, null, type, anim, index), key = 'f|' + a.id + '|' + a.anim + '|' + a.index + '|' + (flip ? 1 : 0);
      var c = cvCache[key];
      if (!c) { c = toCanvas(rawSub(FAMILIARS, FAMILIAR_IDS, null, type, anim, index, !!flip)); cvCache[key] = c; }
      return c;
    },
    pets: PET_IDS.slice(),
    petInfo: function (type) {
      var D = (typeof type === 'string' && PETS[type]) || PETS[PET_IDS[0]], an = {}, fp = {};
      for (var k in D.anims) { an[k] = D.anims[k]; fp[k] = D.fps[k]; }
      return { w: D.w, h: D.h, ax: D.ax, ay: D.ay, anims: an, fps: fp };
    },
    pet: function (type, anim, index, flip) {
      var a = normSub(PETS, PET_IDS, 'idle', type, anim, index), key = 'p|' + a.id + '|' + a.anim + '|' + a.index + '|' + (flip ? 1 : 0);
      var c = cvCache[key];
      if (!c) { c = toCanvas(rawSub(PETS, PET_IDS, 'idle', type, anim, index, !!flip)); cvCache[key] = c; }
      return c;
    },
    mounts: MOUNT_IDS.slice(),
    mountInfo: function (type) {
      var D = (typeof type === 'string' && MOUNTS[type]) || MOUNTS[MOUNT_IDS[0]], an = {}, fp = {}, sd = {};
      for (var k in D.anims) { an[k] = D.anims[k]; fp[k] = D.fps[k]; sd[k] = D.seatDy[k].slice(); }
      return { w: D.w, h: D.h, ax: D.ax, ay: D.ay, seat: { x: D.seat.x, y: D.seat.y }, anims: an, fps: fp, seatDy: sd, dirs: MOUNT_DIRS.slice() };
    },
    mount: function (type, anim, dir, index) {
      var a = normMount(type, anim, dir, index), key = 'M|' + a.id + '|' + a.anim + '|' + a.dir + '|' + a.index;
      var c = cvCache[key];
      if (!c) { var r = rawMount(a.id, a.anim, a.dir, a.index); c = { back: toCanvas(r.back), front: r.front ? toCanvas(r.front) : null }; cvCache[key] = c; }
      return { back: c.back, front: c.front };
    },
    _raw: {
      frame: function (type, variant, anim, index, flip) { return rawFrame(type, variant, anim, index, !!flip); },
      fx: function (name, index) { return rawFx(name, index); },
      critter: function (type, anim, index, flip) { return rawSub(CRITTERS, CRITTER_IDS, 'sleep', type, anim, index, !!flip); },
      familiar: function (type, anim, index, flip) { return rawSub(FAMILIARS, FAMILIAR_IDS, null, type, anim, index, !!flip); },
      pet: function (type, anim, index, flip) { return rawSub(PETS, PET_IDS, 'idle', type, anim, index, !!flip); },
      mount: function (type, anim, dir, index) { var r = rawMount(type, anim, dir, index); return { back: r.back, front: r.front }; }
    }
  };
  ROOT.MobArt = MobArt;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = MobArt; // node require() convenience
})();
