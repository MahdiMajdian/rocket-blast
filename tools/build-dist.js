// Builds the deployable page from src/index.html: same game, script minified.
// The source in src/ stays readable; this writes the published copy.
// Output goes to the repo root by default, or $RB3D_OUT if set.
//
//   node tools/build-dist.js
//
// Deliberately minify-only, no control-flow flattening or string encryption.
// Those cost real frame time in a 60 Hz loop, and buy nothing here: there are no
// secrets in the client, and scores are validated by replaying inputs on the
// server, not by trusting the browser. The only thing hiding is the cheat codes
// and the title-tap easter egg.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const m = html.match(/([\s\S]*<script>)([\s\S]*?)(<\/script>[\s\S]*)/);
if (!m) { console.error('could not find the game script in index.html'); process.exit(1); }
const [, head, src, tail] = m;

const tmpIn = path.join(require('os').tmpdir(), `rb3d-src-${process.pid}.js`);
fs.writeFileSync(tmpIn, src);

let min;
try {
  min = execFileSync('npx', ['--yes', 'terser', tmpIn,
    '--compress', 'passes=3,drop_console=true',
    '--mangle', 'toplevel=true',
    '--format', 'comments=false',
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
} catch (e) {
  console.error('terser failed:\n' + (e.stderr || e.message));
  process.exit(1);
} finally { fs.unlinkSync(tmpIn); }

// keep the CSS/markup, swap in the minified script
const out = head + '\n' + min.trim() + '\n' + tail;
const outDir = process.env.RB3D_OUT ? path.resolve(process.env.RB3D_OUT) : root;
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), out);

const pct = (1 - Buffer.byteLength(out) / Buffer.byteLength(html)) * 100;
console.log(`script   ${(Buffer.byteLength(src)/1024).toFixed(0)} KB -> ${(Buffer.byteLength(min)/1024).toFixed(0)} KB`);
console.log(`page     ${(Buffer.byteLength(html)/1024).toFixed(0)} KB -> ${(Buffer.byteLength(out)/1024).toFixed(0)} KB  (${pct.toFixed(0)}% smaller)`);
console.log(`written  ${path.relative(root, path.join(outDir, 'index.html')) || 'index.html'}`);
