import { describe, expect, it } from 'vitest';
import { createSynth, thrustVolume, type AudioContextLike } from '../../src/audio/synth';
import type { GameEvents } from '../../src/sim/game';

/** A minimal fake AudioContext that records node creation and parameter targets. */
function fakeContext() {
  const created: string[] = [];
  const params: { name: string; value: number }[] = [];
  let state = 'suspended';
  const param = (name: string) => ({
    value: 0,
    setValueAtTime(v: number) {
      this.value = v;
      params.push({ name, value: v });
    },
    setTargetAtTime(v: number) {
      this.value = v;
      params.push({ name, value: v });
    },
    linearRampToValueAtTime(v: number) {
      this.value = v;
      params.push({ name, value: v });
    },
    exponentialRampToValueAtTime(v: number) {
      this.value = v;
      params.push({ name, value: v });
    },
    cancelScheduledValues() {},
  });
  const node = (kind: string, extra: Record<string, unknown> = {}) => {
    created.push(kind);
    return { connect: (n: unknown) => n, disconnect() {}, ...extra };
  };
  let gains = 0;
  const ctx: AudioContextLike = {
    get state() {
      return state;
    },
    currentTime: 0,
    sampleRate: 48000,
    destination: node('destination') as never,
    resume: async () => {
      state = 'running';
    },
    suspend: async () => {
      state = 'suspended';
    },
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }) as never,
    createBufferSource: () =>
      node('source', { buffer: null, loop: false, start() {}, stop() {}, onended: null }) as never,
    createGain: () => node('gain', { gain: param(`gain${gains++}`) }) as never,
    createBiquadFilter: () => node('filter', { type: '', frequency: param('freq'), Q: param('Q') }) as never,
    createOscillator: () => node('osc', { type: '', frequency: param('oscfreq'), start() {}, stop() {} }) as never,
  };
  return { ctx, created, params };
}

const ev = (e: Partial<GameEvents> = {}): GameEvents => ({
  thrustLevel: 0,
  lowFuel: false,
  outOfFuel: false,
  coin: false,
  abort: false,
  crash: false,
  gameOver: false,
  ...e,
});

describe('thrustVolume (spec §11)', () => {
  it('is (level >> 1) | 1 while flying, 7 for abort, 0 otherwise', () => {
    expect(thrustVolume(0, true)).toBe(1);
    expect(thrustVolume(1, true)).toBe(1);
    expect(thrustVolume(6, true)).toBe(3);
    expect(thrustVolume(15, true)).toBe(7);
    expect(thrustVolume(16, true)).toBe(7);
    expect(thrustVolume(15, false)).toBe(0);
  });
});

describe('synth', () => {
  it('creates nothing before the first user gesture, and plays nothing', () => {
    let calls = 0;
    const f = fakeContext();
    const s = createSynth({ create: () => (calls++, f.ctx), record: true });
    s.frame(ev({ thrustLevel: 15, coin: true }), true);
    expect(calls).toBe(0);
    expect(f.created).toEqual(['destination']);
    expect(s.log).toEqual([]);
    s.unlock();
    s.unlock();
    expect(calls).toBe(1);
    expect(f.ctx.state).toBe('running');
  });

  it('thrust gain follows the thrust volume', () => {
    const f = fakeContext();
    const s = createSynth({ create: () => f.ctx, record: true });
    s.unlock();
    s.frame(ev({ thrustLevel: 0 }), true);
    s.frame(ev({ thrustLevel: 15 }), true);
    s.frame(ev({ thrustLevel: 15 }), false);
    expect(s.log.filter((l) => l.startsWith('thrust:'))).toEqual(['thrust:1', 'thrust:7', 'thrust:0']);
    expect(s.thrustGain).toBe(0);
  });

  it('each event triggers its sound', () => {
    const f = fakeContext();
    const s = createSynth({ create: () => f.ctx, record: true });
    s.unlock();
    s.frame(ev({ coin: true }), false);
    s.frame(ev({ crash: true }), true);
    s.frame(ev({ lowFuel: true }), true);
    s.frame(ev({ lowFuel: false }), true);
    expect(s.log).toEqual(['coin', 'thrust:1', 'explosion', 'beep:on', 'beep:off']);
    expect(f.created.filter((c) => c === 'osc').length).toBeGreaterThanOrEqual(2);
  });

  it('mute silences everything and unmute restores', () => {
    const f = fakeContext();
    const s = createSynth({ create: () => f.ctx, record: true });
    s.unlock();
    s.frame(ev({ thrustLevel: 15 }), true);
    expect(s.toggleMute()).toBe(true);
    expect(s.masterGain).toBe(0);
    s.frame(ev({ coin: true }), true);
    expect(s.log).not.toContain('coin');
    expect(s.toggleMute()).toBe(false);
    expect(s.masterGain).toBeGreaterThan(0);
  });

  it('survives an environment without Web Audio', () => {
    const s = createSynth({ create: () => null, record: true });
    expect(() => {
      s.unlock();
      s.frame(ev({ coin: true, crash: true, thrustLevel: 9 }), true);
      s.toggleMute();
    }).not.toThrow();
  });
});
