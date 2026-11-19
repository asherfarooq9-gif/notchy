// "Connect to Claude Code": adds small hook entries to Claude Code's settings file, so the notch can show what Claude is doing.
// Safe by design: your other settings and hooks are kept, a backup of the original file is saved once, a file that is not valid
// JSON is never touched, and Disconnect removes only the notch's own entries (the ones that mention notch-hook.js).
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const MARK = 'notch-hook.js';
const BACKUP_SUFFIX = '.notch-backup';
const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUseFailure']); // these take a "matcher": which tools
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUseFailure', 'Notification', 'Stop'];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isMine = (entry) => JSON.stringify(entry).includes(MARK);

const entryFor = (event, command) => ({ ...(TOOL_EVENTS.has(event) ? { matcher: '*' } : {}), hooks: [{ type: 'command', command }] });

// A new settings object with the notch's entry on every event. Anything of yours stays; the input is not changed.
function withNotchHooks(settings, command) {
  const hooks = isObject(settings.hooks) ? { ...settings.hooks } : {};
  for (const event of EVENTS) {
    const others = Array.isArray(hooks[event]) ? hooks[event].filter((entry) => !isMine(entry)) : [];
    hooks[event] = [...others, entryFor(event, command)];
  }
  return { ...settings, hooks };
}

// A new settings object without the notch's entries. Events and the hooks object are removed only if removing ours emptied them.
function withoutNotchHooks(settings) {
  if (!isObject(settings.hooks)) return { ...settings };
  const hooks = { ...settings.hooks };
  let removedAny = false;
  for (const [event, list] of Object.entries(hooks)) {
    if (!Array.isArray(list) || !list.some(isMine)) continue;
    removedAny = true;
    const kept = list.filter((entry) => !isMine(entry));
    if (kept.length) hooks[event] = kept; else delete hooks[event];
  }
  const { hooks: _old, ...rest } = settings;
  return removedAny && Object.keys(hooks).length === 0 ? rest : { ...rest, hooks };
}

const hasNotchHooks = (settings) => isObject(settings.hooks) && EVENTS.every((event) => Array.isArray(settings.hooks[event]) && settings.hooks[event].some(isMine));

function createClaudeLink({ home, hookSource, hookDest, fsImpl = fs, exists }) {
  const file = path.join(home, '.claude', 'settings.json');
  const backup = file + BACKUP_SUFFIX;

  // Is this program on the PC? ("claude" is also looked for in the folder Claude Code installs itself to.)
  const found = exists || ((name) => new Promise((resolve) => {
    if (name === 'claude' && fsImpl.existsSync(path.join(home, '.local', 'bin', 'claude.exe'))) { resolve(true); return; }
    execFile('where', [name], { windowsHide: true, timeout: 5000 }, (error) => resolve(!error));
  }));

  function readSettings() {
    let text;
    try { text = fsImpl.readFileSync(file, 'utf8'); } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw new Error('Claude Code\'s settings file could not be read, so nothing was changed.');
    }
    try {
      const parsed = JSON.parse(text.replace(/^﻿/, ''));
      if (isObject(parsed)) return parsed;
    } catch { /* falls through to the message below */ }
    throw new Error('Claude Code\'s settings file is not valid JSON, so nothing was changed.');
  }

  function writeSettings(settings) {
    fsImpl.mkdirSync(path.dirname(file), { recursive: true });
    const temp = file + '.notch-tmp';
    fsImpl.writeFileSync(temp, JSON.stringify(settings, null, 2) + '\n');
    fsImpl.renameSync(temp, file); // the file is replaced in one step, never half written
  }

  async function status() {
    const result = { installed: await found('claude'), hasNode: await found('node'), connected: false };
    try { result.connected = hasNotchHooks(readSettings()); } catch (error) { result.problem = error.message; }
    return result;
  }

  return {
    status,
    async connect() {
      if (!(await found('claude'))) throw new Error('Claude Code was not found on this PC.');
      if (!(await found('node'))) throw new Error('Node.js was not found. The notch hook needs it. Install Node.js, then try again.');
      const settings = readSettings(); // checked before anything is written
      fsImpl.mkdirSync(path.dirname(hookDest), { recursive: true });
      fsImpl.copyFileSync(hookSource, hookDest);
      if (fsImpl.existsSync(file) && !fsImpl.existsSync(backup)) fsImpl.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
      writeSettings(withNotchHooks(settings, `node "${hookDest.replace(/\\/g, '/')}"`)); // forward slashes work in every shell
      return status();
    },
    async disconnect() {
      writeSettings(withoutNotchHooks(readSettings()));
      return status();
    },
  };
}

module.exports = { createClaudeLink, withNotchHooks, withoutNotchHooks, hasNotchHooks, EVENTS };
