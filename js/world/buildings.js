// Nightvale — every building in the valley, drawn by GothicArt in the style chosen for it:
// houses & shops in Hogsmeade Crooked, the cathedral & chapel in Cathedral Gothic, the observatory in
// Moonstone Gothic, Grizelda's hut and the Deepwood ruins in Witchwood Gothic.
// Registers the 'gothic' and 'ruin' prop types (footprint from the definition; the door lands on doorTile).
(function () {
  'use strict';
  const G = window.G;

  // spec x/y are pixels relative to the main wall's left edge / top edge; door.x is derived from doorTile
  const B = {
    // ---------------------------------------------------------------- the Sanctum
    cottage: { style: 'crooked', foot: [5, 2], doorTile: 2, spec: {
      w: 78, wallH: 42, floors: 2, roofH: 30, steep: 0.18, groundStone: true, over: { mossy: true, lean: 3 },
      gables: [{ cx: 57, hw: 13, h: 24 }], dormers: [24], chimneys: [7],
      windows: [{ x: 9, y: 6, w: 9, h: 9, shutters: true }, { x: 38, y: 6, w: 7, h: 8 }, { x: 8, y: 25, w: 11, h: 9, box: true }, { x: 57, y: 25, w: 11, h: 9, box: true }],
      door: { w: 12, h: 18 }, lanterns: [{ x: 49, y: 25 }], ivy: 5, seed: 11 } },

    // ---------------------------------------------------------------- Hollowmere
    seedshop: { style: 'crooked', foot: [6, 3], doorTile: 2, spec: {
      w: 94, wallH: 50, floors: 2, roofH: 30, steep: 0.2, groundStone: false,
      gables: [{ cx: 70, hw: 15, h: 28, win: 'round' }], dormers: [30], chimneys: [10, 84],
      windows: [{ x: 8, y: 6, w: 9, h: 10, shutters: true, box: true }, { x: 44, y: 6, w: 9, h: 10, shutters: true, box: true }, { x: 62, y: 29, w: 22, h: 14, type: 'shop', goods: 'jars' }, { x: 8, y: 30, w: 9, h: 10, box: true }],
      awnings: [{ x: 58, y: 23, w: 30, colors: ['#2f6a4a', '#d2c4c2'] }],
      door: { w: 12, h: 19 }, sign: { x: 47, y: 25, icon: 'sprout', hang: true }, lanterns: [{ x: 26, y: 29 }], seed: 21 } },
    tavern: { style: 'crooked', foot: [10, 4], doorTile: 4, spec: {
      w: 156, wallH: 60, floors: 2, roofH: 34, steep: 0.16, groundStone: true,
      gables: [{ cx: 26, hw: 18, h: 32 }, { cx: 128, hw: 18, h: 32, win: 'round' }], dormers: [58, 98], chimneys: [8, 144],
      turret: { side: 'left', w: 22, h: 96, coneH: 34, windows: 3, vane: 'owl' },
      windows: [
        { x: 8, y: 7, w: 9, h: 11 }, { x: 40, y: 7, w: 9, h: 11, shutters: true }, { x: 72, y: 7, w: 9, h: 11, shutters: true }, { x: 104, y: 7, w: 9, h: 11 },
        { x: 9, y: 35, w: 13, h: 12, box: true }, { x: 32, y: 35, w: 13, h: 12, box: true }, { x: 96, y: 35, w: 13, h: 12, box: true }, { x: 120, y: 35, w: 13, h: 12, box: true }],
      balconies: [{ x: 66, y: 24, w: 26 }],
      door: { w: 16, h: 22, style: 'double' }, sign: { x: 92, y: 27, icon: 'owl', hang: true }, lanterns: [{ x: 60, y: 34 }, { x: 88, y: 34 }], seed: 31 } },
    boutique: { style: 'crooked', foot: [5, 3], doorTile: 1, spec: {
      w: 78, wallH: 66, floors: 3, floorAt: 0.58, roofH: 30, steep: 0.24,
      over: { plaster: ['#4a3644', '#6a4c5e', '#8a6a78', '#a88896', '#c4a6b0'], roof: ['#140c1c', '#22142e', '#321e44', '#44295a', '#583670'], shutter: ['#3a2410', '#5a3a1c', '#7a5428'] },
      gables: [{ cx: 54, hw: 14, h: 26 }], chimneys: [12],
      turret: { side: 'right', w: 20, h: 104, coneH: 38, windows: 4, vane: 'moon' },
      windows: [{ x: 8, y: 6, w: 9, h: 11, shutters: true }, { x: 34, y: 6, w: 9, h: 11, shutters: true }, { x: 8, y: 23, w: 9, h: 10, box: true }, { x: 34, y: 23, w: 9, h: 10, box: true }, { x: 34, y: 44, w: 26, h: 15, type: 'shop', goods: 'clothes', glass: 'amber' }],
      awnings: [{ x: 31, y: 38, w: 32, colors: ['#5a2e52', '#e8c8a0'] }],
      door: { w: 12, h: 20 }, sign: { x: 58, y: 28, icon: 'needle', hang: true }, lanterns: [{ x: 4, y: 42 }], seed: 41 } },
    house_a: { style: 'crooked', foot: [5, 3], doorTile: 1, spec: {
      w: 78, wallH: 50, floors: 2, roofH: 28, steep: 0.2, groundStone: true,
      gables: [{ cx: 56, hw: 14, h: 24 }], chimneys: [64],
      windows: [{ x: 8, y: 7, w: 9, h: 10, shutters: true }, { x: 30, y: 7, w: 9, h: 10 }, { x: 52, y: 30, w: 11, h: 10, box: true }],
      door: { w: 12, h: 19 }, lanterns: [{ x: 34, y: 33 }], seed: 51 } },
    house_b: { style: 'crooked', foot: [4, 3], doorTile: 2, spec: {
      w: 62, wallH: 56, floors: 3, floorAt: 0.55, roofH: 32, steep: 0.24, over: { roof: ['#0e1a20', '#152a32', '#1f3c46', '#2b525e', '#3c6c78'] },
      turret: { side: 'left', w: 18, h: 84, coneH: 30, windows: 3 },
      windows: [{ x: 10, y: 6, w: 8, h: 10 }, { x: 40, y: 6, w: 8, h: 10, shutters: true }, { x: 10, y: 34, w: 9, h: 10, box: true }],
      door: { w: 11, h: 18 }, seed: 61 } },
    house_c: { style: 'crooked', foot: [5, 3], doorTile: 3, spec: {
      w: 78, wallH: 40, floors: 1, roofH: 30, steep: 0.18, mat: 'timber', over: { mossy: true },
      dormers: [18, 42], chimneys: [10],
      windows: [{ x: 8, y: 14, w: 11, h: 10, box: true, shutters: true }, { x: 28, y: 14, w: 11, h: 10, box: true }],
      door: { w: 12, h: 19 }, ivy: 6, seed: 71 } },
    house_d: { style: 'crooked', foot: [5, 3], doorTile: 2, spec: {
      w: 78, wallH: 52, floors: 2, roofH: 30, steep: 0.2, groundStone: true, over: { roof: ['#1a0e16', '#2a1622', '#3c2030', '#522c40', '#6a3a52'] },
      gables: [{ cx: 20, hw: 14, h: 26 }], dormers: [52], chimneys: [66],
      windows: [{ x: 14, y: 7, w: 11, h: 10, shutters: true }, { x: 48, y: 7, w: 9, h: 10 }, { x: 10, y: 31, w: 11, h: 10, box: true }, { x: 56, y: 31, w: 11, h: 10, box: true }],
      door: { w: 12, h: 19 }, lanterns: [{ x: 48, y: 33 }], seed: 81 } },
    house_e: { style: 'crooked', foot: [5, 3], doorTile: 2, spec: {
      w: 78, wallH: 48, floors: 2, roofH: 28, steep: 0.22,
      gables: [{ cx: 40, hw: 16, h: 28, win: 'round' }], chimneys: [8, 68],
      windows: [{ x: 8, y: 7, w: 9, h: 10, shutters: true }, { x: 62, y: 7, w: 9, h: 10, shutters: true }, { x: 10, y: 29, w: 11, h: 10, box: true }, { x: 58, y: 29, w: 11, h: 10, box: true }],
      door: { w: 12, h: 19 }, seed: 91 } },
    glassworks: { style: 'crooked', foot: [6, 3], doorTile: 4, spec: {
      w: 94, wallH: 46, floors: 2, roofH: 28, steep: 0.2, groundStone: true, smokeColor: [255, 170, 110],
      gables: [{ cx: 24, hw: 15, h: 26, win: 'round' }], chimneys: [76],
      windows: [{ x: 50, y: 6, w: 9, h: 10 }, { x: 8, y: 28, w: 30, h: 12, type: 'shop', goods: 'jars', glass: 'stained' }, { x: 44, y: 28, w: 9, h: 10, box: true }],
      door: { w: 12, h: 19 }, sign: { x: 60, y: 22, icon: 'star', hang: true }, lanterns: [{ x: 82, y: 30 }], seed: 101 } },
    cathedral: { style: 'cathedral', foot: [12, 4], doorTile: 5.5, spec: {
      w: 188, wallH: 74, floors: 1, roofH: 44, steep: 0.06,
      towers: [{ x: -4, w: 34, h: 168, spireH: 78, full: true, lancets: 3 }, { x: 158, w: 34, h: 168, spireH: 78, full: true, lancets: 3, clock: true }],
      gables: [{ cx: 94, hw: 52, h: 66, win: 'rose' }],
      buttresses: [44, 68, 116, 140], arcade: { x0: 48, x1: 140, y: 3 },
      windows: [{ x: 51, y: 22, w: 11, h: 34 }, { x: 126, y: 22, w: 11, h: 34 }, { x: 75, y: 24, w: 9, h: 22 }, { x: 104, y: 24, w: 9, h: 22 }],
      niches: [{ x: 66, y: 52 }, { x: 115, y: 52 }],
      pinnacles: [36, 148],
      door: { w: 26, h: 36, style: 'portal' }, lanterns: [{ x: 62, y: 46 }, { x: 126, y: 46 }], gargoyles: true, ivy: 4, seed: 111 } },

    // ---------------------------------------------------------------- Hollowmere's south quarter (chosen in the style picker)
    guildhall: { style: 'cathedral', foot: [11, 4], doorTile: 5, spec: { w: 172, wallH: 66, floors: 2, roofH: 40, steep: 0.08, tower: { x: 66, w: 40, h: 150, spireH: 56, clock: true }, gables: [{ cx: 24, hw: 22, h: 40, win: 'lancet' }, { cx: 148, hw: 22, h: 40, win: 'lancet' }], buttresses: [0, 46, 122, 168], windows: [{ x: 54, y: 14, w: 9, h: 26 }, { x: 108, y: 14, w: 9, h: 26 }, { x: 14, y: 34, w: 9, h: 22 }, { x: 148, y: 34, w: 9, h: 22 }], banners: [{ x: 70, y: 18, h: 24, color: '#2a3a7a' }, { x: 95, y: 18, h: 24, color: '#2a3a7a' }], door: { w: 22, h: 30, style: 'portal' }, lanterns: [{ x: 62, y: 48 }, { x: 108, y: 48 }], gargoyles: true, seed: 302 } },
    runesmithy: { style: 'victorian', foot: [7, 3], doorTile: 2, spec: { w: 108, wallH: 54, floors: 2, roofH: 28, steep: 0.16, smokeColor: [90, 80, 100], chimneys: [8, 90], gables: [{ cx: 76, hw: 18, h: 30, win: 'round' }], forge: { x: 64, w: 24, h: 20 }, windows: [{ x: 12, y: 8, w: 9, h: 14 }, { x: 36, y: 8, w: 9, h: 14 }], door: { w: 14, h: 22, style: 'arch' }, sign: { x: 40, y: 28, icon: 'anvil', hang: true }, lanterns: [{ x: 8, y: 34 }], seed: 313 } },
    menagerie: { style: 'crooked', foot: [8, 3], doorTile: 3.5, spec: { w: 124, wallH: 50, floors: 2, roofH: 34, steep: 0.12, mat: 'boards', over: { roof: ['#2a1418', '#40202a', '#5a2c34', '#74383e', '#904a4c'] }, gables: [{ cx: 62, hw: 24, h: 36, win: 'round' }], chimneys: [110], turret: { side: 'left', w: 18, h: 80, coneH: 30, windows: 2, vane: 'dragon' }, windows: [{ x: 14, y: 24, w: 11, h: 10, shutters: true, box: true }, { x: 98, y: 24, w: 11, h: 10, shutters: true, box: true }], door: { w: 22, h: 24, style: 'double' }, sign: { x: 86, y: 6, icon: 'paw' }, lanterns: [{ x: 42, y: 30 }, { x: 80, y: 30 }], seed: 321 } },

    // ---------------------------------------------------------------- Starfall Ridge
    forge: { style: 'crooked', foot: [6, 3], doorTile: 1, spec: {
      w: 94, wallH: 44, floors: 1, roofH: 28, steep: 0.16, mat: 'stone', smokeColor: [90, 80, 100],
      over: { lean: 2, roof: ['#140f14', '#201820', '#2e2228', '#3e2e32', '#544044'] },
      chimneys: [72], gables: [{ cx: 64, hw: 15, h: 22, win: 'round', mat: 'timber' }],
      windows: [{ x: 56, y: 18, w: 14, h: 12, type: 'shop', goods: 'none', glass: 'amber' }],
      door: { w: 16, h: 22, style: 'double' }, sign: { x: 36, y: 6, icon: 'anvil' }, lanterns: [{ x: 6, y: 20 }], quoins: true, seed: 121 } },
    lodge: { style: 'crooked', foot: [5, 3], doorTile: 2, spec: {
      w: 78, wallH: 44, floors: 1, roofH: 30, steep: 0.2, mat: 'boards', over: { mossy: true, lean: 2 },
      chimneys: [8], gables: [{ cx: 56, hw: 14, h: 24, win: 'casement' }],
      windows: [{ x: 8, y: 16, w: 11, h: 10, shutters: true }, { x: 54, y: 16, w: 11, h: 10, shutters: true }],
      door: { w: 12, h: 20 }, sign: { x: 46, y: 6, icon: 'pick' }, lanterns: [{ x: 26, y: 22 }], seed: 131 } },
    observatory: { style: 'moonstone', foot: [5, 3], doorTile: 2, spec: {
      w: 78, wallH: 46, floors: 1, roofH: 24, steep: 0.18,
      turret: { side: 'right', w: 34, h: 104, coneH: 0, cap: 'dome', windows: 3, band: true },
      gables: [{ cx: 26, hw: 14, h: 24, win: 'rose' }],
      windows: [{ x: 6, y: 14, w: 7, h: 20 }, { x: 44, y: 14, w: 7, h: 20 }],
      door: { w: 12, h: 22, style: 'arch' }, lanterns: [{ x: 22, y: 26 }], ivy: 2, seed: 141 } },
    chapel: { style: 'cathedral', foot: [5, 3], doorTile: 2, spec: {
      w: 78, wallH: 50, floors: 1, roofH: 30, steep: 0.1,
      tower: { x: 54, w: 20, h: 108, spireH: 46 },
      gables: [{ cx: 30, hw: 24, h: 34, win: 'rose' }], buttresses: [-2, 60, 76],
      windows: [{ x: 8, y: 12, w: 7, h: 22 }, { x: 64, y: 12, w: 7, h: 22 }],
      door: { w: 14, h: 24, style: 'portal' }, gargoyles: true, ivy: 5, seed: 151 } },

    // ---------------------------------------------------------------- Glimmermere
    boathouse: { style: 'crooked', foot: [5, 3], doorTile: 1, spec: {
      w: 78, wallH: 42, floors: 1, roofH: 28, steep: 0.2, mat: 'boards', over: { roof: ['#0e1a26', '#16283a', '#22384e', '#304c66', '#446682'] },
      chimneys: [64], gables: [{ cx: 52, hw: 16, h: 26, win: 'round' }],
      windows: [{ x: 50, y: 16, w: 11, h: 10, shutters: true }],
      door: { w: 14, h: 20, style: 'double' }, sign: { x: 30, y: 6, icon: 'fish' }, lanterns: [{ x: 32, y: 22 }], seed: 161 } },

    // ---------------------------------------------------------------- Whisperwood & the Deepwood
    hut: { style: 'witchwood', foot: [4, 2], doorTile: 2, spec: {
      w: 60, wallH: 36, floors: 1, roofH: 36, steep: 0.3, mat: 'boards',
      turret: { side: 'left', w: 16, h: 62, coneH: 34, windows: 1 }, chimneys: [44],
      windows: [{ x: 40, y: 10, w: 9, h: 9, shutters: true }],
      door: { w: 11, h: 19 }, sign: { x: 26, y: 2, icon: 'skull' }, lanterns: [{ x: 50, y: 18 }, { x: 4, y: 20 }], ivy: 4, seed: 171 } },
  };
  const RUINS = {
    watchtower: { kind: 'watchtower', style: 'witchwood', foot: [3, 2], seed: 5 },
    ruin_chapel: { kind: 'chapel', style: 'witchwood', foot: [6, 2], seed: 9, solid: [1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1] },
    ruin_arch: { kind: 'arch', style: 'witchwood', foot: [3, 1], seed: 13, solid: [1, 0, 1] },
  };

  // place the door on the requested footprint column
  for (const id in B) {
    const d = B[id], s = d.spec;
    if (s.door && d.doorTile != null) s.door.x = Math.round(d.doorTile * 16 + 8 - (d.foot[0] * 16 - s.w) / 2 - s.door.w / 2);
  }
  G.BUILDINGS = B; G.RUINS = RUINS;

  const cache = new Map();
  function adapt(b) { return { c: b.day, n: b.night, ax: Math.round(b.ax), ay: b.ay, lights: b.lights, smoke: b.smoke, door: b.door, w: b.W, h: b.H }; }
  G.buildingSprite = function (id) {
    let v = cache.get(id);
    if (!v) { const d = B[id]; v = adapt(GothicArt.makeBuilding(d.spec, d.style)); cache.set(id, v); }
    return v;
  };
  G.ruinSprite = function (id) {
    let v = cache.get('ruin:' + id);
    if (!v) { const d = RUINS[id]; v = adapt(GothicArt.makeRuin(d.kind, d.style, d.seed)); cache.set('ruin:' + id, v); }
    return v;
  };
  // a floating candle on a lily pad (cathedral pools, the glade pond)
  function floatCandle(v) {
    const key = 'float:' + v; let c = cache.get(key); if (c) return c;
    const P = new GothicArt.Pix(14, 12), ax = 7, ay = 10;
    P.disc(7, 9, 5, 2, v % 2 ? '#2f6a4a' : '#337450'); P.disc(6, 8, 3, 1, '#4c9061'); P.set(9, 8, '#1d4638'); P.set(10, 9, '#1d4638');
    P.rect(6, 4, 2, 5, '#e8e0d0'); P.set(6, 4, '#ffffff'); P.set(7, 8, '#b8b0a0');
    P.set(6, 2, '#ffbc62', 255, 4); P.set(6, 3, '#fff1c8', 255, 4); P.set(7, 3, '#ffbc62', 255, 4); P.set(6, 1, '#ff9a3c', 255, 4);
    P.outline('#120c1c');
    c = { c: P.canvas(), ax, ay, lights: [{ x: 6, y: 2, r: 22, color: [255, 200, 130], i: 0.75, night: true, flicker: 1 }] };
    cache.set(key, c); return c;
  }
  if (G.PROPS) {
    G.PROPS.gothic = { solid: true, fade: true, make: (o) => G.buildingSprite(o.id) };
    G.PROPS.ruin = { solid: true, fade: true, make: (o) => G.ruinSprite(o.id) };
    G.PROPS.floatcandle = { foot: [1, 1], solid: false, flat: true, make: (o) => floatCandle(o.v || 0) };
  }
  // map helper: m.building('tavern', tx, ty, interact) — footprint from the definition
  G.addBuilding = function (map, id, tx, ty, interact) {
    const d = B[id];
    return map.add('gothic', tx, ty, { id, foot: d.foot, interact });
  };
  // the door tiles of a placed building (bottom row of its footprint, under the door's pixels)
  G.buildingDoor = function (prop) {
    const d = B[prop.o.id], s = prop.spr;
    if (!d || !s.door) return null;
    const cx = prop.x - s.ax + s.door.x, half = d.spec.door.w / 2;
    const x0 = Math.floor((cx - half + 2) / 16), x1 = Math.floor((cx + half - 3) / 16);
    return { x: x0, y: prop.ty + prop.fh - 1, w: x1 - x0 + 1 };
  };
  G.addRuin = function (map, id, tx, ty, interact) {
    const d = RUINS[id];
    return map.add('ruin', tx, ty, { id, foot: d.foot, solid: d.solid, interact });
  };
})();
