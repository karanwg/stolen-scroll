// All sound is synthesized: no audio files.
// Music uses the Miyako-bushi scale (D Eb G A Bb) for a Japanese feel.

const SCALE = [0, 1, 5, 7, 8]; // semitones from D
const D3 = 146.83;
const note = (deg, oct = 0) => D3 * Math.pow(2, (SCALE[((deg % 5) + 5) % 5] + 12 * (oct + Math.floor(deg / 5))) / 12);

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicMode = 'none';
    this.wantMusic = 'none';
    try {
      this.muted = localStorage.getItem('stolen-scroll.muted') === '1';
    } catch {}
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.55;
    this.musicBus.connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8);
    this.reverbBus = ctx.createGain();
    this.reverbBus.gain.value = 0.5;
    this.reverbBus.connect(this.reverb).connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.startAmbience();
    this.musicTimer = setInterval(() => this.scheduleMusic(), 90);
    this.setMusic(this.wantMusic);
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('stolen-scroll.muted', this.muted ? '1' : '0');
    } catch {}
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  impulse(sec) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  makeNoise(sec) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── Primitives ──────────────────────────────────────────────
  env(gainNode, t, attack, peak, dur) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  }

  tone({ type = 'sine', freq = 440, freqEnd, dur = 0.2, gain = 0.2, attack = 0.005, delay = 0, bus, reverb = 0, detune = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + attack + dur);
    const g = this.ctx.createGain();
    this.env(g, t, attack, gain, dur);
    o.connect(g);
    g.connect(bus || this.sfxBus);
    if (reverb) {
      const s = this.ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.reverbBus);
    }
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  noise({ dur = 0.2, gain = 0.2, attack = 0.005, filter = 'bandpass', freq = 1000, freqEnd, q = 1, delay = 0, bus, reverb = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t + attack + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t, attack, gain, dur);
    src.connect(f).connect(g).connect(bus || this.sfxBus);
    if (reverb) {
      const s = this.ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.reverbBus);
    }
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + dur + 0.05);
  }

  // ── Sound effects ───────────────────────────────────────────
  play(name, arg = 0) {
    if (!this.ctx) return;
    const fn = this.sfx[name];
    if (fn) fn.call(this, arg);
  }

  sfx = {
    jump() {
      this.noise({ dur: 0.12, gain: 0.12, freq: 900, freqEnd: 2400, q: 0.8 });
      this.tone({ type: 'sine', freq: 220, freqEnd: 330, dur: 0.08, gain: 0.05 });
    },
    airJump() {
      this.noise({ dur: 0.22, gain: 0.16, freq: 600, freqEnd: 3000, q: 1.2 });
      this.tone({ type: 'triangle', freq: 440, freqEnd: 880, dur: 0.14, gain: 0.05, reverb: 0.3 });
    },
    land(speed) {
      const k = Math.min(1, speed / 700);
      this.noise({ dur: 0.08 + k * 0.1, gain: 0.08 + k * 0.18, filter: 'lowpass', freq: 500 + k * 400 });
      if (k > 0.6) this.tone({ freq: 90, freqEnd: 50, dur: 0.15, gain: 0.18 });
    },
    dash() {
      this.noise({ dur: 0.22, gain: 0.25, freq: 3000, freqEnd: 500, q: 0.7 });
      this.noise({ dur: 0.1, gain: 0.1, filter: 'highpass', freq: 5000 });
    },
    slash(dir) {
      const up = dir === 'up';
      this.noise({ dur: 0.13, gain: 0.22, freq: up ? 1800 : 2600, freqEnd: up ? 4500 : 900, q: 2.2 });
      this.noise({ dur: 0.05, gain: 0.08, filter: 'highpass', freq: 6000 });
    },
    hit() {
      this.tone({ type: 'square', freq: 180, freqEnd: 60, dur: 0.09, gain: 0.12 });
      this.noise({ dur: 0.09, gain: 0.3, freq: 1600, q: 1.5 });
      this.tone({ type: 'sine', freq: 1200, freqEnd: 800, dur: 0.05, gain: 0.05 });
    },
    kill() {
      this.noise({ dur: 0.4, gain: 0.3, filter: 'lowpass', freq: 2000, freqEnd: 200 });
      this.tone({ type: 'sawtooth', freq: 220, freqEnd: 40, dur: 0.35, gain: 0.1, reverb: 0.4 });
    },
    clang() {
      this.tone({ type: 'triangle', freq: 1400, dur: 0.25, gain: 0.08, reverb: 0.4 });
      this.tone({ type: 'triangle', freq: 2100, dur: 0.18, gain: 0.05 });
      this.noise({ dur: 0.05, gain: 0.15, filter: 'highpass', freq: 3000 });
    },
    pogo() {
      this.tone({ type: 'sine', freq: 300, freqEnd: 600, dur: 0.1, gain: 0.08 });
    },
    hurt() {
      this.noise({ dur: 0.3, gain: 0.4, filter: 'lowpass', freq: 3000, freqEnd: 300 });
      this.tone({ type: 'sawtooth', freq: 140, freqEnd: 50, dur: 0.35, gain: 0.18 });
      this.tone({ type: 'sine', freq: 70, dur: 0.4, gain: 0.25 });
    },
    death() {
      this.tone({ type: 'sine', freq: 220, freqEnd: 55, dur: 1.6, gain: 0.25, reverb: 0.8 });
      this.noise({ dur: 1.2, gain: 0.2, filter: 'lowpass', freq: 1200, freqEnd: 100, reverb: 0.6 });
    },
    floatOpen() {
      this.noise({ dur: 0.18, gain: 0.25, freq: 400, freqEnd: 1600, q: 0.6 });
      this.noise({ dur: 0.08, gain: 0.12, freq: 2500, q: 3, delay: 0.06 });
    },
    wallJump() {
      this.noise({ dur: 0.1, gain: 0.15, filter: 'lowpass', freq: 900 });
      this.sfx.jump.call(this);
    },
    break() {
      this.noise({ dur: 0.6, gain: 0.45, filter: 'lowpass', freq: 2500, freqEnd: 200 });
      for (let i = 0; i < 6; i++) this.noise({ dur: 0.05, gain: 0.15, freq: 600 + Math.random() * 1500, q: 4, delay: i * 0.05 + Math.random() * 0.04 });
      this.tone({ freq: 70, freqEnd: 40, dur: 0.4, gain: 0.3 });
    },
    rest() {
      [0, 2, 4, 7].forEach((d, i) => this.tone({ type: 'sine', freq: note(d, 1), dur: 2.2, gain: 0.08, delay: i * 0.18, reverb: 0.9 }));
      this.tone({ type: 'sine', freq: note(0, -1), dur: 2.5, gain: 0.1, reverb: 0.6 });
    },
    pickup() {
      [0, 2, 3, 4, 5, 7, 9].forEach((d, i) => this.tone({ type: 'triangle', freq: note(d, 1), dur: 0.9, gain: 0.07, delay: i * 0.07, reverb: 0.8 }));
      this.noise({ dur: 1.2, gain: 0.08, freq: 6000, q: 0.5, reverb: 0.8 });
    },
    kunai() {
      this.noise({ dur: 0.18, gain: 0.12, freq: 4000, freqEnd: 7000, q: 6 });
    },
    tell() {
      this.tone({ type: 'triangle', freq: 1800, dur: 0.12, gain: 0.05 });
      this.tone({ type: 'triangle', freq: 2400, dur: 0.1, gain: 0.04, delay: 0.04 });
    },
    lunge() {
      this.noise({ dur: 0.2, gain: 0.2, freq: 1500, freqEnd: 600, q: 1 });
    },
    batScreech() {
      this.tone({ type: 'sawtooth', freq: 1400, freqEnd: 2200, dur: 0.18, gain: 0.04 });
      this.noise({ dur: 0.15, gain: 0.08, freq: 2500, q: 3 });
    },
    fireball() {
      this.noise({ dur: 0.5, gain: 0.25, filter: 'lowpass', freq: 600, freqEnd: 2000 });
      this.tone({ type: 'sawtooth', freq: 90, freqEnd: 60, dur: 0.4, gain: 0.08 });
    },
    explode() {
      this.noise({ dur: 0.6, gain: 0.35, filter: 'lowpass', freq: 1400, freqEnd: 120, reverb: 0.3 });
      this.tone({ freq: 80, freqEnd: 35, dur: 0.5, gain: 0.3 });
    },
    roar() {
      this.tone({ type: 'sawtooth', freq: 80, freqEnd: 50, dur: 1.6, gain: 0.25, attack: 0.15, reverb: 0.6 });
      this.tone({ type: 'sawtooth', freq: 120, freqEnd: 70, dur: 1.5, gain: 0.18, attack: 0.1, detune: 15 });
      this.noise({ dur: 1.6, gain: 0.35, filter: 'bandpass', freq: 400, freqEnd: 250, q: 0.8, attack: 0.1, reverb: 0.5 });
    },
    slam() {
      this.tone({ freq: 70, freqEnd: 28, dur: 0.6, gain: 0.5 });
      this.noise({ dur: 0.5, gain: 0.45, filter: 'lowpass', freq: 900, freqEnd: 100, reverb: 0.4 });
    },
    whip() {
      this.noise({ dur: 0.25, gain: 0.25, freq: 800, freqEnd: 4000, q: 1.5 });
      this.noise({ dur: 0.06, gain: 0.35, filter: 'highpass', freq: 3000, delay: 0.22 });
    },
    breath() {
      this.noise({ dur: 1.1, gain: 0.3, filter: 'bandpass', freq: 500, freqEnd: 1200, q: 0.5, attack: 0.1 });
      this.tone({ type: 'sawtooth', freq: 60, dur: 1.0, gain: 0.08, attack: 0.1 });
    },
    bossDie() {
      this.sfx.roar.call(this);
      for (let i = 0; i < 8; i++) this.noise({ dur: 0.5, gain: 0.25, filter: 'lowpass', freq: 1200, freqEnd: 100, delay: 0.4 + i * 0.22 });
      this.tone({ type: 'sine', freq: 55, dur: 3, gain: 0.3, delay: 1.5, reverb: 0.9 });
    },
    gate() {
      this.tone({ type: 'sawtooth', freq: 55, freqEnd: 45, dur: 1.2, gain: 0.12 });
      this.noise({ dur: 1.2, gain: 0.2, filter: 'lowpass', freq: 400 });
    },
    splash(k = 1) {
      this.noise({ dur: 0.35, gain: 0.25 * k + 0.08, filter: 'lowpass', freq: 1400, freqEnd: 250 });
      this.tone({ type: 'sine', freq: 220, freqEnd: 90, dur: 0.18, gain: 0.08 * k });
    },
    sinking() {
      for (let i = 0; i < 5; i++) this.tone({ type: 'sine', freq: 300 + i * 90 + Math.random() * 60, freqEnd: 600 + i * 120, dur: 0.07, gain: 0.05, delay: i * 0.07 });
    },
    bubbles() {
      for (let i = 0; i < 7; i++) this.tone({ type: 'sine', freq: 180 + Math.random() * 220, freqEnd: 400 + Math.random() * 300, dur: 0.08, gain: 0.05, delay: i * 0.09 + Math.random() * 0.05, reverb: 0.3 });
    },
    drown() {
      this.sfx.splash.call(this, 1.4);
      this.sfx.bubbles.call(this);
      this.tone({ type: 'sine', freq: 110, freqEnd: 55, dur: 0.6, gain: 0.2, reverb: 0.5 });
    },
    tentacleRise() {
      this.noise({ dur: 0.5, gain: 0.3, filter: 'bandpass', freq: 300, freqEnd: 1100, q: 0.8 });
      this.tone({ type: 'sawtooth', freq: 70, freqEnd: 50, dur: 0.6, gain: 0.08, attack: 0.05 });
      this.sfx.splash.call(this, 1);
    },
    tentacleSlam() {
      this.noise({ dur: 0.2, gain: 0.2, freq: 900, freqEnd: 300, q: 1 });
    },
    jelly() {
      this.tone({ type: 'sine', freq: 260, freqEnd: 720, dur: 0.14, gain: 0.12 });
      this.noise({ dur: 0.08, gain: 0.08, filter: 'highpass', freq: 4000 });
      this.tone({ type: 'square', freq: 1400, dur: 0.05, gain: 0.02, delay: 0.02 });
    },
    kappa() {
      this.tone({ type: 'square', freq: 150, freqEnd: 95, dur: 0.09, gain: 0.05 });
      this.tone({ type: 'square', freq: 140, freqEnd: 85, dur: 0.09, gain: 0.05, delay: 0.13 });
    },
    geyser() {
      this.noise({ dur: 1.2, gain: 0.3, filter: 'highpass', freq: 600, freqEnd: 2500, attack: 0.05 });
      this.noise({ dur: 0.8, gain: 0.2, filter: 'lowpass', freq: 400 });
    },
    crumble() {
      this.noise({ dur: 0.15, gain: 0.15, freq: 500, q: 4 });
      this.noise({ dur: 0.35, gain: 0.2, filter: 'lowpass', freq: 900, freqEnd: 200, delay: 0.1 });
    },
    splat() {
      this.noise({ dur: 0.22, gain: 0.25, filter: 'lowpass', freq: 700, freqEnd: 200 });
    },
    ink() {
      this.noise({ dur: 0.25, gain: 0.2, freq: 500, freqEnd: 1600, q: 1.5 });
      this.tone({ type: 'sine', freq: 150, freqEnd: 300, dur: 0.15, gain: 0.08 });
    },
    thunder(delay = 0.4) {
      this.noise({ dur: 2.4, gain: 0.32, filter: 'lowpass', freq: 400, freqEnd: 80, attack: 0.08, delay, reverb: 0.6 });
      this.noise({ dur: 0.25, gain: 0.25, filter: 'lowpass', freq: 1800, freqEnd: 500, delay });
    },
    krakenRoar() {
      this.tone({ type: 'sawtooth', freq: 55, freqEnd: 36, dur: 2.2, gain: 0.28, attack: 0.25, reverb: 0.8 });
      this.tone({ type: 'sawtooth', freq: 82, freqEnd: 55, dur: 2.0, gain: 0.18, attack: 0.2, detune: 20 });
      this.noise({ dur: 2.0, gain: 0.3, filter: 'bandpass', freq: 220, freqEnd: 140, q: 0.7, attack: 0.2, reverb: 0.6 });
      this.sfx.bubbles.call(this);
    },
    krakenDie() {
      this.sfx.krakenRoar.call(this);
      for (let i = 0; i < 10; i++) this.sfx.splash.call(this, 0.6 + Math.random() * 0.5);
      this.tone({ type: 'sine', freq: 41, dur: 3.5, gain: 0.3, delay: 1.2, reverb: 1 });
    },
    ui() {
      this.tone({ type: 'triangle', freq: 880, dur: 0.06, gain: 0.05 });
    },
    uiSelect() {
      this.tone({ type: 'triangle', freq: 660, dur: 0.1, gain: 0.06 });
      this.tone({ type: 'triangle', freq: 990, dur: 0.14, gain: 0.06, delay: 0.06 });
    },
    blip() {
      this.tone({ type: 'sine', freq: 520 + Math.random() * 80, dur: 0.03, gain: 0.025 });
    },
    title() {
      this.tone({ type: 'sine', freq: note(0, -1), dur: 4, gain: 0.2, reverb: 1 });
      this.noise({ dur: 2.5, gain: 0.1, filter: 'lowpass', freq: 300, reverb: 1 });
    },
  };

  // ── Ambience: crackling fire bed ───────────────────────────
  startAmbience() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0.05;
    src.connect(f).connect(this.ambGain).connect(this.master);
    src.start();
    // Sea: rolling surf and rain, faded in by setAmbienceType('sea').
    const surf = ctx.createBufferSource();
    surf.buffer = this.noiseBuf;
    surf.loop = true;
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 520;
    const swell = ctx.createGain();
    swell.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.45;
    lfo.connect(lfoG).connect(swell.gain);
    this.seaGain = ctx.createGain();
    this.seaGain.gain.value = 0;
    surf.connect(sf).connect(swell).connect(this.seaGain).connect(this.master);
    const rain = ctx.createBufferSource();
    rain.buffer = this.noiseBuf;
    rain.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = 'highpass';
    rf.frequency.value = 2600;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rf).connect(this.rainGain).connect(this.master);
    surf.start();
    rain.start(0, 0.7);
    lfo.start();
    this.setAmbienceType(this.ambType || 'fire');

    this.crackle = setInterval(() => {
      if (!this.ctx || this.ambLevel === 0 || this.ambType !== 'fire') return;
      const n = Math.random() < 0.5 ? 1 : 3;
      for (let i = 0; i < n; i++) {
        this.noise({ dur: 0.012 + Math.random() * 0.02, gain: (0.02 + Math.random() * 0.06) * (this.ambLevel ?? 1), filter: 'highpass', freq: 1500 + Math.random() * 3000, delay: Math.random() * 0.12, bus: this.master });
      }
    }, 70);
    this.ambLevel = 1;
  }

  setAmbience(level) {
    this.ambLevel = level;
    this.applyAmbience();
  }

  setAmbienceType(type) {
    this.ambType = type;
    this.applyAmbience();
  }

  applyAmbience() {
    if (!this.ctx || !this.ambGain) return;
    const t = this.ctx.currentTime;
    const lvl = this.ambLevel ?? 1;
    const sea = this.ambType === 'sea';
    this.ambGain.gain.setTargetAtTime(sea ? 0 : 0.05 * lvl, t, 0.6);
    this.seaGain?.gain.setTargetAtTime(sea ? 0.16 * (0.5 + lvl * 0.5) : 0, t, 0.8);
    this.rainGain?.gain.setTargetAtTime(sea ? 0.035 : 0, t, 0.8);
  }

  // ── Music ───────────────────────────────────────────────────
  setMusic(mode) {
    this.wantMusic = mode;
    if (!this.ctx || mode === this.musicMode) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(0, t, 0.4);
    setTimeout(() => {
      this.musicMode = mode;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.step = 0;
      this.stopDrone();
      if (mode !== 'none') this.startDrone(mode);
      this.musicBus.gain.setTargetAtTime(mode === 'boss' || mode === 'kraken' ? 0.6 : 0.5, this.ctx.currentTime, 0.6);
    }, mode === 'none' ? 1200 : 700);
  }

  startDrone(mode) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const heavy = mode === 'boss' || mode === 'kraken';
    out.gain.setTargetAtTime(heavy ? 0.14 : mode === 'coast' ? 0.12 : 0.1, ctx.currentTime, 1.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = mode === 'boss' ? 500 : mode === 'kraken' ? 380 : mode === 'coast' ? 240 : 300;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 120;
    lfo.connect(lfoG).connect(f.frequency);
    const roots = mode === 'kraken' ? [note(0, -2) * 0.75, note(0, -1) * 0.75, note(1, -2) * 0.75] : mode === 'coast' ? [note(0, -2), note(2, -2), note(4, -2)] : [note(0, -2), note(0, -1), note(3, -2)];
    const oscs = roots.map((fr, i) => {
      const o = ctx.createOscillator();
      o.type = heavy ? 'sawtooth' : i === 1 ? 'triangle' : 'sine';
      o.frequency.value = fr;
      o.detune.value = (i - 1) * 6;
      o.connect(f);
      o.start();
      return o;
    });
    f.connect(out).connect(this.musicBus);
    const s = ctx.createGain();
    s.gain.value = 0.4;
    out.connect(s).connect(this.reverbBus);
    lfo.start();
    this.drone = { oscs: [...oscs, lfo], out };
  }

  stopDrone() {
    if (!this.drone) return;
    const { oscs, out } = this.drone;
    out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => oscs.forEach((o) => o.stop()), 1500);
    this.drone = null;
  }

  scheduleMusic() {
    if (!this.ctx || this.musicMode === 'none') return;
    const ahead = this.ctx.currentTime + 0.25;
    while (this.nextTime < ahead) {
      if (this.musicMode === 'explore') this.exploreStep(this.step, this.nextTime);
      else if (this.musicMode === 'boss') this.bossStep(this.step, this.nextTime);
      else if (this.musicMode === 'coast') this.coastStep(this.step, this.nextTime);
      else if (this.musicMode === 'kraken') this.krakenStep(this.step, this.nextTime);
      else if (this.musicMode === 'victory') this.victoryStep(this.step, this.nextTime);
      const bpm = { boss: 148, kraken: 116, coast: 58, explore: 66, victory: 66 }[this.musicMode] || 66;
      this.nextTime += 60 / bpm / 4;
      this.step++;
    }
  }

  at(t) {
    return Math.max(0, t - this.ctx.currentTime);
  }

  shakuhachi(freq, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 0.97, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.12);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(freq * 0.012, t + dur * 0.6);
    vib.connect(vg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.18);
    g.gain.setValueAtTime(0.09, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus);
    const s = ctx.createGain();
    s.gain.value = 0.8;
    g.connect(s).connect(this.reverbBus);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.1);
    vib.stop(t + dur + 0.1);
    this.noise({ dur: dur * 0.8, gain: 0.025, freq: freq * 2, q: 2, attack: 0.1, delay: this.at(t), bus: this.musicBus, reverb: 0.5 });
  }

  pluck(freq, t, gain = 0.06) {
    this.tone({ type: 'triangle', freq, dur: 0.9, gain, attack: 0.002, delay: this.at(t), bus: this.musicBus, reverb: 0.5 });
    this.tone({ type: 'sine', freq: freq * 2, dur: 0.3, gain: gain * 0.4, attack: 0.002, delay: this.at(t), bus: this.musicBus });
  }

  taiko(t, gain = 0.5, low = true) {
    this.tone({ type: 'sine', freq: low ? 75 : 130, freqEnd: low ? 42 : 80, dur: low ? 0.5 : 0.22, gain, attack: 0.003, delay: this.at(t), bus: this.musicBus, reverb: 0.3 });
    this.noise({ dur: 0.06, gain: gain * 0.4, filter: 'lowpass', freq: 1200, delay: this.at(t), bus: this.musicBus });
  }

  exploreStep(step, t) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    // Sparse shakuhachi phrases every other bar
    if (s === 0 && bar % 2 === 0 && Math.random() < 0.75) {
      const phrase = [
        [4, 3, 2],
        [2, 3, 4, 5],
        [7, 5, 4],
        [0, 2, 3, 2],
      ][Math.floor(Math.random() * 4)];
      let tt = t;
      for (const d of phrase) {
        const dur = 0.6 + Math.random() * 1.2;
        this.shakuhachi(note(d, 1), tt, dur);
        tt += dur * 0.85;
      }
    }
    // Koto plucks
    if ((s === 8 || s === 12) && Math.random() < 0.35) this.pluck(note(Math.floor(Math.random() * 8), 0), t);
    if (s === 0 && bar % 4 === 2) [0, 2, 4, 7].forEach((d, i) => this.pluck(note(d, 0), t + i * 0.12, 0.04));
    // distant temple drum
    if (s === 0 && bar % 4 === 0) this.taiko(t, 0.18);
  }

  bossStep(step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const kick = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0];
    if (kick[s]) this.taiko(t, s === 0 ? 0.55 : 0.38, true);
    if (s === 4 || s === 12) this.taiko(t, 0.25, false);
    // driving koto ostinato
    const ost = [0, 3, 4, 3, 0, 3, 5, 4];
    const shift = bar % 4 === 3 ? 1 : 0;
    if (s % 2 === 0) this.pluck(note(ost[(s / 2) % 8] + shift, 0), t, 0.05);
    // brass-like stab on the bar
    if (s === 0) {
      for (const d of [0, 3, 4]) {
        this.tone({ type: 'sawtooth', freq: note(d, -1), dur: 0.5, gain: 0.05, attack: 0.02, delay: this.at(t), bus: this.musicBus, reverb: 0.3 });
      }
    }
    if (s === 8 && bar % 2 === 1) this.shakuhachi(note(7 + (bar % 3), 1), t, 0.9);
  }

  // Chapter II: lonely shakuhachi low in its range, water-drop plucks, long rests.
  coastStep(step, t) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    if (s === 0 && bar % 3 === 0 && Math.random() < 0.8) {
      const phrase = [
        [2, 1, 0],
        [4, 3, 2, 3],
        [0, -1, 0],
        [5, 4, 2],
      ][Math.floor(Math.random() * 4)];
      let tt = t;
      for (const d of phrase) {
        const dur = 0.9 + Math.random() * 1.4;
        this.shakuhachi(note(d, 0), tt, dur);
        tt += dur * 0.9;
      }
    }
    // water drops
    if (Math.random() < 0.06) this.tone({ type: 'sine', freq: note(Math.floor(Math.random() * 6) + 5, 1), freqEnd: note(Math.floor(Math.random() * 6) + 5, 1) * 1.08, dur: 0.25, gain: 0.03, delay: this.at(t), bus: this.musicBus, reverb: 0.9 });
    if (s === 8 && bar % 2 === 1 && Math.random() < 0.5) this.pluck(note(Math.floor(Math.random() * 5), -1), t, 0.05);
    if (s === 0 && bar % 4 === 0) this.taiko(t, 0.14);
  }

  // The Kraken: slow heavy taiko, low brass swells, a choir-ish drone that groans.
  krakenStep(step, t) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const kick = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0];
    if (kick[s]) this.taiko(t, s === 0 ? 0.6 : 0.4, true);
    if (s === 4 || s === 12) this.taiko(t, 0.22, false);
    if (s % 4 === 2) this.pluck(note([0, 1, 0, -1][(s / 4) | 0] + (bar % 4 === 3 ? 1 : 0), -1), t, 0.06);
    if (s === 0 && bar % 2 === 0) {
      for (const d of [0, 1, 5]) this.tone({ type: 'sawtooth', freq: note(d, -2), dur: 1.6, gain: 0.05, attack: 0.4, delay: this.at(t), bus: this.musicBus, reverb: 0.6 });
    }
    if (s === 8 && bar % 4 === 2) this.shakuhachi(note(1, 1), t, 1.4);
  }

  victoryStep(step, t) {
    if (step % 32 === 0) [0, 2, 4, 5, 7].forEach((d, i) => this.pluck(note(d, 1), t + i * 0.2, 0.05));
    if (step % 64 === 16) this.shakuhachi(note(4, 1), t, 2.5);
  }
}
