const test = require('node:test');
const assert = require('node:assert');
const { edgeColors, contentBounds, createSmoother, vivid, toCss, strengthOf, shouldRun, STOPS } = require('../lib/ambient');

// Builds a BGRA bitmap from a function (x, y) -> [r, g, b].
function bitmap(width, height, colorAt) {
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colorAt(x, y);
      const i = (y * width + x) * 4;
      bytes[i] = b; bytes[i + 1] = g; bytes[i + 2] = r; bytes[i + 3] = 255;
    }
  }
  return bytes;
}

test('each edge takes the color near it', () => {
  const bmp = bitmap(32, 18, (x, y) => (x < 16 ? [200, 20, 20] : [20, 20, 200])); // left half red, right half blue
  const colors = edgeColors(bmp, 32, 18);
  assert.strictEqual(colors.left.length, STOPS);
  assert.deepStrictEqual(colors.left[1].map(Math.round), [200, 20, 20]);
  assert.deepStrictEqual(colors.right[1].map(Math.round), [20, 20, 200]);
  assert.ok(colors.top[0][0] > colors.top[2][0], 'top edge goes from red to blue');
});

test('black bars are skipped so the top and bottom still glow', () => {
  const bmp = bitmap(32, 18, (x, y) => (y < 3 || y >= 15 ? [0, 0, 0] : [10, 180, 40])); // letterboxed green picture
  assert.deepStrictEqual(contentBounds(bmp, 32, 18), { top: 3, bottom: 15, left: 0, right: 32 });
  const colors = edgeColors(bmp, 32, 18);
  assert.ok(colors.top[1][1] > 150, 'top glows green, not black');
  assert.ok(colors.bottom[1][1] > 150);
});

test('a dark frame gives no glow', () => {
  assert.strictEqual(edgeColors(bitmap(32, 18, () => [0, 0, 0]), 32, 18), null);
  assert.strictEqual(edgeColors(null, 32, 18), null);
  assert.strictEqual(edgeColors(new Uint8Array(0), 0, 0), null);
});

test('tiny frames do not crash', () => {
  const colors = edgeColors(bitmap(1, 1, () => [90, 90, 90]), 1, 1);
  assert.strictEqual(colors.top.length, STOPS);
});

test('smoother calms small changes and follows scene cuts', () => {
  const frame = (v) => { const c = [v, v, v]; return { top: [c, c, c], right: [c, c, c], bottom: [c, c, c], left: [c, c, c] }; };
  const smoother = createSmoother();
  assert.deepStrictEqual(smoother.next(frame(100)).top[0], [100, 100, 100]);
  const calm = smoother.next(frame(140)).top[0][0];
  assert.ok(calm > 100 && calm < 140, 'moves part of the way');
  const cut = createSmoother();
  cut.next(frame(10));
  assert.strictEqual(cut.next(frame(250)).top[0][0], 250, 'a cut is followed at once');
  assert.strictEqual(smoother.next(null), null);
  assert.deepStrictEqual(smoother.next(frame(60)).top[0], [60, 60, 60], 'starts fresh after a dark frame');
});

test('vivid adds color and keeps gray gray', () => {
  assert.deepStrictEqual(vivid([100, 100, 100]), [100, 100, 100]);
  const [r, g, b] = vivid([200, 100, 100]);
  assert.ok(r > 200 && g < 100 && b < 100);
  assert.ok(vivid([255, 0, 0]).every((v) => v >= 0 && v <= 255));
});

test('toCss makes rgb strings', () => {
  const c = [100, 100, 100];
  assert.strictEqual(toCss({ top: [c, c, c], right: [c, c, c], bottom: [c, c, c], left: [c, c, c] }).top[0], 'rgb(100,100,100)');
  assert.strictEqual(toCss(null), null);
});

test('strength follows the 1-5 slider', () => {
  assert.strictEqual(strengthOf(5), 1);
  assert.strictEqual(strengthOf(1), 0.2);
  assert.strictEqual(strengthOf(99), 1);
});

test('mode decides when the glow runs', () => {
  assert.strictEqual(shouldRun({ ambientLight: 'off' }, true), false);
  assert.strictEqual(shouldRun({ ambientLight: 'movies' }, false), false);
  assert.strictEqual(shouldRun({ ambientLight: 'movies' }, true), true);
  assert.strictEqual(shouldRun({ ambientLight: 'always' }, false), true);
});
