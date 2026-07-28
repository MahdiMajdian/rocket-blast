// Plays the whole game headless with a bot pilot and reports where it dies.
// This is how the level pacing, fuel economy and flight model were balanced.
//   node tools/playtest.js
const { loadGame } = require('./harness');
const { G, ST, keys, keyPressed, update, clamp } = loadGame();

function pilot() {
  const L = G.L; if (!L) return;
  let g = null;
  for (const q of L.gates) if (!q.passed && q.z > G.pos.z) { g = q; break; }
  let tx = g ? g.ax : 0, ty = g ? Math.max(g.ay, 10) : 14;
  if (!g && L.target) { tx = L.target.x; ty = L.target.y; }   // last leg: line up the bullseye
  // detour for a coin if one is close ahead and roughly on the way
  let best = null, bestD = 1e9;
  for (const c of L.coins) {
    const dz = c.z - G.pos.z;
    if (c.taken || dz < 2 || dz > 34) continue;
    if (g && c.z > g.z + 2) continue;                         // never past the next gate
    const off = Math.abs(c.x - tx) + Math.abs(c.y - ty);
    if (off > 12) continue;                                   // not worth leaving the line
    if (dz < bestD) { bestD = dz; best = c; }
  }
  if (best) { tx = best.x; ty = best.y; }
  if (g && g.obj) {                                  // predict where the moving thing will be
    const o = g.obj, t = (g.z - G.pos.z) / Math.max(G.vel.z, 6);
    if (o.angleAt) {                                 // windmill: aim between two arms
      const a = o.angleAt(t) + Math.PI / o.arms, rad = o.r * 0.62;
      tx = Math.cos(a) * rad; ty = o.y + Math.sin(a) * rad;
    } else if (o.xAt) {                              // sliding panel: take the roomier side
      const px = o.xAt(t);
      tx = clamp(px > 0 ? px - o.w / 2 - 5 : px + o.w / 2 + 5, -18, 18); ty = 15;
    } else if (o.yAt) {                              // bobbing slab: over or under
      const py = o.yAt(t);
      ty = clamp(py > 15 ? py - o.h / 2 - 4 : py + o.h / 2 + 4, 5, 33); tx = 0;
    }
  }
  const dy = ty - G.pos.y;
  const wantVy = clamp(dy * 1.4, -10, 12);
  const want = clamp((wantVy - G.vel.y) * 0.09, -0.55, 0.9);
  keys.down = G.pitch < want; keys.up = G.pitch > want;        // pitch is inverted
  keys.fire = (G.vel.y < wantVy) || dy > 0;
  const wantVx = clamp((tx - G.pos.x) * 2.2, -20, 20);
  const wantYaw = clamp((wantVx - G.vel.x) * 0.06, -1.1, 1.1);
  keys.left = G.yaw < wantYaw - 0.02; keys.right = G.yaw > wantYaw + 0.02;
}

const deaths = {}, spots = {}, speeds = [], fuels = [];
let thrustOn = 0, thrustOff = 0;
keyPressed('fire');                       // INTRO -> level 1
G.lives = 99999;                          // keep going so we can measure every level

for (let i = 0; i < 400000; i++) {
  const b = { s: G.state, z: G.pos.z, l: G.level };
  if (G.state === ST.READY || G.state === ST.DEAD || G.state === ST.CLEAR) keyPressed('fire');
  else if (G.state === ST.FLY) pilot();
  if (G.state === ST.FLY) {
    speeds.push(Math.hypot(G.vel.x, G.vel.y, G.vel.z));
    fuels.push(G.fuel);
    keys.fire ? thrustOn++ : thrustOff++;
  }
  update(1 / 60);
  if (b.s === ST.FLY && G.state === ST.DEAD) {
    const k = 'L' + (b.l + 1);
    deaths[k] = (deaths[k] || 0) + 1;
    const at = `${k} @ z=${Math.round(b.z / 10) * 10}`;
    spots[at] = (spots[at] || 0) + 1;
  }
  if (b.s === ST.FLY && G.state === ST.CLEAR) {
    const got = G.L.coins.filter(c => c.taken).length;
    console.log(`  OK  L${String(b.l + 1).padStart(2)} after ${String(deaths['L' + (b.l + 1)] || 0).padStart(3)} deaths` +
                `   coins ${String(got).padStart(2)}/${String(G.L.coins.length).padStart(2)}` +
                `   ${G.hitInfo ? G.hitInfo.label.padEnd(12) : ''} score ${G.score}`);
  }
  if (G.state === ST.WIN) { console.log(`\nWIN  final score ${G.score}`); break; }
}

console.log('\ndeaths per level:', JSON.stringify(deaths));
const hot = Object.entries(spots).sort((a, b) => b[1] - a[1]).slice(0, 6);
if (hot.length) console.log('hardest spots:  ' + hot.map(([k, n]) => `${k} (${n})`).join(',  '));
const q = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length * p)];
console.log(`speed   p10=${q(speeds, .1).toFixed(0)}  median=${q(speeds, .5).toFixed(0)}` +
            `  p90=${q(speeds, .9).toFixed(0)} m/s`);
console.log(`fuel    p05=${q(fuels, .05).toFixed(0)}  median=${q(fuels, .5).toFixed(0)}` +
            `  empty ${(100 * fuels.filter(f => f < 1).length / fuels.length).toFixed(1)}% of frames`);
console.log(`engine on ${(100 * thrustOn / (thrustOn + thrustOff)).toFixed(0)}% of the time`);
