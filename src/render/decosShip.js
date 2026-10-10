import { TILE } from '../config.js';
import { mulberry32 } from '../core/math.js';

// Chapter III, inside: the MSV Tethys (a human salvage ship — steel, strip
// lights, the crew's things), the alien derelict fused into it (bone), and the
// cargo bay where the creature has made its nest.
//
// Lights and lamps can carry `power`: 'main' ones die when the ship's power
// fails; 'emergency' ones only come on after it does.

const STEEL = '#262c33';
const STEEL_D = '#14181d';
const STEEL_L = '#424b55';
const BONE = '#1a2523';
const BONE_L = '#2c3b38';

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

function bodyInOveralls(g, rnd, { lying = false, flip = 1 } = {}) {
  // a crew member: grey-blue overalls, one boot, a slack hand
  g.save();
  g.scale(flip, 1);
  g.fillStyle = '#3a4250';
  g.strokeStyle = '#121418';
  g.lineWidth = 1.2;
  if (lying) {
    g.beginPath();
    g.ellipse(0, -8, 26, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#c6a48a';
    g.beginPath();
    g.arc(30, -8, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a4250';
    g.fillRect(-46, -10, 22, 6);
  } else {
    // slumped against the wall, head lolled
    g.beginPath();
    g.moveTo(-12, 0);
    g.lineTo(-10, -34);
    g.quadraticCurveTo(0, -42, 10, -34);
    g.lineTo(12, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#c6a48a';
    g.beginPath();
    g.arc(6, -44, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5a4030';
    g.beginPath();
    g.arc(4, -47, 7, Math.PI, 0);
    g.fill();
    g.fillStyle = '#3a4250';
    g.fillRect(8, -6, 26, 6); // legs out along the floor
    g.fillStyle = '#16181c';
    g.fillRect(32, -9, 6, 9);
  }
  g.restore();
}

export const SHIP_PAINTERS = {
  // ── Lighting ─────────────────────────────────────────────
  tubeLight(g, d, out) {
    const W = (d.w || 2) * TILE;
    g.fillStyle = '#0d1014';
    g.fillRect(-W / 2, 0, W, 7);
    g.fillStyle = STEEL_L;
    g.fillRect(-W / 2, 0, W, 2);
    g.fillStyle = '#c9d4dc';
    g.fillRect(-W / 2 + 4, 4, W - 8, 3);
    out.lights.push({ x: 0, y: 14, r: d.r || 230, color: 'rgb(210,225,235)', i: 0.75, power: 'main', flicker: !!d.flicker });
    out.lamps.push({ x: -W / 2 + 4, y: 4, w: W - 8, h: 3, color: 'rgba(225,240,255,0.95)', power: 'main', flicker: !!d.flicker });
    return { x0: -W / 2 - 2, y0: -2, x1: W / 2 + 2, y1: 10 };
  },

  emergencyLight(g, d, out) {
    g.fillStyle = '#1a1c20';
    g.fillRect(-7, -7, 14, 12);
    g.fillStyle = '#4a0c0c';
    g.beginPath();
    g.arc(0, -1, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a2d32';
    g.lineWidth = 1;
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(-5, -1 + k * 3);
      g.lineTo(5, -1 + k * 3);
      g.stroke();
    }
    out.lights.push({ x: 0, y: 0, r: d.r || 260, color: 'rgb(255,40,30)', i: 0.8, power: 'emergency', strobe: true });
    out.lamps.push({ x: 0, y: -1, r: 4, color: 'rgb(255,60,40)', power: 'emergency', strobe: true });
    return { x0: -9, y0: -9, x1: 9, y1: 7 };
  },

  // ── The crew's ship ──────────────────────────────────────
  evaSuit(g, d) {
    const rnd = mulberry32(d.x + 1);
    const n = d.n || 2;
    for (let i = 0; i < n; i++) {
      const x = i * 44;
      g.fillStyle = '#121418';
      g.fillRect(x - 2, -120, 4, 14); // hook
      // suit: bulky, off-white, orange cuffs
      g.fillStyle = '#b9bcbf';
      g.strokeStyle = '#2a2d31';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(x, -96, 14, 13, 0, 0, Math.PI * 2); // helmet
      g.fill();
      g.stroke();
      g.fillStyle = '#20262c';
      g.beginPath();
      g.ellipse(x + 3, -96, 9, 8, 0, 0, Math.PI * 2); // visor
      g.fill();
      g.fillStyle = 'rgba(200,220,240,0.35)';
      g.fillRect(x, -101, 6, 2);
      g.fillStyle = '#a9adb1';
      g.beginPath();
      g.roundRect(x - 16, -84, 32, 40, 6);
      g.fill();
      g.stroke();
      g.fillRect(x - 13, -44, 11, 36);
      g.fillRect(x + 2, -44, 11, 36);
      g.fillStyle = '#c4581e';
      g.fillRect(x - 16, -70, 32, 4);
      g.fillRect(x - 13, -14, 11, 4);
      g.fillRect(x + 2, -14, 11, 4);
      g.fillStyle = '#596068';
      g.fillRect(x - 8, -78, 16, 10); // chest unit
      if (rnd() < 0.5) {
        g.fillStyle = 'rgba(120,255,140,0.8)';
        g.fillRect(x - 5, -75, 2, 2);
      }
    }
    return { x0: -24, y0: -124, x1: n * 44, y1: 2 };
  },

  sign(g, d) {
    const text = d.text || 'DECK B';
    g.font = 'bold 13px monospace';
    const w = g.measureText ? Math.max(60, text.length * 8.4 + 20) : 120;
    g.fillStyle = '#0f1216';
    g.fillRect(0, -22, w, 22);
    g.strokeStyle = STEEL_L;
    g.lineWidth = 1.5;
    g.strokeRect(0, -22, w, 22);
    stripes(g, 0, -22, 6, 22, 0.8);
    g.fillStyle = 'rgba(230,220,190,0.85)';
    g.fillText(text, 12, -7);
    if (d.arrow) {
      g.beginPath();
      g.moveTo(w - 16, -15);
      g.lineTo(w - 8, -11);
      g.lineTo(w - 16, -7);
      g.fill();
    }
    return { x0: -2, y0: -24, x1: w + 2, y1: 2 };
  },

  // Hypersleep: a row of pods with frosted lids. One opened from the inside.
  cryoPods(g, d, out) {
    const rnd = mulberry32(d.x + 3);
    const n = d.n || 4;
    for (let i = 0; i < n; i++) {
      const x = i * 70;
      // plinth
      g.fillStyle = STEEL_D;
      g.fillRect(x, -22, 60, 22);
      g.fillStyle = STEEL_L;
      g.fillRect(x, -22, 60, 2);
      // pod body
      g.fillStyle = '#d3d6d9';
      g.beginPath();
      g.roundRect(x - 2, -44, 64, 24, 12);
      g.fill();
      g.strokeStyle = '#3a3f45';
      g.lineWidth = 1.5;
      g.stroke();
      const broken = i === d.broken;
      if (broken) {
        // lid burst upward, glass everywhere, the bed inside stained dark
        g.fillStyle = '#1a0c0e';
        g.beginPath();
        g.ellipse(x + 30, -42, 24, 6, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(200,230,255,0.6)';
        g.lineWidth = 1;
        for (let k = 0; k < 8; k++) {
          const sx = x + 10 + rnd() * 40;
          g.beginPath();
          g.moveTo(sx, -48);
          g.lineTo(sx + (rnd() - 0.5) * 16, -60 - rnd() * 14);
          g.stroke();
        }
        g.fillStyle = 'rgba(90,10,18,0.7)';
        g.beginPath();
        g.ellipse(x + 30, -20, 30, 3, 0, 0, Math.PI * 2);
        g.fill();
      } else {
        // frosted glass lid with a cold glow inside
        g.fillStyle = 'rgba(150,200,230,0.45)';
        g.beginPath();
        g.roundRect(x + 6, -54, 48, 14, 7);
        g.fill();
        g.strokeStyle = 'rgba(220,240,255,0.5)';
        g.stroke();
        out.lights.push({ x: x + 30, y: -48, r: 70, color: 'rgb(140,200,255)', i: 0.45, power: 'main' });
      }
      g.fillStyle = 'rgba(120,255,140,0.8)';
      if (!broken) g.fillRect(x + 50, -30, 3, 3);
      else {
        g.fillStyle = 'rgba(255,60,40,0.9)';
        g.fillRect(x + 50, -30, 3, 3);
      }
    }
    return { x0: -6, y0: -80, x1: n * 70, y1: 2 };
  },

  // The mess: a long table, chairs knocked flat — and what happened at dinner.
  messTable(g, d) {
    const rnd = mulberry32(d.x + 5);
    const W = 220;
    // blood flung up the wall behind
    g.fillStyle = 'rgba(80,6,14,0.5)';
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI * (0.15 + rnd() * 0.7);
      const r = 30 + rnd() * 110;
      g.beginPath();
      g.ellipse(W * 0.55 + Math.cos(a) * r, -40 + Math.sin(a) * r, 2 + rnd() * 4, 1.5 + rnd() * 2, a, 0, Math.PI * 2);
      g.fill();
    }
    // table
    g.fillStyle = '#5a6068';
    g.fillRect(0, -38, W, 6);
    g.fillStyle = STEEL_D;
    g.fillRect(10, -32, 6, 32);
    g.fillRect(W - 16, -32, 6, 32);
    // cups, a tray, a cereal box
    g.fillStyle = '#d7d2c4';
    g.fillRect(20, -46, 7, 8);
    g.fillRect(170, -45, 7, 7);
    g.fillStyle = '#c4581e';
    g.fillRect(190, -54, 12, 16);
    // the body under a sheet, the chest torn open from inside
    g.fillStyle = '#c8c9c6';
    g.beginPath();
    g.moveTo(60, -38);
    g.quadraticCurveTo(70, -56, 100, -52);
    g.quadraticCurveTo(122, -60, 140, -50);
    g.quadraticCurveTo(156, -48, 160, -38);
    g.fill();
    g.fillStyle = '#3a0a10';
    g.beginPath();
    g.ellipse(112, -55, 10, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#d9d0c0';
    g.lineWidth = 1.5;
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.moveTo(112 + k * 4, -56);
      g.lineTo(112 + k * 6, -66);
      g.stroke();
    }
    g.fillStyle = 'rgba(80,6,14,0.75)';
    g.beginPath();
    g.ellipse(112, -40, 46, 3, 0, 0, Math.PI * 2);
    g.fill();
    // chairs on their backs
    for (const [cx, rot] of [[-20, 1.4], [W + 20, -1.6], [W * 0.4, 1.7]]) {
      g.save();
      g.translate(cx, -6);
      g.rotate(rot);
      g.fillStyle = '#4a5058';
      g.fillRect(-10, -2, 20, 4);
      g.fillRect(-10, -18, 4, 18);
      g.restore();
    }
    return { x0: -50, y0: -170, x1: W + 50, y1: 4 };
  },

  deadCrew(g, d) {
    const rnd = mulberry32(d.x + 7);
    bodyInOveralls(g, rnd, { lying: d.lying, flip: d.flip ? -1 : 1 });
    g.fillStyle = 'rgba(80,6,14,0.6)';
    g.beginPath();
    g.ellipse(0, 0, 30, 3, 0, 0, Math.PI * 2);
    g.fill();
    return { x0: -60, y0: -60, x1: 60, y1: 4 };
  },

  lockers(g, d) {
    const n = d.n || 4;
    for (let i = 0; i < n; i++) {
      const x = i * 30;
      g.fillStyle = '#2e353d';
      g.fillRect(x, -96, 28, 96);
      g.strokeStyle = '#0d1014';
      g.lineWidth = 1.5;
      g.strokeRect(x, -96, 28, 96);
      g.fillStyle = '#0d1014';
      for (let k = 0; k < 4; k++) g.fillRect(x + 6, -88 + k * 4, 16, 1.5);
      g.fillStyle = STEEL_L;
      g.fillRect(x + 22, -52, 3, 10);
      g.fillStyle = 'rgba(230,220,190,0.3)';
      g.font = 'bold 8px monospace';
      g.fillText(`0${i + 1}`, x + 8, -60);
      if (i === d.ajar) {
        g.fillStyle = '#05070a';
        g.fillRect(x + 2, -94, 10, 92);
      }
    }
    return { x0: -2, y0: -98, x1: n * 30 + 2, y1: 2 };
  },

  // A round window: snow falling past it, the aurora beyond. Outside is still there.
  porthole(g, d) {
    const r = d.r || 24;
    const rnd = mulberry32(d.x + 9);
    g.save();
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.clip();
    const sky = g.createLinearGradient(0, -r, 0, r);
    sky.addColorStop(0, '#050a16');
    sky.addColorStop(1, '#1c2c4c');
    g.fillStyle = sky;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.fillStyle = 'rgba(120,255,190,0.25)';
    g.fillRect(-r, -r * 0.5, r * 2, r * 0.25);
    g.fillStyle = '#0d1828';
    g.beginPath();
    g.moveTo(-r, r);
    g.lineTo(-r * 0.4, r * 0.2);
    g.lineTo(r * 0.2, r * 0.5);
    g.lineTo(r, 0);
    g.lineTo(r, r);
    g.fill();
    g.fillStyle = '#eef4ff';
    for (let i = 0; i < 14; i++) g.fillRect((rnd() - 0.5) * r * 2, (rnd() - 0.5) * r * 2, 1.4, 1.4);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.ellipse(-r * 0.3, -r * 0.35, r * 0.5, r * 0.18, -0.6, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = '#4a535c';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(0, 0, r + 3, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#6a737c';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.fillRect(Math.cos(a) * (r + 3) - 1, Math.sin(a) * (r + 3) - 1, 2, 2);
    }
    return { x0: -r - 8, y0: -r - 8, x1: r + 8, y1: r + 8 };
  },

  pipesV(g, d) {
    const H = (d.h || 6) * TILE;
    for (let k = 0; k < 3; k++) {
      const x = k * 12;
      g.fillStyle = '#0b0d10';
      g.fillRect(x - 1, -H, 10, H);
      g.fillStyle = k === 1 ? '#3a2e24' : '#262c33';
      g.fillRect(x, -H, 8, H);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x + 1, -H, 1.5, H);
      for (let y = -H + 20; y < 0; y += 70) {
        g.fillStyle = STEEL_L;
        g.fillRect(x - 2, y, 12, 5);
      }
    }
    g.fillStyle = '#8a2020';
    g.beginPath();
    g.arc(18, -H * 0.45, 6, 0, Math.PI * 2); // a valve wheel
    g.fill();
    return { x0: -4, y0: -H - 2, x1: 40, y1: 2 };
  },

  // A grated window into a lit service bay behind the wall. Something will cross it.
  grateWindow(g, d, out) {
    const W = (d.w || 4) * TILE;
    const H = (d.h || 3) * TILE;
    g.fillStyle = '#0b0d10';
    g.fillRect(-6, -H - 6, W + 12, 6);
    g.fillRect(-6, 0, W + 12, 6);
    g.fillRect(-6, -H - 6, 6, H + 12);
    g.fillRect(W, -H - 6, 6, H + 12);
    g.fillStyle = STEEL_L;
    g.fillRect(-6, -H - 6, W + 12, 2);
    // bars
    g.fillStyle = '#14181d';
    for (let x = 10; x < W; x += 14) g.fillRect(x, -H, 4, H);
    g.fillRect(0, -H / 2 - 2, W, 4);
    out.windows.push({ x: 0, y: -H, w: W, h: H });
    return { x0: -8, y0: -H - 8, x1: W + 8, y1: 8 };
  },

  crates(g, d) {
    const rnd = mulberry32(d.x + 13);
    const n = d.n || 3;
    let x = 0;
    for (let i = 0; i < n; i++) {
      const w = 40 + rnd() * 24;
      const h = 30 + rnd() * 24;
      const stack = rnd() < 0.4 && i > 0;
      const y = stack ? -h - 34 : -h;
      g.fillStyle = ['#3a3f2a', '#2f3640', '#4a3a26'][i % 3];
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#0d0f12';
      g.lineWidth = 1.5;
      g.strokeRect(x, y, w, h);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y + h);
      g.stroke();
      g.fillStyle = 'rgba(230,220,190,0.35)';
      g.font = 'bold 8px monospace';
      g.fillText('TETHYS', x + 4, y + 12);
      if (!stack) x += w + 4;
    }
    return { x0: -2, y0: -130, x1: x + 70, y1: 2 };
  },

  consoleBank(g, d, out) {
    const n = d.n || 3;
    for (let i = 0; i < n; i++) {
      const x = i * 46;
      g.fillStyle = '#2a3038';
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, -40);
      g.lineTo(x + 8, -64);
      g.lineTo(x + 40, -64);
      g.lineTo(x + 42, 0);
      g.fill();
      g.fillStyle = '#05100a';
      g.fillRect(x + 10, -60, 28, 18);
      g.fillStyle = 'rgba(120,255,140,0.7)';
      for (let k = 0; k < 4; k++) g.fillRect(x + 13, -57 + k * 4, 6 + ((i * 7 + k * 5) % 16), 1.5);
      g.fillStyle = '#4a535c';
      for (let k = 0; k < 6; k++) g.fillRect(x + 6 + k * 5, -34, 3, 3);
      out.lamps.push({ x: x + 10, y: -60, w: 28, h: 18, color: 'rgba(90,255,130,0.25)', power: 'main', flicker: i === 1 });
      out.lights.push({ x: x + 24, y: -50, r: 70, color: 'rgb(110,255,150)', i: 0.35, power: 'main' });
    }
    return { x0: -2, y0: -68, x1: n * 46, y1: 2 };
  },

  bloodSmear(g, d) {
    const rnd = mulberry32(d.x + 15);
    const W = (d.w || 2) * TILE;
    g.strokeStyle = 'rgba(70,4,12,0.65)';
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      g.lineWidth = 3 + rnd() * 4;
      g.beginPath();
      const y = -(d.high ? 50 : 4) - i * 4;
      g.moveTo(0, y);
      g.quadraticCurveTo(W * 0.5, y + (rnd() - 0.5) * 8, W, y + (rnd() - 0.5) * 10);
      g.stroke();
    }
    return { x0: -10, y0: -80, x1: W + 10, y1: 6 };
  },

  // Black resin creeping over the steel; denser the closer you are to the nest.
  resinCreep(g, d) {
    const rnd = mulberry32(d.x + 17);
    const W = (d.w || 4) * TILE;
    const H = (d.h || 5) * TILE;
    const k = d.density ?? 0.5;
    g.fillStyle = 'rgba(7,10,10,0.9)';
    for (let i = 0; i < 10 * k + 3; i++) {
      g.beginPath();
      g.ellipse(rnd() * W, -rnd() * H, 12 + rnd() * 30 * k, 10 + rnd() * 26 * k, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(12,18,17,0.95)';
    g.lineCap = 'round';
    for (let i = 0; i < 16 * k + 4; i++) {
      const x = rnd() * W;
      const y = -rnd() * H;
      g.lineWidth = 2 + rnd() * 5;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + (rnd() - 0.5) * 40, y + 20, x + (rnd() - 0.5) * 40, y + 40, x + (rnd() - 0.5) * 30, y + 60 * k);
      g.stroke();
    }
    g.strokeStyle = 'rgba(150,200,190,0.18)';
    g.lineWidth = 1;
    for (let i = 0; i < 10 * k + 2; i++) {
      g.beginPath();
      g.arc(rnd() * W, -rnd() * H, 5 + rnd() * 14, 3.5, 5.2);
      g.stroke();
    }
    return { x0: -40, y0: -H - 30, x1: W + 40, y1: 40 };
  },

  // ── The derelict ─────────────────────────────────────────
  ribArch(g, d) {
    const H = (d.h || 10) * TILE;
    const W = (d.w || 3) * TILE;
    const grad = g.createLinearGradient(-W, 0, W, 0);
    grad.addColorStop(0, 'rgba(14,22,21,0.95)');
    grad.addColorStop(0.5, BONE_L);
    grad.addColorStop(1, 'rgba(14,22,21,0.95)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-W / 2 - 10, 0);
    g.bezierCurveTo(-W / 2 - 20, -H * 0.6, -W / 4, -H * 0.98, W / 2, -H);
    g.lineTo(W / 2 + 10, -H + 22);
    g.bezierCurveTo(-W / 4 + 18, -H * 0.86, -W / 2 + 10, -H * 0.55, -W / 2 + 14, 0);
    g.fill();
    g.strokeStyle = 'rgba(140,200,180,0.18)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-W / 2 - 6, -10);
    g.bezierCurveTo(-W / 2 - 14, -H * 0.6, -W / 4 + 4, -H * 0.95, W / 2, -H + 4);
    g.stroke();
    // knuckles along it
    g.fillStyle = BONE;
    for (let k = 1; k < 7; k++) {
      const u = k / 7;
      const x = -W / 2 - 10 + u * (W * 0.8) - Math.sin(u * Math.PI) * 10;
      const y = -H * Math.sin((u * Math.PI) / 2) * 0.96;
      g.beginPath();
      g.ellipse(x + 8, y + 6, 9, 6, 0.5, 0, Math.PI * 2);
      g.fill();
    }
    return { x0: -W - 30, y0: -H - 10, x1: W + 30, y1: 4 };
  },

  // The Pilot: something vast, fossilised in its seat at the controls of a
  // great tilted instrument — its chest burst outward long ago.
  pilot(g, d, out) {
    const S = d.scale || 1;
    g.save();
    g.scale(S, S);
    // dais
    g.fillStyle = BONE;
    g.beginPath();
    g.ellipse(0, -10, 190, 24, 0, Math.PI, 0);
    g.fill();
    g.strokeStyle = 'rgba(140,200,180,0.2)';
    g.lineWidth = 2;
    for (let k = 1; k < 6; k++) {
      g.beginPath();
      g.ellipse(0, -10, 190 - k * 30, 24 - k * 4, 0, Math.PI, 0);
      g.stroke();
    }
    // the instrument: a ribbed barrel tilted up and away
    g.save();
    g.translate(30, -150);
    g.rotate(-0.65);
    const bar = g.createLinearGradient(0, -60, 0, 60);
    bar.addColorStop(0, BONE_L);
    bar.addColorStop(0.5, BONE);
    bar.addColorStop(1, '#0a100f');
    g.fillStyle = bar;
    g.beginPath();
    g.moveTo(-40, -46);
    g.lineTo(300, -30);
    g.quadraticCurveTo(320, 0, 300, 30);
    g.lineTo(-40, 46);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 3;
    for (let x = 0; x < 300; x += 22) {
      g.beginPath();
      g.moveTo(x, -44 + x * 0.05);
      g.lineTo(x, 44 - x * 0.05);
      g.stroke();
    }
    g.fillStyle = '#050807';
    g.beginPath();
    g.ellipse(306, 0, 10, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // the seat: a great flared back
    g.fillStyle = '#121a19';
    g.beginPath();
    g.moveTo(-150, -10);
    g.quadraticCurveTo(-190, -160, -120, -260);
    g.quadraticCurveTo(-60, -280, -40, -180);
    g.lineTo(-30, -10);
    g.fill();
    // the Pilot: elephantine head, a ribbed trunk running into the controls
    g.fillStyle = '#2a3532';
    g.beginPath();
    g.ellipse(-70, -120, 46, 70, -0.2, 0, Math.PI * 2); // torso
    g.fill();
    g.beginPath();
    g.ellipse(-50, -206, 34, 30, 0, 0, Math.PI * 2); // head
    g.fill();
    g.strokeStyle = '#2a3532';
    g.lineWidth = 14;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-26, -196);
    g.bezierCurveTo(10, -190, 10, -160, 30, -150);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      g.arc(-12 + k * 6, -184 + k * 5, 6, 0, Math.PI);
      g.stroke();
    }
    g.fillStyle = '#050807';
    g.beginPath();
    g.ellipse(-42, -212, 8, 6, 0, 0, Math.PI * 2); // empty eye
    g.fill();
    // its chest, burst outward: ribs bent back like petals
    g.fillStyle = '#050807';
    g.beginPath();
    g.ellipse(-56, -122, 16, 22, -0.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3a4844';
    g.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      const a = -1.2 + k * 0.5;
      g.beginPath();
      g.moveTo(-56 + Math.cos(a) * 14, -122 + Math.sin(a) * 20);
      g.quadraticCurveTo(-56 + Math.cos(a) * 26, -122 + Math.sin(a) * 30, -56 + Math.cos(a) * 30 + 8, -122 + Math.sin(a) * 26);
      g.stroke();
    }
    g.restore();
    out.lights.push({ x: 0, y: -300 * S, r: 460 * S, color: 'rgb(90,200,170)', i: 0.4, flicker: true });
    out.lights.push({ x: -60 * S, y: -200 * S, r: 200 * S, color: 'rgb(120,220,190)', i: 0.35 });
    return { x0: -220 * S, y0: -420 * S, x1: 360 * S, y1: 10 };
  },

  // A cold blue shaft of light from a hole far above, lying across the egg chamber.
  lightShaft(g, d, out) {
    const W = (d.w || 4) * TILE;
    const H = (d.h || 16) * TILE;
    out.shafts.push({ x: 0, y: -H, w: W, h: H });
    out.lights.push({ x: W / 2, y: -H * 0.2, r: H * 0.45, color: 'rgb(120,170,255)', i: 0.4 });
    return { x0: 0, y0: -H, x1: 1, y1: 0 };
  },

  // ── The nest ─────────────────────────────────────────────
  craneRail(g, d) {
    const W = d.w * TILE;
    g.fillStyle = '#0b0d10';
    g.fillRect(0, 0, W, 16);
    g.fillStyle = '#2a3038';
    g.fillRect(0, 2, W, 4);
    g.fillRect(0, 12, W, 4);
    g.fillStyle = '#1a1e23';
    for (let x = 0; x < W; x += 40) {
      g.beginPath();
      g.moveTo(x, 6);
      g.lineTo(x + 20, 12);
      g.lineTo(x + 40, 6);
      g.stroke();
    }
    stripes(g, 0, -6, W, 6, 0.6);
    return { x0: -2, y0: -8, x1: W + 2, y1: 18 };
  },

  cargoContainer(g, d) {
    const W = (d.w || 6) * TILE;
    const H = (d.h || 4) * TILE;
    g.fillStyle = d.color || '#3a2a20';
    g.fillRect(0, -H, W, H);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 6; x < W; x += 12) g.fillRect(x, -H + 4, 4, H - 8);
    g.strokeStyle = '#0b0c0e';
    g.lineWidth = 3;
    g.strokeRect(0, -H, W, H);
    g.fillStyle = 'rgba(230,220,190,0.4)';
    g.font = 'bold 16px monospace';
    g.fillText(d.text || 'TETHYS · CARGO', 14, -H + 26);
    return { x0: -2, y0: -H - 2, x1: W + 2, y1: 2 };
  },

  cocoonWall(g, d, out) {
    const rnd = mulberry32(d.x + 19);
    const W = (d.w || 6) * TILE;
    const H = (d.h || 6) * TILE;
    SHIP_PAINTERS.resinCreep(g, { x: d.x, w: d.w || 6, h: d.h || 6, density: 1 }, out);
    const n = d.n || 4;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * W) / n + (rnd() - 0.5) * 20;
      const y = -H * (0.35 + rnd() * 0.3);
      g.fillStyle = '#0e1413';
      g.beginPath();
      g.ellipse(x, y, 20, 48, (rnd() - 0.5) * 0.3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(140,190,180,0.2)';
      g.lineWidth = 1.2;
      g.stroke();
      // a face pressed into the resin
      g.fillStyle = 'rgba(190,170,150,0.4)';
      g.beginPath();
      g.ellipse(x, y - 30, 8, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.75)';
      g.fillRect(x - 4.5, y - 33, 2.5, 3);
      g.fillRect(x + 2, y - 33, 2.5, 3);
      g.fillRect(x - 2, y - 26, 4, 3);
      out.lights.push({ x, y, r: 70, color: 'rgb(90,200,160)', i: 0.15 });
    }
    return { x0: -40, y0: -H - 30, x1: W + 40, y1: 40 };
  },
};
