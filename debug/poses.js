// Dev-only pose sheet: every rig pose drawn large. Open /debug/poses.html
import { NinjaRig, POSES, STYLES, runPose, attackPose } from '../src/render/ninjaRig.js';

const c = document.getElementById('c');
const ctx = c.getContext('2d');
const params = new URLSearchParams(location.search);
const only = params.get('only');
const Z = Number(params.get('z') || (only ? 7 : 3));
c.width = 1280 * devicePixelRatio;
c.height = 720 * devicePixelRatio;
c.style.width = '1280px';
c.style.height = '720px';

const entries = [
  ['idle', POSES.idle], ['run 0', runPose(0)], ['run 1', runPose(1.6)], ['run 2', runPose(3.1)],
  ['jump', POSES.jump], ['fall', POSES.fall], ['tuck', POSES.tuck], ['float', POSES.float],
  ['dash', POSES.dash], ['wall', POSES.wall], ['hurt', POSES.hurt], ['kneel', POSES.kneel],
  ['slash 0.3', attackPose(POSES.idle, 'side', 0.3)], ['slash up', attackPose(POSES.idle, 'up', 0.5)], ['slash down', attackPose(POSES.fall, 'down', 0.5)], ['crouch', POSES.crouch],
];
const style = params.get('style') || 'player';
if (only) entries.splice(0, entries.length, ...entries.filter(([n]) => n === only));
const rigs = entries.map(([, p]) => {
  const r = new NinjaRig(STYLES[style]);
  r.pose = JSON.parse(JSON.stringify(p));
  r.set(p, 1000);
  return r;
});

function frame(t) {
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(0, 0, 1280, 720);
  entries.forEach(([name], i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const x = only ? 640 : 80 + col * 155;
    const y = only ? 560 : 290 + row * 330;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Z, Z);
    const r = rigs[i];
    r.update(1 / 60, 0, 0, 1);
    r.draw(ctx, 0, 0, 1);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(name, x - 30, y + 24);
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
