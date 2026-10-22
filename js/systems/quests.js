// Nightvale — the objective tracker ("Next: ...").
(function () {
  'use strict';
  const G = window.G;
  const offers = (S) => Object.values(S.bundlesDone || {}).filter(Boolean).length;
  const anyFarm = () => G.World.maps.sanctum && G.World.maps.sanctum.farm.size > 0;
  const anyCrop = () => { const m = G.World.maps.sanctum; if (!m) return false; for (const f of m.farm.values()) if (f.crop) return true; return false; };
  const met = (S) => G.NPCs.IDS.filter((id) => S.friends[id] && S.friends[id].met).length;
  const OBJ = [
    { text: 'Clear the overgrown garden and till the soil', sub: 'Use the Rune Hoe on the dark earth inside the walled garden, south of the temple.', done: (S) => S.flags.tilled || anyFarm() },
    { text: 'Plant and water your Moonpetal seeds', sub: 'Select the seeds and click tilled soil, then water it with the Dew Can.', done: (S) => S.flags.planted || anyCrop() },
    { text: 'Visit Hollowmere, east of the Sanctum', sub: 'Follow the path out of the garden’s east gate.', done: (S) => S.flags.visited_village },
    { text: 'Introduce yourself to Mirabel', sub: 'She runs the seed shop north-west of the fountain (9am–5pm).', done: (S) => S.friends.mirabel && S.friends.mirabel.met },
    { text: 'Harvest your first crop', sub: 'Glowcaps take 3 days, Moonpetals 4. Water them every morning.', done: (S) => S.flags.firstHarvest },
    { text: 'Brew your first potion', sub: 'Two Moonpetals in the temple cauldron make a Healing Draught.', done: (S) => S.flags.firstBrew },
    { text: 'Examine the Moon Altar', sub: 'At the heart of the temple ruins.', done: (S) => S.flags.altarSeen },
    { text: 'Enter the Umbral Depths', sub: 'The cave mouth on Starfall Ridge, north of Hollowmere. Bring potions.', done: (S) => S.maxDepth >= 1 },
    { text: 'Meet everyone in Nightvale', sub: null, done: (S) => met(S) >= 9 },
    { text: 'Complete an offering at the Moon Altar', sub: 'The Gardener’s Offering is a good place to start.', done: (S) => offers(S) >= 1 },
    { text: 'Reach floor 10 of the Depths', sub: 'Rune Gates on every fifth floor remember your progress.', done: (S) => S.maxDepth >= 10 },
    { text: 'Complete three altar offerings', sub: null, done: (S) => offers(S) >= 3 },
    { text: 'Reach floor 25 of the Depths', sub: 'Something large nests in the Webbed Catacombs.', done: (S) => S.maxDepth >= 25 },
    { text: 'Complete all five altar offerings', sub: 'The full moon in the altar is the key to the deepest door.', done: (S) => offers(S) >= 5 },
    { text: 'Descend to floor 50 and face the Umbral Archon', sub: null, done: (S) => S.flags.archonDefeated },
  ];
  G.Quests = {
    list() { const S = G.S; return OBJ.map((o) => ({ text: o.text, sub: o.text.startsWith('Meet everyone') ? `${met(S)} of 9 met` : o.sub, done: !!o.done(S) })); },
    current() {
      const S = G.S; if (!S) return null;
      const gl = G.Guild && G.Guild.trackerLine(); if (gl) return gl;
      for (const o of OBJ) if (!o.done(S)) return { text: o.text, sub: o.text.startsWith('Meet everyone') ? `${met(S)} of 9 met — check the Villagers tab (I)` : o.sub };
      return { text: 'Nightvale is at peace', sub: 'Grow, brew and wander as you please.' };
    },
  };
  G.on('mapChanged', (map) => { if (map.id === 'village') G.S.flags.visited_village = true; });
  G.on('firstHarvest', () => { const t = window.GAMETEXT && GAMETEXT.misc && GAMETEXT.misc.firstHarvest; if (t) setTimeout(() => G.UI.say(null, t), 700); });
})();
