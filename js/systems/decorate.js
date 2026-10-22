// Nightvale — decorating the keeper's cottage. Furniture (furn_*) is bought from shops (or won in the Depths)
// and placed on a grid inside the cottage in decorate mode: pick a piece from the tray to place it, click a
// placed piece to pick it back up. Press G (or the Decorate button) inside the cottage; Esc to finish.
(function () {
  'use strict';
  const G = window.G, U = G.U, I = G.ITEMS;
  const D = (G.Decor = {});
  const FA = () => window.FurnitureArt;

  // ---------------------------------------------------------------- furniture items & who sells them
  const SELL = { brann: 'brann', isolde: 'isolde', mirabel: 'mirabel', fennick: 'fennick', orvyn: 'orvyn' };
  try {
    for (const f of (FA() && FA().list) || []) {
      I[f.id] = { id: f.id, name: f.name, cat: 'furniture', sell: Math.floor((f.price || 200) / 4), buy: f.price || 0, stack: 20, furn: f };
      const shop = SELL[f.seller] && G.SHOPS[SELL[f.seller]];
      if (shop && f.price) shop.stock.push([f.id, null, f.seller === 'fennick' ? (s) => s.day % 2 === 0 : null]);
    }
  } catch (e) { /* furniture art missing: no furniture */ }
  // trophies from the Depths
  G.on('kill', (type) => {
    const S = G.S, give = (id) => { if (I[id] && !S.flags['trophy_' + id]) { S.flags['trophy_' + id] = true; G.Inv.giveOrDrop(id, 1); G.UI.toast(`A trophy for your cottage: ${I[id].name}.`, id); } };
    if (type === 'broodmother') give('furn_trophy_spider');
    if (type === 'archon') give('furn_trophy_crown');
    if (type === 'slime' && Math.random() < 0.01) give('furn_trophy_slime');
  });

  // ---------------------------------------------------------------- the cottage layout (saved in S.cottage)
  const DEFAULT = [['furn_cot', 2, 4], ['furn_desk', 5, 3], ['furn_chair_oak', 5, 4], ['furn_bookshelf', 11, 3], ['furn_rug_round', 6, 6], ['furn_cat_bed', 11, 8], ['furn_fern', 1, 9], ['furn_portrait_morwenna', 5, 2], ['furn_wall_clock', 12, 2], ['furn_candelabra', 8, 4]];
  const st = () => { const S = G.S; if (!S.cottage) S.cottage = { items: DEFAULT.filter(([id]) => I[id]).map(([id, x, y]) => ({ id, x, y })) }; return S.cottage; };
  const info = (id) => (FA() && FA().info(id)) || { w: 1, h: 1 };
  const isBed = (id) => /^furn_(cot|bed_canopy)$/.test(id);
  function interactFor(id) {
    if (isBed(id)) return { kind: 'bed' };
    if (id === 'furn_desk') return { kind: 'flavor', key: 'cottage_desk' };
    if (id === 'furn_mirror' || id === 'furn_wardrobe') return { kind: 'mirror' };
    return null;
  }
  D.furnish = function (map) {
    if (!map || map.id !== 'cottage') return;
    for (const p of map.props.slice()) if (p.o && p.o.furn) map.removeProp(p);
    for (const it of st().items) {
      const f = info(it.id);
      map.furn(it.id, it.x, it.y, { interact: interactFor(it.id), furnItem: it, solid: f.flat || f.wall ? false : true });
    }
  };
  G.on('worldStart', () => D.furnish(G.World.maps.cottage));
  G.on('mapChanged', (map) => {
    if (!map || map.id !== 'cottage' || G.S.flags.cottageIntro) return;
    G.S.flags.cottageIntro = true;
    const t = window.GAMETEXT && GAMETEXT.cottage;
    const show = () => {
      if (G.UI.isModal() || G.World.sleeping || G.World.trans || G.UI.fadeEl && parseFloat(getComputedStyle(G.UI.fadeEl).opacity) > 0.1) { setTimeout(show, 500); return; }
      G.UI.say(null, (t && t.intro) || ["The keeper's cottage. It's yours now."]).then(() => G.UI.toast('Press G (or the Decorate button) to rearrange the cottage.'));
    };
    setTimeout(show, 700);
  });

  // Inkwell curls up in the cat bed in the evenings
  D.catBed = function () {
    const map = G.World.map; if (!map || map.id !== 'cottage' || G.S.mins < 1140) return null;
    const it = st().items.find((x) => x.id === 'furn_cat_bed'); return it || null;
  };
  D.drawables = function (list) {
    const b = D.catBed(); if (!b) return;
    list.push({ sortY: (b.y + 1) * 16 - 0.5, draw(ctx, ox, oy) { const s = G.Cat.sprites(), f = s.sleep[Math.floor(G.R.time * 1.2) % s.sleep.length]; ctx.drawImage(f, b.x * 16 + ox, (b.y + 1) * 16 - 16 - 3 + oy); } });
  };
  D.catAt = function (tx, ty) { const b = D.catBed(); return !!(b && b.x === tx && b.y === ty); };

  // ---------------------------------------------------------------- placement rules
  function cells(id, x, y) { const f = info(id), out = []; for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) out.push([x + i, y + j]); return out; }
  D.canPlace = function (id, x, y, ignore) {
    const map = G.World.maps.cottage, f = info(id), wallRow = map.wallRows - 1;
    const items = st().items.filter((it) => it !== ignore);
    const mine = cells(id, x, y);
    for (const [cx, cy] of mine) {
      if (cx < 1 || cx > map.w - 2) return false;
      if (f.wall) { if (cy !== wallRow) return false; }
      else if (cy < map.wallRows || cy > map.h - 2) return false;
      if (!f.wall && cx === map.doorX && cy === map.h - 2) return false; // keep the doorway clear
      // the built-in hearth and windows
      const pr = map.propAt.get(map.idx(cx, cy));
      if (pr && !(pr.o && pr.o.furn)) return false;
      for (const it of items) {
        const g = info(it.id);
        if (!!g.flat !== !!f.flat || !!g.wall !== !!f.wall) continue; // rugs under furniture, pictures on walls
        if (cells(it.id, it.x, it.y).some(([ax, ay]) => ax === cx && ay === cy)) return false;
      }
    }
    // never block the player in: the tile in front of the door must stay reachable
    return true;
  };

  // ---------------------------------------------------------------- decorate mode
  D.active = false; D.sel = null; D.hover = null;
  D.can = () => G.World.map && G.World.map.id === 'cottage' && G.Main.mode === 'play';
  D.toggle = function () {
    if (!D.active && !D.can()) return;
    D.active = !D.active; D.sel = null;
    G.World.decorating = D.active;
    G.sfx(D.active ? 'page_turn' : 'menu_close', { volume: 0.5 });
    D.tray();
    if (D.active && !G.S.flags.decorTip) { G.S.flags.decorTip = true; const t = window.GAMETEXT && GAMETEXT.cottage && GAMETEXT.cottage.decorateTip; G.UI.toast(t ? G.UI.fill(Array.isArray(t) ? t[0] : t) : 'Pick a piece from the tray to place it, or click furniture to pick it up.'); }
  };
  D.tile = function () {
    const I2 = G.Input; if (!I2.mouse.onCanvas) return null;
    const [wx, wy] = G.R.screenToWorld(I2.mouse.x, I2.mouse.y);
    return [Math.floor(wx / 16), Math.floor(wy / 16)];
  };
  D.update = function () {
    if (!D.active) return;
    if (!D.can()) { D.toggle(); return; }
    const I2 = G.Input, map = G.World.map;
    if (I2.keyHit('Escape') || I2.keyHit('KeyG')) { D.toggle(); return; }
    const t = D.tile(); D.hover = t;
    if (!t) return;
    if (I2.mouse.pressed[2]) { if (D.sel) { D.sel = null; D.tray(); } else D.toggle(); return; }
    if (!I2.mouse.pressed[0]) return;
    const S = G.S;
    if (D.sel) {
      const f = info(D.sel), x = t[0] - Math.floor((f.w - 1) / 2), y = f.wall ? map.wallRows - 1 : t[1] - (f.h - 1);
      if (!D.canPlace(D.sel, x, y)) { G.sfx('error', { volume: 0.5 }); return; }
      if (!G.Inv.has(D.sel)) { D.sel = null; D.tray(); return; }
      G.Inv.remove(D.sel, 1);
      st().items.push({ id: D.sel, x, y });
      D.furnish(map); G.sfx('furniture_place');
      if (!G.Inv.has(D.sel)) D.sel = null;
      D.tray();
      return;
    }
    // pick up what's under the cursor (pictures on the wall first, rugs last)
    const at = st().items.filter((it) => cells(it.id, it.x, it.y).some(([cx, cy]) => cx === t[0] && cy === t[1]));
    at.sort((a, b) => (info(a.id).flat ? 1 : 0) - (info(b.id).flat ? 1 : 0));
    const it = at[0];
    if (!it) return;
    if (isBed(it.id) && st().items.filter((x) => isBed(x.id)).length === 1) { G.UI.toastOnce('bed', 'You need somewhere to sleep. Place another bed first.'); G.sfx('error', { volume: 0.5 }); return; }
    if (!G.Inv.canAdd(it.id, 1)) { G.UI.toast('Your satchel is full.'); return; }
    st().items.splice(st().items.indexOf(it), 1);
    G.Inv.add(it.id, 1); D.sel = it.id;
    D.furnish(map); G.sfx('furniture_pickup'); D.tray();
  };
  // ghost of the piece you're about to place
  D.drawGround = function (ctx, ox, oy) {
    if (!D.active || !D.hover) return;
    const map = G.World.map, t = D.hover;
    if (D.sel) {
      const f = info(D.sel), x = t[0] - Math.floor((f.w - 1) / 2), y = f.wall ? map.wallRows - 1 : t[1] - (f.h - 1), ok = D.canPlace(D.sel, x, y);
      let c = null; try { c = FA().sprite(D.sel); } catch (e) { c = null; }
      if (c) { ctx.globalAlpha = 0.6; ctx.drawImage(c, x * 16 + ox, (y + f.h) * 16 - c.height + oy); ctx.globalAlpha = 1; }
      ctx.fillStyle = ok ? 'rgba(120,255,180,0.35)' : 'rgba(255,110,130,0.4)';
      for (const [cx, cy] of cells(D.sel, x, y)) ctx.fillRect(cx * 16 + ox, cy * 16 + oy, 16, 16);
    } else {
      ctx.strokeStyle = 'rgba(242,196,90,0.9)'; ctx.lineWidth = 1;
      ctx.strokeRect(t[0] * 16 + ox + 0.5, t[1] * 16 + oy + 0.5, 15, 15);
    }
  };
  // the tray of furniture in your satchel
  D.tray = function () {
    let el = document.querySelector('.decor-tray');
    if (!D.active) { if (el) el.remove(); G.UI.showHud(true); return; }
    if (!el) { el = G.UI.el('div', 'panel decor-tray'); G.UI.root.appendChild(el); }
    const have = [...new Set(G.S.inv.filter((s) => s && G.item(s.id).cat === 'furniture').map((s) => s.id))];
    el.innerHTML = `<div class="dt-head"><b>Decorating</b><span class="muted small">Click a piece below, then click the room to place it. Click placed furniture to pick it up. Right-click or Esc when you're done.</span><button class="btn ghost dt-done">Done</button></div>`;
    const row = G.UI.el('div', 'dt-row');
    if (!have.length) row.appendChild(G.UI.el('div', 'small muted', 'No furniture in your satchel. Isolde, Brann, Mirabel, Orvyn and Fennick sell pieces for the cottage.'));
    for (const id of have) {
      const s = G.UI.slotEl({ id, n: G.Inv.count(id) }, { onClick: () => { D.sel = D.sel === id ? null : id; D.tray(); } });
      if (D.sel === id) s.classList.add('sel');
      row.appendChild(s);
    }
    el.appendChild(row);
    el.querySelector('.dt-done').onclick = () => D.toggle();
  };
})();
