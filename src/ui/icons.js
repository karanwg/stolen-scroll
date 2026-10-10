// Vector glyphs for abilities, shared by pickups, the HUD and the unlock card.

export const ABILITY_INFO = {
  doubleJump: {
    name: 'Tengu Feather',
    verb: 'Double Jump',
    how: 'Press JUMP again in midair.',
    color: '#9fd8ff',
  },
  dash: {
    name: 'Wind-Step Tabi',
    verb: 'Dash',
    how: 'Press C to burst forward — on the ground or in the air.',
    color: '#8fffd8',
  },
  shadowStep: {
    name: 'Kage-ashi',
    verb: 'Shadow Dash · Sprint',
    how: 'Every 3s a dash turns to shadow: untouchable. Hold C after it to sprint.',
    color: '#b89aff',
  },
  waterWalk: {
    name: 'Mizugumo',
    verb: 'Water Walk',
    how: 'Run across calm water — keep moving or you sink. Whitecaps are too rough.',
    color: '#8fd4ff',
  },
  float: {
    name: 'Kite Cloth',
    verb: 'Float',
    how: 'Press and hold JUMP in midair to open the cloth and drift.',
    color: '#ff9fb0',
  },
  wallJump: {
    name: 'Shuko Claws',
    verb: 'Wall Jump',
    how: 'Hold toward a wall to cling, then JUMP away from it. Ice walls are slick.',
    color: '#ffd28f',
  },
  kaginawa: {
    name: 'Kaginawa',
    verb: 'Grappling Hook',
    how: 'Hold S to hook the marked ring and swing. ← → pump · ↑ ↓ reel · let go to fling · Z to leap off.',
    color: '#ffcf8a',
  },
};

export function drawAbilityIcon(ctx, ability, x, y, s, color = '#ffffff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 32, s / 32);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (ability) {
    case 'doubleJump': {
      // feather
      ctx.beginPath();
      ctx.moveTo(-10, 12);
      ctx.quadraticCurveTo(-4, -2, 10, -13);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, -13);
      ctx.quadraticCurveTo(-2, -12, -7, 4);
      ctx.quadraticCurveTo(4, 2, 10, -13);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-4 + i * 3.4, 5 - i * 4.5);
        ctx.lineTo(-10 + i * 3, 0 - i * 4);
        ctx.stroke();
      }
      break;
    }
    case 'dash': {
      // wind swirl + speed lines
      ctx.beginPath();
      ctx.arc(2, 0, 9, Math.PI * 0.2, Math.PI * 1.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(4, 1, 4.5, Math.PI * 1.2, Math.PI * 2.6);
      ctx.stroke();
      for (const [y, l] of [[-8, 10], [0, 14], [8, 9]]) {
        ctx.beginPath();
        ctx.moveTo(-14, y);
        ctx.lineTo(-14 + l * 0.5, y);
        ctx.stroke();
      }
      break;
    }
    case 'shadowStep': {
      // a runner's shadow with its afterimages trailing
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 0.3 + i * 0.35;
        ctx.beginPath();
        ctx.arc(-8 + i * 7, -5, 3.2, 0, Math.PI * 2);
        ctx.moveTo(-8 + i * 7, -1);
        ctx.lineTo(-11 + i * 7, 10);
        ctx.moveTo(-8 + i * 7, 3);
        ctx.lineTo(-3 + i * 7, 9);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 14, -0.6, 0.6);
      ctx.stroke();
      break;
    }
    case 'waterWalk': {
      // mizugumo: a ring of floats around a sandal, ripples beneath
      ctx.beginPath();
      ctx.ellipse(0, -2, 12, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 12, -2 + Math.sin(a) * 5, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillRect(-3, -4, 6, 4);
      ctx.lineWidth = 1.5;
      for (const [y, w] of [[8, 12], [13, 8]]) {
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.quadraticCurveTo(0, y - 3, w, y);
        ctx.stroke();
      }
      break;
    }
    case 'float': {
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.quadraticCurveTo(0, -18, 13, 0);
      ctx.quadraticCurveTo(0, -6, -13, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(13, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 12, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'kaginawa': {
      // three-pronged hook trailing a coil of rope
      ctx.beginPath();
      ctx.moveTo(6, -12);
      ctx.lineTo(6, 2);
      ctx.stroke();
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(6, -10);
        ctx.quadraticCurveTo(6 + s * 9, -10, 6 + s * 8, -2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(6, -14);
      ctx.lineTo(6, -18);
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(6, 2);
      ctx.bezierCurveTo(-4, 6, -14, 0, -10, 8);
      ctx.bezierCurveTo(-6, 14, 4, 10, -2, 14);
      ctx.stroke();
      break;
    }
    case 'wallJump': {
      ctx.fillRect(-14, -14, 4, 28);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-8, i * 8);
        ctx.quadraticCurveTo(4, i * 8 - 4, 12, i * 8 - 1);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}
