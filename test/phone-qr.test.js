const test = require('node:test');
const assert = require('node:assert');
const { qrSvg } = require('../lib/phone-qr');

test('a link becomes a QR picture without the link text inside it', () => {
  const link = 'http://192.168.1.20:5173/?t=abcdef0123456789';
  const svg = qrSvg(link);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.ok(svg.includes('viewBox="0 0 '));
  assert.ok((svg.match(/h1v1h-1z/g) || []).length > 100, 'has many dots');
  assert.ok(!svg.includes('192.168') && !svg.includes('abcdef'));
});
test('the same link always gives the same picture, a different one does not', () => {
  assert.strictEqual(qrSvg('http://10.0.0.2:1/?t=a'), qrSvg('http://10.0.0.2:1/?t=a'));
  assert.notStrictEqual(qrSvg('http://10.0.0.2:1/?t=a'), qrSvg('http://10.0.0.2:1/?t=b'));
});
test('empty or very long text is refused', () => {
  for (const bad of ['', 'x'.repeat(201), null, undefined, 5]) assert.throws(() => qrSvg(bad), /too long/);
});
