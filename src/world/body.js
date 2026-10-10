import { TILE } from '../config.js';

// Minimal tile collision for enemies and projectiles.
// Sets b.grounded, b.hitWall (-1/0/1), b.hitCeil.
export function moveBody(b, lvl, dt, { oneWay = true } = {}) {
  b.hitWall = 0;
  b.hitCeil = false;
  const dx = b.vx * dt;
  const dy = b.vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
  for (let i = 0; i < steps; i++) {
    const sx = dx / steps;
    if (sx) {
      b.x += sx;
      const hit = lvl.boxHit(b.x, b.y, b.w, b.h);
      if (hit) {
        b.x = sx > 0 ? hit[0] * TILE - b.w : (hit[0] + 1) * TILE;
        b.hitWall = sx > 0 ? 1 : -1;
        b.vx = 0;
      }
    }
    const sy = dy / steps;
    if (sy) {
      const prevBottom = b.y + b.h;
      b.y += sy;
      if (sy > 0 && oneWay) {
        const plat = lvl.platformHit(b.x, b.y, b.w, b.h, prevBottom);
        if (plat) {
          b.y = plat.y - b.h;
          b.vy = 0;
          continue;
        }
      }
      const hit = sy > 0 ? lvl.boxHit(b.x, b.y, b.w, b.h, oneWay, prevBottom) : lvl.boxHit(b.x, b.y, b.w, b.h);
      if (hit) {
        if (sy > 0) b.y = hit[1] * TILE - b.h;
        else {
          b.y = (hit[1] + 1) * TILE;
          b.hitCeil = true;
        }
        b.vy = 0;
      }
    }
  }
  b.grounded = b.vy >= 0 && lvl.groundUnder(b.x, b.y, b.w, b.h, oneWay) !== null;
}

// Is there floor one step ahead of the body's leading foot?
export function groundAhead(b, lvl, dir, dist = 4) {
  const fx = dir > 0 ? b.x + b.w + dist : b.x - dist;
  for (const p of lvl.platforms) if (p.solid && fx >= p.x && fx <= p.x + p.w && Math.abs(b.y + b.h - p.y) < 4) return true;
  const ty = Math.floor((b.y + b.h + 2) / TILE);
  const tx = Math.floor(fx / TILE);
  const t = lvl.tileAt(tx, ty);
  return t === '#' || t === 'w' || t === '=' || t === 'X' || t === 'G';
}

export function wallAhead(b, lvl, dir) {
  const fx = dir > 0 ? b.x + b.w + 2 : b.x - 2;
  return lvl.boxHit(fx, b.y + 4, 1, b.h - 8) !== null;
}
