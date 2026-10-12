import { approach, clamp, rand, sign } from '../core/math.js';
import { moveBody, groundAhead, wallAhead } from '../world/body.js';
import { glow } from '../render/shapes.js';

// Chapter IV: Kagari's people, and the things from the world beneath it.

const GRAV = 1900;

// ── People ───────────────────────────────────────────────────
const LOOKS = {
  woman: { robe: '#5a2a3a', sash: '#c9a24a', hair: '#1a1214', h: 58 },
  man: { robe: '#2a3a4a', sash: '#6a4a2a', hair: '#141010', h: 62 },
  child: { robe: '#7a4a2a', sash: '#c94a3a', hair: '#1a1210', h: 40 },
  old: { robe: '#4a4436', sash: '#5a1c1c', hair: '#d8d2c6', h: 54 },
  sleeper: { robe: '#d8d2c4', sash: '#9a9488', hair: '#1a1214', h: 58 },
};

// A villager standing in the street. `pose`: 'stand' | 'walk' | 'slump' | 'lie'
export function drawPerson(ctx, cx, floorY, facing, look, opts = {}) {
  const L = LOOKS[look] || LOOKS.man;
  const h = L.h;
  const t = opts.t || 0;
  const breathe = Math.sin(t * 1.3) * 0.7;
  const walk = opts.walk || 0;
  ctx.save();
  ctx.translate(cx, floorY);
  ctx.scale(facing, 1);
  if (opts.pose === 'lie') {
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-8, 0);
  }
  const head = opts.headTilt || 0;
  const slump = opts.pose === 'slump' ? 1 : 0;
  ctx.strokeStyle = '#0a0608';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // legs under the robe
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1a1214';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 3, -h * 0.35);
    ctx.lineTo(s * 3 + Math.sin(walk + (s > 0 ? Math.PI : 0)) * 5, 0);
    ctx.stroke();
  }
  // robe
  ctx.fillStyle = L.robe;
  ctx.strokeStyle = '#0a0608';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-9, -h * 0.25);
  ctx.quadraticCurveTo(-10 + slump * 3, -h * 0.7 + breathe, -5 + slump * 6, -h * 0.8 + breathe + slump * 6);
  ctx.lineTo(6 + slump * 6, -h * 0.8 + breathe + slump * 6);
  ctx.quadraticCurveTo(10, -h * 0.6, 9, -h * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = L.sash;
  ctx.fillRect(-9, -h * 0.5, 18, 4);
  // arms
  ctx.strokeStyle = L.robe;
  ctx.lineWidth = 4.5;
  const armReach = opts.arms || 0; // 0 hanging, 1 reaching forward
  ctx.beginPath();
  ctx.moveTo(4 + slump * 5, -h * 0.74 + slump * 6);
  ctx.lineTo(8 + armReach * 12, -h * 0.5 - armReach * 12);
  ctx.stroke();
  // head
  ctx.save();
  ctx.translate(1 + slump * 7, -h * 0.84 + breathe + slump * 8);
  ctx.rotate(head);
  ctx.fillStyle = '#c69a7e';
  ctx.beginPath();
  ctx.arc(0, -6, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = L.hair;
  ctx.beginPath();
  ctx.arc(-1, -8, 6.5, Math.PI * 0.85, Math.PI * 2.05);
  ctx.fill();
  if (look === 'woman' || look === 'sleeper') {
    ctx.beginPath();
    ctx.arc(-6, -11, 3.4, 0, Math.PI * 2); // a bun
    ctx.fill();
  }
  if (opts.flayed) {
    // black veins up the neck and face, eyes gone white
    ctx.strokeStyle = 'rgba(10,6,10,0.9)';
    ctx.lineWidth = 1;
    for (const [x0, y0, x1, y1] of [[-2, 2, 1, -6], [2, 2, 4, -4], [0, 1, -3, -9]]) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + 2, (y0 + y1) / 2, x1, y1);
      ctx.stroke();
    }
    ctx.fillStyle = '#f2f0ea';
    ctx.fillRect(2, -8, 2.4, 1.6);
  } else if (opts.eyesShut) {
    ctx.fillStyle = '#2a1414';
    ctx.fillRect(2, -7, 2.6, 0.9);
  } else if (opts.stare) {
    // looking straight at you: black eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(3, -7, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#1a1010';
    ctx.fillRect(2.4, -7.5, 1.6, 1.6);
  }
  ctx.restore();
  ctx.restore();
}

export class Villager {
  constructor(cx, floorY, id, look = 'man', facing = -1) {
    Object.assign(this, { kind: 'npc', id, look, facing, x: cx - 20, y: floorY - 60, w: 40, h: 60, cx, floorY, talked: false, t: rand(0, 6) });
    this.prompt = 'Talk';
  }
  update(dt, game) {
    this.t += dt;
    this.facing = sign(game.player.cx - this.cx) || this.facing;
  }
  draw(ctx) {
    drawPerson(ctx, this.cx, this.floorY, this.facing, this.look, { t: this.t });
  }
  light(out) {}
}

// A villager walking in their sleep toward the shrine. They don't hear you.
export class Sleepwalker {
  constructor(cx, floorY, toX, delay = 0, face = 1) {
    Object.assign(this, { x: cx - 10, cx0: cx, floorY, toX, delay, face, t: rand(0, 6), walk: rand(0, 6), state: 'walk', dead: false, alive: true, contact: false, turn: 0, w: 20, h: 58 });
    this.y = floorY - this.h;
    this.look = 'sleeper';
  }
  get cx() {
    return this.x + 10;
  }
  update(dt, game) {
    this.t += dt;
    this.delay -= dt;
    if (this.state === 'walk' && this.delay <= 0) {
      const d = this.toX - this.cx;
      if (Math.abs(d) > 4) {
        this.x += sign(d) * 26 * dt;
        this.walk += dt * 3;
      } else this.state = 'stand';
    }
    if (this.turning) this.turn = Math.min(1, this.turn + dt * 3);
  }
  touches() {
    return false;
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    // standing: facing the shrine; turned: facing you
    const facing = this.turn > 0.5 ? this.turnTo || -1 : this.state === 'stand' ? this.face : sign(this.toX - this.cx) || this.face;
    const lean = Math.sin(this.t * 1.7) * 0.06;
    drawPerson(ctx, this.cx, this.floorY, facing, this.look, { t: this.t, walk: this.state === 'walk' ? this.walk : 0, headTilt: this.turn > 0.5 ? -0.05 : 0.35 + lean, eyesShut: this.turn < 0.5, stare: this.turn >= 0.5 });
  }
  light() {}
}

// The dog that won't stop barking at nothing.
export class Dog {
  constructor(cx, floorY, facing = 1) {
    Object.assign(this, { x: cx - 14, cx0: cx, floorY, facing, t: 0, barkT: 1, dead: false, alive: true, contact: false, w: 28, h: 20 });
    this.y = floorY - this.h;
  }
  get cx() {
    return this.x + 14;
  }
  update(dt, game) {
    this.t += dt;
    this.barkT -= dt;
    const near = Math.abs(game.player.cx - this.cx) < 500;
    if (this.barkT <= 0 && near) {
      this.barkT = rand(0.9, 1.6);
      this.bark = 0.25;
      game.audio.play('bark');
    }
    this.bark = Math.max(0, (this.bark || 0) - dt);
  }
  touches() {
    return false;
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    const { floorY } = this;
    const b = this.bark > 0 ? 1 : 0;
    ctx.save();
    ctx.translate(this.cx, floorY);
    ctx.scale(this.facing, 1);
    ctx.fillStyle = '#7a5a3a';
    ctx.strokeStyle = '#1a1008';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, -12, 13, 6, -0.1 * b, 0, Math.PI * 2); // body
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(13, -18 - b * 2, 6, 5, -0.2, 0, Math.PI * 2); // head
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a3e26';
    ctx.beginPath();
    ctx.moveTo(10, -22 - b * 2);
    ctx.lineTo(8, -28);
    ctx.lineTo(13, -23);
    ctx.fill(); // ear
    ctx.strokeStyle = '#5a3e26';
    ctx.lineWidth = 3;
    for (const lx of [-8, -3, 5, 9]) {
      ctx.beginPath();
      ctx.moveTo(lx, -8);
      ctx.lineTo(lx, 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-12, -14);
    ctx.quadraticCurveTo(-20, -24 + Math.sin(this.t * 14) * 3, -18, -26);
    ctx.stroke(); // tail
    if (b) {
      ctx.strokeStyle = 'rgba(240,230,220,0.6)';
      ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(22, -18, 4 + k * 4, -0.5, 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  light() {}
}

// ── Things from beneath ──────────────────────────────────────
class Creature {
  constructor(cx, feetY, w, h, hp) {
    Object.assign(this, { w, h, x: cx - w / 2, y: feetY - h, home: cx, vx: 0, vy: 0, hp, facing: -1, dead: false, dying: 0, state: 'prowl', t: 0, stun: 0, flash: 0, contact: true, grounded: false, alien: true });
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
}

// A demodog: a hairless, long-limbed hound whose head opens into a flower of teeth.
export class Demodog extends Creature {
  constructor(cx, feetY) {
    super(cx, feetY, 40, 34, 3);
    this.step = rand(0, 6);
    this.open = 0;
  }
  update(dt, game) {
    this.flash -= dt;
    const lvl = game.level;
    if (this.dying > 0) {
      this.dying -= dt;
      this.vy += GRAV * dt;
      this.vx = approach(this.vx, 0, 400 * dt);
      moveBody(this, lvl, dt);
      if (this.dying <= 0) this.dead = true;
      return;
    }
    const p = game.player;
    const dx = p.cx - this.cx;
    this.t -= dt;
    this.stun -= dt;
    if (this.stun > 0) this.vx = approach(this.vx, 0, 900 * dt);
    else
      switch (this.state) {
        case 'prowl': {
          this.vx = this.facing * 60;
          this.step += dt * 6;
          if (!groundAhead(this, lvl, this.facing, 6) || wallAhead(this, lvl, this.facing) || Math.abs(this.cx - this.home) > 180) this.facing *= -1;
          if (Math.abs(dx) < 340 && Math.abs(p.cy - this.cy) < 90) {
            this.state = 'stalk';
            game.audio.play('demodog');
          }
          break;
        }
        case 'stalk':
          this.facing = sign(dx) || this.facing;
          this.vx = groundAhead(this, lvl, this.facing, 6) ? approach(this.vx, this.facing * 170, 900 * dt) : 0;
          this.step += dt * 12;
          this.open = approach(this.open, 0.15, dt);
          if (Math.abs(dx) < 190 && this.grounded) {
            this.state = 'tell';
            this.t = 0.5;
            this.vx = 0;
            game.audio.play('demodogScreech');
          }
          if (Math.abs(dx) > 520) this.state = 'prowl';
          break;
        case 'tell':
          // the head peels open
          this.open = Math.min(1, this.open + dt * 3);
          this.vx = approach(this.vx, -this.facing * 30, 600 * dt);
          if (this.t <= 0) {
            this.state = 'lunge';
            this.vx = this.facing * 520;
            this.vy = -380;
            this.t = 0.8;
          }
          break;
        case 'lunge':
          if (this.grounded && this.vy >= 0 && this.t < 0.6) {
            this.state = 'recover';
            this.t = 0.7;
          }
          break;
        case 'recover':
          this.vx = approach(this.vx, 0, 1200 * dt);
          this.open = approach(this.open, 0, dt * 2);
          if (this.t <= 0) this.state = 'stalk';
          break;
      }
    this.vy = Math.min(this.vy + GRAV * dt, 900);
    moveBody(this, lvl, dt);
  }
  hurt(dmg, dirX, game) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    game.audio.play('demodog');
    if (this.hp <= 0) {
      this.dying = 0.5;
      this.contact = false;
      this.vx = dirX * 260;
      this.vy = -260;
      return true;
    }
    this.vx = dirX * 260;
    this.stun = 0.2;
    if (this.state === 'tell') this.state = 'recover';
    return true;
  }
  draw(ctx) {
    const { cx, feetY } = this;
    if (this.dying > 0) ctx.globalAlpha *= clamp(this.dying * 2, 0, 1);
    const flash = this.flash > 0;
    const skin = flash ? '#fff' : '#2a2226';
    const sheen = 'rgba(200,180,190,0.25)';
    const mv = Math.min(1, Math.abs(this.vx) / 150);
    const crouch = this.state === 'tell' ? 1 : 0;
    ctx.save();
    ctx.translate(cx, feetY);
    ctx.scale(this.facing, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // four long legs
    for (const [lx, ph] of [[-14, 0], [-8, Math.PI], [10, Math.PI / 2], [16, Math.PI * 1.5]]) {
      const sw = Math.sin(this.step + ph) * 6 * mv;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(lx, -20 + crouch * 6);
      ctx.lineTo(lx + 4 + sw, -10 + crouch * 2);
      ctx.lineTo(lx + sw * 1.4, 0);
      ctx.stroke();
      ctx.strokeStyle = skin;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // the body: hunched, ribby, wet
    ctx.fillStyle = skin;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-22, -18 + crouch * 6);
    ctx.quadraticCurveTo(-6, -38 + crouch * 6, 14, -26 + crouch * 6);
    ctx.quadraticCurveTo(20, -18 + crouch * 4, 12, -14 + crouch * 4);
    ctx.quadraticCurveTo(-6, -10 + crouch * 6, -22, -18 + crouch * 6);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = sheen;
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(-6 + k * 5, -22 + crouch * 6, 6, 3.6, 5.2);
      ctx.stroke();
    }
    // tail
    ctx.strokeStyle = skin;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-22, -18 + crouch * 6);
    ctx.quadraticCurveTo(-34, -24, -38, -14 + Math.sin(this.step) * 3);
    ctx.stroke();
    // the head: a closed bud that opens into five petals of teeth
    ctx.save();
    ctx.translate(18, -26 + crouch * 8);
    const o = this.open;
    for (let k = 0; k < 5; k++) {
      const a = -0.9 + (k / 4) * 1.8;
      const spread = a * (0.3 + o * 1.1);
      ctx.save();
      ctx.rotate(spread);
      ctx.fillStyle = flash ? '#fff' : '#3a2a2c';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.quadraticCurveTo(8 + o * 4, -6, 14 + o * 6, 0);
      ctx.quadraticCurveTo(8 + o * 4, 6, 0, 3);
      ctx.fill();
      ctx.stroke();
      if (o > 0.2) {
        // the inside of each petal: pink, lined with teeth
        ctx.fillStyle = `rgba(200,90,110,${o})`;
        ctx.beginPath();
        ctx.moveTo(2, -1.5);
        ctx.quadraticCurveTo(8, -3, 12 + o * 5, 0);
        ctx.quadraticCurveTo(8, 2, 2, 1);
        ctx.fill();
        ctx.fillStyle = '#f2ece0';
        for (let tt = 0; tt < 3; tt++) ctx.fillRect(4 + tt * 3, -1.2, 1, 1.8);
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  light(out) {
    if (this.open > 0.3) out.push({ x: this.cx + this.facing * 20, y: this.y + 6, r: 60, color: 'rgb(220,100,120)', i: 0.3 * this.open });
  }
}

// A villager the thing in the storm has taken. Beat it and it lets them go.
export class Flayed extends Creature {
  constructor(cx, feetY, look = 'man') {
    super(cx, feetY, 22, 56, 2);
    this.look = look;
    this.alien = false;
    this.step = rand(0, 6);
    this.freed = false;
  }
  get alive() {
    return !this.dead && !this.freed;
  }
  update(dt, game) {
    this.flash -= dt;
    const lvl = game.level;
    if (this.freed) {
      this.vx = approach(this.vx, 0, 600 * dt);
      this.vy = Math.min(this.vy + GRAV * dt, 900);
      moveBody(this, lvl, dt);
      this.fade = Math.min(1, (this.fade || 0) + dt * 2);
      return;
    }
    const p = game.player;
    const dx = p.cx - this.cx;
    this.t -= dt;
    this.stun -= dt;
    if (this.stun > 0) this.vx = approach(this.vx, 0, 900 * dt);
    else
      switch (this.state) {
        case 'prowl':
          // shuffling, swaying, until it hears you
          this.vx = this.facing * 22;
          this.step += dt * 2;
          if (!groundAhead(this, lvl, this.facing, 6) || wallAhead(this, lvl, this.facing) || Math.abs(this.cx - this.home) > 100) this.facing *= -1;
          if (Math.abs(dx) < 300 && Math.abs(p.cy - this.cy) < 80) {
            this.state = 'hunt';
            game.audio.play('flayed');
          }
          break;
        case 'hunt':
          this.facing = sign(dx) || this.facing;
          this.vx = groundAhead(this, lvl, this.facing, 6) ? approach(this.vx, this.facing * 95, 500 * dt) : 0;
          this.step += dt * 6;
          if (Math.abs(dx) < 70 && this.grounded) {
            this.state = 'tell';
            this.t = 0.45;
            this.vx = 0;
          }
          break;
        case 'tell':
          // its head snaps back and its arms come up
          if (this.t <= 0) {
            this.state = 'grab';
            this.t = 0.3;
            this.vx = this.facing * 260;
            game.audio.play('lunge');
          }
          break;
        case 'grab':
          this.vx = approach(this.vx, 0, 900 * dt);
          if (this.t <= 0) {
            this.state = 'recover';
            this.t = 0.7;
          }
          break;
        case 'recover':
          this.vx = approach(this.vx, 0, 900 * dt);
          if (this.t <= 0) this.state = 'hunt';
          break;
      }
    this.vy = Math.min(this.vy + GRAV * dt, 900);
    moveBody(this, lvl, dt);
  }
  // only the grab hurts; brushing past them doesn't
  touches(box) {
    if (this.freed || this.state !== 'grab') return false;
    const r = { x: this.cx + this.facing * 8 - 16, y: this.y + 10, w: 32, h: 30 };
    return box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y;
  }
  hurt(dmg, dirX, game) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    if (this.hp <= 0) {
      // the veins drain out of their face; they fall asleep where they stand
      this.freed = true;
      this.contact = false;
      this.vx = dirX * 120;
      game.audio.play('freed');
      game.particles.burst(this.cx, this.y + 10, 16, { kind: 'smoke', color: 'rgba(10,8,14,0.7)', size: 4, grow: 20, speed: 90, life: 0.8, drag: 2, grav: -60 });
      return true;
    }
    this.vx = dirX * 200;
    this.stun = 0.25;
    if (this.state === 'tell' || this.state === 'grab') this.state = 'recover';
    return true;
  }
  draw(ctx) {
    const flash = this.flash > 0;
    if (this.freed) {
      drawPerson(ctx, this.cx, this.feetY, this.facing, this.look, { pose: 'lie', eyesShut: true });
      return;
    }
    const tell = this.state === 'tell' || this.state === 'grab';
    if (flash) ctx.filter = 'brightness(3)';
    drawPerson(ctx, this.cx, this.feetY, this.facing, this.look, {
      t: this.step,
      walk: this.state === 'hunt' || this.state === 'prowl' ? this.step : 0,
      headTilt: tell ? -0.5 : Math.sin(this.step * 0.7) * 0.25 + 0.2,
      flayed: true,
      arms: tell ? 1 : 0.25,
      pose: 'stand',
    });
    ctx.filter = 'none';
  }
  light() {}
}

// Tendrils that whip up out of the Upside Down's ground on a cycle.
export class VineBurst {
  constructor(cx, floorY, { period = 3.2, offset = 0, width = 48 } = {}) {
    Object.assign(this, { px: cx, floorY, period, t: offset, width, dead: false, alive: true, contact: false, phase: 'idle' });
    this.x = cx - width / 2;
    this.y = floorY - 96;
    this.w = width;
    this.h = 96;
  }
  get cx() {
    return this.px;
  }
  update(dt, game) {
    this.t = (this.t + dt) % this.period;
    const u = this.t / this.period;
    const was = this.phase;
    this.phase = u < 0.5 ? 'idle' : u < 0.75 ? 'warn' : 'burst';
    const near = Math.abs(game.player.cx - this.px) < 500;
    if (this.phase === 'burst' && was !== 'burst' && near) {
      game.audio.play('vineBurst');
      game.camera.shake(0.12);
    }
    if (this.phase === 'warn' && Math.random() < 0.4) game.particles.add({ x: this.px + rand(-this.width / 2, this.width / 2), y: this.floorY - 2, vx: rand(-30, 30), vy: rand(-90, -30), kind: 'smoke', size: 2, grow: 8, color: 'rgba(120,130,140,0.5)', life: 0.4 });
    this.k = this.phase === 'burst' ? Math.min(1, (u - 0.75) / 0.05) * (1 - Math.max(0, (u - 0.93) / 0.07)) : 0;
  }
  touches(box) {
    if (this.phase !== 'burst' || this.k < 0.4) return false;
    return box.x < this.x + this.w && box.x + box.w > this.x && box.y + box.h > this.floorY - 96 * this.k;
  }
  hurt() {
    return false;
  }
  draw(ctx) {
    if (this.phase === 'warn') {
      // the ground splits
      ctx.strokeStyle = 'rgba(230,50,60,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) {
        ctx.moveTo(this.px + k * 8, this.floorY);
        ctx.lineTo(this.px + k * 10 + 4, this.floorY - 4);
      }
      ctx.stroke();
    }
    if (!this.k) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      const bx = this.px - this.width / 2 + (k + 0.5) * (this.width / 5);
      const top = this.floorY - (60 + (k % 2) * 36) * this.k;
      ctx.strokeStyle = '#0a0d12';
      ctx.lineWidth = 7 - (k % 2) * 2;
      ctx.beginPath();
      ctx.moveTo(bx, this.floorY);
      ctx.quadraticCurveTo(bx + Math.sin(this.t * 20 + k) * 10, (this.floorY + top) / 2, bx + Math.sin(k) * 6, top);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(170,190,220,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }
  light(lights) {
    // the ground glows red just before it splits: that's your tell
    if (this.phase === 'warn') lights.push({ x: this.px, y: this.floorY - 8, r: 90, color: 'rgb(220,50,60)', i: 0.7 });
    else if (this.k) lights.push({ x: this.px, y: this.floorY - 40, r: 70, color: 'rgb(160,40,50)', i: 0.35 });
  }
}

export { glow };
