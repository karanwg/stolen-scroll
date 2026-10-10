import { TILE, VIEW_W, VIEW_H, TUNING as T, JUICE } from './config.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Camera } from './core/camera.js';
import { clamp, overlaps, rand, sign } from './core/math.js';
import { buildStage1 } from './world/stage1.js';
import { buildStage2 } from './world/stage2.js';
import { Player } from './entities/player.js';
import { Blade, Thrower, EmberCrow } from './entities/enemies.js';
import { Balrog } from './entities/balrog.js';
import { Kraken } from './entities/kraken.js';
import { FloatPlatform, Geyser, Jelly, Kappa, Tentacle } from './entities/sea.js';
import { Lantern, Elder, Ferryman, WoundedBinoshi, Note, Pickup, Relic } from './entities/props.js';
import { Particles } from './fx/particles.js';
import { SlashFx } from './fx/slash.js';
import { Background } from './render/background.js';
import { TerrainRenderer } from './render/terrain.js';
import { DecoLayer } from './render/decos.js';
import { Lighting } from './render/lighting.js';
import { Weather } from './render/weather.js';
import { WaterRenderer } from './render/water.js';
import { NinjaRig } from './render/ninjaRig.js';
import { Hud, drawPrompt, FONT_BODY } from './ui/hud.js';
import { Dialogue } from './ui/dialogue.js';
import { Menu, drawTitle, drawOpening, drawPause, drawAbilityCard, drawBossCard, drawDeath, drawChapterEnd } from './ui/screens.js';
import * as STORY from './data/story.js';

const SAVE_KEY = 'stolen-scroll.save.v1';

// Everything that differs per chapter.
const CHAPTERS = {
  1: { build: buildStage1, opening: STORY.OPENING, title: 'Chapter I — Kagari Village', end: STORY.CHAPTER_END, bossDefeated: STORY.BOSS_DEFEATED, accent: 'rgb(255,90,40)', requires: [] },
  2: { build: buildStage2, opening: STORY.OPENING_2, title: 'Chapter II — The Drowned Coast', end: STORY.CHAPTER_END_2, bossDefeated: STORY.BOSS_DEFEATED_2, accent: 'rgb(90,170,255)', requires: ['doubleJump', 'dash'] },
};
const LAST_CHAPTER = 2;

const freshStage = () => ({ lantern: null, lit: [], notesRead: [], talked: [], bossDefeated: false, broken: [], zonesSeen: [] });

// Input stand-in used while the player isn't in control.
const NO_INPUT = { held: () => false, pressed: () => false, released: () => false, axisX: () => 0 };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.audio = new Audio();
    this.camera = new Camera();
    this.particles = new Particles();
    this.hud = new Hud();
    this.dialogue = new Dialogue(this.audio);
    this.lighting = new Lighting();
    this.time = 0;
    this.mode = 'title';
    this.modeT = 0;
    this.hitstopT = 0;
    this.hurtFlash = 0;
    this.showControls = false;
    this.debug = { hitboxes: false, god: false, timeScale: 1 };

    this.input.onKey(() => this.audio.unlock());
    this.resize();
    addEventListener('resize', () => this.resize());

    this.newWorld(this.readSave());
    this.buildTitleMenu();
    this.applyThemeAudio();
  }

  // ── Setup ───────────────────────────────────────────────────
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.min(innerWidth, (innerHeight * VIEW_W) / VIEW_H);
    const scale = clamp(Math.round(((cssW * dpr) / VIEW_W) * 2) / 2, 1, 2);
    if (scale === this.scale) return;
    this.scale = scale;
    this.canvas.width = VIEW_W * scale;
    this.canvas.height = VIEW_H * scale;
    if (this.level) this.buildRenderers();
  }

  get theme() {
    return this.level.theme;
  }

  buildRenderers() {
    this.background = new Background(this.scale, this.theme.sky);
    this.terrain = new TerrainRenderer(this.level, this.scale);
    this.decos = new DecoLayer(this.level, this.scale);
    this.water = new WaterRenderer(this.level);
  }

  applyThemeAudio() {
    this.audio.setMusic(this.bossActive ? this.theme.music.boss : this.theme.music.explore);
    this.audio.setAmbienceType(this.theme.ambience);
  }

  // ── Saves ───────────────────────────────────────────────────
  readSave() {
    try {
      return migrateSave(JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'));
    } catch {
      return null;
    }
  }

  writeSave() {
    const s = this.save;
    s.abilities = { ...this.player.abilities };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch {}
  }

  get stage() {
    return this.save.stage;
  }

  // Builds the level and everything in it from a save (or fresh).
  newWorld(save) {
    this.dialogue.lines = [];
    this.hud = new Hud();
    this.hitstopT = 0;
    this.save = save || { version: 2, chapter: 1, completed: [], abilities: {}, stage: freshStage() };
    const ch = CHAPTERS[this.save.chapter] || CHAPTERS[1];
    // Starting a later chapter directly still gives you what earlier chapters taught.
    for (const ab of ch.requires) this.save.abilities[ab] = true;
    this.level = ch.build();
    this.buildRenderers();
    this.weather = new Weather(this.theme.weather);
    this.weather.onThunder = (delay) => this.audio.play('thunder', delay);
    for (const key of this.stage.broken) {
      const [x, y] = key.split(',').map(Number);
      this.level.setTile(x, y, '.');
    }
    if (this.stage.bossDefeated) this.afterBossWorldChanges();

    this.props = [];
    this.lanterns = {};
    this.spawns = [];
    this.platforms = [];
    this.geysers = [];
    this.boss = null;
    this.bossActive = false;
    this.bossSpawn = null;
    this.bossTriggerX = Infinity;
    this.chapterEndX = null;
    this.relic = null;
    this.projectiles = [];
    this.slashes = [];
    this.bossIntroT = undefined;
    this.bossCardT = undefined;
    this.bossOutroT = undefined;
    let start = { x: 200, y: 768 };
    for (const e of this.level.entities) {
      switch (e.type) {
        case 'playerStart':
          start = { x: e.x, y: e.y };
          break;
        case 'lantern': {
          const l = new Lantern(e.x, e.y, e.id);
          l.lit = this.stage.lit.includes(e.id);
          this.lanterns[e.id] = l;
          this.props.push(l);
          break;
        }
        case 'elder':
        case 'ferryman':
        case 'binoshi': {
          const C = { elder: Elder, ferryman: Ferryman, binoshi: WoundedBinoshi }[e.type];
          const npc = new C(e.x, e.y);
          npc.talked = this.stage.talked.includes(npc.id);
          this.props.push(npc);
          break;
        }
        case 'note': {
          const n = new Note(e.x, e.y, e.id);
          n.read = this.stage.notesRead.includes(e.id);
          this.props.push(n);
          break;
        }
        case 'pickup':
          if (!this.save.abilities[e.ability]) this.props.push(new Pickup(e.x, e.y, e.ability));
          break;
        case 'relic':
          this.relic = new Relic(e.x, e.y);
          this.relic.visible = this.stage.bossDefeated;
          this.props.push(this.relic);
          break;
        case 'float': {
          const top = e.mode === 'crumble' ? e.y : e.y - 8;
          this.platforms.push(new FloatPlatform({ x: e.x - 16, y: top, w: e.w * TILE, mode: e.mode, look: e.look }));
          break;
        }
        case 'geyser':
          this.geysers.push(new Geyser(e.x, e.y, { height: e.height, period: e.period, offset: e.offset }));
          break;
        case 'balrog':
        case 'kraken':
          this.bossSpawn = e;
          break;
        case 'bossTrigger':
          this.bossTriggerX = e.x;
          break;
        case 'chapterEnd':
          this.chapterEndX = e.x;
          break;
        default:
          this.spawns.push(e);
      }
    }
    this.level.platforms = this.platforms;
    this.startPos = start;
    this.player = new Player(start.x, start.y);
    Object.assign(this.player.abilities, this.save.abilities);
    this.spawnEnemies();
    this.spawnBoss();
    const lantern = this.stage.lantern && this.lanterns[this.stage.lantern];
    if (lantern) this.player.place(lantern.cx - 26, lantern.floorY);
    this.camera.lock = null;
    this.camera.focus = null;
    this.camera.snap(this.player.cx, this.player.cy, this.level.camBounds);
    this.zonesSeen = new Set(this.stage.zonesSeen);
    this.respawning = null;
    this.deathT = 0;
  }

  spawnEnemies() {
    this.enemies = [];
    for (const e of this.spawns) {
      switch (e.type) {
        case 'blade':
          this.enemies.push(new Blade(e.x, e.y));
          break;
        case 'kunai':
          this.enemies.push(new Thrower(e.x, e.y));
          break;
        case 'bat':
          this.enemies.push(new EmberCrow(e.x, e.y));
          break;
        case 'stormcrow':
          this.enemies.push(new EmberCrow(e.x, e.y, 'storm'));
          break;
        case 'kappa':
          this.enemies.push(new Kappa(e.x, e.y));
          break;
        case 'jelly':
          this.enemies.push(new Jelly(e.x, e.y));
          break;
        case 'tentacle':
          this.enemies.push(new Tentacle(e.x, e.y, { range: e.range }));
          break;
      }
    }
  }

  spawnBoss() {
    this.boss = null;
    this.bossActive = false;
    if (this.stage.bossDefeated || !this.bossSpawn) return;
    const e = this.bossSpawn;
    if (e.type === 'balrog') this.boss = new Balrog(e.x, e.y);
    else if (e.type === 'kraken') {
      const steps = this.platforms.filter((p) => p.mode === 'step');
      for (const s of steps) {
        s.forced = 0;
        s.sinkY = 0;
        s.solid = true;
      }
      this.boss = new Kraken(this.level.arena, steps);
    }
  }

  buildTitleMenu() {
    const save = this.readSave();
    const items = [
      { label: 'Continue', enabled: !!save, action: () => this.startGame(false) },
      { label: 'New Journey', action: () => this.startGame(true) },
    ];
    if (save && (save.completed || []).length) items.push({ label: 'Chapter Select', action: () => this.openChapterSelect() });
    items.push({ label: 'Controls', action: () => (this.showControls = true) });
    this.titleMenu = new Menu(items);
  }

  openChapterSelect() {
    const save = this.readSave();
    const unlocked = Math.min(LAST_CHAPTER, Math.max(save.chapter, ...(save.completed || []).map((c) => c + 1)));
    const items = [];
    for (let c = 1; c <= LAST_CHAPTER; c++) items.push({ label: CHAPTERS[c].title, enabled: c <= unlocked, action: () => this.startChapter(c) });
    items.push({ label: 'Back', action: () => this.buildTitleMenu() });
    this.titleMenu = new Menu(items);
  }

  // Begin a chapter from its start, keeping abilities.
  startChapter(c) {
    const prev = this.readSave() || { completed: [], abilities: {} };
    const save = { version: 2, chapter: c, completed: prev.completed || [], abilities: { ...prev.abilities }, stage: freshStage() };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {}
    this.newWorld(save);
    this.setMode('opening');
    this.applyThemeAudio();
  }

  startGame(fresh) {
    if (fresh) {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {}
      this.newWorld(null);
      this.setMode('opening');
    } else {
      this.newWorld(this.readSave());
      this.setMode('play');
      this.fadeIn = 1;
    }
    this.applyThemeAudio();
  }

  setMode(m) {
    this.mode = m;
    this.modeT = 0;
  }

  hitstop(t) {
    if (JUICE.hitstop) this.hitstopT = Math.max(this.hitstopT, t);
  }

  // Water spray + ring. Used by everything that touches the sea.
  splash(x, y, n = 10) {
    const sy = this.water.surfaceAt(x, y) ?? y;
    this.particles.burst(x, sy - 2, n, { color: 'rgba(200,230,255,0.85)', speed: 220, life: 0.55, size: 2.2, grav: 900, angle: -Math.PI / 2, spread: 1.6 });
    if (n >= 6) this.particles.add({ x, y: sy, kind: 'ring', size: 6, grow: 90, color: 'rgba(200,230,255,0.6)', life: 0.4 });
  }

  // ── Update ──────────────────────────────────────────────────
  update(dt) {
    dt *= this.debug.timeScale;
    this.time += dt;
    this.modeT += dt;
    const inp = this.input;
    if (inp.pressed('mute')) this.audio.toggleMute();

    switch (this.mode) {
      case 'title':
        this.ambientWorld(dt);
        this.weather.update(dt);
        if (this.showControls) {
          if (inp.anyPressed && this.modeT > 0.1) this.showControls = false;
        } else this.titleMenu.update(inp, this.audio);
        return;
      case 'opening': {
        const lines = this.chapterInfo.opening;
        if ((inp.anyPressed && this.modeT > 0.5) || this.modeT > lines.length * 3.2 + 2.5) {
          this.setMode('play');
          this.fadeIn = 1;
          this.audio.play('title');
        }
        return;
      }
      case 'paused':
        if (this.showControls) {
          if (inp.anyPressed) this.showControls = false;
          return;
        }
        if (inp.pressed('pause')) this.setMode('play');
        else this.pauseMenu.update(inp, this.audio);
        return;
      case 'card':
        this.particles.update(dt);
        if (this.modeT > 1 && (inp.pressed('jump') || inp.pressed('confirm') || inp.pressed('attack'))) this.setMode('play');
        return;
      case 'chapterEnd':
        this.particles.update(dt);
        if (this.modeT > 4 && (inp.pressed('confirm') || inp.pressed('jump'))) this.advanceChapter();
        return;
    }

    // ── play ──
    if (inp.pressed('pause') && !this.dialogue.active) {
      this.openPause();
      return;
    }
    this.fadeIn = Math.max(0, (this.fadeIn || 0) - dt * 1.5);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    this.hud.update(dt, this);
    this.particles.update(dt);
    this.weather.update(dt);
    this.dialogue.update(dt, inp);
    if (this.dialogue.active) return;
    if (this.bossCardT !== undefined) this.bossCardT += dt;

    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
      return;
    }

    const p = this.player;
    // Platforms move first and carry whoever stands on them.
    const riding = this.level.platformUnder(p.x, p.y, p.w, p.h);
    for (const pl of this.platforms) pl.update(dt, this, pl === riding && p.grounded);
    if (riding && p.grounded && riding.solid) {
      p.x += riding.dx;
      p.y = riding.y - p.h;
    }
    for (const g of this.geysers) g.update(dt, this);

    const playerInput = p.state === 'cutscene' || this.respawning ? NO_INPUT : inp;
    p.step(dt, playerInput, this.level);
    this.handlePlayerEvents();
    for (const g of p.ghosts) g.life -= dt;
    p.ghosts = p.ghosts.filter((g) => g.life > 0);
    if (p.onWater && Math.abs(p.vx) > 90 && Math.random() < 0.6) {
      // spray off the water-spider shoes
      this.particles.add({ x: p.cx - sign(p.vx) * 8, y: p.feetY - 2, vx: -p.vx * 0.2 + rand(-30, 30), vy: rand(-140, -60), size: rand(1.5, 2.5), color: 'rgba(200,230,255,0.8)', life: 0.35, grav: 700 });
      if (Math.random() < 0.15) this.particles.add({ x: p.cx, y: p.feetY + 1, kind: 'ring', size: 4, grow: 50, color: 'rgba(200,230,255,0.4)', life: 0.5 });
    }

    for (const e of this.enemies) e.update(dt, this);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.boss && (this.bossActive || this.boss.state === 'dying')) this.boss.update(dt, this);
    for (const pr of this.projectiles) pr.update(dt, this);
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    for (const s of this.slashes) s.update(dt);
    this.slashes = this.slashes.filter((s) => !s.dead);
    for (const pr of this.props) pr.update?.(dt, this);

    this.resolveCombat();
    this.updateInteractions(inp);
    this.updateTriggers(dt);
    this.updateDeathAndRespawn(dt);

    const fallFlag = p.fallTime > T.fallCamDelay;
    this.camera.update(dt, p, this.level.camBounds, fallFlag);
    this.ambientWorld(dt);
  }

  get chapterInfo() {
    return CHAPTERS[this.level.chapter];
  }

  ambientWorld(dt) {
    const left = this.camera.left;
    const top = this.camera.top;
    if (this.theme.particles === 'embers') {
      // Embers drifting up and ash drifting down, around the camera.
      if (Math.random() < dt * 22) {
        this.particles.add({ x: left + rand(-50, VIEW_W + 50), y: top + VIEW_H + 10, vx: rand(-20, 30), vy: rand(-90, -40), size: rand(1, 2.4), color: 'rgb(255,150,70)', additive: true, life: rand(4, 7), drag: 0.1 });
      }
      if (Math.random() < dt * 10) {
        this.particles.add({ x: left + rand(-50, VIEW_W + 50), y: top - 10, vx: rand(10, 40), vy: rand(20, 45), size: rand(1, 2), color: 'rgba(170,160,170,0.6)', life: rand(8, 12), kind: 'shard', vrot: rand(-3, 3) });
      }
    } else {
      // Rain rings on the water and drifting bioluminescence beneath it.
      for (let i = 0; i < 2; i++) {
        if (Math.random() < dt * 30) {
          const x = left + rand(0, VIEW_W);
          const sy = this.water.surfaceAt(x, top + VIEW_H * 0.7);
          if (sy !== null && sy > top && sy < top + VIEW_H) this.particles.add({ x, y: sy + rand(0, 3), kind: 'ring', size: 1, grow: 22, color: 'rgba(190,220,250,0.35)', life: 0.45 });
        }
      }
      if (Math.random() < dt * 6) {
        const x = left + rand(0, VIEW_W);
        const sy = this.water.surfaceAt(x, top + VIEW_H * 0.7);
        if (sy !== null) this.particles.add({ x, y: sy + rand(20, 160), vx: rand(-8, 8), vy: rand(-10, 4), size: rand(1, 2), color: 'rgb(90,230,255)', additive: true, life: rand(2, 4), fadeIn: true });
      }
    }
    if (this.mode === 'title') {
      this.particles.update(dt);
      this.camera.time += dt;
      const ch = this.level.chapter;
      this.camera.x = (ch === 2 ? 5600 : 3000) + Math.sin(this.time * 0.05) * 600;
      this.camera.y = ch === 2 ? 1250 : 980;
      this.camera.clampTo(this.level.camBounds);
    }
  }

  handlePlayerEvents() {
    const p = this.player;
    const r = p.rig;
    for (const e of p.events) {
      switch (e.type) {
        case 'jump':
          if (JUICE.squash) r.squash(0.78, 1.25);
          if (p.onWater) this.splash(e.x, e.y, 8);
          else this.dust(e.x, e.y, 6);
          this.audio.play('jump');
          break;
        case 'airJump':
          this.audio.play('airJump');
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            this.particles.add({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 110, vy: Math.sin(a) * 30 + 30, size: 2, color: 'rgba(200,225,255,0.9)', life: 0.35, additive: true, kind: 'streak' });
          }
          break;
        case 'wallJump':
          this.audio.play('wallJump');
          this.dust(e.x + e.dir * 10, e.y - 20, 6);
          break;
        case 'land': {
          const k = clamp(e.speed / T.maxFall, 0, 1);
          if (JUICE.squash) r.squash(1 + 0.35 * k, 1 - 0.3 * k);
          if (k > 0.25) {
            this.dust(e.x, e.y, Math.round(4 + k * 10));
            this.audio.play('land', e.speed);
          }
          if (k > 0.9 && e.fallTime > 0.6) this.camera.shake(0.18);
          break;
        }
        case 'waterLand':
          this.splash(e.x, e.y, 10);
          this.audio.play('splash', 0.5);
          break;
        case 'sinking':
          this.audio.play('sinking');
          this.particles.burst(e.x, e.y, 8, { kind: 'ring', color: 'rgba(200,230,255,0.6)', size: 2, grow: 30, speed: 30, life: 0.5 });
          this.hud.showToast("keep moving — you're sinking", 1.4);
          break;
        case 'sink':
          this.splash(e.x, e.y, 14);
          break;
        case 'dash':
          this.audio.play('dash');
          this.hitstop(T.dashFreeze);
          this.particles.burst(e.x - e.dir * 10, e.y - 22, 10, { kind: 'streak', color: 'rgba(160,255,220,0.8)', speed: 220, angle: e.dir > 0 ? Math.PI : 0, spread: 0.6, life: 0.25, size: 1.5, additive: true });
          if (JUICE.squash) r.squash(1.3, 0.8);
          break;
        case 'ghost':
          if (JUICE.afterimages) p.ghosts.push({ rig: snapshotRig(r), x: p.cx, y: p.feetY, facing: p.facing, life: 0.22, color: '#5fd6ff' });
          if (p.onWater) this.particles.add({ x: p.cx, y: p.feetY, vx: -p.dashDir * 80, vy: -120, size: 2, color: 'rgba(200,230,255,0.7)', life: 0.3, grav: 600 });
          break;
        case 'slash':
          this.audio.play('slash', e.dir);
          this.slashes.push(new SlashFx(p));
          if (e.dir === 'side') this.camera.kick(p.facing * 3, 0);
          else this.camera.kick(0, e.dir === 'up' ? -3 : 3);
          break;
        case 'pogo':
          this.audio.play('pogo');
          this.particles.add({ x: e.x, y: e.y + 10, kind: 'ring', size: 6, grow: 160, color: 'rgba(255,255,255,0.8)', life: 0.22, additive: true });
          break;
        case 'clang':
          this.audio.play('clang');
          this.particles.burst(e.x, e.y + 20, 12, { kind: 'streak', color: 'rgb(255,220,160)', speed: 300, life: 0.25, size: 1.5, additive: true, angle: -Math.PI / 2, spread: 2 });
          break;
        case 'floatOpen':
          this.audio.play('floatOpen');
          break;
        case 'hurt':
          this.onPlayerHurt(e);
          break;
        case 'break':
          this.onBarricadeBreak(e.tiles);
          break;
      }
    }
    p.events.length = 0;
  }

  dust(x, y, n) {
    this.particles.burst(x, y - 3, n, { kind: 'smoke', color: this.theme.dust, size: 3, grow: 14, speed: 70, angle: -Math.PI / 2, spread: Math.PI, life: 0.45, drag: 4 });
  }

  onPlayerHurt(e) {
    const p = this.player;
    const drowned = e.hazard && this.lastHazard === 'water';
    this.audio.play(drowned ? 'drown' : 'hurt');
    this.hitstop(T.hitstopHurt);
    this.camera.shake(0.45);
    this.hurtFlash = 1;
    if (drowned) this.splash(p.cx, p.feetY, 22);
    else {
      this.particles.burst(p.cx, p.cy, 18, { kind: 'shard', color: '#ffe6e0', size: 4, speed: 300, life: 0.5, vrot: 10, grav: 400 });
      this.particles.burst(p.cx, p.cy, 10, { color: 'rgb(255,70,80)', speed: 200, life: 0.4, additive: true, size: 2.5 });
    }
    if (this.debug.god) p.hearts = Math.max(p.hearts, 1);
    if (p.hearts <= 0) {
      p.state = 'dead';
      this.deathT = 0;
      this.audio.play('death');
      this.audio.setMusic('none');
    } else if (e.hazard) {
      // flash out, put the player back on the last safe ground
      this.respawning = { t: 0 };
      p.vx = 0;
      p.vy = drowned ? 0 : -200;
    }
  }

  onBarricadeBreak(tiles) {
    this.audio.play('break');
    this.camera.shake(0.5);
    this.hitstop(0.08);
    for (const [tx, ty] of tiles) {
      const x = tx * TILE + 16;
      const y = ty * TILE + 16;
      this.particles.burst(x, y, 6, { kind: 'shard', color: '#3d2416', size: 6, speed: 380, life: 1.1, grav: 1100, vrot: 12, angle: 0, spread: Math.PI * 2 });
      this.particles.burst(x, y, 8, { color: 'rgb(255,150,60)', speed: 260, life: 0.8, additive: true, size: 2 });
      this.stage.broken.push(`${tx},${ty}`);
    }
    this.writeSave();
  }

  // Everything the sword can connect with this frame.
  swordTargets() {
    const targets = [...this.enemies];
    if (this.boss && this.bossActive) {
      if (this.boss.parts) targets.push(...this.boss.parts);
      else targets.push(this.boss);
    }
    return targets;
  }

  resolveCombat() {
    const p = this.player;
    // Player's sword
    if (p.attackT > 0 && p.state === 'normal') {
      const box = p.attackBox();
      for (const e of this.swordTargets()) {
        if (p.hitSet.has(e)) continue;
        if (e.alive === false || (e.isBoss && !e.hurtable)) continue;
        const touching = e.hitBy ? e.hitBy(box) : overlaps(box, e);
        if (!touching) continue;
        p.hitSet.add(e);
        const dirX = p.attackDir === 'side' ? p.facing : sign(e.cx - p.cx) || p.facing;
        if (!e.hurt(1, dirX, this)) continue;
        p.onHitLanded('enemy');
        const killed = e.alive === false;
        this.hitstop(killed ? T.hitstopKill : T.hitstopHit);
        this.camera.shake(killed ? 0.3 : 0.16);
        this.audio.play(e.unkillable ? 'jelly' : killed ? 'kill' : 'hit');
        const ex = e.x ?? e.cx - 10;
        const ey = e.y ?? e.cy - 10;
        const hx = clamp(p.cx + p.facing * 30, ex, ex + (e.w ?? 20));
        const hy = clamp(p.cy, ey, ey + (e.h ?? 20));
        this.particles.burst(hx, hy, 8, { kind: 'streak', color: 'rgb(255,250,235)', speed: 420, life: 0.18, size: 2, additive: true, angle: p.attackDir === 'up' ? -Math.PI / 2 : p.attackDir === 'down' ? Math.PI / 2 : dirX > 0 ? 0 : Math.PI, spread: 1.6 });
        const ink = inkColor(e);
        this.particles.burst(hx, hy, killed ? 22 : 10, { color: ink, size: 3, speed: 240, life: 0.6, grav: 900, additive: ink.startsWith('rgb(') });
      }
      for (const pr of this.projectiles) {
        if (pr.deflectable && !pr.dead && overlaps(box, pr)) {
          pr.deflect(this);
          this.hitstop(0.04);
        }
      }
      if (p.attackDir === 'down' && !p.pogoUsed && this.level.hazardIn(box.x, box.y, box.w, box.h)?.[2] === 'fire') p.onHitLanded('hazard');
    }

    if (p.state !== 'normal' || this.respawning) return;
    const pbox = { x: p.x + 2, y: p.y + 4, w: p.w - 4, h: p.h - 6 };
    const hz = this.level.hazardIn(pbox.x, pbox.y, pbox.w, pbox.h);
    if (p.invuln > 0) {
      // Still can't stand in fire or sink while invulnerable: pull back to safe ground.
      if (hz) {
        if (hz[2] === 'water') this.splash(p.cx, p.feetY, 14);
        this.respawning = { t: 0 };
        p.vx = 0;
      }
      return;
    }
    // Enemy bodies and attacks
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.unkillable && p.pogoGraceT > 0) continue;
      const atk = e.attackBox?.();
      const touched = e.touches ? e.touches(pbox) : (e.contact && overlaps(pbox, e)) || (atk && overlaps(pbox, atk));
      if (touched) {
        p.hurt(e.cx);
        return this.handlePlayerEvents();
      }
    }
    if (this.boss && this.bossActive) {
      const b = this.boss;
      const hit = b.hurtsPlayer ? b.hurtsPlayer(pbox) : b.hitboxes().some((hb) => overlaps(pbox, hb));
      if (hit) {
        p.hurt(b.cx);
        return this.handlePlayerEvents();
      }
    }
    for (const pr of this.projectiles) {
      if (pr.dead || pr.harmless) continue;
      if (overlaps(pbox, pr)) {
        p.hurt(pr.x + pr.w / 2);
        if (pr.deflectable) pr.dead = true;
        return this.handlePlayerEvents();
      }
    }
    if (hz) {
      this.lastHazard = hz[2];
      p.hurt(p.cx, { hazard: true });
      this.handlePlayerEvents();
    }
  }

  updateInteractions(inp) {
    const p = this.player;
    this.nearProp = null;
    if (p.state !== 'normal' || !p.grounded) return;
    for (const pr of this.props) {
      if (pr.kind === 'pickup') {
        if (overlaps(p, pr)) this.collect(pr);
        continue;
      }
      if (pr.kind === 'relic' && !pr.visible) continue;
      const dx = Math.abs(pr.cx - p.cx);
      const sameFloor = Math.abs(pr.floorY - p.feetY) < 40;
      if (pr.kind === 'npc' && !pr.talked && STORY.NPCS[pr.id]?.auto && dx < 110 && sameFloor) {
        this.talk(pr);
        return;
      }
      if (dx < 46 && sameFloor) this.nearProp = pr;
    }
    if (this.nearProp && inp.pressed('up')) this.interact(this.nearProp);
  }

  interact(pr) {
    const p = this.player;
    if (pr.kind === 'lantern') {
      p.place(pr.cx - 26, pr.floorY);
      p.facing = 1;
      p.state = 'rest';
      p.hearts = p.maxHearts;
      const first = !pr.lit;
      pr.lit = true;
      pr.pulse = 0.6;
      this.stage.lantern = pr.id;
      if (!this.stage.lit.includes(pr.id)) this.stage.lit.push(pr.id);
      this.spawnEnemies();
      this.writeSave();
      this.audio.play('rest');
      this.particles.burst(pr.cx, pr.floorY - 60, 24, { color: 'rgb(170,220,255)', additive: true, speed: 90, life: 1.2, grav: -40, size: 2 });
      if (first && this.stage.lit.length === 1 && this.level.chapter === 1) this.dialogue.show(STORY.LANTERN_FIRST);
      else this.hud.showToast('Hearts restored · progress saved');
    } else if (pr.kind === 'npc') this.talk(pr);
    else if (pr.kind === 'note') {
      pr.read = true;
      if (!this.stage.notesRead.includes(pr.id)) this.stage.notesRead.push(pr.id);
      this.dialogue.show(STORY.NOTES[pr.id]);
    } else if (pr.kind === 'relic') {
      this.dialogue.show(STORY.RELIC, () => this.endChapter());
    }
  }

  talk(npc) {
    const info = STORY.NPCS[npc.id];
    const first = !npc.talked;
    npc.talked = true;
    if (!this.stage.talked.includes(npc.id)) this.stage.talked.push(npc.id);
    this.player.vx = 0;
    this.dialogue.show(STORY[first ? info.first : info.after], () => {
      if (first && info.gives && !this.player.abilities[info.gives]) this.grantAbility(info.gives, npc.cx, npc.floorY);
      this.writeSave();
    });
  }

  collect(pr) {
    pr.taken = true;
    this.props = this.props.filter((x) => x !== pr);
    this.grantAbility(pr.ability, pr.cx, pr.floorY);
  }

  grantAbility(ability, x, y) {
    this.player.abilities[ability] = true;
    this.save.abilities[ability] = true;
    this.writeSave();
    this.audio.play('pickup');
    this.particles.burst(x, y - 46, 40, { color: 'rgb(200,230,255)', additive: true, speed: 260, life: 1, size: 2.5, drag: 2 });
    this.cardAbility = ability;
    this.setMode('card');
  }

  updateTriggers(dt) {
    const p = this.player;
    const ptx = p.cx / TILE;
    const pty = p.feetY / TILE;
    for (const z of this.level.zones) {
      if (this.zonesSeen.has(z.title)) continue;
      if (ptx >= z.x0 && ptx <= z.x1 && pty >= z.y0 && pty <= z.y1) {
        this.zonesSeen.add(z.title);
        this.stage.zonesSeen = [...this.zonesSeen];
        this.hud.showArea(z.title, z.sub);
      }
    }
    // Boss
    if (this.boss && !this.bossActive && this.boss.state === 'dormant' && p.cx > this.bossTriggerX && p.grounded && p.state === 'normal' && p.feetY >= this.level.arena.floorY - 40) this.startBoss();
    if (this.bossIntroT !== undefined) {
      this.bossIntroT += dt;
      if (this.bossIntroT > 1.2 && this.bossCardT === undefined) this.bossCardT = 0;
      if (this.bossIntroT > 3.4) {
        this.camera.focus = null;
        p.state = 'normal';
        this.bossIntroT = undefined;
      }
    }
    if (this.bossOutroT !== undefined) {
      this.bossOutroT -= dt;
      if (this.bossOutroT <= 0) {
        this.bossOutroT = undefined;
        this.finishBoss();
      }
    }
    // Chapter end by walking past a marker (Chapter I)
    if (this.stage.bossDefeated && this.chapterEndX && p.cx > this.chapterEndX && this.mode === 'play') this.endChapter();
  }

  startBoss() {
    const p = this.player;
    const b = this.boss;
    this.bossActive = true;
    b.wake();
    p.state = 'cutscene';
    p.vx = 0;
    const a = this.level.arena;
    this.camera.lock = { x0: a.x0, x1: a.x1, y0: a.y0, y1: a.y1 };
    this.camera.focus = { x: (b.cx + p.cx) / 2, y: Math.min(b.y ?? p.cy, p.cy) + 40, rate: 2.5 };
    this.bossIntroT = 0;
    this.bossCardT = undefined;
    this.audio.setMusic(this.theme.music.boss);
    this.audio.setAmbience(0.4);
    if (this.weather.kind) this.weather.intensity = 1.6;
  }

  onBossDefeated() {
    this.audio.play(this.level.chapter === 2 ? 'krakenDie' : 'bossDie');
    this.audio.setMusic('none');
    this.camera.shake(1);
    this.hitstop(0.25);
    this.stage.bossDefeated = true;
    this.writeSave();
    this.projectiles = [];
    this.bossOutroT = 4.2; // runs on game time, see updateTriggers (after the death throes)
  }

  // Permanent world changes once the chapter's boss is gone.
  afterBossWorldChanges() {
    if (this.level.chapter === 1) this.level.setGate(true);
    if (this.level.chapter === 2) {
      // The maelstrom settles: the arena's whitewater turns calm and walkable.
      const a = this.level.arena;
      for (let y = a.rows[0]; y <= a.rows[1]; y++) for (let x = a.roughX0; x <= a.roughX1; x++) if (this.level.tileAt(x, y) === '%') this.level.setTile(x, y, '~');
    }
  }

  finishBoss() {
    this.bossActive = false;
    this.camera.lock = null;
    this.afterBossWorldChanges();
    if (this.relic) this.relic.visible = true;
    if (this.weather.kind) this.weather.intensity = 0.5;
    this.audio.play('gate');
    this.audio.setAmbience(1);
    this.dialogue.show(this.chapterInfo.bossDefeated, () => this.audio.setMusic('victory'));
  }

  endChapter() {
    if (this.mode !== 'play') return;
    if (!this.save.completed.includes(this.level.chapter)) this.save.completed.push(this.level.chapter);
    this.writeSave();
    this.setMode('chapterEnd');
    this.audio.setMusic('victory');
  }

  advanceChapter() {
    const next = this.level.chapter + 1;
    if (CHAPTERS[next]) {
      this.save.chapter = next;
      this.save.stage = freshStage();
      this.writeSave();
      this.newWorld(this.readSave());
      this.setMode('opening');
      this.applyThemeAudio();
    } else {
      this.newWorld(this.readSave());
      this.buildTitleMenu();
      this.setMode('title');
      this.applyThemeAudio();
    }
  }

  updateDeathAndRespawn(dt) {
    const p = this.player;
    if (this.respawning) {
      const r = this.respawning;
      r.t += dt;
      if (r.t > 0.35 && !r.moved) {
        r.moved = true;
        p.place(p.lastSafe.x, p.lastSafe.y);
        p.invuln = T.hurtInvuln;
      }
      if (r.t > 0.7) this.respawning = null;
    }
    if (p.state === 'dead') {
      this.deathT += dt;
      if (this.deathT > 0.2 && this.deathT - dt <= 0.2) this.particles.burst(p.cx, p.cy, 30, { color: 'rgb(255,80,90)', additive: true, speed: 200, life: 1, size: 2 });
      if (this.deathT > 2.3) this.respawnAtLantern();
    }
  }

  respawnAtLantern() {
    const p = this.player;
    const l = this.stage.lantern && this.lanterns[this.stage.lantern];
    if (l) p.place(l.cx - 26, l.floorY);
    else p.place(this.startPos.x, this.startPos.y);
    p.hearts = p.maxHearts;
    p.state = 'normal';
    p.invuln = 1;
    this.projectiles = [];
    this.respawning = null;
    this.spawnEnemies();
    this.spawnBoss();
    this.camera.lock = null;
    this.camera.focus = null;
    this.bossIntroT = undefined;
    this.bossCardT = undefined;
    if (this.weather.kind) this.weather.intensity = this.stage.bossDefeated ? 0.5 : 1;
    this.camera.snap(p.cx, p.cy, this.level.camBounds);
    this.applyThemeAudio();
    this.audio.setAmbience(1);
    this.fadeIn = 1;
    this.deathT = 0;
  }

  openPause() {
    this.pauseMenu = new Menu([
      { label: 'Resume', action: () => this.setMode('play') },
      { label: 'Controls', action: () => (this.showControls = true) },
      {
        label: 'Return to Lantern',
        action: () => {
          this.setMode('play');
          this.respawnAtLantern();
        },
      },
      {
        label: 'Quit to Title',
        action: () => {
          this.newWorld(this.readSave());
          this.buildTitleMenu();
          this.setMode('title');
          this.applyThemeAudio();
        },
      },
    ]);
    this.setMode('paused');
    this.audio.play('ui');
  }

  // ── Render ──────────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    const S = this.scale;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = true;

    if (this.mode === 'opening') {
      drawOpening(ctx, this.chapterInfo.opening, this.modeT, this.level.chapter > 1 ? this.chapterInfo.title : null);
      return;
    }

    this.renderWorld(ctx);

    ctx.setTransform(S, 0, 0, S, 0, 0);
    this.weather.draw(ctx);
    this.renderPost(ctx);

    if (this.mode === 'title') {
      drawTitle(ctx, this.modeT, this.titleMenu, this.showControls, this.chapterInfo.title, this.chapterInfo.accent);
      return;
    }
    this.hud.draw(ctx, this);
    if (this.bossCardT !== undefined && this.boss) drawBossCard(ctx, this.boss.name, this.boss.title, this.bossCardT);
    this.dialogue.draw(ctx, this.time);
    if (this.player.state === 'dead') drawDeath(ctx, this.deathT);
    if (this.respawning) {
      const k = this.respawning.t;
      ctx.fillStyle = `rgba(4,2,6,${clamp(Math.min(k / 0.3, (0.7 - k) / 0.35), 0, 1)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.fadeIn > 0) {
      ctx.fillStyle = `rgba(4,2,6,${this.fadeIn})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (this.mode === 'card') drawAbilityCard(ctx, this.cardAbility, this.modeT);
    if (this.mode === 'paused') drawPause(ctx, this.pauseMenu, this.time, this.showControls);
    if (this.mode === 'chapterEnd') drawChapterEnd(ctx, this.chapterInfo.end, this.modeT, this.level.chapter < LAST_CHAPTER);
  }

  renderWorld(ctx) {
    const S = this.scale;
    const cam = this.camera;
    const left = cam.left;
    const top = cam.top;
    const view = { x0: left, y0: top, x1: left + VIEW_W, y1: top + VIEW_H };
    const t = this.time;

    this.background.draw(ctx, left, top, t, this.weather);

    if (!this.worldLayer || this.worldLayer.width !== this.canvas.width || this.worldLayer.height !== this.canvas.height) {
      this.worldLayer = document.createElement('canvas');
      this.worldLayer.width = this.canvas.width;
      this.worldLayer.height = this.canvas.height;
    }
    const w = this.worldLayer.getContext('2d');
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.clearRect(0, 0, this.worldLayer.width, this.worldLayer.height);
    w.setTransform(S, 0, 0, S, -left * S, -top * S);
    this.decos.draw(w, view);
    this.decos.drawFires(w, view, t, 'decos');
    this.terrain.draw(w, left, top, VIEW_W, VIEW_H);
    this.drawTracks(w, view);
    this.decos.drawFires(w, view, t, 'tiles');
    this.drawHints(w);

    for (const pr of this.props) pr.draw(w, this);
    if (this.boss && (this.bossActive || this.boss.state === 'dying' || this.boss.state === 'dormant') && !this.boss.dead) this.boss.draw(w, this);
    for (const g of this.geysers) g.draw(w, this);
    for (const pl of this.platforms) pl.draw(w, this);
    for (const e of this.enemies) e.draw(w, this);
    if (!(this.player.state === 'dead' && this.deathT > 0.25)) this.player.draw(w);
    for (const pr of this.projectiles) pr.draw(w, this);
    this.water.draw(w, view, t);
    this.particles.draw(w, view);
    if (this.debug.hitboxes) this.drawHitboxes(w);

    if (JUICE.lighting) {
      const lights = [];
      const p = this.player;
      lights.push({ x: p.cx, y: p.cy - 10, r: 250, color: this.theme.playerLight, i: 0.95 });
      this.decos.collectLights(view, lights, t);
      for (const pr of this.props) pr.light?.(lights);
      for (const e of this.enemies) e.light?.(lights);
      for (const g of this.geysers) g.light?.(lights);
      for (const pl of this.platforms) pl.light?.(lights);
      if (this.boss && !this.boss.dead && this.boss.state !== 'dormant') this.boss.light(lights);
      for (const pr of this.projectiles) pr.light?.(lights);
      this.lighting.ambient = this.weather.flash > 0 ? mixAmbient(this.theme.ambient, this.weather.flash) : this.theme.ambient;
      this.lighting.render(lights, left, top);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.worldLayer, 0, 0);
    // Light the whole frame — sky included — for the deep, moody look.
    if (JUICE.lighting) {
      ctx.setTransform(S, 0, 0, S, 0, 0);
      this.lighting.apply(ctx);
    }

    // Glowing things that should punch through the darkness
    ctx.setTransform(S, 0, 0, S, -left * S, -top * S);
    for (const s of this.slashes) s.draw(ctx);
    this.particles.draw(ctx, view, 'over');
    if (this.nearProp && this.player.state === 'normal' && !this.dialogue.active) {
      const pr = this.nearProp;
      drawPrompt(ctx, pr.cx, pr.floorY - (pr.kind === 'lantern' ? 116 : 76), pr.prompt, t);
    }
  }

  drawTracks(ctx, view) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let i = 0;
    for (const tr of this.level.tracks) {
      i++;
      if (tr.x < view.x0 - 20 || tr.x > view.x1 + 20 || tr.y < view.y0 || tr.y > view.y1 + 20) continue;
      if (this.level.tileAt(Math.floor(tr.x / TILE), Math.floor(tr.y / TILE)) === '^') continue;
      const off = i % 2 ? -3 : 3;
      const pulse = 0.35 + 0.2 * Math.sin(this.time * 2 + i * 0.7);
      ctx.fillStyle = `rgba(150,80,255,${pulse})`;
      ctx.beginPath();
      ctx.ellipse(tr.x, tr.y + 1.5 + off * 0.2, 5, 1.8, 0, 0, Math.PI * 2);
      ctx.ellipse(tr.x + 6, tr.y + 1.2 + off * 0.2, 2, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHints(ctx) {
    const p = this.player;
    ctx.font = `italic 17px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    for (const h of this.level.hints) {
      const d = Math.hypot(p.cx - h.x, p.cy - h.y);
      const a = clamp(1 - (d - 140) / 160, 0, 1);
      if (a <= 0) continue;
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#f2e6d4';
      ctx.fillText(h.text, h.x, h.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  drawHitboxes(ctx) {
    ctx.lineWidth = 1;
    const p = this.player;
    ctx.strokeStyle = '#0f0';
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    if (p.attackT > 0) {
      const b = p.attackBox();
      ctx.strokeStyle = '#ff0';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    ctx.strokeStyle = '#f0f';
    for (const e of this.enemies) {
      if (e.points) {
        for (const [x, y, r] of e.points()) {
          ctx.beginPath();
          ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        }
        continue;
      }
      ctx.strokeRect(e.x, e.y, e.w, e.h);
      const a = e.attackBox?.();
      if (a) ctx.strokeRect(a.x, a.y, a.w, a.h);
    }
    if (this.boss && this.bossActive && this.boss.hitboxes) for (const hb of this.boss.hitboxes()) ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    ctx.strokeStyle = '#0ff';
    for (const pl of this.platforms) if (pl.solid) ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
    ctx.strokeStyle = '#f80';
    for (const pr of this.projectiles) ctx.strokeRect(pr.x, pr.y, pr.w, pr.h);
  }

  renderPost(ctx) {
    // Vignette
    const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, this.theme.vignette);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Damage flash
    if (this.hurtFlash > 0) {
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
      g.addColorStop(0, 'rgba(200,0,30,0)');
      g.addColorStop(1, `rgba(200,0,30,${0.45 * this.hurtFlash})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // Low-health pulse
    const p = this.player;
    if (p.hearts === 1 && p.state !== 'dead' && this.mode === 'play') {
      ctx.fillStyle = `rgba(120,0,20,${0.08 + Math.sin(this.time * 5) * 0.05})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }
}

function snapshotRig(r) {
  const g = new NinjaRig(r.style);
  g.pose = { ...r.pose, armF: [...r.pose.armF], armB: [...r.pose.armB], legF: [...r.pose.legF], legB: [...r.pose.legB] };
  g.sx = r.sx;
  g.sy = r.sy;
  g.computeJoints();
  return g;
}

function inkColor(e) {
  if (e.unkillable) return 'rgb(120,230,255)';
  if (e instanceof Kappa) return '#2a5a40';
  if (e instanceof Tentacle) return '#2a0a20';
  if (e instanceof EmberCrow) return e.variant === 'storm' ? 'rgb(150,210,255)' : 'rgb(255,120,50)';
  if (e.isBoss) return 'rgb(255,120,50)';
  if (e.hitBy) return '#2a0a20'; // kraken parts
  return '#3a1468';
}

// Lightning brightens the ambient light for a heartbeat.
function mixAmbient(rgb, k) {
  const m = rgb.match(/\d+/g).map(Number);
  const f = (c, t) => Math.round(c + (t - c) * Math.min(1, k * 0.8));
  return `rgb(${f(m[0], 200)},${f(m[1], 215)},${f(m[2], 240)})`;
}

// v1 saves (Chapter I only) → v2 (per-chapter stage state).
function migrateSave(s) {
  if (!s) return null;
  if (s.version === 2) return s;
  return {
    version: 2,
    chapter: 1,
    completed: s.bossDefeated ? [1] : [],
    abilities: s.abilities || {},
    stage: {
      lantern: s.lantern ?? null,
      lit: s.lit || [],
      notesRead: s.notesRead || [],
      talked: s.elderTalked ? ['elder'] : [],
      bossDefeated: !!s.bossDefeated,
      broken: s.barricade ? ['151,15', '151,16', '151,17', '151,18', '152,15', '152,16', '152,17', '152,18'] : [],
      zonesSeen: s.zonesSeen || [],
    },
  };
}
