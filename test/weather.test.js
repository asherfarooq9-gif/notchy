const test = require('node:test');
const assert = require('node:assert');
const { createWeatherService, parseGeocoding, parseForecast, present, describeSky, CACHE_MS } = require('../lib/weather');

// A shortened copy of a real Open-Meteo answer.
const FORECAST = {
  current: { time: '2026-11-14T20:00', temperature_2m: 6.3, relative_humidity_2m: 72, apparent_temperature: 3.5, weather_code: 0, wind_speed_10m: 6.5, uv_index: 0 },
  hourly: { time: ['2026-11-14T20:00', '2026-11-14T21:00'], temperature_2m: [6.3, 5.9], weather_code: [0, 3] },
  daily: { time: ['2026-11-14', '2026-11-15'], weather_code: [3, 61], temperature_2m_max: [9.7, 11], temperature_2m_min: [-0.4, 4], uv_index_max: [0.65, 1.2] },
};
const GEOCODING = { results: [{ id: 1, name: 'London', latitude: 51.50853, longitude: -0.12574, country: 'United Kingdom', admin1: 'England' }, { name: 'Broken' }] };

function memoryStore() {
  const data = {};
  return { get: (name, fallback) => (name in data ? data[name] : fallback), set: (name, value) => { data[name] = value; } };
}

test('cities are read from the search answer, and an answer with no matches is an empty list', () => {
  assert.deepStrictEqual(parseGeocoding(GEOCODING), [{ name: 'London', region: 'England, United Kingdom', latitude: 51.50853, longitude: -0.12574 }]);
  assert.deepStrictEqual(parseGeocoding({ generationtime_ms: 1 }), []);
});
test('the forecast is read and a strange answer is refused', () => {
  const forecast = parseForecast(FORECAST);
  assert.strictEqual(forecast.now.temp, 6.3);
  assert.strictEqual(forecast.hours.length, 2);
  assert.strictEqual(forecast.days[1].max, 11);
  assert.throws(() => parseForecast({}), /unexpected/);
});
test('sky codes get a plain word and a symbol', () => {
  assert.strictEqual(describeSky(0).label, 'Clear sky');
  assert.strictEqual(describeSky(95).label, 'Thunderstorm');
  assert.strictEqual(describeSky(1234).label, 'Unknown');
});
test('the chosen unit changes the numbers', () => {
  const celsius = present(parseForecast(FORECAST), 'c');
  const fahrenheit = present(parseForecast(FORECAST), 'f');
  assert.strictEqual(celsius.now.temp, 6);
  assert.strictEqual(fahrenheit.now.temp, 43);
  assert.strictEqual(fahrenheit.days[0].min, 31);
  assert.strictEqual(fahrenheit.now.windUnit, 'mph');
});
test('no city chosen yet means no internet call', async () => {
  let calls = 0;
  const service = createWeatherService({ store: memoryStore(), fetchImpl: async () => { calls++; return {}; } });
  assert.deepStrictEqual(await service.get(), { place: null, unit: 'c' });
  assert.strictEqual(calls, 0);
});
test('weather is cached for 15 minutes, then fetched again', async () => {
  let clock = 1000;
  let calls = 0;
  const service = createWeatherService({ store: memoryStore(), now: () => clock, fetchImpl: async () => { calls++; return FORECAST; } });
  service.choose({ name: 'London', region: 'England', latitude: 51.5, longitude: -0.1 });
  await service.get();
  await service.get();
  assert.strictEqual(calls, 1);
  clock += CACHE_MS + 1;
  await service.get();
  assert.strictEqual(calls, 2);
  await service.get({ force: true });
  assert.strictEqual(calls, 3);
});
test('when the internet fails the last answer is shown as out of date, and with none the error is shown', async () => {
  let clock = 1000;
  let fail = false;
  const service = createWeatherService({ store: memoryStore(), now: () => clock, fetchImpl: async () => { if (fail) throw new Error('offline'); return FORECAST; } });
  service.choose({ name: 'London', region: '', latitude: 51.5, longitude: -0.1 });
  fail = true;
  assert.strictEqual((await service.get()).error, 'offline');
  fail = false;
  await service.get();
  clock += CACHE_MS + 1;
  fail = true;
  const stale = await service.get();
  assert.strictEqual(stale.stale, true);
  assert.strictEqual(stale.now.temp, 6);
});
test('only valid places are accepted and a short search makes no call', async () => {
  const service = createWeatherService({ store: memoryStore(), fetchImpl: async () => GEOCODING });
  assert.throws(() => service.choose({ name: 'Nowhere', latitude: 999, longitude: 0 }), /not valid/);
  assert.deepStrictEqual(await service.search('a'), []);
  assert.strictEqual((await service.search('London')).length, 1);
});
test('the unit choice is remembered', async () => {
  const service = createWeatherService({ store: memoryStore(), fetchImpl: async () => FORECAST });
  service.setUnit('f');
  assert.strictEqual((await service.get()).unit, 'f');
});
