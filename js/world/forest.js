// Nightvale — the forest biome beyond Whisperwood: the Deepwood (spookier the deeper you go, down to
// the webbed Hollows and the Elder Tree) and Hushwillow Glade (a hidden pocket of sleeping animals).
// Also: wild creatures that roam Whisperwood and the Deepwood, critters you can pet, and the
// forest's explorables (hollow logs, the campsite, the sealed chest, the stone circle).
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.MAT;
  const cache = new Map();

  // ---------------------------------------------------------------- set-piece sprites (WildArt)
  function wildSprite(id, v) {
    const key = id + ':' + v; let s = cache.get(key); if (s) return s;
    let r = null;
    try { if (window.WildArt && WildArt.piece) r = WildArt.piece(id, v); } catch (e) { r = null; }
    if (!r || !r.c) { // stand-in until the art exists
      const c = document.createElement('canvas'); c.width = 16; c.height = 24;
      const x = c.getContext('2d'); x.fillStyle = '#120c1c'; x.fillRect(2, 4, 12, 20); x.fillStyle = '#4a3b6d'; x.fillRect(3, 5, 10, 18);
      r = { c, ax: 8, ay: 23, foot: [1, 1], solid: true, lights: [] };
    }
    s = Object.assign({ lights: [] }, r, { w: r.c.width, h: r.c.height });
    cache.set(key, s); return s;
  }
  G.PROPS.wild = { solid: true, make: (o) => wildSprite(o.id, o.v || 0) };
  function wild(m, id, v, tx, ty, extra) {
    const s = wildSprite(id, v || 0);
    const o = Object.assign({ id, v: v || 0, foot: s.foot || [1, 1], solid: s.solid }, extra || {});
    if (s.flat) { o.ghost = true; o.solid = false; o.sortY = -1e6 + ty; }
    const p = m.add('wild', tx, ty, o);
    if (p) { p.fade = !!s.fade; if (s.flat) p.flat = true; }
    return p;
  }
  G.addWild = wild;

  // ---------------------------------------------------------------- forest nodes
  const F = G.Farm;
  Object.assign(F.NODES, {
    web_cluster: { tool: 'sword', hp: 1, drops: [['spider_silk', 0.85, 1, 2]], sfx: 'web_snap', solid: true },
    bramble_patch: { tool: 'sword', hp: 2, drops: [['fiber', 0.8, 1, 2], ['thorn_bramble', 0.35, 1, 1], ['duskberry', 0.25, 1, 2]], sfx: 'harvest', solid: true },
    hollow_log_small: { tool: 'axe', hp: 3, drops: [['wood', 1, 3, 5], ['fairycap', 0.3, 1, 1]], sfx: 'axe_chop', solid: true, search: true },
    glowshroom_big: { tool: 'sword', hp: 1, drops: [['glowcap', 1, 2, 3], ['spore_sac', 0.3, 1, 1]], sfx: 'harvest', solid: true, glow: [93, 230, 255] },
  });
  const SEARCH = [['fairycap', 5], ['feather', 4], ['honey', 2], ['wolfsbane', 3], ['wisp_essence', 2], ['relic_coin', 0.6], ['golden_acorn', 0.35], ['amethyst', 1], ['spider_silk', 2], ['glimmer', 3]];

  // ---------------------------------------------------------------- THE DEEPWOOD
  const DW = 72, DH = 56, HOLLOWS = 34; // west of x=34 are the Hollows
  function buildDeepwood() {
    const m = new G.GameMap('deepwood', DW, DH, { name: 'The Deepwood', zone: 'deepwood', decorDensity: 0.7 });
    m.doors = [];
    m.fill(0, 0, DW, DH, M.FOREST);
    // clearings in the outer wood
    m.disc(64, 26, 6, 4.5, M.GRASS, 0.5); m.disc(54, 12, 7.5, 6, M.MEADOW, 0.5); m.disc(58, 42, 6.5, 5, M.GRASS, 0.5);
    m.disc(40, 41, 5.5, 4, M.GRASS, 0.5); m.disc(35, 8, 7, 4.5, M.GRASS, 0.5); m.disc(46, 23, 4, 3, M.MEADOW, 0.6);
    // the Hollows: boggy, dead ground; a black pond; the Elder Tree's clearing
    for (let y = 0; y < DH; y++) for (let x = 0; x < HOLLOWS; x++) { const n = U.noise(x / 7, y / 7, 515); if (n > 0.62) m.set(x, y, M.BOG); else if (n < 0.25) m.set(x, y, M.DIRT); }
    m.disc(16, 45, 6, 4, M.WATER, 0.7); m.disc(15, 46, 3.5, 2.2, M.DEEP, 0.5);
    m.disc(13, 27, 7, 5.5, M.MEADOW, 0.4);
    // the trail in, and its branches
    m.path([[72.5, 26], [64, 25.5], [58, 28], [52, 26], [46, 23], [40, 24.5], [34, 28], [28, 27], [22, 25], [16, 27.5]], 2, M.DIRT);
    m.path([[58, 27], [56, 20], [54, 15]], 1.6, M.DIRT);
    m.path([[52, 26], [56, 34], [58, 39]], 1.6, M.DIRT);
    m.path([[46, 23], [40, 16], [36, 11]], 1.6, M.DIRT);
    m.path([[40, 25], [40, 34], [40, 39]], 1.6, M.DIRT);
    m.path([[22, 26], [18, 35], [17, 40]], 1.4, M.DIRT);

    // --- the outer wood
    wild(m, 'signpost', 0, 67, 23, { interact: { kind: 'flavor', key: 'deep_sign_warning' } });
    for (const [x, y] of [[62, 24], [55, 27], [48, 21], [41, 23], [35, 26]]) wild(m, 'ward_lantern', 0, x, y);
    // the stone circle and its altar
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 - Math.PI / 2; wild(m, 'standing_stone', k === 4 ? 3 : k % 3, Math.round(54 + Math.cos(a) * 5), Math.round(12 + Math.sin(a) * 4), { interact: { kind: 'flavor', key: 'deep_stones' } }); }
    m.stoneAltar = wild(m, 'altar_slab', 0, 53, 12, { interact: { kind: 'wild', what: 'stones' } });
    // the watchtower ruin and its sealed chest
    G.addRuin(m, 'watchtower', 57, 40, { kind: 'flavor', key: 'deep_watchtower' });
    m.sealedChest = [60, 42];
    // the abandoned campsite
    wild(m, 'tent', 0, 38, 38, { interact: { kind: 'flavor', key: 'deep_campsite' } });
    wild(m, 'campfire', 0, 41, 41, { interact: { kind: 'flavor', key: 'deep_campsite' } });
    wild(m, 'bedroll', 0, 37, 41);
    m.campPack = wild(m, 'pack', 0, 43, 40, { interact: { kind: 'wild', what: 'pack' } });
    // the ruined chapel and a little root-swallowed shrine
    G.addRuin(m, 'ruin_chapel', 32, 5, { kind: 'flavor', key: 'deep_shrine' });
    G.addRuin(m, 'ruin_arch', 45, 31, { kind: 'flavor', key: 'deep_shrine' });
    // mossy giants
    for (const [x, y, v] of [[60, 33, 0], [47, 13, 1], [66, 44, 0], [44, 46, 1], [62, 6, 0]]) wild(m, 'giant_tree', v, x, y);
    wild(m, 'hollow_stump', 0, 50, 30);

    // --- the Hollows
    m.elder = wild(m, 'elder_tree', 0, 11, 21, { interact: { kind: 'wild', what: 'elder' } });
    for (const [x, y, v] of [[26, 20, 0], [29, 33, 1], [20, 14, 2], [8, 34, 0], [24, 40, 1], [30, 47, 2], [6, 16, 1], [27, 10, 0]]) wild(m, 'webbed_tree', v, x, y, { interact: { kind: 'flavor', key: 'deep_web_cocoon' } });
    for (const [x, y, v] of [[19, 30, 0], [25, 36, 2], [10, 40, 2], [21, 49, 0], [31, 22, 2]]) wild(m, 'bones', v, x, y, { interact: { kind: 'flavor', key: 'deep_bones' } });
    wild(m, 'bones', 1, 12, 38, { interact: { kind: 'flavor', key: 'deep_bones' } });
    for (const [x, y, v] of [[4, 24, 0], [28, 16, 1], [6, 47, 0], [30, 40, 1], [3, 8, 1], [22, 6, 0], [9, 52, 1]]) wild(m, 'eyes', v, x, y);
    m.add('reeds', 11, 43, { v: 0 }); m.add('reeds', 21, 44, { v: 1 }); m.add('lily', 18, 45, { v: 2 });

    // --- trees: living and dense outside, dead and webbed in the Hollows
    const avoid = (x, y) => {
      const t = m.t(x, y);
      return t === M.DIRT || t === M.MEADOW || (Math.hypot(x - 54, (y - 12) * 1.2) < 7.5) || (Math.hypot(x - 13, y - 26) < 7.5) || (Math.abs(x - 40) < 5 && Math.abs(y - 40) < 4) || (Math.abs(x - 58) < 5 && Math.abs(y - 41) < 4) || (x > 66 && y > 21 && y < 31) || (Math.abs(x - 34) < 6 && y < 10);
    };
    m.forest([HOLLOWS, 0, DW - HOLLOWS, DH], 0.4, ['pine', 'oak', 'pine', 'glow', 'oak', 'bush_dark', 'silver', 'pine'], 601, avoid);
    m.forest([0, 0, HOLLOWS, DH], 0.3, ['dead', 'dead', 'bush_dark', 'dead', 'pine'], 602, avoid);
    m.scatter('mushrooms', [0, 0, DW, DH], 22, 603, (r) => ({ v: Math.floor(r() * 2) }));
    m.scatter('log', [2, 2, DW - 4, DH - 4], 6, 604, (r, x, y) => (m.free(x + 1, y) ? { v: 0 } : null));
    m.scatter('reeds', [0, 30, HOLLOWS, 26], 10, 605, (r) => ({ v: Math.floor(r() * 2) }));

    m.exits.push({ rect: [DW - 1, 23, 1, 6], to: 'woods', at: 'west' });
    m.spawns = { east: [DW - 2.4, 26.6, 'left'], elder: [13.5, 28.5, 'up'] };
    m.music = 'deepwood';
    m.forageArea = [2, 2, DW - 4, DH - 4];
    m.mist = true;
    return m;
  }

  // ---------------------------------------------------------------- HUSHWILLOW GLADE
  function buildGlade() {
    const m = new G.GameMap('glade', 32, 24, { name: 'Hushwillow Glade', zone: 'glade', decorDensity: 0.7 });
    m.doors = [];
    m.fill(0, 0, 32, 24, M.FOREST);
    m.disc(16, 12, 13, 9, M.MEADOW, 0.5);
    m.disc(15, 12, 9, 6, M.GRASS, 0.4);
    m.disc(20, 9, 3.6, 2.6, M.WATER, 0.5);
    m.path([[-0.5, 12], [6, 12], [10, 12.5]], 1.6, M.DIRT);
    wild(m, 'tunnel_arch', 0, 0, 11, { interact: { kind: 'flavor', key: 'glade_sign' } });
    wild(m, 'willow_big', 0, 6, 5, { interact: { kind: 'flavor', key: 'glade_willow' } });
    wild(m, 'willow_big', 0, 24, 15, { interact: { kind: 'flavor', key: 'glade_willow' } });
    m.bonding = wild(m, 'bonding_stone', 0, 14, 7, { interact: { kind: 'bonding' } });
    for (const [x, y, v] of [[19, 8, 0], [21, 10, 1], [18, 10, 0]]) if (m.isWater(x, y)) wild(m, 'lilypads', v, x, y);
    for (const [x, y] of [[20, 9]]) m.examine.set(m.idx(x, y), 'glade_pond');
    for (const [x, y, v] of [[10, 9, 0], [12, 15, 1], [18, 15, 2], [8, 14, 1], [22, 13, 0], [14, 17, 2], [25, 8, 1], [11, 6, 2], [17, 5, 0]]) wild(m, 'flowers', v, x, y);
    m.forest([0, 0, 32, 24], 0.5, ['willow', 'oak', 'glow', 'bush_flower', 'wisteria'], 701, (x, y) => Math.hypot((x - 16) / 13, (y - 12) / 9) < 1.02 || (x < 3 && Math.abs(y - 12) < 2));
    m.scatter('bush', [3, 3, 26, 18], 6, 702, (r) => ({ kind: 'flower', v: Math.floor(r() * 3) }));
    m.scatter('mushrooms', [3, 3, 26, 18], 5, 703, (r) => ({ v: Math.floor(r() * 2) }));
    m.add('reeds', 23, 9, { v: 0 }); m.add('reeds', 17, 8, { v: 1 });
    // the sleeping animals
    m.critterSpots = [['fox', 11, 13], ['deer', 22, 16], ['rabbit', 9, 16], ['rabbit', 10, 17], ['owl', 7, 9], ['hedgehog', 17, 17]];
    m.exits.push({ rect: [0, 11, 1, 3], to: 'woods', at: 'east' });
    m.spawns = { west: [1.6, 12.6, 'right'], stone: [15, 9.6, 'up'] };
    m.music = 'glade';
    m.peaceful = true;
    return m;
  }

  G.buildForest = function () { return { deepwood: buildDeepwood(), glade: buildGlade() }; };

  // ---------------------------------------------------------------- critters (petting, once a day each)
  class Critter {
    constructor(type, x, y, idx) {
      this.critter = true; this.type = type; this.x = x * 16 + 8; this.y = y * 16 + 12; this.idx = idx;
      this.info = (window.MobArt && MobArt.critterInfo && MobArt.critterInfo(type)) || { w: 16, h: 12, ax: 8, ay: 11, anims: { sleep: 2, idle: 2 }, fps: { sleep: 1.5, idle: 2 } };
      this.anim = 'sleep'; this.t = Math.random() * 3; this.flip = Math.random() < 0.5; this.awake = 0; this.heart = 0; this.sortY = this.y;
    }
    update(dt) {
      this.t += dt;
      if (this.awake > 0) { this.awake -= dt; if (this.awake <= 0) this.anim = 'sleep'; }
      if (this.heart > 0) this.heart -= dt;
    }
    draw(ctx, ox, oy) {
      const info = this.info, n = (info.anims && info.anims[this.anim]) || 1, f = Math.floor(this.t * ((info.fps && info.fps[this.anim]) || 1.5)) % n;
      let c = null;
      try { if (window.MobArt && MobArt.critter) c = MobArt.critter(this.type, this.anim, f, this.flip); } catch (e) { c = null; }
      if (c) ctx.drawImage(c, Math.round(this.x - info.ax + ox), Math.round(this.y - info.ay + oy));
      else { ctx.fillStyle = '#9c7a5e'; ctx.fillRect(Math.round(this.x - 5 + ox), Math.round(this.y - 6 + oy), 10, 6); }
      if (this.anim === 'sleep' && this.type !== 'owl') { // a little drifting "z"
        const k = (this.t * 0.6) % 1, zx = Math.round(this.x + 4 + k * 4 + ox), zy = Math.round(this.y - info.ay - 2 - k * 8 + oy);
        ctx.globalAlpha = 0.8 * (1 - k); ctx.fillStyle = '#e4d2ff';
        ctx.fillRect(zx, zy, 3, 1); ctx.fillRect(zx + 1, zy + 1, 1, 1); ctx.fillRect(zx, zy + 2, 3, 1);
        ctx.globalAlpha = 1;
      }
      if (this.heart > 0) {
        const y = Math.round(this.y - info.ay - 6 + oy - (1.2 - this.heart) * 8), x = Math.round(this.x + ox);
        ctx.fillStyle = '#e8607e'; ctx.fillRect(x - 3, y, 2, 2); ctx.fillRect(x + 1, y, 2, 2); ctx.fillRect(x - 2, y + 2, 4, 1); ctx.fillRect(x - 1, y + 3, 2, 1);
      }
    }
  }

  // ---------------------------------------------------------------- wild creatures by place and time
  const night = () => G.S.mins >= 1140 || G.S.mins < 330;
  const dusk = () => G.S.mins >= 1080 || G.S.mins < 330;
  function zones(map) {
    if (map.id === 'woods') return [
      { types: [['wisp', 'teal']], n: dusk() ? 3 : 0, rect: [2, 2, 50, 34], floor: 1 },
      { types: [['thornling', 'bramble']], n: 2, rect: [2, 2, 36, 34], floor: 1 },
      { types: [['bogling', 'bog'], ['bogling', 'toad']], n: 3, rect: [0, 39, 56, 9], floor: 1, onlyOn: [M.BOG, M.DIRT] },
    ];
    if (map.id === 'deepwood') return [
      { types: [['thornling', 'bramble'], ['thornling', 'blackthorn']], n: 3, rect: [HOLLOWS, 2, DW - HOLLOWS - 6, DH - 4], floor: 5 },
      { types: [['hornbeetle', 'bronze']], n: night() ? 1 : 2, rect: [HOLLOWS, 2, DW - HOLLOWS - 6, DH - 4], floor: 6 },
      { types: [['mosswolf', 'grey'], ['mosswolf', 'shadow']], n: night() ? 4 : 0, rect: [HOLLOWS - 4, 2, DW - HOLLOWS - 2, DH - 4], floor: 7, pairs: true },
      { types: [['wisp', 'teal'], ['wisp', 'violet']], n: dusk() ? 4 : 1, rect: [10, 2, DW - 16, DH - 4], floor: 6 },
      { types: [['webweaver', 'brown'], ['webweaver', 'ashen']], n: 4, rect: [2, 2, HOLLOWS - 4, DH - 4], floor: 12 },
      { types: [['gloombeetle', 'violet'], ['gloombeetle', 'emerald'], ['hornbeetle', 'iron']], n: 3, rect: [2, 2, HOLLOWS - 2, DH - 4], floor: 12 },
    ];
    return [];
  }
  const W = () => G.World;
  function freeSpot(map, rect, r, p, onlyOn) {
    for (let k = 0; k < 40; k++) {
      const x = rect[0] + Math.floor(r() * rect[2]), y = rect[1] + Math.floor(r() * rect[3]);
      if (!map.inb(x, y) || map.blocked(x, y) || map.tobj.has(map.idx(x, y))) continue;
      if (onlyOn && !onlyOn.includes(map.t(x, y))) continue;
      if (p && Math.hypot(x * 16 + 8 - p.x, y * 16 + 8 - p.y) < 9 * 16) continue;
      return [x, y];
    }
    return null;
  }
  const Wilds = (G.Wilds = {});
  // top a map up to its creature counts (called on entering and every hour)
  Wilds.populate = function (map) {
    if (!map || map.peaceful) return;
    const p = W().player, r = U.rng(Date.now() % 1e6);
    const live = (type) => map.entities.filter((e) => e.mob && !e.dead && e.type === type).length;
    for (const z of zones(map)) {
      const want = z.n, types = [...new Set(z.types.map((t) => t[0]))];
      let have = types.reduce((a, t) => a + live(t), 0);
      while (have < want) {
        const sp = freeSpot(map, z.rect, r, p, z.onlyOn); if (!sp) break;
        const [type, variant] = z.types[Math.floor(r() * z.types.length)];
        const mob = G.Mobs.spawn(type, variant, sp[0] * 16 + 8, sp[1] * 16 + 12, z.floor);
        map.entities.push(mob); have++;
        if (z.pairs && have < want) { const b = G.Mobs.spawn(type, variant, sp[0] * 16 + 24, sp[1] * 16 + 12, z.floor); map.entities.push(b); have++; }
      }
      // creatures of the night melt away at dawn
      if (want === 0) for (const e of map.entities) if (e.mob && types.includes(e.type) && !e.aggro && Math.hypot(e.x - p.x, e.y - p.y) > 140) e.dead = true;
    }
    // the hollowstag walks the Elder Tree's clearing on full-moon nights
    if (map.id === 'deepwood' && G.isFullMoon() && night() && G.S.flags.stagMoon !== G.S.day && !map.entities.some((e) => e.type === 'hollowstag' && !e.dead)) {
      const stag = G.Mobs.spawn('hollowstag', 'default', 13.5 * 16, 30 * 16, 20);
      stag.onDeath = () => { G.S.flags.stagMoon = G.S.day; G.UI.toast('The hollowstag fades into moonlight, leaving something behind.'); G.jingle('quest_complete'); };
      map.entities.push(stag);
      G.UI.toastOnce('stag', 'Hooves of light thud somewhere in the Hollows…', 30);
    }
    // the glade's sleepers (and the occasional rabbit in Whisperwood)
  };
  Wilds.critters = function (map) {
    if (!map.critterSpots || map.entities.some((e) => e.critter)) return;
    map.critterSpots.forEach(([type, x, y], i) => map.entities.push(new Critter(type, x, y, i)));
  };

  // ---------------------------------------------------------------- interactions
  Wilds.interact = function (map, tx, ty, wx, wy) {
    const S = G.S, p = W().player;
    // critters: gently pet them
    for (const e of map.entities) {
      if (!e.critter) continue;
      const near = (Math.floor(e.x / 16) === tx && Math.floor((e.y - 4) / 16) === ty) || (wx != null && Math.abs(wx - e.x) < 10 && wy > e.y - 16 && wy < e.y + 3);
      if (!near) continue;
      const pets = S.critterPets || (S.critterPets = {});
      const key = e.type + e.idx;
      e.anim = 'idle'; e.awake = 2.5; e.heart = 1.2; e.flip = p.x < e.x;
      G.sfx(e.type === 'owl' ? 'owl_hoot_soft' : 'animal_purr');
      const lines = window.GAMETEXT && GAMETEXT.critters && GAMETEXT.critters[e.type];
      if (pets[key] !== S.day) { pets[key] = S.day; S.energy = Math.min(S.maxEnergy, S.energy + 6); G.emit('petCritter', e.type); }
      G.UI.toast(lines ? G.UI.fill(U.pick(lines)) : 'It sighs happily in its sleep.');
      return true;
    }
    const o = map.obj(tx, ty);
    // search a hollow log (once a day each)
    if (o && o.kind === 'node' && F.NODES[o.type] && F.NODES[o.type].search) {
      if (o.searched === S.day) { G.UI.toastOnce('searched', 'Nothing more in there today.'); return true; }
      o.searched = S.day; o.shake = 0.2;
      G.sfx('cloth_rustle');
      const r = U.rng(S.seed + S.day * 17 + tx * 31 + ty);
      const pick = r() < 0.18 + G.Stats.luckChance(0.05) ? null : r.weighted(SEARCH);
      if (!pick) { G.UI.toast('Just beetles and old leaves.'); return true; }
      if (pick === 'glimmer') { const g = 20 + Math.floor(r() * 60); S.gold += g; G.UI.toast(`A little pouch of coins: +${g} ✦`); G.sfx('coin'); return true; }
      G.dropItem(map, pick, 1, tx * 16 + 8, ty * 16 + 10);
      G.UI.toast('You find something tucked inside the log.');
      return true;
    }
    // the sealed chest at the watchtower
    if (o && o.kind === 'sealed') {
      if (o.open) { G.UI.toast('Empty now, but for the smell of very old rain.'); return true; }
      if (!G.Inv.has('old_key')) { G.UI.flavor('deep_sealed_chest'); return true; }
      G.Inv.remove('old_key', 1); o.open = true; o.state = 'open';
      G.sfx('chest_open'); G.sfx('treasure'); G.jingle('discovery');
      for (const [id, n] of [['relic_feather', 1], ['moonstone', 2], ['emerald', 2], ['scroll_pot_thornhide', 1]]) G.dropItem(map, id, n, tx * 16 + 8, ty * 16 + 6);
      S.gold += 750; G.UI.toast('The rusted key turns. Inside: a Phoenix Feather, gems, a recipe and 750 ✦.');
      return true;
    }
    return false;
  };
  Wilds.propInteract = async function (it, prop) {
    const S = G.S;
    if (it.what === 'pack') {
      if (S.flags.campKey) { G.UI.flavor('deep_campsite'); return; }
      await G.UI.say(null, ['A leather pack, stiff with damp. Inside: a tin cup, a candle stub, and a heavy iron key tied with red string.', 'A label on the string, in faded ink: "Watchtower. Do not open after dark."']);
      S.flags.campKey = true; G.Inv.giveOrDrop('old_key', 1); G.sfx('pickup');
      return;
    }
    if (it.what === 'elder') {
      await G.UI.flavor('deep_elder_tree');
      if (!S.flags.elderGift && night()) { S.flags.elderGift = true; G.Inv.giveOrDrop('golden_acorn', 1); G.jingle('discovery'); G.UI.toast('Something drops from the branches: a Golden Acorn.'); }
      return;
    }
    if (it.what === 'stones') {
      if (G.isFullMoon() && night() && S.flags.stonesMoon !== S.day) {
        S.flags.stonesMoon = S.day;
        G.R.doFlash('200,230,255', 0.3); G.sfx('mystery_chime'); G.jingle('discovery');
        await G.UI.say(null, ['Under the full moon the carvings brighten one by one, all the way round the ring. When the last one lights, something cold and smooth is resting on the altar.']);
        G.Inv.giveOrDrop(Math.random() < 0.25 + G.Stats.luckChance(0.05) ? 'relic_star' : 'moonstone', 1);
        return;
      }
      G.UI.flavor('deep_stones');
    }
  };

  // ---------------------------------------------------------------- hooks
  // first population of the new maps (objects that persist in the save)
  G.World.populateMap = function (map) {
    if (map.id === 'deepwood') {
      const [cx, cy] = map.sealedChest;
      map.setObj(cx, cy, { kind: 'sealed', solid: true, open: false, state: 'closed' });
      F.scatterNodes(map, [HOLLOWS, 2, DW - HOLLOWS - 4, DH - 4], 14, [['bramble_patch', 4], ['hollow_log_small', 3], ['twig', 2], ['weed', 2]], 811);
      F.scatterNodes(map, [2, 2, HOLLOWS - 2, DH - 4], 18, [['web_cluster', 5], ['glowshroom_big', 3], ['hollow_log_small', 1]], 812);
    }
    if (map.id === 'woods') F.scatterNodes(map, [2, 2, 50, 34], 6, [['hollow_log_small', 2], ['bramble_patch', 3], ['glowshroom_big', 1]], 813, (x, y) => map.t(x, y) !== M.DIRT);
  };
  G.on('mapChanged', (map) => {
    if (!map) return;
    if (map.critterSpots) Wilds.critters(map);
    if (map.id === 'woods' || map.id === 'deepwood') Wilds.populate(map);
  });
  G.on('tick', () => { const map = W().map; if (map && (map.id === 'woods' || map.id === 'deepwood') && G.S.mins % 60 < 10) Wilds.populate(map); });
  // the hollowstag gets a health bar once it notices you
  Wilds.update = function () {
    const map = W().map; if (!map || map.id !== 'deepwood') { if (G.UI._bossOf && G.UI._bossOf.type === 'hollowstag') G.UI.bossBar(null); return; }
    const stag = map.entities.find((e) => e.type === 'hollowstag' && !e.dead && e.dying <= 0);
    if (stag && stag.aggro && G.UI._bossOf !== stag) G.UI.bossBar(stag, 'The Hollowstag');
    if ((!stag || !stag.aggro) && G.UI._bossOf && G.UI._bossOf.type === 'hollowstag') G.UI.bossBar(null);
  };
  // how deep into the Deepwood are you? 0 at the edge, 1 at the Elder Tree
  Wilds.depth = function () { const map = W().map, p = W().player; if (!map || map.id !== 'deepwood' || !p) return 0; return U.clamp((DW * 16 - 64 - p.x) / ((DW - 20) * 16), 0, 1); };
})();
