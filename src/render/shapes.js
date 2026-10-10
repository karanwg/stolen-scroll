import { noise1 } from '../core/math.js';

// Shared drawing helpers: Japanese roofs, flames, glow sprites.

// A tiled roof with upturned eaves. (x, eaveY) is the left eave tip; the ridge is `rise` above.
export function roofPath(ctx, x, eaveY, w, rise, flare = 0.12) {
  const lift = rise * 0.28;
  ctx.moveTo(x - w * flare, eaveY - lift);
  ctx.quadraticCurveTo(x + w * 0.1, eaveY + rise * 0.05, x + w * 0.24, eaveY - rise * 0.45);
  ctx.lineTo(x + w * 0.38, eaveY - rise);
  ctx.lineTo(x + w * 0.62, eaveY - rise);
  ctx.lineTo(x + w * 0.76, eaveY - rise * 0.45);
  ctx.quadraticCurveTo(x + w * 0.9, eaveY + rise * 0.05, x + w * (1 + flare), eaveY - lift);
  ctx.lineTo(x + w * (1 + flare) - 3, eaveY - lift + 5);
  ctx.quadraticCurveTo(x + w * 0.88, eaveY + rise * 0.18, x + w * 0.5, eaveY + rise * 0.12);
  ctx.quadraticCurveTo(x + w * 0.12, eaveY + rise * 0.18, x - w * flare + 3, eaveY - lift + 5);
  ctx.closePath();
}

export function houseSilhouette(ctx, x, baseY, w, h, rise) {
  ctx.beginPath();
  ctx.rect(x + w * 0.06, baseY - h, w * 0.88, h);
  roofPath(ctx, x, baseY - h + rise * 0.1, w, rise);
  ctx.fill();
}

export function pagodaSilhouette(ctx, cx, baseY, w, tiers, tierH) {
  ctx.beginPath();
  let y = baseY;
  let tw = w;
  for (let i = 0; i < tiers; i++) {
    ctx.rect(cx - tw * 0.36, y - tierH, tw * 0.72, tierH);
    roofPath(ctx, cx - tw / 2, y - tierH + 6, tw, tierH * 0.45, 0.14);
    y -= tierH * 0.92;
    tw *= 0.84;
  }
  ctx.rect(cx - 2, y - tierH * 1.6, 4, tierH * 1.6);
  ctx.fill();
}

// Layered flame tongue with additive colour. (x, y) is the base centre.
export function drawFlame(ctx, x, y, w, h, t, seed = 0, intensity = 1) {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  const layers = [
    [1, 'rgba(255,60,20,', 0.55],
    [0.72, 'rgba(255,140,40,', 0.7],
    [0.42, 'rgba(255,225,150,', 0.85],
  ];
  for (let li = 0; li < layers.length; li++) {
    const [s, col, a] = layers[li];
    const ww = w * s;
    const hh = h * s * (0.75 + 0.45 * noise1(t * 7 + seed * 3.1 + li, seed));
    const sway = (noise1(t * 3.3 + seed, seed + 9) - 0.5) * w * 0.9;
    ctx.fillStyle = col + a * intensity + ')';
    ctx.beginPath();
    ctx.moveTo(x - ww / 2, y);
    ctx.bezierCurveTo(x - ww * 0.55, y - hh * 0.45, x + sway - ww * 0.2, y - hh * 0.7, x + sway, y - hh);
    ctx.bezierCurveTo(x + sway + ww * 0.12, y - hh * 0.65, x + ww * 0.6, y - hh * 0.4, x + ww / 2, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = prev;
}

// A cluster of tongues spread along a width — burning debris, roofs.
export function drawFire(ctx, x, y, w, h, t, seed = 0, intensity = 1) {
  const n = Math.max(1, Math.round(w / 14));
  for (let i = 0; i < n; i++) {
    const fx = x - w / 2 + (w * (i + 0.5)) / n;
    const k = 0.65 + 0.35 * noise1(i * 1.7 + seed, seed + 3);
    drawFlame(ctx, fx, y, (w / n) * 1.5, h * k, t, seed + i * 13.7, intensity);
  }
}

// Cached radial glow sprites keyed by colour.
const glowCache = new Map();
export function glowSprite(color) {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, withAlpha(color, 0.45));
  grad.addColorStop(1, withAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(color, c);
  return c;
}

export function glow(ctx, x, y, r, color, alpha = 1) {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

function withAlpha(color, a) {
  // accepts rgb(r,g,b) or #rrggbb
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const m = color.match(/[\d.]+/g);
  return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
