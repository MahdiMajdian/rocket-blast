// Loads the real game code out of index.html and runs it headless, with just
// enough of WebGL/DOM/WebAudio faked that everything except drawing behaves
// exactly as it does in a browser. Physics, collision, levels, scoring, audio
// graph and cheats are the genuine article -- that's the point.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// every gl call returns a callable stub; nothing here is ever drawn
const glStub = new Proxy({}, {
  get(t, k) {
    if (k === Symbol.toPrimitive) return () => 1;
    return (...a) => ({ __gl: String(k) });
  }
});

function fakeElement() {
  const base = {
    style: {}, dataset: {}, innerHTML: '', textContent: '',
    width: 800, height: 600,
    classList: { contains: () => false, add() {}, remove() {}, toggle() {} },
    getContext: () => glStub,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    getBoundingClientRect: () => ({ left:0, top:0, right:0, bottom:0, width:0, height:0 }),
  };
  return new Proxy(base, {
    get(t, k) { return k in t ? t[k] : (...a) => undefined; },
    set(t, k, v) { t[k] = v; return true; },
  });
}

/**
 * @param {object} opts
 *   opts.AudioContext  - constructor to expose as window.AudioContext (optional;
 *                        omit and the game silently runs with no audio)
 *   opts.onListener    - fn(type, handler) called for each addEventListener on window
 * @returns the game's internals: {G, ST, keys, keyPressed, update, clamp, LEVELS, ...}
 */
function loadGame(opts = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
  const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];

  const sandbox = {
    document: {
      getElementById: () => fakeElement(),
      querySelectorAll: () => [],
      addEventListener() {},
      body: fakeElement(),
    },
    requestAnimationFrame: () => 0,
    performance: { now: () => Date.now() },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    addEventListener: (type, fn) => { if (opts.onListener) opts.onListener(type, fn); },
    removeEventListener() {},
    setTimeout: (fn) => { if (opts.runTimers && typeof fn === 'function') { try { fn(); } catch (_) {} } return 0; },
    clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    console,
  };
  if (opts.AudioContext) sandbox.AudioContext = opts.AudioContext;
  sandbox.window = sandbox;
  vm.createContext(sandbox);

  // the game's top-level `const`s are script-scoped, so hand them out explicitly
  const exported = ['G', 'ST', 'keys', 'keyPressed', 'update', 'clamp', 'LEVELS', 'Level',
                    'startLevel', 'crash', 'cheat', 'applyCheat', 'obbHit',
                    'audioInit', 'engineSound', 'whoosh', 'beep', 'noise', 'makeEngineBuffer',
                    'tick', 'REC', 'buildSubmission', 'recordFlush', 'resetRun', 'STEP',
                    'stepFromMask', 'toggleCheat'];
  vm.runInContext(src + `\n;globalThis.__X = {${exported.join(',')}};`, sandbox);
  return { ...sandbox.__X, sandbox };
}

module.exports = { loadGame, fakeElement, glStub };
