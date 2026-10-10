// Dev-only Xenomorph pose sheet. Open /debug/xeno.html
//   ?only=<name>  one pose, big     ?s=<scale>     ?snap=<file>  saves .snaps/<file>.png
import { drawXeno } from '../src/render/xenoArt.js';

const c = document.getElementById('c');
const ctx = c.getContext('2d');
const params = new URLSearchParams(location.search);
const only = params.get('only');
const W = 1280;
const H = 720;
c.width = W;
c.height = H;

const poses = {
  idle: {},
  walk: { moving: 1, walk: 1.2 },
  crouch: { crouch: 1, jaw: 0.3, claw: 0.3 },
  roar: { rear: 1, jaw: 1, claw: 1, head: -0.15 },
  inner: { jaw: 0.8, inner: 1, innerLen: 60, lean: 0.4, crouch: 0.5 },
  tailRaise: { tailRaise: 1, crouch: 0.4 },
  stab: { tailStab: 1, stab: [150, -10], crouch: 0.4, lean: 0.3 },
  sweep: { tailSweep: 0.7, crouch: 0.6 },
  reach: { reach: 1, lean: 0.4, jaw: 0.6 },
  ceiling: { cling: 'ceiling', crouch: 0.6, jaw: 0.4 },
};
const names = only ? [only] : Object.keys(poses);

function frame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#4a5866';
  ctx.fillRect(0, 0, W, H);
  const cols = only ? 1 : 5;
  const rows = Math.ceil(names.length / cols);
  const cw = W / cols;
  const ch = H / rows;
  const s = Number(params.get('s') || (only ? 3.2 : 1.05));
  names.forEach((n, i) => {
    const cx = (i % cols) * cw + cw * 0.58;
    const cy = Math.floor(i / cols) * ch + ch * (poses[n].cling ? 0.12 : 0.86);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(cx - cw * 0.58, cy, cw, 1);
    const pose = { ...poses[n], breathe: t * 0.002, tail: t * 0.002 };
    drawXeno(ctx, cx, cy, 1, pose, s);
    ctx.fillStyle = '#dde';
    ctx.font = '14px sans-serif';
    ctx.fillText(n, (i % cols) * cw + 8, Math.floor(i / cols) * ch + 18);
  });
}

if (params.get('snap')) {
  frame(1000);
  fetch('/__snap?name=' + params.get('snap'), { method: 'POST', body: c.toDataURL('image/png') });
} else {
  const loop = (t) => {
    frame(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
