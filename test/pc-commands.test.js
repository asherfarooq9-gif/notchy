const test = require('node:test');
const assert = require('node:assert');
const { parseCommand, NEEDS_PC_CONTROL } = require('../lib/commands');

const pc = (text) => parseCommand(text);

test('brightness commands', () => {
  for (const phrase of ['brightness up', 'Brighter.']) assert.deepStrictEqual([pc(phrase).type, pc(phrase).action], ['pc', 'brightnessup'], phrase);
  for (const phrase of ['brightness down', 'dimmer', 'dim the screen']) assert.deepStrictEqual([pc(phrase).type, pc(phrase).action], ['pc', 'brightnessdown'], phrase);
});
test('wifi and bluetooth: on needs no question, wifi off asks first', () => {
  assert.strictEqual(pc('wifi on').action, 'wifion');
  assert.strictEqual(pc('Wi-Fi on.').action, 'wifion');
  assert.strictEqual(pc('wifi on').confirm, undefined);
  const off = pc('turn the wi fi off');
  assert.strictEqual(off.action, 'wifioff');
  assert.match(off.confirm, /internet/i);
  assert.strictEqual(pc('bluetooth off').action, 'bluetoothoff');
  assert.strictEqual(pc('turn bluetooth on').action, 'bluetoothon');
  assert.strictEqual(pc('bluetooth off').confirm, undefined);
});
test('screenshot and window commands', () => {
  for (const phrase of ['screenshot', 'take a screenshot', 'take screenshot']) assert.strictEqual(pc(phrase).action, 'screenshot', phrase);
  assert.strictEqual(pc('snap left').action, 'snapleft');
  assert.strictEqual(pc('snap right').action, 'snapright');
  assert.strictEqual(pc('maximize').action, 'maximize');
  assert.strictEqual(pc('maximise').action, 'maximize');
  assert.strictEqual(pc('minimize').action, 'minimize');
  assert.strictEqual(pc('show desktop').action, 'desktop');
  assert.strictEqual(pc('switch window').action, 'switchwindow');
});
test('battery questions are answered, not sent to Claude', () => {
  for (const phrase of ['battery', 'what is my battery', "What's my battery level?", 'how much battery']) assert.strictEqual(pc(phrase).action, 'battery', phrase);
});
test('folders open from a fixed list only', () => {
  assert.deepStrictEqual(pc('open downloads'), { type: 'folder', target: 'shell:Downloads', label: 'Downloads folder' });
  assert.strictEqual(pc('open the documents folder').target, 'shell:Personal');
  assert.strictEqual(pc('open desktop').target, 'shell:Desktop');
  assert.strictEqual(pc('open my pictures').type, 'unknown', 'only exact names');
  assert.strictEqual(pc('open downloads & del').type, 'unknown');
});
test('sleep, restart and shut down always ask first; shutdown can be cancelled', () => {
  for (const [phrase, action] of [['sleep', 'sleep'], ['go to sleep', 'sleep'], ['put the computer to sleep', 'sleep'], ['restart', 'restart'], ['restart the computer', 'restart'], ['reboot', 'restart'], ['shut down', 'shutdown'], ['shutdown', 'shutdown'], ['shut down the computer', 'shutdown'], ['turn off the computer', 'shutdown']]) {
    const cmd = pc(phrase);
    assert.deepStrictEqual([cmd.type, cmd.action], ['power', action], phrase);
    assert.ok(cmd.confirm && cmd.confirm.length > 10, `${phrase} must ask`);
  }
  for (const phrase of ['cancel shutdown', 'cancel restart', 'abort shutdown']) {
    const cmd = pc(phrase);
    assert.deepStrictEqual([cmd.type, cmd.action, cmd.confirm], ['power', 'abort', undefined], phrase);
  }
});
test('typing keeps the words as spoken (capitals and punctuation) and is limited and cleaned', () => {
  assert.deepStrictEqual(pc('Type Hello, world.'), { type: 'typing', text: 'Hello, world.', label: 'typing' });
  assert.strictEqual(pc('type   ').type, 'unknown', 'nothing to type');
  assert.strictEqual(pc('type a\nb\tc').text, 'a b c', 'line breaks never press Enter');
  assert.strictEqual(pc('type ' + 'x'.repeat(500)).text.length, 300);
});
test('yes and no are understood as answers', () => {
  for (const phrase of ['yes', 'Yeah', 'yep', 'confirm', 'do it', 'go ahead', 'sure']) assert.deepStrictEqual([pc(phrase).type, pc(phrase).answer], ['reply', 'yes'], phrase);
  for (const phrase of ['no', 'nope', 'cancel', 'never mind', 'stop']) assert.deepStrictEqual([pc(phrase).type, pc(phrase).answer], ['reply', 'no'], phrase);
});
test('which commands the system-control switch covers', () => {
  for (const phrase of ['brightness up', 'wifi off', 'screenshot', 'snap left', 'sleep', 'type hi', 'battery']) assert.ok(NEEDS_PC_CONTROL.has(pc(phrase).type), phrase);
  for (const phrase of ['volume up', 'open chrome', 'lock the screen', 'what time is it']) assert.ok(!NEEDS_PC_CONTROL.has(pc(phrase).type), phrase);
});
test('unsafe text does not parse as a command', () => {
  for (const phrase of ['delete everything', 'format the disk', 'wifi off & shutdown /s', 'restart now please']) assert.strictEqual(pc(phrase).type, 'unknown', phrase);
  for (const phrase of ['shut down', 'wifi off', 'sleep']) assert.notStrictEqual(pc(phrase).type, 'unknown', phrase);
});
