// Can a cheated run reach the leaderboard?
//
// There are two independent gates, and this checks both:
//   1. the client refuses to show the submit form once a cheat has been toggled
//   2. the server replays the inputs -- and cheats are typed/tapped, so they are
//      NOT in the input stream, meaning the replay diverges and is rejected
//
//   node tools/test-cheat-block.js
const { loadGame } = require('./harness');

const BITS = [['up',1], ['down',2], ['left',4], ['right',8], ['fire',16], ['restart',32]];
let failures = 0;
const check = (label, pass, detail) => {
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!pass) failures++;
};

// ---------------------------------------------------------------- client side
console.log('client refuses to submit a cheated run:');
{
  const { G, applyCheat, cheat, tick } = loadGame();
  check('starts clean', G.cheated === false);
  applyCheat('TOPITOFF'); tick();           // queued, then applied by the tick
  check('unlimited fuel marks the run', G.cheated === true && cheat.fuel === true);
}
{
  const { G, applyCheat, tick } = loadGame();
  applyCheat('PHOENIX'); tick();
  check('unlimited rockets marks the run', G.cheated === true);
}
{
  const { G, applyCheat, resetRun, tick } = loadGame();
  applyCheat('PHOENIX'); tick();
  applyCheat('PHOENIX'); tick();            // toggled back off
  check('toggling a cheat off does NOT clear the mark', G.cheated === true,
        'a run stays tainted once a cheat has been used');
  resetRun();
  check('a fresh run clears the mark', G.cheated === false);
}
{
  // the submit path itself must bail out
  const g = loadGame();
  const { G, applyCheat, tick } = g;
  applyCheat('TOPITOFF'); tick();
  G.submit = { state: 'idle', msg: '' };
  g.sandbox.__X = g.sandbox.__X || {};
  const before = JSON.stringify(G.submit);
  require('vm').runInContext('submitRecord();', g.sandbox);
  check('submitRecord() does nothing while cheated', JSON.stringify(G.submit) === before);
}

// ---------------------------------------------------------------- server side
console.log('\nserver rejects a cheated run even if the client is bypassed:');
{
  // Play with unlimited fuel on, recording inputs the way the browser does.
  const g = loadGame();
  const { G, ST, keys, tick, applyCheat, buildSubmission } = g;
  const pilot = require('./bot')(g);
  applyCheat('TOPITOFF');                   // queued -- rides in the input stream
  for (let i = 0; i < 3600; i++) {
    if (G.state === ST.INTRO || G.state === ST.READY ||
        G.state === ST.DEAD  || G.state === ST.CLEAR) {
      for (const [k] of BITS) keys[k] = false;
      keys.fire = (i % 2 === 0);
    } else if (G.state === ST.FLY) pilot();
    tick();
  }
  const sub = buildSubmission('CHEATER');
  console.log(`    cheated run: score ${sub.score}, ${sub.coins} coins, reached level ${G.level + 1}`);

  // replay it on a clean instance, exactly as the Worker would
  const v = loadGame();
  const bin = Buffer.from(sub.replay, 'base64').toString('binary');
  const masks = [];
  for (let i = 0; i + 2 < bin.length; i += 3) {
    const m = bin.charCodeAt(i), n = bin.charCodeAt(i+1) | (bin.charCodeAt(i+2) << 8);
    for (let k = 0; k < n; k++) masks.push(m);
  }
  const prev = {};
  for (const [k] of BITS) { v.keys[k] = false; prev[k] = false; }
  for (const m of masks) {
    v.stepFromMask(m);
  }
  console.log(`    replayed: score ${v.G.score}, cheated flag = ${v.G.cheated}`);
  check('the replay reproduces the cheat, so the server sees it', v.G.cheated === true,
        'the Worker rejects on `cheats were used` before it ever compares scores');
}

console.log(failures ? `\n${failures} FAILURES` : '\nCheated runs cannot reach the leaderboard.');
process.exit(failures ? 1 : 0);
