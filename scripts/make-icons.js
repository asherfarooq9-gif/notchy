// One-off: draws the Batman face and writes assets/tray.png and assets/icon.ico (no dependencies).
// Usage: node scripts/make-icons.js [--preview path.png]   (preview is a big PNG on black for checking the shape)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Mirrors the CSS face in renderer/style.css (cowl, pointed ears, white eyes, jaw). Later layers draw on top.
const VIEW_W = 32;
const VIEW_H = 34;
const COWL = [71, 85, 105];
const JAW = [232, 195, 158];
const WHITE = [248, 250, 252];

const HEAD = [
  [5, 13], [6, 9], [9, 7], [23, 7], [26, 9], [27, 13], [27, 22], [25, 28], [21, 32], [11, 32], [7, 28], [5, 22],
];
const EARS = [
  [[5.5, 10], [7.5, 1], [13, 7.5]],
  [[26.5, 10], [24.5, 1], [19, 7.5]],
];
const JAW_SHAPE = [[9.5, 22], [22.5, 22], [22, 27], [19, 31.4], [13, 31.4], [10, 27]];
const EYES = [
  [[7.5, 14.5], [14, 15.5], [14, 18], [7.5, 17]],
  [[24.5, 14.5], [18, 15.5], [18, 18], [24.5, 17]],
];
const LAYERS = [
  { color: COWL, shapes: [HEAD, ...EARS] },
  { color: JAW, shapes: [JAW_SHAPE] },
  { color: WHITE, shapes: EYES },
];
const SAMPLES = 4; // 4 x 4 samples per pixel for smooth edges

function inPolygon(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function colorAt(x, y) {
  let found = null;
  for (const layer of LAYERS) {
    if (layer.shapes.some((shape) => inPolygon(shape, x, y))) found = layer.color;
  }
  return found;
}

// Returns [r, g, b, a]. With a background color the result is fully opaque.
function pixel(px, py, scale, offsetX, offsetY, background) {
  let r = 0;
  let g = 0;
  let b = 0;
  let covered = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const c = colorAt((px + (sx + 0.5) / SAMPLES) / scale - offsetX, (py + (sy + 0.5) / SAMPLES) / scale - offsetY);
      if (!c) continue;
      r += c[0]; g += c[1]; b += c[2];
      covered += 1;
    }
  }
  const coverage = covered / (SAMPLES * SAMPLES);
  if (!covered) return background ? [...background, 255] : [0, 0, 0, 0];
  const avg = [r / covered, g / covered, b / covered];
  if (background) return [0, 1, 2].map((i) => Math.round(avg[i] * coverage + background[i] * (1 - coverage))).concat(255);
  return [...avg.map(Math.round), Math.round(coverage * 255)];
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    let c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

// Draws the face centered in a width x height canvas, as large as fits.
function makePng(width, height, background) {
  const scale = Math.min(width / VIEW_W, height / VIEW_H);
  const offsetX = (width / scale - VIEW_W) / 2;
  const offsetY = (height / scale - VIEW_H) / 2;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4); // filter byte 0 + RGBA
    for (let x = 0; x < width; x++) row.set(pixel(x, y, scale, offsetX, offsetY, background), 1 + x * 4);
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeIco(png, size) {
  const dir = Buffer.alloc(22);
  dir.writeUInt16LE(1, 2); // type: icon
  dir.writeUInt16LE(1, 4); // one image
  dir[6] = size;
  dir[7] = size;
  dir.writeUInt16LE(1, 10); // planes
  dir.writeUInt16LE(32, 12); // bits per pixel
  dir.writeUInt32LE(png.length, 14);
  dir.writeUInt32LE(22, 18); // image data starts right after the 22-byte header
  return Buffer.concat([dir, png]);
}

const previewAt = process.argv.indexOf('--preview');
if (previewAt !== -1) {
  fs.writeFileSync(process.argv[previewAt + 1], makePng(320, 340, [0, 0, 0]));
  console.log('wrote preview');
} else {
  const dir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tray.png'), makePng(32, 32));
  fs.writeFileSync(path.join(dir, 'icon.ico'), makeIco(makePng(64, 64), 64));
  console.log('wrote assets/tray.png and assets/icon.ico');
}
