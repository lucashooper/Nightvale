// Nightvale — Stardew-style timed stat buffs (one food buff and one drink buff at a time, plus potion and
// blessing slots), the luck/speed/attack helpers the rest of the game reads, and wearing clothes.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const ST = (G.Stats = {});
  ST.NAMES = { speed: 'Speed', luck: 'Luck', farming: 'Farming', fishing: 'Fishing', mining: 'Mining', attack: 'Attack', defense: 'Defense', magnetism: 'Magnetism' };
  const ORDER = Object.keys(ST.NAMES);

  const slots = () => (G.S.statBuffs || (G.S.statBuffs = {}));
  // total points of a stat from every active source
  ST.get = function (stat) {
    let n = 0; const b = slots();
    for (const k in b) { const e = b[k]; if (e && e.stats && e.stats[stat]) n += e.stats[stat]; }
    if (stat === 'luck') { if (G.S.buffs.luck > 0) n += 2; if (G.Familiars && G.Familiars.statBonus) n += G.Familiars.statBonus('luck'); n += G.S.permLuck || 0; }
    return n;
  };
  // slot: 'food' | 'drink' | 'potion' | 'blessing' | 'festival'. A new buff in a slot replaces the old one.
  ST.apply = function (slot, src, stats, secs, until, label) {
    slots()[slot] = { src: src || null, stats, t: secs || 0, max: secs || 0, until: until || 0, label: label || '' };
    G.UI._buffSig = '';
  };
  ST.update = function (dt) {
    const b = slots(), S = G.S;
    for (const k in b) {
      const e = b[k];
      if (!e) { delete b[k]; continue; }
      if (e.until) { if (S.mins >= e.until) { delete b[k]; G.UI._buffSig = ''; } }
      else { e.t -= dt; if (e.t <= 0) { delete b[k]; G.UI._buffSig = ''; } }
    }
  };
  ST.clearOvernight = function () { const b = slots(); for (const k in b) delete b[k]; };
  ST.describe = function (stats) {
    return ORDER.filter((k) => stats[k]).map((k) => `+${stats[k]} ${ST.NAMES[k]}${k === 'speed' ? ` (+${stats[k] * 5}%)` : ''}`).join(', ');
  };
  // gameplay helpers
  ST.speedMult = () => (1 + 0.05 * ST.get('speed')) * (G.S.buffs.swift > 0 ? 1.3 : 1);
  ST.luckChance = (perPoint) => Math.min(0.75, (perPoint || 0.12) * Math.max(0, ST.get('luck')));
  ST.lucky = (perPoint) => Math.random() < ST.luckChance(perPoint);
  ST.pickupRadius = () => 56 + 18 * ST.get('magnetism');

  // ---------------------------------------------------------------- consuming
  // returns true if the effect included a stat buff (so the caller can toast)
  ST.fromEffect = function (e, it) {
    if (e.buff && typeof e.buff === 'object') {
      const slot = it && it.drink ? 'drink' : 'food';
      ST.apply(slot, it ? it.id : null, e.buff, e.secs, e.until, it ? it.name : '');
      const dur = e.until ? `until ${U.fmtTime(e.until)}` : `for ${fmtSecs(e.secs)}`;
      G.UI.toast(`${ST.describe(e.buff)} ${dur}.`, it && it.id);
      return true;
    }
    if (e.stat) {
      ST.apply('potion', it ? it.id : null, e.stat, e.secs, 0, it ? it.name : '');
      G.UI.toast(`${ST.describe(e.stat)} for ${fmtSecs(e.secs)}.`, it && it.id);
      return true;
    }
    return false;
  };
  function fmtSecs(s) { s = Math.round(s); return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`; }
  ST.fmtSecs = fmtSecs;

  // ---------------------------------------------------------------- HUD chips
  const OLD = { swift: ['Swift', 'pot_swift'], ember: ['Emberheart', 'pot_ember'], ward: ['Frostward', 'pot_frostward'], tide: ['Tidecaller', 'pot_tide'], veil: ['Shadowveil', 'pot_shadow'], luck: ['Starlit luck', 'pot_starlight'], wisplight: ['Wisplight', 'pot_wisplight'] };
  ST.hud = function () {
    const S = G.S, out = [];
    for (const k in S.buffs) {
      const [name, icon] = OLD[k] || [k, null];
      out.push({ name, icon, left: S.buffs[k] < 90000 ? fmtSecs(S.buffs[k]) : 'today', tip: name });
    }
    const b = slots();
    for (const k in b) {
      const e = b[k];
      const left = e.until ? `→${U.fmtTime(e.until).replace(':00', '')}` : fmtSecs(e.t);
      out.push({ name: e.label, icon: e.src, left, tip: `${e.label}: ${ST.describe(e.stats)}`, slot: k });
    }
    return out;
  };
  ST.hudSig = function () {
    const S = G.S, b = slots();
    return Object.keys(S.buffs).map((k) => k + Math.ceil(S.buffs[k])).join() + '|' + Object.keys(b).map((k) => k + (b[k].until || Math.ceil(b[k].t)) + b[k].src).join();
  };

  // ---------------------------------------------------------------- clothing
  ST.wear = function (invIndex) {
    const S = G.S, s = S.inv[invIndex]; if (!s) return;
    const it = G.item(s.id), slot = it.wear; if (!slot) return;
    const prev = S.look[slot];
    S.inv[invIndex] = prev ? { id: prev, n: 1 } : null;
    S.look = Object.assign({}, S.look, { [slot]: it.id });
    G.emit('inv'); G.sfx('cloth_rustle');
    G.UI.toast(`You put on the ${it.name}.`, it.id);
    const p = G.World.player;
    if (p) G.R.burst(p.x, p.y - 14, 12, { colors: ['#e4d2ff', '#fff1c8', '#b99aee'], speed: 30, life: 0.7, grav: -20 });
  };
  ST.unwear = function (slot) {
    const S = G.S, id = S.look[slot]; if (!id) return false;
    if (!G.Inv.canAdd(id, 1)) { G.UI.toast('Your satchel is full.'); G.sfx('error'); return false; }
    G.Inv.add(id, 1);
    S.look = Object.assign({}, S.look, { [slot]: null });
    G.emit('inv'); G.sfx('cloth_rustle');
    return true;
  };
})();
