import { lerp, damp, clamp, easeOutCubic } from '../core/math.js';

// A procedural ninja: jointed limbs, blended poses, a simulated scarf, and a
// cloth parachute held by hands and feet. Used by the player and the Binoshi.
//
// Angles are absolute, measured from straight down; positive swings toward the
// facing direction. π/2 points forward, π points up, -π/2 points backward.

const THIGH = 12;
const SHIN = 12;
const UPPER_ARM = 9.5;
const FOREARM = 9;
const TORSO = 17;
const HEAD_R = 8;

export const STYLES = {
  player: {
    outline: '#07050c',
    cloth: '#26375e',
    clothHi: '#4a6396',
    clothDark: '#16203a',
    accent: '#e0354b',
    accentDark: '#8e1a2c',
    wrap: '#a69c8a',
    skin: '#ecc7a2',
    eye: '#ffffff',
    metal: '#e6ecf5',
    hilt: '#2a1f18',
    cloth2: ['#c22a3f', '#7d1426'],
  },
  binoshi: {
    outline: '#030204',
    cloth: '#18121c',
    clothHi: '#33283b',
    clothDark: '#0c090e',
    accent: '#7d3cff',
    accentDark: '#3f1890',
    wrap: '#40344a',
    skin: '#8f1f2b',
    eye: '#d9b8ff',
    metal: '#b9b3c9',
    hilt: '#1a1020',
    glowEyes: true,
    cloth2: ['#4b2690', '#24104d'],
  },
};

const BASE = {
  lean: 0,
  drop: 0,
  headTilt: 0,
  armF: [0.3, 0.5],
  armB: [-0.2, 0.4],
  legF: [0.15, -0.12],
  legB: [-0.15, -0.08],
  sword: 0, // 0 sheathed, 1 in hand
  swordA: 0,
  cloth: 0,
  spin: 0,
};

export const POSES = {
  idle: { ...BASE, lean: 0.06 },
  jump: { ...BASE, lean: 0.12, armF: [1.9, 0.5], armB: [-0.9, 0.4], legF: [1.3, -1.7], legB: [-0.3, -0.5] },
  fall: { ...BASE, lean: 0.04, armF: [2.3, 0.4], armB: [-2.3, -0.3], legF: [0.4, -0.7], legB: [-0.3, -0.3] },
  tuck: { ...BASE, lean: 0.3, armF: [1.3, 1.3], armB: [1.0, 1.2], legF: [1.7, -2.5], legB: [1.4, -2.3] },
  float: { ...BASE, lean: 1.3, drop: -6, headTilt: -0.95, armF: [2.85, 0.1], armB: [3.05, 0.05], legF: [-1.5, -1.25], legB: [-1.65, -1.15], cloth: 1 },
  dash: { ...BASE, lean: 0.85, drop: 3, armF: [-1.55, 0.2], armB: [-1.8, 0.1], legF: [1.15, -0.9], legB: [-1.0, -0.5] },
  wall: { ...BASE, lean: 0.12, armF: [0.6, 0.7], armB: [-2.2, -0.3], legF: [0.6, -1.5], legB: [-1.2, -0.5] },
  hurt: { ...BASE, lean: -0.35, armF: [2.2, 0.4], armB: [-2.5, 0], legF: [0.7, -0.7], legB: [-0.5, -0.2] },
  kneel: { ...BASE, lean: 0.12, drop: 9, headTilt: 0.35, armF: [0.95, 0.75], armB: [0.55, 0.9], legF: [1.45, -1.45], legB: [0.05, -1.6] },
  crouch: { ...BASE, lean: 0.45, drop: 7, armF: [1.2, 0.8], armB: [-0.8, 0.5], legF: [1.1, -1.9], legB: [-0.2, -1.4] },
  throwWind: { ...BASE, lean: -0.1, armF: [-2.4, -0.3], armB: [1.4, 0.3], legF: [0.5, -0.4], legB: [-0.4, -0.2] },
  throwRelease: { ...BASE, lean: 0.3, armF: [1.75, 0.05], armB: [-1.0, 0.3], legF: [0.6, -0.5], legB: [-0.5, -0.2] },
  dead: { ...BASE, lean: -1.4, drop: 18, armF: [2.8, 0.2], armB: [-2.6, 0], legF: [1.2, -0.3], legB: [0.9, -0.2] },
};

export function runPose(phase, speedK = 1) {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const s2 = Math.sin(phase + Math.PI);
  const c2 = Math.cos(phase + Math.PI);
  return {
    ...BASE,
    lean: 0.42 * speedK,
    drop: -Math.abs(c) * 1.6 + 1,
    headTilt: -0.1,
    armF: [-1.2, 0.35],
    armB: [-1.45, 0.3],
    legF: [0.1 + s * 0.85, -(0.15 + 1.5 * Math.max(0, c))],
    legB: [0.1 + s2 * 0.85, -(0.15 + 1.5 * Math.max(0, c2))],
  };
}

// Sword arcs, as absolute arm angles (0 = straight down, π = straight up,
// positive swings forward). The slash smear traces the same path.
export const SWING_ARCS = {
  down: { a0: 3.0, a1: 0.3 }, // side down-cut: overhead to low-forward
  up: { a0: 0.15, a1: 2.9 }, // side up-cut (every other side slash)
  overhead: { a0: 1.1, a1: 4.4 }, // aimed up: front, over the head, to the back
  under: { a0: 1.9, a1: -1.4 }, // aimed down in the air: front, under the feet, to the back
};

const WINDUP = 0.16; // fraction of the swing spent coiling back
const COIL = 0.3; // radians the arm pulls back before swinging

// Arm angle at swing progress s (0 → 1): a quick coil, then a fast ease-out cut.
export function swingAngle(arc, s) {
  const dir = Math.sign(arc.a1 - arc.a0);
  const pre = arc.a0 - dir * COIL;
  if (s < WINDUP) return lerp(arc.a0, pre, s / WINDUP);
  const k = (s - WINDUP) / (1 - WINDUP);
  return lerp(pre, arc.a1, 1 - Math.pow(1 - k, 4));
}

// Full-body attack pose: the hips and back arm drive the cut, not just the sword arm.
export function attackPose(base, kind, arc, s, grounded) {
  const p = { ...base, sword: 1, swordA: 0 };
  const a = swingAngle(arc, s);
  const cut = s < WINDUP ? 0 : Math.min(1, (s - WINDUP) / (1 - WINDUP) * 1.6);
  p.armF = [a, 0];
  if (kind === 'overhead') {
    p.lean = lerp(0.1, -0.25, cut);
    p.headTilt = lerp(0, -0.35, cut);
    p.armB = [lerp(-0.3, -1.2, cut), 0.6];
    p.drop = lerp(3, -1, cut);
    if (grounded) {
      p.legF = [0.2, -0.15];
      p.legB = [-0.2, -0.1];
    }
  } else if (kind === 'under') {
    p.lean = lerp(0.1, 0.45, cut);
    p.headTilt = 0.3;
    p.armB = [lerp(0.5, 2.0, cut), 0.4];
    p.legF = [1.4, -1.9];
    p.legB = [1.05, -1.8];
  } else {
    // side cut: coil back, then lunge into it
    p.lean = s < WINDUP ? (base.lean || 0) - 0.15 : lerp(0.05, 0.5, cut);
    p.drop = lerp(1, 5, cut);
    p.headTilt = lerp(-0.1, 0.12, cut);
    p.armB = [lerp(0.6, -1.9, cut), lerp(0.8, 0.3, cut)];
    if (grounded) {
      p.legF = [lerp(0.2, 0.8, cut), lerp(-0.2, -0.65, cut)];
      p.legB = [lerp(-0.1, -0.6, cut), -0.25];
    }
  }
  return p;
}

function copyPose(p) {
  return { ...p, armF: [...p.armF], armB: [...p.armB], legF: [...p.legF], legB: [...p.legB] };
}

const fwd = (a, L) => [Math.sin(a) * L, Math.cos(a) * L];

export class NinjaRig {
  constructor(style = STYLES.player) {
    this.style = style;
    this.pose = copyPose(POSES.idle);
    this.target = POSES.idle;
    this.rate = 22;
    this.sx = 1;
    this.sy = 1;
    this.spin = 0;
    this.spinT = 0;
    this.spinDur = 0.32;
    this.time = 0;
    this.scarf = null;
    this.scarf2 = null;
    this.joints = null;
    this.flash = 0;
  }

  set(target, rate = 22) {
    this.target = target;
    this.rate = rate;
  }

  squash(sx, sy) {
    this.sx = sx;
    this.sy = sy;
  }

  flip(dur = 0.32) {
    this.spinT = dur;
    this.spinDur = dur;
  }

  update(dt, worldX, worldFeetY, facing, vx = 0, vy = 0) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt);
    const p = this.pose;
    const t = this.target;
    for (const k of ['lean', 'drop', 'headTilt', 'sword', 'swordA', 'cloth']) p[k] = damp(p[k], t[k], this.rate, dt);
    for (const k of ['armF', 'armB', 'legF', 'legB']) {
      p[k][0] = damp(p[k][0], t[k][0], this.rate, dt);
      p[k][1] = damp(p[k][1], t[k][1], this.rate, dt);
    }
    if (t.sword > 0.5) p.sword = 1;
    this.sx = damp(this.sx, 1, 14, dt);
    this.sy = damp(this.sy, 1, 14, dt);
    if (this.spinT > 0) {
      this.spinT = Math.max(0, this.spinT - dt);
      this.spin = (1 - this.spinT / this.spinDur) * Math.PI * 2;
    } else this.spin = 0;

    this.computeJoints();
    this.scarfAcc = (this.scarfAcc || 0) + dt;
    while (this.scarfAcc >= 1 / 60) {
      this.scarfAcc -= 1 / 60;
      this.simScarf(worldX, worldFeetY, facing);
    }
  }

  computeJoints() {
    const p = this.pose;
    const hip = [0, -24 + p.drop];
    const [lx, ly] = fwd(Math.PI - p.lean, TORSO);
    const sh = [hip[0] + lx, hip[1] + ly];
    const [hx, hy] = fwd(Math.PI - p.lean - p.headTilt * 0.5, 9.5);
    const head = [sh[0] + hx, sh[1] + hy];
    const limb = (root, [a1, a2], L1, L2) => {
      const [ax, ay] = fwd(a1, L1);
      const mid = [root[0] + ax, root[1] + ay];
      const [bx, by] = fwd(a1 + a2, L2);
      return [root, mid, [mid[0] + bx, mid[1] + by], a1 + a2];
    };
    this.joints = {
      hip,
      sh,
      head,
      armF: limb([sh[0] + 1.5, sh[1] + 1], p.armF, UPPER_ARM, FOREARM),
      armB: limb([sh[0] - 1.5, sh[1] + 1], p.armB, UPPER_ARM, FOREARM),
      legF: limb([hip[0] + 2, hip[1]], p.legF, THIGH, SHIN),
      legB: limb([hip[0] - 2, hip[1]], p.legB, THIGH, SHIN),
    };
  }

  // Scarf tails trail from the back of the head; simulated in world space.
  simScarf(wx, wy, facing) {
    const j = this.joints;
    const ax = wx + (j.head[0] - 6) * facing * this.sx;
    const ay = wy + (j.head[1] - 2) * this.sy;
    const make = (n) => Array.from({ length: n }, () => ({ x: ax, y: ay, px: ax, py: ay }));
    if (!this.scarf) {
      this.scarf = make(9);
      this.scarf2 = make(6);
    }
    const sim = (pts, seg, phase) => {
      pts[0].x = ax;
      pts[0].y = ay;
      for (let i = 1; i < pts.length; i++) {
        const q = pts[i];
        const nx = q.x + (q.x - q.px) * 0.86;
        const ny = q.y + (q.y - q.py) * 0.86;
        q.px = q.x;
        q.py = q.y;
        const wind = Math.sin(this.time * 9 + i * 0.9 + phase) * 0.55;
        q.x = nx - facing * 0.55 + wind * 0.45;
        q.y = ny + 0.16 + wind * 0.35;
      }
      for (let k = 0; k < 3; k++) {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1];
          const b = pts[i];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const diff = (d - seg) / d;
          b.x -= dx * diff;
          b.y -= dy * diff;
        }
      }
    };
    // Snap if teleported
    if (Math.hypot(this.scarf[0].x - ax, this.scarf[0].y - ay) > 80) {
      this.scarf = make(9);
      this.scarf2 = make(6);
    }
    sim(this.scarf, 5.2, 0);
    sim(this.scarf2, 4.6, 1.7);
  }

  // Hand / foot tips in world space (for parachute anchoring, kunai release etc.)
  tip(name, wx, wy, facing) {
    const t = this.joints[name][2];
    return [wx + t[0] * facing * this.sx, wy + t[1] * this.sy];
  }

  draw(ctx, wx, wy, facing, opts = {}) {
    if (!this.joints) this.computeJoints();
    const st = opts.silhouette ? silhouetteStyle(opts.silhouette) : this.style;
    const j = this.joints;
    const p = this.pose;

    if (!opts.silhouette) this.drawScarf(ctx, st);

    ctx.save();
    ctx.translate(wx, wy);
    if (this.spin) {
      ctx.translate(0, -24);
      ctx.rotate(this.spin * facing);
      ctx.translate(0, 24);
    }
    ctx.scale(facing * this.sx, this.sy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (p.cloth > 0.02) this.drawParachute(ctx, st, p.cloth);

    this.drawArm(ctx, j.armB, st, true);
    this.drawLeg(ctx, j.legB, st, true);
    if (p.sword < 0.5) this.drawSheath(ctx, st);
    this.drawTorso(ctx, st);
    this.drawLeg(ctx, j.legF, st, false);
    this.drawHead(ctx, st);
    this.drawArm(ctx, j.armF, st, false);
    if (p.sword >= 0.5) this.drawBlade(ctx, st, j.armF);

    if (this.flash > 0 && !opts.silhouette) {
      // White hit flash: redraw silhouette on top with additive white.
      ctx.globalAlpha = Math.min(1, this.flash * 10);
      const wst = silhouetteStyle('#ffffff');
      this.drawArm(ctx, j.armB, wst, true);
      this.drawLeg(ctx, j.legB, wst, true);
      this.drawTorso(ctx, wst);
      this.drawLeg(ctx, j.legF, wst, false);
      this.drawHead(ctx, wst);
      this.drawArm(ctx, j.armF, wst, false);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  drawSeg(ctx, a, b, w, color, outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = w + 2.4;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  }

  drawLeg(ctx, [hip, knee, foot, footA], st, back) {
    const col = back ? st.clothDark : st.cloth;
    // outlines first so the knee joint reads as one shape
    ctx.strokeStyle = st.outline;
    ctx.lineWidth = 9.6;
    ctx.beginPath();
    ctx.moveTo(hip[0], hip[1]);
    ctx.lineTo(knee[0], knee[1]);
    ctx.lineTo(foot[0], foot[1]);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 7.4;
    ctx.beginPath();
    ctx.moveTo(hip[0], hip[1]);
    ctx.lineTo(knee[0], knee[1]);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(knee[0], knee[1]);
    ctx.lineTo(foot[0], foot[1]);
    ctx.stroke();
    // shin wraps
    ctx.strokeStyle = back ? shade(st.wrap, -0.35) : st.wrap;
    ctx.lineWidth = 4.6;
    const m = [lerp(knee[0], foot[0], 0.45), lerp(knee[1], foot[1], 0.45)];
    ctx.beginPath();
    ctx.moveTo(m[0], m[1]);
    ctx.lineTo(foot[0], foot[1]);
    ctx.stroke();
    // tabi foot, pointing forward relative to the shin
    // toes point perpendicular to the shin, forward
    ctx.save();
    ctx.translate(foot[0], foot[1]);
    ctx.rotate(-footA);
    ctx.fillStyle = st.outline;
    ctx.beginPath();
    ctx.ellipse(2.2, 0, 5.4, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = back ? st.clothDark : st.clothHi;
    ctx.beginPath();
    ctx.ellipse(2.2, -0.2, 4.2, 2.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawArm(ctx, [sh, el, hand], st, back) {
    const col = back ? st.clothDark : st.cloth;
    ctx.strokeStyle = st.outline;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(sh[0], sh[1]);
    ctx.lineTo(el[0], el[1]);
    ctx.lineTo(hand[0], hand[1]);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 5.8;
    ctx.beginPath();
    ctx.moveTo(sh[0], sh[1]);
    ctx.lineTo(el[0], el[1]);
    ctx.stroke();
    ctx.strokeStyle = back ? shade(st.wrap, -0.35) : st.wrap;
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(el[0], el[1]);
    ctx.lineTo(hand[0], hand[1]);
    ctx.stroke();
    ctx.fillStyle = st.outline;
    ctx.beginPath();
    ctx.arc(hand[0], hand[1], 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = back ? shade(st.wrap, -0.35) : st.wrap;
    ctx.beginPath();
    ctx.arc(hand[0], hand[1], 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawTorso(ctx, st) {
    const { hip, sh } = this.joints;
    const dx = sh[0] - hip[0];
    const dy = sh[1] - hip[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const hw = 5.2;
    const sw = 7;
    ctx.beginPath();
    ctx.moveTo(hip[0] + nx * hw, hip[1] + ny * hw);
    ctx.quadraticCurveTo(
      (hip[0] + sh[0]) / 2 + nx * (sw + 1.5),
      (hip[1] + sh[1]) / 2 + ny * (sw + 1.5),
      sh[0] + nx * sw,
      sh[1] + ny * sw,
    );
    ctx.quadraticCurveTo(sh[0] + dx * 0.12, sh[1] + dy * 0.12 + 0, sh[0] - nx * sw, sh[1] - ny * sw);
    ctx.quadraticCurveTo(
      (hip[0] + sh[0]) / 2 - nx * (sw + 0.5),
      (hip[1] + sh[1]) / 2 - ny * (sw + 0.5),
      hip[0] - nx * hw,
      hip[1] - ny * hw,
    );
    ctx.closePath();
    ctx.fillStyle = st.cloth;
    ctx.strokeStyle = st.outline;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.fill();
    // collar fold
    if (!st.flat) {
      ctx.strokeStyle = st.clothHi;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sh[0] + nx * 4, sh[1] + ny * 4);
      ctx.lineTo(lerp(hip[0], sh[0], 0.45) + nx * 0.5, lerp(hip[1], sh[1], 0.45) + ny * 0.5);
      ctx.stroke();
    }
    // sash
    const sx = lerp(hip[0], sh[0], 0.12);
    const sy = lerp(hip[1], sh[1], 0.12);
    ctx.strokeStyle = st.accent;
    ctx.lineWidth = 3.6;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(sx + nx * 6.2, sy + ny * 6.2);
    ctx.lineTo(sx - nx * 6.2, sy - ny * 6.2);
    ctx.stroke();
    ctx.lineCap = 'round';
    if (!st.flat) {
      // sash tail
      const tail = Math.sin(this.time * 10) * 1.5;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(sx - nx * 5, sy - ny * 5);
      ctx.quadraticCurveTo(sx - nx * 9 - 3, sy - ny * 9 + 3 + tail, sx - nx * 11 - 6, sy - ny * 11 + 6 + tail);
      ctx.stroke();
    }
  }

  drawHead(ctx, st) {
    const [hx, hy] = this.joints.head;
    const tilt = this.pose.lean * 0.4 + this.pose.headTilt;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(tilt);
    ctx.fillStyle = st.cloth;
    ctx.strokeStyle = st.outline;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, HEAD_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    // hood tuft at the back
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.quadraticCurveTo(-12, -6, -11, -1);
    ctx.quadraticCurveTo(-9, 1, -7, 1);
    ctx.closePath();
    ctx.fill();
    if (st.flat) {
      ctx.restore();
      return;
    }
    // face slit
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, HEAD_R - 0.2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = st.skin;
    ctx.beginPath();
    ctx.moveTo(0.5, -3.2);
    ctx.lineTo(9, -3.6);
    ctx.lineTo(9, 1.6);
    ctx.lineTo(1, 1.2);
    ctx.closePath();
    ctx.fill();
    // headband
    ctx.fillStyle = st.accent;
    ctx.fillRect(-9, -6.6, 18, 3);
    ctx.restore();
    // eye
    if (st.glowEyes) {
      ctx.fillStyle = st.eye;
      ctx.shadowColor = st.eye;
      ctx.shadowBlur = 6;
    } else ctx.fillStyle = st.eye;
    ctx.beginPath();
    ctx.moveTo(3.2, -1.6);
    ctx.quadraticCurveTo(5.6, -2.6, 7.6, -1.4);
    ctx.quadraticCurveTo(5.6, -0.2, 3.2, -1.6);
    ctx.fill();
    ctx.shadowBlur = 0;
    // brow
    ctx.strokeStyle = st.outline;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2.8, -2.6);
    ctx.lineTo(8, -3.2);
    ctx.stroke();
    ctx.restore();
  }

  drawSheath(ctx, st) {
    const { hip, sh } = this.joints;
    const a = [hip[0] - 9, hip[1] + 3];
    const b = [sh[0] - 7, sh[1] - 8];
    this.drawSeg(ctx, a, b, 3.2, st.hilt, st.outline);
    // hilt poking over the shoulder
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    const c = [b[0] + (dx / L) * 7, b[1] + (dy / L) * 7];
    this.drawSeg(ctx, b, c, 2.6, st.wrap, st.outline);
  }

  drawBlade(ctx, st, [, el, hand, angle]) {
    const a = angle + this.pose.swordA;
    const [ux, uy] = fwd(a, 1);
    const hiltEnd = [hand[0] + ux * 6, hand[1] + uy * 6];
    const tip = [hand[0] + ux * 38, hand[1] + uy * 38];
    this.drawSeg(ctx, [hand[0] - ux * 3, hand[1] - uy * 3], hiltEnd, 2.8, st.hilt, st.outline);
    ctx.strokeStyle = st.outline;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(hiltEnd[0], hiltEnd[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
    ctx.strokeStyle = st.metal;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // tsuba
    ctx.fillStyle = st.outline;
    ctx.beginPath();
    ctx.arc(hiltEnd[0], hiltEnd[1], 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawParachute(ctx, st, open) {
    const j = this.joints;
    const hand = j.armF[2];
    const hand2 = j.armB[2];
    const foot = j.legB[2];
    const foot2 = j.legF[2];
    const t = this.time;
    const flutter = Math.sin(t * 14) * 1.6 + Math.sin(t * 23) * 0.8;
    const layer = (a, b, lift, cols, alpha) => {
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const L = Math.hypot(dx, dy) || 1;
      // normal pointing "up" relative to the ninja's back
      let nx = dy / L;
      let ny = -dx / L;
      if (ny > 0) {
        nx = -nx;
        ny = -ny;
      }
      const h = (lift + flutter) * open;
      const grad = ctx.createLinearGradient(mx + nx * h, my + ny * h, mx, my);
      grad.addColorStop(0, cols[0]);
      grad.addColorStop(1, cols[1]);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.bezierCurveTo(
        a[0] + nx * h * 1.1 - dx * 0.15,
        a[1] + ny * h * 1.1 - dy * 0.15,
        b[0] + nx * h * 1.1 + dx * 0.15,
        b[1] + ny * h * 1.1 + dy * 0.15,
        b[0],
        b[1],
      );
      ctx.quadraticCurveTo(mx + nx * h * 0.35, my + ny * h * 0.35, a[0], a[1]);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = st.outline;
      ctx.lineWidth = 2;
      ctx.stroke();
      // seams
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1.2;
      for (const k of [0.33, 0.66]) {
        const sx = lerp(a[0], b[0], k);
        const sy = lerp(a[1], b[1], k);
        ctx.beginPath();
        ctx.moveTo(sx + nx * h * 0.3, sy + ny * h * 0.3);
        ctx.quadraticCurveTo(sx + nx * h * 0.7, sy + ny * h * 0.7, sx + nx * h * 0.8 + dx * (k - 0.5) * 0.3, sy + ny * h * 0.8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    layer(hand2, foot2, 30, [shade(st.cloth2[0], -0.35), shade(st.cloth2[1], -0.35)], 1);
    layer(hand, foot, 36, st.cloth2, 1);
  }

  drawScarf(ctx, st) {
    if (!this.scarf) return;
    const ribbon = (pts, w0, col) => {
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? st.outline : col;
        for (let i = 1; i < pts.length; i++) {
          const k = 1 - i / pts.length;
          ctx.lineWidth = (w0 * (0.45 + 0.55 * k)) + (pass === 0 ? 2 : 0);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
          ctx.lineTo(pts[i].x, pts[i].y);
          ctx.stroke();
        }
      }
    };
    ribbon(this.scarf2, 3.2, st.accentDark);
    ribbon(this.scarf, 3.8, st.accent);
  }
}

export function silhouetteStyle(color) {
  return {
    outline: color,
    cloth: color,
    clothHi: color,
    clothDark: color,
    accent: color,
    accentDark: color,
    wrap: color,
    skin: color,
    eye: color,
    metal: color,
    hilt: color,
    cloth2: [color, color],
    flat: true,
  };
}

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = (c) => clamp(Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt), 0, 255);
  r = f(r);
  g = f(g);
  b = f(b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
