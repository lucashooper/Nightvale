(function () {
  'use strict';
  const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.innerHTML = x; return e; };
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anims = []; const tick = (t) => { for (const a of anims) a(calm ? 0 : t); requestAnimationFrame(tick); };
  const DATA = window.PICK_DATA || {}, SHOTS = DATA.shots || {}, NOTES = Object.assign({}, DATA.notes || {}, window.ALT_NOTES || {});
  const LOOK = { skin: 1, hair: 1, hairColor: 4, robe: 0, eyes: 0 };
  const K = (window.MobArt && MobArt._kit) || { TYPES: {}, MOUNTS: {} };
  const picks = { choice: {}, more: {}, notes: {} };
  // my pick for each, and why (shown above the options)
  const TAKE = window.PICK_TAKE || {};

  const NAMES = { mirabel: ['Mirabel', 'Seedkeeper'], pip: ['Pip', 'Apprentice alchemist'], sable: ['Sable', 'Keeper of the Gilded Owl'], brann: ['Brann', 'Smith'], orvyn: ['Orvyn', 'Astronomer'],
    elowen: ['Elowen', 'Warden of Whisperwood'], grizelda: ['Grizelda', 'Witch of the Mire'], corvin: ['Corvin', 'Gravekeeper'], lune: ['Lune', 'Captain of Glimmermere'], elvis: ['Elvis', 'Barkeep'],
    isolde: ['Isolde', 'Threads & Tomes'], seraphine: ['Seraphine', 'Keeper of the Silver Veil'], fennick: ['Fennick', 'Wandering merchant'], laura: ['Laura', 'Monster hunter'], jasmine: ['Jasmine', 'Beekeeper & baker'],
    amara: ['Amara', 'Star-cartographer'], ronan: ['Ronan', 'Runesmith'], caspian: ['Caspian', 'Dragon tamer'], gideon: ['Gideon', 'Guildmaster'], nightmerchant: ['The Night Merchant', 'Night Market'], player: ['You', 'the Keeper'] };
  const FACE_CAST = ['jasmine', 'amara', 'laura', 'ronan', 'caspian', 'mirabel', 'brann', 'grizelda', 'player'];
  const FACE_EXPR = ['neutral', 'neutral', 'surprised', 'neutral', 'happy', 'neutral', 'angry', 'neutral', 'happy'];
  const STYLES = [['a', 'Classic', 'The faces in the game today.'], ['human', 'Human', 'Rebuilt as cute, real people at today\'s size: a chin, ears and a neck, a small nose and lips, almond eyes with lashes.'], ['human_hd', 'Human HD', 'The same faces drawn at 96 pixels instead of 64, so they come out sharper and smoother.']]
    .filter((s) => s[0] === 'a' || (window.CharArt && (CharArt.portraitStyles || []).includes(s[0])));

  function face(style, id, expr, opts) {
    if (!window.CharArt) return null;
    if (style === 'a') return id === 'player' ? CharArt.playerPortrait(LOOK, expr, opts) : CharArt.portrait(id, expr, opts);
    return id === 'player' ? CharArt.playerPortraitStyled(style, LOOK, expr, opts) : CharArt.portraitStyled(style, id, null, expr, opts);
  }
  function canvas(w, hgt, cssW) { const c = h('canvas'); c.width = w; c.height = hgt; if (cssW) c.style.width = cssW + 'px'; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function animate(x, fn) { anims.push((t) => { x.clearRect(0, 0, x.canvas.width, x.canvas.height); try { fn(x, t); } catch (e) { /* art optional */ } }); }

  // ---------------------------------------------------------------- stages
  function faceStage(style) {
    const s = h('div', 'stage face'); const native = style === 'human_hd' ? 96 : 64;
    const [c, x] = canvas(native, native, 192); s.appendChild(c);
    animate(x, (x, t) => {
      const k = Math.floor(t / 2600) % FACE_CAST.length, ph = t % 2600;
      const src = face(style, FACE_CAST[k], FACE_EXPR[k], { blink: ph > 1900 && ph < 2030, talk: ph < 1400 && Math.floor(t / 150) % 2 === 1 });
      if (src) { if (c.width !== src.width) { c.width = src.width; c.height = src.height; x.imageSmoothingEnabled = false; } x.drawImage(src, 0, 0); }
    });
    return s;
  }
  const mountId = (id, v) => (v === 'a' ? id : id + '__' + v);
  // every option of a subject shares one stage size, so A, B and C show at their true sizes side by side
  function mountSize(ids, vs) {
    const infos = [].concat(...vs.map((v) => ids.map((id) => MobArt.mountInfo(mountId(id, v)))));
    return { W: Math.max(...infos.map((i) => i.w)) + 12, H: Math.max(...infos.map((i) => i.ay + 2)) + (ids[0].startsWith('dragon') ? 22 : 12) };
  }
  const COATS = { horse_midnight: 'Midnight', horse_silver: 'Silver Dapple', horse_chestnut: 'Chestnut', dragon_amethyst: 'Amethyst', dragon_emerald: 'Emerald', dragon_ember: 'Ember' };
  function mountStage(ids, v, size) {
    const dragon = ids[0].startsWith('dragon'), { W, H } = size;
    const s = h('div', 'stage'), [c, x] = canvas(W, H, W * 3), coat = h('div', 'coat'); s.appendChild(c); s.appendChild(coat);
    const ri = (window.CharArt && CharArt.rideInfo) || { ax: 10, ay: 26 };
    animate(x, (x, t) => {
      const turn = Math.floor(t / 2200), dir = ['down', 'right', 'up', 'left'][turn % 4], id0 = ids[Math.floor(turn / 4) % ids.length]; // one coat at a time, all the way round
      const id = mountId(id0, v), info = MobArt.mountInfo(id), anim = dragon ? 'fly' : 'walk', n = info.anims[anim] || 2, fr = Math.floor((t / 1000) * (info.fps[anim] || 8)) % n;
      if (coat.textContent !== COATS[id0]) coat.textContent = COATS[id0];
      const parts = MobArt.mount(id, anim, dir, fr); if (!parts) return;
      const gx = Math.round(W / 2), gy = H - 6, lift = dragon ? 10 : 0;
      x.globalAlpha = dragon ? 0.28 : 0.38; x.fillStyle = '#0e0818'; x.beginPath(); x.ellipse(gx, gy, dragon ? info.w * 0.24 : info.w * 0.32, dragon ? info.w * 0.08 : info.w * 0.1, 0, 0, 7); x.fill(); x.globalAlpha = 1;
      const x0 = Math.round(gx - info.ax), y0 = Math.round(gy - info.ay - lift);
      x.drawImage(parts.back, x0, y0);
      const sdy = (info.seatDy[anim] && info.seatDy[anim][fr]) || 0, rider = window.CharArt && CharArt.playerRide ? CharArt.playerRide(LOOK, dir, fr % 2) : null;
      if (rider) x.drawImage(rider, Math.round(x0 + info.seat.x - ri.ax), Math.round(y0 + info.seat.y + sdy - ri.ay));
      if (parts.front) x.drawImage(parts.front, x0, y0);
    });
    return s;
  }
  const mobId = (id, v) => (v === 'a' || !K.TYPES[id + '__' + v] ? id : id + '__' + v);
  function mobSize(mobs, vs) {
    const infos = [].concat(...vs.map((v) => mobs.map(([id]) => MobArt.info(mobId(id, v)))));
    return { W: Math.max(150, Math.max(...infos.map((i) => i.w)) * 1.9 + 20) | 0, H: Math.max(...infos.map((i) => i.h)) + 14 };
  }
  function mobStage(mobs, cycle, v, size) {
    const infos = mobs.map(([id]) => MobArt.info(mobId(id, v))), { W, H } = size;
    const s = h('div', 'stage dark'), [c, x] = canvas(W, H, W * 2); s.appendChild(c);
    animate(x, (x, t) => {
      const seq = cycle || ['idle', 'move', 'attack'], a = seq[Math.floor(t / 1700) % seq.length];
      mobs.forEach(([id0, fx], i) => {
        const id = mobId(id0, v), info = infos[i], anim = info.anims[a] ? a : 'idle';
        const f = Math.floor((t / 1000) * (info.fps[anim] || 6)) % (info.anims[anim] || 1), fr = MobArt.frame(id, 'default', anim, f, false); if (!fr) return;
        const gx = Math.round(W * fx), gy = H - 8;
        if (id0 !== 'deep_wyrm') { x.globalAlpha = 0.3; x.fillStyle = '#000'; x.beginPath(); x.ellipse(gx, gy, Math.max(4, info.w * 0.3), Math.max(1.5, info.w * 0.09), 0, 0, 7); x.fill(); x.globalAlpha = 1; }
        x.drawImage(fr, Math.round(gx - info.ax), Math.round(gy - info.ay));
      });
    });
    return s;
  }
  function shot(key, v, name) { const src = SHOTS[key + '_' + v]; if (!src) return null; const im = h('img', 'shot'); im.src = src; im.alt = name; im.loading = 'lazy'; return im; }

  // ---------------------------------------------------------------- the things to pick
  const SUBJECTS = [
    ['mounts', 'horses', 'Horses', "Caspian's Menagerie · ride with R", 'mount', { ids: ['horse_midnight', 'horse_silver', 'horse_chestnut'] }],
    ['mounts', 'dragons', 'Dragons', "Caspian's Menagerie · Silver guild rank · they fly", 'mount', { ids: ['dragon_amethyst', 'dragon_emerald', 'dragon_ember'] }],
    ['bosses', 'gloopgarr', 'Gloopgarr the Slime Ogre', 'sheds fast little slimes, then splits', 'mob', { mobs: [['slime_ogre', 0.34], ['slime_med', 0.7], ['slime_small', 0.86]] }],
    ['bosses', 'grimjaw', 'Old Grimjaw', 'circles, crouches and lunges, and howls more wolves in', 'mob', { mobs: [['grimjaw', 0.5]] }],
    ['bosses', 'wyrm', 'Vorrakh, the Deep Wyrm', 'floor 20 · burrows, then bursts out', 'mob', { mobs: [['deep_wyrm', 0.5]], cycle: ['idle', 'move', 'attack', 'burrow', 'emerge'] }],
    ['homes', 'home_jasmine', "Jasmine's cottage", 'pastel bears, honey and baking', 'shot', {}],
    ['homes', 'home_amara', "Amara's study", 'stars, books and a brass telescope', 'shot', {}],
    ['floors', 'rare_observatory', 'The Sunken Observatory', 'spin the orrery to open the way down', 'shot', {}],
    ['floors', 'rare_crystal', 'The Crystal Garden', 'crystal flowers and a healing fountain', 'shot', {}],
  ];
  const SECTIONS = { mounts: ['Mounts', 'Shown with you riding, turning through all four directions.'], bosses: ['Bounty bosses', 'Each one cycles through its moves. Same fights, new looks.'],
    homes: ['Homes', 'Screenshots from the game. Same rooms and the same things to look at and use, laid out and furnished differently.'], floors: ['Rare floors', 'About one floor in ten of the Umbral Depths. Same secrets, new looks.'] };
  // [value, name, note] for each option that's drawn
  function optionsFor(key, kind, o) {
    const n = NOTES[key] || {}, out = [['a', 'Today\'s design', 'What\'s in the game now.']];
    for (const v of ['b', 'c']) {
      const drawn = kind === 'mount' ? !!K.MOUNTS[mountId(o.ids[0], v)] : kind === 'mob' ? !!K.TYPES[o.mobs[0][0] + '__' + v] : !!SHOTS[key + '_' + v];
      if (drawn) out.push([v, (n[v] && n[v].name) || v.toUpperCase(), (n[v] && n[v].note) || '']);
    }
    return out;
  }

  const secs = document.getElementById('secs');
  function section(id, title, sub) { const s = h('section'); s.id = id; s.appendChild(h('h2', '', title)); if (sub) s.appendChild(h('p', 'sub', sub)); secs.appendChild(s); return s; }
  function extras(key) {
    const ex = h('div', 'extra');
    const alt = h('button', 'alt'); alt.type = 'button';
    const sync = () => { alt.setAttribute('aria-pressed', String(!!picks.more[key])); alt.textContent = picks.more[key] ? 'Requested: more on the way' : 'Show alternatives'; };
    alt.title = 'None of these? I\'ll draw two or three more for you to compare';
    alt.onclick = () => { picks.more[key] = !picks.more[key]; sync(); save(); };
    sync(); ex.appendChild(alt);
    const t = h('textarea', 'note'); t.id = 'note-' + key; t.rows = 1; t.placeholder = 'What would you change? (optional)'; t.value = picks.notes[key] || '';
    t.oninput = () => { picks.notes[key] = t.value; save(true); };
    ex.appendChild(t);
    return ex;
  }
  // one thing: my take, its options side by side (each with a Choose button), then Show alternatives and a note
  function subject(parent, key, title, where, opts, visual) {
    const box = h('div', 'subj');
    box.appendChild(h('h3', '', `${title}${where ? ` <small>${where}</small>` : ''}`));
    const take = TAKE[key];
    if (take && opts.some((o) => o[0] === take[0])) box.appendChild(h('div', 'rec', `<b>MY PICK</b><span>${'ABC'[opts.findIndex((o) => o[0] === take[0])]}: ${take[1]}</span>`));
    const grid = h('div', 'opts'), cards = [];
    opts.forEach(([v, name, note], i) => {
      const card = h('div', 'opt'); card.dataset.v = v;
      const vis = visual(v, name); if (vis) card.appendChild(vis);
      card.appendChild(h('div', 'lab', `<span class="k">${'ABC'[i]}</span><span>${name}</span>${take && take[0] === v ? '<span class="mine">MY PICK</span>' : ''}`));
      if (note) card.appendChild(h('div', 'ds', note));
      const b = h('button', 'choose', `Choose ${'ABC'[i]}`); b.type = 'button';
      b.onclick = () => { picks.choice[key] = picks.choice[key] === v ? null : v; sync(); save(); };
      card.appendChild(b); grid.appendChild(card); cards.push([card, b, i]);
    });
    if (opts.length < 2) grid.appendChild(h('div', 'opt', '<div class="wait">The alternatives for this are still being drawn.</div>'));
    const sync = () => { for (const [card, b, i] of cards) { const on = picks.choice[key] === card.dataset.v; card.classList.toggle('on', on); b.textContent = on ? `Chosen: ${'ABC'[i]}` : `Choose ${'ABC'[i]}`; b.setAttribute('aria-pressed', String(on)); } count(); };
    sync(); box.appendChild(grid); box.appendChild(extras(key));
    parent.appendChild(box);
  }

  // faces: the three styles side by side, then every character in all three
  let expr = 'neutral', castBox = null;
  function drawCast() {
    if (!castBox) return;
    castBox.querySelectorAll('canvas').forEach((c) => {
      const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height);
      let src = null; try { src = face(c.dataset.style, c.dataset.id, expr === 'talk' ? 'happy' : expr, { talk: expr === 'talk' }); } catch (e) { src = null; }
      if (!src) return;
      const k = Math.floor(c.width / src.width); x.imageSmoothingEnabled = false; // 64 px at 3x, 96 px at 2x; the browser then scales the tile smoothly
      x.drawImage(src, (c.width - src.width * k) / 2, (c.height - src.height * k) / 2, src.width * k, src.height * k);
    });
    markCast();
  }
  function markCast() { if (castBox) castBox.querySelectorAll('figure').forEach((f) => f.classList.toggle('on', picks.choice.portraits === f.dataset.style)); }
  function buildFaces() {
    const s = section('faces', 'Faces', 'The faces you see in conversations, in the satchel and in shops. Each villager keeps their own hair, clothes and colours; only the drawing of the face changes.');
    subject(s, 'portraits', 'Portrait style', 'every villager and you', STYLES, (v) => faceStage(v));
    const head = h('div', 'cast-head'); head.appendChild(h('h3', '', 'Every character'));
    const chips = h('div', 'chips');
    for (const [k, label] of [['neutral', 'Neutral'], ['happy', 'Happy'], ['sad', 'Sad'], ['surprised', 'Surprised'], ['angry', 'Angry'], ['talk', 'Talking']]) {
      const b = h('button', 'chip', label); b.type = 'button'; b.setAttribute('aria-pressed', String(expr === k));
      b.onclick = () => { expr = k; chips.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawCast(); };
      chips.appendChild(b);
    }
    head.appendChild(chips); s.appendChild(head);
    castBox = h('div', 'cast');
    const ids = ((window.CharArt && CharArt.npcIds) || []).concat(['player']);
    for (const id of ids) {
      const who = h('div', 'who'), nm = NAMES[id] || [id, ''];
      who.appendChild(h('div', 'nm', `${nm[0]} <small>${nm[1]}</small>`));
      const row = h('div', 'faces');
      STYLES.forEach(([v], i) => {
        const f = h('figure'); f.dataset.style = v;
        const c = h('canvas'); c.width = 192; c.height = 192; c.dataset.style = v; c.dataset.id = id; c.setAttribute('aria-label', `${nm[0]}, style ${'ABC'[i]}`);
        f.appendChild(c); f.appendChild(h('figcaption', '', 'ABC'[i] + ' · ' + STYLES[i][1])); row.appendChild(f);
      });
      who.appendChild(row); castBox.appendChild(who);
    }
    s.appendChild(castBox);
    drawCast();
  }

  function build() {
    secs.innerHTML = ''; anims.length = 0;
    buildFaces();
    const made = {};
    for (const [sec, key, title, where, kind, o] of SUBJECTS) {
      if (!made[sec]) made[sec] = section(sec, SECTIONS[sec][0], SECTIONS[sec][1]);
      const opts = optionsFor(key, kind, o), vs = opts.map((x) => x[0]);
      const size = kind === 'mount' ? mountSize(o.ids, vs) : kind === 'mob' ? mobSize(o.mobs, vs) : null;
      subject(made[sec], key, title, where, opts, (v, name) => kind === 'mount' ? mountStage(o.ids, v, size) : kind === 'mob' ? mobStage(o.mobs, o.cycle, v, size) : shot(key, v, `${title}, ${name}`));
    }
    count();
  }

  // ---------------------------------------------------------------- saving: straight to Claude when the page can, otherwise Copy
  const st = document.getElementById('st'), copyBtn = document.getElementById('copy'), box = document.getElementById('box'), cnt = document.getElementById('count');
  function count() { if (!cnt) return; const n = ['portraits'].concat(SUBJECTS.map((x) => x[1])).filter((k) => picks.choice[k]).length; cnt.textContent = `${n} of ${SUBJECTS.length + 1} chosen`; markCast(); }
  let db = null, timer = null, busy = false, again = false;
  const text = () => 'Round 4 picks: ' + JSON.stringify(picks);
  async function flush() {
    if (!db) return; if (busy) { again = true; return; }
    busy = true; st.textContent = 'Saving…'; st.className = 'st';
    try { await db.doc('picks/round4').set({ choice: picks.choice, more: picks.more, notes: picks.notes, at: Date.now() }); st.textContent = 'Saved. Claude can see your picks.'; st.className = 'st ok'; }
    catch (e) { st.textContent = 'Couldn\'t save just now. Use Copy picks and paste them to Claude.'; copyBtn.hidden = false; }
    busy = false; if (again) { again = false; flush(); }
  }
  function save(slow) { if (!db) { st.textContent = 'Picks noted. Use Copy picks and paste them to Claude.'; copyBtn.hidden = false; return; } clearTimeout(timer); timer = setTimeout(flush, slow ? 900 : 300); }
  copyBtn.onclick = async () => { const t = text(); try { await navigator.clipboard.writeText(t); copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy picks'; }, 1500); } catch (e) { box.hidden = false; box.value = t; box.focus(); box.select(); } };

  build(); requestAnimationFrame(tick);
  (async () => {
    try { db = window.claude && window.claude.use ? await window.claude.use('db') : null; } catch (e) { db = null; }
    if (!db) { st.textContent = 'Pick away, then use Copy picks and paste them to Claude.'; copyBtn.hidden = false; return; }
    try {
      const snap = await db.doc('picks/round4').get();
      if (snap.exists) { const d = snap.data() || {}; Object.assign(picks.choice, d.choice || {}); Object.assign(picks.more, d.more || {}); Object.assign(picks.notes, d.notes || {}); build(); st.textContent = 'Your earlier picks are loaded. Changes save automatically.'; st.className = 'st ok'; }
    } catch (e) { /* first visit or offline: start fresh */ }
  })();
})();
