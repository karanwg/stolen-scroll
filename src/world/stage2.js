import { Level, LevelBuilder } from './level.js';
import { THEMES } from './themes.js';

// Chapter II — The Drowned Coast.
//
// Sea surface: row 46 (water rows 46–59, sea floor 60+). Piers sit at row 42.
//   ~ calm water: walkable with the Mizugumo while you keep moving
//   % rough water: never walkable — glide over it with the Kite Cloth
//
// Route (tile x):
//   0–56     Cliffside descent in the rain, down to Ama's beach.
//   57–122   Ama Village: piers on stilts over the sea. Kappa, a tentacle under
//            the pier gap, a rotten plank. The Old Ferryman gives you the
//            MIZUGUMO at the end of the last pier.
//   123–165  Wreck Cove: first run across open water. A whirlpool to jump, a
//            wreck to board, an optional jellyfish pogo up to the crow's nest.
//   166–182  The Lighthouse: pogo up a column of jellyfish to the lamp, where
//            the KITE CLOTH hangs.
//   183–266  The Open Strait: rough water you must glide over, geysers to ride,
//            sinking flotsam, sea stacks. Midpoint lantern on the tall stack.
//   267–288  The Floating Shrine: a wounded Binoshi, the summoning circle, the
//            great torii standing in the sea.
//   289–350  The Kraken's maelstrom: floating steps over rough water.
//   351–369  The far rocks, and what the Kraken leaves behind.
export function buildStage2() {
  const W = 372;
  const H = 64;
  const S = 46; // sea surface row
  const b = new LevelBuilder(W, H);

  // Sea everywhere, rough patches added per zone; sea floor below.
  b.fill(0, S, W - 1, 59, '~');
  b.fill(0, 60, W - 1, H - 1, '#');
  b.fill(0, 0, 1, H - 1, '#');
  b.fill(W - 2, 0, W - 1, H - 1, '#');
  const rough = (x0, x1) => b.fill(x0, S, x1, 59, '%');
  const pier = (x0, x1, y = 42) => {
    b.fill(x0, y, x1, y, 'w');
    b.deco('stilts', x0, y + 1, { w: x1 - x0 + 1, h: 59 - y });
  };
  const float = (x, w, mode = 'bob', look = 'debris', y = S) => b.entity('float', x, y, { w, mode, look });

  // ── 1. Cliffside descent ────────────────────────────────────
  b.deco('cliffFace', 0, 24, { w: 18, h: 14 });
  b.ground(2, 16, 24);
  b.ground(17, 21, 27);
  b.ground(22, 26, 30);
  b.ground(27, 31, 33);
  b.ground(32, 35, 36);
  b.ground(36, 39, 39);
  b.ground(40, 56, 42);
  b.entity('playerStart', 4, 24);
  b.entity('lantern', 9, 24, { id: 'cliff' });
  b.deco('stoneLantern', 14, 24);
  b.deco('seaPine', 18, 27, { scale: 1.1 });
  b.deco('seaPine', 30, 33, { scale: 0.8 });
  b.deco('rocks', 22, 30, { w: 4 });
  b.deco('rocks', 36, 39, { w: 4 });
  b.entity('stormcrow', 25, 24);
  b.entity('blade', 29, 33);
  b.hint(6, 21, 'the sea is below — and it is deep');
  b.track(4, 16, 24);
  b.track(40, 56, 42);
  b.zone({ x0: 0, x1: 60, y0: 0, y1: 50, title: 'The Drowned Coast', sub: 'where the sea stood up' });

  // ── 2. Ama Village ──────────────────────────────────────────
  b.deco('hokora', 43, 42);
  b.deco('boat', 46, 42, { w: 4 });
  b.deco('fishRack', 50, 42);
  b.deco('nets', 53, 42, { w: 3 });
  b.entity('kappa', 48, 42);

  pier(57, 68);
  b.deco('stiltHouse', 59, 42, { w: 7, h: 4 });
  b.beam(58, 66, 37);
  b.entity('kappa', 64, 42);

  pier(72, 86);
  b.deco('stiltHouse', 75, 42, { w: 9, h: 5 });
  b.beam(74, 84, 36);
  b.beam(80, 86, 31);
  b.entity('note', 84, 31, { id: 'orders' });
  b.entity('kunai', 78, 36);
  b.deco('paperLanterns', 72, 42, { w: 3 });
  b.entity('tentacle', 88, S, { range: 220 });

  pier(91, 104);
  b.deco('paperLanterns', 93, 42, { w: 9 });
  b.deco('nets', 101, 42, { w: 3 });
  b.entity('blade', 95, 42);
  b.entity('kappa', 101, 42);
  float(105, 3, 'crumble', 'plank', 42); // rotten plank over the gap
  b.hint(106, 39, 'rotten — keep moving');

  pier(108, 122);
  b.entity('lantern', 111, 42, { id: 'village' });
  b.entity('ferryman', 117, 42);
  b.deco('boat', 120, S, { w: 3 });
  b.deco('fishRack', 113, 42);
  b.deco('kelp', 60, 60, { w: 50, h: 9 });
  b.track(57, 68, 42);
  b.track(72, 86, 42);
  b.track(91, 104, 42);
  b.track(108, 122, 42);
  b.zone({ x0: 57, x1: 122, y0: 30, y1: 50, title: 'Ama Village', sub: 'no lamps, no boats' });

  // ── 3. Wreck Cove ───────────────────────────────────────────
  b.hint(126, 43, 'run — and the sea holds you');
  b.deco('wreck', 146, S, { w: 15, h: 7 });
  b.fill(132, 43, 135, 52, 'w'); // stern, low enough to hop onto
  b.fill(136, 41, 144, 52, 'w'); // deck
  b.beam(138, 143, 36); // cabin roof
  b.deco('mast', 141, 41, { h: 13 });
  b.beam(140, 142, 27); // crow's nest
  b.entity('note', 141, 27, { id: 'log' });
  b.entity('jelly', 138, 31.5);
  b.entity('kappa', 134, 43);
  b.entity('blade', 141, 41);
  rough(148, 151); // whirlpool
  b.hint(149, 43, 'whitewater — jump it');
  b.entity('tentacle', 156, S, { range: 260 });
  float(160, 3, 'bob');
  b.entity('stormcrow', 150, 36);
  b.entity('stormcrow', 163, 34);
  b.deco('kelp', 124, 60, { w: 40, h: 8 });
  b.zone({ x0: 123, x1: 165, y0: 30, y1: 50, title: 'Wreck Cove', sub: '' });

  // ── 4. The Lighthouse ───────────────────────────────────────
  b.ground(166, 182, 40);
  b.deco('lighthouse', 174, 40, { h: 31 });
  b.deco('rocks', 166, 40, { w: 3 });
  b.entity('lantern', 169, 40, { id: 'lighthouse' });
  b.entity('jelly', 177, 36);
  b.entity('jelly', 172, 30.5);
  b.entity('jelly', 177, 26);
  b.beam(170, 179, 22); // balcony
  b.entity('note', 178, 22, { id: 'keeper' });
  b.entity('jelly', 172, 18);
  b.entity('jelly', 177, 13.5);
  b.beam(167, 181, 9); // gallery around the lamp
  b.entity('pickup', 174, 9, { ability: 'float' });
  b.entity('stormcrow', 168, 16);
  b.hint(170, 37, 'X + ↓ in the air on a jellyfish: bounce');
  b.zone({ x0: 166, x1: 182, y0: 0, y1: 42, title: 'The Lighthouse', sub: '' });

  // ── 5. The Open Strait ──────────────────────────────────────
  rough(183, 197);
  b.hint(184, 36, 'jump, then hold JUMP to glide');
  b.ground(198, 201, 41); // stack S1
  b.deco('seaPine', 198, 41, { scale: 0.7 });
  b.entity('stormcrow', 192, 34);
  // calm lane, tentacle, then a geyser into the rough
  b.entity('tentacle', 207, S, { range: 240 });
  b.entity('geyser', 213, S, { height: 440, period: 3.2 });
  rough(215, 226);
  b.hint(209, 41, 'ride the geyser — open the cloth inside it');
  b.ground(227, 233, 39); // tall stack S2
  b.entity('lantern', 230, 39, { id: 'stack' });
  b.deco('seaPine', 231, 39, { scale: 1 });
  rough(234, 252);
  float(236, 3, 'sink');
  float(241, 3, 'sink');
  float(246, 3, 'sink');
  b.entity('jelly', 243, 38);
  b.hint(236, 42, 'waterlogged — they won\'t hold you long');
  b.ground(253, 258, 40); // stack S3
  b.entity('kunai', 256, 40);
  b.entity('stormcrow', 250, 33);
  b.entity('tentacle', 262, S, { range: 220 });
  b.entity('geyser', 194, S, { height: 300, period: 3.6, offset: 1.2 });
  b.deco('kelp', 200, 60, { w: 60, h: 8 });
  b.zone({ x0: 183, x1: 266, y0: 20, y1: 50, title: 'The Open Strait', sub: 'where the sea turns white' });

  // ── 6. The Floating Shrine ──────────────────────────────────
  b.fill(267, 42, 288, 42, 'w');
  b.deco('shrineDeck', 267, 42, { w: 22 });
  b.entity('lantern', 271, 42, { id: 'shrine' });
  b.entity('binoshi', 279, 42);
  b.deco('ritual', 284, 42);
  b.deco('stoneLantern', 275, 42);
  b.deco('stoneLantern', 287, 42);
  b.track(267, 286, 42);
  b.zone({ x0: 267, x1: 288, y0: 30, y1: 50, title: 'The Floating Shrine', sub: 'they read the second name here' });

  // ── 7. The Kraken's maelstrom ───────────────────────────────
  rough(289, 350);
  b.deco('bigTorii', 289, S, { scale: 2 });
  for (const x of [291, 298, 305, 312, 319, 326, 333, 340]) float(x, 4, 'step', 'step');
  b.entity('kraken', 320, S);
  b.entity('bossTrigger', 294, S);

  // ── The far rocks ───────────────────────────────────────────
  b.ground(351, 353, 44); // a low shelf to climb out of the sea
  b.ground(354, W - 3, 42);
  b.deco('rocks', 352, 42, { w: 8 });
  b.deco('seaPine', 362, 42, { scale: 1.2 });
  b.entity('relic', 359, 42);

  const level = new Level({
    grid: b.grid,
    entities: b.entities,
    decos: b.decos,
    zones: b.zones,
    tracks: b.tracks,
    hints: b.hints,
    camBounds: { x0: 0, y0: 0, x1: W * 32, y1: 54 * 32 },
    name: 'The Drowned Coast',
    theme: THEMES.sea,
    chapter: 2,
  });
  level.arena = { x0: 288 * 32, x1: 352 * 32, y0: 26 * 32, y1: 52 * 32, floorY: S * 32 - 8, surfaceY: S * 32, roughX0: 289, roughX1: 350, rows: [S, 59] };
  level.gateTiles = [];
  level.builder = b;
  return level;
}
