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
    var roots = [[0.9, 1.2], [-0.9, 1.1], [1.6, 0.4], [-1.7, 0.2]];
    for (var k = 0; k < roots.length; k++) {
      var ax = ux * roots[k][1] + nx * roots[k][0], ay = uy * roots[k][1] + ny * roots[k][0];
      var r0x = cx + ax * 2.6, r0y = cy + ay * 2.6, r1x = cx + ax * 3.8 + (k % 2 ? 1 : -1) * nx * 0.6, r1y = cy + ay * 3.8 + (k % 2 ? 1 : -1) * ny * 0.6;
      line(L, r0x, r0y, r1x, r1y, O[2]); px(L, r1x + ax * 0.8, r1y + ay * 0.8, O[3]);
    }
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
    if (p.club === 'rest') { grip = [41.6 + L * 0.4, Y(26.6)]; head = [43.4 + L * 0.2, 38.6]; }
    else if (p.club === 'back') { grip = [36.4 + L * 0.5, Y(15.6)]; head = [42.2, Y(7.2)]; top = 2.4; }
    else if (p.club === 'up') { grip = [37, Y(16.2)]; head = [38.4, Y(9)]; top = 2; }
    else { grip = [36.4, Y(30.4)]; head = [44.2, 38.8]; top = 2.4; }
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
    var fistL = p.club === 'up' ? [7.4 + L, Y(30)] : p.club === 'back' ? [7.6 + L, Y(36.4)] : [5.8 + L * 0.6 + rL * 0.7, 39.2 - (rL > 1 ? 1.2 : 0)];
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
      line(rd, rx0, ry0 + 1, rx0 + sway, ry0 + 1 - reeds[k][2], RE[k % 2 ? 2 : 1]);
      px(rd, rx0 + sway, ry0 + 1 - reeds[k][2], RE[3]);
      if (reeds[k][3]) { // cattail
        var cx0 = rx0 + Math.round(sway * 0.7), cy0 = ry0 + 1 - Math.round(reeds[k][2] * 0.78);
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
      var sp = p.splash === 1 ? [[37, 35], [40, 31], [46, 33], [33, 39], [6, 37]] : [[34, 32], [38, 27], [46, 28], [3, 39]];
      for (k = 0; k < sp.length; k++) { px(b, sp[k][0], sp[k][1], M[4]); px(b, sp[k][0] + 1, sp[k][1], M[3]); px(b, sp[k][0], sp[k][1] + 1, M[2]); if (k < 2) px(b, sp[k][0] - 1, sp[k][1] + 1, BOGO.weed[3]); }
      line(b, 1, 42, 9, 42, '#8c7a5a', 0.55); line(b, 36, 42, 47, 42, '#8c7a5a', 0.55);
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
    var rl = [[[5, 18, 9, 13]], [[3, 24, 9, 21], [40, 20, 44, 26]], [[2, 32, 8, 30], [40, 30, 45, 33]], [[3, 41, 9, 41], [41, 41, 46, 40]]][t];
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
    if (p.club === 'rest') { b0 = [40.6 + L * 0.6, Y(34)]; b1 = [43.4 + L * 0.4, Y(17)]; }
    else if (p.club === 'up') { b0 = [37 + L, Y(21.5)]; b1 = [31.6 + L, Y(10.4)]; }
    else { b0 = [35, Y(29)]; b1 = [44, 39]; }
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
      var sp = p.splash === 1 ? [[40, 33], [44, 29], [47, 35], [32, 38], [4, 36]] : [[37, 30], [42, 25], [46, 30], [2, 38]];
      for (k = 0; k < sp.length; k++) { px(b, sp[k][0], sp[k][1], R[3]); px(b, sp[k][0], sp[k][1] - 1, R[4]); px(b, sp[k][0] + 1, sp[k][1], R[2]); }
      line(b, 1, 42, 9, 42, '#c0a0b0', 0.55); line(b, 37, 42, 47, 42, '#c0a0b0', 0.55);
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
})();
