/**
 * Tiny synthesized sound effects (Web Audio, no files). Sounds are generated
 * from noise and oscillators, so they cost almost nothing to load. Browsers
 * only allow audio after a user gesture, so the context starts on the first
 * key press or touch.
 */
import { settings, saveSettings } from './settings';

export type SoundId =
  | 'mg'
  | 'cannon'
  | 'heavy'
  | 'laser'
  | 'pulse'
  | 'beam'
  | 'plasma'
  | 'zap'
  | 'missile'
  | 'flare'
  | 'shield'
  | 'lock'
  | 'crunch'
  | 'collapse'
  | 'hit'
  | 'explode'
  | 'bigExplode'
  | 'warn'
  | 'ui'
  | 'step'
  | 'hurt'
  | 'powerDown'
  | 'powerUp'
  | 'repair'
  | 'win'
  | 'lose';

/** Sounds that get a little random pitch each time, so repeats don't sound identical. */
const VARIED: Partial<Record<SoundId, number>> = { explode: 0.25, bigExplode: 0.2, hit: 0.3, cannon: 0.15, heavy: 0.12, crunch: 0.3, step: 0.1, hurt: 0.2, mg: 0.1 };
/** Pitch multiplier for the sound being built (frequencies scale with it). */
let pitch = 1;
/** Footsteps: 0 (light) .. 1 (assault) for the step being built (`playStep`). */
let stepWeight = 0.4;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
/** Last play time per sound, to stop rapid-fire weapons stacking into noise. */
const last: Partial<Record<SoundId, number>> = {};
const MIN_GAP: Partial<Record<SoundId, number>> = {
  mg: 0.045,
  hit: 0.05,
  cannon: 0.04,
  warn: 0.3,
  missile: 0.08,
  lock: 0.25,
  crunch: 0.06,
  collapse: 0.15,
  beam: 0.1,
  pulse: 0.06,
  zap: 0.08,
  // Short, so your own steps and a nearby enemy mech's don't swallow each other.
  step: 0.03,
  hurt: 0.12,
  win: 1,
  lose: 1,
};

function init(): void {
  if (ctx) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = masterGain();
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

/**
 * Dev only (sound tests): render into another context, e.g. an OfflineAudioContext, and
 * start a fresh ambience there. Does nothing in production builds.
 */
export function __setContextForTest(c: BaseAudioContext): void {
  if (!import.meta.env.DEV) return;
  ctx = c as AudioContext;
  ambience = null;
  master = ctx.createGain();
  master.gain.value = masterGain();
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  for (const k of Object.keys(last)) delete last[k as SoundId];
}

/** Call once at startup: unlocks audio on the first user gesture. */
export function installAudioUnlock(): void {
  const unlock = () => {
    init();
    void ctx?.resume();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true });
}

export function setMuted(muted: boolean): void {
  settings.muted = muted;
  saveSettings();
  if (master) master.gain.value = masterGain();
}

/** Volume 0..1 (settings). */
export function setVolume(volume: number): void {
  settings.volume = Math.max(0, Math.min(1, volume));
  saveSettings();
  if (master) master.gain.value = masterGain();
}

function masterGain(): number {
  return settings.muted ? 0 : 0.45 * settings.volume;
}

/**
 * Play a sound at a volume of 0..1 (callers scale by distance). `rate` shifts its pitch
 * (footsteps: heavier mechs lower); some sounds also vary a little on their own.
 */
export function play(id: SoundId, volume = 1, rate = 1): void {
  if (!ctx || !master || !noise || settings.muted || volume <= 0.02 || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const gap = MIN_GAP[id] ?? 0.02;
  if ((last[id] ?? -1) > now - gap) return;
  last[id] = now;
  const v = Math.min(1, volume);
  const vary = VARIED[id] ?? 0;
  pitch = rate * (1 + (Math.random() * 2 - 1) * vary * 0.5);
  switch (id) {
    case 'step': {
      // A metal foot landing. Phone speakers can't play much below ~300 Hz, so the parts you
      // hear everywhere are the clank (two partials 2.76× apart, the ratio that reads as a
      // struck metal bar) and the grit crunching under it; the thud adds weight on headphones.
      const w = stepWeight;
      tone(now, 'triangle', 330, 290, 0.09 + 0.06 * w, 0.2 * v);
      tone(now, 'square', 910, 800, 0.045, 0.035 * v);
      burst(now, 0.07 + 0.05 * w, 1250, 'bandpass', 0.42 * v, 1.1);
      burst(now, 0.12 + 0.12 * w, 260, 'lowpass', (0.28 + 0.22 * w) * v);
      tone(now, 'sine', 90, 34, 0.12 + 0.14 * w, (0.22 + 0.18 * w) * v);
      // Hydraulics settling just after the foot lands.
      burst(now + 0.035, 0.07, 4200, 'highpass', 0.06 * v);
      break;
    }
    case 'hurt':
      // Hit on your own mech: a muffled clang through the cockpit.
      burst(now, 0.14, 420, 'lowpass', 0.7 * v);
      tone(now, 'square', 190, 70, 0.12, 0.1 * v);
      tone(now, 'triangle', 1300, 900, 0.06, 0.05 * v);
      break;
    case 'powerDown':
      tone(now, 'sawtooth', 420, 55, 0.7, 0.13 * v);
      tone(now, 'sine', 210, 35, 0.8, 0.22 * v);
      break;
    case 'powerUp':
      tone(now, 'sawtooth', 70, 380, 0.45, 0.1 * v);
      tone(now, 'sine', 140, 520, 0.4, 0.12 * v);
      break;
    case 'repair':
      tone(now, 'triangle', 320, 960, 0.5, 0.14 * v);
      burst(now, 0.4, 2600, 'bandpass', 0.12 * v, 2);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(now + i * 0.11, 'triangle', f, f, 0.22, 0.16 * v));
      break;
    case 'lose':
      [392, 311, 233].forEach((f, i) => tone(now + i * 0.18, 'square', f, f * 0.97, 0.3, 0.07 * v));
      break;
    case 'mg':
      burst(now, 0.05, 2500, 'bandpass', 0.35 * v, 1.2);
      break;
    case 'cannon':
      burst(now, 0.16, 900, 'lowpass', 0.6 * v);
      tone(now, 'sine', 140, 50, 0.14, 0.5 * v);
      break;
    case 'heavy':
      burst(now, 0.3, 600, 'lowpass', 0.85 * v);
      tone(now, 'sine', 110, 35, 0.28, 0.7 * v);
      break;
    case 'pulse':
      tone(now, 'square', 1800, 900, 0.07, 0.07 * v);
      break;
    case 'beam':
      // Re-triggered every 0.1 s while a beam is held, overlapping into a hum.
      tone(now, 'sawtooth', 190, 180, 0.13, 0.05 * v);
      tone(now, 'sine', 920, 900, 0.13, 0.04 * v);
      break;
    case 'plasma':
      tone(now, 'sine', 300, 900, 0.25, 0.2 * v);
      burst(now, 0.2, 1600, 'bandpass', 0.2 * v, 1.5);
      break;
    case 'zap':
      burst(now, 0.14, 5000, 'highpass', 0.35 * v);
      tone(now, 'square', 2400, 300, 0.1, 0.06 * v);
      break;
    case 'laser':
      tone(now, 'sawtooth', 1400, 260, 0.18, 0.18 * v);
      tone(now, 'square', 700, 180, 0.14, 0.08 * v);
      break;
    case 'missile':
      burst(now, 0.35, 1200, 'bandpass', 0.45 * v, 0.8);
      tone(now, 'sawtooth', 160, 420, 0.3, 0.08 * v);
      break;
    case 'flare':
      burst(now, 0.25, 3000, 'highpass', 0.35 * v);
      tone(now, 'square', 1200, 600, 0.15, 0.06 * v);
      break;
    case 'shield':
      tone(now, 'sine', 220, 660, 0.35, 0.25 * v);
      tone(now, 'triangle', 330, 990, 0.35, 0.12 * v);
      break;
    case 'lock':
      tone(now, 'square', 1500, 1500, 0.05, 0.06 * v);
      break;
    case 'crunch':
      burst(now, 0.12, 1800, 'bandpass', 0.35 * v, 0.9);
      break;
    case 'collapse':
      burst(now, 1.1, 300, 'lowpass', 0.9 * v);
      burst(now, 0.6, 1400, 'bandpass', 0.25 * v, 0.6);
      break;
    case 'hit':
      burst(now, 0.04, 3500, 'highpass', 0.25 * v);
      break;
    case 'explode':
      burst(now, 0.45, 600, 'lowpass', 0.8 * v);
      tone(now, 'sine', 90, 30, 0.35, 0.6 * v);
      break;
    case 'bigExplode':
      burst(now, 0.9, 400, 'lowpass', 1 * v);
      tone(now, 'sine', 70, 25, 0.8, 0.8 * v);
      break;
    case 'warn':
      tone(now, 'square', 880, 880, 0.08, 0.12 * v);
      break;
    case 'ui':
      tone(now, 'triangle', 660, 990, 0.06, 0.12 * v);
      break;
  }
}

/** Footstep pitch by weight: heavy mechs land lower. */
export function stepPitch(tonnage: number): number {
  return Math.max(0.65, Math.min(1.4, Math.sqrt(50 / tonnage)));
}

/** 0 for a 25 t mech up to 1 at 95 t. */
function weightOf(tonnage: number): number {
  return Math.max(0, Math.min(1, (tonnage - 25) / 70));
}

/**
 * A mech footstep. Heavier mechs are lower, longer and louder (a Kestrel about 60% of a
 * Roc). `volume`: the caller's distance scaling (1 = your own mech at full).
 */
export function playStep(tonnage: number, volume: number): void {
  stepWeight = weightOf(tonnage);
  play('step', volume * (0.55 + 0.45 * stepWeight), stepPitch(tonnage));
}

/**
 * Mission ambience: a low wind rumble plus your mech's engine, a pair of slightly detuned
 * sawtooth drones whose harmonics reach phone speakers. `setEngineLoad` opens the engine
 * up as you walk and lets it die down when the mech shuts down from heat.
 */
let ambience: {
  src: AudioBufferSourceNode;
  gain: GainNode;
  engine: OscillatorNode[];
  engineFilter: BiquadFilterNode;
  engineGain: GainNode;
  load: number;
  base: number;
  running: boolean;
} | null = null;

const ENGINE = { hz: 46, gain: 0.02, loadGain: 0.012, cutoff: 380, loadCutoff: 650 };

export function startAmbience(): void {
  if (!ctx || !master || !noise || ambience) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 300;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.05, t + 2);
  src.connect(f).connect(gain).connect(master);
  src.start();

  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = ENGINE.cutoff;
  engineFilter.Q.value = 0.9;
  const engineGain = ctx.createGain();
  // Fade in with setTargetAtTime (not a ramp to a fixed time) so `setEngineLoad` can take over at once.
  engineGain.gain.setValueAtTime(0.0001, t);
  engineGain.gain.setTargetAtTime(ENGINE.gain, t, 0.6);
  engineFilter.connect(engineGain).connect(master);
  const engine = [1, 1.013].map((detune) => {
    const o = ctx!.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = ENGINE.hz * detune;
    o.connect(engineFilter);
    o.start();
    return o;
  });
  ambience = { src, gain, engine, engineFilter, engineGain, load: 0, base: ENGINE.hz, running: true };
}

/**
 * The player's engine: `load` 0..1 (speed over top speed), heavier mechs pitched lower,
 * near silent while shut down. Cheap to call every frame: only real changes reach the graph.
 */
export function setEngineLoad(load: number, tonnage: number, running: boolean): void {
  const a = ambience;
  if (!ctx || !a) return;
  const base = ENGINE.hz * Math.max(0.75, Math.min(1.25, Math.sqrt(50 / tonnage)));
  load = Math.max(0, Math.min(1, load));
  if (Math.abs(load - a.load) < 0.04 && base === a.base && running === a.running) return;
  a.load = load;
  a.base = base;
  a.running = running;
  const t = ctx.currentTime;
  const k = running ? 1 : 0.15;
  a.engine.forEach((o, i) => o.frequency.setTargetAtTime(base * (1 + 0.25 * load) * (i ? 1.013 : 1) * (running ? 1 : 0.8), t, 0.3));
  a.engineFilter.frequency.setTargetAtTime(ENGINE.cutoff + (ENGINE.loadCutoff - ENGINE.cutoff) * load, t, 0.25);
  a.engineGain.gain.setTargetAtTime((ENGINE.gain + ENGINE.loadGain * load) * k, t, running ? 0.25 : 0.5);
}

export function stopAmbience(): void {
  if (!ctx || !ambience) return;
  const a = ambience;
  ambience = null;
  const t = ctx.currentTime;
  a.gain.gain.setTargetAtTime(0.0001, t, 0.3);
  a.engineGain.gain.setTargetAtTime(0.0001, t, 0.3);
  a.src.stop(t + 1.5);
  for (const o of a.engine) o.stop(t + 1.5);
}

function burst(t: number, dur: number, freq: number, type: BiquadFilterType, gain: number, q = 0.7): void {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq * pitch;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t, Math.random() * 0.2, dur);
}

function tone(t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number): void {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pitch), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur);
}
