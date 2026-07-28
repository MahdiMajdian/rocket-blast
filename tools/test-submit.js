// Does a submission from a real player actually verify?
//
// Drives the game through its real tick() path -- the same code the browser runs --
// captures the replay exactly as the browser would, then re-verifies it the way the
// Worker does. This is the round trip no other test covers.
//
//   node tools/test-submit.js
const { loadGame } = require('./harness');

const BITS = [['up',1], ['down',2], ['left',4], ['right',8], ['fire',16], ['restart',32]];

function replayAndCheck(sub, label) {
  const g = loadGame();
  const { G, ST, keys, keyPressed, update, LEVELS } = g;
  const bin = Buffer.from(sub.replay, 'base64').toString('binary');
  const masks = [];
  for (let i = 0; i + 2 < bin.length; i += 3) {
    const m = bin.charCodeAt(i), n = bin.charCodeAt(i+1) | (bin.charCodeAt(i+2) << 8);
    for (let k = 0; k < n; k++) masks.push(m);
  }
  G.invertPitch = !!sub.inv;
  const prev = {};
  for (const [k] of BITS) { keys[k] = false; prev[k] = false; }
  for (const m of masks) {
    g.stepFromMask(m);
    if (G.state === ST.WIN) break;
  }
  const match = G.score === sub.score && G.coins === sub.coins && Math.abs(G.runTicks - sub.ticks) <= 1;
  console.log(`  ${label}`);
  console.log(`    claimed  score ${String(sub.score).padStart(6)}  coins ${String(sub.coins).padStart(3)}  ticks ${String(sub.ticks).padStart(6)}  state ${sub.state}`);
  console.log(`    replayed score ${String(G.score).padStart(6)}  coins ${String(G.coins).padStart(3)}  ticks ${String(G.runTicks).padStart(6)}  state ${G.state}`);
  console.log(`    -> ${match ? 'MATCH' : 'MISMATCH'}`);
  return match;
}

// --- play through the real tick() path, exactly like the browser ---------------
const g = loadGame();
const { G, ST, keys, tick, REC, buildSubmission, LEVELS } = g;
const pilot = require('./bot')(g);

const TICKS = 5400;                       // 90 seconds
for (let i = 0; i < TICKS; i++) {
  if (G.state === ST.INTRO || G.state === ST.READY ||
      G.state === ST.DEAD  || G.state === ST.CLEAR) {
    for (const [k] of BITS) keys[k] = false;
    keys.fire = (i % 2 === 0);            // tap to advance menus
  } else if (G.state === ST.FLY) pilot();
  tick();                                  // <-- the browser's own path
}

const sub = buildSubmission('TESTER');
sub.state = G.state;
console.log(`played ${TICKS} ticks through tick(): level ${G.level+1}, score ${G.score}, ${G.coins} coins`);
console.log(`recording: ${REC.ticks} ticks captured, ${(sub.replay.length/1024).toFixed(1)} KB base64\n`);

const ok = replayAndCheck(sub, 'browser recording -> server replay');

console.log('');
if (!ok) {
  console.log('The replay does not reproduce the run. A real submission would be rejected.');
  process.exit(1);
}
console.log('Round trip is sound: what the browser records, the server reproduces exactly.');
