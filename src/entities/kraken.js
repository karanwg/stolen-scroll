import { approach, clamp, lerp, rand, pick, sign } from '../core/math.js';
import { glow } from '../render/shapes.js';
import { Tentacle } from './sea.js';
import { InkBall, LightningStrike } from './seaProjectiles.js';

// KRAKEN — the Tide that Swallowed Ama.
// Fought from floating steps over a maelstrom (rough water: no water-walking).
//
// Attacks (tells in brackets):
//   slam   — [bubbles under a step] an arm rears and slams across the steps,
//            smashing them under. It stays stuck for a moment: CUT IT.
//   skim   — [a line of foam racing in from the edge] an arm skims flat along
//            the water: jump it.
//   ink    — the head surfaces beside you and spits ink. Its EYE is exposed:
//            slashes there do double damage.
//   double — phase 2: two slams at once, from both sides.
//   storm  — phase 2: [pale column] lightning strikes where you stand.

const HP = 48;

export class Kraken {
  constructor(arena, steps) {
    this.arena = arena; // {x0, x1, surfaceY}
    this.steps = steps; // FloatPlatforms it can smash
    this.isBoss = true;
    this.name = 'KRAKEN';
    this.title = 'The Tide that Swallowed Ama';
    this.hp = HP;
    this.maxHp = HP;
    this.state = 'dormant';
    this.t = 0;
    this.time = 0;
    this.phase2 = false;
    this.dead = false;
    this.flash = 0;
    this.headX = (arena.x0 + arena.x1) / 2;
    this.headRise = 0; // 0 submerged … 1 fully surfaced
    this.eyeOpen = 0;
    this.arms = [];
    this.lastAttack = '';
    this.inkLeft = 0;
    this.cx = this.headX;
    this.x = this.headX - 100;
    this.y = arena.surfaceY - 200;
    this.w = 200;
    this.h = 200;
    this.contact = false;
    const self = this;
    // The eye, as a hittable part.
    this.eye = {
      get alive() {
        return self.alive;
      },
      get cx() {
        return self.headX;
      },
      get cy() {
        return self.eyeY;
      },
      hitBy(box) {
        if (self.headRise < 0.8 || self.state === 'dying') return false;
        const ex = self.headX - 46;
        const ey = self.eyeY - 34;
        return box.x < ex + 92 && box.x + box.w > ex && box.y < ey + 68 && box.y + box.h > ey;
      },
      hurt(dmg, dirX, game) {
        self.damage(2, game);
        self.eyeFlinch = 0.25;
        return true;
      },
    };
  }

  get alive() {
    return !this.dead && this.state !== 'dying';
  }
  get surfaceY() {
    return this.arena.surfaceY;
  }
  get eyeY() {
    return this.surfaceY + lerp(170, -58, this.headRise);
  }

  // Parts the sword can hit this frame.
  get parts() {
    return [...this.arms.filter((a) => a.hurtable), this.eye];
  }

  wake() {
    this.state = 'intro';
    this.t = 3.4;
    this.headX = (this.arena.x0 + this.arena.x1) / 2 + 120;
  }

  damage(n, game) {
    if (!this.alive || this.state === 'intro') return;
    this.hp -= n;
    this.flash = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'dying';
      this.t = 3.6;
      for (const a of this.arms) {
        a.state = 'rear';
        a.t = 99;
      }
      game.onBossDefeated(this);
      return;
    }
    if (!this.phase2 && this.hp <= HP / 2) {
      this.phase2 = true;
      this.state = 'roar';
      this.t = 2.0;
      game.audio.play('krakenRoar');
      game.camera.shake(0.9);
      game.weather?.strike(undefined, 1);
    }
  }

  newArm(baseX, opts = {}) {
    const arm = new Tentacle(baseX, this.surfaceY, { length: 300, thick: 30, auto: false, color: '#742650', ...opts });
    arm.onStuck = (a, game) => this.onArmStuck(a, game);
    arm.onHurt = (game) => this.damage(1, game);
    this.arms.push(arm);
    return arm;
  }

  onArmStuck(arm, game) {
    for (const s of this.steps) {
      if (arm.points().some(([x, y]) => x > s.x - 10 && x < s.x + s.w + 10 && Math.abs(y - s.y) < 50)) s.smash(1.5);
    }
  }

  // A base position for an arm near x that isn't directly under a step.
  armBaseNear(x, side) {
    const bx = clamp(x + side * rand(110, 170), this.arena.x0 + 60, this.arena.x1 - 60);
    return bx;
  }

  update(dt, game) {
    this.time += dt;
    this.t -= dt;
    this.flash = Math.max(0, this.flash - dt);
    this.eyeFlinch = Math.max(0, (this.eyeFlinch || 0) - dt);
    const p = game.player;
    const sk = this.phase2 ? 0.75 : 1;
    this.lookX = p.cx;

    switch (this.state) {
      case 'dormant':
        this.headRise = 0;
        break;
      case 'intro': {
        const k = 1 - this.t / 3.4;
        this.headRise = clamp(k * 1.6, 0, 1);
        this.eyeOpen = clamp((k - 0.45) * 3, 0, 1);
        if (this.t < 2.0 && this.t + dt >= 2.0) {
          game.audio.play('krakenRoar');
          game.camera.shake(1);
        }
        if (Math.random() < 0.6) game.splash(this.headX + rand(-110, 110), this.surfaceY, 4);
        if (this.t <= 0) {
          this.state = 'sink';
          this.t = 0.8;
        }
        break;
      }
      case 'sink':
        this.headRise = approach(this.headRise, 0, dt * 1.6);
        this.eyeOpen = approach(this.eyeOpen, 0, dt * 2);
        if (this.t <= 0) this.toIdle(this.phase2 ? 0.5 : 0.9);
        break;
      case 'idle':
        if (this.t <= 0) this.choose(game);
        break;
      case 'arms':
        // waiting for the arms to finish
        if (this.arms.every((a) => a.state === 'idle')) this.toIdle(this.phase2 ? 0.35 : 0.7);
        break;
      case 'surface':
        this.headRise = approach(this.headRise, 1, dt * 2.2);
        this.eyeOpen = approach(this.eyeOpen, 1, dt * 3);
        if (Math.random() < 0.5) game.splash(this.headX + rand(-90, 90), this.surfaceY, 3);
        if (this.headRise >= 1) {
          this.state = 'ink';
          this.t = 0.5;
          this.inkLeft = this.phase2 ? 5 : 3;
          this.inkT = 0.35;
        }
        break;
      case 'ink':
        this.inkT -= dt;
        if (this.inkLeft > 0 && this.inkT <= 0) {
          this.inkT = 0.32;
          this.inkLeft--;
          const mx = this.headX;
          const my = this.eyeY + 40;
          const tx = p.cx + rand(-70, 70);
          const T = 0.8;
          const vx = (tx - mx) / T;
          const vy = (p.feetY - my - 0.5 * 900 * T * T) / T;
          game.projectiles.push(new InkBall(mx, my, vx, vy));
          game.audio.play('ink');
        }
        if (this.inkLeft === 0 && this.inkT <= 0) {
          this.state = 'exposed';
          this.t = 1.8 * sk;
        }
        break;
      case 'exposed':
        if (this.t <= 0) {
          this.state = 'sink';
          this.t = 0.7;
        }
        break;
      case 'storm':
        if (this.t <= 0) this.toIdle(0.6);
        break;
      case 'roar':
        this.headRise = approach(this.headRise, 1, dt * 2);
        this.eyeOpen = 1;
        if (this.t <= 0) {
          this.state = 'sink';
          this.t = 0.6;
        }
        break;
      case 'dying':
        this.headRise = clamp(this.t / 3.6, 0, 1) * 1.05;
        this.eyeOpen = approach(this.eyeOpen, 0, dt * 0.6);
        if (Math.random() < 0.8) game.splash(this.headX + rand(-120, 120), this.surfaceY, 6);
        if (Math.random() < 0.3) game.particles.add({ x: this.headX + rand(-80, 80), y: this.surfaceY - rand(0, 60), vx: rand(-40, 40), vy: rand(-120, -40), size: rand(3, 7), color: 'rgba(40,20,50,0.8)', life: 1, kind: 'smoke', grow: 20 });
        for (const a of this.arms) {
          a.rise = clamp(this.t / 3.6, 0, 1);
          a.angle = -Math.PI / 2 + Math.sin(this.time * 6 + a.baseX) * 0.6;
          a.curl = Math.sin(this.time * 4 + a.baseX) * 1.2;
        }
        if (this.t <= 0) {
          this.dead = true;
          this.arms = [];
        }
        break;
    }

    if (this.state !== 'dying') {
      for (const a of this.arms) a.update(dt, game);
      this.arms = this.arms.filter((a) => a.state !== 'idle' || this.state === 'arms');
      if (this.state !== 'arms') this.arms = this.arms.filter((a) => a.state !== 'idle');
    }

    // targeting box (for camera focus etc.)
    this.cx = this.headX;
    this.x = this.headX - 100;
    this.y = this.eyeY - 80;
  }

  toIdle(t) {
    this.state = 'idle';
    this.t = t;
  }

  choose(game) {
    const p = game.player;
    const opts = ['slam', 'slam', 'skim', 'ink'];
    if (this.phase2) opts.push('double', 'storm', 'ink');
    let c = pick(opts);
    if (c === this.lastAttack && c !== 'slam') c = 'slam';
    this.lastAttack = c;
    const tell = this.phase2 ? 0.65 : 0.85;
    switch (c) {
      case 'slam': {
        const side = p.cx < (this.arena.x0 + this.arena.x1) / 2 ? 1 : -1;
        this.newArm(this.armBaseNear(p.cx, side)).attack('slam', p.cx, game, { tell, stuck: 1.3 });
        this.state = 'arms';
        break;
      }
      case 'double': {
        this.newArm(this.armBaseNear(p.cx, -1)).attack('slam', p.cx, game, { tell: 0.85, stuck: 1.1 });
        this.newArm(this.armBaseNear(p.cx, 1)).attack('slam', p.cx, game, { tell: 1.15, stuck: 1.1 });
        this.state = 'arms';
        break;
      }
      case 'skim': {
        const fromLeft = p.cx > (this.arena.x0 + this.arena.x1) / 2;
        const bx = fromLeft ? this.arena.x0 + 20 : this.arena.x1 - 20;
        const arm = this.newArm(bx, { length: Math.min(900, this.arena.x1 - this.arena.x0 - 60), thick: 22 });
        arm.attack('skim', fromLeft ? this.arena.x1 : this.arena.x0, game, { tell: 0.9 });
        this.state = 'arms';
        break;
      }
      case 'ink': {
        // surface beside the player, never right under them
        const side = p.cx < (this.arena.x0 + this.arena.x1) / 2 ? 1 : -1;
        this.headX = clamp(p.cx + side * 190, this.arena.x0 + 140, this.arena.x1 - 140);
        this.state = 'surface';
        game.audio.play('bubbles');
        break;
      }
      case 'storm': {
        const n = 3;
        for (let i = 0; i < n; i++) game.projectiles.push(new LightningStrike(p.cx + (i - 1) * 140 * (Math.random() < 0.5 ? 1 : -1) * (i === 1 ? 0 : 1), this.arena, 0.9 + i * 0.45));
        this.state = 'storm';
        this.t = 2.4;
        break;
      }
    }
  }

  // Damage to the player from anything the Kraken is doing.
  hurtsPlayer(box) {
    if (this.state === 'dormant' || this.state === 'dying') return false;
    return this.arms.some((a) => a.touches(box));
  }

  hitboxes() {
    return [];
  }

  // Under-water shadow + head, drawn before the water surface.
  draw(ctx, game) {
    if (this.dead) return;
    const sy = this.surfaceY;
    const hx = this.headX;
    const t = this.time;
    // vast shape under the water
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#12060f';
    ctx.beginPath();
    ctx.ellipse(hx, sy + 210, 300, 120, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (this.headRise > 0.02) this.drawHead(ctx, hx, this.eyeY, t);
    for (const a of this.arms) a.draw(ctx, game);
  }

  drawHead(ctx, hx, eyeY, t) {
    const sy = this.surfaceY;
    const flash = this.flash > 0;
    const top = eyeY - 190; // the mantle towers over the eye
    const rise = this.headRise;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Arm-roots curling out over the water on both sides of the head.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const base = [hx + side * (60 + k * 30), eyeY + 70];
        const reach = (150 + k * 60) * rise;
        const sway = Math.sin(t * 1.3 + k * 2 + side) * 0.25;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          const a = (side > 0 ? -0.2 : Math.PI + 0.2) + side * (u * u * (1.6 + sway)) * -1;
          const x = base[0] + Math.cos(a) * reach * u;
          const y = Math.min(sy + 4, base[1] + Math.sin(a) * reach * u * 0.6 + u * 30);
          pts.push([x, y, (26 - k * 6) * (1 - u * 0.85)]);
        }
        for (let pass = 0; pass < 2; pass++) {
          for (let i = 1; i < pts.length; i++) {
            ctx.strokeStyle = pass ? (flash ? '#fff' : '#5e1d3e') : '#0b0308';
            ctx.lineWidth = pts[i - 1][2] * 2 + (pass ? 0 : 3);
            ctx.beginPath();
            ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
            ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#e0b0c0';
        for (let i = 2; i < pts.length - 1; i += 2) {
          ctx.beginPath();
          ctx.arc(pts[i][0], pts[i][1] + pts[i][2] * 0.5, Math.max(1.5, pts[i][2] * 0.25), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Mantle: a tall, wrinkled bulb leaning back, darkening toward the crown.
    const g = ctx.createLinearGradient(hx, top, hx, eyeY + 80);
    g.addColorStop(0, flash ? '#fff' : '#2a0c1e');
    g.addColorStop(0.55, flash ? '#fff' : '#6a2246');
    g.addColorStop(1, flash ? '#fff' : '#7e2c52');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#0b0308';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hx - 120, eyeY + 90);
    ctx.bezierCurveTo(hx - 150, eyeY - 20, hx - 150, top + 40, hx - 70, top);
    ctx.bezierCurveTo(hx - 20, top - 30, hx + 70, top - 10, hx + 110, top + 60);
    ctx.bezierCurveTo(hx + 150, eyeY - 30, hx + 140, eyeY + 40, hx + 120, eyeY + 90);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    // wrinkles and scars
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(15,3,10,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(hx - 110 + i * 40, top + 20 + (i % 2) * 14);
      ctx.bezierCurveTo(hx - 90 + i * 40, top + 90, hx - 120 + i * 44, eyeY - 60, hx - 100 + i * 42, eyeY + 10);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,200,230,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx + 30, top + 40);
    ctx.lineTo(hx + 70, top + 110);
    ctx.moveTo(hx + 44, top + 46);
    ctx.lineTo(hx + 80, top + 104);
    ctx.stroke();
    // moonlit rim on the crown
    ctx.strokeStyle = 'rgba(190,210,255,0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hx - 135, eyeY - 40);
    ctx.bezierCurveTo(hx - 150, top + 40, hx - 80, top - 6, hx - 10, top - 8);
    ctx.stroke();
    // bioluminescent freckles
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const a = i * 2.39;
      const r = 30 + ((i * 23) % 100);
      const sx = hx + Math.cos(a) * r;
      const spy = top + 90 + Math.sin(a) * r * 0.8;
      const b = 0.35 + 0.45 * Math.sin(t * 2.2 + i);
      ctx.fillStyle = `rgba(90,235,255,${b * 0.8})`;
      ctx.beginPath();
      ctx.arc(sx, spy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // The eye, under a heavy brow
    const open = this.eyeOpen * (this.eyeFlinch > 0 ? 0.3 : 1);
    const exposed = this.state === 'ink' || this.state === 'exposed';
    glow(ctx, hx, eyeY, exposed ? 130 : 80, 'rgb(240,210,90)', (exposed ? 0.75 : 0.35) * this.eyeOpen);
    ctx.fillStyle = '#1a0610';
    ctx.beginPath();
    ctx.ellipse(hx, eyeY, 54, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    if (open > 0.05) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(hx, eyeY, 48, 31 * open, 0, 0, Math.PI * 2);
      ctx.clip();
      const ig = ctx.createRadialGradient(hx, eyeY, 4, hx, eyeY, 48);
      ig.addColorStop(0, '#fff6b0');
      ig.addColorStop(0.45, '#e2b83a');
      ig.addColorStop(0.85, '#8a4a10');
      ig.addColorStop(1, '#3a1a08');
      ctx.fillStyle = ig;
      ctx.fillRect(hx - 54, eyeY - 36, 108, 72);
      // iris striations
      ctx.strokeStyle = 'rgba(90,40,10,0.45)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(hx + Math.cos(a) * 12, eyeY + Math.sin(a) * 8);
        ctx.lineTo(hx + Math.cos(a) * 46, eyeY + Math.sin(a) * 30);
        ctx.stroke();
      }
      // horizontal goat-slit pupil, tracking you
      ctx.fillStyle = '#05020a';
      const look = clamp(((this.lookX ?? hx) - hx) / 400, -1, 1) * 14;
      ctx.beginPath();
      ctx.ellipse(hx + look, eyeY, 28, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(hx - 18, eyeY - 12 * open, 7, 3.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // heavy brow fold
    ctx.fillStyle = flash ? '#fff' : '#3e1028';
    ctx.strokeStyle = '#0b0308';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx - 70, eyeY - 18);
    ctx.quadraticCurveTo(hx, eyeY - 62 + (1 - open) * 22, hx + 70, eyeY - 22);
    ctx.quadraticCurveTo(hx, eyeY - 42 + (1 - open) * 26, hx - 70, eyeY - 18);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  light(out) {
    if (this.dead || this.state === 'dormant') return;
    out.push({ x: this.headX, y: this.surfaceY - 40, r: 360, color: 'rgb(110,70,140)', i: 0.5 * this.headRise + 0.15 });
    if (this.eyeOpen > 0.1) out.push({ x: this.headX, y: this.eyeY, r: 220, color: 'rgb(230,210,120)', i: 0.8 * this.eyeOpen });
    for (const a of this.arms) a.light(out);
  }
}
