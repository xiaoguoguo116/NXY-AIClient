$ErrorActionPreference = 'Stop'
$workspace = 'D:\ai\NXY-AIClient'
$releaseExe = Join-Path $workspace 'src-tauri\target\release\em.exe'
$backupExe = Join-Path $workspace ('src-tauri\target\release\em-before-chat-knowledge-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.exe')
$cargoExe = 'C:\Users\94719\.cargo\bin\cargo.exe'
if (!(Test-Path -LiteralPath $releaseExe)) { throw 'Expected EM release executable is missing' }
$apps = @(Get-CimInstance Win32_Process -Filter "name = 'em.exe'" | Where-Object ExecutablePath -EQ $releaseExe)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
foreach ($app in $apps) {
  $condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$app.ProcessId)
  $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
  foreach ($window in $windows) {
    $elements = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($element in $elements) {
      $info = $element.Current
      if ($info.IsPassword -or $info.IsOffscreen) { continue }
      if ($info.ControlType -eq [System.Windows.Automation.ControlType]::Edit) {
        $pattern = $null
        if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern) -and $pattern.Current.Value.Trim()) {
          throw 'Client has a non-empty input; leave it running until the draft is handled'
        }
      }
      if ($info.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $info.Name -match '^停止|取消上传|取消下载') {
        throw 'Client has an active operation; leave it running'
      }
    }
  }
}
Copy-Item -LiteralPath $releaseExe -Destination $backupExe
foreach ($app in $apps) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($app.ProcessId)"
  if ($current.ExecutablePath -ne $releaseExe) { throw 'Client process identity changed' }
  Stop-Process -Id $app.ProcessId
  Wait-Process -Id $app.ProcessId -Timeout 15 -ErrorAction SilentlyContinue
}
$built = $false
try {
  Push-Location (Join-Path $workspace 'src-tauri')
  try {
    & $cargoExe build --release --offline --bin em --features tauri/custom-protocol
    if ($LASTEXITCODE -ne 0) { throw 'Desktop executable build failed' }
    $built = $true
  } finally { Pop-Location }
} finally {
  if (!$built) { Copy-Item -LiteralPath $backupExe -Destination $releaseExe -Force }
  $previousArguments = $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
  try {
    $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-address=127.0.0.1 --remote-debugging-port=19224'
    Start-Process -FilePath $releaseExe -WorkingDirectory $workspace -WindowStyle Hidden
  } finally { $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = $previousArguments }
}
Write-Output "Updated executable: $releaseExe"
Write-Output "Previous executable backup: $backupExe"
