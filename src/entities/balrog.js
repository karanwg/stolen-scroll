import { approach, clamp, lerp, rand, sign, damp, easeOutCubic, pick } from '../core/math.js';
import { moveBody } from '../world/body.js';
import { drawFlame, glow } from '../render/shapes.js';
import { Fireball, FlameWave } from './projectiles.js';

// BALROG — the flame that took Kagari.
// Part western fire demon, part armoured oni: lacquered samurai plates over
// molten skin, an oni menpo, horned kabuto with a gold crescent, smoke wings,
// and a burning whip.
//
// Attacks (tells in brackets):
//   spit     — [head rears back, mouth glows] 3 fireballs (5 in phase 2) that leave fire on the floor
//   whipLow  — [arm low behind] floor-level sweep: JUMP it
//   whipHigh — [arm raised high] head-height sweep: stay LOW / on the ground
//   leap     — [crouch] jumps at you, slam sends flame waves both ways
//   charge   — phase 2 [paws ground] runs wall to wall, stuns itself on impact
//   breath   — phase 2 [deep inhale] long fire stream along the floor: get above or behind it

const HP = 44;
const GRAV = 2000;

export class Balrog {
  constructor(cx, feetY) {
    this.w = 84;
    this.h = 150;
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
    this.hp = HP;
    this.maxHp = HP;
    this.state = 'dormant';
    this.t = 0;
    this.time = 0;
    this.phase2 = false;
    this.flash = 0;
    this.dead = false;
    this.isBoss = true;
    this.name = 'BALROG';
    this.title = 'The Flame that Took Kagari';
    this.hitsSinceStagger = 0;
    this.walkPhase = 0;
    this.lastAttack = '';
    this.spitCount = 0;
    this.anim = { crouch: 0, armR: 0.4, armL: -0.3, head: 0, mouth: 0, wing: 0, lean: 0, rise: 0 };
    this.whip = { mode: 'hang', k: 0, high: false };
    this.contact = true;
  }

  get cx() {
    return this.x + this.w / 2;
  }
  get feetY() {
    return this.y + this.h;
  }
  get alive() {
    return !this.dead && this.state !== 'dying';
  }
  get hurtable() {
    return this.alive && this.state !== 'dormant' && this.state !== 'intro' && this.state !== 'roar';
  }

  wake() {
    this.state = 'intro';
    this.t = 3.2;
  }

  hurt(dmg, dirX, game) {
    if (!this.hurtable) return false;
    this.hp -= dmg;
    this.flash = 0.1;
    this.hitsSinceStagger++;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dying';
      this.t = 3.4;
      this.contact = false;
      this.vx = 0;
      game.onBossDefeated(this);
      return true;
    }
    if (!this.phase2 && this.hp <= this.maxHp * 0.5) {
      this.phase2 = true;
      this.setState('roar', 1.8);
      game.audio.play('roar');
      game.camera.shake(0.8);
      return true;
    }
    if (this.hitsSinceStagger >= 9 && ['idle', 'recover', 'walk'].includes(this.state)) {
      this.hitsSinceStagger = 0;
      this.setState('stagger', 1.0);
    }
    return true;
  }

  setState(s, t) {
    this.state = s;
    this.t = t;
  }

  update(dt, game) {
    this.time += dt;
    this.flash -= dt;
    this.t -= dt;
    const p = game.player;
    const dx = p.cx - this.cx;
    const dist = Math.abs(dx);
    const toP = sign(dx) || this.facing;
    const a = this.anim;
    const speedK = this.phase2 ? 1.3 : 1;

    // ambient fire
    if (this.state !== 'dormant' && this.state !== 'dead' && Math.random() < 0.6) {
      game.particles.add({ x: this.cx + rand(-40, 40), y: this.y + rand(0, 60), vx: rand(-20, 20), vy: rand(-120, -50), size: rand(1.5, 3), color: 'rgb(255,150,60)', additive: true, life: rand(0.5, 1) });
    }

    switch (this.state) {
      case 'dormant':
        a.rise = 0;
        break;
      case 'intro':
        a.rise = clamp(1 - (this.t - 1.2) / 2, 0, 1);
        if (this.t < 2.2 && this.t + dt >= 2.2) {
          game.audio.play('roar');
          game.camera.shake(0.9);
        }
        if (this.t <= 0) this.setState('idle', 0.8);
        break;
      case 'idle':
      case 'walk': {
        this.facing = toP;
        if (dist > 330) {
          this.state = 'walk';
          this.vx = approach(this.vx, toP * 110 * speedK, 600 * dt);
        } else {
          this.state = 'idle';
          this.vx = approach(this.vx, 0, 800 * dt);
        }
        if (this.t <= 0) this.chooseAttack(dist, game);
        break;
      }
      case 'spitWind':
        this.vx = 0;
        if (Math.random() < 0.8) {
          const mx = this.cx + this.facing * 40;
          const my = this.y + 20;
          const ang = rand(0, Math.PI * 2);
          game.particles.add({ x: mx + Math.cos(ang) * 60, y: my + Math.sin(ang) * 60, vx: -Math.cos(ang) * 160, vy: -Math.sin(ang) * 160, size: 2, color: 'rgb(255,190,90)', additive: true, life: 0.35 });
        }
        if (this.t <= 0) {
          this.setState('spit', 0.9);
          this.spitCount = this.phase2 ? 5 : 3;
          this.spitTimer = 0;
        }
        break;
      case 'spit':
        this.spitTimer -= dt;
        if (this.spitCount > 0 && this.spitTimer <= 0) {
          this.spitTimer = 0.16;
          const i = (this.phase2 ? 5 : 3) - this.spitCount;
          this.spitCount--;
          const mx = this.cx + this.facing * 38;
          const my = this.y + 22;
          const spread = this.phase2 ? [-150, -60, 20, 100, 180][i] : [-90, 10, 110][i];
          const targetX = clamp(p.cx + spread * this.facing * 0.6 + rand(-20, 20), game.level.arena.x0 + 80, game.level.arena.x1 - 80);
          const T = 0.85;
          const vx = (targetX - mx) / T;
          const vy = (game.level.arena.floorY - my - 0.5 * 900 * T * T) / T;
          game.projectiles.push(new Fireball(mx, my, vx, vy, i === 0));
          game.audio.play('fireball');
        }
        if (this.t <= 0) this.setState('recover', 0.55 / speedK);
        break;
      case 'whipWind':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.t <= 0) {
          this.setState('whip', 0.36);
          game.audio.play('whip');
        }
        break;
      case 'whip':
        if (this.t <= 0) this.setState('recover', 0.75 / speedK);
        break;
      case 'leapWind':
        this.vx = 0;
        if (this.t <= 0) {
          const air = 0.85;
          const targetX = clamp(p.cx, game.level.arena.x0 + 90, game.level.arena.x1 - 90);
          this.vx = (targetX - this.cx) / air;
          this.vy = -0.5 * GRAV * air;
          this.setState('leap', 2);
          game.audio.play('roar');
        }
        break;
      case 'leap':
        if (this.grounded && this.t < 1.9) {
          this.vx = 0;
          this.slam(game);
          this.setState('recover', 0.85 / speedK);
        }
        break;
      case 'chargeWind':
        this.vx = 0;
        if (Math.random() < 0.5) game.particles.add({ x: this.cx - this.facing * 30, y: this.feetY - 4, vx: -this.facing * rand(60, 160), vy: rand(-80, -20), kind: 'smoke', size: rand(6, 12), grow: 30, color: 'rgba(40,25,30,0.6)', life: 0.7 });
        if (this.t <= 0) this.setState('charge', 3);
        break;
      case 'charge':
        this.vx = this.facing * 540;
        if (Math.random() < 0.8) game.particles.add({ x: this.cx - this.facing * 40, y: this.feetY - rand(10, 120), vx: -this.facing * 200, vy: rand(-40, 0), size: rand(2, 4), color: 'rgb(255,140,50)', additive: true, life: 0.4 });
        break;
      case 'breathWind':
        this.vx = 0;
        if (this.t <= 0) {
          this.setState('breath', 1.3);
          game.audio.play('breath');
        }
        break;
      case 'breath': {
        this.vx = 0;
        const mx = this.cx + this.facing * 46;
        const my = this.y + 26;
        for (let k = 0; k < 4; k++) {
          const ang = (this.facing > 0 ? 0 : Math.PI) + this.facing * rand(0.15, 0.5);
          const sp = rand(380, 620);
          game.particles.add({ x: mx, y: my, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, size: rand(4, 9), grow: 22, color: k % 2 ? 'rgb(255,120,40)' : 'rgb(255,200,110)', additive: true, life: rand(0.5, 0.75), drag: 1.2, kind: 'smoke' });
        }
        if (this.t <= 0) this.setState('recover', 0.9);
        break;
      }
      case 'roar':
        this.vx = 0;
        if (this.t > 1.2 && Math.random() < 0.5) game.particles.add({ x: this.cx, y: this.y + 30, kind: 'ring', size: 20, grow: 600, color: 'rgba(255,170,90,0.5)', life: 0.5, additive: true });
        // push the player away
        if (this.t > 1.0 && dist < 260) p.vx += toP * 900 * dt;
        if (this.t <= 0) this.setState('idle', 0.4);
        break;
      case 'stagger':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.t <= 0) this.setState('idle', 0.3);
        break;
      case 'stunned':
        this.vx = 0;
        if (this.t <= 0) this.setState('idle', 0.4);
        break;
      case 'recover':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.t <= 0) this.setState('idle', (this.phase2 ? rand(0.25, 0.5) : rand(0.5, 0.9)));
        break;
      case 'dying':
        this.vx = 0;
        if (Math.random() < 0.9) {
          game.particles.add({ x: this.cx + rand(-60, 60), y: this.y + rand(0, this.h), vx: rand(-30, 30), vy: rand(-140, -40), size: rand(2, 5), color: Math.random() < 0.5 ? 'rgb(255,140,60)' : 'rgba(60,50,55,0.8)', additive: Math.random() < 0.5, life: rand(0.8, 1.6) });
        }
        if (this.t <= 0) {
          this.dead = true;
          game.particles.burst(this.cx, this.y + 70, 80, { color: 'rgba(70,60,65,0.9)', kind: 'smoke', size: 10, grow: 30, speed: 300, life: 1.6, drag: 2 });
          game.particles.burst(this.cx, this.y + 70, 60, { color: 'rgb(255,160,70)', additive: true, speed: 420, life: 1.2, size: 3, grav: 200 });
        }
        break;
    }

    // physics
    this.vy = Math.min(this.vy + GRAV * dt, 1200);
    moveBody(this, game.level, dt, { oneWay: false });
    if (this.state === 'charge' && this.hitWall) {
      this.setState('stunned', 1.2);
      game.audio.play('slam');
      game.camera.shake(0.7);
      game.particles.burst(this.cx + this.facing * 40, this.y + 60, 30, { color: '#7a6a60', kind: 'shard', size: 4, speed: 300, life: 0.9, grav: 900, vrot: 8 });
      // rubble falls from above
      for (let i = 0; i < 3; i++) {
        const fx = this.cx + this.facing * -rand(80, 380);
        game.projectiles.push(new Fireball(fx, game.level.arena.y0 + 40, rand(-30, 30), rand(0, 80)));
      }
    }

    this.animate(dt, game);
  }

  chooseAttack(dist, game) {
    const opts = [];
    if (dist > 280) opts.push('spit', 'spit', 'leap');
    else if (dist < 200) opts.push('whipLow', 'whipHigh', 'leap');
    else opts.push('spit', 'whipLow', 'whipHigh', 'leap');
    if (this.phase2) opts.push('charge', 'breath');
    let choice = pick(opts);
    if (choice === this.lastAttack) choice = pick(opts);
    this.lastAttack = choice;
    const sk = this.phase2 ? 0.8 : 1;
    switch (choice) {
      case 'spit':
        this.setState('spitWind', 0.65 * sk);
        game.audio.play('breath');
        break;
      case 'whipLow':
      case 'whipHigh':
        this.whip.high = choice === 'whipHigh';
        this.setState('whipWind', 0.6 * sk);
        break;
      case 'leap':
        this.setState('leapWind', 0.45 * sk);
        break;
      case 'charge':
        this.setState('chargeWind', 0.7);
        game.audio.play('roar');
        break;
      case 'breath':
        this.setState('breathWind', 0.8);
        break;
    }
  }

  slam(game) {
    game.audio.play('slam');
    game.camera.shake(0.75);
    game.hitstop(0.06);
    const fy = this.feetY;
    game.projectiles.push(new FlameWave(this.cx - 50, fy, -1, this.phase2 ? 420 : 360));
    game.projectiles.push(new FlameWave(this.cx + 50, fy, 1, this.phase2 ? 420 : 360));
    game.particles.burst(this.cx, fy - 6, 30, { color: '#5a4a48', kind: 'smoke', size: 8, grow: 40, speed: 260, life: 0.8, angle: -Math.PI / 2, spread: Math.PI, drag: 3 });
    game.particles.burst(this.cx, fy - 6, 30, { color: 'rgb(255,150,60)', additive: true, speed: 380, life: 0.6, angle: -Math.PI / 2, spread: Math.PI * 0.9, grav: 900 });
  }

  // Damage rectangles active this frame.
  hitboxes() {
    const out = [];
    if (!this.alive || this.state === 'dormant' || this.state === 'intro') return out;
    out.push({ x: this.x + 10, y: this.y + 20, w: this.w - 20, h: this.h - 20 });
    const f = this.facing;
    if (this.state === 'whip') {
      const k = 1 - this.t / 0.36;
      if (k > 0.15 && k < 0.85) {
        const reach = 380;
        const y = this.whip.high ? this.feetY - 130 : this.feetY - 40;
        out.push(f > 0 ? { x: this.cx, y, w: reach, h: 38 } : { x: this.cx - reach, y, w: reach, h: 38 });
      }
    }
    if (this.state === 'breath' && this.t < 1.2) {
      const len = Math.min(420, (1.3 - this.t) * 1400);
      const y0 = this.y + 30;
      out.push(f > 0 ? { x: this.cx + 30, y: y0, w: len, h: this.feetY - y0 } : { x: this.cx - 30 - len, y: y0, w: len, h: this.feetY - y0 });
    }
    return out;
  }

  // ── Animation ──────────────────────────────────────────────
  animate(dt, game) {
    const a = this.anim;
    const s = this.state;
    let crouch = 0;
    let armR = 0.35 + Math.sin(this.time * 2) * 0.05;
    let armL = -0.25;
    let head = Math.sin(this.time * 1.6) * 0.03;
    let mouth = 0.15;
    let lean = 0.05;
    const wk = (x) => clamp(x, 0, 1);
    if (s === 'dormant' || (s === 'intro' && a.rise < 1)) {
      crouch = 1 - a.rise * 0.9;
      lean = 0.5 * (1 - a.rise);
      head = 0.4 * (1 - a.rise);
      armR = 0.2;
      armL = 0.2;
      mouth = s === 'intro' && this.t < 2.2 ? 1 : 0;
    } else if (s === 'intro') {
      mouth = 1;
      head = -0.3;
      armR = 2.2;
      armL = -2.2;
    } else if (s === 'spitWind') {
      head = -0.45;
      mouth = 0.6 + wk(1 - this.t / 0.6) * 0.4;
      lean = -0.15;
    } else if (s === 'spit') {
      head = 0.25;
      mouth = 1;
      lean = 0.2;
    } else if (s === 'whipWind') {
      armR = this.whip.high ? -2.6 : -1.3;
      lean = -0.1;
      crouch = this.whip.high ? 0 : 0.25;
    } else if (s === 'whip') {
      const k = easeOutCubic(1 - this.t / 0.36);
      armR = lerp(this.whip.high ? -2.6 : -1.3, this.whip.high ? 2.0 : 1.4, k);
      lean = 0.25;
    } else if (s === 'leapWind') {
      crouch = 0.6;
      armR = -0.8;
      armL = -0.9;
      lean = 0.3;
    } else if (s === 'leap') {
      crouch = 0.1;
      armR = 2.5;
      armL = 2.5;
      lean = 0.2;
    } else if (s === 'chargeWind') {
      crouch = 0.4;
      lean = 0.45;
      head = 0.3;
      armR = -1.0;
      armL = -1.0;
    } else if (s === 'charge') {
      lean = 0.55;
      head = 0.35;
      armR = -1.2;
      armL = -1.4;
      crouch = 0.2;
    } else if (s === 'breathWind') {
      head = -0.5;
      lean = -0.2;
      mouth = 0.5;
      armR = -0.6;
      armL = 0.6;
    } else if (s === 'breath') {
      head = 0.2;
      mouth = 1;
      lean = 0.15;
    } else if (s === 'roar') {
      head = -0.5;
      mouth = 1;
      armR = 2.4;
      armL = -2.4;
      lean = -0.2;
    } else if (s === 'stagger' || s === 'stunned') {
      crouch = 0.7;
      lean = 0.5;
      head = 0.6;
      armR = 0.1;
      armL = 0.3;
    } else if (s === 'recover') {
      crouch = 0.2;
      lean = 0.15;
    } else if (s === 'dying') {
      const k = 1 - this.t / 3.4;
      crouch = Math.min(1, k * 2);
      lean = 0.6 * k;
      head = 0.6 * k;
      armR = 0.1;
      armL = 0.1;
      mouth = 0.3 * (1 - k);
    }
    const r = s === 'whip' ? 40 : 12;
    a.crouch = damp(a.crouch, crouch, r, dt);
    a.armR = damp(a.armR, armR, r, dt);
    a.armL = damp(a.armL, armL, 12, dt);
    a.head = damp(a.head, head, 10, dt);
    a.mouth = damp(a.mouth, mouth, 14, dt);
    a.lean = damp(a.lean, lean, 10, dt);
    a.wing += dt * (s === 'leap' ? 9 : 2.2);
    if (Math.abs(this.vx) > 20 && this.grounded) this.walkPhase += (Math.abs(this.vx) * dt) / 28;
  }

  // ── Drawing ────────────────────────────────────────────────
  draw(ctx, game) {
    const a = this.anim;
    const f = this.facing;
    const t = this.time;
    const dying = this.state === 'dying' ? clamp(this.t / 3.4, 0, 1) : 1;
    const jitter = this.state === 'stagger' || this.state === 'stunned' || this.state === 'dying' ? rand(-1.5, 1.5) : 0;

    // ground glow
    glow(ctx, this.cx, this.feetY - 10, 160, 'rgb(255,100,40)', 0.35 * dying);

    ctx.save();
    ctx.translate(this.cx + jitter, this.feetY);
    ctx.scale(f, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drop = a.crouch * 34;
    const hipY = -72 + drop;
    const chestY = hipY - 58;
    const lean = a.lean;
    const shX = Math.sin(lean) * 58;
    const shY = chestY + (1 - Math.cos(lean)) * 20;
    const headX = shX + Math.sin(lean + a.head) * 26;
    const headY = shY - Math.cos(lean + a.head) * 26 - 4;

    const skin = this.flash > 0 ? '#ffffff' : '#1b1113';
    const iron = this.flash > 0 ? '#ffffff' : '#241d22';
    const lacquer = this.flash > 0 ? '#ffffff' : '#5c1518';
    const gold = '#c79a45';
    const outline = '#060304';

    // Wings (smoke + flame edges)
    this.drawWing(ctx, shX - 14, shY + 8, -1, a.wing + 0.5, 0.75 * dying, true);
    this.drawWing(ctx, shX - 6, shY + 4, 1, a.wing, dying, false);

    // Back arm
    this.drawArm(ctx, shX - 10, shY + 10, a.armL - 0.2, skin, outline, true, false);

    // Legs
    const wp = this.walkPhase;
    const stepA = Math.sin(wp) * (Math.abs(this.vx) > 20 ? 0.45 : 0);
    this.drawLeg(ctx, -12, hipY, -0.15 - stepA, a.crouch, skin, iron, gold, outline, true);
    this.drawLeg(ctx, 14, hipY, 0.1 + stepA, a.crouch, skin, iron, gold, outline, false);

    // Kusazuri (armour skirt)
    for (let i = 0; i < 4; i++) {
      const x = -34 + i * 18;
      ctx.fillStyle = lacquer;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, hipY - 6);
      ctx.lineTo(x + 20, hipY - 6);
      ctx.lineTo(x + 22, hipY + 30);
      ctx.lineTo(x - 2, hipY + 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = gold;
      ctx.lineWidth = 1.2;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x, hipY - 6 + k * 9);
        ctx.lineTo(x + 21, hipY - 6 + k * 9);
        ctx.stroke();
      }
    }

    // Torso: molten skin under a lamellar do
    ctx.fillStyle = skin;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-30, hipY);
    ctx.quadraticCurveTo(-46, (hipY + shY) / 2, shX - 44, shY);
    ctx.quadraticCurveTo(shX, shY - 18, shX + 44, shY);
    ctx.quadraticCurveTo(40 + shX * 0.5, (hipY + shY) / 2, 30, hipY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // do plates
    ctx.save();
    ctx.clip();
    for (let k = 0; k < 5; k++) {
      const y = lerp(hipY - 4, shY + 14, k / 5);
      const xo = lerp(0, shX, k / 5);
      ctx.fillStyle = k % 2 ? iron : lacquer;
      ctx.fillRect(xo - 40, y - 11, 80, 11);
      ctx.strokeStyle = gold;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xo - 40, y - 11);
      ctx.lineTo(xo + 40, y - 11);
      ctx.stroke();
    }
    ctx.restore();
    // lava veins
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.6 + Math.sin(t * 3) * 0.2;
    ctx.strokeStyle = `rgba(255,110,40,${pulse * dying})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shX - 20, shY + 6);
    ctx.lineTo(shX - 8, shY + 20);
    ctx.lineTo(shX - 16, shY + 34);
    ctx.moveTo(shX + 18, shY + 4);
    ctx.lineTo(shX + 10, shY + 18);
    ctx.lineTo(shX + 20, shY + 30);
    ctx.stroke();
    ctx.restore();

    // Sode (shoulder plates)
    for (const side of [-1, 1]) {
      const sx = shX + side * 36;
      ctx.save();
      ctx.translate(sx, shY + 2);
      ctx.rotate(side * 0.25);
      ctx.fillStyle = lacquer;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(-16, -8, 32, 38);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = gold;
      ctx.lineWidth = 1.2;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(-16, -8 + k * 9.5);
        ctx.lineTo(16, -8 + k * 9.5);
        ctx.stroke();
      }
      ctx.restore();
      drawFlame(ctx, sx, shY - 4, 26, 40 * dying, t, side * 13 + 3);
    }

    // Head
    this.drawHead(ctx, headX, headY, a.head + lean * 0.3, a.mouth, dying, outline, gold, lacquer);

    // Front arm + whip
    this.drawArm(ctx, shX + 12, shY + 10, a.armR, skin, outline, false, true);

    ctx.restore();

    if (this.state === 'breath' && this.t < 1.2) {
      // bright core of the stream
      const len = Math.min(420, (1.3 - this.t) * 1400);
      const mx = this.cx + f * 46;
      const my = this.y + 26;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createLinearGradient(mx, my, mx + f * len, this.feetY - 20);
      grad.addColorStop(0, 'rgba(255,240,180,0.9)');
      grad.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(mx, my - 8);
      ctx.lineTo(mx + f * len, this.feetY - 100);
      ctx.lineTo(mx + f * len, this.feetY);
      ctx.lineTo(mx, my + 10);
      ctx.fill();
      ctx.restore();
    }
  }

  drawWing(ctx, x, y, layer, phase, alpha, back) {
    const flap = Math.sin(phase) * 0.35;
    const span = back ? 150 : 175;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35 + flap * 0.6);
    ctx.globalAlpha = alpha;
    const bones = [
      [-span, -110],
      [-span * 1.05, -30],
      [-span * 0.85, 30],
      [-span * 0.5, 60],
    ];
    const grad = ctx.createLinearGradient(0, 0, -span, -60);
    grad.addColorStop(0, back ? 'rgba(20,8,10,0.95)' : 'rgba(30,10,12,0.95)');
    grad.addColorStop(1, 'rgba(60,18,14,0.35)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bones[0][0] * 0.55, bones[0][1] * 0.75);
    ctx.lineTo(bones[0][0], bones[0][1]);
    for (let i = 1; i < bones.length; i++) {
      const p = bones[i - 1];
      const q = bones[i];
      ctx.quadraticCurveTo((p[0] + q[0]) / 2 + 22, (p[1] + q[1]) / 2 + 4, q[0], q[1]);
    }
    ctx.quadraticCurveTo(-20, 50, 0, 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = back ? '#0e0506' : '#160709';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(bones[0][0] * 0.55, bones[0][1] * 0.75);
    ctx.lineTo(bones[0][0], bones[0][1]);
    for (const b of bones.slice(1)) {
      ctx.moveTo(bones[0][0] * 0.55, bones[0][1] * 0.75);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    if (!back) for (const b of bones) drawFlame(ctx, b[0], b[1] + 6, 16, 26, this.time, b[0]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawLeg(ctx, hx, hy, swing, crouch, skin, iron, gold, outline, back) {
    const knee = [hx + 18 + Math.sin(swing) * 22 + crouch * 10, hy + 32 - crouch * 8];
    const ankle = [knee[0] - 14 - crouch * 6, -14];
    const col = back ? '#120a0c' : skin;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 30;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(knee[0], knee[1]);
    ctx.stroke();
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(knee[0], knee[1]);
    ctx.lineTo(ankle[0], ankle[1]);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 25;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(knee[0], knee[1]);
    ctx.stroke();
    // iron greave (suneate)
    ctx.strokeStyle = back ? '#16111a' : iron;
    ctx.lineWidth = 17;
    ctx.beginPath();
    ctx.moveTo(knee[0], knee[1]);
    ctx.lineTo(ankle[0], ankle[1]);
    ctx.stroke();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = back ? 0.4 : 1;
    ctx.beginPath();
    ctx.moveTo(lerp(knee[0], ankle[0], 0.3) - 7, lerp(knee[1], ankle[1], 0.3));
    ctx.lineTo(lerp(knee[0], ankle[0], 0.3) + 7, lerp(knee[1], ankle[1], 0.3));
    ctx.moveTo(lerp(knee[0], ankle[0], 0.7) - 7, lerp(knee[1], ankle[1], 0.7));
    ctx.lineTo(lerp(knee[0], ankle[0], 0.7) + 7, lerp(knee[1], ankle[1], 0.7));
    ctx.stroke();
    ctx.globalAlpha = 1;
    // cloven hoof
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.moveTo(ankle[0] - 12, ankle[1] - 4);
    ctx.lineTo(ankle[0] + 18, ankle[1] + 2);
    ctx.lineTo(ankle[0] + 20, 0);
    ctx.lineTo(ankle[0] - 12, 0);
    ctx.closePath();
    ctx.fill();
  }

  drawArm(ctx, sx, sy, angle, skin, outline, back, withWhip) {
    const L1 = 38;
    const L2 = 36;
    const el = [sx + Math.sin(angle) * L1, sy + Math.cos(angle) * L1];
    const a2 = angle + (back ? 0.3 : 0.45);
    const hand = [el[0] + Math.sin(a2) * L2, el[1] + Math.cos(a2) * L2];
    const col = back ? '#120a0c' : skin;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(el[0], el[1]);
    ctx.lineTo(hand[0], hand[1]);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 19;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(el[0], el[1]);
    ctx.stroke();
    // armoured bracer (kote)
    ctx.strokeStyle = back ? '#16111a' : '#241d22';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.moveTo(el[0], el[1]);
    ctx.lineTo(hand[0], hand[1]);
    ctx.stroke();
    // fist
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(hand[0], hand[1], 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(hand[0], hand[1], 9, 0, Math.PI * 2);
    ctx.fill();
    // claws
    ctx.strokeStyle = '#d8c9a8';
    ctx.lineWidth = 2;
    for (let k = -1; k <= 1; k++) {
      const ca = a2 + k * 0.35;
      ctx.beginPath();
      ctx.moveTo(hand[0] + Math.sin(ca) * 8, hand[1] + Math.cos(ca) * 8);
      ctx.lineTo(hand[0] + Math.sin(ca) * 16, hand[1] + Math.cos(ca) * 16);
      ctx.stroke();
    }
    if (withWhip) this.drawWhip(ctx, hand, angle);
  }

  drawWhip(ctx, hand, armAngle) {
    // Whip shape depends on state: hanging, trailing behind (tell), or sweeping.
    const pts = [];
    const n = 18;
    const floorLocal = 0; // local y of floor
    const s = this.state;
    if (s === 'whip') {
      const k = easeOutCubic(1 - this.t / 0.36);
      const reach = 360 * Math.min(1, k * 1.6);
      const y = this.whip.high ? -130 : -40;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const wave = Math.sin(u * 6 - k * 10) * 10 * (1 - u);
        pts.push([lerp(hand[0], hand[0] - 20 + reach, u), lerp(hand[1], y, Math.min(1, u * 2.5)) + wave]);
      }
    } else if (s === 'whipWind') {
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const sway = Math.sin(this.time * 12 + u * 5) * 6 * u;
        const ty = this.whip.high ? hand[1] - 40 - u * 60 : lerp(hand[1], floorLocal - 8, u);
        pts.push([hand[0] - u * 150, ty + sway]);
      }
    } else {
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const sway = Math.sin(this.time * 2.5 + u * 4) * 10 * u;
        const y = Math.min(floorLocal - 4, hand[1] + u * 140);
        pts.push([hand[0] + sway - u * 40 + (y >= floorLocal - 4 ? -u * 60 : 0), y]);
      }
    }
    ctx.strokeStyle = '#100607';
    ctx.lineWidth = 5;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = s === 'whipWind' ? 'rgba(255,220,140,0.95)' : 'rgba(255,120,40,0.85)';
    ctx.lineWidth = s === 'whipWind' ? 3.5 : 2.2;
    ctx.stroke();
    ctx.restore();
    for (let i = 3; i <= n; i += 3) drawFlame(ctx, pts[i][0], pts[i][1] + 4, 12, 20, this.time, i * 3.3);
  }

  drawHead(ctx, x, y, tilt, mouth, alpha, outline, gold, lacquer) {
    const t = this.time;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    // fire mane streaming back
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.translate(-14 - i * 6, -10 + i * 4);
      ctx.rotate(-1.2 - i * 0.1);
      drawFlame(ctx, 0, 0, 22, (54 - i * 6) * alpha, t, i * 5.1);
      ctx.restore();
    }
    // horns — Balrog's great swept horns
    for (const side of [-1, 1]) {
      ctx.fillStyle = side < 0 ? '#2a2020' : '#3a2e2a';
      ctx.strokeStyle = outline;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(side * 10 - 4, -18);
      ctx.quadraticCurveTo(side * 40 - 10, -40, side * 34 + 14, -78);
      ctx.quadraticCurveTo(side * 30 + 2, -46, side * 6 + 6, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // kabuto bowl
    ctx.fillStyle = '#1e1820';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -4, 22, Math.PI * 1.05, Math.PI * 1.95);
    ctx.lineTo(24, 2);
    ctx.lineTo(-24, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // shikoro neck guard
    ctx.fillStyle = lacquer;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(-34, 22);
    ctx.lineTo(-8, 22);
    ctx.lineTo(-6, 2);
    ctx.fill();
    ctx.stroke();
    // gold crescent maedate
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(4, -26, 16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.arc(4, -21, 12, Math.PI * 1.85, Math.PI * 1.15, true);
    ctx.closePath();
    ctx.fill();
    // oni menpo mask
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : '#7e1d1b';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(22, -8);
    ctx.quadraticCurveTo(30, 6, 22, 22);
    ctx.lineTo(4, 24);
    ctx.quadraticCurveTo(-8, 12, -8, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // brow ridge
    ctx.fillStyle = '#4e100f';
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(26, -10);
    ctx.lineTo(22, -3);
    ctx.lineTo(-2, -2);
    ctx.fill();
    // eyes
    const eyeCol = this.phase2 ? 'rgb(255,250,200)' : 'rgb(255,200,90)';
    glow(ctx, 15, -2, 22, 'rgb(255,140,50)', 0.8 * alpha);
    ctx.fillStyle = eyeCol;
    ctx.beginPath();
    ctx.moveTo(8, -3);
    ctx.lineTo(22, -5);
    ctx.lineTo(18, 0);
    ctx.closePath();
    ctx.fill();
    // jaw / mouth
    const open = mouth * 10;
    ctx.fillStyle = '#1a0505';
    ctx.beginPath();
    ctx.moveTo(6, 10);
    ctx.lineTo(26, 9);
    ctx.lineTo(24, 12 + open);
    ctx.lineTo(8, 13 + open);
    ctx.closePath();
    ctx.fill();
    if (mouth > 0.2) glow(ctx, 18, 12 + open * 0.5, 30 * mouth, 'rgb(255,170,80)', mouth * alpha);
    // fangs
    ctx.fillStyle = '#e8dcc0';
    for (const fx of [10, 16, 22]) {
      ctx.beginPath();
      ctx.moveTo(fx, 9);
      ctx.lineTo(fx + 2.5, 9);
      ctx.lineTo(fx + 1.2, 14);
      ctx.fill();
    }
    for (const fx of [12, 20]) {
      ctx.beginPath();
      ctx.moveTo(fx, 13 + open);
      ctx.lineTo(fx + 2.5, 13 + open);
      ctx.lineTo(fx + 1.2, 8 + open);
      ctx.fill();
    }
    ctx.restore();
  }

  light(out) {
    if (this.dead) return;
    const k = this.state === 'dying' ? this.t / 3.4 : 1;
    out.push({ x: this.cx, y: this.y + 50, r: 360, color: 'rgb(255,120,50)', i: 0.95 * k });
    if (this.anim.mouth > 0.3) out.push({ x: this.cx + this.facing * 40, y: this.y + 24, r: 180, color: 'rgb(255,190,100)', i: this.anim.mouth });
  }
}
