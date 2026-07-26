// Runs the game's audio code against a recording fake of WebAudio, so the
// synthesis can be checked without anyone having to listen to it.
//   node tools/audio.js
const { loadGame } = require('./harness');

const graph = [];
class Param {
  constructor(name, v) { this.name = name; this.value = v; this.events = []; }
  setValueAtTime(v) { this.value = v; return this; }
  setTargetAtTime(v, t, c) { this.events.push(['target', v, c]); this.value = v; return this; }
  exponentialRampToValueAtTime(v) {
    if (v === 0) throw new Error(`${this.name}: exponential ramp to 0 is illegal`);
    return this;
  }
}
class Node {
  constructor(kind) { this.kind = kind; }
  connect(n) { graph.push(`${this.kind} -> ${n.kind}`); return n; }
  disconnect() {} start() { graph.push(`start ${this.kind}`); } stop() {}
}
class FakeAudioContext {
  constructor() {
    this.sampleRate = 44100; this.currentTime = 0; this.state = 'running';
    this.destination = new Node('OUT');
  }
  createBuffer(ch, n) { const d = new Float32Array(n); return { length: n, getChannelData: () => d }; }
  createBufferSource() { const n = new Node('noise'); n.loop = false; n.buffer = null; return n; }
  createGain() { const n = new Node('gain'); n.gain = new Param('gain', 1); return n; }
  createBiquadFilter() {
    const n = new Node('filter'); n.frequency = new Param('freq', 350);
    n.Q = new Param('Q', 1); n.detune = new Param('detune', 0); return n;
  }
  createOscillator() { const n = new Node('osc'); n.frequency = new Param('freq', 440); return n; }
  resume() {}
}

const g = loadGame({ AudioContext: FakeAudioContext });
const { G, ST, keys, update, startLevel, audioInit, engineSound, whoosh, beep, noise, makeEngineBuffer } = g;

audioInit();
console.log('--- audio graph at init ---');
graph.forEach(l => console.log('  ' + l));

console.log('\n--- baked engine loop ---');
const t0 = Date.now(), buf = makeEngineBuffer(), ms = Date.now() - t0;
const d = buf.getChannelData(0);
let peak = 0, rms = 0;
for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); rms += d[i] * d[i]; }
console.log(`  ${(d.length / 44100).toFixed(1)}s  peak ${peak.toFixed(3)}  rms ${Math.sqrt(rms / d.length).toFixed(3)}  baked in ${ms}ms`);

console.log('\n--- one-shots (must not throw) ---');
for (const [name, fn] of [['whoosh  (ignition)', () => whoosh(0.9, 0.45)],
                          ['noise   (crash)',    () => noise(0.7, 0.5)],
                          ['beep    (gate)',     () => beep(880, 0.07, 'square', 0.06)]]) {
  try { fn(); console.log(`  ${name}: ok`); }
  catch (e) { console.log(`  ${name}: FAILED -> ${e.message}`); }
}

console.log('\n--- engine follows the throttle in a real flight ---');
startLevel(0);
G.state = ST.FLY; G.lives = 3;
G.pos.x = 0; G.pos.y = 18; G.pos.z = 40;
G.vel.x = 0; G.vel.y = 0; G.vel.z = 44; G.yaw = 0; G.pitch = 0.2; G.roll = 0;
for (const k in keys) keys[k] = false;
let trace = '';
for (let i = 0; i < 240 && G.state === ST.FLY; i++) {
  keys.fire = (i % 36) < 20;                       // pulse it
  G.fuel = 100;
  update(1 / 60);
  if (i % 3 === 0) {
    // read the live gain out of the game's own scope
    const v = require('vm').runInContext('hissGain.gain.value', g.sandbox);
    trace += v > 0.01 ? '#' : '.';
  }
}
console.log('  ' + trace + '   (# = hissing)');
const evs = require('vm').runInContext('hissGain.gain.events.length', g.sandbox);
console.log(`  ${evs} automation events over 4s of pulsing (one per throttle change, not per frame)`);
