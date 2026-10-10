import { Pane } from 'tweakpane';
import { TUNING, JUICE, saveTuning, resetTuning, TILE } from '../config.js';

// Live tuning panel (press ` to toggle). Every slider writes straight into
// TUNING and persists to localStorage, so you can dial in the feel while playing.

const GROUPS = [
  ['Run', [['runSpeed', 80, 500], ['groundAccel', 300, 8000], ['groundDecel', 300, 8000], ['airAccel', 200, 6000], ['airDecel', 100, 6000]]],
  ['Jump', [['jumpHeight', 40, 260], ['timeToApex', 0.15, 0.7, 0.01], ['fallGravityMult', 1, 4, 0.05], ['jumpCut', 0, 1, 0.01], ['apexThreshold', 0, 200], ['apexGravityMult', 0.1, 1, 0.05], ['maxFall', 200, 1400], ['doubleJumpMult', 0.3, 1.3, 0.01]]],
  ['Forgiveness', [['coyoteTime', 0, 0.3, 0.01], ['jumpBuffer', 0, 0.3, 0.01], ['dashBuffer', 0, 0.3, 0.01], ['cornerCorrection', 0, 16, 1]]],
  ['Dash', [['dashSpeed', 200, 1600], ['dashDuration', 0.05, 0.4, 0.01], ['dashEndMult', 0, 1, 0.01], ['dashCooldown', 0, 1, 0.01], ['dashFreeze', 0, 0.12, 0.005]]],
  ['Float', [['floatFallSpeed', 20, 300], ['floatRunSpeed', 80, 400]]],
  ['Wall jump', [['wallSlideSpeed', 20, 400], ['wallJumpX', 100, 600], ['wallJumpLock', 0, 0.4, 0.01], ['wallCoyote', 0, 0.3, 0.01]]],
  ['Combat', [['attackDuration', 0.05, 0.4, 0.01], ['attackCooldown', 0.05, 0.8, 0.01], ['attackRecoil', 0, 500], ['pogoMult', 0.3, 1.3, 0.01], ['hitstopHit', 0, 0.2, 0.005], ['hitstopKill', 0, 0.3, 0.005]]],
  ['Damage', [['hurtInvuln', 0, 3, 0.05], ['knockX', 0, 700], ['knockY', 0, 800], ['knockStun', 0, 0.6, 0.01], ['hitstopHurt', 0, 0.3, 0.01]]],
  ['Camera', [['camLerp', 1, 20, 0.5], ['camLookAheadX', 0, 200], ['camUpBias', -100, 150], ['fallCamDelay', 0.1, 2, 0.05], ['fallCamOffset', 0, 250], ['shakeMax', 0, 40]]],
];

export function createDevPanel(game) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:8px;right:8px;width:300px;max-height:calc(100vh - 16px);overflow:auto;z-index:10;display:block';
  document.body.appendChild(container);
  const pane = new Pane({ container, title: 'Tuning  ( ` to close )' });

  const abilities = pane.addFolder({ title: 'Abilities & debug', expanded: true });
  for (const ab of ['doubleJump', 'dash', 'waterWalk', 'float', 'wallJump']) {
    abilities.addBinding(game.player.abilities, ab).on('change', () => game.writeSave());
  }
  abilities.addBinding(game.debug, 'god', { label: 'god mode' });
  abilities.addBinding(game.debug, 'hitboxes');
  abilities.addBinding(game.debug, 'timeScale', { min: 0.1, max: 1, step: 0.05, label: 'time scale' });
  const warp = (tx, ty) => () => {
    // Leaving mid-fight resets the boss and unlocks the camera.
    if (game.bossActive && game.boss && game.boss.alive) game.spawnBoss();
    game.camera.lock = null;
    game.camera.focus = null;
    game.bossIntroT = undefined;
    game.bossCardT = undefined;
    game.player.state = 'normal';
    game.player.place(tx * TILE + 16, ty * TILE);
    game.camera.snap(game.player.cx, game.player.cy, game.level.camBounds);
  };
  const WARPS = {
    1: [['start', 5, 24], ['pagoda', 84, 38], ['rooftops', 104, 18], ['boss lantern', 165, 30]],
    2: [['cliff', 5, 24], ['village', 110, 42], ['wreck cove', 126, 42], ['lighthouse', 168, 40], ['strait', 199, 41], ['tall stack', 229, 39], ['shrine', 270, 42]],
  };
  for (const [name, x, y] of WARPS[game.level.chapter] || []) abilities.addButton({ title: `Warp: ${name}` }).on('click', warp(x, y));
  abilities.addButton({ title: 'Go to chapter I' }).on('click', () => game.startChapter(1));
  abilities.addButton({ title: 'Go to chapter II' }).on('click', () => game.startChapter(2));

  for (const [title, rows] of GROUPS) {
    const f = pane.addFolder({ title, expanded: false });
    for (const [key, min, max, step] of rows) {
      f.addBinding(TUNING, key, { min, max, step: step ?? 1 }).on('change', saveTuning);
    }
  }
  const juice = pane.addFolder({ title: 'Juice', expanded: false });
  for (const k of Object.keys(JUICE)) juice.addBinding(JUICE, k);
  pane.addButton({ title: 'Reset tuning to defaults' }).on('click', () => {
    resetTuning();
    pane.refresh();
  });

  return {
    destroy() {
      pane.dispose();
      container.remove();
    },
  };
}
