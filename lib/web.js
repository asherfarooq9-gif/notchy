// Fetching small pieces of text or JSON from the internet, safely: secure (https) addresses only, an optional
// list of allowed websites, never your own computer or network, and a time limit and a size limit.
// Every step of a redirect is checked BEFORE it is followed, and website names are checked by the address they point to.
const dns = require('dns');

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

// True for addresses that point inside your own computer or home network.
function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '::1' || host === '::' || host.startsWith('::ffff:') || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe[89ab][0-9a-f]:/.test(host)) return true; // "::ffff:" hides an IPv4 address inside IPv6
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

async function assertAllowed(url, { allowedHosts, lookupImpl }) {
  if (url.protocol !== 'https:') throw new Error('Only secure (https) addresses are allowed');
  if (isPrivateHost(url.hostname)) throw new Error('Addresses on your own network are not allowed');
  if (allowedHosts && !allowedHosts.includes(url.hostname)) throw new Error('That website is not on the allowed list');
  // A website name can secretly point at a home-network address, so look where it leads.
  const isLiteralAddress = /^[\d.]+$/.test(url.hostname) || url.hostname.startsWith('[');
  if (!isLiteralAddress) {
    let found;
    try { found = await lookupImpl(url.hostname); } catch { throw new Error('Could not find that website'); }
    if (found.some((entry) => isPrivateHost(entry.address))) throw new Error('Addresses on your own network are not allowed');
  }
}

// Reads the body but gives up as soon as it grows past the limit.
async function readLimited(response, maxBytes) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new Error('The response is too large');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { await reader.cancel(); throw new Error('The response is too large'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const defaultLookup = (hostname) => dns.promises.lookup(hostname, { all: true });

async function fetchText(address, { allowedHosts, maxBytes = MAX_BYTES, timeoutMs = TIMEOUT_MS, fetchImpl = fetch, lookupImpl = defaultLookup } = {}) {
  const signal = AbortSignal.timeout(timeoutMs);
  let url = new URL(address);
  for (let hops = 0; ; hops++) {
    await assertAllowed(url, { allowedHosts, lookupImpl });
    const response = await fetchImpl(url, { signal, redirect: 'manual' });
    const isRedirect = response.status >= 300 && response.status < 400 && response.headers.get('location');
    if (!isRedirect) {
      if (!response.ok) throw new Error(`The website answered with an error (${response.status})`);
      return readLimited(response, maxBytes);
    }
    if (hops >= MAX_REDIRECTS) throw new Error('The website sent you around in circles');
    url = new URL(response.headers.get('location'), url); // the next stop is checked at the top of the loop, before any request
  }
}

async function fetchJson(address, options) {
  const text = await fetchText(address, options);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The website sent something that is not valid data');
  }
}

module.exports = { fetchText, fetchJson, isPrivateHost };
