/*
 * audio.js - procedural Web Audio engine (music, ambience, SFX, jingles, voice blips).
 * 100% synthesized at runtime: no audio files, no network, no libraries.
 * Classic script; defines exactly one global: window.AudioEngine.
 * Every public method is safe to call at any time (before unlock, without Web Audio, ...).
 */
(function () {
  'use strict';

  var W = (typeof window !== 'undefined') ? window : {};
  var DOC = (typeof document !== 'undefined') ? document : null;
  var AC = null;
  try { AC = W.AudioContext || W.webkitAudioContext || null; } catch (e0) { AC = null; }

  /* ------------------------------------------------------------------ */
  /*  Small utilities                                                    */
  /* ------------------------------------------------------------------ */
  function noop() {}
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function F(x, d) { return isNum(x) ? x : d; }
  function clamp(x, a, b) { x = F(x, a); return x < a ? a : (x > b ? b : x); }
  function midiHz(m) { return 440 * Math.pow(2, (F(m, 69) - 69) / 12); }
  var R = Math.random;
  function rr(a, b) { return a + (b - a) * R(); }
  function ri(a, b) { return Math.floor(a + (b - a + 1) * R()); }
  function pickR(arr) { return arr[Math.floor(R() * arr.length) % arr.length]; }
  function chance(p) { return R() < p; }
  /* Deterministic PRNG for compositions and impulse responses. */
  function mulberry32(a) {
    a = (a >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Engine state                                                       */
  /* ------------------------------------------------------------------ */
  var ctx = null;
  var unlocked = false, hidden = false, muted = false, paused = false, broken = false;
  var vol = { master: 0.8, music: 0.55, sfx: 0.7, ambience: 0.5 };
  var N = null, M = null, S = null, J = null, A = null;   // bus graphs
  var BUF = {}, WAVES = {};
  var hasStereo = false;
  var allVoices = [], musicVoices = [], sfxVoices = [], jingleVoices = [];
  var MUSIC_CAP = 24, SFX_CAP = 40;
  var LOOKAHEAD = 0.2, TICK_MS = 30;

  function now() { return ctx ? ctx.currentTime : 0; }

  /* Safe AudioParam helpers: never let NaN/Infinity through, never ramp exponentially to 0. */
  function sv(p, v, t) { try { p.setValueAtTime(F(v, 0), Math.max(0, F(t, 0))); } catch (e) {} }
  function lr(p, v, t) { try { p.linearRampToValueAtTime(F(v, 0), Math.max(0, F(t, 0))); } catch (e) {} }
  function er(p, v, t) { try { p.exponentialRampToValueAtTime(Math.max(0.0001, F(v, 0.0001)), Math.max(0, F(t, 0))); } catch (e) {} }
  function st(p, v, t, tc) { try { p.setTargetAtTime(F(v, 0), Math.max(0, F(t, 0)), Math.max(0.002, F(tc, 0.05))); } catch (e) {} }
  function cancel(p, t) { try { p.cancelScheduledValues(Math.max(0, F(t, 0))); } catch (e) {} }
  /* Cancel future automation and continue smoothly from the current value. */
  function hold(p, t) { var v = 0; try { v = F(p.value, 0); } catch (e) {} cancel(p, t); sv(p, v, t); }
  /* Smoothly glide a param to v (time constant tc), starting now. */
  function glide(p, v, tc, t) { t = F(t, now()); hold(p, t); st(p, v, t, tc); }

  /* ------------------------------------------------------------------ */
  /*  Node factories (only called once ctx exists)                       */
  /* ------------------------------------------------------------------ */
  function G(v) { var g = ctx.createGain(); g.gain.value = F(v, 1); return g; }
  function O(type, f) {
    var o = ctx.createOscillator();
    if (type && typeof type === 'object') { try { o.setPeriodicWave(type); } catch (e) { o.type = 'sine'; } }
    else o.type = type || 'sine';
    o.frequency.value = clamp(f, 0.01, 20000);
    return o;
  }
  function BQ(type, f, q, gain) {
    var b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = clamp(f, 10, 20000);
    /* lowpass/highpass Q is in dB (negative = flatter); band types use a linear Q */
    if (type === 'lowpass' || type === 'highpass') b.Q.value = clamp(F(q, 0), -20, 30);
    else b.Q.value = clamp(F(q, 0.7071), 0.0001, 40);
    if (gain !== undefined) b.gain.value = F(gain, 0);
    return b;
  }
  function PAN(p) {
    if (hasStereo) { var s = ctx.createStereoPanner(); s.pan.value = clamp(p, -1, 1); return s; }
    return G(1);
  }
  function NSRC(buf, loop) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = !!loop; return s; }
  function chain() { for (var i = 0; i < arguments.length - 1; i++) arguments[i].connect(arguments[i + 1]); return arguments[arguments.length - 1]; }

  /* ------------------------------------------------------------------ */
  /*  Voice: a group of nodes that is cleaned up when its sources end    */
  /* ------------------------------------------------------------------ */
  function Voice(dest, t0) {
    this.out = G(1);
    if (dest) this.out.connect(dest);
    this.nodes = [this.out]; this.srcs = [];
    this.t0 = F(t0, now()); this.end = this.t0 + 0.05; this.relAt = Infinity;
    this.alive = true; this.left = 0;
    allVoices.push(this);
  }
  Voice.prototype.n = function (node) { this.nodes.push(node); return node; };
  Voice.prototype.src = function (s, t, tEnd, off) {
    var self = this;
    t = Math.max(0, F(t, now()));
    tEnd = Math.max(t + 0.01, F(tEnd, t + 1));
    this.nodes.push(s); this.srcs.push(s); this.left++;
    s.onended = function () { self.left--; if (self.left <= 0) self.free(); };
    try { if (off !== undefined) s.start(t, Math.max(0, F(off, 0))); else s.start(t); } catch (e) {}
    try { s.stop(tEnd); } catch (e2) {}
    if (tEnd > this.end) this.end = tEnd;
    return s;
  };
  Voice.prototype.free = function () {
    if (!this.alive) return;
    this.alive = false;
    var i;
    for (i = 0; i < this.srcs.length; i++) { try { this.srcs[i].onended = null; } catch (e) {} }
    for (i = 0; i < this.nodes.length; i++) { try { this.nodes[i].disconnect(); } catch (e2) {} }
    this.nodes.length = 0; this.srcs.length = 0;
  };
  /* Early stop with a short fade (voice stealing, zone changes, jingle overlap). */
  Voice.prototype.kill = function (t, fade) {
    if (!this.alive || !ctx) return;
    t = Math.max(F(t, 0), ctx.currentTime);
    fade = Math.max(0.01, F(fade, 0.05));
    var te = t + fade + 0.03;
    if (te >= this.end) return;
    hold(this.out.gain, t); st(this.out.gain, 0, t, fade / 4);
    for (var i = 0; i < this.srcs.length; i++) { try { this.srcs[i].stop(te); } catch (e) {} }
    this.end = te;
  };

  /* Register a music voice and enforce the polyphony cap (released voices are stolen first). */
  function regVoice(list, v, cap) {
    var t = now(), i, alive = 0;
    for (i = list.length - 1; i >= 0; i--) {
      if (!list[i].alive || list[i].end < t) list.splice(i, 1);
    }
    list.push(v);
    alive = list.length;
    while (alive > cap) {
      var victim = -1;
      for (i = 0; i < list.length - 1; i++) { if (list[i].relAt < t && list[i].end > t + 0.3) { victim = i; break; } }
      if (victim < 0) victim = 0;
      list[victim].kill(t, 0.25);
      list.splice(victim, 1);
      alive--;
    }
    return v;
  }
  function sweepVoices() {
    var t = now(), j = 0;
    for (var i = 0; i < allVoices.length; i++) {
      var v = allVoices[i];
      if (v.alive && t > v.end + 1.5) v.free();
      if (v.alive) allVoices[j++] = v;
    }
    allVoices.length = j;
  }
  function countAlive(list) { var n = 0, t = now(); for (var i = 0; i < list.length; i++) if (list[i].alive && list[i].end > t) n++; return n; }

  /* ------------------------------------------------------------------ */
  /*  Generated buffers: noise and reverb impulse responses              */
  /* ------------------------------------------------------------------ */
  function makeNoise(sec, kind, seed) {
    var sr = ctx.sampleRate, len = Math.max(256, Math.floor(sr * sec)), K = Math.floor(sr * 0.05);
    var tmp = new Float32Array(len + K), rng = mulberry32(seed);
    var b0 = 0, b1 = 0, b2 = 0, last = 0, i, w, peak = 0;
    for (i = 0; i < len + K; i++) {
      w = rng() * 2 - 1;
      if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913;
        tmp[i] = b0 + b1 + b2 + w * 0.1848;
      } else if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02; tmp[i] = last;
      } else tmp[i] = w;
    }
    var buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (i = 0; i < len; i++) d[i] = tmp[i];
    /* seamless loop: blend the continuation past the end into the start */
    for (i = 0; i < K; i++) { var a = i / K; d[i] = d[i] * a + tmp[len + i] * (1 - a); }
    for (i = 0; i < len; i++) { var m = d[i] < 0 ? -d[i] : d[i]; if (m > peak) peak = m; }
    var k = peak > 0 ? 0.9 / peak : 1;
    for (i = 0; i < len; i++) d[i] *= k;
    return buf;
  }
  /* Stereo IR: decorrelated noise split in 3 bands, each with its own decay (highs die first). */
  function makeIR(sec, t60, seed) {
    var sr = ctx.sampleRate, len = Math.max(256, Math.floor(sr * sec));
    var buf = ctx.createBuffer(2, len, sr), rng = mulberry32(seed);
    var a1 = Math.exp(-2 * Math.PI * 450 / sr), a2 = Math.exp(-2 * Math.PI * 2400 / sr);
    var dL = Math.exp(-6.9078 / (t60[0] * sr)), dM = Math.exp(-6.9078 / (t60[1] * sr)), dH = Math.exp(-6.9078 / (t60[2] * sr));
    var onset = Math.floor(sr * 0.014), fadeN = Math.floor(len * 0.06);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), y1 = 0, y2 = 0, eL = 1, eM = 1, eH = 1;
      for (var i = 0; i < len; i++) {
        var x = rng() * 2 - 1;
        y1 = (1 - a1) * x + a1 * y1;
        y2 = (1 - a2) * x + a2 * y2;
        var s = y1 * 2.4 * eL + (y2 - y1) * 1.0 * eM + (x - y2) * 0.4 * eH;
        eL *= dL; eM *= dM; eH *= dH;
        if (i < onset) s *= i / onset;
        if (i > len - fadeN) s *= (len - i) / fadeN;
        d[i] = s;
      }
    }
    return buf;
  }
  function makeReverb(sec, pre, t60, seed) {
    var r = { inp: G(1), out: G(1) };
    var dl = ctx.createDelay(1); dl.delayTime.value = clamp(pre, 0, 0.9);
    var cv = ctx.createConvolver();
    try { cv.normalize = true; cv.buffer = makeIR(sec, t60, seed); } catch (e) {}
    chain(r.inp, dl, cv, r.out);
    return r;
  }
  /* Plucked-string PeriodicWave (harp): a_n = sin(n*pi*p) / n^1.6 */
  function makeWaves() {
    var n = 24, re = new Float32Array(n), im = new Float32Array(n), k;
    for (k = 1; k < n; k++) im[k] = Math.abs(Math.sin(k * Math.PI * 0.14)) / Math.pow(k, 1.6);
    try { WAVES.harp = ctx.createPeriodicWave(re, im); } catch (e) { WAVES.harp = 'triangle'; }
    /* lute: plucked nearer the bridge -> more mid harmonics, a little nasal */
    var re3 = new Float32Array(n), im3 = new Float32Array(n);
    for (k = 1; k < n; k++) im3[k] = Math.abs(Math.sin(k * Math.PI * 0.2)) / Math.pow(k, 1.25);
    try { WAVES.lute = ctx.createPeriodicWave(re3, im3); } catch (e3) { WAVES.lute = 'triangle'; }
  }

  /* ------------------------------------------------------------------ */
  /*  Bus graph                                                          */
  /*  music: in -> fade -> dry + reverb -> sum -> duck -> level -> vol   */
  /*  sfx/jingle/ambience -> vol -> master (+ small fx-reverb send)      */
  /*  master -> mute -> visibility -> limiter -> trim -> destination     */
  /* ------------------------------------------------------------------ */
  function buildGraph() {
    hasStereo = typeof ctx.createStereoPanner === 'function';
    N = {};
    N.master = G(vol.master); N.mute = G(muted ? 0 : 1); N.vis = G(1);
    N.comp = ctx.createDynamicsCompressor();
    try {
      N.comp.threshold.value = -4; N.comp.knee.value = 4; N.comp.ratio.value = 16;
      N.comp.attack.value = 0.002; N.comp.release.value = 0.22;
    } catch (e) {}
    N.trim = G(0.78);   // undoes the compressor's automatic make-up gain
    chain(N.master, N.mute, N.vis, N.comp, N.trim, ctx.destination);

    N.mRev = makeReverb(4.6, 0.032, [4.8, 3.3, 1.5], 1234567);
    N.fxRev = makeReverb(2.4, 0.018, [2.4, 1.6, 0.8], 7654321);
    N.fxRev.out.connect(N.master);

    M = {};
    M.inp = G(1); M.wet = G(1);
    M.fadeA = G(1); M.fadeB = G(1);
    M.dry = G(0.62); M.send = G(0.75); M.sum = G(1);
    M.duck = G(1); M.level = G(1); M.vol = G(vol.music);
    chain(M.inp, M.fadeA, M.dry, M.sum);
    chain(M.fadeA, M.send, N.mRev.inp);
    chain(M.wet, M.fadeB, N.mRev.inp);
    N.mRev.out.connect(M.sum);
    chain(M.sum, M.duck, M.level, M.vol, N.master);

    /* sfx bus: a gentle 5 kHz low-pass keeps every effect, jingle and blip free of harsh top end */
    S = {};
    S.inp = G(1); S.lp = BQ('lowpass', 5000, -3); S.vol = G(vol.sfx); S.send = G(0.12);
    S.wet = G(1); S.wlp = BQ('lowpass', 5000, -3); S.wvol = G(vol.sfx);
    chain(S.inp, S.lp, S.vol, N.master);
    chain(S.vol, S.send, N.fxRev.inp);
    chain(S.wet, S.wlp, S.wvol, N.fxRev.inp);

    J = {};
    J.inp = G(0.55); J.send = G(0.32);
    J.inp.connect(S.inp);
    chain(J.inp, J.send, S.wet);

    A = {};
    A.inp = G(1); A.level = G(1); A.vol = G(vol.ambience); A.send = G(0.18);
    A.wet = G(1); A.wlevel = G(1); A.wvol = G(vol.ambience);
    chain(A.inp, A.level, A.vol, N.master);
    chain(A.vol, A.send, N.fxRev.inp);
    chain(A.wet, A.wlevel, A.wvol, N.fxRev.inp);

    BUF.white = makeNoise(2.5, 'white', 11);
    BUF.pink = makeNoise(5.3, 'pink', 23);
    BUF.brown = makeNoise(6.1, 'brown', 37);
    makeWaves();
  }
  /* Destinations handed to instruments: main input + wet-only input. */
  function dMusic() { return { main: M.inp, wet: M.wet, music: true }; }
  function dJingle() { return { main: J.inp, wet: S.wet, jingle: true }; }
  function dSfx() { return { main: S.inp, wet: S.wet }; }
  function dAmb() { return { main: A.inp, wet: A.wet }; }

  /* ------------------------------------------------------------------ */
  /*  Instruments. Signature: inst(T, midi, vel 0..1, dur s, opts, dst)  */
  /* ------------------------------------------------------------------ */
  function mkVoice(dst, T, wet, dry) {
    var v = new Voice(null, T);
    dry = F(dry, 1);
    if (dry >= 0.999) v.out.connect(dst.main);
    else if (dry > 0) { var d = v.n(G(dry)); v.out.connect(d); d.connect(dst.main); }
    if (wet > 0 && dst.wet) { var w = v.n(G(wet)); v.out.connect(w); w.connect(dst.wet); }
    return v;
  }
  function finishVoice(v, dst) {
    if (dst.music) regVoice(musicVoices, v, MUSIC_CAP);
    else if (dst.jingle) jingleVoices.push(v);
    else if (!dst.amb) regVoice(sfxVoices, v, SFX_CAP);
    return v;
  }
  /* Start a source with no scheduled stop (long-lived beds); stopped later via kill(). */
  Voice.prototype.srcHold = function (s, t, off) {
    var self = this;
    this.nodes.push(s); this.srcs.push(s); this.left++;
    s.onended = function () { self.left--; if (self.left <= 0) self.free(); };
    try {
      if (off !== undefined) s.start(Math.max(0, F(t, now())), Math.max(0, F(off, 0)));
      else s.start(Math.max(0, F(t, now())));
    } catch (e) {}
    this.end = Infinity;
    return s;
  };

  /* Felt piano: additive, stretched partials, per-partial decay, soft hammer, damper. */
  var PIANO_AMPS = [1, 0.46, 0.27, 0.16, 0.1, 0.06, 0.035];
  function piano(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1); dur = clamp(dur, 0.05, 30);
    var f0 = midiHz(m) * Math.pow(2, rr(-1.2, 1.2) / 1200);
    var v = mkVoice(dst, T, F(o.wet, 0));
    var cut = clamp(f0 * (2.2 + vel * 5.5) * F(o.bright, 1), 380, 5200);
    var lp = v.n(BQ('lowpass', cut, 0.5));
    var pan = v.n(PAN(clamp((m - 62) / 48, -0.45, 0.45) + F(o.pan, 0)));
    chain(lp, pan, v.out);
    sv(lp.frequency, Math.min(cut * 1.9, 9000), T);
    st(lp.frequency, cut, T + 0.004, 0.35);
    var gain = 0.16 * F(o.gain, 1) * (0.35 + 0.65 * vel);
    var att = 0.005 + (1 - vel) * 0.005;
    var tau = clamp(2.9 * Math.pow(262 / f0, 0.45), 0.7, 7.5);
    var relT = T + dur, rel = F(o.rel, 0.14);
    var t1 = T + att;
    var tEnd = Math.min(relT + rel * 7, t1 + tau * 0.35 + tau * 5.2);
    var nP = Math.max(2, Math.min(7, Math.floor(7500 / f0)));
    for (var n = 1; n <= nP; n++) {
      var fn = f0 * n * Math.sqrt(1 + 0.0004 * n * n);
      var a = PIANO_AMPS[n - 1] * gain * (n === 1 ? 1 : Math.pow(0.55 + 0.5 * vel, n - 1));
      var tn = tau / (1 + 0.6 * (n - 1)), t2 = t1 + tn * 0.35;
      var g = v.n(G(0));
      sv(g.gain, 0, T); lr(g.gain, a, t1);
      if (relT > t1) {
        st(g.gain, a * 0.38, t1, tn * 0.12);
        if (relT > t2) st(g.gain, 0, t2, tn);
      }
      st(g.gain, 0, Math.max(relT, t1), rel);
      var osc = O('sine', fn); osc.connect(g); g.connect(lp);
      v.src(osc, T, tEnd);
      if (n === 1) {
        var tw = O('sine', fn * Math.pow(2, rr(0.6, 1.5) / 1200)), tg = v.n(G(0.3));
        chain(tw, tg, g); v.src(tw, T, tEnd);
      }
    }
    var hn = NSRC(BUF.white, false), hb = v.n(BQ('bandpass', clamp(f0 * 3, 700, 3800), 0.9)), hg = v.n(G(0));
    chain(hn, hb, hg, pan);
    sv(hg.gain, 0, T); lr(hg.gain, 0.05 * gain * (0.3 + vel), T + 0.002); st(hg.gain, 0, T + 0.002, 0.01);
    v.src(hn, T, T + 0.09, rr(0, 2));
    v.relAt = Math.min(relT, t1 + tau * 0.35);
    return finishVoice(v, dst);
  }

  /* Celesta / music box: sine carrier + fast-decaying FM bell + octave shimmer. */
  function celesta(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1);
    var box = !!o.box, ratio = box ? 4 : 3.5;
    var f = midiHz(m) * Math.pow(2, rr(-1, 1) / 1200);
    var v = mkVoice(dst, T, F(o.wet, 0.25));
    var pan = v.n(PAN(clamp((m - 76) / 30, -0.5, 0.5) + F(o.pan, 0)));
    var env = v.n(G(0)); chain(env, pan, v.out);
    var gain = 0.115 * F(o.gain, 1) * (0.4 + 0.6 * vel);
    var ring = clamp((box ? 2.1 : 1.6) * Math.pow(880 / f, 0.35), 0.5, 3.2) * F(o.ring, 1);
    var tEnd = T + 0.12 + ring * 4.8;
    var car = O('sine', f), mod = O('sine', f * ratio), mg = v.n(G(0));
    sv(mg.gain, (0.35 + 0.7 * vel) * f * ratio * F(o.bell, 1), T);
    st(mg.gain, 0.04 * f * ratio, T, 0.04);
    mod.connect(mg); mg.connect(car.frequency); car.connect(env);
    sv(env.gain, 0, T); lr(env.gain, gain, T + 0.003);
    st(env.gain, gain * 0.55, T + 0.003, 0.09);
    st(env.gain, 0, T + 0.12, ring);
    var p2 = O('sine', f * (box ? 3.0 : 2.0) * Math.pow(2, 3 / 1200)), g2 = v.n(G(0));
    chain(p2, g2, pan);
    sv(g2.gain, 0, T); lr(g2.gain, gain * (box ? 0.16 : 0.26), T + 0.003); st(g2.gain, 0, T + 0.003, ring * 0.22);
    v.src(car, T, tEnd); v.src(mod, T, tEnd); v.src(p2, T, Math.min(tEnd, T + ring * 2));
    v.relAt = T + 0.3;
    return finishVoice(v, dst);
  }

  /* String ensemble pad: detuned saws -> lowpass, slow swell, delayed vibrato, stereo spread. */
  var STR_DET = [-10, 4.5, -3.5, 11, -7];
  function strings(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1);
    var f = midiHz(m), att = clamp(o.att, 0.05, 8), rel = clamp(o.rel, 0.1, 10);
    if (!isNum(o.att)) att = 2.2;
    if (!isNum(o.rel)) rel = 3.8;
    dur = Math.max(att * 0.5, clamp(dur, 0.1, 60));
    var v = mkVoice(dst, T, F(o.wet, 0.15));
    var cut = clamp(F(o.cut, 1300) * (0.75 + 0.5 * vel), 250, 4000);
    var lp = v.n(BQ('lowpass', cut, 0.6)), env = v.n(G(0));
    chain(lp, env, v.out);
    var sp = F(o.spread, 0.55), pc = F(o.pan, 0);
    var pl = v.n(PAN(pc - sp)), pr = v.n(PAN(pc + sp));
    pl.connect(lp); pr.connect(lp);
    var tEnd = T + dur + rel * 1.25;
    var lfo = O('sine', rr(4.6, 5.4)), lg = v.n(G(0));
    lfo.connect(lg);
    sv(lg.gain, 0, T); sv(lg.gain, 0, T + att * 0.6); lr(lg.gain, F(o.vib, 7), T + att * 0.6 + 1.5);
    var nS = clamp(o.n, 2, 5); if (!isNum(o.n)) nS = 4;
    for (var i = 0; i < nS; i++) {
      var s = O('sawtooth', f);
      s.detune.value = STR_DET[i] * F(o.det, 1) + rr(-2, 2);
      lg.connect(s.detune);
      var sg = v.n(G(0.9 / nS));
      chain(s, sg, (i % 2) ? pr : pl);
      v.src(s, T, tEnd);
    }
    v.src(lfo, T, tEnd);
    var peak = 0.11 * F(o.gain, 1) * (0.5 + 0.5 * vel);
    sv(env.gain, 0, T); st(env.gain, peak, T, att / 3);
    st(env.gain, 0, T + dur, rel / 4.5);
    sv(lp.frequency, cut * 0.5, T); st(lp.frequency, cut, T, att * 0.5);
    st(lp.frequency, cut * 0.6, T + dur, rel / 3);
    if (o.air) {
      var nz = NSRC(BUF.pink, true), nb = v.n(BQ('bandpass', clamp(f * 4, 700, 5000), 1.4)), ng = v.n(G(0.35));
      chain(nz, nb, ng, env);
      v.src(nz, T, tEnd, rr(0, 4));
    }
    v.relAt = T + dur;
    return finishVoice(v, dst);
  }

  /* Cello / low strings: two filtered saws with a body resonance, slow swell, light vibrato. */
  function cello(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1);
    var f = midiHz(m), att = F(o.att, 1.3), rel = F(o.rel, 2.4);
    att = clamp(att, 0.05, 8); rel = clamp(rel, 0.1, 10);
    dur = Math.max(att * 0.6, clamp(dur, 0.1, 60));
    var v = mkVoice(dst, T, F(o.wet, 0.1));
    var cut = clamp(f * 5, 260, 1100) * (0.8 + 0.4 * vel) * F(o.bright, 1);
    var lp = v.n(BQ('lowpass', cut, 1.1)), body = v.n(BQ('peaking', 260, 1.2, 4)), env = v.n(G(0));
    var pan = v.n(PAN(F(o.pan, -0.1)));
    chain(lp, body, env, pan, v.out);
    var tEnd = T + dur + rel * 1.3;
    var lfo = O('sine', rr(4.9, 5.5)), lg = v.n(G(0)); lfo.connect(lg);
    sv(lg.gain, 0, T); sv(lg.gain, 0, T + att * 0.7); lr(lg.gain, F(o.vib, 9), T + att * 0.7 + 1.2);
    var dets = [-4, 5];
    for (var i = 0; i < 2; i++) {
      var s = O('sawtooth', f); s.detune.value = dets[i]; lg.connect(s.detune);
      var sg = v.n(G(0.5)); chain(s, sg, lp); v.src(s, T, tEnd);
    }
    v.src(lfo, T, tEnd);
    var peak = 0.09 * F(o.gain, 1) * (0.5 + 0.5 * vel);
    sv(env.gain, 0, T); st(env.gain, peak, T, att / 3);
    st(env.gain, 0, T + dur, rel / 4.5);
    sv(lp.frequency, cut * 0.45, T); st(lp.frequency, cut, T, att * 0.6);
    st(lp.frequency, cut * 0.5, T + dur, rel / 3);
    v.relAt = T + dur;
    return finishVoice(v, dst);
  }

  /* Choir: saws through parallel formant band-passes; slow, quiet, mostly reverb. */
  var FORMANTS = {
    a: [[800, 6, 1], [1150, 8, 0.62], [2900, 12, 0.2]],
    o: [[300, 4.5, 1], [870, 7, 0.34], [2240, 11, 0.08]],
    e: [[400, 5, 1], [2000, 10, 0.4], [2600, 12, 0.18]]
  };
  function choir(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1);
    var f = midiHz(m), att = clamp(F(o.att, 2.6), 0.05, 10), rel = clamp(F(o.rel, 3.5), 0.1, 10);
    dur = Math.max(att * 0.5, clamp(dur, 0.1, 60));
    var v = mkVoice(dst, T, F(o.wet, 0.9), F(o.dry, 0.55));
    var fs = v.n(G(3.2)), lp = v.n(BQ('lowpass', F(o.cut, 3200), 0.5)), env = v.n(G(0));
    var pan = v.n(PAN(F(o.pan, rr(-0.35, 0.35))));
    chain(fs, lp, env, pan, v.out);
    var src = v.n(G(0.5));
    var fm = FORMANTS[o.vowel] || FORMANTS.a;
    for (var k = 0; k < fm.length; k++) {
      var bp = v.n(BQ('bandpass', fm[k][0] * F(o.formant, 1), fm[k][1])), bg = v.n(G(fm[k][2]));
      chain(src, bp, bg, fs);
    }
    var tEnd = T + dur + rel * 1.3;
    var lfo = O('sine', rr(5.0, 5.6)), lg = v.n(G(0)); lfo.connect(lg);
    sv(lg.gain, 0, T); sv(lg.gain, 0, T + att * 0.5); lr(lg.gain, 11, T + att * 0.5 + 1.5);
    var dets = [-7, 6, 1];
    for (var i = 0; i < 3; i++) {
      var s = O('sawtooth', f); s.detune.value = dets[i] + rr(-3, 3); lg.connect(s.detune);
      s.connect(src); v.src(s, T, tEnd);
    }
    v.src(lfo, T, tEnd);
    var nz = NSRC(BUF.pink, true), nb = v.n(BQ('bandpass', fm[0][0], 1.5)), ng = v.n(G(0.06));
    chain(nz, nb, ng, fs); v.src(nz, T, tEnd, rr(0, 4));
    var peak = 0.06 * F(o.gain, 1) * (0.5 + 0.5 * vel);
    sv(env.gain, 0, T); st(env.gain, peak, T, att / 3);
    st(env.gain, 0, T + dur, rel / 4.5);
    v.relAt = T + dur;
    return finishVoice(v, dst);
  }

  /* Harp: plucked-string waveform with a bright transient that mellows quickly. */
  function harp(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1);
    var f = midiHz(m) * Math.pow(2, rr(-1.5, 1.5) / 1200);
    var v = mkVoice(dst, T, F(o.wet, 0.2));
    var osc = O(WAVES.harp || 'triangle', f);
    var lp = v.n(BQ('lowpass', 2000, 0.6)), env = v.n(G(0));
    var pan = v.n(PAN(clamp((m - 60) / 40, -0.6, 0.6) + F(o.pan, 0)));
    chain(osc, lp, env, pan, v.out);
    var tau = clamp(1.4 * Math.pow(262 / f, 0.4), 0.35, 2.8) * F(o.ring, 1);
    var gain = 0.12 * F(o.gain, 1) * (0.4 + 0.6 * vel);
    var hi = clamp(f * 14 * (0.6 + 0.6 * vel), 1500, 9000), lo = clamp(f * 3.5, 400, 5000);
    sv(lp.frequency, hi, T); st(lp.frequency, lo, T + 0.002, 0.12);
    sv(env.gain, 0, T); lr(env.gain, gain, T + 0.004);
    st(env.gain, gain * 0.6, T + 0.004, 0.06);
    st(env.gain, 0, T + 0.06, tau);
    var tEnd = T + 0.06 + tau * 5;
    if (o.damp && isNum(dur) && dur > 0.05) { st(env.gain, 0, T + dur, 0.08); tEnd = Math.min(tEnd, T + dur + 0.6); }
    v.src(osc, T, tEnd);
    var nz = NSRC(BUF.white, false), nh = v.n(BQ('bandpass', 2200, 0.9)), ng = v.n(G(0));
    chain(nz, nh, ng, pan);
    sv(ng.gain, 0, T); lr(ng.gain, gain * 0.08, T + 0.003); st(ng.gain, 0, T + 0.003, 0.006);
    v.src(nz, T, T + 0.04, rr(0, 2));
    v.relAt = T + 0.25;
    return finishVoice(v, dst);
  }

  /* Lute-like pluck: paired courses (two slightly detuned strings), wooden body, quick mellowing. */
  function lute(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1);
    var f = midiHz(m) * Math.pow(2, rr(-1.5, 1.5) / 1200);
    var v = mkVoice(dst, T, F(o.wet, 0.18));
    var lp = v.n(BQ('lowpass', 2000, -1)), body = v.n(BQ('peaking', 380, 1.1, 4)), nasal = v.n(BQ('peaking', 1250, 1.6, 3)), env = v.n(G(0));
    var pan = v.n(PAN(clamp((m - 60) / 40, -0.5, 0.5) + F(o.pan, 0)));
    chain(lp, body, nasal, env, pan, v.out);
    var tau = clamp(0.95 * Math.pow(262 / f, 0.4), 0.28, 1.7) * F(o.ring, 1);
    var gain = 0.1 * F(o.gain, 1) * (0.4 + 0.6 * vel);
    var hi = clamp(f * 10 * (0.6 + 0.6 * vel), 1200, 6000), lo2 = clamp(f * 3, 350, 3000);
    sv(lp.frequency, hi, T); st(lp.frequency, lo2, T + 0.004, 0.07);
    sv(env.gain, 0, T); lr(env.gain, gain, T + 0.004);
    st(env.gain, gain * 0.55, T + 0.004, 0.05);
    st(env.gain, 0, T + 0.05, tau);
    var tEnd = T + 0.05 + tau * 5;
    if (o.damp && isNum(dur) && dur > 0.05) { st(env.gain, 0, T + dur, 0.07); tEnd = Math.min(tEnd, T + dur + 0.5); }
    var a = O(WAVES.lute || 'triangle', f), b = O(WAVES.lute || 'triangle', f * Math.pow(2, rr(2, 4) / 1200)), bg = v.n(G(0.7));
    a.connect(lp); chain(b, bg, lp);
    v.src(a, T, tEnd); v.src(b, T + 0.004, tEnd);
    v.relAt = T + 0.2;
    return finishVoice(v, dst);
  }

  /* Organ (flue pipes): additive 16'/8'/4'/2 2/3'/2' with a detuned voix celeste, slow swell. */
  var ORGAN_STOPS = [[0.5, 0.3], [1, 1], [2, 0.42], [3, 0.14], [4, 0.1]];
  function organ(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1);
    var f = midiHz(m), att = clamp(F(o.att, 1.1), 0.05, 8), rel = clamp(F(o.rel, 2.2), 0.1, 10);
    dur = Math.max(att * 0.5, clamp(dur, 0.1, 60));
    var v = mkVoice(dst, T, F(o.wet, 0.3));
    var lp = v.n(BQ('lowpass', clamp(f * 6, 700, 2800) * F(o.bright, 1), -2)), env = v.n(G(0));
    var pan = v.n(PAN(F(o.pan, rr(-0.3, 0.3))));
    chain(lp, env, pan, v.out);
    var tEnd = T + dur + rel * 1.25, k;
    for (k = 0; k < ORGAN_STOPS.length; k++) {
      var fr = f * ORGAN_STOPS[k][0];
      if (fr > 6000) continue;
      var osc = O('sine', fr), g = v.n(G(ORGAN_STOPS[k][1]));
      chain(osc, g, lp); v.src(osc, T, tEnd);
    }
    var cel = O('sine', f * Math.pow(2, F(o.celeste, 5) / 1200)), cg = v.n(G(0.55));
    chain(cel, cg, lp); v.src(cel, T, tEnd);
    var peak = 0.03 * F(o.gain, 1) * (0.5 + 0.5 * vel);
    sv(env.gain, 0, T); st(env.gain, peak, T, att / 3);
    st(env.gain, 0, T + dur, rel / 4.5);
    v.relAt = T + dur;
    return finishVoice(v, dst);
  }

  /* Bowed glass / wisp tone: pure fundamental with a slowly beating twin and faint inharmonic partials. */
  function glass(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1);
    var f = midiHz(m), att = clamp(F(o.att, 0.45), 0.02, 6), rel = clamp(F(o.rel, 1.6), 0.1, 8);
    dur = Math.max(att, clamp(dur, 0.1, 30));
    var v = mkVoice(dst, T, F(o.wet, 0.8), F(o.dry, 0.7));
    var env = v.n(G(0)), pan = v.n(PAN(F(o.pan, rr(-0.5, 0.5))));
    chain(env, pan, v.out);
    var tEnd = T + dur + rel * 1.3;
    var parts = [[1, 1], [1 + F(o.beat, 2.6) / f, 0.6], [2.76, 0.07], [5.4, 0.02]];
    var lfo = O('sine', rr(4.2, 5.2)), lg = v.n(G(0));
    lfo.connect(lg);
    sv(lg.gain, 0, T); lr(lg.gain, F(o.vib, 6), T + att + 0.8);
    for (var k = 0; k < parts.length; k++) {
      var fr = f * parts[k][0];
      if (fr > 5500) continue;
      var osc = O('sine', fr), g = v.n(G(parts[k][1]));
      lg.connect(osc.detune);
      chain(osc, g, env); v.src(osc, T, tEnd);
    }
    v.src(lfo, T, tEnd);
    var peak = 0.05 * F(o.gain, 1) * (0.5 + 0.5 * vel);
    sv(env.gain, 0, T); st(env.gain, peak, T, att / 3);
    st(env.gain, 0, T + dur, rel / 4.5);
    v.relAt = T + dur;
    return finishVoice(v, dst);
  }

  var INST = { piano: piano, celesta: celesta, strings: strings, cello: cello, choir: choir, harp: harp, lute: lute, organ: organ, glass: glass };

  /* Drone bed for the depths: root + fifth + sub, slowly breathing filter; tension grows with depth. */
  function DroneBed(depth) {
    var t = now() + 0.05, root = 38;
    var v = this.v = mkVoice(dMusic(), t, 0.35);
    this.lp = v.n(BQ('lowpass', 320, 0.9));
    this.env = v.n(G(0));
    var breath = v.n(G(1));
    chain(this.lp, breath, this.env, v.out);
    var specs = [['sawtooth', root, 0, 0.5], ['sawtooth', root + 7, 3, 0.3], ['sine', root - 12, 0, 0.55], ['sawtooth', root + 1, -2, 0], ['sawtooth', root + 6, 2, 0]];
    this.g = [];
    for (var i = 0; i < specs.length; i++) {
      var o = O(specs[i][0], midiHz(specs[i][1])); o.detune.value = specs[i][2];
      var g = v.n(G(specs[i][3])); chain(o, g, this.lp); v.srcHold(o, t);
      this.g.push(g);
    }
    var lfo = O('sine', 0.031), lg = v.n(G(110));
    chain(lfo, lg, this.lp.frequency); v.srcHold(lfo, t);
    var amp = O('sine', 0.019), ag = v.n(G(0.25));
    chain(amp, ag, breath.gain); v.srcHold(amp, t);
    this.level = 0.03;
    st(this.env.gain, this.level, t, 2.5);
    this.update(depth, t);
  }
  DroneBed.prototype.update = function (depth, t) {
    t = F(t, now());
    var d = clamp(depth, 1, 80), k = clamp((d - 1) / 59, 0, 1);
    st(this.lp.frequency, 340 - 170 * k, t, 4);
    st(this.g[2].gain, 0.45 + 0.35 * k, t, 4);
    st(this.g[3].gain, d >= 15 ? 0.05 + 0.13 * k : 0, t, 6);   /* minor 2nd */
    st(this.g[4].gain, d >= 30 ? 0.04 + 0.1 * k : 0, t, 6);    /* tritone  */
  };
  DroneBed.prototype.stop = function (fade) {
    var t = now(); fade = F(fade, 3.5);
    st(this.env.gain, 0, t, fade / 4);
    var v = this.v;
    v.kill(t + fade, 0.1);
  };

  /* ------------------------------------------------------------------ */
  /*  Composition toolkit: scale degrees, chords, voice leading,         */
  /*  phrased melodies with rubato, accompaniment patterns.              */
  /*  A track composes a whole performance up front into a sorted list   */
  /*  of {t, f} events (relative seconds); the scheduler plays them.     */
  /* ------------------------------------------------------------------ */
  var MODES = {
    aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], ionian: [0, 2, 4, 5, 7, 9, 11],
    lydian: [0, 2, 4, 6, 7, 9, 11], phrygian: [0, 1, 3, 5, 7, 8, 10]
  };
  function Comp(seed, bpm, tonic, mode, dst) {
    this.r = mulberry32(seed);
    this.b = 60 / clamp(bpm, 20, 200);
    this.tonic = tonic; this.mode = MODES[mode] || MODES.aeolian;
    this.ev = []; this.prevV = {}; this.dst = dst || null;
    this.rub = 1; this.orn = 0.12;
  }
  var CP = Comp.prototype;
  CP.tempo = function (bpm) { this.b = 60 / clamp(bpm, 20, 200); };
  CP.rnd = function (a, b) { return a + (b - a) * this.r(); };
  CP.chance = function (p) { return this.r() < p; };
  CP.pick = function (arr) { return arr[Math.floor(this.r() * arr.length) % arr.length]; };
  CP.pitch = function (deg, acc) {
    deg = Math.round(F(deg, 0));
    var o = Math.floor(deg / 7), i = deg - o * 7;
    return this.tonic + 12 * o + this.mode[i] + F(acc, 0);
  };
  CP.at = function (t, fn) { this.ev.push({ t: Math.max(0, F(t, 0)), f: fn }); };
  CP.note = function (inst, t, m, vel, dur, o) {
    var fn = INST[inst], dst = this.dst;
    if (!fn || !isNum(m)) return;
    this.at(t, function (T) { fn(T, m, vel, dur, o, dst || dMusic()); });
  };
  CP.done = function (dur) {
    this.ev.sort(function (a, b) { return a.t - b.t; });
    return { ev: this.ev, dur: F(dur, 60) };
  };

  /* Melody strings: "deg:beats" tokens, 'r' = rest, '#'/'b' suffix = chromatic alteration. */
  var melCache = {};
  function parseMel(s) {
    s = String(s);
    if (melCache[s]) return melCache[s];
    var out = [], parts = s.split(/\s+/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i]; if (!p) continue;
      var kv = p.split(':'), k = kv[0], b = parseFloat(kv[1]);
      if (!isNum(b)) b = 1;
      if (k === 'r') { out.push({ r: true, b: b }); continue; }
      var acc = 0, last = k.charAt(k.length - 1);
      if (last === '#') { acc = 1; k = k.slice(0, -1); } else if (last === 'b') { acc = -1; k = k.slice(0, -1); }
      var d = parseInt(k, 10);
      if (!isNum(d)) { out.push({ r: true, b: b }); continue; }
      out.push({ d: d, acc: acc, b: b });
    }
    melCache[s] = out;
    return out;
  }

  /* Play a phrase at time t; returns its end time.
     o: inst, shift (degrees), oct (semitones), vel, leg, pedal, orn, rub, dbl, thin, io, stretch */
  CP.mel = function (t, s, o) {
    o = o || {};
    var notes = parseMel(s), inst = o.inst || 'piano', sh = F(o.shift, 0), oc = F(o.oct, 0);
    var b = this.b * F(o.stretch, 1), rub = F(o.rub, this.rub);
    var lo = 999, hi = -999, i, nt, p, last = -1, count = 0;
    for (i = 0; i < notes.length; i++) {
      nt = notes[i];
      if (!nt.r) { p = this.pitch(nt.d + sh, nt.acc); if (p < lo) lo = p; if (p > hi) hi = p; last = i; }
    }
    var span = Math.max(1, hi - lo), base = F(o.vel, 0.5), cur = t, graced = false, prevP = null;
    for (i = 0; i < notes.length; i++) {
      nt = notes[i];
      var dur = nt.b * b;
      var stretch = 1 + (i === last ? 0.1 * rub : 0) + (i === 0 ? 0.03 * rub : 0);
      if (!nt.r) {
        if (o.thin && count > 0 && i !== last && this.chance(o.thin)) { cur += dur * stretch; continue; }
        p = this.pitch(nt.d + sh, nt.acc);
        var m = p + oc;
        var jit = (this.r() - 0.5) * 0.09 * rub * Math.min(b, dur);
        var vel = base + 0.14 * (p - lo) / span - (i === last ? 0.05 : 0) + this.rnd(-0.04, 0.04);
        var T = Math.max(0, cur + jit);
        var hold = dur * F(o.leg, 0.95) + F(o.pedal, 0);
        var gp = this.pitch(nt.d + sh + 1) + oc;
        if (o.orn !== 0 && !graced && gp !== prevP && dur >= b * 0.9 && this.chance(F(o.orn, this.orn))) {
          this.note(inst, Math.max(0, T - 0.11), gp, clamp(vel * 0.55, 0.05, 0.9), 0.14, o.io);
          graced = true;
        } else graced = false;
        prevP = m;
        this.note(inst, T, m, clamp(vel, 0.08, 0.95), hold, o.io);
        if (o.dbl && this.chance(o.dbl)) this.note(inst, T + 0.014, m - 12, clamp(vel * 0.5, 0.05, 0.9), hold, o.io);
        count++;
      }
      cur += dur * stretch;
    }
    return cur;
  };

  /* Chord spec "deg[:type][/bassDeg]": types '', 7, 9 (add9), s2, s4, M (major 3rd), m, 5, M7 */
  var CH_TONES = { '': [0, 2, 4], '7': [0, 2, 4, 6], '9': [0, 2, 4, 8], 's2': [0, 1, 4], 's4': [0, 3, 4], 'M': [0, 2, 4], 'm': [0, 2, 4], '5': [0, 4], 'M7': [0, 2, 4, 6], 'M9': [0, 2, 4, 8] };
  CP.chord = function (spec) {
    if (spec && typeof spec === 'object') return spec;
    var parts = String(spec).split('/'), q = parts[0].split(':'), r = parseInt(q[0], 10) || 0, ty = q[1] || '';
    var tones = CH_TONES[ty] || CH_TONES[''], root = this.pitch(r), out = [];
    for (var i = 0; i < tones.length; i++) {
      var m = this.pitch(r + tones[i]);
      if (tones[i] === 2 && ty.charAt(0) === 'M') m = root + 4;
      if (tones[i] === 2 && ty === 'm') m = root + 3;
      out.push(m);
    }
    var bd = parts.length > 1 ? parseInt(parts[1], 10) : r;
    return { root: root, tones: out, bass: this.pitch(isNum(bd) ? bd : r), spec: spec };
  };
  function pcOf(m) { return ((Math.round(m) % 12) + 12) % 12; }
  function avg(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
  /* Semitone clusters (and close seconds in the low register) sound muddy on pads. */
  function clusterCost(v) {
    var c = 0;
    for (var k = 1; k < v.length; k++) {
      var iv = v[k] - v[k - 1];
      if (iv === 1) c += 7; else if (iv === 2 && v[k - 1] < 60) c += 2;
    }
    return c;
  }
  /* Voicing inside [lo, hi]: close and open (2nd voice up an octave) candidates of every inversion;
     picks the one that moves least from the previous voicing and avoids clusters. */
  CP.voicing = function (spec, lo, hi, key) {
    var ch = this.chord(spec), pcs = [], i, k, c;
    key = key || 'pad';
    for (i = 0; i < ch.tones.length; i++) { var pc = pcOf(ch.tones[i]); if (pcs.indexOf(pc) < 0) pcs.push(pc); }
    var prev = this.prevV[key], best = null, bestCost = 1e9, lowest = null;
    for (var s = lo; s < lo + 12; s++) {
      if (pcs.indexOf(pcOf(s)) < 0) continue;
      var v = [s], rem = pcs.slice();
      rem.splice(rem.indexOf(pcOf(s)), 1);
      while (rem.length) {
        var lastP = v[v.length - 1], bi = 0, bp = 1e9;
        for (k = 0; k < rem.length; k++) {
          var iv = ((rem[k] - lastP) % 12 + 12) % 12; if (iv === 0) iv = 12;
          if (lastP + iv < bp) { bp = lastP + iv; bi = k; }
        }
        v.push(bp); rem.splice(bi, 1);
      }
      if (!lowest) lowest = v;
      var cands = [v];
      if (v.length >= 3) { var o = v.slice(); o[1] += 12; o.sort(function (a, b) { return a - b; }); cands.push(o); }
      for (c = 0; c < cands.length; c++) {
        var w = cands[c];
        if (w[w.length - 1] > hi) continue;
        var cost = clusterCost(w);
        if (prev && prev.length === w.length) { for (k = 0; k < w.length; k++) cost += Math.abs(w[k] - prev[k]); }
        else cost += Math.abs(avg(w) - (prev ? avg(prev) : (lo + hi) / 2)) * w.length;
        cost += this.r() * 1.5;
        if (cost < bestCost) { bestCost = cost; best = w; }
      }
    }
    best = best || lowest || [lo];
    this.prevV[key] = best;
    return best;
  };
  CP.bassNote = function (spec, lo, hi) {
    var b = this.chord(spec).bass;
    while (b < lo) b += 12;
    while (b > hi) b -= 12;
    return b;
  };
  /* Sustained chord. o: inst, lo, hi, vel, io, key, top (use only the top n notes), stagger */
  CP.pad = function (t, dur, spec, o) {
    o = o || {};
    var v = this.voicing(spec, F(o.lo, 52), F(o.hi, 72), o.key || 'pad');
    if (o.top) v = v.slice(Math.max(0, v.length - o.top));
    for (var i = 0; i < v.length; i++) {
      this.note(o.inst || 'strings', t + i * F(o.stagger, 0.08) * this.r(), v[i], F(o.vel, 0.5) + this.rnd(-0.05, 0.05), dur, o.io);
    }
    return v;
  };
  /* Left-hand piano for one chord over `bars` bars.
     pat: 'hold' bass + soft upper note | 'arp' broken chord | 'fifth' open fifth | 'sparse' bass only */
  CP.lh = function (t, bars, spec, pat, o) {
    o = o || {};
    var ch = this.chord(spec), b = this.b, bpb = F(o.bpb, 4), vel = F(o.vel, 0.32);
    var root = this.bassNote(ch, F(o.lo, 36), F(o.hi, 49)), total = bars * bpb * b, io = o.io;
    var up = [];
    for (var i = 0; i < ch.tones.length; i++) {
      var pc = pcOf(ch.tones[i]), iv = ((pc - pcOf(root)) % 12 + 12) % 12;
      if (iv !== 0) up.push(iv);
    }
    up.sort(function (x, y) { return x - y; });
    var fifth = root + (up.indexOf(7) >= 0 ? 7 : (up.length ? up[up.length - 1] : 7));
    var tenth = root + 12 + (up.length ? up[0] : 4);
    var j = function (c) { return (c.r() - 0.5) * 0.05; };
    if (pat === 'arp') {
      for (var bar = 0; bar < bars; bar++) {
        var tb = t + bar * bpb * b, seq = bpb === 3 ? [root, fifth, tenth] : [root, fifth, tenth, fifth + 12 > 64 ? fifth : fifth + 12];
        for (var k = 0; k < seq.length; k++) {
          if (bar > 0 && k === 0 && this.chance(0.3)) continue;
          this.note('piano', tb + k * b + j(this), seq[k], vel * (k === 0 ? 1 : 0.72) + this.rnd(-0.03, 0.03), (bpb - k) * b + 0.4, io);
        }
      }
    } else if (pat === 'fifth') {
      this.note('piano', t + j(this), root, vel, total + 0.3, io);
      this.note('piano', t + 0.03 + j(this), fifth, vel * 0.75, total + 0.3, io);
    } else if (pat === 'sparse') {
      this.note('piano', t + j(this), root, vel, total + 0.3, io);
      if (bars > 1 && this.chance(0.5)) this.note('piano', t + bpb * b + j(this), root + 12, vel * 0.6, total - bpb * b + 0.3, io);
    } else {
      this.note('piano', t + j(this), root, vel, total + 0.3, io);
      this.note('piano', t + 2 * b + j(this), this.chance(0.5) ? tenth : fifth, vel * 0.68, total - 2 * b + 0.3, io);
      if (bars > 1) this.note('piano', t + (bpb + 2) * b + j(this), fifth + 12 <= 62 ? fifth + 12 : tenth, vel * 0.55, total - (bpb + 2) * b + 0.3, io);
    }
  };
  /* Section: one chord per `bpc` bars, one melody phrase per chord, optional layers.
     o: bpb, bpc, pad{...}, lh, lho, cello{vel,gain}, choir{vowel,vel,lo,hi}, mel{...} */
  CP.section = function (t, chords, mels, o) {
    o = o || {};
    var bar = F(o.bpb, 4) * this.b, bpc = F(o.bpc, 2);
    for (var i = 0; i < chords.length; i++) {
      var ch = this.chord(chords[i]), len = bpc * bar * (1 + this.rnd(0, 0.03) * this.rub);
      if (o.pad) this.pad(t, len + 0.4, ch, o.pad);
      if (o.lh) this.lh(t, bpc, ch, o.lh, o.lho);
      if (o.cello && (!o.cello.p || this.chance(o.cello.p))) {
        this.note('cello', t, this.bassNote(ch, F(o.cello.lo, 38), F(o.cello.hi, 50)), F(o.cello.vel, 0.4), len + 0.2, o.cello.io || { att: 1.6, rel: 2.6, gain: F(o.cello.gain, 0.8) });
      }
      if (o.choir && (!o.choir.p || this.chance(o.choir.p))) {
        this.pad(t + this.rnd(0, 0.6), len + 0.5, ch, { inst: 'choir', lo: F(o.choir.lo, 60), hi: F(o.choir.hi, 76), top: F(o.choir.top, 2), key: 'choir', vel: F(o.choir.vel, 0.4), io: o.choir.io || { vowel: o.choir.vowel || 'a', att: 3, rel: 4 } });
      }
      if (mels && mels[i]) this.mel(t, mels[i], o.mel);
      t += len;
    }
    return t;
  };

  /* ------------------------------------------------------------------ */
  /*  TRACKS. Each returns {ev, dur} for one complete performance.       */
  /*  Melodies are written in scale degrees (0 = tonic) of the key.      */
  /* ------------------------------------------------------------------ */

  /* title - D minor. Felt piano over strings; choir at the climax; Picardy or suspended ending.
     Motif: rising minor sixth A->F then a stepwise fall (A F E D A), sequenced over Dm-Bb-F-C. */
  function trTitle(seed) {
    var c = new Comp(seed, 60, 62, 'aeolian');
    c.tempo(c.rnd(56, 62));
    var bar = 4 * c.b, t = 0.3;
    var strIO = { att: 2.6, rel: 4.5, cut: 1050, gain: 0.85 };
    var pad = { lo: 50, hi: 70, vel: 0.42, io: strIO };
    var A = ['0:9', '5:7', '2', '6:s4'];
    var melA = ['r:1 4:1 9:2 8:1 7:1 4:2', 'r:1 3:1 8:2 7:1 6:1 3:2', 'r:1 2:1 6:1.5 5:.5 4:2 r:2', 'r:1 3:1 4:1 6:1 4:3 r:1'];
    var melA2 = [c.pick(['r:1 4:1 9:1.5 10:.5 9:1 8:1 7:2', 'r:1 4:1 9:2 11:1 9:1 8:2']), 'r:1 5:1 9:2 8:1 7:1 5:2',
      c.pick(['r:1 4:1 6:1 9:1 8:2 7:2', 'r:1 6:1 9:1.5 8:.5 6:2 4:2']), '6:1.5 5:.5 4:2 3:1 4:1 r:2'];
    var B = ['3', '5:7', '2', '4:M'];
    var melB = ['r:1 7:1 10:2 9:1 8:1 7:2', 'r:1 9:1 12:2 11:1.5 9:.5 7:2', 'r:1 8:1 11:2 9:1 8:1 6:2', 'r:1 7:1 6#:1 4:1 8:4'];

    /* intro: the open fifth, the pad breathing in, a distant echo of the motif's leap */
    c.pad(t, 2 * bar + 0.5, '0:9', pad);
    c.lh(t, 2, '0:9', 'fifth', { vel: 0.3 });
    c.mel(t, 'r:4 11:2 9:2', { vel: 0.3, pedal: 1.5, orn: 0 });
    t += 2 * bar;

    t = c.section(t, A, melA, { pad: pad, lh: c.pick(['hold', 'hold', 'sparse']), lho: { vel: 0.3 }, mel: { vel: 0.5, pedal: 0.6, orn: 0.1, rub: 1.1 } });
    if (c.chance(0.7)) {
      t = c.section(t, A, melA2, {
        pad: pad, lh: c.pick(['arp', 'hold']), lho: { vel: 0.3 }, cello: { vel: 0.38, gain: 0.7, p: 0.7 },
        mel: { vel: 0.52, dbl: 0.2, orn: 0.12, pedal: 0.5 }
      });
    }
    t = c.section(t, B, melB, {
      pad: { lo: 52, hi: 71, vel: 0.5, io: { att: 2.2, rel: 4.5, cut: 1300, gain: 0.95 } },
      lh: 'arp', lho: { vel: 0.34 }, cello: { vel: 0.45, gain: 0.8 },
      choir: { vowel: 'a', vel: 0.45, lo: 62, hi: 77, top: 2, io: { vowel: 'a', att: 3.2, rel: 4.5 } },
      mel: { vel: 0.6, dbl: 0.35, pedal: 0.8, orn: 0.08 }
    });
    /* outro: the motif in augmentation over Bbmaj7, then home */
    var fin = '0:' + c.pick(['M', 'M', 's2', '9']);
    c.pad(t, 2 * bar + 0.6, '5:7', pad);
    c.lh(t, 2, '5:7', 'hold', { vel: 0.28 });
    c.mel(t, 'r:2 4:2 9:3 8:1', { vel: 0.45, rub: 1.5, pedal: 0.8, orn: 0 });
    c.note('choir', t + bar, c.pitch(7), 0.3, bar * 4, { vowel: 'o', att: 4, rel: 5 });
    t += 2 * bar * 1.04;
    c.pad(t, 3 * bar, fin, { lo: 50, hi: 70, vel: 0.4, io: { att: 3, rel: 6.5, cut: 950, gain: 0.85 } });
    c.lh(t, 3, fin, 'fifth', { vel: 0.27 });
    c.mel(t, '7:8', { vel: 0.42, rub: 0, orn: 0 });
    c.note('piano', t + 2 * bar + c.rnd(0, 0.4), c.pitch(14), 0.2, 4);
    return c.done(t + 3 * bar + 7.5);
  }

  /* sanctum - E Dorian, 3/4. Celesta hymn over a soft string pad, very distant choir.
     Night: slower and darker, mostly pad + choir, the celesta thinned out. */
  function trSanctum(seed, o) {
    var night = !!(o && o.night);
    var c = new Comp(seed, 55, 64, 'dorian');
    c.tempo(night ? c.rnd(48, 53) : c.rnd(52, 58));
    c.rub = 0.8;
    var bar = 3 * c.b, t = 0.3;
    var celIO = { gain: night ? 0.62 : 0.85, wet: 0.4 };
    var pad = { lo: 52, hi: 71, vel: night ? 0.36 : 0.42, io: { att: 3, rel: 5, cut: night ? 720 : 1000, gain: 0.8, air: night } };
    var cel = { inst: 'celesta', oct: 12, vel: 0.5, orn: 0.06, io: celIO, thin: night ? 0.45 : 0 };
    var cho = { vowel: 'o', vel: night ? 0.45 : 0.32, lo: 64, hi: 79, top: 2, p: night ? 0.9 : 0.55, io: { vowel: 'o', att: 4, rel: 5, dry: 0.3, wet: 1.0 } };
    var vc = { vel: 0.3, gain: 0.55, lo: 40, hi: 52, io: { att: 2.5, rel: 3, gain: 0.55 } };
    var A = ['0:9', '3:9', '2:7', '6'];
    var SA = ['4:1 7:1 8:1 9:2 8:1', '7:2 5:1 4:3', '4:1 6:1 7:1 9:3', '8:1.5 7:.5 6:1 7:3'];
    var SA2 = ['4:1 7:1 8:1 11:2 9:1', '10:2 9:1 7:3', '9:1 8:1 7:1 6:3', '5:1.5 4:.5 3:1 4:3'];
    var B = ['3', '0:7', '6:9', '4:s4'];
    var SB = ['r:1 9:1 10:1 12:3', '11:2 9:1 7:3', 'r:1 8:1 10:1 9:3', '8:2 7:1 8:3'];
    function thinMel(list) {
      if (!night) return list;
      var out = [];
      for (var i = 0; i < list.length; i++) out.push(c.chance(0.4) ? null : list[i]);
      return out;
    }
    c.pad(t, 2 * bar + 0.5, '0:9', pad);
    c.pad(t + 0.5, 2 * bar + 1, '0:9', { inst: 'choir', lo: 64, hi: 79, top: 1, key: 'choir', vel: cho.vel * 0.8, io: cho.io });
    c.note('cello', t, 40, 0.3, 2 * bar, vc.io);
    c.mel(t, 'r:3 11:3', { inst: 'celesta', oct: 12, vel: 0.35, io: celIO, orn: 0 });
    t += 2 * bar;
    var sec = { bpb: 3, pad: pad, choir: cho, cello: vc, mel: cel };
    t = c.section(t, A, thinMel(SA), sec);
    t = c.section(t, B, thinMel(SB), sec);
    if (c.chance(0.6)) {
      sec.mel = { inst: 'celesta', oct: c.chance(0.3) ? 0 : 12, vel: 0.52, orn: 0.1, io: celIO, thin: night ? 0.45 : 0 };
      t = c.section(t, A, thinMel(SA2), sec);
    }
    c.pad(t, 2 * bar + 0.5, '0:9', pad);
    c.mel(t, 'r:1 7:2 4:3', cel);
    c.note('cello', t, 40, 0.3, 5 * bar, vc.io);
    t += 2 * bar * 1.05;
    c.pad(t, 3 * bar, '0:s2', { lo: 52, hi: 71, vel: 0.36, io: { att: 3.5, rel: 6.5, cut: 850, gain: 0.8 } });
    c.pad(t, 3 * bar + 1, '0:5', { inst: 'choir', lo: 64, hi: 79, top: 2, key: 'choir', vel: cho.vel, io: { vowel: 'o', att: 4, rel: 6, dry: 0.3, wet: 1.0 } });
    c.mel(t + c.b, c.pick(['7:3 8:6', '8:3 7:6']), { inst: 'celesta', oct: 12, vel: 0.4, io: celIO, orn: 0 });
    return c.done(t + 3 * bar + 8);
  }

  /* village_night - A minor / C major. Solo felt piano, sparse and rubato, lots of pedal;
     now and then a low string under it. Ends on C(add9) (hope) or E -> Am (sorrow). */
  function trVillage(seed) {
    var c = new Comp(seed, 53, 57, 'aeolian');
    c.tempo(c.rnd(50, 56));
    c.rub = 1.6; c.orn = 0.12;
    var bar = 4 * c.b, t = 0.4;
    var V1 = ['0', '5:7', '2', '6:s4'], V2 = ['0', '4', '5:7'];
    var P = ['r:1 11:1 9:1 7:1 8:3 r:1', 'r:1 9:1 7:1 5:1 4:4', 'r:2 7:1 9:1 11:3 r:1', '10:1.5 9:.5 8:2 6:4'];
    var Palt = ['r:1 11:1.5 12:.5 11:1 9:3 r:1', 'r:2 9:1 7:1 4:4', 'r:1 7:1 9:1 11:1 14:3 r:1', '13:1.5 12:.5 10:2 8:4'];
    var P2 = ['r:1 11:1 9:1 7:1 12:3 r:1', '11:2 8:2 7:4', 'r:1 9:1 11:1 12:1 11:4'];
    var mel = { vel: 0.46, pedal: 1.0, orn: 0.12 };
    var low = { vel: 0.32, gain: 0.6, p: 0.3, lo: 33, hi: 45, io: { att: 2.2, rel: 3, gain: 0.6, bright: 0.8 } };
    var lhPat = function () { return c.pick(['sparse', 'sparse', 'fifth', 'hold']); };
    function pass(chords, mels) {
      for (var i = 0; i < chords.length; i++) {
        t = c.section(t, [chords[i]], [mels[i]], { lh: lhPat(), lho: { vel: 0.3, lo: 33, hi: 47 }, cello: low, mel: mel });
      }
    }
    /* intro: a low open fifth, one high note in the dark */
    c.lh(t, 1, '0', 'fifth', { vel: 0.3, lo: 33, hi: 45 });
    c.note('piano', t + 2 * c.b + c.rnd(0, 0.3), c.pitch(18), 0.22, 3);
    t += bar;
    pass(V1, P);
    pass(V2, P2);
    if (c.chance(0.55)) {
      var alt = [];
      for (var i = 0; i < 4; i++) alt.push(c.chance(0.6) ? Palt[i] : P[i]);
      mel = { vel: 0.44, pedal: 1.0, orn: 0.15, oct: c.chance(0.2) ? 12 : 0 };
      pass(V1, alt);
      mel = { vel: 0.46, pedal: 1.0, orn: 0.12 };
    }
    /* ending */
    if (c.chance(0.5)) {
      t = c.section(t, ['6'], ['10:2 8:2 6:4'], { lh: 'hold', lho: { vel: 0.3, lo: 33, hi: 47 }, mel: mel });
      c.lh(t, 3, '2:9', 'fifth', { vel: 0.28, lo: 33, hi: 45 });
      c.mel(t, '9:2 11:2 r:1 7:7', { vel: 0.42, pedal: 2, rub: 2, orn: 0 });
      c.note('cello', t, 36, 0.3, 3 * bar, { att: 2.5, rel: 4, gain: 0.55 });
    } else {
      t = c.section(t, ['4:M'], ['8:2 6#:2 r:4'], { lh: 'hold', lho: { vel: 0.3, lo: 33, hi: 47 }, mel: mel });
      c.lh(t, 3, '0:9', 'fifth', { vel: 0.28, lo: 33, hi: 45 });
      c.mel(t, '7:8', { vel: 0.4, pedal: 2, rub: 0, orn: 0 });
      c.note('cello', t, 33, 0.3, 3 * bar, { att: 2.5, rel: 4, gain: 0.55 });
    }
    return c.done(t + 3 * bar + 7);
  }

  /* woods_night - G Dorian (= Bb Lydian colours). Harp arpeggios, airy pad,
     celesta "fireflies"; a falling firefly motif (D B-flat A ... D) opens each section. */
  function trWoods(seed) {
    var c = new Comp(seed, 63, 55, 'dorian');
    c.tempo(c.rnd(60, 66));
    c.rub = 0.5;
    var bar = 4 * c.b, e = c.b / 2, t = 0.3;
    var padO = { lo: 50, hi: 67, vel: 0.38, io: { att: 3, rel: 5, cut: 820, gain: 0.62, n: 3, air: true } };
    var harpIO = { gain: 0.8, ring: 0.6, wet: 0.3 };
    var celIO = { gain: 0.7, wet: 0.5 };
    var A = ['0:9', '3/0', '2:7', '6'], B = ['2:7', '1:7', '0:9', '4:7'];
    var motif = ['18:1 16:1 15:2 11:4', '18:1 16:1 15:1 14:1 11:4', '17:1 16:1 15:2 12:4'];
    var pats = { wave: [0, 2, 3, 4, 5, 4, 3, 2], rise: [0, 1, 2, 3, 4, 5, -1, -1], fall: [5, 4, 3, 2, 1, 0, 2, -1] };
    function arps(t0, spec, bars, pat, vel) {
      var ch = c.chord(spec), low = c.bassNote(ch, 43, 54), pcs = [], set = [], i, k;
      for (i = 0; i < ch.tones.length; i++) pcs.push(pcOf(ch.tones[i]));
      for (k = low; k <= low + 26; k++) if (pcs.indexOf(pcOf(k)) >= 0) set.push(k);
      var seq = pats[pat] || pats.wave;
      for (var b = 0; b < bars; b++) {
        for (i = 0; i < 8; i++) {
          var idx = seq[i]; if (idx < 0 || idx >= set.length) continue;
          if (i > 0 && c.chance(0.12)) continue;
          var tt = t0 + (b * 8 + i) * e + (c.r() - 0.5) * 0.03;
          c.note('harp', tt, set[idx], vel * (i === 0 ? 1.15 : 0.85) + c.rnd(-0.05, 0.05), 1, harpIO);
        }
      }
    }
    function fireflies(t0, spec, bars, p) {
      var ch = c.chord(spec);
      for (var b = 0; b < bars; b++) {
        if (!c.chance(p)) continue;
        var tones = [ch.tones[0], ch.tones[1], ch.tones[2], c.pitch(12), c.pitch(15)];
        var m = c.pick(tones);
        while (m < 79) m += 12;
        while (m > 93) m -= 12;
        c.note('celesta', t0 + b * bar + c.rnd(0.3, 3.2) * c.b, m, c.rnd(0.22, 0.38), 1, celIO);
        if (c.chance(0.3)) c.note('celesta', t0 + b * bar + c.rnd(3.3, 3.9) * c.b, m + c.pick([-3, -5, 2]), 0.2, 1, celIO);
      }
    }
    function sec(chords, pat, ffP, withMotif) {
      for (var i = 0; i < chords.length; i++) {
        var len = 2 * bar;
        c.pad(t, len + 0.5, chords[i], padO);
        arps(t, chords[i], 2, pat, 0.36);
        if (i === 0 && withMotif) c.mel(t + c.b, c.pick(motif), { inst: 'celesta', vel: 0.42, io: celIO, rub: 0.6, orn: 0 });
        else fireflies(t, chords[i], 2, ffP);
        t += len;
      }
    }
    c.pad(t, 2 * bar + 0.5, '0:9', padO);
    arps(t + bar, '0:9', 1, 'rise', 0.3);
    t += 2 * bar;
    sec(A, 'wave', 0.4, true);
    sec(B, c.pick(['wave', 'fall']), 0.45, true);
    if (c.chance(0.5)) sec(A, c.pick(['rise', 'wave']), 0.5, false);
    c.pad(t, 2 * bar + 0.5, '3/0', padO);
    arps(t, '3/0', 2, 'wave', 0.32);
    t += 2 * bar;
    c.pad(t, 2 * bar, '0:s2', { lo: 50, hi: 69, vel: 0.36, io: { att: 3, rel: 6.5, cut: 760, gain: 0.6, n: 3, air: true } });
    arps(t, '0:s2', 1, 'rise', 0.3);
    c.mel(t + bar, c.pick(motif), { inst: 'celesta', vel: 0.36, io: celIO, rub: 1, orn: 0 });
    return c.done(t + 2 * bar + 7.5);
  }

  /* lake_night - F Lydian, rocking 6/8. Music-box melody over a soft pad,
     a quiet harp rocking between root and fifth like a boat on still water. */
  function trLake(seed) {
    var c = new Comp(seed, 135, 65, 'lydian');
    c.tempo(c.rnd(42, 48) * 3);           /* one beat = one eighth note */
    c.rub = 0.6; c.orn = 0.05;
    var bar = 6 * c.b, t = 0.3;
    var boxIO = { box: true, gain: 0.85, wet: 0.45, ring: 0.85 };
    var padO = { lo: 53, hi: 70, vel: 0.36, io: { att: 3, rel: 5, cut: 900, gain: 0.6 } };
    var rockIO = { gain: 0.55, ring: 0.7, wet: 0.25 };
    var A = ['0:7', '1/0', '6:7', '2:7'], B = ['5:9', '1', '4:7', '0:9'];
    var LA = ['9:3 8:1 9:2 11:3 9:3', '10:3 9:1 8:2 5:6', '6:3 8:3 10:2 9:1 8:3', '12:3 11:1 9:2 8:6'];
    var LA2 = ['9:3 11:3 14:3 13:3', '12:3 10:3 8:6', '6:3 8:3 10:2 9:1 8:3', '12:2 11:1 9:3 8:6'];
    var LB = ['9:2 7:1 9:3 12:3 11:3', '10:3 12:3 11:2 10:1 8:3', '11:3 13:3 12:2 11:1 10:3', '8:3 7:1 6:2 7:6'];
    var mel = { inst: 'celesta', vel: 0.5, io: boxIO, rub: 0.6, orn: 0.05, leg: 1 };
    function rock(t0, spec, bars) {
      var ch = c.chord(spec), root = c.bassNote(ch, 41, 52), fifth = root + 7, i;
      for (i = 0; i < ch.tones.length; i++) if (pcOf(ch.tones[i]) === pcOf(root + 7)) fifth = root + 7;
      for (var b = 0; b < bars; b++) {
        var tb = t0 + b * bar;
        c.note('harp', tb + (c.r() - 0.5) * 0.03, root, 0.34 + c.rnd(-0.03, 0.03), 1, rockIO);
        c.note('harp', tb + 3 * c.b + (c.r() - 0.5) * 0.04, c.chance(0.25) ? root + 12 : fifth, 0.27 + c.rnd(-0.03, 0.03), 1, rockIO);
        if (c.chance(0.3)) c.note('harp', tb + 5 * c.b, root + 12 + (ch.tones.length > 1 ? (pcOf(ch.tones[1]) - pcOf(root) + 12) % 12 : 4), 0.2, 1, rockIO);
      }
    }
    function sec(chords, mels) {
      for (var i = 0; i < chords.length; i++) {
        var len = 2 * bar * (1 + c.rnd(0, 0.02));
        c.pad(t, len + 0.4, chords[i], padO);
        rock(t, chords[i], 2);
        if (mels[i]) c.mel(t, mels[i], mel);
        t += len;
      }
    }
    c.pad(t, 2 * bar + 0.4, '0:9', padO);
    rock(t, '0:9', 2);
    t += 2 * bar;
    sec(A, LA);
    sec(B, LB);
    var alt = [];
    for (var i = 0; i < 4; i++) alt.push(c.chance(0.5) ? LA2[i] : LA[i]);
    sec(A, alt);
    if (c.chance(0.4)) {
      mel = { inst: 'celesta', vel: 0.46, io: boxIO, rub: 0.7, orn: 0.08, leg: 1, thin: 0.25 };
      sec(B, LB);
    }
    c.pad(t, 2 * bar + 0.4, '5:9', padO);
    rock(t, '5:9', 2);
    c.mel(t, '9:3 7:3 5:6', mel);
    t += 2 * bar * 1.05;
    c.pad(t, 3 * bar, '0:9', { lo: 53, hi: 72, vel: 0.34, io: { att: 3.5, rel: 6.5, cut: 800, gain: 0.6 } });
    c.note('harp', t, c.bassNote('0', 41, 52), 0.3, 1, rockIO);
    c.mel(t + c.b, c.pick(['7:6 r:6', '11:3 9:3 7:6']), { inst: 'celesta', vel: 0.38, io: boxIO, rub: 1.2, orn: 0 });
    c.note('celesta', t + 2 * bar, c.pitch(14), 0.22, 1, boxIO);
    return c.done(t + 3 * bar + 7.5);
  }

  /* depths - D Phrygian, dark ambient phrases over the drone bed.
     Deeper floors: lower register, slower, more minor-second / tritone colour, ominous low swells. */
  function trDepths(seed, o) {
    var depth = clamp(o && o.depth, 1, 80), k = clamp((depth - 1) / 59, 0, 1);
    var c = new Comp(seed, 48, 50, 'phrygian');
    var slow = 1 + 0.5 * k;
    c.tempo(c.rnd(44, 52) / slow);
    c.rub = 1.2; c.orn = 0;
    var reg = k >= 0.45 ? -7 : 0, t = 0.5, b = c.b;
    var pIO = { bright: 0.75 - 0.25 * k, gain: 0.95 };
    var choIO = { vowel: 'o', att: 4.5, rel: 6, dry: 0.25, wet: 1.0, cut: 2200, gain: 0.9 };
    var tense = function () { return c.chance(0.15 + 0.5 * k); };
    function pn(deg, acc, vel, dur, at) { c.note('piano', at, c.pitch(deg + reg, acc), vel, dur, pIO); }
    /* distant choir */
    var lowD = c.pitch(0 + reg) - 12;
    c.note('choir', t, c.pitch(0), 0.36, 12 * slow, choIO);
    c.note('choir', t + 0.8, tense() ? c.pitch(1) : c.pitch(4), 0.3, 11 * slow, choIO);
    pn(-7, 0, 0.34, 6, t + 2.5 * slow);
    t += 6 * slow;
    /* the motif: D, B-flat, A (deeper: A-flat, the tritone) */
    t = c.mel(t, '7:2 5:2 ' + (tense() ? '4b' : '4') + ':4', { vel: 0.33, shift: reg, pedal: 1.5, io: pIO, rub: 1.4 });
    t += c.rnd(4, 8) * slow;
    if (c.chance(0.75)) {
      t = c.mel(t, c.pick(['2:2 1:2 0:6', '3:2 2:2 1:6', '2:3 0:5']), { vel: 0.28, shift: reg, pedal: 2, io: pIO, rub: 1.4 });
      if (tense()) pn(1, 0, 0.18, 4, t - 2 * b);
      t += c.rnd(3, 6) * slow;
    }
    if (c.chance(0.3 + 0.5 * k)) {
      /* ominous low swell: a slowly opening minor-second cluster */
      var sw = { att: 4, rel: 4.5, gain: 0.55 + 0.25 * k, bright: 0.7 };
      c.note('cello', t, lowD + 12, 0.4, 7 * slow, sw);
      c.note('cello', t + 0.6, lowD + 13, 0.3, 6.5 * slow, sw);
      if (k > 0.4) c.note('cello', t + 1.2, lowD + 18, 0.25, 6 * slow, sw);
      t += 6 * slow;
    }
    c.note('choir', t, c.pitch(2 + reg), 0.3, 10 * slow, choIO);
    c.note('choir', t + 0.7, tense() ? c.pitch(5 + reg, 1) : c.pitch(6 + reg), 0.26, 9 * slow, choIO);
    t += 3 * slow;
    t = c.mel(t, c.pick(['9:1.5 7:1.5 5:5', '7:1.5 5:1.5 ' + (tense() ? '4b' : '4') + ':5', '5:2 4:2 1:5']), { vel: 0.3, shift: reg, pedal: 1.5, io: pIO, rub: 1.5 });
    t += c.rnd(2, 4) * slow;
    pn(-7, 0, 0.3, 7, t);
    if (k < 0.5 && c.chance(0.5)) c.note('piano', t + 3 * slow, c.pitch(14), 0.14, 4, { bright: 0.8, gain: 0.8 });
    return c.done(t + 9);
  }

  var TRACKS = { title: trTitle, sanctum: trSanctum, village_night: trVillage, woods_night: trWoods, lake_night: trLake, depths: trDepths };

  /* tavern - G major folk waltz (3/4) for the Gilded Owl. Lute oom-pah-pah, felt-piano tune,
     a soft string pad in the second strain; the tune moves to the lute on the repeat. */
  function trTavern(seed) {
    var c = new Comp(seed, 88, 67, 'ionian');
    c.tempo(c.rnd(84, 94));
    c.rub = 0.45; c.orn = 0.08;
    var bar = 3 * c.b, t = 0.3;
    var luteIO = { gain: 0.9, wet: 0.2, ring: 0.75 }, pIO = { gain: 0.85, bright: 0.9 };
    var A = ['0', '3', '0', '4', '5', '3', '4:7', '0'];
    var mA = ['4:2 2:1', '0:2 1:1', '2:1 3:1 4:1', '1:3', '4:2 2:1', '3:2 5:1', '4:1 3:1 1:1', '0:3'];
    var B = ['3', '0', '1', '4', '3', '0', '4:7', '0'];
    var mB = ['5:2 4:1', '2:2 4:1', '1:1 2:1 3:1', '4:3', '5:2 3:1', '4:2 2:1', '1:1 2:1 1:1', '0:3'];
    function oompah(t0, spec, v) {
      var ch = c.chord(spec), bass = c.bassNote(ch, 43, 55), up = c.voicing(ch, 55, 67, 'lute');
      var top = up.slice(Math.max(0, up.length - 2));
      c.note('lute', t0 + (c.r() - 0.5) * 0.02, bass, v + c.rnd(-0.03, 0.03), 1, luteIO);
      for (var k = 1; k < 3; k++) {
        if (k === 2 && c.chance(0.15)) continue;
        for (var j = 0; j < top.length; j++) c.note('lute', t0 + k * c.b + j * 0.012 + (c.r() - 0.5) * 0.02, top[j], v * 0.62 + c.rnd(-0.03, 0.03), 1, luteIO);
      }
    }
    function strum(t0, spec, v) {
      var ch = c.chord(spec), notes = [c.bassNote(ch, 43, 55)].concat(c.voicing(ch, 55, 71, 'strum'));
      for (var k = 0; k < notes.length; k++) c.note('lute', t0 + k * 0.035, notes[k], v - k * 0.02, 1, { gain: 0.9, wet: 0.25, ring: 1.4 });
    }
    function strain(chords, mels, melInst, melOpts, pad) {
      for (var i = 0; i < chords.length; i++) {
        oompah(t, chords[i], 0.34);
        if (pad) c.pad(t, bar + 0.3, chords[i], { lo: 55, hi: 70, vel: 0.3, top: 3, io: { att: 1.2, rel: 2.5, cut: 900, gain: 0.45 } });
        if (mels[i]) c.mel(t, mels[i], melOpts);
        if (melInst === 'both' && mels[i]) c.mel(t + 0.01, mels[i], { inst: 'harp', oct: 12, vel: 0.26, rub: 0.3, orn: 0, io: { gain: 0.6, wet: 0.3 } });
        t += bar * (1 + c.rnd(0, 0.02));
      }
    }
    oompah(t, '0', 0.3); t += bar;
    oompah(t, '0', 0.32); t += bar;
    var pm = { vel: 0.42, pedal: 0.25, io: pIO, leg: 0.9 };
    strain(A, mA, 'piano', pm, false);
    strain(B, mB, 'piano', pm, true);
    if (c.chance(0.4)) strain(B, mB, 'both', { vel: 0.36, pedal: 0.2, io: pIO, leg: 0.9, thin: 0.2 }, true);
    strain(A, mA, 'lute', { inst: 'lute', vel: 0.42, rub: 0.4, orn: 0.06, io: luteIO }, false);
    strum(t, '0', 0.4);
    c.note('piano', t + 0.05, 43, 0.3, 3, pIO);
    c.note('piano', t + 0.08, 67, 0.3, 3, pIO);
    return c.done(t + bar * 2 + 5);
  }

  /* cathedral - E-flat major with a Lydian glint. Organ swells (flue pipes + voix celeste),
     distant choir, celesta "light through stained glass"; plagal (Amen) close. */
  function trCathedral(seed) {
    var c = new Comp(seed, 55, 63, 'ionian');
    c.tempo(c.rnd(52, 58));
    c.rub = 0.6; c.orn = 0;
    var bar = 4 * c.b, t = 0.3;
    var org = { inst: 'organ', lo: 51, hi: 70, vel: 0.45, io: { att: 2.2, rel: 3.5, gain: 1.0 } };
    var pedalIO = { att: 2.6, rel: 3.5, gain: 0.75, bright: 0.8 };
    var choO = { vowel: 'a', vel: 0.36, lo: 63, hi: 79, top: 2, p: 0.85, io: { vowel: 'a', att: 3.5, rel: 4.5, dry: 0.25, wet: 1.0 } };
    var celIO = { gain: 0.75, wet: 0.6 };
    var P1 = ['0:9', '3/0', '5:7', '3:7'], P2 = ['1:7', '4:s4', '4', '0:9'];
    var motifs = ['r:1 7:1 8:1 11:1 9:4', 'r:1 12:1 11:1 9:1 8:4', 'r:2 9:1 11:1 14:4'];
    function motes(t0, spec, bars) {
      var ch = c.chord(spec);
      for (var b2 = 0; b2 < bars; b2++) {
        if (!c.chance(0.55)) continue;
        var n = c.chance(0.4) ? 2 : 1, base = t0 + b2 * bar + c.rnd(0.5, 2.5) * c.b;
        for (var k = 0; k < n; k++) {
          var m = c.pick(ch.tones.concat([c.pitch(3, 1)]));
          while (m < 84) m += 12;
          while (m > 96) m -= 12;
          c.note('celesta', base + k * c.rnd(0.18, 0.35), m, c.rnd(0.2, 0.32), 1, celIO);
        }
      }
    }
    function phrase(chords, withChoir, motif) {
      for (var i = 0; i < chords.length; i++) {
        var len = 2 * bar * (1 + c.rnd(0, 0.02));
        c.pad(t, len + 0.6, chords[i], org);
        c.note('organ', t, c.bassNote(chords[i], 39, 51), 0.4, len + 0.4, pedalIO);
        if (withChoir) c.section(t, [chords[i]], null, { bpb: 4, bpc: 2, choir: choO });
        if (i === 0 && motif) c.mel(t, motif, { inst: 'celesta', oct: 12, vel: 0.36, io: celIO, rub: 0.8, orn: 0 });
        else motes(t, chords[i], 2);
        t += len;
      }
    }
    c.pad(t, 2 * bar + 0.6, '0:9', org);
    c.note('organ', t, 39, 0.35, 2 * bar, pedalIO);
    t += 2 * bar;
    phrase(P1, false, motifs[0]);
    phrase(P2, true, c.pick(motifs.slice(1)));
    if (c.chance(0.4)) phrase(P1, true, null);
    c.pad(t, 2 * bar + 0.6, '3:7', org);
    c.note('organ', t, c.bassNote('3', 39, 51), 0.4, 2 * bar, pedalIO);
    c.section(t, ['3:7'], null, { bpb: 4, bpc: 2, choir: choO });
    t += 2 * bar * 1.04;
    c.pad(t, 3 * bar, '0:9', { inst: 'organ', lo: 51, hi: 72, vel: 0.42, io: { att: 2.5, rel: 6, gain: 1.0 } });
    c.note('organ', t, 39, 0.38, 3 * bar, { att: 2.6, rel: 6, gain: 0.75, bright: 0.8 });
    c.pad(t, 3 * bar, '0:5', { inst: 'choir', lo: 63, hi: 79, top: 2, key: 'choir', vel: 0.32, io: { vowel: 'o', att: 4, rel: 6, dry: 0.25, wet: 1.0 } });
    c.mel(t + c.b, c.pick(['r:2 11:2 10#:4', 'r:2 9:2 7:4']), { inst: 'celesta', oct: 12, vel: 0.3, io: celIO, rub: 1, orn: 0 });
    return c.done(t + 3 * bar + 8);
  }

  /* boutique - a very rare, tiny music-box waltz in C that winds down at the end. */
  function trBoutique(seed) {
    var c = new Comp(seed, 100, 72, 'ionian');
    c.tempo(c.rnd(92, 104));
    c.rub = 0.3; c.orn = 0;
    var t = 0.3, io = { box: true, gain: 0.7, wet: 0.5, ring: 0.9 };
    var mel = ['4:1 2:1 4:1', '7:2 4:1', '3:1 5:1 3:1', '1:3', '2:1 4:1 2:1', '6:2 4:1', '5:1 3:1 1:1', '0:3'];
    var chords = ['0', '0', '3', '4', '0', '5', '4', '0'];
    var passes = c.chance(0.35) ? 2 : 1;
    for (var p = 0; p < passes; p++) {
      for (var i = 0; i < 8; i++) {
        var last = p === passes - 1, slow = last && i >= 5 ? 1 + (i - 4) * 0.14 : 1;
        var b = c.b * slow;
        c.note('celesta', t, c.bassNote(chords[i], 60, 67), 0.3, 1, io);
        if (c.chance(0.5)) c.note('celesta', t + 2 * b, c.voicing(chords[i], 64, 71, 'box')[0], 0.22, 1, io);
        c.mel(t, mel[i], { inst: 'celesta', oct: p === 1 ? 12 : 0, vel: 0.36, io: io, stretch: slow, rub: 0.3, thin: p === 1 ? 0.25 : 0 });
        t += 3 * b;
      }
    }
    return c.done(t + 4);
  }

  /* deepwood - E Phrygian. Eerie bowed-glass phrases over a dark low swell; deeper in the
     woods (opts.depth 0..1): lower, slower, more minor seconds/tritones and a low choir. */
  function trDeepwood(seed, o) {
    var d = clamp(o && o.depth, 0, 1);
    var c = new Comp(seed, 50, 64, 'phrygian');
    var slow = 1 + 0.4 * d;
    c.tempo(c.rnd(46, 54) / slow);
    c.rub = 1.2; c.orn = 0;
    var t = 0.5, reg = d > 0.55 ? -7 : 0;
    var gIO = { att: 0.6, rel: 2.2, gain: 0.8, wet: 0.9, dry: 0.5 };
    var tense = function () { return c.chance(0.2 + 0.5 * d); };
    var dark = { att: 4, rel: 5, cut: 420, gain: 0.6, n: 3, det: 0.6 };
    c.note('strings', t, 40, 0.35, 14 * slow, dark);
    c.note('strings', t + 0.8, tense() ? 41 : 47, 0.3, 13 * slow, dark);
    t += 3 * slow;
    t = c.mel(t, c.pick(['7:3 8:3 7:6', '4:3 5:3 4:6']), { inst: 'glass', shift: reg, vel: 0.36, leg: 1, io: gIO, rub: 1.3 });
    t += c.rnd(3, 6) * slow;
    if (d > 0.5 || c.chance(0.4)) {
      c.note('choir', t, 52 + (reg ? -12 : 0), 0.3, 9 * slow, { vowel: 'o', att: 4, rel: 5, dry: 0.25, wet: 1.0, cut: 1800 });
      c.note('choir', t + 0.7, 53 + (reg ? -12 : 0), 0.26, 8 * slow, { vowel: 'o', att: 4, rel: 5, dry: 0.25, wet: 1.0, cut: 1800 });
    }
    t = c.mel(t, c.pick(['4:3 5:3 r:2 1:6', '8:3 7:3 ' + (tense() ? '4b' : '4') + ':6', '5:2 4:2 1:6']), { inst: 'glass', shift: reg, vel: 0.33, leg: 1, io: gIO, rub: 1.4 });
    t += c.rnd(2, 5) * slow;
    if (tense()) {
      c.note('strings', t, 40, 0.3, 8 * slow, dark);
      c.note('strings', t + 0.5, 41, 0.26, 7.5 * slow, dark);
      t = c.mel(t + 1, '7:4 ' + (tense() ? '4b' : '5') + ':6', { inst: 'glass', shift: reg, vel: 0.3, leg: 1, io: gIO, rub: 1.5 });
    }
    c.note('glass', t + 1, c.pitch(reg ? -7 : 0), 0.26, 4 * slow, { att: 1.5, rel: 3, gain: 0.7, wet: 1.0, dry: 0.4 });
    return c.done(t + 1 + 4 * slow + 7);
  }

  /* glade - F major lullaby (3/4) with a Lydian B-natural glint: music box over rocking harp.
     Night: slower, sparser, a faint pad. */
  function trGlade(seed, o) {
    var night = !!(o && o.night);
    var c = new Comp(seed, 66, 65, 'ionian');
    c.tempo(night ? c.rnd(58, 63) : c.rnd(63, 69));
    c.rub = 0.7; c.orn = 0.05;
    var bar = 3 * c.b, t = 0.3;
    var boxIO = { box: true, gain: night ? 0.6 : 0.75, wet: 0.5, ring: 0.9 };
    var harpIO = { gain: 0.5, ring: 0.65, wet: 0.3 };
    var A = ['0', '0', '4', '0', '3', '0/2', '4', '0'];
    var mA = ['2:2 4:1', '7:3', '6:1 5:1 4:1', '2:3', '1:2 2:1', '4:2 5:1', '4:1 2:1 1:1', '0:3'];
    var B = ['3', '4', '2', '5', '3', '1:M', '4', '0'];
    var mB = ['7:2 9:1', '8:2 7:1', '6:2 4:1', '5:3', '4:1 5:1 7:1', '6:2 3#:1', '4:3', '2:1 1:1 0:1'];
    function rock(t0, spec) {
      var ch = c.chord(spec), root = c.bassNote(ch, 41, 52), up = c.voicing(ch, 55, 67, 'harp');
      c.note('harp', t0 + (c.r() - 0.5) * 0.02, root, 0.3, 1, harpIO);
      c.note('harp', t0 + c.b, up[0], 0.24, 1, harpIO);
      if (!night || c.chance(0.6)) c.note('harp', t0 + 2 * c.b, up[Math.min(1, up.length - 1)], 0.22, 1, harpIO);
    }
    function strain(chords, mels, mo, pad) {
      for (var i = 0; i < chords.length; i++) {
        rock(t, chords[i]);
        if (pad) c.pad(t, bar + 0.4, chords[i], { lo: 55, hi: 70, vel: 0.28, top: 3, io: { att: 1.5, rel: 3, cut: 750, gain: 0.4, air: true, n: 3 } });
        if (mels[i]) c.mel(t, mels[i], mo);
        t += bar * (1 + c.rnd(0, 0.02));
      }
    }
    rock(t, '0'); t += bar;
    var mo = { inst: 'celesta', vel: 0.42, io: boxIO, leg: 1, thin: night ? 0.3 : 0 };
    strain(A, mA, mo, night);
    strain(B, mB, mo, true);
    strain(A, mA, { inst: 'celesta', vel: 0.38, io: boxIO, leg: 1, thin: night ? 0.35 : 0.15 }, night);
    rock(t, '0:9');
    c.pad(t, 2 * bar, '0:9', { lo: 55, hi: 72, vel: 0.26, top: 3, io: { att: 1.5, rel: 4, cut: 700, gain: 0.4 } });
    c.mel(t + c.b, c.pick(['7:6', '9:3 7:3']), { inst: 'celesta', vel: 0.32, io: boxIO, rub: 1.2, orn: 0 });
    return c.done(t + 2 * bar + 6);
  }

  TRACKS.tavern = trTavern;
  TRACKS.cathedral = trCathedral;
  TRACKS.boutique = trBoutique;
  TRACKS.deepwood = trDeepwood;
  TRACKS.glade = trGlade;

  /* Soft frame drum from filtered noise: midi < 60 = low "doum" (with skin resonance), else a light "tek". */
  function drum(T, m, vel, dur, o, dst) {
    o = o || {}; dst = dst || dMusic();
    vel = clamp(vel, 0.05, 1);
    var low = m < 60, v = mkVoice(dst, T, F(o.wet, 0.15));
    var s = NSRC(BUF.pink, false), bp = v.n(BQ('bandpass', low ? 150 : 700, low ? 1.6 : 1.2)), lp = v.n(BQ('lowpass', low ? 900 : 2200, -2)), g = v.n(G(0));
    var pan = v.n(PAN(F(o.pan, low ? -0.1 : 0.15)));
    chain(s, bp, lp, g, pan, v.out);
    var gain = (low ? 0.5 : 0.22) * F(o.gain, 1) * (0.4 + 0.6 * vel), d = low ? 0.16 : 0.07;
    sv(g.gain, 0, T); lr(g.gain, gain, T + 0.005); er(g.gain, 0.0001, T + 0.005 + d * 3);
    v.src(s, T, T + d * 3 + 0.05, rr(0, 3));
    if (low) {
      var o2 = O('sine', 95), g2 = v.n(G(0));
      chain(o2, g2, pan);
      sv(o2.frequency, rr(92, 100), T); er(o2.frequency, 72, T + 0.15);
      sv(g2.gain, 0, T); lr(g2.gain, gain * 0.5, T + 0.006); er(g2.gain, 0.0001, T + 0.4);
      v.src(o2, T, T + 0.42);
    }
    v.relAt = T + 0.05;
    return finishVoice(v, dst);
  }
  INST.drum = drum;
  FORMANTS.m = [[270, 3.5, 1], [2100, 10, 0.04], [2900, 12, 0.02]];   /* closed-mouth hum */

  /* home - F major, a short tender felt-piano piece for the cottage (warmer cousin of village_night). */
  function trHome(seed) {
    var c = new Comp(seed, 58, 53, 'ionian');
    c.tempo(c.rnd(54, 60));
    c.rub = 1.3; c.orn = 0.1;
    var bar = 4 * c.b, t = 0.4, i;
    var pIO = { gain: 0.95, bright: 0.92 };
    var H1 = ['0:7', '3:9', '5:7', '4:s4'], H2 = ['3:7', '2:7', '1:7', '4'];
    var M1 = ['r:1 9:1 11:1 14:1 13:3 r:1', 'r:1 12:1 11:1 10:1 8:4', 'r:1 9:1 12:2 11:2 9:2', '10:2 9:2 8:4'];
    var M2 = ['r:1 9:1 10:1 12:1 14:4', '12:2 11:2 9:4', 'r:1 10:1 9:1 8:1 7:2 8:2', '9:2 8:2 r:4'];
    var mel = { vel: 0.44, pedal: 1.0, io: pIO, orn: 0.1 };
    var lho = { vel: 0.3, lo: 34, hi: 48, io: pIO };
    c.lh(t, 1, '0', 'fifth', lho);
    c.note('piano', t + 2 * c.b, c.pitch(16), 0.2, 3, pIO);
    t += bar;
    for (i = 0; i < 4; i++) t = c.section(t, [H1[i]], [M1[i]], { lh: c.pick(['sparse', 'hold', 'fifth']), lho: lho, mel: mel });
    if (c.chance(0.45)) {
      for (i = 0; i < 4; i++) t = c.section(t, [H2[i]], [M2[i]], { lh: c.pick(['sparse', 'hold']), lho: lho, mel: mel, cello: { vel: 0.3, gain: 0.5, p: 0.4, lo: 36, hi: 48 } });
    }
    c.lh(t, 3, '0:9', 'fifth', { vel: 0.27, lo: 34, hi: 46, io: pIO });
    c.mel(t, c.pick(['7:8', '9:2 11:2 r:1 9:3']), { vel: 0.4, pedal: 2, rub: 1.6, orn: 0, io: pIO });
    return c.done(t + 3 * bar + 6);
  }

  /* festival - the Lantern Moon: a gentle D-major jig in 6/8. Lute oom-pah, soft frame drum,
     the tune on harp then lute, a hummed choir line and celesta sparkles in the later strains. */
  function trFestival(seed) {
    var c = new Comp(seed, 200, 62, 'ionian');
    c.tempo(c.rnd(192, 210));
    c.rub = 0.25; c.orn = 0.06;
    var bar = 6 * c.b, t = 0.3, k;
    var luteIO = { gain: 0.85, wet: 0.2, ring: 0.6 }, harpIO = { gain: 0.75, wet: 0.25, ring: 0.7 }, celIO = { gain: 0.6, wet: 0.5 };
    var humIO = { vowel: 'm', att: 0.6, rel: 1.6, dry: 0.5, wet: 0.7, cut: 1000, gain: 1.1 };
    var A = ['0', '3', '0', '4', '0', '3', '4', '0'];
    var mA = ['7:2 4:1 2:2 4:1', '5:2 7:1 8:3', '9:2 8:1 7:2 4:1', '8:3 6:3', '7:2 4:1 2:2 4:1', '5:2 7:1 10:3', '9:2 8:1 6:2 8:1', '7:6'];
    var B = ['5', '3', '0', '4', '5', '3', '1', '4'];
    var mB = ['9:3 7:3', '8:2 7:1 5:3', '4:2 5:1 7:3', '8:6', '9:2 10:1 9:3', '8:2 7:1 5:3', '4:2 5:1 8:3', '6:3 8:3'];
    function drums(t0, full) {
      c.note('drum', t0, 40, 0.5 + c.rnd(-0.05, 0.05), 1);
      c.note('drum', t0 + 3 * c.b, 40, 0.36 + c.rnd(-0.05, 0.05), 1);
      if (!full) return;
      if (c.chance(0.8)) c.note('drum', t0 + 2 * c.b, 72, 0.3, 1);
      if (c.chance(0.8)) c.note('drum', t0 + 5 * c.b, 72, 0.28, 1);
      if (c.chance(0.2)) c.note('drum', t0 + 4 * c.b, 72, 0.18, 1);
    }
    function comp(t0, spec) {
      var ch = c.chord(spec), bass = c.bassNote(ch, 43, 55), up = c.voicing(ch, 57, 69, 'lute').slice(-2), j;
      c.note('lute', t0, bass, 0.34, 1, luteIO);
      for (j = 0; j < up.length; j++) c.note('lute', t0 + 2 * c.b + j * 0.012, up[j], 0.22, 1, luteIO);
      c.note('lute', t0 + 3 * c.b, c.chance(0.5) ? bass + 7 : bass, 0.28, 1, luteIO);
      for (j = 0; j < up.length; j++) c.note('lute', t0 + 5 * c.b + j * 0.012, up[j], 0.2, 1, luteIO);
    }
    function strain(chords, mels, mo, opts) {
      for (var i = 0; i < chords.length; i++) {
        comp(t, chords[i]);
        drums(t, opts.full);
        if (mels[i]) c.mel(t, mels[i], mo);
        if (opts.hum && i % 2 === 0) {
          var hv = c.voicing(chords[i], 57, 69, 'hum');
          c.note('choir', t + 0.05, hv[hv.length - 1], 0.32, 2 * bar - 0.2, humIO);
        }
        if (opts.sparkle && c.chance(0.45)) {
          var m = c.pick(c.chord(chords[i]).tones);
          while (m < 86) m += 12;
          c.note('celesta', t + c.pick([1, 2, 4]) * c.b, m, 0.26, 1, celIO);
        }
        t += bar * (1 + c.rnd(0, 0.01));
      }
    }
    for (k = 0; k < 2; k++) { comp(t, '0'); drums(t, k === 1); t += bar; }
    strain(A, mA, { inst: 'harp', vel: 0.42, io: harpIO, rub: 0.25 }, { full: true });
    strain(B, mB, { inst: 'lute', vel: 0.4, io: luteIO, rub: 0.25 }, { full: true, hum: true });
    strain(A, mA, { inst: 'harp', vel: 0.42, io: harpIO, rub: 0.25, dbl: 0.2 }, { full: true, hum: true, sparkle: true });
    if (c.chance(0.5)) {
      strain(B, mB, { inst: 'harp', vel: 0.38, io: harpIO }, { full: true, hum: true, sparkle: true });
      strain(A, mA, { inst: 'lute', vel: 0.4, io: luteIO }, { full: true, sparkle: true });
    }
    var endCh = c.chord('0'), en = [c.bassNote(endCh, 43, 55)].concat(c.voicing(endCh, 57, 74, 'end'));
    for (k = 0; k < 4; k++) c.note('drum', t - 0.6 + k * 0.15, 72, 0.15 + k * 0.04, 1);
    for (k = 0; k < en.length; k++) c.note('lute', t + k * 0.04, en[k], 0.38, 1, { gain: 0.85, ring: 1.5, wet: 0.3 });
    c.note('drum', t, 40, 0.5, 1);
    c.note('celesta', t + 0.1, 86, 0.3, 1, celIO);
    c.note('choir', t, 66, 0.3, 3, humIO);
    return c.done(t + 5);
  }
  TRACKS.home = trHome;
  TRACKS.festival = trFestival;

  /* ------------------------------------------------------------------ */
  /*  Music director: where and when music plays. Silence is the default */
  /* ------------------------------------------------------------------ */
  var ZONES = { title: 1, sanctum: 1, village: 1, woods: 1, lake: 1, ridge: 1, depths: 1, interior: 1, none: 1,
    tavern: 1, cathedral: 1, boutique: 1, deepwood: 1, glade: 1, festival: 1, home: 1 };
  var OUTDOOR = { sanctum: 1, village: 1, woods: 1, lake: 1, ridge: 1, deepwood: 1, glade: 1, festival: 1 };
  var COSY = { home: 1, tavern: 1, boutique: 1 };
  var dir = {
    zone: 'none', opts: { night: false, hour: 12, depth: 1, weather: 'clear' },
    plan: null, phase: 'idle', nextAt: 0, perf: null, bed: null, fadeKill: 0,
    seed: ((new Date().getTime()) & 0x7fffffff) ^ 0x2545F491, count: 0
  };
  function normOpts(o) {
    o = (o && typeof o === 'object') ? o : {};
    var hour = isNum(o.hour) ? clamp(o.hour, 0, 30) : 12;
    var night = (typeof o.night === 'boolean') ? o.night : (hour >= 19 || hour < 6);
    var w = o.weather;
    if (w !== 'rain' && w !== 'mist' && w !== 'starfall') w = 'clear';
    /* depth: dungeon floor in 'depths' (1..), how deep into the woods in 'deepwood' (0..1) */
    return { night: night, hour: hour, depth: isNum(o.depth) ? clamp(o.depth, 0, 999) : 0, weather: w };
  }
  function planFor(zone, o) {
    switch (zone) {
      case 'title': return { name: 'title', first: [1.2, 2.2], rest: [10, 15] };
      case 'sanctum': return { name: 'sanctum', first: [5, 20], rest: [60, 180] };
      case 'village': return (o.hour >= 18 || o.night) ? { name: 'village_night', first: [12, 40], rest: [90, 200] } : null;
      case 'woods': return o.night ? { name: 'woods_night', first: [10, 35], rest: [90, 200] } : null;
      case 'lake': return o.night ? { name: 'lake_night', first: [10, 35], rest: [90, 200] } : null;
      case 'depths': return { name: 'depths', first: [8, 20], rest: [40, 110] };
      case 'tavern': return { name: 'tavern', first: [15, 45], rest: [100, 220] };
      case 'cathedral': return { name: 'cathedral', first: [6, 15], rest: [35, 80] };
      case 'boutique': return { name: 'boutique', first: [60, 150], rest: [300, 600] };
      case 'deepwood': return { name: 'deepwood', first: [15, 45], rest: [70, 170] };
      case 'glade': return { name: 'glade', first: [8, 20], rest: [40, 90] };
      case 'festival': return { name: 'festival', first: [3, 8], rest: [18, 40] };
      case 'home': return { name: 'home', first: [20, 60], rest: [150, 300] };
    }
    return null;
  }
  /* per-track loudness trim (measured offline so every track peaks near -18 dBFS at default volume) */
  var TRIM = { title: 0.7, sanctum: 1.3, village_night: 1.1, woods_night: 1.3, lake_night: 1.25, depths: 1.25,
    tavern: 0.8, cathedral: 1.3, boutique: 0.95, deepwood: 1.7, glade: 1.4, festival: 0.85, home: 0.85 };
  function zoneTrim() { return (dir.plan && TRIM[dir.plan.name]) || 1; }
  function musicLevel() {
    return (paused ? 0.63 : 1) * ((dir.opts.weather === 'rain' && OUTDOOR[dir.zone]) ? 0.8 : 1);
  }
  var lastLv = { m: -1, a: -1 };
  function updateLevels() {
    if (!M) return;
    var t = now(), ml = musicLevel(), al = paused ? 0.63 : 1;
    if (ml !== lastLv.m) { glide(M.level.gain, ml, 0.25, t); lastLv.m = ml; }
    if (al !== lastLv.a) { glide(A.level.gain, al, 0.25, t); glide(A.wlevel.gain, al, 0.25, t); lastLv.a = al; }
  }
  /* Stop scheduling, fade the music bus (pre-reverb, so tails ring out naturally). */
  function fadeOutMusic(sec) {
    var t = now();
    if (!dir.perf && countAlive(musicVoices) === 0 && !dir.fadeKill) return t;
    dir.perf = null;
    hold(M.fadeA.gain, t); st(M.fadeA.gain, 0, t, sec / 4.5);
    hold(M.fadeB.gain, t); st(M.fadeB.gain, 0, t, sec / 4.5);
    dir.fadeKill = Math.max(dir.fadeKill, t + sec);
    return dir.fadeKill;
  }
  function finishFade(t) {
    dir.fadeKill = 0;
    for (var i = 0; i < musicVoices.length; i++) musicVoices[i].kill(t, 0.08);
    musicVoices.length = 0;
    /* killed voices are silent by now; bring the bus back gently (a drone bed may be sounding) */
    hold(M.fadeA.gain, t); st(M.fadeA.gain, zoneTrim(), t + 0.15, 0.4);
    hold(M.fadeB.gain, t); st(M.fadeB.gain, zoneTrim(), t + 0.15, 0.4);
  }
  function applyZone(prevZ, prevO, force) {
    var z = dir.zone, o = dir.opts, t = now();
    var plan = planFor(z, o);
    var oldName = dir.plan ? dir.plan.name : null, newName = plan ? plan.name : null;
    updateAmbience(force);
    updateLevels();
    if (z === 'depths') {
      if (!dir.bed) dir.bed = new DroneBed(o.depth);
      else if (!prevO || o.depth !== prevO.depth) dir.bed.update(o.depth);
    } else if (dir.bed) { dir.bed.stop(3.5); dir.bed = null; }
    if (amb.scene && amb.scene.setDepth && prevO && o.depth !== prevO.depth) amb.scene.setDepth(o.depth);
    if (force || z !== prevZ || newName !== oldName) {
      var fadeEnd = fadeOutMusic(3.5);
      dir.plan = plan;
      if (plan) {
        dir.phase = 'wait';
        dir.nextAt = Math.max(t + rr(plan.first[0], plan.first[1]), fadeEnd + 0.4);
      } else dir.phase = 'idle';
    } else dir.plan = plan;   /* same track: night/depth changes apply to the next performance */
  }
  function startPerf() {
    var plan = dir.plan, t = now();
    if (!plan || !TRACKS[plan.name]) { dir.phase = 'idle'; return; }
    dir.count++;
    var seed = (dir.seed + dir.count * 7919 + Math.floor(R() * 1e9)) >>> 0, comp = null;
    try { comp = TRACKS[plan.name](seed, dir.opts); } catch (e) { comp = null; }
    if (!comp || !comp.ev || !comp.ev.length) { dir.phase = 'rest'; dir.nextAt = t + 30; return; }
    hold(M.fadeA.gain, t); st(M.fadeA.gain, zoneTrim(), t, 0.1);
    hold(M.fadeB.gain, t); st(M.fadeB.gain, zoneTrim(), t, 0.1);
    dir.perf = { name: plan.name, ev: comp.ev, i: 0, t0: t + 0.12, dur: F(comp.dur, 60) };
    dir.phase = 'play';
  }
  function schedMusic(t, horizon) {
    var p = dir.perf, n = 0;
    if (!p) return;
    while (p.i < p.ev.length && n < 64) {
      var e = p.ev[p.i], T = p.t0 + e.t;
      if (T > horizon) break;
      if (T < t - 0.05) { p.t0 += t + 0.02 - T; T = p.t0 + e.t; }   /* re-anchor after a stall */
      try { e.f(T); } catch (err) {}
      p.i++; n++;
    }
  }
  function directorTick(t) {
    if (dir.fadeKill && t >= dir.fadeKill) finishFade(t);
    var plan = dir.plan;
    if (dir.phase === 'play') {
      if (!dir.perf) { dir.phase = plan ? 'rest' : 'idle'; dir.nextAt = t + (plan ? rr(plan.rest[0], plan.rest[1]) : 0); }
      else if (t >= dir.perf.t0 + dir.perf.dur) {
        dir.perf = null;
        if (plan) { dir.phase = 'rest'; dir.nextAt = t + rr(plan.rest[0], plan.rest[1]); } else dir.phase = 'idle';
      }
    } else if ((dir.phase === 'wait' || dir.phase === 'rest') && plan && !dir.fadeKill && t >= dir.nextAt) startPerf();
  }
  function debugPlayNow() {
    if (!ctx || !unlocked) return false;
    var plan = planFor(dir.zone, dir.opts);
    if (!plan) return false;
    dir.plan = plan;
    var t = now(), fe = fadeOutMusic(1.2);
    dir.phase = 'wait';
    dir.nextAt = fe > t ? fe + 0.3 : t;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  Scheduler (one lookahead interval for music + ambience events)     */
  /* ------------------------------------------------------------------ */
  var timer = null, lastSweep = 0;
  function tick() {
    try {
      if (!ctx || hidden || (ctx.state && ctx.state !== 'running')) return;
      var t = ctx.currentTime, h = t + LOOKAHEAD;
      directorTick(t);
      schedMusic(t, h);
      ambTick(t, h);
      if (t - lastSweep > 0.5) {
        lastSweep = t;
        sweepVoices();
        for (var i = jingleVoices.length - 1; i >= 0; i--) if (!jingleVoices[i].alive || jingleVoices[i].end < t) jingleVoices.splice(i, 1);
      }
    } catch (e) {}
  }
  function startTimer() { if (!timer && ctx && !hidden) { try { timer = setInterval(tick, TICK_MS); } catch (e) { timer = null; } } }
  function stopTimer() { if (timer) { try { clearInterval(timer); } catch (e) {} timer = null; } }
  function resumeCtx() {
    if (!ctx || !ctx.resume || ctx.state === 'running' || ctx.state === 'closed') return;
    try { var p = ctx.resume(); if (p && p.then) p.then(noop, noop); } catch (e) {}
  }
  function onVisibility() {
    var h = !!(DOC && DOC.hidden);
    if (h === hidden) return;
    hidden = h;
    if (!ctx || !unlocked) return;
    if (hidden) {
      stopTimer();
      glide(N.vis.gain, 0, 0.04, now());
      setTimeout(function () {
        if (hidden && ctx && ctx.suspend && ctx.state === 'running') {
          try { var p = ctx.suspend(); if (p && p.then) p.then(noop, noop); } catch (e) {}
        }
      }, 250);
    } else {
      resumeCtx();
      glide(N.vis.gain, 1, 0.15, now());
      startTimer();
    }
  }
  function onGesture() { if (!hidden && unlocked) resumeCtx(); }

  /* ------------------------------------------------------------------ */
  /*  Ambience: crossfaded scenes = looping filtered-noise layers +      */
  /*  sparse random events (crickets, birds, owl, drips, chimes...).     */
  /* ------------------------------------------------------------------ */
  var amb = { key: '', wkey: '', scene: null, weather: null, lastT: 0 };

  function Scene(key) {
    this.key = key; this.t0 = now();
    this.v = new Voice(null, this.t0);
    this.v.end = Infinity;
    this.v.out.gain.value = 0;
    this.v.out.connect(A.inp);
    this.bus = this.v.out;
    this.wet = this.v.n(G(1)); this.wet.connect(A.wet);
    this.events = []; this.crickets = []; this.updaters = []; this.periodic = []; this.stopping = false;
  }
  Scene.prototype.noise = function (buf, type, f, q, gain, pan) {
    var s = NSRC(BUF[buf] || BUF.white, true), fl = this.v.n(BQ(type, f, q)), g = this.v.n(G(gain));
    chain(s, fl, g);
    if (isNum(pan)) { var p = this.v.n(PAN(pan)); chain(g, p, this.bus); } else g.connect(this.bus);
    this.v.srcHold(s, this.t0, rr(0, 2));
    return { f: fl, g: g };
  };
  Scene.prototype.lfo = function (param, rate, depth) {
    var o = O('sine', rate), g = this.v.n(G(depth));
    chain(o, g, param);
    this.v.srcHold(o, this.t0);
  };
  Scene.prototype.every = function (min, max, fn) { this.updaters.push({ min: min, max: max, next: 0, fn: fn }); };
  Scene.prototype.fadeIn = function (sec) { st(this.bus.gain, 1, now(), sec / 4); };
  Scene.prototype.stop = function (sec) {
    var t = now();
    this.stopping = true;
    hold(this.bus.gain, t); st(this.bus.gain, 0, t, sec / 4.5);
    this.v.kill(t + sec, 0.05);
    this.v.end = Math.min(this.v.end, t + sec + 0.2);
  };
  /* one-shot event voice routed through the scene (so it crossfades with it) */
  function evVoice(sc, t, wet, pan) {
    var v = new Voice(null, t), p = v.n(PAN(F(pan, rr(-0.7, 0.7))));
    v.out.connect(p); p.connect(sc.bus);
    if (wet > 0) { var w = v.n(G(wet)); p.connect(w); w.connect(sc.wet); }
    return v;
  }

  /* ---- layers ---- */
  function lBreeze(sc, g) {
    var l = sc.noise('pink', 'lowpass', 520, 0.5, g);
    sc.lfo(l.f.frequency, 0.067, 220);
    sc.lfo(l.g.gain, 0.043, g * 0.4);
  }
  function lLeaves(sc, g) {
    var l = sc.noise('white', 'bandpass', 3300, 0.6, g * 0.5);
    sc.every(1.5, 4, function (t) { st(l.g.gain, g * rr(0.2, 1.1), t, rr(0.5, 1.2)); st(l.f.frequency, rr(2400, 4200), t, 1); });
  }
  function lWater(sc, g) {
    var a = sc.noise('brown', 'lowpass', 420, 0.7, g);
    sc.lfo(a.g.gain, 0.17, g * 0.6);
    var b = sc.noise('pink', 'bandpass', 1100, 1.2, g * 0.33);
    sc.lfo(b.g.gain, 0.23, g * 0.18);
    sc.lfo(b.f.frequency, 0.11, 250);
  }
  function lWind(sc) {
    var a = sc.noise('pink', 'bandpass', 600, 1.2, 0.5);
    var b = sc.noise('white', 'bandpass', 1400, 7, 0.08);
    sc.every(2.5, 6, function (t) {
      st(a.f.frequency, rr(280, 1100), t, rr(1.2, 2.5));
      st(a.g.gain, rr(0.22, 0.8), t, rr(0.8, 2));
      st(b.f.frequency, rr(900, 1900), t, 2);
      st(b.g.gain, rr(0.025, 0.14), t, 1.5);
    });
  }
  function lCave(sc) {
    var a = sc.noise('brown', 'lowpass', 160, 0.8, 0.13);
    sc.lfo(a.g.gain, 0.05, 0.045);
    sc.noise('pink', 'bandpass', 900, 0.8, 0.05);
  }
  function lAir(sc) {
    sc.noise('pink', 'bandpass', 700, 0.4, 0.12);
    var s = sc.noise('white', 'bandpass', 5200, 1, 0.02);
    sc.lfo(s.g.gain, 0.08, 0.012);
  }
  function lRoom(sc) { sc.noise('brown', 'lowpass', 220, 0.7, 0.055); }

  /* ---- events ---- */
  function makeCrickets(sc, n, level) {
    for (var i = 0; i < n; i++) {
      sc.crickets.push({ f: rr(4200, 4900), pan: rr(-0.8, 0.8), period: rr(0.7, 1.3), next: 0, pulses: ri(2, 4), gap: rr(0.035, 0.05), amp: 0.026 * level * rr(0.6, 1) });
    }
  }
  function chirp(sc, t, c) {
    var v = evVoice(sc, t, 0.15, c.pan), o = O('sine', c.f * rr(0.995, 1.005)), g = v.n(G(0));
    chain(o, g, v.out);
    sv(g.gain, 0, t);
    for (var p = 0; p < c.pulses; p++) {
      var tp = t + p * c.gap;
      lr(g.gain, 0, tp); lr(g.gain, c.amp, tp + 0.005); lr(g.gain, 0, tp + 0.022);
    }
    v.src(o, t, t + c.pulses * c.gap + 0.05);
  }
  function eBird(sc, t) {
    var v = evVoice(sc, t, 0.3), o = O('sine', 3000), g = v.n(G(0)), kind = ri(0, 2), amp = rr(0.03, 0.06) * (sc.birdK || 1), end = t;
    chain(o, g, v.out);
    sv(g.gain, 0, t);
    if (kind === 0) {                       /* two-note whistle */
      var f1 = rr(2600, 3400);
      sv(o.frequency, f1, t); lr(o.frequency, f1 * 1.04, t + 0.12);
      lr(g.gain, amp, t + 0.02); lr(g.gain, 0, t + 0.13);
      sv(o.frequency, f1 * 0.84, t + 0.21); lr(o.frequency, f1 * 0.8, t + 0.4);
      lr(g.gain, 0, t + 0.21); lr(g.gain, amp, t + 0.24); lr(g.gain, 0, t + 0.41);
      end = t + 0.45;
    } else if (kind === 1) {                /* soft trill */
      var f = rr(3200, 4200), n = ri(6, 10);
      for (var i = 0; i < n; i++) {
        var ti = t + i * 0.065;
        sv(o.frequency, f * (i % 2 ? 1.12 : 1), ti);
        lr(g.gain, 0, ti); lr(g.gain, amp * 0.7, ti + 0.01); lr(g.gain, 0, ti + 0.045);
      }
      end = t + n * 0.065 + 0.05;
    } else {                                /* rising call + two drops */
      sv(o.frequency, 2000, t); er(o.frequency, 4200, t + 0.16);
      lr(g.gain, amp, t + 0.03); lr(g.gain, 0, t + 0.17);
      for (var j = 0; j < 2; j++) {
        var tj = t + 0.26 + j * 0.13;
        sv(o.frequency, 3600, tj); er(o.frequency, 2700, tj + 0.07);
        lr(g.gain, 0, tj); lr(g.gain, amp * 0.8, tj + 0.012); lr(g.gain, 0, tj + 0.075);
      }
      end = t + 0.56;
    }
    v.src(o, t, end + 0.05);
  }
  function eOwl(sc, t) {
    var v = evVoice(sc, t, 0.6), o = O('sine', 400), lp = v.n(BQ('lowpass', 900, 0.7)), g = v.n(G(0));
    var f = rr(360, 420), notes = [[0, 0.38], [0.72, 0.17], [0.98, 0.45]], amp = 0.06;
    chain(o, lp, g, v.out);
    sv(g.gain, 0, t);
    for (var i = 0; i < notes.length; i++) {
      var a = t + notes[i][0], d = notes[i][1];
      sv(o.frequency, f * 1.03, a); lr(o.frequency, f * 0.95, a + d);
      lr(g.gain, 0, a); lr(g.gain, amp, a + 0.06); lr(g.gain, amp * 0.7, a + d - 0.05); lr(g.gain, 0, a + d);
    }
    v.src(o, t, t + 1.5);
  }
  function plip(sc, t, f0, f1, amp, wet, dec) {
    var v = evVoice(sc, t, wet), o = O('sine', f0), g = v.n(G(0));
    chain(o, g, v.out);
    sv(o.frequency, f0, t); er(o.frequency, f1, t + 0.035);
    sv(g.gain, 0, t); lr(g.gain, amp, t + 0.003); er(g.gain, 0.0001, t + dec);
    v.src(o, t, t + dec + 0.02);
  }
  function eWaterDrop(sc, t) { plip(sc, t, rr(800, 1100), rr(1500, 1900), rr(0.03, 0.06), 0.3, 0.07); }
  function eDrip(sc, t) { plip(sc, t, rr(1900, 2600), rr(800, 1100), rr(0.03, 0.08), 1.2, 0.12); }
  function eRumble(sc, t) {
    var v = evVoice(sc, t, 0.5, rr(-0.3, 0.3)), s = NSRC(BUF.brown, true), lp = v.n(BQ('lowpass', rr(70, 110), 0.9)), g = v.n(G(0));
    chain(s, lp, g, v.out);
    sv(g.gain, 0, t); lr(g.gain, rr(0.2, 0.32), t + 1.6); lr(g.gain, 0, t + 5);
    v.src(s, t, t + 5.1, rr(0, 3));
  }
  var CHIME_NOTES = [88, 90, 95, 97, 100, 102];
  function bellTone(sc, t, m, amp, wet, ring) {
    var v = evVoice(sc, t, wet), f = midiHz(m), c = O('sine', f), mo = O('sine', f * 3.5), mg = v.n(G(0)), g = v.n(G(0));
    chain(mo, mg); mg.connect(c.frequency); chain(c, g, v.out);
    sv(mg.gain, f * 2.2, t); st(mg.gain, f * 0.1, t, 0.05);
    sv(g.gain, 0, t); lr(g.gain, amp, t + 0.004); st(g.gain, 0, t + 0.004, ring);
    v.src(c, t, t + ring * 6.5); v.src(mo, t, t + ring * 6.5);
  }
  function eChime(sc, t) {
    var m = pickR(CHIME_NOTES);
    bellTone(sc, t, m, 0.03, 1.1, 1.4);
    if (chance(0.35)) bellTone(sc, t + rr(0.4, 0.9), pickR(CHIME_NOTES), 0.02, 1.1, 1.2);
  }
  function eTwinkle(sc, t) {
    var n = ri(1, 3), m = pickR(CHIME_NOTES) + 12;
    for (var i = 0; i < n; i++) bellTone(sc, t + i * rr(0.08, 0.16), m + pickR([0, -3, -5, 2]), 0.02, 0.9, 0.5);
  }
  function eRainTick(sc, t) {
    var v = evVoice(sc, t, 0.05), s = NSRC(BUF.white, false), bp = v.n(BQ('bandpass', rr(2000, 5500), 2)), g = v.n(G(0));
    chain(s, bp, g, v.out);
    sv(g.gain, 0, t); lr(g.gain, rr(0.02, 0.05), t + 0.003); er(g.gain, 0.0001, t + 0.022);
    v.src(s, t, t + 0.03, rr(0, 2));
  }

  function buildScene(key) {
    var sc = new Scene(key), p = key.split('_'), z = p[0], night = p[1] === 'night';
    if (z === 'village') { lBreeze(sc, night ? 0.11 : 0.15); if (night) makeCrickets(sc, 3, 0.8); }
    else if (z === 'woods') {
      lLeaves(sc, night ? 0.08 : 0.13); lBreeze(sc, 0.08);
      if (night) { makeCrickets(sc, 4, 1); sc.events.push({ rate: 1 / 55, fn: eOwl }); }
      else sc.events.push({ rate: 1 / 9, fn: eBird });
    } else if (z === 'lake') {
      lWater(sc, 0.11); sc.events.push({ rate: 1 / 7, fn: eWaterDrop });
      if (night) makeCrickets(sc, 2, 0.55);
    } else if (z === 'ridge') lWind(sc);
    else if (z === 'depths') { lCave(sc); sc.events.push({ rate: 1 / 3.5, fn: eDrip }, { rate: 1 / 100, fn: eRumble }); }
    else if (z === 'sanctum') { lAir(sc); sc.events.push({ rate: 1 / 30, fn: eChime }); if (night) makeCrickets(sc, 2, 0.45); }
    else if (z === 'interior') lRoom(sc);
    else if (z === 'rain') {
      sc.noise('white', 'highpass', 600, 0.5, 0.05);
      var lo = sc.noise('pink', 'lowpass', 900, 0.5, 0.1);
      sc.lfo(lo.g.gain, 0.09, 0.025);
      sc.events.push({ rate: 7, fn: eRainTick });
    } else if (z === 'mist') sc.noise('pink', 'lowpass', 320, 0.5, 0.07);
    else if (z === 'starfall') sc.events.push({ rate: 1 / 4, fn: eTwinkle });
    else if (SCENES_X.hasOwnProperty(z)) SCENES_X[z](sc, night);
    if (sc.setDepth) sc.setDepth(dir.opts.depth);
    return sc;
  }
  function sceneKey(z, o) {
    if (z === 'village' || z === 'woods' || z === 'lake' || z === 'sanctum') return z + (o.night ? '_night' : '_day');
    if (z === 'glade' || z === 'deepwood') return z + (o.night ? '_night' : '_day');
    if (z === 'ridge' || z === 'depths' || z === 'interior' || z === 'tavern' || z === 'cathedral' || z === 'boutique' || z === 'festival' || z === 'home') return z;
    return '';
  }
  function updateAmbience(force) {
    var k = sceneKey(dir.zone, dir.opts), w = dir.opts.weather, wk = '';
    if (OUTDOOR[dir.zone] && w !== 'clear') wk = w;
    else if (COSY[dir.zone] && w === 'rain') wk = 'rainwindow';   /* rain heard through the window */
    if (force || k !== amb.key) {
      if (amb.scene) amb.scene.stop(3);
      amb.scene = k ? buildScene(k) : null;
      if (amb.scene) amb.scene.fadeIn(2.5);
      amb.key = k;
    }
    if (force || wk !== amb.wkey) {
      if (amb.weather) amb.weather.stop(4);
      amb.weather = wk ? buildScene(wk) : null;
      if (amb.weather) amb.weather.fadeIn(4);
      amb.wkey = wk;
    }
  }
  function ambScene(sc, t, h, dt) {
    if (!sc || sc.stopping || !sc.v.alive) return;
    var i;
    for (i = 0; i < sc.events.length; i++) {
      var ev = sc.events[i], rate = ev.rate * (ev.dk ? 1 + ev.dk * (sc.depth || 0) : 1);
      if (R() < rate * dt) ev.fn(sc, t + rr(0.02, LOOKAHEAD));
    }
    for (i = 0; i < sc.crickets.length; i++) {
      var c = sc.crickets[i];
      if (c.next < t) c.next = t + rr(0, c.period);
      while (c.next < h) {
        chirp(sc, c.next, c);
        c.next += c.period * rr(0.95, 1.05);
        if (chance(0.07)) c.next += rr(2, 7);
      }
    }
    for (i = 0; i < sc.periodic.length; i++) {
      var pd = sc.periodic[i];
      if (pd.next < t) pd.next = t + rr(0, pd.period);
      while (pd.next < h) { pd.fn(sc, pd.next, pd); pd.n = (pd.n || 0) + 1; pd.next += pd.period * rr(1 - pd.jit, 1 + pd.jit); }
    }
    for (i = 0; i < sc.updaters.length; i++) {
      var u = sc.updaters[i];
      if (t >= u.next) { try { u.fn(t); } catch (e) {} u.next = t + rr(u.min, u.max); }
    }
  }
  function ambTick(t, h) {
    var dt = clamp(t - amb.lastT, 0, 0.25);
    amb.lastT = t;
    ambScene(amb.scene, t, h, dt);
    ambScene(amb.weather, t, h, dt);
  }

  /* ---- expansion ambience: tavern, cathedral, boutique, deepwood, glade, festival, home ---- */
  function eCrackle(sc, t) {
    var v = evVoice(sc, t, 0.05, rr(-0.4, 0.4)), s = NSRC(BUF.white, false), bp = v.n(BQ('bandpass', rr(1500, 3500), 1.5)), g = v.n(G(0));
    chain(s, bp, g, v.out);
    var a = (sc.crackAmp || 0.01) * rr(0.2, 1), d = rr(0.012, 0.035);
    sv(g.gain, 0, t); lr(g.gain, a, t + 0.003); er(g.gain, 0.0001, t + 0.003 + d);
    v.src(s, t, t + d + 0.02, rr(0, 2));
  }
  function ePop(sc, t) {
    var v = evVoice(sc, t, 0.15, rr(-0.3, 0.3)), o = O('sine', 300), g = v.n(G(0));
    var s = NSRC(BUF.white, false), bp = v.n(BQ('bandpass', 1200, 1)), g2 = v.n(G(0)), a = (sc.popAmp || 0.02) * rr(0.6, 1);
    chain(o, g, v.out); chain(s, bp, g2, v.out);
    sv(o.frequency, rr(260, 360), t); er(o.frequency, 110, t + 0.04);
    sv(g.gain, 0, t); lr(g.gain, a, t + 0.004); er(g.gain, 0.0001, t + 0.06);
    sv(g2.gain, 0, t); lr(g2.gain, a * 0.6, t + 0.003); er(g2.gain, 0.0001, t + 0.03);
    v.src(o, t, t + 0.08); v.src(s, t, t + 0.05, rr(0, 2));
  }
  function eClink(sc, t) {
    var m = rr(95, 99);
    bellTone(sc, t, m, 0.01, 0.4, 0.28);
    if (chance(0.45)) bellTone(sc, t + rr(0.06, 0.13), m + rr(-1.5, 1.5), 0.007, 0.4, 0.25);
  }
  /* crackling fire: low roar + crackles + the odd pop */
  function lFire(sc, g, crack, pop, rate) {
    var a = sc.noise('brown', 'lowpass', 380, 0, g);
    sc.lfo(a.g.gain, 0.21, g * 0.3);
    sc.crackAmp = crack; sc.popAmp = pop;
    sc.events.push({ rate: rate, fn: eCrackle }, { rate: rate / 25, fn: ePop });
  }
  /* wordless crowd: band-limited noise "talkers" with syllable-rate swells */
  function lMurmur(sc, n, level, lo, hi) {
    for (var i = 0; i < n; i++) {
      (function () {
        var l = sc.noise('pink', 'bandpass', rr(lo, hi), 1.3, 0, rr(-0.6, 0.6)), base = level * rr(0.7, 1);
        sc.every(0.08, 0.28, function (t) {
          st(l.g.gain, chance(0.22) ? base * 0.05 : base * rr(0.35, 1), t, rr(0.03, 0.07));
          st(l.f.frequency, rr(lo, hi), t, 0.06);
        });
      })();
    }
    var room = sc.noise('brown', 'lowpass', 280, 0, level * 0.8);
    sc.lfo(room.g.gain, 0.06, level * 0.25);
  }
  /* a distant ripple of laughter: vowel-ish pulses, no words */
  function eLaugh(sc, t) {
    var v = evVoice(sc, t, 0.8, rr(-0.7, 0.7)), o = O('triangle', 260), b1 = v.n(BQ('bandpass', 750, 3)), b2 = v.n(BQ('bandpass', 1150, 5));
    var s = v.n(G(1.6)), lp = v.n(BQ('lowpass', 1500, -2)), g = v.n(G(0));
    chain(o, b1, s); chain(o, b2, s); chain(s, lp, g, v.out);
    var f0 = rr(220, 320) * (chance(0.4) ? 1.5 : 1), n = ri(4, 7), amp = rr(0.015, 0.03) * (sc.laughK || 1), tt = t;
    sv(g.gain, 0, t);
    for (var i = 0; i < n; i++) {
      var d = rr(0.09, 0.13);
      sv(o.frequency, f0 * (1 - i * 0.04) * rr(0.98, 1.03), tt);
      lr(g.gain, 0, tt); lr(g.gain, amp * (1 - i * 0.1), tt + 0.02); lr(g.gain, 0, tt + d * 0.8);
      tt += d + rr(0.02, 0.05);
    }
    v.src(o, t, tt + 0.05);
  }
  /* a far-off drip in a vast stone room: plip + a decaying echo loop */
  function eEchoDrip(sc, t) {
    var v = evVoice(sc, t, 0.9, rr(-0.6, 0.6)), o = O('sine', 2000), g = v.n(G(0));
    var dl = v.n(ctx.createDelay(1)), fb = v.n(G(0.5)), lp = v.n(BQ('lowpass', 1600, -2)), echo = v.n(G(0.7));
    dl.delayTime.value = rr(0.27, 0.36);
    chain(o, g, v.out);
    g.connect(dl); chain(dl, lp, fb, dl); chain(lp, echo, v.out);
    sv(o.frequency, rr(1800, 2400), t); er(o.frequency, rr(800, 1000), t + 0.04);
    sv(g.gain, 0, t); lr(g.gain, rr(0.012, 0.03), t + 0.003); er(g.gain, 0.0001, t + 0.12);
    v.src(o, t, t + 2.6);
  }
  function pClock(sc, t, pd) {
    var tock = (pd.n || 0) % 2 === 1, v = evVoice(sc, t, 0.12, 0.3), s = NSRC(BUF.white, false);
    var bp = v.n(BQ('bandpass', tock ? 1700 : 2200, 3)), g = v.n(G(0));
    chain(s, bp, g, v.out);
    sv(g.gain, 0, t); lr(g.gain, pd.amp, t + 0.003); er(g.gain, 0.0001, t + 0.03);
    v.src(s, t, t + 0.04, rr(0, 2));
  }
  function eCreakAmb(sc, t) {
    var v = evVoice(sc, t, sc.creakWet || 0.4, rr(-0.5, 0.5)), o = O('sawtooth', 90), bp = v.n(BQ('bandpass', 700, 3.5)), lp = v.n(BQ('lowpass', 1500, -2)), g = v.n(G(0));
    chain(o, bp, lp, g, v.out);
    var d = rr(0.5, 0.9), f = rr(65, 110) * (sc.creakP || 1), amp = (sc.creakAmp || 0.01) * rr(0.6, 1);
    sv(o.frequency, f, t);
    for (var k = 1; k <= 5; k++) lr(o.frequency, f * rr(0.85, 1.25), t + d * k / 5);
    sv(g.gain, 0, t); lr(g.gain, amp, t + 0.08); lr(g.gain, amp * 0.6, t + d * 0.8); er(g.gain, 0.0001, t + d);
    v.src(o, t, t + d + 0.03);
  }
  function eBeetle(sc, t) {
    var v = evVoice(sc, t, 0.15), s = NSRC(BUF.white, true), bp = v.n(BQ('bandpass', rr(2600, 3600), 2)), g = v.n(G(0));
    var n = ri(2, 5), tt = t, amp = rr(0.004, 0.012);
    chain(s, bp, g, v.out);
    sv(g.gain, 0, t);
    for (var i = 0; i < n; i++) { lr(g.gain, 0, tt); lr(g.gain, amp, tt + 0.003); lr(g.gain, 0, tt + 0.014); tt += rr(0.03, 0.06); }
    v.src(s, t, tt + 0.03, rr(0, 2));
  }
  function eHowl(sc, t) {
    var v = evVoice(sc, t, 1.2, rr(-0.8, 0.8)), o = O('triangle', 300), b1 = v.n(BQ('bandpass', 500, 4)), lp = v.n(BQ('lowpass', 1200, -2)), g = v.n(G(0));
    chain(o, b1, lp, g, v.out);
    var f = rr(280, 340), d = rr(1.8, 2.6), amp = rr(0.012, 0.022);
    sv(o.frequency, f, t); lr(o.frequency, f * 1.7, t + 0.5); lr(o.frequency, f * 1.6, t + d * 0.75); lr(o.frequency, f * 1.1, t + d);
    sv(b1.frequency, 450, t); lr(b1.frequency, 750, t + 0.6); lr(b1.frequency, 500, t + d);
    sv(g.gain, 0, t); lr(g.gain, amp, t + 0.4); lr(g.gain, amp * 0.8, t + d * 0.75); lr(g.gain, 0, t + d);
    v.src(o, t, t + d + 0.05);
  }
  function eFrog(sc, t) {
    var v = evVoice(sc, t, 0.3), o = O('triangle', rr(170, 240)), am = v.n(G(0.5)), lfo = O('sine', rr(24, 32)), lg = v.n(G(0.5));
    var bp = v.n(BQ('bandpass', 520, 2)), lp = v.n(BQ('lowpass', 1100, -3)), g = v.n(G(0));
    chain(o, am, bp, lp, g, v.out); chain(lfo, lg, am.gain);
    var amp = rr(0.02, 0.04), n = chance(0.5) ? 2 : 1, tt = t;
    sv(g.gain, 0, t);
    for (var i = 0; i < n; i++) {
      var d = rr(0.1, 0.16);
      lr(g.gain, 0, tt); lr(g.gain, amp, tt + 0.01); lr(g.gain, amp * 0.7, tt + d - 0.02); lr(g.gain, 0, tt + d);
      tt += d + rr(0.06, 0.1);
    }
    v.src(o, t, tt + 0.03); v.src(lfo, t, tt + 0.03);
  }
  function eWindowDrop(sc, t) {
    var v = evVoice(sc, t, 0.1), s = NSRC(BUF.white, false), bp = v.n(BQ('bandpass', rr(2200, 3800), 2.5)), g = v.n(G(0));
    chain(s, bp, g, v.out);
    sv(g.gain, 0, t); lr(g.gain, rr(0.004, 0.012), t + 0.003); er(g.gain, 0.0001, t + 0.025);
    v.src(s, t, t + 0.035, rr(0, 2));
  }
  function lTrickle(sc, g) {
    var a = sc.noise('pink', 'bandpass', 2200, 1.4, g, 0.35);
    sc.every(0.05, 0.12, function (t) { st(a.g.gain, g * rr(0.35, 1), t, 0.03); st(a.f.frequency, rr(1700, 2800), t, 0.04); });
    var b = sc.noise('brown', 'lowpass', 400, 0, g * 1.8, 0.3);
    sc.lfo(b.g.gain, 0.15, g * 0.6);
  }
  function lDeepwood(sc, night) {
    var w = sc.noise('pink', 'bandpass', 500, 1.2, 0.3), wh = sc.noise('white', 'bandpass', 1100, 9, 0.02), br = sc.noise('brown', 'lowpass', 120, 0, 0.03);
    sc.depth = 0;
    sc.every(2.5, 6, function (t) {
      var d = sc.depth;
      st(w.f.frequency, rr(300, 900) * (1 - 0.3 * d), t, rr(1.2, 2.5));
      st(w.g.gain, rr(0.12, 0.45) * (0.8 + 0.4 * d), t, rr(1, 2));
      st(wh.f.frequency, rr(700, 1500), t, 2);
      st(wh.g.gain, rr(0.005, 0.03) * (0.6 + 1.2 * d), t, 1.5);
      st(br.g.gain, 0.03 + 0.09 * d, t, 3);
    });
    sc.creakAmp = 0.014; sc.creakP = 0.75; sc.creakWet = 1.0;
    sc.events.push({ rate: 1 / 16, fn: eCreakAmb, dk: 1 }, { rate: 1 / 3, fn: eBeetle, dk: 0.5 }, { rate: 1 / 110, fn: eHowl, dk: 2 });
    if (night) sc.events.push({ rate: 1 / 70, fn: eOwl });
    sc.setDepth = function (d) { sc.depth = clamp(d, 0, 1); };
  }
  var SCENES_X = {
    tavern: function (sc) {
      lMurmur(sc, 3, 0.12, 350, 750);
      lFire(sc, 0.05, 0.016, 0.03, 4);
      sc.events.push({ rate: 1 / 13, fn: eClink });
    },
    cathedral: function (sc) {
      var a = sc.noise('brown', 'lowpass', 170, 0, 0.06); sc.lfo(a.g.gain, 0.03, 0.02);
      var b = sc.noise('pink', 'bandpass', 520, 0.6, 0.03); sc.lfo(b.g.gain, 0.05, 0.012);
      sc.events.push({ rate: 1 / 10, fn: eEchoDrip });
    },
    boutique: function (sc) {
      sc.noise('brown', 'lowpass', 220, 0, 0.045);
      sc.crackAmp = 0.006; sc.events.push({ rate: 1.6, fn: eCrackle });
      sc.periodic.push({ period: 1.0, jit: 0.002, next: 0, amp: 0.012, fn: pClock });
      sc.creakAmp = 0.012; sc.events.push({ rate: 1 / 28, fn: eCreakAmb });
    },
    deepwood: lDeepwood,
    glade: function (sc, night) {
      lTrickle(sc, 0.02);
      lBreeze(sc, 0.05);
      if (night) { makeCrickets(sc, 2, 0.5); sc.events.push({ rate: 1 / 5, fn: eFrog }); }
      else { sc.birdK = 0.6; sc.events.push({ rate: 1 / 6, fn: eBird }); }
    },
    festival: function (sc) {
      lMurmur(sc, 5, 0.16, 350, 900);
      lFire(sc, 0.09, 0.03, 0.05, 6);
      sc.events.push({ rate: 1 / 6, fn: eLaugh }, { rate: 1 / 20, fn: eClink });
    },
    home: function (sc) {
      lRoom(sc);
      lFire(sc, 0.03, 0.012, 0.02, 2.5);
      sc.periodic.push({ period: 1.0, jit: 0.002, next: 0, amp: 0.012, fn: pClock });
    },
    rainwindow: function (sc) {
      var a = sc.noise('pink', 'lowpass', 1200, 0, 0.09);
      sc.lfo(a.g.gain, 0.07, 0.02);
      sc.noise('white', 'bandpass', 2600, 0.8, 0.008);
      sc.events.push({ rate: 1.5, fn: eWindowDrop });
    }
  };

  /* ------------------------------------------------------------------ */
  /*  SFX: small synthesis helpers + a table of named sounds.            */
  /*  x = { t: start, v: volume, p: pitch multiplier, pan }              */
  /*  House style: soft 3-10 ms attacks, nothing harsh above ~5 kHz      */
  /*  (the sfx bus also low-passes at 5 kHz), frequent sounds stay low.  */
  /* ------------------------------------------------------------------ */
  /* level calibration: filtered noise and FM sit lower than their nominal amplitude */
  var K_TONE = 2, K_NOISE = 3, K_BELL = 3, K_INST = 2;
  function sfxVoice(x, t, wet) {
    var v = new Voice(null, t), p = v.n(PAN(x.pan));
    v.out.connect(p); p.connect(S.inp);
    if (wet > 0) { var w = v.n(G(wet)); p.connect(w); w.connect(S.wet); }
    regVoice(sfxVoices, v, SFX_CAP);
    return v;
  }
  /* oscillator with pitch glide and attack/decay; o: a, lp, bp, q, gl, lin, vib:[rate,cents], sus, wet */
  function tone(x, at, type, f0, f1, dur, amp, o) {
    o = o || {};
    var t = x.t + at, v = sfxVoice(x, t, F(o.wet, 0)), osc = O(type, f0 * x.p), g = v.n(G(0)), node = osc;
    if (o.lp) { var lp = v.n(BQ('lowpass', o.lp, F(o.q, -1))); node.connect(lp); node = lp; }
    if (o.bp) { var bp = v.n(BQ('bandpass', o.bp, F(o.q, 1))); node.connect(bp); node = bp; }
    chain(node, g, v.out);
    sv(osc.frequency, f0 * x.p, t);
    if (isNum(f1) && f1 > 0 && f1 !== f0) {
      if (o.lin) lr(osc.frequency, f1 * x.p, t + F(o.gl, dur)); else er(osc.frequency, f1 * x.p, t + F(o.gl, dur));
    }
    if (o.vib) { var l = O('sine', o.vib[0]), lg = v.n(G(o.vib[1])); chain(l, lg, osc.detune); v.src(l, t, t + dur + 0.05); }
    var a = Math.max(0.003, F(o.a, 0.006)), A0 = amp * x.v * K_TONE;
    sv(g.gain, 0, t); lr(g.gain, A0, t + a);
    if (o.sus) lr(g.gain, A0 * 0.8, t + Math.max(a + 0.01, dur * o.sus));
    er(g.gain, 0.0001, t + Math.max(a + 0.02, dur));
    v.src(osc, t, t + dur + 0.04);
    return osc;
  }
  /* filtered noise burst with filter sweep; o: a, buf, sus, gl, lp (extra low-pass), wet */
  function nz(x, at, dur, amp, type, f0, f1, q, o) {
    o = o || {};
    var t = x.t + at, v = sfxVoice(x, t, F(o.wet, 0)), s = NSRC(BUF[o.buf || 'white'], true);
    var fl = v.n(BQ(type, f0 * x.p, F(q, 1))), g = v.n(G(0)), last = fl;
    s.connect(fl);
    if (o.lp) { var l2 = v.n(BQ('lowpass', o.lp, -2)); fl.connect(l2); last = l2; }
    chain(last, g, v.out);
    sv(fl.frequency, clamp(f0 * x.p, 20, 18000), t);
    if (isNum(f1) && f1 > 0 && f1 !== f0) er(fl.frequency, clamp(f1 * x.p, 20, 18000), t + F(o.gl, dur));
    var a = Math.max(0.003, F(o.a, 0.006)), A0 = amp * x.v * K_NOISE;
    sv(g.gain, 0, t); lr(g.gain, A0, t + a);
    if (o.sus) lr(g.gain, A0 * 0.8, t + Math.max(a + 0.01, dur * o.sus));
    er(g.gain, 0.0001, t + Math.max(a + 0.01, dur));
    v.src(s, t, t + dur + 0.03, rr(0, 2));
  }
  /* FM bell; o: ratio, idx, idec, wet */
  function bell(x, at, m, amp, ring, o) {
    o = o || {};
    var t = x.t + at, f = midiHz(m) * x.p, v = sfxVoice(x, t, F(o.wet, 0.3));
    var c = O('sine', f), mo = O('sine', f * F(o.ratio, 3.5)), mg = v.n(G(0)), g = v.n(G(0));
    mo.connect(mg); mg.connect(c.frequency); chain(c, g, v.out);
    sv(mg.gain, f * F(o.idx, 1.5), t); st(mg.gain, f * 0.06, t, F(o.idec, 0.05));
    sv(g.gain, 0, t); lr(g.gain, amp * x.v * K_BELL, t + 0.004); st(g.gain, 0, t + 0.004, ring);
    var te = t + 0.01 + ring * 6;
    v.src(c, t, te); v.src(mo, t, te);
  }
  /* church-bell partials (hum, prime, tierce, quint, nominal...) each with its own decay */
  var BELL_P = [[0.5, 1.0, 1.0], [1, 0.8, 0.75], [1.19, 0.5, 0.5], [1.5, 0.35, 0.4], [2.0, 0.4, 0.32], [2.52, 0.16, 0.22], [3.0, 0.1, 0.16]];
  function bigBell(x, at, m, amp, ring, wet) {
    var t = x.t + at, f = midiHz(m) * x.p, v = sfxVoice(x, t, F(wet, 0.9));
    var lp = v.n(BQ('lowpass', 1700, -3)), g = v.n(G(amp * x.v * K_BELL));
    chain(lp, g, v.out);
    for (var i = 0; i < BELL_P.length; i++) {
      var p = BELL_P[i], o = O('sine', f * p[0] * (1 + rr(-0.002, 0.002))), pg = v.n(G(0)), d = ring * p[2];
      chain(o, pg, lp);
      sv(pg.gain, 0, t); lr(pg.gain, p[1], t + 0.009); st(pg.gain, 0, t + 0.009, d);
      v.src(o, t, t + 0.02 + d * 5.5);
    }
  }
  /* music instrument on the sfx bus (shares the sfx volume) */
  function inst(x, at, name, m, vel, dur, o) {
    o = o || {};
    var io = {}, k;
    for (k in o) if (o.hasOwnProperty(k)) io[k] = o[k];
    io.gain = F(o.gain, 1) * x.v * K_INST;
    io.pan = F(o.pan, 0) + x.pan * 0.7;
    INST[name](x.t + at, m + 12 * Math.log(x.p) / Math.LN2, vel, dur, io, dSfx());
  }
  function arp(x, at, name, notes, step, vel, o) {
    for (var i = 0; i < notes.length; i++) inst(x, at + i * step, name, notes[i], vel, 0.6, o);
  }
  /* wooden creak: stick-slip pitch jitter through a resonant wood band, softened */
  function creak(x, at, f0, f1, f2, dur, amp) {
    amp *= K_TONE;
    var t = x.t + at, v = sfxVoice(x, t, 0.12), o = O('sawtooth', f0 * x.p);
    var bp = v.n(BQ('bandpass', 750, 3.5)), lp = v.n(BQ('lowpass', 1700, -2)), g = v.n(G(0));
    chain(o, bp, lp, g, v.out);
    sv(o.frequency, f0 * x.p, t);
    for (var k = 1; k <= 6; k++) {
      var u = k / 6, base = u < 0.45 ? f0 + (f1 - f0) * (u / 0.45) : f1 + (f2 - f1) * ((u - 0.45) / 0.55);
      lr(o.frequency, base * x.p * rr(0.93, 1.07), t + dur * u);
    }
    sv(g.gain, 0, t); lr(g.gain, amp * x.v, t + 0.06); lr(g.gain, amp * x.v * 0.6, t + dur * 0.8); er(g.gain, 0.0001, t + dur);
    v.src(o, t, t + dur + 0.03);
  }
  /* formant voice (mandrake, cat, ghost, wolf): pitch & formant contours as [time, value] lists */
  function formantVoice(x, at, type, pitch, f1s, f2s, dur, amp, o) {
    o = o || {};
    var t = x.t + at, v = sfxVoice(x, t, F(o.wet, 0.15)), src = O(type, pitch[0][1] * x.p);
    var b1 = v.n(BQ('bandpass', f1s[0][1], F(o.q1, 5))), b2 = v.n(BQ('bandpass', f2s[0][1], F(o.q2, 8)));
    var g1 = v.n(G(1)), g2 = v.n(G(F(o.g2, 0.6))), sum = v.n(G(F(o.boost, 2.4))), lp = v.n(BQ('lowpass', F(o.lp, 3600), -1)), env = v.n(G(0));
    chain(src, b1, g1, sum); chain(src, b2, g2, sum); chain(sum, lp, env, v.out);
    if (o.body) { var bg = v.n(G(o.body)); chain(src, bg, lp); }
    var i;
    sv(src.frequency, pitch[0][1] * x.p, t);
    for (i = 1; i < pitch.length; i++) lr(src.frequency, pitch[i][1] * x.p, t + pitch[i][0]);
    sv(b1.frequency, f1s[0][1], t);
    for (i = 1; i < f1s.length; i++) lr(b1.frequency, f1s[i][1], t + f1s[i][0]);
    sv(b2.frequency, f2s[0][1], t);
    for (i = 1; i < f2s.length; i++) lr(b2.frequency, f2s[i][1], t + f2s[i][0]);
    if (o.vib) { var l = O('sine', o.vib[0]), lg = v.n(G(o.vib[1])); chain(l, lg, src.detune); v.src(l, t, t + dur + 0.05); }
    var A0 = amp * x.v * K_TONE;
    sv(env.gain, 0, t); lr(env.gain, A0, t + Math.max(0.01, F(o.a, 0.03))); lr(env.gain, A0 * 0.85, t + dur * 0.7); er(env.gain, 0.0001, t + dur);
    v.src(src, t, t + dur + 0.05);
  }

  var SFX = {
    /* farming & walking: soft, organic, low */
    footstep_grass: function (x) {
      nz(x, 0, 0.06, 0.012, 'bandpass', rr(1700, 2400), 1300, 0.7, { a: 0.008, lp: 3200 });
      nz(x, 0, 0.05, 0.02, 'lowpass', 300, 180, 0.7, { buf: 'pink', a: 0.006 });
    },
    footstep_stone: function (x) {
      nz(x, 0, 0.035, 0.008, 'bandpass', 1400, 1100, 0.8, { a: 0.004, lp: 2800 });
      tone(x, 0, 'sine', 150, 105, 0.05, 0.014, { a: 0.004 });
    },
    footstep_wood: function (x) {
      tone(x, 0, 'triangle', 210, 160, 0.07, 0.016, { a: 0.004, lp: 800 });
      nz(x, 0, 0.04, 0.008, 'bandpass', 800, 650, 1, { a: 0.004 });
    },
    hoe: function (x) {
      nz(x, 0, 0.18, 0.05, 'lowpass', 700, 260, 0.7, { buf: 'brown', a: 0.008 });
      nz(x, 0.01, 0.14, 0.01, 'bandpass', 950, 600, 1.2, { buf: 'pink', a: 0.02, lp: 2000 });
      tone(x, 0, 'sine', 95, 55, 0.12, 0.045, { a: 0.006 });
    },
    water_pour: function (x) {
      var t = x.t, v = sfxVoice(x, t, 0.12), s = NSRC(BUF.pink, true), dur = 0.8;
      var bp = v.n(BQ('bandpass', 1300 * x.p, 1.4)), lp = v.n(BQ('lowpass', 3200, -3)), g = v.n(G(0));
      chain(s, bp, lp, g, v.out);
      var A0 = 0.035 * x.v * K_NOISE, k;
      sv(g.gain, 0, t); lr(g.gain, A0 * 0.6, t + 0.08);
      for (k = 0.12; k < dur - 0.15; k += rr(0.04, 0.09)) lr(g.gain, A0 * rr(0.35, 1), t + k);
      lr(g.gain, 0, t + dur);
      for (k = 0.1; k < dur - 0.1; k += rr(0.06, 0.12)) st(bp.frequency, rr(1000, 1700) * x.p, t + k, 0.03);
      v.src(s, t, t + dur + 0.05, rr(0, 3));
      for (var i = 0; i < 4; i++) tone(x, rr(0.1, 0.65), 'sine', rr(450, 650), rr(800, 1100), 0.05, 0.006, { a: 0.006 });
    },
    plant_seed: function (x) {
      nz(x, 0, 0.09, 0.025, 'lowpass', 420, 220, 0.7, { buf: 'brown', a: 0.01 });
      nz(x, 0.02, 0.12, 0.004, 'bandpass', 1500, 1100, 0.9, { buf: 'pink', a: 0.03, lp: 2400 });
      tone(x, 0, 'sine', 120, 80, 0.07, 0.01, { a: 0.008 });
    },
    harvest: function (x) {
      nz(x, 0, 0.16, 0.018, 'bandpass', 2200, 1500, 0.8, { a: 0.02, lp: 3500 });
      tone(x, 0.03, 'sine', 240, 360, 0.08, 0.035, { a: 0.005, lp: 1200 });
      inst(x, 0.09, 'celesta', 76, 0.25, 0.4, { gain: 0.22, wet: 0.4 });
    },
    mandrake_scream: function (x) {
      formantVoice(x, 0, 'sawtooth', [[0, 620], [0.12, 980], [0.3, 860], [0.5, 520]],
        [[0, 320], [0.15, 420], [0.45, 750]], [[0, 800], [0.15, 2300], [0.45, 1200]], 0.52, 0.03, { vib: [11, 60], lp: 2800, g2: 0.5, a: 0.04 });
    },
    /* mining & woodcutting: rounded thuds, no clicks */
    pickaxe_hit: function (x) {
      bell(x, 0, 81 + rr(-1, 1), 0.012, 0.1, { ratio: 2.76, idx: 1.2, wet: 0.15 });
      nz(x, 0, 0.04, 0.022, 'bandpass', 1400, 900, 1, { a: 0.004, lp: 3000 });
      tone(x, 0, 'sine', 130, 75, 0.08, 0.05, { a: 0.004 });
    },
    rock_break: function (x) {
      nz(x, 0, 0.28, 0.045, 'lowpass', 1500, 400, 0.7, { buf: 'pink', a: 0.006 });
      tone(x, 0, 'sine', 100, 50, 0.18, 0.055, { a: 0.005 });
      var g = [], tt = 0.03;
      while (tt < 0.32) { g.push([tt, rr(0.006, 0.012), rr(700, 1800)]); tt += rr(0.04, 0.07); }
      pulses(x, 0, g, { q: 1.2, lp: 2500, dur: 0.03 });
    },
    gem_found: function (x) {
      arp(x, 0, 'celesta', [84, 88, 91, 96], 0.07, 0.42, { gain: 0.45, wet: 0.5 });
      nz(x, 0.05, 0.6, 0.004, 'bandpass', 3500, 4200, 1, { a: 0.1, wet: 0.4 });
    },
    axe_chop: function (x) {
      tone(x, 0, 'sine', 180, 90, 0.12, 0.065, { a: 0.004 });
      nz(x, 0, 0.05, 0.028, 'bandpass', 1000, 700, 1.2, { a: 0.004, lp: 2500 });
      tone(x, 0, 'triangle', 300, 280, 0.14, 0.02, { a: 0.004, lp: 1200 });
    },
    tree_fall: function (x) {
      creak(x, 0, 85, 110, 70, 0.9, 0.045);
      nz(x, 0.6, 0.6, 0.03, 'bandpass', 500, 2200, 1, { a: 0.3, gl: 0.6, lp: 3500 });
      tone(x, 1.15, 'sine', 70, 38, 0.6, 0.13, { a: 0.008 });
      nz(x, 1.15, 0.5, 0.07, 'lowpass', 700, 150, 0.7, { buf: 'brown', a: 0.008 });
      nz(x, 1.2, 0.8, 0.02, 'bandpass', 2600, 1800, 0.6, { a: 0.05, lp: 3500 });
    },
    /* combat: readable but rounded */
    sword_swing: function (x) { nz(x, 0, 0.2, 0.08, 'bandpass', 500, 2200, 1.6, { a: 0.05, gl: 0.12, lp: 3500 }); },
    wand_cast: function (x) {
      tone(x, 0, 'triangle', 500, 1400, 0.28, 0.026, { a: 0.03, lp: 2600, wet: 0.3 });
      bell(x, 0.08, 91, 0.014, 0.35, { idx: 1, wet: 0.5 });
      bell(x, 0.14, 98, 0.01, 0.3, { idx: 1, wet: 0.5 });
      nz(x, 0, 0.3, 0.005, 'bandpass', 3500, 4200, 1, { a: 0.05, wet: 0.3 });
    },
    magic_bolt_hit: function (x) {
      nz(x, 0, 0.15, 0.035, 'lowpass', 2500, 400, 0.7, { a: 0.004 });
      bell(x, 0, 84, 0.016, 0.25, { ratio: 1.41, idx: 1.5, wet: 0.3 });
      tone(x, 0, 'sine', 700, 300, 0.15, 0.022, { a: 0.004 });
    },
    enemy_hit: function (x) {
      tone(x, 0, 'sine', 210, 105, 0.1, 0.07, { a: 0.004 });
      nz(x, 0, 0.05, 0.025, 'lowpass', 1600, 600, 0.7, { a: 0.004 });
    },
    enemy_die: function (x) {
      nz(x, 0, 0.4, 0.03, 'bandpass', 1800, 280, 1.2, { a: 0.008, lp: 3000 });
      tone(x, 0, 'triangle', 380, 110, 0.35, 0.04, { a: 0.006, lp: 1200 });
      inst(x, 0.25, 'celesta', 88, 0.25, 0.3, { gain: 0.22 });
    },
    player_hurt: function (x) {
      tone(x, 0, 'sine', 280, 170, 0.18, 0.06, { a: 0.005 });
      tone(x, 0, 'triangle', 300, 180, 0.16, 0.02, { a: 0.005, lp: 1000 });
      nz(x, 0, 0.06, 0.025, 'lowpass', 900, 300, 0.7, { buf: 'pink', a: 0.004 });
    },
    player_die: function (x) {
      tone(x, 0, 'triangle', 440, 110, 1.3, 0.045, { a: 0.03, lp: 1400, vib: [5.5, 25], wet: 0.4, lin: true });
      inst(x, 0.15, 'piano', 50, 0.4, 1.5, { gain: 0.45 });
      inst(x, 0.5, 'piano', 45, 0.35, 2, { gain: 0.45 });
    },
    /* creatures */
    slime_hop: function (x) {
      var t = x.t, v = sfxVoice(x, t, 0.05), o = O('sine', 170 * x.p), lp = v.n(BQ('lowpass', 900, 0)), g = v.n(G(0));
      chain(o, lp, g, v.out);
      sv(o.frequency, 170 * x.p, t); er(o.frequency, 430 * x.p, t + 0.07); er(o.frequency, 200 * x.p, t + 0.16);
      sv(g.gain, 0, t); lr(g.gain, 0.11 * x.v, t + 0.01); er(g.gain, 0.0001, t + 0.18);
      v.src(o, t, t + 0.2);
      nz(x, 0, 0.06, 0.016, 'bandpass', 700, 400, 2, { buf: 'pink', a: 0.005 });
    },
    spider_skitter: function (x) {
      var n = ri(8, 12), list = [], tt = 0;
      for (var i = 0; i < n; i++) { list.push([tt, rr(0.01, 0.02), rr(2800, 4000)]); tt += rr(0.022, 0.034); }
      pulses(x, 0, list, { q: 1, lp: 4500, dur: 0.014 });
    },
    bat_flap: function (x) {
      for (var i = 0; i < 3; i++) nz(x, i * 0.075, 0.05, 0.055 - i * 0.012, 'lowpass', 1000, 400, 0.8, { buf: 'pink', a: 0.008 });
    },
    ghost_wail: function (x) {
      formantVoice(x, 0, 'triangle', [[0, 480], [0.45, 720], [1.3, 430]], [[0, 380], [1.3, 420]], [[0, 850], [0.5, 1000], [1.3, 800]],
        1.4, 0.065, { vib: [5.5, 45], a: 0.3, wet: 0.8, q1: 4, q2: 6, boost: 2.2, lp: 2400 });
    }
  };

  SFX.wizard_cast = function (x) {
    nz(x, 0, 0.5, 0.03, 'bandpass', 300, 2200, 3, { a: 0.15, wet: 0.3, lp: 3000 });
    tone(x, 0, 'sawtooth', 110, 220, 0.5, 0.012, { a: 0.1, lp: 800, wet: 0.3 });
    arp(x, 0.1, 'celesta', [69, 72, 76, 81], 0.06, 0.33, { gain: 0.42, wet: 0.5 });
  };
  SFX.golem_stomp = function (x) {
    tone(x, 0, 'sine', 75, 38, 0.4, 0.16, { a: 0.008 });
    nz(x, 0, 0.35, 0.085, 'lowpass', 400, 120, 0.8, { buf: 'brown', a: 0.006 });
    var g = [], tt = 0.03;
    while (tt < 0.27) { g.push([tt, 0.012, rr(700, 1800)]); tt += rr(0.04, 0.06); }
    pulses(x, 0, g, { q: 1.3, lp: 2500, dur: 0.028 });
  };
  /* items & money: warm and pleasant */
  SFX.pickup = function (x) {
    tone(x, 0, 'sine', 330, 560, 0.12, 0.034, { a: 0.006, gl: 0.06, lp: 1600 });
    tone(x, 0, 'sine', 660, 1120, 0.08, 0.005, { a: 0.006, gl: 0.06 });
  };
  SFX.coin = function (x) {
    bell(x, 0, 86, 0.013, 0.22, { ratio: 3.5, idx: 0.7, wet: 0.25 });
    bell(x, 0.075, 91, 0.012, 0.3, { ratio: 3.5, idx: 0.7, wet: 0.25 });
  };
  SFX.buy = function (x) {
    SFX.coin(x);
    inst(x, 0.15, 'harp', 67, 0.4, 1, { gain: 0.32 });
    inst(x, 0.21, 'harp', 74, 0.36, 1, { gain: 0.28 });
  };
  SFX.sell = function (x) {
    bell(x, 0, 91, 0.012, 0.25, { ratio: 3.5, idx: 0.7, wet: 0.25 });
    bell(x, 0.075, 86, 0.012, 0.3, { ratio: 3.5, idx: 0.7, wet: 0.25 });
    bell(x, 0.15, 89, 0.005, 0.2, { ratio: 3.5, idx: 0.6, wet: 0.25 });
  };
  /* interface: nearly subliminal */
  SFX.error = function (x) {
    tone(x, 0, 'sine', 190, 120, 0.13, 0.03, { a: 0.006, lp: 600 });
    tone(x, 0, 'sine', 380, 240, 0.06, 0.004, { a: 0.006 });
  };
  SFX.menu_open = function (x) {
    nz(x, 0, 0.18, 0.006, 'bandpass', 700, 1800, 1, { a: 0.05, lp: 3000 });
    inst(x, 0.03, 'celesta', 79, 0.26, 0.3, { gain: 0.24 });
    inst(x, 0.09, 'celesta', 86, 0.26, 0.3, { gain: 0.2 });
  };
  SFX.menu_close = function (x) {
    nz(x, 0, 0.16, 0.005, 'bandpass', 1800, 700, 1, { a: 0.04, lp: 3000 });
    inst(x, 0.02, 'celesta', 84, 0.24, 0.3, { gain: 0.2 });
    inst(x, 0.08, 'celesta', 77, 0.24, 0.3, { gain: 0.2 });
  };
  SFX.ui_click = function (x) { tone(x, 0, 'sine', 1100, 950, 0.03, 0.005, { a: 0.004 }); };
  SFX.ui_hover = function (x) { tone(x, 0, 'sine', 1500, 1450, 0.025, 0.0016, { a: 0.006 }); };
  /* doors, ladders, magic travel */
  SFX.door_open = function (x) {
    nz(x, 0, 0.03, 0.012, 'bandpass', 1500, 0, 1.2, { a: 0.004, lp: 2500 });
    creak(x, 0.03, 110, 150, 120, 0.5, 0.03);
    tone(x, 0.03, 'sine', 140, 90, 0.08, 0.03, { a: 0.005 });
  };
  SFX.ladder_descend = function (x) {
    for (var i = 0; i < 4; i++) {
      var y = { t: x.t + i * 0.16, v: x.v * (1 - i * 0.12), p: x.p * (1 - i * 0.05), pan: x.pan };
      SFX.footstep_wood(y);
    }
    nz(x, 0.1, 0.6, 0.01, 'lowpass', 900, 300, 0.7, { buf: 'pink', a: 0.2 });
  };
  SFX.teleport = function (x) {
    tone(x, 0, 'sine', 300, 1600, 0.9, 0.026, { a: 0.3, wet: 0.6, vib: [7, 30] });
    nz(x, 0, 1.0, 0.012, 'bandpass', 600, 4000, 2, { a: 0.4, wet: 0.5, gl: 0.9 });
    arp(x, 0.3, 'celesta', [74, 78, 81, 86, 90, 93], 0.05, 0.36, { gain: 0.4, wet: 0.6 });
  };
  /* brewing */
  SFX.brew_start = function (x) {
    nz(x, 0, 0.8, 0.02, 'lowpass', 300, 900, 0.7, { buf: 'pink', a: 0.3 });
    for (var i = 0; i < 5; i++) tone(x, rr(0.1, 0.8), 'sine', rr(160, 240), rr(450, 700), 0.07, 0.018, { a: 0.006, lp: 1200 });
  };
  SFX.brew_bubble = function (x) { tone(x, 0, 'sine', rr(180, 260), rr(500, 700), 0.07, 0.02, { a: 0.006, lp: 1200 }); };
  SFX.brew_done = function (x) {
    inst(x, 0, 'harp', 55, 0.42, 1, { gain: 0.42 });
    arp(x, 0.02, 'celesta', [67, 71, 74, 78, 81], 0.06, 0.38, { gain: 0.42, wet: 0.5 });
    bell(x, 0.4, 93, 0.006, 0.6, { idx: 1, wet: 0.7 });
  };
  /* water & fishing */
  SFX.splash = function (x) {
    nz(x, 0, 0.45, 0.045, 'bandpass', 1400, 500, 0.8, { a: 0.006, wet: 0.1, lp: 3000 });
    nz(x, 0, 0.2, 0.028, 'lowpass', 800, 200, 0.7, { buf: 'pink' });
    for (var i = 0; i < 4; i++) tone(x, rr(0.08, 0.4), 'sine', rr(900, 1300), rr(1500, 2200), 0.04, 0.006, { a: 0.004 });
  };
  SFX.fish_bite = function (x) {
    tone(x, 0, 'sine', 480, 240, 0.08, 0.045, { a: 0.004 });
    nz(x, 0, 0.1, 0.016, 'bandpass', 1400, 800, 1, { a: 0.004, lp: 3000 });
  };
  SFX.reel_tick = function (x) {
    nz(x, 0, 0.014, 0.007, 'bandpass', 2500, 0, 1.5, { a: 0.003, lp: 4000 });
    tone(x, 0, 'sine', 1800, 0, 0.014, 0.0035, { a: 0.003 });
  };
  SFX.fish_catch = function (x) {
    SFX.splash(x);
    arp(x, 0.15, 'harp', [64, 69, 76], 0.08, 0.42, { gain: 0.42 });
    inst(x, 0.4, 'celesta', 84, 0.36, 0.5, { gain: 0.32, wet: 0.4 });
  };
  SFX.fish_escape = function (x) {
    SFX.splash(x);
    arp(x, 0.15, 'celesta', [79, 74, 71], 0.14, 0.3, { gain: 0.3, wet: 0.4 });
  };
  /* home & body */
  SFX.sleep = function (x) {
    arp(x, 0, 'celesta', [84, 79, 76, 72], 0.28, 0.28, { gain: 0.32, wet: 0.6 });
    inst(x, 1.1, 'harp', 60, 0.3, 1, { gain: 0.32, ring: 1.4 });
  };
  SFX.eat = function (x) {
    for (var i = 0; i < 3; i++) nz(x, i * 0.13, 0.06, 0.028, 'bandpass', rr(1200, 2000), rr(800, 1100), 1.2, { a: 0.006, lp: 3000 });
  };
  SFX.drink_potion = function (x) {
    for (var i = 0; i < 3; i++) tone(x, i * 0.18, 'sine', 300, 150, 0.1, 0.04, { a: 0.01, lp: 700 });
    bell(x, 0.6, 86, 0.01, 0.4, { idx: 1, wet: 0.5 });
    bell(x, 0.68, 93, 0.008, 0.4, { idx: 1, wet: 0.5 });
  };
  SFX.heart_up = function (x) {
    inst(x, 0, 'harp', 64, 0.38, 1, { gain: 0.32 });
    inst(x, 0.02, 'celesta', 76, 0.38, 0.5, { gain: 0.36, wet: 0.4 });
    inst(x, 0.2, 'celesta', 85, 0.4, 0.5, { gain: 0.36, wet: 0.4 });
  };
  SFX.level_up = function (x) {
    arp(x, 0, 'harp', [62, 66, 69, 74], 0.07, 0.42, { gain: 0.42 });
    arp(x, 0.28, 'celesta', [78, 81, 86], 0.08, 0.42, { gain: 0.42, wet: 0.5 });
    nz(x, 0.25, 0.7, 0.004, 'bandpass', 3500, 4200, 1, { a: 0.2, wet: 0.5 });
  };
  SFX.quest_complete = function (x) {
    inst(x, 0, 'harp', 60, 0.42, 1, { gain: 0.42 });
    arp(x, 0.02, 'celesta', [72, 76, 79, 84], 0.05, 0.4, { gain: 0.42, wet: 0.5 });
  };
  SFX.chest_open = function (x) {
    creak(x, 0, 120, 160, 140, 0.35, 0.03);
    nz(x, 0.3, 0.03, 0.014, 'bandpass', 1500, 0, 1.2, { a: 0.004, lp: 2500 });
    arp(x, 0.35, 'celesta', [84, 88, 91, 96], 0.06, 0.36, { gain: 0.38, wet: 0.5 });
  };
  SFX.altar_offer = function (x) {
    bell(x, 0, 45, 0.04, 2.2, { ratio: 1.41, idx: 1.2, idec: 0.3, wet: 0.8 });
    bell(x, 0.02, 57, 0.018, 1.8, { ratio: 2.0, idx: 0.8, idec: 0.2, wet: 0.8 });
    nz(x, 0.1, 1.5, 0.004, 'bandpass', 3500, 4200, 1, { a: 0.5, wet: 0.7 });
  };
  SFX.cat_meow = function (x) {
    formantVoice(x, 0, 'sawtooth', [[0, 560], [0.12, 780], [0.38, 470]], [[0, 450], [0.15, 950], [0.38, 560]], [[0, 1900], [0.15, 1500], [0.38, 1050]],
      0.42, 0.03, { a: 0.04, vib: [6, 15], q1: 4, q2: 6, g2: 0.5, lp: 3200, body: 0.12 });
  };
  SFX.fairy_chime = function (x) {
    var pent = [79, 81, 84, 86, 88, 91, 93], n = ri(3, 4), base = ri(0, 2);
    for (var i = 0; i < n; i++) inst(x, i * rr(0.06, 0.1), 'celesta', pent[Math.min(pent.length - 1, base + i + ri(0, 1))], 0.36, 0.5, { gain: 0.38, wet: 0.6 });
    nz(x, 0, 0.6, 0.004, 'bandpass', 3500, 4200, 1, { a: 0.15, wet: 0.6 });
  };

  /* ---- expansion: cathedral, tavern, shops, encounters, forest critters ---- */
  SFX.pray = function (x) {
    inst(x, 0, 'choir', 62, 0.4, 1.4, { vowel: 'o', att: 0.7, rel: 2.2, gain: 0.5, wet: 1.0 });
    inst(x, 0.15, 'choir', 69, 0.36, 1.3, { vowel: 'o', att: 0.8, rel: 2.2, gain: 0.42, wet: 1.0 });
    inst(x, 0.3, 'choir', 74, 0.3, 1.1, { vowel: 'a', att: 0.9, rel: 2.4, gain: 0.32, wet: 1.0 });
    bigBell(x, 0.7, 57, 0.012, 2.2, 1.2);
  };
  SFX.bell_toll = function (x) { bigBell(x, 0, 45, 0.03, 4.5, 1.3); };
  SFX.fizz_drink = function (x) {
    nz(x, 0, 1.0, 0.008, 'bandpass', 3200, 2600, 1.2, { a: 0.05, sus: 0.5, lp: 4500 });
    var b = [], tt = rr(0, 0.04);
    while (tt < 0.95) { b.push([tt, rr(0.0025, 0.006), rr(1800, 3400)]); tt += rr(0.03, 0.08); }
    pulses(x, 0, b, { osc: 'sine', rise: 1.3, lp: 4500, dur: 0.02 });
    inst(x, 0.45, 'celesta', 84, 0.32, 0.5, { gain: 0.3, wet: 0.5 });
    inst(x, 0.56, 'celesta', 91, 0.28, 0.5, { gain: 0.26, wet: 0.5 });
  };
  SFX.door_creak = function (x) {
    creak(x, 0, 95, 125, 100, 0.75, 0.03);
    tone(x, 0.72, 'sine', 120, 80, 0.12, 0.028, { a: 0.006 });
  };
  SFX.shop_bell = function (x) {
    var n = ri(2, 3);
    for (var i = 0; i < n; i++) bell(x, i * rr(0.07, 0.11), 93 + rr(-0.3, 0.3), 0.011 * (1 - i * 0.25), 0.35, { ratio: 2.76, idx: 0.9, idec: 0.04, wet: 0.35 });
  };
  SFX.page_turn = function (x) {
    nz(x, 0, 0.2, 0.012, 'bandpass', 1400, 3200, 0.9, { a: 0.04, gl: 0.16, lp: 4500 });
    nz(x, 0.15, 0.06, 0.008, 'lowpass', 700, 400, 0.7, { buf: 'pink', a: 0.006 });
  };
  SFX.cloth_rustle = function (x) {
    for (var i = 0; i < 3; i++) nz(x, i * rr(0.07, 0.12), rr(0.12, 0.2), rr(0.008, 0.013), 'bandpass', rr(1100, 1900), rr(900, 1400), 0.8, { buf: 'pink', a: 0.03, lp: 3200 });
  };
  SFX.mimic_snap = function (x) {
    tone(x, 0, 'triangle', 230, 140, 0.09, 0.04, { a: 0.004, lp: 900 });
    nz(x, 0.02, 0.05, 0.03, 'bandpass', 900, 600, 1.2, { a: 0.004, lp: 2500 });
    tone(x, 0.02, 'sine', 150, 90, 0.1, 0.055, { a: 0.004 });
    for (var i = 0; i < 3; i++) nz(x, 0.1 + i * 0.045, 0.02, 0.008, 'bandpass', 1600, 0, 1.5, { a: 0.003, lp: 3000 });
  };
  SFX.mystery_chime = function (x) {
    nz(x, 0, 1.0, 0.004, 'bandpass', 2600, 3400, 1.5, { a: 0.35, lp: 4500, wet: 0.6 });
    arp(x, 0.05, 'celesta', [79, 83, 85, 90], 0.16, 0.3, { gain: 0.28, wet: 0.7 });
  };
  SFX.coin_flip = function (x) {
    nz(x, 0, 0.06, 0.004, 'bandpass', 2200, 2800, 1.2, { a: 0.02, lp: 4000 });
    bell(x, 0.05, 91 + rr(-0.5, 0.5), 0.007, 0.12, { ratio: 2.4, idx: 0.8, wet: 0.2 });
  };
  SFX.dice_roll = function (x) {
    var tt = 0, gap = 0.1, amp = 0.02, clack = [], knock = [];
    for (var i = 0; i < 8 && amp > 0.003; i++) {
      clack.push([tt, amp, rr(900, 1600)]); knock.push([tt, amp * 0.5, rr(500, 800)]);
      tt += Math.max(0.04, gap * rr(0.8, 1.2)); gap *= 0.82; amp *= 0.8;
    }
    pulses(x, 0, clack, { q: 1.6, lp: 3000, dur: 0.03 });
    pulses(x, 0, knock, { osc: 'triangle', lp: 1500, dur: 0.03 });
  };
  SFX.dig = function (x) {
    nz(x, 0, 0.16, 0.045, 'lowpass', 900, 350, 0.7, { buf: 'brown', a: 0.006 });
    nz(x, 0, 0.1, 0.012, 'bandpass', 1300, 800, 1, { buf: 'pink', a: 0.005, lp: 2500 });
    tone(x, 0, 'sine', 110, 60, 0.12, 0.04, { a: 0.006 });
    for (var i = 0; i < 4; i++) nz(x, 0.18 + i * rr(0.04, 0.07), 0.04, 0.005, 'bandpass', rr(900, 1800), 0, 1.2, { buf: 'pink', a: 0.004, lp: 2500 });
  };
  SFX.treasure = function (x) {
    creak(x, 0, 110, 150, 130, 0.35, 0.022);
    tone(x, 0.3, 'sine', 140, 90, 0.08, 0.028, { a: 0.005 });
    arp(x, 0.38, 'celesta', [79, 83, 86, 91], 0.07, 0.36, { gain: 0.36, wet: 0.5 });
    nz(x, 0.4, 0.8, 0.004, 'bandpass', 3500, 4200, 1.2, { a: 0.2, lp: 4800, wet: 0.5 });
  };
  SFX.animal_purr = function (x) {
    var t = x.t, v = sfxVoice(x, t, 0.05), s = NSRC(BUF.brown, true), lp = v.n(BQ('lowpass', 320 * x.p, -2));
    var am = v.n(G(0.5)), g = v.n(G(0)), lfo = O('sine', rr(20, 25)), lg = v.n(G(0.5));
    chain(s, lp, am, g, v.out); chain(lfo, lg, am.gain);
    var A0 = 0.035 * x.v * K_NOISE;
    sv(g.gain, 0, t); lr(g.gain, A0, t + 0.45); lr(g.gain, A0 * 0.7, t + 0.6); lr(g.gain, A0 * 0.9, t + 0.9); lr(g.gain, 0, t + 1.5);
    v.src(s, t, t + 1.55, rr(0, 4)); v.src(lfo, t, t + 1.55);
  };
  SFX.owl_hoot_soft = function (x) {
    tone(x, 0, 'sine', 400, 382, 0.4, 0.022, { a: 0.06, lp: 900, sus: 0.7, wet: 0.4 });
    tone(x, 0.55, 'sine', 396, 372, 0.5, 0.019, { a: 0.07, lp: 900, sus: 0.7, wet: 0.4 });
  };
  SFX.frog_croak = function (x) {
    for (var r = 0; r < 2; r++) {
      var t = x.t + r * 0.22, v = sfxVoice(x, t, 0.1), o = O('triangle', 190 * x.p * (r ? 1.12 : 1));
      var am = v.n(G(0.5)), lfo = O('sine', 28), lg = v.n(G(0.5)), bp = v.n(BQ('bandpass', 520, 2)), lp = v.n(BQ('lowpass', 1200, -3)), g = v.n(G(0));
      chain(o, am, bp, lp, g, v.out); chain(lfo, lg, am.gain);
      var A0 = 0.04 * x.v * K_TONE, d = r ? 0.12 : 0.15;
      sv(g.gain, 0, t); lr(g.gain, A0, t + 0.01); lr(g.gain, A0 * 0.8, t + d - 0.03); lr(g.gain, 0, t + d);
      v.src(o, t, t + d + 0.02); v.src(lfo, t, t + d + 0.02);
    }
  };
  SFX.beetle_click = function (x) {
    var n = ri(2, 4), tt = 0, list = [];
    for (var i = 0; i < n; i++) { list.push([tt, 0.008, rr(2600, 3400)]); tt += rr(0.03, 0.05); }
    pulses(x, 0, list, { q: 2, lp: 4500, dur: 0.016 });
  };
  SFX.web_snap = function (x) {
    nz(x, 0, 0.12, 0.02, 'bandpass', 2400, 900, 1.4, { a: 0.004, lp: 3500 });
    tone(x, 0.01, 'sine', 320, 190, 0.16, 0.026, { a: 0.005, vib: [14, 40] });
  };
  SFX.wisp_chime = function (x) {
    inst(x, 0, 'glass', 84, 0.4, 0.9, { gain: 0.5, att: 0.12, rel: 1.0, wet: 0.8 });
    inst(x, 0.28, 'glass', 85, 0.32, 0.8, { gain: 0.4, att: 0.15, rel: 1.1, wet: 0.8 });
  };
  SFX.wolf_howl_far = function (x) {
    formantVoice(x, 0, 'triangle', [[0, 300], [0.5, 520], [1.6, 500], [2.2, 340]], [[0, 400], [0.6, 700], [2.2, 450]], [[0, 900], [0.6, 1150], [2.2, 850]],
      2.3, 0.022, { a: 0.35, vib: [5, 25], lp: 1500, wet: 1.0, q1: 4, q2: 6 });
  };
  SFX.critter_squeak = function (x) {
    tone(x, 0, 'sine', 950, 1450, 0.09, 0.016, { a: 0.006, gl: 0.05, lp: 3000 });
    tone(x, 0.11, 'sine', 1300, 1100, 0.07, 0.01, { a: 0.006, lp: 3000 });
  };
  /* alias: the game also calls sfx('discovery') */
  SFX.discovery = function (x) {
    arp(x, 0, 'celesta', [74, 78, 81, 85], 0.1, 0.32, { gain: 0.32, wet: 0.6 });
    nz(x, 0, 0.8, 0.004, 'bandpass', 2600, 3400, 1.5, { a: 0.3, lp: 4500, wet: 0.6 });
  };

  /* Final per-sound loudness trims in dB, measured offline against the house targets. */
  var SFX_DB = {
    hoe: -2, water_pour: 5, plant_seed: 1.5, harvest: 2, pickup: 1, coin: 3, buy: 2, sell: 3,
    wand_cast: 2, spider_skitter: 4, wizard_cast: -1.5, mandrake_scream: 3, door_open: 2.5, ladder_descend: 3,
    teleport: -1.5, brew_done: -2, reel_tick: 5, eat: 2.5, level_up: -2.5, quest_complete: -2, cat_meow: -1.5,
    fairy_chime: -1.5, gem_found: -1.5, bell_toll: -5, fizz_drink: -3, door_creak: 3, shop_bell: 4, page_turn: 5,
    cloth_rustle: 9.5, coin_flip: 3, dice_roll: 5, treasure: -1, animal_purr: -2.5, owl_hoot_soft: 1.5, frog_croak: 8,
    beetle_click: 8.5, web_snap: 2, wisp_chime: 3, wolf_howl_far: -2, critter_squeak: 5.5, cast_verdance: -1,
    cast_blink: 6.5, cast_frost: 6, fam_owl: 3.5, fam_fox: -1.5, fam_moth: 11, furniture_pickup: 3.5, applause: 9.5,
    dance_step: 3.5
  };

  /* Many short pulses on ONE voice (claps, ticks, grains, bubbles). list: [[dt, amp, freq], ...]
     with non-overlapping pulses; o: buf, q, lp, dur, wet, osc (tonal pulses with that waveform), rise */
  function pulses(x, at, list, o) {
    o = o || {};
    if (!list.length) return;
    var t = x.t + at, v = sfxVoice(x, t, F(o.wet, 0)), d = F(o.dur, 0.02), end = t, i, src, fp;
    var lp = v.n(BQ('lowpass', F(o.lp, 4000), -2)), g = v.n(G(0)), K = x.v * (o.osc ? K_TONE : K_NOISE);
    if (o.osc) { src = O(o.osc, list[0][2] * x.p); fp = src.frequency; src.connect(lp); }
    else {
      src = NSRC(BUF[o.buf || 'white'], true);
      var bp = v.n(BQ('bandpass', list[0][2] * x.p, F(o.q, 1.2)));
      chain(src, bp, lp); fp = bp.frequency;
    }
    chain(lp, g, v.out);
    sv(g.gain, 0, t);
    for (i = 0; i < list.length; i++) {
      var tp = t + list[i][0], f = clamp(list[i][2] * x.p, 40, 12000);
      sv(fp, f, tp);
      if (o.rise) er(fp, f * o.rise, tp + d * 0.7);
      lr(g.gain, 0, tp); lr(g.gain, list[i][1] * K, tp + 0.003); er(g.gain, 0.0001, tp + 0.003 + d);
      end = Math.max(end, tp + d + 0.01);
    }
    v.src(src, t, end + 0.03, o.osc ? undefined : rr(0, 2));
  }

  /* ---- spells ---- */
  SFX.cast_lumen = function (x) {
    nz(x, 0, 0.9, 0.006, 'bandpass', 1800, 3600, 1.2, { a: 0.25, gl: 0.6, lp: 4500, wet: 0.6 });
    inst(x, 0, 'glass', 81, 0.35, 0.6, { gain: 0.45, att: 0.18, rel: 1.0, wet: 0.8, beat: 1.5 });
    arp(x, 0.12, 'celesta', [76, 81, 88], 0.09, 0.32, { gain: 0.3, wet: 0.6 });
  };
  SFX.cast_verdance = function (x) {
    for (var i = 0; i < 3; i++) nz(x, i * 0.14, 0.3, 0.008 + i * 0.003, 'bandpass', rr(1800, 2600), rr(1200, 1800), 0.8, { a: 0.08, lp: 3500 });
    tone(x, 0, 'triangle', 196, 392, 0.7, 0.016, { a: 0.15, lp: 900, sus: 0.6 });
    arp(x, 0.2, 'harp', [65, 69, 72, 76, 79], 0.07, 0.34, { gain: 0.3, wet: 0.4 });
  };
  SFX.cast_blink = function (x) {
    nz(x, 0, 0.14, 0.025, 'bandpass', 800, 3200, 1.3, { a: 0.012, gl: 0.11, lp: 4000 });
    tone(x, 0.11, 'sine', 600, 1100, 0.05, 0.02, { a: 0.005, gl: 0.03, lp: 2500 });
  };
  SFX.cast_frost = function (x) {
    nz(x, 0, 0.28, 0.02, 'bandpass', 600, 2200, 1.2, { a: 0.03, gl: 0.2, lp: 4000 });
    bell(x, 0.05, 91, 0.009, 0.25, { ratio: 2.76, idx: 1.0, wet: 0.4 });
    bell(x, 0.09, 96, 0.006, 0.2, { ratio: 3.9, idx: 0.8, wet: 0.4 });
    bell(x, 0.13, 93, 0.005, 0.2, { ratio: 2.76, idx: 0.8, wet: 0.4 });
  };
  SFX.frost_hit = function (x) {
    nz(x, 0, 0.12, 0.025, 'lowpass', 2000, 500, 0, { a: 0.004 });
    tone(x, 0, 'sine', 150, 90, 0.09, 0.045, { a: 0.004 });
    bell(x, 0.01, 93, 0.007, 0.18, { ratio: 2.76, idx: 0.9, wet: 0.3 });
    bell(x, 0.05, 98, 0.0045, 0.15, { ratio: 3.9, idx: 0.7, wet: 0.3 });
  };
  /* ---- familiars ---- */
  SFX.fam_owl = function (x) {
    tone(x, 0, 'sine', 450, 430, 0.22, 0.018, { a: 0.04, lp: 1000, sus: 0.6, wet: 0.3 });
    tone(x, 0.3, 'sine', 445, 420, 0.3, 0.016, { a: 0.05, lp: 1000, sus: 0.6, wet: 0.3 });
  };
  SFX.fam_fox = function (x) {
    formantVoice(x, 0, 'triangle', [[0, 700], [0.05, 980], [0.13, 760]], [[0, 800], [0.06, 1000], [0.13, 700]], [[0, 1600], [0.06, 1900], [0.13, 1500]],
      0.15, 0.02, { a: 0.008, lp: 3000, q1: 4, q2: 6, body: 0.15 });
  };
  SFX.fam_moth = function (x) {
    var list = [], n = ri(7, 10), tt = 0;
    for (var i = 0; i < n; i++) { list.push([tt, 0.011 * Math.sin(Math.PI * (i + 0.5) / n), rr(500, 800)]); tt += rr(0.05, 0.065); }
    pulses(x, 0, list, { buf: 'pink', q: 0.8, lp: 1500, dur: 0.035 });
  };
  SFX.fam_happy = function (x) {
    inst(x, 0.02, 'harp', 60, 0.3, 1, { gain: 0.24 });
    inst(x, 0, 'celesta', 84, 0.34, 0.5, { gain: 0.28, wet: 0.5 });
    inst(x, 0.12, 'celesta', 88, 0.36, 0.5, { gain: 0.28, wet: 0.5 });
  };
  /* ---- cottage & festival ---- */
  SFX.furniture_place = function (x) {
    tone(x, 0, 'sine', 130, 85, 0.12, 0.045, { a: 0.006 });
    nz(x, 0, 0.06, 0.022, 'bandpass', 700, 500, 1.3, { a: 0.005, lp: 2000 });
    tone(x, 0.07, 'sine', 115, 80, 0.08, 0.016, { a: 0.006 });
  };
  SFX.furniture_pickup = function (x) {
    nz(x, 0, 0.08, 0.01, 'bandpass', 900, 1300, 1.1, { a: 0.01, lp: 2500 });
    tone(x, 0, 'sine', 150, 210, 0.08, 0.022, { a: 0.006, lp: 900 });
    nz(x, 0.04, 0.12, 0.005, 'bandpass', 1600, 1200, 0.8, { buf: 'pink', a: 0.03, lp: 3000 });
  };
  SFX.lantern_release = function (x) {
    nz(x, 0, 1.0, 0.01, 'bandpass', 400, 1300, 1, { a: 0.25, gl: 0.9, lp: 2500, wet: 0.4 });
    inst(x, 0.28, 'harp', 62, 0.32, 1, { gain: 0.28, wet: 0.4 });
    arp(x, 0.3, 'celesta', [74, 78, 81, 88], 0.14, 0.3, { gain: 0.3, wet: 0.6 });
  };
  SFX.wisp_catch = function (x) {
    tone(x, 0, 'sine', 500, 1100, 0.07, 0.026, { a: 0.006, gl: 0.04, lp: 2500 });
    inst(x, 0.03, 'celesta', 88 + pickR([0, 2, 4, 7]), 0.3, 0.4, { gain: 0.24, wet: 0.4 });
  };
  SFX.applause = function (x) {
    for (var k = 0; k < 4; k++) {
      var list = [], tt = rr(0, 0.12);
      while (tt < 1.5) {
        var env = Math.sin(Math.PI * Math.min(1, tt / 1.6));
        list.push([tt, 0.01 * (0.35 + env) * rr(0.6, 1), rr(1100, 2200)]);
        tt += rr(0.07, 0.15);
      }
      pulses(x, 0, list, { q: 1.1, lp: 3500, dur: 0.025, wet: 0.25 });
    }
  };
  SFX.dance_step = function (x) {
    nz(x, 0, 0.05, 0.01, 'bandpass', 900, 700, 1, { a: 0.004, lp: 2500 });
    tone(x, 0, 'sine', 160, 110, 0.05, 0.012, { a: 0.004 });
    nz(x, 0.02, 0.08, 0.004, 'bandpass', 2000, 1500, 0.8, { buf: 'pink', a: 0.02, lp: 3500 });
  };

  /* ------------------------------------------------------------------ */
  /*  Jingles: short stingers with the music instruments (sfx volume),   */
  /*  each returns its length so the music can be ducked under it.       */
  /* ------------------------------------------------------------------ */
  function jn(t, name, m, vel, dur, o) { INST[name](t, m, vel, dur, o || {}, dJingle()); }
  function jpad(t, notes, dur, o) { for (var i = 0; i < notes.length; i++) jn(t + i * 0.02, o.inst || 'strings', notes[i], F(o.vel, 0.5), dur, o); }
  var JINGLES = {
    new_day: function (t) {
      var h = [50, 57, 62, 66, 69, 73, 76];
      for (var i = 0; i < h.length; i++) jn(t + i * 0.11, 'harp', h[i], 0.42 + i * 0.02, 1, { gain: 1.2, ring: 1.2 });
      jpad(t, [62, 66, 69, 76], 1.6, { att: 0.6, rel: 2, gain: 1.1, cut: 1400 });
      jn(t + 0.78, 'celesta', 81, 0.45, 1, { gain: 1.1, wet: 0.4 });
      jn(t + 1.0, 'celesta', 78, 0.36, 1, { gain: 1.0, wet: 0.4 });
      return 3.0;
    },
    potion_brewed: function (t) {
      var a = [67, 71, 74, 78, 81];
      for (var i = 0; i < a.length; i++) jn(t + i * 0.07, 'celesta', a[i], 0.45, 1, { gain: 1.2, wet: 0.4 });
      jn(t + 0.45, 'celesta', 86, 0.4, 1, { gain: 1.0, wet: 0.5 });
      jpad(t, [55, 62, 71], 1.0, { att: 0.3, rel: 1.5, gain: 1.0 });
      jn(t, 'harp', 43, 0.5, 1, { gain: 1.1 });
      return 2.2;
    },
    quest_complete: function (t) {
      var P = { gain: 0.7 };
      jn(t, 'piano', 46, 0.45, 0.6, P); jn(t + 0.01, 'piano', 62, 0.4, 0.6, P); jn(t + 0.02, 'piano', 65, 0.4, 0.6, P); jn(t + 0.03, 'piano', 70, 0.4, 0.6, P);
      jn(t + 0.55, 'piano', 48, 0.45, 0.6, P); jn(t + 0.56, 'piano', 64, 0.42, 0.6, P); jn(t + 0.57, 'piano', 67, 0.42, 0.6, P); jn(t + 0.58, 'piano', 72, 0.42, 0.6, P);
      jn(t + 1.1, 'piano', 41, 0.5, 2.2, P); jn(t + 1.12, 'piano', 65, 0.45, 2.2, P); jn(t + 1.14, 'piano', 69, 0.45, 2.2, P); jn(t + 1.16, 'piano', 72, 0.45, 2.2, P);
      jn(t, 'celesta', 81, 0.45, 1, { gain: 1.1 }); jn(t + 0.55, 'celesta', 79, 0.45, 1, { gain: 1.1 });
      jn(t + 1.1, 'celesta', 77, 0.48, 1, { gain: 1.1 }); jn(t + 1.4, 'celesta', 84, 0.42, 1, { gain: 1.0, wet: 0.5 });
      jpad(t + 1.1, [53, 60, 65, 69], 1.6, { att: 0.25, rel: 2, gain: 1.0 });
      return 3.2;
    },
    heart_up: function (t) {
      jn(t, 'harp', 57, 0.45, 1, { gain: 1.1 });
      jn(t + 0.02, 'celesta', 76, 0.45, 1, { gain: 1.1, wet: 0.4 });
      jn(t + 0.24, 'celesta', 85, 0.48, 1, { gain: 1.1, wet: 0.4 });
      jpad(t, [57, 64, 69, 73], 1.2, { att: 0.4, rel: 1.8, gain: 1.0 });
      return 2.0;
    },
    discovery: function (t) {
      jpad(t, [62, 69], 2.0, { inst: 'choir', vowel: 'a', att: 0.8, rel: 2.5, gain: 1.6, vel: 0.5 });
      jpad(t, [50, 57, 61, 66], 2.2, { att: 0.8, rel: 2.5, gain: 1.0 });
      var a = [74, 76, 78, 80, 81, 85];
      for (var i = 0; i < a.length; i++) jn(t + 0.4 + i * 0.12, 'celesta', a[i], 0.4, 1, { gain: 1.0, wet: 0.5 });
      return 3.6;
    },
    level_down: function (t) {
      jn(t, 'piano', 38, 0.55, 2.5, { gain: 1.4, bright: 0.7 });
      jn(t + 0.02, 'piano', 44, 0.45, 2.5, { gain: 1.3, bright: 0.7 });
      jn(t, 'cello', 38, 0.5, 2.0, { att: 0.8, rel: 1.6, gain: 1.4 });
      jn(t + 0.3, 'cello', 39, 0.4, 1.8, { att: 0.9, rel: 1.6, gain: 1.2 });
      jpad(t + 0.2, [50, 51], 2.0, { inst: 'choir', vowel: 'o', att: 1, rel: 2, gain: 1.6, vel: 0.45 });
      jn(t + 1.6, 'piano', 26, 0.5, 2.5, { gain: 1.4, bright: 0.6 });
      return 3.6;
    },
    rune_gate: function (t) {
      var f = [50, 57, 64, 71];
      for (var i = 0; i < f.length; i++) jn(t + i * 0.12, 'harp', f[i], 0.45, 1, { gain: 1.2 });
      jn(t + 0.5, 'celesta', 74, 0.42, 1, { gain: 1.0, wet: 0.4 });
      jn(t + 0.62, 'celesta', 81, 0.42, 1, { gain: 1.0, wet: 0.4 });
      jpad(t, [50, 57, 64, 69], 1.4, { att: 0.4, rel: 2, gain: 1.0 });
      return 2.6;
    },
    altar_restored: function (t) {
      jpad(t, [62, 66, 69, 76], 3.0, { inst: 'choir', vowel: 'a', att: 1, rel: 3, gain: 1.3, vel: 0.55 });
      jpad(t, [50, 57, 62, 66, 69], 3.0, { att: 0.8, rel: 3, gain: 0.9 });
      jn(t, 'cello', 38, 0.5, 3, { att: 0.8, rel: 2.5, gain: 1.0 });
      jn(t, 'piano', 38, 0.5, 3, { gain: 1.0 }); jn(t + 0.02, 'piano', 45, 0.45, 3, { gain: 1.0 });
      var a = [74, 78, 81, 86, 90];
      for (var i = 0; i < a.length; i++) jn(t + 0.6 + i * 0.15, 'celesta', a[i], 0.42, 1, { gain: 1.0, wet: 0.5 });
      return 4.5;
    },
    level_up: function (t) {
      var a = [62, 66, 69, 74, 78];
      for (var i = 0; i < a.length; i++) jn(t + i * 0.09, 'harp', a[i], 0.42, 1, { gain: 1.0 });
      jn(t + 0.5, 'celesta', 81, 0.4, 1, { gain: 0.9, wet: 0.4 });
      jpad(t, [62, 66, 69], 1.4, { att: 0.4, rel: 1.8, gain: 0.8 });
      return 2.4;
    },
    death: function (t) {
      var m = [69, 65, 64, 62], at = [0, 0.5, 0.95, 1.5];
      for (var i = 0; i < m.length; i++) jn(t + at[i], 'piano', m[i], 0.48 - i * 0.04, i === 3 ? 2.5 : 0.6, { gain: 1.3 });
      jn(t, 'piano', 38, 0.4, 3, { gain: 1.3 });
      jpad(t, [50, 53, 57], 2.4, { att: 0.6, rel: 2.5, gain: 1.0, cut: 900 });
      return 3.6;
    }
  };
  function jingle(name) {
    if (!ctx || !unlocked || !JINGLES.hasOwnProperty(name)) return;
    if (ctx.state && ctx.state !== 'running') return;
    var t = now();
    for (var i = 0; i < jingleVoices.length; i++) jingleVoices[i].kill(t, 0.15);
    jingleVoices.length = 0;
    var d = JINGLES[name](t + 0.04);
    duck(0.65, F(d, 2.5));
  }

  /* ------------------------------------------------------------------ */
  /*  Dialogue voice blips                                               */
  /* ------------------------------------------------------------------ */
  var lastBlip = 0, BLIP_STEPS = [1, 1, 1.06, 0.95, 1.12, 0.9];
  var BLIPS = {
    soft: function (x) { tone(x, 0, 'sine', 440, 410, 0.045, 0.013, { a: 0.005 }); tone(x, 0, 'sine', 880, 0, 0.02, 0.0025, { a: 0.005 }); },
    bright: function (x) { tone(x, 0, 'triangle', 620, 600, 0.035, 0.045, { a: 0.004, bp: 1800, q: 0.8 }); },
    deep: function (x) { tone(x, 0, 'sine', 190, 175, 0.05, 0.014, { a: 0.005 }); tone(x, 0, 'triangle', 380, 0, 0.03, 0.0045, { a: 0.004, lp: 900 }); },
    raspy: function (x) { tone(x, 0, 'triangle', 300, 280, 0.04, 0.042, { a: 0.004, bp: 1100, q: 1.5 }); nz(x, 0, 0.035, 0.011, 'bandpass', 1800, 0, 1.5, { a: 0.004, lp: 3500 }); },
    squeaky: function (x) { tone(x, 0, 'sine', 900, 1150, 0.03, 0.014, { a: 0.004 }); },
    airy: function (x) { nz(x, 0, 0.045, 0.032, 'bandpass', 1500, 1700, 5, { a: 0.006 }); tone(x, 0, 'sine', 750, 0, 0.04, 0.008, { a: 0.005 }); }
  };
  function blip(voice) {
    if (!ctx || !unlocked || (ctx.state && ctx.state !== 'running')) return;
    voice = voice || {};
    var t = now();
    if (t - lastBlip < 0.025 && t >= lastBlip) return;
    lastBlip = t;
    var fn = BLIPS.hasOwnProperty(voice.timbre) ? BLIPS[voice.timbre] : BLIPS.soft;
    fn({ t: t + 0.005, v: 1, p: clamp(F(voice.pitch, 1), 0.5, 2) * rr(0.96, 1.04) * pickR(BLIP_STEPS), pan: 0 });
  }

  /* ------------------------------------------------------------------ */
  /*  Volumes, duck, pause, sfx entry point                              */
  /* ------------------------------------------------------------------ */
  function applyVolumes() {
    if (!ctx || !N) return;
    var t = now();
    glide(N.master.gain, vol.master, 0.03, t);
    glide(M.vol.gain, vol.music, 0.03, t);
    glide(S.vol.gain, vol.sfx, 0.03, t); glide(S.wvol.gain, vol.sfx, 0.03, t);
    glide(A.vol.gain, vol.ambience, 0.03, t); glide(A.wvol.gain, vol.ambience, 0.03, t);
    glide(N.mute.gain, muted ? 0 : 1, 0.03, t);
    updateLevels();
  }
  function setVol(key, v) {
    if (!isNum(v)) return;
    vol[key] = clamp(v, 0, 1);
    applyVolumes();
  }
  var duckUntil = 0, duckDepth = 0;
  function duck(amount, seconds) {
    if (!ctx || !M) return;
    var a = isNum(amount) ? clamp(amount, 0, 1) : 0.5, s = isNum(seconds) ? clamp(seconds, 0.05, 60) : 1.5, t = now();
    var target = Math.max(0.0001, 1 - a);
    if (t < duckUntil) target = Math.min(target, 1 - duckDepth);
    var end = Math.max(t + s, duckUntil);
    var p = M.duck.gain;
    hold(p, t); st(p, target, t, 0.06); st(p, 1, end, 0.45);
    duckUntil = end; duckDepth = 1 - target;
  }
  var lastSfx = {};
  function sfx(name, opts) {
    if (!ctx || !unlocked || !SFX.hasOwnProperty(name) || typeof SFX[name] !== 'function') return;
    if (ctx.state && ctx.state !== 'running') return;
    var t = now(), last = lastSfx[name];
    if (isNum(last) && t >= last && t - last < 0.03) return;
    lastSfx[name] = t;
    opts = (opts && typeof opts === 'object') ? opts : {};
    var trim = SFX_DB.hasOwnProperty(name) ? Math.pow(10, SFX_DB[name] / 20) : 1;
    SFX[name]({ t: t + 0.01, v: clamp(F(opts.volume, 1), 0, 2) * trim, p: clamp(F(opts.pitch, 1), 0.25, 4) * rr(0.96, 1.04), pan: clamp(F(opts.pan, 0), -1, 1) });
  }

  /* ------------------------------------------------------------------ */
  /*  Unlock + public API                                                */
  /* ------------------------------------------------------------------ */
  function unlock() {
    if (broken || !AC) return false;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { ctx = null; broken = true; return false; }
      try { buildGraph(); } catch (e2) {
        broken = true;
        try { if (ctx.close) ctx.close(); } catch (e3) {}
        ctx = null; return false;
      }
      try {
        var b = ctx.createBuffer(1, 1, ctx.sampleRate), s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination);
        s.onended = function () { try { s.disconnect(); } catch (e4) {} };
        s.start(0); s.stop(ctx.currentTime + 0.05);
      } catch (e5) {}
      if (DOC && DOC.addEventListener) {
        DOC.addEventListener('pointerdown', onGesture, true);
        DOC.addEventListener('touchend', onGesture, true);
        DOC.addEventListener('keydown', onGesture, true);
      }
      hidden = !!(DOC && DOC.hidden);
    }
    resumeCtx();
    if (!unlocked) {
      unlocked = true;
      applyVolumes();
      amb.lastT = now();
      applyZone(null, null, true);
      startTimer();
    }
    return true;
  }
  function setZone(zone, opts) {
    var prevZ = dir.zone, prevO = dir.opts;
    dir.zone = ZONES.hasOwnProperty(zone) ? zone : 'none';
    dir.opts = normOpts(opts);
    if (ctx && unlocked) applyZone(prevZ, prevO, false);
  }
  function debugState() {
    var t = now(), nxt = null;
    if (unlocked && dir.plan) {
      if (dir.phase === 'wait' || dir.phase === 'rest') nxt = Math.max(0, dir.nextAt - t);
      else if (dir.phase === 'play') nxt = 0;
    }
    return {
      zone: dir.zone, playing: dir.perf ? dir.perf.name : null,
      nextPerformanceIn: nxt === null ? null : Math.round(nxt * 10) / 10,
      voices: countAlive(musicVoices),
      unlocked: !!(unlocked && ctx), phase: dir.phase, track: dir.plan ? dir.plan.name : null,
      ambience: amb.key || null, weather: amb.wkey || null, sfxVoices: countAlive(sfxVoices),
      contextState: ctx ? (ctx.state || 'running') : 'none'
    };
  }
  function safe(fn, dflt) {
    return function () {
      try { return fn.apply(null, arguments); } catch (e) { return (typeof dflt === 'function') ? dflt() : dflt; }
    };
  }
  if (DOC && DOC.addEventListener) {
    hidden = !!DOC.hidden;
    DOC.addEventListener('visibilitychange', function () { try { onVisibility(); } catch (e) {} });
  }

  W.AudioEngine = {
    unlock: safe(unlock, false),
    isUnlocked: function () { return !!(unlocked && ctx); },
    setZone: safe(setZone),
    sfx: safe(sfx),
    jingle: safe(jingle),
    blip: safe(blip),
    setMasterVolume: safe(function (v) { setVol('master', v); }),
    setMusicVolume: safe(function (v) { setVol('music', v); }),
    setSfxVolume: safe(function (v) { setVol('sfx', v); }),
    setAmbienceVolume: safe(function (v) { setVol('ambience', v); }),
    getVolumes: function () { return { master: vol.master, music: vol.music, sfx: vol.sfx, ambience: vol.ambience }; },
    setMuted: safe(function (b) { muted = !!b; applyVolumes(); }),
    setPaused: safe(function (b) { paused = !!b; updateLevels(); }),
    duck: safe(duck),
    debugState: safe(debugState, function () { return { zone: dir.zone, playing: null, nextPerformanceIn: null, voices: 0 }; }),
    _debugPlayNow: safe(debugPlayNow, false)
  };
})();
