// Turns an image into the voxel artwork on the final level's target.
//
//   node tools/image-to-target.js art/target.png [gridSize]
//
// Downsamples the image to a gridSize x gridSize colour grid and writes it into
// index.html between the TARGET_ART markers. Uses macOS `sips` to decode, so it
// handles png/jpg/heic/gif/tiff with no npm dependencies.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const src = process.argv[2];
const SIZE = Math.max(8, Math.min(256, parseInt(process.argv[3] || '64', 10)));
const htmlPath0 = path.join(__dirname, '..', 'index.html');
const START = '// >>> TARGET_ART >>>', END = '// <<< TARGET_ART <<<';

function splice(block) {
  let html = fs.readFileSync(htmlPath0, 'utf8');
  const a = html.indexOf(START), z = html.indexOf(END);
  if (a < 0 || z < 0) { console.error('TARGET_ART markers not found in index.html'); process.exit(1); }
  const before = Buffer.byteLength(html);
  html = html.slice(0, a) + block + html.slice(z);
  fs.writeFileSync(htmlPath0, html);
  return { before, after: Buffer.byteLength(html), block };
}

if (!src || src === '-h' || src === '--help') {
  console.error('usage:');
  console.error('  node tools/image-to-target.js <image> [gridSize]   bake a picture (default 64, max 256)');
  console.error('  node tools/image-to-target.js none                 go back to the painted bullseye');
  process.exit(1);
}
if (src === 'none' || src === 'reset') {
  const r = splice(`${START}\nconst TARGET_ART_W = 0, TARGET_ART_B64 = null;\n`);
  console.log(`artwork removed -- all targets are the painted bullseye again`);
  console.log(`index.html ${(r.before / 1024).toFixed(0)} KB -> ${(r.after / 1024).toFixed(0)} KB`);
  process.exit(0);
}
if (!fs.existsSync(src)) { console.error(`no such file: ${src}`); process.exit(1); }

// --- decode via sips -> BMP (simple, uncompressed, easy to parse) ------------
const tmp = path.join(os.tmpdir(), `rb3d-target-${process.pid}.bmp`);
try {
  execFileSync('sips', ['-z', String(SIZE), String(SIZE), src, '--out', tmp,
                        '-s', 'format', 'bmp'], { stdio: 'pipe' });
} catch (e) {
  console.error('sips failed to read that image:\n' + (e.stderr || e.message).toString());
  process.exit(1);
}

const b = fs.readFileSync(tmp);
fs.unlinkSync(tmp);
if (b.length < 54 || b[0] !== 0x42 || b[1] !== 0x4D) { console.error('not a BMP'); process.exit(1); }

const dataOffset = b.readUInt32LE(10);
const width = b.readInt32LE(18);
let height = b.readInt32LE(22);
const bpp = b.readUInt16LE(28);
const bottomUp = height > 0;
height = Math.abs(height);
if (bpp !== 24 && bpp !== 32) { console.error(`unsupported BMP depth: ${bpp}`); process.exit(1); }

const bytesPerPx = bpp / 8;
const rowSize = Math.floor((bpp * width + 31) / 32) * 4;   // rows pad to 4 bytes
const rows = [];
for (let y = 0; y < height; y++) {
  const srcY = bottomUp ? height - 1 - y : y;              // emit top row first
  const row = [];
  for (let x = 0; x < width; x++) {
    const o = dataOffset + srcY * rowSize + x * bytesPerPx;
    row.push([b[o + 2], b[o + 1], b[o]]);                  // BMP is BGR
  }
  rows.push(row);
}
if (width !== height) console.warn(`note: image is ${width}x${height}, target expects a square`);

// --- splice into index.html -------------------------------------------------
// pack to raw RGB then base64 -- far smaller than a nested array literal
const raw = Buffer.alloc(rows.length * rows[0].length * 3);
let o = 0;
for (const row of rows) for (const p of row) { raw[o++] = p[0]; raw[o++] = p[1]; raw[o++] = p[2]; }
const r = splice(`${START}\nconst TARGET_ART_W = ${rows.length}, TARGET_ART_B64 =\n"${raw.toString('base64')}";\n`);

const px = rows.length * rows[0].length;
console.log(`grid       ${rows.length} x ${rows[0].length}  (${px.toLocaleString()} voxels per target)`);
console.log(`payload    ${(Buffer.byteLength(r.block) / 1024).toFixed(1)} KB base64`);
console.log(`index.html ${(r.before / 1024).toFixed(0)} KB -> ${(r.after / 1024).toFixed(0)} KB`);
console.log(`\nall five targets now show ${path.basename(src)}`);
console.log('remember: it stays hidden until you tap the title 7 times in-game');
