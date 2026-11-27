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

test('after an install or update, the app is started from its program file, never through the Start menu shortcut', () => {
  const start = script.indexOf('!macro customInstall');
  assert.ok(start !== -1, 'there is a customInstall step');
  const block = script.slice(start, script.indexOf('!macroend', start));
  const slash = String.fromCharCode(92); // a backslash, written this way so the line cannot be mangled
  assert.ok(block.includes('StrCpy $launchLink "$INSTDIR' + slash + '${APP_EXECUTABLE_FILENAME}"'), 'the launch target is the program file');
});
