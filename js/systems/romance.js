// Nightvale — courting (Stardew-style): hearts stop at 8 until you give a Moonflower Bouquet, then you're dating
// and can reach 10 (with a 10-heart scene). At 10 hearts a Moonstone Pendant makes them your partner: they move
// into the keeper's cottage, greet you in the mornings and evenings, and now and then leave a gift or water crops.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const R = (G.Romance = {});
  function st() { const S = G.S; if (!S.romance) S.romance = { dating: {}, h10: {} }; return S.romance; }
  R.state = st;
  R.dating = (id) => !!st().dating[id];
  R.partner = () => G.S.partner || null;
  R.cap = (id) => (G.NPCs.ROMANCE.includes(id) && !R.dating(id) ? 8 : 10);
  const name = (id) => G.UI.npcName(id);

  R.talk = async function (n) {
    const S = G.S, id = n.id, fr = S.friends[id], t = G.UI.npcText(id), rom = t && t.romance, s = st();
    // your partner, at home
    if (S.partner === id && rom && rom.partner && (G.World.map.id === 'cottage' || G.World.map.id === 'sanctum') && fr.talked !== S.day) {
      fr.talked = S.day; fr.pts = Math.min(1000, fr.pts + 10);
      const lines = S.mins < 720 ? rom.partner.morning : rom.partner.evening;
      await G.UI.say(id, [U.pick(lines || ['[happy] Hi, love.'])]);
      return true;
    }
    if (!rom || !G.NPCs.ROMANCE.includes(id)) return false;
    // the 10-heart scene, once you're together
    if (s.dating[id] && G.NPCs.hearts(id) >= 10 && !s.h10[id] && rom.heart10) {
      s.h10[id] = true;
      await G.UI.say(id, rom.heart10.pages || ['...']);
      const r = rom.heart10.reward;
      if (r && r.item) { G.Inv.giveOrDrop(r.item, r.qty || 1); G.UI.toast(`${name(id)} gave you ${G.item(r.item).name}.`, r.item); }
      if (r && r.glimmer) { S.gold += r.glimmer; G.UI.toast(`+${U.fmtNum(r.glimmer)} ✦`); }
      G.jingle('heart_up');
      return true;
    }
    const sel = G.Inv.selected(), it = sel && G.item(sel.id);
    if (it && it.romance === 'bouquet') {
      if (s.dating[id]) { await G.UI.say(id, ['[happy] We\'re already together, you know. Keep it for your windowsill.']); return true; }
      if (G.NPCs.hearts(id) < 8) { await G.UI.say(id, rom.bouquetEarly || ['[surprised] Oh! That\'s... very sweet. But I think we should get to know each other better first.']); return true; }
      const ok = await G.UI.confirm(`Give ${name(id)} the Moonflower Bouquet?`, 'Give it', 'Not yet');
      if (!ok) return true;
      G.Inv.remove('bouquet', 1); s.dating[id] = true; fr.pts = Math.min(1000, fr.pts + 60);
      n.emote = 'heart'; n.emoteT = 3;
      await G.UI.say(id, rom.bouquet || ['[happy] Yes. Yes!']);
      G.jingle('heart_up'); G.R.burst(n.x, n.y - 24, 18, { colors: ['#ff9ac8', '#ffd1e3', '#ffffff'], speed: 40, life: 1, grav: -30 });
      G.UI.toast(`You're dating ${name(id)}! Hearts can now grow to 10.`);
      return true;
    }
    if (it && it.romance === 'pendant') {
      if (S.partner) { await G.UI.say(id, [S.partner === id ? '[happy] I already wear yours, remember? Every day.' : '[sad] It\'s beautiful. But your heart\'s already spoken for, isn\'t it?']); return true; }
      if (!s.dating[id] || G.NPCs.hearts(id) < 10) { await G.UI.say(id, ['[surprised] A pendant? That\'s... a big question. Ask me again when we\'re further along. Please do ask again, though.']); return true; }
      const ok = await G.UI.confirm(`Offer ${name(id)} the Moonstone Pendant? You'll share the keeper's cottage.`, 'Offer it', 'Not yet');
      if (!ok) return true;
      G.Inv.remove('pendant', 1); S.partner = id;
      n.emote = 'heart'; n.emoteT = 4;
      await G.UI.say(id, rom.pendant || ['[happy] Yes. Of course, yes.']);
      G.jingle('altar_restored'); G.R.doFlash('255,220,235', 0.4);
      G.UI.toast(`${name(id)} is moving into the keeper's cottage!`);
      G.NPCs.refreshTargets();
      return true;
    }
    // sweet nothings while dating
    if (s.dating[id] && fr.talked !== S.day && rom.dating && Math.random() < 0.5) {
      fr.talked = S.day; fr.pts = Math.min(1000, fr.pts + 10);
      await G.UI.say(id, [U.pick(rom.dating)]);
      return true;
    }
    return false;
  };

  // a partner's day: mornings and evenings at the cottage, their usual day in between
  R.wrapSchedule = function (id, list) {
    if (G.S.partner !== id) return list;
    const h = (hh, mm) => hh * 60 + (mm || 0);
    // their usual day from nine to eight, starting wherever they'd already be at nine
    const day = []; let carry = null;
    for (const e of list) { if (e[0] < h(9)) { carry = e; continue; } if (e[0] < h(20) && e[1]) day.push(e); }
    if (carry && carry[1] && !(carry[5] && carry[5].hide) && !(day[0] && day[0][0] === h(9))) day.unshift([h(9), ...carry.slice(1)]);
    return [[0, null], [h(6), 'cottage', 9.5, 6.6, 'down'], ...day, [h(20), 'cottage', 8.5, 7.6, 'down'], [h(23, 30), 'cottage', 9.5, 6.6, 'up', { hide: true }]];
  };

  // morning kindnesses
  G.on('newDay', () => {
    const S = G.S, id = S.partner; if (!id) return;
    const t = G.UI.npcText(id), rom = t && t.romance;
    const r = U.rng(S.seed + S.day * 37);
    if (r() < 0.25) {
      const taste = G.NPCs.TASTES[id], pool = (taste && taste.like) || ['food_bread'];
      const gift = U.pick(pool.filter((x) => G.ITEMS[x])) || 'food_bread';
      G.Inv.giveOrDrop(gift, 1);
      const line = rom && rom.partner && rom.partner.gift ? G.UI.fill(U.pick(rom.partner.gift), { item: G.item(gift).name }).replace(/^\s*\[\w+\]\s*/, '') : `I found this for you.`;
      setTimeout(() => G.UI.toast(`${name(id)}: “${line}”`, gift), 2600);
    } else if (r() < 0.3) {
      const m = G.World.maps.sanctum; let k = 0;
      if (m) for (const f of m.farm.values()) if (f.crop && !f.watered && k < 8) { f.watered = true; k++; }
      if (k) setTimeout(() => G.UI.toast(`${name(id)} watered ${k} of your crops this morning.`), 2600);
    }
  });
})();
