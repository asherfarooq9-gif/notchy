const test = require('node:test');
const assert = require('node:assert');
const { classify, colorForms, tidy } = require('../renderer/clip-kind');

test('copied text is sorted into a kind', () => {
  const cases = [
    ['https://example.com/a?b=1', 'url'], ['  http://x.org  ', 'url'], ['https://a.com and more words', 'text'], ['javascript:alert(1)', 'text'], ['ftp://x.org/file', 'text'],
    ['#fff', 'color'], ['#1A2B3C', 'color'], ['rgb(10, 20, 30)', 'color'], ['rgb(300, 0, 0)', 'text'], ['#12345', 'text'],
    ['me@example.com', 'email'], ['me@example', 'text'], ['two words@x.com', 'text'],
    ['+1 (555) 123-4567', 'phone'], ['12345', 'text'], ['call 5551234567 now', 'text'],
    ['2024-01-15', 'text'], ['15/01/2024', 'text'], ['2024.01.15', 'text'], ['3.14159265', 'text'], ['555-123-4567', 'phone'], ['555.123.4567', 'phone'],
    ['hello world', 'text'], ['', 'text'], [null, 'text'], [undefined, 'text'],
  ];
  for (const [input, kind] of cases) assert.strictEqual(classify(input), kind, String(input));
});
test('a colour can be shown in both forms', () => {
  assert.deepStrictEqual(colorForms('#fff'), { hex: '#ffffff', rgb: 'rgb(255, 255, 255)' });
  assert.deepStrictEqual(colorForms('#1A2B3C'), { hex: '#1a2b3c', rgb: 'rgb(26, 43, 60)' });
  assert.deepStrictEqual(colorForms('rgb(10, 20, 30)'), { hex: '#0a141e', rgb: 'rgb(10, 20, 30)' });
  assert.strictEqual(colorForms('blue'), null);
  assert.strictEqual(colorForms('rgb(256, 0, 0)'), null);
});
test('tidy trims, squeezes spaces, and keeps at most one blank line', () => {
  assert.strictEqual(tidy('  hello    world  \r\n\r\n\r\n\r\nnext   line \t '), 'hello world\n\nnext line');
  assert.strictEqual(tidy('already tidy'), 'already tidy');
  assert.strictEqual(tidy(''), '');
});
