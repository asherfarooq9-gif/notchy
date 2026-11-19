# One small background program that watches the desktop and reports changes, one JSON line each:
#   {"e":"volume","level":73,"muted":false}      the speaker volume changed
#   {"e":"fullscreen","on":true}                 a full-screen app or game started or ended
#   {"e":"media","playing":true,"title":"..","artist":"..","position":12.5,"duration":201,"art":"data:image/jpeg;base64,.."}
#   {"e":"media","none":true}                    nothing is playing
#   {"e":"activity","app":"chrome","idle":3}      every 5 seconds, only after "activity on": the program in front and seconds since the last key or mouse move
# It listens for lines on stdin:  media playpause | media next | media prev | activity on | activity off | quit
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false # song titles in any language
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$source = @'
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumeratorComObject { }

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator
{
    int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}

[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice
{
    int Activate(ref Guid id, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object endpointVolume);
}

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume
{
    int RegisterControlChangeNotify(IntPtr notify);
    int UnregisterControlChangeNotify(IntPtr notify);
    int GetChannelCount(out uint count);
    int SetMasterVolumeLevel(float levelDb, ref Guid context);
    int SetMasterVolumeLevelScalar(float level, ref Guid context);
    int GetMasterVolumeLevel(out float levelDb);
    int GetMasterVolumeLevelScalar(out float level);
    int SetChannelVolumeLevel(uint channel, float levelDb, ref Guid context);
    int SetChannelVolumeLevelScalar(uint channel, float level, ref Guid context);
    int GetChannelVolumeLevel(uint channel, out float levelDb);
    int GetChannelVolumeLevelScalar(uint channel, out float level);
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, ref Guid context);
    int GetMute([MarshalAs(UnmanagedType.Bool)] out bool mute);
}

public static class Live
{
    [DllImport("shell32.dll")]
    static extern int SHQueryUserNotificationState(out int state);

    public static readonly ConcurrentQueue<string> Commands = new ConcurrentQueue<string>();

    // "73|0" = 73 percent, not muted. Empty when there is no audio device.
    public static string ReadVolume()
    {
        IMMDeviceEnumerator enumerator = null;
        IMMDevice device = null;
        object volumeObject = null;
        try
        {
            enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());
            Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
            Guid iid = typeof(IAudioEndpointVolume).GUID;
            Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out volumeObject));
            IAudioEndpointVolume volume = (IAudioEndpointVolume)volumeObject;
            float level;
            bool muted;
            Marshal.ThrowExceptionForHR(volume.GetMasterVolumeLevelScalar(out level));
            Marshal.ThrowExceptionForHR(volume.GetMute(out muted));
            return ((int)Math.Round(level * 100)).ToString() + "|" + (muted ? "1" : "0");
        }
        catch (Exception)
        {
            return "";
        }
        finally
        {
            if (volumeObject != null) Marshal.ReleaseComObject(volumeObject);
            if (device != null) Marshal.ReleaseComObject(device);
            if (enumerator != null) Marshal.ReleaseComObject(enumerator);
        }
    }

    // Windows' own "is something full screen right now" answer (games, F11 video, presentations).
    public static bool IsFullscreen()
    {
        int state;
        if (SHQueryUserNotificationState(out state) != 0) return false;
        return state == 2 || state == 3 || state == 4 || state == 7;
    }

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [StructLayout(LayoutKind.Sequential)]
    struct LastInput { public uint size; public uint time; }
    [DllImport("user32.dll")]
    static extern bool GetLastInputInfo(ref LastInput info);

    // The program name of the window in front (for example "chrome"). Never the window title. Empty if unknown.
    public static string ForegroundApp()
    {
        try
        {
            uint processId;
            GetWindowThreadProcessId(GetForegroundWindow(), out processId);
            if (processId == 0) return "";
            return Process.GetProcessById((int)processId).ProcessName;
        }
        catch (Exception)
        {
            return "";
        }
    }

    // Seconds since the last key press or mouse move.
    public static int IdleSeconds()
    {
        LastInput info = new LastInput();
        info.size = (uint)Marshal.SizeOf(typeof(LastInput));
        if (!GetLastInputInfo(ref info)) return 0;
        return (int)(((uint)Environment.TickCount - info.time) / 1000);
    }

    public static void StartInput()
    {
        Thread reader = new Thread(delegate ()
        {
            string line;
            while ((line = Console.In.ReadLine()) != null) Commands.Enqueue(line);
            Commands.Enqueue("quit");
        });
        reader.IsBackground = true;
        reader.Start();
    }
}
'@
Add-Type -TypeDefinition $source -Language CSharp

# --- Windows media session (the same one behind the volume flyout) ---
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Await($operation, $resultType) {
  $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
  $task.Wait(-1) | Out-Null
  $task.Result
}
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$propsType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
$streamType = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$manager = Await ($managerType::RequestAsync()) $managerType

function Emit($object) {
  [Console]::Out.WriteLine(($object | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}

function Get-Session {
  foreach ($candidate in $manager.GetSessions()) {
    if ($candidate.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { return $candidate }
  }
  return $manager.GetCurrentSession()
}

# PowerShell cannot pick the right overload of this helper on a Windows picture stream, so it is called through reflection.
$asStreamForRead = [System.IO.WindowsRuntimeStreamExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsStreamForRead' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IInputStream'
} | Select-Object -First 1

# The picture type, read from the first bytes (the stream's own content type is not reliable).
function Get-ImageType($bytes) {
  if ($bytes.Length -ge 4 -and $bytes[0] -eq 0x89 -and $bytes[1] -eq 0x50) { return 'image/png' }
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xD8) { return 'image/jpeg' }
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0x42 -and $bytes[1] -eq 0x4D) { return 'image/bmp' }
  if ($bytes.Length -ge 12 -and $bytes[8] -eq 0x57 -and $bytes[9] -eq 0x45) { return 'image/webp' }
  return 'image/png'
}

# The cover art as a data URL, or $null. No art is not an error: many players give none.
function Get-Art($props) {
  try {
    if (-not $props.Thumbnail) { return $null }
    $stream = Await ($props.Thumbnail.OpenReadAsync()) $streamType
    $reader = $asStreamForRead.Invoke($null, @($stream))
    $memory = New-Object System.IO.MemoryStream
    $reader.CopyTo($memory)
    $bytes = $memory.ToArray()
    if ($bytes.Length -eq 0 -or $bytes.Length -gt 400000) { return $null }
    return 'data:' + (Get-ImageType $bytes) + ';base64,' + [Convert]::ToBase64String($bytes)
  } catch { return $null }
}

$lastVolume = ''
$lastFullscreen = $null
$lastTrack = $null
$lastPlaying = $null
$expectedPosition = 0.0
$expectedAt = [DateTime]::UtcNow
$artPending = $false # browsers often add the picture a moment after the song starts, so keep asking for a few seconds
$artTries = 0

function Poll-Media {
  $session = Get-Session
  if (-not $session) {
    if ($lastTrack -ne '') { Emit @{ e = 'media'; none = $true }; $script:lastTrack = ''; $script:lastPlaying = $false }
    return
  }
  $playing = $session.GetPlaybackInfo().PlaybackStatus -eq 'Playing'
  $props = Await ($session.TryGetMediaPropertiesAsync()) $propsType
  $track = "$($props.Title)|$($props.Artist)|$($session.SourceAppUserModelId)"
  $timeline = $session.GetTimelineProperties()
  $duration = [Math]::Max(0, ($timeline.EndTime - $timeline.StartTime).TotalSeconds)
  $position = $timeline.Position.TotalSeconds
  if ($playing) { $position += ([DateTimeOffset]::Now - $timeline.LastUpdatedTime).TotalSeconds }
  if ($duration -gt 0) { $position = [Math]::Min($position, $duration) }
  $expected = $script:expectedPosition + $(if ($script:lastPlaying) { ([DateTime]::UtcNow - $script:expectedAt).TotalSeconds } else { 0 })
  $isNewTrack = $track -ne $script:lastTrack
  $isSeek = [Math]::Abs($position - $expected) -gt 2.5
  $lateArt = $null
  if ($script:artPending -and -not $isNewTrack) {
    $script:artTries++
    $lateArt = Get-Art $props
    if ($lateArt -or $script:artTries -ge 6) { $script:artPending = $false }
  }
  if ($isNewTrack -or $playing -ne $script:lastPlaying -or $isSeek -or $lateArt) {
    $payload = @{ e = 'media'; none = $false; playing = $playing; title = "$($props.Title)"; artist = "$($props.Artist)"; position = [Math]::Round($position, 1); duration = [Math]::Round($duration, 1) }
    if ($isNewTrack) {
      $payload.art = Get-Art $props
      $script:artPending = -not $payload.art
      $script:artTries = 0
    } elseif ($lateArt) {
      $payload.art = $lateArt
    }
    Emit $payload
  }
  $script:lastTrack = $track
  $script:lastPlaying = $playing
  $script:expectedPosition = $position
  $script:expectedAt = [DateTime]::UtcNow
}

$activityOn = $false # the front program is only looked at while Screen Time is switched on

function Run-Command($line) {
  if ($line -match '^activity (on|off)$') { $script:activityOn = ($Matches[1] -eq 'on'); return }
  if ($line -notmatch '^media (playpause|next|prev)$') { return }
  $session = Get-Session
  if (-not $session) { return }
  switch ($Matches[1]) {
    'playpause' { [void](Await ($session.TryTogglePlayPauseAsync()) ([bool])) }
    'next' { [void](Await ($session.TrySkipNextAsync()) ([bool])) }
    'prev' { [void](Await ($session.TrySkipPreviousAsync()) ([bool])) }
  }
}

[Live]::StartInput()
$tick = 0
while ($true) {
  $command = $null
  while ([Live]::Commands.TryDequeue([ref]$command)) {
    if ($command -eq 'quit') { exit 0 }
    Run-Command $command
  }

  $volume = [Live]::ReadVolume()
  if ($volume -ne '' -and $volume -ne $lastVolume) {
    $parts = $volume.Split('|')
    Emit @{ e = 'volume'; level = [int]$parts[0]; muted = ($parts[1] -eq '1') }
    $lastVolume = $volume
  }
  if ($tick % 2 -eq 0) {
    $fullscreen = [Live]::IsFullscreen()
    if ($fullscreen -ne $lastFullscreen) { Emit @{ e = 'fullscreen'; on = $fullscreen }; $lastFullscreen = $fullscreen }
  }
  if ($tick % 4 -eq 0) { Poll-Media }
  if ($activityOn -and $tick % 20 -eq 0) {
    $app = [Live]::ForegroundApp()
    if ($app -ne '') { Emit @{ e = 'activity'; app = $app; idle = [Live]::IdleSeconds() } }
  }
  $tick++
  Start-Sleep -Milliseconds 250
}
