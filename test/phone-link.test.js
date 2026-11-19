const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createPhoneLink, isPrivateAddress, cleanFileName } = require('../lib/phone-link');

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-phone-'));
test.after(() => fs.rmSync(base, { recursive: true, force: true }));
let n = 0;
const freshDir = () => path.join(base, 'd' + ++n);

function ask(url, { method = 'GET', body, host, localAddress, headers = {} } = {}) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method, localAddress, headers: { ...(host ? { Host: host } : {}), ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString(), headers: res.headers }));
    });
    req.on('error', reject);
    req.end(body);
  });
}
const make = (extra = {}) => createPhoneLink({ getAddress: () => '127.0.0.1', saveDir: freshDir(), ...extra });
const upload = (url, token, name, body, extra) => ask(`${url}up?t=${token}&name=${encodeURIComponent(name)}`, { method: 'POST', body, ...extra });

test('private network addresses only', () => {
  for (const ok of ['192.168.1.5', '10.0.0.7', '172.16.4.4', '172.31.9.9', '127.0.0.1', '::1', '::ffff:192.168.1.5', 'fe80::1']) assert.ok(isPrivateAddress(ok), ok);
  for (const bad of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '1.2.3.4', '::ffff:8.8.8.8', '2001:db8::1', '', undefined, 'abc']) assert.ok(!isPrivateAddress(bad), String(bad));
});
test('file names are cleaned and cannot leave the folder', () => {
  assert.strictEqual(cleanFileName('../../evil.txt'), 'evil.txt');
  assert.strictEqual(cleanFileName('C:\\Windows\\x.png'), 'x.png');
  assert.strictEqual(cleanFileName('a<b>:c?.jpg'), 'a_b__c_.jpg');
  assert.strictEqual(cleanFileName('  ..  '), 'file');
  assert.strictEqual(cleanFileName('NUL.txt'), '_NUL.txt');
  assert.ok(cleanFileName('x'.repeat(300) + '.png').length <= 100);
  assert.ok(cleanFileName('x'.repeat(300) + '.png').endsWith('.png'));
});

test('the page opens only with the right code and the right host', async () => {
  const link = make();
  const { url, token } = await link.start();
  try {
    assert.strictEqual((await ask(`${url}?t=${token}`)).status, 200);
    assert.strictEqual((await ask(`${url}`)).status, 404);
    assert.strictEqual((await ask(`${url}?t=wrong`)).status, 404);
    assert.strictEqual((await ask(`${url}?t=${token}`, { host: 'evil.example' })).status, 404);
    assert.strictEqual((await ask(`${url}?t=${token}`, { method: 'DELETE' })).status, 405);
    const page = await ask(`${url}?t=${token}`);
    assert.ok(/default-src 'none'/.test(page.headers['content-security-policy']));
    assert.strictEqual(page.headers['x-content-type-options'], 'nosniff');
  } finally { link.stop(); }
});
test('an upload lands in the folder under a safe name and never replaces a file', async () => {
  const dir = freshDir();
  const link = make({ saveDir: dir });
  const { url, token } = await link.start();
  try {
    assert.strictEqual((await upload(url, token, '../../evil.txt', 'one')).status, 200);
    assert.strictEqual((await upload(url, token, 'evil.txt', 'two')).status, 200);
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['evil (2).txt', 'evil.txt']);
    assert.strictEqual(fs.readFileSync(path.join(dir, 'evil.txt'), 'utf8'), 'one');
    assert.deepStrictEqual(link.status().received.map((f) => f.bytes), [3, 3]);
    assert.ok(link.status().phone);
  } finally { link.stop(); }
});
test('programs, oversize files and too many files are refused and leave nothing behind', async () => {
  const dir = freshDir();
  const link = make({ saveDir: dir, maxFileBytes: 10, maxFiles: 2 });
  const { url, token } = await link.start();
  try {
    assert.strictEqual((await upload(url, token, 'setup.exe', 'x')).status, 400);
    assert.strictEqual((await upload(url, token, 'run.BAT', 'x')).status, 400);
    assert.strictEqual((await upload(url, token, 'big.txt', 'x'.repeat(11))).status, 413);
    assert.strictEqual((await upload(url, token, 'a.txt', 'ok')).status, 200);
    assert.strictEqual((await upload(url, token, 'b.txt', 'ok')).status, 200);
    assert.strictEqual((await upload(url, token, 'c.txt', 'ok')).status, 429);
    assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['a.txt', 'b.txt']);
    assert.strictEqual((await ask(`${url}up?t=${token}&name=x.txt`, { method: 'POST', body: 'x', headers: { 'Content-Length': '1' } })).status, 429);
  } finally { link.stop(); }
});
test('only the first phone that uses the code can keep using it', async () => {
  const link = make();
  const { url, token } = await link.start();
  try {
    assert.strictEqual((await ask(`${url}?t=${token}`)).status, 200);
    let other;
    try { other = await ask(`${url}?t=${token}`, { localAddress: '127.0.0.2' }); } catch { return; } // this PC cannot send from a second address: skip
    assert.strictEqual(other.status, 404);
    assert.strictEqual((await upload(url, token, 'x.txt', 'x', { localAddress: '127.0.0.2' })).status, 404);
  } finally { link.stop(); }
});
test('the link stops after its time, and stop works at once', async () => {
  const quick = make({ ttlMs: 60 });
  const started = await quick.start();
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(quick.status().running, false);
  await assert.rejects(() => ask(`${started.url}?t=${started.token}`));
  const link = make();
  const { url, token } = await link.start();
  link.stop();
  assert.strictEqual(link.status().running, false);
  await assert.rejects(() => ask(`${url}?t=${token}`));
});
test('starting twice or without a network is refused plainly', async () => {
  const link = make();
  await link.start();
  try { await assert.rejects(() => link.start(), /already/i); } finally { link.stop(); }
  await assert.rejects(() => make({ getAddress: () => null }).start(), /Wi-?Fi|network/i);
});
test('each start makes a new code', async () => {
  const link = make();
  const a = await link.start(); link.stop();
  const b = await link.start(); link.stop();
  assert.notStrictEqual(a.token, b.token);
  assert.ok(a.token.length >= 32);
});

// ---- fixes from the review ----
const net = require('net');
test('a malformed request is answered with 400 and the server keeps working', async () => {
  const link = make();
  const { url, token } = await link.start();
  try {
    const u = new URL(url);
    const reply = await new Promise((resolve, reject) => {
      const socket = net.connect(u.port, u.hostname, () => socket.write(`GET //[ HTTP/1.1\r\nHost: ${u.host}\r\n\r\n`));
      socket.on('data', (d) => { resolve(String(d).split('\r\n')[0]); socket.destroy(); });
      socket.on('error', reject);
    });
    assert.match(reply, /400/);
    assert.strictEqual((await ask(`${url}?t=${token}`)).status, 200);
  } finally { link.stop(); }
});
test('a disk error while saving gives a 500, leaves no partial file and does not crash', async () => {
  const dir = freshDir();
  const failing = { ...fs, createWriteStream: (file, options) => { const s = fs.createWriteStream(file, options); s._write = (chunk, enc, done) => done(new Error('disk full')); return s; } };
  const link = make({ saveDir: dir, fsImpl: failing });
  const { url, token } = await link.start();
  try {
    assert.strictEqual((await upload(url, token, 'a.txt', 'data')).status, 500);
    assert.deepStrictEqual(fs.readdirSync(dir), []);
    assert.strictEqual(link.status().received.length, 0);
  } finally { link.stop(); }
});
test('two starts at once make one server', async () => {
  const link = make();
  const results = await Promise.allSettled([link.start(), link.start()]);
  try {
    assert.deepStrictEqual(results.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
    assert.match(results.find((r) => r.status === 'rejected').reason.message, /already/i);
    const ok = results.find((r) => r.status === 'fulfilled').value;
    assert.strictEqual((await ask(`${ok.url}?t=${ok.token}`)).status, 200);
  } finally { link.stop(); }
  assert.strictEqual(link.status().running, false);
});
test('risky document and shortcut types are refused', async () => {
  const dir = freshDir();
  const link = make({ saveDir: dir });
  const { url, token } = await link.start();
  try {
    for (const name of ['m.docm', 'm.xlsm', 'x.iso', 'x.chm', 'x.scf', 'x.rdp', 'x.inf', 'x.msc', 'x.library-ms', 'x.settingcontent-ms']) {
      assert.strictEqual((await upload(url, token, name, 'x')).status, 400, name);
    }
    assert.deepStrictEqual(fs.readdirSync(dir), []);
  } finally { link.stop(); }
});
test('a received file is marked as coming from the internet zone (Windows only)', { skip: process.platform !== 'win32' }, async () => {
  const dir = freshDir();
  const link = make({ saveDir: dir });
  const { url, token } = await link.start();
  try {
    await upload(url, token, 'p.txt', 'hello');
    assert.match(fs.readFileSync(path.join(dir, 'p.txt') + ':Zone.Identifier', 'utf8'), /ZoneId=3/);
  } finally { link.stop(); }
});
