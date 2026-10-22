// Nightvale — UI core: HUD, toasts, banner, fades, dialogue, confirm, modal stack, slots & tooltips.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const UI = (G.UI = { panels: {}, stack: [], closedAt: 0 });
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  UI.el = el;

  // ---------------------------------------------------------------- icons & portraits
  const urlCache = new Map();
  UI.iconURL = function (id) {
    let u = urlCache.get(id);
    if (!u) { const c = G.icon(id); u = c.toDataURL(); urlCache.set(id, u); }
    return u;
  };
  UI.clearIconCache = () => urlCache.clear();
  UI.drawPortrait = function (cv, npc, expr, opts) {
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    let src = null;
    try {
      if (window.CharArt) {
        if (npc === 'player' && CharArt.playerPortrait) src = CharArt.playerPortrait(G.S.look, expr || 'neutral', opts || {});
        else if (CharArt.portrait) src = CharArt.portrait(npc, expr || 'neutral', opts || {});
      }
    } catch (e) { src = null; }
    if (src) { ctx.drawImage(src, 0, 0, cv.width, cv.height); return; }
    // fallback: draw the walking sprite large
    const spr = npc === 'player' ? G.playerSprites(G.S.look) : G.npcSprites(npc);
    const f = spr.walk.down[0];
    ctx.drawImage(f, 0, 0, f.width, f.height * 0.62, cv.width * 0.12, cv.height * 0.05, cv.width * 0.76, cv.height * 0.95);
  };
  UI.npcName = (id) => { const t = UI.npcText(id); return (t && (t.short || t.name)) || U.cap(id); };
  UI.npcText = (id) => (window.GAMETEXT && GAMETEXT.npcs && GAMETEXT.npcs[id]) || null;
  UI.fill = function (s, extra) {
    return String(s).replace(/\{player\}/g, G.S ? G.S.name : 'friend').replace(/\{cat\}/g, 'Inkwell').replace(/\{item\}/g, (extra && extra.item) || 'that');
  };

  // ---------------------------------------------------------------- init / HUD
  UI.init = function () {
    const root = $('#ui');
    root.innerHTML = '';
    const hud = el('div'); hud.id = 'hud'; hud.className = 'hidden';
    hud.innerHTML = `
      <div class="panel clock"><canvas class="moon" width="16" height="16"></canvas><div class="date"></div><div class="time"><span></span><img class="wx" alt=""></div><div class="gold"></div></div>
      <div class="buffs"></div>
      <div class="panel tracker"><div class="lbl">Next</div><div class="obj"></div><div class="sub"></div></div>
      <div class="panel bars"><div class="bar hp"><span>HP</span><div class="track"><div class="fill"></div></div></div><div class="bar en"><span>EN</span><div class="track"><div class="fill"></div></div></div><div class="bar mp" hidden><span>MP</span><div class="track"><div class="fill"></div></div></div></div>
      <button class="btn decor-btn hit" hidden>Decorate <span class="key">G</span></button>
      <div class="panel spell hit" hidden title="Q casts · Tab or click switches"><img alt=""><div><div class="sn"></div><div class="sc"></div></div></div>
      <div class="panel hotbar"></div>
      <div class="hint" hidden></div>
      <div class="panel tut" hidden><div class="lbl">First day</div><div class="tt"></div><button class="btn ghost tskip hit">Skip tutorial</button></div>
      <div class="toasts"></div>`;
    root.appendChild(hud);
    const fade = el('div'); fade.id = 'fade'; root.appendChild(fade);
    UI.root = root; UI.hud = hud; UI.fadeEl = fade;
    UI.tip = el('div', 'tooltip'); UI.tip.hidden = true; document.body.appendChild(UI.tip);
    UI.heldEl = el('img', 'held-cursor'); UI.heldEl.hidden = true; document.body.appendChild(UI.heldEl);
    const hb = $('.hotbar', hud);
    UI.hotSlots = [];
    for (let i = 0; i < 12; i++) {
      const s = el('div', 'slot');
      s.innerHTML = `<span class="k">${i < 9 ? i + 1 : i === 9 ? 0 : i === 10 ? '-' : '='}</span>`;
      s.addEventListener('click', () => { if (G.S) { G.S.sel = i; G.sfx('ui_click', { volume: 0.4 }); } });
      s.addEventListener('mouseenter', () => { const st = G.S && G.S.inv[i]; if (st) UI.showTip(st.id, s); });
      s.addEventListener('mouseleave', UI.hideTip);
      hb.appendChild(s); UI.hotSlots.push(s);
    }
    document.addEventListener('mousemove', (e) => { UI.mx = e.clientX; UI.my = e.clientY; if (!UI.heldEl.hidden) { UI.heldEl.style.left = e.clientX - 20 + 'px'; UI.heldEl.style.top = e.clientY - 20 + 'px'; } });
    G.on('keydown', UI.onKey);
    G.on('inv', () => (UI._hotSig = ''));
    $('.tut .tskip', hud).addEventListener('click', () => G.Tutorial && G.Tutorial.skip());
    $('.spell', hud).addEventListener('click', () => { if (G.Main.mode === 'play' && !UI.isModal()) G.Magic.cycle(); });
    $('.decor-btn', hud).addEventListener('click', () => { if (!UI.isModal()) G.Decor.toggle(); });
    const tr = $('.tracker', hud);
    tr.classList.add('hit'); tr.title = 'Open the Field Guide (H)';
    tr.addEventListener('click', () => { if (G.Main.mode === 'play' && !UI.isModal()) UI.open('guide'); });
  };
  UI.showHud = (on) => UI.hud.classList.toggle('hidden', !on);

  const moonCache = {};
  function moonIcon(phase) {
    if (moonCache[phase]) return moonCache[phase];
    const P = new G.Pix(16, 16);
    // phase 0..7 ; 4 = full
    const lit = phase === 0 ? 0 : phase === 4 ? 1 : phase < 4 ? phase / 4 : (8 - phase) / 4;
    const waxing = phase > 0 && phase < 4;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = (x - 7.5) / 7, dy = (y - 7.5) / 7;
      if (dx * dx + dy * dy > 1) continue;
      const half = Math.sqrt(Math.max(0, 1 - dy * dy));
      const term = half * (1 - 2 * lit);
      const isLit = phase === 4 ? true : phase === 0 ? false : waxing ? dx > term : -dx > term;
      const c = isLit ? (dx + dy < -0.6 ? '#ffffff' : U.hash(x, y, 3) < 0.15 ? '#c8d4f0' : '#e8eeff') : '#2a2148';
      P.set(x, y, c);
    }
    P.outline('#120c1c');
    moonCache[phase] = P.canvas();
    return moonCache[phase];
  }
  UI.moonIcon = moonIcon;
  const wxCache = {};
  function weatherIcon(w) {
    if (wxCache[w]) return wxCache[w];
    const P = new G.Pix(16, 16);
    if (w === 'rain') { P.disc(8, 6, 6, 3, '#9fb0d8'); P.disc(6, 5, 3, 2, '#c8d4f0'); for (const [x, y] of [[4, 11], [8, 12], [12, 11], [6, 14], [10, 15]]) { P.set(x, y, '#69a1db'); P.set(x - 1, y + 1, '#69a1db'); } }
    else if (w === 'mist') { for (let k = 0; k < 4; k++) P.hline(2 + (k % 2) * 2, 13 - (k % 2), 3 + k * 3, k % 2 ? '#b1a4cf' : '#e4d2ff'); }
    else if (w === 'starfall') { P.line(2, 3, 9, 10, '#b99aee'); P.set(10, 11, '#ffffff'); for (const [x, y] of [[11, 10], [10, 12], [12, 11], [11, 12]]) P.set(x, y, '#f2c45a'); P.set(13, 3, '#fff1c8'); P.set(4, 13, '#fff1c8'); }
    else if (w === 'clear') { P.disc(6, 6, 4, 4, '#f2c45a'); P.disc(5, 5, 2, 2, '#fff1c8'); for (const [x, y] of [[6, 0], [0, 6], [1, 1], [11, 1], [1, 11]]) P.set(x, y, '#ffbc62'); P.disc(10, 11, 4, 2, '#cfc6e8'); P.disc(8, 10, 2, 2, '#ece6fa'); P.disc(12, 10, 2, 2, '#ece6fa'); }
    else { P.disc(8, 8, 4, 4, '#f2c45a'); P.disc(7, 7, 2, 2, '#fff1c8'); for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [13, 3], [3, 13], [13, 13]]) P.set(x, y, '#ffbc62'); }
    P.outline('#120c1c');
    wxCache[w] = P.canvas().toDataURL();
    return wxCache[w];
  }

  UI.update = function (dt) {
    const S = G.S; if (!S || UI.hud.classList.contains('hidden')) return;
    const h = UI.hud;
    const dateStr = `${G.weekday()} · Day ${S.day}`;
    if (h._date !== dateStr) { $('.date', h).textContent = dateStr; h._date = dateStr; }
    const tStr = U.fmtTime(S.mins);
    if (h._time !== tStr) { $('.time span', h).textContent = tStr; h._time = tStr; }
    const wx = G.World.map && G.World.map.id === 'depths' ? 'depths' : G.World.weather;
    if (h._wx !== wx) { const img = $('.wx', h); if (wx === 'depths') img.hidden = true; else { img.hidden = false; img.src = weatherIcon(wx); img.alt = wx; } h._wx = wx; }
    const ph = G.moonPhase();
    if (h._moon !== ph) { const cv = $('.moon', h); const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, 16, 16); c.drawImage(moonIcon(ph), 0, 0); cv.title = G.MOON[ph]; h._moon = ph; }
    const gStr = U.fmtNum(S.gold) + ' ✦';
    if (h._gold !== gStr) { $('.gold', h).textContent = gStr; h._gold = gStr; }
    $('.bar.hp .fill', h).style.width = (100 * S.hp) / S.maxHp + '%';
    $('.bar.en .fill', h).style.width = (100 * S.energy) / S.maxEnergy + '%';
    const showHp = G.World.map && (G.World.map.id === 'depths' || S.hp < S.maxHp);
    $('.bar.hp', h).style.display = showHp ? '' : 'none';
    // mana & the chosen spell
    const mg = S.magic;
    const ssig = mg && mg.book ? mg.spells.join() + mg.sel + '|' + Math.floor(mg.mana) + UI._spellSig : '';
    if (h._spell !== ssig) {
      h._spell = ssig; UI._spellSig = '';
      $('.bar.mp', h).hidden = !(mg && mg.book); $('.spell', h).hidden = !(mg && mg.book && mg.spells.length);
      if (mg && mg.book) {
        $('.bar.mp .fill', h).style.width = (100 * mg.mana) / mg.max + '%';
        const k = G.Magic.current();
        if (k) { const sp = G.Magic.SPELLS[k]; $('.spell img', h).src = UI.iconURL(sp.icon); $('.spell .sn', h).textContent = sp.name; $('.spell .sc', h).innerHTML = `<span class="key">Q</span> ${sp.cost} mana`; $('.spell', h).classList.toggle('low', mg.mana < sp.cost); }
      }
    }
    // buffs
    const bsig = G.Stats.hudSig() + UI._buffSig;
    if (h._buffs !== bsig) {
      h._buffs = bsig; UI._buffSig = '';
      $('.buffs', h).innerHTML = G.Stats.hud().map((b) => `<span class="buff" title="${b.tip}">${b.icon ? `<img src="${UI.iconURL(b.icon)}" alt="">` : ''}<span class="bn">${b.name}</span><span class="bt">${b.left}</span></span>`).join('');
    }
    // hotbar
    const sig = S.sel + '|' + S.water + '|' + S.inv.slice(0, 12).map((s) => (s ? s.id + ':' + s.n : '-')).join(',') + (UI.held ? '|h' : '');
    if (UI._hotSig !== sig) {
      UI._hotSig = sig;
      UI.hotSlots.forEach((s, i) => {
        const st = S.inv[i];
        s.classList.toggle('sel', i === S.sel);
        const k = s.querySelector('.k').outerHTML;
        s.innerHTML = k + (st ? `<img src="${UI.iconURL(st.id)}" alt="">` + (st.n > 1 ? `<span class="n">${st.n}</span>` : '') + (st.id === 'can' ? `<span class="wbar"><i style="width:${(100 * S.water) / (40 + S.toolTier.can * 20)}%"></i></span>` : '') : '');
      });
    }
    // objective tracker
    const obj = G.Quests ? G.Quests.current() : null;
    const tutOn = !!(G.Tutorial && G.Tutorial.active());
    const osig = (obj ? obj.text + obj.sub : '') + (tutOn ? '|tut' : '');
    if (h._obj !== osig) {
      // the previous objective was completed: celebrate it briefly
      if (h._objText && obj && h._objText !== obj.text && !tutOn) { UI.toast('✓ ' + h._objText); G.sfx('quest_complete', { volume: 0.6 }); }
      h._obj = osig; h._objText = obj ? obj.text : '';
      $('.tracker', h).hidden = !obj || tutOn;
      if (obj) { $('.obj', h).textContent = obj.text; $('.sub', h).textContent = obj.sub || ''; }
    }
    const showDecor = !!(G.World.map && G.World.map.id === 'cottage' && !G.Decor.active);
    if (h._decor !== showDecor) { h._decor = showDecor; $('.decor-btn', h).hidden = !showDecor; }
    // first-day tutorial card
    const ts = G.Tutorial && G.Tutorial.current();
    const tsig = ts ? ts.id + ts.text() : '';
    if (h._tut !== tsig) {
      h._tut = tsig;
      const card = $('.tut', h); card.hidden = !ts;
      if (ts) $('.tt', card).innerHTML = ts.text();
    }
    // context hint
    const hint = UI.contextHint();
    if (h._hint !== hint) { h._hint = hint; const he = $('.hint', h); he.hidden = !hint; he.innerHTML = hint || ''; }
  };

  UI.contextHint = function () {
    const W = G.World;
    if (!W.player || W.inputLocked() || !W.map) return '';
    const [tx, ty] = W.player.facingTile();
    const map = W.map;
    const npc = G.NPCs.at(map, tx, ty, null, null, W.player);
    if (npc) return `<span class="key">E</span> Talk to <b>${UI.npcName(npc.id)}</b>`;
    const o = map.obj(tx, ty);
    if (o) {
      if (o.kind === 'forage') return `<span class="key">E</span> Pick up <b>${G.item(o.id).name}</b>`;
      if (o.kind === 'cauldron') return `<span class="key">E</span> ${o.state === 'done' ? 'Collect potion' : o.state === 'brewing' ? 'Check the cauldron' : 'Brew'}`;
      if (o.kind === 'chest') return '<span class="key">E</span> Open chest';
      if (o.kind === 'offering') return '<span class="key">E</span> Moon offering box <span class="muted">(sells overnight)</span>';
      if (o.kind === 'ladder') return `<span class="key">E</span> ${o.up ? 'Climb up' : 'Descend'}`;
      if (o.kind === 'gate') return '<span class="key">E</span> Rune Gate';
    }
    const dr = W.doorAt && W.doorAt(map, tx, ty);
    if (dr) return `<span class="key">E</span> Enter <b>${dr.name || 'inside'}</b>`;
    const f = map.farm.get(map.idx(tx, ty));
    if (f && f.crop && G.Farm.ripe(f.crop)) return `<span class="key">E</span> Harvest <b>${G.item(G.CROPS[f.crop.id].item).name}</b>`;
    if (f && f.crop) {
      const def = G.CROPS[f.crop.id], left = Math.max(1, Math.ceil((f.crop.regrowing ? def.regrow : def.days) - f.crop.days));
      return `<b>${G.item(def.item).name}</b> · ${left} more watered night${left === 1 ? '' : 's'} · ${f.watered ? '<span class="ok">watered today</span>' : '<span class="warn">needs water today</span>'}`;
    }
    const p = map.propAt.get(map.idx(tx, ty));
    if (p && p.interact) {
      const it = p.interact;
      if (it.kind === 'shop') return `<span class="key">E</span> Enter <b>${it.name}</b>`;
      if (it.kind === 'bed') return '<span class="key">E</span> Go to bed';
      if (it.kind === 'altar') return '<span class="key">E</span> The Moon Altar';
      if (it.kind === 'board') return '<span class="key">E</span> Notice board';
      if (it.kind === 'depths') return '<span class="key">E</span> Enter the Umbral Depths';
      return '<span class="key">E</span> Examine';
    }
    if (map.examine.get(map.idx(tx, ty))) return '<span class="key">E</span> Examine';
    if (G.Cat && G.Cat.at(map, tx, ty)) return '<span class="key">E</span> Pet Inkwell';
    return '';
  };

  // ---------------------------------------------------------------- toasts / banner / fade
  UI.toast = function (text, iconId) {
    const box = $('.toasts', UI.hud);
    const t = el('div', 'toast', (iconId ? `<img src="${UI.iconURL(iconId)}" alt="">` : '') + `<span>${text}</span>`);
    box.appendChild(t);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3200);
  };
  const onceT = {};
  UI.toastOnce = function (key, text, secs) {
    const now = performance.now();
    if (onceT[key] && now - onceT[key] < (secs || 5) * 1000) return;
    onceT[key] = now; UI.toast(text);
  };
  const itemToasts = {};
  UI.toastItem = function (id, n) {
    const now = performance.now();
    const ex = itemToasts[id];
    if (ex && now - ex.t < 2500 && ex.el.isConnected) {
      ex.n += n; ex.t = now; ex.el.querySelector('span').textContent = `+${ex.n} ${G.item(id).name}`;
      return;
    }
    UI.toast(`+${n} ${G.item(id).name}`, id);
    const box = $('.toasts', UI.hud);
    itemToasts[id] = { n, t: now, el: box.lastChild };
  };
  UI.banner = function (title, sub) {
    const old = $('.banner', UI.root); if (old) old.remove();
    const b = el('div', 'banner', `<div class="t">${title}</div>${sub ? `<div class="s">${sub}</div>` : ''}`);
    UI.root.appendChild(b);
    setTimeout(() => b.remove(), 3700);
  };
  // fades are advanced by the main loop so they also work when stepping frames by hand
  UI.fadeTo = function (target, secs) {
    if (UI.fadeJob) UI.fadeJob.res();
    return new Promise((res) => { UI.fadeJob = { from: G.R.fade, to: target, t: 0, dur: Math.max(0.01, secs), res }; });
  };
  UI.tickFade = function (dt) {
    const j = UI.fadeJob; if (!j) return;
    j.t += dt;
    const k = Math.min(1, j.t / j.dur);
    G.R.fade = j.from + (j.to - j.from) * k;
    if (k >= 1) { UI.fadeJob = null; j.res(); }
  };
  UI.newDayToast = function () {
    const S = G.S;
    const misc = window.GAMETEXT && GAMETEXT.misc && GAMETEXT.misc.newDay;
    let line = '';
    if (misc) {
      if (G.isFullMoon()) line = misc.full; else if (G.isNewMoon()) line = misc.new;
      else if (S.weather !== 'clear') line = misc[S.weather] || (S.weather === 'sunny' ? 'A bright, sunny morning. The bees are up early.' : '');
    }
    UI.banner(`Day ${S.day}`, `${G.weekday()} · ${G.MOON[G.moonPhase()]}`);
    if (line) setTimeout(() => UI.toast(UI.fill(line)), 1200);
  };

  // boss health bar (top of screen)
  UI.bossBar = function (m, title) {
    let b = document.getElementById('bossbar');
    if (!m) { if (b) b.remove(); if (UI._bossRaf) cancelAnimationFrame(UI._bossRaf); UI._bossOf = null; return; }
    if (b && UI._bossOf !== m) { b.remove(); b = null; }
    UI._bossOf = m;
    if (!b) {
      b = el('div', 'panel'); b.id = 'bossbar';
      b.style.cssText = 'position:absolute;left:50%;top:max(16px,env(safe-area-inset-top));transform:translateX(-50%);width:min(560px,70vw);padding:8px 14px 10px;text-align:center';
      b.innerHTML = `<div style="font-family:var(--display);font-weight:700;font-size:22px;line-height:1.1;color:#f7efff">${title || 'Vesper, the Umbral Archon'}</div><div class="track" style="height:12px;margin-top:6px;background:#0e0919;border:2px solid #120c1c;border-radius:4px;overflow:hidden"><div class="fill" style="height:100%;width:100%;background:linear-gradient(180deg,#d8b8ff,#8f6cd1)"></div></div>`;
      UI.root.appendChild(b);
    }
    const fill = b.querySelector('.fill');
    const upd = () => { if (!b.isConnected) return; fill.style.width = Math.max(0, (100 * m.hp) / m.maxHp) + '%'; UI._bossRaf = requestAnimationFrame(upd); };
    upd();
  };

  // ---------------------------------------------------------------- modal stack
  UI.isModal = () => UI.stack.length > 0;
  function pushModal(m) { UI.stack.push(m); if (window.AudioEngine) try { AudioEngine.setPaused(true); } catch (e) { /* optional */ } }
  function popModal(m) {
    const i = UI.stack.indexOf(m); if (i >= 0) UI.stack.splice(i, 1);
    UI.closedAt = performance.now();
    G.Input.pressed.clear(); G.Input.mouse.pressed = [false, false, false];
    if (!UI.stack.length && window.AudioEngine) try { AudioEngine.setPaused(false); } catch (e) { /* optional */ }
  }
  UI.closeAll = function () { for (const m of UI.stack.slice().reverse()) m.close(); };

  UI.onKey = function (code) {
    const top = UI.stack[UI.stack.length - 1];
    if (!top) return;
    if (top.onKey) top.onKey(code);
  };

  // generic modal panel: build(body, ctx) where ctx = {close, rerender}
  UI.open = function (name, data) {
    const builder = UI.panels[name];
    if (!builder) { console.warn('no panel', name); return Promise.resolve(); }
    return new Promise((resolve) => {
      const bg = el('div', 'modal-bg');
      const m = { name, bg, data: data || {}, resolve };
      const panel = el('div', 'panel modal');
      bg.appendChild(panel);
      const close = (val) => {
        if (m.closed) return; m.closed = true;
        if (m.onClose) m.onClose();
        UI.dropHeld();
        UI.hideTip();
        bg.remove(); popModal(m); G.sfx('menu_close', { volume: 0.5 }); resolve(val);
      };
      m.close = close;
      m.rerender = () => { panel.innerHTML = ''; builder(panel, m); };
      m.onKey = (code) => {
        if (code === 'Escape' || (m.closeKeys && m.closeKeys.includes(code))) close();
        else if (m.keys && m.keys[code]) m.keys[code]();
      };
      bg.addEventListener('mousedown', (e) => { if (e.target === bg && !m.noBgClose) close(); });
      builder(panel, m);
      UI.root.appendChild(bg);
      pushModal(m);
      G.sfx('menu_open', { volume: 0.5 });
    });
  };
  UI.closeBtn = function (m) { const b = el('button', 'btn ghost x-close', '✕'); b.setAttribute('aria-label', 'Close'); b.onclick = () => m.close(); return b; };

  // ---------------------------------------------------------------- dialogue
  // pages: array of strings (may start with [expr]); opts: {choices:[{label,value}], name, item, voice}
  UI.say = function (npc, pages, opts) {
    opts = opts || {};
    pages = (Array.isArray(pages) ? pages : [pages]).filter((p) => p != null && p !== '').map((p) => UI.fill(p, opts));
    if (!pages.length) pages = ['...'];
    return new Promise((resolve) => {
      const wrap = el('div', 'dlg-wrap');
      const box = el('div', 'panel dlg hit');
      const nameStr = opts.name || (npc ? UI.npcName(npc) : null);
      box.innerHTML = (nameStr ? `<div class="name">${nameStr}</div>` : '') + '<div class="txt"></div><div class="choices"></div><div class="more">▼</div>';
      wrap.appendChild(box);
      let pcv = null, hearts = null;
      if (npc) {
        const pf = el('div', 'panel portrait');
        pcv = el('canvas'); pcv.width = 192; pcv.height = 192;
        pf.appendChild(pcv);
        if (npc !== 'player' && G.NPCs.hearts) { hearts = el('div', 'hearts', G.NPCs.heartString(npc)); pf.appendChild(hearts); }
        wrap.appendChild(pf);
      }
      UI.root.appendChild(wrap);
      const txt = $('.txt', box), more = $('.more', box), choicesEl = $('.choices', box);
      const voice = opts.voice || (npc && G.NPCs.voice ? G.NPCs.voice(npc) : null);
      let pi = 0, shown = 0, full = '', expr = 'neutral', typing = false, raf = 0, last = 0, blinkT = 2 + Math.random() * 2, blink = 0, talkT = 0, talk = false, done = false;
      const m = { name: 'dialogue', close: () => finish(undefined) };
      const drawP = () => { if (pcv) UI.drawPortrait(pcv, npc, expr, { blink: blink > 0, talk }); };
      const setPage = () => {
        let p = pages[pi];
        const mm = /^\s*\[(neutral|happy|sad|surprised|angry)\]\s*/i.exec(p);
        expr = mm ? mm[1].toLowerCase() : 'neutral';
        full = mm ? p.slice(mm[0].length) : p;
        shown = 0; typing = true; txt.textContent = ''; more.style.visibility = 'hidden'; choicesEl.innerHTML = '';
        drawP();
      };
      const showChoices = () => {
        if (pi === pages.length - 1 && opts.choices && opts.choices.length) {
          more.style.visibility = 'hidden';
          choicesEl.innerHTML = '';
          opts.choices.forEach((c, k) => {
            const b = el('button', 'btn' + (k === 0 ? ' gold' : ''), `${k + 1}. ${c.label}`);
            b.onclick = (e) => { e.stopPropagation(); finish(c.value); };
            choicesEl.appendChild(b);
          });
        } else more.style.visibility = 'visible';
      };
      const tick = (t) => {
        const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
        if (typing) {
          const before = Math.floor(shown);
          shown += dt * 52;
          const n = Math.min(full.length, Math.floor(shown));
          if (n !== before) {
            txt.textContent = full.slice(0, n);
            if (voice && n % 2 === 0 && /\w/.test(full[n - 1] || '')) try { window.AudioEngine && AudioEngine.blip(voice); } catch (e) { /* optional */ }
          }
          if (n >= full.length) { typing = false; talk = false; drawP(); showChoices(); }
          talkT += dt; if (talkT > 0.11) { talkT = 0; talk = !talk && typing; drawP(); }
        }
        blinkT -= dt;
        if (blinkT <= 0 && blink <= 0) { blink = 0.13; drawP(); }
        if (blink > 0) { blink -= dt; if (blink <= 0) { blinkT = 2.5 + Math.random() * 3; drawP(); } }
        if (!done) raf = requestAnimationFrame(tick);
      };
      const advance = () => {
        if (done) return;
        if (typing) { typing = false; shown = full.length; txt.textContent = full; talk = false; drawP(); showChoices(); return; }
        if (pi === pages.length - 1 && opts.choices && opts.choices.length) return;
        if (pi < pages.length - 1) { pi++; setPage(); G.sfx('ui_click', { volume: 0.25 }); }
        else finish(undefined);
      };
      const finish = (val) => {
        if (done) return; done = true;
        cancelAnimationFrame(raf);
        wrap.remove(); popModal(m); resolve(val);
      };
      m.onKey = (code) => {
        if (['KeyE', 'Space', 'Enter', 'KeyX', 'KeyF'].includes(code)) advance();
        else if (code === 'Escape' && !(opts.choices && opts.choices.length)) finish(undefined);
        else if (/^Digit[1-9]$/.test(code) && opts.choices && !typing && pi === pages.length - 1) { const k = +code.slice(5) - 1; if (opts.choices[k]) finish(opts.choices[k].value); }
      };
      box.addEventListener('mousedown', (e) => { if (e.button === 0) advance(); });
      pushModal(m);
      setPage();
      raf = requestAnimationFrame(tick);
    });
  };
  UI.flavor = function (key) {
    const f = window.GAMETEXT && GAMETEXT.flavor && GAMETEXT.flavor[key];
    const fallback = {
      house_locked: "The door is locked. Someone's supper smells wonderful.", sanctum_bed: 'The keeper\'s cottage. The door is just there, a little crooked, always unlocked for you.',
      ridge_chapel: ['The little chapel is locked. Through the keyhole: rows of candles, still burning for the dead.', 'A brass plate reads: "Kept by the Silver Veil. Ask Seraphine for the key."'],
      glassworks: ["Seraphine's glassworks. Coloured shards are stacked against the wall like sweets, and the kiln ticks as it cools."],
    };
    return UI.say(null, f || fallback[key] || 'Nothing remarkable... or is there?');
  };
  UI.confirm = function (text, yes, no) {
    return UI.say(null, [text], { choices: [{ label: yes || 'Yes', value: true }, { label: no || 'No', value: false }] }).then((v) => !!v);
  };

  // ---------------------------------------------------------------- slots, held stack, tooltips
  UI.held = null; // {id, n}
  UI.setHeld = function (st) {
    UI.held = st;
    if (st) { UI.heldEl.src = UI.iconURL(st.id); UI.heldEl.hidden = false; UI.heldEl.style.left = (UI.mx || 0) - 20 + 'px'; UI.heldEl.style.top = (UI.my || 0) - 20 + 'px'; }
    else UI.heldEl.hidden = true;
    UI._hotSig = '';
  };
  UI.dropHeld = function () { if (UI.held) { const left = G.Inv.add(UI.held.id, UI.held.n); if (left > 0) G.dropItem(G.World.map, UI.held.id, left, G.World.player.x, G.World.player.y - 4, { delay: 2 }); UI.setHeld(null); } };
  UI.slotEl = function (st, opts) {
    opts = opts || {};
    const s = el('div', 'slot' + (opts.cls ? ' ' + opts.cls : ''));
    if (st) s.innerHTML = `<img src="${UI.iconURL(st.id)}" alt="${G.item(st.id).name}">` + (st.n > 1 ? `<span class="n">${st.n}</span>` : '');
    if (opts.key) s.innerHTML += `<span class="k">${opts.key}</span>`;
    if (st) { s.addEventListener('mouseenter', () => { UI.showTip(st.id, s, opts.price); if (opts.onHover) opts.onHover(st); }); s.addEventListener('mouseleave', UI.hideTip); }
    if (opts.onClick) s.addEventListener('mousedown', (e) => { e.preventDefault(); UI.hideTip(); opts.onClick(e); });
    s.addEventListener('contextmenu', (e) => e.preventDefault());
    return s;
  };
  UI.itemDesc = function (id) {
    const t = window.GAMETEXT && GAMETEXT.items && GAMETEXT.items[id];
    if (t) return t;
    const it = G.item(id);
    if (it.seed) return `Plant in tilled soil and water daily. Grows into ${G.item(G.CROPS[it.seed].item).name} in ${G.CROPS[it.seed].days} days.`;
    if (it.scroll) return 'Read it to learn a new potion recipe.';
    return '';
  };
  UI.showTip = function (id, anchor, priceOverride) {
    const it = G.item(id), t = UI.tip;
    const cats = { tool: 'Tool', weapon: 'Weapon', seed: 'Seeds', crop: 'Crop', forage: 'Forage', resource: 'Resource', ore: 'Ore', gem: 'Gem', loot: 'Monster loot', fish: 'Fish', potion: 'Potion', food: it.drink ? 'Drink' : 'Food', place: 'Placeable', misc: 'Curio', clothing: 'Clothing · ' + ({ hat: 'hat', cloak: 'cloak', outfit: 'outfit' }[it.wear] || ''), relic: 'Relic', furniture: 'Furniture' };
    const meta = [];
    if (it.weapon) meta.push(`${it.weapon.min}–${it.weapon.max} damage${it.weapon.kind === 'wand' ? ` · ${it.weapon.cost} energy per bolt` : ''}`);
    const e = it.eat || it.use;
    if (e) meta.push([e.hp > 0 ? `+${e.hp >= 999 ? 'full' : e.hp} health` : '', e.energy > 0 ? `+${e.energy >= 999 ? 'full' : e.energy} energy` : '', e.maxhp ? `+${e.maxhp} max health (permanent)` : '', e.mana ? `+${e.mana} mana` : ''].filter(Boolean).join(' · '));
    const sb = e && (typeof e.buff === 'object' && e.buff ? e.buff : e.stat);
    if (sb) meta.push(`<span class="em">${G.Stats.describe(sb)}</span> ${e.until ? 'until ' + U.fmtTime(e.until) : 'for ' + G.Stats.fmtSecs(e.secs)}`);
    if (it.wear) meta.push(G.S && G.S.look[it.wear] === id ? 'You are wearing this.' : 'Use it (E) to wear it.');
    if (id === 'treasure_map' && G.Encounters) meta.push(`<span class="em">${G.Encounters.treasureHint()}</span>`);
    if (it.tool && G.S && G.S.toolTier[it.tool] != null) { const tn = ['Basic', 'Glimmer', 'Shadowiron', 'Starsilver'][G.S.toolTier[it.tool]]; meta.push(tn + ' tier'); }
    const price = priceOverride != null ? priceOverride : it.sell ? `Sells for ${U.fmtNum(it.sell)} ✦` : '';
    if (price) meta.push(price);
    t.innerHTML = `<div class="tt-name">${it.name}</div><div class="tt-cat">${cats[it.cat] || it.cat}</div><div class="tt-desc">${UI.itemDesc(id)}</div>${meta.filter(Boolean).length ? `<div class="tt-meta">${meta.filter(Boolean).join('<br>')}</div>` : ''}`;
    t.hidden = false;
    const r = anchor.getBoundingClientRect();
    const tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    x = U.clamp(x, 8, window.innerWidth - tw - 8);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  };
  UI.hideTip = () => { UI.tip.hidden = true; };

  // inventory grid with pick/place/swap semantics (arr: array of stacks)
  UI.invGrid = function (arr, opts) {
    opts = opts || {};
    const grid = el('div', 'grid r');
    const from = opts.from || 0, to = opts.to || arr.length;
    for (let i = from; i < to; i++) {
      const st = arr[i];
      const s = UI.slotEl(st, {
        cls: (opts.selIndex === i ? 'sel' : '') + (st && opts.dimIf && opts.dimIf(st) ? ' dim' : ''),
        onHover: opts.onHover,
        key: opts.keys ? (i < 9 ? i + 1 : i === 9 ? 0 : i === 10 ? '-' : i === 11 ? '=' : '') : '',
        onClick: (e) => {
          if (opts.onSlot && opts.onSlot(i, e) === true) return;
          // default pick/place/swap
          const held = UI.held;
          if (e.shiftKey && st && opts.quickMove) { opts.quickMove(i); return; }
          if (!held && st) {
            if (e.button === 2 && st.n > 1) { const half = Math.ceil(st.n / 2); st.n -= half; UI.setHeld({ id: st.id, n: half }); }
            else { arr[i] = null; UI.setHeld(st); }
          } else if (held) {
            if (!st) { if (e.button === 2) { arr[i] = { id: held.id, n: 1 }; held.n -= 1; if (held.n <= 0) UI.setHeld(null); } else { arr[i] = held; UI.setHeld(null); } }
            else if (st.id === held.id && G.item(st.id).stack > 1) { const room = G.item(st.id).stack - st.n; const k = Math.min(room, e.button === 2 ? 1 : held.n); st.n += k; held.n -= k; if (held.n <= 0) UI.setHeld(null); }
            else { arr[i] = held; UI.setHeld(st); }
          }
          G.sfx('ui_click', { volume: 0.35 });
          G.emit('inv');
          if (opts.rerender) opts.rerender();
        },
      });
      grid.appendChild(s);
    }
    return grid;
  };
})();
