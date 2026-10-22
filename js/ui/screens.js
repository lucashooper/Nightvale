// Nightvale — title screen, character creator, opening letter.
(function () {
  'use strict';
  const G = window.G, U = G.U, UI = G.UI, el = UI.el;
  const Screens = (G.Screens = {});

  Screens.title = function () {
    const root = UI.root;
    const t = el('div', 'title');
    t.innerHTML = `<div><div class="logo">Nightvale</div><div class="tag">Grow · Brew · Descend</div><div class="menu"></div></div><div class="foot">Best with sound on · WASD to move · mouse or Space to use tools · E to talk and interact</div>`;
    const menu = t.querySelector('.menu');
    const build = () => {
      menu.innerHTML = '';
      const has = G.Save.has();
      const mk = (label, cls, fn) => { const b = el('button', 'btn ' + cls, label); b.onclick = () => { unlockAudio(); G.sfx('ui_click'); fn(); }; menu.appendChild(b); return b; };
      if (has) mk('Continue', 'gold', () => { t.remove(); Screens.continueGame(); });
      mk('New game', has ? '' : 'gold', async () => {
        if (G.Save.has()) { const ok = await UI.confirm('Start a new game? Your current save will be replaced when you first sleep.', 'Start fresh', 'Back'); if (!ok) return; }
        t.remove(); Screens.creator();
      });
      mk('Settings', 'ghost', () => UI.open('settings'));
    };
    build();
    G.on('cloudSave', (d) => { if (d && t.isConnected && !menu.textContent.includes('Continue')) build(); });
    root.appendChild(t);
    Screens.titleEl = t;
    t.addEventListener('mousedown', unlockAudio, { once: true });
    setTimeout(() => { const b = menu.querySelector('.btn'); if (b) b.focus(); }, 100);
  };
  function unlockAudio() {
    try {
      if (window.AudioEngine && !AudioEngine.isUnlocked()) { AudioEngine.unlock(); G.Save.loadSettings(); }
      if (window.AudioEngine && G.Main.mode === 'title') AudioEngine.setZone('title', {});
    } catch (e) { /* audio optional */ }
  }
  G.unlockAudio = unlockAudio;
  window.addEventListener('keydown', unlockAudio, { once: true });

  UI.panels.settings = function (panel, m) {
    panel.appendChild(UI.closeBtn(m));
    panel.appendChild(el('h2', '', 'Settings'));
    const body = el('div', 'body'); panel.appendChild(body);
    body.appendChild(UI.settingsBlock());
    const b = el('button', 'btn ghost', 'Delete saved game');
    b.style.marginTop = '14px';
    b.onclick = async () => { m.close(); const ok = await UI.confirm('Delete your saved game? This cannot be undone.', 'Delete', 'Keep it'); if (ok) { G.Save.clear(); location.reload(); } };
    if (G.Save.has()) body.appendChild(b);
  };

  // ---------------------------------------------------------------- character creator
  const LOOK_NAMES = {
    skins: ['Pale', 'Fair', 'Tan', 'Brown', 'Deep', 'Moon-pale'],
    hairStyles: ['Messy', 'Long', 'Braid', 'Bun', 'Curls', 'Crop'],
    hairColors: ['Silver', 'Black', 'Ginger', 'Auburn', 'Brown', 'Moss', 'White', 'Plum'],
    robes: ['Indigo', 'Plum', 'Forest', 'Teal', 'Wine', 'Slate', 'Ochre', 'Midnight'],
    eyes: ['Green', 'Violet', 'Amber', 'Blue', 'Brown'],
  };
  Screens.creator = function () {
    const looks = (window.CharArt && CharArt.looks) || LOOK_NAMES;
    const L = { skins: looks.skins || LOOK_NAMES.skins, hairStyles: looks.hairStyles || LOOK_NAMES.hairStyles, hairColors: looks.hairColors || LOOK_NAMES.hairColors, robes: looks.robes || LOOK_NAMES.robes, eyes: looks.eyes || LOOK_NAMES.eyes };
    const look = { skin: 1, hair: 0, hairColor: 1, robe: 0, eyes: 0 };
    let name = '';
    UI.panels.creator = function (panel, m) {
      m.noBgClose = true;
      panel.appendChild(el('h2', '', 'Who are you?'));
      panel.appendChild(el('div', 'subtitle', 'Morwenna’s old apprentice, coming home to a garden that has forgotten you.'));
      const body = el('div', 'body'); panel.appendChild(body);
      const wrap = el('div', 'creator');
      const pv = el('div', 'pv');
      const pc = el('canvas'); pc.width = 128; pc.height = 128; pc.style.width = '160px'; pc.style.height = '160px';
      const sc = el('canvas'); sc.width = 80; sc.height = 64; sc.style.width = '160px'; sc.style.height = '128px';
      pv.appendChild(pc); pv.appendChild(sc);
      wrap.appendChild(pv);
      const right = el('div', 'col');
      right.appendChild(el('label', 'lbl', 'Name'));
      const inp = el('input', 'name'); inp.id = 'player-name'; inp.maxLength = 14; inp.placeholder = 'Rowan'; inp.value = name; inp.setAttribute('aria-label', 'Your name');
      inp.oninput = () => { name = inp.value; };
      right.appendChild(inp);
      const opts = [['skin', 'Skin', L.skins], ['hair', 'Hair style', L.hairStyles], ['hairColor', 'Hair colour', L.hairColors], ['robe', 'Robe', L.robes], ['eyes', 'Eyes', L.eyes]];
      for (const [k, label, names] of opts) {
        const row = el('div', 'opt');
        row.innerHTML = `<span class="muted">${label}</span>`;
        const prev = el('button', 'btn', '◀'), next = el('button', 'btn', '▶'), v = el('span', 'v', names[look[k]]);
        prev.setAttribute('aria-label', 'Previous ' + label); next.setAttribute('aria-label', 'Next ' + label);
        prev.onclick = () => { look[k] = U.wrap(look[k] - 1, names.length); v.textContent = names[look[k]]; draw(); G.sfx('ui_click', { volume: 0.4 }); };
        next.onclick = () => { look[k] = U.wrap(look[k] + 1, names.length); v.textContent = names[look[k]]; draw(); G.sfx('ui_click', { volume: 0.4 }); };
        row.appendChild(prev); row.appendChild(v); row.appendChild(next);
        right.appendChild(row);
      }
      const brow = el('div', 'row'); brow.style.marginTop = '8px';
      const rnd = el('button', 'btn ghost', 'Surprise me');
      rnd.onclick = () => { for (const [k, , names] of opts) look[k] = Math.floor(Math.random() * names.length); m.rerender(); };
      const go = el('button', 'btn gold', 'Begin');
      go.onclick = () => {
        const nm = (inp.value || '').trim() || 'Rowan';
        m.close();
        Screens.intro(nm, Object.assign({}, look));
      };
      brow.appendChild(rnd); brow.appendChild(go);
      right.appendChild(brow);
      wrap.appendChild(right);
      body.appendChild(wrap);
      let raf = 0, t0 = performance.now();
      function draw() {
        const keepS = G.S;
        G.S = Object.assign({}, G.S || {}, { look });
        UI.drawPortrait(pc, 'player', 'happy');
        const spr = G.playerSprites(look);
        G.S = keepS;
        const c = sc.getContext('2d'); c.imageSmoothingEnabled = false;
        const anim = () => {
          c.clearRect(0, 0, sc.width, sc.height);
          const f = Math.floor((performance.now() - t0) / 150) % 4;
          const dirs = ['down', 'right', 'up', 'left'];
          dirs.forEach((d, i) => { const fr = spr.walk[d][f]; c.drawImage(fr, i * 20, 32 - fr.height / 2 + 6); });
          raf = requestAnimationFrame(anim);
        };
        cancelAnimationFrame(raf); anim();
      }
      m.onClose = () => cancelAnimationFrame(raf);
      draw();
      setTimeout(() => inp.focus(), 60);
    };
    UI.open('creator', {});
  };

  // ---------------------------------------------------------------- opening letter
  Screens.intro = function (name, look) {
    const pages = ((window.GAMETEXT && GAMETEXT.intro) || [
      'The coach drops you at the edge of a valley where the moon hangs a little too close.',
      'In your pocket: a letter sealed with violet wax, and a key.',
      'My dear {player}, if you are reading this, I have gone beyond the Veil. Don\'t you dare cry on my good parchment.',
      'The Sanctum is yours now: the garden, the cauldron, the altar, and the cat. Especially the cat.',
      'The moon remembers what we forget. Wake the garden, and the garden will wake the valley. — Morwenna',
    ]).map((p) => p.replace(/\{player\}/g, name).replace(/\{cat\}/g, 'Inkwell'));
    const bg = el('div', 'modal-bg');
    const letter = el('div', 'letter hit');
    letter.innerHTML = '<div class="pg"></div><div class="nav"><span class="cnt"></span><button class="btn gold">Next</button></div><div class="seal">M</div>';
    bg.appendChild(letter);
    UI.root.appendChild(bg);
    let i = 0;
    const pg = letter.querySelector('.pg'), cnt = letter.querySelector('.cnt'), btn = letter.querySelector('.btn');
    const show = () => { pg.textContent = pages[i]; cnt.textContent = `${i + 1} / ${pages.length}`; btn.textContent = i === pages.length - 1 ? 'Begin' : 'Next'; };
    const next = () => { G.sfx('ui_click', { volume: 0.4 }); if (i < pages.length - 1) { i++; show(); } else { bg.remove(); document.removeEventListener('keydown', key); Screens.startNew(name, look); } };
    const key = (e) => { if (['Enter', 'Space', 'KeyE'].includes(e.code)) { e.preventDefault(); next(); } };
    btn.onclick = next;
    document.addEventListener('keydown', key);
    show();
  };

  Screens.startNew = async function (name, look) {
    await UI.fadeTo(1, 0.6);
    const S = G.World.freshState(name, look);
    G.World.focusOverride = null; G.World.hidePlayer = false;
    G.World.start(S, true);
    G.Main.mode = 'play';
    UI.showHud(true);
    G.World.updateAudio(true);
    await UI.fadeTo(0, 1.0);
    UI.banner('The Verdant Sanctum', `Day 1 · ${G.weekday()} · ${G.MOON[G.moonPhase()]}`);
    setTimeout(() => UI.toast('Tip: press I for your satchel, E to talk and interact, and click to use the tool in your hand.'), 2600);
  };
  Screens.continueGame = async function () {
    const S = G.Save.load();
    if (!S) { Screens.creator(); return; }
    await UI.fadeTo(1, 0.5);
    G.World.focusOverride = null; G.World.hidePlayer = false;
    G.World.start(S, false);
    G.Main.mode = 'play';
    UI.showHud(true);
    G.World.updateAudio(true);
    await UI.fadeTo(0, 0.8);
    UI.newDayToast();
  };
})();
