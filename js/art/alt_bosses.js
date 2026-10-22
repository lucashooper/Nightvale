// Nightvale — design alternatives (bosses): the B and C looks of the three Guild bounty bosses, picked in Settings > Designs.
// G.altArt (core.js) swaps these ids in for the originals in mobs.js when a look is chosen:
//   slime_ogre__b|c (+ the gloop slimes he sheds: slime_med__b|c, slime_small__b|c), grimjaw__b|c, deep_wyrm__b|c.
// Same anims, frame counts, fps and anchor conventions as the originals (the AI times attacks off them).
// True 1x pixel art, lit from the upper left, outline #120c1c, deterministic (seeded hash, never Math.random).
(function () {
  'use strict';
  var ROOT = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  if (!ROOT.MobArt || !ROOT.MobArt._kit) return;
  var K = ROOT.MobArt._kit;
  var OL = K.OL, mk = K.mk, A = K.A, px = K.px, clr = K.clr, rect = K.rect, line = K.line, pline = K.pline, ell = K.ell,
    spr = K.spr, blit = K.blit, outline = K.outline, over = K.over, flash = K.flash, fade = K.fade, hash = K.hash, mix = K.mix,
    cloud = K.cloud, shadowE = K.shadowE, deathPuff = K.deathPuff, leafPuff = K.leafPuff, shadeEll = K.shadeEll, jelly = K.jelly,
    bez3 = K.bez3, crystal = K.crystal, poly = K.poly, inE = K.inE, rgba = K.rgba;

  // ======================================================================= shared helpers
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  // topmost solid row of a layer in column x (or -1)
  function topAt(b, x) { for (var y = 0; y < b.h; y++) if (A(b, x, y) >= 128) return y; return -1; }
  function botAt(b, x) { for (var y = b.h - 1; y >= 0; y--) if (A(b, x, y) >= 128) return y; return -1; }
  // shaded, textured boulder (superellipse), light from the top-left (same recipe as the rocks in mobs.js)
  function rock(b, cx, cy, rx, ry, R, seed, pw) {
    pw = pw || 2.6;
    function ins(x, y) { var dx = Math.abs((x + 0.5 - cx) / rx), dy = Math.abs((y + 0.5 - cy) / ry); return Math.pow(dx, pw) + Math.pow(dy, pw) <= 1; }
    for (var y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (var x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!ins(x, y)) continue;
      var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, l = -0.55 * nx - 0.8 * ny;
      var k = l > 0.6 ? 4 : l > 0.15 ? 3 : l > -0.35 ? 2 : 1;
      if (!ins(x, y - 1) && l > -0.2) k = Math.min(R.length - 1, k + 1);
      if (!ins(x + 1, y) || !ins(x, y + 1)) k = Math.min(k, 1);
      var h = hash(x, y, seed);
      if (h < 0.1 && k > 1) k--; else if (h > 0.93 && k < 4) k++;
      px(b, x, y, R[k]);
    }
  }
  // thick tapering stroke from p0 (width w0) to p1 (width w1), coloured by side: col(x, y, across) with across in [-1, 1]
  function stroke(b, x0, y0, x1, y1, w0, w1, col) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    var minX = Math.floor(Math.min(x0, x1) - Math.max(w0, w1) - 1), maxX = Math.ceil(Math.max(x0, x1) + Math.max(w0, w1) + 1);
    var minY = Math.floor(Math.min(y0, y1) - Math.max(w0, w1) - 1), maxY = Math.ceil(Math.max(y0, y1) + Math.max(w0, w1) + 1);
    for (var y = minY; y <= maxY; y++) for (var x = minX; x <= maxX; x++) {
      var qx = x + 0.5 - x0, qy = y + 0.5 - y0, t = (qx * ux + qy * uy) / L;
      if (t < 0 || t > 1) continue;
      var hw = (w0 + (w1 - w0) * t) / 2, d = qx * nx + qy * ny;
      if (Math.abs(d) > hw) continue;
      px(b, x, y, col(x, y, d / Math.max(0.5, hw), t));
    }
  }
  // a jelly whose body lets the ground show through: like K.jelly (one height field over the blobs, lit top-left),
  // but each pixel also gets an alpha (rim opaque, the thick middle clearer) and whatever is in `inner` shows
  // through, tinted by the jelly. R = [rim, deep, body, lit, highlight]
  function gel(b, blobs, R, groundY, inner, opts) {
    opts = opts || {};
    var aCore = opts.core == null ? 0.72 : opts.core, tint = opts.tint == null ? 0.42 : opts.tint;
    var x0 = b.w, y0 = b.h, x1 = 0, y1 = 0, k;
    for (k = 0; k < blobs.length; k++) { var B = blobs[k]; x0 = Math.min(x0, Math.floor(B[0] - B[2] - 1)); x1 = Math.max(x1, Math.ceil(B[0] + B[2] + 1)); y0 = Math.min(y0, Math.floor(B[1] - B[3] - 1)); y1 = Math.max(y1, Math.ceil(B[1] + B[3] + 1)); }
    function H(x, y) {
      var h = -1;
      for (var q = 0; q < blobs.length; q++) {
        var Bq = blobs[q], dx = (x - Bq[0]) / Bq[2], dy = (y - Bq[1]) / Bq[3], d = dx * dx + dy * dy;
        if (d < 1) h = Math.max(h, Math.sqrt(1 - d) * Math.min(Bq[2], Bq[3]));
      }
      return h;
    }
    function In(x, y) { return (groundY == null || y <= groundY) && H(x + 0.5, y + 0.5) >= 0; }
    for (var y = Math.max(0, y0); y <= Math.min(b.h - 1, y1); y++) for (var x = Math.max(0, x0); x <= Math.min(b.w - 1, x1); x++) {
      if (!In(x, y)) continue;
      var h0 = H(x + 0.5, y + 0.5);
      var gx = (H(x + 1.5, y + 0.5) < 0 ? -2 : H(x + 1.5, y + 0.5)) - (H(x - 0.5, y + 0.5) < 0 ? -2 : H(x - 0.5, y + 0.5));
      var gy = (H(x + 0.5, y + 1.5) < 0 ? -2 : H(x + 0.5, y + 1.5)) - (H(x + 0.5, y - 0.5) < 0 ? -2 : H(x + 0.5, y - 0.5));
      var l = (gx * 0.55 + gy * 0.8) * 0.5 + 0.15;
      var edge = !In(x - 1, y) || !In(x + 1, y) || !In(x, y - 1) || !In(x, y + 1);
      var edge2 = !In(x - 2, y) || !In(x + 2, y) || !In(x, y - 2) || !In(x, y + 2);
      var c, al;
      if (edge) { c = l > 0.45 ? R[2] : R[0]; al = 1; }
      else if (edge2 && l < -0.25) { c = R[1]; al = 0.95; }
      else {
        var kk = l > 1.1 ? 4 : l > 0.45 ? 3 : l > -0.5 ? 2 : 1;
        c = R[kk]; al = kk >= 3 ? 0.9 : edge2 ? 0.86 : aCore + (1 - aCore) * clamp(1 - h0 / 7, 0, 1) * 0.4;
      }
      if (inner && A(inner, x, y)) { var q = (y * inner.w + x) * 4, d = inner.data; c = mix([d[q], d[q + 1], d[q + 2], 255], c, edge ? 0.85 : tint); al = 1; }
      px(b, x, y, c, al);
    }
  }

  // ======================================================================= GLOOPGARR B — "Bog Brute": a hulking knuckle-walker of peat mud
  // Wide mud shoulders with the head sunk between them, long arms to the ground, a bog-oak root club he leans on like
  // a cane, reeds and duckweed growing on him, eyes like bog lights. Wears the same dented crown, gone green with age.
  var BOGO = {
    mud: ['#1a110c', '#2e2017', '#463223', '#614631', '#7d5c40', '#9e7c58'],
    weed: ['#2a4a1a', '#447426', '#6c9e34', '#a2d05a', '#d6f28e'],
    reed: ['#37331a', '#625a2c', '#958a42', '#cbbd6c'], cat: ['#2e170c', '#5a3218', '#86512a'],
    eye: ['#b4560f', '#ffbe3a', '#fff4c4'],
    crown: ['#5c3c12', '#a87826', '#e2b444', '#fff0b0'], pat: ['#2c6c58', '#5fb89a'],
    oak: ['#140e10', '#271d1d', '#3b2e29', '#56453a', '#715b49'],
    gloss: '#e6d8b4', mouth: '#120a08', tooth: '#efe6cc'
  };
  function bogPose(anim, i) {
    var p = { lift: 0, sq: 0, lean: 0, club: 'rest', reach: 0, legL: 0, legR: 0, eyes: 'n', crown: 0, splash: 0, mouth: 0 };
    if (anim === 'idle') { p.sq = i; p.mouth = i; }
    else if (anim === 'move') { // knuckle-walk: the free arm swings forward and plants, the body heaves after it
      p.lean = [-1.6, 0, 1.6, 0][i]; p.reach = [2.4, 1, -1.4, 0][i]; p.legL = i === 1 ? 2 : 0; p.legR = i === 3 ? 2 : 0; p.sq = [1, -1, 1, -1][i];
    } else if (anim === 'attack') {
      if (i === 0) { p.lean = -2; p.club = 'back'; p.sq = -2; p.eyes = 'a'; p.mouth = 2; p.reach = -2; }
      if (i === 1) { p.lift = 2; p.club = 'up'; p.legL = 2; p.legR = 2; p.sq = -2; p.eyes = 'a'; p.mouth = 2; p.reach = -3; }
      if (i === 2) { p.sq = 4; p.club = 'slam'; p.eyes = 'a'; p.splash = 1; p.mouth = 2; p.reach = 1; }
      if (i === 3) { p.sq = 2; p.club = 'slam'; p.splash = 2; p.mouth = 1; p.reach = 1; }
    } else if (anim === 'hurt') { p.sq = 2; p.lean = -1; p.eyes = 'x'; p.mouth = 2; }
    else if (anim === 'die') { p.eyes = 'x'; p.crown = 1; p.sq = 3; p.mouth = 2; }
    return p;
  }
  // the bog-oak club: a black waterlogged log, thick root-ball end with curling roots and a cap of moss
  function bogClub(b, gx, gy, hx, hy, top) {
    var O = BOGO.oak, L = mk(b.w, b.h), dx = hx - gx, dy = hy - gy, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    var gx0 = gx - ux * (top || 2.5), gy0 = gy - uy * (top || 2.5);
    stroke(L, gx0, gy0, hx, hy, 2.6, 4.4, function (x, y, a) { return a < -0.35 ? O[4] : a < 0.4 ? O[3] : O[2]; });
    // the root ball
    var rb = mk(b.w, b.h), cx = hx + ux * 1.2, cy = hy + uy * 1.2;
    shadeEll(rb, cx, cy, 3.6, 3.6, O, 3);
    over(L, rb, O[0]);
    var roots = [[0.8, 1.1], [-0.8, 1.0], [1.4, 0.3], [-1.4, 0.2]], RT = mk(b.w, b.h);
    for (var k = 0; k < roots.length; k++) {
      var ax = ux * roots[k][1] + nx * roots[k][0], ay = uy * roots[k][1] + ny * roots[k][0];
      var r0x = cx + ax * 2.6, r0y = cy + ay * 2.6, r1x = cx + ax * 3.6 + (k % 2 ? 1 : -1) * nx * 0.6, r1y = cy + ay * 3.6 + (k % 2 ? 1 : -1) * ny * 0.6;
      line(RT, r0x, r0y, r1x, r1y, O[2]); px(RT, r1x + ax * 0.8, r1y + ay * 0.8, O[3]);
    }
    for (var yy = 0; yy < b.h; yy++) for (var xx = 0; xx < b.w; xx++) if (A(RT, xx, yy) && (xx < 1 || yy < 1 || xx > b.w - 2)) clr(RT, xx, yy);
    blit(L, RT, 0, 0);
    // a wrap of reed twine at the grip, and a tuft of moss on the knob
    var t1 = [gx + ux * 0.5, gy + uy * 0.5];
    px(L, t1[0] + nx * 1.2, t1[1] + ny * 1.2, BOGO.reed[2]); px(L, t1[0], t1[1], BOGO.reed[3]); px(L, t1[0] - nx * 1.2, t1[1] - ny * 1.2, BOGO.reed[1]);
    var mx = cx - nx * 2 + (ny < 0 ? 0 : 0), my = cy - Math.abs(ny) * 2.6 - 0.6;
    px(L, mx, my, BOGO.weed[3]); px(L, mx + 1, my, BOGO.weed[2]); px(L, mx - 1, my + 1, BOGO.weed[2]); px(L, mx, my - 1, BOGO.weed[4]);
    return L;
  }
  function bogCrown(b, x, y, tilt, al) {
    var C = BOGO.crown, P = BOGO.pat;
    var rows = tilt ? ['w......', 'a..w...', 'aa.ab.w', 'bcbpbba', 'cdcpcdb', 'bbbbbbb'] : ['w..w..w', 'aa.ab.a', 'bcbpbbb', 'cdcpcdb', 'bbbbbbb'];
    spr(b, rows, { a: C[2], b: C[1], c: C[2], d: '#3aa0b0', p: P[0], w: C[3] }, x, y);
    px(b, x + 3, y + (tilt ? 2 : 1), C[0]); px(b, x + 1, y + (tilt ? 3 : 2), P[1]);
  }
  function drawBogOgre(v, anim, i) {
    if (anim === 'die' && i >= 1) return bogSplit(i);
    var M = BOGO.mud, b = mk(48, 44), k, x, y;
    var p = bogPose(anim, i), up = p.lift, sq = p.sq, L = p.lean;
    var Y = function (yy) { return yy - up + (yy < 38 ? sq * (38 - yy) / 30 : 0); };
    var lay = mk(48, 44);
    // ---- club: leant on like a cane at rest; swung back, raised high, slammed down in front
    var grip, head, top = 3.2;
    if (p.club === 'rest') { grip = [40.8 + L * 0.4, Y(26.6)]; head = [42.2 + L * 0.2, 38.4]; }
    else if (p.club === 'back') { grip = [36 + L * 0.5, Y(16.4)]; head = [41.4, Y(9)]; top = 2.4; }
    else if (p.club === 'up') { grip = [36.6, Y(17.4)]; head = [37.8, Y(10.6)]; top = 2; }
    else { grip = [35.6, Y(30.4)]; head = [41.2, 38.4]; top = 2.4; }
    var club = bogClub(lay, grip[0], grip[1], head[0], head[1], top);
    // ---- body: two high shoulder lobes with the head sunk in the dip between them, belly, stubby legs (one jelly)
    var body = mk(48, 44);
    var blobs = [
      [12.4 + L * 0.4, Y(19.4), 7 + sq * 0.2, 7.4], [34 + L * 0.6, Y(19.4), 7 + sq * 0.2, 7.4], // shoulder lobes
      [23.2 + L * 0.5, Y(23.6), 11.6 + sq * 0.4, 6.4 - sq * 0.1],     // upper back
      [23 + L * 0.3, Y(30.6), 10.6 + sq * 0.5, 8.2 - sq * 0.2],       // belly
      [17.6, Y(40.2) - p.legL, 4.2, 2.8], [28.4, Y(40.2) - p.legR, 4.2, 2.8] // legs
    ];
    jelly(body, blobs, M, 42);
    // ---- arms (own layers so they read in front of the body)
    var armL = mk(48, 44), armR = mk(48, 44), rL = p.reach;
    var shL = [11.8 + L * 0.4, Y(22.4)];
    var fistL = p.club === 'up' ? [7.6 + L, Y(30)] : p.club === 'back' ? [7.8 + L, Y(36.4)] : [Math.max(6.4, 6 + L * 0.6 + rL * 0.7), 39.2 - (rL > 1 ? 1.2 : 0)];
    jelly(armL, [[shL[0] - 0.4, shL[1] + 1.4, 4.4, 5], [(shL[0] + fistL[0]) / 2 - 0.8, (shL[1] + fistL[1]) / 2 + 0.6, 3.7, 5.4], [fistL[0], fistL[1], 4.2, 3.1]], M, 42);
    var shR = [34.6 + L * 0.6, Y(22.4)], fistR = [grip[0] - 0.4, grip[1] + 0.6];
    jelly(armR, [[shR[0] + 0.4, shR[1] + 1.2, 4.4, 5], [(shR[0] + fistR[0]) / 2 + 0.6, (shR[1] + fistR[1]) / 2, 3.6, 4.8], [fistR[0], fistR[1], 3.8, 3.1]], M, 42);
    // ---- the head, sunk between the shoulders (a little shadow pools round it)
    var hd = mk(48, 44), hx = 24 + L, hy = Y(20.6);
    jelly(hd, [[hx, hy, 6, 5.2], [hx + 0.5, hy + 2.6, 5.4, 3.4]], M, 42);
    for (y = 0; y < 44; y++) for (x = 0; x < 48; x++) {
      if (A(body, x, y) < 128 || A(hd, x, y)) continue;
      if (A(hd, x - 1, y) || A(hd, x + 1, y) || A(hd, x, y - 1) || A(hd, x - 2, y) || A(hd, x + 2, y) || A(hd, x, y + 2)) px(body, x, y, M[1]);
    }
    // brow ridge, eyes like bog lights, an underbite with one broken tusk
    var ex = Math.round(hx), ey = Math.round(hy);
    line(hd, ex - 4, ey - 2, ex + 4, ey - 2, M[2]); px(hd, ex - 4, ey - 1, M[1]); px(hd, ex + 4, ey - 1, M[1]);
    if (p.eyes === 'x') { spr(hd, ['k.k...k.k', '.k.....k.', 'k.k...k.k'], { k: BOGO.mouth }, ex - 4, ey - 1); }
    else {
      var E = BOGO.eye, ang = p.eyes === 'a';
      spr(hd, ang ? ['kk.....kk', 'yWk...kWy', '.yy...yy.'] : ['.........', 'yW.....Wy', 'yy.....yy'], { k: M[0], y: E[1], W: E[2] }, ex - 4, ey - 1);
      px(hd, ex - 4, ey + 1, E[0]); px(hd, ex + 4, ey + 1, E[0]);
    }
    var my = ey + 4;
    if (p.mouth === 2) { rect(hd, ex - 3, my - 1, 7, 2, BOGO.mouth); line(hd, ex - 2, my + 1, ex + 2, my + 1, BOGO.mouth); px(hd, ex - 2, my - 1, BOGO.tooth); px(hd, ex + 2, my - 1, BOGO.tooth); px(hd, ex + 2, my - 2, BOGO.tooth); px(hd, ex, my + 1, '#5a1e1a'); }
    else { line(hd, ex - 3, my, ex + 3, my, BOGO.mouth); px(hd, ex - 3, my - 1, BOGO.mouth); px(hd, ex + 3, my - 1, BOGO.mouth); px(hd, ex - 2, my - 1, BOGO.tooth); px(hd, ex + 2, my - 1, BOGO.tooth); px(hd, ex + 2, my - 2, BOGO.tooth); if (p.mouth) px(hd, ex, my + 1, M[1]); }
    // ---- mud texture: peat flecks, a wet shine, duckweed on top, drips underneath
    var parts = [body, armL, armR, hd];
    for (k = 0; k < parts.length; k++) {
      var P = parts[k];
      for (y = 0; y < 44; y++) for (x = 0; x < 48; x++) {
        if (A(P, x, y) < 128) continue;
        var h = hash(x, y, 7 + k);
        if (h < 0.05) px(P, x, y, M[1]);
        else if (h > 0.97 && A(P, x, y - 1)) px(P, x, y, M[4]);
      }
    }
    for (x = 3; x < 46; x++) { // duckweed on the upward-facing mud
      for (k = 0; k < 3; k++) {
        var Pk = [body, armL, armR][k], t = topAt(Pk, x);
        if (t < 0) continue;
        var hw = hash(x, 3, 11 + k);
        if (hw < 0.62) px(Pk, x, t, BOGO.weed[hw < 0.2 ? 4 : hw < 0.42 ? 3 : 2]);
        if (hw < 0.28) px(Pk, x, t + 1, BOGO.weed[1]);
      }
    }
    px(body, 9 + L * 0.4, Y(15.4), BOGO.gloss); px(body, 10 + L * 0.4, Y(14.6), M[5]); px(body, 30 + L * 0.6, Y(15.2), BOGO.gloss); px(body, 31 + L * 0.6, Y(14.6), M[5]);
    px(armL, shL[0] - 2.4, shL[1] + 0.6, M[5]); px(hd, hx - 3.6, hy - 3.4, M[5]);
    // reeds and cattails growing from the shoulder lobes
    var rd = mk(48, 44), RE = BOGO.reed;
    var reeds = [[9, -2, 8, 1], [11, -1, 10, 0], [14, 0, 6, 0], [33, 1, 9, 1], [36, 2, 7, 0], [31, 0, 5, 0]];
    for (k = 0; k < reeds.length; k++) {
      var rx0 = Math.round(reeds[k][0] + L * 0.5), ry0 = topAt(body, rx0);
      if (ry0 < 0) continue;
      var sway = reeds[k][1] + (anim === 'move' ? [0, 1, 0, -1][i] : 0) * 0.6 + (p.club === 'back' ? -1 : p.club === 'up' ? -1 : 0);
      var rh = Math.min(reeds[k][2], ry0 - 1);
      line(rd, rx0, ry0 + 1, rx0 + sway, ry0 + 1 - rh, RE[k % 2 ? 2 : 1]);
      px(rd, rx0 + sway, ry0 + 1 - rh, RE[3]);
      if (reeds[k][3]) { // cattail
        var cx0 = rx0 + Math.round(sway * 0.7), cy0 = ry0 + 1 - Math.round(rh * 0.78);
        rect(rd, cx0, cy0, 2, 3, BOGO.cat[1]); px(rd, cx0, cy0, BOGO.cat[2]); px(rd, cx0 + 1, cy0 + 2, BOGO.cat[0]);
      }
    }
    // ---- compose: reeds, club (behind the right arm), body, arms, head; then the crown
    blit(lay, rd, 0, 0);
    over(lay, body, M[0]);
    if (p.club !== 'rest') over(lay, club, BOGO.oak[0]);
    over(lay, armL, M[0]);
    over(lay, hd, M[0]);
    if (p.club === 'rest') over(lay, club, BOGO.oak[0]);
    over(lay, armR, M[0]);
    // drips hanging under the arms and belly
    var drips = [[7, 0], [10, 1], [20, 0], [26, 1], [38, 0]];
    for (k = 0; k < drips.length; k++) {
      var dxp = Math.round(drips[k][0] + L * 0.4), db = botAt(lay, dxp);
      if (db > 30 && db < 41) { px(lay, dxp, db + 1, M[2]); if (drips[k][1] || (anim === 'idle' && i)) px(lay, dxp, db + 2, M[1]); }
    }
    var cr = mk(48, 44);
    bogCrown(cr, Math.round(hx - 3.6), Math.round(hy - 9.2) + (p.crown ? 2 : 0), p.crown);
    over(lay, cr, BOGO.crown[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (p.splash) { // mud splashes off the slam
      var sp = p.splash === 1 ? [[37, 34], [40, 30], [45, 32], [33, 39], [6, 37]] : [[34, 31], [38, 26], [45, 27], [3, 39]];
      for (k = 0; k < sp.length; k++) { px(b, sp[k][0], sp[k][1], M[4]); px(b, sp[k][0] + 1, sp[k][1], M[3]); px(b, sp[k][0], sp[k][1] + 1, M[2]); if (k < 2) px(b, sp[k][0] - 1, sp[k][1] + 1, BOGO.weed[3]); }
      line(b, 1, 42, 9, 42, '#8c7a5a', 0.55); line(b, 36, 42, 46, 42, '#8c7a5a', 0.55);
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  // death: he sags, splits into three mud blobs; the crown and reeds come down
  function bogSplit(i) {
    var M = BOGO.mud, b = mk(48, 44), lay = mk(48, 44), t = i - 1, k;
    var sets = [
      [[23, 30, 12.4, 10], [15, 22, 7.6, 6.4], [31, 22, 7.6, 6.4], [24, 18, 6, 5]],
      [[12, 33, 8.2, 7.4], [24, 30.5, 8.4, 8], [36, 33, 8.2, 7.4]],
      [[9.4, 35, 6.6, 6.2], [24, 33, 7.4, 7], [38.6, 35, 6.6, 6.2]],
      [[8.4, 39.6, 5.8, 2.6], [24, 39.8, 6.6, 2.6], [39.6, 39.6, 5.8, 2.6]]
    ][t];
    jelly(lay, sets, M, 42);
    for (var y = 0; y < 44; y++) for (var x = 0; x < 48; x++) if (A(lay, x, y) >= 128 && hash(x, y, 31) < 0.07) px(lay, x, y, M[1]);
    for (x = 2; x < 46; x++) { var tp = topAt(lay, x); if (tp >= 0 && hash(x, 5, 41) < 0.5) px(lay, x, tp, BOGO.weed[hash(x, 6, 41) < 0.4 ? 3 : 2]); }
    if (t < 3) { // each new blob opens a pair of bog-light eyes
      for (k = 0; k < sets.length; k++) { var s = sets[k]; if (s[2] < 7 && t === 0) continue; var ex = Math.round(s[0] + 1), ey = Math.round(s[1] - s[3] * 0.25); spr(lay, ['y.y', '...', 'kkk'], { y: BOGO.eye[1], k: BOGO.mouth }, ex - 1, ey); }
    }
    outline(lay, OL);
    blit(b, lay, 0, 0);
    var cr = mk(48, 44), cp = [[20, 6], [27, 13], [31, 25], [31, 36]][t];
    bogCrown(cr, cp[0], cp[1], t > 0); outline(cr, OL); blit(b, cr, 0, 0);
    // reeds flung loose
    var rl = [[[5, 18, 9, 13]], [[3, 24, 9, 21], [40, 20, 44, 26]], [[2, 32, 8, 30], [40, 30, 45, 33]], [[3, 41, 9, 41], [40, 41, 45, 40]]][t];
    for (k = 0; k < rl.length; k++) { var rr = mk(48, 44); line(rr, rl[k][0], rl[k][1], rl[k][2], rl[k][3], BOGO.reed[2]); px(rr, rl[k][2], rl[k][3], BOGO.reed[3]); outline(rr, OL); blit(b, rr, 0, 0); }
    var dr = [[[6, 20], [40, 16], [24, 8]], [[3, 26], [44, 24], [20, 16], [30, 14]], [[3, 31], [44, 30], [14, 24], [34, 22]], [[15, 41], [32, 41]]][t];
    for (var q = 0; q < dr.length; q++) { px(b, dr[q][0], dr[q][1], M[4]); px(b, dr[q][0] + 1, dr[q][1] + 1, M[3]); }
    return b;
  }
  K.defType('slime_ogre__b', {
    w: 48, h: 44, ax: 24, ay: 43,
    anims: { idle: 2, move: 4, attack: 4, hurt: 1, die: 5 },
    variants: ['default'],
    fps: { idle: 2, move: 5, attack: 6, die: 6 },
    draw: drawBogOgre
  });

  // the gloop he sheds, in the same bog mud: duckweed on top, a sprout, bog-light eyes
  function drawBogGloop(W, Hh, s, anim, i) {
    var M = BOGO.mud, b = mk(W, Hh), lay = mk(W, Hh), gy = Hh - 2;
    var cx = W / 2, rx = 6 * s, ry = 4.6 * s, lift = 0, lean = 0, face = 'n';
    if (anim === 'idle') { if (i) { rx += 0.6 * s; ry -= 0.5 * s; } }
    else if (anim === 'move') { var P = [[1.2, 0.7, 0, 0], [0.8, 1.3, 2.4, 0.6], [0.95, 1.05, 4.2, 0], [0.85, 1.2, 2, -0.4]][i]; rx *= P[0]; ry *= P[1]; lift = P[2] * s; lean = P[3] * s; }
    else if (anim === 'attack') { if (i === 0) { rx *= 1.15; ry *= 0.8; lean = -1 * s; face = 'a'; } else { rx *= 1.1; ry *= 0.95; lean = 1.2 * s; cx += 0.6 * s; face = 'b'; } }
    else if (anim === 'hurt') { rx *= 1.12; ry *= 0.85; face = 'h'; }
    else if (anim === 'die') {
      if (i === 0) { rx *= 1.25; ry *= 0.62; face = 'x'; }
      else if (i === 1 && s > 1) { jelly(lay, [[cx - 3.6 * s, gy - 2.6 * s, 3.2 * s, 2.6 * s], [cx + 3.6 * s, gy - 2.6 * s, 3.2 * s, 2.6 * s]], M, gy); weed(lay, 2); outline(lay, OL); blit(b, lay, 0, 0); return b; }
      else { var dd = i === 3 ? 0.4 : 1; jelly(lay, [[cx, gy - 0.6 * s, rx * 1.1, 1.2 * s * dd + 0.6]], M, gy); weed(lay, 3); outline(lay, OL); blit(b, lay, 0, 0);
        var drp = i === 3 ? [[2, gy - 2], [W - 3, gy - 3]] : [[3, gy - 4 * s], [W - 4, gy - 4 * s], [cx, gy - 6 * s]]; for (var q = 0; q < drp.length; q++) px(b, drp[q][0], drp[q][1], M[4]); return b; }
    }
    function weed(L, sd) { for (var x = 0; x < W; x++) { var t = topAt(L, x); if (t >= 0 && hash(x, sd, 61) < 0.6) px(L, x, t, BOGO.weed[hash(x, sd, 62) < 0.35 ? 3 : 2]); } }
    var cy = gy - ry * 0.8 - lift;
    jelly(lay, [[cx + lean * 0.4, cy, rx, ry], [cx + lean, cy - ry * 0.35, rx * 0.72, ry * 0.7]], M, gy - lift);
    for (var y = 0; y < Hh; y++) for (var x = 0; x < W; x++) if (A(lay, x, y) >= 128 && hash(x, y, 63) < 0.06) px(lay, x, y, M[1]);
    weed(lay, 1);
    // a sprout (two leaves) on top
    var sx = Math.round(cx + lean * 0.6 - 1), st = topAt(lay, sx);
    if (st > 1) { px(lay, sx, st - 1, BOGO.weed[2]); px(lay, sx - 1, st - 2, BOGO.weed[3]); if (s > 1) { px(lay, sx + 1, st - 2, BOGO.weed[4]); px(lay, sx, st - 2, BOGO.weed[2]); px(lay, sx - 2, st - 2, BOGO.weed[2]); } }
    px(lay, cx - rx * 0.5, cy - ry * 0.3, BOGO.gloss);
    var fx = Math.round(cx + lean + 0.6 * s), fy = Math.round(cy - ry * 0.05), E = BOGO.eye;
    var faces = s > 1 ? { n: ['y...y', '.....', '.kkk.'], a: ['k...k', 'y...y', '.kkk.'], b: ['k...k', 'y...y', 'kkkkk', '.kTk.'], h: ['k...k', '.k.k.', '..k..'], x: ['k.k.k.k', '.k...k.', 'k.k.k.k'] }
                      : { n: ['y.y', '...', '.k.'], a: ['y.y', '.k.'], b: ['y.y', 'kkk'], h: ['k.k', '.k.'], x: ['k.k', '.k.'] };
    var fm = faces[face] || faces.n;
    spr(lay, fm, { k: BOGO.mouth, y: E[1], T: BOGO.tooth }, fx - Math.floor(fm[0].length / 2), fy - 1);
    if (s > 1 && (face === 'n' || face === 'a')) { px(lay, fx - 2, fy - 1 + (face === 'a' ? 1 : 0), E[2]); px(lay, fx + 2, fy - 1 + (face === 'a' ? 1 : 0), E[2]); }
    outline(lay, OL);
    if (lift) shadowE(lay, cx, gy + 0.6, rx * 0.7, 0.8, 0.4);
    blit(b, lay, 0, 0);
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  K.defType('slime_med__b', { w: 20, h: 20, ax: 10, ay: 19, anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 }, variants: ['default'], fps: { idle: 3, move: 11, attack: 9, die: 9 },
    draw: function (v, anim, i) { return drawBogGloop(20, 20, 1.15, anim, i); } });
  K.defType('slime_small__b', { w: 12, h: 12, ax: 6, ay: 11, anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 }, variants: ['default'], fps: { idle: 4, move: 13, attack: 10, die: 10 },
    draw: function (v, anim, i) { return drawBogGloop(12, 12, 0.66, anim, i); } });

  // ======================================================================= GLOOPGARR C — "Jelly Glutton": a clear raspberry jelly that ate the treasury
  // One big see-through gumdrop on a melted base; everything he's swallowed floats inside (a boot, coins, a fish, a key).
  // A big cheeky face, rosy cheeks and a gold tooth; the dented crown has sunk halfway into his head; a gnawed giant
  // bone for a club.
  var GLUT = {
    R: ['#6c1038', '#a3245a', '#d6497f', '#f27aa4', '#ffc4d8'], spec: '#ffffff',
    face: '#2a0a1a', eyeW: '#ffffff', cheek: '#ff9cbc', tongue: '#e8506e', gold: ['#8a5a14', '#d89a2a', '#ffd25a', '#fff2b4'],
    bone: ['#6a5a48', '#a8977c', '#dccdb0', '#fff6e2'], boot: ['#2e1a12', '#5a3420', '#86532e'], fish: '#e8f0f4',
    crown: ['#6a4a16', '#b8862a', '#f2c45a', '#fff1c8'], ruby: '#c43a5a'
  };
  function glutPose(anim, i) {
    var p = { lift: 0, sq: 0, lean: 0, club: 'rest', eyes: 'n', mouth: 'grin', crown: 0, splash: 0, bob: 0 };
    if (anim === 'idle') { p.sq = i ? 1 : 0; p.bob = i; }
    else if (anim === 'move') { p.lean = [-1, 0, 1, 0][i]; p.sq = [1.6, -1, 1.6, -1][i]; p.lift = [0, 1, 0, 1][i]; p.bob = [1, -1, 1, -1][i]; }
    else if (anim === 'attack') {
      if (i === 0) { p.lean = -2; p.club = 'up'; p.sq = -2.4; p.eyes = 'a'; p.mouth = 'open'; p.bob = -1; }
      if (i === 1) { p.lift = 3; p.club = 'up'; p.sq = -2.4; p.eyes = 'a'; p.mouth = 'open'; p.bob = -2; }
      if (i === 2) { p.sq = 4.6; p.club = 'slam'; p.eyes = 'a'; p.mouth = 'roar'; p.splash = 1; p.bob = 2; }
      if (i === 3) { p.sq = 2.4; p.club = 'slam'; p.splash = 2; p.mouth = 'grin'; p.bob = 1; }
    } else if (anim === 'hurt') { p.sq = 2; p.lean = -1; p.eyes = 'x'; p.mouth = 'ow'; }
    else if (anim === 'die') { p.eyes = 'x'; p.crown = 1; p.sq = 3; p.mouth = 'ow'; }
    return p;
  }
  // a gnawed giant bone: shaft with a knuckle at each end, lit top-left
  function glutBone(b, x0, y0, x1, y1) {
    var Bn = GLUT.bone, L = mk(b.w, b.h), dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
    stroke(L, x0, y0, x1, y1, 3.2, 3.2, function (x, y, a) { return a < -0.3 ? Bn[3] : a < 0.45 ? Bn[2] : Bn[1]; });
    var ends = [[x0 - ux * 0.6, y0 - uy * 0.6, 1], [x1 + ux * 0.6, y1 + uy * 0.6, 1.25]];
    for (var k = 0; k < 2; k++) {
      var e = ends[k], nx = -uy, ny = ux, r = 2 * e[2];
      var kn = mk(b.w, b.h);
      shadeEll(kn, e[0] + nx * 1.5 * e[2], e[1] + ny * 1.5 * e[2], r, r, Bn, 3);
      shadeEll(kn, e[0] - nx * 1.5 * e[2], e[1] - ny * 1.5 * e[2], r, r, Bn, 3);
      over(L, kn, Bn[0]);
    }
    // a gnaw mark and a crack
    px(L, x0 + dx * 0.55 + uy * 1.4, y0 + dy * 0.55 - ux * 1.4, Bn[1]); px(L, x0 + dx * 0.6 + uy * 1.4, y0 + dy * 0.6 - ux * 1.4, Bn[1]);
    px(L, x0 + dx * 0.35, y0 + dy * 0.35, Bn[1]);
    return L;
  }
  function glutCrown(b, x, y, tilt) {
    var C = GLUT.crown;
    spr(b, tilt ? ['w......', 'a..w...', 'aa.ab.w', 'bcbcbba', 'cdcccdb', 'bbbbbbb'] : ['w..w..w', 'aa.ab.a', 'bcbcbbb', 'cdcccdb', 'bbbbbbb'], { a: C[2], b: C[1], c: C[2], d: GLUT.ruby, w: C[3] }, x, y);
    px(b, x + 3, y + (tilt ? 2 : 1), C[0]);
  }
  // swallowed loot, drawn opaque; the jelly tints whatever of it lies inside him
  function glutLoot(L, ox, oy, set) {
    var G = GLUT.gold, Bt = GLUT.boot;
    if (set & 1) { // an old boot, toe to the right
      spr(L, ['.bbb...', '.bcb...', '.bcb...', '.bcbbb.', 'bcccccb', 'aaaaaaa'], { a: Bt[0], b: Bt[1], c: Bt[2] }, ox + 12, oy + 29);
    }
    if (set & 2) { // gold coins
      var cs = [[28, 33], [31, 34], [29, 36]];
      for (var k = 0; k < cs.length; k++) { spr(L, ['.ab', 'bcd', '.d.'], { a: G[3], b: G[2], c: G[1], d: G[0] }, ox + cs[k][0], oy + cs[k][1]); }
    }
    if (set & 4) { // a fish skeleton
      var fx = ox + 20, fy = oy + 31;
      line(L, fx, fy, fx + 6, fy - 2, GLUT.fish); px(L, fx + 7, fy - 2, GLUT.fish); px(L, fx + 7, fy - 3, GLUT.fish); px(L, fx + 8, fy - 2, GLUT.fish);
      px(L, fx - 1, fy - 1, GLUT.fish); px(L, fx - 1, fy + 1, GLUT.fish);
      for (var q = 1; q < 6; q += 2) { px(L, fx + q, fy - 1 - Math.floor(q / 3), GLUT.fish); px(L, fx + q, fy + 1 - Math.floor(q / 3), GLUT.fish); }
    }
    if (set & 8) { // a key
      spr(L, ['.gg....', 'g.g....', '.gggggg', '....g.g'], { g: G[2] }, ox + 30, oy + 26);
    }
  }
  function drawGlutton(v, anim, i) {
    if (anim === 'die' && i >= 1) return glutSplit(i);
    var R = GLUT.R, b = mk(48, 44), k, x, y;
    var p = glutPose(anim, i), up = p.lift, sq = p.sq, L = p.lean;
    var Y = function (yy) { return yy - up + (yy < 40 ? sq * (40 - yy) / 32 : 0); };
    // ---- the bone club
    var b0, b1;
    if (p.club === 'rest') { b0 = [39.6 + L * 0.5, Y(34)]; b1 = [41.2 + L * 0.3, Y(17.4)]; }
    else if (p.club === 'up') { b0 = [37 + L, Y(21.5)]; b1 = [31.6 + L, Y(11.4)]; }
    else { b0 = [34.2, Y(29.4)]; b1 = [41.2, 38.4]; }
    var bone = glutBone(b, b0[0], b0[1], b1[0], b1[1]);
    // ---- the crown, sunk into the top of his head
    var crown = mk(48, 44), hx = 25 + L, topY = Y(10.6);
    glutCrown(crown, Math.round(hx - 4), Math.round(topY - 2.8) + (p.crown ? 2 : 0), p.crown);
    // ---- jelly blobs: a big gumdrop on a melted base, stubby arms
    var blobs = [
      [24 + L * 0.5, Y(25.4), 15 + sq * 0.55, 14.4 - sq * 0.25],
      [24 + L * 0.2, Y(36.6), 17 + sq * 0.6, 6.2],
      [9.4 + L * 0.3, Y(29.4), 4.4, 4.6]
    ];
    var arm = p.club === 'up' ? [35.6 + L, Y(19.6), 4.2, 5] : p.club === 'slam' ? [36.2, Y(29.4), 4.6, 4.4] : [39 + L * 0.6, Y(30.6), 4.4, 4.8];
    blobs.push(arm);
    // ---- what's inside
    var inner = mk(48, 44);
    glutLoot(inner, Math.round(L * 0.3), Math.round(p.bob - up + sq * 0.4), 15);
    // bubbles
    var bub = [[15, Y(22)], [33, Y(31)], [18, Y(36)], [12, Y(27)]];
    for (k = 0; k < bub.length; k++) { px(inner, bub[k][0], bub[k][1] + p.bob, R[4]); if (k < 2) px(inner, bub[k][0] + 1, bub[k][1] + p.bob - 1, '#ffffff'); }
    blit(inner, crown, 0, 0); blit(inner, bone, 0, 0);
    var J = mk(48, 44);
    gel(J, blobs, R, 42, inner, { core: 0.7, tint: 0.5 });
    // ---- the face: big glossy eyes under cross brows, rosy cheeks, a grin with a gold tooth
    var fx = Math.round(hx), fy = Math.round(Y(19.4)), F = GLUT.face;
    if (p.eyes === 'x') { spr(J, ['k.k....k.k', '.k......k.', 'k.k....k.k'], { k: F }, fx - 5, fy); }
    else {
      var eye = ['.kk.', 'kWkk', 'kkkk', '.kk.'];
      spr(J, eye, { k: F, W: GLUT.eyeW }, fx - 6, fy - 1); spr(J, eye, { k: F, W: GLUT.eyeW }, fx + 2, fy - 1);
      px(J, fx - 4, fy + 1, '#ffffff', 0.55); px(J, fx + 4, fy + 1, '#ffffff', 0.55);
      if (p.eyes === 'a') { line(J, fx - 7, fy - 3, fx - 3, fy - 2, F); line(J, fx + 6, fy - 3, fx + 2, fy - 2, F); }
      else { line(J, fx - 6, fy - 3, fx - 3, fy - 3, F); line(J, fx + 2, fy - 3, fx + 5, fy - 3, F); px(J, fx - 3, fy - 2, F); px(J, fx + 2, fy - 2, F); }
    }
    rect(J, fx - 8, fy + 3, 2, 1, GLUT.cheek); rect(J, fx + 6, fy + 3, 2, 1, GLUT.cheek);
    var mo = { grin: ['k.......k', '.kWkkkGk.', '..kkkkk..'], open: ['.kkkkkkk.', 'kWkkkkkGk', 'kkkRRRkkk', '.kkkkkkk.'],
      roar: ['kkkkkkkkk', 'kWk...kGk', 'kk.RRR.kk', 'kkRRRRRkk', '.kkkkkkk.'], ow: ['..kkkkk..', '.kk...kk.', '..kkkkk..'] }[p.mouth];
    spr(J, mo, { k: F, W: '#ffffff', G: GLUT.gold[2], R: GLUT.tongue, '.': undefined }, fx - 4, fy + 4);
    // gloss: a big window highlight on the top-left of the dome
    var gx = Math.round(hx - 10 + L * 0.2), gy0 = Math.round(Y(16));
    px(J, gx, gy0, GLUT.spec); px(J, gx, gy0 + 1, GLUT.spec); px(J, gx + 1, gy0 - 1, GLUT.spec); px(J, gx + 2, gy0 - 2, R[4]); px(J, gx, gy0 + 3, R[4]);
    // light focused through the jelly pools along the inside of the base
    for (x = Math.round(hx + 1); x <= Math.round(hx + 11); x++) {
      var bb = botAt(J, x) - 2;
      if (bb > 30 && A(J, x, bb + 1) && A(J, x, bb - 1) && (x % 3 !== 0)) px(J, x, bb, R[3], 0.85);
    }
    // ---- compose: bone behind, jelly, then whatever pokes out of the jelly (crown points, the bone's far end)
    var lay = mk(48, 44);
    var fr = mk(48, 44);
    for (y = 0; y < 44; y++) for (x = 0; x < 48; x++) {
      if (A(J, x, y)) continue;
      var q = (y * 48 + x) * 4;
      if (crown.data[q + 3]) px(fr, x, y, [crown.data[q], crown.data[q + 1], crown.data[q + 2], 255]);
      else if (bone.data[q + 3]) px(fr, x, y, [bone.data[q], bone.data[q + 1], bone.data[q + 2], 255]);
    }
    blit(lay, J, 0, 0);
    over(lay, fr, OL);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (p.splash) { // pink droplets off the slam
      var sp = p.splash === 1 ? [[40, 33], [44, 29], [45, 35], [32, 38], [4, 36]] : [[37, 30], [42, 25], [45, 30], [2, 38]];
      for (k = 0; k < sp.length; k++) { px(b, sp[k][0], sp[k][1], R[3]); px(b, sp[k][0], sp[k][1] - 1, R[4]); px(b, sp[k][0] + 1, sp[k][1], R[2]); }
      line(b, 1, 42, 9, 42, '#c0a0b0', 0.55); line(b, 37, 42, 46, 42, '#c0a0b0', 0.55);
    }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  // death: he splits into three clear blobs, the loot spills out and the crown rolls away
  function glutSplit(i) {
    var R = GLUT.R, b = mk(48, 44), t = i - 1, k;
    var sets = [
      [[24, 29, 13.4, 11.4], [16, 22, 8, 7], [32, 22, 8, 7]],
      [[12, 33, 8.2, 7.4], [24, 30.5, 8.4, 8], [36, 33, 8.2, 7.4]],
      [[9.4, 35, 6.6, 6.2], [24, 33, 7.4, 7], [38.6, 35, 6.6, 6.2]],
      [[8.4, 39.6, 5.8, 2.6], [24, 39.8, 6.6, 2.6], [39.6, 39.6, 5.8, 2.6]]
    ][t];
    var inner = mk(48, 44), loose = mk(48, 44);
    if (t === 0) glutLoot(inner, 0, 0, 15);
    else if (t === 1) { glutLoot(inner, -3, -2, 4); glutLoot(loose, 2, 5, 3); }
    else { glutLoot(loose, 2, 6, 3); }
    var J = mk(48, 44);
    gel(J, sets, R, 42, inner, { core: 0.7, tint: 0.5 });
    if (t < 3) for (k = 0; k < sets.length; k++) { var s = sets[k]; if (s[2] < 7 && t === 0) continue; var ex = Math.round(s[0] + 1), ey = Math.round(s[1] - s[3] * 0.3); spr(J, ['k.k', '...', '.k.'], { k: GLUT.face }, ex - 1, ey); }
    var lay = mk(48, 44);
    blit(lay, J, 0, 0);
    over(lay, loose, OL);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    var cr = mk(48, 44), cp = [[19, 3], [27, 11], [31, 24], [31, 36]][t];
    glutCrown(cr, cp[0], cp[1], t > 0); outline(cr, OL); blit(b, cr, 0, 0);
    var dr = [[[6, 20], [40, 16], [24, 8]], [[3, 26], [44, 24], [20, 16], [30, 14]], [[3, 31], [44, 30], [14, 24], [34, 22]], [[15, 41], [32, 41]]][t];
    for (var q = 0; q < dr.length; q++) { px(b, dr[q][0], dr[q][1], R[3]); px(b, dr[q][0] + 1, dr[q][1] + 1, R[2]); }
    return b;
  }
  K.defType('slime_ogre__c', {
    w: 48, h: 44, ax: 24, ay: 43,
    anims: { idle: 2, move: 4, attack: 4, hurt: 1, die: 5 },
    variants: ['default'],
    fps: { idle: 2, move: 5, attack: 6, die: 6 },
    draw: drawGlutton
  });
  // the gloop he sheds: little clear raspberry jellies (the medium ones still have a coin in them)
  function drawGlutGloop(W, Hh, s, anim, i) {
    var R = GLUT.R, b = mk(W, Hh), gy = Hh - 2;
    var cx = W / 2, rx = 6 * s, ry = 4.6 * s, lift = 0, lean = 0, face = 'n';
    if (anim === 'idle') { if (i) { rx += 0.6 * s; ry -= 0.5 * s; } }
    else if (anim === 'move') { var P = [[1.2, 0.7, 0, 0], [0.8, 1.3, 2.4, 0.6], [0.95, 1.05, 4.2, 0], [0.85, 1.2, 2, -0.4]][i]; rx *= P[0]; ry *= P[1]; lift = P[2] * s; lean = P[3] * s; }
    else if (anim === 'attack') { if (i === 0) { rx *= 1.15; ry *= 0.8; lean = -1 * s; face = 'a'; } else { rx *= 1.1; ry *= 0.95; lean = 1.2 * s; cx += 0.6 * s; face = 'b'; } }
    else if (anim === 'hurt') { rx *= 1.12; ry *= 0.85; face = 'h'; }
    var lay = mk(W, Hh), J = mk(W, Hh), inner = mk(W, Hh);
    if (anim === 'die') {
      if (i === 0) { rx *= 1.25; ry *= 0.62; face = 'x'; }
      else {
        var sets = i === 1 && s > 1 ? [[cx - 3.6 * s, gy - 2.6 * s, 3.2 * s, 2.6 * s], [cx + 3.6 * s, gy - 2.6 * s, 3.2 * s, 2.6 * s]] : [[cx, gy - 0.6 * s, rx * 1.1, 1.2 * s * (i === 3 ? 0.4 : 1) + 0.6]];
        gel(J, sets, R, gy, null, { core: 0.7 }); blit(lay, J, 0, 0);
        if (s > 1 && i >= 2) spr(lay, ['.ab', 'bcd'], { a: GLUT.gold[3], b: GLUT.gold[2], c: GLUT.gold[1], d: GLUT.gold[0] }, Math.round(cx + 2), gy - 2);
        outline(lay, OL); blit(b, lay, 0, 0);
        var drp = i === 3 ? [[2, gy - 2], [W - 3, gy - 3]] : [[3, gy - 4 * s], [W - 4, gy - 4 * s], [cx, gy - 6 * s]];
        for (var q = 0; q < drp.length; q++) px(b, drp[q][0], drp[q][1], R[3]);
        return b;
      }
    }
    var cy = gy - ry * 0.8 - lift;
    if (s > 1) spr(inner, ['.ab', 'bcd', '.d.'], { a: GLUT.gold[3], b: GLUT.gold[2], c: GLUT.gold[1], d: GLUT.gold[0] }, Math.round(cx - 3 + lean * 0.3), Math.round(cy + ry * 0.2));
    gel(J, [[cx + lean * 0.4, cy, rx, ry], [cx + lean, cy - ry * 0.35, rx * 0.72, ry * 0.7]], R, gy - lift, inner, { core: 0.7, tint: 0.5 });
    px(J, cx - rx * 0.55, cy - ry * 0.45, '#ffffff'); if (s > 1) { px(J, cx - rx * 0.55, cy - ry * 0.45 + 1, '#ffffff'); px(J, cx - rx * 0.4, cy - ry * 0.7, R[4]); }
    var fx = Math.round(cx + lean + 0.6 * s), fy = Math.round(cy - ry * 0.2), E = GLUT.face;
    var faces = s > 1 ? { n: ['kk..kk', 'Wk..Wk', '......', '..kk..'], a: ['k....k', 'kk..kk', '......', '.kkkk.'], b: ['k....k', 'kk..kk', '.kkkk.', '.kRRk.'], h: ['k....k', '.k..k.', 'k....k', '..kk..'], x: ['k.k.k.k', '.k...k.', 'k.k.k.k'] }
                      : { n: ['k.k', '...', '.k.'], a: ['k.k', '.k.'], b: ['k.k', 'kkk'], h: ['k.k', '.k.'], x: ['k.k', '.k.'] };
    var fm = faces[face] || faces.n;
    spr(J, fm, { k: E, W: '#ffffff', R: GLUT.tongue }, fx - Math.floor(fm[0].length / 2), fy - 1);
    if (s > 1) { px(J, fx - 4, fy + 1, GLUT.cheek); px(J, fx + 3, fy + 1, GLUT.cheek); }
    blit(lay, J, 0, 0);
    outline(lay, OL);
    if (lift) shadowE(lay, cx, gy + 0.6, rx * 0.7, 0.8, 0.4);
    blit(b, lay, 0, 0);
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  K.defType('slime_med__c', { w: 20, h: 20, ax: 10, ay: 19, anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 }, variants: ['default'], fps: { idle: 3, move: 11, attack: 9, die: 9 },
    draw: function (v, anim, i) { return drawGlutGloop(20, 20, 1.15, anim, i); } });
  K.defType('slime_small__c', { w: 12, h: 12, ax: 6, ay: 11, anims: { idle: 2, move: 4, attack: 2, hurt: 1, die: 4 }, variants: ['default'], fps: { idle: 4, move: 13, attack: 10, die: 10 },
    draw: function (v, anim, i) { return drawGlutGloop(12, 12, 0.66, anim, i); } });

  // ======================================================================= OLD GRIMJAW — a shared wolf rig (A's pose timing), two new bodies
  // cfg: bx/by body anchor, legs {nf, ff, nh, fh: [[hipX, hipY], [kneeX, kneeY], pawX]} relative to the body, ground y,
  // stride, lunge legs; returns absolute leg points and the head/mouth/tail states the drawers read
  function wolfPose(anim, i, C) {
    var p = { bx: C.bx, by: C.by, head: 'fwd', mouth: 0, tail: 0, hdy: 0, bob: 0, lying: anim === 'die' && i >= 1, lunge: false, eyes: 'open' };
    var Lg = {}, k;
    for (k in C.legs) Lg[k] = [C.legs[k][0].slice(), C.legs[k][1].slice(), [C.legs[k][2], C.ground]];
    function mv(q, dx, pdx, lift) { Lg[q][1][0] += dx; Lg[q][2][0] += pdx; Lg[q][2][1] -= lift || 0; Lg[q][1][1] -= (lift || 0) * 0.5; }
    var S = C.stride;
    if (anim === 'idle' && i === 1) { p.hdy = 1; p.mouth = 1; p.tail = 1; }
    else if (anim === 'move') {
      p.bob = [0, -1, 0, -1][i]; p.tail = [1, 2, 1, 0][i];
      var st = [1, 0, -1, 0][i];
      mv('nf', st * 2 * S, st * 4 * S, st > 0 ? 2 : 0); mv('fh', st * 2 * S, st * 4 * S, st > 0 ? 2 : 0);
      mv('ff', -st * 2 * S, -st * 4 * S, st < 0 ? 2 : 0); mv('nh', -st * 2 * S, -st * 4 * S, st < 0 ? 2 : 0);
    } else if (anim === 'attack') {
      if (i === 0) { p.by += C.crouch; p.head = 'low'; p.mouth = 2; p.tail = 2; mv('nh', 2, 4); mv('fh', 2, 4); mv('nf', -2, -2); mv('ff', -2, -2); }
      if (i === 1) { p.bx += 2; p.by -= 2; p.head = 'lunge'; p.mouth = 3; p.tail = 3; p.lunge = true; for (k in C.lungeLegs) Lg[k] = [C.lungeLegs[k][0].slice(), C.lungeLegs[k][1].slice(), C.lungeLegs[k][2].slice()]; }
      if (i === 2) { p.bx += 2; p.by += 1; p.head = 'bite'; p.mouth = 1; p.tail = 1; }
    } else if (anim === 'hurt') { p.bx -= 2; p.head = 'low'; p.tail = 4; p.mouth = 2; p.eyes = 'shut'; }
    else if (anim === 'die' && i === 0) { p.by += C.crouch; p.head = 'low'; p.tail = 4; p.eyes = 'shut'; mv('nf', 2, 2); mv('nh', -2, -2); }
    p.by += p.bob;
    p.L = {};
    for (k in Lg) {
      var lunge = p.lunge;
      p.L[k] = [[p.bx + Lg[k][0][0], p.by + Lg[k][0][1]], [p.bx + Lg[k][1][0], p.by + Lg[k][1][1]], [p.bx + Lg[k][2][0], lunge ? Lg[k][2][1] : Lg[k][2][1]]];
    }
    return p;
  }
  // a tapered two-segment leg with a paw; lit from the left; near legs lighter
  function wolfLeg(b, F, hip, knee, paw, w0, w1, near, pawW, toe) {
    var c0 = near ? F[4] : F[2], c1 = near ? F[3] : F[1], c2 = near ? F[2] : F[0];
    var col = function (x, y, a) { return a < -0.35 ? c0 : a < 0.35 ? c1 : c2; };
    stroke(b, hip[0], hip[1], knee[0], knee[1], w0, w1, col);
    stroke(b, knee[0], knee[1], paw[0], paw[1] - 1, w1, w1 * 0.85, col);
    rect(b, paw[0] - pawW / 2 + 0.5, paw[1] - 1, pawW, 2, near ? F[3] : F[1]);
    px(b, paw[0] - pawW / 2 + 0.5, paw[1] - 1, near ? F[4] : F[2]);
    if (toe) px(b, paw[0] + pawW / 2 + 0.5, paw[1], toe);
  }
  // shaggy tufts around part of an ellipse (angles a0..a1, 0 = right, y down); light from the top-left
  function tufts(b, cx, cy, rx, ry, a0, a1, n, len, R, seed) {
    for (var k = 0; k < n; k++) {
      var t = (k + 0.5) / n, a = a0 + (a1 - a0) * t, ca = Math.cos(a), sa = Math.sin(a);
      var L = len * (0.6 + 0.7 * hash(k, 1, seed)), x0 = cx + ca * rx * 0.82, y0 = cy + sa * ry * 0.82;
      var x1 = cx + ca * (rx + L) + sa * 1.2, y1 = cy + sa * (ry + L) - ca * 0.6; // tips curl back a little
      var lit = -0.6 * ca - 0.8 * sa;
      line(b, x0, y0, x1, y1, R[lit > 0.45 ? 4 : lit > -0.1 ? 3 : 2]);
      px(b, x1, y1, R[lit > 0.45 ? 5 : lit > -0.1 ? 4 : 3]);
    }
  }

  // ======================================================================= GRIMJAW B — "Old Silvermane": the ancient pack-father
  // A front-heavy dire wolf gone silver with age: a huge shaggy mane swept back over his shoulders, the back sloping
  // down to lean hips, head carried low, lichen and tiny white flowers grown into his coat, a hunter's broken spear
  // still in his shoulder, a torn ear and one amber eye.
  var SILV = {
    F: ['#15111a', '#272027', '#3d3439', '#564c4e', '#73686a', '#938884'],
    mane: ['#3a3236', '#655c5e', '#908684', '#b9b0aa', '#dbd4cc', '#f6f0e6'],
    lichen: ['#323e2c', '#536448', '#7c8f66', '#aebf90'], flower: ['#f6f2e8', '#f2c45a'],
    eye: ['#b45a14', '#ffb43c', '#fff0c0'], scar: '#d8c6ba', scarD: '#5e4a4e',
    spear: ['#2c2018', '#4e3a28', '#76583c', '#9a7a56'], rag: ['#4e1e22', '#863434', '#b4524a'],
    nose: '#100a0e', mouth: '#2a0e14', tooth: '#f4eedf', tongue: '#b8506a'
  };
  var SILV_CFG = {
    bx: 21, by: 16, ground: 30, stride: 0.9, crouch: 2.6,
    legs: { nf: [[8, 3], [8.8, 8.4], 10], ff: [[5.2, 3], [5.6, 8.4], 6.2], nh: [[-8.6, 3.6], [-6.8, 8.4], -9.4], fh: [[-11, 3.6], [-9.4, 8.4], -12] },
    lungeLegs: { nf: [[8, 3], [12.4, 5.6], [16.4, 22]], ff: [[5.4, 3], [9.4, 7.4], [13.4, 24]], nh: [[-8.6, 3.6], [-12.2, 6.4], [-15.2, 24]], fh: [[-11, 3.6], [-14.2, 6], [-17.2, 22]] }
  };
  // one lock of hair: a tapered stroke from (x, y) along (dx, dy), lit on its upper-left side
  function lock(b, x, y, dx, dy, len, w, R) {
    var L = Math.sqrt(dx * dx + dy * dy) || 1; dx /= L; dy /= L;
    var lit = -0.6 * (-dy) - 0.8 * dx > 0; // which side of the stroke faces the light
    stroke(b, x, y, x + dx * len, y + dy * len, w, 0.9, function (xx, yy, a) { return (a < 0) === lit ? R[4] : R[3]; });
    px(b, x + dx * len, y + dy * len, R[2]);
  }
  function drawSilvermane(v, anim, i) {
    var F = SILV.F, MN = SILV.mane, b = mk(48, 32), k, x, y;
    if (anim === 'die' && i === 3) { var o = mk(48, 32); blit(o, leafPuff(3), 9, 9); blit(o, leafPuff(3), 23, 11); return o; }
    var p = wolfPose(anim, i, SILV_CFG), bx = p.bx, by = p.by;
    var lay = mk(48, 32), far = mk(48, 32), body = mk(48, 32), near = mk(48, 32);
    if (p.lying) { // down on his side, mane spread, the spear shaft pointing up
      shadeEll(body, 18.6, 24.4, 11.4, 4.2, F.slice(1), 4); shadeEll(body, 30, 22.8, 6.4, 5, MN.slice(1), 4);
      shadeEll(body, 37.6, 25, 4.2, 3, F.slice(1), 4); shadeEll(body, 41.6, 26.4, 3, 1.8, F.slice(1), 4);
      for (k = 0; k < 6; k++) lock(body, 26 + k * 1.6, 19.4 + Math.abs(k - 2.5) * 0.5, -1, -0.5 + k * 0.1, 2.6, 1.6, MN);
      line(body, 38, 27, 43, 27.6, F[0]); px(body, 44, 26.6, SILV.nose);
      line(near, 24, 27, 30, 29, F[3]); line(near, 11, 27, 16, 29, F[3]); line(body, 8, 23, 2.6, 26, F[3]); line(body, 8, 22, 3, 24, MN[3]);
      for (x = 9; x <= 24; x++) if (hash(x, 2, 71) < 0.45) px(body, x, 20 + (x % 3 === 0 ? 0 : 1), SILV.lichen[2 + (x % 2)]);
      line(body, 20, 20, 16, 14, SILV.spear[2]); line(body, 21, 20, 17, 14, SILV.spear[1]); px(body, 16, 13, SILV.spear[3]);
      if (i >= 1) { px(body, 39, 24, F[0]); px(body, 40, 24, F[0]); }
      over(lay, body, F[0]); over(lay, near, F[0]); outline(lay, OL); blit(b, lay, 0, 0);
      if (i === 2) { blit(b, leafPuff(1), 10, 7); blit(b, leafPuff(0), 25, 9); }
      return b;
    }
    var Lg = p.L;
    wolfLeg(far, F, Lg.ff[0], Lg.ff[1], Lg.ff[2], 3.6, 2.6, false, 4);
    wolfLeg(far, F, Lg.fh[0], Lg.fh[1], Lg.fh[2], 3.4, 2.2, false, 3);
    // heavy brush tail, carried low
    var tw = [[-2.8, 3, -4, 6, -3.6, 9], [-3.4, 1.4, -5.4, 3.4, -6, 6.4], [-3.4, -0.6, -5.6, 0.2, -6.6, 2.6], [-3.6, -1.2, -5.8, -1.4, -7, -0.6], [-2.2, 3.4, -3, 6.4, -2.4, 8.6]][p.tail];
    var tl = mk(48, 32), tx = bx - 11.8, ty = by - 0.4;
    var tcol = function (xx, yy, a) { return a < -0.3 ? F[4] : a < 0.4 ? F[3] : F[2]; };
    stroke(tl, tx, ty, tx + tw[0], ty + tw[1], 4.2, 4.8, tcol);
    stroke(tl, tx + tw[0], ty + tw[1], tx + tw[2], ty + tw[3], 4.8, 4, tcol);
    stroke(tl, tx + tw[2], ty + tw[3], tx + tw[4], ty + tw[5], 4, 1.8, function (xx, yy, a) { return a < 0 ? MN[4] : MN[3]; });
    px(tl, tx + tw[4], ty + tw[5], MN[5]);
    over(far, tl, F[0]);
    // body: lean hips, deep chest
    shadeEll(body, bx - 8.8, by + 1.8, 5, 4.6, F.slice(1), 4);
    shadeEll(body, bx - 1.2, by + 0.8, 9.2, 4.4, F.slice(1), 4);
    shadeEll(body, bx + 7, by + 0.6, 6.2, 6.4, F.slice(1), 4);
    // old claw scars across the haunch
    for (k = 0; k < 3; k++) { line(body, bx - 11 + k * 2, by - 0.8, bx - 9.6 + k * 2, by + 3.4, SILV.scar); px(body, bx - 9.6 + k * 2, by + 3.4, SILV.scarD); }
    // lichen patches on the back
    var lich = [[bx - 5.4, by - 3, 2], [bx - 0.6, by - 3.4, 2.2], [bx - 10, by - 2, 1.6]];
    for (k = 0; k < lich.length; k++) for (var q = 0; q < 9; q++) {
      var lx = lich[k][0] + (hash(k, q, 73) - 0.5) * lich[k][2] * 2, ly = lich[k][1] + (hash(q, k, 74) - 0.5) * 1.6;
      if (A(body, lx, ly) >= 128) px(body, lx, ly, SILV.lichen[1 + Math.floor(hash(k, q, 75) * 3)]);
    }
    // ---- the mane: a pale mass over neck and shoulders, big flame-shaped locks swept back along the crest and
    // hanging under the throat (drawn rear to front, each lit on top with a dark parting underneath)
    var mn = mk(48, 32), low = p.head === 'low' ? 1.2 : p.head === 'bite' || p.head === 'lunge' ? 0.6 : 0, mcx = bx + 6.8 + low * 0.5, mcy = by - 2.4 + low;
    shadeEll(mn, mcx, mcy, 6.6, 6, MN.slice(1), 4);
    shadeEll(mn, mcx + 3.6, mcy + 4.2, 4, 4.4, MN.slice(1), 3);
    var crest = [[-6.8, 1.8, -11.8, 2.4], [-4.6, -2.6, -10.2, -3], [-1.4, -5, -7, -7.4], [2.2, -5.4, -2.8, -9.2]];
    var throat = [[7.2, 6, 6.2, 10.8], [4.6, 7.4, 2.8, 11.6], [2, 7.2, -0.2, 10.6]];
    var flame = function (bxk, byk, tx2, ty2, hw) {
      var dx = tx2 - bxk, dy = ty2 - byk, Ln = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / Ln, ny = dx / Ln;
      if (ny > 0) { nx = -nx; ny = -ny; } // n points to the upper side
      var pts = [mcx + bxk + nx * hw, mcy + byk + ny * hw, mcx + tx2, mcy + ty2, mcx + bxk - nx * hw, mcy + byk - ny * hw, mcx + bxk - dx * 0.3, mcy + byk - dy * 0.3];
      poly(mn, pts, function (xx, yy) { var side = (xx + 0.5 - mcx - bxk) * nx + (yy + 0.5 - mcy - byk) * ny; return side > 0.6 ? MN[5] : side > -0.5 ? MN[4] : MN[3]; });
      line(mn, mcx + bxk - nx * hw * 0.9, mcy + byk - ny * hw * 0.9, mcx + tx2 - dx * 0.25, mcy + ty2 - dy * 0.25, MN[2]);
    };
    for (k = 0; k < crest.length; k++) flame(crest[k][0], crest[k][1], crest[k][2], crest[k][3], 2.3);
    for (k = 0; k < throat.length; k++) flame(throat[k][0], throat[k][1], throat[k][2], throat[k][3], 1.9);
    // lichen and tiny white flowers grown into the dark coat of his back
    var fl = [[bx - 4, by - 4.2], [bx - 9, by - 2.4], [bx + 0.6, by - 4.2]];
    for (k = 0; k < fl.length; k++) {
      var fy1 = topAt(body, Math.round(fl[k][0]));
      if (fy1 < 0) continue;
      px(body, fl[k][0], fy1, SILV.lichen[3]); px(body, fl[k][0] + 1, fy1, SILV.lichen[2]); px(body, fl[k][0] - 1, fy1 + 1, SILV.lichen[2]);
      if (k !== 1) { px(body, fl[k][0], fy1 - 1, SILV.flower[0]); px(body, fl[k][0] + 1, fy1 - 1, SILV.flower[1]); }
    }
    // ---- head, carried low in front of the mane
    var hx, hy, sdx, sdy;
    if (p.head === 'low') { hx = bx + 14.8; hy = by + 3; sdx = 4.4; sdy = 1.6; }
    else if (p.head === 'lunge') { hx = bx + 14.2; hy = by + 0.2; sdx = 4.4; sdy = 0.6; }
    else if (p.head === 'bite') { hx = bx + 14.2; hy = by + 1.2; sdx = 4.4; sdy = 1.2; }
    else { hx = bx + 14.4; hy = by - 0.8 + p.hdy; sdx = 4.4; sdy = 1.4; }
    var hd = mk(48, 32);
    shadeEll(hd, hx, hy, 4.4, 3.8, F.slice(1), 4);
    shadeEll(hd, hx + sdx, hy + sdy, 4.4, 2.4, F.slice(1), 4);
    // ears: tall dark ears out of the mane, the near one torn
    var ea = p.head === 'low' || p.head === 'lunge' ? 1.4 : 0;
    spr(hd, ['a..', 'ab.', 'abc', 'abc'], { a: F[3], b: F[2], c: F[1] }, Math.round(hx - 3.2 - ea * 0.4), Math.round(hy - 6.2 + ea * 0.4));
    spr(hd, ['w.w', 'wab', 'wab', 'abc'], { a: F[4], b: F[3], c: F[2], w: MN[3] }, Math.round(hx - 0.4 - ea * 0.2), Math.round(hy - 6.8 + ea * 0.4)); // torn: a notch in the tip
    px(hd, Math.round(hx + sdx + 3.8), Math.round(hy + sdy - 1), SILV.nose); px(hd, Math.round(hx + sdx + 3.8), Math.round(hy + sdy - 0.2), SILV.nose);
    px(hd, Math.round(hx + sdx + 3), Math.round(hy + sdy - 1.2), SILV.nose);
    // grey old-dog muzzle and brow
    line(hd, Math.round(hx + sdx - 1), Math.round(hy + sdy + 0.8), Math.round(hx + sdx + 2), Math.round(hy + sdy + 0.8), MN[3]);
    var mx = Math.round(hx + sdx - 1.2), my = Math.round(hy + sdy + 1.6);
    if (p.mouth === 1) line(hd, mx - 1, my, mx + 2, my, F[0]);
    if (p.mouth >= 2) {
      line(hd, mx - 2, my, mx + 4, my, SILV.mouth); line(hd, mx - 2, my + 1, mx + 3, my + 1, SILV.mouth);
      px(hd, mx, my - 1, SILV.tooth); px(hd, mx + 3, my - 1, SILV.tooth); px(hd, mx + 1, my + 2, SILV.tooth);
      if (p.mouth === 3) { line(hd, mx - 2, my + 2, mx + 3, my + 4, F[3]); px(hd, mx + 1, my + 2, SILV.tongue); px(hd, mx + 2, my + 2, SILV.tooth); }
    }
    var ex = Math.round(hx + 1.2), ey = Math.round(hy - 1);
    line(hd, ex - 1, ey - 1, ex + 2, ey - 1, MN[4]);
    if (p.eyes === 'shut') line(hd, ex, ey, ex + 2, ey, F[0]);
    else { rect(hd, ex, ey, 2, 1, SILV.eye[1]); px(hd, ex, ey, SILV.eye[2]); px(hd, ex + 2, ey, SILV.eye[0]); }
    line(hd, ex + 1, ey - 3, ex - 1, ey + 2, SILV.scar);
    // the broken spear, its rag still tied on
    var sp = mk(48, 32), s0 = [bx + 1.6, by - 5.6], s1 = [bx - 4.4, by - 11.6];
    stroke(sp, s0[0], s0[1], s1[0], s1[1], 1.8, 1.8, function (xx, yy, a2) { return a2 < 0 ? SILV.spear[3] : SILV.spear[2]; });
    px(sp, s1[0] - 0.4, s1[1] - 0.6, SILV.spear[3]); px(sp, s1[0] + 0.8, s1[1] - 0.4, SILV.spear[1]); // splintered end
    var rg = [s0[0] + (s1[0] - s0[0]) * 0.55, s0[1] + (s1[1] - s0[1]) * 0.55];
    px(sp, rg[0], rg[1], SILV.rag[2]); px(sp, rg[0] + 1, rg[1], SILV.rag[1]); px(sp, rg[0] + 1, rg[1] + 1, SILV.rag[1]); px(sp, rg[0] + 2, rg[1] + 2, SILV.rag[0]);
    // ---- compose
    over(body, sp, F[0]);
    over(body, mn, MN[0]);
    over(body, hd, F[0]);
    wolfLeg(near, F, Lg.nf[0], Lg.nf[1], Lg.nf[2], 4, 2.8, true, 4, MN[4]);
    wolfLeg(near, F, Lg.nh[0], Lg.nh[1], Lg.nh[2], 3.8, 2.4, true, 3, MN[3]);
    over(lay, far, F[0]);
    over(lay, body, F[0]);
    over(lay, near, F[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    if (p.lunge) { line(b, 1, 10, 5, 10, '#e8eeff', 0.5); line(b, 1, 16, 4, 16, '#e8eeff', 0.4); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  K.defType('grimjaw__b', {
    w: 48, h: 32, ax: 24, ay: 31,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['default'],
    fps: { idle: 2, move: 9, attack: 8, die: 6 },
    draw: drawSilvermane
  });

  // ======================================================================= GRIMJAW C — "Briarback": the wolf the Deepwood grew over
  // He has hunted these woods so long that they've claimed him: a hide of bark (his old scars are cracks that glow
  // with sap), a crest of thorns down the spine, a mane and brush of autumn leaves, moss on the shoulders, root claws.
  var BRIAR = {
    F: ['#170f0c', '#2a1c15', '#41301f', '#5b432d', '#785a3d', '#977652'],
    moss: ['#22381a', '#375624', '#557c30', '#7fa646'],
    leaf: ['#5e1c12', '#a5361a', '#d8602a', '#f0973a', '#f8c862'],
    thorn: ['#3a2a1e', '#7a6248', '#c4b08a', '#efe4c8'],
    eye: ['#6a9a1e', '#ccf064', '#f8ffd6'], sap: ['#9a5a12', '#f0a83a', '#ffe7a0'],
    mouth: '#1c0c08', tooth: '#efe4c8', tongue: '#9a3a3a'
  };
  // hind leg with a hock (thigh, shin back to the hock, then down to the paw)
  function hindLeg(b, F, hip, knee, paw, w0, w1, near, pawW, toe) {
    var c0 = near ? F[4] : F[2], c1 = near ? F[3] : F[1], c2 = near ? F[2] : F[0];
    var col = function (x, y, a) { return a < -0.35 ? c0 : a < 0.35 ? c1 : c2; };
    var dx = paw[0] - knee[0], dy = paw[1] - knee[1], L = Math.sqrt(dx * dx + dy * dy) || 1;
    var hock = [knee[0] + dx * 0.5 - Math.abs(dy / L) * 2, knee[1] + dy * 0.5 + (dx / L) * 2];
    stroke(b, hip[0], hip[1], knee[0], knee[1], w0 + 1, w0, col);
    stroke(b, knee[0], knee[1], hock[0], hock[1], w0 * 0.85, w1, col);
    stroke(b, hock[0], hock[1], paw[0], paw[1] - 1, w1, w1 * 0.9, col);
    rect(b, paw[0] - pawW / 2 + 0.5, paw[1] - 1, pawW, 2, near ? F[3] : F[1]);
    px(b, paw[0] - pawW / 2 + 0.5, paw[1] - 1, near ? F[4] : F[2]);
    if (toe) px(b, paw[0] + pawW / 2 + 0.5, paw[1], toe);
  }
  // an autumn leaf (3x3 diamond-ish), tilted by `t`
  function leafAt(b, x, y, c, t) {
    var L = BRIAR.leaf, d = L[Math.max(0, c - 1)], h = L[Math.min(4, c + 1)];
    x = Math.round(x); y = Math.round(y);
    if (t) { px(b, x, y, h); px(b, x + 1, y, L[c]); px(b, x - 1, y + 1, L[c]); px(b, x, y + 1, L[c]); px(b, x + 1, y + 1, d); px(b, x, y + 2, d); }
    else { px(b, x, y, h); px(b, x - 1, y + 1, L[c]); px(b, x, y + 1, L[c]); px(b, x + 1, y + 1, d); px(b, x, y + 2, d); px(b, x + 1, y + 2, d); }
  }
  // bark grain: dark fissures running along the body, broken up by a seeded hash
  function barkGrain(L, F, seed, x0, x1) {
    for (var y = 0; y < L.h; y++) for (var x = x0; x <= x1; x++) {
      if (A(L, x, y) < 128 || !A(L, x, y - 1)) continue;
      var w = (y + Math.sin(x * 0.55 + seed) * 0.9) % 3.1;
      if (w < 0.75 && hash(x, y, seed) > 0.22) px(L, x, y, F[1]);
      else if (w > 2.6 && hash(x, y, seed + 1) < 0.25) px(L, x, y, F[4]);
    }
  }
  var BRIAR_CFG = {
    bx: 21, by: 15, ground: 30, stride: 1, crouch: 2.8,
    legs: { nf: [[7.4, 3.2], [8.2, 8.8], 9.4], ff: [[4.8, 3.2], [5.2, 8.8], 5.8], nh: [[-8.6, 3.2], [-6.4, 8.4], -9.6], fh: [[-10.8, 3.2], [-8.8, 8.4], -12] },
    lungeLegs: { nf: [[7.4, 3.2], [12, 5.6], [16.4, 21]], ff: [[4.8, 3.2], [9, 7.2], [13.4, 23]], nh: [[-8.6, 3.2], [-12.6, 6], [-16.4, 23]], fh: [[-10.8, 3.2], [-14.6, 5.6], [-18.4, 21]] }
  };
  function drawBriarback(v, anim, i) {
    var F = BRIAR.F, LF = BRIAR.leaf, b = mk(48, 32), k, x, y;
    var leafPal = ['#2a1810', '#5e1c12', '#a5361a', '#d8602a', '#f8c862'];
    if (anim === 'die' && i === 3) { // nothing left but a scatter of leaves and twigs
      var o = mk(48, 32), sc = [[10, 26, 3, 0], [15, 24, 2, 1], [20, 27, 4, 0], [26, 25, 1, 1], [31, 27, 3, 0], [36, 26, 2, 1], [24, 21, 3, 1], [13, 20, 4, 0], [33, 21, 2, 0]];
      for (k = 0; k < sc.length; k++) leafAt(o, sc[k][0], sc[k][1], sc[k][2], sc[k][3]);
      line(o, 17, 29, 22, 28, F[3]); line(o, 27, 29, 31, 29, F[2]); px(o, 23, 27, F[4]);
      outline(o, OL); fade(o, 0.85); return o;
    }
    var p = wolfPose(anim, i, BRIAR_CFG), bx = p.bx, by = p.by;
    var lay = mk(48, 32), far = mk(48, 32), body = mk(48, 32), near = mk(48, 32);
    if (p.lying) { // fallen like a log; the thorns droop, leaves start to blow away
      shadeEll(body, 19, 24.6, 11.6, 4, F.slice(1), 4); shadeEll(body, 31, 24, 5, 4, F.slice(1), 4);
      shadeEll(body, 38, 25.6, 4, 2.8, F.slice(1), 4); shadeEll(body, 42, 26.8, 3, 1.6, F.slice(1), 4);
      barkGrain(body, F, 3, 0, 47);
      line(near, 24, 27.4, 30, 29, F[3]); line(near, 11, 27, 16, 29, F[3]);
      for (k = 0; k < 6; k++) { var tx0 = 10 + k * 3.4, ty0 = topAt(body, Math.round(tx0)); if (ty0 > 0) { line(body, tx0, ty0, tx0 - 2, ty0 - 1.6, BRIAR.thorn[1]); px(body, tx0 - 2, ty0 - 2, BRIAR.thorn[2]); } }
      for (k = 0; k < 5; k++) leafAt(body, 27 + k * 1.8, 20.4 + (k % 2), [2, 3, 1, 4, 2][k], k % 2);
      stroke(body, 8, 24, 2.4, 25, 2.4, 2, function () { return F[3]; }); leafAt(body, 2, 23.6, 3, 0);
      px(body, 41, 25, i === 1 ? BRIAR.eye[0] : F[0]);
      over(lay, body, F[0]); over(lay, near, F[0]); outline(lay, OL); blit(b, lay, 0, 0);
      if (i === 2) { var fl = [[6, 12, 3, 0], [14, 9, 2, 1], [22, 13, 4, 0], [30, 8, 3, 1], [38, 12, 2, 0]]; var fg = mk(48, 32); for (k = 0; k < fl.length; k++) leafAt(fg, fl[k][0], fl[k][1], fl[k][2], fl[k][3]); outline(fg, OL); blit(b, fg, 0, 0); }
      return b;
    }
    var Lg = p.L;
    wolfLeg(far, F, Lg.ff[0], Lg.ff[1], Lg.ff[2], 3.2, 2.2, false, 3);
    hindLeg(far, F, Lg.fh[0], Lg.fh[1], Lg.fh[2], 3.4, 2.2, false, 3);
    // a brush of autumn leaves for a tail
    var tw = [[-2.4, 2.2, -3.8, 4.4], [-2.8, 1, -4.8, 2.2], [-2.8, -0.6, -5, -1.2], [-3, -1.2, -5.2, -2.2], [-1.8, 2.8, -2.4, 5.6]][p.tail];
    var tl = mk(48, 32), tx = bx - 11.2, ty = by - 0.6;
    stroke(tl, tx, ty, tx + tw[0], ty + tw[1], 3.2, 2.4, function (xx, yy, a) { return a < 0 ? F[4] : F[3]; });
    var tcx = tx + tw[2], tcy = ty + tw[3];
    var tlv = [[0, 0, 3, 0], [-1.4, -1.4, 4, 1], [-1.6, 1.2, 1, 0], [0.8, -1.8, 2, 1], [-2.6, -0.2, 3, 0], [0.4, 1.6, 2, 1], [-2.2, 2, 2, 1]];
    for (k = 0; k < tlv.length; k++) leafAt(tl, tcx + tlv[k][0] - 0.5, tcy + tlv[k][1] - 1, tlv[k][2], tlv[k][3]);
    over(far, tl, F[0]);
    // body
    shadeEll(body, bx - 8.4, by + 1.2, 5, 4.6, F.slice(1), 4);
    shadeEll(body, bx - 0.8, by + 0.6, 9, 4.2, F.slice(1), 4);
    shadeEll(body, bx + 6.6, by + 0.8, 5.8, 5.6, F.slice(1), 4);
    barkGrain(body, F, 1, 0, 47);
    // old scars: cracks in the bark, glowing with sap
    for (k = 0; k < 2; k++) {
      var sx = bx - 4.6 + k * 2.6, sy = by - 0.6;
      line(body, sx - 0.6, sy, sx + 1, sy + 3.6, F[0]); line(body, sx, sy, sx + 1.4, sy + 3.4, BRIAR.sap[0]);
      px(body, sx + 0.6, sy + 1.6, BRIAR.sap[1]); if (!k) px(body, sx + 1, sy + 2.4, BRIAR.sap[2]);
    }
    // moss on the haunch and shoulder
    var mz = [[bx - 9.6, by - 3, 3.6], [bx + 4.4, by - 4.2, 3]];
    for (k = 0; k < mz.length; k++) for (x = Math.round(mz[k][0] - mz[k][2]); x <= Math.round(mz[k][0] + mz[k][2]); x++) {
      var tq = topAt(body, x); if (tq < 0) continue;
      px(body, x, tq, BRIAR.moss[3]); px(body, x, tq + 1, BRIAR.moss[hash(x, 2, 95) < 0.5 ? 2 : 1]);
      if (hash(x, 3, 95) < 0.4) px(body, x, tq + 2, BRIAR.moss[1]);
    }
    // ---- head
    var hx, hy, sdx, sdy;
    if (p.head === 'low') { hx = bx + 14.4; hy = by + 2.4; sdx = 4.4; sdy = 1.4; }
    else if (p.head === 'lunge') { hx = bx + 14.6; hy = by - 1.4; sdx = 4.6; sdy = 0.4; }
    else if (p.head === 'bite') { hx = bx + 14.6; hy = by - 0.6; sdx = 4.6; sdy = 0.8; }
    else { hx = bx + 13.4; hy = by - 4.4 + p.hdy; sdx = 4.4; sdy = 1.2; }
    var nk = mk(48, 32);
    poly(nk, [bx + 4, by - 4.2, bx + 9, by - 5, hx + 1, hy - 2, hx + 1.6, hy + 2.8, bx + 11.4, by + 3.6], function (xx, yy) { return yy < hy + 0.6 ? F[4] : F[3]; });
    over(body, nk, F[1]);
    var hd = mk(48, 32);
    shadeEll(hd, hx, hy, 4.2, 3.5, F.slice(1), 4);
    shadeEll(hd, hx + sdx, hy + sdy, 4.2, 2.1, F.slice(1), 4);
    barkGrain(hd, F, 5, 0, 47);
    px(hd, Math.round(hx + sdx + 3.6), Math.round(hy + sdy - 0.8), F[0]); px(hd, Math.round(hx + sdx + 3.6), Math.round(hy + sdy), F[0]);
    // ears: bark spikes, a leaf caught on the near one
    var ea = p.head === 'low' || p.head === 'lunge' ? 1.6 : 0;
    var er = mk(48, 32);
    poly(er, [hx - 3.4, hy - 1.6, hx - 4 - ea, hy - 7 + ea, hx - 0.8, hy - 2.8], F[2]);
    poly(er, [hx - 1.4, hy - 2.4, hx - 1.4 - ea, hy - 7.6 + ea, hx + 1.4, hy - 2.6], function (xx, yy) { return xx + 0.5 < hx - 0.8 - ea * 0.5 ? F[5] : F[4]; });
    leafAt(er, hx + 1.4 - ea, hy - 4.6 + ea * 0.5, 4, 1);
    // jaws with thorn teeth
    var mx = Math.round(hx + sdx - 1.2), my = Math.round(hy + sdy + 1.4);
    if (p.mouth === 1) line(hd, mx - 1, my, mx + 2, my, F[0]);
    if (p.mouth >= 2) {
      line(hd, mx - 2, my, mx + 4, my, BRIAR.mouth); line(hd, mx - 2, my + 1, mx + 3, my + 1, BRIAR.mouth);
      px(hd, mx - 1, my - 1, BRIAR.tooth); px(hd, mx + 1, my - 1, BRIAR.tooth); px(hd, mx + 3, my - 1, BRIAR.tooth); px(hd, mx, my + 2, BRIAR.tooth); px(hd, mx + 2, my + 2, BRIAR.tooth);
      if (p.mouth === 3) { line(hd, mx - 2, my + 2, mx + 3, my + 4, F[3]); px(hd, mx + 1, my + 2, BRIAR.tongue); }
    }
    // the eye: a knot-hole with a sap-green glow, under a thorny brow
    var ex = Math.round(hx + 1), ey = Math.round(hy - 1);
    px(hd, ex - 1, ey - 1, F[1]); line(hd, ex - 1, ey - 2, ex + 2, ey - 2, F[4]); px(hd, ex + 2, ey - 3, BRIAR.thorn[2]);
    if (p.eyes === 'shut') line(hd, ex, ey, ex + 1, ey, F[0]);
    else { px(hd, ex, ey, BRIAR.eye[2]); px(hd, ex + 1, ey, BRIAR.eye[1]); px(hd, ex, ey + 1, BRIAR.eye[0]); px(hd, ex + 1, ey + 1, F[1]); }
    // ---- the leaf mane around neck and shoulders, and the thorn crest down the spine
    var mane = mk(48, 32), lo = p.head === 'low' ? 1.6 : p.head === 'lunge' || p.head === 'bite' ? 0.8 : 0;
    var ml = [[-3.4, -4.4, 2, 0], [-1, -5.2, 3, 1], [1.4, -4.6, 4, 0], [-2.2, -2.2, 1, 1], [0.4, -2.6, 3, 0], [2.6, -1.8, 2, 1],
      [3.4, 1, 3, 0], [4.8, 3, 1, 1], [2.2, 3.4, 4, 0], [-0.2, 0.6, 2, 1]];
    var mcx = bx + 7.4 + lo * 0.6, mcy = by - 0.8 + lo;
    for (k = 0; k < ml.length; k++) leafAt(mane, mcx + ml[k][0], mcy + ml[k][1], ml[k][2], ml[k][3]);
    var crest = mk(48, 32);
    for (k = 0; k < 7; k++) {
      var cxk = Math.round(bx + 3 - k * 2.4), cyk = topAt(body, cxk);
      if (cyk < 2) continue;
      var hgt = [3, 3.6, 4, 3.6, 3.2, 2.8, 2.2][k], lean = -1.4;
      poly(crest, [cxk - 1, cyk + 1, cxk + lean * 0.5, cyk - hgt, cxk + lean, cyk - hgt - 0.6, cxk + 1.2, cyk + 1], function (xx, yy) { return yy < cyk - hgt + 1.6 ? BRIAR.thorn[3] : xx + 0.5 < cxk ? BRIAR.thorn[2] : BRIAR.thorn[1]; });
    }
    // ---- compose
    over(body, crest, BRIAR.thorn[0]);
    over(body, mane, LF[0]);
    over(body, er, F[0]);
    over(body, hd, F[0]);
    wolfLeg(near, F, Lg.nf[0], Lg.nf[1], Lg.nf[2], 3.6, 2.4, true, 3, BRIAR.thorn[2]);
    hindLeg(near, F, Lg.nh[0], Lg.nh[1], Lg.nh[2], 3.8, 2.4, true, 3, BRIAR.thorn[2]);
    over(lay, far, F[0]);
    over(lay, body, F[0]);
    over(lay, near, F[0]);
    outline(lay, OL);
    blit(b, lay, 0, 0);
    // a leaf or two shaken loose as he runs
    if (anim === 'move' || p.lunge) {
      var drift = p.lunge ? [[4, 9, 3, 0], [8, 15, 2, 1]] : [[[6, 11, 3, 0]], [[4, 14, 2, 1]], [[3, 17, 4, 0]], [[2, 20, 3, 1]]][i];
      var lv = mk(48, 32); for (k = 0; k < drift.length; k++) leafAt(lv, drift[k][0], drift[k][1], drift[k][2], drift[k][3]); outline(lv, OL); blit(b, lv, 0, 0);
    }
    if (p.lunge) { line(b, 1, 12, 5, 12, '#f0e0c0', 0.45); line(b, 1, 18, 4, 18, '#f0e0c0', 0.35); }
    if (anim === 'hurt') b = flash(b);
    return b;
  }
  K.defType('grimjaw__c', {
    w: 48, h: 32, ax: 24, ay: 31,
    anims: { idle: 2, move: 4, attack: 3, hurt: 1, die: 4 },
    variants: ['default'],
    fps: { idle: 2, move: 9, attack: 8, die: 6 },
    draw: drawBriarback
  });

  // ======================================================================= VORRAKH — shared burrow machinery (the recipe of A in mobs.js)
  // anchor = centre of the burrow hole; anything of the wyrm below the near lip of the hole is underground
  var WH = { x: 32, y: 40, rx: 11, ry: 4.4 };
  var CRY = K.WYRM.cry; // the violet crystal all three Vorrakhs share with his shard projectile and the Crystal Fang
  function wyClip(x, y) {
    var dx = x + 0.5 - WH.x;
    if (y + 0.5 > WH.y + WH.ry + 0.5) return true;
    if (Math.abs(dx) > WH.rx + 2) return false;
    var u = clamp(dx / WH.rx, -1, 1);
    return y + 0.5 > WH.y + WH.ry * Math.sqrt(1 - u * u);
  }
  function wySamples(P, r0, r1, N) {
    N = N || 40;
    var S = [], s0 = 0;
    for (var k = 0; k <= N; k++) {
      var t = k / N, p = bez3(P, t), q = bez3(P, Math.min(1, t + 0.02)), o = bez3(P, Math.max(0, t - 0.02));
      var tx = q[0] - o[0], ty = q[1] - o[1], L = Math.sqrt(tx * tx + ty * ty) || 1;
      if (k) s0 += Math.sqrt((p[0] - S[k - 1].x) * (p[0] - S[k - 1].x) + (p[1] - S[k - 1].y) * (p[1] - S[k - 1].y));
      S.push({ x: p[0], y: p[1], r: r0 + (r1 - r0) * Math.pow(t, 1.2), tx: tx / L, ty: ty / L, s: s0, t: t });
    }
    return S;
  }
  // for each pixel of the tube: the nearest sample, local normal (nx, ny), dorsal-ness and light
  function tubeEach(lay, S, fn) {
    var x0 = lay.w, y0 = lay.h, x1 = 0, y1 = 0, k;
    for (k = 0; k < S.length; k++) { x0 = Math.min(x0, Math.floor(S[k].x - S[k].r)); x1 = Math.max(x1, Math.ceil(S[k].x + S[k].r)); y0 = Math.min(y0, Math.floor(S[k].y - S[k].r)); y1 = Math.max(y1, Math.ceil(S[k].y + S[k].r)); }
    for (var y = Math.max(0, y0); y <= Math.min(lay.h - 1, y1); y++) for (var x = Math.max(0, x0); x <= Math.min(lay.w - 1, x1); x++) {
      var best = -1e9, bi = 0;
      for (k = 0; k < S.length; k++) { var dx = x + 0.5 - S[k].x, dy = y + 0.5 - S[k].y, v = S[k].r - Math.sqrt(dx * dx + dy * dy); if (v > best) { best = v; bi = k; } }
      if (best < 0) continue;
      var M = S[bi], nx = (x + 0.5 - M.x) / M.r, ny = (y + 0.5 - M.y) / M.r;
      fn(x, y, M, nx, ny, nx * M.ty - ny * M.tx, -0.55 * nx - 0.8 * ny, best, bi);
    }
  }
  // the pose keyframes (A's timing): bezier body P, head angle th, jaw, glow, spray, cracks, what's drawn, the hole
  function wyrmPose(anim, i) {
    var p = { P: [[32, 47], [22, 30], [26, 13], [38, 13]], th: 0.14, jaw: 0.06, eye: 'open', glow: false, spray: 0, crack: 0, broken: null,
      body: true, head: true, tail: false, hole: 'open', rocks: 0, dust: -1, churn: 0, sink: 0 };
    function S(P, th, jaw) { p.P = P; p.th = th; if (jaw != null) p.jaw = jaw; }
    if (anim === 'idle') { if (i) S([[32, 47], [22.5, 31], [26.5, 14], [38, 14]], 0.2); }
    else if (anim === 'move') {
      var sw = [-1, 0, 1, 0][i], dip = [0, 0.5, 1, 0.5][i];
      S([[32, 47], [22 + sw, 30 + dip], [26 + sw, 13 + dip], [38 + sw, 13 + dip]], 0.14 + sw * 0.06); p.churn = i + 1;
    } else if (anim === 'attack') {
      if (i === 0) { S([[32, 47], [22, 30], [22, 13], [33, 12]], -0.45, 0.14); p.glow = true; }
      if (i === 1) { S([[32, 47], [25, 32], [31, 15], [40, 15]], 0.18, 0.95); p.spray = 1; p.glow = true; }
      if (i === 2) { S([[32, 47], [25, 32], [31, 15], [40, 15]], 0.12, 0.85); p.spray = 2; }
      if (i === 3) { S([[32, 47], [23, 30], [27, 12.5], [38, 13]], 0.12, 0.3); }
    } else if (anim === 'hurt') { S([[32, 47], [21, 30], [23, 13], [34, 13]], -0.3, 0.5); p.eye = 'shut'; }
    else if (anim === 'die') {
      p.eye = 'shut';
      if (i === 0) { S([[32, 47], [21, 31], [22, 15], [33, 14]], -0.6, 0.9); p.crack = 1; }
      if (i === 1) { S([[32, 47], [24, 26], [37, 16], [44, 25]], 0.9, 0.35); p.crack = 2; p.broken = [1, 3]; }
      if (i === 2) { S([[32, 47], [29, 31], [40, 29], [42, 33]], 0.3, 0.2); p.crack = 3; p.broken = [0, 1, 2, 3]; p.dust = 1; }
      if (i >= 3) { p.body = false; p.hole = 'rubble'; p.dust = i === 3 ? 2 : 3; }
    } else if (anim === 'burrow') {
      if (i === 0) { S([[32, 47], [22, 31], [23, 14], [32, 13]], -0.55, 0.1); }
      if (i === 1) { S([[27, 47], [23, 14], [42, 4], [39, 22]], 1.45, 0.05); p.churn = 2; }
      if (i === 2) { S([[25, 47], [22, 24], [40, 20], [40, 50]], 1.57, 0); p.head = false; p.dust = 0; p.churn = 3; }
      if (i === 3) { S([[27, 47], [25, 35], [33, 33], [36, 38]], 0.8, 0); p.head = false; p.tail = true; p.dust = 1; }
    } else if (anim === 'emerge') {
      if (i === 0) { p.body = false; p.hole = 'mound'; p.dust = 0; }
      if (i === 1) { S([[32, 47], [32, 40], [32, 35], [32, 31]], -1.5, 0.3); p.rocks = 1; p.dust = 1; }
      if (i === 2) { S([[32, 47], [26, 32], [27, 18], [35, 15]], -0.6, 0.75); p.rocks = 2; }
      if (i === 3) { S([[32, 47], [22, 30], [26, 13], [38, 13]], 0.02, 0.3); p.rocks = 3; }
    }
    return p;
  }
  function wyPit(b, pit, wall, lip) {
    ell(b, WH.x, WH.y, WH.rx, WH.ry, pit);
    for (var x = Math.floor(WH.x - WH.rx); x <= WH.x + WH.rx; x++) {
      var u = (x + 0.5 - WH.x) / WH.rx;
      if (Math.abs(u) >= 0.95) continue;
      var top = Math.round(WH.y - WH.ry * Math.sqrt(1 - u * u));
      px(b, x, top, lip); px(b, x, top + 1, wall);
    }
  }
  var WH_RIM = (function () { var o = []; for (var k = 0; k < 12; k++) { var a = (k + 0.35) / 12 * Math.PI * 2; o.push([Math.cos(a), Math.sin(a), 1.5 + hash(k, 3, 41) * 1.3]); } return o; })();
  var WH_ROCKS = [null,
    [[22, 22, 1.6], [43, 18, 1.4], [27, 10, 1.2], [39, 7, 1.3], [17, 31, 1.2], [47, 29, 1.2]],
    [[15, 25, 1.4], [50, 22, 1.3], [19, 14, 1.1], [46, 9, 1.1], [12, 35, 1.1], [54, 33, 1.1]],
    [[10, 37, 1.2], [55, 37, 1.1], [14, 31, 1], [50, 30, 1]]];
  var WH_DUST = [
    [[22, 40, 2], [42, 40, 2.2], [32, 37, 1.6]],
    [[19, 39, 3], [45, 39, 3], [24, 36, 2.4], [40, 35, 2.6], [32, 42, 2.4]],
    [[22, 38, 3.4], [33, 36, 3.8], [44, 37, 3.6], [52, 38, 2.6], [28, 34, 2.6], [39, 33, 2.8]],
    [[25, 37, 2], [36, 35, 2.2], [47, 36, 2], [54, 37, 1.4]]];
  // compose a frame: D supplies the palette and the drawers for the hole, rim, mound, rubble, body and head
  function wyrmFrame(D, anim, i) {
    var p = D.pose ? D.pose(wyrmPose(anim, i), anim, i) : wyrmPose(anim, i), b = mk(64, 48), back = mk(64, 48), front = mk(64, 48), x, y, k;
    if (p.hole === 'mound') D.mound(back, front);
    else { wyPit(b, D.pit, D.wall, D.rock[1]); D.rim(back, front, p.churn); }
    if (p.hole === 'rubble') D.rubble(front, i - 3);
    outline(back, OL); blit(b, back, 0, 0);
    if (p.body) {
      var cr = mk(64, 48);
      D.body(cr, p, anim, i);
      for (y = 0; y < 48; y++) for (x = 0; x < 64; x++) if (A(cr, x, y) && wyClip(x, y)) clr(cr, x, y);
      outline(cr, OL);
      if (anim === 'hurt') cr = flash(cr);
      blit(b, cr, 0, 0);
    }
    outline(front, OL); blit(b, front, 0, 0);
    if (D.front) D.front(b, p, anim, i);
    if (p.rocks) {
      var RK = WH_ROCKS[p.rocks], st = mk(64, 48);
      for (k = 0; k < RK.length; k++) rock(st, RK[k][0], RK[k][1], RK[k][2] + 0.3, RK[k][2], D.rock, 120 + k, 2);
      if (D.debris) D.debris(st, p.rocks);
      outline(st, OL); blit(b, st, 0, 0);
    }
    if (p.dust >= 0) cloud(b, WH_DUST[p.dust], D.dust, [0.85, 0.85, 0.8, 0.5][p.dust]);
    return b;
  }
  // a broken half-geode: rough rock outside, a bowl of crystal facets inside
  function halfGeode(b, cx, cy, rx, ry, R, seed, tilt) {
    rock(b, cx, cy, rx, ry, R, seed, 2.2);
    var irx = rx * 0.62, iry = ry * 0.5, icy = cy - ry * 0.25 + (tilt || 0);
    for (var y = Math.floor(icy - iry - 1); y <= icy + iry + 1; y++) for (var x = Math.floor(cx - irx - 1); x <= cx + irx + 1; x++) {
      if (!inE(x, y, cx, icy, irx, iry)) continue;
      var nx = (x + 0.5 - cx) / irx, ny = (y + 0.5 - icy) / iry, h = hash(x, y, seed + 5);
      var c = ny < -0.4 ? CRY[1] : (nx + ny * 0.5 > 0.1 ? CRY[3] : CRY[2]); // the far inside wall catches the light
      if (h > 0.82) c = CRY[4]; else if (h < 0.12) c = CRY[1];
      px(b, x, y, c);
    }
  }

  // ======================================================================= VORRAKH B — "Geode Maw": a living geode
  // A massive worm armoured in rings of sandstone shell; the seams between the plates glow with the amethyst inside him.
  // No eyes, just a row of glowing pits; his blunt head splits into rock petals lined with crystal, like a geode
  // cracked open, around a throat full of light. He dies breaking apart into geodes.
  var GEO = {
    R: ['#1a120d', '#33251a', '#4e3a28', '#6c5237', '#8c6d49', '#ad8d60', '#cdae80'],
    belly: ['#251a12', '#3e2e20', '#5a4430'],
    maw: ['#0e0618', '#24103e', '#3e2270', '#5a3a9a'],
    dust: ['#2e2420', '#4e4034', '#73614e', '#9e8a70', '#c8b496'], pit: '#07050e', wall: '#2a1f18'
  };
  // the plated tube: bold armour rings, each a rounded band lit on the top-left with a pale front lip, dark pinched
  // gaps between them; the gaps show the crystal inside only when he glows (the shard telegraph) or cracks apart
  function geoTube(lay, S, glow, crack) {
    var R = GEO.R, PL = 5.2;
    tubeEach(lay, S, function (x, y, M, nx, ny, dors, l, depth) {
      var across = nx * M.ty - ny * M.tx, f = ((M.s + 1.2) % PL) / PL, gap = f < 0.15 && M.t < 0.95;
      if (gap && depth < 0.9) return; // the silhouette pinches at each gap
      var kk = l > 0.55 ? 5 : l > 0.18 ? 4 : l > -0.25 ? 3 : l > -0.62 ? 2 : 1, c;
      if (f < 0.32) kk--;                     // the back of each ring sits in the shadow of the one before
      else if (f > 0.66 && f < 0.86) kk++;    // its front lip catches the light
      var h = hash(x, y, 201);
      if (h < 0.06 && kk > 1) kk--; else if (h > 0.95 && kk < 5) kk++;
      kk = clamp(kk, 1, 6);
      if (dors < -0.55) c = GEO.belly[f > 0.66 ? 2 : l > -0.3 ? 1 : 0];
      else c = R[kk];
      if (gap) {
        c = R[0];
        if ((glow || crack) && dors > -0.6 && depth > 1.4) c = CRY[depth > 3 ? 3 : 2];
        else if (dors > -0.2 && depth > 3.2) c = CRY[1];
      }
      px(lay, x, y, c);
    });
    if (crack) { // dying: bright fractures run across the plates
      var at = [0.62, 0.4, 0.8];
      for (var k = 0; k < crack; k++) {
        var M = S[Math.round(at[k] * (S.length - 1))], nx2 = M.ty, ny2 = -M.tx, r = M.r;
        var pts = [M.x + nx2 * r * 0.85, M.y + ny2 * r * 0.85, M.x + nx2 * r * 0.3 + M.tx * 1.4, M.y + ny2 * r * 0.3 + M.ty * 1.4,
          M.x - nx2 * r * 0.2 - M.tx * 0.8, M.y - ny2 * r * 0.2 - M.ty * 0.8, M.x - nx2 * r * 0.75 + M.tx * 0.6, M.y - ny2 * r * 0.75 + M.ty * 0.6];
        pline(lay, pts, CRY[3]); px(lay, pts[2], pts[3], CRY[4]); px(lay, pts[4], pts[5], CRY[4]);
      }
    }
  }
  // the head: a flared collar, then three rock petals meeting at a blunt tip; they peel back (jaw 0..1) to show
  // their crystal linings, a ring of crystal teeth and a throat of light
  function geoHead(lay, E, r, th, jaw, glow, spray) {
    var c = Math.cos(th), s = Math.sin(th), R = GEO.R, k;
    var hx = E.x, hy = E.y;
    function T(u, v) { return [hx + u * c - v * s, hy + u * s + v * c]; }
    function map(pts, f) { var o = []; for (var q = 0; q < pts.length; q += 2) { var p2 = f(pts[q], pts[q + 1]); o.push(p2[0], p2[1]); } return o; }
    function rot(u, v, cu, cv, a) { var du = u - cu, dv = v - cv, ca = Math.cos(a), sa = Math.sin(a); return [cu + du * ca - dv * sa, cv + du * sa + dv * ca]; }
    function rockCol(x, y) {
      var dx = x + 0.5 - hx, dy = y + 0.5 - hy, lit = -0.55 * dx - 0.8 * dy;
      var kk = lit > 3.4 ? 5 : lit > 0.6 ? 4 : lit > -2.2 ? 3 : 2;
      if (hash(x, y, 207) < 0.14 && kk > 2) kk--; else if (hash(x, y, 208) > 0.93) kk++;
      return R[kk];
    }
    var H = mk(lay.w, lay.h), rr = r + 1, tip = 8.4, open = jaw > 0.25;
    // the collar: a heavy flared ring of plates behind the maw
    var col = mk(lay.w, lay.h);
    poly(col, map([-2.6, -rr - 0.6, 0.6, -rr - 1.6, 1.6, -rr * 0.4, 1.6, rr * 0.4, 0.6, rr + 1.6, -2.6, rr + 0.6], T), rockCol);
    var cs1 = T(0.4, -rr - 1), cs2 = T(0.4, rr + 1); line(col, cs1[0], cs1[1], cs2[0], cs2[1], R[1]);
    over(H, col, R[0]);
    if (open) { // the throat: a deep well of light behind a ring of crystal teeth
      var o0 = T(1.8, 0), orx = 1.8 + jaw * 1.4, ory = rr * 0.92;
      var thr = mk(lay.w, lay.h);
      ell(thr, o0[0], o0[1], orx + 0.6, ory, GEO.maw[0]);
      ell(thr, o0[0] + c * 0.8, o0[1] + s * 0.8, orx * 0.6, ory * 0.66, GEO.maw[1]);
      ell(thr, o0[0] + c * 1.2, o0[1] + s * 1.2, orx * 0.34, ory * 0.38, GEO.maw[3]);
      var core = T(3.2, 0);
      px(thr, core[0], core[1], spray ? CRY[4] : CRY[3]); px(thr, core[0], core[1] - 1, spray ? CRY[3] : CRY[2]); px(thr, core[0], core[1] + 1, spray ? CRY[3] : CRY[2]);
      if (spray) { px(thr, core[0] + c, core[1] + s, CRY[4]); px(thr, core[0] - s, core[1] + c, CRY[3]); px(thr, core[0] + s, core[1] - c, CRY[3]); }
      for (k = 0; k < 8; k++) { // teeth all round the rim, pointing in
        var a = -1.35 + k * (2.7 / 7), rim = T(1.8 + Math.cos(a) * 0.4, Math.sin(a) * ory * 0.96), tin = T(2.8 + Math.cos(a) * 0.4, Math.sin(a) * ory * 0.5);
        line(thr, rim[0], rim[1], tin[0], tin[1], CRY[3]); px(thr, tin[0], tin[1], CRY[4]); px(thr, rim[0], rim[1], CRY[2]);
      }
      over(H, thr, GEO.maw[0]);
    }
    // the petals: upper and lower swing out about hinges on the collar; the middle one (facing us) folds away
    var up = [0.2, -rr, 3.6, -rr * 0.95, 6.2, -rr * 0.5, tip, -0.2, 3, -0.8, 0.8, -rr * 0.5];
    var lo = [0.2, rr, 3.6, rr * 0.95, 6.2, rr * 0.5, tip, 0.2, 3, 0.8, 0.8, rr * 0.5];
    function petal(pts, hu, hv, ang) {
      var o = [];
      for (var q = 0; q < pts.length; q += 2) { var r2 = rot(pts[q], pts[q + 1], hu, hv, ang); o.push(r2[0], r2[1]); }
      var tmp = mk(lay.w, lay.h);
      poly(tmp, map(o, T), rockCol);
      if (open) { // its crystal lining, on the inside face that now turns toward us
        var ins = [];
        for (var q2 = 0; q2 < o.length; q2 += 2) ins.push(hu + (o[q2] - hu) * 0.78, hv + (o[q2 + 1] - hv) * 0.78 + (hv < 0 ? 0.9 : -0.9));
        poly(tmp, map(ins, T), function (x, y) { var h2 = hash(x, y, 209); return h2 > 0.72 ? CRY[4] : h2 > 0.38 ? CRY[3] : CRY[2]; });
      }
      over(H, tmp, R[0]);
    }
    petal(up, 0.2, -rr, -jaw * 1.35);
    petal(lo, 0.2, rr, jaw * 1.2);
    if (!open) {
      var mid = mk(lay.w, lay.h);
      poly(mid, map([1.2, -2.8 + jaw * 4, tip - 0.4 - jaw * 4, 0, 1.2, 2.8 - jaw * 4, 0.4, 0], T), rockCol);
      over(H, mid, R[1]);
      var s1 = T(1.4, -2.9), s2 = T(tip - 0.6, 0), s3 = T(1.4, 2.9); // the closed seams, crystal teeth peeking between the petals
      line(H, s1[0], s1[1], s2[0], s2[1], glow ? CRY[2] : R[0]); line(H, s3[0], s3[1], s2[0], s2[1], glow ? CRY[2] : R[0]);
      for (k = 1; k < 4; k++) { var tq = k / 4, t1 = [s1[0] + (s2[0] - s1[0]) * tq, s1[1] + (s2[1] - s1[1]) * tq], t2 = [s3[0] + (s2[0] - s3[0]) * tq, s3[1] + (s2[1] - s3[1]) * tq]; px(H, t1[0], t1[1] + 1, CRY[3]); px(H, t2[0], t2[1] - 1, CRY[3]); }
      px(H, s2[0], s2[1], glow ? CRY[4] : CRY[2]);
    }
    // a row of glowing sense-pits along the crown
    for (k = 0; k < 3; k++) { var pp = T(-1.8 - k * 2.4, -rr + 1.6 + k * 0.4); px(H, pp[0], pp[1], glow ? CRY[4] : CRY[3]); px(H, pp[0] - c, pp[1] - s, R[1]); }
    // crystals crowning the collar
    var crn = mk(lay.w, lay.h), cA = T(-1.2, -rr - 0.4), cB = T(-2.4, -rr + 0.8);
    crystal(crn, cA[0], cA[1], -c * 0.6 + s * 0.8, -s * 0.6 - c * 0.8, 5, 1.5, CRY, glow);
    crystal(crn, cB[0], cB[1], -c * 0.9 + s * 0.45, -s * 0.9 - c * 0.45, 3.6, 1.2, CRY, glow);
    over(lay, crn, CRY[0]);
    over(lay, H, R[0]);
    if (spray) { // shards burst from the throat
      var m0 = T(4.2, 0), ang = th + 0.08;
      var sh = spray === 1 ? [[3, -0.34], [6.4, 0.04], [4.6, 0.38]] : [[6.4, -0.36], [10, 0.02], [8, 0.38], [3.6, 0.16]];
      for (k = 0; k < sh.length; k++) {
        var a2 = ang + sh[k][1], sx = m0[0] + Math.cos(a2) * sh[k][0], sy = m0[1] + Math.sin(a2) * sh[k][0];
        if (sx < 59) crystal(lay, sx, sy, Math.cos(a2), Math.sin(a2), 2.6, 0.9, CRY, true); else px(lay, Math.min(61, sx), sy, CRY[4]);
      }
    }
  }
  // crystal clusters breaking out of the seams along his back
  var GEO_SPK = [[0.28, 4.6, 1.8], [0.5, 6.2, 2.1], [0.72, 5, 1.8]];
  function geoSpikes(lay, S, glow, broken) {
    for (var k = 0; k < GEO_SPK.length; k++) {
      if (broken && broken.indexOf(k) >= 0) continue;
      var M = S[Math.round(GEO_SPK[k][0] * (S.length - 1))], nx = M.ty, ny = -M.tx;
      var dx = nx - M.tx * 0.4, dy = ny - M.ty * 0.4, L = Math.sqrt(dx * dx + dy * dy); dx /= L; dy /= L;
      var bx0 = M.x + nx * M.r * 0.6, by0 = M.y + ny * M.r * 0.6;
      crystal(lay, bx0, by0, dx, dy, GEO_SPK[k][1] + M.r * 0.4, GEO_SPK[k][2], CRY, glow);
      crystal(lay, bx0 - M.tx * 2, by0 - M.ty * 2, dx * 0.8 - M.tx * 0.6, dy * 0.8 - M.ty * 0.6, GEO_SPK[k][1] * 0.55 + M.r * 0.3, GEO_SPK[k][2] * 0.75, CRY, glow);
      crystal(lay, bx0 + M.tx * 1.8, by0 + M.ty * 1.8, dx * 0.85 + M.tx * 0.5, dy * 0.85 + M.ty * 0.5, GEO_SPK[k][1] * 0.45 + M.r * 0.3, GEO_SPK[k][2] * 0.65, CRY, glow);
    }
  }
  var GEO_D = {
    rock: GEO.R, dust: GEO.dust, pit: GEO.pit, wall: GEO.wall,
    pose: function (p, anim, i) { p.r0 = 8.2; p.r1 = 6; if (p.tail) { p.r0 = 5.4; p.r1 = 2.4; } if (anim === 'die' && i === 0) p.jaw = 0.55; return p; },
    rim: function (back, front, churn) {
      for (var k = 0; k < WH_RIM.length; k++) {
        var Rm = WH_RIM[k], hop = churn && (k + churn) % 3 === 0 ? 1 : 0;
        var x = WH.x + Rm[0] * (WH.rx + 0.6), y = WH.y + Rm[1] * (WH.ry + 0.7) - hop, fr = Rm[1] > 0.4 ? 0.8 : 1;
        if (k % 4 === 1) halfGeode(Rm[1] < 0 ? back : front, x, y - 0.4, (Rm[2] + 0.9) * fr, (Rm[2] + 0.3) * fr, GEO.R, 60 + k);
        else rock(Rm[1] < 0 ? back : front, x, y - (fr < 1 ? 0.4 : 0), (Rm[2] + 0.4) * fr, Rm[2] * 0.8 * fr, GEO.R, 50 + k, 2.2);
      }
    },
    mound: function (back, front) {
      var cr = [[0.3, 16], [1.5, 11], [2.5, 17], [3.6, 12], [4.6, 15], [5.6, 11]], k;
      for (k = 0; k < cr.length; k++) {
        var a = cr[k][0], L = cr[k][1], mx = WH.x + Math.cos(a + 0.2) * L * 0.55, my = WH.y + Math.sin(a + 0.2) * L * 0.55 * 0.42;
        var ex = WH.x + Math.cos(a) * L, ey = WH.y + Math.sin(a) * L * 0.42;
        line(back, WH.x, WH.y, mx, my, GEO.pit); line(back, mx, my, ex, ey, GEO.pit);
        px(back, mx, my, CRY[3]); px(back, (WH.x + mx) / 2, (WH.y + my) / 2, CRY[4]);
      }
      var M = [[25.5, 39.6, 3.2, 2.5], [32.5, 37.4, 4.4, 3.6], [39.5, 39.8, 3.2, 2.5], [29.5, 42, 3, 2.2], [36, 42.4, 3.2, 2.3], [21, 41.6, 2, 1.6], [43.5, 41.8, 2, 1.6]];
      for (k = 0; k < M.length; k++) rock(front, M[k][0], M[k][1], M[k][2], M[k][3], GEO.R, 70 + k, 2.2);
      // the crown of his head shows through the cracked floor
      var dm = mk(64, 48); shadeEll(dm, 32.5, 36.6, 4, 2.4, GEO.R.slice(1), 5); line(dm, 30, 36, 35, 36, CRY[3]); px(dm, 32, 35, CRY[4]);
      over(front, dm, GEO.R[0]);
    },
    rubble: function (front, settle) {
      var M = [[27, 39.5, 3, 2.3], [33, 37.6, 3.8, 3], [39.5, 37, 3.4, 2.8], [45.5, 37.4, 3, 2.4], [51, 38.4, 2.6, 2], [31, 42, 2.8, 2.1], [38, 41.4, 3, 2.2], [44.5, 41.2, 2.4, 1.9], [55.5, 39.6, 1.8, 1.4]];
      for (var k = 0; k < M.length; k++) {
        if (k % 3 === 1) halfGeode(front, M[k][0], M[k][1] + settle * 0.5, M[k][2] + 0.4, M[k][3] + 0.2, GEO.R, 90 + k, settle ? 0.3 : 0);
        else rock(front, M[k][0], M[k][1] + settle * 0.5, M[k][2], M[k][3], GEO.R, 90 + k, 2.2);
      }
      crystal(front, 34, 35 + settle * 0.5, -0.3, -0.95, 4.4, 1.5, CRY, !settle);
      crystal(front, 46.5, 35.6 + settle * 0.5, 0.2, -1, 3, 1.1, CRY);
    },
    body: function (cr, p, anim, i) {
      var S = wySamples(p.P, p.r0, p.r1), bd = mk(64, 48);
      geoSpikes(cr, S, p.glow, p.broken);
      geoTube(bd, S, p.glow, p.crack);
      over(cr, bd, GEO.R[0]);
      var E = S[S.length - 1];
      if (p.tail) crystal(cr, E.x, E.y, E.tx, E.ty, 3.2, 1.3, CRY);
      if (p.head) { var hd = mk(64, 48); geoHead(hd, E, E.r, p.th, p.jaw, p.glow, p.spray); over(cr, hd, GEO.R[0]); }
    }
  };
  K.defType('deep_wyrm__b', {
    w: 64, h: 48, ax: 32, ay: 40,
    anims: { idle: 2, move: 4, attack: 4, hurt: 1, die: 5, burrow: 4, emerge: 4 },
    variants: ['default'],
    fps: { idle: 2, move: 6, attack: 7, die: 6, burrow: 7, emerge: 7 },
    draw: function (v, anim, i) { return wyrmFrame(GEO_D, anim, i); }
  });

  // ======================================================================= VORRAKH C — "Pale Olm": the blind thing in the deep
  // A huge, soft, blind cave salamander: smooth pale-rose skin with lavender mottling, a broad flat head with a long
  // sleepy smile, feathery coral gills, a soft fin down its back and violet crystals grown out of it like barnacles.
  // It has no eyes to speak of — it hunts by feel, which is why the floor trembles first. Little hands grip the rim.
  var OLM = {
    S: ['#2c1828', '#563246', '#86576a', '#b8838c', '#ddb0ae', '#f4d6ce', '#fff2ea'],
    belly: ['#b88c90', '#dcb8b2', '#f6e2da'], mottle: ['#8a6a8c', '#a888a8'],
    gill: ['#5a1426', '#9a2a44', '#d4506a', '#f68a92', '#ffc8c2'],
    fin: ['#b8687a', '#e39aa0', '#f8c8c4'],
    mouth: ['#3e1222', '#7a2a40', '#b4505e'], tooth: '#fff4ee', eye: '#2a1020', eyeRing: '#cbb2c4',
    rock: ['#1e1a2c', '#38324e', '#514a6c', '#6c6589', '#8c85a8', '#b0aaca'],
    shroom: ['#5a7aa8', '#a8d0f0', '#eafaff'],
    dust: ['#2a2434', '#4a4058', '#6e6280', '#9a8ea8', '#c4bcd0'], pit: '#07050e', wall: '#231d30'
  };
  // smooth skin: lit top-left, soft lavender mottling on the back, faint costal grooves down the flanks, pale belly
  function olmTube(lay, S, pale) {
    var Sk = OLM.S;
    tubeEach(lay, S, function (x, y, M, nx, ny, dors, l, depth) {
      var kk = l > 0.6 ? 6 : l > 0.3 ? 5 : l > 0 ? 4 : l > -0.35 ? 3 : l > -0.7 ? 2 : 1, c;
      if (dors < -0.5) c = OLM.belly[l > 0 ? 2 : l > -0.5 ? 1 : 0];
      else {
        c = Sk[kk];
        var mo = hash(Math.round(M.s / 2.2), Math.round(dors * 2.4), 301);
        if (dors > 0.05 && mo > 0.62 && hash(x, y, 302) > 0.25) c = OLM.mottle[kk > 4 ? 1 : 0];
        if (Math.abs(((M.s + 0.6) % 3) - 0.3) < 0.35 && dors > -0.45 && dors < 0.55 && M.t < 0.92 && kk > 2) c = Sk[kk - 1]; // grooves
      }
      if (pale) c = mix(c, '#9a92a8', pale);
      px(lay, x, y, c);
    });
  }
  // a soft fin down the back (a little see-through), with its rays
  function olmFin(lay, S, t0, t1, hgt, wave) {
    for (var k = 0; k < S.length; k++) {
      var M = S[k];
      if (M.t < t0 || M.t > t1) continue;
      var nx = M.ty, ny = -M.tx, e = Math.sin((M.t - t0) / (t1 - t0) * Math.PI);
      var h = hgt * e * (0.8 + 0.25 * Math.sin(M.s * 1.3 + wave));
      for (var d = 0; d <= h + 0.5; d += 0.5) {
        var x = M.x + nx * (M.r - 0.5 + d), y = M.y + ny * (M.r - 0.5 + d);
        var c = d > h - 0.8 ? OLM.fin[0] : (Math.round(M.s) % 3 === 0 ? OLM.fin[0] : OLM.fin[1]);
        px(lay, x, y, c, d > h - 0.8 ? 1 : 0.82);
      }
    }
  }
  // the gills: three feathery fronds, fanning back from behind the head; `flare` spreads them, `droop` wilts them
  function olmGills(lay, T, flare, droop, dark) {
    var G = OLM.gill, fronds = [[0.2, -3.6, -1.95, 6.4], [-0.6, -2.2, -1.2, 7], [-0.8, -0.2, -0.45, 6]];
    for (var k = 0; k < fronds.length; k++) {
      var F = fronds[k], a = F[2] - flare * 0.22 * (k - 1) - flare * 0.15 + droop * (1.2 - k * 0.2), L = F[3] * (1 + flare * 0.1) * (1 - droop * 0.2);
      var pts = [];
      for (var q = 0; q <= 6; q++) {
        var t = q / 6, curl = t * t * 1.4;
        var uu = F[0] - Math.cos(a) * L * t - Math.sin(a) * curl * 0.4, vv = F[1] + Math.sin(a) * L * t + curl * (1 - droop * 0.3);
        pts.push(T(uu, vv));
      }
      var c1 = dark ? mix(G[2], G[0], 0.5) : G[2], c2 = dark ? mix(G[3], G[0], 0.5) : G[3], c3 = dark ? mix(G[4], G[0], 0.5) : G[4];
      for (q = 0; q < pts.length - 1; q++) {
        line(lay, pts[q][0], pts[q][1], pts[q + 1][0], pts[q + 1][1], q < 2 ? c1 : c2);
        if (q > 0 && q % 2 === 1) { // feathery filaments on the outer side
          var dx = pts[q + 1][0] - pts[q][0], dy = pts[q + 1][1] - pts[q][1], Ln = Math.sqrt(dx * dx + dy * dy) || 1;
          px(lay, pts[q][0] - dy / Ln * 1.1 - dx / Ln * 0.6, pts[q][1] + dx / Ln * 1.1 - dy / Ln * 0.6, c3);
          px(lay, pts[q][0] + dy / Ln * 1.1 - dx / Ln * 0.6, pts[q][1] - dx / Ln * 1.1 - dy / Ln * 0.6, c2);
        }
      }
      px(lay, pts[6][0], pts[6][1], c3);
    }
  }
  // the head: broad and flat with a blunt round snout and a long smile; the lower jaw drops about its hinge
  var OLM_SKULL = [-2.6, -3.8, 1.6, -4.8, 5.6, -4.6, 8.4, -3.6, 10.2, -1.8, 10.8, 0.4, 10.2, 2, 6, 2.4, 2, 2.8, -2.6, 3];
  var OLM_JAW = [1.6, 1.8, 9.8, 1.6, 10, 2.8, 8, 4, 4.4, 4.6, 1, 4.2, -1.6, 3];
  function olmHead(lay, hx, hy, th, jaw, flare, droop, spray, pale) {
    var c = Math.cos(th), s = Math.sin(th), cj = Math.cos(jaw), sj = Math.sin(jaw), Sk = OLM.S, k;
    function T(u, v) { return [hx + u * c - v * s, hy + u * s + v * c]; }
    function loc(x, y) { var dx = x + 0.5 - hx, dy = y + 0.5 - hy; return [dx * c + dy * s, -dx * s + dy * c]; }
    function J(u, v) { var du = u - 1.6, dv = v - 1.6; return T(1.6 + du * cj - dv * sj, 1.6 + du * sj + dv * cj); }
    function map(pts, f) { var o = []; for (var q = 0; q < pts.length; q += 2) { var p2 = f(pts[q], pts[q + 1]); o.push(p2[0], p2[1]); } return o; }
    function tint(cc) { return pale ? mix(cc, '#9a92a8', pale) : cc; }
    var H = mk(lay.w, lay.h), Gl = mk(lay.w, lay.h);
    olmGills(Gl, T, flare, droop);
    // the far-side gills peek out above the head, in shadow, drawn first
    var Gf = mk(lay.w, lay.h);
    olmGills(Gf, function (u, v) { return T(u + 2.2, v - 1.2); }, flare * 0.8, droop, true);
    over(lay, Gf, OLM.gill[0]);
    if (jaw > 0.05) { // inside of the mouth
      var m1 = T(1.8, 1.8), m2 = T(10.2, 1.4), m3 = J(9.8, 1.8), m4 = J(2.2, 3);
      poly(H, [m1[0], m1[1], m2[0], m2[1], m3[0], m3[1], m4[0], m4[1]], OLM.mouth[1]);
      var tg = J(5.4, 3); px(H, tg[0], tg[1], OLM.mouth[2]); px(H, tg[0] + c, tg[1] + s, OLM.mouth[2]);
      var thr = T(3.2, 2.2); px(H, thr[0], thr[1], spray ? CRY[4] : OLM.mouth[0]); px(H, thr[0] + c, thr[1] + s, spray ? CRY[3] : OLM.mouth[0]);
    }
    poly(H, map(OLM_JAW, J), function (x, y) { var l = loc(x, y); return tint(l[1] > 3 ? OLM.belly[1] : OLM.belly[2]); });
    poly(H, map(OLM_SKULL, T), function (x, y) {
      var l = loc(x, y), lit = -0.55 * (l[0] * c - l[1] * s) / 6 - 0.8 * (l[0] * s + l[1] * c) / 3;
      var kk = l[1] < -3.6 ? 6 : l[1] < -2 ? 5 : l[1] < 0 ? 4 : 3;
      if (l[0] > 9 && kk > 3) kk--; // the round snout turns away from the light
      var mo = hash(Math.round(l[0] / 1.6), Math.round(l[1] / 1.4), 311);
      var cc = mo > 0.78 && l[1] < -1 && l[0] < 9 ? OLM.mottle[1] : Sk[kk];
      return tint(cc);
    });
    // the long sleepy smile (or the open jaw's teeth)
    if (jaw <= 0.05) {
      var sm = [T(10.2, 1.4), T(7, 2), T(4, 2), T(2.8, 1.2)];
      for (k = 0; k + 1 < sm.length; k++) line(H, sm[k][0], sm[k][1], sm[k + 1][0], sm[k + 1][1], Sk[1]);
    } else {
      for (k = 0; k < 4; k++) { var tp = T(4.4 + k * 1.6, 2.1); px(H, tp[0], tp[1], OLM.tooth); }
      for (k = 0; k < 3; k++) { var lt = J(5 + k * 1.6, 2.2); px(H, lt[0], lt[1], OLM.tooth); }
    }
    // a tiny, clouded, sightless eye
    var e0 = T(6.4, -2);
    px(H, e0[0], e0[1], OLM.eye); px(H, e0[0] - c, e0[1] - s, OLM.eyeRing); px(H, e0[0] + s, e0[1] - c, tint(Sk[6]));
    var ns = T(10.2, -0.6); px(H, ns[0], ns[1], Sk[2]);
    over(lay, H, Sk[0]);
    over(lay, Gl, OLM.gill[0]);
    if (spray) { // crystal shards spat from the throat
      var m0 = T(11, 2.2), ang = th + 0.12;
      var sh = spray === 1 ? [[3, -0.3], [6, 0.05], [4.5, 0.35]] : [[6, -0.32], [9.5, 0.02], [7.5, 0.34], [3.5, 0.15]];
      for (k = 0; k < sh.length; k++) {
        var a2 = ang + sh[k][1], sx = m0[0] + Math.cos(a2) * sh[k][0], sy = m0[1] + Math.sin(a2) * sh[k][0];
        if (sx < 59) crystal(lay, sx, sy, Math.cos(a2), Math.sin(a2), 2.6, 0.9, CRY, true); else px(lay, Math.min(61, sx), sy, CRY[4]);
      }
    }
  }
  // crystals grown out of its back like barnacles
  var OLM_SPK = [[0.36, 3.4, 1.5], [0.56, 4.6, 1.8], [0.74, 3.2, 1.4]];
  function olmCrystals(lay, S, glow, broken) {
    for (var k = 0; k < OLM_SPK.length; k++) {
      if (broken && broken.indexOf(k) >= 0) continue;
      var M = S[Math.round(OLM_SPK[k][0] * (S.length - 1))], nx = M.ty, ny = -M.tx;
      var dx = nx - M.tx * 0.3, dy = ny - M.ty * 0.3, L = Math.sqrt(dx * dx + dy * dy); dx /= L; dy /= L;
      var bx0 = M.x + nx * M.r * 0.75, by0 = M.y + ny * M.r * 0.75;
      crystal(lay, bx0, by0, dx, dy, OLM_SPK[k][1] + 1.6, OLM_SPK[k][2], CRY, glow);
      crystal(lay, bx0 + M.tx * 1.6, by0 + M.ty * 1.6, dx * 0.8 + M.tx * 0.6, dy * 0.8 + M.ty * 0.6, OLM_SPK[k][1] * 0.6 + 0.8, OLM_SPK[k][2] * 0.7, CRY, glow);
    }
  }
  // its little hand on the rim of the hole
  function olmHand(lay, x, y, pale) {
    var c1 = pale ? mix(OLM.S[4], '#9a92a8', pale) : OLM.S[4], c2 = pale ? mix(OLM.S[3], '#9a92a8', pale) : OLM.S[3];
    line(lay, x - 3, y - 3, x, y, c2); line(lay, x - 3, y - 2, x - 0.4, y + 0.6, c1);
    px(lay, x + 1, y + 1, c1); px(lay, x, y + 1, c1); px(lay, x - 1, y + 1, c2); px(lay, x + 2, y + 0.4, c1);
  }
  var OLM_D = {
    rock: OLM.rock, dust: OLM.dust, pit: OLM.pit, wall: OLM.wall,
    pose: function (p, anim, i) {
      p.r0 = 6.8; p.r1 = 4.4; p.flare = p.spray ? 1 : p.glow ? 0.6 : 0; p.droop = 0; p.pale = 0; p.hands = anim !== 'burrow' && !(anim === 'emerge' && i < 2);
      if (anim === 'hurt') p.flare = 1;
      if (anim === 'die') { p.droop = i === 0 ? 0 : i === 1 ? 0.6 : 1; p.pale = i === 0 ? 0 : i === 1 ? 0.25 : 0.45; p.hands = i === 0; if (i === 0) p.flare = 1.2; }
      if (anim === 'idle' && i) p.flare = 0.25;
      if (p.tail) { p.r0 = 4.4; p.r1 = 1.6; }
      return p;
    },
    rim: function (back, front, churn) {
      for (var k = 0; k < WH_RIM.length; k++) {
        var Rm = WH_RIM[k], hop = churn && (k + churn) % 3 === 0 ? 1 : 0;
        var x = WH.x + Rm[0] * (WH.rx + 0.6), y = WH.y + Rm[1] * (WH.ry + 0.7) - hop, fr = Rm[1] > 0.4 ? 0.8 : 1, L = Rm[1] < 0 ? back : front;
        rock(L, x, y - (fr < 1 ? 0.4 : 0), (Rm[2] + 0.4) * fr, Rm[2] * 0.8 * fr, OLM.rock, 50 + k, 2.2);
        if (k % 3 === 0) { // pale glowing cave-caps on some of the stones
          var sx = Math.round(x + 0.5), sy = Math.round(y - Rm[2] * 0.8 * fr - 0.6);
          px(L, sx, sy + 1, OLM.shroom[0]); px(L, sx - 1, sy, OLM.shroom[1]); px(L, sx, sy, OLM.shroom[2]); px(L, sx + 1, sy, OLM.shroom[1]);
        }
      }
      crystal(back, WH.x - WH.rx + 1.5, WH.y - 2.5, -0.5, -0.86, 3.6, 1.2, CRY);
      crystal(front, WH.x + WH.rx - 0.5, WH.y + 2.5, 0.6, -0.8, 3.2, 1.1, CRY);
    },
    mound: function (back, front) {
      var cr = [[0.3, 16], [1.5, 11], [2.5, 17], [3.6, 12], [4.6, 15], [5.6, 11]], k;
      for (k = 0; k < cr.length; k++) {
        var a = cr[k][0], L = cr[k][1], mx = WH.x + Math.cos(a + 0.2) * L * 0.55, my = WH.y + Math.sin(a + 0.2) * L * 0.55 * 0.42;
        var ex = WH.x + Math.cos(a) * L, ey = WH.y + Math.sin(a) * L * 0.42;
        line(back, WH.x, WH.y, mx, my, OLM.pit); line(back, mx, my, ex, ey, OLM.pit);
        px(back, mx, my, CRY[3]);
      }
      var M = [[25.5, 39.6, 3.2, 2.5], [32.5, 38.4, 4.2, 3], [39.5, 39.8, 3.2, 2.5], [29.5, 42, 3, 2.2], [36, 42.4, 3.2, 2.3], [21, 41.6, 2, 1.6], [43.5, 41.8, 2, 1.6]];
      for (k = 0; k < M.length; k++) rock(front, M[k][0], M[k][1], M[k][2], M[k][3], OLM.rock, 70 + k, 2.2);
      // the tips of its gills poke up through the cracks first
      var G = OLM.gill, tips = [[29, 36, -1], [31, 35, 0], [35, 35.4, 1], [37, 36, 2]];
      for (k = 0; k < tips.length; k++) { var tx = tips[k][0], ty = tips[k][1], d = tips[k][2]; line(back, tx, ty + 1, tx + d * 0.6, ty - 2.4, G[3]); px(back, tx + d * 0.6, ty - 3, G[4]); px(back, tx - 1 + d * 0.3, ty - 1, G[2]); }
    },
    rubble: function (front, settle) {
      var M = [[27, 39.5, 3, 2.3], [33, 37.6, 3.8, 3], [39.5, 37, 3.4, 2.8], [45.5, 37.4, 3, 2.4], [51, 38.4, 2.6, 2], [31, 42, 2.8, 2.1], [38, 41.4, 3, 2.2], [44.5, 41.2, 2.4, 1.9], [55.5, 39.6, 1.8, 1.4]];
      for (var k = 0; k < M.length; k++) rock(front, M[k][0], M[k][1] + settle * 0.5, M[k][2], M[k][3], OLM.rock, 90 + k, 2.2);
      crystal(front, 34, 35 + settle * 0.5, -0.3, -0.95, 5, 1.6, CRY, !settle);
      crystal(front, 41, 35 + settle * 0.5, 0.45, -0.9, 4, 1.4, CRY);
      crystal(front, 47.5, 36 + settle * 0.5, 0.1, -1, 3, 1.1, CRY);
      // a last wilted gill frond among the stones
      var G = OLM.gill; line(front, 50, 36.4 + settle * 0.5, 54, 35 + settle * 0.6, mix(G[3], '#9a92a8', 0.5)); px(front, 55, 35 + settle * 0.6, mix(G[4], '#9a92a8', 0.5));
    },
    body: function (cr, p, anim, i) {
      var S = wySamples(p.P, p.r0, p.r1), bd = mk(64, 48), cz = mk(64, 48);
      olmCrystals(cz, S, p.glow, p.broken);
      olmTube(bd, S, p.pale);
      if (!p.tail) olmFin(bd, S, 0.18, 0.86, 2.6, i * 1.3);
      else olmFin(bd, S, 0.1, 0.95, 1.8, i);
      over(cr, bd, OLM.S[0]);
      over(cr, cz, CRY[0]);
      var E = S[S.length - 1];
      if (p.tail) { var tp = mk(64, 48); line(tp, E.x, E.y, E.x + E.tx * 2.6, E.y + E.ty * 2.6, OLM.fin[1]); over(cr, tp, OLM.S[0]); }
      if (p.head) {
        var hd = mk(64, 48), back = 2.4;
        olmHead(hd, E.x - Math.cos(p.th) * back, E.y - Math.sin(p.th) * back, p.th, p.jaw, p.flare, p.droop, p.spray, p.pale);
        over(cr, hd, OLM.S[0]);
      }
      if (p.hands) { var hn = mk(64, 48); olmHand(hn, 40, 37.4, p.pale); olmHand(hn, 25.4, 37, p.pale); over(cr, hn, OLM.S[0]); }
    }
  };
  K.defType('deep_wyrm__c', {
    w: 64, h: 48, ax: 32, ay: 40,
    anims: { idle: 2, move: 4, attack: 4, hurt: 1, die: 5, burrow: 4, emerge: 4 },
    variants: ['default'],
    fps: { idle: 2, move: 6, attack: 7, die: 6, burrow: 7, emerge: 7 },
    draw: function (v, anim, i) { return wyrmFrame(OLM_D, anim, i); }
  });
})();
