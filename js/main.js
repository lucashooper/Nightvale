// Nightvale — boot and main loop.
(function () {
  'use strict';
  const G = window.G;
  const Main = (G.Main = { mode: 'boot' });
  let last = 0, titleT = 0;

  Main.boot = function (resume) {
    const canvas = document.getElementById('game');
    G.R.init(canvas);
    G.Input.attach(canvas);
    G.UI.init();
    G.Save.loadSettings();
    G.Save.initCloud();
    // the page was updated while open: carry on exactly where the player was
    if (resume && resume.save && resume.save.inv) {
      G.World.start(resume.save, false);
      Main.mode = 'play';
      G.UI.showHud(true);
      G.World.updateAudio(true);
      requestAnimationFrame(frame);
      return;
    }
    // title backdrop: the Sanctum at night
    const S = G.World.freshState('Wren', {});
    S.mins = 19 * 60 + 25;
    G.World.start(S, true);
    G.World.changeMap('village', [32, 30, 'down'], { instant: true, silent: true });
    G.World.hidePlayer = true;
    G.World.focusOverride = { x: 32 * 16, y: 19 * 16 };
    Main.mode = 'title';
    G.Screens.title();
    // from the website: play.html?new=1&name=Rowan&look=1,0,1,0,0 starts that character, play.html?continue=1 the saved game
    const q = new URLSearchParams(location.search);
    if (q.get('new') || q.get('continue')) G.Screens.quick(q);
    requestAnimationFrame(frame);
  };

  function tick(dt) {
    try {
      G.UI.tickFade(dt);
      if (Main.mode === 'title') {
        titleT += dt;
        const f = G.World.focusOverride;
        f.x = 32 * 16 + Math.sin(titleT * 0.045) * 110;
        f.y = 19 * 16 + Math.cos(titleT * 0.033) * 30;
        G.World.updateTitle(dt);
        G.R.draw(dt, G.World.frameInfo());
      } else if (Main.mode === 'play') {
        G.World.update(dt);
        G.R.draw(dt, G.World.frameInfo());
        G.UI.update(dt);
      }
    } catch (e) {
      console.error(e);
      if (!Main.errShown) { Main.errShown = true; G.UI.toast('Something went wrong: ' + (e && e.message ? e.message : e)); }
    }
    G.Input.endFrame();
  }
  function frame(now) {
    const dt = Math.max(0, Math.min(0.05, (now - (last || now)) / 1000)); // never negative after Main.step
    last = now;
    tick(dt);
    requestAnimationFrame(frame);
  }
  // advance the game by hand (used for automated testing when the page is in the background)
  Main.step = function (secs, fps) {
    fps = fps || 30;
    const n = Math.max(1, Math.round(secs * fps));
    for (let i = 0; i < n; i++) tick(1 / fps);
    last = performance.now();
  };

  window.addEventListener('load', () => {
    const hot = window.claude && window.claude.hot;
    if (hot && typeof hot.snapshot === 'function') {
      try { hot.snapshot(() => (Main.mode === 'play' && G.S ? { save: JSON.parse(JSON.stringify(G.Save.snapshot())) } : {})); } catch (e) { /* optional */ }
    }
    const go = (data) => Main.boot(data || {});
    // wait briefly for web fonts so the title renders in its proper face
    const fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]) : Promise.resolve();
    fonts.then(() => { if (hot && typeof hot.ready === 'function') hot.ready(go); else go(hot && hot.data); });
  });
})();
