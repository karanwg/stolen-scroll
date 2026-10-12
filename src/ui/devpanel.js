import { Pane } from 'tweakpane';
import { TUNING, JUICE, saveTuning, resetTuning } from '../config.js';

// Live tuning panel (press ` to toggle). Every slider writes straight into
// TUNING and persists to localStorage, so you can dial in the feel while playing.

const GROUPS = [
  ['Run', [['runSpeed', 80, 500], ['groundAccel', 300, 8000], ['groundDecel', 300, 8000], ['airAccel', 200, 6000], ['airDecel', 100, 6000]]],
  ['Jump', [['jumpHeight', 40, 260], ['timeToApex', 0.15, 0.7, 0.01], ['fallGravityMult', 1, 4, 0.05], ['jumpCut', 0, 1, 0.01], ['apexThreshold', 0, 200], ['apexGravityMult', 0.1, 1, 0.05], ['maxFall', 200, 1400], ['doubleJumpMult', 0.3, 1.3, 0.01]]],
  ['Forgiveness', [['coyoteTime', 0, 0.3, 0.01], ['jumpBuffer', 0, 0.3, 0.01], ['dashBuffer', 0, 0.3, 0.01], ['cornerCorrection', 0, 16, 1]]],
  ['Dash', [['dashSpeed', 200, 1600], ['dashDuration', 0.05, 0.4, 0.01], ['dashEndMult', 0, 1, 0.01], ['dashCooldown', 0, 1, 0.01], ['dashFreeze', 0, 0.12, 0.005]]],
  ['Float', [['floatFallSpeed', 20, 300], ['floatRunSpeed', 80, 400]]],
  ['Shadow dash', [['shadowDashCooldown', 0.5, 8, 0.1]]],
  ['Sprint', [['sprintSpeed', 250, 600]]],
  ['Kaginawa', [['hookRange', 100, 500], ['hookRopeSpeed', 600, 5000], ['hookPump', 0, 2500], ['hookReel', 0, 600], ['hookMinLen', 30, 150], ['hookMaxLen', 150, 500], ['hookJumpMult', 0.3, 1.3, 0.01]]],
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
  for (const ab of ['doubleJump', 'dash', 'shadowStep', 'waterWalk', 'float', 'wallJump', 'kaginawa', 'mirror']) {
    abilities.addBinding(game.player.abilities, ab).on('change', () => game.writeSave());
  }
  abilities.addBinding(game.debug, 'god', { label: 'god mode' });
  abilities.addBinding(game.debug, 'hitboxes');
  abilities.addBinding(game.debug, 'timeScale', { min: 0.1, max: 1, step: 0.05, label: 'time scale' });
  const warp = (tx, ty) => () => game.devWarp(tx, ty);
  const WARPS = {
    1: [['start', 5, 24], ['pagoda', 84, 38], ['rooftops', 104, 18], ['boss lantern', 165, 30]],
    2: [['cliff', 5, 24], ['village', 110, 42], ['wreck cove', 126, 42], ['lighthouse', 168, 40], ['strait', 199, 41], ['tall stack', 229, 39], ['shrine', 270, 42]],
    3: [['pass', 6, 46], ['camp', 93, 44], ['temple', 143, 44], ['onsen', 270, 40], ['falls', 285, 44], ['slope', 332, 19], ['lifeboat', 372, 25], ['crater', 440, 43], ['tethys', 482, 43], ['mess', 512, 43], ['deck C', 530, 57], ['breach', 578, 57], ['derelict', 593, 57], ['pilot', 621, 57], ['eggs', 654, 31], ['nest', 695, 33]],
    4: [['home', 5, 49], ['shrine', 182, 41], ['wood', 230, 45], ['pits', 278, 49], ['cliff', 330, 49], ['terraces', 385, 49], ['farm', 490, 49], ['courtyard', 538, 45], ['tower', 597, 45], ['storm', 632, 25], ['dawn', 704, 49]],
  };
  for (const [name, x, y] of WARPS[game.level.chapter] || []) abilities.addButton({ title: `Warp: ${name}` }).on('click', warp(x, y));
  abilities.addButton({ title: 'Go to chapter I' }).on('click', () => game.startChapter(1));
  abilities.addButton({ title: 'Go to chapter II' }).on('click', () => game.startChapter(2));
  abilities.addButton({ title: 'Go to chapter III' }).on('click', () => game.startChapter(3));
  abilities.addButton({ title: 'Go to chapter IV' }).on('click', () => game.startChapter(4));

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
