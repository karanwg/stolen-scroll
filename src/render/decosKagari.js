import { TILE } from '../config.js';
import { mulberry32 } from '../core/math.js';
import { roofPath } from './shapes.js';

// Chapter IV props: Kagari rebuilt (spring, lanterns, cherry trees), and its
// rotten twin in the Upside Down. Most come in pairs, one per world.

const C = {
  wood: '#2b1a16',
  woodDark: '#1a100d',
  woodLight: '#4a3024',
  roof: '#1b1519',
  plaster: '#4a3a38',
  vermilion: '#8e2a24',
  stone: '#3a333b',
  stoneLight: '#4e4650',
  dead: '#0c1016',
  deadLight: '#1c232c',
  vine: '#080b10',
};

function vines(g, rnd, x0, y0, w, h, n = 6) {
  g.strokeStyle = C.vine;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * w;
    g.lineWidth = 2 + rnd() * 4;
    g.beginPath();
    g.moveTo(x, y0);
    g.bezierCurveTo(x + (rnd() - 0.5) * 40, y0 + h * 0.3, x + (rnd() - 0.5) * 40, y0 + h * 0.7, x + (rnd() - 0.5) * 30, y0 + h * (0.6 + rnd() * 0.4));
    g.stroke();
  }
}

export const KAGARI_PAINTERS = {
  // A cherry tree in bloom, lit pink by the lanterns.
  sakura(g, d) {
    const rnd = mulberry32(d.x + 1);
    const s = d.scale || 1;
    g.save();
    g.scale(s, s);
    g.strokeStyle = '#2a1a18';
    g.lineCap = 'round';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-6, -50, 4, -90);
    g.stroke();
    g.lineWidth = 5;
    for (const [ax, ay, bx, by] of [[2, -70, -40, -110], [4, -84, 36, -122], [0, -60, 46, -86], [-2, -50, -52, -70]]) {
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo((ax + bx) / 2, ay - 20, bx, by);
      g.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 70;
      g.fillStyle = ['#e89ab4', '#f2b8cc', '#c87896', '#f6cad8'][i % 4];
      g.globalAlpha = 0.85;
      g.beginPath();
      g.arc(Math.cos(a) * r * 1.1, -110 + Math.sin(a) * r * 0.55, 14 + rnd() * 12, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // petals on the ground
    for (let i = 0; i < 14; i++) {
      g.fillStyle = 'rgba(240,170,200,0.7)';
      g.fillRect(-50 + rnd() * 100, -2 + rnd() * 2, 3, 1.5);
    }
    g.restore();
    return { x0: -100 * s, y0: -200 * s, x1: 100 * s, y1: 4 };
  },

  // The same tree beneath: bare, black, strung with vines.
  deadTree(g, d) {
    const rnd = mulberry32(d.x + 1);
    const s = d.scale || 1;
    g.save();
    g.scale(s, s);
    g.strokeStyle = C.dead;
    g.lineCap = 'round';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-6, -50, 4, -90);
    g.stroke();
    g.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
      const len = 40 + rnd() * 60;
      const sx = rnd() * 6 - 3;
      const sy = -50 - rnd() * 40;
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + Math.cos(a) * len * 0.5 + 10, sy + Math.sin(a) * len * 0.5, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      g.stroke();
    }
    vines(g, rnd, -40, -130, 80, 120, 5);
    g.restore();
    return { x0: -100 * s, y0: -200 * s, x1: 100 * s, y1: 4 };
  },

  // A string of paper lanterns between two poles.
  festivalLanterns(g, d, out) {
    const W = (d.w || 6) * TILE;
    const H = d.h || 120;
    g.fillStyle = C.woodDark;
    g.fillRect(-2, -H, 5, H);
    g.fillRect(W - 2, -H, 5, H);
    g.strokeStyle = '#3a2a20';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -H + 6);
    g.quadraticCurveTo(W / 2, -H + 40, W, -H + 6);
    g.stroke();
    const n = Math.max(3, Math.round(W / 40));
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const x = u * W;
      const y = -H + 6 + Math.sin(u * Math.PI) * 34 + 6;
      const red = i % 2 === 0;
      g.fillStyle = red ? '#c8402e' : '#efe2c4';
      g.beginPath();
      g.ellipse(x, y + 8, 7, 10, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a1010';
      g.fillRect(x - 5, y - 2, 10, 2);
      g.fillRect(x - 5, y + 17, 10, 2);
      out.lamps.push({ x, y: y + 8, r: 3, color: red ? 'rgb(255,120,80)' : 'rgb(255,220,170)' });
      if (i % 2) out.lights.push({ x, y: y + 8, r: 110, color: 'rgb(255,170,110)', i: 0.45 });
    }
    return { x0: -6, y0: -H - 4, x1: W + 6, y1: 2 };
  },

  // Kagari's shrine: steps, a vermilion hall, the altar where the mirror sits.
  kagariShrine(g, d, out) {
    const W = (d.w || 10) * TILE;
    const H = (d.h || 6) * TILE;
    const ud = d.ud;
    // stone base and steps
    g.fillStyle = ud ? C.deadLight : C.stone;
    g.fillRect(-8, -26, W + 16, 26);
    g.fillStyle = ud ? C.dead : C.stoneLight;
    g.fillRect(-8, -26, W + 16, 3);
    // the hall
    g.fillStyle = ud ? C.dead : C.vermilion;
    g.fillRect(14, -H, 10, H - 26);
    g.fillRect(W - 24, -H, 10, H - 26);
    g.fillRect(W / 2 - 5, -H, 10, H - 26);
    g.fillStyle = ud ? '#0e1218' : '#2a1414';
    g.fillRect(24, -H + 22, W - 48, H - 48);
    g.fillStyle = ud ? '#141a22' : '#efe2c4';
    // paper doors (torn, beneath)
    for (let i = 0; i < 4; i++) {
      const x = 30 + i * ((W - 60) / 4);
      g.fillRect(x, -H + 34, (W - 60) / 4 - 6, H - 76);
      if (!ud) {
        g.fillStyle = 'rgba(40,20,20,0.5)';
        for (let k = 1; k < 4; k++) g.fillRect(x, -H + 34 + k * ((H - 76) / 4), (W - 60) / 4 - 6, 1.5);
        g.fillStyle = '#efe2c4';
      }
    }
    // roof
    g.fillStyle = ud ? C.dead : C.roof;
    g.beginPath();
    roofPath(g, -24, -H + 6, W + 48, 70, 0.1);
    g.fill();
    // a rope and bell over the door
    g.strokeStyle = ud ? '#2a2a2a' : '#d8c08a';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(W / 2, -H + 10);
    g.lineTo(W / 2, -H + 60);
    g.stroke();
    g.fillStyle = ud ? '#2a2a2a' : '#c9a24a';
    g.beginPath();
    g.arc(W / 2, -H + 14, 7, 0, Math.PI * 2);
    g.fill();
    if (ud) vines(g, mulberry32(d.x), -20, -H - 40, W + 40, H + 40, 14);
    else out.lights.push({ x: W / 2, y: -H / 2, r: 200, color: 'rgb(255,180,120)', i: 0.45 });
    return { x0: -40, y0: -H - 90, x1: W + 40, y1: 4 };
  },

  // A house beneath: the same shape, rotted through, overgrown.
  udHouse(g, d) {
    const W = d.w * TILE;
    const H = d.h * TILE;
    const rnd = mulberry32(d.x + 3);
    g.fillStyle = C.dead;
    g.fillRect(0, -H, W, H);
    g.fillStyle = '#070a0e';
    for (let i = 0; i < 3; i++) g.fillRect(12 + i * (W / 3), -H * 0.55, W / 3 - 24, H * 0.3); // dark empty windows
    g.fillStyle = C.deadLight;
    g.beginPath();
    roofPath(g, -6, -H + 4, W + 12, 44, 0.08);
    g.fill();
    // a hole through the roof
    g.fillStyle = '#05070a';
    g.beginPath();
    g.ellipse(W * (0.3 + rnd() * 0.4), -H - 10, 24, 14, 0.2, 0, Math.PI * 2);
    g.fill();
    vines(g, rnd, -10, -H - 30, W + 20, H + 30, 10);
    return { x0: -40, y0: -H - 70, x1: W + 40, y1: 4 };
  },

  // Vines hanging in curtains from above.
  vineCurtain(g, d) {
    const W = (d.w || 4) * TILE;
    const H = (d.h || 6) * TILE;
    vines(g, mulberry32(d.x + 5), 0, 0, W, H, Math.round(W / 10));
    return { x0: -40, y0: -4, x1: W + 40, y1: H + 20 };
  },

  // A fleshy growth on the ground, pulsing faintly.
  udGrowth(g, d, out) {
    const rnd = mulberry32(d.x + 7);
    const s = d.scale || 1;
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#2a1a20' : '#1e1218';
      g.beginPath();
      g.ellipse((rnd() - 0.5) * 50 * s, -10 * s - rnd() * 20 * s, (14 + rnd() * 16) * s, (10 + rnd() * 10) * s, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(200,90,110,0.35)';
    g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc((rnd() - 0.5) * 40 * s, -14 * s - rnd() * 14 * s, 6 * s, 3.5, 5.4);
      g.stroke();
    }
    out.lights.push({ x: 0, y: -16 * s, r: 70 * s, color: 'rgb(200,80,100)', i: 0.3, flicker: true });
    return { x0: -60 * s, y0: -60 * s, x1: 60 * s, y1: 4 };
  },

  // Inside the inverted pagoda. It was built upside down: rafters under your
  // feet, lanterns hanging *up* from the floor. Once the world turns over,
  // everything hangs the right way.
  pagodaInterior(g, d, out) {
    const W = d.w * TILE;
    const H = d.h * TILE;
    const ud = d.ud;
    const rnd = mulberry32(d.x + (ud ? 11 : 0));
    // back wall
    g.fillStyle = ud ? '#0a0d12' : '#1e1310';
    g.fillRect(0, 0, W, H);
    // shoji panels between the pillars, faintly lit from outside
    const bay = 4 * TILE;
    for (let x = 0; x < W; x += bay) {
      for (let y = 2 * TILE; y < H - 2 * TILE; y += 5 * TILE) {
        g.fillStyle = ud ? '#10151c' : '#3a2a22';
        g.fillRect(x + 12, y + 10, bay - 24, 5 * TILE - 30);
        if (!ud) {
          g.fillStyle = 'rgba(20,10,8,0.6)';
          for (let k = 1; k < 4; k++) g.fillRect(x + 12, y + 10 + k * ((5 * TILE - 30) / 4), bay - 24, 2);
          g.fillRect(x + bay / 2 - 1, y + 10, 2, 5 * TILE - 30);
        } else if (rnd() < 0.6) {
          // torn through
          g.fillStyle = '#05070a';
          g.beginPath();
          g.ellipse(x + bay / 2 + (rnd() - 0.5) * 40, y + 60 + rnd() * 60, 14 + rnd() * 20, 10 + rnd() * 26, rnd() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
      // pillar
      g.fillStyle = ud ? C.dead : C.woodDark;
      g.fillRect(x - 7, 0, 14, H);
      g.fillStyle = ud ? C.deadLight : C.woodLight;
      g.fillRect(x - 7, 0, 2, H);
    }
    // tie beams, every five rows
    for (let y = 2 * TILE; y < H; y += 5 * TILE) {
      g.fillStyle = ud ? C.dead : C.wood;
      g.fillRect(0, y - 6, W, 10);
    }
    // rafters along the floor, the way they'd run under a roof
    g.fillStyle = ud ? C.dead : C.woodDark;
    for (let x = 10; x < W; x += 26) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + 8, H);
      g.lineTo(x + 18, H - 40);
      g.lineTo(x + 10, H - 40);
      g.fill();
    }
    g.fillRect(0, H - 46, W, 8);
    // lanterns hanging up from the floor beams
    for (let i = 0; i < 4; i++) {
      const lx = W * (0.18 + i * 0.22);
      const top = H - 46 - 70 - (i % 2) * 40;
      g.strokeStyle = ud ? '#1a1a1a' : '#3a2a20';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(lx, H - 46);
      g.lineTo(lx, top + 22);
      g.stroke();
      g.fillStyle = ud ? '#2a1418' : i % 2 ? '#c8402e' : '#efe2c4';
      g.beginPath();
      g.ellipse(lx, top + 8, 9, 13, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a1010';
      g.fillRect(lx - 6, top - 6, 12, 3);
      g.fillRect(lx - 6, top + 20, 12, 3);
      if (ud) out.lights.push({ x: lx, y: top + 8, r: 90, color: 'rgb(170,50,60)', i: 0.35, flicker: true });
      else {
        out.lamps.push({ x: lx, y: top + 8, r: 3, color: 'rgb(255,200,150)' });
        out.lights.push({ x: lx, y: top + 8, r: 150, color: 'rgb(255,170,110)', i: 0.5 });
      }
    }
    if (ud) vines(g, rnd, 0, 0, W, H * 0.6, 18);
    return { x0: -10, y0: -10, x1: W + 10, y1: H + 10 };
  },

  scarecrow(g, d) {
    const ud = d.ud;
    g.strokeStyle = ud ? C.dead : '#3a2a1a';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -70);
    g.moveTo(-26, -50);
    g.lineTo(26, -50);
    g.stroke();
    g.fillStyle = ud ? C.deadLight : '#5a4a2a';
    g.beginPath();
    g.moveTo(-14, -56);
    g.lineTo(14, -56);
    g.lineTo(10, -24);
    g.lineTo(-10, -24);
    g.fill();
    g.fillStyle = ud ? C.dead : '#c8b070';
    g.beginPath();
    g.ellipse(0, -66, 18, 6, 0, 0, Math.PI * 2); // straw hat
    g.fill();
    if (ud) vines(g, mulberry32(d.x), -20, -70, 40, 70, 4);
    return { x0: -32, y0: -78, x1: 32, y1: 2 };
  },
};
