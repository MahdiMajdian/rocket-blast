// Sweeps the fuel economy and reports whether each setting is survivable.
//   node tools/tune-fuel.js [burn,gate,coin] ...
// With no arguments it runs a default sweep and leaves the file untouched.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SRC = path.join(__dirname, '..', 'src', 'index.html');
const RE = /const FUEL_BURN = \d+, GATE_FUEL = \d+, COIN_FUEL = \d+;/;
const original = fs.readFileSync(SRC, 'utf8');
const current = original.match(RE)[0];

const combos = process.argv.slice(2).length
  ? process.argv.slice(2).map(a => a.split(',').map(Number))
  : [[8,3,1], [10,3,1], [11,3,1], [12,3,1], [11,2,1], [13,2,1]];

console.log('burn  gate  coin   tank    deaths                        fuel median  dry%   verdict');
const results = [];
for (const [burn, gate, coin] of combos) {
  fs.writeFileSync(SRC, original.replace(RE,
    `const FUEL_BURN = ${burn}, GATE_FUEL = ${gate}, COIN_FUEL = ${coin};`));
  let out = '';
  try { out = execFileSync('node', [path.join(__dirname, 'playtest.js')], { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }

  const won = /WIN\s+final score/.test(out);
  const deaths = (out.match(/deaths per level: (.*)/) || [, '{}'])[1];
  const fuelLine = (out.match(/fuel\s+p05=(\d+)\s+median=(\d+)\s+empty ([\d.]+)%/) || []);
  const median = fuelLine[2] ?? '?', dry = fuelLine[3] ?? '?';
  // a level the bot dies on 100+ times is effectively a wall, not a challenge
  const worst = Math.max(0, ...Object.values(JSON.parse(deaths.replace(/(\w+):/g, '"$1":'))));
  const verdict = !won ? 'UNBEATABLE' : worst > 100 ? 'too tight' : dry === '0.0' ? 'too easy' : 'good';
  console.log(
    String(burn).padStart(4) + String(gate).padStart(6) + String(coin).padStart(6) +
    (100/burn).toFixed(1).padStart(7) + 's  ' + deaths.padEnd(30) +
    String(median).padStart(6) + String(dry).padStart(7) + '   ' + verdict);
  results.push({ burn, gate, coin, verdict });
}

fs.writeFileSync(SRC, original.replace(RE, current));   // leave the source as we found it
console.log(`\nsource restored to: ${current}`);
