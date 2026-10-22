// Nightvale — villagers: schedules, pathfinding, map-to-map travel, talking, gifts, hearts. Also Inkwell the cat.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const N = (G.NPCs = { list: [] });
  const IDS = ['mirabel', 'pip', 'sable', 'brann', 'orvyn', 'elowen', 'grizelda', 'corvin', 'lune', 'elvis', 'isolde', 'seraphine', 'fennick',
    'laura', 'jasmine', 'amara', 'ronan', 'caspian', 'gideon', 'nightmerchant'];
  // who can be courted (hearts cap at 8 until the bouquet)
  N.ROMANCE = ['laura', 'jasmine', 'amara', 'ronan', 'caspian'];
  N.IDS = IDS;

  const VOICES = { mirabel: { pitch: 0.9, timbre: 'soft' }, pip: { pitch: 1.6, timbre: 'squeaky' }, sable: { pitch: 1.0, timbre: 'bright' }, brann: { pitch: 0.6, timbre: 'deep' }, orvyn: { pitch: 0.75, timbre: 'airy' }, elowen: { pitch: 1.25, timbre: 'airy' }, grizelda: { pitch: 0.85, timbre: 'raspy' }, corvin: { pitch: 0.8, timbre: 'deep' }, lune: { pitch: 0.95, timbre: 'bright' },
    elvis: { pitch: 0.8, timbre: 'soft' }, isolde: { pitch: 1.05, timbre: 'bright' }, seraphine: { pitch: 1.15, timbre: 'airy' }, fennick: { pitch: 1.1, timbre: 'bright' },
    laura: { pitch: 1.1, timbre: 'raspy' }, jasmine: { pitch: 1.35, timbre: 'soft' }, amara: { pitch: 1.25, timbre: 'bright' }, ronan: { pitch: 0.62, timbre: 'deep' }, caspian: { pitch: 0.92, timbre: 'bright' }, gideon: { pitch: 0.58, timbre: 'raspy' }, nightmerchant: { pitch: 0.74, timbre: 'airy' } };
  N.voice = (id) => VOICES[id] || { pitch: 1, timbre: 'soft' };

  const TASTES = {
    mirabel: { love: ['moonpetal', 'starbloom', 'pot_healing', 'food_pie'], like: ['frostmint', 'wolfsbane', 'moonlily', 'food_tea', 'honey'], dislike: ['slime_gel', 'bone_dust', 'bat_wing'], hate: ['sludge', 'void_essence'] },
    pip: { love: ['sludge', 'glowcap', 'spider_silk', 'golem_core', 'pot_ember'], like: ['slime_gel', 'amethyst', 'bat_wing', 'food_pie', 'fish_glimmerfin'], dislike: ['frostmint', 'moonlily', 'food_tea'], hate: ['wolfsbane', 'bone_dust'] },
    sable: { love: ['emberroot', 'pot_starlight', 'pearl', 'food_mead'], like: ['duskberry', 'emerald', 'moonstone', 'fish_mooncarp', 'honey'], dislike: ['glowcap', 'spore_sac'], hate: ['sludge', 'ectoplasm'] },
    brann: { love: ['ore_starsilver', 'emberroot', 'food_stew', 'golem_core'], like: ['ore_shadow', 'ore_glimmer', 'wood', 'amethyst', 'food_mead'], dislike: ['moonpetal', 'moonlily', 'starbloom'], hate: ['sludge', 'spider_silk'] },
    orvyn: { love: ['starbloom', 'starshard', 'moonstone', 'pot_moon'], like: ['moonpetal', 'quartz', 'arcane_dust', 'pot_starlight', 'food_tea'], dislike: ['mandrake', 'slime_gel'], hate: ['sludge', 'bone_dust'] },
    elowen: { love: ['fairycap', 'moonlily', 'frostmint', 'feather'], like: ['wolfsbane', 'moonpetal', 'duskberry', 'wispbloom', 'honey'], dislike: ['ore_glimmer', 'ore_shadow', 'stone'], hate: ['bone_dust', 'void_essence'] },
    grizelda: { love: ['sludge', 'mandrake', 'spider_silk', 'ectoplasm', 'bog_amber'], like: ['bat_wing', 'duskberry', 'spore_sac', 'fish_ghosteel'], dislike: ['moonpetal', 'pot_healing', 'food_tea'], hate: ['starbloom', 'honey'] },
    corvin: { love: ['duskberry', 'ectoplasm', 'food_coffee', 'bat_wing'], like: ['bone_dust', 'moonstone', 'pot_shadow', 'fish_ghosteel'], dislike: ['emberroot', 'honey', 'food_pie'], hate: ['starbloom', 'sludge'] },
    lune: { love: ['fish_lanternpike', 'fish_ghosteel', 'pot_starlight', 'food_mead'], like: ['fish_mooncarp', 'pearl', 'driftwood', 'shell', 'emberroot'], dislike: ['moonpetal', 'spore_sac'], hate: ['sludge', 'frostmint'] },
    elvis: { love: ['drink_fizz', 'pot_starlight', 'emberroot', 'relic_star'], like: ['honey', 'duskberry', 'frostmint', 'food_mead', 'pearl'], dislike: ['glowcap', 'stone'], hate: ['sludge', 'bone_dust'] },
    isolde: { love: ['relic_locket', 'moonstone', 'spider_silk', 'cl_hat_tophat'], like: ['feather', 'amethyst', 'relic_coin', 'food_tea', 'wolfsbane'], dislike: ['slime_gel', 'fish_glimmerfin'], hate: ['sludge', 'spore_sac'] },
    seraphine: { love: ['quartz', 'amethyst', 'relic_star', 'moonlily'], like: ['moonpetal', 'starshard', 'emerald', 'pearl', 'food_tea'], dislike: ['bat_wing', 'sludge'], hate: ['void_essence', 'bone_dust'] },
    fennick: { love: ['relic_coin', 'relic_idol', 'golden_acorn', 'bog_amber'], like: ['pearl', 'honey', 'driftwood', 'food_mead', 'ore_starsilver'], dislike: ['fiber', 'stone'], hate: ['sludge', 'ectoplasm'] },
    laura: { love: ['bat_wing', 'void_essence', 'wolf_fang', 'drink_dragon', 'cl_cloak_raven'], like: ['spider_silk', 'emberroot', 'duskberry', 'relic_coin', 'food_chili', 'ectoplasm'], dislike: ['moonlily', 'food_honeycake', 'snack_sweets', 'cl_hat_crown'], hate: ['food_tea', 'sludge'] },
    jasmine: { love: ['honey', 'food_honeycake', 'moonlily', 'snack_sweets', 'starbloom'], like: ['moonpetal', 'feather', 'food_pie', 'food_tea', 'fairycap', 'cl_hat_crown'], dislike: ['bat_wing', 'slime_gel', 'bone_dust'], hate: ['spider_silk', 'void_essence'] },
    amara: { love: ['starshard', 'relic_star', 'quartz', 'pot_starlight', 'min_comet_glass'], like: ['moonstone', 'arcane_dust', 'food_tea', 'food_coffee', 'feather', 'amethyst'], dislike: ['slime_gel', 'stone', 'fiber'], hate: ['sludge', 'spore_sac'] },
    ronan: { love: ['ore_starsilver', 'voidcrystal', 'golem_core', 'food_stew', 'min_meteorite'], like: ['ore_shadow', 'emerald', 'amethyst', 'food_coffee', 'drink_hollow'], dislike: ['moonlily', 'honey', 'cl_hat_crown'], hate: ['sludge', 'snack_jellies'] },
    caspian: { love: ['relic_feather', 'wisp_essence', 'golden_acorn', 'drink_fizz'], like: ['pet_treat', 'honey', 'food_chili', 'feather', 'pearl'], dislike: ['bone_dust', 'stone'], hate: ['sludge', 'spider_silk'] },
    gideon: { love: ['food_stew', 'drink_hollow', 'wolf_fang', 'antler_shard'], like: ['food_mead', 'ore_shadow', 'bone_dust', 'golem_core'], dislike: ['moonlily', 'snack_sweets'], hate: ['sludge', 'fairycap'] },
    nightmerchant: { love: ['relic_star', 'starshard', 'min_wishing_stone', 'pot_moon'], like: ['pearl', 'moonstone', 'relic_locket', 'relic_bell', 'min_aurora'], dislike: ['wood', 'stone'], hate: ['sludge', 'fiber'] },
  };
  N.TASTES = TASTES;
  N.taste = function (id, item) {
    const t = TASTES[id]; if (!t) return 'neutral';
    for (const k of ['love', 'like', 'dislike', 'hate']) if (t[k].includes(item)) return k;
    const it = G.item(item);
    if (it.cat === 'resource' || it.cat === 'tool' || it.cat === 'weapon') return 'dislike';
    return 'neutral';
  };

  // ---------------------------------------------------------------- schedules
  // entries: [startMinute, map, x, y, dir, opts]; map null => at home (hidden)
  function sched(id, S) {
    const day = G.weekday(), rain = G.World.weather === 'rain', full = G.isFullMoon();
    const h = (hh, mm) => hh * 60 + (mm || 0);
    switch (id) {
      case 'mirabel': return [[h(6), null], [h(8), 'village', 17, 12, 'down'], [h(9), 'village', 23, 16.6, 'down'], [h(17), 'village', 16, 13, 'left'], [h(19), 'village', 41.5, 34.4, 'down'], [h(21), 'village', 23, 16.6, 'up', { hide: true }]];
      case 'pip': return rain
        ? [[h(6), null], [h(9), 'tavern', 13, 8.7, 'left'], [h(13), 'village', 29, 26, 'down'], [h(18), 'village', 23, 16.8, 'up', { hide: true }]]
        : [[h(6), null], [h(8), 'village', 28.5, 26.5, 'right'], [h(11), 'village', 30, 41, 'down'], [h(13), (day === 'Thornsday' || day === 'Starday') ? 'sanctum' : 'lake', ...((day === 'Thornsday' || day === 'Starday') ? [40, 27.6, 'left'] : [22, 24.6, 'right'])], [h(16), 'village', 47.5, 27, 'up'], [h(18, 30), 'village', 23, 16.8, 'up', { hide: true }]];
      case 'sable': return [[h(6), null], ...((day === 'Moonday' || day === 'Starday') && !rain ? [[h(8, 30), 'lake', 24, 24.6, 'right']] : []), [h(10, 30), 'tavern', 12.5, 3.7, 'down'], [h(19), 'tavern', 17.5, 9.7, 'down'], [h(23), 'tavern', 12.5, 3.7, 'down'], [h(25, 30), 'tavern', 12.5, 3.7, 'up', { hide: true }]];
      case 'brann': return [[h(6), null], [h(7, 30), 'ridge', 10, 22.6, 'left'], [h(18), 'tavern', 11, 8.7, 'right'], [h(22, 30), 'ridge', 5.5, 22.6, 'up', { hide: true }]];
      case 'orvyn': return day === 'Emberday' && !rain
        ? [[h(6), null], [h(9), 'ridge', 37, 7.6, 'up'], [h(13), 'sanctum', 24, 10.6, 'up'], [h(17), 'ridge', 37, 7.6, 'up'], [h(20), 'ridge', 36.5, 7.4, 'up'], [h(25), 'ridge', 41.5, 6.6, 'up', { hide: true }]]
        : [[h(6), null], [h(9), 'ridge', 39, 8.6, 'left'], [h(14), 'ridge', 41.5, 6.6, 'up', { hide: true }], [h(17), 'ridge', 39, 8.6, 'down'], [h(20), 'ridge', 36.5, 7.4, 'up'], [h(25), 'ridge', 41.5, 6.6, 'up', { hide: true }]];
      case 'elowen': return rain
        ? [[h(6), null], [h(8), 'woods', 44, 18.6, 'down'], [h(13), 'cathedral', 20.5, 14.7, 'up'], [h(17), 'woods', 44, 18.6, 'down'], [h(22), 'woods', 44, 15.6, 'up', { hide: true }]]
        : [[h(6), null], [h(7), 'woods', 44, 18.6, 'down'], [h(12), 'woods', 34, 31.6, 'up'], [h(15), 'woods', 13, 25.6, 'left'], [h(18), 'woods', 44, 18.6, 'down'], [h(22), 'woods', 44, 15.6, 'up', { hide: true }]];
      case 'grizelda': return full
        ? [[h(6), null], [h(8), 'woods', 33, 44.6, 'left'], [h(21), 'woods', 10.5, 27.4, 'up'], [h(25, 30), 'woods', 30, 43.6, 'up', { hide: true }]]
        : [[h(6), null], [h(8), 'woods', 33, 44.6, 'left'], [h(23), 'woods', 30, 43.6, 'up', { hide: true }]];
      case 'corvin': return rain
        ? [[h(6), null], [h(10), 'ridge', 20.5, 17.6, 'down'], [h(18), 'tavern', 13, 11.7, 'left'], [h(23), 'ridge', 20.5, 17.4, 'up', { hide: true }]]
        : [[h(6), null], [h(9), 'ridge', 45, 21, 'up'], [h(10), 'ridge', 20.5, 17.6, 'down'], [h(18, 30), 'ridge', 44, 18, 'up'], [h(21), 'ridge', 20.5, 17.4, 'up', { hide: true }]];
      case 'lune': return [[h(6), null], [h(6, 30), 'lake', 29.5, 24.6, 'right'], [h(16), 'lake', 13.5, 18.8, 'down'], [h(20), 'tavern', 7, 7.7, 'up'], [h(23, 30), 'lake', 13.5, 18.4, 'up', { hide: true }]];
      case 'elvis': return day === 'Sunday'
        ? [[h(6), null], [h(10), 'village', 47.5, 20.6, 'right'], [h(12), 'cathedral', 5.5, 14.7, 'up'], [h(15), 'village', 66, 21.7, 'down'], [h(18), 'tavern', 5, 5.7, 'down'], [h(25, 30), 'tavern', 5, 5.7, 'up', { hide: true }]]
        : [[h(6), null], [h(9, 20), 'village', 47.5, 20.6, 'right'], [h(10), 'tavern', 5, 5.7, 'down'], [h(25, 30), 'tavern', 5, 5.7, 'up', { hide: true }]];
      case 'isolde': return [[h(6), null], [h(8, 30), 'village', 28.5, 20.6, 'up'], [h(9), 'boutique', 8.5, 5.7, 'down'],
        (day === 'Emberday' || day === 'Starday') ? [h(19, 30), 'tavern', 3, 12.7, 'right'] : [h(19, 30), 'village', 46.5, 41.4, 'up'], [h(23), 'boutique', 8.5, 5.7, 'up', { hide: true }]];
      case 'seraphine': return rain
        ? [[h(6), null], [h(7), 'cathedral', 19.5, 19.7, 'down'], [h(13), 'cathedral', 12.5, 8.7, 'up'], [h(17), 'cathedral', 19.5, 19.7, 'down'], [h(23), 'cathedral', 19.5, 19.7, 'up', { hide: true }]]
        : [[h(6), null], [h(7), 'cathedral', 19.5, 19.7, 'down'], [h(12), 'cathedral', 12.5, 8.7, 'up'], [h(14), 'village', 61.5, 31.6, 'down'], [h(18), 'village', 66, 21.6, 'up'], [h(21), 'cathedral', 5.5, 14.7, 'up'], [h(23), 'cathedral', 19.5, 19.7, 'up', { hide: true }]];
      case 'gideon': return [[h(6), null], [h(7, 30), 'guild', 9, 4.6, 'down'], [h(12), 'tavern', 15, 8.7, 'left'], [h(13), 'guild', 9, 4.6, 'down'], [h(20), 'tavern', 15, 8.7, 'left'], [h(23), 'village', 68.5, 33.6, 'up', { hide: true }]];
      case 'ronan': return [[h(6), null], [h(7, 30), 'runesmithy', 10.5, 5.6, 'left'], [h(19), 'tavern', 4, 10.7, 'right'], [h(22), 'village', 37.5, 36.6, 'up', { hide: true }]];
      case 'caspian': return rain
        ? [[h(6), null], [h(9), 'menagerie', 8.5, 4.6, 'down'], [h(21), 'menagerie', 8.5, 4.6, 'up', { hide: true }]]
        : [[h(6), null], [h(8), 'village', 70.5, 50.6, 'right'], [h(9), 'menagerie', 8.5, 4.6, 'down'], [h(19), 'village', 71, 49.6, 'up'], [h(21), 'menagerie', 8.5, 4.6, 'up', { hide: true }]];
      case 'laura': return rain
        ? [[h(6), null], [h(9), 'guild', 5.5, 4.6, 'up'], [h(13), 'laura_home', 5.5, 6.6, 'down'], [h(18), 'tavern', 17, 12.7, 'left'], [h(22), 'laura_home', 3.5, 5.6, 'up', { hide: true }]]
        : [[h(6), null], [h(9), 'woods', 20, 30.6, 'left'], [h(12, 30), 'guild', 5.5, 4.6, 'up'], [h(15), 'village', 26.5, 48.6, 'down'], [h(18), 'tavern', 17, 12.7, 'left'], [h(21, 30), 'laura_home', 5.5, 6.6, 'down'], [h(23), 'laura_home', 3.5, 5.6, 'up', { hide: true }]];
      case 'jasmine': return (day === 'Moonday' || day === 'Thornsday') && !rain
        ? [[h(6), null], [h(8, 30), 'village', 26, 27.6, 'down'], [h(16), 'village', 16, 12.6, 'down'], [h(18), 'jasmine_home', 9.5, 6.6, 'left'], [h(21), 'jasmine_home', 2.5, 5.6, 'up', { hide: true }]]
        : [[h(6), null], [h(8), 'jasmine_home', 7, 4.6, 'up'], [h(11), 'village', 16, 12.6, 'down'], [h(14), 'village', 44.5, 37.6, 'down'], [h(17), 'jasmine_home', 9.5, 6.6, 'left'], [h(21), 'jasmine_home', 2.5, 5.6, 'up', { hide: true }]];
      case 'amara': return [[h(6), null], [h(8), 'amara_home', 3, 5.6, 'up'], [h(11), 'ridge', 37.5, 9.6, 'up'], [h(16), 'village', 43.5, 40.4, 'down'],
        G.World.weather === 'starfall' ? [h(19), 'village', 31, 22.6, 'up'] : [h(19), 'amara_home', 9.5, 5.6, 'up'], [h(23, 30), 'amara_home', 7.5, 7.4, 'up', { hide: true }]];
      case 'nightmerchant': return G.NightMarket && G.NightMarket.tonight() ? [[0, null], [h(18, 30), 'village', 60.5, 22.6, 'down'], [h(26), null]] : [[0, null]];
      case 'fennick': {
        if (!N.fennickDay()) return [[0, null]];
        const spots = [['village', 29.5, 27.7, 'down'], ['lake', 17.5, 26.6, 'right'], ['woods', 27.5, 15.6, 'down'], ['ridge', 29.5, 23.6, 'down']];
        const sp = spots[Math.floor(G.S.day / 4) % spots.length];
        return [[h(6), null], [h(9), ...sp], [h(18), 'tavern', 9, 10.7, 'left'], [h(24), 'tavern', 9, 10.7, 'up', { hide: true }]];
      }
    }
    return [[0, null]];
  }
  N.currentTarget = function (id) {
    if (G.Festival && G.Festival.active() && G.Festival.SPOTS[id]) return G.Festival.target(id);
    const S = G.S, list = G.Romance ? G.Romance.wrapSchedule(id, sched(id, S)) : sched(id, S);
    let cur = list[0];
    for (const e of list) if (S.mins >= e[0]) cur = e;
    return cur;
  };

  // ---------------------------------------------------------------- npc entity
  class NPC {
    constructor(id) {
      this.id = id; this.map = null; this.x = 0; this.y = 0; this.dir = 'down'; this.bw = 8; this.bh = 5;
      this.path = null; this.frame = 0; this.animT = 0; this.moving = false; this.hidden = true;
      this.target = null; this.emote = null; this.emoteT = 0; this.pause = 0; this.speed = id === 'pip' ? 52 : id === 'orvyn' || id === 'mirabel' ? 32 : 40;
    }
    get tile() { return [Math.floor(this.x / 16), Math.floor((this.y - 3) / 16)]; }
    sprites() { if (!this._spr) this._spr = G.npcSprites(this.id); return this._spr; }
    place(mapId, x, y, dir) { this.map = mapId; this.x = x * 16; this.y = y * 16; this.dir = dir || 'down'; this.path = null; this.hidden = false; }
  }

  N.init = function () {
    N.list = IDS.map((id) => new NPC(id));
    for (const id of IDS) if (!G.S.friends[id]) G.S.friends[id] = { pts: 0, met: false, talked: 0, gifted: 0, scenes: [] };
    N.snapAll();
    G.Cat.init();
  };
  N.get = (id) => N.list.find((n) => n.id === id);
  N.friend = (id) => G.S.friends[id];
  N.hearts = (id) => Math.min(G.Romance ? G.Romance.cap(id) : 10, Math.floor((N.friend(id) || { pts: 0 }).pts / 100));
  N.anyHearts = (k) => IDS.some((id) => N.hearts(id) >= k);
  N.heartString = (id) => { const h = N.hearts(id); return '♥'.repeat(h) + '<span style="opacity:.3">' + '♥'.repeat(10 - h) + '</span>'; };

  // put every NPC where their schedule says (used at load, new day, and for off-screen NPCs)
  N.snapAll = function () { for (const n of N.list) snap(n); };
  function snap(n) {
    const t = N.currentTarget(n.id);
    n.target = t;
    if (!t[1] || (t[5] && t[5].hide)) { n.hidden = true; n.map = t[1] || null; if (t[1]) { n.x = t[2] * 16; n.y = t[3] * 16; } return; }
    n.place(t[1], t[2], t[3], t[4]);
  }

  // route between maps through the village hub
  const hopCache = new Map();
  function nextHop(from, to) {
    if (from === to) return to;
    const key = from + '>' + to;
    if (hopCache.has(key)) return hopCache.get(key);
    const maps = G.World.maps, prev = { [from]: null }, q = [from];
    let hop = 'village';
    while (q.length) {
      const c = q.shift(), m = maps[c]; if (!m) continue;
      for (const e of m.exits) {
        const t = e.to; if (!maps[t] || t in prev) continue;
        prev[t] = c;
        if (t === to) { let k = t; while (prev[k] !== from) k = prev[k]; hop = k; q.length = 0; break; }
        q.push(t);
      }
    }
    hopCache.set(key, hop);
    return hop;
  }
  N.resetRoutes = () => hopCache.clear();
  // Fennick wanders in every few days
  N.fennickDay = (d) => (((d || G.S.day) + (G.S.seed % 7)) % 4) === 1 || G.S.flags.fennickForce === (d || G.S.day);
  N.present = function (id, mapId) { const n = N.get(id); return !!(n && n.map === mapId && !n.hidden); };
  function exitTile(mapId, toId) {
    const m = G.World.maps[mapId]; if (!m) return null;
    const ex = m.exits.find((e) => e.to === toId);
    if (!ex) return null;
    const [x, y, w, h] = ex.rect;
    return { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2), at: ex.at };
  }

  N.onHour = function () { N.refreshTargets(); };
  N.refreshTargets = function () {
    const W = G.World;
    for (const n of N.list) {
      const t = N.currentTarget(n.id);
      if (n.target === t || (n.target && n.target[0] === t[0] && n.target[1] === t[1] && n.target[2] === t[2])) continue;
      n.target = t;
      n.path = null;
      const onMyMap = W.map && n.map === W.map.id && !n.hidden;
      if (!onMyMap) {
        // arrive walking from the map edge if the destination is the player's map
        if (W.map && t[1] === W.map.id && n.map !== t[1] && !(t[5] && t[5].hide)) {
          const cameFrom = n.map && n.map !== t[1] ? n.map : 'village';
          const ex = exitTile(t[1], nextHop(t[1], cameFrom));
          if (ex) { n.place(t[1], ex.x + 0.5, ex.y + 0.8, 'down'); continue; }
        }
        snap(n);
      } else n.pause = 0.3 + Math.random();
    }
  };
  N.newDay = function () { N.snapAll(); N.pickRequest(); };
  N.onMapChange = function (map) { for (const n of N.list) { const t = N.currentTarget(n.id); n.target = t; if (!(n.map === map.id && !n.hidden && n.path)) snap(n); } };

  // ---------------------------------------------------------------- pathfinding (A* on tiles)
  function astar(map, sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [];
    const W = map.w, H = map.h, start = sy * W + sx, goal = ty * W + tx;
    const g = new Map([[start, 0]]), came = new Map(), open = [[Math.abs(sx - tx) + Math.abs(sy - ty), start]];
    const closed = new Set();
    let iter = 0;
    while (open.length && iter++ < 6000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === goal) { const path = []; let c = cur; while (c !== start) { path.push([c % W, (c / W) | 0]); c = came.get(c); } return path.reverse(); }
      if (closed.has(cur)) continue; closed.add(cur);
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (ni !== goal && map.blocked(nx, ny)) continue;
        const terr = map.terrain[ni];
        const cost = terr === G.MAT.DIRT || terr === G.MAT.COBBLE || terr === G.MAT.GRAVEL || terr === G.MAT.BRIDGE || terr === G.MAT.FLOOR || terr === G.MAT.STAIRS ? 1 : 1.6;
        const ng = g.get(cur) + cost;
        if (ng < (g.has(ni) ? g.get(ni) : 1e9)) { g.set(ni, ng); came.set(ni, cur); open.push([ng + Math.abs(nx - tx) + Math.abs(ny - ty), ni]); }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- update
  N.update = function (dt, map) {
    const W = G.World, p = W.player;
    for (const n of N.list) {
      if (n.emoteT > 0) { n.emoteT -= dt; if (n.emoteT <= 0) n.emote = null; }
      if (n.map !== map.id || n.hidden) continue;
      if (n.talking) { n.moving = false; continue; }
      if (n.pause > 0) { n.pause -= dt; n.moving = false; continue; }
      const t = n.target; if (!t) continue;
      // where are we heading on this map?
      let goalX, goalY, leaving = null;
      if (t[1] && t[1] !== map.id) { const ex = exitTile(map.id, nextHop(map.id, t[1])); if (!ex) { snap(n); continue; } goalX = ex.x; goalY = ex.y; leaving = nextHop(map.id, t[1]); }
      else if (!t[1]) { n.hidden = true; continue; }
      else { goalX = Math.floor(t[2]); goalY = Math.floor(t[3] - 0.2); }
      const [tx, ty] = n.tile;
      if (tx === goalX && ty === goalY && !n.path) {
        // arrived
        n.moving = false;
        if (leaving) { // hop to next map
          const ex = exitTile(map.id, leaving);
          const sp = G.World.maps[leaving].spawns[ex.at];
          n.place(leaving, sp[0], sp[1], sp[2]);
          if (leaving !== t[1]) { /* continue next tick on the hub */ }
          continue;
        }
        if (t[5] && t[5].hide) { n.hidden = true; continue; }
        if (n.arrivedFor !== t) { n.arrivedFor = t; n.dir = t[4] || n.dir; n.idleT = 3 + Math.random() * 3; }
        // idle: mostly face their usual way, sometimes glance around (or at the player when close)
        n.idleT = (n.idleT == null ? 2 + Math.random() * 3 : n.idleT) - dt;
        if (n.idleT <= 0) {
          n.idleT = 2.5 + Math.random() * 4;
          const near = Math.hypot(p.x - n.x, p.y - n.y) < 40;
          n.dir = near ? G.dirFromVec(p.x - n.x, p.y - n.y) : Math.random() < 0.55 ? t[4] || 'down' : U.pick(['down', 'left', 'right', 'up']);
        }
        continue;
      }
      if (!n.path) {
        n.path = astar(map, tx, ty, goalX, goalY);
        if (!n.path) { // unreachable: teleport to target
          if (leaving) { const ex = exitTile(map.id, leaving); const sp = G.World.maps[leaving].spawns[ex.at]; n.place(leaving, sp[0], sp[1], sp[2]); }
          else { n.x = t[2] * 16; n.y = t[3] * 16; }
          n.path = null; continue;
        }
      }
      if (!n.path.length) { n.path = null; n.x = goalX * 16 + 8; n.y = goalY * 16 + 12; continue; }
      // politely wait if the player stands in the way
      const [nx, ny] = n.path[0];
      const wx = nx * 16 + 8, wy = ny * 16 + 12;
      if (Math.hypot(p.x - wx, p.y - wy) < 10) { n.moving = false; n.dir = G.dirFromVec(p.x - n.x, p.y - n.y); continue; }
      const dx = wx - n.x, dy = wy - n.y, d = Math.hypot(dx, dy);
      const step = n.speed * dt;
      if (d <= step) { n.x = wx; n.y = wy; n.path.shift(); if (!n.path.length) n.path = null; }
      else { n.x += (dx / d) * step; n.y += (dy / d) * step; n.dir = G.dirFromVec(dx, dy); }
      n.moving = true;
      n.animT += dt; n.frame = Math.floor(n.animT * 6) % 4;
    }
    G.Cat.update(dt, map);
  };

  N.drawables = function (map, list) {
    for (const n of N.list) {
      if (n.map !== map.id || n.hidden) continue;
      list.push({ sortY: n.y, draw: (ctx, ox, oy) => drawNPC(ctx, n, ox, oy) });
    }
  };
  function drawNPC(ctx, n, ox, oy) {
    const spr = n.sprites();
    const arr = spr.walk[n.dir] || spr.walk.down;
    let f = arr[n.moving ? n.frame : 0];
    if (!f) { G._npcBad = { id: n.id, dir: n.dir, frame: n.frame, moving: n.moving, len: arr.length }; f = arr[0]; }
    ctx.drawImage(f, Math.round(n.x - spr.ax + ox), Math.round(n.y - spr.ay + oy));
    if (n.emote) {
      const x = Math.round(n.x + ox), y = Math.round(n.y - spr.ay + oy - 2 + Math.sin(G.R.time * 6) * 1);
      ctx.fillStyle = '#120c1c'; ctx.fillRect(x - 6, y - 9, 12, 9);
      ctx.fillStyle = '#efe8fb'; ctx.fillRect(x - 5, y - 8, 10, 7); ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillStyle = n.emote === 'heart' ? '#e8607e' : n.emote === 'sad' ? '#69a1db' : n.emote === 'angry' ? '#e8604a' : '#4a3b6d';
      if (n.emote === 'heart') { ctx.fillRect(x - 3, y - 6, 2, 2); ctx.fillRect(x + 1, y - 6, 2, 2); ctx.fillRect(x - 2, y - 4, 4, 2); ctx.fillRect(x - 1, y - 3, 2, 1); }
      else if (n.emote === 'dots') { ctx.fillRect(x - 4, y - 5, 2, 2); ctx.fillRect(x - 1, y - 5, 2, 2); ctx.fillRect(x + 2, y - 5, 2, 2); }
      else { ctx.fillRect(x - 1, y - 7, 2, 3); ctx.fillRect(x - 1, y - 3, 2, 1); }
    }
  }
  N.lights = function () { };

  N.at = function (map, tx, ty, wx, wy, player) {
    let best = null, bd = 1e9;
    for (const n of N.list) {
      if (n.map !== map.id || n.hidden) continue;
      const [nx, ny] = n.tile;
      let d = 1e9;
      if (nx === tx && ny === ty) d = 0;
      else if (Math.hypot(n.x - (tx * 16 + 8), n.y - 6 - (ty * 16 + 8)) < 14) d = 1;
      if (wx != null && Math.abs(wx - n.x) < 9 && wy > n.y - 28 && wy < n.y + 2 && Math.hypot(n.x - player.x, n.y - player.y) < 36) d = 0.5;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  };

  // ---------------------------------------------------------------- conversation
  function flagOn(f) {
    const S = G.S;
    if (f === 'firstBrew') return !!S.flags.firstBrew;
    if (f === 'archonDefeated') return !!S.flags.archonDefeated;
    if (f === 'metAll') return IDS.every((id) => S.friends[id] && S.friends[id].met);
    let m = /^depths(\d+)$/.exec(f); if (m) return S.maxDepth >= +m[1];
    m = /^altar(\d+)$/.exec(f); if (m) return Object.values(S.bundlesDone).filter(Boolean).length >= +m[1];
    return !!S.flags[f];
  }
  N.flagOn = flagOn;
  function condOK(when, n) {
    if (!when) return true;
    const S = G.S, h = N.hearts(n.id);
    if (when.time && when.time !== G.timeOfDay()) return false;
    if (when.weather && when.weather !== G.World.weather) return false;
    if (when.moon === 'full' && !G.isFullMoon()) return false;
    if (when.moon === 'new' && !G.isNewMoon()) return false;
    if (when.loc && when.loc !== n.map) return false;
    if (when.day && when.day !== G.weekday()) return false;
    if (when.minHearts != null && h < when.minHearts) return false;
    if (when.maxHearts != null && h > when.maxHearts) return false;
    if (when.flag && !flagOn(when.flag)) return false;
    return true;
  }
  function pickTalk(n) {
    const t = G.UI.npcText(n.id);
    if (!t || !t.talk) return ['[happy] Lovely to see you, {player}.'];
    const ok = t.talk.filter((e) => condOK(e.when, n));
    const special = ok.filter((e) => e.when);
    const r = U.rng(G.S.day * 131 + U.strHash(n.id) + (G.S.seed % 997));
    const pool = special.length && r() < 0.62 ? special : ok;
    const e = pool[Math.floor(r() * pool.length)] || t.talk[0];
    return Array.isArray(e.text) ? e.text : [e.text];
  }

  N.interact = async function (n) {
    const S = G.S, fr = S.friends[n.id], t = G.UI.npcText(n.id);
    n.talking = true;
    n.dir = G.dirFromVec(G.World.player.x - n.x, G.World.player.y - n.y);
    try {
      // first meeting
      if (!fr.met) {
        fr.met = true; fr.pts += 15; fr.talked = S.day;
        await G.UI.say(n.id, (t && t.intro) || ['Oh! You must be Morwenna\'s apprentice. Welcome to Hollowmere.']);
        if (n.id === 'lune' && !G.Inv.has('rod')) { G.Inv.giveOrDrop('rod', 1); G.sfx('quest_complete'); G.UI.toast('Lune gave you a Fishing Rod!'); }
        if (n.id === 'mirabel') { G.Inv.giveOrDrop('food_bread', 3); G.Inv.giveOrDrop('seed_frostmint', 4); }
        if (n.id === 'elvis') { G.Inv.giveOrDrop('drink_fizz', 1); G.UI.toast('Elvis slides you a Stardust Fizz: on the house.', 'drink_fizz'); }
        if (n.id === 'fennick') G.Inv.giveOrDrop('snack_sweets', 1);
        if (n.id === 'seraphine') G.Inv.giveOrDrop('moonlily', 1);
        if (n.id === 'gideon' && G.Guild) await G.Guild.gideon(n);
        G.emit('met', n.id);
        return;
      }
      // the Lantern Moon: festival activities and the moonlight dance
      if (G.Festival && G.Festival.active() && await G.Festival.talk(n)) return;
      // the Guild: joining up and turning in finished contracts
      if (n.id === 'gideon' && G.Guild && await G.Guild.gideon(n)) return;
      // courting: bouquets and pendants, and partners at home
      if (G.Romance && await G.Romance.talk(n)) return;
      // Orvyn's spellbook, once you've been five floors down
      if (n.id === 'orvyn' && G.Magic && G.Magic.lessonDue()) { await G.Magic.lesson(); return; }
      // pending heart scene
      const scene = pendingScene(n.id);
      if (scene) { await playScene(n.id, scene.k, scene.s); return; }
      // request delivery
      const rq = S.request;
      if (rq && rq.npc === n.id && G.Inv.has(rq.item, rq.qty)) {
        const v = await G.UI.say(n.id, [`[happy] Is that ${rq.qty > 1 ? rq.qty + ' ' : ''}${G.item(rq.item).name} for me?`], { choices: [{ label: `Give ${rq.qty} ${G.item(rq.item).name}`, value: 'give' }, { label: 'Not yet', value: 'no' }] });
        if (v === 'give') {
          G.Inv.remove(rq.item, rq.qty); S.gold += rq.reward; fr.pts += 60; S.request = null; S.stats.requests = (S.stats.requests || 0) + 1;
          G.sfx('quest_complete'); G.jingle('quest_complete');
          n.emote = 'heart'; n.emoteT = 2;
          await G.UI.say(n.id, ['[happy] Thank you, truly! Here, for your trouble.']);
          G.UI.toast(`Request complete: +${U.fmtNum(rq.reward)} ✦`);
          return;
        }
      }
      // gift?
      const sel = G.Inv.selected();
      const giftable = sel && !['tool', 'weapon'].includes(G.item(sel.id).cat) && !G.item(sel.id).scroll;
      if (giftable && fr.gifted !== S.day) {
        const v = await G.UI.say(n.id, pickTalk(n), { choices: [{ label: `Give ${G.item(sel.id).name}`, value: 'gift' }, { label: 'Goodbye', value: 'bye' }] });
        if (fr.talked !== S.day) { fr.talked = S.day; fr.pts += 10; }
        if (v === 'gift') await giveGift(n, sel.id);
        return;
      }
      if (fr.talked === S.day && n.id === 'fennick') { await G.Encounters.merchant(n); return; }
      if (fr.talked === S.day && n.id === 'nightmerchant') { G.Shop.open('nightmerchant'); return; }
      if (fr.talked === S.day) {
        const rep = (t && t.repeat) || ['Still here?'];
        await G.UI.say(n.id, [U.pick(rep)]);
        return;
      }
      fr.talked = S.day; fr.pts += 10;
      if (n.id === 'fennick') { await G.Encounters.merchant(n); return; }
      await G.UI.say(n.id, pickTalk(n));
      if (n.id === 'nightmerchant') G.Shop.open('nightmerchant');
      if (giftable && fr.gifted === S.day) { /* already gifted */ }
    } finally {
      n.talking = false;
      n.pause = 1.2;
    }
  };

  async function giveGift(n, itemId) {
    const S = G.S, fr = S.friends[n.id], t = G.UI.npcText(n.id);
    const taste = N.taste(n.id, itemId);
    G.Inv.remove(itemId, 1);
    fr.gifted = S.day;
    const before = N.hearts(n.id);
    const pts = { love: 80, like: 45, neutral: 20, dislike: -20, hate: -40 }[taste];
    fr.pts = U.clamp(fr.pts + pts, 0, G.Romance ? G.Romance.cap(n.id) * 100 + 99 : 1000);
    const lines = (t && t.gift && t.gift[taste]) || { love: ['[happy] Oh, I adore this!'], like: ['[happy] How thoughtful, thank you.'], neutral: ['Oh. Thank you.'], dislike: ['[sad] ...I see.'], hate: ['[angry] What is this supposed to be?'] }[taste];
    n.emote = taste === 'love' || taste === 'like' ? 'heart' : taste === 'neutral' ? 'dots' : 'angry';
    n.emoteT = 2.2;
    if (taste === 'love' || taste === 'like') G.sfx('heart_up');
    await G.UI.say(n.id, [U.pick(lines)], { item: G.item(itemId).name });
    const after = N.hearts(n.id);
    if (after > before) { G.jingle('heart_up'); G.UI.toast(`${G.UI.npcName(n.id)} — ${after} ♥`); }
    if (!fr.knownLikes) fr.knownLikes = [];
    if ((taste === 'love' || taste === 'like') && !fr.knownLikes.includes(itemId)) fr.knownLikes.push(itemId);
    G.emit('gift', n.id, itemId, taste);
  }

  function pendingScene(id) {
    const t = G.UI.npcText(id); if (!t || !t.hearts) return null;
    const fr = G.S.friends[id], h = N.hearts(id);
    for (const k of [2, 4, 6, 8, 10]) if (h >= k && !fr.scenes.includes(k) && t.hearts[k]) return { k, s: t.hearts[k] };
    return null;
  }
  async function playScene(id, k, s) {
    const S = G.S, fr = S.friends[id];
    fr.scenes.push(k);
    await G.UI.say(id, s.pages || ['...']);
    const r = s.reward;
    if (r) {
      if (r.item) { G.Inv.giveOrDrop(r.item, r.qty || 1); G.sfx('quest_complete'); }
      if (r.glimmer) { S.gold += r.glimmer; G.UI.toast(`+${U.fmtNum(r.glimmer)} ✦`); }
      if (r.recipe) { S.known[r.recipe] = 1; G.jingle('discovery'); G.UI.toast('Learned recipe: ' + G.item(r.recipe).name); }
    }
    G.jingle('heart_up');
  }

  // ---------------------------------------------------------------- notice board requests
  N.pickRequest = function () {
    const S = G.S;
    if (S.request && S.day - S.request.day > 2) { G.UI.toast(`${G.UI.npcName(S.request.npc)}'s request expired.`); S.request = null; }
    const reqs = window.GAMETEXT && GAMETEXT.requests;
    if (!reqs || !reqs.length) { S.boardToday = null; return; }
    const r = U.rng(S.seed + S.day * 53);
    S.boardToday = r() < 0.75 ? Math.floor(r() * reqs.length) : null;
  };

  // ---------------------------------------------------------------- Inkwell the cat
  const Cat = (G.Cat = { x: 0, y: 0, dir: 'right', state: 'sit', t: 0, frame: 0, tx: 0, ty: 0, bw: 8, bh: 4 });
  Cat.init = function () { Cat.x = 7.5 * 16; Cat.y = 29.5 * 16; Cat.state = 'sleep'; Cat.t = 3; };
  Cat.sprites = function () {
    if (Cat._spr) return Cat._spr;
    try { if (window.CharArt && CharArt.catSprites) { Cat._spr = CharArt.catSprites(); return Cat._spr; } } catch (e) { /* fallback */ }
    const mk = (pose, f) => {
      const P = new G.Pix(16, 16);
      P.shadow(8, 15, 5, 1.2);
      if (pose === 'sleep') { P.disc(8, 12, 5, 3, '#231b38'); P.disc(11, 11, 2, 2, '#2a2148'); P.set(12, 10, '#362a52'); }
      else { P.disc(8, 11, 4, 3, '#231b38'); P.disc(11, 8, 3, 3, '#231b38'); P.set(10, 5, '#231b38'); P.set(13, 5, '#231b38'); P.set(12, 8, '#5dffb0'); P.set(10, 8, '#5dffb0'); P.line(4, 11, 2, 7 + (f % 2), '#231b38'); if (pose === 'walk') { P.set(6, 14 - (f % 2), '#1b1429'); P.set(10, 14 - ((f + 1) % 2), '#1b1429'); } }
      P.outline('#08050f');
      return P.canvas();
    };
    const fl = (c) => U.flipCanvas(c);
    const walkR = [0, 1, 2, 3].map((f) => mk('walk', f));
    Cat._spr = { w: 16, h: 16, ax: 8, ay: 15, idle: [mk('sit', 0), mk('sit', 1)], walk: { right: walkR, left: walkR.map(fl) }, sit: [mk('sit', 0)], sleep: [mk('sleep', 0), mk('sleep', 1)] };
    return Cat._spr;
  };
  Cat.update = function (dt, map) {
    if (map.id !== 'sanctum') return;
    Cat.t -= dt;
    if (Cat.state === 'walk') {
      const dx = Cat.tx - Cat.x, dy = Cat.ty - Cat.y, d = Math.hypot(dx, dy);
      if (d < 2 || Cat.t <= 0) { Cat.state = Math.random() < 0.4 ? 'sleep' : 'sit'; Cat.t = 4 + Math.random() * 8; }
      else {
        const sp = 26 * dt;
        const ox = Cat.x, oy = Cat.y;
        G.moveBody(Cat, (dx / d) * sp, (dy / d) * sp, map);
        if (Math.abs(Cat.x - ox) + Math.abs(Cat.y - oy) < 0.01) { Cat.state = 'sit'; Cat.t = 2; }
        Cat.dir = dx < 0 ? 'left' : 'right'; Cat.frame += dt * 8;
      }
    } else if (Cat.t <= 0) {
      // follow the player sometimes, or wander
      const p = G.World.player;
      if (Math.random() < 0.35 && Math.hypot(p.x - Cat.x, p.y - Cat.y) < 160) { Cat.tx = p.x + (Math.random() - 0.5) * 30; Cat.ty = p.y + 10; }
      else { Cat.tx = U.clamp(Cat.x + (Math.random() - 0.5) * 120, 40, map.w * 16 - 40); Cat.ty = U.clamp(Cat.y + (Math.random() - 0.5) * 90, 120, map.h * 16 - 60); }
      Cat.state = 'walk'; Cat.t = 6;
    }
  };
  Cat.drawables = function (map, list) {
    if (map.id !== 'sanctum') return;
    list.push({
      sortY: Cat.y,
      draw(ctx, ox, oy) {
        const s = Cat.sprites();
        let f;
        if (Cat.state === 'walk') f = s.walk[Cat.dir === 'left' ? 'left' : 'right'][Math.floor(Cat.frame) % 4];
        else if (Cat.state === 'sleep') f = s.sleep[Math.floor(G.R.time * 1.2) % s.sleep.length];
        else f = s.idle[Math.floor(G.R.time * 1.5) % s.idle.length];
        ctx.drawImage(f, Math.round(Cat.x - s.ax + ox), Math.round(Cat.y - s.ay + oy));
        if (Cat.heartT > 0) { Cat.heartT -= 1 / 60; const y = Math.round(Cat.y - 20 + oy - (1 - Cat.heartT) * 8); ctx.fillStyle = '#e8607e'; const x = Math.round(Cat.x + ox); ctx.fillRect(x - 3, y, 2, 2); ctx.fillRect(x + 1, y, 2, 2); ctx.fillRect(x - 2, y + 2, 4, 1); ctx.fillRect(x - 1, y + 3, 2, 1); }
      },
    });
  };
  Cat.at = function (map, tx, ty, wx, wy) {
    if (map.id !== 'sanctum') return false;
    if (Math.floor(Cat.x / 16) === tx && Math.floor((Cat.y - 2) / 16) === ty) return true;
    if (wx != null && Math.abs(wx - Cat.x) < 9 && Math.abs(wy - (Cat.y - 6)) < 9) return true;
    return false;
  };
  Cat.pet = function () {
    const S = G.S;
    Cat.state = 'sit'; Cat.t = 3; Cat.heartT = 1;
    G.sfx('cat_meow');
    const lines = (window.GAMETEXT && GAMETEXT.misc && GAMETEXT.misc.cat) || ['Inkwell purrs like a tiny cauldron.'];
    if (S.catPet !== S.day) { S.catPet = S.day; S.energy = Math.min(S.maxEnergy, S.energy + 10); }
    G.UI.toast(G.UI.fill(U.pick(lines)));
  };
})();
