import { TUNING as T, VIEW_W, VIEW_H, JUICE } from '../config.js';
import { clamp, damp, noise1 } from './math.js';

export class Camera {
  constructor() {
    this.x = 0; // centre
    this.y = 0;
    this.lookX = 0;
    this.trauma = 0;
    this.time = 0;
    this.lock = null; // {x0,x1,y0,y1} overrides level bounds (boss arenas)
    this.focus = null; // {x,y,rate} temporary point of interest (cutscenes)
    this.ox = 0;
    this.oy = 0;
    this.kx = 0;
    this.ky = 0;
  }

  // A small directional nudge (sword swings, impacts) that springs back.
  kick(x, y) {
    if (!JUICE.shake) return;
    this.kx += x;
    this.ky += y;
  }

  snap(x, y, bounds) {
    this.x = x;
    this.y = y;
    this.clampTo(bounds);
  }

  shake(amount) {
    if (!JUICE.shake) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt, player, bounds, fallFlag) {
    this.time += dt;
    let tx;
    let ty;
    let rate = T.camLerp;
    if (this.focus) {
      tx = this.focus.x;
      ty = this.focus.y;
      rate = this.focus.rate ?? 3;
    } else {
      const want = player.state === 'normal' ? player.facing * T.camLookAheadX : 0;
      this.lookX = damp(this.lookX, want, 2.2, dt);
      tx = player.cx + this.lookX;
      ty = player.cy - T.camUpBias;
      if (fallFlag && JUICE.fallCam) {
        ty += T.fallCamOffset;
        rate *= 1.6;
      }
    }
    this.x = damp(this.x, tx, rate, dt);
    this.y = damp(this.y, ty, rate * 0.9, dt);
    this.clampTo(this.lock || bounds);

    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * T.shakeMax;
    this.kx = damp(this.kx, 0, 14, dt);
    this.ky = damp(this.ky, 0, 14, dt);
    this.ox = (noise1(this.time * 28, 1) - 0.5) * 2 * s + this.kx;
    this.oy = (noise1(this.time * 28, 2) - 0.5) * 2 * s + this.ky;
  }

  clampTo(b) {
    const hw = VIEW_W / 2;
    const hh = VIEW_H / 2;
    this.x = b.x1 - b.x0 <= VIEW_W ? (b.x0 + b.x1) / 2 : clamp(this.x, b.x0 + hw, b.x1 - hw);
    this.y = b.y1 - b.y0 <= VIEW_H ? (b.y0 + b.y1) / 2 : clamp(this.y, b.y0 + hh, b.y1 - hh);
  }

  // Top-left of the view in world space, including shake.
  get left() {
    return Math.round((this.x - VIEW_W / 2 + this.ox) * 2) / 2;
  }
  get top() {
    return Math.round((this.y - VIEW_H / 2 + this.oy) * 2) / 2;
  }
}
