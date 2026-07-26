# ROCKET BLAST 3D

A 3D voxel take on Flappy Bird: instead of a bird you fly a rocket that a launcher
throws down a city corridor. Tap the engine to stay up, steer with the arrow keys,
and thread five levels of walls, towers, windmills, sliding barriers and traffic.

Single self-contained file — no build step, no dependencies. Open `index.html` in any
browser with WebGL2.

```bash
open /Users/mahdi/Developer/rocket-blast-3d/index.html
```

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
- **Fuel** drains while burning and refills while gliding. You can hold the engine for
  about 5 seconds flat out; a sustainable cruise is roughly 60% throttle. Each gate you
  clear gives back a sip.
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
