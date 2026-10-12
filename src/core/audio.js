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
    bell() {
      // bronze temple bell: inharmonic partials, a long shimmering tail
      for (const [f, g, d] of [[196, 0.16, 4.5], [392 * 1.18, 0.08, 3], [588 * 1.5, 0.05, 2.2], [784 * 1.9, 0.03, 1.4], [98, 0.1, 5]]) this.tone({ type: 'sine', freq: f, dur: d, gain: g, attack: 0.004, reverb: 0.9 });
      this.noise({ dur: 0.05, gain: 0.15, filter: 'bandpass', freq: 2500, q: 2 });
    },
    iceCrack() {
      for (let i = 0; i < 6; i++) this.noise({ dur: 0.02, gain: 0.12, filter: 'highpass', freq: 3000 + Math.random() * 3000, delay: i * 0.05 + Math.random() * 0.03 });
    },
    shatter() {
      this.noise({ dur: 0.3, gain: 0.25, filter: 'highpass', freq: 2500 });
      for (let i = 0; i < 8; i++) this.tone({ type: 'sine', freq: 2000 + Math.random() * 3000, dur: 0.15, gain: 0.03, delay: i * 0.02, reverb: 0.3 });
    },
    gust() {
      this.noise({ dur: 1.6, gain: 0.25, filter: 'bandpass', freq: 400, freqEnd: 1400, q: 0.7, attack: 0.3 });
    },
    chill() {
      for (let i = 0; i < 5; i++) this.tone({ type: 'sine', freq: 1800 + i * 330, dur: 0.6, gain: 0.025, delay: i * 0.05, reverb: 0.8 });
    },
    yukiInhale() {
      this.noise({ dur: 0.6, gain: 0.18, filter: 'bandpass', freq: 900, freqEnd: 2600, q: 1.5, attack: 0.5, reverb: 0.5 });
    },
    yukiBreath() {
      this.noise({ dur: 1.0, gain: 0.22, filter: 'bandpass', freq: 3000, freqEnd: 1200, q: 0.8, reverb: 0.5 });
      this.tone({ type: 'sine', freq: 1300, freqEnd: 900, dur: 0.9, gain: 0.03, reverb: 0.8 });
    },
    yukiDie() {
      this.tone({ type: 'sine', freq: 880, freqEnd: 220, dur: 1.4, gain: 0.07, attack: 0.05, reverb: 1 });
      this.tone({ type: 'sine', freq: 1320, freqEnd: 330, dur: 1.2, gain: 0.04, attack: 0.05, reverb: 1 });
    },
    monkey() {
      this.tone({ type: 'triangle', freq: 900, freqEnd: 1600, dur: 0.08, gain: 0.05 });
      this.tone({ type: 'triangle', freq: 1100, freqEnd: 1800, dur: 0.07, gain: 0.04, delay: 0.1 });
    },
    eggOpen() {
      this.noise({ dur: 0.7, gain: 0.25, filter: 'lowpass', freq: 500, freqEnd: 1200, attack: 0.1 });
      this.tone({ type: 'sine', freq: 90, freqEnd: 60, dur: 0.7, gain: 0.1 });
    },
    hugger() {
      for (let i = 0; i < 7; i++) this.noise({ dur: 0.012, gain: 0.08, filter: 'highpass', freq: 2500, delay: i * 0.035 });
    },
    squeal() {
      this.tone({ type: 'sawtooth', freq: 1600, freqEnd: 2600, dur: 0.18, gain: 0.05 });
    },
    screech() {
      this.tone({ type: 'sawtooth', freq: 900, freqEnd: 2200, dur: 0.45, gain: 0.08, attack: 0.03 });
      this.noise({ dur: 0.45, gain: 0.2, filter: 'bandpass', freq: 3000, q: 1.5, reverb: 0.4 });
    },
    hiss() {
      this.noise({ dur: 0.9, gain: 0.16, filter: 'bandpass', freq: 5000, q: 1.2, attack: 0.25, reverb: 0.5 });
    },
    rattle() {
      for (let i = 0; i < 5; i++) this.noise({ dur: 0.015, gain: 0.1, filter: 'bandpass', freq: 1800, q: 4, delay: i * 0.03 });
    },
    skitter() {
      for (let i = 0; i < 12; i++) this.noise({ dur: 0.012, gain: 0.07 * (1 - i / 14), filter: 'highpass', freq: 2200, delay: i * 0.045 + Math.random() * 0.02, reverb: 0.3 });
    },
    xenoScreech() {
      this.tone({ type: 'sawtooth', freq: 700, freqEnd: 2600, dur: 0.9, gain: 0.12, attack: 0.05, reverb: 0.8 });
      this.tone({ type: 'square', freq: 1400, freqEnd: 3000, dur: 0.7, gain: 0.04, attack: 0.05 });
      this.noise({ dur: 1.0, gain: 0.32, filter: 'bandpass', freq: 3500, q: 1.2, reverb: 0.7 });
    },
    sizzle() {
      for (let i = 0; i < 6; i++) this.noise({ dur: 0.04, gain: 0.08, filter: 'highpass', freq: 4000 + Math.random() * 2000, delay: i * 0.04 });
    },
    powerDown() {
      this.tone({ type: 'sawtooth', freq: 220, freqEnd: 30, dur: 1.6, gain: 0.12 });
      this.tone({ type: 'sine', freq: 60, freqEnd: 20, dur: 1.4, gain: 0.15 });
    },
    bang() {
      this.tone({ type: 'sine', freq: 70, freqEnd: 40, dur: 0.5, gain: 0.4 });
      this.tone({ type: 'triangle', freq: 310, dur: 1.2, gain: 0.06, reverb: 1 });
      this.tone({ type: 'triangle', freq: 467, dur: 1.0, gain: 0.04, reverb: 1 });
      this.noise({ dur: 0.15, gain: 0.3, filter: 'lowpass', freq: 1200 });
    },
    gateClose() {
      this.tone({ type: 'sine', freq: 55, freqEnd: 35, dur: 0.6, gain: 0.4 });
      this.noise({ dur: 0.4, gain: 0.35, filter: 'lowpass', freq: 900, freqEnd: 150 });
      this.tone({ type: 'triangle', freq: 180, dur: 0.8, gain: 0.05, reverb: 0.8 });
    },
    spawn() {
      this.noise({ dur: 0.5, gain: 0.2, filter: 'bandpass', freq: 400, freqEnd: 1600, q: 0.8 });
      this.tone({ type: 'sine', freq: 90, freqEnd: 50, dur: 0.4, gain: 0.2 });
    },
    hookFire() {
      this.noise({ dur: 0.16, gain: 0.16, freq: 2400, freqEnd: 5000, q: 3 });
      this.tone({ type: 'triangle', freq: 900, freqEnd: 1600, dur: 0.1, gain: 0.03 });
    },
    hookAttach() {
      this.tone({ type: 'triangle', freq: 1700, dur: 0.12, gain: 0.07, reverb: 0.2 });
      this.tone({ type: 'triangle', freq: 2550, dur: 0.08, gain: 0.04 });
      this.noise({ dur: 0.04, gain: 0.12, filter: 'highpass', freq: 3000 });
    },
    hookRelease() {
      this.noise({ dur: 0.18, gain: 0.12, freq: 1200, freqEnd: 400, q: 1 });
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
    // ── Shadow dash ──
    shadowDash() {
      this.noise({ dur: 0.35, gain: 0.22, freq: 900, freqEnd: 200, q: 0.9 });
      this.tone({ type: 'sine', freq: 160, freqEnd: 60, dur: 0.3, gain: 0.14, reverb: 0.5 });
      this.noise({ dur: 0.5, gain: 0.05, filter: 'highpass', freq: 3000, attack: 0.05, reverb: 1 });
    },
    shadowReady() {
      this.tone({ type: 'sine', freq: 330, freqEnd: 247, dur: 0.35, gain: 0.03, reverb: 0.8 });
    },
    // ── The ship ──
    sting() {
      // the jump-scare hit: a slammed low cluster and a shriek of strings
      for (const f of [55, 58.3, 82.4]) this.tone({ type: 'sawtooth', freq: f, freqEnd: f * 0.9, dur: 1.4, gain: 0.16, attack: 0.005, reverb: 0.6 });
      for (const f of [1760, 1865, 2489]) this.tone({ type: 'sawtooth', freq: f, freqEnd: f * 1.06, dur: 0.9, gain: 0.03, attack: 0.01, reverb: 0.9 });
      this.noise({ dur: 0.6, gain: 0.35, filter: 'lowpass', freq: 400, attack: 0.002 });
      this.noise({ dur: 1, gain: 0.08, filter: 'bandpass', freq: 5200, q: 3, reverb: 0.8 });
    },
    klaxon() {
      for (let i = 0; i < 3; i++) this.tone({ type: 'square', freq: 392, freqEnd: 311, dur: 0.5, gain: 0.05, delay: i * 0.7, reverb: 0.6 });
    },
    doorOpen() {
      this.noise({ dur: 0.5, gain: 0.18, filter: 'bandpass', freq: 2600, freqEnd: 700, q: 1.2 }); // pneumatic hiss
      this.tone({ type: 'sawtooth', freq: 70, freqEnd: 90, dur: 0.45, gain: 0.06 });
      this.noise({ dur: 0.08, gain: 0.15, filter: 'lowpass', freq: 300, delay: 0.42 });
    },
    doorJam() {
      for (let i = 0; i < 3; i++) this.noise({ dur: 0.12, gain: 0.12, filter: 'bandpass', freq: 600, q: 4, delay: i * 0.16 });
      this.tone({ type: 'square', freq: 110, dur: 0.3, gain: 0.04 });
    },
    arc() {
      for (let i = 0; i < 6; i++) this.noise({ dur: 0.03, gain: 0.12, filter: 'highpass', freq: 2000 + Math.random() * 4000, delay: i * 0.035 });
      this.tone({ type: 'square', freq: 60, dur: 0.25, gain: 0.05 });
    },
    steamJet() {
      this.noise({ dur: 0.9, gain: 0.2, filter: 'highpass', freq: 1800, attack: 0.02 });
    },
    bodyDrop() {
      this.noise({ dur: 0.25, gain: 0.4, filter: 'lowpass', freq: 250 });
      this.noise({ dur: 0.4, gain: 0.12, filter: 'bandpass', freq: 900, q: 3, delay: 0.05 }); // vent grille clatter
      this.tone({ freq: 70, freqEnd: 40, dur: 0.3, gain: 0.25 });
    },
    lockerBurst() {
      this.noise({ dur: 0.2, gain: 0.45, filter: 'bandpass', freq: 1400, q: 1.5 });
      this.tone({ type: 'square', freq: 140, freqEnd: 70, dur: 0.18, gain: 0.12 });
    },
    chestburst() {
      this.noise({ dur: 0.35, gain: 0.35, filter: 'lowpass', freq: 600 }); // the crack
      this.tone({ type: 'sawtooth', freq: 1200, freqEnd: 2600, dur: 0.7, gain: 0.07, delay: 0.25, reverb: 0.6 }); // its shriek
      this.tone({ type: 'sawtooth', freq: 1700, freqEnd: 3100, dur: 0.5, gain: 0.04, delay: 0.32, reverb: 0.6 });
    },
    hullGroan() {
      this.noise({ dur: 2.4, gain: 0.14, filter: 'bandpass', freq: 160, freqEnd: 90, q: 8, attack: 0.4, reverb: 0.8 });
      this.tone({ type: 'sawtooth', freq: 48, freqEnd: 36, dur: 2.2, gain: 0.06, attack: 0.3 });
    },
    // ── The Xenomorph ──
    xenoRoar() {
      this.noise({ dur: 1.6, gain: 0.32, filter: 'bandpass', freq: 1800, freqEnd: 900, q: 1.4, attack: 0.05, reverb: 0.7 });
      this.tone({ type: 'sawtooth', freq: 340, freqEnd: 180, dur: 1.4, gain: 0.08, reverb: 0.6 });
      this.tone({ type: 'sawtooth', freq: 520, freqEnd: 260, dur: 1.2, gain: 0.05, reverb: 0.6 });
      this.tone({ freq: 70, freqEnd: 45, dur: 1.2, gain: 0.25 });
    },
    innerJaw() {
      this.noise({ dur: 0.12, gain: 0.3, filter: 'bandpass', freq: 2400, freqEnd: 600, q: 2 });
      this.noise({ dur: 0.04, gain: 0.25, filter: 'highpass', freq: 4000, delay: 0.1 }); // the snap
    },
    tailWhoosh() {
      this.noise({ dur: 0.4, gain: 0.3, freq: 400, freqEnd: 2200, q: 1.1 });
    },
    acidSpit() {
      this.noise({ dur: 0.18, gain: 0.25, filter: 'bandpass', freq: 1200, q: 2 });
      this.noise({ dur: 0.4, gain: 0.08, filter: 'highpass', freq: 3000, delay: 0.1 });
    },
    grab() {
      this.noise({ dur: 0.15, gain: 0.35, filter: 'lowpass', freq: 700 });
      this.tone({ type: 'sawtooth', freq: 220, freqEnd: 110, dur: 0.3, gain: 0.1 });
    },
    struggle() {
      this.noise({ dur: 0.08, gain: 0.2, freq: 1500 + Math.random() * 800, q: 2 });
    },
    xenoFall() {
      this.tone({ type: 'sawtooth', freq: 900, freqEnd: 200, dur: 2.6, gain: 0.08, reverb: 1 });
      this.noise({ dur: 2.6, gain: 0.2, filter: 'bandpass', freq: 1600, freqEnd: 300, q: 1.5, reverb: 1 });
    },
    // ── Chapter IV ──
    shiftIn() {
      // into the Upside Down: a sucked-in breath and a low drop
      this.noise({ dur: 0.45, gain: 0.25, freq: 3000, freqEnd: 200, q: 0.8, attack: 0.15 });
      this.tone({ type: 'sine', freq: 180, freqEnd: 45, dur: 0.6, gain: 0.25, reverb: 0.8 });
      this.tone({ type: 'sawtooth', freq: 90, freqEnd: 60, dur: 0.5, gain: 0.05, reverb: 0.8 });
    },
    shiftOut() {
      // back into the world: air rushing back
      this.noise({ dur: 0.35, gain: 0.22, freq: 300, freqEnd: 3500, q: 0.8 });
      this.tone({ type: 'sine', freq: 60, freqEnd: 200, dur: 0.35, gain: 0.18 });
    },
    shiftFail() {
      this.tone({ type: 'square', freq: 110, dur: 0.12, gain: 0.08 });
      this.tone({ type: 'square', freq: 104, dur: 0.12, gain: 0.08, delay: 0.13 });
    },
    bark() {
      for (let i = 0; i < 2; i++) {
        this.noise({ dur: 0.09, gain: 0.18, filter: 'bandpass', freq: 900, q: 2, delay: i * 0.16 });
        this.tone({ type: 'sawtooth', freq: 320, freqEnd: 220, dur: 0.08, gain: 0.05, delay: i * 0.16 });
      }
    },
    demodog() {
      this.noise({ dur: 0.5, gain: 0.18, filter: 'bandpass', freq: 500, freqEnd: 300, q: 3 });
      this.tone({ type: 'sawtooth', freq: 140, freqEnd: 90, dur: 0.5, gain: 0.06 });
    },
    demodogScreech() {
      this.tone({ type: 'sawtooth', freq: 900, freqEnd: 1900, dur: 0.45, gain: 0.07, reverb: 0.5 });
      this.noise({ dur: 0.45, gain: 0.2, filter: 'bandpass', freq: 2600, q: 2 });
    },
    flayed() {
      this.tone({ type: 'sawtooth', freq: 120, freqEnd: 95, dur: 0.8, gain: 0.06, attack: 0.2 });
      this.noise({ dur: 0.8, gain: 0.06, filter: 'bandpass', freq: 400, q: 4, attack: 0.2 });
    },
    freed() {
      this.tone({ type: 'sine', freq: 523, dur: 0.6, gain: 0.04, reverb: 1 });
      this.tone({ type: 'sine', freq: 784, dur: 0.8, gain: 0.03, delay: 0.1, reverb: 1 });
    },
    vineBurst() {
      this.noise({ dur: 0.35, gain: 0.25, filter: 'lowpass', freq: 600 });
      this.noise({ dur: 0.25, gain: 0.12, filter: 'bandpass', freq: 1600, q: 2, delay: 0.05 });
    },
    masterRage() {
      this.noise({ dur: 0.9, gain: 0.2, filter: 'bandpass', freq: 700, freqEnd: 300, q: 2, attack: 0.05, reverb: 0.6 });
      this.tone({ type: 'sawtooth', freq: 110, freqEnd: 70, dur: 0.9, gain: 0.08, reverb: 0.6 });
    },
    flayerGroan() {
      this.tone({ type: 'sawtooth', freq: 55, freqEnd: 41, dur: 1.6, gain: 0.12, attack: 0.3, reverb: 0.8 });
      this.noise({ dur: 1.6, gain: 0.1, filter: 'bandpass', freq: 220, freqEnd: 140, q: 5, attack: 0.3, reverb: 0.8 });
    },
    flayerRoar() {
      this.tone({ type: 'sawtooth', freq: 70, freqEnd: 38, dur: 2.4, gain: 0.18, attack: 0.1, reverb: 1 });
      this.tone({ type: 'sawtooth', freq: 104, freqEnd: 58, dur: 2.2, gain: 0.1, attack: 0.1, reverb: 1 });
      this.noise({ dur: 2.4, gain: 0.25, filter: 'bandpass', freq: 400, freqEnd: 150, q: 1.5, attack: 0.1, reverb: 1 });
    },
    flayerHurt() {
      this.noise({ dur: 0.3, gain: 0.25, filter: 'bandpass', freq: 900, freqEnd: 300, q: 2 });
      this.tone({ type: 'sawtooth', freq: 140, freqEnd: 70, dur: 0.3, gain: 0.08 });
    },
    rumble() {
      this.noise({ dur: 1, gain: 0.3, filter: 'lowpass', freq: 160, attack: 0.1 });
    },
    swarm() {
      this.noise({ dur: 2.4, gain: 0.18, filter: 'bandpass', freq: 1800, q: 1.2, attack: 0.8, reverb: 0.5 });
      for (let i = 0; i < 12; i++) this.noise({ dur: 0.02, gain: 0.05, filter: 'highpass', freq: 3000, delay: 0.6 + i * 0.12 });
    },
    gaze() {
      this.tone({ type: 'sawtooth', freq: 220, freqEnd: 330, dur: 1.6, gain: 0.07, reverb: 0.6 });
      this.tone({ type: 'sine', freq: 880, freqEnd: 990, dur: 1.6, gain: 0.03, reverb: 0.6 });
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
    // Fire: a baked stereo loop (roar + hiss + clustered crackles + wood snaps),
    // muffled when you're far from flames and opened up when you're close.
    const fire = ctx.createBufferSource();
    fire.buffer = makeFireBuffer(ctx, 9);
    fire.loop = true;
    this.fireFilter = ctx.createBiquadFilter();
    this.fireFilter.type = 'lowpass';
    this.fireFilter.frequency.value = 1800;
    this.fireFilter.Q.value = 0.3;
    this.ambGain = ctx.createGain();
    this.ambGain.gain.value = 0;
    fire.connect(this.fireFilter).connect(this.ambGain).connect(this.master);
    fire.start();
    this.fireNear = 0;
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

    // Wind: a howl swept by a slow LFO, plus a thin whistle coming and going.
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuf;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 550;
    wf.Q.value = 0.9;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.07;
    const wlg = ctx.createGain();
    wlg.gain.value = 300;
    wl.connect(wlg).connect(wf.frequency);
    const whistle = ctx.createBiquadFilter();
    whistle.type = 'bandpass';
    whistle.frequency.value = 1300;
    whistle.Q.value = 9;
    const wl2 = ctx.createOscillator();
    wl2.frequency.value = 0.13;
    const wl2g = ctx.createGain();
    wl2g.gain.value = 260;
    wl2.connect(wl2g).connect(whistle.frequency);
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wind.connect(wf).connect(this.windGain).connect(this.master);
    wind.connect(whistle).connect(this.windGain);
    wind.start(0, 1.1);
    wl.start();
    wl2.start();

    // Derelict: a sub-bass hull drone.
    this.hullGain = ctx.createGain();
    this.hullGain.gain.value = 0;
    for (const [f, g] of [[38, 0.6], [57, 0.35], [76.5, 0.12]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.hullGain);
      o.start();
    }
    this.hullGain.connect(this.master);
    // The Tethys with its power on: mains hum and the buzz of strip lights.
    this.shipGain = ctx.createGain();
    this.shipGain.gain.value = 0;
    const humF = ctx.createBiquadFilter();
    humF.type = 'lowpass';
    humF.frequency.value = 420;
    for (const [f, g, type] of [[60, 0.5, 'sawtooth'], [120, 0.25, 'sawtooth'], [180, 0.08, 'square']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(humF);
      o.start();
    }
    humF.connect(this.shipGain);
    const buzz = ctx.createBufferSource();
    buzz.buffer = this.noiseBuf;
    buzz.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass';
    bf.frequency.value = 3600;
    bf.Q.value = 2;
    const bg = ctx.createGain();
    bg.gain.value = 0.06;
    buzz.connect(bf).connect(bg).connect(this.shipGain);
    buzz.start(0, 0.3);
    this.shipGain.connect(this.master);
    // …and things happening somewhere in the ship
    this.derelictEvents = setInterval(() => {
      if (!this.ctx || (this.ambType !== 'derelict' && this.ambType !== 'ship')) return;
      const r = Math.random();
      if (r < 0.3) this.noise({ dur: 1.2, gain: 0.06, filter: 'bandpass', freq: 300, freqEnd: 900, q: 6, attack: 0.3, reverb: 0.8, bus: this.master }); // metal creak
      else if (r < 0.6) this.tone({ type: 'sine', freq: 1300, freqEnd: 650, dur: 0.12, gain: 0.03, reverb: 1, bus: this.master }); // drip
    }, 2600);
    // Kagari at night: crickets.
    this.cricketEvents = setInterval(() => {
      if (!this.ctx || this.ambType !== 'night') return;
      const f = 4200 + Math.random() * 600;
      for (let i = 0; i < 3; i++) this.tone({ type: 'sine', freq: f, dur: 0.035, gain: 0.012, delay: i * 0.06, bus: this.master });
    }, 700);
    // Beneath: a storm drone, and now and then something like a whisper.
    this.udGain = ctx.createGain();
    this.udGain.gain.value = 0;
    const storm = ctx.createBufferSource();
    storm.buffer = this.noiseBuf;
    storm.loop = true;
    const sf2 = ctx.createBiquadFilter();
    sf2.type = 'lowpass';
    sf2.frequency.value = 220;
    storm.connect(sf2).connect(this.udGain);
    for (const [f, g] of [[41, 0.5], [61.5, 0.25]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.udGain);
      o.start();
    }
    storm.start(0, 2.1);
    this.udGain.connect(this.master);
    this.udEvents = setInterval(() => {
      if (!this.ctx || this.ambType !== 'upside') return;
      if (Math.random() < 0.4) this.noise({ dur: 1.4, gain: 0.03, filter: 'bandpass', freq: 1200 + Math.random() * 800, q: 12, attack: 0.5, reverb: 1, bus: this.master });
    }, 3100);
    this.setAmbienceType(this.ambType || 'fire');

    this.ambLevel = 1;
  }

  setAmbience(level) {
    this.ambLevel = level;
    this.applyAmbience();
  }

  // 0 = far from any flames, 1 = standing in them.
  setFireProximity(k) {
    if (Math.abs(k - (this.fireNear || 0)) < 0.03) return;
    this.fireNear = k;
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
    const near = this.fireNear || 0;
    const fire = this.ambType === 'fire';
    this.ambGain.gain.setTargetAtTime(fire ? (0.12 + 0.5 * near) * lvl : 0, t, 0.5);
    this.windGain?.gain.setTargetAtTime(this.ambType === 'wind' ? 0.12 * (0.5 + lvl * 0.5) : 0, t, 0.8);
    this.hullGain?.gain.setTargetAtTime(this.ambType === 'derelict' ? 0.12 : this.ambType === 'ship' ? 0.05 : 0, t, 1.2);
    this.shipGain?.gain.setTargetAtTime(this.ambType === 'ship' ? 0.05 : 0, t, 0.4);
    this.udGain?.gain.setTargetAtTime(this.ambType === 'upside' ? 0.14 : 0, t, 0.6);
    this.fireFilter?.frequency.setTargetAtTime(1400 + near * 9000, t, 0.5);
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
      this.musicBus.gain.setTargetAtTime(['boss', 'kraken', 'xeno', 'ambush', 'master', 'flayer'].includes(mode) ? 0.6 : 0.5, this.ctx.currentTime, 0.6);
    }, mode === 'none' ? 1200 : 700);
  }

  startDrone(mode) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const heavy = mode === 'boss' || mode === 'kraken' || mode === 'xeno' || mode === 'ambush' || mode === 'master' || mode === 'flayer';
    if (mode === 'derelict' || mode === 'ship') {
      // no drone from the music bus here: the hull hum is the drone
      this.drone = { oscs: [], out: ctx.createGain() };
      return;
    }
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
      else if (this.musicMode === 'snow') this.snowStep(this.step, this.nextTime);
      else if (this.musicMode === 'derelict') this.derelictStep(this.step, this.nextTime);
      else if (this.musicMode === 'xeno') this.xenoStep(this.step, this.nextTime);
      else if (this.musicMode === 'ambush') this.bossStep(this.step, this.nextTime);
      else if (this.musicMode === 'crater') this.craterStep(this.step, this.nextTime);
      else if (this.musicMode === 'ship') this.shipStep(this.step, this.nextTime);
      else if (this.musicMode === 'upside') this.upsideStep(this.step, this.nextTime);
      else if (this.musicMode === 'master') this.masterStep(this.step, this.nextTime);
      else if (this.musicMode === 'flayer') this.flayerStep(this.step, this.nextTime);
      else if (this.musicMode === 'victory') this.victoryStep(this.step, this.nextTime);
      const bpm = { boss: 148, kraken: 116, coast: 58, explore: 66, victory: 66, snow: 60, derelict: 70, xeno: 132, ambush: 150, crater: 56, ship: 72, upside: 84, master: 156, flayer: 120 }[this.musicMode] || 66;
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

  // Chapter III, snow: gentle Yo-scale koto, wind chimes, a flute now and then.
  snowStep(step, t) {
    const yo = [0, 2, 5, 7, 9]; // D E G A B
    const n = (d, o = 0) => D3 * Math.pow(2, (yo[((d % 5) + 5) % 5] + 12 * (o + Math.floor(d / 5))) / 12);
    const bar = Math.floor(step / 16);
    const s = step % 16;
    if (s % 4 === 0 && Math.random() < 0.55) this.pluck(n(Math.floor(Math.random() * 8), 0), t, 0.045);
    if (s === 0 && bar % 4 === 0) [0, 2, 4, 7].forEach((d, i) => this.pluck(n(d, -1), t + i * 0.18, 0.04));
    if (Math.random() < 0.05) this.tone({ type: 'sine', freq: n(Math.floor(Math.random() * 5) + 10, 1), dur: 2.2, gain: 0.018, delay: this.at(t), bus: this.musicBus, reverb: 1 });
    if (s === 8 && bar % 4 === 2 && Math.random() < 0.7) this.shakuhachi(n(4 + Math.floor(Math.random() * 3), 1), t, 1.8);
  }

  // Inside the ship: barely music. A slow heartbeat, a dissonant cluster that swells and fades.
  derelictStep(step, t) {
    const s = step % 32;
    if (s === 0 || s === 3) this.tone({ type: 'sine', freq: 52, freqEnd: 38, dur: 0.25, gain: s === 0 ? 0.22 : 0.15, delay: this.at(t), bus: this.musicBus });
    if (step % 128 === 64) for (const f of [233, 247, 311]) this.tone({ type: 'sine', freq: f, dur: 5, gain: 0.018, attack: 2, delay: this.at(t), bus: this.musicBus, reverb: 1 });
    if (Math.random() < 0.012) this.noise({ dur: 2, gain: 0.04, filter: 'bandpass', freq: 600, freqEnd: 200, q: 8, attack: 0.5, delay: this.at(t), bus: this.musicBus, reverb: 1 });
  }

  // The Upside Down: a cold, slow synth arpeggio over a pedal note.
  upsideStep(step, t) {
    const arp = [0, 4, 7, 11, 12, 11, 7, 4]; // C maj7, up and down
    const root = [65.4, 65.4, 55, 58.3][Math.floor(step / 32) % 4];
    const s = step % 8;
    const f = root * 4 * Math.pow(2, arp[s] / 12);
    this.tone({ type: 'square', freq: f, dur: 0.16, gain: 0.018, delay: this.at(t), bus: this.musicBus, reverb: 0.5 });
    if (step % 32 === 0) this.tone({ type: 'sawtooth', freq: root, dur: 5.5, gain: 0.05, attack: 1, delay: this.at(t), bus: this.musicBus, reverb: 0.6 });
  }

  // The Master: fast taiko and a biting plucked figure.
  masterStep(step, t) {
    const s = step % 16;
    if ([0, 3, 6, 8, 11, 14].includes(s)) this.taiko(t, s === 0 ? 0.6 : 0.4, s % 8 === 0);
    if (s % 2 === 0) this.pluck([D3 * 2, D3 * 2.38, D3 * 2.67, D3 * 3][(step >> 1) % 4], t, 0.04);
    if (step % 64 === 32) this.shakuhachi(D3 * 4, t, 1.2);
  }

  // The Mind Flayer: a heavy synth ostinato, taiko, and a sky-wide drone.
  flayerStep(step, t) {
    const s = step % 16;
    if (s % 4 === 0) this.taiko(t, 0.6, true);
    if (s === 10) this.taiko(t, 0.35, false);
    const bass = [41.2, 41.2, 49, 41.2, 55, 49, 41.2, 61.7][(s >> 1) % 8];
    if (s % 2 === 0) this.tone({ type: 'sawtooth', freq: bass, dur: 0.2, gain: 0.07, delay: this.at(t), bus: this.musicBus });
    if (step % 64 === 0) for (const f of [164.8, 196, 246.9]) this.tone({ type: 'sawtooth', freq: f, dur: 3, gain: 0.025, attack: 0.6, delay: this.at(t), bus: this.musicBus, reverb: 0.7 });
    if (s % 4 === 2) this.tone({ type: 'square', freq: bass * 8, dur: 0.08, gain: 0.015, delay: this.at(t), bus: this.musicBus, reverb: 0.4 });
  }

  // The crater: the snow theme's scale, slowed and thinned, under a high, wrong tone.
  craterStep(step, t) {
    const yo = [0, 2, 5, 7, 9];
    const n = (d, o = 0) => D3 * Math.pow(2, (yo[((d % 5) + 5) % 5] + 12 * (o + Math.floor(d / 5))) / 12);
    const s = step % 32;
    if (s === 0 && Math.random() < 0.7) this.pluck(n(Math.floor(Math.random() * 5), -1), t, 0.04);
    if (step % 64 === 32) this.tone({ type: 'sine', freq: 1244, freqEnd: 1210, dur: 6, gain: 0.012, attack: 2.5, delay: this.at(t), bus: this.musicBus, reverb: 1 });
    if (step % 128 === 0) this.tone({ type: 'sine', freq: 73.4, dur: 7, gain: 0.05, attack: 2, delay: this.at(t), bus: this.musicBus, reverb: 0.6 });
  }

  // The Tethys with the lights on: a slow synth pulse and the ship's own pings.
  shipStep(step, t) {
    const s = step % 32;
    if (s === 0 || s === 16) this.tone({ type: 'triangle', freq: s ? 98 : 110, dur: 1.6, gain: 0.04, attack: 0.3, delay: this.at(t), bus: this.musicBus, reverb: 0.5 });
    if (step % 64 === 40) this.tone({ type: 'sine', freq: 880, dur: 0.15, gain: 0.02, delay: this.at(t), bus: this.musicBus, reverb: 1 });
    if (step % 64 === 41) this.tone({ type: 'sine', freq: 659, dur: 0.3, gain: 0.015, delay: this.at(t), bus: this.musicBus, reverb: 1 });
  }

  // The Xenomorph: industrial taiko, metal hits, a tritone ostinato.
  xenoStep(step, t) {
    const s = step % 16;
    const kick = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1];
    if (kick[s]) this.taiko(t, 0.5, true);
    if (s === 4 || s === 12) {
      this.noise({ dur: 0.08, gain: 0.18, filter: 'bandpass', freq: 3200, q: 6, delay: this.at(t), bus: this.musicBus, reverb: 0.4 });
      this.tone({ type: 'triangle', freq: 523, dur: 0.4, gain: 0.03, delay: this.at(t), bus: this.musicBus, reverb: 0.5 });
    }
    if (s % 2 === 0) this.tone({ type: 'sawtooth', freq: [73.4, 73.4, 103.8, 73.4, 110, 103.8, 73.4, 77.8][(s / 2) | 0], dur: 0.18, gain: 0.05, delay: this.at(t), bus: this.musicBus });
    if (step % 64 === 0) for (const f of [146.8, 207.7, 311.1]) this.tone({ type: 'sawtooth', freq: f, dur: 0.9, gain: 0.03, attack: 0.02, delay: this.at(t), bus: this.musicBus, reverb: 0.4 });
  }


  victoryStep(step, t) {
    if (step % 32 === 0) [0, 2, 4, 5, 7].forEach((d, i) => this.pluck(note(d, 1), t + i * 0.2, 0.05));
    if (step % 64 === 16) this.shakuhachi(note(4, 1), t, 2.5);
  }
}

// ── Fire synthesis ────────────────────────────────────────────
// Real fire is layered: a low turbulent roar that breathes, an airy hiss on
// top, and crackles — very short, bright impulses that arrive in clusters,
// not on a metronome — plus the occasional wood snap with a falling pitch and
// a soft settling thud. Built sample by sample into a seamless stereo loop.
function makeFireBuffer(ctx, seconds) {
  const sr = ctx.sampleRate;
  const N = Math.floor(sr * seconds);
  const F = Math.floor(sr * 0.6); // crossfade length for a seamless loop
  const buf = ctx.createBuffer(2, N, sr);
  for (let ch = 0; ch < 2; ch++) {
    const out = new Float32Array(N + F);
    // slowly wandering "flicker" envelope shared by roar and crackle rate
    const flick = new Float32Array(N + F);
    let cur = 0.7;
    let target = 0.7;
    for (let i = 0; i < N + F; i++) {
      if (i % Math.floor(sr * 0.045) === 0) target = 0.45 + Math.random() * 0.55;
      cur += (target - cur) * 0.0009;
      flick[i] = cur;
    }
    // roar: noise through two one-pole lowpasses (~300 Hz), breathing with the flicker
    const aL = Math.exp((-2 * Math.PI * 300) / sr);
    const aH = Math.exp((-2 * Math.PI * 2600) / sr);
    let l1 = 0;
    let l2 = 0;
    let hp = 0;
    for (let i = 0; i < N + F; i++) {
      const w = Math.random() * 2 - 1;
      l1 = aL * l1 + (1 - aL) * w;
      l2 = aL * l2 + (1 - aL) * l1;
      hp = aH * hp + (1 - aH) * w;
      const hiss = w - hp; // highpassed
      out[i] = l2 * 3.2 * flick[i] + hiss * 0.035 * flick[i];
    }
    // crackles: Poisson events, rate rides the flicker; many spawn little clusters
    const burst = (at, amp, tau, freq) => {
      const len = Math.min(Math.floor(tau * 7 * sr), N + F - at);
      for (let k = 0; k < len; k++) {
        const t = k / sr;
        const env = Math.exp(-t / tau);
        out[at + k] += amp * env * ((Math.random() * 2 - 1) * 0.7 + Math.sin(2 * Math.PI * freq * t) * 0.6);
      }
    };
    let i = 0;
    while (i < N + F) {
      const rate = 10 + 26 * flick[i] ** 2; // crackles per second
      i += Math.floor((-Math.log(1 - Math.random()) / rate) * sr);
      if (i >= N + F) break;
      const amp = 0.08 + 0.55 * Math.random() ** 3;
      burst(i, amp, 0.0003 + Math.random() * 0.0012, 1800 + Math.random() * 4500);
      if (Math.random() < 0.4) {
        let j = i;
        const n = 1 + Math.floor(Math.random() * 4);
        for (let c = 0; c < n; c++) {
          j += Math.floor((0.004 + Math.random() * 0.03) * sr);
          if (j < N + F) burst(j, amp * (0.3 + Math.random() * 0.6), 0.0003 + Math.random() * 0.001, 2000 + Math.random() * 4000);
        }
      }
    }
    // wood snaps: a sharp click with a falling, woody tone
    let s = Math.floor(Math.random() * sr);
    while (s < N + F) {
      const amp = 0.25 + Math.random() * 0.45;
      const tau = 0.004 + Math.random() * 0.01;
      const f0 = 700 + Math.random() * 600;
      const len = Math.min(Math.floor(tau * 8 * sr), N + F - s);
      let ph = 0;
      for (let k = 0; k < len; k++) {
        const t = k / sr;
        const f = f0 * Math.exp(-t * 60);
        ph += (2 * Math.PI * f) / sr;
        out[s + k] += amp * Math.exp(-t / tau) * (Math.sin(ph) * 0.8 + (Math.random() * 2 - 1) * 0.5 * Math.exp(-t / 0.001));
      }
      s += Math.floor((0.35 + Math.random() * 1.4) * sr);
    }
    // settling thuds
    let d = Math.floor(Math.random() * 2 * sr);
    while (d < N + F) {
      const len = Math.min(Math.floor(0.12 * sr), N + F - d);
      for (let k = 0; k < len; k++) {
        const t = k / sr;
        out[d + k] += 0.18 * Math.exp(-t / 0.035) * Math.sin(2 * Math.PI * (95 - t * 200) * t);
      }
      d += Math.floor((2 + Math.random() * 4) * sr);
    }
    // seamless loop: blend the tail into the head
    for (let k = 0; k < F; k++) {
      const a = k / F;
      out[k] = out[k] * a + out[N + k] * (1 - a);
    }
    // normalise
    let peak = 0;
    for (let k = 0; k < N; k++) peak = Math.max(peak, Math.abs(out[k]));
    const g = 0.9 / (peak || 1);
    const data = buf.getChannelData(ch);
    for (let k = 0; k < N; k++) data[k] = out[k] * g;
  }
  return buf;
}
