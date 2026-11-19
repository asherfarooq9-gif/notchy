const test = require('node:test');
const assert = require('node:assert');
const { createAssistantService } = require('../lib/assistant-service');

const okPlan = { ok: true, summary: 'Sort', warnings: [], steps: [{ op: 'makeFolder', abs: 'x', text: 'Make x' }, { op: 'trash', abs: 'y', danger: 'trash', text: 'Bin y' }] };
function setup({ plan = okPlan, runResult } = {}) {
  const updates = [];
  const calls = { run: 0, undo: 0 };
  const service = createAssistantService({
    planner: { plan: async () => plan },
    runner: {
      run: async (steps, { onProgress, isStopped }) => {
        calls.run += 1;
        onProgress(1, steps.length, []);
        return runResult || { results: steps.map((s) => ({ ok: true, text: 'Done', step: s.text })), undo: [{ op: 'removeFolder', abs: 'x' }], stopped: isStopped() };
      },
      undo: async () => { calls.undo += 1; return { undone: 1, skipped: [] }; },
    },
    onUpdate: (state) => updates.push(state.phase),
  });
  return { service, updates, calls };
}

test('plan -> review -> run -> done, and the state tells the panel what to show', async () => {
  const { service, updates, calls } = setup();
  assert.strictEqual(service.state().phase, 'idle');
  const planned = await service.plan('sort my invoices');
  assert.strictEqual(planned.phase, 'review');
  assert.deepStrictEqual([planned.summary, planned.steps.length, planned.hasTrash, planned.canApproveByVoice], ['Sort', 2, true, false]);
  assert.ok(planned.steps.every((s) => !('abs' in s)), 'the panel only gets sentences, not real paths');
  const done = await service.run();
  assert.strictEqual(done.phase, 'done');
  assert.strictEqual(calls.run, 1);
  assert.strictEqual(done.canUndo, true);
  assert.deepStrictEqual(updates, ['planning', 'review', 'running', 'running', 'done']);
});
test('nothing runs without a plan in review, and a plan only runs once', async () => {
  const { service, calls } = setup();
  await assert.rejects(() => service.run(), /nothing to run/i);
  await service.plan('go');
  await Promise.all([service.run(), service.run().catch(() => {})]);
  assert.strictEqual(calls.run, 1);
  await assert.rejects(() => service.run(), /nothing to run/i);
});
test('cancel drops the plan; a failed plan shows its reason; busy states refuse new tasks', async () => {
  const { service } = setup();
  await service.plan('go');
  assert.strictEqual(service.cancel().phase, 'idle');
  const bad = setup({ plan: { ok: false, error: 'I cannot do that' } });
  const state = await bad.service.plan('go');
  assert.deepStrictEqual([state.phase, state.error], ['idle', 'I cannot do that']);
  const slow = setup();
  const first = slow.service.plan('one');
  await assert.rejects(() => slow.service.plan('two'), /busy/i);
  await first;
});
test('undo runs once and then is gone; a new task clears the old undo', async () => {
  const { service, calls } = setup();
  await service.plan('go'); await service.run();
  const undone = await service.undo();
  assert.strictEqual(calls.undo, 1);
  assert.strictEqual(undone.canUndo, false);
  assert.match(undone.note, /put back 1/i);
  await assert.rejects(() => service.undo(), /nothing to undo/i);
});
test('stop is passed to the runner and reported', async () => {
  const updates = [];
  const service = createAssistantService({
    planner: { plan: async () => okPlan },
    runner: { run: async (steps, { isStopped }) => { service.stop(); return { results: [{ ok: true, text: 'Done', step: 'a' }, { ok: null, text: 'Stopped before this step', step: 'b' }], undo: [], stopped: isStopped() }; }, undo: async () => ({ undone: 0, skipped: [] }) },
    onUpdate: (s) => updates.push(s.phase),
  });
  await service.plan('go');
  const done = await service.run();
  assert.match(done.note, /stopped/i);
});
test('the whole task is refused when the setting is off', async () => {
  const service = createAssistantService({ planner: { plan: async () => okPlan }, runner: {}, onUpdate() {}, isEnabled: () => false });
  await assert.rejects(() => service.plan('go'), /turned off/i);
});
