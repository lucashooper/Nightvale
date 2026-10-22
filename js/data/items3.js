// Nightvale — round three data: geodes and the 24 Cabinet minerals, blueprints and crafted things, pets and
// mounts, romance and guild items, the new monsters and bosses, Guild contracts, geode tables, and the shops of
// the south quarter (Ronan, Caspian), Jasmine's honey stall and the Night Merchant.
(function () {
  'use strict';
  const G = window.G, I = G.ITEMS;
  const add = (id, name, cat, sell, o) => (I[id] = Object.assign({ id, name, cat, sell, stack: 999 }, o || {}));

  // ---------------------------------------------------------------- geodes & minerals (Ronan cracks geodes)
  add('geode_moon', 'Moon Geode', 'geode', 30, { geode: true });
  add('geode_ember', 'Ember Geode', 'geode', 60, { geode: true });
  add('geode_void', 'Void Geode', 'geode', 110, { geode: true });
  add('geode_star', 'Star Geode', 'geode', 180, { geode: true });
  const MINERALS = {
    geode_moon: [['min_lunarite', 'Lunarite', 60], ['min_moonglass', 'Moonglass', 70], ['min_silvervein', 'Silvervein', 80], ['min_moth_fossil', 'Moth Fossil', 130], ['min_tidestone', 'Tidestone', 90], ['min_crescent_agate', 'Crescent Agate', 150]],
    geode_ember: [['min_emberstone', 'Emberstone', 110], ['min_phoenix_tear', 'Phoenix Tear', 280], ['min_lava_opal', 'Lava Opal', 210], ['min_salamander_fossil', 'Salamander Fossil', 230], ['min_cinnabar', 'Cinnabar', 150], ['min_smokequartz', 'Smoke Quartz', 120]],
    geode_void: [['min_void_eye', 'Void Eye', 320], ['min_obsidian', 'Obsidian', 180], ['min_nightglass', 'Nightglass', 230], ['min_ammonite', 'Ammonite', 270], ['min_wraith_opal', 'Wraith Opal', 350], ['min_hollow_heart', 'Hollow Heart', 420]],
    geode_star: [['min_starheart', 'Starheart', 460], ['min_comet_glass', 'Comet Glass', 390], ['min_meteorite', 'Meteorite', 370], ['min_celestite', 'Celestite', 330], ['min_aurora', 'Aurora Stone', 430], ['min_wishing_stone', 'Wishing Stone', 520]],
  };
  for (const g in MINERALS) for (const [id, name, sell] of MINERALS[g]) add(id, name, 'mineral', sell, { from: g });
  G.MINERALS = MINERALS;
  G.MINERAL_IDS = Object.values(MINERALS).flat().map((m) => m[0]);
  // what's inside: minerals (weighted toward ones you haven't found), plus ores, gems and the odd surprise
  G.GEODES = {
    geode_moon: { fee: 25, minChance: 0.5, other: [['ore_glimmer', 4, 2, 5], ['quartz', 3, 1, 2], ['amethyst', 2, 1, 1], ['stone', 2, 3, 6], ['moonstone', 0.5, 1, 1]] },
    geode_ember: { fee: 50, minChance: 0.5, other: [['ore_shadow', 4, 2, 4], ['emerald', 2, 1, 1], ['amethyst', 2, 1, 2], ['golem_core', 0.6, 1, 1]] },
    geode_void: { fee: 90, minChance: 0.55, other: [['ore_starsilver', 4, 2, 3], ['voidcrystal', 2, 1, 1], ['moonstone', 2, 1, 1], ['void_essence', 1.5, 1, 2]] },
    geode_star: { fee: 150, minChance: 0.65, other: [['starshard', 3, 2, 4], ['moonstone', 2, 1, 2], ['relic_star', 0.6, 1, 1], ['pearl', 1, 1, 1]] },
  };
  // Collection Cabinet milestones (minerals donated)
  G.CABINET_MILESTONES = [[3, { gold: 300 }], [6, { item: 'lucky_rune' }], [10, { item: 'geode_hammer' }], [14, { furn: 'furn_mineral_cabinet' }], [18, { item: 'pet_crystalfox' }], [24, { item: 'sword_starforged', title: "Runesmith's Friend" }]];

  // ---------------------------------------------------------------- blueprints & crafting
  const BP = [['bp_sprinkler', 'dew_sprinkler', 'Dew Sprinkler'], ['bp_warp', 'warp_rune', 'Warp Rune'], ['bp_charm', 'lucky_charm', 'Lucky Charm'], ['bp_lamp', 'furn_crystal_lamp', 'Crystal Lamp'],
    ['bp_hammer', 'geode_hammer', 'Geode Hammer'], ['bp_scarecrow', 'moon_scarecrow', 'Moon-Scarecrow'], ['bp_saddle', 'saddle_swift', 'Saddle of Swiftness'], ['bp_trophy', 'furn_trophy_case', 'Bounty Trophy Case']];
  for (const [id, makes, name] of BP) add(id, 'Blueprint: ' + name, 'misc', 0, { stack: 1, bp: makes });
  G.BLUEPRINTS = BP.map((b) => b[0]);
  add('dew_sprinkler', 'Dew Sprinkler', 'place', 150, { place: 'sprinkler' });
  add('moon_scarecrow', 'Moon-Scarecrow', 'place', 120, { place: 'scarecrow' });
  add('warp_rune', 'Warp Rune', 'misc', 40, { use: { warp: true } });
  add('lucky_charm', 'Lucky Charm', 'misc', 60, { use: { stat: { luck: 2 }, until: 1560 } });
  add('lucky_rune', 'Lucky Rune', 'relic', 0, { stack: 1, use: { permLuck: 1 } });
  add('geode_hammer', 'Geode Hammer', 'tool', 0, { stack: 1, tool: 'geodehammer' });
  // recipes: blueprint -> ingredients (crafted in the satchel's Crafting tab). Furniture outputs are FurnitureArt
  // pieces registered by decorate.js; a recipe whose output isn't registered yet stays hidden.
  G.CRAFT = {
    dew_sprinkler: { bp: 'bp_sprinkler', needs: [['ore_shadow', 3], ['quartz', 1], ['slime_gel', 4]] },
    warp_rune: { bp: 'bp_warp', needs: [['arcane_dust', 2], ['moonpetal', 2], ['stone', 5]], n: 2 },
    lucky_charm: { bp: 'bp_charm', needs: [['relic_coin', 1], ['feather', 2], ['fiber', 5]] },
    furn_crystal_lamp: { bp: 'bp_lamp', needs: [['ore_glimmer', 4], ['wisp_essence', 1], ['wood', 10]] },
    geode_hammer: { bp: 'bp_hammer', needs: [['ore_starsilver', 3], ['wood', 15], ['golem_core', 1]] },
    moon_scarecrow: { bp: 'bp_scarecrow', needs: [['wood', 20], ['fiber', 15], ['moonpetal', 3]] },
    saddle_swift: { bp: 'bp_saddle', needs: [['wolf_fang', 3], ['spider_silk', 6], ['ore_shadow', 2]] },
    furn_trophy_case: { bp: 'bp_trophy', needs: [['wood', 25], ['ore_glimmer', 5], ['amethyst', 1]] },
  };

  // ---------------------------------------------------------------- pets & mounts (Drake's Menagerie)
  const pet = (id, name, buy) => add(id, name, 'pet', 0, { stack: 1, buy, pet: id });
  pet('pet_kitten', 'Moon Kitten', 2500); pet('pet_puppy', 'Shadow Pup', 2500); pet('pet_bunny', 'Lop Bunny', 2000);
  pet('pet_hatchling', 'Dragon Hatchling', 9000); pet('pet_crystalfox', 'Crystal Fox', 0);
  const mount = (id, name, buy, kind) => add(id, name, 'mount', 0, { stack: 1, buy, mount: id, kind });
  mount('horse_midnight', 'Midnight Horse', 5000, 'horse'); mount('horse_silver', 'Silver Dapple Horse', 5000, 'horse'); mount('horse_chestnut', 'Chestnut Horse', 5000, 'horse');
  mount('dragon_amethyst', 'Amethyst Dragon', 18000, 'dragon'); mount('dragon_emerald', 'Emerald Dragon', 18000, 'dragon'); mount('dragon_ember', 'Ember Dragon', 18000, 'dragon');
  add('pet_treat', 'Pet Treats', 'misc', 15, { buy: 60 });
  add('pet_toy', 'Squeaky Moon Toy', 'misc', 60, { buy: 250, stack: 1 });
  add('saddle_swift', 'Saddle of Swiftness', 'gear', 600, { buy: 2500, stack: 1, gear: { speed: 0.15 } });
  add('saddle_starlit', 'Starlit Saddle', 'gear', 1500, { buy: 6000, stack: 1, gear: { speed: 0.3 } });
  add('dragon_harness', 'Dragon Harness', 'gear', 2200, { buy: 9000, stack: 1, gear: { fly: 1 } });
  add('silver_whistle', 'Silver Whistle', 'gear', 400, { buy: 1500, stack: 1, gear: { whistle: 1 } });

  // ---------------------------------------------------------------- romance & the Guild
  add('bouquet', 'Moonflower Bouquet', 'misc', 50, { buy: 400, stack: 1, romance: 'bouquet' });
  add('pendant', 'Moonstone Pendant', 'misc', 500, { buy: 5000, stack: 1, romance: 'pendant' });
  add('contract', 'Guild Contract', 'misc', 0, { stack: 1 });
  for (const [k, n] of [[1, 'Copper'], [2, 'Silver'], [3, 'Gold'], [4, 'Moonsteel']]) add('guild_badge_' + k, n + ' Guild Badge', 'relic', 0, { stack: 1, badge: k });
  for (const [id, name] of [['trophy_gloopgarr', "Gloopgarr's Dented Crown"], ['trophy_grimjaw', "Grimjaw's Pelt"], ['trophy_lantern', 'The Stolen Lantern'], ['trophy_wyrm', "Vorrakh's Crystal Fang"]]) add(id, name, 'relic', 400, { stack: 1, trophy: true });
  add('lore_page', 'Torn Lore Page', 'misc', 0);
  add('sword_starforged', 'Starforged Blade', 'weapon', 4000, { stack: 1, weapon: { kind: 'sword', min: 34, max: 46, speed: 0.28, reach: 26, crit: 0.14 } });
  add('mystery_box', 'Mystery Box', 'misc', 0, { buy: 1500, use: { mystery: true } });
  add('cl_cloak_starweave', 'Starweave Cloak', 'clothing', 900, { buy: 3600, wear: 'cloak', stack: 1 });

  // ---------------------------------------------------------------- monsters & bosses
  Object.assign(G.MOBS, {
    slime_ogre: { hp: 450, dmg: 14, speed: 20, ai: 'ogre', drops: [['slime_gel', 1, 6, 10], ['emerald', 0.6, 1, 2]], xp: 60, big: true, boss: true, split: 'slime_med', splitN: 3 },
    slime_med: { hp: 34, dmg: 8, speed: 48, ai: 'hop', drops: [['slime_gel', 0.6, 1, 2]], xp: 4, split: 'slime_small' },
    slime_small: { hp: 12, dmg: 5, speed: 70, ai: 'hop', drops: [['slime_gel', 0.25, 1, 1]], xp: 2 },
    grimjaw: { hp: 520, dmg: 16, speed: 70, ai: 'alpha', drops: [['wolf_fang', 1, 3, 5], ['moonstone', 0.7, 1, 1]], xp: 70, big: true, boss: true },
    lantern_thief: { hp: 300, dmg: 12, speed: 60, ai: 'wispking', fly: true, drops: [['wisp_essence', 1, 3, 5], ['pearl', 0.5, 1, 1]], xp: 55, big: true, boss: true },
    deep_wyrm: { hp: 1400, dmg: 22, speed: 38, ai: 'wyrm', drops: [['voidcrystal', 1, 2, 4], ['moonstone', 1, 1, 3], ['geode_star', 1, 1, 2]], xp: 200, big: true, boss: true },
    ink_bat: { hp: 16, dmg: 6, speed: 66, ai: 'bat', fly: true, drops: [['lore_page', 0.15, 1, 1], ['arcane_dust', 0.4, 1, 1]], xp: 4 },
  });
  // how hard the named bosses are (Settings could expose this; the default is Balanced)
  G.BOSS_TUNING = { gentle: { hp: 0.67, dmg: 0.7, shed: 4 }, balanced: { hp: 1, dmg: 1, shed: 8 }, tough: { hp: 1.45, dmg: 1.3, shed: 12 } };

  // ---------------------------------------------------------------- Guild contracts
  // kind: hunt (slay n of a mob type), gather (bring n of an item), bounty (a named boss).
  // sk = skulls (1–5), rank = minimum guild rank (0 copper, 1 silver, 2 gold, 3 moonsteel)
  G.CONTRACTS = {
    hunt_slimes: { kind: 'hunt', target: ['slime', 'bogling', 'slime_med', 'slime_small'], n: [10, 14], sk: 1, rw: 260, rp: 12, rank: 0, icon: 'slime_gel' },
    hunt_bats: { kind: 'hunt', target: ['bat', 'ink_bat'], n: [8, 12], sk: 1, rw: 300, rp: 12, rank: 0, icon: 'bat_wing' },
    hunt_thornlings: { kind: 'hunt', target: ['thornling'], n: [6, 9], sk: 1, rw: 320, rp: 14, rank: 0, icon: 'thorn_bramble' },
    hunt_mosswolves: { kind: 'hunt', target: ['mosswolf'], n: [4, 6], sk: 2, rw: 720, rp: 26, rank: 0, icon: 'wolf_fang' },
    hunt_webweavers: { kind: 'hunt', target: ['webweaver'], n: [4, 6], sk: 2, rw: 760, rp: 28, rank: 1, icon: 'spider_silk' },
    hunt_spiders: { kind: 'hunt', target: ['spider'], n: [8, 12], sk: 2, rw: 600, rp: 22, rank: 0, icon: 'spider_silk' },
    hunt_skeletons: { kind: 'hunt', target: ['skeleton'], n: [6, 9], sk: 2, rw: 820, rp: 30, rank: 1, icon: 'bone_dust' },
    hunt_wisps: { kind: 'hunt', target: ['wisp'], n: [5, 8], sk: 1, rw: 420, rp: 16, rank: 0, icon: 'wisp_essence' },
    hunt_gloombeetles: { kind: 'hunt', target: ['gloombeetle', 'hornbeetle'], n: [4, 6], sk: 3, rw: 1100, rp: 40, rank: 1, icon: 'arcane_dust' },
    hunt_boglings: { kind: 'hunt', target: ['bogling'], n: [6, 9], sk: 1, rw: 340, rp: 14, rank: 0, icon: 'bog_amber' },
    gather_silk: { kind: 'gather', target: 'spider_silk', n: [8, 12], sk: 1, rw: 380, rp: 12, rank: 0, icon: 'spider_silk' },
    gather_wisp: { kind: 'gather', target: 'wisp_essence', n: [3, 5], sk: 2, rw: 560, rp: 18, rank: 0, icon: 'wisp_essence' },
    gather_amethyst: { kind: 'gather', target: 'amethyst', n: [3, 5], sk: 2, rw: 640, rp: 20, rank: 0, icon: 'amethyst' },
    gather_healing: { kind: 'gather', target: 'pot_healing', n: [3, 4], sk: 1, rw: 520, rp: 16, rank: 0, icon: 'pot_healing' },
    gather_frostmint: { kind: 'gather', target: 'frostmint', n: [10, 15], sk: 1, rw: 480, rp: 14, rank: 0, icon: 'frostmint' },
    gather_mooncarp: { kind: 'gather', target: 'fish_mooncarp', n: [3, 5], sk: 1, rw: 420, rp: 14, rank: 0, icon: 'fish_mooncarp' },
    gather_bog_amber: { kind: 'gather', target: 'bog_amber', n: [2, 3], sk: 3, rw: 900, rp: 30, rank: 1, icon: 'bog_amber' },
    gather_bone_dust: { kind: 'gather', target: 'bone_dust', n: [10, 14], sk: 2, rw: 560, rp: 18, rank: 0, icon: 'bone_dust' },
    bounty_gloopgarr: { kind: 'bounty', target: 'slime_ogre', n: [1, 1], sk: 3, rw: 1800, rp: 70, rank: 0, icon: 'trophy_gloopgarr', trophy: 'trophy_gloopgarr', where: 'woods' },
    bounty_lantern: { kind: 'bounty', target: 'lantern_thief', n: [1, 1], sk: 2, rw: 1300, rp: 50, rank: 0, icon: 'trophy_lantern', trophy: 'trophy_lantern', where: 'lake' },
    bounty_grimjaw: { kind: 'bounty', target: 'grimjaw', n: [1, 1], sk: 3, rw: 2600, rp: 90, rank: 1, icon: 'trophy_grimjaw', trophy: 'trophy_grimjaw', where: 'deepwood' },
    bounty_wyrm: { kind: 'bounty', target: 'deep_wyrm', n: [1, 1], sk: 5, rw: 6000, rp: 220, rank: 2, icon: 'trophy_wyrm', trophy: 'trophy_wyrm', where: 'depths', floor: 20 },
  };
  G.GUILD_RANKS = [{ name: 'Copper', pts: 0 }, { name: 'Silver', pts: 250 }, { name: 'Gold', pts: 800 }, { name: 'Moonsteel', pts: 2000 }];

  // ---------------------------------------------------------------- shops
  const S = G.SHOPS;
  S.ronan = {
    title: 'Ashvale Runesmithy',
    stock: [['geode_moon', 90], ['ore_glimmer', 30], ['ore_shadow', 70], ['ore_starsilver', 160, (s) => s.maxDepth >= 15], ['pendant', null, (s) => s.day >= 3], ['sword_star', 4600, (s) => s.maxDepth >= 10]],
    buys: { ore: 1, gem: 1, mineral: 1, geode: 1, relic: 0.8, loot: 0.6 },
    geodes: true,
  };
  S.caspian = {
    title: "Drake's Menagerie & Stables",
    stock: [['pet_kitten'], ['pet_puppy'], ['pet_bunny'], ['pet_hatchling', null, (s) => (s.guild && s.guild.rank >= 1)], ['pet_treat'], ['pet_toy'],
      ['horse_midnight'], ['horse_silver'], ['horse_chestnut'], ['dragon_amethyst', null, (s) => (s.guild && s.guild.rank >= 1)], ['dragon_emerald', null, (s) => (s.guild && s.guild.rank >= 1)], ['dragon_ember', null, (s) => (s.guild && s.guild.rank >= 1)],
      ['saddle_swift'], ['saddle_starlit', null, (s) => s.mounts && s.mounts.length > 0], ['dragon_harness', null, (s) => s.mounts && s.mounts.some((m) => G.item(m).kind === 'dragon')], ['silver_whistle']],
    buys: { forage: 1, crop: 0.8, fish: 0.8 },
  };
  S.mirabel.stock.push(['bouquet', null, (s) => G.NPCs && G.NPCs.anyHearts && G.NPCs.anyHearts(8)]);
  S.jasmine = {
    title: "Jasmine's Honey Stall",
    stock: [['honey', 200], ['food_honeycake'], ['snack_sweets'], ['moonlily', 160], ['bouquet', null, (s) => G.NPCs && G.NPCs.anyHearts && G.NPCs.anyHearts(8)]],
    buys: { forage: 1, crop: 1 },
  };
  // the Night Merchant's stock rotates every visit (filled in by the Night Market system)
  S.nightmerchant = { title: 'The Night Market', stockFn: (s) => (G.NightMarket ? G.NightMarket.stock(s) : []), buys: { relic: 1.1, gem: 1.1, mineral: 1.1 } };
})();
