// Checks every level for asks the rocket physically cannot meet.
//
// The rocket cruises ~44 m/s forward and tops out near 20 m/s sideways, so the
// steepest sustainable line is about |dx/dz| = 0.45. Allowing for rolling in and
// out of the turn and arriving stable, 0.30 is the practical planning limit.
//   node tools/lint-levels.js
const { loadGame } = require('./harness');
const { G, startLevel, LEVELS } = loadGame();

const MAX_RATE = 0.30;
const WARN_RATE = 0.24;
let problems = 0, warnings = 0;

function check(label, x0, z0, x1, z1, what) {
  const dz = z1 - z0, dx = Math.abs(x1 - x0);
  if (dz <= 0) return;
  const rate = dx / dz;
  if (rate <= WARN_RATE) return;
  const bad = rate > MAX_RATE;
  bad ? problems++ : warnings++;
  console.log(`  ${bad ? 'FAIL' : 'warn'}  ${label}  ${what}` +
              `  dx=${dx.toFixed(0)} over dz=${dz.toFixed(0)}  rate ${rate.toFixed(2)}`);
}

for (let i = 0; i < LEVELS.length; i++) {
  startLevel(i);
  const L = G.L, tag = 'L' + String(i + 1).padStart(2);

  // gate to gate
  const gs = L.gates.slice().sort((a, b) => a.z - b.z);
  for (let k = 1; k < gs.length; k++)
    check(tag, gs[k - 1].ax, gs[k - 1].z, gs[k].ax, gs[k].z, `gate z${gs[k - 1].z} -> z${gs[k].z}`);

  // last gate to the target
  if (gs.length && L.target)
    check(tag, gs[gs.length - 1].ax, gs[gs.length - 1].z, L.target.x, L.target.z,
          `gate z${gs[gs.length - 1].z} -> target`);

  // coin to coin: a run that outruns the rocket drags players into walls
  const cs = L.coins.slice().sort((a, b) => a.z - b.z);
  for (let k = 1; k < cs.length; k++) {
    if (cs[k].z - cs[k - 1].z > 40) continue;         // separate runs, not a chain
    check(tag, cs[k - 1].x, cs[k - 1].z, cs[k].x, cs[k].z,
          `coins z${cs[k - 1].z.toFixed(0)} -> z${cs[k].z.toFixed(0)}`);
  }

  // a coin sitting inside solid geometry can never be collected
  for (const c of L.coins) {
    for (const col of L.colliders) {
      if (Math.abs(col.z - c.z) > col.hz + 1.2) continue;
      if (Math.abs(c.x - col.x) < col.hx - 0.5 && Math.abs(c.y - col.y) < col.hy - 0.5) {
        console.log(`  FAIL  ${tag}  coin buried in geometry at (${c.x.toFixed(0)}, ${c.y.toFixed(0)}, ${c.z.toFixed(0)})`);
        problems++;
        break;
      }
    }
    if (c.y < 3) console.log(`  warn  ${tag}  coin at y=${c.y.toFixed(1)} is very low (ground is 1.9)`), warnings++;
  }
}

console.log(`\n${problems} impossible, ${warnings} tight`);
process.exit(problems ? 1 : 0);
