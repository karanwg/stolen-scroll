import { approach, clamp, lerp, rand, sign } from '../core/math.js';
import { glow } from '../render/shapes.js';
import { drawFlayer, flayerLeg } from '../render/flayerArt.js';

// THE MIND FLAYER — the fourth name. It fills the storm over the Upside Down.
//
// Rules you can learn:
//   · It can only be hurt from the Upside Down.
//   · It can only see you in the Upside Down. Shift to the real world and it
//     strikes where it last saw you — so shift *and* move.
//   · Its swarm, its gaze and its lightning only exist in the Upside Down.
//
//   slam       [a leg rises over you; its shadow on the floor glows red]
//              it comes down, and stays down: cut the leg.
//   sweep      [a leg lowers at the edge of the floor, the ground trembles]  jump it.
//              (from phase 2 it comes back the other way: jump it twice)
//   lightning  [red sigils on the floor, one after another]  step off them.
//   swarm      (phase 2) [it swells and draws in ash]  a wall of ash rolls across:
//              shift to the real world, dash through it, or go over it.
//   gaze       (phase 2) [its body splits with red light]  a beam sweeps the floor:
//              shift to the real world and it can't find you.
//   core       (phase 3) it comes down itself — its heart is open. Cut it.
//
//   phase 1  slam · sweep · slam · lightning
//   phase 2  slam · swarm · sweep · gaze · slam · lightning
//   phase 3  slam · core · lightning · core

const HP = 30;
const PHASE2_AT = 20;
const PHASE3_AT = 8;
const PATTERN = {
  1: ['slam', 'sweep', 'slam', 'lightning'],
  2: ['slam', 'swarm', 'sweep', 'gaze', 'slam', 'lightning'],
  3: ['slam', 'core', 'lightning', 'core'],
};
const S = 1.0;
const SWEEP_T = 1.5; // the leg crosses the whole floor in this long: about 1200 px/s

export class MindFlayer {
  constructor(cx, floorY, arena) {
    this.arena = arena;
    this.floorY = floorY;
    this.bx = cx;
    this.by = floorY - 350;
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
    this.name = 'THE MIND FLAYER';
    this.title = 'The Fourth Name';
    this.layer = 'both';
    this.alpha = 0;
    this.ud = false;
    this.seenX = cx;
    this.marks = [];
    this.leg = null; // { i, x, k, planted }
    this.x = cx - 60;
    this.y = this.by - 50;
    this.w = 120;
    this.h = 100;
  }
  get cx() {
    return this.bx;
  }
  get cy() {
    return this.by;
  }
  get alive() {
    return !this.dead && this.state !== 'dying';
  }
  // only from the Upside Down, and only where it's exposed (see hitBy)
  get hurtable() {
    return this.alive && this.ud && !['dormant', 'intro', 'roar'].includes(this.state);
  }

  wake() {
    this.state = 'intro';
    this.t = 4;
  }

  setState(s, t) {
    this.state = s;
    this.t = t;
  }

  // Where it thinks you are.
  target(game) {
    return this.ud ? game.player.cx : this.seenX;
  }

  next(game, delay = 0.7) {
    const cycle = PATTERN[this.phase];
    this.queued = cycle[this.step % cycle.length];
    this.step++;
    this.setState('wait', delay * (this.phase >= 2 ? 0.8 : 1));
  }

  begin(game) {
    const c = this.queued;
    const A = this.arena;
    const tx = clamp(this.target(game), A.x0 + 40, A.x1 - 40);
    switch (c) {
      case 'slam':
        this.leg = { i: tx < this.bx ? 2 : 5, x: tx, k: 0 };
        this.setState('slamTell', this.phase >= 2 ? 0.8 : 0.95);
        game.audio.play('flayerGroan');
        break;
      case 'sweep': {
        const fromLeft = tx > (A.x0 + A.x1) / 2;
        this.leg = { i: fromLeft ? 1 : 6, x: fromLeft ? A.x0 + 10 : A.x1 - 10, dir: fromLeft ? 1 : -1, k: 0 };
        this.setState('sweepTell', 0.85);
        game.audio.play('rumble');
        game.camera.shake(0.3);
        break;
      }
      case 'lightning':
        this.marks = [];
        for (let i = 0; i < 4; i++) {
          const x = i === 0 ? tx : clamp(tx + (i % 2 ? -1 : 1) * (90 + i * 50), A.x0 + 30, A.x1 - 30);
          this.marks.push({ x, t: 0.85 + i * 0.4, hit: 0 });
        }
        this.setState('lightning', 0.85 + 4 * 0.4 + 0.3);
        game.audio.play('flayerGroan');
        break;
      case 'swarm': {
        const fromLeft = tx > (A.x0 + A.x1) / 2;
        this.swarm = { x: fromLeft ? A.x0 - 120 : A.x1 + 120, dir: fromLeft ? 1 : -1, live: false };
        this.setState('swarmTell', 1.1);
        game.audio.play('swarm');
        break;
      }
      case 'gaze': {
        const fromLeft = Math.random() < 0.5;
        this.gaze = { x: fromLeft ? A.x0 : A.x1, dir: fromLeft ? 1 : -1, live: false };
        this.setState('gazeTell', 1.1);
        game.audio.play('flayerGroan');
        break;
      }
      case 'core':
        this.setState('descend', 1.2);
        game.audio.play('flayerRoar');
        break;
    }
  }

  hurt(dmg, dirX, game) {
    if (!this.hurtable) return false;
    this.hp -= dmg;
    this.flash = 0.12;
    game.particles.burst(this.hitAt?.[0] ?? this.bx, this.hitAt?.[1] ?? this.by, 12, { color: 'rgb(255,90,70)', size: 2.5, speed: 240, life: 0.5, additive: true });
    game.audio.play('flayerHurt');
    if (this.hp <= 0) {
      this.hp = 0;
      this.setState('dying', 4.5);
      this.marks = [];
      this.swarm = null;
      this.gaze = null;
      game.onBossDefeated(this);
      return true;
    }
    if (this.phase === 1 && this.hp <= PHASE2_AT) this.enrage(game, 2);
    else if (this.phase === 2 && this.hp <= PHASE3_AT) this.enrage(game, 3);
    return true;
  }

  enrage(game, phase) {
    this.phase = phase;
    this.step = 0;
    this.leg = null;
    this.marks = [];
    this.swarm = null;
    this.gaze = null;
    this.setState('roar', 2);
    game.audio.play('flayerRoar');
    game.camera.shake(1);
    game.weather?.strike(undefined, 1);
  }

  update(dt, game) {
    this.time += dt;
    this.t -= dt;
    this.flash = Math.max(0, this.flash - dt);
    this.ud = game.level.layer === 'ud';
    const p = game.player;
    const A = this.arena;
    if (this.ud) this.seenX = p.cx;
    // the body drifts over the arena, following what it can see
    const want = clamp(this.target(game), A.x0 + 200, A.x1 - 200);
    this.bx = approach(this.bx, want, (this.state === 'core' ? 0 : 50) * dt);
    const baseY = this.floorY - (this.state === 'core' || this.state === 'descend' || this.state === 'rise' ? 250 : 350);
    this.by = approach(this.by, baseY + Math.sin(this.time * 0.6) * 12, (this.state === 'descend' ? 260 : 180) * dt);
    this.alpha = approach(this.alpha, 1, dt * 0.6);

    switch (this.state) {
      case 'intro':
        if (!this.roared && this.t < 2.6) {
          this.roared = true;
          game.audio.play('flayerRoar');
          game.camera.shake(1.1);
          game.weather?.strike(undefined, 1);
        }
        if (this.t <= 0) this.next(game, 0.6);
        break;
      case 'wait':
        if (this.t <= 0) this.begin(game);
        break;
      case 'slamTell':
        // the leg rises over the target and hangs there
        this.leg.k = Math.min(1, this.leg.k + dt * 2);
        if (this.t <= 0) {
          this.setState('slam', 0.12);
          game.audio.play('lunge');
        }
        break;
      case 'slam':
        if (this.t <= 0) {
          this.leg.planted = true;
          this.leg.impact = 0.12;
          game.camera.shake(0.7);
          game.audio.play('slam');
          game.particles.burst(this.leg.x, this.floorY, 22, { kind: 'smoke', color: 'rgba(30,36,46,0.7)', size: 7, grow: 30, speed: 260, angle: -Math.PI / 2, spread: Math.PI, life: 0.6, drag: 3 });
          this.setState('planted', 1.7 * (this.phase >= 2 ? 0.85 : 1));
        }
        break;
      case 'planted':
        // its opening: the leg is stuck in the floor
        if (this.t <= 0) {
          this.leg = null;
          this.next(game);
        }
        break;
      case 'sweepTell':
        this.leg.k = Math.min(1, this.leg.k + dt * 2);
        if (Math.random() < 0.4) game.particles.add({ x: this.leg.x + rand(-20, 20), y: this.floorY - 2, vx: rand(-40, 40), vy: rand(-80, -20), kind: 'smoke', size: 3, grow: 12, color: 'rgba(60,70,80,0.5)', life: 0.5 });
        if (this.t <= 0) {
          this.setState('sweep', SWEEP_T);
          game.audio.play('tailWhoosh');
        }
        break;
      case 'sweep':
        this.leg.x += this.leg.dir * ((A.x1 - A.x0) / SWEEP_T) * dt;
        if (this.t <= 0) {
          if (this.phase >= 2 && !this.leg.back) {
            // and back again — jump it twice
            this.leg.back = true;
            this.leg.dir = -this.leg.dir;
            this.setState('sweep', SWEEP_T);
            game.audio.play('tailWhoosh');
            break;
          }
          this.leg = null;
          this.next(game);
        }
        break;
      case 'lightning':
        for (const m of this.marks) {
          m.t -= dt;
          if (m.t <= 0 && !m.fired) {
            m.fired = true;
            m.hit = 0.15;
            if (this.ud) {
              game.audio.play('thunder', 0);
              game.camera.shake(0.35);
              game.weather?.strike(undefined, 0.6);
            }
          }
          if (m.fired) m.hit -= dt;
        }
        if (this.t <= 0) {
          this.marks = [];
          this.next(game, 0.5);
        }
        break;
      case 'swarmTell':
        if (this.t <= 0) {
          this.swarm.live = true;
          this.setState('swarm', 4);
        }
        break;
      case 'swarm':
        this.swarm.x += this.swarm.dir * 720 * dt;
        if (this.ud && Math.random() < 0.9) game.particles.add({ x: this.swarm.x + rand(-60, 60), y: this.floorY - rand(10, 120), vx: this.swarm.dir * rand(600, 850), vy: rand(-40, 40), kind: 'smoke', size: rand(4, 9), grow: 20, color: 'rgba(20,24,30,0.7)', life: 0.5 });
        if ((this.swarm.dir > 0 && this.swarm.x > A.x1 + 150) || (this.swarm.dir < 0 && this.swarm.x < A.x0 - 150)) {
          this.swarm = null;
          this.next(game);
        }
        break;
      case 'gazeTell':
        if (this.t <= 0) {
          this.gaze.live = true;
          this.setState('gaze', 1.6);
          game.audio.play('gaze');
        }
        break;
      case 'gaze':
        this.gaze.x += this.gaze.dir * ((A.x1 - A.x0) / 1.6) * dt;
        if (this.t <= 0) {
          this.gaze = null;
          this.next(game);
        }
        break;
      case 'descend':
        if (this.t <= 0) this.setState('core', 2.6);
        break;
      case 'core':
        if (this.t <= 0) this.setState('rise', 0.8);
        break;
      case 'rise':
        if (this.t <= 0) this.next(game);
        break;
      case 'roar':
        if (this.t <= 0) this.next(game, 0.5);
        break;
      case 'dying':
        this.alpha = Math.max(0, this.t / 4.5);
        if (Math.random() < 0.6) game.particles.add({ x: this.bx + rand(-120, 120), y: this.by + rand(-60, 200), vx: rand(-40, 40), vy: rand(-160, -60), kind: 'smoke', size: rand(8, 16), grow: 40, color: 'rgba(10,12,18,0.6)', life: 1.4 });
        if (this.t <= 0) this.dead = true;
        break;
    }
    if (this.leg?.impact > 0) this.leg.impact -= dt;
    this.x = this.bx - 60;
    this.y = this.by - 50;
  }

  // Where the active leg's tip is, in world space.
  legTip() {
    const L = this.leg;
    if (!L) return null;
    if (this.state === 'slamTell') return [L.x, this.floorY - 200 - L.k * 60];
    if (this.state === 'slam') return [L.x, lerp(this.floorY - 260, this.floorY, 1 - this.t / 0.12)];
    if (this.state === 'sweepTell') return [L.x, this.floorY - 120 + L.k * 96];
    return [L.x, this.floorY - (this.state === 'sweep' ? 24 : 0)];
  }

  // ── Damage to you ──────────────────────────────────────────
  hurtsPlayer(box) {
    if (!this.alive) return false;
    const ov = (r) => box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y;
    const tip = this.legTip();
    if (this.leg?.impact > 0 && tip && ov({ x: tip[0] - 46, y: this.floorY - 70, w: 92, h: 70 })) return true;
    if (this.state === 'slam' && tip && ov({ x: tip[0] - 24, y: tip[1] - 60, w: 48, h: 60 })) return true;
    if (this.state === 'sweep' && tip && ov({ x: tip[0] - 26, y: this.floorY - 40, w: 52, h: 40 })) return true;
    if (!this.ud) return false; // the rest only exists in the Upside Down
    for (const m of this.marks) if (m.fired && m.hit > 0 && ov({ x: m.x - 22, y: this.floorY - 400, w: 44, h: 400 })) return true;
    if (this.swarm?.live && ov({ x: this.swarm.x - 70, y: this.floorY - 120, w: 140, h: 120 })) return true;
    if (this.gaze?.live && ov({ x: this.gaze.x - 22, y: this.floorY - 300, w: 44, h: 300 })) return true;
    return false;
  }

  // Where your sword can reach it: a planted leg, or its open heart.
  hitBy(box) {
    if (!this.hurtable) return false;
    const ov = (x, y, r) => x > box.x - r && x < box.x + box.w + r && y > box.y - r && y < box.y + box.h + r;
    if (this.state === 'planted' && this.leg) {
      for (let k = 0; k < 5; k++) {
        const y = this.floorY - 10 - k * 30;
        if (ov(this.leg.x - k * 4 * sign(this.leg.x - this.bx), y, 18)) {
          this.hitAt = [this.leg.x, y];
          return true;
        }
      }
    }
    if (this.state === 'core' && ov(this.bx, this.by + 20, 60)) {
      this.hitAt = [this.bx, this.by + 20];
      return true;
    }
    return false;
  }

  hitboxes() {
    return [];
  }

  // ── Drawing ────────────────────────────────────────────────
  legOverrides() {
    // idle legs hang and sway; the active one goes where the attack needs it
    const legs = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const spread = 150 + (i % 4) * 70;
      legs.push({ tip: [side * spread + Math.sin(this.time * 0.6 + i) * 20, 240 + (i % 3) * 30 + Math.sin(this.time * 0.8 + i * 2) * 14] });
    }
    const tip = this.legTip();
    if (tip && this.leg) legs[this.leg.i] = { tip: [(tip[0] - this.bx) / S, (tip[1] - this.by) / S] };
    if (this.state === 'core' || this.state === 'descend') for (let i = 0; i < 8; i++) legs[i].tip[1] = Math.min(legs[i].tip[1], this.floorY - this.by - 10);
    return legs;
  }

  draw(ctx, game) {
    if (this.dead) return;
    const A = this.arena;
    const ud = this.ud;
    // floor telegraphs
    const mark = (x, k, col) => {
      ctx.fillStyle = `rgba(0,0,0,${0.3 + k * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(x, this.floorY - 2, 26 + k * 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    if (this.state === 'slamTell' && this.leg) mark(this.leg.x, this.leg.k, `rgba(255,60,50,${0.3 + this.leg.k * 0.6})`);
    if (ud)
      for (const m of this.marks) {
        if (m.fired) continue;
        const k = clamp(1 - m.t / 0.85, 0, 1);
        // a sigil burning into the floor
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,70,50,${0.3 + k * 0.6})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(m.x, this.floorY - 3, 20, 5, 0, 0, Math.PI * 2);
        ctx.moveTo(m.x - 14, this.floorY - 3);
        ctx.lineTo(m.x + 14, this.floorY - 3);
        ctx.stroke();
        ctx.restore();
      }
    // the storm behind it glows, so its shape stands out against the sky
    const a = this.alpha * (ud ? 1 : 0.28);
    glow(ctx, this.bx, this.by + 40, 420, 'rgb(150,40,50)', (ud ? 0.55 : 0.2) * this.alpha);
    // the creature itself: veiled when you're on the other side
    ctx.save();
    drawFlayer(ctx, this.bx, this.by, S, this.time, {
      alpha: a,
      glow: this.flash > 0 ? 1 : this.state === 'gazeTell' || this.state === 'gaze' ? 0.9 : this.state === 'core' ? 1 : this.state === 'roar' ? 0.8 : 0.15,
      legs: this.legOverrides(),
      colour: this.flash > 0 ? '#3a1018' : '#04060b',
    });
    ctx.restore();
    if (!ud) return;
    // its swarm: a rolling wall of ash
    if (this.swarm?.live) {
      const g = ctx.createLinearGradient(this.swarm.x - 90, 0, this.swarm.x + 90, 0);
      g.addColorStop(0, 'rgba(14,18,24,0)');
      g.addColorStop(0.5, 'rgba(14,18,24,0.85)');
      g.addColorStop(1, 'rgba(14,18,24,0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.swarm.x - 90, this.floorY - 130, 180, 130);
    } else if (this.state === 'swarmTell' && this.swarm) {
      const k = 1 - this.t / 1.1;
      ctx.fillStyle = `rgba(14,18,24,${0.5 * k})`;
      ctx.fillRect(this.swarm.dir > 0 ? A.x0 : A.x1 - 80, this.floorY - 130, 80, 130);
    }
  }

  drawOver(ctx) {
    if (this.dead || !this.ud) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // lightning bolts
    for (const m of this.marks) {
      if (!m.fired || m.hit <= -0.1) continue;
      const k = clamp(m.hit / 0.15 + 0.4, 0, 1);
      ctx.strokeStyle = `rgba(255,90,70,${k})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      let x = m.x;
      ctx.moveTo(x, this.floorY - 520);
      for (let y = this.floorY - 520; y < this.floorY; y += 40) {
        x = m.x + Math.sin(y * 0.13 + m.x) * 12;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(m.x, this.floorY);
      ctx.stroke();
      glow(ctx, m.x, this.floorY - 10, 60, 'rgb(255,80,60)', k * 0.7);
    }
    // its gaze: a column of red light raking across the floor
    if (this.gaze?.live) {
      const g = ctx.createLinearGradient(0, this.by, 0, this.floorY);
      g.addColorStop(0, 'rgba(255,40,30,0.05)');
      g.addColorStop(1, 'rgba(255,60,50,0.55)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(this.bx - 10, this.by);
      ctx.lineTo(this.bx + 10, this.by);
      ctx.lineTo(this.gaze.x + 26, this.floorY);
      ctx.lineTo(this.gaze.x - 26, this.floorY);
      ctx.fill();
    } else if (this.state === 'gazeTell' && this.gaze) {
      glow(ctx, this.bx, this.by, 80 + (1 - this.t / 1.1) * 60, 'rgb(255,50,40)', 0.6);
    }
    if (this.state === 'core') glow(ctx, this.bx, this.by + 20, 70, 'rgb(255,90,60)', 0.7 + Math.sin(this.time * 10) * 0.2);
    ctx.restore();
  }

  light(out) {
    if (this.dead) return;
    if (this.ud) out.push({ x: this.bx, y: this.by, r: 460, color: 'rgb(200,60,60)', i: (this.state === 'core' || this.state === 'gaze' ? 0.7 : 0.45) * this.alpha });
    for (const m of this.marks) if (this.ud && m.fired && m.hit > -0.1) out.push({ x: m.x, y: this.floorY - 100, r: 260, color: 'rgb(255,80,60)', i: 0.8 });
  }
}

export { flayerLeg };
