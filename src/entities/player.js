import { TUNING as T, gravity, jumpVelocity, TILE } from '../config.js';
import { approach, sign } from '../core/math.js';
import { NinjaRig, POSES, STYLES, runPose, attackPose, SWING_ARCS } from '../render/ninjaRig.js';

export const ABILITIES = ['doubleJump', 'dash', 'shadowStep', 'waterWalk', 'float', 'wallJump', 'kaginawa'];

export class Player {
  constructor(x, feetY) {
    this.w = 18;
    this.h = 46;
    this.abilities = { doubleJump: false, dash: false, waterWalk: false, float: false, wallJump: false, kaginawa: false, shadowStep: false };
    this.maxHearts = T.hearts;
    this.hearts = this.maxHearts;
    this.rig = new NinjaRig(STYLES.player);
    this.events = [];
    this.ghosts = [];
    this.place(x, feetY);
  }

  place(cx, feetY) {
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.facing || 1;
    this.grounded = false;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.dashBuf = 0;
    this.airJumps = 0;
    this.canDash = true;
    this.dashT = 0;
    this.dashCool = 0;
    this.dashDir = 1;
    this.jumping = false;
    this.floating = false;
    this.wallDir = 0;
    this.wallCoyote = 0;
    this.wallLock = 0;
    this.lastWallDir = 0;
    this.attackT = 0;
    this.attackCool = 0;
    this.attackDir = 'side';
    this.attackKind = 'down';
    this.attackArc = SWING_ARCS.down;
    this.attackId = 0;
    this.followT = 0;
    this.swingFlip = false;
    this.lastAttackT = 0;
    this.hitSet = new Set();
    this.pogoUsed = false;
    this.pogoGraceT = 0;
    this.invuln = 0;
    this.stunT = 0;
    this.dropT = 0;
    this.fallTime = 0;
    this.lastVy = 0;
    this.state = 'normal'; // normal | rest | dead | cutscene
    this.lastSafe = { x: cx, y: feetY };
    this.runPhase = 0;
    this.ghostT = 0;
    this.onWater = false; // standing/running on calm water (Mizugumo)
    this.sinkT = 0; // how long we've been too slow on water
    this.sunk = false; // stood still too long: the water no longer holds us
    this.shadowCool = 0; // a shadow dash is ready when this runs out
    this.shadowDash = false; // the current dash is a shadow dash
    this.sprinting = false; // holding dash after the burst
    this.hook = null; // { anchor, phase: 'fire' | 'attached', t, len }
    this.hookTarget = null; // best anchor in reach (set by the game each frame)
    this.windX = 0; // horizontal push from blizzard gusts (px/s²)
    this.chillT = 0; // Yuki-onna's breath: slowed
    this.groundTile = null;
  }

  // A shadow dash makes you untouchable for its length: enemies, projectiles
  // and burning ground pass through you.
  get immune() {
    return this.dashT > 0 && this.shadowDash;
  }

  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  get feetY() {
    return this.y + this.h;
  }

  emit(type, data = {}) {
    this.events.push({ type, x: this.cx, y: this.feetY, ...data });
  }

  canAirJump() {
    return this.abilities.doubleJump && this.airJumps > 0;
  }

  step(dt, inp, lvl) {
    this.coyote -= dt;
    this.jumpBuf -= dt;
    this.dashBuf -= dt;
    this.dashCool -= dt;
    this.attackCool -= dt;
    this.invuln -= dt;
    this.stunT -= dt;
    this.dropT -= dt;
    this.wallCoyote -= dt;
    this.wallLock -= dt;
    this.pogoGraceT -= dt;
    this.chillT -= dt;
    if (this.shadowCool > 0) {
      this.shadowCool -= dt;
      if (this.shadowCool <= 0 && this.abilities.shadowStep) this.emit('shadowReady');
    }
    if (this.attackT > 0) {
      this.attackT -= dt;
      if (this.attackT <= 0) this.followT = 0.1;
    } else this.followT -= dt;
    this.lastAttackT += dt;

    if (this.state === 'rest') {
      this.vx = 0;
      this.vy = Math.min(this.vy + gravity() * dt, T.maxFall);
      this.move(dt, lvl);
      if (inp.axisX() !== 0 || inp.pressed('jump') || inp.pressed('attack') || inp.pressed('dash')) {
        this.state = 'normal';
        this.emit('stand');
      }
      this.animate(dt, inp);
      return;
    }
    if (this.state === 'dead' || this.state === 'cutscene') {
      this.vx = approach(this.vx, 0, 900 * dt);
      this.vy = Math.min(this.vy + gravity() * T.fallGravityMult * dt, T.maxFall);
      this.move(dt, lvl);
      this.animate(dt, inp);
      return;
    }

    const ax = inp.axisX();
    if (inp.pressed('jump')) this.jumpBuf = T.jumpBuffer;
    if (inp.pressed('dash')) this.dashBuf = T.dashBuffer;
    if (!inp.held('jump')) this.floating = false;
    if (!inp.held('dash')) this.sprinting = false;
    const slow = this.chillT > 0 ? 0.6 : 1;

    // ── Kaginawa ──────────────────────────────────────────
    if (this.abilities.kaginawa && inp.pressed('hook') && !this.hook && this.hookTarget && this.stunT <= 0) {
      this.hook = { anchor: this.hookTarget, phase: 'fire', t: 0 };
      this.floating = false;
      this.emit('hookFire');
    }
    if (this.hook) {
      const h = this.hook;
      const a = h.anchor;
      const dist = Math.hypot(a.x - this.cx, a.y - this.cy);
      if (h.phase === 'fire') {
        h.t += dt;
        if (h.t * T.hookRopeSpeed >= dist) {
          h.phase = 'attached';
          h.len = Math.max(T.hookMinLen, Math.min(T.hookMaxLen, dist * 0.92));
          this.airJumps = 1;
          this.canDash = true;
          this.dashT = 0;
          this.jumping = false;
          this.emit('hookAttach', { ax: a.x, ay: a.y });
        }
        if (!inp.held('hook') && h.phase === 'fire') this.hook = null;
      } else if (this.stunT > 0) {
        this.hook = null;
      } else if (!inp.held('hook')) {
        this.releaseHook(1.08);
      } else if (this.jumpBuf > 0) {
        this.jumpBuf = 0;
        this.releaseHook(1.12);
        this.vy = Math.min(this.vy * 0.5, 0) - jumpVelocity() * T.hookJumpMult;
        // a committed launch: letting go of jump early doesn't cut it short
        this.jumping = false;
        this.emit('hookJump');
      } else if (this.abilities.dash && this.dashBuf > 0 && this.dashCool <= 0) {
        this.hook = null;
        this.canDash = true;
      } else {
        this.swing(dt, inp, ax, lvl);
        this.afterMove(dt, lvl);
        if (inp.pressed('attack') && this.attackCool <= 0) this.startAttack(inp);
        this.animate(dt, inp);
        return;
      }
    }

    // ── Dash start ────────────────────────────────────────
    if (this.abilities.dash && this.dashBuf > 0 && this.dashCool <= 0 && this.canDash && this.stunT <= 0 && this.dashT <= 0) {
      let dir = ax || this.facing;
      if (this.wallDir !== 0) dir = -this.wallDir;
      this.dashT = T.dashDuration;
      this.dashDir = dir;
      this.facing = dir;
      this.dashBuf = 0;
      this.canDash = false;
      this.floating = false;
      this.attackT = 0;
      this.jumping = false;
      this.wallDir = 0;
      // with the Kage-ashi, a dash every few seconds is a shadow dash
      this.shadowDash = this.abilities.shadowStep && this.shadowCool <= 0;
      if (this.shadowDash) this.shadowCool = T.shadowDashCooldown;
      this.emit('dash', { dir, shadow: this.shadowDash });
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir * T.dashSpeed;
      this.vy = 0;
      this.ghostT -= dt;
      if (this.ghostT <= 0) {
        this.ghostT = 0.03;
        this.emit('ghost');
      }
      if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
        this.dashT = 0;
        this.vx = this.dashDir * T.dashSpeed * 0.62;
        this.doJump();
      } else if (this.jumpBuf > 0 && this.canAirJump()) {
        this.dashT = 0;
        this.vx = this.dashDir * T.dashSpeed * T.dashEndMult;
        this.airJump();
      } else if (this.dashT <= 0) {
        // keep holding dash to keep running, a little slower than the burst
        if (inp.held('dash') && this.abilities.shadowStep) {
          this.sprinting = true;
          this.vx = this.dashDir * T.sprintSpeed;
        } else this.vx *= T.dashEndMult;
        this.dashCool = T.dashCooldown;
        this.emit('dashEnd');
      }
    } else {
      // ── Horizontal ────────────────────────────────────────
      // sprinting runs on its own in the dash's direction; arrows can turn it around
      if (this.sprinting && ax !== 0) this.dashDir = ax;
      const moveDir = this.sprinting ? this.dashDir : ax;
      const top = (this.sprinting ? T.sprintSpeed : this.floating ? T.floatRunSpeed : T.runSpeed) * slow;
      const target = moveDir * top;
      let accel;
      if (this.grounded) {
        accel = moveDir !== 0 && (sign(this.vx) === moveDir || this.vx === 0) && Math.abs(this.vx) <= top ? T.groundAccel : T.groundDecel;
        if (this.groundTile === 'I') accel *= 0.16; // ice: hard to start, harder to stop
      } else {
        accel = moveDir !== 0 ? T.airAccel : T.airDecel;
        if (Math.abs(this.vx) > top && sign(this.vx) === moveDir) accel = T.airDecel * 0.3;
      }
      if (this.wallLock > 0) accel *= 0.2;
      if (this.stunT > 0) this.vx = approach(this.vx, 0, 400 * dt);
      else this.vx = approach(this.vx, target, accel * dt);
      // Blizzard gusts shove you — far more when the cloth is open.
      if (this.windX) this.vx += this.windX * dt * (this.floating ? 2.4 : this.grounded ? 0.5 : 1);
      if (moveDir !== 0 && this.attackT <= 0 && this.stunT <= 0) this.facing = moveDir;

      // ── Wall slide ────────────────────────────────────────
      this.wallDir = 0;
      if (this.abilities.wallJump && !this.grounded && this.stunT <= 0 && ax !== 0 && this.vy > -60 && this.touchingWall(lvl, ax)) {
        this.wallDir = ax;
        this.wallIce = this.wallTile(lvl, ax) === 'I';
        this.lastWallDir = ax;
        this.wallCoyote = T.wallCoyote;
        this.floating = false;
      }

      // ── Jumps ─────────────────────────────────────────────
      if (this.jumpBuf > 0 && this.stunT <= 0) {
        if (this.grounded && inp.held('down') && lvl.onlyOneWayUnder(this.x, this.y, this.w, this.h)) {
          this.dropT = 0.25;
          this.jumpBuf = 0;
          this.grounded = false;
          this.coyote = 0;
        } else if (this.grounded || this.coyote > 0) this.doJump();
        else if (this.abilities.wallJump && (this.wallDir !== 0 || this.wallCoyote > 0)) this.wallJump();
        else if (this.canAirJump()) this.airJump();
        else if (this.abilities.float && !this.floating) {
          this.floating = true;
          this.jumpBuf = 0;
          this.emit('floatOpen');
        }
      }

      // ── Gravity ───────────────────────────────────────────
      let g = gravity();
      if (this.vy > 0) g *= T.fallGravityMult;
      else if (this.jumping && !inp.held('jump')) {
        this.vy *= T.jumpCut;
        this.jumping = false;
      }
      if (!this.grounded && Math.abs(this.vy) < T.apexThreshold && inp.held('jump')) g *= T.apexGravityMult;
      // The cloth and the wall replace gravity once you're falling, so they
      // actually hold a steady speed instead of losing to it.
      if (this.floating && this.vy > -40) this.vy = approach(this.vy, T.floatFallSpeed, (this.vy > T.floatFallSpeed ? 2600 : 700) * dt);
      else if (this.wallDir !== 0 && this.vy > 0) {
        const slideMax = this.wallIce ? T.wallSlideSpeed * 2.4 : T.wallSlideSpeed;
        this.vy = approach(this.vy, slideMax, (this.vy > slideMax ? 2400 : 900) * dt);
      }
      else this.vy = Math.min(this.vy + g * dt, T.maxFall);
      if (this.vy >= 0) this.jumping = false;

      // ── Attack ────────────────────────────────────────────
      if (inp.pressed('attack') && this.attackCool <= 0 && this.stunT <= 0) this.startAttack(inp);
    }

    this.lastVy = this.vy;
    this.move(dt, lvl);
    this.afterMove(dt, lvl);
    this.animate(dt, inp);
  }

  doJump() {
    this.vy = -jumpVelocity() * (this.chillT > 0 ? 0.85 : 1);
    this.jumpBuf = 0;
    this.coyote = 0;
    this.grounded = false;
    this.jumping = true;
    this.emit('jump');
  }

  airJump() {
    this.vy = -jumpVelocity() * T.doubleJumpMult;
    this.airJumps--;
    this.jumpBuf = 0;
    this.jumping = true;
    this.floating = false;
    this.rig.flip(0.34);
    this.emit('airJump');
  }

  wallJump() {
    const dir = this.wallDir || this.lastWallDir;
    this.vx = -dir * T.wallJumpX;
    this.vy = -jumpVelocity() * 0.92;
    this.facing = -dir;
    this.wallLock = T.wallJumpLock;
    this.wallDir = 0;
    this.wallCoyote = 0;
    this.jumpBuf = 0;
    this.jumping = true;
    this.airJumps = 1;
    this.canDash = true;
    this.emit('wallJump', { dir });
  }

  wallTile(lvl, dir) {
    const probeX = dir > 0 ? this.x + this.w + 1 : this.x - 2;
    return lvl.tileAt(Math.floor(probeX / TILE), Math.floor(this.cy / TILE));
  }

  // Pendulum on a rope that can go slack: gravity + pumping, then the rope
  // pulls you back onto the circle and cancels any outward velocity.
  swing(dt, inp, ax, lvl) {
    const a = this.hook.anchor;
    if (inp.held('up')) this.hook.len = Math.max(T.hookMinLen, this.hook.len - T.hookReel * dt);
    if (inp.held('down')) this.hook.len = Math.min(T.hookMaxLen, this.hook.len + T.hookReel * dt);
    const len = this.hook.len;
    let dx = this.cx - a.x;
    let dy = this.cy - a.y;
    let d = Math.hypot(dx, dy) || 1;
    // pump: push along the tangent, strongest at the bottom of the arc
    const tx = -dy / d;
    const ty = dx / d;
    const below = Math.max(0, dy / d);
    if (ax !== 0) {
      const s = sign(tx) === ax ? 1 : -1;
      this.vx += tx * s * T.hookPump * (0.35 + 0.65 * below) * dt;
      this.vy += ty * s * T.hookPump * (0.35 + 0.65 * below) * dt;
      this.facing = ax;
    } else if (Math.abs(this.vx) > 20) this.facing = sign(this.vx);
    this.vy += gravity() * dt;
    if (this.windX) this.vx += this.windX * dt;
    this.vx *= Math.exp(-0.15 * dt);
    this.vy *= Math.exp(-0.15 * dt);
    this.lastVy = this.vy;
    this.move(dt, lvl);
    dx = this.cx - a.x;
    dy = this.cy - a.y;
    d = Math.hypot(dx, dy) || 1;
    if (d > len) {
      const nx = a.x + (dx / d) * len - this.w / 2;
      const ny = a.y + (dy / d) * len - this.h / 2;
      if (!lvl.boxHit(nx, ny, this.w, this.h)) {
        this.x = nx;
        this.y = ny;
      }
      const vr = (this.vx * dx + this.vy * dy) / d;
      if (vr > 0) {
        this.vx -= (vr * dx) / d;
        this.vy -= (vr * dy) / d;
      }
    }
    this.hook.taut = d >= len - 2;
  }

  releaseHook(boost = 1) {
    if (!this.hook) return;
    const attached = this.hook.phase === 'attached';
    this.hook = null;
    if (!attached) return;
    this.vx *= boost;
    this.vy = this.vy < 0 ? this.vy * boost : this.vy;
    this.jumping = false;
    this.emit('hookRelease');
  }

  touchingWall(lvl, dir) {
    const probeX = dir > 0 ? this.x + this.w : this.x - 1;
    return lvl.boxHit(probeX, this.y + 6, 1, this.h - 14) !== null;
  }

  startAttack(inp) {
    let dir = 'side';
    if (inp.held('up')) dir = 'up';
    else if (inp.held('down') && !this.grounded) dir = 'down';
    this.attackT = T.attackDuration;
    this.attackCool = T.attackCooldown;
    this.attackDir = dir;
    // Consecutive side slashes alternate down-cut / up-cut, like a real combo.
    if (dir === 'side') {
      this.swingFlip = this.lastAttackT < 0.6 ? !this.swingFlip : false;
      this.attackKind = this.swingFlip ? 'up' : 'down';
    } else this.attackKind = dir === 'up' ? 'overhead' : 'under';
    this.attackArc = SWING_ARCS[this.attackKind];
    this.lastAttackT = 0;
    this.followT = 0;
    this.attackId++;
    this.hitSet.clear();
    this.pogoUsed = false;
    if (this.wallDir !== 0) this.facing = -this.wallDir;
    this.emit('slash', { dir });
  }

  attackBox() {
    const cx = this.cx;
    if (this.attackDir === 'up') return { x: cx - 32, y: this.y - 62, w: 64, h: 74 };
    if (this.attackDir === 'down') return { x: cx - 32, y: this.y + this.h - 16, w: 64, h: 72 };
    return this.facing > 0 ? { x: cx + 2, y: this.y - 10, w: 80, h: 56 } : { x: cx - 82, y: this.y - 10, w: 80, h: 56 };
  }

  // Called by the game when a swing connects with something solid-to-hit.
  onHitLanded(kind = 'enemy') {
    if (this.attackDir === 'down') this.pogo();
    else if (this.attackDir === 'side') this.vx = -this.facing * T.attackRecoil * (this.grounded ? 0.7 : 1);
    else if (this.attackDir === 'up' && this.vy < 0) this.vy *= 0.7;
    if (kind === 'hazard') this.emit('clang');
  }

  pogo() {
    if (this.pogoUsed) return;
    this.pogoUsed = true;
    this.pogoGraceT = 0.15; // bouncing off a jellyfish can't sting you on the same frame
    this.vy = -jumpVelocity() * T.pogoMult;
    this.jumping = false;
    this.floating = false;
    this.airJumps = 1;
    this.canDash = true;
    this.emit('pogo');
  }

  hurt(srcX, { hazard = false } = {}) {
    if (this.invuln > 0 || this.state === 'dead') return false;
    this.hearts--;
    this.invuln = T.hurtInvuln;
    this.dashT = 0;
    this.hook = null;
    this.sprinting = false;
    this.attackT = 0;
    this.floating = false;
    this.state = this.state === 'rest' ? 'normal' : this.state;
    if (!hazard) {
      const dir = sign(this.cx - srcX) || -this.facing;
      this.vx = dir * T.knockX;
      this.vy = -T.knockY;
      this.stunT = T.knockStun;
      this.jumping = false;
    }
    this.emit('hurt', { hazard, dead: this.hearts <= 0 });
    return true;
  }

  // ── Collision ──────────────────────────────────────────────
  move(dt, lvl) {
    const dx = this.vx * dt;
    const dy = this.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6));
    for (let i = 0; i < steps; i++) {
      this.moveX(dx / steps, lvl);
      this.moveY(dy / steps, lvl);
    }
  }

  moveX(dx, lvl) {
    if (!dx) return;
    this.x += dx;
    for (let i = 0; i < 4; i++) {
      const hit = lvl.boxHit(this.x, this.y, this.w, this.h);
      if (!hit) return;
      const [tx, ty] = hit;
      if (this.dashT > 0 && (lvl.tileAt(tx, ty) === 'X' || lvl.tileAt(tx, ty) === 'R')) {
        this.emit('break', { tiles: lvl.breakCluster(tx, ty) });
        continue;
      }
      if (this.dashT > 0 || !this.grounded) {
        for (let k = 1; k <= T.cornerCorrection; k++) {
          if (!lvl.boxHit(this.x, this.y - k, this.w, this.h)) {
            this.y -= k;
            return;
          }
        }
      }
      this.x = dx > 0 ? tx * TILE - this.w : (tx + 1) * TILE;
      this.vx = 0;
      if (this.dashT > 0) {
        this.dashT = 0;
        this.dashCool = T.dashCooldown;
        this.emit('dashEnd');
      }
      return;
    }
  }

  moveY(dy, lvl) {
    if (!dy) return;
    const prevBottom = this.y + this.h;
    this.y += dy;
    if (dy > 0 && this.dropT <= 0) {
      const plat = lvl.platformHit(this.x, this.y, this.w, this.h, prevBottom);
      if (plat) {
        this.y = plat.y - this.h;
        this.vy = 0;
        return;
      }
      // Mizugumo: calm water is a floor while you keep moving.
      if (this.abilities.waterWalk && !this.sunk) {
        const ty = Math.floor((this.y + this.h) / TILE);
        const surface = ty * TILE;
        if (prevBottom <= surface + 0.5 && this.y + this.h >= surface && lvl.calmWaterUnder(this.x, surface - this.h - 1, this.w, this.h) === surface) {
          this.y = surface - this.h;
          this.vy = 0;
          return;
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const hit = dy < 0 ? lvl.boxHit(this.x, this.y, this.w, this.h) : lvl.boxHit(this.x, this.y, this.w, this.h, this.dropT <= 0, prevBottom);
      if (!hit) return;
      const [tx, ty] = hit;
      if (this.dashT > 0 && (lvl.tileAt(tx, ty) === 'X' || lvl.tileAt(tx, ty) === 'R')) {
        this.emit('break', { tiles: lvl.breakCluster(tx, ty) });
        continue;
      }
      if (dy < 0) {
        // Nudge around ceiling corners
        const side = this.cx < (tx + 0.5) * TILE ? -1 : 1;
        for (let k = 1; k <= T.cornerCorrection; k++) {
          for (const s of [side, -side]) {
            if (!lvl.boxHit(this.x + s * k, this.y, this.w, this.h)) {
              this.x += s * k;
              return;
            }
          }
        }
        this.y = (ty + 1) * TILE;
        this.vy = 0;
        this.jumping = false;
      } else {
        this.y = ty * TILE - this.h;
        this.vy = 0;
      }
      return;
    }
  }

  afterMove(dt, lvl) {
    const was = this.grounded;
    let g = this.vy >= 0 ? lvl.groundUnder(this.x, this.y, this.w, this.h, this.dropT <= 0) : null;
    // Water-walking
    const water = this.vy >= 0 && this.abilities.waterWalk && !this.sunk && !g ? lvl.calmWaterUnder(this.x, this.y, this.w, this.h) : null;
    const wasOnWater = this.onWater;
    this.onWater = water !== null && Math.abs(this.feetY - water) < 1;
    if (this.onWater) {
      g = [-2, -2];
      const slow = Math.abs(this.vx) < 70 && this.state === 'normal';
      this.sinkT = slow ? this.sinkT + dt : Math.max(0, this.sinkT - dt * 3);
      if (this.sinkT > 0.25 && !this.warnedSink) {
        this.warnedSink = true;
        this.emit('sinking');
      }
      if (this.sinkT > 0.75) {
        this.sunk = true;
        this.onWater = false;
        g = null;
        this.emit('sink');
      }
    } else {
      this.sinkT = 0;
      this.warnedSink = false;
    }
    if (this.onWater && !wasOnWater) this.emit('waterLand');
    this.grounded = g !== null;
    this.groundTile = g && g[1] >= 0 ? lvl.tileAt(g[0], g[1]) : null;
    if (this.grounded) {
      if (!was) this.emit('land', { speed: this.lastVy, fallTime: this.fallTime });
      this.coyote = T.coyoteTime;
      this.fallTime = 0;
      this.airJumps = 1;
      this.floating = false;
      this.wallDir = 0;
      if (!this.canDash && this.dashT <= 0) this.canDash = true;
      if (g[0] !== -2) this.sunk = false;
      // Remember the last solid footing that is not next to fire or water.
      const ty = g[1];
      const safe =
        ty >= 0 &&
        lvl.isSolidAt(Math.floor((this.x + 1) / TILE), ty) &&
        lvl.isSolidAt(Math.floor((this.x + this.w - 1) / TILE), ty) &&
        !lvl.hazardIn(this.x - TILE, this.y, this.w + TILE * 2, this.h + 18);
      if (safe) this.lastSafe = { x: this.cx, y: this.feetY };
    } else {
      this.fallTime = this.vy > 0 ? this.fallTime + dt : 0;
    }
  }

  // ── Animation ──────────────────────────────────────────────
  animate(dt, inp) {
    const r = this.rig;
    let pose;
    let rate = 22;
    if (this.state === 'dead') {
      pose = POSES.dead;
      rate = 10;
    } else if (this.state === 'rest') {
      pose = POSES.kneel;
      rate = 8;
    } else if (this.stunT > 0) pose = POSES.hurt;
    else if (this.hook && this.hook.phase === 'attached') {
      // hang from the rope: both arms reach for the anchor, legs swing with momentum
      const a = this.hook.anchor;
      const ang = Math.atan2((a.x - this.cx) * this.facing, a.y - (this.y + 12));
      const kick = Math.max(-0.9, Math.min(0.9, (this.vx * this.facing) / 500));
      pose = { ...POSES.fall, lean: kick * 0.4, armF: [ang, 0.05], armB: [ang - 0.15, 0.1], legF: [0.5 + kick * 0.6, -0.8], legB: [0.1 + kick * 0.4, -0.6], headTilt: -0.3 };
      rate = 30;
    } else if (this.dashT > 0) pose = POSES.dash;
    else if (this.wallDir !== 0) pose = POSES.wall;
    else if (this.floating) {
      pose = POSES.float;
      rate = 14;
    } else if (!this.grounded) {
      if (r.spinT > 0) pose = POSES.tuck;
      else pose = this.vy < -60 ? POSES.jump : POSES.fall;
      rate = 14;
    } else if (Math.abs(this.vx) > 25) {
      this.runPhase += (Math.abs(this.vx) * dt) / 10.5;
      pose = runPose(this.runPhase, Math.min(1.35, Math.abs(this.vx) / T.runSpeed));
      rate = 30;
    } else {
      pose = { ...POSES.idle, drop: Math.sin(r.time * 2.4) * 0.8 };
      rate = 14;
    }
    if (this.state === 'normal' && this.stunT <= 0 && this.dashT <= 0 && (this.attackT > 0 || this.followT > 0)) {
      const s = this.attackT > 0 ? 1 - this.attackT / T.attackDuration : 1;
      pose = attackPose(pose, this.attackKind, this.attackArc, s, this.grounded);
      rate = 400;
    }
    r.set(pose, rate);
    r.update(dt, this.cx, this.feetY, this.facing, this.vx, this.vy);
    // The facing shown during a wall slide is away from the wall.
    if (this.wallDir !== 0) this.drawFacing = -this.wallDir;
    else this.drawFacing = this.facing;
  }

  draw(ctx) {
    const blink = this.invuln > 0 && this.state !== 'dead' && Math.floor(this.invuln * 14) % 2 === 0;
    for (const g of this.ghosts) {
      ctx.globalAlpha = g.life * 1.6;
      g.rig.draw(ctx, g.x, g.y, g.facing, { silhouette: g.color });
    }
    const facing = this.drawFacing || this.facing;
    if (this.dashT > 0 && this.shadowDash) {
      // gone to smoke: a dark, see-through shape of yourself
      ctx.globalAlpha = 0.5;
      this.rig.draw(ctx, this.cx, this.feetY, facing, { silhouette: '#0c0814' });
      ctx.globalAlpha = 1;
      return;
    }
    ctx.globalAlpha = blink ? 0.35 : 1;
    this.rig.draw(ctx, this.cx, this.feetY, facing);
    if (this.dashT > 0) {
      // a quick blue flash over the body
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 * (this.dashT / T.dashDuration);
      this.rig.draw(ctx, this.cx, this.feetY, facing, { silhouette: '#4aa8ff' });
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
