import { TILE } from '../config.js';
import { hash2 } from '../core/math.js';
import { isWater } from '../world/level.js';

// Animated water drawn over the world (so anything below the surface is
// submerged). Calm water ('~') is glassy with moon glints; rough water ('%')
// churns white — peaked waves, a band of foam, spray — so it reads as
// "not walkable" at a glance.

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
    // rough water: sharp crests that peak upward, churning fast
    const chop = -Math.abs(Math.sin(x * 0.07 - t * 5.5)) * 9 - Math.abs(Math.sin(x * 0.043 + t * 3.7)) * 5 + Math.sin(x * 0.17 + t * 9) * 1.5 + 6;
    return y0 + calm + r * chop;
  }

  // Contiguous rough stretches [x0, x1] (px) of a run, clipped to [xa, xb].
  roughSpans(run, xa, xb) {
    const spans = [];
    let start = null;
    const tx0 = Math.floor(xa / TILE);
    const tx1 = Math.floor(xb / TILE);
    for (let tx = tx0; tx <= tx1 + 1; tx++) {
      const r = tx <= tx1 && this.rough(tx, run.ty);
      if (r && start === null) start = tx;
      if (!r && start !== null) {
        spans.push([Math.max(xa, start * TILE), Math.min(xb, tx * TILE)]);
        start = null;
      }
    }
    return spans;
  }

  // White water: a thick churning band of foam, streaks below, breaking
  // crests throwing spray. Drawn so it can't be mistaken for calm water.
  drawRough(ctx, run, a, b, y0, t) {
    // murkier, churned-up body
    const murk = ctx.createLinearGradient(0, y0, 0, y0 + 90);
    murk.addColorStop(0, 'rgba(150,175,185,0.2)');
    murk.addColorStop(1, 'rgba(150,175,185,0)');
    ctx.fillStyle = murk;
    ctx.fillRect(a, y0 + 4, b - a, 86);
    // foam band along the surface, with a ragged underside
    ctx.fillStyle = 'rgba(225,238,248,0.62)';
    ctx.beginPath();
    for (let x = a; x <= b; x += 6) ctx.lineTo(x, this.waveY(x, y0, run.ty, t) - 1);
    for (let x = b; x >= a; x -= 5) ctx.lineTo(x, this.waveY(x, y0, run.ty, t) + 6 + Math.abs(Math.sin(x * 0.31 + t * 7)) * 6);
    ctx.closePath();
    ctx.fill();
    // foam streaks dragged under by the current
    ctx.strokeStyle = 'rgba(210,230,245,0.3)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let x = Math.floor(a / 20) * 20; x < b; x += 20) {
      for (let k = 0; k < 2; k++) {
        const ph = (t * 1.8 + hash2(x, k) * 5) % 1;
        const sx = x + ph * 26;
        const sy = y0 + 16 + k * 16 + hash2(x, k + 7) * 10;
        if (sx < a || sx + 14 > b) continue;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 7, sy - 4, sx + 14, sy);
      }
    }
    ctx.stroke();
    // breaking crests: a bright curl, and spray thrown off it
    for (let x = Math.floor(a / TILE) * TILE; x < b; x += TILE) {
      const tx = x / TILE;
      for (let k = 0; k < 4; k++) {
        const ph = (t * 1.5 + hash2(tx, k) * 7) % 1;
        const dx = x + hash2(tx, k + 3) * 32 + ph * 22;
        if (dx < a || dx > b) continue;
        const base = this.waveY(dx, y0, run.ty, t);
        const dy = base - Math.sin(ph * Math.PI) * (14 + hash2(tx, k + 5) * 14);
        ctx.fillStyle = `rgba(235,245,255,${0.85 * (1 - ph)})`;
        ctx.fillRect(dx, dy, 2.2, 2.2);
      }
    }
  }

  // Foam that shows through the darkness (drawn after the lighting).
  drawGlow(ctx, view, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const run of this.runs) {
      const rx0 = run.x0 * TILE;
      const rx1 = (run.x1 + 1) * TILE;
      if (rx1 < view.x0 - 20 || rx0 > view.x1 + 20) continue;
      const y0 = run.ty * TILE + 2;
      if (y0 > view.y1 + 10 || y0 < view.y0 - 40) continue;
      for (const [a, b] of this.roughSpans(run, Math.max(rx0, view.x0 - 16), Math.min(rx1, view.x1 + 16))) {
        ctx.strokeStyle = 'rgba(150,180,200,0.35)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let x = a; x <= b; x += 6) ctx.lineTo(x, this.waveY(x, y0, run.ty, t));
        ctx.stroke();
      }
    }
    ctx.restore();
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

      // body (some themes tint their water: the onsen is milky and warm)
      const tint = this.level.themeAtTile(run.x0).water;
      const grad = ctx.createLinearGradient(0, y0, 0, y0 + 260);
      grad.addColorStop(0, tint?.top || 'rgba(32,78,104,0.78)');
      grad.addColorStop(0.35, tint?.mid || 'rgba(10,32,48,0.9)');
      grad.addColorStop(1, tint?.deep || 'rgba(3,10,18,0.97)');
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

      for (const [a, b] of this.roughSpans(run, xa, xb)) this.drawRough(ctx, run, a, b, y0, t);

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
