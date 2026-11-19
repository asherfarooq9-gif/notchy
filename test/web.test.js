const test = require('node:test');
const assert = require('node:assert');
const { fetchText, fetchJson, isPrivateHost } = require('../lib/web');

const publicDns = async () => [{ address: '93.184.216.34' }];
const answer = (body, init = {}) => async () => new Response(body, { status: 200, ...init });
// every test uses a pretend name lookup, so no test touches the real internet
const withDns = (options) => ({ lookupImpl: publicDns, ...options });
const redirectTo = (location) => async () => new Response(null, { status: 302, headers: { location } });

test('only secure addresses are fetched', async () => {
  await assert.rejects(fetchText('http://example.com/x', withDns({ fetchImpl: answer('hi') })), /secure/);
  assert.strictEqual(await fetchText('https://example.com/x', withDns({ fetchImpl: answer('hi') })), 'hi');
});
test('only allowed websites are fetched when a list is given', async () => {
  const options = withDns({ allowedHosts: ['api.open-meteo.com'], fetchImpl: answer('{}') });
  await assert.rejects(fetchText('https://evil.example/x', options), /allowed list/);
  assert.strictEqual(await fetchText('https://api.open-meteo.com/v1/x', options), '{}');
});
test('your own computer and home network are never fetched, in any spelling', async () => {
  const hosts = ['localhost', '127.0.0.1', '192.168.1.1', '10.0.0.5', '172.16.9.9', '169.254.1.1', '[::1]', 'printer.local', '[::ffff:127.0.0.1]', '100.64.0.1', '100.127.255.255'];
  for (const host of hosts) await assert.rejects(fetchText(`https://${host}/x`, withDns({ fetchImpl: answer('x') })), /own network/, host);
  assert.strictEqual(isPrivateHost('172.32.0.1'), false);
  assert.strictEqual(isPrivateHost('100.128.0.1'), false);
  assert.strictEqual(isPrivateHost('8.8.8.8'), false);
});
test('a website name that secretly points at your network is refused', async () => {
  const sneaky = { lookupImpl: async () => [{ address: '93.184.216.34' }, { address: '192.168.0.9' }], fetchImpl: answer('secret') };
  await assert.rejects(fetchText('https://looks-fine.example/x', sneaky), /own network/);
  await assert.rejects(fetchText('https://nowhere.example/x', { lookupImpl: async () => { throw new Error('ENOTFOUND'); }, fetchImpl: answer('x') }), /Could not find/);
});
test('a redirect to a forbidden place is refused BEFORE it is requested', async () => {
  const requested = [];
  const fetchImpl = async (url) => { requested.push(String(url)); return redirectTo('https://192.168.0.1/admin')(); };
  await assert.rejects(fetchText('https://example.com/x', withDns({ fetchImpl })), /own network/);
  assert.deepStrictEqual(requested, ['https://example.com/x']);
  await assert.rejects(fetchText('https://example.com/x', withDns({ fetchImpl: redirectTo('http://example.com/plain') })), /secure/);
});
test('good redirects are followed, relative ones too, but not forever', async () => {
  let calls = 0;
  const hop = async (url) => (++calls === 1 ? redirectTo('/final')() : new Response(`at ${new URL(url).pathname}`));
  assert.strictEqual(await fetchText('https://example.com/start', withDns({ fetchImpl: hop })), 'at /final');
  await assert.rejects(fetchText('https://example.com/x', withDns({ fetchImpl: redirectTo('https://example.com/x') })), /circles/);
});
test('a response that is too large is refused', async () => {
  await assert.rejects(fetchText('https://example.com/x', withDns({ maxBytes: 10, fetchImpl: answer('x'.repeat(50)) })), /too large/);
});
test('an error answer, bad JSON and a slow website are reported plainly', async () => {
  await assert.rejects(fetchText('https://example.com/x', withDns({ fetchImpl: answer('no', { status: 500 }) })), /error \(500\)/);
  await assert.rejects(fetchJson('https://example.com/x', withDns({ fetchImpl: answer('not json') })), /not valid data/);
  const slow = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  await assert.rejects(Promise.race([fetchText('https://example.com/x', withDns({ timeoutMs: 30, fetchImpl: slow })), new Promise((_, reject) => setTimeout(() => reject(new Error('the time limit did not work')), 2000))]), (err) => err.name === 'TimeoutError');
});
