// Gameplay constants for the 1979 Atari Lunar Lander recreation.
// Every value cites docs/fidelity-spec.md (§n). Units: velocities are ROM "raw" units per
// frame; positions are zoomed-out screen-bytes (256 across one screen); fuel is hundredths.

/** Missions, in Select Game cycle order (§2.5, §3). */
export const Mission = { Training: 0, Cadet: 1, Prime: 2, Command: 3 } as const;
export type Mission = (typeof Mission)[keyof typeof Mission];
export const MISSION_NAMES = ['TRAINING', 'CADET', 'PRIME', 'COMMAND'] as const;

/** Physics tick: 6 NMIs at ~246 Hz (§1). */
export const FRAME_HZ = 40.96;
export const FRAME_DT = 1 / FRAME_HZ;

/** Raw velocity per HUD display unit (§1). */
export const RAW_PER_DISP = 64;
/** Raw velocity units per screen-byte of motion per frame (pos16 += vel >> 8; §1). */
export const RAW_PER_SB = 65536;
/** HUD altitude units per screen-byte (§1, estimate). */
export const ALT_PER_SB = 4;

/** thrust_to_acc[level] in raw/frame; index 16 is the abort burn (§2.2). */
export const THRUST_TO_ACC = [0, 2, 5, 8, 11, 13, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 255] as const;
export const MAX_LEVER = 15;
export const ABORT_LEVEL = 16;

/** ROM quarter-wave sine table, /256 (§4). */
export const SINE = [0, 50, 95, 154, 181, 205, 238, 251, 255] as const;

/** Gravity in raw/frame by mission (§3). */
export const GRAVITY = [17, 17, 34, 17] as const;

/** Main-engine burn factors (§5): hundredths/frame = (thrustValue * factor) >> 8. */
export const BURN_FACTOR = 218; // $DA
export const BURN_FACTOR_PRIME = 144; // $90, Prime only, thrustValue < 128
/** Rotation burn: 0.06 units/frame (§5). */
export const ROTATION_BURN = 6;
/** Abort burn: (255 * 218) >> 8 = 2.17 units/frame in every mission (§5). */
export const ABORT_BURN = (255 * BURN_FACTOR) >> 8;

/** Fuel (§5), in hundredths. */
export const FUEL_PER_COIN = 75000;
export const FUEL_MAX = 999999;
export const LOW_FUEL = 10000;
export const OUT_OF_FUEL = 100;
export const PERFECT_FUEL_BONUS = 5000;
/** Crash fuel allowance accrues 8 units per flight-second (§5). */
export const CRASH_ALLOWANCE_PER_SEC = 800;
/** Game ends this many seconds after fuel runs out, if not landed (§5). */
export const OUT_OF_FUEL_GRACE_SEC = 5;

/** Command yaw (§3). */
export const YAW_STEP = 16;
export const YAW_MAX = 992;
export const YAW_MIN = -1024;
export const YAW_SLOW = 64;
export const YAW_NUDGE = 80;

/** Abort (§2.4). */
export const ABORT_COUNTER = 100;
export const ABORT_MIN_COUNTER = 60;
export const ABORT_EXIT_VY = 0x1000;
export const ABORT_DEBOUNCE = 0x40;

/** Training friction: every 16 frames at phase 8, v -= v >> 5 (§3). */
export const FRICTION_PERIOD = 16;
export const FRICTION_PHASE = 8;

/** Max velocity magnitude (16-bit signed-magnitude; §1). */
export const VEL_MAX = 0xffff;

/** Starting state each round (§4), in screen-bytes and raw. */
export const START = {
  x: 0x1000 / 256,
  y: 0xaa80 / 256,
  vx: 0x3200,
  vy: -0x10,
  orientation: 16,
  /** Top clamp of the world (§7, estimate): the screen is 192 screen-bytes tall. */
  topY: 190,
} as const;

/** World and terrain (§7; geometry values are estimates). */
export const WORLD = {
  width: 1024,
  screenWidth: 256,
  screenHeight: 192,
  minGround: 8,
  maxGround: 115,
  minSlopeRise: 2,
  padSet: [2, 2, 2, 3, 3, 4, 4, 5],
  padWidth: { 2: 21, 3: 15, 4: 11, 5: 8 } as Record<number, number>,
  padMinY: 15,
  padMaxY: 85,
} as const;

/** Contact distance: 2 zoomed-in units = 0.5 screen-byte (§6). */
export const CONTACT_DIST = 0.5;

/** Landing thresholds in HUD disp units (§6). */
export const GOOD_MAX_V = 16;
export const HARD_MAX_VY = 32;
export const UPRIGHT = [7, 8, 9] as const;

/** Points per outcome, multiplied by the pad multiplier (§6). */
export const POINTS = { good: 50, hard: 15, crash: 5 } as const;

/** Frame counts (§6.2, §8, §9). */
export const LANDING_MESSAGE_FRAMES = 254;
export const FUEL_LOST_FRAMES = 127;
export const FLASH_FRAMES = 16;
export const INSERT_COIN_FLASH_FRAMES = 32;

/** Message text (§6.1). */
export const MESSAGES = {
  good: ['THAT WAS A GREAT LANDING', 'THE EAGLE HAS LANDED', 'THE COLUMBIA HAS LANDED', 'YOU HAVE LANDED'],
  hard: [
    'LIFE SUPPORT IS GONE',
    'YOUR TRIP IS ONE WAY',
    'YOU ARE HOPELESSLY MAROONED',
    'COMMUNICATION SYSTEM DESTROYED',
  ],
  crash: [
    'DESTROYED',
    'YOU CREATED A TWO MILE CRATER',
    'YOU JUST DESTROYED A 100 MEGABUCK LANDER',
    'THERE WERE NO SURVIVORS',
  ],
} as const;
