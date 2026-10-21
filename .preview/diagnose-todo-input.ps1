$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class TodoInputMouse {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetPhysicalCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int cmd);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
}
'@
$app = Get-Process em | Where-Object { $_.Path -eq 'D:\ai\NXY-AIClient\src-tauri\target\release\em.exe' } | Select-Object -First 1
if (!$app) { throw 'Formal client missing' }
$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$app.Id)
$windows = $root.FindAll([System.Windows.Automation.TreeScope]::Children,$condition)
$window = $windows | Where-Object { $_.Current.Name -eq 'EM' } | Select-Object -First 1
[TodoInputMouse]::ShowWindow([IntPtr]$window.Current.NativeWindowHandle,9) | Out-Null
[TodoInputMouse]::SetForegroundWindow([IntPtr]$window.Current.NativeWindowHandle) | Out-Null
function Find-Control($name) {
  $match = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty,$name)
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $control = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants,$match) | Where-Object { !$_.Current.IsOffscreen } | Select-Object -First 1
    if ($control) { return $control }
    Start-Sleep -Milliseconds 100
  }
  throw "Control not found: $name"
}
function Click-Control($control) {
  if (!$control) { throw 'Control not found' }
  $point = $control.GetClickablePoint()
  Write-Output ('Click ' + $control.Current.Name + ' at ' + $point.X + ',' + $point.Y)
  [TodoInputMouse]::SetPhysicalCursorPos([int]$point.X,[int]$point.Y) | Out-Null
  [TodoInputMouse]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
  [TodoInputMouse]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 300
}
Click-Control (Find-Control '待办事项')
Click-Control (Find-Control '新建待办')
$inputBox = Find-Control '待办事项内容'
if (!$inputBox) { throw 'Title input missing' }
Write-Output ('Input enabled=' + $inputBox.Current.IsEnabled + ', focusable=' + $inputBox.Current.IsKeyboardFocusable)
Click-Control $inputBox
Write-Output ('Focused after click=' + [System.Windows.Automation.AutomationElement]::FocusedElement.Current.Name)
[System.Windows.Forms.SendKeys]::SendWait('todo-input-check')
Start-Sleep -Milliseconds 300
$value = $inputBox.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
Write-Output ('Keyboard text accepted=' + ($value.Current.Value -eq 'todo-input-check'))
if ($value.Current.Value -eq 'todo-input-check') { [System.Windows.Forms.SendKeys]::SendWait('^a{BACKSPACE}') }
