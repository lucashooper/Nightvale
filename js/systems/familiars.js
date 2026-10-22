// Nightvale — familiars: an owl, a fox or a luna moth chosen at the Bonding Stone in Hushwillow Glade.
// It follows you everywhere. Pet it daily to grow your bond. The owl brings a find each day and hoots near
// the hidden ladder in the Depths; the fox digs things up and nips at monsters; the moth lights the dark
// and brings a little luck.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const F = (G.Familiars = {});
  const TX = () => (window.GAMETEXT && GAMETEXT.familiars) || null;
  const KIND = { fam_owl: 'owl', fam_fox: 'fox', fam_moth: 'moth' };
  const NAMES = { fam_owl: 'Hoot', fam_fox: 'Ember', fam_moth: 'Lumi' };
  const LABEL = { fam_owl: 'An owl', fam_fox: 'A fox', fam_moth: 'A luna moth' };
  const st = () => G.S && G.S.familiar;
  const ent = { x: 0, y: 0, anim: 'idle', t: 0, flip: false, still: 0, nip: 0, heart: 0, hop: 0 };
  F.ent = ent;

  F.statBonus = (stat) => (st() && st().type === 'fam_moth' && stat === 'luck' ? 1 : 0);
  F.info = function (type) {
    try { if (window.MobArt && MobArt.familiarInfo) return MobArt.familiarInfo(type); } catch (e) { /* fallback */ }
    return { w: 16, h: 16, ax: 8, ay: 15, anims: { idle: 2 }, fps: { idle: 2 } };
  };

  // ---------------------------------------------------------------- the Bonding Stone
  F.bondingStone = async function () {
    const S = G.S, t = TX();
    if (!S.flags.bondIntro) { S.flags.bondIntro = true; await G.UI.say('elowen', (t && t.bonding) || ['This is the Bonding Stone. Choose a familiar.']); }
    if (st()) {
      const ok = await G.UI.confirm(`Choose a different familiar? ${st().name} will go back to the glade (you can always choose again).`, 'Choose again', 'Stay together');
      if (!ok) return;
    }
    const type = await G.UI.say(null, ['You rest your hand on the stone. Its three glyphs glow in turn. Who will walk with you?'], { choices: [{ label: 'The owl', value: 'fam_owl' }, { label: 'The fox', value: 'fam_fox' }, { label: 'The luna moth', value: 'fam_moth' }, { label: 'Not yet', value: null }] });
    if (!type) return;
    G.sfx('mystery_chime');
    const k = KIND[type];
    await G.UI.say(null, (t && t[k] && t[k].choose) || [`${LABEL[type]} comes to you.`]);
    const name = await G.UI.open('nameFamiliar', { type });
    S.familiar = { type, name: (name || NAMES[type]).slice(0, 16), bond: 0, pet: 0, gift: 0, since: S.day };
    F.place(true);
    G.sfx(type === 'fam_owl' ? 'fam_owl' : type === 'fam_fox' ? 'fam_fox' : 'fam_moth'); G.jingle('discovery');
    ent.heart = 1.4;
    G.UI.toast(`${S.familiar.name} will walk with you now. Pet them every day.`);
    G.emit('familiar', type);
  };
  G.UI.panels.nameFamiliar = function (panel, m) {
    const el = G.UI.el, type = m.data.type;
    m.noBgClose = true;
    panel.appendChild(el('h2', '', 'Name your familiar'));
    const cv = el('canvas', 'famcv'); cv.width = 64; cv.height = 64;
    try { const c = MobArt.familiar(type, type === 'fam_owl' ? 'perch' : type === 'fam_fox' ? 'idle' : 'flutter', 0, false); const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; const s = Math.floor(56 / Math.max(c.width, c.height)); x.drawImage(c, (64 - c.width * s) / 2, (64 - c.height * s) / 2, c.width * s, c.height * s); } catch (e) { /* optional */ }
    const row = el('div', 'row'); row.style.alignItems = 'center'; row.appendChild(cv);
    const inp = el('input', 'txt-in'); inp.type = 'text'; inp.maxLength = 16; inp.value = NAMES[type]; inp.setAttribute('aria-label', 'Familiar name');
    row.appendChild(inp); panel.appendChild(row);
    const ok = el('button', 'btn gold', 'That\'s their name'); ok.onclick = () => m.close(inp.value.trim() || NAMES[type]);
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') ok.click(); });
    const r2 = el('div', 'row'); r2.style.marginTop = '12px'; r2.appendChild(ok); panel.appendChild(r2);
    m.onKey = () => {};
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  };

  // ---------------------------------------------------------------- following & abilities
  F.place = function () { const p = G.World.player; if (!p) return; ent.x = p.x - 14; ent.y = p.y + 2; ent.still = 0; ent.anim = 'idle'; ent.hooted = null; };
  G.on('mapChanged', () => { if (st()) F.place(); });
  F.update = function (dt, map) {
    const f = st(), p = G.World.player;
    if (!f || !p) return;
    ent.t += dt; if (ent.heart > 0) ent.heart -= dt;
    const moving = p.moving;
    ent.still = moving ? 0 : ent.still + dt;
    let tx, ty, speed = 4;
    if (f.type === 'fam_owl') {
      if (ent.still > 0.7) { tx = p.x + 4; ty = p.y + 1; ent.anim = ent.still > 9 ? 'sleep' : 'perch'; speed = 10; ent.perched = true; }
      else { const d = G.DIRS[p.dir]; tx = p.x - d[0] * 16 - 10; ty = p.y - d[1] * 10 + 2; ent.anim = 'fly'; ent.perched = false; }
    } else if (f.type === 'fam_fox') {
      const d = G.DIRS[p.dir]; tx = p.x - d[0] * 18 + (d[1] ? 12 : 0); ty = p.y - d[1] * 14 + 2;
      const far = Math.hypot(tx - ent.x, ty - ent.y);
      ent.anim = far > 6 ? 'run' : ent.still > 6 ? 'sleep' : 'idle';
    } else { // moth: a lazy figure-eight around you
      const a = ent.t * 1.3; tx = p.x + Math.sin(a) * 16; ty = p.y + 2 + Math.sin(a * 2) * 5; ent.anim = 'flutter'; speed = 6;
    }
    const k = 1 - Math.exp(-speed * dt);
    const ox = ent.x;
    ent.x += (tx - ent.x) * k; ent.y += (ty - ent.y) * k;
    if (Math.abs(ent.x - ox) > 0.05) ent.flip = ent.x < ox;
    if (f.type === 'fam_owl' && ent.perched) ent.flip = p.dir === 'left';
    // the fox nips at monsters
    if (f.type === 'fam_fox' && map.entities.length) {
      ent.nip -= dt;
      if (ent.nip <= 0) {
        const m = map.entities.find((e) => e.mob && !e.dead && e.dying <= 0 && Math.hypot(e.x - ent.x, e.y - ent.y) < 40);
        if (m) { ent.nip = 2.2 - Math.min(0.8, f.bond * 0.08); ent.x = m.x - (m.x > ent.x ? 10 : -10); G.Mobs.damage(m, { amt: 3 + Math.floor(Math.random() * 4) + Math.floor(f.bond / 3), crit: false }, ent.x, ent.y); G.sfx('fam_fox', { volume: 0.5 }); }
        else ent.nip = 0.4;
      }
    }
    // once a day: the owl brings a find, the fox digs something up
    const S = G.S;
    if (f.gift !== S.day && map.outdoor && S.mins > 420 && (f.type === 'fam_owl' || f.type === 'fam_fox')) {
      f.giftT = (f.giftT || 20 + Math.random() * 40) - dt;
      if (f.giftT <= 0 && moving) { f.giftT = null; f.gift = S.day; F.gift(map); }
    }
    // the owl knows where the way down is hiding
    if (f.type === 'fam_owl' && map.id === 'depths' && !map.downRevealed && ent.hooted !== map.floor) {
      for (const o of map.tobj.values()) if (o.hidesLadder && Math.hypot(o.tx * 16 + 8 - p.x, o.ty * 16 + 8 - p.y) < 5 * 16) {
        ent.hooted = map.floor; G.sfx('fam_owl'); o.shake = 0.6;
        const t = TX(); G.UI.toast(t && t.gifts && t.gifts.hoot ? G.UI.fill(U.pick(t.gifts.hoot)) : 'Your owl hoots at one particular rock.');
        break;
      }
    }
  };
  F.gift = function (map) {
    const f = st(), S = G.S, t = TX();
    const ent0 = ent;
    let id;
    if (f.type === 'fam_fox' && Math.random() < 0.35) {
      const g = 30 + Math.floor(Math.random() * 60) + f.bond * 5; S.gold += g;
      G.UI.toast((t && t.gifts && t.gifts.glimmer ? G.UI.fill(U.pick(t.gifts.glimmer)) : 'Your fox digs up some glimmer!') + ` +${g} ✦`);
      G.sfx('dig'); G.sfx('coin');
      return;
    }
    const pool = f.type === 'fam_owl'
      ? [['feather', 4], ['fairycap', 3], ['wolfsbane', 3], ['moonlily', 2], ['honey', 1], ['starshard', 1], ['wisp_essence', f.bond >= 5 ? 1 : 0]]
      : [['relic_coin', 2], ['driftwood', 2], ['amethyst', 1], ['bog_amber', 1], ['golden_acorn', f.bond >= 6 ? 0.6 : 0.2], ['relic_idol', f.bond >= 8 ? 0.4 : 0.1], ['shell', 2]];
    id = U.rng(S.seed + S.day * 13).weighted(pool);
    G.dropItem(map, id, 1, ent0.x, ent0.y - 2);
    if (f.type === 'fam_fox') { G.sfx('dig'); G.R.burst(ent0.x, ent0.y, 10, { colors: ['#56425f', '#7d6c82'], speed: 35, life: 0.5 }); }
    else G.sfx('fam_owl');
    const lines = t && t.gifts && t.gifts[KIND[f.type]];
    G.UI.toast(lines ? G.UI.fill(U.pick(lines), { item: G.item(id).name }) : `Your familiar brings you ${G.item(id).name}.`);
  };

  // ---------------------------------------------------------------- petting & treats
  F.at = function (wx, wy, tx, ty) {
    const f = st(); if (!f) return false;
    if (wx != null && Math.abs(wx - ent.x) < 10 && wy > ent.y - 22 && wy < ent.y + 4) return true;
    return Math.floor(ent.x / 16) === tx && Math.floor((ent.y - 4) / 16) === ty;
  };
  F.pet = function () {
    const f = st(), S = G.S, t = TX();
    ent.heart = 1.4; ent.still = 0;
    G.sfx(f.type === 'fam_owl' ? 'fam_owl' : f.type === 'fam_fox' ? 'fam_fox' : 'fam_moth'); G.sfx('fam_happy', { volume: 0.6 });
    const sel = G.Inv.selected();
    if (sel && sel.id === 'fam_treat' && f.treat !== S.day) {
      G.Inv.removeAt(S.sel, 1); f.treat = S.day; f.bond = Math.min(10, f.bond + 1);
      G.UI.toast(`${f.name} devours the treat and looks at you adoringly. (Bond ${f.bond}/10)`);
      return;
    }
    if (f.pet !== S.day) { f.pet = S.day; f.bond = Math.min(10, f.bond + 0.5); S.energy = Math.min(S.maxEnergy, S.energy + 5); }
    const lines = t && t[KIND[f.type]] && t[KIND[f.type]].pet;
    G.UI.toast(lines ? G.UI.fill(U.pick(lines)) : `${f.name} is happy to see you.`);
  };

  // ---------------------------------------------------------------- drawing & light
  F.drawables = function (list) {
    const f = st(); if (!f) return;
    const info = F.info(f.type);
    const sortY = f.type === 'fam_owl' && ent.perched ? G.World.player.y + 1 : f.type === 'fam_moth' ? ent.y + 2 : ent.y;
    list.push({
      sortY,
      draw(ctx, ox, oy) {
        const n = (info.anims && info.anims[ent.anim]) || 1, fr = Math.floor(ent.t * ((info.fps && info.fps[ent.anim]) || 4)) % n;
        let c = null;
        try { if (window.MobArt && MobArt.familiar) c = MobArt.familiar(f.type, ent.anim, fr, ent.flip); } catch (e) { c = null; }
        let x = ent.x, y = ent.y;
        if (f.type === 'fam_owl') y -= ent.perched ? 22 : 18 + Math.sin(ent.t * 6) * 2;
        if (f.type === 'fam_moth') y -= 20;
        if (f.type === 'fam_owl' || f.type === 'fam_moth') { ctx.globalAlpha = 0.25; ctx.fillStyle = '#0e0818'; ctx.fillRect(Math.round(ent.x - 4 + ox), Math.round(ent.y - 1 + oy), 8, 2); ctx.globalAlpha = 1; }
        if (c) ctx.drawImage(c, Math.round(x - info.ax + ox), Math.round(y - info.ay + oy));
        else { ctx.fillStyle = '#b99aee'; ctx.fillRect(Math.round(x - 4 + ox), Math.round(y - 8 + oy), 8, 8); }
        if (ent.heart > 0) {
          const hy = Math.round(y - info.ay - 6 + oy - (1.4 - ent.heart) * 8), hx = Math.round(x + ox);
          ctx.fillStyle = '#e8607e'; ctx.fillRect(hx - 3, hy, 2, 2); ctx.fillRect(hx + 1, hy, 2, 2); ctx.fillRect(hx - 2, hy + 2, 4, 1); ctx.fillRect(hx - 1, hy + 3, 2, 1);
        }
      },
    });
  };
  F.lights = function (out) {
    const f = st(); if (!f || f.type !== 'fam_moth') return;
    const map = G.World.map, dark = map.id === 'depths' || map.id === 'deepwood' || !map.outdoor;
    out.push({ x: ent.x, y: ent.y - 20, r: dark ? 84 : 46, color: [200, 255, 210], i: dark ? 0.85 : 0.55, night: !dark, flicker: 0 });
  };
})();
