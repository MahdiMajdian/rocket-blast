// Server-side replay verification.
//
// The game submits the input sequence, not a score. This re-runs that exact
// sequence against the real game code at a fixed 60 Hz and reports the score it
// actually produces. A forged score simply won't match what the physics yields.
//
//   node tools/verify-replay.js submission.json
//   node tools/verify-replay.js --self-test        (bot plays, submits, verifies)
//
// This is the logic a Cloudflare Worker would run on POST /score.
const fs = require('fs');
const { loadGame } = require('./harness');

const BITS = [['up',1], ['down',2], ['left',4], ['right',8], ['fire',16], ['restart',32]];

function decodeReplay(b64) {
  const raw = Buffer.from(b64, 'base64');
  const masks = [];
  for (let i = 0; i + 2 < raw.length; i += 3) {
    const m = raw[i], n = raw[i + 1] | (raw[i + 2] << 8);
    for (let k = 0; k < n; k++) masks.push(m);
  }
  return masks;
}

/** Replays a submission and returns what the simulation actually produced. */
function verify(sub, opts = {}) {
  const MAX_TICKS = 60 * 60 * 60;                       // one hour of game time, hard cap
  const masks = decodeReplay(sub.replay);
  if (masks.length > MAX_TICKS) return { ok: false, reason: 'replay too long' };

  const g = loadGame();
  const { G, ST, keys, keyPressed, update, LEVELS } = g;
  if (sub.levels !== LEVELS.length)
    return { ok: false, reason: `replay is for ${sub.levels} levels, this build has ${LEVELS.length}` };

  G.invertPitch = !!sub.inv;
  const prev = {};
  for (const [k] of BITS) { keys[k] = false; prev[k] = false; }

  for (let i = 0; i < masks.length; i++) {
    const m = masks[i];
    g.stepFromMask(m);
    if (G.state === ST.WIN) break;
  }

  if (opts.requireWin !== false && G.state !== ST.WIN)
    return { ok: false, reason: 'replay does not finish the game' };
  if (G.cheated) return { ok: false, reason: 'cheats used during the run' };

  const stateOk = sub.state === undefined || G.state === sub.state;
  const scoreOk = G.score === sub.score;
  const ticksOk = Math.abs(G.runTicks - sub.ticks) <= 1;   // 1 tick of slack on the boundary
  const coinsOk = G.coins === sub.coins;
  const ok = scoreOk && ticksOk && coinsOk && stateOk;
  return {
    ok,
    reason: ok ? 'verified' : 'claimed values do not match the replay',
    claimed:  { score: sub.score, coins: sub.coins, ticks: sub.ticks },
    actual:   { score: G.score,   coins: G.coins,   ticks: G.runTicks },
    seconds: (G.runTicks / 60).toFixed(2),
  };
}

module.exports = { verify, decodeReplay };

// ---------------------------------------------------------------- CLI -------
if (require.main === module) {
  const arg = process.argv[2];

  if (arg === '--self-test') {
    // Drive the game with the bot, capture the replay the way the browser would,
    // then verify it -- and prove a tampered score is rejected.
    const g = loadGame();
    const { G, ST, keys, keyPressed, update, clamp, LEVELS } = g;
    const pilot = require('./bot')(g);

    const runs = [];
    let mask = -1, count = 0;
    const prev = {};
    const push = m => {
      if (m === mask && count < 65535) { count++; return; }
      if (mask >= 0) runs.push(mask, count);
      mask = m; count = 1;
    };

    const BUDGET = 3600;                 // 60s of play is plenty to prove determinism
    for (let i = 0; i < BUDGET; i++) {
      if (G.state === ST.INTRO || G.state === ST.READY ||
          G.state === ST.DEAD  || G.state === ST.CLEAR) {
        for (const [k] of BITS) keys[k] = false;
        keys.fire = (i % 2 === 0);        // tap, don't hold -- menus advance on the edge
      } else if (G.state === ST.FLY) pilot();

      let m = 0;
      for (const [k, bit] of BITS) if (keys[k]) m |= bit;
      push(m);
      for (const [k] of BITS) { if (keys[k] && !prev[k]) keyPressed(k); prev[k] = keys[k]; }
      if (G.state !== ST.INTRO && G.state !== ST.WIN && G.state !== ST.OVER) G.runTicks++;
      update(1 / 60);
    }
    if (mask >= 0) runs.push(mask, count);

    const bytes = Buffer.alloc(runs.length / 2 * 3);
    for (let i = 0; i < runs.length / 2; i++) {
      bytes[i*3] = runs[i*2];
      bytes[i*3+1] = runs[i*2+1] & 255;
      bytes[i*3+2] = (runs[i*2+1] >> 8) & 255;
    }
    const sub = { v:1, build:'rb3d-2', name:'BOT', score:G.score, coins:G.coins,
                  ticks:G.runTicks, levels:LEVELS.length, inv:G.invertPitch,
                  state:G.state, replay: bytes.toString('base64') };
    const OPT = { requireWin: false };   // the bot runs out of lives; determinism is the point

    console.log(`bot run: reached level ${G.level+1}, score ${sub.score}, ${sub.coins} coins, ${(sub.ticks/60).toFixed(1)}s`);
    console.log(`replay: ${runs.length/2} input changes -> ${(bytes.length/1024).toFixed(1)} KB raw, ` +
                `${(sub.replay.length/1024).toFixed(1)} KB base64  (${sub.ticks} ticks)\n`);

    const honest = verify(sub, OPT);
    console.log(`honest submission  -> ${honest.ok ? 'ACCEPTED' : 'REJECTED'}  (${honest.reason})`);
    console.log(`   claimed ${JSON.stringify(honest.claimed)}`);
    console.log(`   actual  ${JSON.stringify(honest.actual)}`);

    const forged = verify({ ...sub, score: sub.score + 500000 }, OPT);
    console.log(`\ninflated score     -> ${forged.ok ? 'ACCEPTED' : 'REJECTED'}  (${forged.reason})`);
    if (forged.actual) console.log(`   claimed ${forged.claimed.score}, replay yields ${forged.actual.score}`);

    const fastTime = verify({ ...sub, ticks: 60 }, OPT);
    console.log(`faked 1s time      -> ${fastTime.ok ? 'ACCEPTED' : 'REJECTED'}  (${fastTime.reason})`);

    const truncated = verify({ ...sub, replay: sub.replay.slice(0, 40) }, OPT);
    console.log(`truncated replay   -> ${truncated.ok ? 'ACCEPTED' : 'REJECTED'}  (${truncated.reason})`);

    fs.writeFileSync('/tmp/rb3d-submission.json', JSON.stringify(sub));
    console.log('\nsample submission written to /tmp/rb3d-submission.json');
    process.exit(honest.ok && !forged.ok && !fastTime.ok && !truncated.ok ? 0 : 1);
  }

  if (!arg) { console.error('usage: node tools/verify-replay.js <submission.json> | --self-test'); process.exit(1); }
  const r = verify(JSON.parse(fs.readFileSync(arg, 'utf8')));
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}
