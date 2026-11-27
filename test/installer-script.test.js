const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '..', 'build', 'installer.nsh'), 'utf8');
const uninstallBlock = script.slice(script.indexOf('!macro customUnInstall'), script.indexOf('!macroend', script.indexOf('!macro customUnInstall')));

test('a real uninstall removes the start-with-Windows entry', () => {
  assert.match(uninstallBlock, /DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "WindowsNotch"/);
});

test('an update keeps the start-with-Windows entry', () => {
  const guard = uninstallBlock.indexOf('${ifNot} ${isUpdated}');
  const remove = uninstallBlock.indexOf('DeleteRegValue');
  const end = uninstallBlock.indexOf('${endIf}');
  assert.ok(guard !== -1 && guard < remove && remove < end, 'the delete must sit inside an ${ifNot} ${isUpdated} block');
});
