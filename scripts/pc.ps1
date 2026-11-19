# Does ONE fixed thing to the computer. Only the actions in the list below are allowed.
# -Text is only ever typed as letters, it is never run as a command.
# Prints one short line saying what happened. On a problem it prints the reason to the error output and exits with 1.
param(
  [Parameter(Mandatory)][ValidateSet('brightnessup', 'brightnessdown', 'wifion', 'wifioff', 'bluetoothon', 'bluetoothoff', 'screenshot', 'snapleft', 'snapright', 'maximize', 'minimize', 'desktop', 'switchwindow', 'battery', 'type')][string]$Action,
  [string]$Text = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -Namespace Win -Name Native -MemberDefinition @'
[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
'@
[void][Win.Native]::SetProcessDPIAware() # so a screenshot is full size on a scaled screen

$WIN = 0x5B; $ALT = 0x12; $TAB = 0x09; $LEFT = 0x25; $UP = 0x26; $RIGHT = 0x27; $DOWN = 0x28; $D = 0x44

# Holds the keys down in order, then lets go in reverse order (like pressing a shortcut).
function Press([byte[]]$keys) {
  foreach ($key in $keys) { [Win.Native]::keybd_event($key, 0, 0, [UIntPtr]::Zero) }
  [array]::Reverse($keys)
  foreach ($key in $keys) { [Win.Native]::keybd_event($key, 0, 2, [UIntPtr]::Zero) }
}

function Change-Brightness([int]$step) {
  $now = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1
  if (-not $now) { throw 'This screen does not support changing the brightness.' }
  $level = [math]::Max(5, [math]::Min(100, [int]$now.CurrentBrightness + $step)) # never fully dark, so the screen never looks dead
  Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{ Timeout = 1; Brightness = $level } | Out-Null
  "Brightness $level percent"
}

# Wi-Fi and Bluetooth through the same Windows switch the Settings app uses. No administrator rights needed.
function Set-Radio([string]$kind, [string]$state, [string]$name) {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  })[0]
  function Await($operation, $resultType) {
    $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
    $task.Wait(-1) | Out-Null
    $task.Result
  }
  [void][Windows.Devices.Radios.Radio, Windows.System.Devices, ContentType = WindowsRuntime]
  $access = Await ([Windows.Devices.Radios.Radio]::RequestAccessAsync()) ([Windows.Devices.Radios.RadioAccessStatus])
  if ("$access" -ne 'Allowed') { throw 'Windows did not allow changing this. Check Settings, Privacy, Radios.' }
  $radios = Await ([Windows.Devices.Radios.Radio]::GetRadiosAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.Devices.Radios.Radio]])
  $found = @($radios | Where-Object { "$($_.Kind)" -eq $kind })
  if ($found.Count -eq 0) { throw "This computer has no $name." }
  foreach ($radio in $found) { [void](Await ($radio.SetStateAsync($state)) ([Windows.Devices.Radios.RadioAccessStatus])) }
  "$name $($state.ToLower())"
}

function Take-Screenshot {
  $area = [System.Windows.Forms.SystemInformation]::VirtualScreen # every screen
  $picture = New-Object System.Drawing.Bitmap $area.Width, $area.Height
  $canvas = [System.Drawing.Graphics]::FromImage($picture)
  $canvas.CopyFromScreen($area.Location, [System.Drawing.Point]::Empty, $area.Size)
  $canvas.Dispose()
  $folder = Join-Path ([Environment]::GetFolderPath('MyPictures')) 'Notch screenshots'
  New-Item -ItemType Directory -Force $folder | Out-Null
  $file = Join-Path $folder ('Screenshot ' + (Get-Date -Format 'yyyy-MM-dd HH.mm.ss') + '.png')
  $picture.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  [System.Windows.Forms.Clipboard]::SetImage($picture)
  $picture.Dispose()
  'Screenshot saved and copied'
}

# Types letters into whatever window is in front. The special characters of SendKeys are wrapped so they are typed as themselves.
function Type-Text([string]$words) {
  $safe = -join ($words.ToCharArray() | ForEach-Object {
    if ('+^%~(){}[]'.Contains([string]$_)) { '{' + $_ + '}' }
    elseif ([int]$_ -lt 32) { ' ' }
    else { [string]$_ }
  })
  [System.Windows.Forms.SendKeys]::SendWait($safe)
  'Typed'
}

try {
  switch ($Action) {
    'brightnessup' { Change-Brightness 10 }
    'brightnessdown' { Change-Brightness -10 }
    'wifion' { Set-Radio 'WiFi' 'On' 'Wi-Fi' }
    'wifioff' { Set-Radio 'WiFi' 'Off' 'Wi-Fi' }
    'bluetoothon' { Set-Radio 'Bluetooth' 'On' 'Bluetooth' }
    'bluetoothoff' { Set-Radio 'Bluetooth' 'Off' 'Bluetooth' }
    'screenshot' { Take-Screenshot }
    'snapleft' { Press @($WIN, $LEFT); 'Snapped left' }
    'snapright' { Press @($WIN, $RIGHT); 'Snapped right' }
    'maximize' { Press @($WIN, $UP); 'Maximized' }
    'minimize' { Press @($WIN, $DOWN); 'Minimized' }
    'desktop' { Press @($WIN, $D); 'Desktop' }
    'switchwindow' { Press @($ALT, $TAB); 'Switched window' }
    'battery' {
      $power = [System.Windows.Forms.SystemInformation]::PowerStatus
      if ($power.BatteryChargeStatus -band [System.Windows.Forms.BatteryChargeStatus]::NoSystemBattery) { 'none' }
      else { "$([int][math]::Round($power.BatteryLifePercent * 100))|$($power.PowerLineStatus)" }
    }
    'type' { Type-Text $Text }
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
