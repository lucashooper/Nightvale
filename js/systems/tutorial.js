// Nightvale — first-day tutorial (step cards + a bouncing arrow in the world) and the Field Guide.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const T = (G.Tutorial = {});

  const slotKey = (id) => {
    const i = G.S.inv.findIndex((s) => s && s.id === id);
    if (i < 0 || i > 11) return null;
    return i < 9 ? String(i + 1) : i === 9 ? '0' : i === 10 ? '-' : '=';
  };
  const key = (k) => `<span class="key">${k}</span>`;
  const anyFarm = () => G.World.maps.sanctum && G.World.maps.sanctum.farm.size > 0;
  const anyCrop = () => { for (const f of G.World.maps.sanctum.farm.values()) if (f.crop) return true; return false; };
  const anyWatered = () => { for (const f of G.World.maps.sanctum.farm.values()) if (f.crop && f.watered) return true; return false; };
  const holding = (id) => { const s = G.Inv.selected(); return s && s.id === id; };

  T.STARTER = [12, 23, 5, 5]; // the clear seedbed in the garden's north-west corner

  const STEPS = [
    {
      id: 'hoe',
      text: () => `Hold your ${key(slotKey('hoe') || '1')} <b>Rune Hoe</b>. Press the number key, or click its slot in the hotbar.`,
      done: () => holding('hoe') || anyFarm(),
    },
    {
      id: 'till',
      text: () => `Walk to the cleared soil in the walled garden (follow the arrow). Face it and press ${key('Space')}, or click the soil, to till it.`,
      done: () => anyFarm(),
      target: { map: 'sanctum', x: 14.5, y: 24.5 },
    },
    {
      id: 'plant',
      text: () => `Hold your ${key(slotKey('seed_moonpetal') || slotKey('seed_glowcap') || '6')} <b>seeds</b> and click the tilled soil (or press ${key('Space')}) to plant them.`,
      done: () => anyCrop(),
      target: { map: 'sanctum', x: 14.5, y: 24.5 },
    },
    {
      id: 'water',
      text: () => `Hold the ${key(slotKey('can') || '2')} <b>Dew Can</b> and water your seeds. When it runs dry, refill it at the pond or the well.`,
      done: () => anyWatered(),
      target: { map: 'sanctum', x: 14.5, y: 24.5 },
    },
    {
      id: 'explore',
      text: () => `Crops grow overnight; water them each morning. Now head east to <b>Hollowmere</b> to meet the villagers. Sleep in your cottage when you're tired.`,
      done: () => G.S.flags.visited_village,
      target: { map: 'sanctum', x: 46.5, y: 27.5 },
    },
  ];

  T.active = () => G.S && !G.S.flags.tutorialDone && !G.S.flags.tutorialSkipped;
  T.current = function () {
    if (!T.active()) return null;
    for (const s of STEPS) if (!s.done()) return s;
    G.S.flags.tutorialDone = true;
    G.UI.toast(`Tutorial complete. Press ${key('H')} any time for the Field Guide.`);
    G.sfx('quest_complete', { volume: 0.5 });
    return null;
  };
  T.skip = () => { G.S.flags.tutorialSkipped = true; G.UI.toast(`Tutorial skipped. Press ${key('H')} for the Field Guide whenever you need it.`); };
  T.restart = () => { G.S.flags.tutorialSkipped = false; G.S.flags.tutorialDone = false; };

  // world arrow (drawn by the world overlay)
  T.drawArrow = function (ctx, ox, oy) {
    const s = T.current();
    if (!s || !s.target || G.World.map.id !== s.target.map) return;
    const t = G.R.time, x = Math.round(s.target.x * 16 + ox), y = Math.round(s.target.y * 16 + oy - 22 + Math.sin(t * 4) * 3);
    ctx.fillStyle = '#120c1c';
    ctx.fillRect(x - 4, y - 7, 9, 6); ctx.fillRect(x - 6, y - 2, 13, 2); ctx.fillRect(x - 4, y, 9, 2); ctx.fillRect(x - 2, y + 2, 5, 2); ctx.fillRect(x - 1, y + 4, 3, 1);
    ctx.fillStyle = '#f2c45a';
    ctx.fillRect(x - 3, y - 6, 7, 5); ctx.fillRect(x - 5, y - 1, 11, 1); ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x - 1, y + 1, 3, 2); ctx.fillRect(x, y + 3, 1, 1);
    ctx.fillStyle = '#fff1c8'; ctx.fillRect(x - 3, y - 6, 2, 4);
    // soft ring on the ground
    const a = 0.35 + 0.25 * Math.sin(t * 4);
    ctx.globalAlpha = a; ctx.fillStyle = '#f2c45a';
    const gx = Math.round(s.target.x * 16 + ox), gy = Math.round(s.target.y * 16 + oy + 4);
    for (let k = 0; k < 16; k++) { const ang = (k / 16) * Math.PI * 2; ctx.fillRect(Math.round(gx + Math.cos(ang) * 12), Math.round(gy + Math.sin(ang) * 6), 1, 1); }
    ctx.globalAlpha = 1;
  };
  T.lights = function (out) {
    const s = T.current();
    if (s && s.target && G.World.map.id === s.target.map) out.push({ x: s.target.x * 16, y: s.target.y * 16 - 22, r: 26, color: [242, 196, 90], i: 0.6 });
  };

  // ---------------------------------------------------------------- Field Guide panel
  const FALLBACK = {
    farming: [
      'The dark soil inside the temple garden walls is the only ground you can till at first. Clear weeds, twigs and stones with your sword, axe or pickaxe.',
      'Hold the Rune Hoe and use it on clear soil to till it. Then hold seeds and use them on the tilled tile to plant.',
      'Water every planted tile with the Dew Can each day (rain does it for you). Refill the can at the pond or the well.',
      'Crops grow overnight, and faster under a full moon. When a crop glows, use E on it to harvest.',
    ],
    brewing: ['Use a cauldron and drop in two or three ingredients. Known recipes are listed; unknown mixtures might discover a new one, or make Murky Sludge.', 'Brewing takes a few in-game hours. Collect the potion from the cauldron when it shimmers.'],
    selling: ['Put things in the moon offering box by your cottage: they sell overnight. Shopkeepers also buy what suits their trade (the Sell tab).'],
    villagers: ['Talk to people every day and give them gifts they like (hold the gift, then talk). Hearts unlock scenes and rewards. Check the Villagers tab with I.'],
    depths: ['The Umbral Depths open from the cave on Starfall Ridge. Break rocks for ore and gems and look for the ladder down. Rune Gates every five floors remember your progress.', 'Bring healing potions. If you fall, you wake at the Delvers\' Lodge with a little less glimmer.'],
    fishing: ['Lune at Glimmermere gives you a rod. Face water and use it; when "!" appears, press again, then hold to keep the green bar on the fish.'],
    exploring: ['Odd things turn up around Nightvale: glowing chests, strange shrines, a wandering merchant. Explore every corner, especially beyond Whisperwood.'],
    wonders: [
      'Food and drink. Snacks, meals and tavern drinks can give a short boost: Speed, Luck, Farming, Fishing, Mining, Attack, Defense or Magnetism. You can have one food boost and one drink boost at once; a new one replaces the old. Elvis\'s Stardust Fizz makes you 20% faster for three minutes.',
      'Luck makes forage doubles, extra harvests and better drops more likely, and tips the luck coins your way when something mysterious asks for a roll. Pray once a day at the Veil Altar in the cathedral for a few hours of it.',
      'Clothes. Isolde sells hats, cloaks and outfits at Quillon\'s Threads & Tomes. Use one from your satchel to wear it; take it off again from the Wearing row in your satchel.',
      'Familiars. Find the Bonding Stone in Hushwillow Glade, through the mossy tunnel east of Whisperwood. An owl brings you finds, a fox digs and nips at monsters, a luna moth glows and brings luck. Pet yours every day.',
      'Magic. Reach floor five of the Depths and visit Orvyn. Press Q to cast your chosen spell and Tab to switch. Mana refills slowly, faster with a Mana Draught.',
      'The Lantern Moon. Every full moon, from six until midnight, Hollowmere\'s plaza holds a festival: sky lanterns, potion judging, wisp catching, fortunes, and a dance with a close friend.',
      'Home. Your cottage is yours to arrange. Inside, press G (or Decorate) to move furniture or place new pieces bought around the valley.',
    ],
  };
  const TABS = [['farming', 'Farming'], ['brewing', 'Brewing'], ['selling', 'Selling'], ['villagers', 'Villagers'], ['depths', 'The Depths'], ['fishing', 'Fishing'], ['exploring', 'Exploring'], ['wonders', 'Wonders']];
  G.UI.panels.guide = function (panel, m) {
    const UI = G.UI, el = UI.el;
    m.tab = m.tab || m.data.tab || 'farming';
    m.closeKeys = ['KeyH'];
    panel.appendChild(UI.closeBtn(m));
    panel.appendChild(el('h2', '', 'Field Guide'));
    panel.appendChild(el('div', 'subtitle', 'Morwenna\'s notes, in her cramped, determined handwriting.'));
    const tabs = el('div', 'tabs');
    for (const [k, label] of TABS) { const t = el('div', 'tab hit' + (m.tab === k ? ' on' : ''), label); t.onclick = () => { m.tab = k; m.rerender(); }; tabs.appendChild(t); }
    panel.appendChild(tabs);
    const body = el('div', 'body');
    const pages = (window.GAMETEXT && GAMETEXT.guide && GAMETEXT.guide[m.tab]) || FALLBACK[m.tab] || [];
    const col = el('div', 'col');
    pages.forEach((p) => col.appendChild(el('p', '', UI.fill(p).replace(/^\s*\[\w+\]\s*/, ''))));
    body.appendChild(col);
    body.appendChild(el('div', 'sep'));
    const row = el('div', 'row');
    const b1 = el('button', 'btn ghost', T.active() ? 'Skip the tutorial' : 'Replay the first-day tutorial');
    b1.onclick = () => { if (T.active()) T.skip(); else { T.restart(); UI.toast('Tutorial restarted.'); } m.rerender(); };
    row.appendChild(b1);
    body.appendChild(row);
    panel.appendChild(body);
  };
})();
