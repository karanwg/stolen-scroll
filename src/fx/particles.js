import { rand } from '../core/math.js';
import { JUICE } from '../config.js';

// One pool for everything: sparks, embers, smoke, ink, dust.
// kind: 'dot' (glowing square-ish spark), 'streak' (velocity-aligned line),
//       'smoke' (soft expanding blob), 'shard' (rotating sliver), 'ring' (expanding circle)
export class Particles {
  constructor() {
    this.list = [];
  }

  add(p) {
    if (!JUICE.particles && !p.essential) return;
    this.list.push({
      kind: 'dot',
      vx: 0,
      vy: 0,
      grav: 0,
      drag: 0,
      size: 2,
      grow: 0,
      life: 0.5,
      color: '#fff',
      additive: false,
      rot: 0,
      vrot: 0,
      ...p,
      max: p.life ?? 0.5,
    });
  }

  burst(x, y, n, opts = {}) {
    const { speed = 120, spread = Math.PI * 2, angle = 0, life = 0.5, ...rest } = opts;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * rand(0.35, 1);
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1.2), ...rest });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.grav * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.rot += p.vrot * dt;
    }
    this.list = this.list.filter((p) => p.life > 0 && p.size > 0);
  }

  draw(ctx, view, layer = 'world') {
    for (const p of this.list) {
      if ((p.layer || 'world') !== layer) continue;
      if (p.x < view.x0 - 80 || p.x > view.x1 + 80 || p.y < view.y0 - 80 || p.y > view.y1 + 80) continue;
      const k = Math.max(0, p.life / p.max);
      ctx.globalAlpha = (p.alpha ?? 1) * (p.fadeIn ? Math.min(1, (1 - k) * 6) : 1) * Math.min(1, k * 1.8);
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.kind) {
        case 'smoke': {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'streak': {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          const len = Math.min(26, sp * 0.045) + p.size;
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
          ctx.stroke();
          break;
        }
        case 'shard': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(-p.size, 0);
          ctx.lineTo(0, -p.size * 0.35);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(0, p.size * 0.35);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case 'ring': {
          ctx.lineWidth = Math.max(0.5, 3 * k);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        default: {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
