import { approach, clamp, rand, sign } from '../core/math.js';
import { moveBody } from '../world/body.js';
import { NinjaRig, POSES, STYLES, runPose } from '../render/ninjaRig.js';
import { glow } from '../render/shapes.js';
import { Kunai } from './projectiles.js';

// THE MASTER — leader of the Binoshi, read the fourth name, and was read back.
// Black veins under the mask; the thing in the storm moves him now.
//
// He fights on a fixed cycle, every move with its tell and its opening:
//   dash    [drops low, the blade glints]   a cut across the courtyard — jump it
//           or get behind him. Opening: he skids to a stop, back to you.
//   kunai   [arm drawn back]                three kunai in a fan — slash them down
//           or step between. Opening: short.
//   shift   [he tears out of the world]     a ripple in the air behind you — he
//           comes out of it cutting. Move away from the ripple. Opening: long.
//   dive    [leaps, hangs in the air, a mark on the ground]  drops onto the mark.
//           Step off it. Opening: he's on one knee.
//   phase 1   dash · kunai · shift · dive
//   phase 2   shift · dash · kunai · shift · dive      (from half health, quicker)
// He goes wherever you go: shifting worlds doesn't lose him.

const HP = 30;
const SCALE = 1.3;
const GRAV = 2000;
const PATTERN = { 1: ['dash', 'kunai', 'shift', 'dive'], 2: ['shift', 'dash', 'kunai', 'shift', 'dive'] };
const TELL = { dash: 0.6, kunai: 0.55, shift: 0.55, dive: 0.45 };
const REST = { dash: 0.95, kunai: 0.6, shift: 1.15, dive: 1.1 };

export class Master {
  constructor(cx, floorY, arena) {
    this.arena = arena;
    this.w = 30;
    this.h = 62;
    this.x = cx - this.w / 2;
    this.y = floorY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;
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
    this.name = 'THE MASTER';
    this.title = 'Leader of the Binoshi';
    this.layer = 'both';
    this.alpha = 1;
    this.rig = new NinjaRig(STYLES.binoshi);
    this.run = 0;
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
    return !this.dead && this.state !== 'dying';
  }
  get hurtable() {
    return this.alive && !['dormant', 'intro', 'gone', 'ripple', 'roar'].includes(this.state);
  }
  get quick() {
    return this.phase >= 2 ? 0.85 : 1;
  }

  wake() {
    this.state = 'intro';
    this.t = 3.2;
  }

  setState(s, t) {
    this.state = s;
    this.t = t;
  }

  hurt(dmg, dirX, game) {
    if (!this.hurtable) return false;
    this.hp -= dmg;
    this.flash = 0.1;
    this.rig.flash = 0.1;
    game.particles.burst(this.cx, this.cy, 8, { kind: 'smoke', color: 'rgba(10,6,14,0.7)', size: 3, grow: 14, speed: 120, life: 0.5, drag: 2 });
    if (this.hp <= 0) {
      this.hp = 0;
      this.setState('dying', 2.6);
      this.vx = dirX * 200;
      game.onBossDefeated(this);
      return true;
    }
    if (this.phase === 1 && this.hp <= HP / 2) {
      this.phase = 2;
      this.step = 0;
      this.setState('roar', 1.2);
      game.audio.play('masterRage');
      game.camera.shake(0.5);
    }
    return true;
  }

  next(game) {
    const cycle = PATTERN[this.phase];
    this.queued = cycle[this.step % cycle.length];
    this.step++;
    this.setState('approach', this.phase >= 2 ? 0.5 : 0.75);
  }

  begin(game) {
    const c = this.queued;
    this.setState(c + 'Tell', TELL[c] * this.quick);
    if (c === 'dash') game.audio.play('tell');
    if (c === 'shift') game.audio.play('shiftOut');
    if (c === 'dive') game.audio.play('jump');
  }

  rest(kind) {
    this.setState('recover', REST[kind] * this.quick);
  }

  update(dt, game) {
    this.time += dt;
    this.t -= dt;
    this.flash = Math.max(0, this.flash - dt);
    const p = game.player;
    const A = this.arena;
    const dx = p.cx - this.cx;
    const toP = sign(dx) || this.facing;
    let gravityOn = true;

    switch (this.state) {
      case 'dormant':
        this.facing = 1; // his back to you, facing the pagoda
        break;
      case 'intro': {
        const k = 1 - this.t / 3.2;
        if (k > 0.4) this.facing = toP;
        if (!this.spoke && k > 0.45) {
          this.spoke = true;
          game.audio.play('masterRage');
          game.camera.shake(0.4);
        }
        if (this.t <= 0) this.next(game);
        break;
      }
      case 'approach': {
        this.facing = toP;
        const want = Math.abs(dx) > 260 ? toP : Math.abs(dx) < 140 ? -toP : 0;
        this.vx = approach(this.vx, want * 200, 1200 * dt);
        this.run += (Math.abs(this.vx) * dt) / 11;
        if (this.t <= 0) this.begin(game);
        break;
      }
      case 'dashTell':
        this.vx = approach(this.vx, 0, 2000 * dt);
        this.facing = toP;
        if (this.t <= 0) {
          this.dashTo = clamp(p.cx + toP * 140, A.x0 + 40, A.x1 - 40);
          this.setState('dash', 0.32);
          game.audio.play('lunge');
        }
        break;
      case 'dash':
        this.vx = sign(this.dashTo - this.cx) * 980;
        if (Math.abs(this.dashTo - this.cx) < 20 || this.t <= 0) {
          this.vx = 0;
          this.rest('dash');
        }
        if (Math.random() < 0.9) game.particles.add({ x: this.cx - this.facing * 12, y: this.feetY - rand(6, 50), vx: -this.facing * 80, vy: 0, size: 1.6, kind: 'streak', color: 'rgba(180,140,255,0.8)', life: 0.22, additive: true });
        break;
      case 'kunaiTell':
        this.vx = approach(this.vx, 0, 2000 * dt);
        this.facing = toP;
        if (this.t <= 0) {
          const hx = this.cx + this.facing * 20;
          const hy = this.y + 20;
          const base = Math.atan2(p.cy - hy, p.cx - hx);
          for (const off of [-0.22, 0, 0.22]) game.projectiles.push(new Kunai(hx, hy, Math.cos(base + off) * 560, Math.sin(base + off) * 560));
          game.audio.play('kunai');
          this.setState('kunaiThrow', 0.2);
        }
        break;
      case 'kunaiThrow':
        if (this.t <= 0) this.rest('kunai');
        break;
      case 'shiftTell':
        // he tears out of the world
        this.vx = 0;
        this.alpha = Math.max(0, this.t / (TELL.shift * this.quick));
        if (this.t <= 0) {
          this.alpha = 0;
          this.setState('gone', 0.45);
        }
        break;
      case 'gone':
        gravityOn = false;
        if (this.t <= 0) {
          // he'll come out behind you
          const side = -(p.facing || 1);
          this.rippleX = clamp(p.cx + side * 95, A.x0 + 30, A.x1 - 30);
          this.setState('ripple', 0.6 * this.quick);
          game.audio.play('shiftIn');
        }
        break;
      case 'ripple':
        gravityOn = false;
        if (this.t <= 0) {
          this.x = this.rippleX - this.w / 2;
          this.y = A.floorY - this.h;
          this.facing = sign(p.cx - this.rippleX) || 1;
          this.alpha = 1;
          this.setState('ambush', 0.22);
          game.audio.play('lunge');
          game.particles.burst(this.cx, this.cy, 18, { kind: 'shard', color: 'rgba(160,200,230,0.9)', size: 3, speed: 260, life: 0.5, vrot: 8 });
        }
        break;
      case 'ambush':
        this.vx = this.facing * 300;
        if (this.t <= 0) {
          this.vx = 0;
          this.rest('shift');
        }
        break;
      case 'diveTell':
        this.vx = approach(this.vx, 0, 2000 * dt);
        if (this.t <= 0) {
          this.vy = -1050;
          this.vx = (p.cx - this.cx) * 0.9;
          this.setState('diveRise', 0.5);
        }
        break;
      case 'diveRise':
        if (this.vy >= 0 || this.t <= 0) {
          this.diveX = clamp(p.cx, A.x0 + 30, A.x1 - 30);
          this.setState('diveHang', 0.4 * this.quick);
          game.audio.play('hiss');
        }
        break;
      case 'diveHang':
        gravityOn = false;
        this.vx = 0;
        this.vy = 0;
        if (this.t <= 0) {
          const dy = A.floorY - this.feetY;
          const tt = 0.22;
          this.vx = (this.diveX - this.cx) / tt;
          this.vy = dy / tt;
          this.setState('dive', 0.6);
        }
        break;
      case 'dive':
        gravityOn = false;
        if (this.grounded || this.feetY >= A.floorY - 1) {
          this.y = A.floorY - this.h;
          this.vx = 0;
          this.vy = 0;
          this.diveX = null;
          game.camera.shake(0.4);
          game.audio.play('slam');
          game.particles.burst(this.cx, this.feetY, 16, { kind: 'smoke', color: 'rgba(90,70,110,0.6)', size: 5, grow: 20, speed: 200, angle: -Math.PI / 2, spread: Math.PI, life: 0.5, drag: 3 });
          this.wave = 0.12;
          this.rest('dive');
        }
        break;
      case 'roar':
        this.vx = 0;
        if (this.t <= 0) this.next(game);
        break;
      case 'recover':
        this.vx = approach(this.vx, 0, 1800 * dt);
        if (this.t <= 0) this.next(game);
        break;
      case 'dying':
        this.vx = approach(this.vx, 0, 400 * dt);
        if (this.t <= 0) this.dead = true;
        break;
    }
    this.wave = Math.max(0, (this.wave || 0) - dt);
    if (gravityOn) this.vy = Math.min(this.vy + GRAV * dt, 1300);
    if (this.state === 'dive' || this.state === 'ripple' || this.state === 'gone' || this.state === 'diveHang') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else moveBody(this, game.level, dt, { oneWay: false });
    this.x = clamp(this.x, A.x0 + 2, A.x1 - this.w - 2);
    if (this.y + this.h > A.floorY) {
      this.y = A.floorY - this.h;
      this.grounded = true;
    }
    this.animate(dt);
  }

  animate(dt) {
    const s = this.state;
    let pose;
    let rate = 18;
    if (s === 'dying') {
      pose = POSES.kneel;
      rate = 6;
    } else if (s === 'dashTell') pose = { ...POSES.crouch, sword: 1, armF: [-0.6, 0.4] };
    else if (s === 'dash') {
      pose = { ...POSES.dash, sword: 1, armF: [1.55, 0], lean: 0.8 };
      rate = 40;
    } else if (s === 'kunaiTell') pose = { ...POSES.idle, armF: [-2.6, 0.3], lean: -0.1 };
    else if (s === 'kunaiThrow') pose = { ...POSES.idle, armF: [1.4, 0], lean: 0.2 };
    else if (s === 'ambush') pose = { ...POSES.dash, sword: 1, armF: [1.55, 0], lean: 0.6 };
    else if (s === 'diveHang' || s === 'diveRise') pose = { ...POSES.tuck, sword: 1 };
    else if (s === 'dive') pose = { ...POSES.fall, sword: 1, armF: [2.6, 0.3], lean: 0.4 };
    else if (s === 'recover') pose = { ...POSES.kneel, sword: 1 };
    else if (s === 'roar' || s === 'intro') pose = { ...POSES.idle, sword: 1, armF: [-2.4, 0.4], armB: [-2.6, 0.2], lean: -0.15 };
    else if (Math.abs(this.vx) > 20) {
      pose = runPose(this.run, Math.min(1, Math.abs(this.vx) / 200));
      rate = 26;
    } else pose = { ...POSES.idle, sword: 1, drop: Math.sin(this.time * 2) * 0.6 };
    this.rig.set(pose, rate);
    this.rig.update(dt, this.cx, this.feetY, this.facing, this.vx, this.vy);
  }

  // Only his cuts and his landing hurt — not brushing past him.
  hurtsPlayer(box) {
    const ov = (r) => box.x < r.x + r.w && box.x + box.w > r.x && box.y < r.y + r.h && box.y + box.h > r.y;
    if (this.state === 'dash' || this.state === 'ambush') {
      const reach = 44;
      return ov({ x: this.facing > 0 ? this.cx - 10 : this.cx - reach, y: this.y + 6, w: reach + 10, h: this.h - 10 });
    }
    if (this.state === 'dive') return ov({ x: this.x, y: this.y, w: this.w, h: this.h });
    if (this.wave > 0) return ov({ x: this.cx - 70, y: this.feetY - 18, w: 140, h: 18 });
    return false;
  }

  hitBy(box) {
    if (!this.hurtable) return false;
    return box.x < this.x + this.w + 6 && box.x + box.w > this.x - 6 && box.y < this.y + this.h && box.y + box.h > this.y;
  }

  hitboxes() {
    return [];
  }

  draw(ctx) {
    if (this.dead) return;
    const A = this.arena;
    // the mark where the dive will land
    if ((this.state === 'diveHang' || this.state === 'dive') && this.diveX != null) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.ellipse(this.diveX, A.floorY - 2, 30, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,120,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // the ripple he'll come out of
    if (this.state === 'ripple') {
      const k = 1 - this.t / (0.6 * this.quick);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = `rgba(170,140,255,${0.25 + k * 0.5})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(this.rippleX, A.floorY - 34, 8 + i * 8 + k * 10, 26 + i * 6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (this.state === 'gone' || this.state === 'ripple') return;
    ctx.save();
    ctx.globalAlpha = this.state === 'dying' ? clamp(this.t / 2, 0.2, 1) : this.alpha;
    ctx.translate(this.cx, this.feetY);
    ctx.scale(SCALE, SCALE);
    ctx.translate(-this.cx, -this.feetY);
    this.rig.draw(ctx, this.cx, this.feetY, this.facing);
    ctx.restore();
    // the glint before the dash
    if (this.state === 'dashTell') {
      const [hx, hy] = this.rig.tip('armF', this.cx, this.feetY, this.facing);
      const k = 1 - this.t / (TELL.dash * this.quick);
      glow(ctx, hx, hy, 24 + k * 22, 'rgb(220,190,255)', 0.5 + k * 0.5);
    }
  }

  // His veins glow through the dark.
  drawOver(ctx) {
    if (this.dead || this.state === 'gone' || this.state === 'ripple') return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, this.cx, this.y + 10, 22, 'rgb(170,90,255)', 0.35 * this.alpha);
    ctx.restore();
  }

  light(out) {
    if (this.dead || this.state === 'gone') return;
    out.push({ x: this.cx, y: this.y + 10, r: 90, color: 'rgb(170,110,255)', i: 0.5 * this.alpha });
  }
}
