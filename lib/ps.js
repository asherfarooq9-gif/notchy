// The one place that starts PowerShell scripts. Arguments always go in as a list (never glued into a command line),
// and the first line of a script's error text becomes the error message everywhere.
const { execFile, spawn } = require('child_process');
const readline = require('readline');

const firstLine = (text) => String(text || '').trim().split(/\r?\n/)[0];

// In the installed app, files live in an archive (app.asar) that PowerShell cannot read. The scripts are also kept unpacked next to it.
const unpackedPath = (file) => String(file).replace(/([\\/])app\.asar(?=[\\/])/, '$1app.asar.unpacked');

function psArgs(script, rest = [], { sta = false } = {}) {
  return ['-NoProfile', ...(sta ? ['-Sta'] : []), '-ExecutionPolicy', 'Bypass', '-File', unpackedPath(script), ...rest];
}

// Runs a script once. Resolves with what it printed (trimmed), or rejects with its first error line (or `fallback`).
function runPs(script, rest, { sta = false, timeout = 20000, fallback = 'That did not work.', timeoutMessage = fallback, execFileImpl = execFile } = {}) {
  return new Promise((resolve, reject) => {
    execFileImpl('powershell.exe', psArgs(script, rest, { sta }), { windowsHide: true, timeout }, (error, stdout, stderr) => {
      if (error) reject(new Error(firstLine(stderr) || (error.killed ? timeoutMessage : fallback)));
      else resolve(String(stdout || '').trim());
    });
  });
}

// Starts a script that stays running and prints one JSON object per line.
// onLine(object) per good line, onBadLine(text) per unreadable line, onExit(code, firstErrorLine) when it ends.
function spawnPsLines(script, rest, { onLine, onBadLine = () => {}, onExit = () => {}, spawnImpl = spawn }) {
  const child = spawnImpl('powershell.exe', psArgs(script, rest), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  readline.createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', (line) => {
    let event;
    try { event = JSON.parse(line); } catch { onBadLine(line); return; }
    onLine(event);
  });
  let errorText = '';
  child.stderr.on('data', (chunk) => { errorText += chunk; });
  child.on('exit', (code) => onExit(code, firstLine(errorText)));
  child.on('error', (error) => onExit(-1, error.message)); // PowerShell could not start at all
  child.stdin.on('error', () => {}); // a closed pipe is reported by the exit event
  return {
    send: (line) => { if (child.stdin.writable) child.stdin.write(line.replace(/[\r\n]+/g, ' ') + '\n'); },
    kill: () => child.kill(),
  };
}

module.exports = { runPs, spawnPsLines, psArgs, firstLine, unpackedPath };
