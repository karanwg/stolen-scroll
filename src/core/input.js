// Keyboard (and, for menus, mouse) input with per-step edge detection.
// `pressed` edges survive until the first fixed update step consumes them.

const BINDINGS = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  jump: ['KeyZ', 'Space'],
  attack: ['KeyX', 'KeyJ'],
  dash: ['KeyC', 'KeyK', 'ShiftLeft', 'ShiftRight'],
  hook: ['KeyS'],
  shift: ['KeyA'],
  confirm: ['Enter', 'NumpadEnter'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  dev: ['Backquote'],
};

const CODE_TO_ACTIONS = {};
for (const [action, codes] of Object.entries(BINDINGS)) {
  for (const code of codes) (CODE_TO_ACTIONS[code] ||= []).push(action);
}

export class Input {
  constructor() {
    this.codes = new Set();
    this.pressedSet = new Set();
    this.releasedSet = new Set();
    this.anyPressed = false;
    this.listeners = [];
    this.mouse = null; // pointer in view coordinates, once it has moved over the canvas
    this.mouseMoved = false;
    this.clicked = false;

    addEventListener('keydown', (e) => {
      const actions = CODE_TO_ACTIONS[e.code];
      if (actions || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      this.codes.add(e.code);
      this.anyPressed = true;
      if (actions) for (const a of actions) this.pressedSet.add(a);
      for (const fn of this.listeners) fn(e);
    });
    addEventListener('keyup', (e) => {
      this.codes.delete(e.code);
      const actions = CODE_TO_ACTIONS[e.code];
      if (actions) for (const a of actions) if (!this.held(a)) this.releasedSet.add(a);
    });
    addEventListener('blur', () => this.codes.clear());
  }

  // Menus can be pointed at and clicked. Coordinates are the game's view units.
  attachMouse(canvas, viewW, viewH) {
    const toView = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * viewW, y: ((e.clientY - r.top) / r.height) * viewH };
    };
    canvas.addEventListener('mousemove', (e) => {
      this.mouse = toView(e);
      this.mouseMoved = true;
    });
    canvas.addEventListener('mouseleave', () => (this.mouse = null));
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.mouse = toView(e);
      this.clicked = true;
      this.anyPressed = true;
      for (const fn of this.listeners) fn(e);
    });
  }

  onKey(fn) {
    this.listeners.push(fn);
  }

  held(action) {
    for (const code of BINDINGS[action]) if (this.codes.has(code)) return true;
    return false;
  }

  pressed(action) {
    return this.pressedSet.has(action);
  }

  released(action) {
    return this.releasedSet.has(action);
  }

  axisX() {
    return (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
  }

  endStep() {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.anyPressed = false;
    this.mouseMoved = false;
    this.clicked = false;
  }

  label(action) {
    const names = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', ShiftLeft: 'Shift' };
    const code = BINDINGS[action][0];
    return names[code] || code.replace('Key', '');
  }
}
