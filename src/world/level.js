import { TILE } from '../config.js';
import { THEMES } from './themes.js';

// Tile legend
//   .  empty           #  rock / earth (solid)     w  wood (solid)
//   =  one-way beam    ^  fire (hazard)            X  burning barricade (dash breaks it)
//   G  sealed gate (solid until opened)
//   ~  calm water (drowns you — unless you wear the Mizugumo and keep moving)
//   %  rough water (whitecaps, storm surge: drowns you, can't be walked on)
//   I  ice (solid; slippery underfoot, slick to wall-slide)
//   v  ice spikes (hazard; pogo-able)
//   a  acid (hazard)
//   R  hive resin (solid; dash breaks it)
//   M  ship's steel plating (solid)     D  cargo bay door (solid until it blows)
//   S  sliding door leaf (solid while shut; the Door entity draws it)
//   T  thorns (hazard; pogo-able)            V  a wall of vines (solid)
export const SOLID = new Set(['#', 'w', 'X', 'G', 'I', 'R', 'M', 'D', 'S', 'V']);

export const CHUNK = 16;

export const isWater = (t) => t === '~' || t === '%'; // tiles per render chunk edge

export class Level {
  constructor({ grid, gridUD = null, entities = [], decos = [], zones = [], tracks = [], hints = [], camBounds = null, name = '', theme = THEMES.fire, chapter = 1, themeZones = null, themeZonesUD = null }) {
    // Chapter IV has two versions of the same map: the real world and the
    // Upside Down. Physics and drawing use whichever `layer` you're in.
    this.grids = { real: grid, ud: gridUD };
    this.hasUD = !!gridUD;
    this.layer = 'real';
    this.versions = { real: new Map(), ud: new Map() };
    this.h = grid.length;
    this.w = grid[0].length;
    this.widthPx = this.w * TILE;
    this.heightPx = this.h * TILE;
    this.entities = entities;
    this.decos = decos;
    this.zones = zones;
    this.tracks = tracks;
    this.hints = hints;
    this.camBounds = camBounds || { x0: 0, y0: 0, x1: this.widthPx, y1: this.heightPx };
    this.name = name;
    this.theme = theme;
    this.chapter = chapter;
    // [{ x0 (tile), theme }] sorted by x0 — a chapter can change look partway through.
    this.zonesByLayer = { real: themeZones || [{ x0: 0, theme }], ud: themeZonesUD || themeZones || [{ x0: 0, theme }] };
    this.platforms = []; // moving one-way platforms (FloatPlatform), owned by the game
  }

  get grid() {
    return this.grids[this.layer];
  }
  get chunkVersion() {
    return this.versions[this.layer];
  }
  get themeZones() {
    return this.zonesByLayer[this.layer];
  }

  // A read-only window onto one layer, for the renderers (terrain, water).
  view(layer) {
    const L = this;
    return {
      w: L.w,
      h: L.h,
      widthPx: L.widthPx,
      heightPx: L.heightPx,
      theme: L.theme,
      layer,
      get grid() {
        return L.grids[layer];
      },
      get chunkVersion() {
        return L.versions[layer];
      },
      tileAt: (tx, ty) => L.tileIn(layer, tx, ty),
      themeAtTile: (tx) => L.themeIn(layer, tx),
    };
  }

  tileIn(layer, tx, ty) {
    if (tx < 0 || tx >= this.w) return '#';
    if (ty < 0) return '.';
    if (ty >= this.h) return '#';
    return this.grids[layer][ty][tx];
  }

  themeIn(layer, tx) {
    const zones = this.zonesByLayer[layer];
    let t = zones[0].theme;
    for (const z of zones) if (tx >= z.x0) t = z.theme;
    return t;
  }

  // Would this box be inside something solid in the given layer?
  boxBlockedIn(layer, x, y, w, h) {
    const keep = this.layer;
    this.layer = layer;
    const hit = this.boxHit(x, y, w, h);
    this.layer = keep;
    return !!hit;
  }

  themeAtTile(tx) {
    let t = this.themeZones[0].theme;
    for (const z of this.themeZones) if (tx >= z.x0) t = z.theme;
    return t;
  }

  themeAt(px) {
    return this.themeAtTile(Math.floor(px / TILE));
  }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.w) return '#';
    if (ty < 0) return '.';
    if (ty >= this.h) return '#';
    return this.grid[ty][tx];
  }

  setTile(tx, ty, ch) {
    this.setTileIn(this.layer, tx, ty, ch);
  }

  setTileIn(layer, tx, ty, ch) {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h || !this.grids[layer]) return;
    this.grids[layer][ty][tx] = ch;
    const versions = this.versions[layer];
    const key = `${Math.floor(tx / CHUNK)},${Math.floor(ty / CHUNK)}`;
    versions.set(key, (versions.get(key) || 0) + 1);
    // Edges of neighbouring chunks render differently when a neighbour changes.
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const k = `${Math.floor((tx + dx) / CHUNK)},${Math.floor((ty + dy) / CHUNK)}`;
      if (k !== key) versions.set(k, (versions.get(k) || 0) + 1);
    }
  }

  isSolidAt(tx, ty) {
    return SOLID.has(this.tileAt(tx, ty));
  }

  // First solid tile overlapping the box, or null.
  // With `oneWay`, one-way beams count when the box's previous bottom was above them.
  boxHit(x, y, w, h, oneWay = false, prevBottom = 0) {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tileAt(tx, ty);
        if (SOLID.has(t)) return [tx, ty];
        if (oneWay && t === '=' && prevBottom <= ty * TILE + 0.5) return [tx, ty];
      }
    }
    return null;
  }

  // Tile directly beneath the box's feet that it can stand on, or null.
  // Standing on a moving platform returns [-1, -1] (truthy, but not a tile).
  groundUnder(x, y, w, h, includeOneWay = true) {
    if (includeOneWay && this.platformUnder(x, y, w, h)) return [-1, -1];
    const feet = y + h;
    const ty = Math.floor((feet + 0.5) / TILE);
    if (Math.abs(feet - ty * TILE) > 0.75) return null;
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 0.001) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const t = this.tileAt(tx, ty);
      if (SOLID.has(t) || (includeOneWay && t === '=')) return [tx, ty];
    }
    return null;
  }

  onlyOneWayUnder(x, y, w, h) {
    if (this.platformUnder(x, y, w, h)) return true;
    const ty = Math.floor((y + h + 0.5) / TILE);
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 0.001) / TILE);
    let beam = false;
    for (let tx = x0; tx <= x1; tx++) {
      const t = this.tileAt(tx, ty);
      if (SOLID.has(t)) return false;
      if (t === '=') beam = true;
    }
    return beam;
  }

  // Fire burns in its lower ~60%; water drowns once you're half a tile under.
  // Returns [tx, ty, kind] with kind 'fire' | 'water', or null.
  hazardIn(x, y, w, h) {
    const x0 = Math.floor(x / TILE);
    const x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE);
    const y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = this.tileAt(tx, ty);
        if (t === '^' || t === 'v' || t === 'a' || t === 'T') {
          const hx = tx * TILE + 3;
          const hy = ty * TILE + 12;
          const kind = t === '^' ? 'fire' : t === 'v' || t === 'T' ? 'spikes' : 'acid';
          if (x < hx + TILE - 6 && x + w > hx && y < hy + TILE - 12 && y + h > hy) return [tx, ty, kind];
        } else if (t === '~' || t === '%') {
          const surface = this.waterSurfaceAt(tx, ty);
          if (y + h > surface + 18) return [tx, ty, 'water'];
        }
      }
    }
    return null;
  }

  // Top edge (px) of the body of water containing tile (tx, ty).
  waterSurfaceAt(tx, ty) {
    let y = ty;
    while (y > 0 && isWater(this.tileAt(tx, y - 1))) y--;
    return y * TILE;
  }

  // Calm water surface (px) directly under the box's feet, if any.
  calmWaterUnder(x, y, w, h) {
    const feet = y + h;
    const ty = Math.floor((feet + 1) / TILE);
    const x0 = Math.floor((x + 2) / TILE);
    const x1 = Math.floor((x + w - 2) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      if (this.tileAt(tx, ty) !== '~' || isWater(this.tileAt(tx, ty - 1))) continue;
      return ty * TILE;
    }
    return null;
  }

  // ── Moving platforms ─────────────────────────────────────────
  // The platform the box would land on this step, if any (one-way, from above).
  platformHit(x, y, w, h, prevBottom) {
    const bottom = y + h;
    for (const p of this.platforms) {
      if (!p.solid) continue;
      if (x + w <= p.x || x >= p.x + p.w) continue;
      if (prevBottom <= p.y + 0.5 + Math.max(0, p.dy) && bottom >= p.y) return p;
    }
    return null;
  }

  platformUnder(x, y, w, h) {
    const feet = y + h;
    for (const p of this.platforms) {
      if (!p.solid) continue;
      if (x + w <= p.x || x >= p.x + p.w) continue;
      if (Math.abs(feet - p.y) <= 1) return p;
    }
    return null;
  }

  // Breaks every connected barricade (or resin) tile; returns the tiles broken.
  breakCluster(tx, ty) {
    const kind = this.tileAt(tx, ty);
    const out = [];
    const stack = [[tx, ty]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (this.tileAt(x, y) !== kind) continue;
      this.setTile(x, y, '.');
      out.push([x, y]);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return out;
  }

  setGate(open) {
    for (const [tx, ty] of this.gateTiles || []) this.setTile(tx, ty, open ? '.' : 'G');
  }
}

// Small helper used by stage definitions.
export class LevelBuilder {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.grid = Array.from({ length: h }, () => Array(w).fill('.'));
    this.entities = [];
    this.decos = [];
    this.zones = [];
    this.tracks = [];
    this.hints = [];
  }

  fill(x0, y0, x1, y1, ch) {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.grid[y][x] = ch;
    return this;
  }

  // Solid ground from `top` down to the bottom of the map.
  ground(x0, x1, top, ch = '#') {
    return this.fill(x0, top, x1, this.h - 1, ch);
  }

  beam(x0, x1, y) {
    return this.fill(x0, y, x1, y, '=');
  }

  // Entities stand on the surface row `y` (their feet sit on its top edge).
  entity(type, x, y, props = {}) {
    this.entities.push({ type, x: x * 32 + 16, y: y * 32, ...props });
    return this;
  }

  deco(type, x, y, props = {}) {
    this.decos.push({ type, x: x * 32, y: y * 32, ...props });
    return this;
  }

  // Footprints the Binoshi left behind, along a surface from x0 to x1.
  track(x0, x1, y) {
    for (let x = x0 * 32; x < x1 * 32; x += 46) this.tracks.push({ x, y: y * 32 });
    return this;
  }

  hint(x, y, text) {
    this.hints.push({ x: x * 32, y: y * 32, text });
    return this;
  }

  zone(props) {
    this.zones.push(props);
    return this;
  }

  dump() {
    return this.grid.map((r) => r.join('')).join('\n');
  }
}
