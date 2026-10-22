// Nightvale — renderer: camera, 1x world buffer, y-sorted sprites, light map, bloom, weather, fades.
(function () {
  'use strict';
  const G = window.G, U = G.U;

  const R = (G.R = {
    scale: 4, viewW: 480, viewH: 270, zoomBias: 0,
    cam: { x: 0, y: 0, shake: 0, shakeT: 0 },
    flash: 0, flashColor: '255,255,255', fade: 0, time: 0,
    particles: [], texts: [],
  });

  R.init = function (canvas) {
    R.canvas = canvas;
    R.ctx = canvas.getContext('2d');
    R.buf = U.canvas(16, 16); R.bctx = U.ctx(R.buf);
    R.light = U.canvas(16, 16); R.lctx = R.light.getContext('2d');
    R.resize();
    window.addEventListener('resize', R.resize);
  };
  R.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
    R.canvas.width = w; R.canvas.height = h;
    R.canvas.style.width = window.innerWidth + 'px'; R.canvas.style.height = window.innerHeight + 'px';
    // integer scale so that ~16-17 tiles fit vertically
    let s = Math.round(h / (16 * 16.5));
    s = Math.min(s, Math.max(2, Math.floor(w / (16 * 11)))); // portrait phones: keep ~11 tiles across
    s = U.clamp(s + R.zoomBias + (R.flyZoom || 0), 2, 12);
    R.scale = s;
    R.viewW = Math.ceil(w / s); R.viewH = Math.ceil(h / s);
    R.buf.width = R.viewW; R.buf.height = R.viewH;
    R.light.width = R.viewW; R.light.height = R.viewH;
    R.bctx = U.ctx(R.buf);
    R.dpr = dpr;
  };
  R.setZoom = function (bias) { R.zoomBias = bias; R.resize(); };

  // ---------------------------------------------------------------- light sprites
  const lightCache = new Map();
  function lightSprite(color, r) {
    r = Math.max(2, Math.round(r));
    const key = color[0] + ',' + color[1] + ',' + color[2] + '|' + r;
    let c = lightCache.get(key);
    if (!c) {
      c = U.canvas(r * 2, r * 2);
      const x = c.getContext('2d');
      const g = x.createRadialGradient(r, r, 0, r, r, r);
      const col = `${color[0]},${color[1]},${color[2]}`;
      g.addColorStop(0, `rgba(${col},1)`);
      g.addColorStop(0.25, `rgba(${col},0.78)`);
      g.addColorStop(0.55, `rgba(${col},0.36)`);
      g.addColorStop(0.8, `rgba(${col},0.1)`);
      g.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
      lightCache.set(key, c);
    }
    return c;
  }
  R.lightSprite = lightSprite;

  // ---------------------------------------------------------------- ambient by time
  const KEYS = [
    [300, [120, 110, 175]], [360, [170, 150, 200]], [420, [232, 210, 222]], [480, [255, 252, 248]], [1020, [255, 249, 242]],
    [1100, [240, 190, 196]], [1160, [176, 136, 192]], [1220, [112, 98, 160]], [1300, [78, 70, 138]], [1440, [66, 60, 126]], [1580, [56, 50, 112]],
  ];
  R.ambient = function (mins, weather) {
    let a = KEYS[0][1], b = KEYS[KEYS.length - 1][1], t = 0;
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (mins >= KEYS[i][0] && mins <= KEYS[i + 1][0]) { a = KEYS[i][1]; b = KEYS[i + 1][1]; t = (mins - KEYS[i][0]) / (KEYS[i + 1][0] - KEYS[i][0]); break; }
      if (mins > KEYS[KEYS.length - 1][0]) { a = b = KEYS[KEYS.length - 1][1]; }
    }
    let c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    if (weather === 'rain') c = [c[0] * 0.78, c[1] * 0.82, c[2] * 0.94];
    if (weather === 'mist') c = [c[0] * 0.9, c[1] * 0.9, c[2] * 0.96];
    // sunny: a touch brighter and warmer, with richer golden hours
    if (weather === 'sunny') c = [Math.min(255, c[0] * 1.06 + 4), Math.min(255, c[1] * 1.03 + 2), c[2] * 0.93];
    return c;
  };

  // ---------------------------------------------------------------- particles
  // p: {x,y,vx,vy,life,max,color,size,grav,glow,fade,drag,kind}
  R.emit = function (p) { p.life = p.life || 1; p.max = p.life; R.particles.push(p); if (R.particles.length > 900) R.particles.splice(0, R.particles.length - 900); return p; };
  R.burst = function (x, y, n, opts) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (opts.speed || 40) * (0.4 + Math.random() * 0.8);
      R.emit({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0), life: (opts.life || 0.6) * (0.6 + Math.random() * 0.6), color: U.pick(opts.colors), size: opts.size || 1, grav: opts.grav != null ? opts.grav : 60, glow: opts.glow, drag: opts.drag || 0.9 });
    }
  };
  R.text = function (x, y, str, color, opts) { R.texts.push(Object.assign({ x, y, str, color: color || '#ffffff', life: 1.1, max: 1.1, vy: -22 }, opts || {})); };
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  R.shake = function (amt, t) { if (calm) return; R.cam.shake = Math.max(R.cam.shake, amt); R.cam.shakeT = Math.max(R.cam.shakeT, t || 0.25); };
  R.doFlash = function (color, amt) { R.flashColor = color; R.flash = calm ? Math.min(amt, 0.15) : amt; };

  function updateParticles(dt) {
    const ps = R.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      const d = Math.pow(p.drag || 1, dt * 60);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.floor != null && p.y > p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; }
    }
    for (let i = R.texts.length - 1; i >= 0; i--) { const t = R.texts[i]; t.life -= dt; t.y += t.vy * dt; t.vy *= 0.94; if (t.life <= 0) R.texts.splice(i, 1); }
  }

  // ---------------------------------------------------------------- main draw
  // world: { map, player, drawables(): [...], lights: [...], ambient, weather, nightFactor, dark }
  R.draw = function (dt, W) {
    R.time += dt;
    updateParticles(dt);
    const ctx = R.ctx, b = R.bctx, map = W.map, vw = R.viewW, vh = R.viewH;
    const mw = map.w * 16, mh = map.h * 16;
    // camera follow
    const tx = W.focus.x - vw / 2, ty = W.focus.y - 8 - vh / 2;
    R.cam.x = mw <= vw ? (mw - vw) / 2 : U.clamp(tx, 0, mw - vw);
    R.cam.y = mh <= vh ? (mh - vh) / 2 : U.clamp(ty, 0, mh - vh);
    let sx = 0, sy = 0;
    if (R.cam.shakeT > 0) { R.cam.shakeT -= dt; sx = (Math.random() - 0.5) * 2 * R.cam.shake; sy = (Math.random() - 0.5) * 2 * R.cam.shake; if (R.cam.shakeT <= 0) R.cam.shake = 0; }
    const cx = Math.round(R.cam.x + sx), cy = Math.round(R.cam.y + sy);
    R.cx = cx; R.cy = cy;

    // background
    b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    b.fillStyle = map.voidColor || '#0b0812';
    b.fillRect(0, 0, vw, vh);
    if (map.baked) {
      const sx0 = Math.max(0, cx), sy0 = Math.max(0, cy);
      const dx0 = sx0 - cx, dy0 = sy0 - cy;
      const w = Math.min(mw - sx0, vw - dx0), h = Math.min(mh - sy0, vh - dy0);
      if (w > 0 && h > 0) b.drawImage(map.baked.canvas, sx0, sy0, w, h, dx0, dy0, w, h);
      // water shimmer
      const sh = map.baked.shimmer, t = R.time;
      b.fillStyle = 'rgba(196,230,255,0.75)';
      for (let i = 0; i < sh.length; i += 2) {
        const x = sh[i] - cx, y = sh[i + 1] - cy;
        if (x < -4 || y < -2 || x > vw || y > vh) continue;
        const ph = (Math.sin(t * 1.7 + sh[i] * 0.37 + sh[i + 1] * 0.11) + 1) / 2;
        if (ph > 0.55) b.fillRect(x - (ph > 0.8 ? 1 : 0), y, ph > 0.8 ? 3 : 2, 1);
      }
    }
    if (W.drawGround) W.drawGround(b, -cx, -cy);

    // y-sorted world objects
    const list = W.drawables(cx, cy, vw, vh);
    list.sort((p, q) => p.sortY - q.sortY);
    for (const d of list) d.draw(b, -cx, -cy);

    // particles (world)
    for (const p of R.particles) {
      const a = p.fade === false ? 1 : U.clamp(p.life / p.max, 0, 1);
      b.globalAlpha = a;
      b.fillStyle = p.color;
      const s = p.size || 1;
      b.fillRect(Math.round(p.x - cx - s / 2), Math.round(p.y - cy - s / 2), s, s);
    }
    b.globalAlpha = 1;
    if (W.drawOverlay) W.drawOverlay(b, -cx, -cy, dt);

    // weather (screen space on buffer)
    drawWeather(b, W, dt, cx, cy);

    // upscale world
    const S = R.scale;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(R.buf, 0, 0, vw * S, vh * S);

    // light map
    const amb = W.ambient;
    const lc = R.lctx;
    lc.globalCompositeOperation = 'source-over';
    lc.globalAlpha = 1;
    lc.fillStyle = `rgb(${amb[0] | 0},${amb[1] | 0},${amb[2] | 0})`;
    lc.fillRect(0, 0, vw, vh);
    const dark = W.nightFactor;
    lc.globalCompositeOperation = 'lighter';
    const lights = W.lights;
    const visible = [];
    for (const L of lights) {
      const r = L.r;
      if (L.x + r < cx || L.y + r < cy || L.x - r > cx + vw || L.y - r > cy + vh) continue;
      if (L.shaft) { drawShaft(lc, L, cx, cy, L.i * (0.85 + 0.15 * Math.sin(R.time * 0.7 + L.x))); continue; }
      let i = L.i == null ? 0.8 : L.i;
      if (L.night) i *= dark;
      else i *= Math.max(dark, W.dark ? 1 : 0.15);
      if (L.flicker) i *= 0.88 + 0.12 * Math.sin(R.time * 9 + L.x * 0.7) * Math.sin(R.time * 5.3 + L.y);
      if (i <= 0.01) continue;
      lc.globalAlpha = Math.min(1, i);
      lc.drawImage(lightSprite(L.color, r), L.x - cx - r, L.y - cy - r);
      visible.push([L, i]);
    }
    lc.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(R.light, 0, 0, vw * S, vh * S);
    // bloom
    ctx.globalCompositeOperation = 'lighter';
    const bloomK = 0.07 + dark * 0.3;
    for (const [L, i] of visible) {
      if (L.noBloom) continue;
      const r = L.r * 0.5;
      ctx.globalAlpha = Math.min(1, i * bloomK * (L.bloom || 1));
      ctx.drawImage(lightSprite(L.color, r), (L.x - cx - r) * S, (L.y - cy - r) * S, r * 2 * S, r * 2 * S);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;

    // sunshine and the chosen colour grade (after lighting, before the crisp text)
    const dayK = U.clamp((amb[0] * 0.3 + amb[1] * 0.55 + amb[2] * 0.15 - 90) / 150, 0, 1);
    if (W.weather === 'sunny' && map.outdoor) drawSunshine(ctx, dt, dayK, cx, cy, S);
    grade(ctx, dayK);

    // floating texts (crisp, after lighting)
    drawTexts(ctx, cx, cy, S);

    // starfall streaks (screen space, after lighting)
    if (W.weather === 'starfall' && map.outdoor) drawStarfall(ctx, dt, S);

    // vignette
    const vig = W.vignette || 0;
    if (vig > 0) {
      const g = ctx.createRadialGradient(R.canvas.width / 2, R.canvas.height / 2, R.canvas.height * 0.35, R.canvas.width / 2, R.canvas.height / 2, R.canvas.width * 0.7);
      g.addColorStop(0, 'rgba(6,3,14,0)');
      g.addColorStop(1, `rgba(6,3,14,${vig})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, R.canvas.width, R.canvas.height);
    }
    if (R.flash > 0) {
      ctx.fillStyle = `rgba(${R.flashColor},${Math.min(0.6, R.flash)})`;
      ctx.fillRect(0, 0, R.canvas.width, R.canvas.height);
      R.flash = Math.max(0, R.flash - dt * 2.5);
    }
    if (R.fade > 0) {
      ctx.fillStyle = `rgba(8,5,16,${Math.min(1, R.fade)})`;
      ctx.fillRect(0, 0, R.canvas.width, R.canvas.height);
    }
  };

  // ---------------------------------------------------------------- colour grades (Settings → Look)
  // each look is a few full-screen blend fills: cheap on the GPU, and the art underneath is untouched.
  // [blend mode, colour, strength by day, strength by night]
  R.LOOKS = {
    twilight: { name: 'Twilight Hollow', note: 'The original: violet dusk and glowing greens', fills: [] },
    golden: { name: 'Golden Hour', note: 'Warm, honeyed light all day', fills: [['soft-light', '255,176,92', 0.5, 0.18], ['screen', '64,36,8', 0.12, 0.03]] },
    meadow: { name: 'Spring Meadow', note: 'Fresh, bright greens with less purple', fills: [['soft-light', '176,255,140', 0.42, 0.12], ['screen', '28,44,30', 0.16, 0.04], ['saturation', '150,150,150', 0.08, 0]] },
    storybook: { name: 'Storybook', note: 'Soft pastels, like a picture book', fills: [['screen', '255,232,236', 0.18, 0.06], ['saturation', '150,150,150', 0.26, 0.12], ['soft-light', '255,214,226', 0.34, 0.12]] },
    ink: { name: 'Moonlit Ink', note: 'Cool, crisp and moody', fills: [['soft-light', '96,128,210', 0.42, 0.3], ['saturation', '128,128,128', 0.22, 0.12], ['multiply', '226,232,255', 0.5, 0.2]] },
  };
  function grade(ctx, dayK) {
    const L = R.LOOKS[(G.prefs && G.prefs.look) || 'twilight'];
    if (!L || !L.fills.length) return;
    const w = R.canvas.width, h = R.canvas.height;
    for (const [mode, col, aDay, aNight] of L.fills) {
      const a = aNight + (aDay - aNight) * dayK;
      if (a <= 0.005) continue;
      ctx.globalCompositeOperation = mode;
      ctx.fillStyle = `rgba(${col},${a})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- sunshine
  // a warm wash, a few slow sunbeams slanting in from the upper left, and drifting pollen
  const beams = [];
  function drawSunshine(ctx, dt, dayK, cx, cy, S) {
    if (dayK <= 0.02) return;
    const w = R.canvas.width, h = R.canvas.height;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(255,214,140,${0.3 * dayK})`;
    ctx.fillRect(0, 0, w, h);
    // warm light pooling from the top-left corner
    ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(-w * 0.1, -h * 0.25, 0, -w * 0.1, -h * 0.25, Math.max(w, h) * 1.1);
    g.addColorStop(0, `rgba(255,226,160,${0.22 * dayK})`); g.addColorStop(0.55, `rgba(255,210,150,${0.06 * dayK})`); g.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (!calm) {
      if (!beams.length) for (let i = 0; i < 5; i++) beams.push({ x: Math.random(), w: 0.05 + Math.random() * 0.08, v: 0.004 + Math.random() * 0.006, ph: Math.random() * 6 });
      for (const b of beams) {
        b.x += b.v * dt; if (b.x > 1.35) { b.x = -0.35; b.w = 0.05 + Math.random() * 0.08; }
        const a = (0.045 + 0.03 * Math.sin(R.time * 0.35 + b.ph)) * dayK;
        const x0 = b.x * w, bw = b.w * w, sl = h * 0.55;
        const lg = ctx.createLinearGradient(0, 0, 0, h);
        lg.addColorStop(0, `rgba(255,236,190,${a})`); lg.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + bw, 0); ctx.lineTo(x0 + bw + sl, h); ctx.lineTo(x0 + sl, h); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // a slanted beam of coloured window light (a quad fading toward its foot)
  function drawShaft(c, L, cx, cy, a) {
    const g = c.createLinearGradient(L.x0 - cx, L.y0 - cy, L.x1 - cx, L.y1 - cy);
    const col = `${L.color[0]},${L.color[1]},${L.color[2]}`;
    g.addColorStop(0, `rgba(${col},${a * 0.5})`); g.addColorStop(0.75, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    c.globalAlpha = 1; c.fillStyle = g;
    c.beginPath();
    c.moveTo(L.x0 - L.w0 / 2 - cx, L.y0 - cy); c.lineTo(L.x0 + L.w0 / 2 - cx, L.y0 - cy);
    c.lineTo(L.x1 + L.w1 / 2 - cx, L.y1 - cy); c.lineTo(L.x1 - L.w1 / 2 - cx, L.y1 - cy);
    c.closePath(); c.fill();
  }
  R.drawShaft = drawShaft;

  function drawTexts(ctx, cx, cy, S) {
    if (!R.texts.length) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of R.texts) {
      const a = U.clamp(t.life / t.max * 1.6, 0, 1);
      const size = Math.round((t.size || 7) * S * 0.9);
      ctx.font = `700 ${size}px "Pixelify Sans", monospace`;
      const x = (t.x - cx) * S, y = (t.y - cy) * S;
      ctx.globalAlpha = a;
      ctx.lineWidth = Math.max(2, S * 0.9);
      ctx.strokeStyle = 'rgba(14,8,24,0.95)';
      ctx.strokeText(t.str, x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, x, y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- weather
  const drops = [];
  const fog = [];
  const clouds = [];
  function drawWeather(b, W, dt, cx, cy) {
    if (!W.map.outdoor) return;
    const vw = R.viewW, vh = R.viewH;
    if (W.weather === 'rain') {
      const want = Math.floor((vw * vh) / 900);
      while (drops.length < want) drops.push({ x: Math.random() * vw, y: Math.random() * vh, s: 0.7 + Math.random() * 0.6 });
      b.strokeStyle = 'rgba(170,190,240,0.55)';
      b.lineWidth = 1;
      b.beginPath();
      for (const d of drops) {
        d.y += 260 * d.s * dt; d.x -= 50 * d.s * dt;
        if (d.y > vh) { d.y = -6; d.x = Math.random() * (vw + 40); if (Math.random() < 0.6) R.emit({ x: cx + d.x, y: cy + Math.random() * vh, vx: 0, vy: 0, life: 0.18, color: 'rgba(190,210,255,0.8)', size: 1, grav: 0 }); }
        if (d.x < -4) d.x += vw + 8;
        b.moveTo(Math.round(d.x), Math.round(d.y));
        b.lineTo(Math.round(d.x - 2), Math.round(d.y + 5));
      }
      b.stroke();
    }
    if (W.weather === 'sunny' || W.weather === 'clear') {
      // soft cloud shadows drifting over the ground (fewer on sunny days), and pollen in the sun
      const sunny = W.weather === 'sunny', day = U.clamp((W.ambient[0] * 0.3 + W.ambient[1] * 0.55 + W.ambient[2] * 0.15 - 90) / 150, 0, 1);
      if (day > 0.05) {
        if (!clouds.length) for (let i = 0; i < 4; i++) clouds.push({ x: Math.random() * 900 - 300, y: Math.random() * 700 - 200, r: 70 + Math.random() * 70, sx: 0.8 + Math.random() * 0.5 });
        for (const c of clouds) {
          c.x += 7 * dt; c.y += 2.2 * dt;
          let x = ((c.x - cx * 0.98) % 1000 + 1000) % 1000 - 300, y = ((c.y - cy * 0.98) % 800 + 800) % 800 - 250;
          b.globalAlpha = (sunny ? 0.07 : 0.11) * day;
          const spr = lightSprite([24, 20, 52], c.r);
          b.drawImage(spr, x - c.r * c.sx, y - c.r * 0.6, c.r * 2 * c.sx, c.r * 1.2);
        }
        b.globalAlpha = 1;
        if (sunny && !calm && Math.random() < dt * 2.5 * day) R.emit({ x: cx + Math.random() * vw, y: cy + Math.random() * vh, vx: 3 + Math.random() * 4, vy: -2 - Math.random() * 2, life: 3 + Math.random() * 2, color: Math.random() < 0.5 ? '#fff1b8' : '#ffe08a', size: 1, grav: -1, drag: 1 });
      }
    }
    if (W.weather === 'mist' || W.mist) {
      if (!fog.length) for (let i = 0; i < 9; i++) fog.push({ x: Math.random(), y: Math.random(), r: 60 + Math.random() * 80, v: 0.004 + Math.random() * 0.006 });
      b.globalCompositeOperation = 'source-over';
      for (const f of fog) {
        f.x += f.v * dt; if (f.x > 1.3) f.x = -0.3;
        const x = f.x * vw, y = f.y * vh;
        b.globalAlpha = 0.16;
        b.drawImage(lightSprite([200, 196, 230], f.r), x - f.r, y - f.r);
      }
      b.globalAlpha = 1;
    }
  }
  const stars = [];
  function drawStarfall(ctx, dt, S) {
    if (Math.random() < dt * 0.6) stars.push({ x: Math.random() * R.canvas.width, y: Math.random() * R.canvas.height * 0.4, vx: -(300 + Math.random() * 300) * S / 4, vy: (150 + Math.random() * 120) * S / 4, life: 1.2 });
    ctx.globalCompositeOperation = 'lighter';
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.life <= 0) { stars.splice(i, 1); continue; }
      const a = Math.min(1, s.life);
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.15, s.y - s.vy * 0.15);
      g.addColorStop(0, `rgba(255,250,220,${a})`); g.addColorStop(1, 'rgba(180,150,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1, S * 0.6);
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.15, s.y - s.vy * 0.15); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  R.resetWeatherFx = function () { drops.length = 0; fog.length = 0; };

  // screen <-> world
  R.screenToWorld = function (sx, sy) { return [sx / R.scale + R.cx, sy / R.scale + R.cy]; };
})();
