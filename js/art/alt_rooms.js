// Nightvale — design alternatives for rooms (Settings > Designs): looks B and C of Jasmine's cottage, Amara's study,
// the Sunken Observatory and the Crystal Garden. Look A is the original in js/art/interiors.js; these plug into
// InteriorArt through its kit as floor and wall kinds `<kind>_b` / `<kind>_c` and pieces named `<name>_b` / `<name>_c`.
// Same conventions as interiors.js: 1x pixel art lit from the upper left, selective #120c1c outline, ordered dither,
// deterministic (seeded hashes only).
(function () {
  'use strict';
  const IA = window.InteriorArt, K = IA && IA._kit;
  if (!K) return;
  const { Pix, hash, noise, fbm, bay, clamp, OUT, mix, rampAt, sprite, build, L, flame, candle, bottle, crown, stamp, teddy,
    bedBody, quiltPatch, honeyJar, cupcake, flatBook, fillBooks, ellTop, sky, stampRune, spine, FLOORS, WALLS } = K;
  const { HONEY, WALNUT, WOOD, GOLD, BRASS, COPPER, IRON, SILVER, PSTONE, WAX, PAPER, VIOLET, MIDNIGHT, TEALC, CHAR, LAV,
    CRIMSON, LEAF, MAGIC, EMER, TERRA, LIQ, GLASS, CREAM, PINK, STRAW, TEDDY, TEDDY_CREAM, MINT, HONEYG, BOOK_R, GL, HEART,
    L_CANDLE, CANDLE, AMBER, ORANGE } = K;
  const def = (id, n, make) => K.def(id, n, make);

  // ================================================================== shared helpers
  const lit = (nx, ny) => -nx * 0.6 - ny * 0.75; // light from the upper left
  // a shaded ellipse on a dark -> light ramp, dithered, a touch darker at the rim
  function ball(P, cx, cy, rx, ry, R, t0, t1) {
    t0 = t0 == null ? 0.08 : t0; t1 = t1 == null ? 0.98 : t1;
    P.ell(cx, cy, rx, ry, (x, y, nx, ny) => { const d = nx * nx + ny * ny; P.set(x, y, rampAt(R, t0 + (t1 - t0) * clamp(0.52 + lit(nx, ny) * 0.5 - (d > 0.78 ? 0.14 : 0), 0, 1), x, y)); });
  }
  // a turned shape standing on row `by`: half-width hw(j) for j = 0 (bottom) .. h-1 (top), lit from the left
  function lathe(P, cx, by, h, hw, R) {
    const n = R.length;
    for (let j = 0; j < h; j++) {
      const w2 = hw(j); if (w2 <= 0) continue;
      for (let x = Math.round(cx - w2); x <= Math.round(cx + w2) - 1; x++) {
        const rel = (x + 0.5 - (cx - w2)) / (2 * w2);
        P.set(x, by - j, R[clamp(rel < 0.2 ? n - 1 : rel < 0.5 ? n - 2 : rel < 0.8 ? n - 3 : n - 4, 0, n - 1)]);
      }
    }
  }
  // a box lit from the upper left: top face rows, front face, darker right edge
  function box(P, x0, y0, x1, y1, R, topRows) {
    const n = R.length, tr = topRows == null ? 1 : topRows;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let k = y < y0 + tr ? n - 1 : x === x0 ? n - 2 : x === x1 ? n - 5 : y === y1 ? n - 5 : n - 3;
      P.set(x, y, R[clamp(k, 0, n - 1)]);
    }
  }
  const px = (P, list, c) => { for (const [x, y] of list) P.set(x, y, c); };
  const clear = (P, x, y) => { if (x >= 0 && y >= 0 && x < P.w && y < P.h) P.d[y * P.w + x] = 0; };
  // a stylised five-petal blossom (3x3) and a daisy (plus shape)
  function daisy(P, x, y, petal, mid, shade) { P.set(x, y - 1, petal); P.set(x - 1, y, petal); P.set(x + 1, y, shade || petal); P.set(x, y + 1, shade || petal); P.set(x, y, mid); }
  // a little 5x5 sunflower head
  function sunflower(P, x, y) { stamp(P, x - 2, y - 2, ['.pPp.', 'pdcdP', 'Pcccp', 'pdcdP', '.pPp.'], { p: '#f6c64a', P: '#e8a630', d: '#5a3418', c: '#3a2010' }); P.set(x - 1, y - 1, '#7a4a24'); }
  // a framed night or day sky pane (x0..x1, y0..y1) with an optional moon for night canvases
  function pane(P, x0, y0, x1, y1, night, seed, moon) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P.set(x, y, sky(x, y, y0, y1, night, seed));
    if (night && moon) P.ell(moon[0], moon[1], moon[2], moon[2], (x, y, nx, ny) => { if (x >= x0 && x <= x1 && y >= y0 && y <= y1) P.set(x, y, nx + ny > 0.5 ? '#c8d4f0' : '#eef2ff'); });
  }
  // a tiny gold crown (7 wide, 4 tall), (x, y) = top-left
  function crownTiny(P, x, y, gem) { stamp(P, x, y, ['g.g.g.g', 'ggGgGgg', 'gGgggGg', 'ddddddd'], { g: GOLD[5], G: gem || PINK[3], d: GOLD[3] }); P.set(x, y, GOLD[6]); }

  // ================================================================== Jasmine's cottage, look B: the Honey Bakery
  const BUTTER = ['#7a5a32', '#a07a40', '#c89a4e', '#e4ba62', '#f2d27e', '#f8e4a6', '#fcf2d4'];
  const HOAK = ['#3a2416', '#5a3a20', '#7a522a', '#9a6a36', '#b88444', '#d29e58', '#e6b872']; // honey oak
  const WARMW = ['#8a7058', '#b09478', '#cdb498', '#e2cdb2', '#f0e2cc', '#faf3e6'];
  const SAGE = ['#2e3a2a', '#46563e', '#5e7452', '#7a9468', '#98b082', '#bcd0a4', '#dcead0'];
  const BRICK = ['#3a1a18', '#5a2a22', '#7a3a2a', '#9a4e34', '#b86642', '#d0845a', '#e6a87e'];
  const BURLAP = ['#4a3a28', '#6a543a', '#8a704e', '#a88a62', '#c4a87c', '#dcc49a'];
  const CREAMW = '#fbf3e2';

  function wallHoney(w, h, seed) {
    const P = new Pix(w, h), railY = h - 17;
    // butter-yellow paper: soft stripes and sprigs of white daisies in a half-drop grid
    for (let y = 4; y < railY; y++) for (let x = 0; x < w; x++) {
      const st = ((x + 2) % 10) < 4;
      let c = st ? BUTTER[5] : rampAt(BUTTER, 0.62 + fbm(x / 20, y / 14, seed) * 0.1, x, y);
      if (st && noise(x / 15, y / 11, seed + 3) > 0.7) c = mix(BUTTER[5], BUTTER[6], 0.5);
      P.set(x, y, c);
    }
    for (let row = 0, gy = 10; gy < railY - 4; row++, gy += 11) for (let gx = 6 + (row % 2) * 12; gx < w - 3; gx += 24) {
      P.set(gx - 2, gy + 2, SAGE[4]); P.set(gx - 3, gy + 3, SAGE[3]); P.set(gx + 2, gy + 2, SAGE[3]);
      daisy(P, gx, gy, '#fffdf6', '#e8a030', '#f6e8c8'); P.set(gx - 1, gy - 1, '#fffdf6'); P.set(gx + 1, gy + 1, '#f6e8c8');
    }
    crown(P, w, 0, WARMW, false);
    // plate rail with a few painted plates standing on it
    for (let x = 0; x < w; x++) { P.set(x, railY - 1, HOAK[6]); P.set(x, railY, HOAK[4]); P.set(x, railY + 1, HOAK[2]); P.dark(x, railY + 2, 0.3); }
    for (let k = 0, x0 = 22 + Math.floor(hash(1, 2, seed) * 10); x0 < w - 10; k++, x0 += 46 + Math.floor(hash(k, 3, seed) * 16)) {
      const cx = x0, cy = railY - 7;
      P.ell(cx, cy, 5.6, 5.6, (x, y, nx, ny) => {
        const d = Math.sqrt(nx * nx + ny * ny);
        let c = d > 0.84 ? (lit(nx, ny) > 0 ? HONEYG[4] : HONEYG[2]) : d > 0.72 ? '#efe4cc' : lit(nx, ny) > 0.5 ? '#ffffff' : '#f8f0e0';
        if (d > 0.42 && d < 0.62 && (Math.round(Math.atan2(ny, nx) * 4) & 1)) c = k % 2 ? SAGE[3] : '#7aa0c8';
        P.set(x, y, c);
      });
      P.set(cx, cy, HONEYG[4]); P.dark(cx + 6, cy + 2, 0.22); P.dark(cx + 6, cy + 3, 0.22);
    }
    // honey-oak beadboard wainscot and skirting
    for (let y = railY + 2; y < h - 3; y++) for (let x = 0; x < w; x++) {
      const lx = x % 5; let c = lx === 0 ? HOAK[2] : lx === 1 ? HOAK[6] : hash(Math.floor(x / 5), 0, seed) < 0.3 ? HOAK[4] : HOAK[5];
      if (lx > 1 && noise(x / 2, y / 5, seed + 4) > 0.8) c = HOAK[4];
      P.set(x, y, c);
    }
    for (let x = 0; x < w; x++) { P.set(x, h - 3, HOAK[6]); P.set(x, h - 2, HOAK[4]); P.set(x, h - 1, HOAK[2]); }
    return P;
  }

  // flat-topped hexagonal tiles: cream, with honey-gold accents every seventh tile and now and then a whole honey rosette
  function floorHoneycomb(w, h, seed) {
    const P = new Pix(w, h);
    const CR = ['#a8906e', '#c4ab86', '#dcc6a0', '#eadab8', '#f4e8cc', '#fcf4e2'], GD = ['#8a5a24', '#a8722e', '#c08c3c', '#d4a24e', '#e2b868', '#eecc88'];
    const PET = ['#a08046', '#b89656', '#ccac6c', '#dabe82', '#e6cc96', '#f0dcae'];
    const cen = (q, r) => [q * 9 + 6, r * 10 + 5 + (q & 1) * 5];
    const ax = (q, r) => [q, r - (q - (q & 1)) / 2];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]; // axial neighbours; (q + 3r) changes by 1, -1, 3, -3, -2, 2
    const res = (q, r) => (((q + 3 * r) % 7) + 7) % 7;
    const centreOf = (aq, ar) => { const m = res(aq, ar); if (!m) return [aq, ar]; for (const [dq, dr] of DIRS) if (res(aq + dq, ar + dr) === 0) return [aq + dq, ar + dr]; return [aq, ar]; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let b1 = 9, b2 = 9, bq = 0, br = 0, bdy = 0, bdx = 0;
      const q0 = Math.floor(x / 9);
      for (let q = q0 - 1; q <= q0 + 1; q++) {
        const r0 = Math.floor((y - (q & 1) * 5) / 10);
        for (let r = r0 - 1; r <= r0 + 1; r++) {
          const [cx, cy] = cen(q, r), dx = x - cx + 0.5, dy = y - cy + 0.5;
          const d = Math.max(Math.abs(dy) / 5.1, (Math.abs(dx) + Math.abs(dy) * 0.58) / 6);
          if (d < b1) { b2 = b1; b1 = d; bq = q; br = r; bdx = dx; bdy = dy; } else if (d < b2) b2 = d;
        }
      }
      let c;
      if (b2 - b1 < 0.16) c = hash(x, y, seed + 1) < 0.7 ? '#9a8262' : '#8a7458'; // grout
      else {
        const [aq, ar] = ax(bq, br), m = res(aq, ar), [cq, cr] = centreOf(aq, ar);
        const rosette = hash(cq, cr, seed + 5) < 0.1;
        const R = m === 0 ? GD : rosette ? PET : CR;
        const t = hash(bq, br, seed + 7);
        let k = t < 0.2 ? 2 : t < 0.85 ? 3 : 4;
        const edge = b1 > 0.72;
        if (edge && (bdy < -0.5 || bdx < -1.5)) k++; else if (edge && (bdy > 0.5 || bdx > 1.5)) k--;
        if (!edge && hash(x, y, seed + 13) < 0.025) k = Math.min(k + 1, 5);
        c = R[clamp(k, 0, 5)];
      }
      P.set(x, y, c);
    }
    // soft wear where feet go and a little flour dust
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const wv = fbm(x / 30, y / 22, seed + 41); if (wv > 0.66) P.tint(x, y, '#fff6e0', 0.08 + (bay(x, y) < (wv - 0.66) * 4 ? 0.05 : 0)); }
    for (let k = 0; k < (w * h) / 900; k++) { const x = Math.floor(hash(k, 1, seed + 9) * w), y = Math.floor(hash(k, 2, seed + 9) * h); P.set(x, y, '#fffdf6'); }
    return P;
  }
  FLOORS.pastel_b = floorHoneycomb;
  WALLS.pastel_b = wallHoney;
  IA.WALL_H.pastel_b = 48;

  def('honey_bed_b', 1, () => {
    const W = 32, H = 48, b = H - 1, P = new Pix(W, H);
    // a skep-dome headboard: coils of straw, lit from the left, with a honey heart dripping at the top
    const top = 3, base = b - 28;
    for (let y = top; y <= base; y++) for (let x = 2; x <= 29; x++) {
      const nx = (x - 15.5) / 13.8, ny = (y - base) / (base - top + 0.6);
      if (nx * nx + ny * ny > 1) continue;
      const band = Math.floor((y - top) / 3), ly = (y - top) % 3;
      let k = ly === 0 ? 4 : ly === 1 ? 3 : 2;
      if (nx < -0.62) k++; else if (nx > 0.62) k--;
      if (ly === 1 && (x + band * 3) % 6 === 0) k = 1; // the binding stitches
      P.set(x, y, STRAW[clamp(k, 0, 5)]);
    }
    stamp(P, 12, 4, HEART, { '#': (i, j) => (i < 3 && j < 2 ? HONEYG[5] : j > 3 ? HONEYG[2] : HONEYG[3]) });
    P.set(14, 10, HONEYG[3]); P.set(14, 11, HONEYG[4]); P.set(17, 10, HONEYG[2]);
    for (const [px0, lt] of [[1, true], [30, false]]) { for (let y = 8; y <= b - 26; y++) P.set(px0, y, lt ? HOAK[5] : HOAK[2]); P.ell(px0, 7, 1.5, 1.5, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? HOAK[6] : HOAK[3])); }
    bedBody(P, b, ['#b8a68a', '#d8c8ac', '#ece0c8', '#f6eedc', '#fffaf0', '#ffffff'],
      quiltPatch(b, (qx, qy, lx, ly) => {
        const t = (qx + qy * 2) % 3;
        if (t === 0) { const gx = (lx >> 1) & 1, gy = (ly >> 1) & 1; return gx && gy ? HONEYG[3] : gx || gy ? HONEYG[4] : CREAMW; }
        if (t === 1) { // cream with a little embroidered bear face
          if ((ly === 1 && (lx === 2 || lx === 4)) || (ly === 2 && lx >= 2 && lx <= 4) || (ly === 3 && lx >= 2 && lx <= 4)) return ly === 3 && lx === 3 ? '#5a3a2a' : TEDDY[3];
          return '#f4ead4';
        }
        if (lx === 3 && ly === 3) return HONEYG[4];
        if ((lx === 3 && (ly === 2 || ly === 4)) || (ly === 3 && (lx === 2 || lx === 4))) return '#fffaf0';
        return SAGE[4];
      }), HOAK[2]);
    teddy(P, 5, b - 35, TEDDY, HONEYG[4]); teddy(P, 19, b - 34, TEDDY_CREAM, SAGE[4]);
    stamp(P, 12, b - 23, ['.##.##.', '#######', '.#####.', '..###..', '...#...'], { '#': (i, j) => (i < 3 && j < 2 ? PINK[4] : PINK[3]) }); // a heart cushion
    P.outline(OUT); P.shadow(17, b, 15, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 2], solid: true });
  });

  def('nightstand_b', 1, () => {
    const W = 16, H = 30, b = H - 1, P = new Pix(W, H);
    for (const [lx, c] of [[2, HOAK[4]], [3, HOAK[2]], [12, HOAK[3]], [13, HOAK[1]]]) P.vline(lx, b - 8, b - 1, c);
    box(P, 1, b - 11, 14, b - 8, HOAK, 1);
    P.hline(2, 13, b - 6, HOAK[3]); P.hline(2, 13, b - 5, HOAK[1]); // lower shelf
    P.set(7, b - 10, BRASS[5]); P.set(8, b - 10, BRASS[3]);
    flatBook(P, 3, b - 7, 7, 2, SAGE.slice(1), true);
    // honey-pot lamp: an amber glass pot base and a scalloped cream shade, glowing
    lathe(P, 7.5, b - 12, 6, (j) => [2.5, 3.5, 4, 4, 3.5, 2.5][j], ['#8a4e10', '#c07818', '#e8a030', '#ffc860', '#ffe9a8']);
    P.hline(6, 9, b - 18, HONEYG[2]); P.set(5, b - 15, '#fff0b0');
    for (let j = 0; j < 6; j++) { const y = b - 24 + j, hw = 2.4 + j * 0.75; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) { const rel = (x - (7.5 - hw)) / (2 * hw); P.set(x, y, rel < 0.3 ? '#fffaf0' : rel < 0.75 ? '#fbeed2' : '#efd8b0'); } }
    for (let x = 3; x <= 12; x++) if (x % 2) P.set(x, b - 18, '#efd8b0');
    P.set(7, b - 25, HOAK[3]); P.set(8, b - 25, HOAK[2]);
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, b - 20, 54, [255, 196, 120], 0.75, 1), L(7.5, b - 14, 16, [255, 214, 140], 0.35)] });
  });

  def('bread_oven_b', 1, () => {
    const W = 32, H = 62, b = H - 1, cx = 15.5;
    const draw = (f) => {
      const P = new Pix(W, H);
      // the flue climbing to the ceiling, with a copper band
      for (let y = 1; y <= b - 34; y++) for (let x = 12; x <= 19; x++) { const lx = x - 12, course = Math.floor(y / 3), off = course % 2 ? 2 : 0; let k = ((lx + off) % 4 === 0 || y % 3 === 2) ? 2 : lx < 2 ? 5 : lx > 5 ? 3 : 4; P.set(x, y, BRISK(k)); }
      for (let x = 11; x <= 20; x++) { P.set(x, 14, COPPER[x < 13 ? 5 : 4]); P.set(x, 15, COPPER[2]); }
      // a stone plinth with a log niche
      for (let y = b - 11; y <= b - 1; y++) for (let x = 1; x <= 30; x++) { const lx = (x + (Math.floor((y - b + 11) / 4) % 2) * 5) % 10, ly = (y - b + 11) % 4; let c = ly === 3 || lx === 0 ? PSTONE[2] : x < 4 ? PSTONE[6] : x > 27 ? PSTONE[3] : PSTONE[5]; if (y === b - 11) c = PSTONE[7]; P.set(x, y, c); }
      for (let y = b - 8; y <= b - 2; y++) for (let x = 5; x <= 26; x++) P.set(x, y, '#2a1e1a');
      for (const [lx, ly] of [[7, b - 4], [12, b - 4], [17, b - 4], [22, b - 4], [9, b - 7], [14, b - 7], [19, b - 7]]) { P.ell(lx + 0.5, ly + 0.5, 2.4, 1.9, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny < 0.25 ? '#e0b888' : nx * nx + ny * ny < 0.55 ? '#b88a5a' : WOOD[2])); P.set(lx, ly, '#8a5a3a'); }
      // the brick dome
      const dTop = b - 34, dBase = b - 12;
      for (let y = dTop; y <= dBase; y++) for (let x = 1; x <= 30; x++) {
        const nx = (x - cx) / 14.6, ny = (y - dBase) / (dBase - dTop + 0.5);
        if (nx * nx + ny * ny > 1) continue;
        const course = Math.floor((y - dTop) / 3), ly = (y - dTop) % 3, off = (course % 2) * 3, lx = (x + off) % 6;
        let k = Math.round(2.6 + lit(nx, ny * 0.8) * 2.6);
        if (ly === 2 || lx === 0) k = Math.min(k, 1) + (lit(nx, ny) > 0.4 ? 1 : 0);
        else if (hash(Math.floor((x + off) / 6), course, 31) < 0.18) k--;
        P.set(x, y, BRICK[clamp(k, 0, 6)]);
      }
      // the arched mouth, glowing, with a round loaf on the hearth
      for (let y = b - 23; y <= b - 12; y++) for (let x = 9; x <= 22; x++) {
        const ax2 = (x - cx) / 6.6, ay2 = (y - (b - 17)) / 6.5;
        if (y < b - 17 && ax2 * ax2 + ay2 * ay2 > 1) continue;
        if (Math.abs(x - cx) > 6.6) continue;
        const inner = (Math.abs(x - cx) < 5.4) && (y > b - 22) && !(y < b - 17 && ((x - cx) / 5.4) ** 2 + ((y - (b - 17)) / 5.2) ** 2 > 1);
        if (!inner) { P.set(x, y, x < cx ? BRICK[6] : BRICK[4]); continue; }
        const glow = clamp((y - (b - 22)) / 9, 0, 1), fl = noise(x / 2, y / 2 + f * 0.9, 77);
        P.set(x, y, rampAt(['#2a0e0c', '#5a1a10', '#8a2a14', '#c44a1c', '#e8843c', '#ffbc62'], 0.1 + glow * 0.55 + fl * 0.25, x, y));
      }
      for (let k = 0; k < 6; k++) { const ex = 10 + ((k * 7 + f * 3) % 12), ey = b - 13 - ((k + f) % 2); P.set(ex, ey, k % 2 ? '#ffe0a0' : '#ffbc62'); }
      P.ell(cx + 1, b - 14, 3.2, 1.8, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.3 ? '#e8b070' : lit(nx, ny) > -0.3 ? '#c4864a' : '#8a5428'));
      P.set(cx, b - 15, '#f6d098'); P.set(cx + 2, b - 15, '#a86a34');
      for (let x = 8; x <= 23; x++) { P.set(x, b - 11, x < 12 ? PSTONE[7] : PSTONE[6]); } // hearth lip
      // a wooden peel leaning on the right
      P.line(27, b - 13, 30, b - 36, HOAK[5]); P.line(28, b - 13, 31, b - 36, HOAK[2]);
      P.ell(28.5, b - 10, 2.4, 3.6, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? HOAK[5] : HOAK[3]));
      P.outline(OUT);
      P.shadow(cx + 1, b, 15, 2);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(15.5, b - 15, 58, [255, 140, 60], 0.85, 1), L(15.5, b - 13, 20, [255, 200, 120], 0.5, 1)] }, draw, 4, 6);
  });
  function BRISK(k) { return BRICK[clamp(k, 0, 6)]; }

  def('baking_counter_b', 1, () => {
    const W = 32, H = 40, b = H - 1, P = new Pix(W, H);
    // cream cabinets with honey knobs and a gingham tea towel
    for (let y = b - 15; y <= b - 1; y++) for (let x = 1; x <= 30; x++) P.set(x, y, x <= 2 ? WARMW[5] : x >= 29 ? WARMW[2] : y >= b - 1 ? WARMW[1] : WARMW[4]);
    for (const [x0, x1] of [[3, 14], [17, 28]]) {
      for (let x = x0; x <= x1; x++) { P.set(x, b - 13, WARMW[2]); P.set(x, b - 3, WARMW[5]); }
      for (let y = b - 13; y <= b - 3; y++) { P.set(x0, y, WARMW[2]); P.set(x1, y, WARMW[5]); }
      for (let x = x0 + 2; x <= x1 - 2; x++) { P.set(x, b - 11, WARMW[5]); P.set(x, b - 5, WARMW[2]); }
      for (let y = b - 11; y <= b - 5; y++) { P.set(x0 + 2, y, WARMW[5]); P.set(x1 - 2, y, WARMW[2]); }
    }
    P.set(14, b - 8, HONEYG[4]); P.set(17, b - 8, HONEYG[4]); P.set(14, b - 7, HONEYG[2]); P.set(17, b - 7, HONEYG[2]);
    for (let y = b - 14; y <= b - 6; y++) for (let x = 5; x <= 10; x++) { const gx = (x >> 1) & 1, gy = (y >> 1) & 1; if (y === b - 6 && x % 2) continue; P.set(x, y, gx && gy ? HONEYG[3] : gx || gy ? HONEYG[4] : CREAMW); }
    P.hline(4, 11, b - 15, HOAK[3]);
    // butcher-block top
    for (let x = 0; x <= 31; x++) { P.set(x, b - 18, HOAK[6]); P.set(x, b - 17, x % 5 === 0 ? HOAK[3] : HOAK[5]); P.set(x, b - 16, HOAK[2]); }
    // a wire cooling rack of cupcakes (one with a bite out of it)
    for (let x = 2; x <= 17; x++) { P.set(x, b - 20, SILVER[4]); if (x % 3 === 2) P.set(x, b - 19, SILVER[2]); }
    cupcake(P, 2, b - 25, [HONEYG[4], HONEYG[5]]); cupcake(P, 6, b - 25, [PINK[4], PINK[5]]); cupcake(P, 10, b - 25, [CREAMW, '#ffffff']); cupcake(P, 14, b - 25, [HONEYG[4], HONEYG[5]]);
    clear(P, 16, b - 24); clear(P, 17, b - 24); clear(P, 17, b - 23); P.set(16, b - 23, '#c8a070'); // the bite
    // a sage mixing bowl with a whisk, a rolling pin and a honey jar with a dipper
    P.ell(22.5, b - 21, 4.2, 2.6, (x, y, nx, ny) => P.set(x, y, ny < -0.4 ? '#f8f0de' : lit(nx, ny) > 0.2 ? SAGE[5] : lit(nx, ny) > -0.4 ? SAGE[4] : SAGE[3]));
    P.hline(19, 26, b - 22, '#fffaf0'); P.hline(20, 25, b - 23, '#f0e6d0');
    P.line(24, b - 23, 26, b - 29, SILVER[4]); P.set(26, b - 30, SILVER[5]); P.set(27, b - 29, SILVER[3]); P.set(25, b - 30, SILVER[3]);
    honeyJar(P, 27, b - 19, 4, 5, [HONEYG[3], CREAMW]); P.vline(29, b - 28, b - 25, HOAK[4]); P.set(29, b - 29, HOAK[6]);
    for (let k = 0; k < 9; k++) P.set(18 + Math.floor(hash(k, 1, 3) * 12), b - 18 + (k % 2 ? 0 : -1) * 0, '#fffdf6');
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('pan_rack_b', 1, () => {
    const W = 32, H = 48, P = new Pix(W, H);
    for (let x = 2; x <= 29; x++) { P.set(x, 7, IRON[5]); P.set(x, 8, IRON[3]); }
    for (const bx of [2, 29]) { P.set(bx, 6, IRON[4]); P.set(bx, 9, IRON[2]); P.set(bx, 10, IRON[2]); }
    const hook = (x) => { P.set(x, 9, IRON[4]); P.set(x, 10, IRON[3]); };
    // a copper saucepan, a frying pan, a ladle, a whisk and a heart cookie cutter
    hook(6); P.vline(6, 11, 15, COPPER[2]); P.ell(6, 19, 4.2, 3.6, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.45 ? COPPER[5] : lit(nx, ny) > 0 ? COPPER[4] : lit(nx, ny) > -0.4 ? COPPER[3] : COPPER[2])); P.set(5, 17, '#fff0d8');
    hook(13); P.vline(13, 11, 13, IRON[4]); P.ell(13, 17, 3.2, 4.2, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.62 ? COPPER[nx < 0 ? 4 : 2] : lit(nx, ny) > 0.3 ? COPPER[3] : COPPER[2]));
    hook(19); P.vline(19, 11, 18, SILVER[4]); P.ell(19, 20, 1.8, 1.4, (x, y, nx) => P.set(x, y, nx < 0 ? SILVER[5] : SILVER[3]));
    hook(24); P.vline(24, 11, 13, HOAK[4]); for (let j = 0; j < 6; j++) { const hw = [1, 2, 2.5, 2.5, 2, 1][j]; P.set(24 - hw, 14 + j, SILVER[4]); P.set(24 + hw, 14 + j, SILVER[3]); if (j > 1) P.set(24, 14 + j, SILVER[3]); }
    hook(28); stamp(P, 26, 12, ['.#.#.', '#####', '.###.', '..#..'], { '#': (i) => (i < 2 ? COPPER[4] : COPPER[3]) }); P.set(27, 13, '#f8e4a6'); P.set(28, 13, '#f8e4a6');
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true });
  });

  def('cottage_window_b', 1, () => {
    const W = 32, H = 48;
    const draw = (f, night) => {
      const P = new Pix(W, H);
      for (let y = 6; y <= 29; y++) for (let x = 4; x <= 27; x++) P.set(x, y, x === 4 || y === 6 ? HOAK[6] : x === 27 || y === 29 ? HOAK[2] : HOAK[4]);
      pane(P, 6, 8, 14, 17, night, 61, [12, 11, 2.2]); pane(P, 17, 8, 25, 17, night, 63); pane(P, 6, 19, 14, 27, night, 65); pane(P, 17, 19, 25, 27, night, 67);
      if (!night) for (const [x0, y0] of [[7, 9], [18, 9]]) { P.set(x0, y0, '#ffffff'); P.set(x0 + 1, y0, '#f6ecf6'); P.set(x0, y0 + 1, '#f6ecf6'); }
      // gingham cafe curtains on a brass rod across the lower panes
      for (let x = 3; x <= 28; x++) P.set(x, 18, BRASS[x < 6 ? 5 : 3]);
      for (const [x0, x1] of [[5, 15], [16, 26]]) for (let y = 19; y <= 28; y++) for (let x = x0; x <= x1; x++) {
        if (y === 28 && x % 2) continue;
        const fold = (x - x0) % 3 === 2, gx = (x >> 1) & 1, gy = (y >> 1) & 1;
        let c = gx && gy ? HONEYG[3] : gx || gy ? HONEYG[4] : CREAMW; if (fold) c = mix(c, '#5a3a20', 0.18);
        P.set(x, y, c);
      }
      // a window box of daisies and two little sunflowers
      for (let y = 30; y <= 34; y++) for (let x = 2; x <= 29; x++) P.set(x, y, y === 30 ? HOAK[6] : x === 2 ? HOAK[5] : x === 29 ? HOAK[2] : y === 34 ? HOAK[2] : HOAK[4]);
      for (let k = 0; k < 9; k++) { const x = 4 + k * 3, y = 28 - (k % 2); P.vline(x, y + 1, 29, LEAF[3]); if (k % 3 === 1) daisy(P, x, y, '#fffaf0', HONEYG[4]); else P.set(x, y, LEAF[4]), P.set(x + 1, y + 1, LEAF[5]); }
      sunflower(P, 9, 25); sunflower(P, 23, 24); P.vline(9, 28, 29, LEAF[2]); P.vline(23, 27, 29, LEAF[2]);
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true, lights: [L(16, 16, 48, [255, 236, 190], 0.5)] }, draw, 1, 0, true);
    s.nLights = [L(16, 16, 36, [150, 170, 255], 0.35)];
    return s;
  });

  def('bee_sampler_b', 1, () => {
    const W = 16, H = 48, P = new Pix(W, H), cx = 7.5, cy = 19;
    P.ell(cx, cy, 6.4, 6.4, (x, y, nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny); P.set(x, y, d > 0.8 ? (lit(nx, ny) > 0 ? HOAK[6] : HOAK[3]) : d > 0.7 ? HOAK[2] : (x + y) % 2 ? '#f8f0de' : '#f2e8d2'); });
    stamp(P, 4, 15, ['.#.#.', '#####', '#####', '.###.', '..#..'], { '#': (i, j) => (j === 0 || i === 0 ? PINK[4] : PINK[3]) });
    stamp(P, 8, 18, ['.ww.', 'kyky', 'ykyk', '.kk.'], { w: '#dceaf4', k: '#2a2018', y: '#f2c45a' });
    P.set(5, 22, SAGE[3]); P.set(6, 23, SAGE[3]); P.set(9, 23, SAGE[3]); P.set(10, 22, SAGE[3]);
    P.set(cx, 12, BRASS[4]); P.set(cx + 1, 12, BRASS[2]);
    P.outline(OUT);
    P.set(7, 9, IRON[4]); P.line(7, 10, 6, 12, PINK[3]); P.line(8, 10, 9, 12, PINK[2]); // the nail and its ribbon
    return sprite({ c: P.canvas(), ax: 8, ay: H - 1, foot: [1, 1], solid: true, wall: true });
  });

  def('flour_sacks_b', 1, () => {
    const W = 16, H = 28, b = H - 1, P = new Pix(W, H);
    // a tall tied sack of flour stamped with a wheat sheaf, and an open one with a scoop in it
    const body = (x0, x1, y0, y1) => {
      for (let y = y0; y <= y1; y++) {
        const t = (y - y0) / Math.max(1, y1 - y0), bulge = Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5);
        const hw = (x1 - x0) / 2 * (0.72 + 0.28 * bulge) - (y === y1 ? 1 : 0), cx = (x0 + x1) / 2;
        for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
          const rel = (x - (cx - hw)) / (2 * hw + 0.01);
          let k = rel < 0.25 ? 4 : rel < 0.68 ? 3 : 2; if (y === y1) k = 1;
          if (noise(x / 1.6, y / 1.2, x0) > 0.72) k--;
          P.set(x, y, BURLAP[clamp(k, 0, 5)]);
        }
      }
    };
    body(1, 10, b - 17, b - 1);
    for (let y = b - 22; y <= b - 18; y++) { const hw = y === b - 18 ? 1.5 : 1.8 + (b - 18 - y) * 0.35; for (let x = Math.round(5.5 - hw); x <= Math.round(5.5 + hw); x++) P.set(x, y, x < 5 ? BURLAP[4] : BURLAP[2]); }
    P.hline(4, 7, b - 18, '#d8b070'); P.set(8, b - 17, '#d8b070'); P.set(8, b - 16, '#b88a50');
    for (const [x, y] of [[5, b - 14], [4, b - 13], [6, b - 12], [4, b - 11], [6, b - 10], [5, b - 9], [5, b - 8], [5, b - 7]]) P.set(x, y, '#6a4a2a'); // a wheat ear
    body(8, 15, b - 11, b - 1);
    for (let x = 9; x <= 14; x++) { P.set(x, b - 12, BURLAP[5]); P.set(x, b - 11, BURLAP[3]); }
    P.ell(11.5, b - 13, 2.6, 1.4, (x, y, nx, ny) => P.set(x, y, ny < 0 ? '#ffffff' : '#f2ece0'));
    P.line(13, b - 13, 15, b - 18, HOAK[5]); P.set(15, b - 19, HOAK[6]); P.set(12, b - 14, HOAK[4]); P.set(13, b - 14, HOAK[3]);
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('honey_shelf_b', 1, () => {
    const W = 32, H = 58, b = H - 1, P = new Pix(W, H), R = HOAK;
    // a honey-oak hutch: cupboard below, open shelves above, a scalloped crown and a straw skep on top
    for (let y = 9; y <= b - 15; y++) for (let x = 2; x <= 29; x++) P.set(x, y, x <= 3 ? R[5] : x >= 28 ? R[1] : R[1]);
    for (let y = 10; y <= b - 16; y++) for (let x = 4; x <= 27; x++) P.set(x, y, (x % 8 === 0) ? R[1] : R[2]);
    for (let x = 1; x <= 30; x++) { P.set(x, 7, R[6]); P.set(x, 8, R[4]); P.set(x, 9, R[2]); if (x % 4 === 1) P.set(x, 10, R[3]); }
    const shelves = [b - 40, b - 28];
    for (const sy of shelves) for (let x = 3; x <= 28; x++) { P.set(x, sy, R[6]); P.set(x, sy + 1, R[4]); P.set(x, sy + 2, R[1]); }
    // jars of honey with gingham and sage lids, labels, a honeycomb and a dipper
    const S0 = shelves[0] - 1, S1 = shelves[1] - 1;
    honeyJar(P, 5, S0, 4, 6, [HONEYG[3], CREAMW]); honeyJar(P, 11, S0, 5, 8, [SAGE[3], CREAMW]); honeyJar(P, 18, S0, 4, 5, [PINK[3], CREAMW]); honeyJar(P, 24, S0, 3, 4, [HONEYG[3], CREAMW]);
    P.hline(12, 14, S0 - 4, '#fffaf0'); P.hline(12, 13, S0 - 3, '#d8c8b0'); P.hline(6, 7, S0 - 2, '#fffaf0');
    for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) P.set(4 + i, S1 - 4 + j, (i + (j % 2)) % 3 === 0 ? HONEYG[1] : (i + j) % 2 ? HONEYG[3] : HONEYG[4]);
    honeyJar(P, 12, S1, 5, 7, [HONEYG[3], CREAMW]); honeyJar(P, 19, S1, 4, 5, [SAGE[4], CREAMW]); P.hline(13, 15, S1 - 3, '#fffaf0');
    P.vline(26, S1 - 8, S1 - 2, R[5]); for (let j = 0; j < 3; j++) P.hline(25, 27, S1 - 1 - j, j === 1 ? HONEYG[2] : R[4]); P.set(26, S1 - 9, R[6]);
    stamp(P, 22, S0 - 9, ['.ww.', 'kyky', '.kk.'], { w: '#e8f0f8', k: '#2a2018', y: '#f2c45a' });
    // the cupboard: two doors with heart cut-outs and honey knobs
    for (let y = b - 15; y <= b - 13; y++) for (let x = 1; x <= 30; x++) P.set(x, y, y === b - 15 ? R[6] : y === b - 14 ? R[5] : R[2]);
    for (let y = b - 12; y <= b - 1; y++) for (let x = 2; x <= 29; x++) P.set(x, y, x === 2 ? R[5] : x === 29 ? R[1] : x === 15 || x === 16 ? R[2] : y === b - 1 ? R[2] : R[4]);
    for (const hx of [7, 22]) stamp(P, hx - 2, b - 10, ['##.##', '#####', '.###.', '..#..'], { '#': R[1] });
    P.set(13, b - 6, HONEYG[4]); P.set(18, b - 6, HONEYG[4]);
    // a straw skep sitting on the crown
    for (let j = 0; j < 7; j++) { const hw = [6, 6, 5.5, 5, 4.2, 3.2, 1.8][j], y = 6 - j; for (let x = Math.round(15.5 - hw); x <= Math.round(15.5 + hw) - 1; x++) { const rel = (x - (15.5 - hw)) / (2 * hw); P.set(x, y, STRAW[j % 2 ? (rel < 0.3 ? 5 : rel > 0.75 ? 2 : 4) : (rel < 0.3 ? 4 : rel > 0.75 ? 1 : 3)]); } }
    P.set(15, 5, '#3a2410'); P.set(16, 5, '#3a2410');
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true, fade: true });
  });

  def('sunflowers_b', 2, (v) => {
    const W = 16, H = 34, b = H - 1, P = new Pix(W, H);
    const heads = v ? [[5, 8], [11, 12], [7, 15]] : [[4, 11], [10, 7], [12, 14]];
    for (const [hx, hy] of heads) { P.line(hx, hy + 2, 7.5, b - 9, LEAF[3]); }
    for (const [lx, ly, d] of [[4, b - 14, -1], [11, b - 16, 1], [6, b - 19, -1]]) { stamp(P, d < 0 ? lx - 2 : lx, ly, d < 0 ? ['..#', '###', '##.'] : ['#..', '###', '.##'], { '#': (i) => (i === 1 ? LEAF[4] : LEAF[3]) }); }
    for (const [hx, hy] of heads) sunflower(P, hx, hy);
    if (!v) lathe(P, 7.5, b - 1, 8, (j) => 3.2 + j * 0.3 + (j === 7 ? 0.6 : 0), TERRA);
    else { lathe(P, 7.5, b - 1, 8, (j) => 4 - (j === 0 ? 0.6 : 0), ['#4a5262', '#6a7488', '#8e98aa', '#b4bccc', '#d8dde6']); P.hline(4, 11, b - 5, '#5a6478'); P.hline(4, 11, b - 2, '#5a6478'); }
    P.outline(OUT); P.shadow(9, b, 6, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('rag_rug_b', 1, () => {
    const W = 48, H = 32, P = new Pix(W, H), cx = 23.5, cy = 15.5;
    const bands = [HONEYG[3], CREAMW, SAGE[4], '#e8a07a', HONEYG[4], CREAMW, SAGE[3], HONEYG[3]];
    P.ell(cx, cy, 22.5, 14.5, (x, y, nx, ny) => {
      const d = Math.sqrt(nx * nx + ny * ny), bi = Math.min(bands.length - 1, Math.floor((1 - d) * 9));
      let c = bands[bi];
      const braid = ((x + y * 2) % 4 < 2) !== ((Math.floor((1 - d) * 18)) % 2 === 0);
      if (braid) c = mix(c, '#5a3a20', 0.16);
      if (d > 0.95) c = mix(c, '#3a2416', 0.3);
      P.set(x, y, c);
    });
    return sprite({ c: P.canvas(), ax: 24, ay: H - 1, foot: [3, 2], solid: false, flat: true });
  });

  def('spindle_chair_b', 1, () => {
    const W = 16, H = 26, b = H - 1, P = new Pix(W, H), R = HOAK;
    // facing right: spindle back on the left, a sage cushion
    for (let y = b - 22; y <= b - 1; y++) { P.set(3, y, R[5]); P.set(4, y, R[3]); }
    P.ell(3.5, b - 23, 1.4, 1.2, (x, y, nx) => P.set(x, y, nx < 0 ? R[6] : R[4]));
    for (const sx of [6, 8]) for (let y = b - 20; y <= b - 11; y++) P.set(sx, y, sx === 6 ? R[4] : R[3]);
    P.hline(4, 9, b - 20, R[5]); P.hline(4, 9, b - 19, R[2]);
    for (let y = b - 11; y <= b - 9; y++) for (let x = 3; x <= 13; x++) P.set(x, y, y === b - 11 ? SAGE[5] : x === 3 ? SAGE[4] : SAGE[3]);
    P.set(6, b - 11, SAGE[6]); P.set(9, b - 10, SAGE[2]);
    P.hline(3, 13, b - 8, R[4]); P.hline(3, 13, b - 7, R[2]);
    P.vline(12, b - 6, b - 1, R[3]); P.vline(13, b - 6, b - 1, R[1]); P.vline(6, b - 6, b - 2, R[2]);
    P.outline(OUT); P.shadow(9, b, 6.5, 1.6);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('honey_table_b', 1, () => {
    const W = 16, H = 28, b = H - 1, P = new Pix(W, H), R = HOAK;
    for (let y = b - 9; y <= b - 2; y++) { P.set(7, y, R[4]); P.set(8, y, R[2]); }
    P.hline(4, 11, b - 1, R[3]); P.set(3, b - 1, R[4]); P.set(12, b - 1, R[1]);
    // a round table under a lace cloth: a honey pot with its dipper, a teacup and a slice of honey cake
    const cy = b - 12;
    P.ell(7.5, cy, 7.2, 3.2, (x, y, nx, ny) => P.set(x, y, (x + y) % 3 === 0 ? '#e8e0d4' : lit(nx, ny) > 0.3 ? '#ffffff' : '#f6f0e6'));
    for (let x = 1; x <= 14; x++) { const drop = x % 3 === 1 ? 3 : 2, y0 = cy + 2 + (Math.abs(x - 7.5) > 5 ? -1 : 0); for (let j = 0; j < drop; j++) P.set(x, y0 + j, j === drop - 1 ? '#d8d0c4' : '#ece6dc'); }
    lathe(P, 4.5, cy, 5, (j) => [2, 2.6, 2.8, 2.4, 2.2][j], ['#8a4e10', '#c07818', '#e8a030', '#ffc860', '#fff0b0']);
    P.hline(3, 5, cy - 5, HONEYG[3]); P.hline(2, 6, cy - 4, CREAMW); P.set(3, cy - 2, '#fff0b0');
    P.vline(5, cy - 9, cy - 5, R[5]); P.set(5, cy - 10, R[6]); P.set(6, cy - 9, R[4]);
    P.hline(9, 12, cy, '#ffffff'); P.hline(9, 12, cy - 1, '#f4ece0'); P.set(9, cy - 2, '#ffffff'); P.set(12, cy - 2, '#e8e0d0'); P.hline(10, 11, cy - 2, '#8a5428'); P.set(13, cy - 1, '#e8e0d0');
    stamp(P, 8, cy - 5, ['.ff..', 'ccccc', 'CCCCC'], { f: '#fff0b0', c: (i) => (i < 2 ? '#e8b070' : '#d49a58'), C: '#a86a34' });
    P.outline(OUT); P.shadow(9, b, 7, 1.6);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('yarn_basket_b', 1, () => {
    const W = 16, H = 20, b = H - 1, P = new Pix(W, H);
    for (const [cx, cy, R] of [[5, b - 9, ['#8a4e10', '#c07818', '#e8a030', '#ffc860']], [10, b - 10, SAGE.slice(2, 6)], [7.5, b - 12, PINK.slice(1, 5)]]) {
      P.ell(cx, cy, 2.8, 2.6, (x, y, nx, ny) => { let c = R[lit(nx, ny) > 0.4 ? 3 : lit(nx, ny) > -0.2 ? 2 : 1]; if ((x * 2 + y) % 4 === 0) c = R[Math.max(0, R.indexOf(c) - 1)]; P.set(x, y, c); });
    }
    P.line(9, b - 13, 14, b - 18, '#d8d0cc'); P.line(10, b - 12, 15, b - 16, '#b8b0ac'); P.set(14, b - 19, PINK[4]); P.set(15, b - 17, PINK[3]);
    for (let y = b - 7; y <= b - 1; y++) for (let x = 2; x <= 13; x++) { const k = ((x + (y % 2)) % 2) ? 4 : 2; P.set(x, y, STRAW[x === 2 ? 5 : x === 13 ? 1 : k]); }
    P.hline(1, 14, b - 7, STRAW[5]); P.hline(2, 13, b - 6, STRAW[2]);
    for (let y = b - 6; y <= b - 2; y++) P.set(11, y, PINK[3]); P.set(11, b - 1, PINK[4]); // a scarf hanging over the side
    P.outline(OUT); P.shadow(8, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('giant_bear_b', 1, () => {
    const W = 32, H = 38, b = H - 1, P = new Pix(W, H), R = TEDDY, cx = 15.5;
    // Sir Bartholomew Honeypaw on a big floor cushion, hugging a honey pot, in his little crown
    P.ell(cx, b - 4, 15, 4.2, (x, y, nx, ny) => P.set(x, y, ny < -0.2 ? SAGE[5] : lit(nx, ny) > 0.2 ? SAGE[4] : SAGE[3]));
    for (let x = 2; x <= 29; x += 4) P.set(x, b - 4, SAGE[2]);
    const fur = (x, y, nx, ny) => { const s = lit(nx, ny); P.set(x, y, R[s > 0.55 ? 5 : s > 0.12 ? 4 : s > -0.35 ? 3 : 2]); };
    P.ell(cx, b - 13, 10.5, 9, fur); // body
    P.ell(cx, b - 12, 6, 5.6, (x, y, nx, ny) => P.set(x, y, R[lit(nx, ny) > -0.2 ? 5 : 4])); // tummy
    P.ell(cx - 7.5, b - 6, 4.4, 3.2, fur); P.ell(cx + 7.5, b - 6, 4.4, 3.2, fur); // feet
    P.ell(cx - 8.2, b - 5.4, 2.2, 1.6, (x, y) => P.set(x, y, '#f4bccc')); P.ell(cx + 8.2, b - 5.4, 2.2, 1.6, (x, y) => P.set(x, y, '#e092aa'));
    // the honey pot in his lap
    lathe(P, cx, b - 7, 8, (j) => [3.2, 4.4, 5, 5, 4.6, 3.8, 3.2, 3.6][j], ['#8a4e10', '#c07818', '#e8a030', '#ffc860', '#fff0b0']);
    for (let x = Math.round(cx - 4); x <= Math.round(cx + 3); x++) { P.set(x, b - 15, (x % 2) ? HONEYG[3] : CREAMW); P.set(x, b - 16, (x % 2) ? CREAMW : HONEYG[3]); }
    P.hline(Math.round(cx - 2), Math.round(cx + 1), b - 11, '#fffaf0'); P.set(cx - 1, b - 10, '#d8c8b0');
    P.ell(cx - 6.5, b - 12, 2.6, 3.6, fur); P.ell(cx + 6.5, b - 12, 2.6, 3.6, fur); // paws round the pot
    // head, ears, muzzle and face
    P.ell(cx - 6.5, b - 30, 3.2, 3.2, fur); P.ell(cx + 6.5, b - 30, 3.2, 3.2, fur);
    P.ell(cx - 6.5, b - 30, 1.6, 1.6, (x, y) => P.set(x, y, '#f4bccc')); P.ell(cx + 6.5, b - 30, 1.6, 1.6, (x, y) => P.set(x, y, '#e092aa'));
    P.ell(cx, b - 24, 8, 6.6, fur);
    P.ell(cx, b - 21.4, 3.4, 2.4, (x, y, nx, ny) => P.set(x, y, R[lit(nx, ny) > -0.3 ? 5 : 4]));
    P.set(cx - 1, b - 22, '#2a1810'); P.set(cx, b - 22, '#2a1810'); P.set(cx - 1, b - 23, '#5a3a2a');
    P.set(cx - 1, b - 20, '#5a3a2a'); P.set(cx, b - 20, '#5a3a2a'); P.set(cx - 2, b - 21, '#5a3a2a'); P.set(cx + 1, b - 21, '#5a3a2a');
    for (const ex of [cx - 4, cx + 3]) { P.set(ex, b - 25, '#1a1010'); P.set(ex, b - 24, '#1a1010'); P.set(ex, b - 26, '#ffffff'); }
    P.set(cx - 6, b - 21, '#f4a0b4'); P.set(cx + 5, b - 21, '#f4a0b4');
    crownTiny(P, Math.round(cx) - 4, b - 34, PINK[3]);
    P.outline(OUT); P.shadow(cx + 1, b, 15, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  // ================================================================== Jasmine's cottage, look C: the Wisteria Sunroom
  const LILAC = ['#4a3a5e', '#6a5684', '#8a76a8', '#a896c4', '#c4b4dc', '#dcd0ec', '#f0eaf8'];
  const WIST = ['#3e2a66', '#5a3e8e', '#7a5cb4', '#9c80d4', '#bea6ea', '#dccaf8'];
  const WPAINT = ['#7e7890', '#a09ab0', '#c0bacc', '#d8d4e2', '#eae7f0', '#f8f6fb'];
  const WICKER = ['#4a3424', '#7a5a3a', '#a07c52', '#c09c6a', '#d8b884', '#ecd4a2']; // natural rattan
  const raceme = (P, x0, y0, len, k) => { // a drooping wisteria flower cluster
    for (let j = 0; j < len; j++) {
      const t = j / len, hw = Math.max(0, Math.round((1 - t) * 2.2)), sway = j > len * 0.55 ? (k % 2 ? 1 : 0) : 0;
      for (let i = -hw; i <= hw; i++) { if (hw > 0 && Math.abs(i) === hw && (i + j) % 2) continue; P.set(x0 + i + sway, y0 + j, WIST[clamp(Math.round(4.4 - t * 3 - (i > 0 ? 1 : 0) + ((i + j) % 2 ? 0.6 : 0)), 0, 5)]); }
    }
  };
  function wallWisteria(w, h, seed) {
    const P = new Pix(w, h), railY = h - 16;
    for (let y = 4; y < railY; y++) for (let x = 0; x < w; x++) { // lilac shiplap
      const ly = (y - 4) % 5;
      P.set(x, y, ly === 4 ? LILAC[4] : ly === 0 ? LILAC[6] : rampAt(LILAC, 0.8 + noise(x / 24, y / 3, seed) * 0.1, x, y));
    }
    crown(P, w, 0, WPAINT, false);
    // a painted wisteria frieze: a sage vine under the cornice with racemes hanging from it
    const vy = (x) => 7 + Math.round(Math.sin(x / 7 + seed) * 1.3);
    for (let x = 0; x < w; x++) { P.set(x, vy(x), SAGE[2]); if (hash(x, 1, seed) < 0.35) P.set(x, vy(x) - 1, SAGE[4]); if (hash(x, 2, seed) < 0.2) P.set(x, vy(x) + 1, SAGE[3]); }
    for (let k = 0, x0 = 3; x0 < w - 2; k++, x0 += 8 + Math.floor(hash(k, 2, seed) * 6)) {
      P.set(x0 - 1, vy(x0) + 1, SAGE[4]); P.set(x0 + 1, vy(x0) + 1, SAGE[3]);
      raceme(P, x0, vy(x0) + 2, 6 + Math.floor(hash(k, 3, seed) * 8), k);
    }
    // white board-and-batten below a sage chair rail
    for (let x = 0; x < w; x++) { P.set(x, railY, SAGE[5]); P.set(x, railY + 1, SAGE[3]); P.dark(x, railY + 2, 0.22); }
    for (let y = railY + 2; y < h - 3; y++) for (let x = 0; x < w; x++) { const lx = x % 12; P.set(x, y, lx === 0 ? WPAINT[2] : lx === 1 ? WPAINT[5] : lx === 2 ? WPAINT[3] : noise(x / 3, y / 6, seed + 5) > 0.8 ? WPAINT[3] : WPAINT[4]); }
    for (let x = 0; x < w; x++) { P.set(x, h - 3, SAGE[4]); P.set(x, h - 2, SAGE[3]); P.set(x, h - 1, SAGE[1]); }
    return P;
  }
  // harlequin tiles: cream and sage diamonds, bevelled, with little lilac cabochons where four meet
  function floorHarlequin(w, h, seed) {
    const P = new Pix(w, h), S = 12;
    const CRM = ['#a8a298', '#c6c0b4', '#ddd8cc', '#e9e5da', '#f4f1e8', '#fdfcf6'], LIL = ['#3e5440', '#506a50', '#63805f', '#74926e', '#86a27e', '#98b28e'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const u = x + y + 6, v = x - y + 1000 * S + 6, iu = Math.floor(u / S), iv = Math.floor(v / S), lu = u - iu * S, lv = v - iv * S;
      const pale = ((iu + iv) & 1) === 0, R = pale ? CRM : LIL;
      let c;
      if (lu === 0 || lv === 0) c = pale ? '#a8a49a' : '#46583e';
      else {
        let k = 3 + (hash(iu, iv, seed) < 0.25 ? -1 : hash(iu, iv, seed) > 0.9 ? 1 : 0);
        if (lu === 1) k = 5; else if (lv === S - 1) k = Math.max(k, 4); else if (lu === S - 1) k = 1; else if (lv === 1) k = Math.min(k, 2);
        if (k > 1 && k < 5 && hash(x, y, seed + 3) < 0.02) k++;
        c = R[clamp(k, 0, 5)];
      }
      P.set(x, y, c);
    }
    for (let a = 0; a <= Math.ceil((w + h) / S) + 2; a++) for (let k = -Math.ceil(h / S) - 2; k <= Math.ceil(w / S) + 2; k++) {
      if (((a + k) & 1) !== 0) continue;
      const vx = ((a + k) * S - 12) / 2, vy = ((a - k) * S) / 2;
      if (vx < -3 || vy < -3 || vx > w + 3 || vy > h + 3) continue;
      P.set(vx, vy, WIST[4]); P.set(vx - 1, vy, WIST[3]); P.set(vx + 1, vy, WIST[2]); P.set(vx, vy - 1, WIST[5]); P.set(vx, vy + 1, WIST[2]);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const wv = fbm(x / 30, y / 22, seed + 41); if (wv > 0.66) P.tint(x, y, '#ffffff', 0.08 + (bay(x, y) < (wv - 0.66) * 4 ? 0.05 : 0)); }
    return P;
  }
  FLOORS.pastel_c = floorHarlequin;
  WALLS.pastel_c = wallWisteria;
  IA.WALL_H.pastel_c = 48;

  def('canopy_bed_c', 1, () => {
    const W = 32, H = 56, b = H - 1, P = new Pix(W, H), R = WPAINT;
    // white canopy posts and rail
    for (const [x0, lt] of [[1, true], [30, false]]) { for (let y = 3; y <= b - 26; y++) P.set(x0, y, lt ? R[5] : R[2]); P.ell(x0, 2, 1.4, 1.4, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? R[5] : R[3])); }
    for (let x = 1; x <= 30; x++) { P.set(x, 3, R[5]); P.set(x, 4, R[3]); }
    // an arched white headboard with a painted lilac heart
    for (let y = 11; y <= b - 30; y++) for (let x = 4; x <= 27; x++) {
      const top = 11 + Math.round(3 * (1 - Math.cos(((x - 4) / 23) * Math.PI * 2)) / 2 * 0) + Math.round(2.2 * Math.pow(Math.abs(x - 15.5) / 11.5, 2) * 2);
      if (y < top) continue;
      P.set(x, y, y === top ? R[5] : x <= 5 ? R[5] : x >= 26 ? R[2] : R[4]);
    }
    stamp(P, 12, 15, HEART, { '#': (i, j) => (i < 3 && j < 2 ? WIST[5] : WIST[3]) });
    bedBody(P, b, ['#a898b8', '#d4cae0', '#ece6f2', '#f6f2fa', '#ffffff', '#ffffff'],
      quiltPatch(b, (qx, qy, lx, ly) => {
        const t = (qx + qy * 2) % 3;
        if (t === 0) { if ((ly === 1 && (lx === 2 || lx === 4)) || (ly === 2 && lx >= 2 && lx <= 4) || (ly === 3 && lx >= 2 && lx <= 4)) return ly === 3 && lx === 3 ? '#6a5a78' : '#f4ece4'; return LILAC[4]; }
        if (t === 1) return (lx + ly) % 2 ? WPAINT[5] : '#efe8f4';
        if ((lx === 3 && ly === 3)) return HONEYG[4];
        if ((lx === 3 && (ly === 2 || ly === 4)) || (ly === 3 && (lx === 2 || lx === 4))) return '#ffffff';
        return SAGE[4];
      }), R[2]);
    teddy(P, 5, b - 35, TEDDY_CREAM, WIST[3]); teddy(P, 19, b - 34, TEDDY, LILAC[5]);
    // a scalloped lilac valance, and drapes gathered at each post with a pink ribbon
    for (let x = 1; x <= 30; x++) { const sc = (x % 5) < 3 ? 1 : 0; for (let y = 5; y <= 7 + sc; y++) P.set(x, y, y === 5 ? WIST[5] : y === 7 + sc ? WIST[2] : (x % 5 === 0 ? WIST[3] : WIST[4])); }
    for (const left of [true, false]) for (let y = 8; y <= b - 24; y++) {
      const tie = 24, wd = y < tie ? 2 + Math.round((tie - y) / 9) : y < tie + 3 ? 1 : 1 + Math.min(3, Math.round((y - tie - 2) / 3));
      for (let i = 0; i <= wd; i++) { const x = left ? 2 + i : 29 - i; P.set(x, y, i === wd ? WIST[2] : (i + y) % 4 === 0 ? WIST[5] : WIST[4]); }
      if (y === tie) { const tx = left ? 3 : 28; P.set(tx, y, PINK[4]); P.set(tx + (left ? 1 : -1), y, PINK[3]); P.set(tx, y + 1, PINK[2]); }
    }
    P.outline(OUT); P.shadow(17, b, 15, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 2], solid: true, fade: true });
  });

  def('wicker_stand_c', 1, () => {
    const W = 16, H = 30, b = H - 1, P = new Pix(W, H);
    // a little white wicker table with a lilac glass lamp and a teacup
    for (let y = b - 10; y <= b - 1; y++) for (let x = 2; x <= 13; x++) { const k = ((x + (y % 2)) % 2) ? 4 : 3; P.set(x, y, WICKER[x === 2 ? 5 : x === 13 ? 1 : y === b - 1 ? 2 : k]); }
    for (let x = 1; x <= 14; x++) { P.set(x, b - 11, WICKER[5]); P.set(x, b - 10, WICKER[3]); }
    P.hline(2, 13, b - 5, WICKER[2]);
    lathe(P, 6.5, b - 12, 5, (j) => [2.2, 2.6, 2.6, 2.2, 1.4][j], ['#6a5a9a', '#8a78c0', '#b4a2e2', '#d8ccf6']);
    P.vline(6, b - 18, b - 17, SILVER[4]);
    for (let j = 0; j < 5; j++) { const y = b - 23 + j, hw = 1.8 + j * 0.65; for (let x = Math.round(6.5 - hw); x <= Math.round(6.5 + hw) - 1; x++) { const rel = (x - (6.5 - hw)) / (2 * hw); P.set(x, y, rel < 0.3 ? '#f6f0ff' : rel < 0.75 ? '#e4d8f6' : '#c8b8e4'); } }
    for (let x = 3; x <= 10; x++) if (x % 2) P.set(x, b - 18, '#c8b8e4');
    P.set(11, b - 13, '#ffffff'); P.set(12, b - 13, '#e8e0f0'); P.set(11, b - 12, '#e8e0f0'); P.set(13, b - 13, '#e8e0f0'); P.set(11, b - 14, PINK[3]);
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(6.5, b - 20, 50, [255, 214, 190], 0.7, 1), L(6.5, b - 14, 14, [214, 190, 255], 0.35)] });
  });

  def('tea_cart_c', 1, () => {
    const W = 16, H = 34, b = H - 1, P = new Pix(W, H), R = WPAINT;
    // a white tea trolley: a three-tier cake stand on top, a teapot below
    for (const lx of [2, 12]) for (let y = b - 16; y <= b - 3; y++) { P.set(lx, y, lx === 2 ? R[5] : R[3]); P.set(lx + 1, y, R[2]); }
    P.line(13, b - 16, 15, b - 21, R[3]); P.set(15, b - 22, R[5]);
    for (const sy of [b - 15, b - 6]) { P.hline(1, 14, sy, R[5]); P.hline(1, 14, sy + 1, R[2]); }
    for (const wx of [3, 12]) { P.set(wx, b - 1, '#5a5468'); P.set(wx, b - 2, '#8a849a'); P.set(wx + 1, b - 1, '#3a3448'); }
    // teapot with lilac flowers
    P.ell(7.5, b - 9, 3.4, 2.6, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.3 ? '#ffffff' : lit(nx, ny) > -0.3 ? '#f0ecf4' : '#d4cede'));
    P.set(6, b - 9, WIST[3]); P.set(9, b - 10, WIST[3]); P.set(4, b - 10, '#e0dae6'); P.set(3, b - 11, '#e0dae6'); P.set(11, b - 9, '#d4cede'); P.set(12, b - 10, '#d4cede'); P.set(7, b - 12, '#d4cede');
    // the cake stand
    P.vline(7, b - 30, b - 16, SILVER[4]); P.vline(8, b - 30, b - 16, SILVER[2]);
    for (const [py, hw] of [[b - 17, 6], [b - 22, 4.5], [b - 27, 3]]) { P.hline(Math.round(7.5 - hw), Math.round(7.5 + hw), py, '#ffffff'); P.hline(Math.round(7.5 - hw) + 1, Math.round(7.5 + hw) - 1, py + 1, '#d8d0e0'); }
    const mac = (x, y, c) => { P.set(x, y, c[1]); P.set(x + 1, y, c[0]); P.set(x, y - 1, '#fffaf0'); P.set(x + 1, y - 1, '#fffaf0'); P.set(x, y - 2, c[1]); P.set(x + 1, y - 2, c[0]); };
    mac(2, b - 18, [PINK[3], PINK[4]]); mac(5, b - 18, [MINT[3], MINT[4]]); mac(9, b - 18, [LILAC[3], LILAC[5]]); mac(12, b - 18, [HONEYG[3], HONEYG[4]]);
    cupcake(P, 4, b - 27, [WIST[4], WIST[5]]); cupcake(P, 8, b - 27, [PINK[4], PINK[5]]);
    P.set(7, b - 32, PINK[3]); P.set(8, b - 32, CRIMSON[4]); P.set(7, b - 31, '#ffffff'); P.set(8, b - 31, '#f4ece0');
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('retro_stove_c', 1, () => {
    const W = 32, H = 42, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H);
      // a lilac enamel range with chrome trim, a round oven window glowing with a cake inside
      for (let y = b - 22; y <= b - 2; y++) for (let x = 1; x <= 30; x++) { if ((y === b - 22 || y === b - 2) && (x === 1 || x === 30)) continue; P.set(x, y, x <= 2 ? LILAC[6] : x >= 29 ? LILAC[3] : y === b - 2 ? LILAC[3] : LILAC[5]); }
      for (const fx of [3, 4, 27, 28]) P.set(fx, b - 1, SILVER[fx < 10 ? 4 : 2]);
      for (let x = 3; x <= 28; x++) { P.set(x, b - 18, SILVER[5]); P.set(x, b - 17, SILVER[3]); }
      for (let y = b - 16; y <= b - 4; y++) for (let x = 4; x <= 27; x++) P.set(x, y, x === 4 || y === b - 16 ? '#ffffff' : x === 27 || y === b - 4 ? WPAINT[3] : WPAINT[5]);
      P.ell(15.5, b - 10, 5.2, 4.2, (x, y, nx, ny) => { const d = nx * nx + ny * ny; P.set(x, y, d > 0.72 ? (lit(nx, ny) > 0 ? SILVER[5] : SILVER[2]) : rampAt(['#4a1e10', '#8a3a18', '#c4682c', '#f0a048', '#ffd890'], 0.25 + (1 - d) * 0.45 + (f % 2) * 0.08, x, y)); });
      stamp(P, 13, b - 11, ['.ff..', 'ccccc', 'CCCCC'], { f: '#fff0d8', c: '#f6c88a', C: '#d08a4a' });
      P.set(14, b - 12, PINK[4]);
      for (let x = 9; x <= 22; x++) P.set(x, b - 15, SILVER[x < 12 ? 5 : 4]);
      for (const kx of [6, 11, 20, 25]) { P.set(kx, b - 20, '#ffffff'); P.set(kx + 1, b - 20, WPAINT[3]); P.set(kx, b - 21, SILVER[5]); }
      // stovetop, a backsplash with a little clock, a lilac kettle and the cupcake rack
      for (let x = 0; x <= 31; x++) { P.set(x, b - 25, '#ffffff'); P.set(x, b - 24, WPAINT[4]); P.set(x, b - 23, SILVER[3]); }
      for (let y = b - 33; y <= b - 26; y++) for (let x = 2; x <= 29; x++) P.set(x, y, y === b - 33 ? SILVER[5] : x === 2 ? LILAC[6] : x === 29 ? LILAC[3] : LILAC[5]);
      P.ell(15.5, b - 29.5, 2.6, 2.6, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.6 ? SILVER[4] : '#ffffff'));
      P.set(15, b - 30, '#3a3448'); P.set(15, b - 31, '#3a3448'); P.set(16, b - 30, '#3a3448');
      P.ell(24.5, b - 28, 3.6, 3, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.4 ? WIST[5] : lit(nx, ny) > -0.2 ? WIST[4] : WIST[3]));
      P.set(24, b - 32, SILVER[4]); P.set(25, b - 32, SILVER[3]); P.line(27, b - 29, 29, b - 31, WIST[3]);
      for (let x = 3; x <= 12; x++) { P.set(x, b - 26, SILVER[4]); if (x % 3 === 0) P.set(x, b - 25, SILVER[2]); }
      cupcake(P, 3, b - 31, [PINK[4], PINK[5]]); cupcake(P, 8, b - 31, [WIST[4], WIST[5]]);
      clear(P, 11, b - 30); clear(P, 10, b - 30); clear(P, 11, b - 29); P.set(10, b - 29, '#c8a070'); // the bite
      P.outline(OUT);
      if (f % 2) { P.set(29, b - 33, '#ffffff', 150); P.set(30, b - 35, '#ffffff', 110); } else { P.set(30, b - 34, '#ffffff', 150); P.set(29, b - 36, '#ffffff', 100); }
      P.shadow(17, b, 15, 1.8);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(15.5, b - 10, 34, [255, 170, 90], 0.55, 1)] }, draw, 2, 2);
  });

  def('honey_window_c', 1, () => {
    const W = 32, H = 48;
    const draw = (f, night) => {
      const P = new Pix(W, H);
      // a tall white window with glass shelves of honey jars across it, the sun shining through them
      for (let y = 3; y <= 33; y++) for (let x = 5; x <= 26; x++) P.set(x, y, x <= 6 || y <= 4 ? WPAINT[5] : x >= 25 || y >= 32 ? WPAINT[2] : WPAINT[4]);
      pane(P, 7, 5, 24, 31, night, 71, [20, 9, 2.4]);
      for (let y = 5; y <= 31; y++) { P.set(15, y, WPAINT[4]); P.set(16, y, WPAINT[2]); }
      const jarsOn = (sy, list) => {
        for (let x = 7; x <= 24; x++) { P.set(x, sy, night ? '#8a94b8' : '#e8f4ff'); P.set(x, sy + 1, night ? '#5a6488' : '#b8d0e8'); }
        for (const [x, w2, h2, lid] of list) {
          for (let j = 0; j < h2; j++) for (let i = 0; i < w2; i++) {
            const edge = i === 0 || i === w2 - 1, core = !edge && j > 0 && j < h2 - 1;
            P.set(x + i, sy - 1 - j, night ? (core ? '#c07818' : '#8a4e10') : core ? (j > h2 / 2 ? '#ffe08a' : '#ffc860') : edge && i === 0 ? '#fff0b0' : '#e8a030');
          }
          for (let i = -1; i <= w2; i++) P.set(x + i, sy - 1 - h2, (i + x) % 2 ? lid[0] : lid[1]);
        }
      };
      jarsOn(13, [[8, 4, 6, [WIST[3], '#ffffff']], [17, 5, 7, [PINK[3], '#ffffff']]]);
      jarsOn(22, [[9, 3, 4, [SAGE[4], '#ffffff']], [13, 4, 5, [WIST[4], '#ffffff']], [20, 4, 6, [HONEYG[3], '#ffffff']]]);
      jarsOn(31, [[8, 5, 6, [PINK[4], '#ffffff']], [18, 3, 4, [WIST[3], '#ffffff']], [22, 3, 5, [SAGE[3], '#ffffff']]]);
      for (let x = 3; x <= 28; x++) { P.set(x, 34, WPAINT[5]); P.set(x, 35, WPAINT[3]); }
      P.outline(OUT);
      // sage curtains tied back at both sides
      for (const left of [true, false]) for (let y = 2; y <= 36; y++) {
        const tie = 20, wd = y < tie ? Math.round(3 - (tie - y) * 0.05) : Math.round(2 + Math.min(1, (y - tie) / 10) * 2);
        for (let i = 0; i <= wd; i++) { const x = left ? 2 + i : 29 - i; P.set(x, y, i === wd ? SAGE[2] : (i + (left ? 0 : 1)) % 2 ? SAGE[4] : SAGE[5]); }
        if (y === tie) { const tx = left ? 3 : 28; P.set(tx, y, WIST[4]); P.set(tx + (left ? 1 : -1), y, WIST[3]); }
      }
      for (let x = 1; x <= 30; x++) P.set(x, 1, x % 6 === 0 ? SILVER[5] : SILVER[3]);
      return P;
    };
    const s = build({ ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true, lights: [L(16, 18, 56, [255, 206, 120], 0.6)] }, draw, 1, 0, true);
    s.nLights = [L(16, 18, 40, [160, 170, 255], 0.35)];
    return s;
  });

  def('peg_rail_c', 1, () => {
    const W = 32, H = 48, P = new Pix(W, H);
    for (let x = 1; x <= 30; x++) { P.set(x, 9, WPAINT[5]); P.set(x, 10, WPAINT[4]); P.set(x, 11, WPAINT[2]); }
    for (const pxx of [6, 15, 25]) { P.set(pxx, 12, WPAINT[4]); P.set(pxx, 13, WPAINT[2]); }
    // a lilac apron with a heart pocket
    for (let y = 13; y <= 31; y++) { const hw = y < 18 ? 2 + (y - 13) * 0.3 : 4.6; for (let x = Math.round(6 - hw); x <= Math.round(6 + hw); x++) { const rel = (x - (6 - hw)) / (2 * hw); P.set(x, y, y === 31 && x % 2 ? WIST[2] : rel < 0.3 ? WIST[4] : rel > 0.75 ? WIST[2] : WIST[3]); } }
    P.hline(1, 11, 18, '#ffffff'); P.set(0, 19, '#ffffff'); P.set(12, 19, '#f0ecf4');
    stamp(P, 4, 23, ['##.##', '#####', '.###.', '..#..'], { '#': (i, j) => (j === 0 ? PINK[4] : PINK[3]) });
    // a straw sun hat with a ribbon
    P.ell(15.5, 17, 6, 2.2, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.3 ? STRAW[5] : lit(nx, ny) > -0.3 ? STRAW[4] : STRAW[3]));
    P.ell(15.5, 14.5, 3, 2.6, (x, y, nx, ny) => { if (y <= 16) P.set(x, y, lit(nx, ny) > 0.2 ? STRAW[5] : STRAW[3]); });
    P.hline(13, 18, 16, LILAC[3]); P.set(19, 17, LILAC[3]); P.set(20, 18, LILAC[2]);
    // a quilted oven mitt
    for (let y = 14; y <= 24; y++) for (let x = 23; x <= 28; x++) { if (y > 21 && x === 23) continue; P.set(x, y, (x + y) % 3 === 0 ? PINK[2] : x < 25 ? PINK[4] : PINK[3]); }
    P.set(22, 18, PINK[4]); P.set(22, 19, PINK[3]); P.set(22, 20, PINK[3]); P.hline(23, 28, 24, '#ffffff');
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true });
  });

  def('plant_shelf_c', 1, () => {
    const W = 32, H = 48, P = new Pix(W, H);
    for (let x = 1; x <= 30; x++) { P.set(x, 20, WPAINT[5]); P.set(x, 21, WPAINT[3]); P.set(x, 22, WPAINT[1]); }
    for (const bx of [4, 26]) { P.set(bx, 23, WPAINT[3]); P.set(bx, 24, WPAINT[2]); P.set(bx + 1, 23, WPAINT[2]); }
    // a trailing ivy, a round succulent, a little ceramic bear and a jar of lavender
    lathe(P, 6.5, 19, 5, (j) => [2.4, 2.8, 3, 3, 3.2][j], ['#c4bcd0', '#ddd6e6', '#f0ecf4', '#ffffff']);
    for (const [vx, len] of [[4, 9], [7, 12], [9, 7]]) for (let j = 0; j < len; j++) { const x = vx + Math.round(Math.sin(j * 0.7 + vx) * 0.8), y = 15 + j; P.set(x, y, j % 3 === 0 ? SAGE[5] : SAGE[3]); if (j % 3 === 1) P.set(x + 1, y, SAGE[4]); }
    lathe(P, 15.5, 19, 4, (j) => [2.4, 2.6, 2.6, 2.8][j], TERRA);
    for (const [dx, dy] of [[-2, -1], [0, -2], [2, -1], [-1, 0], [1, 0], [0, -1]]) P.set(15.5 + dx, 15 + dy, dy === -2 ? SAGE[6] : SAGE[4]);
    P.set(15, 14, PINK[4]);
    stamp(P, 19, 13, ['e...e', 'hhhhh', 'hdhdh', '.hhh.', 'bbbbb', 'bbbbb'], { e: '#e8e0f0', h: '#fdfbff', d: '#5a4a6a', b: '#ece6f4' }); P.set(21, 16, PINK[3]);
    lathe(P, 27, 19, 5, (j) => [1.6, 2, 2, 1.8, 1.4][j], ['#8a94b8', '#b8c4dc', '#dce6f4']);
    for (const [lx, ly] of [[26, 12], [27, 10], [28, 12], [27, 13]]) { P.vline(lx, ly, 14, SAGE[3]); P.set(lx, ly - 1, WIST[3]); P.set(lx, ly - 2, WIST[4]); }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true });
  });

  def('monstera_c', 1, () => {
    const W = 16, H = 36, b = H - 1, P = new Pix(W, H);
    const leaf = (cx, cy, rx, ry, ang, k) => {
      P.ell(cx, cy, rx, ry, (x, y, nx, ny) => {
        const rx2 = nx * Math.cos(ang) + ny * Math.sin(ang), ry2 = -nx * Math.sin(ang) + ny * Math.cos(ang);
        if (Math.abs(ry2) < 0.18 && rx2 > -0.6) { P.set(x, y, SAGE[5]); return; }
        if ((Math.abs(ry2) > 0.45 && Math.abs(Math.sin(rx2 * 5 + k)) < 0.22)) return; // the splits
        P.set(x, y, lit(nx, ny) > 0.35 ? LEAF[5] : lit(nx, ny) > -0.2 ? LEAF[4] : LEAF[3]);
      });
    };
    for (const [x0, y0] of [[7, 22], [8, 14], [9, 18], [6, 16]]) P.line(7.5, b - 9, x0, y0, SAGE[2]);
    leaf(4.5, 15, 4.2, 3.4, 0.6, 1); leaf(11, 11, 4.4, 3.4, -0.5, 2); leaf(7.5, 7, 4, 3.4, 0.1, 3); leaf(11.5, 19, 3.6, 2.8, -0.2, 4); leaf(4, 21, 3.4, 2.6, 0.3, 5);
    lathe(P, 7.5, b - 1, 8, (j) => 3.2 + j * 0.22, ['#a8a0b4', '#c8c2d2', '#e6e2ec', '#ffffff']);
    P.hline(4, 11, b - 6, HONEYG[4]);
    P.outline(OUT); P.shadow(9, b, 6, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('lace_rug_c', 1, () => {
    const W = 48, H = 32, P = new Pix(W, H), cx = 23.5, cy = 15.5;
    // a crocheted lace doily: scalloped rim, rings of petals and holes the floor shows through
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x - cx) / 22.5, ny = (y - cy) / 14.5, d = Math.sqrt(nx * nx + ny * ny), a = Math.atan2(ny, nx);
      const rim = 0.93 + 0.05 * Math.cos(a * 18);
      if (d > rim) continue;
      let c = (x + y) % 2 ? '#fbf8fc' : '#f0eaf4';
      const ring = d * 7, rf = ring - Math.floor(ring);
      if (Math.floor(ring) % 2 === 1 && Math.abs(Math.sin(a * (6 + Math.floor(ring) * 3))) > 0.75 && rf > 0.25 && rf < 0.8) continue; // holes
      if (d > rim - 0.06) c = '#e0d8e8';
      if (Math.abs(d - 0.5) < 0.05 || Math.abs(d - 0.22) < 0.05) c = WIST[4];
      if (d < 0.1) c = PINK[4];
      if (d > 0.62 && d < 0.78 && Math.abs(Math.sin(a * 8)) > 0.86) c = WIST[3];
      P.set(x, y, c);
    }
    return sprite({ c: P.canvas(), ax: 24, ay: H - 1, foot: [3, 2], solid: false, flat: true });
  });

  def('peacock_bear_c', 1, () => {
    const W = 32, H = 50, b = H - 1, P = new Pix(W, H), cx = 15.5, R = TEDDY_CREAM;
    // a white wicker peacock chair: the great fan of a back, an hourglass base and a lilac cushion
    for (let y = 1; y <= b - 16; y++) for (let x = 1; x <= 30; x++) {
      const nx = (x - cx) / 14.8, ny = (y - (b - 16)) / (b - 17);
      if (nx * nx + ny * ny > 1) continue;
      const a = Math.atan2(ny, nx), d = Math.sqrt(nx * nx + ny * ny);
      let k = ((Math.round(a * 9) + Math.round(d * 12)) % 2) ? 4 : 3;
      if (d > 0.9) k = lit(nx, ny) > 0 ? 5 : 2; else if (Math.abs(Math.sin(a * 9)) < 0.18) k = 2;
      P.set(x, y, WICKER[k]);
    }
    for (let y = b - 9; y <= b - 1; y++) { const hw = 3 + Math.abs(y - (b - 5)) * 0.9; for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) P.set(x, y, WICKER[((x + y) % 2) ? 4 : 3 - (x > cx + 2 ? 1 : 0)]); }
    for (let x = 4; x <= 27; x++) { P.set(x, b - 12, WICKER[5]); P.set(x, b - 11, WICKER[3]); P.set(x, b - 10, WICKER[1]); }
    P.ell(cx, b - 14, 11, 2.6, (x, y, nx, ny) => P.set(x, y, ny < -0.2 ? LILAC[6] : lit(nx, ny) > 0 ? LILAC[5] : LILAC[4]));
    // Sir Bartholomew, cream and soft, with a lilac bow and his crown
    const fur = (x, y, nx, ny) => { const s2 = lit(nx, ny); P.set(x, y, R[s2 > 0.55 ? 5 : s2 > 0.12 ? 4 : s2 > -0.35 ? 3 : 2]); };
    P.ell(cx, b - 20, 8.5, 7.5, fur);
    P.ell(cx, b - 19, 5, 4.6, (x, y, nx, ny) => P.set(x, y, R[lit(nx, ny) > -0.2 ? 5 : 4]));
    P.ell(cx - 6, b - 14, 3.4, 2.6, fur); P.ell(cx + 6, b - 14, 3.4, 2.6, fur);
    P.ell(cx - 6.4, b - 13.6, 1.8, 1.3, (x, y) => P.set(x, y, '#f4bccc')); P.ell(cx + 6.4, b - 13.6, 1.8, 1.3, (x, y) => P.set(x, y, '#e092aa'));
    P.ell(cx - 8, b - 21, 2.4, 3.4, fur); P.ell(cx + 8, b - 21, 2.4, 3.4, fur);
    P.ell(cx - 6, b - 37, 2.8, 2.8, fur); P.ell(cx + 6, b - 37, 2.8, 2.8, fur);
    P.ell(cx - 6, b - 37, 1.4, 1.4, (x, y) => P.set(x, y, '#f4bccc')); P.ell(cx + 6, b - 37, 1.4, 1.4, (x, y) => P.set(x, y, '#e092aa'));
    P.ell(cx, b - 31, 7.4, 6.2, fur);
    P.ell(cx, b - 28.6, 3.2, 2.2, (x, y, nx, ny) => P.set(x, y, R[lit(nx, ny) > -0.3 ? 5 : 4]));
    P.set(cx - 1, b - 29, '#4a3a4a'); P.set(cx, b - 29, '#4a3a4a'); P.set(cx - 1, b - 30, '#7a6a72');
    P.set(cx - 1, b - 27, '#7a6a72'); P.set(cx, b - 27, '#7a6a72');
    for (const ex of [cx - 3.5, cx + 2.5]) { P.set(ex, b - 32, '#2a1e2a'); P.set(ex, b - 31, '#2a1e2a'); P.set(ex, b - 33, '#ffffff'); }
    P.set(cx - 5.5, b - 28, '#f4a0b4'); P.set(cx + 4.5, b - 28, '#f4a0b4');
    stamp(P, Math.round(cx) - 4, b - 25, ['##.##', '#####', '.#.#.'], { '#': (i, j) => (j === 0 ? WIST[4] : WIST[3]) }); P.set(Math.round(cx) - 2, b - 24, WIST[5]);
    crownTiny(P, Math.round(cx) - 4, b - 41, WIST[3]);
    P.outline(OUT); P.shadow(cx + 1, b, 14, 2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true, fade: true });
  });

  def('bistro_table_c', 1, () => {
    const W = 16, H = 28, b = H - 1, P = new Pix(W, H), R = WPAINT;
    for (let y = b - 9; y <= b - 2; y++) { P.set(7, y, R[4]); P.set(8, y, R[2]); }
    P.line(7, b - 2, 3, b - 1, R[4]); P.line(8, b - 2, 12, b - 1, R[2]); P.set(7, b - 1, R[3]);
    for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI; P.set(Math.round(7.5 + Math.cos(t) * 3), Math.round(b - 6 + Math.sin(t) * 1.5), R[3]); } // a scroll under the top
    const cy = b - 11;
    P.ell(7.5, cy + 1, 7, 3, (x, y) => P.set(x, y, R[2]));
    P.ell(7.5, cy, 7, 3, (x, y, nx, ny) => { let c = lit(nx, ny) > 0.4 ? '#ffffff' : lit(nx, ny) > -0.3 ? '#f2eef6' : '#dcd6e4'; if (Math.abs(noise(x / 3, y / 2, 21) - 0.5) < 0.04) c = '#c8c0d4'; P.set(x, y, c); }); // white marble
    // a teacup and a little vase of lily of the valley
    P.hline(9, 12, cy, '#ffffff'); P.hline(9, 12, cy - 1, '#f4f0f8'); P.set(9, cy - 2, '#ffffff'); P.set(12, cy - 2, '#e8e2ee'); P.hline(10, 11, cy - 2, '#a06a40'); P.set(13, cy - 1, '#e8e2ee'); P.set(10, cy - 1, WIST[3]);
    lathe(P, 4.5, cy, 4, (j) => [1.4, 1.8, 1.6, 1][j], ['#8a94b8', '#b8c4dc', '#dce6f4']);
    for (const [sx, sy] of [[3, cy - 7], [5, cy - 8], [6, cy - 6]]) { P.line(4.5, cy - 4, sx, sy, SAGE[3]); P.set(sx, sy, '#ffffff'); P.set(sx + 1, sy + 1, '#f0f0f8'); }
    P.outline(OUT); P.shadow(9, b, 7, 1.6);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('bistro_chair_c', 2, (v) => {
    const W = 16, H = 26, b = H - 1, R = WPAINT;
    let P = new Pix(W, H);
    // a white iron chair facing right (v0) or left (v1): a heart-loop back and a lilac cushion
    for (let y = b - 18; y <= b - 1; y++) { P.set(3, y, R[5]); P.set(4, y, R[3]); }
    stamp(P, 2, b - 21, ['.##.##.', '#..#..#', '#.....#', '.#...#.', '..#.#..', '...#...'], { '#': (i) => (i < 3 ? R[5] : R[3]) });
    for (let y = b - 11; y <= b - 9; y++) for (let x = 3; x <= 13; x++) P.set(x, y, y === b - 11 ? LILAC[6] : x === 3 ? LILAC[5] : LILAC[4]);
    P.set(7, b - 10, LILAC[3]);
    P.hline(3, 13, b - 8, R[4]); P.hline(3, 13, b - 7, R[2]);
    P.line(12, b - 6, 13, b - 1, R[3]); P.line(9, b - 6, 9, b - 2, R[2]);
    P.outline(OUT); P.shadow(9, b, 6.5, 1.6);
    if (v) P = P.flipX();
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('birdcage_c', 1, () => {
    const W = 16, H = 40, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H), R = WPAINT;
      // a white domed birdcage on a stand, a little yellow canary hopping inside
      P.line(7, b - 1, 3, b, R[3]); P.line(8, b - 1, 12, b, R[2]); P.vline(7, b - 14, b - 1, R[4]); P.vline(8, b - 14, b - 1, R[2]);
      P.hline(2, 13, b - 15, R[5]); P.hline(2, 13, b - 14, R[2]);
      for (let y = 3; y <= b - 16; y++) for (let x = 2; x <= 13; x++) {
        const nx = (x - 7.5) / 6, top = 3 + Math.round((1 - Math.sqrt(Math.max(0, 1 - nx * nx))) * 8);
        if (y < top) continue;
        if (y === top || x === 2 || x === 13 || (x - 2) % 3 === 0 || y === b - 26) P.set(x, y, y === top ? R[5] : x < 8 ? R[4] : R[3]);
      }
      P.set(7, 1, R[4]); P.set(8, 1, R[3]); P.set(7, 2, R[5]); P.set(8, 2, R[3]); P.set(7, 0, HONEYG[4]);
      P.hline(4, 11, b - 21, WOOD[3]);
      const hop = [0, -1, 0, 0][f], bx = f === 3 ? 8 : 6;
      stamp(P, bx, b - 25 + hop, ['.yy.', 'yyyk', 'yYyO', '.yy.'], { y: '#f6d050', Y: '#e0a830', k: '#2a2018', O: '#e8843c' });
      P.set(bx + (f === 3 ? -1 : 4), b - 23 + hop, '#e0a830');
      P.vline(5, b - 33, b - 28, SAGE[3]); P.set(4, b - 31, SAGE[4]); P.set(6, b - 30, SAGE[5]); P.set(5, b - 34, PINK[4]);
      P.outline(OUT); P.shadow(9, b, 6, 1.4);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true }, draw, 4, 3, false, [0, 1, 0, 2, 3, 3, 0, 0]);
  });

  def('wisteria_tree_c', 1, () => {
    const W = 16, H = 40, b = H - 1, P = new Pix(W, H);
    // a potted wisteria standard: a twisted trunk and a crown of cascading blooms
    for (let y = 10; y <= b - 8; y++) { const x = 7 + Math.round(Math.sin(y * 0.5) * 0.8); P.set(x, y, WOOD[4]); P.set(x + 1, y, WOOD[2]); }
    P.ell(7.5, 7, 6, 3.6, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.45 ? SAGE[5] : lit(nx, ny) > -0.1 ? SAGE[4] : SAGE[3]));
    for (const [rx, ry, len, k] of [[2, 7, 9, 0], [4, 8, 12, 1], [6, 9, 8, 0], [9, 9, 11, 1], [11, 8, 13, 0], [13, 7, 9, 1], [7, 5, 6, 0], [3, 5, 6, 1], [12, 5, 6, 0]]) raceme(P, rx, ry, len, k);
    lathe(P, 7.5, b - 1, 7, (j) => 3.4 + j * 0.25, SAGE.slice(1, 6));
    P.hline(4, 11, b - 7, SAGE[5]); P.hline(3, 12, b - 8, SAGE[4]);
    P.outline(OUT); P.shadow(9, b, 6, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('lavender_crate_c', 1, () => {
    const W = 16, H = 24, b = H - 1, P = new Pix(W, H);
    // a white crate of lavender pots and a little watering can
    for (const [x0, h0] of [[3, 8], [7, 10], [11, 7]]) for (let k = 0; k < 4; k++) { const sx = x0 + (k % 2) * 1.5 - 0.5, top = b - 6 - h0 + (k % 3); P.vline(Math.round(sx), top + 3, b - 7, SAGE[3]); for (let j = 0; j < 3; j++) P.set(Math.round(sx), top + j, j === 0 ? WIST[4] : WIST[2 + (j % 2)]); }
    for (let y = b - 7; y <= b - 1; y++) for (let x = 1; x <= 14; x++) P.set(x, y, y === b - 7 ? WPAINT[5] : x === 1 ? WPAINT[5] : x === 14 ? WPAINT[2] : (y === b - 4 ? WPAINT[2] : WPAINT[4]));
    P.outline(OUT); P.shadow(8, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });


  // ================================================================== Amara's study, look B: the Attic Stargazer
  const PINE = ['#3a2214', '#583420', '#784a2c', '#98623a', '#b47c4a', '#cc985e', '#e0b47c'];
  const MUST = ['#4a3010', '#74501a', '#9a7024', '#be9032', '#d8ae4a', '#ecca74', '#f8e2a4']; // her mustard cardigan
  const NAVY = ['#0c1028', '#151c40', '#1e2a5a', '#2a3a76', '#3c5092', '#5a6eae', '#8496c8'];
  function wallAttic(w, h, seed) {
    const P = new Pix(w, h);
    // the gable end: vertical pine boards with knots
    for (let y = 0; y < h - 3; y++) for (let x = 0; x < w; x++) {
      const bx = Math.floor((x + 3) / 7), lx = (x + 3) % 7, t = hash(bx, 0, seed);
      let k = t < 0.25 ? 3 : t < 0.8 ? 4 : 5;
      if (lx === 0) k = 1; else if (lx === 1) k = Math.min(6, k + 1); else if (lx === 6) k--;
      if (noise(x / 1.3 + bx * 5, y / 9, seed + 1) > 0.8) k--;
      P.set(x, y, PINE[clamp(k, 0, 6)]);
    }
    for (let k = 0; k < Math.max(2, w / 40); k++) { const kx = Math.floor(hash(k, 1, seed + 2) * w), ky = 10 + Math.floor(hash(k, 2, seed + 2) * (h - 20)); P.ell(kx, ky, 1.6, 1.1, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny < 0.3 ? PINE[1] : PINE[2])); }
    // the sloping roof in the upper corners: rafters over angled boards, in shadow
    const SL = 0.45, depth = 20;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dl = y + x * SL - depth, dr = y + (w - 1 - x) * SL - depth;
      const d = Math.min(dl, dr);
      if (d >= 3) continue;
      if (d >= 0) { P.set(x, y, d < 1 ? PINE[5] : d < 2 ? PINE[3] : PINE[1]); continue; } // the rafter along the slope
      const along = dl < dr ? Math.floor((y - x * 2.2 + 400) / 6) : Math.floor((y - (w - 1 - x) * 2.2 + 400) / 6);
      const ly = (dl < dr ? (y - x * 2.2 + 400) : (y - (w - 1 - x) * 2.2 + 400)) % 6;
      P.set(x, y, ly < 1 ? PINE[0] : hash(along, dl < dr ? 1 : 2, seed + 3) < 0.4 ? PINE[2] : PINE[1]);
    }
    for (let x = 0; x < w; x++) { P.set(x, h - 3, PINE[5]); P.set(x, h - 2, PINE[3]); P.set(x, h - 1, PINE[1]); P.dark(x, h - 4, 0.15); }
    return P;
  }
  FLOORS.study_b = (w, h, s) => K.plankFloor(w, h, s, { ramp: ['#2c2422', '#463830', '#5e4c3e', '#72604c', '#86725a', '#988468', '#aa9678'], pitch: 8, minLen: 40, maxLen: 110, knots: 0.45, joist: 28, joistNails: 0.35, nail: ['#1a1412', '#a89a88'], wear: 0.64, wearCol: '#d8c4a4' });
  WALLS.study_b = wallAttic;
  IA.WALL_H.study_b = 48;

  def('star_board_b', 1, () => {
    const W = 32, H = 48, P = new Pix(W, H);
    // a cork board: a star chart, cards of equations and runes, a comet's orbit in red string, a cat in a wizard hat
    for (let y = 4; y <= 31; y++) for (let x = 1; x <= 30; x++) {
      const fr = x <= 2 || x >= 29 || y <= 5 || y >= 30;
      P.set(x, y, fr ? (x <= 2 || y <= 5 ? PINE[5] : PINE[2]) : hash(x, y, 81) < 0.12 ? '#8a6a42' : hash(x, y, 82) < 0.1 ? '#c8a476' : '#b08a5a');
    }
    for (let y = 8; y <= 17; y++) for (let x = 4; x <= 13; x++) P.set(x, y, x === 13 || y === 17 ? NAVY[1] : NAVY[2]);
    const st = [[6, 10], [9, 9], [11, 12], [8, 14], [5, 15]];
    for (let k = 0; k + 1 < st.length; k++) P.line(st[k][0], st[k][1], st[k + 1][0], st[k + 1][1], NAVY[4]);
    for (const [x, y] of st) P.set(x, y, '#ffffff');
    for (const [x0, y0, x1, y1] of [[16, 7, 25, 13], [19, 15, 27, 21]]) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) P.set(x, y, x === x1 || y === y1 ? PAPER[2] : PAPER[4]);
    for (const y of [9, 11]) for (let x = 17; x <= 24; x++) if ((x * 3 + y) % 5) P.set(x, y, '#5a6aa8');
    P.set(20, 10, CRIMSON[4]); stampRune(P, 21, 16, 2, '#6a4a8a');
    // the comet's orbit, pinned out in red string
    for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; P.set(Math.round(13 + Math.cos(t) * 9), Math.round(24.5 + Math.sin(t) * 3.4), CRIMSON[4]); }
    P.ell(13, 24.5, 1.4, 1.4, (x, y) => P.set(x, y, GOLD[5])); P.set(13, 24, '#ffffff');
    P.set(5, 23, '#ffffff'); P.set(6, 22, '#c8e0ff'); P.set(7, 22, '#8ab0e8'); P.set(8, 21, '#5a7ab8');
    // the doodle: a cat in a wizard hat on a sticky note
    for (let y = 23; y <= 28; y++) for (let x = 23; x <= 28; x++) P.set(x, y, y === 28 || x === 28 ? '#e8d870' : '#f6ea8a');
    stamp(P, 24, 23, ['..#..', '.###.', '#.#.#', '#####', '.#.#.'], { '#': '#3a3448' }); P.set(25, 23, NAVY[4]);
    // pins
    for (const [x, y, c] of [[8, 8, CRIMSON[4]], [20, 7, MUST[5]], [23, 15, '#5dcf9a'], [4, 24, CRIMSON[4]], [22, 24, CRIMSON[4]], [25, 22, MAGIC[3]]]) { P.set(x, y, c); P.set(x + 1, y + 1, '#2a1a1a'); }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true });
  });

  def('drafting_desk_b', 1, () => {
    const W = 32, H = 42, b = H - 1, R = PINE;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (const lx of [2, 28]) for (let y = b - 12; y <= b - 1; y++) { P.set(lx, y, R[5]); P.set(lx + 1, y, R[2]); }
      P.hline(3, 28, b - 4, R[2]);
      for (let y = b - 12; y <= b - 9; y++) for (let x = 6; x <= 25; x++) P.set(x, y, y === b - 12 ? R[3] : x === 6 ? R[4] : x === 25 ? R[1] : R[3]);
      P.set(15, b - 10, BRASS[5]); P.set(16, b - 10, BRASS[3]);
      for (let x = 1; x <= 30; x++) { P.set(x, b - 15, R[6]); P.set(x, b - 14, R[5]); P.set(x, b - 13, R[2]); }
      // a green-shaded banker's lamp
      P.hline(2, 7, b - 16, BRASS[3]); P.vline(4, b - 21, b - 17, BRASS[4]); P.vline(5, b - 21, b - 17, BRASS[2]);
      for (let j = 0; j < 4; j++) for (let x = 1 + (j === 0 ? 1 : 0); x <= 10 - (j === 0 ? 1 : 0); x++) P.set(x, b - 25 + j, j === 3 ? '#9affc8' : x < 4 ? '#3fae6a' : x > 8 ? '#14502e' : '#1f7a46');
      P.hline(2, 9, b - 26, '#5dcf9a');
      // an open notebook and a mug of pencils
      for (let y = b - 18; y <= b - 16; y++) for (let x = 11; x <= 20; x++) P.set(x, y, x === 15 || x === 16 ? PAPER[1] : y === b - 18 ? PAPER[4] : PAPER[3]);
      for (const x of [12, 13, 14, 17, 18, 19]) if ((x + f) % 3) P.set(x, b - 17, '#5a6aa8');
      lathe(P, 9.5, b - 16, 4, () => 1.6, ['#5a3a6a', '#7a5a8a', '#a07ab0']); P.set(8, b - 21, MUST[5]); P.set(10, b - 22, CRIMSON[4]); P.set(9, b - 20, NAVY[5]);
      // a rack of bubbling flasks ("DO NOT DRINK (again)")
      P.hline(21, 30, b - 16, R[4]); P.hline(21, 30, b - 21, R[4]); P.vline(21, b - 21, b - 16, R[3]); P.vline(30, b - 21, b - 16, R[2]);
      for (const [tx, c] of [[23, 'emerald'], [26, 'violet'], [28, 'amber']]) { P.vline(tx, b - 25, b - 17, GLASS[3]); P.vline(tx, b - 20, b - 17, LIQ[c][2]); P.set(tx, b - 21 - ((f + tx) % 3), LIQ[c][3]); }
      P.ell(17.5, b - 19.5, 2.2, 2.2, (x, y, nx, ny) => P.set(x, y, ny < -0.3 ? GLASS[2] : nx < -0.3 ? LIQ.emerald[2] : LIQ.emerald[1])); P.vline(17, b - 24, b - 22, GLASS[3]);
      P.set(17 + (f % 2), b - 20, LIQ.emerald[3]);
      P.outline(OUT);
      for (let j = 0; j < 4; j++) { const x = 17 + Math.round(Math.sin((j + f) * 0.9)), y = b - 25 - j - (f % 2); if (!P.has(x, y)) P.set(x, y, '#9affc8', (0.5 - j * 0.1) * 255); }
      P.shadow(17, b, 15, 1.6);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(5.5, b - 21, 58, [150, 255, 190], 0.6), L(17.5, b - 19, 24, [93, 255, 160], 0.45, 1)] }, draw, 4, 5);
  });

  def('armillary_b', 1, () => {
    const W = 16, H = 38, b = H - 1, cx = 7.5, cy = 11;
    const draw = (f) => {
      const P = new Pix(W, H);
      // a tall pine tripod with a brass armillary and seven pearl moons
      P.line(7, b - 16, 2, b, PINE[5]); P.line(8, b - 16, 13, b, PINE[2]); P.line(7.5, b - 16, 8, b - 1, PINE[3]);
      for (const fx of [2, 8, 13]) P.set(fx, b, BRASS[3]);
      P.vline(7, cy + 6, b - 15, BRASS[4]); P.vline(8, cy + 6, b - 15, BRASS[2]);
      P.hline(5, 10, b - 15, BRASS[4]); P.hline(6, 9, b - 14, BRASS[2]);
      const ring = (rx, ry, tilt, front, c) => { for (let a = 0; a < 90; a++) { const t = a / 90 * Math.PI * 2; if ((Math.sin(t) > 0) !== front) continue; P.set(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry + Math.cos(t) * tilt), c); } };
      const moons = []; for (let k = 0; k < 7; k++) { const t = (k / 7) * Math.PI * 2 + f * Math.PI / 8; moons.push([cx + Math.cos(t) * 6.5, cy + Math.sin(t) * 2.2 + Math.cos(t) * 1.2, Math.sin(t) > 0]); }
      ring(6.5, 2.2, 1.2, false, BRASS[2]); ring(3.6, 6.4, 0, false, BRASS[2]);
      for (const [x, y, fr] of moons) if (!fr) P.set(Math.round(x), Math.round(y), '#c8c0d8');
      P.ell(cx, cy, 2.2, 2.2, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.4 ? '#fff4c8' : lit(nx, ny) > -0.2 ? GOLD[5] : GOLD[3]));
      ring(6.5, 2.2, 1.2, true, BRASS[4]); ring(3.6, 6.4, 0, true, BRASS[5]);
      for (const [x, y, fr] of moons) if (fr) { P.set(Math.round(x), Math.round(y), '#ffffff'); }
      P.set(cx, cy - 7, BRASS[5]); P.set(cx, cy - 8, GOLD[5]);
      P.outline(OUT); P.shadow(9, b, 6, 1.5);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, 11, 26, [255, 214, 140], 0.45)] }, draw, 4, 3);
  });

  def('big_telescope_b', 1, () => {
    const W = 24, H = 40, b = H - 1, P = new Pix(W, H);
    // a long brass telescope on a pine tripod, tilted up toward the round window
    P.line(12, b - 15, 6, b, PINE[5]); P.line(12, b - 15, 19, b, PINE[2]); P.line(12, b - 15, 13, b - 1, PINE[3]);
    for (const fx of [6, 13, 19]) P.set(fx, b, BRASS[3]);
    P.ell(12, b - 15, 1.6, 1.6, (x, y, nx) => P.set(x, y, nx < 0 ? BRASS[5] : BRASS[3]));
    const A = [16, b - 12], B2 = [5, 2], len = Math.hypot(B2[0] - A[0], B2[1] - A[1]), dx = (B2[0] - A[0]) / len, dy = (B2[1] - A[1]) / len, nx = -dy, ny = dx;
    for (let t = 0; t <= len; t += 0.4) {
      const hw = 1.3 + (t / len) * 1.2 + (t > len - 3 ? 0.6 : 0);
      for (let o = -hw; o <= hw; o += 0.4) {
        const x = Math.round(A[0] + dx * t + nx * o), y = Math.round(A[1] + dy * t + ny * o), rel = o / hw;
        let c = rel < -0.4 ? BRASS[5] : rel < 0.1 ? BRASS[4] : rel < 0.6 ? BRASS[3] : BRASS[2];
        if (Math.round(t) % 8 === 3) c = rel < 0 ? GOLD[5] : GOLD[3];
        P.set(x, y, c);
      }
    }
    P.ell(B2[0] - 0.5, B2[1] - 0.5, 1.8, 1.8, (x, y, nx2, ny2) => P.set(x, y, nx2 + ny2 < -0.2 ? '#c4e6ff' : '#2a3a6a'));
    P.line(13, b - 20, 9, b - 27, BRASS[2]); P.set(8, b - 28, BRASS[4]); // the finder scope
    P.set(17, b - 11, IRON[4]); P.set(18, b - 10, IRON[3]);
    P.outline(OUT); P.shadow(13, b, 8, 1.6);
    return sprite({ c: P.canvas(), ax: 12, ay: b, foot: [1, 1], solid: true });
  });

  def('round_window_b', 1, () => {
    const W = 48, H = 48, cx = 23.5, cy = 18;
    const draw = (f, night) => {
      const P = new Pix(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 16.5) continue;
        if (d > 13.4) { P.set(x, y, d > 15.6 ? PINE[1] : lit((x - cx) / d, (y - cy) / d) > 0 ? PINE[6] : PINE[3]); continue; }
        let c = sky(x, y, 4, 32, night, 91);
        if (night) { const md = Math.hypot(x - 29, y - 12); if (md < 4.4) c = md > 3.6 ? '#c8d4f0' : (x - 29) + (y - 12) > 2 ? '#d6def4' : '#f4f6ff'; }
        if (Math.abs(x - cx) < 0.6 || Math.abs(y - cy) < 0.6) c = PINE[4];
        P.set(x, y, c);
      }
      // glow-in-the-dark star stickers on the glass
      for (const [sx, sy] of [[16, 11], [19, 24], [30, 25], [14, 19]]) { P.set(sx, sy, night ? '#d8ffb0' : '#f6e8a0'); P.set(sx - 1, sy, night ? '#9ae890' : '#e6cc70'); P.set(sx + 1, sy, night ? '#9ae890' : '#e6cc70'); P.set(sx, sy - 1, night ? '#9ae890' : '#e6cc70'); P.set(sx, sy + 1, night ? '#9ae890' : '#e6cc70'); }
      // the deep sill: a stack of books and a tiny cactus in a teacup
      for (let x = 6; x <= 41; x++) { P.set(x, 35, PINE[6]); P.set(x, 36, PINE[4]); P.set(x, 37, PINE[2]); }
      flatBook(P, 9, 34, 7, 2, NAVY.slice(1), true); flatBook(P, 10, 32, 5, 2, MUST.slice(1), false);
      lathe(P, 36.5, 34, 3, (j) => [1.6, 2.4, 2.6][j], ['#a8a0b4', '#d8d2e0', '#ffffff']);
      for (const [px0, py0] of [[36, 30], [37, 29], [36, 31], [35, 31], [37, 31]]) P.set(px0, py0, LEAF[4]); P.set(36, 29, LEAF[5]); P.set(37, 28, PINK[4]);
      P.outline(OUT);
      return P;
    };
    const s = build({ ax: 24, ay: H - 1, foot: [3, 1], solid: true, wall: true, lights: [L(24, 18, 60, [230, 222, 255], 0.5)] }, draw, 1, 0, true);
    s.nLights = [L(24, 18, 60, [150, 170, 255], 0.45)];
    return s;
  });

  def('hammock_b', 1, () => {
    const W = 32, H = 44, b = H - 1, P = new Pix(W, H);
    // a striped canvas hammock slung from the rafters, a patchwork quilt, a pillow and a book left open
    for (let y = 0; y <= b - 14; y++) { P.set(2 + Math.round(y * 0.05), y, '#c8b088'); P.set(29 - Math.round(y * 0.05), y, '#a89068'); }
    const sag = (x) => Math.round(Math.sin(((x - 2) / 27) * Math.PI) * 6);
    const STR = [MUST[4], '#f4ecd8', NAVY[3], '#f4ecd8'];
    for (let x = 3; x <= 28; x++) { const y0 = b - 16 + sag(x); for (let j = 0; j < 5; j++) { const c = STR[Math.floor((x - 3) / 4) % 4]; P.set(x, y0 + j, j === 4 ? mix(c, '#120c1c', 0.35) : j === 0 ? mix(c, '#ffffff', 0.25) : c); } }
    for (let x = 2; x <= 29; x++) P.set(x, b - 17 + sag(x), '#e8d4a8');
    for (let x = 9; x <= 24; x++) { const y0 = b - 15 + sag(x); for (let j = 0; j < 7; j++) { const qx = Math.floor((x - 9) / 4), qy = Math.floor(j / 3), t = (qx + qy) % 3; P.set(x, y0 + j, t === 0 ? MUST[4] : t === 1 ? '#c86a5a' : NAVY[4]); } }
    for (let x = 9; x <= 24; x += 2) P.set(x, b - 8 + sag(x), '#f4ecd8');
    P.ell(6.5, b - 15 + sag(6), 3.2, 2, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? '#fffaf0' : '#e0d6c4'));
    flatBook(P, 16, b - 11 + sag(16), 5, 2, CRIMSON, true);
    P.outline(OUT); P.shadow(16, b, 13, 1.6);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('celestial_globe_b', 1, () => {
    const W = 16, H = 30, b = H - 1, P = new Pix(W, H), cy = b - 17;
    P.line(7, b - 8, 3, b - 1, PINE[5]); P.line(8, b - 8, 12, b - 1, PINE[2]); P.vline(7, b - 9, b - 2, PINE[3]);
    P.ell(7.5, b - 8, 3, 1, (x, y) => P.set(x, y, PINE[4]));
    P.ell(7.5, cy, 5.6, 5.6, (x, y, nx, ny) => { const s2 = lit(nx, ny); let c = s2 > 0.5 ? NAVY[5] : s2 > 0.1 ? NAVY[4] : s2 > -0.35 ? NAVY[3] : NAVY[2]; if (hash(x, y, 33) < 0.1) c = GOLD[5]; P.set(x, y, c); });
    P.line(4, cy - 2, 7, cy - 3, GOLD[4]); P.line(7, cy - 3, 9, cy + 1, GOLD[4]); P.line(9, cy + 1, 11, cy - 1, GOLD[4]);
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; if (Math.cos(t) > -0.2) P.set(Math.round(7.5 + Math.cos(t) * 6.8), Math.round(cy + Math.sin(t) * 6.8), BRASS[Math.sin(t) < 0 ? 5 : 3]); }
    P.outline(OUT); P.shadow(9, b, 6, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('tall_bookcase_b', 1, () => {
    const W = 32, H = 54, b = H - 1, P = new Pix(W, H), R = PINE;
    for (let y = 2; y <= b - 1; y++) { P.set(1, y, R[5]); P.set(2, y, R[4]); P.set(29, y, R[2]); P.set(30, y, R[1]); }
    for (let y = 4; y <= b - 2; y++) for (let x = 3; x <= 28; x++) P.set(x, y, x % 7 === 0 ? R[0] : R[1]);
    for (let x = 1; x <= 30; x++) { P.set(x, 1, R[6]); P.set(x, 2, R[5]); P.set(x, 3, R[3]); }
    const shelves = [14, 26, 38, b - 3];
    shelves.forEach((sy, k) => { if (k < 3) fillBooks(P, 3, k === 1 ? 19 : 28, sy - 1, 9, 2100 + k * 11, false); for (let x = 3; x <= 28; x++) { P.set(x, sy, R[5]); P.set(x, sy + 1, R[3]); } });
    // a jar of glass marbles, a little brass telescope model, a trailing pothos
    for (let j = 0; j < 6; j++) for (let i = 0; i < 5; i++) P.set(22 + i, 25 - j, i === 0 ? GLASS[3] : i === 4 ? GLASS[1] : (hash(i, j, 3) < 0.5 ? [CRIMSON[4], NAVY[5], LEAF[5], MUST[5]][(i + j) % 4] : GLASS[2]));
    P.hline(22, 26, 19, '#8a5a3a');
    flatBook(P, 4, b - 4, 12, 3, NAVY.slice(1), true); flatBook(P, 5, b - 7, 10, 3, MUST.slice(1), true);
    P.line(18, b - 6, 26, b - 9, BRASS[4]); P.line(18, b - 5, 26, b - 8, BRASS[2]); P.set(19, b - 4, PINE[4]); P.set(24, b - 4, PINE[4]);
    lathe(P, 25, 1, 0, () => 0, R);
    for (const [vx, len] of [[24, 14], [26, 10], [28, 18]]) for (let j = 0; j < len; j++) { const x = vx + Math.round(Math.sin(j * 0.6 + vx) * 0.8), y = 0 + j; if (y > 0) { P.set(x, y + 1, j % 3 === 0 ? LEAF[5] : LEAF[3]); if (j % 3 === 1) P.set(x + 1, y + 1, LEAF[4]); } }
    P.outline(OUT); P.shadow(17, b, 15, 1.6);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true, fade: true });
  });

  def('low_shelf_b', 1, () => {
    const W = 48, H = 24, b = H - 1, P = new Pix(W, H), R = PINE;
    for (let y = b - 16; y <= b - 1; y++) for (let x = 1; x <= 46; x++) P.set(x, y, x <= 2 ? R[5] : x >= 45 ? R[1] : R[1]);
    for (let x = 1; x <= 46; x++) { P.set(x, b - 17, R[6]); P.set(x, b - 16, R[4]); P.set(x, b - 8, R[5]); P.set(x, b - 7, R[3]); P.set(x, b - 1, R[3]); }
    for (const dx of [16, 31]) for (let y = b - 15; y <= b - 2; y++) P.set(dx, y, R[3]);
    fillBooks(P, 3, 15, b - 9, 6, 2201, false); fillBooks(P, 18, 30, b - 9, 6, 2202, false); fillBooks(P, 33, 44, b - 9, 6, 2203, false);
    fillBooks(P, 3, 12, b - 2, 5, 2204, false); fillBooks(P, 33, 40, b - 2, 5, 2206, false);
    P.ell(23.5, b - 4, 4, 2.4, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? MUST[5] : MUST[3])); P.set(22, b - 5, MUST[6]); // a ball of yarn tucked away
    // on top: rolled star charts and a little lamp
    for (const [x0, c] of [[4, PAPER[3]], [9, '#c8d8f0'], [6, PAPER[4]]]) { P.hline(x0, x0 + 9, b - 19, c); P.hline(x0, x0 + 9, b - 18, mix(c, '#5a4a3a', 0.3)); P.set(x0 + 9, b - 19, '#8a7a6a'); }
    P.outline(OUT); P.shadow(25, b, 22, 1.5);
    return sprite({ c: P.canvas(), ax: 24, ay: b, foot: [3, 1], solid: true });
  });

  def('star_garland_b', 1, () => {
    const W = 48, H = 48;
    const draw = (f) => {
      const P = new Pix(W, H);
      const wy = (x) => 6 + Math.round(5 * Math.sin(((x % 24) / 24) * Math.PI));
      for (let x = 0; x < W; x++) P.set(x, wy(x), '#2a2018');
      for (const hx of [0, 24, 47]) { P.set(hx, 5, BRASS[4]); P.set(hx, 4, BRASS[2]); }
      for (let k = 0, x = 3; x < W - 3; x += 5, k++) {
        const y = wy(x) + 2, on = (k + f) % 3 !== 0, c = [MUST[5], '#f4ecd8', '#f0a8a0'][k % 3];
        stamp(P, x - 2, y, ['..#..', '#####', '.###.', '.#.#.'], { '#': on ? c : mix(c, '#3a2a1a', 0.35) });
        if (on) P.set(x, y + 1, '#ffffff');
      }
      return P;
    };
    return build({ ax: 24, ay: H - 1, foot: [3, 1], solid: true, wall: true, lights: [L(10, 10, 26, [255, 214, 150], 0.35, 1), L(36, 10, 26, [255, 214, 150], 0.35, 1)] }, draw, 3, 2);
  });

  def('pothos_stool_b', 1, () => {
    const W = 16, H = 32, b = H - 1, P = new Pix(W, H);
    P.line(4, b - 9, 3, b, PINE[5]); P.line(11, b - 9, 12, b, PINE[2]); P.hline(4, 11, b - 4, PINE[3]);
    P.ell(7.5, b - 10, 6, 1.8, (x, y, nx, ny) => P.set(x, y, ny < 0 ? PINE[6] : PINE[3]));
    lathe(P, 7.5, b - 11, 6, (j) => [3, 3.4, 3.6, 3.6, 3.6, 3.8][j], MUST.slice(2, 7));
    P.set(12, b - 14, MUST[4]); P.set(12, b - 13, MUST[3]); P.set(11, b - 15, MUST[4]);
    for (const [vx, len, d] of [[3, 13, -1], [5, 8, 0], [10, 15, 1], [12, 10, 1]]) for (let j = 0; j < len; j++) { const x = vx + Math.round(Math.sin(j * 0.55 + vx) * 0.9) + (j > len / 2 ? d : 0), y = b - 17 + j; P.set(x, y, j % 3 === 0 ? LEAF[5] : LEAF[3]); if (j % 3 === 1) P.set(x + (d >= 0 ? 1 : -1), y, LEAF[4]); }
    for (const [lx, ly] of [[5, b - 20], [8, b - 22], [10, b - 19], [7, b - 18], [4, b - 18], [11, b - 21]]) { P.ell(lx, ly, 1.6, 1.2, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? LEAF[5] : LEAF[3])); }
    P.outline(OUT); P.shadow(9, b, 6, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('moon_rug_b', 1, () => {
    const W = 48, H = 40, P = new Pix(W, H), cx = 23.5, cy = 19.5;
    // a round navy rug: a border of moon phases in gold, a star at its heart
    P.ell(cx, cy, 22.5, 18.5, (x, y, nx, ny) => {
      const d = Math.sqrt(nx * nx + ny * ny);
      let c = d > 0.94 ? MUST[3] : d > 0.9 ? NAVY[1] : d > 0.66 ? NAVY[2] : d > 0.62 ? MUST[4] : NAVY[3];
      if (d <= 0.62 && noise(x / 5, y / 4, 7) > 0.68) c = NAVY[4];
      if (d > 0.94 && (x + y) % 2) c = MUST[2];
      P.set(x, y, c);
    });
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, mx = cx + Math.cos(a) * 17.8, my = cy + Math.sin(a) * 14.6, ph = k / 9; P.ell(mx, my, 1.8, 1.8, (x, y, nx) => P.set(x, y, nx < ph * 2 - 1 ? NAVY[1] : '#f4e2a0')); }
    stamp(P, Math.round(cx) - 3, Math.round(cy) - 3, ['...#...', '...#...', '.#####.', '#######', '.#####.', '...#...', '...#...'], { '#': (i, j) => (i === 3 || j === 3 ? '#fff4c8' : MUST[5]) });
    for (let y = 12; y <= 27; y++) if (y % 2) { P.set(0, y, '#e8dcc0'); P.set(47, y, '#c8bca0'); }
    return sprite({ c: P.canvas(), ax: 24, ay: H - 1, foot: [3, 3], solid: false, flat: true });
  });

  def('mustard_armchair_b', 1, () => {
    const W = 20, H = 28, b = H - 1, P = new Pix(W, H), R = MUST;
    // a mustard velvet armchair facing the room: a rounded tufted back, rolled arms, a navy knitted throw
    for (let y = 3; y <= b - 9; y++) for (let x = 3; x <= 16; x++) {
      const top = 3 + Math.round(Math.pow(Math.abs(x - 9.5) / 6.5, 2) * 3); if (y < top) continue;
      P.set(x, y, y === top ? R[6] : x <= 4 ? R[5] : x >= 15 ? R[2] : R[4]);
    }
    for (const [bx, by] of [[7, 7], [12, 7], [9, 10], [7, 13], [12, 13]]) { P.set(bx, by, R[2]); P.set(bx + 1, by + 1, R[5]); }
    for (let y = b - 12; y <= b - 4; y++) { for (let x = 1; x <= 4; x++) P.set(x, y, y === b - 12 ? R[6] : x === 1 ? R[5] : R[4]); for (let x = 15; x <= 18; x++) P.set(x, y, y === b - 12 ? R[4] : x === 18 ? R[1] : R[3]); }
    P.ell(2.5, b - 12, 1.8, 1.2, (x, y) => P.set(x, y, R[6])); P.ell(16.5, b - 12, 1.8, 1.2, (x, y) => P.set(x, y, R[4]));
    for (let y = b - 9; y <= b - 7; y++) for (let x = 5; x <= 14; x++) P.set(x, y, y === b - 9 ? R[6] : R[5]);
    for (let y = b - 6; y <= b - 3; y++) for (let x = 2; x <= 17; x++) P.set(x, y, y === b - 3 ? R[1] : x <= 3 ? R[4] : x >= 16 ? R[1] : R[3]);
    for (const fx of [3, 16]) { P.set(fx, b - 2, PINE[3]); P.set(fx, b - 1, PINE[2]); }
    for (let y = b - 13; y <= b - 3; y++) for (let x = 13; x <= 18; x++) if (x - 13 < (y - (b - 14)) * 0.8) P.set(x, y, ((x + y) % 2) ? NAVY[4] : NAVY[3]);
    for (let x = 14; x <= 18; x += 2) P.set(x, b - 2, NAVY[5]);
    P.ell(7, b - 12, 2.8, 1.8, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? '#f4ecd8' : '#d8ccb0')); P.set(7, b - 12, CRIMSON[4]);
    P.outline(OUT); P.shadow(11, b, 9, 1.6);
    return sprite({ c: P.canvas(), ax: 10, ay: b, foot: [1, 1], solid: true });
  });

  def('book_stack_b', 2, (v) => {
    const W = 16, H = 22, b = H - 1, P = new Pix(W, H);
    let y = b - 1;
    const books = v ? [[2, 12, 3, NAVY], [3, 10, 2, MUST], [2, 11, 3, CRIMSON], [4, 8, 2, TEALC]] : [[1, 13, 3, CRIMSON], [2, 11, 2, NAVY], [3, 10, 3, MUST], [2, 11, 2, LEAF], [4, 8, 2, PINE]];
    for (const [x0, wd, th, R] of books) { flatBook(P, x0, y, wd, th, R.slice(1), true); y -= th; }
    if (!v) { P.hline(5, 9, y, '#f4ecd8'); lathe(P, 7.5, y, 4, () => 2, ['#c86a5a', '#e08a78', '#f4b0a0']); P.set(10, y - 2, '#e08a78'); P.set(10, y - 1, '#c86a5a'); P.set(7, y - 5, '#ffffff', 120); P.set(8, y - 6, '#ffffff', 90); }
    else { P.line(6, y, 11, y - 3, '#f4ecd8'); P.line(6, y + 1, 11, y - 2, '#d8ccb0'); }
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  // ================================================================== Amara's study, look C: the Delft Blue Study
  const DELFT = ['#0e1a4a', '#1a2c78', '#2a44a4', '#4466c8', '#7090dc', '#a8c0ee', '#d8e4f8'];
  const PLASTER = ['#8a909e', '#aab0bc', '#c8ccd6', '#dfe2e8', '#eef0f4', '#fafbfd'];
  const BIRCH = ['#5a4630', '#7e6646', '#a2865e', '#c2a67a', '#dcc49a', '#efdcba'];
  const LEMON = ['#8a6a10', '#c8a020', '#f0cc3a', '#fae47a'];
  const MOTIF = [ // 5x5 hand-painted tile motifs: star, moon, flower, comet, little ship
    ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'], ['.##..', '#....', '#....', '#....', '.##..'], ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
    ['....#', '...#.', '.##..', '###..', '.#...'], ['..#..', '..##.', '..###', '#####', '.###.'],
  ];
  function delftTile(P, x0, y0, sz, k, seed) { // a glazed white tile with a blue motif and corner sprigs
    for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
      let c = y === sz - 1 || x === sz - 1 ? '#aab0c0' : y === 0 || x === 0 ? '#ffffff' : hash(x0 + x, y0 + y, seed) < 0.06 ? '#e8ecf4' : '#f4f6fa';
      P.set(x0 + x, y0 + y, c);
    }
    const m = MOTIF[((k % MOTIF.length) + MOTIF.length) % MOTIF.length], o = Math.floor((sz - 5) / 2);
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (m[j][i] === '#') P.set(x0 + o + i, y0 + o + j, (i + j) % 3 === 0 ? DELFT[3] : DELFT[2]);
    for (const [cx, cy] of [[1, 1], [sz - 2, 1], [1, sz - 2], [sz - 2, sz - 2]]) P.set(x0 + cx, y0 + cy, DELFT[4]);
  }
  function wallDelft(w, h, seed) {
    const P = new Pix(w, h), rail = h - 21;
    for (let y = 0; y < rail; y++) for (let x = 0; x < w; x++) P.set(x, y, rampAt(PLASTER, 0.72 + fbm(x / 14, y / 10, seed) * 0.24, x, y));
    crown(P, w, 0, PLASTER, false);
    // a painted frieze: moons and stars between two cobalt lines
    for (let x = 0; x < w; x++) { P.set(x, 6, DELFT[2]); P.set(x, 14, DELFT[2]); P.set(x, 7, DELFT[5]); }
    for (let k = 0, x0 = 3; x0 < w - 6; k++, x0 += 12) {
      if (k % 2) stamp(P, x0, 8, ['..#..', '.###.', '#####', '.###.', '..#..'], { '#': (i, j) => (i === 2 || j === 2 ? DELFT[3] : DELFT[4]) });
      else stamp(P, x0, 8, ['.##..', '#....', '#....', '#....', '.##..'], { '#': DELFT[2] });
      P.set(x0 + 8, 11, DELFT[4]);
    }
    // the tiled dado under a cobalt rail
    for (let x = 0; x < w; x++) { P.set(x, rail - 2, DELFT[5]); P.set(x, rail - 1, DELFT[2]); P.set(x, rail, DELFT[1]); P.dark(x, rail + 1, 0.15); }
    for (let ty = rail + 1, r = 0; ty + 8 <= h - 3; ty += 8, r++) for (let tx = -((r * 4) % 8), k = 0; tx < w; tx += 8, k++) delftTile(P, tx, ty, 8, Math.floor(hash(k, r, seed) * 5), seed);
    for (let x = 0; x < w; x++) { P.set(x, h - 3, DELFT[3]); P.set(x, h - 2, DELFT[2]); P.set(x, h - 1, DELFT[1]); }
    return P;
  }
  // octagon-and-cabochon tiles: white glazed octagons with little cobalt diamonds where four meet
  function floorOctagon(w, h, seed) {
    const P = new Pix(w, h), T = 16, C = 3;
    const WT = ['#9aa0ae', '#b8bdc8', '#d2d6de', '#e4e6ec', '#f0f1f5', '#fafbfc'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const lx = ((x % T) + T) % T, ly = ((y % T) + T) % T, cx = Math.min(lx, T - 1 - lx), cy = Math.min(ly, T - 1 - ly);
      let c;
      if (cx + cy < C) { // inside a cabochon: shade it as one little gem
        const vx = Math.round(x / T) * T - 0.5, vy = Math.round(y / T) * T - 0.5, dx = (x - vx) / C, dy = (y - vy) / C, e = Math.abs(dx) + Math.abs(dy);
        c = e > 0.9 ? DELFT[1] : lit(dx, dy) > 0.25 ? DELFT[4] : lit(dx, dy) > -0.25 ? DELFT[3] : DELFT[2];
        if (Math.abs(dx + 0.25) < 0.2 && Math.abs(dy + 0.25) < 0.2) c = DELFT[5];
      } else if (cx + cy === C || lx === 0 || ly === 0) c = '#9ca2b2';
      else {
        const tx = Math.floor(x / T), ty = Math.floor(y / T), t = hash(tx, ty, seed);
        let k = t < 0.2 ? 3 : t > 0.9 ? 5 : 4;
        if (ly === 1 || lx === 1 || cx + cy === C + 1 && (lx < T / 2 && ly < T / 2)) k = 5;
        else if (ly === T - 1 || lx === T - 1 || (cx + cy === C + 1 && (lx >= T / 2 && ly >= T / 2))) k = 2;
        if (Math.abs(noise(x / 7 + tx * 3, y / 4 + ty * 5, seed + 3) - 0.5) < 0.03 && k > 2) k--; // faint veins
        c = WT[k];
      }
      P.set(x, y, c);
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const wv = fbm(x / 30, y / 22, seed + 41); if (wv > 0.68) P.tint(x, y, '#c8ccd8', 0.12); }
    return P;
  }
  FLOORS.study_c = floorOctagon;
  WALLS.study_c = wallDelft;
  IA.WALL_H.study_c = 48;

  def('blackboard_c', 1, () => {
    const W = 32, H = 46, b = H - 1, P = new Pix(W, H), R = BIRCH, CH = '#e8eef8', CY = '#f6e48a', CP = '#f4b8c8';
    // a rolling board on a birch frame, painted cobalt and covered in chalk
    for (const [lx, lt] of [[2, true], [28, false]]) { for (let y = 4; y <= b - 2; y++) { P.set(lx, y, lt ? R[5] : R[3]); P.set(lx + 1, y, lt ? R[3] : R[1]); } P.set(lx, 3, R[5]); P.set(lx + 1, 3, R[4]); }
    for (const cx2 of [3, 29]) { P.ell(cx2, b - 0.5, 1.6, 1.1, (x, y) => P.set(x, y, '#3a3448')); P.set(cx2 - 1, b - 1, '#6a6478'); }
    P.hline(4, 27, b - 7, R[3]); P.hline(4, 27, b - 6, R[1]);
    for (let y = 5; y <= 31; y++) for (let x = 4; x <= 27; x++) { const fr = x === 4 || x === 27 || y === 5 || y === 31; P.set(x, y, fr ? (x === 4 || y === 5 ? R[5] : R[2]) : noise(x / 5, y / 4, 13) > 0.64 ? '#22346a' : '#1a2a5e'); }
    const word = (x, y, n, c) => { for (let i = 0; i < n; i++) if ((i * 7 + y) % 5 !== 0) P.set(x + i, y, c); };
    word(6, 8, 5, CH); P.set(12, 8, CY); word(14, 8, 4, CH); word(6, 10, 3, CH); word(10, 10, 6, CH); word(6, 12, 7, CH);
    for (let a = 0; a < 44; a++) if (a % 2 === 0) { const t = a / 44 * Math.PI * 2; P.set(Math.round(21 + Math.cos(t) * 4.6), Math.round(16 + Math.sin(t) * 2.4), CH); }
    P.set(21, 16, CY); P.set(22, 16, CY); P.set(25, 15, CP); P.set(26, 14, '#ffffff'); P.set(27, 13, CH);
    stampRune(P, 6, 15, 1, CY); stampRune(P, 12, 17, 4, CH);
    word(6, 23, 4, CH); P.line(11, 23, 17, 23, CH); P.set(16, 22, CH); P.set(16, 24, CH); word(6, 26, 8, CH);
    stamp(P, 20, 22, ['..#..', '.###.', '#.#.#', '#####', '.#.#.', '##.##'], { '#': (i, j) => (j < 2 ? CP : CH) }); // the cat in its wizard hat
    for (let x = 3; x <= 28; x++) { P.set(x, 32, R[5]); P.set(x, 33, R[2]); }
    P.hline(7, 9, 31, '#ffffff'); P.hline(12, 13, 31, CY); P.hline(20, 24, 31, '#8a6a50'); P.hline(20, 24, 30, '#3a3a4a');
    P.outline(OUT); P.shadow(17, b, 15, 1.6);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('writing_desk_c', 1, () => {
    const W = 32, H = 40, b = H - 1, R = BIRCH;
    const draw = (f) => {
      const P = new Pix(W, H);
      for (const [lx, lt] of [[2, true], [28, false]]) for (let y = b - 11; y <= b - 1; y++) { const t = y > b - 4 ? 1 : 0; P.set(lx + (lt ? t : 0), y, lt ? R[5] : R[3]); P.set(lx + 1 - (lt ? 0 : t), y, R[2]); }
      for (let y = b - 12; y <= b - 9; y++) for (let x = 2; x <= 29; x++) P.set(x, y, y === b - 12 ? PLASTER[5] : x === 2 ? PLASTER[5] : x === 29 ? PLASTER[2] : PLASTER[4]);
      for (const kx of [9, 22]) { P.set(kx, b - 11, DELFT[3]); P.set(kx + 1, b - 11, DELFT[2]); P.set(kx, b - 10, DELFT[2]); }
      for (let x = 1; x <= 30; x++) { P.set(x, b - 15, R[5]); P.set(x, b - 14, R[4]); P.set(x, b - 13, R[2]); }
      // a blue-and-white ginger-jar lamp
      lathe(P, 5.5, b - 16, 6, (j) => [2.2, 3, 3.4, 3.2, 2.6, 1.6][j], ['#c8ccd8', '#e6e8f0', '#f6f8fc', '#ffffff']);
      for (const [x, y] of [[4, b - 19], [6, b - 18], [5, b - 20], [7, b - 20], [3, b - 18]]) P.set(x, y, DELFT[2]);
      P.vline(5, b - 24, b - 22, BRASS[4]);
      for (let j = 0; j < 5; j++) { const y = b - 29 + j, hw = 2 + j * 0.8; for (let x = Math.round(5.5 - hw); x <= Math.round(5.5 + hw) - 1; x++) { const rel = (x - (5.5 - hw)) / (2 * hw); P.set(x, y, rel < 0.3 ? '#ffffff' : rel < 0.75 ? '#f0f2f8' : '#d4d8e4'); } }
      // an open book with a quill and ink
      for (let y = b - 18; y <= b - 16; y++) for (let x = 10; x <= 19; x++) P.set(x, y, x === 14 || x === 15 ? PAPER[1] : y === b - 18 ? PAPER[4] : PAPER[3]);
      for (const x of [11, 12, 13, 16, 17, 18]) if ((x + f) % 4) P.set(x, b - 17, DELFT[2]);
      lathe(P, 21.5, b - 16, 3, () => 1.6, ['#1a1a2a', '#2a2a40', '#4a4a68']); P.line(21, b - 19, 24, b - 25, '#ffffff'); P.line(22, b - 19, 25, b - 24, '#d8dce8');
      // a rack of flasks, bubbling ("DO NOT DRINK (again)")
      P.hline(24, 30, b - 16, R[4]); P.vline(24, b - 22, b - 16, R[3]); P.vline(30, b - 22, b - 16, R[2]); P.hline(24, 30, b - 21, R[4]);
      for (const [tx, c] of [[26, 'azure'], [28, 'teal']]) { P.vline(tx, b - 26, b - 17, GLASS[3]); P.vline(tx, b - 20, b - 17, LIQ[c][2]); P.set(tx, b - 21 - ((f + tx) % 3), LIQ[c][3]); }
      P.outline(OUT);
      for (let j = 0; j < 3; j++) { const x = 26 + Math.round(Math.sin((j + f) * 1.1)), y = b - 27 - j - (f % 2); if (!P.has(x, y)) P.set(x, y, '#c4e6ff', (0.5 - j * 0.12) * 255); }
      P.shadow(17, b, 15, 1.6);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(5.5, b - 26, 58, [255, 226, 180], 0.7, 1), L(27, b - 19, 18, [110, 170, 255], 0.35, 1)] }, draw, 4, 5);
  });

  def('orrery_c', 1, () => {
    const W = 20, H = 36, b = H - 1, cx = 9.5, cy = 11, R = BIRCH;
    const draw = (f) => {
      const P = new Pix(W, H);
      // a round birch side table carrying a silver orrery with blue-and-white porcelain planets and seven moons
      for (const [x0, x1] of [[6, 4], [13, 15], [9.5, 9.5]]) P.line(x0, b - 10, x1, b - 1, x0 < 9 ? R[5] : x0 > 10 ? R[2] : R[3]);
      ellTop(P, 9.5, b - 12, 7.6, 2.8, ['#2a2018', R[0], R[1], R[2], R[3], R[4], R[5]], 2);
      P.vline(9, cy + 3, b - 14, SILVER[5]); P.vline(10, cy + 3, b - 14, SILVER[3]); P.hline(7, 12, b - 14, SILVER[4]);
      const pl = [[8.4, 2.6, f * Math.PI / 2 + 0.6, 2.2], [5.4, 1.7, -f * Math.PI / 2 + 2.4, 1.6], [3, 1.1, f * Math.PI / 2 + 4.1, 1]];
      const drawPl = (front) => pl.forEach(([rx, ry, t, r]) => {
        if ((Math.sin(t) > 0) !== front) return;
        const px2 = cx + Math.cos(t) * rx, py2 = cy + Math.sin(t) * ry;
        P.line(cx, cy, px2, py2, SILVER[2]);
        P.ell(px2, py2, r, r, (x, y, nx, ny) => P.set(x, y, (x + y) % 2 && r > 1.2 && lit(nx, ny) < 0.4 ? DELFT[3] : lit(nx, ny) > 0.3 ? '#ffffff' : '#dce4f4'));
      });
      const moons = (front) => { for (let k = 0; k < 7; k++) { const t = (k / 7) * Math.PI * 2 - f * Math.PI / 10; if ((Math.sin(t) > 0) !== front) continue; P.set(Math.round(cx + Math.cos(t) * 9.4), Math.round(cy + 0.6 + Math.sin(t) * 3), front ? '#ffffff' : '#a8b0c8'); } };
      for (let a = 0; a < 80; a++) { const t = a / 80 * Math.PI * 2; if (Math.sin(t) < 0) P.set(Math.round(cx + Math.cos(t) * 9.4), Math.round(cy + 0.6 + Math.sin(t) * 3), SILVER[2]); }
      moons(false); drawPl(false);
      P.ell(cx, cy, 2.4, 2.4, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.4 ? '#fff4c8' : lit(nx, ny) > -0.2 ? GOLD[5] : GOLD[3]));
      for (let a = 0; a < 80; a++) { const t = a / 80 * Math.PI * 2; if (Math.sin(t) >= 0) P.set(Math.round(cx + Math.cos(t) * 9.4), Math.round(cy + 0.6 + Math.sin(t) * 3), SILVER[5]); }
      moons(true); drawPl(true);
      P.outline(OUT); P.shadow(10, b, 7, 1.6);
      return P;
    };
    return build({ ax: 10, ay: b, foot: [1, 1], solid: true, lights: [L(9.5, 11, 30, [255, 214, 140], 0.5)] }, draw, 4, 3);
  });

  def('refractor_c', 1, () => {
    const W = 24, H = 42, b = H - 1, P = new Pix(W, H), R = BIRCH;
    // a white-and-brass refractor on a tall birch tripod, tilted up toward the window
    P.line(11, b - 17, 4, b, R[5]); P.line(12, b - 17, 19, b, R[2]); P.line(11.5, b - 17, 12, b - 1, R[3]);
    for (const fx of [4, 12, 19]) P.set(fx, b, BRASS[3]);
    P.ell(11.5, b - 17, 1.7, 1.7, (x, y, nx) => P.set(x, y, nx < 0 ? BRASS[5] : BRASS[3]));
    const A = [7, b - 14], B2 = [21, 2], len = Math.hypot(B2[0] - A[0], B2[1] - A[1]), dx = (B2[0] - A[0]) / len, dy = (B2[1] - A[1]) / len, nx = -dy, ny = dx;
    for (let t = 0; t <= len; t += 0.4) {
      const hw = 1.4 + (t / len) * 1.1 + (t > len - 3 ? 0.6 : 0);
      for (let o = -hw; o <= hw; o += 0.4) {
        const x = Math.round(A[0] + dx * t + nx * o), y = Math.round(A[1] + dy * t + ny * o), rel = o / hw;
        let c = rel > 0.4 ? '#ffffff' : rel > -0.1 ? '#eef0f6' : rel > -0.6 ? '#d0d4e0' : '#a8aebe';
        if (Math.round(t) % 9 === 4 || t > len - 2.5 || t < 1.5) c = rel > 0 ? BRASS[5] : BRASS[3];
        P.set(x, y, c);
      }
    }
    P.ell(B2[0] + 0.4, B2[1] - 0.4, 1.8, 1.8, (x, y, nx2, ny2) => P.set(x, y, nx2 + ny2 < -0.2 ? '#c4e6ff' : '#2a3a6a'));
    P.set(6, b - 13, BRASS[2]); P.set(5, b - 12, IRON[4]);
    P.outline(OUT); P.shadow(12, b, 8, 1.6);
    return sprite({ c: P.canvas(), ax: 12, ay: b, foot: [1, 1], solid: true });
  });

  def('celestial_globe_c', 1, () => {
    const W = 16, H = 36, b = H - 1, P = new Pix(W, H), cy = b - 22, R = BIRCH;
    for (const [x0, x1] of [[7, 3], [8, 12]]) P.line(x0, b - 12, x1, b - 1, x0 < 8 ? R[5] : R[2]);
    P.vline(7, b - 13, b - 2, R[4]); P.vline(8, b - 13, b - 2, R[2]); P.hline(4, 11, b - 6, R[3]);
    P.ell(7.5, b - 13, 3.6, 1.2, (x, y) => P.set(x, y, R[4]));
    P.ell(7.5, cy, 6, 6, (x, y, nx, ny) => { const s2 = lit(nx, ny); P.set(x, y, s2 > 0.5 ? DELFT[4] : s2 > 0.1 ? DELFT[3] : s2 > -0.35 ? DELFT[2] : DELFT[1]); });
    for (const [x0, y0, x1, y1] of [[4, cy - 3, 7, cy - 1], [7, cy - 1, 10, cy - 3], [6, cy + 2, 9, cy + 3], [9, cy + 3, 11, cy + 1]]) P.line(x0, y0, x1, y1, GOLD[4]);
    for (const [x, y] of [[4, cy - 3], [7, cy - 1], [10, cy - 3], [6, cy + 2], [9, cy + 3], [11, cy + 1], [5, cy + 4]]) P.set(x, y, '#fff4c8');
    for (let a = 0; a < 44; a++) { const t = a / 44 * Math.PI * 2; if (Math.cos(t) > -0.3) P.set(Math.round(7.5 + Math.cos(t) * 7.2), Math.round(cy + Math.sin(t) * 7.2), BRASS[Math.sin(t) < 0 ? 5 : 3]); }
    P.set(7, cy - 8, BRASS[5]); P.set(8, cy - 8, BRASS[3]);
    P.outline(OUT); P.shadow(9, b, 6, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('tall_shelf_c', 1, () => {
    const W = 32, H = 54, b = H - 1, P = new Pix(W, H), R = PLASTER;
    for (let y = 2; y <= b - 1; y++) { P.set(1, y, R[5]); P.set(2, y, R[4]); P.set(29, y, R[2]); P.set(30, y, R[1]); }
    for (let y = 4; y <= b - 2; y++) for (let x = 3; x <= 28; x++) P.set(x, y, DELFT[1]);
    for (let x = 1; x <= 30; x++) { P.set(x, 1, R[5]); P.set(x, 2, R[4]); P.set(x, 3, R[2]); }
    const BLUE_BOOKS = [DELFT.slice(1), PLASTER.slice(1), BIRCH.slice(1), DELFT.slice(0, 6), ['#3a2a1a', '#5a4630', '#7e6646', '#a2865e', '#c2a67a', '#dcc49a'], LEMON.concat(['#fff4b0', '#fffad8'])];
    const shelfBooks = (x0, x1, by, maxH, seed) => { let x = x0, k = 0; while (x <= x1) { const wd = 1 + Math.floor(hash(k, 1, seed) * 3), ht = 4 + Math.floor(hash(k, 2, seed) * (maxH - 3)); if (x + wd - 1 > x1) break; spine(P, x, by, wd, Math.min(maxH, ht), BLUE_BOOKS[Math.floor(hash(k, 3, seed) * BLUE_BOOKS.length)], hash(k, 4, seed) < 0.35 ? GOLD[4] : null); x += wd; k++; } };
    const shelves = [15, 27, 39, b - 3];
    shelves.forEach((sy, k) => { if (k === 0) shelfBooks(3, 17, sy - 1, 9, 3101); if (k === 1) shelfBooks(12, 28, sy - 1, 9, 3102); if (k === 2) shelfBooks(3, 28, sy - 1, 9, 3103); for (let x = 3; x <= 28; x++) { P.set(x, sy, R[5]); P.set(x, sy + 1, R[3]); } });
    // a Delft ginger jar, a little blue teapot and a china vase of tulips
    lathe(P, 23, 14, 9, (j) => [2.6, 3.4, 3.8, 3.8, 3.4, 2.8, 2, 2.4, 1.4][j], ['#c8ccd8', '#e6e8f0', '#f6f8fc', '#ffffff']);
    for (const [x, y] of [[22, 11], [24, 10], [23, 8], [21, 9], [25, 12], [22, 13]]) P.set(x, y, DELFT[2]);
    lathe(P, 7, 26, 4, (j) => [2.4, 3, 3, 2.4][j], DELFT.slice(1, 6)); P.set(10, 24, DELFT[3]); P.set(11, 23, DELFT[3]); P.set(3, 24, DELFT[2]); P.set(7, 21, DELFT[4]);
    lathe(P, 15, b - 4, 7, (j) => [1.8, 2.4, 2.6, 2.4, 1.8, 1.4, 1.8][j], ['#c8ccd8', '#e6e8f0', '#f6f8fc', '#ffffff']); P.set(15, b - 7, DELFT[2]); P.set(14, b - 8, DELFT[3]);
    for (const [fx, fy, c] of [[13, b - 13, '#f06a6a'], [15, b - 15, LEMON[2]], [17, b - 13, '#f06a6a']]) { P.line(15, b - 10, fx, fy + 1, LEAF[3]); P.set(fx, fy, c); P.set(fx, fy - 1, c); }
    flatBook(P, 20, b - 4, 8, 2, DELFT.slice(1), true); flatBook(P, 21, b - 6, 6, 2, BIRCH.slice(1), true);
    P.outline(OUT); P.shadow(17, b, 15, 1.6);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true, fade: true });
  });

  def('chaise_c', 1, () => {
    const W = 32, H = 28, b = H - 1, P = new Pix(W, H), R = DELFT;
    // a cobalt velvet chaise longue: a rolled back at one end, a white knitted throw, a star cushion and a book
    for (let y = b - 20; y <= b - 8; y++) for (let x = 1; x <= 9; x++) { const top = b - 20 + Math.round(Math.pow((9 - x) / 8, 2) * 3); if (y < top) continue; P.set(x, y, y === top ? R[5] : x <= 2 ? R[4] : R[3]); }
    P.ell(2.5, b - 13, 2, 4, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? R[5] : R[3]));
    for (let y = b - 11; y <= b - 4; y++) for (let x = 3; x <= 30; x++) { if (x === 30 && y === b - 11) continue; P.set(x, y, y === b - 11 ? R[5] : y <= b - 9 ? R[4] : x >= 29 ? R[1] : y === b - 4 ? R[1] : R[2]); }
    for (const bx of [12, 18, 24]) { P.set(bx, b - 8, R[1]); P.set(bx + 1, b - 9, R[5]); }
    for (const [lx, lt] of [[4, true], [28, false]]) { P.set(lx, b - 3, BIRCH[lt ? 4 : 3]); P.set(lx, b - 2, BIRCH[lt ? 3 : 2]); P.set(lx, b - 1, BIRCH[2]); }
    for (let y = b - 12; y <= b - 3; y++) for (let x = 18; x <= 25; x++) if (y > b - 12 || x % 2) P.set(x, y, ((x + y) % 2) ? '#f4f6fa' : '#dfe3ec');
    for (let x = 18; x <= 25; x += 2) P.set(x, b - 2, '#f4f6fa');
    stamp(P, 5, b - 17, ['..#..', '.###.', '#####', '.#.#.'], { '#': (i, j) => (j < 2 ? LEMON[3] : LEMON[2]) });
    flatBook(P, 10, b - 11, 5, 2, CRIMSON, true);
    P.outline(OUT); P.shadow(17, b, 15, 1.8);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('arch_window_c', 1, () => {
    const W = 32, H = 48;
    const draw = (f, night) => {
      const P = new Pix(W, H);
      const inArch = (x, y, x0, x1, top) => { const r = (x1 - x0 + 1) / 2, ccx = x0 + r - 0.5, ccy = top + r; return x >= x0 && x <= x1 && y >= top && (y >= ccy || Math.hypot(x - ccx, y - ccy) <= r); };
      for (let y = 2; y <= 33; y++) for (let x = 5; x <= 26; x++) if (inArch(x, y, 5, 26, 2)) P.set(x, y, x < 16 ? PLASTER[5] : PLASTER[3]);
      for (let y = 4; y <= 31; y++) for (let x = 7; x <= 24; x++) if (inArch(x, y, 7, 24, 4)) P.set(x, y, (x === 15 || x === 16 || y === 19) ? PLASTER[4] : sky(x, y, 4, 31, night, 97));
      if (night) P.ell(20, 9, 2.2, 2.2, (x, y, nx, ny) => { if (inArch(x, y, 7, 24, 4)) P.set(x, y, nx + ny > 0.5 ? '#c8d4f0' : '#eef2ff'); });
      // a blue-and-white tiled sill
      for (let x = 3; x <= 28; x += 4) delftTile(P, x, 32, 4, x, 5);
      for (let x = 3; x <= 30; x++) { P.set(x, 36, DELFT[2]); P.set(x, 37, DELFT[1]); }
      P.outline(OUT);
      // cobalt curtains with little white stars, tied back
      for (const left of [true, false]) for (let y = 1; y <= 38; y++) {
        const tie = 22, wd = y < tie ? Math.round(3 - (tie - y) * 0.06) : Math.round(2 + Math.min(1, (y - tie) / 10) * 2);
        for (let i = 0; i <= wd; i++) { const x = left ? 1 + i : 30 - i; P.set(x, y, i === wd ? DELFT[1] : (x * 3 + y * 5) % 11 === 0 ? '#ffffff' : (i + (left ? 0 : 1)) % 2 ? DELFT[3] : DELFT[2]); }
        if (y === tie) { const tx = left ? 2 : 29; P.set(tx, y, GOLD[5]); P.set(tx + (left ? 1 : -1), y, GOLD[3]); }
      }
      for (let x = 0; x <= 31; x++) P.set(x, 0, x % 5 === 0 ? BRASS[5] : BRASS[3]);
      return P;
    };
    const s = build({ ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true, lights: [L(16, 18, 52, [226, 232, 255], 0.5)] }, draw, 1, 0, true);
    s.nLights = [L(16, 18, 44, [150, 170, 255], 0.4)];
    return s;
  });

  def('window_seat_c', 1, () => {
    const W = 32, H = 22, b = H - 1, P = new Pix(W, H), R = BIRCH;
    for (let y = b - 9; y <= b - 1; y++) for (let x = 1; x <= 30; x++) P.set(x, y, x <= 2 ? PLASTER[5] : x >= 29 ? PLASTER[2] : y === b - 1 ? PLASTER[2] : (x % 10 === 5 ? PLASTER[3] : PLASTER[4]));
    for (let y = b - 13; y <= b - 10; y++) for (let x = 1; x <= 30; x++) P.set(x, y, y === b - 13 ? '#ffffff' : (Math.floor(x / 3) % 2 ? DELFT[3] : '#f0f2f8'));
    P.ell(6, b - 15, 4, 2.6, (x, y, nx, ny) => P.set(x, y, (x + y) % 3 === 0 ? DELFT[2] : lit(nx, ny) > 0 ? '#ffffff' : '#dfe3ec'));
    P.ell(25, b - 15, 4, 2.6, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? LEMON[3] : LEMON[2]));
    flatBook(P, 13, b - 14, 6, 2, DELFT.slice(1), true);
    P.outline(OUT); P.shadow(17, b, 15, 1.4);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true });
  });

  def('lemon_tree_c', 1, () => {
    const W = 16, H = 36, b = H - 1, P = new Pix(W, H);
    for (let y = 12; y <= b - 9; y++) { P.set(7, y, BIRCH[2]); P.set(8, y, BIRCH[1]); }
    for (const [cx, cy, rx, ry] of [[7.5, 9, 6.4, 5.6], [4, 12, 3, 2.6], [11, 12, 3, 2.6]]) P.ell(cx, cy, rx, ry, (x, y, nx, ny) => { const s2 = lit(nx, ny); let c = s2 > 0.45 ? LEAF[5] : s2 > 0 ? LEAF[4] : s2 > -0.4 ? LEAF[3] : LEAF[2]; if (hash(x, y, 9) < 0.12) c = LEAF[2]; P.set(x, y, c); });
    for (const [lx, ly] of [[4, 8], [9, 6], [11, 11], [6, 12], [3, 13], [10, 9]]) { P.set(lx, ly, LEMON[2]); P.set(lx + 1, ly, LEMON[1]); P.set(lx, ly - 1, LEMON[3]); }
    lathe(P, 7.5, b - 1, 8, (j) => [3, 3.6, 4, 4.2, 4.2, 4, 3.8, 4.4][j], ['#c8ccd8', '#e6e8f0', '#f6f8fc', '#ffffff']);
    for (const [x, y] of [[5, b - 4], [7, b - 3], [9, b - 5], [6, b - 6], [10, b - 3], [4, b - 6]]) P.set(x, y, DELFT[2]);
    P.hline(3, 12, b - 8, DELFT[3]);
    P.outline(OUT); P.shadow(9, b, 6, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('plate_wall_c', 1, () => {
    const W = 32, H = 48, P = new Pix(W, H);
    const plate = (cx, cy, r, k) => {
      P.ell(cx, cy, r, r, (x, y, nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny); P.set(x, y, d > 0.86 ? (lit(nx, ny) > 0 ? '#ffffff' : '#b8bece') : d > 0.78 ? DELFT[2] : lit(nx, ny) > 0.5 ? '#ffffff' : '#f2f4f8'); });
      const m = MOTIF[k]; for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (m[j][i] === '#') P.set(Math.round(cx) - 2 + i, Math.round(cy) - 2 + j, DELFT[2]);
    };
    plate(16, 11, 6.4, 0); plate(7, 22, 5.2, 1); plate(25, 22, 5.2, 4);
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 16, ay: H - 1, foot: [2, 1], solid: true, wall: true });
  });

  def('map_chest_c', 1, () => {
    const W = 16, H = 26, b = H - 1, P = new Pix(W, H), R = BIRCH;
    box(P, 1, b - 13, 14, b - 1, R, 1);
    for (const dy of [b - 11, b - 7, b - 3]) { P.hline(2, 13, dy, R[2]); P.set(7, dy - 2, BRASS[5]); P.set(8, dy - 2, BRASS[3]); }
    for (const [x0, c] of [[2, PAPER[3]], [5, '#c8d8f0'], [3, PAPER[4]]]) { P.hline(x0, x0 + 9, b - 14 - (x0 % 3), c); P.hline(x0, x0 + 9, b - 15 - (x0 % 3), mix(c, '#ffffff', 0.3)); P.set(x0 + 9, b - 14 - (x0 % 3), '#8a7a6a'); }
    P.ell(11.5, b - 18, 1.8, 1.8, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.5 ? BRASS[4] : '#c4e6ff')); P.line(10, b - 16, 8, b - 14, BIRCH[1]);
    P.outline(OUT); P.shadow(8, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('rug_c', 1, () => {
    const W = 64, H = 32, P = new Pix(W, H);
    // a cobalt rug with a white key border and a ring of stars around a white crescent
    for (let y = 1; y < H - 1; y++) for (let x = 2; x < W - 2; x++) {
      const e = Math.min(x - 2, y - 1, W - 3 - x, H - 2 - y);
      let c = e === 0 ? DELFT[1] : e <= 3 ? (((x + y) % 4 < 2) !== (e === 2) ? '#f2f4f8' : DELFT[2]) : e === 4 ? DELFT[5] : DELFT[2];
      if (e > 4 && noise(x / 6, y / 4, 5) > 0.7) c = DELFT[3];
      P.set(x, y, c);
    }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, sx = 31.5 + Math.cos(a) * 15, sy = 15.5 + Math.sin(a) * 6.5; P.set(sx, sy, '#ffffff'); P.set(sx - 1, sy, DELFT[5]); P.set(sx + 1, sy, DELFT[5]); P.set(sx, sy - 1, DELFT[5]); P.set(sx, sy + 1, DELFT[5]); }
    stamp(P, 29, 12, ['.##..', '#....', '#....', '#....', '.##..'], { '#': '#f6f8fc' }); P.set(29, 12, LEMON[3]);
    for (let y = 4; y < H - 4; y++) if (y % 2) { P.set(0, y, '#e8ecf4'); P.set(1, y, '#c8ccd8'); P.set(W - 1, y, '#c8ccd8'); P.set(W - 2, y, '#e8ecf4'); }
    return sprite({ c: P.canvas(), ax: 32, ay: H - 1, foot: [4, 2], solid: false, flat: true });
  });

  def('floor_lamp_c', 1, () => {
    const W = 16, H = 40, b = H - 1, P = new Pix(W, H);
    // a slim brass floor lamp with a pleated white shade
    P.ell(7.5, b - 1, 4, 1.4, (x, y, nx, ny) => P.set(x, y, ny < 0 ? BRASS[5] : BRASS[3]));
    for (let y = 12; y <= b - 2; y++) { P.set(7, y, BRASS[4]); P.set(8, y, BRASS[2]); }
    for (let j = 0; j < 9; j++) { const y = 3 + j, hw = 3 + j * 0.45; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) { const rel = (x - (7.5 - hw)) / (2 * hw); P.set(x, y, (x % 2 === 0) ? (rel < 0.4 ? '#ffffff' : '#e4e8f0') : rel < 0.3 ? '#f4f6fa' : rel < 0.75 ? '#e8ecf4' : '#c8cede'); } }
    P.hline(3, 12, 12, DELFT[2]); P.hline(4, 11, 3, DELFT[2]);
    P.set(7, 13, '#fff4d0'); P.set(8, 13, '#ffe8b0');
    P.outline(OUT); P.shadow(9, b, 5, 1.3);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, 10, 64, [255, 228, 180], 0.75, 1), L(7.5, 14, 18, [255, 240, 210], 0.35)] });
  });

  def('book_pile_c', 1, () => {
    const W = 16, H = 24, b = H - 1, P = new Pix(W, H);
    let y = b - 1;
    for (const [x0, wd, th, R] of [[1, 13, 3, DELFT.slice(1)], [2, 11, 2, PLASTER.slice(1)], [2, 12, 3, BIRCH.slice(1)], [3, 10, 2, DELFT.slice(0, 6)], [4, 8, 2, LEMON.concat(['#fff4b0', '#fffad8'])]]) { flatBook(P, x0, y, wd, th, R, true); y -= th; }
    P.hline(5, 9, y, '#ffffff'); lathe(P, 7.5, y, 3, () => 2, ['#c8ccd8', '#e6e8f0', '#ffffff']); P.set(6, y - 1, DELFT[2]); P.set(8, y - 2, DELFT[2]); P.set(10, y - 2, '#e6e8f0'); P.set(10, y - 1, '#c8ccd8');
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  // ================================================================== rare floors: shared bits
  // a floor kind that also hands the Depths renderer a list of glinting water pixels (js/world/rare.js draws them)
  function withShimmer(P, pts) { const mk = P.canvas; P.canvas = function () { const c = mk.call(this); c.shimmer = pts; return c; }; return P; }
  // irregular blob test: inside an ellipse whose edge wobbles with noise
  const blob = (x, y, b2, seed) => { const nx = (x - b2[0]) / b2[2], ny = (y - b2[1]) / b2[3]; return Math.sqrt(nx * nx + ny * ny) + (noise(x / 9, y / 7, seed) - 0.5) * 0.55; };

  // ================================================================== the Sunken Observatory, look B: the Tidal Observatory
  const SEA = ['#18262e', '#22363e', '#2e4850', '#3c5c62', '#4c7074', '#5e8686', '#74a09c', '#90bab2'];
  const AQUA = ['#08202c', '#0c3442', '#124c5a', '#1a6874', '#288a90', '#40aaa8', '#6cc8c0', '#a8e8dc', '#e4fff8'];
  const VERD = ['#163a34', '#1e5448', '#2a7060', '#3a8c78', '#56a890', '#7cc4a8', '#aee0c8']; // verdigris
  const PEARL = ['#8c8aa8', '#b2b0c8', '#d4d2e4', '#ecebf4', '#ffffff'];
  const CORAL = ['#5a2430', '#8a3a44', '#b85a5a', '#dc8270', '#f4ac90'];
  const TIDE_POOLS = [[176, 46, 46, 17], [48, 170, 40, 17], [292, 106, 32, 22], [110, 18, 16, 8], [236, 190, 18, 10], [300, 30, 18, 10]];
  function floorTidal(w, h, seed) {
    // the observatory's marble grid, drowned: pale sea-marble squares, verdigris seams, pearl stars, cracks and tide pools
    const P = new Pix(w, h), T = 32;
    const MA = ['#4c766e', '#5a867c', '#6a968a', '#7aa698', '#8cb4a6'], MB = ['#34524e', '#3e605a', '#4a6e66', '#567c72', '#628a7e'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const tx = Math.floor(x / T), ty = Math.floor(y / T), lx = x - tx * T, ly = y - ty * T, R = (tx + ty) & 1 ? MB : MA;
      let c = rampAt(R, 0.25 + fbm(x / 12 + tx * 3, y / 12 + ty * 5, seed) * 0.6, x, y);
      const vein = Math.abs(noise(x / 8 + tx * 7, y / 5 + ty * 3, seed + 2) - 0.5);
      if (vein < 0.016) c = R[1]; else if (vein < 0.03 && bay(x, y) < 0.3) c = R[2];
      if (lx === 1 || ly === 1) c = R[4]; else if (lx === T - 1 || ly === T - 1) c = R[0];
      if (lx === 0 || ly === 0) c = noise(x / 6, y / 6, seed + 4) > 0.6 ? VERD[1] : hash(x, y, seed) < 0.08 ? BRASS[3] : VERD[2];
      P.set(x, y, c);
    }
    // cracks across a few tiles, and a couple of tiles lost altogether
    for (let k = 0; k < (w * h) / 5000; k++) {
      let x = Math.floor(hash(k, 1, seed + 5) * w), y = Math.floor(hash(k, 2, seed + 5) * h);
      for (let i = 0; i < 14; i++) { P.set(x, y, '#203634'); P.set(x + 1, y, '#5e8a80'); x += hash(k, i, seed + 6) < 0.5 ? 1 : 0; y += hash(k, i, seed + 7) < 0.6 ? 1 : -1; }
    }
    // pearl stars set where four squares meet
    for (let ty = 0; ty * T <= h; ty++) for (let tx = 0; tx * T <= w; tx++) {
      const sx = tx * T, sy = ty * T;
      for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) P.set(sx + dx, sy + dy, PEARL[2]);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) P.set(sx + dx, sy + dy, PEARL[3]);
      P.set(sx, sy, '#ffffff');
    }
    const shimmer = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let d = 9; for (const b2 of TIDE_POOLS) d = Math.min(d, blob(x, y, b2, seed + 3));
      if (d < 0.86) { // shallow water: deeper toward the middle, stars reflected in it
        const depth = clamp((0.86 - d) / 0.86, 0, 1), caus = noise(x / 6, y / 4, seed + 9);
        let c = rampAt(AQUA, 0.22 + depth * 0.42 + (caus - 0.5) * 0.18, x, y);
        if (hash(x, y, seed + 11) < 0.008) c = AQUA[8];
        P.set(x, y, c);
        if (depth > 0.2 && hash(x, y, seed + 12) < 0.012) shimmer.push(x, y);
      } else if (d < 0.95) P.set(x, y, hash(x, y, seed + 13) < 0.4 ? AQUA[7] : AQUA[5]); // the bright wet rim
      else if (d < 1.14) P.dark(x, y, 0.26); // damp stone
      else if (d < 1.4 && noise(x / 4, y / 4, seed + 14) > 0.55) P.tint(x, y, VERD[3], 0.25); // algae creeping out of the water
    }
    // seaweed strands and little shells on the stone
    for (let k = 0; k < (w * h) / 1400; k++) {
      const x = 4 + Math.floor(hash(k, 1, seed + 15) * (w - 8)), y = 6 + Math.floor(hash(k, 2, seed + 15) * (h - 10));
      let d = 9; for (const b2 of TIDE_POOLS) d = Math.min(d, blob(x, y, b2, seed + 3)); if (d < 1.05) continue;
      if (k % 3) { for (let j = 0; j < 4 + (k % 3); j++) P.set(x + Math.round(Math.sin(j * 0.9 + k) * 0.8), y - j, j % 2 ? VERD[3] : VERD[2]); }
      else { P.set(x, y, PEARL[3]); P.set(x + 1, y, PEARL[2]); P.set(x, y - 1, CORAL[4]); }
    }
    return withShimmer(P, shimmer);
  }
  FLOORS.observatory_b = floorTidal;

  def('orrery_big_b', 1, () => {
    const W = 36, H = 52, b = H - 1, cx = 18, cy = b - 30;
    const draw = (f) => {
      const P = new Pix(W, H);
      // a barnacled stone plinth standing in the shallows
      P.ell(cx, b - 3, 16, 3.6, (x, y, nx, ny) => P.set(x, y, (Math.round(Math.atan2(ny, nx) * 6 + f) & 1) && nx * nx + ny * ny > 0.7 ? AQUA[7] : AQUA[5]));
      for (let y = b - 13; y <= b - 4; y++) for (let x = 7; x <= 28; x++) { const nx = (x - cx) / 11; P.set(x, y, y === b - 13 ? SEA[7] : nx < -0.6 ? SEA[6] : nx > 0.6 ? SEA[3] : SEA[5]); }
      for (const [bx, by] of [[9, b - 6], [12, b - 5], [25, b - 7], [22, b - 5], [27, b - 9]]) { P.set(bx, by, PEARL[3]); P.set(bx + 1, by, PEARL[1]); P.set(bx, by - 1, PEARL[4]); }
      for (let x = 8; x <= 27; x += 3) P.set(x, b - 4, VERD[3]);
      P.ell(cx, b - 14, 6, 1.6, (x, y) => P.set(x, y, VERD[4]));
      for (let y = cy + 4; y <= b - 15; y++) { P.set(cx - 1, y, VERD[5]); P.set(cx, y, VERD[3]); P.set(cx + 1, y, VERD[2]); }
      // verdigris rings, sea-glass planets and seven pearl moons around a glowing moonpearl
      const rings = [[15, 4.4, 0.8], [10.5, 3.2, -1.2], [6.2, 2.2, 0.6]];
      const ring = (rx, ry, tl, front) => { for (let a = 0; a < 150; a++) { const t = a / 150 * Math.PI * 2; if ((Math.sin(t) > 0) !== front) continue; P.set(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry + Math.cos(t) * tl), front ? VERD[5] : VERD[2]); } };
      const pl = [[15, 4.4, 0.8, f * Math.PI / 2 + 0.5, AQUA, 1.8], [10.5, 3.2, -1.2, -f * Math.PI / 2 + 2.1, CORAL, 1.4], [6.2, 2.2, 0.6, f * Math.PI / 2 + 4, VERD, 1.1]];
      const planets = (front) => pl.forEach(([rx, ry, tl, t, C, r]) => { if ((Math.sin(t) > 0) !== front) return; const ppx = cx + Math.cos(t) * rx, ppy = cy + Math.sin(t) * ry + Math.cos(t) * tl; P.line(cx, cy, ppx, ppy, VERD[3]); P.ell(ppx, ppy, r, r, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.3 ? C[C.length - 1] : lit(nx, ny) > -0.3 ? C[C.length - 2] : C[C.length - 3])); });
      const moons = (front) => { for (let k = 0; k < 7; k++) { const t = (k / 7) * Math.PI * 2 + f * Math.PI / 14; if ((Math.sin(t) > 0) !== front) continue; P.set(Math.round(cx + Math.cos(t) * 12.8), Math.round(cy + 0.5 + Math.sin(t) * 3.8 + Math.cos(t) * 0.8), front ? PEARL[4] : PEARL[1]); } };
      rings.forEach(([rx, ry, tl]) => ring(rx, ry, tl, false)); moons(false); planets(false);
      P.ell(cx, cy, 3.6, 3.6, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.5 ? '#ffffff' : lit(nx, ny) > 0 ? PEARL[3] : lit(nx, ny) > -0.5 ? PEARL[2] : PEARL[1]));
      rings.forEach(([rx, ry, tl]) => ring(rx, ry, tl, true)); moons(true); planets(true);
      for (const [sx, sy] of [[6, b - 12], [28, b - 10]]) { stamp(P, sx - 2, sy - 2, ['..#..', '#####', '.###.', '#.#.#'], { '#': CORAL[3] }); P.set(sx, sy - 1, CORAL[4]); }
      P.outline(OUT); P.shadow(cx + 1, b, 16, 2);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 2], solid: true, lights: [L(18, b - 30, 64, [170, 240, 230], 0.65), L(18, b - 4, 40, [90, 210, 200], 0.4)] }, draw, 4, 3);
  });

  def('great_telescope_b', 1, () => {
    const W = 40, H = 40, b = H - 1, P = new Pix(W, H);
    // a great telescope toppled from its mount, lying across the stones, green with verdigris and draped in kelp
    for (let y = b - 9; y <= b - 2; y++) for (let x = 25; x <= 37; x++) { const nx = (x - 31) / 6.5; if (y < b - 9 + Math.abs(nx) * 3) continue; P.set(x, y, y === b - 9 ? SEA[7] : nx < -0.5 ? SEA[6] : SEA[4]); }
    for (const [bx, by] of [[27, b - 4], [33, b - 3], [35, b - 6]]) { P.set(bx, by, PEARL[3]); P.set(bx + 1, by, PEARL[1]); }
    const A = [32, b - 11], B2 = [3, b - 22], len = Math.hypot(B2[0] - A[0], B2[1] - A[1]), dx = (B2[0] - A[0]) / len, dy = (B2[1] - A[1]) / len, nx = -dy, ny = dx;
    for (let t = 0; t <= len; t += 0.4) {
      const hw = 2.4 + (t / len) * 1.8 + (t > len - 4 ? 1 : 0);
      for (let o = -hw; o <= hw; o += 0.4) {
        const x = Math.round(A[0] + dx * t + nx * o), y = Math.round(A[1] + dy * t + ny * o), rel = o / hw;
        let c = rel < -0.5 ? VERD[5] : rel < 0 ? VERD[4] : rel < 0.55 ? VERD[3] : VERD[2];
        if (Math.round(t) % 10 === 5) c = rel < 0 ? BRASS[4] : BRASS[2];
        if (noise(x / 3, y / 3, 61) > 0.72) c = rel < 0 ? BRASS[3] : COPPER[2];
        P.set(x, y, c);
      }
    }
    P.ell(B2[0] + 0.5, B2[1] + 0.5, 3, 3.4, (x, y, nx2, ny2) => P.set(x, y, nx2 * nx2 + ny2 * ny2 > 0.6 ? VERD[2] : nx2 + ny2 < -0.2 ? '#c4f0ff' : '#1e3a5a'));
    for (const [kx, len2] of [[12, 9], [16, 7], [21, 8]]) { const ky = Math.round(A[1] + (B2[1] - A[1]) * ((A[0] - kx) / (A[0] - B2[0]))) - 1; for (let j = 0; j < len2; j++) P.set(kx + Math.round(Math.sin(j * 0.8) * 0.8), ky + j, j % 2 ? VERD[2] : VERD[4]); }
    stamp(P, 23, b - 22, ['..#..', '.###.', '#####', '.#.#.', '#...#'], { '#': (i, j) => (j < 2 ? CORAL[4] : CORAL[3]) });
    P.ell(8, b - 3, 3.6, 2, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? PEARL[3] : PEARL[1])); P.set(7, b - 4, PEARL[4]);
    P.outline(OUT); P.shadow(20, b, 18, 2.2);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 2], solid: true });
  });

  def('blueprint_pedestal_b', 2, (v) => {
    const W = 18, H = 32, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H), cx = 8.5;
      // a barnacled stone column holding a giant clam, its lid thrown open: a glowing blueprint inside (v0) or a pearl (v1)
      for (let y = b - 3; y <= b - 1; y++) for (let x = 3; x <= 14; x++) P.set(x, y, y === b - 3 ? SEA[7] : x <= 4 ? SEA[6] : x >= 13 ? SEA[2] : SEA[5]);
      for (let y = b - 13; y <= b - 4; y++) for (let x = 5; x <= 12; x++) P.set(x, y, SEA[[7, 6, 5, 6, 5, 4, 3, 2][x - 5]]);
      for (const [bx, by] of [[6, b - 6], [10, b - 10], [11, b - 5]]) { P.set(bx, by, PEARL[3]); P.set(bx + 1, by, PEARL[1]); }
      for (let x = 5; x <= 12; x += 2) P.set(x, b - 13, VERD[3]);
      // the open lid: a scallop fan rising from the hinge, its pearly inside toward us, ribs in rose and pearl
      for (let y = b - 30; y <= b - 17; y++) for (let x = 0; x <= 17; x++) {
        const dx = x - cx, dy = (b - 16) - y, r = Math.hypot(dx * 0.95, dy), a = Math.atan2(dy, dx);
        if (dy < 1 || a < 0.16 || a > Math.PI - 0.16) continue;
        const wf = (a - 0.16) / ((Math.PI - 0.32) / 9), wi = Math.floor(wf), wc = wf - wi - 0.5;
        const rim = 12.4 - wc * wc * 5;
        if (r > rim) continue;
        let c = wi % 2 ? '#e4b4cc' : '#fbeaf4';
        if (r > rim - 1.1) c = wi % 2 ? '#a87098' : '#c890b4';
        else if (Math.abs(wc) > 0.4) c = '#c890b4';
        else if (r < 3.5) c = '#f6dcea';
        P.set(x, y, c);
      }
      for (const [ex, d] of [[cx - 4, -1], [cx + 4, 1]]) for (let j = 0; j < 3; j++) P.set(ex + d * j * 0.5, b - 17 - j, '#c890b4');
      // the lower shell: a shallow bowl with a ribbed outer rim
      P.ell(cx, b - 16, 7.4, 2.8, (x, y, nx, ny) => P.set(x, y, ny > 0.35 ? ((Math.round(nx * 7) & 1) ? '#9a7096' : '#b48ab0') : ny > -0.2 ? '#e4c6dc' : '#f4e2ee'));
      if (v === 0) {
        for (let x = 5; x <= 12; x++) { P.set(x, b - 18, '#8ad8ff'); P.set(x, b - 17, x % 3 === 0 ? '#ffffff' : '#4aa8e8'); }
        P.set(4, b - 18, '#e0f6ff'); P.set(13, b - 17, '#2a6a9a'); P.vline(9, b - 19, b - 17, GOLD[4]);
      } else P.ell(cx, b - 17.6, 1.7, 1.5, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.2 ? '#ffffff' : PEARL[2]));
      P.outline(OUT);
      if (v === 0) { const a = f ? 170 : 110; for (const [x, y] of [[3, b - 20], [14, b - 19], [6, b - 22], [11, b - 23]]) if (!P.has(x, y)) P.set(x, y, '#8ad0ff', a); }
      P.shadow(9, b, 6, 1.5);
      return P;
    };
    if (v === 0) return build({ ax: 9, ay: b, foot: [1, 1], solid: true, lights: [L(9, b - 18, 36, [120, 210, 255], 0.65)] }, draw, 2, 2);
    return sprite({ c: draw(0).canvas(), ax: 9, ay: b, foot: [1, 1], solid: true, lights: [L(9, b - 18, 18, [220, 220, 255], 0.35)] });
  });

  def('astrolabe_b', 1, () => {
    const W = 16, H = 32, b = H - 1, P = new Pix(W, H), cy = b - 20;
    // a ship's armillary on a driftwood post, crusted with barnacles
    for (let y = b - 12; y <= b - 1; y++) { P.set(7, y, '#9a8a7a'); P.set(8, y, '#6a5a4c'); } P.hline(5, 10, b - 1, '#7a6a5c'); P.set(9, b - 7, PEARL[3]); P.set(6, b - 4, PEARL[3]);
    P.ell(7.5, cy, 6, 6, (x, y, nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny); if (d > 0.82) P.set(x, y, lit(nx, ny) > 0 ? VERD[5] : VERD[2]); else if (Math.abs(ny) < 0.12 || Math.abs(nx * 0.8 - ny * 0.6) < 0.1) P.set(x, y, VERD[4]); });
    P.ell(7.5, cy, 1.4, 1.4, (x, y) => P.set(x, y, BRASS[4])); P.set(7, cy, GOLD[6]);
    P.set(7, cy - 7, VERD[4]); P.set(8, cy - 7, VERD[2]);
    P.outline(OUT); P.shadow(9, b, 5, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('star_pool_b', 1, () => {
    const W = 48, H = 40, cx = 23.5, cy = 19.5;
    const draw = (f) => {
      const P = new Pix(W, H);
      // a round reflecting pool ringed in sea glass: the sky's constellations shine in the still water
      P.ell(cx, cy, 23, 19, (x, y, nx, ny) => {
        const d = Math.sqrt(nx * nx + ny * ny), a = Math.atan2(ny, nx);
        let c;
        if (d > 0.9) c = (Math.floor((a + Math.PI) / (Math.PI * 2) * 28) % 3 === 0) ? AQUA[6] : (Math.floor((a + Math.PI) / (Math.PI * 2) * 28) % 3 === 1 ? VERD[4] : PEARL[2]);
        else if (d > 0.84) c = SEA[2];
        else { c = rampAt(['#06141e', '#0a1e2c', '#0e2a3a', '#14384a'], 0.2 + (1 - d) * 0.6 + (noise(x / 5, y / 3, 41) - 0.5) * 0.2, x, y); if (Math.abs(d - 0.5 - (f % 4) * 0.08) < 0.03) c = '#1e4a5e'; }
        P.set(x, y, c);
      });
      const cons = [[[12, 12], [16, 9], [20, 11], [19, 15]], [[29, 9], [33, 12], [35, 16], [31, 19], [28, 16]], [[14, 25], [18, 28], [22, 26], [26, 29], [30, 27]]];
      for (const g of cons) { for (let k = 0; k + 1 < g.length; k++) { const [x0, y0] = g[k], [x1, y1] = g[k + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 1; i < n; i++) if (i % 2) P.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), '#3a7a8a'); } g.forEach(([x, y], k) => { const tw = (k + f) % 4 === 0; P.set(x, y, tw ? '#ffffff' : '#c8f4ff'); if (tw) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) P.set(x + ox, y + oy, '#7ad0e0'); }); }
      P.ell(23.5, 19.5, 2.4, 2, (x, y, nx, ny) => P.set(x, y, nx + ny < -0.3 ? PEARL[4] : PEARL[3]));
      return P;
    };
    return build({ ax: 24, ay: H - 1, foot: [3, 3], solid: false, flat: true, lights: [L(24, 20, 50, [110, 220, 230], 0.45)] }, draw, 4, 2);
  });

  def('moon_jelly_b', 2, (v) => {
    const W = 16, H = 26, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H), bob = [0, -1, -1, 0][f], C = v ? ['#6a4a8a', '#9a7ac0', '#c8a8ec', '#f0e2ff'] : ['#2a6a7a', '#4aa0b0', '#8ad8e0', '#e0fcff'];
      // a moon jelly drifting in the damp air, softly glowing
      P.ell(7.5, 8 + bob, 5.4, 3.8, (x, y, nx, ny) => { if (ny > 0.35) return; const d = nx * nx + ny * ny; P.set(x, y, d > 0.7 ? C[1] : lit(nx, ny) > 0.3 ? C[3] : C[2], 220); });
      for (const [rx, ry] of [[-2, -1], [2, -1], [0, -2]]) P.set(7.5 + rx, 8 + bob + ry, C[0], 200);
      for (let k = 0; k < 5; k++) { const tx = 4 + k * 2; for (let j = 0; j < 6 + (k % 2) * 3; j++) P.set(tx + Math.round(Math.sin((j + f + k) * 0.8) * 0.8), 10 + bob + j, C[j % 2 ? 1 : 2], 170 - j * 14); }
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: false, overhead: true, lights: [L(7.5, 8, 30, v ? [200, 160, 255] : [120, 230, 240], 0.55, 1)] }, draw, 4, 2);
  });

  def('kelp_b', 2, (v) => {
    const W = 16, H = 34, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H);
      // tall ribbons of kelp swaying out of a crack in the floor
      for (const [x0, len, ph] of (v ? [[5, 24, 0], [9, 30, 1.4], [11, 18, 2.7]] : [[4, 20, 0.6], [7, 28, 2], [10, 22, 3.3]])) for (let j = 0; j < len; j++) {
        const x = x0 + Math.round(Math.sin(j * 0.35 + ph + f * 0.6) * 1.4 * (j / len)), y = b - 2 - j;
        P.set(x, y, j % 4 === 0 ? VERD[5] : VERD[3]); P.set(x + 1, y, VERD[2]);
        if (j % 6 === 3) P.set(x - 1, y, VERD[4]);
      }
      P.ell(7.5, b - 1, 5, 1.4, (x, y) => P.set(x, y, SEA[2]));
      P.outline(OUT);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true }, draw, 4, 2);
  });

  def('broken_column_b', 2, (v) => {
    const W = 16, H = v ? 40 : 22, b = H - 1, P = new Pix(W, H);
    // a fluted column snapped by the sea (v0 a stump, v1 standing), barnacled and weed-hung
    const top = v ? 6 : b - 12;
    for (let y = top; y <= b - 3; y++) for (let x = 3; x <= 12; x++) { const lx = x - 3; let c = SEA[[7, 6, 7, 5, 6, 4, 5, 3, 4, 2][lx]]; if (y === top && hash(x, 3, v) < 0.6) continue; P.set(x, y, c); }
    for (let x = 2; x <= 13; x++) { P.set(x, b - 2, SEA[6]); P.set(x, b - 1, SEA[3]); }
    for (let x = 3; x <= 12; x++) if (hash(x, 5, v) < 0.5) P.set(x, top + 1, SEA[2]);
    for (const [bx, by] of [[4, b - 5], [10, b - 8], [6, top + 4], [11, b - 4]]) { P.set(bx, by, PEARL[3]); P.set(bx + 1, by, PEARL[1]); }
    for (const [kx, ky, len] of [[5, top + 2, 6], [9, top + 1, 9]]) for (let j = 0; j < len; j++) P.set(kx + Math.round(Math.sin(j * 0.9) * 0.6), ky + j, j % 2 ? VERD[2] : VERD[4]);
    P.outline(OUT); P.shadow(9, b, 6, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, fade: !!v });
  });

  def('soggy_books_b', 1, () => {
    const W = 16, H = 24, b = H - 1, P = new Pix(W, H);
    // a slumped stack of sea-stained books, a starfish asleep on top
    let y = b - 1;
    for (const [x0, wd, th, R] of [[1, 13, 3, TEALC], [2, 11, 3, ['#3a2a3a', '#5a4058', '#7a5a74', '#9a7890', '#b496aa', '#ccb4c2']], [1, 12, 2, VERD], [3, 10, 3, ['#4a3a2a', '#6a543a', '#8a704e', '#a88a62', '#c4a87c', '#dcc49a']]]) { flatBook(P, x0 + ((y % 3) - 1), y, wd, th, R.slice(1), true); y -= th; }
    for (let x = 2; x <= 13; x++) if (hash(x, 1, 7) < 0.5) P.tint(x, b - 5, '#2a6a6a', 0.4);
    stamp(P, 5, y - 4, ['..#..', '#####', '.###.', '#...#'], { '#': (i, j) => (j < 2 ? CORAL[4] : CORAL[3]) });
    P.outline(OUT); P.shadow(9, b, 7, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('shells_b', 2, (v) => {
    const W = 16, H = 12, b = H - 1, P = new Pix(W, H);
    // a scatter of shells and a little coral fan
    if (v) { for (let j = 0; j < 7; j++) for (let i = -j; i <= j; i += 2) P.set(8 + i * 0.6, b - 1 - (7 - j), CORAL[(j + i) % 2 ? 3 : 4]); P.vline(8, b - 3, b - 1, CORAL[2]); }
    else { P.ell(5, b - 2, 2.6, 1.8, (x, y, nx) => P.set(x, y, (Math.round(nx * 4) & 1) ? PEARL[3] : PEARL[2])); P.ell(11, b - 2, 1.8, 1.4, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? CORAL[4] : CORAL[3])); }
    P.set(9, b - 1, PEARL[4]); P.set(3, b, AQUA[6]);
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: false });
  });

  // ================================================================== the Sunken Observatory, look C: the Sunstone Observatory
  const SAND = ['#3e2620', '#5c3a2c', '#7c523c', '#9a6a4c', '#b6865e', '#d0a276', '#e6c094'];
  const RSAND = ['#3e2226', '#5a3434', '#7a4a46', '#985e58', '#b47a6e', '#cc9686'];
  const LAPIS = ['#0c1438', '#162258', '#203278', '#2c4498', '#4460b8', '#6c88d8', '#a0b8f0'];
  function floorSunstone(w, h, seed) {
    const P = new Pix(w, h), cx = w / 2, cy = h / 2, SQ = 0.72;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) / SQ, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), u = (a + Math.PI) / (Math.PI * 2);
      let c;
      if (r < 24) { // the sun: gold and copper rays round a bright heart
        const ray = Math.abs(Math.sin(a * 8)), long = Math.abs(Math.sin(a * 4)) > 0.7;
        if (r < 9) c = rampAt(GOLD, 0.95 - r / 9 * 0.35 + lit(dx / 9, dy / 9) * 0.1, x, y);
        else if (r < 10.2) c = GOLD[3];
        else c = (ray > 0.55 && (long || r < 18)) ? rampAt(GOLD, 0.7 - (r - 10) / 14 * 0.35, x, y) : rampAt(COPPER, 0.35 + noise(x / 4, y / 4, seed) * 0.2, x, y);
        if (r > 23) c = GOLD[2];
      } else if (r < 28) c = r < 25 || r > 27 ? GOLD[3] : (Math.round(u * 48) % 2 ? LAPIS[2] : GOLD[4]);
      else if (r < 42) { // the zodiac: twelve sandstone panels, each with a lapis glyph
        const sec = Math.floor(u * 12), su = u * 12 - sec;
        c = su < 0.03 || su > 0.97 ? GOLD[3] : rampAt(SAND, 0.62 + fbm(x / 8, y / 8, seed + sec) * 0.25, x, y);
        if (r < 29 || r > 41) c = GOLD[2];
      } else if (r < 45) c = r < 43 ? COPPER[4] : COPPER[2];
      else { // rings of sandstone blocks, a sunburst of lapis inlay running through them
        const ring = Math.floor((r - 45) / 16), lr = (r - 45) - ring * 16, n = 10 + ring * 8, bi = Math.floor(u * n + ring * 0.37), bu = u * n + ring * 0.37 - bi;
        const R = ring % 2 ? RSAND : SAND, t = hash(bi, ring, seed + 3);
        let k = t < 0.25 ? 2 : t < 0.85 ? 3 : 4;
        if (lr < 1.2) k = 0; else if (lr < 2.2) k++; else if (lr > 14.8) k--;
        if (bu * (r * Math.PI * 2 / n) < 1.1) k = 0; else if (bu * (r * Math.PI * 2 / n) < 2.1) k++;
        if (noise(x / 4, y / 3, seed + 7 + bi) > 0.8) k--;
        c = R[clamp(k, 0, R.length - 1)];
        if (Math.abs(Math.sin(a * 4)) < 0.012 * (120 / Math.max(40, r)) * 2.2 && lr > 1.2) c = LAPIS[3];
      }
      P.set(x, y, c);
    }
    // glyphs on the zodiac panels
    for (let s2 = 0; s2 < 12; s2++) { const a = ((s2 + 0.5) / 12) * Math.PI * 2 - Math.PI, gx = cx + Math.cos(a) * 35, gy = cy + Math.sin(a) * 35 * SQ; stampRune(P, Math.round(gx - 2), Math.round(gy - 2), s2, LAPIS[3], LAPIS[5]); }
    // dust in the corners and a few worn steps
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const wv = fbm(x / 26, y / 20, seed + 41); if (wv > 0.64) P.tint(x, y, '#f0d8b8', 0.08 + (bay(x, y) < (wv - 0.64) * 4 ? 0.05 : 0)); }
    return P;
  }
  FLOORS.observatory_c = floorSunstone;

  def('orrery_big_c', 1, () => {
    const W = 36, H = 54, b = H - 1, cx = 18, cy = b - 31;
    const draw = (f) => {
      const P = new Pix(W, H);
      // a terracotta drum with a carved band, a copper armillary round an ember sun, gold and lapis planets
      for (let y = b - 12; y <= b - 2; y++) for (let x = 5; x <= 30; x++) { const nx = (x - cx) / 13; P.set(x, y, y === b - 12 ? TERRA[4] : nx < -0.6 ? TERRA[4] : nx > 0.6 ? TERRA[1] : y > b - 6 && y < b - 3 ? (x % 4 === 0 ? GOLD[2] : GOLD[3]) : TERRA[3]); }
      P.ell(cx, b - 12, 13, 2.6, (x, y, nx, ny) => P.set(x, y, ny < 0 ? TERRA[4] : TERRA[3]));
      P.ell(cx, b - 1.5, 13, 1.6, (x, y) => P.set(x, y, TERRA[1]));
      for (let y = cy + 5; y <= b - 13; y++) { P.set(cx - 1, y, COPPER[5]); P.set(cx, y, COPPER[3]); P.set(cx + 1, y, COPPER[2]); }
      const rings = [[15.5, 4.6, 1], [11, 3.2, -1.4], [6.8, 2.2, 0.7]];
      const ring = (rx, ry, tl, front) => { for (let a = 0; a < 150; a++) { const t = a / 150 * Math.PI * 2; if ((Math.sin(t) > 0) !== front) continue; P.set(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry + Math.cos(t) * tl), front ? COPPER[5] : COPPER[2]); } };
      const pl = [[15.5, 4.6, 1, f * Math.PI / 2 + 0.3, LAPIS, 1.8], [11, 3.2, -1.4, -f * Math.PI / 2 + 2.2, GOLD, 1.5], [6.8, 2.2, 0.7, f * Math.PI / 2 + 4.2, RSAND, 1.1]];
      const planets = (front) => pl.forEach(([rx, ry, tl, t, C, r]) => { if ((Math.sin(t) > 0) !== front) return; const ppx = cx + Math.cos(t) * rx, ppy = cy + Math.sin(t) * ry + Math.cos(t) * tl; P.line(cx, cy, ppx, ppy, COPPER[3]); P.ell(ppx, ppy, r, r, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.3 ? C[C.length - 1] : lit(nx, ny) > -0.3 ? C[C.length - 2] : C[C.length - 3])); });
      rings.forEach(([rx, ry, tl]) => ring(rx, ry, tl, false)); planets(false);
      // the ember sun with a flickering corona
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + f * 0.13, len2 = 5.4 + ((k + f) % 3) * 0.8; for (let t2 = 4; t2 < len2; t2 += 0.6) P.set(Math.round(cx + Math.cos(a) * t2), Math.round(cy + Math.sin(a) * t2), t2 > len2 - 1 ? ORANGE : AMBER); }
      P.ell(cx, cy, 4.2, 4.2, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.5 ? '#fff8e0' : lit(nx, ny) > 0 ? '#ffe08a' : lit(nx, ny) > -0.5 ? AMBER : ORANGE));
      rings.forEach(([rx, ry, tl]) => ring(rx, ry, tl, true)); planets(true);
      P.outline(OUT); P.shadow(cx + 1, b, 15, 2);
      return P;
    };
    return build({ ax: 16, ay: b, foot: [2, 2], solid: true, lights: [L(18, b - 31, 74, [255, 168, 90], 0.8, 1), L(18, b - 31, 24, [255, 236, 190], 0.5)] }, draw, 4, 4);
  });

  def('great_telescope_c', 1, () => {
    const W = 36, H = 58, b = H - 1, P = new Pix(W, H);
    // a long bronze telescope banded in lapis, on a stepped sandstone mount carved with a sun
    for (let y = b - 8; y <= b - 1; y++) for (let x = 3; x <= 32; x++) P.set(x, y, y === b - 8 ? SAND[6] : x <= 5 ? SAND[5] : x >= 30 ? SAND[2] : y === b - 1 ? SAND[2] : SAND[4]);
    for (let y = b - 15; y <= b - 9; y++) for (let x = 8; x <= 27; x++) P.set(x, y, y === b - 15 ? SAND[6] : x <= 9 ? SAND[5] : x >= 26 ? SAND[2] : SAND[4]);
    P.ell(18, b - 4.5, 3, 2.4, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.5 ? GOLD[3] : GOLD[5]));
    for (const yx of [13, 22]) for (let y = b - 24; y <= b - 16; y++) { P.set(yx, y, COPPER[4]); P.set(yx + 1, y, COPPER[2]); }
    const A = [9, b - 19], B2 = [30, 4], len = Math.hypot(B2[0] - A[0], B2[1] - A[1]), dx = (B2[0] - A[0]) / len, dy = (B2[1] - A[1]) / len, nx = -dy, ny = dx;
    for (let t = 0; t <= len; t += 0.4) {
      const hw = 2.2 + (t / len) * 1.3 + (t > len - 4 ? 0.8 : 0);
      for (let o = -hw; o <= hw; o += 0.4) {
        const x = Math.round(A[0] + dx * t + nx * o), y = Math.round(A[1] + dy * t + ny * o), rel = o / hw;
        let c = rel > 0.5 ? COPPER[5] : rel > 0 ? COPPER[4] : rel > -0.55 ? COPPER[3] : COPPER[2];
        if (Math.round(t) % 9 === 4) c = rel > 0 ? LAPIS[5] : LAPIS[3];
        P.set(x, y, c);
      }
    }
    P.ell(B2[0] + 0.5, B2[1] - 0.5, 2.2, 2.2, (x, y, nx2, ny2) => P.set(x, y, nx2 + ny2 < -0.2 ? '#ffe8c0' : '#5a2a1a'));
    P.ell(18, b - 22, 2, 2, (x, y, nx2) => P.set(x, y, nx2 < 0 ? GOLD[5] : GOLD[3]));
    P.outline(OUT); P.shadow(18, b, 16, 2.4);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 2], solid: true, fade: true });
  });

  def('blueprint_pedestal_c', 2, (v) => {
    const W = 16, H = 32, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H);
      // a sandstone pillar with a lapis band, crowned by a gold sun cradle holding a blueprint (v0) or nothing (v1)
      for (let y = b - 3; y <= b - 1; y++) for (let x = 2; x <= 13; x++) P.set(x, y, y === b - 3 ? SAND[6] : x <= 3 ? SAND[5] : x >= 12 ? SAND[2] : SAND[4]);
      for (let y = b - 15; y <= b - 4; y++) for (let x = 4; x <= 11; x++) P.set(x, y, y > b - 10 && y < b - 7 ? LAPIS[[5, 4, 4, 3, 3, 2, 2, 1][x - 4]] : SAND[[6, 5, 5, 4, 4, 3, 3, 2][x - 4]]);
      for (let y = b - 17; y <= b - 16; y++) for (let x = 3; x <= 12; x++) P.set(x, y, y === b - 17 ? SAND[6] : SAND[3]);
      for (let k = 0; k < 7; k++) { const a = Math.PI + (k / 6) * Math.PI; for (let t = 4; t <= 6.5; t += 0.7) P.set(Math.round(7.5 + Math.cos(a) * t), Math.round(b - 18 + Math.sin(a) * t * 0.7), GOLD[t > 5.5 ? 5 : 4]); }
      P.ell(7.5, b - 18.5, 4, 1.6, (x, y, nx, ny) => P.set(x, y, ny < 0 ? GOLD[5] : GOLD[3]));
      if (v === 0) {
        for (let x = 4; x <= 11; x++) { P.set(x, b - 20, '#8ac8ff'); P.set(x, b - 19, x % 3 === 0 ? '#ffffff' : '#4a8ae8'); }
        P.set(3, b - 20, '#e0f0ff'); P.set(12, b - 19, '#2a4a9a'); P.vline(8, b - 21, b - 19, GOLD[6]);
      }
      P.outline(OUT);
      if (v === 0) { const a = f ? 170 : 110; for (const [x, y] of [[2, b - 22], [13, b - 21], [6, b - 24], [10, b - 24]]) if (!P.has(x, y)) P.set(x, y, '#8ad0ff', a); }
      P.shadow(9, b, 6, 1.5);
      return P;
    };
    if (v === 0) return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(8, b - 19, 36, [120, 200, 255], 0.6)] }, draw, 2, 2);
    return sprite({ c: draw(0).canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('astrolabe_c', 1, () => {
    const W = 16, H = 34, b = H - 1, P = new Pix(W, H), cy = b - 22;
    // a gold astrolabe, its rete pierced with star points, raised on a lapis column
    for (let y = b - 3; y <= b - 1; y++) for (let x = 3; x <= 12; x++) P.set(x, y, y === b - 3 ? SAND[6] : x <= 4 ? SAND[5] : x >= 11 ? SAND[2] : SAND[4]);
    for (let y = b - 14; y <= b - 4; y++) for (let x = 6; x <= 9; x++) P.set(x, y, LAPIS[[5, 4, 3, 2][x - 6]]);
    P.hline(5, 10, b - 15, GOLD[4]); P.hline(5, 10, b - 14, GOLD[2]);
    P.ell(7.5, cy, 6.4, 6.4, (x, y, nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny), a = Math.atan2(ny, nx); let c = d > 0.85 ? (Math.round(a * 12 / Math.PI) % 2 ? GOLD[5] : GOLD[4]) : d > 0.76 ? GOLD[2] : LAPIS[2]; if (d < 0.76 && Math.abs(Math.hypot(nx - 0.15, ny + 0.2) - 0.45) < 0.09) c = GOLD[5]; if (d < 0.76 && Math.abs(nx * 0.7 + ny * 0.7) < 0.07) c = GOLD[4]; P.set(x, y, c); });
    for (const [sx, sy] of [[5, cy - 2], [10, cy + 1], [8, cy + 3], [4, cy + 2]]) P.set(sx, sy, '#fff4c8');
    P.set(7, cy, GOLD[6]); P.set(8, cy, GOLD[4]);
    P.ell(7.5, cy - 7.6, 1.4, 1.2, (x, y, nx, ny) => { if (nx * nx + ny * ny > 0.3) P.set(x, y, GOLD[4]); });
    P.outline(OUT); P.shadow(9, b, 5, 1.4);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('brazier_c', 1, () => {
    const W = 16, H = 32, b = H - 1;
    const draw = (f) => {
      const P = new Pix(W, H);
      // a copper brazier on three legs, its fire low and steady
      P.line(5, b - 9, 2, b, COPPER[4]); P.line(10, b - 9, 13, b, COPPER[2]); P.line(7.5, b - 9, 7.5, b - 1, COPPER[3]);
      P.ell(7.5, b - 11, 6, 2.6, (x, y, nx, ny) => P.set(x, y, ny > 0.2 ? COPPER[2] : lit(nx, ny) > 0.2 ? COPPER[5] : COPPER[3]));
      for (let x = 2; x <= 13; x++) P.set(x, b - 12, x < 5 ? COPPER[5] : COPPER[4]);
      for (let k = 0; k < 4; k++) { const fx = 4 + k * 2 + (k > 1 ? 1 : 0); flame(P, fx, b - 13, (f + k) % 4, 'ember', k === 1 || k === 2 ? 2 : 1); }
      P.ell(7.5, b - 12.4, 4.4, 1, (x, y) => P.set(x, y, (x + f) % 2 ? '#ffbc62' : '#e8843c'));
      P.outline(OUT);
      for (let j = 0; j < 3; j++) { const x = 7 + Math.round(Math.sin((j + f) * 1.1)), y = b - 21 - j * 2 - (f % 2); if (!P.has(x, y)) P.set(x, y, '#ffd890', 140 - j * 40); }
      P.shadow(9, b, 6, 1.5);
      return P;
    };
    return build({ ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(7.5, b - 15, 64, [255, 160, 80], 0.85, 1)] }, draw, 4, 7);
  });

  def('obelisk_c', 1, () => {
    const W = 16, H = 46, b = H - 1, P = new Pix(W, H);
    // a sandstone obelisk cut with lapis glyphs, capped in gold
    for (let y = b - 4; y <= b - 1; y++) for (let x = 2; x <= 13; x++) P.set(x, y, y === b - 4 ? SAND[6] : x <= 3 ? SAND[5] : x >= 12 ? SAND[2] : SAND[4]);
    for (let y = 8; y <= b - 5; y++) { const hw = 3.2 + (y - 8) / (b - 13) * 1.4; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) { const rel = (x - (7.5 - hw)) / (2 * hw); P.set(x, y, SAND[rel < 0.25 ? 6 : rel < 0.55 ? 5 : rel < 0.8 ? 4 : 3]); } }
    for (let j = 0; j < 5; j++) { const hw = 3.2 * (j + 1) / 5; for (let x = Math.round(7.5 - hw); x <= Math.round(7.5 + hw) - 1; x++) P.set(x, 3 + j, x < 7.5 ? GOLD[5] : GOLD[3]); }
    P.set(7, 2, GOLD[6]);
    for (let k = 0; k < 4; k++) stampRune(P, 5, 12 + k * 7, k * 2 + 1, LAPIS[3], LAPIS[5]);
    P.outline(OUT); P.shadow(9, b, 6, 1.6);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, fade: true });
  });

  def('scroll_rack_c', 1, () => {
    const W = 16, H = 30, b = H - 1, P = new Pix(W, H), R = WOOD;
    // a cedar rack of pigeonholes stuffed with star scrolls
    for (let y = 3; y <= b - 1; y++) for (let x = 1; x <= 14; x++) P.set(x, y, x <= 2 ? R[4] : x >= 13 ? R[1] : R[0]);
    for (let x = 1; x <= 14; x++) { P.set(x, 2, R[5]); P.set(x, 3, R[3]); }
    for (const sy of [10, 17, 24]) for (let x = 3; x <= 12; x++) { P.set(x, sy, R[4]); P.set(x, sy + 1, R[2]); }
    P.vline(7, 4, b - 2, R[3]); P.vline(8, 4, b - 2, R[1]);
    for (const [x0, y0] of [[3, 9], [9, 9], [3, 16], [9, 16], [3, 23], [9, 23], [4, 28], [10, 28]]) {
      for (const dx of [0, 2]) { const c = (x0 + y0 + dx) % 3 === 0 ? '#c8d8f0' : PAPER[3 + ((x0 + dx) % 2)]; P.ell(x0 + dx + 0.5, y0 - 1.5, 1.2, 1.2, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny < 0.3 ? '#8a7a6a' : c)); }
    }
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  def('urn_c', 2, (v) => {
    const W = 16, H = v ? 32 : 26, b = H - 1, P = new Pix(W, H);
    // a terracotta urn painted with a little sun (v1 holds dried star-flowers)
    lathe(P, 7.5, b - 1, 14, (j) => [2.4, 3.6, 4.4, 5, 5.2, 5.2, 5, 4.6, 4, 3.2, 2.4, 2, 2.4, 3][j], TERRA);
    P.hline(4, 11, b - 14, TERRA[4]);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; P.set(Math.round(7.5 + Math.cos(a) * 2.6), Math.round(b - 7 + Math.sin(a) * 2.2), GOLD[4]); }
    P.ell(7.5, b - 7, 1.4, 1.2, (x, y) => P.set(x, y, GOLD[5]));
    if (v) for (const [dx, h0] of [[-3, 12], [-1, 15], [1, 13], [3, 11]]) { P.line(7.5, b - 14, 7.5 + dx, b - 14 - h0, '#8a7a5a'); stamp(P, Math.round(7.5 + dx) - 1, b - 15 - h0, ['.#.', '#c#', '.#.'], { '#': '#e8d8a8', c: GOLD[4] }); }
    P.outline(OUT); P.shadow(9, b, 6, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true });
  });

  // ================================================================== the Crystal Garden: shared bits
  // a crystal flower's colours follow the gem it gives (rare.js: v0 amethyst, v1 emerald, v2 quartz)
  const GEMC = [['#3a1e6a', '#5a3494', '#8058c4', '#ac8ae6', '#d4c0fa', '#f4ecff'], ['#0c4a30', '#167a4c', '#2aa86a', '#5ad696', '#a4f2c8', '#e8fff2'], ['#6a5a6a', '#9c8a9c', '#cabccc', '#e8dce8', '#f8f0f8', '#ffffff']];
  const GEM_RGB = [[190, 150, 255], [100, 240, 170], [240, 220, 250]];
  const MOSS = ['#14261c', '#1c3626', '#264a30', '#305e3a', '#3e7446', '#508a54', '#68a464'];
  // a faceted crystal point from (x, by) up `h` px, w wide at the base, lit on its left face
  function shard(P, x, by, h, w, C, lean) {
    for (let j = 0; j < h; j++) {
      const t = j / h, hw = Math.max(0.5, (w / 2) * (1 - t * t * 0.9)), cx = x + (lean || 0) * t * h * 0.3;
      for (let i = Math.round(cx - hw); i <= Math.round(cx + hw) - (hw > 1 ? 1 : 0); i++) { const rel = (i + 0.5 - (cx - hw)) / (2 * hw); P.set(i, by - j, C[clamp(rel < 0.35 ? C.length - 2 : rel < 0.6 ? C.length - 3 : C.length - 4, 0, C.length - 1)]); }
    }
    P.set(Math.round(x + (lean || 0) * h * 0.3), by - h, C[C.length - 1]);
  }

  // ================================================================== the Crystal Garden, look B: the Rose Quartz Hollow
  const ROSEROCK = ['#2a161e', '#3e222a', '#543036', '#6a4044', '#805254', '#966664', '#ac7c78'];
  const RQ = ['#6a2a4a', '#9a4a6a', '#c87090', '#e89ab4', '#f8c4d4', '#ffe8f0'];
  const PEACH = ['#6a3020', '#a4523a', '#d6805a', '#f2aa80', '#ffd2b0', '#fff0e0'];
  function floorRoseHollow(w, h, seed) {
    const P = new Pix(w, h);
    // big smooth rosy stones worn round, soft moss pooling between them, rose quartz sprouting here and there
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx0 = Math.floor(x / 26), gy0 = Math.floor(y / 19);
      let d1 = 1e9, d2 = 1e9, best = 0, dx1 = 0, dy1 = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const gx = gx0 + i, gy = gy0 + j, ox = gx * 26 + 4 + hash(gx, gy, seed) * 18, oy = gy * 19 + 3 + hash(gx, gy, seed + 1) * 13;
        const d = Math.hypot((x - ox) * 0.78, y - oy);
        if (d < d1) { d2 = d1; d1 = d; best = hash(gx, gy, seed + 2); dx1 = x - ox; dy1 = y - oy; } else if (d < d2) d2 = d;
      }
      const moss = fbm(x / 26, y / 18, seed + 5), gap = d2 - d1;
      let c;
      if (gap < 1.4) c = moss > 0.44 ? MOSS[3] : ROSEROCK[2];
      else if (gap < 4.5 && moss > 0.46) c = rampAt(MOSS, 0.34 + (moss - 0.46) * 1.6 + noise(x / 3, y / 3, seed + 6) * 0.15, x, y);
      else {
        const sh = clamp(0.55 + lit(dx1 / 14, dy1 / 10) * 0.3 - (gap < 3 ? 0.08 : 0), 0, 1);
        c = rampAt(ROSEROCK, 0.36 + best * 0.14 + sh * 0.38 + (noise(x / 6, y / 6, seed + 3) - 0.5) * 0.1, x, y);
        if (moss > 0.64) c = rampAt(MOSS, 0.4 + (moss - 0.64) * 2 + noise(x / 3, y / 3, seed + 6) * 0.15, x, y);
      }
      P.set(x, y, c);
    }
    // clover flowers in the moss and glints of quartz in the stone
    for (let k = 0; k < (w * h) / 240; k++) {
      const x = Math.floor(hash(k, 1, seed + 7) * w), y = Math.floor(hash(k, 2, seed + 7) * h);
      if (fbm(x / 26, y / 18, seed + 5) > 0.55) { P.set(x, y, k % 3 ? '#fff4f8' : '#f8c4d4'); P.set(x + 1, y + 1, MOSS[5]); }
      else if (k % 4 === 0) P.set(x, y, k % 2 ? RQ[5] : '#ffffff');
    }
    for (let k = 0; k < (w * h) / 700; k++) {
      const x = 3 + Math.floor(hash(k, 1, seed + 9) * (w - 6)), y = 6 + Math.floor(hash(k, 2, seed + 9) * (h - 7)), C = k % 3 ? RQ : PEACH;
      for (const [dx, hh] of [[-1, 2], [0, 4], [1, 3]]) for (let j = 0; j < hh; j++) P.set(x + dx, y - j, j === hh - 1 ? C[5] : dx < 0 ? C[4] : dx > 0 ? C[2] : C[3]);
      P.set(x - 1, y + 1, ROSEROCK[1]); P.set(x, y + 1, ROSEROCK[1]); P.set(x + 1, y + 1, ROSEROCK[1]);
    }
    return P;
  }
  FLOORS.crystal_b = floorRoseHollow;

  def('fairy_fountain_b', 1, () => {
    const W = 40, H = 52, b = H - 1, cx = 19.5, hy = b - 10;
    const WT = ['#7a2a5a', '#b04a7a', '#e078a0', '#f8a8c4', '#ffd8e6', '#fff4f8'];
    const heart = (x, y, sc) => { const u = (x + 0.5 - cx) / (18 * sc), v = (y + 0.5 - hy) / (11 * sc), X = u * 1.15, Y = -v * 1.3 + 0.28; return Math.pow(X * X + Y * Y - 1, 3) - X * X * Y * Y * Y < 0; };
    const draw = (f) => {
      const P = new Pix(W, H);
      // a heart-shaped spring carved from rose quartz, brimming with warm pink water
      for (let y = hy - 14; y <= b; y++) for (let x = 0; x < W; x++) {
        if (!heart(x, y, 1)) continue;
        if (!heart(x, y, 0.8)) { const lt = !heart(x - 1, y - 1, 1); P.set(x, y, lt ? RQ[5] : !heart(x + 1, y + 1, 1) ? RQ[1] : y > hy + 3 ? RQ[2] : x < cx ? RQ[4] : RQ[3]); continue; }
        const d = Math.hypot((x - cx) / 14, (y - hy) / 7);
        let c = rampAt(WT, 0.3 + (1 - Math.min(1, d)) * 0.5, x, y);
        if (Math.abs(d * 4 - (f % 4) - 0.5) < 0.22) c = WT[5];
        P.set(x, y, c);
      }
      for (let y = hy - 14; y <= b; y++) for (let x = 0; x < W; x++) if (heart(x, y, 1) && !heart(x, y + 1, 1)) { P.set(x, y + 1, RQ[0]); }
      // a little crystal fairy on a pedestal, holding up a shell that trickles into the spring
      for (let y = hy - 4; y <= hy + 1; y++) for (let x = Math.round(cx - 3); x <= Math.round(cx + 2); x++) P.set(x, y, y === hy - 4 ? '#ffffff' : x < cx ? '#f0e8f0' : '#cfc4d6');
      for (const d of [-1, 1]) { shard(P, cx + d * 4.5, hy - 12, 9, 4, RQ, d * 1.1); shard(P, cx + d * 3.5, hy - 9, 6, 3, RQ, d * 1.4); }
      for (let y = hy - 18; y <= hy - 5; y++) { const hw = y > hy - 9 ? 2.4 : 1.5; for (let x = Math.round(cx - hw); x <= Math.round(cx + hw) - 1; x++) P.set(x, y, x < cx - 0.5 ? '#ffffff' : '#e2d8e8'); }
      P.ell(cx, hy - 20, 2.2, 2.2, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0 ? '#ffffff' : '#e2d8e8'));
      P.ell(cx, hy - 22.4, 2.4, 0.9, (x, y) => P.set(x, y, GOLD[5]));
      P.line(cx - 2, hy - 16, cx - 5, hy - 25, '#f0e8f4'); P.ell(cx - 5.5, hy - 27, 3.2, 1.8, (x, y, nx) => P.set(x, y, (Math.round(nx * 5) & 1) ? '#fff0f6' : '#ecc8da'));
      for (let k = 0; k < 4; k++) { const y = hy - 25 + ((f * 4 + k * 6) % 24); if (y < hy) P.set(cx - 8 + (k % 2), y, '#ffe8f4'); }
      P.outline(OUT);
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + f * 0.5, r = 11 + (k % 2) * 5; const x = Math.round(cx + Math.cos(a) * r), y = Math.round(hy - 18 + Math.sin(a) * r * 0.45); if (!P.has(x, y)) P.set(x, y, k % 2 ? '#ffd0e8' : '#ffffff'); }
      P.shadow(cx + 1, b, 18, 2);
      return P;
    };
    return build({ ax: 18, ay: b, foot: [2, 2], solid: true, lights: [L(19.5, b - 10, 72, [255, 150, 200], 0.75), L(19.5, b - 30, 30, [255, 220, 240], 0.45, 1)] }, draw, 4, 4);
  });

  def('crystal_flower_b', 3, (v) => {
    const W = 16, H = 26, b = H - 1, P = new Pix(W, H), C = GEMC[v], fy = b - 15;
    // a crystal rose: faceted petals cupped round a bright heart, on a stem with two leaves
    for (const [sx, sy] of [[4, b], [11, b], [8, b]]) P.ell(sx, sy - 1, 2.2, 1.1, (x, y, nx) => P.set(x, y, nx < 0 ? ROSEROCK[4] : ROSEROCK[2]));
    for (let y = fy + 3; y <= b - 2; y++) { const x = Math.round(8 + Math.sin((y - fy) * 0.3) * 0.7); P.set(x, y, LEAF[4]); P.set(x + 1, y, LEAF[2]); }
    stamp(P, 4, b - 9, ['..#', '.##', '###'], { '#': (i) => (i < 1 ? LEAF[5] : LEAF[3]) }); stamp(P, 10, b - 11, ['#..', '##.', '###'], { '#': (i) => (i > 1 ? LEAF[2] : LEAF[4]) });
    // outer petals, then inner, then the bud
    for (const [px0, py0, rx, ry, k] of [[5.5, fy + 1, 3, 2.6, 2], [10.5, fy + 1, 3, 2.6, 1], [8, fy + 2.4, 3.6, 2.2, 2], [6.6, fy - 1, 2.4, 2.4, 3], [9.6, fy - 1, 2.4, 2.4, 2], [8, fy - 2.2, 2, 2, 4]]) P.ell(px0, py0, rx, ry, (x, y, nx, ny) => P.set(x, y, C[clamp(k + (lit(nx, ny) > 0.3 ? 1 : lit(nx, ny) < -0.4 ? -1 : 0), 0, 5)]));
    P.set(8, fy - 2, C[5]); P.set(7, fy - 3, '#ffffff');
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(8, fy, 30, GEM_RGB[v], 0.6)] });
  });

  def('glow_puff_b', 2, (v) => {
    const W = 16, H = 16, b = H - 1, P = new Pix(W, H), C = v ? ['#7a4a6a', '#b07aa0', '#e4b0d4', '#fce0f2', '#ffffff'] : PEACH.slice(1);
    // round glowing puffballs, freckled
    for (const [x, y, r] of [[5, b - 4, 3.4], [10.5, b - 3, 2.6], [8.5, b - 7.5, 2.4], [3, b - 1.6, 1.6]]) {
      P.ell(x, y, r, r * 0.9, (xx, yy, nx, ny) => P.set(xx, yy, C[lit(nx, ny) > 0.5 ? 4 : lit(nx, ny) > 0 ? 3 : lit(nx, ny) > -0.5 ? 2 : 1]));
      P.set(Math.round(x + r * 0.3), Math.round(y + r * 0.2), C[1]); P.set(Math.round(x - r * 0.4), Math.round(y - r * 0.4), '#ffffff');
    }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: false, lights: [L(7, b - 5, 28, v ? [240, 170, 230] : [255, 180, 130], 0.55)] });
  });

  def('quartz_cluster_b', 2, (v) => {
    const W = 16, H = 32, b = H - 1, P = new Pix(W, H), C = v ? PEACH : RQ;
    // a cluster of quartz points rising from a rosy rock
    P.ell(8, b - 2, 6.6, 2.6, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.3 ? ROSEROCK[5] : lit(nx, ny) > -0.3 ? ROSEROCK[4] : ROSEROCK[2]));
    shard(P, 4, b - 3, 12, 4, C, -0.8); shard(P, 12, b - 3, 10, 4, C, 0.9); shard(P, 8, b - 3, 22, 6, C, 0.1); shard(P, 6, b - 2, 8, 3, C, -0.3); shard(P, 10.5, b - 2, 7, 3, C, 0.5);
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(8, b - 14, 36, v ? [255, 190, 150] : [255, 160, 200], 0.55)] });
  });

  def('geode_b', 1, () => {
    const W = 16, H = 20, b = H - 1, P = new Pix(W, H);
    // a round stone cracked open, pink crystals glittering inside
    P.ell(8, b - 7, 7, 6.4, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.4 ? ROSEROCK[6] : lit(nx, ny) > -0.1 ? ROSEROCK[5] : ROSEROCK[3]));
    P.ell(8.4, b - 6.6, 4.6, 4, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.7 ? '#f4ece8' : (Math.round(Math.atan2(ny, nx) * 4) & 1) ? RQ[4] : RQ[2]));
    P.ell(8.4, b - 6.6, 2, 1.8, (x, y) => P.set(x, y, RQ[1])); P.set(7, b - 8, '#ffffff'); P.set(10, b - 5, RQ[5]);
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(8, b - 7, 22, [255, 160, 200], 0.4)] });
  });

  // ================================================================== the Crystal Garden, look C: the Emerald Grotto
  const STREAM = [[184, 70], [160, 92], [134, 118], [112, 140], [86, 160], [62, 186], [40, 224]];
  function floorEmerald(w, h, seed) {
    const P = new Pix(w, h), shimmer = [];
    const STONE2 = ['#323c38', '#46524c', '#5a6862', '#6e7c74', '#849088', '#9ca69c'];
    // a deep moss carpet, soft and even, with old round stones peeping through and a brook running from the spring
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const m = fbm(x / 24, y / 18, seed);
      let c = rampAt(MOSS, 0.3 + m * 0.5 + (noise(x / 3.5, y / 3, seed + 3) - 0.5) * 0.12, x, y);
      if (noise(x / 10, y / 8, seed + 12) > 0.74) c = rampAt(MOSS, 0.62 + (noise(x / 2, y / 2, seed + 13) - 0.5) * 0.2, x, y); // brighter tufts
      P.set(x, y, c);
    }
    for (let k = 0; k < (w * h) / 2600; k++) {
      const sx = 8 + hash(k, 1, seed + 20) * (w - 16), sy = 8 + hash(k, 2, seed + 20) * (h - 16), rx = 4 + hash(k, 3, seed + 20) * 5, ry = rx * 0.7;
      P.ell(sx, sy, rx, ry, (x, y, nx, ny) => { const d = nx * nx + ny * ny; P.set(x, y, d > 0.72 ? (ny < 0.1 ? MOSS[5] : STONE2[1]) : rampAt(STONE2, 0.4 + lit(nx, ny) * 0.45, x, y)); });
      P.set(Math.round(sx - rx * 0.4), Math.round(sy - ry * 0.5), STONE2[5]); P.set(Math.round(sx - rx * 0.4) + 1, Math.round(sy - ry * 0.5), STONE2[4]);
    }
    // the brook
    const segD = (x, y) => { let d = 1e9; for (let k = 0; k + 1 < STREAM.length; k++) { const [x0, y0] = STREAM[k], [x1, y1] = STREAM[k + 1], vx = x1 - x0, vy = y1 - y0, t = clamp(((x - x0) * vx + (y - y0) * vy) / (vx * vx + vy * vy), 0, 1); d = Math.min(d, Math.hypot(x - x0 - vx * t, y - y0 - vy * t)); } return d; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = segD(x, y) + (noise(x / 6, y / 6, seed + 4) - 0.5) * 2.5, wd = 4.2;
      if (d < wd) { const t = 1 - d / wd; let c = rampAt(['#06221e', '#0a3430', '#104842', '#18605a', '#2a8078', '#52aaa0'], 0.25 + t * 0.55 + (noise(x / 4, y / 3, seed + 5) - 0.5) * 0.2, x, y); if (hash(x, y, seed + 6) < 0.01) c = '#c8fff0'; P.set(x, y, c); if (t > 0.3 && hash(x, y, seed + 7) < 0.03) shimmer.push(x, y); }
      else if (d < wd + 1.2) P.set(x, y, hash(x, y, seed + 8) < 0.5 ? '#3a4e48' : '#2a3a36');
    }
    // tiny star flowers, gold buttercups, emerald glints and fallen leaves
    for (let k = 0; k < (w * h) / 220; k++) {
      const x = Math.floor(hash(k, 1, seed + 9) * w), y = Math.floor(hash(k, 2, seed + 9) * h);
      if (segD(x, y) < 6) continue;
      const t = k % 7;
      if (t < 3) { P.set(x, y, '#f4fff8'); P.set(x - 1, y, '#c8e8d8'); P.set(x + 1, y, '#c8e8d8'); P.set(x, y - 1, '#c8e8d8'); }
      else if (t < 5) { P.set(x, y, '#f6d04a'); P.set(x + 1, y, '#c89a2a'); }
      else if (t < 6) { P.set(x, y, EMER[3]); P.set(x, y - 1, EMER[4]); P.set(x + 1, y, EMER[1]); }
      else { P.set(x, y, '#8a6a2a'); P.set(x + 1, y, '#6a4a1e'); }
    }
    return withShimmer(P, shimmer);
  }
  FLOORS.crystal_c = floorEmerald;

  def('fairy_fountain_c', 1, () => {
    const W = 42, H = 52, b = H - 1, cx = 20.5;
    const WT = ['#06302a', '#0c4a40', '#14665a', '#228a78', '#40b09a', '#80dcc4', '#d4fff0'];
    const ROCK = ['#1a2226', '#262f34', '#353f44', '#455054', '#566264', '#6a7674', '#7e8a86'];
    const draw = (f) => {
      const P = new Pix(W, H);
      // mossy boulders heaped round a cleft; a little waterfall spills into a stone-ringed pool
      const boulder = (bx, by, rx, ry) => P.ell(bx, by, rx, ry, (x, y, nx, ny) => { let c = rampAt(ROCK, 0.3 + lit(nx, ny) * 0.45 + noise(x / 3, y / 3, 5) * 0.15, x, y); if (ny < -0.35 + noise(x / 3, 1, 7) * 0.3) c = rampAt(MOSS, 0.45 + lit(nx, ny) * 0.35 + noise(x / 2, y / 2, 8) * 0.15, x, y); P.set(x, y, c); });
      boulder(cx - 10, b - 22, 9, 8); boulder(cx + 10, b - 21, 9.5, 8.5); boulder(cx - 4, b - 30, 7, 6.5); boulder(cx + 5, b - 31, 7.5, 6.5); boulder(cx + 15, b - 14, 5, 4.4); boulder(cx - 16, b - 13, 4.6, 4);
      // the cleft and the falling water
      for (let y = b - 33; y <= b - 13; y++) for (let x = Math.round(cx - 2); x <= Math.round(cx + 1); x++) { const k = ((y * 2 - f * 3 + x * 3) % 6 + 6) % 6; P.set(x, y, k < 2 ? WT[6] : k < 4 ? WT[5] : WT[4]); }
      for (let y = b - 34; y <= b - 13; y++) { P.set(Math.round(cx - 3), y, ROCK[1]); P.set(Math.round(cx + 2), y, ROCK[2]); }
      // the pool
      P.ell(cx, b - 7, 18.5, 6.6, (x, y, nx, ny) => P.set(x, y, nx * nx + ny * ny > 0.74 ? (lit(nx, ny) > 0 ? ROCK[5] : ROCK[3]) : ROCK[1]));
      P.ell(cx, b - 7.4, 15.5, 5, (x, y, nx, ny) => { const d = Math.sqrt(nx * nx + ny * ny); let c = rampAt(WT, 0.25 + (1 - d) * 0.55, x, y); if (Math.abs(d * 4 - (f % 4) - 0.3) < 0.22) c = WT[6]; P.set(x, y, c); });
      for (const [rx, ry, rr] of [[cx - 16, b - 6, 3], [cx + 16, b - 7, 3.4], [cx - 9, b - 2, 2.6], [cx + 9, b - 2, 2.8], [cx + 1, b - 1, 2.4]]) P.ell(rx, ry, rr, rr * 0.7, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.3 ? ROCK[5] : lit(nx, ny) > -0.3 ? ROCK[4] : ROCK[2]));
      for (let k = 0; k < 5; k++) { const sx = Math.round(cx - 4 + ((k * 3 + f * 2) % 9)), sy = b - 11 - ((k + f) % 3); P.set(sx, sy, '#e8fff8'); }
      // emeralds and glowing fern tips on the stones
      shard(P, cx - 12, b - 26, 9, 4, GEMC[1], -0.8); shard(P, cx - 9, b - 25, 6, 3, GEMC[1], -0.2); shard(P, cx + 13, b - 24, 8, 4, GEMC[1], 0.9); shard(P, cx + 7, b - 35, 5, 3, GEMC[1], 0.4);
      for (const [fx, fy, d] of [[cx + 9, b - 36, 1], [cx - 7, b - 35, -1], [cx + 16, b - 26, 1], [cx - 16, b - 24, -1]]) for (let t = 0; t < 8; t++) { P.set(fx + d * t * 0.7, fy - Math.sin(t / 8 * Math.PI) * 3 + t * 0.4, t > 6 ? '#b4ffd0' : LEAF[4]); if (t > 1 && t < 7 && t % 2) P.set(fx + d * t * 0.7, fy - Math.sin(t / 8 * Math.PI) * 3 + t * 0.4 - 1, LEAF[5]); }
      P.outline(OUT);
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + f * 0.6, r = 11 + (k % 2) * 6; const x = Math.round(cx + Math.cos(a) * r), y = Math.round(b - 26 + Math.sin(a) * r * 0.45); if (!P.has(x, y)) P.set(x, y, k % 2 ? '#c8ffe0' : '#ffffff'); }
      P.shadow(cx + 1, b, 19, 2);
      return P;
    };
    return build({ ax: 20, ay: b, foot: [2, 2], solid: true, lights: [L(20.5, b - 8, 72, [90, 240, 190], 0.72), L(20.5, b - 26, 34, [190, 255, 230], 0.45, 1)] }, draw, 4, 5);
  });

  def('crystal_flower_c', 3, (v) => {
    const W = 16, H = 30, b = H - 1, P = new Pix(W, H), C = GEMC[v];
    // a crystal bellflower: an arching stem hung with three glassy bells
    for (const [sx, sy] of [[4, b], [11, b], [8, b]]) P.ell(sx, sy - 1, 2.2, 1.1, (x, y, nx) => P.set(x, y, nx < 0 ? MOSS[5] : MOSS[3]));
    const stem = []; for (let t = 0; t <= 1.0001; t += 0.04) { const x = 5 + Math.sin(t * 2.4) * 6, y = b - 2 - Math.sin(t * Math.PI * 0.62) * 20; stem.push([x, y]); P.set(x, y, LEAF[4]); P.set(x + 1, y, LEAF[2]); }
    stamp(P, 2, b - 7, ['..#', '.##', '###'], { '#': (i) => (i < 1 ? LEAF[5] : LEAF[3]) });
    for (const [ti, r] of [[0.42, 2.4], [0.7, 2.8], [0.96, 2.2]]) {
      const [bx, by] = stem[Math.round(ti * (stem.length - 1))];
      P.vline(Math.round(bx), Math.round(by), Math.round(by) + 1, LEAF[3]);
      const top = Math.round(by) + 2;
      for (let j = 0; j < Math.round(r * 2); j++) { const hw = r * (0.5 + j / (r * 2) * 0.6); for (let x = Math.round(bx - hw); x <= Math.round(bx + hw) - 1; x++) { const rel = (x + 0.5 - (bx - hw)) / (2 * hw); P.set(x, top + j, C[j === Math.round(r * 2) - 1 ? 2 : rel < 0.35 ? 5 : rel < 0.65 ? 4 : 3]); } }
      P.set(Math.round(bx), top + Math.round(r * 2), C[5]);
    }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(9, b - 14, 32, GEM_RGB[v], 0.6)] });
  });

  def('glowcap_c', 2, (v) => {
    const W = 16, H = 16, b = H - 1, P = new Pix(W, H), C = v ? ['#6a3a0a', '#a8641a', '#e09a30', '#ffcc60', '#fff0b0'] : ['#5a4a0a', '#9a8418', '#d4bc30', '#f6e46a', '#fffad0'];
    const caps = [[4, b - 4, 2.2, 1.3, 3], [10, b - 8, 3.6, 2, 7], [6, b - 6.5, 2.8, 1.6, 5], [13, b - 3, 2, 1.2, 2]];
    for (const [x, y, rx, ry, sh] of caps) {
      for (let j = 1; j <= sh; j++) { P.set(x, y + j, '#e8e0c8'); P.set(x + 1, y + j, '#b0a890'); }
      P.ell(x + 0.5, y, rx, ry, (xx, yy, nx, ny) => P.set(xx, yy, ny > 0.4 ? C[0] : lit(nx, ny) > 0.5 ? C[3] : lit(nx, ny) > -0.2 ? C[2] : C[1]));
      P.set(Math.round(x - rx * 0.3), Math.round(y - 0.5), C[4]); if (rx > 3) P.set(Math.round(x + 1.5), Math.round(y - 0.5), C[4]);
    }
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: false, lights: [L(8, b - 7, 30, v ? [255, 180, 90] : [255, 230, 120], 0.6)] });
  });

  def('emerald_cluster_c', 2, (v) => {
    const W = 16, H = 32, b = H - 1, P = new Pix(W, H), C = GEMC[1];
    // emerald points breaking out of a mossy boulder
    P.ell(8, b - 4, 7, 4.4, (x, y, nx, ny) => P.set(x, y, lit(nx, ny) > 0.2 ? (ny < -0.3 ? MOSS[5] : '#4a5658') : lit(nx, ny) > -0.3 ? '#3a4448' : '#262e32'));
    for (let x = 2; x <= 14; x++) if (hash(x, 1, v) < 0.6) P.set(x, b - 8 + Math.round(hash(x, 2, v) * 2), MOSS[4]);
    if (v) { shard(P, 6, b - 6, 16, 5, C, -0.4); shard(P, 10.5, b - 5, 11, 4, C, 0.7); shard(P, 3.5, b - 5, 7, 3, C, -1); }
    else { shard(P, 8, b - 6, 20, 6, C, 0.2); shard(P, 4, b - 5, 10, 4, C, -0.9); shard(P, 12, b - 5, 9, 3, C, 1); }
    P.outline(OUT); P.shadow(9, b, 7, 1.5);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: true, lights: [L(8, b - 14, 36, [90, 240, 160], 0.5)] });
  });

  def('mossy_log_c', 1, () => {
    const W = 32, H = 24, b = H - 1, P = new Pix(W, H), BK = ['#2a1e16', '#3e2c1e', '#544028', '#6a5234', '#806640'];
    // a fallen log furred with moss, a crop of tiny glowcaps along its side
    for (let y = b - 11; y <= b - 2; y++) for (let x = 3; x <= 28; x++) { const ny = (y - (b - 6.5)) / 5; const k = ny < -0.5 ? 4 : ny < 0 ? 3 : ny < 0.6 ? 2 : 1; P.set(x, y, (x * 3 + y) % 7 === 0 ? BK[k - 1 < 0 ? 0 : k - 1] : BK[k]); }
    P.ell(28.5, b - 6.5, 2.4, 5, (x, y, nx, ny) => P.set(x, y, Math.round(Math.hypot(nx, ny) * 3) % 2 ? '#a88a5a' : '#8a6a40'));
    for (let x = 3; x <= 27; x++) { const top = b - 12 + Math.round(Math.sin(x * 0.6) * 0.8); for (let y = top; y <= top + 2 + (x % 3 === 0 ? 1 : 0); y++) P.set(x, y, y === top ? MOSS[6] : MOSS[4 + (x % 2)]); }
    for (const mx of [7, 12, 18, 23]) { P.set(mx, b - 3, '#e8e0c8'); P.ell(mx, b - 4, 1.4, 0.9, (x, y) => P.set(x, y, '#f6e46a')); }
    P.outline(OUT); P.shadow(17, b, 14, 1.6);
    return sprite({ c: P.canvas(), ax: 16, ay: b, foot: [2, 1], solid: true, lights: [L(15, b - 4, 26, [255, 230, 120], 0.35)] });
  });

  def('fern_c', 2, (v) => {
    const W = 16, H = 24, b = H - 1, P = new Pix(W, H);
    // a fern whose frond tips glow softly
    const fr = v ? [[-7, -8], [-4, -13], [0, -15], [4, -12], [7, -7]] : [[-6, -10], [-2, -14], [3, -13], [6, -9], [-7, -5]];
    fr.forEach(([dx, dy], k) => {
      for (let t = 0; t <= 1.0001; t += 0.07) {
        const x = 7.5 + dx * t, y = b - 1 + dy * t + t * t * 3 * (Math.abs(dx) / 7);
        P.set(x, y, t > 0.85 ? '#b4ffd0' : LEAF[k % 2 ? 3 : 4]);
        if (t > 0.2 && t < 0.85 && Math.round(t * 14) % 2 === 0) { P.set(x - 1, y - (dx > 0 ? 0 : 1), LEAF[k % 2 ? 4 : 5]); P.set(x + 1, y - (dx > 0 ? 1 : 0), LEAF[2]); }
      }
    });
    P.outline(OUT);
    return sprite({ c: P.canvas(), ax: 8, ay: b, foot: [1, 1], solid: false, lights: [L(8, b - 12, 24, [150, 255, 200], 0.4)] });
  });
})();
