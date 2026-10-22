// Nightvale — shared entity helpers, the player, item pickups and projectiles.
(function () {
  'use strict';
  const G = window.G, U = G.U;

  // ---------------------------------------------------------------- art adapters (graceful fallbacks)
  const fallbackCache = new Map();
  function fallbackChar(look, key) {
    if (fallbackCache.has(key)) return fallbackCache.get(key);
    const skin = ['#ecd3d9', '#ebb79a', '#cf9670', '#9e6646', '#6e4630', '#d9dcef'][look.skin || 0];
    const hair = ['#d8d4e8', '#2a2238', '#e07a3a', '#a8442e', '#6a4630', '#4f8a52', '#eceaf4', '#6a2e6a'][look.hairColor || 0];
    const robe = ['#2e3a7a', '#6a2e5e', '#2f5a3a', '#2a6a6a', '#7a2a3a', '#4a4a62', '#9a7a2a', '#1c1c3a'][look.robe || 0];
    const mk = (dir, f, use) => {
      const P = new G.Pix(20, 32);
      const bob = f % 2 === 1 ? 1 : 0;
      P.shadow(10, 31, 6, 2);
      // legs
      const legL = f === 1 ? -1 : f === 3 ? 1 : 0;
      P.rect(7, 26 + Math.max(0, legL), 2, 4 - Math.max(0, legL), '#2a2238'); P.rect(11, 26 + Math.max(0, -legL), 2, 4 - Math.max(0, -legL), '#2a2238');
      // robe
      for (let y = 16 + bob; y < 28; y++) { const half = 4 + Math.floor((y - 16) / 4); for (let x = -half; x < half; x++) P.set(10 + x, y, x < -half + 2 ? U.mix(robe, '#ffffff', 0.15) : robe); }
      P.hline(6, 13, 21 + bob, '#3e2d2b');
      // head
      P.disc(10, 11 + bob, 5, 5, skin);
      if (dir !== 'up') { P.set(8, 12 + bob, '#120c1c'); P.set(12, 12 + bob, '#120c1c'); if (dir === 'left') { P.set(12, 12 + bob, skin); } if (dir === 'right') { P.set(8, 12 + bob, skin); } }
      // hair
      for (let y = 5; y < 11; y++) for (let x = 4; x < 17; x++) if ((x - 10) ** 2 / 36 + (y - 10) ** 2 / 25 < 1 && (y < 9 || dir === 'up' || x < 6 || x > 14)) P.set(x, y + bob, hair);
      if (use) { const hx = dir === 'left' ? 4 : dir === 'right' ? 16 : 14; P.rect(hx - 1, 17 + bob, 2, 2, skin); }
      P.outline('#120c1c');
      return P.canvas();
    };
    const set = { w: 20, h: 32, ax: 10, ay: 31, walk: {}, use: {}, hand: {} };
    for (const d of ['down', 'up', 'left', 'right']) {
      set.walk[d] = [0, 1, 2, 3].map((f) => mk(d, f));
      set.use[d] = [mk(d, 0, true), mk(d, 2, true)];
      const hx = d === 'left' ? 4 : d === 'right' ? 16 : 14;
      set.hand[d] = [[hx, 14], [hx, 19]];
    }
    fallbackCache.set(key, set);
    return set;
  }
  G.playerSprites = function (look) {
    const key = JSON.stringify(look || {});
    try { if (window.CharArt && CharArt.playerSprites) { const s = CharArt.playerSprites(look); if (s && s.walk) return s; } } catch (e) { console.warn('CharArt.playerSprites failed', e); }
    return fallbackChar(look || {}, 'p' + key);
  };
  const NPC_FALLBACK_LOOK = { mirabel: { skin: 1, hairColor: 0, robe: 2 }, pip: { skin: 1, hairColor: 2, robe: 1 }, sable: { skin: 4, hairColor: 1, robe: 4 }, brann: { skin: 2, hairColor: 3, robe: 5 }, orvyn: { skin: 0, hairColor: 6, robe: 0 }, elowen: { skin: 2, hairColor: 5, robe: 2 }, grizelda: { skin: 5, hairColor: 1, robe: 7 }, corvin: { skin: 0, hairColor: 1, robe: 7 }, lune: { skin: 3, hairColor: 0, robe: 3 } };
  G.npcSprites = function (id) {
    try { if (window.CharArt && CharArt.npcSprites) { const s = CharArt.npcSprites(id); if (s && s.walk) return s; } } catch (e) { console.warn('CharArt.npcSprites failed', e); }
    return fallbackChar(NPC_FALLBACK_LOOK[id] || {}, 'n' + id);
  };
  const iconFallback = new Map();
  G.icon = function (id) {
    try {
      if (window.FurnitureArt && G.item(id).cat === 'furniture') { const c = FurnitureArt.icon(id); if (c) return c; }
      if (window.ItemArt) {
        const it = G.item(id);
        if (it.tool && it.tool !== 'rod' && ItemArt.toolIcon && G.S && G.S.toolTier) { const c = ItemArt.toolIcon(it.tool, G.S.toolTier[it.tool] || 0); if (c) return c; }
        if (it.iconOf && ItemArt.icon) { const c = ItemArt.icon(it.iconOf); if (c) return c; }
        if (ItemArt.icon) { const c = ItemArt.icon(id); if (c) return c; }
      }
    } catch (e) { /* fall through */ }
    if (iconFallback.has(id)) return iconFallback.get(id);
    const P = new G.Pix(16, 16), it = G.item(id);
    const col = { tool: '#9fb0d8', weapon: '#c4c3d6', seed: '#b99aee', crop: '#5dffb0', forage: '#e89ab8', resource: '#9c7a5e', ore: '#a09fb6', gem: '#b99aee', loot: '#74b46e', fish: '#69a1db', potion: '#ff8ab0', food: '#ffbc62', place: '#c08a3a', misc: '#e8eeff' }[it.cat] || '#ffffff';
    if (it.cat === 'potion') { P.rect(6, 2, 4, 3, '#c4c3d6'); P.disc(8, 10, 5, 5, col); } else if (it.cat === 'tool' || it.cat === 'weapon') { P.line(3, 13, 12, 4, col); P.line(3, 12, 11, 4, '#ffffff'); } else P.disc(8, 8, 6, 6, col);
    P.outline('#120c1c');
    const c = P.canvas(); iconFallback.set(id, c); return c;
  };

  // ---------------------------------------------------------------- movement with collision + corner sliding
  G.moveBody = function (e, dx, dy, map) {
    const bw = e.bw, bh = e.bh;
    const box = (x, y) => [x - bw / 2, y - bh, bw, bh];
    let hitX = false, hitY = false;
    if (dx) {
      const nx = e.x + dx;
      const [bx, by] = box(nx, e.y);
      if (!map.rectBlocked(bx, by, bw, bh, e)) e.x = nx;
      else {
        hitX = true;
        // corner assist: slide vertically if a small nudge frees the way
        if (!dy && e.slide !== false) for (const n of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
          const [bx2, by2] = box(nx, e.y + n);
          if (!map.rectBlocked(bx2, by2, bw, bh, e) && !map.rectBlocked(...box(e.x, e.y + Math.sign(n)), e)) { e.y += Math.sign(n) * Math.min(Math.abs(dx), 1); break; }
        }
      }
    }
    if (dy) {
      const ny = e.y + dy;
      const [bx, by] = box(e.x, ny);
      if (!map.rectBlocked(bx, by, bw, bh, e)) e.y = ny;
      else {
        hitY = true;
        if (!dx && e.slide !== false) for (const n of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
          const [bx2, by2] = box(e.x + n, ny);
          if (!map.rectBlocked(bx2, by2, bw, bh, e) && !map.rectBlocked(...box(e.x + Math.sign(n), e.y), e)) { e.x += Math.sign(n) * Math.min(Math.abs(dy), 1); break; }
        }
      }
    }
    return hitX || hitY;
  };

  // ---------------------------------------------------------------- player
  class Player {
    constructor() {
      this.x = 0; this.y = 0; this.bw = 10; this.bh = 6;
      this.dir = 'down'; this.frame = 0; this.animT = 0; this.moving = false;
      this.action = null; // {kind, t, dur, dir, item, fired}
      this.invuln = 0; this.kb = [0, 0]; this.flash = 0;
      this.holdItem = null; this.holdT = 0;
      this.stepT = 0; this.light = null;
    }
    get feetTile() { return [Math.floor(this.x / 16), Math.floor((this.y - 3) / 16)]; }
    facingTile() {
      const [tx, ty] = this.feetTile, d = G.DIRS[this.dir];
      return [tx + d[0], ty + d[1]];
    }
    sprites() {
      const key = JSON.stringify(G.S.look);
      if (this._sprKey !== key) { this._spr = G.playerSprites(G.S.look); this._sprKey = key; }
      return this._spr;
    }
    update(dt, map) {
      const S = G.S;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.holdT > 0) { this.holdT -= dt; if (this.holdT <= 0) this.holdItem = null; }
      // knockback
      if (Math.abs(this.kb[0]) + Math.abs(this.kb[1]) > 0.5) {
        G.moveBody(this, this.kb[0] * dt, 0, map); G.moveBody(this, 0, this.kb[1] * dt, map);
        this.kb[0] *= Math.pow(0.0008, dt); this.kb[1] *= Math.pow(0.0008, dt);
      }
      if (this.action) {
        const a = this.action;
        a.t += dt;
        if (a.kind === 'pour') this.pourStream(dt, a);
        if (!a.fired && a.t >= a.hitAt) { a.fired = true; if (a.onHit) a.onHit(a); }
        if (a.t >= a.dur) this.action = null;
        this.moving = false;
        return;
      }
      if (G.World.inputLocked()) { this.moving = false; this.frame = 0; return; }
      let [ax, ay] = G.Input.axis();
      this.moving = !!(ax || ay);
      if (this.moving) {
        const len = Math.hypot(ax, ay); ax /= len; ay /= len;
        const Mg = G.Menagerie, riding = Mg && Mg.riding();
        let speed = 78 * G.Stats.speedMult() * (G.admin('fast') ? 1.8 : 1) * (riding ? Mg.speedMult() : 1);
        if (!riding && map.isWater && map.t(...this.feetTile) === G.MAT.BOG) speed *= 0.8;
        if (Math.abs(ax) > Math.abs(ay) + 0.01) this.dir = ax < 0 ? 'left' : 'right';
        else if (ay) this.dir = ay < 0 ? 'up' : 'down';
        if (Mg && Mg.flying()) { // over trees, water and rooftops: only the edge of the world stops you
          this.x = U.clamp(this.x + ax * speed * dt, 6, map.w * 16 - 6);
          this.y = U.clamp(this.y + ay * speed * dt, 10, map.h * 16 - 2);
        } else {
          G.moveBody(this, ax * speed * dt, 0, map);
          G.moveBody(this, 0, ay * speed * dt, map);
        }
        this.animT += dt * (riding ? 1 : speed / 78);
        this.frame = Math.floor(this.animT * 7) % 4;
        this.stepT -= dt;
        if (this.stepT <= 0) {
          this.stepT = 0.34;
          const m = map.t(...this.feetTile);
          const M = G.MAT;
          G.sfx(m === M.COBBLE || m === M.FLOOR || m === M.MOSSFLOOR || m === M.STAIRS || m === M.CAVEFLOOR || m === M.RUNEFLOOR || m === M.GRAVEL ? 'footstep_stone' : m === M.BRIDGE ? 'footstep_wood' : 'footstep_grass', { volume: 0.35 });
        }
      } else { this.frame = 0; this.animT = 0; }
    }
    startAction(kind, opts) {
      this.action = Object.assign({ kind, t: 0, dur: 0.34, hitAt: 0.17, dir: this.dir, fired: false }, opts);
    }
    hurt(dmg, fromX, fromY) {
      if (this.invuln > 0 || G.World.cutscene) return false;
      if (G.admin('god')) { this.invuln = 0.6; G.R.text(this.x, this.y - 26, '0', '#c8c0e0'); return false; }
      const S = G.S;
      if (S.buffs.ward > 0) dmg = Math.ceil(dmg * 0.6);
      dmg -= G.Stats.get('defense');
      dmg = Math.max(1, Math.round(dmg));
      S.hp -= dmg;
      this.invuln = 1.0;
      const dx = this.x - fromX, dy = this.y - fromY, len = Math.hypot(dx, dy) || 1;
      this.kb = [(dx / len) * 170, (dy / len) * 170];
      G.R.text(this.x, this.y - 26, '-' + dmg, '#ff7a7a');
      G.R.shake(2.5, 0.2);
      G.R.doFlash('180,30,60', 0.25);
      G.sfx('player_hurt');
      if (S.hp <= 0) { S.hp = 0; G.World.playerDied(); }
      return true;
    }
    draw(ctx, ox, oy) {
      if (G.Menagerie && G.Menagerie.riding() && G.Menagerie.drawRider(ctx, this, ox, oy)) return;
      const spr = this.sprites();
      let frame;
      const a = this.action;
      if (a && spr.use && (a.kind === 'tool' || a.kind === 'swing' || a.kind === 'cast' || a.kind === 'fish' || a.kind === 'pour')) {
        const f = a.t < a.hitAt ? 0 : 1;
        frame = spr.use[a.dir][a.kind === 'fish' || a.kind === 'cast' || a.kind === 'pour' ? 1 : f];
      } else frame = spr.walk[this.dir][this.moving ? this.frame : 0];
      if (this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.45;
      const px = Math.round(this.x - spr.ax + ox), py = Math.round(this.y - spr.ay + oy);
      const pose = a && a.item ? this.toolPose(spr, a) : null;
      if (pose && pose.behind) this.drawTool(ctx, ox, oy, pose);
      ctx.drawImage(frame, px, py);
      if (pose && !pose.behind) this.drawTool(ctx, ox, oy, pose);
      ctx.globalAlpha = 1;
      if (this.holdItem) {
        const ic = G.icon(this.holdItem);
        ctx.drawImage(ic, Math.round(this.x - 8 + ox), Math.round(this.y - 44 + oy - Math.sin(Math.min(1, (1.2 - this.holdT) * 4)) * 3));
      }
    }
    // where the held tool is and which way its shaft points
    toolPose(spr, a) {
      const f = a.kind === 'fish' || a.kind === 'cast' || a.kind === 'pour' ? 1 : a.t < a.hitAt ? 0 : 1;
      const hand = (spr.hand && spr.hand[a.dir] && spr.hand[a.dir][f]) || [10, 18];
      const A = TOOL_ANG[a.dir];
      let th;
      if (a.kind === 'pour') {
        // held out in front and tipped forward, with a little wobble while the water runs
        const [t0, t1] = POUR[a.dir], k = U.smooth(U.clamp(a.t / (a.dur * 0.45), 0, 1));
        th = U.lerp(t0, t1, k) + (k >= 1 ? Math.sin(a.t * 28) * 0.03 : 0);
        return { x: this.x - spr.ax + hand[0], y: this.y - spr.ay + hand[1] - 3, th, behind: a.dir === 'up', item: a.item };
      }
      if (a.kind === 'swing') { const k = U.clamp(a.t / (a.dur * 0.75), 0, 1); th = U.lerp(A.s0, A.s1, U.smooth(k)); }
      else if (a.kind === 'cast') th = A.cast;
      else if (a.kind === 'fish') th = A.fish;
      else th = f === 0 ? A.raise : A.hit;
      const behind = a.dir === 'up' || Math.sin(th) < -0.55;
      return { x: this.x - spr.ax + hand[0], y: this.y - spr.ay + hand[1], th, behind, item: a.item };
    }
    // droplets running from the can's spout down onto the soil
    pourStream(dt, a) {
      if (a.t < a.dur * 0.3 || a.t > a.dur * 0.9) return;
      const pose = this.toolPose(this.sprites(), a);
      const tipX = pose.x + Math.cos(pose.th) * 13, tipY = pose.y + Math.sin(pose.th) * 13;
      const floor = Math.max(tipY + 6, a.ty * 16 + 11);
      a.acc = (a.acc || 0) + dt * 75;
      while (a.acc >= 1) {
        a.acc -= 1;
        const sp = 18 + Math.random() * 14;
        G.R.emit({ x: tipX + (Math.random() - 0.5) * 2, y: tipY, vx: Math.cos(pose.th) * sp + (Math.random() - 0.5) * 8, vy: Math.max(0, Math.sin(pose.th)) * sp, grav: 340, life: 0.5, floor, drag: 0.99, color: U.pick(['#9fd0ff', '#c4e6ff', '#69a1db', '#e8f6ff']), size: 1 });
      }
    }
    drawTool(ctx, ox, oy, pose) {
      const icon = G.icon(pose.item);
      if (!icon) return;
      ctx.save();
      ctx.translate(Math.round(pose.x + ox), Math.round(pose.y + oy));
      ctx.rotate(pose.th + Math.PI / 4); // icons are drawn diagonally: grip bottom-left, head top-right
      if (Math.cos(pose.th) < -0.05) ctx.transform(0, -1, -1, 0, 0, 0); // mirror across the shaft when pointing left
      ctx.drawImage(icon, -3, -13);
      ctx.restore();
    }
  }
  const PI = Math.PI;
  // watering: from held level to tipped toward the soil in front
  const POUR = { down: [PI / 2 - 1.05, PI / 2 - 0.4], up: [-PI / 2 + 0.95, -PI / 2 + 0.45], right: [-0.3, 0.75], left: [PI + 0.3, PI - 0.75] };
  const TOOL_ANG = {
    down: { raise: -PI / 2 - 0.3, hit: PI / 2 - 0.3, s0: -0.25, s1: PI + 0.25, cast: PI / 2 - 0.15, fish: PI / 2 - 0.2 },
    up: { raise: -PI / 2 + 0.4, hit: -PI / 2 - 0.2, s0: 0.8 * PI, s1: 2.2 * PI, cast: -PI / 2 + 0.15, fish: -PI / 2 + 0.2 },
    right: { raise: -PI / 2 - 0.6, hit: 0.35, s0: -1.45, s1: 1.15, cast: -0.15, fish: -0.6 },
    left: { raise: -PI / 2 + 0.6, hit: PI - 0.35, s0: 1.5 * PI + 0.05, s1: 0.5 * PI - 0.65, cast: PI + 0.15, fish: PI + 0.6 },
  };
  G.Player = Player;

  // ---------------------------------------------------------------- item pickups
  class Pickup {
    constructor(id, n, x, y, opts) {
      opts = opts || {};
      this.id = id; this.n = n || 1; this.x = x; this.y = y; this.z = opts.z != null ? opts.z : 4;
      const a = Math.random() * Math.PI * 2, sp = opts.spread != null ? opts.spread : 26 + Math.random() * 18;
      this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp * 0.6; this.vz = opts.vz != null ? opts.vz : 70 + Math.random() * 40;
      this.t = 0; this.delay = opts.delay != null ? opts.delay : 0.45; this.dead = false;
      this.sortY = y;
    }
    update(dt, map, player) {
      this.t += dt;
      this.vz -= 260 * dt; this.z += this.vz * dt;
      if (this.z <= 0) { this.z = 0; this.vz = this.vz < -30 ? -this.vz * 0.35 : 0; this.vx *= 0.7; this.vy *= 0.7; }
      const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
      if (!map.blocked(Math.floor(nx / 16), Math.floor(ny / 16))) { this.x = nx; this.y = ny; } else { this.vx = 0; this.vy = 0; }
      if (this.t > this.delay && player) {
        const dx = player.x - this.x, dy = player.y - 6 - this.y, d = Math.hypot(dx, dy);
        const R = G.Stats.pickupRadius();
        if (d < R && G.Inv.canAdd(this.id, this.n)) {
          const sp = 120 + (R - d) * 6;
          this.x += (dx / d) * sp * dt; this.y += (dy / d) * sp * dt;
          if (d < 8) {
            const left = G.Inv.add(this.id, this.n);
            if (left < this.n) { G.UI.toastItem(this.id, this.n - left); G.sfx('pickup'); G.emit('pickup', this.id, this.n - left); }
            this.n = left;
            if (left <= 0) this.dead = true;
          }
        }
      }
      this.sortY = this.y;
    }
    draw(ctx, ox, oy) {
      const ic = G.icon(this.id);
      const bob = this.z <= 0 ? Math.sin(this.t * 3) * 1 : 0;
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#0e0818';
      ctx.fillRect(Math.round(this.x - 4 + ox), Math.round(this.y - 1 + oy), 8, 2);
      ctx.globalAlpha = 1;
      ctx.drawImage(ic, Math.round(this.x - 8 + ox), Math.round(this.y - 15 - this.z + bob + oy));
    }
  }
  G.Pickup = Pickup;
  G.dropItem = function (map, id, n, x, y, opts) { const p = new Pickup(id, n, x, y, opts); map.items.push(p); return p; };

  // ---------------------------------------------------------------- projectiles
  class Projectile {
    constructor(o) {
      Object.assign(this, { x: 0, y: 0, vx: 0, vy: 0, dmg: 5, from: 'player', fx: 'bolt_player', life: 1, r: 4, pierce: false, hitSet: new Set(), dead: false, t: 0, color: [93, 255, 176] }, o);
      this.sortY = this.y;
    }
    update(dt, map) {
      this.t += dt; this.life -= dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.sortY = this.y + 6;
      if (this.life <= 0) this.dead = true;
      const tx = Math.floor(this.x / 16), ty = Math.floor((this.y + 4) / 16);
      const m = map.t(tx, ty);
      if (m === G.MAT.CAVEWALL || m === G.MAT.CLIFF || m === G.MAT.VOID || (map.solid[map.idx(tx, ty)] && !this.ghost)) { this.dead = true; this.burst(); }
      if (Math.random() < 0.6) G.R.emit({ x: this.x, y: this.y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 0.25, color: `rgb(${this.color.join(',')})`, size: 1, grav: 0 });
    }
    burst() { G.R.burst(this.x, this.y, 6, { colors: [`rgb(${this.color.join(',')})`, '#ffffff'], speed: 40, life: 0.35, grav: 0 }); }
    draw(ctx, ox, oy) {
      let c = null, info = null;
      try { if (window.MobArt && MobArt.fx) { info = MobArt.fxInfo(this.fx); c = MobArt.fx(this.fx, Math.floor(this.t * (info.fps || 12)) % info.frames); } } catch (e) { c = null; }
      if (c) {
        // bolts are drawn flying right: rotate them around the orb centre to their heading
        ctx.save();
        ctx.translate(Math.round(this.x + ox), Math.round(this.y + oy));
        ctx.rotate(Math.atan2(this.vy, this.vx));
        ctx.drawImage(c, -(info.ax != null ? info.ax : c.width / 2), -(info.ay != null ? info.ay : c.height / 2));
        ctx.restore();
      }
      else { ctx.fillStyle = `rgb(${this.color.join(',')})`; ctx.fillRect(Math.round(this.x - 2 + ox), Math.round(this.y - 2 + oy), 4, 4); ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(this.x - 1 + ox), Math.round(this.y - 1 + oy), 2, 2); }
    }
  }
  G.Projectile = Projectile;
})();
