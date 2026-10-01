# Lunar Lander (Atari, 1979) — Fidelity Spec

The reference for every gameplay constant and rule in this recreation. Code in
`src/sim/constants.ts` cites the section numbers here. Each value is tagged:

- **[sourced: X]** — taken from source X (see §13). `DIS $addr` means read from the annotated
  6502 disassembly of the rev-2 `llander` ROM at that address.
- **[estimate]** — not confirmable from available sources; a reasoned value to tune in
  playtest (collected in §12).
- **[addition]** — deliberately not in the original; required by this project's plan.

No ROM code, ROM data tables (terrain, vector shapes, strings beyond short message text) or
sampled audio are copied. Numeric constants and rules are re-implemented from documentation.

---

## 1. Units and timing

| Item | Value | Tag |
|---|---|---|
| Game frame (physics tick) | 1 frame = 6 NMIs; NMI ≈ 246.1 Hz ⇒ **≈ 41.0 Hz** (use 40.96 Hz, Δt ≈ 24.4 ms) | [sourced: MAME, DIS] |
| Velocity | 16-bit signed-magnitude **raw** units per frame | [sourced: DIS $6C68] |
| Position | 16-bit; high byte ≈ zoomed-out screen coordinate (0–255 across one screen width) | [sourced: DIS $6C68] (interpretation) |
| Position update | zoomed out `pos += vel >> 8`; zoomed in `pos += vel >> 6` in 4× units — physically identical, so the sim integrates `pos += vel / 256` in zoomed-out units always | [sourced: DIS $6C7E] |
| HUD speed | **disp = raw / 64** (top 10 bits) | [sourced: DIS $751B] |
| HUD altitude | (ship y − ground y directly below) in zoomed-out screen-bytes × 4 | [estimate] |
| Rendering | sim runs at 40.96 Hz fixed step; the renderer interpolates at display rate (60 Hz+) | design |

Sanity check: starting vx = 200 disp crosses one screen in ≈ 32 s, and a free fall from the
start height takes ≈ 25 s. Both match how the arcade plays.

## 2. Controls

### 2.1 Original inputs
Start, Select Game, Abort, Rotate Left, Rotate Right, and an analog thrust lever (8-bit pot,
0–254) [sourced: MAME IN1, DIS].

### 2.2 Thrust lever
- The pot is smoothed into **16 thrust levels, 0–15** [sourced: DIS NMI].
- `thrust_to_acc[level]` = `0, 2, 5, 8, 11, 13, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28` raw/frame [sourced: DIS $76F6]. The curve is non-linear.
- Level 16 (abort only) = 255 [sourced: DIS $76F6].

### 2.3 Rotation
- **32 orientations** (index 0–31, 11.25° each): 0 = thrust points right, **8 = upright**, 16 = thrust points left, 24 = down [sourced: DIS].
- The angle is a 16-bit value `angle16`; orientation = `(angle16 >> 10) & 31`, so there are 4
  "angle-high" sub-steps per orientation [sourced: DIS $6357, $63E3].
- **Training, Cadet and Prime** (`ship_command_yaw_easy`, DIS $63D4): while fuel > 0 and a
  rotate button is held, `angleHigh += 1` (Rotate Left, counter-clockwise, orientation
  increasing) or `−= 1` (Rotate Right) per frame. That is one visible step per 4 frames ≈ 10
  steps/s, a full turn in ≈ 3.1 s.
  - **Training clamp:** if angleHigh would wrap below 0 it is set to 0 (orientation 0).
  - If it would pass 0x40 it is set to 0x40 (orientation 16), so the thrust direction stays in
    the upper half [sourced: DIS $63E9–$63FA].
- Command uses rotational momentum (§3).
- Rotating burns fuel (§4). No rotation with zero fuel [sourced: DIS].

### 2.4 Abort
[sourced: DIS $61C3, $64AA; AH for the overall fuel cost]
- Ignored when fuel is 0. Otherwise sets the abort counter to 100.
- Every other frame the ship rotates one orientation toward upright (8).
- Every frame |vx| drops by 256 raw (4 disp) until it reaches 0.
- Once upright, fires thrust level 16 (255 raw/frame along the heading).
- Burns for **at least 40 frames** (counter 100 → 60) and continues until vy ≥ +64 disp (raw ≥ 4096, upward).
- Rotation input is ignored during an abort.
- Fuel cost is 2.17 units per frame of abort burn (≈ 120–180 units per abort).
- No direct score effect.

### 2.5 Mission select
- Each press of Select Game cycles Training → Cadet → Prime → Command → Training [sourced: DIS $62AB].
- It works at any time, mid-flight included. A change resets the yaw rate and reloads gravity.
- Every new game starts in **Training** [sourced: DIS $6029].

### 2.6 Keyboard mapping (this recreation)
| Action | Keys |
|---|---|
| Raise / lower thrust lever (one level per 2 frames held) | ↑ / W, ↓ / S |
| Rotate left / right | ← / A, → / D |
| Abort | Space |
| Insert coin | 5 or C |
| Start | 1 |
| Select Game (cycle mission) | Tab |
| Mute | M |

The lever ramp rate is [estimate]; the rest is [addition] (keyboard stands in for the cabinet).
The lever holds its level when keys are released, like a real lever.

## 3. Difficulty modes

| Mode | Gravity (raw/frame) | Friction | Rotation | Thrust | Main-engine burn factor |
|---|---|---|---|---|---|
| Training | 17 | yes | controlled, limited to orientations 0–16 (±90° from upright) | ×1 | 218 ($DA) |
| Cadet | 17 | no | controlled, full 360° | ×1 | 218 |
| Prime | **34** | no | controlled | **×1.5** | **144 ($90)** |
| Command | 17 | no | **momentum** | ×1 | 218 |

[sourced: DIS mission table, gravity table `11,11,22,11` at $62A7]

- **Gravity labels:** the printed cards call Training gravity "light", but the ROM table gives Training the same gravity as Cadet and Command. **Follow the ROM.**
- **Training friction:** once every 16 frames (frame counter & 15 == 8), both velocity components lose 1/32 (`v -= v >> 5`) [sourced: DIS $60B3, $6509].
- **Command momentum** (`ship_command_yaw`, DIS $633C–$63D1). This is exact; implement it as
  written. State: `yawRate` (16-bit signed) and the flag `yawNonzero`, both 0 at reset and on a
  mission change. Each frame, unless aborting:
  1. `angle16 += yawRate`, wrapping mod 65536.
  2. `slow = (−64 ≤ yawRate ≤ 64)`.
  3. If fuel ≤ 0, stop here (no control).
  4. If a rotate button is held, `yawRate += +16` (left) or `−16` (right).
     - The clamp is tested on the **result**: if it is ≥ +1024 (high byte ≥ 4) it becomes
       **+992** (0x03E0); if it is < −1024 it becomes **−1024** (0xFC00).
     - So +1008 is reachable (992 + 16), and the next increment clamps back to 992. The
       positive rate cycles 992 ↔ 1008 while the button is held [sourced: DIS $638E–$63A2].
     - Burn rotation fuel (§5). **Do not** update `yawNonzero`.
  5. If no button is held:
     - If `slow`: if `yawNonzero` is set, `yawRate = 0`; else if `yawRate ≠ 0`,
       `yawRate = +80` when positive or `−80` when negative.
     - Then, whether or not slow, `yawNonzero = (yawRate ≠ 0)`.
  - **Consequence:** tapping from rest gives a **persistent ±80 rate** (one full turn in ≈ 10 s)
    that does not decay. A counter-tap brings it into the slow band, and on release it stops.
    The maximum rate (≈ 1000) turns once in ≈ 0.8 s.
- **No mode score multiplier** and no mode with extra crash tolerance [sourced: DIS].

## 4. Physics

[sourced: DIS $6B32, $6C68]
- Per frame, per axis: `vel += thrust_component`, and `vy -= gravity` (y is up).
- **Thrust vector** (`ship_compute_accel_xy`, DIS $6B32). Use the ROM's own coefficients, **not**
  `Math.sin`/`Math.cos`; the ROM table deviates from true sine by up to ≈ 8% (index 3: 154 vs
  142).
  - `SINE = [0, 50, 95, 154, 181, 205, 238, 251, 255]` (quarter wave, /256) [sourced: DIS $76E9].
  - With `a = thrust_to_acc[level]` (unscaled; 255 during abort), `o` = orientation, `m = o & 15`,
    `m' = m ≥ 9 ? 16 − m : m`:
    - `|ax| = floor(SINE[8 − m'] × a / 256)`
    - `|ay| = floor(SINE[m'] × a / 256)`
  - Signs by quadrant `o >> 3`: 0 → (+,+), 1 → (−,+), 2 → (−,−), 3 → (+,−). That is, the
    direction is θ = o × 11.25° with x = right and y = up, and orientation 8 = straight up
    [sourced: DIS $6B32–$6B6E; quadrant signs derived from the geometry].
  - Truncation is the high byte of an 8×8 multiply (`mult16`).
  - **Prime ×1.5 is applied after truncation, per component:** `|c| += floor(|c| / 2)`, abort
    included [sourced: DIS $6CC7–$6CD7]. For example, full upright thrust in Prime is
    27 + 13 = **40** raw/frame, not floor(255 × 42 / 256) = 41.
- Max upright thrust = 27 raw/frame (thrust/weight ≈ 1.6); Prime = 40 (≈ 1.18 against gravity 34).
- **Starting state, every round** [sourced: DIS $780F/$7813]:
  - x = 0x1000, y = 0xAA80 (position units)
  - **vx = +0x3200 raw (+200 disp, drifting right)**; vy magnitude **0x0010 raw** (0.25 disp),
    taken as downward [sourced: DIS $7813 for magnitude; sign is an estimate]
  - orientation 16 (on its side, thrust pointing left, so burning brakes the drift)
  - thrust level 0
- **No drag** except Training friction.

## 5. Fuel

| Item | Value | Tag |
|---|---|---|
| Fuel per coin | **750** default. Rev-1 ROMs offer 450 / 600 / 750 / 900; rev-2 ROMs keep those four and add 1100 / 1300 / 1550 / 1800 (eight options) | [sourced: MAME, KLOV-DIP, DIS $632A] |
| Storage / display | BCD with hundredths; 4-digit display, **capped at 9999** | [sourced: DIS] |
| Main-engine burn | `(thrustValue × factor) >> 8` hundredths of a unit per frame, where `thrustValue` = the unscaled `thrust_to_acc` entry. `factor` = 218 ($DA), or 144 ($90) **in Prime only when thrustValue < 128**. Abort's value 255 always uses 218, giving 217 hundredths = 2.17 units/frame in every mode. Full normal thrust ≈ 0.23/frame ≈ 9.7/s; Prime ≈ 6.4/s | [sourced: DIS $6B71–$6B7F] |
| Rotation burn | 0.06 units per frame while a rotate button is held | [sourced: DIS] |
| Abort burn | 2.17 units per frame of abort burn | [sourced: DIS] |
| Low fuel | fuel < 100: "LOW ON FUEL" flashes (16 frames on / 16 off) and the 3 kHz tone beeps in step | [sourced: DIS $689E, KLOV] |
| Out of fuel | fuel < 1: "OUT OF FUEL" shown; thrust, rotation and abort disabled; the round timer resets. If the ship hasn't landed **5 s** later, the game ends | [sourced: DIS $647B, $61B3] |
| Landing with 0 fuel | game ends after the landing message | [sourced: DIS] |
| Carry-over | remaining fuel carries into the next round | [sourced: WIKI, DIS] |
| Perfect-landing bonus | **+50 fuel units** | [sourced: DIS $61E2, AH] |
| Coins | each coin adds fuel per coin **at any time**, including mid-flight; limited only by the 9999 cap | [sourced: DIS $62E6, KLOV] |
| Free-play | not implemented | — |

**Crash fuel penalty** [sourced: DIS $6B96, $7B14]:
- Each round an allowance accumulates at 8 units per flight-second.
- On a crash, the player loses `max(0, allowance − fuelUsedThisRound)` units, capped at 9999.
- The screen shows "AUXILIARY FUEL TANKS DESTROYED" / "<n> FUEL UNITS LOST" for ≈ 3.1 s.

## 6. Landing outcomes and scoring

[sourced: DIS $7203, $7576, $6BE0, $68D6; AH]

- **Contact:** height of the ship's feet above the surface < 2 (zoomed-in units).
- Any non-foot part of the lander intersecting terrain is a crash.
- Speeds below are in **disp** units, with angle as the orientation index.

| Outcome | Orientation | \|vy\| | \|vx\| | Points (× multiplier) | Extra |
|---|---|---|---|---|---|
| **Good** ("perfect") | 7, 8 or 9 | < 16 | < 16 | **50** | +50 fuel |
| **Hard** | 7, 8 or 9 | 16–31 | < 16 | **15** | — |
| **Crash** | any other, or \|vy\| ≥ 32, or \|vx\| ≥ 16, or non-flat ground | | | **5** | crash fuel penalty (§5) |

- **Multiplier:** 2×, 3×, 4× or 5× on a pad; **1× anywhere else**. Higher multipliers are narrower pads [sourced: DIS `landing_bonus_amount` $6C45, WIKI]. Example: a good landing on 5× = 250 points.
- **Landing off a pad:** classified the same way. Off-pad terrain is sloped, so in practice it crashes. A flat non-pad segment would score ×1 [estimate].

### 6.1 Messages
English strings; one of four is chosen at random per outcome [sourced: DIS].

- **Good:** "CONGRATULATIONS", then one of
  - "THAT WAS A GREAT LANDING"
  - "THE EAGLE HAS LANDED"
  - "THE COLUMBIA HAS LANDED"
  - "YOU HAVE LANDED"
- **Hard:** "YOU LANDED HARD", then one of
  - "LIFE SUPPORT IS GONE"
  - "YOUR TRIP IS ONE WAY"
  - "YOU ARE HOPELESSLY MAROONED"
  - "COMMUNICATION SYSTEM DESTROYED"
- **Crash:** one of
  - "DESTROYED"
  - "YOU CREATED A TWO MILE CRATER"
  - "YOU JUST DESTROYED A 100 MEGABUCK LANDER"
  - "THERE WERE NO SURVIVORS"
- **Always:** "<n> POINTS"
- **Crash with fuel loss:** "AUXILIARY FUEL TANKS DESTROYED", "<n> FUEL UNITS LOST"
- **Other states:** "LOW ON FUEL", "OUT OF FUEL", "GAME OVER" [estimate for "GAME OVER" wording]

There is **no** "lost in space" message in the ROM.

### 6.2 Round flow
- The landing or crash message shows for **≈ 6.2 s** (254 frames). Then a new round starts from the §4 starting state with carried-over fuel [sourced: DIS].
- The score accumulates across rounds.
- **Game over:** out of fuel (5 s rule, §5) or landing with 0 fuel. Coins inserted before then keep the game going.

## 7. World, terrain and camera

- **Logical display:** 4:3 (MAME visible area 1044 × 800 DVG units). The browser letterboxes to 4:3 [sourced: MAME].
- **Terrain:**
  - The original is a fixed, jagged mountain range that wraps horizontally. Each round randomizes the start offset and the active pad set [sourced: DIS $6235, WIKI].
  - We **generate our own** jagged range from a seed, since ROM terrain data is not copied. It is regenerated per game, with the pad set re-randomized each round.
  - World width **4 screens**, wrapping [estimate].
  - Peaks reach up to ≈ 60% of screen height [estimate].
- **Pads:**
  - Flat segments; at least 4 pads visible per world (one each of 2×, 3×, 4×, 5×), plus extra 2× pads [estimate].
  - Widths 2× ≈ 3.5 ship widths, 3× ≈ 2.5, 4× ≈ 1.8, 5× ≈ 1.3 [estimate].
  - The multiplier label ("2X"…"5X") under each pad **flashes**, 16 frames on / 16 off [sourced: DIS $6846].
- **Horizontal scroll:** when the ship's on-screen x reaches the left or right 1/8 band (screen-byte $20 / $E0), the ship's screen x freezes and the terrain scrolls instead [sourced: DIS $712A].
- **Top:** the ship cannot leave through the top. y is clamped at the top of the world, and vy is zeroed if it would exceed it. There is no off-top death [estimate].
- **Zoom:**
  - Two scales; the close-up is **×4** [sourced: DIS].
  - On switching, the view re-centers on the ship [sourced: WIKI].
  - Zoom in when altitude (HUD units) < **200**; zoom back out when > 260 (hysteresis) [estimate].
  - While zoomed, the ship stays near center and the terrain scrolls near the edges [sourced: DIS (interpretation)].

## 8. Display and HUD

- **Look:** white vector lines on black; bright end-points and a soft phosphor glow [sourced: WIKI/KLOV for the B&W vector monitor].
- **Text:** a line-segment vector font in the Atari style, our own glyph design [addition].
- **Top-left column:** `SCORE`, `TIME` (m:ss, per round, counts only in flight, reset each round), `FUEL` (4 digits) [sourced: WIKI, DIS $626E].
- **Top-right column:** `ALTITUDE`, `HORIZONTAL SPEED`, `VERTICAL SPEED`, each followed by a direction arrow (→ ←, ↑ ↓). The arrow is suppressed when the speed is 0 [sourced: WIKI, DIS $7544].
- **HUD values:** speeds are shown as |disp| integers [sourced: DIS].
- **Lander:** our own vector drawing of the Apollo LM silhouette (ascent stage, descent stage, 2 legs with feet), rotated through 32 orientations.
- **Flame:** length scales with thrust level [estimate].
- **Explosion:** the lander breaks into **4 debris pieces**. Each launches with an upward velocity of 0x0A00 raw plus a random horizontal spread, under gravity 0x41 [sourced: DIS $6209; horizontal spread is an estimate].
- **Flash rates:** LOW ON FUEL and pad labels 16 frames; INSERT COINS 32 frames [sourced: DIS].

## 9. Attract mode and coin-up

- **Attract:** the terrain is shown; "<n> FUEL UNITS PER COIN"; "INSERT COINS" flashing every 32 frames [sourced: DIS].
- **Recreation additions to attract** [addition]:
  - The high-score table (§10).
  - The keyboard mapping (§2.6).
  - Cycle the attract pages every ≈ 6 s.
- **After coin-up:** "SELECT OPTION", "PUSH START", "<fuel> FUEL UNITS" [sourced: DIS].
  - The mission (Training default) shows on screen in place of the cabinet lamp [addition].
  - Start requires fuel > 0.
- Language: English only. The French, Spanish and German options are out of scope [addition, documented omission].

## 10. High scores — [addition]

The original has **no** high-score table, no initials entry and no EAROM [sourced: DIS, MAME].
The plan requires one:

- Top **10** scores with **3 initials** each, shown on an attract page.
- Entry after game over when the score qualifies:
  - ←/→ (or A/D) cycles the letter (A–Z, space).
  - Space or Enter confirms the letter. After the third letter, the entry is saved.
- Stored in `localStorage` under a versioned key.

## 11. Sound

The original is a discrete analog circuit with no sound chip [sourced: MAME discrete, DIS audio latch]:

| Voice | Original | Recreation (Web Audio) |
|---|---|---|
| **Thrust** | 16-bit LFSR white noise at 12 kHz → 3-bit volume (0–7) → band-pass ≈ 89.5 Hz → low-pass 560 Hz. Volume = `(thrustLevel >> 1) \| 1` in flight (faint rumble always); abort = 7 | noise buffer → gain (volume/7) → band-pass 89.5 Hz → low-pass 560 Hz |
| **Explosion** | enable bit adds unfiltered noise | unfiltered noise burst with a decay envelope (duration [estimate] ≈ 1.5 s) |
| **Tones** | 3 kHz and 6 kHz square waves, each with an enable bit; low-fuel beep = 3 kHz, gated in step with the flash | square oscillators at 3 kHz / 6 kHz |
| **Coin** | not confirmed | short 6 kHz chirp ≈ 60 ms [estimate] |

The thrust source values are sourced; the coin sound and explosion duration are estimates.

## 12. Estimates to tune in playtest

1. HUD altitude scale (§1)
2. Lever ramp rate (§2.6)
3. Initial vy sign (§4)
4. World width, peak height, pad count and pad widths (§7)
5. Top clamp (§7)
6. Zoom thresholds 200 / 260 (§7)
7. Flame length (§8)
8. Debris horizontal spread (§8)
9. Explosion duration and coin chirp (§11)
10. "GAME OVER" wording (§6.1)
11. A flat non-pad landing scoring ×1 (§6)

Verifying these frame by frame in MAME (`llander`) would replace each estimate with a
sourced value.

## 13. Sources

- **[DIS]** Annotated disassembly of the `llander` rev-2 ROM — https://v.st/~th/llander/ and https://v.st/~th/llander/llander.asm
- **[MAME]** MAME driver — https://github.com/mamedev/mame/blob/master/src/mame/atari/asteroid.cpp (DIP notes "verified from manual"), plus the discrete-sound emulation
- **[WIKI]** https://en.wikipedia.org/wiki/Lunar_Lander_(1979_video_game)
- **[AH]** https://www.arcade-history.com/game/1417/lunar-lander
- **[KLOV]** https://www.arcade-museum.com/Videogame/lunar-lander
- **[KLOV-DIP]** https://www.arcade-museum.com/dipswitch-settings/lunar-lander
- **[LAKE]** https://lakeside-arcade.com/2026/03/07/lunar-lander-pcb-repair-logs/ (vector overrun when zoomed)

StrategyWiki was unreachable (HTTP 403) and no scanned operator's manual was found. MAME's
DIP-switch notes quote the manual.
