const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createClaudeLink, withNotchHooks, withoutNotchHooks, hasNotchHooks, EVENTS } = require('../lib/claude-link');

const COMMAND = 'node "C:/Users/x/AppData/Roaming/windows-notch/notch-hook.js"';
const mine = (entry) => JSON.stringify(entry).includes('notch-hook.js');

test('connecting adds one entry per event and keeps everything else', () => {
  const before = {
    model: 'opus',
    hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }], PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'check.sh' }] }] },
  };
  const after = withNotchHooks(before, COMMAND);
  assert.strictEqual(after.model, 'opus');
  for (const event of EVENTS) assert.ok(after.hooks[event].some(mine), event);
  assert.ok(after.hooks.Stop.some((e) => JSON.stringify(e).includes('echo done')), 'your own Stop hook is still there');
  assert.ok(after.hooks.PreToolUse.some((e) => JSON.stringify(e).includes('check.sh')));
  assert.deepStrictEqual(Object.keys(before.hooks).sort(), ['PreToolUse', 'Stop'], 'the input is never changed');
  assert.strictEqual(before.hooks.Stop.length, 1);
});
test('connecting twice does not double the entries', () => {
  const once = withNotchHooks({}, COMMAND);
  const twice = withNotchHooks(once, COMMAND);
  for (const event of EVENTS) assert.strictEqual(twice.hooks[event].filter(mine).length, 1, event);
});
test('disconnecting removes only the notch entries and cleans up what it emptied', () => {
  const user = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }] } };
  const gone = withoutNotchHooks(withNotchHooks(user, COMMAND));
  assert.deepStrictEqual(gone, user);
  const empty = withoutNotchHooks(withNotchHooks({ theme: 'dark' }, COMMAND));
  assert.deepStrictEqual(empty, { theme: 'dark' }, 'no empty hooks object is left behind');
  assert.deepStrictEqual(withoutNotchHooks({}), {});
});
test('connected means every event has the entry', () => {
  assert.strictEqual(hasNotchHooks({}), false);
  assert.strictEqual(hasNotchHooks(withNotchHooks({}, COMMAND)), true);
  const partial = withNotchHooks({}, COMMAND);
  delete partial.hooks.Stop;
  assert.strictEqual(hasNotchHooks(partial), false);
});
test('odd shapes in the file are survived, not crashed on', () => {
  for (const odd of [{ hooks: null }, { hooks: [] }, { hooks: { Stop: 'x' } }, { hooks: { Stop: [null, 5] } }]) {
    const out = withNotchHooks(odd, COMMAND);
    for (const event of EVENTS) assert.ok(out.hooks[event].some(mine), event);
    assert.doesNotThrow(() => withoutNotchHooks(odd));
  }
});

// ---- the real file operations, in a throw-away home folder ----
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-claude-'));
test.after(() => fs.rmSync(base, { recursive: true, force: true }));
let n = 0;
function setup({ settings, installed = true, hasNode = true } = {}) {
  const home = path.join(base, 'h' + ++n);
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  const file = path.join(home, '.claude', 'settings.json');
  if (settings !== undefined) fs.writeFileSync(file, typeof settings === 'string' ? settings : JSON.stringify(settings, null, 2));
  const hookSource = path.join(home, 'source-hook.js');
  fs.writeFileSync(hookSource, '// the hook\n');
  const hookDest = path.join(home, 'data', 'notch-hook.js');
  const link = createClaudeLink({ home, hookSource, hookDest, exists: async (name) => (name === 'node' ? hasNode : installed) });
  return { link, file, hookDest, home };
}

test('connect writes the hook script, backs up the file once and adds the entries', async () => {
  const original = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }] } };
  const { link, file, hookDest } = setup({ settings: original });
  const status = await link.connect();
  assert.strictEqual(status.connected, true);
  assert.ok(fs.existsSync(hookDest) && fs.readFileSync(hookDest, 'utf8').includes('the hook'));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file + '.notch-backup', 'utf8')), original, 'the backup is the file as it was');
  const written = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(written.model, 'opus');
  assert.ok(JSON.stringify(written).includes('echo done'));
  assert.ok(written.hooks.Stop.some(mine));
  assert.ok(!written.hooks.Stop.find(mine).hooks[0].command.includes('\\'), 'the path uses forward slashes, which every shell understands');
  await link.connect();
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file + '.notch-backup', 'utf8')), original, 'a second connect keeps the first backup');
  assert.strictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).hooks.Stop.filter(mine).length, 1);
});
test('connect works when Claude Code has no settings file yet', async () => {
  const { link, file } = setup();
  assert.strictEqual((await link.connect()).connected, true);
  assert.ok(hasNotchHooks(JSON.parse(fs.readFileSync(file, 'utf8'))));
});
test('a settings file that is not valid JSON is never touched', async () => {
  const text = '{ "hooks": { oops';
  const { link, file } = setup({ settings: text });
  await assert.rejects(() => link.connect(), /not valid JSON/);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), text);
  assert.ok(!fs.existsSync(file + '.notch-backup'));
});
test('connect refuses plainly when Claude Code or Node.js is missing', async () => {
  await assert.rejects(() => setup({ installed: false }).link.connect(), /Claude Code/);
  await assert.rejects(() => setup({ hasNode: false }).link.connect(), /Node\.js/);
});
test('disconnect puts back what was there and keeps your other hooks', async () => {
  const original = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }] } };
  const { link, file } = setup({ settings: original });
  await link.connect();
  const status = await link.disconnect();
  assert.strictEqual(status.connected, false);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), original);
});
test('status says what is installed and connected, and never throws on a damaged file', async () => {
  const fresh = setup({ settings: {} });
  assert.deepStrictEqual({ ...(await fresh.link.status()), problem: undefined }, { installed: true, hasNode: true, connected: false, problem: undefined });
  await fresh.link.connect();
  assert.strictEqual((await fresh.link.status()).connected, true);
  const broken = setup({ settings: 'not json' });
  const status = await broken.link.status();
  assert.strictEqual(status.connected, false);
  assert.match(status.problem, /not valid JSON/);
  assert.strictEqual((await setup({ installed: false }).link.status()).installed, false);
});
