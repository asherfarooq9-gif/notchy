// Unit conversion for the Units tool. Each category lists how many base units one of each unit is.
const CATEGORIES = {
  length: { base: 'm', units: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 } },
  weight: { base: 'g', units: { mg: 0.001, g: 1, kg: 1000, t: 1e6, oz: 28.349523125, lb: 453.59237 } },
  volume: { base: 'ml', units: { ml: 1, l: 1000, tsp: 4.92892159375, tbsp: 14.78676478125, floz: 29.5735295625, cup: 236.5882365, pt: 473.176473, gal: 3785.411784 } },
  data: { base: 'B', units: { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1048576, GiB: 1073741824 } },
  speed: { base: 'm/s', units: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, kn: 0.514444444 } },
  time: { base: 's', units: { ms: 0.001, s: 1, min: 60, h: 3600, day: 86400, week: 604800 } },
};
const TEMPERATURE_UNITS = ['C', 'F', 'K'];

function toCelsius(value, unit) {
  if (unit === 'C') return value;
  if (unit === 'F') return ((value - 32) * 5) / 9;
  return value - 273.15;
}

function fromCelsius(value, unit) {
  if (unit === 'C') return value;
  if (unit === 'F') return (value * 9) / 5 + 32;
  return value + 273.15;
}

function unitsOf(category) {
  if (category === 'temperature') return TEMPERATURE_UNITS;
  if (!CATEGORIES[category]) throw new Error('Unknown category: ' + category);
  return Object.keys(CATEGORIES[category].units);
}

function convert(category, value, from, to) {
  if (!Number.isFinite(value)) throw new Error('Value must be a number');
  if (!unitsOf(category).includes(from) || !unitsOf(category).includes(to)) throw new Error(`Unknown unit for ${category}`);
  if (category === 'temperature') return fromCelsius(toCelsius(value, from), to);
  const { units } = CATEGORIES[category];
  return (value * units[from]) / units[to];
}

module.exports = { convert, unitsOf, CATEGORY_NAMES: [...Object.keys(CATEGORIES), 'temperature'] };
