const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { runPs, spawnPsLines, psArgs, firstLine } = require('../lib/ps');

test('arguments are always a list, with -Sta only when asked', () => {
  assert.deepStrictEqual(psArgs('a.ps1', ['-X', '1']), ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'a.ps1', '-X', '1']);
  assert.ok(psArgs('a.ps1', [], { sta: true }).includes('-Sta'));
});
test('runPs resolves with trimmed output and rejects with the first error line', async () => {
  const fake = (error, out, err) => (file, args, options, done) => setImmediate(() => done(error, out, err));
  assert.strictEqual(await runPs('s.ps1', [], { execFileImpl: fake(null, ' hi \r\n', '') }), 'hi');
  await assert.rejects(runPs('s.ps1', [], { execFileImpl: fake(new Error('x'), '', 'Bad thing.\r\nat line 4') }), /^Error: Bad thing\.$/);
  await assert.rejects(runPs('s.ps1', [], { fallback: 'Nope', execFileImpl: fake(new Error('x'), '', '') }), /Nope/);
  assert.strictEqual(firstLine(undefined), '');
});
test('spawnPsLines passes on good lines, reports bad ones, and reports the exit with its error line', () => {
  const child = new EventEmitter();
  Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), stdin: Object.assign(new PassThrough(), { writable: true }), kill() { this.killed = true; } });
  const seen = { lines: [], bad: [], exit: null };
  const watcher = spawnPsLines('s.ps1', [], { spawnImpl: () => child, onLine: (e) => seen.lines.push(e), onBadLine: (t) => seen.bad.push(t), onExit: (code, msg) => { seen.exit = [code, msg]; } });
  child.stdout.write('{"e":"a"}\nnot json\n');
  child.stderr.write('Oops\nmore');
  let written = '';
  child.stdin.on('data', (d) => { written += d; });
  watcher.send('say hi\nthere');
  return new Promise((resolve) => setImmediate(() => {
    child.emit('exit', 2);
    assert.deepStrictEqual(seen.lines, [{ e: 'a' }]);
    assert.deepStrictEqual(seen.bad, ['not json']);
    assert.deepStrictEqual(seen.exit, [2, 'Oops']);
    assert.strictEqual(written, 'say hi there\n', 'a line break can never become a second command');
    watcher.kill();
    assert.strictEqual(child.killed, true);
    resolve();
  }));
});
test('a script that cannot start is reported as an exit, not an unhandled error', () => {
  const child = new EventEmitter();
  Object.assign(child, { stdout: new PassThrough(), stderr: new PassThrough(), stdin: Object.assign(new PassThrough(), { writable: true }), kill() {} });
  let exit = null;
  spawnPsLines('s.ps1', [], { spawnImpl: () => child, onLine() {}, onExit: (code, msg) => { exit = [code, msg]; } });
  child.emit('error', new Error('spawn powershell.exe ENOENT'));
  assert.deepStrictEqual(exit, [-1, 'spawn powershell.exe ENOENT']);
});
test('a script stopped for taking too long says so', async () => {
  const slow = (file, args, options, done) => setImmediate(() => done(Object.assign(new Error('killed'), { killed: true }), '', ''));
  await assert.rejects(runPs('s.ps1', [], { timeoutMessage: 'Took too long.', fallback: 'Nope', execFileImpl: slow }), /^Error: Took too long\.$/);
  await assert.rejects(runPs('s.ps1', [], { fallback: 'Nope', execFileImpl: slow }), /Nope/);
});
test('a script inside the packaged app is run from its unpacked copy', () => {
  const { unpackedPath } = require('../lib/ps');
  assert.strictEqual(unpackedPath('C:\\Apps\\Notch\\resources\\app.asar\\scripts\\pc.ps1'), 'C:\\Apps\\Notch\\resources\\app.asar.unpacked\\scripts\\pc.ps1');
  assert.strictEqual(unpackedPath('C:/Apps/Notch/resources/app.asar/scripts/pc.ps1'), 'C:/Apps/Notch/resources/app.asar.unpacked/scripts/pc.ps1');
  assert.strictEqual(unpackedPath('C:\\dev\\notch\\scripts\\pc.ps1'), 'C:\\dev\\notch\\scripts\\pc.ps1', 'a normal folder is left alone');
  assert.strictEqual(unpackedPath('C:\\x\\app.asar.unpacked\\scripts\\a.ps1'), 'C:\\x\\app.asar.unpacked\\scripts\\a.ps1', 'never changed twice');
  assert.ok(psArgs('C:\\x\\app.asar\\scripts\\a.ps1').includes('C:\\x\\app.asar.unpacked\\scripts\\a.ps1'));
});
