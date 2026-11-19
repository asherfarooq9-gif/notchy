const test = require('node:test');
const assert = require('node:assert');
const { createCurrencyService, parseRates, convertCurrency, CACHE_MS } = require('../lib/currency');

const ANSWER = { amount: 1, base: 'USD', date: '2026-11-13', rates: { EUR: 0.5, INR: 80, BAD: 'x', lower: 3 } };
const memoryStore = () => { const d = {}; return { get: (n, f) => (n in d ? d[n] : f), set: (n, v) => { d[n] = v; } }; };

test('rates are read, USD is added and junk entries are dropped', () => {
  const { date, rates } = parseRates(ANSWER);
  assert.strictEqual(date, '2026-11-13');
  assert.deepStrictEqual(rates, { USD: 1, EUR: 0.5, INR: 80 });
  assert.throws(() => parseRates({}), /unexpected/);
});
test('converting goes through the dollar', () => {
  const { rates } = parseRates(ANSWER);
  assert.strictEqual(convertCurrency(rates, 10, 'USD', 'INR'), 800);
  assert.strictEqual(convertCurrency(rates, 40, 'EUR', 'INR'), 6400);
  assert.throws(() => convertCurrency(rates, 1, 'USD', 'XXX'), /Unknown/);
  assert.throws(() => convertCurrency(rates, NaN, 'USD', 'EUR'), /number/);
});
test('rates are cached for 6 hours', async () => {
  let clock = 0; let calls = 0;
  const service = createCurrencyService({ store: memoryStore(), now: () => clock, fetchImpl: async () => { calls++; return ANSWER; } });
  assert.deepStrictEqual((await service.meta()).codes, ['EUR', 'INR', 'USD']);
  await service.convert(1, 'USD', 'EUR');
  assert.strictEqual(calls, 1);
  clock += CACHE_MS + 1;
  await service.meta();
  assert.strictEqual(calls, 2);
});
test('offline: old rates are used and marked out of date; with none saved it fails', async () => {
  let clock = 0; let offline = false;
  const service = createCurrencyService({ store: memoryStore(), now: () => clock, fetchImpl: async () => { if (offline) throw new Error('offline'); return ANSWER; } });
  offline = true;
  await assert.rejects(service.meta(), /offline/);
  offline = false;
  await service.meta();
  clock += CACHE_MS + 1; offline = true;
  assert.strictEqual((await service.meta()).stale, true);
  assert.strictEqual(await service.convert(2, 'EUR', 'USD'), 4);
});
