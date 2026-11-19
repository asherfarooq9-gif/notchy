const test = require('node:test');
const assert = require('node:assert');
const { convert, unitsOf, CATEGORY_NAMES } = require('../lib/units');

const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} is not close to ${expected}`);

test('length, weight and volume convert both ways', () => {
  close(convert('length', 1, 'km', 'mi'), 0.621371, 1e-5);
  close(convert('length', 12, 'in', 'ft'), 1);
  close(convert('weight', 1, 'kg', 'lb'), 2.20462, 1e-4);
  close(convert('volume', 1, 'gal', 'l'), 3.78541, 1e-4);
});
test('temperature uses the real formulas, not a scale factor', () => {
  close(convert('temperature', 100, 'C', 'F'), 212);
  close(convert('temperature', 32, 'F', 'C'), 0);
  close(convert('temperature', 0, 'K', 'C'), -273.15);
});
test('data uses 1000 for KB and 1024 for KiB', () => {
  close(convert('data', 1, 'GB', 'MB'), 1000);
  close(convert('data', 1, 'GiB', 'MiB'), 1024);
});
test('speed and time convert', () => {
  close(convert('speed', 36, 'km/h', 'm/s'), 10);
  close(convert('time', 2, 'h', 'min'), 120);
});
test('bad input is rejected, not guessed', () => {
  assert.throws(() => convert('length', 1, 'km', 'kg'), /Unknown unit/);
  assert.throws(() => convert('length', NaN, 'km', 'mi'), /number/);
  assert.throws(() => unitsOf('colour'), /Unknown category/);
});
test('every category lists its units', () => {
  for (const name of CATEGORY_NAMES) assert.ok(unitsOf(name).length >= 3, name);
});
