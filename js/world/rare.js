// Nightvale — rare floors of the Umbral Depths (about one in ten): the Forgotten Library, the Witch's Hollow,
// the Sunken Observatory and the Crystal Garden. Each is a furnished chamber with its own secrets: lore,
// a blueprint, a cauldron to stir, an orrery that reveals the way down, a fountain that heals.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.MAT;
  const R = (G.Rare = {});
  const KINDS = {
    library: { name: 'The Forgotten Library', ambient: [96, 86, 124], floor: 'library' },
    witch: { name: "The Witch's Hollow", ambient: [78, 98, 94], floor: 'witch' },
    observatory: { name: 'The Sunken Observatory', ambient: [76, 80, 128], floor: 'observatory' },
    crystal: { name: 'The Crystal Garden', ambient: [86, 76, 132], floor: 'crystal' },
  };
  R.KINDS = KINDS;
  const TX = () => (window.GAMETEXT && GAMETEXT.rare) || {};
  R.size = [28, 20];
  // about one floor in ten, never on gate floors (every fifth) or the throne
  R.pick = function (floor, r) {
    if (floor < 3 || floor >= 50 || floor % 5 === 0) return null;
    const S = G.S;
    if (S.flags.forceRare) { const k = S.flags.forceRare; S.flags.forceRare = null; return KINDS[k] ? k : 'library'; }
    if (r() > 0.1) return null;
    return r.pick(Object.keys(KINDS));
  };
  // a rectangular chamber with softly rounded corners, walls all round
  R.grid = function (w, h) {
    const g = new Uint8Array(w * h).fill(1);
    for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
      const cx = Math.min(x - 3, w - 4 - x), cy = Math.min(y - 3, h - 4 - y);
      if (cx === 0 && cy === 0) continue;
      g[y * w + x] = 0;
    }
    return { g, open: 1 };
  };

  // a furnished piece (InteriorArt), with its own footprint and solidity
  function piece(map, id, v, tx, ty, extra) {
    const s = G.Interiors.iaSprite(id, v || 0);
    const o = Object.assign({ id, v: v || 0, foot: s.foot || [1, 1], solid: s.solid }, extra || {});
    if (s.overhead) { o.ghost = true; o.solid = false; o.sortY = 1e7; if (o.dy == null) o.dy = -26; }
    else if (s.flat) { o.ghost = true; o.solid = false; o.sortY = -1e6 + ty; }
    for (let j = 0; j < o.foot[1]; j++) for (let i = 0; i < o.foot[0]; i++) if (map.tobj.has(map.idx(tx + i, ty + j))) map.setObj(tx + i, ty + j, null);
    return map.add('room', tx, ty, o);
  }
  const rare = (what) => ({ kind: 'rare', what });

  R.build = function (map, kind, r, floor, placeDown) {
    const k = KINDS[kind], w = map.w, h = map.h;
    map.rare = { kind, rect: [3, 3, w - 6, h - 6], used: {} };
    map.subtitle = k.name; map.ambient = k.ambient;
    try { const c = window.InteriorArt && InteriorArt.floor(k.floor, (w - 6) * 16, (h - 6) * 16, map.seed); map.rare.floorCanvas = c && (c.c || c); } catch (e) { map.rare.floorCanvas = null; }
    const spawn = (type, variant, n) => { for (let i = 0; i < n; i++) { for (let t = 0; t < 30; t++) { const x = 4 + r.int(0, w - 9), y = 4 + r.int(0, h - 10); if (!map.blocked(x, y) && !map.tobj.has(map.idx(x, y)) && Math.abs(y - (h - 6)) > 3) { map.entities.push(G.Mobs.spawn(type, variant, x * 16 + 8, y * 16 + 12, floor)); break; } } } };
    if (kind === 'library') {
      for (const x of [4, 7, 10, 17, 20, 23]) piece(map, 'lib_shelf', 0, x, 4, { interact: rare('shelf') });
      for (const x of [5, 8, 18, 21]) piece(map, 'lib_shelf', 0, x, 9, { interact: rare('shelf') });
      piece(map, 'blueprint_pedestal', 0, 14, 4, { interact: rare('pedestal') });
      piece(map, 'reading_desk', 0, 13, 7, { interact: rare('desk') });
      piece(map, 'lib_ladder', 0, 15, 9);
      piece(map, 'floating_books', 0, 9, 12); piece(map, 'floating_books', 0, 19, 12);
      piece(map, 'book_tower', 2, 4, 13); piece(map, 'book_tower', 0, 23, 12); piece(map, 'book_pile', 1, 12, 13);
      spawn('ink_bat', 'default', 5);
      placeDown(map, [23, 14], true);
    } else if (kind === 'witch') {
      piece(map, 'witch_cauldron', 0, 13, 7, { interact: rare('cauldron') });
      piece(map, 'jar_shelf', 0, 5, 4, { interact: rare('jars') }); piece(map, 'jar_shelf', 0, 20, 4, { interact: rare('jars') });
      piece(map, 'herb_rack', 0, 9, 4); piece(map, 'broom', 0, 17, 5);
      piece(map, 'witch_chair', 0, 9, 11, { interact: rare('diary') });
      piece(map, 'candle_cluster', 0, 16, 11); piece(map, 'candle_cluster', 0, 6, 13); piece(map, 'skull_planter', 0, 21, 13);
      for (const [x, y, v] of [[4, 8, 0], [22, 9, 1], [11, 14, 1], [18, 14, 0]]) piece(map, 'lumi_fungus', v, x, y);
      spawn('shroomling', 'toxic', 3);
      placeDown(map, [23, 14], true);
    } else if (kind === 'observatory') {
      piece(map, 'star_chart_floor', 0, 12, 8);
      piece(map, 'orrery_big', 0, 6, 6, { interact: rare('orrery') });
      piece(map, 'great_telescope', 0, 19, 5, { interact: rare('telescope') });
      piece(map, 'blueprint_pedestal', 0, 13, 4, { interact: rare('pedestal') });
      piece(map, 'astrolabe', 0, 16, 12, { interact: rare('telescope') }); piece(map, 'book_tower', 0, 22, 13);
      for (const [x, y] of [[5, 12], [9, 14], [21, 9]]) map.setObj(x, y, { kind: 'forage', id: 'starshard' });
      map.rare.orreryHides = true;
    } else {
      piece(map, 'fairy_fountain', 0, 13, 7, { interact: rare('fountain') });
      for (const [x, y, v] of [[6, 5, 0], [20, 5, 1], [8, 12, 2], [19, 12, 0], [11, 14, 1], [16, 4, 2]]) piece(map, 'crystal_flower', v, x, y, { interact: rare('flower') });
      for (const [x, y, v] of [[4, 9, 0], [23, 8, 1], [14, 13, 1], [5, 14, 0], [22, 13, 0]]) piece(map, 'lumi_fungus', v, x, y);
      spawn('golem', 'crystal', 2);
      placeDown(map, [23, 14], true);
    }
    // a little shimmer in the air
    map.staticLights.push({ x: w * 8, y: h * 8, r: 160, color: kind === 'witch' ? [120, 255, 170] : kind === 'crystal' ? [190, 150, 255] : [150, 170, 255], i: 0.25 });
  };

  R.drawGround = function (ctx, map, ox, oy) {
    const rr = map.rare; if (!rr || !rr.floorCanvas) return;
    ctx.drawImage(rr.floorCanvas, rr.rect[0] * 16 + ox, rr.rect[1] * 16 + oy);
  };

  // a blueprint you don't know yet (or something nice if you know them all)
  function giveBlueprint(map, prop) {
    const S = G.S, have = (id) => S.known[G.item(id).bp] || G.Inv.has(id);
    const left = G.BLUEPRINTS.filter((id) => !have(id) && G.ITEMS[G.item(id).bp]);
    const lines = TX().blueprint;
    if (left.length) {
      const id = U.pick(left);
      G.Inv.giveOrDrop(id, 1); G.jingle('discovery'); G.sfx('chest_open');
      G.UI.say(null, [lines ? U.pick(lines) : 'A blueprint. You can learn to make something new.']);
      G.UI.toast(`Found ${G.item(id).name}! Read it (E) to learn it.`, id);
    } else { G.Inv.giveOrDrop('lore_page', 1); G.S.gold += 500; G.UI.toast('An old lore page and a purse of 500 ✦ rest on the pedestal.', 'lore_page'); G.sfx('coin'); }
    if (prop) { const v = G.Interiors.iaSprite('blueprint_pedestal', 1); prop.spr = v; prop.lights = []; }
  }

  R.interact = async function (it, prop) {
    const map = G.World.map, S = G.S, rr = map.rare || { used: {} }, used = rr.used, t = TX();
    const key = it.what + ':' + prop.tx + ',' + prop.ty;
    switch (it.what) {
      case 'shelf': G.UI.toast(U.pick(['Dusty spines in a language that keeps changing as you read it.', 'A whole shelf of books about one single moth.', 'Something shuffles behind the books. Probably a bat. Probably.'])); return;
      case 'desk': {
        const books = (t.library && t.library.books) || ['A water-stained book. The words swim away from you.'];
        if (!used[key]) { used[key] = true; G.Inv.giveOrDrop('lore_page', 1); }
        await G.UI.say(null, [U.pick(books)]); return;
      }
      case 'pedestal': if (used[key]) { G.UI.toast('The pedestal is empty now.'); return; } used[key] = true; giveBlueprint(map, prop); return;
      case 'cauldron': {
        if (used[key]) { G.UI.toast('The cauldron has gone still. Whatever was in it is in you now.'); return; }
        used[key] = true;
        const lines = (t.witch && t.witch.cauldron) || ['You stir once. The brew turns the colour of a bruise, then of a sunrise.'];
        await G.UI.say(null, [U.pick(lines)]);
        const brew = U.pick(['pot_swift', 'pot_ember', 'pot_frostward', 'pot_shadow', 'pot_starlight', 'sludge']);
        G.Inv.giveOrDrop(brew, 1); G.sfx('mystery_chime'); G.UI.toast(`You ladle out a ${G.item(brew).name}.`, brew);
        return;
      }
      case 'jars': {
        if (used[key]) { G.UI.toast('Nothing left but cobwebs and a very offended spider.'); return; }
        used[key] = true;
        const loot = U.pick([['bat_wing', 2], ['spore_sac', 2], ['ectoplasm', 1], ['mandrake', 1], ['arcane_dust', 2], ['void_essence', 1]]);
        G.Inv.giveOrDrop(loot[0], loot[1]); G.sfx('cloth_rustle'); G.UI.toast(`You find ${loot[1]} ${G.item(loot[0]).name} among the jars.`, loot[0]);
        return;
      }
      case 'diary': {
        const d = (t.witch && t.witch.diary) || ['A diary page, tea-stained: "Brewed the moon again. It still tastes of pennies."'];
        if (!used[key]) { used[key] = true; G.Inv.giveOrDrop('lore_page', 1); }
        await G.UI.say(null, [U.pick(d)]); return;
      }
      case 'orrery': {
        if (used[key]) { G.UI.toast('The orrery\'s moons have settled. The way down is open.'); return; }
        used[key] = true;
        const lines = (t.observatory && t.observatory.orrery) || ['You spin the orrery. Somewhere below, stone grinds against stone.'];
        G.sfx('mystery_chime');
        await G.UI.say(null, [U.pick(lines)]);
        const spots = [[23, 14], [22, 14], [23, 13], [20, 14]];
        for (const [x, y] of spots) if (!map.blocked(x, y) && !map.tobj.has(map.idx(x, y))) { G.Dungeon.makeLadder(map, x, y, false); map.downRevealed = true; break; }
        G.UI.toast('A way down has opened in the corner.');
        return;
      }
      case 'telescope': {
        const notes = (t.observatory && t.observatory.notes) || ['Through the lens: a star that isn\'t on any chart, moving very slowly toward the valley.'];
        await G.UI.say(null, [U.pick(notes)]); return;
      }
      case 'fountain': {
        if (used[key]) { G.UI.toast('The fountain ripples politely. It has given what it can today.'); return; }
        used[key] = true;
        const lines = (t.crystal && t.crystal.fountain) || ['You drink. The water tastes like a bell sounds.'];
        await G.UI.say(null, [U.pick(lines)]);
        S.hp = S.maxHp; S.energy = Math.min(S.maxEnergy, S.energy + 60);
        G.sfx('drink_potion'); G.R.burst(G.World.player.x, G.World.player.y - 14, 16, { colors: ['#b8e0ff', '#ffffff', '#e4d2ff'], speed: 35, life: 0.8, grav: -25 });
        G.UI.toast('Fully healed, and +60 energy.');
        return;
      }
      case 'flower': {
        const gem = ['amethyst', 'emerald', 'quartz'][prop.o.v || 0] || 'quartz';
        G.dropItem(map, gem, 1 + (G.Stats.lucky(0.1) ? 1 : 0), prop.x, prop.y - 6);
        G.sfx('gem_found');
        map.removeProp(prop);
        return;
      }
    }
  };

  // announce on arrival
  G.on('mapChanged', (map) => {
    if (!map || map.id !== 'depths' || !map.rare) return;
    const t = TX()[map.rare.kind];
    setTimeout(() => { G.UI.banner(KINDS[map.rare.kind].name, `Floor ${map.floor} · a rare floor`); G.jingle('discovery'); if (t && t.banner) G.UI.toast(t.banner); }, 500);
    G.S.stats.rareFloors = (G.S.stats.rareFloors || 0) + 1;
  });
})();
