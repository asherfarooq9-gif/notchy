const test = require('node:test');
const assert = require('node:assert');
const { runPcAction, runPower, describeBattery, ACTIONS, POWER } = require('../lib/pc-control');

// A pretend execFile that records what was run and answers with what the test wants.
const fake = (reply) => {
  const calls = [];
  const execFileImpl = (file, args, options, done) => { calls.push({ file, args, options }); const r = reply(file, args); setImmediate(() => done(r.error || null, r.out || '', r.err || '')); };
  return { calls, execFileImpl };
};

test('an action runs the fixed script with the action name and nothing else', async () => {
  const { calls, execFileImpl } = fake(() => ({ out: 'Brightness 60 percent\r\n' }));
  assert.strictEqual(await runPcAction('brightnessup', '', { execFileImpl }), 'Brightness 60 percent');
  assert.strictEqual(calls[0].file, 'powershell.exe');
  const args = calls[0].args;
  assert.ok(args.includes('-File') && args.includes('-Sta') && args.slice(-2).join(' ') === '-Action brightnessup');
  assert.ok(!args.includes('-Text'), 'no text unless typing');
  assert.ok(calls[0].options.timeout > 0, 'a stuck script is stopped');
});
test('typed words go in as one plain argument, even with shell characters', async () => {
  const nasty = 'hi & del *.* | "quotes" $(whoami) `x`';
  const { calls, execFileImpl } = fake(() => ({ out: 'Typed' }));
  await runPcAction('type', nasty, { execFileImpl });
  const args = calls[0].args;
  assert.strictEqual(args[args.indexOf('-Text') + 1], nasty);
  assert.strictEqual(calls[0].file, 'powershell.exe');
});
test('anything not on the list is refused before anything runs', async () => {
  const { calls, execFileImpl } = fake(() => ({ out: 'x' }));
  for (const bad of ['format', 'brightnessup; del', '', undefined, 'TYPE']) await assert.rejects(runPcAction(bad, '', { execFileImpl }), /not something/, String(bad));
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(ACTIONS.size, 15);
});
test('a problem is reported with its reason, one plain line', async () => {
  const { execFileImpl } = fake(() => ({ error: new Error('exit 1'), err: 'This screen does not support changing the brightness.\r\nat line 5...' }));
  await assert.rejects(runPcAction('brightnessdown', '', { execFileImpl }), /does not support changing the brightness\.$/);
  const silent = fake(() => ({ error: new Error('exit 1') }));
  await assert.rejects(runPcAction('wifioff', '', { execFileImpl: silent.execFileImpl }), /did not work/);
});
test('battery answers in a sentence', async () => {
  assert.strictEqual(describeBattery('64|Online'), 'Battery is 64 percent and charging.');
  assert.strictEqual(describeBattery('18|Offline'), 'Battery is 18 percent.');
  assert.strictEqual(describeBattery('none'), 'This computer has no battery.');
  const { execFileImpl } = fake(() => ({ out: '64|Online' }));
  assert.strictEqual(await runPcAction('battery', '', { execFileImpl }), 'Battery is 64 percent and charging.');
});
test('shut down and restart wait 30 seconds, and can be cancelled', async () => {
  assert.deepStrictEqual(POWER.shutdown.args, ['/s', '/t', '30']);
  assert.deepStrictEqual(POWER.restart.args, ['/r', '/t', '30']);
  assert.deepStrictEqual(POWER.abort.args, ['/a']);
  const { calls, execFileImpl } = fake(() => ({}));
  assert.match(await runPower('shutdown', { execFileImpl }), /30 seconds.*cancel shutdown/i);
  assert.strictEqual(calls[0].file, 'shutdown.exe');
  assert.strictEqual(await runPower('sleep', { execFileImpl }), 'Going to sleep');
  assert.strictEqual(calls[1].file, 'rundll32.exe');
});
test('cancelling when nothing is waiting is a calm message, and unknown power words are refused', async () => {
  const { execFileImpl } = fake(() => ({ error: new Error('1116') }));
  assert.strictEqual(await runPower('abort', { execFileImpl }), 'Nothing was waiting to shut down');
  await assert.rejects(runPower('hibernate-now', { execFileImpl }), /not something/);
  await assert.rejects(runPower('shutdown', { execFileImpl }), /did not allow/);
});
