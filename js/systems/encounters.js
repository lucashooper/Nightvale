// Nightvale — random encounters in the spirit of For the King: each morning one to three mysterious things
// turn up somewhere in the valley, glowing faintly. Most offer a choice, and some are settled by a roll of the
// luck coins (more Luck, better odds). Also Fennick's dice, treasure maps and their dig sites.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.MAT;
  const E = (G.Encounters = {});
  const T = (k) => (window.GAMETEXT && GAMETEXT.encounters && GAMETEXT.encounters[k]) || null;

  // where each kind of encounter likes to appear (and the art it uses)
  const KINDS = {
    chest: { w: 4, maps: ['woods', 'deepwood', 'ridge', 'lake'], obj: 'mystery_chest' },
    shrine: { w: 3, maps: ['woods', 'ridge', 'lake', 'village'], wild: 'shrine_chance' },
    fallenstar: { w: 2, maps: ['ridge', 'lake', 'sanctum', 'village', 'woods'], wild: 'fallen_star' },
    spirit: { w: 3, maps: ['woods', 'deepwood', 'ridge', 'lake'], wild: 'spirit', night: true },
    riddle: { w: 3, maps: ['woods', 'deepwood', 'ridge'], wild: 'riddle_stone', wide: true },
    wishingwell: { w: 2, maps: ['woods', 'lake', 'village', 'sanctum'], wild: 'wishing_well', wide: true },
    traveller: { w: 2, maps: ['woods', 'lake', 'ridge', 'village'], wild: 'traveller' },
    treasuremap: { w: 2, maps: ['woods', 'lake', 'ridge', 'village', 'deepwood'], icon: 'treasure_map' },
  };
  const AREAS = { woods: [2, 2, 50, 34], deepwood: [36, 3, 32, 50], ridge: [2, 13, 48, 13], lake: [2, 5, 20, 34], village: [4, 32, 70, 9], sanctum: [38, 6, 8, 28] };
  const W = () => G.World;

  // ---------------------------------------------------------------- daily placement
  E.newDay = function (first) {
    const S = G.S, maps = W().maps;
    for (const id in maps) for (const [i, o] of [...maps[id].tobj]) if (o.kind === 'encounter' || o.kind === 'encpart') maps[id].tobj.delete(i);
    const r = U.rng(S.seed + S.day * 101);
    let n = r() < 0.4 ? 1 : r() < 0.85 ? 2 : 3;
    if (first) n = 1;
    const used = new Set();
    for (let k = 0; k < n; k++) {
      const type = r.weighted(Object.keys(KINDS).filter((t) => !used.has(t)).map((t) => [t, KINDS[t].w]));
      used.add(type);
      const def = KINDS[type], mapId = def.maps[Math.floor(r() * def.maps.length)], map = maps[mapId];
      if (!map) continue;
      const spot = findSpot(map, AREAS[mapId] || [2, 2, map.w - 4, map.h - 4], r, def.wide);
      if (!spot) continue;
      const o = { kind: 'encounter', type, day: S.day, solid: true };
      if (type === 'spirit') { const wants = (T('spirit') && T('spirit').wants) || [{ item: 'moonlily', qty: 1, text: 'Bring me a moonlily.' }]; o.want = Math.floor(r() * wants.length); }
      if (type === 'riddle') o.riddle = Math.floor(r() * ((T('riddle') && T('riddle').riddles.length) || 1));
      map.setObj(spot[0], spot[1], o);
      if (def.wide) map.setObj(spot[0] + 1, spot[1], { kind: 'encpart', of: [spot[0], spot[1]], solid: true, hidden: true });
    }
    E.updateVisibility();
  };
  function findSpot(map, rect, r, wide) {
    for (let k = 0; k < 80; k++) {
      const x = rect[0] + Math.floor(r() * rect[2]), y = rect[1] + Math.floor(r() * rect[3]);
      const ok = (xx, yy) => map.inb(xx, yy) && !map.blocked(xx, yy) && !map.tobj.has(map.idx(xx, yy)) && !map.farm.has(map.idx(xx, yy)) && !map.isWater(xx, yy) && map.t(xx, yy) !== M.BOG;
      if (!ok(x, y) || (wide && !ok(x + 1, y)) || !ok(x, y + 1)) continue;
      return [x, y];
    }
    return null;
  }
  // spirits only show themselves after dusk
  E.updateVisibility = function () {
    const late = G.S.mins >= 1080 || G.S.mins < 330;
    for (const id in W().maps) for (const o of W().maps[id].tobj.values()) if (o.kind === 'encounter' && KINDS[o.type].night) { o.hidden = !late; o.solid = late; }
  };

  // ---------------------------------------------------------------- drawing
  const cache = new Map();
  function sprite(o) {
    const def = KINDS[o.type];
    if (o.kind === 'digmark') { try { const c = ItemArt.object('dig_mark', 'idle', Math.floor(G.R.time * 2) % 2); if (c) return { c, ax: c.width / 2, ay: c.height - 2 }; } catch (e) { /* fallback */ } return null; }
    if (def.obj) { try { const c = ItemArt.object(def.obj, o.open ? 'open' : 'closed', 0); if (c) return { c, ax: c.width / 2, ay: c.height - 2 }; } catch (e) { /* fallback */ } return null; }
    if (def.icon) return { c: G.icon(def.icon), ax: 8, ay: 14, flutter: true };
    const key = def.wild; let s = cache.get(key);
    if (!s) { try { if (window.WildArt) s = WildArt.piece(def.wild, 0); } catch (e) { s = null; } if (s) cache.set(key, s); }
    if (!s) return null;
    const c = s.frames ? s.frames[Math.floor(G.R.time * (s.fps || 4)) % s.frames.length] : s.c;
    return { c, ax: s.ax, ay: s.ay, sp: s };
  }
  E.drawable = function (map, o) {
    const x = o.tx * 16, y = o.ty * 16, def = KINDS[o.type] || {};
    return {
      sortY: y + 15,
      draw(ctx, ox, oy) {
        const s = sprite(o);
        const ax = x + (def.wide ? 16 : 8), ay = y + 15;
        if (s) {
          if (s.flutter) { // a map pinned to a post, flapping
            ctx.fillStyle = '#3e2d2b'; ctx.fillRect(x + 7 + ox, y + oy - 10, 2, 24);
            ctx.drawImage(s.c, x + ox + Math.round(Math.sin(G.R.time * 3) * 1), y + oy - 8);
          } else ctx.drawImage(s.c, Math.round(ax - s.ax + ox), Math.round(ay - s.ay + oy));
        } else { ctx.fillStyle = '#4a3b6d'; ctx.fillRect(x + 3 + ox, y + 3 + oy, 10, 12); }
        // a faint shimmer so it catches the eye
        if (o.kind === 'encounter') for (let k = 0; k < 3; k++) {
          const a = Math.sin(G.R.time * 2.3 + k * 2.1 + o.tx);
          if (a < 0.4) continue;
          ctx.globalAlpha = (a - 0.4) * 1.6; ctx.fillStyle = k === 1 ? '#fff1c8' : '#e4d2ff';
          ctx.fillRect(Math.round(ax - 8 + ((k * 11 + o.tx * 3) % 16) + ox), Math.round(y - 6 - ((k * 7) % 12) + oy), 1, 1);
          ctx.globalAlpha = 1;
        }
      },
    };
  };
  E.lights = function (o, out) {
    if (o.hidden) return;
    const col = o.type === 'spirit' ? [120, 255, 230] : o.type === 'fallenstar' ? [255, 230, 150] : o.kind === 'digmark' ? [255, 200, 120] : [190, 160, 255];
    out.push({ x: o.tx * 16 + (KINDS[o.type] && KINDS[o.type].wide ? 16 : 8), y: o.ty * 16 + 4, r: o.type === 'fallenstar' ? 34 : 22, color: col, i: o.type === 'fallenstar' ? 0.8 : 0.45 });
  };

  // ---------------------------------------------------------------- luck coins
  E.coinOdds = () => U.clamp(0.5 + 0.06 * G.Stats.get('luck'), 0.25, 0.85);
  // flips n coins one by one in a little panel; resolves to the number of stars
  E.roll = function (title, n, need) {
    const p = E.coinOdds(), res = [];
    for (let i = 0; i < n; i++) res.push(Math.random() < p);
    return G.UI.open('roll', { title, n, need, p, res }).then(() => res.filter(Boolean).length);
  };
  G.UI.panels.roll = function (panel, m) {
    const { title, n, need, p, res } = m.data, el = G.UI.el;
    m.noBgClose = true; m.closeKeys = [];
    panel.classList.add('rollp');
    panel.appendChild(el('h2', '', title));
    panel.appendChild(el('div', 'subtitle', `${need > 1 ? `${need} stars` : 'A star'} of ${n} to succeed · each coin ${Math.round(p * 100)}%${G.Stats.get('luck') ? ` (Luck ${G.Stats.get('luck') > 0 ? '+' : ''}${G.Stats.get('luck')})` : ''}`));
    const row = el('div', 'coins');
    const coins = res.map(() => { const c = el('div', 'coin'); row.appendChild(c); return c; });
    panel.appendChild(row);
    const out = el('div', 'roll-out', '&nbsp;'); panel.appendChild(out);
    const btn = el('button', 'btn gold', 'Continue'); btn.style.visibility = 'hidden'; btn.onclick = () => m.close();
    panel.appendChild(btn);
    let i = 0;
    const next = () => {
      if (m.closed) return;
      if (i >= n) {
        const wins = res.filter(Boolean).length;
        out.innerHTML = wins >= need ? `<span class="em">${wins} ${wins === 1 ? 'star' : 'stars'}. Fortune smiles.</span>` : `<span class="danger">${wins} ${wins === 1 ? 'star' : 'stars'}. Not today.</span>`;
        G.sfx(wins >= need ? 'mystery_chime' : 'error', { volume: 0.6 });
        btn.style.visibility = 'visible'; btn.focus();
        return;
      }
      const c = coins[i];
      c.classList.add('spin'); G.sfx('coin_flip', { volume: 0.7 });
      setTimeout(() => { c.classList.remove('spin'); c.classList.add(res[i] ? 'win' : 'lose'); c.innerHTML = res[i] ? '★' : '☾'; i++; setTimeout(next, 260); }, 420);
    };
    setTimeout(next, 350);
    m.onKey = (code) => { if ((code === 'Enter' || code === 'Space' || code === 'KeyE') && btn.style.visibility === 'visible') m.close(); };
  };

  // ---------------------------------------------------------------- interacting
  const say = (pages, opts) => G.UI.say(null, pages, opts);
  const choicesOf = (k, keys) => keys.map((v) => ({ label: (T(k) && T(k).choices[v]) || v, value: v }));
  const out = (k, key) => (T(k) && T(k).outcomes[key]) || ['...'];
  function finish(map, o) { map.setObj(o.tx, o.ty, null); const part = map.obj(o.tx + 1, o.ty); if (part && part.kind === 'encpart') map.setObj(o.tx + 1, o.ty, null); }
  function give(id, n) { G.Inv.giveOrDrop(id, n || 1); }

  E.interact = async function (map, o) {
    const S = G.S, k = o.type, t = T(k);
    if (o.kind === 'encpart') { const m = map.obj(o.of[0], o.of[1]); if (m) return E.interact(map, m); return; }
    if (o.kind === 'digmark') { G.UI.toastOnce('dig', 'Something is buried here. Dig with your Rune Hoe.'); return; }
    G.sfx('mystery_chime', { volume: 0.5 });
    if (k === 'chest') {
      const v = await say(t ? t.intro : ['A strange chest.'], { choices: choicesOf(k, ['open', 'leave']) });
      if (v !== 'open') { await say(out(k, 'leave')); return; }
      const stars = await E.roll('The mysterious chest', 3, 1);
      o.open = true;
      if (stars === 0) {
        await say(out(k, 'mimic'));
        finish(map, o);
        const m = G.Mobs.spawn('mimic', Math.random() < 0.5 ? 'wood' : 'gilded', o.tx * 16 + 8, o.ty * 16 + 12, map.id === 'deepwood' ? 10 : 4);
        m.aggro = true; map.entities.push(m); G.sfx('mimic_snap'); G.R.shake(2, 0.3);
        return;
      }
      G.sfx('treasure'); await say(out(k, 'success'));
      const loot = stars >= 3 ? [['relic_idol', 1], ['emerald', 1], ['glimmer', 400]] : stars === 2 ? [['amethyst', 2], ['relic_coin', 1], ['glimmer', 200]] : [['pot_healing', 1], ['glimmer', 120], ['seed_starbloom', 2]];
      for (const [id, n] of loot) { if (id === 'glimmer') { S.gold += n; G.UI.toast(`+${n} ✦`); } else give(id, n); }
      finish(map, o);
      return;
    }
    if (k === 'shrine') {
      const cost = 100;
      const v = await say(t ? t.intro : ['A shrine.'], { choices: [{ label: `${(t && t.choices.offer) || 'Offer glimmer'} (${cost} ✦)`, value: 'offer' }, { label: (t && t.choices.leave) || 'Walk on', value: 'leave' }] });
      if (v !== 'offer') { await say(out(k, 'leave')); return; }
      if (S.gold < cost) { G.UI.toast('You don\'t have enough glimmer.'); G.sfx('error'); return; }
      S.gold -= cost; G.sfx('coin');
      const stars = await E.roll('The shrine of chance', 3, 2);
      if (stars >= 2) {
        await say(out(k, 'blessing'));
        const pick = U.pick([{ luck: 2 }, { speed: 2, luck: 1 }, { farming: 2, luck: 1 }, { mining: 2, luck: 1 }, { fishing: 2, luck: 1 }]);
        G.Stats.apply('festival', 'relic_coin', stars === 3 ? Object.fromEntries(Object.entries(pick).map(([a, b]) => [a, b + 1])) : pick, 0, 1500, 'Shrine blessing');
        G.UI.toast(`Shrine blessing: ${G.Stats.describe(pick)} for the rest of the day.`, 'relic_coin');
      } else {
        await say(out(k, 'curse'));
        G.Stats.apply('festival', 'sludge', { speed: -1 }, 0, Math.min(1500, S.mins + 180), 'A little rain cloud');
        S.energy = Math.max(0, S.energy - 15);
      }
      finish(map, o);
      return;
    }
    if (k === 'fallenstar') {
      const v = await say(t ? t.intro : ['A fallen star.'], { choices: choicesOf(k, ['gather', 'leave']) });
      if (v !== 'gather') { await say(out(k, 'leave')); return; }
      const stars = await E.roll('Gathering starlight', 2, 2);
      give('starshard', 2 + Math.floor(Math.random() * 3));
      if (stars >= 2) { await say(out(k, 'rare')); give('relic_star', 1); G.jingle('discovery'); } else await say(out(k, 'success'));
      finish(map, o);
      return;
    }
    if (k === 'spirit') {
      const wants = (t && t.wants) || [{ item: 'moonlily', qty: 1, text: 'Bring me a moonlily.' }];
      const w = wants[o.want % wants.length];
      await say(t ? t.intro : ['A spirit.']);
      const has = G.Inv.has(w.item, w.qty);
      const v = await say([w.text], { choices: [{ label: `Give ${w.qty > 1 ? w.qty + ' ' : ''}${G.item(w.item).name}`, value: 'give' }, { label: 'Not now', value: 'refuse' }] });
      if (v !== 'give') { await say(out(k, 'refuse')); return; }
      if (!has) { await say(out(k, 'missing')); return; }
      G.Inv.remove(w.item, w.qty);
      await say(out(k, 'give'));
      G.sfx('wisp_chime'); G.R.burst(o.tx * 16 + 8, o.ty * 16, 24, { colors: ['#b4ffd9', '#e4d2ff', '#ffffff'], speed: 40, life: 1.4, grav: -40, up: 30 });
      const reward = U.pick([['relic_locket', 1], ['relic_bell', 1], ['moonstone', 1], ['seed_starflask', 2], ['golden_acorn', 1]]);
      give(reward[0], reward[1]); S.gold += 150; G.UI.toast('+150 ✦');
      finish(map, o);
      return;
    }
    if (k === 'riddle') {
      const riddles = (t && t.riddles) || [{ q: 'What has roots nobody sees?', answers: ['A mountain', 'A tree'], correct: 0 }];
      const rd = riddles[o.riddle % riddles.length];
      const v = await say(t ? t.intro : ['A talking stone.'], { choices: choicesOf(k, ['answer', 'leave']) });
      if (v !== 'answer') { await say(out(k, 'leave')); return; }
      const a = await say([rd.q], { choices: rd.answers.map((s, i) => ({ label: s, value: i })) });
      if (a === rd.correct) {
        await say(out(k, 'success')); G.jingle('discovery');
        give(U.pick(['relic_coin', 'relic_idol', 'moonstone', 'scroll_pot_wisplight', 'emerald']), 1);
        finish(map, o);
      } else { await say(out(k, 'fail')); finish(map, o); }
      return;
    }
    if (k === 'wishingwell') {
      const v = await say(t ? t.intro : ['A well.'], { choices: [{ label: `${(t && t.choices.toss) || 'Toss a coin'} (10 ✦)`, value: 'toss' }, { label: (t && t.choices.leave) || 'Keep your coin', value: 'leave' }] });
      if (v !== 'toss') { await say(out(k, 'leave')); return; }
      if (S.gold < 10) { G.UI.toast('Not even ten glimmer to spare.'); return; }
      S.gold -= 10; G.sfx('coin');
      const stars = await E.roll('A wish', 1, 1);
      if (stars) {
        await say(out(k, 'success'));
        const wish = U.pick(['gold', 'gem', 'luck']);
        if (wish === 'gold') { S.gold += 250; G.UI.toast('+250 ✦'); }
        else if (wish === 'gem') give(U.pick(['amethyst', 'emerald', 'quartz', 'pearl']), 1);
        else { G.Stats.apply('festival', 'pearl', { luck: 1 }, 0, 1500, 'A granted wish'); G.UI.toast('A granted wish: +1 Luck today.'); }
      } else await say(out(k, 'fail'));
      finish(map, o);
      return;
    }
    if (k === 'traveller') {
      const v = await say(t ? t.intro : ['A wounded traveller.'], { choices: choicesOf(k, ['give', 'refuse']) });
      if (v !== 'give') { await say(out(k, 'refuse')); return; }
      if (!G.Inv.has('pot_healing')) { await say(out(k, 'missing')); return; }
      G.Inv.remove('pot_healing', 1);
      await say(out(k, 'give'));
      (S.parcels || (S.parcels = [])).push({ day: S.day + 1, items: [[U.pick(['relic_feather', 'seed_phialvine', 'moonstone', 'relic_bell', 'food_starbun']), 1]], glimmer: 300 });
      finish(map, o);
      return;
    }
    if (k === 'treasuremap') {
      const v = await say(t ? t.intro : ['A map.'], { choices: choicesOf(k, ['take', 'leave']) });
      if (v !== 'take') { await say(out(k, 'leave')); return; }
      finish(map, o);
      E.newTreasure();
      await say(out(k, 'take'));
      return;
    }
  };

  // ---------------------------------------------------------------- treasure maps & digging
  const DIG_AREAS = { woods: [[2, 2, 50, 34], 'Whisperwood'], lake: [[4, 5, 18, 34], 'Glimmermere'], ridge: [[2, 13, 48, 13], 'Starfall Ridge'], deepwood: [[36, 3, 32, 50], 'the Deepwood'], sanctum: [[38, 6, 8, 28], 'the Sanctum'] };
  E.newTreasure = function () {
    const S = G.S, r = U.rng(S.seed + S.day * 7 + 3);
    const ids = Object.keys(DIG_AREAS), mapId = ids[Math.floor(r() * ids.length)], map = W().maps[mapId];
    if (!map) return;
    const spot = findSpot(map, DIG_AREAS[mapId][0], r, false);
    if (!spot) return;
    map.setObj(spot[0], spot[1], { kind: 'digmark', solid: false });
    S.treasure = { map: mapId, x: spot[0], y: spot[1] };
    G.Inv.giveOrDrop('treasure_map', 1);
    G.UI.toast(`The X is somewhere in ${DIG_AREAS[mapId][1]}.`, 'treasure_map');
  };
  E.treasureHint = () => { const t = G.S.treasure; return t ? `The X marks a spot in ${DIG_AREAS[t.map] ? DIG_AREAS[t.map][1] : t.map}.` : ''; };
  E.dig = async function (map, o) {
    const S = G.S, k = 'treasuremap';
    map.setObj(o.tx, o.ty, null);
    G.sfx('dig'); G.R.burst(o.tx * 16 + 8, o.ty * 16 + 10, 14, { colors: ['#56425f', '#7d6c82', '#3f3346'], speed: 40, life: 0.6 });
    await G.UI.say(null, out(k, 'dig'));
    G.sfx('treasure'); G.jingle('discovery');
    const g = 300 + Math.floor(Math.random() * 500); S.gold += g; G.UI.toast(`+${g} ✦`);
    G.Inv.giveOrDrop(U.pick(['relic_coin', 'relic_idol', 'relic_locket', 'golden_acorn', 'emerald', 'moonstone']), 1);
    if (G.Inv.has('treasure_map')) G.Inv.remove('treasure_map', 1);
    S.treasure = null;
  };

  // ---------------------------------------------------------------- Fennick's dice
  E.merchant = async function (n) {
    const S = G.S, t = T('merchant');
    const v = await G.UI.say('fennick', t ? t.intro : ['Rare treasures, today only!'], { choices: [{ label: (t && t.choices.browse) || 'Browse', value: 'browse' }, { label: (t && t.choices.dice) || 'Dice', value: 'dice' }, { label: (t && t.choices.leave) || 'Not today', value: 'leave' }] });
    if (v === 'browse') { G.Shop.open('fennick'); return; }
    if (v === 'leave') { await G.UI.say('fennick', out('merchant', 'leave')); return; }
    const stake = await G.UI.say('fennick', ['[happy] How much shall we wager, friend? Two stars of three, and I pay double!'], { choices: [100, 250, 500].filter((x) => S.gold >= x).map((x) => ({ label: `${x} ✦`, value: x })).concat([{ label: 'Never mind', value: 0 }]) });
    if (!stake) return;
    S.gold -= stake;
    G.sfx('dice_roll');
    const stars = await E.roll("Fennick's dice", 3, 2);
    if (stars >= 2) { S.gold += stake * 2; await G.UI.say('fennick', out('merchant', 'win')); G.UI.toast(`You won ${stake * 2} ✦!`); }
    else await G.UI.say('fennick', out('merchant', 'lose'));
  };

  // ---------------------------------------------------------------- hooks
  G.on('newDay', () => {
    E.newDay(false);
    // parcels from people you've helped
    const S = G.S;
    if (S.parcels && S.parcels.length) {
      const due = S.parcels.filter((p) => p.day <= S.day);
      S.parcels = S.parcels.filter((p) => p.day > S.day);
      for (const p of due) {
        setTimeout(() => { G.UI.say(null, out('traveller', 'gift')).then(() => { for (const [id, n] of p.items) G.Inv.giveOrDrop(id, n); if (p.glimmer) { S.gold += p.glimmer; G.UI.toast(`+${p.glimmer} ✦`); } }); }, 3200);
      }
    }
  });
  G.on('worldStart', (isNew) => { if (isNew || !Object.values(W().maps).some((m) => [...m.tobj.values()].some((o) => o.kind === 'encounter'))) E.newDay(isNew); E.updateVisibility(); });
  G.on('tick', () => E.updateVisibility());
})();
