const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { THEME_INFO, THEMES, COLOR_MODES, SURFACES } = require('../lib/themes');
const { contrast, mix } = require('../lib/color');
const { sanitize, DEFAULTS } = require('../lib/settings');
const { build, FILE } = require('../scripts/make-looks');
const Heroes = require('../renderer/heroes.js');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
const looksCss = read('renderer', 'looks.css');
const notchCss = read('renderer', 'style.css');

// The neutral colors of a mode, read back from looks.css.
function neutrals(mode) {
  const start = looksCss.indexOf(`[data-mode="${mode}"] {`);
  const block = looksCss.slice(start, looksCss.indexOf('\n}', start));
  return Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+): ([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

test('every look has a unique id, a unique name and valid colors', () => {
  assert.strictEqual(new Set(THEMES).size, THEMES.length);
  assert.strictEqual(new Set(THEME_INFO.map((t) => t.label)).size, THEME_INFO.length);
  for (const t of THEME_INFO) for (const key of ['a', 'b', 'ink', 'textLight', 'textDark']) assert.match(t[key], /^#[0-9a-f]{6}$/i, `${t.id} ${key}`);
});
test('Classic is the default look, light is the default mode, and unknown values fall back to them', () => {
  assert.strictEqual(DEFAULTS.theme, 'classic');
  assert.strictEqual(DEFAULTS.colorMode, 'light');
  assert.deepStrictEqual(COLOR_MODES, ['light', 'dark']);
  assert.strictEqual(sanitize({ theme: 'galactus' }).theme, 'classic');
  assert.strictEqual(sanitize({ theme: 'marvel' }).theme, 'classic', 'the old Marvel look maps to the default');
  assert.strictEqual(sanitize({ colorMode: 'sepia' }).colorMode, 'light');
  assert.strictEqual(sanitize({ colorMode: 'dark' }).colorMode, 'dark');
});
test('settings accept every look', () => {
  for (const id of THEMES) assert.strictEqual(sanitize({ theme: id }).theme, id);
});
test('renderer/looks.css is exactly what the generator writes (nothing edited by hand, nothing stale)', () => {
  assert.strictEqual(fs.readFileSync(FILE, 'utf8'), build());
});
test('every look is readable in BOTH modes: its text color, the text on its buttons, and the plain text colors', () => {
  for (const mode of COLOR_MODES) {
    const k = neutrals(mode);
    const { bg, solid } = SURFACES[mode];
    assert.strictEqual(k['--bg'], bg, `${mode} background matches the surface table`);
    assert.strictEqual(k['--surface-solid'], solid);
    assert.ok(contrast(k['--text'], bg) >= 12, `${mode} text on background`);
    assert.ok(contrast(k['--muted'], bg) >= 4.5 && contrast(k['--muted'], solid) >= 4.5, `${mode} quiet text`);
    for (const key of ['--good', '--bad', '--hot']) assert.ok(contrast(k[key], bg) >= 3 && contrast(k[key], solid) >= 3, `${mode} ${key}`);
    for (const t of THEME_INFO) {
      const accent = mode === 'light' ? t.textLight : t.textDark;
      assert.ok(contrast(accent, bg) >= 4.5 && contrast(accent, solid) >= 4.5, `${t.id} accent text in ${mode} mode`);
    }
  }
  for (const t of THEME_INFO) assert.ok(contrast(t.ink, t.a) >= 4.5, `${t.id} text on its button color`);
});
test('the colored glow behind the glass never makes quiet text unreadable', () => {
  for (const mode of COLOR_MODES) {
    const k = neutrals(mode);
    const share = parseInt(k['--wash-a'], 10) / 100;
    for (const t of THEME_INFO) {
      const tinted = mix(t.a, SURFACES[mode].bg, share); // the strongest the glow gets, straight from the color
      assert.ok(contrast(k['--muted'], tinted) >= 3.2, `${t.id} ${mode} quiet text over the glow`);
    }
  }
});
test('every look also dresses the notch itself with an edge line', () => {
  for (const t of THEME_INFO) {
    const line = notchCss.split('\n').find((l) => l.startsWith(`body[data-theme="${t.id}"] {`));
    assert.ok(line, `${t.id} has no notch style`);
    assert.ok(line.includes('--ring:'), `${t.id} has no edge line`);
  }
});
test('every hero look has its own drawing, the plain looks keep the Batman face', () => {
  assert.deepStrictEqual([...Heroes.ids].sort(), THEME_INFO.filter((t) => t.isHero).map((t) => t.id).sort());
});
test('both windows load the shared colors and drawings', () => {
  for (const page of ['settings.html', 'panel.html']) {
    const html = read('renderer', page);
    assert.ok(html.includes('href="looks.css"'), `${page} looks`);
    assert.ok(html.includes('src="heroes.js"'), `${page} drawings`);
  }
  assert.ok(read('renderer', 'index.html').includes('src="heroes.js"'));
});
test('no visible text uses an em dash or an en dash', () => {
  const files = ['renderer/index.html', 'renderer/settings.html', 'renderer/panel.html', 'renderer/app.js', 'renderer/settings.js', ...fs.readdirSync(path.join(__dirname, '..', 'renderer', 'panel', 'modules')).map((f) => `renderer/panel/modules/${f}`)];
  for (const f of files) assert.ok(!/[—–]/.test(read(...f.split('/'))), `${f} has a long dash`);
});
