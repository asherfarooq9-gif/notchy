const test = require('node:test');
const assert = require('node:assert');
const { buildArgs, cleanForSpeech, parseResultLine, friendlyError } = require('../lib/claude');

test('claude is started with every tool switched off and no personal settings', () => {
  const args = buildArgs('haiku');
  assert.strictEqual(args[args.indexOf('--tools') + 1], '', 'tools must be an empty list');
  assert.strictEqual(args[args.indexOf('--setting-sources') + 1], 'project');
  assert.ok(args.includes('--strict-mcp-config'));
  assert.ok(args.includes('--no-session-persistence'));
});
test('markdown is stripped so the answer can be spoken', () => {
  assert.strictEqual(cleanForSpeech('**Paris** is the capital.\n\n- Eiffel Tower\n- `Louvre`'), 'Paris is the capital. Eiffel Tower Louvre');
});
test('long answers are cut to a speakable length', () => {
  assert.ok(cleanForSpeech('word '.repeat(500)).length <= 600);
});
test('only the final result line is picked up', () => {
  assert.deepStrictEqual(parseResultLine('{"type":"result","result":"Paris.","is_error":false}'), { text: 'Paris.', isError: false });
  assert.strictEqual(parseResultLine('{"type":"assistant","message":{}}'), null);
  assert.strictEqual(parseResultLine('not json'), null);
});
test('a sign-in problem gets a plain-language message', () => {
  assert.match(friendlyError('Invalid API key · Please run /login'), /not signed in/);
});
