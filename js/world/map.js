// Nightvale — map model: terrain grid, props, tile objects, collisions, builder helpers.
(function () {
  'use strict';
  const G = window.G, U = G.U, MAT = G.MAT, INFO = G.MATINFO;
  const N = () => G.Nature, S = () => G.Struct;

  // ------------------------------------------------------------------ prop registry
  const spriteCache = new Map();
  function cached(key, fn) { let v = spriteCache.get(key); if (!v) { v = fn(); spriteCache.set(key, v); } return v; }

  // foot: [w,h] tiles; solid: bool | array mask; frames: animated sprites
  const PROPS = (G.PROPS = {
    tree: { foot: [1, 1], solid: true, fade: true, make: (o) => cached('tree' + o.kind + o.v, () => N().makeTree(o.kind || 'oak', o.v || 0)) },
    bush: { foot: [1, 1], solid: true, make: (o) => cached('bush' + o.kind + o.v, () => N().makeBush(o.kind || 'plain', o.v || 0)) },
    boulder: { foot: [1, 1], solid: true, make: (o) => cached('boulder' + o.v, () => N().makeBoulder(o.v || 0, false)) },
    bigrock: { foot: [2, 1], solid: true, make: (o) => cached('bigrock' + o.v, () => N().makeBoulder(o.v || 0, true)) },
    stumpd: { foot: [1, 1], solid: true, make: (o) => cached('stumpd' + o.v, () => N().makeStump(o.v || 0)) },
    log: { foot: [2, 1], solid: true, make: (o) => cached('log' + o.v, () => N().makeLog(o.v || 0)) },
    mushrooms: { foot: [1, 1], solid: false, make: (o) => cached('mush' + o.v, () => N().makeMushrooms(o.v || 0)) },
    reeds: { foot: [1, 1], solid: false, make: (o) => cached('reeds' + o.v, () => N().makeReeds(o.v || 0)) },
    lily: { foot: [1, 1], solid: false, flat: true, make: (o) => cached('lily' + o.v, () => N().makeLilypad(o.v || 0)) },
    crystal: { foot: [1, 1], solid: true, make: (o) => cached('crystal' + o.v, () => N().makeCrystal(o.v || 0)) },
    lamp: { foot: [1, 1], solid: true, make: (o) => cached('lamp' + o.v, () => S().makeLamp(o.v || 0)) },
    fence: { foot: [1, 1], solid: true, make: (o) => cached('fence' + o.mask + (o.iron ? 'i' : ''), () => S().makeFence(o.mask || 0, o.iron)) },
    sign: { foot: [1, 1], solid: true, make: (o) => cached('sign' + o.v, () => S().makeSign(o.v || 0)) },
    bench: { foot: [2, 1], solid: true, make: () => cached('bench', () => S().makeBench()) },
    barrel: { foot: [1, 1], solid: true, make: (o) => cached('barrel' + o.v, () => S().makeBarrel(o.v || 0)) },
    crate: { foot: [1, 1], solid: true, make: (o) => cached('crate' + o.v, () => S().makeCrate(o.v || 0)) },
    well: { foot: [2, 1], solid: true, make: () => cached('well', () => S().makeWell()) },
    board: { foot: [2, 1], solid: true, make: () => cached('board', () => S().makeNoticeBoard()) },
    stall: { foot: [3, 1], solid: true, make: (o) => cached('stall' + o.v, () => S().makeStall(o.v || 0)) },
    fountain: { foot: [3, 2], solid: true, anim: true, make: () => cached('fountain', () => { const fr = [0, 1, 2, 3].map((f) => S().makeFountain(f)); return { c: fr[0], frames: fr, fps: 5, ax: 26, ay: 45, lights: [{ x: 26, y: 4, r: 40, color: [190, 210, 255], i: 0.55 }] }; }) },
    statue: { foot: [1, 1], solid: true, make: (o) => cached('statue' + o.kind, () => S().makeStatue(o.kind || 'moon')) },
    grave: { foot: [1, 1], solid: true, make: (o) => cached('grave' + o.v, () => S().makeGrave(o.v || 0)) },
    anvil: { foot: [1, 1], solid: true, make: () => cached('anvil', () => S().makeAnvil()) },
    telescope: { foot: [1, 1], solid: true, make: () => cached('telescope', () => S().makeTelescope()) },
    boat: { foot: [3, 1], solid: false, make: () => cached('boat', () => S().makeBoat()) },
    cart: { foot: [2, 1], solid: true, make: () => cached('cart', () => S().makeCart()) },
    planter: { foot: [1, 1], solid: true, make: (o) => cached('planter' + o.v, () => S().makePlanter(o.v || 0)) },
    pillar: { foot: [1, 1], solid: true, fade: true, make: (o) => cached('pillar' + o.broken, () => S().makePillar(o.broken || 0)) },
    ruinwall: { foot: [1, 1], solid: true, make: (o) => cached('rwall' + o.mask + '_' + o.v, () => S().makeRuinWall(o.mask || 0, o.v || 0)) },
    arch: { foot: [3, 1], solid: [1, 0, 1], fade: true, make: () => cached('arch', () => S().makeArch()) },
    altar: { foot: [3, 2], solid: true, anim: true, make: (o) => cached('altar' + (o.level | 0), () => { const fr = [0, 1].map((f) => S().makeAltar(o.level | 0, f)); return Object.assign({}, fr[0], { frames: fr.map((f) => f.c), fps: 1.5 }); }) },
    goddess: { foot: [2, 1], solid: true, fade: true, make: (o) => cached('goddess' + (o.restored ? 1 : 0), () => S().makeGoddess(!!o.restored)) },
    brazier: { foot: [1, 1], solid: true, anim: true, make: (o) => cached('brazier' + (o.lit ? 1 : 0), () => { const fr = [0, 1, 2].map((f) => S().makeBrazier(!!o.lit, f)); return Object.assign({}, fr[0], { frames: fr.map((f) => f.c), fps: 8 }); }) },
    house: { solid: true, fade: true, make: (o) => cached('house_' + o.id, () => S().makeHouse(o.house)) },
    tower: { foot: [3, 3], solid: true, fade: true, make: () => cached('tower', () => S().makeTower()) },
    hut: { foot: [3, 2], solid: true, fade: true, make: () => cached('hut', () => S().makeHut()) },
    treehouse: { foot: [5, 2], solid: true, fade: true, make: () => cached('treehouse', () => S().makeTreehouse()) },
    cave: { foot: [4, 2], solid: [1, 1, 1, 1, 1, 0, 0, 1], make: () => cached('cave', () => S().makeCave()) },
    custom: { foot: [1, 1], solid: true, make: (o) => o.sprite },
  });

  // ------------------------------------------------------------------ map
  class GameMap {
    constructor(id, w, h, opts) {
      opts = opts || {};
      this.id = id; this.w = w; this.h = h;
      this.name = opts.name || id;
      this.seed = opts.seed || U.strHash(id) % 100000;
      this.terrain = new Uint8Array(w * h).fill(opts.base != null ? opts.base : MAT.GRASS);
      this.solid = new Uint8Array(w * h);
      this.props = [];
      this.propAt = new Map();
      this.tobj = new Map(); // tile objects: nodes, crops, placeables, forage
      this.farm = new Map(); // idx -> {watered, crop}
      this.exits = [];
      this.spawns = {};
      this.staticLights = [];
      this.outdoor = opts.outdoor !== false;
      this.zone = opts.zone || id;
      this.decorDensity = opts.decorDensity || 0.45;
      this.baked = null;
      this.items = []; // dropped item entities
      this.entities = []; // mobs/projectiles etc. (dungeon)
      this.examine = new Map(); // idx -> flavor key for plain tiles
      this.noDecor = new Uint8Array(w * h);
      this.theme = opts.theme || null;
      this.tillable = !!opts.tillable;
    }
    idx(x, y) { return y * this.w + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    t(x, y) { return this.inb(x, y) ? this.terrain[y * this.w + x] : MAT.VOID; }
    set(x, y, m) { if (this.inb(x, y)) this.terrain[y * this.w + x] = m; }

    // ---------- builder helpers
    fill(x, y, w, h, m) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, m); return this; }
    disc(cx, cy, rx, ry, m, wob) {
      for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const n = wob ? (U.noise(x / 3, y / 3, this.seed + 7) - 0.5) * wob : 0;
        if (((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1 + n) this.set(x, y, m);
      }
      return this;
    }
    path(pts, width, m, onlyOver) {
      const r = width / 2;
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        const len = Math.max(1, Math.hypot(x1 - x0, y1 - y0));
        for (let s = 0; s <= len; s += 0.25) {
          const px = x0 + ((x1 - x0) * s) / len, py = y0 + ((y1 - y0) * s) / len;
          for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
            if ((x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2 <= r * r + 0.2) {
              if (onlyOver && !onlyOver.includes(this.t(x, y))) continue;
              this.set(x, y, m);
            }
          }
        }
      }
      return this;
    }
    // horizontal cliff band: rows y..y+h-1 become cliff between x0..x1 (inclusive)
    cliff(x0, x1, y, h) { for (let x = x0; x <= x1; x++) for (let j = 0; j < (h || 2); j++) this.set(x, y + j, MAT.CLIFF); return this; }
    vcliff(x, y0, y1, w) { for (let y = y0; y <= y1; y++) for (let i = 0; i < (w || 1); i++) this.set(x + i, y, MAT.CLIFF); return this; }
    stairs(x, y, w, h) { this.fill(x, y, w, h, MAT.STAIRS); return this; }
    replace(from, to, x, y, w, h) { x = x || 0; y = y || 0; w = w || this.w; h = h || this.h; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.t(i, j) === from) this.set(i, j, to); return this; }

    // ---------- props
    add(type, tx, ty, o) {
      o = o || {};
      const def = PROPS[type];
      if (!def) { console.warn('unknown prop', type); return null; }
      const spr = def.make(o);
      if (!spr) return null;
      let fw, fh;
      if (o.foot) [fw, fh] = o.foot;
      else if (def.foot) [fw, fh] = def.foot;
      else { fw = Math.ceil(spr.w / 16); fh = 2; }
      const p = {
        type, tx, ty, fw, fh, o, spr, def,
        x: tx * 16 + fw * 8 + (o.dx || 0), y: (ty + fh) * 16 - 1 + (o.dy || 0),
        fade: def.fade, flat: def.flat, anim: def.anim, interact: o.interact || null, alpha: 1,
      };
      p.sortY = o.sortY != null ? o.sortY : p.y;
      this.props.push(p);
      const solid = o.solid != null ? o.solid : def.solid;
      if (!o.ghost) for (let j = 0; j < fh; j++) for (let i = 0; i < fw; i++) {
        const x = tx + i, y = ty + j; if (!this.inb(x, y)) continue;
        const k = j * fw + i;
        const sol = Array.isArray(solid) ? solid[k] : solid;
        const id = this.idx(x, y);
        if (sol) this.solid[id] = 1;
        this.propAt.set(id, p);
        this.noDecor[id] = 1;
      }
      if (o.noDecorPad !== false) for (let j = -1; j <= fh; j++) for (let i = -1; i <= fw; i++) if (this.inb(tx + i, ty + j) && !def.flat && type !== 'tree' && type !== 'bush') this.noDecor[this.idx(tx + i, ty + j)] = 1;
      // lights to world coords
      p.lights = (spr.lights || []).map((L) => Object.assign({}, L, { x: p.x - spr.ax + L.x, y: p.y - spr.ay + L.y }));
      p.smoke = (spr.smoke || []).map((s) => ({ x: p.x - spr.ax + s.x, y: p.y - spr.ay + s.y, color: s.color }));
      if (spr.door) p.doorTile = { x: Math.floor((p.x - spr.ax + spr.door.x) / 16), y: ty + fh - 1 };
      return p;
    }
    removeProp(p) {
      const i = this.props.indexOf(p); if (i >= 0) this.props.splice(i, 1);
      for (let j = 0; j < p.fh; j++) for (let k = 0; k < p.fw; k++) { const id = this.idx(p.tx + k, p.ty + j); if (this.propAt.get(id) === p) { this.propAt.delete(id); this.solid[id] = 0; } }
    }
    // rows of fences with auto-connections
    fenceLine(pts, iron) {
      const cells = new Set();
      for (let k = 0; k < pts.length - 1; k++) {
        let [x0, y0] = pts[k]; const [x1, y1] = pts[k + 1];
        while (true) { cells.add(x0 + ',' + y0); if (x0 === x1 && y0 === y1) break; x0 += Math.sign(x1 - x0); y0 += Math.sign(y1 - y0); }
      }
      if (pts.length === 1) cells.add(pts[0][0] + ',' + pts[0][1]);
      for (const c of cells) {
        const [x, y] = c.split(',').map(Number);
        const mask = (cells.has(x - 1 + ',' + y) ? 1 : 0) | (cells.has(x + 1 + ',' + y) ? 2 : 0) | (cells.has(x + ',' + (y - 1)) ? 4 : 0) | (cells.has(x + ',' + (y + 1)) ? 8 : 0);
        this.add('fence', x, y, { mask, iron });
      }
    }
    ruinLine(x0, x1, y, gaps) {
      for (let x = x0; x <= x1; x++) {
        if (gaps && gaps.includes(x)) continue;
        const l = x > x0 && !(gaps && gaps.includes(x - 1)), r = x < x1 && !(gaps && gaps.includes(x + 1));
        this.add('ruinwall', x, y, { mask: (l ? 1 : 0) | (r ? 2 : 0), v: (x * 7 + y * 3) % 11 });
      }
    }
    scatter(type, rect, count, seed, optsFn, avoid) {
      const r = U.rng(seed || this.seed + count);
      const [rx, ry, rw, rh] = rect;
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 30) {
        tries++;
        const x = rx + Math.floor(r() * rw), y = ry + Math.floor(r() * rh);
        if (!this.free(x, y)) continue;
        if (avoid && avoid(x, y)) continue;
        const o = optsFn ? optsFn(r, x, y) : {};
        if (o === null) continue;
        this.add(type, x, y, o); placed++;
      }
      return placed;
    }
    // free = walkable natural ground with nothing on it
    free(x, y) {
      if (!this.inb(x, y)) return false;
      const m = this.t(x, y);
      if (INFO[m].solid || m === MAT.BRIDGE || m === MAT.STAIRS || m === MAT.COBBLE || m === MAT.FLOOR || m === MAT.DIRT || m === MAT.EARTH) return false;
      const id = this.idx(x, y);
      return !this.propAt.has(id) && !this.tobj.has(id) && !this.solid[id];
    }
    // tree border: fill a band with trees at random spacing
    forest(rect, density, kinds, seed, avoid) {
      const r = U.rng(seed || 99);
      const [rx, ry, rw, rh] = rect;
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
        if (r() > density) continue;
        if (!this.free(x, y)) continue;
        if (this.propAt.has(this.idx(x - 1, y)) && r() < 0.6) continue;
        if (avoid && avoid(x, y)) continue;
        const kind = kinds[Math.floor(r() * kinds.length)];
        if (kind === 'bush' || kind === 'bush_berry' || kind === 'bush_flower' || kind === 'bush_dark') this.add('bush', x, y, { kind: kind === 'bush' ? 'plain' : kind.slice(5), v: Math.floor(r() * 3) });
        else this.add('tree', x, y, { kind, v: Math.floor(r() * 4) });
      }
    }

    // ---------- tile objects (nodes / crops / placed items / forage)
    obj(x, y) { return this.tobj.get(this.idx(x, y)); }
    setObj(x, y, o) { const id = this.idx(x, y); if (o) { o.tx = x; o.ty = y; this.tobj.set(id, o); } else this.tobj.delete(id); }

    // ---------- collision
    blocked(tx, ty, who) {
      if (!this.inb(tx, ty)) return true;
      const id = this.idx(tx, ty);
      const m = this.terrain[id];
      if (m === MAT.VOID) return true;
      if (who && who.ghost) return false; // wraiths drift through everything inside the map
      if (who && who.fly) return m === MAT.CAVEWALL || m === MAT.CLIFF; // bats & eyes cross water, rocks, props
      if (this.solid[id] || INFO[m].solid) return true;
      const o = this.tobj.get(id);
      return !!(o && o.solid);
    }
    // AABB vs tiles
    rectBlocked(x, y, w, h, who) {
      const x0 = Math.floor(x / 16), y0 = Math.floor(y / 16), x1 = Math.floor((x + w - 0.01) / 16), y1 = Math.floor((y + h - 0.01) / 16);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.blocked(tx, ty, who)) return true;
      return false;
    }
    isWater(tx, ty) { return INFO[this.t(tx, ty)].wet; }

    bake() {
      const t0 = performance.now();
      this.baked = G.bakeTerrain(this);
      const self = this;
      this.decorBlock = (tx, ty) => self.noDecor[self.idx(tx, ty)] || self.tobj.has(self.idx(tx, ty));
      const decLights = G.decorateTerrain(this, this.baked);
      this.decorLights = decLights;
      this.bakeMs = performance.now() - t0;
    }
    allLights() {
      const out = this.staticLights.slice();
      if (this.decorLights) for (const L of this.decorLights) out.push(L);
      for (const p of this.props) if (p.lights) for (const L of p.lights) out.push(L);
      return out;
    }
  }
  G.GameMap = GameMap;
  G.propSprite = (type, o) => PROPS[type].make(o || {});
})();
