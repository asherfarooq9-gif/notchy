const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { makeEventHandler } = require('../lib/event-server');

const STATES = new Set(['idle', 'done', 'error', 'needs']);

async function setup() {
  const seen = [];
  let handler = null;
  const server = http.createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  handler = makeEventHandler({ port, states: STATES, onEvent: (event) => seen.push(event), maxBytes: 200 });
  const post = (body, { path = '/event', method = 'POST', headers = {} } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', (error) => resolve('closed:' + error.code));
    req.end(body);
  });
  return { seen, post, port, close: () => server.close() };
}

test('a normal post from the Claude hook shows the alert', async () => {
  const { seen, post, close } = await setup();
  try {
    assert.strictEqual(await post(JSON.stringify({ state: 'done', text: 'All finished' })), 204);
    assert.deepStrictEqual(seen, [{ state: 'done', text: 'All finished' }]);
    assert.strictEqual(await post(JSON.stringify({ state: 'idle', text: 'x'.repeat(200) })), 'closed:ECONNRESET', 'oversize bodies are cut off');
    assert.strictEqual(await post(JSON.stringify({ state: 'idle', text: 5 })), 204);
    assert.strictEqual(seen[1].text, undefined, 'text that is not a string is dropped');
  } finally { close(); }
});
test('the text is cut to 80 characters', async () => {
  const { seen, post, close } = await setup();
  try {
    await post(JSON.stringify({ state: 'done', text: 'y'.repeat(120) }));
    assert.strictEqual(seen[0].text.length, 80);
  } finally { close(); }
});
test('a web page in your browser cannot post here', async () => {
  const { seen, post, close } = await setup();
  try {
    const body = JSON.stringify({ state: 'needs', text: 'Your PC is infected. Call 555-0100' });
    assert.strictEqual(await post(body, { headers: { Origin: 'https://evil.example', 'Content-Type': 'text/plain' } }), 403);
    assert.strictEqual(await post(body, { headers: { Origin: 'null' } }), 403, 'even a hidden origin');
    assert.deepStrictEqual(seen, []);
  } finally { close(); }
});
test('a request for a different host name (DNS rebinding) is refused', async () => {
  const { seen, post, close } = await setup();
  try {
    const body = JSON.stringify({ state: 'done', text: 'x' });
    assert.strictEqual(await post(body, { headers: { Host: 'evil.example' } }), 403);
    assert.strictEqual(await post(body, { headers: { Host: 'evil.example:47800' } }), 403);
    assert.deepStrictEqual(seen, []);
  } finally { close(); }
});
test('the host may be written 127.0.0.1 or localhost', async () => {
  const { seen, post, port, close } = await setup();
  try {
    const body = JSON.stringify({ state: 'done', text: 'x' });
    assert.strictEqual(await post(body, { headers: { Host: 'localhost:' + port } }), 204);
    assert.strictEqual(await post(body, { headers: { Host: '127.0.0.1:' + port } }), 204);
    assert.strictEqual(seen.length, 2);
  } finally { close(); }
});
test('wrong paths, methods, states and broken JSON are refused', async () => {
  const { seen, post, close } = await setup();
  try {
    assert.strictEqual(await post('{}', { path: '/other' }), 404);
    assert.strictEqual(await post('', { method: 'GET' }), 404);
    assert.strictEqual(await post(JSON.stringify({ state: 'explode' })), 400);
    assert.strictEqual(await post('{ not json'), 400);
    assert.strictEqual(await post('null'), 400);
    assert.deepStrictEqual(seen, []);
  } finally { close(); }
});
