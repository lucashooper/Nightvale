// Nightvale — the Ashvale Runesmithy: geodes from the Depths, cracking them on Ronan's anvil (or with your own
// Geode Hammer), and the Collection Cabinet of 24 minerals with its milestone rewards.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Sm = (G.Smithy = {});
  const T = () => (window.GAMETEXT && GAMETEXT.smithy) || {};
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  function st() { const S = G.S; if (!S.cabinet) S.cabinet = { donated: {}, found: {}, claimed: [] }; return S.cabinet; }
  Sm.state = st;
  Sm.donatedCount = () => Object.keys(st().donated).length;

  // ---------------------------------------------------------------- geodes from rocks in the Depths
  G.on('nodeBroken', (map, o) => {
    if (!map || map.id !== 'depths') return;
    const def = G.Farm.NODES[o.type]; if (!def || def.tool !== 'pickaxe') return;
    const f = map.floor || 1, luck = 1 + 0.15 * Math.max(0, G.Stats.get('luck'));
    const x = o.tx * 16 + 8, y = o.ty * 16 + 10;
    const roll = Math.random();
    let id = null;
    if (roll < 0.008 * luck) id = 'geode_star';
    else if (f >= 25 && roll < 0.05 * luck) id = 'geode_void';
    else if (f >= 10 && roll < 0.06 * luck) id = 'geode_ember';
    else if (roll < 0.075 * luck) id = 'geode_moon';
    if (id) { G.dropItem(map, id, 1, x, y); G.sfx('gem_found', { volume: 0.6 }); }
  });

  // ---------------------------------------------------------------- what's inside
  Sm.roll = function (gid) {
    const g = G.GEODES[gid] || G.GEODES.geode_moon, c = st();
    if (Math.random() < g.minChance) {
      const list = G.MINERALS[gid].map((m) => m[0]);
      const fresh = list.filter((id) => !c.found[id]);
      // the cabinet nudges you toward what you haven't seen yet
      const id = fresh.length && Math.random() < 0.65 ? U.pick(fresh) : U.pick(list);
      return { id, n: 1 };
    }
    let tot = 0; for (const o of g.other) tot += o[1];
    let r = Math.random() * tot;
    for (const [id, w, a, b] of g.other) { r -= w; if (r <= 0) return { id, n: U.randInt(a, b) }; }
    return { id: 'stone', n: 2 };
  };
  Sm.crack = function (gid, free) {
    const S = G.S, fee = free ? 0 : (G.GEODES[gid] || {}).fee || 25;
    if (!G.Inv.has(gid)) { G.UI.toast('You have no ' + G.item(gid).name + ' left.'); return null; }
    if (S.gold < fee) { G.sfx('error'); G.UI.toast(`Cracking costs ${fee} ✦.`); return null; }
    const res = Sm.roll(gid);
    if (!G.Inv.canAdd(res.id, res.n)) { G.sfx('error'); G.UI.toast('Your satchel is full.'); return null; }
    S.gold -= fee; G.Inv.remove(gid, 1);
    const isNew = G.item(res.id).cat === 'mineral' && !st().found[res.id];
    if (G.item(res.id).cat === 'mineral') st().found[res.id] = true;
    G.Inv.add(res.id, res.n);
    S.stats.geodes = (S.stats.geodes || 0) + 1;
    return Object.assign(res, { isNew });
  };

  // ---------------------------------------------------------------- the cracking stage (Ronan's anvil or your hammer)
  // renders into `body`: your geodes on the right, the anvil and the result on the left
  Sm.renderCrack = function (body, m, opts) {
    opts = opts || {};
    const S = G.S, UI = G.UI;
    const gids = Object.keys(G.GEODES).filter((id) => G.Inv.has(id));
    const wrap = el('div', 'gc');
    const stage = el('div', 'gc-stage');
    const cv = el('canvas', 'gc-anvil'); cv.width = 32; cv.height = 32;
    const res = el('div', 'gc-res');
    stage.appendChild(cv); stage.appendChild(res);
    wrap.appendChild(stage);
    const side = el('div', 'gc-side');
    wrap.appendChild(side);
    body.appendChild(wrap);
    if (!gids.includes(m.geode)) m.geode = gids[0] || null;
    const draw = (frame) => { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, 32, 32); let fr = null; try { fr = window.ItemArt && ItemArt.geodeFrames ? ItemArt.geodeFrames(m.geode || 'geode_moon') : null; } catch (e) { fr = null; } if (fr && fr[frame]) x.drawImage(fr[frame], 0, 0); };
    draw(m.lastRes ? 5 : 0);
    if (m.lastRes) {
      const it = G.item(m.lastRes.id);
      res.innerHTML = `<img src="${UI.iconURL(m.lastRes.id)}" alt=""><div class="gc-n">${it.name}${m.lastRes.n > 1 ? ' ×' + m.lastRes.n : ''}</div>${m.lastRes.isNew ? '<div class="gc-new">New for the Cabinet!</div>' : it.cat === 'mineral' ? '<div class="muted small">Already in your collection</div>' : ''}`;
    } else res.innerHTML = `<div class="muted small">${gids.length ? 'Pick a geode, then crack it open.' : 'No geodes in your satchel. Break rocks in the Umbral Depths to find them.'}</div>`;
    side.appendChild(el('div', 'lbl', 'Your geodes'));
    const list = el('div', 'gc-list');
    for (const id of Object.keys(G.GEODES)) {
      const n = G.Inv.count(id);
      const b = el('div', 'stile hit' + (id === m.geode ? ' sel' : '') + (n ? '' : ' poor'), `<img src="${UI.iconURL(id)}" alt=""><span class="p">${n ? '×' + n : '—'}</span>`);
      b.title = G.item(id).name;
      b.onclick = () => { if (!n) return; m.geode = id; m.lastRes = null; G.sfx('ui_click', { volume: 0.3 }); m.rerender(); };
      list.appendChild(b);
    }
    side.appendChild(list);
    const fee = opts.free ? 0 : (G.GEODES[m.geode] || {}).fee || 25;
    const go = el('button', 'btn gold gc-go', m.geode ? (opts.free ? 'Crack it' : `Crack · ${fee} ✦`) : 'No geode');
    go.disabled = !m.geode || m.busy || (!opts.free && S.gold < fee);
    go.onclick = () => {
      if (m.busy || !m.geode) return;
      const r = Sm.crack(m.geode, opts.free);
      if (!r) return;
      m.busy = true; m.lastRes = null; res.innerHTML = '';
      if (!opts.free && G.NPCs.present('ronan', G.World.map.id) && T().crack && Math.random() < 0.5) UI.toast(`Ronan: “${UI.fill(U.pick(T().crack)).replace(/^\s*\[\w+\]\s*/, '')}”`);
      const times = [0, 260, 520, 760, 1020, 1240];
      times.forEach((t, k) => setTimeout(() => { draw(k); if (k === 1 || k === 2) G.sfx('pickaxe_hit', { volume: 0.45 }); if (k === 4) G.sfx(r.isNew ? 'gem_found' : 'rock_break', { volume: 0.7 }); }, t));
      setTimeout(() => { m.busy = false; m.lastRes = r; if (r.isNew) G.jingle('discovery'); m.rerender(); }, 1500);
    };
    side.appendChild(go);
    side.appendChild(el('div', 'small muted', 'Minerals go in the Collection Cabinet on Ronan\'s wall. Ores and gems sell here too.'));
  };
  // with your own Geode Hammer, anywhere
  G.UI.panels.geodes = function (panel, m) {
    panel.appendChild(G.UI.closeBtn(m));
    panel.appendChild(el('h2', '', 'Crack a geode'));
    const body = el('div', 'body'); panel.appendChild(body);
    Sm.renderCrack(body, m, { free: true });
  };

  // ---------------------------------------------------------------- the Collection Cabinet
  Sm.cabinet = function () { G.sfx('ui_click', { volume: 0.4 }); G.UI.open('cabinet'); };
  const GEO_NAMES = { geode_moon: 'Moon geode', geode_ember: 'Ember geode', geode_void: 'Void geode', geode_star: 'Star geode' };
  function silhouette(id, col) {
    const src = G.icon(id), c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    return c.toDataURL();
  }
  const silCache = {};
  Sm.donate = async function (id) {
    const c = st();
    if (c.donated[id] || !G.Inv.has(id)) return false;
    G.Inv.remove(id, 1); c.donated[id] = true; c.found[id] = true;
    G.sfx('gem_found', { volume: 0.6 });
    Sm.refreshCabinetProp();
    return true;
  };
  async function claimMilestones(m) {
    const c = st(), n = Sm.donatedCount(), t = T().cabinet || {};
    for (const [k, rw] of G.CABINET_MILESTONES) {
      if (n < k || c.claimed.includes(k)) continue;
      c.claimed.push(k);
      const lines = t.milestones && t.milestones[k];
      if (lines && G.NPCs.present('ronan', G.World.map.id)) await G.UI.say('ronan', lines);
      if (rw.gold) { G.S.gold += rw.gold; G.UI.toast(`Cabinet milestone (${k}): +${U.fmtNum(rw.gold)} ✦`); }
      const give = rw.item || (rw.furn && G.ITEMS[rw.furn] ? rw.furn : null);
      if (give) { G.Inv.giveOrDrop(give, 1); G.UI.toast(`Cabinet milestone (${k}): ${G.item(give).name}!`, give); }
      else if (rw.furn) { G.S.gold += 1500; G.UI.toast(`Cabinet milestone (${k}): +1,500 ✦`); }
      if (rw.title) G.S.title = rw.title;
      G.jingle('quest_complete');
    }
    if (m) m.rerender();
  }
  // two looks for the cabinet: the specimen drawer (the player's pick) and velvet niches (G.prefs.cabinetStyle)
  G.UI.panels.cabinet = function (panel, m) { return (G.prefs && G.prefs.cabinetStyle === 'niches' ? cabinetNiches : cabinetDrawer)(panel, m); };
  // a museum specimen drawer: a labelled slot per mineral, a progress bar per kind of geode
  function cabinetDrawer(panel, m) {
    const UI = G.UI, c = st(), n = Sm.donatedCount();
    panel.classList.add('cabp');
    panel.appendChild(UI.closeBtn(m));
    if (!c.seenIntro && T().cabinet && T().cabinet.intro) { c.seenIntro = true; setTimeout(() => UI.toast(`Ronan: “${UI.fill(T().cabinet.intro[0]).replace(/^\s*\[\w+\]\s*/, '')}”`), 200); }
    panel.appendChild(el('div', 'cab-head', `<h2>The Collection Cabinet</h2><span class="cab-n">${n} of 24</span>`));
    const body = el('div', 'body'); panel.appendChild(body);
    const donateOne = async (id) => { if (await Sm.donate(id)) { if (T().cabinet && T().cabinet.donate) UI.toast(`Ronan: “${UI.fill(U.pick(T().cabinet.donate)).replace(/^\s*\[\w+\]\s*/, '')}”`); await claimMilestones(m); m.rerender(); } };
    const drawer = el('div', 'cab-drawer');
    for (const gid in G.MINERALS) {
      const ids = G.MINERALS[gid].map((x) => x[0]), got = ids.filter((id) => c.donated[id]).length;
      const grp = el('div', 'cab-grp', `<div class="cab-gh"><span><img src="${UI.iconURL(gid)}" alt="">${GEO_NAMES[gid]}</span><span>${got} / 6</span></div><div class="cab-bar"><i style="width:${(got / 6) * 100}%"></i></div>`);
      const cells = el('div', 'cab-cells');
      for (const id of ids) {
        const have = G.Inv.has(id), don = !!c.donated[id], seen = !!c.found[id] || have;
        const cell = el('div', 'cab-cell' + (don ? ' don' : have ? ' can' : ''));
        const src = don || seen ? UI.iconURL(id) : (silCache[id] || (silCache[id] = silhouette(id, '#b8a684')));
        cell.innerHTML = `<img src="${src}" alt="">` + `<span>${don || seen ? G.item(id).name : '???'}</span>` + (have && !don ? '<b class="cab-give">Donate</b>' : '');
        if (have && !don) { cell.classList.add('hit'); cell.onclick = () => donateOne(id); }
        if (don || seen) cell.title = UI.itemDesc(id) || G.item(id).name;
        cells.appendChild(cell);
      }
      grp.appendChild(cells); drawer.appendChild(grp);
    }
    body.appendChild(drawer);
    const rib = el('div', 'cab-rib');
    for (const [k, rw] of G.CABINET_MILESTONES) {
      const name = rw.gold ? `${U.fmtNum(rw.gold)} ✦` : rw.item ? G.item(rw.item).name : rw.furn && G.ITEMS[rw.furn] ? G.item(rw.furn).name : 'Mineral Cabinet';
      rib.appendChild(el('span', n >= k ? 'ok' : '', `${n >= k ? '✓ ' : ''}<b>${k}</b> ${name}`));
    }
    body.appendChild(rib);
    const can = G.MINERAL_IDS.filter((id) => G.Inv.has(id) && !c.donated[id]);
    const row = el('div', 'row'); row.style.marginTop = '10px';
    const all = el('button', 'btn gold', can.length ? `Donate all new (${can.length})` : 'Nothing new to donate');
    all.disabled = !can.length;
    all.onclick = async () => { for (const id of can) await Sm.donate(id); if (T().cabinet && T().cabinet.donate) UI.toast(`Ronan: “${UI.fill(U.pick(T().cabinet.donate)).replace(/^\s*\[\w+\]\s*/, '')}”`); await claimMilestones(m); m.rerender(); };
    row.appendChild(all);
    row.appendChild(el('span', 'small muted', 'Duplicates sell well at the anvil.'));
    body.appendChild(row);
  }
  // velvet niches in a carved cabinet: one shelf per kind of geode, milestones down the side
  function cabinetNiches(panel, m) {
    const UI = G.UI, c = st(), n = Sm.donatedCount();
    panel.classList.add('cabp');
    panel.appendChild(UI.closeBtn(m));
    if (!c.seenIntro && T().cabinet && T().cabinet.intro) { c.seenIntro = true; setTimeout(() => UI.toast(`Ronan: “${UI.fill(T().cabinet.intro[0]).replace(/^\s*\[\w+\]\s*/, '')}”`), 200); }
    panel.appendChild(el('div', 'cab-head', `<h2>The Collection Cabinet</h2><span class="cab-n">${n} of 24</span>`));
    const body = el('div', 'body'); panel.appendChild(body);
    const wrap = el('div', 'cab-wrap');
    const cab = el('div', 'cab-wood');
    const donateOne = async (id) => { if (await Sm.donate(id)) { if (T().cabinet && T().cabinet.donate) UI.toast(`Ronan: “${UI.fill(U.pick(T().cabinet.donate)).replace(/^\s*\[\w+\]\s*/, '')}”`); await claimMilestones(m); m.rerender(); } };
    for (const gid in G.MINERALS) {
      const ids = G.MINERALS[gid].map((x) => x[0]), got = ids.filter((id) => c.donated[id]).length;
      cab.appendChild(el('div', 'cab-label', `<img src="${UI.iconURL(gid)}" alt="">${GEO_NAMES[gid]}<span>${got} / 6</span>`));
      const shelf = el('div', 'cab-shelf');
      for (const id of ids) {
        const have = G.Inv.has(id), don = !!c.donated[id], seen = !!c.found[id] || have;
        const ni = el('div', 'cab-niche' + (don ? ' don' : have ? ' can' : ''));
        const src = don ? UI.iconURL(id) : (silCache[id + ':v'] || (silCache[id + ':v'] = silhouette(id, '#1a0812')));
        ni.innerHTML = `<img src="${src}" alt="${don || seen ? G.item(id).name : 'Unknown mineral'}">` + (have && !don ? '<b class="cab-give">Donate</b>' : '');
        ni.title = don ? G.item(id).name + ' · ' + (UI.itemDesc(id) || '') : seen ? `${G.item(id).name}: not donated yet` : 'Not found yet';
        if (have && !don) { ni.classList.add('hit'); ni.onclick = () => donateOne(id); }
        shelf.appendChild(ni);
      }
      cab.appendChild(shelf);
    }
    wrap.appendChild(cab);
    const side = el('div', 'cab-side');
    side.appendChild(el('div', 'cab-sh', 'Milestones'));
    for (const [k, rw] of G.CABINET_MILESTONES) {
      const name = rw.gold ? `${U.fmtNum(rw.gold)} ✦` : rw.item ? G.item(rw.item).name : rw.furn && G.ITEMS[rw.furn] ? G.item(rw.furn).name : 'Mineral Cabinet';
      const ic = rw.item ? `<img src="${UI.iconURL(rw.item)}" alt="">` : rw.gold ? `<img src="${UI.iconURL('relic_coin')}" alt="">` : '<i></i>';
      side.appendChild(el('div', 'cab-ms' + (n >= k ? ' ok' : ''), `<b>${k}</b>${ic}<span>${name}</span>${n >= k ? '<em>✓</em>' : ''}`));
    }
    const can = G.MINERAL_IDS.filter((id) => G.Inv.has(id) && !c.donated[id]);
    const all = el('button', 'btn gold', can.length ? `Donate all new (${can.length})` : 'Nothing new to donate');
    all.disabled = !can.length;
    all.onclick = async () => { for (const id of can) await Sm.donate(id); if (T().cabinet && T().cabinet.donate) UI.toast(`Ronan: “${UI.fill(U.pick(T().cabinet.donate)).replace(/^\s*\[\w+\]\s*/, '')}”`); await claimMilestones(m); m.rerender(); };
    side.appendChild(all);
    side.appendChild(el('div', 'small muted', 'Crack geodes at Ronan\'s anvil to find more. Duplicates sell well.'));
    wrap.appendChild(side);
    body.appendChild(wrap);
  }

  // ---------------------------------------------------------------- the real cabinet on Ronan's wall shows your minerals
  Sm.refreshCabinetProp = function () {
    const map = G.World.maps && G.World.maps.runesmithy; if (!map) return;
    const prop = map.props.find((p) => p.o && p.o.id === 'collection_cabinet'); if (!prop) return;
    let base = prop.baseSpr || prop.spr; prop.baseSpr = base;
    const niches = base.niches || (window.InteriorArt && InteriorArt.piece('collection_cabinet', 0).niches) || [];
    const c = document.createElement('canvas'); c.width = base.c.width; c.height = base.c.height;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(base.c, 0, 0);
    G.MINERAL_IDS.forEach((id, i) => { const nc = niches[i]; if (!nc || !st().donated[id]) return; x.drawImage(G.icon(id), nc.x, nc.y, nc.w || 8, nc.h || 8); });
    prop.spr = Object.assign({}, base, { c });
  };
  G.on('mapChanged', (map) => { if (map && map.id === 'runesmithy') Sm.refreshCabinetProp(); });

  // ---------------------------------------------------------------- Ronan's shop gets a cracking tab
  Sm.shopTab = (def) => !!def.geodes;
})();
