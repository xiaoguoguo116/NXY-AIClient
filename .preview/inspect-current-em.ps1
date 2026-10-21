$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class EmReadOnlyCapture {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
}
'@
$app = Get-Process em | Where-Object { $_.Path -like 'D:\ai\NXY-AIClient\src-tauri\target\*\em.exe' } | Select-Object -First 1
if (!$app) { throw 'EM process unavailable' }
$condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $app.Id)
$windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
foreach ($window in $windows) {
  Write-Output ("WINDOW " + $window.Current.Name)
  if ($window.Current.Name -eq 'EM') {
    $handle = [IntPtr]$window.Current.NativeWindowHandle
    $rect = New-Object EmReadOnlyCapture+RECT
    [EmReadOnlyCapture]::GetWindowRect($handle, [ref]$rect) | Out-Null
    if ($rect.Right -gt $rect.Left -and $rect.Bottom -gt $rect.Top) {
      $bitmap = New-Object System.Drawing.Bitmap ($rect.Right - $rect.Left), ($rect.Bottom - $rect.Top)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $dc = $graphics.GetHdc()
      $captured = [EmReadOnlyCapture]::PrintWindow($handle, $dc, 2)
      $graphics.ReleaseHdc($dc)
      if ($captured) { $bitmap.Save('D:\ai\NXY-AIClient\.preview\current-em-diagnosis.png') }
      $graphics.Dispose()
      $bitmap.Dispose()
      Write-Output "Capture=$captured"
    }
  }
  $elements = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($element in $elements) {
    $info = $element.Current
    # Do not inspect edit values or password fields. Only report relevant
    # visible status text and control labels from the current EM window.
    if (!$info.IsPassword -and !$info.IsOffscreen -and
        $info.ControlType.ProgrammaticName -in @('ControlType.Text', 'ControlType.Button') -and
        $info.Name -match '总结|模型|配置|接口|密钥|失败|错误|连接|超时|AI|已选|重试|停止|请求') {
      Write-Output ($info.ControlType.ProgrammaticName + ' ' + $info.Name)
    }
  }
}
