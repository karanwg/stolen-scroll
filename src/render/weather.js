import { VIEW_W, VIEW_H } from '../config.js';
import { rand } from '../core/math.js';

// Screen-space storm: slanted rain in two depths, and lightning that flashes
// the sky (and, for a heartbeat, shows what's out there on the horizon).
export class Weather {
  constructor(kind) {
    this.kind = kind;
    this.flash = 0;
    this.nextBolt = rand(4, 9);
    this.bolt = null;
    this.boltX = 600;
    this.intensity = 1;
    this.gust = 0; // 0..1, set by the game from nearby wind zones (signed by gustDir)
    this.gustDir = 1;
    this.drops = Array.from({ length: kind === 'snow' ? 220 : 170 }, () => (kind === 'snow' ? this.newFlake(true) : this.newDrop(true)));
    this.onThunder = null;
  }

  newFlake(anywhere = false) {
    const depth = Math.random();
    return {
      x: rand(-120, VIEW_W + 120),
      y: anywhere ? rand(-20, VIEW_H) : rand(-40, -5),
      v: 30 + depth * 70,
      r: 0.6 + depth * 2.2,
      a: 0.35 + depth * 0.5,
      ph: rand(0, 6.28),
      depth,
    };
  }

  newDrop(anywhere = false) {
    const near = Math.random() < 0.35;
    return {
      x: rand(-100, VIEW_W + 100),
      y: anywhere ? rand(-20, VIEW_H) : rand(-60, -10),
      v: near ? rand(900, 1100) : rand(600, 760),
      len: near ? rand(16, 24) : rand(8, 13),
      a: near ? 0.32 : 0.18,
      w: near ? 1.3 : 0.8,
    };
  }

  // Force a strike now (boss attacks reuse the flash).
  strike(x = rand(150, VIEW_W - 150), strength = 1) {
    this.flash = Math.max(this.flash, strength);
    this.boltX = x;
    const pts = [[x + rand(-40, 40), 0]];
    let px = pts[0][0];
    for (let i = 1; i <= 9; i++) {
      px += rand(-26, 26);
      pts.push([px, i / 9]);
    }
    this.bolt = pts;
    this.onThunder?.(rand(0.2, 0.9));
  }

  update(dt) {
    if (!this.kind) return;
    if (this.kind === 'snow') {
      const drift = 20 + this.gust * this.gustDir * 600;
      for (const f of this.drops) {
        f.ph += dt * (1 + f.depth);
        f.y += f.v * dt * (1 + this.gust * 0.5);
        f.x += (drift * (0.4 + f.depth) + Math.sin(f.ph) * 14) * dt;
        if (f.y > VIEW_H + 10 || f.x < -140 || f.x > VIEW_W + 140) {
          Object.assign(f, this.newFlake());
          if (this.gust > 0.3) {
            f.x = this.gustDir > 0 ? rand(-140, -10) : rand(VIEW_W + 10, VIEW_W + 140);
            f.y = rand(0, VIEW_H);
          }
        }
      }
      return;
    }
    this.flash = Math.max(0, this.flash - dt * 2.2);
    // double-flicker
    if (this.flash > 0 && this.flash < 0.55 && this.flicker === undefined) {
      this.flicker = true;
      this.flash = 0.75;
    }
    if (this.flash === 0) this.flicker = undefined;
    this.nextBolt -= dt * this.intensity;
    if (this.nextBolt <= 0) {
      this.nextBolt = rand(7, 15);
      this.strike();
    }
    const wind = 140 * this.intensity;
    for (const d of this.drops) {
      d.y += d.v * dt;
      d.x -= wind * dt * (d.v / 800);
      if (d.y > VIEW_H + 20 || d.x < -120) Object.assign(d, this.newDrop());
    }
  }

  draw(ctx) {
    if (!this.kind) return;
    if (this.kind === 'snow') {
      ctx.save();
      const streak = this.gust * this.gustDir * 26;
      for (const f of this.drops) {
        ctx.fillStyle = `rgba(235,242,255,${f.a})`;
        if (Math.abs(streak) > 3) {
          ctx.strokeStyle = `rgba(235,242,255,${f.a * 0.8})`;
          ctx.lineWidth = f.r;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(f.x - streak * (0.4 + f.depth), f.y - 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (this.gust > 0.2) {
        ctx.fillStyle = `rgba(220,230,250,${this.gust * 0.12})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      }
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.lineCap = 'round';
    const slant = 0.17 * this.intensity;
    for (const d of this.drops) {
      ctx.strokeStyle = `rgba(190,215,240,${d.a})`;
      ctx.lineWidth = d.w;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.len * slant, d.y - d.len);
      ctx.stroke();
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(210,230,255,${this.flash * 0.18})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.restore();
  }
}
