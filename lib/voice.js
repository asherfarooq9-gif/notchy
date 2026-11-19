// Starts scripts/voice-host.ps1 (one long-running speech process) and talks to it line by line.
// Events arrive as objects like {e:'wake', text, confidence}, {e:'heard', text}, {e:'completed'}, {e:'spoken'}.
const path = require('path');
const { spawnPsLines } = require('./ps');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'voice-host.ps1');

function startVoice({ wakePhrases, fixedCommands, openTargets, minWake, minCommand, onEvent }) {
  const watcher = spawnPsLines(SCRIPT, [
    '-WakePhrases', wakePhrases.join('|'),
    '-FixedCommands', fixedCommands.join('|'),
    '-OpenTargets', openTargets.join('|'),
    '-MinWake', String(minWake),
    '-MinCommand', String(minCommand),
  ], {
    onLine: onEvent,
    onBadLine: (line) => onEvent({ e: 'error', message: 'Unreadable voice message: ' + line.slice(0, 60) }),
    onExit: (code, message) => onEvent({ e: 'exit', code, message }),
  });
  return {
    setMode: (mode) => watcher.send('mode ' + mode),
    say: (text) => watcher.send('say ' + text),
    silence: () => watcher.send('silence'),
    setMinWake: (value) => watcher.send('minwake ' + value),
    stop: () => {
      watcher.send('quit');
      watcher.kill();
    },
  };
}

module.exports = { startVoice };
