import { TILE } from '../config.js';
import { mulberry32 } from '../core/math.js';

// Chapter III, the way down to the crater: the first signs that what fell
// was built, not born — and then the ships themselves.

const STEEL = '#2a3036';
const STEEL_DARK = '#171b20';
const STEEL_LIGHT = '#454e57';
const SNOW = '#d9e4f2';
const SNOW_SHADE = '#9fb1cc';

function snowDrift(g, x0, x1, y, rnd, h = 8) {
  g.fillStyle = SNOW_SHADE;
  g.beginPath();
  g.moveTo(x0, y + 2);
  for (let x = x0; x <= x1; x += 6) g.lineTo(x, y - rnd() * h);
  g.lineTo(x1, y + 2);
  g.fill();
  g.fillStyle = SNOW;
  g.beginPath();
  g.moveTo(x0 + 3, y + 2);
  for (let x = x0 + 3; x <= x1 - 3; x += 6) g.lineTo(x, y - 1 - rnd() * (h - 2));
  g.lineTo(x1 - 3, y + 2);
  g.fill();
}

function stripes(g, x, y, w, h, a = 1) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = `rgba(184,146,42,${a})`;
  g.fillRect(x, y, w, h);
  g.fillStyle = `rgba(12,12,14,${a})`;
  for (let k = -h; k < w + h; k += h * 1.4) {
    g.beginPath();
    g.moveTo(x + k, y + h);
    g.lineTo(x + k + h * 0.7, y);
    g.lineTo(x + k + h * 1.4, y);
    g.lineTo(x + k + h * 0.7, y + h);
    g.fill();
  }
  g.restore();
}

export const CRATER_PAINTERS = {
  // A pine snapped off and burned black where something passed overhead.
  scorchedPine(g, d) {
    const rnd = mulberry32(d.x + 3);
    const h = (d.h || 150) * (d.scale || 1);
    g.fillStyle = '#0b0a0b';
    g.beginPath();
    g.moveTo(-9, 0);
    g.lineTo(-6, -h * 0.75);
    g.lineTo(-2, -h * 0.9);
    g.lineTo(0, -h * 0.78);
    g.lineTo(4, -h);
    g.lineTo(6, -h * 0.72);
    g.lineTo(9, 0);
    g.fill();
    // charred stubs of branches
    g.strokeStyle = '#0b0a0b';
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const y = -h * (0.25 + rnd() * 0.5);
      const side = rnd() < 0.5 ? -1 : 1;
      g.lineWidth = 2 + rnd() * 2;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(side * (10 + rnd() * 18), y - 6 - rnd() * 10);
      g.stroke();
    }
    // the side away from the blast still carries snow
    g.fillStyle = 'rgba(220,230,245,0.7)';
    for (let i = 0; i < 5; i++) g.fillRect(-8, -h * (0.1 + i * 0.15), 3, 8);
    g.strokeStyle = 'rgba(255,140,80,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(5, -h * 0.7);
    g.lineTo(3, -h * 0.4);
    g.stroke();
    snowDrift(g, -22, 22, 0, rnd, 6);
    return { x0: -40, y0: -h - 10, x1: 40, y1: 4 };
  },

  // A slab of hull plating driven into the snow.
  hullShard(g, d, out) {
    const rnd = mulberry32(d.x + 11);
    const w = (d.w || 3) * TILE;
    const h = (d.h || 3) * TILE;
    const ang = d.angle ?? -0.25;
    g.save();
    g.rotate(ang);
    const grad = g.createLinearGradient(0, -h, w * 0.4, 0);
    grad.addColorStop(0, STEEL_LIGHT);
    grad.addColorStop(1, STEEL_DARK);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-w / 2, 10);
    g.lineTo(-w / 2 + 4, -h * 0.7);
    // torn top edge
    for (let k = 0; k <= 6; k++) g.lineTo(-w / 2 + (w * k) / 6, -h + rnd() * h * 0.3 - (k % 2) * 10);
    g.lineTo(w / 2, 10);
    g.closePath();
    g.fill();
    g.strokeStyle = '#0b0d10';
    g.lineWidth = 1.5;
    g.stroke();
    // panel lines, rivets, a scrap of stencil
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    for (let k = 1; k < 3; k++) {
      g.beginPath();
      g.moveTo(-w / 2 + (w * k) / 3, 0);
      g.lineTo(-w / 2 + (w * k) / 3, -h * 0.75);
      g.stroke();
    }
    g.fillStyle = '#5a646e';
    for (let k = 0; k < 6; k++) g.fillRect(-w / 2 + 6 + k * (w / 6), -h * 0.55, 2, 2);
    if (d.text) {
      g.fillStyle = 'rgba(210,200,160,0.55)';
      g.font = `bold ${Math.round(h * 0.22)}px monospace`;
      g.fillText(d.text, -w / 2 + 8, -h * 0.25);
    }
    // scorching at the torn edge
    const sc = g.createLinearGradient(0, -h, 0, -h * 0.5);
    sc.addColorStop(0, 'rgba(0,0,0,0.75)');
    sc.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sc;
    g.fillRect(-w / 2, -h, w, h * 0.5);
    g.restore();
    snowDrift(g, -w / 2 - 14, w / 2 + 14, 0, rnd, 10);
    if (d.steam) out.steam.push({ x: 0, y: -h * 0.6, w: w * 0.5 });
    return { x0: -w - 30, y0: -h * 1.4, x1: w + 30, y1: 14 };
  },

  // The long gouge it ploughed through the snow.
  furrow(g, d) {
    const rnd = mulberry32(d.x + 5);
    const W = d.w * TILE;
    g.fillStyle = 'rgba(6,8,12,0.65)';
    g.beginPath();
    g.moveTo(0, 2);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, 2 + Math.sin(x * 0.02) * 2 + 6);
    g.lineTo(W, 2);
    g.fill();
    // thrown-up banks, glassy where it was hot
    g.fillStyle = SNOW;
    g.beginPath();
    g.moveTo(0, 0);
    for (let x = 0; x <= W; x += 10) g.lineTo(x, -4 - rnd() * 8 * (x / W));
    g.lineTo(W, 0);
    g.fill();
    g.fillStyle = 'rgba(120,240,190,0.25)';
    for (let x = W * 0.3; x < W; x += 20 + rnd() * 30) g.fillRect(x, -2 - rnd() * 4, 6 + rnd() * 6, 1.5);
    return { x0: -4, y0: -16, x1: W + 4, y1: 12 };
  },

  // Binoshi who got here first.
  deadBinoshi(g, d) {
    const rnd = mulberry32(d.x + 21);
    const f = d.flip ? -1 : 1;
    g.save();
    g.scale(f, 1);
    // body, face down, one arm reaching
    g.fillStyle = '#231833';
    g.beginPath();
    g.ellipse(0, -7, 24, 7, 0.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1226';
    g.beginPath();
    g.ellipse(26, -6, 7, 6, 0, 0, Math.PI * 2); // hood
    g.fill();
    g.strokeStyle = '#231833';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(14, -6);
    g.lineTo(38, -3);
    g.stroke();
    g.beginPath();
    g.moveTo(-18, -6);
    g.lineTo(-36, -2);
    g.moveTo(-16, -4);
    g.lineTo(-34, 0);
    g.stroke();
    g.fillStyle = '#7d3cff';
    g.fillRect(-4, -11, 10, 2); // sash
    if (d.burst) {
      // turned over: the chest opened from the inside
      g.fillStyle = '#120608';
      g.beginPath();
      g.ellipse(4, -10, 7, 4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(90,10,20,0.6)';
      g.beginPath();
      g.ellipse(4, 0, 22, 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    // a blade dropped in the snow
    g.strokeStyle = '#9aa3ad';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(44, -1);
    g.lineTo(70, -5);
    g.stroke();
    g.restore();
    // snow settling over it
    g.fillStyle = 'rgba(220,230,245,0.75)';
    for (let i = 0; i < 9; i++) g.fillRect(-30 + rnd() * 60, -14 + rnd() * 5, 3 + rnd() * 5, 1.6);
    return { x0: -80, y0: -24, x1: 80, y1: 6 };
  },

  // The Tethys's lifeboat: it got clear, and it didn't help.
  escapePod(g, d, out) {
    const rnd = mulberry32(d.x + 31);
    const W = 150;
    const H = 66;
    g.save();
    g.translate(0, -18);
    g.rotate(-0.12);
    // hull
    const grad = g.createLinearGradient(0, -H, 0, 0);
    grad.addColorStop(0, '#c9ccd0');
    grad.addColorStop(0.5, '#8f959c');
    grad.addColorStop(1, '#3f454c');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-W / 2 + 20, -H);
    g.lineTo(W / 2 - 26, -H);
    g.quadraticCurveTo(W / 2 + 8, -H, W / 2 + 10, -H / 2);
    g.quadraticCurveTo(W / 2 + 8, 0, W / 2 - 26, 0);
    g.lineTo(-W / 2 + 20, 0);
    g.quadraticCurveTo(-W / 2 - 4, -H / 2, -W / 2 + 20, -H);
    g.fill();
    g.strokeStyle = '#1a1d21';
    g.lineWidth = 2;
    g.stroke();
    stripes(g, -W / 2 + 18, -H + 10, W - 50, 8, 0.85);
    g.fillStyle = 'rgba(20,22,26,0.85)';
    g.font = 'bold 10px monospace';
    g.fillText('TETHYS · LIFEBOAT 2', -W / 2 + 22, -H + 34);
    // scorching
    const sc = g.createLinearGradient(-W / 2, 0, W / 2, 0);
    sc.addColorStop(0, 'rgba(0,0,0,0.55)');
    sc.addColorStop(0.5, 'rgba(0,0,0,0)');
    g.fillStyle = sc;
    g.fillRect(-W / 2, -H, W, H);
    // hatch blown open: a dark doorway with a light still flickering inside
    g.fillStyle = '#06080a';
    g.beginPath();
    g.roundRect(W / 2 - 52, -H + 16, 30, 40, 6);
    g.fill();
    g.strokeStyle = '#2a2f35';
    g.stroke();
    g.restore();
    out.lights.push({ x: 40, y: -50, r: 120, color: 'rgb(255,200,140)', i: 0.55, flicker: true });
    // the hatch door, lying in the snow
    g.fillStyle = '#7d838a';
    g.save();
    g.translate(110, -4);
    g.rotate(0.3);
    g.fillRect(-16, -6, 32, 8);
    g.restore();
    snowDrift(g, -W / 2 - 20, W / 2 + 30, 0, rnd, 14);
    return { x0: -W / 2 - 40, y0: -H - 50, x1: W / 2 + 60, y1: 10 };
  },

  // A distress beacon on a pole, blinking red into the dark.
  beacon(g, d, out) {
    const h = 110;
    g.strokeStyle = '#1a1d21';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-4, -h);
    g.stroke();
    g.fillStyle = '#2a3036';
    g.fillRect(-14, -46, 20, 16); // battery box
    g.fillStyle = '#b8922a';
    g.fillRect(-14, -34, 20, 3);
    g.fillStyle = '#5a0c0c';
    g.beginPath();
    g.arc(-4, -h - 4, 5, 0, Math.PI * 2);
    g.fill();
    out.lights.push({ x: -4, y: -h - 4, r: 140, color: 'rgb(255,50,40)', i: 0.9, blink: 1.4 });
    out.lamps.push({ x: -4, y: -h - 4, r: 6, color: 'rgb(255,70,60)', blink: 1.4 });
    snowDrift(g, -20, 16, 0, mulberry32(d.x), 6);
    return { x0: -24, y0: -h - 14, x1: 20, y1: 4 };
  },

  // Cable torn out of something big, snaking across the snow.
  cable(g, d) {
    const rnd = mulberry32(d.x + 41);
    const W = d.w * TILE;
    g.strokeStyle = '#0d0f12';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, -3);
    for (let x = 30; x <= W; x += 30) g.quadraticCurveTo(x - 15, -3 - rnd() * 8, x, -2 - rnd() * 3);
    g.stroke();
    g.strokeStyle = 'rgba(160,170,180,0.25)';
    g.lineWidth = 1.2;
    g.stroke();
    // frayed end
    g.strokeStyle = '#b87333';
    g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(W, -3);
      g.lineTo(W + 6 + rnd() * 8, -3 + (rnd() - 0.5) * 12);
      g.stroke();
    }
    return { x0: -6, y0: -20, x1: W + 20, y1: 6 };
  },

  // The fallen star: the MSV Tethys, nose-down in the crater, and fused into
  // its spine the thing it was towing — a horseshoe of black bone.
  tethysHull(g, d, out) {
    const rnd = mulberry32(77);
    const W = d.w * TILE;
    const H = d.h * TILE;
    // ── the derelict behind it: two great curved horns of ribbed bone
    const bone = g.createLinearGradient(0, -H * 1.3, 0, 0);
    bone.addColorStop(0, '#2c3c39');
    bone.addColorStop(1, '#0c1312');
    g.fillStyle = bone;
    for (const [cx, lean, hh] of [[W * 0.18, -0.25, 1.35], [W * 0.46, 0.15, 1.2]]) {
      g.beginPath();
      g.moveTo(cx - 140, 0);
      g.bezierCurveTo(cx - 170, -H * 0.6, cx - 60 + lean * 200, -H * hh, cx + 40 + lean * 300, -H * hh * 1.02);
      g.quadraticCurveTo(cx + 70 + lean * 300, -H * hh * 0.98, cx + 50 + lean * 260, -H * hh * 0.9);
      g.bezierCurveTo(cx - 10 + lean * 120, -H * 0.8, cx + 10, -H * 0.4, cx + 30, 0);
      g.fill();
      g.strokeStyle = 'rgba(110,170,150,0.45)';
      g.lineWidth = 5;
      for (let k = 1; k < 9; k++) {
        const u = k / 9;
        const yy = -H * hh * u;
        g.beginPath();
        g.moveTo(cx - 150 + u * (110 + lean * 260), yy);
        g.quadraticCurveTo(cx - 60 + u * (80 + lean * 280), yy + 18, cx + 20 + u * (20 + lean * 260), yy);
        g.stroke();
      }
    }
    out.lights.push({ x: W * 0.3, y: -H * 0.9, r: 300, color: 'rgb(90,230,170)', i: 0.25, flicker: true });
    // ── the Tethys: a long industrial hull lying across the crater, bow buried in the bone
    const top = -H * 0.72;
    const hull = g.createLinearGradient(0, top, 0, 0);
    hull.addColorStop(0, '#7a848e');
    hull.addColorStop(0.1, '#4c555e');
    hull.addColorStop(1, '#1c2126');
    g.fillStyle = hull;
    g.beginPath();
    g.moveTo(W * 0.12, -H * 0.28);
    g.lineTo(W * 0.2, top - 20);
    g.lineTo(W * 0.92, top);
    g.lineTo(W, top + 50);
    g.lineTo(W, 0);
    g.lineTo(W * 0.1, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = '#07090b';
    g.lineWidth = 3;
    g.stroke();
    // plating
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 1.5;
    for (let x = W * 0.1; x < W; x += 64) {
      g.beginPath();
      g.moveTo(x, top - 30);
      g.lineTo(x, 0);
      g.stroke();
    }
    for (let y = top; y < 0; y += 48) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y + 8);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = W * 0.1; x < W; x += 64) g.fillRect(x + 2, top - 30, 1.5, H);
    // a dorsal spine of antennae and housings
    g.restore();
    for (let i = 0; i < 9; i++) {
      const x = W * 0.25 + i * W * 0.075;
      const yy = top - 6 + (x / W) * 20;
      g.fillStyle = '#2a3036';
      g.fillRect(x, yy - 18 - rnd() * 20, 20 + rnd() * 26, 22);
      g.strokeStyle = '#2a3036';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + 10, yy - 20);
      g.lineTo(x + 10 + rnd() * 10, yy - 60 - rnd() * 50);
      g.stroke();
    }
    // name and registry
    g.fillStyle = 'rgba(225,215,180,0.62)';
    g.font = 'bold 54px monospace';
    g.fillText('MSV  TETHYS', W * 0.36, top + 92);
    g.font = 'bold 18px monospace';
    g.fillText('DEEP SALVAGE · REG 4410-K · CREW 7', W * 0.37, top + 120);
    stripes(g, W * 0.36, top + 132, 420, 12, 0.8);
    // portholes: a few still lit
    for (let i = 0; i < 16; i++) {
      const x = W * 0.3 + i * 52;
      const y = top + 172;
      if (x > W - 60) break;
      g.fillStyle = '#0a0c0f';
      g.beginPath();
      g.arc(x, y, 9, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#4a535c';
      g.lineWidth = 2.5;
      g.stroke();
      if (rnd() < 0.55) {
        g.fillStyle = 'rgba(255,200,130,0.85)';
        g.beginPath();
        g.arc(x, y, 6, 0, Math.PI * 2);
        g.fill();
        const fl = rnd() < 0.4;
        out.lights.push({ x, y, r: 80, color: 'rgb(255,190,120)', i: 0.45, flicker: fl });
        out.lamps.push({ x, y, r: 3, color: 'rgb(255,200,140)', flicker: fl });
      }
    }
    // the bow, torn open where it hit the bone
    g.fillStyle = '#050607';
    g.beginPath();
    g.moveTo(W * 0.12, -H * 0.28);
    for (let k = 0; k <= 8; k++) g.lineTo(W * 0.14 + rnd() * 30 + k * 6, -H * 0.28 + (k / 8) * H * 0.28 + (rnd() - 0.5) * 20);
    g.lineTo(W * 0.1, 0);
    g.fill();
    // exterior floodlights, still burning on emergency power, washing down the hull
    for (const fx of [0.32, 0.5, 0.68, 0.86]) {
      const yy = top - 4 + fx * 20;
      g.fillStyle = '#1a1d21';
      g.fillRect(W * fx - 8, yy - 6, 16, 8);
      out.lights.push({ x: W * fx, y: yy + 60, r: 320, color: 'rgb(200,215,235)', i: 0.42 });
      out.lamps.push({ x: W * fx - 6, y: yy - 2, w: 12, h: 3, color: 'rgba(235,245,255,0.95)' });
    }
    // nav lights: red on the bow, green on the tail, both still blinking
    out.lights.push({ x: W * 0.21, y: top - 22, r: 160, color: 'rgb(255,40,30)', i: 0.9, blink: 1.1 });
    out.lamps.push({ x: W * 0.21, y: top - 22, r: 5, color: 'rgb(255,60,50)', blink: 1.1 });
    out.lights.push({ x: W * 0.92, y: top - 2, r: 160, color: 'rgb(60,255,120)', i: 0.8, blink: 1.1, phase: 0.5 });
    out.lamps.push({ x: W * 0.92, y: top - 2, r: 5, color: 'rgb(80,255,140)', blink: 1.1, phase: 0.5 });
    // the airlock, low on the stern: hazard frame, a red light over it
    const ax = d.airlockX ?? W - 48;
    g.fillStyle = '#16191d';
    g.fillRect(ax - 44, -150, 88, 150);
    stripes(g, ax - 44, -150, 88, 10, 0.95);
    stripes(g, ax - 44, -150, 8, 150, 0.95);
    stripes(g, ax + 36, -150, 8, 150, 0.95);
    g.fillStyle = 'rgba(225,215,180,0.7)';
    g.font = 'bold 12px monospace';
    g.fillText('AIRLOCK 2', ax - 32, -158);
    out.lights.push({ x: ax, y: -168, r: 120, color: 'rgb(255,60,40)', i: 0.7, blink: 0.8 });
    out.lamps.push({ x: ax, y: -168, r: 4, color: 'rgb(255,70,50)', blink: 0.8 });
    // smoke and steam still leaking from seams
    out.steam.push({ x: W * 0.15, y: -H * 0.25, w: 60 });
    out.steam.push({ x: W * 0.55, y: top - 10, w: 40 });
    return { x0: -40, y0: -H * 1.45, x1: W + 40, y1: 6 };
  },
};
