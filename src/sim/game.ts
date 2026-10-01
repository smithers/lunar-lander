// Game state machine: credits, coin-for-fuel, missions, rounds, game over and initials entry
// (spec §2.5, §5, §6.2, §9, §10). DOM-free; storage is injected through `qualifies`.
import {
  CRASH_ALLOWANCE_PER_SEC,
  FLASH_FRAMES,
  FUEL_LOST_FRAMES,
  FUEL_MAX,
  FUEL_PER_COIN,
  GAME_OVER_FRAMES,
  LANDING_MESSAGE_FRAMES,
  LOW_FUEL,
  Mission,
  NMI_PER_FRAME,
  NMI_PER_SECOND,
  OUT_OF_FUEL,
  OUT_OF_FUEL_GRACE_SEC,
  PERFECT_FUEL_BONUS,
} from './constants';
import { createLander, stepLander, type FrameInput, type LanderState } from './lander';
import { checkContact, landingMessage, Outcome } from './landing';
import { createRng, type Rng } from './rng';
import { generateTerrain, wrapX, type Terrain } from './terrain';

export const GameState = {
  Attract: 'attract',
  Ready: 'ready',
  Playing: 'playing',
  Landed: 'landed',
  GameOver: 'gameOver',
  Initials: 'initials',
} as const;
export type GameState = (typeof GameState)[keyof typeof GameState];

/** One frame of input. coin/start/select/confirm are press edges; the rest are levels. */
export interface GameInput extends FrameInput {
  coin: boolean;
  start: boolean;
  select: boolean;
  confirm: boolean;
}

export interface GameEvents {
  /** Effective thrust level this frame (0..16), for the thrust rumble. */
  thrustLevel: number;
  /** True on the "on" half of the low-fuel flash (drives the beep). */
  lowFuel: boolean;
  outOfFuel: boolean;
  coin: boolean;
  abort: boolean;
  crash: boolean;
  landed?: Outcome;
  gameOver: boolean;
  highScore?: { initials: string; score: number };
}

export interface GameConfig {
  /** Whether a final score earns a high-score entry (backed by storage outside the sim). */
  qualifies: (score: number) => boolean;
  /** Terrain source per game; defaults to the seeded generator. */
  terrainFactory?: (rng: Rng) => Terrain;
}

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
const REPEAT_DELAY = 15;
const REPEAT_EVERY = 6;

export interface Game {
  state: GameState;
  mission: Mission;
  score: number;
  round: number;
  frame: number;
  lander: LanderState;
  terrain: Terrain;
  rng: Rng;
  /** NMIs of flight this round; reset at round start and when fuel runs out (§5). */
  roundNmi: number;
  roundSeconds: number;
  /** NMIs of flight this round for the crash fuel allowance (not reset by running dry). */
  allowanceNmi: number;
  message: string[];
  messageFrames: number;
  lastOutcome?: Outcome;
  fuelLost: number;
  fuelLostFrames: number;
  /** Where the lander crashed this round, for the explosion. */
  crash?: { x: number; y: number; vx: number; vy: number };
  stateFrames: number;
  initials: { letters: string[]; pos: number; held: number };
  config: GameConfig;
}

export function createGame(seed: number, config: GameConfig): Game {
  const rng = createRng(seed);
  const factory = config.terrainFactory ?? generateTerrain;
  return {
    state: GameState.Attract,
    mission: Mission.Training,
    score: 0,
    round: 0,
    frame: 0,
    lander: createLander(0),
    terrain: factory(rng),
    rng,
    roundNmi: 0,
    roundSeconds: 0,
    allowanceNmi: 0,
    message: [],
    messageFrames: 0,
    fuelLost: 0,
    fuelLostFrames: 0,
    stateFrames: 0,
    initials: { letters: ['A', 'A', 'A'], pos: 0, held: 0 },
    config,
  };
}

function addFuel(g: Game, hundredths: number): void {
  const s = g.lander;
  s.fuel = Math.min(FUEL_MAX, s.fuel + hundredths);
  if (s.fuel >= OUT_OF_FUEL) s.outOfFuel = false;
}

/**
 * A new round keeps the game's mountain range and starts the ship over a random part of it
 * (the ROM randomizes the start offset each round; spec §7).
 */
function startRound(g: Game): void {
  g.round++;
  g.lander = createLander(g.lander.fuel);
  g.lander.x = wrapX(g.lander.x + g.rng.next() * g.terrain.width, g.terrain.width);
  g.roundNmi = 0;
  g.roundSeconds = 0;
  g.allowanceNmi = 0;
  g.message = [];
  g.messageFrames = 0;
  g.fuelLost = 0;
  g.fuelLostFrames = 0;
  g.crash = undefined;
  g.state = GameState.Playing;
}

function startGame(g: Game): void {
  g.terrain = (g.config.terrainFactory ?? generateTerrain)(g.rng);
  g.score = 0;
  g.round = 0;
  g.mission = Mission.Training;
  startRound(g);
}

function endGame(g: Game, ev: GameEvents): void {
  g.state = GameState.GameOver;
  g.stateFrames = GAME_OVER_FRAMES;
  ev.gameOver = true;
}

function afterGameOver(g: Game): void {
  if (g.config.qualifies(g.score)) {
    g.state = GameState.Initials;
    g.initials = { letters: ['A', 'A', 'A'], pos: 0, held: 0 };
    return;
  }
  g.state = g.lander.fuel > 0 ? GameState.Ready : GameState.Attract;
}

function resolveContact(g: Game, ev: GameEvents): boolean {
  const c = checkContact(g.lander, g.terrain);
  if (!c) return false;
  const s = g.lander;
  g.score += c.points;
  g.lastOutcome = c.outcome;
  ev.landed = c.outcome;
  if (c.outcome === Outcome.Good) addFuel(g, PERFECT_FUEL_BONUS);
  if (c.outcome === Outcome.Crash) {
    ev.crash = true;
    g.crash = { x: s.x, y: s.y, vx: s.vx, vy: s.vy };
    const allowance = Math.floor(g.allowanceNmi / NMI_PER_SECOND) * CRASH_ALLOWANCE_PER_SEC;
    const penalty = Math.min(FUEL_MAX, Math.max(0, allowance - s.fuelUsedRound));
    const lost = Math.min(penalty, s.fuel);
    s.fuel -= lost;
    if (s.fuel < OUT_OF_FUEL) {
      s.fuel = 0;
      s.outOfFuel = true;
    }
    g.fuelLost = lost;
    g.fuelLostFrames = lost > 0 ? FUEL_LOST_FRAMES : 0;
  }
  g.message = [...landingMessage(c.outcome, g.rng), `${c.points} POINTS`];
  g.messageFrames = LANDING_MESSAGE_FRAMES;
  g.state = GameState.Landed;
  return true;
}

function stepInitials(g: Game, input: GameInput, ev: GameEvents): void {
  const ini = g.initials;
  if (input.rotate !== 0) {
    const step = ini.held === 0 || (ini.held >= REPEAT_DELAY && (ini.held - REPEAT_DELAY) % REPEAT_EVERY === 0);
    if (step) {
      const i = LETTERS.indexOf(ini.letters[ini.pos]!);
      // Rotate Right (-1) steps forward through the alphabet, Rotate Left (+1) back.
      const n = (i - input.rotate + LETTERS.length) % LETTERS.length;
      ini.letters[ini.pos] = LETTERS[n]!;
    }
    ini.held++;
  } else {
    ini.held = 0;
  }
  if (input.confirm) {
    ini.pos++;
    if (ini.pos >= ini.letters.length) {
      ev.highScore = { initials: ini.letters.join(''), score: g.score };
      g.state = g.lander.fuel > 0 ? GameState.Ready : GameState.Attract;
    }
  }
}

/** Advance the whole game one frame. */
export function stepGame(g: Game, input: GameInput): GameEvents {
  const ev: GameEvents = {
    thrustLevel: 0,
    lowFuel: false,
    outOfFuel: false,
    coin: false,
    abort: false,
    crash: false,
    gameOver: false,
  };
  g.frame++;

  if (input.coin) {
    addFuel(g, FUEL_PER_COIN);
    ev.coin = true;
    if (g.state === GameState.Attract) g.state = GameState.Ready;
  }
  if (input.select) {
    g.mission = ((g.mission + 1) % 4) as Mission;
    g.lander.yawRate = 0;
    g.lander.yawNonzero = false;
  }
  if (g.fuelLostFrames > 0) g.fuelLostFrames--;

  switch (g.state) {
    case GameState.Attract:
      break;
    case GameState.Ready:
      if (input.start && g.lander.fuel >= OUT_OF_FUEL) startGame(g);
      break;
    case GameState.Playing: {
      const fe = stepLander(g.lander, input, g.mission, g.frame);
      ev.thrustLevel = g.lander.thrust;
      ev.abort = fe.aborted;
      g.roundNmi += NMI_PER_FRAME;
      g.allowanceNmi += NMI_PER_FRAME;
      if (fe.outOfFuel) {
        ev.outOfFuel = true;
        g.roundNmi = 0;
      }
      g.roundSeconds = Math.floor(g.roundNmi / NMI_PER_SECOND);
      if (resolveContact(g, ev)) break;
      if (g.lander.outOfFuel && g.roundSeconds >= OUT_OF_FUEL_GRACE_SEC) endGame(g, ev);
      break;
    }
    case GameState.Landed:
      if (--g.messageFrames <= 0) {
        if (g.lander.fuel < OUT_OF_FUEL) endGame(g, ev);
        else startRound(g);
      }
      break;
    case GameState.GameOver:
      if (--g.stateFrames <= 0) afterGameOver(g);
      break;
    case GameState.Initials:
      stepInitials(g, input, ev);
      break;
  }

  const flying = g.state === GameState.Playing || g.state === GameState.Landed;
  ev.lowFuel =
    flying && !g.lander.outOfFuel && g.lander.fuel < LOW_FUEL && ((g.frame / FLASH_FRAMES) & 1) === 1;
  return ev;
}
