// Nightvale — the overworld locations. The Umbral Depths are procedural (dungeon.js); building interiors
// are in interiors.js; the Deepwood and Hushwillow Glade are in forest.js. Buildings come from buildings.js.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.MAT;

  const build = (m, id, tx, ty, interact) => G.addBuilding(m, id, tx, ty, interact);
  // a walk-in door on a building: bumping into it (or using it) takes you to `to` at spawn `at`
  function door(m, prop, to, at, opts) {
    const d = G.buildingDoor(prop);
    if (!d) return null;
    const e = Object.assign({ x: d.x, y: d.y, w: d.w, to, at, prop }, opts || {});
    m.doors.push(e);
    return e;
  }
  // colourful light hanging over the cathedral's reflecting pools after dark
  function poolLights(m, x, y, w, h, colors) {
    let k = 0;
    for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) m.staticLights.push({ x: (x + i + 1) * 16, y: (y + j + 1) * 16, r: 36, color: colors[k++ % colors.length], i: 0.85, night: true });
  }

  // ---------------------------------------------------------------------------------- SANCTUM
  function buildSanctum() {
    const m = new G.GameMap('sanctum', 48, 40, { name: 'The Verdant Sanctum', zone: 'sanctum', tillable: true, decorDensity: 0.5 });
    m.doors = [];
    m.fill(0, 0, 48, 40, M.GRASS);
    // lush meadow patches
    m.disc(40, 14, 6, 5, M.MEADOW, 0.6); m.disc(6, 8, 5, 4, M.MEADOW, 0.6); m.disc(42, 34, 5, 4, M.MEADOW, 0.6);
    // northern wooded plateau + cliff
    m.fill(0, 0, 48, 4, M.FOREST);
    m.cliff(0, 47, 4, 2);
    // temple platform
    m.fill(13, 6, 22, 15, M.FLOOR);
    for (let y = 6; y < 21; y++) for (let x = 13; x < 35; x++) if (U.noise(x / 3, y / 3, 5) > 0.58) m.set(x, y, M.MOSSFLOOR);
    m.fill(20, 11, 8, 5, M.MOSSFLOOR); // dry reflecting pool basin (filled with water when restored)
    m.fill(21, 6, 6, 4, M.RUNEFLOOR);
    // garden courtyard
    m.fill(12, 23, 24, 12, M.EARTH);
    // paths (one runs straight through the garden between its two gates)
    m.fill(11, 28, 26, 2, M.MOSSFLOOR);
    m.fill(23, 21, 2, 7, M.MOSSFLOOR);
    m.path([[6, 28], [11.5, 28.5]], 2.2, M.DIRT);
    m.path([[36, 28.5], [41, 28], [47.9, 27.5]], 2.6, M.DIRT);
    m.path([[5.5, 27.5], [5.5, 29]], 2, M.DIRT);
    // ponds
    m.disc(5, 34, 3.6, 2.6, M.WATER, 0.5);
    m.disc(42, 9, 3.5, 2.4, M.WATER, 0.5);
    // south & west forest edge
    m.fill(0, 37, 48, 3, M.FOREST);

    // --- temple dressing
    const ALTAR = m.add('altar', 22, 7, { level: 0, interact: { kind: 'altar' } });
    m.altarProp = ALTAR;
    m.goddessProp = m.add('goddess', 16, 8, { restored: false, interact: { kind: 'flavor', key: 'sanctum_statue' } });
    m.braziers = [m.add('brazier', 20, 9, { lit: false }), m.add('brazier', 27, 9, { lit: false })];
    m.add('bigrock', 30, 8, { v: 2 });
    for (const [x, y, b] of [[15, 12, 0], [15, 16, 2], [32, 12, 1], [32, 16, 0], [18, 19, 3], [29, 19, 0]]) m.add('pillar', x, y, { broken: b });
    m.add('arch', 22, 20);
    m.ruinLine(13, 21, 20, [14]); m.ruinLine(25, 34, 20, [33]);
    for (let y = 7; y < 20; y++) { if (y !== 13 && y !== 14) { m.add('ruinwall', 13, y, { mask: 0, v: y }); m.add('ruinwall', 34, y, { mask: 0, v: y + 3 }); } }
    m.examine.set(m.idx(23, 13), 'sanctum_pool');
    m.add('sign', 19, 15, { v: 1, interact: { kind: 'flavor', key: 'sanctum_mural' } });
    m.poolRect = [20, 11, 8, 5];
    // garden walls (low ruin walls) with gates
    m.ruinLine(11, 36, 35);
    for (let y = 23; y < 35; y++) { if (y < 27 || y > 29) { m.add('ruinwall', 11, y, { mask: 0, v: y * 2 }); m.add('ruinwall', 36, y, { mask: 0, v: y * 5 }); } }
    m.ruinLine(11, 21, 22, [12, 13, 18]); m.ruinLine(26, 36, 22, [31, 32]);
    // the keeper's cottage (home): walk in to sleep and decorate
    const home = build(m, 'cottage', 3, 25, { kind: 'home' });
    m.homeProp = home;
    m.homeDoor = door(m, home, 'cottage', 'door', { name: "the keeper's cottage" });
    m.add('sign', 8, 27, { v: 0, interact: { kind: 'flavor', key: 'morwenna_desk' } });
    m.add('barrel', 2, 27, { v: 1 });
    m.add('crate', 9, 25, { v: 1 });
    m.add('lamp', 9, 28, { v: 1 });
    m.add('lamp', 37, 26, { v: 1 });
    m.add('well', 39, 31, { interact: { kind: 'flavor', key: 'sanctum_well' } });
    // trees & bushes
    for (const [x, y, k] of [[11, 7, 'wisteria'], [36, 7, 'wisteria'], [10, 18, 'wisteria'], [38, 18, 'glow'], [3, 20, 'oak'], [44, 22, 'oak'], [2, 11, 'oak'], [45, 4, 'pine']]) m.add('tree', x, y, { kind: k, v: (x + y) % 4 });
    m.forest([0, 0, 48, 4], 0.55, ['pine', 'oak', 'pine'], 3);
    m.forest([0, 36, 48, 4], 0.5, ['oak', 'pine', 'bush_dark', 'oak', 'glow'], 4, (x, y) => x > 9 && x < 12 && y < 37);
    m.forest([0, 6, 3, 30], 0.45, ['oak', 'pine', 'bush'], 5, (x, y) => y > 26 && y < 30);
    m.forest([44, 6, 4, 30], 0.4, ['oak', 'bush_flower', 'wisteria'], 6, (x, y) => y > 25 && y < 31);
    m.scatter('bush', [37, 10, 8, 12], 5, 7, (r) => ({ kind: r() < 0.5 ? 'flower' : 'berry', v: Math.floor(r() * 3) }));
    m.scatter('mushrooms', [0, 30, 12, 8], 3, 8, (r) => ({ v: Math.floor(r() * 2) }));
    m.add('lily', 4, 34, { v: 1 }); m.add('lily', 6, 33, { v: 0 }); m.add('lily', 42, 9, { v: 2 });
    m.add('reeds', 8, 33, { v: 1 }); m.add('reeds', 2, 35, { v: 0 });

    m.exits.push({ rect: [47, 25, 1, 5], to: 'village', at: 'west' });
    m.exits.push({ rect: [m.homeDoor.x, m.homeDoor.y, 1, 1], to: 'cottage', at: 'door', npc: true });
    m.spawns = { start: [5.5, 28.6, 'down'], east: [45.5, 28.7, 'left'], bed: [5.5, 28.6, 'down'], door: [5.5, 27.8, 'down'], altar: [23.5, 9.7, 'up'] };
    m.cottageDoor = [5, 26];
    m.music = 'sanctum';
    return m;
  }

  // ---------------------------------------------------------------------------------- VILLAGE
  function buildVillage() {
    const m = new G.GameMap('village', 78, 64, { name: 'Hollowmere', zone: 'village', decorDensity: 0.4 });
    m.doors = [];
    m.fill(0, 0, 78, 64, M.GRASS);
    m.disc(10, 40, 6, 4, M.MEADOW, 0.6); m.disc(44, 38, 7, 5, M.MEADOW, 0.6); m.disc(16, 6, 6, 3, M.MEADOW, 0.6); m.disc(70, 38, 6, 4, M.MEADOW, 0.6);
    m.disc(8, 55, 6, 3, M.MEADOW, 0.6); m.disc(46, 58, 6, 3, M.MEADOW, 0.6);
    // northern foothills + cliff with stairs
    m.fill(0, 0, 78, 5, M.FOREST);
    m.cliff(0, 77, 5, 2);
    m.stairs(30, 5, 3, 2);
    m.path([[31.5, -1], [31.5, 5]], 3, M.DIRT);
    // river
    m.path([[52, -1], [51.5, 8], [52.5, 16], [50.5, 24], [52, 32], [51, 40], [53, 48], [54.5, 56], [53.5, 64.5]], 3.2, M.WATER);
    // plaza
    m.fill(24, 18, 17, 13, M.COBBLE);
    m.disc(32, 24, 9.5, 7.5, M.COBBLE, 0.4);
    // roads
    m.path([[-1, 24], [10, 24], [24, 24]], 3, M.COBBLE);
    m.path([[40, 24], [48, 24], [56, 23.5], [78.5, 23.5]], 3, M.COBBLE);
    m.path([[31.5, 7], [31.5, 18]], 3, M.COBBLE);
    m.path([[31.5, 30], [31.5, 40], [31.5, 64.5]], 3, M.COBBLE);
    // the south quarter: Guild Square with the Guildhall and the Runesmithy, the Menagerie across the river
    m.fill(25, 50, 14, 6, M.COBBLE); m.disc(31.5, 52.5, 7.5, 4, M.COBBLE, 0.35);
    m.path([[18.5, 50], [18.5, 52.5], [26, 52.5]], 2.2, M.COBBLE);
    m.path([[38.5, 50], [38.5, 51.5]], 2, M.COBBLE);
    m.path([[38, 53.5], [61.5, 53.5], [61.5, 50]], 2.2, M.COBBLE);
    // the cathedral close: a flagstone forecourt with two long reflecting pools
    m.fill(56, 13, 20, 9, M.FLOOR);
    m.fill(64, 13, 4, 11, M.COBBLE);
    m.fill(58, 15, 5, 5, M.POOL); m.fill(69, 15, 5, 5, M.POOL);
    m.path([[46, 11.5], [49, 11.5]], 2, M.COBBLE);
    m.path([[55, 11.5], [57.5, 11.5], [57.5, 14]], 2, M.COBBLE);
    // bridges over the river: the east road and a north footbridge to the close
    for (let x = 46; x <= 55; x++) for (let y = 22; y <= 25; y++) if (G.MATINFO[m.t(x, y)].wet) m.set(x, y, M.BRIDGE);
    for (let x = 47; x <= 56; x++) for (let y = 11; y <= 12; y++) if (G.MATINFO[m.t(x, y)].wet) m.set(x, y, M.BRIDGE);
    // a plank bridge where the Menagerie road crosses the river
    for (let y = 52; y <= 54; y++) for (let x = 50; x <= 58; x++) { const cx = 53 + ((y - 48) / 8) * 1.5; if (Math.abs(x + 0.5 - cx) <= 2.2 && (G.MATINFO[m.t(x, y)].wet || m.t(x, y) === M.COBBLE)) m.set(x, y, M.BRIDGE); }
    // lanes
    m.path([[23.5, 16], [23.5, 18]], 2, M.DIRT);
    m.path([[38.5, 15], [38.5, 18]], 2.4, M.COBBLE);
    m.path([[45.5, 16], [45.5, 22]], 1.8, M.COBBLE);
    m.path([[6.5, 17], [6.5, 20], [8, 24]], 1.8, M.DIRT);
    m.path([[8, 29], [8.5, 33.5]], 1.8, M.DIRT);
    m.path([[16.5, 36], [16.5, 38], [24, 31]], 1.8, M.DIRT);
    m.path([[33, 36.5], [37.5, 36.5]], 1.8, M.DIRT);
    m.path([[40, 30], [44, 34], [44, 40]], 2, M.DIRT);
    m.path([[61.5, 31], [61.5, 25]], 1.8, M.COBBLE);
    m.path([[68.5, 33], [68.5, 25]], 1.8, M.DIRT);

    // buildings
    m.shop = build(m, 'seedshop', 21, 13, { kind: 'shop', npc: 'mirabel', hours: [9, 17], name: "Thornwick's Seeds & Sundries" });
    m.tavern = build(m, 'tavern', 34, 11, { kind: 'flavor', key: 'tavern_sign' });
    m.tavernDoor = door(m, m.tavern, 'tavern', 'door', { hours: [10, 26], name: 'The Gilded Owl' });
    m.boutique = build(m, 'boutique', 44, 13, { kind: 'flavor', key: 'boutique_books' });
    m.boutiqueDoor = door(m, m.boutique, 'boutique', 'door', { hours: [9, 19], name: "Quillon's Threads & Tomes" });
    m.cathedral = build(m, 'cathedral', 60, 9, { kind: 'flavor', key: 'cathedral_door' });
    m.cathedralDoor = door(m, m.cathedral, 'cathedral', 'door', { hours: [6, 24], name: 'the Cathedral of the Silver Veil' });
    // homes: Laura (a), Jasmine (c) and Amara (b) are walk-in; Ronan (d) and Gideon (e) keep theirs shut
    m.lauraHome = build(m, 'house_a', 5, 13, { kind: 'flavor', key: 'home_laura' });
    m.lauraDoor = door(m, m.lauraHome, 'laura_home', 'door', { hours: [8, 20], name: "Laura's house", owner: 'laura' });
    m.jasmineHome = build(m, 'house_c', 5, 30, { kind: 'flavor', key: 'home_jasmine' });
    m.jasmineDoor = door(m, m.jasmineHome, 'jasmine_home', 'door', { hours: [8, 20], name: "Jasmine's cottage", owner: 'jasmine' });
    m.amaraHome = build(m, 'house_b', 14, 33, { kind: 'flavor', key: 'home_amara' });
    m.amaraDoor = door(m, m.amaraHome, 'amara_home', 'door', { hours: [8, 20], name: "Amara's study", owner: 'amara' });
    build(m, 'house_d', 35, 33, { kind: 'flavor', key: 'home_ronan' });
    m.glassworks = build(m, 'glassworks', 57, 28, { kind: 'flavor', key: 'glassworks' });
    build(m, 'house_e', 66, 30, { kind: 'flavor', key: 'home_gideon' });
    // the south quarter
    m.guildhall = build(m, 'guildhall', 13, 46, { kind: 'flavor', key: 'guild_door' });
    m.guildDoor = door(m, m.guildhall, 'guild', 'door', { hours: [7, 23], name: 'the Silver Crescent Guild' });
    m.runesmithy = build(m, 'runesmithy', 36, 47, { kind: 'flavor', key: 'runesmithy_door' });
    m.smithyDoor = door(m, m.runesmithy, 'runesmithy', 'door', { hours: [8, 19], name: 'the Ashvale Runesmithy' });
    m.menagerie = build(m, 'menagerie', 58, 47, { kind: 'flavor', key: 'menagerie_door' });
    m.menagerieDoor = door(m, m.menagerie, 'menagerie', 'door', { hours: [9, 19], name: "Drake's Menagerie" });
    // plaza dressing
    m.add('fountain', 31, 22, { interact: { kind: 'flavor', key: 'moonwell' } });
    m.add('board', 27, 19, { interact: { kind: 'board' } });
    m.add('stall', 25, 28, { v: 0, interact: { kind: 'shop', npc: 'jasmine', hours: [8, 17], name: "Jasmine's honey stall", needNpc: true } }); m.add('stall', 36, 28, { v: 1 });
    for (const [x, y] of [[24, 18], [40, 18], [24, 30], [40, 30], [12, 22], [19, 26], [45, 26], [57, 21], [29, 9], [34, 9], [29, 36], [34, 42], [55, 26], [63, 26], [71, 26]]) m.add('lamp', x, y, { v: 0 });
    m.add('statue', 44, 36, { kind: 'priestess', interact: { kind: 'flavor', key: 'village_statue' } });
    m.add('bench', 41, 33); m.add('bench', 46, 40);
    m.add('planter', 23, 23, { v: 1 }); m.add('planter', 23, 25, { v: 2 }); m.add('planter', 41, 23, { v: 0 }); m.add('planter', 41, 25, { v: 3 });
    m.add('sign', 3, 22, { v: 1, interact: { kind: 'flavor', key: 'village_sign' } });
    m.add('sign', 29, 41, { v: 0, interact: { kind: 'flavor', key: 'south_sign' } });
    m.add('sign', 29, 60, { v: 0, interact: { kind: 'flavor', key: 'woods_sign' } });
    // Guild Square and the paddock
    for (const [x, y] of [[25, 50], [38, 50], [25, 55], [38, 55], [29, 45], [34, 45], [29, 58], [34, 58], [47, 54], [57, 54]]) m.add('lamp', x, y, { v: 0 });
    m.add('statue', 31, 50, { kind: 'priestess', interact: { kind: 'flavor', key: 'guild_statue' } });
    m.add('bench', 27, 56); m.add('bench', 35, 56);
    m.add('planter', 25, 52, { v: 2 }); m.add('planter', 38, 52, { v: 0 });
    m.add('barrel', 43, 48, { v: 0 }); m.add('crate', 44, 49, { v: 2 }); m.add('crate', 34, 48, { v: 1 });
    m.fenceLine([[67, 45], [75, 45], [75, 56], [67, 56], [67, 52]]); m.fenceLine([[67, 49], [67, 45]]);
    m.fill(68, 46, 7, 10, M.MEADOW);
    m.add('room', 71, 47, { id: 'dragon_perch', interact: { kind: 'flavor', key: 'dragon_perch' } });
    m.add('room', 69, 53, { id: 'hay_bale' }); m.add('room', 73, 53, { id: 'hay_bale' });
    m.paddock = [68, 46, 7, 10];
    m.add('well', 13, 40, { interact: { kind: 'flavor', key: 'river_bridge' } });
    m.add('cart', 18, 21); m.add('barrel', 42, 15, { v: 0 }); m.add('barrel', 43, 15, { v: 1 }); m.add('crate', 43, 16, { v: 2 });
    m.add('crate', 20, 16, { v: 1 }); m.add('crate', 19, 15, { v: 1 });
    // the cathedral close
    for (const [x, y] of [[57, 14], [74, 14], [57, 20], [74, 20], [63, 15], [68, 15]]) m.add('lamp', x, y, { v: 0 });
    m.add('bench', 72, 21); // the west bench made way for the Night Market's carriage
    m.add('planter', 63, 20, { v: 1 }); m.add('planter', 68, 20, { v: 2 });
    for (const [x, y] of [[58, 15], [69, 15]]) m.examine.set(m.idx(x + 2, y + 2), 'cathedral_pool');
    for (const [x, y, v] of [[59, 16, 0], [61, 18, 1], [60, 15, 1], [70, 17, 0], [72, 16, 1], [71, 19, 0]]) m.add('floatcandle', x, y, { v, noDecorPad: false });
    poolLights(m, 58, 15, 5, 5, [[255, 90, 170], [110, 180, 255], [255, 210, 90]]);
    poolLights(m, 69, 15, 5, 5, [[150, 110, 255], [90, 255, 200], [255, 130, 90]]);
    m.add('statue', 55, 13, { kind: 'moon', interact: { kind: 'flavor', key: 'cathedral_window_1' } });
    // Mirabel's garden (fenced) west of the shop
    m.fill(14, 10, 6, 5, M.EARTH);
    m.fenceLine([[13, 9], [20, 9], [20, 11]]); m.fenceLine([[20, 13], [20, 15], [13, 15], [13, 9]]);
    m.scatter('bush', [14, 10, 6, 5], 5, 77, (r) => ({ kind: 'flower', v: Math.floor(r() * 3) }));
    m.examine.set(m.idx(16, 12), 'mirabel_garden');
    // the glassworks yard
    m.add('crate', 63, 30, { v: 0 }); m.add('barrel', 56, 30, { v: 1 });
    // fenced yards
    m.fenceLine([[3, 18], [3, 21]]); m.fenceLine([[3, 34], [11, 34]]);
    m.fenceLine([[65, 34], [71, 34]]);
    // trees
    m.forest([0, 0, 78, 5], 0.6, ['pine', 'oak', 'pine', 'silver'], 11);
    // a hedge of trees between the old village and the south quarter, with gaps for the roads
    m.forest([3, 41, 22, 3], 0.4, ['oak', 'bush', 'bush_flower'], 12);
    m.forest([40, 41, 10, 3], 0.4, ['oak', 'willow', 'bush_flower'], 13);
    m.forest([0, 58, 28, 6], 0.5, ['oak', 'pine', 'bush', 'oak'], 22);
    m.forest([36, 59, 16, 5], 0.5, ['oak', 'willow', 'bush_flower'], 23);
    m.forest([58, 58, 20, 6], 0.5, ['oak', 'pine', 'bush'], 24);
    m.forest([76, 5, 2, 17], 0.6, ['oak', 'pine', 'bush'], 14);
    m.forest([74, 26, 4, 16], 0.45, ['oak', 'willow', 'bush'], 15);
    m.forest([76, 42, 2, 16], 0.45, ['oak', 'pine'], 25);
    m.forest([0, 0, 3, 22], 0.45, ['oak', 'pine'], 16);
    m.forest([0, 27, 3, 31], 0.45, ['oak', 'bush'], 17);
    m.forest([53, 7, 4, 4], 0.5, ['silver', 'bush'], 18);
    for (const [x, y, k] of [[39, 37, 'wisteria'], [48, 35, 'wisteria'], [12, 27, 'wisteria'], [27, 35, 'oak'], [36, 39, 'glow'], [18, 11, 'wisteria'], [47, 18, 'willow'], [54, 31, 'willow'], [10, 10, 'oak'], [3, 28, 'oak'], [21, 39, 'oak'],
      [56, 16, 'wisteria'], [75, 16, 'wisteria'], [55, 20, 'glow'], [76, 22, 'silver'], [62, 36, 'oak'], [72, 30, 'wisteria']]) m.add('tree', x, y, { kind: k, v: (x * 3 + y) % 4 });
    m.scatter('bush', [10, 4, 44, 40], 14, 18, (r) => ({ kind: U.pick(['plain', 'flower', 'berry', 'plain']), v: Math.floor(r() * 3) }));
    m.scatter('bush', [4, 44, 46, 14], 8, 26, (r) => ({ kind: U.pick(['plain', 'flower', 'flower']), v: Math.floor(r() * 3) }));
    for (const [x, y, k] of [[10, 52, 'wisteria'], [24, 47, 'oak'], [45, 46, 'glow'], [50, 58, 'willow'], [6, 47, 'oak'], [65, 57, 'wisteria']]) m.add('tree', x, y, { kind: k, v: (x * 3 + y) % 4 });
    m.scatter('bush', [54, 26, 22, 14], 6, 19, (r) => ({ kind: U.pick(['plain', 'flower', 'flower']), v: Math.floor(r() * 3) }));
    m.add('reeds', 49, 30, { v: 0 }); m.add('reeds', 53, 36, { v: 1 }); m.add('lily', 51, 33, { v: 1 });

    m.exits.push({ rect: [0, 21, 1, 6], to: 'sanctum', at: 'east' });
    m.exits.push({ rect: [77, 21, 1, 6], to: 'lake', at: 'west' });
    // villagers walk in and out through the doors
    for (const d of [m.tavernDoor, m.boutiqueDoor, m.cathedralDoor, m.guildDoor, m.smithyDoor, m.menagerieDoor, m.lauraDoor, m.jasmineDoor, m.amaraDoor]) if (d) m.exits.push({ rect: [d.x, d.y, d.w, 1], to: d.to, at: d.at, npc: true });
    m.exits.push({ rect: [29, 0, 5, 1], to: 'ridge', at: 'south' });
    m.exits.push({ rect: [29, 63, 5, 1], to: 'woods', at: 'north' });
    const below = (d) => [d.x + d.w / 2, d.y + 1.9, 'down'];
    m.spawns = { west: [1.6, 24.7, 'right'], east: [75.5, 24.2, 'left'], north: [31.5, 8.7, 'down'], south: [31.5, 61.7, 'up'], plaza: [32, 27.7, 'down'],
      tavern: [38.5, 15.9, 'down'], boutique: [45.5, 16.9, 'down'], cathedral: [66, 13.9, 'down'],
      guild: below(m.guildDoor), runesmithy: below(m.smithyDoor), menagerie: below(m.menagerieDoor), laura_home: below(m.lauraDoor), jasmine_home: below(m.jasmineDoor), amara_home: below(m.amaraDoor) };
    m.music = 'village';
    return m;
  }

  // ---------------------------------------------------------------------------------- WOODS
  function buildWoods() {
    const m = new G.GameMap('woods', 56, 48, { name: 'Whisperwood', zone: 'woods', decorDensity: 0.6 });
    m.doors = [];
    m.fill(0, 0, 56, 48, M.FOREST);
    m.disc(27, 6, 5, 5, M.GRASS, 0.5);
    m.disc(44, 17, 7, 5.5, M.MEADOW, 0.5);
    m.disc(10, 25, 5.5, 4.5, M.MEADOW, 0.5);
    m.disc(34, 30, 4, 3.5, M.GRASS, 0.5);
    m.disc(20, 34, 5, 3, M.GRASS, 0.6);
    // stream
    m.path([[53, -1], [49, 10], [45, 24], [40, 33], [36, 39]], 2.2, M.WATER);
    // bog
    m.fill(0, 38, 56, 10, M.BOG);
    m.disc(16, 43, 5, 2.5, M.WATER, 0.7); m.disc(44, 44, 6, 2.5, M.WATER, 0.7); m.disc(35, 39, 3, 1.6, M.WATER, 0.5);
    m.disc(31, 43, 4.5, 3, M.DIRT, 0.4);
    // paths
    m.path([[27.5, -1], [27.5, 8], [22, 14], [20, 22], [26, 30], [28, 36], [29, 39.5]], 2.2, M.DIRT);
    m.path([[22, 14], [32, 15], [41, 17.5]], 1.8, M.DIRT);
    m.path([[20, 22], [14, 24], [12, 25]], 1.8, M.DIRT);
    m.path([[26, 30], [32, 30]], 1.6, M.DIRT);
    // west trail into the Deepwood, east trail over the bridge to the mossy tunnel (Hushwillow Glade)
    m.path([[8, 25.5], [3, 25], [-1, 24.5]], 1.8, M.DIRT);
    m.path([[41, 17.5], [50, 17.5], [53, 18], [56.5, 18]], 1.8, M.DIRT);
    for (let x = 40; x <= 50; x++) for (let y = 17; y <= 18; y++) if (G.MATINFO[m.t(x, y)].wet) m.set(x, y, M.BRIDGE);
    // Elowen's grove
    m.add('treehouse', 42, 13, { interact: { kind: 'flavor', key: 'elowen_grove' } });
    m.add('lamp', 40, 16, { v: 1 }); m.add('lamp', 48, 16, { v: 1 });
    m.add('bush', 38, 19, { kind: 'flower', v: 1 }); m.add('bush', 49, 20, { kind: 'flower', v: 2 });
    // fairy ring
    m.fairyRing = [10, 25];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; m.add('mushrooms', Math.round(10 + Math.cos(a) * 3), Math.round(25 + Math.sin(a) * 2.4), { v: k % 2 }); }
    m.examine.set(m.idx(10, 25), 'fairy_ring');
    // shrine
    m.add('statue', 34, 29, { kind: 'moon', interact: { kind: 'flavor', key: 'woods_shrine' } });
    m.add('planter', 33, 30, { v: 1 }); m.add('planter', 35, 30, { v: 2 });
    // hollow tree / logs / stumps
    m.add('log', 18, 33, { v: 0 }); m.add('stumpd', 23, 35, { v: 1 }); m.add('stumpd', 12, 20, { v: 0 });
    m.add('tree', 24, 12, { kind: 'dead', v: 1, interact: { kind: 'flavor', key: 'hollow_tree' } });
    // Grizelda's hut
    m.hut = build(m, 'hut', 29, 41, { kind: 'shop', npc: 'grizelda', hours: [8, 26], name: "Grizelda's Curios" });
    m.add('sign', 27, 38, { v: 1, interact: { kind: 'flavor', key: 'bog_sign' } });
    m.add('barrel', 34, 42, { v: 1 }); m.add('lamp', 28, 43, { v: 1 });
    m.examine.set(m.idx(33, 43), 'grizelda_cauldron');
    m.add('sign', 26, 3, { v: 0, interact: { kind: 'flavor', key: 'woods_sign' } });
    m.add('sign', 3, 23, { v: 1, interact: { kind: 'flavor', key: 'deep_sign_warning' } });
    m.add('sign', 53, 16, { v: 0, interact: { kind: 'flavor', key: 'glade_sign' } });
    // trees
    const avoid = (x, y) => {
      const t = m.t(x, y);
      return t === M.DIRT || t === M.MEADOW || t === M.BRIDGE || (Math.abs(x - 10) < 5 && Math.abs(y - 25) < 4) || (x > 39 && x < 49 && y > 12 && y < 21) || (Math.abs(x - 34) < 4 && Math.abs(y - 30) < 3) || (Math.abs(x - 27) < 4 && y < 9) || (Math.abs(x - 20) < 4 && Math.abs(y - 34) < 2) || (x < 3 && y > 22 && y < 27) || (x > 52 && y > 16 && y < 20);
    };
    m.forest([0, 0, 56, 38], 0.32, ['oak', 'pine', 'oak', 'glow', 'pine', 'bush_dark', 'bush_berry', 'wisteria'], 21, avoid);
    m.forest([0, 38, 56, 10], 0.18, ['dead', 'dead', 'willow', 'bush_dark'], 22, (x, y) => avoid(x, y) || (x > 26 && x < 36 && y > 39));
    m.scatter('mushrooms', [0, 0, 56, 38], 10, 23, (r) => ({ v: Math.floor(r() * 2) }));
    m.scatter('reeds', [0, 38, 56, 10], 14, 24, (r) => ({ v: Math.floor(r() * 2) }));
    m.scatter('log', [2, 2, 50, 34], 3, 25, (r, x, y) => (m.free(x + 1, y) ? { v: 0 } : null));
    m.add('lily', 15, 43, { v: 1 }); m.add('lily', 45, 44, { v: 0 }); m.add('lily', 42, 44, { v: 2 });

    m.exits.push({ rect: [25, 0, 6, 1], to: 'village', at: 'south' });
    m.exits.push({ rect: [0, 22, 1, 5], to: 'deepwood', at: 'east' });
    m.exits.push({ rect: [55, 16, 1, 4], to: 'glade', at: 'west' });
    m.spawns = { north: [27.5, 1.7, 'down'], grove: [44, 18.7, 'down'], west: [1.6, 25, 'right'], east: [54.2, 18.6, 'left'] };
    m.music = 'woods';
    m.forageArea = [0, 0, 56, 47];
    return m;
  }

  // ---------------------------------------------------------------------------------- LAKE
  function buildLake() {
    const m = new G.GameMap('lake', 56, 44, { name: 'Glimmermere', zone: 'lake', decorDensity: 0.45 });
    m.doors = [];
    m.fill(0, 0, 56, 44, M.GRASS);
    m.disc(36, 22, 17, 14, M.SAND, 0.5);
    m.disc(37, 22, 15.5, 12.5, M.WATER, 0.6);
    m.disc(39, 22, 9, 7, M.DEEP, 0.6);
    m.disc(47, 32, 2.6, 2, M.GRASS, 0.3);
    m.fill(0, 0, 56, 4, M.FOREST);
    m.fill(0, 40, 56, 4, M.FOREST);
    // path in from the village
    m.path([[-1, 22], [8, 22], [16, 23], [19, 24.5]], 2.6, M.DIRT);
    m.path([[9, 22], [9, 13], [16, 9], [30, 6], [44, 6], [52, 9]], 1.8, M.DIRT);
    m.path([[13.5, 18], [13.5, 22]], 1.8, M.DIRT);
    // dock
    for (let x = 19; x <= 29; x++) for (let y = 24; y <= 25; y++) m.set(x, y, M.BRIDGE);
    for (let x = 28; x <= 30; x++) for (let y = 21; y <= 28; y++) m.set(x, y, M.BRIDGE);
    m.dockTiles = [[29, 21], [29, 28], [30, 24]];
    // boathouse
    m.boathouse = build(m, 'boathouse', 12, 15, { kind: 'shop', npc: 'lune', hours: [7, 18], name: "Lune's Bait & Tackle" });
    m.add('boat', 25, 27); m.add('barrel', 18, 22, { v: 0 }); m.add('crate', 18, 21, { v: 0 });
    m.add('sign', 17, 25, { v: 0, interact: { kind: 'flavor', key: 'dock_sign' } });
    m.add('lamp', 19, 23, { v: 0 }); m.add('lamp', 30, 20, { v: 1 });
    // half-sunken moon statue and island shrine
    m.add('statue', 44, 11, { kind: 'moon', interact: { kind: 'flavor', key: 'moon_statue' } });
    m.add('lamp', 47, 31, { v: 1, interact: { kind: 'flavor', key: 'lake_shrine' } });
    m.examine.set(m.idx(50, 9), 'sunken_bell');
    m.add('bigrock', 49, 8, { v: 3 });
    // vegetation
    m.forest([0, 0, 56, 4], 0.55, ['pine', 'oak', 'willow'], 31);
    m.forest([0, 40, 56, 4], 0.55, ['willow', 'oak', 'bush'], 32);
    m.forest([0, 4, 10, 36], 0.3, ['oak', 'willow', 'bush_flower', 'glow'], 33, (x, y) => y > 19 && y < 26);
    m.forest([52, 4, 4, 36], 0.4, ['willow', 'oak'], 34);
    for (const [x, y] of [[20, 12], [24, 34], [33, 36], [44, 36], [52, 22], [17, 30]]) m.add('tree', x, y, { kind: 'willow', v: (x + y) % 3 });
    const reedSpots = [[22, 14], [23, 31], [27, 34], [49, 13], [52, 27], [44, 35], [30, 10], [35, 9]];
    for (const [x, y] of reedSpots) if (m.free(x, y)) m.add('reeds', x, y, { v: (x + y) % 2 });
    for (const [x, y, v] of [[33, 15, 1], [26, 18, 0], [41, 30, 2], [45, 18, 1], [34, 29, 0], [24, 20, 1], [31, 31, 2], [47, 24, 0]]) m.add('lily', x, y, { v });

    m.exits.push({ rect: [0, 19, 1, 6], to: 'village', at: 'east' });
    m.spawns = { west: [1.6, 22.7, 'right'], dock: [29, 24.7, 'right'] };
    m.music = 'lake';
    m.forageArea = [10, 4, 44, 36];
    return m;
  }

  // ---------------------------------------------------------------------------------- RIDGE
  function buildRidge() {
    const m = new G.GameMap('ridge', 56, 44, { name: 'Starfall Ridge', zone: 'ridge', decorDensity: 0.35 });
    m.doors = [];
    m.fill(0, 0, 56, 44, M.GRASS);
    for (let y = 0; y < 44; y++) for (let x = 0; x < 56; x++) if (U.noise(x / 6, y / 6, 77) > 0.56) m.set(x, y, M.GRAVEL);
    m.cliff(0, 55, 28, 2);
    m.cliff(0, 55, 10, 2);
    m.fill(0, 0, 56, 2, M.FOREST);
    m.stairs(26, 28, 3, 2);
    m.stairs(36, 10, 3, 2);
    // stream along the east edge with waterfalls over both cliffs
    m.path([[54, -1], [53, 6], [54, 12], [53, 20], [54, 30], [53, 38], [54, 44.5]], 2.2, M.WATER);
    m.disc(52, 32, 2.6, 2, M.WATER, 0.4);
    // paths
    m.path([[27.5, 44.5], [27.5, 30]], 2.6, M.GRAVEL);
    m.path([[27.5, 27.5], [27.5, 12]], 2.6, M.GRAVEL);
    m.path([[27.5, 21], [16, 21.5], [9, 22.5], [5.5, 22.5]], 2.2, M.GRAVEL);
    m.path([[27.5, 14], [33, 13], [37.5, 12]], 2.2, M.GRAVEL);
    m.path([[37.5, 9.5], [38, 7], [41.5, 6.5]], 2.2, M.GRAVEL);
    m.path([[27.5, 23], [36, 25], [45.5, 26]], 2, M.GRAVEL);
    m.path([[20.5, 17], [20.5, 20]], 1.6, M.GRAVEL);
    // cemetery, with its little chapel at the top
    m.fill(40, 14, 12, 11, M.FOREST);
    m.path([[45.5, 15], [45.5, 25.5]], 1.6, M.GRAVEL);
    m.fenceLine([[40, 14], [42, 14]], true); m.fenceLine([[48, 14], [51, 14], [51, 25], [47, 25]], true); m.fenceLine([[44, 25], [40, 25], [40, 14]], true);
    m.chapel = build(m, 'chapel', 43, 12, { kind: 'flavor', key: 'ridge_chapel' });
    const graves = [[42, 17], [49, 17], [41, 20], [43, 20], [48, 20], [50, 20], [42, 23], [49, 23]];
    graves.forEach(([x, y], k) => m.add('grave', x, y, { v: k, interact: { kind: 'flavor', key: k === 4 ? 'grave_wren' : 'grave_' + ((k % 5) + 1) } }));
    m.add('tree', 50, 15, { kind: 'dead', v: 0 }); m.add('tree', 41, 22, { kind: 'dead', v: 2 });
    m.add('lamp', 46, 26, { v: 1 }); m.add('lamp', 44, 16, { v: 1 });
    // forge
    m.forge = build(m, 'forge', 4, 19, { kind: 'shop', npc: 'brann', hours: [8, 18], name: 'Starfall Forge' });
    m.add('anvil', 11, 21, { interact: { kind: 'flavor', key: 'forge_anvil' } });
    m.add('barrel', 3, 22, { v: 0 }); m.add('crate', 12, 19, { v: 0 }); m.add('cart', 13, 23);
    // delvers' lodge & the depths
    m.lodge = build(m, 'lodge', 18, 14, { kind: 'shop', npc: 'corvin', hours: [10, 18], name: "Delvers' Lodge" });
    m.fill(27, 10, 2, 2, M.GRAVEL);
    m.cave = m.add('cave', 26, 10, { interact: { kind: 'depths' } });
    m.add('sign', 30, 13, { v: 1, interact: { kind: 'flavor', key: 'depths_entrance' } });
    m.exits.push({ rect: [27, 11, 2, 1], to: 'depths', at: 'entrance' });
    // the observatory (moonstone, with a domed tower)
    m.tower = build(m, 'observatory', 39, 3, { kind: 'shop', npc: 'orvyn', hours: [9, 26], name: 'The Observatory' });
    m.add('telescope', 36, 6, { interact: { kind: 'flavor', key: 'telescope' } });
    m.add('sign', 6, 6, { v: 0, interact: { kind: 'flavor', key: 'ridge_lookout' } });
    m.add('bigrock', 15, 5, { v: 1, interact: { kind: 'flavor', key: 'ridge_cairn' } });
    // vegetation, rocks, crystals
    const onPath = (x, y) => { const t = m.t(x, y); return t === M.GRAVEL || t === M.STAIRS; };
    m.forest([0, 0, 56, 3], 0.6, ['pine', 'silver', 'pine'], 41);
    m.forest([0, 3, 52, 7], 0.22, ['pine', 'silver', 'bush'], 42, (x, y) => (x > 24 && x < 31) || (x > 33 && x < 47) || onPath(x, y));
    m.forest([0, 12, 52, 16], 0.12, ['pine', 'silver', 'bush'], 43, (x, y) => (x > 2 && x < 15 && y > 16 && y < 25) || (x > 16 && x < 32 && y > 12 && y < 24) || (x > 38 && y > 11 && y < 27) || onPath(x, y));
    m.forest([0, 30, 52, 14], 0.15, ['pine', 'silver', 'oak', 'bush'], 44, (x, y) => (x > 24 && x < 31) || onPath(x, y));
    m.scatter('boulder', [0, 12, 52, 32], 10, 45, (r) => ({ v: Math.floor(r() * 4) }), (x, y) => onPath(x, y) || (x > 38 && y > 11 && y < 27));
    m.scatter('bigrock', [0, 30, 52, 12], 3, 46, (r, x, y) => (m.free(x + 1, y) ? { v: Math.floor(r() * 4) } : null), onPath);
    for (const [x, y, v] of [[8, 13, 0], [22, 33, 1], [39, 34, 0], [14, 38, 2], [5, 7, 1], [33, 6, 0]]) if (m.free(x, y)) m.add('crystal', x, y, { v });

    m.exits.push({ rect: [25, 43, 6, 1], to: 'village', at: 'north' });
    m.spawns = { south: [27.5, 41.7, 'up'], cave: [27.5, 13.7, 'down'], forge: [5.5, 23.7, 'down'] };
    m.music = 'ridge';
    m.mineArea = [0, 12, 52, 32];
    return m;
  }

  G.buildOverworld = function () {
    const maps = { sanctum: buildSanctum(), village: buildVillage(), woods: buildWoods(), lake: buildLake(), ridge: buildRidge() };
    if (G.buildForest) Object.assign(maps, G.buildForest());
    if (G.buildInteriors) Object.assign(maps, G.buildInteriors());
    return maps;
  };
})();
