import { TILE } from '../config.js';
import { approach, clamp, rand, sign, lerp } from '../core/math.js';
import { moveBody, groundAhead } from '../world/body.js';
import { glow } from '../render/shapes.js';

// Chapter II creatures and contraptions: floating platforms, geysers,
// jellyfish, kappa, and the tentacles that come up out of the sea.

// ── Floating platform ─────────────────────────────────────────
// mode 'bob'     — debris / raft: bobs, dips a little under your weight
//      'sink'    — waterlogged: sinks while you stand on it, resurfaces later
//      'crumble' — rotten plank: holds a moment, then drops away
//      'step'    — the Kraken's floating steps: bob, and can be smashed under
export class FloatPlatform {
  constructor({ x, y, w, mode = 'bob', look = 'debris' }) {
    this.x = x;
    this.w = w;
    this.h = 12;
    this.baseY = y;
    this.y = y;
    this.mode = mode;
    this.look = look;
    this.phase = Math.random() * 6;
    this.load = 0; // seconds stood on
    this.dip = 0;
    this.sinkY = 0; // extra depth
    this.solid = true;
    this.downT = 0; // time spent sunk / fallen
    this.forced = 0; // forced under (Kraken slam)
    this.dx = 0;
    this.dy = 0;
    this.shake = 0;
  }

  update(dt, game, occupied) {
    const prevY = this.y;
    this.phase += dt;
    this.load = occupied ? this.load + dt : 0;
    let bob = Math.sin(this.phase * 1.7) * 3 + Math.sin(this.phase * 0.9) * 1.5;
    this.dip = approach(this.dip, occupied ? 6 : 0, 40 * dt);
    this.shake = 0;
    switch (this.mode) {
      case 'sink':
        if (occupied && this.load > 0.25) this.sinkY += 34 * dt;
        else if (!occupied && this.solid) this.sinkY = approach(this.sinkY, 0, 50 * dt);
        if (this.sinkY > 40 && this.solid) {
          this.solid = false;
          this.downT = 0;
          game.splash(this.x + this.w / 2, this.baseY, 10);
        }
        if (!this.solid) {
          this.downT += dt;
          if (this.downT > 2.2) {
            this.sinkY = approach(this.sinkY, 0, 60 * dt);
            if (this.sinkY < 12) this.solid = true;
          }
        }
        if (occupied && this.load > 0.25) this.shake = Math.sin(this.phase * 60) * 1;
        break;
      case 'crumble':
        bob = 0;
        if (this.solid && occupied && this.load > 0.45) {
          this.solid = false;
          this.downT = 0;
          game.audio.play('crumble');
          game.particles.burst(this.x + this.w / 2, this.y + 4, 12, { kind: 'shard', color: '#3a3330', size: 5, speed: 160, life: 0.9, grav: 1100, vrot: 10 });
        }
        if (this.solid && occupied && this.load > 0.1) this.shake = Math.sin(this.phase * 70) * 1.2;
        if (!this.solid) {
          this.downT += dt;
          this.sinkY = Math.min(400, this.sinkY + 600 * dt * Math.min(1, this.downT * 2));
          if (this.downT > 3) {
            this.solid = true;
            this.sinkY = 0;
          }
        }
        break;
      case 'step':
        bob *= 1.6;
        if (this.forced > 0) {
          this.forced -= dt;
          this.sinkY = approach(this.sinkY, 70, 400 * dt);
          this.solid = this.sinkY < 20;
        } else {
          this.sinkY = approach(this.sinkY, 0, 60 * dt);
          this.solid = this.sinkY < 20;
        }
        break;
      default:
        break;
    }
    this.y = this.baseY + bob + this.dip + this.sinkY;
    this.dy = this.y - prevY;
    this.dx = 0;
  }

  light(out) {
    if (this.look === 'step' && this.solid) out.push({ x: this.x + this.w - 6, y: this.y - 20, r: 90, color: 'rgb(255,190,120)', i: 0.55 });
  }

  smash(duration = 1.6) {
    this.forced = duration;
  }

  draw(ctx, game) {
    const x = this.x + this.shake;
    const y = this.y;
    const w = this.w;
    if (this.mode === 'crumble' && !this.solid && this.downT > 0.4) return;
    ctx.save();
    if (this.look === 'step') {
      // floating shrine steps: lacquered boards on barrel floats, a paper charm and a lamp
      ctx.fillStyle = '#120c0b';
      for (const fx of [x + 8, x + w - 8]) {
        ctx.beginPath();
        ctx.ellipse(fx, y + 16, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#2b1d1a';
      ctx.fillRect(x - 2, y + 4, w + 4, 11);
      ctx.fillStyle = '#8a2a24';
      ctx.fillRect(x - 3, y, w + 6, 5);
      ctx.fillStyle = 'rgba(255,190,160,0.45)';
      ctx.fillRect(x - 3, y, w + 6, 1.2);
      ctx.strokeStyle = '#0c0807';
      ctx.lineWidth = 1;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (w * k) / 4, y + 5);
        ctx.lineTo(x + (w * k) / 4, y + 15);
        ctx.stroke();
      }
      // shimenawa rope with paper streamers
      ctx.strokeStyle = '#b8a070';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.quadraticCurveTo(x + w / 2, y + 13, x + w, y + 8);
      ctx.stroke();
      ctx.fillStyle = '#e8dcc0';
      for (const k of [0.3, 0.7]) {
        ctx.beginPath();
        ctx.moveTo(x + w * k - 2, y + 11);
        ctx.lineTo(x + w * k + 2, y + 11);
        ctx.lineTo(x + w * k + 1, y + 17);
        ctx.lineTo(x + w * k - 3, y + 15);
        ctx.fill();
      }
      // lamp post at one end
      const lx = x + w - 6;
      ctx.fillStyle = '#2b1d1a';
      ctx.fillRect(lx - 1.5, y - 18, 3, 18);
      ctx.fillStyle = 'rgba(255,200,130,0.9)';
      ctx.fillRect(lx - 4, y - 24, 8, 7);
    } else if (this.look === 'plank') {
      ctx.fillStyle = '#2a2420';
      ctx.fillRect(x, y, w, 8);
      ctx.fillStyle = '#4a403a';
      ctx.fillRect(x, y, w, 2);
      ctx.strokeStyle = '#151110';
      ctx.lineWidth = 1;
      for (let k = 12; k < w; k += 14) {
        ctx.beginPath();
        ctx.moveTo(x + k, y);
        ctx.lineTo(x + k + 2, y + 8);
        ctx.stroke();
      }
    } else {
      // driftwood raft / crates
      ctx.fillStyle = '#231d1a';
      ctx.beginPath();
      ctx.moveTo(x - 3, y + 2);
      ctx.lineTo(x + w + 3, y + 1);
      ctx.lineTo(x + w, y + 12);
      ctx.lineTo(x + 2, y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3c3430';
      ctx.fillRect(x - 2, y, w + 4, 3);
      ctx.strokeStyle = '#120e0c';
      for (let k = 10; k < w; k += 12) {
        ctx.beginPath();
        ctx.moveTo(x + k, y + 1);
        ctx.lineTo(x + k, y + 11);
        ctx.stroke();
      }
      ctx.strokeStyle = '#8a7a5a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 2);
      ctx.lineTo(x + 7, y + 10);
      ctx.moveTo(x + w - 6, y + 2);
      ctx.lineTo(x + w - 3, y + 10);
      ctx.stroke();
    }
    if (this.mode === 'sink' && this.solid) {
      // waterlogged: dark, dripping
      ctx.fillStyle = 'rgba(20,40,55,0.45)';
      ctx.fillRect(x - 3, y, w + 6, 12);
    }
    ctx.restore();
  }
}

// ── Geyser ────────────────────────────────────────────────────
// A blowhole in the sea. Bubbles, then erupts: anything in the column is
// thrown upward. With the Kite Cloth open you ride the updraft.
export class Geyser {
  constructor(cx, surfaceY, { period = 3.4, offset = 0, height = 340 } = {}) {
    Object.assign(this, { cx, y: surfaceY, period, height, t: offset, w: 54 });
    this.state = 'idle';
  }
  get erupting() {
    return this.state === 'erupt';
  }
  update(dt, game) {
    this.t += dt;
    const ph = this.t % this.period;
    const prev = this.state;
    this.state = ph < this.period - 2.0 ? 'idle' : ph < this.period - 1.2 ? 'warn' : 'erupt';
    if (this.state === 'erupt' && prev !== 'erupt') game.audio.play('geyser');
    if (this.state === 'warn' && Math.random() < 0.5) game.particles.add({ x: this.cx + rand(-18, 18), y: this.y - 2, vx: 0, vy: rand(-60, -20), size: rand(2, 4), kind: 'ring', grow: 10, color: 'rgba(200,235,255,0.6)', life: 0.4 });
    if (this.state === 'erupt') {
      for (let i = 0; i < 3; i++) game.particles.add({ x: this.cx + rand(-16, 16), y: this.y - rand(0, this.height * 0.8), vx: rand(-40, 40), vy: rand(-500, -300), size: rand(2, 4), color: 'rgba(210,235,255,0.7)', life: 0.5, grav: 600 });
      const p = game.player;
      if (Math.abs(p.cx - this.cx) < this.w / 2 + 6 && p.feetY > this.y - this.height && p.y < this.y + 10 && p.state === 'normal') {
        // Holding jump in the column opens the Kite Cloth and rides the updraft.
        if (p.abilities.float && game.input.held('jump')) {
          p.floating = true;
          p.vy = Math.min(p.vy, -400);
        } else p.vy = Math.min(p.vy, -820);
        p.jumping = false;
        p.airJumps = 1;
        p.canDash = true;
      }
    }
  }
  draw(ctx, game) {
    if (this.state !== 'erupt') {
      if (this.state === 'warn') {
        ctx.fillStyle = 'rgba(220,240,255,0.5)';
        ctx.beginPath();
        ctx.ellipse(this.cx, this.y + 2, 22 + Math.sin(game.time * 20) * 3, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    const ph = (this.t % this.period) - (this.period - 1.2);
    const k = Math.min(1, ph / 0.15) * Math.min(1, (1.2 - ph) / 0.25);
    const h = this.height * k;
    const grad = ctx.createLinearGradient(0, this.y - h, 0, this.y);
    grad.addColorStop(0, 'rgba(220,240,255,0.15)');
    grad.addColorStop(0.3, 'rgba(190,225,250,0.55)');
    grad.addColorStop(1, 'rgba(160,210,240,0.8)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(this.cx - 20, this.y + 4);
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      ctx.lineTo(this.cx - 20 + Math.sin(game.time * 14 + u * 8) * 5 - u * 6, this.y - h * u);
    }
    for (let i = 10; i >= 0; i--) {
      const u = i / 10;
      ctx.lineTo(this.cx + 20 + Math.sin(game.time * 13 + u * 7) * 5 + u * 6, this.y - h * u);
    }
    ctx.closePath();
    ctx.fill();
  }
  light(out) {
    if (this.state === 'erupt') out.push({ x: this.cx, y: this.y - 120, r: 160, color: 'rgb(150,210,255)', i: 0.5 });
  }
}

// ── Jellyfish ─────────────────────────────────────────────────
// Can't be killed. Touching one stings — but a downward slash bounces you off
// it, so swarms of them become stepping stones.
export class Jelly {
  constructor(cx, cy) {
    Object.assign(this, { w: 34, h: 28, home: { x: cx, y: cy }, t: Math.random() * 6, flash: 0, squish: 0 });
    this.x = cx - this.w / 2;
    this.y = cy - this.h / 2;
    this.alive = true;
    this.dead = false;
    this.contact = true;
    this.unkillable = true;
  }
  get cx() {
    return this.x + this.w / 2;
  }
  get cy() {
    return this.y + this.h / 2;
  }
  update(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.squish = Math.max(0, this.squish - dt * 3);
    this.x = this.home.x - this.w / 2 + Math.sin(this.t * 0.7) * 6;
    this.y = this.home.y - this.h / 2 + Math.sin(this.t * 1.6) * 8;
  }
  hurt(dmg, dirX, game) {
    this.flash = 0.15;
    this.squish = 1;
    game.audio.play('jelly');
    game.particles.burst(this.cx, this.cy, 10, { kind: 'streak', color: 'rgb(150,240,255)', speed: 220, life: 0.25, size: 1.5, additive: true });
    return true;
  }
  draw(ctx, game) {
    const cx = this.cx;
    const cy = this.cy;
    const pulse = Math.sin(this.t * 3);
    const sq = this.squish;
    glow(ctx, cx, cy, 52, 'rgb(90,220,255)', 0.35 + this.flash * 2);
    // tentacles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(120,220,255,0.55)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const x0 = cx - 11 + i * 5.5;
      ctx.beginPath();
      ctx.moveTo(x0, cy + 4);
      for (let k = 1; k <= 6; k++) ctx.lineTo(x0 + Math.sin(this.t * 3 + i + k * 0.8) * 3, cy + 4 + k * 5);
      ctx.stroke();
    }
    // bell
    const w = 17 * (1 + sq * 0.3 + pulse * 0.05);
    const h = 13 * (1 - sq * 0.35 - pulse * 0.05);
    const grad = ctx.createRadialGradient(cx, cy - 4, 2, cx, cy, w);
    grad.addColorStop(0, this.flash > 0 ? 'rgba(255,255,255,0.95)' : 'rgba(200,250,255,0.85)');
    grad.addColorStop(1, 'rgba(60,170,230,0.35)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, w, h * 1.4, 0, Math.PI, 0);
    ctx.quadraticCurveTo(cx + w * 0.5, cy + 8, cx, cy + 6);
    ctx.quadraticCurveTo(cx - w * 0.5, cy + 8, cx - w, cy + 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx - 5, cy - 6, 4, 2, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  light(out) {
    out.push({ x: this.cx, y: this.cy, r: 120, color: 'rgb(110,220,255)', i: 0.7 });
  }
}

// ── Kappa ─────────────────────────────────────────────────────
// River imp with a water-dish head and a shell. Waddles; when it spots you it
// squats (tell), leaps at you in an arc, and is dazed for a moment on landing.
export class Kappa {
  constructor(cx, feetY) {
    Object.assign(this, { w: 26, h: 34, vx: 0, vy: 0, facing: -1, hp: 4, maxHp: 4, state: 'patrol', t: rand(0, 1), flash: 0, dying: 0, dead: false, contact: true, grounded: false, home: cx, step: 0 });
    this.x = cx - this.w / 2;
    this.y = feetY - this.h;
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
    const lvl = game.level;
    if (this.dying > 0) {
      this.dying -= dt;
      this.vy += 1900 * dt;
      moveBody(this, lvl, dt);
      if (this.dying <= 0) this.dead = true;
      return;
    }
    this.t -= dt;
    const p = game.player;
    const dx = p.cx - this.cx;
    const sees = Math.abs(dx) < 300 && Math.abs(p.cy - this.cy) < 120 && p.state !== 'dead';
    switch (this.state) {
      case 'patrol':
        this.vx = this.facing * 40;
        this.step += dt * 8;
        if (!groundAhead(this, lvl, this.facing, 6) || Math.abs(this.cx - this.home) > 120) this.facing *= -1;
        if (sees && this.t <= 0 && this.grounded) {
          this.facing = sign(dx) || this.facing;
          this.state = 'squat';
          this.t = 0.45;
          this.vx = 0;
          game.audio.play('kappa');
        }
        break;
      case 'squat':
        this.vx = 0;
        if (this.t <= 0) {
          // aim for the player, but never leap into open water
          let tx = clamp(p.cx, this.cx - 230, this.cx + 230);
          if (!this.landable(lvl, tx)) tx = this.cx + sign(dx) * 40;
          const air = 0.62;
          this.vx = (tx - this.cx) / air;
          this.vy = -0.5 * 1900 * air;
          this.state = 'leap';
          this.t = 0.2;
        }
        break;
      case 'leap':
        if (this.grounded && this.t <= 0) {
          this.state = 'dazed';
          this.t = 0.6;
          this.vx = 0;
          game.dust(this.cx, this.feetY, 6);
        }
        break;
      case 'dazed':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.t <= 0) {
          this.state = 'patrol';
          this.t = rand(0.6, 1.2);
        }
        break;
      case 'stun':
        this.vx = approach(this.vx, 0, 900 * dt);
        if (this.t <= 0) this.state = 'patrol';
        break;
    }
    this.vy = Math.min(this.vy + 1900 * dt, 900);
    moveBody(this, lvl, dt);
    if (lvl.hazardIn(this.x, this.y, this.w, this.h)) {
      game.splash(this.cx, this.feetY, 10);
      this.dead = true;
    }
  }
  landable(lvl, x) {
    for (let dy = 0; dy < 6; dy++) {
      const ty = Math.floor(this.feetY / TILE) + dy;
      const t = lvl.tileAt(Math.floor(x / TILE), ty);
      if (t === '#' || t === 'w' || t === '=') return true;
      if (t === '~' || t === '%' || t === '^') return false;
    }
    return false;
  }
  hurt(dmg, dirX, game) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.hp <= 0) {
      this.dying = 0.5;
      this.contact = false;
      this.vx = dirX * 240;
      this.vy = -300;
      return true;
    }
    if (this.state !== 'leap') {
      this.vx = dirX * 220;
      this.state = 'stun';
      this.t = 0.2;
    }
    return true;
  }
  draw(ctx, game) {
    const f = this.facing;
    const x = this.cx;
    const y = this.feetY;
    const squat = this.state === 'squat' ? 1 - this.t / 0.45 : 0;
    const air = this.state === 'leap';
    const bob = this.state === 'patrol' ? Math.abs(Math.sin(this.step)) * 2 : 0;
    const flash = this.flash > 0;
    if (this.dying > 0) ctx.globalAlpha = clamp(this.dying * 2.5, 0, 1);
    ctx.save();
    ctx.translate(x, y - bob);
    ctx.scale(f * (1 + squat * 0.12), 1 - squat * 0.18);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const skin = flash ? '#fff' : '#3d6a55';
    const dark = '#06100c';
    // legs
    ctx.strokeStyle = dark;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-6, -12);
    ctx.lineTo(air ? -12 : -8, air ? -6 : -1);
    ctx.moveTo(6, -12);
    ctx.lineTo(air ? 10 : 8, air ? -6 : -1);
    ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 5;
    ctx.stroke();
    // shell
    ctx.fillStyle = flash ? '#fff' : '#3a2a1c';
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(-5, -20, 12, 13, -0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.strokeStyle = '#5a442e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, -20);
    ctx.lineTo(4, -20);
    ctx.moveTo(-5, -31);
    ctx.lineTo(-5, -9);
    ctx.stroke();
    // body + belly
    ctx.fillStyle = skin;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(3, -18, 9, 11, 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#c9b56a';
    ctx.beginPath();
    ctx.ellipse(6, -17, 4.5, 7, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // arm
    ctx.strokeStyle = dark;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(5, -22);
    ctx.lineTo(air ? 14 : 12, air ? -30 : -14);
    ctx.stroke();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // head
    ctx.fillStyle = skin;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(6, -33, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    // water dish (sara) with hair fringe
    ctx.fillStyle = dark;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(-1 + i * 2.4, -38);
      ctx.lineTo(0 + i * 2.4, -43);
      ctx.lineTo(1.4 + i * 2.4, -38);
      ctx.fill();
    }
    ctx.fillStyle = flash ? '#fff' : '#a9d6e6';
    ctx.beginPath();
    ctx.ellipse(6, -40, 5.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // beak + eye
    ctx.fillStyle = '#e0b24a';
    ctx.beginPath();
    ctx.moveTo(12, -34);
    ctx.lineTo(19, -32);
    ctx.lineTo(12, -29);
    ctx.fill();
    ctx.fillStyle = squat > 0 ? '#ffffff' : '#ffe27a';
    ctx.beginPath();
    ctx.arc(9, -35, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  light(out) {
    out.push({ x: this.cx, y: this.y + 6, r: 40, color: 'rgb(255,230,140)', i: 0.35 });
  }
}

// ── Tentacle ──────────────────────────────────────────────────
// Rises from the water near walkways: bubbles (tell), rears up, slams across
// toward you, lies there a moment (cut it and it recoils), then sinks.
// The Kraken drives the same class for its own arms.
export class Tentacle {
  constructor(baseX, surfaceY, { length = 230, thick = 22, side = 0, range = 330, auto = true, color = '#6a2246' } = {}) {
    Object.assign(this, { baseX, baseY: surfaceY + 6, length, thick, side, range, auto, color });
    this.state = auto ? 'lurk' : 'idle';
    this.t = rand(0.5, 1.5);
    this.angle = -Math.PI / 2; // base direction
    this.curl = 0;
    this.rise = 0; // 0 = under water, 1 = full length out
    this.dir = 1;
    this.flash = 0;
    this.hits = 0;
    this.alive = true;
    this.dead = false;
    this.contact = false;
    this.x = baseX - 20;
    this.y = surfaceY - 40;
    this.w = 40;
    this.h = 40;
    this.cx = baseX;
    this.cy = surfaceY;
    this.wiggle = Math.random() * 6;
    this.onStuck = null; // Kraken hooks
  }

  // Launch an attack directly (used by the Kraken).
  attack(kind, targetX, game, opts = {}) {
    this.kind = kind;
    this.dir = sign(targetX - this.baseX) || 1;
    this.state = 'tell';
    this.t = opts.tell ?? 0.85;
    this.stuckTime = opts.stuck ?? 1.0;
    this.target = targetX;
    game.audio.play('bubbles');
  }

  update(dt, game) {
    this.t -= dt;
    this.wiggle += dt;
    this.flash = Math.max(0, this.flash - dt);
    const p = game.player;
    switch (this.state) {
      case 'lurk':
        this.rise = approach(this.rise, 0, 2 * dt);
        if (this.auto && this.t <= 0 && Math.abs(p.cx - this.baseX) < this.range && Math.abs(p.feetY - this.baseY) < 260 && p.state === 'normal') this.attack('slam', p.cx, game);
        break;
      case 'tell':
        if (Math.random() < 0.6) game.particles.add({ x: this.baseX + rand(-26, 26), y: this.baseY - 6, vx: 0, vy: rand(-40, -10), kind: 'ring', size: rand(2, 5), grow: 14, color: 'rgba(200,230,255,0.7)', life: 0.45 });
        this.rise = 0.08 + Math.sin(this.wiggle * 18) * 0.03;
        if (this.kind === 'skim' && Math.random() < 0.7) {
          // a line of foam racing out ahead of the arm
          const u = Math.random();
          game.particles.add({ x: lerp(this.baseX, this.target, u), y: this.baseY - 8, vx: this.dir * 60, vy: rand(-30, -5), kind: 'ring', size: rand(2, 5), grow: 16, color: 'rgba(220,240,255,0.7)', life: 0.4 });
        }
        if (this.t <= 0) {
          if (this.kind === 'skim') {
            this.state = 'skim';
            this.t = 1.1;
            this.angle = this.dir > 0 ? 0.02 : Math.PI - 0.02;
            this.curl = 0;
            this.rise = 0;
            this.baseY -= 14;
            game.audio.play('whip');
            game.splash(this.baseX, this.baseY, 14);
            break;
          }
          this.state = 'rise';
          this.t = 0.3;
          game.audio.play('tentacleRise');
          game.splash(this.baseX, this.baseY - 6, 18);
        }
        break;
      case 'skim':
        // flat along the water: out fast, hold, back
        if (this.t > 0.65) this.rise = Math.min(1, this.rise + dt / 0.4);
        if (Math.random() < 0.7) {
          const tip = this.points()[16];
          game.splash(tip[0], this.baseY + 8, 2);
        }
        if (this.t <= 0) {
          this.state = 'retract';
          this.t = 0.5;
        }
        break;
      case 'rise':
        this.rise = Math.min(1, this.rise + dt / 0.3);
        this.angle = -Math.PI / 2 - this.dir * 0.25;
        this.curl = -this.dir * 0.6;
        if (this.t <= 0) {
          this.state = 'rear';
          this.t = 0.3;
        }
        break;
      case 'rear':
        this.angle = -Math.PI / 2 - this.dir * 0.45 + Math.sin(this.wiggle * 10) * 0.05;
        this.curl = -this.dir * 0.9;
        if (this.t <= 0) {
          this.state = this.kind === 'sweep' ? 'sweep' : 'slam';
          this.t = this.kind === 'sweep' ? 1.0 : 0.2;
          game.audio.play(this.kind === 'sweep' ? 'whip' : 'tentacleSlam');
        }
        break;
      case 'slam': {
        const k = 1 - this.t / 0.2;
        this.angle = lerp(-Math.PI / 2 - this.dir * 0.45, this.dir > 0 ? -0.05 : Math.PI + 0.05, Math.min(1, k * k));
        this.curl = lerp(-this.dir * 0.9, this.dir * 0.15, k);
        if (this.t <= 0) {
          this.state = 'stuck';
          this.t = this.stuckTime ?? 1.0;
          this.angle = this.dir > 0 ? -0.05 : Math.PI + 0.05;
          game.camera.shake(0.35);
          game.audio.play('slam');
          const tip = this.points()[this.points().length - 1];
          game.splash(tip[0], this.baseY - 6, 14);
          this.onStuck?.(this, game);
        }
        break;
      }
      case 'sweep': {
        // low and flat across the water, scything toward the far side
        const k = 1 - this.t / 1.0;
        const a0 = this.dir > 0 ? -Math.PI + 0.2 : -0.2;
        const a1 = this.dir > 0 ? -0.08 : Math.PI + 0.08;
        this.angle = lerp(a0, a1, k);
        this.curl = this.dir * 0.2 * Math.sin(k * Math.PI);
        this.rise = 1;
        if (this.t <= 0) {
          this.state = 'retract';
          this.t = 0.5;
        }
        break;
      }
      case 'stuck':
        this.curl = this.dir * 0.12 + Math.sin(this.wiggle * 6) * 0.03;
        if (this.t <= 0 || this.hits >= 3) {
          this.state = 'retract';
          this.t = 0.5;
        }
        break;
      case 'retract':
        this.rise = Math.max(0, this.rise - dt / 0.5);
        if (this.rise <= 0) {
          this.state = this.auto ? 'lurk' : 'idle';
          this.t = rand(2.2, 3.2);
          this.hits = 0;
          this.angle = -Math.PI / 2;
        }
        break;
      case 'idle':
        this.rise = 0;
        break;
    }
    // bounding box for targeting (centre of the visible arm)
    const pts = this.points();
    const mid = pts[Math.floor(pts.length * 0.6)];
    this.cx = mid[0];
    this.cy = mid[1];
    this.x = mid[0] - 30;
    this.y = mid[1] - 30;
    this.w = 60;
    this.h = 60;
  }

  get active() {
    return ['rise', 'rear', 'slam', 'stuck', 'sweep', 'skim'].includes(this.state);
  }

  get hurtable() {
    return this.state === 'stuck' || this.state === 'rear';
  }

  points() {
    const n = 16;
    const L = this.length * this.rise;
    const pts = [];
    let x = this.baseX;
    let y = this.baseY;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push([x, y, this.thick * (1 - u * 0.85)]);
      const a = this.angle + this.curl * u * u + Math.sin(this.wiggle * 3 + u * 5) * 0.06 * u;
      x += Math.cos(a) * (L / n);
      y += Math.sin(a) * (L / n);
    }
    return pts;
  }

  // Does the arm touch the box?
  touches(b) {
    if (!this.active || this.rise < 0.3) return false;
    for (const [x, y, r] of this.points()) {
      const nx = clamp(x, b.x, b.x + b.w);
      const ny = clamp(y, b.y, b.y + b.h);
      if ((nx - x) ** 2 + (ny - y) ** 2 < (r * 0.8) ** 2) return true;
    }
    return false;
  }

  // Slashes land if the sword box covers any part of the arm.
  hitBy(box) {
    if (!this.hurtable) return false;
    for (const [x, y, r] of this.points()) {
      if (x + r > box.x && x - r < box.x + box.w && y + r > box.y && y - r < box.y + box.h) return true;
    }
    return false;
  }

  hurt(dmg, dirX, game) {
    if (!this.hurtable) return false;
    this.flash = 0.12;
    this.hits++;
    this.onHurt?.(game);
    if (this.state === 'rear') {
      // knocked back down before it can strike
      this.state = 'retract';
      this.t = 0.5;
    }
    return true;
  }

  draw(ctx, game) {
    if (this.rise <= 0.02 && this.state !== 'tell') return;
    const pts = this.points();
    const col = this.flash > 0 ? '#ffffff' : this.color;
    // body: thick tapered stroke built from segments
    ctx.save();
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0, r0] = pts[i - 1];
        const [x1, y1] = pts[i];
        ctx.strokeStyle = pass === 0 ? '#07040a' : col;
        ctx.lineWidth = r0 * 2 + (pass === 0 ? 3 : 0);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    // underside + suckers (on the side facing the slam)
    for (let i = 2; i < pts.length - 1; i += 1) {
      const [x0, y0, r] = pts[i];
      const [x1, y1] = pts[i + 1];
      const a = Math.atan2(y1 - y0, x1 - x0) + (Math.PI / 2) * (this.dir > 0 ? 1 : -1);
      const sx = x0 + Math.cos(a) * r * 0.55;
      const sy = y0 + Math.sin(a) * r * 0.55;
      ctx.fillStyle = this.flash > 0 ? '#fff' : '#e8b8c8';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(1.4, r * 0.3), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a1a38';
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.7, r * 0.13), 0, Math.PI * 2);
      ctx.fill();
    }
    // moonlit ridge along the top
    ctx.strokeStyle = 'rgba(255,190,225,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(([x, y, r], i) => (i ? ctx.lineTo(x, y - r * 0.55) : ctx.moveTo(x, y - r * 0.55)));
    ctx.stroke();
    // bioluminescent stripe: pulses travel from base to tip
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < pts.length; i += 1) {
      const [x, y, r] = pts[i];
      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(this.wiggle * 6 - i * 0.6));
      ctx.fillStyle = `rgba(90,235,255,${0.75 * pulse})`;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.15, Math.max(1.2, r * 0.18), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  light(out) {
    if (this.state === 'tell') out.push({ x: this.baseX, y: this.baseY - 10, r: 120, color: 'rgb(150,200,255)', i: 0.6 });
    if (this.rise > 0.2) {
      const pts = this.points();
      for (const k of [4, 10, 15]) out.push({ x: pts[k][0], y: pts[k][1], r: 130, color: 'rgb(110,200,240)', i: 0.45 * this.rise });
    }
  }
}
