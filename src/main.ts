// Entry point: fixed-timestep simulation at the ROM's 40.96 Hz, rendered every animation
// frame with interpolation. `?test` exposes a hook for Playwright; `?seed=N` fixes the seed.
import { createKeyboard } from './input/keyboard';
import { createCamera, resetCamera, updateCamera, worldToScreen, type Camera } from './render/camera';
import { altitudeHud, drawHud, drawMessages } from './render/hud';
import { drawDebris, drawLander, drawTerrain } from './render/scene';
import { createVector } from './render/vector';
import { FRAME_DT, LANDING_MESSAGE_FRAMES } from './sim/constants';
import { createGame, GameState, stepGame, type Game, type GameEvents, type GameInput } from './sim/game';
import { orientation } from './sim/lander';
import { groundY } from './sim/terrain';
import { browserStorage, createHighScores } from './storage/highscores';

const params = new URLSearchParams(location.search);
const testMode = params.has('test');
const seed = Number(params.get('seed') ?? Math.floor(Math.random() * 2 ** 31));

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const vector = createVector(canvas);
const keyboard = createKeyboard();
const highScores = createHighScores(browserStorage());
const game: Game = createGame(seed, { qualifies: (score) => highScores.qualifies(score) });
const camera: Camera = createCamera();

/** Listeners for per-frame events (audio hooks in here). */
const eventListeners: ((ev: GameEvents, g: Game) => void)[] = [];

let prev = { x: game.lander.x, y: game.lander.y };
/** The lander object is replaced at every round start, including a new game's first round. */
let lastLander = game.lander;
let paused = false;
let accumulator = 0;
let lastTime = performance.now();

function step(input: GameInput): GameEvents {
  prev = { x: game.lander.x, y: game.lander.y };
  const ev = stepGame(game, input);
  if (ev.highScore) highScores.add(ev.highScore.initials, ev.highScore.score);
  if (game.lander !== lastLander) {
    lastLander = game.lander;
    prev = { x: game.lander.x, y: game.lander.y };
    resetCamera(camera, game.lander);
  }
  for (const l of eventListeners) l(ev, game);
  return ev;
}

function render(alpha: number): void {
  const s = game.lander;
  const flying = game.state === GameState.Playing;
  const x = flying ? prev.x + (s.x - prev.x) * alpha : s.x;
  const y = flying ? prev.y + (s.y - prev.y) * alpha : s.y;
  const inRound = game.state === GameState.Playing || game.state === GameState.Landed;

  if (inRound) {
    updateCamera(camera, { x, y, vx: s.vx }, groundY(game.terrain, x), altitudeHud(game, x, y));
  } else {
    camera.zoomed = false;
    camera.left = 0;
    camera.bottom = 0;
  }

  vector.begin();
  drawTerrain(vector, camera, game.terrain, game.frame);
  if (inRound) {
    if (game.crash && game.state === GameState.Landed) {
      drawDebris(vector, camera, game.terrain, game.crash, LANDING_MESSAGE_FRAMES - game.messageFrames);
    } else {
      drawLander(vector, camera, { x, y, orientation: orientation(s), thrust: flying ? s.thrust : 0 }, game.frame);
    }
  }
  drawHud(vector, game, x, y);
  drawMessages(vector, game);
  vector.end();
}

function frame(now: number): void {
  const dt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  if (!paused) {
    accumulator += dt;
    while (accumulator >= FRAME_DT) {
      step(keyboard.sample());
      accumulator -= FRAME_DT;
    }
  }
  render(paused ? 1 : accumulator / FRAME_DT);
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  if (!keyboard.handles(e.code)) return;
  e.preventDefault();
  keyboard.keyDown(e.code);
});
window.addEventListener('keyup', (e) => {
  if (!keyboard.handles(e.code)) return;
  e.preventDefault();
  keyboard.keyUp(e.code);
});
window.addEventListener('blur', () => keyboard.releaseAll());
window.addEventListener('resize', () => vector.resize());

vector.resize();
requestAnimationFrame(frame);

export interface TestHook {
  game: Game;
  camera: Camera;
  seed: number;
  pause(): void;
  resume(): void;
  /** Run n simulation frames with the given input (edges apply to the first frame only). */
  step(n: number, input?: Partial<GameInput>): GameEvents[];
  render(): void;
  /** World → logical screen coordinates through the live camera. */
  toScreen(x: number, y: number): { x: number; y: number };
  snapshot(): Record<string, unknown>;
  /** Put the ship `height` screen-bytes above the centre of a pad with that multiplier. */
  placeOverPad(multiplier: number, height: number, vyRaw?: number): void;
  onEvents(fn: (ev: GameEvents) => void): void;
  highScores: typeof highScores;
}

function registerEventListener(fn: (ev: GameEvents, g: Game) => void): void {
  eventListeners.push(fn);
}

if (testMode) {
  const none: GameInput = {
    thrustLevel: 0,
    rotate: 0,
    abortHeld: false,
    coin: false,
    start: false,
    select: false,
    confirm: false,
  };
  const hook: TestHook = {
    game,
    camera,
    seed,
    highScores,
    pause: () => void (paused = true),
    resume: () => {
      paused = false;
      lastTime = performance.now();
    },
    step(n, input = {}) {
      const out: GameEvents[] = [];
      for (let i = 0; i < n; i++) {
        const edges = i === 0 ? input : { ...input, coin: false, coins: 0, start: false, select: false, confirm: false };
        out.push(step({ ...none, ...edges }));
      }
      return out;
    },
    render: () => render(1),
    toScreen: (x, y) => worldToScreen(camera, x, y),
    snapshot: () => ({
      state: game.state,
      score: game.score,
      mission: game.mission,
      round: game.round,
      fuel: game.lander.fuel,
      outOfFuel: game.lander.outOfFuel,
      outcome: game.lastOutcome,
      message: game.message,
      zoomed: camera.zoomed,
      lever: keyboard.lever,
      lander: { x: game.lander.x, y: game.lander.y, vx: game.lander.vx, vy: game.lander.vy, orientation: orientation(game.lander) },
      highScores: highScores.list(),
    }),
    placeOverPad(multiplier, height, vyRaw = 0) {
      const pad = game.terrain.pads.find((p) => p.multiplier === multiplier)!;
      const s = game.lander;
      s.x = (pad.x0 + pad.x1) / 2;
      s.y = pad.y + height;
      s.vx = 0;
      s.vy = vyRaw;
      s.angle16 = 8 << 10;
      s.yawRate = 0;
      prev = { x: s.x, y: s.y };
      resetCamera(camera, s);
    },
    onEvents: (fn) => registerEventListener((ev) => fn(ev)),
  };
  (window as unknown as { __lunar: TestHook }).__lunar = hook;
}
