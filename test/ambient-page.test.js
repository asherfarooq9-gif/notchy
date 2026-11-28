const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'renderer', name), 'utf8');

// The glow is one small canvas stretched over the screen. A page that lost the canvas, or let it shrink, shows no glow at all.
test('the glow page has one canvas that fills the whole window', () => {
  assert.match(read('ambient.html'), /<canvas id="glow"><\/canvas>/);
  const css = read('ambient.css');
  assert.match(css, /#glow\s*\{[^}]*position:\s*fixed[^}]*width:\s*100%[^}]*height:\s*100%/);
});

test('the glow script asks for a fast, tiny screen video', () => {
  const js = read('ambient.js');
  // Measured on a real PC with the picture moving all the time: without a minimum rate the screen video arrived about 6 times a second
  // (a 160 ms wait for each new color). Asking for at least 30 raised that to about 14 a second (70 ms), for about 40 percent more processor time.
  assert.match(js, /minFrameRate:\s*30,\s*maxFrameRate:\s*60\s*\}/);
  assert.match(js, /MIN_FRAME_MS\s*=\s*16/);
});
