import { describe, expect, it } from 'vitest';
import { createKeyboard, LEVER_FRAMES_PER_STEP } from '../../src/input/keyboard';

describe('thrust: Space fires at the lever level (spec §2.6)', () => {
  it('no thrust unless Space is held; holding Space fires at the lever level (starts at 15)', () => {
    const k = createKeyboard();
    expect(k.lever).toBe(15);
    expect(k.sample().thrustLevel).toBe(0);
    k.keyDown('Space');
    expect(k.sample().thrustLevel).toBe(15);
    expect(k.sample().thrustLevel).toBe(15);
    k.keyUp('Space');
    expect(k.sample().thrustLevel).toBe(0);
  });
  it('a Space tap shorter than a frame still fires for one frame', () => {
    const k = createKeyboard();
    k.keyDown('Space');
    k.keyUp('Space');
    expect(k.sample().thrustLevel).toBe(15);
    expect(k.sample().thrustLevel).toBe(0);
  });
  it('down/up set the level one step per LEVER_FRAMES_PER_STEP frames, clamped to 0..15, without firing', () => {
    const k = createKeyboard();
    k.keyDown('ArrowDown');
    const levels: number[] = [];
    for (let i = 0; i < 40; i++) levels.push((k.sample(), k.lever));
    expect(levels[0]).toBe(14);
    expect(levels[LEVER_FRAMES_PER_STEP]).toBe(13);
    expect(levels[39]).toBe(0);
    k.keyUp('ArrowDown');
    k.keyDown('KeyW');
    for (let i = 0; i < 9; i++) expect(k.sample().thrustLevel).toBe(0); // adjusting alone never fires
    k.keyUp('KeyW');
    expect(k.lever).toBe(5);
    k.keyDown('Space');
    expect(k.sample().thrustLevel).toBe(5);
  });
  it('a quick tap of a lever key moves it one step', () => {
    const k = createKeyboard();
    k.keyDown('KeyS');
    k.keyUp('KeyS');
    k.sample();
    expect(k.lever).toBe(14);
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
  it('abort is a level on X; Space does not abort; confirm is an edge on Space or Enter', () => {
    const k = createKeyboard();
    k.keyDown('KeyX');
    const a = k.sample();
    expect(a.abortHeld).toBe(true);
    expect(a.confirm).toBe(false);
    expect(k.sample().abortHeld).toBe(true);
    k.keyUp('KeyX');
    k.keyDown('Space');
    const b = k.sample();
    expect(b.abortHeld).toBe(false);
    expect(b.confirm).toBe(true);
    expect(k.sample().confirm).toBe(false);
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
    expect(k.handles('KeyX')).toBe(true);
    expect(k.handles('KeyQ')).toBe(false);
  });
  it('releaseAll clears held keys (cutting thrust), queued edges and the lever ramp (window blur)', () => {
    const k = createKeyboard();
    k.keyDown('ArrowLeft');
    k.keyDown('Space');
    k.keyDown('KeyX');
    k.keyDown('ArrowDown');
    k.keyDown('Tab');
    k.releaseAll();
    const s = k.sample();
    expect(s.rotate).toBe(0);
    expect(s.abortHeld).toBe(false);
    expect(s.confirm).toBe(false);
    expect(s.select).toBe(false);
    expect(s.thrustLevel).toBe(0); // the engine stops when the window loses focus
    expect(k.lever).toBe(15); // and the queued lever step was dropped
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
