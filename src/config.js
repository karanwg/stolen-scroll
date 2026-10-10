// Every number that shapes how the game feels lives here.
// Press ` (backquote) in-game to open the tuning panel and tweak these live;
// changes persist in localStorage until you hit "reset" in the panel.

export const TILE = 32;
export const VIEW_W = 960;
export const VIEW_H = 540;

export const DEFAULT_TUNING = {
  // Running
  runSpeed: 250,
  groundAccel: 2400,
  groundDecel: 3300,
  airAccel: 1500,
  airDecel: 1000,

  // Jumping — gravity is derived from height + time to apex
  jumpHeight: 118,
  timeToApex: 0.36,
  fallGravityMult: 2.0,
  jumpCut: 0.45,
  apexThreshold: 80,
  apexGravityMult: 0.5,
  maxFall: 720,
  doubleJumpMult: 0.88,

  // Forgiveness
  coyoteTime: 0.1,
  jumpBuffer: 0.12,
  dashBuffer: 0.08,
  cornerCorrection: 8,

  // Dash
  dashSpeed: 760,
  dashDuration: 0.18,
  dashEndMult: 0.5,
  dashCooldown: 0.32,
  dashFreeze: 0.035,

  // Float (cloth parachute)
  floatFallSpeed: 90,
  floatRunSpeed: 230,

  // Wall jump
  wallSlideSpeed: 150,
  wallJumpX: 300,
  wallJumpLock: 0.16,
  wallCoyote: 0.1,

  // Combat
  attackDuration: 0.17,
  attackCooldown: 0.3,
  attackRecoil: 170,
  pogoMult: 0.95,
  hitstopHit: 0.055,
  hitstopKill: 0.09,

  // Damage
  hearts: 5,
  hurtInvuln: 2.0,
  knockX: 280,
  knockY: 360,
  knockStun: 0.22,
  hitstopHurt: 0.14,

  // Camera
  camLerp: 6,
  camLookAheadX: 70,
  camUpBias: 40,
  fallCamDelay: 0.5,
  fallCamOffset: 110,
  shakeMax: 14,
};

const KEY = 'stolen-scroll.tuning.v1';

function loadOverrides() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export const TUNING = { ...DEFAULT_TUNING, ...loadOverrides() };

export function saveTuning() {
  const diff = {};
  for (const k of Object.keys(DEFAULT_TUNING)) if (TUNING[k] !== DEFAULT_TUNING[k]) diff[k] = TUNING[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(diff));
  } catch {}
}

export function resetTuning() {
  Object.assign(TUNING, DEFAULT_TUNING);
  saveTuning();
}

export const gravity = () => (2 * TUNING.jumpHeight) / (TUNING.timeToApex * TUNING.timeToApex);
export const jumpVelocity = () => (2 * TUNING.jumpHeight) / TUNING.timeToApex;

// Visual juice toggles (also exposed in the tuning panel).
export const JUICE = {
  squash: true,
  particles: true,
  shake: true,
  hitstop: true,
  afterimages: true,
  lighting: true,
  fallCam: true,
};
