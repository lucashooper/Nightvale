// Nightvale — expansion data: tavern drinks, buff foods, clothing, relics, forest loot, new potions,
// spell & festival items, forest monsters, and the new shops (Elvis, Isolde, Sable's kitchen, Fennick).
(function () {
  'use strict';
  const G = window.G, I = G.ITEMS;
  const add = (id, name, cat, sell, o) => (I[id] = Object.assign({ id, name, cat, sell, stack: 999 }, o || {}));

  // ---------------------------------------------------------------- drinks (Elvis's bar) — the drink buff slot
  // eat: { energy, hp, buff: {stat: points}, secs (real seconds) | until (in-game minute) }
  const drink = (id, name, buy, eat) => add(id, name, 'food', Math.floor(buy / 3), { buy, drink: true, eat });
  drink('drink_fizz', 'Stardust Fizz', 140, { energy: 15, buff: { speed: 4 }, secs: 180 });
  drink('drink_moonmilk', 'Moonmilk Nog', 110, { energy: 80 });
  drink('drink_dragon', 'Dragonbreath Cider', 160, { hp: 20, buff: { attack: 3 }, secs: 120 });
  drink('drink_frostberry', 'Frostberry Spritz', 130, { hp: 40, energy: 40 });
  drink('drink_mistwine', 'Mistwine', 220, { buff: { luck: 2 }, until: 1080 });
  drink('drink_hollow', 'Hollowroot Stout', 120, { energy: 30, buff: { defense: 2 }, secs: 120 });

  // ---------------------------------------------------------------- foods with stat buffs (about four minutes)
  const snack = (id, name, buy, eat) => add(id, name, 'food', Math.floor(buy / 3), { buy, eat: Object.assign({ secs: 240 }, eat) });
  snack('snack_sweets', 'Bag of Moonsweets', 60, { energy: 20, buff: { speed: 1, luck: 1 } });
  snack('snack_toffee', 'Cauldron Toffee', 70, { energy: 20, buff: { mining: 2 } });
  snack('snack_jellies', 'Jumping Jellies', 90, { energy: 30, buff: { speed: 2 } });
  snack('food_honeycake', 'Honeymoon Cake', 160, { energy: 45, hp: 10, buff: { speed: 1, luck: 1, farming: 1 } });
  snack('food_pasty', 'Pumpkin Pasty', 140, { energy: 50, buff: { farming: 2, defense: 1 } });
  snack('food_gazypie', 'Starry-Gazy Pie', 180, { energy: 60, buff: { fishing: 3 } });
  snack('food_chili', 'Dragonfire Chili', 170, { energy: 40, hp: 20, buff: { attack: 3 } });
  snack('food_gingerghost', 'Ghostly Gingerbread', 110, { energy: 30, buff: { luck: 1, magnetism: 2 } });
  snack('food_glowtoast', 'Glowcap Toast', 120, { energy: 40, buff: { luck: 1, mining: 1 } });
  snack('food_moonpudding', 'Moon Pudding', 200, { energy: 60, hp: 15, buff: { defense: 2, luck: 1 } });
  snack('food_spellscroll', 'Cinnamon Spellscroll', 130, { energy: 35, buff: { speed: 1, magnetism: 2 } });
  snack('food_starbun', 'Starlight Bun', 400, { energy: 50, buff: { speed: 1, luck: 1, farming: 1, fishing: 1, mining: 1 } });

  // ---------------------------------------------------------------- clothing (Isolde) — use one to wear it
  const wear = (id, name, slot, buy) => add(id, name, 'clothing', Math.floor(buy / 4), { buy, wear: slot, stack: 1 });
  wear('cl_hat_wizard', 'Starry Wizard Hat', 'hat', 650); wear('cl_hat_witch', 'Wide-Brim Witch Hat', 'hat', 600);
  wear('cl_hat_tricorn', 'Raven Tricorn', 'hat', 700); wear('cl_hat_beret', 'Velvet Beret', 'hat', 300);
  wear('cl_hat_hood', 'Mossweave Hood', 'hat', 350); wear('cl_hat_crown', 'Flower Crown', 'hat', 400);
  wear('cl_hat_tophat', 'Moonlit Top Hat', 'hat', 900); wear('cl_hat_circlet', 'Crescent Circlet', 'hat', 850);
  wear('cl_cloak_midnight', 'Midnight Cloak', 'cloak', 1100); wear('cl_cloak_ember', 'Ember Cape', 'cloak', 950);
  wear('cl_cloak_moss', 'Moss Mantle', 'cloak', 800); wear('cl_cloak_raven', 'Raven Feather Cloak', 'cloak', 1300);
  wear('cl_cloak_silver', 'Silver Veil Mantle', 'cloak', 1500);
  wear('cl_outfit_scholar', "Scholar's Robes", 'outfit', 700); wear('cl_outfit_alchemist', "Alchemist's Coat", 'outfit', 850);
  wear('cl_outfit_bard', "Bard's Doublet", 'outfit', 800); wear('cl_outfit_duelist', "Duelist's Waistcoat", 'outfit', 1000);
  wear('cl_outfit_moonweave', 'Moonweave Robes', 'outfit', 1200); wear('cl_outfit_ranger', "Ranger's Garb", 'outfit', 600);

  // ---------------------------------------------------------------- relics & curios
  add('treasure_map', 'Tattered Treasure Map', 'misc', 0, { stack: 1, quest: true });
  add('old_key', 'Rusted Skeleton Key', 'misc', 0, { stack: 1, quest: true });
  add('relic_coin', 'Ancient Lunar Coin', 'relic', 300); add('relic_idol', 'Moth-Winged Idol', 'relic', 450);
  add('relic_star', 'Star Fragment', 'relic', 800); add('relic_locket', 'Silver Locket', 'relic', 350);
  add('relic_bell', 'Fairy Bell', 'relic', 380); add('relic_feather', 'Phoenix Feather', 'relic', 1200);
  add('golden_acorn', 'Golden Acorn', 'relic', 500);
  // forest creature loot
  add('thorn_bramble', 'Living Bramble', 'loot', 25); add('wisp_essence', 'Wisp Light', 'loot', 55);
  add('wolf_fang', 'Moss-Wolf Fang', 'loot', 40); add('antler_shard', 'Spectral Antler', 'loot', 600);
  // potions
  add('pot_wisplight', 'Wisplight Tonic', 'potion', 260, { use: { buff: 'wisplight', secs: 180 } });
  add('pot_thornhide', 'Thornhide Draught', 'potion', 320, { use: { stat: { defense: 3 }, secs: 240 } });
  add('pot_mana', 'Mana Draught', 'potion', 150, { use: { mana: 30 } });
  G.RECIPES.push({ id: 'pot_wisplight', ing: ['wisp_essence', 'glowcap'], time: 150 }, { id: 'pot_thornhide', ing: ['thorn_bramble', 'frostmint'], time: 180 }, { id: 'pot_mana', ing: ['moonpetal', 'arcane_dust'], time: 120 });
  for (const id of ['pot_wisplight', 'pot_thornhide', 'pot_mana']) add('scroll_' + id, 'Recipe: ' + I[id].name, 'misc', 0, { stack: 1, scroll: id, iconOf: 'letter' });
  // magic, festival, familiars
  add('spellbook', "Orvyn's Spellbook", 'misc', 0, { stack: 1, quest: true });
  add('scroll_spell', 'Spell Scroll', 'misc', 0, { stack: 1 });
  add('sky_lantern', 'Sky Lantern', 'misc', 15, { buy: 50 });
  add('festival_token', 'Lantern Token', 'misc', 0);
  add('prize_ribbon', 'Prize Ribbon', 'misc', 250, { stack: 1 });
  add('fam_treat', 'Familiar Treats', 'misc', 10, { buy: 40 });

  // ---------------------------------------------------------------- forest monsters (Whisperwood & the Deepwood)
  Object.assign(G.MOBS, {
    thornling: { hp: 22, dmg: 6, speed: 22, ai: 'shroom', drops: [['thorn_bramble', 0.8, 1, 2], ['fiber', 0.5, 1, 3]], xp: 4 },
    wisp: { hp: 14, dmg: 5, speed: 46, ai: 'bat', fly: true, drops: [['wisp_essence', 0.75, 1, 1]], xp: 4, glow: [120, 255, 230] },
    mosswolf: { hp: 44, dmg: 10, speed: 64, ai: 'melee', drops: [['wolf_fang', 0.7, 1, 2]], xp: 8 },
    bogling: { hp: 26, dmg: 7, speed: 34, ai: 'hop', drops: [['slime_gel', 0.6, 1, 2], ['bog_amber', 0.08, 1, 1]], xp: 4 },
    mimic: { hp: 70, dmg: 13, speed: 40, ai: 'hop', drops: [['relic_coin', 0.6, 1, 1], ['amethyst', 0.5, 1, 2], ['emerald', 0.25, 1, 1]], xp: 14 },
    webweaver: { hp: 40, dmg: 10, speed: 56, ai: 'spider', drops: [['spider_silk', 0.85, 1, 3]], xp: 8 },
    gloombeetle: { hp: 48, dmg: 11, speed: 30, ai: 'golem', drops: [['arcane_dust', 0.5, 1, 1], ['amethyst', 0.2, 1, 1]], xp: 9, glow: [180, 120, 255] },
    hornbeetle: { hp: 70, dmg: 13, speed: 24, ai: 'golem', drops: [['ore_shadow', 0.6, 1, 3], ['golem_core', 0.08, 1, 1]], xp: 11 },
    hollowstag: { hp: 900, dmg: 18, speed: 46, ai: 'melee', drops: [['antler_shard', 1, 1, 1], ['moonstone', 1, 1, 2], ['relic_star', 0.4, 1, 1]], xp: 120, big: true, boss: true, glow: [120, 255, 230] },
  });

  // ---------------------------------------------------------------- shops
  const S = G.SHOPS;
  S.mirabel.stock.push(['snack_sweets'], ['snack_toffee'], ['food_honeycake', null, (s) => s.day >= 2], ['food_spellscroll', null, (s) => s.day >= 4], ['sky_lantern', null, (s) => G.isFullMoon && G.isFullMoon()]);
  S.elvis = {
    title: 'The Gilded Owl — the bar',
    stock: [['drink_fizz'], ['drink_moonmilk'], ['drink_frostberry'], ['drink_dragon'], ['drink_hollow'], ['drink_mistwine', null, (s) => s.day >= 3], ['snack_jellies'], ['food_moonpudding'],
      ['pot_healing', 240], ['pot_vigor', 260], ['pot_fairy', 200], ['pot_swift', 560, (s) => s.day >= 4], ['pot_frostward', 700, (s) => s.maxDepth >= 10]],
    buys: { fish: 1, food: 1, crop: 0.9, potion: 1 },
  };
  S.sable = {
    title: 'The Gilded Owl — the kitchen',
    stock: [['food_bread'], ['food_stew'], ['food_pie'], ['food_pasty'], ['food_gazypie'], ['food_chili'], ['food_glowtoast'], ['food_mead'], ['food_coffee'], ['food_tea']],
    buys: { fish: 1, food: 1, crop: 0.9 },
  };
  S.isolde = {
    title: "Quillon's Threads & Tomes",
    stock: [['cl_hat_beret'], ['cl_hat_hood'], ['cl_hat_crown'], ['cl_hat_witch'], ['cl_hat_wizard'], ['cl_hat_tricorn', null, (s) => s.day >= 3], ['cl_hat_circlet', null, (s) => s.day >= 6], ['cl_hat_tophat', null, (s) => s.day >= 8],
      ['cl_outfit_ranger'], ['cl_outfit_scholar'], ['cl_outfit_bard'], ['cl_outfit_alchemist'], ['cl_outfit_duelist', null, (s) => s.day >= 4], ['cl_outfit_moonweave', null, (s) => s.day >= 7],
      ['cl_cloak_moss'], ['cl_cloak_ember'], ['cl_cloak_midnight'], ['cl_cloak_raven', null, (s) => s.day >= 5], ['cl_cloak_silver', null, (s) => s.day >= 10]],
    buys: { relic: 1, clothing: 1, loot: 0.6 },
    wardrobe: true,
  };
  // Fennick's pack: a few everyday treats plus four rarities chosen fresh each day he's in town
  S.fennick = {
    title: "Fennick's Pack of Wonders",
    stock: [['snack_sweets', 70], ['snack_jellies', 100], ['food_gingerghost'], ['food_starbun']],
    rare: [['relic_bell', 900], ['golden_acorn', 1100], ['treasure_map', 600], ['moonstone', 850], ['seed_starflask', 520], ['scroll_pot_thornhide', 900], ['scroll_pot_wisplight', 800], ['pearl', 700], ['cl_hat_tricorn', 650], ['relic_coin', 700], ['emerald', 420], ['seed_phialvine', 340], ['fam_treat', 60]],
    buys: { relic: 1.15, gem: 1, loot: 0.9 },
  };
  S.fennick.stockFn = (s) => G.fennickStock(s.day);
  G.fennickStock = function (day) {
    const r = G.U.rng((G.S.seed % 1000) + day * 977), pool = S.fennick.rare.slice(), out = [];
    while (out.length < 4 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return S.fennick.stock.concat(out);
  };
})();
