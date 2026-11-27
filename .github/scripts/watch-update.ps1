# Watches an update while it happens and writes a timeline, so a flicker of a second can be seen.
# Every 25 ms it records: does the Start menu shortcut exist, how many Notchy programs run, and which windows are open
# whose title mentions the shortcut (the "Windows cannot find ...lnk" box is such a window).
param(
  [Parameter(Mandatory)][string]$Shortcut,
  [Parameter(Mandatory)][string]$LogFile,
  [int]$Seconds = 90
)
Add-Type -TypeDefinition @'
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class WindowTitles {
  delegate bool EnumProc(IntPtr window, IntPtr data);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr data);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int max);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  public static List<string> Visible() {
    var titles = new List<string>();
    EnumWindows((window, data) => {
      if (IsWindowVisible(window)) { var text = new StringBuilder(300); GetWindowText(window, text, 300); if (text.Length > 0) titles.Add(text.ToString()); }
      return true;
    }, IntPtr.Zero);
    return titles;
  }
}
'@

$clock = [Diagnostics.Stopwatch]::StartNew()
$lines = New-Object System.Collections.Generic.List[string]
$note = { param($text) $lines.Add(('{0,8} ms  {1}' -f $clock.ElapsedMilliseconds, $text)) }
$lastExists = $null; $lastCount = $null; $seenTitles = @{}
& $note 'watcher started'
while ($clock.Elapsed.TotalSeconds -lt $Seconds) {
  $exists = Test-Path -LiteralPath $Shortcut
  if ($exists -ne $lastExists) { & $note "Start menu shortcut exists = $exists"; $lastExists = $exists }
  $count = @(Get-Process -Name Notchy -ErrorAction SilentlyContinue).Count
  if ($count -ne $lastCount) { & $note "Notchy programs running = $count"; $lastCount = $count }
  foreach ($title in [WindowTitles]::Visible()) {
    if ($title -match 'Notchy|\.lnk|cannot find' -and -not $seenTitles.ContainsKey($title)) { $seenTitles[$title] = $true; & $note "WINDOW: $title" }
  }
  Start-Sleep -Milliseconds 25
}
& $note 'watcher finished'
$lines | Set-Content -Path $LogFile -Encoding utf8
