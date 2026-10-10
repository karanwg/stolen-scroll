import { TILE } from '../config.js';
import { mulberry32 } from '../core/math.js';
import { roofPath } from './shapes.js';

// Chapter II props, painted once into sprites (see DecoLayer).
// Each painter draws relative to its anchor (left edge, surface y) and returns
// its bounds. `out.lights`, `out.fires` and `out.beams` add animated extras.

const C = {
  wood: '#2a2522',
  woodDark: '#171311',
  woodLight: '#3e3632',
  plank: '#332c28',
  roof: '#161a20',
  roofLight: '#2a3240',
  rim: 'rgba(170,210,250,0.35)',
  rope: '#7a6a4e',
  stone: '#3a3e46',
  stoneLight: '#50566a',
  vermilion: '#7a2320',
  vermilionLight: '#a3362b',
  pine: '#0f1a18',
  paper: '#e8dcc0',
};

function roofTiles(g, x, eaveY, w, rise) {
  g.save();
  g.clip();
  g.strokeStyle = C.roofLight;
  g.lineWidth = 1.3;
  for (let k = 1; k < 5; k++) {
    const y = eaveY - rise + (rise * 1.15 * k) / 5;
    g.beginPath();
    g.moveTo(x - w * 0.2, y);
    g.lineTo(x + w * 1.2, y);
    g.stroke();
  }
  g.restore();
  g.save();
  g.strokeStyle = C.rim;
  g.lineWidth = 2;
  g.stroke();
  g.restore();
}

export const SEA_PAINTERS = {
  // Pier stilts: posts from the walkway down into the sea, with cross-bracing.
  stilts(g, d) {
    const W = d.w * TILE;
    const H = (d.h || 6) * TILE;
    const n = Math.max(2, Math.round(W / 80));
    for (let i = 0; i <= n; i++) {
      const x = 6 + (i * (W - 16)) / n;
      g.fillStyle = C.woodDark;
      g.fillRect(x, 0, 9, H);
      g.fillStyle = C.woodLight;
      g.fillRect(x, 0, 2, H);
      // barnacles near the waterline
      g.fillStyle = '#4a5058';
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.arc(x + 2 + ((k * 3) % 7), H - 70 + k * 9, 1.6, 0, Math.PI * 2);
        g.fill();
      }
      if (i < n) {
        g.strokeStyle = C.woodDark;
        g.lineWidth = 3;
        const x2 = 6 + ((i + 1) * (W - 16)) / n;
        g.beginPath();
        g.moveTo(x + 4, 8);
        g.lineTo(x2 + 4, H * 0.55);
        g.moveTo(x2 + 4, 8);
        g.lineTo(x + 4, H * 0.55);
        g.stroke();
      }
    }
    return { x0: 0, y0: 0, x1: W, y1: H };
  },

  stiltHouse(g, d, out) {
    const W = d.w * TILE;
    const H = (d.h || 4) * TILE;
    // weathered plank walls
    g.fillStyle = C.plank;
    g.fillRect(0, -H, W, H);
    g.strokeStyle = C.woodDark;
    g.lineWidth = 1.2;
    for (let y = -H + 7; y < 0; y += 7) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(W, y);
      g.stroke();
    }
    g.fillStyle = C.woodDark;
    g.fillRect(0, -H, 7, H);
    g.fillRect(W - 7, -H, 7, H);
    // a lit window and a dark doorway
    g.fillStyle = '#0a0806';
    g.fillRect(W * 0.12, -H * 0.72, W * 0.24, H * 0.72);
    g.fillStyle = 'rgba(255,190,120,0.55)';
    g.fillRect(W * 0.55, -H * 0.72, W * 0.22, H * 0.3);
    g.strokeStyle = C.woodDark;
    g.lineWidth = 2;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo(W * 0.55 + (W * 0.22 * k) / 4, -H * 0.72);
      g.lineTo(W * 0.55 + (W * 0.22 * k) / 4, -H * 0.42);
      g.stroke();
    }
    out.lights.push({ x: W * 0.66, y: -H * 0.6, r: 110, color: 'rgb(255,180,110)', i: 0.55 });
    // nets hanging off the side
    g.strokeStyle = 'rgba(150,140,110,0.6)';
    g.lineWidth = 0.8;
    for (let k = 0; k < 7; k++) {
      g.beginPath();
      g.moveTo(W - 4 + k * 3, -H + 10);
      g.quadraticCurveTo(W + 8 + k * 2, -H * 0.5, W - 2 + k * 3, -6);
      g.stroke();
    }
    // roof
    g.fillStyle = C.roof;
    g.beginPath();
    roofPath(g, -10, -H + 4, W + 20, 40, 0.08);
    g.fill();
    roofTiles(g, -10, -H + 4, W + 20, 40);
    return { x0: -30, y0: -H - 60, x1: W + 40, y1: 2 };
  },

  // A moored fishing boat. Anchor = waterline.
  boat(g, d) {
    const W = (d.w || 5) * TILE;
    g.fillStyle = C.woodDark;
    g.beginPath();
    g.moveTo(0, -18);
    g.quadraticCurveTo(W * 0.1, 18, W * 0.5, 20);
    g.quadraticCurveTo(W * 0.9, 18, W + 12, -26);
    g.lineTo(W - 4, -16);
    g.lineTo(6, -12);
    g.closePath();
    g.fill();
    g.fillStyle = C.woodLight;
    g.fillRect(4, -16, W - 8, 3);
    g.strokeStyle = C.rim;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -18);
    g.quadraticCurveTo(W * 0.5, -10, W + 12, -26);
    g.stroke();
    // mooring rope to nothing
    g.strokeStyle = C.rope;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(W + 10, -24);
    g.quadraticCurveTo(W + 40, 0, W + 60, -40);
    g.stroke();
    return { x0: -6, y0: -48, x1: W + 70, y1: 24 };
  },

  nets(g, d) {
    const W = (d.w || 4) * TILE;
    g.fillStyle = C.woodDark;
    g.fillRect(0, -90, 5, 90);
    g.fillRect(W - 5, -90, 5, 90);
    g.strokeStyle = C.rope;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(2, -84);
    g.quadraticCurveTo(W / 2, -70, W - 2, -84);
    g.stroke();
    g.strokeStyle = 'rgba(160,150,120,0.55)';
    g.lineWidth = 0.7;
    for (let x = 8; x < W - 6; x += 6) {
      g.beginPath();
      g.moveTo(x, -82 + Math.sin((x / W) * Math.PI) * 12);
      g.lineTo(x + 3, -20 - (x % 12));
      g.stroke();
    }
    for (let y = -70; y < -20; y += 8) {
      g.beginPath();
      g.moveTo(8, y);
      g.quadraticCurveTo(W / 2, y + 10, W - 8, y);
      g.stroke();
    }
    return { x0: -2, y0: -96, x1: W + 2, y1: 2 };
  },

  fishRack(g) {
    g.fillStyle = C.woodDark;
    g.fillRect(0, -70, 4, 70);
    g.fillRect(56, -70, 4, 70);
    g.fillRect(-4, -70, 68, 4);
    g.fillStyle = '#6a7480';
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 9;
      g.beginPath();
      g.ellipse(x, -50, 3, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(x - 3, -38);
      g.lineTo(x, -34);
      g.lineTo(x + 3, -38);
      g.fill();
    }
    return { x0: -6, y0: -74, x1: 66, y1: 2 };
  },

  // A string of red/white paper lanterns between two poles.
  paperLanterns(g, d, out) {
    const W = (d.w || 6) * TILE;
    const H = 110;
    g.fillStyle = C.woodDark;
    g.fillRect(0, -H, 5, H);
    g.fillRect(W - 5, -H, 5, H);
    g.strokeStyle = C.rope;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(3, -H + 6);
    g.quadraticCurveTo(W / 2, -H + 40, W - 3, -H + 6);
    g.stroke();
    const n = Math.max(3, Math.round(W / 45));
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const x = u * W;
      const y = -H + 6 + Math.sin(u * Math.PI) * 30 + 10;
      g.fillStyle = i % 2 ? '#b8322a' : C.paper;
      g.beginPath();
      g.ellipse(x, y + 8, 8, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1a0f0a';
      g.fillRect(x - 5, y - 3, 10, 3);
      g.fillRect(x - 5, y + 17, 10, 3);
      out.lights.push({ x, y: y + 8, r: 70, color: i % 2 ? 'rgb(255,120,80)' : 'rgb(255,210,150)', i: 0.6 });
    }
    return { x0: -4, y0: -H - 4, x1: W + 4, y1: 2 };
  },

  // Small roadside shrine to the sea god, with offerings.
  hokora(g, d, out) {
    g.fillStyle = C.stone;
    g.fillRect(-16, -12, 32, 12);
    g.fillStyle = C.wood;
    g.fillRect(-12, -38, 24, 26);
    g.fillStyle = '#0c0a08';
    g.fillRect(-7, -32, 14, 18);
    g.fillStyle = C.roof;
    g.beginPath();
    roofPath(g, -18, -36, 36, 14, 0.1);
    g.fill();
    g.fillStyle = C.paper;
    g.fillRect(-3, -28, 6, 10);
    // offerings: a fish and a sake cup
    g.fillStyle = '#7a8490';
    g.beginPath();
    g.ellipse(-10, -14, 6, 2.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = C.paper;
    g.fillRect(8, -17, 5, 5);
    out.lights.push({ x: 0, y: -24, r: 60, color: 'rgb(255,200,140)', i: 0.45 });
    return { x0: -24, y0: -52, x1: 24, y1: 2 };
  },

  // The shell of a great junk, broken-backed in the shallows (background).
  wreck(g, d, out) {
    const W = (d.w || 16) * TILE;
    const H = (d.h || 6) * TILE;
    g.fillStyle = '#1a1614';
    g.beginPath();
    g.moveTo(-20, -H * 0.7);
    g.quadraticCurveTo(W * 0.2, 30, W * 0.5, 20);
    g.quadraticCurveTo(W * 0.85, 10, W + 40, -H);
    g.lineTo(W + 20, -H * 0.85);
    g.lineTo(W * 0.6, -H * 0.55);
    g.lineTo(W * 0.45, -H * 0.9);
    g.lineTo(W * 0.3, -H * 0.5);
    g.lineTo(0, -H * 0.62);
    g.closePath();
    g.fill();
    // exposed ribs
    g.strokeStyle = '#0d0b0a';
    g.lineWidth = 6;
    for (let i = 0; i < 7; i++) {
      const x = W * 0.25 + i * (W * 0.06);
      g.beginPath();
      g.moveTo(x, 10);
      g.quadraticCurveTo(x - 20, -H * 0.4, x + 6, -H * 0.85);
      g.stroke();
    }
    // a lantern still burning in the wreck
    g.fillStyle = 'rgba(255,190,120,0.7)';
    g.fillRect(W * 0.7, -H * 0.5, 8, 10);
    out.lights.push({ x: W * 0.7 + 4, y: -H * 0.45, r: 120, color: 'rgb(255,180,110)', i: 0.6 });
    return { x0: -40, y0: -H - 30, x1: W + 60, y1: 40 };
  },

  // A tall mast with a torn sail and a crow's nest.
  mast(g, d) {
    const H = (d.h || 10) * TILE;
    g.fillStyle = C.woodDark;
    g.fillRect(-4, -H, 8, H);
    g.fillRect(-60, -H * 0.82, 120, 5);
    // torn sail (battened junk sail)
    g.fillStyle = 'rgba(120,70,50,0.85)';
    g.beginPath();
    g.moveTo(-56, -H * 0.8);
    g.lineTo(56, -H * 0.8);
    g.lineTo(46, -H * 0.5);
    g.lineTo(18, -H * 0.42);
    g.lineTo(10, -H * 0.55);
    g.lineTo(-20, -H * 0.38);
    g.lineTo(-50, -H * 0.46);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(30,18,12,0.8)';
    g.lineWidth = 2;
    for (let k = 1; k < 4; k++) {
      g.beginPath();
      g.moveTo(-56, -H * 0.8 + k * 22);
      g.lineTo(52, -H * 0.8 + k * 22);
      g.stroke();
    }
    // rigging
    g.strokeStyle = C.rope;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -H);
    g.lineTo(-120, 0);
    g.moveTo(0, -H);
    g.lineTo(110, 0);
    g.stroke();
    return { x0: -130, y0: -H - 10, x1: 120, y1: 4 };
  },

  // The lighthouse: stone tower, lit windows, a gallery, and a lamp whose beam sweeps the sea.
  lighthouse(g, d, out) {
    const H = (d.h || 30) * TILE;
    const wb = 150;
    const wt = 90;
    const grad = g.createLinearGradient(-wb / 2, 0, wb / 2, 0);
    grad.addColorStop(0, '#2a2e36');
    grad.addColorStop(0.5, '#3c424e');
    grad.addColorStop(1, '#22262c');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(-wb / 2, 0);
    g.lineTo(-wt / 2, -H + 60);
    g.lineTo(wt / 2, -H + 60);
    g.lineTo(wb / 2, 0);
    g.closePath();
    g.fill();
    // stone courses
    g.strokeStyle = 'rgba(10,12,16,0.5)';
    g.lineWidth = 1;
    for (let y = -20; y > -H + 60; y -= 22) {
      const k = -y / H;
      const hw = wb / 2 - (wb - wt) / 2 * k;
      g.beginPath();
      g.moveTo(-hw, y);
      g.lineTo(hw, y);
      g.stroke();
    }
    // red bands
    g.fillStyle = 'rgba(120,30,30,0.6)';
    for (const k of [0.3, 0.6]) {
      const y = -H * k;
      const hw = wb / 2 - (wb - wt) / 2 * k;
      g.fillRect(-hw, y - 10, hw * 2, 20);
    }
    // windows
    for (const k of [0.15, 0.4, 0.66]) {
      g.fillStyle = 'rgba(255,200,130,0.6)';
      g.fillRect(-6, -H * k - 14, 12, 18);
      out.lights.push({ x: 0, y: -H * k - 5, r: 80, color: 'rgb(255,190,120)', i: 0.45 });
    }
    // gallery + lamp room
    g.fillStyle = '#1a1d22';
    g.fillRect(-wt / 2 - 20, -H + 56, wt + 40, 8);
    g.strokeStyle = '#1a1d22';
    g.lineWidth = 2;
    for (let x = -wt / 2 - 18; x <= wt / 2 + 18; x += 8) {
      g.beginPath();
      g.moveTo(x, -H + 56);
      g.lineTo(x, -H + 38);
      g.stroke();
    }
    g.fillRect(-wt / 2 - 20, -H + 36, wt + 40, 3);
    g.fillStyle = 'rgba(255,240,200,0.85)';
    g.fillRect(-26, -H + 6, 52, 50);
    g.fillStyle = '#1a1d22';
    for (const x of [-26, -8, 10, 24]) g.fillRect(x, -H + 6, 3, 50);
    g.fillStyle = C.roof;
    g.beginPath();
    g.moveTo(-36, -H + 8);
    g.lineTo(0, -H - 30);
    g.lineTo(36, -H + 8);
    g.fill();
    out.lights.push({ x: 0, y: -H + 30, r: 320, color: 'rgb(255,235,190)', i: 1 });
    out.beams.push({ x: 0, y: -H + 30, len: 1400 });
    return { x0: -wb / 2 - 30, y0: -H - 40, x1: wb / 2 + 30, y1: 4 };
  },

  seaPine(g, d) {
    const s = d.scale || 1;
    g.strokeStyle = '#0d0a09';
    g.lineCap = 'round';
    g.lineWidth = 8 * s;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(-20 * s, -40 * s, 30 * s, -70 * s, 60 * s, -90 * s);
    g.stroke();
    const pad = (x, y, rx, ry) => {
      g.fillStyle = C.pine;
      g.beginPath();
      g.ellipse(x * s, y * s, rx * s, ry * s, -0.2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(150,200,240,0.16)';
      g.beginPath();
      g.ellipse(x * s, (y - ry * 0.5) * s, rx * 0.8 * s, ry * 0.3 * s, -0.2, 0, Math.PI * 2);
      g.fill();
    };
    pad(66, -96, 46, 12);
    pad(30, -74, 32, 10);
    pad(90, -84, 26, 8);
    return { x0: -30 * s, y0: -120 * s, x1: 130 * s, y1: 4 };
  },

  // The great torii standing in the sea. Anchor = waterline; pillars sink below it.
  bigTorii(g, d, out) {
    const s = d.scale || 2;
    const H = 150 * s;
    const W = 150 * s;
    const pillar = (x) => {
      g.fillStyle = C.vermilion;
      g.fillRect(x - 9 * s, -H, 18 * s, H + 80);
      g.fillStyle = C.vermilionLight;
      g.fillRect(x - 9 * s, -H, 4 * s, H + 80);
    };
    pillar(W * 0.22);
    pillar(W * 0.78);
    g.fillStyle = C.vermilion;
    g.fillRect(W * 0.08, -H * 0.78, W * 0.84, 11 * s);
    g.fillStyle = '#0e0909';
    g.beginPath();
    g.moveTo(-W * 0.08, -H - 16 * s);
    g.quadraticCurveTo(W * 0.5, -H + 4 * s, W * 1.08, -H - 16 * s);
    g.lineTo(W * 1.05, -H - 5 * s);
    g.quadraticCurveTo(W * 0.5, -H + 15 * s, -W * 0.05, -H - 5 * s);
    g.fill();
    g.fillStyle = C.vermilion;
    g.fillRect(W * 0.02, -H + 6 * s, W * 0.96, 10 * s);
    g.fillStyle = '#d9cfa8';
    g.fillRect(W * 0.45, -H + 16 * s, W * 0.1, H * 0.2);
    out.lights.push({ x: W / 2, y: -H * 0.6, r: 260, color: 'rgb(255,140,110)', i: 0.35 });
    return { x0: -W * 0.12, y0: -H - 30 * s, x1: W * 1.14, y1: 90 };
  },

  // Vermilion railings and stilts for the floating shrine.
  shrineDeck(g, d, out) {
    const W = d.w * TILE;
    g.fillStyle = C.vermilion;
    for (let x = 0; x <= W; x += 48) {
      g.fillRect(x, -34, 6, 34);
      g.fillRect(x + 1, 10, 7, 120);
    }
    g.fillRect(0, -36, W + 6, 5);
    g.fillRect(0, -18, W + 6, 3);
    g.fillStyle = C.vermilionLight;
    g.fillRect(0, -36, W + 6, 1.5);
    // hanging bronze lanterns
    for (let x = 24; x < W; x += 144) {
      g.strokeStyle = '#1a1210';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, -36);
      g.lineTo(x, -20);
      g.stroke();
      g.fillStyle = '#5a4a2a';
      g.fillRect(x - 6, -20, 12, 14);
      g.fillStyle = 'rgba(255,200,120,0.8)';
      g.fillRect(x - 3, -17, 6, 8);
      out.lights.push({ x, y: -13, r: 90, color: 'rgb(255,190,120)', i: 0.55 });
    }
    return { x0: -4, y0: -40, x1: W + 10, y1: 132 };
  },

  // The Binoshi's summoning circle, still smouldering violet.
  ritual(g, d, out) {
    const r = 70;
    g.strokeStyle = 'rgba(150,80,255,0.75)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, -2, r, 10, 0, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.ellipse(0, -2, r * 0.7, 7, 0, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.7, -2 + Math.sin(a) * 7);
      g.lineTo(Math.cos(a + 2.4) * r * 0.7, -2 + Math.sin(a + 2.4) * 7);
      g.stroke();
    }
    out.lights.push({ x: 0, y: -10, r: 160, color: 'rgb(160,90,255)', i: 0.6 });
    return { x0: -r - 4, y0: -16, x1: r + 4, y1: 12 };
  },

  rocks(g, d) {
    const W = (d.w || 4) * TILE;
    const rnd = mulberry32(d.x);
    for (let i = 0; i < W / 26; i++) {
      const x = 10 + rnd() * (W - 20);
      const r = 10 + rnd() * 16;
      g.fillStyle = rnd() < 0.5 ? '#1c242c' : '#151b22';
      g.beginPath();
      g.ellipse(x, 2 - r * 0.4, r, r * 0.7, rnd() - 0.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(160,210,250,0.18)';
      g.beginPath();
      g.ellipse(x - r * 0.2, -r * 0.8, r * 0.5, r * 0.18, -0.3, 0, Math.PI * 2);
      g.fill();
    }
    return { x0: -20, y0: -40, x1: W + 20, y1: 8 };
  },

  // A cliff face behind the start: rope ladders and a weathered marker post.
  cliffFace(g, d) {
    const W = d.w * TILE;
    const H = d.h * TILE;
    const rnd = mulberry32(d.x + 3);
    g.fillStyle = '#0d1319';
    g.beginPath();
    g.moveTo(0, 0);
    for (let y = 0; y >= -H; y -= 20) g.lineTo(rnd() * 30, y);
    for (let y = -H; y <= 0; y += 20) g.lineTo(W - rnd() * 40, y);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(150,200,240,0.1)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const x = rnd() * W;
      const y = -rnd() * H;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 20 + rnd() * 30, y + 6);
      g.stroke();
    }
    return { x0: -4, y0: -H - 4, x1: W + 4, y1: 4 };
  },

  // Kelp swaying below the surface (anchored at the sea floor).
  kelp(g, d) {
    const W = (d.w || 6) * TILE;
    const H = (d.h || 6) * TILE;
    const rnd = mulberry32(d.x + 11);
    g.strokeStyle = 'rgba(20,50,40,0.9)';
    g.lineCap = 'round';
    for (let i = 0; i < W / 18; i++) {
      const x = rnd() * W;
      const h = H * (0.4 + rnd() * 0.6);
      g.lineWidth = 3 + rnd() * 3;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x - 14, -h * 0.3, x + 14, -h * 0.6, x - 6 + rnd() * 12, -h);
      g.stroke();
    }
    return { x0: -20, y0: -H - 10, x1: W + 20, y1: 4 };
  },
};
