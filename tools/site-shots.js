// Screenshots of the game for the website (site/img/*.png, converted to webp by the caller).
// Needs the game served at http://127.0.0.1:8767/ and Playwright: NODE_PATH=$(npm root -g) node tools/site-shots.js
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '..', 'site', 'img');
// [file, viewport, setup run in the page after a new game has started]
const SHOTS = [
  ['hero', [1920, 1080], "G.S.mins = 19 * 60 + 40; W.changeMap('village', 'plaza', I); W.focusOverride = { x: 32 * 16, y: 19 * 16 }; W.hidePlayer = true;"],
  ['plaza', [1280, 800], "G.S.mins = 11 * 60; W.changeMap('village', 'plaza', I);"],
  ['sanctum', [1280, 800], "G.S.mins = 9 * 60; W.changeMap('sanctum', 'start', I); const m = W.map, F = G.Farm, seeds = Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].seed && G.CROPS[G.ITEMS[k].seed]); const soil = []; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (F.canTill(m, x, y)) soil.push([x, y]); const cx = soil.reduce((a, p) => a + p[0], 0) / soil.length, cy = soil.reduce((a, p) => a + p[1], 0) / soil.length; for (const [x, y] of soil) { if (Math.abs(x - cx) > 8 || Math.abs(y - cy) > 5 || (x + y) % 7 === 0) continue; F.till(m, x, y); F.plant(m, x, y, seeds[(Math.floor(x / 2) + Math.floor(y / 2)) % seeds.length]); const f = m.farm.get(m.idx(x, y)); if (f && f.crop) { const d = G.CROPS[f.crop.id]; f.crop.days = Math.min(d.days, 1 + ((x * 7 + y * 3) % d.days)); f.watered = (x + y) % 3 > 0; } } W.player.x = cx * 16; W.player.y = (cy + 6) * 16; W.focusOverride = { x: cx * 16, y: cy * 16 + 24 };"],
  ['jasmine', [672, 480], "G.R.setZoom(1); G.S.mins = 11 * 60 + 30; W.changeMap('jasmine_home', 'door', I); W.hidePlayer = true; W.focusOverride = { x: W.map.w * 8, y: W.map.h * 8 };"],
  ['depths', [1280, 800], "G.S.flags.forceRare = 'observatory'; W.changeMap('depths', null, { floor: 7, instant: true, silent: true });"],
  ['tavern', [1280, 800], "G.S.mins = 20 * 60; W.changeMap('tavern', Object.keys(W.maps.tavern.spawns)[0], I);"],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, [w, h], setup] of SHOTS.filter((s) => !process.argv[2] || s[0] === process.argv[2])) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.goto('http://127.0.0.1:8767/play.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.G && G.Main && G.Main.mode === 'title', null, { timeout: 20000 });
    await p.evaluate((setup) => {
      document.getElementById('ui').style.display = 'none';
      const S = G.World.freshState('Rowan', { skin: 1, hair: 1, hairColor: 2, robe: 0, eyes: 0 });
      G.World.start(S, false); G.Main.mode = 'play'; G.World.hidePlayer = false; G.World.focusOverride = null;
      G.S.weather = G.World.weather = 'clear';
      const W = G.World, I = { instant: true, silent: true };
      (0, eval)('(function (W, I) {' + setup + '})')(W, I);
      if (W.map.bake && W.map.baked) W.map.bake();
    }, setup);
    await p.waitForTimeout(3000);
    await p.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('shot', name);
    await p.close();
  }
  await b.close();
})();
