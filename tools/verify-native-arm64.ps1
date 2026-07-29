param(
    [string]$OpenCodeRoot = (Join-Path $PSScriptRoot '..\..\external_repos\opencode'),
    [string]$OrcaRoot = (Join-Path $PSScriptRoot '..\..\external_repos\orca')
)

$ErrorActionPreference = 'Stop'
$arm64 = 0xAA64
$x64 = 0x8664
$requiredPassed = 0
$requiredFailed = 0
$knownGaps = 0

function Get-PeMachine {
    param([string]$Path)

    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 64) {
        throw "Arquivo pequeno demais para ser PE: $Path"
    }
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    if ($peOffset -lt 0 -or ($peOffset + 6) -gt $bytes.Length) {
        throw "Cabecalho PE invalido: $Path"
    }
    return [BitConverter]::ToUInt16($bytes, $peOffset + 4)
}

function Resolve-One {
    param([string]$Pattern)

    $matches = @(Get-Item -Path $Pattern -ErrorAction SilentlyContinue)
    if ($matches.Count -eq 0) {
        return $null
    }
    if ($matches.Count -gt 1) {
        throw "Mais de um arquivo corresponde a: $Pattern"
    }
    return $matches[0].FullName
}

function Test-Arm64 {
    param(
        [string]$Label,
        [string]$Pattern,
        [bool]$Required = $true
    )

    $path = Resolve-One $Pattern
    if (-not $path) {
        if ($Required) {
            $script:requiredFailed++
            Write-Host "[FAIL] $Label - ausente"
        } else {
            Write-Host "[WARN] $Label - ausente"
        }
        return
    }

    $machine = Get-PeMachine $path
    if ($machine -eq $arm64) {
        if ($Required) {
            $script:requiredPassed++
        }
        Write-Host ("[PASS] {0} - ARM64 (0x{1:X4})" -f $Label, $machine)
        return
    }

    if ($Required) {
        $script:requiredFailed++
        Write-Host ("[FAIL] {0} - arquitetura 0x{1:X4}" -f $Label, $machine)
    } else {
        Write-Host ("[WARN] {0} - arquitetura 0x{1:X4}" -f $Label, $machine)
    }
}

function Show-X64Gap {
    param(
        [string]$Label,
        [string]$Pattern
    )

    $script:knownGaps++
    $path = Resolve-One $Pattern
    if (-not $path) {
        Write-Host "[GAP ] $Label - payload ARM64 indisponivel"
        return
    }

    $machine = Get-PeMachine $path
    if ($machine -eq $x64) {
        Write-Host ("[GAP ] {0} - somente x64 (0x{1:X4})" -f $Label, $machine)
    } else {
        Write-Host ("[GAP ] {0} - arquitetura inesperada 0x{1:X4}" -f $Label, $machine)
    }
}

$OpenCodeRoot = (Resolve-Path $OpenCodeRoot).Path
$OrcaRoot = (Resolve-Path $OrcaRoot).Path

Write-Host 'OpenCode'
Test-Arm64 'executavel compilado' (Join-Path $OpenCodeRoot 'packages\opencode\dist\opencode-windows-arm64\bin\opencode.exe')
Test-Arm64 'OpenTUI' (Join-Path $OpenCodeRoot 'node_modules\.bun\@opentui+core-win32-arm64@*\node_modules\@opentui\core-win32-arm64\opentui.dll')
Test-Arm64 'FFF' (Join-Path $OpenCodeRoot 'node_modules\.bun\@ff-labs+fff-bin-win32-arm64@*\node_modules\@ff-labs\fff-bin-win32-arm64\fff_c.dll')
Test-Arm64 'Parcel watcher' (Join-Path $OpenCodeRoot 'node_modules\.bun\@parcel+watcher-win32-arm64@*\node_modules\@parcel\watcher-win32-arm64\watcher.node')
Test-Arm64 'node-pty ConPTY' (Join-Path $OpenCodeRoot 'node_modules\.bun\@lydell+node-pty-win32-arm64@*\node_modules\@lydell\node-pty-win32-arm64\prebuilds\win32-arm64\conpty.node') $false
Test-Arm64 'node-pty console list' (Join-Path $OpenCodeRoot 'node_modules\.bun\@lydell+node-pty-win32-arm64@*\node_modules\@lydell\node-pty-win32-arm64\prebuilds\win32-arm64\conpty_console_list.node') $false
Test-Arm64 'node-pty OpenConsole' (Join-Path $OpenCodeRoot 'node_modules\.bun\@lydell+node-pty-win32-arm64@*\node_modules\@lydell\node-pty-win32-arm64\prebuilds\win32-arm64\conpty\OpenConsole.exe') $false
Test-Arm64 'node-pty conpty.dll' (Join-Path $OpenCodeRoot 'node_modules\.bun\@lydell+node-pty-win32-arm64@*\node_modules\@lydell\node-pty-win32-arm64\prebuilds\win32-arm64\conpty\conpty.dll') $false
Show-X64Gap 'bun-pty rust_pty.dll' (Join-Path $OpenCodeRoot 'node_modules\.bun\bun-pty@*\node_modules\bun-pty\rust-pty\target\release\rust_pty.dll')

Write-Host ''
Write-Host 'Orca'
Test-Arm64 'Electron' (Join-Path $OrcaRoot 'node_modules\electron\dist\electron.exe')
Test-Arm64 'node-pty pty.node' (Join-Path $OrcaRoot 'node_modules\node-pty\prebuilds\win32-arm64\pty.node')
Test-Arm64 'node-pty ConPTY' (Join-Path $OrcaRoot 'node_modules\node-pty\prebuilds\win32-arm64\conpty.node')
Test-Arm64 'node-pty console list' (Join-Path $OrcaRoot 'node_modules\node-pty\prebuilds\win32-arm64\conpty_console_list.node')
Test-Arm64 'node-pty OpenConsole' (Join-Path $OrcaRoot 'node_modules\node-pty\prebuilds\win32-arm64\conpty\OpenConsole.exe')
Test-Arm64 'node-pty conpty.dll' (Join-Path $OrcaRoot 'node_modules\node-pty\prebuilds\win32-arm64\conpty\conpty.dll')
Test-Arm64 'Parcel watcher' (Join-Path $OrcaRoot 'node_modules\.pnpm\@parcel+watcher-win32-arm64@*\node_modules\@parcel\watcher-win32-arm64\watcher.node')
Test-Arm64 'Windows registry' (Join-Path $OrcaRoot 'node_modules\windows-native-registry\build\Release\native.node')
Test-Arm64 'cpu-features' (Join-Path $OrcaRoot 'node_modules\cpu-features\build\Release\cpufeatures.node') $false
Show-X64Gap 'agent-browser' (Join-Path $OrcaRoot 'node_modules\agent-browser\bin\agent-browser-win32-x64.exe')

$script:knownGaps++
Write-Host '[GAP ] sherpa-onnx - nao publica pacote Windows ARM64'

$windowsLauncher = Join-Path $OrcaRoot 'native\windows-cli-launcher\.build\orca.exe'
if (Test-Path $windowsLauncher) {
    $launcherArchitecture = [Reflection.AssemblyName]::GetAssemblyName($windowsLauncher).ProcessorArchitecture
    if ($launcherArchitecture -eq 'MSIL') {
        $script:requiredPassed++
        Write-Host '[PASS] Windows CLI launcher - managed MSIL'
    } else {
        $script:requiredFailed++
        Write-Host "[FAIL] Windows CLI launcher - $launcherArchitecture"
    }
} else {
    $script:knownGaps++
    Write-Host '[GAP ] Windows CLI launcher - ainda nao foi gerado'
}

Write-Host ''
Write-Host "Required ARM64 checks: $requiredPassed passed, $requiredFailed failed"
Write-Host "Known gaps: $knownGaps"

if ($requiredFailed -gt 0) {
    exit 1
}
