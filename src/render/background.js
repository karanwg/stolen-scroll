import { VIEW_W, VIEW_H } from '../config.js';
import { fbm1, mulberry32, noise1 } from '../core/math.js';
import { houseSilhouette, pagodaSilhouette, roofPath, glow, makeCanvas, glowSprite } from './shapes.js';
import { drawFlayer } from './flayerArt.js';

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
    if (theme === 'snow') {
      this.initSnow();
      return;
    }
    if (theme === 'derelict') {
      this.initDerelict();
      return;
    }
    if (theme === 'crater') {
      this.initCrater();
      return;
    }
    if (theme === 'ship' || theme === 'nest') {
      this.initShip(theme === 'nest');
      return;
    }
    if (theme === 'kagari' || theme === 'upside' || theme === 'dawn') {
      this.initKagari(theme);
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
    if (this.theme === 'snow') return this.drawSnow(ctx, camLeft, camTop, t);
    if (this.theme === 'derelict') return this.drawDerelict(ctx, camLeft, camTop, t);
    if (this.theme === 'crater') return this.drawCrater(ctx, camLeft, camTop, t);
    if (this.theme === 'ship' || this.theme === 'nest') return this.drawShip(ctx, camLeft, camTop, t);
    if (this.theme === 'kagari' || this.theme === 'upside' || this.theme === 'dawn') return this.drawKagari(ctx, camLeft, camTop, t, weather);
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

  // ── Moonlit mountains (Chapter III, first half) ────────────
  initSnow() {
    this.refTop = 1150;
    this.layers = [
      this.makeLayer({ fx: 0.03, fy: 0.02, screenBase: 330, seed: 31, paint: paintFarPeaks, fill: '#1c2a44' }),
      this.makeLayer({ fx: 0.12, fy: 0.07, screenBase: 380, seed: 32, paint: paintMidRanges, fill: '#132036' }),
      this.makeLayer({ fx: 0.3, fy: 0.18, screenBase: 450, seed: 33, paint: paintSnowForest, fill: '#0c1424' }),
    ];
    const rnd = mulberry32(13);
    this.stars = Array.from({ length: 140 }, () => ({ x: rnd() * VIEW_W, y: rnd() * 300, r: rnd() * 1.2 + 0.3, tw: rnd() * 6 }));
  }

  drawSnow(ctx, camLeft, camTop, t) {
    const dy = this.drawNightSky(ctx, camLeft, camTop, t, 1);
    // the fallen star's glow, rising from behind the far peaks
    const starX = 1700 - camLeft * 0.03;
    glow(ctx, ((starX % 1600) + 1600) % 1600 - 200, 330 - dy, 300, 'rgb(90,255,170)', 0.22 + 0.05 * Math.sin(t * 0.8));
    for (let i = 0; i < this.layers.length; i++) this.drawLayer(ctx, this.layers[i], camLeft, camTop, t);
    // valley fog
    const fog = ctx.createLinearGradient(0, VIEW_H * 0.55, 0, VIEW_H);
    fog.addColorStop(0, 'rgba(160,185,220,0)');
    fog.addColorStop(1, 'rgba(160,185,220,0.12)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // Stars, aurora and moon over the mountains; returns the vertical drift.
  drawNightSky(ctx, camLeft, camTop, t, aurora) {
    const dy = (camTop - this.refTop) * 0.02;
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, '#040812');
    sky.addColorStop(0.5, '#0b1630');
    sky.addColorStop(1, '#203457');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (const st of this.stars) {
      ctx.globalAlpha = (0.45 + 0.35 * Math.sin(t * 1.4 + st.tw)) * (1 - st.y / 360);
      ctx.fillStyle = '#eef4ff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // aurora: slow, swaying ribbons
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band++) {
      const baseY = 70 + band * 34 - dy * 2;
      const col = band === 1 ? '120,255,190' : band === 2 ? '150,120,255' : '90,230,200';
      for (let x = -40; x < VIEW_W + 40; x += 6) {
        const u = (x + camLeft * 0.02) * 0.004;
        const y = baseY + Math.sin(u * 3 + t * 0.25 + band) * 24 + Math.sin(u * 7 - t * 0.4) * 8;
        const hgt = 40 + 30 * Math.sin(u * 5 + t * 0.3 + band * 2);
        const a = 0.05 + 0.04 * Math.sin(u * 9 + t * 0.7 + band);
        const g = ctx.createLinearGradient(0, y - hgt, 0, y);
        g.addColorStop(0, `rgba(${col},0)`);
        g.addColorStop(1, `rgba(${col},${a})`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y - hgt, 7, hgt);
      }
    }
    ctx.restore();
    // full moon
    const mx = 760 - (camLeft * 0.01) % 300;
    const my = 96 - dy * 2;
    glow(ctx, mx, my, 220, 'rgb(190,210,255)', 0.35);
    const mg = ctx.createRadialGradient(mx - 10, my - 12, 3, mx, my, 44);
    mg.addColorStop(0, '#ffffff');
    mg.addColorStop(1, '#c6d4ea');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, 44, 0, Math.PI * 2);
    ctx.fill();
    return dy;
  }

  // ── The crater: the night sky over a scar of glass and smoke ─
  initCrater() {
    this.refTop = 1150;
    this.layers = [
      this.makeLayer({ fx: 0.03, fy: 0.02, screenBase: 330, seed: 31, paint: paintFarPeaks, fill: '#1c2a44' }),
      this.makeLayer({ fx: 0.14, fy: 0.08, screenBase: 420, seed: 71, paint: paintCraterRim, fill: '#071012' }),
    ];
    const rnd = mulberry32(13);
    this.stars = Array.from({ length: 140 }, () => ({ x: rnd() * VIEW_W, y: rnd() * 300, r: rnd() * 1.2 + 0.3, tw: rnd() * 6 }));
    const r2 = mulberry32(77);
    this.plume = Array.from({ length: 26 }, (_, i) => ({ k: i / 26, ox: (r2() - 0.5) * 60, r: 40 + r2() * 50, seed: r2() * 10 }));
  }

  drawCrater(ctx, camLeft, camTop, t) {
    const dy = this.drawNightSky(ctx, camLeft, camTop, t, 1);
    this.drawLayer(ctx, this.layers[0], camLeft, camTop, t);
    // the crash glow, close now, and its column of smoke leaning in the wind
    const px = 620 - camLeft * 0.06 + 13200 * 0.06;
    glow(ctx, px, 470 - dy, 420, 'rgb(90,255,170)', 0.3 + 0.06 * Math.sin(t * 0.7));
    for (const b of this.plume) {
      const k = (b.k + t * 0.012) % 1;
      const x = px + b.ox * (1 + k) + k * 260 + Math.sin(t * 0.3 + b.seed) * 20;
      const y = 470 - dy - k * 520;
      const r = b.r * (0.6 + k * 1.6);
      const a = 0.32 * Math.sin(k * Math.PI);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(30,44,46,${a})`);
      g.addColorStop(1, 'rgba(30,44,46,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    this.drawLayer(ctx, this.layers[1], camLeft, camTop, t);
    const fog = ctx.createLinearGradient(0, VIEW_H * 0.5, 0, VIEW_H);
    fog.addColorStop(0, 'rgba(90,200,160,0)');
    fog.addColorStop(1, 'rgba(90,200,160,0.1)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // ── Inside the Tethys: the corridor's back wall ─────────────
  initShip(nest) {
    this.refTop = 1150;
    this.nest = nest;
    this.wall = this.makeLayer({ fx: 0.9, fy: 0.9, screenBase: 0, seed: nest ? 82 : 81, paint: nest ? paintNestWall : paintShipWall, fill: 'none' });
    this.deep = this.makeLayer({ fx: 0.6, fy: 0.6, screenBase: 0, seed: 83, paint: paintShipDeep, fill: 'none' });
  }

  drawShip(ctx, camLeft, camTop, t) {
    ctx.fillStyle = this.nest ? '#060506' : '#07090c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawTiled(ctx, this.deep, camLeft, camTop, t);
    this.drawTiled(ctx, this.wall, camLeft, camTop, t);
  }

  // ── Chapter IV: Kagari, the Upside Down beneath it, and dawn ─
  initKagari(kind) {
    this.refTop = 1100;
    this.kind = kind;
    const ud = kind === 'upside';
    const dawn = kind === 'dawn';
    const far = ud ? '#0e1520' : dawn ? '#6a4a62' : '#1c0e1a';
    const mid = ud ? '#0a1018' : dawn ? '#4a3048' : '#140912';
    const near = ud ? '#070b11' : dawn ? '#30202e' : '#0d060c';
    this.layers = [
      this.makeLayer({ fx: 0.04, fy: 0.03, screenBase: 360, seed: 91, paint: (g, rnd, gl) => paintKagariRidge(g, rnd, far, ud ? 0 : 1), fill: far }),
      this.makeLayer({ fx: 0.14, fy: 0.08, screenBase: 410, seed: 92, paint: (g, rnd, gl) => paintKagariCastle(g, rnd, gl, mid, ud, dawn), fill: mid }),
      this.makeLayer({ fx: 0.32, fy: 0.18, screenBase: 470, seed: 93, paint: (g, rnd, gl) => paintKagariTown(g, rnd, gl, near, ud, dawn), fill: near }),
    ];
    const rnd = mulberry32(17);
    this.stars = Array.from({ length: 110 }, () => ({ x: rnd() * VIEW_W, y: rnd() * 260, r: rnd() * 1.1 + 0.3, tw: rnd() * 6 }));
    this.clouds = Array.from({ length: 12 }, (_, i) => ({ x: rnd() * 1600, y: 40 + rnd() * 170, w: 160 + rnd() * 260, h: 30 + rnd() * 40, v: 4 + rnd() * 8, seed: i }));
  }

  drawKagari(ctx, camLeft, camTop, t, weather) {
    const kind = this.kind;
    const ud = kind === 'upside';
    const dawn = kind === 'dawn';
    const dy = (camTop - this.refTop) * 0.02;
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    if (ud) {
      sky.addColorStop(0, '#04070c');
      sky.addColorStop(0.55, '#0f1824');
      sky.addColorStop(1, '#1a2533');
    } else if (dawn) {
      sky.addColorStop(0, '#2a2a5a');
      sky.addColorStop(0.45, '#c8708a');
      sky.addColorStop(0.75, '#f2a878');
      sky.addColorStop(1, '#ffd6a0');
    } else {
      // the sky has been red for three nights
      sky.addColorStop(0, '#07050d');
      sky.addColorStop(0.45, '#22091a');
      sky.addColorStop(0.8, '#5a1420');
      sky.addColorStop(1, '#7a2420');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!dawn) {
      for (const st of this.stars) {
        ctx.globalAlpha = (0.3 + 0.3 * Math.sin(t * 1.3 + st.tw)) * (1 - st.y / 300) * (ud ? 0.4 : 1);
        ctx.fillStyle = '#ffe9e0';
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (dawn) {
      // the sun coming up over the mountains
      const sy = 360 - dy * 2;
      glow(ctx, 640, sy, 420, 'rgb(255,200,140)', 0.6);
      ctx.fillStyle = '#fff2d6';
      ctx.beginPath();
      ctx.arc(640, sy, 46, 0, Math.PI * 2);
      ctx.fill();
    } else if (!ud) {
      // a blood moon behind thin red cloud
      const mx = 720 - ((camLeft * 0.012) % 200);
      const my = 110 - dy * 2;
      glow(ctx, mx, my, 200, 'rgb(255,90,70)', 0.35);
      const mg = ctx.createRadialGradient(mx - 10, my - 12, 4, mx, my, 40);
      mg.addColorStop(0, '#ffcab8');
      mg.addColorStop(1, '#c0503e');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(mx, my, 40, 0, Math.PI * 2);
      ctx.fill();
    }
    // the storm (Upside Down) or the red cloud (Kagari)
    if (ud) {
      // the thing in the storm, moving slowly behind the cloud
      const fx = 520 + Math.sin(t * 0.05) * 160 - ((camLeft * 0.03) % 1200);
      const flash = weather?.flash || 0;
      // during the reveal it slides into view and leans closer
      const pin = this.flayerPin || 0;
      const X = (((fx % 1400) + 1400) % 1400 - 200) * (1 - pin) + 600 * pin;
      const Y = 120 - dy * 3 - pin * 40;
      this.flayerAt = { x: X, y: Y + 60, pin };
      // the storm is lit from inside, so its shape stands out against it
      glow(ctx, X, Y + 60, 520 + pin * 120, 'rgb(150,50,60)', 0.5 + pin * 0.45 + flash * 0.4);
      glow(ctx, X - 200, Y + 140, 300, 'rgb(60,90,120)', 0.35);
      drawFlayer(ctx, X, Y, 0.55 + pin * 0.2, t, { alpha: 0.85, glow: 0.25 + pin * 0.5 + flash * 0.75, colour: '#020408' });
      // red lightning
      if (weather?.bolt && flash > 0.2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,80,60,${flash})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        weather.bolt.forEach(([bx, by], i) => (i ? ctx.lineTo(bx, by * 300) : ctx.moveTo(bx, by * 300)));
        ctx.stroke();
        ctx.restore();
      }
    }
    for (const c of this.clouds) {
      const x = ((c.x + t * c.v - camLeft * 0.05) % 1700 + 1700) % 1700 - 300;
      const g = ctx.createRadialGradient(x, c.y - dy, 4, x, c.y - dy, c.w * 0.6);
      const col = ud ? (weather?.flash > 0 ? `rgba(120,30,40,${0.5 + weather.flash * 0.3})` : 'rgba(14,20,30,0.75)') : dawn ? 'rgba(255,190,190,0.35)' : 'rgba(110,20,30,0.35)';
      g.addColorStop(0, col);
      g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, c.y - dy, c.w * 0.6, c.h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const L of this.layers) this.drawLayer(ctx, L, camLeft, camTop, t);
    const fog = ctx.createLinearGradient(0, VIEW_H * 0.55, 0, VIEW_H);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(1, ud ? 'rgba(60,80,100,0.16)' : dawn ? 'rgba(255,210,200,0.15)' : 'rgba(120,40,50,0.14)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // A layer repeated in both directions (walls, not skylines).
  drawTiled(ctx, L, camLeft, camTop, t) {
    let ox = -((camLeft * L.fx) % LAYER_W);
    if (ox > 0) ox -= LAYER_W;
    let oy = -((camTop * L.fy) % LAYER_H);
    if (oy > 0) oy -= LAYER_H;
    for (let y = oy; y < VIEW_H; y += LAYER_H) {
      for (let x = ox; x < VIEW_W; x += LAYER_W) {
        ctx.drawImage(L.canvas, x, y, LAYER_W, LAYER_H);
        for (const g of L.glows) {
          const gx = x + g.x;
          const gy = y + g.y;
          if (gx < -g.r || gx > VIEW_W + g.r || gy < -g.r || gy > VIEW_H + g.r) continue;
          const on = g.blink ? (Math.sin(t * g.blink + g.seed) > 0.2 ? 1 : 0.15) : 0.7 + 0.3 * noise1(t * 2.2 + g.seed, g.seed);
          glow(ctx, gx, gy, g.r, g.color, g.a * on);
        }
      }
    }
  }

  // ── Inside the derelict (Chapter III, second half) ─────────
  initDerelict() {
    this.refTop = 1150;
    this.layers = [
      this.makeLayer({ fx: 0.08, fy: 0.05, screenBase: 600, seed: 41, paint: paintHullCavern, fill: '#070b0b' }),
      this.makeLayer({ fx: 0.26, fy: 0.15, screenBase: 640, seed: 42, paint: paintConduits, fill: 'none' }),
    ];
    this.boneWall = this.makeLayer({ fx: 0.85, fy: 0.85, screenBase: 0, seed: 43, paint: paintBoneWall, fill: 'none' });
  }

  drawDerelict(ctx, camLeft, camTop, t) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#020404');
    g.addColorStop(0.5, '#071010');
    g.addColorStop(1, '#030606');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawLayer(ctx, this.layers[0], camLeft, camTop, t);
    // a slow pulse moving through the walls, like something breathing
    const pulse = Math.max(0, Math.sin(t * 1.1)) ** 6;
    ctx.fillStyle = `rgba(60,140,110,${0.05 * pulse})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.drawLayer(ctx, this.layers[1], camLeft, camTop, t);
    this.drawTiled(ctx, this.boneWall, camLeft, camTop, t);
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

// ── Snow painters ────────────────────────────────────────────
function ridgeWithSnow(g, seed, amp, base, rock, snow, freq, snowline) {
  const pts = [];
  for (let x = 0; x <= LAYER_W; x += 6) {
    const u = x / LAYER_W;
    const n = fbm1(u * freq, seed) * (1 - u) + fbm1((u - 1) * freq, seed) * u;
    pts.push([x, base - n * amp]);
  }
  g.fillStyle = rock;
  g.beginPath();
  g.moveTo(0, LAYER_H);
  for (const [x, y] of pts) g.lineTo(x, y);
  g.lineTo(LAYER_W, LAYER_H);
  g.fill();
  // snow on everything above the snowline, ragged at the bottom
  g.save();
  g.beginPath();
  g.moveTo(0, LAYER_H);
  for (const [x, y] of pts) g.lineTo(x, y);
  g.lineTo(LAYER_W, LAYER_H);
  g.clip();
  g.fillStyle = snow;
  g.beginPath();
  g.moveTo(0, 0);
  for (let x = 0; x <= LAYER_W; x += 12) g.lineTo(x, snowline + fbm1(x * 0.02, seed + 5) * 60 - 30);
  g.lineTo(LAYER_W, 0);
  g.fill();
  g.restore();
}

function paintFarPeaks(g) {
  ridgeWithSnow(g, 51, 380, BASE + 20, '#1c2a44', '#8fa3c4', 5, BASE - 220);
}

function paintMidRanges(g, rnd, glows) {
  ridgeWithSnow(g, 52, 230, BASE + 10, '#132036', '#6f84a8', 7, BASE - 130);
  // a cliff temple far off, windows lit
  g.fillStyle = '#132036';
  pagodaSilhouette(g, 960, BASE - 150, 60, 4, 22);
  g.fillStyle = 'rgba(255,190,120,0.6)';
  g.fillRect(956, BASE - 186, 8, 6);
  glows.push({ x: 960, y: BASE - 180, r: 60, color: 'rgb(255,180,110)', a: 0.4, seed: 2 });
}

function paintSnowForest(g, rnd) {
  const col = '#0c1424';
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, LAYER_H);
  for (let x = 0; x <= LAYER_W; x += 10) {
    const u = x / LAYER_W;
    const n = fbm1(u * 4, 61) * (1 - u) + fbm1((u - 1) * 4, 61) * u;
    g.lineTo(x, BASE - 20 - n * 70);
  }
  g.lineTo(LAYER_W, LAYER_H);
  g.fill();
  // snow-laden cedars
  for (let i = 0; i < 60; i++) {
    const x = rnd() * LAYER_W;
    const h = 50 + rnd() * 70;
    const yb = BASE - 20 - rnd() * 30;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, yb - h);
    g.lineTo(x - h * 0.28, yb);
    g.lineTo(x + h * 0.28, yb);
    g.fill();
    g.fillStyle = 'rgba(200,215,240,0.55)';
    for (let k = 0; k < 3; k++) {
      const ky = yb - h * (0.25 + k * 0.25);
      const kw = h * 0.28 * (1 - (k + 1) * 0.22);
      g.beginPath();
      g.moveTo(x - kw, ky + 4);
      g.quadraticCurveTo(x, ky - 6, x + kw, ky + 4);
      g.lineTo(x, ky);
      g.fill();
    }
  }
}

// ── Derelict painters ────────────────────────────────────────
function paintHullCavern(g, rnd, glows) {
  // great curved ribs of the hull receding into darkness
  for (let i = 0; i < 9; i++) {
    const x = i * 160 + rnd() * 30;
    const grad = g.createLinearGradient(x - 40, 0, x + 40, 0);
    grad.addColorStop(0, 'rgba(14,22,22,0)');
    grad.addColorStop(0.5, 'rgba(24,36,36,0.95)');
    grad.addColorStop(1, 'rgba(14,22,22,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x - 50, LAYER_H);
    g.bezierCurveTo(x - 70, BASE - 250, x - 10, 40, x + 90, -20);
    g.lineTo(x + 120, -20);
    g.bezierCurveTo(x + 20, 60, x - 20, BASE - 240, x + 10, LAYER_H);
    g.fill();
    // vertebra-like nodes along the rib
    g.fillStyle = 'rgba(40,58,56,0.8)';
    for (let k = 0; k < 6; k++) {
      const u = k / 6;
      g.beginPath();
      g.ellipse(x - 50 + u * 90 + Math.sin(u * 3) * 10, LAYER_H - u * (LAYER_H + 20), 9, 5, 0.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  // distant cold lights
  for (let i = 0; i < 6; i++) glows.push({ x: rnd() * LAYER_W, y: 120 + rnd() * 300, r: 50 + rnd() * 40, color: 'rgb(90,220,170)', a: 0.25, seed: i * 3 });
}

function paintConduits(g, rnd) {
  // pipes and cables crossing closer to the camera
  g.strokeStyle = 'rgba(10,16,16,0.95)';
  g.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const y = 60 + rnd() * 500;
    g.lineWidth = 6 + rnd() * 14;
    g.beginPath();
    g.moveTo(-20, y);
    g.bezierCurveTo(LAYER_W * 0.3, y + (rnd() - 0.5) * 200, LAYER_W * 0.6, y + (rnd() - 0.5) * 200, LAYER_W + 20, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(80,120,110,0.15)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const y = 60 + rnd() * 500;
    g.beginPath();
    g.moveTo(-20, y);
    g.bezierCurveTo(LAYER_W * 0.3, y + (rnd() - 0.5) * 200, LAYER_W * 0.6, y + (rnd() - 0.5) * 200, LAYER_W + 20, y);
    g.stroke();
  }
}

// ── Chapter IV painters ──────────────────────────────────────
function paintKagariRidge(g, rnd, col) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, LAYER_H);
  for (let x = 0; x <= LAYER_W; x += 12) {
    const u = x / LAYER_W;
    const n = fbm1(u * 5, 94) * (1 - u) + fbm1((u - 1) * 5, 94) * u;
    g.lineTo(x, BASE - 140 - n * 120);
  }
  g.lineTo(LAYER_W, LAYER_H);
  g.fill();
}

function paintKagariCastle(g, rnd, glows, col, ud, dawn) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, LAYER_H);
  for (let x = 0; x <= LAYER_W; x += 10) g.lineTo(x, BASE - 60 - Math.sin(x * 0.006) * 30 - fbm1(x * 0.01, 95) * 30);
  g.lineTo(LAYER_W, LAYER_H);
  g.fill();
  // the castle on its hill, and the pagoda you climbed
  g.fillStyle = col;
  pagodaSilhouette(g, 380, BASE - 80, 90, 3, 34);
  pagodaSilhouette(g, 1080, BASE - 70, 70, 5, 30);
  if (!ud) {
    g.fillStyle = dawn ? 'rgba(255,220,180,0.35)' : 'rgba(255,180,110,0.55)';
    g.fillRect(372, BASE - 128, 6, 5);
    g.fillRect(388, BASE - 150, 5, 5);
    glows.push({ x: 380, y: BASE - 130, r: 60, color: 'rgb(255,170,100)', a: dawn ? 0.15 : 0.35, seed: 3 });
  }
}

function paintKagariTown(g, rnd, glows, col, ud, dawn) {
  g.fillStyle = col;
  g.fillRect(0, BASE - 10, LAYER_W, LAYER_H);
  let x = -20;
  let i = 0;
  while (x < LAYER_W) {
    const w = 90 + rnd() * 80;
    const h = 40 + rnd() * 40;
    const rise = 24 + rnd() * 18;
    g.fillStyle = col;
    houseSilhouette(g, x, BASE, w, h, rise);
    if (ud) {
      // the same house beneath: roof caved, vines over it
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.beginPath();
      g.moveTo(x + w * 0.3, BASE - h - rise * 0.6);
      g.lineTo(x + w * 0.45, BASE - h + 10);
      g.lineTo(x + w * 0.6, BASE - h - rise * 0.4);
      g.fill();
      g.strokeStyle = 'rgba(20,30,40,0.9)';
      g.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(x + rnd() * w, BASE - h - rise * 0.5);
        g.quadraticCurveTo(x + rnd() * w, BASE - h * 0.5, x + rnd() * w, BASE);
        g.stroke();
      }
    } else if (rnd() < 0.6) {
      g.fillStyle = dawn ? 'rgba(255,230,200,0.25)' : 'rgba(255,170,90,0.6)';
      g.fillRect(x + w * (0.25 + rnd() * 0.4), BASE - h * 0.6, 10, 8);
      if (!dawn) glows.push({ x: x + w / 2, y: BASE - h * 0.5, r: 60 + rnd() * 30, color: 'rgb(255,160,90)', a: 0.35, seed: i * 2.1 });
    }
    // a cherry tree between houses (bare and black, beneath)
    if (rnd() < 0.45) {
      const tx = x + w + 14;
      g.fillStyle = col;
      g.fillRect(tx - 3, BASE - 70, 6, 70);
      if (ud) {
        g.strokeStyle = col;
        g.lineWidth = 2;
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.moveTo(tx, BASE - 60);
          g.lineTo(tx + (rnd() - 0.5) * 60, BASE - 90 - rnd() * 40);
          g.stroke();
        }
      } else {
        g.fillStyle = dawn ? 'rgba(255,190,210,0.75)' : 'rgba(150,60,90,0.65)';
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          g.arc(tx + (rnd() - 0.5) * 60, BASE - 80 - rnd() * 40, 16 + rnd() * 12, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    x += w + 26 + rnd() * 30;
    i++;
  }
}

// ── Crater, ship and nest painters ───────────────────────────
function paintCraterRim(g, rnd, glows) {
  // the crater's far wall: jagged black glass, lit green from below
  const pts = [];
  for (let x = 0; x <= LAYER_W; x += 14) {
    const u = x / LAYER_W;
    const n = fbm1(u * 6, 72) * (1 - u) + fbm1((u - 1) * 6, 72) * u;
    pts.push([x, BASE - 60 - n * 110 - (Math.sin(u * Math.PI * 2) + 1) * 30]);
  }
  const grad = g.createLinearGradient(0, BASE - 250, 0, BASE + 100);
  grad.addColorStop(0, '#0e1a1b');
  grad.addColorStop(1, '#040707');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, LAYER_H);
  for (const [x, y] of pts) g.lineTo(x, y);
  g.lineTo(LAYER_W, LAYER_H);
  g.fill();
  g.strokeStyle = 'rgba(120,255,200,0.25)';
  g.lineWidth = 1.5;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  // shards and crystal spires on the rim
  for (let i = 0; i < 26; i++) {
    const x = rnd() * LAYER_W;
    const y = pts[Math.floor(x / 14)][1];
    const h = 20 + rnd() * 60;
    g.fillStyle = rnd() < 0.5 ? '#0b1414' : 'rgba(80,200,160,0.35)';
    g.beginPath();
    g.moveTo(x - 5, y + 4);
    g.lineTo(x + (rnd() - 0.5) * 20, y - h);
    g.lineTo(x + 6, y + 4);
    g.fill();
    if (rnd() < 0.3) glows.push({ x, y: y - h * 0.5, r: 40 + rnd() * 30, color: 'rgb(90,255,170)', a: 0.3, seed: i });
  }
}

function paintShipWall(g, rnd, glows) {
  // steel panels behind the corridor, bulkhead frames, pipe runs, stencils
  g.fillStyle = '#12161b';
  g.fillRect(0, 0, LAYER_W, LAYER_H);
  for (let y = 0; y < LAYER_H; y += 70) {
    for (let x = 0; x < LAYER_W; x += 100) {
      g.fillStyle = (x / 100 + y / 70) % 2 ? '#151a20' : '#13181d';
      g.fillRect(x + 2, y + 2, 96, 66);
      g.fillStyle = 'rgba(255,255,255,0.03)';
      g.fillRect(x + 2, y + 2, 96, 2);
      g.fillStyle = '#20262d';
      for (const [rx, ry] of [[6, 6], [92, 6], [6, 62], [92, 62]]) g.fillRect(x + rx, y + ry, 2, 2);
    }
  }
  // bulkhead frames
  for (let x = 60; x < LAYER_W; x += 350) {
    g.fillStyle = '#0b0e11';
    g.fillRect(x, 0, 34, LAYER_H);
    g.fillStyle = '#1d232a';
    g.fillRect(x + 4, 0, 26, LAYER_H);
    g.fillStyle = '#2a3139';
    g.fillRect(x + 4, 0, 3, LAYER_H);
    for (let y = 20; y < LAYER_H; y += 60) {
      g.fillStyle = '#39424c';
      g.fillRect(x + 15, y, 4, 4);
    }
  }
  // pipe runs
  for (let i = 0; i < 4; i++) {
    const y = 80 + i * 170 + rnd() * 30;
    const w = 6 + rnd() * 8;
    g.fillStyle = '#0a0d10';
    g.fillRect(0, y - 1, LAYER_W, w + 2);
    g.fillStyle = '#1e252c';
    g.fillRect(0, y, LAYER_W, w);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(0, y + 1, LAYER_W, 1.5);
    for (let x = 40 + rnd() * 100; x < LAYER_W; x += 180 + rnd() * 120) {
      g.fillStyle = '#2b333b';
      g.fillRect(x, y - 3, 8, w + 6);
    }
  }
  // stencils and hazard panels
  g.font = 'bold 22px monospace';
  for (let i = 0; i < 6; i++) {
    const x = 120 + i * 230 + rnd() * 40;
    const y = 160 + rnd() * 400;
    g.fillStyle = 'rgba(190,180,140,0.12)';
    g.fillText(['B-07', 'C-12', 'NO STEP', 'D-03', 'HAB 2', 'VENT 4'][i], x, y);
  }
  for (let i = 0; i < 3; i++) {
    const x = 200 + i * 450;
    const y = 300 + rnd() * 200;
    g.save();
    g.beginPath();
    g.rect(x, y, 60, 14);
    g.clip();
    g.fillStyle = 'rgba(184,146,42,0.35)';
    g.fillRect(x, y, 60, 14);
    g.fillStyle = 'rgba(10,10,12,0.8)';
    for (let k = -14; k < 60; k += 12) {
      g.beginPath();
      g.moveTo(x + k, y + 14);
      g.lineTo(x + k + 7, y);
      g.lineTo(x + k + 13, y);
      g.lineTo(x + k + 6, y + 14);
      g.fill();
    }
    g.restore();
  }
  // vent grilles and status lights
  for (let i = 0; i < 5; i++) {
    const x = rnd() * LAYER_W;
    const y = rnd() * LAYER_H;
    g.fillStyle = '#07090b';
    g.fillRect(x, y, 44, 26);
    g.fillStyle = '#1b2127';
    for (let k = 0; k < 5; k++) g.fillRect(x + 2, y + 3 + k * 5, 40, 2);
  }
  for (let i = 0; i < 9; i++) {
    const x = rnd() * LAYER_W;
    const y = rnd() * LAYER_H;
    const col = ['rgb(120,255,140)', 'rgb(255,80,60)', 'rgb(255,190,80)'][i % 3];
    g.fillStyle = col;
    g.fillRect(x, y, 3, 3);
    glows.push({ x: x + 1.5, y: y + 1.5, r: 10, color: col, a: 0.6, seed: i * 1.7, blink: i % 2 ? 2 + rnd() * 3 : 0 });
  }
}

function paintShipDeep(g, rnd) {
  // where wall panels are missing: girders and darkness further in
  g.strokeStyle = 'rgba(30,36,42,0.9)';
  g.lineWidth = 10;
  for (let x = 0; x < LAYER_W; x += 140) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 70, LAYER_H);
    g.stroke();
  }
}

function paintNestWall(g, rnd, glows) {
  paintShipWall(g, rnd, []);
  // black resin has grown over everything: glossy ribbing, drips, and the people it kept
  g.fillStyle = 'rgba(6,8,8,0.82)';
  for (let i = 0; i < 40; i++) {
    const x = rnd() * LAYER_W;
    const y = rnd() * LAYER_H;
    g.beginPath();
    g.ellipse(x, y, 60 + rnd() * 120, 40 + rnd() * 90, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(14,20,19,0.95)';
  g.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const x = rnd() * LAYER_W;
    const y = rnd() * LAYER_H;
    g.lineWidth = 4 + rnd() * 8;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(x + (rnd() - 0.5) * 80, y + 40, x + (rnd() - 0.5) * 80, y + 90, x + (rnd() - 0.5) * 60, y + 140);
    g.stroke();
  }
  g.strokeStyle = 'rgba(140,190,180,0.12)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 40; i++) {
    const x = rnd() * LAYER_W;
    const y = rnd() * LAYER_H;
    g.beginPath();
    g.arc(x, y, 10 + rnd() * 30, 3.4, 5.2);
    g.stroke();
  }
  // cocooned shapes set into the wall
  for (let i = 0; i < 7; i++) {
    const x = 90 + i * 190 + rnd() * 40;
    const y = 200 + rnd() * 300;
    g.fillStyle = '#0d1211';
    g.beginPath();
    g.ellipse(x, y, 18, 42, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(170,165,150,0.22)';
    g.beginPath();
    g.ellipse(x, y - 26, 7, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.7)';
    g.fillRect(x - 4, y - 28, 2.4, 3);
    g.fillRect(x + 1.6, y - 28, 2.4, 3);
    glows.push({ x, y: y + 10, r: 50, color: 'rgb(90,200,160)', a: 0.12, seed: i });
  }
}

function paintBoneWall(g, rnd, glows) {
  // the derelict's inner wall: a lattice of vertebrae and tubes, like the inside of a ribcage
  g.fillStyle = 'rgba(8,13,13,0.0)';
  g.fillRect(0, 0, LAYER_W, LAYER_H);
  for (let x = 30; x < LAYER_W; x += 120) {
    // a column of vertebrae
    for (let y = -20; y < LAYER_H + 20; y += 26) {
      const wob = Math.sin(y * 0.02 + x) * 6;
      g.fillStyle = 'rgba(22,32,31,0.9)';
      g.beginPath();
      g.ellipse(x + wob, y, 16, 10, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(10,16,16,0.95)';
      g.beginPath();
      g.ellipse(x + wob, y + 12, 9, 4, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(120,170,160,0.14)';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x + wob, y, 14, 8, 0, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  }
  // ribs curving between the columns
  g.strokeStyle = 'rgba(16,24,24,0.85)';
  g.lineCap = 'round';
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rnd() * 11) * 120 + 30;
    const y = rnd() * LAYER_H;
    g.lineWidth = 5 + rnd() * 4;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + 60, y - 40 + rnd() * 20, x + 120, y);
    g.stroke();
  }
  for (let i = 0; i < 5; i++) glows.push({ x: rnd() * LAYER_W, y: rnd() * LAYER_H, r: 30, color: 'rgb(90,220,170)', a: 0.15, seed: i * 2.3 });
}

export { glowSprite };
