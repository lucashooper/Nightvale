// Nightvale — round three satchel tabs: the Handbook (field notes on how everything works) and Crafting
// (blueprint recipes), plus the Guild contracts section of the Journal.
(function () {
  'use strict';
  const G = window.G, U = G.U, UI = G.UI;
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  UI.tabs = UI.tabs || {};

  // ---------------------------------------------------------------- the Handbook
  const TAB_COLS = ['#ffb3c8', '#bfe8c8', '#ffe08a', '#d6c8ff', '#b8e0ff', '#ffd0a8'];
  const HB_ICONS = { start: 'seed_moonpetal', farming: 'can', brewing: 'pot_healing', food: 'food_bread', money: 'relic_coin', shops: 'snack_sweets', guild: 'contract', geodes: 'geode_moon', pets: 'pet_kitten', magic: 'spellbook', familiars: 'fam_treat', romance: 'bouquet', festival: 'sky_lantern', depths: 'pickaxe', controls: 'hoe' };
  UI.tabs.handbook = function (body, m) {
    const book = (window.GAMETEXT && GAMETEXT.handbook) || [];
    if (!book.length) { body.appendChild(el('div', 'muted', 'The Handbook\'s pages are blank.')); return; }
    if (!book.some((c) => c.id === m.chapter)) m.chapter = book[0].id;
    const wrap = el('div', 'hb');
    const page = el('div', 'hb-page');
    const ch = book.find((c) => c.id === m.chapter);
    page.appendChild(el('div', 'hb-ttl', ch.title));
    ch.pages.forEach((p, i) => page.appendChild(el('p', i === 0 ? 'hb-lead' : '', UI.fill(p))));
    if (ch.id === 'farming') page.appendChild(cropTable());
    if (ch.id === 'geodes' && G.Smithy) page.appendChild(el('p', 'hb-tip', `Tip: you've donated ${G.Smithy.donatedCount()} of 24 minerals so far.`));
    if (ch.id === 'guild' && G.Guild && G.S.guild) page.appendChild(el('p', 'hb-tip', `Tip: you're ${G.Guild.rankName(G.S.guild.rank)} rank, carrying ${G.S.guild.active.length} of 3 contracts.`));
    const tabs = el('div', 'hb-tabs');
    book.forEach((c, i) => {
      const t = el('div', 'hb-tab hit' + (c.id === m.chapter ? ' on' : ''), `<img src="${UI.iconURL(HB_ICONS[c.id] || 'letter')}" alt="">${c.title}`);
      t.style.setProperty('--tab', TAB_COLS[i % TAB_COLS.length]);
      t.onclick = () => { m.chapter = c.id; G.sfx('ui_click', { volume: 0.3 }); m.rerender(); };
      tabs.appendChild(t);
    });
    wrap.appendChild(page); wrap.appendChild(tabs);
    body.appendChild(wrap);
  };
  function cropTable() {
    const box = el('div', 'hb-crops');
    for (const id in G.CROPS) {
      const c = G.CROPS[id], seed = Object.keys(G.ITEMS).find((k) => G.ITEMS[k].seed === id);
      if (!seed) continue;
      const row = el('div', 'hb-crop');
      row.innerHTML = `<img src="${UI.iconURL(c.item)}" alt=""><span>${G.item(c.item).name}</span><span class="muted">${c.days} days${c.regrow ? ` · regrows every ${c.regrow}` : ''}</span>`;
      const strip = el('span', 'hb-strip');
      for (let s = 0; s <= 4; s++) { const cv = el('canvas'); cv.width = 16; cv.height = 32; try { const src = window.ItemArt && ItemArt.crop(id, s); if (src) cv.getContext('2d').drawImage(src, 0, 0); } catch (e) { /* art optional */ } strip.appendChild(cv); }
      row.appendChild(strip);
      box.appendChild(row);
    }
    return box;
  }

  // ---------------------------------------------------------------- Crafting
  UI.tabs.crafting = function (body, m) {
    const S = G.S, known = Object.keys(G.CRAFT).filter((k) => S.known[k] && G.ITEMS[k]);
    body.appendChild(el('div', 'small muted', 'Blueprints turn up on the rare floors of the Umbral Depths and in Guild rewards. Read one (E) to learn it.'));
    const list = el('div', 'cr-list');
    for (const out of Object.keys(G.CRAFT)) {
      const r = G.CRAFT[out];
      if (!G.ITEMS[out]) continue;
      const k = known.includes(out);
      const have = r.needs.every(([id, n]) => G.Inv.count(id) >= n);
      const row = el('div', 'cr-row' + (k ? '' : ' unk'));
      const needs = r.needs.map(([id, n]) => { const c = G.Inv.count(id); return `<span class="cr-need ${c >= n ? 'ok' : ''}"><img src="${UI.iconURL(id)}" alt="">${G.item(id).name} ${Math.min(c, n)}/${n}</span>`; }).join('');
      row.innerHTML = `<img class="cr-ic" src="${UI.iconURL(k ? out : r.bp)}" alt=""><div class="cr-main"><div class="cr-n">${k ? G.item(out).name + (r.n > 1 ? ' ×' + r.n : '') : 'Unknown blueprint'}</div><div class="cr-needs">${k ? needs : '<span class="muted">Find its blueprint to learn this.</span>'}</div></div>`;
      if (k) {
        const b = el('button', 'btn' + (have ? ' gold' : ''), 'Craft');
        b.disabled = !have;
        b.onclick = () => {
          if (!r.needs.every(([id, n]) => G.Inv.count(id) >= n)) return;
          if (!G.Inv.canAdd(out, r.n || 1)) { G.sfx('error'); UI.toast('Your satchel is full.'); return; }
          for (const [id, n] of r.needs) G.Inv.remove(id, n);
          G.Inv.add(out, r.n || 1); G.sfx('level_up', { volume: 0.5 }); UI.toastItem(out, r.n || 1);
          m.rerender();
        };
        row.appendChild(b);
      }
      list.appendChild(row);
    }
    body.appendChild(list);
  };

  // ---------------------------------------------------------------- Journal: Guild contracts
  UI.tabs.contracts = function (body) {
    const g = G.S.guild; if (!g || !g.seen) return;
    body.appendChild(el('div', 'lbl', `Guild contracts · ${G.Guild.rankName(g.rank)} rank`));
    if (!g.active.length) { body.appendChild(el('div', 'small muted', 'None carried. The board in the Guild hall has new notices every three days.')); return; }
    for (const a of g.active) {
      const d = G.Guild.def(a.id), done = G.Guild.complete(a);
      body.appendChild(el('div', 'small', `${done ? '<span class="em">✓</span>' : '○'} <b>${G.Guild.title(a)}</b> <span class="muted">· ${done ? 'done: return to Gideon' : `${G.Guild.progress(a)} / ${a.n}`} · ${U.fmtNum(d.rw)} ✦</span>`));
    }
  };
})();
