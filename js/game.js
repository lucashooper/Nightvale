// Nightvale — world controller: game state, maps, time & days, interaction, tools, drawables, lights.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.MAT, Inv = G.Inv, F = G.Farm;
  const W = (G.World = { maps: {}, map: null, player: null, npcs: [], cutscene: false, trans: false, weather: 'clear', lastTick: -1, lastHour: -1 });
  const WEEK = ['Moonday', 'Mistday', 'Wyrmsday', 'Thornsday', 'Emberday', 'Starday', 'Sunday'];
  const MOON = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  G.WEEK = WEEK; G.MOON = MOON;
  G.weekday = (d) => WEEK[((d || G.S.day) - 1) % 7];
  G.moonPhase = (d) => ((d || G.S.day) + 0) % 8; // day 1 -> waxing crescent, day 4 -> full
  G.isFullMoon = (d) => G.moonPhase(d) === 4;
  G.isNewMoon = (d) => G.moonPhase(d) === 0;
  G.absTime = () => G.S.day * 1440 + G.S.mins;
  G.timeOfDay = function () { const h = G.S.mins / 60; return h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night'; };

  // ---------------------------------------------------------------- new game / state
  W.freshState = function (name, look) {
    const S = {
      v: 1, name: name || 'Wren', look: look || { skin: 1, hair: 0, hairColor: 1, robe: 0, eyes: 0 },
      day: 1, mins: 360, gold: 500, hp: 100, maxHp: 100, energy: 200, maxEnergy: 200,
      inv: Inv.newArray(36), sel: 0, toolTier: { hoe: 0, can: 0, pickaxe: 0, axe: 0 }, water: 40,
      known: { pot_healing: 1, pot_vigor: 1, pot_fairy: 1 }, flags: { forestNodes: true }, friends: {}, bundles: {}, bundlesDone: {},
      maxDepth: 0, gates: [], stats: { shipped: 0, earned: 0, brewed: 0, kills: 0, fish: 0, harvested: 0 }, buffs: {},
      weather: 'sunny', tomorrow: 'clear', ship: [], request: null, chest: Inv.newArray(36), mapState: {}, mapId: 'sanctum', spawn: 'start',
      catPet: 0, seed: Math.floor(Math.random() * 1e9), objectives: {},
    };
    const start = [['hoe', 1], ['can', 1], ['pickaxe', 1], ['axe', 1], ['sword_rusty', 1], ['seed_moonpetal', 12], ['seed_glowcap', 8], ['pot_healing', 2]];
    start.forEach(([id, n], i) => (S.inv[i] = { id, n }));
    return S;
  };

  W.buildWorld = function () {
    W.maps = G.buildOverworld();
    if (G.NPCs.resetRoutes) G.NPCs.resetRoutes();
    for (const id in W.maps) W.maps[id].seed = (W.maps[id].seed + (G.S.seed % 1000)) | 0;
  };

  // first-time population of map objects
  W.populateFresh = function () {
    const sa = W.maps.sanctum;
    // overgrown garden
    F.scatterNodes(sa, [12, 23, 24, 12], 40, [['weed', 5], ['pebble', 2], ['twig', 2]], 101, (x, y) => sa.t(x, y) === M.EARTH && !(x >= 12 && x <= 16 && y >= 23 && y <= 27));
    F.scatterNodes(sa, [13, 6, 22, 15], 14, [['weed', 4], ['pebble', 3], ['twig', 1]], 102, (x, y) => !(x >= 20 && x <= 27 && y >= 9 && y <= 15) && !(x >= 21 && x <= 26 && y >= 16));
    F.scatterNodes(sa, [2, 6, 44, 30], 26, [['weed', 4], ['twig', 2], ['pebble', 1], ['stump', 1]], 103, (x, y) => !(x >= 11 && x <= 36 && y >= 20) && sa.t(x, y) !== M.DIRT && !(x >= 1 && x <= 10 && y >= 24 && y <= 30));
    for (const [x, y] of [[20, 33], [33, 24]]) if (sa.t(x, y) === M.EARTH && !sa.obj(x, y)) sa.setObj(x, y, F.makeNode('stump', 0));
    // home objects
    sa.setObj(9, 27, { kind: 'chest', items: G.S.chest, solid: true, home: true });
    sa.setObj(2, 28, { kind: 'offering', solid: true });
    sa.setObj(17, 17, { kind: 'cauldron', state: 'idle', solid: true });
    for (const id of ['woods', 'lake', 'ridge', 'village', 'deepwood', 'glade']) if (W.maps[id]) { if (W.populateMap) W.populateMap(W.maps[id]); W.dailySpawns(W.maps[id], true); }
  };

  // maps added after a save was made (new areas) get their first population on load
  W.populateNew = function (saved) {
    for (const id in W.maps) if (!saved[id] && id !== 'depths') { if (W.populateMap) W.populateMap(W.maps[id]); W.dailySpawns(W.maps[id], true); }
    if (!G.S.flags.forestNodes && W.populateMap && W.maps.woods) { G.S.flags.forestNodes = true; W.populateMap(W.maps.woods); }
  };

  W.dailySpawns = function (map, first) {
    const r = U.rng(G.S.seed + G.S.day * 31 + map.w);
    const count = (pred) => { let n = 0; for (const o of map.tobj.values()) if (pred(o)) n++; return n; };
    if (map.id === 'woods') {
      const n = count((o) => o.kind === 'forage');
      F.scatterNodes(map, map.forageArea, Math.max(0, 9 - n), [['forage:fairycap', 4], ['forage:wolfsbane', 3], ['forage:feather', 2], ['forage:honey', 1]], r.int(1, 1e6), (x, y) => map.t(x, y) !== M.BOG && map.t(x, y) !== M.DIRT);
      F.scatterNodes(map, [0, 38, 56, 10], count((o) => o.id === 'bog_amber') < 2 ? 1 : 0, [['forage:bog_amber', 1]], r.int(1, 1e6), (x, y) => map.t(x, y) === M.BOG);
      F.scatterNodes(map, map.forageArea, Math.max(0, 8 - count((o) => o.kind === 'node')), [['twig', 3], ['weed', 3], ['stump', 1]], r.int(1, 1e6), (x, y) => map.t(x, y) !== M.DIRT);
    } else if (map.id === 'deepwood') {
      F.scatterNodes(map, map.forageArea, Math.max(0, 8 - count((o) => o.kind === 'forage')), [['forage:fairycap', 3], ['forage:wolfsbane', 3], ['forage:feather', 2], ['forage:bog_amber', 1], ['forage:wisp_essence', 1]], r.int(1, 1e6), (x, y) => map.t(x, y) !== M.DIRT);
      F.scatterNodes(map, [2, 2, 30, 52], Math.max(0, 10 - count((o) => o.type === 'web_cluster')), [['web_cluster', 3], ['glowshroom_big', 1]], r.int(1, 1e6));
      F.scatterNodes(map, [34, 2, 34, 52], Math.max(0, 8 - count((o) => o.type === 'bramble_patch' || o.type === 'hollow_log_small')), [['bramble_patch', 3], ['hollow_log_small', 1]], r.int(1, 1e6));
    } else if (map.id === 'glade') {
      F.scatterNodes(map, [4, 4, 24, 16], Math.max(0, 4 - count((o) => o.kind === 'forage')), [['forage:moonlily', 2], ['forage:honey', 1], ['forage:feather', 2], ['forage:fairycap', 2]], r.int(1, 1e6), (x, y) => !map.isWater(x, y));
    } else if (map.id === 'lake') {
      F.scatterNodes(map, map.forageArea, Math.max(0, 6 - count((o) => o.kind === 'forage')), [['forage:moonlily', 3], ['forage:driftwood', 3], ['forage:shell', 3], ['forage:pearl', 0.35]], r.int(1, 1e6), (x, y) => map.t(x, y) === M.SAND || map.t(x, y) === M.GRASS);
    } else if (map.id === 'ridge') {
      F.scatterNodes(map, map.mineArea, Math.max(0, 12 - count((o) => o.kind === 'node')), [['rock', 6], ['ore_glimmer', 3], ['starshard', 1.2], ['gem_quartz', 0.6], ['gem_amethyst', 0.4], ['boulder', 0.5]], r.int(1, 1e6), (x, y) => map.t(x, y) !== M.STAIRS);
      F.scatterNodes(map, map.mineArea, Math.max(0, 2 - count((o) => o.kind === 'forage')), [['forage:starshard', 1], ['forage:feather', 1]], r.int(1, 1e6));
    } else if (map.id === 'village') {
      F.scatterNodes(map, [4, 30, 56, 16], Math.max(0, 2 - count((o) => o.kind === 'forage')), [['forage:honey', 1], ['forage:wolfsbane', 1]], r.int(1, 1e6), (x, y) => map.t(x, y) === M.GRASS || map.t(x, y) === M.MEADOW);
    } else if (map.id === 'sanctum' && !first) {
      F.scatterNodes(map, [2, 6, 44, 30], count((o) => o.kind === 'node') < 30 ? 2 : 0, [['weed', 3], ['twig', 1]], r.int(1, 1e6), (x, y) => !(x >= 11 && x <= 36 && y >= 20) && !(x >= 13 && x <= 34 && y >= 6 && y <= 20) && map.t(x, y) !== M.DIRT && !(x >= 1 && x <= 10 && y >= 24 && y <= 30));
    }
    if (G.S.weather === 'starfall' && map.outdoor && map.id !== 'sanctum') F.scatterNodes(map, [2, 2, map.w - 4, map.h - 4], 3, [['forage:starshard', 1]], r.int(1, 1e6), (x, y) => !map.isWater(x, y));
  };

  // ---------------------------------------------------------------- serialization of map state
  W.serializeMaps = function () {
    const out = {};
    for (const id in W.maps) {
      const m = W.maps[id];
      if (id === 'depths') continue;
      const farm = []; for (const [i, f] of m.farm) farm.push([i, f.watered ? 1 : 0, f.crop ? [f.crop.id, f.crop.days, f.crop.regrowing ? 1 : 0] : 0, f.fert ? 1 : 0]);
      const objs = [];
      for (const [i, o] of m.tobj) {
        const c = Object.assign({}, o); delete c.tx; delete c.ty; delete c.shake; delete c.open;
        if (c.kind === 'chest' && c.home) c.items = null; // home chest lives in S.chest
        objs.push([i, c]);
      }
      out[id] = { farm, objs, w: m.w };
    }
    return out;
  };
  W.restoreMaps = function (data) {
    for (const id in data) {
      const m = W.maps[id]; if (!m) continue;
      m.farm.clear(); m.tobj.clear();
      const OLD_W = { village: 64 }; // widths before this update, for saves that didn't record them
      const sw = data[id].w || OLD_W[id] || m.w; // saves made before a map was widened store indices in the old width
      const at = (i) => [i % sw, Math.floor(i / sw)];
      for (const [i, w, crop, fert] of data[id].farm) { const [x, y] = at(i); if (m.inb(x, y)) m.farm.set(m.idx(x, y), { watered: !!w, crop: crop ? { id: crop[0], days: crop[1], regrowing: !!crop[2] } : null, fert: !!fert }); }
      for (const [i, o] of data[id].objs) {
        const [x, y] = at(i);
        if (o.kind === 'chest' && o.home) o.items = G.S.chest;
        // drop loose objects that a new building now stands on (never the home chest, box or cauldrons)
        if (!m.inb(x, y) || ((m.solid[m.idx(x, y)] || m.propAt.has(m.idx(x, y))) && !o.home && o.kind !== 'offering' && o.kind !== 'cauldron' && o.kind !== 'chest')) continue;
        m.setObj(x, y, o);
      }
    }
  };

  // ---------------------------------------------------------------- starting / loading
  W.start = function (S, isNew) {
    G.S = S;
    if (!S.objectives) S.objectives = {};
    W.buildWorld();
    if (isNew) W.populateFresh(); else { W.restoreMaps(S.mapState || {}); W.populateNew(S.mapState || {}); }
    W.applyRestoration(false);
    W.player = new G.Player();
    G.NPCs.init();
    W.weather = S.weather;
    W.changeMap(S.mapId === 'depths' ? 'ridge' : S.mapId || 'sanctum', S.mapId === 'depths' ? 'cave' : S.spawn || 'start', { instant: true, silent: true });
    W.lastHour = -1;
    G.emit('worldStart', isNew);
  };

  // visual restoration of the sanctum according to completed altar offerings
  W.applyRestoration = function (rebake) {
    const sa = W.maps.sanctum, S = G.S;
    const n = Object.keys(S.bundlesDone || {}).filter((k) => S.bundlesDone[k]).length;
    if (!sa) return;
    const swap = (old, type, o) => { if (!old) return null; sa.removeProp(old); return sa.add(type, old.tx, old.ty, Object.assign({}, old.o, o)); };
    if (sa.altarProp && (sa.altarProp.o.level | 0) !== n) sa.altarProp = swap(sa.altarProp, 'altar', { level: n });
    if (S.bundlesDone.delver && sa.braziers) sa.braziers = sa.braziers.map((b) => (b.o.lit ? b : swap(b, 'brazier', { lit: true })));
    if (S.bundlesDone.alchemy && sa.goddessProp && !sa.goddessProp.o.restored) sa.goddessProp = swap(sa.goddessProp, 'goddess', { restored: true });
    if (S.bundlesDone.forage) {
      const [x, y, w, h] = sa.poolRect;
      let changed = false;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (sa.t(x + i, y + j) !== M.POOL) { sa.set(x + i, y + j, M.POOL); changed = true; }
      if (changed && sa.baked) sa.bake();
    }
    if (rebake && sa.baked) sa.bake();
  };

  // ---------------------------------------------------------------- map changes
  W.changeMap = function (id, at, opts) {
    opts = opts || {};
    const go = () => {
      let map;
      if (id === 'depths') { map = G.Dungeon.enter(opts.floor || 1); W.maps.depths = map; }
      else map = W.maps[id];
      if (!map.baked) map.bake();
      const prev = W.map;
      W.map = map;
      const p = W.player;
      let sp = Array.isArray(at) ? at : map.spawns[at] || map.spawns.start || Object.values(map.spawns)[0] || [map.w / 2, map.h / 2, 'down'];
      p.x = sp[0] * 16; p.y = sp[1] * 16; p.dir = sp[2] || 'down';
      p.action = null; p.kb = [0, 0];
      G.S.mapId = id; G.S.spawn = typeof at === 'string' ? at : null;
      G.R.particles.length = 0; G.R.resetWeatherFx();
      map.items = map.items.filter((it) => !it.dead);
      G.NPCs.onMapChange(map);
      W.updateAudio(true);
      if (!opts.silent && (!prev || prev.id !== map.id)) G.UI.banner(map.id === 'depths' ? map.name : map.name, map.id === 'depths' ? map.subtitle : null);
      const vk = { tavern: 'village', boutique: 'village', cathedral: 'village', cottage: 'sanctum' }[id] || id;
      (G.S.visited || (G.S.visited = {}))[vk] = true;
      G.emit('mapChanged', map, prev);
    };
    if (opts.instant) { go(); return; }
    W.trans = true;
    G.UI.fadeTo(1, 0.28).then(() => { go(); return G.UI.fadeTo(0, 0.32); }).then(() => { W.trans = false; });
  };

  // the full-moon fairy ring in Whisperwood
  W.fairyRing = async function () {
    const S = G.S, misc = window.GAMETEXT && GAMETEXT.misc;
    const night = S.mins >= 1260 || S.mins < 300;
    if (G.isFullMoon() && night && S.flags.fairyDay !== S.day) {
      S.flags.fairyDay = S.day;
      S.flags.fairyVisits = (S.flags.fairyVisits || 0) + 1;
      G.jingle('discovery'); G.sfx('fairy_chime');
      G.R.doFlash('170,255,220', 0.45);
      const [cx, cy] = W.map.fairyRing;
      G.R.burst(cx * 16 + 8, cy * 16 + 8, 40, { colors: ['#b4ffd9', '#5dffb0', '#e4d2ff', '#ffffff'], speed: 60, life: 1.6, grav: -30, up: 20 });
      await G.UI.say(null, (misc && misc.fairyRing) || ['The mushrooms glow. Small voices laugh. When you look down, something has been left in the ring for you.']);
      const gifts = [['seed_starflask', 1], ['seed_starbloom', 3], ['moonstone', 1], ['pot_starlight', 1], ['seed_phialvine', 2], ['seed_wispvine', 2]];
      const [id, n] = gifts[(S.flags.fairyVisits - 1) % gifts.length];
      G.Inv.giveOrDrop(id, n);
      return;
    }
    G.UI.flavor(G.isFullMoon() ? 'fairy_ring_full' : 'fairy_ring');
  };

  W.inputLocked = () => W.trans || W.cutscene || G.UI.isModal() || W.decorating;

  // ---------------------------------------------------------------- audio
  W.updateAudio = function (force) {
    const A = window.AudioEngine; if (!A) return;
    const S = G.S, map = W.map; if (!map) return;
    const hour = S.mins / 60;
    const depth = map.id === 'deepwood' ? Math.round(G.Wilds.depth() * 10) / 10 : map.floor || 0;
    W.audioDepth = depth;
    const zone = map.id === 'depths' ? 'depths' : map.id === 'village' && G.Festival && G.Festival.active() ? 'festival' : map.zone;
    try { A.setZone(zone, { night: hour >= 19 || hour < 6, hour, depth, weather: W.weather }); } catch (e) { /* audio optional */ }
  };

  // ---------------------------------------------------------------- update
  W.update = function (dt) {
    const S = G.S, map = W.map, p = W.player;
    if (!map) return;
    // time flows unless a menu is open
    if (!G.UI.isModal() && !W.trans && !W.cutscene && !W.sleeping && !W.decorating) {
      if (!G.admin('freeze')) S.mins += dt / 0.7;
      for (const k in S.buffs) { if (S.buffs[k] < 90000) { S.buffs[k] -= dt; if (S.buffs[k] <= 0) delete S.buffs[k]; } }
      G.Stats.update(dt);
      G.Magic.update(dt);
      G.Festival.update(dt);
      const tick = Math.floor(S.mins / 10);
      if (tick !== W.lastTick) { W.lastTick = tick; W.onTick(); }
      if (S.mins >= 1560) { if (G.admin('noSleep')) W.rollDay(); else { W.passOut(); return; } }
    }
    p.update(dt, map);
    if (!W.trans) { checkExits(); checkDoors(dt); }
    // tile object timers
    for (const o of map.tobj.values()) if (o.shake > 0) o.shake -= dt;
    // items
    for (const it of map.items) it.update(dt, map, p);
    if (map.items.length) map.items = map.items.filter((it) => !it.dead);
    G.NPCs.update(dt, map);
    if (map.id === 'depths') G.Dungeon.update(dt, map);
    else if (map.entities.length) {
      for (const e of map.entities) e.update(dt, map, p);
      if (map.entities.some((e) => e.mob && !e.dead)) G.Mobs.collide(map, p);
      map.entities = map.entities.filter((e) => !e.dead);
    }
    if (G.Fishing) G.Fishing.update(dt);
    G.Familiars.update(dt, map);
    G.Wilds.update();
    if (G.Guild) G.Guild.update(dt);
    if (G.Menagerie) G.Menagerie.update(dt);
    if (map.id === 'deepwood' && Math.abs(Math.round(G.Wilds.depth() * 10) / 10 - (W.audioDepth || 0)) >= 0.1) W.updateAudio();
    ambientLife(dt, map);
    // controls
    if (W.decorating && !G.UI.isModal()) G.Decor.update();
    if (!W.inputLocked()) handleInput();
  };

  // walking up into a building's door goes inside
  function checkDoors(dt) {
    const p = W.player, map = W.map;
    if (!map.doors || !map.doors.length || !p.moving || p.dir !== 'up' || W.inputLocked() || (G.Menagerie && G.Menagerie.flying())) { W.doorPush = 0; return; }
    const [fx, fy] = p.facingTile();
    const d = map.doors.find((e) => fy === e.y && fx >= e.x && fx < e.x + e.w);
    if (!d || p.y - 3 - (d.y + 1) * 16 > 7) { W.doorPush = 0; return; }
    W.doorPush = (W.doorPush || 0) + dt;
    if (W.doorPush > 0.1) { W.doorPush = 0; W.enterDoor(d); }
  }
  W.doorAt = (map, tx, ty) => (map.doors || []).find((e) => ty === e.y && tx >= e.x && tx < e.x + e.w) || null;
  W.enterDoor = function (d) {
    const S = G.S, h = S.mins / 60;
    // homes: open in the day; after hours only for close friends (4+ hearts) until eleven, or your partner
    if (d.owner) {
      const open = !d.hours || (h >= d.hours[0] && h < d.hours[1]);
      const friend = G.NPCs.hearts(d.owner) >= 4 && h >= 7 && h < 23, partner = S.partner === d.owner;
      if (!open && !friend && !partner) { G.UI.toastOnce('closed:' + d.to, `${d.name} is locked for the night. Come back after ${fmtHour(d.hours[0])}.`, 3); G.sfx('door_creak', { volume: 0.4 }); return; }
      if (!W.maps[d.to]) return;
      G.sfx('door_open'); W.changeMap(d.to, d.at); return;
    }
    if (d.hours && (h < d.hours[0] || h >= d.hours[1])) {
      G.UI.toastOnce('closed:' + d.to, `${U.cap ? U.cap(d.name || 'It') : d.name} is closed. Open ${fmtHour(d.hours[0])}–${fmtHour(d.hours[1])}.`, 3);
      G.sfx('door_creak', { volume: 0.4 });
      return;
    }
    if (!W.maps[d.to]) { // interior not built (older data): fall back to the old behaviour
      if (d.to === 'cottage') { W.propInteract({ interact: { kind: 'bed' }, doorTile: { x: d.x } }, d.x, d.y); return; }
      if (d.to === 'tavern') { G.Shop.open('sable'); return; }
      return;
    }
    G.sfx('door_open');
    W.changeMap(d.to, d.at);
  };

  function checkExits() {
    if (G.UI.isModal()) return;
    const p = W.player, map = W.map;
    const tx = Math.floor(p.x / 16), ty = Math.floor((p.y - 2) / 16);
    let inside = false;
    for (const ex of map.exits) {
      const [x, y, w, h] = ex.rect;
      if (ex.npc) continue;
      if (tx >= x && tx < x + w && ty >= y && ty < y + h) {
        inside = true;
        if (W.exitLatch) return;
        W.exitLatch = true;
        if (ex.to === 'depths') { G.Dungeon.chooseFloor().then(() => { if (!W.trans && W.map === map) { p.y += 14; p.dir = 'down'; W.exitLatch = false; } }); return; }
        if (ex.to === 'ridge-from-depths') { W.changeMap('ridge', 'cave'); return; }
        if (!W.maps[ex.to]) { W.exitLatch = false; continue; }
        W.changeMap(ex.to, ex.at);
        return;
      }
    }
    if (!inside) W.exitLatch = false;
  }

  // every 10 in-game minutes
  W.onTick = function () {
    const S = G.S;
    const hour = Math.floor(S.mins / 60);
    // cauldrons
    for (const id in W.maps) {
      const m = W.maps[id];
      for (const o of m.tobj.values()) if (o.kind === 'cauldron' && o.state === 'brewing' && G.absTime() >= o.readyAt) {
        o.state = 'done';
        if (W.map === m) { G.sfx('brew_done'); G.R.burst(o.tx * 16 + 8, o.ty * 16, 14, { colors: ['#ff9ac8', '#ffffff', '#e4d2ff'], speed: 40, life: 0.8, grav: -10, up: 20 }); }
      }
    }
    if (hour !== W.lastHour) { W.lastHour = hour; W.updateAudio(); G.NPCs.onHour(hour); }
    if (S.mins >= 1440 && !W.warnedLate && !G.admin('noSleep')) { W.warnedLate = true; G.UI.toast("It's getting late. You should head to bed."); }
    G.emit('tick');
  };

  // ---------------------------------------------------------------- input → actions
  function handleInput() {
    const I = G.Input, S = G.S;
    if (performance.now() - G.UI.closedAt < 160) return;
    // hotbar selection
    for (let k = 1; k <= 9; k++) if (I.keyHit('Digit' + k)) S.sel = k - 1;
    if (I.keyHit('Digit0')) S.sel = 9; if (I.keyHit('Minus')) S.sel = 10; if (I.keyHit('Equal')) S.sel = 11;
    if (I.mouse.wheel) { S.sel = U.wrap(S.sel + I.mouse.wheel, 12); }
    if (I.keyHit('Tab') && G.Magic.has()) { G.Magic.cycle(); return; }
    if (I.keyHit('KeyQ')) { G.Magic.cast(); return; }
    if (I.hit('inventory')) { G.UI.open('inventory'); return; }
    if (I.hit('menu')) { G.UI.open('pause'); return; }
    if (I.hit('map')) { G.UI.open('inventory', { tab: 'map' }); return; }
    if (I.hit('journal')) { G.UI.open('inventory', { tab: 'journal' }); return; }
    if (I.keyHit('KeyH')) { G.UI.open('guide'); return; }
    if (I.keyHit('KeyG') && G.Decor.can()) { G.Decor.toggle(); return; }
    if (I.keyHit('KeyR') && G.Menagerie) { G.Menagerie.toggleRide(); return; }
    const p = W.player;
    if (p.action) return;
    const mouse = I.mouse;
    if (mouse.pressed[0] && mouse.onCanvas) { W.act('use', true); return; }
    if (mouse.pressed[2] && mouse.onCanvas) { W.act('interact', true); return; }
    if (I.hit('use')) { W.act('use', false); return; }
    if (I.hit('interact')) { W.act('interact', false); return; }
    // holding the mouse to keep swinging/watering
    if (mouse.down[0] && mouse.onCanvas && W.holdUse > 0.25) W.act('use', true);
    W.holdUse = mouse.down[0] ? (W.holdUse || 0) + 1 / 60 : 0;
  }

  // compute the target tile for an action
  W.target = function (useMouse) {
    const p = W.player, I = G.Input;
    const [fx, fy] = p.feetTile;
    if (useMouse) {
      const [wx, wy] = G.R.screenToWorld(I.mouse.x, I.mouse.y);
      const mx = Math.floor(wx / 16), my = Math.floor(wy / 16);
      // face toward the mouse
      const dx = wx - p.x, dy = wy - (p.y - 8);
      p.dir = G.dirFromVec(dx, dy);
      if (Math.max(Math.abs(mx - fx), Math.abs(my - fy)) <= 1 && !(mx === fx && my === fy)) return [mx, my, wx, wy];
      if (mx === fx && my === fy) return [mx, my, wx, wy];
      return [...p.facingTile(), wx, wy];
    }
    return [...p.facingTile(), null, null];
  };

  W.act = function (kind, useMouse) {
    // riding: a dragon has to land first; hopping off a horse is automatic
    if (G.Menagerie && G.Menagerie.riding()) {
      if (G.Menagerie.flying()) { G.UI.toastOnce('landfirst', 'Land first (press R) to do that.', 2); return false; }
      if (kind === 'use') G.Menagerie.dismount(true);
    }
    const [tx, ty, wx, wy] = W.target(useMouse);
    if (kind === 'interact') return W.interact(tx, ty, wx, wy);
    return W.useItem(tx, ty, wx, wy);
  };

  // ---------------------------------------------------------------- interaction
  W.interact = function (tx, ty, wx, wy) {
    const map = W.map, p = W.player, S = G.S;
    // NPC first (near target or mouse)
    const npc = G.NPCs.at(map, tx, ty, wx, wy, p);
    if (npc) { G.NPCs.interact(npc); return true; }
    if (map.id === 'depths' && G.Dungeon.interact(map, tx, ty)) return true;
    // cat
    if (G.Cat && G.Cat.at(map, tx, ty, wx, wy)) { G.Cat.pet(); return true; }
    if (G.Menagerie && G.Menagerie.petAt(map, tx, ty, wx, wy)) { G.Menagerie.interact(map, tx, ty, wx, wy); return true; }
    if (G.Wilds && G.Wilds.interact(map, tx, ty, wx, wy)) return true;
    if (G.Familiars.at(wx, wy, tx, ty)) { G.Familiars.pet(); return true; }
    if (G.Decor.catAt(tx, ty)) { G.Cat.pet(); return true; }
    const o = map.obj(tx, ty);
    if (o) {
      if ((o.kind === 'encounter' || o.kind === 'encpart' || o.kind === 'digmark') && !o.hidden) { G.Encounters.interact(map, o); return true; }
      if (o.kind === 'treasure') { G.Festival.openTreasure(map, o); return true; }
      if (o.kind === 'forage') { pickForage(map, o); return true; }
      if (o.kind === 'cauldron') { G.Brew.interact(o); return true; }
      if (o.kind === 'chest') { o.open = true; G.sfx('chest_open'); G.UI.open('chest', { obj: o }).then(() => (o.open = false)); return true; }
      if (o.kind === 'offering') { G.sfx('chest_open'); G.UI.open('offering', { obj: o }); return true; }
    }
    const f = map.farm.get(map.idx(tx, ty));
    if (f && f.crop && F.ripe(f.crop)) { F.harvest(map, tx, ty); return true; }
    // building doors
    const dr = W.doorAt(map, tx, ty);
    if (dr) { W.enterDoor(dr); return true; }
    // props with interactions (also check the tile above for tall props like doors)
    const prop = map.propAt.get(map.idx(tx, ty));
    if (prop && prop.interact) { W.propInteract(prop, tx, ty); return true; }
    const key = map.examine.get(map.idx(tx, ty));
    if (key === 'fairy_ring') { W.fairyRing(); return true; }
    if (key) { G.UI.flavor(key); return true; }
    // eat / drink the held item with interact
    const it = Inv.selectedItem();
    if (it && (it.eat || it.use || it.scroll || it.wear || it.spellScroll || it.bp || it.pet || it.mount || it.gear)) { W.consumeSelected(); return true; }
    return false;
  };

  function pickForage(map, o) {
    if (!Inv.canAdd(o.id, 1)) { G.UI.toast('Your bag is full.'); G.sfx('error'); return; }
    map.setObj(o.tx, o.ty, null);
    const n = G.Stats.lucky(0.15) ? 2 : 1;
    Inv.add(o.id, n);
    G.UI.toastItem(o.id, n);
    G.sfx('pickup');
    W.player.holdItem = o.id; W.player.holdT = 0.8;
    G.R.burst(o.tx * 16 + 8, o.ty * 16 + 6, 6, { colors: ['#e4d2ff', '#b4ffd9'], speed: 25, life: 0.5, grav: -20 });
    G.emit('forage', o.id);
  }

  W.propInteract = async function (prop, tx, ty) {
    const it = prop.interact, S = G.S;
    if (it.kind === 'flavor' && it.key === 'moonwell' && G.Festival && await G.Festival.release()) return;
    if (it.kind === 'festival') { G.Festival.activity(it.what); return; }
    if (it.kind === 'flavor') { G.UI.flavor(it.key); return; }
    if (it.kind === 'home') { G.UI.flavor('sanctum_bed'); return; }
    if (it.kind === 'bed') {
      if (prop.doorTile && tx !== prop.doorTile.x && Math.abs(tx - prop.doorTile.x) > 1) { G.UI.flavor('sanctum_bed'); return; }
      const ok = await G.UI.confirm(S.mins < 1080 ? 'Go to bed early and end the day?' : 'Go to bed and end the day?', 'Sleep', 'Not yet');
      if (ok) W.sleep(false);
      return;
    }
    if (it.kind === 'pray') { W.pray(prop); return; }
    if (it.kind === 'wild') { G.Wilds.propInteract(it, prop); return; }
    if (it.kind === 'bonding') { if (G.Familiars) G.Familiars.bondingStone(prop); else G.UI.flavor('glade_sign'); return; }
    if (it.kind === 'mirror') { await G.UI.flavor('boutique_mirror'); G.UI.open('inventory', { tab: 'bag' }); return; }
    if (it.kind === 'talk') {
      const n = G.NPCs.get(it.npc);
      if (n && G.NPCs.present(it.npc, W.map.id)) { G.NPCs.interact(n); return; }
      G.UI.toastOnce('away:' + it.npc, `${G.UI.npcName(it.npc)} isn't here right now.`, 3); return;
    }
    if (it.kind === 'board' && it.board === 'guild') { G.Guild.openBoard(); return; }
    if (it.kind === 'cabinet') { if (G.Smithy) G.Smithy.cabinet(); return; }
    if (it.kind === 'rare') { if (G.Rare) G.Rare.interact(it, prop); return; }
    if (it.kind === 'shop' && it.needNpc && !G.NPCs.present(it.npc, W.map.id)) {
      G.UI.toastOnce('away:' + it.npc, `${G.UI.npcName(it.npc)} isn't at ${it.name || 'the counter'} right now.`, 3); return;
    }
    if (it.kind === 'shop') {
      const h = S.mins / 60;
      if (h < it.hours[0] || h >= it.hours[1]) { G.UI.toast(`${it.name} is closed. Open ${fmtHour(it.hours[0])}–${fmtHour(it.hours[1])}.`); G.sfx('error'); return; }
      G.sfx('door_open');
      G.Shop.open(it.npc);
      return;
    }
    if (it.kind === 'board') { G.UI.open('board'); return; }
    if (it.kind === 'altar') {
      if (!S.flags.altarSeen) { S.flags.altarSeen = true; const intro = window.GAMETEXT && GAMETEXT.altar && GAMETEXT.altar.intro; await G.UI.say(null, intro || ['A crescent of pale stone cradles a dark crystal. Five worn sockets ring its base, each carved with a sign: a seedling, a leaf, a pickaxe, a flask, a fish.']); }
      G.UI.open('altar'); return;
    }
    if (it.kind === 'depths') { G.Dungeon.chooseFloor(); return; }
  };
  function fmtHour(h) { return U.fmtTime((h % 24) * 60).replace(':00', ''); }

  // ---------------------------------------------------------------- using the held item
  W.useItem = function (tx, ty, wx, wy) {
    const S = G.S, p = W.player, map = W.map;
    const slot = Inv.selected();
    if (!slot) { return W.interact(tx, ty, wx, wy); }
    const it = G.item(slot.id);
    if (it.tool) return useTool(it, tx, ty, wx, wy);
    if (it.weapon) return attack(it, wx, wy);
    if (it.seed) {
      if (map.farm.has(map.idx(tx, ty)) && F.plant(map, tx, ty, slot.id)) {
        Inv.removeAt(S.sel, 1); G.sfx('plant_seed');
        G.R.burst(tx * 16 + 8, ty * 16 + 10, 5, { colors: ['#43324d', '#74b46e'], speed: 20, life: 0.4 });
        p.startAction('plant', { dur: 0.18, hitAt: 0.1 });
        G.emit('planted', it.seed);
        return true;
      }
      if (W.interact(tx, ty, wx, wy)) return true;
      const f = map.farm.get(map.idx(tx, ty));
      if (f && f.crop) G.UI.toastOnce('occupied', 'Something is already growing there.');
      else if (F.canTill(map, tx, ty) || (map.tillable && map.t(tx, ty) === M.EARTH)) G.UI.toastOnce('tillfirst', 'Till this soil with your Rune Hoe first, then plant.');
      else G.UI.toastOnce('seedwhere', 'Seeds only grow in tilled soil in your temple garden.');
      return false;
    }
    if (it.fert) {
      const f = map.farm.get(map.idx(tx, ty));
      if (f && !f.fert) { f.fert = true; Inv.removeAt(S.sel, 1); G.sfx('plant_seed'); return true; }
      return W.interact(tx, ty, wx, wy);
    }
    if (it.place) return placeItem(it, tx, ty);
    if (it.eat || it.use || it.scroll || it.wear || it.spellScroll) {
      // interact with the world first if there is something there
      if (W.interact(tx, ty, wx, wy) && !(it.eat || it.use || it.scroll)) return true;
      return true;
    }
    return W.interact(tx, ty, wx, wy);
  };

  W.consumeSelected = async function () {
    const S = G.S, slot = Inv.selected(); if (!slot) return;
    const it = G.item(slot.id);
    if (it.scroll) {
      if (S.known[it.scroll]) { G.UI.toast('You already know this recipe.'); return; }
      Inv.removeAt(S.sel, 1); S.known[it.scroll] = 1; G.jingle('discovery');
      G.UI.toast('Learned: ' + G.item(it.scroll).name); return;
    }
    if (it.wear) { G.Stats.wear(S.sel); return; }
    if (it.spellScroll) { if (G.Magic.learn(it.spellScroll)) Inv.removeAt(S.sel, 1); return; }
    if (await W.useSpecial(it)) return;
    const e = it.eat || it.use;
    if (!e) return;
    if (it.cat === 'potion' && e.maxhp) {
      const ok = await G.UI.confirm(`Drink the ${it.name}? It will permanently strengthen you.`, 'Drink', 'Keep it');
      if (!ok) return;
    }
    if (it.cat !== 'potion' && it.cat !== 'food') {
      const ok = await G.UI.confirm(`Eat a ${it.name}?`, 'Eat', 'Not now');
      if (!ok) return;
    }
    Inv.removeAt(S.sel, 1);
    applyEffect(e, it);
    G.sfx(it.cat === 'potion' ? 'drink_potion' : it.drink ? (it.id === 'drink_fizz' ? 'fizz_drink' : 'drink_potion') : 'eat');
    W.player.holdItem = it.id; W.player.holdT = 0.7;
    G.R.burst(W.player.x, W.player.y - 14, 10, { colors: it.cat === 'potion' ? ['#ff9ac8', '#e4d2ff', '#ffffff'] : ['#ffbc62', '#fff1c8'], speed: 30, life: 0.6, grav: -30 });
  };
  // things you "use" that aren't food: runes, charms, boxes, pets, mounts and gear
  W.useSpecial = async function (it) {
    const S = G.S, u = it.use || {};
    if (it.bp) { const ok = !S.known[it.bp]; if (ok) { Inv.removeAt(S.sel, 1); S.known[it.bp] = 1; G.jingle('discovery'); G.UI.toast(`Learned to craft: ${G.item(it.bp).name}. Find it in your satchel's Crafting tab.`, it.id); } else G.UI.toast('You already know this blueprint.'); return true; }
    if (u.warp) {
      if (W.map.id === 'depths' && W.map.entities.some((e) => e.mob && e.boss && !e.dead && e.aggro)) { G.UI.toast('The rune won\'t catch while something this big is watching you.'); return true; }
      if (!(await G.UI.confirm('Snap the Warp Rune and go home?', 'Go home', 'Not now'))) return true;
      Inv.removeAt(S.sel, 1); G.sfx('teleport'); G.R.doFlash('200,180,255', 0.5);
      W.changeMap(W.maps.cottage ? 'cottage' : 'sanctum', W.maps.cottage ? 'bed' : 'door');
      return true;
    }
    if (u.permLuck) {
      if (!(await G.UI.confirm(`Press your thumb to the ${it.name}? It sinks into you for good: +1 Luck forever.`, 'Absorb it', 'Keep it'))) return true;
      Inv.removeAt(S.sel, 1); S.permLuck = (S.permLuck || 0) + u.permLuck; G.jingle('level_up'); G.UI.toast('+1 Luck, permanently.', it.id); return true;
    }
    if (it.id === 'lucky_charm') { Inv.removeAt(S.sel, 1); G.Stats.apply('charm', it.id, { luck: 2 }, 0, 1560, it.name); G.sfx('mystery_chime'); G.UI.toast('+2 Luck for the rest of the day.', it.id); return true; }
    if (u.mystery) { Inv.removeAt(S.sel, 1); if (G.NightMarket) await G.NightMarket.openBox(); return true; }
    if ((it.cat === 'pet' || it.cat === 'mount' || it.cat === 'gear') && G.Menagerie) { await G.Menagerie.use(it); return true; }
    return false;
  };
  function applyEffect(e, it) {
    const S = G.S, p = W.player;
    if (G.Stats.fromEffect(e, it)) e = Object.assign({}, e, { buff: null });
    if (e.mana && G.Magic) G.Magic.addMana(e.mana);
    if (e.hp) { const before = S.hp; S.hp = U.clamp(S.hp + e.hp, 0, S.maxHp); if (S.hp > before) G.R.text(p.x, p.y - 30, '+' + Math.round(S.hp - before), '#7affb0'); if (e.hp < 0) G.R.text(p.x, p.y - 30, String(e.hp), '#ff7a7a'); }
    if (e.energy) { const before = S.energy; S.energy = U.clamp(S.energy + e.energy, 0, S.maxEnergy); if (S.energy > before) G.R.text(p.x, p.y - 22, '+' + Math.round(S.energy - before) + ' energy', '#ffd27a', { size: 6 }); }
    if (e.buff) { S.buffs[e.buff] = e.secs; G.UI.toast({ swift: 'You feel light on your feet.', ember: 'Your blood runs hot. Attacks are stronger.', ward: 'A frosty ward settles over you.', tide: 'The water feels friendly today.', veil: 'Shadows fold around you.', luck: 'Starlight clings to you. Fortune favours you today.' }[e.buff] || 'You feel different.'); }
    if (e.maxhp) { S.maxHp += e.maxhp; S.hp = S.maxHp; G.jingle('level_up'); G.UI.toast('Your maximum health rose by ' + e.maxhp + '.'); }
    if (S.hp <= 0) { S.hp = 1; }
  }
  W.applyEffect = applyEffect;

  function spend(cost) {
    const S = G.S;
    if (G.admin('energy')) { S.energy = S.maxEnergy; return true; }
    if (S.energy <= 0) { G.UI.toast("You're too exhausted. Eat something or rest."); G.sfx('error'); return false; }
    S.energy = Math.max(0, S.energy - cost);
    if (S.energy <= 0) G.UI.toast("You're exhausted...");
    return true;
  }

  function areaTiles(tx, ty, tier, dir) {
    const out = [[tx, ty]];
    const d = G.DIRS[dir];
    if (tier === 1) { out.push([tx + d[0], ty + d[1]], [tx + d[0] * 2, ty + d[1] * 2]); }
    if (tier === 2) for (let k = 1; k < 5; k++) out.push([tx + d[0] * k, ty + d[1] * k]);
    if (tier >= 3) { out.length = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) out.push([tx + d[0] + i, ty + d[1] + j]); }
    return out;
  }

  function useTool(it, tx, ty) {
    const S = G.S, p = W.player, map = W.map;
    const kind = it.tool;
    if (kind === 'geodehammer') { G.UI.open('geodes'); return true; }
    const dm = map.obj(tx, ty);
    if (kind === 'hoe' && dm && dm.kind === 'digmark') { p.startAction('tool', { item: it.id, dur: 0.38, hitAt: 0.2, onHit: () => G.Encounters.dig(map, dm) }); return true; }
    if (kind === 'rod') return G.Fishing.cast(tx, ty);
    const tier = S.toolTier[kind] || 0;
    const cost = kind === 'can' ? 1.5 : 2;
    // watering can refill (no energy)
    if (kind === 'can' && (map.isWater(tx, ty) || (map.propAt.get(map.idx(tx, ty)) || {}).type === 'well')) {
      p.startAction('tool', { item: it.id, dur: 0.4, hitAt: 0.2, onHit: () => { S.water = 40 + tier * 20; G.sfx('water_pour'); G.UI.toast('Dew Can refilled.'); G.R.burst(tx * 16 + 8, ty * 16 + 8, 10, { colors: ['#69a1db', '#c4e6ff'], speed: 40, life: 0.5 }); } });
      return true;
    }
    if (kind === 'can' && S.water <= 0) { G.UI.toast('Your Dew Can is empty. Refill it at water.'); G.sfx('error'); return false; }
    if (!spend(kind === 'can' ? 1 : cost)) return false;
    p.startAction(kind === 'can' ? 'pour' : 'tool', {
      item: it.id, dur: kind === 'can' ? 0.62 : 0.38, hitAt: kind === 'can' ? 0.36 : 0.2, tx, ty,
      onHit: () => {
        const tiles = kind === 'hoe' || kind === 'can' ? areaTiles(tx, ty, tier, p.dir) : [[tx, ty]];
        let any = false;
        for (const [x, y] of tiles) {
          const o = map.obj(x, y);
          if (kind === 'hoe') {
            if (o && o.kind === 'node' && F.NODES[o.type].tool === 'sword') { F.hitNode(map, o, 'hoe', 1); any = true; continue; }
            if (F.till(map, x, y)) { any = true; G.R.burst(x * 16 + 8, y * 16 + 10, 4, { colors: ['#3b2d48', '#5e4d6a'], speed: 25, life: 0.35 }); }
            else if (o && o.kind === 'forage') { pickForage(map, o); any = true; }
          } else if (kind === 'can') {
            if (S.water <= 0) break;
            if (F.water(map, x, y)) { any = true; S.water -= 1; G.R.burst(x * 16 + 8, y * 16 + 10, 6, { colors: ['#69a1db', '#c4e6ff', '#e8f6ff'], speed: 22, life: 0.35, grav: 120, up: 18 }); }
          } else if (kind === 'pickaxe' || kind === 'axe') {
            if (o && o.kind === 'node' && F.hitNode(map, o, kind, 1 + tier)) any = true;
            else if (o && (o.kind === 'cauldron' || o.kind === 'dewcrystal' || o.kind === 'sprinkler' || o.kind === 'scarecrow' || (o.kind === 'chest' && !o.home)) && kind === 'pickaxe') { any = pickUpPlaced(map, o); }
            else if (map.id === 'depths' && G.Dungeon.hitTile(map, x, y, kind)) any = true;
            else if (kind === 'pickaxe' && map.farm.has(map.idx(x, y)) && !map.farm.get(map.idx(x, y)).crop) { map.farm.delete(map.idx(x, y)); any = true; }
          }
        }
        if (kind === 'hoe') {
          G.sfx(any ? 'hoe' : 'pickaxe_hit', { volume: any ? 0.8 : 0.35 });
          if (!any) G.UI.toastOnce('notill', map.tillable ? 'Only the dark garden soil can be tilled (clear weeds and stones first).' : 'You can only till soil in your temple garden at the Sanctum.');
        }
        if (kind === 'can' && any) G.sfx('water_pour');
        if (!any && (kind === 'pickaxe' || kind === 'axe')) G.sfx(kind === 'axe' ? 'axe_chop' : 'pickaxe_hit', { volume: 0.4 });
      },
    });
    return true;
  }

  function pickUpPlaced(map, o) {
    if (o.kind === 'cauldron' && o.state && o.state !== 'idle') { G.UI.toast('Wait until the brew is finished.'); return true; }
    if (o.kind === 'chest' && o.items && o.items.some((s) => s)) { G.UI.toast('Empty the chest first.'); return true; }
    map.setObj(o.tx, o.ty, null);
    G.dropItem(map, o.item || o.kind, 1, o.tx * 16 + 8, o.ty * 16 + 10);
    G.sfx('rock_break');
    return true;
  }

  function placeItem(it, tx, ty) {
    const map = W.map, S = G.S;
    if (map.id !== 'sanctum') { G.UI.toast('You can only place that at the Sanctum.'); G.sfx('error'); return false; }
    if (map.blocked(tx, ty) || map.tobj.has(map.idx(tx, ty)) || map.farm.has(map.idx(tx, ty)) || map.isWater(tx, ty)) { G.sfx('error'); return false; }
    const [fx, fy] = W.player.feetTile; if (fx === tx && fy === ty) return false;
    const PLACE = { cauldron: () => ({ kind: 'cauldron', state: 'idle', solid: true }), dewcrystal: () => ({ kind: 'dewcrystal', solid: true }),
      sprinkler: () => ({ kind: 'sprinkler', solid: true, item: 'dew_sprinkler' }), scarecrow: () => ({ kind: 'scarecrow', solid: true, item: 'moon_scarecrow' }) };
    const o = (PLACE[it.place] || (() => ({ kind: 'chest', items: Inv.newArray(24), solid: true })))();
    map.setObj(tx, ty, o);
    Inv.removeAt(S.sel, 1);
    G.sfx('plant_seed');
    G.R.burst(tx * 16 + 8, ty * 16 + 10, 8, { colors: ['#e4d2ff', '#b99aee'], speed: 30, life: 0.4 });
    return true;
  }

  function attack(it, wx, wy) {
    const S = G.S, p = W.player, map = W.map, wpn = it.weapon;
    if (wpn.kind === 'sword') {
      G.sfx('sword_swing');
      p.startAction('swing', {
        item: it.id, dur: wpn.speed, hitAt: wpn.speed * 0.35,
        onHit: () => {
          const d = G.DIRS[p.dir];
          const cx = p.x + d[0] * 14, cy = p.y - 8 + d[1] * 13;
          const reach = wpn.reach;
          let hit = 0;
          for (const e of map.entities) {
            if (!e.mob || e.dead) continue;
            const dx = e.x - cx, dy = (e.y - e.h / 2) - cy;
            if (Math.abs(dx) < reach && Math.abs(dy) < reach) { G.Mobs.damage(e, rollDmg(wpn), p.x, p.y - 8); hit++; }
          }
          // cut weeds / grass in front
          const [tx, ty] = p.facingTile();
          const o = map.obj(tx, ty);
          if (o && o.kind === 'node' && F.NODES[o.type].tool === 'sword') F.hitNode(map, o, 'sword', 1);
          if (G.Dungeon && map.id === 'depths') G.Dungeon.slashTile(map, tx, ty);
          // slash arc effect
          G.Mobs && G.Mobs.slashFx(p.x + d[0] * 12, p.y - 9 + d[1] * 10, p.dir);
          if (hit) G.R.shake(1.2, 0.12);
        },
      });
      return true;
    }
    // wand
    if (!spend(wpn.cost)) return false;
    let dx, dy;
    if (wx != null) { dx = wx - p.x; dy = wy - (p.y - 10); } else { const d = G.DIRS[p.dir]; dx = d[0]; dy = d[1]; }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    p.dir = G.dirFromVec(dx, dy);
    G.sfx('wand_cast');
    p.startAction('cast', {
      item: it.id, dur: wpn.speed, hitAt: 0.1,
      onHit: () => {
        const color = wpn.bolt === 'bolt_fire' ? [255, 150, 70] : [93, 255, 176];
        map.entities.push(new G.Projectile({ x: p.x + dx * 10, y: p.y - 10 + dy * 8, vx: dx * wpn.bspeed, vy: dy * wpn.bspeed, dmg: rollDmg(wpn), from: 'player', fx: wpn.bolt, life: wpn.range / wpn.bspeed, pierce: !!wpn.pierce, burn: !!wpn.burn, color, light: true }));
      },
    });
    return true;
  }
  function rollDmg(w) {
    let d = U.randInt(w.min, w.max);
    if (G.S.buffs.ember > 0) d = Math.round(d * 1.3);
    d += 2 * G.Stats.get('attack');
    const crit = Math.random() < (w.crit || 0.05);
    return crit ? { amt: Math.round(d * 2), crit: true } : { amt: d, crit: false };
  }

  // ---------------------------------------------------------------- ambient life (fireflies, smoke, motes)
  const motes = [];
  function ambientLife(dt, map) {
    const R = G.R, S = G.S;
    // chimney smoke
    for (const pr of map.props) for (const s of pr.smoke || []) {
      if (Math.random() < dt * 2.2) R.emit({ x: s.x + (Math.random() - 0.5) * 2, y: s.y, vx: 3 + Math.random() * 3, vy: -9 - Math.random() * 5, life: 2.4, color: s.color ? `rgba(${s.color.join(',')},0.55)` : 'rgba(200,196,226,0.5)', size: 2, grav: 0, drag: 0.995 });
    }
    // fireflies / wisps at night outdoors, spores in the depths
    const night = S.mins >= 1140 || S.mins < 330;
    const want = map.id === 'depths' ? 18 : night && map.outdoor && W.weather !== 'rain' ? (map.zone === 'woods' ? 34 : 18) : map.zone === 'sanctum' ? 8 : 0;
    while (motes.length < want) motes.push({ x: R.cx + Math.random() * R.viewW, y: R.cy + Math.random() * R.viewH, ph: Math.random() * 6, sp: 0.5 + Math.random(), warm: Math.random() < 0.3 });
    if (motes.length > want) motes.length = want;
    for (const m of motes) {
      m.ph += dt * m.sp;
      m.x += Math.sin(m.ph * 0.7) * 6 * dt; m.y += Math.cos(m.ph * 0.5) * 4 * dt - (map.id === 'depths' ? 3 * dt : 0);
      if (m.x < R.cx - 20 || m.x > R.cx + R.viewW + 20 || m.y < R.cy - 20 || m.y > R.cy + R.viewH + 20) { m.x = R.cx + Math.random() * R.viewW; m.y = R.cy + Math.random() * R.viewH; }
    }
    W.motes = motes;
  }
  W.updateTitle = function (dt) { if (W.map) { ambientLife(dt, W.map); G.Cat.update(dt, W.map); } };

  // ---------------------------------------------------------------- drawables & lights for the renderer
  W.drawables = function (cx, cy, vw, vh) {
    const map = W.map, list = [];
    const inView = (x0, y0, x1, y1) => x1 >= cx - 8 && x0 <= cx + vw + 8 && y1 >= cy - 8 && y0 <= cy + vh + 8;
    const p = W.player;
    for (const pr of map.props) {
      const s = pr.spr;
      const x0 = pr.x - s.ax, y0 = pr.y - s.ay, w = (s.c || s.frames[0]).width, h = (s.c || s.frames[0]).height;
      if (!inView(x0, y0, x0 + w, y0 + h)) continue;
      list.push({
        sortY: pr.sortY, pr,
        draw(ctx, ox, oy) {
          let img = s.c;
          if (s.frames) img = s.frames[Math.floor(G.R.time * (s.fps || 4)) % s.frames.length];
          // after dark: the night canvas, or its own animation where the piece has one
          if (s.n && W.nightBlend > 0.5) img = s.nframes ? s.nframes[Math.floor(G.R.time * (s.fps || 4)) % s.nframes.length] : s.n;
          let a = 1;
          if (pr.fade && p.y < pr.y && p.y > y0 + 6 && p.x > x0 + 2 && p.x < x0 + w - 2) a = 0.5;
          pr.alpha = U.approach(pr.alpha, a, 0.08);
          if (pr.alpha < 1) ctx.globalAlpha = pr.alpha;
          ctx.drawImage(img, Math.round(x0 + ox), Math.round(y0 + oy));
          ctx.globalAlpha = 1;
        },
      });
    }
    // tile objects & crops
    const x0 = Math.floor(cx / 16) - 2, y0 = Math.floor(cy / 16) - 1, x1 = x0 + Math.ceil(vw / 16) + 4, y1 = y0 + Math.ceil(vh / 16) + 4;
    for (const o of map.tobj.values()) if (o.tx >= x0 && o.tx <= x1 && o.ty >= y0 && o.ty <= y1 && !o.hidden) list.push(o.drawable ? o.drawable : F.objDrawable(map, o));
    for (const [idx, f] of map.farm) if (f.crop) { const tx = idx % map.w, ty = (idx / map.w) | 0; if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1 + 1) list.push(F.cropDrawable(map, idx, f)); }
    for (const it of map.items) list.push({ sortY: it.sortY, draw: (c, ox, oy) => it.draw(c, ox, oy) });
    for (const e of map.entities) if (!e.dead && e.x > cx - 60 && e.x < cx + vw + 60 && e.y > cy - 60 && e.y < cy + vh + 80) list.push({ sortY: e.sortY != null ? e.sortY : e.y, draw: (c, ox, oy) => e.draw(c, ox, oy) });
    G.NPCs.drawables(map, list);
    if (G.Cat) G.Cat.drawables(map, list);
    if (G.Menagerie) G.Menagerie.drawables(map, list);
    if (!W.hidePlayer) list.push({ sortY: p.y + (G.Menagerie && G.Menagerie.alt > 6 ? 1e5 : 0), draw: (c, ox, oy) => p.draw(c, ox, oy) });
    if (!W.hidePlayer) { G.Familiars.drawables(list); G.Magic.drawables(list); }
    G.Decor.drawables(list);
    if (G.Fishing) G.Fishing.drawables(list);
    return list;
  };

  W.drawGround = function (ctx, ox, oy) {
    const map = W.map;
    F.drawSoil(ctx, map, ox, oy, G.R.cx, G.R.cy, G.R.viewW, G.R.viewH);
    G.Decor.drawGround(ctx, ox, oy);
    if (map.id === 'depths') G.Dungeon.drawGround(ctx, map, ox, oy);
    // target cursor
    const p = W.player, it = Inv.selectedItem();
    if (!W.inputLocked() && it && (it.tool || it.seed || it.place || it.fert)) {
      const useMouse = G.Input.lastDevice === 'mouse' && G.Input.mouse.onCanvas;
      let tx, ty;
      if (useMouse) {
        const [wx, wy] = G.R.screenToWorld(G.Input.mouse.x, G.Input.mouse.y);
        const [fx, fy] = p.feetTile; const mx = Math.floor(wx / 16), my = Math.floor(wy / 16);
        if (Math.max(Math.abs(mx - fx), Math.abs(my - fy)) <= 1) { tx = mx; ty = my; } else [tx, ty] = p.facingTile();
      } else [tx, ty] = p.facingTile();
      const x = tx * 16 + ox, y = ty * 16 + oy;
      const a = 0.35 + 0.15 * Math.sin(G.R.time * 5);
      const ok = W.canUseAt(it, tx, ty);
      ctx.fillStyle = ok === false ? `rgba(255,120,140,${a * 0.8})` : ok === true ? `rgba(160,255,200,${a + 0.1})` : `rgba(228,210,255,${a})`;
      ctx.fillRect(x, y, 4, 1); ctx.fillRect(x, y, 1, 4); ctx.fillRect(x + 12, y, 4, 1); ctx.fillRect(x + 15, y, 1, 4);
      ctx.fillRect(x, y + 15, 4, 1); ctx.fillRect(x, y + 12, 1, 4); ctx.fillRect(x + 12, y + 15, 4, 1); ctx.fillRect(x + 15, y + 12, 1, 4);
    }
  };
  // is the held item usable on this tile? true / false / null (no opinion)
  W.canUseAt = function (it, tx, ty) {
    const map = W.map;
    if (it.tool === 'hoe') { const o = map.obj(tx, ty); return F.canTill(map, tx, ty) || !!(o && o.kind === 'node' && F.NODES[o.type] && F.NODES[o.type].tool === 'sword'); }
    if (it.seed) { const f = map.farm.get(map.idx(tx, ty)); return !!(f && !f.crop); }
    if (it.tool === 'can') { const f = map.farm.get(map.idx(tx, ty)); return !!f || map.isWater(tx, ty) || (map.propAt.get(map.idx(tx, ty)) || {}).type === 'well' ? true : null; }
    if (it.fert) { const f = map.farm.get(map.idx(tx, ty)); return !!(f && !f.fert); }
    if (it.place) return map.id === 'sanctum' && !map.blocked(tx, ty) && !map.tobj.has(map.idx(tx, ty)) && !map.farm.has(map.idx(tx, ty)) && !map.isWater(tx, ty);
    return null;
  };

  W.drawOverlay = function (ctx, ox, oy, dt) {
    if (W.motes) {
      const depths = W.map.id === 'depths';
      for (const m of W.motes) {
        const a = 0.45 + 0.55 * Math.sin(m.ph * 3);
        if (a < 0.1) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = depths ? (m.warm ? '#b99aee' : '#5dffb0') : m.warm ? '#ffd27a' : '#b4ffd9';
        ctx.fillRect(Math.round(m.x + ox), Math.round(m.y + oy), 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (G.Dungeon && W.map.id === 'depths') G.Dungeon.drawOverlay(ctx, W.map, ox, oy);
    if (G.Tutorial) G.Tutorial.drawArrow(ctx, ox, oy);
    G.Festival.drawOverlay(ctx, ox, oy);
    if (W.map.shafts && W.map.shafts.length) {
      const t = G.R.time;
      ctx.globalCompositeOperation = 'lighter';
      for (const L of W.map.shafts) {
        G.R.drawShaft(ctx, L, -ox, -oy, L.i * 0.34 * (0.8 + 0.2 * Math.sin(t * 0.6 + L.x0)));
        // dust drifting in the beam
        for (let k = 0; k < 14; k++) {
          const u = (t * 0.025 + k * 0.137 + L.x0 * 0.001) % 1, v = ((k * 0.618) % 1) - 0.5;
          const x = L.x0 + (L.x1 - L.x0) * u + v * (L.w0 + (L.w1 - L.w0) * u), y = L.y0 + (L.y1 - L.y0) * u + Math.sin(t + k) * 2;
          ctx.globalAlpha = 0.55 * Math.sin(u * Math.PI); ctx.fillStyle = `rgb(${L.color.join(',')})`;
          ctx.fillRect(Math.round(x + ox), Math.round(y + oy), 1, 1);
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  W.lights = function () {
    const map = W.map, out = map.allLights();
    F.cropLights(map, out);
    const p = W.player;
    if (map.id === 'depths') out.push({ x: p.x, y: p.y - 10, r: 128, color: [255, 214, 170], i: 1 }, { x: p.x, y: p.y - 10, r: 44, color: [255, 236, 210], i: 0.55, noBloom: true });
    else out.push({ x: p.x, y: p.y - 10, r: 46, color: [200, 190, 255], i: 0.35, night: true, noBloom: true });
    for (const e of map.entities) if (!e.dead && e.lights) e.lights(out);
    for (const it of map.items) if (G.item(it.id).cat === 'gem' || it.id === 'starshard') out.push({ x: it.x, y: it.y - 8, r: 12, color: [190, 160, 255], i: 0.5 });
    if (W.motes) for (const m of W.motes) out.push({ x: m.x, y: m.y, r: 7, color: map.id === 'depths' ? (m.warm ? [185, 154, 238] : [93, 255, 176]) : m.warm ? [255, 210, 122] : [150, 255, 200], i: 0.6 * (0.5 + 0.5 * Math.sin(m.ph * 3)), noBloom: false });
    G.NPCs.lights(map, out);
    if (G.Tutorial) G.Tutorial.lights(out);
    G.Familiars.lights(out); G.Magic.lights(out); G.Festival.lights(out);
    for (const pr of map.props) if (pr.o && pr.o.light) out.push(pr.o.light);
    return out;
  };

  W.frameInfo = function () {
    const S = G.S, map = W.map;
    let amb, dark = false, vignette = 0;
    if (map.id === 'depths') { amb = map.ambient || [90, 84, 124]; dark = true; vignette = 0.32; }
    else if (map.interior) {
      const out = G.R.ambient(S.mins, W.weather), day = U.clamp((out[0] * 0.3 + out[1] * 0.55 + out[2] * 0.15 - 90) / 150, 0, 1);
      amb = [0, 1, 2].map((k) => map.ambNight[k] + (map.ambDay[k] - map.ambNight[k]) * day);
      dark = true; vignette = 0.2;
    } else amb = G.R.ambient(S.mins, W.weather);
    let deep = 0;
    if (map.id === 'deepwood') { deep = G.Wilds.depth(); const k = 1 - 0.5 * deep; amb = [amb[0] * k * 0.92, amb[1] * k, amb[2] * (k * 0.95 + 0.05)]; if (deep > 0.45) dark = true; }
    const lum = amb[0] * 0.3 + amb[1] * 0.55 + amb[2] * 0.15;
    const nightFactor = U.clamp((236 - lum) / 150, 0, 1);
    W.nightBlend = map.id === 'depths' ? 1 : U.clamp((S.mins - 1110) / 60, 0, 1) + (S.mins < 380 ? 1 : 0);
    const nfOut = map.interior ? U.clamp((236 - (G.R.ambient(S.mins, W.weather).reduce((a, v, k) => a + v * [0.3, 0.55, 0.15][k], 0))) / 150, 0, 1) : nightFactor;
    if (map.outdoor && nightFactor > 0.5) vignette = (nightFactor - 0.5) * 0.6;
    if (deep) vignette = Math.max(vignette, 0.12 + deep * 0.3);
    return { map, focus: W.focusOverride || W.player, drawables: W.drawables, drawGround: W.drawGround, drawOverlay: W.drawOverlay, lights: W.lights(), ambient: amb, weather: map.outdoor ? W.weather : 'clear', nightFactor: map.interior ? Math.max(0.55, nfOut) : nightFactor, dark, vignette, mist: (map.zone === 'woods' && map.outdoor && (S.mins > 1200 || S.mins < 420)) || (map.id === 'deepwood' && (deep > 0.35 || S.mins > 1140 || S.mins < 420)) };
  };

  // ---------------------------------------------------------------- sleeping & new day
  // the overnight work: shipping, crop growth, the new day's weather, spawns and recovery
  W.overnight = function (passedOut, keepMap) {
    const S = G.S;
    const earned = shipItems();
    const lateness = S.mins;
    // planted crops nobody watered don't grow tonight; tell the player in the morning
    let thirsty = 0;
    for (const id in W.maps) for (const f of W.maps[id].farm.values()) if (f.crop && !f.watered && !F.ripe(f.crop)) thirsty++;
    W.thirsty = thirsty;
    // overnight
    const rainTomorrow = S.tomorrow === 'rain';
    for (const id in W.maps) if (W.maps[id].farm && W.maps[id].farm.size) F.grow(W.maps[id], false, G.isFullMoon());
    S.day += 1; S.mins = 360;
    W.rollWeather();
    for (const id in W.maps) { const m = W.maps[id]; if (m.farm.size && S.weather === 'rain') for (const f of m.farm.values()) f.watered = true; }
    F.dewMorning(W.maps.sanctum);
    for (const id of ['woods', 'lake', 'ridge', 'village', 'sanctum', 'deepwood', 'glade']) if (W.maps[id]) W.dailySpawns(W.maps[id]);
    G.NPCs.newDay();
    // recovery
    if (passedOut) { S.energy = Math.round(S.maxEnergy * 0.5); const lost = Math.min(1000, Math.floor(S.gold * 0.1)); S.gold -= lost; W.lostGold = lost; }
    else { S.energy = lateness > 1440 ? Math.round(S.maxEnergy * (1 - (lateness - 1440) / 240)) : S.maxEnergy; W.lostGold = 0; }
    S.hp = S.maxHp; S.water = 40 + (S.toolTier.can || 0) * 20;
    for (const k of ['luck', 'tide']) delete S.buffs[k];
    G.Stats.clearOvernight();
    W.warnedLate = false;
    W.weather = S.weather;
    if (W.maps.depths && !keepMap) delete W.maps.depths;
    return earned;
  };
  W.sleep = async function (passedOut) {
    if (W.sleeping) return;
    W.sleeping = true;
    G.sfx('sleep');
    await G.UI.fadeTo(1, 0.8);
    const earned = W.overnight(passedOut);
    // place the player at home
    const home = W.maps.cottage ? 'cottage' : 'sanctum';
    if (W.map.id !== home) { W.changeMap(home, 'bed', { instant: true, silent: true }); }
    else { const sp = W.maps[home].spawns.bed; W.player.x = sp[0] * 16; W.player.y = sp[1] * 16; W.player.dir = 'down'; }
    G.Save.save();
    W.sleeping = false;
    await G.UI.open('summary', { earned, passedOut, lost: W.lostGold });
    W.updateAudio(true);
    G.jingle('new_day');
    await G.UI.fadeTo(0, 0.8);
    G.UI.newDayToast();
    W.thirstyNote();
    const misc = window.GAMETEXT && GAMETEXT.misc;
    if (misc && passedOut && misc.passout) await G.UI.say(null, [U.pick(misc.passout)]);
    else if (misc && misc.sleep && Math.random() < 0.5) setTimeout(() => G.UI.toast(G.UI.fill(U.pick(misc.sleep))), 2400);
    G.emit('newDay');
  };
  W.pray = async function (prop) {
    const S = G.S, p = W.player;
    if (S.flags.prayDay === S.day) { G.UI.flavor('veil_prayer_done'); return; }
    if (!S.flags.prayedOnce) { S.flags.prayedOnce = true; await G.UI.flavor('veil_altar'); }
    const ok = await G.UI.confirm('Kneel at the Veil Altar and pray?', 'Pray', 'Not now');
    if (!ok) return;
    S.flags.prayDay = S.day;
    G.sfx('pray'); G.jingle('discovery');
    G.R.doFlash('235,225,255', 0.35);
    G.R.burst(p.x, p.y - 20, 30, { colors: ['#ffffff', '#e4d2ff', '#ff9ac8', '#8fd0ff', '#ffd24f'], speed: 45, life: 1.6, grav: -25, up: 20 });
    const until = Math.min(1560, Math.round(S.mins + 240));
    G.Stats.apply('blessing', 'relic_star', { luck: 2 }, 0, until, 'Veil Blessing');
    const T = window.GAMETEXT && GAMETEXT.prayers;
    await G.UI.say(null, [T ? G.UI.fill(U.pick(T)) : 'Coloured light falls across your hands. You feel lucky.']);
    G.UI.toast(`Veil Blessing: +2 Luck until ${U.fmtTime(until)}.`, 'relic_star');
  };
  W.thirstyNote = function () {
    const n = W.thirsty; W.thirsty = 0;
    if (!n) return;
    setTimeout(() => G.UI.toast(`${n} crop${n === 1 ? ' was' : 's were'} thirsty last night and didn't grow. Water them every day with your Dew Can.`, 'can'), 3200);
  };
  // tester mode: two in the morning rolls straight into the next day, wherever you are
  W.rollDay = function () {
    const earned = W.overnight(false, true);
    G.Save.save();
    W.updateAudio(true);
    G.UI.newDayToast();
    W.thirstyNote();
    if (earned) setTimeout(() => G.UI.toast(`The shipping crate paid ${U.fmtNum(earned)} ✦.`), 1800);
    G.emit('newDay');
  };
  W.passOut = function () {
    if (W.sleeping) return;
    G.UI.closeAll();
    G.UI.toast('You collapse from exhaustion...');
    W.sleep(true);
  };
  W.playerDied = async function () {
    if (W.dying) return;
    W.dying = true;
    W.cutscene = true;
    G.sfx('player_die'); G.jingle('death');
    await G.UI.fadeTo(1, 1.2);
    const S = G.S;
    // lose some glimmer and a few random items
    const lostGold = Math.min(2000, Math.floor(S.gold * 0.1)); S.gold -= lostGold;
    const lost = [];
    for (let i = 12; i < S.inv.length; i++) { const s = S.inv[i]; if (s && Math.random() < 0.18 && G.item(s.id).cat !== 'tool' && G.item(s.id).cat !== 'weapon') { lost.push(s); S.inv[i] = null; } }
    S.hp = Math.round(S.maxHp * 0.6); S.energy = Math.max(S.energy, Math.round(S.maxEnergy * 0.4));
    S.mins = Math.min(1500, S.mins + 120);
    if (W.maps.depths) delete W.maps.depths;
    if (['woods', 'deepwood', 'glade'].includes(W.map.id)) W.changeMap('woods', 'grove', { instant: true, silent: true });
    else W.changeMap('ridge', [20.5, 17.6, 'down'], { instant: true, silent: true });
    W.cutscene = false; W.dying = false;
    await G.UI.fadeTo(0, 0.8);
    const lines = (window.GAMETEXT && GAMETEXT.misc && GAMETEXT.misc.death) || ["Corvin found you at the bottom of the stairs and dragged you out. 'You're welcome,' he says, not unkindly."];
    await G.UI.say('corvin', [U.pick(lines)]);
    G.UI.toast(`You lost ${U.fmtNum(lostGold)} ✦` + (lost.length ? ` and ${lost.length} item${lost.length > 1 ? 's' : ''}.` : '.'));
  };

  W.rollWeather = function () {
    const S = G.S;
    S.weather = S.tomorrow || 'clear';
    const r = U.rng(S.seed + S.day * 977);
    const x = r();
    // mostly fair: sunny about two days in five, rain about one in eight (and rarely twice in a row)
    const rainP = S.weather === 'rain' ? 0.06 : 0.13;
    S.tomorrow = x < rainP ? 'rain' : x < rainP + 0.06 ? 'mist' : x < rainP + 0.1 ? 'starfall' : x < rainP + 0.52 ? 'sunny' : 'clear';
    if (G.isNewMoon(S.day + 1) && x < 0.25) S.tomorrow = 'mist';
  };

  function shipItems() {
    const S = G.S;
    let total = 0;
    const lines = [];
    for (const s of S.ship) {
      const it = G.item(s.id);
      const v = it.sell * s.n;
      total += v;
      lines.push([s.id, s.n, v]);
      S.stats.shipped += s.n;
    }
    S.ship = [];
    S.gold += total; S.stats.earned += total;
    W.shippedLines = lines;
    return total;
  }
})();
