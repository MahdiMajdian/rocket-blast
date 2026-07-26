// Probes the flight model: holds an attitude and reports what the rocket does.
// Position is pinned each frame so world bounds never contaminate the numbers.
//   node tools/physics.js
const { loadGame } = require('./harness');
const { G, ST, keys, update, startLevel } = loadGame();

function trial(pitch, thrust, seconds, v0) {
  startLevel(0);
  G.state = ST.FLY; G.lives = 99;
  G.vel.x = 0; G.vel.y = 0; G.vel.z = v0;
  G.yaw = 0; G.roll = 0; G.pitch = pitch;
  for (const k in keys) keys[k] = false;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    G.pitch = pitch;            // hold the attitude
    keys.fire = thrust;
    G.fuel = 1e9;               // fuel isn't what we're measuring here
    update(1 / 60);
    G.pos.x = 0; G.pos.y = 20; G.pos.z = -3000;   // empty sky, no ground, no ceiling
    if (G.state !== ST.FLY) return null;
  }
  return { vy: G.vel.y, vz: G.vel.z, speed: Math.hypot(G.vel.x, G.vel.y, G.vel.z) };
}

const deg = r => (r * 180 / Math.PI).toFixed(0).padStart(4);
const PITCHES = [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6];

console.log('GLIDE  (engine off, attitude held 6s from 40 m/s)');
console.log('  pitch |  sink m/s | fwd m/s | speed');
for (const p of PITCHES) {
  const r = trial(p, false, 6, 40); if (!r) continue;
  console.log(`   ${deg(p)}° | ${r.vy.toFixed(1).padStart(9)} | ${r.vz.toFixed(1).padStart(7)} | ${r.speed.toFixed(1).padStart(5)}`);
}

console.log('\nPOWERED  (engine on, attitude held 6s from 40 m/s)');
console.log('  pitch | climb m/s | fwd m/s | speed');
for (const p of PITCHES.concat(0.9)) {
  const r = trial(p, true, 6, 40); if (!r) continue;
  console.log(`   ${deg(p)}° | ${r.vy.toFixed(1).padStart(9)} | ${r.vz.toFixed(1).padStart(7)} | ${r.speed.toFixed(1).padStart(5)}`);
}

// bisect for the attitude that holds altitude on the engine
let lo = 0, hi = 1.1;
for (let i = 0; i < 40; i++) {
  const m = (lo + hi) / 2, r = trial(m, true, 6, 40);
  (r && r.vy > 0) ? hi = m : lo = m;
}
console.log(`\ntrim for level powered flight: ${(lo * 180 / Math.PI).toFixed(0)}°`);
const dive = trial(-1.15, true, 8, 40);
console.log(`full-power dive terminal speed: ${dive ? dive.speed.toFixed(0) : 'n/a'} m/s`);
