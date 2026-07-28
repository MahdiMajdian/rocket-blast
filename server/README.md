# Leaderboard backend

Cloudflare Worker + D1. Lives entirely outside GitHub Pages, so redeploying the
game never touches the data.

| File | What it is |
| --- | --- |
| `worker.js` | the API — `POST /score`, `GET /top` |
| `schema.sql` | the D1 table |
| `wrangler.toml` | deploy config (paste your database id) |
| `build.js` | regenerates `game.gen.js` from `index.html` |
| `game.gen.js` | **generated** — the game's physics as a module the Worker can run |

## Why the generated bundle

Workers forbid runtime `eval`, so the Worker can't load the game the way
`tools/harness.js` does. `build.js` bakes the game script into a real ES module
at build time, with browser globals shadowed by local stubs. The Worker runs the
exact physics the player ran.

**Re-run `node server/build.js` and redeploy whenever the game's physics change,
and bump `BUILD` in `index.html`** so old replays are rejected rather than
silently mis-scored.

## Cost

Verifying a full 10-level run measures at **~120 ms CPU** (24 ms to build all
levels, 41 ms per 10 minutes of simulated flight). That is inside the 30 s CPU
limit on Workers Paid with enormous headroom, but well over the **10 ms** limit
on the free plan — see the main README for the free-tier alternative.
