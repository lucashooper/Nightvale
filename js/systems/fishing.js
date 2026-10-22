// Nightvale — fishing: cast, wait for a bite, then a reeling minigame (keep the catch bar on the fish).
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const F = (G.Fishing = { state: 'idle' });
  const BAR_H = 260;

  function pickFish(map) {
    const S = G.S, night = S.mins >= 1200 || S.mins < 360, w = G.World.weather;
    const pool = [];
    for (const id in G.ITEMS) {
      const it = G.ITEMS[id]; if (!it.fish) continue;
      const f = it.fish;
      if (f.night && !night) continue;
      if (f.weather && !f.weather.includes(w)) continue;
      if (f.moon === 'full' && !G.isFullMoon()) continue;
      let weight = f.w;
      if (map.id !== 'lake' && (id === 'fish_crownjaw' || id === 'fish_lanternpike')) continue;
      if (map.id === 'woods' && id === 'fish_ghosteel') weight *= 2;
      pool.push([id, weight]);
    }
    let tot = pool.reduce((a, p) => a + p[1], 0), x = Math.random() * tot;
    for (const [id, wgt] of pool) { x -= wgt; if (x <= 0) return id; }
    return 'fish_glimmerfin';
  }

  F.cast = function (tx, ty) {
    const W = G.World, p = W.player, map = W.map, S = G.S;
    if (F.state !== 'idle') { F.cancel(); return true; }
    const d = G.DIRS[p.dir], [fx, fy] = p.feetTile;
    let target = null;
    for (let k = 1; k <= 4; k++) { const x = fx + d[0] * k, y = fy + d[1] * k; if (map.isWater(x, y)) { target = [x, y]; if (k >= 2) break; } else if (target) break; }
    if (!target) { G.UI.toast('Face open water to cast your line.'); G.sfx('error'); return false; }
    if (S.energy <= 0) { G.UI.toast("You're too tired to fish."); return false; }
    S.energy = Math.max(0, S.energy - 3);
    F.state = 'cast'; F.t = 0; F.map = map;
    F.bx = target[0] * 16 + 8; F.by = target[1] * 16 + 8;
    F.sx = p.x + d[0] * 6; F.sy = p.y - 16;
    p.startAction('fish', { item: 'rod', dur: 1e9, hitAt: 0.05 });
    G.sfx('sword_swing', { pitch: 0.8, volume: 0.6 });
    return true;
  };
  F.cancel = function (msg) {
    if (F.state === 'idle') return;
    F.state = 'idle';
    const p = G.World.player; if (p.action && p.action.kind === 'fish') p.action = null;
    if (F.ui) { F.ui.remove(); F.ui = null; }
    if (msg) G.UI.toast(msg);
  };

  F.update = function (dt) {
    if (F.state === 'idle') return;
    const W = G.World, I = G.Input, p = W.player;
    if (W.map !== F.map) { F.cancel(); return; }
    F.t += dt;
    const pressed = I.hit('use') || I.hit('interact') || I.mouse.pressed[0] || I.mouse.pressed[2];
    const moving = I.axis()[0] || I.axis()[1];
    if (F.state === 'cast') {
      if (F.t >= 0.55) { F.state = 'wait'; F.t = 0; F.wait = (2 + Math.random() * 5) * (G.S.buffs.tide > 0 ? 0.55 : 1); G.sfx('splash'); G.R.burst(F.bx, F.by, 8, { colors: ['#c4e6ff', '#69a1db'], speed: 30, life: 0.4, grav: 60, up: 30 }); }
      return;
    }
    if (F.state === 'wait') {
      if (moving || (pressed && F.t > 0.3)) { F.cancel(); return; }
      if (F.t >= F.wait) { F.state = 'bite'; F.t = 0; G.sfx('fish_bite'); G.R.burst(F.bx, F.by, 6, { colors: ['#ffffff', '#c4e6ff'], speed: 25, life: 0.3, up: 20 }); }
      return;
    }
    if (F.state === 'bite') {
      if (pressed) { startReel(); return; }
      if (F.t > 0.95) { F.cancel('It got away before you could set the hook.'); G.sfx('fish_escape'); }
      return;
    }
    if (F.state === 'reel') reelUpdate(dt);
  };

  function startReel() {
    F.state = 'reel'; F.t = 0;
    F.fish = pickFish(F.map);
    const def = G.item(F.fish).fish;
    F.diff = def.diff; F.motion = def.motion;
    F.fy = BAR_H * 0.6; F.ftarget = F.fy; F.fv = 0;
    F.barH = Math.round((G.S.buffs.tide > 0 ? 92 : 70) + 5 * G.Stats.get('fishing') - def.diff * 18);
    F.by2 = BAR_H - F.barH; F.bv = 0;
    F.progress = 0.3;
    const ui = G.UI.el('div', 'panel fish-ui');
    ui.style.cssText += ';padding:12px;display:flex;gap:10px;align-items:flex-end;z-index:6';
    ui.innerHTML = `<canvas width="44" height="${BAR_H}" style="width:44px;height:${BAR_H}px;image-rendering:pixelated;border-radius:6px"></canvas><div style="width:10px;height:${BAR_H}px;background:#0e0919;border:2px solid #120c1c;border-radius:4px;position:relative;overflow:hidden"><i style="position:absolute;left:0;right:0;bottom:0;background:linear-gradient(180deg,#b4ffd9,#2fbf7f)"></i></div>`;
    G.UI.root.appendChild(ui);
    F.ui = ui; F.cv = ui.querySelector('canvas'); F.pbar = ui.querySelector('i');
    G.sfx('reel_tick');
  }

  function reelUpdate(dt) {
    const I = G.Input, d = F.diff;
    // fish motion
    F.mt = (F.mt || 0) - dt;
    if (F.mt <= 0) {
      const r = Math.random();
      if (F.motion === 'dart') { F.ftarget = r < 0.5 ? Math.random() * (BAR_H - 16) : F.fy + (Math.random() - 0.5) * 140; F.mt = 0.3 + Math.random() * (1 - d) * 1.2; }
      else if (F.motion === 'sinker') { F.ftarget = U.clamp(F.fy + (Math.random() * 120 - 40), 0, BAR_H - 16); F.mt = 0.5 + Math.random(); }
      else if (F.motion === 'mixed') { F.ftarget = Math.random() * (BAR_H - 16); F.mt = 0.5 + Math.random() * 1.2; }
      else { F.ftarget = BAR_H / 2 + Math.sin(F.t * 1.3) * (BAR_H / 2 - 20); F.mt = 0.2; }
      F.ftarget = U.clamp(F.ftarget, 0, BAR_H - 16);
    }
    const accel = 6 + d * 16;
    F.fv += (F.ftarget - F.fy) * accel * dt;
    F.fv *= Math.pow(0.02 + (1 - d) * 0.08, dt);
    F.fy = U.clamp(F.fy + F.fv * dt, 0, BAR_H - 16);
    // catch bar: hold to rise
    const hold = I.down('use') || I.down('interact') || I.mouse.down[0] || I.mouse.down[2];
    F.bv += (hold ? -520 : 420) * dt;
    F.bv = U.clamp(F.bv, -260, 300);
    F.by2 += F.bv * dt;
    if (F.by2 < 0) { F.by2 = 0; F.bv = 0; }
    if (F.by2 > BAR_H - F.barH) { F.by2 = BAR_H - F.barH; F.bv = -F.bv * 0.35; }
    const inside = F.fy + 8 > F.by2 && F.fy + 8 < F.by2 + F.barH;
    F.progress += (inside ? 0.32 : -0.2 - d * 0.12) * dt;
    if (inside && Math.random() < dt * 6) G.sfx('reel_tick', { volume: 0.4 });
    // draw
    const c = F.cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    const g = c.createLinearGradient(0, 0, 0, BAR_H); g.addColorStop(0, '#2e4f9f'); g.addColorStop(1, '#17224c');
    c.fillStyle = g; c.fillRect(0, 0, 44, BAR_H);
    c.fillStyle = inside ? 'rgba(93,255,176,0.55)' : 'rgba(185,154,238,0.45)';
    c.fillRect(4, Math.round(F.by2), 36, F.barH);
    c.fillStyle = inside ? '#b4ffd9' : '#e4d2ff'; c.fillRect(4, Math.round(F.by2), 36, 2); c.fillRect(4, Math.round(F.by2 + F.barH - 2), 36, 2);
    const ic = G.icon(F.fish);
    c.drawImage(ic, 6, Math.round(F.fy) - 8, 32, 32);
    F.pbar.style.height = Math.round(U.clamp(F.progress, 0, 1) * 100) + '%';
    if (F.progress >= 1) catchFish();
    else if (F.progress <= 0) { F.cancel('The fish slipped the hook.'); G.sfx('fish_escape'); }
  }

  function catchFish() {
    const S = G.S, id = F.fish, p = G.World.player;
    F.cancel();
    if (!G.Inv.canAdd(id, 1)) { G.dropItem(G.World.map, id, 1, p.x, p.y - 4, { delay: 2 }); }
    else { G.Inv.add(id, 1); G.UI.toastItem(id, 1); }
    S.stats.fish = (S.stats.fish || 0) + 1;
    p.holdItem = id; p.holdT = 1.4;
    G.sfx('fish_catch');
    if (G.item(id).sell >= 250) G.jingle('discovery');
    G.R.burst(p.x, p.y - 30, 12, { colors: ['#c4e6ff', '#ffffff', '#69a1db'], speed: 40, life: 0.6, grav: 60, up: 20 });
    G.emit('fish', id);
  }

  // bobber + line drawn in the world
  F.drawables = function (list) {
    if (F.state === 'idle' || G.World.map !== F.map) return;
    const p = G.World.player;
    list.push({
      sortY: F.by + 4,
      draw(ctx, ox, oy) {
        let bx = F.bx, by = F.by;
        if (F.state === 'cast') { const k = Math.min(1, F.t / 0.55); bx = U.lerp(F.sx, F.bx, k); by = U.lerp(F.sy, F.by, k) - Math.sin(k * Math.PI) * 26; }
        else by += Math.sin(G.R.time * 3) * 0.8 + (F.state === 'bite' ? Math.sin(G.R.time * 40) * 1.5 + 2 : 0);
        const rx = p.x + (p.dir === 'left' ? -12 : p.dir === 'right' ? 12 : 4), ry = p.y - 30;
        ctx.strokeStyle = 'rgba(230,230,255,0.75)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(Math.round(rx + ox) + 0.5, Math.round(ry + oy) + 0.5);
        ctx.quadraticCurveTo((rx + bx) / 2 + ox, Math.max(ry, by) + 10 + oy, Math.round(bx + ox) + 0.5, Math.round(by + oy) + 0.5); ctx.stroke();
        ctx.fillStyle = '#120c1c'; ctx.fillRect(Math.round(bx - 2 + ox), Math.round(by - 3 + oy), 4, 5);
        ctx.fillStyle = '#ff6f8a'; ctx.fillRect(Math.round(bx - 1 + ox), Math.round(by - 2 + oy), 2, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(bx - 1 + ox), Math.round(by + oy), 2, 1);
        if (F.state === 'bite') {
          const x = Math.round(p.x + ox), y = Math.round(p.y - 46 + oy);
          ctx.fillStyle = '#120c1c'; ctx.fillRect(x - 3, y - 1, 6, 12);
          ctx.fillStyle = '#ffd27a'; ctx.fillRect(x - 2, y, 4, 7); ctx.fillRect(x - 2, y + 8, 4, 2);
        }
      },
    });
  };
})();
