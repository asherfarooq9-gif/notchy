param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out,
  [Parameter(Mandatory = $true)][ValidateSet('pdf', 'docx')][string]$To
)
# Converts one file with Microsoft Word, hidden. Errors go to stderr (first line is shown to the user), exit code 1.
$ErrorActionPreference = 'Stop'
$wdFormatDocumentDefault = 16  # .docx
$wdExportFormatPDF = 17
$HELPER_LIFETIME_SECONDS = 100  # shorter than the app's own 120 second limit, so Word never gets stranded

$word = $null
$doc = $null
$helper = $null
# If Word is already open for the user, we must not close it afterwards.
$before = @(Get-Process -Name WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$wasRunning = $before.Count -gt 0

# Runs beside the conversion. (1) Word asks "convert your PDF?" even when told not to: it presses OK on that one box.
# (2) If Word is still stuck near the end of the time limit, it closes the Word that THIS script started (never the user's).
$helperScript = {
  param($beforeIds, $lifetime, $mayClose)
  Add-Type -AssemblyName UIAutomationClient
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $dialogs = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ClassNameProperty, 'NUIDialog')
  $started = Get-Date
  while (((Get-Date) - $started).TotalSeconds -lt $lifetime) {
    foreach ($dialog in $root.FindAll([System.Windows.Automation.TreeScope]::Children, $dialogs)) {
      $all = $dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
      $isPdfNotice = $false
      foreach ($e in $all) { if ($e.Current.Name -like 'Word will now convert your PDF*') { $isPdfNotice = $true } }
      if (-not $isPdfNotice) { continue }
      foreach ($e in $all) {
        if ($e.Current.Name -eq 'OK' -and $e.Current.ControlType.ProgrammaticName -eq 'ControlType.Button') {
          try { $e.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke() } catch {}
        }
      }
    }
    Start-Sleep -Milliseconds 400
  }
  # Time is up: close only a Word that was not there when the conversion began (and never if the user's Word was open).
  if ($mayClose) { Get-Process -Name WINWORD -ErrorAction SilentlyContinue | Where-Object { $beforeIds -notcontains $_.Id } | Stop-Process -Force }
}

try {
  try { $word = New-Object -ComObject Word.Application } catch { throw 'Microsoft Word is not installed, so this cannot be converted.' }
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3  # msoAutomationSecurityForceDisable: a file's macros never run during conversion
  if (Test-Path -LiteralPath $Out) { throw 'A file with that name already exists, so nothing was replaced.' }
  $helper = Start-Job -ScriptBlock $helperScript -ArgumentList (, $before), $HELPER_LIFETIME_SECONDS, (-not $wasRunning)
  # Open(FileName, ConfirmConversions, ReadOnly, AddToRecentFiles): never touch the original.
  try { $doc = $word.Documents.Open($In, $false, $true, $false) } catch { throw 'Word could not open this file. It may be damaged or password protected.' }
  if ($To -eq 'pdf') { $doc.ExportAsFixedFormat($Out, $wdExportFormatPDF) }
  else { $doc.SaveAs2([ref]$Out, [ref]$wdFormatDocumentDefault) }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
} finally {
  if ($helper) { Stop-Job $helper -ErrorAction SilentlyContinue; Remove-Job $helper -Force -ErrorAction SilentlyContinue }
  if ($doc) { try { $doc.Close([ref]0) } catch {} ; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($doc) }
  if ($word) {
    if (-not $wasRunning) { try { $word.Quit([ref]0) } catch {} }
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  }
}
