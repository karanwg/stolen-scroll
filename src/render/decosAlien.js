import { TILE } from '../config.js';
import { mulberry32 } from '../core/math.js';

// Chapter III (derelict half) props: biomechanical, wet, wrong.

export const ALIEN_PAINTERS = {
  // The fallen ship seen from outside, half-buried: a vast horseshoe of ribbed hull.
  hullExterior(g, d, out) {
    const W = d.w * TILE;
    const H = d.h * TILE;
    const grad = g.createLinearGradient(0, -H, 0, 0);
    grad.addColorStop(0, '#1d2828');
    grad.addColorStop(1, '#0b1212');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-W * 0.05, -H * 0.8, W * 0.25, -H * 1.05, W * 0.48, -H);
    g.bezierCurveTo(W * 0.7, -H * 0.95, W * 1.02, -H * 0.85, W, 0);
    g.closePath();
    g.fill();
    // ribs
    g.strokeStyle = 'rgba(70,95,90,0.6)';
    g.lineWidth = 6;
    for (let i = 1; i < 12; i++) {
      const x = (W * i) / 12;
      g.beginPath();
      g.moveTo(x, 0);
      g.quadraticCurveTo(x - 20, -H * 0.5, x + 10, -H * (0.85 + Math.sin(i) * 0.1));
      g.stroke();
    }
    g.strokeStyle = 'rgba(160,230,210,0.12)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-W * 0.05, -H * 0.8, W * 0.25, -H * 1.05, W * 0.48, -H);
    g.stroke();
    // a torn opening glowing faintly
    g.fillStyle = '#020403';
    g.beginPath();
    g.ellipse(W * 0.8, -H * 0.25, 60, 80, 0.2, 0, Math.PI * 2);
    g.fill();
    out.lights.push({ x: W * 0.8, y: -H * 0.25, r: 200, color: 'rgb(90,230,170)', i: 0.45, flicker: true });
    return { x0: -40, y0: -H * 1.1, x1: W + 40, y1: 4 };
  },

  crystals(g, d, out) {
    const rnd = mulberry32(d.x + 4);
    const n = d.n || 5;
    for (let i = 0; i < n; i++) {
      const x = (i - n / 2) * 16 + rnd() * 10;
      const h = 30 + rnd() * 50;
      const lean = (rnd() - 0.5) * 0.6;
      const grad = g.createLinearGradient(0, -h, 0, 0);
      grad.addColorStop(0, 'rgba(200,255,230,0.95)');
      grad.addColorStop(1, 'rgba(40,160,120,0.8)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - 6, 0);
      g.lineTo(x + lean * h - 3, -h * 0.85);
      g.lineTo(x + lean * h, -h);
      g.lineTo(x + lean * h + 3, -h * 0.85);
      g.lineTo(x + 6, 0);
      g.fill();
    }
    out.lights.push({ x: 0, y: -30, r: 150, color: 'rgb(110,255,190)', i: 0.7, flicker: true });
    return { x0: -60, y0: -100, x1: 60, y1: 4 };
  },

  // A Binoshi sealed into the wall in resin. Facing out. Eyes open.
  cocoon(g, d) {
    const s = d.scale || 1;
    g.save();
    g.scale(s, s);
    g.fillStyle = '#121a18';
    g.beginPath();
    g.ellipse(0, -40, 22, 44, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#25332f';
    g.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(-22 + i * 8, -80);
      g.quadraticCurveTo(-10 + i * 4, -40, -20 + i * 8, 0);
      g.stroke();
    }
    // a face in the resin
    g.fillStyle = '#2a2230';
    g.beginPath();
    g.ellipse(0, -62, 8, 9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(200,170,255,0.7)';
    g.fillRect(-4, -64, 2, 2);
    g.fillRect(2, -64, 2, 2);
    g.strokeStyle = 'rgba(150,220,200,0.2)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(-6, -50, 6, 18, 0.2, 0, Math.PI);
    g.stroke();
    g.restore();
    return { x0: -26 * s, y0: -90 * s, x1: 26 * s, y1: 4 };
  },

  // Flickering alien lamp: a wet, glowing pod on a stalk.
  podLight(g, d, out) {
    g.strokeStyle = '#1a2422';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(8, -20, 2, -38);
    g.stroke();
    g.fillStyle = 'rgba(150,255,200,0.85)';
    g.beginPath();
    g.ellipse(2, -44, 6, 8, 0, 0, Math.PI * 2);
    g.fill();
    out.lights.push({ x: 2, y: -44, r: d.r || 170, color: 'rgb(110,240,180)', i: 0.85, flicker: true, id: d.id });
    return { x0: -10, y0: -56, x1: 14, y1: 2 };
  },

  vent(g, d) {
    const W = (d.w || 2) * TILE;
    g.fillStyle = '#050808';
    g.fillRect(0, -28, W, 28);
    g.strokeStyle = '#2a3634';
    g.lineWidth = 3;
    for (let x = 6; x < W; x += 9) {
      g.beginPath();
      g.moveTo(x, -26);
      g.lineTo(x, -2);
      g.stroke();
    }
    g.strokeStyle = 'rgba(140,200,190,0.2)';
    g.lineWidth = 1;
    g.strokeRect(0.5, -27.5, W - 1, 27);
    return { x0: -2, y0: -30, x1: W + 2, y1: 2 };
  },

  // Dangling cables and dripping strands from the ceiling (anchor = ceiling).
  strands(g, d) {
    const W = (d.w || 6) * TILE;
    const rnd = mulberry32(d.x + 9);
    for (let i = 0; i < W / 14; i++) {
      const x = rnd() * W;
      const len = 30 + rnd() * 120;
      g.strokeStyle = rnd() < 0.5 ? '#16201e' : '#1f2b29';
      g.lineWidth = 2 + rnd() * 3;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 8, len * 0.3, x - 8, len * 0.6, x + (rnd() - 0.5) * 10, len);
      g.stroke();
      g.fillStyle = 'rgba(140,220,190,0.3)';
      g.beginPath();
      g.arc(x + (rnd() - 0.5) * 10, len + 2, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    return { x0: -10, y0: -4, x1: W + 10, y1: 170 };
  },

  // The Master's last camp at the breach: scattered scroll pages, a broken lantern.
  scatteredPages(g, d, out) {
    const rnd = mulberry32(d.x);
    for (let i = 0; i < 8; i++) {
      g.save();
      g.translate(-40 + rnd() * 80, -2 - rnd() * 3);
      g.rotate((rnd() - 0.5) * 1.2);
      g.fillStyle = '#d9cfa8';
      g.fillRect(-6, -2, 12, 4);
      g.restore();
    }
    out.lights.push({ x: 0, y: -10, r: 80, color: 'rgb(200,120,255)', i: 0.5 });
    return { x0: -50, y0: -12, x1: 50, y1: 4 };
  },
};
