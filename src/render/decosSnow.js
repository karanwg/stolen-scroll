import { TILE } from '../config.js';
import { mulberry32 } from '../core/math.js';
import { roofPath } from './shapes.js';

// Chapter III (snow half) props. Same contract as decosSea.js: draw relative to
// the anchor (left edge, surface y), return bounds; push lights/fires/steam to `out`.

const C = {
  snow: '#e4ecf7',
  snowShade: '#a9bcd6',
  wood: '#2e231d',
  woodDark: '#18110d',
  woodLight: '#4d3b30',
  roof: '#1a2030',
  roofLight: '#2d3850',
  stone: '#4a5162',
  stoneLight: '#636c80',
  vermilion: '#8a2a24',
  vermilionLight: '#b03a30',
  paper: '#ece2c8',
  canvas: '#2a1f3a',
};

function snowCap(g, x, y, w, h = 7) {
  g.fillStyle = C.snowShade;
  g.beginPath();
  g.moveTo(x - 2, y + 2);
  g.quadraticCurveTo(x + w / 2, y - h - 2, x + w + 2, y + 2);
  g.fill();
  g.fillStyle = C.snow;
  g.beginPath();
  g.moveTo(x - 2, y);
  g.quadraticCurveTo(x + w / 2, y - h - 3, x + w + 2, y);
  g.fill();
}

function roofWithSnow(g, x, eaveY, w, rise) {
  g.fillStyle = C.roof;
  g.beginPath();
  roofPath(g, x, eaveY, w, rise, 0.1);
  g.fill();
  // a thick blanket of snow on the upper slopes
  g.save();
  g.beginPath();
  roofPath(g, x, eaveY, w, rise, 0.1);
  g.clip();
  g.fillStyle = C.snow;
  g.fillRect(x - w * 0.2, eaveY - rise - 4, w * 1.4, rise * 0.55);
  g.fillStyle = C.snowShade;
  g.fillRect(x - w * 0.2, eaveY - rise * 0.45 - 2, w * 1.4, 3);
  g.restore();
  // icicles along the eaves
  g.fillStyle = 'rgba(210,230,250,0.85)';
  for (let k = 0.1; k < 0.95; k += 0.07) {
    const ix = x + w * k;
    const len = 4 + ((k * 97) % 1) * 12;
    g.beginPath();
    g.moveTo(ix - 2, eaveY + rise * 0.1);
    g.lineTo(ix + 2, eaveY + rise * 0.1);
    g.lineTo(ix, eaveY + rise * 0.1 + len);
    g.fill();
  }
}

export const SNOW_PAINTERS = {
  snowPine(g, d) {
    const s = d.scale || 1;
    const h = 170 * s;
    g.fillStyle = '#1a140f';
    g.fillRect(-4 * s, -h * 0.3, 8 * s, h * 0.3);
    for (let k = 0; k < 5; k++) {
      const y = -h * 0.22 - k * h * 0.17;
      const w = (70 - k * 11) * s;
      g.fillStyle = '#0f1a1e';
      g.beginPath();
      g.moveTo(-w, y);
      g.lineTo(0, y - h * 0.22);
      g.lineTo(w, y);
      g.closePath();
      g.fill();
      g.fillStyle = C.snow;
      g.beginPath();
      g.moveTo(-w * 0.95, y - 1);
      g.quadraticCurveTo(0, y - h * 0.12, w * 0.95, y - 1);
      g.quadraticCurveTo(0, y - h * 0.06, -w * 0.95, y - 1);
      g.fill();
    }
    snowCap(g, -6 * s, -h * 0.9, 12 * s, 6);
    return { x0: -80 * s, y0: -h - 10, x1: 80 * s, y1: 4 };
  },

  // A row of little stone jizo with red bibs and snow hats.
  jizo(g, d) {
    const n = d.n || 3;
    for (let i = 0; i < n; i++) {
      const x = i * 22;
      g.fillStyle = C.stone;
      g.beginPath();
      g.ellipse(x, -12, 8, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x, -27, 6.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = C.stoneLight;
      g.fillRect(x - 3, -30, 2, 2);
      g.fillStyle = '#a3241f';
      g.beginPath();
      g.moveTo(x - 7, -20);
      g.lineTo(x + 7, -20);
      g.lineTo(x + 4, -10);
      g.lineTo(x - 4, -10);
      g.fill();
      snowCap(g, x - 7, -33, 14, 5);
    }
    return { x0: -12, y0: -46, x1: n * 22, y1: 2 };
  },

  // A wayside shrine on the pass: a little roofed box on a stone, a candle burning.
  hokora(g, d, out) {
    g.fillStyle = C.stone;
    g.fillRect(-22, -14, 44, 14);
    g.fillStyle = C.stoneLight;
    g.fillRect(-22, -14, 44, 2);
    g.fillStyle = '#3a2418';
    g.fillRect(-16, -50, 32, 36);
    g.fillStyle = '#1a0f0a';
    g.fillRect(-11, -44, 22, 26);
    g.fillStyle = '#7e2420';
    g.fillRect(-16, -50, 32, 4);
    // roof
    g.fillStyle = '#2a1a14';
    g.beginPath();
    g.moveTo(-26, -48);
    g.quadraticCurveTo(0, -70, 26, -48);
    g.lineTo(20, -46);
    g.quadraticCurveTo(0, -62, -20, -46);
    g.fill();
    snowCap(g, -24, -62, 48, 7);
    // a candle inside
    g.fillStyle = '#e8dcc0';
    g.fillRect(-2, -26, 4, 8);
    out.fires.push({ x: 0, y: -26, w: 7, h: 10 });
    out.lights.push({ x: 0, y: -30, r: 110, color: 'rgb(255,190,120)', i: 0.6 });
    // a rope and paper streamers
    g.strokeStyle = '#c9b88a';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-16, -46);
    g.quadraticCurveTo(0, -40, 16, -46);
    g.stroke();
    g.fillStyle = '#efe8d8';
    for (const x of [-8, 0, 8]) g.fillRect(x - 1.5, -43, 3, 7);
    return { x0: -30, y0: -76, x1: 30, y1: 2 };
  },

  prayerFlags(g, d) {
    const W = (d.w || 6) * TILE;
    const H = d.h || 90;
    g.fillStyle = C.woodDark;
    g.fillRect(0, -H, 4, H);
    g.fillRect(W - 4, -H + 10, 4, H - 10);
    g.strokeStyle = '#8a7a5a';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(2, -H + 4);
    g.quadraticCurveTo(W / 2, -H + 40, W - 2, -H + 14);
    g.stroke();
    const cols = ['#c23a2e', '#e8d9b0', '#2e5aa8', '#d9b23a', '#3a8a5a'];
    const n = Math.round(W / 22);
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const x = u * W;
      const y = -H + 4 + Math.sin(u * Math.PI) * 36 + u * 10;
      g.fillStyle = cols[i % cols.length];
      g.beginPath();
      g.moveTo(x - 6, y);
      g.lineTo(x + 6, y);
      g.lineTo(x + 5, y + 16);
      g.lineTo(x - 5, y + 14);
      g.fill();
    }
    return { x0: -4, y0: -H - 6, x1: W + 4, y1: 2 };
  },

  frozenTorii(g, d) {
    const s = d.scale || 1;
    const H = 150 * s;
    const W = 150 * s;
    for (const px of [W * 0.22, W * 0.78]) {
      g.fillStyle = C.vermilion;
      g.fillRect(px - 7 * s, -H, 14 * s, H);
      g.fillStyle = C.vermilionLight;
      g.fillRect(px - 7 * s, -H, 3 * s, H);
      g.fillStyle = 'rgba(220,235,255,0.5)';
      g.fillRect(px + 3 * s, -H * 0.7, 4 * s, H * 0.7); // rime on the shadow side
    }
    g.fillStyle = C.vermilion;
    g.fillRect(W * 0.08, -H * 0.78, W * 0.84, 10 * s);
    g.fillStyle = '#100808';
    g.beginPath();
    g.moveTo(-W * 0.06, -H - 14 * s);
    g.quadraticCurveTo(W * 0.5, -H + 4 * s, W * 1.06, -H - 14 * s);
    g.lineTo(W * 1.04, -H - 4 * s);
    g.quadraticCurveTo(W * 0.5, -H + 14 * s, -W * 0.04, -H - 4 * s);
    g.fill();
    snowCap(g, -W * 0.05, -H - 13 * s, W * 1.1, 8);
    g.fillStyle = 'rgba(210,230,250,0.85)';
    for (let k = 0.05; k < 1; k += 0.08) {
      g.beginPath();
      g.moveTo(W * k - 2, -H - 4 * s);
      g.lineTo(W * k + 2, -H - 4 * s);
      g.lineTo(W * k, -H + 8 * s + ((k * 31) % 1) * 10);
      g.fill();
    }
    return { x0: -W * 0.1, y0: -H - 30 * s, x1: W * 1.12, y1: 4 };
  },

  // Binoshi tent: violet canvas, their crest, pegged into the snow.
  tent(g, d, out) {
    const W = (d.w || 4) * TILE;
    const H = 90;
    g.fillStyle = C.canvas;
    g.beginPath();
    g.moveTo(-10, 0);
    g.lineTo(W / 2, -H);
    g.lineTo(W + 10, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#1a1226';
    g.beginPath();
    g.moveTo(W / 2 - 18, 0);
    g.lineTo(W / 2, -H * 0.55);
    g.lineTo(W / 2 + 18, 0);
    g.fill();
    g.strokeStyle = '#b48cff';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(W / 2, -H * 0.62, 9, 0, Math.PI * 2);
    g.moveTo(W / 2, -H * 0.62 - 11);
    g.lineTo(W / 2, -H * 0.62 + 11);
    g.stroke();
    snowCap(g, W * 0.2, -H * 0.62, W * 0.6, 6);
    g.strokeStyle = '#6a5a40';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(W / 2, -H);
    g.lineTo(-30, 0);
    g.moveTo(W / 2, -H);
    g.lineTo(W + 30, 0);
    g.stroke();
    if (d.lit) {
      g.fillStyle = 'rgba(255,170,90,0.5)';
      g.fillRect(W / 2 - 6, -20, 12, 18);
      out.lights.push({ x: W / 2, y: -14, r: 90, color: 'rgb(255,170,100)', i: 0.5 });
    }
    return { x0: -40, y0: -H - 6, x1: W + 40, y1: 2 };
  },

  campfire(g, d, out) {
    g.fillStyle = '#2a1a10';
    for (const a of [-0.4, 0.4, 0]) {
      g.save();
      g.rotate(a);
      g.fillRect(-18, -5, 36, 6);
      g.restore();
    }
    g.fillStyle = '#3a3a44';
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.arc(-22 + i * 7.3, -1, 4, 0, Math.PI * 2);
      g.fill();
    }
    out.fires.push({ x: 0, y: -4, w: 34, h: 48 });
    out.lights.push({ x: 0, y: -20, r: 230, color: 'rgb(255,160,80)', i: 0.95 });
    return { x0: -30, y0: -16, x1: 30, y1: 4 };
  },

  weaponRack(g) {
    g.fillStyle = C.woodDark;
    g.fillRect(-30, -70, 4, 70);
    g.fillRect(26, -70, 4, 70);
    g.fillRect(-32, -64, 64, 4);
    g.fillRect(-32, -30, 64, 4);
    g.strokeStyle = '#8a8698';
    g.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(-22 + i * 11, -96);
      g.lineTo(-22 + i * 11, -24);
      g.stroke();
    }
    g.fillStyle = '#c8c8d8';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(-22 + i * 11, -106);
      g.lineTo(-25 + i * 11, -96);
      g.lineTo(-19 + i * 11, -96);
      g.fill();
    }
    snowCap(g, -32, -64, 64, 4);
    return { x0: -36, y0: -110, x1: 36, y1: 2 };
  },

  // A hall of the cliff temple, braced on stilts against the rock.
  templeHall(g, d, out) {
    const W = d.w * TILE;
    const H = (d.h || 4) * TILE;
    const stilt = (d.stilts || 0) * TILE;
    g.fillStyle = C.woodDark;
    for (let x = 6; x < W; x += 44) {
      g.fillRect(x, 0, 7, stilt);
      g.save();
      g.strokeStyle = C.woodDark;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x + 3, stilt * 0.3);
      g.lineTo(x + 47, stilt * 0.7);
      g.stroke();
      g.restore();
    }
    g.fillStyle = '#3a2c24';
    g.fillRect(0, -H, W, H);
    g.fillStyle = C.wood;
    for (let x = 0; x <= W; x += 50) g.fillRect(x, -H, 7, H);
    g.fillStyle = C.paper;
    for (let x = 12; x < W - 30; x += 50) g.fillRect(x, -H * 0.8, 32, H * 0.55);
    g.strokeStyle = C.woodDark;
    g.lineWidth = 1.3;
    for (let x = 12; x < W - 30; x += 50) {
      for (let k = 1; k < 4; k++) {
        g.beginPath();
        g.moveTo(x + k * 8, -H * 0.8);
        g.lineTo(x + k * 8, -H * 0.25);
        g.stroke();
      }
    }
    out.lights.push({ x: W / 2, y: -H * 0.5, r: Math.min(300, W), color: 'rgb(255,190,120)', i: 0.5 });
    roofWithSnow(g, -14, -H + 4, W + 28, 46);
    return { x0: -40, y0: -H - 60, x1: W + 40, y1: stilt + 4 };
  },

  // The onsen bathhouse: steam from the door, a noren, warm light.
  bathhouse(g, d, out) {
    const W = (d.w || 6) * TILE;
    const H = 110;
    g.fillStyle = '#33271f';
    g.fillRect(0, -H, W, H);
    g.fillStyle = C.wood;
    for (let x = 0; x <= W; x += 46) g.fillRect(x, -H, 6, H);
    g.fillStyle = '#0c0806';
    g.fillRect(W * 0.35, -H * 0.7, W * 0.3, H * 0.7);
    g.fillStyle = '#2b4a8a';
    for (let i = 0; i < 3; i++) g.fillRect(W * 0.35 + (i * W * 0.3) / 3 + 1, -H * 0.7, (W * 0.3) / 3 - 2, H * 0.28);
    g.fillStyle = C.paper;
    g.font = '18px "Shippori Mincho", serif';
    g.textAlign = 'center';
    g.fillText('♨', W / 2, -H * 0.5);
    roofWithSnow(g, -12, -H + 4, W + 24, 40);
    out.lights.push({ x: W / 2, y: -H * 0.35, r: 160, color: 'rgb(255,190,130)', i: 0.6 });
    out.steam.push({ x: W / 2, y: -H * 0.7, w: W * 0.3 });
    return { x0: -30, y0: -H - 50, x1: W + 30, y1: 2 };
  },

  // Rounded stones ringing a hot spring, wisps of steam.
  onsenRocks(g, d, out) {
    const W = (d.w || 8) * TILE;
    const rnd = mulberry32(d.x + 2);
    for (let i = 0; i < W / 18; i++) {
      const x = 8 + rnd() * (W - 16);
      const r = 8 + rnd() * 12;
      g.fillStyle = rnd() < 0.5 ? '#3a4050' : '#2c3240';
      g.beginPath();
      g.ellipse(x, -r * 0.4, r, r * 0.65, 0, 0, Math.PI * 2);
      g.fill();
      snowCap(g, x - r * 0.7, -r * 0.9, r * 1.4, 3);
    }
    for (let x = 30; x < W; x += 90) out.steam.push({ x, y: 6, w: 60 });
    return { x0: -20, y0: -40, x1: W + 20, y1: 6 };
  },

  // The great frozen waterfall: pillars of blue ice behind the climb.
  frozenFall(g, d) {
    const W = d.w * TILE;
    const H = d.h * TILE;
    const rnd = mulberry32(d.x + 7);
    for (let i = 0; i < W / 20; i++) {
      const x = rnd() * W;
      const w = 14 + rnd() * 30;
      const top = -H + rnd() * 60;
      const grad = g.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, 'rgba(110,150,200,0.55)');
      grad.addColorStop(0.5, 'rgba(200,225,250,0.75)');
      grad.addColorStop(1, 'rgba(90,130,180,0.55)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x, top);
      g.bezierCurveTo(x - 6, top + H * 0.4, x + 8, top + H * 0.7, x + w * 0.3, 0);
      g.lineTo(x + w, 0);
      g.bezierCurveTo(x + w + 6, top + H * 0.6, x + w - 4, top + H * 0.3, x + w, top);
      g.fill();
    }
    return { x0: -10, y0: -H - 10, x1: W + 10, y1: 4 };
  },

  // A small temple bell tower (the bells themselves are interactive entities).
  belfry(g, d) {
    g.fillStyle = C.woodDark;
    g.fillRect(-36, -120, 7, 120);
    g.fillRect(29, -120, 7, 120);
    g.fillRect(-40, -96, 80, 6);
    roofWithSnow(g, -50, -118, 100, 30);
    return { x0: -60, y0: -160, x1: 60, y1: 2 };
  },
};
