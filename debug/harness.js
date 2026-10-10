// Dev-only test harness (loaded by main.js in dev builds). Drives the simulation
// deterministically from the console: H.warp(x, y), H.hold('right'), H.secs(1)…
const CODES = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'KeyZ', attack: 'KeyX', dash: 'KeyC', confirm: 'Enter' };

export function installHarness(game) {
  const H = {
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        game.update(1 / 120);
        game.input.endStep();
      }
    },
    hold(a) {
      game.input.codes.add(CODES[a]);
      game.input.pressedSet.add(a);
    },
    release(a) {
      game.input.codes.delete(CODES[a]);
    },
    releaseAll() {
      game.input.codes.clear();
    },
    tap(a) {
      H.hold(a);
      H.step(2);
      H.release(a);
    },
    secs(s) {
      H.step(Math.round(s * 120));
    },
    skipDialogue() {
      let k = 0;
      while (game.dialogue.active && k++ < 50) {
        H.tap('jump');
        H.secs(0.1);
      }
    },
    // Fresh game in play mode, past the elder, optionally without enemies.
    fresh({ enemies = true } = {}) {
      game.startGame(true);
      game.setMode('play');
      game.fadeIn = 0;
      game.save.elderTalked = true;
      for (const p of game.props) if (p.kind === 'elder') p.talked = true;
      if (!enemies) game.enemies = [];
      H.releaseAll();
    },
    // Jump straight into a chapter in play mode.
    chapter(n, { enemies = true } = {}) {
      game.startChapter(n);
      game.setMode('play');
      game.fadeIn = 0;
      if (!enemies) game.enemies = [];
      H.releaseAll();
    },
    warp(tx, ty) {
      const p = game.player;
      p.place(tx * 32 + 16, ty * 32);
      p.invuln = 0;
      game.respawning = null;
      game.camera.snap(p.cx, p.cy, game.level.camBounds);
      H.secs(0.3);
    },
    // Bot moves: steer toward a jellyfish, double jump at the apex, down-slash it.
    bounceOn(j, fromGround = false) {
      const p = game.player;
      let jumped = 0;
      let k = 0;
      if (fromGround) H.hold('jump');
      while (k++ < 600) {
        const dx = j.cx - p.cx;
        H.release('left');
        H.release('right');
        if (Math.abs(dx) > 6) H.hold(dx > 0 ? 'right' : 'left');
        if (!jumped && p.vy > -60 && !p.grounded) {
          H.release('jump');
          H.step(1);
          H.hold('jump');
          jumped = 1;
        }
        if (p.feetY < j.y - 2 && p.vy > 0 && Math.abs(dx) < 26 && j.y - p.feetY < 70) {
          H.hold('down');
          H.tap('attack');
          H.release('down');
          H.step(2);
          if (p.vy < 0) {
            H.releaseAll();
            return true;
          }
        }
        if (p.grounded && k > 30) {
          H.releaseAll();
          return false;
        }
        H.step(1);
      }
      return false;
    },
    // Steer to x, double jump once, stop on landing.
    landOn(targetX) {
      const p = game.player;
      let jumped = 0;
      let k = 0;
      while (k++ < 600) {
        const dx = targetX - p.cx;
        H.release('left');
        H.release('right');
        if (Math.abs(dx) > 6) H.hold(dx > 0 ? 'right' : 'left');
        if (!jumped && p.vy > -60 && !p.grounded) {
          H.hold('jump');
          H.step(1);
          H.release('jump');
          jumped = 1;
        }
        if (p.grounded && k > 5) break;
        H.step(1);
      }
      H.releaseAll();
      return +(p.feetY / 32).toFixed(1);
    },
    pos() {
      const p = game.player;
      return { x: +(p.cx / 32).toFixed(2), y: +(p.feetY / 32).toFixed(2), grounded: p.grounded, hearts: p.hearts };
    },
    async snap(name) {
      game.render();
      const c = document.createElement('canvas');
      c.width = 1280;
      c.height = 720;
      c.getContext('2d').drawImage(game.canvas, 0, 0, 1280, 720);
      await fetch('/__snap?name=' + name, { method: 'POST', body: c.toDataURL('image/png') });
      return name;
    },
  };
  window.H = H;
}
