// Touch (joystick + knappar) och tangentbord/mus som reserv.
const LOOK_TOUCH = 0.0065;
const LOOK_MOUSE = 0.0028;

export class Controls {
  constructor(el, ui) {
    this.el = el;
    this.ui = ui; // { stick, knob }
    this.moveX = 0;
    this.moveY = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.shooting = false;
    this.jumpHeld = false;
    this.jumpPressed = false;
    this.abilityPressed = false;
    this.touches = new Map();
    this.keys = new Set();
    this.enabled = false;
    this.onButton = null; // (name) => void, för t.ex. butik

    el.addEventListener('touchstart', (e) => this.touchStart(e), { passive: false });
    el.addEventListener('touchmove', (e) => this.touchMove(e), { passive: false });
    el.addEventListener('touchend', (e) => this.touchEnd(e), { passive: false });
    el.addEventListener('touchcancel', (e) => this.touchEnd(e), { passive: false });

    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { if (!this.jumpHeld) this.jumpPressed = true; this.jumpHeld = true; e.preventDefault(); }
      if (e.code === 'KeyE' || e.code === 'KeyQ') this.abilityPressed = true;
      if (e.code === 'KeyB' && this.onButton) this.onButton('shop');
      if (e.code === 'KeyF') this.shooting = true;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.jumpHeld = false;
      if (e.code === 'KeyF') this.shooting = false;
      this.keys.delete(e.code);
    });

    // Mus: klicka för att låsa pekaren, rör musen för att titta, klick = skjut
    el.addEventListener('mousedown', (e) => {
      if (!this.enabled || e.target.closest('[data-btn]')) return;
      if (document.pointerLockElement !== el && el.requestPointerLock) {
        el.requestPointerLock();
        return;
      }
      this.shooting = true;
    });
    window.addEventListener('mouseup', () => { if (!this.touches.size) this.shooting = false; });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === el) {
        this.lookX += e.movementX * LOOK_MOUSE;
        this.lookY += e.movementY * LOOK_MOUSE;
      }
    });

    // Knappar fungerar även med mus (för test på datorn)
    for (const b of document.querySelectorAll('[data-btn]')) {
      b.addEventListener('mousedown', (e) => { e.stopPropagation(); this.press(b.dataset.btn, true); });
      b.addEventListener('mouseup', (e) => { e.stopPropagation(); this.press(b.dataset.btn, false); });
      b.addEventListener('mouseleave', () => this.press(b.dataset.btn, false));
    }
  }

  press(name, down) {
    if (name === 'shoot') this.shooting = down;
    else if (name === 'jump') {
      if (down && !this.jumpHeld) this.jumpPressed = true;
      this.jumpHeld = down;
    } else if (name === 'ability') { if (down) this.abilityPressed = true; }
    else if (down && this.onButton) this.onButton(name);
  }

  touchStart(e) {
    if (!this.enabled) return;
    e.preventDefault();
    for (const t of e.changedTouches) {
      const btn = t.target.closest && t.target.closest('[data-btn]');
      if (btn) {
        const name = btn.dataset.btn;
        btn.classList.add('down');
        this.press(name, true);
        // Skjutknappen kan också dras för att sikta
        this.touches.set(t.identifier, { kind: 'btn', name, el: btn, x: t.clientX, y: t.clientY });
      } else if (t.clientX < window.innerWidth * 0.45) {
        this.touches.set(t.identifier, { kind: 'stick', ox: t.clientX, oy: t.clientY });
        const s = this.ui.stick;
        s.style.left = t.clientX + 'px';
        s.style.top = t.clientY + 'px';
        s.classList.add('on');
        this.ui.knob.style.transform = 'translate(-50%, -50%)';
      } else {
        this.touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
      }
    }
  }

  touchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = this.touches.get(t.identifier);
      if (!s) continue;
      if (s.kind === 'stick') {
        let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
        const R = 55;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
        this.moveX = dx / R;
        this.moveY = dy / R;
        this.ui.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (s.kind === 'look' || (s.kind === 'btn' && s.name === 'shoot')) {
        this.lookX += (t.clientX - s.x) * LOOK_TOUCH;
        this.lookY += (t.clientY - s.y) * LOOK_TOUCH;
        s.x = t.clientX;
        s.y = t.clientY;
      }
    }
  }

  touchEnd(e) {
    for (const t of e.changedTouches) {
      const s = this.touches.get(t.identifier);
      if (!s) continue;
      this.touches.delete(t.identifier);
      if (s.kind === 'stick') {
        this.moveX = 0;
        this.moveY = 0;
        this.ui.stick.classList.remove('on');
      } else if (s.kind === 'btn') {
        s.el.classList.remove('down');
        this.press(s.name, false);
      }
    }
  }

  // Rörelse i -1..1 (x = höger, y = framåt), inklusive tangentbord.
  getMove() {
    let x = this.moveX, y = -this.moveY;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    if (l < 0.12) return [0, 0];
    return [x, y];
  }

  consumeLook() {
    const r = [this.lookX, this.lookY];
    this.lookX = 0;
    this.lookY = 0;
    return r;
  }

  reset() {
    this.moveX = this.moveY = 0;
    this.shooting = false;
    this.jumpHeld = false;
    this.touches.clear();
    this.ui.stick.classList.remove('on');
  }
}
