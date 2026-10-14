param([int]$X = -1, [int]$Y = -1, [string]$Text = '')
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class EmAiUi {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h,out RECT r);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint x,uint y,uint d,UIntPtr e);
}
'@
$appProcess=Get-Process em | Where-Object {$_.Path -eq 'D:\ai\NXY-AIClient\src-tauri\target\release\em.exe'} | Select-Object -First 1
$appWindow=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition) | Where-Object {$_.Current.ProcessId -eq $appProcess.Id -and $_.Current.Name -eq 'EM'} | Select-Object -First 1
if (!$appWindow) { throw 'EM window not found' }
$appHandle=[IntPtr]$appWindow.Current.NativeWindowHandle
[EmAiUi]::ShowWindow($appHandle,9) | Out-Null
$sendShell=New-Object -ComObject WScript.Shell
$sendShell.SendKeys('%')
[EmAiUi]::SetForegroundWindow($appHandle) | Out-Null
Start-Sleep -Milliseconds 300
$rect=New-Object EmAiUi+RECT
[EmAiUi]::GetWindowRect($appHandle,[ref]$rect) | Out-Null
if ($X -ge 0) {
 if ([EmAiUi]::GetForegroundWindow() -ne $appHandle) { throw 'EM is not foreground; refusing input' }
 [EmAiUi]::SetCursorPos($rect.Left+$X,$rect.Top+$Y) | Out-Null
 [EmAiUi]::mouse_event(2,0,0,0,[UIntPtr]::Zero)
 [EmAiUi]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
 Start-Sleep -Milliseconds 200
 if ($Text) { $sendShell.SendKeys($Text) }
}
Start-Sleep -Milliseconds 400
$bmp=New-Object System.Drawing.Bitmap ($rect.Right-$rect.Left),($rect.Bottom-$rect.Top)
$gfx=[System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($rect.Left,$rect.Top,0,0,$bmp.Size)
$bmp.Save('C:\Users\94719\.codex\visualizations\2026\10\12\01a12e05-f80d-7992-8795-27ce084b02ee\em-ai-test.png')
$gfx.Dispose();$bmp.Dispose()
