import { TILE } from '../config.js';
import { mulberry32 } from '../core/math.js';
import { roofPath, makeCanvas, drawFire, drawFlame, glow } from './shapes.js';
import { SEA_PAINTERS } from './decosSea.js';

// Background props painted once into sprites. Each prop can also declare
// fires (animated every frame) and lights (fed to the lighting pass).

const C = {
  wood: '#2b1a16',
  woodDark: '#1a100d',
  woodLight: '#3d2720',
  plaster: '#3b2d2c',
  plasterDark: '#2a1f20',
  roof: '#1b1519',
  roofLight: '#2c2329',
  lattice: '#140d0c',
  vermilion: '#7e2420',
  vermilionLight: '#a3362b',
  stone: '#38323b',
  stoneLight: '#4b4450',
  pine: '#121915',
};

const PAINTERS = {
  house(g, d, out) {
    const W = d.w * TILE;
    const H = d.h * TILE;
    const two = d.h >= 7;
    const wallTop = -H;
    // body
    g.fillStyle = C.plasterDark;
    g.fillRect(0, wallTop, W, H);
    // timber frame
    g.fillStyle = C.wood;
    const posts = Math.max(2, Math.round(W / 70));
    for (let i = 0; i <= posts; i++) g.fillRect((i * (W - 8)) / posts, wallTop, 8, H);
    g.fillRect(0, wallTop + 6, W, 7);
    if (two) g.fillRect(0, -H * 0.5, W, 8);
    // plaster panels (upper)
    g.fillStyle = C.plaster;
    for (let i = 0; i < posts; i++) {
      const x = (i * (W - 8)) / posts + 10;
      const w = (W - 8) / posts - 12;
      g.fillRect(x, wallTop + 16, w, two ? H * 0.5 - 22 : H * 0.35);
    }
    // lattice (koshi) windows on the ground floor
    g.fillStyle = C.lattice;
    const winY = -H * (two ? 0.42 : 0.55);
    for (let i = 0; i < posts; i++) {
      if (i === Math.floor(posts / 2)) continue;
      const x = (i * (W - 8)) / posts + 12;
      const w = (W - 8) / posts - 16;
      g.fillRect(x, winY, w, H * 0.28);
      g.fillStyle = 'rgba(255,140,60,0.18)';
      g.fillRect(x + 2, winY + 2, w - 4, H * 0.28 - 4);
      g.fillStyle = C.woodLight;
      for (let lx = x + 4; lx < x + w - 2; lx += 6) g.fillRect(lx, winY, 1.6, H * 0.28);
      g.fillStyle = C.lattice;
    }
    // doorway + noren curtain
    const dx = (Math.floor(posts / 2) * (W - 8)) / posts + 12;
    const dw = (W - 8) / posts - 16;
    g.fillStyle = '#0b0607';
    g.fillRect(dx, -H * 0.45, dw, H * 0.45);
    g.fillStyle = '#3a1f3f';
    for (let i = 0; i < 3; i++) g.fillRect(dx + (i * dw) / 3 + 1, -H * 0.45, dw / 3 - 2, H * 0.16);
    // roofs
    g.fillStyle = C.roof;
    g.beginPath();
    roofPath(g, -6, wallTop + 4, W + 12, 44, 0.08);
    g.fill();
    tileLines(g, -6, wallTop + 4, W + 12, 44);
    if (two) {
      g.fillStyle = C.roof;
      g.beginPath();
      roofPath(g, -14, -H * 0.5 + 6, W + 28, 18, 0.05);
      g.fill();
    }
    // charring from the fire
    if (d.burning) {
      const grad = g.createLinearGradient(0, wallTop - 40, 0, wallTop + H * 0.5);
      grad.addColorStop(0, 'rgba(0,0,0,0.6)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(-10, wallTop - 50, W + 20, H * 0.5 + 50);
      const rnd = mulberry32(d.x);
      for (let i = 0; i < Math.round(W / 50); i++) {
        const fx = 10 + rnd() * (W - 20);
        out.fires.push({ x: fx, y: wallTop - 20 - rnd() * 10, w: 34 + rnd() * 20, h: 50 + rnd() * 30 });
      }
      out.fires.push({ x: W * 0.3, y: winY + H * 0.28, w: 26, h: 30 });
      out.lights.push({ x: W / 2, y: wallTop - 30, r: 260, color: 'rgb(255,130,60)', i: 0.9 });
    } else {
      out.lights.push({ x: W / 2, y: winY + 10, r: 110, color: 'rgb(255,150,80)', i: 0.4 });
    }
    return { x0: -40, y0: wallTop - 70, x1: W + 40, y1: 4 };
  },

  pagoda(g, d, out) {
    // Tiers line up with the climbing beams: roof eaves at rows 33, 28, 23, 18 (relative -160 … -640).
    const widths = [380, 330, 290, 250, 210];
    for (let i = 0; i < 5; i++) {
      const base = -i * 160;
      const w = widths[i];
      const top = base - 160;
      g.fillStyle = i % 2 ? '#2a1514' : '#301816';
      g.fillRect(-w * 0.38, top + 20, w * 0.76, 140);
      // posts and railings
      g.fillStyle = C.woodDark;
      for (let k = 0; k <= 4; k++) g.fillRect(-w * 0.38 + (k * w * 0.76) / 4 - 3, top + 20, 6, 140);
      g.fillStyle = C.vermilion;
      g.fillRect(-w * 0.38, top + 132, w * 0.76, 5);
      g.fillStyle = 'rgba(255,140,60,0.22)';
      g.fillRect(-w * 0.2, top + 60, w * 0.4, 50);
      // roof whose eave sits at the beam row
      g.fillStyle = C.roof;
      g.beginPath();
      roofPath(g, -w / 2 - 20, top + 6, w + 40, 46, 0.12);
      g.fill();
      tileLines(g, -w / 2 - 20, top + 6, w + 40, 46);
    }
    // spire (sorin)
    g.fillStyle = '#4a3a2a';
    g.fillRect(-3, -950, 6, 160);
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.ellipse(0, -820 - k * 18, 12 - k, 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    out.fires.push({ x: -60, y: -650, w: 50, h: 70 }, { x: 70, y: -490, w: 40, h: 50 });
    out.lights.push({ x: 0, y: -600, r: 300, color: 'rgb(255,120,50)', i: 0.8 }, { x: 0, y: -200, r: 220, color: 'rgb(255,140,70)', i: 0.45 });
    return { x0: -260, y0: -980, x1: 260, y1: 4 };
  },

  dojo(g, d, out) {
    const W = d.w * TILE;
    const H = d.h * TILE;
    // interior back wall
    g.fillStyle = '#21130f';
    g.fillRect(0, -H, W, H);
    g.fillStyle = C.wood;
    for (let x = 0; x < W; x += 76) g.fillRect(x, -H, 10, H);
    g.fillRect(0, -H, W, 10);
    g.fillRect(0, -52, W, 6);
    // hanging scrolls
    for (const sx of [120, 330, 470]) {
      if (sx > W - 40) continue;
      g.fillStyle = '#d3c7a6';
      g.fillRect(sx, -H + 30, 26, 80);
      g.fillStyle = '#1a1210';
      g.fillRect(sx - 3, -H + 28, 32, 4);
      g.fillRect(sx - 3, -H + 108, 32, 4);
      g.fillRect(sx + 11, -H + 44, 3, 50);
      g.fillRect(sx + 6, -H + 56, 13, 3);
    }
    // weapon rack
    g.fillStyle = C.woodLight;
    g.fillRect(230, -110, 70, 5);
    g.fillRect(230, -80, 70, 5);
    g.fillStyle = '#5a5560';
    for (let i = 0; i < 4; i++) g.fillRect(238 + i * 16, -140, 3, 90);
    // torn shoji at the left
    g.fillStyle = '#4a3f38';
    g.fillRect(14, -H + 20, 70, H - 70);
    g.fillStyle = '#0d0807';
    g.beginPath();
    g.moveTo(30, -H + 40);
    g.lineTo(70, -H + 60);
    g.lineTo(45, -H + 110);
    g.lineTo(26, -H + 80);
    g.fill();
    g.strokeStyle = C.woodDark;
    g.lineWidth = 2;
    for (let x = 14; x <= 84; x += 17.5) {
      g.beginPath();
      g.moveTo(x, -H + 20);
      g.lineTo(x, -50);
      g.stroke();
    }
    for (let y = -H + 20; y <= -50; y += 22) {
      g.beginPath();
      g.moveTo(14, y);
      g.lineTo(84, y);
      g.stroke();
    }
    // a fallen beam
    g.fillStyle = C.woodDark;
    g.save();
    g.translate(W * 0.62, -60);
    g.rotate(-0.35);
    g.fillRect(-90, -6, 180, 12);
    g.restore();
    // exterior roof above the roof beam (row 31 → -224)
    g.fillStyle = C.roof;
    g.beginPath();
    roofPath(g, -10, -224, W + 20, 70, 0.06);
    g.fill();
    tileLines(g, -10, -224, W + 20, 70);
    // name board
    g.fillStyle = '#3a2418';
    g.fillRect(W / 2 - 46, -290, 92, 34);
    g.fillStyle = '#d9c9a0';
    g.font = '24px "Shippori Mincho", serif';
    g.textAlign = 'center';
    g.fillText('道場', W / 2, -264);
    out.lights.push({ x: W * 0.5, y: -120, r: 260, color: 'rgb(255,150,90)', i: 0.45 });
    out.fires.push({ x: W * 0.62 + 70, y: -84, w: 30, h: 36 });
    return { x0: -60, y0: -320, x1: W + 60, y1: 4 };
  },

  torii(g, d, out) {
    const s = d.scale || 1;
    const H = 150 * s;
    const W = 150 * s;
    const pillar = (x) => {
      g.fillStyle = C.vermilion;
      g.fillRect(x - 7 * s, -H, 14 * s, H);
      g.fillStyle = C.vermilionLight;
      g.fillRect(x - 7 * s, -H, 3 * s, H);
      g.fillStyle = '#0e0909';
      g.fillRect(x - 9 * s, -14 * s, 18 * s, 14 * s);
    };
    pillar(W * 0.22);
    pillar(W * 0.78);
    g.fillStyle = C.vermilion;
    g.fillRect(W * 0.08, -H * 0.78, W * 0.84, 10 * s);
    g.fillStyle = '#100808';
    g.beginPath();
    g.moveTo(-W * 0.06, -H - 14 * s);
    g.quadraticCurveTo(W * 0.5, -H + 4 * s, W * 1.06, -H - 14 * s);
    g.lineTo(W * 1.04, -H - 4 * s);
    g.quadraticCurveTo(W * 0.5, -H + 14 * s, -W * 0.04, -H - 4 * s);
    g.fill();
    g.fillStyle = C.vermilion;
    g.fillRect(W * 0.02, -H + 6 * s, W * 0.96, 9 * s);
    g.fillStyle = '#1a0f0f';
    g.fillRect(W * 0.46, -H + 12 * s, W * 0.08, H * 0.24);
    if (d.burning) {
      out.fires.push({ x: W * 0.22, y: -H + 10, w: 24, h: 36 }, { x: W * 0.9, y: -H - 4, w: 30, h: 40 });
      out.lights.push({ x: W / 2, y: -H, r: 220, color: 'rgb(255,120,50)', i: 0.8 });
    }
    return { x0: -W * 0.1, y0: -H - 30 * s, x1: W * 1.12, y1: 4 };
  },

  pine(g, d) {
    const s = d.scale || 1;
    g.strokeStyle = '#140d0c';
    g.lineCap = 'round';
    g.lineWidth = 12 * s;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(10 * s, -60 * s, -30 * s, -110 * s, 10 * s, -170 * s);
    g.stroke();
    g.lineWidth = 6 * s;
    g.beginPath();
    g.moveTo(-6 * s, -100 * s);
    g.quadraticCurveTo(-50 * s, -120 * s, -80 * s, -112 * s);
    g.moveTo(6 * s, -140 * s);
    g.quadraticCurveTo(50 * s, -150 * s, 72 * s, -160 * s);
    g.stroke();
    const pad = (x, y, rx, ry) => {
      g.fillStyle = C.pine;
      g.beginPath();
      g.ellipse(x * s, y * s, rx * s, ry * s, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,110,60,0.18)';
      g.beginPath();
      g.ellipse(x * s, (y - ry * 0.5) * s, rx * 0.8 * s, ry * 0.35 * s, 0, 0, Math.PI * 2);
      g.fill();
    };
    pad(-84, -120, 40, 14);
    pad(76, -166, 44, 15);
    pad(12, -182, 50, 18);
    pad(-30, -150, 30, 11);
    return { x0: -140 * s, y0: -220 * s, x1: 140 * s, y1: 6 };
  },

  stoneLantern(g) {
    g.fillStyle = C.stone;
    g.fillRect(-14, -8, 28, 8);
    g.fillRect(-5, -40, 10, 32);
    g.fillRect(-12, -46, 24, 6);
    g.fillStyle = C.stoneLight;
    g.fillRect(-10, -64, 20, 18);
    g.fillStyle = '#120b0b';
    g.fillRect(-5, -60, 10, 10);
    g.fillStyle = C.stone;
    g.beginPath();
    g.moveTo(-20, -64);
    g.lineTo(20, -64);
    g.lineTo(6, -78);
    g.lineTo(-6, -78);
    g.fill();
    g.fillRect(-3, -86, 6, 8);
    return { x0: -24, y0: -90, x1: 24, y1: 2 };
  },

  banner(g) {
    g.fillStyle = '#1a1010';
    g.fillRect(-2, -150, 4, 150);
    g.fillRect(-2, -150, 40, 3);
    g.fillStyle = '#2d1450';
    g.beginPath();
    g.moveTo(2, -147);
    g.lineTo(36, -147);
    g.lineTo(36, -50);
    g.lineTo(19, -60);
    g.lineTo(2, -50);
    g.fill();
    g.strokeStyle = '#b48cff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(19, -110, 10, 0, Math.PI * 2);
    g.moveTo(19, -122);
    g.lineTo(19, -98);
    g.moveTo(11, -104);
    g.lineTo(27, -116);
    g.stroke();
    return { x0: -6, y0: -156, x1: 42, y1: 2 };
  },

  fence(g, d) {
    const W = d.w * TILE;
    g.fillStyle = '#2a2418';
    for (let x = 0; x < W; x += 7) g.fillRect(x, -36 - ((x * 7) % 9), 5, 36 + ((x * 7) % 9));
    g.fillStyle = '#1a140c';
    g.fillRect(0, -28, W, 3);
    g.fillRect(0, -12, W, 3);
    return { x0: -2, y0: -48, x1: W + 2, y1: 2 };
  },

  roofline(g, d) {
    // Roof slopes hanging below a rooftop walkway, plus the house wall beneath.
    const W = d.w * TILE;
    const top = 2 * TILE - 6;
    const grad = g.createLinearGradient(0, top, 0, top + 260);
    grad.addColorStop(0, '#24171a');
    grad.addColorStop(1, 'rgba(20,12,14,0)');
    g.fillStyle = grad;
    g.fillRect(16, top + 40, W - 32, 260);
    g.fillStyle = C.roof;
    g.beginPath();
    g.moveTo(-6, top - 30);
    g.lineTo(W + 6, top - 30);
    g.lineTo(W + 48, top + 46);
    g.quadraticCurveTo(W + 56, top + 52, W + 60, top + 40);
    g.lineTo(W + 58, top + 56);
    g.lineTo(-58, top + 56);
    g.lineTo(-60, top + 40);
    g.quadraticCurveTo(-56, top + 52, -48, top + 46);
    g.closePath();
    g.fill();
    g.strokeStyle = C.roofLight;
    g.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      const y = top - 18 + k * 18;
      const spread = 6 + k * 12;
      g.beginPath();
      g.moveTo(-spread, y);
      g.lineTo(W + spread, y);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,130,70,0.25)';
    g.beginPath();
    g.moveTo(-58, top + 56);
    g.lineTo(W + 58, top + 56);
    g.stroke();
    return { x0: -70, y0: top - 40, x1: W + 70, y1: top + 310 };
  },

  ruins(g, d, out) {
    const W = d.w * TILE;
    const rnd = mulberry32(d.x + 5);
    g.fillStyle = '#140b0b';
    let x = 20;
    while (x < W - 40) {
      const h = 120 + rnd() * 160;
      g.fillRect(x, -h, 10, h);
      g.save();
      g.translate(x + 5, -h + 10);
      g.rotate((rnd() - 0.5) * 1.2);
      g.fillRect(-60, -4, 120, 8);
      g.restore();
      if (rnd() < 0.5) g.fillRect(x + 10, -h * 0.6, 50 + rnd() * 40, 7);
      out.fires.push({ x: x + 10, y: -4, w: 50, h: 70 + rnd() * 40 });
      x += 90 + rnd() * 90;
    }
    out.lights.push({ x: W / 2, y: -40, r: Math.min(700, W), color: 'rgb(255,100,40)', i: 1 });
    return { x0: -80, y0: -360, x1: W + 80, y1: 4 };
  },

  temple(g, d, out) {
    const W = d.w * TILE;
    // stone plinth
    g.fillStyle = '#251c20';
    g.fillRect(0, -40, W, 40);
    g.fillStyle = '#30262b';
    g.fillRect(-10, -48, W + 20, 10);
    // columns + walls
    g.fillStyle = '#271516';
    g.fillRect(30, -300, W - 60, 260);
    g.fillStyle = C.vermilion;
    for (let i = 0; i < 7; i++) {
      const x = 40 + (i * (W - 100)) / 6;
      g.fillRect(x, -300, 18, 260);
      g.fillStyle = C.vermilionLight;
      g.fillRect(x, -300, 4, 260);
      g.fillStyle = C.vermilion;
    }
    // great doors, smashed open
    g.fillStyle = '#0a0507';
    g.fillRect(W / 2 - 80, -230, 160, 190);
    g.fillStyle = '#3b1f17';
    g.save();
    g.translate(W / 2 - 80, -230);
    g.transform(1, 0.15, 0, 1, 0, 0);
    g.fillRect(-60, 0, 60, 190);
    g.restore();
    // purple summoning glow inside
    const grad = g.createRadialGradient(W / 2, -110, 10, W / 2, -110, 110);
    grad.addColorStop(0, 'rgba(160,80,255,0.55)');
    grad.addColorStop(1, 'rgba(160,80,255,0)');
    g.fillStyle = grad;
    g.fillRect(W / 2 - 80, -230, 160, 190);
    // two tiers of roof
    g.fillStyle = C.roof;
    g.beginPath();
    roofPath(g, -40, -296, W + 80, 110, 0.1);
    g.fill();
    tileLines(g, -40, -296, W + 80, 110);
    g.fillStyle = C.roof;
    g.beginPath();
    roofPath(g, W * 0.2, -420, W * 0.6, 70, 0.12);
    g.fill();
    for (const fx of [0.1, 0.3, 0.7, 0.92]) out.fires.push({ x: W * fx, y: -330 - fx * 30, w: 60, h: 90 });
    out.lights.push({ x: W / 2, y: -360, r: 520, color: 'rgb(255,120,50)', i: 1 });
    out.lights.push({ x: W / 2, y: -120, r: 240, color: 'rgb(170,90,255)', i: 0.6 });
    return { x0: -100, y0: -520, x1: W + 100, y1: 4 };
  },
};

Object.assign(PAINTERS, SEA_PAINTERS);

function tileLines(g, x, eaveY, w, rise) {
  // fire-lit rim along the roof outline
  g.save();
  g.strokeStyle = 'rgba(255,130,70,0.32)';
  g.lineWidth = 2;
  g.stroke();
  g.restore();
  g.save();
  g.clip();
  g.strokeStyle = C.roofLight;
  g.lineWidth = 1.4;
  for (let k = 1; k < 5; k++) {
    const y = eaveY - rise + (rise * 1.15 * k) / 5;
    g.beginPath();
    g.moveTo(x - w * 0.2, y);
    g.lineTo(x + w * 1.2, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,130,70,0.3)';
  g.beginPath();
  g.moveTo(x + w * 0.38, eaveY - rise + 1);
  g.lineTo(x + w * 0.62, eaveY - rise + 1);
  g.stroke();
  g.restore();
}

export class DecoLayer {
  constructor(level, scale) {
    this.scale = scale;
    this.items = [];
    this.fires = [];
    this.lights = [];
    this.beams = [];
    for (const d of level.decos) {
      const painter = PAINTERS[d.type];
      if (!painter) continue;
      const out = { fires: [], lights: [], beams: [] };
      // dry run to learn bounds + fires (cheap: draws into a 1x1 canvas)
      const probe = makeCanvas(1, 1).getContext('2d');
      const b = painter(probe, d, out);
      const item = { d, painter, b, sprite: null };
      this.items.push(item);
      for (const f of out.fires) this.fires.push({ ...f, x: d.x + f.x, y: d.y + f.y, seed: Math.random() * 100 });
      for (const l of out.lights) this.lights.push({ ...l, x: d.x + l.x, y: d.y + l.y });
      for (const b of out.beams) this.beams.push({ ...b, x: d.x + b.x, y: d.y + b.y });
    }
    // Tile-based fires: burning debris and barricades.
    this.level = level;
  }

  sprite(item) {
    if (item.sprite) return item.sprite;
    const { b, d, painter } = item;
    const c = makeCanvas((b.x1 - b.x0) * this.scale, (b.y1 - b.y0) * this.scale);
    const g = c.getContext('2d');
    g.scale(this.scale, this.scale);
    g.translate(-b.x0, -b.y0);
    painter(g, d, { fires: [], lights: [], beams: [] });
    item.sprite = c;
    return c;
  }

  draw(ctx, view) {
    for (const item of this.items) {
      const { b, d } = item;
      if (d.x + b.x1 < view.x0 || d.x + b.x0 > view.x1 || d.y + b.y1 < view.y0 || d.y + b.y0 > view.y1) continue;
      ctx.drawImage(this.sprite(item), d.x + b.x0, d.y + b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
  }

  drawFires(ctx, view, t, which = 'all') {
    if (which !== 'tiles') this.drawDecoFires(ctx, view, t);
    if (which !== 'decos') this.drawTileFires(ctx, view, t);
  }

  // Lighthouse beams sweep slowly; seen edge-on they flare across the sea.
  drawBeams(ctx, view, t) {
    for (const b of this.beams) {
      if (Math.abs(b.x - (view.x0 + view.x1) / 2) > b.len + 600) continue;
      const a = t * 0.55;
      const reach = Math.cos(a); // -1..1: which way it points, foreshortened
      const len = b.len * Math.abs(reach);
      const dir = reach >= 0 ? 1 : -1;
      const k = 0.35 + 0.65 * Math.abs(reach);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(b.x, b.y, b.x + dir * len, b.y);
      g.addColorStop(0, `rgba(255,240,200,${0.38 * k})`);
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 10);
      ctx.lineTo(b.x + dir * len, b.y - 10 - len * 0.12);
      ctx.lineTo(b.x + dir * len, b.y + 10 + len * 0.14);
      ctx.lineTo(b.x, b.y + 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      glow(ctx, b.x, b.y, 90, 'rgb(255,240,200)', 0.6 + 0.3 * Math.abs(Math.sin(a * 2)));
    }
  }

  drawDecoFires(ctx, view, t) {
    this.drawBeams(ctx, view, t);
    for (const f of this.fires) {
      if (f.x < view.x0 - 100 || f.x > view.x1 + 100 || f.y < view.y0 - 150 || f.y > view.y1 + 50) continue;
      glow(ctx, f.x, f.y - f.h * 0.3, f.w * 1.6, 'rgb(255,110,40)', 0.35);
      drawFire(ctx, f.x, f.y, f.w, f.h, t, f.seed);
    }
  }

  drawTileFires(ctx, view, t) {
    const L = this.level;
    const tx0 = Math.max(0, Math.floor(view.x0 / TILE));
    const tx1 = Math.min(L.w - 1, Math.floor(view.x1 / TILE));
    const ty0 = Math.max(0, Math.floor(view.y0 / TILE));
    const ty1 = Math.min(L.h - 1, Math.floor(view.y1 / TILE) + 1);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const t2 = L.grid[ty][tx];
        if (t2 === '^') drawFire(ctx, tx * TILE + 16, ty * TILE + 24, 30, 40, t, tx * 7.3 + ty);
        else if (t2 === 'X') {
          if (L.tileAt(tx, ty - 1) !== 'X') drawFire(ctx, tx * TILE + 16, ty * TILE + 12, 34, 56, t, tx * 3.1 + ty * 5);
          else if ((tx + ty) % 2 === 0) drawFlame(ctx, tx * TILE + 10 + (ty % 3) * 5, ty * TILE + 22, 14, 18, t, tx * 7 + ty, 0.7);
        }
      }
    }
  }

  // Lights for the lighting pass (world space).
  collectLights(view, out, t) {
    for (const l of this.lights) {
      if (l.x + l.r < view.x0 || l.x - l.r > view.x1 || l.y + l.r < view.y0 || l.y - l.r > view.y1) continue;
      out.push(l);
    }
    const L = this.level;
    const tx0 = Math.max(0, Math.floor(view.x0 / TILE) - 4);
    const tx1 = Math.min(L.w - 1, Math.floor(view.x1 / TILE) + 4);
    const ty0 = Math.max(0, Math.floor(view.y0 / TILE) - 4);
    const ty1 = Math.min(L.h - 1, Math.floor(view.y1 / TILE) + 4);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx += 1) {
        const t2 = L.grid[ty][tx];
        if ((t2 === '^' && tx % 2 === 0) || t2 === 'X') {
          out.push({ x: tx * TILE + 16, y: ty * TILE + 8, r: 150, color: 'rgb(255,120,40)', i: 0.75 + Math.sin(t * 9 + tx) * 0.08 });
        }
      }
    }
  }
}
