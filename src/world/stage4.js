import { Level, LevelBuilder } from './level.js';
import { THEMES } from './themes.js';

// Chapter IV — The Upside Down. The finale.
//
// Two versions of one map: `b` is the real world, `u` the Upside Down beneath
// it. Entities and decos default to both worlds; `real`/`ud` place them in one.
//
// Route (tile x):
//   0–122    Kagari, rebuilt: lanterns, cherry trees, the people you saved.
//            The sky has been red for three nights. A dog barks at nothing.
//   123–215  The shrine road: sleepwalkers. At the shrine they all turn around.
//            The YATA NO KAGAMI — and the first, involuntary shift.
//   216–380  The Hollow Wood: shift-platforming. Pits in one world are ground in
//            the other; vine walls; platforms you land on by shifting mid-air;
//            a cliff climbed half in each world.
//   381–532  The Drowned Terraces: water-walk the flooded paddies (Mizugumo);
//            where the water's too rough, the Upside Down is dry — and has vines.
//   533–598  The pagoda courtyard: THE MASTER.
//   599–628  The Inverted Pagoda: the world turns over; climb it, half in each world.
//   629–690  The Storm: THE MIND FLAYER.
//   700–768  Dawn over Kagari: the Scroll.

export function buildStage4() {
  const W = 770;
  const H = 66;
  const G = 50; // the village street
  const b = new LevelBuilder(W, H);
  const u = new LevelBuilder(W, H);
  u.entities = b.entities;
  u.decos = b.decos;
  u.zones = b.zones;
  u.hints = b.hints;
  u.tracks = b.tracks;
  const both = (fn) => {
    fn(b);
    fn(u);
  };
  const real = (type, x, y, props = {}) => b.deco(type, x, y, { ...props, layer: 'real' });
  const ud = (type, x, y, props = {}) => b.deco(type, x, y, { ...props, layer: 'ud' });
  const realE = (type, x, y, props = {}) => b.entity(type, x, y, { ...props, layer: 'real' });
  const udE = (type, x, y, props = {}) => b.entity(type, x, y, { ...props, layer: 'ud' });
  // a pit with thorns at the bottom, in one builder
  const pit = (L, x0, x1, depth = 5) => {
    L.fill(x0, 0, x1, H - 1, '.');
    L.ground(x0, x1, G + depth);
    L.fill(x0, G + depth - 1, x1, G + depth - 1, 'T');
  };

  both((L) => {
    L.fill(0, 0, 1, H - 1, '#');
    L.fill(W - 2, 0, W - 1, H - 1, '#');
  });

  // ── 1. Kagari, rebuilt ──────────────────────────────────────
  both((L) => L.ground(2, 122, G));
  b.entity('playerStart', 5, G);
  b.entity('lantern', 44, G, { id: 'home' });
  real('torii', 3, G, { scale: 0.9 });
  ud('torii', 3, G, { scale: 0.9 });
  for (const [x, w, h] of [[9, 5, 4], [33, 6, 5], [52, 5, 4], [70, 6, 4], [88, 5, 4]]) {
    real('house', x, G, { w, h });
    ud('udHouse', x, G, { w, h });
  }
  for (const x of [19, 46, 82, 110]) {
    real('sakura', x, G, { scale: 1.1 });
    ud('deadTree', x, G, { scale: 1.1 });
  }
  for (const [x, w] of [[23, 8], [60, 7], [96, 8]]) {
    real('festivalLanterns', x, G, { w });
    ud('vineCurtain', x, G - 5, { w, h: 4 });
  }
  ud('udGrowth', 40, G, { scale: 1 });
  ud('udGrowth', 104, G, { scale: 1.2 });
  realE('villager', 15, G, { id: 'v_woman', look: 'woman' });
  realE('villager', 28, G, { id: 'v_child', look: 'child' });
  realE('villager', 56, G, { id: 'v_elder', look: 'old' });
  realE('villager', 75, G, { id: 'v_man', look: 'man' });
  realE('dog', 86, G, { facing: 1 });
  udE('demodog', 97, G); // what the dog can smell
  b.zone({ x0: 0, x1: 122, y0: 30, y1: 56, title: 'Kagari', sub: 'home — three nights after the sky turned red' });

  // ── 2. The shrine road ──────────────────────────────────────
  both((L) => {
    L.ground(123, 160, G);
    for (let k = 0; k < 8; k++) L.ground(161 + k * 2, 162 + k * 2, G - 1 - k);
    L.ground(177, 215, G - 8);
  });
  const S2 = G - 8;
  b.entity('lantern', 180, S2, { id: 'shrine' });
  real('sakura', 140, G, { scale: 1 });
  ud('deadTree', 140, G, { scale: 1 });
  real('festivalLanterns', 126, G, { w: 6 });
  real('kagariShrine', 188, S2, { w: 16, h: 7 });
  ud('kagariShrine', 188, S2, { w: 16, h: 7, ud: true });
  // the sleepwalkers: some still walking, some already standing before the shrine
  realE('sleepwalker', 132, G, { toX: 186, delay: 0 });
  realE('sleepwalker', 146, G, { toX: 190, delay: 2 });
  realE('sleepwalker', 156, G, { toX: 202, delay: 4 });
  for (const [x, face] of [[183, 1], [187, 1], [205, -1], [209, -1]]) realE('sleepwalker', x, S2, { toX: x, face });
  realE('scare', 192, S2, { kind: 'sleepersTurn' });
  b.entity('pickup', 196, S2, { ability: 'mirror', layer: 'real' });
  b.zone({ x0: 123, x1: 215, y0: 30, y1: 56, title: 'The Shrine Road', sub: 'they walk with their eyes shut' });

  // ── 3. The Hollow Wood ──────────────────────────────────────
  both((L) => {
    L.ground(216, 225, G - 4);
    L.ground(226, 240, G);
  });
  for (const x of [222, 236, 262, 311, 334]) {
    real('pine', x, x < 226 ? G - 4 : G, { scale: 1.1 });
    ud('deadTree', x, x < 226 ? G - 4 : G, { scale: 1.2 });
  }
  realE('flayed', 236, G, { look: 'man' });
  b.hint(230, G - 4, 'A  —  shift between worlds');
  // a pit in the real world is ground beneath it
  both((L) => L.ground(241, 263, G));
  pit(b, 241, 250);
  // a wall of vines beneath; open in the real world
  u.fill(256, G - 10, 257, G - 1, 'V');
  ud('vineCurtain', 254, G - 12, { w: 5, h: 3 });
  // and another pit above, ground below
  both((L) => L.ground(264, 280, G));
  pit(b, 264, 271);
  udE('demodog', 268, G);
  b.entity('lantern', 276, G, { id: 'wood' });
  // the long thorn pit: platforms alternate between the worlds — shift mid-air
  both((L) => pit(L, 281, 305, 6));
  b.beam(283, 285, G - 2);
  u.beam(289, 291, G - 3);
  b.beam(295, 297, G - 3);
  u.beam(301, 303, G - 2);
  b.hint(281, G - 5, 'shift in mid-air — land on what only the other world has');
  both((L) => L.ground(306, 345, G));
  realE('flayed', 325, G, { look: 'woman' });
  udE('demodog', 330, G);
  // the cliff: climbed half in each world
  both((L) => L.ground(346, 360, G - 16));
  b.beam(338, 341, G - 4);
  b.beam(342, 345, G - 8);
  u.beam(338, 341, G - 12);
  ud('vineCurtain', 336, G - 18, { w: 8, h: 5 });
  both((L) => {
    L.ground(361, 366, G - 12);
    L.ground(367, 372, G - 8);
    L.ground(373, 380, G - 4);
  });
  udE('vineBurst', 352, G - 16, { period: 3.2 });
  udE('vineBurst', 357, G - 16, { period: 3.2, offset: 1.6 });
  realE('flayed', 356, G - 16, { look: 'man' });
  b.zone({ x0: 216, x1: 380, y0: 20, y1: 60, title: 'The Hollow Wood', sub: "it's the same forest. it isn't." });

  // ── 4. The Drowned Terraces ─────────────────────────────────
  both((L) => L.ground(381, 532, G));
  const paddy = (x0, x1, kind) => {
    // in the real world: water (or a channel too rough to walk)
    b.fill(x0, G, x1, G + 3, kind);
  };
  const thorns = (x0, x1) => u.fill(x0, G, x1, G, 'T');
  paddy(391, 410, '~');
  udE('vineBurst', 396, G, { period: 3 });
  udE('vineBurst', 405, G, { period: 3, offset: 1.5 });
  paddy(411, 418, '%');
  paddy(419, 440, '~');
  thorns(419, 440);
  real('scarecrow', 443, G, {});
  ud('scarecrow', 443, G, { ud: true });
  paddy(447, 470, '%');
  for (const [x, off] of [[452, 0], [459, 1.1], [466, 2.2]]) udE('vineBurst', x, G, { period: 3.3, offset: off });
  paddy(471, 480, '~');
  thorns(471, 480);
  real('house', 484, G, { w: 6, h: 4 });
  ud('udHouse', 484, G, { w: 6, h: 4 });
  b.entity('lantern', 492, G, { id: 'terraces' });
  real('scarecrow', 496, G, {});
  ud('scarecrow', 496, G, { ud: true });
  realE('flayed', 506, G, { look: 'man' });
  realE('flayed', 515, G, { look: 'woman' });
  udE('demodog', 511, G);
  b.hint(411, G - 4, 'too rough to walk — but beneath, it\'s dry');
  b.zone({ x0: 381, x1: 532, y0: 30, y1: 60, title: 'The Drowned Terraces', sub: 'the rice was never harvested' });

  // ── 5. The pagoda courtyard: the Master ─────────────────────
  const C = G - 4;
  both((L) => {
    L.ground(521, 526, G - 2);
    L.ground(527, 600, C);
  });
  b.entity('lantern', 537, C, { id: 'courtyard' });
  real('torii', 543, C, { scale: 1 });
  ud('torii', 543, C, { scale: 1 });
  real('pagoda', 592, C, {});
  ud('pagoda', 592, C, {});
  ud('vineCurtain', 580, C - 26, { w: 18, h: 10 });
  b.entity('master', 578, C);
  b.entity('bossTrigger', 553, C, { for: 'master' });
  b.entity('lantern', 596, C, { id: 'tower' });
  b.zone({ x0: 533, x1: 598, y0: 30, y1: 50, title: 'The Pagoda', sub: 'where you climbed the night it burned' });

  // ── 6. The Inverted Pagoda ──────────────────────────────────
  // Inside, the world turns over: you climb toward the storm.
  both((L) => {
    L.fill(600, 0, 628, H - 1, '#');
    L.fill(601, 18, 627, C - 1, '.'); // the tower's inside, floor at row C
    L.fill(600, C - 5, 600, C - 1, '.'); // its door
    L.fill(628, 22, 628, 25, '.'); // and the way out at the top
    L.beam(602, 613, C - 5);
    L.fill(600, C - 5, 600, C - 1, 'G'); // the door is sealed until the Master is beaten
  });
  u.beam(615, 627, C - 10); // only beneath
  b.beam(601, 612, C - 15); // only above
  both((L) => L.beam(615, 627, C - 20));
  real('pagodaInterior', 601, 18, { w: 27, h: C - 18 });
  ud('pagodaInterior', 601, 18, { w: 27, h: C - 18, ud: true });
  b.zone({ x0: 599, x1: 628, y0: 10, y1: 50, title: 'The Inverted Pagoda', sub: '' });

  // ── 7. The Storm: the Mind Flayer ───────────────────────────
  const F = C - 20; // the arena floor, level with the top of the tower
  both((L) => {
    L.ground(629, 690, F);
    L.fill(691, 0, 699, H - 1, '#');
  });
  real('kagariShrine', 650, F, { w: 12, h: 6 });
  ud('kagariShrine', 650, F, { w: 12, h: 6, ud: true });
  b.entity('flayer', 660, F);
  b.entity('bossTrigger', 635, F, { for: 'flayer' });
  b.zone({ x0: 629, x1: 690, y0: 0, y1: 40, title: 'The Storm', sub: '' });

  // ── 8. Dawn ─────────────────────────────────────────────────
  both((L) => L.ground(700, 767, G));
  real('sakura', 708, G, { scale: 1.2 });
  real('festivalLanterns', 712, G, { w: 7 });
  real('kagariShrine', 722, G, { w: 16, h: 7 });
  real('sakura', 752, G, { scale: 1.1 });
  real('house', 756, G, { w: 5, h: 4 });
  realE('villager', 716, G, { id: 'v_dawn1', look: 'woman' });
  realE('villager', 744, G, { id: 'v_dawn2', look: 'child' });
  realE('villager', 748, G, { id: 'v_dawn3', look: 'old' });
  b.entity('relic', 730, G, { look: 'scroll', layer: 'real' });

  const level = new Level({
    grid: b.grid,
    gridUD: u.grid,
    entities: b.entities,
    decos: b.decos,
    zones: b.zones,
    tracks: b.tracks,
    hints: b.hints,
    camBounds: { x0: 0, y0: 0, x1: W * 32, y1: 64 * 32 },
    name: 'The Upside Down',
    theme: THEMES.kagari,
    chapter: 4,
    themeZones: [
      { x0: 0, theme: THEMES.kagari },
      { x0: 700, theme: THEMES.dawn },
    ],
    themeZonesUD: [
      { x0: 0, theme: THEMES.upside },
      { x0: 700, theme: THEMES.dawn },
    ],
  });
  level.arenas = {
    master: { x0: 547 * 32, x1: 590 * 32, y0: 28 * 32, y1: (C + 2) * 32, floorY: C * 32 },
    flayer: { x0: 631 * 32, x1: 689 * 32, y0: 0, y1: (F + 2) * 32, floorY: F * 32 },
  };
  level.arena = level.arenas.master;
  level.gates4 = { master: [[600, C - 5], [600, C - 4], [600, C - 3], [600, C - 2], [600, C - 1]] };
  level.flips = [{ x0: 599 * 32, x1: 628 * 32 + 16 }];
  level.ending = { x: 704 * 32 + 16, y: G * 32 };
  level.gateTiles = [];
  level.builder = b;
  return level;
}
