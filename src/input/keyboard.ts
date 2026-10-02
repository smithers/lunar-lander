// Keyboard → per-frame game input (spec §2.6). Pure: the page forwards key codes; the game
// loop calls sample() once per simulation frame. The engine fires only while Space is held,
// at the power level set with ↑/↓ (the stand-in for the cabinet's thrust lever).
import { MAX_LEVER } from '../sim/constants';
import type { GameInput } from '../sim/game';

/** Frames per lever step while ↑/↓ is held (30 frames ≈ 0.73 s from 0 to full). */
export const LEVER_FRAMES_PER_STEP = 2;
/** The power level Space fires at until it is adjusted. */
export const LEVER_START = MAX_LEVER;

const RAISE = ['ArrowUp', 'KeyW'];
const LOWER = ['ArrowDown', 'KeyS'];
const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const FIRE = ['Space'];
const ABORT = ['KeyX'];
const CONFIRM = ['Space', 'Enter', 'NumpadEnter'];
const COIN = ['Digit5', 'Numpad5', 'KeyC'];
const START = ['Digit1', 'Numpad1'];
const SELECT = ['Tab'];
const MUTE = ['KeyM'];
const ALL = new Set([
  ...RAISE,
  ...LOWER,
  ...LEFT,
  ...RIGHT,
  ...FIRE,
  ...ABORT,
  ...CONFIRM,
  ...COIN,
  ...START,
  ...SELECT,
  ...MUTE,
]);

export interface KeyboardSample extends GameInput {
  /** Coin presses since the previous sample (coin is coins > 0). */
  coins: number;
  mute: boolean;
}

export interface Keyboard {
  keyDown(code: string): void;
  keyUp(code: string): void;
  releaseAll(): void;
  handles(code: string): boolean;
  sample(): KeyboardSample;
  readonly lever: number;
}

export function createKeyboard(): Keyboard {
  const down = new Set<string>();
  /** Keys pressed since the last sample, so a tap between frames is never lost. */
  const tapped = new Set<string>();
  let coins = 0;
  let lever: number = LEVER_START;
  let raiseHeld = 0;
  let lowerHeld = 0;

  const any = (codes: string[], set: Set<string>) => codes.some((c) => set.has(c));
  const active = (codes: string[]) => any(codes, down) || any(codes, tapped);

  return {
    keyDown(code) {
      if (down.has(code)) return; // OS key repeat
      down.add(code);
      tapped.add(code);
      if (COIN.includes(code)) coins++;
    },
    keyUp(code) {
      down.delete(code);
    },
    releaseAll() {
      // Window blur: drop held keys, queued edges and hold counters (coins already inserted stay).
      down.clear();
      tapped.clear();
      raiseHeld = 0;
      lowerHeld = 0;
    },
    handles: (code) => ALL.has(code),
    get lever() {
      return lever;
    },
    sample() {
      if (active(RAISE)) {
        if (raiseHeld % LEVER_FRAMES_PER_STEP === 0) lever = Math.min(MAX_LEVER, lever + 1);
        raiseHeld++;
      } else raiseHeld = 0;
      if (active(LOWER)) {
        if (lowerHeld % LEVER_FRAMES_PER_STEP === 0) lever = Math.max(0, lever - 1);
        lowerHeld++;
      } else lowerHeld = 0;

      const left = active(LEFT);
      const right = active(RIGHT);
      const s: KeyboardSample = {
        // A Space tap shorter than a frame still fires for that frame.
        thrustLevel: active(FIRE) ? lever : 0,
        rotate: left === right ? 0 : left ? 1 : -1,
        abortHeld: any(ABORT, down),
        coin: coins > 0,
        coins,
        start: any(START, tapped),
        select: any(SELECT, tapped),
        confirm: any(CONFIRM, tapped),
        mute: any(MUTE, tapped),
      };
      tapped.clear();
      coins = 0;
      return s;
    },
  };
}
