const test = require('node:test');
const assert = require('node:assert');
const { checkRoutines, findRoutine, runRoutine, normalizeName } = require('../lib/routines');
const { parseCommand } = require('../lib/commands');

test('"run <name>" is a routine command, and a bare "run" is not', () => {
  assert.deepStrictEqual(parseCommand('Run good morning!'), { type: 'routine', name: 'good morning', label: 'run good morning' });
  assert.strictEqual(parseCommand('run').type, 'unknown');
});
test('a good routine is kept with a clean name and trimmed steps', () => {
  const { routines, errors } = checkRoutines([{ name: '  Good   Morning! ', steps: [' what is the date ', 'open chrome', 'battery'] }]);
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(routines, [{ name: 'good morning', steps: ['what is the date', 'open chrome', 'battery'] }]);
  assert.strictEqual(normalizeName('A'.repeat(99)).length, 30);
});
test('steps that could do harm are refused, each with a plain reason', () => {
  const bad = ['shut down', 'restart', 'sleep', 'type hello', 'task delete everything', 'lock the screen', 'wifi off', 'yes', 'run morning', 'make me a sandwich', '', 'open nothing'];
  for (const step of bad) {
    const { routines, errors } = checkRoutines([{ name: 'x', steps: ['battery', step] }]);
    assert.strictEqual(routines.length, 0, step);
    assert.strictEqual(errors.length, 1, step);
    assert.match(errors[0], /^Routine "x"/, step);
  }
});
test('routines have limits: names, counts, duplicates and junk input', () => {
  const step = ['battery'];
  assert.strictEqual(checkRoutines([{ name: '', steps: step }]).errors.length, 1);
  assert.strictEqual(checkRoutines([{ name: 'a', steps: [] }]).errors.length, 1);
  assert.strictEqual(checkRoutines([{ name: 'a', steps: Array(11).fill('battery') }]).errors.length, 1);
  assert.strictEqual(checkRoutines([{ name: 'a', steps: ['x'.repeat(81)] }]).errors.length, 1);
  assert.strictEqual(checkRoutines([{ name: 'a', steps: step }, { name: 'A', steps: step }]).routines.length, 1, 'same name twice');
  assert.strictEqual(checkRoutines(Array.from({ length: 9 }, (_, i) => ({ name: 'n' + i, steps: step }))).routines.length, 8, 'at most 8');
  for (const junk of [null, undefined, 5, 'x', {}, [null, 5, 'x']]) assert.doesNotThrow(() => checkRoutines(junk), String(junk));
  assert.deepStrictEqual(checkRoutines(undefined), { routines: [], errors: [] });
});
test('a routine is found by its spoken name, ignoring case and punctuation', () => {
  const list = [{ name: 'good morning', steps: ['battery'] }];
  assert.strictEqual(findRoutine(list, 'Good morning.'), list[0]);
  assert.strictEqual(findRoutine(list, 'good night'), null);
});
test('steps run one after another and stop at the first problem', async () => {
  const seen = [];
  const ok = await runRoutine(['battery', 'open chrome'], async (cmd) => { seen.push(cmd.type); return 'fine'; });
  assert.deepStrictEqual([ok.done, ok.failed], [2, null]);
  assert.deepStrictEqual(seen, ['pc', 'app']);
  const stop = await runRoutine(['battery', 'open chrome', 'volume up'], async (cmd) => { if (cmd.type === 'app') throw new Error('Chrome missing'); return 'ok'; });
  assert.deepStrictEqual([stop.done, stop.failed], [1, 'Chrome missing']);
});
test('the runner checks again before running, so a changed step can never slip through', async () => {
  const calls = [];
  const result = await runRoutine(['battery', 'shut down'], async (cmd) => { calls.push(cmd.type); return 'x'; });
  assert.deepStrictEqual(calls, ['pc']);
  assert.strictEqual(result.done, 1);
  assert.match(result.failed, /not allowed|asks yes or no/);
});

test('a routine can have a name in any language, and "run <name>" finds it', () => {
  const { routines, errors } = checkRoutines([{ name: 'صبح بخیر', steps: ['open chrome'] }, { name: '日本語 ルーティン', steps: ['battery'] }]);
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(routines.map((r) => r.name), ['صبح بخیر', '日本語 ルーティン']);
  assert.deepStrictEqual(parseCommand('run صبح بخیر!'), { type: 'routine', name: 'صبح بخیر', label: 'run صبح بخیر' });
  assert.strictEqual(findRoutine(routines, 'صبح بخیر').steps[0], 'open chrome');
  assert.strictEqual(findRoutine(routines, '日本語 ルーティン').steps[0], 'battery');
  assert.strictEqual(normalizeName('Café Étude'), 'café étude');
});
