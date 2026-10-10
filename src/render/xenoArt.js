import { clamp, lerp } from '../core/math.js';

// The Xenomorph, drawn procedurally: one skeleton, posed every frame, skinned
// in glossy black chitin. Shared by the hive drones (small) and the boss (huge).
//
// Everything is authored facing right, in "units", with the origin on the
// ground under the hips. At s = 1 it stands ~100 units tall when hunched.
//
// pose (all optional):
//   crouch 0..1   rear 0..1 (rises onto its hind legs)   lean (rad, + = forward)
//   head (rad, + = chin down)   walk (phase)   moving 0..1   breathe (phase)
//   tail (phase)   tailRaise 0..1 (scorpion curl over the back)
//   tailStab 0..1 + stab: [x, y] local target   tailSweep 0..1 (low arc, behind → in front)
//   jaw 0..1 (mouth open)   inner 0..1 + innerLen (units): the second jaw shooting out
//   claw 0..1 (arms raised to rake)   reach 0..1 (arms thrown forward to grab)
//   flash (white hit)   cling 'ceiling' | 'wall' | null

const BASE = '#05070a';
const MID = '#121920';
const UPPER = '#1d2731';
const EDGE = '#000000';
const TEETH = '#d4dae0';
const GUM = '#2a1216';

const dirOf = (a) => [Math.cos(a), Math.sin(a)];
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];

// Two-bone IK: the joint between `a` and `b` with bone lengths l1, l2.
// bend = +1 puts the joint on the left of a→b (screen: above/forward), -1 the right.
function ik(a, b, l1, l2, bend) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const base = Math.atan2(dy, dx);
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = base - bend * off;
  return [a[0] + Math.cos(ang) * l1, a[1] + Math.sin(ang) * l1];
}

function quadPts(a, c, b, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const v = 1 - u;
    out.push([v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]);
  }
  return out;
}

// ── Skeleton ─────────────────────────────────────────────────
export function xenoSkeleton(pose = {}) {
  const cr = pose.crouch || 0;
  const rear = pose.rear || 0;
  const lean = pose.lean || 0;
  const mv = pose.moving || 0;
  const walk = pose.walk || 0;
  const br = Math.sin(pose.breathe || 0);

  const hip = [-8 + lean * 6, -60 + cr * 20 - rear * 6 + Math.abs(Math.sin(walk)) * 2 * mv];
  const spineA = lerp(-0.92, -1.42, rear) + lean * 0.55 + cr * 0.3;
  const spineLen = 46 + rear * 8;
  const shoulder = add(hip, dirOf(spineA), spineLen);
  shoulder[1] += br * 0.8;
  const hump = add(mix(hip, shoulder, 0.5), dirOf(spineA - Math.PI / 2), 15 - rear * 5);
  const neckA = spineA + lerp(1.0, 0.45, rear) + (pose.head || 0) * 0.4;
  const neckEnd = add(shoulder, dirOf(neckA), 16);
  const headA = lerp(0.24, -0.5, rear) + (pose.head || 0) + lean * 0.3 + cr * 0.12;

  // legs: feet step through a cycle; hocks ride high (digitigrade)
  const legs = [0, 1].map((side) => {
    const ph = walk + side * Math.PI;
    const stride = 16 * mv;
    const footX = hip[0] + 8 + (side ? -6 : 6) + Math.sin(ph) * stride + rear * 4;
    const lift = Math.max(0, Math.cos(ph)) * 9 * mv;
    const toe = [footX + 6, -lift];
    const hock = [footX - 8, -20 - lift - cr * 4];
    const knee = ik(hip, hock, 32, 30, 1);
    return { hip, knee, hock, toe };
  });

  // arms: a hand target per mood, solved with the elbow tucked back and down
  const arms = [0, 1].map((side) => {
    const sh = add(add(mix(shoulder, hip, 0.2), dirOf(spineA + Math.PI / 2), 7), [side ? -3 : 1, 0]);
    const sway = Math.sin(walk + side * Math.PI) * 4 * mv;
    let hand = add(sh, [18 + sway, 34 - rear * 6]);
    hand = mix(hand, add(sh, [30, -12 - side * 8]), pose.claw || 0);
    hand = mix(hand, add(sh, [58, 4 + side * 4]), pose.reach || 0);
    const elbow = ik(sh, hand, 25, 27, -1);
    return { sh, elbow, hand, curl: 1 - (pose.claw || 0) * 0.6 - (pose.reach || 0) * 0.7 };
  });

  // tail: a bezier from the base of the spine, blended between moods
  const base = add(hip, [-8, 2]);
  const sway = Math.sin(pose.tail || 0);
  let tip = add(base, [-132, 6 + sway * 10]);
  let ctrl = add(base, [-44, -40 + sway * 6]);
  const raise = pose.tailRaise || 0;
  if (raise > 0) {
    tip = mix(tip, add(shoulder, [6 + sway * 4, -62]), raise);
    ctrl = mix(ctrl, add(base, [-74, -78]), raise);
  }
  const sweep = pose.tailSweep || 0;
  if (sweep > 0) {
    // low and wide: from far behind, under its own feet, out in front
    const a = lerp(Math.PI * 0.98, Math.PI * 0.02, sweep);
    tip = mix(tip, [Math.cos(a) * 150, -6 - Math.sin(a) * 30], Math.min(1, sweep * 3));
    ctrl = mix(ctrl, [Math.cos(a) * 60 - 10, 10], Math.min(1, sweep * 3));
  }
  const stab = pose.tailStab || 0;
  if (stab > 0) {
    const tgt = pose.stab || [120, -30];
    tip = mix(add(shoulder, [0, -70]), tgt, stab);
    ctrl = mix(add(base, [-60, -90]), add(base, [-30, -150]), stab);
  }
  const tail = quadPts(base, ctrl, tip, 26);
  for (const p of tail) p[1] = Math.min(p[1], -2); // never through the floor

  const headP = (lx, ly) => {
    const c = Math.cos(headA);
    const s = Math.sin(headA);
    return [neckEnd[0] + lx * c - ly * s, neckEnd[1] + lx * s + ly * c];
  };
  const inner = (pose.inner || 0) * (pose.innerLen || 30);
  return { hip, shoulder, hump, neckEnd, headA, spineA, legs, arms, tail, headP, mouth: headP(36, 7), innerTip: headP(32 + inner, 7), snout: headP(40, 2), dome: headP(-48, -14) };
}

// World position of a local skeleton point.
export function xenoToWorld(x, feetY, facing, s, p, cling = null) {
  return [x + p[0] * facing * s, cling === 'ceiling' ? feetY - p[1] * s : feetY + p[1] * s];
}

// ── Skin ─────────────────────────────────────────────────────
// A tapered limb through pts with the given widths, outlined and filled.
function limb(ctx, pts, widths, fill, sheen = null) {
  const L = [];
  const R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    const w = widths[i] / 2;
    L.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
    R.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
  }
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
  const e = pts[pts.length - 1];
  ctx.arc(e[0], e[1], widths[widths.length - 1] / 2, Math.atan2(L[L.length - 1][1] - e[1], L[L.length - 1][0] - e[0]), Math.atan2(R[R.length - 1][1] - e[1], R[R.length - 1][0] - e[0]));
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  const s0 = pts[0];
  ctx.arc(s0[0], s0[1], widths[0] / 2, Math.atan2(R[0][1] - s0[1], R[0][0] - s0[0]), Math.atan2(L[0][1] - s0[1], L[0][0] - s0[0]));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (sheen) {
    // a highlight running along the upper edge
    ctx.strokeStyle = sheen;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const up = L[0][1] < R[0][1] ? L : R;
    const from = Math.floor(up.length * 0.15);
    ctx.moveTo(up[from][0], up[from][1]);
    for (let i = from + 1; i < up.length - 1; i++) ctx.lineTo(up[i][0], up[i][1]);
    ctx.stroke();
  }
  return { L, R };
}

function bone3(a, b, c) {
  return [a, mix(a, b, 0.5), b, mix(b, c, 0.5), c];
}

export function drawXeno(ctx, x, feetY, facing, pose = {}, s = 1, opts = {}) {
  const sk = xenoSkeleton(pose);
  const sheenOnly = opts.pass === 'sheen';
  const flash = pose.flash > 0;
  const detail = s >= 0.9;
  ctx.save();
  ctx.translate(x, feetY);
  if (pose.cling === 'ceiling') ctx.scale(facing * s, -s);
  else ctx.scale(facing * s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (sheenOnly) drawSheen(ctx, sk, pose, detail);
  else drawBody(ctx, sk, pose, detail, flash);
  ctx.restore();
}

function drawBody(ctx, sk, pose, detail, flash) {
  const fill = flash ? '#ffffff' : BASE;
  const far = flash ? '#e8e8e8' : '#020304';
  const shine = flash ? null : 'rgba(150,185,215,0.38)';

  // far limbs, sunk into shadow
  const legF = sk.legs[1];
  limb(ctx, bone3(legF.hip, legF.knee, legF.hock), [16, 12, 8, 6.5, 5.5], far);
  limb(ctx, [legF.hock, legF.toe], [5, 3], far);
  drawFoot(ctx, legF.toe, far);
  const armF = sk.arms[1];
  limb(ctx, bone3(armF.sh, armF.elbow, armF.hand), [7, 6, 5, 4, 3.5], far);
  drawHand(ctx, armF, far, null);

  // tail: a chain of vertebrae, thick at the root, ending in a blade
  drawTail(ctx, sk.tail, fill, shine, detail);

  // torso
  const { hip, shoulder, hump } = sk;
  const g = ctx.createLinearGradient(hump[0], hump[1] - 10, hip[0], hip[1] + 20);
  g.addColorStop(0, flash ? '#fff' : UPPER);
  g.addColorStop(0.5, flash ? '#fff' : MID);
  g.addColorStop(1, fill);
  const belly = add(mix(hip, shoulder, 0.45), dirOf(sk.spineA + Math.PI / 2), 13);
  const chestLow = add(mix(hip, shoulder, 0.85), dirOf(sk.spineA + Math.PI / 2), 19);
  ctx.beginPath();
  ctx.moveTo(hip[0] - 10, hip[1] + 4);
  ctx.quadraticCurveTo(hip[0] - 6, hip[1] - 12, hump[0], hump[1]);
  ctx.quadraticCurveTo(shoulder[0] - 2, shoulder[1] - 10, shoulder[0] + 8, shoulder[1] - 2);
  ctx.quadraticCurveTo(shoulder[0] + 10, shoulder[1] + 10, chestLow[0], chestLow[1]);
  ctx.quadraticCurveTo(belly[0] + 4, belly[1] + 2, belly[0], belly[1]);
  ctx.quadraticCurveTo(hip[0] + 6, hip[1] + 12, hip[0] - 10, hip[1] + 4);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  if (!flash) {
    // ribcage: hard ridges wrapping the chest
    ctx.strokeStyle = 'rgba(120,150,175,0.32)';
    ctx.lineWidth = 1.3;
    for (let k = 0; k < 6; k++) {
      const u = 0.32 + k * 0.1;
      const c = mix(hip, shoulder, u);
      const top = add(c, dirOf(sk.spineA - Math.PI / 2), 6 - k * 0.3);
      const bot = add(c, dirOf(sk.spineA + Math.PI / 2), 10 + k * 0.6);
      const mid = add(mix(top, bot, 0.5), dirOf(sk.spineA), 5);
      ctx.beginPath();
      ctx.moveTo(top[0], top[1]);
      ctx.quadraticCurveTo(mid[0], mid[1], bot[0], bot[1]);
      ctx.stroke();
    }
    // spine: a row of vertebral knuckles along the back
    ctx.fillStyle = MID;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    for (let k = 0; k < 7; k++) {
      const u = k / 7;
      const p = u < 0.5 ? mix([hip[0] - 6, hip[1] - 8], hump, u * 2) : mix(hump, [shoulder[0] + 2, shoulder[1] - 7], (u - 0.5) * 2);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 3.2, 2.2, sk.spineA, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // pelvis
    ctx.fillStyle = MID;
    ctx.beginPath();
    ctx.ellipse(hip[0] - 2, hip[1] + 2, 9, 6, sk.spineA * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // dorsal tubes: the signature exhaust-pipe spines off the back
  drawTubes(ctx, sk, fill, shine, flash);
  // a bony plate over the shoulder
  const sp = add(sk.shoulder, [0, 4]);
  ctx.fillStyle = flash ? '#fff' : MID;
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(sp[0], sp[1], 10, 7, sk.spineA + 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (shine) {
    ctx.strokeStyle = shine;
    ctx.beginPath();
    ctx.ellipse(sp[0], sp[1], 7, 4.5, sk.spineA + 0.4, Math.PI * 1.1, Math.PI * 1.8);
    ctx.stroke();
  }

  // near leg
  const leg = sk.legs[0];
  limb(ctx, bone3(leg.hip, leg.knee, leg.hock), [19, 14, 9, 7, 6], fill, shine);
  limb(ctx, [leg.hock, leg.toe], [5.5, 3.5], fill);
  if (!flash && detail) {
    // knee spur
    ctx.fillStyle = MID;
    ctx.beginPath();
    ctx.moveTo(leg.knee[0] - 2, leg.knee[1] - 3);
    ctx.lineTo(leg.knee[0] + 9, leg.knee[1] - 2);
    ctx.lineTo(leg.knee[0] + 1, leg.knee[1] + 4);
    ctx.fill();
    ctx.stroke();
  }
  drawFoot(ctx, leg.toe, fill);

  // neck: corrugated hoses
  const n0 = sk.shoulder;
  const n1 = sk.neckEnd;
  limb(ctx, [add(n0, [2, -2]), mix(n0, n1, 0.5), n1], [14, 12, 11], fill);
  if (!flash) {
    ctx.strokeStyle = 'rgba(120,150,175,0.35)';
    ctx.lineWidth = 1;
    const na = Math.atan2(n1[1] - n0[1], n1[0] - n0[0]) + Math.PI / 2;
    for (let k = 1; k < 5; k++) {
      const c = mix(n0, n1, k / 5);
      ctx.beginPath();
      ctx.moveTo(c[0] + Math.cos(na) * 5, c[1] + Math.sin(na) * 5);
      ctx.lineTo(c[0] - Math.cos(na) * 5, c[1] - Math.sin(na) * 5);
      ctx.stroke();
    }
  }

  drawHead(ctx, sk, pose, fill, flash, detail);

  // near arm, over everything
  const arm = sk.arms[0];
  limb(ctx, bone3(arm.sh, arm.elbow, arm.hand), [9, 7, 5.5, 4.5, 4], fill, shine);
  if (!flash && detail) {
    ctx.fillStyle = MID;
    ctx.beginPath();
    ctx.arc(arm.elbow[0], arm.elbow[1], 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  drawHand(ctx, arm, fill, shine);
}

function drawFoot(ctx, toe, fill) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.2;
  for (const k of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(toe[0] - 3, toe[1] - 2);
    ctx.quadraticCurveTo(toe[0] + 6, toe[1] - 3 + k, toe[0] + 9 + k * 2, toe[1] + 0.5);
    ctx.lineTo(toe[0] - 2, toe[1] + 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawHand(ctx, arm, fill, shine) {
  const { elbow, hand, curl } = arm;
  const a = Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]);
  ctx.strokeStyle = EDGE;
  for (let k = -1; k <= 1; k++) {
    const a1 = a + k * 0.32 + 0.15;
    const mid = add(hand, dirOf(a1), 9);
    const tip = add(mid, dirOf(a1 + curl * 0.9), 9);
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(hand[0], hand[1]);
    ctx.lineTo(mid[0], mid[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.strokeStyle = fill;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = EDGE;
    // claw
    const claw = add(tip, dirOf(a1 + curl * 1.3), 4);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.lineTo(claw[0], claw[1]);
    ctx.stroke();
  }
  // thumb
  const th = add(hand, dirOf(a - 1.1), 7);
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(hand[0], hand[1]);
  ctx.lineTo(th[0], th[1]);
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawTubes(ctx, sk, fill, shine, flash) {
  const back = (u) => (u < 0.5 ? mix([sk.hip[0] - 6, sk.hip[1] - 8], sk.hump, u * 2) : mix(sk.hump, [sk.shoulder[0] + 2, sk.shoulder[1] - 7], (u - 0.5) * 2));
  const out = sk.spineA - Math.PI / 2 + 0.5; // up and back
  const tubes = [
    [0.5, 22, 5.5],
    [0.62, 25, 6],
    [0.74, 23, 5.5],
    [0.86, 18, 5],
  ];
  for (const [u, len, w] of tubes) {
    const root = back(u);
    const tip = add(root, dirOf(out + (u - 0.7) * 0.9), len);
    const bend = add(mix(root, tip, 0.5), dirOf(out + Math.PI / 2), 2);
    limb(ctx, [root, bend, tip], [w + 1.5, w, w - 0.5], fill);
    // the open end
    const ang = Math.atan2(tip[1] - bend[1], tip[0] - bend[0]);
    ctx.fillStyle = flash ? '#ddd' : '#000';
    ctx.beginPath();
    ctx.ellipse(tip[0], tip[1], (w - 0.5) / 2, (w - 0.5) / 3.2, ang + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    if (shine) {
      ctx.strokeStyle = shine;
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  }
}

function drawTail(ctx, tail, fill, shine, detail) {
  const n = tail.length;
  // the core, so vertebrae read as one continuous rope
  const widths = tail.map((_, i) => lerp(10, 2.5, i / (n - 1)));
  limb(ctx, tail, widths, fill);
  // vertebrae: rounded knuckles with a little dorsal barb each
  for (let i = 1; i < n - 1; i += detail ? 1 : 2) {
    const p = tail[i];
    const q = tail[i + 1];
    const a = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const w = widths[i] * 0.62;
    ctx.fillStyle = fill;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(p[0], p[1], w * 0.9, w, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (detail && i % 3 === 0 && i < n - 4) {
      const nrm = a - Math.PI / 2;
      const b0 = add(p, dirOf(nrm), w);
      const b1 = add(add(p, dirOf(nrm), w + widths[i] * 0.5), dirOf(a + Math.PI), widths[i] * 0.6);
      ctx.beginPath();
      ctx.moveTo(b0[0], b0[1]);
      ctx.lineTo(b1[0], b1[1]);
      ctx.lineTo(...add(b0, dirOf(a + Math.PI), widths[i] * 0.7));
      ctx.fill();
      ctx.stroke();
    }
    if (shine) {
      ctx.strokeStyle = shine;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], w * 0.6, w * 0.7, a, Math.PI * 1.15, Math.PI * 1.75);
      ctx.stroke();
    }
  }
  // the blade
  const t1 = tail[n - 1];
  const t0 = tail[n - 3];
  const a = Math.atan2(t1[1] - t0[1], t1[0] - t0[0]);
  const tip = add(t1, dirOf(a), 22);
  const s1 = add(add(t1, dirOf(a), 6), dirOf(a + Math.PI / 2), 6);
  const s2 = add(add(t1, dirOf(a), 6), dirOf(a - Math.PI / 2), 5);
  ctx.fillStyle = fill === '#ffffff' ? fill : '#0b0f14';
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(t1[0], t1[1]);
  ctx.quadraticCurveTo(s1[0], s1[1], tip[0], tip[1]);
  ctx.quadraticCurveTo(s2[0], s2[1], t1[0], t1[1]);
  ctx.fill();
  ctx.stroke();
  if (shine) {
    ctx.strokeStyle = 'rgba(200,220,240,0.55)';
    ctx.beginPath();
    ctx.moveTo(...add(t1, dirOf(a), 4));
    ctx.lineTo(...add(tip, dirOf(a + Math.PI), 2));
    ctx.stroke();
  }
}

function drawHead(ctx, sk, pose, fill, flash, detail) {
  ctx.save();
  ctx.translate(sk.neckEnd[0], sk.neckEnd[1]);
  ctx.rotate(sk.headA);
  const jaw = pose.jaw || 0;
  const inner = (pose.inner || 0) * (pose.innerLen || 30);

  // lower jaw (behind the skull), swinging open
  ctx.save();
  ctx.translate(6, 9);
  ctx.rotate(jaw * 0.42);
  ctx.fillStyle = fill;
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-2, -3);
  ctx.quadraticCurveTo(14, 5, 27, 2);
  ctx.lineTo(28, -1);
  ctx.quadraticCurveTo(14, 0, 0, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (!flash) {
    ctx.fillStyle = TEETH;
    for (let k = 0; k < 7; k++) {
      const tx = 6 + k * 3;
      ctx.beginPath();
      ctx.moveTo(tx, -1);
      ctx.lineTo(tx + 1.2, -4.5);
      ctx.lineTo(tx + 2.4, -1);
      ctx.fill();
    }
  }
  ctx.restore();

  // the mouth cavity and the second jaw
  if ((jaw > 0.05 || inner > 0) && !flash) {
    ctx.fillStyle = GUM;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(34, 7);
    ctx.lineTo(30, 10 + jaw * 10);
    ctx.lineTo(8, 11);
    ctx.fill();
  }
  if (inner > 0) {
    // a muscled rod sliding out of the throat, a little snapping mouth at its end
    const L = inner;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.lineTo(30 + L, 7.5);
    ctx.stroke();
    ctx.strokeStyle = flash ? '#fff' : '#3a2a30';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,170,180,0.35)';
    ctx.lineWidth = 1;
    for (let k = 14; k < 28 + L; k += 4) {
      ctx.beginPath();
      ctx.moveTo(k, 6);
      ctx.lineTo(k, 10);
      ctx.stroke();
    }
    ctx.fillStyle = flash ? '#fff' : '#120c0e';
    ctx.strokeStyle = EDGE;
    ctx.beginPath();
    ctx.ellipse(32 + L, 7.5, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = TEETH;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(35 + L, 7.5 + k * 2.2);
      ctx.lineTo(39 + L, 6.8 + k * 2.2);
      ctx.lineTo(35 + L, 6.2 + k * 2.2);
      ctx.fill();
    }
    // a string of slaver trailing off it
    ctx.strokeStyle = 'rgba(200,225,215,0.5)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(26 + L * 0.7, 9);
    ctx.quadraticCurveTo(27 + L * 0.7, 16, 25 + L * 0.7, 20);
    ctx.stroke();
  }

  // the skull: a long glossy dome swept back over the neck
  const g = ctx.createLinearGradient(0, -30, 6, 10);
  g.addColorStop(0, flash ? '#fff' : '#26323e');
  g.addColorStop(0.45, flash ? '#fff' : '#0f151b');
  g.addColorStop(1, fill);
  ctx.fillStyle = g;
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(40, 2);
  ctx.quadraticCurveTo(39, -5, 28, -8);
  ctx.bezierCurveTo(10, -13, -20, -13, -46, -17);
  ctx.quadraticCurveTo(-56, -18, -52, -11);
  ctx.bezierCurveTo(-38, -6, -16, -2, -2, 0);
  ctx.lineTo(0, 7);
  ctx.lineTo(7, 9);
  ctx.quadraticCurveTo(24, 9, 38, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (!flash) {
    // the skull beneath the translucent carapace
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(90,110,125,0.35)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 7; k++) {
      const u = k / 7;
      ctx.beginPath();
      ctx.moveTo(16 - u * 58, -10 - u * 6);
      ctx.quadraticCurveTo(13 - u * 58, -4 - u * 5, 9 - u * 54, 1 - u * 6);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,78,92,0.35)';
    ctx.beginPath();
    ctx.ellipse(8, -4, 9, 4, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // upper teeth: a silver row under the lip
    ctx.fillStyle = TEETH;
    for (let k = 0; k < 8; k++) {
      const tx = 10 + k * 3.1;
      ctx.beginPath();
      ctx.moveTo(tx, 7.5);
      ctx.lineTo(tx + 1.2, 11.5 + (k % 2));
      ctx.lineTo(tx + 2.5, 7.5);
      ctx.fill();
    }
    // lip pulled back in a snarl
    if (jaw > 0.2) {
      ctx.strokeStyle = GUM;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(10, 6.5);
      ctx.quadraticCurveTo(22, 4 - jaw * 2, 36, 6);
      ctx.stroke();
    }
    // drool
    const t = pose.breathe || 0;
    ctx.strokeStyle = 'rgba(200,225,215,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 10);
    ctx.quadraticCurveTo(21, 16 + Math.sin(t * 2) * 2, 19, 21 + jaw * 6);
    ctx.stroke();
    if (detail) {
      ctx.beginPath();
      ctx.moveTo(30, 9);
      ctx.quadraticCurveTo(31, 13, 30, 15 + Math.sin(t * 3) * 2);
      ctx.stroke();
    }
    drawDomeShine(ctx, 0.75);
  }
  ctx.restore();
}

// The long wet highlight down the dome: what you actually see of it in the dark.
function drawDomeShine(ctx, a) {
  ctx.strokeStyle = `rgba(200,225,245,${a})`;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(32, -5.5);
  ctx.bezierCurveTo(12, -10, -18, -10.5, -46, -14.5);
  ctx.stroke();
  ctx.strokeStyle = `rgba(200,225,245,${a * 0.35})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(24, -6);
  ctx.bezierCurveTo(8, -8.5, -14, -9, -34, -11.5);
  ctx.stroke();
  ctx.fillStyle = `rgba(235,245,255,${a})`;
  ctx.beginPath();
  ctx.ellipse(26, -6.5, 3, 1.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

// Highlights only, drawn additively after the lighting pass so the creature's
// shape glints out of the dark the way it does on film.
function drawSheen(ctx, sk, pose, detail) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(sk.neckEnd[0], sk.neckEnd[1]);
  ctx.rotate(sk.headA);
  drawDomeShine(ctx, 0.5);
  ctx.fillStyle = 'rgba(200,210,220,0.35)';
  for (let k = 0; k < 8; k++) ctx.fillRect(10 + k * 3.1, 8, 1.4, 2.5);
  ctx.restore();
  // spine ridge and tubes catching the light
  ctx.strokeStyle = 'rgba(150,185,215,0.28)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(sk.hip[0] - 6, sk.hip[1] - 9);
  ctx.quadraticCurveTo(sk.hump[0], sk.hump[1] - 4, sk.shoulder[0] + 2, sk.shoulder[1] - 8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(150,185,215,0.18)';
  ctx.lineWidth = 1;
  const tail = sk.tail;
  ctx.beginPath();
  ctx.moveTo(tail[0][0], tail[0][1] - 3);
  for (let i = 1; i < tail.length; i += 2) ctx.lineTo(tail[i][0], tail[i][1] - lerp(4, 1, i / tail.length));
  ctx.stroke();
  if (detail) {
    for (const leg of [sk.legs[0]]) {
      ctx.beginPath();
      ctx.moveTo(leg.hip[0] + 3, leg.hip[1] - 4);
      ctx.lineTo(leg.knee[0] + 2, leg.knee[1] - 4);
      ctx.stroke();
    }
  }
  ctx.restore();
}
