const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The glow colors are set on #glow and read by the four edges inside it.
// A registered property that does not inherit leaves every edge transparent (no glow at all).
test('every glow color property is passed down to the edges', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'ambient.css'), 'utf8');
  const rules = css.match(/@property --[a-z0-9]+ \{[^}]*\}/g) || [];
  assert.strictEqual(rules.length, 12);
  for (const rule of rules) assert.match(rule, /inherits:\s*true/, rule);
});
