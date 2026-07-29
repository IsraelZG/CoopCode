param(
    [string]$AppDir = 'C:\Dev2026\external_repos\orca\dist\win-arm64-unpacked',
    [string]$Installer = 'C:\Dev2026\external_repos\orca\dist\orca-windows-setup.exe'
)

$ErrorActionPreference = 'Stop'
$arm64 = 0xAA64
$passed = 0
$failed = 0

function Get-PeMachine {
    param([string]$Path)

    $bytes = [IO.File]::ReadAllBytes($Path)
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    return [BitConverter]::ToUInt16($bytes, $peOffset + 4)
}

function Get-Sha256 {
    param([string]$Path)

    $stream = [IO.File]::OpenRead($Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
        $stream.Dispose()
    }
}

function Test-Arm64 {
    param(
        [string]$Label,
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        $script:failed++
        Write-Host "[FAIL] $Label - missing"
        return
    }

    $machine = Get-PeMachine $Path
    if ($machine -eq $arm64) {
        $script:passed++
        Write-Host ("[PASS] {0} - ARM64 (0x{1:X4})" -f $Label, $machine)
    } else {
        $script:failed++
        Write-Host ("[FAIL] {0} - architecture 0x{1:X4}" -f $Label, $machine)
    }
}

function Test-Absent {
    param(
        [string]$Label,
        [string]$Path
    )

    if (Test-Path -LiteralPath $Path) {
        $script:failed++
        Write-Host "[FAIL] $Label - present"
    } else {
        $script:passed++
        Write-Host "[PASS] $Label - absent"
    }
}

$AppDir = (Resolve-Path $AppDir).Path
$resources = Join-Path $AppDir 'resources'

Test-Arm64 'Orca.exe' (Join-Path $AppDir 'Orca.exe')
Test-Arm64 'node-pty pty.node' (Join-Path $resources 'node_modules\node-pty\build\Release\pty.node')
Test-Arm64 'node-pty conpty.node' (Join-Path $resources 'node_modules\node-pty\build\Release\conpty.node')
Test-Arm64 'node-pty console list' (Join-Path $resources 'node_modules\node-pty\build\Release\conpty_console_list.node')
Test-Arm64 'node-pty OpenConsole' (Join-Path $resources 'node_modules\node-pty\build\Release\conpty\OpenConsole.exe')
Test-Arm64 'node-pty conpty.dll' (Join-Path $resources 'node_modules\node-pty\build\Release\conpty\conpty.dll')
Test-Arm64 'Parcel watcher' (Join-Path $resources 'node_modules\@parcel\watcher-win32-arm64\watcher.node')
Test-Arm64 'Windows registry' (Join-Path $resources 'node_modules\windows-native-registry\build\Release\native.node')

$launcher = Join-Path $resources 'bin\orca.exe'
if (Test-Path -LiteralPath $launcher -PathType Leaf) {
    $launcherArchitecture = [Reflection.AssemblyName]::GetAssemblyName($launcher).ProcessorArchitecture
    if ($launcherArchitecture -eq 'MSIL') {
        $passed++
        Write-Host '[PASS] Orca CLI launcher - managed MSIL'
    } else {
        $failed++
        Write-Host "[FAIL] Orca CLI launcher - $launcherArchitecture"
    }
} else {
    $failed++
    Write-Host '[FAIL] Orca CLI launcher - missing'
}

Test-Absent 'x64 agent-browser helper' (Join-Path $resources 'agent-browser-win32-x64.exe')
Test-Absent 'x64 sherpa-onnx payload' (Join-Path $resources 'node_modules\sherpa-onnx-win-x64')

if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) {
    $failed++
    Write-Host '[FAIL] NSIS installer - missing'
} else {
    $passed++
    $installerItem = Get-Item -LiteralPath $Installer
    Write-Host "[PASS] NSIS installer - $($installerItem.Length) bytes"
    Write-Host "Installer SHA256: $(Get-Sha256 $Installer)"
}

$appItem = Get-Item -LiteralPath (Join-Path $AppDir 'Orca.exe')
Write-Host "Orca.exe bytes: $($appItem.Length)"
Write-Host "Orca.exe SHA256: $(Get-Sha256 $appItem.FullName)"
Write-Host ''
Write-Host "Package ARM64 checks: $passed passed, $failed failed"

if ($failed -gt 0) {
    exit 1
}
