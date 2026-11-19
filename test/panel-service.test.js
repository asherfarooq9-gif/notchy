const test = require('node:test');
const assert = require('node:assert');

// panel-service.js needs Electron at load time; give the test a stand-in so only its plain functions run.
require('node:module')._load = ((load) => (request, ...rest) => (request === 'electron' ? { clipboard: {}, nativeImage: {}, ipcMain: {}, shell: {}, BrowserWindow: class {}, screen: {} } : load(request, ...rest)))(require('node:module')._load);
const { timerLabel, alertMessage, assertWebUrl } = require('../lib/panel-service');

test('the notch shows a short label for each kind of timer', () => {
  assert.strictEqual(timerLabel({ kind: 'pomodoro', phase: 'focus', text: '24:10' }), 'Focus 24:10');
  assert.strictEqual(timerLabel({ kind: 'pomodoro', phase: 'break', text: '04:00' }), 'Break 04:00');
  assert.strictEqual(timerLabel({ kind: 'countdown', phase: 'countdown', text: '09:59' }), 'Timer 09:59');
  assert.strictEqual(timerLabel({ kind: 'stopwatch', phase: 'stopwatch', text: '00:12' }), 'Stopwatch 00:12');
});
test('each timer event has its own message', () => {
  assert.match(alertMessage({ type: 'water' }), /water/);
  assert.match(alertMessage({ type: 'finished' }), /finished/);
  assert.match(alertMessage({ type: 'phase', from: 'focus', to: 'break' }), /short break/);
  assert.match(alertMessage({ type: 'phase', from: 'focus', to: 'long-break' }), /long break/);
  assert.match(alertMessage({ type: 'phase', from: 'break', to: 'focus' }), /focus/);
});
test('only web links can be opened from the panel', () => {
  assert.strictEqual(assertWebUrl('https://example.com/a'), 'https://example.com/a');
  assert.throws(() => assertWebUrl('file:///C:/Windows/System32/cmd.exe'), /Only web links/);
  assert.throws(() => assertWebUrl('javascript:alert(1)'), /Only web links/);
  assert.throws(() => assertWebUrl('not a url'));
});
