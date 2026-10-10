import { TILE } from '../config.js';
import { approach, clamp, rand } from '../core/math.js';
import { glow } from '../render/shapes.js';
import { Facehugger } from './alien.js';

// Chapter III, inside the MSV Tethys: the ship's own machinery, and the
// things it's hiding.

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function stripes(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#b8922a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#0c0c0e';
  for (let k = -h; k < w + h; k += h * 1.4) {
    ctx.beginPath();
    ctx.moveTo(x + k, y + h);
    ctx.lineTo(x + k + h * 0.7, y);
    ctx.lineTo(x + k + h * 1.4, y);
    ctx.lineTo(x + k + h * 0.7, y + h);
    ctx.fill();
  }
  ctx.restore();
}

// ── Sliding door ─────────────────────────────────────────────
// Two leaves that part top and bottom with a pneumatic hiss when you come near.
// While shut its tiles are solid ('S'); once open it stays open.
export class Door {
  constructor(tx, floorTy, rows = 4, opts = {}) {
    this.tx = tx;
    this.ty0 = floorTy - rows;
    this.rows = rows;
    this.x = tx * TILE;
    this.y = this.ty0 * TILE;
    this.w = TILE;
    this.h = rows * TILE;
    this.open = opts.open ? 1 : 0;
    this.opening = !!opts.open;
    this.label = opts.label || '';
  }
  get cx() {
    return this.x + this.w / 2;
  }
  setTiles(level) {
    const solid = this.open < 0.7;
    for (let y = this.ty0; y < this.ty0 + this.rows; y++) level.setTile(this.tx, y, solid ? 'S' : '.');
  }
  update(dt, game) {
    const p = game.player;
    if (!this.opening && Math.abs(p.cx - this.cx) < 110 && p.feetY > this.y && p.y < this.y + this.h && p.state === 'normal') {
      this.opening = true;
      game.audio.play('doorOpen');
    }
    if (this.opening && this.open < 1) {
      const was = this.open;
      this.open = Math.min(1, this.open + dt * 2.6);
      if (was < 0.7 && this.open >= 0.7) this.setTiles(game.level);
    }
  }
  draw(ctx) {
    const { x, y, w, h } = this;
    // frame
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(x - 6, y - 8, w + 12, 8);
    stripes(ctx, x - 6, y - 8, w + 12, 6);
    ctx.fillStyle = '#2a3038';
    ctx.fillRect(x - 6, y, 6, h);
    ctx.fillRect(x + w, y, 6, h);
    const k = this.open;
    const half = h / 2;
    const slide = half * k;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (const top of [true, false]) {
      const ly = top ? y - slide : y + half + slide;
      ctx.fillStyle = '#353d46';
      ctx.fillRect(x + 2, ly, w - 4, half);
      ctx.fillStyle = '#1d2228';
      ctx.fillRect(x + 6, ly + 6, w - 12, half - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 2, ly, w - 4, 2);
      if (top) {
        // a little window
        ctx.fillStyle = 'rgba(120,170,200,0.3)';
        ctx.fillRect(x + 10, ly + half - 30, w - 20, 16);
      } else stripes(ctx, x + 2, ly, w - 4, 7);
    }
    ctx.restore();
    // status light over the door
    const lit = this.open > 0 ? 'rgb(90,255,130)' : 'rgb(255,70,50)';
    ctx.fillStyle = lit;
    ctx.fillRect(x + w / 2 - 3, y - 14, 6, 4);
  }
  light(out) {
    out.push({ x: this.cx, y: this.y - 12, r: 60, color: this.open > 0 ? 'rgb(90,255,130)' : 'rgb(255,70,50)', i: 0.5 });
  }
}

// ── Steam jet ────────────────────────────────────────────────
// A ruptured line venting scalding steam across the corridor in bursts.
export class SteamJet {
  constructor(x, y, { dir = 1, len = 140, period = 3.2, offset = 0 } = {}) {
    Object.assign(this, { px: x, py: y, dir, len, period, t: offset, dead: false, alive: true, contact: false, phase: 'off' });
    this.x = Math.min(x, x + dir * len);
    this.y = y - 18;
    this.w = len;
    this.h = 36;
  }
  get cx() {
    return this.px;
  }
  get cy() {
    return this.py;
  }
  update(dt, game) {
    this.t = (this.t + dt) % this.period;
    const u = this.t / this.period;
    const was = this.phase;
    this.phase = u < 0.5 ? 'off' : u < 0.66 ? 'warn' : 'on';
    if (this.phase === 'on' && was !== 'on' && Math.abs(game.player.cx - this.px) < 600) game.audio.play('steamJet');
    if (this.phase === 'warn' && Math.random() < 0.4) game.particles.add({ x: this.px, y: this.py, vx: this.dir * rand(40, 90), vy: rand(-20, 20), kind: 'smoke', size: 3, grow: 10, color: 'rgba(220,225,230,0.3)', life: 0.4 });
    if (this.phase === 'on') {
      for (let i = 0; i < 3; i++) game.particles.add({ x: this.px, y: this.py + rand(-4, 4), vx: this.dir * rand(500, 800), vy: rand(-60, 60), kind: 'smoke', size: rand(5, 9), grow: 40, color: 'rgba(230,235,240,0.35)', life: rand(0.25, 0.4), drag: 2 });
    }
  }
  touches(box) {
    return this.phase === 'on' && overlap(box, { x: this.x, y: this.y, w: this.w, h: this.h });
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    // the broken nozzle
    ctx.fillStyle = '#2a3038';
    ctx.fillRect(this.px - (this.dir > 0 ? 14 : 0), this.py - 7, 14, 14);
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(this.px - 2, this.py - 4, 4, 8);
    if (this.phase === 'on') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(this.px, 0, this.px + this.dir * this.len, 0);
      g.addColorStop(0, 'rgba(240,245,250,0.55)');
      g.addColorStop(1, 'rgba(240,245,250,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.px, this.py - 5);
      ctx.lineTo(this.px + this.dir * this.len, this.py - 20);
      ctx.lineTo(this.px + this.dir * this.len, this.py + 20);
      ctx.lineTo(this.px, this.py + 5);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ── Arc gate ─────────────────────────────────────────────────
// A shorted power junction: lightning jumps floor-to-ceiling on a cycle.
export class ArcGate {
  constructor(x, y0, y1, { period = 2.6, offset = 0 } = {}) {
    Object.assign(this, { px: x, y0, y1, period, t: offset, dead: false, alive: true, contact: false, phase: 'off', seed: 0 });
    this.x = x - 12;
    this.y = y0;
    this.w = 24;
    this.h = y1 - y0;
  }
  get cx() {
    return this.px;
  }
  get cy() {
    return (this.y0 + this.y1) / 2;
  }
  update(dt, game) {
    this.t = (this.t + dt) % this.period;
    const u = this.t / this.period;
    const was = this.phase;
    this.phase = u < 0.55 ? 'off' : u < 0.75 ? 'warn' : 'on';
    this.seed += dt * 30;
    const near = Math.abs(game.player.cx - this.px) < 500;
    if (this.phase === 'on' && was !== 'on' && near) {
      game.audio.play('arc');
      game.camera.shake(0.08);
    }
    if (this.phase === 'warn' && Math.random() < 0.5) {
      for (const yy of [this.y0 + 6, this.y1 - 6]) game.particles.add({ x: this.px + rand(-4, 4), y: yy, vx: rand(-120, 120), vy: rand(-120, 120), size: 1.4, color: 'rgb(170,210,255)', life: 0.18, additive: true });
    }
  }
  touches(box) {
    return this.phase === 'on' && overlap(box, this);
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    for (const [yy, s] of [[this.y0, 1], [this.y1, -1]]) {
      ctx.fillStyle = '#2a3038';
      ctx.fillRect(this.px - 10, yy - (s > 0 ? 0 : 12), 20, 12);
      stripes(ctx, this.px - 10, yy - (s > 0 ? -8 : 4), 20, 4);
      ctx.fillStyle = this.phase === 'off' ? '#3a4048' : 'rgb(170,210,255)';
      ctx.fillRect(this.px - 3, yy + (s > 0 ? 12 : -16), 6, 4);
    }
    if (this.phase !== 'on') return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(255,255,255,0.95)' : 'rgba(140,190,255,0.6)';
      ctx.lineWidth = pass ? 1.6 : 5;
      ctx.beginPath();
      ctx.moveTo(this.px, this.y0 + 14);
      const n = 9;
      for (let i = 1; i <= n; i++) {
        const y = this.y0 + 14 + ((this.y1 - this.y0 - 28) * i) / n;
        const j = Math.sin(this.seed * 1.7 + i * 2.3) * 10 + Math.sin(this.seed * 3.1 + i) * 6;
        ctx.lineTo(this.px + (i === n ? 0 : j), y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  light(out) {
    if (this.phase === 'on') out.push({ x: this.px, y: this.cy, r: 260, color: 'rgb(150,190,255)', i: 0.9 });
    else if (this.phase === 'warn') out.push({ x: this.px, y: this.cy, r: 90, color: 'rgb(150,190,255)', i: 0.3 });
  }
}

// ── The locker ───────────────────────────────────────────────
// One locker in the row has something in it. It's been waiting.
export class LockerScare {
  constructor(cx, floorY) {
    Object.assign(this, { x: cx - 14, y: floorY - 96, w: 28, h: 96, floorY, burst: false, door: null, dead: false, alive: true, contact: false });
  }
  get cx() {
    return this.x + this.w / 2;
  }
  update(dt, game) {
    const p = game.player;
    if (!this.burst && Math.abs(p.cx - this.cx) < 90 && Math.abs(p.feetY - this.floorY) < 40) {
      this.burst = true;
      this.door = { x: this.x, y: this.y, vx: (p.cx > this.cx ? 1 : -1) * 260, vy: -220, rot: 0 };
      game.audio.play('lockerBurst');
      game.camera.shake(0.5);
      game.markScare(this.key);
      const h = new Facehugger(this.cx, this.floorY);
      h.vx = (p.cx > this.cx ? 1 : -1) * 380;
      h.vy = -380;
      h.state = 'leap';
      game.enemies.push(h);
    }
    if (this.door) {
      const d = this.door;
      d.vy += 1600 * dt;
      d.x += d.vx * dt;
      d.y = Math.min(this.floorY - 6, d.y + d.vy * dt);
      if (d.y >= this.floorY - 6) d.vx = approach(d.vx, 0, 1200 * dt);
      d.rot = approach(d.rot, d.y >= this.floorY - 6 ? Math.PI / 2 : d.rot + 10 * dt, 20 * dt);
    }
  }
  touches() {
    return false;
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    const { x, y, w, h } = this;
    ctx.fillStyle = this.burst ? '#05070a' : '#2e353d';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#0d1014';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    if (!this.burst) {
      ctx.fillStyle = '#0d1014';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + 6, y + 8 + k * 4, 16, 1.5);
      ctx.fillStyle = '#424b55';
      ctx.fillRect(x + 22, y + 44, 3, 10);
    } else {
      ctx.fillStyle = 'rgba(200,190,160,0.08)';
      ctx.fillRect(x + 4, y + 10, w - 8, h - 20);
    }
    if (this.door) {
      const d = this.door;
      ctx.save();
      ctx.translate(d.x + 14, d.y + 6);
      ctx.rotate(d.rot);
      ctx.fillStyle = '#2e353d';
      ctx.fillRect(-14, -48, 28, 96);
      ctx.strokeStyle = '#0d1014';
      ctx.strokeRect(-14, -48, 28, 96);
      ctx.restore();
    }
  }
}

// ── A body, falling out of a ceiling vent ────────────────────
export class Corpse {
  constructor(x, y) {
    Object.assign(this, { x, y, vy: 0, rot: -0.4, landed: false, dead: false, alive: true, contact: false, w: 30, h: 20 });
  }
  get cx() {
    return this.x;
  }
  update(dt, game) {
    if (this.landed) return;
    this.vy = Math.min(this.vy + 1800 * dt, 1100);
    this.y += this.vy * dt;
    this.rot += dt * 2.5;
    const ty = Math.floor((this.y + 8) / TILE);
    const tx = Math.floor(this.x / TILE);
    if (game.level.isSolidAt(tx, ty)) {
      this.y = ty * TILE - 8;
      this.landed = true;
      this.rot = Math.PI / 2;
      game.audio.play('bodyDrop');
      game.camera.shake(0.35);
      game.particles.burst(this.x, this.y + 6, 14, { kind: 'smoke', color: 'rgba(120,125,130,0.5)', size: 4, grow: 20, speed: 140, angle: -Math.PI / 2, spread: Math.PI, life: 0.6, drag: 3 });
      game.particles.burst(this.x, this.y, 10, { color: 'rgb(110,10,20)', size: 2.4, speed: 200, life: 0.6, grav: 900 });
    }
  }
  touches() {
    return false;
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    // a crewman wrapped in half-set resin, one arm hanging free
    ctx.fillStyle = '#3a4250';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c1110';
    ctx.beginPath();
    ctx.ellipse(-2, 6, 10, 20, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b6987e';
    ctx.beginPath();
    ctx.arc(0, -30, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0c0e';
    ctx.fillRect(-3, -31, 2, 2);
    ctx.fillRect(1.5, -31, 2, 2);
    ctx.fillRect(-2, -27, 4, 3);
    ctx.strokeStyle = '#3a4250';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, -16);
    ctx.lineTo(16, 8);
    ctx.stroke();
    ctx.restore();
  }
}

// ── The chestburster ─────────────────────────────────────────
// Pale, wet, the length of a forearm. It doesn't fight. It runs.
export class Chestburster {
  constructor(x, y, toX) {
    Object.assign(this, { x, y, vx: 0, vy: -260, toX, t: 0, dead: false, alive: true, contact: false, w: 20, h: 10, grounded: false });
  }
  get cx() {
    return this.x;
  }
  update(dt, game) {
    this.t += dt;
    if (this.t < 0.6) {
      // it rears, shrieking, before it goes
      this.vy += 1600 * dt;
      this.y += this.vy * dt;
      const floor = Math.floor((this.y + 4) / TILE);
      if (game.level.isSolidAt(Math.floor(this.x / TILE), floor) && this.vy > 0) {
        this.y = floor * TILE - 4;
        this.vy = 0;
      }
      return;
    }
    const dir = Math.sign(this.toX - this.x) || 1;
    this.vx = approach(this.vx, dir * 520, 2400 * dt);
    this.x += this.vx * dt;
    if (Math.abs(this.toX - this.x) < 12 || this.t > 4) this.dead = true;
  }
  touches() {
    return false;
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    const dir = Math.sign(this.toX - this.x) || 1;
    const rear = this.t < 0.6;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(dir, 1);
    ctx.strokeStyle = '#d8c6b0';
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    if (rear) {
      ctx.moveTo(-14, 2);
      ctx.quadraticCurveTo(-4, 2, 0, -14);
    } else {
      const w = Math.sin(this.t * 40) * 3;
      ctx.moveTo(-18, 2 + w);
      ctx.quadraticCurveTo(-6, -w, 6, 0);
    }
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(120,20,30,0.8)';
    ctx.stroke();
    // head: eyeless, all teeth
    const hx = rear ? 0 : 8;
    const hy = rear ? -18 : -1;
    ctx.fillStyle = '#e6d6c2';
    ctx.beginPath();
    ctx.ellipse(hx, hy, 6, 4, rear ? -1 : 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (let k = 0; k < 3; k++) ctx.fillRect(hx + 2 + k * 1.6, hy + 1, 1, 2);
    ctx.restore();
  }
}

// ── Mist ─────────────────────────────────────────────────────
// A layer of cold blue vapour lying over the egg field. Things move under it.
export class Mist {
  constructor(x0, x1, floorY, h = 70) {
    Object.assign(this, { x0, x1, floorY, h, t: rand(0, 10) });
  }
  update(dt) {
    this.t += dt;
  }
  draw(ctx, view) {
    if (this.x1 < view.x0 || this.x0 > view.x1) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const y = this.floorY - this.h * (0.25 + i * 0.25);
      const g = ctx.createLinearGradient(0, y - this.h * 0.4, 0, y + this.h * 0.4);
      g.addColorStop(0, 'rgba(110,150,230,0)');
      g.addColorStop(0.5, `rgba(110,150,230,${0.12 - i * 0.03})`);
      g.addColorStop(1, 'rgba(110,150,230,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.x0, y + this.h);
      for (let x = this.x0; x <= this.x1; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.01 + this.t * (0.4 + i * 0.2)) * 10 - this.h * 0.3);
      ctx.lineTo(this.x1, y + this.h);
      ctx.fill();
    }
    ctx.restore();
  }
}

export { overlap, clamp };
