// Puts real files on the Windows clipboard so they can be pasted into Explorer, email or chat.
// The paths go to PowerShell through its input (encoded, so any language's file names work), never inside the command text.
const { spawn } = require('child_process');

// Windows PowerShell 5.1's Set-Clipboard takes only one path, so the file list is built with .NET (which needs -STA).
const SCRIPT = [
  'Add-Type -AssemblyName System.Windows.Forms',
  '$json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd().Trim()))',
  '$list = New-Object System.Collections.Specialized.StringCollection',
  'foreach ($p in ($json | ConvertFrom-Json)) { [void]$list.Add([string]$p) }',
  '[System.Windows.Forms.Clipboard]::SetFileDropList($list)',
].join('; ');
const TIMEOUT_MS = 15000;

function copyFilesToClipboard(paths, { spawnImpl = spawn } = {}) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(paths) || !paths.length) { reject(new Error('There are no files to copy')); return; }
    const child = spawnImpl('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', SCRIPT], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    let errorText = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Copying the files took too long')); }, TIMEOUT_MS);
    child.stderr.on('data', (chunk) => { errorText += chunk; });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(paths.length);
      else reject(new Error(errorText.trim().split('\n')[0] || 'Could not copy the files'));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(Buffer.from(JSON.stringify(paths), 'utf8').toString('base64'));
  });
}

module.exports = { copyFilesToClipboard, SCRIPT };
