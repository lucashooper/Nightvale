// Nightvale — walk-in interiors: the Gilded Owl tavern, Quillon's Threads & Tomes, the Cathedral of the
// Silver Veil and the keeper's cottage. Rooms are painted from InteriorArt surfaces (floor, back wall,
// pools, carpet runner) and furnished with InteriorArt set pieces and FurnitureArt furniture.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.MAT;
  const cache = new Map();
  const IA = () => window.InteriorArt, FA = () => window.FurnitureArt;

  // ---------------------------------------------------------------- sprites
  function stub(w, h, color) { // stand-in when the art module is missing a piece
    const c = document.createElement('canvas'); c.width = w * 16; c.height = h * 16 + 8;
    const x = c.getContext('2d'); x.fillStyle = '#120c1c'; x.fillRect(0, 8, c.width, c.height - 8); x.fillStyle = color || '#4a3b6d'; x.fillRect(1, 9, c.width - 2, c.height - 10);
    return c;
  }
  function iaSprite(id, v) {
    const key = 'ia:' + id + ':' + v; let s = cache.get(key); if (s) return s;
    let r = null;
    try { if (IA() && IA().piece) r = IA().piece(id, v); } catch (e) { r = null; }
    if (!r || !r.c) { const c = stub(1, 1); r = { c, ax: 8, ay: c.height - 1, foot: [1, 1], solid: true, lights: [] }; }
    s = Object.assign({ lights: [] }, r, { w: r.c.width, h: r.c.height });
    cache.set(key, s); return s;
  }
  function furnSprite(id) {
    const key = 'fa:' + id; let s = cache.get(key); if (s) return s;
    let info = null, c = null;
    try { if (FA()) { info = FA().info(id); c = FA().sprite(id); } } catch (e) { c = null; }
    if (!c) c = stub(1, 1, '#574039');
    const w = info ? info.w : 1, h = info ? info.h : 1;
    s = { c, ax: w * 8, ay: c.height - 1, foot: [w, h], solid: !(info && (info.flat || info.wall)), flat: !!(info && info.flat), wall: !!(info && info.wall), lights: [] };
    if (info && info.light) s.lights.push({ x: info.light.x, y: info.light.y, r: info.light.r || 40, color: info.light.color, i: 0.85, flicker: 1 });
    cache.set(key, s); return s;
  }
  G.PROPS.room = { solid: true, make: (o) => (o.furn ? furnSprite(o.id) : iaSprite(o.id, o.v || 0)) };

  // ---------------------------------------------------------------- room builder
  // spec: { id, name, w, h, wall (back wall rows), kind (surface style), zone, ambDay, ambNight, door: {x, to, at} }
  function Room(spec) {
    const m = new G.GameMap(spec.id, spec.w, spec.h, { name: spec.name, zone: spec.zone || spec.id, outdoor: false, decorDensity: 0, base: M.FLOOR });
    m.interior = true; m.doors = []; m.pools = []; m.runners = []; m.shafts = [];
    m.wallRows = spec.wall; m.kind = spec.kind; m.ambDay = spec.ambDay; m.ambNight = spec.ambNight; m.voidColor = '#0b0812';
    // walls are solid: back wall rows, both side columns, the front wall except the doorway
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (y < spec.wall || x === 0 || x === m.w - 1 || (y === m.h - 1 && x !== spec.door.x)) m.solid[m.idx(x, y)] = 1;
    }
    m.exits.push({ rect: [spec.door.x, m.h - 1, 1, 1], to: spec.door.to, at: spec.door.at });
    m.spawns = { door: [spec.door.x + 0.5, m.h - 1.5, 'up'] };
    m.doorX = spec.door.x;
    m.bake = function () { this.baked = paint(this); this.decorBlock = () => true; this.decorLights = []; };
    // place an InteriorArt piece; pieces carry their own footprint and solidity
    m.piece = function (id, v, tx, ty, extra) {
      const s = iaSprite(id, v || 0);
      return place(this, { id, v: v || 0 }, s, tx, ty, extra);
    };
    m.furn = function (id, tx, ty, extra) {
      const s = furnSprite(id);
      return place(this, { id, furn: true }, s, tx, ty, extra);
    };
    m.pool = function (x, y, w, h, hue) { this.pools.push({ x, y, w, h, hue }); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { this.set(x + i, y + j, M.POOL); this.solid[this.idx(x + i, y + j)] = 1; } };
    m.runner = function (x, y, w, h) { this.runners.push({ x, y, w, h }); };
    // a shaft of coloured light from a window down onto the floor (sprite-space of the map, pixels)
    m.shaft = function (x0, y0, x1, y1, w0, w1, color, i) { this.shafts.push({ x0, y0, x1, y1, w0, w1, color, i: i || 0.5 }); this.staticLights.push({ shaft: true, x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: Math.hypot(x1 - x0, y1 - y0) / 2 + Math.max(w0, w1), x0, y0, x1, y1, w0, w1, color, i: i || 0.5 }); };
    m.glow = function (tx, ty, r, color, i) { this.staticLights.push({ x: tx * 16, y: ty * 16, r, color, i: i == null ? 0.6 : i }); };
    return m;
  }
  function place(m, base, s, tx, ty, extra) {
    extra = extra || {};
    const o = Object.assign({}, base, { foot: s.foot || [1, 1], solid: extra.solid != null ? extra.solid : s.solid }, extra);
    if (s.overhead) { o.ghost = true; o.solid = false; o.sortY = 1e7; if (o.dy == null) o.dy = -26; } // hang from the ceiling, above heads
    else if (s.flat) { o.ghost = true; o.solid = false; o.sortY = -1e6 + ty; }
    const p = m.add('room', tx, ty, o);
    if (p && s.flat) p.flat = true;
    return p;
  }

  // ---------------------------------------------------------------- painting
  function paint(m) {
    const W = m.w * 16, H = m.h * 16, wallPx = m.wallRows * 16;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const shimmer = [];
    const ia = IA();
    const tryDraw = (fn, dx, dy, fallback) => { let img = null; try { img = fn(); } catch (e) { img = null; } if (img && (img.c || img.width)) { x.drawImage(img.c || img, dx, dy); return img; } if (fallback) { x.fillStyle = fallback[0]; x.fillRect(dx, dy, fallback[1], fallback[2]); } return null; };
    // floor (under everything, including the walls' bases)
    tryDraw(() => ia && ia.floor(m.kind, W - 32, H - wallPx, m.seed), 16, wallPx, ['#3e2d2b', W - 32, H - wallPx]);
    // carpet runners and pools
    for (const r of m.runners) tryDraw(() => ia && ia.runner(r.w * 16, r.h * 16, m.seed + r.x), r.x * 16, r.y * 16, ['#3b2160', r.w * 16, r.h * 16]);
    for (const p of m.pools) {
      const img = tryDraw(() => ia && ia.pool(p.w * 16, p.h * 16, p.hue, m.seed + p.x * 7), p.x * 16, p.y * 16, ['#2e4f9f', p.w * 16, p.h * 16]);
      if (img && img.shimmer) for (let i = 0; i < img.shimmer.length; i += 2) shimmer.push(p.x * 16 + img.shimmer[i], p.y * 16 + img.shimmer[i + 1]);
    }
    // back wall
    tryDraw(() => ia && ia.wall(m.kind, W - 32, wallPx, m.seed), 16, 0, ['#4b3f4c', W - 32, wallPx]);
    // side walls: the dark tops of the walls, with a lit inner edge
    const top = '#17112a', edge = '#3a2f55', edge2 = '#241b3a';
    x.fillStyle = top; x.fillRect(0, 0, 16, H); x.fillRect(W - 16, 0, 16, H);
    x.fillStyle = edge; x.fillRect(14, wallPx, 2, H - wallPx - 16); x.fillRect(W - 16, wallPx, 2, H - wallPx - 16);
    x.fillStyle = edge2; x.fillRect(12, wallPx, 2, H - wallPx - 16); x.fillRect(W - 14, wallPx, 2, H - wallPx - 16);
    // inner shadow along the side walls and under the back wall
    for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(14,8,24,${0.32 - k * 0.05})`; x.fillRect(16 + k, wallPx, 1, H - wallPx - 16); x.fillRect(W - 17 - k, wallPx, 1, H - wallPx - 16); x.fillRect(16, wallPx + k, W - 32, 1); }
    // front wall: a thin dark band with a lit top edge; the doorway is open with a mat and a bright sill
    x.fillStyle = top; x.fillRect(0, H - 16, W, 16);
    x.fillStyle = edge; x.fillRect(16, H - 16, W - 32, 2);
    const dx = m.doorX * 16;
    x.fillStyle = '#0b0812'; x.fillRect(dx, H - 16, 16, 16);
    x.fillStyle = '#5a3a2a'; x.fillRect(dx + 1, H - 20, 14, 5); x.fillStyle = '#7a5038'; x.fillRect(dx + 2, H - 19, 12, 3); // doormat
    x.fillStyle = '#9c7a5e'; x.fillRect(dx, H - 16, 16, 1); x.fillStyle = '#6a4a3a'; x.fillRect(dx - 2, H - 16, 2, 16); x.fillRect(dx + 16, H - 16, 2, 16);
    return { canvas: c, shimmer, mm: null, W, H };
  }

  // ---------------------------------------------------------------- the rooms
  function buildTavern() {
    const m = Room({ id: 'tavern', name: 'The Gilded Owl', zone: 'tavern', w: 22, h: 15, wall: 3, kind: 'tavern', ambDay: [150, 120, 140], ambNight: [96, 72, 104], door: { x: 11, to: 'village', at: 'tavern' } });
    // back wall
    m.piece('sconce', 0, 1, 2); m.piece('bottle_shelf', 0, 2, 2); m.piece('owl_statue', 0, 4, 2); m.piece('bottle_shelf', 1, 5, 2);
    m.piece('herbs', 0, 7, 2); m.piece('window_arch', 1, 8, 2); m.piece('sconce', 1, 10, 2); m.piece('herbs', 0, 12, 2);
    m.piece('hearth', 0, 13, 2, { interact: { kind: 'flavor', key: 'tavern_hearth' } });
    m.piece('sconce', 0, 16, 2); m.piece('moon_window', 0, 17, 2, { interact: { kind: 'flavor', key: 'tavern_window' } }); m.piece('herbs', 0, 20, 2);
    // the bar (Elvis) and the kitchen pass (Sable)
    const bar = { kind: 'shop', npc: 'elvis', hours: [10, 26], name: 'the bar', needNpc: true };
    m.piece('bar_l', 0, 2, 6, { interact: bar });
    for (let x = 3; x <= 8; x++) m.piece('bar_m', [0, 1, 2, 0, 3, 1][x - 3], x, 6, { interact: bar });
    m.piece('bar_r', 0, 9, 6, { interact: bar });
    m.piece('keg_rack', 0, 7, 3, { interact: { kind: 'flavor', key: 'tavern_bottles' } });
    const kitchen = { kind: 'shop', npc: 'sable', hours: [10, 26], name: 'the kitchen' };
    m.piece('bar_l', 0, 11, 4, { interact: kitchen }); m.piece('bar_r', 0, 12, 4, { interact: kitchen });
    m.piece('mulled_pot', 0, 11, 3);
    for (const x of [3, 5, 7, 9]) m.piece('stool', 0, x, 7, { solid: false });
    // the stage (Sable sings here in the evening)
    m.piece('stage', 0, 16, 9, { solid: [0, 0, 0, 0, 1, 1, 1, 1], sortY: 9 * 16 + 1, interact: { kind: 'flavor', key: 'tavern_stage' } }); // drawn under whoever is performing
    m.piece('piano', 0, 19, 13);
    // tables
    m.piece('rug_round', 0, 10, 10);
    for (const [x, y, v] of [[12, 8, 0], [8, 10, 2], [12, 11, 1], [4, 9, 0], [4, 12, 1], [16, 12, 0]]) {
      m.piece('table_round', v, x, y);
      m.piece('chair', 3, x - 1, y, { solid: false }); m.piece('chair', 2, x + 1, y, { solid: false });
    }
    m.piece('plant_pot', 1, 20, 3); m.piece('plant_pot', 0, 1, 13); m.piece('plant_pot', 0, 20, 7);
    m.piece('chandelier', 0, 6, 9); m.piece('chandelier', 0, 13, 9);
    m.examine.set(m.idx(17, 8), 'tavern_chandelier');
    m.glow(6.5, 6, 70, [255, 190, 110], 0.5); m.glow(14, 4, 80, [150, 255, 170], 0.35);
    Object.assign(m.spawns, { bar: [5.5, 7.9, 'up'] });
    m.music = 'tavern';
    return m;
  }

  function buildBoutique() {
    const m = Room({ id: 'boutique', name: "Quillon's Threads & Tomes", zone: 'boutique', w: 17, h: 12, wall: 3, kind: 'boutique', ambDay: [156, 118, 120], ambNight: [100, 70, 104], door: { x: 8, to: 'village', at: 'boutique' } });
    // back wall: the big shop window and shelves of old books
    m.piece('bay_window', 0, 7, 2);
    m.piece('bookshelf', 0, 1, 3, { interact: { kind: 'flavor', key: 'boutique_books' } }); m.piece('bookshelf', 2, 3, 3, { interact: { kind: 'flavor', key: 'boutique_ladder' } });
    m.piece('book_pile', 1, 5, 3);
    m.piece('crow_perch', 0, 11, 3, { interact: { kind: 'flavor', key: 'boutique_crow' } });
    m.piece('bookshelf', 1, 12, 3, { interact: { kind: 'flavor', key: 'boutique_books' } }); m.piece('bookshelf', 0, 14, 3, { interact: { kind: 'flavor', key: 'boutique_books' } });
    // the till (Isolde)
    const till = { kind: 'shop', npc: 'isolde', hours: [9, 19], name: 'the till', needNpc: true };
    m.piece('till', 0, 8, 6, { interact: till });
    // racks, dress forms, hats, the mirror
    m.piece('rack', 0, 2, 6, { interact: { kind: 'flavor', key: 'boutique_rack' } }); m.piece('rack', 1, 2, 8, { interact: { kind: 'flavor', key: 'boutique_rack' } });
    m.piece('hat_stand', 0, 5, 6);
    m.piece('dress_form', 0, 12, 6); m.piece('dress_form', 1, 14, 6); m.piece('dress_form', 2, 13, 8); m.piece('dress_form', 3, 11, 8);
    m.piece('mirror', 0, 15, 9, { interact: { kind: 'mirror' } });
    m.piece('display_table', 0, 6, 9); m.piece('trunk', 0, 10, 10);
    m.piece('armchair', 2, 1, 10); m.piece('lamp_table', 0, 2, 10);
    m.piece('fabric_bolts', 0, 4, 9); m.piece('sewing_table', 0, 13, 10);
    m.piece('hanging_lamp', 0, 4, 7); m.piece('hanging_lamp', 0, 12, 7); m.piece('hanging_lamp', 0, 8, 9);
    m.glow(8.5, 5, 90, [255, 150, 70], 0.4); m.glow(3, 9, 60, [190, 120, 255], 0.35); m.glow(13, 9, 60, [190, 120, 255], 0.3);
    m.music = 'boutique';
    return m;
  }

  function buildCathedral() {
    const m = Room({ id: 'cathedral', name: 'The Cathedral of the Silver Veil', zone: 'cathedral', w: 25, h: 22, wall: 5, kind: 'cathedral', ambDay: [176, 168, 210], ambNight: [92, 86, 140], door: { x: 12, to: 'village', at: 'cathedral' } });
    // the east wall: organ, four tall windows, the rose
    m.piece('organ', 0, 1, 4);
    const win = (v, x, key) => m.piece('glass_tall', v, x, 4, { interact: { kind: 'flavor', key } });
    win(0, 5, 'cathedral_window_1'); m.piece('banner', 0, 7, 4); win(1, 8, 'cathedral_window_2');
    m.piece('rose_window', 0, 11, 4, { interact: { kind: 'flavor', key: 'cathedral_window_3' } });
    win(2, 15, 'cathedral_window_4'); m.piece('banner', 1, 17, 4); win(3, 18, 'cathedral_window_2'); m.piece('banner', 2, 21, 4);
    // the Veil Altar, candles, the lectern
    m.altar = m.piece('altar', 0, 11, 6, { interact: { kind: 'pray' } });
    m.piece('candelabra', 0, 9, 6); m.piece('candelabra', 0, 15, 6);
    m.piece('votive_rack', 0, 5, 6); m.piece('votive_rack', 0, 18, 6);
    m.piece('lectern', 0, 10, 8); m.piece('statue', 0, 22, 6);
    // the nave: a long central pool flanked by columns; side aisles with pews and smaller pools
    m.runner(11, 8, 3, 2); m.runner(11, 17, 3, 4);
    m.pool(10, 10, 5, 7, 'azure');
    m.pool(2, 16, 4, 3, 'rose'); m.pool(19, 16, 4, 3, 'gold');
    for (const y of [9, 12, 15, 18]) { m.piece('pillar', 0, 7, y); m.piece('pillar', 0, 17, y); }
    for (const y of [9, 11, 13]) { m.piece('pew', 0, 2, y); m.piece('pew', 0, 20, y); }
    m.piece('tree_planter', 0, 1, 19, { interact: { kind: 'flavor', key: 'cathedral_tree' } }); m.piece('tree_planter', 0, 22, 19, { interact: { kind: 'flavor', key: 'cathedral_tree' } });
    m.piece('font', 0, 9, 19);
    m.piece('glass_bench', 0, 19, 20);
    m.piece('candelabra', 0, 9, 10); m.piece('candelabra', 0, 15, 10); m.piece('candelabra', 0, 9, 16); m.piece('candelabra', 0, 15, 16);
    m.piece('chandelier_iron', 0, 12, 14); m.piece('chandelier_iron', 0, 4, 11); m.piece('chandelier_iron', 0, 21, 11);
    for (const [x, y] of [[12.5, 13], [4, 17.5], [21, 17.5]]) m.examine.set(m.idx(Math.floor(x), Math.floor(y)), 'cathedral_pool');
    // coloured light: shafts from the windows across the nave, the pools glowing in their colours
    const T = 16;
    m.shaft(6 * T, 2 * T, 8 * T, 13 * T, 22, 50, [255, 110, 190], 0.7);
    m.shaft(9 * T, 2 * T, 10.5 * T, 13 * T, 22, 50, [120, 170, 255], 0.7);
    m.shaft(12.5 * T, 1 * T, 12.5 * T, 13 * T, 40, 80, [255, 220, 150], 0.75);
    m.shaft(16 * T, 2 * T, 14.5 * T, 13 * T, 22, 50, [110, 255, 200], 0.7);
    m.shaft(19 * T, 2 * T, 17 * T, 13 * T, 22, 50, [190, 130, 255], 0.7);
    m.glow(12.5, 13.5, 90, [110, 170, 255], 0.55); m.glow(4, 17.5, 60, [255, 110, 180], 0.55); m.glow(21, 17.5, 60, [255, 210, 110], 0.55);
    m.glow(12.5, 7, 70, [235, 235, 255], 0.5);
    Object.assign(m.spawns, { altar: [12.5, 8.9, 'up'] });
    m.music = 'cathedral';
    return m;
  }

  function buildCottage() {
    const m = Room({ id: 'cottage', name: "The Keeper's Cottage", zone: 'home', w: 14, h: 11, wall: 3, kind: 'cottage', ambDay: [168, 140, 150], ambNight: [100, 80, 110], door: { x: 6, to: 'sanctum', at: 'door' } });
    m.piece('hearth', 0, 9, 2, { interact: { kind: 'flavor', key: 'cottage_hearth' } });
    m.piece('window_arch', 0, 3, 2); m.piece('window_arch', 0, 7, 2);
    m.home = true;
    m.spawns.bed = [3.5, 6.9, 'down'];
    if (G.Decor && G.S) G.Decor.furnish(m);
    m.music = 'home';
    return m;
  }

  // ---------------------------------------------------------------- the south quarter
  const fl = (key) => ({ kind: 'flavor', key });
  function buildGuild() {
    const m = Room({ id: 'guild', name: 'The Silver Crescent Guild', zone: 'guild', w: 18, h: 12, wall: 3, kind: 'guild', ambDay: [150, 136, 150], ambNight: [96, 84, 110], door: { x: 9, to: 'village', at: 'guild' } });
    // back wall: the contract board, trophies, banners, the great hearth, the weapon rack
    m.piece('contract_board', 0, 2, 2, { interact: { kind: 'board', board: 'guild' } });
    m.piece('trophy_wolf', 0, 6, 2, { interact: fl('guild_trophy_wolf') });
    m.piece('guild_banner', 0, 7, 2);
    m.piece('guild_hearth', 0, 8, 2, { interact: fl('guild_hearth') });
    m.piece('guild_banner', 1, 11, 2);
    m.piece('trophy_stag', 0, 12, 2, { interact: fl('guild_trophy_stag') });
    m.piece('weapon_rack', 0, 14, 2);
    m.piece('guild_banner', 2, 16, 2);
    // Gideon's desk, the map table, the long tables
    m.piece('guild_desk', 0, 8, 5, { interact: { kind: 'talk', npc: 'gideon' } });
    m.piece('map_table', 0, 14, 5, { interact: fl('guild_map_table') });
    m.piece('slime_jar', 0, 16, 4, { interact: fl('guild_slime_jar') });
    m.piece('long_table', 0, 2, 7, { interact: fl('guild_long_table') });
    m.piece('long_table', 0, 2, 9, { interact: fl('guild_long_table') });
    m.piece('candle_cluster', 0, 1, 4);
    m.piece('plant_pot', 0, 16, 9);
    m.runner(8, 7, 2, 4);
    m.glow(9.5, 4, 90, [255, 170, 90], 0.55); m.glow(3.5, 8.5, 60, [255, 200, 130], 0.35); m.glow(15, 6, 50, [255, 200, 130], 0.3);
    Object.assign(m.spawns, { desk: [9, 4.6, 'down'] });
    m.music = 'tavern';
    return m;
  }
  function buildRunesmithy() {
    const m = Room({ id: 'runesmithy', name: 'The Ashvale Runesmithy', zone: 'runesmithy', w: 16, h: 11, wall: 3, kind: 'smithy', ambDay: [142, 118, 120], ambNight: [96, 76, 92], door: { x: 7, to: 'village', at: 'runesmithy' } });
    m.piece('collection_cabinet', 0, 1, 2, { interact: { kind: 'cabinet' } });
    m.piece('weapon_rack', 0, 6, 2);
    m.piece('rune_forge', 0, 11, 3, { interact: fl('smithy_forge') });
    m.piece('anvil_rune', 0, 9, 5, { interact: { kind: 'shop', npc: 'ronan', hours: [8, 19], name: 'the anvil', needNpc: true } });
    m.piece('quench_trough', 0, 12, 6, { interact: fl('smithy_trough') });
    m.piece('ore_crate', 0, 1, 5, { interact: fl('smithy_crates') }); m.piece('ore_crate', 1, 2, 5, { interact: fl('smithy_crates') }); m.piece('ore_crate', 2, 1, 6, { interact: fl('smithy_crates') });
    m.piece('grindstone', 0, 5, 5, { interact: fl('smithy_grindstone') });
    m.piece('candle_cluster', 0, 14, 3);
    m.glow(12, 4, 100, [255, 140, 70], 0.6); m.glow(9.5, 6, 40, [90, 230, 220], 0.3); m.glow(3, 3.5, 60, [190, 150, 255], 0.3);
    Object.assign(m.spawns, { anvil: [10.5, 5.6, 'left'] });
    m.music = 'boutique';
    return m;
  }
  function buildMenagerie() {
    const m = Room({ id: 'menagerie', name: "Drake's Menagerie", zone: 'menagerie', w: 16, h: 11, wall: 3, kind: 'menagerie', ambDay: [168, 150, 140], ambNight: [100, 84, 96], door: { x: 7, to: 'village', at: 'menagerie' } });
    m.piece('saddle_rack', 0, 1, 2, { interact: fl('menagerie_saddles') }); m.piece('saddle_rack', 0, 2, 2, { interact: fl('menagerie_saddles') });
    m.piece('window_arch', 1, 6, 2);
    m.piece('hay_bale', 0, 1, 3, { interact: fl('menagerie_hay') }); m.piece('hay_bale', 0, 2, 3, { interact: fl('menagerie_hay') });
    m.piece('perch_stand', 0, 4, 4);
    m.piece('egg_incubator', 0, 9, 3, { interact: fl('menagerie_incubator') });
    m.piece('pet_cage', 0, 12, 3);
    m.piece('aquarium', 0, 13, 3, { interact: fl('menagerie_aquarium') });
    m.piece('feed_counter', 0, 8, 5, { interact: { kind: 'shop', npc: 'caspian', hours: [9, 19], name: 'the counter', needNpc: true } });
    m.piece('pet_bed_round', 0, 2, 7); m.piece('pet_bed_round', 1, 4, 8); m.piece('pet_bed_round', 0, 13, 8);
    m.glow(9, 4, 70, [255, 200, 140], 0.35); m.glow(14, 4, 40, [120, 200, 255], 0.3);
    Object.assign(m.spawns, { counter: [8.5, 4.6, 'down'] });
    m.music = 'boutique';
    return m;
  }
  // ---------------------------------------------------------------- homes with personality
  function buildLauraHome() {
    const m = Room({ id: 'laura_home', name: "Laura's House", zone: 'home', w: 14, h: 10, wall: 3, kind: 'alt', ambDay: [150, 128, 150], ambNight: [104, 86, 116], door: { x: 6, to: 'village', at: 'laura_home' } });
    m.piece('band_poster', 0, 2, 2); m.piece('fairy_lights', 0, 3, 2); m.piece('lace_window', 0, 6, 2); m.piece('band_poster', 1, 9, 2); m.piece('fairy_lights', 0, 10, 2);
    m.piece('alt_bed', 0, 1, 3, { interact: fl('laura_bed') });
    m.piece('candle_cluster', 0, 3, 3); m.piece('record_player', 0, 4, 3, { interact: fl('laura_records') }); m.piece('vinyl_crate', 0, 5, 3, { interact: fl('laura_records') });
    m.piece('vanity_dark', 0, 9, 3, { interact: fl('laura_vanity') }); m.piece('skull_planter', 0, 12, 3); m.piece('guitar_stand', 0, 11, 4, { interact: fl('laura_guitar') });
    m.piece('skull_planter', 0, 8, 7); m.piece('candle_cluster', 0, 1, 7);
    m.glow(4, 3.5, 50, [255, 170, 110], 0.4); m.glow(7, 3, 70, [200, 150, 255], 0.35); m.glow(10, 6, 60, [255, 120, 200], 0.25);
    m.home = true; m.owner = 'laura';
    return m;
  }
  // design alternatives (Settings > Designs): 'a' is the original room; 'b' / 'c' are drawn in js/art/alt_rooms.js as
  // the surface kinds `<kind>_b` / `<kind>_c`. A look whose art is missing falls back to 'a'.
  function homeLook(look, kind) {
    const K = window.InteriorArt && InteriorArt._kit;
    return (look === 'b' || look === 'c') && K && K.WALLS[kind + '_' + look] && K.FLOORS[kind + '_' + look] ? look : 'a';
  }
  // villagers walk to fixed spots in their homes (npcs.js): Jasmine (9.5, 6.6), (2.5, 5.6), (7, 4.6); Amara (3, 5.6),
  // (9.5, 5.6), (7.5, 7.4). Every layout keeps those tiles clear and reachable from the door.
  function buildJasmineHome(look) {
    look = homeLook(look || G.alt('home_jasmine'), 'pastel');
    if (look !== 'a') return buildJasmineAlt(look);
    const m = Room({ id: 'jasmine_home', name: "Jasmine's Cottage", zone: 'home', w: 14, h: 10, wall: 3, kind: 'pastel', ambDay: [176, 160, 160], ambNight: [110, 92, 108], door: { x: 6, to: 'village', at: 'jasmine_home' } });
    m.piece('bunting', 0, 1, 2); m.piece('honey_shelf', 0, 5, 2, { interact: fl('jasmine_honey') }); m.piece('bunting', 0, 9, 2);
    m.piece('bear_bed', 0, 1, 3, { interact: fl('jasmine_bed') }); m.piece('giant_bear', 0, 4, 3, { interact: fl('jasmine_bear') });
    m.piece('baking_counter', 0, 6, 3, { interact: fl('jasmine_counter') }); m.piece('pastel_dresser', 0, 9, 3); m.piece('flower_vase', 0, 12, 3);
    m.piece('bee_rug', 0, 5, 6); m.piece('tea_table', 0, 9, 6); m.piece('plush_pile', 0, 3, 6); m.piece('flower_vase', 1, 11, 7); m.piece('lamp_table', 0, 12, 6);
    m.glow(7, 4, 60, [255, 210, 150], 0.35); m.glow(12, 6, 50, [255, 220, 170], 0.35);
    m.home = true; m.owner = 'jasmine';
    return m;
  }
  function buildJasmineAlt(look) {
    const B = look === 'b';
    const m = Room({ id: 'jasmine_home', name: "Jasmine's Cottage", zone: 'home', w: 14, h: 10, wall: 3, kind: 'pastel_' + look,
      ambDay: B ? [180, 160, 146] : [172, 164, 180], ambNight: B ? [112, 90, 96] : [100, 92, 122], door: { x: 6, to: 'village', at: 'jasmine_home' } });
    if (B) { // the Honey Bakery: a brick bread oven, a honey hutch, butter-yellow walls and honeycomb tiles
      m.piece('bee_sampler_b', 0, 3, 2); m.piece('pan_rack_b', 0, 6, 2); m.piece('cottage_window_b', 0, 8, 2);
      m.piece('honey_bed_b', 0, 1, 3, { interact: fl('jasmine_bed') }); m.piece('nightstand_b', 0, 3, 3);
      m.piece('bread_oven_b', 0, 4, 3); m.piece('baking_counter_b', 0, 6, 3, { interact: fl('jasmine_counter') });
      m.piece('flour_sacks_b', 0, 8, 3); m.piece('honey_shelf_b', 0, 10, 3, { interact: fl('jasmine_honey') }); m.piece('sunflowers_b', 0, 12, 3);
      m.piece('rag_rug_b', 0, 6, 5); m.piece('spindle_chair_b', 0, 7, 6); m.piece('honey_table_b', 0, 8, 6);
      m.piece('yarn_basket_b', 0, 1, 7); m.piece('giant_bear_b', 0, 10, 7, { interact: fl('jasmine_bear') }); m.piece('sunflowers_b', 1, 12, 7);
      m.glow(5, 4, 60, [255, 160, 90], 0.3); m.glow(9, 3.5, 70, [255, 226, 160], 0.3);
    } else { // the Wisteria Sunroom: lilac shiplap, wicker, a window of honey jars and a peacock chair for the bear
      m.piece('peg_rail_c', 0, 4, 2); m.piece('honey_window_c', 0, 9, 2, { interact: fl('jasmine_honey') }); m.piece('plant_shelf_c', 0, 11, 2);
      m.piece('canopy_bed_c', 0, 1, 3, { interact: fl('jasmine_bed') }); m.piece('wicker_stand_c', 0, 3, 3); m.piece('tea_cart_c', 0, 4, 3);
      m.piece('retro_stove_c', 0, 6, 3, { interact: fl('jasmine_counter') }); m.piece('birdcage_c', 0, 11, 3); m.piece('monstera_c', 0, 12, 3);
      m.piece('lace_rug_c', 0, 6, 6); m.piece('peacock_bear_c', 0, 7, 6, { interact: fl('jasmine_bear') });
      m.piece('bistro_chair_c', 0, 10, 5); m.piece('bistro_table_c', 0, 11, 5); m.piece('bistro_chair_c', 1, 12, 5);
      m.piece('wisteria_tree_c', 0, 1, 7); m.piece('lavender_crate_c', 0, 12, 8);
      m.glow(9.5, 4, 70, [255, 214, 140], 0.3); m.glow(11, 6, 50, [214, 190, 255], 0.22);
    }
    m.home = true; m.owner = 'jasmine'; m.look = look;
    return m;
  }
  function buildAmaraHome(look) {
    look = homeLook(look || G.alt('home_amara'), 'study');
    if (look !== 'a') return buildAmaraAlt(look);
    const m = Room({ id: 'amara_home', name: "Amara's Study", zone: 'home', w: 14, h: 10, wall: 3, kind: 'study', ambDay: [150, 160, 170], ambNight: [96, 100, 124], door: { x: 6, to: 'village', at: 'amara_home' } });
    m.piece('chalkboard', 0, 2, 2, { interact: fl('amara_chalkboard') }); m.piece('star_chart', 0, 5, 2); m.piece('star_chart', 1, 6, 2); m.piece('window_arch', 1, 9, 2);
    m.piece('alchemy_desk', 0, 1, 3, { interact: fl('amara_desk') }); m.piece('book_tower', 0, 4, 3); m.piece('orrery', 0, 6, 4, { interact: fl('amara_orrery') });
    m.piece('brass_telescope', 0, 9, 4, { interact: fl('amara_telescope') }); m.piece('fern_pot', 0, 12, 3);
    m.piece('beanbag', 0, 7, 6); m.piece('book_tower', 1, 11, 6); m.piece('book_tower', 2, 2, 6); m.piece('hanging_lamp', 0, 7, 5);
    m.glow(2.5, 4, 50, [120, 255, 200], 0.35); m.glow(7, 6, 60, [255, 210, 150], 0.35);
    m.home = true; m.owner = 'amara';
    return m;
  }
  function buildAmaraAlt(look) {
    const B = look === 'b';
    const m = Room({ id: 'amara_home', name: "Amara's Study", zone: 'home', w: 14, h: 10, wall: 3, kind: 'study_' + look,
      ambDay: B ? [168, 150, 140] : [168, 172, 186], ambNight: B ? [100, 88, 110] : [96, 104, 132], door: { x: 6, to: 'village', at: 'amara_home' } });
    if (B) { // the Attic Stargazer: pine boards under the roof slope, a round window, a hammock and a cork board of stars
      m.piece('star_board_b', 0, 4, 2, { interact: fl('amara_chalkboard') }); m.piece('round_window_b', 0, 8, 2); m.piece('star_garland_b', 0, 1, 2);
      m.piece('pothos_stool_b', 0, 1, 3); m.piece('drafting_desk_b', 0, 2, 3, { interact: fl('amara_desk') });
      m.piece('armillary_b', 0, 6, 3, { interact: fl('amara_orrery') }); m.piece('book_stack_b', 0, 7, 3);
      m.piece('low_shelf_b', 0, 8, 3); m.piece('tall_bookcase_b', 0, 11, 3);
      m.piece('big_telescope_b', 0, 9, 4, { interact: fl('amara_telescope') });
      m.piece('moon_rug_b', 0, 6, 5); m.piece('hammock_b', 0, 7, 6); m.piece('celestial_globe_b', 0, 4, 6);
      m.piece('mustard_armchair_b', 0, 11, 6); m.piece('book_stack_b', 1, 12, 7); m.piece('book_stack_b', 0, 1, 7);
      m.glow(4, 4, 50, [150, 255, 190], 0.25); m.glow(9.5, 2.5, 70, [200, 200, 255], 0.3);
    } else { // the Delft Blue Study: white plaster and blue-and-white tiles, a porcelain orrery and a cobalt chaise
      m.piece('plate_wall_c', 0, 3, 2); m.piece('arch_window_c', 0, 10, 2);
      m.piece('tall_shelf_c', 0, 1, 3); m.piece('writing_desk_c', 0, 3, 3, { interact: fl('amara_desk') }); m.piece('lemon_tree_c', 0, 5, 3);
      m.piece('blackboard_c', 0, 6, 3, { interact: fl('amara_chalkboard') }); m.piece('celestial_globe_c', 0, 8, 3);
      m.piece('window_seat_c', 0, 10, 3); m.piece('map_chest_c', 0, 12, 3);
      m.piece('refractor_c', 0, 9, 4, { interact: fl('amara_telescope') }); m.piece('orrery_c', 0, 11, 5, { interact: fl('amara_orrery') });
      m.piece('rug_c', 0, 6, 6); m.piece('chaise_c', 0, 7, 6); m.piece('floor_lamp_c', 0, 12, 7); m.piece('book_pile_c', 0, 1, 7);
      m.glow(3.5, 4, 50, [255, 226, 180], 0.25); m.glow(10.5, 3, 70, [200, 214, 255], 0.3);
    }
    m.home = true; m.owner = 'amara'; m.look = look;
    return m;
  }

  G.buildInteriors = function () {
    return { tavern: buildTavern(), boutique: buildBoutique(), cathedral: buildCathedral(), cottage: buildCottage(),
      guild: buildGuild(), runesmithy: buildRunesmithy(), menagerie: buildMenagerie(),
      laura_home: buildLauraHome(), jasmine_home: buildJasmineHome(), amara_home: buildAmaraHome() };
  };
  G.Interiors = { iaSprite, furnSprite };
  G.Interiors.homes = { jasmine_home: buildJasmineHome, amara_home: buildAmaraHome };
})();
