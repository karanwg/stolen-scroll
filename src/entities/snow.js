import { TILE } from '../config.js';
import { approach, clamp, rand, sign, lerp } from '../core/math.js';
import { moveBody, groundAhead, wallAhead } from '../world/body.js';
import { NinjaRig, POSES, STYLES, runPose } from '../render/ninjaRig.js';
import { glow } from '../render/shapes.js';

const GRAV = 1900;

const ASHIGARU = { ...STYLES.binoshi, cloth: '#221a2a', clothHi: '#3a2e46', accent: '#7d3cff', wrap: '#5a4c3a' };

// ── Binoshi Spearman ──────────────────────────────────────────
// Holds his yari level in front of him: slashes from the front glance off.
// Get over him (pogo his hat), get behind him, or punish him after a thrust.
export class Spearman {
  constructor(cx, feetY) {
    Object.assign(this, { w: 22, h: 46, vx: 0, vy: 0, facing: -1, hp: 5, maxHp: 5, state: 'patrol', t: 0, stun: 0, flash: 0, dying: 0, dead: false, contact: true, grounded: false, home: cx, phase: 0 });
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.rig = new NinjaRig(ASHIGARU);
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
    return !this.dead && this.dying <= 0;
  }

  // Frontal slashes are parried unless he's recovering from a thrust.
  blocks(p) {
    if (this.state === 'recover' || this.state === 'thrust' || this.stun > 0) return false;
    if (p.attackDir === 'down') return false; // over the guard
    const fromFront = sign(p.cx - this.cx) === this.facing;
    return fromFront && this.state !== 'patrol';
  }

  update(dt, game) {
    this.flash -= dt;
    this.rig.flash = Math.max(0, this.flash);
    const lvl = game.level;
    if (this.dying > 0) {
      this.dying -= dt;
      this.vy += GRAV * dt;
      this.vx = approach(this.vx, 0, 500 * dt);
      moveBody(this, lvl, dt);
      if (this.dying <= 0) this.dead = true;
      this.animate(dt);
      return;
    }
    const p = game.player;
    this.t -= dt;
    this.stun -= dt;
    const dx = p.cx - this.cx;
    const dist = Math.abs(dx);
    const sees = dist < 320 && Math.abs(p.cy - this.cy) < 90 && p.state !== 'dead';
    if (this.stun > 0) this.vx = approach(this.vx, 0, 900 * dt);
    else {
      switch (this.state) {
        case 'patrol':
          this.vx = this.facing * 45;
          if (!groundAhead(this, lvl, this.facing, 6) || wallAhead(this, lvl, this.facing) || Math.abs(this.cx - this.home) > 140) this.facing *= -1;
          if (sees) {
            this.state = 'guard';
            this.facing = sign(dx) || this.facing;
          }
          break;
        case 'guard':
          // turn slowly: a quick player can get behind him
          if (sign(dx) !== this.facing && this.t <= 0) {
            this.facing = sign(dx);
            this.t = 0.5;
          }
          this.vx = dist > 110 && groundAhead(this, lvl, this.facing, 8) ? this.facing * 70 : 0;
          if (dist < 125 && sign(dx) === this.facing && this.t <= 0) {
            this.state = 'windup';
            this.t = 0.45;
            game.audio.play('tell');
          }
          if (!sees) this.state = 'patrol';
          break;
        case 'windup':
          this.vx = approach(this.vx, -this.facing * 40, 600 * dt);
          if (this.t <= 0) {
            this.state = 'thrust';
            this.t = 0.2;
            game.audio.play('lunge');
          }
          break;
        case 'thrust':
          this.vx = groundAhead(this, lvl, this.facing, 10) ? this.facing * 260 : 0;
          if (this.t <= 0) {
            this.state = 'recover';
            this.t = 0.75;
          }
          break;
        case 'recover':
          this.vx = approach(this.vx, 0, 1400 * dt);
          if (this.t <= 0) {
            this.state = 'guard';
            this.t = 0.3;
          }
          break;
      }
    }
    this.vy = Math.min(this.vy + GRAV * dt, 900);
    moveBody(this, lvl, dt);
    if (lvl.hazardIn(this.x, this.y, this.w, this.h)) this.hurt(99, -this.facing, game);
    this.animate(dt);
  }

  // The spear's reach: a long thin box in front.
  attackBox() {
    if (this.state !== 'thrust') return null;
    return this.facing > 0 ? { x: this.cx, y: this.y + 14, w: 96, h: 12 } : { x: this.cx - 96, y: this.y + 14, w: 96, h: 12 };
  }

  hurt(dmg, dirX, game) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.dying = 0.5;
      this.contact = false;
      this.vx = dirX * 240;
      this.vy = -280;
      return true;
    }
    this.vx = dirX * 200;
    this.stun = 0.2;
    this.state = 'guard';
    this.t = 0.15;
    this.facing = -dirX;
    return true;
  }

  animate(dt) {
    let pose;
    if (this.dying > 0) pose = POSES.dead;
    else if (this.stun > 0) pose = POSES.hurt;
    else if (this.state === 'windup') pose = { ...POSES.crouch, armF: [1.0, 0.6], armB: [0.6, 1.0], lean: -0.1 };
    else if (this.state === 'thrust') pose = { ...POSES.dash, armF: [1.55, 0], armB: [1.4, 0.1], lean: 0.5 };
    else if (this.state === 'guard' || this.state === 'recover') pose = { ...POSES.idle, armF: [1.25, 0.25], armB: [1.0, 0.6], lean: 0.12, drop: 4, legF: [0.4, -0.3], legB: [-0.35, -0.15] };
    else if (Math.abs(this.vx) > 20) {
      this.phase += (Math.abs(this.vx) * dt) / 10.5;
      pose = { ...runPose(this.phase, 0.5), lean: 0.1, armF: [1.0, 0.4], armB: [0.8, 0.6] };
    } else pose = POSES.idle;
    this.rig.set(pose, this.state === 'thrust' ? 40 : 18);
    this.rig.update(dt, this.cx, this.feetY, this.facing, this.vx, this.vy);
  }

  draw(ctx) {
    if (this.dying > 0) ctx.globalAlpha = clamp(this.dying * 2.5, 0, 1);
    this.rig.draw(ctx, this.cx, this.feetY, this.facing);
    // jingasa hat
    const [hx, hy] = [this.cx + this.rig.joints.head[0] * this.facing, this.feetY + this.rig.joints.head[1]];
    ctx.fillStyle = '#2a2230';
    ctx.strokeStyle = '#08060a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hx - 15, hy - 3);
    ctx.lineTo(hx, hy - 13);
    ctx.lineTo(hx + 15, hy - 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e4ecf7';
    ctx.beginPath();
    ctx.moveTo(hx - 9, hy - 7);
    ctx.lineTo(hx, hy - 13);
    ctx.lineTo(hx + 9, hy - 7);
    ctx.fill();
    // yari held in both hands
    const [ax, ay] = this.rig.tip('armF', this.cx, this.feetY, this.facing);
    const [bx, by] = this.rig.tip('armB', this.cx, this.feetY, this.facing);
    const ang = Math.atan2(ay - by, ax - bx) || 0;
    const fwd = this.state === 'thrust' ? 70 : this.state === 'windup' ? 30 : 52;
    const tipX = ax + Math.cos(ang) * fwd;
    const tipY = ay + Math.sin(ang) * fwd;
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(bx - Math.cos(ang) * 30, by - Math.sin(ang) * 30);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = '#d8dce6';
    ctx.beginPath();
    ctx.moveTo(tipX + Math.cos(ang) * 16, tipY + Math.sin(ang) * 16);
    ctx.lineTo(tipX + Math.cos(ang + 1.6) * 3, tipY + Math.sin(ang + 1.6) * 3);
    ctx.lineTo(tipX + Math.cos(ang - 1.6) * 3, tipY + Math.sin(ang - 1.6) * 3);
    ctx.fill();
    if (this.state === 'windup') glow(ctx, tipX + Math.cos(ang) * 12, tipY + Math.sin(ang) * 12, 22, 'rgb(220,200,255)', 0.8);
    ctx.globalAlpha = 1;
  }

  light(out) {
    out.push({ x: this.cx, y: this.y + 8, r: 46, color: 'rgb(170,120,255)', i: 0.45 });
  }
}

// ── Fuma shuriken: flies out, slows, and comes back ────────────
export class Shuriken {
  constructor(x, y, dir, owner) {
    Object.assign(this, { x: x - 10, y: y - 10, w: 20, h: 20, vx: dir * 520, vy: 0, dir, owner, dead: false, damage: 1, deflectable: true, t: 0, spin: 0 });
  }
  update(dt, game) {
    this.t += dt;
    this.spin += dt * 28;
    this.vx -= this.dir * 620 * dt; // the return
    if (this.owner && this.t > 0.6) this.vy = approach(this.vy, (this.owner.cy - (this.y + 10)) * 2, 600 * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.t > 0.15 && Math.random() < 0.6) game.particles.add({ x: this.x + 10, y: this.y + 10, vx: 0, vy: 0, kind: 'ring', size: 6, grow: 8, color: 'rgba(220,220,255,0.18)', life: 0.15 });
    const back = this.owner && this.t > 0.8 && Math.abs(this.x + 10 - this.owner.cx) < 18;
    if (back || this.t > 3 || game.level.boxHit(this.x + 4, this.y + 4, 12, 12)) {
      this.dead = true;
      if (!back) game.audio.play('clang');
    }
  }
  deflect(game) {
    this.dead = true;
    game.particles.burst(this.x + 10, this.y + 10, 10, { kind: 'streak', color: '#fff4d8', speed: 260, life: 0.25, size: 1.5, additive: true });
    game.audio.play('clang');
  }
  draw(ctx) {
    const cx = this.x + 10;
    const cy = this.y + 10;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.spin);
    ctx.fillStyle = '#0d0b12';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.moveTo(Math.cos(a + 0.4) * 4, Math.sin(a + 0.4) * 4);
      ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
      ctx.lineTo(Math.cos(a - 0.5) * 4, Math.sin(a - 0.5) * 4);
    }
    ctx.fill();
    ctx.strokeStyle = '#c8c4dc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      ctx.moveTo(Math.cos(a + 0.4) * 4, Math.sin(a + 0.4) * 4);
      ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
    }
    ctx.stroke();
    ctx.restore();
  }
  light(out) {}
}

export class ShurikenThrower {
  constructor(cx, feetY) {
    Object.assign(this, { w: 20, h: 46, vx: 0, vy: 0, facing: -1, hp: 3, maxHp: 3, state: 'idle', t: rand(0.4, 1.2), stun: 0, flash: 0, dying: 0, dead: false, contact: true, grounded: false, out: null });
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
    this.rig = new NinjaRig({ ...STYLES.binoshi, accent: '#3cd0ff', cloth: '#14141e' });
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
    return !this.dead && this.dying <= 0;
  }
  update(dt, game) {
    this.flash -= dt;
    this.rig.flash = Math.max(0, this.flash);
    if (this.dying > 0) {
      this.dying -= dt;
      this.vy += GRAV * dt;
      moveBody(this, game.level, dt);
      if (this.dying <= 0) this.dead = true;
      this.animate(dt);
      return;
    }
    const p = game.player;
    this.t -= dt;
    this.stun -= dt;
    const dx = p.cx - this.cx;
    const sees = Math.abs(dx) < 460 && Math.abs(p.cy - this.cy) < 140 && p.state !== 'dead';
    if (this.stun > 0) this.vx = approach(this.vx, 0, 900 * dt);
    else if (this.state === 'idle') {
      this.vx = 0;
      if (sees) this.facing = sign(dx) || this.facing;
      if (sees && this.t <= 0 && (!this.out || this.out.dead)) {
        this.state = 'aim';
        this.t = 0.5;
        game.audio.play('tell');
      }
    } else if (this.state === 'aim') {
      if (this.t <= 0) {
        const [hx, hy] = this.rig.tip('armF', this.cx, this.feetY, this.facing);
        this.out = new Shuriken(hx, hy, this.facing, this);
        game.projectiles.push(this.out);
        game.audio.play('kunai');
        this.state = 'release';
        this.t = 0.3;
      }
    } else if (this.state === 'release' && this.t <= 0) {
      this.state = 'idle';
      this.t = rand(1.3, 1.8);
    }
    this.vy = Math.min(this.vy + GRAV * dt, 900);
    moveBody(this, game.level, dt);
    if (game.level.hazardIn(this.x, this.y, this.w, this.h)) this.hurt(99, -this.facing, game);
    this.animate(dt);
  }
  hurt(dmg, dirX, game) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.dying = 0.5;
      this.contact = false;
      this.vx = dirX * 240;
      this.vy = -280;
      return true;
    }
    this.vx = dirX * 240;
    this.stun = 0.2;
    if (this.state === 'aim') {
      this.state = 'idle';
      this.t = 0.4;
    }
    return true;
  }
  animate(dt) {
    let pose;
    if (this.dying > 0) pose = POSES.dead;
    else if (this.stun > 0) pose = POSES.hurt;
    else if (this.state === 'aim') pose = { ...POSES.throwWind, armF: [-2.0, 0.6] };
    else if (this.state === 'release') pose = POSES.throwRelease;
    else pose = { ...POSES.idle, drop: Math.sin(this.rig.time * 2) * 0.6 };
    this.rig.set(pose, this.state === 'release' ? 50 : 18);
    this.rig.update(dt, this.cx, this.feetY, this.facing, this.vx, this.vy);
  }
  draw(ctx) {
    if (this.dying > 0) ctx.globalAlpha = clamp(this.dying * 2.5, 0, 1);
    this.rig.draw(ctx, this.cx, this.feetY, this.facing);
    if (this.state === 'aim') {
      const [hx, hy] = this.rig.tip('armF', this.cx, this.feetY, this.facing);
      glow(ctx, hx, hy, 26, 'rgb(170,230,255)', 0.8);
    }
    ctx.globalAlpha = 1;
  }
  light(out) {
    out.push({ x: this.cx, y: this.y + 8, r: 46, color: 'rgb(120,210,255)', i: 0.45 });
  }
}

// ── Yuki-onna ─────────────────────────────────────────────────
// A drifting snow spirit. Slips through walls; breathes frost that slows you;
// when struck she dissolves and re-forms somewhere behind you.
export class YukiOnna {
  constructor(cx, cy) {
    Object.assign(this, { w: 26, h: 52, home: { x: cx, y: cy }, vx: 0, vy: 0, facing: -1, hp: 3, maxHp: 3, state: 'drift', t: rand(1, 2), flash: 0, dying: 0, dead: false, contact: true, alpha: 0.85, time: rand(0, 6) });
    this.x = cx - this.w / 2;
    this.y = cy - this.h / 2;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  get alive() {
    return !this.dead && this.dying <= 0;
  }
  update(dt, game) {
    this.time += dt;
    this.flash -= dt;
    if (this.dying > 0) {
      this.dying -= dt;
      this.alpha = Math.max(0, this.dying * 1.5);
      if (this.dying <= 0) this.dead = true;
      return;
    }
    const p = game.player;
    this.t -= dt;
    const dx = p.cx - this.cx;
    const dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    switch (this.state) {
      case 'drift': {
        const near = d < 420;
        const tx = near ? p.cx - sign(dx) * 120 : this.home.x + Math.sin(this.time * 0.4) * 60;
        const ty = near ? p.cy - 30 : this.home.y + Math.sin(this.time * 0.9) * 16;
        this.vx = approach(this.vx, clamp((tx - this.cx) * 1.5, -90, 90), 200 * dt);
        this.vy = approach(this.vy, clamp((ty - this.cy) * 1.5, -70, 70), 200 * dt);
        this.facing = sign(dx) || this.facing;
        this.alpha = approach(this.alpha, 0.85, dt);
        if (near && d < 220 && this.t <= 0) {
          this.state = 'inhale';
          this.t = 0.65;
          game.audio.play('yukiInhale');
        }
        break;
      }
      case 'inhale':
        this.vx = approach(this.vx, 0, 300 * dt);
        this.vy = approach(this.vy, 0, 300 * dt);
        this.facing = sign(dx) || this.facing;
        if (this.t <= 0) {
          this.state = 'breathe';
          this.t = 1.0;
          this.aim = Math.atan2(dy, dx);
          game.audio.play('yukiBreath');
        }
        break;
      case 'breathe': {
        const mx = this.cx + this.facing * 10;
        const my = this.y + 14;
        for (let k = 0; k < 3; k++) {
          const a = this.aim + rand(-0.22, 0.22);
          const sp = rand(240, 340);
          game.particles.add({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: 'smoke', size: rand(3, 6), grow: 24, color: 'rgba(210,235,255,0.55)', life: 0.7, drag: 1.5 });
        }
        // frost cone: does the player sit inside it?
        const pa = Math.atan2(dy, dx);
        const diff = Math.abs(((pa - this.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (d < 260 && diff < 0.3 && !p.immune) {
          if (p.chillT <= 0) game.audio.play('chill');
          p.chillT = 2.4;
        }
        if (this.t <= 0) {
          this.state = 'drift';
          this.t = rand(1.6, 2.4);
        }
        break;
      }
      case 'fade':
        this.alpha = Math.max(0, this.alpha - dt * 3);
        if (this.t <= 0) {
          // re-form behind the player
          const side = -(p.facing || 1);
          this.x = p.cx + side * 180 - this.w / 2;
          this.y = p.cy - 60 - this.h / 2;
          this.state = 'drift';
          this.t = 1.2;
          this.alpha = 0;
          game.audio.play('yukiInhale');
        }
        break;
    }
    // she floats through walls
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.contact = this.state !== 'fade' && this.alpha > 0.4;
  }
  hurt(dmg, dirX, game) {
    if (!this.alive || this.state === 'fade') return false;
    this.hp -= dmg;
    this.flash = 0.15;
    game.particles.burst(this.cx, this.cy, 16, { color: 'rgba(220,240,255,0.8)', speed: 160, life: 0.6, size: 2, kind: 'smoke', grow: 10 });
    if (this.hp <= 0) {
      this.dying = 0.7;
      this.contact = false;
      game.audio.play('yukiDie');
      return true;
    }
    this.state = 'fade';
    this.t = 0.9;
    return true;
  }
  draw(ctx, game) {
    if (this.alpha <= 0.01) return;
    const t = this.time;
    const x = this.cx;
    const y = this.y;
    const f = this.facing;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    glow(ctx, x, y + 26, 70, 'rgb(170,210,255)', 0.4 * this.alpha);
    // kimono, trailing into mist instead of feet
    const g = ctx.createLinearGradient(0, y + 10, 0, y + this.h + 16);
    g.addColorStop(0, this.flash > 0 ? '#ffffff' : 'rgba(235,242,255,0.95)');
    g.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 14);
    ctx.quadraticCurveTo(x - 16 + Math.sin(t * 2) * 4, y + 40, x - 10 + Math.sin(t * 3) * 6, y + this.h + 14);
    ctx.lineTo(x + 10 + Math.sin(t * 2.5) * 6, y + this.h + 16);
    ctx.quadraticCurveTo(x + 16 + Math.sin(t * 2.2) * 4, y + 40, x + 9, y + 14);
    ctx.closePath();
    ctx.fill();
    // obi
    ctx.fillStyle = 'rgba(120,150,210,0.8)';
    ctx.fillRect(x - 9, y + 24, 18, 4);
    // long black hair, drifting
    ctx.fillStyle = '#05060a';
    ctx.beginPath();
    ctx.moveTo(x - 7 * f, y + 2);
    ctx.quadraticCurveTo(x - 18 * f + Math.sin(t * 2) * 3, y + 20, x - 14 * f + Math.sin(t * 1.7) * 5, y + 48);
    ctx.lineTo(x - 4 * f, y + 30);
    ctx.quadraticCurveTo(x, y + 12, x + 4 * f, y);
    ctx.fill();
    // pale face, dark eyes
    ctx.fillStyle = this.flash > 0 ? '#fff' : '#eef3fb';
    ctx.beginPath();
    ctx.ellipse(x + 2 * f, y + 6, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05060a';
    ctx.fillRect(x + 3 * f - 1, y + 4, 2, 2.5);
    ctx.fillStyle = 'rgba(150,40,60,0.9)';
    ctx.fillRect(x + 4 * f - 1, y + 10, 2.5, 1.2);
    // sleeves held out
    ctx.fillStyle = 'rgba(235,242,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(x + 10 * f, y + 22, 9, 5, 0.4 * f, 0, Math.PI * 2);
    ctx.fill();
    if (this.state === 'inhale') glow(ctx, x + 4 * f, y + 10, 26, 'rgb(220,240,255)', 0.9);
    ctx.restore();
  }
  light(out) {
    out.push({ x: this.cx, y: this.cy, r: 140, color: 'rgb(170,210,255)', i: 0.55 * this.alpha });
  }
}

// ── Icicle ────────────────────────────────────────────────────
// Hangs from a ceiling. Walk beneath it and it cracks, shakes, and drops.
export class Icicle {
  constructor(cx, ceilY) {
    Object.assign(this, { cx0: cx, ceilY, w: 14, h: 36, state: 'hang', t: 0, vy: 0, dead: false, alive: true, contact: false, unkillable: true });
    this.reset();
  }
  reset() {
    this.x = this.cx0 - this.w / 2;
    this.y = this.ceilY;
    this.state = 'hang';
    this.vy = 0;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  update(dt, game) {
    const p = game.player;
    this.t -= dt;
    if (this.state === 'hang') {
      if (Math.abs(p.cx - this.cx0) < 46 && p.y > this.ceilY && p.y - this.ceilY < 420) {
        this.state = 'shake';
        this.t = 0.45;
        game.audio.play('iceCrack');
      }
    } else if (this.state === 'shake') {
      this.x = this.cx0 - this.w / 2 + Math.sin(this.t * 90) * 1.5;
      if (this.t <= 0) this.state = 'fall';
    } else if (this.state === 'fall') {
      this.vy = Math.min(this.vy + 2200 * dt, 1100);
      this.y += this.vy * dt;
      if (game.level.boxHit(this.x + 3, this.y + this.h - 6, this.w - 6, 6) || this.y > game.level.heightPx) {
        this.state = 'gone';
        this.t = 4;
        game.audio.play('shatter');
        game.particles.burst(this.cx, this.y + this.h - 4, 14, { kind: 'shard', color: 'rgba(220,240,255,0.9)', size: 4, speed: 220, life: 0.6, grav: 1200, vrot: 14, angle: -Math.PI / 2, spread: 2.6 });
      }
    } else if (this.state === 'gone' && this.t <= 0) this.reset();
    this.contact = this.state === 'fall';
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    if (this.state === 'gone') return;
    const g = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
    g.addColorStop(0, 'rgba(230,245,255,0.95)');
    g.addColorStop(1, 'rgba(140,190,235,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.w, this.y);
    ctx.lineTo(this.cx + 1, this.y + this.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x + 3, this.y + 2);
    ctx.lineTo(this.cx, this.y + this.h - 6);
    ctx.stroke();
  }
  light(out) {}
}

// ── Wind zone ─────────────────────────────────────────────────
// Blizzard gusts in a region: calm, a warning flurry, then a hard push.
export class WindZone {
  constructor({ x0, x1, y0, y1, dir = 1, strength = 1400, period = 4.2, offset = 0, gust = 1.8 }) {
    Object.assign(this, { x0, x1, y0, y1, dir, strength, period, gust, t: offset });
  }
  get phase() {
    const k = this.t % this.period;
    if (k < this.period - this.gust - 0.7) return 'calm';
    if (k < this.period - this.gust) return 'warn';
    return 'gust';
  }
  get force() {
    const k = this.t % this.period;
    const g0 = this.period - this.gust;
    if (k < g0) return 0;
    const u = (k - g0) / this.gust;
    return Math.sin(u * Math.PI) ** 0.6 * this.strength * this.dir;
  }
  contains(p) {
    return p.cx > this.x0 && p.cx < this.x1 && p.cy > this.y0 && p.cy < this.y1;
  }
  update(dt, game) {
    const prev = this.phase;
    this.t += dt;
    if (prev === 'warn' && this.phase === 'gust' && this.contains(game.player)) game.audio.play('gust');
    // flurries blowing through the zone
    const ph = this.phase;
    if (ph !== 'calm' && Math.random() < (ph === 'gust' ? 0.9 : 0.25)) {
      const y = rand(this.y0, this.y1);
      const x = this.dir > 0 ? this.x0 + rand(0, 60) : this.x1 - rand(0, 60);
      game.particles.add({ x, y, vx: this.dir * rand(500, 800), vy: rand(-20, 30), kind: 'streak', size: 1.2, color: 'rgba(230,240,255,0.5)', life: 0.6 });
    }
  }
}

// ── Temple bell ───────────────────────────────────────────────
// Strike it with your sword. All bells in a set ringing opens the way.
export class Bell {
  constructor(cx, topY, set) {
    Object.assign(this, { cx0: cx, topY, set, w: 46, h: 52, rung: false, swing: 0, sv: 0, flash: 0, alive: true, dead: false, contact: false, unkillable: true, bell: true });
    this.x = cx - this.w / 2;
    this.y = topY + 14;
  }
  get cx() {
    return this.cx0;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    this.sv += -this.swing * 30 * dt;
    this.sv *= Math.exp(-1.2 * dt);
    this.swing += this.sv * dt;
  }
  hurt(dmg, dirX, game) {
    this.sv += dirX * 3.2;
    this.flash = 0.25;
    game.audio.play('bell');
    game.particles.add({ x: this.cx, y: this.cy, kind: 'ring', size: 20, grow: 420, color: 'rgba(255,220,150,0.5)', life: 0.6, additive: true });
    game.camera.shake(0.12);
    if (!this.rung) {
      this.rung = true;
      game.onBellRung?.(this);
    }
    return true;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.cx0, this.topY);
    ctx.rotate(this.swing * 0.25);
    ctx.strokeStyle = '#1a1210';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 14);
    ctx.stroke();
    const g = ctx.createLinearGradient(-23, 0, 23, 0);
    g.addColorStop(0, '#3a2a14');
    g.addColorStop(0.5, this.flash > 0 ? '#ffe9a8' : '#8a6a2e');
    g.addColorStop(1, '#2a1e0e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-14, 14);
    ctx.quadraticCurveTo(-20, 20, -20, 40);
    ctx.lineTo(-23, 66);
    ctx.lineTo(23, 66);
    ctx.lineTo(20, 40);
    ctx.quadraticCurveTo(20, 20, 14, 14);
    ctx.closePath();
    ctx.fill();
    // bosses (nipples) in rows
    ctx.fillStyle = 'rgba(255,220,150,0.35)';
    for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) {
      ctx.beginPath();
      ctx.arc(c * 6, 24 + r * 7, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (this.rung) glow(ctx, this.cx0, this.topY + 44, 40, 'rgb(255,210,140)', 0.35);
  }
  light(out) {
    out.push({ x: this.cx0, y: this.topY + 40, r: this.rung ? 120 : 60, color: 'rgb(255,200,130)', i: this.rung ? 0.6 : 0.25 });
  }
}

// ── Snow monkey (ambient) ─────────────────────────────────────
// Soaking in the onsen. Run past and it ducks under with a squeak.
export class SnowMonkey {
  constructor(cx, waterY) {
    Object.assign(this, { cx, waterY, duck: 0, t: rand(0, 6), alive: true, dead: false, contact: false, unkillable: true, ambient: true, w: 1, h: 1, x: cx, y: waterY });
  }
  update(dt, game) {
    this.t += dt;
    const p = game.player;
    const close = Math.abs(p.cx - this.cx) < 70 && Math.abs(p.feetY - this.waterY) < 60 && Math.abs(p.vx) > 120;
    if (close && this.duck <= 0) {
      this.duck = 2.2;
      game.audio.play('monkey');
      game.splash(this.cx, this.waterY, 6);
    }
    this.duck -= dt;
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    const sink = this.duck > 0 ? Math.min(1, this.duck * 3, (2.2 - this.duck) * 3 + 0.3) * 16 : 0;
    const y = this.waterY + 4 + sink;
    const x = this.cx;
    const bob = Math.sin(this.t * 1.5) * 1;
    ctx.fillStyle = '#8a7a6a';
    ctx.beginPath();
    ctx.ellipse(x, y - 8 + bob, 12, 10, 0, Math.PI, 0);
    ctx.fill();
    // red face, snow on the head
    ctx.fillStyle = '#c4645a';
    ctx.beginPath();
    ctx.ellipse(x + 3, y - 12 + bob, 5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1010';
    ctx.fillRect(x + 1.5, y - 14 + bob, 1.4, 1.4);
    ctx.fillRect(x + 4.5, y - 14 + bob, 1.4, 1.4);
    ctx.fillStyle = '#e4ecf7';
    ctx.beginPath();
    ctx.ellipse(x - 1, y - 18 + bob, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  light(out) {}
}
