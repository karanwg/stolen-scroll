import { Game } from './game.js';
import { createDevPanel } from './ui/devpanel.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.game = game; // handy for poking at things from the console

// The tuning panel is rebuilt each time it opens, so it always binds to the current player.
let panel = null;
game.input.onKey((e) => {
  if (e.code !== 'Backquote') return;
  if (panel) {
    panel.destroy();
    panel = null;
  } else panel = createDevPanel(game);
});

// Fixed 120 Hz simulation: smooth on both 60 Hz and 120 Hz displays.
const STEP = 1 / 120;
let acc = 0;
let last = performance.now();
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    game.update(STEP);
    game.input.endStep();
    acc -= STEP;
  }
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) import('../debug/harness.js').then((m) => m.installHarness(game));
