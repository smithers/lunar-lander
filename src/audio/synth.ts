// Web Audio recreation of the arcade's discrete sound circuit (spec §11): an always-on
// filtered-noise thrust rumble, 3 kHz low-fuel beep, 6 kHz coin chirp and a noise-burst
// explosion. All synthesized; no samples. Nothing is created until the first user gesture.
import type { GameEvents } from '../sim/game';

/** The parts of AudioContext the synth uses (so tests can pass a fake). */
export type AudioContextLike = Pick<
  AudioContext,
  | 'currentTime'
  | 'sampleRate'
  | 'destination'
  | 'resume'
  | 'suspend'
  | 'createBuffer'
  | 'createBufferSource'
  | 'createGain'
  | 'createBiquadFilter'
  | 'createOscillator'
> & { readonly state: string };

export interface Synth {
  /** Create/resume the AudioContext; call from a user gesture. */
  unlock(): void;
  /** Feed one simulation frame's events. `flying` is true while a round is in flight. */
  frame(ev: GameEvents, flying: boolean): void;
  toggleMute(): boolean;
  suspend(): void;
  resume(): void;
  readonly muted: boolean;
  readonly masterGain: number;
  readonly thrustGain: number;
  /** Sound events, when recording is enabled (test mode). */
  readonly log: string[];
}

const MASTER = 0.6;
const THRUST_MAX = 0.9;
const BEEP_LEVEL = 0.07;
const COIN_LEVEL = 0.06;
const EXPLOSION_LEVEL = 0.5;
const EXPLOSION_SEC = 1.5;
const COIN_SEC = 0.06;
const LFSR_HZ = 12000;

/** 3-bit thrust volume from the ROM: (level >> 1) | 1 in flight, 7 during abort (spec §11). */
export function thrustVolume(level: number, flying: boolean): number {
  if (!flying) return 0;
  if (level >= 16) return 7;
  return (level >> 1) | 1;
}

export function defaultAudioContext(): AudioContextLike | null {
  const Ctor =
    (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  try {
    return Ctor ? new Ctor() : null;
  } catch {
    return null;
  }
}

export function createSynth(opts: { create: () => AudioContextLike | null; record?: boolean }): Synth {
  let ctx: AudioContextLike | null = null;
  let tried = false;
  let muted = false;
  let master: GainNode | null = null;
  let thrust: GainNode | null = null;
  let beep: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let lastVol = 0;
  let beepOn = false;
  let thrustTarget = 0;
  const log: string[] = [];
  const record = (s: string) => {
    if (opts.record) log.push(s);
  };

  function build(c: AudioContextLike): void {
    master = c.createGain();
    master.gain.value = muted ? 0 : MASTER;
    master.connect(c.destination);

    // 16-bit LFSR noise clocked at 12 kHz, held between clocks, at any device sample rate.
    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noise.getChannelData(0);
    const step = LFSR_HZ / c.sampleRate;
    let lfsr = 0xace1;
    let phase = 0;
    for (let i = 0; i < data.length; i++) {
      phase += step;
      while (phase >= 1) {
        phase -= 1;
        const bit = (lfsr ^ (lfsr >> 2) ^ (lfsr >> 3) ^ (lfsr >> 5)) & 1;
        lfsr = (lfsr >> 1) | (bit << 15);
      }
      data[i] = lfsr & 1 ? 1 : -1;
    }

    // Thrust: noise -> volume -> band-pass 89.5 Hz -> low-pass 560 Hz -> make-up gain.
    const src = c.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    thrust = c.createGain();
    thrust.gain.value = 0;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 89.5;
    bp.Q.value = 0.8;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 560;
    const makeup = c.createGain();
    makeup.gain.value = 2.5;
    src.connect(thrust);
    thrust.connect(bp);
    bp.connect(lp);
    lp.connect(makeup);
    makeup.connect(master);
    src.start();

    // Low-fuel beep: 3 kHz square, gated.
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 3000;
    beep = c.createGain();
    beep.gain.value = 0;
    osc.connect(beep);
    beep.connect(master);
    osc.start();
  }

  function coinChirp(c: AudioContextLike): void {
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 6000;
    const g = c.createGain();
    g.gain.setValueAtTime(COIN_LEVEL, t);
    g.gain.linearRampToValueAtTime(0, t + COIN_SEC);
    osc.connect(g);
    g.connect(master!);
    osc.start(t);
    osc.stop(t + COIN_SEC + 0.02);
  }

  function explosion(c: AudioContextLike): void {
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noise;
    const g = c.createGain();
    g.gain.setValueAtTime(EXPLOSION_LEVEL, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + EXPLOSION_SEC);
    src.connect(g);
    g.connect(master!);
    src.start(t);
    src.stop(t + EXPLOSION_SEC);
  }

  return {
    get muted() {
      return muted;
    },
    get masterGain() {
      return master && !muted ? MASTER : 0;
    },
    get thrustGain() {
      return thrustTarget;
    },
    get log() {
      return log;
    },
    unlock() {
      if (!ctx && !tried) {
        tried = true;
        ctx = opts.create();
        if (ctx) build(ctx);
      }
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      // Fade rather than jump, so muting mid-rumble does not click.
      if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.01);
      return muted;
    },
    frame(ev, flying) {
      if (!ctx || !thrust || !beep || muted) return;
      const t = ctx.currentTime;
      if (ev.coin) {
        coinChirp(ctx);
        record('coin');
      }
      const vol = thrustVolume(ev.thrustLevel, flying);
      if (vol !== lastVol) {
        lastVol = vol;
        thrustTarget = (vol / 7) * THRUST_MAX;
        thrust.gain.setTargetAtTime(thrustTarget, t, 0.015);
        record(`thrust:${vol}`);
      }
      if (ev.crash) {
        explosion(ctx);
        record('explosion');
      }
      if (ev.lowFuel !== beepOn) {
        beepOn = ev.lowFuel;
        beep.gain.setTargetAtTime(beepOn ? BEEP_LEVEL : 0, t, 0.003);
        record(beepOn ? 'beep:on' : 'beep:off');
      }
    },
  };
}
