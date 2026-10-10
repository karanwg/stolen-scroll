import { TILE } from '../config.js';
import { drawFlame, glow } from '../render/shapes.js';
import { rand } from '../core/math.js';

// Enemy-owned projectiles and lingering hazards. Each has a box, update and draw.

export class Kunai {
  constructor(x, y, vx, vy) {
    Object.assign(this, { x: x - 6, y: y - 3, w: 12, h: 6, vx, vy, dead: false, damage: 1, deflectable: true, life: 3 });
    this.angle = Math.atan2(vy, vx);
  }
  update(dt, game) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.life <= 0 || game.level.boxHit(this.x + 3, this.y + 1, 6, 4)) {
      this.dead = true;
      game.particles.burst(this.x + 6, this.y + 3, 5, { color: '#d9d2ff', kind: 'streak', size: 1.2, speed: 160, life: 0.2 });
    }
  }
  deflect(game) {
    this.dead = true;
    game.particles.burst(this.x + 6, this.y + 3, 10, { color: '#fff4d8', kind: 'streak', size: 1.5, speed: 260, life: 0.25, additive: true });
    game.audio.play('clang');
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x + 6, this.y + 3);
    ctx.rotate(this.angle);
    ctx.strokeStyle = 'rgba(170,140,255,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(-4, 0);
    ctx.stroke();
    ctx.fillStyle = '#0b0710';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(0, -3.2);
    ctx.lineTo(-6, 0);
    ctx.lineTo(0, 3.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cfc8e6';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(1, -1.8);
    ctx.lineTo(-3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a1020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-11, 0);
    ctx.stroke();
    ctx.strokeStyle = '#d0c4a8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-13, 0, 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  light(out) {}
}

// Balrog's spit: arcs under gravity and bursts into a short-lived fire patch.
export class Fireball {
  constructor(x, y, vx, vy, big = false) {
    const s = big ? 24 : 18;
    Object.assign(this, { x: x - s / 2, y: y - s / 2, w: s, h: s, vx, vy, dead: false, damage: 1, deflectable: false, big, t: 0 });
  }
  update(dt, game) {
    this.t += dt;
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.random() < 0.7) {
      game.particles.add({ x: this.x + this.w / 2 + rand(-4, 4), y: this.y + this.h / 2 + rand(-4, 4), vx: rand(-20, 20), vy: rand(-40, -10), size: rand(2, 4), color: 'rgb(255,140,50)', additive: true, life: 0.35, grow: -6 });
    }
    const hit = game.level.boxHit(this.x + 2, this.y + 2, this.w - 4, this.h - 4, true, this.y + this.h - this.vy * dt);
    if (hit || this.y > game.level.heightPx) {
      this.dead = true;
      const fx = this.x + this.w / 2;
      const fy = hit ? hit[1] * TILE : this.y + this.h;
      game.audio.play('explode');
      game.particles.burst(fx, fy - 6, 22, { color: 'rgb(255,150,60)', additive: true, speed: 260, life: 0.45, size: 2.5, grav: 500, angle: -Math.PI / 2, spread: Math.PI * 1.2 });
      game.particles.add({ x: fx, y: fy - 10, kind: 'ring', size: 8, grow: 220, color: 'rgba(255,170,90,0.8)', life: 0.3, additive: true });
      if (hit && game.level.tileAt(hit[0], hit[1] - 1) === '.') game.projectiles.push(new FirePatch(fx, fy, this.big ? 110 : 80, 2.6));
      game.camera.shake(0.12);
    }
  }
  draw(ctx, game) {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    glow(ctx, cx, cy, this.w * 2.5, 'rgb(255,120,40)', 0.6);
    const a = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a + Math.PI / 2);
    drawFlame(ctx, 0, this.w * 0.35, this.w * 1.1, this.w * 2.4, game.time, this.t * 3);
    ctx.restore();
    ctx.fillStyle = '#fff1c4';
    ctx.beginPath();
    ctx.arc(cx, cy, this.w * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  light(out) {
    out.push({ x: this.x + this.w / 2, y: this.y + this.h / 2, r: 160, color: 'rgb(255,140,60)', i: 0.9 });
  }
}

// Burning ground left behind by fireballs; hurts while it lasts.
export class FirePatch {
  constructor(cx, floorY, width, life) {
    Object.assign(this, { x: cx - width / 2, y: floorY - 26, w: width, h: 26, dead: false, damage: 1, deflectable: false, life, max: life, seed: Math.random() * 50, harmless: false });
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    this.harmless = this.life < 0.35 || this.max - this.life < 0.15;
  }
  draw(ctx, game) {
    const k = Math.min(1, this.life / 0.4, (this.max - this.life) / 0.15);
    const n = Math.round(this.w / 18);
    for (let i = 0; i < n; i++) {
      const fx = this.x + (this.w * (i + 0.5)) / n;
      drawFlame(ctx, fx, this.y + this.h, 22, 34 * k, game.time, this.seed + i * 7, k);
    }
  }
  light(out) {
    out.push({ x: this.x + this.w / 2, y: this.y + 10, r: 140, color: 'rgb(255,120,40)', i: 0.7 * Math.min(1, this.life) });
  }
}

// A wall of flame racing along the floor (Balrog's slam).
export class FlameWave {
  constructor(x, floorY, dir, speed = 360) {
    Object.assign(this, { x: x - 14, y: floorY - 48, w: 28, h: 48, vx: dir * speed, dir, dead: false, damage: 1, deflectable: false, life: 2.4, seed: Math.random() * 50 });
  }
  update(dt, game) {
    this.life -= dt;
    this.x += this.vx * dt;
    if (this.life <= 0 || game.level.boxHit(this.x + 4, this.y + 4, this.w - 8, this.h - 10)) this.dead = true;
    if (Math.random() < 0.6) game.particles.add({ x: this.x + rand(0, this.w), y: this.y + this.h - 4, vx: -this.vx * 0.1 + rand(-30, 30), vy: rand(-140, -60), size: rand(1.5, 3), color: 'rgb(255,170,70)', additive: true, life: 0.5 });
  }
  draw(ctx, game) {
    const k = Math.min(1, this.life * 2);
    for (let i = 0; i < 3; i++) drawFlame(ctx, this.x + 6 + i * 8, this.y + this.h, 22, (34 + i * 10) * k, game.time, this.seed + i * 3);
  }
  light(out) {
    out.push({ x: this.x + this.w / 2, y: this.y + 20, r: 150, color: 'rgb(255,130,50)', i: 0.8 });
  }
}
