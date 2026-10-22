// Nightvale — buildings, village props and temple ruins (procedural pixel art).
// Each maker returns { c (day canvas), n? (night canvas), ax, ay, lights:[...], smoke?:[...], frames?:[canvases], fps? }
(function () {
  'use strict';
  const G = window.G, U = G.U, PAL = G.PAL, Pix = G.Pix;
  const hash = U.hash, noise = U.noise;

  const ROOFS = {
    slate: ['#1b1429', '#2a2142', '#3a2e58', '#4d3f70', '#64558a'],
    plum: ['#2a1228', '#40203c', '#582e52', '#73406a', '#8e5a84'],
    moss: ['#132a24', '#1d3d32', '#2a5240', '#3b6a4e', '#55865e'],
    teal: ['#121e2c', '#1b2e40', '#274257', '#36586f', '#4c7288'],
    thatch: ['#2a2220', '#3e3228', '#574634', '#6e5a40', '#8a7450'],
    dark: ['#0f0c18', '#17122a', '#211a38', '#2d2448', '#3b305a'],
  };
  const WALLS = {
    plaster: ['#3d3141', '#5a4a5e', '#7e6c80', '#a08ea0', '#bfaebc'],
    cream: ['#4a3d3e', '#6e5e5a', '#998878', '#c0ae98', '#dccbb4'],
    stone: PAL.stone,
    log: PAL.wood,
    boards: ['#241a20', '#36282c', '#4c3a3a', '#644e4a', '#7e665c'],
  };
  const GLASS_DAY = ['#1b2246', '#2a3a6a', '#4a64a0', '#8aa8d8'];
  const GLASS_NIGHT = ['#b06a2a', '#ffbc62', '#ffd690', '#fff1c8'];
  const GLASS_WITCH = ['#1f6a4a', '#3fd88a', '#8affc0', '#e0ffe8'];

  // ------------------------------------------------------------------ house
  function makeHouse(o) {
    const tw = o.tw || 4, W = tw * 16, wallH = o.wallH || 26, roofH = o.roofH || 24;
    const chimTop = o.chimney != null ? 10 : 0;
    const H = wallH + roofH + chimTop + 2;
    const S = new Pix(W, H);
    const seed = o.seed || 7;
    const roof = ROOFS[o.roof || 'slate'], wall = WALLS[o.wall || 'plaster'];
    const wallTop = H - wallH, roofTop = wallTop - roofH + 3;
    const ax = W >> 1, ay = H - 1;
    const lights = [], smoke = [];

    // walls
    for (let y = wallTop; y < H; y++) for (let x = 1; x < W - 1; x++) {
      const ly = y - wallTop, lx = x - 1;
      let c;
      const kind = o.wall === 'timberstone' ? (ly > wallH * 0.48 ? 'stone' : 'plaster') : o.wall || 'plaster';
      const wl = WALLS[kind === 'timberstone' ? 'plaster' : kind] || WALLS.plaster;
      if (kind === 'stone') {
        const course = Math.floor(ly / 5), off = (course % 2) * 4;
        const bx = Math.floor((lx + off) / 8);
        if (ly % 5 === 4 || (lx + off) % 8 === 0) c = wl[1];
        else { const hv = hash(bx, course, seed); c = wl[hv < 0.3 ? 2 : hv < 0.85 ? 3 : 4]; if (ly % 5 === 0) c = wl[Math.min(5, (hv < 0.3 ? 2 : 3) + 1)]; }
      } else if (kind === 'log') {
        const lg = Math.floor(ly / 4), r = ly % 4;
        c = wl[r === 0 ? 4 : r === 3 ? 1 : 3];
        if (hash(lx, lg, seed) < 0.05) c = wl[2];
        if (lx < 2 || lx > W - 5) c = wl[r === 1 || r === 2 ? 4 : 2];
      } else if (kind === 'boards') {
        const b = Math.floor(lx / 4);
        c = wl[lx % 4 === 0 ? 1 : hash(b, 3, seed) < 0.4 ? 2 : 3];
        if (hash(lx, ly, seed + 1) < 0.04) c = wl[1];
      } else { // plaster with timber frame
        c = wl[hash(x, y, seed) < 0.1 ? 2 : 3];
        if (noise(x / 4, y / 4, seed) > 0.72) c = wl[2];
        const beamX = (lx % (o.beam || 16)) === 0 || lx === W - 3;
        if (beamX || ly === 0 || ly === 1 || (o.wall === 'timberstone' && Math.abs(ly - Math.floor(wallH * 0.48)) < 1)) c = PAL.wood[1];
        if (ly === 2) c = wl[1];
      }
      S.set(x, y, c);
    }
    // eave shadow on the wall
    for (let x = 1; x < W - 1; x++) { S.set(x, wallTop, '#140e20'); S.set(x, wallTop + 1, '#140e20'); S.blend(x, wallTop + 2, '#140e20', 0.45); }
    // foundation
    for (let x = 1; x < W - 1; x++) for (let y = H - 3; y < H; y++) S.set(x, y, y === H - 3 ? PAL.stone[3] : hash(x, y, seed) < 0.5 ? PAL.stone[1] : PAL.stone[2]);
    // ivy
    if (o.ivy) for (let k = 0; k < (o.ivy | 0); k++) {
      let x = 3 + Math.floor(hash(k, 1, seed) * (W - 6)), h = 6 + Math.floor(hash(k, 2, seed) * (wallH - 6));
      for (let y = 0; y < h; y++) { S.set(x, H - 3 - y, PAL.leaf[y % 3 === 0 ? 4 : 3]); if (y % 3 === 1) S.set(x + (y % 2 ? 1 : -1), H - 3 - y, PAL.leaf[2]); if (hash(k, y, 5) < 0.2) x += hash(y, k, 6) < 0.5 ? 1 : -1; }
    }

    // roof
    const style = o.style || 'hip';
    for (let y = roofTop; y < wallTop + 2; y++) {
      const ry = y - roofTop, rows = wallTop + 2 - roofTop;
      let x0, x1;
      if (style === 'gable') { const half = Math.round(4 + (ry / (rows - 1)) * (W / 2 - 4)); x0 = ax - half; x1 = ax + half - 1; }
      else { const inset = Math.round((rows - 1 - ry) * (o.slope || 0.42)); x0 = inset; x1 = W - 1 - inset; }
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        const course = Math.floor(ry / 3);
        let k = 2;
        if (ry % 3 === 2) k = 1;
        else if ((x + course * 2) % 5 === 0) k = 1;
        else if (hash(x, course, seed + 3) < 0.15) k = 3;
        const rel = (x - x0) / Math.max(1, x1 - x0);
        if (rel < 0.18 && style === 'hip') k = Math.min(4, k + 1);
        if (rel > 0.85) k = Math.max(0, k - 1);
        if (ry === 0) k = 4;
        if (x === x0 || x === x1) k = 0;
        if (y === wallTop + 1) k = 0;
        if (o.roof === 'moss' && noise(x / 5, y / 4, seed + 4) > 0.62) k = Math.min(4, k + 1);
        S.set(x, y, roof[k]);
      }
    }
    if (o.roof === 'moss' || o.mossy) for (let k = 0; k < W; k += 1) if (noise(k / 4, 3, seed + 8) > 0.55) S.set(k, wallTop + 2 + (k % 2), PAL.grass[3]);

    // chimney
    if (o.chimney != null) {
      const cx = o.chimney, top = roofTop - chimTop + 3, bottom = roofTop + Math.round(roofH * 0.55);
      for (let y = top; y < bottom; y++) for (let x = cx; x < cx + 6; x++) {
        const course = Math.floor((y - top) / 3), off = course % 2 ? 2 : 0;
        let c = (y - top) % 3 === 2 || (x - cx + off) % 4 === 0 ? PAL.stone[1] : PAL.stone[x === cx ? 4 : 3];
        if (x === cx + 5) c = PAL.stone[1];
        S.set(x, y, c);
      }
      for (let x = cx - 1; x < cx + 7; x++) { S.set(x, top - 1, PAL.stone[4]); S.set(x, top, PAL.stone[2]); }
      S.set(cx + 2, top - 1, '#120c1c'); S.set(cx + 3, top - 1, '#120c1c');
      smoke.push({ x: cx + 3, y: top - 2, color: o.smokeColor || null });
    }

    // windows
    const glassDay = [], glassNight = [];
    for (const w of o.windows || []) {
      const wy = w.y != null ? w.y : wallTop + (w.ry != null ? w.ry : Math.round(wallH * 0.3));
      const ww = w.w || 8, wh = w.h || 8;
      for (let y = -1; y <= wh; y++) for (let x = -1; x <= ww; x++) S.set(w.x + x, wy + y, PAL.wood[x === -1 || y === -1 ? 1 : 0]);
      for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) {
        let k = 1;
        if (x + y < 3) k = 3; else if (x + (wh - y) < 3) k = 0; else if ((x - y) === 2 || (x - y) === 3) k = 2;
        S.set(w.x + x, wy + y, GLASS_DAY[k]);
        glassDay.push([w.x + x, wy + y, x, y, ww, wh]);
      }
      if (ww >= 6) for (let y = 0; y < wh; y++) S.set(w.x + (ww >> 1), wy + y, PAL.wood[1]);
      if (wh >= 6) for (let x = 0; x < ww; x++) S.set(w.x + x, wy + (wh >> 1), PAL.wood[1]);
      for (let x = -2; x <= ww + 1; x++) S.set(w.x + x, wy + wh + 1, PAL.stone[3]);
      if (w.box) {
        for (let x = -1; x <= ww; x++) { S.set(w.x + x, wy + wh + 2, PAL.wood[2]); S.set(w.x + x, wy + wh + 3, PAL.wood[1]); }
        for (let x = 0; x < ww; x += 2) { S.set(w.x + x, wy + wh, x % 4 ? PAL.rose[2] : PAL.magic[3]); S.set(w.x + x + 1, wy + wh + 1, PAL.leaf[3]); }
      }
      if (w.shutters) {
        const sc = w.shutters === true ? ROOFS.teal : ROOFS[w.shutters];
        for (let y = 0; y < wh; y++) { S.set(w.x - 3, wy + y, sc[y % 3 ? 2 : 3]); S.set(w.x - 2, wy + y, sc[1]); S.set(w.x + ww + 1, wy + y, sc[1]); S.set(w.x + ww + 2, wy + y, sc[y % 3 ? 2 : 3]); }
      }
      lights.push({ x: w.x + ww / 2, y: wy + wh / 2 + 4, r: 40 + ww * 1.5, color: o.witch ? [93, 255, 160] : [255, 188, 98], i: 0.95, night: true, flicker: 1 });
    }

    // door
    let door = null;
    if (o.door != null) {
      const dw = o.doorW || 10, dh = o.doorH || 15, dx = o.door, dy = H - 3 - dh;
      for (let y = -1; y < dh; y++) for (let x = -1; x <= dw; x++) {
        const corner = y < 2 && (x <= 0 || x >= dw - 1) && !(y === 1 && (x === 0 || x === dw - 1));
        if (y === -1 && (x <= 0 || x >= dw - 1)) continue;
        if (corner && y === 0) { S.set(dx + x, dy + y, PAL.wood[0]); continue; }
        let c = x === -1 || x === dw || y === -1 ? PAL.wood[0] : (x % 3 === 0 ? PAL.wood[1] : PAL.wood[o.doorTone || 2]);
        if (y === 0 && x >= 1 && x <= dw - 2) c = PAL.wood[3];
        S.set(dx + x, dy + y, c);
      }
      S.set(dx + dw - 3, dy + Math.round(dh * 0.55), PAL.gold);
      for (let x = -2; x <= dw + 1; x++) { S.set(dx + x, H - 3, PAL.stone[4]); S.set(dx + x, H - 2, PAL.stone[2]); }
      door = { x: dx + dw / 2, y: H - 1 };
      if (o.doorLamp) {
        const lx = dx + dw + 3, ly = dy + 2;
        S.set(lx, ly - 1, PAL.stone[1]); S.rect(lx - 1, ly, 3, 4, PAL.wood[0]); S.set(lx, ly + 1, PAL.amber); S.set(lx, ly + 2, PAL.candle);
        lights.push({ x: lx, y: ly + 2, r: 48, color: [255, 188, 98], i: 0.9, night: true, flicker: 1 });
      }
    }

    // hanging sign
    if (o.sign) {
      const sx = o.sign.x, sy = wallTop + (o.sign.y || 6);
      S.hline(sx - 1, sx + 6, sy, PAL.stone[1]);
      S.set(sx + 1, sy + 1, PAL.stone[1]); S.set(sx + 5, sy + 1, PAL.stone[1]);
      S.rect(sx - 1, sy + 2, 10, 8, PAL.wood[0]);
      S.rect(sx, sy + 3, 8, 6, PAL.wood[3]);
      drawGlyph(S, o.sign.icon, sx + 1, sy + 3);
    }
    if (o.extra) o.extra(S, { W, H, wallTop, roofTop, lights, smoke });

    S.outline(PAL.outline);
    const day = S.canvas();
    // night version: lit windows
    const N = S.clone();
    const gl = o.witch ? GLASS_WITCH : GLASS_NIGHT;
    for (const g of glassDay) {
      const [x, y, lx, ly, ww, wh] = g;
      if ((ww >= 6 && lx === (ww >> 1)) || (wh >= 6 && ly === (wh >> 1))) continue;
      const cxw = ww / 2 - 0.5, cyw = wh / 2 - 0.5, d = Math.hypot(lx - cxw, ly - cyw) / Math.max(ww, wh);
      N.set(x, y, gl[d < 0.18 ? 3 : d < 0.36 ? 2 : 1]);
    }
    return { c: day, n: N.canvas(), ax, ay, lights, smoke, door, w: W, h: H };
  }

  // tiny glyphs for shop signs (8x6)
  function drawGlyph(S, icon, x, y) {
    const g = {
      sprout: ['...##...', '..#..#..', '...##...', '....#...', '..###...', '.#####..'],
      owl: ['.#....#.', '.######.', '#o#..#o#', '.######.', '..####..', '..#..#..'],
      anvil: ['........', '#######.', '.#####..', '..###...', '.#####..', '#######.'],
      fish: ['........', '..###..#', '.#####.#', '##o####.', '.#####.#', '..###..#'],
      pick: ['.####...', '#....#..', '....#...', '...#....', '..#.....', '.#......'],
      star: ['...#....', '...#....', '#######.', '..###...', '.#...#..', '........'],
      potion: ['...##...', '...##...', '..####..', '.######.', '.######.', '..####..'],
      moon: ['..###...', '.#......', '#.......', '#.......', '.#......', '..###...'],
      skull: ['.#####..', '#######.', '#.##.##.', '#######.', '.##.##..', '.#.#.#..'],
    }[icon];
    if (!g) return;
    const col = icon === 'owl' || icon === 'star' ? PAL.gold : icon === 'sprout' ? PAL.leaf[4] : icon === 'potion' ? PAL.magic[3] : icon === 'fish' ? PAL.water[3] : icon === 'skull' ? PAL.moon[2] : PAL.stone[1];
    for (let j = 0; j < g.length; j++) for (let i = 0; i < 8; i++) {
      const ch = g[j][i];
      if (ch === '#') S.set(x + i - 0, y + j, col);
      else if (ch === 'o') S.set(x + i, y + j, '#120c1c');
    }
  }

  // ------------------------------------------------------------------ observatory tower
  function makeTower() {
    const W = 56, H = 124, ax = 28, ay = H - 1;
    const S = new Pix(W, H);
    const bx0 = 10, bx1 = 46, bodyTop = 44;
    S.shadow(ax + 3, ay - 1, 22, 4);
    for (let y = bodyTop; y < H; y++) for (let x = bx0; x < bx1; x++) {
      const t = (x - bx0) / (bx1 - bx0 - 1);
      const light = Math.cos((t - 0.32) * Math.PI) ;
      const course = Math.floor((y - bodyTop) / 6), off = course % 2 ? 4 : 0;
      let k = light > 0.85 ? 4 : light > 0.55 ? 3 : light > 0.15 ? 2 : 1;
      if ((y - bodyTop) % 6 === 5 || (x + off) % 9 === 0) k = Math.max(0, k - 1);
      if (hash(x, y, 31) < 0.04) k = Math.max(0, k - 1);
      S.set(x, y, PAL.stone[k]);
      if (noise(x / 4, y / 5, 33) > 0.74 && y > H - 40) S.set(x, y, PAL.grass[k > 2 ? 3 : 2]);
    }
    // balcony ring
    for (let x = bx0 - 4; x < bx1 + 4; x++) for (let y = bodyTop - 2; y < bodyTop + 4; y++) {
      const t = (x - bx0 + 4) / (bx1 - bx0 + 8);
      S.set(x, y, y < bodyTop ? PAL.stone[4] : y === bodyTop + 3 ? PAL.stone[0] : PAL.stone[t < 0.35 ? 3 : 2]);
    }
    for (let x = bx0 - 4; x < bx1 + 4; x += 3) { S.vline(x, bodyTop - 7, bodyTop - 2, '#2d2c3e'); }
    S.hline(bx0 - 4, bx1 + 3, bodyTop - 7, '#45445a');
    // dome
    const dcx = ax, dcy = bodyTop - 3, drx = 17, dry = 26;
    for (let y = -dry; y <= 0; y++) for (let x = -drx; x <= drx; x++) {
      if ((x * x) / (drx * drx) + (y * y) / (dry * dry) > 1) continue;
      const lx = (x + drx * 0.45) / drx, ly = (y + dry * 0.55) / dry;
      const s = 1 - Math.hypot(lx, ly * 0.9);
      let k = s > 0.55 ? 4 : s > 0.3 ? 3 : s > 0.05 ? 2 : 1;
      if (Math.abs(x) % 7 === 3) k = Math.max(0, k - 1);
      S.set(dcx + x, dcy + y, ROOFS.slate[k]);
      if (hash(x, y, 35) < 0.025) S.set(dcx + x, dcy + y, PAL.gold);
    }
    // slit + telescope
    for (let y = -dry + 4; y < -6; y++) { S.set(dcx + 3, dcy + y, '#0b0814'); S.set(dcx + 4, dcy + y, '#0b0814'); S.set(dcx + 5, dcy + y, '#120c1c'); }
    for (let k = 0; k < 14; k++) { const x = dcx + 5 + k, y = dcy - 14 - Math.round(k * 0.7); S.set(x, y, '#c08a3a'); S.set(x, y + 1, '#8a5a24'); S.set(x - 1, y + 1, '#f2c45a'); }
    S.set(dcx + 19, dcy - 24, '#e8eeff');
    // windows
    const lights = [];
    const win = (x, y, w, h) => {
      for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) S.set(x + i, y + j, PAL.stone[0]);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!(j === 0 && (i === 0 || i === w - 1))) S.set(x + i, y + j, GLASS_DAY[j < 2 ? 2 : 1]);
      lights.push({ x: x + w / 2, y: y + h / 2, r: 30, color: [255, 188, 98], i: 0.8, night: true, flicker: 1, glass: [x, y, w, h] });
    };
    win(ax - 3, bodyTop + 12, 6, 9); win(ax - 13, bodyTop + 34, 5, 8); win(ax + 6, bodyTop + 50, 5, 8);
    // door
    const dx = ax - 6, dy = H - 22;
    for (let j = 0; j < 20; j++) for (let i = 0; i < 12; i++) {
      if (j < 3 && (i < 2 - j || i > 9 + j)) continue;
      S.set(dx + i, dy + j, i === 0 || i === 11 || j === 0 ? PAL.wood[0] : i % 3 === 0 ? PAL.wood[1] : PAL.wood[2]);
    }
    S.set(dx + 9, dy + 11, PAL.gold);
    for (let i = -2; i < 14; i++) { S.set(dx + i, H - 2, PAL.stone[4]); S.set(dx + i, H - 1, PAL.stone[2]); }
    // star banner
    S.rect(bx1 - 9, bodyTop + 20, 6, 14, ROOFS.slate[3]); for (let j = 0; j < 14; j++) S.set(bx1 - 9, bodyTop + 20 + j, ROOFS.slate[1]);
    S.set(bx1 - 6, bodyTop + 25, PAL.gold); S.set(bx1 - 7, bodyTop + 26, PAL.gold); S.set(bx1 - 5, bodyTop + 26, PAL.gold); S.set(bx1 - 6, bodyTop + 27, PAL.gold);
    S.set(bx1 - 9, bodyTop + 34, ROOFS.slate[3]); S.set(bx1 - 4, bodyTop + 34, ROOFS.slate[3]);
    S.outline(PAL.outline);
    const day = S.canvas();
    const N = S.clone();
    for (const L of lights) { const [x, y, w, h] = L.glass; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!(j === 0 && (i === 0 || i === w - 1))) N.set(x + i, y + j, GLASS_NIGHT[j < 2 ? 3 : 2]); }
    lights.push({ x: dcx + 19, y: dcy - 24, r: 16, color: [200, 220, 255], i: 0.6, night: true });
    return { c: day, n: N.canvas(), ax, ay, lights, door: { x: ax, y: H - 1 }, w: W, h: H };
  }

  // ------------------------------------------------------------------ Grizelda's crooked hut
  function makeHut() {
    const r = makeHouse({
      tw: 3, wallH: 24, roofH: 26, roof: 'thatch', wall: 'boards', style: 'gable', door: 8, doorW: 9, doorTone: 1,
      windows: [{ x: 30, y: null, w: 7, h: 7 }], chimney: 33, seed: 77, witch: true, smokeColor: [120, 255, 170],
      extra(S, g) {
        // crooked patches and hanging herbs/skull
        for (let k = 0; k < 4; k++) { const x = 4 + k * 11, y = g.wallTop + 6 + (k % 2) * 6; S.rect(x, y, 5, 4, k % 2 ? '#5a3a2a' : '#3a2a34'); S.set(x + 1, y + 1, '#120c1c'); }
        for (let x = 20; x < 28; x += 3) { S.vline(x, g.wallTop + 2, g.wallTop + 5, PAL.leaf[3]); S.set(x, g.wallTop + 6, PAL.magic[2]); }
        S.rect(41, g.wallTop + 2, 5, 4, PAL.moon[2]); S.set(42, g.wallTop + 3, '#120c1c'); S.set(44, g.wallTop + 3, '#120c1c'); S.hline(42, 44, g.wallTop + 5, '#7e7d97');
      },
    });
    return r;
  }

  // ------------------------------------------------------------------ Elowen's tree house
  function makeTreehouse() {
    const W = 84, H = 104, ax = 42, ay = H - 1;
    const S = new Pix(W, H);
    S.shadow(ax + 3, ay - 2, 30, 5);
    // roots + trunk
    for (let y = 40; y < H - 1; y++) {
      const t = (y - 40) / (H - 41);
      const half = Math.round(15 + t * t * 10);
      for (let x = -half; x <= half; x++) {
        const rel = (x + half) / (2 * half);
        let k = rel < 0.2 ? 3 : rel < 0.6 ? 2 : rel < 0.85 ? 1 : 0;
        if (noise((ax + x) / 2, y / 7, 51) > 0.7) k = Math.max(0, k - 1);
        if (Math.abs(x) === half) k = 0;
        S.set(ax + x, y, PAL.wood[k + 1 > 4 ? 4 : k + (rel < 0.2 ? 1 : 0)]);
      }
    }
    // canopy
    G.Nature.canopy(S, ax, 30, 30, PAL.leaf.slice(0, 6), 909, { blobs: 9, spreadX: 0.62, spreadY: 0.38 });
    // round door
    const dcx = ax, dcy = H - 12;
    for (let y = -11; y <= 9; y++) for (let x = -7; x <= 7; x++) {
      if ((x * x) / 49 + (y * y) / 121 > 1 || y > 9) continue;
      S.set(dcx + x, dcy + y, Math.abs(x) >= 6 || y === -11 ? PAL.wood[0] : x % 3 === 0 ? '#2f5a36' : '#3b6e42');
    }
    S.set(dcx + 4, dcy, PAL.gold);
    // windows
    const lights = [];
    const glass = [];
    for (const [wx, wy] of [[ax - 12, 58], [ax + 8, 66]]) {
      S.disc(wx + 3, wy + 3, 4, 4, PAL.wood[0]);
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 9) { S.set(wx + 3 + x, wy + 3 + y, GLASS_DAY[1 + (x + y < 0 ? 1 : 0)]); glass.push([wx + 3 + x, wy + 3 + y]); }
      lights.push({ x: wx + 3, y: wy + 3, r: 26, color: [255, 200, 120], i: 0.8, night: true, flicker: 1 });
    }
    // lanterns hanging from the canopy
    for (const [lx, ly] of [[ax - 24, 44], [ax + 22, 48]]) {
      S.vline(lx, ly - 6, ly - 1, '#2d2c3e'); S.rect(lx - 1, ly, 3, 4, PAL.wood[0]); S.set(lx, ly + 1, PAL.emerald[1]); S.set(lx, ly + 2, PAL.emerald[2]);
      lights.push({ x: lx, y: ly + 2, r: 26, color: [93, 255, 176], i: 0.7, night: true });
    }
    S.outline(PAL.outline);
    const day = S.canvas();
    const N = S.clone();
    for (const [x, y] of glass) N.set(x, y, GLASS_NIGHT[hash(x, y, 3) < 0.5 ? 2 : 3]);
    return { c: day, n: N.canvas(), ax, ay, lights, door: { x: ax, y: H - 1 }, w: W, h: H };
  }

  // ------------------------------------------------------------------ cave mouth (Umbral Depths)
  function makeCave() {
    const W = 64, H = 56, ax = 32, ay = H - 1;
    const S = new Pix(W, H);
    // rock face
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = Math.min(x, W - 1 - x);
      if (y < 8 - Math.min(8, edge / 2) + noise(x / 3, 1, 61) * 3) continue;
      let k = 2 + (Math.floor((y + noise(x / 6, y / 20, 62) * 4) / 5) % 2) + (noise(x / 3, y / 8, 63) > 0.7 ? 1 : 0);
      if (noise(x / 1.6, y / 9, 64) > 0.84) k = 1;
      S.set(x, y, PAL.rock[U.clamp(k, 0, 5)]);
    }
    // opening
    const ocx = ax, oby = H - 1, orx = 13, ory = 24;
    for (let y = -ory; y <= 0; y++) for (let x = -orx; x <= orx; x++) {
      if ((x * x) / (orx * orx) + (y * y) / (ory * ory) > 1) continue;
      const d = Math.hypot(x / orx, y / ory);
      S.set(ocx + x, oby + y, d > 0.86 ? '#140e20' : '#07050d');
    }
    // timber frame
    for (let y = oby - 22; y <= oby; y++) { for (const x of [ocx - 14, ocx - 13, ocx + 13, ocx + 14]) S.set(x, y, PAL.wood[x === ocx - 14 || x === ocx + 13 ? 3 : 1]); }
    for (let x = ocx - 16; x <= ocx + 16; x++) { S.set(x, oby - 23, PAL.wood[3]); S.set(x, oby - 22, PAL.wood[2]); S.set(x, oby - 21, PAL.wood[1]); }
    // runes over the entrance
    const lights = [];
    for (let k = 0; k < 5; k++) { const x = ocx - 10 + k * 5, y = oby - 29 + (k % 2); S.set(x, y, PAL.magic[4]); S.set(x + 1, y + 1, PAL.magic[3]); S.set(x, y + 2, PAL.magic[3]); }
    lights.push({ x: ocx, y: oby - 28, r: 34, color: [180, 140, 255], i: 0.6 });
    // braziers
    for (const bx of [ocx - 21, ocx + 21]) {
      S.rect(bx - 2, oby - 8, 5, 8, PAL.stone[2]); S.rect(bx - 3, oby - 9, 7, 2, PAL.stone[4]);
      S.set(bx, oby - 11, PAL.magic[4]); S.set(bx - 1, oby - 10, PAL.magic[2]); S.set(bx + 1, oby - 10, PAL.magic[3]); S.set(bx, oby - 12, PAL.magic[3]);
      lights.push({ x: bx, y: oby - 11, r: 40, color: [170, 120, 255], i: 0.85, flicker: 1 });
    }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights, w: W, h: H };
  }

  // ------------------------------------------------------------------ village props
  function makeLamp(variant) {
    const S = new Pix(10, 30), ax = 5, ay = 29;
    S.shadow(ax + 1, ay, 3, 1.2);
    S.rect(3, 27, 5, 3, PAL.stone[1]); S.hline(3, 7, 27, PAL.stone[3]);
    S.vline(5, 9, 27, '#2d2c3e'); S.vline(4, 10, 26, '#45445a');
    S.rect(2, 8, 7, 1, '#2d2c3e');
    S.rect(2, 2, 7, 6, '#1d1724');
    const glass = variant === 1 ? [PAL.emerald[0], PAL.emerald[1], PAL.emerald[2]] : [PAL.orange, PAL.amber, PAL.candle];
    S.rect(3, 3, 5, 4, glass[1]); S.set(5, 4, glass[2]); S.set(5, 5, glass[2]); S.set(3, 6, glass[0]);
    S.hline(1, 9, 1, '#2d2c3e'); S.hline(3, 7, 0, '#45445a');
    S.outline(PAL.outline);
    const color = variant === 1 ? [93, 255, 176] : [255, 190, 100];
    return { c: S.canvas(), ax, ay, lights: [{ x: 5, y: 5, r: 72, color, i: 1, flicker: 1, night: true }] };
  }
  function makeFence(mask, iron) {
    // mask bits: 1=left, 2=right, 4=up, 8=down
    const S = new Pix(16, 22), ax = 8, ay = 21;
    const ramp = iron ? ['#17131f', '#2d2c3e', '#45445a', '#605f78'] : [PAL.wood[0], PAL.wood[1], PAL.wood[2], PAL.wood[3]];
    const rail = (x0, x1, y) => { for (let x = x0; x <= x1; x++) { S.set(x, y, ramp[3]); S.set(x, y + 1, ramp[1]); } };
    if (mask & 1) { rail(0, 7, 11); rail(0, 7, 16); }
    if (mask & 2) { rail(8, 15, 11); rail(8, 15, 16); }
    if (mask & 4) for (let y = 0; y < 9; y++) { S.set(7, y + 4, ramp[2]); S.set(8, y + 4, ramp[1]); }
    if (mask & 8) for (let y = 19; y < 22; y++) { S.set(7, y, ramp[2]); S.set(8, y, ramp[1]); }
    // post
    for (let y = 7; y < 21; y++) { S.set(6, y, ramp[3]); S.set(7, y, ramp[2]); S.set(8, y, ramp[2]); S.set(9, y, ramp[1]); }
    S.hline(6, 9, 6, ramp[3]);
    if (iron) { S.set(7, 5, ramp[3]); S.set(8, 4, PAL.magic[2]); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeSign(variant) {
    const S = new Pix(16, 20), ax = 8, ay = 19;
    S.shadow(ax, ay, 4, 1);
    S.vline(7, 10, 19, PAL.wood[1]); S.vline(8, 10, 19, PAL.wood[2]);
    S.rect(1, 3, 14, 9, PAL.wood[1]); S.rect(2, 4, 12, 7, PAL.wood[3]);
    S.hline(2, 13, 4, PAL.wood[4]);
    for (let k = 0; k < 3; k++) S.hline(4, 11 - (k % 2) * 2, 6 + k * 2, PAL.wood[1]);
    if (variant === 1) { S.set(13, 7, PAL.magic[3]); S.set(12, 8, PAL.magic[3]); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeBench() {
    const S = new Pix(32, 18), ax = 16, ay = 16;
    S.shadow(ax, ay, 13, 2);
    S.rect(2, 5, 28, 2, PAL.wood[3]); S.rect(2, 7, 28, 1, PAL.wood[1]);
    S.rect(2, 10, 28, 2, PAL.wood[4]); S.rect(2, 12, 28, 1, PAL.wood[2]);
    for (const x of [4, 26]) { S.rect(x, 5, 2, 12, '#2d2c3e'); S.set(x, 5, '#45445a'); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeBarrel(variant) {
    const S = new Pix(14, 18), ax = 7, ay = 17;
    S.shadow(ax, ay, 6, 1.5);
    for (let y = 3; y < 17; y++) for (let x = 1; x < 13; x++) {
      const bulge = (y > 5 && y < 15) ? 0 : 1;
      if (x < 1 + bulge || x > 12 - bulge) continue;
      let k = x < 4 ? 3 : x < 9 ? 2 : 1;
      if (y === 5 || y === 13) k = 0;
      S.set(x, y, k === 0 ? '#2d2c3e' : PAL.wood[k + 1]);
    }
    S.disc(7, 3, 5, 2, PAL.wood[3]); S.disc(7, 3, 3, 1, PAL.wood[2]);
    if (variant === 1) { S.set(6, 2, PAL.emerald[1]); S.set(7, 2, PAL.emerald[2]); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeCrate(variant) {
    const S = new Pix(16, 16), ax = 8, ay = 15;
    S.shadow(ax, ay, 7, 1.5);
    S.rect(1, 2, 14, 13, PAL.wood[2]);
    S.rect(1, 2, 14, 2, PAL.wood[4]);
    for (let y = 4; y < 15; y += 4) S.hline(1, 14, y, PAL.wood[1]);
    S.line(2, 5, 13, 13, PAL.wood[1]);
    if (variant === 1) { for (let x = 3; x < 13; x += 2) { S.set(x, 1, PAL.leaf[4]); S.set(x + 1, 0, PAL.magic[3]); S.set(x, 0, PAL.leaf[3]); } }
    if (variant === 2) { for (let x = 3; x < 13; x += 3) { S.set(x, 1, '#c44a3a'); S.set(x + 1, 1, '#e8843c'); } }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeWell() {
    const S = new Pix(34, 36), ax = 17, ay = 35;
    S.shadow(ax + 1, ay - 2, 14, 3);
    S.disc(17, 27, 13, 7, PAL.stone[2]);
    S.disc(17, 26, 10, 5, '#0b1030');
    for (let x = 4; x < 31; x++) for (let y = 27; y < 34; y++) {
      const dx = (x - 17) / 13; if (dx * dx > 1) continue;
      const yy = 27 + Math.sqrt(1 - dx * dx) * 7;
      if (y > yy) continue;
      if (y >= 27) S.set(x, y, (Math.floor(y / 3) + Math.floor(x / 4)) % 2 ? PAL.stone[3] : PAL.stone[2]);
    }
    S.disc(17, 26, 10, 5, '#0b1030'); S.disc(17, 26, 8, 3, PAL.water[1]);
    for (const x of [5, 28]) S.rect(x, 6, 2, 20, PAL.wood[2]);
    S.rect(3, 4, 28, 3, PAL.wood[3]); S.hline(3, 30, 4, PAL.wood[4]);
    for (let x = 1; x < 33; x++) { const yy = 4 - Math.round(4 - Math.abs(x - 17) / 4.5); S.set(x, yy, ROOFS.slate[3]); S.set(x, yy + 1, ROOFS.slate[2]); }
    S.vline(17, 7, 18, '#45445a'); S.rect(15, 19, 5, 4, PAL.wood[2]); S.hline(15, 19, 19, PAL.wood[4]);
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeNoticeBoard() {
    const S = new Pix(34, 30), ax = 17, ay = 29;
    S.shadow(ax, ay, 14, 2);
    for (const x of [3, 29]) S.rect(x, 6, 3, 24, PAL.wood[2]);
    S.rect(1, 8, 32, 16, PAL.wood[1]); S.rect(2, 9, 30, 14, PAL.wood[3]);
    for (let x = 0; x < 34; x++) { S.set(x, 5, ROOFS.plum[3]); S.set(x, 6, ROOFS.plum[2]); S.set(x, 7, ROOFS.plum[1]); }
    const papers = [[5, 11, 7, 8], [14, 10, 6, 6], [22, 12, 8, 7], [14, 17, 6, 5]];
    for (const [x, y, w, h] of papers) { S.rect(x, y, w, h, '#e8dcc8'); S.hline(x + 1, x + w - 2, y + 2, '#9a8c80'); S.hline(x + 1, x + w - 3, y + 4, '#9a8c80'); S.set(x + (w >> 1), y, '#c44a3a'); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeStall(variant) {
    const S = new Pix(48, 36), ax = 24, ay = 35;
    S.shadow(ax, ay, 22, 2.5);
    const cloth = variant === 1 ? ['#1b2e40', '#36586f', '#e8dcc8'] : ['#40203c', '#73406a', '#e8dcc8'];
    for (const x of [3, 43]) S.rect(x, 6, 2, 30, PAL.wood[1]);
    S.rect(1, 22, 46, 13, PAL.wood[2]); S.rect(1, 22, 46, 2, PAL.wood[4]);
    for (let y = 25; y < 35; y += 3) S.hline(1, 46, y, PAL.wood[1]);
    for (let y = 2; y < 12; y++) for (let x = 0; x < 48; x++) { const stripe = Math.floor(x / 6) % 2; S.set(x, y, y === 11 ? cloth[0] : stripe ? cloth[1] : cloth[2]); }
    for (let x = 0; x < 48; x += 6) { S.set(x + 2, 12, cloth[1]); S.set(x + 3, 12, cloth[1]); S.set(x + 3, 13, cloth[0]); }
    // goods
    const goods = [[6, PAL.magic[3]], [12, '#e8843c'], [18, PAL.leaf[4]], [26, PAL.rose[2]], [33, PAL.moon[2]], [39, PAL.magic[2]]];
    for (const [x, c] of goods) { S.rect(x, 19, 4, 3, c); S.set(x + 1, 18, c); S.set(x, 21, '#120c1c'); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeFountain(frame) {
    const W = 52, H = 46, ax = 26, ay = H - 1;
    const S = new Pix(W, H);
    S.shadow(ax + 1, ay - 3, 24, 4);
    // basin rim (ellipse ring)
    const cx = 26, cy = 32, rx = 23, ry = 11;
    for (let y = -ry - 1; y <= ry + 4; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
      const e = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      const e2 = (x * x) / ((rx - 4) * (rx - 4)) + (y * y) / ((ry - 3) * (ry - 3));
      if (e <= 1 && e2 > 1) S.set(cx + x, cy + y, y < 0 ? PAL.stone[4] : PAL.stone[3]);
      if (e2 <= 1) {
        const ring = (Math.hypot(x / (rx - 4), y / (ry - 3)) * 4 - frame * 0.5) % 1;
        S.set(cx + x, cy + y, ring < 0.18 ? PAL.water[3] : PAL.water[2]);
      }
    }
    for (let x = -rx; x <= rx; x++) { const yy = Math.round(ry * Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx)))); for (let k = 0; k < 4; k++) S.set(cx + x, cy + yy + k, k === 3 ? PAL.stone[1] : PAL.stone[2]); }
    // pillar + crescent
    S.rect(cx - 2, 12, 5, 20, PAL.stone[3]); S.vline(cx - 2, 12, 31, PAL.stone[4]); S.vline(cx + 2, 12, 31, PAL.stone[1]);
    S.rect(cx - 4, 11, 9, 2, PAL.stone[4]);
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * Math.PI * 1.25 + Math.PI * 0.85;
      const x = cx + Math.cos(t) * 7, y = 4 + Math.sin(t) * 7;
      S.set(x, y, PAL.moon[2]); S.set(x + 0.6, y + 0.6, PAL.moon[1]);
    }
    // water streams
    for (let k = 0; k < 6; k++) { const sx = cx - 6 + ((k + frame) % 6) * 2 + (k < 3 ? -2 : 3); S.set(sx, 16 + ((k * 3 + frame * 2) % 14), PAL.water[4]); }
    S.outline(PAL.outline);
    return S.canvas();
  }
  function makeStatue(kind) {
    const S = new Pix(24, 44), ax = 12, ay = 43;
    S.shadow(ax + 1, ay, 10, 2);
    S.rect(3, 34, 18, 9, PAL.stone[2]); S.rect(2, 33, 20, 2, PAL.stone[4]); S.rect(4, 36, 16, 1, PAL.stone[1]);
    // robed figure
    for (let y = 8; y < 33; y++) {
      const half = Math.round(3 + (y - 8) * 0.22);
      for (let x = -half; x <= half; x++) S.set(ax + x, y, PAL.stone[x < -half / 3 ? 4 : x < half / 2 ? 3 : 2]);
    }
    S.disc(ax, 6, 3, 3, PAL.stone[4]); S.set(ax + 1, 6, PAL.stone[2]);
    if (kind === 'moon') { for (let a = 0; a < 20; a++) { const t = (a / 20) * Math.PI * 1.3 + 0.9; S.set(ax + 6 + Math.cos(t) * 4, 12 + Math.sin(t) * 4, PAL.moon[2]); } S.line(ax + 3, 18, ax + 6, 14, PAL.stone[3]); }
    else { S.line(ax - 3, 16, ax - 7, 6, PAL.stone[3]); S.set(ax - 7, 5, PAL.gold); }
    for (let k = 0; k < 6; k++) S.set(ax - 2 + k, 30 - (k % 2) * 6, PAL.grass[2]);
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeGrave(variant) {
    const S = new Pix(16, 20), ax = 8, ay = 19;
    S.shadow(ax, ay - 1, 6, 1.6);
    const st = PAL.stone;
    if (variant % 4 === 0) { // rounded headstone
      for (let y = 4; y < 18; y++) for (let x = 3; x < 13; x++) { if (y < 7 && Math.hypot(x - 7.5, y - 7) > 5) continue; S.set(x, y, st[x < 5 ? 4 : x > 11 ? 2 : 3]); }
      S.hline(5, 10, 9, st[1]); S.hline(5, 9, 11, st[1]); S.hline(6, 10, 13, st[1]);
    } else if (variant % 4 === 1) { // cross
      S.rect(6, 3, 4, 15, st[3]); S.rect(3, 6, 10, 3, st[3]); S.vline(6, 3, 17, st[4]); S.hline(3, 12, 6, st[4]);
    } else if (variant % 4 === 2) { // obelisk
      for (let y = 2; y < 18; y++) { const half = y < 5 ? y - 2 : 3; for (let x = -half; x <= half; x++) S.set(8 + x, y, st[x < 0 ? 4 : 2]); }
      S.set(8, 8, PAL.magic[3]);
    } else { // tilted broken
      for (let y = 7; y < 18; y++) for (let x = 3; x < 12; x++) { const xx = x + Math.floor((18 - y) / 5); S.set(xx, y, st[x < 5 ? 4 : 3]); }
      S.set(5, 7, st[1]); S.set(9, 8, st[1]);
    }
    S.rect(2, 17, 12, 2, PAL.grass[2]); S.set(4, 16, PAL.grass[3]); S.set(11, 16, PAL.grass[3]);
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeAnvil() {
    const S = new Pix(18, 14), ax = 9, ay = 13;
    S.shadow(ax, ay, 7, 1.5);
    S.rect(5, 8, 8, 5, PAL.wood[2]); S.hline(5, 12, 8, PAL.wood[4]);
    S.rect(2, 3, 14, 3, '#3d3654'); S.hline(2, 15, 3, '#7a7099'); S.rect(6, 6, 6, 2, '#2d2840'); S.set(1, 4, '#3d3654');
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeTelescope() {
    const S = new Pix(20, 26), ax = 10, ay = 25;
    S.shadow(ax, ay, 6, 1.5);
    S.line(10, 14, 5, 25, PAL.wood[2]); S.line(10, 14, 15, 25, PAL.wood[2]); S.line(10, 14, 10, 25, PAL.wood[1]);
    for (let k = 0; k < 13; k++) { const x = 4 + k, y = 15 - Math.round(k * 0.8); S.set(x, y, '#c08a3a'); S.set(x, y - 1, '#f2c45a'); S.set(x, y + 1, '#8a5a24'); }
    S.set(17, 4, '#e8eeff');
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeBoat() {
    const S = new Pix(44, 16), ax = 22, ay = 14;
    for (let x = 0; x < 44; x++) {
      const t = Math.abs(x - 22) / 22, d = Math.round(7 * Math.sqrt(1 - t * t));
      for (let y = 0; y < d; y++) S.set(x, 7 + y, y === 0 ? PAL.wood[4] : y < 3 ? PAL.wood[3] : PAL.wood[1]);
      if (d > 2) S.set(x, 8, x % 6 === 0 ? PAL.wood[1] : PAL.wood[2]);
    }
    S.rect(12, 8, 20, 2, PAL.wood[0]); S.line(26, 9, 38, 3, PAL.wood[2]);
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeCart() {
    const S = new Pix(34, 24), ax = 17, ay = 23;
    S.shadow(ax, ay, 14, 2);
    S.rect(3, 6, 26, 10, PAL.wood[2]); S.rect(3, 6, 26, 2, PAL.wood[4]); for (let x = 3; x < 29; x += 5) S.vline(x, 8, 15, PAL.wood[1]);
    for (const wx of [8, 24]) { S.disc(wx, 18, 4, 4, PAL.wood[0]); S.disc(wx, 18, 2, 2, PAL.wood[3]); S.set(wx, 18, PAL.wood[0]); }
    S.line(29, 12, 33, 16, PAL.wood[1]);
    for (let x = 5; x < 27; x += 3) { S.set(x, 5, PAL.rock[3]); S.set(x + 1, 4, PAL.rock[4]); S.set(x + 1, 5, PAL.magic[2]); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makePlanter(variant) {
    const S = new Pix(16, 14), ax = 8, ay = 13;
    S.rect(1, 7, 14, 6, PAL.stone[2]); S.hline(1, 14, 7, PAL.stone[4]); S.hline(1, 14, 12, PAL.stone[1]);
    for (let x = 2; x < 14; x += 2) { S.set(x, 6, PAL.leaf[3]); S.set(x, 5, (x + variant) % 4 ? PAL.magic[3] : PAL.rose[2]); S.set(x + 1, 6, PAL.leaf[2]); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }

  // ------------------------------------------------------------------ temple ruins
  function makePillar(broken) {
    const S = new Pix(18, 48), ax = 9, ay = 47;
    S.shadow(ax + 2, ay - 1, 8, 2);
    const top = broken ? 18 + (broken % 3) * 4 : 6;
    S.rect(2, 41, 14, 6, PAL.stone[2]); S.hline(2, 15, 41, PAL.stone[4]); S.hline(2, 15, 46, PAL.stone[1]);
    for (let y = top; y < 41; y++) for (let x = 4; x < 14; x++) {
      let k = x < 6 ? 5 : x < 9 ? 4 : x < 12 ? 3 : 2;
      if ((x - 4) % 3 === 2) k--;
      if (broken && y < top + 3 && hash(x, 7, broken) < 0.45) continue;
      if (hash(x, y, 11) < 0.05) k = Math.max(1, k - 1);
      S.set(x, y, PAL.stone[U.clamp(k, 0, 5)]);
    }
    if (!broken) { S.rect(2, 2, 14, 4, PAL.stone[4]); S.hline(2, 15, 2, PAL.stone[5]); S.hline(3, 14, 5, PAL.stone[1]); S.rect(3, 6, 12, 1, PAL.stone[2]); }
    else { for (let k = 0; k < 5; k++) S.set(1 + k * 3, 46 - (k % 2), PAL.stone[3]); }
    // vines
    let vx = 5 + (broken | 0) % 4;
    for (let y = 40; y > top + 6; y--) { S.set(vx, y, PAL.leaf[3]); if (y % 4 === 0) { S.set(vx + 1, y, PAL.leaf[4]); vx += hash(y, 3, 5) < 0.5 ? 1 : -1; vx = U.clamp(vx, 4, 13); } if (y % 9 === 0) S.set(vx - 1, y, PAL.magic[3]); }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeRuinWall(mask, variant) { // mask: 1=left neighbour, 2=right neighbour
    const S = new Pix(16, 28), ax = 8, ay = 27;
    const h = 16 + (hash(variant, 1, 3) * 8 | 0);
    for (let y = 27 - h; y < 28; y++) for (let x = 0; x < 16; x++) {
      if (!(mask & 1) && x < 1) continue;
      if (!(mask & 2) && x > 14) continue;
      const ly = y - (27 - h);
      if (ly < 3 && hash(x, variant, 4) < 0.3) continue;
      const course = Math.floor(y / 5), off = course % 2 ? 4 : 0;
      let c;
      if (y % 5 === 4 || (x + off) % 8 === 0) c = PAL.stone[1];
      else { const hv = hash(Math.floor((x + off) / 8), course, variant + 9); c = PAL.stone[hv < 0.3 ? 2 : hv < 0.8 ? 3 : 4]; }
      if (ly < 2) c = PAL.grass[ly === 0 ? 3 : 2];
      if (noise(x / 3, y / 3, variant + 5) > 0.74) c = PAL.leaf[3];
      S.set(x, y, c);
    }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [] };
  }
  function makeArch() {
    const S = new Pix(56, 60), ax = 28, ay = 59;
    // pillars
    for (const px0 of [0, 38]) {
      for (let y = 12; y < 60; y++) for (let x = 0; x < 18; x++) {
        const k = x < 4 ? 5 : x < 8 ? 4 : x < 12 ? 3 : 2;
        if (x >= 2 && x < 16) S.set(px0 + x, y, y > 53 ? PAL.stone[y === 54 ? 4 : 2] : PAL.stone[(x - 2) % 3 === 2 ? k - 1 : k]);
      }
    }
    // arch band
    for (let y = 0; y < 16; y++) for (let x = 2; x < 54; x++) {
      const d = Math.hypot((x - 28) / 18, (y - 16) / 13);
      if (y < 8 || d > 1) {
        const course = Math.floor(y / 4);
        let c = y % 4 === 3 ? PAL.stone[1] : PAL.stone[(x + course * 3) % 7 === 0 ? 2 : y < 3 ? 4 : 3];
        S.set(x, y, c);
      }
    }
    // keystone with crescent
    S.rect(24, 0, 8, 9, PAL.stone[4]); S.hline(24, 31, 8, PAL.stone[1]);
    S.set(27, 2, PAL.magic[4]); S.set(26, 3, PAL.magic[3]); S.set(26, 4, PAL.magic[3]); S.set(27, 5, PAL.magic[4]);
    for (let k = 0; k < 9; k++) S.set(4 + k * 6, 1 + (k % 2), PAL.grass[3]);
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: [{ x: 27, y: 4, r: 18, color: [190, 150, 255], i: 0.5, night: true }] };
  }
  // Moon Altar: level 0..5 restoration, frame 0/1 for glow pulse
  function makeAltar(level, frame) {
    const W = 56, H = 60, ax = 28, ay = H - 1;
    const S = new Pix(W, H);
    S.shadow(ax + 2, ay - 2, 26, 4);
    // three-step dais
    const steps = [[0, 46, 56, 14], [6, 38, 44, 9], [12, 31, 32, 8]];
    for (const [x0, y0, w, h] of steps) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      let c = y === y0 ? PAL.stone[5] : y < y0 + 2 ? PAL.stone[4] : PAL.stone[3];
      if (y === y0 + h - 1) c = PAL.stone[1];
      if (x === x0) c = PAL.stone[4]; if (x === x0 + w - 1) c = PAL.stone[1];
      if (level < 3 && hash(x, y, 21) < 0.06) c = PAL.stone[1];
      if (level < 2 && noise(x / 4, y / 4, 22) > 0.72) c = PAL.grass[2];
      S.set(x, y, c);
    }
    // runes on the steps light up with level
    const runeCols = level >= 5 ? [PAL.magic[4], '#ffffff'] : [PAL.magic[2], PAL.magic[3]];
    for (let k = 0; k < 10; k++) {
      const lit = k < level * 2;
      const x = 6 + k * 5, y = 51 + (k % 2);
      S.set(x, y, lit ? runeCols[frame % 2] : PAL.stone[1]); S.set(x + 1, y + 1, lit ? runeCols[1 - (frame % 2)] : PAL.stone[2]); S.set(x, y + 2, lit ? runeCols[0] : PAL.stone[1]);
    }
    // crescent sculpture
    const ccx = ax, ccy = 16;
    for (let y = -15; y <= 15; y++) for (let x = -15; x <= 15; x++) {
      const outer = x * x + y * y <= 15 * 15, inner = (x - 7) * (x - 7) + (y + 2) * (y + 2) <= 12 * 12;
      if (outer && !inner) {
        let k = x < -8 ? 5 : x < -3 ? 4 : 3;
        if (level === 0 && hash(x, y, 23) < 0.12) k = 1;
        S.set(ccx + x, ccy + y, level >= 5 ? (k >= 4 ? PAL.moon[3] : PAL.moon[2]) : PAL.stone[k]);
      }
    }
    // the moon crystal held in the crescent
    const crystal = level === 0 ? ['#2d2c3e', '#45445a', '#605f78'] : level < 5 ? [PAL.magic[1], PAL.magic[2], PAL.magic[3 + (frame % 2)]] : ['#c8d4f0', '#e8eeff', '#ffffff'];
    for (let y = -6; y <= 6; y++) { const half = 3 - Math.floor(Math.abs(y) / 2); for (let x = -half; x <= half; x++) S.set(ccx + 3 + x, ccy + 1 + y, crystal[x < 0 ? 2 : x > 0 ? 0 : 1]); }
    // pedestal under crescent
    S.rect(ccx - 4, 30, 9, 2, PAL.stone[4]);
    S.outline(PAL.outline);
    const lights = [];
    if (level > 0) lights.push({ x: ccx + 3, y: ccy + 1, r: 30 + level * 10, color: level >= 5 ? [220, 230, 255] : [180, 140, 255], i: 0.5 + level * 0.08 });
    return { c: S.canvas(), ax, ay, lights };
  }
  function makeGoddess(restored) {
    const S = new Pix(30, 58), ax = 15, ay = 57;
    S.shadow(ax + 2, ay - 1, 13, 3);
    S.rect(3, 46, 24, 11, PAL.stone[2]); S.rect(2, 45, 26, 2, PAL.stone[4]); S.hline(3, 26, 56, PAL.stone[1]);
    const st = PAL.stone;
    // robe
    for (let y = 16; y < 45; y++) {
      const half = Math.round(4 + (y - 16) * 0.24);
      for (let x = -half; x <= half; x++) {
        let k = x < -half / 2 ? 5 : x < 0 ? 4 : x < half / 2 ? 3 : 2;
        if ((x + 40) % 4 === 0 && y > 26) k--;
        S.set(ax + x, y, st[U.clamp(k, 1, 5)]);
      }
    }
    if (restored) {
      S.disc(ax, 11, 4, 5, st[4]); S.set(ax - 1, 11, st[2]); S.set(ax + 1, 11, st[2]);
      for (let k = 0; k < 9; k++) S.set(ax - 4 + k, 6 - (k % 2), st[5]);
      // arms raising a crescent
      S.line(ax - 4, 20, ax - 9, 10, st[4]); S.line(ax + 4, 20, ax + 9, 10, st[3]);
      for (let a = 0; a < 26; a++) { const t = (a / 26) * Math.PI * 1.25 + 0.95; S.set(ax + Math.cos(t) * 8, 4 + Math.sin(t) * 5 - 2, PAL.moon[3]); }
    } else {
      // headless & broken arm, rubble
      S.set(ax - 1, 15, st[3]); S.set(ax + 1, 15, st[2]);
      S.line(ax - 4, 20, ax - 7, 15, st[4]);
      for (let k = 0; k < 6; k++) S.set(4 + k * 4, 44 - (k % 2), st[3]);
      S.disc(24, 43, 2, 1, st[3]);
      for (let y = 30; y < 44; y++) if (noise(3, y / 3, 9) > 0.5) S.set(ax + 3, y, PAL.leaf[3]);
    }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights: restored ? [{ x: ax, y: 4, r: 30, color: [200, 215, 255], i: 0.55 }] : [] };
  }
  function makeBrazier(lit, frame) {
    const S = new Pix(14, 26), ax = 7, ay = 25;
    S.shadow(ax, ay, 5, 1.5);
    S.rect(5, 12, 4, 12, PAL.stone[2]); S.vline(5, 12, 23, PAL.stone[4]);
    S.rect(2, 22, 10, 3, PAL.stone[3]);
    S.rect(1, 9, 12, 3, PAL.stone[3]); S.hline(1, 12, 9, PAL.stone[5]); S.hline(2, 11, 11, PAL.stone[1]);
    const lights = [];
    if (lit) {
      const fl = [[7, 8], [6, 7], [8, 6], [7, 5], [6, 4], [7, 3], [8, 4]];
      for (let k = 0; k < fl.length; k++) { const [x, y] = fl[k]; S.set(x + ((k + frame) % 3 === 0 ? 1 : 0), y - (frame % 2), k < 2 ? PAL.magic[2] : k < 5 ? PAL.magic[3] : PAL.magic[4]); }
      S.set(5, 8, PAL.magic[2]); S.set(9, 8, PAL.magic[2]);
      lights.push({ x: 7, y: 5, r: 40, color: [175, 130, 255], i: 0.9, flicker: 1 });
    }
    S.outline(PAL.outline);
    return { c: S.canvas(), ax, ay, lights };
  }
  G.Struct = {
    makeHouse, makeTower, makeHut, makeTreehouse, makeCave, makeLamp, makeFence, makeSign, makeBench, makeBarrel, makeCrate,
    makeWell, makeNoticeBoard, makeStall, makeFountain, makeStatue, makeGrave, makeAnvil, makeTelescope, makeBoat, makeCart,
    makePlanter, makePillar, makeRuinWall, makeArch, makeAltar, makeGoddess, makeBrazier, ROOFS, WALLS, drawGlyph,
  };
})();
