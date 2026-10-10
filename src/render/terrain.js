import { TILE } from '../config.js';
import { hash2 } from '../core/math.js';
import { CHUNK, SOLID } from '../world/level.js';
import { makeCanvas } from './shapes.js';

// Renders the tile grid into cached chunk canvases (LRU), so the detailed
// procedural art costs nothing per frame. Chunks re-render when tiles change.

const CHUNK_PX = CHUNK * TILE;
const MAX_CHUNKS = 28;


export class TerrainRenderer {
  constructor(level, scale) {
    this.level = level;
    this.scale = scale;
    this.pal = level.theme.terrain;
    this.cache = new Map(); // key -> {canvas, version, used}
    this.frame = 0;
  }

  draw(ctx, camLeft, camTop, viewW, viewH) {
    this.frame++;
    const cx0 = Math.floor(camLeft / CHUNK_PX);
    const cy0 = Math.floor(camTop / CHUNK_PX);
    const cx1 = Math.floor((camLeft + viewW) / CHUNK_PX);
    const cy1 = Math.floor((camTop + viewH) / CHUNK_PX);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK >= this.level.w || cy * CHUNK >= this.level.h) continue;
        const key = `${cx},${cy}`;
        const version = this.level.chunkVersion.get(key) || 0;
        let entry = this.cache.get(key);
        if (!entry || entry.version !== version) {
          entry = { canvas: entry?.canvas || makeCanvas(CHUNK_PX * this.scale, CHUNK_PX * this.scale), version };
          this.renderChunk(entry.canvas, cx, cy);
          this.cache.set(key, entry);
        }
        entry.used = this.frame;
        ctx.drawImage(entry.canvas, cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX, CHUNK_PX);
      }
    }
    if (this.cache.size > MAX_CHUNKS) {
      const old = [...this.cache.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let i = 0; i < old.length - MAX_CHUNKS; i++) this.cache.delete(old[i][0]);
    }
  }

  renderChunk(canvas, cx, cy) {
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(this.scale, 0, 0, this.scale, -cx * CHUNK_PX * this.scale, -cy * CHUNK_PX * this.scale);
    const L = this.level;
    // Draw one tile beyond the chunk edge so shapes that overhang connect cleanly.
    const tx0 = cx * CHUNK - 1;
    const ty0 = cy * CHUNK - 1;
    for (let pass = 0; pass < 3; pass++) {
      for (let ty = ty0; ty <= ty0 + CHUNK + 1; ty++) {
        for (let tx = tx0; tx <= tx0 + CHUNK + 1; tx++) {
          if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) continue;
          const t = L.grid[ty][tx];
          if (pass === 0 && t === '#') this.rockBase(g, tx, ty);
          else if (pass === 1 && t === '#') this.rockDetail(g, tx, ty);
          else if (pass === 2) {
            if (t === 'w') this.wood(g, tx, ty);
            else if (t === '=') this.beam(g, tx, ty);
            else if (t === '^') this.coals(g, tx, ty);
            else if (t === 'X') this.barricade(g, tx, ty);
            else if (t === 'G') this.gate(g, tx, ty);
          }
        }
      }
    }
  }

  solid(tx, ty) {
    return SOLID.has(this.level.tileAt(tx, ty));
  }

  rock(tx, ty) {
    return this.level.tileAt(tx, ty) === '#';
  }

  rockBase(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const up = this.rock(tx, ty - 1);
    const dn = this.rock(tx, ty + 1);
    const lf = this.rock(tx - 1, ty);
    const rt = this.rock(tx + 1, ty);
    const r = 10;
    g.fillStyle = this.pal.rock;
    g.beginPath();
    const tl = !up && !lf ? r : 0;
    const tr = !up && !rt ? r : 0;
    const br = !dn && !rt ? r : 0;
    const bl = !dn && !lf ? r : 0;
    g.moveTo(x + tl, y);
    g.lineTo(x + TILE - tr, y);
    if (tr) g.quadraticCurveTo(x + TILE, y, x + TILE, y + tr);
    g.lineTo(x + TILE, y + TILE - br);
    if (br) g.quadraticCurveTo(x + TILE, y + TILE, x + TILE - br, y + TILE);
    g.lineTo(x + bl, y + TILE);
    if (bl) g.quadraticCurveTo(x, y + TILE, x, y + TILE - bl);
    g.lineTo(x, y + tl);
    if (tl) g.quadraticCurveTo(x, y, x + tl, y);
    g.closePath();
    g.fill();

    // depth darkening: tiles far from an open surface fade into shadow
    let depth = 0;
    for (let k = 1; k <= 4; k++) if (this.rock(tx, ty - k)) depth++;
    else break;
    let side = 0;
    for (let k = 1; k <= 3; k++) if (this.rock(tx - k, ty) && this.rock(tx + k, ty)) side++;
    else break;
    const dark = Math.min(depth, side + 1);
    if (dark > 0) {
      g.fillStyle = `rgba(6,3,6,${Math.min(0.7, dark * 0.17)})`;
      g.fillRect(x, y, TILE, TILE);
    }
  }

  rockDetail(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const up = this.solid(tx, ty - 1);
    const lf = this.solid(tx - 1, ty);
    const rt = this.solid(tx + 1, ty);
    const dn = this.solid(tx, ty + 1);
    const h = (k) => hash2(tx, ty, k);

    // embedded stones
    for (let i = 0; i < 2; i++) {
      if (h(i) < 0.45) continue;
      const sx = x + 4 + h(i + 10) * 24;
      const sy = y + 6 + h(i + 20) * 22;
      const rw = 3 + h(i + 30) * 6;
      g.fillStyle = h(i + 40) < 0.5 ? this.pal.stone : this.pal.rockDeep;
      g.beginPath();
      g.ellipse(sx, sy, rw, rw * 0.6, h(i + 50) * 3, 0, Math.PI * 2);
      g.fill();
    }
    // crack
    if (h(5) > 0.7) {
      g.strokeStyle = '#0c070b';
      g.lineWidth = 1.2;
      g.beginPath();
      const sx = x + h(6) * TILE;
      g.moveTo(sx, y + 4);
      g.lineTo(sx + (h(7) - 0.5) * 14, y + 14);
      g.lineTo(sx + (h(8) - 0.5) * 16, y + 26);
      g.stroke();
    }

    if (!up) {
      // soil lip with a wavy top
      g.fillStyle = this.pal.soil;
      g.beginPath();
      g.moveTo(x - 0.5, y + 8);
      for (let i = 0; i <= 4; i++) g.lineTo(x + (i * TILE) / 4, y - 1 + h(60 + i) * 2.5);
      g.lineTo(x + TILE + 0.5, y + 8);
      g.closePath();
      g.fill();
      // charred grass
      g.strokeStyle = this.pal.grass;
      g.lineWidth = 1.3;
      g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const gx = x + h(70 + i) * TILE;
        const gh = 3 + h(80 + i) * 7;
        g.beginPath();
        g.moveTo(gx, y + 2);
        g.quadraticCurveTo(gx + (h(90 + i) - 0.5) * 4, y - gh * 0.5, gx + (h(100 + i) - 0.5) * 7, y - gh);
        g.stroke();
      }
      // ember-lit rim
      g.strokeStyle = this.pal.rim;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x + (lf ? 0 : 6), y + 0.8);
      g.lineTo(x + TILE - (rt ? 0 : 6), y + 0.8);
      g.stroke();
      // tiny glowing embers caught in the soil
      if (h(110) > 0.82) {
        g.fillStyle = this.pal.speck;
        g.beginPath();
        g.arc(x + h(111) * TILE, y + 4 + h(112) * 3, 1.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (!lf || !rt) {
      g.strokeStyle = this.pal.sideRim;
      g.lineWidth = 1.5;
      g.beginPath();
      if (!lf) {
        g.moveTo(x + 0.8, y + (up ? 0 : 8));
        g.lineTo(x + 0.8, y + TILE - (dn ? 0 : 8));
      }
      if (!rt) {
        g.moveTo(x + TILE - 0.8, y + (up ? 0 : 8));
        g.lineTo(x + TILE - 0.8, y + TILE - (dn ? 0 : 8));
      }
      g.stroke();
    }
    if (!dn) {
      // hanging roots
      g.strokeStyle = this.pal.roots;
      g.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) {
        if (h(120 + i) < 0.5) continue;
        const rx = x + 4 + h(130 + i) * 24;
        g.beginPath();
        g.moveTo(rx, y + TILE - 2);
        g.quadraticCurveTo(rx + 3, y + TILE + 6, rx - 1, y + TILE + 6 + h(140 + i) * 10);
        g.stroke();
      }
    }
  }

  wood(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const up = this.level.tileAt(tx, ty - 1) === 'w';
    const lf = this.level.tileAt(tx - 1, ty) === 'w';
    const rt = this.level.tileAt(tx + 1, ty) === 'w';
    const h = (k) => hash2(tx, ty, k);
    g.fillStyle = this.pal.wood;
    g.fillRect(x, y, TILE, TILE);
    // planks
    g.strokeStyle = this.pal.woodDark;
    g.lineWidth = 1.4;
    for (let py = 8; py < TILE; py += 8) {
      g.beginPath();
      g.moveTo(x, y + py);
      g.lineTo(x + TILE, y + py);
      g.stroke();
    }
    // grain + joints
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const gy = y + 3 + i * 8 + h(i) * 3;
      g.beginPath();
      g.moveTo(x + h(i + 5) * 10, gy);
      g.lineTo(x + 14 + h(i + 9) * 18, gy + 0.5);
      g.stroke();
    }
    if (h(20) > 0.5) {
      g.fillStyle = this.pal.woodDark;
      g.fillRect(x + Math.floor(h(21) * 28), y + 1, 1.5, TILE - 2);
    }
    // charring
    if (h(30) > 0.6) {
      g.fillStyle = 'rgba(5,2,2,0.45)';
      g.beginPath();
      g.ellipse(x + h(31) * TILE, y + h(32) * TILE, 6 + h(33) * 8, 4 + h(34) * 5, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (!up) {
      g.fillStyle = this.pal.woodLight;
      g.fillRect(x, y, TILE, 5);
      g.fillStyle = this.pal.woodRim;
      g.fillRect(x, y, TILE, 1.2);
      g.fillStyle = '#120a07';
      g.fillRect(x, y + 5, TILE, 1.5);
      if (!lf) {
        g.fillStyle = this.pal.woodLight;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 6, y - 3);
        g.lineTo(x - 6, y + 4);
        g.lineTo(x, y + 6);
        g.fill();
      }
      if (!rt) {
        g.fillStyle = this.pal.woodLight;
        g.beginPath();
        g.moveTo(x + TILE, y);
        g.lineTo(x + TILE + 6, y - 3);
        g.lineTo(x + TILE + 6, y + 4);
        g.lineTo(x + TILE, y + 6);
        g.fill();
      }
    }
    if (h(40) > 0.85) {
      g.fillStyle = this.pal.woodSpeck;
      g.fillRect(x + h(41) * 26, y + 8 + h(42) * 18, 3, 1.5);
    }
  }

  beam(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const lf = this.level.tileAt(tx - 1, ty) === '=';
    const rt = this.level.tileAt(tx + 1, ty) === '=';
    g.fillStyle = this.pal.beam;
    g.fillRect(x - (lf ? 0 : 3), y, TILE + (lf ? 0 : 3) + (rt ? 0 : 3), 10);
    g.fillStyle = this.pal.beamTop;
    g.fillRect(x - (lf ? 0 : 3), y, TILE + (lf ? 0 : 3) + (rt ? 0 : 3), 3);
    g.fillStyle = this.pal.woodRim;
    g.fillRect(x - (lf ? 0 : 3), y, TILE + (lf ? 0 : 3) + (rt ? 0 : 3), 1);
    g.fillStyle = '#160d08';
    g.fillRect(x - (lf ? 0 : 3), y + 10, TILE + (lf ? 0 : 3) + (rt ? 0 : 3), 1.5);
    // brackets
    if (!lf || !rt || tx % 3 === 0) {
      const bx = !lf ? x + 5 : !rt ? x + TILE - 7 : x + 14;
      g.fillStyle = '#2a190f';
      g.beginPath();
      g.moveTo(bx, y + 10);
      g.lineTo(bx + 3, y + 10);
      g.lineTo(bx + 3, y + 24);
      g.lineTo(bx, y + 24);
      g.fill();
    }
    // rope lashing at the ends
    if (!lf || !rt) {
      const rx = !lf ? x + 2 : x + TILE - 6;
      g.strokeStyle = '#8a7350';
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(rx + i * 1.6, y + 1);
        g.lineTo(rx + i * 1.6 + 1, y + 9);
        g.stroke();
      }
    }
  }

  coals(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const h = (k) => hash2(tx, ty, k);
    const grad = g.createLinearGradient(0, y + 10, 0, y + TILE);
    grad.addColorStop(0, '#5a1408');
    grad.addColorStop(1, '#1a0606');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x, y + TILE);
    g.lineTo(x, y + 18);
    for (let i = 0; i <= 4; i++) g.lineTo(x + (i * TILE) / 4, y + 14 + h(i) * 6);
    g.lineTo(x + TILE, y + TILE);
    g.fill();
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#1e0a08' : '#2e0f0a';
      g.beginPath();
      g.ellipse(x + h(10 + i) * TILE, y + 20 + h(20 + i) * 10, 3 + h(30 + i) * 4, 2 + h(40 + i) * 2, h(50 + i) * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(255,140,50,0.9)';
    g.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) {
      const sx = x + h(60 + i) * TILE;
      const sy = y + 20 + h(70 + i) * 8;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + (h(80 + i) - 0.5) * 10, sy + 3 + h(90 + i) * 4);
      g.stroke();
    }
  }

  barricade(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const h = (k) => hash2(tx, ty, k);
    g.fillStyle = '#24140d';
    g.fillRect(x + 2, y, TILE - 4, TILE);
    g.strokeStyle = '#3d2416';
    g.lineWidth = 7;
    g.lineCap = 'butt';
    g.beginPath();
    g.moveTo(x - 2, y + 4 + h(1) * 6);
    g.lineTo(x + TILE + 2, y + TILE - 4 - h(2) * 6);
    g.moveTo(x + TILE + 2, y + 6);
    g.lineTo(x - 2, y + TILE - 6);
    g.stroke();
    g.strokeStyle = 'rgba(255,120,40,0.75)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x + 4, y + 8 + h(3) * 10);
    g.lineTo(x + 12, y + 12 + h(4) * 10);
    g.moveTo(x + 20, y + 4 + h(5) * 14);
    g.lineTo(x + 27, y + 10 + h(6) * 12);
    g.stroke();
    g.fillStyle = '#120905';
    g.fillRect(x + 1, y, 2, TILE);
    g.fillRect(x + TILE - 3, y, 2, TILE);
  }

  gate(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    g.fillStyle = '#1e1416';
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#2f2024';
    g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    g.fillStyle = '#4c4650';
    for (const sy of [6, 22]) {
      g.fillRect(x, y + sy, TILE, 3);
      g.fillStyle = '#7a7280';
      g.beginPath();
      g.arc(x + 8, y + sy + 1.5, 1.5, 0, Math.PI * 2);
      g.arc(x + 24, y + sy + 1.5, 1.5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#4c4650';
    }
    if (this.level.tileAt(tx, ty - 1) !== 'G' && this.level.tileAt(tx - 1, ty) !== 'G') {
      // seal talisman
      g.fillStyle = '#d9cfa8';
      g.fillRect(x + 22, y + 4, 14, 28);
      g.strokeStyle = '#7d3cff';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x + 29, y + 8);
      g.lineTo(x + 29, y + 28);
      g.moveTo(x + 25, y + 13);
      g.lineTo(x + 33, y + 13);
      g.moveTo(x + 25, y + 20);
      g.lineTo(x + 33, y + 22);
      g.stroke();
    }
  }
}
