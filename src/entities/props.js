import { glow, drawFlame } from '../render/shapes.js';
import { drawAbilityIcon, ABILITY_INFO } from '../ui/icons.js';
import { rand } from '../core/math.js';
import { NinjaRig, STYLES, POSES } from '../render/ninjaRig.js';

// Interactive things in the world. Each has a box for overlap tests,
// an optional `prompt` shown when you can interact, draw() and light().

export class Lantern {
  // Spirit lantern: the save point. Kneel to restore hearts and set your respawn.
  constructor(cx, floorY, id) {
    Object.assign(this, { kind: 'lantern', id, x: cx - 30, y: floorY - 90, w: 60, h: 90, floorY, cx, lit: false, pulse: 0 });
    this.prompt = 'Meditate';
  }
  update(dt) {
    this.pulse = Math.max(0, this.pulse - dt);
  }
  draw(ctx, game) {
    const { cx, floorY } = this;
    const t = game.time;
    // meditation mat
    ctx.fillStyle = '#3a2a1e';
    ctx.beginPath();
    ctx.ellipse(cx - 26, floorY - 2, 18, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a1f2a';
    ctx.beginPath();
    ctx.ellipse(cx - 26, floorY - 4, 13, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // stone tōrō
    const st = '#48414c';
    const hi = '#5d5562';
    const dk = '#2a252c';
    ctx.fillStyle = dk;
    ctx.fillRect(cx - 18, floorY - 10, 36, 10);
    ctx.fillStyle = st;
    ctx.fillRect(cx - 15, floorY - 12, 30, 4);
    ctx.fillRect(cx - 6, floorY - 50, 12, 38);
    ctx.fillStyle = hi;
    ctx.fillRect(cx - 6, floorY - 50, 3, 38);
    ctx.fillStyle = st;
    ctx.fillRect(cx - 16, floorY - 56, 32, 7);
    // fire box
    ctx.fillStyle = dk;
    ctx.fillRect(cx - 13, floorY - 78, 26, 22);
    ctx.fillStyle = this.lit ? '#ffcf7a' : '#1a1418';
    ctx.fillRect(cx - 7, floorY - 74, 14, 14);
    ctx.fillStyle = dk;
    ctx.fillRect(cx - 1, floorY - 74, 2, 14);
    // roof
    ctx.fillStyle = st;
    ctx.beginPath();
    ctx.moveTo(cx - 26, floorY - 76);
    ctx.quadraticCurveTo(cx - 20, floorY - 80, cx - 8, floorY - 92);
    ctx.lineTo(cx + 8, floorY - 92);
    ctx.quadraticCurveTo(cx + 20, floorY - 80, cx + 26, floorY - 76);
    ctx.lineTo(cx + 24, floorY - 73);
    ctx.lineTo(cx - 24, floorY - 73);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hi;
    ctx.fillRect(cx - 3, floorY - 102, 6, 10);
    ctx.beginPath();
    ctx.arc(cx, floorY - 104, 4, 0, Math.PI * 2);
    ctx.fill();
    // flame
    const fy = floorY - 60;
    if (this.lit) {
      glow(ctx, cx, fy - 8, 60 + this.pulse * 120, 'rgb(150,210,255)', 0.55 + this.pulse);
      drawFlame(ctx, cx, fy, 10, 18, t, 4);
      // spirit wisps
      for (let i = 0; i < 3; i++) {
        const a = t * 1.3 + i * 2.1;
        glow(ctx, cx + Math.cos(a) * 26, fy - 22 + Math.sin(a * 1.4) * 10, 8, 'rgb(170,220,255)', 0.6);
      }
    } else {
      glow(ctx, cx, fy - 6, 18, 'rgb(150,200,255)', 0.25 + Math.sin(t * 2) * 0.1);
    }
  }
  light(out) {
    out.push({ x: this.cx, y: this.floorY - 66, r: this.lit ? 220 : 80, color: this.lit ? 'rgb(170,215,255)' : 'rgb(120,160,220)', i: this.lit ? 0.85 + this.pulse : 0.45 });
  }
}

export class Elder {
  constructor(cx, floorY) {
    Object.assign(this, { kind: 'npc', id: 'elder', x: cx - 24, y: floorY - 50, w: 48, h: 50, cx, floorY, talked: false });
    this.prompt = 'Talk';
  }
  update() {}
  draw(ctx, game) {
    const { cx, floorY } = this;
    const t = game.time;
    const breathe = Math.sin(t * 1.2) * 0.8;
    // rock he leans on
    ctx.fillStyle = '#2b2228';
    ctx.beginPath();
    ctx.ellipse(cx + 18, floorY - 12, 22, 14, 0, Math.PI, 0);
    ctx.fill();
    // legs (sitting)
    ctx.strokeStyle = '#08050a';
    ctx.lineCap = 'round';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(cx + 4, floorY - 10);
    ctx.lineTo(cx - 16, floorY - 6);
    ctx.stroke();
    ctx.strokeStyle = '#6b6352';
    ctx.lineWidth = 6.5;
    ctx.stroke();
    // robe body
    ctx.fillStyle = '#4c4436';
    ctx.strokeStyle = '#08050a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx + 12, floorY - 6);
    ctx.quadraticCurveTo(cx + 16, floorY - 34 + breathe, cx + 8, floorY - 40 + breathe);
    ctx.quadraticCurveTo(cx - 4, floorY - 38 + breathe, cx - 4, floorY - 8);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    // blood-dark sash
    ctx.fillStyle = '#5a1c1c';
    ctx.fillRect(cx - 3, floorY - 20, 16, 4);
    // head, bald with white beard
    ctx.fillStyle = '#c9a888';
    ctx.beginPath();
    ctx.arc(cx + 6, floorY - 46 + breathe, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e8e2d6';
    ctx.beginPath();
    ctx.moveTo(cx + 1, floorY - 44 + breathe);
    ctx.quadraticCurveTo(cx - 2, floorY - 30 + breathe, cx - 6, floorY - 28 + breathe);
    ctx.quadraticCurveTo(cx + 2, floorY - 34 + breathe, cx + 8, floorY - 42 + breathe);
    ctx.fill();
    ctx.fillStyle = '#1a1010';
    ctx.fillRect(cx + 1, floorY - 48 + breathe, 3, 1.5);
    // staff
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 12, floorY);
    ctx.lineTo(cx - 2, floorY - 62);
    ctx.stroke();
    ctx.fillStyle = '#c7a24a';
    ctx.beginPath();
    ctx.arc(cx - 2, floorY - 64, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  light(out) {
    out.push({ x: this.cx, y: this.floorY - 30, r: 70, color: 'rgb(255,160,100)', i: 0.35 });
  }
}

export class Note {
  constructor(cx, floorY, id, look = null) {
    Object.assign(this, { kind: 'note', id, look, x: cx - 22, y: floorY - 60, w: 44, h: 60, cx, floorY, read: false });
    this.prompt = 'Read';
  }
  update() {}
  draw(ctx, game) {
    const { cx, floorY } = this;
    if (this.look === 'terminal') return this.drawTerminal(ctx, game);
    if (this.id === 'tracks') {
      // a broken signpost with a scrap tied to it
      ctx.fillStyle = '#2a1a12';
      ctx.fillRect(cx - 3, floorY - 54, 6, 54);
      ctx.save();
      ctx.translate(cx, floorY - 46);
      ctx.rotate(-0.12);
      ctx.fillStyle = '#3a2618';
      ctx.fillRect(-22, -8, 44, 14);
      ctx.restore();
    } else {
      // altar stand with a folded letter
      ctx.fillStyle = '#2a1a12';
      ctx.fillRect(cx - 14, floorY - 26, 28, 4);
      ctx.fillRect(cx - 12, floorY - 22, 3, 22);
      ctx.fillRect(cx + 9, floorY - 22, 3, 22);
    }
    const sway = Math.sin(game.time * 2 + cx) * 1.5;
    ctx.fillStyle = '#d8ccaa';
    ctx.save();
    ctx.translate(cx + (this.id === 'tracks' ? 8 : 0), floorY - (this.id === 'tracks' ? 38 : 30));
    ctx.rotate(sway * 0.03);
    ctx.fillRect(-6, -2, 12, 16);
    ctx.fillStyle = '#5a3a2a';
    for (let i = 0; i < 3; i++) ctx.fillRect(-3, 2 + i * 4, 6, 1);
    ctx.restore();
    if (!this.read) glow(ctx, cx, floorY - 34, 26, 'rgb(255,220,160)', 0.25 + Math.sin(game.time * 3) * 0.1);
  }
  // A ship's terminal: a green screen still scrolling someone's last words.
  drawTerminal(ctx, game) {
    const { cx, floorY } = this;
    const t = game.time;
    ctx.fillStyle = '#2a3038';
    ctx.fillRect(cx - 4, floorY - 30, 8, 30);
    ctx.fillStyle = '#1a1e23';
    ctx.fillRect(cx - 20, floorY - 62, 40, 32);
    ctx.fillStyle = '#04100a';
    ctx.fillRect(cx - 16, floorY - 58, 32, 22);
    ctx.fillStyle = 'rgba(120,255,140,0.85)';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - 13, floorY - 55 + i * 5, 6 + ((i * 7 + Math.floor(t * 2)) % 18), 1.6);
    if (Math.sin(t * 5) > 0) ctx.fillRect(cx - 13 + 20, floorY - 40, 4, 2);
    if (!this.read) glow(ctx, cx, floorY - 47, 30, 'rgb(120,255,140)', 0.25 + Math.sin(t * 3) * 0.08);
  }
  light(out) {
    if (this.look === 'terminal') out.push({ x: this.cx, y: this.floorY - 47, r: 80, color: 'rgb(120,255,150)', i: 0.45 });
    else out.push({ x: this.cx, y: this.floorY - 30, r: 60, color: 'rgb(255,210,150)', i: 0.3 });
  }
}

export class Pickup {
  constructor(cx, floorY, ability) {
    Object.assign(this, { kind: 'pickup', ability, x: cx - 18, y: floorY - 78, w: 36, h: 70, cx, floorY, taken: false });
    this.info = ABILITY_INFO[ability];
  }
  update(dt, game) {
    if (Math.random() < 0.25) {
      const a = rand(0, Math.PI * 2);
      game.particles.add({ x: this.cx + Math.cos(a) * 20, y: this.floorY - 46 + Math.sin(a) * 20, vx: 0, vy: rand(-30, -10), size: rand(1, 2), color: this.info.color, additive: true, life: 0.8 });
    }
  }
  draw(ctx, game) {
    const t = game.time;
    const cy = this.floorY - 46 + Math.sin(t * 2) * 4;
    // altar
    ctx.fillStyle = '#2b2026';
    ctx.fillRect(this.cx - 16, this.floorY - 14, 32, 14);
    ctx.fillStyle = '#3c3036';
    ctx.fillRect(this.cx - 19, this.floorY - 17, 38, 5);
    glow(ctx, this.cx, cy, 70, this.info.color, 0.55 + Math.sin(t * 3) * 0.1);
    ctx.strokeStyle = this.info.color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.cx, cy, 18 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawAbilityIcon(ctx, this.ability, this.cx, cy, 24, '#ffffff');
  }
  light(out) {
    out.push({ x: this.cx, y: this.floorY - 46, r: 160, color: this.info.color, i: 0.7 });
  }
}

// The old ferryman of Ama: straw raincoat (mino), wide hat (kasa), pipe.
export class Ferryman {
  constructor(cx, floorY) {
    Object.assign(this, { kind: 'npc', id: 'ferryman', x: cx - 24, y: floorY - 56, w: 48, h: 56, cx, floorY, talked: false });
    this.prompt = 'Talk';
  }
  update() {}
  draw(ctx, game) {
    const { cx, floorY } = this;
    const t = game.time;
    const breathe = Math.sin(t * 1.4) * 0.8;
    // upturned boat he sits on
    ctx.fillStyle = '#1e1a18';
    ctx.beginPath();
    ctx.moveTo(cx - 30, floorY);
    ctx.quadraticCurveTo(cx - 6, floorY - 22, cx + 26, floorY - 16);
    ctx.lineTo(cx + 30, floorY);
    ctx.fill();
    // legs
    ctx.strokeStyle = '#0a0806';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 2, floorY - 18);
    ctx.lineTo(cx + 10, floorY - 2);
    ctx.stroke();
    // mino: layered straw cape
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#5a4a2e' : '#4a3c24';
      ctx.beginPath();
      const y = floorY - 46 + i * 8 + breathe;
      ctx.moveTo(cx - 8 - i * 3, y);
      ctx.lineTo(cx + 10 + i * 3, y);
      ctx.lineTo(cx + 13 + i * 3, y + 14);
      ctx.lineTo(cx - 11 - i * 3, y + 14);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(30,22,10,0.8)';
    ctx.lineWidth = 0.8;
    for (let k = -12; k < 16; k += 3) {
      ctx.beginPath();
      ctx.moveTo(cx + k, floorY - 44 + breathe);
      ctx.lineTo(cx + k * 1.2, floorY - 16 + breathe);
      ctx.stroke();
    }
    // face
    ctx.fillStyle = '#b48c6c';
    ctx.beginPath();
    ctx.arc(cx + 2, floorY - 50 + breathe, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e4dccf';
    ctx.beginPath();
    ctx.moveTo(cx - 2, floorY - 48 + breathe);
    ctx.quadraticCurveTo(cx + 2, floorY - 38 + breathe, cx + 7, floorY - 47 + breathe);
    ctx.fill();
    // kasa hat
    ctx.fillStyle = '#6b5a36';
    ctx.strokeStyle = '#1a140a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 20, floorY - 52 + breathe);
    ctx.lineTo(cx + 2, floorY - 66 + breathe);
    ctx.lineTo(cx + 24, floorY - 52 + breathe);
    ctx.quadraticCurveTo(cx + 2, floorY - 55 + breathe, cx - 20, floorY - 52 + breathe);
    ctx.fill();
    ctx.stroke();
    // pipe
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + 6, floorY - 46 + breathe);
    ctx.lineTo(cx + 16, floorY - 44 + breathe);
    ctx.stroke();
    const ember = 0.6 + Math.sin(t * 2.2) * 0.4;
    glow(ctx, cx + 17, floorY - 45 + breathe, 10 + ember * 6, 'rgb(255,150,70)', 0.6 * ember);
    // smoke
    ctx.fillStyle = 'rgba(200,200,210,0.12)';
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.4 + i * 0.25) % 1;
      ctx.beginPath();
      ctx.arc(cx + 18 + Math.sin(k * 6 + i) * 4, floorY - 48 - k * 40, 2 + k * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  light(out) {
    out.push({ x: this.cx + 16, y: this.floorY - 46, r: 90, color: 'rgb(255,170,100)', i: 0.5 });
  }
}

// A Binoshi left behind at the shrine, slumped against a post.
export class WoundedBinoshi {
  constructor(cx, floorY) {
    Object.assign(this, { kind: 'npc', id: 'binoshi', x: cx - 24, y: floorY - 40, w: 48, h: 40, cx, floorY, talked: false });
    this.prompt = 'Talk';
    this.rig = new NinjaRig(STYLES.binoshi);
    const pose = { ...POSES.kneel, lean: -0.35, headTilt: 0.5, drop: 12, armF: [0.4, 0.5], armB: [-0.2, 0.2], legF: [1.5, -0.4], legB: [1.3, -0.3] };
    this.rig.pose = JSON.parse(JSON.stringify(pose));
    this.rig.set(pose, 1000);
  }
  update(dt) {
    this.rig.update(dt, this.cx, this.floorY, -1);
  }
  draw(ctx, game) {
    // post he leans on
    ctx.fillStyle = '#3a1814';
    ctx.fillRect(this.cx + 10, this.floorY - 70, 8, 70);
    this.rig.draw(ctx, this.cx, this.floorY, -1);
    // violet blood pooling
    ctx.fillStyle = 'rgba(90,30,140,0.55)';
    ctx.beginPath();
    ctx.ellipse(this.cx - 6, this.floorY - 1, 18, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  light(out) {
    out.push({ x: this.cx, y: this.floorY - 20, r: 60, color: 'rgb(170,110,255)', i: 0.35 });
  }
}

// The silver relic the Kraken leaves behind. Examining it ends the chapter.
export class Relic {
  constructor(cx, floorY, look = 'plate') {
    Object.assign(this, { kind: 'relic', x: cx - 20, y: floorY - 50, w: 40, h: 50, cx, floorY, visible: false, look });
    this.prompt = look === 'page' ? 'Read' : 'Examine';
  }
  update(dt, game) {
    if (!this.visible) return;
    if (Math.random() < 0.3) game.particles.add({ x: this.cx + rand(-14, 14), y: this.floorY - 20, vx: 0, vy: rand(-40, -15), size: 1.5, color: 'rgb(170,230,255)', additive: true, life: 0.8 });
  }
  draw(ctx, game) {
    if (!this.visible) return;
    const t = game.time;
    const cx = this.cx;
    const y = this.floorY - 14 + Math.sin(t * 1.5) * 1;
    if (this.look === 'page') {
      // a single torn scroll page weighted under a stone, its ink glowing violet
      glow(ctx, cx, this.floorY - 10, 60, 'rgb(170,100,255)', 0.5 + Math.sin(t * 2) * 0.1);
      ctx.fillStyle = '#d9cfa8';
      ctx.beginPath();
      ctx.moveTo(cx - 16, this.floorY - 2);
      ctx.lineTo(cx + 14, this.floorY - 4);
      ctx.lineTo(cx + 12, this.floorY - 16);
      ctx.lineTo(cx - 14, this.floorY - 14);
      ctx.fill();
      ctx.fillStyle = 'rgba(150,80,255,0.9)';
      for (let i = 0; i < 4; i++) ctx.fillRect(cx - 9 + i * 6, this.floorY - 13, 2, 8);
      ctx.fillStyle = '#4a4650';
      ctx.beginPath();
      ctx.ellipse(cx + 4, this.floorY - 15, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    glow(ctx, cx, y - 6, 70, 'rgb(150,220,255)', 0.5 + Math.sin(t * 3) * 0.1);
    // curved plate of seamless silver, half buried
    const g = ctx.createLinearGradient(cx - 18, y - 20, cx + 18, y + 6);
    g.addColorStop(0, '#f2f6fa');
    g.addColorStop(0.5, '#9aa8b8');
    g.addColorStop(1, '#55606e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - 20, y + 8);
    ctx.quadraticCurveTo(cx - 14, y - 22, cx + 6, y - 24);
    ctx.quadraticCurveTo(cx + 20, y - 10, cx + 18, y + 8);
    ctx.closePath();
    ctx.fill();
    // glowing line pointing east
    ctx.strokeStyle = `rgba(150,240,255,${0.6 + Math.sin(t * 4) * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, y - 4);
    ctx.lineTo(cx + 12, y - 12);
    ctx.stroke();
    // violet ink name
    ctx.fillStyle = 'rgba(140,70,255,0.8)';
    ctx.fillRect(cx - 6, y - 16, 2, 8);
    ctx.fillRect(cx - 2, y - 18, 2, 10);
    ctx.fillRect(cx + 2, y - 15, 2, 7);
  }
  light(out) {
    if (this.visible) out.push({ x: this.cx, y: this.floorY - 20, r: 160, color: 'rgb(150,220,255)', i: 0.8 });
  }
}

// The old monk of the onsen, up to his shoulders in hot water with a towel on his head.
export class Monk {
  constructor(cx, floorY) {
    Object.assign(this, { kind: 'npc', id: 'monk', x: cx - 24, y: floorY - 50, w: 48, h: 50, cx, floorY, talked: false });
    this.prompt = 'Talk';
  }
  update() {}
  draw(ctx, game) {
    const { cx, floorY } = this;
    const t = game.time;
    const breathe = Math.sin(t * 1.1) * 0.8;
    // a wooden tub, steaming
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(cx - 22, floorY - 26, 44, 26);
    ctx.fillStyle = '#2a1e14';
    for (const y of [-22, -10]) ctx.fillRect(cx - 23, floorY + y, 46, 3);
    ctx.fillStyle = 'rgba(150,200,200,0.8)';
    ctx.fillRect(cx - 19, floorY - 26, 38, 4);
    // shoulders + shaved head
    ctx.fillStyle = '#c69a78';
    ctx.beginPath();
    ctx.ellipse(cx, floorY - 26 + breathe, 13, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 1, floorY - 38 + breathe, 8, 0, Math.PI * 2);
    ctx.fill();
    // towel folded on the head
    ctx.fillStyle = '#ece4d4';
    ctx.fillRect(cx - 6, floorY - 48 + breathe, 13, 4);
    // closed, contented eyes and long white brows
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx - 3, floorY - 38 + breathe);
    ctx.lineTo(cx, floorY - 37.5 + breathe);
    ctx.moveTo(cx + 3, floorY - 38 + breathe);
    ctx.lineTo(cx + 6, floorY - 37.5 + breathe);
    ctx.stroke();
    ctx.fillStyle = '#f0ece4';
    ctx.fillRect(cx - 5, floorY - 41 + breathe, 5, 1.6);
    ctx.fillRect(cx + 3, floorY - 41 + breathe, 5, 1.6);
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.3 + i * 0.33) % 1;
      ctx.fillStyle = `rgba(230,235,245,${0.25 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(cx - 12 + i * 12 + Math.sin(k * 6) * 3, floorY - 30 - k * 50, 4 + k * 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  light(out) {
    out.push({ x: this.cx, y: this.floorY - 30, r: 80, color: 'rgb(255,200,150)', i: 0.4 });
  }
}

// A Binoshi sealed into the wall. Still breathing.
export class CocoonNPC {
  constructor(cx, floorY) {
    Object.assign(this, { kind: 'npc', id: 'cocooned', x: cx - 24, y: floorY - 90, w: 48, h: 90, cx, floorY, talked: false });
    this.prompt = 'Listen';
  }
  update() {}
  draw(ctx, game) {
    const { cx, floorY } = this;
    const t = game.time;
    const heave = this.burst ? 0 : Math.sin(t * 2.4) * 1.2;
    ctx.fillStyle = '#121a18';
    ctx.beginPath();
    ctx.ellipse(cx, floorY - 46, 24 + heave * 0.4, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#25332f';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 24 + i * 8, floorY - 92);
      ctx.quadraticCurveTo(cx - 10 + i * 4, floorY - 46, cx - 22 + i * 8, floorY);
      ctx.stroke();
    }
    // the face: mask torn, eyes wet and open
    ctx.fillStyle = '#2a2230';
    ctx.beginPath();
    ctx.ellipse(cx, floorY - 70, 9, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a07a6a';
    ctx.fillRect(cx - 6, floorY - 72, 12, 5);
    ctx.fillStyle = '#f0e8e0';
    ctx.fillRect(cx - 4, floorY - 71, 2, 2);
    ctx.fillRect(cx + 2, floorY - 71, 2, 2);
    if (this.burst) {
      // the chest opened from inside; the head has fallen forward
      ctx.fillStyle = '#1a0608';
      ctx.beginPath();
      ctx.ellipse(cx, floorY - 44, 9, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c9b8a8';
      ctx.lineWidth = 1.5;
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + k * 3, floorY - 48);
        ctx.lineTo(cx + k * 6, floorY - 60);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(100,8,16,0.75)';
      ctx.beginPath();
      ctx.ellipse(cx, floorY - 2, 30, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 3, floorY - 40, 6, 38);
      return;
    }
    // something moving under the resin, low on the chest
    const k = (Math.sin(t * 0.9) + 1) / 2;
    ctx.fillStyle = 'rgba(30,44,40,0.9)';
    ctx.beginPath();
    ctx.ellipse(cx + (k - 0.5) * 8, floorY - 44, 6 + k * 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  light(out) {
    out.push({ x: this.cx, y: this.floorY - 60, r: 70, color: 'rgb(150,120,200)', i: 0.3 });
  }
}
