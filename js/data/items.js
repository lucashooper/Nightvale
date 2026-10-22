// Nightvale — game data: items, crops, recipes, shops, upgrades, altar offerings, monsters.
(function () {
  'use strict';
  const G = window.G;

  // cat: tool weapon seed crop forage resource ore gem loot fish potion food place misc
  const I = {};
  const add = (id, name, cat, sell, o) => (I[id] = Object.assign({ id, name, cat, sell, stack: 999 }, o || {}));

  // tools
  add('hoe', 'Rune Hoe', 'tool', 0, { stack: 1, tool: 'hoe' });
  add('can', 'Dew Can', 'tool', 0, { stack: 1, tool: 'can' });
  add('pickaxe', 'Pickaxe', 'tool', 0, { stack: 1, tool: 'pickaxe' });
  add('axe', 'Axe', 'tool', 0, { stack: 1, tool: 'axe' });
  add('rod', 'Fishing Rod', 'tool', 0, { stack: 1, tool: 'rod', buy: 400 });
  // weapons
  add('sword_rusty', 'Rusty Moonblade', 'weapon', 10, { stack: 1, weapon: { kind: 'sword', min: 4, max: 7, speed: 0.36, reach: 20, crit: 0.04 } });
  add('sword_silver', 'Silverthorn Saber', 'weapon', 250, { stack: 1, buy: 900, weapon: { kind: 'sword', min: 9, max: 14, speed: 0.33, reach: 22, crit: 0.06 } });
  add('sword_star', 'Starsteel Blade', 'weapon', 900, { stack: 1, buy: 4200, weapon: { kind: 'sword', min: 17, max: 24, speed: 0.31, reach: 24, crit: 0.08 } });
  add('sword_umbral', 'Umbral Edge', 'weapon', 2500, { stack: 1, buy: 11000, weapon: { kind: 'sword', min: 28, max: 38, speed: 0.29, reach: 26, crit: 0.12 } });
  add('wand_apprentice', 'Apprentice Wand', 'weapon', 150, { stack: 1, buy: 650, weapon: { kind: 'wand', min: 6, max: 9, speed: 0.45, cost: 2, bolt: 'bolt_player', bspeed: 190, range: 150 } });
  add('wand_ember', 'Ember Wand', 'weapon', 700, { stack: 1, buy: 3200, weapon: { kind: 'wand', min: 13, max: 18, speed: 0.4, cost: 3, bolt: 'bolt_fire', bspeed: 210, range: 165, burn: true } });
  add('wand_astral', 'Astral Staff', 'weapon', 2000, { stack: 1, buy: 9500, weapon: { kind: 'wand', min: 22, max: 30, speed: 0.36, cost: 3, bolt: 'bolt_player', bspeed: 240, range: 190, pierce: true } });

  // seeds
  const seed = (id, name, buy, crop) => add(id, name, 'seed', Math.floor(buy / 2), { buy, seed: crop });
  seed('seed_moonpetal', 'Moonpetal Seeds', 20, 'moonpetal');
  seed('seed_glowcap', 'Glowcap Spores', 15, 'glowcap');
  seed('seed_mandrake', 'Mandrake Seeds', 45, 'mandrake');
  seed('seed_frostmint', 'Frostmint Seeds', 70, 'frostmint');
  seed('seed_emberroot', 'Emberroot Seeds', 60, 'emberroot');
  seed('seed_duskberry', 'Duskberry Seeds', 90, 'duskberry');
  seed('seed_starbloom', 'Starbloom Seeds', 140, 'starbloom');
  seed('seed_wispvine', 'Wispvine Cutting', 220, 'wispvine');
  seed('seed_phialvine', 'Phial Vine Seeds', 300, 'phialvine');
  seed('seed_starflask', 'Starflask Bulb', 450, 'starflask');

  // crops
  add('moonpetal', 'Moonpetal', 'crop', 45, { eat: { energy: 12 } });
  add('glowcap', 'Glowcap', 'crop', 32, { eat: { energy: 8 } });
  add('mandrake', 'Mandrake Root', 'crop', 110);
  add('frostmint', 'Frostmint', 'crop', 55, { eat: { energy: 16 } });
  add('emberroot', 'Emberroot', 'crop', 150);
  add('duskberry', 'Duskberry', 'crop', 70, { eat: { energy: 22, hp: 4 } });
  add('starbloom', 'Starbloom', 'crop', 360);
  add('wispbloom', 'Wisp Bloom', 'crop', 160);

  // forage
  add('fairycap', 'Fairy Cap', 'forage', 40);
  add('wolfsbane', 'Wolfsbane', 'forage', 50);
  add('moonlily', 'Moon Lily', 'forage', 60);
  add('feather', 'Owl Feather', 'forage', 35);
  add('starshard', 'Starshard', 'forage', 90);
  add('bog_amber', 'Bog Amber', 'forage', 120);
  add('driftwood', 'Driftwood', 'forage', 15);
  add('shell', 'Mooncockle Shell', 'forage', 30);
  add('pearl', 'Moon Pearl', 'forage', 400);
  add('honey', 'Wild Honeycomb', 'forage', 80, { eat: { energy: 40, hp: 10 } });

  // resources / ores / gems
  add('wood', 'Wood', 'resource', 2);
  add('stone', 'Stone', 'resource', 2);
  add('fiber', 'Fiber', 'resource', 1);
  add('ore_glimmer', 'Glimmer Ore', 'ore', 8);
  add('ore_shadow', 'Shadowiron Ore', 'ore', 18);
  add('ore_starsilver', 'Starsilver Ore', 'ore', 40);
  add('amethyst', 'Amethyst', 'gem', 90);
  add('emerald', 'Emerald', 'gem', 160);
  add('moonstone', 'Moonstone', 'gem', 240);
  add('quartz', 'Arcane Quartz', 'gem', 60);
  add('voidcrystal', 'Void Crystal', 'gem', 380);

  // monster loot
  add('slime_gel', 'Slime Gel', 'loot', 8);
  add('bat_wing', 'Bat Wing', 'loot', 14);
  add('spider_silk', 'Spider Silk', 'loot', 20);
  add('bone_dust', 'Bone Dust', 'loot', 16);
  add('ectoplasm', 'Ectoplasm', 'loot', 45);
  add('arcane_dust', 'Arcane Dust', 'loot', 35);
  add('golem_core', 'Golem Core', 'loot', 120);
  add('void_essence', 'Void Essence', 'loot', 90);
  add('spore_sac', 'Spore Sac', 'loot', 18);

  // fish
  add('fish_glimmerfin', 'Glimmerfin', 'fish', 40, { fish: { diff: 0.25, motion: 'smooth', w: 40 } });
  add('fish_mooncarp', 'Moon Carp', 'fish', 75, { fish: { diff: 0.4, motion: 'mixed', w: 26 } });
  add('fish_mistperch', 'Mistperch', 'fish', 95, { fish: { diff: 0.45, motion: 'dart', w: 14, weather: ['rain', 'mist'] } });
  add('fish_ghosteel', 'Ghost Eel', 'fish', 160, { fish: { diff: 0.6, motion: 'sinker', w: 12, night: true } });
  add('fish_lanternpike', 'Lantern Pike', 'fish', 260, { fish: { diff: 0.7, motion: 'dart', w: 6, night: true } });
  add('fish_crownjaw', 'Crownjaw', 'fish', 1200, { fish: { diff: 0.9, motion: 'dart', w: 1.2, moon: 'full' } });

  // potions
  const pot = (id, name, sell, use) => add(id, name, 'potion', sell, { use });
  pot('pot_healing', 'Healing Draught', 120, { hp: 50 });
  pot('pot_vigor', 'Vigor Tonic', 130, { energy: 60 });
  pot('pot_fairy', 'Fairy Draught', 95, { hp: 30, energy: 30 });
  pot('pot_swift', 'Swiftstep Brew', 240, { buff: 'swift', secs: 180 });
  pot('pot_ember', 'Emberheart Elixir', 280, { buff: 'ember', secs: 180 });
  pot('pot_frostward', 'Frostward Philter', 300, { buff: 'ward', secs: 180 });
  pot('pot_tide', 'Tidecaller Tonic', 240, { buff: 'tide', secs: 99999 });
  pot('pot_mandrake', 'Mandrake Restorative', 450, { hp: 999, energy: 999 });
  pot('pot_shadow', 'Shadowveil Draught', 520, { buff: 'veil', secs: 45 });
  pot('pot_starlight', 'Starlight Philter', 900, { buff: 'luck', secs: 99999 });
  pot('pot_moon', 'Elixir of the Moon', 2200, { maxhp: 10 });
  add('sludge', 'Murky Sludge', 'potion', 1, { use: { hp: -5, energy: 5 } });

  // food
  const food = (id, name, buy, eat) => add(id, name, 'food', Math.floor(buy / 3), { buy, eat });
  food('food_bread', 'Lavender Loaf', 45, { energy: 32 });
  food('food_stew', 'Hearty Mushroom Stew', 150, { energy: 70, hp: 35 });
  food('food_pie', 'Duskberry Pie', 170, { energy: 90, hp: 10 });
  food('food_mead', 'Honeymoon Mead', 95, { energy: 42, hp: 15 });
  food('food_tea', 'Starleaf Tea', 60, { energy: 30, buff: 'swift', secs: 40 });
  food('food_coffee', 'Midnight Brew', 75, { energy: 36, buff: 'swift', secs: 60 });

  // placeables
  add('cauldron', 'Copper Cauldron', 'place', 200, { buy: 900, place: 'cauldron' });
  add('dewcrystal', 'Dew Crystal', 'place', 150, { buy: 600, place: 'dewcrystal' });
  add('chest', 'Storage Chest', 'place', 30, { buy: 150, place: 'chest' });
  add('moonmulch', 'Moonmulch', 'misc', 5, { buy: 30, fert: true });
  add('letter', 'Letter', 'misc', 0, { stack: 1 });

  // recipe scrolls (sold by Orvyn) — using one teaches the recipe
  const RECIPES = (G.RECIPES = [
    { id: 'pot_healing', ing: ['moonpetal', 'moonpetal'], time: 120 },
    { id: 'pot_vigor', ing: ['glowcap', 'frostmint'], time: 120 },
    { id: 'pot_fairy', ing: ['fairycap', 'wolfsbane'], time: 90 },
    { id: 'pot_swift', ing: ['duskberry', 'spider_silk'], time: 180 },
    { id: 'pot_ember', ing: ['emberroot', 'slime_gel'], time: 180 },
    { id: 'pot_frostward', ing: ['frostmint', 'amethyst'], time: 180 },
    { id: 'pot_tide', ing: ['fish_mooncarp', 'moonlily'], time: 150 },
    { id: 'pot_mandrake', ing: ['mandrake', 'moonpetal', 'glowcap'], time: 240 },
    { id: 'pot_shadow', ing: ['duskberry', 'bat_wing', 'ectoplasm'], time: 240 },
    { id: 'pot_starlight', ing: ['starbloom', 'moonpetal', 'starshard'], time: 360 },
    { id: 'pot_moon', ing: ['wispbloom', 'starbloom', 'moonstone'], time: 600 },
  ]);
  for (const r of RECIPES) add('scroll_' + r.id, 'Recipe: ' + I[r.id].name, 'misc', 0, { stack: 1, scroll: r.id, iconOf: 'letter' });
  G.findRecipe = function (ids) {
    const key = ids.slice().sort().join('+');
    return RECIPES.find((r) => r.ing.slice().sort().join('+') === key) || null;
  };

  G.ITEMS = I;
  G.item = (id) => I[id] || { id, name: id, cat: 'misc', sell: 0, stack: 999 };

  // ---------------------------------------------------------------- crops
  G.CROPS = {
    moonpetal: { seed: 'seed_moonpetal', days: 4, item: 'moonpetal', qty: [1, 1], bonus: 0.12, glow: [200, 215, 255] },
    glowcap: { seed: 'seed_glowcap', days: 3, item: 'glowcap', qty: [1, 2], glow: [93, 255, 208] },
    mandrake: { seed: 'seed_mandrake', days: 6, item: 'mandrake', qty: [1, 1], scream: true },
    frostmint: { seed: 'seed_frostmint', days: 5, regrow: 3, item: 'frostmint', qty: [1, 2], glow: [170, 230, 255] },
    emberroot: { seed: 'seed_emberroot', days: 7, item: 'emberroot', qty: [1, 1], glow: [255, 150, 70] },
    duskberry: { seed: 'seed_duskberry', days: 8, regrow: 4, item: 'duskberry', qty: [2, 3] },
    starbloom: { seed: 'seed_starbloom', days: 10, item: 'starbloom', qty: [1, 1], glow: [255, 220, 120] },
    wispvine: { seed: 'seed_wispvine', days: 9, regrow: 3, item: 'wispbloom', qty: [1, 2], trellis: true, glow: [180, 255, 240] },
    phialvine: { seed: 'seed_phialvine', days: 8, regrow: 4, item: 'pot_healing', qty: [1, 2], trellis: true, glow: [255, 110, 120] },
    starflask: { seed: 'seed_starflask', days: 10, regrow: 5, item: 'pot_vigor', qty: [2, 2], trellis: true, glow: [120, 255, 160] },
  };

  // ---------------------------------------------------------------- shops
  // stock: [id, price?, cond?]  buys: categories bought (multiplier)
  G.SHOPS = {
    mirabel: {
      title: "Thornwick's Seeds & Sundries",
      stock: [['seed_moonpetal'], ['seed_glowcap'], ['seed_mandrake'], ['seed_frostmint'], ['seed_emberroot', null, (s) => s.day >= 3], ['seed_duskberry', null, (s) => s.day >= 5], ['seed_starbloom', null, (s) => s.day >= 9 || s.flags.altar1], ['moonmulch'], ['food_bread'], ['food_tea'], ['chest']],
      buys: { crop: 1, forage: 1, seed: 1 },
    },
    sable: { title: 'The Gilded Owl', stock: [['food_bread'], ['food_mead'], ['food_stew'], ['food_pie'], ['food_coffee'], ['food_tea']], buys: { fish: 1, food: 1, crop: 0.9 } },
    brann: { title: 'Starfall Forge', stock: [['cauldron'], ['dewcrystal'], ['sword_silver', 1100], ['chest']], buys: { ore: 1, gem: 1, resource: 1 }, upgrades: true },
    corvin: {
      title: "Delvers' Lodge",
      stock: [['wand_apprentice'], ['sword_silver'], ['food_coffee'], ['pot_healing', 260], ['wand_ember', null, (s) => s.maxDepth >= 15], ['sword_star', null, (s) => s.maxDepth >= 20], ['wand_astral', null, (s) => s.maxDepth >= 35], ['sword_umbral', null, (s) => s.maxDepth >= 40]],
      buys: { loot: 1, gem: 0.9, ore: 0.9 },
    },
    grizelda: {
      title: "Grizelda's Curios",
      stock: [['seed_mandrake', 40], ['seed_wispvine'], ['seed_phialvine'], ['seed_starflask', null, (s) => s.day >= 6], ['scroll_pot_shadow', 1400], ['moonstone', 900], ['spider_silk', 60], ['ectoplasm', 120]],
      buys: { potion: 1.15, loot: 1.1, forage: 0.9 },
    },
    lune: { title: "Lune's Bait & Tackle", stock: [['rod'], ['food_mead', 110]], buys: { fish: 1.1, forage: 0.8 } },
    orvyn: {
      title: 'The Observatory',
      stock: [['scroll_pot_swift', 600], ['scroll_pot_ember', 700], ['scroll_pot_frostward', 800], ['scroll_pot_tide', 650], ['scroll_pot_mandrake', 1200], ['scroll_pot_starlight', 2600, (s) => s.maxDepth >= 10 || s.flags.altar2], ['scroll_pot_moon', 5000, (s) => s.flags.altar4]],
      buys: { gem: 1.05, forage: 0.7 },
    },
  };

  // tool upgrades (Brann): tier -> {price, ore, qty}
  G.UPGRADES = [null, { price: 500, ore: 'ore_glimmer', qty: 10, name: 'Glimmer' }, { price: 2000, ore: 'ore_shadow', qty: 10, name: 'Shadowiron' }, { price: 6000, ore: 'ore_starsilver', qty: 10, name: 'Starsilver' }];

  // ---------------------------------------------------------------- altar offerings
  G.BUNDLES = [
    { id: 'garden', name: "The Gardener's Offering", items: [['moonpetal', 5], ['glowcap', 5], ['mandrake', 3], ['frostmint', 3]], reward: 'The garden grows: 2 Dew Crystals, and the soil beyond the walls wakes.' },
    { id: 'forage', name: "The Wanderer's Offering", items: [['fairycap', 3], ['wolfsbane', 3], ['moonlily', 2], ['feather', 2], ['starshard', 2]], reward: 'The reflecting pool fills, 25 Moonmulch, and Inkwell finds you a gift.' },
    { id: 'delver', name: "The Delver's Offering", items: [['slime_gel', 10], ['bat_wing', 5], ['spider_silk', 5], ['amethyst', 3], ['ore_glimmer', 10]], reward: 'The braziers relight: +25 max health and a Silverthorn Saber.' },
    { id: 'alchemy', name: "The Alchemist's Offering", items: [['pot_healing', 3], ['pot_vigor', 3], ['pot_ember', 1], ['pot_swift', 1]], reward: 'The goddess is restored: two Copper Cauldrons and +40 max energy.' },
    { id: 'angler', name: "The Angler's Offering", items: [['fish_glimmerfin', 3], ['fish_mooncarp', 2], ['fish_mistperch', 1], ['fish_ghosteel', 1]], reward: 'The moon answers: the Tidecaller recipe and 5,000 glimmer.' },
  ];

  // ---------------------------------------------------------------- monsters
  G.MOBS = {
    slime: { hp: 20, dmg: 6, speed: 32, ai: 'hop', drops: [['slime_gel', 0.85, 1, 2]], xp: 3 },
    bat: { hp: 13, dmg: 5, speed: 52, ai: 'bat', fly: true, drops: [['bat_wing', 0.6, 1, 1]], xp: 3 },
    shroomling: { hp: 26, dmg: 7, speed: 24, ai: 'shroom', drops: [['spore_sac', 0.6, 1, 2], ['glowcap', 0.25, 1, 1]], xp: 4 },
    spider: { hp: 24, dmg: 8, speed: 58, ai: 'spider', drops: [['spider_silk', 0.75, 1, 2]], xp: 5 },
    broodmother: { hp: 260, dmg: 14, speed: 22, ai: 'brood', drops: [['spider_silk', 1, 4, 7], ['emerald', 0.6, 1, 2]], xp: 40, big: true },
    skeleton: { hp: 38, dmg: 10, speed: 30, ai: 'melee', drops: [['bone_dust', 0.7, 1, 2]], xp: 6 },
    golem: { hp: 85, dmg: 15, speed: 16, ai: 'golem', drops: [['golem_core', 0.4, 1, 1], ['amethyst', 0.3, 1, 1], ['stone', 1, 2, 4]], xp: 10 },
    hexmage: { hp: 46, dmg: 12, speed: 34, ai: 'caster', drops: [['arcane_dust', 0.7, 1, 2], ['quartz', 0.2, 1, 1]], xp: 9 },
    wraith: { hp: 52, dmg: 13, speed: 36, ai: 'wraith', ghost: true, drops: [['ectoplasm', 0.7, 1, 1]], xp: 10 },
    voideye: { hp: 36, dmg: 12, speed: 28, ai: 'eye', fly: true, drops: [['void_essence', 0.5, 1, 1]], xp: 10 },
    archon: { hp: 1700, dmg: 22, speed: 30, ai: 'archon', drops: [['voidcrystal', 1, 3, 5], ['moonstone', 1, 2, 3]], xp: 200, big: true, boss: true },
  };
})();
