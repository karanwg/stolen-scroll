import { VIEW_W, VIEW_H } from '../config.js';
import { glowSprite, makeCanvas } from './shapes.js';

// A low-resolution light map multiplied over the whole frame: deep ambient
// darkness plus additive coloured lights from fires, lanterns and the player.

const SCALE = 0.5;

export class Lighting {
  constructor() {
    this.canvas = makeCanvas(VIEW_W * SCALE, VIEW_H * SCALE);
    this.g = this.canvas.getContext('2d');
    this.ambient = 'rgb(78,58,88)';
  }

  // lights: [{x, y, r, color, i}] in world space
  render(lights, camLeft, camTop) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = this.ambient;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(SCALE, 0, 0, SCALE, -camLeft * SCALE, -camTop * SCALE);
    g.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      g.globalAlpha = Math.max(0, Math.min(1, l.i ?? 1));
      g.drawImage(glowSprite(l.color), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  apply(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.canvas, 0, 0, VIEW_W, VIEW_H);
    ctx.restore();
  }
}
