// Nightvale — core: namespace, math, noise, rng, colour, events, formatting.
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  G.TILE = 16;
  G.VERSION = '1.0';

  const U = (G.U = {});
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  U.approach = (v, t, s) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t));
  U.wrap = (v, n) => ((v % n) + n) % n;

  // Integer hash -> [0,1)
  U.hash = function (x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s | 0) + 1, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  // Smooth value noise in [0,1)
  U.noise = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = U.hash(xi, yi, s), b = U.hash(xi + 1, yi, s), c = U.hash(xi, yi + 1, s), d = U.hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  U.fbm = function (x, y, s, oct) {
    let t = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < (oct || 3); i++) { t += U.noise(x * f, y * f, s + i * 17) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return t / norm;
  };

  // Seeded RNG (mulberry32)
  U.rng = function (seed) {
    let a = (seed | 0) ^ 0x9e3779b9;
    const r = function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };
    r.weighted = (pairs) => { let tot = 0; for (const p of pairs) tot += p[1]; let x = r() * tot; for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; } return pairs[pairs.length - 1][0]; };
    return r;
  };
  U.rand = Math.random;
  U.randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  U.randRange = (lo, hi) => lo + Math.random() * (hi - lo);
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.strHash = function (str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // Colour helpers. Colours are [r,g,b] arrays or '#rrggbb' strings.
  U.hex = function (s) {
    if (Array.isArray(s)) return s;
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.css = (c, a) => { c = U.hex(c); return a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  U.mix = (a, b, t) => { a = U.hex(a); b = U.hex(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map((v) => Math.round(v)); };
  U.pack = (c, alpha) => { c = U.hex(c); return (((alpha === undefined ? 255 : alpha) << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0; };
  U.toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

  // Canvas helpers
  U.canvas = function (w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };
  U.ctx = function (c) { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return x; };
  U.flipCanvas = function (src) { const c = U.canvas(src.width, src.height), x = U.ctx(c); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; };

  // Formatting
  U.fmtNum = (n) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  U.fmtTime = function (mins) {
    let h = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60);
    m = m - (m % 10);
    const ap = h < 12 ? 'am' : 'pm';
    let hh = h % 12; if (hh === 0) hh = 12;
    return `${hh}:${m.toString().padStart(2, '0')} ${ap}`;
  };
  U.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Tiny event bus
  const listeners = {};
  // player preferences that live outside the save (settings store): the colour grade and tester mode
  G.prefs = { v: 2, look: 'golden', admin: false, noSleep: true, energy: true, god: true, freeze: false, fast: false, marketMode: 'wander', bossDifficulty: 'balanced', cabinetStyle: 'drawer' };
  G.admin = (k) => G.prefs.admin && !!G.prefs[k];
  G.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  G.off = (ev, fn) => { const l = listeners[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } };
  G.emit = (ev, a, b, c) => { const l = listeners[ev]; if (l) for (const fn of l.slice()) { try { fn(a, b, c); } catch (e) { console.error(e); } } };

  // Safe wrappers for optional modules written elsewhere.
  G.sfx = function (name, opts) { try { if (window.AudioEngine) window.AudioEngine.sfx(name, opts); } catch (e) { /* audio is optional */ } };
  G.jingle = function (name) { try { if (window.AudioEngine) window.AudioEngine.jingle(name); } catch (e) { /* optional */ } };

  // Direction helpers
  G.DIRS = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };
  G.dirFromVec = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
})();
