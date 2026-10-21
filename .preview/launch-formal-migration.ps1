$ErrorActionPreference = 'Stop'
$appRoot = 'C:\Users\94719\AppData\Local\chat.linyu'
$backup = Join-Path $appRoot ('backups\formal-consolidation-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$releaseExe = 'D:\ai\NXY-AIClient\src-tauri\target\release\em.exe'
if (!(Test-Path -LiteralPath $releaseExe)) { throw 'Release executable missing' }
$processes = Get-CimInstance Win32_Process
$runner = $processes | Where-Object { $_.ProcessId -eq 9356 -and $_.CommandLine -match 'tauri dev' }
$cli = $processes | Where-Object { $_.ProcessId -eq 29068 -and $_.CommandLine -match 'D:\\ai\\NXY-AIClient' -and $_.CommandLine -match '"dev"' }
if (!$runner -or !$cli) { throw 'Development process identity changed; refusing to stop anything' }
New-Item -ItemType Directory -Path $backup | Out-Null
# Capture the visible draft without reading password fields.
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, 12240)
$window = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $condition)
$draft = ''
if ($window) {
  $inputCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, '消息输入框')
  $inputElement = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $inputCondition)
  if ($inputElement -and !$inputElement.Current.IsPassword) {
    $pattern = $null
    if ($inputElement.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) { $draft = $pattern.Current.Value }
  }
}
@{draft=$draft; createdAt=(Get-Date -Format o)} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup 'window-state.json') -Encoding utf8
$ids = [System.Collections.Generic.HashSet[int]]::new()
[void]$ids.Add(9356)
do {
  $added = $false
  foreach ($process in $processes) {
    if ($ids.Contains([int]$process.ParentProcessId) -and $ids.Add([int]$process.ProcessId)) { $added = $true }
  }
} while ($added)
# Stop the verified dev supervisor first so it cannot restart the child app.
Stop-Process -Id 9356 -ErrorAction SilentlyContinue
foreach ($processId in $ids) {
  if ($processId -ne 9356) { Stop-Process -Id $processId -ErrorAction SilentlyContinue }
}
Start-Sleep -Seconds 2
foreach ($relative in @('EBWebView\Default\Local Storage','EBWebView\Default\IndexedDB','EBWebView\Default\Session Storage','data')) {
  $source = Join-Path $appRoot $relative
  if (Test-Path -LiteralPath $source) {
    $destination = Join-Path $backup $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination -Recurse
  }
}
$shortcut = 'C:\Users\94719\Desktop\em.exe - 快捷方式.lnk'
if (Test-Path -LiteralPath $shortcut) { Copy-Item -LiteralPath $shortcut -Destination (Join-Path $backup 'original-shortcut.lnk') }
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-address=127.0.0.1 --remote-debugging-port=19224'
Start-Process -FilePath $releaseExe -WorkingDirectory 'D:\ai\NXY-AIClient' -WindowStyle Hidden
Remove-Item Env:\WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
Write-Output "Backup: $backup"
Write-Output 'Formal executable started for migration and native verification.'
