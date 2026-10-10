import { VIEW_W, VIEW_H } from '../config.js';
import { fbm1, mulberry32, noise1 } from '../core/math.js';
import { houseSilhouette, pagodaSilhouette, roofPath, glow, makeCanvas, glowSprite } from './shapes.js';

// Painted night sky over a burning village, in parallax layers.
// Layers are generated once into offscreen canvases and tiled horizontally.

const LAYER_W = 1400;
const LAYER_H = 700;
const BASE = 560; // baseline inside a layer canvas
const REF_TOP = 880; // camera top at which layers sit at their designed height

export class Background {
  constructor(scale, theme = 'fire') {
    this.scale = Math.min(scale, 1.5);
    this.theme = theme;
    this.refTop = REF_TOP;
    if (theme === 'sea') {
      this.initSea();
      return;
    }
    this.layers = [
      this.makeLayer({ fx: 0.05, fy: 0.03, screenBase: 380, seed: 1, paint: paintMountains, fill: '#3a1520' }),
      this.makeLayer({ fx: 0.16, fy: 0.1, screenBase: 420, seed: 2, paint: paintCastleHills, fill: '#1a0c18' }),
      this.makeLayer({ fx: 0.36, fy: 0.22, screenBase: 470, seed: 3, paint: paintVillage, fill: '#120910' }),
    ];
    this.smoke = makeSmokeSprite();
    const rnd = mulberry32(7);
    this.stars = Array.from({ length: 90 }, () => ({ x: rnd() * VIEW_W, y: rnd() * 260, r: rnd() * 1.1 + 0.3, tw: rnd() * 6 }));
  }

  makeLayer({ fx, fy, screenBase, seed, paint, fill }) {
    const c = makeCanvas(LAYER_W * this.scale, LAYER_H * this.scale);
    const g = c.getContext('2d');
    g.scale(this.scale, this.scale);
    const glows = [];
    paint(g, mulberry32(seed), glows);
    return { canvas: c, fx, fy, screenBase, glows, seed, fill };
  }

  draw(ctx, camLeft, camTop, t, weather = null) {
    if (this.theme === 'sea') return this.drawSea(ctx, camLeft, camTop, t, weather);
    // Sky
    const lift = Math.max(0, Math.min(1, (REF_TOP - camTop) / 900));
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, '#07050f');
    sky.addColorStop(0.45 - lift * 0.1, '#1a0b22');
    sky.addColorStop(0.78, '#4a1424');
    sky.addColorStop(1, '#8a2e1c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Stars, dimmed by smoke near the horizon
    for (const s of this.stars) {
      ctx.globalAlpha = (0.35 + 0.35 * Math.sin(t * 1.3 + s.tw)) * (1 - s.y / 300);
      ctx.fillStyle = '#ffe9d6';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Blood moon
    const mx = 700 - (camLeft * 0.015) % 200;
    const my = 120 + (camTop - REF_TOP) * -0.01;
    glow(ctx, mx, my, 210, 'rgb(255,110,60)', 0.35);
    const mg = ctx.createRadialGradient(mx - 14, my - 16, 4, mx, my, 54);
    mg.addColorStop(0, '#ffd9b0');
    mg.addColorStop(0.6, '#f19a6a');
    mg.addColorStop(1, '#b8503a');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#7a2a22';
    for (const [dx, dy, r] of [[-18, 10, 12], [14, -18, 8], [20, 16, 9], [-6, -26, 5]]) {
      ctx.beginPath();
      ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Layers, with drifting smoke between them
    for (let i = 0; i < this.layers.length; i++) {
      const L = this.layers[i];
      this.drawLayer(ctx, L, camLeft, camTop, t);
      if (i === 0 || i === 1) this.drawSmokeBand(ctx, camLeft, camTop, t, i);
    }

    // Heat haze glow along the horizon
    const hz = ctx.createLinearGradient(0, VIEW_H * 0.55, 0, VIEW_H);
    hz.addColorStop(0, 'rgba(255,90,40,0)');
    hz.addColorStop(1, 'rgba(255,90,40,0.16)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // ── Storm-lit sea (Chapter II) ─────────────────────────────
  initSea() {
    this.refTop = 980;
    this.layers = [
      this.makeLayer({ fx: 0.04, fy: 0.03, screenBase: 352, seed: 21, paint: paintFarIsles, fill: '#0e2030' }),
      this.makeLayer({ fx: 0.14, fy: 0.09, screenBase: 372, seed: 22, paint: paintSeaStacks, fill: 'none' }),
      this.makeLayer({ fx: 0.34, fy: 0.2, screenBase: 430, seed: 23, paint: paintCoastCliffs, fill: '#070e16' }),
    ];
    this.cloud = makeCloudSprite();
    this.tentacle = makeTentacleSilhouette();
    const rnd = mulberry32(9);
    this.stars = Array.from({ length: 40 }, () => ({ x: rnd() * VIEW_W, y: rnd() * 120, r: rnd() * 0.9 + 0.3, tw: rnd() * 6 }));
  }

  drawSea(ctx, camLeft, camTop, t, weather) {
    const flash = weather ? weather.flash : 0;
    const dy = (camTop - this.refTop) * 0.03;
    const horizon = 352 - dy;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#02050b');
    sky.addColorStop(0.5, '#071424');
    sky.addColorStop(1, '#1b3850');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, horizon + 2);

    for (const s of this.stars) {
      ctx.globalAlpha = (0.25 + 0.25 * Math.sin(t * 1.1 + s.tw)) * (1 - s.y / 140);
      ctx.fillStyle = '#e6f2ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cold moon behind racing cloud
    const mx = 250 - (camLeft * 0.012) % 300;
    const my = 92 - dy * 2;
    glow(ctx, mx, my, 230, 'rgb(150,190,230)', 0.3);
    const mg = ctx.createRadialGradient(mx - 10, my - 12, 4, mx, my, 40);
    mg.addColorStop(0, '#f4f8ff');
    mg.addColorStop(1, '#a9bed4');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 40, 0, Math.PI * 2);
    ctx.fill();

    // Cloud banks (two speeds)
    for (let band = 0; band < 2; band++) {
      ctx.globalAlpha = band ? 0.85 : 0.6;
      const speed = band ? 22 : 9;
      const y0 = band ? 30 : 110;
      for (let k = 0; k < 7; k++) {
        const span = 1700;
        const x = (((k * 260 + t * speed - camLeft * (band ? 0.03 : 0.015)) % span) + span) % span - 360;
        const w = 420 + (k % 3) * 120;
        ctx.drawImage(this.cloud, x, y0 + Math.sin(k * 2.3) * 30, w, w * 0.42);
      }
    }
    ctx.globalAlpha = 1;

    // Lightning: bolt + something enormous on the horizon
    if (flash > 0) {
      ctx.fillStyle = `rgba(190,215,255,${flash * 0.35})`;
      ctx.fillRect(0, 0, VIEW_W, horizon);
      ctx.globalAlpha = Math.min(1, flash * 1.4);
      const tx = weather.boltX ?? 600;
      ctx.drawImage(this.tentacle, tx - 140, horizon - 230, 280, 240);
      ctx.globalAlpha = 1;
      if (weather.bolt && flash > 0.4) {
        ctx.strokeStyle = `rgba(235,245,255,${flash})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        weather.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y * horizon) : ctx.moveTo(x, y * horizon)));
        ctx.stroke();
      }
    }

    // Far isles + the sea plane
    this.drawLayer(ctx, this.layers[0], camLeft, camTop, t);
    const sea = ctx.createLinearGradient(0, horizon, 0, VIEW_H);
    sea.addColorStop(0, '#16303f');
    sea.addColorStop(0.25, '#0a1a26');
    sea.addColorStop(1, '#040a10');
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, VIEW_W, VIEW_H - horizon);
    // moon path on the water
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const yy = horizon + 4 + i * i * 0.55;
      if (yy > VIEW_H) break;
      const w = 10 + i * 4 + Math.sin(t * 2 + i * 1.7) * 6;
      ctx.fillStyle = `rgba(170,200,230,${0.22 - i * 0.007})`;
      ctx.fillRect(mx - w / 2 + Math.sin(t * 1.3 + i) * 4, yy, w, 1.5);
    }
    ctx.restore();
    // swells
    ctx.strokeStyle = 'rgba(120,160,190,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const yy = horizon + 10 + i * i * 3;
      if (yy > VIEW_H) break;
      ctx.beginPath();
      for (let x = 0; x <= VIEW_W; x += 24) {
        const y = yy + Math.sin(x * 0.012 + t * (0.6 + i * 0.1) + i) * (1 + i * 0.4);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    this.drawLayer(ctx, this.layers[1], camLeft, camTop, t);
    this.drawLayer(ctx, this.layers[2], camLeft, camTop, t);

    // sea mist over everything distant
    const mist = ctx.createLinearGradient(0, horizon - 60, 0, VIEW_H);
    mist.addColorStop(0, 'rgba(120,160,190,0)');
    mist.addColorStop(0.3, 'rgba(120,160,190,0.08)');
    mist.addColorStop(1, 'rgba(60,90,120,0.12)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (flash > 0) {
      ctx.fillStyle = `rgba(200,225,255,${flash * 0.12})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawLayer(ctx, L, camLeft, camTop, t) {
    const top = L.screenBase - BASE - (camTop - this.refTop) * L.fy;
    if (top > VIEW_H) return;
    let ox = -((camLeft * L.fx) % LAYER_W);
    if (ox > 0) ox -= LAYER_W;
    for (let x = ox; x < VIEW_W; x += LAYER_W) {
      ctx.drawImage(L.canvas, x, top, LAYER_W, LAYER_H);
      for (const g of L.glows) {
        const flick = 0.7 + 0.3 * noise1(t * 2.2 + g.seed, g.seed);
        const gx = x + g.x;
        if (gx < -g.r || gx > VIEW_W + g.r) continue;
        glow(ctx, gx, top + g.y, g.r * (0.9 + flick * 0.15), g.color, g.a * flick);
      }
    }
    // Fill below the layer so it never shows a seam
    const bottom = top + LAYER_H;
    if (bottom < VIEW_H && L.fill !== 'none') {
      ctx.fillStyle = L.fill || '#0d070c';
      ctx.fillRect(0, bottom - 1, VIEW_W, VIEW_H - bottom + 1);
    }
  }

  drawSmokeBand(ctx, camLeft, camTop, t, i) {
    const fx = i === 0 ? 0.1 : 0.26;
    const fy = i === 0 ? 0.06 : 0.16;
    const baseY = (i === 0 ? 300 : 360) - (camTop - this.refTop) * fy;
    ctx.globalAlpha = i === 0 ? 0.32 : 0.26;
    for (let k = 0; k < 9; k++) {
      const span = 1600;
      let x = ((k * 233 + t * (12 + k * 2) - camLeft * fx) % span + span) % span - 300;
      const y = baseY + Math.sin(k * 1.9) * 40 - k * 6;
      const s = 260 + (k % 3) * 90;
      ctx.drawImage(this.smoke, x, y - s / 2, s * 1.6, s);
    }
    ctx.globalAlpha = 1;
  }
}

function makeSmokeSprite() {
  const c = makeCanvas(256, 160);
  const g = c.getContext('2d');
  const rnd = mulberry32(11);
  for (let i = 0; i < 26; i++) {
    const x = 40 + rnd() * 176;
    const y = 50 + rnd() * 60;
    const r = 20 + rnd() * 40;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(58,26,38,0.55)');
    grad.addColorStop(1, 'rgba(58,26,38,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

// ── Layer painters ────────────────────────────────────────────
function paintMountains(g, rnd) {
  const ridge = (seed, amp, base, color, freq) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, LAYER_H);
    for (let x = 0; x <= LAYER_W; x += 8) {
      // wrap the noise so the layer tiles seamlessly
      const u = x / LAYER_W;
      const n = fbm1(u * freq, seed) * (1 - u) + fbm1((u - 1) * freq, seed) * u;
      g.lineTo(x, base - n * amp);
    }
    g.lineTo(LAYER_W, LAYER_H);
    g.closePath();
    g.fill();
  };
  ridge(3, 300, BASE - 60, '#1d0f25', 6);
  // ember rim on the near ridge
  const grad = g.createLinearGradient(0, BASE - 260, 0, BASE + 40);
  grad.addColorStop(0, '#2a1229');
  grad.addColorStop(1, '#3a1520');
  ridge(5, 200, BASE + 10, grad, 9);
}

function paintCastleHills(g, rnd, glows) {
  // rolling hills
  g.fillStyle = '#1a0c18';
  g.beginPath();
  g.moveTo(0, LAYER_H);
  for (let x = 0; x <= LAYER_W; x += 10) {
    const u = x / LAYER_W;
    const n = fbm1(u * 5, 21) * (1 - u) + fbm1((u - 1) * 5, 21) * u;
    g.lineTo(x, BASE - 40 - n * 120);
  }
  g.lineTo(LAYER_W, LAYER_H);
  g.fill();

  // a castle keep on the hill
  const cx = 420;
  const by = BASE - 90;
  g.fillStyle = '#1a0c18';
  g.beginPath();
  g.moveTo(cx - 120, by + 30);
  g.lineTo(cx - 90, by - 20);
  g.lineTo(cx + 90, by - 20);
  g.lineTo(cx + 120, by + 30);
  g.fill();
  let tw = 170;
  let y = by - 20;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.rect(cx - tw * 0.36, y - 34, tw * 0.72, 34);
    roofPath(g, cx - tw / 2, y - 30, tw, 20, 0.14);
    g.fill();
    y -= 32;
    tw *= 0.78;
  }
  glows.push({ x: cx + 30, y: by - 60, r: 140, color: 'rgb(255,100,40)', a: 0.5, seed: 1 });

  // distant pagodas and trees
  g.fillStyle = '#1a0c18';
  pagodaSilhouette(g, 980, BASE - 80, 70, 5, 26);
  pagodaSilhouette(g, 1220, BASE - 60, 50, 3, 22);
  for (let i = 0; i < 24; i++) {
    const x = rnd() * LAYER_W;
    const h = 30 + rnd() * 50;
    const yb = BASE - 50 - rnd() * 40;
    g.beginPath();
    g.ellipse(x, yb - h * 0.6, h * 0.35, h * 0.5, 0, 0, Math.PI * 2);
    g.rect(x - 2, yb - h * 0.3, 4, h * 0.4);
    g.fill();
  }
  for (const x of [200, 760, 1100, 1330]) glows.push({ x, y: BASE - 70, r: 110, color: 'rgb(255,90,40)', a: 0.4, seed: x });
  // smoke columns rising from fires
  for (const x of [450, 980]) {
    const grad = g.createLinearGradient(0, BASE - 500, 0, BASE - 80);
    grad.addColorStop(0, 'rgba(40,18,30,0)');
    grad.addColorStop(1, 'rgba(40,18,30,0.55)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - 20, BASE - 90);
    g.bezierCurveTo(x - 60, BASE - 260, x + 40, BASE - 380, x - 30, BASE - 520);
    g.lineTo(x + 140, BASE - 520);
    g.bezierCurveTo(x + 120, BASE - 360, x + 40, BASE - 240, x + 30, BASE - 90);
    g.fill();
  }
}

function paintVillage(g, rnd, glows) {
  const col = '#120910';
  g.fillStyle = col;
  g.fillRect(0, BASE - 10, LAYER_W, LAYER_H);
  let x = -20;
  let i = 0;
  while (x < LAYER_W) {
    const w = 90 + rnd() * 90;
    const h = 40 + rnd() * 50;
    const rise = 26 + rnd() * 20;
    g.fillStyle = col;
    houseSilhouette(g, x, BASE, w, h, rise);
    // lit windows
    if (rnd() < 0.55) {
      g.fillStyle = 'rgba(255,140,60,0.5)';
      const wx = x + w * (0.25 + rnd() * 0.4);
      g.fillRect(wx, BASE - h * 0.6, 10, 8);
    }
    if (rnd() < 0.45) glows.push({ x: x + w / 2, y: BASE - h - rise * 0.5, r: 90 + rnd() * 60, color: 'rgb(255,110,40)', a: 0.55, seed: i * 3.3 });
    // occasional tall tree or bamboo cluster
    if (rnd() < 0.3) {
      const tx = x + w + 10;
      g.fillStyle = col;
      for (let k = 0; k < 4; k++) g.fillRect(tx + k * 6, BASE - 120 - rnd() * 60, 3, 200);
    }
    x += w + 10 + rnd() * 30;
    i++;
  }
  // a pagoda in the middle distance
  g.fillStyle = col;
  pagodaSilhouette(g, 820, BASE, 120, 5, 40);
  glows.push({ x: 820, y: BASE - 160, r: 160, color: 'rgb(255,120,50)', a: 0.45, seed: 99 });
}

// ── Sea painters ─────────────────────────────────────────────
function paintFarIsles(g, rnd) {
  g.fillStyle = '#0e2030';
  for (const [cx, w, h] of [[160, 420, 70], [700, 300, 46], [1120, 520, 90]]) {
    g.beginPath();
    g.moveTo(cx - w / 2, BASE);
    for (let x = -w / 2; x <= w / 2; x += 10) {
      const u = (x + w / 2) / w;
      g.lineTo(cx + x, BASE - Math.sin(u * Math.PI) * h * (0.7 + 0.3 * fbm1(u * 6, cx)));
    }
    g.closePath();
    g.fill();
  }
  // a tiny far lighthouse blink would be nice; keep it a silhouette
  g.fillRect(700 - 3, BASE - 66, 6, 22);
}

function paintSeaStacks(g, rnd, glows) {
  g.fillStyle = '#0b1824';
  const stack = (x, w, h) => {
    g.beginPath();
    g.moveTo(x - w / 2, BASE + 8);
    g.lineTo(x - w * 0.42, BASE - h * 0.6);
    g.lineTo(x - w * 0.3, BASE - h);
    g.lineTo(x + w * 0.25, BASE - h * 0.96);
    g.lineTo(x + w * 0.45, BASE - h * 0.5);
    g.lineTo(x + w / 2, BASE + 8);
    g.fill();
    // wind-bent pine on top
    g.beginPath();
    g.ellipse(x - w * 0.05, BASE - h - 10, w * 0.32, 8, -0.15, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - w * 0.05 - 1.5, BASE - h - 10, 3, 12);
  };
  stack(120, 60, 120);
  stack(220, 40, 80);
  stack(860, 70, 150);
  stack(1240, 50, 100);
  // a wrecked junk, listing
  g.save();
  g.translate(520, BASE + 4);
  g.rotate(-0.12);
  g.beginPath();
  g.moveTo(-90, -10);
  g.quadraticCurveTo(0, 10, 100, -26);
  g.lineTo(90, 0);
  g.lineTo(-80, 6);
  g.fill();
  g.fillRect(-10, -120, 5, 115);
  g.fillRect(40, -90, 4, 80);
  g.beginPath();
  g.moveTo(-5, -112);
  g.lineTo(-60, -70);
  g.lineTo(-8, -40);
  g.fill();
  g.restore();
  // a great torii standing in the water, far off
  g.fillRect(1030, BASE - 90, 7, 96);
  g.fillRect(1078, BASE - 90, 7, 96);
  g.fillRect(1018, BASE - 98, 80, 8);
  g.fillRect(1024, BASE - 80, 68, 5);
  glows.push({ x: 1058, y: BASE - 60, r: 70, color: 'rgb(170,90,255)', a: 0.25, seed: 4 });
}

function paintCoastCliffs(g, rnd, glows) {
  const col = '#070e16';
  g.fillStyle = col;
  g.fillRect(0, BASE - 6, LAYER_W, LAYER_H);
  // rolling headland
  g.beginPath();
  g.moveTo(0, LAYER_H);
  for (let x = 0; x <= LAYER_W; x += 10) {
    const u = x / LAYER_W;
    const n = fbm1(u * 4, 31) * (1 - u) + fbm1((u - 1) * 4, 31) * u;
    g.lineTo(x, BASE - 10 - n * 90);
  }
  g.lineTo(LAYER_W, LAYER_H);
  g.fill();
  // stilt huts with warm windows
  for (let i = 0; i < 6; i++) {
    const x = 80 + i * 230 + rnd() * 60;
    const w = 70 + rnd() * 40;
    const by = BASE - 30 - rnd() * 40;
    g.fillStyle = col;
    for (let k = 0; k < 4; k++) g.fillRect(x + k * (w / 3), by, 3, 80);
    houseSilhouette(g, x - 4, by, w, 30, 22);
    if (rnd() < 0.7) {
      g.fillStyle = 'rgba(255,190,120,0.55)';
      g.fillRect(x + w * 0.4, by - 20, 8, 7);
      glows.push({ x: x + w * 0.45, y: by - 18, r: 40, color: 'rgb(255,170,90)', a: 0.45, seed: i * 7 });
    }
  }
  // pines
  g.fillStyle = col;
  for (let i = 0; i < 10; i++) {
    const x = rnd() * LAYER_W;
    const yb = BASE - 40 - rnd() * 60;
    g.beginPath();
    g.ellipse(x, yb - 40, 26, 9, -0.2, 0, Math.PI * 2);
    g.ellipse(x + 10, yb - 62, 20, 7, 0.1, 0, Math.PI * 2);
    g.rect(x - 2, yb - 60, 4, 70);
    g.fill();
  }
}

function makeCloudSprite() {
  const c = makeCanvas(300, 130);
  const g = c.getContext('2d');
  const rnd = mulberry32(5);
  for (let i = 0; i < 30; i++) {
    const x = 30 + rnd() * 240;
    const y = 40 + rnd() * 50;
    const r = 20 + rnd() * 40;
    const grad = g.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
    grad.addColorStop(0, 'rgba(46,62,82,0.75)');
    grad.addColorStop(0.6, 'rgba(22,32,46,0.6)');
    grad.addColorStop(1, 'rgba(14,22,32,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c;
}

// The thing in the storm: a vast arm curling up from the horizon.
function makeTentacleSilhouette() {
  const c = makeCanvas(280, 240);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,14,22,0.9)';
  const arm = (x0, lean, curl, h, w) => {
    const L = [];
    const R = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30;
      const a = -Math.PI / 2 + lean * u + curl * u * u * u;
      const px = x0 + Math.cos(a) * 0;
      L.push([u, a]);
    }
    let x = x0;
    let y = 240;
    const pts = [];
    for (const [u, a] of L) {
      x += Math.cos(a) * (h / 30);
      y += Math.sin(a) * (h / 30);
      pts.push([x, y, w * (1 - u * 0.9)]);
    }
    g.beginPath();
    pts.forEach(([px, py, ww], i) => (i ? g.lineTo(px - ww, py) : g.moveTo(px - ww, py)));
    for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0] + pts[i][2], pts[i][1]);
    g.closePath();
    g.fill();
  };
  arm(90, 0.6, 2.6, 260, 22);
  arm(190, -0.4, -2.2, 200, 16);
  return c;
}

export { glowSprite };
