// Nightvale — a simple spellbook. Orvyn hands it over once you reach floor 5 of the Depths. Mana is a third
// bar (max 50) that refills slowly and with Mana Draughts. Spells: Lumen (a light that follows you),
// Verdance (nearby crops grow a day), Blink (a short hop forward), Frostbolt (a slowing bolt).
// Q casts the chosen spell; Tab picks the next one (or click the spell chip in the HUD).
(function () {
  'use strict';
  const G = window.G, U = G.U, I = G.ITEMS;
  const Mg = (G.Magic = {});
  const SPELLS = {
    lumen: { name: 'Lumen', cost: 8, icon: 'spell_lumen' },
    verdance: { name: 'Verdance', cost: 20, icon: 'spell_verdance' },
    blink: { name: 'Blink', cost: 10, icon: 'spell_blink' },
    frostbolt: { name: 'Frostbolt', cost: 6, icon: 'spell_frostbolt' },
  };
  Mg.SPELLS = SPELLS;
  // scrolls that write a spell into the book
  for (const k of ['lumen', 'verdance', 'blink', 'frostbolt']) I['spell_' + k] = { id: 'spell_' + k, name: `Spell Scroll: ${SPELLS[k].name}`, cat: 'misc', sell: 0, stack: 1, spellScroll: k };
  G.SHOPS.orvyn.stock.push(['spell_verdance', 1600, (s) => s.magic && s.magic.book], ['spell_frostbolt', 1200, (s) => s.magic && s.magic.book && s.maxDepth >= 10], ['spell_blink', 2200, (s) => s.magic && s.magic.book && s.maxDepth >= 15], ['pot_mana', 280, (s) => s.magic && s.magic.book], ['scroll_pot_mana', 600, (s) => s.magic && s.magic.book]);

  const M = () => G.S.magic || (G.S.magic = { book: false, mana: 50, max: 50, spells: [], sel: 0, lumen: 0, verd: {} });
  const TX = () => (window.GAMETEXT && GAMETEXT.spells) || null;
  Mg.has = () => !!M().book;
  Mg.addMana = function (n) { const m = M(); m.mana = Math.min(m.max, m.mana + n); };

  // Orvyn's lesson (talk to him after reaching floor 5)
  Mg.lessonDue = () => !M().book && G.S.maxDepth >= 5;
  Mg.lesson = async function () {
    const t = TX();
    await G.UI.say('orvyn', (t && t.lesson) || ['Here, a spellbook. Press Q to cast, Tab to switch spells.']);
    const m = M(); m.book = true; m.spells = ['lumen']; m.sel = 0; m.mana = m.max;
    G.Inv.giveOrDrop('spellbook', 1); G.jingle('discovery'); G.sfx('page_turn');
    G.UI.toast('You can cast Lumen now: press Q.', 'spell_lumen');
  };
  Mg.learn = function (k) {
    const m = M();
    if (!m.book) { G.UI.toast('You need a spellbook to write this in.'); G.sfx('error'); return false; }
    if (m.spells.includes(k)) { G.UI.toast(`Your spellbook already holds ${SPELLS[k].name}.`); return false; }
    m.spells.push(k); m.sel = m.spells.length - 1;
    G.sfx('page_turn'); G.jingle('discovery');
    const t = TX(); G.UI.toast(t && t[k] ? t[k] : `New spell: ${SPELLS[k].name}.`, SPELLS[k].icon);
    return true;
  };
  Mg.cycle = function () { const m = M(); if (!m.spells.length) return; m.sel = (m.sel + 1) % m.spells.length; G.sfx('page_turn', { volume: 0.4 }); G.UI._spellSig = ''; };
  Mg.current = () => { const m = M(); return m.spells[m.sel] || null; };

  // ---------------------------------------------------------------- casting
  Mg.cast = function () {
    const m = M(), W = G.World, p = W.player, map = W.map, k = Mg.current();
    if (!m.book || !k) return;
    const sp = SPELLS[k];
    if (m.mana < sp.cost) { G.UI.toastOnce('mana', `Not enough mana for ${sp.name} (${sp.cost}).`, 2); G.sfx('error', { volume: 0.5 }); return; }
    if (p.action) return;
    let ok = true;
    if (k === 'lumen') { m.lumen = 120; G.Mobs.fx('lumen_orb', p.x, p.y - 26, { sortY: p.y + 1 }); }
    else if (k === 'verdance') ok = verdance(map, p);
    else if (k === 'blink') ok = blink(map, p);
    else if (k === 'frostbolt') frostbolt(map, p);
    if (!ok) return;
    m.mana -= sp.cost;
    p.startAction('cast', { item: null, dur: 0.3, hitAt: 0.1 });
    G.sfx('cast_' + (k === 'frostbolt' ? 'frost' : k));
  };
  function verdance(map, p) {
    const S = G.S, [px, py] = p.feetTile, m = M();
    let n = 0;
    for (let y = py - 2; y <= py + 2; y++) for (let x = px - 2; x <= px + 2; x++) {
      const i = map.inb(x, y) ? map.idx(x, y) : -1, f = i >= 0 ? map.farm.get(i) : null;
      if (!f || !f.crop || G.Farm.ripe(f.crop)) continue;
      const key = map.id + ':' + i; if (m.verd[key] === S.day) continue;
      m.verd[key] = S.day; f.crop.days += 1; n++;
      G.Mobs.fx('grow_sparkle', x * 16 + 8, y * 16 + 14, { sortY: y * 16 + 16 });
    }
    if (!n) { G.UI.toastOnce('verd', 'Nothing nearby that Verdance can help grow today.', 3); return false; }
    G.UI.toast(`${n} ${n === 1 ? 'plant stretches' : 'plants stretch'} toward the stars.`);
    return true;
  }
  function blink(map, p) {
    const d = G.DIRS[p.dir];
    let best = null;
    for (let k = 1; k <= 4; k++) {
      const x = p.x + d[0] * 16 * k, y = p.y + d[1] * 16 * k;
      if (G.rectBlocked ? G.rectBlocked(map, x, y, p) : map.rectBlocked(x - p.bw / 2, y - p.bh, p.bw, p.bh)) continue;
      best = [x, y];
    }
    if (!best) { G.UI.toastOnce('blink', 'No room to blink there.', 2); return false; }
    G.Mobs.fx('blink_flash', p.x, p.y - 10, { sortY: p.y + 2 });
    p.x = best[0]; p.y = best[1];
    G.Mobs.fx('blink_flash', p.x, p.y - 10, { sortY: p.y + 2 });
    return true;
  }
  function frostbolt(map, p) {
    let dx, dy;
    const I2 = G.Input;
    if (I2.lastDevice === 'mouse' && I2.mouse.onCanvas) { const [wx, wy] = G.R.screenToWorld(I2.mouse.x, I2.mouse.y); dx = wx - p.x; dy = wy - (p.y - 10); }
    else { const d = G.DIRS[p.dir]; dx = d[0]; dy = d[1]; }
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    p.dir = G.dirFromVec(dx, dy);
    map.entities.push(new G.Projectile({ x: p.x + dx * 10, y: p.y - 10 + dy * 8, vx: dx * 200, vy: dy * 200, dmg: { amt: 8 + Math.floor(Math.random() * 5), crit: false }, from: 'player', fx: 'frost_bolt', life: 0.9, frost: true, color: [170, 230, 255], light: true }));
  }

  // ---------------------------------------------------------------- per-frame
  Mg.update = function (dt) {
    const m = M();
    if (!m.book) return;
    m.regen = (m.regen || 0) + dt;
    if (m.regen >= 5) { m.regen = 0; m.mana = Math.min(m.max, m.mana + 1); }
    if (m.lumen > 0) m.lumen -= dt;
  };
  Mg.lights = function (out) {
    const m = G.S && G.S.magic; if (!m || !(m.lumen > 0)) return;
    const p = G.World.player, t = G.R.time;
    out.push({ x: p.x + Math.sin(t * 1.7) * 12, y: p.y - 30 + Math.sin(t * 2.3) * 3, r: 104, color: [255, 236, 190], i: Math.min(1, m.lumen / 5), flicker: 0 });
  };
  Mg.drawables = function (list) {
    const m = G.S && G.S.magic; if (!m || !(m.lumen > 0)) return;
    const p = G.World.player, t = G.R.time;
    list.push({
      sortY: p.y + 2,
      draw(ctx, ox, oy) {
        const x = p.x + Math.sin(t * 1.7) * 12, y = p.y - 30 + Math.sin(t * 2.3) * 3;
        const c = G.Mobs.fxFrame && G.Mobs.fxFrame('lumen_orb', Math.floor(t * 8) % 4);
        if (c) ctx.drawImage(c, Math.round(x - 5 + ox), Math.round(y - 5 + oy));
        else { ctx.fillStyle = '#fff1c8'; ctx.fillRect(Math.round(x - 2 + ox), Math.round(y - 2 + oy), 4, 4); }
      },
    });
  };
  G.on('newDay', () => { const m = G.S.magic; if (m) { m.mana = m.max; m.lumen = 0; } });
})();
