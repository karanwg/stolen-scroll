import { approach, rand, sign, clamp } from '../core/math.js';
import { moveBody, groundAhead, wallAhead } from '../world/body.js';
import { NinjaRig, POSES, STYLES, runPose } from '../render/ninjaRig.js';
import { glow, drawFlame } from '../render/shapes.js';
import { Kunai } from './projectiles.js';

const GRAV = 1900;

class Enemy {
  constructor(cx, feetY, w, h, hp) {
    this.w = w;
    this.h = h;
    this.x = cx - w / 2;
    this.y = feetY - h;
    this.home = { x: cx, y: feetY };
    this.vx = 0;
    this.vy = 0;
    this.hp = hp;
    this.maxHp = hp;
    this.facing = -1;
    this.dead = false;
    this.dying = 0;
    this.state = 'patrol';
    this.t = 0;
    this.stun = 0;
    this.flash = 0;
    this.contact = true;
    this.grounded = false;
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

  seesPlayer(game, rangeX, rangeY = 90) {
    const p = game.player;
    if (p.state === 'dead') return false;
    return Math.abs(p.cx - this.cx) < rangeX && Math.abs(p.cy - this.cy) < rangeY;
  }

  // Returns true if the hit landed.
  hurt(dmg, dirX, game) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.rig) this.rig.flash = 0.12;
    if (this.hp <= 0) {
      this.dying = 0.5;
      this.contact = false;
      this.vx = dirX * 260;
      this.vy = -280;
      this.onDeath?.(game);
      return true;
    }
    this.onHurt(dirX, game);
    return true;
  }

  onHurt(dirX) {
    this.vx = dirX * 240;
    this.stun = 0.16;
  }

  updateDying(dt, game) {
    this.dying -= dt;
    this.vy += GRAV * dt;
    this.vx = approach(this.vx, 0, 500 * dt);
    moveBody(this, game.level, dt);
    if (this.dying <= 0) this.dead = true;
  }

  light(out) {}
}

// ── Binoshi Blade ─────────────────────────────────────────────
// Patrols; when it spots you it closes in, crouches (tell + glint), lunges, then recovers.
export class Blade extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 20, 46, 4);
    this.rig = new NinjaRig(STYLES.binoshi);
    this.facing = Math.random() < 0.5 ? -1 : 1;
    this.phase = 0;
    this.lungeHit = false;
  }

  update(dt, game) {
    this.flash -= dt;
    if (this.dying > 0) {
      this.updateDying(dt, game);
      this.animate(dt);
      return;
    }
    const p = game.player;
    const lvl = game.level;
    this.t -= dt;
    this.stun -= dt;
    const toP = sign(p.cx - this.cx) || this.facing;
    const dist = Math.abs(p.cx - this.cx);

    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 900 * dt);
    } else {
      switch (this.state) {
        case 'patrol':
          this.vx = this.facing * 55;
          if (!groundAhead(this, lvl, this.facing, 6) || wallAhead(this, lvl, this.facing) || Math.abs(this.cx - this.home.x) > 160) {
            this.facing *= -1;
            if (Math.abs(this.cx - this.home.x) > 160) this.facing = sign(this.home.x - this.cx);
          }
          if (this.seesPlayer(game, 300, 80)) {
            this.state = 'alert';
            this.t = 0.3;
            this.facing = toP;
            this.vx = 0;
          }
          break;
        case 'alert':
          this.vx = 0;
          if (this.t <= 0) this.state = 'approach';
          break;
        case 'approach':
          this.facing = toP;
          if (!this.seesPlayer(game, 420, 120)) {
            this.state = 'patrol';
            break;
          }
          if (dist < 150) {
            this.state = 'windup';
            this.t = 0.42;
            this.vx = 0;
            game.audio.play('tell');
          } else if (groundAhead(this, lvl, this.facing, 8)) this.vx = approach(this.vx, this.facing * 165, 900 * dt);
          else this.vx = 0;
          break;
        case 'windup':
          this.vx = approach(this.vx, -this.facing * 30, 600 * dt);
          if (this.t <= 0) {
            this.state = 'lunge';
            this.t = 0.24;
            this.lungeHit = false;
            game.audio.play('lunge');
          }
          break;
        case 'lunge':
          this.vx = groundAhead(this, lvl, this.facing, 10) ? this.facing * 560 : 0;
          if (this.t > 0.05 && Math.random() < 0.8) game.particles.add({ x: this.cx - this.facing * 10, y: this.feetY - rand(4, 30), vx: -this.facing * 60, vy: rand(-10, 10), size: rand(1, 2), kind: 'streak', color: 'rgba(180,140,255,0.8)', life: 0.2, additive: true });
          if (this.t <= 0) {
            this.state = 'recover';
            this.t = 0.6;
          }
          break;
        case 'recover':
          this.vx = approach(this.vx, 0, 1600 * dt);
          if (this.t <= 0) this.state = 'approach';
          break;
      }
    }
    this.vy = Math.min(this.vy + GRAV * dt, 900);
    moveBody(this, lvl, dt);
    if (lvl.hazardIn(this.x, this.y, this.w, this.h)) this.hurt(99, -this.facing, game);
    this.animate(dt);
  }

  // The lunge has a longer reach than the body.
  attackBox() {
    if (this.state !== 'lunge') return null;
    return this.facing > 0 ? { x: this.cx, y: this.y + 6, w: 52, h: 30 } : { x: this.cx - 52, y: this.y + 6, w: 52, h: 30 };
  }

  onHurt(dirX) {
    // Lunges are committed: hits don't stop them.
    if (this.state === 'lunge') return;
    this.vx = dirX * 240;
    this.stun = 0.18;
    if (this.state === 'windup') this.t += 0.1;
    if (this.state === 'patrol') this.state = 'alert';
  }

  animate(dt) {
    let pose;
    let rate = 18;
    if (this.dying > 0) {
      pose = POSES.dead;
      rate = 12;
    } else if (this.stun > 0) pose = POSES.hurt;
    else if (this.state === 'windup') {
      pose = { ...POSES.crouch, sword: 1, armF: [-0.6, 0.4] };
      rate = 14;
    } else if (this.state === 'lunge') {
      pose = { ...POSES.dash, sword: 1, armF: [1.55, 0], lean: 0.7 };
      rate = 40;
    } else if (this.state === 'recover') pose = { ...POSES.idle, sword: 1, armF: [0.9, 0.2], lean: 0.25, drop: 3 };
    else if (Math.abs(this.vx) > 20) {
      this.phase += (Math.abs(this.vx) * dt) / 10.5;
      pose = runPose(this.phase, Math.min(1, Math.abs(this.vx) / 200));
      if (this.state === 'patrol') pose = { ...pose, lean: 0.12, armF: [0.3, 0.6], armB: [-0.3, 0.4] };
      rate = 26;
    } else pose = { ...POSES.idle, drop: Math.sin(this.rig.time * 2) * 0.6 };
    this.rig.set(pose, rate);
    this.rig.update(dt, this.cx, this.feetY, this.facing, this.vx, this.vy);
  }

  draw(ctx) {
    if (this.dying > 0) ctx.globalAlpha = clamp(this.dying * 2.5, 0, 1);
    this.rig.draw(ctx, this.cx, this.feetY, this.facing);
    ctx.globalAlpha = 1;
    if (this.state === 'windup') {
      const [hx, hy] = this.rig.tip('armF', this.cx, this.feetY, this.facing);
      const k = 1 - this.t / 0.42;
      glow(ctx, hx, hy, 24 + k * 22, 'rgb(220,190,255)', 0.5 + k * 0.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,255,255,${0.4 + k * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx - 10 * k, hy);
      ctx.lineTo(hx + 10 * k, hy);
      ctx.moveTo(hx, hy - 10 * k);
      ctx.lineTo(hx, hy + 10 * k);
      ctx.stroke();
      ctx.restore();
    }
    if (this.state === 'alert' && this.t > 0) {
      ctx.fillStyle = '#d9b8ff';
      ctx.font = 'bold 18px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', this.cx, this.y - 18 - (0.3 - this.t) * 20);
    }
  }

  light(out) {
    out.push({ x: this.cx, y: this.y + 8, r: 46, color: 'rgb(170,120,255)', i: 0.5 });
  }
}

// ── Binoshi Kunai thrower ─────────────────────────────────────
// Keeps its distance, winds up (arm raised + glint) and throws kunai you can slash out of the air.
export class Thrower extends Enemy {
  constructor(cx, feetY) {
    super(cx, feetY, 20, 46, 3);
    this.rig = new NinjaRig({ ...STYLES.binoshi, accent: '#c43cff', cloth: '#1c1222' });
    this.state = 'idle';
    this.t = rand(0.3, 1);
  }

  update(dt, game) {
    this.flash -= dt;
    if (this.dying > 0) {
      this.updateDying(dt, game);
      this.animate(dt);
      return;
    }
    const p = game.player;
    const lvl = game.level;
    this.t -= dt;
    this.stun -= dt;
    const toP = sign(p.cx - this.cx) || this.facing;
    const dist = Math.hypot(p.cx - this.cx, p.cy - this.cy);
    const aware = this.seesPlayer(game, 440, 200);

    if (this.stun > 0) this.vx = approach(this.vx, 0, 900 * dt);
    else {
      switch (this.state) {
        case 'idle':
          this.vx = approach(this.vx, 0, 900 * dt);
          if (aware) {
            this.facing = toP;
            if (dist < 130 && this.grounded && groundAhead(this, lvl, -toP, 40) && this.t <= 0) {
              this.state = 'hop';
              this.vx = -toP * 230;
              this.vy = -420;
              this.t = 0.5;
            } else if (this.t <= 0) {
              this.state = 'aim';
              this.t = 0.55;
              game.audio.play('tell');
            }
          }
          break;
        case 'hop':
          if (this.grounded && this.vy >= 0 && this.t < 0.35) {
            this.state = 'idle';
            this.t = 0.2;
          }
          break;
        case 'aim':
          this.facing = toP;
          this.vx = 0;
          if (this.t <= 0) {
            const [hx, hy] = this.rig.tip('armF', this.cx, this.feetY, this.facing);
            const tx = p.cx;
            const ty = p.cy - 4;
            const a = Math.atan2(ty - hy, tx - hx);
            game.projectiles.push(new Kunai(hx, hy, Math.cos(a) * 430, Math.sin(a) * 430));
            game.audio.play('kunai');
            this.state = 'release';
            this.t = 0.25;
          }
          break;
        case 'release':
          if (this.t <= 0) {
            this.state = 'idle';
            this.t = rand(1.1, 1.6);
          }
          break;
      }
    }
    this.vy = Math.min(this.vy + GRAV * dt, 900);
    moveBody(this, lvl, dt);
    if (lvl.hazardIn(this.x, this.y, this.w, this.h)) this.hurt(99, -this.facing, game);
    this.animate(dt);
  }

  onHurt(dirX) {
    this.vx = dirX * 260;
    this.stun = 0.2;
    if (this.state === 'aim') {
      this.state = 'idle';
      this.t = 0.4;
    }
  }

  animate(dt) {
    let pose;
    let rate = 18;
    if (this.dying > 0) pose = POSES.dead;
    else if (this.stun > 0) pose = POSES.hurt;
    else if (this.state === 'aim') pose = POSES.throwWind;
    else if (this.state === 'release') {
      pose = POSES.throwRelease;
      rate = 50;
    } else if (!this.grounded) pose = POSES.tuck;
    else pose = { ...POSES.idle, lean: 0.02, armF: [0.5, 1.2], drop: Math.sin(this.rig.time * 2.2) * 0.6 };
    this.rig.set(pose, rate);
    this.rig.update(dt, this.cx, this.feetY, this.facing, this.vx, this.vy);
  }

  draw(ctx) {
    if (this.dying > 0) ctx.globalAlpha = clamp(this.dying * 2.5, 0, 1);
    this.rig.draw(ctx, this.cx, this.feetY, this.facing);
    ctx.globalAlpha = 1;
    if (this.state === 'aim') {
      const [hx, hy] = this.rig.tip('armF', this.cx, this.feetY, this.facing);
      const k = 1 - this.t / 0.55;
      glow(ctx, hx, hy, 14 + k * 20, 'rgb(230,200,255)', 0.4 + k * 0.6);
    }
  }

  light(out) {
    out.push({ x: this.cx, y: this.y + 8, r: 46, color: 'rgb(200,120,255)', i: 0.5 });
  }
}

// ── Ember Crow ────────────────────────────────────────────────
// A burning spirit bird. Circles, stalks above you, flares, then dives in a straight line.
export class EmberCrow extends Enemy {
  // variant 'ember' (Chapter I) or 'storm' (Chapter II: crackling with lightning)
  constructor(cx, cy, variant = 'ember') {
    super(cx, cy + 12, 28, 22, 2);
    this.variant = variant;
    this.tint = variant === 'storm' ? { glow: 'rgb(120,190,255)', spark: 'rgb(170,220,255)', eye: '#e8f6ff', beak: '#9fb8c8' } : { glow: 'rgb(255,110,40)', spark: 'rgb(255,150,60)', eye: '#ffcf6a', beak: '#e8b04a' };
    this.state = 'hover';
    this.t = rand(0, 2);
    this.flap = rand(0, 6);
    this.side = Math.random() < 0.5 ? -1 : 1;
    this.dive = { x: 0, y: 0 };
  }

  update(dt, game) {
    this.flash -= dt;
    this.flap += dt * (this.state === 'dive' ? 6 : 14);
    if (this.dying > 0) {
      this.dying -= dt;
      this.vy += 900 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.dying <= 0) this.dead = true;
      return;
    }
    const p = game.player;
    this.t -= dt;
    this.stun -= dt;
    const aware = this.seesPlayer(game, 360, 260);
    if (Math.random() < 0.35) game.particles.add({ x: this.cx + rand(-6, 6), y: this.cy + rand(-4, 6), vx: rand(-15, 15), vy: rand(-50, -20), size: rand(1, 2.4), color: this.tint.spark, additive: true, life: 0.5, kind: this.variant === 'storm' ? 'streak' : 'dot' });

    if (this.stun > 0) {
      this.vx = approach(this.vx, 0, 600 * dt);
      this.vy = approach(this.vy, 0, 600 * dt);
    } else {
      switch (this.state) {
        case 'hover': {
          const tx = this.home.x + Math.sin(game.time * 0.8 + this.flap) * 50;
          const ty = this.home.y - 12 + Math.sin(game.time * 1.7) * 14;
          this.vx = approach(this.vx, (tx - this.cx) * 2, 300 * dt);
          this.vy = approach(this.vy, (ty - this.cy) * 2, 300 * dt);
          if (aware) {
            this.state = 'stalk';
            this.t = rand(1.2, 1.8);
            this.side = sign(this.cx - p.cx) || 1;
          }
          break;
        }
        case 'stalk': {
          const tx = p.cx + this.side * 130;
          const ty = p.cy - 110;
          const dx = tx - this.cx;
          const dy = ty - this.cy;
          const d = Math.hypot(dx, dy) || 1;
          const sp = Math.min(170, d * 3);
          this.vx = approach(this.vx, (dx / d) * sp, 500 * dt);
          this.vy = approach(this.vy, (dy / d) * sp, 500 * dt);
          if (!this.seesPlayer(game, 520, 380)) this.state = 'hover';
          else if (this.t <= 0) {
            this.state = 'tell';
            this.t = 0.42;
            game.audio.play('batScreech');
          }
          break;
        }
        case 'tell':
          this.vx = approach(this.vx, 0, 600 * dt);
          this.vy = approach(this.vy, -30, 600 * dt);
          if (this.t <= 0) {
            const dx = p.cx - this.cx;
            const dy = p.cy - this.cy;
            const d = Math.hypot(dx, dy) || 1;
            this.dive = { x: dx / d, y: dy / d };
            this.state = 'dive';
            this.t = 0.75;
          }
          break;
        case 'dive':
          this.vx = this.dive.x * 440;
          this.vy = this.dive.y * 440;
          if (this.t <= 0 || game.level.boxHit(this.x + 4, this.y + 4, this.w - 8, this.h - 8)) {
            this.state = 'recover';
            this.t = 0.7;
            this.vx *= -0.3;
            this.vy = -80;
          }
          break;
        case 'recover':
          this.vx = approach(this.vx, 0, 400 * dt);
          this.vy = approach(this.vy, -60, 400 * dt);
          if (this.t <= 0) {
            this.state = 'stalk';
            this.t = rand(1.0, 1.6);
            this.side = -this.side;
          }
          break;
      }
    }
    this.facing = this.vx >= 0 ? 1 : -1;
    if (this.state === 'tell' || this.state === 'dive') this.facing = this.dive.x >= 0 ? 1 : -1;
    if (this.state === 'tell') this.facing = sign(p.cx - this.cx) || 1;
    moveBody(this, game.level, dt, { oneWay: false });
  }

  onHurt(dirX) {
    this.vx = dirX * 260;
    this.vy = -60;
    this.stun = 0.22;
    if (this.state === 'dive' || this.state === 'tell') {
      this.state = 'recover';
      this.t = 0.6;
    }
  }

  onDeath(game) {
    game.particles.burst(this.cx, this.cy, 24, { color: this.tint.spark, additive: true, speed: 220, life: 0.6, size: 2.5 });
  }

  draw(ctx, game) {
    const cx = this.cx;
    const cy = this.cy;
    const f = this.facing;
    const tell = this.state === 'tell' ? 1 - this.t / 0.42 : 0;
    glow(ctx, cx, cy, 44 + tell * 40, this.tint.glow, 0.45 + tell * 0.5);
    if (this.dying > 0) ctx.globalAlpha = clamp(this.dying * 2.5, 0, 1);
    if (this.variant === 'storm') {
      // crackling tail of lightning
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(190,230,255,${0.6 + Math.random() * 0.4})`;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        let tx = cx - f * 6;
        let ty = cy + 2;
        ctx.moveTo(tx, ty);
        for (let i = 0; i < 4; i++) {
          tx -= f * rand(4, 8);
          ty += rand(-5, 5);
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // flame tail
      ctx.save();
      ctx.translate(cx - f * 8, cy + 2);
      ctx.rotate((-f * Math.PI) / 2 + Math.atan2(this.vy, Math.abs(this.vx) + 40) * f * 0.5);
      drawFlame(ctx, 0, 0, 16, 30, game.time, this.flap);
      ctx.restore();
    }
    // wings
    const w = Math.sin(this.flap) * (this.state === 'dive' ? 0.2 : 1);
    ctx.fillStyle = this.flash > 0 ? '#fff' : '#1a0a08';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - 2);
      ctx.quadraticCurveTo(cx + s * 10, cy - 14 - w * 12, cx + s * 22, cy - 6 - w * 16);
      ctx.quadraticCurveTo(cx + s * 16, cy - 2 - w * 6, cx + s * 18, cy + 2 - w * 4);
      ctx.quadraticCurveTo(cx + s * 10, cy, cx, cy + 4);
      ctx.fill();
    }
    // body
    ctx.fillStyle = this.flash > 0 ? '#fff' : '#120605';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // beak + head
    ctx.beginPath();
    ctx.ellipse(cx + f * 7, cy - 4, 5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.tint.beak;
    ctx.beginPath();
    ctx.moveTo(cx + f * 11, cy - 5);
    ctx.lineTo(cx + f * 17, cy - 3);
    ctx.lineTo(cx + f * 11, cy - 2);
    ctx.fill();
    ctx.fillStyle = tell > 0 ? '#ffffff' : this.tint.eye;
    ctx.beginPath();
    ctx.arc(cx + f * 9, cy - 5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // ember / static cracks
    ctx.strokeStyle = this.variant === 'storm' ? 'rgba(160,220,255,0.9)' : 'rgba(255,140,50,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 2);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx + 3, cy - 1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  light(out) {
    out.push({ x: this.cx, y: this.cy, r: 120, color: this.tint.glow, i: 0.8 });
  }
}
