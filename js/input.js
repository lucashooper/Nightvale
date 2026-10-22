// Nightvale — keyboard + mouse input with action bindings.
(function () {
  'use strict';
  const G = window.G;

  const BIND = {
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    use: ['Space', 'KeyC'],
    interact: ['KeyE', 'KeyX', 'Enter', 'KeyF'],
    inventory: ['KeyI', 'Tab'],
    menu: ['Escape'],
    map: ['KeyM'],
    journal: ['KeyJ'],
    run: ['ShiftLeft', 'ShiftRight'],
  };
  const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  const I = (G.Input = {
    keys: new Set(),
    pressed: new Set(),
    released: new Set(),
    mouse: { x: 0, y: 0, cx: 0, cy: 0, down: [false, false, false], pressed: [false, false, false], released: [false, false, false], wheel: 0, onCanvas: false, moved: false },
    lastDevice: 'keyboard',
    bind: BIND,
  });

  function typing(e) {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  }

  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    const k = e.code;
    if (PREVENT.has(k)) e.preventDefault();
    if (!I.keys.has(k)) I.pressed.add(k);
    I.keys.add(k);
    I.lastDevice = 'keyboard';
    G.emit('keydown', k, e);
  });
  window.addEventListener('keyup', (e) => {
    I.keys.delete(e.code);
    I.released.add(e.code);
  });
  window.addEventListener('blur', () => { I.keys.clear(); I.mouse.down = [false, false, false]; });

  I.attach = function (canvas) {
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      I.mouse.cx = e.clientX - r.left;
      I.mouse.cy = e.clientY - r.top;
      const dpr = canvas.width / Math.max(1, r.width);
      I.mouse.x = I.mouse.cx * dpr;
      I.mouse.y = I.mouse.cy * dpr;
    };
    canvas.addEventListener('mousemove', (e) => { pos(e); I.mouse.onCanvas = true; I.mouse.moved = true; });
    canvas.addEventListener('mouseleave', () => { I.mouse.onCanvas = false; });
    canvas.addEventListener('mousedown', (e) => {
      pos(e);
      I.mouse.down[e.button] = true;
      I.mouse.pressed[e.button] = true;
      I.lastDevice = 'mouse';
      G.emit('canvasclick', e.button);
    });
    window.addEventListener('mouseup', (e) => {
      if (I.mouse.down[e.button]) I.mouse.released[e.button] = true;
      I.mouse.down[e.button] = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { I.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  };

  I.down = (action) => BIND[action].some((k) => I.keys.has(k));
  I.hit = (action) => BIND[action].some((k) => I.pressed.has(k));
  I.keyHit = (code) => I.pressed.has(code);
  I.consume = (action) => { for (const k of BIND[action]) I.pressed.delete(k); };
  I.endFrame = function () {
    I.pressed.clear();
    I.released.clear();
    I.mouse.pressed = [false, false, false];
    I.mouse.released = [false, false, false];
    I.mouse.wheel = 0;
    I.mouse.moved = false;
  };
  I.axis = function () {
    let x = 0, y = 0;
    if (I.down('left')) x -= 1;
    if (I.down('right')) x += 1;
    if (I.down('up')) y -= 1;
    if (I.down('down')) y += 1;
    if (!x && !y && (I.touchAxis[0] || I.touchAxis[1])) return I.touchAxis.slice();
    return [x, y];
  };

  // ---- touch controls: a virtual joystick (left thumb) and action buttons (right thumb)
  I.touchAxis = [0, 0];
  I.touchUI = function (root) {
    const wrap = document.createElement('div');
    wrap.id = 'touch';
    wrap.innerHTML = '<div class="stick"><i></i></div><div class="tbtns"><button class="tb tb-act" aria-label="Talk or interact">Act</button><button class="tb tb-use" aria-label="Use tool">Use</button><button class="tb tb-bag" aria-label="Open satchel">Bag</button></div>';
    root.appendChild(wrap);
    const stick = wrap.querySelector('.stick'), knob = stick.querySelector('i');
    let sid = null, ox = 0, oy = 0;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px, ${dy}px)`; };
    stick.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; sid = t.identifier; const r = stick.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2; e.preventDefault(); }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === sid) {
        let dx = t.clientX - ox, dy = t.clientY - oy; const d = Math.hypot(dx, dy), max = 42;
        if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
        setKnob(dx, dy);
        const m = Math.hypot(dx, dy) / max;
        I.touchAxis = m < 0.25 ? [0, 0] : [dx / max, dy / max];
        e.preventDefault();
      }
    }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; I.touchAxis = [0, 0]; setKnob(0, 0); } };
    window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
    const bind = (sel, code) => {
      const b = wrap.querySelector(sel);
      b.addEventListener('touchstart', (e) => { e.preventDefault(); I.lastDevice = 'keyboard'; if (!I.keys.has(code)) I.pressed.add(code); I.keys.add(code); G.emit('keydown', code); }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); I.keys.delete(code); }, { passive: false });
    };
    bind('.tb-use', 'Space'); bind('.tb-act', 'KeyE'); bind('.tb-bag', 'KeyI');
    document.body.classList.add('touchy');
  };
  window.addEventListener('touchstart', function first() {
    window.removeEventListener('touchstart', first);
    const root = document.getElementById('ui');
    if (root && !document.getElementById('touch')) I.touchUI(root);
  }, { passive: true });
})();
