import { describe, expect, it } from 'vitest';
import { createKeyboard, LEVER_FRAMES_PER_STEP } from '../../src/input/keyboard';

describe('keyboard thrust lever (spec §2.6)', () => {
  it('raises one level per LEVER_FRAMES_PER_STEP frames held and clamps at 15', () => {
    const k = createKeyboard();
    k.keyDown('ArrowUp');
    const levels: number[] = [];
    for (let i = 0; i < 40; i++) levels.push(k.sample().thrustLevel);
    expect(levels[0]).toBe(1);
    expect(levels[LEVER_FRAMES_PER_STEP]).toBe(2);
    expect(levels[39]).toBe(15);
    expect(Math.max(...levels)).toBe(15);
  });
  it('holds its level when released and lowers with ArrowDown / S, clamping at 0', () => {
    const k = createKeyboard();
    k.keyDown('KeyW');
    for (let i = 0; i < 9; i++) k.sample();
    k.keyUp('KeyW');
    const held = k.sample().thrustLevel;
    expect(held).toBe(5);
    expect(k.sample().thrustLevel).toBe(5);
    k.keyDown('KeyS');
    for (let i = 0; i < 40; i++) k.sample();
    expect(k.sample().thrustLevel).toBe(0);
  });
  it('a quick tap between frames still moves the lever one step', () => {
    const k = createKeyboard();
    k.keyDown('ArrowUp');
    k.keyUp('ArrowUp');
    expect(k.sample().thrustLevel).toBe(1);
  });
});

describe('key mapping', () => {
  it('maps rotation: left = +1 (counter-clockwise), right = -1, both = 0', () => {
    const k = createKeyboard();
    k.keyDown('ArrowLeft');
    expect(k.sample().rotate).toBe(1);
    k.keyDown('KeyD');
    expect(k.sample().rotate).toBe(0);
    k.keyUp('ArrowLeft');
    expect(k.sample().rotate).toBe(-1);
  });
  it('abort is a level on Space; confirm is an edge on Space or Enter', () => {
    const k = createKeyboard();
    k.keyDown('Space');
    const a = k.sample();
    expect(a.abortHeld).toBe(true);
    expect(a.confirm).toBe(true);
    const b = k.sample();
    expect(b.abortHeld).toBe(true);
    expect(b.confirm).toBe(false);
    k.keyUp('Space');
    k.keyDown('Enter');
    expect(k.sample().confirm).toBe(true);
  });
  it('coin (5 or C), start (1), select (Tab) and mute (M) are single press edges', () => {
    const k = createKeyboard();
    for (const code of ['Digit5', 'KeyC']) {
      k.keyDown(code);
      expect(k.sample().coin).toBe(true);
      expect(k.sample().coin).toBe(false);
      k.keyUp(code);
    }
    k.keyDown('Digit1');
    expect(k.sample().start).toBe(true);
    k.keyDown('Tab');
    expect(k.sample().select).toBe(true);
    k.keyDown('KeyM');
    expect(k.sample().mute).toBe(true);
    expect(k.sample().mute).toBe(false);
  });
  it('OS key repeat (repeated keyDown while held) does not double-count edges', () => {
    const k = createKeyboard();
    k.keyDown('KeyC');
    k.keyDown('KeyC');
    k.keyDown('KeyC');
    expect(k.sample().coin).toBe(true);
    k.keyDown('KeyC');
    expect(k.sample().coin).toBe(false);
  });
  it('two separate coin presses between frames both count', () => {
    const k = createKeyboard();
    k.keyDown('KeyC');
    k.keyUp('KeyC');
    k.keyDown('KeyC');
    k.keyUp('KeyC');
    const s = k.sample();
    expect(s.coins).toBe(2);
    expect(s.coin).toBe(true);
    expect(k.sample().coins).toBe(0);
  });
  it('reports whether a key is handled (so the page can preventDefault)', () => {
    const k = createKeyboard();
    expect(k.handles('Tab')).toBe(true);
    expect(k.handles('Space')).toBe(true);
    expect(k.handles('KeyQ')).toBe(false);
  });
  it('releaseAll clears held keys, queued edges and the lever ramp (window blur)', () => {
    const k = createKeyboard();
    k.keyDown('ArrowLeft');
    k.keyDown('Space');
    k.keyDown('ArrowUp');
    k.keyDown('Tab');
    k.releaseAll();
    const s = k.sample();
    expect(s.rotate).toBe(0);
    expect(s.abortHeld).toBe(false);
    expect(s.confirm).toBe(false);
    expect(s.select).toBe(false);
    expect(s.thrustLevel).toBe(0);
  });
});

describe('taps between frames (initials entry)', () => {
  it('a quick arrow tap still rotates for one frame', () => {
    const k = createKeyboard();
    k.keyDown('ArrowRight');
    k.keyUp('ArrowRight');
    expect(k.sample().rotate).toBe(-1);
    expect(k.sample().rotate).toBe(0);
  });
});
