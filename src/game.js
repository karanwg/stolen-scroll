import { TILE, VIEW_W, VIEW_H, TUNING as T, JUICE } from './config.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { Camera } from './core/camera.js';
import { clamp, overlaps, rand, sign } from './core/math.js';
import { buildStage1 } from './world/stage1.js';
import { buildStage2 } from './world/stage2.js';
import { buildStage3 } from './world/stage3.js';
import { Player } from './entities/player.js';
import { Blade, Thrower, EmberCrow } from './entities/enemies.js';
import { Balrog } from './entities/balrog.js';
import { Kraken } from './entities/kraken.js';
import { Xenomorph, Suction } from './entities/xenomorph.js';
import { Door, SteamJet, ArcGate, LockerScare, Corpse, Chestburster, Mist } from './entities/ship.js';
import { Spearman, ShurikenThrower, YukiOnna, Icicle, WindZone, Bell, SnowMonkey } from './entities/snow.js';
import { Egg, Facehugger, Drone } from './entities/alien.js';
import { drawXeno } from './render/xenoArt.js';
import { FloatPlatform, Geyser, Jelly, Kappa, Tentacle } from './entities/sea.js';
import { Lantern, Elder, Ferryman, WoundedBinoshi, Monk, CocoonNPC, Note, Pickup, Relic } from './entities/props.js';
import { Particles } from './fx/particles.js';
import { glow } from './render/shapes.js';
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
  2: { build: buildStage2, opening: STORY.OPENING_2, title: 'Chapter II — The Drowned Coast', end: STORY.CHAPTER_END_2, bossDefeated: STORY.BOSS_DEFEATED_2, relic: STORY.RELIC, accent: 'rgb(90,170,255)', requires: ['doubleJump', 'dash'] },
  3: { build: buildStage3, opening: STORY.OPENING_3, title: 'Chapter III — The Fallen Star', end: STORY.CHAPTER_END_3, bossDefeated: STORY.BOSS_DEFEATED_3, relic: STORY.LAST_PAGE, accent: 'rgb(130,255,190)', requires: ['doubleJump', 'dash', 'waterWalk', 'float'] },
};
const LAST_CHAPTER = 3;

const freshStage = () => ({ lantern: null, lit: [], notesRead: [], talked: [], bossDefeated: false, broken: [], zonesSeen: [], bells: [], gauntlets: [], scares: [], powerOut: false });

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
    this.input.attachMouse(canvas, VIEW_W, VIEW_H);
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
    return this.currentTheme || this.level.theme;
  }

  // Backgrounds are cached per theme so moving between zones can crossfade.
  backgroundFor(theme) {
    this.backgrounds ||= {};
    const key = `${theme.sky}@${this.scale}`;
    return (this.backgrounds[key] ||= new Background(this.scale, theme.sky));
  }

  // Called when the camera crosses into a differently themed part of the level.
  switchTheme(theme, instant = false) {
    if (this.currentTheme === theme) return;
    const prev = this.currentTheme;
    this.currentTheme = theme;
    this.prevBackground = !instant && prev ? this.backgroundFor(prev) : null;
    this.bgFade = this.prevBackground ? 1 : 0;
    this.background = this.backgroundFor(theme);
    if (!this.weather || this.weather.kind !== theme.weather) {
      this.weather = new Weather(theme.weather);
      this.weather.onThunder = (delay) => this.audio.play('thunder', delay);
    }
    if (!instant) this.applyThemeAudio();
  }

  buildRenderers() {
    this.backgrounds = {};
    this.background = this.backgroundFor(this.theme);
    this.terrain = new TerrainRenderer(this.level, this.scale);
    this.decos = new DecoLayer(this.level, this.scale);
    this.water = new WaterRenderer(this.level);
  }

  applyThemeAudio() {
    // with the Tethys's power gone, its hum and its music go with it
    const dark = this.theme.id === 'ship' && this.stage?.powerOut;
    this.audio.setMusic(this.bossActive ? this.theme.music.boss : dark ? 'derelict' : this.theme.music.explore);
    this.audio.setAmbienceType(dark ? 'derelict' : this.theme.ambience);
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
    this.currentTheme = null;
    this.buildRenderers();
    this.weather = null;
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
    this.anchors = [];
    this.winds = [];
    this.gauntlets = [];
    this.bellGates = [];
    this.scares = [];
    this.shadows = [];
    this.doors = [];
    this.mists = [];
    this.actors = []; // harmless things moving through the world (a falling body, a chestburster)
    this.passBehind = null;
    this.tilt = 0;
    this.tiltTarget = 0;
    this.arenaWind = null;
    this.stage.scares ||= [];
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
        case 'binoshi':
        case 'monk':
        case 'cocooned': {
          const C = { elder: Elder, ferryman: Ferryman, binoshi: WoundedBinoshi, monk: Monk, cocooned: CocoonNPC }[e.type];
          const npc = new C(e.x, e.y);
          npc.talked = this.stage.talked.includes(npc.id);
          if (npc.id === 'cocooned') npc.burst = npc.talked;
          this.props.push(npc);
          break;
        }
        case 'note': {
          const n = new Note(e.x, e.y, e.id, e.look);
          n.read = this.stage.notesRead.includes(e.id);
          this.props.push(n);
          break;
        }
        case 'pickup':
          if (!this.save.abilities[e.ability]) this.props.push(new Pickup(e.x, e.y, e.ability));
          break;
        case 'relic':
          this.relic = new Relic(e.x, e.y, e.look);
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
        case 'steam':
          this.geysers.push(new Geyser(e.x, e.y, { height: e.height, period: e.period, offset: e.offset, look: 'steam' }));
          break;
        case 'wind':
          this.winds.push(new WindZone({ x0: e.x - 16, y0: e.y, x1: e.x1 * TILE, y1: e.y1 * TILE, dir: e.dir, strength: e.strength, period: e.period, gust: e.gust }));
          break;
        case 'gauntlet':
          if (!this.stage.gauntlets.includes(e.id)) this.gauntlets.push({ ...e, state: 'idle' });
          else if (e.reward && !this.save.abilities[e.reward.ability]) this.props.push(new Pickup(e.reward.x * TILE + 16, e.y, e.reward.ability));
          break;
        case 'bellGate':
          this.bellGates.push(e);
          if (this.stage.bells.filter((b) => b.startsWith(e.set + ':')).length >= 3) for (const [x, y] of e.tiles) this.level.setTile(x, y, '.');
          else for (const [x, y] of e.tiles) this.level.setTile(x, y, 'G');
          break;
        case 'scare':
          this.scares.push({ ...e, done: this.stage.scares.includes(`${e.kind}@${e.x}`) });
          break;
        case 'door': {
          const d = new Door(Math.floor(e.x / TILE), Math.round(e.y / TILE), e.rows || 4, { label: e.label });
          d.setTiles(this.level);
          this.doors.push(d);
          break;
        }
        case 'mist':
          this.mists.push(new Mist(e.x - 16, (e.x1 + 1) * TILE, e.y));
          break;
        case 'balrog':
        case 'kraken':
        case 'xeno':
          this.bossSpawn = e;
          break;
        case 'anchor':
          this.anchors.push({ x: e.x, y: e.y + (e.dy ?? 16), kind: e.kind || 'ring' });
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
    // Resuming past an ability shrine you never stood at (an older save): you have it anyway.
    if (lantern) {
      for (const pr of this.props.filter((x) => x.kind === 'pickup' && x.cx < lantern.cx)) {
        this.player.abilities[pr.ability] = true;
        this.save.abilities[pr.ability] = true;
        this.props = this.props.filter((x) => x !== pr);
        this.writeSave();
      }
    }
    this.camera.lock = null;
    this.camera.focus = null;
    this.camera.snap(this.player.cx, this.player.cy, this.level.camBounds);
    this.switchTheme(this.level.themeAt(this.camera.x), true);
    this.zonesSeen = new Set(this.stage.zonesSeen);
    this.respawning = null;
    this.deathT = 0;
  }

  // Re-creates the level's enemies. Meditating at a lantern passes `keepNear`:
  // nothing is re-spawned in that radius (what's there and alive stays put).
  spawnEnemies(keepNear = null) {
    const old = this.enemies || [];
    this.enemies = [];
    const near = (x, y) => keepNear && Math.abs(x - keepNear.x) < keepNear.r && Math.abs(y - keepNear.y) < keepNear.r * 0.75;
    const kept = new Set();
    if (keepNear) {
      for (const en of old) {
        if (en.spawnIdx === undefined || en.dead) continue;
        const sp = this.spawns[en.spawnIdx];
        if (!near(en.cx, en.cy ?? en.y) && !near(sp.x, sp.y)) continue;
        this.enemies.push(en);
        kept.add(en.spawnIdx);
      }
    }
    this.spawns.forEach((e, idx) => {
      if (keepNear && (kept.has(idx) || near(e.x, e.y))) return;
      const before = this.enemies.length;
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
        case 'spear':
          this.enemies.push(new Spearman(e.x, e.y));
          break;
        case 'shuriken':
          this.enemies.push(new ShurikenThrower(e.x, e.y));
          break;
        case 'yuki':
          this.enemies.push(new YukiOnna(e.x, e.y));
          break;
        case 'icicle':
          this.enemies.push(new Icicle(e.x, e.y));
          break;
        case 'bell': {
          const bell = new Bell(e.x, e.y, e.set);
          bell.id = e.id;
          bell.rung = this.stage.bells.includes(`${e.set}:${e.id}`);
          this.enemies.push(bell);
          break;
        }
        case 'monkey':
          this.enemies.push(new SnowMonkey(e.x, e.y));
          break;
        case 'egg':
          this.enemies.push(new Egg(e.x, e.y));
          break;
        case 'hugger':
          this.enemies.push(new Facehugger(e.x, e.y));
          break;
        case 'drone':
          this.enemies.push(new Drone(e.x, e.y));
          break;
        case 'steamJet':
          this.enemies.push(new SteamJet(e.x, e.y, { dir: e.dir, len: e.len, period: e.period, offset: e.offset }));
          break;
        case 'arc':
          this.enemies.push(new ArcGate(e.x, e.y0 * TILE, e.y, { period: e.period, offset: e.offset }));
          break;
        case 'locker': {
          const l = new LockerScare(e.x, e.y);
          if (this.stage.scares.includes(`locker@${e.x}`)) l.burst = true;
          l.key = `locker@${e.x}`;
          this.enemies.push(l);
          break;
        }
      }
      for (let k = before; k < this.enemies.length; k++) this.enemies[k].spawnIdx = idx;
    });
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
    } else if (e.type === 'xeno') {
      this.boss = new Xenomorph(e.x, e.y, this.level.arena);
      this.arenaWind = null;
      this.tiltTarget = 0;
      const d = this.level.arena.door;
      for (let y = d.y0; y <= d.y1; y++) for (let x = d.x0; x <= d.x1; x++) this.level.setTile(x, y, 'D');
      this.setHatch(false);
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

    const menu = this.mode === 'title' && !this.showControls ? this.titleMenu : this.mode === 'paused' && !this.showControls ? this.pauseMenu : null;
    const cursor = menu ? (menu.itemAt(inp.mouse) >= 0 ? 'pointer' : 'default') : this.mode === 'play' ? 'none' : 'default';
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;

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
        if (this.modeT > 1 && (inp.pressed('jump') || inp.pressed('confirm') || inp.pressed('attack') || inp.clicked)) this.setMode('play');
        return;
      case 'chapterEnd':
        this.particles.update(dt);
        if (this.modeT > 4 && (inp.pressed('confirm') || inp.pressed('jump') || inp.clicked)) this.advanceChapter();
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
    this.updateWinds(dt);

    p.hookTarget = p.abilities.kaginawa && !p.hook ? this.findHookTarget(p) : null;
    const playerInput = p.state === 'cutscene' || this.respawning ? NO_INPUT : inp;
    p.step(dt, playerInput, this.level);
    if (p.sprinting && p.grounded && Math.random() < 0.5) {
      this.particles.add({ x: p.cx - p.facing * 8, y: p.feetY - 2, vx: -p.vx * 0.15, vy: rand(-60, -20), kind: 'smoke', size: 2, grow: 10, color: this.theme.dust, life: 0.35 });
      if (Math.random() < 0.3) this.particles.add({ x: p.cx - p.facing * 14, y: p.cy + rand(-14, 14), vx: -p.facing * 260, vy: 0, kind: 'streak', size: 1, color: 'rgba(200,230,255,0.5)', life: 0.15, additive: true });
    }
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
    if (this.boss && (this.bossActive || ['dying', 'falling'].includes(this.boss.state))) this.boss.update(dt, this);
    // Phase three: keep the door (and what's going out of it) in frame.
    const xb = this.level.chapter === 3 && this.bossActive && this.boss && !this.boss.dead && (this.arenaWind || ['falling', 'breakout'].includes(this.boss.state)) ? this.boss : null;
    if (xb) {
      const a = this.level.arena;
      this.camera.lock = { x0: a.x0, x1: a.x1 + 260, y0: a.y0, y1: a.y1 };
      this.camera.focus = { x: clamp((p.cx + xb.cx) / 2 + 120, a.x0 + 480, a.x1 - 220), y: a.floorY - 230, rate: 3 };
    }
    for (const pr of this.projectiles) pr.update(dt, this);
    this.projectiles = this.projectiles.filter((pr) => !pr.dead);
    for (const s of this.slashes) s.update(dt);
    this.slashes = this.slashes.filter((s) => !s.dead);
    for (const pr of this.props) pr.update?.(dt, this);
    for (const d of this.doors) d.update(dt, this);
    for (const a of this.actors) a.update(dt, this);
    this.actors = this.actors.filter((a) => !a.dead);
    for (const m of this.mists) m.update(dt);
    if (this.passBehind) {
      this.passBehind.t += dt;
      if (this.passBehind.t > this.passBehind.dur) this.passBehind = null;
    }
    this.tilt += (this.tiltTarget - this.tilt) * Math.min(1, dt * 1.5);

    this.resolveCombat();
    this.updateInteractions(inp);
    this.updateTriggers(dt);
    this.updateGauntlets(dt);
    this.updateScares(dt);
    this.updateDeathAndRespawn(dt);

    const fallFlag = p.fallTime > T.fallCamDelay;
    this.camera.update(dt, p, this.level.camBounds, fallFlag);
    this.ambientWorld(dt);
    // crossing into a differently themed part of the level
    const zoneTheme = this.level.themeAt(this.camera.x);
    if (zoneTheme !== this.currentTheme) this.switchTheme(zoneTheme);
    if (this.bgFade > 0) this.bgFade = Math.max(0, this.bgFade - dt * 0.8);

    // Fire ambience swells as you approach flames.
    this.fireCheckT = (this.fireCheckT || 0) - dt;
    if (this.fireCheckT <= 0 && this.theme.ambience === 'fire') {
      this.fireCheckT = 0.15;
      const d = this.decos.nearestFire(p.cx, p.cy);
      this.audio.setFireProximity(clamp(1 - (d - 60) / 420, 0, 1));
    }
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
    } else if (this.theme.particles === 'dust') {
      // dust hanging in the recycled air, catching your lantern
      if (Math.random() < dt * 10) this.particles.add({ x: left + rand(0, VIEW_W), y: top + rand(0, VIEW_H), vx: rand(-5, 5), vy: rand(-4, 4), size: rand(0.6, 1.3), color: 'rgba(200,200,190,0.45)', life: rand(3, 6), fadeIn: true });
    } else if (this.theme.particles === 'snow' || this.theme.particles === 'spores') {
      // steam off hot springs and vents
      for (const st of this.decos.steam) {
        if (st.x < left - 100 || st.x > left + VIEW_W + 100 || st.y < top - 100 || st.y > top + VIEW_H + 100) continue;
        if (Math.random() < dt * 6) this.particles.add({ x: st.x + rand(-st.w / 2, st.w / 2), y: st.y, vx: rand(-10, 10), vy: rand(-40, -20), kind: 'smoke', size: rand(8, 14), grow: 18, color: 'rgba(230,235,245,0.14)', life: rand(2, 3), fadeIn: true });
      }
      if (this.theme.particles === 'spores' && Math.random() < dt * 8) {
        this.particles.add({ x: left + rand(0, VIEW_W), y: top + rand(0, VIEW_H), vx: rand(-6, 6), vy: rand(-6, 6), size: rand(0.8, 1.6), color: 'rgba(160,230,200,0.5)', life: rand(3, 6), fadeIn: true });
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
      this.camera.x = (ch === 3 ? 7600 : ch === 2 ? 5600 : 3000) + Math.sin(this.time * 0.05) * 600;
      this.camera.y = ch === 3 ? 1150 : ch === 2 ? 1250 : 980;
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
          this.hitstop(T.dashFreeze);
          if (JUICE.squash) r.squash(1.3, 0.8);
          if (e.shadow) {
            // shadow dash: the body comes apart into black smoke
            this.audio.play('shadowDash');
            this.particles.burst(e.x, e.y - 24, 18, { kind: 'smoke', color: 'rgba(8,4,14,0.8)', size: 5, grow: 26, speed: 140, life: 0.6, drag: 3 });
            this.particles.add({ x: e.x, y: e.y - 24, kind: 'ring', size: 8, grow: 120, color: 'rgba(150,110,255,0.5)', life: 0.3, additive: true });
          } else {
            this.audio.play('dash');
            this.particles.burst(e.x - e.dir * 10, e.y - 22, 10, { kind: 'streak', color: 'rgba(120,200,255,0.9)', speed: 240, angle: e.dir > 0 ? Math.PI : 0, spread: 0.6, life: 0.25, size: 1.5, additive: true });
            this.particles.add({ x: e.x, y: e.y - 24, kind: 'ring', size: 6, grow: 90, color: 'rgba(110,190,255,0.7)', life: 0.2, additive: true });
          }
          break;
        case 'shadowReady':
          this.audio.play('shadowReady');
          this.particles.burst(p.cx, p.cy, 8, { kind: 'smoke', color: 'rgba(10,6,18,0.6)', size: 3, grow: 12, speed: 50, life: 0.5, drag: 2 });
          break;
        case 'ghost':
          if (JUICE.afterimages) {
            if (p.shadowDash) p.ghosts.push({ rig: snapshotRig(r), x: p.cx, y: p.feetY, facing: p.facing, life: 0.32, color: '#05030a', dark: true });
            else p.ghosts.push({ rig: snapshotRig(r), x: p.cx, y: p.feetY, facing: p.facing, life: 0.22, color: '#4aa8ff' });
          }
          if (p.shadowDash && Math.random() < 0.7) this.particles.add({ x: p.cx + rand(-8, 8), y: p.cy + rand(-16, 16), vx: -p.dashDir * 40, vy: rand(-30, 10), kind: 'smoke', size: 3, grow: 14, color: 'rgba(8,4,14,0.55)', life: 0.45 });
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
        case 'hookFire':
          this.audio.play('hookFire');
          break;
        case 'hookAttach':
          this.audio.play('hookAttach');
          this.particles.burst(e.ax, e.ay, 8, { kind: 'streak', color: 'rgb(255,230,190)', speed: 160, life: 0.2, size: 1.4, additive: true });
          this.camera.kick((e.ax - p.cx) * 0.01, -2);
          break;
        case 'hookRelease':
          this.audio.play('hookRelease');
          break;
        case 'hookJump':
          this.audio.play('airJump');
          if (JUICE.squash) r.squash(0.8, 1.25);
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

  // ── Chapter III systems ─────────────────────────────────────
  updateWinds(dt) {
    const p = this.player;
    let gust = 0;
    let dir = 1;
    p.windX = 0;
    const zones = this.arenaWind ? [...this.winds, this.arenaWind] : this.winds;
    for (const w of zones) {
      w.update(dt, this);
      if (w.contains(p)) {
        const f = w.force;
        p.windX += f;
        if (Math.abs(f) / w.strength > gust) {
          gust = Math.abs(f) / w.strength;
          dir = w.dir;
        }
      }
    }
    if (this.weather) {
      this.weather.gust = gust;
      this.weather.gustDir = dir;
    }
  }

  // Ambush arenas: walls go up, waves pour in, the reward drops when it's over.
  updateGauntlets(dt) {
    const p = this.player;
    for (const g of this.gauntlets) {
      if (g.state === 'idle') {
        if (p.cx > (g.x0 + 2) * TILE && p.cx < g.x1 * TILE && p.grounded && p.state === 'normal') this.startGauntlet(g);
      } else if (g.state === 'fighting') {
        g.t -= dt;
        const alive = g.live.filter((e) => !e.dead && e.alive !== false);
        if (alive.length === 0 && g.t <= 0) {
          g.wave++;
          if (g.wave >= g.waves.length) this.finishGauntlet(g);
          else {
            g.t = 0.8;
            this.spawnWave(g);
          }
        }
      }
    }
  }

  startGauntlet(g) {
    g.state = 'fighting';
    g.wave = 0;
    g.t = 0.6;
    for (const [x, y0, y1] of g.gates) for (let y = y0; y <= y1; y++) this.level.setTile(x, y, 'G');
    this.camera.lock = { x0: (g.x0 - 1) * TILE, x1: (g.x1 + 1) * TILE, y0: this.level.camBounds.y0, y1: this.level.camBounds.y1 };
    this.audio.play('gateClose');
    this.audio.play('roar');
    this.audio.setMusic(this.theme.music.boss === 'xeno' ? 'ambush' : this.theme.music.boss);
    this.hud.showArea('Ambush', 'the Binoshi want their camp back');
    this.camera.shake(0.4);
    this.spawnWave(g);
  }

  spawnWave(g) {
    g.live = [];
    for (const w of g.waves[g.wave]) {
      const x = w.x * TILE + 16;
      const C = { blade: Blade, spear: Spearman, shuriken: ShurikenThrower }[w.type];
      const e = new C(x, g.y);
      e.y -= 120; // they drop in from the cliffs
      g.live.push(e);
      this.enemies.push(e);
      this.particles.burst(x, g.y - 140, 18, { kind: 'smoke', color: 'rgba(90,50,140,0.7)', size: 6, grow: 30, speed: 140, life: 0.7, drag: 2 });
    }
    this.audio.play('spawn');
  }

  finishGauntlet(g) {
    g.state = 'done';
    for (const [x, y0, y1] of g.gates) for (let y = y0; y <= y1; y++) this.level.setTile(x, y, '.');
    this.camera.lock = null;
    this.stage.gauntlets.push(g.id);
    this.writeSave();
    this.applyThemeAudio();
    this.audio.play('gate');
    if (g.reward && !this.player.abilities[g.reward.ability]) {
      const pk = new Pickup(g.reward.x * TILE + 16, g.y, g.reward.ability);
      this.props.push(pk);
      this.particles.burst(pk.cx, g.y - 50, 30, { color: 'rgb(255,220,160)', additive: true, speed: 200, life: 1, size: 2.5 });
    }
    this.hud.showToast('The camp falls silent');
  }

  // Dev-only teleport (tuning panel + console harness): leaves no fight,
  // chase or camera lock behind, and snaps straight to the zone's theme.
  devWarp(tx, ty) {
    if (this.bossActive && this.boss && this.boss.alive) this.spawnBoss();
    this.resetGauntlets();
    this.camera.lock = null;
    this.camera.focus = null;
    this.bossIntroT = undefined;
    this.bossCardT = undefined;
    this.respawning = null;
    this.passBehind = null;
    this.revealT = 0;
    // scares you've warped past don't all go off at once
    for (const sc of this.scares) if (sc.x < tx * TILE) sc.done = true;
    const p = this.player;
    p.state = 'normal';
    p.invuln = 0;
    p.hook = null;
    p.sprinting = false;
    p.place(tx * TILE + 16, ty * TILE);
    this.camera.snap(p.cx, p.cy, this.level.camBounds);
    this.switchTheme(this.level.themeAt(this.camera.x), true);
    this.prevBackground = null;
    this.bgFade = 0;
    this.applyThemeAudio();
  }

  resetGauntlets() {
    for (const g of this.gauntlets) {
      if (g.state !== 'fighting') continue;
      g.state = 'idle';
      for (const [x, y0, y1] of g.gates) for (let y = y0; y <= y1; y++) this.level.setTile(x, y, '.');
      for (const e of g.live || []) e.dead = true;
    }
  }

  onBellRung(bell) {
    const key = `${bell.set}:${bell.id}`;
    if (!this.stage.bells.includes(key)) this.stage.bells.push(key);
    const n = this.stage.bells.filter((b) => b.startsWith(bell.set + ':')).length;
    this.writeSave();
    if (n >= 3) {
      for (const g of this.bellGates) {
        if (g.set !== bell.set) continue;
        for (const [x, y] of g.tiles) {
          this.level.setTile(x, y, '.');
          this.particles.burst(x * TILE + 16, y * TILE + 16, 6, { kind: 'shard', color: '#4a3a30', size: 5, speed: 200, life: 0.9, grav: 1000, vrot: 10 });
        }
      }
      this.audio.play('gate');
      this.hud.showToast('The inner hall opens');
    } else this.hud.showToast(`${n} of 3 bells`);
  }

  // One-shot frights in the derelict.
  updateScares(dt) {
    const p = this.player;
    for (const sc of this.scares) {
      if (sc.done || p.cx < sc.x) continue;
      sc.done = true;
      switch (sc.kind) {
        case 'lightsOut':
          this.decos.blackout.push({ x0: sc.x0 * TILE, x1: sc.x1 * TILE, t: 4.5 });
          this.audio.play('powerDown');
          this.lightsOutT = 4.5;
          break;
        case 'silhouette':
          this.shadows.push({ x: p.cx + 520, y: sc.y * TILE, vx: -900, life: 1.4 });
          this.audio.play('skitter');
          break;
        case 'bang':
          this.audio.play('bang');
          this.camera.shake(0.35);
          this.particles.burst(p.cx + 200, p.y - 60, 12, { color: 'rgba(120,140,130,0.8)', speed: 120, life: 1, size: 2, grav: 400 });
          break;
        case 'hiss':
          this.audio.play('hiss');
          break;
        case 'body':
          // a crewman drops out of the ceiling vent right in front of you
          this.actors.push(new Corpse(sc.bx * TILE + 16, sc.by * TILE));
          this.audio.play('sting');
          this.audio.play('bang');
          this.markScare(`body@${sc.x}`);
          break;
        case 'passBehind':
          // behind the grating, in the red light: something huge, moving slowly past
          this.passBehind = { x0: sc.wx0 * TILE, x1: (sc.wx1 + 1) * TILE, y: sc.wy * TILE, t: 0, dur: 3.4 };
          this.audio.play('hiss');
          this.markScare(`passBehind@${sc.x}`);
          break;
        case 'power':
          // the lights in the mess stutter, and die
          this.powerFail();
          this.markScare(`power@${sc.x}`);
          break;
        case 'reveal':
          // the first look at the "star": the camera drifts out over the crater
          this.camera.focus = { x: sc.fx * TILE, y: sc.fy * TILE, rate: 0.9 };
          p.state = 'cutscene';
          p.vx = 0;
          this.revealT = 4.2;
          this.audio.play('title');
          this.markScare(`reveal@${sc.x}`);
          break;
        case 'drool':
          // something drips on you from above. Don't look up.
          for (let i = 0; i < 6; i++) this.particles.add({ x: p.cx + rand(-6, 6), y: p.y - 140 - i * 30, vx: 0, vy: 200, size: 2, color: 'rgba(200,230,210,0.8)', life: 1.2, grav: 900 });
          this.audio.play('hiss');
          this.audio.play('skitter');
          this.camera.shake(0.2);
          this.markScare(`drool@${sc.x}`);
          break;
      }
    }
    for (const b of this.decos.blackout) b.t -= dt;
    this.decos.blackout = this.decos.blackout.filter((b) => b.t > 0);
    if (this.lightsOutT > 0) this.lightsOutT -= dt;
    if (this.revealT > 0) {
      this.revealT -= dt;
      if (this.revealT <= 0) {
        this.camera.focus = null;
        if (p.state === 'cutscene') p.state = 'normal';
      }
    }
    for (const sh of this.shadows) {
      sh.x += sh.vx * dt;
      sh.life -= dt;
    }
    this.shadows = this.shadows.filter((sh) => sh.life > 0);
  }

  // The blast door between the shaft and the bay: shut while the fight is on.
  setHatch(shut) {
    const h = this.level.arena?.hatch;
    if (!h) return;
    for (let y = h.y0; y <= h.y1; y++) this.level.setTile(h.x, y, shut ? 'D' : '.');
    if (shut) {
      this.audio.play('gateClose');
      this.camera.shake(0.3);
    }
  }

  markScare(key) {
    if (key && !this.stage.scares.includes(key)) this.stage.scares.push(key);
  }

  // The Tethys loses main power: strip lights die, emergency strobes take over.
  powerFail() {
    this.stage.powerOut = true;
    this.writeSave();
    this.audio.play('powerDown');
    this.audio.play('klaxon');
    this.camera.shake(0.4);
    this.hud.showToast('MAIN POWER FAILURE', 2.4);
    this.applyThemeAudio();
  }

  // The cocooned Binoshi's last words are interrupted.
  burstCocoon(npc) {
    npc.burst = true;
    this.audio.play('chestburst');
    this.audio.play('sting');
    this.camera.shake(0.8);
    this.hitstop(0.15);
    this.particles.burst(npc.cx, npc.floorY - 44, 40, { color: 'rgb(120,10,20)', size: 3, speed: 320, life: 0.8, grav: 900 });
    this.actors.push(new Chestburster(npc.cx, npc.floorY - 44, npc.cx + 560));
  }

  // Phase three: the outer bay door blows; the ship lurches toward the drop.
  blowBayDoor(boss) {
    const a = this.level.arena;
    const d = a.door;
    for (let y = d.y0; y <= d.y1; y++) {
      for (let x = d.x0; x <= d.x1; x++) {
        this.level.setTile(x, y, '.');
        this.particles.burst(x * TILE + 16, y * TILE + 16, 3, { kind: 'shard', color: '#3a4048', size: 7, speed: 520, life: 1.4, grav: 600, vrot: 12, angle: 0, spread: 0.8 });
      }
    }
    this.audio.play('explode');
    this.audio.play('hullGroan');
    this.audio.play('gust');
    this.camera.shake(1.4);
    this.hitstop(0.2);
    this.tiltTarget = 0.07;
    this.arenaWind = new Suction(a.x0, a.x1 + 400, a.y0, a.floorY + 10, 900);
    boss.onDoorBlown(this);
    this.hud.showToast('HOLD ON  ·  S on a hook', 2.6);
  }

  // The kaginawa picks the anchor you most likely mean: in reach, in sight,
  // ahead of you and above you scoring best.
  findHookTarget(p) {
    let best = null;
    let bestScore = Infinity;
    for (const a of this.anchors) {
      const dx = a.x - p.cx;
      const dy = a.y - p.cy;
      const d = Math.hypot(dx, dy);
      if (d > T.hookRange || d < 30) continue;
      if (dy > 60) continue; // never hook something well below you
      if (p.grounded && dy > -40) continue; // standing: only rings above you are useful
      let score = d;
      if (Math.sign(dx) !== p.facing && Math.abs(dx) > 40) score += 140;
      if (dy > 0) score += 160;
      if (score >= bestScore) continue;
      if (!this.lineOfSight(p.cx, p.cy - 10, a.x, a.y)) continue;
      best = a;
      bestScore = score;
    }
    return best;
  }

  lineOfSight(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 12);
    for (let i = 1; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      if (this.level.isSolidAt(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    }
    return true;
  }

  drawAnchors(ctx) {
    const t = this.time;
    for (const a of this.anchors) {
      if (a.kind === 'rib') {
        // a hooked bone spur jutting from the hull
        ctx.strokeStyle = '#2a3330';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x - 14, a.y - 16);
        ctx.quadraticCurveTo(a.x + 4, a.y - 10, a.x + 2, a.y + 4);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(160,230,200,0.35)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // iron ring on a bracket
        ctx.strokeStyle = '#1a1614';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - 16);
        ctx.lineTo(a.x, a.y - 7);
        ctx.stroke();
        ctx.strokeStyle = '#6a6460';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(220,230,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 7, Math.PI * 1.1, Math.PI * 1.6);
        ctx.stroke();
      }
    }
    // targeting reticle on the anchor the kaginawa would take
    const p = this.player;
    const a = p.hookTarget;
    if (a && !p.hook && p.state === 'normal') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,220,160,0.85)';
      ctx.lineWidth = 1.5;
      const r = 14 + Math.sin(t * 6) * 2;
      for (let k = 0; k < 4; k++) {
        const ang = t * 1.5 + (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, ang, ang + 0.7);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // The rope: taut and straight when it's holding you, sagging when slack.
  drawRope(ctx) {
    const p = this.player;
    const h = p.hook;
    if (!h) return;
    const [hx, hy] = p.rig.tip('armF', p.cx, p.feetY, p.drawFacing || p.facing);
    const a = h.anchor;
    let ex = a.x;
    let ey = a.y;
    if (h.phase === 'fire') {
      const k = Math.min(1, (h.t * T.hookRopeSpeed) / (Math.hypot(a.x - hx, a.y - hy) || 1));
      ex = hx + (a.x - hx) * k;
      ey = hy + (a.y - hy) * k;
    }
    const d = Math.hypot(ex - hx, ey - hy);
    const slack = h.phase === 'attached' && !h.taut ? Math.min(40, Math.max(0, h.len - d) * 0.6) : 0;
    ctx.save();
    ctx.lineCap = 'round';
    for (const [w, col] of [[3.4, '#1a120c'], [2, '#b8a070']]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.quadraticCurveTo((hx + ex) / 2, (hy + ey) / 2 + slack, ex, ey);
      ctx.stroke();
    }
    // three-pronged hook
    const ang = Math.atan2(ey - hy, ex - hx);
    ctx.strokeStyle = '#3a3634';
    ctx.lineWidth = 2.4;
    for (const off of [-0.9, 0, 0.9]) {
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.quadraticCurveTo(ex + Math.cos(ang + off) * 6, ey + Math.sin(ang + off) * 6, ex + Math.cos(ang + off * 1.6 + Math.PI * 0.8) * 7, ey + Math.sin(ang + off * 1.6 + Math.PI * 0.8) * 7);
      ctx.stroke();
    }
    ctx.restore();
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
        if (e.blocks?.(p)) {
          // parried: sparks, a ringing clang, and you get pushed back
          this.audio.play('clang');
          this.hitstop(0.05);
          p.vx = -p.facing * 320;
          this.particles.burst((p.cx + e.cx) / 2, p.cy - 6, 12, { kind: 'streak', color: 'rgb(255,230,170)', speed: 320, life: 0.25, size: 1.6, additive: true });
          continue;
        }
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
      if (p.attackDir === 'down' && !p.pogoUsed && ['fire', 'spikes'].includes(this.level.hazardIn(box.x, box.y, box.w, box.h)?.[2])) p.onHitLanded('hazard');
    }

    if (p.state !== 'normal' || this.respawning || p.immune) return;
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
      this.spawnEnemies({ x: pr.cx, y: pr.floorY - 40, r: 640 });
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
      this.dialogue.show(this.chapterInfo.relic || STORY.RELIC, () => this.endChapter());
    }
  }

  talk(npc) {
    const info = STORY.NPCS[npc.id];
    const first = !npc.talked;
    npc.talked = true;
    if (!this.stage.talked.includes(npc.id)) this.stage.talked.push(npc.id);
    this.player.vx = 0;
    this.dialogue.show(STORY[first ? info.first : info.after], () => {
      if (info.gives && !this.player.abilities[info.gives]) this.grantAbility(info.gives, npc.cx, npc.floorY);
      if (npc.id === 'cocooned' && !npc.burst) this.burstCocoon(npc);
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
    // Sucked out of the open bay door: you catch yourself on the lip, a heart lighter.
    if (this.arenaWind && p.cx > this.level.arena.x1 + 30 && p.state === 'normal') {
      p.invuln = 0;
      p.hurt(p.cx, { hazard: true });
      this.handlePlayerEvents();
      p.place(this.level.arena.x0 + 420, this.level.arena.floorY);
    }
    // Chapter end by walking past a marker (Chapter I)
    if (this.stage.bossDefeated && this.chapterEndX && p.cx > this.chapterEndX && this.mode === 'play') this.endChapter();
  }

  startBoss() {
    const p = this.player;
    const b = this.boss;
    this.bossActive = true;
    this.setHatch(true);
    b.wake();
    p.state = 'cutscene';
    p.vx = 0;
    const a = this.level.arena;
    this.camera.lock = { x0: a.x0, x1: a.x1, y0: a.y0, y1: a.y1 };
    // a ceiling-dropper is framed on the whole chamber so you see it fall
    const fy = b.cling === 'ceiling' && a.ceilY ? (a.ceilY + a.floorY) / 2 : Math.min(b.y ?? p.cy, p.cy) + 40;
    this.camera.focus = { x: (b.cx + p.cx) / 2, y: fy, rate: 2.5 };
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
    if (this.level.chapter === 3) {
      this.arenaWind = null;
      this.tiltTarget = 0;
      this.audio.play('hullGroan');
    }
  }

  // Permanent world changes once the chapter's boss is gone.
  afterBossWorldChanges() {
    if (this.level.chapter === 1) this.level.setGate(true);
    if (this.level.chapter === 3) {
      const d = this.level.arena.door;
      for (let y = d.y0; y <= d.y1; y++) for (let x = d.x0; x <= d.x1; x++) this.level.setTile(x, y, '.');
      this.arenaWind = null;
      this.tiltTarget = 0;
      this.setHatch(false);
      // the bay door came down outside and lies across the drop: the way out
      for (let x = d.x1 + 1; x <= d.x1 + 3; x++) this.level.setTile(x, 47, 'M');
      if (!this.level.hints.some((h) => h.exit)) this.level.hints.push({ x: (d.x0 - 2) * TILE, y: 40 * TILE, text: 'out through the bay door  →', exit: true });
    }
    if (this.level.chapter === 2) {
      // The maelstrom settles: the arena's whitewater turns calm and walkable.
      const a = this.level.arena;
      for (let y = a.rows[0]; y <= a.rows[1]; y++) for (let x = a.roughX0; x <= a.roughX1; x++) if (this.level.tileAt(x, y) === '%') this.level.setTile(x, y, '~');
    }
  }

  finishBoss() {
    this.bossActive = false;
    this.camera.lock = null;
    this.camera.focus = null;
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
    this.resetGauntlets();
    this.spawnEnemies();
    this.spawnBoss();
    this.actors = [];
    this.passBehind = null;
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
      drawTitle(ctx, this.modeT, this.titleMenu, this.showControls, this.chapterInfo.title, this.chapterInfo.accent, this.player.abilities);
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
    if (this.mode === 'paused') drawPause(ctx, this.pauseMenu, this.time, this.showControls, this.player.abilities);
    if (this.mode === 'chapterEnd') drawChapterEnd(ctx, this.chapterInfo.end, this.modeT, this.level.chapter < LAST_CHAPTER);
  }

  renderWorld(ctx) {
    const S = this.scale;
    const cam = this.camera;
    const left = cam.left;
    const top = cam.top;
    const view = { x0: left, y0: top, x1: left + VIEW_W, y1: top + VIEW_H };
    const t = this.time;
    // When the Tethys lurches, the whole view tilts (scaled up a touch so no corner shows).
    const tilt = this.tilt;
    let base = null;
    if (Math.abs(tilt) > 0.001) {
      const cw = this.canvas.width / 2;
      const ch = this.canvas.height / 2;
      base = new DOMMatrix().translate(cw, ch).rotate((tilt * 180) / Math.PI).scale(1 + Math.abs(tilt) * 1.9).translate(-cw, -ch);
    }
    const setT = (c, a, b, cc, d, e, f) => (base ? c.setTransform(base.multiply(new DOMMatrix([a, b, cc, d, e, f]))) : c.setTransform(a, b, cc, d, e, f));
    const state = { powerOut: this.stage.powerOut };

    setT(ctx, S, 0, 0, S, 0, 0);
    this.background.draw(ctx, left, top, t, this.weather);
    if (this.prevBackground && this.bgFade > 0) {
      ctx.save();
      ctx.globalAlpha = this.bgFade;
      this.prevBackground.draw(ctx, left, top, t, this.weather);
      ctx.restore();
    }

    if (!this.worldLayer || this.worldLayer.width !== this.canvas.width || this.worldLayer.height !== this.canvas.height) {
      this.worldLayer = document.createElement('canvas');
      this.worldLayer.width = this.canvas.width;
      this.worldLayer.height = this.canvas.height;
    }
    const w = this.worldLayer.getContext('2d');
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.clearRect(0, 0, this.worldLayer.width, this.worldLayer.height);
    w.setTransform(S, 0, 0, S, -left * S, -top * S);
    // lit openings in the back wall, and whatever crosses behind them
    this.decos.drawWindows(w, view, t, state);
    if (this.level.chapter === 3) this.drawOutsideDoor(w, view, t);
    if (this.passBehind) this.drawPassBehind(w);
    this.decos.draw(w, view);
    this.decos.drawFires(w, view, t, 'decos');
    // something moving behind the bulkheads
    for (const sh of this.shadows) {
      w.save();
      w.globalAlpha = Math.min(1, sh.life * 2) * 0.85;
      drawXeno(w, sh.x, sh.y, -1, { walk: this.time * 14, moving: 1, flash: 0, tail: this.time * 4 }, 1.1);
      w.restore();
    }
    this.terrain.draw(w, left, top, VIEW_W, VIEW_H);
    for (const d of this.doors) if (d.x > view.x0 - 80 && d.x < view.x1 + 80) d.draw(w);
    this.drawTracks(w, view);
    this.decos.drawFires(w, view, t, 'tiles');
    this.drawHints(w);

    for (const pr of this.props) pr.draw(w, this);
    if (this.boss && (this.bossActive || ['dying', 'falling', 'dormant'].includes(this.boss.state)) && !this.boss.dead) this.boss.draw(w, this);
    for (const g of this.geysers) g.draw(w, this);
    for (const pl of this.platforms) pl.draw(w, this);
    this.drawAnchors(w);
    for (const e of this.enemies) e.draw(w, this);
    for (const a of this.actors) a.draw(w, this);
    this.drawRope(w);
    if (!(this.player.state === 'dead' && this.deathT > 0.25)) this.player.draw(w);
    for (const pr of this.projectiles) pr.draw(w, this);
    this.water.draw(w, view, t);
    this.particles.draw(w, view);
    for (const m of this.mists) m.draw(w, view);
    if (this.debug.hitboxes) this.drawHitboxes(w);

    if (JUICE.lighting) {
      const lights = [];
      const p = this.player;
      const pr0 = (this.theme.playerLightR || 250) * (this.lightsOutT > 0 ? 0.55 : 1);
      lights.push({ x: p.cx, y: p.cy - 10, r: pr0, color: this.theme.playerLight, i: 0.95 });
      this.decos.collectLights(view, lights, t, state);
      for (const pr of this.props) pr.light?.(lights);
      for (const e of this.enemies) e.light?.(lights);
      for (const d of this.doors) d.light(lights);
      const ar = this.level.arena;
      if (this.level.chapter === 3 && ar && this.level.tileAt(ar.door.x0, ar.door.y1) !== 'D' && view.x1 > ar.x1 - 600) {
        lights.push({ x: ar.x1 + 40, y: ar.floorY - 260, r: 620, color: 'rgb(170,200,240)', i: 0.55 });
      }
      for (const g of this.geysers) g.light?.(lights);
      for (const pl of this.platforms) pl.light?.(lights);
      if (this.boss && !this.boss.dead && this.boss.state !== 'dormant') this.boss.light(lights);
      for (const pr of this.projectiles) pr.light?.(lights);
      const amb = state.powerOut && this.theme.ambientDark ? this.theme.ambientDark : this.theme.ambient;
      this.lighting.ambient = this.weather.flash > 0 ? mixAmbient(amb, this.weather.flash) : amb;
      this.lighting.render(lights, left, top);
    }

    setT(ctx, 1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.worldLayer, 0, 0);
    // Light the whole frame — sky included — for the deep, moody look.
    if (JUICE.lighting) {
      setT(ctx, S, 0, 0, S, 0, 0);
      this.lighting.apply(ctx);
    }

    // Glowing things that should punch through the darkness
    setT(ctx, S, 0, 0, S, -left * S, -top * S);
    this.decos.drawLamps(ctx, view, t, state);
    if (this.boss && (this.bossActive || ['falling', 'dying'].includes(this.boss.state)) && this.boss.drawOver) this.boss.drawOver(ctx, this);
    for (const s of this.slashes) s.draw(ctx);
    this.particles.draw(ctx, view, 'over');
    if (this.nearProp && this.player.state === 'normal' && !this.dialogue.active) {
      const pr = this.nearProp;
      drawPrompt(ctx, pr.cx, pr.floorY - (pr.kind === 'lantern' ? 116 : 76), pr.prompt, t);
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);
  }

  // Through the blown bay door: the night, the crater rim, snow being sucked past.
  drawOutsideDoor(ctx, view, t) {
    const a = this.level.arena;
    const x0 = a.door.x0 * TILE;
    if (view.x1 < x0 || this.level.tileAt(a.door.x0, a.door.y1) === 'D') return;
    const top = view.y0;
    const g = ctx.createLinearGradient(0, top, 0, view.y1);
    g.addColorStop(0, '#050a16');
    g.addColorStop(1, '#203457');
    ctx.fillStyle = g;
    ctx.fillRect(x0, top, view.x1 - x0, view.y1 - top);
    ctx.fillStyle = '#eef4ff';
    for (let i = 0; i < 40; i++) {
      const sx = x0 + ((i * 97) % 900);
      const sy = top + ((i * 53) % 300);
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t + i);
      ctx.fillRect(sx, sy, 1.3, 1.3);
    }
    ctx.globalAlpha = 1;
    // the crater's far rim, green-lit
    ctx.fillStyle = '#081214';
    ctx.beginPath();
    ctx.moveTo(x0, view.y1);
    for (let x = x0; x <= view.x1 + 20; x += 30) ctx.lineTo(x, a.floorY + 40 - Math.abs(Math.sin(x * 0.01)) * 90);
    ctx.lineTo(view.x1 + 20, view.y1);
    ctx.fill();
    glow(ctx, x0 + 300, a.floorY + 60, 320, 'rgb(90,255,170)', 0.25);
    // snow streaking out of the bay while the pull lasts
    if (this.arenaWind) {
      ctx.strokeStyle = 'rgba(220,235,255,0.55)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 30; i++) {
        const u = ((t * 1.6 + i * 0.37) % 1);
        const sx = x0 - 200 + u * 700;
        const sy = a.ceilY + ((i * 71) % (a.floorY - a.ceilY));
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 26, sy + 4);
        ctx.stroke();
      }
    }
  }

  // The scare behind the grating: a huge shape in the red light, walking past.
  drawPassBehind(ctx) {
    const pb = this.passBehind;
    const k = pb.t / pb.dur;
    for (const win of this.decos.windows) {
      if (win.x + win.w < pb.x0 || win.x > pb.x1) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(win.x, win.y, win.w, win.h);
      ctx.clip();
      // it walks in, stops dead in the middle of the window, turns its head to you — and goes
      const e = k < 0.35 ? k / 0.35 * 0.5 : k < 0.65 ? 0.5 : 0.5 + ((k - 0.65) / 0.35) * 0.5;
      const paused = k >= 0.35 && k < 0.65;
      const x = win.x + win.w + 140 - e * (win.w + 400);
      ctx.globalAlpha = 0.95;
      drawXeno(ctx, x, win.y + win.h + 40, -1, { walk: pb.t * 3, moving: paused ? 0 : 0.6, crouch: 0.3, tail: pb.t, breathe: pb.t, jaw: paused ? 0.7 : 0, head: paused ? -0.25 : 0, rear: paused ? 0.35 : 0 }, 1.7);
      ctx.restore();
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
    // Yuki-onna's frost creeping in from the edges
    const p = this.player;
    if (p.chillT > 0) {
      const k = Math.min(1, p.chillT / 1.2);
      const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.25, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.68);
      g.addColorStop(0, 'rgba(200,230,255,0)');
      g.addColorStop(1, `rgba(200,230,255,${0.4 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // Low-health pulse
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
