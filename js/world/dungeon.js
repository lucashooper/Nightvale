// Nightvale — the Umbral Depths: procedural cave floors, themes, ladders, rune gates, boss floors.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.MAT, F = G.Farm;
  const D = (G.Dungeon = {});
  const hex = (a) => a.map(U.hex);

  const THEMES = [
    { id: 'moss', name: 'Mossy Hollows', from: 1, to: 9, floor: hex(['#1d2a26', '#26362f', '#2f4338', '#3a5243', '#4c6a52']), wall: hex(['#141a1c', '#1f2a2a', '#2c3b38', '#3c4f49', '#55705f']), ceil: hex(['#1a2224', '#212c2c']), moss: hex(['#2f5a3a', '#3b7048']), ambient: [104, 100, 138], rock: 'rock_moss',
      mobs: [['slime', 'moss', 5], ['bat', 'gloom', 2], ['shroomling', 'glowcap', 3]], deco: ['mushrooms', 'mushrooms', 'crystalG'], ore: [['ore_glimmer', 5], ['gem_quartz', 1], ['gem_amethyst', 0.6]] },
    { id: 'amethyst', name: 'Amethyst Grotto', from: 10, to: 19, floor: hex(['#1f1a30', '#2a2340', '#352c52', '#433866', '#56497e']), wall: hex(['#140f22', '#211936', '#30264c', '#433566', '#5c4a88']), ceil: hex(['#1a1428', '#221a34']), vein: ['#b99aee', 0.012], ambient: [98, 86, 140], rock: 'rock_amethyst',
      mobs: [['slime', 'amethyst', 3], ['spider', 'crystal', 3], ['golem', 'crystal', 1.4], ['bat', 'frost', 2], ['shroomling', 'glowcap', 1]], deco: ['crystal', 'crystal', 'mushrooms'], ore: [['ore_glimmer', 3], ['ore_shadow', 2.5], ['gem_amethyst', 2], ['gem_emerald', 0.6], ['gem_quartz', 1.2]] },
    { id: 'catacomb', name: 'Webbed Catacombs', from: 20, to: 29, floor: hex(['#24201f', '#2f2a28', '#3b3532', '#4a433e', '#5e5650']), wall: hex(['#141112', '#201b1c', '#2d2627', '#3c3434', '#544a48']), ceil: hex(['#1c1818', '#231e1f']), ambient: [92, 84, 108], rock: 'rock_catacomb',
      mobs: [['spider', 'cave', 4], ['skeleton', 'warrior', 3], ['bat', 'gloom', 2], ['slime', 'moss', 1]], deco: ['web', 'bones', 'web', 'candle'], ore: [['ore_shadow', 3], ['ore_glimmer', 1], ['gem_emerald', 1], ['gem_moonstone', 0.5], ['gem_quartz', 1]] },
    { id: 'crypt', name: 'Haunted Crypts', from: 30, to: 39, floor: hex(['#1c1a26', '#262333', '#302c40', '#3c374f', '#4d4764']), wall: hex(['#100e16', '#1a1724', '#262234', '#353048', '#4b4466']), ceil: hex(['#15131c', '#1b1824']), ambient: [80, 74, 114], rock: 'rock_crypt',
      mobs: [['skeleton', 'warrior', 2], ['skeleton', 'mage', 2], ['wraith', 'default', 2.5], ['hexmage', 'violet', 2]], deco: ['candle', 'grave', 'bones', 'candle'], ore: [['ore_shadow', 2], ['ore_starsilver', 1.5], ['gem_moonstone', 1.2], ['gem_emerald', 1]] },
    { id: 'abyss', name: 'Abyssal Rift', from: 40, to: 49, floor: hex(['#0f0b1a', '#161025', '#1e1631', '#281d40', '#352654']), wall: hex(['#07050d', '#0e0a18', '#171126', '#231a3a', '#34275a']), ceil: hex(['#0e0a18', '#140f22']), vein: ['#e4d2ff', 0.004], ambient: [66, 54, 104], rock: 'rock_abyss',
      mobs: [['hexmage', 'emerald', 2], ['hexmage', 'crimson', 1.4], ['voideye', 'default', 2.5], ['wraith', 'default', 2], ['slime', 'void', 2]], deco: ['crystalV', 'crystalV', 'candle'], ore: [['ore_starsilver', 3], ['gem_voidcrystal', 1], ['gem_moonstone', 1], ['ore_shadow', 1]] },
  ];
  D.THEMES = THEMES;
  D.themeFor = (floor) => THEMES.find((t) => floor >= t.from && floor <= t.to) || THEMES[THEMES.length - 1];

  // ---------------------------------------------------------------- deco sprites (dungeon-only small props)
  const decoCache = new Map();
  function decoSprite(kind, v) {
    const key = kind + v;
    if (decoCache.has(key)) return decoCache.get(key);
    let out;
    if (kind === 'crystal') out = G.Nature.makeCrystal(0);
    else if (kind === 'crystalG') out = G.Nature.makeCrystal(1);
    else if (kind === 'crystalV') out = G.Nature.makeCrystal(v % 2 ? 0 : 1);
    else if (kind === 'mushrooms') out = G.Nature.makeMushrooms(v % 2);
    else if (kind === 'grave') out = G.Struct.makeGrave(v);
    else {
      const P = new G.Pix(16, 16);
      if (kind === 'web') {
        const c = 'rgba(220,214,240,0.55)';
        for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; P.line(8, 8, 8 + Math.cos(a) * 8, 8 + Math.sin(a) * 8, c); }
        for (const r of [3, 6]) for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; P.set(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, c); }
        out = { c: P.canvas(), ax: 8, ay: 12, lights: [] };
      } else if (kind === 'bones') {
        P.line(3, 12, 11, 10, '#c8c0b0'); P.set(2, 11, '#e8e0d0'); P.set(2, 13, '#e8e0d0'); P.set(12, 9, '#e8e0d0'); P.set(12, 11, '#e8e0d0');
        P.disc(10, 13, 2, 1.6, '#d8d0c0'); P.set(9, 13, '#1b1429'); P.set(11, 13, '#1b1429');
        P.outline('#120c1c');
        out = { c: P.canvas(), ax: 8, ay: 14, lights: [] };
      } else { // candle cluster
        for (const [x, h] of [[5, 5], [8, 7], [11, 4]]) { P.rect(x, 15 - h, 2, h, '#e8dcc8'); P.set(x, 15 - h - 1, '#ffbc62'); P.set(x, 15 - h - 2, '#fff1c8'); }
        P.outline('#120c1c');
        out = { c: P.canvas(), ax: 8, ay: 15, lights: [{ x: 8, y: 6, r: 40, color: [255, 180, 100], i: 0.8, flicker: 1 }] };
      }
    }
    decoCache.set(key, out);
    return out;
  }

  // ---------------------------------------------------------------- tile objects in the depths
  const ladderCache = {};
  function ladderSprite(up) {
    const key = up ? 'u' : 'd';
    if (ladderCache[key]) return ladderCache[key];
    const P = new G.Pix(16, 24);
    if (up) {
      for (let y = 0; y < 22; y++) { P.set(4, y, '#7a5a48'); P.set(11, y, '#7a5a48'); P.set(5, y, '#574039'); P.set(12, y, '#574039'); }
      for (let y = 2; y < 22; y += 4) P.hline(5, 10, y, '#9c7a5e');
      P.rect(2, 21, 12, 3, 'rgba(10,6,20,0.4)');
    } else {
      P.disc(8, 16, 7, 5, '#07050d'); P.disc(8, 16, 5, 3, '#000000');
      for (let x = 1; x < 16; x++) { const yy = 16 - Math.round(5 * Math.sqrt(Math.max(0, 1 - ((x - 8) / 7) ** 2))); P.set(x, yy, '#4a4363'); }
      for (let y = 12; y < 22; y++) { P.set(5, y, '#7a5a48'); P.set(10, y, '#7a5a48'); }
      for (let y = 13; y < 22; y += 3) P.hline(6, 9, y, '#9c7a5e');
    }
    P.outline('#120c1c');
    ladderCache[key] = P.canvas();
    return ladderCache[key];
  }
  let gateSpr = null;
  function gateSprite(active, frame) {
    const P = new G.Pix(32, 40);
    P.shadow(16, 38, 13, 2.5);
    P.rect(6, 30, 20, 8, '#45445a'); P.hline(6, 25, 30, '#7e7d97');
    for (let y = 4; y < 30; y++) for (let x = 9; x < 23; x++) {
      const edge = x === 9 || x === 22 || y === 4;
      P.set(x, y, edge ? '#2d2c3e' : (x + y) % 7 === 0 ? '#45445a' : '#605f78');
    }
    const glow = active ? ['#5dffb0', '#b4ffd9'] : ['#8f6cd1', '#b99aee'];
    for (let k = 0; k < 6; k++) { const y = 8 + k * 3.6; P.set(15 + (k % 2), y, glow[(k + frame) % 2]); P.set(16 - (k % 2), y + 1, glow[0]); }
    P.disc(16, 7, 2, 2, active ? '#ffffff' : glow[1]);
    P.outline('#120c1c');
    return P.canvas();
  }

  function ladderDrawable(o) {
    return { sortY: o.ty * 16 + (o.up ? 15 : 2), draw(ctx, ox, oy) { const c = ladderSprite(o.up); ctx.drawImage(c, o.tx * 16 + ox, o.ty * 16 + oy + 16 - c.height + (o.up ? 0 : 4)); } };
  }
  function gateDrawable(o) {
    return { sortY: o.ty * 16 + 15, draw(ctx, ox, oy) { const c = gateSprite(o.active, Math.floor(G.R.time * 3) % 2); ctx.drawImage(c, o.tx * 16 + 8 - 16 + ox, o.ty * 16 + 16 - c.height + oy); } };
  }

  // ---------------------------------------------------------------- generation
  function caveGrid(w, h, r, fill) {
    let g = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = x < 2 || y < 2 || x >= w - 2 || y >= h - 2 || r() < fill ? 1 : 0;
    for (let it = 0; it < 5; it++) {
      const n = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) { n[y * w + x] = 1; continue; }
        let c = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) c += g[(y + j) * w + x + i];
        n[y * w + x] = c >= 5 ? 1 : c <= 3 ? 0 : g[y * w + x];
      }
      g = n;
    }
    // keep the largest open region
    const lab = new Int32Array(w * h).fill(-1);
    let best = -1, bestN = 0, id = 0;
    for (let i = 0; i < w * h; i++) {
      if (g[i] || lab[i] >= 0) continue;
      const q = [i]; lab[i] = id; let n = 0;
      while (q.length) { const c = q.pop(); n++; const cx = c % w, cy = (c / w) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy, ni = ny * w + nx; if (nx >= 0 && ny >= 0 && nx < w && ny < h && !g[ni] && lab[ni] < 0) { lab[ni] = id; q.push(ni); } } }
      if (n > bestN) { bestN = n; best = id; }
      id++;
    }
    for (let i = 0; i < w * h; i++) if (!g[i] && lab[i] !== best) g[i] = 1;
    // walls must be at least 2 tiles tall where they have a south face, so faces read properly
    for (let y = h - 2; y >= 1; y--) for (let x = 0; x < w; x++) if (g[y * w + x] && !g[(y + 1) * w + x] && !g[(y - 1) * w + x]) g[y * w + x] = 0;
    return { g, open: bestN };
  }

  D.build = function (floor) {
    const S = G.S;
    const theme = D.themeFor(floor);
    const r = U.rng(S.seed + floor * 7919 + S.day * 104729);
    const isGate = floor % 5 === 0 && floor < 50;
    const isBrood = floor === 25;
    const isThrone = floor === 50;
    const rareKind = G.Rare && !isGate && !isBrood && !isThrone ? G.Rare.pick(floor, r) : null;
    let w = isGate ? 26 : isThrone ? 34 : 40 + r.int(0, 8), h = isGate ? 20 : isThrone ? 28 : 30 + r.int(0, 6);
    if (isBrood) { w = 34; h = 28; }
    if (rareKind) [w, h] = G.Rare.size;
    let cave;
    for (let tries = 0; tries < 12; tries++) {
      if (rareKind) { cave = G.Rare.grid(w, h); break; }
      if (isGate || isThrone || isBrood) {
        // round chamber
        const g = new Uint8Array(w * h).fill(1);
        for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
          const dx = (x - w / 2) / (w / 2 - 3), dy = (y - h / 2) / (h / 2 - 3);
          if (dx * dx + dy * dy + (U.noise(x / 3, y / 3, floor) - 0.5) * 0.25 < 1) g[y * w + x] = 0;
        }
        for (let y = h - 2; y >= 1; y--) for (let x = 0; x < w; x++) if (g[y * w + x] && !g[(y + 1) * w + x] && !g[(y - 1) * w + x]) g[y * w + x] = 0;
        cave = { g, open: 1 }; break;
      }
      cave = caveGrid(w, h, r, 0.44 + r() * 0.04);
      if (cave.open > w * h * 0.34) break;
    }
    const map = new G.GameMap('depths', w, h, { name: `Floor ${floor}`, zone: 'depths', base: M.CAVEFLOOR, outdoor: false, decorDensity: 0 });
    map.floor = floor; map.theme = theme; map.subtitle = isThrone ? "The Archon's Throne" : theme.name;
    map.name = isThrone ? 'Floor 50' : `Floor ${floor}`;
    map.seed = (S.seed + floor * 31) % 100000;
    map.ambient = isThrone ? [60, 48, 96] : theme.ambient;
    map.voidColor = U.toHex(theme.ceil[0]);
    for (let i = 0; i < w * h; i++) map.terrain[i] = cave.g[i] ? M.CAVEWALL : M.CAVEFLOOR;
    map.entities = [];
    const open = [];
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) if (!cave.g[y * w + x] && !cave.g[(y - 1) * w + x]) open.push([x, y]);
    // entrance: open tile closest to a random edge point
    const corner = r.pick([[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [Math.floor(w / 2), 2], [Math.floor(w / 2), h - 3]]);
    let ent = open[0], bd = 1e9;
    if (isGate || isThrone || isBrood) ent = [Math.floor(w / 2), h - 6];
    else if (rareKind) ent = [Math.floor(w / 2), h - 5];
    else for (const p of open) { const d = Math.hypot(p[0] - corner[0], p[1] - corner[1]); if (d < bd && !cave.g[(p[1] + 1) * w + p[0]]) { bd = d; ent = p; } }
    map.setObj(ent[0], ent[1], { kind: 'ladder', up: true, solid: false, drawable: null });
    map.obj(ent[0], ent[1]).drawable = ladderDrawable(map.obj(ent[0], ent[1]));
    map.spawns = { entrance: [ent[0] + 0.5, ent[1] + 1.9, 'down'] };
    if (map.blocked(ent[0], ent[1] + 1)) map.spawns.entrance = [ent[0] + 1.5, ent[1] + 0.9, 'down'];
    map.entrance = ent;
    const far = (p, d) => Math.hypot(p[0] - ent[0], p[1] - ent[1]) > d;
    const free = (x, y) => map.inb(x, y) && !map.blocked(x, y) && !map.tobj.has(map.idx(x, y));

    if (isGate) {
      const gx = Math.floor(w / 2), gy = isBrood ? 4 : Math.floor(h / 2) - 2;
      map.setObj(gx, gy, { kind: 'gate', solid: true, active: S.gates.includes(floor) });
      map.obj(gx, gy).drawable = gateDrawable(map.obj(gx, gy));
      map.staticLights.push({ x: gx * 16 + 8, y: gy * 16 - 8, r: 70, color: [150, 120, 255], i: 0.9 });
      placeDown(map, [gx + 3, gy + 2], true);
      for (const [x, y] of [[gx - 5, gy], [gx + 5, gy], [gx - 4, gy + 5], [gx + 4, gy + 5]]) if (free(x, y)) addDeco(map, theme, 'crystal', x, y, r);
      if (isBrood && !S.flags.broodmother) {
        // the Broodmother guards this gate
        map.entities.push(G.Mobs.spawn('broodmother', 'default', gx * 16 + 8, (gy + 6) * 16, floor));
        for (const dx of [-6, -3, 3, 6]) map.entities.push(G.Mobs.spawn('spider', 'cave', (gx + dx) * 16 + 8, (gy + 9) * 16, floor));
        for (let k = 0; k < 10; k++) { const p = r.pick(open); if (free(p[0], p[1]) && far(p, 3)) addDeco(map, theme, 'web', p[0], p[1], r); }
        map.bossFloor = true; map.gateLocked = true;
      }
    } else if (isThrone) {
      D.buildThrone(map, r);
    } else if (rareKind) {
      G.Rare.build(map, rareKind, r, floor, placeDown);
    } else {
      // rocks
      const density = 0.17 + r() * 0.06;
      const oreTable = theme.ore.slice();
      for (const p of open) {
        if (!far(p, 3) || r() > density) continue;
        if (!free(p[0], p[1])) continue;
        let type = 'rock';
        const roll = r();
        if (roll < 0.16 + floor * 0.002 + (G.S.flags.depthsLuck === G.S.day ? 0.12 : 0)) type = r.weighted(oreTable);
        const o = F.makeNode(type, r.int(0, 1));
        if (type === 'rock') o.art = theme.rock;
        o.onBreak = onRockBreak;
        map.setObj(p[0], p[1], o);
      }
      // the hidden way down
      const cands = open.filter((p) => far(p, Math.max(w, h) * 0.45) && map.obj(p[0], p[1]) && map.obj(p[0], p[1]).kind === 'node');
      const pick = cands.length ? r.pick(cands) : null;
      if (pick) map.obj(pick[0], pick[1]).hidesLadder = true;
      else placeDown(map, r.pick(open.filter((p) => far(p, 8) && free(p[0], p[1]))) || [ent[0] + 2, ent[1]], false);
      // decorations
      const decoCount = Math.floor(open.length / 38);
      for (let k = 0; k < decoCount; k++) { const p = r.pick(open); if (free(p[0], p[1]) && far(p, 2)) addDeco(map, theme, r.pick(theme.deco), p[0], p[1], r); }
      // monsters
      const count = isBrood ? 6 : Math.min(20, 5 + Math.floor(floor * 0.28) + (G.isNewMoon() ? 3 : 0));
      const spots = open.filter((p) => far(p, 9) && free(p[0], p[1]));
      for (let k = 0; k < count && spots.length; k++) {
        const p = spots.splice(r.int(0, spots.length - 1), 1)[0];
        const [type, variant] = r.weighted(theme.mobs.map((m) => [[m[0], m[1]], m[2]]));
        map.entities.push(G.Mobs.spawn(type, variant, p[0] * 16 + 8, p[1] * 16 + 12, floor));
      }
    }
    map.mobsAtStart = map.entities.filter((e) => e.mob).length;
    // a few lore notes in the depths
    const loreFloors = { 3: 'lore_1', 8: 'lore_2', 14: 'lore_3', 19: 'lore_4', 23: 'lore_5', 31: 'lore_6', 38: 'lore_7', 46: 'lore_8' };
    if (loreFloors[floor] && !(S.flags.lore || {})[loreFloors[floor]]) {
      const p = r.pick(open.filter((q) => free(q[0], q[1]) && far(q, 4)));
      if (p) map.setObj(p[0], p[1], { kind: 'lore', key: loreFloors[floor], solid: false, drawable: null });
      if (p) map.obj(p[0], p[1]).drawable = loreDrawable(map.obj(p[0], p[1]));
    }
    return map;
  };

  function loreDrawable(o) {
    return {
      sortY: o.ty * 16 + 12,
      draw(ctx, ox, oy) {
        const x = o.tx * 16 + ox, y = o.ty * 16 + oy + Math.round(Math.sin(G.R.time * 2) * 1);
        ctx.fillStyle = '#120c1c'; ctx.fillRect(x + 3, y + 5, 10, 8);
        ctx.fillStyle = '#e8dcc8'; ctx.fillRect(x + 4, y + 6, 8, 6);
        ctx.fillStyle = '#9a8c80'; ctx.fillRect(x + 5, y + 8, 6, 1); ctx.fillRect(x + 5, y + 10, 4, 1);
        ctx.fillStyle = '#8f6cd1'; ctx.fillRect(x + 10, y + 11, 2, 2);
      },
    };
  }

  function addDeco(map, theme, kind, x, y, r) {
    const spr = decoSprite(kind, r.int(0, 3));
    const solid = kind === 'crystal' || kind === 'crystalG' || kind === 'crystalV' || kind === 'grave';
    map.add('custom', x, y, { sprite: spr, solid });
  }
  D.makeLadder = function (map, x, y, up) {
    const o = { kind: 'ladder', up: !!up, solid: false };
    map.setObj(x, y, o);
    o.drawable = ladderDrawable(o);
    return o;
  };
  function placeDown(map, p, open) {
    if (!p) return;
    const o = { kind: 'ladder', up: false, solid: false };
    o.drawable = ladderDrawable(o);
    map.setObj(p[0], p[1], o);
    o.drawable = ladderDrawable(map.obj(p[0], p[1]));
    if (!open) { G.sfx('discovery'); }
  }
  function onRockBreak(map, o) {
    if (map.downRevealed) return;
    const left = [...map.tobj.values()].filter((q) => q.kind === 'node').length;
    const chance = o.hidesLadder ? 1 : 0.025 + 1 / Math.max(6, left) * 0.4;
    if (Math.random() < chance) { map.downRevealed = true; placeDown(map, [o.tx, o.ty], false); G.UI.toast('A way down!'); G.sfx('ladder_descend', { volume: 0.5 }); }
  }

  // ---------------------------------------------------------------- floor flow
  D.enter = function (floor) {
    const S = G.S;
    const map = D.build(floor);
    G.Mobs.prewarm(map.entities.filter((e) => e.mob));
    if (floor > S.maxDepth) S.maxDepth = floor;
    G.jingle('level_down');
    if (floor === 1 && !S.flags.firstDepths) {
      S.flags.firstDepths = true;
      const fd = window.GAMETEXT && GAMETEXT.misc && GAMETEXT.misc.firstDepths;
      setTimeout(() => G.UI.say(null, fd || ['The air tastes of stone and old starlight. Somewhere below, something is breathing.']), 900);
    }
    return map;
  };
  D.chooseFloor = async function () {
    const S = G.S;
    if (!G.Inv.count('sword_rusty') && !G.S.inv.some((s) => s && G.item(s.id).weapon)) { G.UI.toast("You shouldn't go down there unarmed."); return; }
    const gates = [1].concat(S.gates.slice().sort((a, b) => a - b));
    if (gates.length === 1) { G.World.changeMap('depths', 'entrance', { floor: 1 }); return; }
    const v = await G.UI.say(null, ['The rune gate hums. Where will you descend?'], { choices: gates.slice(-5).map((f) => ({ label: f === 1 ? 'Floor 1' : `Floor ${f} (Rune Gate)`, value: f })).concat([{ label: 'Not now', value: 0 }]) });
    if (v) G.World.changeMap('depths', 'entrance', { floor: v });
  };
  D.interact = function (map, tx, ty) {
    const o = map.obj(tx, ty);
    if (!o) return false;
    if (o.kind === 'ladder') {
      if (o.up) { G.World.changeMap('ridge', 'cave'); return true; }
      if (map.floor === 49 && !G.S.flags.altarComplete) { G.UI.say(null, ['Below the ladder: a great door of black glass with five empty sockets. It will not open while the Moon Altar sleeps.']); return true; }
      if (map.floor >= 50) { G.UI.toast('There is nothing deeper. Only the Archon’s silence.'); return true; }
      G.sfx('ladder_descend');
      G.World.changeMap('depths', 'entrance', { floor: map.floor + 1 });
      return true;
    }
    if (o.kind === 'gate') {
      const S = G.S;
      if (map.gateLocked && map.entities.some((e) => e.mob && !e.dead && e.dying <= 0)) { G.UI.say(null, ['The gate is cocooned in thick silk. Something large is still nesting here.']); return true; }
      if (!o.active) {
        o.active = true;
        if (!S.gates.includes(map.floor)) S.gates.push(map.floor);
        G.jingle('rune_gate'); G.sfx('teleport');
        G.R.burst(tx * 16 + 8, ty * 16 - 10, 30, { colors: ['#5dffb0', '#b4ffd9', '#ffffff'], speed: 70, life: 1, grav: -20 });
        const rg = window.GAMETEXT && GAMETEXT.misc && GAMETEXT.misc.runeGate;
        G.UI.say(null, rg || [`The Rune Gate wakes. You can now descend straight to floor ${map.floor} from the cave mouth.`]);
      } else {
        G.UI.say(null, [`The Rune Gate of floor ${map.floor} hums softly.`], { choices: [{ label: 'Return to the surface', value: 'up' }, { label: 'Stay', value: 0 }] }).then((v) => { if (v === 'up') G.World.changeMap('ridge', 'cave'); });
      }
      return true;
    }
    if (o.kind === 'lore') {
      const S = G.S; S.flags.lore = S.flags.lore || {}; S.flags.lore[o.key] = true;
      map.setObj(tx, ty, null);
      const t = window.GAMETEXT && GAMETEXT.lore && GAMETEXT.lore[o.key];
      G.sfx('chest_open');
      G.UI.say(null, t || ['A torn page. The ink has run, but you can make out a single word: "Wren".']);
      return true;
    }
    return false;
  };
  D.hitTile = function () { return false; };
  D.slashTile = function () { };
  D.drawGround = function (ctx, map, ox, oy) { if (G.Rare && map.rare) G.Rare.drawGround(ctx, map, ox, oy); };
  D.drawOverlay = function (ctx, map, ox, oy) { };

  D.update = function (dt, map) {
    const p = G.World.player;
    for (const e of map.entities) if (!e.dead) e.update(dt, map, p);
    G.Mobs.collide(map, p);
    // clean up
    if (map.entities.some((e) => e.dead)) map.entities = map.entities.filter((e) => !e.dead || e.keep);
    // cleared floor -> ladder appears
    if (!map.downRevealed && map.mobsAtStart > 0 && !map.entities.some((e) => e.mob && !e.dead) && map.floor % 5 !== 0) {
      map.downRevealed = true;
      const [tx, ty] = p.feetTile;
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [1, 0], [-1, 0], [3, 0]]) {
        const x = tx + dx, y = ty + dy;
        if (map.inb(x, y) && !map.blocked(x, y) && !map.tobj.has(map.idx(x, y))) { placeDown(map, [x, y], false); G.UI.toast('The floor is clear. A ladder appears.'); break; }
      }
    }
  };

  // ---------------------------------------------------------------- the throne (floor 50)
  D.buildThrone = function (map, r) {
    const w = map.w, h = map.h;
    const cx = Math.floor(w / 2), cy = Math.floor(h / 2) - 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (map.t(x, y) === M.CAVEFLOOR && Math.hypot(x - cx, (y - cy - 2) * 1.15) < 6.5) map.set(x, y, M.RUNEFLOOR);
    for (const [x, y] of [[cx - 7, cy - 3], [cx + 7, cy - 3], [cx - 9, cy + 4], [cx + 9, cy + 4]]) if (!map.blocked(x, y)) map.add('brazier', x, y, { lit: true });
    if (!G.S.flags.archonDefeated) {
      const boss = G.Mobs.spawn('archon', 'default', cx * 16 + 8, cy * 16, 50);
      map.entities.push(boss);
      map.boss = boss;
      map.bossFloor = true;
    } else {
      placeDown(map, [cx, cy + 6], true);
      map.add('goddess', cx - 1, cy - 2, { restored: true });
    }
  };
})();
