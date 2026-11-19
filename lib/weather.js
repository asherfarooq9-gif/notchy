// Weather from Open-Meteo (free, no account). Only the chosen city's coordinates are ever sent, never anything else.
// Parsers are pure so they can be tested against saved answers; the service adds a 15-minute cache.
const { fetchJson } = require('./web');

const GEOCODING_HOST = 'geocoding-api.open-meteo.com';
const FORECAST_HOST = 'api.open-meteo.com';
const CACHE_MS = 15 * 60 * 1000;
const MAX_QUERY = 80;

// Open-Meteo reports the sky as a "WMO code".
const SKY = [
  [[0], 'Clear sky', 'sun'], [[1], 'Mostly clear', 'partly'], [[2], 'Partly cloudy', 'partly'], [[3], 'Overcast', 'cloud'],
  [[45, 48], 'Fog', 'fog'], [[51, 53, 55, 56, 57], 'Drizzle', 'rain'], [[61, 63, 65, 66, 67], 'Rain', 'rain'],
  [[71, 73, 75, 77], 'Snow', 'snow'], [[80, 81, 82], 'Rain showers', 'rain'], [[85, 86], 'Snow showers', 'snow'],
  [[95, 96, 99], 'Thunderstorm', 'storm'],
]; // the third value names an icon drawn in the panel
function describeSky(code) {
  const found = SKY.find(([codes]) => codes.includes(code));
  return found ? { label: found[1], icon: found[2] } : { label: 'Unknown', icon: 'cloud' };
}

const toFahrenheit = (celsius) => Math.round(celsius * 9 / 5 + 32);
const roundTemp = (celsius, unit) => (unit === 'f' ? toFahrenheit(celsius) : Math.round(celsius));
const toMph = (kmh) => Math.round(kmh * 0.621371);

function parseGeocoding(json) {
  const results = Array.isArray(json && json.results) ? json.results : [];
  return results
    .filter((r) => typeof r.name === 'string' && Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r) => ({ name: r.name, region: [r.admin1, r.country].filter(Boolean).join(', '), latitude: r.latitude, longitude: r.longitude }));
}

// Keeps temperatures in °C (the cache stays unit-free); present() turns them into what you chose to see.
function parseForecast(json) {
  const { current, hourly, daily } = json || {};
  if (!current || !hourly || !daily || !Array.isArray(hourly.time) || !Array.isArray(daily.time)) throw new Error('The weather service sent something unexpected');
  return {
    now: { temp: current.temperature_2m, feels: current.apparent_temperature, humidity: current.relative_humidity_2m, windKmh: current.wind_speed_10m, uv: current.uv_index, code: current.weather_code },
    hours: hourly.time.map((time, i) => ({ time, temp: hourly.temperature_2m[i], code: hourly.weather_code[i] })),
    days: daily.time.map((date, i) => ({ date, max: daily.temperature_2m_max[i], min: daily.temperature_2m_min[i], uv: daily.uv_index_max[i], code: daily.weather_code[i] })),
  };
}

function present(forecast, unit) {
  const temp = (celsius) => roundTemp(celsius, unit);
  const sky = (code) => describeSky(code);
  const { now } = forecast;
  return {
    unit,
    now: { temp: temp(now.temp), feels: temp(now.feels), humidity: Math.round(now.humidity), wind: unit === 'f' ? toMph(now.windKmh) : Math.round(now.windKmh), windUnit: unit === 'f' ? 'mph' : 'km/h', uv: Math.round(now.uv * 10) / 10, ...sky(now.code) },
    hours: forecast.hours.map((h) => ({ time: h.time, temp: temp(h.temp), ...sky(h.code) })),
    days: forecast.days.map((d) => ({ date: d.date, max: temp(d.max), min: temp(d.min), uv: Math.round(d.uv * 10) / 10, ...sky(d.code) })),
  };
}

function forecastUrl({ latitude, longitude }) {
  const params = new URLSearchParams({
    latitude: String(latitude), longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index',
    hourly: 'temperature_2m,weather_code', daily: 'weather_code,temperature_2m_max,temperature_2m_min,uv_index_max',
    timezone: 'auto', forecast_days: '7', forecast_hours: '12',
  });
  return `https://${FORECAST_HOST}/v1/forecast?${params}`;
}

function createWeatherService({ store, fetchImpl = fetchJson, now = Date.now }) {
  const saved = () => store.get('weather', {});
  const save = (patch) => store.set('weather', { ...saved(), ...patch });

  return {
    async search(query) {
      const text = String(query || '').trim().slice(0, MAX_QUERY);
      if (text.length < 2) return [];
      const url = `https://${GEOCODING_HOST}/v1/search?${new URLSearchParams({ name: text, count: '6', language: 'en', format: 'json' })}`;
      return parseGeocoding(await fetchImpl(url, { allowedHosts: [GEOCODING_HOST] }));
    },
    choose(place) {
      const { name, region, latitude, longitude } = place || {};
      if (typeof name !== 'string' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('That place is not valid');
      save({ place: { name: name.slice(0, 80), region: String(region || '').slice(0, 80), latitude, longitude }, cache: null });
    },
    setUnit(unit) {
      save({ unit: unit === 'f' ? 'f' : 'c' });
    },
    // {place:null} until a city is chosen. If the internet fails, the last answer is shown and marked stale.
    async get({ force = false } = {}) {
      const { place, cache } = saved();
      const unit = saved().unit === 'f' ? 'f' : 'c';
      if (!place) return { place: null, unit };
      if (!force && cache && now() - cache.at < CACHE_MS) return { place, ...present(cache.forecast, unit), updatedAt: cache.at, stale: false };
      try {
        const forecast = parseForecast(await fetchImpl(forecastUrl(place), { allowedHosts: [FORECAST_HOST] }));
        save({ cache: { at: now(), forecast } });
        return { place, ...present(forecast, unit), updatedAt: now(), stale: false };
      } catch (err) {
        if (cache) return { place, ...present(cache.forecast, unit), updatedAt: cache.at, stale: true };
        return { place, unit, error: err.message };
      }
    },
  };
}

module.exports = { createWeatherService, parseGeocoding, parseForecast, present, describeSky, CACHE_MS };
