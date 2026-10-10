import { TILE } from '../config.js';
import { hash2 } from '../core/math.js';
import { isWater } from '../world/level.js';

// Animated water drawn over the world (so anything below the surface is
// submerged). Calm water ('~') is glassy with moon glints; rough water ('%')
// churns with whitecaps, so it reads as "not walkable" at a glance.

export class WaterRenderer {
  constructor(level) {
    this.level = level;
    this.runs = [];
    const L = level;
    for (let ty = 0; ty < L.h; ty++) {
      let tx = 0;
      while (tx < L.w) {
        if (isWater(L.grid[ty][tx]) && !isWater(L.tileAt(tx, ty - 1))) {
          const x0 = tx;
          while (tx < L.w && isWater(L.grid[ty][tx]) && !isWater(L.tileAt(tx, ty - 1))) tx++;
          let bottom = ty;
          while (bottom < L.h && isWater(L.grid[bottom][x0])) bottom++;
          this.runs.push({ x0, x1: tx - 1, ty, bottom });
        } else tx++;
      }
    }
  }

  rough(tx, ty) {
    return this.level.tileAt(tx, ty) === '%';
  }

  // Surface height (px) at world x for a run — rough water heaves harder.
  waveY(x, y0, ty, t) {
    const tx = Math.floor(x / TILE);
    const r = this.rough(tx, ty) ? 1 : 0;
    const calm = Math.sin(x * 0.035 + t * 2.0) * 1.6 + Math.sin(x * 0.013 - t * 1.3) * 2.2;
    const chop = Math.sin(x * 0.09 - t * 6.5) * 3 + Math.sin(x * 0.051 + t * 4.1) * 4;
    return y0 + calm + r * chop;
  }

  draw(ctx, view, t) {
    for (const run of this.runs) {
      const rx0 = run.x0 * TILE;
      const rx1 = (run.x1 + 1) * TILE;
      if (rx1 < view.x0 - 20 || rx0 > view.x1 + 20) continue;
      const y0 = run.ty * TILE + 2;
      if (y0 > view.y1 + 10) continue;
      const yb = Math.min(run.bottom * TILE, view.y1 + 20);
      const xa = Math.max(rx0, view.x0 - 16);
      const xb = Math.min(rx1, view.x1 + 16);

      // body
      const grad = ctx.createLinearGradient(0, y0, 0, y0 + 260);
      grad.addColorStop(0, 'rgba(32,78,104,0.78)');
      grad.addColorStop(0.35, 'rgba(10,32,48,0.9)');
      grad.addColorStop(1, 'rgba(3,10,18,0.97)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(xa, yb);
      for (let x = xa; x <= xb; x += 8) ctx.lineTo(x, this.waveY(x, y0, run.ty, t));
      ctx.lineTo(xb, this.waveY(xb, y0, run.ty, t));
      ctx.lineTo(xb, yb);
      ctx.closePath();
      ctx.fill();

      // a second, darker swell just under the surface for depth
      ctx.fillStyle = 'rgba(6,20,32,0.35)';
      ctx.beginPath();
      ctx.moveTo(xa, yb);
      for (let x = xa; x <= xb; x += 12) ctx.lineTo(x, y0 + 10 + Math.sin(x * 0.02 + t * 1.1) * 4);
      ctx.lineTo(xb, yb);
      ctx.closePath();
      ctx.fill();

      // surface line
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(160,215,245,0.5)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = xa; x <= xb; x += 6) {
        const y = this.waveY(x, y0, run.ty, t);
        if (x === xa) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // per-tile surface details
      const tx0 = Math.floor(xa / TILE);
      const tx1 = Math.floor(xb / TILE);
      for (let tx = tx0; tx <= tx1; tx++) {
        const cx = tx * TILE;
        if (this.rough(tx, run.ty)) {
          // whitecaps rolling along
          for (let k = 0; k < 2; k++) {
            const ph = (t * 1.4 + hash2(tx, k) * 6) % 1;
            const fx = cx + ((hash2(tx, k + 3) * 32 + ph * 40) % 32);
            const fy = this.waveY(fx, y0, run.ty, t) - 1;
            const a = Math.sin(ph * Math.PI);
            ctx.fillStyle = `rgba(225,240,255,${0.55 * a})`;
            ctx.beginPath();
            ctx.ellipse(fx, fy, 7 + 4 * a, 2.2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(200,225,245,0.12)';
          ctx.fillRect(cx, y0 + 3 + Math.sin(t * 5 + tx) * 2, TILE, 3);
        } else {
          // moon glints on calm water
          const g = Math.sin(t * 2.3 + hash2(tx, 9) * 20);
          if (g > 0.6) {
            const gx = cx + hash2(tx, 4) * 26;
            ctx.fillStyle = `rgba(210,235,255,${(g - 0.6) * 1.6})`;
            ctx.fillRect(gx, this.waveY(gx, y0, run.ty, t) + 2, 6, 1.2);
          }
        }
      }
      ctx.restore();
    }
  }

  // Nearest surface y (px) under a world x, for splashes and ripples.
  surfaceAt(x, nearY) {
    const tx = Math.floor(x / TILE);
    let best = null;
    for (const run of this.runs) {
      if (tx < run.x0 || tx > run.x1) continue;
      const y = run.ty * TILE;
      if (best === null || Math.abs(y - nearY) < Math.abs(best - nearY)) best = y;
    }
    return best;
  }
}
