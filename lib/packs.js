// Character packs: a small JSON file in the "packs" folder adds a look (two colors, a face drawing, eyes).
// A pack is only data. It is checked here, rebuilt as plain SVG from the checked values, and never run as code.
const fs = require('fs');
const path = require('path');
const { contrast, readableOn } = require('./color');
const { SURFACES } = require('./themes');

const MAX_PACKS = 12;
const MAX_FILE_BYTES = 20 * 1024;
const MAX_SHAPES = 12;
const MAX_PATH_CHARS = 400;
const MIN_INK_CONTRAST = 4.5;
const COORD_MIN = -10; // the face box is 0 to 24; a little room lets ears and horns stick out
const COORD_MAX = 34;

const HEX = /^#[0-9a-f]{6}$/i;
const NAME = /^[\p{L}\p{N} '.-]{1,30}$/u;
const PATH_CHARS = /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,-]+$/; // only drawing commands and numbers

const fail = (message) => { throw new Error(message); };
const isNumber = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const needHex = (value, what) => (typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fail(`${what} must be a color like #d97706.`));

function checkShape(shape, n) {
  if (!shape || typeof shape !== 'object') fail(`Shape ${n} is not an object.`);
  const { d } = shape;
  if (typeof d !== 'string' || !d.trim() || d.length > MAX_PATH_CHARS || !PATH_CHARS.test(d)) fail(`Shape ${n} has a drawing path that is empty, too long or uses other characters.`);
  if ((d.match(/-?\d*\.?\d+/g) || []).some((x) => !isNumber(Number(x), COORD_MIN, COORD_MAX))) fail(`Shape ${n} has numbers outside the face box.`);
  const fill = shape.fill === 'none' ? 'none' : needHex(shape.fill, `Shape ${n} fill`);
  const stroke = shape.stroke === undefined ? null : needHex(shape.stroke, `Shape ${n} stroke`);
  return `<path d="${d.trim()}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width=".6"` : ''}/>`;
}

function checkEyes(eyes) {
  if (eyes === undefined) return null;
  const ok = eyes && Array.isArray(eyes.cx) && eyes.cx.length === 2 && eyes.cx.every((x) => isNumber(x, 0, 24))
    && isNumber(eyes.y, 0, 24) && isNumber(eyes.w, 0.5, 8) && isNumber(eyes.h, 0.5, 6) && isNumber(eyes.tilt, -45, 45);
  if (!ok) fail('Eyes need two x positions (0 to 24), y, w (up to 8), h (up to 6) and tilt (-45 to 45).');
  return { cx: [...eyes.cx], y: eyes.y, w: eyes.w, h: eyes.h, tilt: eyes.tilt, color: needHex(eyes.color, 'Eye color') };
}

// raw: parsed JSON. slug: from the file name. Returns a look shaped like the built-in ones, or throws a plain sentence.
function checkPack(raw, slug) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('A pack must be a JSON object.');
  if (typeof raw.name !== 'string' || !NAME.test(raw.name.trim())) fail("Name must be 1 to 30 characters: letters, numbers, spaces, and . ' - only.");
  const a = needHex(raw.a, 'Color a');
  const b = needHex(raw.b, 'Color b');
  const ink = needHex(raw.ink, 'Ink');
  if (contrast(ink, a) < MIN_INK_CONTRAST) fail('Ink is hard to read on color a. Pick a darker or lighter ink.');
  if (!Array.isArray(raw.shapes) || raw.shapes.length < 1 || raw.shapes.length > MAX_SHAPES) fail(`A pack needs 1 to ${MAX_SHAPES} shapes.`);
  const drawing = raw.shapes.map((shape, i) => checkShape(shape, i + 1)).join('');
  return {
    id: `pack-${slug}`, label: raw.name.trim(), a, b, ink, isHero: true, isPack: true, accent: a, drawing, eyes: checkEyes(raw.eyes),
    textLight: readableOn(a, [SURFACES.light.bg, SURFACES.light.solid], '#000000'),
    textDark: readableOn(a, [SURFACES.dark.bg, SURFACES.dark.solid], '#ffffff'),
  };
}

const slugOf = (file) => path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

// Every good pack in the folder, plus a sentence for each file that was skipped. A missing folder means no packs.
function loadPacks(dir, fsImpl = fs) {
  const packs = [];
  const problems = [];
  let files;
  try { files = fsImpl.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort(); } catch { return { packs, problems }; }
  for (const [index, file] of files.entries()) {
    if (packs.length >= MAX_PACKS) { problems.push(`${files.length - index} more pack file(s) were not loaded (limit ${MAX_PACKS}).`); break; }
    try {
      const full = path.join(dir, file);
      if (fsImpl.statSync(full).size > MAX_FILE_BYTES) fail('The file is larger than 20 KB.');
      const slug = slugOf(file);
      if (!slug) fail('The file name needs letters or numbers.');
      if (packs.some((p) => p.id === `pack-${slug}`)) fail('Another pack already uses this name.');
      let text;
      try { text = fsImpl.readFileSync(full, 'utf8'); } catch { fail('The file could not be read.'); }
      let raw;
      try { raw = JSON.parse(text); } catch { fail('This is not valid JSON.'); }
      packs.push(checkPack(raw, slug));
    } catch (error) {
      problems.push(`${file}: ${error.message}`);
    }
  }
  return { packs, problems };
}

module.exports = { checkPack, loadPacks, MAX_PACKS };
