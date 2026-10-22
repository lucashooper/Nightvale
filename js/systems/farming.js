// Nightvale — farming, tile objects (debris/rocks/forage/placeables) and their drawing.
(function () {
  'use strict';
  const G = window.G, U = G.U, M = G.MAT;
  const F = (G.Farm = {});

  // ---------------------------------------------------------------- soil overlay tiles
  const soilCache = new Map();
  function soilTile(mask, wet) {
    const key = mask + (wet ? 'w' : 'd');
    if (soilCache.has(key)) return soilCache.get(key);
    const c = wet ? ['#0c0a1c', '#141236', '#1d1a46', '#282656', '#353468'] : ['#1d1424', '#2b2036', '#3b2d48', '#4c3c59', '#5e4d6a'];
    const P = new G.Pix(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const up = mask & 1, rt = mask & 2, dn = mask & 4, lf = mask & 8;
      // rounded outer corners
      if (!up && !lf && x + y < 2) continue;
      if (!up && !rt && (15 - x) + y < 2) continue;
      if (!dn && !lf && x + (15 - y) < 2) continue;
      if (!dn && !rt && (15 - x) + (15 - y) < 2) continue;
      let k = 2;
      const r = y % 4;
      if (r === 3) k = 1; else if (r === 0) k = 3;
      if (U.hash(x, y, 31 + mask) < 0.08) k = Math.max(0, k - 1);
      if (!up && y === 0) k = 0; else if (!up && y === 1) k = 1;
      if (!dn && y === 15) k = 4; else if (!dn && y === 14) k = 3;
      if (!lf && x === 0) k = Math.min(k, 1);
      if (!rt && x === 15) k = Math.min(k, 1);
      P.set(x, y, c[k]);
      // wet soil glistens: a few cool highlights
      if (wet && k >= 2 && U.hash(x, y, 77 + mask) < 0.045) P.set(x, y, '#6f7ec8');
    }
    const cv = P.canvas();
    soilCache.set(key, cv);
    return cv;
  }

  F.isFarm = (map, x, y) => map.farm.has(map.idx(x, y));
  F.drawSoil = function (ctx, map, ox, oy, cx, cy, vw, vh) {
    if (!map.farm.size) return;
    const x0 = Math.floor(cx / 16) - 1, y0 = Math.floor(cy / 16) - 1, x1 = x0 + Math.ceil(vw / 16) + 2, y1 = y0 + Math.ceil(vh / 16) + 2;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const f = map.farm.get(map.idx(x, y));
      if (!f || !map.inb(x, y)) continue;
      const mask = (F.isFarm(map, x, y - 1) ? 1 : 0) | (F.isFarm(map, x + 1, y) ? 2 : 0) | (F.isFarm(map, x, y + 1) ? 4 : 0) | (F.isFarm(map, x - 1, y) ? 8 : 0);
      ctx.drawImage(soilTile(mask, f.watered), x * 16 + ox, y * 16 + oy);
      if (f.fert) { ctx.fillStyle = 'rgba(185,154,238,0.7)'; ctx.fillRect(x * 16 + 3 + ox, y * 16 + 11 + oy, 1, 1); ctx.fillRect(x * 16 + 11 + ox, y * 16 + 5 + oy, 1, 1); }
    }
  };

  // ---------------------------------------------------------------- crops
  F.stageOf = function (crop) {
    const def = G.CROPS[crop.id];
    if (crop.regrowing) return crop.days >= def.regrow ? 4 : 3;
    if (crop.days >= def.days) return 4;
    return Math.min(3, Math.floor((crop.days / def.days) * 4));
  };
  F.ripe = (crop) => F.stageOf(crop) === 4;
  F.holdingCan = () => { const it = G.Inv.selectedItem && G.Inv.selectedItem(); return !!(it && it.tool === 'can'); };

  const cropFallback = new Map();
  function cropSprite(id, stage, regrowing) {
    try {
      if (window.ItemArt) {
        if (regrowing && stage < 4 && ItemArt.cropRegrow) { const c = ItemArt.cropRegrow(id); if (c) return c; }
        if (ItemArt.crop) { const c = ItemArt.crop(id, stage); if (c) return c; }
      }
    } catch (e) { /* fallback */ }
    const key = id + stage;
    if (cropFallback.has(key)) return cropFallback.get(key);
    const P = new G.Pix(16, 32);
    const h = 3 + stage * 3;
    for (let y = 0; y < h; y++) P.set(8, 28 - y, '#337450');
    if (stage >= 1) { P.set(7, 27, '#4c9061'); P.set(9, 26, '#4c9061'); }
    if (stage >= 2) { P.set(6, 25, '#74b46e'); P.set(10, 24, '#74b46e'); }
    const g = (G.CROPS[id] && G.CROPS[id].glow) || [185, 154, 238];
    if (stage === 4) P.disc(8, 28 - h, 2, 2, `rgb(${g.join(',')})`);
    P.outline('#120c1c');
    const c = P.canvas(); cropFallback.set(key, c); return c;
  }

  F.canTill = function (map, x, y) {
    if (!map.tillable || !map.inb(x, y)) return false;
    const t = map.t(x, y);
    const ok = t === M.EARTH || (G.S.flags.altar1 && (t === M.GRASS || t === M.MEADOW || t === M.DIRT));
    return ok && !map.farm.has(map.idx(x, y)) && !map.tobj.has(map.idx(x, y)) && !map.blocked(x, y);
  };
  F.till = function (map, x, y) {
    if (!F.canTill(map, x, y)) return false;
    map.farm.set(map.idx(x, y), { watered: G.World.weather === 'rain', crop: null, fert: false });
    return true;
  };
  F.water = function (map, x, y) {
    const f = map.farm.get(map.idx(x, y));
    if (!f) return false;
    f.watered = true;
    return true;
  };
  F.plant = function (map, x, y, seedId) {
    const f = map.farm.get(map.idx(x, y));
    const cropId = G.item(seedId).seed;
    if (!f || f.crop || !cropId) return false;
    if (map.tobj.has(map.idx(x, y))) return false;
    f.crop = { id: cropId, days: 0, regrowing: false };
    return true;
  };
  F.harvest = function (map, x, y) {
    const f = map.farm.get(map.idx(x, y));
    if (!f || !f.crop || !F.ripe(f.crop)) return false;
    const def = G.CROPS[f.crop.id];
    let n = U.randInt(def.qty[0], def.qty[1]);
    if (def.bonus && Math.random() < def.bonus) n++;
    if (G.Stats.lucky(0.12) || Math.random() < 0.1 * G.Stats.get('farming')) n++;
    const px = x * 16 + 8, py = y * 16 + 10;
    G.dropItem(map, def.item, n, px, py, { delay: 0.25, spread: 10 });
    G.World.player.holdItem = def.item; G.World.player.holdT = 0.9;
    if (def.scream) { G.sfx('mandrake_scream'); G.R.text(px, py - 22, 'EEEEK!', '#ffb0c8', { size: 8 }); G.R.shake(1.5, 0.3); }
    else G.sfx('harvest');
    G.R.burst(px, py - 6, 10, { colors: def.glow ? [`rgb(${def.glow.join(',')})`, '#ffffff'] : ['#74b46e', '#b4ffd9'], speed: 35, life: 0.5, grav: 40, up: 30 });
    if (def.regrow) { f.crop.regrowing = true; f.crop.days = 0; }
    else f.crop = null;
    G.S.stats.harvested = (G.S.stats.harvested || 0) + n;
    if (!G.S.flags.firstHarvest) { G.S.flags.firstHarvest = true; const ft = window.GAMETEXT && GAMETEXT.misc && GAMETEXT.misc.firstHarvest; if (ft) setTimeout(() => G.UI.say(null, Array.isArray(ft) ? ft : [ft]), 600); }
    if (!G.S.flags.firstHarvest) { G.S.flags.firstHarvest = true; G.emit('firstHarvest'); }
    G.emit('harvest', def.item, n);
    return true;
  };
  // overnight growth for a farm map
  F.grow = function (map, rainTonight, fullMoon) {
    const crows = [...map.tobj.values()].filter((o) => o.kind === 'scarecrow');
    for (const [idx, f] of map.farm) {
      const watered = f.watered || rainTonight;
      if (f.crop && watered) {
        const x = idx % map.w, y = Math.floor(idx / map.w);
        const near = crows.some((o) => Math.max(Math.abs(o.tx - x), Math.abs(o.ty - y)) <= 3);
        let d = 1 + (f.fert ? 0.34 : 0) + (fullMoon ? 1 : 0) + (near ? 0.25 : 0);
        f.crop.days += d;
      }
      f.watered = false;
    }
  };
  // dew crystals water their surroundings each morning
  F.dewMorning = function (map) {
    for (const o of map.tobj.values()) {
      if (o.kind === 'sprinkler') { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (i || j) F.water(map, o.tx + i, o.ty + j); continue; }
      if (o.kind !== 'dewcrystal') continue;
      for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.abs(i) + Math.abs(j) <= 2) F.water(map, o.tx + i, o.ty + j);
    }
  };

  // ---------------------------------------------------------------- nodes (debris, rocks, ore) & forage
  // node types: tool needed, hp, drops
  F.NODES = {
    weed: { tool: 'sword', hp: 1, drops: [['fiber', 0.7, 1, 1]], sfx: 'harvest', solid: true },
    twig: { tool: 'axe', hp: 1, drops: [['wood', 1, 1, 2]], sfx: 'axe_chop', solid: true },
    pebble: { tool: 'pickaxe', hp: 1, drops: [['stone', 1, 1, 1]], sfx: 'pickaxe_hit', solid: true },
    stump: { tool: 'axe', hp: 4, drops: [['wood', 1, 4, 7]], sfx: 'axe_chop', solid: true, minTier: 0 },
    boulder: { tool: 'pickaxe', hp: 6, drops: [['stone', 1, 5, 9]], sfx: 'pickaxe_hit', solid: true, minTier: 1 },
    rock: { tool: 'pickaxe', hp: 2, drops: [['stone', 1, 1, 2]], sfx: 'pickaxe_hit', solid: true },
    ore_glimmer: { tool: 'pickaxe', hp: 3, drops: [['ore_glimmer', 1, 1, 3], ['stone', 0.5, 1, 1]], sfx: 'pickaxe_hit', solid: true },
    ore_shadow: { tool: 'pickaxe', hp: 5, drops: [['ore_shadow', 1, 1, 3], ['stone', 0.5, 1, 1]], sfx: 'pickaxe_hit', solid: true },
    ore_starsilver: { tool: 'pickaxe', hp: 7, drops: [['ore_starsilver', 1, 1, 2], ['stone', 0.5, 1, 1]], sfx: 'pickaxe_hit', solid: true },
    gem_amethyst: { tool: 'pickaxe', hp: 4, drops: [['amethyst', 1, 1, 1]], sfx: 'pickaxe_hit', solid: true, gem: true },
    gem_emerald: { tool: 'pickaxe', hp: 5, drops: [['emerald', 1, 1, 1]], sfx: 'pickaxe_hit', solid: true, gem: true },
    gem_moonstone: { tool: 'pickaxe', hp: 6, drops: [['moonstone', 1, 1, 1]], sfx: 'pickaxe_hit', solid: true, gem: true },
    gem_quartz: { tool: 'pickaxe', hp: 3, drops: [['quartz', 1, 1, 2]], sfx: 'pickaxe_hit', solid: true, gem: true },
    gem_voidcrystal: { tool: 'pickaxe', hp: 8, drops: [['voidcrystal', 1, 1, 1]], sfx: 'pickaxe_hit', solid: true, gem: true },
    starshard: { tool: 'pickaxe', hp: 2, drops: [['starshard', 1, 1, 2]], sfx: 'pickaxe_hit', solid: true, gem: true, glow: [242, 196, 90] },
  };
  F.makeNode = (type, v, extra) => Object.assign({ kind: 'node', type, v: v || 0, hp: F.NODES[type].hp, solid: F.NODES[type].solid }, extra || {});
  F.makeForage = (id) => ({ kind: 'forage', id, solid: false });

  const nodeFallback = new Map();
  function nodeSprite(o) {
    const art = o.art || o.type;
    try { if (window.ItemArt && ItemArt.node) { const c = ItemArt.node(art, o.v || 0); if (c) return c; } } catch (e) { /* fallback */ }
    const key = art + (o.v || 0);
    if (nodeFallback.has(key)) return nodeFallback.get(key);
    const P = new G.Pix(16, 16);
    if (art === 'weed') { for (let k = 0; k < 6; k++) P.vline(4 + k * 2, 9 + (k % 3), 15, k % 2 ? '#4c9061' : '#337450'); }
    else if (art === 'twig') { P.line(3, 13, 12, 10, '#7a5a48'); P.line(6, 12, 9, 8, '#574039'); }
    else if (art === 'stump') { P.rect(3, 6, 10, 9, '#574039'); P.disc(8, 6, 5, 2, '#9c7a5e'); }
    else { P.disc(8, 10, 6, 5, art.indexOf('gem') === 0 ? '#8f6cd1' : art.indexOf('ore') === 0 ? '#9c7a5e' : '#605f78'); P.disc(6, 8, 2, 2, '#a09fb6'); }
    P.outline('#120c1c');
    const c = P.canvas(); nodeFallback.set(key, c); return c;
  }
  const objFallback = new Map();
  function objectSprite(id, state, frame, potion) {
    try { if (window.ItemArt && ItemArt.object) { const c = ItemArt.object(id, state, frame, potion); if (c) return c; } } catch (e) { /* fallback */ }
    const key = id + state + frame;
    if (objFallback.has(key)) return objFallback.get(key);
    const P = new G.Pix(16, 32);
    if (id === 'cauldron') { P.disc(8, 25, 7, 5, '#2d2c3e'); P.disc(8, 21, 6, 2, state === 'brewing' ? '#5dffb0' : state === 'done' ? '#e89ab8' : '#1b1429'); }
    else if (id === 'dewcrystal') { P.rect(5, 26, 6, 4, '#605f78'); P.disc(8, 20, 3, 6, '#69a1db'); }
    else { P.rect(2, 20, 12, 10, '#574039'); P.rect(2, 20, 12, 3, '#7a5a48'); P.set(8, 24, '#f2c45a'); }
    P.outline('#120c1c');
    const c = P.canvas(); objFallback.set(key, c); return c;
  }
  F.objectSprite = objectSprite;

  // drawable for a tile object
  F.objDrawable = function (map, o) {
    if (o.kind === 'encounter' || o.kind === 'digmark') return G.Encounters.drawable(map, o);
    const x = o.tx * 16, y = o.ty * 16;
    return {
      sortY: y + 15 + (o.kind === 'forage' ? -4 : 0),
      draw(ctx, ox, oy) {
        let c;
        if (o.kind === 'node') {
          c = nodeSprite(o);
          const sh = o.shake > 0 ? Math.round(Math.sin(o.shake * 60) * 1.5) : 0;
          ctx.drawImage(c, x + ox + sh + (16 - c.width) / 2, y + oy + 16 - c.height);
        } else if (o.kind === 'forage') {
          c = G.icon(o.id);
          const bob = Math.round(Math.sin(G.R.time * 2 + o.tx) * 0.6);
          ctx.globalAlpha = 0.28; ctx.fillStyle = '#0e0818'; ctx.fillRect(x + 4 + ox, y + 13 + oy, 8, 2); ctx.globalAlpha = 1;
          ctx.drawImage(c, x + ox, y + oy - 2 + bob);
        } else if (o.kind === 'cauldron') {
          const st = o.state || 'idle';
          const fr = st === 'brewing' ? Math.floor(G.R.time * 6) % 4 : st === 'done' ? Math.floor(G.R.time * 3) % 2 : 0;
          c = objectSprite('cauldron', st, fr, st === 'done' ? o.potion : undefined);
          ctx.drawImage(c, x + ox + (16 - c.width) / 2, y + oy + 16 - c.height);
        } else if (o.kind === 'dewcrystal') {
          c = objectSprite('dewcrystal', 'idle', Math.floor(G.R.time * 4) % 4);
          ctx.drawImage(c, x + ox + (16 - c.width) / 2, y + oy + 16 - c.height);
        } else if (o.kind === 'sprinkler') {
          // it sprays for the first hour of the morning, and whenever it's freshly placed
          const spray = (G.S.mins >= 360 && G.S.mins < 420) || (o.sprayT > 0);
          if (o.sprayT > 0) o.sprayT -= 1 / 60;
          c = objectSprite('dew_sprinkler', spray ? 'spray' : 'idle', spray ? Math.floor(G.R.time * 8) % 4 : 0);
          ctx.drawImage(c, x + ox + (16 - c.width) / 2, y + oy + 16 - c.height);
        } else if (o.kind === 'scarecrow') {
          c = objectSprite('moon_scarecrow', 'idle', Math.floor(G.R.time * 2) % 2);
          ctx.drawImage(c, x + ox + (16 - c.width) / 2, y + oy + 16 - c.height);
        } else if (o.kind === 'sealed' || o.kind === 'treasure') {
          c = objectSprite('treasure_chest', o.open ? 'open' : 'closed', 0);
          ctx.drawImage(c, x + ox + (16 - c.width) / 2, y + oy + 16 - c.height);
        } else if (o.kind === 'chest' || o.kind === 'offering') {
          c = objectSprite('chest', o.open ? 'open' : 'closed', 0);
          ctx.drawImage(c, x + ox + (16 - c.width) / 2, y + oy + 16 - c.height);
          if (o.kind === 'offering') {
            const a = 0.55 + 0.45 * Math.sin(G.R.time * 2.2);
            ctx.globalAlpha = a; ctx.fillStyle = '#e4d2ff';
            ctx.fillRect(x + 7 + ox, y + oy + 2, 2, 1); ctx.fillRect(x + 6 + ox, y + oy + 3, 1, 2); ctx.fillRect(x + 7 + ox, y + oy + 5, 2, 1);
            ctx.globalAlpha = 1;
          }
        }
      },
    };
  };
  // the first row with any paint in it, so markers can sit just above a short sprout
  const topCache = new WeakMap();
  function spriteTop(c) {
    let t = topCache.get(c);
    if (t == null) {
      t = 0;
      try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; outer: for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 0) { t = y; break outer; } } catch (e) { t = 0; }
      topCache.set(c, t);
    }
    return t;
  }
  F.cropDrawable = function (map, idx, f) {
    const x = (idx % map.w) * 16, y = Math.floor(idx / map.w) * 16;
    const stage = F.stageOf(f.crop);
    return {
      sortY: y + 14,
      draw(ctx, ox, oy) {
        const c = cropSprite(f.crop.id, stage, f.crop.regrowing);
        const sway = stage >= 2 && G.World.weather === 'rain' ? Math.round(Math.sin(G.R.time * 3 + idx) * 0.6) : 0;
        ctx.drawImage(c, x + ox + sway + (16 - c.width) / 2, y + oy + 16 - c.height);
        // a little droplet over thirsty crops while you hold the Dew Can
        if (!f.watered && stage < 4 && F.holdingCan()) {
          const bob = Math.round(Math.sin(G.R.time * 3 + idx * 0.7) * 1), dx = x + ox + 6, dy = y + oy + 16 - c.height + spriteTop(c) - 8 + bob;
          ctx.fillStyle = '#0e0818'; ctx.fillRect(dx + 1, dy - 1, 2, 1); ctx.fillRect(dx, dy, 4, 4); ctx.fillRect(dx + 1, dy + 4, 2, 1);
          ctx.fillStyle = '#69a1db'; ctx.fillRect(dx + 1, dy, 2, 4); ctx.fillRect(dx + 2, dy - 0, 1, 1);
          ctx.fillStyle = '#c4e6ff'; ctx.fillRect(dx + 1, dy + 1, 1, 1);
        }
      },
    };
  };
  F.cropLights = function (map, out) {
    for (const [idx, f] of map.farm) {
      if (!f.crop) continue;
      const def = G.CROPS[f.crop.id];
      if (!def.glow) continue;
      const st = F.stageOf(f.crop);
      if (st < 3) continue;
      out.push({ x: (idx % map.w) * 16 + 8, y: Math.floor(idx / map.w) * 16 + (def.trellis ? -2 : 4), r: st === 4 ? 18 : 10, color: def.glow, i: st === 4 ? 0.8 : 0.4, night: true });
    }
    for (const o of map.tobj.values()) {
      if (o.kind === 'cauldron' && o.state && o.state !== 'idle') out.push({ x: o.tx * 16 + 8, y: o.ty * 16 + 2, r: 26, color: o.state === 'done' ? [255, 150, 200] : [93, 255, 176], i: 0.75, flicker: 1 });
      if (o.kind === 'dewcrystal') out.push({ x: o.tx * 16 + 8, y: o.ty * 16 + 2, r: 20, color: [105, 161, 219], i: 0.6, night: true });
      if (o.kind === 'scarecrow') out.push({ x: o.tx * 16 + 11, y: o.ty * 16 - 10, r: 26, color: [255, 200, 120], i: 0.65, night: true, flicker: 1 });
      if (o.kind === 'encounter' || o.kind === 'digmark') G.Encounters.lights(o, out);
      if (o.kind === 'offering') out.push({ x: o.tx * 16 + 8, y: o.ty * 16 + 4, r: 16, color: [190, 150, 255], i: 0.55 });
      if (o.kind === 'node' && F.NODES[o.type] && (F.NODES[o.type].gem || F.NODES[o.type].glow)) out.push({ x: o.tx * 16 + 8, y: o.ty * 16 + 8, r: 16, color: F.NODES[o.type].glow || [185, 150, 255], i: 0.45, noBloom: false });
      if (o.kind === 'forage' && (o.id === 'starshard' || o.id === 'moonlily' || o.id === 'pearl')) out.push({ x: o.tx * 16 + 8, y: o.ty * 16 + 6, r: 12, color: [200, 210, 255], i: 0.5, night: true });
    }
  };

  // hit a node with a tool; returns true if something happened
  F.hitNode = function (map, o, tool, power) {
    const def = F.NODES[o.type];
    if (!def) return false;
    const toolOk = def.tool === tool || (def.tool === 'sword' && (tool === 'sword' || tool === 'axe' || tool === 'hoe' || tool === 'pickaxe'));
    if (!toolOk) return false;
    if (def.minTier && (G.S.toolTier[tool] || 0) < def.minTier) {
      G.sfx('error'); G.UI.toast('This needs a stronger ' + tool + '.'); return true;
    }
    o.hp -= power;
    o.shake = 0.18;
    G.sfx(def.sfx || 'pickaxe_hit');
    const px = o.tx * 16 + 8, py = o.ty * 16 + 10;
    G.R.burst(px, py - 4, 4, { colors: def.tool === 'axe' ? ['#7a5a48', '#9c7a5e'] : def.tool === 'sword' ? ['#4c9061', '#74b46e'] : ['#7e7d97', '#a09fb6'], speed: 30, life: 0.35 });
    if (o.hp <= 0) {
      map.setObj(o.tx, o.ty, null);
      const luck = G.Stats.lucky(0.12), mine = def.tool === 'pickaxe' && Math.random() < 0.12 * G.Stats.get('mining');
      for (const [id, ch, a, b] of def.drops) if (Math.random() < ch) G.dropItem(map, id, U.randInt(a, b + ((luck && def.gem) || (mine && id !== 'stone') ? 1 : 0)), px, py);
      if (def.tool === 'pickaxe') { G.sfx(def.gem ? 'gem_found' : 'rock_break'); G.R.burst(px, py - 4, 10, { colors: ['#605f78', '#7e7d97', '#45445a'], speed: 50, life: 0.5 }); }
      if (o.onBreak) o.onBreak(map, o);
      G.emit('nodeBroken', map, o);
    }
    return true;
  };

  // populate debris in an area (used for the overgrown garden and daily regrowth)
  F.scatterNodes = function (map, rect, count, table, seed, filter) {
    const r = U.rng(seed);
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 25) {
      tries++;
      const x = rect[0] + Math.floor(r() * rect[2]), y = rect[1] + Math.floor(r() * rect[3]);
      if (!map.inb(x, y) || map.blocked(x, y) || map.tobj.has(map.idx(x, y)) || map.farm.has(map.idx(x, y))) continue;
      if (filter && !filter(x, y)) continue;
      const type = r.weighted(table);
      if (type.startsWith('forage:')) map.setObj(x, y, F.makeForage(type.slice(7)));
      else map.setObj(x, y, F.makeNode(type, Math.floor(r() * 3)));
      placed++;
    }
    return placed;
  };
})();
