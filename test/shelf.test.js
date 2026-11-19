const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { createShelfService, MAX_FILES_PER_SHELF } = require('../lib/shelf');
const { copyFilesToClipboard } = require('../lib/file-clipboard');

const memoryStore = () => { const d = {}; return { get: (n, f) => (n in d ? d[n] : f), set: (n, v) => { d[n] = JSON.parse(JSON.stringify(v)); } }; };
const here = new Set();
const statImpl = (p) => { if (!here.has(p)) throw new Error('ENOENT'); };
const file = (name) => { const full = path.resolve('C:\\Users\\x', name); here.add(full); return full; };

test('a first-time user gets one empty shelf, and shelves can be made, renamed and deleted', () => {
  const service = createShelfService({ store: memoryStore(), statImpl });
  assert.strictEqual(service.list().length, 1);
  const id = service.create('  Work   stuff ');
  assert.strictEqual(service.list()[1].name, 'Work stuff');
  service.rename(id, 'School');
  assert.strictEqual(service.list()[1].name, 'School');
  service.delete(id);
  assert.strictEqual(service.list().length, 1);
});
test('files are remembered by place; copies, relative paths and missing files are not added', () => {
  const service = createShelfService({ store: memoryStore(), statImpl });
  const shelf = service.list()[0].id;
  const a = file('a.txt');
  assert.strictEqual(service.add(shelf, [a, a.toUpperCase(), 'relative.txt', path.resolve('C:\\Users\\x', 'ghost.txt'), 42]), 1);
  assert.strictEqual(service.list()[0].files[0].name, 'a.txt');
});
test('a shelf holds a limited number of files', () => {
  const service = createShelfService({ store: memoryStore(), statImpl });
  const shelf = service.list()[0].id;
  const many = Array.from({ length: MAX_FILES_PER_SHELF + 5 }, (_, i) => file(`f${i}.txt`));
  assert.strictEqual(service.add(shelf, many), MAX_FILES_PER_SHELF);
});
test('a file that disappears is shown as missing, and removing and clearing work', () => {
  const service = createShelfService({ store: memoryStore(), statImpl });
  const shelf = service.list()[0].id;
  const gone = file('gone.txt'); const kept = file('kept.txt');
  service.add(shelf, [gone, kept]);
  here.delete(gone);
  const files = service.list()[0].files;
  assert.deepStrictEqual(files.map((f) => f.missing), [true, false]);
  assert.deepStrictEqual(service.existingPaths(shelf), [kept]);
  service.removeFile(shelf, files[0].id);
  assert.strictEqual(service.list()[0].files.length, 1);
  service.clear(shelf);
  assert.strictEqual(service.list()[0].files.length, 0);
});
test('actions are looked up by id, so only shelf files can be reached', () => {
  const service = createShelfService({ store: memoryStore(), statImpl });
  const shelf = service.list()[0].id;
  service.add(shelf, [file('real.txt')]);
  const fileId = service.list()[0].files[0].id;
  assert.ok(service.pathOf(shelf, fileId).endsWith('real.txt'));
  assert.throws(() => service.pathOf(shelf, 'C:\\Windows\\System32\\cmd.exe'), /not on the shelf/);
  assert.throws(() => service.add('nope', []), /no longer exists/);
});
test('copying files sends the paths, encoded, through input and reports failure', async () => {
  let received = '';
  const fakeSpawn = (exe, args) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough(); child.stderr = new PassThrough();
    child.stdin.on('data', (c) => { received += c; });
    child.kill = () => {};
    setImmediate(() => child.emit('exit', 0));
    assert.ok(!args.join(' ').includes('Ünï'), 'paths must not be inside the command text');
    return child;
  };
  assert.strictEqual(await copyFilesToClipboard(['C:\\a\\Ünï.txt'], { spawnImpl: fakeSpawn }), 1);
  assert.deepStrictEqual(JSON.parse(Buffer.from(received, 'base64').toString('utf8')), ['C:\\a\\Ünï.txt']);
  await assert.rejects(copyFilesToClipboard([]), /no files/);
  const failing = () => { const c = new EventEmitter(); c.stdin = new PassThrough(); c.stderr = new PassThrough(); c.kill = () => {}; setImmediate(() => { c.stderr.write('boom\n'); c.emit('exit', 1); }); return c; };
  await assert.rejects(copyFilesToClipboard(['x'], { spawnImpl: failing }), /boom/);
});
test('network-share paths are never added and are dropped if found saved', () => {
  const store = memoryStore();
  const service = createShelfService({ store, statImpl: () => {} });
  const shelf = service.list()[0].id;
  assert.strictEqual(service.add(shelf, ['\\\\evil-host\\share\\x.txt', '//evil-host/share/y.txt', '\\\\?\\C:\\x.txt']), 0);
  // pretend something wrote a bad entry straight into the saved data
  store.set('shelves', [{ id: shelf, name: 'S', files: [{ id: 'f1', path: '\\\\evil-host\\share\\z.exe', name: 'z.exe' }, { id: 'f2', path: 'C:\\ok.txt', name: 'ok.txt' }] }, { nope: true }]);
  const listed = service.list();
  assert.strictEqual(listed.length, 1);
  assert.deepStrictEqual(listed[0].files.map((f) => f.name), ['ok.txt']);
});
test('programs and scripts are listed but never opened', () => {
  const service = createShelfService({ store: memoryStore(), statImpl: () => {} });
  const shelf = service.list()[0].id;
  service.add(shelf, ['C:\\tools\\setup.EXE', 'C:\\tools\\run.ps1', 'C:\\tools\\notes.txt', 'C:\\tools\\shortcut.lnk']);
  const files = service.list()[0].files;
  assert.strictEqual(files.length, 4);
  for (const f of files) {
    if (/notes/.test(f.name)) assert.ok(service.openablePath(shelf, f.id).endsWith('notes.txt'));
    else assert.throws(() => service.openablePath(shelf, f.id), /programs cannot be opened/);
    assert.ok(service.pathOf(shelf, f.id)); // "show in folder" still works
  }
});
