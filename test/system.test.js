const test = require('node:test');
const assert = require('node:assert');
const { cpuPercent, parseWifi } = require('../lib/system');

const core = (user, sys, idle) => ({ user, nice: 0, sys, idle, irq: 0 });

test('cpu percent is the busy share between two snapshots', () => {
  const before = [core(100, 50, 850), core(0, 0, 1000)];
  const after = [core(200, 100, 900), core(0, 0, 1100)]; // core 1: 150 busy of 200; core 2: 0 of 100
  assert.strictEqual(cpuPercent(before, after), 50);
});
test('a stalled clock gives 0 instead of dividing by zero', () => {
  const same = [core(5, 5, 5)];
  assert.strictEqual(cpuPercent(same, same), 0);
});
test('wifi name and signal are read from netsh output', () => {
  const text = '    Name                   : Wi-Fi\n    SSID                   : Home Network\n    BSSID                  : aa:bb:cc\n    Signal                 : 87%\n';
  assert.deepStrictEqual(parseWifi(text), { ssid: 'Home Network', signal: 87 });
});
test('no wifi connection gives null', () => {
  assert.strictEqual(parseWifi('There is 1 interface on the system:\n    State : disconnected\n'), null);
});
