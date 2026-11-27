const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { startError, CLAUDE_NOT_FOUND } = require('../lib/claude');
const { runClaudeOnce } = require('../lib/assistant-ask');

const enoent = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });

test('when Claude is not installed, the message says so in plain words', () => {
  assert.strictEqual(startError(enoent).message, CLAUDE_NOT_FOUND);
  assert.ok(CLAUDE_NOT_FOUND.length <= 60, 'it must fit on the notch card without being cut off');
  assert.doesNotMatch(CLAUDE_NOT_FOUND, /ENOENT|spawn/i);
});

test('other start-up problems keep their own reason', () => {
  assert.strictEqual(startError(Object.assign(new Error('access denied'), { code: 'EACCES' })).message, 'Could not start Claude: access denied');
  assert.strictEqual(startError(undefined).message, 'Could not start Claude: unknown problem');
});

test('a file task says the same thing when Claude is missing', async () => {
  const fakeSpawn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = Object.assign(new EventEmitter(), { end() {} });
    setImmediate(() => child.emit('error', enoent));
    return child;
  };
  await assert.rejects(() => runClaudeOnce('hello', { findClaude: () => 'claude', spawnImpl: fakeSpawn }), { message: CLAUDE_NOT_FOUND });
});
