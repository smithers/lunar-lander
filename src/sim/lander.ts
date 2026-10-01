// Lander physics: one fixed-timestep frame at a time, following the ROM (spec §2–§5).
import {
  ABORT_BURN,
  ABORT_COUNTER,
  ABORT_DEBOUNCE,
  ABORT_EXIT_VY,
  ABORT_LEVEL,
  ABORT_MIN_COUNTER,
  BURN_FACTOR,
  BURN_FACTOR_PRIME,
  FRICTION_PERIOD,
  FRICTION_PHASE,
  GRAVITY,
  Mission,
  OUT_OF_FUEL,
  RAW_PER_SB,
  ROTATION_BURN,
  SINE,
  START,
  THRUST_TO_ACC,
  VEL_MAX,
  YAW_MAX,
  YAW_MIN,
  YAW_NUDGE,
  YAW_SLOW,
  YAW_STEP,
} from './constants';

export interface FrameInput {
  /** Thrust lever level, 0..15. */
  thrustLevel: number;
  /** +1 = Rotate Left (counter-clockwise), -1 = Rotate Right, 0 = none. */
  rotate: -1 | 0 | 1;
  abortHeld: boolean;
}

export interface LanderState {
  /** Position in screen-bytes (world x wraps; y is up). */
  x: number;
  y: number;
  /** Velocity in raw units per frame (y is up). */
  vx: number;
  vy: number;
  /** 16-bit angle; orientation = (angle16 >> 10) & 31, 8 = upright. */
  angle16: number;
  yawRate: number;
  yawNonzero: boolean;
  /** Effective thrust level this frame (0..16). */
  thrust: number;
  abortCounter: number;
  abortDebounce: number;
  /** Fuel in hundredths of a unit. */
  fuel: number;
  fuelUsedRound: number;
  outOfFuel: boolean;
}

export interface FrameEvents {
  outOfFuel: boolean;
  aborted: boolean;
  rotated: boolean;
}

export function createLander(fuel: number): LanderState {
  return {
    x: START.x,
    y: START.y,
    vx: START.vx,
    vy: START.vy,
    angle16: START.orientation << 10,
    yawRate: 0,
    yawNonzero: false,
    thrust: 0,
    abortCounter: 0,
    abortDebounce: ABORT_DEBOUNCE,
    fuel,
    fuelUsedRound: 0,
    outOfFuel: fuel < OUT_OF_FUEL,
  };
}

export function orientation(s: LanderState): number {
  return (s.angle16 >> 10) & 31;
}

/** Thrust acceleration (raw/frame) for an orientation and thrust_to_acc value (§4). */
export function thrustVector(o: number, acc: number, mission: Mission): { ax: number; ay: number } {
  if (acc === 0) return { ax: 0, ay: 0 };
  const m = o & 15;
  const mp = m >= 9 ? 16 - m : m;
  let ax = Math.floor((SINE[8 - mp]! * acc) / 256);
  let ay = Math.floor((SINE[mp]! * acc) / 256);
  if (mission === Mission.Prime) {
    ax += ax >> 1;
    ay += ay >> 1;
  }
  const q = (o >> 3) & 3;
  if (q === 1 || q === 2) ax = -ax;
  if (q === 2 || q === 3) ay = -ay;
  return { ax: ax || 0, ay: ay || 0 };
}

function drain(s: LanderState, hundredths: number, ev: FrameEvents): void {
  if (s.outOfFuel || hundredths <= 0) return;
  // The ROM adds the requested amount to fuel-used even when the tank runs dry ($647B → $6499).
  s.fuel -= hundredths;
  s.fuelUsedRound += hundredths;
  if (s.fuel < OUT_OF_FUEL) {
    s.fuel = 0;
    s.outOfFuel = true;
    ev.outOfFuel = true;
  }
}

function setAngleHigh(s: LanderState, high: number): void {
  s.angle16 = ((high & 0xff) << 8) | (s.angle16 & 0xff);
}

function rotateEasy(s: LanderState, input: FrameInput, mission: Mission, ev: FrameEvents): void {
  if (s.outOfFuel || input.rotate === 0) return;
  const high = ((s.angle16 >> 8) + input.rotate) & 0xff;
  if (mission === Mission.Training) {
    // Clamp to orientations 0..16 exactly as the ROM does ($63ED): stepping to 0xFF snaps
    // back to 0 and stepping to 0x41 snaps back to 0x40. A clamped frame burns no fuel.
    if (high === 0xff || high === 0x41) {
      s.angle16 = (high === 0xff ? 0 : 0x40) << 8;
      return;
    }
  }
  setAngleHigh(s, high);
  ev.rotated = true;
  drain(s, ROTATION_BURN, ev);
}

function rotateCommand(s: LanderState, input: FrameInput, ev: FrameEvents): void {
  s.angle16 = (s.angle16 + s.yawRate) & 0xffff;
  const slow = s.yawRate >= -YAW_SLOW && s.yawRate <= YAW_SLOW;
  if (s.outOfFuel) return;
  if (input.rotate !== 0) {
    let r = s.yawRate + YAW_STEP * input.rotate;
    if (r >= 1024) r = YAW_MAX;
    else if (r < YAW_MIN) r = YAW_MIN;
    s.yawRate = r;
    ev.rotated = true;
    drain(s, ROTATION_BURN, ev);
    return;
  }
  if (slow) {
    if (s.yawNonzero) s.yawRate = 0;
    else if (s.yawRate !== 0) s.yawRate = s.yawRate > 0 ? YAW_NUDGE : -YAW_NUDGE;
  }
  s.yawNonzero = s.yawRate !== 0;
}

/** Abort procedure for one frame (§2.4, ROM $64AA). */
function abortStep(s: LanderState, frame: number): void {
  if (s.outOfFuel) {
    s.thrust = 0;
    s.abortCounter = 0;
    return;
  }
  if (frame & 1) {
    const o = orientation(s);
    let n = o;
    if (o < 8) n = o + 1;
    else if (o > 8 && o < 25) n = o - 1;
    else if (o >= 25) n = (o + 1) & 31;
    if (n !== o) {
      s.angle16 = n << 10;
      s.yawRate = 0;
      s.yawNonzero = false;
    }
  }
  const mag = Math.abs(s.vx);
  s.vx = mag < 256 ? 0 : Math.sign(s.vx) * (mag - 256);
  if (orientation(s) !== 8) return;
  if (s.abortCounter < ABORT_MIN_COUNTER && s.vy >= ABORT_EXIT_VY) {
    s.abortCounter = 0;
    return;
  }
  s.thrust = ABORT_LEVEL;
  s.abortCounter--;
}

function clampVel(v: number): number {
  return Math.max(-VEL_MAX, Math.min(VEL_MAX, v));
}

/** Advance the lander one frame. `frame` is the global frame counter (for parity/period rules). */
export function stepLander(s: LanderState, input: FrameInput, mission: Mission, frame: number): FrameEvents {
  const ev: FrameEvents = { outOfFuel: false, aborted: false, rotated: false };

  // Abort button: triggers on the second consecutive held frame (§2.4, ROM $61C3).
  if (input.abortHeld) {
    s.abortDebounce <<= 1;
    if (s.abortDebounce & 0x100) {
      if (!s.outOfFuel) {
        s.abortCounter = ABORT_COUNTER;
        ev.aborted = true;
      }
    }
    s.abortDebounce &= 0xff;
  } else {
    s.abortDebounce = ABORT_DEBOUNCE;
  }

  if (s.abortCounter > 0) {
    abortStep(s, frame);
  } else {
    if (mission === Mission.Command) rotateCommand(s, input, ev);
    else rotateEasy(s, input, mission, ev);
    s.thrust = s.outOfFuel ? 0 : Math.max(0, Math.min(15, Math.floor(input.thrustLevel)));
  }

  const acc = THRUST_TO_ACC[s.thrust] ?? 0;
  const { ax, ay } = thrustVector(orientation(s), acc, mission);
  const factor = mission === Mission.Prime && acc < 128 ? BURN_FACTOR_PRIME : BURN_FACTOR;
  drain(s, s.thrust === ABORT_LEVEL ? ABORT_BURN : (acc * factor) >> 8, ev);

  // Integrate: position uses the previous velocity, then thrust and gravity (§4, ROM $6C68).
  s.x += s.vx / RAW_PER_SB;
  s.y += s.vy / RAW_PER_SB;
  s.vx = clampVel(s.vx + ax);
  s.vy = clampVel(s.vy + ay - GRAVITY[mission]);

  if (mission === Mission.Training && (frame & (FRICTION_PERIOD - 1)) === FRICTION_PHASE) {
    s.vx -= Math.sign(s.vx) * (Math.abs(s.vx) >> 5);
    s.vy -= Math.sign(s.vy) * (Math.abs(s.vy) >> 5);
  }

  if (s.y > START.topY) {
    s.y = START.topY;
    if (s.vy > 0) s.vy = 0;
  }
  return ev;
}
