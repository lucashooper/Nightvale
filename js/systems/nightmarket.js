// Nightvale — the Night Market: every few nights a hooded merchant rolls his carriage into the Cathedral Close
// (7pm–2am) with rare, rotating stock and Mystery Boxes. A violet lantern by the plaza notice board that morning
// tells you he's coming.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const NM = (G.NightMarket = {});
  const TX = () => (window.GAMETEXT && GAMETEXT.nightmarket) || {};
  const mode = () => (G.prefs && G.prefs.marketMode) || 'wander';

  // ---------------------------------------------------------------- which nights
  NM.isDay = function (d) {
    const S = G.S; if (!S) return false;
    if (S.flags.forceMarket === d) return true;
    if (mode() === 'weekly') return G.weekday(d) === 'Starday';
    if (mode() === 'moon') return G.isFullMoon(d) || G.isNewMoon(d);
    // wandering: every 3 to 5 nights, starting on day 3
    let day = 3; const r = U.rng(S.seed + 4243);
    while (day < d) day += 3 + Math.floor(r() * 3);
    return day === d;
  };
  NM.tonight = function () { const S = G.S; if (!S) return false; const d = S.mins < 360 ? S.day - 1 : S.day; return NM.isDay(d) && (S.mins >= 1110 || S.mins < 120); };

  // ---------------------------------------------------------------- the stock (rotates every visit)
  const POOL = [
    ['seed_wispvine', 260], ['seed_phialvine', 340], ['seed_starflask', 520], ['geode_void', 380], ['geode_star', 650], ['geode_ember', 220],
    ['pearl', 900], ['golden_acorn', 1500], ['relic_star', 2400], ['moonstone', 700], ['voidcrystal', 1100], ['starshard', 260],
    ['pot_starlight', 2600], ['pot_moon', 6500], ['food_starbun', 480],
  ];
  NM.stock = function (S) {
    const r = U.rng(S.seed + S.day * 911);
    const pool = POOL.slice(), out = [['mystery_box', 1500]];
    for (let k = 0; k < 5 && pool.length; k++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    // one mineral you haven't found yet, at a collector's price
    const unfound = (G.MINERAL_IDS || []).filter((id) => !(S.cabinet && (S.cabinet.found[id] || S.cabinet.donated[id])));
    if (unfound.length) { const id = unfound[Math.floor(r() * unfound.length)]; out.push([id, G.item(id).sell * 4]); }
    // a blueprint you don't know, now and then
    const bps = (G.BLUEPRINTS || []).filter((b) => !S.known[G.item(b).bp] && G.ITEMS[G.item(b).bp]);
    if (bps.length && r() < 0.6) out.push([bps[Math.floor(r() * bps.length)], 2500]);
    if (r() < 0.45) out.push(['cl_cloak_starweave', 3600]);
    return out;
  };
  NM.openBox = async function () {
    const S = G.S, t = TX();
    if (t.mysteryBox) await G.UI.say(null, [U.pick(t.mysteryBox)]);
    const r = Math.random();
    let id = null, n = 1, gold = 0;
    if (r < 0.22) gold = 600 + Math.floor(Math.random() * 2400);
    else if (r < 0.37) { id = 'geode_star'; n = 2; }
    else if (r < 0.52) { id = U.pick(['seed_starflask', 'seed_phialvine', 'seed_wispvine']); n = 5; }
    else if (r < 0.62) { const un = G.MINERAL_IDS.filter((m) => !(S.cabinet && S.cabinet.found[m])); id = U.pick(un.length ? un : G.MINERAL_IDS); }
    else if (r < 0.7) { const bps = G.BLUEPRINTS.filter((b) => !S.known[G.item(b).bp] && G.ITEMS[G.item(b).bp]); id = bps.length ? U.pick(bps) : 'relic_star'; }
    else if (r < 0.78) id = 'relic_star';
    else if (r < 0.85) id = 'golden_acorn';
    else if (r < 0.9) id = 'pot_moon';
    else if (r < 0.95) id = G.Inv.has('cl_cloak_starweave') || (S.look && S.look.cloak === 'cl_cloak_starweave') ? 'moonstone' : 'cl_cloak_starweave';
    else { id = 'pet_treat'; n = 10; }
    G.sfx('treasure'); G.jingle('discovery');
    if (gold) { S.gold += gold; G.UI.toast(`Inside: a velvet purse. +${U.fmtNum(gold)} ✦`); return; }
    G.Inv.giveOrDrop(id, n); G.UI.toast(`Inside: ${n > 1 ? n + ' ' : ''}${G.item(id).name}!`, id);
  };

  // ---------------------------------------------------------------- setting up and packing away
  const CLOSE = { carriage: [58, 20], rug: [59, 22], stalls: [[63, 21, 0], [54, 21, 1]] };
  function clear(map) { for (const p of (map.nightMarket || [])) map.removeProp(p); map.nightMarket = null; }
  function setUp(map) {
    if (map.nightMarket || !G.addWild) return;
    const ps = [];
    ps.push(G.addWild(map, 'night_carriage', 0, CLOSE.carriage[0], CLOSE.carriage[1], { interact: { kind: 'flavor', key: 'nm_carriage' } }));
    ps.push(G.addWild(map, 'market_rug', 0, CLOSE.rug[0], CLOSE.rug[1]));
    for (const [x, y, v] of CLOSE.stalls) ps.push(G.addWild(map, 'market_stall_night', v, x, y, { interact: { kind: 'talk', npc: 'nightmerchant' } }));
    map.nightMarket = ps.filter(Boolean);
  }
  function boardLantern(map, on) {
    if (on && !map.marketLantern && G.addWild) map.marketLantern = G.addWild(map, 'lantern_post_violet', 0, 29, 19, { interact: { kind: 'flavor', key: 'nm_lantern' } });
    if (!on && map.marketLantern) { map.removeProp(map.marketLantern); map.marketLantern = null; }
  }
  NM.sync = function () {
    const S = G.S, map = G.World.maps && G.World.maps.village; if (!S || !map) return;
    const today = NM.isDay(S.day);
    boardLantern(map, today && S.mins < 1560);
    if (NM.tonight()) setUp(map); else if (map.nightMarket) clear(map);
  };
  G.on('tick', () => {
    const S = G.S; if (!S) return;
    const was = !!(G.World.maps.village && G.World.maps.village.nightMarket);
    NM.sync();
    const now = !!(G.World.maps.village && G.World.maps.village.nightMarket);
    if (!was && now && G.World.map && G.World.map.id === 'village') { const t = TX(); G.UI.toast((t.announce && t.announce.evening) || 'A soft violet glow in the Cathedral Close: the Night Market has come.'); G.sfx('wisp_chime', { volume: 0.5 }); }
    if (was && !now && G.World.map && G.World.map.id === 'village' && TX().leave) G.UI.toast(U.pick(TX().leave));
  });
  G.on('newDay', () => {
    NM.sync();
    if (NM.isDay(G.S.day)) { const t = TX(); setTimeout(() => G.UI.toast((t.announce && t.announce.board) || 'The Night Market comes to the Cathedral Close tonight, 7pm until 2am.', 'mystery_box'), 4200); }
  });
  G.on('mapChanged', (map) => { if (map && map.id === 'village') NM.sync(); });

  // flavour for the market's props
  const F = (window.GAMETEXT = window.GAMETEXT || {}).flavor = (window.GAMETEXT.flavor || {});
  if (!F.nm_carriage) F.nm_carriage = ['A caravan of dark wood and violet canvas, painted with silver stars. The stars move when you aren\'t looking straight at them.'];
  if (!F.nm_lantern) F.nm_lantern = ['A violet lantern hangs by the notice board. Everyone in Hollowmere knows what it means: the Night Market comes tonight.'];
})();
