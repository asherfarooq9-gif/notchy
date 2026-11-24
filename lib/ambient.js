// Ambient glow: turns a tiny screenshot into colors for the four screen edges. Pure functions, no Electron.
const DARK_LUMA = 14; // a row or column darker than this counts as a black bar
const MAX_TRIM = 0.34; // never skip more than this share of the picture as "bars"
const DEPTH = 2; // how many pixel rows or columns at each edge are averaged
const STOPS = 3; // colors along each edge
const SIDES = ['top', 'right', 'bottom', 'left'];
const AMBIENT_MODES = ['off', 'movies', 'always'];
const CUT_DISTANCE = 150; // a jump bigger than this between frames is a scene cut: follow it at once
const SMOOTHING = 0.4; // share of the new frame mixed in each step (lower = calmer)
const SATURATION = 1.35; // film colors are often dull, so the light is a bit more vivid

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// bitmap: bytes in Blue, Green, Red, Alpha order (what Electron's toBitmap() returns).
function averageRect(bitmap, width, x0, x1, y0, y1) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      b += bitmap[i];
      g += bitmap[i + 1];
      r += bitmap[i + 2];
      count++;
    }
  }
  return count === 0 ? [0, 0, 0] : [r / count, g / count, b / count];
}

// First line (from the start of the list) that is not a black bar, as an index. lineLuma(i) is the average brightness of line i.
function firstLit(count, lineLuma) {
  const limit = Math.floor(count * MAX_TRIM);
  let i = 0;
  while (i < limit && lineLuma(i) < DARK_LUMA) i++;
  return i;
}

// The picture without black bars: {left, right, top, bottom} (right and bottom are exclusive), or null when the whole frame is dark.
function contentBounds(bitmap, width, height) {
  const row = (y) => { const [r, g, b] = averageRect(bitmap, width, 0, width, y, y + 1); return luma(r, g, b); };
  const col = (x) => { const [r, g, b] = averageRect(bitmap, width, x, x + 1, 0, height); return luma(r, g, b); };
  const [r, g, b] = averageRect(bitmap, width, 0, width, 0, height);
  if (luma(r, g, b) < DARK_LUMA) return null;
  return {
    top: firstLit(height, row),
    bottom: height - firstLit(height, (i) => row(height - 1 - i)),
    left: firstLit(width, col),
    right: width - firstLit(width, (i) => col(width - 1 - i)),
  };
}

// Splits [from, to) into STOPS parts.
function parts(from, to) {
  const size = to - from;
  return Array.from({ length: STOPS }, (_, i) => [from + Math.floor((size * i) / STOPS), Math.max(from + Math.floor((size * (i + 1)) / STOPS), from + Math.floor((size * i) / STOPS) + 1)]);
}

// {top, right, bottom, left}, each a list of STOPS [r, g, b] colors (top and bottom run left to right, left and right run top to bottom).
// Returns null when the frame is dark (a dark scene, or protected video that screen capture shows as black).
function edgeColors(bitmap, width, height) {
  if (!bitmap || width < 1 || height < 1) return null;
  const box = contentBounds(bitmap, width, height);
  if (!box) return null;
  const { top, bottom, left, right } = box;
  const across = parts(left, right);
  const down = parts(top, bottom);
  const edge = (x0, x1, y0, y1) => averageRect(bitmap, width, x0, Math.max(x1, x0 + 1), y0, Math.max(y1, y0 + 1));
  return {
    top: across.map(([a, b]) => edge(a, b, top, top + DEPTH)),
    bottom: across.map(([a, b]) => edge(a, b, bottom - DEPTH, bottom)),
    left: down.map(([a, b]) => edge(left, left + DEPTH, a, b)),
    right: down.map(([a, b]) => edge(right - DEPTH, right, a, b)),
  };
}

const flatten = (frame) => SIDES.flatMap((side) => frame[side]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Mixes each new frame into the last one so the light does not flicker, but jumps at a scene cut.
function createSmoother() {
  let previous = null;
  return {
    next(frame) {
      if (!frame) { previous = null; return null; }
      if (previous) {
        const now = flatten(frame);
        const before = flatten(previous);
        const mean = now.reduce((sum, color, i) => sum + distance(color, before[i]), 0) / now.length;
        const mix = mean > CUT_DISTANCE ? 1 : SMOOTHING;
        previous = Object.fromEntries(SIDES.map((side) => [side, frame[side].map((color, i) => color.map((v, c) => previous[side][i][c] + (v - previous[side][i][c]) * mix))]));
      } else {
        previous = frame;
      }
      return previous;
    },
  };
}

// More color, same brightness. Returns whole numbers 0-255.
function vivid([r, g, b], boost = SATURATION) {
  const gray = luma(r, g, b);
  const lift = (v) => Math.round(Math.min(255, Math.max(0, gray + (v - gray) * boost)));
  return [lift(r), lift(g), lift(b)];
}

// Frame ready for the glow window: {top: ['rgb(..)', ...], ...} or null.
function toCss(frame) {
  if (!frame) return null;
  return Object.fromEntries(SIDES.map((side) => [side, frame[side].map((color) => `rgb(${vivid(color).join(',')})`)]));
}

// Intensity 1-5 -> 0.2-1.
const strengthOf = (intensity) => Math.min(5, Math.max(1, intensity)) / 5;

// "movies" lights up only while a full-screen app (a movie, a game) is running.
function shouldRun(settings, isFullscreen) {
  if (settings.ambientLight === 'always') return true;
  return settings.ambientLight === 'movies' && isFullscreen === true;
}

module.exports = { AMBIENT_MODES, STOPS, SIDES, edgeColors, contentBounds, createSmoother, vivid, toCss, strengthOf, shouldRun };
