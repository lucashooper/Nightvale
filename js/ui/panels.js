// Nightvale — modal panels: inventory & journal, chests, offering box, shops, cauldron, altar, board, summary, pause.
(function () {
  'use strict';
  const G = window.G, U = G.U, UI = G.UI, el = UI.el, Inv = G.Inv;
  const P = UI.panels;

  function header(panel, m, title, sub) {
    panel.appendChild(UI.closeBtn(m));
    panel.appendChild(el('h2', '', title));
    if (sub) panel.appendChild(el('div', 'subtitle', sub));
  }

  // ---------------------------------------------------------------- inventory + tabs
  const TABS = [['bag', 'Bag'], ['handbook', 'Handbook'], ['recipes', 'Potion book'], ['crafting', 'Crafting'], ['villagers', 'Villagers'], ['journal', 'Journal'], ['map', 'Map']];
  P.inventory = function (panel, m) {
    m.tab = m.tab || m.data.tab || 'bag';
    m.closeKeys = ['KeyI', 'Tab'];
    m.keys = { KeyM: () => { m.tab = 'map'; m.rerender(); }, KeyJ: () => { m.tab = 'journal'; m.rerender(); } };
    header(panel, m, { bag: 'Your satchel', handbook: 'The Handbook', recipes: 'Potion book', crafting: 'Crafting', villagers: 'Villagers', journal: 'Journal', map: 'Nightvale' }[m.tab]);
    const tabs = el('div', 'tabs');
    for (const [k, label] of TABS) { const t = el('div', 'tab hit' + (m.tab === k ? ' on' : ''), label); t.onclick = () => { m.tab = k; G.sfx('ui_click', { volume: 0.4 }); m.rerender(); }; tabs.appendChild(t); }
    panel.appendChild(tabs);
    const body = el('div', 'body'); panel.appendChild(body);
    ({ bag: bagTab, recipes: recipeTab, villagers: villagerTab, journal: journalTab, map: mapTab, handbook: (b, mm) => UI.tabs.handbook(b, mm), crafting: (b, mm) => UI.tabs.crafting(b, mm) })[m.tab](body, m);
  };

  function bagTab(body, m) {
    const S = G.S;
    const wrap = el('div', 'row');
    const left = el('div', 'col');
    left.appendChild(el('div', 'lbl', 'Hotbar'));
    left.appendChild(UI.invGrid(S.inv, { from: 0, to: 12, keys: true, selIndex: S.sel, rerender: m.rerender, quickMove: (i) => quick(i), onSlot: (i, e) => { if (!UI.held && !e.shiftKey && e.button === 0 && e.detail === 2) { S.sel = i; return true; } } }));
    left.appendChild(el('div', 'lbl', 'Backpack'));
    left.appendChild(UI.invGrid(S.inv, { from: 12, to: 36, rerender: m.rerender, quickMove: (i) => quick(i) }));
    const trash = UI.slotEl(null, { onClick: () => { if (UI.held) { G.sfx('error'); UI.setHeld(null); m.rerender(); } } });
    trash.innerHTML = '<span style="font-size:22px;color:var(--danger)">✕</span>';
    trash.title = 'Discard the held item';
    const tr = el('div', 'row'); tr.style.alignItems = 'center';
    tr.appendChild(trash); tr.appendChild(el('div', 'small muted', 'Click to pick up · click to place or swap · right-click splits · shift-click moves · drop on ✕ to discard'));
    left.appendChild(tr);
    wrap.appendChild(left);
    // stats
    const st = el('div', 'col'); st.style.minWidth = '210px';
    const cv = el('canvas'); cv.width = 96; cv.height = 96; cv.style.cssText = 'width:96px;height:96px;image-rendering:pixelated;border-radius:6px;background:radial-gradient(circle at 50% 40%,#3b2d62,#1a1230 70%);border:2px solid #120c1c';
    UI.drawPortrait(cv, 'player', 'happy');
    st.appendChild(cv);
    const tiers = ['Basic', 'Glimmer', 'Shadowiron', 'Starsilver'];
    st.appendChild(el('div', '', `<div style="font-size:20px">${S.name}</div><div class="muted small">Keeper of the Verdant Sanctum</div>`));
    st.appendChild(el('div', 'small', `<div class="gold-t">${U.fmtNum(S.gold)} ✦</div><div>Health ${Math.round(S.hp)} / ${S.maxHp}</div><div>Energy ${Math.round(S.energy)} / ${S.maxEnergy}</div><div class="muted">Hoe · ${tiers[S.toolTier.hoe]}<br>Dew Can · ${tiers[S.toolTier.can]}<br>Pickaxe · ${tiers[S.toolTier.pickaxe]}<br>Axe · ${tiers[S.toolTier.axe]}</div><div class="muted">Deepest floor · ${S.maxDepth}</div>`));
    // what you're wearing (click a slot to take it off; use a clothing item to put it on)
    st.appendChild(el('div', 'lbl', 'Wearing'));
    const wr = el('div', 'row wear');
    for (const [slot, label] of [['hat', 'Hat'], ['cloak', 'Cloak'], ['outfit', 'Outfit']]) {
      const id = S.look[slot];
      const sl = UI.slotEl(id ? { id, n: 1 } : null, { onClick: () => { if (id && G.Stats.unwear(slot)) m.rerender(); } });
      if (!id) sl.innerHTML = `<span class="small muted">${label}</span>`;
      sl.title = id ? `Take off the ${G.item(id).name}` : `No ${label.toLowerCase()}`;
      wr.appendChild(sl);
    }
    st.appendChild(wr);
    // active buffs
    const buffs = G.Stats.hud();
    if (buffs.length) { st.appendChild(el('div', 'lbl', 'Feeling')); st.appendChild(el('div', 'small', buffs.map((b) => `<div><span class="em">${b.name}</span> <span class="muted">${b.tip.replace(b.name + ': ', '')} · ${b.left}</span></div>`).join(''))); }
    wrap.appendChild(st);
    body.appendChild(wrap);
    function quick(i) {
      const s = S.inv[i]; if (!s) return;
      const range = i < 12 ? [12, 36] : [0, 12];
      const sub = S.inv.slice(range[0], range[1]);
      const left = Inv.add(s.id, s.n, sub);
      for (let k = range[0]; k < range[1]; k++) S.inv[k] = sub[k - range[0]];
      if (left > 0) s.n = left; else S.inv[i] = null;
      G.emit('inv'); m.rerender();
    }
  }

  function recipeTab(body) {
    const S = G.S;
    body.appendChild(el('div', 'subtitle', 'Brew in a cauldron: put in two or three ingredients. Unknown combinations can still be discovered by experimenting.'));
    const list = el('div', 'col');
    for (const r of G.RECIPES) {
      const known = S.known[r.id];
      const it = G.item(r.id);
      const row = el('div', 'recipe');
      row.innerHTML = `<img src="${UI.iconURL(r.id)}" alt="" style="${known ? '' : 'filter:brightness(0) opacity(.5)'}"><div><div>${known ? it.name : '??? <span class="muted small">— undiscovered</span>'}</div><div class="ing">${known ? r.ing.map((i) => `<img src="${UI.iconURL(i)}" alt="" title="${G.item(i).name}">${G.item(i).name}`).join(' + ') : 'Hint: ' + r.ing.map((i) => ({ crop: 'a crop', forage: 'a forage find', loot: 'monster loot', gem: 'a gem', fish: 'a fish' })[G.item(i).cat] || 'something').join(' + ')}</div><div class="small muted">${known ? effectText(it) + ` · sells ${it.sell} ✦ · ${Math.round(r.time / 60)}h to brew` : ''}</div></div>`;
      if (known) { const img = row.querySelector('img'); img.addEventListener('mouseenter', () => UI.showTip(r.id, img)); img.addEventListener('mouseleave', UI.hideTip); }
      list.appendChild(row);
    }
    body.appendChild(list);
  }
  function effectText(it) {
    const e = it.use || it.eat || {};
    const b = { swift: 'move faster', ember: 'stronger attacks', ward: 'take less damage', tide: 'easier fishing all day', veil: 'monsters ignore you', luck: 'better finds all day' };
    const sb = typeof e.buff === 'object' && e.buff ? e.buff : e.stat;
    return [e.hp ? (e.hp >= 999 ? 'full health' : `+${e.hp} health`) : '', e.energy ? (e.energy >= 999 ? 'full energy' : `+${e.energy} energy`) : '', sb ? G.Stats.describe(sb) : e.buff ? b[e.buff] : '', e.mana ? `+${e.mana} mana` : '', e.maxhp ? `+${e.maxhp} max health forever` : '', it.wear ? 'wearable ' + it.wear : ''].filter(Boolean).join(', ');
  }
  UI.effectText = effectText;

  function villagerTab(body) {
    const S = G.S;
    const grid = el('div', 'vil');
    for (const id of G.NPCs.IDS) {
      const fr = S.friends[id] || { pts: 0 }, t = UI.npcText(id);
      const card = el('div', 'vcard');
      const cv = el('canvas'); cv.width = 72; cv.height = 72;
      UI.drawPortrait(cv, id, 'neutral');
      if (!fr.met) cv.style.filter = 'brightness(0.15)';
      card.appendChild(cv);
      const h = G.NPCs.hearts(id);
      const likes = (fr.knownLikes || []).slice(0, 6).map((i) => `<img src="${UI.iconURL(i)}" alt="" title="${G.item(i).name}" style="width:22px;height:22px;image-rendering:pixelated">`).join('');
      const rom = G.NPCs.ROMANCE.includes(id), cap = G.Romance ? G.Romance.cap(id) : 10;
      const status = !fr.met || !rom ? '' : G.S.partner === id ? '<span class="vrom on">Your partner</span>' : G.Romance && G.Romance.dating(id) ? '<span class="vrom on">Dating ♥</span>' : '<span class="vrom">Single</span>';
      card.appendChild(el('div', '', `<div>${fr.met ? (t && t.name) || UI.npcName(id) : '???'} ${status}</div><div class="small muted">${fr.met ? (t && t.title) || '' : 'Not yet met'}</div><div class="hearts">${'♥'.repeat(h)}<span class="off">${'♥'.repeat(Math.max(0, cap - h))}</span>${cap < 10 ? `<span class="lock" title="Give a Moonflower Bouquet to go further">${'♥'.repeat(10 - cap)}</span>` : ''}</div><div class="small muted">${fr.met ? (fr.talked === S.day ? 'Talked today' : 'Not talked today') + (fr.gifted === S.day ? ' · gift given' : '') : ''}</div><div>${likes}</div>`));
      if (fr.met && t && t.bio) card.title = t.bio;
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }

  function journalTab(body) {
    const S = G.S;
    if (UI.tabs.contracts) UI.tabs.contracts(body);
    const q = G.Quests.list();
    body.appendChild(el('div', 'lbl', 'The path ahead'));
    const ql = el('div', 'col small'); ql.style.margin = '6px 0 14px';
    for (const o of q) ql.appendChild(el('div', '', `${o.done ? '<span class="em">✓</span>' : '<span class="gold-t">◆</span>'} <span class="${o.done ? 'muted' : ''}">${o.text}</span>${!o.done && o.sub ? ` <span class="muted">— ${o.sub}</span>` : ''}`));
    body.appendChild(ql);
    if (S.request) {
      const r = S.request;
      body.appendChild(el('div', 'lbl', 'Accepted request'));
      body.appendChild(el('div', 'small', `${UI.npcName(r.npc)} wants ${r.qty} × ${G.item(r.item).name} (you have ${Inv.count(r.item)}) · reward ${U.fmtNum(r.reward)} ✦ · expires in ${Math.max(0, 2 - (S.day - r.day))} day(s)`));
      body.appendChild(el('div', 'sep'));
    }
    body.appendChild(el('div', 'lbl', 'Moon Altar offerings'));
    const bl = el('div', 'col small'); bl.style.margin = '6px 0 14px';
    for (const b of G.BUNDLES) bl.appendChild(el('div', '', `${S.bundlesDone[b.id] ? '<span class="em">✓</span>' : '○'} ${b.name} <span class="muted">— ${b.items.map(([id, n]) => `${Math.min(n, (S.bundles[b.id] || {})[id] || 0)}/${n} ${G.item(id).name}`).join(', ')}</span>`));
    body.appendChild(bl);
    body.appendChild(el('div', 'lbl', 'Records'));
    const st = S.stats;
    body.appendChild(el('div', 'small muted', `Days in Nightvale: ${S.day} · Crops harvested: ${st.harvested || 0} · Potions brewed: ${st.brewed || 0} · Fish caught: ${st.fish || 0} · Monsters banished: ${st.kills || 0} · Items offered for sale: ${st.shipped || 0} · Glimmer earned: ${U.fmtNum(st.earned || 0)}`));
  }

  // illustrated world map
  function mapTab(body) {
    const S = G.S;
    if (G.WorldMap && G.WorldMap.draw) {
      const cv = el('canvas', 'mapcv pirate');
      const cur = G.World.map ? G.World.map.id : 'sanctum';
      try { G.WorldMap.draw(cv, { current: cur, visited: Object.assign({ sanctum: true }, S.visited || {}), day: S.day, mins: S.mins, fullMoon: G.isFullMoon() }); } catch (e) { console.warn('world map', e); }
      body.appendChild(cv);
      const idle = '<span class="mc-b">Hover over or tap a place on the map to read about it.</span>';
      const cap = el('div', 'map-cap', idle);
      let last = '';
      const hover = (e) => {
        const r = cv.getBoundingClientRect();
        let h = null; try { h = G.WorldMap.hit(cv, e.clientX - r.left, e.clientY - r.top); } catch (err) { h = null; }
        const html = h ? `<b class="mc-n">${h.name}</b><span class="mc-b">${h.blurb || ''}</span>` : idle;
        if (html !== last) { cap.innerHTML = html; last = html; }
      };
      cv.addEventListener('mousemove', hover); cv.addEventListener('click', hover);
      body.appendChild(cap);
      return;
    }
    const cv = el('canvas', 'mapcv'); cv.width = 430; cv.height = 250;
    drawWorldMap(cv);
    body.appendChild(cv);
    body.appendChild(el('div', 'small muted', 'The Sanctum lies west of Hollowmere; Whisperwood to the south, Glimmermere to the east, and Starfall Ridge — with the mouth of the Umbral Depths — to the north.'));
  }
  function drawWorldMap(cv) {
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    const P2 = new G.Pix(cv.width, cv.height);
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
      const n = U.fbm(x / 40, y / 40, 9, 3);
      P2.set(x, y, n > 0.56 ? '#2d6450' : n > 0.48 ? '#245a40' : '#1d4a38');
    }
    const blob = (cx, cy, rx, ry, col) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) + (U.noise((cx + x) / 6, (cy + y) / 6, 4) - 0.5) * 0.5 < 1) P2.set(cx + x, cy + y, col); };
    blob(215, 40, 120, 34, '#4b475b'); blob(215, 46, 96, 22, '#5e5970');
    blob(340, 140, 52, 38, '#2e4f9f'); blob(345, 140, 34, 22, '#213479');
    blob(215, 215, 120, 34, '#153730'); blob(250, 236, 60, 14, '#1b302a');
    blob(80, 135, 48, 34, '#3b6a4e');
    for (let k = 0; k < 150; k++) { const x = (k * 97) % cv.width, y = 180 + ((k * 53) % 70); P2.set(x, y, '#0f2a25'); P2.set(x + 1, y, '#285a43'); }
    const road = [[60, 135], [215, 135], [300, 135], [338, 132]];
    for (let i = 0; i < road.length - 1; i++) { const [a, b] = road[i], [cx2, d] = road[i + 1]; for (let s = 0; s <= 1; s += 0.004) { const x = a + (cx2 - a) * s, y = b + (d - b) * s; P2.rect(Math.round(x), Math.round(y), 2, 2, '#8c81ac'); } }
    for (let y = 60; y < 220; y++) P2.rect(214 + Math.round(Math.sin(y / 9) * 2), y, 2, 1, '#8c81ac');
    for (let y = 0; y < 250; y++) P2.set(258 + Math.round(Math.sin(y / 14) * 3), y, '#69a1db');
    // landmark glyphs
    const house = (x, y, roof) => { P2.rect(x - 3, y - 2, 7, 4, '#a898a4'); for (let k = 0; k < 4; k++) P2.hline(x - 4 + k, x + 4 - k, y - 3 - k, roof); P2.set(x, y, '#3e2d2b'); P2.set(x, y + 1, '#3e2d2b'); P2.set(x - 2, y - 1, '#ffbc62'); };
    const pine = (x, y) => { for (let k = 0; k < 5; k++) P2.hline(x - (k >> 1), x + (k >> 1), y - 4 + k, k % 2 ? '#18443a' : '#22594a'); P2.set(x, y + 1, '#3e2d2b'); };
    for (const [x, y, r] of [[200, 112, '#73406a'], [228, 108, '#3a2e58'], [190, 98, '#274257'], [240, 96, '#73406a'], [206, 150, '#3a2e58']]) house(x, y, r);
    // the temple: pillars and an arch
    for (const x of [66, 72, 88, 94]) P2.rect(x, 104, 2, 8, '#c4c3d6');
    P2.hline(64, 96, 103, '#a09fb6'); P2.hline(65, 95, 102, '#c4c3d6'); P2.disc(80, 99, 3, 3, '#e4d2ff'); P2.set(81, 98, '#8f6cd1');
    // ridge: observatory tower, forge, cave mouth
    P2.rect(262, 20, 6, 14, '#7e7d97'); P2.disc(265, 19, 4, 3, '#4a3b6d'); P2.set(265, 26, '#ffbc62');
    house(150, 40, '#2a2142'); P2.rect(152, 32, 2, 4, '#45445a'); P2.set(153, 31, '#e8843c');
    P2.disc(215, 56, 6, 4, '#1b1429'); P2.disc(215, 57, 4, 3, '#07050d'); P2.set(209, 52, '#b99aee'); P2.set(221, 52, '#b99aee');
    // woods: pines, the hut, the tree house
    for (const [x, y] of [[150, 190], [160, 198], [172, 186], [260, 192], [272, 200], [284, 188], [140, 210], [298, 206], [186, 214], [246, 218]]) pine(x, y);
    house(232, 232, '#574634'); P2.set(236, 228, '#5dffb0');
    P2.disc(268, 176, 6, 5, '#337450'); P2.rect(267, 180, 3, 6, '#574039');
    // lake: boat and statue
    P2.hline(318, 326, 146, '#9c7a5e'); P2.hline(319, 325, 147, '#574039'); P2.rect(356, 128, 2, 5, '#c4c3d6'); P2.set(356, 127, '#e8eeff');
    // compass rose
    const cx0 = 404, cy0 = 26;
    P2.vline(cx0, cy0 - 9, cy0 + 9, '#efe8fb'); P2.hline(cx0 - 9, cx0 + 9, cy0, '#b1a4cf'); P2.disc(cx0, cy0, 2, 2, '#f2c45a');
    P2.set(cx0 - 1, cy0 - 8, '#efe8fb'); P2.set(cx0 + 1, cy0 - 8, '#efe8fb');
    const c2 = P2.canvas();
    c.drawImage(c2, 0, 0);
    c.font = '700 11px "Pixelify Sans", monospace'; c.fillStyle = '#efe8fb'; c.textAlign = 'center'; c.fillText('N', cx0, cy0 - 12);
    c.font = '700 13px "Pixelify Sans", monospace'; c.textAlign = 'center';
    const lab = (t, x, y, here) => { c.fillStyle = 'rgba(14,8,24,.75)'; const w = c.measureText(t).width + 10; c.fillRect(x - w / 2, y - 11, w, 16); c.fillStyle = here ? '#f2c45a' : '#efe8fb'; c.fillText(t, x, y + 1); };
    const cur = G.World.map ? G.World.map.id : '';
    const spots = { sanctum: ['The Verdant Sanctum', 80, 120], village: ['Hollowmere', 215, 120], woods: ['Whisperwood', 215, 205], lake: ['Glimmermere', 345, 112], ridge: ['Starfall Ridge', 215, 40], depths: ['Umbral Depths', 215, 62] };
    for (const k in spots) lab(spots[k][0], spots[k][1], spots[k][2], k === cur);
    if (spots[cur]) { const [, x, y] = spots[cur]; c.fillStyle = '#f2c45a'; c.beginPath(); c.arc(x, y + 14, 4, 0, 7); c.fill(); c.strokeStyle = '#120c1c'; c.lineWidth = 2; c.stroke(); }
  }

  // ---------------------------------------------------------------- chest / offering box
  P.chest = function (panel, m) {
    const arr = m.data.obj.items;
    header(panel, m, m.data.obj.home ? "Morwenna's chest" : 'Storage chest', 'Shift-click moves a whole stack across.');
    const body = el('div', 'body'); panel.appendChild(body);
    body.appendChild(el('div', 'lbl', 'Chest'));
    body.appendChild(UI.invGrid(arr, { rerender: m.rerender, quickMove: (i) => { const s = arr[i]; const left = Inv.add(s.id, s.n); if (left) s.n = left; else arr[i] = null; G.emit('inv'); m.rerender(); } }));
    body.appendChild(el('div', 'sep'));
    body.appendChild(el('div', 'lbl', 'Your satchel'));
    body.appendChild(UI.invGrid(G.S.inv, { rerender: m.rerender, quickMove: (i) => { const s = G.S.inv[i]; const left = Inv.add(s.id, s.n, arr); if (left) s.n = left; else G.S.inv[i] = null; G.emit('inv'); m.rerender(); } }));
  };
  P.offering = function (panel, m) {
    const S = G.S;
    header(panel, m, 'Moon offering box', 'Anything placed here is sold overnight. Take things back any time before you sleep.');
    const body = el('div', 'body'); panel.appendChild(body);
    const total = S.ship.reduce((a, s) => a + G.item(s.id).sell * s.n, 0);
    body.appendChild(el('div', 'row', `<div class="lbl">In the box</div><div class="gold-t small">Worth ${U.fmtNum(total)} ✦ at dawn</div>`));
    const box = el('div', 'grid r');
    if (!S.ship.length) box.appendChild(el('div', 'small muted', 'Empty. Click items in your satchel to offer them, or shift-click to offer the whole stack.'));
    S.ship.forEach((s, i) => box.appendChild(UI.slotEl(s, { onClick: () => { const left = Inv.add(s.id, s.n); if (left) s.n = left; else S.ship.splice(i, 1); G.sfx('ui_click'); m.rerender(); } })));
    body.appendChild(box);
    body.appendChild(el('div', 'sep'));
    body.appendChild(el('div', 'lbl', 'Your satchel'));
    body.appendChild(UI.invGrid(S.inv, {
      rerender: m.rerender,
      onSlot: (i, e) => {
        const s = S.inv[i]; if (!s || UI.held) return false;
        const it = G.item(s.id);
        if (it.cat === 'tool' || it.cat === 'weapon' || it.sell <= 0) { G.sfx('error'); UI.toast("That can't be sold."); return true; }
        const n = e.shiftKey ? s.n : 1;
        Inv.removeAt(i, n);
        const ex = S.ship.find((q) => q.id === s.id);
        if (ex) ex.n += n; else S.ship.push({ id: s.id, n });
        G.sfx('altar_offer', { volume: 0.6 }); m.rerender(); return true;
      },
    }));
  };

  // ---------------------------------------------------------------- shops
  G.Shop = {
    open(npc) {
      const def = G.SHOPS[npc];
      if (!def) return;
      UI.open('shop', { npc, def });
    },
  };
  P.shop = function (panel, m) {
    const S = G.S, { npc, def } = m.data;
    m.tab = m.tab || 'buy';
    panel.classList.add('shopp');
    panel.appendChild(UI.closeBtn(m));
    // header: a small portrait, the shop's name and a line from the keeper
    const head = el('div', 'shop-head');
    const cv = el('canvas'); cv.width = 64; cv.height = 64;
    UI.drawPortrait(cv, npc, m.tab === 'sell' ? 'happy' : 'neutral');
    head.appendChild(cv);
    const t = UI.npcText(npc);
    if (!m.greet) m.greet = UI.fill(U.pick((t && t.shop && t.shop.greet) || ['Have a look around.']).replace(/^\s*\[\w+\]\s*/, ''));
    head.appendChild(el('div', 'sh-title', `<h2>${def.title}</h2><div class="say">“${m.greet}”</div>`));
    head.appendChild(el('div', 'sh-gold', `${U.fmtNum(S.gold)} ✦`));
    panel.appendChild(head);
    const tabs = el('div', 'tabs');
    const tabList = [['buy', 'Buy'], ['sell', 'Sell']];
    if (def.upgrades) tabList.push(['upgrade', 'Upgrade tools']);
    if (def.geodes) tabList.push(['geodes', 'Crack geodes']);
    for (const [k, label] of tabList) { const tb = el('div', 'tab hit' + (m.tab === k ? ' on' : ''), label); tb.onclick = () => { m.tab = k; m.sel = null; m.rerender(); }; tabs.appendChild(tb); }
    panel.appendChild(tabs);
    const body = el('div', 'body'); panel.appendChild(body);
    if (m.tab === 'buy') {
      const stock = (def.stockFn ? def.stockFn(S) : def.stock).filter(([, , cond]) => !cond || cond(S));
      const rows = stock.map(([id, priceOverride]) => {
        const it = G.item(id), price = priceOverride || it.buy || it.sell * 2;
        const owned = (it.stack === 1 && (Inv.has(id) || (it.wear && S.look[it.wear] === id))) || (it.scroll && S.known[it.scroll]);
        return { id, it, price, owned };
      });
      if (!rows.length) { body.appendChild(el('div', 'muted', 'Nothing for sale right now.')); return; }
      if (!m.sel || !rows.some((r) => r.id === m.sel)) m.sel = rows[0].id;
      const shelf = el('div', 'shelf');
      const det = el('div', 'shdet');
      const buy = (r, n) => {
        if (r.owned) { G.sfx('error'); UI.toast('You already have that.'); return; }
        if (S.gold < r.price * n) { G.sfx('error'); UI.toast('Not enough glimmer.'); return; }
        if (!Inv.canAdd(r.id, n)) { G.sfx('error'); UI.toast('Your satchel is full.'); return; }
        S.gold -= r.price * n; Inv.add(r.id, n); G.sfx('buy'); UI.toastItem(r.id, n); m.rerender();
      };
      const showDetail = (r) => {
        const desc = UI.itemDesc(r.id), fx = effectText(r.it);
        const can = !r.owned && S.gold >= r.price;
        det.innerHTML = `<img src="${UI.iconURL(r.id)}" alt=""><div class="d-main"><div class="d-name">${r.it.name}</div><div class="d-meta">${UI.catName(r.it)} · <span class="gold-t">${U.fmtNum(r.price)} ✦</span>${r.owned ? ' · <span class="em">owned</span>' : ''}</div>${desc ? `<div class="d-desc">${desc}</div>` : ''}${fx && fx !== desc && !/^wearable/i.test(fx) ? `<div class="d-fx">${fx}</div>` : ''}</div>`;
        const btns = el('div', 'd-btns');
        const b1 = el('button', 'btn gold', r.owned ? 'Owned' : 'Buy'); b1.disabled = !can; b1.onclick = () => buy(r, 1); btns.appendChild(b1);
        if (r.it.stack > 1 && !r.owned) { const b5 = el('button', 'btn', 'Buy ×5'); b5.disabled = S.gold < r.price * 5; b5.onclick = () => buy(r, 5); btns.appendChild(b5); }
        det.appendChild(btns);
        if (def.wardrobe && r.it.wear) {
          const look = Object.assign({}, S.look, { [r.it.wear]: r.id });
          const f = G.playerSprites(look).walk.down[0];
          const cv = el('canvas', 'd-doll'); cv.width = f.width; cv.height = f.height;
          const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(f, 0, 0);
          det.replaceChild(cv, det.firstChild);
        }
      };
      for (const r of rows) {
        const tile = el('div', 'stile hit' + (r.id === m.sel ? ' sel' : '') + (r.owned ? ' owned' : S.gold < r.price ? ' poor' : ''));
        tile.innerHTML = `<img src="${UI.iconURL(r.id)}" alt="${r.it.name}"><span class="p">${r.owned ? '✓' : U.fmtNum(r.price)}</span>`;
        tile.title = r.it.name;
        const pick = () => { m.sel = r.id; shelf.querySelectorAll('.stile.sel').forEach((x) => x.classList.remove('sel')); tile.classList.add('sel'); showDetail(r); };
        tile.addEventListener('mouseenter', () => { if (G.Input.lastDevice === 'mouse') pick(); });
        tile.addEventListener('click', pick);
        tile.addEventListener('dblclick', () => buy(r, 1));
        shelf.appendChild(tile);
      }
      body.appendChild(shelf);
      body.appendChild(det);
      showDetail(rows.find((r) => r.id === m.sel));
    } else if (m.tab === 'geodes') {
      G.Smithy.renderCrack(body, m);
    } else if (m.tab === 'sell') {
      const cats = Object.keys(def.buys);
      const names = { crop: 'crops', forage: 'forage', seed: 'seeds', fish: 'fish', food: 'food', ore: 'ores', gem: 'gems', resource: 'materials', loot: 'monster loot', potion: 'potions', relic: 'relics', clothing: 'clothes', furniture: 'furniture', mineral: 'minerals', geode: 'geodes' };
      body.appendChild(el('div', 'sh-note', `Buys ${cats.map((c) => names[c] || c).join(', ')}. Click to sell one · shift-click sells the stack.`));
      const det = el('div', 'shdet small');
      body.appendChild(UI.invGrid(S.inv, {
        rerender: m.rerender,
        dimIf: (st) => !(def.buys[G.item(st.id).cat] && G.item(st.id).sell > 0),
        onHover: (st) => { if (!st) return; const it = G.item(st.id), mult = def.buys[it.cat]; det.innerHTML = mult && it.sell > 0 ? `<img src="${UI.iconURL(st.id)}" alt=""><div class="d-main"><div class="d-name">${it.name}</div><div class="d-meta">Sells for <span class="gold-t">${U.fmtNum(Math.max(1, Math.floor(it.sell * mult)))} ✦</span> each · you have ${st.n}</div></div>` : `<img src="${UI.iconURL(st.id)}" alt=""><div class="d-main"><div class="d-name">${it.name}</div><div class="d-meta muted">${UI.npcName(npc)} doesn't buy this.</div></div>`; },
        onSlot: (i, e) => {
          const s = S.inv[i]; if (!s || UI.held) return true;
          const it = G.item(s.id), mult = def.buys[it.cat];
          if (!mult || it.sell <= 0) { G.sfx('error'); UI.toast(`${UI.npcName(npc)} doesn't buy that.`); return true; }
          const n = e.shiftKey ? s.n : 1;
          const price = Math.max(1, Math.floor(it.sell * mult)) * n;
          Inv.removeAt(i, n); S.gold += price; S.stats.earned += price;
          G.sfx('sell'); UI.toast(`Sold ${n} ${it.name} for ${U.fmtNum(price)} ✦`); m.rerender(); return true;
        },
      }));
      body.appendChild(det);
    } else {
      const names = { hoe: 'Rune Hoe', can: 'Dew Can', pickaxe: 'Pickaxe', axe: 'Axe' };
      const effects = { hoe: ['tills 1 tile', 'tills 3 in a row', 'tills 5 in a row', 'tills a 3×3 square'], can: ['waters 1 tile', 'waters 3 in a row, holds 60', 'waters 5 in a row, holds 80', 'waters a 3×3 square, holds 100'], pickaxe: ['power 1', 'power 2: breaks boulders', 'power 3', 'power 4'], axe: ['power 1', 'power 2', 'power 3', 'power 4'] };
      const list = el('div', 'list');
      for (const k of ['hoe', 'can', 'pickaxe', 'axe']) {
        const tier = S.toolTier[k], up = G.UPGRADES[tier + 1];
        const li = el('div', 'li hit' + (!up ? ' no' : ''));
        if (!up) { li.innerHTML = `<img src="${UI.iconURL(k)}" alt=""><div><div class="nm">${names[k]} · Starsilver</div><div class="ds">Fully upgraded: ${effects[k][3]}</div></div><div class="pr">—</div>`; list.appendChild(li); continue; }
        const can = S.gold >= up.price && Inv.has(up.ore, up.qty);
        li.className = 'li hit' + (can ? '' : ' no');
        li.innerHTML = `<img src="${UI.iconURL(k)}" alt=""><div style="min-width:0"><div class="nm">${up.name} ${names[k]}</div><div class="ds">${effects[k][tier + 1]} · needs ${up.qty} ${G.item(up.ore).name} (you have ${Inv.count(up.ore)})</div></div><div class="pr">${U.fmtNum(up.price)} ✦</div>`;
        li.onclick = () => {
          if (!can) { G.sfx('error'); UI.toast(`You need ${U.fmtNum(up.price)} ✦ and ${up.qty} ${G.item(up.ore).name}.`); return; }
          S.gold -= up.price; Inv.remove(up.ore, up.qty); S.toolTier[k] = tier + 1;
          if (k === 'can') S.water = 40 + S.toolTier.can * 20;
          G.sfx('level_up'); G.jingle('quest_complete'); UI.clearIconCache(); UI._hotSig = '';
          UI.toast(`Your ${names[k]} is now ${up.name}!`); m.rerender();
        };
        list.appendChild(li);
      }
      body.appendChild(list);
    }
    m.onClose = () => { const bye = t && t.shop && t.shop.bye; if (bye) UI.toast(`${UI.npcName(npc)}: “${UI.fill(U.pick(bye)).replace(/^\s*\[\w+\]\s*/, '')}”`); };
  };
  UI.catName = function (it) {
    const c = { tool: 'Tool', weapon: 'Weapon', seed: 'Seeds', crop: 'Crop', forage: 'Forage', resource: 'Material', ore: 'Ore', gem: 'Gem', loot: 'Monster loot', fish: 'Fish', potion: 'Potion', food: it.drink ? 'Drink' : 'Food', place: 'Placeable', misc: 'Curio', clothing: 'Clothing', relic: 'Relic', furniture: 'Furniture', mineral: 'Mineral', geode: 'Geode' }[it.cat] || 'Item';
    return it.wear ? `${c} · ${it.wear}` : c;
  };

  // ---------------------------------------------------------------- cauldron
  G.Brew = {
    interact(o) {
      const S = G.S;
      if (o.state === 'done') {
        const n = o.n || 1;
        if (!Inv.canAdd(o.potion, n)) { UI.toast('Your satchel is full.'); G.sfx('error'); return; }
        Inv.add(o.potion, n); UI.toastItem(o.potion, n); G.sfx('pickup');
        G.World.player.holdItem = o.potion; G.World.player.holdT = 1;
        o.state = 'idle'; o.potion = null; o.readyAt = 0;
        return;
      }
      if (o.state === 'brewing') {
        const left = Math.max(0, o.readyAt - G.absTime());
        UI.toast(`Bubbling away… ready in about ${left >= 60 ? Math.round(left / 60) + 'h' : Math.max(10, Math.round(left / 10) * 10) + 'm'}.`);
        G.sfx('brew_bubble');
        return;
      }
      UI.open('cauldron', { obj: o });
    },
  };
  P.cauldron = function (panel, m) {
    const S = G.S, o = m.data.obj;
    m.put = m.put || [];
    header(panel, m, 'Copper cauldron', 'Add two or three ingredients, then brew. Order does not matter.');
    const body = el('div', 'body'); panel.appendChild(body);
    const wrap = el('div', 'brew');
    const pot = el('div', 'brew-pot');
    const slots = el('div', 'brew-slots');
    for (let i = 0; i < 3; i++) {
      const st = m.put[i];
      slots.appendChild(UI.slotEl(st ? { id: st, n: 1 } : null, { onClick: () => { if (m.put[i]) { Inv.add(m.put[i], 1); m.put.splice(i, 1); G.sfx('ui_click'); m.rerender(); } } }));
    }
    pot.appendChild(slots);
    const rec = m.put.length >= 2 ? G.findRecipe(m.put) : null;
    const out = el('div', 'brew-out');
    if (m.put.length < 2) out.innerHTML = '<span class="muted small">Add at least two ingredients.</span>';
    else if (rec && S.known[rec.id]) out.innerHTML = `<img src="${UI.iconURL(rec.id)}" style="width:40px;height:40px;image-rendering:pixelated" alt=""><div>${G.item(rec.id).name}</div><div class="small muted">${Math.round(rec.time / 60)}h · ${effectText(G.item(rec.id))}</div>`;
    else if (rec) out.innerHTML = '<div class="em">The brew shimmers with promise…</div><div class="small muted">An unknown recipe!</div>';
    else out.innerHTML = '<div class="muted">This mixture looks… murky.</div>';
    pot.appendChild(out);
    const btn = el('button', 'btn gold', 'Brew');
    btn.disabled = m.put.length < 2;
    btn.onclick = () => {
      const r = G.findRecipe(m.put);
      const potion = r ? r.id : 'sludge';
      o.state = 'brewing'; o.potion = potion; o.n = 1; o.readyAt = G.absTime() + (r ? r.time : 60);
      const firstTime = r && !S.known[r.id];
      if (r) S.known[r.id] = 1;
      S.stats.brewed = (S.stats.brewed || 0) + 1;
      m.put = [];
      G.sfx('brew_start');
      G.R.burst(o.tx * 16 + 8, o.ty * 16, 18, { colors: ['#5dffb0', '#b4ffd9', '#e4d2ff'], speed: 45, life: 0.9, grav: -25, up: 30 });
      const wasFirst = !S.flags.firstBrew;
      S.flags.firstBrew = true;
      m.close();
      if (firstTime) { G.jingle('discovery'); UI.toast(`New recipe discovered: ${G.item(potion).name}!`); }
      else if (potion === 'sludge') UI.toast('Something went wrong. It smells like a swamp.');
      else G.jingle('potion_brewed');
      if (wasFirst) { const fb = window.GAMETEXT && GAMETEXT.misc && GAMETEXT.misc.firstBrew; if (fb) setTimeout(() => UI.say(null, fb), 400); }
      G.emit('brew', potion);
    };
    pot.appendChild(btn);
    wrap.appendChild(pot);
    const right = el('div', 'col');
    right.appendChild(el('div', 'lbl', 'Ingredients in your satchel'));
    right.appendChild(UI.invGrid(S.inv, {
      rerender: m.rerender,
      onSlot: (i) => {
        const s = S.inv[i]; if (!s) return true;
        const it = G.item(s.id);
        if (['tool', 'weapon', 'place', 'seed'].includes(it.cat) || it.scroll) { G.sfx('error'); return true; }
        if (m.put.length >= 3) { G.sfx('error'); UI.toast('The cauldron holds three ingredients.'); return true; }
        Inv.removeAt(i, 1); m.put.push(s.id); G.sfx('brew_bubble', { volume: 0.6 }); m.rerender(); return true;
      },
    }));
    const known = G.RECIPES.filter((r) => S.known[r.id]);
    right.appendChild(el('div', 'lbl', 'Known recipes'));
    const kl = el('div', 'col small');
    for (const r of known) {
      const have = r.ing.every((i) => Inv.count(i) >= r.ing.filter((x) => x === i).length);
      const row = el('div', 'li hit' + (have ? '' : ' no'));
      row.innerHTML = `<img src="${UI.iconURL(r.id)}" alt=""><div style="min-width:0"><div class="nm">${G.item(r.id).name}</div><div class="ds">${r.ing.map((i) => G.item(i).name).join(' + ')}</div></div><div class="pr">${have ? 'Add' : ''}</div>`;
      row.onclick = () => {
        if (!have) { G.sfx('error'); return; }
        for (const id of m.put) Inv.add(id, 1);
        m.put = [];
        for (const i of r.ing) { Inv.remove(i, 1); m.put.push(i); }
        G.sfx('brew_bubble'); m.rerender();
      };
      kl.appendChild(row);
    }
    right.appendChild(kl);
    wrap.appendChild(right);
    body.appendChild(wrap);
    m.onClose = () => { for (const id of m.put) Inv.add(id, 1); m.put = []; };
  };

  // ---------------------------------------------------------------- moon altar
  P.altar = function (panel, m) {
    const S = G.S;
    header(panel, m, 'The Moon Altar', 'Offer the valley’s gifts and the Sanctum will remember itself.');
    const body = el('div', 'body'); panel.appendChild(body);
    const AT = window.GAMETEXT && GAMETEXT.altar;
    const list = el('div', 'col');
    for (const b of G.BUNDLES) {
      const done = S.bundlesDone[b.id];
      const prog = S.bundles[b.id] = S.bundles[b.id] || {};
      const card = el('div', 'bundle' + (done ? ' done' : ''));
      card.appendChild(el('div', '', `<div style="font-size:18px">${b.name} ${done ? '<span class="em small">· complete</span>' : ''}</div><div class="small muted">${(AT && AT.bundles && AT.bundles[b.id]) || ''}</div>`));
      const need = el('div', 'need');
      for (const [id, n] of b.items) {
        const have = prog[id] || 0;
        const s = UI.slotEl({ id, n: Math.max(1, n) }, { cls: have >= n ? 'ok' : '' });
        s.querySelector('img').style.opacity = have >= n ? '1' : '0.4';
        const lab = s.querySelector('.n') || el('span', 'n');
        lab.textContent = `${Math.min(have, n)}/${n}`; s.appendChild(lab);
        need.appendChild(s);
      }
      card.appendChild(need);
      card.appendChild(el('div', 'small gold-t', 'Reward: ' + b.reward));
      if (!done) {
        const btn = el('button', 'btn', 'Offer what I have');
        btn.onclick = () => offer(b);
        card.appendChild(btn);
      }
      list.appendChild(card);
    }
    body.appendChild(list);
    async function offer(b) {
      const prog = S.bundles[b.id];
      let given = 0;
      for (const [id, n] of b.items) {
        const have = prog[id] || 0, want = n - have;
        if (want <= 0) continue;
        const k = Math.min(want, Inv.count(id));
        if (k > 0) { Inv.remove(id, k); prog[id] = have + k; given += k; }
      }
      if (!given) { G.sfx('error'); UI.toast("You don't carry anything this offering needs."); return; }
      G.sfx('altar_offer');
      const complete = b.items.every(([id, n]) => (prog[id] || 0) >= n);
      if (complete) {
        S.bundlesDone[b.id] = true;
        m.close();
        await completeBundle(b);
      } else m.rerender();
    }
  };
  async function completeBundle(b) {
    const S = G.S, AT = window.GAMETEXT && GAMETEXT.altar;
    G.jingle('altar_restored');
    G.R.doFlash('220,200,255', 0.6);
    G.R.shake(2, 0.6);
    const sa = G.World.maps.sanctum;
    G.R.burst(sa.altarProp.x, sa.altarProp.y - 30, 40, { colors: ['#ffffff', '#e4d2ff', '#b99aee', '#5dffb0'], speed: 80, life: 1.4, grav: -10 });
    if (b.id === 'garden') { S.flags.altar1 = true; Inv.giveOrDrop('dewcrystal', 2); }
    if (b.id === 'forage') { Inv.giveOrDrop('moonmulch', 25); Inv.giveOrDrop('pearl', 1); }
    if (b.id === 'delver') { S.maxHp += 25; S.hp = S.maxHp; Inv.giveOrDrop('sword_silver', 1); }
    if (b.id === 'alchemy') { Inv.giveOrDrop('cauldron', 2); S.maxEnergy += 40; S.energy = S.maxEnergy; }
    if (b.id === 'angler') { S.known.pot_tide = 1; S.gold += 5000; }
    G.World.applyRestoration(true);
    const pages = AT && AT.offered && AT.offered[b.id];
    await UI.say(null, pages || ['The altar drinks in the offering. Somewhere beneath your feet, old roots stir.']);
    const n = Object.values(S.bundlesDone).filter(Boolean).length;
    if (n >= 5) {
      S.flags.altarComplete = true;
      await UI.say(null, (AT && AT.complete) || ['The Moon Altar blazes. The way to the Archon lies open at the bottom of the Depths.']);
      S.maxHp += 25; S.hp = S.maxHp;
    }
    G.emit('bundle', b.id);
  }

  // ---------------------------------------------------------------- notice board
  P.board = function (panel, m) {
    const S = G.S;
    header(panel, m, 'Notice board', 'Pinned with brass tacks and good intentions.');
    const body = el('div', 'body'); panel.appendChild(body);
    const reqs = window.GAMETEXT && GAMETEXT.requests;
    if (G.isFullMoon()) { const ft = window.GAMETEXT && GAMETEXT.festival && GAMETEXT.festival.announce; body.appendChild(el('div', 'bundle', `<div class="lbl">Tonight</div><div style="font-size:18px">${(ft && ft.board) || 'The Lantern Moon festival: the plaza, 6pm to midnight!'}</div>`)); }
    if (S.request) {
      const r = S.request;
      body.appendChild(el('div', 'bundle', `<div class="lbl">Accepted</div><div style="font-size:18px">${UI.npcName(r.npc)} needs ${r.qty} × ${G.item(r.item).name}</div><div class="small muted">${UI.fill(r.text)}</div><div class="small gold-t">Bring them to ${UI.npcName(r.npc)} · reward ${U.fmtNum(r.reward)} ✦ · you have ${Inv.count(r.item)}</div>`));
      return;
    }
    if (!reqs || S.boardToday == null || S.boardTaken === S.day) { body.appendChild(el('div', 'muted', 'Nothing new today. A drawing of a cat, a lost glove, an advert for Sable’s honeymoon mead.')); return; }
    const r = reqs[S.boardToday % reqs.length];
    const card = el('div', 'bundle', `<div style="font-size:18px">${UI.npcName(r.npc)} — ${r.qty} × ${G.item(r.item).name}</div><div class="small">${UI.fill(r.text)}</div><div class="small gold-t">Reward ${U.fmtNum(r.reward)} ✦ and friendship · 2 days to deliver</div>`);
    const b = el('button', 'btn gold', 'Accept request');
    b.onclick = () => { S.request = Object.assign({}, r, { day: S.day }); S.boardTaken = S.day; G.sfx('quest_complete', { volume: 0.5 }); UI.toast('Request accepted.'); m.rerender(); };
    card.appendChild(b);
    body.appendChild(card);
  };

  // ---------------------------------------------------------------- end of day summary
  P.summary = function (panel, m) {
    const S = G.S, d = m.data;
    m.noBgClose = true;
    panel.appendChild(el('h2', '', d.passedOut ? 'You passed out…' : 'Goodnight'));
    panel.appendChild(el('div', 'subtitle', `Day ${S.day - 1} is done. ${d.passedOut ? `Someone carried you home. You lost ${U.fmtNum(d.lost || 0)} ✦.` : 'The moon keeps watch over the Sanctum.'}`));
    const body = el('div', 'body'); panel.appendChild(body);
    const lines = G.World.shippedLines || [];
    if (lines.length) {
      const grid = el('div', 'summary-list');
      for (const [id, n, v] of lines) grid.innerHTML += `<img src="${UI.iconURL(id)}" alt=""><div>${n} × ${G.item(id).name}</div><div class="gold-t">${U.fmtNum(v)} ✦</div>`;
      body.appendChild(el('div', 'lbl', 'Sold from the offering box'));
      body.appendChild(grid);
      body.appendChild(el('div', 'sep'));
      body.appendChild(el('div', '', `Total earned: <span class="gold-t">${U.fmtNum(d.earned)} ✦</span>`));
    } else body.appendChild(el('div', 'muted', 'Nothing was in the offering box tonight.'));
    const wx = { sunny: 'sunshine', clear: 'fair skies', rain: 'rain (your crops will be watered)', mist: 'mist', starfall: 'a starfall' }[S.weather] || 'fair skies';
    body.appendChild(el('div', 'small muted', `Tomorrow: ${G.weekday()}, ${G.MOON[G.moonPhase()]} — ${wx}.${G.isFullMoon() ? ' Crops grow faster under a full moon.' : ''}`));
    const b = el('button', 'btn gold', 'Wake up');
    b.style.marginTop = '14px'; b.style.alignSelf = 'flex-end';
    b.onclick = () => m.close();
    panel.appendChild(b);
    m.keys = { Enter: () => m.close(), Space: () => m.close(), KeyE: () => m.close() };
    setTimeout(() => b.focus(), 50);
  };

  // ---------------------------------------------------------------- pause / settings
  P.pause = function (panel, m) {
    header(panel, m, 'Paused', `Day ${G.S.day} · ${U.fmtTime(G.S.mins)} · progress saves each night when you sleep.`);
    const body = el('div', 'body'); panel.appendChild(body);
    body.appendChild(settingsBlock());
    body.appendChild(el('div', 'sep'));
    body.appendChild(el('div', 'lbl', 'Controls'));
    body.appendChild(el('div', 'small muted', '<span class="key">WASD</span> move · <span class="key">Left click</span>/<span class="key">Space</span> use tool or weapon · <span class="key">Right click</span>/<span class="key">E</span> talk, harvest, open, eat · <span class="key">1</span>–<span class="key">=</span> or wheel select · <span class="key">I</span> satchel · <span class="key">M</span> map · <span class="key">J</span> journal · <span class="key">H</span> Field Guide · <span class="key">Q</span> cast a spell · <span class="key">Tab</span> next spell · <span class="key">G</span> decorate (in your cottage) · <span class="key">Esc</span> menu'));
    const row = el('div', 'row'); row.style.marginTop = '16px';
    const res = el('button', 'btn gold', 'Resume'); res.onclick = () => m.close();
    const guide = el('button', 'btn', 'Field Guide'); guide.onclick = () => { m.close(); UI.open('guide'); };
    const quit = el('button', 'btn ghost', 'Quit to title'); quit.onclick = async () => { m.close(); const ok = await UI.confirm('Quit to the title screen? Progress since you last slept will be lost.', 'Quit', 'Stay'); if (ok) location.reload(); };
    row.appendChild(res); row.appendChild(guide); row.appendChild(quit);
    panel.appendChild(row);
  };
  function settingsBlock() {
    const box = el('div', 'col');
    box.appendChild(el('div', 'lbl', 'Sound'));
    const A = window.AudioEngine;
    const vols = (A && A.getVolumes && A.getVolumes()) || { master: 0.8, music: 0.55, sfx: 0.7, ambience: 0.5 };
    for (const [k, label, fn] of [['master', 'Master', 'setMasterVolume'], ['music', 'Music', 'setMusicVolume'], ['ambience', 'Ambience', 'setAmbienceVolume'], ['sfx', 'Effects', 'setSfxVolume']]) {
      const row = el('div', 'slider');
      row.innerHTML = `<label for="vol-${k}">${label}</label><input id="vol-${k}" type="range" min="0" max="100" step="1" value="${Math.round(vols[k] * 100)}"><span>${Math.round(vols[k] * 100)}</span>`;
      const inp = row.querySelector('input'), out = row.querySelector('span');
      inp.oninput = () => { out.textContent = inp.value; try { A && A[fn](inp.value / 100); } catch (e) { /* optional */ } G.Save.saveSettings(); };
      box.appendChild(row);
    }
    box.appendChild(el('div', 'lbl', 'Display'));
    // Look: a colour grade over the whole world
    const lk = el('div', 'looks');
    for (const [k, L] of Object.entries(G.R.LOOKS)) {
      const b = el('button', 'look hit' + (G.prefs.look === k ? ' on' : ''), `<span class="sw sw-${k}"></span><span class="t">${L.name}<span class="small muted">${L.note}</span></span>`);
      b.onclick = () => { G.prefs.look = k; G.Save.saveSettings(); lk.querySelectorAll('.look').forEach((x) => x.classList.toggle('on', x === b)); G.sfx('ui_click', { volume: 0.35 }); };
      lk.appendChild(b);
    }
    box.appendChild(el('div', 'small muted', 'Look'));
    box.appendChild(lk);
    const zr = el('div', 'slider');
    zr.innerHTML = `<label for="zoom">Zoom</label><input id="zoom" type="range" min="-2" max="2" step="1" value="${G.R.zoomBias}"><span>${G.R.zoomBias > 0 ? '+' : ''}${G.R.zoomBias}</span>`;
    const zi = zr.querySelector('input');
    zi.oninput = () => { G.R.setZoom(+zi.value); zr.querySelector('span').textContent = (zi.value > 0 ? '+' : '') + zi.value; G.Save.saveSettings(); };
    box.appendChild(zr);
    const des = el('button', 'btn', 'Designs…');
    des.style.alignSelf = 'flex-start'; des.title = 'Switch between the original look of things and the alternatives';
    des.onclick = () => UI.open('designs');
    box.appendChild(des);
    if (document.documentElement.requestFullscreen) {
      const fs = el('button', 'btn ghost', document.fullscreenElement ? 'Leave full screen' : 'Full screen');
      fs.style.alignSelf = 'flex-start';
      fs.onclick = () => {
        const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        Promise.resolve(p).then(() => { fs.textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen'; }).catch(() => UI.toast('Full screen is not available here.'));
      };
      box.appendChild(fs);
    }
    box.appendChild(adminBlock());
    return box;
  }
  UI.settingsBlock = settingsBlock;

  // tester mode: switches for playing without limits, plus a few shortcuts for trying things out
  function toggle(label, on, fn, hint) {
    const row = el('label', 'tgl hit');
    row.innerHTML = `<input type="checkbox"${on ? ' checked' : ''}><span class="sw"></span><span class="tl">${label}${hint ? `<span class="small muted"> · ${hint}</span>` : ''}</span>`;
    row.querySelector('input').onchange = (e) => { fn(e.target.checked); G.Save.saveSettings(); G.sfx('ui_click', { volume: 0.35 }); };
    return row;
  }
  function adminBlock() {
    const box = el('div', 'col admin');
    box.appendChild(el('div', 'lbl', 'Tester mode'));
    const inner = el('div', 'col adm-in');
    box.appendChild(toggle('Tester mode', G.prefs.admin, (v) => { G.prefs.admin = v; inner.style.display = v ? '' : 'none'; }, 'for trying things out'));
    inner.style.display = G.prefs.admin ? '' : 'none';
    box.appendChild(inner);
    const sw = el('div', 'tgl-grid');
    for (const [k, label, hint] of [['noSleep', 'No sleep needed', '2am rolls into the next day'], ['energy', 'Infinite energy', ''], ['god', 'Invincible', ''], ['freeze', 'Freeze time', ''], ['fast', 'Fast walk', '']]) sw.appendChild(toggle(label, G.prefs[k], (v) => { G.prefs[k] = v; }, hint));
    inner.appendChild(sw);
    if (!G.S || G.Main.mode !== 'play') { inner.appendChild(el('div', 'small muted', 'More shortcuts appear here once you are in a game.')); return box; }
    const S = G.S, W = G.World;
    const tools = el('div', 'adm-tools');
    const btn = (label, fn) => { const b = el('button', 'btn', label); b.onclick = () => { fn(); G.sfx('ui_click', { volume: 0.35 }); }; tools.appendChild(b); return b; };
    btn('+10,000 ✦', () => { S.gold += 10000; UI.toast('+10,000 ✦'); });
    btn('Ripen crops', () => {
      let n = 0;
      for (const id in W.maps) { const m = W.maps[id]; if (!m.farm) continue; for (const f of m.farm.values()) if (f.crop) { const d = G.CROPS[f.crop.id]; if (d) { f.crop.days = Math.max(f.crop.days, f.crop.regrowing ? d.regrow : d.days); f.watered = true; n++; } } }
      UI.toast(n ? `${n} crops are ready to harvest.` : 'Nothing is planted yet.');
    });
    btn('Water all', () => { for (const id in W.maps) { const m = W.maps[id]; if (m.farm) for (const f of m.farm.values()) f.watered = true; } UI.toast('Every tilled tile is watered.'); });
    btn('Next day', () => { UI.closeAll(); W.rollDay(); });
    inner.appendChild(tools);
    // time of day
    const tr = el('div', 'slider');
    tr.innerHTML = `<label for="adm-time">Time</label><input id="adm-time" type="range" min="360" max="1550" step="10" value="${Math.min(1550, Math.round(S.mins / 10) * 10)}"><span>${U.fmtTime(S.mins)}</span>`;
    const ti = tr.querySelector('input');
    ti.oninput = () => { S.mins = +ti.value; tr.querySelector('span').textContent = U.fmtTime(S.mins); W.lastTick = -1; };
    inner.appendChild(tr);
    // weather
    const wr = el('div', 'adm-row');
    wr.appendChild(el('span', 'muted', 'Weather'));
    for (const w of ['sunny', 'clear', 'rain', 'mist', 'starfall']) {
      const b = el('button', 'btn small' + (S.weather === w ? ' gold' : ''), U.cap(w));
      b.onclick = () => { S.weather = W.weather = w; if (W.setWeather) W.setWeather(w); W.updateAudio(true); UI.toast(`Weather: ${w}`); wr.querySelectorAll('.btn').forEach((x) => x.classList.remove('gold')); b.classList.add('gold'); };
      wr.appendChild(b);
    }
    inner.appendChild(wr);
    // teleport
    const places = [['sanctum', 'The Verdant Sanctum', 'altar'], ['cottage', "The Keeper's Cottage", 'bed'], ['village', 'Hollowmere', 'plaza'], ['woods', 'Whisperwood', 'grove'], ['deepwood', 'The Deepwood', null], ['glade', 'Hushwillow Glade', null], ['lake', 'Glimmermere', 'dock'], ['ridge', 'Starfall Ridge', 'cave']];
    const tp = el('div', 'adm-row');
    tp.appendChild(el('span', 'muted', 'Go to'));
    const sel = el('select', 'adm-sel');
    for (const [id, name] of places) if (W.maps[id]) sel.appendChild(new Option(name, id));
    sel.appendChild(new Option('The Umbral Depths…', 'depths'));
    const fl = el('input', 'adm-num'); fl.type = 'number'; fl.min = 1; fl.max = 60; fl.value = Math.max(1, S.maxDepth || 1); fl.title = 'Floor';
    fl.style.display = 'none';
    sel.onchange = () => { fl.style.display = sel.value === 'depths' ? '' : 'none'; };
    const go = el('button', 'btn', 'Go');
    go.onclick = () => {
      const id = sel.value; UI.closeAll();
      if (id === 'depths') { W.changeMap('depths', null, { floor: U.clamp(+fl.value || 1, 1, 60) }); return; }
      const pl = places.find((x) => x[0] === id); const m = W.maps[id];
      const at = (pl && pl[2] && m && m.spawns[pl[2]]) ? pl[2] : (m && Object.keys(m.spawns)[0]) || 'start';
      W.changeMap(id, at);
    };
    tp.appendChild(sel); tp.appendChild(fl); tp.appendChild(go);
    inner.appendChild(tp);
    // give items
    const gr = el('div', 'adm-row');
    gr.appendChild(el('span', 'muted', 'Give'));
    const isel = el('select', 'adm-sel');
    const ids = Object.keys(G.ITEMS).filter((id) => !G.ITEMS[id].hidden).sort((a, b) => G.ITEMS[a].name.localeCompare(G.ITEMS[b].name));
    for (const id of ids) isel.appendChild(new Option(G.ITEMS[id].name, id));
    const qn = el('input', 'adm-num'); qn.type = 'number'; qn.min = 1; qn.max = 999; qn.value = 10;
    const gb = el('button', 'btn', 'Give');
    gb.onclick = () => { const id = isel.value, it = G.item(id), n = Math.max(1, Math.min(+qn.value || 1, it.stack || 1)); if (!G.Inv.canAdd(id, n)) { UI.toast('Your satchel is full.'); return; } G.Inv.add(id, n); UI.toastItem(id, n); };
    gr.appendChild(isel); gr.appendChild(qn); gr.appendChild(gb);
    inner.appendChild(gr);
    return box;
  }
})();
