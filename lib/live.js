// Starts scripts/live-watch.ps1 and passes on what it sees: volume, full-screen apps, and what is playing.
// Events arrive as objects like {e:'volume', level, muted}, {e:'fullscreen', on}, {e:'media', ...}.
const path = require('path');
const { spawnPsLines } = require('./ps');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'live-watch.ps1');
const MEDIA_COMMANDS = new Set(['playpause', 'next', 'prev']);

function startLive({ onEvent }) {
  const watcher = spawnPsLines(SCRIPT, [], {
    onLine: onEvent,
    onBadLine: () => onEvent({ e: 'error', message: 'Unreadable message from the desktop watcher' }),
    onExit: (code, message) => { if (code) onEvent({ e: 'error', message: message || 'The desktop watcher stopped' }); },
  });
  return {
    // command: playpause | next | prev
    media(command) {
      if (!MEDIA_COMMANDS.has(command)) throw new Error('Unknown media command: ' + command);
      watcher.send('media ' + command);
    },
    // Whether to report the front program (for Screen Time). Off by default in the watcher.
    activity(isOn) {
      watcher.send(isOn ? 'activity on' : 'activity off');
    },
    stop() {
      watcher.send('quit');
      watcher.kill();
    },
  };
}

module.exports = { startLive };
