const test = require('node:test');
const assert = require('node:assert');
const { parseCommand } = require('../lib/commands');

test('"open panel" and "show the panel" open the panel of tools', () => {
  assert.strictEqual(parseCommand('open the panel').type, 'panel');
  assert.strictEqual(parseCommand('Show panel.').type, 'panel');
});
test('every fixed phrase is a command that runs', () => {
  const phrases = ['volume up', 'volume down', 'louder', 'quieter', 'mute', 'unmute', 'pause', 'play', 'resume', 'next', 'skip', 'previous', 'lock the screen', 'show panel', 'focus mode on', 'focus mode off', 'brightness up', 'brightness down', 'wifi on', 'wifi off', 'bluetooth on', 'bluetooth off', 'take a screenshot', 'snap left', 'snap right', 'maximize', 'minimize', 'show desktop', 'switch window', 'battery', 'sleep', 'restart the computer', 'shut down', 'cancel shutdown', 'yes', 'no', 'what time is it', 'what is the date', 'hello', 'thanks', 'who are you'];
  for (const phrase of phrases) assert.notStrictEqual(parseCommand(phrase).type, 'unknown', phrase);
  for (const target of ['chrome', 'notepad', 'whatsapp', 'youtube', 'downloads', 'documents', 'panel']) assert.notStrictEqual(parseCommand('open ' + target).type, 'unknown', target);
});

test('open known app', () => {
  assert.deepStrictEqual(parseCommand('Open Chrome.'), { type: 'app', target: 'chrome', label: 'chrome' });
});
test('open known site', () => {
  assert.strictEqual(parseCommand('open WhatsApp').type, 'url');
});
test('unknown app is refused, not run', () => {
  assert.strictEqual(parseCommand('open powershell & del').type, 'unknown');
});
test('search encodes the query', () => {
  assert.strictEqual(parseCommand('search cute penguins').url, 'https://www.google.com/search?q=cute%20penguins');
});
test('volume, media and lock', () => {
  assert.strictEqual(parseCommand('volume up').key, 'volup');
  assert.strictEqual(parseCommand('pause').key, 'playpause');
  assert.strictEqual(parseCommand('music next').key, 'next');
  assert.strictEqual(parseCommand('lock the screen').type, 'lock');
});
test('empty speech gives null', () => {
  assert.strictEqual(parseCommand('   '), null);
});
test('time and date are answered out loud', () => {
  const now = new Date(2026, 10, 14, 15, 5);
  assert.strictEqual(parseCommand('What time is it?', now).speech.replace(/\s/g, ' '), 'It is 3:05 PM');
  assert.strictEqual(parseCommand('what is the date', now).speech, 'Today is Saturday, November 14');
});
test('small talk gets a spoken reply', () => {
  assert.strictEqual(parseCommand('thank you').type, 'say');
  assert.strictEqual(parseCommand('who are you').speech, 'I am Batman. Your notch.');
});

test('focus mode commands turn it on and off', () => {
  const on = ['focus mode on', 'turn on focus mode', 'start focus mode', 'Focus mode on.'];
  const off = ['focus mode off', 'turn off focus mode', 'stop focus mode', 'end focus mode'];
  for (const phrase of on) assert.deepStrictEqual(parseCommand(phrase), { type: 'focus', on: true, label: 'focus mode on' }, phrase);
  for (const phrase of off) assert.deepStrictEqual(parseCommand(phrase), { type: 'focus', on: false, label: 'focus mode off' }, phrase);
  assert.strictEqual(parseCommand('focus').type, 'unknown');
  assert.strictEqual(parseCommand('open focus mode').type, 'unknown');
});

test('search keeps capital letters, symbols and non-English words in the query', () => {
  assert.strictEqual(parseCommand('search C++ tutorial').url, 'https://www.google.com/search?q=C%2B%2B%20tutorial');
  assert.strictEqual(parseCommand('google node.js v20').url, 'https://www.google.com/search?q=node.js%20v20');
  assert.strictEqual(parseCommand('search کراچی کا موسم').url, 'https://www.google.com/search?q=' + encodeURIComponent('کراچی کا موسم'));
});

test('a task keeps the exact file names and capital letters', () => {
  assert.strictEqual(parseCommand('task rename Report.docx to Final.docx').text, 'rename Report.docx to Final.docx');
  assert.strictEqual(parseCommand('Task: sort my downloads').text, 'sort my downloads');
  assert.notStrictEqual(parseCommand('tasks to do').type, 'assistant', 'a word that only starts with "task" is not a task command');
});

test('words with no English letters are an unknown command, so they can still be asked to Claude', () => {
  assert.strictEqual(parseCommand('کراچی کا موسم کیسا ہے؟').type, 'unknown');
  assert.strictEqual(parseCommand('你好').type, 'unknown');
  assert.strictEqual(parseCommand('😀').type, 'unknown');
  assert.strictEqual(parseCommand('   '), null, 'blank input is still nothing');
});
