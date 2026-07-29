[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$BinaryPath,
    [string]$LogDirectory = 'artifacts',
    [ValidateRange(1, 65535)]
    [int]$Port = 4096,
    [ValidateRange(1, 120)]
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$arm64 = 0xAA64
$binary = (Resolve-Path -LiteralPath $BinaryPath).Path
$healthUri = "http://127.0.0.1:$Port/global/health"
$server = $null
$serverStarted = $false

function Get-PeMachine {
    param([string]$Path)

    $bytes = [IO.File]::ReadAllBytes($Path)
    $peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
    return [BitConverter]::ToUInt16($bytes, $peOffset + 4)
}

function Test-PortAvailable {
    param([int]$CandidatePort)

    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $CandidatePort)
    try {
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        $listener.Stop()
    }
}

$machine = Get-PeMachine -Path $binary
if ($machine -ne $arm64) {
    throw ('OpenCode is not ARM64. PE Machine: 0x{0:X4}' -f $machine)
}
if (-not (Test-PortAvailable -CandidatePort $Port)) {
    throw "Port $Port is already in use."
}

$logRoot = [IO.Path]::GetFullPath($LogDirectory)
$tempRoot = if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
    [IO.Path]::GetTempPath()
}
else {
    $env:RUNNER_TEMP
}
$isolatedHome = Join-Path $tempRoot 'opencode-smoke-home'
New-Item -ItemType Directory -Force $logRoot, $isolatedHome | Out-Null

try {
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $binary
    $startInfo.Arguments = "serve --hostname 127.0.0.1 --port $Port --pure --log-level ERROR"
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $null = $startInfo.Environment.Remove('OPENCODE_SERVER_PASSWORD')
    $startInfo.Environment['OPENCODE_PURE'] = '1'
    $startInfo.Environment['OPENCODE_DISABLE_AUTOUPDATE'] = '1'
    $startInfo.Environment['OPENCODE_DISABLE_AUTOCOMPACT'] = '1'
    $startInfo.Environment['OPENCODE_DISABLE_MODELS_FETCH'] = '1'
    $startInfo.Environment['OPENCODE_DISABLE_PROJECT_CONFIG'] = '1'
    $startInfo.Environment['OPENCODE_AUTH_CONTENT'] = '{}'
    $startInfo.Environment['HOME'] = $isolatedHome
    $startInfo.Environment['USERPROFILE'] = $isolatedHome
    $startInfo.Environment['OPENCODE_TEST_HOME'] = $isolatedHome
    $startInfo.Environment['XDG_CONFIG_HOME'] = Join-Path $isolatedHome 'config'
    $startInfo.Environment['XDG_DATA_HOME'] = Join-Path $isolatedHome 'data'
    $startInfo.Environment['XDG_CACHE_HOME'] = Join-Path $isolatedHome 'cache'
    $startInfo.Environment['XDG_STATE_HOME'] = Join-Path $isolatedHome 'state'

    $server = [Diagnostics.Process]::new()
    $server.StartInfo = $startInfo
    if (-not $server.Start()) {
        throw 'Could not start OpenCode.'
    }
    $serverStarted = $true

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $health = $null
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($server.HasExited) {
            throw "OpenCode exited before its health check. Exit code: $($server.ExitCode)."
        }
        try {
            $health = Invoke-RestMethod -Uri $healthUri -TimeoutSec 2
            if ($health.healthy -eq $true) {
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }

    if ($health.healthy -ne $true) {
        throw "Timed out waiting for $healthUri."
    }

    [PSCustomObject]@{
        Result    = 'PASS'
        PeMachine = ('0x{0:X4}' -f $machine)
        Pid       = $server.Id
        Uri       = $healthUri
        Healthy   = $health.healthy
        Version   = $health.version
    } | Format-List
}
finally {
    if ($serverStarted -and -not $server.HasExited) {
        $server.Kill()
        $null = $server.WaitForExit(5000)
    }
    if ($serverStarted) {
        $server.StandardOutput.ReadToEnd() |
            Set-Content -LiteralPath (Join-Path $logRoot 'opencode-server.stdout.log')
        $server.StandardError.ReadToEnd() |
            Set-Content -LiteralPath (Join-Path $logRoot 'opencode-server.stderr.log')
    }
    if ($null -ne $server) {
        $server.Dispose()
    }

    $releaseDeadline = [DateTime]::UtcNow.AddSeconds(5)
    while (
        -not (Test-PortAvailable -CandidatePort $Port) -and
        [DateTime]::UtcNow -lt $releaseDeadline
    ) {
        Start-Sleep -Milliseconds 100
    }
    if (-not (Test-PortAvailable -CandidatePort $Port)) {
        throw "OpenCode stopped, but port $Port was not released."
    }
    Write-Host "Shutdown: PASS (process stopped; port $Port released)"
}
