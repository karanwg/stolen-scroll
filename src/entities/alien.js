import { TILE } from '../config.js';
import { approach, clamp, rand, sign } from '../core/math.js';
import { moveBody, groundAhead } from '../world/body.js';
import { glow } from '../render/shapes.js';
import { drawXeno } from '../render/xenoArt.js';

const GRAV = 1900;

// ── Egg ───────────────────────────────────────────────────────
// Leathery, faintly breathing. Get close and the four lips peel open.
// Kill it before it opens and nothing comes out.
export class Egg {
  constructor(cx, floorY) {
    Object.assign(this, { w: 30, h: 36, state: 'closed', t: 0, open: 0, hp: 2, flash: 0, dying: 0, dead: false, contact: false, alien: true, time: rand(0, 6) });
    this.x = cx - this.w / 2;
    this.y = floorY - this.h;
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
      if (this.dying <= 0) this.dead = true;
      return;
    }
    const p = game.player;
    if (this.state === 'closed') {
      if (Math.abs(p.cx - this.cx) < 150 && Math.abs(p.feetY - (this.y + this.h)) < 90 && p.state !== 'dead') {
        this.state = 'opening';
        this.t = 0.7;
        game.audio.play('eggOpen');
      }
    } else if (this.state === 'opening') {
      this.t -= dt;
      this.open = Math.min(1, this.open + dt / 0.7);
      if (this.t <= 0) {
        this.state = 'open';
        const hug = new Facehugger(this.cx, this.y + 10);
        hug.vx = sign(p.cx - this.cx) * 260;
        hug.vy = -520;
        hug.state = 'leap';
        game.enemies.push(hug);
        game.audio.play('hugger');
      }
    }
  }
  hurt(dmg, dirX, game) {
    if (!this.alive || this.state === 'open') return false;
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.dying = 0.4;
      game.particles.burst(this.cx, this.cy, 20, { color: 'rgba(170,200,120,0.9)', speed: 200, life: 0.6, size: 2.5, grav: 900 });
    }
    return true;
  }
  draw(ctx) {
    const x = this.cx;
    const by = this.y + this.h;
    const breathe = 1 + Math.sin(this.time * 2) * 0.03;
    if (this.dying > 0) ctx.globalAlpha = clamp(this.dying * 2.5, 0, 1);
    ctx.save();
    ctx.translate(x, by);
    ctx.scale(breathe, 1 / breathe);
    const g = ctx.createRadialGradient(-5, -24, 2, 0, -18, 22);
    g.addColorStop(0, this.flash > 0 ? '#fff' : '#7a7058');
    g.addColorStop(1, this.flash > 0 ? '#fff' : '#3a3428');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.bezierCurveTo(-18, -10, -16, -34, 0, -36);
    ctx.bezierCurveTo(16, -34, 18, -10, 10, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,24,18,0.6)';
    ctx.lineWidth = 1;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 4, -2);
      ctx.quadraticCurveTo(k * 7, -18, k * 2, -34);
      ctx.stroke();
    }
    // the four lips
    const o = this.open;
    ctx.fillStyle = '#4a4232';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.quadraticCurveTo(s * (6 + o * 10), -38 - o * 8, s * (4 + o * 14), -26 + o * 4);
      ctx.lineTo(0, -30);
      ctx.fill();
    }
    if (o > 0) {
      ctx.fillStyle = `rgba(160,255,190,${0.5 * o})`;
      ctx.beginPath();
      ctx.ellipse(0, -32, 6 * o, 3 * o, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (this.state === 'opening') glow(ctx, x, this.y + 4, 30, 'rgb(150,255,180)', 0.5);
  }
  light(out) {
    out.push({ x: this.cx, y: this.y + 6, r: this.state === 'opening' ? 80 : 40, color: 'rgb(140,230,170)', i: 0.35 });
  }
}

// ── Facehugger ────────────────────────────────────────────────
export class Facehugger {
  constructor(cx, feetY) {
    Object.assign(this, { w: 24, h: 12, vx: 0, vy: 0, facing: 1, hp: 1, state: 'scuttle', t: 0, flash: 0, dying: 0, dead: false, contact: true, grounded: false, alien: true, step: 0 });
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
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
    this.flash -= dt;
    const lvl = game.level;
    if (this.dying > 0) {
      this.dying -= dt;
      this.vy += GRAV * dt;
      moveBody(this, lvl, dt);
      if (this.dying <= 0) this.dead = true;
      return;
    }
    const p = game.player;
    this.t -= dt;
    const dx = p.cx - this.cx;
    switch (this.state) {
      case 'leap':
        if (this.grounded && this.vy >= 0) this.state = 'scuttle';
        break;
      case 'scuttle':
        this.facing = sign(dx) || this.facing;
        this.vx = groundAhead(this, lvl, this.facing, 6) ? approach(this.vx, this.facing * 210, 1400 * dt) : 0;
        this.step += dt * 30;
        if (Math.abs(dx) < 170 && Math.abs(p.cy - this.cy) < 80 && this.grounded && this.t <= 0) {
          this.state = 'crouch';
          this.t = 0.22;
          this.vx = 0;
        }
        break;
      case 'crouch':
        if (this.t <= 0) {
          this.vx = clamp(dx * 2.6, -460, 460);
          this.vy = -460;
          this.state = 'leap';
          this.t = 0.9;
          game.audio.play('hugger');
        }
        break;
    }
    this.vy = Math.min(this.vy + GRAV * dt, 900);
    moveBody(this, lvl, dt);
    if (lvl.hazardIn(this.x, this.y, this.w, this.h)?.[2] === 'fire') this.hurt(9, 0, game);
  }
  hurt(dmg, dirX, game) {
    if (!this.alive) return false;
    this.dying = 0.35;
    this.contact = false;
    this.vx = dirX * 300;
    this.vy = -260;
    game.audio.play('squeal');
    return true;
  }
  draw(ctx) {
    const x = this.cx;
    const y = this.y + this.h;
    const f = this.facing;
    if (this.dying > 0) ctx.globalAlpha = clamp(this.dying * 3, 0, 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(f, 1);
    const flash = this.flash > 0;
    ctx.strokeStyle = flash ? '#fff' : '#b8a68c';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    // eight spindly fingers
    for (let i = 0; i < 4; i++) {
      const ph = this.step + i * 1.6;
      for (const side of [-1, 1]) {
        const bx = -6 + i * 4;
        const reach = 10 + Math.sin(ph + side) * 3;
        ctx.beginPath();
        ctx.moveTo(bx, -7);
        ctx.quadraticCurveTo(bx + side * 2 + reach * 0.4, -14, bx + reach * 0.6 * side + 6, -1 + (this.grounded ? 0 : -4));
        ctx.stroke();
      }
    }
    // body
    ctx.fillStyle = flash ? '#fff' : '#cdbb9f';
    ctx.beginPath();
    ctx.ellipse(0, -8, 9, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,60,40,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(6, -10);
    ctx.stroke();
    // tail
    ctx.strokeStyle = flash ? '#fff' : '#b8a68c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.bezierCurveTo(-18, -8, -20, -16 + Math.sin(this.step * 0.5) * 4, -28, -6);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  light(out) {}
}

// ── Drone ─────────────────────────────────────────────────────
// Clings to the ceiling, almost invisible. Pass beneath it and it drops.
export class Drone {
  constructor(cx, ceilY) {
    Object.assign(this, { w: 30, h: 42, vx: 0, vy: 0, facing: -1, hp: 6, state: 'hang', t: 0, stun: 0, flash: 0, dying: 0, dead: false, contact: false, grounded: false, alien: true, walk: 0, time: rand(0, 6), anchorY: ceilY });
    this.x = cx - this.w / 2;
    this.y = ceilY;
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
    this.time += dt;
    this.flash -= dt;
    const lvl = game.level;
    if (this.dying > 0) {
      this.dying -= dt;
      this.vy += GRAV * dt;
      moveBody(this, lvl, dt);
      if (this.dying <= 0) this.dead = true;
      return;
    }
    const p = game.player;
    this.t -= dt;
    this.stun -= dt;
    const dx = p.cx - this.cx;
    if (this.state === 'hang') {
      if (Math.abs(dx) < 70 && p.y > this.y && p.y - this.y < 320 && p.state !== 'dead') {
        this.state = 'drop';
        this.contact = true;
        this.facing = sign(dx) || 1;
        game.audio.play('screech');
        game.camera.shake(0.2);
      }
      return;
    }
    if (this.stun > 0) this.vx = approach(this.vx, 0, 900 * dt);
    else {
      switch (this.state) {
        case 'drop':
          if (this.grounded) {
            this.state = 'stalk';
            this.t = 0.3;
            game.dust(this.cx, this.feetY, 8);
          }
          break;
        case 'stalk':
          this.facing = sign(dx) || this.facing;
          this.vx = groundAhead(this, lvl, this.facing, 8) ? approach(this.vx, this.facing * 140, 900 * dt) : 0;
          this.walk += (Math.abs(this.vx) * dt) / 14;
          if (Math.abs(dx) < 170 && Math.abs(p.cy - this.cy) < 90 && this.t <= 0) {
            this.state = 'crouch';
            this.t = 0.45;
            this.vx = 0;
            game.audio.play('hiss');
          }
          break;
        case 'crouch':
          if (this.t <= 0) {
            this.state = 'pounce';
            this.t = 0.5;
            this.vx = this.facing * 520;
            this.vy = -320;
          }
          break;
        case 'pounce':
          if (this.grounded && this.t < 0.4) {
            this.state = 'recover';
            this.t = 0.6;
          }
          break;
        case 'recover':
          this.vx = approach(this.vx, 0, 1500 * dt);
          if (this.t <= 0) {
            this.state = 'stalk';
            this.t = 0.4;
          }
          break;
      }
    }
    this.vy = Math.min(this.vy + GRAV * dt, 1000);
    moveBody(this, lvl, dt);
  }
  hurt(dmg, dirX, game) {
    if (!this.alive) return false;
    if (this.state === 'hang') {
      this.state = 'drop';
      this.contact = true;
    }
    this.hp -= dmg;
    this.flash = 0.1;
    game.particles.burst(this.cx, this.cy, 8, { color: 'rgb(170,255,90)', speed: 200, life: 0.5, size: 2, grav: 900, additive: true });
    if (this.hp <= 0) {
      this.dying = 0.6;
      this.contact = false;
      this.vx = dirX * 200;
      this.vy = -260;
      game.audio.play('screech');
      return true;
    }
    if (this.state !== 'pounce') {
      this.vx = dirX * 200;
      this.stun = 0.18;
    }
    return true;
  }
  draw(ctx) {
    if (this.dying > 0) ctx.globalAlpha = clamp(this.dying * 2, 0, 1);
    const pose = { flash: this.flash, walk: this.walk, moving: Math.min(1, Math.abs(this.vx) / 140), tail: this.time * 2 };
    if (this.state === 'hang') {
      drawXeno(ctx, this.cx, this.anchorY, this.facing, { ...pose, cling: 'ceiling', crouch: 0.6, tail: this.time * 0.6 }, 0.6);
    } else {
      if (this.state === 'crouch') Object.assign(pose, { crouch: 0.8, jaw: Math.min(1, (0.45 - this.t) * 3), claw: 0.4 });
      if (this.state === 'pounce') Object.assign(pose, { lean: 0.5, claw: 1 });
      if (this.state === 'drop') Object.assign(pose, { crouch: 0.4, claw: 0.8 });
      drawXeno(ctx, this.cx, this.feetY, this.facing, pose, 0.6);
    }
    ctx.globalAlpha = 1;
  }
  light(out) {}
}
