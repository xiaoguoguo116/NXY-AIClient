$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class EmWindowCapture {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr handle, out Rect rect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr handle, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr handle, int command);
}
'@
$emWindow = Get-Process em | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $emWindow) { throw 'EM 主窗口未找到' }
[EmWindowCapture]::ShowWindow($emWindow.MainWindowHandle, 9) | Out-Null
Start-Sleep -Milliseconds 800
$rect = New-Object EmWindowCapture+Rect
[EmWindowCapture]::GetWindowRect($emWindow.MainWindowHandle, [ref]$rect) | Out-Null
$bitmap = New-Object System.Drawing.Bitmap(($rect.Right-$rect.Left), ($rect.Bottom-$rect.Top))
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$dc = $graphics.GetHdc()
try { $captured = [EmWindowCapture]::PrintWindow($emWindow.MainWindowHandle, $dc, 2) }
finally { $graphics.ReleaseHdc($dc) }
try {
  if (-not $captured) { throw '窗口截图失败' }
  $bitmap.Save('D:\ai\NXY-AIClient\.preview\current-em.png')
  Write-Output 'Captured only the current EM window; no navigation or message sending.'
} finally { $graphics.Dispose(); $bitmap.Dispose() }
