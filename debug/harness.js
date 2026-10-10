// Dev-only test harness (loaded by main.js in dev builds). Drives the simulation
// deterministically from the console: H.warp(x, y), H.hold('right'), H.secs(1)…
const CODES = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', jump: 'KeyZ', attack: 'KeyX', dash: 'KeyC', hook: 'KeyS', confirm: 'Enter' };

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
      game.devWarp(tx, ty);
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
    // Bot move: from tile (fromX, fromY) jump, hook the target, pump toward
    // `dir`, hook-jump once `relDx` tiles past the anchor on the upswing, then
    // steer to land near tile column landX. Returns where it ended up.
    swingTo(fromX, fromY, dir, relDx, landX) {
      const p = game.player;
      const side = (s) => (s > 0 ? 'right' : 'left');
      H.warp(fromX, fromY);
      H.secs(0.4);
      H.hold('jump');
      H.secs(0.25);
      H.release('jump');
      H.hold('hook');
      for (let i = 0; i < 30 && p.hook?.phase !== 'attached'; i++) H.secs(0.05);
      const A = p.hook?.anchor;
      if (!A) return { attached: false };
      let rel = null;
      for (let i = 0; i < 600; i++) {
        H.releaseAll();
        H.hold('hook');
        H.hold('up');
        H.hold(side(p.vx * dir >= 0 ? dir : -dir));
        H.step(1);
        if ((p.cx - A.x) * dir > relDx * 32 && p.vx * dir > 0 && p.vy < 0) {
          rel = { dx: (p.cx - A.x) / 32, vx: Math.round(p.vx), vy: Math.round(p.vy) };
          break;
        }
      }
      H.hold('jump');
      H.step(1);
      H.release('hook');
      H.step(1);
      H.release('jump');
      let peak = Infinity;
      for (let i = 0; i < 180 && !p.grounded; i++) {
        H.release('left');
        H.release('right');
        const dx = landX * 32 + 16 - p.cx;
        if (Math.abs(dx) > 12) H.hold(side(dx));
        H.step(1);
        peak = Math.min(peak, p.feetY / 32);
      }
      H.releaseAll();
      H.secs(0.4);
      return { attached: true, rel, peak: +peak.toFixed(1), ...H.pos() };
    },
    // Bot: fights the Xenomorph the way someone who has learned its patterns
    // would — reacting to each tell, cutting only in the openings. Logs what
    // hit it. Run from inside the arena once the fight has started.
    fightXeno(maxT = 180) {
      const p = game.player;
      const b = game.boss;
      const A = game.level.arena;
      const hits = {};
      let lastHearts = p.hearts;
      let t = 0;
      let jumpHold = 0;
      const moveTo = (x, tol = 20) => {
        H.release('left');
        H.release('right');
        const dx = x - p.cx;
        if (Math.abs(dx) > tol) H.hold(dx > 0 ? 'right' : 'left');
      };
      const jump = () => {
        if (p.grounded) {
          H.hold('jump');
          jumpHold = 14;
        }
      };
      const cause = () => {
        if (b.waveT > 0) return 'wave';
        if (game.projectiles.some((pr) => !pr.harmless && Math.abs(pr.x + pr.w / 2 - p.cx) < 60 && Math.abs(pr.y + pr.h / 2 - p.cy) < 60)) return 'acid';
        return b.state;
      };
      const clampX = (x) => Math.max(A.x0 + 40, Math.min(A.x1 - 40, x));
      while (t < maxT && b.state !== 'falling' && p.state !== 'dead' && game.bossActive) {
        const s = b.state;
        const dx = b.cx - p.cx;
        const dist = Math.abs(dx);
        if (jumpHold > 0) jumpHold--;
        else H.release('jump');
        if (s === 'grab') {
          H.tap('attack');
          H.step(3);
        } else if (s === 'jawTell' || s === 'jaw') moveTo(b.cx + b.facing * 70, 15);
        else if (s === 'sweepTell') {
          moveTo(p.cx);
          if (b.t < 0.08) jump();
        } else if (s === 'sweep') jump();
        else if (s === 'stabTell' && b.stabAt) moveTo(b.stabX + (p.cx < b.stabX ? -160 : 160), 10);
        else if (s === 'leapTell') moveTo(p.cx + (p.cx < b.cx ? -200 : 200), 10);
        else if (s === 'leap') {
          const lx = b.leapX ?? b.cx;
          moveTo(lx + (p.cx < lx ? -260 : 260), 10);
          if (b.vy > 0 && b.feetY > A.floorY - 60) jump();
        } else if (s === 'spitTell') moveTo(p.cx + (dx > 0 ? -85 : 85), 10);
        else if (s === 'grabTell' || s === 'grabLunge') moveTo(b.cx - b.facing * 320, 10);
        else if (s === 'ceilingStalk' || s === 'dropTell' || b.stabs.some((st) => !st.fired)) {
          let safe = p.cx;
          for (const st of b.stabs) if (!st.fired && Math.abs(st.x - p.cx) < 70) safe = st.x + (p.cx < st.x ? -120 : 120);
          if (s === 'dropTell' && Math.abs(b.cx - p.cx) < 200) safe = b.cx + (p.cx < b.cx ? -260 : 260);
          moveTo(clampX(safe), 10);
        } else if (['recover', 'stuck', 'stagger'].includes(s)) {
          if (b.waveT > 0) jump();
          moveTo(b.cx - Math.sign(dx || 1) * 60, 30);
          if (dist < 130) H.tap('attack');
        } else if (s === 'cling') {
          if (b.swipeTell > 0 || b.swipeT > 0) moveTo(b.cx - 300, 10);
          else {
            moveTo(b.cx - 70, 20);
            if (dist < 130) H.tap('attack');
          }
        } else moveTo(p.cx);
        H.step(3);
        t += 3 / 120;
        if (p.hearts < lastHearts) {
          const c = cause();
          hits[c] = (hits[c] || 0) + (lastHearts - p.hearts);
        }
        lastHearts = p.hearts;
      }
      H.releaseAll();
      return { t: +t.toFixed(1), state: b.state, hp: b.hp, phase: b.phase, hearts: p.hearts, pstate: p.state, hits };
    },
    // Start the Chapter III boss fight from its doorway.
    xenoFight() {
      H.chapter(3);
      const p = game.player;
      Object.assign(p.abilities, { kaginawa: true, wallJump: true });
      game.debug.god = false;
      game.zonesSeen = new Set(game.level.zones.map((z) => z.title));
      game.stage.powerOut = true;
      H.warp(706, 43);
      H.secs(0.3);
      H.hold('right');
      H.secs(0.4);
      H.releaseAll();
      H.secs(4.2);
      p.hearts = p.maxHearts;
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
