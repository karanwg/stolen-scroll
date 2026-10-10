import { approach, clamp, lerp, rand, sign } from '../core/math.js';
import { moveBody } from '../world/body.js';
import { glow } from '../render/shapes.js';
import { drawXeno, xenoSkeleton, xenoToWorld } from '../render/xenoArt.js';
import { TILE } from '../config.js';

// XENOMORPH — the Third Name. It has made the Tethys's cargo bay its nest.
//
// It fights in a fixed cycle you can learn. Every attack has its own tell
// (pose + sound) and every attack ends in an opening where it's safe to cut it.
//
//   jaw    [rears its head back, hisses, teeth glint]
//          the second jaw stabs down and forward — safe right under its chin,
//          or well out of reach. Opening: its head hangs low.
//   sweep  [tail lifts and rattles]          a low sweep across the floor: jump it.
//   spit   [rears up, throat glows]          three arcs of acid at you: move.
//   stab   [tail curls high; a mark appears where you stand]
//          the blade comes down on the mark: step off it. It sticks: long opening.
//   leap   [crouches, screeches]             lands where you were with a shockwave:
//          jump as it lands, or be far away. Opening after the landing.
//   ceiling (phase 2) up the wall; three blades from above [shadows], then it
//          drops [big shadow]. Long opening after the drop.
//   grab   (phase 2) [arms thrown wide, roar] a lunge — if it catches you,
//          hammer X to stab free. Jump it or back off.
//
//   phase 1 cycle  jaw · sweep · spit · stab · leap
//   phase 2 cycle  ceiling · jaw · grab · sweep · stab · spit · leap   (a little faster)
//   phase 3        it tears out the bay door's release. The door blows, the ship
//                  lurches, everything slides toward the drop. Hold on (kaginawa),
//                  cut its grip until it goes.

const HP = 48;
const PHASE2_AT = 26;
const PHASE3_AT = 10;
const S = 2.1; // drawn scale: about four times your height
const GRAV = 2000;

const PATTERN = {
  1: ['jaw', 'sweep', 'spit', 'stab', 'leap'],
  2: ['ceiling', 'jaw', 'grab', 'sweep', 'stab', 'spit', 'leap'],
};
// how long each tell lasts (phase 1; phase 2 is a bit quicker)
const TELL = { jaw: 0.85, sweep: 0.8, spit: 0.7, stab: 0.8, leap: 0.75, grab: 0.8 };
// the opening after each attack
const REST = { jaw: 1.15, sweep: 0.9, spit: 0.9, stab: 1.4, leap: 1.1, grab: 1.2, drop: 1.6 };
// where it likes to stand for each attack (distance to you, px)
const RANGE = { jaw: [190, 320], sweep: [100, 250], spit: [260, 520], stab: [0, 9999], leap: [0, 9999], grab: [0, 140], ceiling: [0, 9999] };
const STAB_LOCK = 0.38; // the mark appears this long before the blade lands

// Phase three's pull toward the open door.
export class Suction {
  constructor(x0, x1, y0, y1, strength) {
    Object.assign(this, { x0, x1, y0, y1, strength, dir: 1, force: 0, k: 0 });
  }
  update(dt) {
    this.k = Math.min(1, this.k + dt * 0.7);
    this.force = this.strength * this.k;
  }
  contains(p) {
    return p.cx > this.x0 && p.cx < this.x1 && p.feetY > this.y0 && p.y < this.y1;
  }
}

export class Xenomorph {
  constructor(cx, floorY, arena) {
    this.arena = arena;
    this.w = 96;
    this.h = 176;
    this.x = cx - this.w / 2;
    this.y = floorY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.hp = HP;
    this.maxHp = HP;
    this.state = 'dormant';
    this.t = 0;
    this.time = 0;
    this.flash = 0;
    this.phase = 1;
    this.step = 0;
    this.dead = false;
    this.isBoss = true;
    this.name = 'XENOMORPH';
    this.title = 'The Third Name';
    this.walk = 0;
    this.pose = {};
    this.cling = null;
    this.alpha = 1;
    this.stabs = [];
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
  get alive() {
    return !this.dead && this.state !== 'dying' && this.state !== 'falling';
  }
  get hurtable() {
    return this.alive && !['dormant', 'intro', 'roar', 'breakout'].includes(this.state);
  }
  // phase two is a touch quicker: shorter tells, shorter openings
  get quick() {
    return this.phase >= 2 ? 0.88 : 1;
  }

  wake() {
    this.state = 'intro';
    this.t = 3.8;
    this.alpha = 0;
  }

  setState(s, t) {
    this.state = s;
    this.t = t;
  }

  // ── Getting hurt ───────────────────────────────────────────
  hurt(dmg, dirX, game) {
    if (!this.hurtable) return false;
    this.hp -= dmg;
    this.flash = 0.1;
    // its blood is acid: it sprays and smokes (it doesn't come back at you)
    const sh = this.worldPoint(xenoSkeleton(this.pose).shoulder);
    game.particles.burst(sh[0], sh[1] + 30, 10, { color: 'rgb(170,255,90)', size: 2.4, speed: 260, life: 0.6, grav: 900, additive: true });
    game.audio.play('sizzle');
    if (this.state === 'cling') {
      // each cut loosens its grip
      this.x += 40;
      this.vx = 0;
      game.camera.kick(4, 0);
    }
    if (this.hp <= 0) {
      this.hp = 0;
      if (this.state === 'cling') this.letGo(game);
      else {
        this.hp = 1;
        if (this.phase < 3) this.startBreakout(game);
      }
      return true;
    }
    if (this.phase === 1 && this.hp <= PHASE2_AT) {
      this.phase = 2;
      this.step = 0;
      this.cling = null;
      this.stabs = [];
      this.y = Math.min(this.y, this.arena.floorY - this.h);
      this.setState('roar', 1.8);
      game.audio.play('xenoRoar');
      game.camera.shake(0.9);
    } else if (this.phase === 2 && this.hp <= PHASE3_AT) this.startBreakout(game);
    return true;
  }

  startBreakout(game) {
    this.phase = 3;
    this.cling = null;
    this.stabs = [];
    if (this.state === 'grab') this.breakGrab(game, true);
    this.y = Math.min(this.y, this.arena.floorY - this.h);
    this.setState('breakout', 2.6);
    this.vx = 0;
    game.audio.play('xenoRoar');
  }

  // The door blows: it gets dragged to the threshold and digs in.
  onDoorBlown() {
    this.facing = -1;
    this.setState('cling', 99);
    this.clawT = 1.2;
    this.y = this.arena.floorY - this.h;
  }

  letGo(game) {
    this.setState('falling', 3.4);
    this.vx = 300;
    this.vy = -160;
    game.audio.play('xenoFall');
    game.onBossDefeated(this);
  }

  // ── Thinking ───────────────────────────────────────────────
  update(dt, game) {
    this.time += dt;
    this.t -= dt;
    this.flash = Math.max(0, this.flash - dt);
    this.waveT = Math.max(0, (this.waveT || 0) - dt);
    const p = game.player;
    const A = this.arena;
    const dx = p.cx - this.cx;
    const dist = Math.abs(dx);
    const toP = sign(dx) || this.facing;
    const q = this.quick;
    let gravityOn = !this.cling;

    switch (this.state) {
      case 'dormant':
        gravityOn = false;
        break;
      case 'intro': {
        // it peels itself out of the nest wall, steps down, and screams
        const k = 1 - this.t / 3.8;
        this.alpha = clamp(k * 2.5, 0, 1);
        this.facing = toP;
        if (k > 0.35 && k < 0.6) {
          this.vx = toP * 60;
          this.walk += dt * 4;
        } else this.vx = 0;
        if (!this.roared && k > 0.6) {
          this.roared = true;
          game.audio.play('xenoRoar');
          game.camera.shake(1.1);
        }
        if (this.t <= 0) this.next(game);
        break;
      }
      case 'approach': {
        // walk to where the next attack wants you
        this.facing = toP;
        const [lo, hi] = RANGE[this.queued];
        const want = dist > hi ? toP : dist < lo ? -toP : 0;
        this.vx = approach(this.vx, want * 220, 1400 * dt);
        this.walk += (Math.abs(this.vx) * dt) / 22;
        if (this.t <= 0 || (want === 0 && this.t < this.approachMax - 0.25)) this.begin(game);
        break;
      }
      case 'jawTell':
        this.vx = approach(this.vx, 0, 2000 * dt);
        this.facing = toP;
        if (this.t <= 0) {
          this.vx = this.facing * 560;
          this.setState('jaw', 0.45);
          game.audio.play('innerJaw');
          game.camera.kick(this.facing * 6, 0);
        }
        break;
      case 'jaw':
        this.vx = approach(this.vx, 0, 2400 * dt);
        if (this.t <= 0) this.rest(game, 'jaw');
        break;
      case 'sweepTell':
        this.vx = approach(this.vx, 0, 2000 * dt);
        if (Math.random() < dt * 12) game.audio.play('rattle');
        if (this.t <= 0) {
          this.setState('sweep', 0.36);
          game.audio.play('tailWhoosh');
        }
        break;
      case 'sweep':
        if (this.t <= 0) this.rest(game, 'sweep');
        break;
      case 'stabTell':
        this.vx = approach(this.vx, 0, 2000 * dt);
        this.facing = toP;
        // the mark: where you stand when it locks on is where the blade lands
        if (!this.stabAt && this.t <= STAB_LOCK) {
          this.stabX = clamp(p.cx, A.x0 + 30, A.x1 - 30);
          this.stabAt = this.localOf(this.stabX, A.floorY - 4);
          game.audio.play('rattle');
        }
        if (this.t <= 0) {
          this.setState('stab', 0.14);
          game.audio.play('lunge');
        }
        break;
      case 'stab':
        if (this.t <= 0) {
          this.setState('stuck', REST.stab * q);
          game.camera.shake(0.3);
          const tip = this.worldPoint(this.stabAt);
          game.particles.burst(tip[0], tip[1], 14, { kind: 'streak', color: 'rgb(255,220,170)', speed: 300, life: 0.25, size: 1.5, additive: true });
          game.audio.play('clang');
        }
        break;
      case 'stuck':
        if (this.t <= 0) {
          this.stabAt = null;
          this.next(game, 0.3);
        }
        break;
      case 'leapTell':
        this.vx = approach(this.vx, 0, 2000 * dt);
        this.facing = toP;
        if (this.t <= 0) {
          const air = 0.8;
          this.leapX = clamp(p.cx, A.x0 + 90, A.x1 - 90);
          this.vx = (this.leapX - this.cx) / air;
          this.vy = -0.5 * GRAV * air;
          this.setState('leap', 2);
          game.audio.play('xenoScreech');
        }
        break;
      case 'leap':
        if (this.grounded && this.t < 1.9) {
          this.vx = 0;
          this.leapX = null;
          this.shockwave(game);
          this.rest(game, 'leap');
        }
        break;
      case 'spitTell':
        this.vx = approach(this.vx, 0, 2000 * dt);
        this.facing = toP;
        if (this.t <= 0) {
          const m = this.worldPoint(xenoSkeleton(this.pose).mouth);
          for (let i = -1; i <= 1; i++) {
            const air = 0.9 + i * 0.08;
            const tx = p.cx + i * 170;
            game.projectiles.push(new AcidDrop(m[0], m[1], (tx - m[0]) / air, (p.cy - m[1] - 0.5 * 1500 * air * air) / air, true));
          }
          game.audio.play('acidSpit');
          this.setState('spit', 0.35);
        }
        break;
      case 'spit':
        if (this.t <= 0) this.rest(game, 'spit');
        break;
      case 'grabTell':
        this.vx = approach(this.vx, 0, 2000 * dt);
        this.facing = toP;
        if (this.t <= 0) {
          this.vx = this.facing * 560;
          this.setState('grabLunge', 0.35);
          game.audio.play('lunge');
        }
        break;
      case 'grabLunge': {
        this.vx = approach(this.vx, 0, 1500 * dt);
        // its claws sweep low in front of it: anything standing there is caught
        const front = this.cx + this.facing * 40;
        const inReach = (p.cx - front) * this.facing > -30 && (p.cx - front) * this.facing < 150 && p.feetY > this.feetY - 110;
        if (!p.immune && p.state === 'normal' && p.invuln <= 0 && inReach) this.startGrab(game);
        else if (this.t <= 0) this.rest(game, 'grab');
        break;
      }
      case 'grab': {
        // you, held up to its face; the inner jaw winds back
        this.vx = 0;
        const hold = this.worldPoint(this.localOfHold());
        p.place(hold[0], hold[1] + 30);
        p.vx = 0;
        p.vy = 0;
        p.facing = -this.facing;
        if (game.input.pressed('attack')) {
          this.mash++;
          game.audio.play('struggle');
          game.camera.kick(rand(-4, 4), rand(-3, 3));
          this.flash = 0.06;
          game.particles.burst(p.cx - this.facing * 10, p.cy - 10, 5, { color: 'rgb(170,255,90)', speed: 160, life: 0.4, size: 2, grav: 600 });
        }
        if (this.mash >= 5) this.breakGrab(game, true);
        else if (this.t <= 0) this.breakGrab(game, false);
        break;
      }
      case 'stagger':
        this.vx = approach(this.vx, 0, 1200 * dt);
        if (this.t <= 0) this.next(game, 0.3);
        break;
      case 'climb': {
        gravityOn = false;
        const c = this.climbPath;
        c.k = Math.min(1, c.k + dt / c.dur);
        if (c.leg === 0) {
          this.x = lerp(c.x0, c.wallX, c.k) - this.w / 2;
          this.walk += dt * 10;
          if (c.k >= 1) Object.assign(c, { leg: 1, k: 0, dur: 0.6 });
        } else {
          this.cling = 'wall';
          this.y = lerp(A.floorY - this.h, A.ceilY, c.k);
          if (c.k >= 1) {
            this.cling = 'ceiling';
            this.y = A.ceilY;
            this.stabs = [];
            this.stabCount = 3;
            this.setState('ceilingStalk', 0.6);
          }
        }
        break;
      }
      case 'ceilingStalk':
        // across the roof, keeping over you; a blade at a time, each one marked
        gravityOn = false;
        this.facing = toP;
        this.x = approach(this.x, clamp(p.cx - 160 * this.facing, A.x0 + 80, A.x1 - 80) - this.w / 2, 420 * dt);
        this.walk += dt * 12;
        if (this.t <= 0) {
          if (this.stabCount > 0) {
            this.stabCount--;
            this.stabs.push({ x: clamp(p.cx, A.x0 + 40, A.x1 - 40), t: 0.8, hit: 0 });
            game.audio.play('rattle');
            this.setState('ceilingStalk', 1.0);
          } else {
            this.setState('dropTell', 0.9);
            game.audio.play('hiss');
          }
        }
        break;
      case 'dropTell':
        gravityOn = false;
        this.x = approach(this.x, clamp(p.cx, A.x0 + 70, A.x1 - 70) - this.w / 2, 110 * dt);
        if (Math.random() < 0.4) game.particles.add({ x: this.cx + rand(-10, 10), y: A.ceilY + 60, vx: 0, vy: 260, size: 1.8, color: 'rgba(200,230,210,0.7)', life: 1.2, grav: 600 });
        if (this.t <= 0) {
          this.cling = null;
          this.y = A.ceilY;
          this.vy = 300;
          this.setState('drop', 2);
        }
        break;
      case 'drop':
        if (this.grounded) {
          this.shockwave(game);
          this.rest(game, 'drop');
        }
        break;
      case 'roar':
        this.vx = approach(this.vx, 0, 2000 * dt);
        if (this.t <= 0) this.next(game, 0.3);
        break;
      case 'recover':
        // the opening: slow, low, its guard down
        this.vx = approach(this.vx, 0, 1600 * dt);
        if (this.t <= 0) this.next(game);
        break;
      case 'breakout': {
        // it turns on the door and tears the emergency release out of the wall
        const k = 1 - this.t / 2.6;
        if (k < 0.45) {
          this.facing = 1;
          const tx = A.x1 - 130;
          this.vx = Math.abs(tx - this.cx) < 20 ? 0 : approach(this.vx, sign(tx - this.cx) * 460, 2200 * dt);
          this.walk += (Math.abs(this.vx) * dt) / 22;
        } else this.vx = 0;
        if (!this.ripped && k > 0.55) {
          this.ripped = true;
          game.audio.play('klaxon');
          game.camera.shake(1);
          game.particles.burst(A.x1 - 20, A.floorY - 160, 30, { kind: 'streak', color: 'rgb(255,200,120)', speed: 420, life: 0.4, size: 2, additive: true });
          game.hud.showToast('OUTER DOOR · EMERGENCY RELEASE', 2.2);
        }
        if (this.t <= 0) game.blowBayDoor(this);
        break;
      }
      case 'cling': {
        // dragged toward the void, claws in the deck, hauling itself back at you
        this.facing = -1;
        const crawl = dx < -60 ? -110 : 0;
        this.vx = 45 + crawl;
        this.walk += dt * 6;
        // its swipe: the claw goes up first (and glints), then comes down
        this.clawT -= dt;
        if (this.clawT <= 0 && !this.swipeTell && dx < 0 && dist < 240) {
          this.swipeTell = 0.55;
          game.audio.play('hiss');
        }
        if (this.swipeTell > 0) {
          this.swipeTell -= dt;
          if (this.swipeTell <= 0) {
            this.swipeTell = 0;
            this.swipeT = 0.25;
            this.clawT = 1.6;
            game.audio.play('lunge');
          }
        }
        this.swipeT = Math.max(0, (this.swipeT || 0) - dt);
        if (Math.random() < dt * 10) game.particles.add({ x: this.cx + rand(-40, 40), y: this.feetY - 2, vx: rand(-40, 40), vy: rand(-120, -40), kind: 'streak', size: 1.2, color: 'rgb(255,210,160)', life: 0.2, additive: true });
        if (this.cx - 30 > A.x1) this.letGo(game);
        break;
      }
      case 'falling':
        this.vy += GRAV * 0.6 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.spin = (this.spin || 0) + dt * 1.6;
        if (this.t <= 0) this.dead = true;
        break;
    }

    // blades from the ceiling
    for (const st of this.stabs) {
      st.t -= dt;
      if (st.t <= 0 && !st.fired) {
        st.fired = true;
        st.hit = 0.16;
        game.audio.play('lunge');
        game.camera.shake(0.25);
        game.particles.burst(st.x, A.floorY - 2, 12, { kind: 'streak', color: 'rgb(255,220,170)', speed: 280, life: 0.25, size: 1.5, additive: true, angle: -Math.PI / 2, spread: 2 });
      }
      if (st.fired) st.hit -= dt;
    }
    this.stabs = this.stabs.filter((st) => !st.fired || st.hit > -0.3);

    if (this.state === 'falling') {
      this.buildPose();
      return;
    }
    if (gravityOn) {
      this.vy = Math.min(this.vy + GRAV * dt, 1400);
      moveBody(this, game.level, dt, { oneWay: false });
    } else this.grounded = false;
    const right = this.state === 'cling' ? A.x1 + 400 : A.x1 - 4;
    this.x = clamp(this.x, A.x0 + 4, right - this.w);
    this.buildPose();
  }

  // The next attack in the cycle: walk into range for it first.
  next(game, approachTime) {
    const cycle = PATTERN[Math.min(2, this.phase)];
    this.queued = cycle[this.step % cycle.length];
    this.step++;
    this.approachMax = approachTime ?? (this.phase >= 2 ? 0.8 : 1.1);
    this.setState('approach', this.approachMax);
  }

  begin(game) {
    const c = this.queued;
    const q = this.quick;
    if (c === 'ceiling') {
      const A = this.arena;
      const wallX = this.cx - A.x0 < A.x1 - this.cx ? A.x0 + 60 : A.x1 - 60;
      this.climbPath = { leg: 0, k: 0, dur: Math.max(0.3, Math.abs(wallX - this.cx) / 600), x0: this.cx, wallX };
      this.wallSide = wallX < (A.x0 + A.x1) / 2 ? -1 : 1;
      this.setState('climb', 9);
      game.audio.play('skitter');
      return;
    }
    this.vx = 0;
    this.stabAt = null;
    this.setState(c + 'Tell', TELL[c] * q);
    if (c === 'jaw' || c === 'leap') game.audio.play('hiss');
    if (c === 'grab') game.audio.play('xenoScreech');
    if (c === 'spit') game.audio.play('acidSpit');
  }

  rest(game, kind) {
    this.setState('recover', REST[kind] * this.quick);
  }

  shockwave(game) {
    game.camera.shake(0.7);
    game.audio.play('slam');
    game.particles.burst(this.cx, this.feetY, 26, { kind: 'smoke', color: 'rgba(70,74,80,0.6)', size: 8, grow: 40, speed: 320, angle: -Math.PI / 2, spread: Math.PI, life: 0.7, drag: 3 });
    this.wave = { x: this.cx - 170, y: this.feetY - 24, w: 340, h: 24 };
    this.waveT = 0.12;
  }

  startGrab(game) {
    const p = game.player;
    this.setState('grab', 2.2);
    this.mash = 0;
    p.state = 'cutscene';
    p.hook = null;
    game.audio.play('grab');
    game.camera.shake(0.5);
    game.hud.showToast('X  X  X  —  stab free!', 1.6);
  }

  breakGrab(game, free) {
    const p = game.player;
    p.state = 'normal';
    p.vx = -this.facing * 520;
    p.vy = -380;
    p.stunT = 0.25;
    if (free) {
      this.hp = Math.max(1, this.hp - 3);
      this.flash = 0.2;
      this.setState('stagger', 1.6);
      this.vx = -this.facing * 160;
      game.audio.play('xenoScreech');
      game.camera.shake(0.6);
      p.invuln = 1;
    } else {
      game.audio.play('innerJaw');
      p.invuln = 0;
      p.hurt(this.cx);
      game.handlePlayerEvents();
      this.rest(game, 'grab');
    }
  }

  // ── Geometry ───────────────────────────────────────────────
  worldPoint(local) {
    if (this.cling === 'wall') return [this.wallSide < 0 ? this.arena.x0 + 20 : this.arena.x1 - 20, this.cy];
    if (this.cling === 'ceiling') return xenoToWorld(this.cx, this.arena.ceilY, this.facing, S, local, 'ceiling');
    return xenoToWorld(this.cx, this.feetY, this.facing, S, local);
  }

  localOf(wx, wy) {
    if (this.cling === 'ceiling') return [(wx - this.cx) / (this.facing * S), -(wy - this.arena.ceilY) / S];
    return [(wx - this.cx) / (this.facing * S), (wy - this.feetY) / S];
  }

  localOfHold() {
    const sk = xenoSkeleton(this.pose);
    return [sk.mouth[0] + 14, sk.mouth[1] + 10];
  }

  buildPose() {
    const s = this.state;
    const p = { flash: this.flash, walk: this.walk, moving: Math.min(1, Math.abs(this.vx) / 200), tail: this.time * 1.6, breathe: this.time * 1.4, cling: this.cling };
    const k = (dur) => clamp(1 - this.t / dur, 0, 1);
    const q = this.quick;
    if (s === 'intro') Object.assign(p, this.roared ? { rear: 1, jaw: 1, claw: 0.7, head: -0.15 } : { crouch: 0.6 });
    if (s === 'approach') Object.assign(p, { jaw: Math.max(0, Math.sin(this.time * 0.9)) * 0.2, crouch: 0.2 });
    if (s === 'jawTell') Object.assign(p, { crouch: 0.4, lean: -0.25, head: -0.25, jaw: 0.3 + k(TELL.jaw * q) * 0.7, inner: Math.max(0, Math.sin(this.time * 40)) * 0.08, innerLen: 30 });
    if (s === 'jaw') Object.assign(p, { lean: 0.5, crouch: 0.3, jaw: 1, inner: Math.min(1, k(0.45) * 5) * (this.t > 0.12 ? 1 : this.t / 0.12), innerLen: 95, claw: 0.4 });
    if (s === 'sweepTell') Object.assign(p, { crouch: 0.7, tailRaise: 0.6, tail: this.time * 16, jaw: 0.3 });
    if (s === 'sweep') Object.assign(p, { crouch: 0.75, tailSweep: k(0.36), lean: 0.2 });
    if (s === 'stabTell') Object.assign(p, { crouch: 0.45, tailRaise: Math.min(1, k(TELL.stab * q) * 2), tail: this.time * 10 });
    if (s === 'stab') Object.assign(p, { crouch: 0.45, lean: 0.25, tailStab: k(0.14), stab: this.stabAt });
    if (s === 'stuck') Object.assign(p, { crouch: 0.45, lean: 0.25, tailStab: 1, stab: this.stabAt, jaw: 0.4 + Math.sin(this.time * 20) * 0.1 });
    if (s === 'leapTell') Object.assign(p, { crouch: 1, jaw: 0.7, claw: 0.5 });
    if (s === 'leap') Object.assign(p, { lean: 0.55, claw: 1, crouch: 0.2, tailRaise: 0.3 });
    if (s === 'spitTell') Object.assign(p, { rear: 0.45, jaw: 0.4 + k(TELL.spit * q) * 0.5, head: -0.25 });
    if (s === 'spit') Object.assign(p, { rear: 0.3, jaw: 1, lean: 0.3 });
    if (s === 'grabTell') Object.assign(p, { claw: 1, rear: 0.3, jaw: 0.8 });
    if (s === 'grabLunge') Object.assign(p, { reach: 1, lean: 0.7, crouch: 0.7, jaw: 0.8 });
    if (s === 'grab') Object.assign(p, { reach: 0.6, rear: 0.35, jaw: 1, inner: k(2.2) * 0.35 + Math.abs(Math.sin(this.time * 30)) * 0.04, innerLen: 30 });
    if (s === 'stagger') Object.assign(p, { rear: 0.5, jaw: 1, head: -0.3, claw: 0.6 });
    if (s === 'ceilingStalk' || s === 'dropTell') Object.assign(p, { crouch: 0.6, jaw: s === 'dropTell' ? 0.7 : 0.2, tailRaise: 0.6 });
    if (s === 'roar' || s === 'breakout') Object.assign(p, { rear: 1, jaw: 1, claw: 1, head: -0.15 });
    // the opening: head hanging low, mouth slack, breathing hard
    if (s === 'recover') Object.assign(p, { crouch: 0.6, lean: 0.35, head: 0.25, jaw: 0.35, breathe: this.time * 4 });
    if (s === 'cling') Object.assign(p, { crouch: 0.9, lean: 0.4, claw: this.swipeTell > 0 ? 1 : 0.4, reach: this.swipeT > 0 ? 1 : 0.3, jaw: 0.8, tail: this.time * 8 });
    if (s === 'falling') Object.assign(p, { reach: 1, jaw: 1, claw: 1, rear: 0.5 });
    this.pose = p;
  }

  // ── Damage to you ──────────────────────────────────────────
  // Only its attacks hurt — walking into it while it stalks doesn't.
  hurtsPlayer(box) {
    if (this.stabHits(box)) return true;
    if (!this.alive) return false;
    const sk = xenoSkeleton(this.pose);
    switch (this.state) {
      case 'jaw':
        if (this.pose.inner > 0.3 && segBox(this.worldPoint(sk.mouth), this.worldPoint(sk.innerTip), box, 16)) return true;
        return ptBox(this.worldPoint(sk.snout), box, 24);
      case 'sweep':
        for (const pt of sk.tail.slice(8)) {
          const w = this.worldPoint(pt);
          if (w[1] > this.arena.floorY - 70 && ptBox(w, box, 12)) return true;
        }
        return false;
      case 'stab':
        for (const pt of sk.tail.slice(-5)) if (ptBox(this.worldPoint(pt), box, 12)) return true;
        return false;
      case 'leap':
      case 'drop':
        return overlap(box, this.bodyBox());
      case 'cling':
        return this.swipeT > 0 && ptBox(this.worldPoint(sk.arms[0].hand), box, 44);
    }
    return this.waveT > 0 && this.wave && overlap(box, this.wave);
  }

  stabHits(box) {
    for (const st of this.stabs) {
      if (st.fired && st.hit > 0 && box.x < st.x + 14 && box.x + box.w > st.x - 14 && box.y + box.h > this.arena.ceilY + 40) return true;
    }
    return false;
  }

  bodyBox() {
    if (this.cling === 'ceiling') return { x: this.cx - 70, y: this.arena.ceilY, w: 140, h: 90 };
    if (this.cling === 'wall') return { x: this.wallSide < 0 ? this.arena.x0 : this.arena.x1 - 90, y: this.y, w: 90, h: 160 };
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  // Where your sword can find it: body, head, and a stuck tail.
  hitBy(box) {
    if (!this.hurtable) return false;
    if (overlap(box, this.bodyBox())) return true;
    const sk = xenoSkeleton(this.pose);
    if (ptBox(this.worldPoint(sk.snout), box, 40) || ptBox(this.worldPoint(sk.dome), box, 30)) return true;
    if (this.state === 'stuck') for (const pt of sk.tail.slice(-8)) if (ptBox(this.worldPoint(pt), box, 12)) return true;
    return false;
  }

  hitboxes() {
    return [];
  }

  // ── Drawing ────────────────────────────────────────────────
  draw(ctx) {
    if (this.dead || this.state === 'dormant') return;
    const A = this.arena;
    const mark = (x, k, wide = 1) => {
      // a dark shadow tightening on the floor, ringed in red as it gets close
      ctx.fillStyle = `rgba(0,0,0,${0.3 + k * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(x, A.floorY - 2, (14 + k * 20) * wide, 5 + k * 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,70,50,${0.25 + k * 0.6})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    };
    for (const st of this.stabs) if (!st.fired) mark(st.x, 1 - st.t / 0.8);
    if (this.state === 'stabTell' && this.stabAt) mark(this.stabX, 1 - this.t / STAB_LOCK);
    if (this.state === 'leap' && this.leapX != null) mark(this.leapX, 0.7, 3.2);
    if (this.state === 'dropTell') mark(this.cx, 1 - this.t / 0.9, 3);
    ctx.save();
    ctx.globalAlpha = this.alpha;
    if (this.state === 'intro' && this.alpha < 1) ctx.filter = `brightness(${0.3 + this.alpha * 0.7})`;
    this.drawBody(ctx, {});
    ctx.restore();
    // blades punching down out of the dark
    for (const st of this.stabs) {
      if (!st.fired || st.hit < -0.2) continue;
      ctx.fillStyle = '#0b0f14';
      ctx.beginPath();
      ctx.moveTo(st.x - 7, A.ceilY + 60);
      ctx.lineTo(st.x + 7, A.ceilY + 60);
      ctx.lineTo(st.x, A.floorY);
      ctx.fill();
    }
  }

  drawBody(ctx, opts) {
    if (this.cling === 'wall') {
      ctx.save();
      const left = this.wallSide < 0;
      ctx.translate(left ? this.arena.x0 + 10 : this.arena.x1 - 10, this.y + this.h / 2);
      ctx.rotate(left ? Math.PI / 2 : -Math.PI / 2);
      drawXeno(ctx, 0, 0, left ? -1 : 1, { ...this.pose, cling: null, moving: 1 }, S, opts);
      ctx.restore();
    } else if (this.state === 'falling') {
      ctx.save();
      ctx.translate(this.cx, this.feetY - 80);
      ctx.rotate(this.spin || 0);
      drawXeno(ctx, 0, 80, this.facing, this.pose, S, opts);
      ctx.restore();
    } else if (this.cling === 'ceiling') drawXeno(ctx, this.cx, this.arena.ceilY, this.facing, this.pose, S, opts);
    else drawXeno(ctx, this.cx, this.feetY, this.facing, this.pose, S, opts);
  }

  // After the lighting pass: the wet sheen on its head and back, and glints
  // that warn you what's coming.
  drawOver(ctx) {
    if (this.dead || this.state === 'dormant') return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    this.drawBody(ctx, { pass: 'sheen' });
    ctx.restore();
    const sk = xenoSkeleton(this.pose);
    const glint = (pt, k) => {
      const [gx, gy] = this.worldPoint(pt);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, gx, gy, 30 + k * 30, 'rgb(255,240,220)', 0.5 * k);
      ctx.strokeStyle = `rgba(255,250,240,${k})`;
      ctx.lineWidth = 1.6;
      const r = 6 + k * 14;
      ctx.beginPath();
      ctx.moveTo(gx - r, gy);
      ctx.lineTo(gx + r, gy);
      ctx.moveTo(gx, gy - r);
      ctx.lineTo(gx, gy + r);
      ctx.stroke();
      ctx.restore();
    };
    const tell = (name) => clamp(1 - this.t / (TELL[name] * this.quick * 0.5), 0, 1);
    if (this.state === 'jawTell') glint(sk.mouth, tell('jaw'));
    if (this.state === 'stabTell') glint(sk.tail[sk.tail.length - 1], tell('stab'));
    if (this.state === 'grabTell') glint(sk.arms[0].hand, 0.8);
    if (this.state === 'cling' && this.swipeTell > 0) glint(sk.arms[0].hand, 1 - this.swipeTell / 0.55);
    if (this.state === 'spitTell') {
      // the throat swells and glows
      const [gx, gy] = this.worldPoint(sk.mouth);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, gx - this.facing * 20, gy + 16, 40, 'rgb(150,255,80)', 0.6 * tell('spit'));
      ctx.restore();
    }
  }

  light(out) {
    if (this.dead || this.state === 'dormant') return;
    out.push({ x: this.cx, y: this.cy, r: 240, color: 'rgb(150,190,205)', i: 0.48 * this.alpha });
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function ptBox([x, y], box, r) {
  return x > box.x - r && x < box.x + box.w + r && y > box.y - r && y < box.y + box.h + r;
}

function segBox(a, b, box, r) {
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    if (ptBox([lerp(a[0], b[0], u), lerp(a[1], b[1], u)], box, r)) return true;
  }
  return false;
}

// Acid spit: arcs, burns, leaves a smoking puddle for a moment.
export class AcidDrop {
  constructor(x, y, vx, vy, big = false) {
    const r = big ? 7 : 4;
    Object.assign(this, { x: x - r, y: y - r, w: r * 2, h: r * 2, r, vx, vy, dead: false, damage: 1, harmless: false, big });
  }
  update(dt, game) {
    this.vy += 1500 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const hit = game.level.boxHit(this.x, this.y, this.w, this.h, true, this.y + this.h - this.vy * dt);
    if (hit) {
      this.dead = true;
      const puddles = game.projectiles.filter((p) => p instanceof AcidPuddle).length;
      if (puddles < 6 && this.vy > 0) game.projectiles.push(new AcidPuddle(this.x + this.r, hit[1] * TILE, this.big));
      if (this.big) game.audio.play('sizzle');
    }
  }
  draw(ctx) {
    glow(ctx, this.x + this.r, this.y + this.r, this.r * 4, 'rgb(170,255,80)', 0.6);
    ctx.fillStyle = '#b8ff5a';
    ctx.beginPath();
    ctx.arc(this.x + this.r, this.y + this.r, this.r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  light(out) {
    if (this.big) out.push({ x: this.x + this.r, y: this.y + this.r, r: 80, color: 'rgb(150,255,80)', i: 0.5 });
  }
}

export class AcidPuddle {
  constructor(cx, floorY, big = false) {
    const w = big ? 56 : 40;
    Object.assign(this, { x: cx - w / 2, y: floorY - 10, w, h: 10, dead: false, damage: 1, life: big ? 1.6 : 1.2, harmless: true, t: 0 });
  }
  update(dt, game) {
    this.t += dt;
    this.life -= dt;
    this.harmless = this.t < 0.2 || this.life < 0.4;
    if (Math.random() < 0.3) game.particles.add({ x: this.x + rand(4, this.w - 4), y: this.y + 4, vx: rand(-8, 8), vy: rand(-50, -20), kind: 'smoke', size: 2, grow: 10, color: 'rgba(150,230,90,0.25)', life: 0.6 });
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const k = Math.min(1, this.life / 0.5, this.t / 0.2);
    ctx.fillStyle = `rgba(150,240,60,${0.75 * k})`;
    ctx.beginPath();
    ctx.ellipse(this.x + this.w / 2, this.y + this.h - 3, this.w / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    glow(ctx, this.x + this.w / 2, this.y + this.h - 4, this.w * 0.8, 'rgb(150,255,80)', 0.4 * k);
  }
  light(out) {
    out.push({ x: this.x + this.w / 2, y: this.y, r: 90, color: 'rgb(140,255,80)', i: 0.5 });
  }
}
