// Nightvale — the Lantern Moon: every full moon, 6pm to midnight, Hollowmere's plaza fills with lantern
// strings, stalls and music. Release a sky lantern at the moonwell (a blessing tomorrow; at ten o'clock every
// lantern rises together), enter potion judging, catch wisps for sixty seconds, have Grizelda tell your fortune
// (it comes true), and share the moonlight dance with a villager you're close to.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Fe = (G.Festival = {});
  const TX = () => (window.GAMETEXT && GAMETEXT.festival) || null;
  const S = () => G.S;

  Fe.isDay = () => G.isFullMoon();
  Fe.active = () => Fe.isDay() && S().mins >= 1080 && S().mins < 1440;
  const fest = () => { const s = S(); if (!s.festival || s.festival.day !== s.day) s.festival = { day: s.day, judged: false, wisps: false, fortune: false, danced: null, lantern: false }; return s.festival; };

  // where everyone stands during the festival (village coordinates)
  Fe.SPOTS = {
    mirabel: [26.5, 27.7, 'down'], elvis: [37, 27.7, 'down'], orvyn: [34, 18.7, 'down'], grizelda: [38, 22.7, 'down'], pip: [29, 25.7, 'right'],
    elowen: [35.5, 25.7, 'left'], sable: [32, 25.6, 'down'], brann: [27, 21.7, 'right'], corvin: [39.5, 26.7, 'left'], lune: [25, 23.7, 'right'],
    isolde: [30, 20.7, 'down'], seraphine: [36.5, 21.7, 'down'], fennick: [33.5, 29.7, 'up'],
  };
  Fe.target = function (id) { const sp = Fe.SPOTS[id]; return sp ? [1080, 'village', sp[0], sp[1], sp[2]] : null; };

  // ---------------------------------------------------------------- decorations
  const T = 16;
  Fe.strings = [[[24, 17], [31, 19.5], [40, 17]], [[24, 31], [32, 28.5], [40, 31]], [[23.5, 17.5], [23, 24], [23.5, 30.5]], [[40.5, 17.5], [41, 24], [40.5, 30.5]], [[24, 17], [32, 24], [40, 31]], [[40, 17], [32, 24], [24, 31]]];
  const COLS = ['#ffbc62', '#b99aee', '#ff9ac8', '#8fd0ff', '#f2c45a'];
  function along(pts, k) { // point at fraction k along a polyline with a gentle sag
    const segs = []; let tot = 0;
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(l); tot += l; }
    let d = k * tot;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) { const t = segs[i] ? d / segs[i] : 0; const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t; return [x * T, y * T - 30 + Math.sin(t * Math.PI) * 8]; }
      d -= segs[i];
    }
    return [0, 0];
  }
  Fe.drawOverlay = function (ctx, ox, oy) {
    if (G.World.map.id !== 'village' || !(Fe.isDay() && S().mins >= 1020)) return;
    const t = G.R.time;
    Fe.strings.forEach((pts, si) => {
      ctx.fillStyle = 'rgba(30,20,40,0.85)';
      for (let k = 0; k <= 1; k += 0.01) { const [x, y] = along(pts, k); ctx.fillRect(Math.round(x + ox), Math.round(y + oy), 1, 1); }
      for (let k = 0.04, n = 0; k < 1; k += 0.08, n++) {
        const [x, y] = along(pts, k), sw = Math.round(Math.sin(t * 1.6 + n + si) * 1);
        ctx.fillStyle = '#120c1c'; ctx.fillRect(Math.round(x + ox + sw) - 2, Math.round(y + oy) + 1, 5, 6);
        ctx.fillStyle = COLS[(n + si) % COLS.length]; ctx.fillRect(Math.round(x + ox + sw) - 1, Math.round(y + oy) + 2, 3, 4);
        ctx.fillStyle = '#fff1c8'; ctx.fillRect(Math.round(x + ox + sw), Math.round(y + oy) + 3, 1, 2);
      }
    });
    // the ten o'clock lantern rise
    if (Fe.rising) for (const L of Fe.rising) {
      const c = G.Mobs.fxFrame('lantern_rise', Math.floor(t * 4 + L.ph) % 2);
      ctx.globalAlpha = Math.min(1, L.life / 3);
      if (c) ctx.drawImage(c, Math.round(L.x - 4 + ox), Math.round(L.y - 11 + oy)); else { ctx.fillStyle = '#ffbc62'; ctx.fillRect(Math.round(L.x + ox), Math.round(L.y + oy), 3, 4); }
      ctx.globalAlpha = 1;
    }
    // wisps to catch
    if (Fe.game) for (const w of Fe.game.wisps) {
      if (w.caught) continue;
      let c = null; try { c = MobArt.frame('wisp', w.v, 'idle', Math.floor(t * 8 + w.ph) % 4, false); } catch (e) { c = null; }
      if (c) ctx.drawImage(c, Math.round(w.x - 8 + ox), Math.round(w.y - 15 + oy)); else { ctx.fillStyle = '#b4ffd9'; ctx.fillRect(Math.round(w.x - 2 + ox), Math.round(w.y - 6 + oy), 4, 4); }
    }
  };
  Fe.lights = function (out) {
    if (G.World.map.id !== 'village' || !(Fe.isDay() && S().mins >= 1020)) return;
    Fe.strings.forEach((pts, si) => { for (let k = 0.12, n = 0; k < 1; k += 0.24, n++) { const [x, y] = along(pts, k); out.push({ x, y: y + 4, r: 34, color: [[255, 190, 110], [190, 150, 255], [255, 150, 200], [140, 200, 255]][(n + si) % 4], i: 0.75, night: true, flicker: 1 }); } });
    if (Fe.rising) for (const L of Fe.rising) out.push({ x: L.x, y: L.y - 6, r: 22, color: [255, 190, 110], i: 0.8 * Math.min(1, L.life / 3) });
    if (Fe.game) for (const w of Fe.game.wisps) if (!w.caught) out.push({ x: w.x, y: w.y - 8, r: 18, color: w.v === 'violet' ? [185, 150, 255] : [120, 255, 230], i: 0.8 });
  };
  // the stalls, the judging table and the fortune tent appear for the evening
  Fe.props = [];
  Fe.dress = function () {
    const v = G.World.maps.village; if (!v) return;
    const want = Fe.isDay() && S().mins >= 1020 && S().mins < 1500;
    if (want && !Fe.props.length) {
      Fe.props.push(v.add('stall', 33, 19, { v: 1, interact: { kind: 'festival', what: 'judging' } }));
      if (G.addWild) Fe.props.push(G.addWild(v, 'tent', 0, 37, 20, { interact: { kind: 'festival', what: 'fortune' } }));
      if (G.addWild) Fe.props.push(G.addWild(v, 'merchant_cart', 0, 32, 30, { interact: { kind: 'festival', what: 'fennick' } }));
    } else if (!want && Fe.props.length) { for (const p of Fe.props) if (p) v.removeProp(p); Fe.props = []; }
  };

  // ---------------------------------------------------------------- activities
  const say = (npc, pages, opts) => G.UI.say(npc, pages, opts);
  Fe.talk = async function (n) { // the festival menu when you talk to someone during the Lantern Moon
    const f = fest(), id = n.id, t = TX();
    const ch = [];
    if (id === 'orvyn' && !f.judged) ch.push({ label: 'Enter a potion for judging', value: 'judging' });
    if ((id === 'pip' || id === 'elowen') && !f.wisps) ch.push({ label: 'Catch wisps (sixty seconds)', value: 'wisps' });
    if (id === 'grizelda' && !f.fortune) ch.push({ label: 'Have your fortune told (50 ✦)', value: 'fortune' });
    if (id === 'mirabel' || id === 'elvis' || id === 'fennick') ch.push({ label: 'Browse the stall', value: 'shop' });
    if (!f.danced && G.NPCs.hearts(id) >= 4) ch.push({ label: 'Ask to share the moonlight dance', value: 'dance' });
    if (!ch.length) return false;
    ch.push({ label: 'Just say hello', value: 'talk' });
    const v = await say(id, ['[happy] Isn\'t it lovely tonight?'], { choices: ch });
    if (v === 'talk' || v == null) return false;
    if (v === 'shop') { G.Shop.open(id === 'fennick' ? 'fennick' : id === 'elvis' ? 'elvis' : 'festival'); return true; }
    await Fe.activity(v, id);
    return true;
  };
  Fe.activity = async function (what, npc) {
    const f = fest(), t = TX(), s = S();
    if (what === 'judging') {
      if (f.judged) { G.UI.toast('You already entered a potion tonight.'); return; }
      await say(null, (t && t.judging) || ['Enter your finest potion.']);
      const pots = [...new Set(s.inv.filter((x) => x && G.item(x.id).cat === 'potion' && x.id !== 'sludge').map((x) => x.id))].sort((a, b) => G.item(b).sell - G.item(a).sell).slice(0, 4);
      if (!pots.length) { await say('orvyn', ['[sad] No potion? Come back with your finest brew before midnight, dear.']); return; }
      const pick = await say('orvyn', ['Which will you enter?'], { choices: pots.map((p) => ({ label: G.item(p).name, value: p })).concat([{ label: 'Not yet', value: null }]) });
      if (!pick) return;
      G.Inv.remove(pick, 1); f.judged = true;
      const score = G.item(pick).sell * (0.85 + Math.random() * 0.3) * (1 + G.Stats.get('luck') * 0.03);
      const tier = score >= 800 ? 'high' : score >= 250 ? 'mid' : 'low';
      const R = (t && t.judgingResults && t.judgingResults[tier]) || ['The judges confer.'];
      await say(null, R);
      const prize = { high: [1500, 'First prize'], mid: [700, 'Second prize'], low: [250, 'A kind mention'] }[tier];
      s.gold += prize[0]; G.Inv.giveOrDrop('prize_ribbon', 1); G.jingle('quest_complete'); G.sfx('applause', { volume: 0.6 });
      G.UI.toast(`${prize[1]}: ${prize[0]} ✦ and a Prize Ribbon.`, 'prize_ribbon');
      return;
    }
    if (what === 'wisps') {
      if (f.wisps) { G.UI.toast('You already caught wisps tonight.'); return; }
      await say(null, (t && t.wisps) || ['Catch as many wisps as you can in sixty seconds!']);
      f.wisps = true; Fe.startWisps();
      return;
    }
    if (what === 'fortune') {
      if (f.fortune) { G.UI.toast('Grizelda says one fortune a moon is plenty, dearie.'); return; }
      await say(null, (t && t.fortune) || ['Cross my palm with glimmer.']);
      if (s.gold < 50) { await say('grizelda', ['[angry] No glimmer, no fortune! Kehehe.']); return; }
      s.gold -= 50; f.fortune = true;
      const list = (t && t.fortunes) || ['Luck walks with you tomorrow.'], hints = (t && t.fortuneHints) || ['luck_tomorrow'];
      const i = Math.floor(U.rng(s.seed + s.day * 3)() * list.length);
      G.sfx('mystery_chime');
      await say('grizelda', [list[i]]);
      Fe.fulfil(hints[i] || 'luck_tomorrow');
      return;
    }
    if (what === 'dance') {
      f.danced = npc;
      await say(null, (t && t.dance && t.dance.intro) || ['The music swells.']);
      G.sfx('dance_step'); G.R.doFlash('255,220,170', 0.15);
      await say(npc, (t && t.dance && t.dance[npc]) || ['[happy] What a lovely dance!']);
      const fr = s.friends[npc]; fr.pts = Math.min(1000, fr.pts + 150);
      G.jingle('heart_up'); G.UI.toast(`${G.UI.npcName(npc)} — ${G.NPCs.hearts(npc)} ♥`);
      return;
    }
    if (what === 'fennick') { G.Shop.open('fennick'); }
  };
  // Grizelda's fortunes come true
  Fe.fulfil = function (key) {
    const s = S();
    (s.fortunes || (s.fortunes = [])).push({ key, day: s.day + 1 });
    if (key === 'rain_tomorrow') s.tomorrow = 'rain';
    if (key === 'starfall_soon') s.tomorrow = 'starfall';
  };
  G.on('newDay', () => {
    const s = S(); if (!s.fortunes) return;
    const due = s.fortunes.filter((f) => f.day <= s.day); s.fortunes = s.fortunes.filter((f) => f.day > s.day);
    const maps = G.World.maps;
    for (const { key } of due) {
      if (key === 'luck_tomorrow') G.Stats.apply('festival', 'sky_lantern', { luck: 2 }, 0, 1500, 'Grizelda was right');
      if (key === 'fishing_luck') s.buffs.tide = 99999;
      if (key === 'harvest_bonus') for (const id in maps) for (const fm of maps[id].farm.values()) if (fm.crop && !G.Farm.ripe(fm.crop)) fm.crop.days += 1;
      if (key === 'merchant_tomorrow') s.flags.fennickForce = s.day;
      if (key === 'depths_loot') s.flags.depthsLuck = s.day;
      if (key === 'ridge_treasure' || key === 'deepwood_treasure') {
        const m = maps[key === 'ridge_treasure' ? 'ridge' : 'deepwood'], spot = key === 'ridge_treasure' ? [7, 8] : [50, 16];
        for (let k = 0; k < 20 && m; k++) { const x = spot[0] + (k % 5) - 2, y = spot[1] + Math.floor(k / 5) - 1; if (m.inb(x, y) && !m.blocked(x, y) && !m.tobj.has(m.idx(x, y))) { m.setObj(x, y, { kind: 'treasure', solid: true, open: false }); break; } }
      }
      if (key === 'friend_gift') (s.parcels || (s.parcels = [])).push({ day: s.day, items: [[U.pick(['food_honeycake', 'moonstone', 'pot_starlight', 'relic_locket']), 1]], glimmer: 0 });
    }
    // the lantern you released last night answers with a small blessing
    if (s.lanternWish && s.lanternWish < s.day) { s.lanternWish = 0; G.Stats.apply('festival', 'sky_lantern', U.pick([{ luck: 2 }, { farming: 2, luck: 1 }, { speed: 2, luck: 1 }]), 0, 1500, 'A lantern\'s answer'); setTimeout(() => G.UI.toast('Your lantern wish was heard: a blessing for today.', 'sky_lantern'), 3600); }
  });
  // a fortune-told treasure chest
  Fe.openTreasure = function (map, o) {
    if (o.open) return;
    o.open = true; G.sfx('chest_open'); G.sfx('treasure');
    const s = S(); const g = 400 + Math.floor(Math.random() * 400); s.gold += g;
    G.dropItem(map, U.pick(['relic_star', 'relic_idol', 'moonstone', 'emerald']), 1, o.tx * 16 + 8, o.ty * 16 + 6);
    G.UI.toast(`Just as Grizelda said. +${g} ✦`);
    setTimeout(() => { if (map.obj(o.tx, o.ty) === o) map.setObj(o.tx, o.ty, null); }, 4000);
  };

  // the sky lantern at the moonwell
  Fe.release = async function () {
    const s = S(), t = TX();
    if (!Fe.isDay() || s.mins < 1020) return false;
    if (!G.Inv.has('sky_lantern')) { await say(null, (t && t.lantern) || ['Buy a sky lantern from Mirabel\'s stall.']); return true; }
    if (s.lanternWish === s.day) { G.UI.toast('Your wish is already on its way to the moon.'); return true; }
    G.Inv.remove('sky_lantern', 1); s.lanternWish = s.day;
    const p = G.World.player; G.sfx('lantern_release');
    (Fe.rising || (Fe.rising = [])).push({ x: p.x, y: p.y - 20, vy: -14, life: 14, ph: Math.random() * 4 });
    G.UI.toast('You make a wish and let the lantern go. Tomorrow will tell.', 'sky_lantern');
    return true;
  };

  // ---------------------------------------------------------------- wisp catching
  Fe.startWisps = function () {
    const r = U.rng(Date.now() % 1e6), wisps = [];
    for (let i = 0; i < 14; i++) wisps.push({ x: (25 + r() * 15) * T, y: (19 + r() * 11) * T, vx: (r() - 0.5) * 30, vy: (r() - 0.5) * 30, v: r() < 0.5 ? 'teal' : 'violet', ph: r() * 4, caught: false });
    Fe.game = { t: 60, n: 0, wisps };
    G.UI.toast('Go! Walk into the wisps to catch them.');
  };
  Fe.update = function (dt) {
    const s = S(), map = G.World.map;
    if (map && map.id === 'village') Fe.dress();
    // ten o'clock: every lantern rises together
    if (Fe.isDay() && s.mins >= 1320 && s.mins < 1440 && fest().rose !== true && map && map.id === 'village') {
      fest().rose = true; Fe.rising = Fe.rising || [];
      const r = U.rng(s.day);
      for (let i = 0; i < 46; i++) Fe.rising.push({ x: (22 + r() * 22) * T, y: (17 + r() * 15) * T, vy: -(8 + r() * 10), life: 16 + r() * 8, ph: r() * 4 });
      const t = TX(); if (t && t.lanternRise) setTimeout(() => G.UI.say(null, t.lanternRise), 300);
      G.sfx('lantern_release');
    }
    if (Fe.rising) { for (const L of Fe.rising) { L.y += L.vy * dt; L.x += Math.sin(L.y / 30 + L.ph) * 4 * dt; L.life -= dt; } Fe.rising = Fe.rising.filter((L) => L.life > 0); if (!Fe.rising.length) Fe.rising = null; }
    if (Fe.game) {
      const g = Fe.game, p = G.World.player;
      g.t -= dt;
      for (const w of g.wisps) {
        if (w.caught) continue;
        w.x += w.vx * dt; w.y += w.vy * dt;
        if (w.x < 24 * T || w.x > 40 * T) w.vx *= -1; if (w.y < 18 * T || w.y > 30 * T) w.vy *= -1;
        if (Math.random() < dt * 0.6) { w.vx = (Math.random() - 0.5) * 40; w.vy = (Math.random() - 0.5) * 40; }
        if (Math.hypot(p.x - w.x, p.y - 6 - w.y) < 14) { w.caught = true; g.n++; G.sfx('wisp_catch'); G.R.burst(w.x, w.y - 8, 10, { colors: ['#b4ffd9', '#e4d2ff', '#ffffff'], speed: 30, life: 0.6, grav: -20 }); }
      }
      if (Math.ceil(g.t) !== g.shown) { g.shown = Math.ceil(g.t); G.UI.wispHud(g); }
      if (g.t <= 0 || g.wisps.every((w) => w.caught)) {
        Fe.game = null; G.UI.wispHud(null);
        const n = g.n, prize = n >= 11 ? [1000, 3] : n >= 7 ? [500, 2] : n >= 3 ? [200, 1] : [60, 0];
        s.gold += prize[0]; if (prize[1]) G.Inv.giveOrDrop('wisp_essence', prize[1]);
        G.jingle('quest_complete'); G.sfx('applause', { volume: 0.5 });
        G.UI.toast(`You caught ${n} ${n === 1 ? 'wisp' : 'wisps'}! +${prize[0]} ✦${prize[1] ? ` and ${prize[1]} Wisp Light` : ''}.`, 'wisp_essence');
      }
    }
  };
  G.UI.wispHud = function (g) {
    let e = document.querySelector('.wisphud');
    if (!g) { if (e) e.remove(); return; }
    if (!e) { e = G.UI.el('div', 'panel wisphud'); G.UI.hud.appendChild(e); }
    e.innerHTML = `<div class="lbl">Wisp catching</div><div class="big">${Math.max(0, Math.ceil(g.t))}s · ${g.n} caught</div>`;
  };

  // festival stall stock (Mirabel's table under the lanterns)
  G.SHOPS.festival = {
    title: 'The Lantern Moon stalls',
    stock: [['sky_lantern', 50], ['snack_sweets', 50], ['food_honeycake', 140], ['food_moonpudding', 180], ['seed_starbloom', 110], ['seed_wispvine', 200], ['seed_starflask', 400], ['fam_treat', 35]],
    buys: { crop: 1, forage: 1 },
  };
  G.on('newDay', () => { if (Fe.isDay()) setTimeout(() => { const t = TX(); G.UI.toast((t && t.announce && t.announce.morning) || 'The Lantern Moon festival is tonight in Hollowmere!'); }, 5200); });
})();
