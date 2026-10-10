import { Level, LevelBuilder } from './level.js';
import { THEMES } from './themes.js';

// Chapter III — The Fallen Star.
//
// Snow under a full moon; then, gradually, the wreck: a scorched slope, the
// crater, a crashed human salvage ship, and the alien derelict fused into it.
//
// Route (tile x):
//   0–90     The Frozen Pass: icy slope, spike pit, icicles, a canyon ridden on the wind.
//   90–140   The Binoshi Camp: an AMBUSH (three waves) whose reward is the KAGINAWA.
//   140–200  Yamadera, the cliff temple: swing between eaves, ring THREE BELLS,
//            the SHUKO CLAWS.
//   200–282  Down to the Hidden Onsen: hot springs, snow monkeys, the old monk.
//   282–330  The Frozen Falls: wall-jump up an ice chimney into a headwind.
//   331–410  The Scorched Slope: a gouge, burned pines, plating, a dead patrol, a lifeboat.
//   411–470  The Crater: black glass, and the MSV Tethys lying in it.
//   471–590  MSV Tethys: airlock, hypersleep, the mess (the power dies),
//            a maintenance shaft, deck C (arcs, steam, a locker), the breach.
//   591–700  The Derelict: the ribbed hall, the Pilot's chamber, the egg chamber.
//   701–746  The cargo bay — the nest. The XENOMORPH. Its last act: the bay door blows.
//   747–797  Outside, on the crater rim: the Master's last page.
export function buildStage3() {
  const W = 800;
  const H = 66;
  const b = new LevelBuilder(W, H);
  const carve = (x0, y0, x1, y1) => b.fill(x0, y0, x1, y1, '.');

  b.fill(0, 0, 1, H - 1, '#');
  b.fill(W - 2, 0, W - 1, H - 1, '#');

  // ── 1. The Frozen Pass ──────────────────────────────────────
  b.ground(2, 14, 46);
  b.entity('playerStart', 5, 46);
  b.entity('lantern', 9, 46, { id: 'pass' });
  b.deco('frozenTorii', 2, 46, { scale: 0.85 });
  b.deco('jizo', 11, 46, { n: 3 });
  b.ground(15, 22, 48);
  b.ground(23, 30, 46);
  b.fill(23, 46, 30, 46, 'I'); // icy slope…
  b.hint(26, 43, 'ice — you won\'t stop easily');
  b.ground(31, 34, 50);
  b.fill(31, 49, 34, 49, 'v'); // …into an ice-spike pit
  b.ground(35, 44, 46);
  b.fill(36, 38, 44, 39, '#'); // overhang
  for (const x of [38, 40, 42]) b.entity('icicle', x, 40);
  b.entity('spear', 41, 46);
  b.ground(45, 48, 46);
  // the canyon: 16 tiles over ice spikes, crossed on the wind
  b.ground(49, 64, 61);
  b.fill(49, 60, 64, 60, 'v');
  b.entity('wind', 46, 30, { x1: 66, y1: 60, dir: 1, strength: 1300, period: 4.6, gust: 2.0 });
  b.hint(46, 42, 'wait for the gust · then open the cloth and ride it');
  b.ground(65, 90, 44);
  b.ground(72, 76, 41);
  b.entity('shuriken', 74, 41);
  b.entity('blade', 84, 44);
  b.deco('snowPine', 18, 48, { scale: 1.1 });
  b.deco('snowPine', 37, 46, { scale: 0.8 });
  b.deco('prayerFlags', 66, 44, { w: 6 });
  // a wayside shrine: the Kage-ashi, shadow dash and sprint
  b.deco('hokora', 69, 44, {});
  b.entity('pickup', 69, 44, { ability: 'shadowStep' });
  b.deco('snowPine', 80, 44, { scale: 1.2 });
  b.track(2, 30, 46);
  b.track(65, 90, 44);
  b.zone({ x0: 0, x1: 90, y0: 0, y1: 62, title: 'The Frozen Pass', sub: 'where the star\'s light points' });

  // ── 2. The Binoshi Camp ─────────────────────────────────────
  b.ground(91, 140, 44);
  b.entity('lantern', 93, 44, { id: 'camp' });
  b.deco('tent', 98, 44, { w: 4, lit: true });
  b.deco('banner', 104, 44);
  b.deco('weaponRack', 107, 44);
  b.deco('campfire', 113, 44);
  b.deco('weaponRack', 120, 44);
  b.deco('tent', 127, 44, { w: 5 });
  b.entity('note', 110, 44, { id: 'journal' });
  b.entity('gauntlet', 97, 44, {
    id: 'camp',
    x0: 97,
    x1: 135,
    gates: [[96, 38, 43], [136, 38, 43]],
    waves: [
      [{ type: 'blade', x: 104 }, { type: 'blade', x: 128 }],
      [{ type: 'spear', x: 108 }, { type: 'shuriken', x: 124 }],
      [{ type: 'blade', x: 101 }, { type: 'spear', x: 130 }, { type: 'blade', x: 118 }],
    ],
    reward: { ability: 'kaginawa', x: 116 },
  });
  b.track(91, 140, 44);
  b.zone({ x0: 91, x1: 140, y0: 30, y1: 50, title: 'The Binoshi Camp', sub: 'they did not leave in a hurry' });

  // ── 3. Yamadera, the cliff temple ───────────────────────────
  b.ground(141, 186, 44);
  b.fill(187, 12, 200, H - 1, '#'); // the cliff
  b.deco('frozenTorii', 141, 44, { scale: 1.05 });
  b.deco('templeHall', 145, 44, { w: 14, h: 4 });
  b.beam(146, 160, 38); // L1
  b.entity('note', 150, 38, { id: 'bells' });
  b.entity('anchor', 165, 30); // eave ring: swing up to L2
  b.beam(168, 186, 30); // L2
  b.deco('templeHall', 172, 30, { w: 13, h: 3 });
  b.deco('belfry', 176, 30);
  b.entity('bell', 176, 25, { id: 'b1', set: 'temple' });
  b.entity('lantern', 183, 30, { id: 'temple' });
  b.entity('anchor', 161, 20); // swing back left to L3 (and a boost toward L4)
  b.beam(146, 158, 22); // L3
  b.deco('templeHall', 146, 22, { w: 12, h: 3 });
  b.entity('bell', 150, 17, { id: 'b2', set: 'temple' });
  b.beam(160, 172, 16); // L4
  b.entity('bell', 168, 11, { id: 'b3', set: 'temple' });
  // the inner hall: gated until all three bells have rung
  b.fill(174, 12, 186, 12, 'w');
  b.fill(173, 7, 186, 7, 'w');
  b.entity('bellGate', 174, 8, { set: 'temple', tiles: [[174, 8], [174, 9], [174, 10], [174, 11]] });
  b.entity('pickup', 181, 12, { ability: 'wallJump' });
  b.entity('yuki', 156, 30);
  b.entity('yuki', 172, 20);
  b.hint(162, 35, 'hold S at the ring · ← → to swing · let go');
  b.zone({ x0: 141, x1: 200, y0: 0, y1: 46, title: 'Yamadera', sub: 'the temple that clings to the cliff' });

  // the cliff top and the long walk down to the onsen
  b.deco('snowPine', 192, 12, { scale: 1 });
  b.ground(201, 206, 16);
  b.ground(207, 212, 20);
  b.ground(213, 218, 24);
  b.ground(219, 224, 28);
  b.ground(225, 230, 32);
  b.ground(231, 236, 36);
  b.deco('jizo', 214, 24, { n: 2 });
  b.deco('snowPine', 222, 28, { scale: 1.3 });
  b.entity('spear', 228, 32);
  b.deco('prayerFlags', 231, 36, { w: 5 });

  // ── 4. The Hidden Onsen ─────────────────────────────────────
  b.ground(237, 282, 40);
  carve(242, 40, 252, 40);
  b.fill(242, 41, 252, 45, '~');
  carve(258, 40, 268, 40);
  b.fill(258, 41, 268, 45, '~');
  b.deco('onsenRocks', 241, 40, { w: 12 });
  b.deco('onsenRocks', 257, 40, { w: 12 });
  b.entity('monkey', 245, 41);
  b.entity('monkey', 249, 41);
  b.entity('monkey', 261, 41);
  b.entity('steam', 266, 41, { height: 380, period: 3.6 });
  b.beam(256, 263, 30);
  b.entity('note', 259, 30, { id: 'haiku' });
  b.entity('lantern', 269, 40, { id: 'onsen' });
  b.deco('bathhouse', 272, 40, { w: 5 });
  b.entity('monk', 279, 40);
  b.zone({ x0: 237, x1: 282, y0: 20, y1: 46, title: 'The Hidden Onsen', sub: 'warm water, cold stars' });

  // ── 5. The Frozen Falls ─────────────────────────────────────
  b.ground(283, 297, 44);
  b.fill(290, 14, 292, 38, 'I'); // left wall: sheer ice
  b.fill(298, 20, 330, H - 1, '#'); // the plateau, its face is the right wall
  b.fill(298, 27, 298, 33, 'I');
  b.fill(296, 30, 297, 31, '#'); // a ledge jutting out…
  b.entity('icicle', 296.5, 32); // …with something hanging under it
  b.beam(293, 295, 39); // step into the chimney
  b.entity('anchor', 296, 17); // above the lip: swing over it between gusts
  b.deco('frozenFall', 289, 44, { w: 10, h: 30 });
  b.entity('lantern', 285, 44, { id: 'falls' });
  b.hint(287, 40, 'hold toward a wall, then jump off it');
  b.entity('wind', 288, 8, { x1: 312, y1: 22, dir: -1, strength: 900, period: 4.0, gust: 1.6 });
  b.zone({ x0: 283, x1: 300, y0: 0, y1: 46, title: 'The Frozen Falls', sub: '' });

  // ── 6. The Scorched Slope ───────────────────────────────────
  // Snow still, but something came down hard here: a gouge, burned pines,
  // shards of plating, a dead patrol, a lifeboat. The first signs it was built.
  b.ground(331, 340, 20);
  b.ground(341, 352, 23);
  b.ground(353, 362, 40);
  b.fill(353, 39, 362, 39, 'v');
  b.fill(356, 25, 357, 25, 'M'); // wreckage to hop across the ravine
  b.fill(359, 27, 360, 27, 'M');
  b.ground(363, 378, 26);
  b.ground(379, 386, 29);
  b.ground(387, 410, 32);
  b.deco('scorchedPine', 333, 20, { h: 140 });
  b.deco('hullShard', 338, 20, { w: 2, h: 2, angle: -0.35, steam: true });
  b.deco('furrow', 341, 23, { w: 11 });
  b.deco('scorchedPine', 344, 23, { h: 170 });
  b.deco('hullShard', 349, 23, { w: 4, h: 4, angle: 0.2, text: 'TETH' });
  b.deco('deadBinoshi', 345, 23, {});
  b.deco('deadBinoshi', 350, 23, { flip: true, burst: true });
  b.entity('note', 347, 23, { id: 'patrol' });
  b.deco('scorchedPine', 351, 23, { h: 120 });
  b.deco('hullShard', 357, 39, { w: 5, h: 5, angle: -0.15 });
  b.deco('furrow', 363, 26, { w: 15 });
  b.deco('hullShard', 366, 26, { w: 3, h: 3, angle: 0.3, steam: true });
  b.deco('escapePod', 370, 26, {});
  b.entity('note', 373, 26, { id: 'podlog', look: 'terminal' });
  b.entity('lantern', 376, 26, { id: 'pod' });
  b.deco('beacon', 378, 26, {});
  b.deco('cable', 380, 29, { w: 6 });
  b.deco('scorchedPine', 382, 29, { h: 160 });
  b.deco('furrow', 387, 32, { w: 23 });
  b.deco('scorchedPine', 390, 32, { h: 130 });
  b.deco('crystals', 393, 32, { n: 3 });
  b.deco('hullShard', 398, 32, { w: 5, h: 5, angle: -0.3, steam: true });
  b.deco('cable', 392, 32, { w: 14 });
  b.deco('crystals', 403, 32, { n: 5 });
  b.deco('crystals', 408, 32, { n: 4 });
  b.entity('hugger', 395, 32);
  b.zone({ x0: 331, x1: 410, y0: 10, y1: 46, title: 'The Scorched Slope', sub: 'something came down hard here' });

  // ── 7. The Crater ───────────────────────────────────────────
  // Glass where the snow melted and set. In the middle of it, the "star":
  // a human ship, nose-down, fused into something that is not.
  b.entity('scare', 412, 35, { kind: 'reveal', fx: 448, fy: 31 });
  b.ground(411, 418, 35);
  b.ground(419, 426, 38);
  b.ground(427, 434, 41);
  b.ground(435, 470, 44);
  b.deco('tethysHull', 425, 44, { w: 46, h: 20, airlockX: 46 * 32 - 16 });
  b.deco('crystals', 413, 35, { n: 6 });
  b.deco('crystals', 423, 38, { n: 5 });
  b.deco('crystals', 438, 44, { n: 7 });
  b.deco('hullShard', 431, 41, { w: 3, h: 3, angle: 0.4 });
  b.entity('steam', 444, 44, { height: 260, period: 3.8 });
  b.entity('steam', 455, 44, { height: 300, period: 4.4, offset: 1.6 });
  b.entity('lantern', 464, 44, { id: 'crater' });
  b.zone({ x0: 411, x1: 470, y0: 20, y1: 50, title: 'The Crater', sub: 'the star was a ship' });

  // ── 8. The MSV Tethys ───────────────────────────────────────
  // A salvage hauler. Steel corridors, strip lights, the crew's things — and
  // the crew. The power goes in the mess.
  b.fill(471, 0, 590, H - 1, 'M');
  // airlock
  carve(471, 40, 480, 43);
  b.entity('door', 471, 44, { rows: 4, label: 'AIRLOCK 2' });
  b.entity('door', 480, 44, { rows: 4 });
  b.deco('evaSuit', 473, 44, { n: 2 });
  b.deco('sign', 475, 41.5, { text: 'AIRLOCK 2' });
  b.deco('tubeLight', 476, 40, { w: 2, r: 180 });
  b.deco('emergencyLight', 478, 40.5, {});
  // deck B: hypersleep
  carve(481, 37, 505, 43);
  b.deco('tubeLight', 484, 37, { w: 3 });
  b.deco('tubeLight', 491, 37, { w: 3 });
  b.deco('tubeLight', 498, 37, { w: 3, flicker: true });
  b.deco('tubeLight', 504, 37, { w: 2 });
  b.deco('emergencyLight', 487, 37.6, {});
  b.deco('emergencyLight', 500, 37.6, {});
  b.deco('sign', 481.5, 40.5, { text: 'DECK B · HYPERSLEEP', arrow: true });
  b.entity('note', 485, 44, { id: 'log1', look: 'terminal' });
  b.deco('porthole', 487.5, 39.6, { r: 22 });
  b.deco('cryoPods', 489, 44, { n: 4, broken: 2 });
  b.deco('consoleBank', 499, 44, { n: 2 });
  b.deco('pipesV', 503.3, 44, { h: 7 });
  b.deco('porthole', 502, 39.6, { r: 18 });
  // the mess
  carve(506, 33, 521, 43);
  b.deco('sign', 506.5, 37, { text: 'MESS' });
  b.deco('tubeLight', 509, 33, { w: 3 });
  b.deco('tubeLight', 516, 33, { w: 3 });
  b.deco('emergencyLight', 512.5, 33.6, { r: 320 });
  b.deco('messTable', 509, 44, {});
  b.deco('bloodSmear', 518, 44, { w: 3 });
  b.deco('deadCrew', 520, 44, { flip: true });
  b.entity('scare', 516, 44, { kind: 'power' });
  b.deco('porthole', 507.5, 36, { r: 20 });
  // maintenance shaft, down
  carve(522, 37, 527, 57);
  b.beam(525, 527, 47);
  b.beam(522, 524, 51);
  b.beam(525, 527, 55);
  b.entity('steamJet', 522, 49.5, { dir: 1, len: 150, period: 3.4 });
  b.deco('emergencyLight', 524.5, 37.6, {});
  b.deco('pipesV', 526.2, 58, { h: 20 });
  b.entity('scare', 523, 44, { kind: 'body', bx: 525.5, by: 37.5 });
  // maintenance deck C
  carve(528, 51, 575, 57);
  b.deco('sign', 528.5, 54, { text: 'MAINTENANCE C' });
  b.deco('tubeLight', 531, 51, { w: 2 });
  b.deco('tubeLight', 547, 51, { w: 2 });
  b.deco('emergencyLight', 533, 51.6, {});
  b.deco('emergencyLight', 545, 51.6, {});
  b.deco('emergencyLight', 557, 51.6, {});
  b.deco('emergencyLight', 569, 51.6, {});
  b.entity('scare', 532, 58, { kind: 'bang' });
  b.entity('arc', 537, 58, { y0: 51, period: 2.6 });
  b.deco('lockers', 540, 58, { n: 4 });
  b.entity('locker', 544, 58);
  b.deco('pipesV', 549, 58, { h: 7 });
  b.entity('steamJet', 550.2, 55.5, { dir: 1, len: 130, period: 3, offset: 0.8 });
  b.deco('grateWindow', 556, 56.5, { w: 5, h: 3 });
  b.entity('scare', 553, 58, { kind: 'passBehind', wx0: 556, wx1: 561, wy: 56.5 });
  b.deco('resinCreep', 555, 57, { w: 6, h: 5, density: 0.3 });
  b.entity('arc', 564, 58, { y0: 51, period: 2.4, offset: 1.1 });
  b.deco('resinCreep', 563, 57, { w: 6, h: 6, density: 0.55 });
  b.deco('sign', 566.5, 54, { text: 'CARGO', arrow: true });
  b.entity('scare', 562, 58, { kind: 'hiss' });
  b.entity('lantern', 571, 58, { id: 'tethys' });
  b.deco('resinCreep', 569, 57, { w: 8, h: 6, density: 0.8 });
  // the breach: where the Tethys ran into the other ship
  carve(576, 48, 590, 57);
  for (const [x, y] of [[586, 48], [588, 48], [589, 49], [587, 57], [590, 50]]) b.fill(x, y, x, y, '.');
  b.deco('resinCreep', 576, 57, { w: 14, h: 9, density: 1 });
  b.deco('deadCrew', 579, 58, { lying: true });
  b.entity('cocooned', 584, 58);
  b.deco('emergencyLight', 578, 48.6, { r: 300 });
  b.deco('emergencyLight', 588, 49.6, { r: 260 });
  b.deco('tubeLight', 582, 48, { w: 2, flicker: true, r: 200 });
  b.zone({ x0: 471, x1: 590, y0: 30, y1: 60, title: 'MSV Tethys', sub: 'deep salvage · crew of seven' });

  // ── 9. The Derelict ─────────────────────────────────────────
  // Bone. The ship the Tethys was towing — and found something in.
  b.fill(591, 0, 700, H - 1, '#');
  // the ribbed hall
  carve(591, 46, 617, 57);
  b.fill(597, 58, 601, 58, 'a');
  b.fill(607, 58, 611, 58, 'a');
  b.entity('anchor', 599, 47, { kind: 'rib' });
  b.entity('anchor', 609, 47, { kind: 'rib' });
  b.deco('ribArch', 594, 58, { h: 12, w: 3 });
  b.deco('ribArch', 603, 58, { h: 12, w: 3 });
  b.deco('ribArch', 612, 58, { h: 12, w: 3 });
  b.entity('drone', 605, 46);
  b.fill(615, 46, 616, 57, 'R');
  b.entity('scare', 604, 58, { kind: 'lightsOut', x0: 591, x1: 617 });
  // the pilot's chamber: a climb past something vast in its chair
  carve(618, 22, 645, 57);
  b.deco('pilot', 627, 58, { scale: 1.05 });
  b.entity('lantern', 620, 58, { id: 'pilot' });
  b.beam(639, 644, 52);
  b.beam(633, 637, 47);
  b.beam(639, 644, 42);
  b.beam(633, 637, 37);
  b.beam(640, 645, 32);
  b.entity('anchor', 630, 40, { kind: 'rib' });
  b.entity('anchor', 638, 27, { kind: 'rib' });
  b.entity('egg', 632, 58);
  b.entity('egg', 635, 58);
  // into the egg chamber
  carve(646, 26, 651, 31);
  carve(652, 22, 690, 49);
  b.beam(652, 656, 32);
  b.beam(660, 664, 37);
  b.beam(673, 677, 36);
  b.beam(684, 690, 33);
  // a way back up out of the eggs, if you fall in
  b.beam(687, 690, 45);
  b.beam(683, 686, 41);
  b.beam(687, 690, 37);
  for (const x of [668, 680]) b.entity('anchor', x, 27, { kind: 'rib' });
  for (let x = 654; x <= 688; x += 3) b.entity('egg', x, 50);
  b.entity('mist', 652, 50, { x1: 690 });
  b.deco('lightShaft', 666, 50, { w: 6, h: 28 });
  b.entity('drone', 667, 22);
  b.entity('drone', 683, 22);
  // down into the cargo bay — something has been above you all along
  carve(691, 29, 699, 43); // a shaft dropping from the egg chamber to the bay's deck
  b.fill(700, 28, 700, 38, 'M'); // the bay's bulkhead, with a hatch at deck level
  b.entity('lantern', 693, 44, { id: 'hive' });
  b.entity('scare', 697, 44, { kind: 'drool' });
  b.zone({ x0: 591, x1: 699, y0: 20, y1: 60, title: 'The Derelict', sub: 'what they were towing' });

  // ── 10. The Nest: the Tethys's cargo bay ────────────────────
  // A clean, flat deck to fight on: nothing to get stuck on, hooks overhead.
  b.fill(701, 0, 746, H - 1, 'M');
  carve(700, 39, 744, 43);
  carve(701, 28, 744, 43);
  b.fill(745, 28, 746, 43, 'D'); // the outer bay door
  b.deco('craneRail', 703, 28, { w: 40 });
  for (const x of [712, 722, 732, 741]) b.entity('anchor', x, 30, { kind: 'hook', dy: 22 });
  b.deco('cocoonWall', 712, 44, { w: 22, h: 14, n: 6 });
  b.deco('cargoContainer', 703, 44, { w: 4, h: 2, color: '#2c3a2a', text: '' });
  b.deco('cargoContainer', 727, 44, { w: 6, h: 3, color: '#3a2a20' });
  for (const x of [704, 718, 730, 742]) b.deco('emergencyLight', x, 28.6, { r: 340 });
  b.entity('xeno', 728, 44);
  b.entity('bossTrigger', 707, 44);
  b.zone({ x0: 701, x1: 744, y0: 24, y1: 46, title: 'Cargo Bay', sub: '' });

  // ── 11. Outside, on the crater rim ──────────────────────────
  // (the bay door falls across the drop once the fight is over)
  b.fill(747, H - 3, 749, H - 3, 'v'); // the drop under the bay door
  b.ground(750, W - 3, 47);
  b.track(747, 776, 47); // violet footprints, leading away along the rim
  b.deco('scatteredPages', 774, 47);
  b.deco('snowPine', 790, 47, { scale: 1.2 });
  b.deco('scorchedPine', 760, 47, { h: 120 });
  b.entity('relic', 777, 47, { look: 'page' });

  const level = new Level({
    grid: b.grid,
    entities: b.entities,
    decos: b.decos,
    zones: b.zones,
    tracks: b.tracks,
    hints: b.hints,
    camBounds: { x0: 0, y0: 0, x1: W * 32, y1: 64 * 32 },
    name: 'The Fallen Star',
    theme: THEMES.snow,
    chapter: 3,
    themeZones: [
      { x0: 0, theme: THEMES.snow },
      { x0: 411, theme: THEMES.crater },
      { x0: 471, theme: THEMES.ship },
      { x0: 591, theme: THEMES.derelict },
      { x0: 701, theme: THEMES.nest },
      { x0: 747, theme: THEMES.snow },
    ],
  });
  level.arena = {
    x0: 701 * 32,
    x1: 745 * 32,
    y0: 22 * 32,
    y1: 48 * 32,
    floorY: 44 * 32,
    ceilY: 28 * 32,
    door: { x0: 745, x1: 746, y0: 28, y1: 43 },
    hatch: { x: 700, y0: 39, y1: 43 }, // seals behind you when the fight starts
    eggs: [[716, 44], [735, 44]],
  };
  level.gateTiles = [];
  level.builder = b;
  return level;
}
