[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$BinaryPath,
    [string]$LogDirectory = 'artifacts',
    [ValidateRange(1, 65535)]
    [int]$Port = 4097,
    [ValidateRange(1, 120)]
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$x64 = 0x8664
$binary = (Resolve-Path -LiteralPath $BinaryPath).Path
$healthUri = "http://127.0.0.1:$Port/global/health"
$server = $null

function Get-PeMachine([string]$Path) {
    $bytes = [IO.File]::ReadAllBytes($Path)
    $offset = [BitConverter]::ToInt32($bytes, 0x3c)
    [BitConverter]::ToUInt16($bytes, $offset + 4)
}

if ((Get-PeMachine $binary) -ne $x64) {
    throw 'OpenCode is not x64.'
}

$logRoot = [IO.Path]::GetFullPath($LogDirectory)
$home = Join-Path ($env:RUNNER_TEMP ?? [IO.Path]::GetTempPath()) 'opencode-x64-smoke-home'
New-Item -ItemType Directory -Force $logRoot, $home | Out-Null

try {
    $start = [Diagnostics.ProcessStartInfo]::new($binary, "serve --hostname 127.0.0.1 --port $Port --pure --log-level ERROR")
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($name in 'OPENCODE_PURE', 'OPENCODE_DISABLE_AUTOUPDATE', 'OPENCODE_DISABLE_AUTOCOMPACT', 'OPENCODE_DISABLE_MODELS_FETCH', 'OPENCODE_DISABLE_PROJECT_CONFIG') {
        $start.Environment[$name] = '1'
    }
    $start.Environment['OPENCODE_AUTH_CONTENT'] = '{}'
    $start.Environment['HOME'] = $home
    $start.Environment['USERPROFILE'] = $home
    $start.Environment['OPENCODE_TEST_HOME'] = $home
    $server = [Diagnostics.Process]::new()
    $server.StartInfo = $start
    if (-not $server.Start()) { throw 'Could not start OpenCode.' }

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        if ($server.HasExited) { throw "OpenCode exited early: $($server.ExitCode)" }
        try { $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2 } catch { Start-Sleep -Milliseconds 250 }
    } while ([DateTime]::UtcNow -lt $deadline -and $health.healthy -ne $true)

    if ($health.healthy -ne $true) { throw "Timed out waiting for $healthUri." }
    Write-Host "OpenCode x64 serve smoke: PASS ($healthUri)"
}
finally {
    if ($null -ne $server) {
        if (-not $server.HasExited) { $server.Kill(); $null = $server.WaitForExit(5000) }
        $server.StandardOutput.ReadToEnd() | Set-Content -LiteralPath (Join-Path $logRoot 'opencode-server.stdout.log')
        $server.StandardError.ReadToEnd() | Set-Content -LiteralPath (Join-Path $logRoot 'opencode-server.stderr.log')
        $server.Dispose()
    }
}
