# ROCKET BLAST 3D

A 3D voxel take on Flappy Bird: instead of a bird you fly a rocket that a launcher
throws down a city corridor. Tap the engine to stay up, steer with the arrow keys,
and thread ten levels of walls, towers, windmills, sliding barriers and traffic.

Single self-contained file — no build step, no dependencies. Open `index.html` in any
browser with WebGL2.

## Controls

Pitch is **inverted**, like a flight stick — pull back to climb.

| Key | Action |
| --- | --- |
| `SPACE` | On the pad: fire the launcher. In the air: burn the engine (costs fuel) |
| `↑` | Nose **down** (on the pad: lowers the launch angle) |
| `↓` | Nose **up** (on the pad: raises the launch angle) |
| `←` / `→` | Steer left / right |
| `R` | Restart the run |

Mouse: click anywhere to fire the engine.

**On mobile** an on-screen pad appears automatically (coarse pointer, or on first
touch): a D-pad bottom-left and a round FIRE button bottom-right. Each button captures
its own pointer, so you can hold thrust and steer at the same time. The pitch buttons
are labelled by what they *do* — `NOSE ▲` raises the nose — rather than mirroring the
inverted key mapping, since there's no keyboard to be consistent with. The fuel and
distance bars move to the top of the screen to leave the bottom clear for thumbs.

## Rules

- Gravity is always pulling. The engine only pushes along the nose, so where you point
  is where you go — this is the flappy rhythm: short burns, not one long one.
- **Yaw is a free heading** with no limit — turn a full 180° and fly back down the level
  if you want. There *is* a ceiling at the top of the obstacles, so you can't simply climb
  over everything.
- **Coins** are worth 25 each, multiplied by a streak that climbs to **x8**. The
  multiplier decays two seconds after your last pickup, so a whole coin line taken
  cleanly is worth far more than scattered grabs.
- **Fuel is a fixed tank.** You get **30** at the launcher and nothing comes back just
  for waiting — burning costs 9/second, so a full tank is **3.3 seconds** of engine held
  down. Run dry and you are gliding, and gliding sinks about 8 m/s. The tank only has to
  cover the launch-to-first-gate leg; after that gates carry you. Levels can override it
  with `fuel:` in their config, but measured net need is 7–21 across all ten, so they
  all use the same.
- **A gate refunds exactly one leg.** A gate-to-gate stretch measures at ~1.3s of
  engine, and clearing a gate gives **12 fuel = 1.33s** — so arriving at a wall on
  fumes still gets you to the next one. Everything off the critical path (coin detours,
  the long 80–135 unit legs, doubling back) comes out of what you have left. Coins add
  **+1** each. `GATE_FUEL` is derived from `FUEL_BURN` so the relationship holds if you
  retune; `node tools/tune-fuel.js` sweeps the numbers and flags settings that make a
  level unbeatable.
- Every level ends in a **bullseye** set into the end wall. You have to fly into it —
  the wall around it is solid. The target is 18 × 18 units and always dead ahead at a
  comfortable height, so it's a landing you have to line up, not a needle to thread.
  Centre ring +800, then +550 / +400 / +300 as you drift out.
- Each gate cleared is +100. Three rockets per run.
- Hitting anything — ground, wall, tower, arm, car, or the plating around the target —
  costs a rocket and puts you back on the launcher at the start of the level.

## Cheats

Type them any time, GTA style — no console, no pausing. Each one toggles, and they
stick for the rest of the session (through crashes, level changes and `R`).

| Code | Effect |
| --- | --- |
| `TOPITOFF` | Unlimited fuel — the bar locks full and turns cyan |
| `PHOENIX` | Unlimited rockets — crashes stop costing a life, LIVES shows `∞` |

Neither code spells a letter bound to flying (W/A/S/D/R), so you can enter them
mid-flight without nudging the rocket.

**On mobile** there's no keyboard, so tap a HUD panel **five times quickly** instead
(under 1.2 s between taps, or the count resets):

| Tap | Effect |
| --- | --- |
| the **SCORE** box, top-left | unlimited fuel |
| the **LIVES / SPD** box, top-right | unlimited rockets |

The panel border blinks from the second tap so you know it's registering, without
giving the secret away to someone who isn't looking for it. Tapping a HUD panel never
fires the engine, so you can't launch yourself by accident while entering one.

Either way, a GTA-style banner drops in from the top to confirm — gold for activated,
red for deactivated — and both routes toggle the same flags.

## Levels

| # | Name | What's in it |
| - | ---- | ------------ |
| 1 | Suburb Run | Brick walls with holes, a pillar, light traffic |
| 2 | Downtown | Full-height tower canyons, hanging ceiling blocks, a sliding barrier |
| 3 | Construction Site | Framed windmills you have to time, pillars, a bobbing slab |
| 4 | Highway Hell | Heavy traffic, sliding barriers, windmills, a tower row |
| 5 | Megacity Finale | All of it, tighter |
| 6 | Refinery | Tanks and stacks; the coins mark the safe line |
| 7 | The Canyon | Tight rock gates, hard banking |
| 8 | The Yards | Heavy traffic, low coins worth the risk |
| 9 | Night Shift | Dark and fast; the coins light the way |
| 10 | Terminal Velocity | Everything, back to back |

## Putting a picture on the targets

Every level's target can show an image instead of the painted bullseye. Drop the file
anywhere in the project and run:

```bash
node tools/image-to-target.js art/target.png 128
```

- **arg 1** — the image (png/jpg/heic/gif, any size)
- **arg 2** — grid size, default `64`, max `256`

It downsamples to a square colour grid and writes it into `index.html` between the
`TARGET_ART` markers as base64 RGB — so the game stays a single self-contained file with
no external asset to fetch. Decoding goes through macOS `sips`, so there are no npm
dependencies.

A note on size: the scene renders into a 288px-tall buffer and the target fills roughly
200 of those pixels, so **64×64 is about the practical limit** (~3 screen pixels per
voxel). 128 costs 16k instances for detail that aliases away.

The picture is **hidden by default**. Tap the `ROCKET BLAST` title on the front screen
**seven times** to switch it on — the taps are silent and unacknowledged until the
seventh, which shows a banner. Seven more turns it back off, and the choice is
remembered between sessions.

## Records and anti-cheat

Finishing the **last level** — whichever that is, the screen reads `LEVELS.length`, so
adding levels needs no change — shows a submit form with your time, score and coins.

The game **does not submit a score**. It submits the *input sequence*, and the server
replays it.

That's possible because the simulation is deterministic: a fixed 60 Hz timestep, seeded
level generation, and `Math.random()` used only for particles, never for gameplay. Key
presses are turned into edges inside the tick loop rather than from DOM events, so a run
is a pure function of the per-tick input mask.

Inputs are run-length encoded — 6 buttons, and they change rarely, so a full minute of
play is about **10 KB of base64**.

```bash
node tools/verify-replay.js --self-test      # bot plays, submits, verifies, tries to cheat
node tools/verify-replay.js submission.json  # check a real submission
```

```
honest submission  -> ACCEPTED  (verified)
inflated score     -> REJECTED  (claimed 506750, replay yields 6750)
faked 1s time      -> REJECTED
truncated replay   -> REJECTED
```

Runs where a cheat was toggled are marked and refuse to submit. `verify-replay.js` is
written to be the body of a `POST /score` handler — point `LEADERBOARD_API` in
`index.html` at a backend to switch submissions on. Bump `BUILD` whenever physics
change so old replays are rejected rather than silently mis-scored.

## Flight model

The rocket is not a point mass with a thruster — it has fins. Each frame the velocity
vector swings toward wherever the nose is pointing, so a dive trades height for speed, a
climb trades speed for height, and steering still bites with the engine off. Drag is
quadratic, so speed self-limits instead of running away.

Measured behaviour (from `physics.js`):

| | |
| --- | --- |
| Cruise speed | ~44 m/s (median in a full playthrough) |
| Full-power dive | tops out at 54 m/s |
| Level powered flight | trims at about 7° nose up |
| Engine off, level | sinks ~8 m/s |
| Climb at 34° nose up | +19.5 m/s |

Releasing the pitch keys lets the fins trim the nose back toward level, so the rocket
settles instead of staying wherever you left it.

## How it's built

- **Renderer**: hand-written WebGL2. Everything in the world is one instanced unit cube —
  ~7k instances for static level geometry in a single draw call, plus one dynamic call per
  frame for the rocket, moving obstacles and particles.
- **Pixelation**: the scene renders into a 288px-tall offscreen framebuffer, then blits
  upscaled with `NEAREST` filtering. Chunky pixels, cheap to run.
- **Collision**: sphere vs. oriented box. Static level pieces bake down to a handful of
  coarse boxes each (a voxel wall is 4 boxes, not 250); moving obstacles test against
  their live transform, windmill arms in the arm's local frame.
- **Audio**: no assets — all synthesised. The engine is a looping white-noise source
  split two ways: a bandpass around 1.5 kHz for the hiss and a 170 Hz lowpass for the
  rumble, with a slow LFO wobbling the bandpass so the flame breathes. Gains ride
  `setTargetAtTime` so the engine fades in and tails off instead of clicking. Ignition
  is a one-shot noise burst swept 160 Hz → 2.4 kHz → 420 Hz.

`playtest.js`, `physics.js` and `target.js` (in the scratchpad) run the real game code
headless under a stubbed WebGL/DOM context — a bot pilot for level pacing and fuel
economy, an attitude sweep for the flight model, and a firing range for the bullseye
scoring.
