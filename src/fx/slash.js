import { TUNING as T } from '../config.js';
import { swingAngle } from '../render/ninjaRig.js';

// The katana's smear. It traces the blade tip's actual path around the
// shoulder: a bright, thick leading edge that tapers into a fading tail, with
// the tail catching up after the cut lands. Follows the player for its life.

const REACH = 60; // shoulder → blade tip, in px
const TAIL_LAG = 0.07; // seconds the tail trails the head
const N = 28;

export class SlashFx {
  constructor(player) {
    this.p = player;
    this.arc = player.attackArc;
    this.kind = player.attackKind;
    this.facing = player.facing;
    this.dur = T.attackDuration;
    this.t = 0;
    this.dead = false;
  }

  update(dt) {
    this.t += dt;
    if (this.t > this.dur + TAIL_LAG + 0.02) this.dead = true;
  }

  // Swing progress → world point on the arc, at radius r.
  point(s, r) {
    const p = this.p;
    const rig = p.rig;
    const root = rig.joints ? rig.joints.armF[0] : [0, -40];
    const px = p.cx + root[0] * this.facing * rig.sx;
    const py = p.feetY + root[1] * rig.sy;
    const a = swingAngle(this.arc, s);
    return [px + Math.sin(a) * r * this.facing, py + Math.cos(a) * r];
  }

  draw(ctx) {
    const head = Math.min(1, this.t / this.dur);
    const tail = Math.max(0, Math.min(1, (this.t - TAIL_LAG) / this.dur));
    // Nothing to draw during the coil, or once the tail has caught up.
    const start = Math.max(tail, 0.16);
    if (head - start < 0.02) return;
    const fade = this.t > this.dur ? 1 - (this.t - this.dur) / (TAIL_LAG + 0.02) : 1;
    const maxW = this.kind === 'down' || this.kind === 'up' ? 26 : 22;

    const outer = [];
    const inner = [];
    const us = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const s = start + (head - start) * u;
      // Thick at the leading edge, needle-thin at the tail.
      const w = maxW * Math.pow(u, 0.7) * (0.55 + 0.45 * fade);
      outer.push(this.point(s, REACH));
      inner.push(this.point(s, REACH - w));
      us.push(u);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Soft outer glow
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = `rgba(255,170,150,${0.22 * fade})`;
    ctx.lineWidth = 10;
    ctx.beginPath();
    outer.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    // Body: quads with alpha rising toward the head
    for (let i = 0; i < N; i++) {
      const a = Math.pow(us[i + 1], 1.4) * fade;
      ctx.fillStyle = `rgba(255,236,226,${0.85 * a})`;
      ctx.beginPath();
      ctx.moveTo(outer[i][0], outer[i][1]);
      ctx.lineTo(outer[i + 1][0], outer[i + 1][1]);
      ctx.lineTo(inner[i + 1][0], inner[i + 1][1]);
      ctx.lineTo(inner[i][0], inner[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    // Razor edge along the outside of the leading half
    ctx.strokeStyle = `rgba(255,255,255,${fade})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = Math.floor(N * 0.4); i <= N; i++) {
      const [x, y] = outer[i];
      if (i === Math.floor(N * 0.4)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Inner speed line
    ctx.strokeStyle = `rgba(255,200,190,${0.45 * fade})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = Math.floor(N * 0.3); i <= N; i++) {
      const s = start + (head - start) * (i / N);
      const [x, y] = this.point(s, REACH - maxW - 6);
      if (i === Math.floor(N * 0.3)) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Glint at the blade tip while the cut is travelling
    if (head < 1) {
      const [x, y] = outer[N];
      const g = 9;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(x - g, y);
      ctx.lineTo(x, y - 1.6);
      ctx.lineTo(x + g, y);
      ctx.lineTo(x, y + 1.6);
      ctx.closePath();
      ctx.moveTo(x, y - g);
      ctx.lineTo(x + 1.6, y);
      ctx.lineTo(x, y + g);
      ctx.lineTo(x - 1.6, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
