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
          this.pal = L.themeAtTile(tx).terrain;
          if (pass === 0 && t === '#') this.rockBase(g, tx, ty);
          else if (pass === 1 && t === '#') this.rockDetail(g, tx, ty);
          else if (pass === 0 && t === 'M') this.metalBase(g, tx, ty);
          else if (pass === 1 && t === 'M') this.metalDetail(g, tx, ty);
          else if (pass === 2) {
            if (t === 'D') this.bayDoor(g, tx, ty);
            else if (t === 'w') this.wood(g, tx, ty);
            else if (t === '=') this.pal.grate ? this.grate(g, tx, ty) : this.pal.bone ? this.boneLedge(g, tx, ty) : this.beam(g, tx, ty);
            else if (t === '^') this.coals(g, tx, ty);
            else if (t === 'X') this.barricade(g, tx, ty);
            else if (t === 'G') this.gate(g, tx, ty);
            else if (t === 'I') this.ice(g, tx, ty);
            else if (t === 'v') this.iceSpikes(g, tx, ty);
            else if (t === 'a') this.acid(g, tx, ty);
            else if (t === 'R') this.resin(g, tx, ty);
            else if (t === 'T') this.thorns(g, tx, ty);
            else if (t === 'V') this.vineWall(g, tx, ty);
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

    if (this.pal.ribs) {
      // biomechanical ribbing: curved ridges and a conduit
      g.strokeStyle = 'rgba(70,95,90,0.55)';
      g.lineWidth = 2.2;
      for (let i = 0; i < 2; i++) {
        const rx = x + 6 + i * 14 + h(i + 200) * 4;
        g.beginPath();
        g.moveTo(rx, y);
        g.quadraticCurveTo(rx + 6, y + TILE / 2, rx, y + TILE);
        g.stroke();
      }
      g.strokeStyle = 'rgba(140,200,190,0.12)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 7, y);
      g.quadraticCurveTo(x + 12, y + TILE / 2, x + 7, y + TILE);
      g.stroke();
      if (h(210) > 0.75) {
        g.fillStyle = '#0a1010';
        g.beginPath();
        g.ellipse(x + 16, y + 16, 7, 4, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(120,180,170,0.3)';
        g.stroke();
      }
    }
    if (this.pal.glass) return this.glassDetail(g, tx, ty, { up, lf, rt, dn, h });
    if (this.pal.vines) this.vineDetail(g, tx, ty, { up, dn, h });
    if (this.pal.bone) this.boneDetail(g, tx, ty, h);
    // embedded stones
    for (let i = 0; i < (this.pal.ribs ? 0 : 2); i++) {
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

    if (!up && this.pal.snow) {
      // drifted snow cap, overhanging the edges a little
      const ext = (lf ? 0 : 3);
      const exr = (rt ? 0 : 3);
      g.fillStyle = '#a9bcd6';
      g.beginPath();
      g.moveTo(x - ext, y + 9);
      for (let i = 0; i <= 4; i++) g.lineTo(x - ext + ((TILE + ext + exr) * i) / 4, y - 3 + h(60 + i) * 3);
      g.lineTo(x + TILE + exr, y + 9);
      g.closePath();
      g.fill();
      g.fillStyle = '#e4ecf7';
      g.beginPath();
      g.moveTo(x - ext, y + 6);
      for (let i = 0; i <= 4; i++) g.lineTo(x - ext + ((TILE + ext + exr) * i) / 4, y - 4 + h(60 + i) * 3);
      g.lineTo(x + TILE + exr, y + 6);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 3; i++) if (h(300 + i) > 0.5) g.fillRect(x + h(310 + i) * TILE, y - 1 + h(320 + i) * 4, 1.2, 1.2);
    } else if (!up) {
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
    if (!dn && this.pal.snow) {
      // icicles
      for (let i = 0; i < 3; i++) {
        if (h(400 + i) < 0.55) continue;
        const ix = x + 4 + h(410 + i) * 24;
        const len = 6 + h(420 + i) * 16;
        g.fillStyle = 'rgba(200,225,250,0.85)';
        g.beginPath();
        g.moveTo(ix - 2.5, y + TILE - 1);
        g.lineTo(ix + 2.5, y + TILE - 1);
        g.lineTo(ix, y + TILE - 1 + len);
        g.fill();
      }
    } else if (!dn) {
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

  ice(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const h = (k) => hash2(tx, ty, k);
    const up = this.level.tileAt(tx, ty - 1) === 'I';
    const lf = this.level.tileAt(tx - 1, ty) === 'I';
    const rt = this.level.tileAt(tx + 1, ty) === 'I';
    const grad = g.createLinearGradient(x, y, x + TILE, y + TILE);
    grad.addColorStop(0, '#7fa6cc');
    grad.addColorStop(1, '#3e6390');
    g.fillStyle = grad;
    g.fillRect(x, y, TILE, TILE);
    // inner fractures
    g.strokeStyle = 'rgba(230,245,255,0.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x + h(1) * TILE, y);
    g.lineTo(x + h(2) * TILE, y + TILE * 0.5);
    g.lineTo(x + h(3) * TILE, y + TILE);
    g.stroke();
    // trapped bubbles
    g.fillStyle = 'rgba(230,245,255,0.5)';
    for (let i = 0; i < 3; i++) g.fillRect(x + h(10 + i) * 28 + 2, y + h(20 + i) * 28 + 2, 1.5, 1.5);
    // glassy sheen
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.moveTo(x + 4, y + TILE);
    g.lineTo(x + 12, y);
    g.lineTo(x + 18, y);
    g.lineTo(x + 10, y + TILE);
    g.fill();
    if (!up) {
      g.fillStyle = 'rgba(240,250,255,0.95)';
      g.fillRect(x, y, TILE, 2);
    }
    if (!lf) {
      g.fillStyle = 'rgba(220,240,255,0.5)';
      g.fillRect(x, y, 1.5, TILE);
    }
    if (!rt) {
      g.fillStyle = 'rgba(20,40,70,0.4)';
      g.fillRect(x + TILE - 1.5, y, 1.5, TILE);
    }
  }

  iceSpikes(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const h = (k) => hash2(tx, ty, k);
    for (let i = 0; i < 4; i++) {
      const bx = x + i * 8;
      const top = y + 6 + h(i) * 8;
      const grad = g.createLinearGradient(0, top, 0, y + TILE);
      grad.addColorStop(0, '#f2f8ff');
      grad.addColorStop(1, '#6f95c0');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(bx, y + TILE);
      g.lineTo(bx + 4, top);
      g.lineTo(bx + 8, y + TILE);
      g.fill();
    }
  }

  acid(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const grad = g.createLinearGradient(0, y + 10, 0, y + TILE);
    grad.addColorStop(0, '#2c5a1e');
    grad.addColorStop(1, '#0a1608');
    g.fillStyle = grad;
    g.fillRect(x, y + 12, TILE, TILE - 12);
    g.fillStyle = 'rgba(160,255,90,0.75)';
    g.fillRect(x, y + 12, TILE, 2);
  }

  resin(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const h = (k) => hash2(tx, ty, k);
    g.fillStyle = '#0d1412';
    g.fillRect(x, y, TILE, TILE);
    // glossy organic strands
    g.strokeStyle = '#1e2c28';
    g.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(x + h(i) * TILE, y);
      g.bezierCurveTo(x + h(i + 3) * TILE, y + 10, x + h(i + 6) * TILE, y + 22, x + h(i + 9) * TILE, y + TILE);
      g.stroke();
    }
    g.strokeStyle = 'rgba(160,220,200,0.28)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.moveTo(x + h(i + 20) * TILE, y + 2);
      g.quadraticCurveTo(x + h(i + 22) * TILE, y + 16, x + h(i + 24) * TILE, y + TILE - 2);
      g.stroke();
    }
    // the odd pale shape set into it — best not to look closely
    if (h(40) > 0.88) {
      g.fillStyle = 'rgba(190,190,170,0.35)';
      g.beginPath();
      g.ellipse(x + 16, y + 14, 6, 7, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0d1412';
      g.fillRect(x + 12, y + 12, 2.5, 3);
      g.fillRect(x + 17.5, y + 12, 2.5, 3);
    }
  }

  // ── Chapter III: the crater, the ship, the derelict ─────────
  // Fused black glass: glossy, cracked, catching the star's green light.
  glassDetail(g, tx, ty, { up, lf, rt, dn, h }) {
    const x = tx * TILE;
    const y = ty * TILE;
    g.strokeStyle = 'rgba(150,220,200,0.07)';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(x + h(1) * 10, y + TILE);
    g.lineTo(x + 14 + h(2) * 18, y);
    g.stroke();
    if (h(3) > 0.55) {
      // conchoidal fracture
      g.strokeStyle = 'rgba(170,240,215,0.22)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x + h(4) * TILE, y + h(5) * TILE, 6 + h(6) * 8, h(7) * 6, h(7) * 6 + 1.8);
      g.stroke();
    }
    if (h(8) > 0.8) {
      g.fillStyle = 'rgba(140,255,200,0.5)';
      g.fillRect(x + h(9) * 28, y + h(10) * 28, 1.5, 1.5);
    }
    if (!up) {
      // glassy lip with a cold rim, and a little snow that hasn't melted yet
      g.fillStyle = '#16201f';
      g.fillRect(x, y, TILE, 4);
      g.fillStyle = this.pal.rim;
      g.fillRect(x + (lf ? 0 : 4), y, TILE - (lf ? 0 : 4) - (rt ? 0 : 4), 1.3);
      if (h(20) > 0.55) {
        g.fillStyle = 'rgba(220,232,245,0.8)';
        g.beginPath();
        const sx = x + h(21) * 18;
        g.moveTo(sx, y + 1);
        g.quadraticCurveTo(sx + 7, y - 3, sx + 10 + h(22) * 8, y + 1);
        g.fill();
      }
    }
    if (!lf || !rt) {
      g.strokeStyle = this.pal.sideRim;
      g.lineWidth = 1.5;
      g.beginPath();
      if (!lf) {
        g.moveTo(x + 0.8, y + (up ? 0 : 6));
        g.lineTo(x + 0.8, y + TILE);
      }
      if (!rt) {
        g.moveTo(x + TILE - 0.8, y + (up ? 0 : 6));
        g.lineTo(x + TILE - 0.8, y + TILE);
      }
      g.stroke();
    }
    if (!dn && h(30) > 0.6) {
      // melted glass that ran and set
      g.fillStyle = '#121a19';
      g.beginPath();
      const dx = x + 6 + h(31) * 20;
      g.moveTo(dx - 3, y + TILE - 1);
      g.quadraticCurveTo(dx, y + TILE + 10 + h(32) * 8, dx + 3, y + TILE - 1);
      g.fill();
    }
  }

  // Inside the derelict the walls are bone: knuckled, ridged, old.
  boneDetail(g, tx, ty, h) {
    const x = tx * TILE;
    const y = ty * TILE;
    g.fillStyle = 'rgba(40,56,52,0.55)';
    for (let i = 0; i < 2; i++) {
      if (h(220 + i) < 0.4) continue;
      g.beginPath();
      g.ellipse(x + 8 + i * 16, y + 8 + h(230 + i) * 16, 5, 3.5, 0.3, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1.5;
    if (h(240) > 0.5) {
      g.beginPath();
      g.moveTo(x, y + 10 + h(241) * 12);
      g.quadraticCurveTo(x + 16, y + 4 + h(242) * 20, x + TILE, y + 10 + h(243) * 12);
      g.stroke();
    }
  }

  metal(tx, ty) {
    const t = this.level.tileAt(tx, ty);
    return t === 'M' || t === 'D';
  }

  metalBase(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const P = this.pal;
    const g0 = g.createLinearGradient(0, y, 0, y + TILE);
    g0.addColorStop(0, P.plateLight || '#3a434c');
    g0.addColorStop(0.15, P.plate || '#242a31');
    g0.addColorStop(1, P.plateDark || '#151a1f');
    g.fillStyle = (tx + ty) % 2 ? g0 : P.plate || '#242a31';
    g.fillRect(x, y, TILE, TILE);
    // depth: deep inside the hull it's just dark
    let depth = 0;
    for (let k = 1; k <= 4; k++) if (this.metal(tx, ty - k) && this.metal(tx, ty + k)) depth++;
    else break;
    let side = 0;
    for (let k = 1; k <= 3; k++) if (this.metal(tx - k, ty) && this.metal(tx + k, ty)) side++;
    else break;
    const dark = Math.min(depth, side);
    if (dark > 0) {
      g.fillStyle = `rgba(4,5,8,${Math.min(0.75, dark * 0.2)})`;
      g.fillRect(x, y, TILE, TILE);
    }
  }

  metalDetail(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const P = this.pal;
    const h = (k) => hash2(tx, ty, k);
    const up = this.solid(tx, ty - 1);
    const dn = this.solid(tx, ty + 1);
    const lf = this.solid(tx - 1, ty);
    const rt = this.solid(tx + 1, ty);
    // panel seams every two tiles, rivets at the corners
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    if (tx % 2 === 0) {
      g.moveTo(x + 0.5, y);
      g.lineTo(x + 0.5, y + TILE);
    }
    if (ty % 2 === 0) {
      g.moveTo(x, y + 0.5);
      g.lineTo(x + TILE, y + 0.5);
    }
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.beginPath();
    if (tx % 2 === 0) {
      g.moveTo(x + 1.6, y);
      g.lineTo(x + 1.6, y + TILE);
    }
    if (ty % 2 === 0) {
      g.moveTo(x, y + 1.6);
      g.lineTo(x + TILE, y + 1.6);
    }
    g.stroke();
    g.fillStyle = P.rivet || '#4c5560';
    if (tx % 2 === 0 && ty % 2 === 0) for (const [rx, ry] of [[4, 4]]) g.fillRect(x + rx, y + ry, 2, 2);
    if (tx % 2 === 1 && ty % 2 === 1) g.fillRect(x + TILE - 6, y + TILE - 6, 2, 2);
    // the odd vent slot or stencilled number
    if (h(1) > 0.9) {
      g.fillStyle = '#07090b';
      for (let k = 0; k < 4; k++) g.fillRect(x + 7, y + 8 + k * 4, 18, 1.6);
    } else if (h(1) > 0.84) {
      g.fillStyle = 'rgba(200,190,150,0.16)';
      g.font = 'bold 9px monospace';
      g.fillText(`${(tx * 7 + ty) % 90 + 10}`, x + 8, y + 20);
    }
    if (!up) {
      // deck plate: a bright edge, a dark lip, a chevron stripe here and there
      g.fillStyle = P.plateLight || '#3a434c';
      g.fillRect(x, y, TILE, 4);
      g.fillStyle = P.rim;
      g.fillRect(x, y, TILE, 1.2);
      g.fillStyle = '#07090b';
      g.fillRect(x, y + 4, TILE, 1.5);
      if (h(40) > 0.72 && P.stripe) {
        g.save();
        g.beginPath();
        g.rect(x, y + 5.5, TILE, 4);
        g.clip();
        g.fillStyle = P.stripe;
        g.fillRect(x, y + 5.5, TILE, 4);
        g.fillStyle = '#0b0c0e';
        for (let k = -8; k < TILE; k += 8) {
          g.beginPath();
          g.moveTo(x + k, y + 9.5);
          g.lineTo(x + k + 4, y + 5.5);
          g.lineTo(x + k + 8, y + 5.5);
          g.lineTo(x + k + 4, y + 9.5);
          g.fill();
        }
        g.restore();
      }
    }
    if (!dn) {
      // ceiling: a conduit runs along it
      g.fillStyle = '#0b0d10';
      g.fillRect(x, y + TILE - 6, TILE, 6);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x, y + TILE - 5, TILE, 1);
      if (tx % 4 === 0) {
        g.fillStyle = P.rivet || '#4c5560';
        g.fillRect(x + 2, y + TILE - 7, 4, 8);
      }
    }
    if (!lf || !rt) {
      // bulkhead edge frame
      g.fillStyle = P.plateLight || '#3a434c';
      if (!lf) g.fillRect(x, y, 3, TILE);
      if (!rt) g.fillRect(x + TILE - 3, y, 3, TILE);
      g.fillStyle = 'rgba(0,0,0,0.6)';
      if (!lf) g.fillRect(x + 3, y, 1, TILE);
      if (!rt) g.fillRect(x + TILE - 4, y, 1, TILE);
    }
    if (P.resin && h(60) > 0.45) {
      // the hive has grown over the steel
      g.fillStyle = '#0a0e0d';
      g.beginPath();
      g.ellipse(x + h(61) * TILE, y + h(62) * TILE, 8 + h(63) * 12, 6 + h(64) * 8, h(65) * 3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(150,200,190,0.18)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x + h(61) * TILE, y + h(62) * TILE, 6 + h(63) * 8, 3.6, 5);
      g.stroke();
      if (!dn && h(66) > 0.4) {
        g.strokeStyle = '#0a0e0d';
        g.lineWidth = 2;
        g.beginPath();
        const sx = x + h(67) * TILE;
        g.moveTo(sx, y + TILE);
        g.quadraticCurveTo(sx + 2, y + TILE + 10, sx - 1, y + TILE + 14 + h(68) * 14);
        g.stroke();
      }
    }
  }

  // A steel catwalk: rails, see-through grating, a handrail.
  grate(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const lf = this.level.tileAt(tx - 1, ty) === '=';
    const rt = this.level.tileAt(tx + 1, ty) === '=';
    const x0 = x - (lf ? 0 : 2);
    const w = TILE + (lf ? 0 : 2) + (rt ? 0 : 2);
    g.fillStyle = this.pal.beamTop;
    g.fillRect(x0, y, w, 3);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(x0, y, w, 1);
    g.fillStyle = this.pal.beam;
    g.fillRect(x0, y + 9, w, 3);
    g.strokeStyle = '#0d1014';
    g.lineWidth = 1.4;
    g.beginPath();
    for (let k = 0; k < TILE; k += 6) {
      g.moveTo(x + k, y + 3);
      g.lineTo(x + k + 6, y + 9);
      g.moveTo(x + k + 6, y + 3);
      g.lineTo(x + k, y + 9);
    }
    g.stroke();
    // handrail posts
    g.fillStyle = this.pal.beam;
    if (!lf || !rt || tx % 3 === 0) {
      const px = !lf ? x + 1 : !rt ? x + TILE - 3 : x + 15;
      g.fillRect(px, y - 18, 2, 18);
    }
    g.fillStyle = this.pal.beamTop;
    g.fillRect(x0, y - 18, w, 2);
  }

  // In the derelict, ledges are shelves of bone.
  boneLedge(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const lf = this.level.tileAt(tx - 1, ty) === '=';
    const rt = this.level.tileAt(tx + 1, ty) === '=';
    const h = (k) => hash2(tx, ty, k);
    g.fillStyle = '#1c2826';
    g.beginPath();
    g.moveTo(x - (lf ? 0 : 6), y);
    g.lineTo(x + TILE + (rt ? 0 : 6), y);
    g.quadraticCurveTo(x + TILE + (rt ? 0 : 2), y + 10, x + TILE, y + 12 + (rt ? 0 : 2));
    g.quadraticCurveTo(x + TILE / 2, y + 18 + h(1) * 6, x, y + 12 + (lf ? 0 : 2));
    g.quadraticCurveTo(x - (lf ? 0 : 2), y + 10, x - (lf ? 0 : 6), y);
    g.fill();
    g.fillStyle = 'rgba(140,200,180,0.35)';
    g.fillRect(x - (lf ? 0 : 4), y, TILE + (lf ? 0 : 4) + (rt ? 0 : 4), 1.3);
    g.fillStyle = '#0e1514';
    if (h(2) > 0.5) {
      g.beginPath();
      g.moveTo(x + 10, y + 12);
      g.lineTo(x + 13, y + 24 + h(3) * 8);
      g.lineTo(x + 16, y + 12);
      g.fill();
    }
  }

  // The cargo bay's outer door: heavy, striped, sealed.
  bayDoor(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const up = this.level.tileAt(tx, ty - 1) === 'D';
    const lf = this.level.tileAt(tx - 1, ty) === 'D';
    g.fillStyle = '#2a2f36';
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#1a1e23';
    g.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    g.save();
    g.beginPath();
    g.rect(x, y, TILE, TILE);
    g.clip();
    if (ty % 4 === 1) {
      g.fillStyle = '#b8922a';
      g.fillRect(x, y + 10, TILE, 12);
      g.fillStyle = '#0d0e10';
      for (let k = -16; k < TILE + 16; k += 12) {
        g.beginPath();
        g.moveTo(x + k, y + 22);
        g.lineTo(x + k + 6, y + 10);
        g.lineTo(x + k + 12, y + 10);
        g.lineTo(x + k + 6, y + 22);
        g.fill();
      }
    }
    g.restore();
    g.fillStyle = '#4a535c';
    if (!up) g.fillRect(x, y, TILE, 3);
    if (!lf) g.fillRect(x, y, 3, TILE);
    g.fillStyle = '#5a646e';
    g.fillRect(x + 6, y + 6, 2, 2);
    g.fillRect(x + TILE - 8, y + TILE - 8, 2, 2);
  }

  // The Upside Down: dark tendrils crawling over the ground and hanging from it.
  vineDetail(g, tx, ty, { up, dn, h }) {
    const x = tx * TILE;
    const y = ty * TILE;
    g.strokeStyle = '#0a0f14';
    g.lineCap = 'round';
    if (h(500) > 0.4) {
      g.lineWidth = 2 + h(501) * 3;
      g.beginPath();
      g.moveTo(x, y + h(502) * TILE);
      g.bezierCurveTo(x + 10, y + h(503) * TILE, x + 22, y + h(504) * TILE, x + TILE, y + h(505) * TILE);
      g.stroke();
    }
    if (!up) {
      // a mat of tendrils along the top, with little upturned shoots
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x - 2, y + 2);
      g.quadraticCurveTo(x + 16, y - 2 - h(510) * 3, x + TILE + 2, y + 2);
      g.stroke();
      g.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        if (h(520 + i) < 0.5) continue;
        const sx = x + h(530 + i) * TILE;
        g.beginPath();
        g.moveTo(sx, y + 1);
        g.quadraticCurveTo(sx + 4, y - 6, sx + (h(540 + i) - 0.5) * 10, y - 9 - h(550 + i) * 6);
        g.stroke();
      }
    }
    if (!dn) {
      // tendrils dangling into the dark
      g.lineWidth = 1.8;
      for (let i = 0; i < 3; i++) {
        if (h(560 + i) < 0.45) continue;
        const sx = x + 4 + h(570 + i) * 24;
        const len = 10 + h(580 + i) * 30;
        g.beginPath();
        g.moveTo(sx, y + TILE - 2);
        g.bezierCurveTo(sx + 4, y + TILE + len * 0.3, sx - 4, y + TILE + len * 0.7, sx + (h(590 + i) - 0.5) * 8, y + TILE + len);
        g.stroke();
      }
    }
  }

  // Brambles: a tangle of black thorns.
  thorns(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const h = (k) => hash2(tx, ty, k);
    g.strokeStyle = this.pal.vines ? '#0a0e13' : '#1a0e10';
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      g.lineWidth = 2 + h(i) * 2;
      g.beginPath();
      g.moveTo(x + h(i + 10) * TILE, y + TILE);
      g.quadraticCurveTo(x + h(i + 20) * TILE, y + 10, x + h(i + 30) * TILE, y + 6 + h(i + 40) * 8);
      g.stroke();
    }
    g.fillStyle = this.pal.vines ? '#1c2430' : '#2a1416';
    for (let i = 0; i < 7; i++) {
      const sx = x + h(i + 50) * TILE;
      const sy = y + 8 + h(i + 60) * 20;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + 3, sy - 7);
      g.lineTo(sx + 5, sy);
      g.fill();
    }
  }

  // A wall of vines in the Upside Down: thick, black, glistening.
  vineWall(g, tx, ty) {
    const x = tx * TILE;
    const y = ty * TILE;
    const h = (k) => hash2(tx, ty, k);
    g.fillStyle = '#06090d';
    g.fillRect(x, y, TILE, TILE);
    g.strokeStyle = '#121a22';
    g.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      g.lineWidth = 4 + h(i) * 4;
      g.beginPath();
      g.moveTo(x + h(i + 5) * TILE, y);
      g.bezierCurveTo(x + h(i + 9) * TILE, y + 10, x + h(i + 13) * TILE, y + 22, x + h(i + 17) * TILE, y + TILE);
      g.stroke();
    }
    g.strokeStyle = 'rgba(150,180,220,0.18)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x + h(30) * TILE, y + 2);
    g.quadraticCurveTo(x + h(31) * TILE, y + 16, x + h(32) * TILE, y + TILE - 2);
    g.stroke();
  }
}
