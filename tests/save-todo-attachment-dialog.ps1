param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$testRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.preview\todo-editor-tests'))
$targetPath = [System.IO.Path]::GetFullPath($Destination)
if (-not $targetPath.StartsWith($testRoot + '\')) { throw 'Only the dedicated test output directory is allowed.' }
$emProcess = Get-CimInstance Win32_Process -Filter "Name = 'em.exe'" | Where-Object { $_.ExecutablePath -eq 'D:\ai\NXY-AIClient\src-tauri\target\release\em.exe' } | Select-Object -First 1
if (-not $emProcess) { throw 'Updated EM process not found.' }
Add-Type -AssemblyName UIAutomationClient
$processCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, ([int]$emProcess.ProcessId))
$windowCondition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)
$ownedWindowCondition = New-Object System.Windows.Automation.AndCondition($processCondition, $windowCondition)
$saveDialog = $null
$expectedTitle = -join (0x4FDD,0x5B58,0x5F85,0x529E,0x9644,0x4EF6 | ForEach-Object { [char]$_ })
for ($attempt = 0; $attempt -lt 80 -and -not $saveDialog; $attempt++) {
  $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Descendants, $ownedWindowCondition)
  foreach ($window in $windows) {
    if ($window.Current.Name -eq $expectedTitle -and $window.Current.ClassName -eq '#32770') { $saveDialog = $window; break }
  }
  if (-not $saveDialog) { Start-Sleep -Milliseconds 250 }
}
if (-not $saveDialog) {
  foreach ($window in $windows) { Write-Output ('EM window: ' + $window.Current.Name + ' | ' + $window.Current.ClassName) }
  throw 'EM attachment save dialog did not appear.'
}
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class TodoSaveNative {
  public delegate bool EnumProc(IntPtr handle, IntPtr data);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr data);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr handle, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr handle);
  [DllImport("user32.dll", EntryPoint="SendMessageW", CharSet=CharSet.Unicode)] public static extern IntPtr SetText(IntPtr handle, uint message, IntPtr param, string text);
  [DllImport("user32.dll", EntryPoint="PostMessageW")] public static extern bool PostMessage(IntPtr handle, uint message, IntPtr param, IntPtr data);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr handle, StringBuilder text, int count);
  public static IntPtr FindFileEdit(IntPtr root) {
    IntPtr result = IntPtr.Zero;
    EnumChildWindows(root, (handle, data) => {
      var name = new StringBuilder(256);
      GetClassName(handle, name, 256);
      if (name.ToString() == "Edit") {
        var parent = new StringBuilder(256);
        GetClassName(GetParent(handle), parent, 256);
        if (parent.ToString().StartsWith("ComboBox")) result = handle;
      }
      return true;
    }, IntPtr.Zero);
    return result;
  }
}
'@
$dialogHandle = [IntPtr]$saveDialog.Current.NativeWindowHandle
$fileEdit = [TodoSaveNative]::FindFileEdit($dialogHandle)
if ($fileEdit -eq [IntPtr]::Zero) { throw 'Native file name edit control not found.' }
[void][TodoSaveNative]::SetText($fileEdit, 0x000C, [IntPtr]::Zero, $targetPath)
$currentText = New-Object System.Text.StringBuilder 2048
[void][TodoSaveNative]::GetWindowText($fileEdit, $currentText, 2048)
if ($currentText.ToString() -ne $targetPath) { throw 'Native file name did not accept the controlled path.' }
[void][TodoSaveNative]::PostMessage($dialogHandle, 0x0111, [IntPtr]1, [IntPtr]::Zero)
Write-Output 'Native EM save dialog completed with the controlled test destination.'
