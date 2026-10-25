// Nightvale website: the character picker (drawn live by the game's own art), the villagers' faces, a ride
// scene with the chosen character, and fireflies over the hero. play.html?new=1&name=..&look=.. starts that character.
(function () {
  'use strict';
  const CA = window.CharArt, MA = window.MobArt;
  const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s) => document.querySelector(s);
  const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
  const later = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 30));

  // ---------------------------------------------------------------- the keepers (skin, hair style, hair colour, robe, eyes)
  const PRESETS = [
    ['Rowan', [1, 1, 2, 0, 0]], ['Ash', [4, 4, 1, 6, 2]], ['Wren', [0, 0, 0, 7, 3]],
    ['Juniper', [2, 2, 3, 2, 4]], ['Sage', [3, 5, 5, 3, 1]], ['Isla', [5, 3, 6, 1, 1]],
  ];
  const L = (CA && CA.looks) || null;
  const lookOf = (v) => ({ skin: v[0], hair: v[1], hairColor: v[2], robe: v[3], eyes: v[4] });
  const describe = (v) => (L ? `${L.hairColors[v[2]]} hair, ${L.hairStyles[v[1]]} · ${L.robes[v[3]]} robe` : '');
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const STYLE = CA && (CA.portraitStyles || []).includes('human_hd') ? 'human_hd' : null;
  function face(look, expr, opts) { if (!CA) return null; try { return STYLE ? CA.playerPortraitStyled(STYLE, look, expr, opts || {}) : CA.playerPortrait(look, expr, opts || {}); } catch (e) { return null; } }
  function paint(cv, src) { if (!src) return; if (cv.width !== src.width) { cv.width = src.width; cv.height = src.height; } const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height); x.drawImage(src, 0, 0); }

  let sel = 0, typed = false;
  const roster = $('#roster'), nameIn = $('#pname'), begin = $('#begin'), cards = [];
  PRESETS.forEach(([name, v], i) => {
    const b = el('button', 'keeper'); b.type = 'button'; b.setAttribute('role', 'radio');
    const cv = el('canvas'); cv.width = 96; cv.height = 96; cv.setAttribute('aria-hidden', 'true');
    const n = el('span', 'kn'); n.textContent = name;
    const d = el('span', 'kd'); d.textContent = cap(describe(v));
    b.append(cv, n, d);
    b.onclick = () => choose(i);
    b.onkeydown = (e) => { const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (k) { e.preventDefault(); choose((sel + k + PRESETS.length) % PRESETS.length); cards[sel].b.focus(); } };
    roster.appendChild(b); cards.push({ b, cv, d, v: v.slice() });
    later(() => paint(cv, face(lookOf(v), i === 0 ? 'happy' : 'neutral')));
  });
  function choose(i) {
    const prev = sel; sel = i;
    cards.forEach((c, k) => { c.b.setAttribute('aria-checked', String(k === i)); c.b.tabIndex = k === i ? 0 : -1; });
    if (prev !== i) paint(cards[prev].cv, face(lookOf(cards[prev].v), 'neutral'));
    paint(cards[i].cv, face(lookOf(cards[i].v), 'happy'));
    if (!typed) nameIn.value = PRESETS[i][0];
    sync();
  }
  function sync() {
    const c = cards[sel], name = (nameIn.value || '').trim() || PRESETS[sel][0];
    begin.href = `play.html?new=1&name=${encodeURIComponent(name)}&look=${c.v.join(',')}`;
    begin.textContent = `Begin as ${name}`;
  }
  nameIn.addEventListener('input', () => { typed = nameIn.value.trim() !== ''; sync(); });
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') begin.click(); });
  $('#shuffle').onclick = () => {
    const c = cards[sel]; if (!L) return;
    const sizes = [L.skins.length, L.hairStyles.length, L.hairColors.length, L.robes.length, L.eyes.length];
    c.v = sizes.map((n) => Math.floor(Math.random() * n));
    c.d.textContent = cap(describe(c.v));
    paint(c.cv, face(lookOf(c.v), 'happy'));
    sync();
  };
  choose(0);

  // a game already saved in this browser: offer to carry on
  try {
    const s = JSON.parse(localStorage.getItem('nightvale.save.v1') || 'null');
    if (s && s.name) { const c = $('#continue'); c.hidden = false; c.textContent = `Continue as ${s.name} · day ${s.day || 1}`; }
  } catch (e) { /* no save, or storage blocked */ }

  // ---------------------------------------------------------------- the chosen keeper, walking round in a circle
  const walk = $('#walk'), wx = walk.getContext('2d');
  walk.width = 24; walk.height = 36;
  // ---------------------------------------------------------------- the villagers
  const faces = $('#faces');
  ['jasmine', 'amara', 'laura', 'ronan', 'caspian', 'mirabel', 'brann', 'elowen'].forEach((id) => {
    const cv = el('canvas'); cv.width = 96; cv.height = 96; cv.title = cap(id); cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', cap(id));
    faces.appendChild(cv);
    later(() => { try { paint(cv, STYLE ? CA.portraitStyled(STYLE, id, null, 'happy', {}) : CA.portrait(id, 'happy', {})); } catch (e) { /* art optional */ } });
  });

  // ---------------------------------------------------------------- the ride: a Shire horse and a sky dragon, with your keeper aboard
  const ride = $('#ride'), rx = ride.getContext('2d');
  ride.width = 232; ride.height = 100;
  const fitRide = () => { const w = ride.parentElement.clientWidth - 24, k = Math.max(1, Math.floor(w / ride.width)); ride.style.width = ride.width * k + 'px'; ride.style.height = ride.height * k + 'px'; };
  fitRide(); window.addEventListener('resize', fitRide);
  const mountId = (id) => (MA && MA._kit && MA._kit.MOUNTS[id] ? id : id.split('__')[0]);
  const MOUNTS = [[mountId('horse_chestnut__b'), 'walk', 62, 92, 0], [mountId('dragon_amethyst__c'), 'fly', 168, 70, 1]];
  function drawRide(t) {
    rx.clearRect(0, 0, ride.width, ride.height);
    rx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 26; i++) { const gx = ((i * 53 - t * 0.03) % (ride.width + 20) + ride.width + 20) % (ride.width + 20) - 10; rx.fillRect(Math.round(gx), 78 + (i * 7) % 20, 2, 1); } // the grass slipping by
    if (!MA || !CA) return;
    const look = lookOf(cards[sel].v), ri = CA.rideInfo || { ax: 10, ay: 26 };
    for (const [id, anim, gx, gy, sky] of MOUNTS) {
      let info; try { info = MA.mountInfo(id); } catch (e) { continue; }
      const n = info.anims[anim] || 2, fr = Math.floor((t / 1000) * (info.fps[anim] || 8)) % n, parts = MA.mount(id, anim, 'right', fr);
      if (!parts) continue;
      const bob = sky ? Math.round(Math.sin(t / 700) * 3) : 0, x0 = Math.round(gx - info.ax), y0 = Math.round(gy - info.ay + bob);
      rx.globalAlpha = sky ? 0.22 : 0.35; rx.fillStyle = '#05030a'; rx.beginPath(); rx.ellipse(gx, sky ? 96 : gy, info.w * (sky ? 0.22 : 0.3), 2.5, 0, 0, 7); rx.fill(); rx.globalAlpha = 1;
      rx.drawImage(parts.back, x0, y0);
      const sdy = (info.seatDy[anim] && info.seatDy[anim][fr]) || 0, rider = CA.playerRide(look, 'right', fr % 2);
      if (rider) rx.drawImage(rider, Math.round(x0 + info.seat.x - ri.ax), Math.round(y0 + info.seat.y + sdy - ri.ay));
      if (parts.front) rx.drawImage(parts.front, x0, y0);
    }
  }

  function drawWalk(t) {
    if (!CA) return;
    let spr; try { spr = CA.playerSprites(lookOf(cards[sel].v)); } catch (e) { return; }
    const dir = ['down', 'right', 'up', 'left'][Math.floor(t / 1800) % 4], f = spr.walk[dir][Math.floor(t / 150) % spr.walk[dir].length];
    wx.clearRect(0, 0, walk.width, walk.height); wx.imageSmoothingEnabled = false;
    wx.drawImage(f, Math.round(walk.width / 2 - spr.ax), walk.height - 2 - spr.ay);
  }

  // ---------------------------------------------------------------- fireflies over the hero
  const motes = $('#motes'), mx = motes.getContext('2d'), dots = [];
  function sizeMotes() { motes.width = motes.clientWidth; motes.height = motes.clientHeight; }
  sizeMotes(); window.addEventListener('resize', sizeMotes);
  for (let i = 0; i < 34; i++) dots.push({ x: Math.random(), y: 0.25 + Math.random() * 0.7, p: Math.random() * 7, s: 0.4 + Math.random() * 0.8, g: Math.random() < 0.3 });
  function drawMotes(t) {
    mx.clearRect(0, 0, motes.width, motes.height);
    for (const d of dots) {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t / 900 * d.s + d.p)), x = (d.x + Math.sin(t / 5000 * d.s + d.p) * 0.02) * motes.width, y = (d.y + Math.cos(t / 6000 * d.s + d.p) * 0.02) * motes.height;
      mx.globalAlpha = a * 0.9; mx.fillStyle = d.g ? '#9affd0' : '#ffe08f'; mx.fillRect(Math.round(x), Math.round(y), 2, 2);
      mx.globalAlpha = a * 0.18; mx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 6, 6);
    }
    mx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- one loop for everything that moves
  const nav = $('.nav');
  const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  function frame(t) {
    const tt = calm ? 0 : t;
    drawWalk(tt); drawRide(tt); if (!calm) drawMotes(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
