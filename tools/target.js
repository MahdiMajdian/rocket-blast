// Fires the rocket at the level-1 bullseye from a spread of offsets and checks
// that scoring, misses and fast approaches all resolve correctly.
//   node tools/target.js
const { loadGame } = require('./harness');
const { G, ST, keys, update, startLevel, LEVELS } = loadGame();

function shot(x, y, speed = 44) {
  startLevel(0);
  const T = G.L.target;
  G.state = ST.FLY; G.lives = 3; G.score = 0; G.hitInfo = null; G.deadReason = '';
  for (const k in keys) keys[k] = false;
  G.pos.x = x; G.pos.y = y; G.pos.z = T.z - 10;
  G.vel.x = 0; G.vel.y = 0; G.vel.z = speed;
  G.yaw = 0; G.pitch = 0; G.roll = 0;
  for (let i = 0; i < 120 && G.state === ST.FLY; i++) update(1 / 60);
  return G.state === ST.CLEAR
    ? `HIT  ${G.hitInfo.label.padEnd(12)} +${G.hitInfo.bonus}`
    : `${G.state === ST.DEAD ? 'MISS' : '??? '} ${G.deadReason || 'state ' + G.state}`;
}

startLevel(0);
const T = G.L.target;
console.log(`level 1 target: centre (${T.x}, ${T.y}), ${T.s * 2} x ${T.s * 2} units, at z=${T.z}\n`);
for (const [x, y, note] of [
  [0, 14, 'dead centre'], [3, 14, 'inner ring'], [5, 11, 'mid ring'],
  [8, 14, 'outer ring'], [0, 6.5, 'low edge'], [0, 21.5, 'high edge'],
  [10, 14, 'past the edge'], [16, 14, 'wide'], [0, 30, 'way high'],
]) console.log(`  (${String(x).padStart(3)},${String(y).padStart(5)}) ${note.padEnd(16)} -> ${shot(x, y)}`);

console.log('\nfast approach (60 m/s) must not tunnel straight through:');
for (const [x, y] of [[0, 14], [16, 14]]) console.log(`  (${x},${y}) -> ${shot(x, y, 60)}`);

console.log('\nevery level ends in a target:');
for (let i = 0; i < LEVELS.length; i++) {
  startLevel(i);
  const t = G.L.target;
  console.log(`  L${i + 1}: ${t ? `${t.s * 2}x${t.s * 2} at (${t.x},${t.y})  z=${t.z} / len ${G.L.len}` : 'MISSING'}`);
}
