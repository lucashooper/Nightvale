// Nightvale — Designs (Settings > Designs): switch between the original look of a few things and the alternatives
// drawn for them. Choices live in G.prefs.alts (read with G.alt); faces and creatures change at once, a villager's
// home is rebuilt on the spot and a rare floor's look applies the next time one turns up in the Depths.
(function () {
  'use strict';
  const G = window.G, UI = G.UI, el = UI.el;
  const notes = (key) => (window.ALT_NOTES && ALT_NOTES[key]) || null;

  const LIST = [
    { key: 'portraits', name: 'Portraits', where: 'Faces in conversations', kind: 'portrait' },
    { key: 'horses', name: 'Horses', where: "Caspian's Menagerie · ride with R", kind: 'mount', ids: ['horse_midnight', 'horse_silver', 'horse_chestnut'] },
    { key: 'dragons', name: 'Dragons', where: "Caspian's Menagerie · Silver guild rank", kind: 'mount', ids: ['dragon_amethyst', 'dragon_emerald', 'dragon_ember'] },
    { key: 'gloopgarr', name: 'Gloopgarr the Slime Ogre', where: 'Guild bounty', kind: 'mob', mobs: [['slime_ogre', 0.34], ['slime_med', 0.7], ['slime_small', 0.86]] },
    { key: 'grimjaw', name: 'Old Grimjaw', where: 'Guild bounty', kind: 'mob', mobs: [['grimjaw', 0.5]] },
    { key: 'wyrm', name: 'Vorrakh, the Deep Wyrm', where: 'Guild bounty · floor 20', kind: 'mob', mobs: [['deep_wyrm', 0.5]], cycle: ['idle', 'move', 'attack', 'burrow', 'emerge'] },
    { key: 'home_jasmine', name: "Jasmine's cottage", where: 'Hollowmere', kind: 'home', map: 'jasmine_home' },
    { key: 'home_amara', name: "Amara's study", where: 'Hollowmere', kind: 'home', map: 'amara_home' },
    { key: 'rare_observatory', name: 'The Sunken Observatory', where: 'A rare floor of the Depths', kind: 'rare', rare: 'observatory' },
    { key: 'rare_crystal', name: 'The Crystal Garden', where: 'A rare floor of the Depths', kind: 'rare', rare: 'crystal' },
  ];
  // portrait styles: the classic renderer, then CharArt.portraitStyled styles once they're drawn
  const FACES = [['human', 'Human', 'Softer faces that read as real people'], ['human_hd', 'Human HD', 'The same faces, sharper at higher resolution']];

  // [[value, name, note]] for each look that exists, and the one picked as the default (marked with a star)
  function options(d) {
    const rec = (G.ALT_DEFAULTS && G.ALT_DEFAULTS[d.key]) || 'a';
    if (d.kind === 'portrait') {
      const have = (window.CharArt && CharArt.portraitStyles) || [];
      return { o: [['a', 'Classic', 'The faces from the first version']].concat(FACES.filter((f) => have.includes(f[0]))), rec };
    }
    const n = notes(d.key), o = [['a', 'Original', 'The first design']];
    if (n) for (const v of ['b', 'c']) if (n[v]) o.push([v, n[v].name, n[v].note]);
    return { o, rec };
  }
  function current(d) { const v = G.alt(d.key), o = options(d).o; return o.some((x) => x[0] === v) ? v : 'a'; }

  function set(d, v) {
    const A = G.prefs.alts || (G.prefs.alts = {});
    if (v === 'a') delete A[d.key]; else A[d.key] = v;
    G.Save.saveSettings();
    if (d.kind === 'home') rebuildHome(d.map);
  }
  // swap a villager's home for the chosen design; if you're standing in it, you're back at its door
  function rebuildHome(id) {
    const W = G.World, build = G.Interiors && G.Interiors.homes && G.Interiors.homes[id];
    if (!build || !W.maps || !W.maps[id]) return;
    W.maps[id] = build();
    if (W.map && W.map.id === id) W.changeMap(id, 'door', { instant: true, silent: true });
  }

  // ---------------------------------------------------------------- previews
  const look = () => (G.S && G.S.look) || { skin: 1, hair: 1, hairColor: 4, robe: 0, eyes: 0 };
  function shadow(x, cx, cy, rx, a) { x.globalAlpha = a; x.fillStyle = '#0e0818'; x.beginPath(); x.ellipse(cx, cy, rx, rx * 0.32, 0, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; }
  // one coat at a time, all the way round, on a stage sized for the biggest look so A, B and C keep their true sizes
  function mountSize(d) {
    const infos = [].concat(...options(d).o.map(([v]) => d.ids.map((id) => MobArt.mountInfo(v === 'a' ? id : id + '__' + v))));
    return [Math.max(...infos.map((i) => i.w)) + 12, Math.max(...infos.map((i) => i.ay + 2)) + (d.key === 'dragons' ? 22 : 12)];
  }
  function drawMounts(x, t, d, W, H) {
    const turn = Math.floor(t / 2200), dir = ['down', 'right', 'up', 'left'][turn % 4], id0 = d.ids[Math.floor(turn / 4) % d.ids.length];
    const id = G.altArt(id0), info = MobArt.mountInfo(id), dragon = id0.startsWith('dragon'), ri = CharArt.rideInfo || { ax: 10, ay: 26 };
    const anim = dragon ? 'fly' : 'walk', n = info.anims[anim] || 2, fr = Math.floor((t / 1000) * (info.fps[anim] || 8)) % n;
    const parts = MobArt.mount(id, anim, dir, fr); if (!parts) return;
    const gx = Math.round(W / 2), gy = H - 6, lift = dragon ? 10 : 0;
    shadow(x, gx, gy, info.w * (dragon ? 0.24 : 0.32), dragon ? 0.28 : 0.38);
    const x0 = Math.round(gx - info.ax), y0 = Math.round(gy - info.ay - lift);
    x.drawImage(parts.back, x0, y0);
    const sdy = (info.seatDy[anim] && info.seatDy[anim][fr]) || 0, rider = CharArt.playerRide(look(), dir, fr % 2);
    if (rider) x.drawImage(rider, Math.round(x0 + info.seat.x - ri.ax), Math.round(y0 + info.seat.y + sdy - ri.ay));
    if (parts.front) x.drawImage(parts.front, x0, y0);
  }
  function drawMobs(x, t, d, W, H) {
    const seq = d.cycle || ['idle', 'move', 'attack'], a = seq[Math.floor(t / 1700) % seq.length];
    for (const [type0, fx] of d.mobs) {
      const type = G.altArt(type0), info = MobArt.info(type), anim = info.anims[a] ? a : 'idle';
      const f = Math.floor((t / 1000) * (info.fps[anim] || 6)) % (info.anims[anim] || 1), c = MobArt.frame(type, 'default', anim, f, false);
      if (!c) continue;
      const gx = Math.round(W * fx), gy = H - 8;
      if (type0 !== 'deep_wyrm') shadow(x, gx, gy, Math.max(4, info.w * 0.3), 0.3); // the wyrm brings its own burrow
      x.drawImage(c, Math.round(gx - info.ax), Math.round(gy - info.ay));
    }
  }
  const FACE_CAST = ['laura', 'jasmine', 'amara', 'ronan', 'caspian', 'mirabel', 'brann', 'elowen', 'player'];
  const EXPR = ['happy', 'neutral', 'surprised', 'happy', 'sad', 'neutral', 'happy', 'neutral', 'happy'];
  function drawFace(x, t, d, W, H) {
    const k = Math.floor(t / 2600) % FACE_CAST.length, id = FACE_CAST[k], st = current(d), ph = t % 2600;
    const opts = { blink: ph > 1900 && ph < 2020, talk: ph < 1500 && Math.floor(t / 160) % 2 === 1 };
    let src = null;
    try {
      if (st === 'a') src = id === 'player' ? CharArt.playerPortrait(look(), EXPR[k], opts) : CharArt.portrait(id, EXPR[k], opts);
      else src = id === 'player' ? CharArt.playerPortraitStyled(st, look(), EXPR[k], opts) : CharArt.portraitStyled(st, id, null, EXPR[k], opts);
    } catch (e) { src = null; }
    if (!src) return;
    if (x.canvas.width !== src.width) { x.canvas.width = src.width; x.canvas.height = src.height; x.imageSmoothingEnabled = false; } // 64 or 96 px, shown at 3x or 2x
    x.drawImage(src, 0, 0);
  }
  // a home or rare floor drawn flat (floor, walls, then its furniture front to back), for the room cards
  const roomCache = new Map();
  function roomShot(d, v) {
    const key = d.key + v; if (roomCache.has(key)) return roomCache.get(key);
    let c = null;
    try {
      let m = null;
      if (d.kind === 'home') { const build = G.Interiors && G.Interiors.homes && G.Interiors.homes[d.map]; if (build) { m = build(v); m.bake(); } }
      else if (G.Rare) m = rarePreview(d.rare);
      if (m) {
        c = document.createElement('canvas'); c.width = m.w * 16; c.height = m.h * 16;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        if (m.baked) x.drawImage(m.baked.canvas, 0, 0);
        else { x.fillStyle = '#0b0812'; x.fillRect(0, 0, c.width, c.height); if (m.rare && m.rare.floorCanvas) x.drawImage(m.rare.floorCanvas, m.rare.rect[0] * 16, m.rare.rect[1] * 16); }
        for (const p of m.props.slice().sort((a, b) => a.sortY - b.sortY)) { const s = p.spr, img = s && (s.c || (s.frames && s.frames[0])); if (img) x.drawImage(img, Math.round(p.x - s.ax), Math.round(p.y - s.ay)); }
        if (m.rare) { // just the chamber: crop away the empty cave around it
          const r = m.rare.rect, k = document.createElement('canvas'); k.width = r[2] * 16; k.height = r[3] * 16;
          k.getContext('2d').drawImage(c, -r[0] * 16, -r[1] * 16); c = k;
        }
      }
    } catch (e) { c = null; }
    roomCache.set(key, c);
    return c;
  }
  // the chamber as G.Rare builds it (in the chosen look), without its cave walls
  function rarePreview(kind) {
    const [w, h] = G.Rare.size, m = new G.GameMap('depths', w, h, { name: 'Preview', zone: 'depths', base: G.MAT.CAVEFLOOR, outdoor: false, decorDensity: 0 });
    m.floor = 7; m.seed = 4242;
    G.Rare.build(m, kind, G.U.rng(4242), 7, () => {});
    return m;
  }
  function drawRoom(x, t, d, W, H) {
    const c = roomShot(d, current(d));
    if (!c) { x.fillStyle = '#b1a4cf'; x.font = '28px ' + getComputedStyle(document.body).fontFamily; x.textAlign = 'center'; x.fillText('Walk in to see it', W / 2, H / 2); return; }
    const s = Math.min(W / c.width, H / c.height), w = c.width * s, h = c.height * s;
    x.imageSmoothingEnabled = s < 1; x.drawImage(c, Math.round((W - w) / 2), Math.round((H - h) / 2), Math.round(w), Math.round(h)); x.imageSmoothingEnabled = false;
  }
  const STAGE = { portrait: [96, 96, drawFace], mount: [0, 0, drawMounts], mob: [164, 72, drawMobs], home: [448, 320, drawRoom], rare: [448, 320, drawRoom] }; // mounts size their own stage

  // ---------------------------------------------------------------- the panel
  UI.panels.designs = function (panel, m) {
    panel.classList.add('des-modal');
    panel.appendChild(UI.closeBtn(m));
    panel.appendChild(el('h2', '', 'Designs'));
    panel.appendChild(el('div', 'subtitle', 'Your round 4 picks are the defaults, marked ★. Try the other looks here; your choice applies straight away.'));
    const body = el('div', 'body'), grid = el('div', 'des-grid');
    body.appendChild(grid); panel.appendChild(body);
    const stages = [];
    for (const d of LIST) {
      const { o, rec } = options(d), card = el('div', 'des-card' + (d.kind === 'home' || d.kind === 'rare' ? ' room' : ''));
      const [w, h] = d.kind === 'mount' ? mountSize(d) : STAGE[d.kind], fn = STAGE[d.kind][2], cv = el('canvas', 'des-cv');
      cv.width = w; cv.height = h; if (d.kind === 'portrait') cv.classList.add('face');
      if (d.kind === 'mount') cv.style.width = w * 3 + 'px'; // the same 3x for every look of it
      const stage = el('div', 'des-stage' + (d.kind === 'mob' || d.kind === 'rare' || d.kind === 'home' ? ' dark' : '')); stage.appendChild(cv); card.appendChild(stage);
      stages.push([cv, d, fn]);
      card.appendChild(el('div', 'des-n', `${d.name}<span class="small muted">${d.where}</span>`));
      const opts = el('div', 'des-opts'), note = el('div', 'small muted des-note');
      const sync = () => {
        const v = current(d); opts.querySelectorAll('.des-o').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
        const sel = o.find((x) => x[0] === v); note.textContent = sel ? sel[2] : '';
      };
      o.forEach(([v, name], i) => {
        const b = el('button', 'des-o hit', `<b>${'ABC'[i]}</b>${name}${v === rec ? ' <span class="star" title="Your pick">★</span>' : ''}`);
        b.type = 'button'; b.dataset.v = v;
        b.onclick = () => { set(d, v); sync(); G.sfx('ui_click', { volume: 0.35 }); };
        opts.appendChild(b);
      });
      card.appendChild(opts);
      if (o.length < 2) note.textContent = 'Alternatives for this are still being drawn.';
      card.appendChild(note);
      if ((d.kind === 'home' || d.kind === 'rare') && G.prefs.admin && G.Main.mode === 'play' && o.length > 1) {
        const go = el('button', 'btn small ghost', 'Visit (tester)');
        go.onclick = () => {
          UI.closeAll();
          if (d.kind === 'home') G.World.changeMap(d.map, 'door');
          else { G.S.flags.forceRare = d.rare; G.World.changeMap('depths', null, { floor: 7 }); }
        };
        card.appendChild(go);
      }
      sync();
      grid.appendChild(card);
    }
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = calm ? 0 : now - t0;
      for (const [cv, d, fn] of stages) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); try { fn(x, t, d, cv.width, cv.height); } catch (e) { /* art optional */ } }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    m.onClose = () => cancelAnimationFrame(raf);
  };
  G.Designs = { LIST, options, current, set };
})();
