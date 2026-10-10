import { VIEW_W, VIEW_H } from '../config.js';
import { FONT_BODY, FONT_TITLE } from './hud.js';

// Typewriter dialogue box. Any of jump / attack / confirm / up advances.
export class Dialogue {
  constructor(audio) {
    this.audio = audio;
    this.lines = [];
    this.i = 0;
    this.shown = 0;
    this.onDone = null;
    this.open = 0;
    this.blipT = 0;
  }

  get active() {
    return this.lines.length > 0;
  }

  show(lines, onDone) {
    this.lines = lines.map((l) => (typeof l === 'string' ? { who: '', text: l } : l));
    this.i = 0;
    this.shown = 0;
    this.onDone = onDone || null;
  }

  update(dt, input) {
    this.open = Math.min(1, Math.max(0, this.open + (this.active ? dt : -dt) * 6));
    if (!this.active) return;
    const line = this.lines[this.i];
    const before = Math.floor(this.shown);
    this.shown = Math.min(line.text.length, this.shown + dt * 55);
    if (Math.floor(this.shown) !== before && line.text[before] !== ' ') {
      this.blipT -= 1;
      if (this.blipT <= 0) {
        this.audio.play('blip');
        this.blipT = 3;
      }
    }
    if (input.pressed('jump') || input.pressed('attack') || input.pressed('confirm') || input.pressed('up')) {
      if (this.shown < line.text.length) this.shown = line.text.length;
      else {
        this.i++;
        this.shown = 0;
        if (this.i >= this.lines.length) {
          this.lines = [];
          const cb = this.onDone;
          this.onDone = null;
          cb?.();
        }
      }
    }
  }

  draw(ctx, t) {
    if (this.open <= 0 || !this.lines.length) return;
    const line = this.lines[this.i];
    const w = 720;
    const h = 128;
    const x = (VIEW_W - w) / 2;
    const y = VIEW_H - h - 30;
    ctx.globalAlpha = this.open;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(10,6,12,0.92)');
    g.addColorStop(1, 'rgba(18,8,14,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(220,190,150,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
    // corner ornaments
    ctx.fillStyle = '#c79a45';
    for (const [cx, cy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
    let ty = y + 36;
    if (line.who) {
      ctx.font = `600 15px ${FONT_TITLE}`;
      ctx.fillStyle = '#e8b86a';
      ctx.letterSpacing = '2px';
      ctx.fillText(line.who.toUpperCase(), x + 30, ty);
      ctx.letterSpacing = '0px';
      ty += 26;
    } else ty += 4;
    ctx.font = `21px ${FONT_BODY}`;
    ctx.fillStyle = '#f2e8d8';
    const words = line.text.split(' ');
    let rows = [];
    let row = '';
    for (const wd of words) {
      const test = row ? row + ' ' + wd : wd;
      if (ctx.measureText(test).width > w - 64 && row) {
        rows.push(row);
        row = wd;
      } else row = test;
    }
    rows.push(row);
    let left = Math.floor(this.shown);
    for (const r of rows) {
      if (left <= 0) break;
      ctx.fillText(r.slice(0, left), x + 30, ty);
      left -= r.length + 1;
      ty += 26;
    }
    if (this.shown >= line.text.length) {
      const bob = Math.sin(t * 5) * 2;
      ctx.fillStyle = '#e8b86a';
      ctx.beginPath();
      ctx.moveTo(x + w - 34, y + h - 26 + bob);
      ctx.lineTo(x + w - 24, y + h - 26 + bob);
      ctx.lineTo(x + w - 29, y + h - 19 + bob);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
