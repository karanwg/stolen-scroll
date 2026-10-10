import { VIEW_W, VIEW_H, TUNING as T } from '../config.js';
import { clamp, easeOutCubic } from '../core/math.js';
import { drawAbilityIcon, ABILITY_INFO } from './icons.js';
import { ABILITIES } from '../entities/player.js';

export const FONT_TITLE = '"Cinzel", "Times New Roman", serif';
export const FONT_BODY = '"Cormorant Garamond", Georgia, serif';

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x, y - s * 0.1, x - s * 0.55, y - s * 0.15, x - s * 0.55, y + s * 0.2);
  ctx.bezierCurveTo(x - s * 0.55, y + s * 0.5, x - s * 0.15, y + s * 0.7, x, y + s * 0.9);
  ctx.bezierCurveTo(x + s * 0.15, y + s * 0.7, x + s * 0.55, y + s * 0.5, x + s * 0.55, y + s * 0.2);
  ctx.bezierCurveTo(x + s * 0.55, y - s * 0.15, x, y - s * 0.1, x, y + s * 0.35);
  ctx.closePath();
}

export class Hud {
  constructor() {
    this.heartAnim = []; // per-heart pop/shatter timers
    this.lastHearts = null;
    this.bossShown = 0;
    this.bossChip = 1;
    this.area = null; // {title, sub, t}
    this.toast = null;
  }

  showArea(title, sub) {
    this.area = { title, sub, t: 0 };
  }

  showToast(text, dur = 2.4) {
    this.toast = { text, t: 0, dur };
  }

  update(dt, game) {
    const p = game.player;
    if (this.lastHearts === null) this.lastHearts = p.hearts;
    if (p.hearts < this.lastHearts) {
      for (let i = p.hearts; i < this.lastHearts; i++) this.heartAnim[i] = { kind: 'break', t: 0 };
    } else if (p.hearts > this.lastHearts) {
      for (let i = this.lastHearts; i < p.hearts; i++) this.heartAnim[i] = { kind: 'fill', t: 0, delay: (i - this.lastHearts) * 0.08 };
    }
    this.lastHearts = p.hearts;
    for (const a of this.heartAnim) if (a) a.t += dt;
    if (this.area) {
      this.area.t += dt;
      if (this.area.t > 4.2) this.area = null;
    }
    if (this.toast) {
      this.toast.t += dt;
      if (this.toast.t > this.toast.dur) this.toast = null;
    }
    const boss = game.boss && game.bossActive ? game.boss : null;
    this.bossShown = clamp(this.bossShown + (boss ? dt * 2 : -dt * 2), 0, 1);
    if (boss) {
      const k = boss.hp / boss.maxHp;
      if (this.bossChip < k) this.bossChip = k;
      this.bossChip = Math.max(k, this.bossChip - dt * 0.25);
    }
  }

  draw(ctx, game) {
    const p = game.player;
    const t = game.time;
    // ── Hearts ─────────────────────────────────────────
    const x0 = 34;
    const y0 = 26;
    const low = p.hearts === 1;
    for (let i = 0; i < p.maxHearts; i++) {
      const x = x0 + i * 34;
      const a = this.heartAnim[i];
      const full = i < p.hearts;
      let s = 24;
      if (full && low) s *= 1 + Math.max(0, Math.sin(t * 6)) * 0.12;
      if (a && a.kind === 'fill' && a.t - (a.delay || 0) < 0.35) s *= 1 + (1 - clamp((a.t - (a.delay || 0)) / 0.35, 0, 1)) * 0.5;
      // socket
      ctx.fillStyle = 'rgba(10,6,12,0.65)';
      heartPath(ctx, x, y0 - 2, 28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,200,190,0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      if (full) {
        const g = ctx.createLinearGradient(x, y0 - 4, x, y0 + s * 0.9);
        g.addColorStop(0, '#ff6b78');
        g.addColorStop(0.55, '#d3243f');
        g.addColorStop(1, '#7e0f26');
        ctx.fillStyle = g;
        heartPath(ctx, x, y0 + (24 - s) * 0.4, s);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.ellipse(x - s * 0.24, y0 + s * 0.2, s * 0.1, s * 0.06, -0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (a && a.kind === 'break' && a.t < 0.6) {
        // shatter: two halves falling apart
        const k = easeOutCubic(a.t / 0.6);
        ctx.globalAlpha = 1 - k;
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(x + side * k * 10, y0 + k * 18);
          ctx.rotate(side * k * 0.8);
          ctx.beginPath();
          ctx.rect(side < 0 ? -20 : 0, -10, 20, 40);
          ctx.clip();
          ctx.fillStyle = '#d3243f';
          heartPath(ctx, 0, 0, 24);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
    }

    // ── Abilities ──────────────────────────────────────
    let ax = x0 - 6;
    for (const ab of ABILITIES) {
      if (!p.abilities[ab]) continue;
      ctx.fillStyle = 'rgba(10,6,12,0.55)';
      ctx.beginPath();
      ctx.arc(ax + 6, y0 + 42, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,210,190,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawAbilityIcon(ctx, ab, ax + 6, y0 + 42, 15, ABILITY_INFO[ab].color);
      if (ab === 'dash' && p.abilities.shadowStep) {
        // the shadow dash: a violet ring when it's ready, a sweep while it recharges
        const k = clamp(1 - p.shadowCool / T.shadowDashCooldown, 0, 1);
        ctx.lineWidth = 2;
        if (k >= 1) {
          ctx.strokeStyle = `rgba(170,130,255,${0.55 + 0.25 * Math.sin(game.time * 4)})`;
          ctx.beginPath();
          ctx.arc(ax + 6, y0 + 42, 13.5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(170,130,255,0.45)';
          ctx.beginPath();
          ctx.arc(ax + 6, y0 + 42, 13.5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2);
          ctx.stroke();
        }
      }
      ax += 30;
    }

    // ── Boss bar ───────────────────────────────────────
    if (this.bossShown > 0 && game.boss) {
      const b = game.boss;
      const a = this.bossShown;
      const w = 520;
      const bx = VIEW_W / 2 - w / 2;
      const by = VIEW_H - 40;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#e9dcc8';
      ctx.font = `600 15px ${FONT_TITLE}`;
      ctx.textAlign = 'center';
      ctx.letterSpacing = '4px';
      ctx.fillText(b.name, VIEW_W / 2, by - 10);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = 'rgba(8,4,6,0.8)';
      ctx.fillRect(bx - 2, by - 2, w + 4, 10);
      ctx.fillStyle = 'rgba(255,240,220,0.65)';
      ctx.fillRect(bx, by, w * this.bossChip, 6);
      const g = ctx.createLinearGradient(bx, 0, bx + w, 0);
      g.addColorStop(0, '#7e1222');
      g.addColorStop(1, '#ff7a3a');
      ctx.fillStyle = g;
      ctx.fillRect(bx, by, w * (b.hp / b.maxHp), 6);
      ctx.strokeStyle = 'rgba(230,200,170,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - 2.5, by - 2.5, w + 5, 11);
      ctx.globalAlpha = 1;
    }

    // ── Area title ─────────────────────────────────────
    if (this.area) {
      const k = this.area.t;
      const a = clamp(Math.min(k / 0.8, (4.2 - k) / 1.0), 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#efe4d2';
      ctx.font = `600 34px ${FONT_TITLE}`;
      ctx.letterSpacing = '6px';
      ctx.fillText(this.area.title.toUpperCase(), VIEW_W / 2, 118);
      ctx.letterSpacing = '0px';
      const lw = 140 + 80 * easeOutCubic(clamp(k / 1.2, 0, 1));
      ctx.strokeStyle = 'rgba(239,228,210,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(VIEW_W / 2 - lw, 132);
      ctx.lineTo(VIEW_W / 2 + lw, 132);
      ctx.stroke();
      if (this.area.sub) {
        ctx.font = `italic 19px ${FONT_BODY}`;
        ctx.fillStyle = 'rgba(239,228,210,0.8)';
        ctx.fillText(this.area.sub, VIEW_W / 2, 156);
      }
      ctx.globalAlpha = 1;
    }

    // ── Toast ──────────────────────────────────────────
    if (this.toast) {
      const k = this.toast.t;
      const a = clamp(Math.min(k / 0.25, (this.toast.dur - k) / 0.5), 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `italic 20px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      const w = ctx.measureText(this.toast.text).width + 40;
      ctx.fillStyle = 'rgba(8,5,10,0.7)';
      ctx.fillRect(VIEW_W / 2 - w / 2, VIEW_H - 112, w, 34);
      ctx.fillStyle = '#f2e6d4';
      ctx.fillText(this.toast.text, VIEW_W / 2, VIEW_H - 89);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }
}

// Little floating key prompt above something you can interact with (world space).
export function drawPrompt(ctx, x, y, label, t) {
  const bob = Math.sin(t * 3) * 2;
  ctx.font = `600 13px ${FONT_TITLE}`;
  ctx.textAlign = 'center';
  const text = `↑  ${label}`;
  const w = ctx.measureText(text).width + 18;
  ctx.fillStyle = 'rgba(8,5,10,0.72)';
  roundRect(ctx, x - w / 2, y - 18 + bob, w, 22, 11);
  ctx.fill();
  ctx.strokeStyle = 'rgba(240,220,190,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#f2e6d4';
  ctx.fillText(text, x, y - 2.5 + bob);
  ctx.textAlign = 'left';
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
