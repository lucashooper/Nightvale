// Nightvale — saving (each night) to this browser, mirrored to the player's private claude.ai storage when available.
(function () {
  'use strict';
  const G = window.G;
  const KEY = 'nightvale.save.v1', SKEY = 'nightvale.settings.v1';
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  // ---- cloud mirror: one private document per player (data/users/<id>/save)
  const cloud = { ref: null, data: null, ready: false, writing: null, pending: null };
  async function initCloud() {
    try {
      if (!window.claude || typeof window.claude.use !== 'function') return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      cloud.ref = db.doc('data/users/' + id + '/save');
      const snap = await cloud.ref.get();
      if (snap.exists) { const d = snap.data(); if (d && typeof d.json === 'string') cloud.data = JSON.parse(d.json); }
    } catch (e) { cloud.ref = null; }
    finally { cloud.ready = true; G.emit('cloudSave', cloud.data); }
  }
  async function pushCloud(json, savedAt) {
    if (!cloud.ref) return;
    cloud.pending = { json, savedAt };
    if (cloud.writing) return; // the running write picks up the newest pending state when it finishes
    while (cloud.pending) {
      const job = cloud.pending; cloud.pending = null;
      cloud.writing = cloud.ref.set({ json: job.json, savedAt: job.savedAt, v: 1 }).catch((e) => {
        if (e && (e.code === 'invalid_argument' || e.code === 'revoked' || e.code === 'not_granted')) cloud.ref = null; // read-only viewer: browser save only
      });
      await cloud.writing;
      cloud.writing = null;
    }
  }

  function localData() { const s = store.get(KEY); if (!s) return null; try { return JSON.parse(s); } catch (e) { return null; } }

  G.Save = {
    initCloud,
    snapshot() {
      const S = G.S; if (!S) return null;
      S.mapState = G.World.serializeMaps();
      S.savedAt = Date.now();
      return S;
    },
    save() {
      const S = G.Save.snapshot(); if (!S) return false;
      const json = JSON.stringify(S);
      const ok = store.set(KEY, json);
      pushCloud(json, S.savedAt);
      if (!ok && !cloud.ref) G.UI.toast("Couldn't save in this browser (storage is blocked).");
      return ok || !!cloud.ref;
    },
    // newest of the browser save and the cloud save
    load() {
      const a = localData(), b = cloud.data;
      if (a && b) return (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
      return a || b || null;
    },
    has() { return !!(store.get(KEY) || cloud.data); },
    clear() { store.del(KEY); cloud.data = null; if (cloud.ref) cloud.ref.delete().catch(() => {}); },
    saveSettings() {
      const A = window.AudioEngine;
      const v = { zoom: G.R.zoomBias, vol: A && A.getVolumes ? A.getVolumes() : null, prefs: G.prefs };
      store.set(SKEY, JSON.stringify(v));
    },
    loadSettings() {
      const s = store.get(SKEY); if (!s) return;
      try {
        const v = JSON.parse(s);
        if (v.zoom) G.R.setZoom(v.zoom);
        if (v.prefs) {
          // settings saved before the look was chosen pick up the new default (Golden Hour) once
          const p = Object.assign({}, v.prefs); if (p.v !== G.prefs.v) { delete p.look; p.v = G.prefs.v; }
          // and settings saved before the round 4 picks pick up the chosen designs once
          if (p.altsV !== G.prefs.altsV) { delete p.alts; p.altsV = G.prefs.altsV; }
          Object.assign(G.prefs, p);
        }
        const A = window.AudioEngine;
        if (A && v.vol) { A.setMasterVolume(v.vol.master); A.setMusicVolume(v.vol.music); A.setSfxVolume(v.vol.sfx); A.setAmbienceVolume(v.vol.ambience); }
      } catch (e) { /* ignore bad settings */ }
    },
  };
})();
