// Runs the computer-control commands. Everything here is a fixed action: the only words that ever reach a program
// are the ones typed with "type ...", and those go in as plain data, never into a shell.
const { execFile } = require('child_process');
const path = require('path');
const { runPs } = require('./ps');
const { POWER_DELAY_SECONDS } = require('./commands');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'pc.ps1');
const TIMEOUT_MS = 20000;
const ACTIONS = new Set(['brightnessup', 'brightnessdown', 'wifion', 'wifioff', 'bluetoothon', 'bluetoothoff', 'screenshot', 'snapleft', 'snapright', 'maximize', 'minimize', 'desktop', 'switchwindow', 'battery', 'type']);

function describeBattery(output) {
  if (output === 'none') return 'This computer has no battery.';
  const [percent, line] = output.split('|');
  return `Battery is ${percent} percent${line === 'Online' ? ' and charging' : ''}.`;
}

// Runs one action in PowerShell. Resolves with a short sentence, or rejects with the reason.
function runPcAction(action, text = '', { execFileImpl = execFile } = {}) {
  if (!ACTIONS.has(action)) return Promise.reject(new Error('That is not something I can do.'));
  const rest = action === 'type' ? ['-Action', action, '-Text', String(text)] : ['-Action', action];
  return runPs(SCRIPT, rest, { sta: true, timeout: TIMEOUT_MS, execFileImpl }).then((said) => (action === 'battery' ? describeBattery(said) : said || 'Done'));
}

// Sleep, restart and shut down. Restart and shut down wait a few seconds so "cancel shutdown" can stop them.
const POWER = {
  sleep: { file: 'rundll32.exe', args: ['powrprof.dll,SetSuspendState', '0,1,0'], message: 'Going to sleep' },
  restart: { file: 'shutdown.exe', args: ['/r', '/t', String(POWER_DELAY_SECONDS)], message: `Restarting in ${POWER_DELAY_SECONDS} seconds. Say cancel shutdown to stop it.` },
  shutdown: { file: 'shutdown.exe', args: ['/s', '/t', String(POWER_DELAY_SECONDS)], message: `Shutting down in ${POWER_DELAY_SECONDS} seconds. Say cancel shutdown to stop it.` },
  abort: { file: 'shutdown.exe', args: ['/a'], message: 'Cancelled' },
};

function runPower(action, { execFileImpl = execFile } = {}) {
  return new Promise((resolve, reject) => {
    const power = POWER[action];
    if (!power) { reject(new Error('That is not something I can do.')); return; }
    execFileImpl(power.file, power.args, { windowsHide: true }, (error) => {
      // "shutdown /a" fails with a plain message when nothing is waiting to shut down
      if (error && action === 'abort') { resolve('Nothing was waiting to shut down'); return; }
      if (error) { reject(new Error('Windows did not allow that.')); return; }
      resolve(power.message);
    });
  });
}

module.exports = { runPcAction, runPower, describeBattery, ACTIONS, POWER };
