// Nightvale — Drake's Menagerie: pets that follow you or nap around the cottage, horses and dragons you call
// and ride with R (dragons fly over trees, water and rooftops), riding gear, and the animals in Caspian's paddock.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Mg = (G.Menagerie = { pets: [], ride: null, alt: 0, calling: null, paddock: [] });
  const MA = () => window.MobArt;
  const W = () => G.World;
  function st() { const S = G.S; if (!S.pets) S.pets = []; if (!S.mounts) S.mounts = []; if (!S.gear) S.gear = {}; if (!S.petLove) S.petLove = {}; return S; }
  const kindOf = (id) => (G.item(id).kind || (id.startsWith('dragon') ? 'dragon' : 'horse'));
  const canRideHere = (map) => map && map.outdoor !== false && !map.interior && map.id !== 'depths' && !(G.Festival && G.Festival.active && G.Festival.active() && map.id === 'village');

  // ---------------------------------------------------------------- buying things from Caspian
  Mg.use = async function (it) {
    const S = st();
    if (it.cat === 'pet') {
      if (S.pets.includes(it.id)) { G.UI.toast(`You already have a ${it.name}.`); return; }
      G.Inv.removeAt(S.sel, 1); S.pets.push(it.id);
      if (!S.petOut) S.petOut = it.id;
      G.jingle('heart_up');
      G.UI.toast(`${it.name} is yours! ${S.petOut === it.id ? 'It will tag along with you.' : 'It will wait at your cottage.'} Talk to a pet to pet it, or to have it follow or stay home.`, it.id);
      Mg.place();
      return;
    }
    if (it.cat === 'mount') {
      if (S.mounts.includes(it.id)) { G.UI.toast(`You already own the ${it.name}.`); return; }
      G.Inv.removeAt(S.sel, 1); S.mounts.push(it.id); S.mountSel = it.id;
      G.jingle('quest_complete');
      const t = window.GAMETEXT && GAMETEXT.menagerie && GAMETEXT.menagerie.firstRide;
      if (t && !S.flags.firstRide) { S.flags.firstRide = true; await G.UI.say(null, t); }
      G.UI.toast(`The ${it.name} is yours. Press R outdoors to call it and ride; R again to hop off.${kindOf(it.id) === 'dragon' ? ' Dragons fly!' : ''}`, it.id);
      return;
    }
    if (it.cat === 'gear') {
      if (S.gear[it.id]) { G.UI.toast('You already use this.'); return; }
      G.Inv.removeAt(S.sel, 1); S.gear[it.id] = true;
      const g = it.gear || {};
      G.UI.toast(g.speed ? `${it.name}: riding is ${Math.round(g.speed * 100)}% faster.` : g.fly ? `${it.name}: your dragon flies higher and faster.` : g.whistle ? `${it.name}: your mount now comes the instant you call.` : `${it.name} equipped.`, it.id);
      G.sfx('cloth_rustle');
    }
  };

  // ---------------------------------------------------------------- pets
  class Pet {
    constructor(id) { this.id = id; this.x = 0; this.y = 0; this.map = null; this.anim = 'idle'; this.t = Math.random() * 3; this.ft = 0; this.flip = false; this.bw = 6; this.bh = 4; this.state = 'idle'; this.heart = 0; this.slide = true; }
    info() { try { return MA() && MA().petInfo ? MA().petInfo(this.id) : null; } catch (e) { return null; } }
  }
  Mg.place = function () {
    const S = st(), w = W();
    Mg.pets = S.pets.map((id) => { const old = Mg.pets.find((p) => p.id === id); return old || new Pet(id); });
    for (const p of Mg.pets) {
      const follow = S.petOut === p.id;
      if (follow && w.map && canFollow(w.map)) { p.map = w.map.id; p.x = w.player.x - 14 + Math.random() * 28; p.y = w.player.y + 10; }
      else if (!follow || !w.map || !canFollow(w.map)) { if (p.map !== 'sanctum' || follow) { const r = HOME; p.map = 'sanctum'; p.x = (r[0] + Math.random() * r[2]) * 16; p.y = (r[1] + Math.random() * r[3]) * 16; } }
    }
  };
  const HOME = [3, 29, 10, 4]; // the lawn in front of the keeper's cottage
  const canFollow = (map) => map && map.id !== 'depths' && map.id !== 'cottage_none';
  function updatePet(p, dt, map) {
    const S = G.S, pl = W().player, follow = S.petOut === p.id;
    p.ft += dt; p.t -= dt; if (p.heart > 0) p.heart -= dt;
    if (follow) {
      const dx = pl.x - p.x, dy = pl.y + 6 - p.y, d = Math.hypot(dx, dy);
      if (d > 240) { p.x = pl.x - 12; p.y = pl.y + 8; return; }
      if (d > 30) {
        const sp = (d > 90 ? 120 : 70) * (Mg.ride ? 1.8 : 1) * dt;
        const ox = p.x, oy = p.y;
        G.moveBody(p, (dx / d) * sp, (dy / d) * sp, map);
        if (Math.abs(p.x - ox) + Math.abs(p.y - oy) < 0.05) { p.x += (dx / d) * sp; p.y += (dy / d) * sp; } // squeeze past little snags
        p.flip = dx < 0; p.anim = p.id === 'pet_hatchling' && d > 60 ? 'flutter' : 'walk'; p.idleT = 0;
      } else { p.idleT = (p.idleT || 0) + dt; p.anim = p.idleT > 12 ? 'sleep' : 'idle'; }
      return;
    }
    // at home: potter about the cottage lawn, nap now and then
    if (p.state === 'walk') {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d < 2 || p.t <= 0) { p.state = Math.random() < 0.4 ? 'sleep' : 'idle'; p.t = 4 + Math.random() * 8; }
      else { G.moveBody(p, (dx / d) * 28 * dt, (dy / d) * 28 * dt, map); p.flip = dx < 0; }
      p.anim = 'walk';
    } else {
      p.anim = p.state === 'sleep' ? 'sleep' : 'idle';
      if (p.t <= 0) { p.state = 'walk'; p.tx = (HOME[0] + Math.random() * HOME[2]) * 16; p.ty = (HOME[1] + Math.random() * HOME[3]) * 16; p.t = 6; }
    }
  }
  function drawPet(ctx, p, ox, oy) {
    const info = p.info(); let c = null;
    const n = (info && info.anims && info.anims[p.anim]) || 2, fps = (info && info.fps && info.fps[p.anim]) || (p.anim === 'walk' ? 8 : 2);
    try { c = MA().pet(p.id, p.anim, Math.floor(p.ft * fps) % n, p.flip); } catch (e) { c = null; }
    if (!c) { ctx.fillStyle = '#e4d2ff'; ctx.fillRect(Math.round(p.x - 4 + ox), Math.round(p.y - 8 + oy), 8, 8); return; }
    const ax = info ? info.ax : c.width / 2, ay = info ? info.ay : c.height - 1;
    ctx.drawImage(c, Math.round(p.x - ax + ox), Math.round(p.y - ay + oy));
    if (p.heart > 0) { const x = Math.round(p.x + ox), y = Math.round(p.y - ay - 6 + oy - (1.2 - p.heart) * 8); ctx.fillStyle = '#e8607e'; ctx.fillRect(x - 3, y, 2, 2); ctx.fillRect(x + 1, y, 2, 2); ctx.fillRect(x - 2, y + 2, 4, 1); ctx.fillRect(x - 1, y + 3, 2, 1); }
  }
  Mg.petAt = function (map, tx, ty, wx, wy) {
    const pl = W().player, near = (q) => q.map === map.id && ((Math.floor(q.x / 16) === tx && Math.floor((q.y - 3) / 16) === ty) || (wx != null && Math.abs(wx - q.x) < 10 && wy > q.y - 16 && wy < q.y + 3)) && Math.hypot(q.x - pl.x, q.y - pl.y) < 40;
    return Mg.pets.find(near) || (map.id === 'menagerie' ? Mg.shopPets.find(near) : null) || null;
  };
  Mg.interact = async function (map, tx, ty, wx, wy) {
    const S = st(), p = Mg.petAt(map, tx, ty, wx, wy);
    if (!p) return false;
    if (Mg.shopPets.includes(p)) {
      p.heart = 1.2; p.state = 'idle'; p.t = 3;
      G.sfx(p.id === 'pet_kitten' ? 'cat_meow' : 'animal_purr', { volume: 0.5 });
      G.UI.toast(`The ${G.item(p.id).name.toLowerCase()} loves the attention. Caspian sells them at the counter.`, p.id);
      return true;
    }
    const it = G.item(p.id), love = S.petLove[p.id] || (S.petLove[p.id] = { pts: 0, day: -1 });
    const follow = S.petOut === p.id;
    const choices = [{ label: 'Pet', value: 'pet' }];
    if (G.Inv.has('pet_treat')) choices.push({ label: 'Give a treat', value: 'treat' });
    choices.push(follow ? { label: 'Stay at the cottage', value: 'stay' } : { label: 'Come with me', value: 'follow' });
    choices.push({ label: 'Never mind', value: 'bye' });
    const hearts = Math.min(5, Math.floor(love.pts / 100));
    const v = await G.UI.say(null, [`${it.name} looks up at you. ${'♥'.repeat(hearts)}${'♡'.repeat(5 - hearts)}`], { choices });
    if (v === 'pet') {
      p.heart = 1.2; G.sfx(p.id === 'pet_puppy' ? 'animal_purr' : p.id === 'pet_kitten' ? 'cat_meow' : 'animal_purr', { volume: 0.6 });
      if (love.day !== S.day) { love.day = S.day; love.pts = Math.min(500, love.pts + 25); S.energy = Math.min(S.maxEnergy, S.energy + 5); G.UI.toast(`${it.name} leans into your hand.`, p.id); }
    } else if (v === 'treat') { G.Inv.remove('pet_treat', 1); p.heart = 1.6; love.pts = Math.min(500, love.pts + 40); G.sfx('eat', { volume: 0.5 }); G.UI.toast(`${it.name} crunches the treat happily.`, p.id); }
    else if (v === 'stay') { S.petOut = null; Mg.place(); G.UI.toast(`${it.name} trots home to the cottage.`, p.id); }
    else if (v === 'follow') { S.petOut = p.id; Mg.place(); G.UI.toast(`${it.name} will follow you.`, p.id); }
    return true;
  };

  // ---------------------------------------------------------------- mounts
  Mg.riding = () => !!Mg.ride;
  Mg.flying = () => !!(Mg.ride && Mg.ride.kind === 'dragon' && Mg.alt > 3);
  Mg.speedMult = function () {
    if (!Mg.ride) return 1;
    const S = st(), gear = (S.gear.saddle_starlit ? 0.3 : S.gear.saddle_swift ? 0.15 : 0);
    if (Mg.ride.kind === 'dragon') return Mg.flying() ? 2.3 + (S.gear.dragon_harness ? 0.35 : 0) + gear * 0.5 : 0.6;
    return 1.7 + gear;
  };
  Mg.toggleRide = function () {
    const S = st(), w = W(), map = w.map, p = w.player;
    if (Mg.ride) { Mg.dismount(); return; }
    if (Mg.calling) return;
    if (!S.mounts.length) { G.UI.toastOnce('nomount', "You don't have a mount yet. Caspian sells horses and dragons at the Menagerie in the south quarter.", 6); return; }
    if (!canRideHere(map)) { G.UI.toastOnce('noride', map && map.id === 'depths' ? 'Mounts won\'t come down into the Depths.' : 'Your mount waits outside.', 4); return; }
    if (p.action || w.inputLocked()) return;
    const id = S.mountSel || S.mounts[0], kind = kindOf(id);
    if (S.gear.silver_whistle) { G.sfx('mystery_chime', { volume: 0.5 }); G.R.burst(p.x, p.y - 10, 14, { colors: ['#e4d2ff', '#ffffff', '#ffd27a'], speed: 40, life: 0.6, grav: -20 }); Mg.mount(id); return; }
    // without the whistle it comes running (or swooping) in from off-screen
    const a = Math.random() * Math.PI * 2, r = 150;
    Mg.calling = { id, kind, x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.6, t: 0, alt: kind === 'dragon' ? 26 : 0 };
    G.sfx(kind === 'dragon' ? 'bat_flap' : 'cloth_rustle', { volume: 0.4, pitch: 0.6 });
  };
  Mg.mount = function (id) {
    const kind = kindOf(id);
    Mg.ride = { id, kind, t: 0 }; Mg.calling = null;
    Mg.alt = 0; Mg.wantAlt = kind === 'dragon' ? (st().gear.dragon_harness ? 30 : 22) : 0;
    G.sfx('cloth_rustle', { volume: 0.6 });
    if (kind === 'dragon') { G.Mobs.fx('wing_gust', W().player.x, W().player.y - 4, { sortY: W().player.y + 2 }); G.sfx('bat_flap', { volume: 0.5, pitch: 0.55 }); }
  };
  Mg.dismount = function (force) {
    const w = W(), p = w.player, map = w.map;
    if (!Mg.ride) return true;
    if (Mg.ride.kind === 'dragon' && Mg.alt > 0 && !force) {
      const [tx, ty] = p.feetTile;
      if (map.blocked(tx, ty) || map.isWater(tx, ty) || map.tobj.has(map.idx(tx, ty))) { G.UI.toastOnce('noland', 'No room to land here. Find a clear patch of ground.', 2); return false; }
      Mg.wantAlt = 0; Mg.landing = true; return true;
    }
    Mg.ride = null; Mg.alt = 0; Mg.landing = false; setZoom(0);
    G.sfx('cloth_rustle', { volume: 0.5 });
    return true;
  };
  let zoomed = 0;
  function setZoom(z) { if (zoomed === z) return; zoomed = z; G.R.flyZoom = z; G.R.resize(); }

  Mg.update = function (dt) {
    const w = W(), map = w.map, p = w.player; if (!map || !p || !G.S) return;
    // pets on this map
    for (const q of Mg.pets) if (q.map === map.id) updatePet(q, dt, map);
    // the paddock animals, and Caspian's pets pottering about the shop
    if (map.id === 'village') for (const a of Mg.paddock) updatePaddock(a, dt, map);
    if (map.id === 'menagerie') for (const q of Mg.shopPets) updateShopPet(q, dt, map);
    // a mount on its way to you
    const c = Mg.calling;
    if (c) {
      c.t += dt;
      const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy), sp = (c.kind === 'dragon' ? 170 : 150) * dt;
      if (d <= sp + 2 || c.t > 3) { Mg.mount(c.id); }
      else { c.x += (dx / d) * sp; c.y += (dy / d) * sp; c.dir = G.dirFromVec(dx, dy); if (c.kind === 'dragon') c.alt = Math.max(0, 26 * (d / 150)); else if (Math.random() < dt * 12) G.Mobs.fx('gallop_dust', c.x, c.y, { sortY: c.y - 1 }); }
      if (!canRideHere(map)) Mg.calling = null;
    }
    const r = Mg.ride;
    if (!r) return;
    r.t += dt;
    if (!canRideHere(map)) { Mg.dismount(true); return; }
    // climbing and descending
    if (Mg.alt !== Mg.wantAlt) {
      const k = dt * (Mg.wantAlt > Mg.alt ? 40 : 34);
      Mg.alt = Mg.wantAlt > Mg.alt ? Math.min(Mg.wantAlt, Mg.alt + k) : Math.max(Mg.wantAlt, Mg.alt - k);
      if (Mg.landing && Mg.alt <= 0) { G.Mobs.fx('wing_gust', p.x, p.y - 4, { sortY: p.y + 2 }); Mg.ride = null; Mg.landing = false; setZoom(0); return; }
    }
    setZoom(Mg.flying() ? -1 : 0);
    if (r.kind === 'horse' && p.moving) { r.dust = (r.dust || 0) - dt; if (r.dust <= 0) { r.dust = 0.14; const d = G.DIRS[p.dir] || [0, 0]; G.Mobs.fx('gallop_dust', p.x - d[0] * 8, p.y, { sortY: p.y - 1 }); } }
  };
  Mg.onMapChange = function (map) {
    if (Mg.ride && !canRideHere(map)) Mg.dismount(true);
    Mg.calling = null;
    Mg.place();
    if (map && map.id === 'village' && !Mg.paddock.length) seedPaddock(map);
    if (map && map.id === 'menagerie' && !Mg.shopPets.length) Mg.shopPets = ['pet_kitten', 'pet_puppy', 'pet_bunny'].map((id, i) => { const q = new Pet(id); q.map = 'menagerie'; q.x = (3 + i * 4) * 16; q.y = (7 + (i % 2)) * 16; q.state = i === 0 ? 'sleep' : 'idle'; q.t = 2 + i * 2; return q; });
  };
  Mg.shopPets = [];
  const SHOP = [2, 6, 12, 3]; // the open floor of the Menagerie
  function updateShopPet(q, dt, map) {
    q.ft += dt; q.t -= dt;
    if (q.state === 'walk') {
      const dx = q.tx - q.x, dy = q.ty - q.y, d = Math.hypot(dx, dy);
      if (d < 2 || q.t <= 0) { q.state = Math.random() < 0.35 ? 'sleep' : 'idle'; q.t = 3 + Math.random() * 7; }
      else { G.moveBody(q, (dx / d) * 24 * dt, (dy / d) * 24 * dt, map); q.flip = dx < 0; }
      q.anim = 'walk';
    } else {
      q.anim = q.state === 'sleep' ? 'sleep' : 'idle';
      if (q.t <= 0) { q.state = 'walk'; q.tx = (SHOP[0] + Math.random() * SHOP[2]) * 16; q.ty = (SHOP[1] + Math.random() * SHOP[3]) * 16; q.t = 6; }
    }
  }

  // ---------------------------------------------------------------- drawing
  function mountParts(id, anim, dir, frame) { try { return MA().mount(G.altArt(id), anim, dir, frame); } catch (e) { return null; } }
  function mountInfo(id) { try { return MA().mountInfo(G.altArt(id)); } catch (e) { return null; } }
  const shadowK = (id) => { const i = mountInfo(id); return i ? Math.max(1, i.w / 48) : 1; }; // bigger dragons cast bigger shadows
  function shadow(ctx, x, y, w, a) { ctx.globalAlpha = a; ctx.fillStyle = '#0e0818'; ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), w, w * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  // the player riding: the mount behind, the rider in the saddle, the near side of the mount in front
  Mg.drawRider = function (ctx, p, ox, oy) {
    const r = Mg.ride, info = mountInfo(r.id);
    if (!info) return false;
    const anim = r.kind === 'dragon' ? (Mg.alt > 3 ? 'fly' : 'idle') : (p.moving ? 'walk' : 'idle');
    const n = (info.anims && info.anims[anim]) || 2, fps = (info.fps && info.fps[anim]) || 6;
    const frame = Math.floor(r.t * fps) % n;
    const parts = mountParts(r.id, anim, p.dir, frame); if (!parts) return false;
    const lift = Math.round(Mg.alt);
    const x0 = Math.round(p.x - info.ax + ox), y0 = Math.round(p.y - info.ay - lift + oy);
    if (p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.drawImage(parts.back, x0, y0);
    const sdy = (info.seatDy && info.seatDy[anim] && info.seatDy[anim][frame]) || 0;
    let rider = null; try { rider = window.CharArt && CharArt.playerRide ? CharArt.playerRide(G.S.look, p.dir, frame % 2) : null; } catch (e) { rider = null; }
    const ri = (window.CharArt && CharArt.rideInfo) || { ax: 10, ay: 26 };
    if (rider) ctx.drawImage(rider, Math.round(x0 + info.seat.x - ri.ax), Math.round(y0 + info.seat.y + sdy - ri.ay));
    if (parts.front) ctx.drawImage(parts.front, x0, y0);
    ctx.globalAlpha = 1;
    return true;
  };
  Mg.drawables = function (map, list) {
    const w = W(), p = w.player;
    for (const q of Mg.pets) if (q.map === map.id) list.push({ sortY: q.y, draw: (c, ox, oy) => drawPet(c, q, ox, oy) });
    if (map.id === 'menagerie') for (const q of Mg.shopPets) list.push({ sortY: q.y, draw: (c, ox, oy) => drawPet(c, q, ox, oy) });
    if (map.id === 'village') for (const a of Mg.paddock) list.push({ sortY: a.y, draw: (c, ox, oy) => drawMountAt(c, a.id, a.anim, a.dir, a.t, a.x, a.y, 0, ox, oy) });
    if (Mg.ride && Mg.alt > 0) list.push({ sortY: p.y - 2, draw: (c, ox, oy) => shadow(c, p.x + ox, p.y + oy, (12 - Math.min(5, Mg.alt / 6)) * shadowK(Mg.ride.id), 0.32 - Math.min(0.14, Mg.alt / 200)) });
    const c = Mg.calling;
    if (c) {
      if (c.alt > 0) list.push({ sortY: c.y - 2, draw: (cx, ox, oy) => shadow(cx, c.x + ox, c.y + oy, 11 * shadowK(c.id), 0.25) });
      list.push({ sortY: c.alt > 6 ? 1e5 : c.y, draw: (cx, ox, oy) => drawMountAt(cx, c.id, c.kind === 'dragon' ? 'fly' : 'walk', c.dir || 'down', c.t, c.x, c.y, c.alt, ox, oy) });
    }
  };
  function drawMountAt(ctx, id, anim, dir, t, x, y, alt, ox, oy) {
    const info = mountInfo(id); if (!info) return;
    const n = (info.anims && info.anims[anim]) || 2, fps = (info.fps && info.fps[anim]) || 4;
    const parts = mountParts(id, anim, dir, Math.floor(t * fps) % n); if (!parts) return;
    const x0 = Math.round(x - info.ax + ox), y0 = Math.round(y - info.ay - (alt || 0) + oy);
    ctx.drawImage(parts.back, x0, y0); if (parts.front) ctx.drawImage(parts.front, x0, y0);
  }

  // ---------------------------------------------------------------- Caspian's paddock
  function seedPaddock(map) {
    const r = map.paddock; if (!r) return;
    Mg.paddock = [
      { id: 'horse_chestnut', x: (r[0] + 2) * 16, y: (r[1] + 4) * 16, dir: 'right', anim: 'idle', t: 0, wait: 2 },
      { id: 'horse_silver', x: (r[0] + 5) * 16, y: (r[1] + 7) * 16, dir: 'left', anim: 'idle', t: 1, wait: 5 },
      { id: 'dragon_emerald', x: (r[0] + 5.5) * 16, y: (r[1] + 3.2) * 16, dir: 'down', anim: 'idle', t: 0, wait: 1e9, still: true },
    ];
  }
  function updatePaddock(a, dt, map) {
    a.t += dt;
    if (a.still) return;
    if (a.anim === 'walk') {
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d < 2) { a.anim = 'idle'; a.wait = 3 + Math.random() * 6; return; }
      a.x += (dx / d) * 18 * dt; a.y += (dy / d) * 18 * dt; a.dir = G.dirFromVec(dx, dy);
    } else if ((a.wait -= dt) <= 0) {
      const r = map.paddock; a.tx = (r[0] + 1 + Math.random() * (r[2] - 2)) * 16; a.ty = (r[1] + 2 + Math.random() * (r[3] - 3)) * 16; a.anim = 'walk';
    }
  }
  Mg.paddockAt = function (map, wx, wy) { return map.id === 'village' && Mg.paddock.find((a) => Math.abs(a.x - wx) < 14 && wy > a.y - 26 && wy < a.y + 4); };

  G.on('mapChanged', (map) => Mg.onMapChange(map));
})();
