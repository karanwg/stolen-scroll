import { Level, LevelBuilder } from './level.js';
import { THEMES } from './themes.js';

// Chapter I — Kagari Village, burning.
//
// Route (tile x):
//   0–36    Hill shrine above the village. Start, first lantern, the dying elder.
//   37–84   Village street. Rooftops, Binoshi patrols, a fire pit.
//   85–100  Pagoda climb — needs DOUBLE JUMP (ledges are 5 tiles apart).
//   101–121 Ruined dojo at street level — dead end holding the Tengu Feather (double jump).
//   94–160  Burning rooftops. Wind-Step Tabi (dash) at the start; a 12-tile gap
//           over the fire chasm needs DASH; a burning barricade needs DASH.
//   161–176 Last lantern before the shrine courtyard.
//   177–216 Balrog's arena. Gate on the right opens when it falls.
//   217–229 The tracks lead on toward the sea.
export function buildStage1() {
  const W = 230;
  const H = 56;
  const b = new LevelBuilder(W, H);

  // World edges
  b.fill(0, 0, 1, H - 1, '#');
  b.fill(W - 2, 0, W - 1, H - 1, '#');

  // ── Hill shrine ─────────────────────────────────────────────
  b.ground(2, 20, 24);
  b.ground(21, 24, 26);
  b.ground(25, 28, 29);
  b.ground(29, 32, 32);
  b.ground(33, 36, 35);

  b.entity('playerStart', 5, 24);
  b.entity('lantern', 10, 24, { id: 'hill' });
  b.entity('elder', 15, 24);
  b.deco('torii', 3, 24, { scale: 0.9 });
  b.deco('pine', 18, 24, { scale: 1.2 });
  b.deco('stoneLantern', 7, 24);
  b.hint(4, 21, '←  →  move');
  b.hint(22, 23, 'Z / Space  jump · hold to jump higher');

  // ── Village street ──────────────────────────────────────────
  b.ground(37, 120, 38);
  b.fill(56, 38, 58, 38, '^'); // fire pit
  b.beam(44, 50, 33);
  b.beam(53, 58, 30);
  b.beam(62, 68, 33);
  b.beam(73, 78, 32);

  b.deco('house', 41, 38, { w: 9, h: 5, burning: true });
  b.deco('house', 52, 38, { w: 7, h: 8, burning: true });
  b.deco('house', 61, 38, { w: 9, h: 5, burning: false });
  b.deco('house', 72, 38, { w: 8, h: 6, burning: true });
  b.deco('banner', 60, 38);
  b.deco('stoneLantern', 70, 38);
  b.deco('fence', 37, 38, { w: 4 });
  b.deco('fence', 79, 38, { w: 5 });

  b.entity('note', 40, 38, { id: 'tracks' });
  b.entity('lantern', 82, 38, { id: 'street' });
  b.entity('blade', 48, 38);
  b.entity('kunai', 56, 30);
  b.entity('blade', 75, 38);
  b.hint(44, 36, 'X  slash · hold ↑ or ↓ to aim');
  b.hint(54, 36, 'fire burns — jump it');
  b.track(38, 84, 38);
  b.zone({ x0: 37, x1: 120, y0: 26, y1: 40, title: 'Kagari Village', sub: 'what is left of home' });

  // ── Pagoda climb (double jump) ──────────────────────────────
  b.beam(87, 91, 33);
  b.beam(94, 99, 28);
  b.beam(87, 92, 23);
  b.deco('pagoda', 93, 38);
  b.entity('bat', 92, 26);
  b.entity('bat', 89, 16);

  // ── Ruined dojo (dead end, Tengu Feather) ───────────────────
  b.beam(103, 118, 31);
  b.fill(121, 21, 122, H - 1, '#');
  b.deco('dojo', 102, 38, { w: 19, h: 7 });
  b.entity('blade', 108, 38);
  b.entity('note', 113, 38, { id: 'sensei' });
  b.entity('pickup', 118, 38, { ability: 'doubleJump' });

  // ── Burning rooftops (dash) ─────────────────────────────────
  b.fill(94, 18, 112, 19, 'w'); // R1
  b.fill(118, 19, 126, 20, 'w'); // R2
  b.fill(139, 19, 150, 20, 'w'); // R3 — 12 tiles past R2: dash required
  b.fill(151, 10, 156, 14, 'w'); // gatehouse roof
  b.fill(151, 15, 152, 18, 'X'); // burning barricade
  b.fill(151, 19, 160, 20, 'w'); // R4

  // Fire chasm beneath the rooftops
  b.fill(123, 41, 160, H - 1, '#');
  b.fill(123, 40, 160, 40, '^');

  b.entity('pickup', 106, 18, { ability: 'dash' });
  b.entity('kunai', 123, 19);
  b.hint(122, 16, 'double jump, then dash at the peak');
  b.hint(107, 15, 'C / Shift  dash');
  b.entity('blade', 146, 19);
  b.entity('bat', 133, 13);
  b.deco('roofline', 94, 18, { w: 19 });
  b.deco('roofline', 118, 19, { w: 9 });
  b.deco('roofline', 139, 19, { w: 12 });
  b.deco('roofline', 151, 19, { w: 10 });
  b.deco('ruins', 125, 40, { w: 34 });
  b.track(101, 112, 18);
  b.track(118, 126, 19);
  b.track(139, 160, 19);
  b.zone({ x0: 94, x1: 160, y0: 0, y1: 22, title: 'The Burning Rooftops', sub: '' });

  // ── Last lantern ────────────────────────────────────────────
  b.ground(161, 176, 30);
  b.entity('lantern', 167, 30, { id: 'gate' });
  b.deco('torii', 172, 30, { scale: 1.15, burning: true });
  b.deco('stoneLantern', 163, 30);
  b.track(161, 176, 30);

  // ── Balrog's arena ──────────────────────────────────────────
  b.ground(177, 216, 40);
  b.fill(215, 0, 216, 35, '#');
  b.fill(215, 36, 216, 39, 'G');
  b.beam(183, 187, 35);
  b.beam(205, 209, 35);
  b.deco('temple', 186, 40, { w: 22 });
  b.entity('balrog', 204, 40);
  b.entity('bossTrigger', 182, 40);

  // ── Onward ──────────────────────────────────────────────────
  b.ground(217, W - 3, 40);
  b.track(217, 227, 40);
  b.entity('chapterEnd', 225, 40);
  b.deco('pine', 220, 40, { scale: 1 });

  const level = new Level({
    grid: b.grid,
    entities: b.entities,
    decos: b.decos,
    zones: b.zones,
    tracks: b.tracks,
    hints: b.hints,
    camBounds: { x0: 0, y0: 0, x1: W * 32, y1: 48 * 32 },
    name: 'Kagari Village',
    theme: THEMES.fire,
    chapter: 1,
  });
  level.gateTiles = [];
  for (let y = 36; y <= 39; y++) for (let x = 215; x <= 216; x++) level.gateTiles.push([x, y]);
  level.arena = { x0: 175 * 32, x1: 217 * 32, y0: 18 * 32, y1: 44 * 32, floorY: 40 * 32 };
  level.builder = b;
  return level;
}
