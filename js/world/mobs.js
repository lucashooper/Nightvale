// Nightvale — monsters: shared physics, per-type AI, combat, effects, the Archon boss.
(function () {
  'use strict';
  const G = window.G, U = G.U;
  const Mobs = (G.Mobs = {});

  // ---------------------------------------------------------------- art adapter
  const fallback = new Map();
  function artInfo(type) {
    try { if (window.MobArt && MobArt.info) { const i = MobArt.info(G.altArt(type)); if (i) return i; } } catch (e) { /* fallback */ }
    const big = type === 'archon' ? 48 : type === 'broodmother' ? 40 : type === 'golem' ? 24 : 16;
    return { w: big, h: big, ax: big / 2, ay: big - 2, anims: { idle: 2, move: 2, attack: 2, hurt: 1, die: 3 }, fps: { idle: 4, move: 8, attack: 8, die: 10 } };
  }
  function artFrame(type, variant, anim, idx, flip) {
    try { if (window.MobArt && MobArt.frame) { const c = MobArt.frame(G.altArt(type), variant, anim, idx, flip); if (c) return c; } } catch (e) { /* fallback */ }
    const key = type + variant + anim + idx;
    if (fallback.has(key)) return fallback.get(key);
    const info = artInfo(type), P = new G.Pix(info.w, info.h);
    const col = { slime: '#3b7048', bat: '#6a47a8', shroomling: '#5dffd0', spider: '#3d3654', broodmother: '#2d2840', skeleton: '#d8d0c0', golem: '#605f78', hexmage: '#4a2f7a', wraith: '#9fb0d8', voideye: '#e4d2ff', archon: '#231b38' }[type] || '#8f6cd1';
    P.disc(info.w / 2, info.h / 2 + 1, info.w / 2 - 2, info.h / 2 - 3 - (idx % 2), anim === 'hurt' ? '#ffffff' : col);
    P.set(info.w / 2 - 2, info.h / 2 - 1, '#ffffff'); P.set(info.w / 2 + 2, info.h / 2 - 1, '#ffffff');
    P.outline('#120c1c');
    const c = P.canvas(); fallback.set(key, c); return c;
  }
  function fxFrame(name, idx) {
    try { if (window.MobArt && MobArt.fx) return MobArt.fx(name, idx); } catch (e) { /* fallback */ }
    return null;
  }
  function fxInfo(name) {
    try { if (window.MobArt && MobArt.fxInfo) return MobArt.fxInfo(name); } catch (e) { /* fallback */ }
    return { w: 12, h: 12, frames: 4, fps: 12, ax: 6, ay: 6 };
  }
  Mobs.fxFrame = fxFrame; Mobs.fxInfo = fxInfo;

  // ---------------------------------------------------------------- effect entity
  class FX {
    constructor(name, x, y, opts) { this.name = name; this.x = x; this.y = y; this.t = 0; this.info = fxInfo(name); Object.assign(this, opts || {}); this.sortY = this.sortY != null ? this.sortY : y + 20; }
    update(dt) { this.t += dt; if (this.t * (this.info.fps || 12) >= (this.info.frames || 4)) this.dead = true; }
    draw(ctx, ox, oy) {
      const i = Math.min((this.info.frames || 4) - 1, Math.floor(this.t * (this.info.fps || 12)));
      const c = fxFrame(this.name, i);
      if (!c) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(Math.round(this.x - 2 + ox), Math.round(this.y - 2 + oy), 4, 4); return; }
      const ax = this.info.ax != null ? this.info.ax : c.width / 2, ay = this.info.ay != null ? this.info.ay : c.height / 2;
      if (this.rot) { ctx.save(); ctx.translate(Math.round(this.x + ox), Math.round(this.y + oy)); ctx.rotate(this.rot); if (this.flipY) ctx.scale(1, -1); ctx.drawImage(c, -ax, -ay); ctx.restore(); }
      else ctx.drawImage(c, Math.round(this.x - ax + ox), Math.round(this.y - ay + oy));
    }
  }
  Mobs.fx = function (name, x, y, opts) { const map = G.World.map; const f = new FX(name, x, y, opts); map.entities.push(f); return f; };
  Mobs.slashFx = function (x, y, dir) {
    const rot = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
    Mobs.fx('slash_arc', x, y, { rot, flipY: dir === 'left', sortY: G.World.player.y + (dir === 'up' ? -2 : 4) });
  };

  // spore cloud: damages the player while inside
  class Cloud {
    constructor(x, y, dmg) { this.x = x; this.y = y; this.dmg = dmg; this.t = 0; this.life = 1.6; this.sortY = y + 6; }
    update(dt, map, p) {
      this.t += dt; if (this.t > this.life) this.dead = true;
      if (Math.hypot(p.x - this.x, p.y - 6 - this.y) < 18 && this.t > 0.15 && G.S.buffs.veil == null) p.hurt(this.dmg, this.x, this.y);
    }
    draw(ctx, ox, oy) {
      const info = fxInfo('spore_cloud'), c = fxFrame('spore_cloud', Math.floor(this.t * 6) % (info.frames || 4));
      ctx.globalAlpha = Math.min(1, (this.life - this.t) * 2);
      if (c) ctx.drawImage(c, Math.round(this.x - c.width / 2 + ox), Math.round(this.y - c.height / 2 + oy));
      else { ctx.fillStyle = 'rgba(150,255,200,0.35)'; ctx.fillRect(Math.round(this.x - 10 + ox), Math.round(this.y - 10 + oy), 20, 20); }
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- mob
  const VIOLET = [185, 150, 255], EMERALD = [93, 255, 176], AMBER = [255, 170, 80], CYAN = [93, 230, 255], ROSE = [255, 130, 190];
  const EYE_LIGHT = {
    hexmage: { violet: VIOLET, emerald: EMERALD, crimson: [255, 110, 90] }, wraith: EMERALD, voideye: VIOLET, archon: VIOLET,
    shroomling: { glowcap: CYAN, toxic: EMERALD }, slime: { ember: [255, 150, 70], amethyst: VIOLET, void: VIOLET }, golem: { crystal: VIOLET, moss: EMERALD },
    bat: { gloom: EMERALD, frost: [170, 220, 255] }, spider: { cave: EMERALD, crystal: ROSE }, broodmother: EMERALD, skeleton: { warrior: AMBER, mage: VIOLET },
    thornling: AMBER, mimic: AMBER, wisp: { teal: CYAN, violet: VIOLET }, mosswolf: EMERALD, webweaver: [255, 90, 90], gloombeetle: { violet: VIOLET, emerald: EMERALD }, hollowstag: CYAN,
  };

  class Mob {
    constructor(type, variant, x, y, floor) {
      const st = G.MOBS[type];
      this.mob = true; this.type = type; this.variant = variant || 'default'; this.x = x; this.y = y; this.floor = floor || 1;
      const scale = st.big ? 1 + Math.max(0, floor - 1) * 0.012 : 1 + Math.max(0, floor - 1) * 0.045;
      this.maxHp = Math.round(st.hp * scale * (type === 'spider' && variant === 'brood' ? 0.4 : 1));
      this.hp = this.maxHp;
      this.dmg = Math.round(st.dmg * (1 + Math.max(0, floor - 1) * 0.032));
      this.speed = st.speed * (1 + Math.min(0.35, floor * 0.006));
      this.ai = st.ai; this.fly = !!st.fly; this.ghost = !!st.ghost; this.boss = !!st.boss;
      this.info = artInfo(type);
      this.w = this.info.w; this.h = this.info.h;
      this.bw = Math.min(12, this.w - 4); this.bh = 5; this.slide = false;
      this.vx = 0; this.vy = 0; this.kb = [0, 0];
      this.anim = 'idle'; this.animT = Math.random() * 2; this.flip = Math.random() < 0.5;
      this.state = 'idle'; this.t = Math.random() * 1.5; this.cd = 1 + Math.random(); this.hurtT = 0; this.stun = 0; this.alpha = 1;
      this.aggro = false; this.dead = false; this.dying = 0; this.z = 0;
      this.sortY = y;
    }
    get cx() { return this.x; }
    get cy() { return this.y - this.h / 2 + 2; }
    setAnim(a) { if (this.anim !== a) { this.anim = a; this.animT = 0; } }
    update(dt, map, p) {
      this.animT += dt;
      if (this.dying > 0) {
        this.dying -= dt;
        if (this.dying <= 0) this.dead = true;
        return;
      }
      if (this.hurtT > 0) this.hurtT -= dt;
      if (this.cd > 0) this.cd -= dt;
      if (this.contactCd > 0) this.contactCd -= dt;
      // knockback
      if (Math.abs(this.kb[0]) + Math.abs(this.kb[1]) > 1) {
        G.moveBody(this, this.kb[0] * dt, 0, map); G.moveBody(this, 0, this.kb[1] * dt, map);
        const k = Math.pow(0.004, dt); this.kb[0] *= k; this.kb[1] *= k;
      }
      if (this.stun > 0) { this.stun -= dt; this.sortY = this.y; return; }
      const dx = p.x - this.x, dy = (p.y - 6) - this.cy, dist = Math.hypot(dx, dy);
      const veiled = G.S.buffs.veil > 0;
      if (!veiled && dist < (this.boss ? 400 : 120)) this.aggro = true;
      if (veiled && !this.boss) this.aggro = false;
      if (dist > 220 && !this.boss) this.aggro = false;
      (AI[this.ai] || AI.hop).call(this, dt, map, p, dx, dy, dist);
      if (Math.abs(dx) > 2 && this.ai !== 'eye') this.flip = dx < 0;
      this.sortY = this.y;
    }
    move(dt, map, vx, vy) { G.moveBody(this, vx * dt, 0, map); G.moveBody(this, 0, vy * dt, map); }
    wander(dt, map) {
      this.t -= dt;
      if (this.t <= 0) { const a = Math.random() * Math.PI * 2; this.vx = Math.cos(a) * this.speed * 0.4; this.vy = Math.sin(a) * this.speed * 0.4; this.t = 1 + Math.random() * 2; if (Math.random() < 0.4) { this.vx = this.vy = 0; } }
      this.move(dt, map, this.vx, this.vy);
      this.setAnim(this.vx || this.vy ? 'move' : 'idle');
    }
    draw(ctx, ox, oy) {
      const info = this.info;
      let anim = this.anim, idx;
      if (this.dying > 0) { anim = 'die'; idx = Math.min(info.anims.die - 1, Math.floor((1 - this.dying / 0.5) * info.anims.die)); }
      else if (this.hurtT > 0.12) { anim = 'hurt'; idx = 0; }
      else idx = Math.floor(this.animT * ((info.fps && info.fps[anim]) || 8)) % (info.anims[anim] || 1);
      const c = artFrame(this.type, this.variant, anim, idx, this.flip);
      // shadow for floaters
      if (this.fly || this.ghost || this.ai === 'archon') {
        const sh = fxFrame('shadow', 0), si = fxInfo('shadow');
        if (sh) ctx.drawImage(sh, Math.round(this.x - (si.ax != null ? si.ax : sh.width / 2) + ox), Math.round(this.y - (si.ay != null ? si.ay : 2) + oy));
      }
      const bob = this.fly || this.ghost ? Math.round(Math.sin(this.animT * 4) * 2) - 6 : 0;
      if (this.alpha < 1) ctx.globalAlpha = this.alpha;
      if (this.telegraph > 0 && Math.floor(this.telegraph * 16) % 2 === 0) ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.75);
      ctx.drawImage(c, Math.round(this.x - info.ax + ox), Math.round(this.y - info.ay + bob - this.z + oy));
      ctx.globalAlpha = 1;
      // health bar once hurt
      if (this.hp < this.maxHp && !this.boss && this.dying <= 0) {
        const w = Math.max(12, Math.min(24, this.w)), x = Math.round(this.x - w / 2 + ox), y = Math.round(this.y - info.ay - 4 + bob + oy);
        ctx.fillStyle = '#120c1c'; ctx.fillRect(x - 1, y - 1, w + 2, 4);
        ctx.fillStyle = '#3a1430'; ctx.fillRect(x, y, w, 2);
        ctx.fillStyle = '#ff6f8a'; ctx.fillRect(x, y, Math.max(1, Math.round((w * this.hp) / this.maxHp)), 2);
      }
    }
    lights(out) {
      let col = EYE_LIGHT[this.type];
      if (col && !Array.isArray(col)) col = col[this.variant];
      if (col && this.dying <= 0) out.push({ x: this.x, y: this.cy - 2, r: this.boss ? 70 : this.telegraph > 0 ? 30 : this.big ? 26 : 16, color: col, i: this.telegraph > 0 ? 0.9 : 0.55 });
    }
  }

  // ---------------------------------------------------------------- AI behaviours (this = mob)
  const AI = {
    hop(dt, map, p, dx, dy, dist) {
      this.t -= dt;
      if (this.state === 'hop') {
        this.move(dt, map, this.vx, this.vy);
        this.z = Math.sin(Math.min(1, 1 - this.t / 0.4) * Math.PI) * 5;
        if (this.t <= 0) { this.state = 'idle'; this.t = 0.6 + Math.random() * 0.8; this.z = 0; this.setAnim('idle'); }
        return;
      }
      this.setAnim('idle');
      if (this.t <= 0) {
        const a = this.aggro ? Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.4 : Math.random() * Math.PI * 2;
        const sp = this.speed * (this.aggro ? 2.2 : 1.2);
        this.vx = Math.cos(a) * sp; this.vy = Math.sin(a) * sp;
        this.state = 'hop'; this.t = 0.4; this.setAnim('move');
        if (dist < 140) G.sfx('slime_hop', { volume: 0.5 });
      }
    },
    bat(dt, map, p, dx, dy, dist) {
      this.setAnim('move');
      if (!this.aggro) { this.wander(dt, map); this.setAnim('move'); return; }
      this.t += dt;
      const a = Math.atan2(dy, dx);
      const wob = Math.sin(this.t * 5) * 0.9;
      const sp = this.speed * (this.state === 'dive' ? 2.2 : 1);
      this.move(dt, map, Math.cos(a + wob) * sp, Math.sin(a + wob) * sp);
      if (this.cd <= 0 && dist < 50) { this.state = 'dive'; this.cd = 2.5; this.diveT = 0.5; G.sfx('bat_flap', { volume: 0.5 }); }
      if (this.diveT > 0) { this.diveT -= dt; if (this.diveT <= 0) this.state = 'fly'; }
    },
    shroom(dt, map, p, dx, dy, dist) {
      if (this.state === 'puff') {
        this.t -= dt;
        if (this.t <= 0.3 && !this.puffed) { this.puffed = true; map.entities.push(new Cloud(this.x, this.cy, this.dmg)); G.sfx('slime_hop', { volume: 0.4, pitch: 0.6 }); }
        if (this.t <= 0) { this.state = 'idle'; this.cd = 2.8; }
        return;
      }
      if (!this.aggro) { this.wander(dt, map); return; }
      if (dist < 26 && this.cd <= 0) { this.state = 'puff'; this.t = 0.7; this.puffed = false; this.setAnim('attack'); return; }
      const sp = this.speed;
      this.move(dt, map, (dx / dist) * sp, (dy / dist) * sp);
      this.setAnim('move');
    },
    spider(dt, map, p, dx, dy, dist) {
      this.t -= dt;
      if (this.state === 'leap') {
        this.move(dt, map, this.vx, this.vy);
        if (this.t <= 0) { this.state = 'rest'; this.t = 0.5; this.setAnim('idle'); }
        return;
      }
      if (!this.aggro) { this.wander(dt, map); return; }
      if (dist < 46 && this.cd <= 0) {
        const a = Math.atan2(dy, dx);
        this.vx = Math.cos(a) * 170; this.vy = Math.sin(a) * 170; this.state = 'leap'; this.t = 0.26; this.cd = 1.6; this.setAnim('attack');
        G.sfx('spider_skitter'); return;
      }
      if (this.state === 'rest') { if (this.t <= 0) this.state = 'run'; this.setAnim('idle'); return; }
      if (this.t <= 0) { this.t = 0.35 + Math.random() * 0.3; this.burst = Math.random() < 0.75; const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.2; this.vx = Math.cos(a) * this.speed * 1.3; this.vy = Math.sin(a) * this.speed * 1.3; }
      if (this.burst) { this.move(dt, map, this.vx, this.vy); this.setAnim('move'); } else this.setAnim('idle');
    },
    brood(dt, map, p, dx, dy, dist) {
      this.setAnim(this.state === 'cast' ? 'attack' : 'move');
      if (this.aggro) this.move(dt, map, (dx / (dist || 1)) * this.speed, (dy / (dist || 1)) * this.speed);
      this.spawnT = (this.spawnT || 4) - dt;
      if (this.aggro && this.spawnT <= 0) {
        this.spawnT = 6;
        const n = map.entities.filter((e) => e.mob && e.type === 'spider' && !e.dead).length;
        if (n < 6) for (let k = 0; k < 2; k++) { const s = Mobs.spawn('spider', 'cave', this.x + (k ? 14 : -14), this.y + 6, this.floor); s.maxHp = s.hp = Math.round(s.hp * 0.45); s.aggro = true; map.entities.push(s); Mobs.fx('spawn_rune', s.x, s.y - 2, { sortY: s.y - 8 }); }
        G.sfx('spider_skitter', { pitch: 0.6 });
      }
      if (this.aggro && this.cd <= 0) {
        this.cd = 2.6;
        for (const off of [-0.25, 0, 0.25]) shoot(map, this, Math.atan2(dy, dx) + off, 100, 'web_shot', [220, 214, 240]);
      }
    },
    melee(dt, map, p, dx, dy, dist) {
      if (this.variant === 'mage') return AI.caster.call(this, dt, map, p, dx, dy, dist);
      if (this.state === 'windup') {
        this.telegraph = this.t; this.t -= dt;
        if (this.t <= 0) {
          this.state = 'strike'; this.t = 0.25; this.telegraph = 0;
          if (dist < 28) p.hurt(this.dmg, this.x, this.cy);
          G.sfx('sword_swing', { pitch: 0.7, volume: 0.6 });
        }
        return;
      }
      if (this.state === 'strike') { this.t -= dt; if (this.t <= 0) { this.state = 'chase'; this.cd = 1.1; } return; }
      if (!this.aggro) { this.wander(dt, map); return; }
      if (dist < 22 && this.cd <= 0) { this.state = 'windup'; this.t = 0.45; this.setAnim('attack'); return; }
      this.move(dt, map, (dx / dist) * this.speed, (dy / dist) * this.speed);
      this.setAnim('move');
    },
    caster(dt, map, p, dx, dy, dist) {
      if (this.state === 'cast') {
        this.t -= dt; this.telegraph = this.t;
        if (this.t <= 0) {
          this.state = 'idle'; this.telegraph = 0; this.cd = 2 + Math.random() * 1.2;
          const a = Math.atan2(dy, dx);
          const col = this.variant === 'emerald' ? [93, 255, 176] : this.variant === 'crimson' ? [255, 90, 110] : [185, 150, 255];
          const spread = this.variant === 'crimson' ? [-0.3, 0, 0.3] : this.variant === 'emerald' && Math.random() < 0.5 ? [-0.12, 0.12] : [0];
          for (const s of spread) shoot(map, this, a + s, this.variant === 'emerald' ? 125 : 105, 'bolt_enemy', col);
          G.sfx('wizard_cast', { volume: 0.7 });
        }
        return;
      }
      if (!this.aggro) { this.wander(dt, map); return; }
      let vx = 0, vy = 0;
      if (dist < 64) { vx = -dx / dist; vy = -dy / dist; } else if (dist > 125) { vx = dx / dist; vy = dy / dist; }
      else { this.strafe = this.strafe || (Math.random() < 0.5 ? 1 : -1); vx = (-dy / dist) * this.strafe * 0.6; vy = (dx / dist) * this.strafe * 0.6; }
      this.move(dt, map, vx * this.speed, vy * this.speed);
      this.setAnim(vx || vy ? 'move' : 'idle');
      if (this.cd <= 0 && dist < 170) { this.state = 'cast'; this.t = 0.65; this.setAnim('attack'); }
    },
    golem(dt, map, p, dx, dy, dist) {
      if (this.state === 'windup') {
        this.t -= dt; this.telegraph = this.t;
        if (this.t <= 0) {
          this.state = 'recover'; this.t = 0.6; this.telegraph = 0;
          G.R.shake(3, 0.25); G.sfx('golem_stomp');
          G.R.burst(this.x, this.y, 16, { colors: ['#7e7d97', '#a09fb6', '#b99aee'], speed: 80, life: 0.5 });
          if (Math.hypot(p.x - this.x, p.y - this.y) < 36) p.hurt(this.dmg, this.x, this.y);
        }
        return;
      }
      if (this.state === 'recover') { this.t -= dt; if (this.t <= 0) { this.state = 'idle'; this.cd = 1.6; } return; }
      if (!this.aggro) { this.wander(dt, map); return; }
      if (dist < 30 && this.cd <= 0) { this.state = 'windup'; this.t = 0.8; this.setAnim('attack'); return; }
      this.move(dt, map, (dx / dist) * this.speed, (dy / dist) * this.speed);
      this.setAnim('move');
      this.stepT = (this.stepT || 0) - dt;
      if (this.stepT <= 0 && dist < 160) { this.stepT = 0.7; G.sfx('golem_stomp', { volume: 0.25 }); }
    },
    wraith(dt, map, p, dx, dy, dist) {
      this.phaseT = (this.phaseT == null ? 3 : this.phaseT) - dt;
      if (this.phaseT <= 0) { this.faded = !this.faded; this.phaseT = this.faded ? 1.1 : 2.5 + Math.random() * 2; if (this.faded) G.sfx('ghost_wail', { volume: 0.5 }); }
      this.alpha = U.approach(this.alpha, this.faded ? 0.25 : 0.92, dt * 3);
      if (this.state === 'lunge') { this.move(dt, map, this.vx, this.vy); this.t -= dt; if (this.t <= 0) { this.state = 'drift'; this.cd = 1.8; } return; }
      if (!this.aggro) { this.wander(dt, map); return; }
      if (!this.faded && dist < 50 && this.cd <= 0) { const a = Math.atan2(dy, dx); this.vx = Math.cos(a) * 150; this.vy = Math.sin(a) * 150; this.state = 'lunge'; this.t = 0.32; this.setAnim('attack'); return; }
      this.move(dt, map, (dx / dist) * this.speed, (dy / dist) * this.speed);
      this.setAnim('move');
    },
    eye(dt, map, p, dx, dy, dist) {
      this.flip = false;
      if (this.state === 'charge') {
        this.t -= dt; this.telegraph = this.t;
        if (this.t <= 0) { this.state = 'idle'; this.telegraph = 0; this.cd = 2.4; shoot(map, this, Math.atan2(dy, dx), 175, 'bolt_enemy', [200, 160, 255]); G.sfx('wizard_cast', { pitch: 1.4, volume: 0.6 }); }
        return;
      }
      if (!this.aggro) { this.wander(dt, map); this.setAnim('move'); return; }
      const want = 90;
      const k = dist > want + 20 ? 1 : dist < want - 20 ? -1 : 0;
      this.t += dt;
      this.move(dt, map, (dx / dist) * this.speed * k + Math.cos(this.t) * 12, (dy / dist) * this.speed * k + Math.sin(this.t * 1.3) * 12);
      this.setAnim('move');
      if (this.cd <= 0 && dist < 180) { this.state = 'charge'; this.t = 0.9; this.setAnim('attack'); }
    },
    archon(dt, map, p, dx, dy, dist) { Boss.update.call(this, dt, map, p, dx, dy, dist); },
  };

  Mobs.AI = AI; // bosses and newer creatures add their behaviours here (guild.js)

  function shoot(map, from, ang, speed, fx, color) {
    map.entities.push(new G.Projectile({ x: from.x + Math.cos(ang) * 8, y: from.cy + Math.sin(ang) * 6, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, dmg: from.dmg, from: 'mob', fx, life: 2.6, color, ghost: false }));
  }
  Mobs.shoot = shoot;

  Mobs.spawn = function (type, variant, x, y, floor) { const m = new Mob(type, variant, x, y, floor); m.big = !!G.MOBS[type].big; return m; };
  // build every animation frame of the monsters on a floor up front, so the first fight has no hitch
  Mobs.prewarm = function (mobs) {
    if (!window.MobArt) return;
    const seen = new Set();
    for (const m of mobs) {
      const key = m.type + ':' + m.variant; if (seen.has(key)) continue; seen.add(key);
      const info = artInfo(m.type);
      for (const anim in info.anims) for (let i = 0; i < info.anims[anim]; i++) { artFrame(m.type, m.variant, anim, i, false); artFrame(m.type, m.variant, anim, i, true); }
    }
    try { for (const f of MobArt.fxList || []) { const fi = MobArt.fxInfo(f); for (let i = 0; i < fi.frames; i++) MobArt.fx(f, i); } } catch (e) { /* optional */ }
  };

  // ---------------------------------------------------------------- damage & death
  Mobs.damage = function (m, roll, fromX, fromY) {
    if (m.dead || m.dying > 0) return;
    if (m.faded) { G.R.text(m.x, m.y - m.h, 'miss', '#9fb0d8', { size: 6 }); return; }
    if (m.invuln > 0) return;
    const amt = typeof roll === 'number' ? roll : roll.amt;
    const crit = typeof roll === 'object' && roll.crit;
    m.hp -= amt;
    m.hurtT = 0.22;
    m.aggro = true;
    const dx = m.x - fromX, dy = m.cy - fromY, len = Math.hypot(dx, dy) || 1;
    const kb = m.boss ? 30 : m.type === 'golem' ? 70 : 170;
    m.kb = [(dx / len) * kb, (dy / len) * kb];
    m.stun = m.boss ? 0 : 0.18;
    if (m.state === 'windup' && Math.random() < 0.5 && !m.boss) { m.state = 'idle'; m.telegraph = 0; m.cd = 0.8; }
    G.R.text(m.x, m.y - m.h - 2, String(amt), crit ? '#ffd27a' : '#ffffff', { size: crit ? 9 : 7 });
    Mobs.fx(crit ? 'crit_spark' : 'hit_spark', m.x, m.cy, { sortY: m.y + 30 });
    G.sfx('enemy_hit');
    if (m.type === 'hexmage' && Math.random() < 0.3 && m.hp > 0) blink(m, G.World.map);
    if (m.onHurt && m.hp > 0) m.onHurt(m, amt);
    if (m.hp <= 0) Mobs.kill(m);
  };
  function blink(m, map) {
    for (let k = 0; k < 12; k++) {
      const tx = Math.floor(m.x / 16) + U.randInt(-5, 5), ty = Math.floor(m.y / 16) + U.randInt(-5, 5);
      if (!map.blocked(tx, ty) && !map.tobj.has(map.idx(tx, ty))) {
        Mobs.fx('death_puff', m.x, m.cy);
        m.x = tx * 16 + 8; m.y = ty * 16 + 12; G.sfx('teleport', { volume: 0.5 });
        return;
      }
    }
  }
  Mobs.kill = function (m) {
    const S = G.S, map = G.World.map;
    m.dying = 0.5; m.hp = 0;
    G.sfx('enemy_die');
    Mobs.fx('death_puff', m.x, m.y, { sortY: m.y + 30 });
    S.stats.kills = (S.stats.kills || 0) + 1;
    const st = G.MOBS[m.type];
    const luck = 1 + 0.12 * Math.max(0, G.Stats.get('luck'));
    for (const [id, ch, a, b] of st.drops) if (Math.random() < ch * luck) G.dropItem(map, id, U.randInt(a, b), m.x, m.y - 4);
    if (Math.random() < 0.06 * luck) G.dropItem(map, U.pick(['pot_healing', 'food_bread', 'ore_glimmer']), 1, m.x, m.y - 4);
    if (m.type === 'broodmother') { G.jingle('quest_complete'); G.UI.toast('The Broodmother is slain!'); S.flags.broodmother = true; }
    if (m.onDeath) m.onDeath(m);
    // slimes that split when they burst (Gloopgarr's children)
    if (st.split) for (let k = 0; k < (st.splitN || 2); k++) {
      const c = Mobs.spawn(st.split, m.variant, m.x + (k ? 8 : -8), m.y + (k ? 3 : -3), m.floor);
      c.aggro = true; c.kb = [(k ? 1 : -1) * 120, (Math.random() - 0.5) * 80]; c.stun = 0.25;
      map.entities.push(c);
    }
    if (st.split) Mobs.fx('slime_split', m.x, m.y - 4, { sortY: m.y + 2 });
    if (m.type === 'archon') Boss.defeated(m, map);
    G.emit('kill', m.type);
  };

  // contact damage & projectiles vs player / mobs
  Mobs.collide = function (map, p) {
    const veil = G.S.buffs.veil > 0;
    for (const e of map.entities) {
      if (e.dead) continue;
      if (e.mob && e.dying <= 0 && !veil && !e.faded) {
        const dx = p.x - e.x, dy = (p.y - 4) - (e.y - 4);
        const reach = Math.max(9, e.bw * 0.7);
        if (Math.abs(dx) < reach && Math.abs(dy) < 9 && e.ai !== 'caster' && e.ai !== 'eye' && e.ai !== 'melee' && e.ai !== 'golem') {
          if (!(e.contactCd > 0)) { if (p.hurt(e.dmg, e.x, e.y)) e.contactCd = 0.8; }
        }
      }
      if (e instanceof G.Projectile) {
        if (e.from === 'mob') {
          if (Math.hypot(p.x - e.x, p.y - 8 - e.y) < 8) { p.hurt(e.dmg, e.x, e.y); e.dead = true; e.burst(); }
        } else {
          for (const m of map.entities) {
            if (!m.mob || m.dead || m.dying > 0 || e.hitSet.has(m)) continue;
            if (Math.abs(m.x - e.x) < Math.max(8, m.w / 2 - 2) && Math.abs(m.cy - e.y) < Math.max(8, m.h / 2 - 1)) {
              Mobs.damage(m, e.dmg, e.x - e.vx * 0.05, e.y - e.vy * 0.05);
              e.hitSet.add(m);
              if (e.frost) { m.stun = Math.max(m.stun || 0, 0.9); m.slowT = 3; Mobs.fx('frost_hit', m.x, m.cy, { sortY: m.y + 1 }); G.sfx('frost_hit', { volume: 0.6 }); }
              if (!e.pierce) { e.dead = true; e.burst(); break; }
            }
          }
        }
      }
    }
    // keep mobs from stacking
    const ms = map.entities.filter((e) => e.mob && !e.dead);
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i], b = ms[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0 && d < 10) { const push = (10 - d) * 0.5; G.moveBody(a, (-dx / d) * push, (-dy / d) * push, map); G.moveBody(b, (dx / d) * push, (dy / d) * push, map); }
    }
  };

  // ---------------------------------------------------------------- the Umbral Archon
  const Boss = {
    update(dt, map, p, dx, dy, dist) {
      const S = G.S;
      if (!this.started) {
        this.started = true; this.invuln = 0; this.phase = 1; this.cd = 2.5; this.tpT = 6;
        G.World.cutscene = true;
        const t = window.GAMETEXT && GAMETEXT.archon;
        G.UI.say(null, (t && t.intro) || ['A crown of black glass turns toward you. "Little gardener," it says, in a voice like the moon going out. "You brought me light."']).then(() => { G.World.cutscene = false; G.UI.bossBar(this); });
        return;
      }
      if (G.World.cutscene) return;
      const frac = this.hp / this.maxHp;
      if (this.phase === 1 && frac < 0.6) { this.phase = 2; this.invuln = 1.5; Boss.phaseLine(this); }
      if (this.phase === 2 && frac < 0.25) { this.phase = 3; this.invuln = 1.5; G.R.shake(4, 0.6); }
      if (this.invuln > 0) this.invuln -= dt;
      // drift around the arena keeping some distance
      this.t += dt;
      const want = this.phase === 3 ? 70 : 100;
      const k = dist > want + 30 ? 1 : dist < want - 30 ? -0.8 : 0;
      this.move(dt, map, (dx / (dist || 1)) * this.speed * k + Math.cos(this.t * 0.8) * 18, (dy / (dist || 1)) * this.speed * k + Math.sin(this.t * 0.6) * 12);
      this.setAnim(this.state === 'cast' ? 'attack' : 'move');
      this.tpT -= dt;
      if (this.tpT <= 0) { this.tpT = this.phase === 3 ? 4 : 7; Boss.teleport(this, map, p); }
      if (this.cd > 0) return;
      // choose an attack
      const r = Math.random();
      if (r < 0.4) { // radial ring
        const n = this.phase === 1 ? 10 : this.phase === 2 ? 14 : 18;
        const off = Math.random() * Math.PI;
        for (let i = 0; i < n; i++) shoot(map, this, off + (i / n) * Math.PI * 2, 85 + this.phase * 10, 'bolt_enemy', [190, 140, 255]);
        this.cd = 2.2 - this.phase * 0.35;
      } else if (r < 0.75) { // aimed volley
        const a = Math.atan2(dy, dx);
        const shots = 3 + this.phase;
        for (let i = 0; i < shots; i++) setTimeout(() => { if (!this.dead && this.dying <= 0) shoot(map, this, a + (Math.random() - 0.5) * 0.3, 150, 'bolt_enemy', [255, 110, 160]); }, i * 140);
        this.cd = 1.8 - this.phase * 0.25;
      } else if (this.phase >= 2 && map.entities.filter((e) => e.mob && !e.dead && e !== this).length < 4) { // summons
        for (let i = 0; i < 2; i++) {
          const m = Mobs.spawn(Math.random() < 0.5 ? 'wraith' : 'voideye', 'default', this.x + (i ? 30 : -30), this.y + 10, 45);
          m.aggro = true; map.entities.push(m); Mobs.fx('spawn_rune', m.x, m.y - 2, { sortY: m.y - 8 });
        }
        G.sfx('ghost_wail');
        this.cd = 2.5;
      } else { // spiral
        let i = 0; const base = Math.random() * 6;
        const iv = setInterval(() => { if (this.dead || this.dying > 0 || i > 24) { clearInterval(iv); return; } shoot(map, this, base + i * 0.5, 95, 'bolt_enemy', [150, 255, 200]); i++; }, 70);
        this.cd = 2.6 - this.phase * 0.3;
      }
      G.sfx('wizard_cast', { pitch: 0.6, volume: 0.8 });
    },
    teleport(m, map, p) {
      Mobs.fx('death_puff', m.x, m.cy);
      for (let k = 0; k < 20; k++) {
        const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 50;
        const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
        if (!map.blocked(Math.floor(x / 16), Math.floor(y / 16))) { m.x = x; m.y = y; break; }
      }
      Mobs.fx('spawn_rune', m.x, m.y - 2, { sortY: m.y - 8 });
      G.sfx('teleport');
    },
    phaseLine(m) {
      const t = window.GAMETEXT && GAMETEXT.archon;
      const lines = (t && t.phase2) || ['"Do you know what the moon is, gardener? A wound that learned to glow."'];
      G.UI.toast('“' + G.UI.fill(lines[0]).replace(/^\s*\[\w+\]\s*/, '').replace(/^"|"$/g, '') + '”');
      G.R.shake(3, 0.5);
    },
    async defeated(m, map) {
      const S = G.S;
      S.flags.archonDefeated = true;
      G.UI.bossBar(null);
      for (const e of map.entities) if (e.mob && e !== m && !e.dead) { e.dying = 0.5; }
      G.R.doFlash('235,225,255', 0.9); G.R.shake(5, 1.2);
      G.jingle('altar_restored');
      G.World.cutscene = true;
      await new Promise((r) => setTimeout(r, 1200));
      const t = window.GAMETEXT && GAMETEXT.archon;
      await G.UI.say(null, (t && t.defeat) || ['The crown cracks. Light pours out of it — not violet, but silver, the colour of an ordinary moon.']);
      await G.UI.say(null, (t && t.epilogue) || ['Far above, the moon steps back to its proper distance. Nightvale exhales.']);
      G.World.cutscene = false;
      G.Inv.giveOrDrop('pot_moon', 2);
      S.gold += 10000;
      G.UI.toast('+10,000 ✦ — the valley’s thanks.');
      const cx = Math.floor(map.w / 2), cy = Math.floor(map.h / 2) + 3;
      G.Dungeon.makeLadder(map, cx, cy, true);
      G.Save.save();
    },
  };
  Mobs.Boss = Boss;
})();
