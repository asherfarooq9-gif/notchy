const test = require('node:test');
const assert = require('node:assert');
const { parseCommand, NEEDS_PC_CONTROL } = require('../lib/commands');

test('"task ..." becomes an assistant task with the words after it', () => {
  assert.deepStrictEqual(parseCommand('Task sort my downloads into folders.'), { type: 'assistant', text: 'sort my downloads into folders', label: 'task' });
  assert.strictEqual(parseCommand('task').type, 'unknown', 'a bare "task" is not a task');
  assert.notStrictEqual(parseCommand('open task manager').type, 'assistant');
});
test('a task is never a direct action: it only plans, and has its own switch', () => {
  assert.ok(!NEEDS_PC_CONTROL.has('assistant'));
  assert.strictEqual(parseCommand('task delete everything').confirm, undefined);
});
