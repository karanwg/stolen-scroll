import { VIEW_W, VIEW_H } from '../config.js';
import { clamp, easeOutCubic } from '../core/math.js';
import { FONT_TITLE, FONT_BODY } from './hud.js';
import { drawAbilityIcon, ABILITY_INFO } from './icons.js';
import { glow } from '../render/shapes.js';

export const CONTROLS = [
  ['Move', '← →   or   A D'],
  ['Jump', 'Z  or  Space   (hold for height)'],
  ['Slash', 'X  or  J   (hold ↑ / ↓ to aim)'],
  ['Dash', 'C  ·  K  ·  Shift'],
  ['Interact', '↑  or  W'],
  ['Drop through', '↓ + Jump on a beam'],
  ['Float', 'hold Jump in midair (once learned)'],
  ['Pause · Mute', 'Esc  ·  M'],
];

export class Menu {
  constructor(items) {
    this.items = items; // [{label, action, enabled?}]
    this.i = 0;
    while (this.items[this.i] && this.items[this.i].enabled === false) this.i++;
  }
  update(input, audio) {
    const move = (d) => {
      let j = this.i;
      do j = (j + d + this.items.length) % this.items.length;
      while (this.items[j].enabled === false);
      if (j !== this.i) audio.play('ui');
      this.i = j;
    };
    if (input.pressed('up')) move(-1);
    if (input.pressed('down')) move(1);
    if (input.pressed('confirm') || input.pressed('jump')) {
      audio.play('uiSelect');
      this.items[this.i].action();
    }
  }
  draw(ctx, cx, y, t) {
    ctx.textAlign = 'center';
    this.items.forEach((it, k) => {
      const sel = k === this.i;
      ctx.font = `${sel ? 600 : 400} 20px ${FONT_TITLE}`;
      ctx.letterSpacing = '3px';
      ctx.fillStyle = it.enabled === false ? 'rgba(240,225,205,0.25)' : sel ? '#fff1dc' : 'rgba(240,225,205,0.6)';
      ctx.fillText(it.label.toUpperCase(), cx, y + k * 40);
      ctx.letterSpacing = '0px';
      if (sel) {
        const w = ctx.measureText(it.label.toUpperCase()).width / 2 + 28 + Math.sin(t * 4) * 3;
        ctx.fillStyle = '#e0354b';
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.translate(cx + s * w, y + k * 40 - 7);
          ctx.rotate(Math.PI / 4);
          ctx.fillRect(-3.5, -3.5, 7, 7);
          ctx.restore();
        }
      }
    });
    ctx.textAlign = 'left';
  }
}

export function drawTitle(ctx, t, menu, showControls, subtitle = 'Chapter I — Kagari Village', accent = 'rgb(255,90,40)') {
  const a = clamp(t / 2, 0, 1);
  ctx.fillStyle = `rgba(6,3,8,${0.55 - a * 0.15})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 100, VIEW_W / 2, VIEW_H / 2, 620);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  glow(ctx, VIEW_W / 2, 150, 260, accent, 0.25);
  ctx.font = `30px "Shippori Mincho", serif`;
  ctx.fillStyle = 'rgba(224,53,75,0.85)';
  ctx.fillText('盗まれた巻物', VIEW_W / 2, 98);
  ctx.font = `700 64px ${FONT_TITLE}`;
  ctx.letterSpacing = '10px';
  ctx.fillStyle = '#f4e8d6';
  ctx.shadowColor = 'rgba(255,120,60,0.6)';
  ctx.shadowBlur = 24;
  ctx.fillText('THE STOLEN', VIEW_W / 2, 168);
  ctx.fillText('SCROLL', VIEW_W / 2, 236);
  ctx.shadowBlur = 0;
  ctx.letterSpacing = '0px';
  ctx.strokeStyle = 'rgba(244,232,214,0.45)';
  ctx.beginPath();
  ctx.moveTo(VIEW_W / 2 - 180, 262);
  ctx.lineTo(VIEW_W / 2 + 180, 262);
  ctx.stroke();
  ctx.font = `italic 20px ${FONT_BODY}`;
  ctx.fillStyle = 'rgba(244,232,214,0.75)';
  ctx.fillText(subtitle, VIEW_W / 2, 290);

  if (showControls) drawControls(ctx, 330);
  else menu.draw(ctx, VIEW_W / 2, menu.items.length > 3 ? 336 : 350, t);

  ctx.textAlign = 'center';
  ctx.font = `14px ${FONT_BODY}`;
  ctx.fillStyle = 'rgba(244,232,214,0.4)';
  ctx.fillText('↑ ↓ choose  ·  Enter / Z select  ·  ` tuning panel', VIEW_W / 2, VIEW_H - 22);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

export function drawControls(ctx, y) {
  ctx.textAlign = 'center';
  CONTROLS.forEach(([k, v], i) => {
    ctx.font = `600 14px ${FONT_TITLE}`;
    ctx.fillStyle = '#e8b86a';
    ctx.textAlign = 'right';
    ctx.fillText(k.toUpperCase(), VIEW_W / 2 - 16, y + i * 26);
    ctx.font = `19px ${FONT_BODY}`;
    ctx.fillStyle = '#f2e8d8';
    ctx.textAlign = 'left';
    ctx.fillText(v, VIEW_W / 2 + 4, y + i * 26);
  });
  ctx.textAlign = 'center';
  ctx.font = `italic 15px ${FONT_BODY}`;
  ctx.fillStyle = 'rgba(244,232,214,0.5)';
  ctx.fillText('press any key to go back', VIEW_W / 2, y + CONTROLS.length * 26 + 14);
  ctx.textAlign = 'left';
}

// Opening crawl: lines fade in one by one over black.
export function drawOpening(ctx, lines, t, chapterTitle = null) {
  ctx.fillStyle = '#050307';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (chapterTitle) {
    ctx.globalAlpha = clamp(t / 1.5, 0, 1) * 0.85;
    ctx.font = `600 18px ${FONT_TITLE}`;
    ctx.letterSpacing = '6px';
    ctx.fillStyle = '#9fc8ff';
    ctx.fillText(chapterTitle.toUpperCase(), VIEW_W / 2, 110);
    ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;
  }
  ctx.font = `italic 25px ${FONT_BODY}`;
  const per = 3.2;
  lines.forEach((l, i) => {
    const k = t - i * per;
    if (k <= 0) return;
    ctx.globalAlpha = clamp(k / 1.2, 0, 1);
    ctx.fillStyle = i === lines.length - 1 ? '#ffb38a' : '#efe3d0';
    ctx.fillText(l, VIEW_W / 2, 180 + i * 50 - easeOutCubic(clamp(k / 1.2, 0, 1)) * 6);
  });
  ctx.globalAlpha = 0.5;
  ctx.font = `14px ${FONT_BODY}`;
  ctx.fillStyle = '#efe3d0';
  ctx.fillText('press any key to skip', VIEW_W / 2, VIEW_H - 24);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function drawPause(ctx, menu, t, showControls) {
  ctx.fillStyle = 'rgba(5,3,8,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = `600 36px ${FONT_TITLE}`;
  ctx.letterSpacing = '8px';
  ctx.fillStyle = '#f4e8d6';
  ctx.fillText('PAUSED', VIEW_W / 2, 140);
  ctx.letterSpacing = '0px';
  if (showControls) drawControls(ctx, 200);
  else menu.draw(ctx, VIEW_W / 2, 220, t);
  ctx.textAlign = 'left';
}

// Big centred unlock card.
export function drawAbilityCard(ctx, ability, t) {
  const info = ABILITY_INFO[ability];
  const a = clamp(t / 0.4, 0, 1);
  ctx.fillStyle = `rgba(4,2,6,${0.78 * a})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = a;
  const cy = 200;
  glow(ctx, VIEW_W / 2, cy, 170 + Math.sin(t * 2) * 10, info.color, 0.55);
  ctx.strokeStyle = info.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(VIEW_W / 2, cy, 54 + easeOutCubic(clamp(t, 0, 1)) * 6, 0, Math.PI * 2);
  ctx.stroke();
  drawAbilityIcon(ctx, ability, VIEW_W / 2, cy, 64, '#ffffff');
  ctx.textAlign = 'center';
  ctx.font = `600 14px ${FONT_TITLE}`;
  ctx.letterSpacing = '4px';
  ctx.fillStyle = 'rgba(244,232,214,0.7)';
  ctx.fillText('TECHNIQUE LEARNED', VIEW_W / 2, 300);
  ctx.font = `600 38px ${FONT_TITLE}`;
  ctx.fillStyle = '#f4e8d6';
  ctx.fillText(info.name.toUpperCase(), VIEW_W / 2, 346);
  ctx.letterSpacing = '0px';
  ctx.font = `italic 22px ${FONT_BODY}`;
  ctx.fillStyle = info.color;
  ctx.fillText(info.verb, VIEW_W / 2, 378);
  ctx.font = `21px ${FONT_BODY}`;
  ctx.fillStyle = '#f2e8d8';
  ctx.fillText(info.how, VIEW_W / 2, 418);
  if (t > 1) {
    ctx.globalAlpha = a * (0.5 + Math.sin(t * 4) * 0.2);
    ctx.font = `14px ${FONT_BODY}`;
    ctx.fillText('press Jump to continue', VIEW_W / 2, VIEW_H - 40);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// Silksong-style boss name card, lower-left.
export function drawBossCard(ctx, name, title, t) {
  const a = clamp(Math.min(t / 0.6, (3.6 - t) / 0.8), 0, 1);
  if (a <= 0) return;
  ctx.globalAlpha = a;
  const g = ctx.createLinearGradient(0, 0, 520, 0);
  g.addColorStop(0, 'rgba(5,2,4,0.75)');
  g.addColorStop(1, 'rgba(5,2,4,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, VIEW_H - 200, 620, 120);
  ctx.font = `italic 22px ${FONT_BODY}`;
  ctx.fillStyle = 'rgba(244,232,214,0.85)';
  ctx.fillText(title, 64, VIEW_H - 160);
  ctx.font = `700 64px ${FONT_TITLE}`;
  ctx.letterSpacing = '12px';
  ctx.fillStyle = '#ffe9d0';
  ctx.shadowColor = 'rgba(255,110,40,0.8)';
  ctx.shadowBlur = 20;
  ctx.fillText(name, 60 - (1 - easeOutCubic(clamp(t / 0.8, 0, 1))) * 30, VIEW_H - 100);
  ctx.shadowBlur = 0;
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 1;
}

export function drawDeath(ctx, t) {
  // t from 0 → ~1.8
  const a = clamp((t - 0.4) / 0.8, 0, 1);
  ctx.fillStyle = `rgba(8,2,4,${a})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.globalAlpha = clamp((t - 0.6) / 0.6, 0, 1) * clamp((2.3 - t) / 0.4, 0, 1);
  ctx.font = `italic 26px ${FONT_BODY}`;
  ctx.fillStyle = '#d9a59a';
  ctx.fillText('The lantern remembers you.', VIEW_W / 2, VIEW_H / 2);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function drawChapterEnd(ctx, info, t, hasNext = false) {
  ctx.fillStyle = `rgba(4,2,6,${clamp(t / 1.5, 0, 1)})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  const a = clamp((t - 1) / 1.2, 0, 1);
  ctx.globalAlpha = a;
  ctx.font = `600 42px ${FONT_TITLE}`;
  ctx.letterSpacing = '8px';
  ctx.fillStyle = '#f4e8d6';
  ctx.fillText(info.title.toUpperCase(), VIEW_W / 2, 210);
  ctx.letterSpacing = '0px';
  ctx.font = `italic 24px ${FONT_BODY}`;
  ctx.fillStyle = 'rgba(244,232,214,0.8)';
  ctx.fillText(info.sub, VIEW_W / 2, 250);
  ctx.globalAlpha = clamp((t - 2.6) / 1.2, 0, 1);
  ctx.font = `20px ${FONT_BODY}`;
  ctx.fillStyle = '#9fd8ff';
  ctx.fillText(info.next, VIEW_W / 2, 320);
  ctx.globalAlpha = clamp((t - 4) / 1, 0, 1) * (0.5 + Math.sin(t * 3) * 0.2);
  ctx.font = `15px ${FONT_BODY}`;
  ctx.fillStyle = '#f2e8d8';
  ctx.fillText(hasNext ? 'press Enter to continue the journey' : 'press Enter to return to the title', VIEW_W / 2, VIEW_H - 40);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}
