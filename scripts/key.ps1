# Presses one media key. Only these keys are allowed.
param(
  [Parameter(Mandatory)][ValidateSet('volup', 'voldown', 'mute', 'playpause', 'next', 'prev')][string]$Key
)
$codes = @{ volup = 0xAF; voldown = 0xAE; mute = 0xAD; playpause = 0xB3; next = 0xB0; prev = 0xB1 }
Add-Type -Namespace Win -Name Keys -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);'
$repeat = if ($Key -in 'volup', 'voldown') { 5 } else { 1 } # one volume press = 2%
1..$repeat | ForEach-Object {
  [Win.Keys]::keybd_event($codes[$Key], 0, 0, [UIntPtr]::Zero)
  [Win.Keys]::keybd_event($codes[$Key], 0, 2, [UIntPtr]::Zero)
}
