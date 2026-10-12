import { clamp, lerp } from '../core/math.js';

// The Mind Flayer: a thing the size of the sky, made of smoke and shadow —
// a swollen body hung from a storm, and long jointed legs that reach down.
// One painter for both the shape in the clouds and the boss itself.
//
// Drawn around (x, y) = the body's centre. Units: at s = 1 the body is ~120
// across and the legs reach ~420 down. opts:
//   alpha      overall opacity (it is mostly smoke)
//   glow 0..1  red light inside it (lightning, rage)
//   legs       [{ tip: [lx, ly] }] — override where a leg's tip is (local units)
//   breathe    phase
//   colour     body tone (default near-black blue)

const LEG_ANGLES = [-0.15, 0.35, 0.8, 1.2, 1.95, 2.35, 2.8, 3.3]; // radians, 0 = right, PI/2 = down

function smoke(ctx, pts, width, alpha, colour) {
  // a stroke built from several soft passes, so it reads as smoke not wire
  for (let pass = 0; pass < 3; pass++) {
    ctx.strokeStyle = colour;
    ctx.globalAlpha = alpha * (pass === 0 ? 0.25 : pass === 1 ? 0.45 : 0.9);
    ctx.lineWidth = width * (pass === 0 ? 2.2 : pass === 1 ? 1.5 : 1);
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[i - 1];
      ctx.quadraticCurveTo(q[0], q[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }
}

// A leg from the body to `tip`, kinked upward at the knee like a spider's.
export function flayerLeg(i, t, tipOverride = null) {
  const a = LEG_ANGLES[i];
  const sway = Math.sin(t * 0.5 + i * 1.7) * 0.12;
  const root = [Math.cos(a) * 40, Math.sin(a) * 26 + 10];
  const reach = 300 + (i % 3) * 50;
  const tip = tipOverride || [Math.cos(a + sway) * reach * 1.15, Math.max(120, Math.sin(a + sway) * reach) + 260 + Math.sin(t * 0.7 + i) * 20];
  const mid = [(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2];
  const out = Math.sign(tip[0] - root[0]) || 1;
  const knee = [mid[0] + out * 40, Math.min(root[1], tip[1]) - 90 - (i % 2) * 40];
  return { root, knee, tip };
}

export function drawFlayer(ctx, x, y, s, t, opts = {}) {
  const alpha = opts.alpha ?? 1;
  const glowK = clamp(opts.glow || 0, 0, 1);
  const col = opts.colour || '#05070c';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // the legs, back ones first
  const order = [0, 7, 1, 6, 2, 5, 3, 4];
  for (const i of order) {
    const L = flayerLeg(i, t, opts.legs?.[i]?.tip);
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      // two segments: root → knee → tip, with a smoky wobble along it
      const p = u < 0.45 ? [lerp(L.root[0], L.knee[0], u / 0.45), lerp(L.root[1], L.knee[1], u / 0.45)] : [lerp(L.knee[0], L.tip[0], (u - 0.45) / 0.55), lerp(L.knee[1], L.tip[1], (u - 0.45) / 0.55)];
      p[0] += Math.sin(t * 2 + i * 3 + k) * 4;
      pts.push(p);
    }
    smoke(ctx, pts, 16, alpha * (i === 3 || i === 4 ? 1 : 0.85), col);
    // a hooked claw at the end
    const tip = pts[pts.length - 1];
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.quadraticCurveTo(tip[0] + 12, tip[1] + 10, tip[0] + 6, tip[1] + 26);
    ctx.stroke();
  }
  // the body: a swollen, shifting mass
  const br = Math.sin((opts.breathe ?? t) * 0.8);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + t * 0.15;
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 26, Math.sin(a) * 16 - 10, 52 + br * 4, 38, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(0, -6, 70 + br * 5, 52 + br * 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // smoke pouring off the top into the storm
  for (let k = 0; k < 6; k++) {
    const u = ((t * 0.12 + k / 6) % 1);
    ctx.globalAlpha = alpha * 0.35 * (1 - u);
    ctx.beginPath();
    ctx.ellipse(Math.sin(k * 2.1 + t * 0.3) * 40, -50 - u * 160, 40 + u * 60, 26 + u * 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // red light inside it
  if (glowK > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, -6, 4, 0, -6, 90);
    g.addColorStop(0, `rgba(255,70,50,${0.55 * glowK * alpha})`);
    g.addColorStop(1, 'rgba(255,40,30,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -6, 90, 0, Math.PI * 2);
    ctx.fill();
    // veins lit from within
    ctx.strokeStyle = `rgba(255,90,70,${0.5 * glowK * alpha})`;
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.quadraticCurveTo(Math.cos(a) * 30, Math.sin(a) * 20 - 6, Math.cos(a + 0.4) * 62, Math.sin(a + 0.4) * 42 - 6);
      ctx.stroke();
    }
  }
  ctx.restore();
}
