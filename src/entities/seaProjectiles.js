import { drawFlame, glow } from '../render/shapes.js';
import { rand } from '../core/math.js';
import { TILE } from '../config.js';

// The Kraken's ink: arcs, bursts, and leaves a slick of stinging ink on
// whatever step it lands on.
export class InkBall {
  constructor(x, y, vx, vy) {
    Object.assign(this, { x: x - 11, y: y - 11, w: 22, h: 22, vx, vy, dead: false, damage: 1, t: 0 });
  }
  update(dt, game) {
    this.t += dt;
    this.vy += 900 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (Math.random() < 0.6) game.particles.add({ x: this.x + 11 + rand(-5, 5), y: this.y + 11 + rand(-5, 5), vx: rand(-20, 20), vy: rand(-20, 20), size: rand(2, 4), color: 'rgba(30,10,40,0.8)', life: 0.4, kind: 'smoke', grow: 6 });
    const cx = this.x + 11;
    const bottom = this.y + 22;
    // landed on a step?
    for (const p of game.level.platforms) {
      if (p.solid && cx > p.x && cx < p.x + p.w && bottom >= p.y && bottom - this.vy * dt <= p.y + 4) {
        this.burst(game, p.y);
        game.projectiles.push(new InkSlick(p, cx));
        return;
      }
    }
    const hit = game.level.boxHit(this.x + 4, this.y + 4, 14, 14);
    const surface = game.water?.surfaceAt(cx, this.y);
    if (hit || (surface !== null && surface !== undefined && bottom > surface + 6) || this.y > game.level.heightPx) {
      this.burst(game, hit ? hit[1] * TILE : surface ?? this.y);
    }
  }
  burst(game, y) {
    this.dead = true;
    game.audio.play('splat');
    game.particles.burst(this.x + 11, y - 4, 18, { color: 'rgba(40,12,55,0.9)', speed: 220, life: 0.5, size: 3, grav: 700, angle: -Math.PI / 2, spread: Math.PI });
  }
  draw(ctx) {
    const cx = this.x + 11;
    const cy = this.y + 11;
    glow(ctx, cx, cy, 34, 'rgb(150,70,220)', 0.4);
    ctx.fillStyle = '#16061e';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,120,255,0.6)';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  light(out) {
    out.push({ x: this.x + 11, y: this.y + 11, r: 90, color: 'rgb(150,80,220)', i: 0.5 });
  }
}

export class InkSlick {
  constructor(plat, cx) {
    this.plat = plat;
    this.off = cx - plat.x;
    Object.assign(this, { w: 70, h: 14, dead: false, damage: 1, life: 1.8, max: 1.8, harmless: false });
    this.sync();
  }
  sync() {
    this.x = this.plat.x + this.off - this.w / 2;
    this.y = this.plat.y - this.h;
  }
  update(dt) {
    this.life -= dt;
    this.sync();
    this.harmless = this.life < 0.3 || !this.plat.solid;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx, game) {
    const k = Math.min(1, this.life / 0.4);
    ctx.fillStyle = `rgba(30,8,44,${0.85 * k})`;
    ctx.beginPath();
    ctx.ellipse(this.x + this.w / 2, this.y + this.h - 2, this.w / 2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const bx = this.x + 10 + ((i * 17 + game.time * 20) % (this.w - 20));
      ctx.fillStyle = `rgba(170,90,255,${0.4 * k})`;
      ctx.beginPath();
      ctx.arc(bx, this.y + this.h - 4 - Math.abs(Math.sin(game.time * 5 + i)) * 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Phase-two storm: a pale column marks where the bolt will fall.
export class LightningStrike {
  constructor(x, arena, delay) {
    Object.assign(this, { cx: x, arena, delay, t: 0, dead: false, damage: 1, harmless: true });
    this.x = x - 22;
    this.w = 44;
    this.y = arena.surfaceY - 700;
    this.h = 700;
    this.struck = false;
  }
  update(dt, game) {
    this.t += dt;
    if (!this.struck && this.t >= this.delay) {
      this.struck = true;
      this.harmless = false;
      game.weather?.strike(this.cx - game.camera.left, 1);
      game.audio.play('thunder');
      game.camera.shake(0.5);
      game.splash(this.cx, this.arena.surfaceY, 20);
      game.particles.burst(this.cx, this.arena.surfaceY - 20, 20, { kind: 'streak', color: 'rgb(200,230,255)', speed: 400, life: 0.3, size: 2, additive: true });
    }
    if (this.struck && this.t > this.delay + 0.22) this.harmless = true;
    if (this.t > this.delay + 0.45) this.dead = true;
  }
  draw(ctx, game) {
    if (!this.struck) {
      const k = this.t / this.delay;
      ctx.fillStyle = `rgba(200,225,255,${0.06 + k * 0.16})`;
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = `rgba(230,240,255,${0.2 + k * 0.4})`;
      ctx.fillRect(this.cx - 1, this.y, 2, this.h);
      return;
    }
    const k = 1 - (this.t - this.delay) / 0.45;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(230,245,255,${k})`;
    ctx.lineWidth = 5 * k + 1;
    ctx.beginPath();
    let x = this.cx;
    ctx.moveTo(x, this.y);
    for (let i = 1; i <= 12; i++) {
      x = this.cx + rand(-16, 16);
      ctx.lineTo(x, this.y + (this.h * i) / 12);
    }
    ctx.stroke();
    ctx.restore();
    glow(ctx, this.cx, this.arena.surfaceY - 30, 140, 'rgb(190,220,255)', k);
  }
  light(out) {
    if (this.struck) out.push({ x: this.cx, y: this.arena.surfaceY - 150, r: 400, color: 'rgb(200,225,255)', i: 1 });
  }
}
