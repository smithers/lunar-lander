import { describe, expect, it } from 'vitest';
import {
  FUEL_PER_COIN,
  LANDING_MESSAGE_FRAMES,
  Mission,
  PERFECT_FUEL_BONUS,
  START,
} from '../../src/sim/constants';
import { createGame, stepGame, GameState, type Game, type GameInput } from '../../src/sim/game';
import { orientation } from '../../src/sim/lander';
import type { Terrain } from '../../src/sim/terrain';

const none: GameInput = { thrustLevel: 0, rotate: 0, abortHeld: false, coin: false, start: false, select: false, confirm: false };
const press = (k: Partial<GameInput>): GameInput => ({ ...none, ...k });

/** Flat terrain with a 5x pad right under the starting x. */
const padTerrain: Terrain = {
  width: 1024,
  points: [
    { x: 0, y: 30 },
    { x: 10, y: 20 },
    { x: 30, y: 20 },
    { x: 60, y: 60 },
    { x: 1024, y: 30 },
  ],
  pads: [{ x0: 10, x1: 30, y: 20, multiplier: 5 }],
};

function startedGame(qualifies: (score: number) => boolean = () => false): Game {
  const g = createGame(1, { qualifies, terrainFactory: () => padTerrain });
  stepGame(g, press({ coin: true }));
  stepGame(g, press({ start: true }));
  return g;
}

/** Put the ship just above the pad, upright, slow. */
function hoverOverPad(g: Game, vy = -200) {
  const s = g.lander;
  s.x = 20;
  s.y = 20.6;
  s.vx = 0;
  s.vy = vy;
  s.angle16 = 8 << 10;
}

function runUntil(g: Game, pred: () => boolean, max = 5000, input: GameInput = none) {
  for (let i = 0; i < max && !pred(); i++) stepGame(g, input);
}

describe('attract and credits', () => {
  it('stays in attract until a coin is inserted', () => {
    const g = createGame(1, { qualifies: () => false });
    for (let i = 0; i < 100; i++) stepGame(g, press({ start: true }));
    expect(g.state).toBe(GameState.Attract);
    const ev = stepGame(g, press({ coin: true }));
    expect(ev.coin).toBe(true);
    expect(g.state).toBe(GameState.Ready);
    expect(g.lander.fuel).toBe(FUEL_PER_COIN);
  });
  it('start begins a game in Training with a fresh round', () => {
    const g = startedGame();
    expect(g.state).toBe(GameState.Playing);
    expect(g.mission).toBe(Mission.Training);
    expect(g.score).toBe(0);
    expect(g.lander.y).toBe(START.y);
    expect(g.lander.x).toBeGreaterThanOrEqual(0);
    expect(g.lander.x).toBeLessThan(g.terrain.width);
    expect(orientation(g.lander)).toBe(16);
  });
  it('several coins in one frame all count', () => {
    const g = createGame(1, { qualifies: () => false });
    stepGame(g, press({ coin: true, coins: 2 }));
    expect(g.lander.fuel).toBe(2 * FUEL_PER_COIN);
  });
  it('coins stack and cap at 9999 units', () => {
    const g = createGame(1, { qualifies: () => false });
    for (let i = 0; i < 20; i++) stepGame(g, press({ coin: true }));
    expect(g.lander.fuel).toBe(999999);
  });
  it('a mid-game coin adds fuel and restores control after running dry', () => {
    const g = startedGame();
    g.lander.fuel = 150;
    runUntil(g, () => g.lander.outOfFuel, 100, press({ thrustLevel: 15 }));
    expect(g.lander.outOfFuel).toBe(true);
    stepGame(g, press({ coin: true }));
    expect(g.lander.fuel).toBeGreaterThan(FUEL_PER_COIN - 100);
    expect(g.lander.outOfFuel).toBe(false);
  });
});

describe('mission select', () => {
  it('cycles Training -> Cadet -> Prime -> Command -> Training at any time and resets yaw', () => {
    const g = startedGame();
    g.lander.yawRate = 500;
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      stepGame(g, press({ select: true }));
      seen.push(g.mission);
    }
    expect(seen).toEqual([Mission.Cadet, Mission.Prime, Mission.Command, Mission.Training]);
    expect(g.lander.yawRate).toBe(0);
    const r = createGame(1, { qualifies: () => false });
    stepGame(r, press({ select: true }));
    expect(r.mission).toBe(Mission.Cadet);
  });
  it('applies the selected mission physics', () => {
    const g = startedGame();
    stepGame(g, press({ select: true })); // Cadet
    stepGame(g, press({ select: true })); // Prime
    const vy = g.lander.vy;
    stepGame(g, none);
    expect(g.lander.vy).toBe(vy - 34);
  });
});

describe('landing and rounds', () => {
  it('a good landing scores 50 x multiplier, adds 50 fuel and shows the message', () => {
    const g = startedGame();
    hoverOverPad(g);
    const fuel = g.lander.fuel;
    runUntil(g, () => g.state === GameState.Landed, 20);
    expect(g.lastOutcome).toBe('good');
    expect(g.score).toBe(250);
    expect(g.lander.fuel).toBe(fuel + PERFECT_FUEL_BONUS);
    expect(g.message[0]).toBe('CONGRATULATIONS');
    expect(g.message).toContain('250 POINTS');
  });
  it('after the message, a new round starts with carried-over fuel and accumulated score', () => {
    const g = startedGame();
    hoverOverPad(g);
    runUntil(g, () => g.state === GameState.Landed, 20);
    const fuel = g.lander.fuel;
    for (let i = 0; i < LANDING_MESSAGE_FRAMES; i++) stepGame(g, none);
    expect(g.state).toBe(GameState.Playing);
    expect(g.round).toBe(2);
    expect(g.score).toBe(250);
    expect(g.lander.fuel).toBe(fuel);
    expect(g.lander.y).toBe(START.y);
    expect(g.roundSeconds).toBe(0);
  });
  it('a crash scores 5 x multiplier and applies the crash fuel penalty', () => {
    const g = startedGame();
    // Fly 10 seconds of free fall with no fuel used, then crash on the pad.
    for (let i = 0; i < 420; i++) {
      stepGame(g, none);
      if (g.state !== GameState.Playing) break;
      g.lander.y = 150;
    }
    const sec = g.roundSeconds;
    expect(sec).toBeGreaterThanOrEqual(9);
    hoverOverPad(g, -40 * 64);
    const before = g.lander.fuel;
    const ev = (() => {
      for (let i = 0; i < 20; i++) {
        const e = stepGame(g, none);
        if (e.crash) return e;
      }
      return null;
    })();
    expect(ev?.crash).toBe(true);
    expect(g.lastOutcome).toBe('crash');
    expect(g.score).toBe(25);
    const lost = before - g.lander.fuel;
    expect(lost).toBe(sec * 800 - g.lander.fuelUsedRound);
    expect(g.fuelLost).toBe(lost);
  });
  it('emits landed and per-frame thrust events', () => {
    const g = startedGame();
    const e = stepGame(g, press({ thrustLevel: 7 }));
    expect(e.thrustLevel).toBe(7);
    hoverOverPad(g);
    let landed = false;
    for (let i = 0; i < 20 && !landed; i++) landed = stepGame(g, none).landed === 'good';
    expect(landed).toBe(true);
  });
});

describe('fuel exhaustion and game over', () => {
  it('low-fuel warning flashes below 100 units', () => {
    const g = startedGame();
    g.lander.fuel = 9000;
    const flags = new Set<boolean>();
    for (let i = 0; i < 40; i++) flags.add(stepGame(g, none).lowFuel);
    expect(flags).toEqual(new Set([true, false]));
  });
  it('the game ends 5 seconds after running out of fuel while still flying', () => {
    const g = startedGame();
    g.lander.fuel = 150;
    stepGame(g, press({ thrustLevel: 15 }));
    stepGame(g, press({ thrustLevel: 15 }));
    stepGame(g, press({ thrustLevel: 15 }));
    expect(g.lander.outOfFuel).toBe(true);
    let frames = 0;
    while (g.state === GameState.Playing && frames < 1000) {
      g.lander.y = 150; // keep flying
      stepGame(g, none);
      frames++;
    }
    expect(g.state).toBe(GameState.GameOver);
    expect(frames).toBeGreaterThanOrEqual(5 * 41 - 2);
    expect(frames).toBeLessThanOrEqual(5 * 42 + 2);
  });
  it('landing with no fuel ends the game after the message', () => {
    const g = startedGame();
    g.lander.fuel = 0;
    g.lander.outOfFuel = true;
    hoverOverPad(g, -20 * 64); // hard landing: no bonus fuel
    runUntil(g, () => g.state === GameState.Landed, 20);
    expect(g.lastOutcome).toBe('hard');
    for (let i = 0; i < LANDING_MESSAGE_FRAMES; i++) stepGame(g, none);
    expect(g.state).toBe(GameState.GameOver);
  });
  it('game over returns to attract, or to initials entry when the score qualifies', () => {
    const g = startedGame(() => false);
    g.lander.fuel = 0;
    g.lander.outOfFuel = true;
    hoverOverPad(g, -20 * 64);
    runUntil(g, () => g.state === GameState.Attract, 2000);
    expect(g.state).toBe(GameState.Attract);

    const h = startedGame((s) => s > 0);
    h.lander.fuel = 0;
    h.lander.outOfFuel = true;
    hoverOverPad(h, -20 * 64);
    runUntil(h, () => h.state === GameState.Initials, 2000);
    expect(h.state).toBe(GameState.Initials);
  });
});

describe('initials entry', () => {
  function atInitials() {
    const g = startedGame((s) => s > 0);
    g.lander.fuel = 0;
    g.lander.outOfFuel = true;
    hoverOverPad(g, -20 * 64);
    runUntil(g, () => g.state === GameState.Initials, 2000);
    return g;
  }
  it('right steps forward, left steps back, confirm advances; three letters are saved', () => {
    const g = atInitials();
    stepGame(g, press({ rotate: -1 })); // right -> B
    stepGame(g, none);
    stepGame(g, press({ rotate: -1 })); // C
    stepGame(g, none);
    stepGame(g, press({ confirm: true }));
    stepGame(g, press({ rotate: 1 })); // left from A wraps to space
    stepGame(g, none);
    stepGame(g, press({ confirm: true }));
    stepGame(g, none);
    const ev = stepGame(g, press({ confirm: true }));
    expect(ev.highScore).toEqual({ initials: 'C A', score: 75 });
    expect(g.state).toBe(GameState.Attract);
  });
  it('holding a direction auto-repeats', () => {
    const g = atInitials();
    for (let i = 0; i < 40; i++) stepGame(g, press({ rotate: -1 }));
    expect(g.initials.letters[0]).not.toBe('A');
    expect(g.initials.letters[0]).not.toBe('B');
  });
  it('goes to Ready instead of attract if a coin was inserted meanwhile', () => {
    const g = atInitials();
    stepGame(g, press({ coin: true }));
    for (let i = 0; i < 3; i++) {
      stepGame(g, press({ confirm: true }));
      stepGame(g, none);
    }
    expect(g.state).toBe(GameState.Ready);
  });
});

describe('determinism', () => {
  it('same seed + inputs produce the same game', () => {
    const play = () => {
      const g = createGame(99, { qualifies: () => false });
      stepGame(g, press({ coin: true }));
      stepGame(g, press({ start: true }));
      for (let i = 0; i < 4000; i++) stepGame(g, press({ thrustLevel: (i >> 6) % 16, rotate: i % 300 < 20 ? 1 : 0 }));
      return JSON.stringify({ s: g.state, sc: g.score, l: g.lander, r: g.round });
    };
    expect(play()).toEqual(play());
  });
});

describe('review pass 1', () => {
  it('a perfect landing on an empty tank restores 50 units and play continues (ROM $6313, $6008)', () => {
    const g = startedGame();
    g.lander.fuel = 0;
    g.lander.outOfFuel = true;
    hoverOverPad(g);
    runUntil(g, () => g.state === GameState.Landed, 20);
    expect(g.lastOutcome).toBe('good');
    expect(g.lander.fuel).toBe(PERFECT_FUEL_BONUS);
    for (let i = 0; i < LANDING_MESSAGE_FRAMES; i++) stepGame(g, none);
    expect(g.state).toBe(GameState.Playing);
    expect(g.round).toBe(2);
  });
});

describe('review pass 2', () => {
  it('keeps the mountain range across rounds and randomizes the start offset; a new game regenerates it', () => {
    const g = createGame(5, { qualifies: () => false });
    stepGame(g, press({ coin: true }));
    stepGame(g, press({ start: true }));
    const terrain = g.terrain;
    const xs = new Set<number>();
    for (let r = 0; r < 4; r++) {
      xs.add(g.lander.x);
      g.lander.y = 0; // force a crash into the ground
      runUntil(g, () => g.state === GameState.Landed, 5);
      runUntil(g, () => g.state !== GameState.Landed, 400);
      expect(g.terrain).toBe(terrain);
    }
    expect(xs.size).toBe(4);
    runUntil(g, () => g.state === GameState.Ready || g.state === GameState.Attract, 3000, none);
    g.lander.fuel = 75000;
    g.state = GameState.Ready;
    stepGame(g, press({ start: true }));
    expect(g.terrain).not.toBe(terrain);
  });
});

describe('review: mission selection on the Ready screen', () => {
  it('a mission chosen after coin-up carries into the game', () => {
    const g = createGame(1, { qualifies: () => false });
    stepGame(g, press({ coin: true }));
    stepGame(g, press({ select: true }));
    expect(g.mission).toBe(Mission.Cadet);
    stepGame(g, press({ start: true }));
    expect(g.state).toBe(GameState.Playing);
    expect(g.mission).toBe(Mission.Cadet);
  });
  it('the mission resets to Training when a game ends', () => {
    const g = startedGame();
    stepGame(g, press({ select: true }));
    stepGame(g, press({ select: true }));
    expect(g.mission).toBe(Mission.Prime);
    g.lander.fuel = 0;
    g.lander.outOfFuel = true;
    hoverOverPad(g, -20 * 64);
    runUntil(g, () => g.state === GameState.GameOver, 2000);
    expect(g.mission).toBe(Mission.Training);
  });
});
