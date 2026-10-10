// Keyboard input with per-step edge detection.
// `pressed` edges survive until the first fixed update step consumes them.

const BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['KeyZ', 'Space'],
  attack: ['KeyX', 'KeyJ'],
  dash: ['KeyC', 'KeyK', 'ShiftLeft', 'ShiftRight'],
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
  }

  label(action) {
    const names = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', ShiftLeft: 'Shift' };
    const code = BINDINGS[action][0];
    return names[code] || code.replace('Key', '');
  }
}
