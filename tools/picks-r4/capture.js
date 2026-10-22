// Screenshots of the homes and rare floors in each design, plus the names of every alternative, for the round 4
// pick page: writes tools/picks-r4/data.json, then run `python3 tools/build_picks.py`.
// Needs the game served at http://127.0.0.1:8767/ (see .claude/launch.json) and Playwright:
//   NODE_PATH=$(npm root -g) node tools/picks-r4/capture.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOMS = [
  ['home_jasmine', 'home', 'jasmine_home'], ['home_amara', 'home', 'amara_home'],
  ['rare_observatory', 'rare', 'observatory'], ['rare_crystal', 'rare', 'crystal'],
];

(async () => {
  const browser = await chromium.launch();
  const shots = {};
  let notes = {};
  for (const [key, kind, id] of ROOMS) {
    for (const v of ['a', 'b', 'c']) {
      // the room exactly fills the view: homes (14x10 tiles) at 3x, rare floors (28x20) at 2x
      const page = await browser.newPage({ viewport: kind === 'home' ? { width: 672, height: 480 } : { width: 896, height: 640 } });
      await page.goto('http://127.0.0.1:8767/index.html', { waitUntil: 'load' });
      await page.waitForFunction(() => window.G && G.Main && G.Main.mode === 'title', null, { timeout: 20000 });
      const ok = await page.evaluate(([key, kind, id, v]) => {
        const S = G.World.freshState('Wren', {}); G.World.start(S, false); G.Main.mode = 'play';
        G.UI.showHud(false); document.getElementById('ui').style.display = 'none'; G.World.hidePlayer = true; // no title screen, banners or HUD
        G.S.mins = 11 * 60 + 30; G.S.weather = G.World.weather = 'sunny';
        G.prefs.alts = { [key]: v };
        G.R.setZoom(kind === 'home' ? 1 : 0);
        if (kind === 'home') {
          const build = G.Interiors.homes && G.Interiors.homes[id]; if (!build) return false;
          if (v !== 'a' && !(window.ALT_NOTES && ALT_NOTES[key] && ALT_NOTES[key][v])) return false;
          G.World.maps[id] = build(v);
          G.World.changeMap(id, 'door', { instant: true, silent: true });
        } else {
          if (v !== 'a' && !(window.ALT_NOTES && ALT_NOTES[key] && ALT_NOTES[key][v])) return false;
          G.S.flags.forceRare = id; G.World.changeMap('depths', null, { floor: 7, instant: true, silent: true });
        }
        const m = G.World.map; G.World.focusOverride = { x: m.w * 8, y: m.h * 8 };
        return true;
      }, [key, kind, id, v]);
      if (ok) {
        await page.waitForTimeout(1600); // let lights and banners settle
        const buf = await page.screenshot({ type: 'jpeg', quality: 86 });
        shots[key + '_' + v] = 'data:image/jpeg;base64,' + buf.toString('base64');
        console.log(key, v, Math.round(buf.length / 1024) + ' KB');
      }
      if (!Object.keys(notes).length) notes = await page.evaluate(() => JSON.parse(JSON.stringify(window.ALT_NOTES || {})));
      await page.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify({ shots, notes }));
  console.log('wrote data.json with', Object.keys(shots).length, 'screenshots');
})();
