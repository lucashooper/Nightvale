// Nightvale — inventory helpers over G.S.inv (36 slots, first 12 = hotbar).
(function () {
  'use strict';
  const G = window.G;
  const Inv = (G.Inv = { SIZE: 36, HOT: 12 });

  const slots = () => G.S.inv;
  const maxStack = (id) => G.item(id).stack || 999;

  Inv.count = function (id, arr) { let n = 0; for (const s of arr || slots()) if (s && s.id === id) n += s.n; return n; };
  Inv.has = (id, n) => Inv.count(id) >= (n || 1);
  Inv.canAdd = function (id, n, arr) {
    arr = arr || slots();
    const ms = maxStack(id);
    let room = 0;
    for (const s of arr) { if (!s) room += ms; else if (s.id === id && ms > 1) room += ms - s.n; if (room >= (n || 1)) return true; }
    return room > 0;
  };
  // returns leftover that did not fit
  Inv.add = function (id, n, arr) {
    arr = arr || slots();
    n = n || 1;
    const ms = maxStack(id);
    if (ms > 1) for (const s of arr) { if (n <= 0) break; if (s && s.id === id && s.n < ms) { const k = Math.min(ms - s.n, n); s.n += k; n -= k; } }
    for (let i = 0; i < arr.length && n > 0; i++) if (!arr[i]) { const k = Math.min(ms, n); arr[i] = { id, n: k }; n -= k; }
    if (arr === slots()) G.emit('inv');
    return n;
  };
  Inv.remove = function (id, n, arr) {
    arr = arr || slots();
    n = n || 1;
    if (Inv.count(id, arr) < n) return false;
    // remove from the end of the backpack first so hotbar stacks survive longer
    for (let i = arr.length - 1; i >= 0 && n > 0; i--) { const s = arr[i]; if (s && s.id === id) { const k = Math.min(s.n, n); s.n -= k; n -= k; if (s.n <= 0) arr[i] = null; } }
    if (arr === slots()) G.emit('inv');
    return true;
  };
  Inv.removeAt = function (i, n, arr) {
    arr = arr || slots();
    const s = arr[i]; if (!s) return null;
    const k = Math.min(s.n, n || 1);
    s.n -= k; if (s.n <= 0) arr[i] = null;
    if (arr === slots()) G.emit('inv');
    return { id: s.id, n: k };
  };
  Inv.selected = () => slots()[G.S.sel] || null;
  Inv.selectedItem = () => { const s = Inv.selected(); return s ? G.item(s.id) : null; };
  Inv.giveOrDrop = function (id, n) {
    const left = Inv.add(id, n);
    if (left > 0 && G.World.player) G.dropItem(G.World.map, id, left, G.World.player.x, G.World.player.y - 4, { delay: 2.5 });
    if (n - left > 0) G.UI.toastItem(id, n - left);
    return left;
  };
  Inv.newArray = (n) => Array.from({ length: n }, () => null);
})();
