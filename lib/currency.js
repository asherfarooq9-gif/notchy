// Money exchange rates from Frankfurter (free, no account, European Central Bank data, updated on working days).
// Rates are cached for 6 hours; with no internet the last saved rates are used and marked out of date.
const { fetchJson } = require('./web');

const HOST = 'api.frankfurter.dev';
const URL = `https://${HOST}/v1/latest?base=USD`;
const CACHE_MS = 6 * 60 * 60 * 1000;
const CODE = /^[A-Z]{3}$/;

// {base:'USD', date:'2026-11-13', rates:{AUD:1.47,...}} becomes {date, rates} with USD added as 1.
function parseRates(json) {
  const rates = json && json.rates;
  if (!rates || typeof rates !== 'object' || typeof json.date !== 'string') throw new Error('The rates service sent something unexpected');
  const clean = { USD: 1 };
  for (const [code, rate] of Object.entries(rates)) {
    if (CODE.test(code) && Number.isFinite(rate) && rate > 0) clean[code] = rate;
  }
  return { date: json.date, rates: clean };
}

function convertCurrency(rates, amount, from, to) {
  if (!Number.isFinite(amount)) throw new Error('That is not a number');
  if (!rates[from] || !rates[to]) throw new Error('Unknown currency');
  return (amount / rates[from]) * rates[to];
}

function createCurrencyService({ store, fetchImpl = fetchJson, now = Date.now }) {
  // {date, rates, stale} or throws when there are no rates and no internet.
  async function load() {
    const cached = store.get('currencyRates', null);
    if (cached && cached.rates && now() - cached.at < CACHE_MS) return { ...cached, stale: false };
    try {
      const fresh = parseRates(await fetchImpl(URL, { allowedHosts: [HOST] }));
      store.set('currencyRates', { ...fresh, at: now() });
      return { ...fresh, at: now(), stale: false };
    } catch (err) {
      if (cached && cached.rates) return { ...cached, stale: true };
      throw err;
    }
  }
  return {
    async meta() {
      const { date, rates, stale } = await load();
      return { codes: Object.keys(rates).sort(), date, stale };
    },
    async convert(amount, from, to) {
      return convertCurrency((await load()).rates, amount, String(from), String(to));
    },
  };
}

module.exports = { createCurrencyService, parseRates, convertCurrency, CACHE_MS };
