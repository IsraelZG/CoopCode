[CmdletBinding()]
param(
    [string]$AppDir = 'dist/win-unpacked',
    [string]$Installer = 'dist/orca-windows-setup.exe'
)

$ErrorActionPreference = 'Stop'
$x64 = 0x8664

function Assert-X64([string]$Label, [string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label is missing: $Path" }
    $bytes = [IO.File]::ReadAllBytes($Path)
    $offset = [BitConverter]::ToInt32($bytes, 0x3c)
    if ([BitConverter]::ToUInt16($bytes, $offset + 4) -ne $x64) { throw "$Label is not x64: $Path" }
    Write-Host "${Label}: x64"
}

$app = (Resolve-Path -LiteralPath $AppDir).Path
$resources = Join-Path $app 'resources'
Assert-X64 'Orca.exe' (Join-Path $app 'Orca.exe')
Assert-X64 'node-pty pty.node' (Join-Path $resources 'node_modules/node-pty/build/Release/pty.node')
Assert-X64 'node-pty conpty.node' (Join-Path $resources 'node_modules/node-pty/build/Release/conpty.node')
Assert-X64 'node-pty console list' (Join-Path $resources 'node_modules/node-pty/build/Release/conpty_console_list.node')
Assert-X64 'node-pty OpenConsole' (Join-Path $resources 'node_modules/node-pty/build/Release/conpty/OpenConsole.exe')
Assert-X64 'node-pty conpty.dll' (Join-Path $resources 'node_modules/node-pty/build/Release/conpty/conpty.dll')
Assert-X64 'Parcel watcher' (Join-Path $resources 'node_modules/@parcel/watcher-win32-x64/watcher.node')
Assert-X64 'Windows registry' (Join-Path $resources 'node_modules/windows-native-registry/build/Release/native.node')
Assert-X64 'agent-browser helper' (Join-Path $resources 'agent-browser-win32-x64.exe')
Assert-X64 'sherpa payload' (Join-Path $resources 'node_modules/sherpa-onnx-win-x64/sherpa-onnx.node')
if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) { throw "Installer is missing: $Installer" }
Write-Host 'Orca x64 package: PASS'
