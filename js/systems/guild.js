// Nightvale — the Silver Crescent Guild: Gideon's contract board (hunts, gathers and named bounties), up to three
// contracts at a time, a fresh board every three days, guild ranks, and the four bounty bosses and how they fight.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Gd = (G.Guild = {});
  const MAX_ACTIVE = 3;
  const BOSS_NAMES = { slime_ogre: 'Gloopgarr the Slime Ogre', grimjaw: 'Old Grimjaw', lantern_thief: 'The Lantern Thief', deep_wyrm: 'Vorrakh, the Deep Wyrm' };

  function st() {
    const S = G.S;
    if (!S.guild) S.guild = { rank: 0, pts: 0, cycle: -1, board: [], active: [], done: {}, slain: {}, seen: false, completed: 0 };
    return S.guild;
  }
  Gd.state = st;
  const def = (id) => G.CONTRACTS[id];
  const txt = (id) => (window.GAMETEXT && GAMETEXT.guild && GAMETEXT.guild.contracts && GAMETEXT.guild.contracts[id]) || {};
  const words = (k) => (window.GAMETEXT && GAMETEXT.guild && GAMETEXT.guild.board && GAMETEXT.guild.board[k]) || '';
  const fill = (s, c) => G.UI.fill(String(s || '')).replace(/\{n\}/g, c.n);
  Gd.title = (c) => txt(c.id).title || c.id;
  Gd.notice = (c) => fill(txt(c.id).notice, c);
  Gd.hint = (c) => fill(txt(c.id).hint, c);
  Gd.def = def;
  Gd.rankName = (r) => G.GUILD_RANKS[Math.min(r, G.GUILD_RANKS.length - 1)].name;
  Gd.cycle = () => Math.floor((G.S.day - 1) / 3);
  Gd.daysToRefresh = () => 3 - ((G.S.day - 1) % 3);
  Gd.member = () => !!(G.S && G.S.guild && G.S.guild.seen);

  // ---------------------------------------------------------------- the board
  Gd.refresh = function () {
    const g = st(), S = G.S, cyc = Gd.cycle();
    if (g.cycle === cyc && g.board.length) return false;
    const fresh = g.cycle !== -1;
    g.cycle = cyc;
    const r = U.rng(S.seed + cyc * 7919 + 17);
    const taken = new Set(g.active.map((a) => a.id));
    const ok = (id) => { const c = def(id); return c.rank <= g.rank && !taken.has(id) && !(c.kind === 'bounty' && g.slain[c.target]); };
    const ids = Object.keys(G.CONTRACTS).filter(ok);
    const of = (k) => ids.filter((id) => def(id).kind === k);
    const pickN = (arr, n) => { const a = arr.slice(), out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; };
    const chosen = [];
    let bounties = of('bounty');
    // Gloopgarr is the Guild's standing nuisance: his notice stays up until somebody deals with him
    if (bounties.includes('bounty_gloopgarr')) { chosen.push('bounty_gloopgarr'); bounties = bounties.filter((b) => b !== 'bounty_gloopgarr'); }
    if (bounties.length && (!chosen.length || g.rank >= 2) && r() < 0.85) chosen.push(...pickN(bounties, 1));
    chosen.push(...pickN(of('hunt'), 2 + (r() < 0.5 ? 1 : 0)));
    chosen.push(...pickN(of('gather'), 1 + (r() < 0.6 ? 1 : 0)));
    g.board = chosen.slice(0, 6).map((id) => { const c = def(id); return { id, n: c.n[0] + Math.floor(r() * (c.n[1] - c.n[0] + 1)) }; });
    if (fresh && G.World.map && G.World.map.id === 'guild') G.UI.toast(words('refresh') || 'Fresh notices on the contract board.', 'contract');
    return true;
  };
  Gd.accept = function (i) {
    const g = st(), c = g.board[i];
    if (!c) return false;
    if (g.active.length >= MAX_ACTIVE) { G.sfx('error'); G.UI.toast(words('full') || 'You already carry three contracts.'); return false; }
    g.board.splice(i, 1);
    const a = { id: c.id, n: c.n, got: 0, day: G.S.day };
    g.active.push(a);
    G.sfx('cloth_rustle'); G.sfx('quest_complete', { volume: 0.35 });
    const d = def(c.id);
    G.UI.toast(`Contract accepted: ${Gd.title(a)}${d.kind === 'gather' && Gd.complete(a) ? ' (you already have enough!)' : ''}`, d.icon);
    Gd.spawnCheck(G.World.map);
    G.emit('guild');
    return true;
  };
  Gd.abandon = function (k) {
    const g = st(), a = g.active[k];
    if (!a) return;
    g.active.splice(k, 1);
    G.sfx('cloth_rustle');
    G.UI.toast(`Contract abandoned: ${Gd.title(a)}.`);
    G.emit('guild');
  };
  Gd.progress = function (a) {
    const c = def(a.id); if (!c) return 0;
    if (c.kind === 'gather') return Math.min(a.n, G.Inv.count(c.target));
    return Math.min(a.n, a.got);
  };
  Gd.complete = (a) => Gd.progress(a) >= a.n;
  Gd.where = function (a) { const c = def(a.id); return c && c.kind === 'bounty' ? Gd.hint(a) : ''; };
  // the HUD tracker shows a finished contract so you know to go back
  Gd.trackerLine = function () {
    const g = G.S && G.S.guild; if (!g) return null;
    const done = g.active.find(Gd.complete);
    if (done) return { text: `Contract done: ${Gd.title(done)}`, sub: 'Return to Gideon at the Guild hall in the south quarter for your reward.' };
    return null;
  };

  // hunts and bounties count kills; gathers notice when you've picked up enough
  G.on('kill', (type) => {
    const g = G.S && G.S.guild; if (!g) return;
    for (const a of g.active) {
      const c = def(a.id); if (!c || c.kind === 'gather') continue;
      const targets = Array.isArray(c.target) ? c.target : [c.target];
      if (!targets.includes(type) || a.got >= a.n) continue;
      a.got++;
      if (a.got >= a.n) { G.UI.toast(`Contract complete: ${Gd.title(a)}. Return to Gideon.`, c.icon); G.sfx('quest_complete', { volume: 0.6 }); }
      else if (c.kind === 'hunt' && (a.got === Math.ceil(a.n / 2))) G.UI.toast(`${Gd.title(a)}: ${a.got} of ${a.n}`, c.icon);
    }
  });
  G.on('pickup', (id) => {
    const g = G.S && G.S.guild; if (!g) return;
    for (const a of g.active) {
      const c = def(a.id); if (!c || c.kind !== 'gather' || c.target !== id || a.told) continue;
      if (Gd.complete(a)) { a.told = true; G.UI.toast(`You have enough for "${Gd.title(a)}". Bring it to Gideon.`, c.icon); G.sfx('quest_complete', { volume: 0.5 }); }
    }
  });

  // ---------------------------------------------------------------- Gideon: joining, turning in, ranks
  Gd.gideon = async function (n) {
    const g = st(), T = (window.GAMETEXT && GAMETEXT.guild) || {};
    if (!g.seen) {
      g.seen = true;
      await G.UI.say('gideon', T.intro || ['Welcome to the Silver Crescent. That\'s the board. Pick a contract.']);
      G.Inv.giveOrDrop('guild_badge_1', 1);
      G.UI.toast('You joined the Silver Crescent Guild: Copper rank.', 'guild_badge_1');
      G.jingle('discovery');
      Gd.refresh();
      return true;
    }
    const ready = g.active.filter(Gd.complete);
    if (!ready.length) return false;
    for (const a of ready) {
      const c = def(a.id);
      if (c.kind === 'gather') G.Inv.remove(c.target, a.n);
      g.active.splice(g.active.indexOf(a), 1);
      g.done[a.id] = (g.done[a.id] || 0) + 1; g.completed++;
      const done = txt(a.id).done;
      await G.UI.say('gideon', [done ? fill(done, a) : '[happy] Clean work. Here.']);
      G.S.gold += c.rw; G.S.stats.earned = (G.S.stats.earned || 0) + c.rw; g.pts += c.rp;
      const fr = G.S.friends.gideon; if (fr) fr.pts = Math.min(1000, fr.pts + 20);
      G.UI.toast(`+${U.fmtNum(c.rw)} ✦ · +${c.rp} guild rank`, c.icon);
      G.sfx('coin'); G.jingle('quest_complete');
    }
    while (g.rank < G.GUILD_RANKS.length - 1 && g.pts >= G.GUILD_RANKS[g.rank + 1].pts) {
      g.rank++;
      const key = ['', 'silver', 'gold', 'moonsteel'][g.rank];
      await G.UI.say('gideon', (T.rankUp && T.rankUp[key]) || [`[happy] ${Gd.rankName(g.rank)} rank. You've earned it.`]);
      G.Inv.giveOrDrop('guild_badge_' + (g.rank + 1), 1);
      G.UI.toast(`Guild rank: ${Gd.rankName(g.rank)}! Harder contracts are on the board.`, 'guild_badge_' + (g.rank + 1));
      G.jingle('altar_restored');
      g.cycle = -2; Gd.refresh(); // new notices for the new rank
    }
    G.emit('guild');
    G.Save.save();
    return true;
  };

  // ---------------------------------------------------------------- the board UI (pinned notices on dark wood)
  const skulls = (n) => `<span class="skulls" aria-label="${n} of 5 skulls">${[1, 2, 3, 4, 5].map((k) => `<i class="${k > n ? 'off' : ''}"></i>`).join('')}</span>`;
  Gd.openBoard = function () {
    const g = st();
    if (!g.seen) { G.UI.toast('Gideon will want a word before you take a contract. He\'s at the desk.'); const n = G.NPCs.get('gideon'); if (n && G.NPCs.present('gideon', G.World.map.id)) G.NPCs.interact(n); return; }
    Gd.refresh();
    G.sfx('cloth_rustle');
    G.UI.open('guildboard');
  };
  G.UI.panels.guildboard = function (panel, m) {
    const g = st(), UI = G.UI, el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
    panel.classList.add('gboard');
    panel.appendChild(UI.closeBtn(m));
    const badge = 'guild_badge_' + (g.rank + 1), next = G.GUILD_RANKS[g.rank + 1];
    panel.appendChild(el('div', 'gb-plaque', `<span class="gb-t">Silver Crescent Guild · Contracts</span><span class="gb-r"><img src="${UI.iconURL(badge)}" alt="">${Gd.rankName(g.rank)}${next ? ` <span class="muted">${g.pts} / ${next.pts}</span>` : ''}</span><span class="gb-d">New notices in ${Gd.daysToRefresh()} day${Gd.daysToRefresh() === 1 ? '' : 's'}</span>`));
    const wrap = el('div', 'gb-wrap'); panel.appendChild(wrap);
    const pins = el('div', 'gb-pins'), open = el('div', 'gb-open');
    wrap.appendChild(pins); wrap.appendChild(open);
    const items = g.board.map((c, i) => ({ c, i, mine: false })).concat(g.active.map((c, i) => ({ c, i, mine: true })));
    if (m.sel == null || !items[m.sel]) m.sel = items.length ? 0 : null;
    const tilt = [-2.2, 1.6, -1, 2.1, -1.6, 1.2, -0.6, 1.8, -2];
    items.forEach((it, k) => {
      const d = def(it.c.id), nt = el('div', 'gb-note hit' + (k === m.sel ? ' on' : '') + (it.mine ? ' mine' : '') + (d.kind === 'bounty' ? ' bounty' : ''));
      nt.style.transform = `rotate(${tilt[k % tilt.length]}deg)`;
      const prog = it.mine ? `<span class="gb-prog">${Gd.complete(it.c) ? 'Done ✓' : `${Gd.progress(it.c)} / ${it.c.n}`}</span>` : `<span class="gb-rw">${U.fmtNum(d.rw)} ✦</span>`;
      nt.innerHTML = `${it.mine ? '<span class="gb-seal" aria-hidden="true"></span>' : ''}<img src="${UI.iconURL(d.icon)}" alt=""><b>${Gd.title(it.c)}</b>${skulls(d.sk)}${prog}`;
      nt.onclick = () => { m.sel = k; G.sfx('ui_click', { volume: 0.3 }); m.rerender(); };
      pins.appendChild(nt);
    });
    if (!items.length) pins.appendChild(el('div', 'gb-empty', words('empty') || 'The board is bare. New contracts arrive every three days.'));
    const it = items[m.sel];
    if (it) {
      const d = def(it.c.id), kind = { hunt: 'Hunt', gather: 'Gather', bounty: 'Bounty' }[d.kind];
      open.innerHTML = `<div class="gb-k">${kind}${d.kind === 'bounty' ? ' · a named beast' : ''}</div><div class="gb-ot">${Gd.title(it.c)}</div>${skulls(d.sk)}<p>${Gd.notice(it.c)}</p><div class="gb-hint">${Gd.hint(it.c)}</div>
        <div class="gb-meta"><span>${U.fmtNum(d.rw)} ✦ · +${d.rp} rank</span>${it.mine ? `<span>${Gd.complete(it.c) ? '<b class="ok">Done: see Gideon</b>' : `Progress ${Gd.progress(it.c)} / ${it.c.n}`}</span>` : ''}</div>`;
      const row = el('div', 'gb-act');
      if (it.mine) {
        const ab = el('button', 'btn ghost small', 'Abandon'); ab.onclick = async () => { const ok = await UI.confirm(`Abandon "${Gd.title(it.c)}"? It won't come back to the board.`, 'Abandon', 'Keep it'); if (ok) { Gd.abandon(it.i); m.sel = null; m.rerender(); } };
        row.appendChild(ab);
      } else {
        const ac = el('button', 'btn gold', 'Accept contract'); ac.disabled = g.active.length >= MAX_ACTIVE; ac.onclick = () => { if (Gd.accept(it.i)) { m.sel = g.board.length + g.active.length - 1; m.rerender(); } };
        row.appendChild(ac);
        row.appendChild(el('span', 'small muted', `${g.active.length} of ${MAX_ACTIVE} carried`));
      }
      open.appendChild(row);
    } else open.innerHTML = '<p class="muted">Nothing pinned up. Check back when the notices change.</p>';
  };

  // ---------------------------------------------------------------- bounty bosses: where and when they appear
  Gd.activeBounty = (target) => { const g = G.S && G.S.guild; return g && g.active.find((a) => def(a.id).kind === 'bounty' && def(a.id).target === target && a.got < a.n); };
  const tuning = () => G.BOSS_TUNING[(G.prefs && G.prefs.bossDifficulty) || 'balanced'] || G.BOSS_TUNING.balanced;
  function freeNear(map, cx, cy, rad) {
    for (let k = 0; k < 60; k++) {
      const x = Math.round(cx + (Math.random() - 0.5) * rad * 2), y = Math.round(cy + (Math.random() - 0.5) * rad * 2);
      if (map.inb(x, y) && !map.blocked(x, y) && !map.isWater(x, y) && !map.tobj.has(map.idx(x, y))) return [x, y];
    }
    return [Math.round(cx), Math.round(cy)];
  }
  function spawnBoss(map, type, tx, ty, floor) {
    const t = tuning(), b = G.Mobs.spawn(type, 'default', tx * 16 + 8, ty * 16 + 12, floor || 1);
    b.maxHp = b.hp = Math.round(b.maxHp * t.hp); b.dmg = Math.round(b.dmg * t.dmg);
    b.bountyBoss = true; b.bossName = BOSS_NAMES[type];
    b.onDeath = (m) => bossSlain(m);
    map.entities.push(b);
    G.Mobs.fx('spawn_rune', b.x, b.y - 2, { sortY: b.y - 8 });
    return b;
  }
  function bossSlain(m) {
    const g = st(), map = G.World.map;
    g.slain[m.type] = true;
    const a = g.active.find((x) => def(x.id).target === m.type);
    const tro = a && def(a.id).trophy;
    if (tro) G.dropItem(map, tro, 1, m.x, m.y - 6);
    G.UI.bossBar(null);
    G.R.doFlash('255,240,210', 0.35); G.R.shake(4, 0.6);
    G.jingle('quest_complete');
    setTimeout(() => G.UI.toast(`${BOSS_NAMES[m.type]} is slain! Take the news to Gideon.`, tro || 'contract'), 600);
  }
  Gd.spawnCheck = function (map) {
    if (!map || !G.S || !G.S.guild) return;
    const S = G.S, night = S.mins >= 1200 || S.mins < 360;
    const has = (t) => map.entities.some((e) => e.type === t && !e.dead);
    const p = G.World.player;
    if (map.id === 'woods' && Gd.activeBounty('slime_ogre') && !has('slime_ogre')) {
      const [x, y] = freeNear(map, 14, 42.5, 3); spawnBoss(map, 'slime_ogre', x, y);
      G.UI.toastOnce('gloop' + S.day, 'A wet, heavy squelch rolls across the bog…', 20);
    }
    if (map.id === 'deepwood' && night && Gd.activeBounty('grimjaw') && !has('grimjaw') && p) {
      const [x, y] = freeNear(map, p.x / 16 - 14, p.y / 16, 4);
      spawnBoss(map, 'grimjaw', x, y, 6);
      for (const d of [-2, 2]) { const w = G.Mobs.spawn('mosswolf', 'default', (x + d) * 16 + 8, (y + 1) * 16 + 12, 6); map.entities.push(w); }
      G.UI.toastOnce('grim' + S.day, 'A howl, close by. Then two more answer it.', 20);
    }
    if (map.id === 'lake' && (S.mins >= 1440 || S.mins < 300) && Gd.activeBounty('lantern_thief') && !has('lantern_thief')) {
      const [x, y] = freeNear(map, 24, 22, 3); const b = spawnBoss(map, 'lantern_thief', x, y, 4); b.aggro = false;
      G.UI.toastOnce('lant' + S.day, 'One by one, the dock lanterns are going out…', 20);
    }
    if (map.id === 'depths' && map.floor === 20 && Gd.activeBounty('deep_wyrm') && !has('deep_wyrm')) {
      const b = spawnBoss(map, 'deep_wyrm', Math.floor(map.w / 2), Math.floor(map.h / 2) + 1, 20); b.state = 'under'; b.faded = true; b.alpha = 0; b.t = 2.2;
      G.UI.toastOnce('wyrm' + S.day, 'The floor trembles. Something huge is moving under the stone.', 20);
    }
  };
  G.on('mapChanged', (map) => Gd.spawnCheck(map));
  G.on('tick', () => { if (G.World.map) Gd.spawnCheck(G.World.map); });
  G.on('newDay', () => Gd.refresh());

  // boss bars: shown while a bounty boss is awake on your map
  Gd.update = function () {
    const map = G.World.map; if (!map) return;
    const b = map.entities.find((e) => e.bountyBoss && !e.dead && e.dying <= 0);
    if (b && b.aggro && !b.faded && G.UI._bossOf !== b) G.UI.bossBar(b, b.bossName);
    if ((!b) && G.UI._bossOf && G.UI._bossOf.bountyBoss) G.UI.bossBar(null);
  };

  // ---------------------------------------------------------------- how the bosses fight
  const AI = G.Mobs.AI, M = G.Mobs;
  const shoot = (map, from, ang, sp, fx, col) => M.shoot(map, from, ang, sp, fx, col);
  // Gloopgarr: lumbers after you, telegraphs a stomp (shockwave ring), swings his club up close,
  // and sheds fast little slimes each time he drops below 80, 60, 40 and 20% health
  AI.ogre = function (dt, map, p, dx, dy, dist) {
    if (!this.setup) {
      this.setup = true; this.shed = [0.8, 0.6, 0.4, 0.2]; this.cd = 1.2;
      this.onHurt = (m) => {
        while (m.shed.length && m.hp / m.maxHp < m.shed[0]) {
          m.shed.shift();
          const n = Math.max(1, Math.round(tuning().shed / 4));
          for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2, s = M.spawn('slime_small', 'default', m.x + Math.cos(a) * 14, m.y + Math.sin(a) * 8, 1);
            s.aggro = true; s.kb = [Math.cos(a) * 160, Math.sin(a) * 100]; s.stun = 0.3; map.entities.push(s);
          }
          M.fx('slime_split', m.x, m.y - 10, { sortY: m.y + 2 }); G.sfx('slime_hop', { pitch: 0.7, volume: 0.7 });
        }
      };
    }
    if (this.state === 'windup') {
      this.t -= dt; this.telegraph = this.t;
      if (this.t <= 0) {
        this.state = 'recover'; this.t = 0.75; this.telegraph = 0;
        G.R.shake(3.5, 0.3); G.sfx('golem_stomp');
        M.fx('shockwave_ring', this.x, this.y - 2, { sortY: this.y - 30 });
        G.R.burst(this.x, this.y, 14, { colors: ['#5dbf6a', '#9be08f', '#2f6a4a'], speed: 70, life: 0.45 });
        if (Math.hypot(p.x - this.x, (p.y - this.y) * 1.6) < 48) p.hurt(this.dmg, this.x, this.y);
      }
      return;
    }
    if (this.state === 'recover') { this.t -= dt; this.setAnim('idle'); if (this.t <= 0) { this.state = 'chase'; this.cd = 1.3 + Math.random() * 0.9; } return; }
    if (!this.aggro) { this.wander(dt, map); return; }
    if (this.cd <= 0 && dist < 62) { this.state = 'windup'; this.t = 0.85; this.setAnim('attack'); G.sfx('slime_hop', { pitch: 0.5, volume: 0.6 }); return; }
    this.move(dt, map, (dx / dist) * this.speed, (dy / dist) * this.speed);
    this.setAnim('move');
    this.stepT = (this.stepT || 0) - dt;
    if (this.stepT <= 0) { this.stepT = 0.6; G.sfx('slime_hop', { volume: 0.35, pitch: 0.55 }); }
  };
  // Old Grimjaw: circles, crouches, lunges; howls up two more wolves when wounded
  AI.alpha = function (dt, map, p, dx, dy, dist) {
    if (this.state === 'lunge') {
      this.move(dt, map, this.vx, this.vy); this.t -= dt;
      if (!this.hit && dist < 22) { this.hit = true; p.hurt(this.dmg, this.x, this.y); }
      if (Math.random() < 0.5) M.fx('gallop_dust', this.x - this.vx * 0.04, this.y, { sortY: this.y - 1 });
      if (this.t <= 0) { this.state = 'recover'; this.t = 0.55; this.setAnim('idle'); }
      return;
    }
    if (this.state === 'windup') {
      this.t -= dt; this.telegraph = this.t;
      if (this.t <= 0) { const a = Math.atan2(dy, dx); this.vx = Math.cos(a) * 240; this.vy = Math.sin(a) * 240; this.state = 'lunge'; this.t = 0.34; this.hit = false; this.telegraph = 0; G.sfx('sword_swing', { pitch: 0.6, volume: 0.6 }); }
      return;
    }
    if (this.state === 'recover') { this.t -= dt; if (this.t <= 0) { this.state = 'chase'; this.cd = 1 + Math.random() * 0.9; } return; }
    if (!this.aggro) { this.wander(dt, map); return; }
    if (!this.howled && this.hp < this.maxHp * 0.6) {
      this.howled = true; G.R.shake(2.5, 0.5); G.sfx('ghost_wail', { pitch: 0.55, volume: 0.6 });
      G.UI.toast('Grimjaw throws back his head and howls!');
      for (const d of [-26, 26]) { const w = M.spawn('mosswolf', 'default', this.x + d, this.y + 10, 6); w.aggro = true; map.entities.push(w); M.fx('spawn_rune', w.x, w.y - 2, { sortY: w.y - 8 }); }
    }
    if (this.cd <= 0 && dist < 90) { this.state = 'windup'; this.t = 0.45; this.setAnim('attack'); return; }
    // circle at a wary distance, then close in
    const want = this.cd > 0.4 ? 56 : 30, k = dist > want + 8 ? 1 : dist < want - 8 ? -0.7 : 0;
    this.orbit = this.orbit || (Math.random() < 0.5 ? 1 : -1);
    this.move(dt, map, (dx / dist) * this.speed * k + (-dy / dist) * this.speed * 0.6 * this.orbit, (dy / dist) * this.speed * k + (dx / dist) * this.speed * 0.6 * this.orbit);
    this.setAnim('move');
  };
  // The Lantern Thief: teases at a distance, flings sparks, and blinks away leaving decoy wisps
  AI.wispking = function (dt, map, p, dx, dy, dist) {
    if (!this.aggro) { if (dist < 90) this.aggro = true; this.wander(dt, map); this.setAnim('idle'); return; }
    this.t += dt;
    this.blinkT = (this.blinkT == null ? 3 : this.blinkT) - dt;
    if (this.blinkT <= 0 || (dist < 24 && this.blinkT < 2)) {
      this.blinkT = 2.8 + Math.random() * 1.6;
      M.fx('death_puff', this.x, this.cy); G.sfx('teleport', { volume: 0.5 });
      for (let k = 0; k < 2; k++) { const w = M.spawn('wisp', 'teal', this.x + (k ? 10 : -10), this.y, 1); w.maxHp = w.hp = 1; w.aggro = true; w.decoy = true; map.entities.push(w); }
      for (let k = 0; k < 20; k++) {
        const a = Math.random() * Math.PI * 2, r = 60 + Math.random() * 50, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (!map.blocked(Math.floor(x / 16), Math.floor(y / 16))) { this.x = x; this.y = y; break; }
      }
      M.fx('spawn_rune', this.x, this.y - 2, { sortY: this.y - 8 }); this.setAnim('attack');
      return;
    }
    const want = 72, k = dist > want + 20 ? 1 : dist < want - 20 ? -1 : 0;
    this.move(dt, map, (dx / dist) * this.speed * k + Math.cos(this.t * 1.7) * 22, (dy / dist) * this.speed * k + Math.sin(this.t * 2.3) * 16);
    this.setAnim('move');
    if (this.cd <= 0 && dist < 170) {
      this.cd = 1.5;
      const a = Math.atan2(dy, dx);
      for (const s of [-0.22, 0, 0.22]) shoot(map, this, a + s, 120, 'bolt_enemy', [120, 255, 230]);
      G.sfx('wizard_cast', { pitch: 1.3, volume: 0.5 });
    }
  };
  // Vorrakh: bites and sprays crystal shards on the surface, then burrows; a dust ring hunts you and
  // locks in place just before he bursts out of it
  AI.wyrm = function (dt, map, p, dx, dy, dist) {
    this.aggro = true;
    const fast = this.hp < this.maxHp * 0.5;
    if (this.state === 'under') {
      this.faded = true; this.alpha = 0; this.t -= dt;
      if (this.t > 0.7) { this.ringX = p.x; this.ringY = p.y; }
      this.dustT = (this.dustT || 0) - dt;
      if (this.dustT <= 0) { this.dustT = 0.22; M.fx('burrow_dust', this.ringX || p.x, this.ringY || p.y, { sortY: (this.ringY || p.y) - 6 }); }
      if (this.t <= 0) {
        this.x = this.ringX || p.x; this.y = this.ringY || p.y;
        this.state = 'emerge'; this.t = 0.5; this.faded = false; this.alpha = 1; this.setAnim('emerge');
        G.R.shake(4, 0.5); G.sfx('golem_stomp', { pitch: 0.7 });
        if (Math.hypot(p.x - this.x, (p.y - this.y) * 1.4) < 30) p.hurt(Math.round(this.dmg * 1.2), this.x, this.y + 8);
        for (let i = 0; i < 8; i++) shoot(map, this, (i / 8) * Math.PI * 2, 110, 'crystal_shard', [200, 170, 255]);
      }
      return;
    }
    if (this.state === 'emerge') { this.t -= dt; if (this.t <= 0) { this.state = 'surface'; this.surfaceT = fast ? 4 : 6; this.cd = 0.8; } return; }
    if (this.state === 'burrow') {
      this.t -= dt;
      if (this.t <= 0) { this.state = 'under'; this.t = fast ? 1.8 : 2.4; this.faded = true; this.alpha = 0; G.sfx('golem_stomp', { volume: 0.4, pitch: 0.6 }); }
      return;
    }
    if (this.state === 'bite') {
      this.t -= dt; this.telegraph = this.t;
      if (this.t <= 0) { this.state = 'surface'; this.telegraph = 0; this.cd = 1.2; if (dist < 34) p.hurt(this.dmg, this.x, this.y); G.sfx('sword_swing', { pitch: 0.5 }); }
      return;
    }
    if (!this.started) { this.started = true; this.surfaceT = 5; G.R.shake(3, 0.8); G.sfx('ghost_wail', { pitch: 0.4, volume: 0.7 }); }
    this.surfaceT -= dt;
    if (this.surfaceT <= 0) { this.state = 'burrow'; this.t = 0.6; this.setAnim('burrow'); return; }
    if (this.cd <= 0 && dist < 30) { this.state = 'bite'; this.t = 0.4; this.setAnim('attack'); return; }
    if (this.cd <= 0 && dist >= 30) {
      this.cd = fast ? 1.6 : 2.3; this.setAnim('attack');
      const a = Math.atan2(dy, dx), n = fast ? 7 : 5;
      for (let i = 0; i < n; i++) shoot(map, this, a + (i - (n - 1) / 2) * 0.18, 130, 'crystal_shard', [200, 170, 255]);
      G.sfx('wizard_cast', { pitch: 0.5, volume: 0.6 });
      return;
    }
    this.move(dt, map, (dx / dist) * this.speed, (dy / dist) * this.speed);
    this.setAnim('move');
  };
})();
