$ErrorActionPreference = 'Stop'
$release = 'D:\ai\NXY-AIClient\src-tauri\target\release\em.exe'
$oldBinary = 'D:\ai\NXY-AIClient\src-tauri\target\release\linyu.exe'
$oldShortcut = 'C:\Users\94719\Desktop\em.exe - 快捷方式.lnk'
$newShortcut = 'C:\Users\94719\Desktop\EM.lnk'
$backup = 'C:\Users\94719\AppData\Local\chat.linyu\backups\formal-consolidation-20261020-162239'
if (!(Test-Path -LiteralPath $release) -or !(Test-Path -LiteralPath $backup)) { throw 'Expected release or backup missing' }
if (Test-Path -LiteralPath $newShortcut) { throw 'EM shortcut already exists; inspect before changing' }
$shellObject = New-Object -ComObject WScript.Shell
$shortcut = $shellObject.CreateShortcut($oldShortcut)
if ($shortcut.TargetPath -ne $oldBinary) { throw 'Shortcut target changed; refusing to overwrite' }
$shortcut.TargetPath = $release
$shortcut.WorkingDirectory = 'D:\ai\NXY-AIClient'
$shortcut.Arguments = ''
$shortcut.IconLocation = "$release,0"
$shortcut.Description = 'EM'
$shortcut.Save()
Move-Item -LiteralPath $oldShortcut -Destination $newShortcut
if (Test-Path -LiteralPath $oldBinary) {
  if (Get-Process linyu -ErrorAction SilentlyContinue) { throw 'Old binary is running; not moving it' }
  Move-Item -LiteralPath $oldBinary -Destination (Join-Path $backup 'linyu-previous-release.exe')
}
Write-Output 'Desktop EM shortcut now launches only target\release\em.exe; obsolete binary retained in backup.'
